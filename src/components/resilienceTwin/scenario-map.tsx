import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useIsScenarioRunning } from "@/hooks/useResilienceTwin";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  arcgisRequire,
  BASEMAP_SERVICE_URLS,
} from "@/lib/resilienceTwin/arcgisLoader";
import type {
  BasemapName,
  FacilityRow,
  ScenarioResult,
} from "@/lib/resilienceTwin/types";

interface ScenarioMapProps {
  facilities: FacilityRow[];
  result: ScenarioResult | null;
  basemap: BasemapName;
  showNormalOverlay: boolean;
  highlight?: RiskHighlight | null;
  onClearHighlight?: () => void;
}

export interface RiskHighlight {
  title: string;
  levels: Record<string, "miss" | "tight">;
}

const HIGHLIGHT_COLORS = { miss: "#dc2626", tight: "#f59e0b" } as const;

const PORT_COLOR = "#1e293b";
const WAREHOUSE_COLORS = [
  "#b45309",
  "#0f766e",
  "#6d28d9",
  "#be123c",
  "#1d4ed8",
];

function hashFraction(seed: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return min + ((h % 100) / 100) * (max - min);
}

function interpolateAlongLine(
  coords: [number, number][],
  fraction: number,
): [number, number] | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) return coords[0];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const d = Math.hypot(lon2 - lon1, lat2 - lat1);
    lengths.push(d);
    total += d;
  }
  if (total === 0) return coords[0];
  let target = fraction * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : target / lengths[i];
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      return [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t];
    }
    target -= lengths[i];
  }
  return coords.at(-1) ?? null;
}

