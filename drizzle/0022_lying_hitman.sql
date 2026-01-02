ALTER TABLE "user" ADD COLUMN "pending_emails" text;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "pending_email";