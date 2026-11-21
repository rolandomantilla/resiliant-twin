// Deterministic, template-based reply composition for the Scenario Assistant.
// The AI connector (or demo-mode regex parser) only ever extracts SETTINGS;
// the actual explanation of results always comes from the computed scenario
// so shipment IDs, costs and ETAs in the chat are never invented by a model.
import type {
  FacilityRow,
  ScenarioResult,
  ScenarioSettings,
  ShipmentPlan,
} from "./types";

export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  return `T+${min}m`;
}

function formatDelta(
  revised: number,
  baseline: number,
  unit: "usd" | "co2" | "count",
): string {
  const delta = Math.round((revised - baseline) * 100) / 100;
  if (delta === 0) return "no change vs. baseline";
  const sign = delta > 0 ? "+" : "\u2212";
  const abs = Math.abs(delta);
  if (unit === "usd") return `${sign}$${abs.toLocaleString()}`;
  if (unit === "co2") return `${sign}${abs.toLocaleString()} kg CO\u2082`;
  return `${sign}${abs.toLocaleString()} shipments`;
}

export function describeSettings(
  settings: ScenarioSettings,
  roadNameBySegment: Record<string, string>,
): string {
  const parts = [`scenario "${settings.scenario}"`];
  if (settings.scenario !== "Normal conditions")
    parts.push(`${settings.severity} min modeled delay`);
  parts.push(`${settings.policy} preference`);
  parts.push(`diesel at $${settings.dieselPrice.toFixed(2)}/gal`);
  parts.push(`${settings.basemap} basemap`);
  if (settings.closureSegment) {
    const roadName =
      roadNameBySegment[settings.closureSegment] ?? settings.closureSegment;
    const proxy = settings.closureLocation
      ? ` — a modeled proxy for ${settings.closureLocation}`
      : "";
    parts.push(
      `closure on modeled corridor ${settings.closureSegment} (${roadName})${proxy}`,
    );
  }
  if (settings.showNormalOverlay) parts.push("normal-route overlay on");
  return parts.join(", ");
}

export function composeScenarioReply(
  result: { baseline: ScenarioResult; revised: ScenarioResult },
  roadNameBySegment: Record<string, string>,
): string {
  const { baseline, revised } = result;
  const lines: string[] = [];
  lines.push(
    `Applied: ${describeSettings(revised.settings, roadNameBySegment)}.`,
  );
  lines.push(
    `Scheduled ${revised.metrics.scheduled}/${revised.metrics.shipments} shipments (${formatDelta(revised.metrics.scheduled, baseline.metrics.scheduled, "count")}), ` +
      `${revised.metrics.criticalScheduled} critical served, modeled cost $${revised.metrics.scheduledCostUsd.toLocaleString()} (${formatDelta(revised.metrics.scheduledCostUsd, baseline.metrics.scheduledCostUsd, "usd")}), ` +
      `CO\u2082 ${revised.metrics.scheduledCo2Kg.toLocaleString()} kg (${formatDelta(revised.metrics.scheduledCo2Kg, baseline.metrics.scheduledCo2Kg, "co2")}).`,
  );
  const rerouted = revised.shipments.filter(
    (s) => s.rerouted && s.status === "scheduled",
  );
  if (rerouted.length > 0) {
    const sample = rerouted
      .slice(0, 4)
      .map((s) => s.shipmentId)
      .join(", ");
    lines.push(
      `Rerouted around the modeled disruption: ${sample}${rerouted.length > 4 ? ` (+${rerouted.length - 4} more)` : ""}.`,
    );
  }
  const recovered = revised.shipments.filter(
    (s) => s.recovery?.status === "proposed",
  );
  if (recovered.length > 0) {
    const sample = recovered
      .slice(0, 4)
      .map(
        (s) => `${s.shipmentId} (${formatMinutes(s.recovery?.receivingMin)})`,
      )
      .join(", ");
    lines.push(
      `Proposed recovery slots awaiting warehouse confirmation: ${sample}.`,
    );
  }
  if (revised.metrics.unassigned > 0 && recovered.length === 0) {
    lines.push(
      `${revised.metrics.unassigned} shipments remain unassigned this run; see the Exceptions & Recovery tab for details.`,
    );
  }
  if (revised.closureIsProxy && revised.closureSegmentId) {
    const roadName =
      roadNameBySegment[revised.closureSegmentId] ?? revised.closureSegmentId;
    lines.push(
      `Note: this demo models ${revised.closureSegmentId} (${roadName}) as the affected corridor — a labeled proxy, not the real street network.`,
    );
  }
  return lines.join(" ");
}

