import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Database, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExceptionsTable } from "@/components/resilienceTwin/exceptions-table";
import { ExportMenu } from "@/components/resilienceTwin/export-menu";
import { KpiCards } from "@/components/resilienceTwin/kpi-cards";
import { OutreachPanel } from "@/components/resilienceTwin/outreach-panel";
import { ScenarioAssistant } from "@/components/resilienceTwin/scenario-assistant";
import { ScenarioControls } from "@/components/resilienceTwin/scenario-controls";
import {
  type RiskHighlight,
  ScenarioMap,
} from "@/components/resilienceTwin/scenario-map";
import { ShipmentTable } from "@/components/resilienceTwin/shipment-table";
import { SidebarSlot } from "@/components/layout/sidebar-slot";
import { ApprovalLog } from "@/components/resilienceTwin/approval-log";
import { ApprovalsPanel } from "@/components/resilienceTwin/approvals-panel";
import { Badge } from "@/components/ui/badge";
import { useGetUser } from "@/hooks/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useRouteApprovals } from "@/hooks/useRouteApprovals";
import {
  applyRejections,
  buildReviewItems,
  scenarioLabel,
} from "@/lib/resilienceTwin/approvals";
import {
  useFacilities,
  useResetDemoData,
  useRoadSegments,
  useRunScenario,
  useScenarioSettingsState,
  useShipmentsMaster,
  type ScenarioComparison,
} from "@/hooks/useResilienceTwin";
import { mergeShipmentRows } from "@/lib/resilienceTwin/mergeShipmentRows";
import { DEFAULT_SCENARIO_SETTINGS } from "@/lib/resilienceTwin/types";
import type { ScenarioSettings } from "@/lib/resilienceTwin/types";

export const Route = createFileRoute("/_protected/")({
  component: DashboardPage,
});

const RECOMPUTE_KEYS: (keyof ScenarioSettings)[] = [
  "scenario",
  "severity",
  "policy",
  "dieselPrice",
  "closureSegment",
  "closureLocation",
];

