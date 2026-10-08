ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
-- (손으로 더함 — v0 Task 16) 관리자 행동 기록 위·변조 방지. admin_actions 는 관리자가 사용자 개인정보를 본·내려받은·바꾼 기록이라
-- access_logs(0001)와 같은 규칙을 건다(「개인정보의 안전성 확보조치 기준」 제8조 — 조문 확인은 task-3 보고).
--   UPDATE·TRUNCATE: 항상 거부
--   DELETE: 1년이 지난 행만 허용(보관 기간을 정하는 일은 대장 D14x)
-- 트리거는 역할과 상관없이 걸린다(표 소유자가 트리거를 끄는 것까지는 막지 못한다 — access_logs 와 같은 한계).
CREATE FUNCTION "admin_actions_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'admin_actions is append-only: % refused', TG_OP;
  END IF;
  IF OLD.occurred_at > now() - interval '1 year' THEN
    RAISE EXCEPTION 'admin_actions: rows younger than 1 year cannot be deleted';
  END IF;
  RETURN OLD;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "admin_actions_no_update_delete" BEFORE UPDATE OR DELETE ON "admin_actions" FOR EACH ROW EXECUTE FUNCTION "admin_actions_append_only"();
--> statement-breakpoint
CREATE TRIGGER "admin_actions_no_truncate" BEFORE TRUNCATE ON "admin_actions" FOR EACH STATEMENT EXECUTE FUNCTION "admin_actions_append_only"();
