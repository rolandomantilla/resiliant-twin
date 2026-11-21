import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Warehouse snapshot — two ports, five warehouses, fleet, drivers, shipments.
// Minutes are relative to a simulated dispatch epoch (not calendar time),
// matching the ResilienceTwin GeoAI reference dataset.
// ---------------------------------------------------------------------------

export const facilities = pgTable("facilities", {
  id: text("id").primaryKey(), // e.g. PORT-LA, WH-ONT
  name: text("name").notNull(),
  kind: text("kind").$type<"port" | "warehouse">().notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  dailyCapacity: integer("daily_capacity").notNull().default(0),
});

export const trucks = pgTable("trucks", {
  id: text("id").primaryKey(), // TRUCK-01
  capacityTeu: integer("capacity_teu").notNull(),
  status: text("status").$type<"available" | "maintenance">().notNull(),
  basePortId: text("base_port_id").references(() => facilities.id),
  vehicleType: text("vehicle_type").notNull(),
  fuelType: text("fuel_type").notNull(),
  modelYear: integer("model_year").notNull(),
  mpgAssumed: doublePrecision("mpg_assumed").notNull(),
  maintenanceState: text("maintenance_state")
    .$type<"serviceable" | "inspection_due">()
    .notNull(),
  availableFromMin: integer("available_from_min").notNull().default(0),
  homeWarehouseId: text("home_warehouse_id").references(() => facilities.id),
});

export const drivers = pgTable("drivers", {
  id: text("id").primaryKey(), // DRIVER-01
  truckId: text("truck_id")
    .references(() => trucks.id)
    .notNull(),
  endorsement: text("endorsement").notNull(),
  shiftStartMin: integer("shift_start_min").notNull(),
  shiftEndMin: integer("shift_end_min").notNull(),
  hoursRemaining: doublePrecision("hours_remaining").notNull(),
  restRequiredMin: integer("rest_required_min").notNull(),
});

export const customerContacts = pgTable("customer_contacts", {
  customerId: text("customer_id").primaryKey(), // CUST-001
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
});

export const warehouseSlots = pgTable("warehouse_slots", {
  slotId: text("slot_id").primaryKey(), // SLOT-WH-ONT-00
  warehouseId: text("warehouse_id")
    .references(() => facilities.id)
    .notNull(),
  windowStartMin: integer("window_start_min").notNull(),
  windowEndMin: integer("window_end_min").notNull(),
  capacity: integer("capacity").notNull(),
  booked: integer("booked").notNull().default(0),
});

export const shipments = pgTable("shipments", {
  id: text("id").primaryKey(), // SHP-001
  originId: text("origin_id")
    .references(() => facilities.id)
    .notNull(),
  destinationId: text("destination_id")
    .references(() => facilities.id)
    .notNull(),
  containerId: text("container_id").notNull(),
  customerId: text("customer_id")
    .references(() => customerContacts.customerId)
    .notNull(),
  cargoType: text("cargo_type").notNull(),
  containerTeu: integer("container_teu").notNull(),
  priority: text("priority").$type<"critical" | "high" | "routine">().notNull(),
  pickupStatus: text("pickup_status").$type<"ready" | "pending">().notNull(),
  pickupReadyMin: integer("pickup_ready_min").notNull(),
  appointmentStartMin: integer("appointment_start_min").notNull(),
  appointmentEndMin: integer("appointment_end_min").notNull(),
  appointmentSlotId: text("appointment_slot_id")
    .references(() => warehouseSlots.slotId)
    .notNull(),
  estimatedValueUsd: doublePrecision("estimated_value_usd").notNull(),
  weightTons: doublePrecision("weight_tons").notNull(),
  handlingRequirements: text("handling_requirements").notNull(),
  contacted: boolean("contacted").notNull().default(false),
  contactedAt: timestamp("contacted_at"),
  lastNoticeId: text("last_notice_id"),
});

// ---------------------------------------------------------------------------
// Synthetic road graph — 9 nodes, 13 segments, used by the routing engine.
// ---------------------------------------------------------------------------

export const roadNodes = pgTable("road_nodes", {
  nodeId: text("node_id").primaryKey(), // N-LA
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  nodeType: text("node_type").notNull(),
});

export const roadSegments = pgTable("road_segments", {
  segmentId: text("segment_id").primaryKey(), // S-001
  fromNodeId: text("from_node_id")
    .references(() => roadNodes.nodeId)
    .notNull(),
  toNodeId: text("to_node_id")
    .references(() => roadNodes.nodeId)
    .notNull(),
  roadName: text("road_name").notNull(),
  nominalMiles: doublePrecision("nominal_miles").notNull(),
  nominalMin: integer("nominal_min").notNull(),
  sensitivity: text("sensitivity").notNull(),
  freightAllowed: boolean("freight_allowed").notNull().default(true),
  geometryJson: text("geometry_json").notNull(), // JSON [[lon,lat], ...]
});

