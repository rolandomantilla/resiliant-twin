import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDecideRoutes } from "@/hooks/useRouteApprovals";
import type {
  ApprovalStatus,
  ReviewItem,
} from "@/lib/resilienceTwin/approvals";
import { formatMinutes } from "@/lib/resilienceTwin/assistantReplies";

export const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected — original kept",
};

export const STATUS_VARIANT: Record<
  ApprovalStatus,
  "outline" | "default" | "destructive"
> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

function routeLine(p: ReviewItem["proposed"] | null) {
  if (!p) return "—";
  const eta = p.receivingMin ?? p.recovery?.receivingMin ?? null;
  return `${p.truckId ?? "No truck"} · ETA ${formatMinutes(eta)}`;
}

export function ApprovalsPanel({
  items,
  decidedBy,
  scenarioLabel,
}: {
  items: ReviewItem[];
  decidedBy: string;
  scenarioLabel: string;
}) {
  const decide = useDecideRoutes();
  const pending = items.filter((i) => i.status === "pending");

  function submit(decision: "approved" | "rejected", targets: ReviewItem[]) {
    if (targets.length === 0) return;
    decide.mutate(
      {
        decision,
        decidedBy,
        scenarioLabel,
        items: targets.map((t) => ({
          shipmentId: t.shipmentId,
          routeKey: t.routeKey,
          summary: t.summary,
        })),
      },
      {
        onSuccess: () =>
          toast.success(
            `${targets.length} route${targets.length === 1 ? "" : "s"} ${decision}.`,
          ),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  if (items.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No route changes to review. Run a disruption scenario to see proposed
        updates here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pending.length}</span>{" "}
          of {items.length} proposed route updates awaiting review ·{" "}
          {scenarioLabel}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending.length === 0 || decide.isPending}
            onClick={() => submit("rejected", pending)}
          >
            <X className="h-4 w-4" /> Reject all pending
          </Button>
          <Button
            size="sm"
            disabled={pending.length === 0 || decide.isPending}
            onClick={() => submit("approved", pending)}
          >
            <Check className="h-4 w-4" /> Approve all pending
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment</TableHead>
              <TableHead>Original route</TableHead>
              <TableHead>Proposed route</TableHead>
              <TableHead>What changed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.shipmentId}>
                <TableCell className="font-medium">{item.shipmentId}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {routeLine(item.baseline)}
                </TableCell>
                <TableCell className="text-xs">
                  {routeLine(item.proposed)}
                </TableCell>
                <TableCell className="max-w-xs text-xs text-muted-foreground">
                  {item.summary}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={STATUS_VARIANT[item.status]}
                    className="text-xs"
                  >
                    {STATUS_LABEL[item.status]}
                  </Badge>
                  {item.decidedBy && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      by {item.decidedBy}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant={
                        item.status === "rejected" ? "destructive" : "outline"
                      }
                      disabled={decide.isPending || item.status === "rejected"}
                      onClick={() => submit("rejected", [item])}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        item.status === "approved" ? "default" : "outline"
                      }
                      disabled={decide.isPending || item.status === "approved"}
                      onClick={() => submit("approved", [item])}
                    >
                      Approve
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
