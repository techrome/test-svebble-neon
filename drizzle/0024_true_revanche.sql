DROP INDEX "messages_active_messages_index";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" bigint;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_active_messages_and_replies_index" ON "messages" USING btree ("channel_id","id","reply_to_message_id") WHERE "messages"."deleted_at" is null;