CREATE TABLE "inquiry_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"body" text NOT NULL,
	"admin_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"mailed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inquiry_replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiry_replies" ADD CONSTRAINT "inquiry_replies_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_replies" ADD CONSTRAINT "inquiry_replies_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_replies_inquiry_idx" ON "inquiry_replies" USING btree ("inquiry_id","created_at");