// ---------------------------------------------------------------------------
// IoT + disruption replay log — every event received, accepted or rejected.
// ---------------------------------------------------------------------------

export const iotEvents = pgTable("iot_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  truckId: text("truck_id").notNull(),
  eventType: text("event_type")
    .$type<"location" | "pickup_status" | "queue_time">()
    .notNull(),
  payload: text("payload").notNull(), // JSON
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  status: text("status")
    .$type<"accepted" | "rejected" | "superseded">()
    .notNull(),
  reason: text("reason"),
});

export const disruptionEvents = pgTable("disruption_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  corridorId: text("corridor_id").notNull(),
  eventType: text("event_type")
    .$type<"closure" | "slowdown" | "reopen">()
    .notNull(),
  payload: text("payload").notNull(), // JSON { delayMin? }
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  status: text("status")
    .$type<"accepted" | "rejected" | "superseded">()
    .notNull(),
  reason: text("reason"),
});

export const truckLiveState = pgTable("truck_live_state", {
  truckId: text("truck_id").primaryKey(),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  pickupStatus: text("pickup_status"),
  queueMin: integer("queue_min"),
  lastEventId: text("last_event_id").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const corridorLiveState = pgTable("corridor_live_state", {
  corridorId: text("corridor_id").primaryKey(),
  status: text("status").$type<"open" | "slowdown" | "closed">().notNull(),
  delayMin: integer("delay_min").notNull().default(0),
  lastEventId: text("last_event_id").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Outreach + assistant conversation log.
// ---------------------------------------------------------------------------

export const outreachNotices = pgTable("outreach_notices", {
  id: text("id").primaryKey(),
  stopId: text("stop_id")
    .references(() => facilities.id)
    .notNull(),
  shipmentIds: text("shipment_ids").notNull(), // JSON string[]
  impactKey: text("impact_key").notNull(), // hash of impact+ETA signature
  etaSummary: text("eta_summary").notNull(), // JSON
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scenarioMessages = pgTable("scenario_messages", {
  id: text("id").primaryKey(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  settingsJson: text("settings_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Dispatcher-applied truck reassignments, layered on top of every
// recalculated plan until undone.
export const truckSwaps = pgTable("truck_swaps", {
  shipmentId: text("shipment_id")
    .primaryKey()
    .references(() => shipments.id, { onDelete: "cascade" }),
  fromTruckId: text("from_truck_id"),
  truckId: text("truck_id")
    .references(() => trucks.id)
    .notNull(),
  pickupId: text("pickup_id").references(() => facilities.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Human-in-the-loop review of proposed routes. A decision only applies while
// the shipment's proposed route still matches `routeKey`.
export const routeApprovals = pgTable("route_approvals", {
  shipmentId: text("shipment_id")
    .primaryKey()
    .references(() => shipments.id, { onDelete: "cascade" }),
  routeKey: text("route_key").notNull(),
  decision: text("decision").$type<"approved" | "rejected">().notNull(),
  decidedBy: text("decided_by").notNull(),
  scenarioLabel: text("scenario_label").notNull(),
  summary: text("summary").notNull(),
  decidedAt: timestamp("decided_at").notNull().defaultNow(),
});

export const routeApprovalLog = pgTable("route_approval_log", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id")
    .references(() => shipments.id, { onDelete: "cascade" })
    .notNull(),
  decision: text("decision").$type<"approved" | "rejected">().notNull(),
  decidedBy: text("decided_by").notNull(),
  scenarioLabel: text("scenario_label").notNull(),
  summary: text("summary").notNull(),
  decidedAt: timestamp("decided_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  trucksBased: many(trucks),
  slots: many(warehouseSlots),
}));

export const trucksRelations = relations(trucks, ({ one, many }) => ({
  basePort: one(facilities, {
    fields: [trucks.basePortId],
    references: [facilities.id],
  }),
  homeWarehouse: one(facilities, {
    fields: [trucks.homeWarehouseId],
    references: [facilities.id],
  }),
  drivers: many(drivers),
}));

export const driversRelations = relations(drivers, ({ one }) => ({
  truck: one(trucks, { fields: [drivers.truckId], references: [trucks.id] }),
}));

export const warehouseSlotsRelations = relations(
  warehouseSlots,
  ({ one, many }) => ({
    warehouse: one(facilities, {
      fields: [warehouseSlots.warehouseId],
      references: [facilities.id],
    }),
    shipments: many(shipments),
  }),
);

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  origin: one(facilities, {
    fields: [shipments.originId],
    references: [facilities.id],
  }),
  destination: one(facilities, {
    fields: [shipments.destinationId],
    references: [facilities.id],
  }),
  customer: one(customerContacts, {
    fields: [shipments.customerId],
    references: [customerContacts.customerId],
  }),
  slot: one(warehouseSlots, {
    fields: [shipments.appointmentSlotId],
    references: [warehouseSlots.slotId],
  }),
}));

export const roadSegmentsRelations = relations(roadSegments, ({ one }) => ({
  fromNode: one(roadNodes, {
    fields: [roadSegments.fromNodeId],
    references: [roadNodes.nodeId],
  }),
  toNode: one(roadNodes, {
    fields: [roadSegments.toNodeId],
    references: [roadNodes.nodeId],
  }),
}));

// ---------------------------------------------------------------------------
// Organizational digital twin (ResilienceTwin v0.2) — synthetic 100-person,
// five-facility organization used by the readiness simulation.
// ---------------------------------------------------------------------------

export const orgFacilities = pgTable("org_facilities", {
  facilityId: text("facility_id").primaryKey(),
  facilityName: text("facility_name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  primaryFunction: text("primary_function").notNull(),
  headcountTarget: integer("headcount_target").notNull(),
});

export const orgSystems = pgTable("org_systems", {
  systemId: text("system_id").primaryKey(),
  systemName: text("system_name").notNull(),
  hostingFacilityId: text("hosting_facility_id")
    .notNull()
    .references(() => orgFacilities.facilityId),
});

export const orgEmployees = pgTable("org_employees", {
  employeeId: text("employee_id").primaryKey(),
  displayName: text("display_name").notNull(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => orgFacilities.facilityId),
  role: text("role").notNull(),
  workArrangement: text("work_arrangement").notNull(),
  remoteEligible: boolean("remote_eligible").notNull(),
  crossSiteDeployable: boolean("cross_site_deployable").notNull(),
  fte: doublePrecision("fte").notNull(),
  operationalCriticality: integer("operational_criticality").notNull(),
  knowledgeConcentration: integer("knowledge_concentration").notNull(),
  managerId: text("manager_id"),
  backupEmployeeId: text("backup_employee_id"),
  status: text("status").notNull(),
});

export const orgWorkflows = pgTable("org_workflows", {
  workflowId: text("workflow_id").primaryKey(),
  workflowName: text("workflow_name").notNull(),
  criticality: integer("criticality").notNull(),
  ownerFacilityId: text("owner_facility_id")
    .notNull()
    .references(() => orgFacilities.facilityId),
  minimumActivePersonnel: integer("minimum_active_personnel").notNull(),
  taskWorkHours: doublePrecision("task_work_hours").notNull(),
});

export const orgEmployeeSkills = pgTable("org_employee_skills", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => orgEmployees.employeeId),
  skillId: text("skill_id").notNull(),
  proficiency: doublePrecision("proficiency").notNull(),
});

export const orgWorkflowAssignments = pgTable("org_workflow_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => orgEmployees.employeeId),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => orgWorkflows.workflowId),
  allocationPct: doublePrecision("allocation_pct").notNull(),
});

export const orgSkillRequirements = pgTable("org_skill_requirements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => orgWorkflows.workflowId),
  skillId: text("skill_id").notNull(),
  minimumProficiency: integer("minimum_proficiency").notNull(),
  minimumQualifiedPeople: integer("minimum_qualified_people").notNull(),
});

export const orgSystemDependencies = pgTable("org_system_dependencies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => orgWorkflows.workflowId),
  systemId: text("system_id")
    .notNull()
    .references(() => orgSystems.systemId),
  dependencyType: text("dependency_type").notNull(),
});

export const orgExperience = pgTable("org_experience", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => orgEmployees.employeeId),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => orgWorkflows.workflowId),
  yearsInRole: doublePrecision("years_in_role"),
  similarTasksCompleted: integer("similar_tasks_completed"),
});

export const orgRelationships = pgTable("org_relationships", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => orgWorkflows.workflowId),
  sourceEmployeeId: text("source_employee_id")
    .notNull()
    .references(() => orgEmployees.employeeId),
  targetEmployeeId: text("target_employee_id")
    .notNull()
    .references(() => orgEmployees.employeeId),
  collaborationEvents: integer("collaboration_events").notNull(),
  handoffEvents: integer("handoff_events").notNull(),
  meanHandoffHours: doublePrecision("mean_handoff_hours").notNull(),
});
