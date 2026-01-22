ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."file_status";--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('issued', 'active', 'inactive', 'deleted', 'error');--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE "public"."file_status" USING "status"::"public"."file_status";