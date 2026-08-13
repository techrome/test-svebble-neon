import { LeafUnion, P } from "@/utils/permissions";
import { User } from "@/utils/validators/shared/user";

type Permission = LeafUnion<typeof P>;
export type RolePermissions = readonly Permission[];

const guestPermissions = [
  P.messages.create,
  P.messages.update,
  P.messages.delete,
  P.user.delete,
  P.messages.report,
  P.messageReactions.toggle,
  P.otherUsers.basicInfo.read,
] as const satisfies RolePermissions;

const notVerifiedUserPermissions = [
  ...guestPermissions,
  P.account.read,
  P.user.avatar.update,
  P.user.avatar.create,
  P.user.basicInfo.update,
  P.user.email.update,
  P.user.password.update,
  P.user.username.update,
] as const satisfies RolePermissions;

const userPermissions = [
  ...notVerifiedUserPermissions,
  P.messageAttachments.create,
  P.messageAttachments.delete,
] as const satisfies RolePermissions;

const toSet = <T extends string>(array: readonly T[]) => new Set<T>(array);
const permissionSets = {
  guest: toSet(guestPermissions),
  notVerifiedUser: toSet(notVerifiedUserPermissions),
  user: toSet(userPermissions),
};

const getPermissionSet = (user: User) => {
  if (user.role === "user") {
    if (user.isAnonymous) return permissionSets.guest;
    return user.emailVerified
      ? permissionSets.user
      : permissionSets.notVerifiedUser;
  }

  return new Set<Permission>();
};

export const hasPermissions = (
  user: User | undefined,
  neededPerms: RolePermissions
) => {
  if (!user) return false;
  if (user.role === "admin") return true;

  const effectivePerms = getPermissionSet(user);
  return neededPerms.every((reqPerm) => effectivePerms.has(reqPerm));
};
