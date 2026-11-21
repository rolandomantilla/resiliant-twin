import { createServerFn } from "@tanstack/react-start";

export const listTruckSwaps = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    return db
      .select()
      .from(schema.truckSwaps)
      .orderBy(schema.truckSwaps.createdAt);
  },
);

export const saveTruckSwaps = createServerFn({ method: "POST" })
  .inputValidator(
    (
      input: {
        shipmentId: string;
        fromTruckId: string | null;
        truckId: string;
        pickupId: string | null;
        reason: string;
      }[],
    ) => input,
  )
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (data.length === 0) return { saved: 0 };
    await db
      .insert(schema.truckSwaps)
      .values(data.map((d) => ({ ...d, createdAt: new Date() })))
      .onConflictDoUpdate({
        target: schema.truckSwaps.shipmentId,
        set: {
          truckId: sql`excluded.truck_id`,
          pickupId: sql`excluded.pickup_id`,
          reason: sql`excluded.reason`,
          createdAt: sql`excluded.created_at`,
        },
      });
    return { saved: data.length };
  });

export const undoTruckSwaps = createServerFn({ method: "POST" })
  .inputValidator((input: { shipmentIds: string[] | "all" }) => input)
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { inArray } = await import("drizzle-orm");
    const db = await getDb();
    if (data.shipmentIds === "all") await db.delete(schema.truckSwaps);
    else if (data.shipmentIds.length > 0)
      await db
        .delete(schema.truckSwaps)
        .where(inArray(schema.truckSwaps.shipmentId, data.shipmentIds));
    return { status: "undone" as const };
  });
