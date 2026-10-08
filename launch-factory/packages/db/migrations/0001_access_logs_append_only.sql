-- 접속기록 위·변조 방지(「개인정보의 안전성 확보조치 기준」 제8조제3항). access_logs는 추가 전용이다.
--   UPDATE·TRUNCATE: 항상 거부
--   DELETE: 접속일시가 1년(제8조제1항 최소 보관 기간)을 넘은 행만 허용 — 파기 작업이 2년 설정이면 그보다 늦게 지운다
-- 트리거는 역할과 상관없이 걸린다(표 소유자가 트리거를 끄는 것까지는 막지 못한다 — 해시 사슬은 다음 단계, docs/qa/task-3-report.md).
CREATE FUNCTION "access_logs_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'access_logs is append-only: % refused', TG_OP;
  END IF;
  IF OLD.occurred_at > now() - interval '1 year' THEN
    RAISE EXCEPTION 'access_logs: rows younger than 1 year cannot be deleted';
  END IF;
  RETURN OLD;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "access_logs_no_update_delete" BEFORE UPDATE OR DELETE ON "access_logs" FOR EACH ROW EXECUTE FUNCTION "access_logs_append_only"();
--> statement-breakpoint
CREATE TRIGGER "access_logs_no_truncate" BEFORE TRUNCATE ON "access_logs" FOR EACH STATEMENT EXECUTE FUNCTION "access_logs_append_only"();
