#!/usr/bin/env bun

import { config } from "dotenv";
config({ path: ".env.local" });

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const MIGRATIONS = "src/server/db/migrations";
const BREAKPOINT = "--> statement-breakpoint";

/**
 * An insert into `app_roles` itself. The word boundary keeps out a table whose
 * name merely starts the same way, such as `app_roles_archive`.
 */
export const SEEDS_ROLES = /insert\s+into\s+(?:"app_roles"|app_roles\b)/i;

const STARTS_WITH_ROLE_INSERT = /^insert\s+into\s+(?:"app_roles"|app_roles\b)/i;

/**
 * The chunk without its leading comment lines, so a drizzle `--custom` file,
 * whose first line is always a comment, is still read for what it does.
 */
const statementBody = (chunk: string): string =>
  chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"))
    .join("\n");

/**
 * The `app_roles` inserts and nothing else.
 *
 * Two kinds of statement share the file. The roles migration can hold its
 * `CREATE TABLE` statements alongside the seed, and this script runs against a
 * database whose tables are already there, so re-running the DDL fails on the
 * first statement and takes the seed down with it. It can also hold inserts
 * into other tables, sample rows or a first member, which carry no
 * `ON CONFLICT` guard of their own and would duplicate or fail on a second run.
 * Recovery after a revert only needs the roles back, so only they are replayed.
 */
export function roleSeedStatements(sql: string): string[] {
  return sql
    .split(BREAKPOINT)
    .map((chunk) => chunk.trim())
    .filter((chunk) => STARTS_WITH_ROLE_INSERT.test(statementBody(chunk)));
}

export function findRoleSeedFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .filter((file) => SEEDS_ROLES.test(readFileSync(join(dir, file), "utf8")));
}

async function main(): Promise<never> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const dir = resolve(MIGRATIONS);
  const files = findRoleSeedFiles(dir);

  if (files.length === 0) {
    console.log("No role migrations found. This app does not manage roles.");
    process.exit(0);
  }

  const sql = neon(url);
  let applied = 0;

  for (const file of files) {
    for (const statement of roleSeedStatements(readFileSync(join(dir, file), "utf8"))) {
      await sql.query(statement);
      applied += 1;
    }
    console.log(`Applied ${file}`);
  }

  console.log(`Roles seeded. ${applied} statement(s) from ${files.length} migration(s).`);
  process.exit(0);
}

if (process.argv[1]?.endsWith("seed-roles.ts")) {
  await main();
}
