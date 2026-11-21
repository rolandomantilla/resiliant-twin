#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/**
 * Checks an app's roles wiring, as the last step of setting roles up and after
 * any feature added later.
 *
 * Setting roles up is a dozen manual steps and most of the ways to get them
 * wrong are silent. A mutation left on `protectedProcedure` refuses every
 * non-admin, a query left on it is served to every role, a permission key with
 * a typo gates nothing, and a read key not named `.view` leaves Viewer unable
 * to see the feature, because Viewer is seeded from exactly those keys. None of
 * that fails a build or shows up in the dev server. This reads the app's own
 * source and says which it is.
 *
 * It only ever reads `src/`, which in a sandbox is the app's own code: the
 * shared base lives at `/base` and is not ours to grade. Problems are reported
 * with a file and a line so they can be fixed without hunting.
 */

/**
 * An insert into `app_roles`, the same test `seed-roles.ts` applies.
 *
 * Copied rather than imported: `seed-roles.ts` loads `.env.local` the moment it
 * is imported, and a source check has no business touching the environment. A
 * test keeps the two from drifting apart.
 */
export const ROLE_INSERT = /insert\s+into\s+(?:"app_roles"|app_roles\b)/i;

/**
 * Keys base's own data passthroughs honour, from `PASSTHROUGH_PERMISSIONS` in
 * `lib/rbac.ts`. Nothing in the app's source names them, so without this the
 * check would call a catalog entry for one of them dead. Copied rather than
 * imported, because this file runs under `bun` with no `@/` aliases; a test in
 * base keeps the two lists together.
 */
export const PASSTHROUGH_KEYS = ["data.query", "ai.ask", "workflows.run"];

/**
 * How to tell that the app actually calls one of them.
 *
 * A passthrough runs what it is handed, so an app that calls one from the
 * client has an open door until its key is on a role: being told to add the key
 * is not the same as the key being there. If the app calls one and the key is
 * not even in the catalog, nobody can grant it, so that is an error and not a
 * warning.
 */
export const PASSTHROUGH_CALLS: Array<{ key: string; patterns: RegExp[] }> = [
  {
    key: "data.query",
    patterns: [/connectors\.querySource/, /\buseQuerySource\b/, /\busePaginatedQuerySource\b/],
  },
  { key: "ai.ask", patterns: [/connectors\.executeModel/, /\buseExecuteModel\b/] },
  { key: "workflows.run", patterns: [/workflows\.run\b/] },
];

export type Finding = { level: "error" | "warning"; where: string; message: string };

export type Gate =
  | { kind: "permission"; key: string }
  | { kind: "floor" }
  | { kind: "platform" }
  | { kind: "public" };

export type Procedure = {
  name: string;
  type: "query" | "mutation" | "unknown";
  gate: Gate;
  where: string;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRECTORIES = new Set(["node_modules", "migrations", "__tests__", ".output", "dist"]);

/** Every source file of the app's own, tests excluded: a test is not wiring. */
export function collectSources(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const src = join(root, "src");
  if (!existsSync(src)) return files;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry)) walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(extname(entry))) continue;
      if (entry.includes(".test.") || entry.endsWith(".d.ts")) continue;
      files.set(relative(root, full), readFileSync(full, "utf8"));
    }
  };

  walk(src);
  return files;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

/** The keys the Roles screen can hand out. Anything else gates nothing. */
export function catalogKeys(permissionsFile: string | undefined): Set<string> {
  if (!permissionsFile) return new Set();

  const keys = new Set<string>();
  for (const match of permissionsFile.matchAll(/\bkey\s*:\s*"([^"]+)"/g)) {
    keys.add(match[1]);
  }
  return keys;
}

const PROCEDURE = /(\w+)\s*:\s*(permissionProcedure\(\s*"([^"]+)"\s*\)|protectedProcedure|platformProcedure|publicProcedure)/g;

