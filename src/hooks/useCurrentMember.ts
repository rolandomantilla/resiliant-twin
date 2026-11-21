import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { trpc } from "@/integrations/trpc/react";
import type { AppMember } from "@/lib/rbac";

/**
 * The signed-in person's membership in this app: their role, the permissions it
 * grants, and whether they can manage roles. Null on an app without RBAC, so
 * callers can treat "no member" and "no roles configured" the same way.
 *
 * The return type is pinned rather than inferred because `@/integrations/trpc/react`
 * is template-owned and only resolves once this is overlaid into an app. It
 * matches `rbac.me`, which returns `ctx.member ?? null`.
 */
export function useCurrentMember(): UseQueryResult<AppMember | null> {
  const t = trpc.useTRPC();
  return useQuery(t.rbac.me.queryOptions()) as UseQueryResult<AppMember | null>;
}
