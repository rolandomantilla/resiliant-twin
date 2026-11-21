import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUndoTruckSwaps } from "@/hooks/useResilienceTwin";
import { formatMinutes } from "@/lib/resilienceTwin/assistantReplies";
import type {
  SwapOverlayResult,
  TruckSwap,
} from "@/lib/resilienceTwin/truckSwaps";
import type { ShipmentPlan } from "@/lib/resilienceTwin/types";

interface TruckSwapsPanelProps {
  swaps: TruckSwap[];
  overlay: SwapOverlayResult | null;
}

export function TruckSwapsPanel({ swaps, overlay }: TruckSwapsPanelProps) {
  const undo = useUndoTruckSwaps();
  if (swaps.length === 0) return null;

  const planById = new Map<string, ShipmentPlan>(
    (overlay?.result.shipments ?? []).map((s) => [s.shipmentId, s]),
  );
  const skipped = new Map(
    (overlay?.skipped ?? []).map((s) => [s.shipmentId, s.reason]),
  );

  function handleUndo(ids: string[] | "all") {
    undo.mutate(ids, {
      onSuccess: () =>
        toast.success(
          ids === "all"
            ? "All truck swaps undone — the plan is back to the computed schedule."
            : `Swap for ${ids.join(", ")} undone.`,
        ),
      onError: (e) => toast.error(e.message),
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Applied truck swaps</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {swaps.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={undo.isPending}
          onClick={() => handleUndo("all")}
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo all swaps
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {swaps.map((swap) => {
          const plan = planById.get(swap.shipmentId);
          const reason = skipped.get(swap.shipmentId);
          const late =
            plan?.receivingMin != null &&
            plan.receivingMin > plan.appointmentEndMin;
          return (
            <li
              key={swap.shipmentId}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{swap.shipmentId}</span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  {swap.fromTruckId ?? "—"}
                  <ArrowRight className="h-3 w-3" />
                  {swap.truckId}
                </span>
                {reason ? (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Not applied to this plan: {reason}
                  </span>
                ) : plan ? (
                  <span className="text-xs text-muted-foreground">
                    arrives {formatMinutes(plan.receivingMin)} ·{" "}
                    <span className={late ? "text-destructive" : undefined}>
                      {late ? "late" : "on time"}
                    </span>{" "}
                    · ${plan.costUsd?.toLocaleString()} · {plan.co2Kg} kg CO₂
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  — {swap.reason}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={undo.isPending}
                onClick={() => handleUndo([swap.shipmentId])}
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
