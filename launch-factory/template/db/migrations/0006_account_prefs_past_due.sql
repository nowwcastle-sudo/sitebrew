ALTER TABLE "user" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "past_due_since" timestamp with time zone;