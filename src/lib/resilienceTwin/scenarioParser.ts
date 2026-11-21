// Translates a free-text scenario request into validated settings. Runs
// entirely client-side (no secrets) as the demo-mode fallback, and also
// validates/merges whatever JSON an AI connector returns before it is ever
// applied to the simulation.
import {
  BASEMAPS,
  HIGHWAY_SEGMENT_MAP,
  POLICIES,
  VALID_SEGMENT_IDS,
} from "./constants";
import { DEFAULT_SCENARIO_SETTINGS } from "./types";
import type {
  BasemapName,
  PolicyName,
  ScenarioName,
  ScenarioSettings,
} from "./types";

export const SCENARIO_NAMES: ScenarioName[] = [
  "Normal conditions",
  "Highway slowdown",
  "Road closure",
  "Delayed pickup",
  "Wildfire-related slowdown",
  "Flood-related slowdown",
];

export const SEVERITY_LIMITS = { min: 0, max: 240 };

export interface ParsedScenarioRequest {
  /** Settings to apply — null when the request needs clarification first. */
  settings: ScenarioSettings | null;
  /** What actually changed, for the "settings the assistant applied" readout. */
  updates: Partial<ScenarioSettings>;
  /** Set when the request could not be resolved and the user should be asked. */
  clarification: string | null;
}

interface RawUpdates {
  scenario?: ScenarioName | null;
  severity?: number | null;
  policy?: PolicyName | null;
  basemap?: BasemapName | null;
  dieselPrice?: number | null;
  showNormalOverlay?: boolean | null;
}

function resolveClosureTarget(prompt: string): {
  segment: string | null;
  location: string | null;
  askedUnmapped: string | null;
} {
  if (/\b(reopen|clear the closure|normal conditions)\b/i.test(prompt)) {
    return { segment: null, location: null, askedUnmapped: null };
  }
  const segmentMatch = prompt.match(/\bS-0(0[1-9]|1[0-3])\b/i);
  if (segmentMatch) {
    return {
      segment: segmentMatch[0].toUpperCase(),
      location: null,
      askedUnmapped: null,
    };
  }
  const highwayMatch = prompt.match(
    /\b(?:highway|freeway|state route|route|SR|I)\s*-?\s*(\d+)\b/i,
  );
  if (highwayMatch) {
    const number = highwayMatch[1];
    const segment = HIGHWAY_SEGMENT_MAP[number];
    if (!segment)
      return { segment: null, location: null, askedUnmapped: number };
    const eastLa = /\beast (?:la|los angeles)\b/i.test(prompt)
      ? " · East LA"
      : "";
    return {
      segment,
      location: `Highway ${number}${eastLa}`,
      askedUnmapped: null,
    };
  }
  return { segment: null, location: null, askedUnmapped: null };
}