export function ScenarioMap({
  facilities,
  result,
  basemap,
  showNormalOverlay,
  highlight = null,
  onClearHighlight,
}: ScenarioMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const graphicsLayerRef = useRef<any>(null);
  const modulesRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [showWarehouses, setShowWarehouses] = useState(true);
  const [showTrucks, setShowTrucks] = useState(true);
  const scenarioRunning = useIsScenarioRunning();

  // Initialize the view once. The basemap used here is only the initial
  // value — later changes are handled by the dedicated basemap-swap effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize-once effect, see comment above
  useEffect(() => {
    let cancelled = false;
    arcgisRequire<any[]>([
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/TileLayer",
      "esri/layers/GraphicsLayer",
      "esri/Basemap",
      "esri/Graphic",
    ])
      .then(
        ([EsriMap, MapView, TileLayer, GraphicsLayer, Basemap, Graphic]) => {
          if (cancelled || !containerRef.current) return;
          const graphicsLayer = new GraphicsLayer();
          const map = new EsriMap({
            basemap: new Basemap({
              baseLayers: [
                new TileLayer({ url: BASEMAP_SERVICE_URLS[basemap] }),
              ],
            }),
            layers: [graphicsLayer],
          });
          const view = new MapView({
            container: containerRef.current,
            map,
            center: [-117.95, 33.95],
            zoom: 9,
            ui: { components: ["zoom"] },
          });
          viewRef.current = view;
          graphicsLayerRef.current = graphicsLayer;
          modulesRef.current = {
            Map: EsriMap,
            MapView,
            TileLayer,
            GraphicsLayer,
            Basemap,
            Graphic,
          };
          view.when(
            () => !cancelled && setStatus("ready"),
            () => !cancelled && setStatus("error"),
          );
        },
      )
      .catch(() => !cancelled && setStatus("error"));
    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "loading" ? "error" : s));
    }, 30000);
    return () => {
      window.clearTimeout(timeout);
      cancelled = true;
      viewRef.current?.destroy?.();
      viewRef.current = null;
    };
  }, []);

  // Swap the basemap tile layer when the selection changes.
  useEffect(() => {
    if (status !== "ready" || !modulesRef.current || !viewRef.current) return;
    const { TileLayer, Basemap } = modulesRef.current;
    viewRef.current.map.basemap = new Basemap({
      baseLayers: [new TileLayer({ url: BASEMAP_SERVICE_URLS[basemap] })],
    });
  }, [basemap, status]);

  // Redraw graphics whenever the scenario result or toggles change.
  useEffect(() => {
    if (status !== "ready" || !graphicsLayerRef.current) return;
    const layer = graphicsLayerRef.current;
    layer.removeAll();
    const graphics: any[] = [];

    for (const f of facilities) {
      if (f.kind === "warehouse" && !showWarehouses) continue;
      const idx = facilities
        .filter((x) => x.kind === "warehouse")
        .findIndex((x) => x.id === f.id);
      const color =
        f.kind === "port"
          ? PORT_COLOR
          : WAREHOUSE_COLORS[idx % WAREHOUSE_COLORS.length];
      graphics.push({
        geometry: { type: "point", longitude: f.lon, latitude: f.lat },
        symbol:
          f.kind === "port"
            ? {
                type: "simple-marker",
                style: "diamond",
                size: 16,
                color,
                outline: { color: "white", width: 1.5 },
              }
            : {
                type: "simple-marker",
                style: "square",
                size: 13,
                color,
                outline: { color: "white", width: 1.5 },
              },
        attributes: {
          title: f.name,
          subtitle: f.kind === "port" ? "Port" : "Warehouse",
        },
        popupTemplate: { title: "{title}", content: "{subtitle}" },
      });
    }

    if (result) {
      if (
        result.closureSegmentGeometry &&
        result.closureSegmentGeometry.length > 1
      ) {
        graphics.push({
          geometry: {
            type: "polyline",
            paths: [result.closureSegmentGeometry],
          },
          symbol: {
            type: "simple-line",
            color: result.closureKind === "closed" ? "#dc2626" : "#f59e0b",
            width: 5,
            style: result.closureKind === "closed" ? "solid" : "short-dash",
          },
          attributes: {
            title:
              result.closureKind === "closed"
                ? "Simulated closure"
                : "Simulated slowdown",
          },
          popupTemplate: {
            title: "{title}",
            content: `Modeled corridor ${result.closureSegmentId ?? ""}${result.closureIsProxy ? " — labeled proxy, not a real street" : ""}`,
          },
        });
      }

      for (const shipment of result.shipments) {
        if (shipment.status !== "scheduled") continue;
        if (showNormalOverlay && shipment.normalRouteCoords.length > 1) {
          graphics.push({
            geometry: { type: "polyline", paths: [shipment.normalRouteCoords] },
            symbol: {
              type: "simple-line",
              color: "#94a3b8",
              width: 1.5,
              style: "dot",
            },
            attributes: {
              title: `${shipment.shipmentId} — normal route (comparison)`,
            },
          });
        }
        if (shipment.emptyRouteCoords.length > 1) {
          graphics.push({
            geometry: { type: "polyline", paths: [shipment.emptyRouteCoords] },
            symbol: {
              type: "simple-line",
              color: "#2563eb",
              width: 2,
              style: "dash",
            },
            attributes: {
              title: `${shipment.shipmentId} — empty repositioning`,
            },
          });
        }
        if (shipment.routeCoords.length > 1) {
          const risk = highlight?.levels[shipment.shipmentId];
          graphics.push({
            geometry: { type: "polyline", paths: [shipment.routeCoords] },
            symbol: {
              type: "simple-line",
              color: risk
                ? HIGHLIGHT_COLORS[risk]
                : shipment.rerouted
                  ? "#7c3aed"
                  : "#ea580c",
              width: risk ? 6 : 3,
            },
            attributes: {
              title: `${shipment.shipmentId} — ${risk ? (risk === "miss" ? "will miss window" : "at risk") : shipment.rerouted ? "rerouted" : "loaded route"}`,
            },
            popupTemplate: {
              title: `{title}`,
              content: `Truck ${shipment.truckId} · trip ${shipment.tripNumber} · ${shipment.routeNote}`,
            },
          });
          if (showTrucks) {
            const fraction = hashFraction(
              `${shipment.truckId}-${shipment.tripNumber}`,
              0.3,
              0.7,
            );
            const point = interpolateAlongLine(shipment.routeCoords, fraction);
            if (point) {
              graphics.push({
                geometry: {
                  type: "point",
                  longitude: point[0],
                  latitude: point[1],
                },
                symbol: {
                  type: "simple-marker",
                  style: "circle",
                  size: 10,
                  color: "#111827",
                  outline: { color: "#f8fafc", width: 1.5 },
                },
                attributes: {
                  title: `${shipment.truckId} — trip ${shipment.tripNumber}`,
                },
                popupTemplate: {
                  title: "{title}",
                  content: `Carrying ${shipment.shipmentId}, simulated position en route.`,
                },
              });
            }
          }
        }
      }
    }

    const Graphic = modulesRef.current.Graphic;
    for (const g of graphics) layer.add(new Graphic(g));
  }, [
    result,
    facilities,
    showWarehouses,
    showTrucks,
    showNormalOverlay,
    highlight,
    status,
  ]);

  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="toggle-warehouses"
              checked={showWarehouses}
              onCheckedChange={(v) => setShowWarehouses(Boolean(v))}
            />
            <Label
              htmlFor="toggle-warehouses"
              className="cursor-pointer font-normal"
            >
              Warehouses
            </Label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="toggle-trucks"
              checked={showTrucks}
              onCheckedChange={(v) => setShowTrucks(Boolean(v))}
            />
            <Label
              htmlFor="toggle-trucks"
              className="cursor-pointer font-normal"
            >
              Trucks
            </Label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 rounded bg-[#ea580c]" /> Loaded route
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 rounded bg-[#7c3aed]" /> Rerouted
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 rounded border border-dashed border-[#2563eb]" />{" "}
            Empty leg
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 rounded bg-[#dc2626]" /> Closure
          </span>
        </div>
      </div>
      <div className="relative h-[520px] w-full">
        {status === "loading" && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/40 p-6 text-center">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Could not load the ArcGIS Maps SDK from js.arcgis.com. This demo
              map needs outbound access to Esri's CDN and public basemap tile
              services.
            </p>
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
        {highlight && status === "ready" && (
          <div className="absolute left-3 top-3 z-10 flex max-w-[320px] flex-col gap-1.5 rounded-md border border-border bg-card/95 p-2.5 text-xs shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{highlight.title}</span>
              {onClearHighlight && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={onClearHighlight}
                >
                  Clear highlight
                </Button>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-4 rounded bg-[#dc2626]" /> Will miss window
              (
              {
                Object.values(highlight.levels).filter((l) => l === "miss")
                  .length
              }
              )
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-4 rounded bg-[#f59e0b]" /> At risk (
              {
                Object.values(highlight.levels).filter((l) => l === "tight")
                  .length
              }
              )
            </span>
          </div>
        )}
        {scenarioRunning && status !== "error" && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
          >
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              {result
                ? "Recalculating the plan and loading street routes…"
                : "Calculating the plan and loading street routes…"}
            </div>
          </div>
        )}
        {status === "ready" && (showWarehouses || showTrucks) && (
          <div className="pointer-events-none absolute bottom-6 left-3 z-10 max-w-[240px] rounded-md border border-border bg-card/95 p-2.5 text-xs shadow-sm">
            <p className="mb-1.5 font-medium">Legend</p>
            <ul className="space-y-1">
              {facilities
                .filter((f) => f.kind === "port")
                .map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rotate-45 border border-white"
                      style={{ backgroundColor: PORT_COLOR }}
                    />
                    {f.name}
                  </li>
                ))}
              {showWarehouses &&
                facilities
                  .filter((f) => f.kind === "warehouse")
                  .map((f, i) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 border border-white"
                        style={{
                          backgroundColor:
                            WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length],
                        }}
                      />
                      {f.name}
                    </li>
                  ))}
              {showTrucks && (
                <li className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full border border-white bg-[#111827]" />
                  Truck (simulated position en route)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      {result?.closureIsProxy && result.closureSegmentId && (
        <div className="border-t border-border bg-muted/40 px-3 py-1.5">
          <Badge
            variant="outline"
            className="text-xs font-normal text-muted-foreground"
          >
            Modeled corridor {result.closureSegmentId} is a labeled proxy, not
            the real street network — {result.routeSource}
          </Badge>
        </div>
      )}
    </div>
  );
}
