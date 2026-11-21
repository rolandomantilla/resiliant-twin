// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEEDS_ROLES } from "../db/seed-roles";
import {
  catalogKeys,
  check,
  hasRbac,
  PASSTHROUGH_CALLS,
  PASSTHROUGH_KEYS,
  readProcedures,
  report,
  ROLE_INSERT,
  usedKeys,
} from "./check";

type Files = Record<string, string>;

/** A throwaway app tree, so the checker is exercised the way it really runs. */
function app(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), "rbac-check-"));
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  return root;
}

const CATALOG = `
import type { PermissionCatalog } from "@/lib/rbac";
export const PERMISSION_CATALOG: PermissionCatalog = [
  { feature: "Expenses", permissions: [
    { key: "expenses.view", label: "View expenses" },
    { key: "expenses.approve", label: "Approve expenses" },
  ]},
];
`;

const ROLES_MIGRATION = `-- custom
INSERT INTO "app_roles" ("name", "permissions") VALUES ('Admin', ARRAY['*']::text[]);
`;

const wired: Files = {
  "src/lib/permissions.ts": CATALOG,
  "src/server/db/migrations/0001_rbac_roles.sql": ROLES_MIGRATION,
  "src/server/trpc/routers/expenses.ts": `
    export const expensesRouter = createTRPCRouter({
      list: permissionProcedure("expenses.view").query(async () => []),
      approve: permissionProcedure("expenses.approve").mutation(async () => true),
    });
  `,
};

const findings = (files: Files) => check(app(files)).findings.map((f) => f.message);

describe("hasRbac", () => {
  it("leaves an app that never asked for roles alone", () => {
    expect(hasRbac(app({ "src/server/db/rbacSchema.ts": "export const appRoles = 1;" }))).toBe(
      false,
    );
  });

  it("counts the catalog the agent writes", () => {
    expect(hasRbac(app({ "src/lib/permissions.ts": CATALOG }))).toBe(true);
  });

  it("counts the drizzle config line that creates the tables", () => {
    expect(
      hasRbac(
        app({
          "drizzle.config.ts": `schema: ["./src/server/db/schema.ts", "./src/server/db/rbacSchema.ts"]`,
        }),
      ),
    ).toBe(true);
  });
});

describe("catalogKeys", () => {
  it("reads every key out of the catalog", () => {
    expect([...catalogKeys(CATALOG)]).toEqual(["expenses.view", "expenses.approve"]);
  });

  it("is empty for an app with no catalog", () => {
    expect([...catalogKeys(undefined)]).toEqual([]);
  });
});

describe("readProcedures", () => {
  it("pairs a procedure with its gate across the lines between them", () => {
    const procedures = readProcedures(
      "r.ts",
      `
        list: permissionProcedure("expenses.view")
          .input(z.object({}))
          .query(async () => []),
        close: protectedProcedure.mutation(async () => true),
      `,
    );

    expect(procedures).toMatchObject([
      { name: "list", type: "query", gate: { kind: "permission", key: "expenses.view" } },
      { name: "close", type: "mutation", gate: { kind: "floor" } },
    ]);
  });

  it("names the line, so a finding can be acted on", () => {
    const procedures = readProcedures("r.ts", `\n\n  ask: protectedProcedure.query(() => 1),`);

    expect(procedures[0].where).toBe("r.ts:3");
  });
});

describe("usedKeys", () => {
  it("finds a key wherever the app names it", () => {
    const used = usedKeys(
      new Map([
        ["src/server/trpc/routers/a.ts", `permissionProcedure("a.view")`],
        ["src/services/b.ts", `await requirePermission("b.edit")`],
        ["src/components/layout/index.ts", `{ permission: "c.view" }`],
        ["src/routes/d.tsx", `useCan("d.view")`],
      ]),
    );

    expect([...used.keys()].sort()).toEqual(["a.view", "b.edit", "c.view", "d.view"]);
  });
});

