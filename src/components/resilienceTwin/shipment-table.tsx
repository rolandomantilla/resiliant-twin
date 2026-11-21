import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
} from "@/components/resilienceTwin/approvals-panel";
import type { ApprovalStatus } from "@/lib/resilienceTwin/approvals";
import { formatMinutes } from "@/lib/resilienceTwin/assistantReplies";
import type { MergedShipmentRow } from "@/lib/resilienceTwin/mergeShipmentRows";
import { cn } from "@/lib/utils";

const PRIORITY_VARIANT: Record<
  string,
  "destructive" | "default" | "secondary"
> = {
  critical: "destructive",
  high: "default",
  routine: "secondary",
};

export function ShipmentTable({
  rows,
  approvalStatus,
}: {
  rows: MergedShipmentRow[];
  approvalStatus?: Map<string, ApprovalStatus>;
}) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No shipments loaded yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>Stop / receiving location</TableHead>
            <TableHead>Truck</TableHead>
            <TableHead>Original window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Route approval</TableHead>
            <TableHead>Modeled impact</TableHead>
            <TableHead>Next action</TableHead>
            <TableHead>Revised ETA</TableHead>
            <TableHead>Proposed slot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                {row.id}
                <Badge
                  variant={PRIORITY_VARIANT[row.priority]}
                  className="ml-2 text-[10px] font-normal"
                >
                  {row.priority}
                </Badge>
              </TableCell>
              <TableCell>{row.originName}</TableCell>
              <TableCell>
                <div className="font-mono text-xs text-muted-foreground">
                  {row.destinationId}
                </div>
                {row.destinationName}
              </TableCell>
              <TableCell>{row.truckId ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.originalWindow}
                <div className="text-[10px]">confirmed appointment</div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={row.status === "scheduled" ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>
                {(() => {
                  const st = approvalStatus?.get(row.id);
                  return st ? (
                    <Badge variant={STATUS_VARIANT[st]} className="text-xs">
                      {STATUS_LABEL[st]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  );
                })()}
              </TableCell>
              <TableCell className="max-w-xs text-xs text-muted-foreground">
                {row.modeledImpact}
              </TableCell>
              <TableCell className="max-w-xs text-xs">
                {row.nextAction}
              </TableCell>
              <TableCell
                className={cn(
                  "text-xs",
                  row.revisedEtaIsSimulated && "text-primary",
                )}
              >
                {formatMinutes(row.revisedEtaMin)}
                {row.revisedEtaIsSimulated && (
                  <div className="text-[10px] text-muted-foreground">
                    simulated, not confirmed
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.proposedSlotId ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
