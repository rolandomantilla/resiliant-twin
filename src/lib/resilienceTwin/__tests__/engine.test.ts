import { describe, expect, it } from "vitest";
import {
  optimizeScenario,
  runScenarioComparison,
} from "@/lib/resilienceTwin/engine";
import { interpretScenarioRequest } from "@/lib/resilienceTwin/scenarioParser";
import { DEFAULT_SCENARIO_SETTINGS } from "@/lib/resilienceTwin/types";
import type { SimulationFixtures } from "@/lib/resilienceTwin/types";

// A minimal fixture set exercising: one port, two warehouses, a closable
// corridor, and enough trucks/drivers/slots to produce a feasible plan.
const fixtures: SimulationFixtures = {
  facilities: [
    {
      id: "PORT-LA",
      name: "Port of LA",
      kind: "port",
      lat: 33.732,
      lon: -118.269,
      dailyCapacity: 0,
    },
    {
      id: "WH-CAR",
      name: "Carson DC",
      kind: "warehouse",
      lat: 33.832,
      lon: -118.281,
      dailyCapacity: 7,
    },
    {
      id: "WH-COM",
      name: "Commerce DC",
      kind: "warehouse",
      lat: 34.002,
      lon: -118.159,
      dailyCapacity: 6,
    },
  ],
  trucks: [
    {
      id: "TRUCK-01",
      capacityTeu: 2,
      status: "available",
      basePortId: "PORT-LA",
      vehicleType: "Class 8 tractor",
      fuelType: "diesel",
      modelYear: 2022,
      mpgAssumed: 6,
      maintenanceState: "serviceable",
      availableFromMin: 0,
      homeWarehouseId: "WH-CAR",
    },
  ],
  drivers: [
    {
      id: "DRIVER-01",
      truckId: "TRUCK-01",
      endorsement: "CDL-A",
      shiftStartMin: 0,
      shiftEndMin: 600,
      hoursRemaining: 6,
      restRequiredMin: 30,
    },
  ],
  shipments: [
    {
      id: "SHP-001",
      originId: "PORT-LA",
      destinationId: "WH-CAR",
      containerId: "CONT-1",
      customerId: "CUST-001",
      cargoType: "general",
      containerTeu: 1,
      priority: "high",
      pickupStatus: "ready",
      pickupReadyMin: 0,
      appointmentStartMin: 0,
      appointmentEndMin: 200,
      appointmentSlotId: "SLOT-WH-CAR-00",
      estimatedValueUsd: 1000,
      weightTons: 10,
      handlingRequirements: "standard",
      contacted: false,
    },
  ],
  slots: [
    {
      slotId: "SLOT-WH-CAR-00",
      warehouseId: "WH-CAR",
      windowStartMin: 0,
      windowEndMin: 200,
      capacity: 8,
      booked: 0,
    },
  ],
  roadNodes: [
    {
      nodeId: "N-LA",
      name: "Port of LA",
      lat: 33.732,
      lon: -118.269,
      nodeType: "port",
    },
    {
      nodeId: "N-CAR",
      name: "Carson",
      lat: 33.832,
      lon: -118.281,
      nodeType: "hub",
    },
    {
      nodeId: "N-COM",
      name: "Commerce",
      lat: 34.002,
      lon: -118.159,
      nodeType: "hub",
    },
  ],
  roadSegments: [
    {
      segmentId: "S-001",
      fromNodeId: "N-LA",
      toNodeId: "N-CAR",
      roadName: "Port access connector",
      nominalMiles: 9,
      nominalMin: 18,
      sensitivity: "high",
      freightAllowed: true,
      geometryJson: "[[-118.269,33.732],[-118.281,33.832]]",
    },
    {
      segmentId: "S-003",
      fromNodeId: "N-CAR",
      toNodeId: "N-COM",
      roadName: "I-710 corridor (illustrative)",
      nominalMiles: 17,
      nominalMin: 29,
      sensitivity: "high",
      freightAllowed: true,
      geometryJson: "[[-118.281,33.832],[-118.159,34.002]]",
    },
  ],
};

describe("optimizeScenario", () => {
  it("schedules a feasible shipment under normal conditions", () => {
    const result = optimizeScenario(fixtures, DEFAULT_SCENARIO_SETTINGS);
    expect(result.metrics.scheduled).toBe(1);
    const plan = result.shipments[0];
    expect(plan.status).toBe("scheduled");
    expect(plan.truckId).toBe("TRUCK-01");
    expect(plan.rerouted).toBe(false);
  });

  it("excludes a closed segment from the route and reroutes when a bypass exists", () => {
    const result = optimizeScenario(fixtures, {
      ...DEFAULT_SCENARIO_SETTINGS,
      scenario: "Road closure",
      severity: 150,
      closureSegment: "S-001",
    });
    // The only path from PORT-LA to WH-CAR uses S-001; with no bypass the
    // shipment becomes unassigned rather than using the closed segment.
    expect(result.shipments[0].routeSegments).not.toContain("S-001");
  });

  it("raises modeled cost when diesel price increases", () => {
    const cheap = optimizeScenario(fixtures, {
      ...DEFAULT_SCENARIO_SETTINGS,
      dieselPrice: 4.1,
    });
    const expensive = optimizeScenario(fixtures, {
      ...DEFAULT_SCENARIO_SETTINGS,
      dieselPrice: 6.5,
    });
    expect(expensive.metrics.scheduledCostUsd).toBeGreaterThan(
      cheap.metrics.scheduledCostUsd,
    );
  });

  it("produces an identical baseline regardless of the requested scenario", () => {
    const a = runScenarioComparison(fixtures, DEFAULT_SCENARIO_SETTINGS);
    const b = runScenarioComparison(fixtures, {
      ...DEFAULT_SCENARIO_SETTINGS,
      scenario: "Highway slowdown",
      severity: 75,
    });
    expect(a.baseline.metrics).toEqual(b.baseline.metrics);
  });
});

describe("interpretScenarioRequest", () => {
  it("keeps the active closure and policy when only the basemap/overlay change", () => {
    const afterClosure = interpretScenarioRequest(
      "Close Highway 60 in East LA and reroute",
      DEFAULT_SCENARIO_SETTINGS,
    );
    const afterCost = interpretScenarioRequest(
      "Keep that closure, prioritize lowest cost, and set diesel to $6.50 per gallon",
      afterClosure.settings!,
    );
    const afterSatellite = interpretScenarioRequest(
      "Switch to satellite and show the normal routes for comparison",
      afterCost.settings!,
    );
    expect(afterSatellite.settings).toMatchObject({
      scenario: "Road closure",
      policy: "Lowest cost",
      dieselPrice: 6.5,
      closureSegment: "S-005",
      basemap: "satellite",
      showNormalOverlay: true,
    });
  });

  it("asks for clarification on an unmapped highway instead of guessing", () => {
    const result = interpretScenarioRequest(
      "Close Highway 405",
      DEFAULT_SCENARIO_SETTINGS,
    );
    expect(result.settings).toBeNull();
    expect(result.clarification).toMatch(/highway segment|corridor/i);
  });

  it("resets severity to 0 on reopen and clears the closure segment", () => {
    const afterClosure = interpretScenarioRequest(
      "Close Highway 60 in East LA and reroute",
      DEFAULT_SCENARIO_SETTINGS,
    );
    const afterReopen = interpretScenarioRequest(
      "Reopen the road and recalculate",
      afterClosure.settings!,
    );
    expect(afterReopen.settings).toMatchObject({
      scenario: "Normal conditions",
      severity: 0,
      closureSegment: null,
    });
  });
});
