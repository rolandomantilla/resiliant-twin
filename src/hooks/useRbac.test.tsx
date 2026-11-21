import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionCatalog } from "@/lib/rbac";

const assignRole = vi.fn();
const preAssignRole = vi.fn();
const setDefaultRole = vi.fn();
const createRole = vi.fn();
const updateRole = vi.fn();
const deleteRole = vi.fn();

const query = {
  roles: [] as unknown[],
  members: [] as unknown[],
  invitedNotSignedIn: [] as unknown[],
};

vi.mock("@/hooks/useCurrentMember", () => ({
  useCurrentMember: () => ({ data: { id: "m-self" } }),
}));

vi.mock("@/hooks/useRoles", () => ({
  useRoles: () => ({ data: query.roles, isPending: false, error: null }),
  useMembers: () => ({
    data: { members: query.members, invitedNotSignedIn: query.invitedNotSignedIn },
    isPending: false,
    error: null,
  }),
  useAssignRole: () => ({ mutateAsync: assignRole }),
  usePreAssignRole: () => ({ mutateAsync: preAssignRole }),
  useCreateRole: () => ({ mutateAsync: createRole }),
  useUpdateRole: () => ({ mutateAsync: updateRole }),
  useDeleteRole: () => ({ mutateAsync: deleteRole }),
  useSetDefaultRole: () => ({ mutateAsync: setDefaultRole }),
}));

const { useRbac } = await import("@/hooks/useRbac");

const catalog: PermissionCatalog = [
  { feature: "expenses", permissions: [{ key: "expenses.view", label: "View" }] },
];

const rbac = () => renderHook(() => useRbac(catalog)).result;

beforeEach(() => {
  vi.clearAllMocks();
  query.roles = [
    { id: "r-staff", name: "Staff", description: null, permissions: ["expenses.view"], isDefault: true },
  ];
  query.members = [
    { id: "m-1", email: "signed-in@x.com", aisUserId: "u-1", roleId: "r-staff", pendingRoleId: null },
  ];
  query.invitedNotSignedIn = [];
});

describe("people AIS has invited who have never opened the app", () => {
  beforeEach(() => {
    query.invitedNotSignedIn = [
      { appUserId: "au-9", aisUserId: "u-9", email: "newcomer@x.com", name: "New Comer", status: "invited" },
    ];
  });

  it("are listed, so a role can be set before they first sign in", () => {
    const { members } = rbac().current;

    expect(members).toHaveLength(2);
    expect(members[1]).toMatchObject({ email: "newcomer@x.com", status: "invited", roleId: "" });
  });

  it("pre-assign by email, because there is no member row to assign yet", async () => {
    const { members, onRoleChange } = rbac().current;

    await act(() => onRoleChange(members[1].id, "r-staff"));

    expect(preAssignRole).toHaveBeenCalledWith({ email: "newcomer@x.com", roleId: "r-staff" });
    expect(assignRole).not.toHaveBeenCalled();
  });
});

describe("onRoleChange", () => {
  it("assigns a member who has signed in", async () => {
    const result = rbac();

    await act(() => result.current.onRoleChange("m-1", "r-staff"));

    expect(assignRole).toHaveBeenCalledWith({ memberId: "m-1", roleId: "r-staff" });
  });

  it("pre-assigns a row of our own that nobody has claimed yet", async () => {
    query.members = [
      { id: "m-2", email: "pending@x.com", aisUserId: null, roleId: null, pendingRoleId: "r-staff" },
    ];
    const result = rbac();

    await act(() => result.current.onRoleChange("m-2", "r-staff"));

    expect(preAssignRole).toHaveBeenCalledWith({ email: "pending@x.com", roleId: "r-staff" });
  });
});

describe("a refusal from the server", () => {
  it("reaches the banner, which the settings components swallow on their own", async () => {
    deleteRole.mockRejectedValue(new Error("That change would leave nobody able to manage roles."));
    const result = rbac();

    await act(async () => {
      await result.current.onDeleteRole("r-staff").catch(() => {});
    });

    await waitFor(() => expect(result.current.error).toMatch(/nobody able to manage/));
  });

  it("still rejects, so a dialog mid-change stays open", async () => {
    updateRole.mockRejectedValue(new Error("Name already taken."));
    const result = rbac();

    await act(async () => {
      await expect(
        result.current.onUpdateRole("r-staff", { name: "Staff", permissionIds: [] }),
      ).rejects.toThrow("Name already taken.");
    });
  });

  it("is reported without rejecting for the default-role control, which voids the call", async () => {
    setDefaultRole.mockRejectedValue(new Error("That role no longer exists."));
    const result = rbac();

    await act(async () => {
      await result.current.onSetDefaultRole("r-gone");
    });

    await waitFor(() => expect(result.current.error).toMatch(/no longer exists/));
  });

  it("clears once the next change goes through", async () => {
    deleteRole.mockRejectedValueOnce(new Error("nope"));
    const result = rbac();

    await act(async () => {
      await result.current.onDeleteRole("r-staff").catch(() => {});
    });
    await waitFor(() => expect(result.current.error).toBe("nope"));

    await act(() => result.current.onCreateRole({ name: "Manager", permissionIds: [] }));

    await waitFor(() => expect(result.current.error).toBeUndefined());
  });
});
