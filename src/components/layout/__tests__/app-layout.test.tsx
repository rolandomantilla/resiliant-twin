import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MANAGE_PERMISSION, type AppMember } from "@/lib/rbac";

// Stub the shared base layout + all app wiring so we test only that the wrapper
// renders SidebarLayout with the app's routes and passes children through.
const sidebarLayoutSpy = vi.fn();
vi.mock("@/components/layout/slotted-sidebar-layout", () => ({
  SlottedSidebarLayout: (props: { children?: ReactNode; routes?: unknown }) => {
    sidebarLayoutSpy(props);
    return <div data-testid="sidebar-layout">{props.children}</div>;
  },
}));
vi.mock("@/components/layout", () => ({
  routes: [
    { title: "Dashboard", url: "/", icon: () => null },
    {
      title: "Settings",
      url: "/settings",
      icon: () => null,
      permission: MANAGE_PERMISSION,
    },
  ],
}));
vi.mock("@/server/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({
  useGetUser: () => ({ data: undefined }),
  useSignOut: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/useCurrentMember", () => ({ useCurrentMember: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { authEnabled: true } }),
}));

import { AppLayout } from "@/components/layout/app-layout";
import { useCurrentMember } from "@/hooks/useCurrentMember";

const asMember = (member: Partial<AppMember> | null) =>
  vi
    .mocked(useCurrentMember)
    .mockReturnValue({ data: member } as ReturnType<typeof useCurrentMember>);

const navTitles = () => {
  const { routes } = sidebarLayoutSpy.mock.calls.at(-1)?.[0] as {
    routes: { title: string }[];
  };
  return routes.map((route) => route.title);
};

describe("AppLayout (wrapper)", () => {
  beforeEach(() => {
    sidebarLayoutSpy.mockClear();
    asMember(null);
  });

  it("renders the sidebar layout with routes and children", () => {
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-layout")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(sidebarLayoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({ routes: expect.any(Array) }),
    );
  });

  it("hides a nav entry whose permission the member does not hold", () => {
    asMember({ permissions: [], canAdminister: false });
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard"]);
  });

  it("shows it to a member who holds the permission", () => {
    asMember({ permissions: [MANAGE_PERMISSION], canAdminister: true });
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard", "Settings"]);
  });

  /**
   * `canAdminister` is true for any role that can manage roles, which is not
   * the same as holding every permission. Letting it stand in for one made the
   * sidebar promise links the server then refused, which is the exact mismatch
   * gating the nav was meant to remove.
   */
  it("shows it to a managing role, which holds the permission it is gated on", () => {
    asMember({ permissions: [MANAGE_PERMISSION], canAdminister: true });
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard", "Settings"]);
  });

  it("hides it from a role that can administer but does not hold the permission", () => {
    asMember({ permissions: ["expenses.view"], canAdminister: true });
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard"]);
  });

  it("shows it to a wildcard role, which holds everything", () => {
    asMember({ permissions: ["*"], canAdminister: true });
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard", "Settings"]);
  });

  it("leaves ungated entries visible on an app with no roles", () => {
    asMember(null);
    render(
      <AppLayout>
        <p>Page content</p>
      </AppLayout>,
    );
    expect(navTitles()).toEqual(["Dashboard"]);
  });
});
