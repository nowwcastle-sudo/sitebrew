ALTER TABLE "bookings" DROP CONSTRAINT "bookings_deposit_status_ck";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_amount" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_currency" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_refunded_amount" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_deposit_ref_uq" ON "bookings" USING btree ("deposit_ref");--> statement-breakpoint
CREATE INDEX "bookings_deposit_due_idx" ON "bookings" USING btree ("deposit_status","deposit_due_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_amount_ck" CHECK ("bookings"."deposit_amount" is null or "bookings"."deposit_amount" >= 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_refunded_ck" CHECK ("bookings"."deposit_refunded_amount" is null or ("bookings"."deposit_refunded_amount" >= 0 and "bookings"."deposit_refunded_amount" <= coalesce("bookings"."deposit_amount", 0)));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deposit_status_ck" CHECK (deposit_status in ('none', 'pending', 'paid', 'refunding', 'refunded', 'forfeited', 'voided'));