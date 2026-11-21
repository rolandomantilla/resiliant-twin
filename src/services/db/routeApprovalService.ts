import { createServerFn } from "@tanstack/react-start";

export interface RouteDecisionInput {
  shipmentId: string;
  routeKey: string;
  summary: string;
}

export const listRouteApprovals = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    return db.select().from(schema.routeApprovals);
  },
);

export const listRouteApprovalLog = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { desc } = await import("drizzle-orm");
    const db = await getDb();
    return db
      .select()
      .from(schema.routeApprovalLog)
      .orderBy(desc(schema.routeApprovalLog.decidedAt))
      .limit(200);
  },
);

export const decideRoutes = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      decision: "approved" | "rejected";
      decidedBy: string;
      scenarioLabel: string;
      items: RouteDecisionInput[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (data.items.length === 0) return { saved: 0 };
    const decidedAt = new Date();
    const decidedBy = data.decidedBy.trim() || "Unknown user";
    const rows = data.items.map((i) => ({
      shipmentId: i.shipmentId,
      routeKey: i.routeKey,
      summary: i.summary,
      decision: data.decision,
      decidedBy,
      scenarioLabel: data.scenarioLabel,
      decidedAt,
    }));
    await db
      .insert(schema.routeApprovals)
      .values(rows)
      .onConflictDoUpdate({
        target: schema.routeApprovals.shipmentId,
        set: {
          routeKey: sql`excluded.route_key`,
          decision: sql`excluded.decision`,
          decidedBy: sql`excluded.decided_by`,
          scenarioLabel: sql`excluded.scenario_label`,
          summary: sql`excluded.summary`,
          decidedAt: sql`excluded.decided_at`,
        },
      });
    await db.insert(schema.routeApprovalLog).values(
      rows.map(({ routeKey: _k, ...r }) => ({
        ...r,
        id: crypto.randomUUID(),
      })),
    );
    return { saved: rows.length };
  });
