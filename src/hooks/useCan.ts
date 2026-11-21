import { hasAnyPermission, hasEveryPermission, hasPermission } from "@/lib/rbac";
import { useCurrentMember } from "./useCurrentMember";

export type CanResult = {
  can: boolean;
  isLoading: boolean;
  canAdminister: boolean;
};

/**
 * Whether the current member holds a permission. While the member is still
 * loading `can` is false, so a gated control never flashes into view for
 * someone who turns out not to hold the permission.
 */
export function useCan(permission: string | string[], mode: "every" | "any" = "every"): CanResult {
  const { data: member, isLoading } = useCurrentMember();

  const can = Array.isArray(permission)
    ? mode === "any"
      ? hasAnyPermission(member, permission)
      : hasEveryPermission(member, permission)
    : hasPermission(member, permission);

  return { can: isLoading ? false : can, isLoading, canAdminister: member?.canAdminister ?? false };
}
