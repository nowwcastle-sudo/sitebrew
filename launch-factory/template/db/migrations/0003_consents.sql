CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"version" text,
	"source" text NOT NULL,
	"locale" text,
	"subject" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "consent_records_kind_ck" CHECK (kind in ('terms', 'privacy', 'age_over_14', 'marketing_email', 'marketing_sms', 'marketing_kakao', 'marketing_push', 'withdrawal_limit')),
	CONSTRAINT "consent_records_source_ck" CHECK (source in ('sign_up', 'settings', 'checkout'))
);
--> statement-breakpoint
CREATE TABLE "marketing_consents" (
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"granted" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "marketing_consents_user_id_channel_pk" PRIMARY KEY("user_id","channel"),
	CONSTRAINT "marketing_consents_channel_ck" CHECK (channel in ('email', 'sms', 'kakao', 'push'))
);
--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_records_user_idx" ON "consent_records" USING btree ("user_id","kind","created_at");