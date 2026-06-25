import { sql } from "drizzle-orm";

import { toObject } from "@/utils/validators/helpers/custom";

export const USER_ROLE_ENUM = ["user", "admin"] as const;
export const USER_ROLE = toObject(USER_ROLE_ENUM);
export type UserRole = (typeof USER_ROLE_ENUM)[number];

export const FILE_STATUSES_ENUM = [
  "issued",
  "validated",
  "active",
  "inactive",
  "deleted",
  "error",
] as const;
export const FILE_STATUS = toObject(FILE_STATUSES_ENUM);
export type FileStatus = (typeof FILE_STATUSES_ENUM)[number];

export const FILE_PURPOSES_ENUM = ["avatar", "message_attachment"] as const;
export const FILE_PURPOSE = toObject(FILE_PURPOSES_ENUM);
export type FilePurpose = (typeof FILE_PURPOSES_ENUM)[number];

export const AUDIT_LOG_ACTION_ENUM = ["signup", "login", "logout"] as const;
export const AUDIT_LOG_ACTION = toObject(AUDIT_LOG_ACTION_ENUM);
export type AuditLogAction = (typeof AUDIT_LOG_ACTION_ENUM)[number];

export const literal = (s: string) => sql.raw(`'${s.replace(/'/g, "''")}'`);
