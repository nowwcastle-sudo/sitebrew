CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"service" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"name" text,
	"contact" text NOT NULL,
	"contact_kind" text NOT NULL,
	"note" text,
	"status" text NOT NULL,
	"deposit_status" text DEFAULT 'none' NOT NULL,
	"deposit_ref" text,
	"locale" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"owner_notified_at" timestamp with time zone,
	"confirmation_sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_status_ck" CHECK (status in ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
	CONSTRAINT "bookings_deposit_status_ck" CHECK (deposit_status in ('none', 'pending', 'paid', 'refunded')),
	CONSTRAINT "bookings_cancelled_by_ck" CHECK ("bookings"."cancelled_by" is null or "bookings"."cancelled_by" in ('booker', 'owner', 'system')),
	CONSTRAINT "bookings_party_size_ck" CHECK ("bookings"."party_size" >= 1),
	CONSTRAINT "bookings_range_ck" CHECK ("bookings"."ends_at" > "bookings"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"channel" text,
	"purpose" text NOT NULL,
	"template" text NOT NULL,
	"to_last4" text NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"reason" text,
	"provider_ref" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "notifications_channel_ck" CHECK ("notifications"."channel" is null or "notifications"."channel" in ('alimtalk', 'sms', 'lms')),
	CONSTRAINT "notifications_purpose_ck" CHECK (purpose in ('transactional', 'marketing')),
	CONSTRAINT "notifications_status_ck" CHECK (status in ('sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"expiration_time" bigint,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_success_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_service_starts_idx" ON "bookings" USING btree ("service","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_starts_idx" ON "bookings" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_expires_at_idx" ON "bookings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_expires_at_idx" ON "notifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