/**
 * The procedures in a router and what guards each.
 *
 * A procedure's `.query(` or `.mutation(` can be several lines below its
 * declaration, so each declaration owns the text up to the next one.
 */
export function readProcedures(where: string, source: string): Procedure[] {
  const matches = [...source.matchAll(PROCEDURE)];

  return matches.map((match, i) => {
    const start = match.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const body = source.slice(start, end);

    const gate: Gate = match[3]
      ? { kind: "permission", key: match[3] }
      : match[2] === "protectedProcedure"
        ? { kind: "floor" }
        : match[2] === "platformProcedure"
          ? { kind: "platform" }
          : { kind: "public" };

    return {
      name: match[1],
      type: body.includes(".mutation(") ? "mutation" : body.includes(".query(") ? "query" : "unknown",
      gate,
      where: `${where}:${String(lineOf(source, start))}`,
    };
  });
}

/** Every permission key the app names, wherever it names it. */
export function usedKeys(files: Map<string, string>): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const add = (key: string, where: string): void => {
    used.set(key, [...(used.get(key) ?? []), where]);
  };

  const patterns = [
    /permissionProcedure\(\s*"([^"]+)"\s*\)/g,
    /requirePermission\(\s*"([^"]+)"\s*\)/g,
    /protectedServerFn\([^)]*\)\s*,\s*"([^"]+)"/g,
    /\bpermission\s*:\s*"([^"]+)"/g,
    /useCan\(\s*"([^"]+)"\s*\)/g,
    /<Can\s+permission="([^"]+)"/g,
  ];

  for (const [where, source] of files) {
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        add(match[1], `${where}:${String(lineOf(source, match.index))}`);
      }
    }
  }

  return used;
}

/** Whether a roles migration was ever written. Without one no role exists. */
export function hasRolesMigration(root: string): boolean {
  const dir = join(root, "src/server/db/migrations");
  if (!existsSync(dir)) return false;

  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .some((file) => ROLE_INSERT.test(readFileSync(join(dir, file), "utf8")));
}

export function check(root: string): { findings: Finding[]; procedures: Procedure[] } {
  const files = collectSources(root);
  const catalog = catalogKeys(files.get(join("src", "lib", "permissions.ts")));
  const findings: Finding[] = [];

  const procedures = [...files]
    .filter(([where]) => where.includes(join("server", "trpc", "routers")))
    .flatMap(([where, source]) => readProcedures(where, source));

  if (!hasRolesMigration(root)) {
    findings.push({
      level: "error",
      where: "src/server/db/migrations",
      message:
        "no migration inserts into app_roles, so this app has no roles at all. " +
        "Write the roles migration (step 6) before anything else here can work.",
    });
  }

  if (catalog.size === 0) {
    findings.push({
      level: "error",
      where: "src/lib/permissions.ts",
      message:
        "PERMISSION_CATALOG is missing or empty, so the Roles screen has nothing to grant.",
    });
  }

  const used = usedKeys(files);
  for (const { key, patterns } of PASSTHROUGH_CALLS) {
    if (catalog.has(key)) continue;

    const callers = [...files].filter(([, source]) => patterns.some((p) => p.test(source)));
    if (callers.length === 0) continue;

    findings.push({
      level: "error",
      where: callers[0][0],
      message:
        `this app calls the ${key} passthrough, which runs what it is handed, and "${key}" is not in ` +
        "PERMISSION_CATALOG. Until some role holds that key, any member of the app can call the " +
        "endpoint directly whatever their role. Add the key and grant it to the roles that need the data.",
    });
  }

  for (const key of PASSTHROUGH_KEYS) {
    if (!catalog.has(key)) continue;
    findings.push({
      level: "warning",
      where: "src/lib/permissions.ts",
      message:
        `"${key}" closes one of base's data passthroughs once a role holds it. ` +
        "Check that every role which needs that data has it, since the passthrough refuses the rest.",
    });
  }

  for (const [key, places] of used) {
    if (catalog.has(key)) continue;
    findings.push({
      level: "error",
      where: places[0],
      message: `"${key}" is not in PERMISSION_CATALOG, so no role can ever hold it and this gate refuses everyone.`,
    });
  }

  for (const procedure of procedures) {
    if (procedure.gate.kind === "permission") {
      if (procedure.type === "query" && !procedure.gate.key.endsWith(".view")) {
        findings.push({
          level: "error",
          where: procedure.where,
          message:
            `${procedure.name} is a read gated on "${procedure.gate.key}", which is not a .view key. ` +
            "Viewer is seeded from the .view keys only, so Viewer cannot see this feature.",
        });
      }
      continue;
    }

    if (procedure.gate.kind !== "floor") continue;

    if (procedure.type === "mutation") {
      findings.push({
        level: "error",
        where: procedure.where,
        message:
          `${procedure.name} is a mutation on protectedProcedure, so the floor makes it admin-only. ` +
          "Gate it with permissionProcedure(\"…\") if any other role should run it.",
      });
    }
    if (procedure.type === "query") {
      findings.push({
        level: "error",
        where: procedure.where,
        message:
          `${procedure.name} is a query on protectedProcedure, so every role reads it whatever their permissions. ` +
          "Gate it with permissionProcedure(\"feature.view\").",
      });
    }
  }

  for (const key of catalog) {
    if (used.has(key) || PASSTHROUGH_KEYS.includes(key)) continue;
    findings.push({
      level: "warning",
      where: "src/lib/permissions.ts",
      message: `"${key}" is in the catalog but gates nothing, so granting it on the Roles screen changes nothing.`,
    });
  }

  return { findings, procedures };
}

