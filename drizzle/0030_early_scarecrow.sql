CREATE TABLE "message_attachments" (
	"message_id" bigint NOT NULL,
	"file_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "message_attachments_sort_order_non_negative_check" CHECK ("message_attachments"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "original_name" varchar(255);--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "extension" varchar(32);--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_attachments_message_index" ON "message_attachments" USING btree ("message_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "message_attachments_file_unique_index" ON "message_attachments" USING btree ("file_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_size_bytes_non_negative_check" CHECK ("files"."size_bytes" >= 0);