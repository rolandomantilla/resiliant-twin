import type { ReactNode } from "react";
import { useCan } from "@/hooks/useCan";

export type CanProps = {
  permission: string | string[];
  mode?: "every" | "any";
  children: ReactNode;
  fallback?: ReactNode;
  whileLoading?: ReactNode;
};

/**
 * Hides UI the current member cannot use. This is presentation only: the same
 * permission is enforced on the server by permissionProcedure, so removing a
 * <Can> never grants access, it only makes a dead control visible.
 */
export function Can({ permission, mode = "every", children, fallback = null, whileLoading = null }: CanProps) {
  const { can, isLoading } = useCan(permission, mode);

  if (isLoading) return <>{whileLoading}</>;
  return <>{can ? children : fallback}</>;
}
