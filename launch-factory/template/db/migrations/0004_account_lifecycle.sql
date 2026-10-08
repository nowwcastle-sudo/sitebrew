ALTER TABLE "account_deletions" DROP CONSTRAINT "account_deletions_status_ck";--> statement-breakpoint
DROP INDEX "account_deletions_pending_uq";--> statement-breakpoint
ALTER TABLE "account_deletions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account_deletions" ADD COLUMN "subject_ref" text;--> statement-breakpoint
ALTER TABLE "account_deletions" ADD COLUMN "analytics_erased_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_deletions" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_deletions" ADD COLUMN "last_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletions_open_uq" ON "account_deletions" USING btree ("user_id") WHERE status in ('pending', 'purging');--> statement-breakpoint
ALTER TABLE "account_deletions" ADD CONSTRAINT "account_deletions_status_ck" CHECK (status in ('pending', 'purging', 'cancelled', 'purged'));