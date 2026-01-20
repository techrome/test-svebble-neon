import { sql } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";

export const FILE_STATUS = {
  issued: "issued",
  claimed: "claimed",
  active: "active",
  inactive: "inactive",
  rejected: "rejected",
  deleted: "deleted",
  error: "error",
} as const;
export const FILE_PURPOSE = {
  avatar: "avatar",
  message_attachment: "message_attachment",
} as const;

export const FILE_STATUSES_ENUM = [
  FILE_STATUS.issued,
  FILE_STATUS.claimed,
  FILE_STATUS.active,
  FILE_STATUS.inactive,
  FILE_STATUS.rejected,
  FILE_STATUS.deleted,
  FILE_STATUS.error,
] as const;
export const FILE_PURPOSES_ENUM = [
  FILE_PURPOSE.avatar,
  FILE_PURPOSE.message_attachment,
] as const;

export const literal = (s: string) => sql.raw(`'${s.replace(/'/g, "''")}'`);