export function composeEtaAnswer(revised: ScenarioResult): string {
  const late = revised.shipments.filter(
    (s) =>
      s.status === "scheduled" &&
      s.receivingMin !== null &&
      s.receivingMin > s.appointmentEndMin,
  );
  const recoveredProposed = revised.shipments.filter(
    (s) => s.recovery?.status === "proposed",
  );
  const recoveredNone = revised.shipments.filter(
    (s) => s.recovery?.status === "none_feasible",
  );

  if (
    late.length === 0 &&
    recoveredProposed.length === 0 &&
    recoveredNone.length === 0
  ) {
    return "No shipments need a revised ETA in the current run — every scheduled shipment is on its original appointment window.";
  }
  const lines: string[] = [];
  if (late.length > 0) {
    lines.push(
      `Scheduled shipments arriving after their original appointment window: ${late
        .slice(0, 6)
        .map(
          (s) =>
            `${s.shipmentId} (arrives ${formatMinutes(s.receivingMin)} vs. window end ${formatMinutes(s.appointmentEndMin)})`,
        )
        .join("; ")}${late.length > 6 ? `, +${late.length - 6} more` : ""}.`,
    );
  }
  if (recoveredProposed.length > 0) {
    lines.push(
      `Unassigned shipments with a proposed revised ETA (awaiting warehouse confirmation): ${recoveredProposed
        .slice(0, 6)
        .map(
          (s) =>
            `${s.shipmentId} (${formatMinutes(s.recovery?.receivingMin)}, slot ${s.recovery?.slotId})`,
        )
        .join(
          "; ",
        )}${recoveredProposed.length > 6 ? `, +${recoveredProposed.length - 6} more` : ""}.`,
    );
  }
  if (recoveredNone.length > 0) {
    lines.push(
      `Unassigned shipments with no feasible revised ETA this run: ${recoveredNone
        .slice(0, 6)
        .map((s) => s.shipmentId)
        .join(
          ", ",
        )}${recoveredNone.length > 6 ? `, +${recoveredNone.length - 6} more` : ""}.`,
    );
  }
  return lines.join(" ");
}

export const ETA_QUERY_PATTERN =
  /\brevised eta\b|\bneed(?:s)? (?:a )?(?:revised )?eta\b|\beta change\b/i;

// "Truck 5 broke down and will take 3 hours to fix — which shipments are in danger?"
// ---------------------------------------------------------------------------
// Disruption risk: truck breakdowns, port delays, port closures
// ---------------------------------------------------------------------------

const AT_RISK_BUFFER_MIN = 30;

export type RiskLevel = "miss" | "tight" | "ok";

export interface RiskItem {
  shipmentId: string;
  priority: ShipmentPlan["priority"];
  truckId: string | null;
  level: RiskLevel;
  newReceivingMin: number;
  appointmentEndMin: number;
  slackMin: number;
}

export interface RiskAnalysis {
  title: string;
  /** Trucks that cannot take over the endangered work (e.g. the broken one). */
  excludedTruckIds: string[];
  /** Pickup port override for reassignment (port closure → alternate port). */
  pickupOverride: Record<string, string>;
  /** Extra minutes any replacement still suffers (e.g. a port delay). */
  extraDelayMin: number;
  items: RiskItem[];
}

export interface RiskAnswer {
  text: string;
  analysis: RiskAnalysis | null;
}

function assess(s: ShipmentPlan, newReceivingMin: number): RiskItem {
  const slackMin = s.appointmentEndMin - newReceivingMin;
  return {
    shipmentId: s.shipmentId,
    priority: s.priority,
    truckId: s.truckId,
    level:
      slackMin < 0 ? "miss" : slackMin <= AT_RISK_BUFFER_MIN ? "tight" : "ok",
    newReceivingMin,
    appointmentEndMin: s.appointmentEndMin,
    slackMin,
  };
}

