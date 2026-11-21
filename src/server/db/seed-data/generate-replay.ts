// Deterministic generator for the bundled IoT + disruption replay fixtures.
// Re-run with `bun run src/server/db/seed-data/generate-replay.ts` to regenerate
// iot_events.ndjson and disruption_events.ndjson from this fixed seed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dirname;
const BASE = new Date("2026-11-14T15:00:00.000Z").getTime();
const min = (n: number) => new Date(BASE + n * 60_000).toISOString();

const TRUCKS = Array.from(
  { length: 12 },
  (_, i) => `TRUCK-${String(i + 1).padStart(2, "0")}`,
);
// Rough waypoints truck telemetry drifts along (port -> hub corridor).
const WAYPOINTS: Record<string, [number, number]> = {
  "TRUCK-01": [-118.27, 33.78],
  "TRUCK-02": [-118.22, 33.79],
  "TRUCK-03": [-118.2, 33.95],
  "TRUCK-04": [-118.0, 34.03],
  "TRUCK-05": [-117.9, 33.9],
  "TRUCK-06": [-118.28, 33.83],
  "TRUCK-07": [-118.0, 33.97],
  "TRUCK-08": [-117.5, 34.08],
  "TRUCK-09": [-117.65, 34.06],
  "TRUCK-10": [-117.4, 33.95],
  "TRUCK-11": [-118.1, 33.86],
  "TRUCK-12": [-117.9, 34.01],
};

type IotLine = Record<string, unknown>;
const iot: IotLine[] = [];
let seq = 1;
const nextId = () => `IOT-${String(seq++).padStart(5, "0")}`;

for (const [i, truckId] of TRUCKS.entries()) {
  const [lon, lat] = WAYPOINTS[truckId];
  const t0 = min(i * 2);
  const t1 = min(i * 2 + 6);
  const t2 = min(i * 2 + 12);
  iot.push({
    eventId: nextId(),
    truckId,
    eventType: "location",
    occurredAt: t0,
    lat: +(lat - 0.04).toFixed(4),
    lon: +(lon - 0.04).toFixed(4),
  });
  iot.push({
    eventId: nextId(),
    truckId,
    eventType: "pickup_status",
    occurredAt: t0,
    pickupStatus: i % 3 === 0 ? "ready" : "pending",
  });
  iot.push({
    eventId: nextId(),
    truckId,
    eventType: "location",
    occurredAt: t1,
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
  });
  iot.push({
    eventId: nextId(),
    truckId,
    eventType: "queue_time",
    occurredAt: t1,
    queueMin: 5 + (i % 4) * 3,
  });
  iot.push({
    eventId: nextId(),
    truckId,
    eventType: "location",
    occurredAt: t2,
    lat: +(lat + 0.04).toFixed(4),
    lon: +(lon + 0.04).toFixed(4),
  });
}

// --- Deliberate validation edge cases, appended out of chronological order ---
// 1) Duplicate of an already-accepted event id (must be rejected as a duplicate).
iot.push({ ...iot[2], note: `duplicate-replay-of-${iot[2].eventId}` });
// 2) Stale/out-of-order update for TRUCK-01 dated before its latest accepted reading.
iot.push({
  eventId: nextId(),
  truckId: "TRUCK-01",
  eventType: "location",
  occurredAt: min(-30),
  lat: 33.6,
  lon: -118.4,
});
// 3) Unknown truck id.
iot.push({
  eventId: nextId(),
  truckId: "TRUCK-99",
  eventType: "location",
  occurredAt: min(20),
  lat: 34.0,
  lon: -117.9,
});
// 4) Invalid timestamp.
iot.push({
  eventId: nextId(),
  truckId: "TRUCK-02",
  eventType: "location",
  occurredAt: "not-a-timestamp",
  lat: 33.9,
  lon: -118.1,
});
// 5) Negative delay / queue time.
iot.push({
  eventId: nextId(),
  truckId: "TRUCK-03",
  eventType: "queue_time",
  occurredAt: min(22),
  queueMin: -15,
});

writeFileSync(
  join(DIR, "iot_events.ndjson"),
  `${iot.map((e) => JSON.stringify(e)).join("\n")}\n`,
);

type DisruptionLine = Record<string, unknown>;
const disruption: DisruptionLine[] = [];
let dseq = 1;
const nextDid = () => `DIS-EVT-${String(dseq++).padStart(4, "0")}`;

const timeline: Array<[string, string, number | undefined, number]> = [
  ["S-005", "slowdown", 35, 0],
  ["S-004", "slowdown", 20, 2],
  ["S-003", "slowdown", 15, 4],
  ["S-004", "closure", undefined, 10],
  ["S-004", "reopen", undefined, 70],
  ["S-005", "reopen", undefined, 90],
];
for (const [corridorId, eventType, delayMin, offsetMin] of timeline) {
  disruption.push({
    eventId: nextDid(),
    corridorId,
    eventType,
    occurredAt: min(offsetMin),
    ...(delayMin !== undefined ? { delayMin } : {}),
  });
}
// Duplicate replay of an already-accepted disruption event.
disruption.push({
  ...disruption[0],
  note: `duplicate-replay-of-${disruption[0].eventId}`,
});
// Stale/out-of-order slowdown for a corridor that has already reopened.
disruption.push({
  eventId: nextDid(),
  corridorId: "S-004",
  eventType: "slowdown",
  occurredAt: min(5),
  delayMin: 40,
});
// Unknown corridor id.
disruption.push({
  eventId: nextDid(),
  corridorId: "S-999",
  eventType: "slowdown",
  occurredAt: min(12),
  delayMin: 10,
});
// Invalid (negative) delay minutes.
disruption.push({
  eventId: nextDid(),
  corridorId: "S-003",
  eventType: "slowdown",
  occurredAt: min(14),
  delayMin: -20,
});

writeFileSync(
  join(DIR, "disruption_events.ndjson"),
  `${disruption.map((e) => JSON.stringify(e)).join("\n")}\n`,
);

console.log(
  `Wrote ${iot.length} IoT events and ${disruption.length} disruption events.`,
);
