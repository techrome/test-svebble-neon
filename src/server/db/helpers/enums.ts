import { sql } from "drizzle-orm";

export const USER_ROLE = {
  user: "user",
  admin: "admin",
} as const;
export const USER_ROLE_ENUM = [USER_ROLE.user, USER_ROLE.admin] as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const FILE_STATUS = {
  issued: "issued",
  active: "active",
  inactive: "inactive",
  deleted: "deleted",
  error: "error",
} as const;
export const FILE_STATUSES_ENUM = [
  FILE_STATUS.issued,
  FILE_STATUS.active,
  FILE_STATUS.inactive,
  FILE_STATUS.deleted,
  FILE_STATUS.error,
] as const;
export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];

export const FILE_PURPOSE = {
  avatar: "avatar",
  message_attachment: "message_attachment",
} as const;
export const FILE_PURPOSES_ENUM = [
  FILE_PURPOSE.avatar,
  FILE_PURPOSE.message_attachment,
] as const;
export type FilePurpose = (typeof FILE_PURPOSE)[keyof typeof FILE_PURPOSE];

export const literal = (s: string) => sql.raw(`'${s.replace(/'/g, "''")}'`);
