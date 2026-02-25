ALTER TABLE "channels" ADD COLUMN "messages_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "messages_updated_at";