import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { CheckCircle2 } from "lucide-react";
import { formatMinutes } from "@/lib/resilienceTwin/assistantReplies";
import type { MergedShipmentRow } from "@/lib/resilienceTwin/mergeShipmentRows";

export function ExceptionsTable({ rows }: { rows: MergedShipmentRow[] }) {
  const exceptions = rows.filter((r) => r.status === "unassigned");
  if (exceptions.length === 0) {
    return (
      <Empty className="py-12">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <EmptyTitle>No exceptions this run</EmptyTitle>
        <EmptyDescription>
          Every shipment is scheduled against a truck, driver, and receiving
          slot.
        </EmptyDescription>
      </Empty>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment</TableHead>
            <TableHead>Stop</TableHead>
            <TableHead>Reason unassigned</TableHead>
            <TableHead>Proposed arrival</TableHead>
            <TableHead>Proposed receiving</TableHead>
            <TableHead>Proposed slot</TableHead>
            <TableHead>Recovery status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map((row) => {
            const recovery = row.plan?.recovery;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.id}</TableCell>
                <TableCell>{row.destinationName}</TableCell>
                <TableCell className="max-w-xs text-xs text-muted-foreground">
                  {row.modeledImpact}
                </TableCell>
                <TableCell className="text-xs">
                  {formatMinutes(recovery?.arrivalMin ?? null)}
                </TableCell>
                <TableCell className="text-xs">
                  {formatMinutes(recovery?.receivingMin ?? null)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {recovery?.slotId ?? "—"}
                </TableCell>
                <TableCell>
                  {recovery?.status === "proposed" ? (
                    <Badge variant="outline" className="text-xs">
                      Awaiting warehouse confirmation
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      No feasible option
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
