// Shared, DB-agnostic types for the ResilienceTwin routing/scheduling engine.
// This module has no imports from @/lib/db or drizzle — it is plain data
// shaping so it can be unit-tested and reused from any server function.

export type ScenarioName =
  | "Normal conditions"
  | "Highway slowdown"
  | "Road closure"
  | "Delayed pickup"
  | "Wildfire-related slowdown"
  | "Flood-related slowdown";

export type PolicyName =
  | "Balanced"
  | "Lowest cost"
  | "Lowest CO2"
  | "Reliability first";

export type BasemapName = "streets" | "satellite" | "topographic" | "gray";

export interface ScenarioSettings {
  scenario: ScenarioName;
  severity: number; // minutes
  policy: PolicyName;
  dieselPrice: number; // USD/gal
  basemap: BasemapName;
  closureSegment: string | null;
  closureLocation: string | null;
  showNormalOverlay: boolean;
}

export const DEFAULT_SCENARIO_SETTINGS: ScenarioSettings = {
  scenario: "Normal conditions",
  severity: 0,
  policy: "Balanced",
  dieselPrice: 4.1,
  basemap: "streets",
  closureSegment: null,
  closureLocation: null,
  showNormalOverlay: false,
};

export interface FacilityRow {
  id: string;
  name: string;
  kind: "port" | "warehouse";
  lat: number;
  lon: number;
  dailyCapacity: number;
}

export interface TruckRow {
  id: string;
  capacityTeu: number;
  status: "available" | "maintenance";
  basePortId: string | null;
  vehicleType: string;
  fuelType: string;
  modelYear: number;
  mpgAssumed: number;
  maintenanceState: "serviceable" | "inspection_due";
  availableFromMin: number;
  homeWarehouseId: string | null;
}

export interface DriverRow {
  id: string;
  truckId: string;
  endorsement: string;
  shiftStartMin: number;
  shiftEndMin: number;
  hoursRemaining: number;
  restRequiredMin: number;
}

export interface ShipmentRow {
  id: string;
  originId: string;
  destinationId: string;
  containerId: string;
  customerId: string;
  cargoType: string;
  containerTeu: number;
  priority: "critical" | "high" | "routine";
  pickupStatus: "ready" | "pending";
  pickupReadyMin: number;
  appointmentStartMin: number;
  appointmentEndMin: number;
  appointmentSlotId: string;
  estimatedValueUsd: number;
  weightTons: number;
  handlingRequirements: string;
  contacted: boolean;
}

export interface WarehouseSlotRow {
  slotId: string;
  warehouseId: string;
  windowStartMin: number;
  windowEndMin: number;
  capacity: number;
  booked: number;
}

export interface RoadNodeRow {
  nodeId: string;
  name: string;
  lat: number;
  lon: number;
  nodeType: string;
}

export interface RoadSegmentRow {
  segmentId: string;
  fromNodeId: string;
  toNodeId: string;
  roadName: string;
  nominalMiles: number;
  nominalMin: number;
  sensitivity: string;
  freightAllowed: boolean;
  geometryJson: string;
}

export interface SimulationFixtures {
  facilities: FacilityRow[];
  trucks: TruckRow[];
  drivers: DriverRow[];
  shipments: ShipmentRow[];
  slots: WarehouseSlotRow[];
  roadNodes: RoadNodeRow[];
  roadSegments: RoadSegmentRow[];
}

export interface PathResult {
  miles: number;
  minutes: number;
  segments: string[];
  coords: [number, number][];
  delayedMinutes: number;
}

export type ShipmentStatus = "scheduled" | "unassigned";

export interface RecoveryPlan {
  status: "proposed" | "none_feasible";
  arrivalMin?: number;
  receivingMin?: number;
  slotId?: string;
  truckId?: string;
  note: string;
}

export interface ShipmentPlan {
  shipmentId: string;
  priority: "critical" | "high" | "routine";
  status: ShipmentStatus;
  originId: string;
  destinationId: string;
  truckId: string | null;
  driverId: string | null;
  tripNumber: number | null;
  departureMin: number | null;
  arrivalMin: number | null;
  receivingMin: number | null;
  completeMin: number | null;
  appointmentStartMin: number;
  appointmentEndMin: number;
  slotId: string;
  emptyMiles: number | null;
  emptyMinutes: number | null;
  loadedMiles: number | null;
  loadedMinutes: number | null;
  totalMiles: number | null;
  costUsd: number | null;
  co2Kg: number | null;
  routeSegments: string[];
  emptyRouteSegments: string[];
  routeCoords: [number, number][];
  emptyRouteCoords: [number, number][];
  normalRouteCoords: [number, number][];
  normalMinutes: number | null;
  rerouted: boolean;
  routeNote: string;
  notes: string[];
  recovery: RecoveryPlan | null;
  /** Set when a dispatcher-applied truck swap replaced the planned truck. */
  swappedFromTruckId?: string | null;
}

export interface ScenarioMetrics {
  shipments: number;
  scheduled: number;
  unassigned: number;
  criticalScheduled: number;
  trucksUsed: number;
  trucksWithMultipleTrips: number;
  scheduledCostUsd: number;
  scheduledCo2Kg: number;
  scheduledLoadedMiles: number;
  scheduledEmptyMiles: number;
}

export interface ScenarioResult {
  settings: ScenarioSettings;
  scenarioLabel: string;
  scenarioKind: string;
  closureSegmentId: string | null;
  closureIsProxy: boolean;
  closureSegmentGeometry: [number, number][] | null;
  closureKind: "closed" | "slowdown" | null;
  shipments: ShipmentPlan[];
  metrics: ScenarioMetrics;
  baselineMetrics: ScenarioMetrics;
  unassignedReasons: Record<string, number>;
  routeSource: string;
  assumptions: string[];
}
