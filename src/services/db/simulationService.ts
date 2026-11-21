import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { coerceScenarioSettings } from "@/lib/resilienceTwin/scenarioParser";
import type { SimulationFixtures } from "@/lib/resilienceTwin/types";

const loadFixtures = createServerOnlyFn(
  async (): Promise<SimulationFixtures> => {
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    const [
      facilities,
      trucks,
      drivers,
      shipments,
      slots,
      roadNodes,
      roadSegments,
    ] = await Promise.all([
      db.select().from(schema.facilities),
      db.select().from(schema.trucks),
      db.select().from(schema.drivers),
      db.select().from(schema.shipments),
      db.select().from(schema.warehouseSlots),
      db.select().from(schema.roadNodes),
      db.select().from(schema.roadSegments),
    ]);
    return {
      facilities,
      trucks,
      drivers,
      shipments,
      slots,
      roadNodes,
      roadSegments,
    };
  },
);

export const listFacilities = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    return db.select().from(schema.facilities);
  },
);

export const listFleet = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAppAccess } = await import("@/server/protectedServerFn");
  await requireAppAccess("read");
  const { getDb } = await import("@/lib/db");
  const schema = await import("@/server/db/schema");
  const db = await getDb();
  const [trucks, drivers] = await Promise.all([
    db.select().from(schema.trucks),
    db.select().from(schema.drivers),
  ]);
  return trucks.map((t) => {
    const d = drivers.find((x) => x.truckId === t.id);
    return {
      id: t.id,
      capacityTeu: t.capacityTeu,
      status: t.status,
      availableFromMin: t.availableFromMin,
      basePortId: t.basePortId,
      driver: d ? { id: d.id, shiftEndMin: d.shiftEndMin } : null,
    };
  });
});

export const listRoadSegments = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const schema = await import("@/server/db/schema");
    const db = await getDb();
    return db.select().from(schema.roadSegments);
  },
);

export const runScenario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { runScenarioComparison } = await import(
      "@/lib/resilienceTwin/engine"
    );
    const { enrichRouteGeometry } = await import(
      "@/lib/resilienceTwin/streetRouting"
    );
    const settings = coerceScenarioSettings(data);
    const fixtures = await loadFixtures();
    if (fixtures.shipments.length === 0) {
      throw new Error(
        "No warehouse snapshot loaded yet. Seed the demo data first.",
      );
    }
    const comparison = runScenarioComparison(fixtures, settings);
    // Only the displayed ("revised") plan needs real street geometry — the
    // baseline is used for its metrics only, never drawn on the map.
    const revised = await enrichRouteGeometry(comparison.revised);
    return { baseline: comparison.baseline, revised };
  });
