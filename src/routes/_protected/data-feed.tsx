import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Radio, RotateCcw, Rss } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCapabilities } from "@/hooks/useCapabilities";
import {
  useEventLog,
  useFacilities,
  useLiveState,
  useReplaySeedFeed,
  useResetDemoData,
  useShipmentsMaster,
} from "@/hooks/useResilienceTwin";

export const Route = createFileRoute("/_protected/data-feed")({
  component: DataFeedPage,
});

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary"> =
  {
    accepted: "default",
    rejected: "destructive",
    superseded: "secondary",
  };

function DataFeedPage() {
  const { data: caps, isLoading: capsLoading } = useCapabilities();
  const dbEnabled = caps?.databaseEnabled === true;

  const { data: facilities } = useFacilities(dbEnabled);
  const { data: shipments } = useShipmentsMaster(dbEnabled);
  const { data: eventLog, isLoading: logLoading } = useEventLog(dbEnabled);
  const { data: liveState } = useLiveState(dbEnabled);
  const replay = useReplaySeedFeed();
  const resetDemo = useResetDemoData();

  async function handleReplay(kind: "iot" | "disruption") {
    try {
      const outcomes = await replay.mutateAsync(kind);
      const counts = outcomes.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {});
      toast.success(
        `${kind === "iot" ? "IoT" : "Disruption"} feed replayed: ${counts.accepted ?? 0} accepted, ${counts.rejected ?? 0} rejected, ${counts.superseded ?? 0} superseded.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replay failed.");
    }
  }

  if (capsLoading) return <Skeleton className="h-64 w-full" />;
  if (!dbEnabled)
    return (
      <p className="text-sm text-muted-foreground">Database not configured.</p>
    );

  const ports = facilities?.filter((f) => f.kind === "port").length ?? 0;
  const warehouses =
    facilities?.filter((f) => f.kind === "warehouse").length ?? 0;

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Data Feed &amp; Replay
        </h1>
        <p className="text-sm text-muted-foreground">
          Warehouse snapshot status, and a replay console for the bundled IoT
          and disruption telemetry streams. This platform has no native
          streaming connector, so replay runs as a server-side ingestion job you
          trigger here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ports" value={ports} />
        <StatCard label="Warehouses" value={warehouses} />
        <StatCard label="Shipments" value={shipments?.length ?? 0} />
        <StatCard
          label="Truck live readings"
          value={liveState?.trucks.length ?? 0}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleReplay("iot")} disabled={replay.isPending}>
          <Rss className="mr-1.5 h-4 w-4" /> Replay IoT feed
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (
              window.confirm(
                "Reset all demo data? This reloads the 40 sample shipments and clears the event log, outreach outbox and assistant chat.",
              )
            ) {
              resetDemo.mutate(undefined, {
                onSuccess: (c) =>
                  toast.success(
                    `Demo data reset: ${c.shipments} shipments, ${c.trucks} trucks, ${c.facilities} facilities.`,
                  ),
                onError: (e) => toast.error(e.message),
              });
            }
          }}
          disabled={resetDemo.isPending}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reset demo data
        </Button>
        <Button
          variant="outline"
          onClick={() => handleReplay("disruption")}
          disabled={replay.isPending}
        >
          <Radio className="mr-1.5 h-4 w-4" /> Replay disruption feed
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          Safe to replay repeatedly — the bundled feed includes a duplicate
          event and an out-of-order (stale) event on purpose, and both are
          rejected without changing the newest accepted reading.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium">Truck live state</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Queue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(liveState?.trucks ?? []).map((t) => (
                  <TableRow key={t.truckId}>
                    <TableCell>{t.truckId}</TableCell>
                    <TableCell className="text-xs">
                      {t.lat !== null
                        ? `${t.lat.toFixed(3)}, ${t.lon?.toFixed(3)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.pickupStatus ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.queueMin ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!liveState || liveState.trucks.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-xs text-muted-foreground"
                    >
                      No telemetry yet — replay the IoT feed above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium">Corridor live state</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corridor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(liveState?.corridors ?? []).map((c) => (
                  <TableRow key={c.corridorId}>
                    <TableCell>{c.corridorId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "closed"
                            ? "destructive"
                            : c.status === "slowdown"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{c.delayMin} min</TableCell>
                  </TableRow>
                ))}
                {(!liveState || liveState.corridors.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-xs text-muted-foreground"
                    >
                      No telemetry yet — replay the disruption feed above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">
          Event log (most recent 100 per stream)
        </h2>
        {logLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EventTable
              title="IoT events"
              events={eventLog?.iot ?? []}
              idLabel="Truck"
              idKey="truckId"
            />
            <EventTable
              title="Disruption events"
              events={eventLog?.disruption ?? []}
              idLabel="Corridor"
              idKey="corridorId"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EventTable({
  title,
  events,
  idLabel,
  idKey,
}: {
  title: string;
  events: Array<Record<string, any>>;
  idLabel: string;
  idKey: string;
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>{idLabel}</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.eventId}</TableCell>
                <TableCell className="text-xs">{e[idKey]}</TableCell>
                <TableCell className="text-xs">{e.eventType}</TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[e.status] ?? "outline"}
                    className="text-xs"
                  >
                    {e.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-[220px] truncate text-xs text-muted-foreground"
                  title={e.reason ?? ""}
                >
                  {e.reason ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {events.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-xs text-muted-foreground"
                >
                  No events yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
