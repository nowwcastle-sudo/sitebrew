-- (손으로 씀 — LFFIX F11) 공개(public) 표 전부에 행 수준 보안(RLS)을 명시로 켠다.
-- 지금까지는 Supabase 의 이벤트 트리거(rls_auto_enable)가 새 표에 자동으로 켜 주는 것에만 기댔다 — 그 트리거가 꺼지거나 다른 Postgres 로 옮기면
-- 같은 보장이 없다(관통 1회차 보고 §2). 이미 켜진 표에 다시 켜는 것은 아무 변화가 없다(멱등).
-- 정책(CREATE POLICY)은 만들지 않는다: 정책이 없으면 anon·authenticated 같은 비소유자 역할은 행을 읽지도 쓰지도 못하고(기본 거부),
-- 앱은 표 소유자(접속 사용자)로 붙어 RLS 를 지난다(FORCE 를 쓰지 않는다). 접근을 바꾸는 정책은 제품이 필요할 때 더한다.
ALTER TABLE "access_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_deletions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "marketing_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retained_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "two_factor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
