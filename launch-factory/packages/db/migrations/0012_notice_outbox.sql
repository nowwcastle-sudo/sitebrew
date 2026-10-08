-- D210: 마케팅 수신 처리 결과 통지 발신함(marketing_notice_outbox). 새 표는 0010 의 규칙대로 RLS 를 명시로 켠다(정책 없음 = 비소유자 기본 거부).
CREATE TABLE "marketing_notice_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"changes" jsonb NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "marketing_notice_outbox_status_ck" CHECK (status in ('pending', 'sent', 'exhausted', 'skipped')),
	CONSTRAINT "marketing_notice_outbox_source_ck" CHECK (source in ('sign_up', 'settings', 'unsubscribe_link')),
	CONSTRAINT "marketing_notice_outbox_attempts_ck" CHECK ("marketing_notice_outbox"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "marketing_notice_outbox" ADD CONSTRAINT "marketing_notice_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_notice_outbox_due_idx" ON "marketing_notice_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "marketing_notice_outbox_user_idx" ON "marketing_notice_outbox" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "marketing_notice_outbox" ENABLE ROW LEVEL SECURITY;
