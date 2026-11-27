ALTER TABLE "toss_ledger_charges" DROP CONSTRAINT "toss_charge_state_ck";--> statement-breakpoint
DROP INDEX "toss_charge_month_uq";--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "billing_anchor" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "next_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "retry_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "toss_charge_month_active_uq" ON "toss_ledger_charges" USING btree ("subscription_id","billing_month") WHERE "toss_ledger_charges"."status" in ('in_flight', 'paid');--> statement-breakpoint
ALTER TABLE "toss_ledger_charges" ADD CONSTRAINT "toss_charge_state_ck" CHECK (("toss_ledger_charges"."status" = 'paid' AND "toss_ledger_charges"."payment_key" IS NOT NULL AND "toss_ledger_charges"."paid_at" IS NOT NULL) OR ("toss_ledger_charges"."status" in ('in_flight', 'declined') AND "toss_ledger_charges"."payment_key" IS NULL AND "toss_ledger_charges"."paid_at" IS NULL));