function summarizeRisk(scope: string, items: RiskItem[]): string {
  const describe = (a: RiskItem) =>
    `${a.shipmentId} [${a.priority}]${a.truckId ? ` ${a.truckId}` : ""} new arrival ${formatMinutes(a.newReceivingMin)} vs. window end ${formatMinutes(a.appointmentEndMin)}${a.slackMin < 0 ? ` — ${-a.slackMin} min late` : ` — ${a.slackMin} min to spare`}`;
  const miss = items.filter((a) => a.level === "miss");
  const tight = items.filter((a) => a.level === "tight");
  const ok = items.filter((a) => a.level === "ok");
  const lines = [`${scope}: ${items.length} scheduled shipment(s) affected.`];
  if (miss.length)
    lines.push(
      `Will miss their appointment window: ${miss.map(describe).join("; ")}.`,
    );
  if (tight.length)
    lines.push(
      `At risk (within ${AT_RISK_BUFFER_MIN} min of the window end): ${tight.map(describe).join("; ")}.`,
    );
  if (ok.length)
    lines.push(`Still on time: ${ok.map((a) => a.shipmentId).join(", ")}.`);
  if (miss.length + tight.length === 0)
    lines.push("None of these shipments are in danger.");
  return lines.join(" ");
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  eight: 8,
  twelve: 12,
};

export function parseDurationMin(prompt: string): number {
  let total = 0;
  const hours = prompt.match(
    /(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|eight|twelve)\s*(?:hours?|hrs?|h)\b/i,
  );
  if (hours) {
    const raw = hours[1].toLowerCase();
    total += Math.round((NUMBER_WORDS[raw] ?? Number(raw)) * 60);
  }
  const mins = prompt.match(/(?<!T\+)\b(\d+)\s*(?:minutes?|mins?)\b/i);
  if (mins) total += Number(mins[1]);
  if (/half an hour/i.test(prompt)) total += 30;
  return total;
}

// "Truck 5 broke down and will take 3 hours to fix — which shipments are in danger?"
export const BREAKDOWN_QUERY_PATTERN =
  /\btruck\b[\s\S]*\b(?:broke|breaks?|broken|breakdown|down|failed|failure|repair|fix|stuck|out of service)\b/i;

export interface BreakdownQuery {
  truckId: string;
  delayMin: number;
  atMin: number | null;
}

