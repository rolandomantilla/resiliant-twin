import type { FacilityRow, ShipmentPlan } from "./types";

export interface ShipmentMasterRow {
  id: string;
  originId: string;
  destinationId: string;
  containerId: string;
  cargoType: string;
  containerTeu?: number;
  priority: "critical" | "high" | "routine";
  pickupStatus: "ready" | "pending";
  appointmentStartMin: number;
  appointmentEndMin: number;
  estimatedValueUsd: number;
  weightTons: number;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  contacted: boolean;
  contactedAt: Date | string | null;
}

export interface MergedShipmentRow {
  id: string;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  customerName: string;
  phone: string;
  email: string;
  priority: "critical" | "high" | "routine";
  truckId: string | null;
  status: "scheduled" | "unassigned";
  appointmentEndMin: number;
  originalWindow: string;
  modeledImpact: string;
  nextAction: string;
  revisedEtaMin: number | null;
  revisedEtaIsSimulated: boolean;
  proposedSlotId: string | null;
  contacted: boolean;
  plan: ShipmentPlan | null;
}

export function mergeShipmentRows(
  master: ShipmentMasterRow[],
  plans: ShipmentPlan[],
  facilities: FacilityRow[],
): MergedShipmentRow[] {
  const facilityName = new Map(facilities.map((f) => [f.id, f.name]));
  const planById = new Map(plans.map((p) => [p.shipmentId, p]));
  return master.map((m) => {
    const plan = planById.get(m.id) ?? null;
    const originalWindow = `T+${m.appointmentStartMin}m \u2013 T+${m.appointmentEndMin}m`;
    let modeledImpact =
      "Not yet simulated — run a scenario to see the modeled impact.";
    let nextAction = "Run a scenario";
    let revisedEtaMin: number | null = null;
    let revisedEtaIsSimulated = false;
    let proposedSlotId: string | null = null;

    if (plan) {
      proposedSlotId = plan.slotId;
      if (plan.status === "scheduled") {
        revisedEtaMin = plan.receivingMin;
        revisedEtaIsSimulated = true;
        modeledImpact = plan.routeNote;
        nextAction =
          plan.receivingMin !== null &&
          plan.receivingMin > plan.appointmentEndMin
            ? "Notify customer — arriving after the original window"
            : "On track — monitor";
      } else if (plan.recovery?.status === "proposed") {
        revisedEtaMin = plan.recovery.receivingMin ?? null;
        revisedEtaIsSimulated = true;
        proposedSlotId = plan.recovery.slotId ?? null;
        modeledImpact = plan.notes[0] ?? "Unassigned this run.";
        nextAction = "Proposed recovery slot — awaiting warehouse confirmation";
      } else if (plan.recovery?.status === "none_feasible") {
        modeledImpact = plan.notes[0] ?? "Unassigned this run.";
        nextAction = "No feasible option — escalate to dispatch supervisor";
      } else {
        modeledImpact = plan.notes[0] ?? "Unassigned this run.";
        nextAction = "Awaiting recovery pass";
      }
    }

    return {
      id: m.id,
      originId: m.originId,
      originName: facilityName.get(m.originId) ?? m.originId,
      destinationId: m.destinationId,
      destinationName: facilityName.get(m.destinationId) ?? m.destinationId,
      customerName: m.customerName,
      phone: m.phone,
      email: m.email,
      priority: m.priority,
      truckId: plan?.truckId ?? null,
      status: plan?.status ?? "unassigned",
      appointmentEndMin: m.appointmentEndMin,
      originalWindow,
      modeledImpact,
      nextAction,
      revisedEtaMin,
      revisedEtaIsSimulated,
      proposedSlotId,
      contacted: m.contacted,
      plan,
    };
  });
}
