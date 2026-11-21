import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideRoutes,
  listRouteApprovalLog,
  listRouteApprovals,
  type RouteDecisionInput,
} from "@/services/db/routeApprovalService";

export function useRouteApprovals(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "routeApprovals"],
    queryFn: () => listRouteApprovals(),
    enabled,
  });
}

export function useRouteApprovalLog(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "routeApprovalLog"],
    queryFn: () => listRouteApprovalLog(),
    enabled,
  });
}

export function useDecideRoutes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      decision: "approved" | "rejected";
      decidedBy: string;
      scenarioLabel: string;
      items: RouteDecisionInput[];
    }) => decideRoutes({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rt", "routeApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["rt", "routeApprovalLog"] });
    },
  });
}
