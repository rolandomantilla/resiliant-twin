import type { BasemapName, PolicyName, ScenarioName } from "./types";

export const POLICIES: PolicyName[] = [
  "Balanced",
  "Lowest cost",
  "Lowest CO2",
  "Reliability first",
];

export const BASEMAPS: BasemapName[] = [
  "streets",
  "satellite",
  "topographic",
  "gray",
];

export interface ScenarioDefinition {
  scenarioId: string;
  name: ScenarioName;
  kind: "normal" | "traffic" | "road_closure" | "port" | "wildfire" | "flood";
  severityMin: number;
  affectedSegmentId: string | null;
  description: string;
}

/** Fixed, synthetic scenario catalog — mirrors the ResilienceTwin reference dataset. */
export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    scenarioId: "SCN-NORMAL",
    name: "Normal conditions",
    kind: "normal",
    severityMin: 0,
    affectedSegmentId: null,
    description: "No modeled disruption.",
  },
  {
    scenarioId: "SCN-SLOW",
    name: "Highway slowdown",
    kind: "traffic",
    severityMin: 75,
    affectedSegmentId: "S-004",
    description: "Modeled inland delay on the I-10 corridor segment.",
  },
  {
    scenarioId: "SCN-CLOSE",
    name: "Road closure",
    kind: "road_closure",
    severityMin: 150,
    affectedSegmentId: "S-004",
    description: "Modeled segment closure; the affected graph edge is removed.",
  },
  {
    scenarioId: "SCN-PICKUP",
    name: "Delayed pickup",
    kind: "port",
    severityMin: 90,
    affectedSegmentId: null,
    description: "Containers not ready at the port on the original schedule.",
  },
  {
    scenarioId: "SCN-FIRE",
    name: "Wildfire-related slowdown",
    kind: "wildfire",
    severityMin: 110,
    affectedSegmentId: "S-005",
    description:
      "Illustrative wildfire route exposure, modeled as added travel time.",
  },
  {
    scenarioId: "SCN-FLOOD",
    name: "Flood-related slowdown",
    kind: "flood",
    severityMin: 120,
    affectedSegmentId: "S-003",
    description:
      "Illustrative flooding route exposure, modeled as added travel time.",
  },
];

export function scenarioByName(name: ScenarioName): ScenarioDefinition {
  const found = SCENARIO_DEFINITIONS.find((s) => s.name === name);
  if (!found) throw new Error(`Unknown scenario: ${name}`);
  return found;
}

/** Illustrative demo cost constants (USD), matching the reference dataset. */
export const COST_PARAMETERS = {
  perMile: 2.7, // C-MI
  perDriverHour: 28.0, // C-HR
  referenceDieselPrice: 4.1, // C-FUEL
};

/** Illustrative demo emission factors (kg CO2), matching the reference dataset. */
export const EMISSION_PARAMETERS = {
  perMile: 1.65, // E-MILE
  perIdleMinute: 0.09, // E-IDLE
};

export const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 2,
  routine: 1,
};

/** Maps a facility id to its synthetic road-graph node. */
export const FACILITY_NODE_MAP: Record<string, string> = {
  "PORT-LA": "N-LA",
  "PORT-LB": "N-LB",
  "WH-CAR": "N-CAR",
  "WH-COM": "N-COM",
  "WH-ONT": "N-ONT",
  "WH-RIV": "N-RIV",
  "WH-FON": "N-FON",
};

/**
 * Supported named-highway -> modeled corridor mapping. This demo's road graph
 * has 13 schematic segments, not a real street network, so any named highway
 * is explicitly identified as a proxy for one of these segments.
 */
export const HIGHWAY_SEGMENT_MAP: Record<string, string> = {
  "60": "S-005",
  "57": "S-004",
  "10": "S-004",
  "710": "S-003",
  "605": "S-013",
};

export const VALID_SEGMENT_IDS = [
  "S-001",
  "S-002",
  "S-003",
  "S-004",
  "S-005",
  "S-006",
  "S-007",
  "S-008",
  "S-009",
  "S-010",
  "S-011",
  "S-012",
  "S-013",
];

/** Fixed scheduling tuning, matching the reference solver's defaults. */
export const TURNAROUND_MIN = 25;
export const MAX_TRIPS_PER_TRUCK = 4;
export const SOLVER_ATTEMPTS = 6;

export const ROUTE_SOURCE_LABEL =
  "Bundled ResilienceTwin synthetic road-segment graph (9 nodes / 13 segments) — illustrative, not navigable street geometry.";
