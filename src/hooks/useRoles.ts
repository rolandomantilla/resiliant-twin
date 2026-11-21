import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { trpc } from "@/integrations/trpc/react";

export type ManagedRole = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isDefault: boolean;
};

export type RoleInput = {
  name: string;
  description?: string;
  permissions: string[];
};

/**
 * Types are pinned rather than inferred because `@/integrations/trpc/react` is
 * template-owned and only resolves once base is overlaid into an app. They
 * mirror the rbac router.
 */
export type ManagedMember = {
  id: string;
  email: string;
  aisUserId: string | null;
  roleId: string | null;
  pendingRoleId: string | null;
};

export type InvitedNotSignedIn = {
  appUserId: string;
  aisUserId: string;
  email: string;
  name: string | null;
  status: string;
};

export type MemberListing = {
  members: ManagedMember[];
  invitedNotSignedIn: InvitedNotSignedIn[];
};

export function useMembers(): UseQueryResult<MemberListing> {
  const t = trpc.useTRPC();
  return useQuery(t.rbac.listMembers.queryOptions()) as UseQueryResult<MemberListing>;
}

export type RbacStatus = {
  rbacActive: boolean;
  authEnabled: boolean;
  isOwner: boolean;
};

export function useRbacStatus(): UseQueryResult<RbacStatus> {
  const t = trpc.useTRPC();
  return useQuery(t.rbac.status.queryOptions()) as UseQueryResult<RbacStatus>;
}

export function useRoles(): UseQueryResult<ManagedRole[]> {
  const t = trpc.useTRPC();
  return useQuery(t.rbac.listRoles.queryOptions()) as UseQueryResult<ManagedRole[]>;
}

function useRoleMutation<TVariables>(
  pick: (t: ReturnType<typeof trpc.useTRPC>) => unknown,
): UseMutationResult<unknown, Error, TVariables> {
  const t = trpc.useTRPC();
  const queryClient = useQueryClient();
  const options = (pick(t) as { mutationOptions: () => object }).mutationOptions();

  return useMutation({
    ...options,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: (t.rbac.listRoles.queryOptions() as { queryKey: unknown[] }).queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: (t.rbac.listMembers.queryOptions() as { queryKey: unknown[] }).queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: (t.rbac.me.queryOptions() as { queryKey: unknown[] }).queryKey,
      });
    },
  }) as UseMutationResult<unknown, Error, TVariables>;
}

export function useCreateRole() {
  return useRoleMutation<RoleInput>((t) => t.rbac.createRole);
}

export function useUpdateRole() {
  return useRoleMutation<RoleInput & { roleId: string }>((t) => t.rbac.updateRole);
}

export function useDeleteRole() {
  return useRoleMutation<{ roleId: string }>((t) => t.rbac.deleteRole);
}

export function useSetDefaultRole() {
  return useRoleMutation<{ roleId: string }>((t) => t.rbac.setDefaultRole);
}

export function useAssignRole() {
  return useRoleMutation<{ memberId: string; roleId: string }>((t) => t.rbac.assignRole);
}

export function usePreAssignRole() {
  return useRoleMutation<{ email: string; roleId: string }>((t) => t.rbac.preAssignRole);
}
