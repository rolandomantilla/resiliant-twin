import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SlottedSidebarLayout } from "@/components/layout/slotted-sidebar-layout";
import { routes } from ".";
import { useGetUser, useSignOut } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { hasPermission } from "@/lib/rbac";
import { getAuthState } from "@/server/auth";

/**
 * App wrapper: wires this app's navigation (`routes`) and auth into the
 * sidebar shell. The shell adds a slot under navigation (see SidebarSlot).
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { mutate: signOut } = useSignOut();
  const { data: authState } = useQuery({
    queryKey: ["auth-state"],
    queryFn: () => getAuthState(),
  });
  const authEnabled = authState?.authEnabled ?? true;
  const { data: user } = useGetUser({
    enabled: authState?.authEnabled === true,
  });
  const attrs = user?.data?.attributes;
  const { data: member } = useCurrentMember();
  const visibleRoutes = useMemo(
    () =>
      routes.filter(
        (route) => !route.permission || hasPermission(member, route.permission),
      ),
    [member],
  );

  return (
    <SlottedSidebarLayout
      routes={visibleRoutes}
      authEnabled={authEnabled}
      user={attrs ? { name: attrs.name, email: attrs.email } : undefined}
      onSignOut={() => {
        signOut();
        navigate({ to: "/sign-in" });
      }}
    >
      {children}
    </SlottedSidebarLayout>
  );
}
