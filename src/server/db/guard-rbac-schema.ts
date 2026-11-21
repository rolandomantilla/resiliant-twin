#!/usr/bin/env bun
/**
 * Refuses to let `db:generate` run when the prebaked RBAC schema has been
 * dropped from drizzle.config.ts after the tables already exist.
 *
 * Why this exists: drizzle-kit diffs the config's schema files against the last
 * snapshot. Remove rbacSchema.ts from the list once app_roles has been created
 * and the next `db:generate` emits DROP TABLE app_roles / app_members /
 * app_role_audit CASCADE, which on a deployed app destroys every role and
 * assignment. The config is template-owned and therefore agent-writable, so
 * this runs before drizzle-kit as a gate.
 *
 * It keys off the migrations rather than the file: rbacSchema.ts ships in every
 * app, but the tables only exist once an app has asked for roles. An app that
 * never did is free to generate without listing it.
 *
 * Scaffolded verbatim into every template; scaffold-sync.test.ts keeps the
 * copies identical.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG = "drizzle.config.ts";
const MIGRATIONS = "src/server/db/migrations";

const fail = (message: string): never => {
  console.error(`\n  db:generate blocked\n\n  ${message}\n`);
  process.exit(1);
};

const CREATES_APP_ROLES = /create table[^;]*(?<![a-z0-9_])"?app_roles"?(?![a-z0-9_])/i;
const DROPS_APP_ROLES = /drop table[^;]*(?<![a-z0-9_])"?app_roles"?(?![a-z0-9_])/i;

export function rbacTablesPresent(migrations: string[]): boolean {
  let present = false;
  for (const sql of migrations) {
    if (CREATES_APP_ROLES.test(sql)) present = true;
    if (DROPS_APP_ROLES.test(sql)) present = false;
  }
  return present;
}

function readMigrations(): string[] {
  const dir = resolve(MIGRATIONS);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"));
}

function main(): never {
  if (!rbacTablesPresent(readMigrations())) {
    process.exit(0);
  }

  if (!existsSync(resolve(CONFIG))) {
    fail(`The RBAC tables exist but ${CONFIG} does not.`);
  }

  const config = readFileSync(resolve(CONFIG), "utf8");

  if (!config.includes("rbacSchema.ts")) {
    fail(
      `This app has the RBAC tables but ${CONFIG} no longer lists rbacSchema.ts.\n\n` +
        `  Running drizzle-kit now would generate DROP TABLE for app_roles,\n` +
        `  app_members and app_role_audit, destroying every role and member\n` +
        `  assignment in this app.\n\n` +
        `  Restore the schema array:\n\n` +
        `    schema: ["./src/server/db/schema.ts", "./src/server/db/rbacSchema.ts"],`,
    );
  }

  process.exit(0);
}

if (process.argv[1]?.endsWith("guard-rbac-schema.ts")) {
  main();
}
