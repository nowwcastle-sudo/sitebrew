CREATE TABLE "idempotency_keys" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"form" text NOT NULL,
	"name" text,
	"contact" text NOT NULL,
	"contact_kind" text NOT NULL,
	"message" text NOT NULL,
	"locale" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"owner_notified_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	CONSTRAINT "inquiries_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inquiries_expires_at_idx" ON "inquiries" USING btree ("expires_at");