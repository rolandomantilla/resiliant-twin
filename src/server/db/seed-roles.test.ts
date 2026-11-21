// @vitest-environment node
import { describe, expect, it } from "vitest";
import { roleSeedStatements, SEEDS_ROLES } from "./seed-roles";

const CUSTOM_FILE = `-- Custom SQL migration file, put your code below! --
INSERT INTO "app_roles" ("name", "description", "permissions", "is_default")
VALUES
  ('Admin', 'Full access; including managing roles.', ARRAY['*']::text[], false),
  ('Viewer', 'Can view data but not change it.', ARRAY['expenses.view']::text[], true)
ON CONFLICT ("name") DO NOTHING;
`;

describe("roleSeedStatements", () => {
  it("keeps the insert from a drizzle --custom file, whose first line is a comment", () => {
    const statements = roleSeedStatements(CUSTOM_FILE);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('INSERT INTO "app_roles"');
    expect(statements[0]).toContain("ON CONFLICT");
  });

  it("does not split a description that contains a semicolon", () => {
    const statements = roleSeedStatements(CUSTOM_FILE);

    expect(statements[0]).toContain("Full access; including managing roles.");
  });

  it("splits on the drizzle breakpoint only", () => {
    const two = `INSERT INTO "app_roles" ("name") VALUES ('A');
--> statement-breakpoint
INSERT INTO "app_roles" ("name") VALUES ('B');`;

    expect(roleSeedStatements(two)).toHaveLength(2);
  });

  it("drops the DDL from a file that creates the tables and seeds them", () => {
    const together = `CREATE TABLE IF NOT EXISTS "app_roles" ("id" uuid PRIMARY KEY);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_members" ("id" uuid PRIMARY KEY);
--> statement-breakpoint
INSERT INTO "app_roles" ("name") VALUES ('Admin') ON CONFLICT ("name") DO NOTHING;`;

    const statements = roleSeedStatements(together);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('INSERT INTO "app_roles"');
  });

  it("keeps every role insert in such a file, not just the first", () => {
    const together = `CREATE TABLE "app_roles" ("id" uuid);
--> statement-breakpoint
INSERT INTO "app_roles" ("name") VALUES ('Admin');
--> statement-breakpoint
INSERT INTO "app_roles" ("name") VALUES ('Viewer');`;

    expect(roleSeedStatements(together)).toHaveLength(2);
  });

  it("leaves an insert into another table alone", () => {
    const together = `INSERT INTO "app_roles" ("name") VALUES ('Admin');
--> statement-breakpoint
INSERT INTO "app_members" ("email") VALUES ('a@b.com');
--> statement-breakpoint
INSERT INTO "expenses" ("amount") VALUES (10);`;

    const statements = roleSeedStatements(together);

    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain('INSERT INTO "app_roles"');
  });

  it("does not take an insert into a table whose name starts with app_roles", () => {
    expect(
      roleSeedStatements(`INSERT INTO "app_roles_archive" ("name") VALUES ('Old');`),
    ).toEqual([]);
    expect(
      roleSeedStatements(`INSERT INTO app_roles_archive ("name") VALUES ('Old');`),
    ).toEqual([]);
  });

  it("takes an unquoted app_roles insert", () => {
    expect(
      roleSeedStatements(`INSERT INTO app_roles ("name") VALUES ('Admin');`),
    ).toHaveLength(1);
  });

  it("drops an ALTER TABLE that follows the seed", () => {
    const after = `INSERT INTO "app_roles" ("name") VALUES ('Admin');
--> statement-breakpoint
ALTER TABLE "app_members" ADD CONSTRAINT "fk" FOREIGN KEY ("role_id") REFERENCES "app_roles"("id");`;

    expect(roleSeedStatements(after)).toHaveLength(1);
  });

  it("drops a chunk that is only comments", () => {
    expect(roleSeedStatements("-- nothing here --\n-- really --")).toEqual([]);
  });

  it("drops empty chunks", () => {
    expect(roleSeedStatements("\n\n   \n")).toEqual([]);
  });
});

describe("SEEDS_ROLES", () => {
  it("matches a role insert", () => {
    expect(SEEDS_ROLES.test(CUSTOM_FILE)).toBe(true);
  });

  it("does not match an unrelated migration", () => {
    expect(SEEDS_ROLES.test('CREATE TABLE "expenses" (id uuid);')).toBe(false);
  });

  it("does not match a migration that only touches a table named like it", () => {
    expect(
      SEEDS_ROLES.test(`INSERT INTO "app_roles_archive" ("name") VALUES ('Old');`),
    ).toBe(false);
    expect(
      SEEDS_ROLES.test(`INSERT INTO app_roles_archive ("name") VALUES ('Old');`),
    ).toBe(false);
  });
});
