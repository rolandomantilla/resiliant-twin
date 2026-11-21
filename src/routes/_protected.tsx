import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/app-layout";

// Auth is enforced centrally in __root.tsx beforeLoad; this route is layout-only.
export const Route = createFileRoute("/_protected")({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
