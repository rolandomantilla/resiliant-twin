import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Mail, Phone, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSendOutreachNotice } from "@/hooks/useResilienceTwin";
import {
  formatMinutes,
  type ReplacementSuggestion,
  type RiskAnalysis,
  type RiskItem,
} from "@/lib/resilienceTwin/assistantReplies";
import type { ShipmentMasterRow } from "@/lib/resilienceTwin/mergeShipmentRows";
import type { FacilityRow } from "@/lib/resilienceTwin/types";

interface Draft {
  key: string;
  customerName: string;
  email: string;
  phone: string;
  stopId: string;
  items: { item: RiskItem; etaMin: number }[];
  text: string;
}

interface NoticeDraftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: RiskAnalysis | null;
  suggestions: ReplacementSuggestion[];
  master: ShipmentMasterRow[];
  facilities: FacilityRow[];
}

function buildDrafts(
  analysis: RiskAnalysis,
  suggestions: ReplacementSuggestion[],
  master: ShipmentMasterRow[],
  facilities: FacilityRow[],
): Draft[] {
  const masterById = new Map(master.map((m) => [m.id, m]));
  const nameById = new Map(facilities.map((f) => [f.id, f.name]));
  const suggestionById = new Map(suggestions.map((s) => [s.shipmentId, s]));
  const groups = new Map<string, Draft>();
  for (const item of analysis.items) {
    if (item.level === "ok") continue;
    const m = masterById.get(item.shipmentId);
    if (!m) continue;
    const s = suggestionById.get(item.shipmentId);
    // Quote the better of "wait it out" and the suggested replacement truck.
    const etaMin =
      s?.receivingMin != null && s.receivingMin < item.newReceivingMin
        ? s.receivingMin
        : item.newReceivingMin;
    const key = `${m.customerId}|${m.destinationId}`;
    if (!groups.has(key))
      groups.set(key, {
        key,
        customerName: m.customerName,
        email: m.email,
        phone: m.phone,
        stopId: m.destinationId,
        items: [],
        text: "",
      });
    groups.get(key)!.items.push({ item, etaMin });
  }
  for (const d of groups.values()) {
    const dest = nameById.get(d.stopId) ?? d.stopId;
    const lines = d.items.map(
      ({ item, etaMin }) =>
        `• ${item.shipmentId} to ${dest}: revised arrival ${formatMinutes(etaMin)} (original window closes ${formatMinutes(item.appointmentEndMin)}).`,
    );
    d.text = [
      `Hello ${d.customerName},`,
      "",
      `Due to ${analysis.title.toLowerCase()}, the following shipment${d.items.length > 1 ? "s are" : " is"} likely to be delayed:`,
      ...lines,
      "",
      "We're working to minimize the impact and will confirm the final delivery time shortly.",
      "",
      "— Dispatch team (demo notice, synthetic data)",
    ].join("\n");
  }
  return [...groups.values()];
}

export function NoticeDraftsDialog({
  open,
  onOpenChange,
  analysis,
  suggestions,
  master,
  facilities,
}: NoticeDraftsDialogProps) {
  const sendNotice = useSendOutreachNotice();
  const initial = useMemo(
    () =>
      analysis ? buildDrafts(analysis, suggestions, master, facilities) : [],
    [analysis, suggestions, master, facilities],
  );
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const [sent, setSent] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      setDrafts(initial);
      setSent(new Set());
    }
  }, [open, initial]);

  async function handleSend(d: Draft) {
    try {
      const result = await sendNotice.mutateAsync({
        stopId: d.stopId,
        shipmentIds: d.items.map((i) => i.item.shipmentId),
        impactSummary: d.text,
        etaSummary: Object.fromEntries(
          d.items.map((i) => [
            i.item.shipmentId,
            {
              revisedEtaMin: i.etaMin,
              status: i.item.level === "miss" ? "late" : "at_risk",
            },
          ]),
        ),
      });
      setSent((prev) => new Set(prev).add(d.key));
      toast[result.status === "duplicate" ? "info" : "success"](
        result.status === "duplicate"
          ? `An identical notice was already sent to ${d.customerName}.`
          : `Notice sent to the demo outbox for ${d.customerName}.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the notice.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customer notices</DialogTitle>
          <DialogDescription>
            {analysis?.title} — one draft per customer and delivery stop. Review
            and edit before sending to the demo outbox.
          </DialogDescription>
        </DialogHeader>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shipments are in danger, so there is nothing to send.
          </p>
        ) : (
          <div className="space-y-4">
            {drafts.map((d, idx) => (
              <div
                key={d.key}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{d.customerName}</p>
                    <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {d.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {d.phone}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {d.items.map(({ item }) => (
                      <Badge
                        key={item.shipmentId}
                        variant={
                          item.level === "miss" ? "destructive" : "secondary"
                        }
                        className="text-xs font-normal"
                      >
                        {item.shipmentId}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={d.text}
                  rows={8}
                  className="text-sm"
                  disabled={sent.has(d.key)}
                  onChange={(e) =>
                    setDrafts((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={sent.has(d.key) || sendNotice.isPending}
                    onClick={() => handleSend(d)}
                  >
                    {sent.has(d.key) ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Sent
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Send notice
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
