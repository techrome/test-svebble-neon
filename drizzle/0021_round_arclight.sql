ALTER TABLE "audit_log" DROP CONSTRAINT "action_check";--> statement-breakpoint
DROP INDEX "cleanup_index";--> statement-breakpoint
DROP INDEX "user_purpose_index";--> statement-breakpoint
DROP INDEX "active_avatar_unique_index";--> statement-breakpoint
DROP INDEX "messages_active_channel_id_id_index";--> statement-breakpoint
DROP INDEX "messages_user_id";--> statement-breakpoint
DROP INDEX "channels_active_user_id_index";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "purpose" SET DATA TYPE text;--> statement-breakpoint
CREATE INDEX "files_cleanup_index" ON "files" USING btree ("created_at") WHERE "files"."status" in ('issued', 'inactive', 'deleted', 'error');--> statement-breakpoint
CREATE INDEX "files_user_purpose_index" ON "files" USING btree ("owner_user_id","purpose","status");--> statement-breakpoint
CREATE UNIQUE INDEX "files_active_avatar_unique_index" ON "files" USING btree ("owner_user_id") WHERE "files"."purpose" = 'avatar' AND "files"."status" = 'active';--> statement-breakpoint
CREATE INDEX "messages_active_messages_by_user_index" ON "messages" USING btree ("user_id","id") WHERE "messages"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "messages_active_messages_index" ON "messages" USING btree ("channel_id","id") WHERE "messages"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "messages_cleanup_index" ON "messages" USING btree ("deleted_at","id") WHERE "messages"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "channels_active_index" ON "channels" USING btree ("id") WHERE "channels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "channels_cleanup_index" ON "channels" USING btree ("deleted_at","id") WHERE "channels"."deleted_at" is not null;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_status_check" CHECK ("files"."status" in ('issued', 'active', 'inactive', 'deleted', 'error'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_check" CHECK ("files"."purpose" in ('avatar', 'message_attachment'));--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_action_check" CHECK ("audit_log"."action" in ('signup', 'login', 'logout'));--> statement-breakpoint
DROP TYPE "public"."file_purpose";--> statement-breakpoint
DROP TYPE "public"."file_status";