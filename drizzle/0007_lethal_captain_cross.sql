DROP INDEX "cleanup_index";--> statement-breakpoint
CREATE INDEX "cleanup_index" ON "files" USING btree ("created_at") WHERE "files"."status" in ('issued', 'inactive', 'deleted', 'error');