function DashboardPage() {
  const { data: caps, isLoading: capsLoading } = useCapabilities();
  const dbEnabled = caps?.databaseEnabled === true;

  const { data: facilities, isLoading: facilitiesLoading } =
    useFacilities(dbEnabled);
  const { data: roadSegments } = useRoadSegments(dbEnabled);
  const { data: shipmentsMaster, isLoading: shipmentsLoading } =
    useShipmentsMaster(dbEnabled);
  const [settings, setSettings] = useScenarioSettingsState();
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [highlight, setHighlight] = useState<RiskHighlight | null>(null);
  const runScenario = useRunScenario();
  const { data: approvals } = useRouteApprovals(dbEnabled);
  const { data: user } = useGetUser();
  const userAttrs = user?.data?.attributes;
  const decidedBy = userAttrs?.name || userAttrs?.email || "Unknown user";
  const resetDemo = useResetDemoData();

  // Load the baseline (Normal conditions) run immediately so the dashboard
  // never opens empty — satisfies "existing road geometry appears immediately".
  // `settings`/`runScenario` are intentionally excluded: this should fire once
  // per load (guarded by `!comparison`), not re-trigger on every settings change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (
      dbEnabled &&
      !shipmentsLoading &&
      shipmentsMaster &&
      shipmentsMaster.length > 0 &&
      !comparison &&
      !runScenario.isPending
    ) {
      runScenario.mutate(settings, { onSuccess: setComparison });
    }
  }, [dbEnabled, shipmentsLoading, shipmentsMaster, comparison]);

  function applyPatch(patch: Partial<ScenarioSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (RECOMPUTE_KEYS.some((k) => patch[k] !== undefined)) {
      runScenario.mutate(next, { onSuccess: setComparison });
    }
  }

  function handleReset() {
    setSettings(DEFAULT_SCENARIO_SETTINGS);
    runScenario.mutate(DEFAULT_SCENARIO_SETTINGS, { onSuccess: setComparison });
  }

  function handleAssistantApply(
    nextSettings: ScenarioSettings,
    nextResult: ScenarioComparison,
  ) {
    setSettings(nextSettings);
    setComparison(nextResult);
  }

  const reviewItems = useMemo(
    () =>
      buildReviewItems(
        comparison?.baseline ?? null,
        comparison?.revised ?? null,
        approvals ?? [],
      ),
    [comparison, approvals],
  );
  const effectiveRevised = useMemo(
    () =>
      applyRejections(
        comparison?.baseline ?? null,
        comparison?.revised ?? null,
        reviewItems,
      ),
    [comparison, reviewItems],
  );
  const approvalStatus = useMemo(
    () => new Map(reviewItems.map((i) => [i.shipmentId, i.status])),
    [reviewItems],
  );
  const pendingCount = reviewItems.filter((i) => i.status === "pending").length;

  const mergedRows = useMemo(
    () =>
      mergeShipmentRows(
        shipmentsMaster ?? [],
        effectiveRevised?.shipments ?? [],
        facilities ?? [],
      ),
    [shipmentsMaster, effectiveRevised, facilities],
  );

  if (capsLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!dbEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Database not configured — ResilienceTwin GeoAI needs a database for
          the warehouse snapshot and scenario log.
        </p>
      </div>
    );
  }

  if (!shipmentsLoading && (shipmentsMaster?.length ?? 0) === 0) {
    return (
      <Empty className="h-full py-16">
        <Database className="h-8 w-8 text-muted-foreground" />
        <EmptyTitle>No demo data loaded</EmptyTitle>
        <EmptyDescription>
          Load the synthetic demo data — 2 ports, 5 warehouses, 40 shipments and
          12 trucks — to start running scenarios.
        </EmptyDescription>
        <Button
          onClick={() =>
            resetDemo.mutate(undefined, {
              onSuccess: () => {
                setComparison(null);
                toast.success("Demo data loaded.");
              },
              onError: (e) => toast.error(e.message),
            })
          }
          disabled={resetDemo.isPending}
        >
          {resetDemo.isPending ? "Loading…" : "Load demo data"}
        </Button>
      </Empty>
    );
  }

  return (
    <div className="p-1">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              ResilienceTwin GeoAI — Dispatch Simulator
            </h1>
            <p className="text-sm text-muted-foreground">
              Los Angeles &amp; Long Beach ports to Carson, Commerce, Ontario,
              Riverside &amp; Fontana — synthetic demo data.
            </p>
          </div>
          <ExportMenu
            rows={mergedRows}
            facilities={facilities ?? []}
            comparison={comparison}
          />
        </div>

        <KpiCards comparison={comparison} />

        <ScenarioControls
          settings={settings}
          onUpdate={applyPatch}
          onReset={handleReset}
        />

        {/* Side gutters give the page a scrollable area beside the map, which
            otherwise captures the mouse wheel for zooming. */}
        <div className="px-8 sm:px-12">
          {facilitiesLoading ? (
            <Skeleton className="h-[520px] w-full" />
          ) : (
            <ScenarioMap
              facilities={facilities ?? []}
              result={effectiveRevised}
              basemap={settings.basemap}
              showNormalOverlay={settings.showNormalOverlay}
              highlight={highlight}
              onClearHighlight={() => setHighlight(null)}
            />
          )}
        </div>

        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">Shipment Plan</TabsTrigger>
            <TabsTrigger value="exceptions">
              Exceptions &amp; Recovery
            </TabsTrigger>
            <TabsTrigger value="approvals">
              Route Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
            <TabsTrigger value="log">Decision Log</TabsTrigger>
          </TabsList>
          <TabsContent value="plan" className="rounded-lg border border-border">
            {shipmentsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ShipmentTable
                rows={mergedRows}
                approvalStatus={approvalStatus}
              />
            )}
          </TabsContent>
          <TabsContent
            value="exceptions"
            className="rounded-lg border border-border p-2"
          >
            <ExceptionsTable rows={mergedRows} />
          </TabsContent>
          <TabsContent
            value="approvals"
            className="rounded-lg border border-border p-4"
          >
            <ApprovalsPanel
              items={reviewItems}
              decidedBy={decidedBy}
              scenarioLabel={scenarioLabel(settings)}
            />
          </TabsContent>
          <TabsContent value="log" className="rounded-lg border border-border">
            <ApprovalLog enabled={dbEnabled} />
          </TabsContent>
          <TabsContent
            value="outreach"
            className="rounded-lg border border-border p-4"
          >
            <OutreachPanel rows={mergedRows} facilities={facilities ?? []} />
          </TabsContent>
        </Tabs>
      </div>

      <SidebarSlot>
        <ScenarioAssistant
          settings={settings}
          result={comparison}
          roadSegments={roadSegments ?? []}
          facilities={facilities ?? []}
          master={shipmentsMaster ?? []}
          onHighlight={setHighlight}
          onApply={handleAssistantApply}
          databaseEnabled={dbEnabled}
        />
      </SidebarSlot>
    </div>
  );
}
