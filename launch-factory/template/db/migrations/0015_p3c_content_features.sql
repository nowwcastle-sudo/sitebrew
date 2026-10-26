CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"locale" text NOT NULL,
	"source" text NOT NULL,
	"consent_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"confirm_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_status_check" CHECK ("newsletter_subscribers"."status" in ('pending', 'subscribed', 'unsubscribed'))
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"user_id" text,
	"author_name" text NOT NULL,
	"rating" integer,
	"title" text,
	"body" text NOT NULL,
	"locale" text NOT NULL,
	"status" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"answer_body" text,
	"answered_at" timestamp with time zone,
	"answered_by" text,
	"hidden_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "reviews_kind_ck" CHECK ("reviews"."kind" in ('review', 'question')),
	CONSTRAINT "reviews_status_ck" CHECK ("reviews"."status" in ('published', 'pending', 'hidden')),
	CONSTRAINT "reviews_rating_ck" CHECK (("reviews"."kind" = 'review' and "reviews"."rating" between 1 and 5) or ("reviews"."kind" = 'question' and "reviews"."rating" is null))
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "search_documents_kind_ref_unique" UNIQUE("kind","ref")
);
--> statement-breakpoint
ALTER TABLE "search_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"declared_bytes" integer NOT NULL,
	"size_bytes" integer,
	"file_name" text,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	CONSTRAINT "stored_files_key_unique" UNIQUE("key"),
	CONSTRAINT "stored_files_status_check" CHECK ("stored_files"."status" in ('pending', 'ready', 'purged'))
);
--> statement-breakpoint
ALTER TABLE "stored_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "status" text DEFAULT 'received' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_status_id_idx" ON "newsletter_subscribers" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_expires_at_idx" ON "newsletter_subscribers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reviews_subject_idx" ON "reviews" USING btree ("subject_type","subject_id","status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_user_subject_idx" ON "reviews" USING btree ("user_id","subject_type","subject_id") WHERE "reviews"."kind" = 'review' and "reviews"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "search_documents_locale_idx" ON "search_documents" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "stored_files_expires_at_idx" ON "stored_files" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "inquiries_user_idx" ON "inquiries" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_status_check" CHECK ("inquiries"."status" in ('received', 'in_progress', 'done'));