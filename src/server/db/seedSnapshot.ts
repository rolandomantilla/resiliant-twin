// Loads the bundled demo warehouse snapshot into the database. Used by the
// `bun run db:seed` script and the in-app "Reset demo data" button. Clears the
// snapshot plus run-time demo state (event log, live telemetry, outbox,
// assistant chat) so the demo starts from a clean, known state.
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { SNAPSHOT } from "./seed-data/fixtures";

// biome-ignore lint/suspicious/noExplicitAny: accepts both app (getDb) and script drizzle instances
type AnyDb = NeonHttpDatabase<any>;

export async function seedSnapshot(db: AnyDb) {
  await db.delete(schema.outreachNotices);
  await db.delete(schema.scenarioMessages);
  await db.delete(schema.iotEvents);
  await db.delete(schema.disruptionEvents);
  await db.delete(schema.truckLiveState);
  await db.delete(schema.corridorLiveState);
  await db.delete(schema.shipments);
  await db.delete(schema.warehouseSlots);
  await db.delete(schema.drivers);
  await db.delete(schema.trucks);
  await db.delete(schema.roadSegments);
  await db.delete(schema.roadNodes);
  await db.delete(schema.customerContacts);
  await db.delete(schema.facilities);

  const s = SNAPSHOT as unknown as {
    [K in keyof typeof SNAPSHOT]: Record<string, unknown>[];
  };
  await db.insert(schema.facilities).values(s.facilities as never);
  await db.insert(schema.customerContacts).values(s.customerContacts as never);
  await db.insert(schema.trucks).values(s.trucks as never);
  await db.insert(schema.drivers).values(s.drivers as never);
  await db.insert(schema.warehouseSlots).values(s.warehouseSlots as never);
  await db.insert(schema.shipments).values(s.shipments as never);
  await db.insert(schema.roadNodes).values(s.roadNodes as never);
  await db.insert(schema.roadSegments).values(s.roadSegments as never);

  return {
    facilities: s.facilities.length,
    trucks: s.trucks.length,
    drivers: s.drivers.length,
    shipments: s.shipments.length,
    slots: s.warehouseSlots.length,
    roadSegments: s.roadSegments.length,
    customers: s.customerContacts.length,
  };
}
