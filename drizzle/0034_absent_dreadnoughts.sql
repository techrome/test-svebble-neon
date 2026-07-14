CREATE TABLE "message_reaction_groups" (
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_reaction_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"message_id" bigint NOT NULL,
	"reaction_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_reaction_groups" ADD CONSTRAINT "message_reaction_groups_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reaction_groups" ADD CONSTRAINT "message_reaction_groups_reaction_id_reactions_id_fk" FOREIGN KEY ("reaction_id") REFERENCES "public"."reactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_reaction_groups_unique" ON "message_reaction_groups" USING btree ("message_id","reaction_id");