/** Demo-mode (no AI connector) pattern-matching extraction. */
export function demoModeExtract(prompt: string): RawUpdates {
  const text = prompt.toLowerCase();
  const updates: RawUpdates = {};
  const scenarioPatterns: Array<[ScenarioName, RegExp]> = [
    // Negative lookahead avoids "show the normal routes for comparison"
    // (an overlay request, not a request to clear the active scenario).
    ["Normal conditions", /\b(normal\b(?!\s+routes?\b)|baseline)\b/],
    ["Road closure", /\b(closure|closed|close)\b/],
    ["Delayed pickup", /\bpickup\b/],
    ["Wildfire-related slowdown", /\bwildfire\b/],
    ["Flood-related slowdown", /\bflood\w*\b/],
    ["Highway slowdown", /\b(slowdown|traffic delay)\b/],
  ];
  for (const [scenario, pattern] of scenarioPatterns) {
    if (pattern.test(text)) {
      updates.scenario = scenario;
      break;
    }
  }
  const basemapPatterns: Array<[BasemapName, string]> = [
    ["satellite", "satellite"],
    ["topographic", "topographic"],
    ["gray", "light gray"],
    ["streets", "street map"],
    ["streets", "streets"],
  ];
  for (const [basemap, label] of basemapPatterns) {
    if (text.includes(label)) {
      updates.basemap = basemap;
      break;
    }
  }
  const normalizedText = text.replace("co₂", "co2");
  for (const policy of POLICIES) {
    if (normalizedText.includes(policy.toLowerCase())) {
      updates.policy = policy;
    }
  }
  const dieselMatch = text.match(
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:\/|\s*per\s*)\s*gal(?:lon)?/,
  );
  if (dieselMatch) updates.dieselPrice = Number(dieselMatch[1]);
  const severityMatch = text.match(
    /(\d+)\s*[- ]?\s*min(?:utes?)?\s*(?:delay|highway slowdown|slowdown)\b|\bdelay\s+(?:of\s+|to\s+)?(\d+)\s*min/,
  );
  if (severityMatch)
    updates.severity = Number(severityMatch[1] ?? severityMatch[2]);
  if (
    /\boverlay\b|\bcompar(e|ison)\b|\bnormal routes?\b/.test(text) &&
    /\bshow\b/.test(text)
  ) {
    updates.showNormalOverlay = true;
  }
  return updates;
}

/** Validate and clamp whatever JSON an AI connector returned. */
export function sanitizeAiUpdates(raw: unknown): RawUpdates {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const updates: RawUpdates = {};
  if (
    typeof obj.scenario === "string" &&
    SCENARIO_NAMES.includes(obj.scenario as ScenarioName)
  ) {
    updates.scenario = obj.scenario as ScenarioName;
  }
  if (
    typeof obj.policy === "string" &&
    POLICIES.includes(obj.policy as PolicyName)
  ) {
    updates.policy = obj.policy as PolicyName;
  }
  if (
    typeof obj.basemap === "string" &&
    BASEMAPS.includes(obj.basemap as BasemapName)
  ) {
    updates.basemap = obj.basemap as BasemapName;
  }
  if (typeof obj.severity === "number" && Number.isFinite(obj.severity))
    updates.severity = obj.severity;
  if (typeof obj.dieselPrice === "number" && Number.isFinite(obj.dieselPrice))
    updates.dieselPrice = obj.dieselPrice;
  if (typeof obj.showNormalOverlay === "boolean")
    updates.showNormalOverlay = obj.showNormalOverlay;
  return updates;
}

/**
 * Resolves a scenario chat request into settings. `aiUpdates`, when provided,
 * comes from the OpenAI-compatible connector and takes precedence over the
 * demo-mode regex extraction for any field it set.
 */