describe("check", () => {
  it("passes an app that is wired correctly", () => {
    expect(findings(wired)).toEqual([]);
  });

  it("catches a mutation left on the floor, which refuses every other role", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/expenses.ts": `
          submit: protectedProcedure.mutation(async () => true),
        `,
      }),
    ).toContainEqual(expect.stringContaining("submit is a mutation on protectedProcedure"));
  });

  it("catches a query left on the floor, which every role can read", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/expenses.ts": `
          list: protectedProcedure.query(async () => []),
        `,
      }),
    ).toContainEqual(expect.stringContaining("list is a query on protectedProcedure"));
  });

  it("catches a key that is not in the catalog, which gates against everyone", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/expenses.ts": `
          list: permissionProcedure("expense.view").query(async () => []),
        `,
      }),
    ).toContainEqual(expect.stringContaining('"expense.view" is not in PERMISSION_CATALOG'));
  });

  it("catches a read gated on a key Viewer will never hold", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/expenses.ts": `
          list: permissionProcedure("expenses.approve").query(async () => []),
        `,
      }),
    ).toContainEqual(expect.stringContaining("not a .view key"));
  });

  it("catches a missing roles migration, without which no role exists", () => {
    const { "src/server/db/migrations/0001_rbac_roles.sql": _omitted, ...rest } = wired;

    expect(findings(rest)).toContainEqual(
      expect.stringContaining("no migration inserts into app_roles"),
    );
  });

  it("does not take a migration for some other table as the roles one", () => {
    expect(
      findings({
        ...wired,
        "src/server/db/migrations/0001_rbac_roles.sql": `INSERT INTO "app_roles_archive" ("name") VALUES ('x');`,
      }),
    ).toContainEqual(expect.stringContaining("no migration inserts into app_roles"));
  });

  it("warns about a catalog key that gates nothing, since granting it does nothing", () => {
    const messages = findings({
      ...wired,
      "src/server/trpc/routers/expenses.ts": `
        list: permissionProcedure("expenses.view").query(async () => []),
      `,
    });

    expect(messages).toContainEqual(expect.stringContaining('"expenses.approve" is in the catalog'));
  });

  it("leaves base's own passthroughs out of it", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/other.ts": `
          querySource: platformProcedure.mutation(async () => []),
        `,
      }),
    ).toEqual([]);
  });

  it("ignores tests, which are not wiring", () => {
    expect(
      findings({
        ...wired,
        "src/server/trpc/routers/expenses.test.ts": `
          thing: protectedProcedure.mutation(async () => true),
        `,
      }),
    ).toEqual([]);
  });
});

describe("report", () => {
  it("lists every procedure and who can run it", () => {
    const { procedures } = check(app(wired));

    const table = report(procedures);
    expect(table).toContain("read   list");
    expect(table).toContain("expenses.view");
    expect(table).toContain("write  approve");
    expect(table).toContain("expenses.approve");
  });

  it("says admins only for a procedure left on the floor", () => {
    const { procedures } = check(
      app({
        ...wired,
        "src/server/trpc/routers/expenses.ts": `submit: protectedProcedure.mutation(() => 1),`,
      }),
    );

    expect(report(procedures)).toContain("admins only");
  });
});

describe("the roles-migration pattern", () => {
  it("is the same test the seeder applies, so the two cannot disagree", () => {
    expect(ROLE_INSERT.source).toBe(SEEDS_ROLES.source);
    expect(ROLE_INSERT.flags).toBe(SEEDS_ROLES.flags);
  });
});

// `data.query` and friends gate base's own passthroughs, so nothing in the
// app's source names them and the usual "gates nothing" warning would be wrong.
describe("the keys base's passthroughs honour", () => {
  const withPassthrough = {
    ...wired,
    "src/lib/permissions.ts": CATALOG.replace(
      '{ key: "expenses.view", label: "View expenses" },',
      '{ key: "expenses.view", label: "View expenses" },\n    { key: "data.query", label: "Query data" },',
    ),
    "src/server/trpc/routers/expenses.ts": `
      list: permissionProcedure("expenses.view").query(async () => []),
      approve: permissionProcedure("expenses.approve").mutation(async () => true),
    `,
  };

  it("does not call one of them dead just because the app never names it", () => {
    expect(findings(withPassthrough)).not.toContainEqual(
      expect.stringContaining('"data.query" is in the catalog but gates nothing'),
    );
  });

  it("says what putting one in the catalog does, since it closes a passthrough", () => {
    expect(findings(withPassthrough)).toContainEqual(
      expect.stringContaining("closes one of base's data passthroughs"),
    );
  });

  it("stays quiet about one the app has not adopted", () => {
    expect(findings(wired)).toEqual([]);
    expect(PASSTHROUGH_KEYS).toContain("data.query");
  });
});

// Being told to add the key is not the key being there. An app that calls a
// passthrough has an open door until some role holds it.
describe("an app that calls a passthrough", () => {
  const calling = (source: string) => ({
    ...wired,
    "src/hooks/useConnectors.ts": source,
  });

  it("is an error when the key is not even in the catalog", () => {
    expect(findings(calling("t.connectors.querySource.mutationOptions()"))).toContainEqual(
      expect.stringContaining("calls the data.query passthrough"),
    );
  });

  it("catches it through the hook name too", () => {
    expect(findings(calling("export function usePaginatedQuerySource() {}"))).toContainEqual(
      expect.stringContaining("calls the data.query passthrough"),
    );
  });

  it("names the model passthrough separately", () => {
    expect(findings(calling("t.connectors.executeModel.mutationOptions()"))).toContainEqual(
      expect.stringContaining("calls the ai.ask passthrough"),
    );
  });

  it("names the workflow passthrough separately", () => {
    expect(findings(calling("client.workflows.run.mutate({})"))).toContainEqual(
      expect.stringContaining("calls the workflows.run passthrough"),
    );
  });

  it("is quiet once the key is in the catalog", () => {
    const messages = findings({
      ...calling("t.connectors.querySource.mutationOptions()"),
      "src/lib/permissions.ts": CATALOG.replace(
        '{ key: "expenses.view", label: "View expenses" },',
        '{ key: "expenses.view", label: "View expenses" },\n    { key: "data.query", label: "Query data" },',
      ),
    });

    expect(messages).not.toContainEqual(expect.stringContaining("calls the data.query passthrough"));
  });

  it("says nothing about a passthrough the app never calls", () => {
    expect(findings(wired)).toEqual([]);
    expect(PASSTHROUGH_CALLS.map((p) => p.key)).toEqual(PASSTHROUGH_KEYS);
  });
});
