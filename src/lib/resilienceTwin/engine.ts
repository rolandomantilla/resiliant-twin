// TypeScript port of the ResilienceTwin GeoAI v0.6 reference optimizer:
// a deterministic, multi-start constructive heuristic for multi-trip truck
// dispatch over the bundled synthetic road graph. Not a MILP solver and not
// provably optimal — matches the reference's own stated limits.
import {
  COST_PARAMETERS,
  EMISSION_PARAMETERS,
  MAX_TRIPS_PER_TRUCK,
  PRIORITY_WEIGHTS,
  ROUTE_SOURCE_LABEL,
  scenarioByName,
  SOLVER_ATTEMPTS,
  TURNAROUND_MIN,
} from "./constants";
import { SyntheticRoadNetwork } from "./network";
import type {
  PathResult,
  ScenarioMetrics,
  ScenarioResult,
  ScenarioSettings,
  ShipmentPlan,
  ShipmentRow,
  SimulationFixtures,
  WarehouseSlotRow,
} from "./types";

interface TruckState {
  location: string;
  available: number;
  trips: number;
  dutyUsed: number;
  driveUsed: number;
}

interface EvalOption {
  score: number[];
  record: ShipmentPlan;
  drive: number;
  duty: number;
}

function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function emptyMetrics(total: number): ScenarioMetrics {
  return {
    shipments: total,
    scheduled: 0,
    unassigned: total,
    criticalScheduled: 0,
    trucksUsed: 0,
    trucksWithMultipleTrips: 0,
    scheduledCostUsd: 0,
    scheduledCo2Kg: 0,
    scheduledLoadedMiles: 0,
    scheduledEmptyMiles: 0,
  };
}

