ALTER TABLE "channels" ALTER COLUMN "messages_version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "messages" SET "edited_at" = "updated_at";