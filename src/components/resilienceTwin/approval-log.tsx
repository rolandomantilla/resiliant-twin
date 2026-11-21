import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouteApprovalLog } from "@/hooks/useRouteApprovals";

export function ApprovalLog({ enabled }: { enabled: boolean }) {
  const { data, isLoading, error } = useRouteApprovalLog(enabled);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error)
    return (
      <p className="p-6 text-center text-sm text-destructive">
        Couldn't load the decision log: {error.message}
      </p>
    );
  if (!data || data.length === 0)
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No approval decisions yet.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Shipment</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>By</TableHead>
            <TableHead>Scenario</TableHead>
            <TableHead>Proposed change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(row.decidedAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium">{row.shipmentId}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.decision === "approved" ? "default" : "destructive"
                  }
                  className="text-xs"
                >
                  {row.decision === "approved" ? "Approved" : "Rejected"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{row.decidedBy}</TableCell>
              <TableCell className="text-xs">{row.scenarioLabel}</TableCell>
              <TableCell className="max-w-sm text-xs text-muted-foreground">
                {row.summary}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
