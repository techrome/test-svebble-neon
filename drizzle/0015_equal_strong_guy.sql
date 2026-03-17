CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"ip_address" varchar(64),
	"user_agent" varchar(512),
	"session_id" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "action_check" CHECK ("audit_log"."action" in ('signup', 'login', 'logout'))
);
--> statement-breakpoint
CREATE INDEX "audit_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_created_at_index" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_created_at_index" ON "audit_log" USING btree ("action","created_at");