export function interpretScenarioRequest(
  prompt: string,
  current: ScenarioSettings,
  aiUpdates?: RawUpdates,
): ParsedScenarioRequest {
  if (!prompt.trim()) {
    return {
      settings: null,
      updates: {},
      clarification: "Describe the scenario or map change first.",
    };
  }
  const closure = resolveClosureTarget(prompt);
  if (closure.askedUnmapped) {
    return {
      settings: null,
      updates: {},
      clarification: `This demo's modeled road graph has no mapped corridor for Highway ${closure.askedUnmapped}. Tell me the highway segment, direction, or nearby interchange — for example "Highway 60" or segment "S-005" — and I'll apply it.`,
    };
  }
  const reopening = /\b(reopen|clear the closure)\b/i.test(prompt);
  const demo = demoModeExtract(prompt);
  const merged: RawUpdates = { ...demo, ...(aiUpdates ?? {}) };
  if (reopening) merged.scenario = "Normal conditions";
  else if (closure.segment) merged.scenario = "Road closure";

  const updates: Partial<ScenarioSettings> = {};
  if (merged.scenario) updates.scenario = merged.scenario;
  if (merged.policy) updates.policy = merged.policy;
  if (merged.basemap) updates.basemap = merged.basemap;
  if (merged.dieselPrice !== undefined && merged.dieselPrice !== null) {
    updates.dieselPrice = clamp(merged.dieselPrice, 0.5, 12);
  }
  if (merged.severity !== undefined && merged.severity !== null) {
    updates.severity = clamp(
      merged.severity,
      SEVERITY_LIMITS.min,
      SEVERITY_LIMITS.max,
    );
  }
  if (
    merged.showNormalOverlay !== undefined &&
    merged.showNormalOverlay !== null
  ) {
    updates.showNormalOverlay = merged.showNormalOverlay;
  }

  if (Object.keys(updates).length === 0 && !closure.segment) {
    return {
      settings: null,
      updates: {},
      clarification:
        'I didn\'t find a supported scenario change in that message. Try something like "close Highway 60", "switch to lowest cost", "set diesel to $6.50 per gallon", or "reopen the road".',
    };
  }

  const settings: ScenarioSettings = {
    ...DEFAULT_SCENARIO_SETTINGS,
    ...current,
    ...updates,
  };
  if (settings.scenario === "Normal conditions") {
    settings.severity = 0;
  } else if (
    updates.scenario &&
    updates.scenario !== current.scenario &&
    updates.severity === undefined
  ) {
    settings.severity = settings.scenario === "Highway slowdown" ? 75 : 90;
  }
  if (settings.scenario === "Road closure") {
    settings.closureSegment =
      closure.segment ??
      (current.scenario === "Road closure" ? current.closureSegment : null);
    settings.closureLocation =
      closure.location ??
      (current.scenario === "Road closure" ? current.closureLocation : null);
  } else {
    settings.closureSegment = null;
    settings.closureLocation = null;
  }
  return { settings, updates, clarification: null };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Defensive server-side reconstruction of untrusted scenario settings input. */
export function coerceScenarioSettings(input: unknown): ScenarioSettings {
  const obj = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const scenario =
    typeof obj.scenario === "string" &&
    SCENARIO_NAMES.includes(obj.scenario as ScenarioName)
      ? (obj.scenario as ScenarioName)
      : DEFAULT_SCENARIO_SETTINGS.scenario;
  const policy =
    typeof obj.policy === "string" &&
    POLICIES.includes(obj.policy as PolicyName)
      ? (obj.policy as PolicyName)
      : DEFAULT_SCENARIO_SETTINGS.policy;
  const basemap =
    typeof obj.basemap === "string" &&
    BASEMAPS.includes(obj.basemap as BasemapName)
      ? (obj.basemap as BasemapName)
      : DEFAULT_SCENARIO_SETTINGS.basemap;
  const severity =
    typeof obj.severity === "number" && Number.isFinite(obj.severity)
      ? clamp(obj.severity, SEVERITY_LIMITS.min, SEVERITY_LIMITS.max)
      : scenario === "Normal conditions"
        ? 0
        : DEFAULT_SCENARIO_SETTINGS.severity;
  const dieselPrice =
    typeof obj.dieselPrice === "number" && Number.isFinite(obj.dieselPrice)
      ? clamp(obj.dieselPrice, 0.5, 12)
      : DEFAULT_SCENARIO_SETTINGS.dieselPrice;
  const closureSegment =
    scenario === "Road closure" &&
    typeof obj.closureSegment === "string" &&
    VALID_SEGMENT_IDS.includes(obj.closureSegment)
      ? obj.closureSegment
      : null;
  const closureLocation =
    scenario === "Road closure" && typeof obj.closureLocation === "string"
      ? obj.closureLocation
      : null;
  const showNormalOverlay =
    typeof obj.showNormalOverlay === "boolean" ? obj.showNormalOverlay : false;
  return {
    scenario,
    severity,
    policy,
    dieselPrice,
    basemap,
    closureSegment,
    closureLocation,
    showNormalOverlay,
  };
}

export { VALID_SEGMENT_IDS };