export function optimizeScenario(
  fixtures: SimulationFixtures,
  settings: ScenarioSettings,
): ScenarioResult {
  const cfg = scenarioByName(settings.scenario);
  const delay = settings.severity;
  const network = new SyntheticRoadNetwork(
    fixtures.roadNodes,
    fixtures.roadSegments,
  );

  const trucks = new Map(fixtures.trucks.map((t) => [t.id, t]));
  const driverByTruck = new Map(fixtures.drivers.map((d) => [d.truckId, d]));
  const slots = new Map(fixtures.slots.map((s) => [s.slotId, s]));
  const facilityIds = fixtures.facilities.map((f) => f.id);
  const truckIndex = new Map(fixtures.trucks.map((t, i) => [t.id, i]));

  const segmentId = settings.closureSegment ?? cfg.affectedSegmentId;
  const blocked = new Set<string>(
    cfg.kind === "road_closure" && segmentId ? [segmentId] : [],
  );
  const slowdownSegment =
    cfg.kind === "traffic" || cfg.kind === "wildfire" || cfg.kind === "flood"
      ? segmentId
      : null;
  const closureIsProxy = Boolean(segmentId);

  // Precompute every facility-pair path for this scenario, and the matching
  // "normal conditions" path (no closures/slowdowns) for reroute comparison.
  const paths = new Map<string, PathResult | null>();
  const normalPaths = new Map<string, PathResult | null>();
  for (const a of facilityIds) {
    for (const b of facilityIds) {
      paths.set(
        `${a}|${b}`,
        network.path(a, b, blocked, slowdownSegment, delay),
      );
      normalPaths.set(`${a}|${b}`, network.path(a, b, new Set(), null, 0));
    }
  }

  const fuelDelta = settings.dieselPrice - COST_PARAMETERS.referenceDieselPrice;

  function evaluate(
    shipment: ShipmentRow,
    state: Map<string, TruckState>,
    occupancy: Map<string, number>,
    recoverySlot?: WarehouseSlotRow,
  ): { options: EvalOption[]; reason: string } {
    const slot = recoverySlot ?? slots.get(shipment.appointmentSlotId)!;
    if ((occupancy.get(slot.slotId) ?? 0) >= slot.capacity) {
      return {
        options: [],
        reason: "No modeled receiving capacity in original appointment slot",
      };
    }
    const options: EvalOption[] = [];
    for (const [tid, truck] of trucks) {
      const driver = driverByTruck.get(tid);
      const s = state.get(tid);
      if (!driver || !s) continue;
      if (
        s.trips >= MAX_TRIPS_PER_TRUCK ||
        truck.status !== "available" ||
        truck.maintenanceState !== "serviceable" ||
        truck.capacityTeu < shipment.containerTeu
      ) {
        continue;
      }
      const empty = paths.get(`${s.location}|${shipment.originId}`);
      const loaded = paths.get(
        `${shipment.originId}|${shipment.destinationId}`,
      );
      if (!empty || !loaded) continue;

      const start = Math.max(s.available, driver.shiftStartMin);
      const pickupDelay =
        cfg.kind === "port" && shipment.pickupStatus === "pending" ? delay : 0;
      const departure = Math.max(
        start + empty.minutes,
        shipment.pickupReadyMin + pickupDelay,
      );
      const arrival = departure + loaded.minutes;
      const receive = Math.max(
        arrival,
        slot.windowStartMin,
        shipment.appointmentStartMin,
      );
      const finished = receive + TURNAROUND_MIN;
      const drive = empty.minutes + loaded.minutes;
      const usedDuty = finished - start;
      const windowEnd = recoverySlot
        ? slot.windowEndMin
        : Math.min(slot.windowEndMin, shipment.appointmentEndMin);
      if (receive > windowEnd) continue;
      if (finished > driver.shiftEndMin) continue;
      const budget = Math.floor(driver.hoursRemaining * 60);
      if (s.dutyUsed + usedDuty > budget) continue;
      if (s.driveUsed + drive > budget) continue;

      const miles = empty.miles + loaded.miles;
      const idle = empty.delayedMinutes + loaded.delayedMinutes;
      const fuelAdjustment = (miles / truck.mpgAssumed) * fuelDelta;
      const dollars = round2(
        miles * COST_PARAMETERS.perMile +
          ((drive + TURNAROUND_MIN) / 60) * COST_PARAMETERS.perDriverHour +
          fuelAdjustment,
      );
      const co2 = round2(
        miles * EMISSION_PARAMETERS.perMile +
          idle * EMISSION_PARAMETERS.perIdleMinute,
      );
      const community = round2(miles * 3.0);
      const idx = truckIndex.get(tid) ?? 0;
      let score: number[];
      if (settings.policy === "Lowest cost")
        score = [dollars, receive, co2, idx];
      else if (settings.policy === "Lowest CO2")
        score = [co2, receive, dollars, idx];
      else if (settings.policy === "Reliability first")
        score = [receive, dollars, co2, idx];
      else
        score = [
          0.5 * (dollars / 300) + 0.35 * (co2 / 150) + 0.15 * (community / 150),
          receive,
          dollars,
          idx,
        ];

      const normal = normalPaths.get(
        `${shipment.originId}|${shipment.destinationId}`,
      );
      const rerouted = Boolean(
        normal &&
          loaded.segments.length > 0 &&
          normal.segments.join(">") !== loaded.segments.join(">"),
      );
      const routeNote = rerouted
        ? `Rerouted around ${segmentId ?? "the affected corridor"} (+${Math.max(0, loaded.minutes - (normal?.minutes ?? loaded.minutes))} min vs. the normal path).`
        : "Kept the normal shortest path — no modeled closure or slowdown applies to this corridor.";

      const record: ShipmentPlan = {
        shipmentId: shipment.id,
        priority: shipment.priority,
        status: "scheduled",
        originId: shipment.originId,
        destinationId: shipment.destinationId,
        truckId: tid,
        driverId: driver.id,
        tripNumber: s.trips + 1,
        departureMin: departure,
        arrivalMin: arrival,
        receivingMin: receive,
        completeMin: finished,
        appointmentStartMin: shipment.appointmentStartMin,
        appointmentEndMin: shipment.appointmentEndMin,
        slotId: slot.slotId,
        emptyMiles: empty.miles,
        emptyMinutes: empty.minutes,
        loadedMiles: loaded.miles,
        loadedMinutes: loaded.minutes,
        totalMiles: round2(miles),
        costUsd: dollars,
        co2Kg: co2,
        routeSegments: loaded.segments,
        emptyRouteSegments: empty.segments,
        routeCoords: loaded.coords,
        emptyRouteCoords: empty.coords,
        normalRouteCoords: normal?.coords ?? loaded.coords,
        normalMinutes: normal?.minutes ?? null,
        rerouted,
        routeNote,
        notes: [
          "Timing/cost follow the bundled synthetic road model; the drawn path may use real street geometry where available, with no freight restrictions",
          "No confirmed warehouse reservation or legal hours-of-service validation",
        ],
        recovery: null,
      };
      options.push({ score, record, drive, duty: usedDuty });
    }
    return {
      options,
      reason: "No time-feasible truck/driver/route combination",
    };
  }

  function reserve(
    record: ShipmentPlan,
    drive: number,
    duty: number,
    state: Map<string, TruckState>,
    occupancy: Map<string, number>,
  ) {
    const s = state.get(record.truckId!)!;
    s.location = record.destinationId;
    s.available = record.completeMin!;
    s.trips += 1;
    s.dutyUsed += duty;
    s.driveUsed += drive;
    occupancy.set(record.slotId, (occupancy.get(record.slotId) ?? 0) + 1);
  }

  function priorityOrderKey(s: ShipmentRow) {
    return -(PRIORITY_WEIGHTS[s.priority] ?? 1);
  }

  let best: {
    ranking: number[];
    records: ShipmentPlan[];
    state: Map<string, TruckState>;
    occupancy: Map<string, number>;
  } | null = null;

  for (let trial = 0; trial < SOLVER_ATTEMPTS; trial++) {
    let ordered = [...fixtures.shipments].sort((a, b) => {
      const mod = trial % 3;
      if (mod === 0) {
        return (
          priorityOrderKey(a) - priorityOrderKey(b) ||
          a.appointmentEndMin - b.appointmentEndMin ||
          a.pickupReadyMin - b.pickupReadyMin ||
          a.id.localeCompare(b.id)
        );
      }
      if (mod === 1) {
        return (
          priorityOrderKey(a) - priorityOrderKey(b) ||
          a.pickupReadyMin - b.pickupReadyMin ||
          a.appointmentEndMin - b.appointmentEndMin ||
          a.id.localeCompare(b.id)
        );
      }
      return (
        priorityOrderKey(a) - priorityOrderKey(b) ||
        a.appointmentEndMin -
          a.pickupReadyMin -
          (b.appointmentEndMin - b.pickupReadyMin) ||
        a.appointmentEndMin - b.appointmentEndMin ||
        a.id.localeCompare(b.id)
      );
    });
    if (trial >= 3) {
      if (trial === 3) {
        ordered = [...ordered].reverse();
      } else {
        ordered = [...ordered].sort((a, b) => {
          const an = Number(a.id.split("-").at(-1));
          const bn = Number(b.id.split("-").at(-1));
          const aKey = [
            -(PRIORITY_WEIGHTS[a.priority] ?? 1),
            (an * (trial + 1)) % 43,
          ];
          const bKey = [
            -(PRIORITY_WEIGHTS[b.priority] ?? 1),
            (bn * (trial + 1)) % 43,
          ];
          return compareArrays(aKey, bKey);
        });
      }
    }

    const state = new Map<string, TruckState>();
    for (const [tid, truck] of trucks) {
      const driver = driverByTruck.get(tid);
      if (!driver) continue;
      state.set(tid, {
        location:
          truck.homeWarehouseId ??
          truck.basePortId ??
          shipmentOriginFallback(ordered),
        available: Math.max(truck.availableFromMin, driver.shiftStartMin),
        trips: 0,
        dutyUsed: 0,
        driveUsed: 0,
      });
    }
    const occupancy = new Map<string, number>(
      fixtures.slots.map((s) => [s.slotId, s.booked]),
    );
    const output = new Map<string, ShipmentPlan>();

    for (const sh of ordered) {
      const { options, reason } = evaluate(sh, state, occupancy);
      if (options.length > 0) {
        let bestOpt = options[0];
        for (const opt of options)
          if (compareArrays(opt.score, bestOpt.score) < 0) bestOpt = opt;
        reserve(bestOpt.record, bestOpt.drive, bestOpt.duty, state, occupancy);
        output.set(sh.id, bestOpt.record);
      } else {
        const normal = normalPaths.get(`${sh.originId}|${sh.destinationId}`);
        output.set(sh.id, {
          shipmentId: sh.id,
          priority: sh.priority,
          status: "unassigned",
          originId: sh.originId,
          destinationId: sh.destinationId,
          truckId: null,
          driverId: null,
          tripNumber: null,
          departureMin: null,
          arrivalMin: null,
          receivingMin: null,
          completeMin: null,
          appointmentStartMin: sh.appointmentStartMin,
          appointmentEndMin: sh.appointmentEndMin,
          slotId: sh.appointmentSlotId,
          emptyMiles: null,
          emptyMinutes: null,
          loadedMiles: null,
          loadedMinutes: null,
          totalMiles: null,
          costUsd: null,
          co2Kg: null,
          routeSegments: [],
          emptyRouteSegments: [],
          routeCoords: [],
          emptyRouteCoords: [],
          normalRouteCoords: normal?.coords ?? [],
          normalMinutes: normal?.minutes ?? null,
          rerouted: false,
          routeNote:
            "Unassigned — no feasible truck/driver/route combination within the modeled windows.",
          notes: [reason],
          recovery: null,
        });
      }
    }

    const recs = fixtures.shipments.map((s) => output.get(s.id)!);
    const scheduled = recs.filter((r) => r.status === "scheduled");
    const priorityScore = scheduled.reduce(
      (sum, r) => sum + (PRIORITY_WEIGHTS[r.priority] ?? 1),
      0,
    );
    const dollars = scheduled.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    const carbon = scheduled.reduce((sum, r) => sum + (r.co2Kg ?? 0), 0);
    const tie =
      settings.policy === "Lowest cost"
        ? dollars
        : settings.policy === "Lowest CO2"
          ? carbon
          : settings.policy === "Reliability first"
            ? scheduled.reduce((sum, r) => sum + (r.receivingMin ?? 0), 0)
            : dollars / 300 + 0.7 * (carbon / 150);
    const ranking = [priorityScore, scheduled.length, -tie];
    if (!best || compareArrays(ranking, best.ranking) > 0) {
      best = { ranking, records: recs, state, occupancy };
    }
  }

  const records = best!.records;
  const unassignedReasons: Record<string, number> = {};
  for (const r of records) {
    if (r.status === "unassigned")
      unassignedReasons[r.notes[0]] = (unassignedReasons[r.notes[0]] ?? 0) + 1;
  }

  // Recovery pass: try to place unassigned shipments into a later receiving
  // slot at the same warehouse, reserving the slot/truck so two recovered
  // shipments cannot double-book the same availability.
  const shipmentById = new Map(fixtures.shipments.map((s) => [s.id, s]));
  const unassignedSorted = records
    .filter((r) => r.status === "unassigned")
    .sort(
      (a, b) =>
        (PRIORITY_WEIGHTS[b.priority] ?? 1) -
          (PRIORITY_WEIGHTS[a.priority] ?? 1) ||
        a.shipmentId.localeCompare(b.shipmentId),
    );

  for (const record of unassignedSorted) {
    const shipment = shipmentById.get(record.shipmentId)!;
    const candidates: EvalOption[] = [];
    for (const slot of fixtures.slots) {
      if (slot.warehouseId !== shipment.destinationId) continue;
      if (slot.windowEndMin <= shipment.appointmentEndMin) continue;
      const { options } = evaluate(
        shipment,
        best!.state,
        best!.occupancy,
        slot,
      );
      for (const opt of options) {
        if ((opt.record.receivingMin ?? 0) > shipment.appointmentEndMin)
          candidates.push(opt);
      }
    }
    if (candidates.length > 0) {
      let bestOpt = candidates[0];
      for (const opt of candidates) {
        const a = [opt.record.receivingMin ?? 0, ...opt.score];
        const b = [bestOpt.record.receivingMin ?? 0, ...bestOpt.score];
        if (compareArrays(a, b) < 0) bestOpt = opt;
      }
      reserve(
        bestOpt.record,
        bestOpt.drive,
        bestOpt.duty,
        best!.state,
        best!.occupancy,
      );
      record.recovery = {
        status: "proposed",
        arrivalMin: bestOpt.record.arrivalMin!,
        receivingMin: bestOpt.record.receivingMin!,
        slotId: bestOpt.record.slotId,
        truckId: bestOpt.record.truckId!,
        note: "Proposed next feasible slot — awaiting warehouse confirmation.",
      };
    } else {
      record.recovery = {
        status: "none_feasible",
        note: "No feasible receiving slot within remaining truck, driver, or warehouse capacity for this run.",
      };
    }
  }

  const selected = records.filter((r) => r.status === "scheduled");
  const tripsByTruck = new Map<string, number>();
  for (const r of selected)
    tripsByTruck.set(r.truckId!, (tripsByTruck.get(r.truckId!) ?? 0) + 1);
  const metrics: ScenarioMetrics = {
    shipments: records.length,
    scheduled: selected.length,
    unassigned: records.length - selected.length,
    criticalScheduled: selected.filter((r) => r.priority === "critical").length,
    trucksUsed: tripsByTruck.size,
    trucksWithMultipleTrips: [...tripsByTruck.values()].filter((c) => c > 1)
      .length,
    scheduledCostUsd: round2(
      selected.reduce((s, r) => s + (r.costUsd ?? 0), 0),
    ),
    scheduledCo2Kg: round2(selected.reduce((s, r) => s + (r.co2Kg ?? 0), 0)),
    scheduledLoadedMiles: round2(
      selected.reduce((s, r) => s + (r.loadedMiles ?? 0), 0),
    ),
    scheduledEmptyMiles: round2(
      selected.reduce((s, r) => s + (r.emptyMiles ?? 0), 0),
    ),
  };

  const activeClosureSegmentId =
    blocked.size > 0 ? [...blocked][0] : slowdownSegment;
  const activeClosureSegment = activeClosureSegmentId
    ? network.getSegment(activeClosureSegmentId)
    : undefined;
  const closureSegmentGeometry: [number, number][] | null = activeClosureSegment
    ? (JSON.parse(activeClosureSegment.geometryJson) as [number, number][])
    : null;

  return {
    settings,
    scenarioLabel: cfg.name,
    scenarioKind: cfg.kind,
    closureSegmentId: activeClosureSegmentId,
    closureIsProxy,
    closureSegmentGeometry,
    closureKind:
      blocked.size > 0 ? "closed" : slowdownSegment ? "slowdown" : null,
    shipments: records,
    metrics,
    baselineMetrics: emptyMetrics(records.length),
    unassignedReasons,
    routeSource: ROUTE_SOURCE_LABEL,
    assumptions: [
      "Synthetic graph nodes/edges only — paths are not commercial truck-verified and use no freight-specific driving profile.",
      "Each truck may serve multiple nonoverlapping trips; drivers remain fixed to their assigned truck.",
      "Driver hours_remaining is a simplified duty/drive allowance, not regulatory hours-of-service validation.",
      "Warehouse booked counts are treated as pre-existing demand; a scheduled shipment is feasible against remaining capacity, not an actual confirmed reservation.",
      "Only an explicit road closure removes a graph edge; other disruption kinds add synthetic travel delay.",
      "Costs and CO2 are illustrative constants, not validated tariffs or emission factors.",
      "Multi-start greedy scheduling does not prove global optimality; no real dispatch or bookings are made.",
    ],
  };
}

function shipmentOriginFallback(shipments: ShipmentRow[]): string {
  return shipments[0]?.originId ?? "PORT-LA";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Runs both the normal baseline and the requested scenario for comparison. */
export function runScenarioComparison(
  fixtures: SimulationFixtures,
  settings: ScenarioSettings,
) {
  const baselineSettings: ScenarioSettings = {
    ...settings,
    scenario: "Normal conditions",
    severity: 0,
    closureSegment: null,
    closureLocation: null,
  };
  const baseline = optimizeScenario(fixtures, baselineSettings);
  const revised = optimizeScenario(fixtures, settings);
  baseline.baselineMetrics = baseline.metrics;
  revised.baselineMetrics = baseline.metrics;
  return { baseline, revised };
}
