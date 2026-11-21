import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

interface IngestOutcome {
  eventId: string;
  status: "accepted" | "rejected" | "superseded";
  reason?: string;
}

/** Raw IoT telemetry ingestion with validation, dedupe, and out-of-order handling. */
const ingestIotEvent = createServerOnlyFn(
  async (
    db: any,
    schema: any,
    truckIds: Set<string>,
    raw: Record<string, unknown>,
  ): Promise<IngestOutcome> => {
    const { eq, and } = await import("drizzle-orm");
    const eventId = String(raw.eventId ?? "");
    const truckId = String(raw.truckId ?? "");
    const eventType = String(raw.eventType ?? "");
    const occurredAt = new Date(String(raw.occurredAt ?? ""));

    if (!eventId)
      return {
        eventId: eventId || "(missing)",
        status: "rejected",
        reason: "Missing event id",
      };
    if (!truckIds.has(truckId)) {
      return {
        eventId,
        status: "rejected",
        reason: `Unknown truck id: ${truckId}`,
      };
    }
    if (!["location", "pickup_status", "queue_time"].includes(eventType)) {
      return {
        eventId,
        status: "rejected",
        reason: `Unknown event type: ${eventType}`,
      };
    }
    if (Number.isNaN(occurredAt.getTime())) {
      return {
        eventId,
        status: "rejected",
        reason: "Invalid or unparseable timestamp",
      };
    }
    if (eventType === "queue_time" && Number(raw.queueMin) < 0) {
      return {
        eventId,
        status: "rejected",
        reason: "Negative queue time is not valid",
      };
    }

    const duplicate = await db
      .select({ id: schema.iotEvents.id })
      .from(schema.iotEvents)
      .where(
        and(
          eq(schema.iotEvents.eventId, eventId),
          eq(schema.iotEvents.status, "accepted"),
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      await db.insert(schema.iotEvents).values({
        id: crypto.randomUUID(),
        eventId,
        truckId,
        eventType,
        payload: JSON.stringify(raw),
        occurredAt,
        status: "rejected",
        reason: "Duplicate of an already-accepted event id",
      });
      return {
        eventId,
        status: "rejected",
        reason: "Duplicate of an already-accepted event id",
      };
    }

    const current = await db
      .select()
      .from(schema.truckLiveState)
      .where(eq(schema.truckLiveState.truckId, truckId))
      .limit(1);
    if (current[0] && current[0].occurredAt.getTime() > occurredAt.getTime()) {
      await db.insert(schema.iotEvents).values({
        id: crypto.randomUUID(),
        eventId,
        truckId,
        eventType,
        payload: JSON.stringify(raw),
        occurredAt,
        status: "superseded",
        reason: "Older than the newest accepted reading for this truck",
      });
      return {
        eventId,
        status: "superseded",
        reason: "Older than the newest accepted reading for this truck",
      };
    }

    await db.insert(schema.iotEvents).values({
      id: crypto.randomUUID(),
      eventId,
      truckId,
      eventType,
      payload: JSON.stringify(raw),
      occurredAt,
      status: "accepted",
    });

    const patch: Record<string, unknown> = {
      truckId,
      lastEventId: eventId,
      occurredAt,
      updatedAt: new Date(),
    };
    if (eventType === "location") {
      patch.lat = Number(raw.lat);
      patch.lon = Number(raw.lon);
    }
    if (eventType === "pickup_status")
      patch.pickupStatus = String(raw.pickupStatus ?? "");
    if (eventType === "queue_time") patch.queueMin = Number(raw.queueMin);

    if (current[0]) {
      await db
        .update(schema.truckLiveState)
        .set(patch)
        .where(eq(schema.truckLiveState.truckId, truckId));
    } else {
      await db.insert(schema.truckLiveState).values({
        truckId,
        lat: eventType === "location" ? Number(raw.lat) : null,
        lon: eventType === "location" ? Number(raw.lon) : null,
        pickupStatus:
          eventType === "pickup_status" ? String(raw.pickupStatus ?? "") : null,
        queueMin: eventType === "queue_time" ? Number(raw.queueMin) : null,
        lastEventId: eventId,
        occurredAt,
      });
    }
    return { eventId, status: "accepted" };
  },
);

/** Disruption (closure/slowdown/reopen) ingestion with the same validation rules. */
const ingestDisruptionEvent = createServerOnlyFn(
  async (
    db: any,
    schema: any,
    segmentIds: Set<string>,
    raw: Record<string, unknown>,
  ): Promise<IngestOutcome> => {
    const { eq, and } = await import("drizzle-orm");
    const eventId = String(raw.eventId ?? "");
    const corridorId = String(raw.corridorId ?? "");
    const eventType = String(raw.eventType ?? "");
    const occurredAt = new Date(String(raw.occurredAt ?? ""));
    const delayMin = raw.delayMin === undefined ? 0 : Number(raw.delayMin);

    if (!eventId)
      return {
        eventId: eventId || "(missing)",
        status: "rejected",
        reason: "Missing event id",
      };
    if (!segmentIds.has(corridorId)) {
      return {
        eventId,
        status: "rejected",
        reason: `Unknown corridor id: ${corridorId}`,
      };
    }
    if (!["closure", "slowdown", "reopen"].includes(eventType)) {
      return {
        eventId,
        status: "rejected",
        reason: `Unknown event type: ${eventType}`,
      };
    }
    if (Number.isNaN(occurredAt.getTime())) {
      return {
        eventId,
        status: "rejected",
        reason: "Invalid or unparseable timestamp",
      };
    }
    if (delayMin < 0) {
      return {
        eventId,
        status: "rejected",
        reason: "Negative delay is not valid",
      };
    }

    const duplicate = await db
      .select({ id: schema.disruptionEvents.id })
      .from(schema.disruptionEvents)
      .where(
        and(
          eq(schema.disruptionEvents.eventId, eventId),
          eq(schema.disruptionEvents.status, "accepted"),
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      await db.insert(schema.disruptionEvents).values({
        id: crypto.randomUUID(),
        eventId,
        corridorId,
        eventType,
        payload: JSON.stringify(raw),
        occurredAt,
        status: "rejected",
        reason: "Duplicate of an already-accepted event id",
      });
      return {
        eventId,
        status: "rejected",
        reason: "Duplicate of an already-accepted event id",
      };
    }

    const current = await db
      .select()
      .from(schema.corridorLiveState)
      .where(eq(schema.corridorLiveState.corridorId, corridorId))
      .limit(1);
    if (current[0] && current[0].occurredAt.getTime() > occurredAt.getTime()) {
      await db.insert(schema.disruptionEvents).values({
        id: crypto.randomUUID(),
        eventId,
        corridorId,
        eventType,
        payload: JSON.stringify(raw),
        occurredAt,
        status: "superseded",
        reason: "Older than the newest accepted reading for this corridor",
      });
      return {
        eventId,
        status: "superseded",
        reason: "Older than the newest accepted reading for this corridor",
      };
    }

    await db.insert(schema.disruptionEvents).values({
      id: crypto.randomUUID(),
      eventId,
      corridorId,
      eventType,
      payload: JSON.stringify(raw),
      occurredAt,
      status: "accepted",
    });

    const status =
      eventType === "reopen"
        ? "open"
        : eventType === "closure"
          ? "closed"
          : "slowdown";
    const nextState = {
      corridorId,
      status,
      delayMin: status === "open" ? 0 : delayMin,
      lastEventId: eventId,
      occurredAt,
      updatedAt: new Date(),
    };
    if (current[0]) {
      await db
        .update(schema.corridorLiveState)
        .set(nextState)
        .where(eq(schema.corridorLiveState.corridorId, corridorId));
    } else {
      await db.insert(schema.corridorLiveState).values(nextState);
    }
    return { eventId, status: "accepted" };
  },
);

export const replayFeed = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      kind: "iot" | "disruption";
      events: Record<string, unknown>[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();

    if (data.kind === "iot") {
      const trucks = await db
        .select({ id: schema.trucks.id })
        .from(schema.trucks);
      const truckIds = new Set(trucks.map((t) => t.id));
      const outcomes: IngestOutcome[] = [];
      for (const raw of data.events)
        outcomes.push(await ingestIotEvent(db, schema, truckIds, raw));
      return outcomes;
    }
    const segments = await db
      .select({ id: schema.roadSegments.segmentId })
      .from(schema.roadSegments);
    const segmentIds = new Set(segments.map((s) => s.id));
    const outcomes: IngestOutcome[] = [];
    for (const raw of data.events)
      outcomes.push(await ingestDisruptionEvent(db, schema, segmentIds, raw));
    return outcomes;
  });

/** Wipes and reloads the bundled demo data (snapshot + clears demo run-time state). */
export const resetDemoData = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const { seedSnapshot } = await import("@/server/db/seedSnapshot");
    const db = await getDb();
    return seedSnapshot(db as never);
  },
);

