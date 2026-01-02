ALTER TABLE "user" ADD COLUMN "pending_email_set_ats" timestamp;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "pending_email_set_at";