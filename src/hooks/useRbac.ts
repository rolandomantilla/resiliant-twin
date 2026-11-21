import { useMemo, useState } from "react";
import type { RbacMember, RbacPermissionGroup, RbacRole } from "@/components/rbac";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import {
  useAssignRole,
  useCreateRole,
  useDeleteRole,
  useMembers,
  usePreAssignRole,
  useRoles,
  useSetDefaultRole,
  useUpdateRole,
  type InvitedNotSignedIn,
  type ManagedMember,
  type ManagedRole,
} from "@/hooks/useRoles";
import { allPermissionKeys, expandWildcard, permissionsManageRoles } from "@/lib/rbac";
import type { PermissionCatalog } from "@/lib/rbac";

/**
 * Adapts the rbac router onto the shapes the settings components take.
 *
 * `onInvite` and `onRemove` are deliberately absent. AIS owns who may open the
 * app; the app owns what they may do once inside. Omitting a callback hides its
 * control, so the Members tab lists people and changes their role, and nothing
 * more.
 *
 * People AIS has invited who have never opened the app are listed all the
 * same. Setting a role on one is what pre-assignment is: it writes a pending
 * row that the person picks up at first sign-in, instead of landing them on
 * the default role and waiting for someone to notice.
 */
export type UseRbacResult = {
  members: RbacMember[];
  roles: RbacRole[];
  permissionGroups: RbacPermissionGroup[];
  currentUserId?: string;
  isLoading: boolean;
  error?: string;
  onRoleChange: (memberId: string, roleId: string) => Promise<void>;
  onCreateRole: (input: { name: string; description?: string; permissionIds: string[] }) => Promise<void>;
  onUpdateRole: (
    roleId: string,
    input: { name: string; description?: string; permissionIds: string[] },
  ) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
  onSetDefaultRole: (roleId: string) => Promise<void>;
};

/**
 * `locked` is derived, never stored. A role that can manage roles is the one
 * that can hand out every other permission, so the Roles screen does not offer
 * to edit or delete it. Roles stay dynamic: rename or reshape them through a
 * migration, and the moment a role stops managing it becomes editable again.
 *
 * This is an affordance, not the enforcement. What actually holds is the rule
 * the server applies on every write: at least one role that can manage roles,
 * with at least one member holding it.
 */
const toRbacRole = (role: ManagedRole, catalogKeys: string[]): RbacRole => ({
  id: role.id,
  name: role.name,
  description: role.description ?? undefined,
  permissionIds: expandWildcard(role.permissions, catalogKeys),
  locked: permissionsManageRoles(role.permissions),
  isDefault: role.isDefault,
});

const toRbacMember = (member: ManagedMember): RbacMember => ({
  id: member.id,
  email: member.email,
  roleId: member.roleId ?? member.pendingRoleId ?? "",
  status: member.aisUserId ? "active" : "invited",
});

/**
 * An AIS invitee with no row of our own yet, so there is no member id to send.
 * The email is the identity a pending row is keyed on, so carry it in the id
 * and unpack it in `onRoleChange`.
 */
const INVITE_PREFIX = "invite:";

const toInviteeRow = (invitee: InvitedNotSignedIn): RbacMember => ({
  id: `${INVITE_PREFIX}${invitee.email}`,
  name: invitee.name ?? undefined,
  email: invitee.email,
  roleId: "",
  status: "invited",
});

const toPermissionGroups = (catalog: PermissionCatalog): RbacPermissionGroup[] =>
  catalog.map((group) => ({
    id: group.feature,
    label: group.feature,
    permissions: group.permissions.map((permission) => ({
      id: permission.key,
      label: permission.label,
      description: permission.description,
    })),
  }));

export function useRbac(catalog: PermissionCatalog): UseRbacResult {
  const rolesQuery = useRoles();
  const membersQuery = useMembers();
  const currentMember = useCurrentMember();

  const assignRole = useAssignRole();
  const preAssignRole = usePreAssignRole();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const setDefaultRole = useSetDefaultRole();

  const [actionError, setActionError] = useState<string | null>(null);

  const roleRows = rolesQuery.data ?? [];
  const memberRows = membersQuery.data?.members ?? [];
  const inviteeRows = membersQuery.data?.invitedNotSignedIn ?? [];

  const catalogKeys = useMemo(() => allPermissionKeys(catalog), [catalog]);
  const roles = useMemo(
    () => roleRows.map((role) => toRbacRole(role, catalogKeys)),
    [roleRows, catalogKeys],
  );
  const members = useMemo(
    () => [...memberRows.map(toRbacMember), ...inviteeRows.map(toInviteeRow)],
    [memberRows, inviteeRows],
  );
  const permissionGroups = useMemo(() => toPermissionGroups(catalog), [catalog]);

  /**
   * The settings components run these through `usePendingAction`, which
   * catches to keep a dialog open and then drops the message. Every refusal
   * the server sends back is a sentence written for the person (the
   * last-manager rule, a role that no longer exists), so hold on to it for the
   * banner and let the rejection carry on to the dialog.
   */
  const reporting = async (change: () => Promise<unknown>): Promise<void> => {
    setActionError(null);
    try {
      await change();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That change did not go through.");
      throw err;
    }
  };

  return {
    roles,
    members,
    permissionGroups,
    currentUserId: currentMember.data?.id,
    isLoading: rolesQuery.isPending || membersQuery.isPending,
    error: actionError ?? rolesQuery.error?.message ?? membersQuery.error?.message,

    onRoleChange: async (memberId, roleId) =>
      reporting(() => {
        if (memberId.startsWith(INVITE_PREFIX)) {
          return preAssignRole.mutateAsync({
            email: memberId.slice(INVITE_PREFIX.length),
            roleId,
          });
        }

        const member = memberRows.find((row) => row.id === memberId);
        if (member && !member.aisUserId) {
          return preAssignRole.mutateAsync({ email: member.email, roleId });
        }
        return assignRole.mutateAsync({ memberId, roleId });
      }),

    onCreateRole: async ({ name, description, permissionIds }) =>
      reporting(() =>
        createRole.mutateAsync({ name, description, permissions: permissionIds }),
      ),

    onUpdateRole: async (roleId, { name, description, permissionIds }) =>
      reporting(() =>
        updateRole.mutateAsync({ roleId, name, description, permissions: permissionIds }),
      ),

    onDeleteRole: async (roleId) => reporting(() => deleteRole.mutateAsync({ roleId })),

    // Called as `void onSetDefaultRole(id)`, so a rejection here has nowhere
    // to go but an unhandled one. The banner is the whole report.
    onSetDefaultRole: async (roleId) => {
      await reporting(() => setDefaultRole.mutateAsync({ roleId })).catch(() => {});
    },
  };
}
