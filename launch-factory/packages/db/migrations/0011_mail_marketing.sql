-- LFMAIL: 한 번만 보내는 메일 기록(mail_ledger — 환영 G05·마케팅 2년 재확인 A16), 로그인한 기기 기록(known_devices — 새 기기 알림 C06),
-- 동의 기록의 출처에 수신거부 링크(unsubscribe_link)와 2년 재확인(reconfirm)을 더한다. 새 표는 0010 의 규칙대로 RLS 를 명시로 켠다(정책 없음 = 비소유자 기본 거부).
CREATE TABLE "known_devices" (
	"user_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"label" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "known_devices_user_id_fingerprint_pk" PRIMARY KEY("user_id","fingerprint")
);
--> statement-breakpoint
CREATE TABLE "mail_ledger" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"ref_at" timestamp with time zone,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mail_ledger_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_source_ck";--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_ledger" ADD CONSTRAINT "mail_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "known_devices_user_idx" ON "known_devices" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_source_ck" CHECK (source in ('sign_up', 'settings', 'checkout', 'unsubscribe_link', 'reconfirm'));
--> statement-breakpoint
ALTER TABLE "known_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mail_ledger" ENABLE ROW LEVEL SECURITY;
