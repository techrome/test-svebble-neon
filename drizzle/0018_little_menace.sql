CREATE TABLE "channels" (
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "channels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"messages_updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "channel_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_user_id_index" ON "channels" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_active_channel_id_id_index" ON "messages" USING btree ("channel_id","id") WHERE "messages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "messages_user_id" ON "messages" USING btree ("user_id");