/** Replays the bundled seed NDJSON fixture (includes deliberate duplicate / out-of-order / invalid lines). */
export const replaySeedFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: "iot" | "disruption" }) => input)
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("write");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { IOT_REPLAY, DISRUPTION_REPLAY } = await import(
      "@/server/db/seed-data/fixtures"
    );
    const db = await getDb();

    const events = data.kind === "iot" ? IOT_REPLAY : DISRUPTION_REPLAY;

    if (data.kind === "iot") {
      const trucks = await db
        .select({ id: schema.trucks.id })
        .from(schema.trucks);
      const truckIds = new Set(trucks.map((t) => t.id));
      const outcomes: IngestOutcome[] = [];
      for (const raw of events)
        outcomes.push(await ingestIotEvent(db, schema, truckIds, raw));
      return outcomes;
    }
    const segments = await db
      .select({ id: schema.roadSegments.segmentId })
      .from(schema.roadSegments);
    const segmentIds = new Set(segments.map((s) => s.id));
    const outcomes: IngestOutcome[] = [];
    for (const raw of events)
      outcomes.push(await ingestDisruptionEvent(db, schema, segmentIds, raw));
    return outcomes;
  });

export const listEventLog = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const { desc } = await import("drizzle-orm");
    const db = await getDb();
    const [iot, disruption] = await Promise.all([
      db
        .select()
        .from(schema.iotEvents)
        .orderBy(desc(schema.iotEvents.receivedAt))
        .limit(100),
      db
        .select()
        .from(schema.disruptionEvents)
        .orderBy(desc(schema.disruptionEvents.receivedAt))
        .limit(100),
    ]);
    return { iot, disruption };
  },
);

export const listLiveState = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    const [trucks, corridors] = await Promise.all([
      db.select().from(schema.truckLiveState),
      db.select().from(schema.corridorLiveState),
    ]);
    return { trucks, corridors };
  },
);
