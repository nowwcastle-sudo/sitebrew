CREATE TABLE "toss_ledger_charges" (
	"order_id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"billing_month" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"payment_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "toss_charge_month_ck" CHECK ("toss_ledger_charges"."billing_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "toss_charge_amount_ck" CHECK ("toss_ledger_charges"."amount" > 0),
	CONSTRAINT "toss_charge_state_ck" CHECK (("toss_ledger_charges"."status" = 'paid' AND "toss_ledger_charges"."payment_key" IS NOT NULL AND "toss_ledger_charges"."paid_at" IS NOT NULL) OR ("toss_ledger_charges"."status" = 'in_flight' AND "toss_ledger_charges"."payment_key" IS NULL AND "toss_ledger_charges"."paid_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "toss_ledger_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "toss_ledger_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"customer_key" text NOT NULL,
	"encrypted_billing_key" text,
	"plan_id" text NOT NULL,
	"order_name" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "toss_subscription_amount_ck" CHECK ("toss_ledger_subscriptions"."amount" > 0),
	CONSTRAINT "toss_subscription_status_ck" CHECK ("toss_ledger_subscriptions"."status" in ('enabled', 'cancel_requested', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "toss_registration_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"state_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"customer_key" text NOT NULL,
	"plan_id" text NOT NULL,
	"order_name" text NOT NULL,
	"amount" integer NOT NULL,
	"auth_key_hash" text,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "toss_registration_sessions_state_hash_unique" UNIQUE("state_hash"),
	CONSTRAINT "toss_registration_sessions_customer_key_unique" UNIQUE("customer_key"),
	CONSTRAINT "toss_registration_sessions_auth_key_hash_unique" UNIQUE("auth_key_hash"),
	CONSTRAINT "toss_registration_amount_ck" CHECK ("toss_registration_sessions"."amount" > 0),
	CONSTRAINT "toss_registration_status_ck" CHECK ("toss_registration_sessions"."status" in ('pending', 'issuing', 'cancel_requested', 'registered', 'canceled', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "toss_registration_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "toss_ledger_charges" ADD CONSTRAINT "toss_ledger_charges_subscription_id_toss_ledger_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."toss_ledger_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD CONSTRAINT "toss_ledger_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "toss_registration_sessions" ADD CONSTRAINT "toss_registration_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "toss_charge_month_uq" ON "toss_ledger_charges" USING btree ("subscription_id","billing_month");--> statement-breakpoint
CREATE UNIQUE INDEX "toss_charge_inflight_uq" ON "toss_ledger_charges" USING btree ("subscription_id") WHERE "toss_ledger_charges"."status" = 'in_flight';--> statement-breakpoint
CREATE UNIQUE INDEX "toss_subscription_user_product_live_uq" ON "toss_ledger_subscriptions" USING btree ("user_id","product_id") WHERE "toss_ledger_subscriptions"."status" in ('enabled', 'cancel_requested');--> statement-breakpoint
CREATE UNIQUE INDEX "toss_registration_user_product_open_uq" ON "toss_registration_sessions" USING btree ("user_id","product_id") WHERE "toss_registration_sessions"."status" in ('pending', 'issuing', 'cancel_requested');