const gateLabel = (gate: Gate): string => {
  switch (gate.kind) {
    case "permission":
      return gate.key;
    case "floor":
      return "admins only";
    case "platform":
      return "any member (base passthrough)";
    case "public":
      return "anyone, signed in or not";
  }
};

/**
 * What the builder is handed: every procedure and who can run it.
 *
 * Asking the builder to confirm the gates only works if they can see them, and
 * this is the part of the app they are entitled to disagree with.
 */
export function report(procedures: Procedure[]): string {
  const rows = procedures
    .filter((p) => p.type !== "unknown")
    .map((p) => `  ${p.type === "mutation" ? "write" : "read "}  ${p.name.padEnd(28)}  ${gateLabel(p.gate)}`);

  return rows.length === 0 ? "  no procedures found" : rows.join("\n");
}

/**
 * Whether this app asked for roles at all. One that never did is left alone.
 *
 * Not the presence of `rbacSchema.ts`: every template ships that file, and the
 * tables only exist once `drizzle.config.ts` names it. So the signal is the
 * catalog the agent writes, or that config line.
 */
export function hasRbac(root: string): boolean {
  if (existsSync(join(root, "src/lib/permissions.ts"))) return true;

  const config = join(root, "drizzle.config.ts");
  return existsSync(config) && readFileSync(config, "utf8").includes("rbacSchema");
}

function main(): void {
  const root = process.cwd();

  if (!hasRbac(root)) {
    console.log("This app has no roles, so there is nothing to check.");
    return;
  }

  const { findings, procedures } = check(root);

  console.log("\nWho can run what\n");
  console.log(report(procedures));

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  for (const finding of [...errors, ...warnings]) {
    console.log(`\n${finding.level === "error" ? "error" : "warning"}  ${finding.where}\n  ${finding.message}`);
  }

  if (errors.length === 0) {
    console.log(`\nRoles wiring looks right${warnings.length > 0 ? `, with ${String(warnings.length)} warning(s)` : ""}.\n`);
    return;
  }

  console.log(`\n${String(errors.length)} problem(s) to fix.\n`);
  process.exit(1);
}

if (import.meta.main) main();
