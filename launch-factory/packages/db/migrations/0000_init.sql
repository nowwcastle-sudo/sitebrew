CREATE TABLE "access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"actor_id" text NOT NULL,
	"ip" text NOT NULL,
	"subjects" text[] NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"download" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"grace_until" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "account_deletions_status_ck" CHECK (status in ('pending', 'cancelled', 'purged'))
);
--> statement-breakpoint
CREATE TABLE "retained_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"subject_ref" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retained_transactions_kind_ck" CHECK (kind in ('advertising', 'contract', 'payment', 'dispute'))
);
--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"admin_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"ip_address" text,
	"reason" text,
	"meta" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_sub_id" text NOT NULL,
	"status" text NOT NULL,
	"plan_id" text NOT NULL,
	"scheduled_plan_id" text,
	"pending_price_change" jsonb,
	"current_period_end" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"paused_until" timestamp with time zone,
	"payment_issue" jsonb,
	"updated_from_event_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_ck" CHECK (status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"payload_hash" text NOT NULL,
	CONSTRAINT "webhook_events_pk" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_occurred_idx" ON "access_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "access_logs_actor_idx" ON "access_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletions_pending_uq" ON "account_deletions" USING btree ("user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "account_deletions_grace_idx" ON "account_deletions" USING btree ("grace_until");--> statement-breakpoint
CREATE UNIQUE INDEX "retained_transactions_ref_uq" ON "retained_transactions" USING btree ("provider","provider_ref","kind");--> statement-breakpoint
CREATE INDEX "retained_transactions_retain_idx" ON "retained_transactions" USING btree ("retain_until");--> statement-breakpoint
CREATE INDEX "admin_actions_admin_idx" ON "admin_actions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "admin_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_sub_uq" ON "subscriptions" USING btree ("provider","provider_sub_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("org_id");