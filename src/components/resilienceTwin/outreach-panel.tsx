import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, Download, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { useSendOutreachNotice } from "@/hooks/useResilienceTwin";
import { formatMinutes } from "@/lib/resilienceTwin/assistantReplies";
import type { MergedShipmentRow } from "@/lib/resilienceTwin/mergeShipmentRows";
import type { FacilityRow } from "@/lib/resilienceTwin/types";
import { cn } from "@/lib/utils";

interface OutreachPanelProps {
  rows: MergedShipmentRow[];
  facilities: FacilityRow[];
}

function buildNoticeText(stopName: string, affected: MergedShipmentRow[]) {
  const lines = [
    `Proactive delay notice — ${stopName}`,
    `Generated ${new Date().toISOString()}`,
    "",
    "This is a demo notice from the ResilienceTwin GeoAI scenario simulator — synthetic data, not a real shipment update.",
    "",
  ];
  for (const row of affected) {
    lines.push(
      `${row.id} (${row.customerName}): ${row.modeledImpact} Revised ETA ${formatMinutes(row.revisedEtaMin)} (simulated, awaiting confirmation).`,
    );
  }
  return lines.join("\n");
}

export function OutreachPanel({ rows, facilities }: OutreachPanelProps) {
  const warehouses = facilities.filter((f) => f.kind === "warehouse");
  const [selectedStop, setSelectedStop] = useState<string | null>(
    warehouses[0]?.id ?? null,
  );
  const sendNotice = useSendOutreachNotice();

  const byStop = useMemo(() => {
    const map = new Map<string, MergedShipmentRow[]>();
    for (const row of rows) {
      if (!map.has(row.destinationId)) map.set(row.destinationId, []);
      map.get(row.destinationId)!.push(row);
    }
    return map;
  }, [rows]);

  const stopRows = selectedStop ? (byStop.get(selectedStop) ?? []) : [];
  const affected = stopRows.filter(
    (r) =>
      r.status === "unassigned" ||
      (r.revisedEtaMin !== null && r.revisedEtaMin > r.appointmentEndMin),
  );
  const stop = warehouses.find((w) => w.id === selectedStop);

  async function handleSend() {
    if (!stop) return;
    const etaSummary = Object.fromEntries(
      affected.map((r) => [
        r.id,
        { revisedEtaMin: r.revisedEtaMin, status: r.status },
      ]),
    );
    const impactSummary = affected
      .map((r) => `${r.id}: ${r.modeledImpact}`)
      .join(" | ");
    try {
      const result = await sendNotice.mutateAsync({
        stopId: stop.id,
        shipmentIds: affected.map((r) => r.id),
        impactSummary,
        etaSummary,
      });
      if (result.status === "duplicate") {
        toast.info(
          "An identical notice for this stop has already been sent — no new impact or ETA to report.",
        );
      } else {
        toast.success(
          `Delay notice sent to the demo outbox for ${stop.name}. Affected shipments marked contacted.`,
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the notice.",
      );
    }
  }

  function handleDownload() {
    if (!stop) return;
    const text = buildNoticeText(stop.name, affected);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delay-notice-${stop.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {warehouses.map((w) => {
          const count = (byStop.get(w.id) ?? []).length;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedStop(w.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selectedStop === w.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50",
              )}
            >
              <span>{w.name}</span>
              <Badge variant="secondary" className="text-xs">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>
      <div className="space-y-4">
        {!stop ? (
          <Empty className="py-12">
            <EmptyTitle>Select a stop</EmptyTitle>
            <EmptyDescription>
              Choose a receiving location to see its contacts and shipments.
            </EmptyDescription>
          </Empty>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-medium">
                {stop.name} — receiving contacts
              </h3>
              <div className="mt-2 space-y-1">
                {[
                  ...new Map(stopRows.map((r) => [r.customerName, r])).values(),
                ].map((r) => (
                  <div
                    key={r.customerName}
                    className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {r.customerName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {r.email}
                    </span>
                  </div>
                ))}
                {stopRows.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No shipments routed to this stop.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Proactive delay notice</h4>
                <Badge
                  variant={affected.length > 0 ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {affected.length} affected shipment
                  {affected.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {affected.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No shipments at this stop currently need outreach — nothing
                  unassigned or running late.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {affected.map((r) => (
                    <li key={r.id}>
                      <span className="font-medium text-foreground">
                        {r.id}
                      </span>{" "}
                      ({r.customerName}) — {r.modeledImpact} Revised ETA{" "}
                      {formatMinutes(r.revisedEtaMin)}.
                      {r.contacted && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          contacted
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={affected.length === 0 || sendNotice.isPending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Send delay email
                  (demo)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  disabled={affected.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download notice
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
