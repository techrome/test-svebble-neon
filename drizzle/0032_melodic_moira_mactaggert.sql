CREATE TABLE "reactions" (
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"emoji" varchar(64),
	"file_id" uuid,
	"sort_order" integer NOT NULL,
	"disabled_at" timestamp (3) with time zone,
	CONSTRAINT "reactions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "reactions_value_check" CHECK ((("reactions"."kind" = 'unicode' and "reactions"."emoji" is not null and "reactions"."file_id" is null) or ("reactions"."kind" = 'custom' and "reactions"."file_id" is not null and "reactions"."emoji" is null))),
	CONSTRAINT "reactions_sort_order_non_negative_check" CHECK ("reactions"."sort_order" >= 0),
	CONSTRAINT "reactions_kind_check" CHECK ("reactions"."kind" in ('unicode', 'custom'))
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"reaction_id" integer NOT NULL,
	"message_id" bigint NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_reaction_id_reactions_id_fk" FOREIGN KEY ("reaction_id") REFERENCES "public"."reactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_unicode_unique" ON "reactions" USING btree ("emoji") WHERE "reactions"."kind" = 'unicode';--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_file_unique" ON "reactions" USING btree ("file_id") WHERE "reactions"."kind" = 'custom';--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_unique" ON "message_reactions" USING btree ("message_id","reaction_id","user_id");--> statement-breakpoint
CREATE INDEX "message_reactions_user_message_index" ON "message_reactions" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "message_reactions_reaction_index" ON "message_reactions" USING btree ("reaction_id");