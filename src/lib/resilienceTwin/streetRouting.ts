// Enriches the engine's synthetic-graph route geometry with real street
// geometry so the map draws actual roads instead of straight schematic
// connectors. Scheduling math (minutes/miles/cost/CO2 and closure handling)
// still comes entirely from the synthetic graph in engine.ts — only the
// drawn polyline is replaced here. No ArcGIS Routing credential is configured
// in this workspace, so this uses OSRM's free public routing service (no API
// key) with a standard driving profile; it carries no freight restrictions
// (truck height/weight/hazmat), which is why every route stays labeled
// "illustrative" in the UI.
import type { ScenarioResult } from "./types";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";
const CONCURRENCY = 6;

export const STREET_ROUTE_SOURCE_LABEL =
  "Real street geometry via OSRM (public driving profile, no freight restrictions) — ArcGIS basemap for context. " +
  "Turn sequence and closure handling still follow the bundled synthetic road-segment model, not live traffic data.";

async function fetchStreetGeometry(
  waypoints: [number, number][],
): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;
  try {
    const coordStr = waypoints
      .map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`)
      .join(";");
    const res = await fetch(
      `${OSRM_BASE}${coordStr}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    const geom = json?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(geom) && geom.length > 1
      ? (geom as [number, number][])
      : null;
  } catch {
    return null; // keep the synthetic-graph geometry if OSRM is unreachable
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

function coordKey(coords: [number, number][]) {
  return coords
    .map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`)
    .join(";");
}

/** Replaces synthetic-graph polylines with real street geometry wherever OSRM resolves one. */
export async function enrichRouteGeometry(
  result: ScenarioResult,
): Promise<ScenarioResult> {
  const unique = new Map<string, [number, number][]>();
  const collect = (coords: [number, number][]) => {
    if (coords.length > 1) unique.set(coordKey(coords), coords);
  };
  for (const s of result.shipments) {
    collect(s.routeCoords);
    collect(s.emptyRouteCoords);
    collect(s.normalRouteCoords);
  }
  if (result.closureSegmentGeometry) collect(result.closureSegmentGeometry);

  const keys = [...unique.keys()];
  const fetched = await mapWithConcurrency(keys, CONCURRENCY, (key) =>
    fetchStreetGeometry(unique.get(key)!),
  );
  const resolved = new Map<string, [number, number][]>();
  keys.forEach((key, i) => {
    if (fetched[i]) resolved.set(key, fetched[i]!);
  });

  const swap = (coords: [number, number][]) =>
    coords.length > 1 ? (resolved.get(coordKey(coords)) ?? coords) : coords;

  const shipments = result.shipments.map((s) => ({
    ...s,
    routeCoords: swap(s.routeCoords),
    emptyRouteCoords: swap(s.emptyRouteCoords),
    normalRouteCoords: swap(s.normalRouteCoords),
  }));
  const closureSegmentGeometry = result.closureSegmentGeometry
    ? swap(result.closureSegmentGeometry)
    : null;
  const anyResolved = resolved.size > 0;

  return {
    ...result,
    shipments,
    closureSegmentGeometry,
    routeSource: anyResolved ? STREET_ROUTE_SOURCE_LABEL : result.routeSource,
  };
}
