ALTER TABLE "toss_ledger_subscriptions" ADD COLUMN "schedule_hold_reason" text;--> statement-breakpoint
ALTER TABLE "toss_ledger_charges" ADD COLUMN "next_reconcile_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "toss_ledger_subscriptions" s SET "schedule_hold_reason"='legacy_paid' WHERE s.billing_anchor IS NULL AND EXISTS (SELECT 1 FROM "toss_ledger_charges" c WHERE c.subscription_id=s.id AND c.status='paid');--> statement-breakpoint
ALTER TABLE "toss_ledger_subscriptions" ADD CONSTRAINT "toss_schedule_hold_reason_ck" CHECK ("schedule_hold_reason" IS NULL OR "schedule_hold_reason" in ('legacy_paid','overdue','credential_unavailable'));