export function parseBreakdownQuery(prompt: string): BreakdownQuery | null {
  const truck = prompt.match(/\btruck[\s#-]*(?:no\.?|number)?\s*#?\s*(\d+)/i);
  if (!truck) return null;
  const at = prompt.match(/\bat\s*T\+(\d+)/i);
  return {
    truckId: `TRUCK-${truck[1].padStart(2, "0")}`,
    delayMin: parseDurationMin(prompt),
    atMin: at ? Number(at[1]) : null,
  };
}

export function composeBreakdownAnswer(
  revised: ScenarioResult,
  query: BreakdownQuery,
): RiskAnswer {
  const { truckId, delayMin, atMin } = query;
  if (delayMin <= 0)
    return {
      text: `How long will ${truckId} be out of service? For example: "${truckId} broke down and will take 3 hours to fix."`,
      analysis: null,
    };
  const trips = revised.shipments
    .filter((s) => s.status === "scheduled" && s.truckId === truckId)
    .filter((s) => atMin === null || (s.completeMin ?? 0) > atMin)
    .sort((a, b) => (a.departureMin ?? 0) - (b.departureMin ?? 0));
  const scope = `${truckId} down for ${delayMin} min${atMin !== null ? ` starting ${formatMinutes(atMin)}` : ""} (current scenario: ${revised.settings.scenario})`;
  if (trips.length === 0)
    return {
      text: `${scope}: no scheduled shipments on this truck${atMin !== null ? " after that time" : ""} in the current run, so nothing is at risk.`,
      analysis: null,
    };
  // The repair delay cascades through every remaining trip on the same truck.
  const items = trips.map((s) => assess(s, (s.receivingMin ?? 0) + delayMin));
  return {
    text: summarizeRisk(scope, items),
    analysis: {
      title: `${truckId} breakdown (${delayMin} min)`,
      excludedTruckIds: [truckId],
      pickupOverride: {},
      extraDelayMin: 0,
      items,
    },
  };
}

export const PORT_QUERY_PATTERN =
  /\bports?\b[\s\S]*\b(?:delay|delayed|congest|backlog|slow|clos|shut|moved?|divert|redirect)|\b(?:delay|delayed|congest|backlog|clos|shut)[\s\S]*\bports?\b/i;

export interface PortQuery {
  kind: "delay" | "closure";
  portId: string | null;
  alternatePortId: string | null;
  delayMin: number;
}

function findPortMentions(prompt: string, ports: FacilityRow[]): string[] {
  const aliases: Record<string, RegExp> = {
    "PORT-LB": /\blong beach\b|\bport[\s-]*lb\b|\blb\b/gi,
    "PORT-LA": /\blos angeles\b|\bport[\s-]*la\b|\bport of la\b|\bla\b/gi,
  };
  const hits: { id: string; index: number }[] = [];
  for (const port of ports) {
    const re =
      aliases[port.id] ??
      new RegExp(`\\b${port.name.replace(/[^a-z0-9 ]/gi, "")}\\b`, "gi");
    for (const m of prompt.matchAll(re))
      hits.push({ id: port.id, index: m.index ?? 0 });
  }
  return [...new Set(hits.sort((a, b) => a.index - b.index).map((h) => h.id))];
}

export function parsePortQuery(
  prompt: string,
  facilities: FacilityRow[],
): PortQuery {
  const ports = facilities.filter((f) => f.kind === "port");
  // "East LA" in a highway phrase is a neighborhood, not the Port of LA.
  const mentions = findPortMentions(
    prompt.replace(/\b(?:east|west|north|south)\s+la\b/gi, ""),
    ports,
  );
  const kind =
    /\b(?:clos|shut|moved?|divert|redirect)\w*[\s\S]*\bport|\bport[\s\S]*\b(?:clos|shut|moved?|divert|redirect)/i.test(
      prompt,
    )
      ? "closure"
      : "delay";
  const portId = mentions[0] ?? (ports.length === 1 ? ports[0].id : null);
  let alternatePortId = mentions.find((id) => id !== portId) ?? null;
  if (kind === "closure" && !alternatePortId) {
    const others = ports.filter((p) => p.id !== portId);
    if (others.length === 1) alternatePortId = others[0].id;
  }
  return { kind, portId, alternatePortId, delayMin: parseDurationMin(prompt) };
}

// Straight-line miles × road factor at an average drayage speed; a labeled
// estimate, since the road graph only models the current port→warehouse legs.
export function estimateDriveMin(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
  return (miles / 35) * 60;
}

export function composePortAnswer(
  revised: ScenarioResult,
  query: PortQuery,
  facilities: FacilityRow[],
): RiskAnswer {
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const ports = facilities.filter((f) => f.kind === "port");
  const portList = ports.map((p) => `${p.name} (${p.id})`).join(", ");
  const ask = (text: string): RiskAnswer => ({ text, analysis: null });
  if (!query.portId)
    return ask(`Which port do you mean? Available ports: ${portList}.`);
  const port = byId.get(query.portId)!;
  const fromPort = revised.shipments.filter(
    (s) => s.status === "scheduled" && s.originId === query.portId,
  );
  const unassignedHere = revised.shipments.filter(
    (s) => s.status === "unassigned" && s.originId === query.portId,
  ).length;
  const unassignedNote = unassignedHere
    ? ` (${unassignedHere} shipment(s) from this port were already unassigned in this run.)`
    : "";

  if (query.kind === "delay") {
    if (query.delayMin <= 0)
      return ask(
        `How long is the delay at ${port.name}? For example: "${port.name} has a 4 hour delay."`,
      );
    if (fromPort.length === 0)
      return ask(
        `No scheduled shipments leave ${port.name} in the current run, so a delay there puts nothing at risk.${unassignedNote}`,
      );
    // A port delay pushes back pickup, and with it every later trip on the same truck.
    const firstHit = new Map<string, number>();
    for (const s of fromPort) {
      const prev = firstHit.get(s.truckId!);
      if (prev === undefined || (s.departureMin ?? 0) < prev)
        firstHit.set(s.truckId!, s.departureMin ?? 0);
    }
    const affected = revised.shipments.filter(
      (s) =>
        s.status === "scheduled" &&
        s.truckId &&
        firstHit.has(s.truckId) &&
        (s.departureMin ?? 0) >= firstHit.get(s.truckId)!,
    );
    const items = affected.map((s) =>
      assess(s, (s.receivingMin ?? 0) + query.delayMin),
    );
    const knockOn = affected.length - fromPort.length;
    return {
      text:
        summarizeRisk(
          `${port.name} delayed ${query.delayMin} min (current scenario: ${revised.settings.scenario})`,
          items,
        ) +
        (knockOn > 0
          ? ` Includes ${knockOn} knock-on shipment(s) from other origins carried later by the same trucks.`
          : "") +
        unassignedNote,
      analysis: {
        title: `${port.name} delay (${query.delayMin} min)`,
        excludedTruckIds: [],
        pickupOverride: {},
        extraDelayMin: 0,
        items,
      },
    };
  }

  if (!query.alternatePortId || query.alternatePortId === query.portId)
    return ask(
      `Which port should ${port.name}'s volume move to? Available ports: ${portList}.`,
    );
  const alt = byId.get(query.alternatePortId)!;
  if (fromPort.length === 0)
    return ask(
      `No scheduled shipments leave ${port.name} in the current run, so closing it moves nothing to ${alt.name}.${unassignedNote}`,
    );
  const items = fromPort.map((s) => {
    const dest = byId.get(s.destinationId);
    const extra = dest
      ? Math.max(
          0,
          Math.round(
            estimateDriveMin(alt, dest) - estimateDriveMin(port, dest),
          ),
        )
      : 0;
    return assess(s, (s.receivingMin ?? 0) + extra + query.delayMin);
  });
  const altLoad = revised.shipments.filter(
    (s) => s.status === "scheduled" && s.originId === alt.id,
  ).length;
  const totalAtAlt = altLoad + fromPort.length;
  const capacityNote =
    alt.dailyCapacity > 0
      ? totalAtAlt > alt.dailyCapacity
        ? ` Capacity warning: ${alt.name} would handle ${totalAtAlt} pickups vs. a daily capacity of ${alt.dailyCapacity} — ${totalAtAlt - alt.dailyCapacity} over.`
        : ` ${alt.name} can absorb it: ${totalAtAlt} pickups vs. daily capacity ${alt.dailyCapacity}.`
      : "";
  return {
    text:
      summarizeRisk(
        `${port.name} closed, ${fromPort.length} shipment(s) moved to ${alt.name}${query.delayMin ? ` with ${query.delayMin} min extra handling` : ""} (current scenario: ${revised.settings.scenario})`,
        items,
      ) +
      capacityNote +
      " Extra drive time from the new port is a straight-line estimate, not a routed path." +
      unassignedNote,
    analysis: {
      title: `${port.name} closure → ${alt.name}`,
      excludedTruckIds: [],
      pickupOverride: Object.fromEntries(
        fromPort.map((s) => [s.shipmentId, alt.id]),
      ),
      extraDelayMin: query.delayMin,
      items,
    },
  };
}

// ---------------------------------------------------------------------------
// Replacement-truck suggestions for endangered shipments
// ---------------------------------------------------------------------------

export interface FleetTruck {
  id: string;
  capacityTeu: number;
  mpgAssumed?: number;
  status: "available" | "maintenance";
  availableFromMin: number;
  basePortId: string | null;
  driver: { id: string; shiftEndMin: number } | null;
}

export interface ReplacementSuggestion {
  shipmentId: string;
  truckId: string | null;
  driverId: string | null;
  receivingMin: number | null;
  meetsWindow: boolean;
  note: string;
}

export function suggestReplacements(
  revised: ScenarioResult,
  analysis: RiskAnalysis,
  fleet: FleetTruck[],
  facilities: FacilityRow[],
  teuByShipment: Record<string, number>,
): ReplacementSuggestion[] {
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const endangered = analysis.items.filter((i) => i.level !== "ok");
  const planById = new Map(revised.shipments.map((s) => [s.shipmentId, s]));
  const endangeredIds = new Set(endangered.map((i) => i.shipmentId));

  // Where each truck ends up and when it is free, ignoring endangered work
  // that would be handed off.
  const freeAt = new Map<string, { min: number; at: string | null }>();
  for (const t of fleet)
    freeAt.set(t.id, { min: t.availableFromMin, at: t.basePortId });
  for (const s of revised.shipments) {
    if (
      s.status !== "scheduled" ||
      !s.truckId ||
      endangeredIds.has(s.shipmentId)
    )
      continue;
    const cur = freeAt.get(s.truckId);
    if (cur && (s.completeMin ?? 0) > cur.min)
      freeAt.set(s.truckId, { min: s.completeMin ?? 0, at: s.destinationId });
  }

  const ordered = [...endangered].sort(
    (a, b) =>
      ["critical", "high", "routine"].indexOf(a.priority) -
        ["critical", "high", "routine"].indexOf(b.priority) ||
      a.appointmentEndMin - b.appointmentEndMin,
  );

  return ordered.map((item) => {
    const plan = planById.get(item.shipmentId)!;
    const pickupId = analysis.pickupOverride[item.shipmentId] ?? plan.originId;
    const pickup = byId.get(pickupId);
    const dest = byId.get(plan.destinationId);
    const teu = teuByShipment[item.shipmentId] ?? 1;
    let best: (ReplacementSuggestion & { completeMin: number }) | null = null;
    for (const t of fleet) {
      if (
        t.status !== "available" ||
        analysis.excludedTruckIds.includes(t.id) ||
        t.id === plan.truckId ||
        t.capacityTeu < teu ||
        !pickup ||
        !dest
      )
        continue;
      const free = freeAt.get(t.id)!;
      const from = free.at ? byId.get(free.at) : undefined;
      const reposition = from ? estimateDriveMin(from, pickup) : 0;
      const loaded =
        analysis.pickupOverride[item.shipmentId] || !plan.loadedMinutes
          ? estimateDriveMin(pickup, dest)
          : plan.loadedMinutes;
      const arrival = Math.round(
        free.min + reposition + loaded + analysis.extraDelayMin,
      );
      const receiving = Math.max(arrival, plan.appointmentStartMin);
      const completeMin = receiving + 30;
      if (t.driver && completeMin > t.driver.shiftEndMin) continue;
      if (!best || receiving < (best.receivingMin ?? Infinity))
        best = {
          shipmentId: item.shipmentId,
          truckId: t.id,
          driverId: t.driver?.id ?? null,
          receivingMin: receiving,
          meetsWindow: receiving <= plan.appointmentEndMin,
          note: "",
          completeMin,
        };
    }
    if (!best)
      return {
        shipmentId: item.shipmentId,
        truckId: null,
        driverId: null,
        receivingMin: null,
        meetsWindow: false,
        note: "No other truck has the capacity and driver hours to take it.",
      };
    // Book the chosen truck so the next suggestion sees it as busy.
    freeAt.set(best.truckId!, {
      min: best.completeMin,
      at: plan.destinationId,
    });
    const { completeMin: _c, ...rest } = best;
    return rest;
  });
}

export function composeReplacementText(
  suggestions: ReplacementSuggestion[],
  analysis: RiskAnalysis,
): string {
  if (suggestions.length === 0) return "";
  const byShipment = new Map(analysis.items.map((i) => [i.shipmentId, i]));
  const parts = suggestions.map((s) => {
    const item = byShipment.get(s.shipmentId)!;
    if (!s.truckId) return `${s.shipmentId}: ${s.note}`;
    const better = s.receivingMin! < item.newReceivingMin;
    return `${s.shipmentId} → ${s.truckId}${s.driverId ? ` (${s.driverId})` : ""}, arrives ${formatMinutes(s.receivingMin)} — ${s.meetsWindow ? "makes the window" : `still ${s.receivingMin! - item.appointmentEndMin} min late`}${better ? "" : " (no faster than waiting)"}`;
  });
  return ` Suggested reassignments: ${parts.join("; ")}. Times are estimates from straight-line distances and current truck schedules.`;
}
