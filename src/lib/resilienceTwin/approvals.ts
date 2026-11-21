import type { ScenarioResult, ScenarioSettings, ShipmentPlan } from "./types";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRecord {
  shipmentId: string;
  routeKey: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  decidedAt: Date | string;
}

export interface ReviewItem {
  shipmentId: string;
  routeKey: string;
  summary: string;
  baseline: ShipmentPlan | null;
  proposed: ShipmentPlan;
  changes: string[];
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedAt: Date | string | null;
}

export function routeKeyFor(p: ShipmentPlan): string {
  return [
    p.status,
    p.truckId ?? "-",
    p.recovery?.slotId ?? p.slotId,
    p.receivingMin ?? p.recovery?.receivingMin ?? "-",
    p.routeSegments.join(">"),
  ].join("|");
}

export function scenarioLabel(s: ScenarioSettings): string {
  return s.scenario === "Normal conditions"
    ? s.scenario
    : `${s.scenario} (+${s.severity} min, ${s.policy})`;
}

function describeChanges(
  base: ShipmentPlan | null,
  next: ShipmentPlan,
): string[] {
  const changes: string[] = [];
  if (next.rerouted) changes.push("Rerouted around disruption");
  if (base && base.truckId !== next.truckId)
    changes.push(`Truck ${base.truckId ?? "none"} → ${next.truckId ?? "none"}`);
  if (base && base.status !== next.status)
    changes.push(`Status ${base.status} → ${next.status}`);
  if (
    base &&
    base.receivingMin !== null &&
    next.receivingMin !== null &&
    base.receivingMin !== next.receivingMin
  ) {
    const delta = next.receivingMin - base.receivingMin;
    changes.push(`ETA ${delta > 0 ? "+" : ""}${delta} min`);
  }
  if (next.recovery?.status === "proposed")
    changes.push(`Recovery slot ${next.recovery.slotId ?? "proposed"}`);
  return changes;
}

export function buildReviewItems(
  baseline: ScenarioResult | null,
  revised: ScenarioResult | null,
  approvals: ApprovalRecord[],
): ReviewItem[] {
  if (!revised) return [];
  const baseById = new Map(
    (baseline?.shipments ?? []).map((p) => [p.shipmentId, p]),
  );
  const approvalById = new Map(approvals.map((a) => [a.shipmentId, a]));
  const items: ReviewItem[] = [];
  for (const proposed of revised.shipments) {
    const base = baseById.get(proposed.shipmentId) ?? null;
    const changes = describeChanges(base, proposed);
    if (changes.length === 0) continue;
    const routeKey = routeKeyFor(proposed);
    const a = approvalById.get(proposed.shipmentId);
    const current = a && a.routeKey === routeKey ? a : null;
    items.push({
      shipmentId: proposed.shipmentId,
      routeKey,
      summary: changes.join("; "),
      baseline: base,
      proposed,
      changes,
      status: current?.decision ?? "pending",
      decidedBy: current?.decidedBy ?? null,
      decidedAt: current?.decidedAt ?? null,
    });
  }
  return items;
}

/** Rejected shipments keep their original (baseline) plan. */
export function applyRejections(
  baseline: ScenarioResult | null,
  revised: ScenarioResult | null,
  items: ReviewItem[],
): ScenarioResult | null {
  if (!revised || !baseline) return revised;
  const rejected = new Set(
    items.filter((i) => i.status === "rejected").map((i) => i.shipmentId),
  );
  if (rejected.size === 0) return revised;
  const baseById = new Map(baseline.shipments.map((p) => [p.shipmentId, p]));
  return {
    ...revised,
    shipments: revised.shipments.map((p) =>
      rejected.has(p.shipmentId) ? (baseById.get(p.shipmentId) ?? p) : p,
    ),
  };
}
