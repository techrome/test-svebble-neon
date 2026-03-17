DROP INDEX "channels_user_id_index";--> statement-breakpoint
CREATE INDEX "channels_active_user_id_index" ON "channels" USING btree ("user_id") WHERE "channels"."deleted_at" IS NULL;