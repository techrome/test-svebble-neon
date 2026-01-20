CREATE TYPE "public"."file_purpose" AS ENUM('avatar', 'message_attachment');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('issued', 'claimed', 'active', 'inactive', 'rejected', 'deleted', 'error');--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"status" "file_status",
	"purpose" "file_purpose",
	"object_key" varchar(2000) NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "files_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleanup_index" ON "files" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_purpose_index" ON "files" USING btree ("owner_user_id","purpose","status");--> statement-breakpoint
CREATE UNIQUE INDEX "active_avatar_unique_index" ON "files" USING btree ("owner_user_id") WHERE "files"."purpose" = 'avatar' AND "files"."status" = 'active';