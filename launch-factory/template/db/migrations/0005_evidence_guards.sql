-- 증빙 기록 보호(v0 Task 14, 대장 D66③).
-- consent_records: 동의 이력은 고치지 않는다(UPDATE·TRUNCATE 거부). DELETE 는 허용한다 — 탈퇴 파기(개인정보 보호법 제21조제1항)가 지운다.
--   청약철회 제한 동의(withdrawal_limit)는 파기 전에 retained_transactions 로 옮긴다(전자상거래법 시행령 제6조제1항제2호).
-- retained_transactions: 보존 거래기록은 고치지 않는다(UPDATE·TRUNCATE 거부). DELETE 는 retain_until 이 지난 행만 허용한다 —
--   법정 기간(시행령 제6조제1항)이 끝나기 전에 지우지 못하게 한다.
-- 트리거는 역할과 상관없이 걸린다(표 소유자가 트리거를 끄는 것은 막지 못한다 — access_logs 와 같은 한계, task-3 보고).
CREATE FUNCTION "consent_records_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'consent_records is append-only: % refused', TG_OP;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "consent_records_no_update" BEFORE UPDATE ON "consent_records" FOR EACH ROW EXECUTE FUNCTION "consent_records_no_update"();
--> statement-breakpoint
CREATE TRIGGER "consent_records_no_truncate" BEFORE TRUNCATE ON "consent_records" FOR EACH STATEMENT EXECUTE FUNCTION "consent_records_no_update"();
--> statement-breakpoint
CREATE FUNCTION "retained_transactions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'retained_transactions is append-only: % refused', TG_OP;
  END IF;
  IF OLD.retain_until > now() THEN
    RAISE EXCEPTION 'retained_transactions: rows cannot be deleted before retain_until';
  END IF;
  RETURN OLD;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "retained_transactions_no_update_delete" BEFORE UPDATE OR DELETE ON "retained_transactions" FOR EACH ROW EXECUTE FUNCTION "retained_transactions_guard"();
--> statement-breakpoint
CREATE TRIGGER "retained_transactions_no_truncate" BEFORE TRUNCATE ON "retained_transactions" FOR EACH STATEMENT EXECUTE FUNCTION "retained_transactions_guard"();
