ALTER TABLE "message_reactions" DROP CONSTRAINT "message_reactions_reaction_id_reactions_id_fk";
--> statement-breakpoint
ALTER TABLE "message_reactions" DROP CONSTRAINT "message_reactions_message_id_messages_id_fk";
--> statement-breakpoint
DROP INDEX "message_reactions_user_message_index";--> statement-breakpoint
DROP INDEX "message_reactions_reaction_index";--> statement-breakpoint
DROP INDEX "message_reactions_unique";--> statement-breakpoint
ALTER TABLE "message_reactions" ADD COLUMN "id" bigint PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "message_reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "message_reactions" ADD COLUMN "group_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "message_reaction_groups" ADD COLUMN "reaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_group_id_message_reaction_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."message_reaction_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_reactions_group_id_index" ON "message_reactions" USING btree ("group_id","id");--> statement-breakpoint
CREATE INDEX "message_reactions_user_index" ON "message_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_reaction_groups_reaction_index" ON "message_reaction_groups" USING btree ("reaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_unique" ON "message_reactions" USING btree ("group_id","user_id");--> statement-breakpoint
ALTER TABLE "message_reactions" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "message_reactions" DROP COLUMN "reaction_id";--> statement-breakpoint
ALTER TABLE "message_reactions" DROP COLUMN "message_id";--> statement-breakpoint
ALTER TABLE "message_reaction_groups" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "message_reaction_groups" ADD CONSTRAINT "message_reaction_groups_reaction_count_non_negative_check" CHECK ("message_reaction_groups"."reaction_count" >= 0);