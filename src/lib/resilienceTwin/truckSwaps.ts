// Layers dispatcher-applied truck swaps on top of a computed plan. Runs after
// every recalculation so swaps survive scenario changes until undone.
import { estimateDriveMin, type FleetTruck } from "./assistantReplies";
import {
  COST_PARAMETERS,
  EMISSION_PARAMETERS,
  TURNAROUND_MIN,
} from "./constants";
import type {
  FacilityRow,
  ScenarioMetrics,
  ScenarioResult,
  ShipmentPlan,
} from "./types";

export interface TruckSwap {
  shipmentId: string;
  fromTruckId: string | null;
  truckId: string;
  pickupId: string | null;
  reason: string;
}

export interface SwapOverlayResult {
  result: ScenarioResult;
  applied: string[];
  skipped: { shipmentId: string; reason: string }[];
}

const AVG_MPH = 35;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMetrics(
  shipments: ShipmentPlan[],
  base: ScenarioMetrics,
): ScenarioMetrics {
  const selected = shipments.filter((r) => r.status === "scheduled");
  const trips = new Map<string, number>();
  for (const r of selected)
    if (r.truckId) trips.set(r.truckId, (trips.get(r.truckId) ?? 0) + 1);
  const sum = (f: (r: ShipmentPlan) => number | null) =>
    round2(selected.reduce((s, r) => s + (f(r) ?? 0), 0));
  return {
    ...base,
    scheduled: selected.length,
    unassigned: shipments.length - selected.length,
    criticalScheduled: selected.filter((r) => r.priority === "critical")
      .length,
    trucksUsed: trips.size,
    trucksWithMultipleTrips: [...trips.values()].filter((c) => c > 1).length,
    scheduledCostUsd: sum((r) => r.costUsd),
    scheduledCo2Kg: sum((r) => r.co2Kg),
    scheduledLoadedMiles: sum((r) => r.loadedMiles),
    scheduledEmptyMiles: sum((r) => r.emptyMiles),
  };
}

export function overlaySwaps(
  result: ScenarioResult,
  swaps: TruckSwap[],
  fleet: FleetTruck[],
  facilities: FacilityRow[],
): SwapOverlayResult {
  if (swaps.length === 0) return { result, applied: [], skipped: [] };
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const truckById = new Map(fleet.map((t) => [t.id, t]));
  const swapIds = new Set(swaps.map((s) => s.shipmentId));
  const fuelDelta =
    result.settings.dieselPrice - COST_PARAMETERS.referenceDieselPrice;

  // When and where each truck is free, from the work it keeps.
  const freeAt = new Map<string, { min: number; at: string | null }>();
  const tripCount = new Map<string, number>();
  for (const t of fleet)
    freeAt.set(t.id, { min: t.availableFromMin, at: t.basePortId });
  for (const s of result.shipments) {
    if (s.status !== "scheduled" || !s.truckId || swapIds.has(s.shipmentId))
      continue;
    tripCount.set(s.truckId, (tripCount.get(s.truckId) ?? 0) + 1);
    const cur = freeAt.get(s.truckId);
    if (cur && (s.completeMin ?? 0) > cur.min)
      freeAt.set(s.truckId, { min: s.completeMin ?? 0, at: s.destinationId });
  }

  const planById = new Map(result.shipments.map((s) => [s.shipmentId, s]));
  const replaced = new Map<string, ShipmentPlan>();
  const applied: string[] = [];
  const skipped: SwapOverlayResult["skipped"] = [];

  for (const swap of swaps) {
    const plan = planById.get(swap.shipmentId);
    const truck = truckById.get(swap.truckId);
    const pickup = byId.get(swap.pickupId ?? plan?.originId ?? "");
    const dest = plan ? byId.get(plan.destinationId) : undefined;
    if (!plan || plan.status !== "scheduled") {
      skipped.push({
        shipmentId: swap.shipmentId,
        reason: "not scheduled in this plan",
      });
      continue;
    }
    if (!truck || truck.status !== "available" || !pickup || !dest) {
      skipped.push({
        shipmentId: swap.shipmentId,
        reason: `${swap.truckId} is not available`,
      });
      continue;
    }
    if (plan.truckId === swap.truckId) {
      applied.push(swap.shipmentId);
      continue;
    }

    const free = freeAt.get(truck.id)!;
    const from = free.at ? byId.get(free.at) : undefined;
    const emptyMinutes = from ? Math.round(estimateDriveMin(from, pickup)) : 0;
    const emptyMiles = round2((emptyMinutes / 60) * AVG_MPH);
    const samePickup = pickup.id === plan.originId;
    const loadedMinutes =
      samePickup && plan.loadedMinutes !== null
        ? plan.loadedMinutes
        : Math.round(estimateDriveMin(pickup, dest));
    const loadedMiles =
      samePickup && plan.loadedMiles !== null
        ? plan.loadedMiles
        : round2((loadedMinutes / 60) * AVG_MPH);
    const departure = free.min + emptyMinutes;
    const arrival = departure + loadedMinutes;
    const receive = Math.max(arrival, plan.appointmentStartMin);
    const complete = receive + TURNAROUND_MIN;
    if (truck.driver && complete > truck.driver.shiftEndMin) {
      skipped.push({
        shipmentId: swap.shipmentId,
        reason: `${truck.id}'s driver would run past the end of their shift`,
      });
      continue;
    }

    const miles = emptyMiles + loadedMiles;
    const drive = emptyMinutes + loadedMinutes;
    const costUsd = round2(
      miles * COST_PARAMETERS.perMile +
        ((drive + TURNAROUND_MIN) / 60) * COST_PARAMETERS.perDriverHour +
        (miles / (truck.mpgAssumed ?? 6)) * fuelDelta,
    );
    const co2Kg = round2(miles * EMISSION_PARAMETERS.perMile);
    const trip = (tripCount.get(truck.id) ?? 0) + 1;
    tripCount.set(truck.id, trip);
    freeAt.set(truck.id, { min: complete, at: dest.id });

    const line = (a: FacilityRow, b: FacilityRow): [number, number][] => [
      [a.lon, a.lat],
      [b.lon, b.lat],
    ];
    replaced.set(plan.shipmentId, {
      ...plan,
      originId: pickup.id,
      truckId: truck.id,
      driverId: truck.driver?.id ?? null,
      tripNumber: trip,
      departureMin: departure,
      arrivalMin: arrival,
      receivingMin: receive,
      completeMin: complete,
      emptyMiles,
      emptyMinutes,
      loadedMiles,
      loadedMinutes,
      totalMiles: round2(miles),
      costUsd,
      co2Kg,
      emptyRouteCoords: from && from.id !== pickup.id ? line(from, pickup) : [],
      emptyRouteSegments: [],
      routeCoords:
        samePickup && plan.routeCoords.length > 1
          ? plan.routeCoords
          : line(pickup, dest),
      routeSegments: samePickup ? plan.routeSegments : [],
      rerouted: false,
      routeNote: `Reassigned from ${plan.truckId} to ${truck.id} (${swap.reason}). Empty leg${samePickup ? "" : " and new-port route"} estimated from straight-line distance.`,
      notes: [...plan.notes, `Truck swap: ${plan.truckId} → ${truck.id}.`],
      swappedFromTruckId: plan.truckId,
    });
    applied.push(swap.shipmentId);
  }

  const shipments = result.shipments.map(
    (s) => replaced.get(s.shipmentId) ?? s,
  );
  return {
    result: {
      ...result,
      shipments,
      metrics: computeMetrics(shipments, result.metrics),
    },
    applied,
    skipped,
  };
}
