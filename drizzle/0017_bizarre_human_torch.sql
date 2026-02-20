DROP INDEX "messages_id_index";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp (3) with time zone;