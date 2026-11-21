import { createServerFn } from "@tanstack/react-start";

export const listShipmentsMaster = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    const rows = await db
      .select({
        id: schema.shipments.id,
        originId: schema.shipments.originId,
        destinationId: schema.shipments.destinationId,
        containerId: schema.shipments.containerId,
        cargoType: schema.shipments.cargoType,
        containerTeu: schema.shipments.containerTeu,
        priority: schema.shipments.priority,
        pickupStatus: schema.shipments.pickupStatus,
        appointmentStartMin: schema.shipments.appointmentStartMin,
        appointmentEndMin: schema.shipments.appointmentEndMin,
        estimatedValueUsd: schema.shipments.estimatedValueUsd,
        weightTons: schema.shipments.weightTons,
        customerId: schema.shipments.customerId,
        customerName: schema.customerContacts.displayName,
        phone: schema.customerContacts.phone,
        email: schema.customerContacts.email,
        contacted: schema.shipments.contacted,
        contactedAt: schema.shipments.contactedAt,
      })
      .from(schema.shipments)
      .innerJoin(
        schema.customerContacts,
        eq(schema.shipments.customerId, schema.customerContacts.customerId),
      )
      .orderBy(schema.shipments.id);
    return rows;
  },
);

export const sendOutreachNotice = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      stopId: string;
      shipmentIds: string[];
      impactSummary: string;
      etaSummary: Record<
        string,
        { revisedEtaMin: number | null; status: string }
      >;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { eq, and, inArray } = await import("drizzle-orm");
    const db = await getDb();

    const sortedIds = [...data.shipmentIds].sort();
    const impactKey = JSON.stringify({
      stopId: data.stopId,
      shipmentIds: sortedIds,
      impactSummary: data.impactSummary,
      etaSummary: data.etaSummary,
    });

    const existing = await db
      .select({ id: schema.outreachNotices.id })
      .from(schema.outreachNotices)
      .where(
        and(
          eq(schema.outreachNotices.stopId, data.stopId),
          eq(schema.outreachNotices.impactKey, impactKey),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return { status: "duplicate" as const, noticeId: existing[0].id };
    }

    const noticeId = crypto.randomUUID();
    await db.insert(schema.outreachNotices).values({
      id: noticeId,
      stopId: data.stopId,
      shipmentIds: JSON.stringify(sortedIds),
      impactKey,
      etaSummary: JSON.stringify(data.etaSummary),
    });
    if (sortedIds.length > 0) {
      await db
        .update(schema.shipments)
        .set({
          contacted: true,
          contactedAt: new Date(),
          lastNoticeId: noticeId,
        })
        .where(inArray(schema.shipments.id, sortedIds));
    }
    return { status: "sent" as const, noticeId };
  });

export const listOutreachNotices = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { desc } = await import("drizzle-orm");
    const db = await getDb();
    return db
      .select()
      .from(schema.outreachNotices)
      .orderBy(desc(schema.outreachNotices.createdAt));
  },
);
