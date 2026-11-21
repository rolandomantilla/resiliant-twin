import type { MergedShipmentRow } from "./mergeShipmentRows";
import type { FacilityRow, ScenarioResult } from "./types";

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildShipmentCsv(rows: MergedShipmentRow[]): string {
  const headers = [
    "shipment_id",
    "origin",
    "stop_id",
    "receiving_location",
    "assigned_truck",
    "original_window",
    "status",
    "modeled_impact",
    "next_action",
    "revised_eta",
    "proposed_slot",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.originName,
        r.destinationId,
        r.destinationName,
        r.truckId ?? "",
        r.originalWindow,
        r.status,
        r.modeledImpact,
        r.nextAction,
        r.revisedEtaMin === null ? "" : `T+${r.revisedEtaMin}m`,
        r.proposedSlotId ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function buildFacilityGeoJson(facilities: FacilityRow[]) {
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      properties: {
        id: f.id,
        name: f.name,
        kind: f.kind,
        dailyCapacity: f.dailyCapacity,
      },
    })),
  };
}

export function buildRouteGeoJson(result: ScenarioResult) {
  const features = result.shipments
    .filter((s) => s.status === "scheduled" && s.routeCoords.length > 1)
    .map((s) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: s.routeCoords },
      properties: {
        shipmentId: s.shipmentId,
        truckId: s.truckId,
        tripNumber: s.tripNumber,
        rerouted: s.rerouted,
        loadedMiles: s.loadedMiles,
        loadedMinutes: s.loadedMinutes,
        costUsd: s.costUsd,
        co2Kg: s.co2Kg,
        routeSource: result.routeSource,
        illustrative: true,
      },
    }));
  return { type: "FeatureCollection", features };
}

export function buildScenarioManifest(result: {
  baseline: ScenarioResult;
  revised: ScenarioResult;
}) {
  return {
    generatedAt: new Date().toISOString(),
    activeSettings: result.revised.settings,
    scenario: {
      label: result.revised.scenarioLabel,
      kind: result.revised.scenarioKind,
      closureSegmentId: result.revised.closureSegmentId,
      closureIsProxy: result.revised.closureIsProxy,
    },
    baselineMetrics: result.baseline.metrics,
    revisedMetrics: result.revised.metrics,
    unassignedReasons: result.revised.unassignedReasons,
    routeSource: result.revised.routeSource,
    assumptions: result.revised.assumptions,
  };
}
