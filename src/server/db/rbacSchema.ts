/**
 * Prebaked RBAC schema.
 *
 * Scaffolded verbatim into every template that uses RBAC, the same way
 * migrate.ts and status.ts are. drizzle-kit resolves schema files by physical
 * path, so this cannot live only in base; the template copy is the one
 * drizzle.config.ts points at. scaffold-sync.test.ts keeps the copies identical.
 *
 * Kept separate from schema.ts so an agent editing the app's own tables can
 * never collide with these.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const appRoles = pgTable("app_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appMembers = pgTable(
  "app_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aisUserId: text("ais_user_id").unique(),
    email: text("email").notNull(),
    roleId: uuid("role_id").references(() => appRoles.id, {
      onDelete: "set null",
    }),
    pendingRoleId: uuid("pending_role_id").references(() => appRoles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    /**
     * One unclaimed row per address, so two managers pre-assigning the same
     * person at once cannot both insert and leave a duplicate that the
     * sign-in lookup picks between arbitrarily. Partial on purpose: once a row
     * is claimed, `ais_user_id` is the identity and the same address may
     * legitimately appear again.
     */
    uniqueIndex("app_members_pending_email_key")
      .on(table.email)
      .where(sql`${table.aisUserId} is null`),
  ],
);

export const appRoleAudit = pgTable("app_role_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  before: text("before"),
  after: text("after"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AppRole = typeof appRoles.$inferSelect;
export type AppMember = typeof appMembers.$inferSelect;
export type AppRoleAuditEntry = typeof appRoleAudit.$inferSelect;

export const rbacSchema = { appRoles, appMembers, appRoleAudit };
