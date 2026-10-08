// 접속기록 저장소. 근거: 「개인정보의 안전성 확보조치 기준」(개인정보보호위원회 고시 제2026-9호, 2026-07-01 시행,
//   https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000281400 — 국가법령정보센터 Open API target=admrul, 2026-09-30 확인)
//   제2조제3호 칸: 식별자(actor_id)·접속일시(occurred_at)·접속지 정보(ip)·처리한 정보주체 정보(subjects)·수행업무(action)
//   제8조제2항: 개인정보 다운로드 상황을 점검한다 → download 칸
//   제8조제1항: 1년 이상 보관, 정보주체 5만 명 이상·고유식별/민감정보·기간통신사업자면 2년 이상 → ACCESS_LOG_RETENTION
//   제8조제3항: 위·변조 방지 → 마이그레이션 0001_access_logs_append_only.sql 트리거(UPDATE 거부, 1년 안 된 행 DELETE 거부)
// 칸 이름은 @launch-factory/security accessLog()의 AccessRecord와 같다(Task 2). 대상은 정보주체가 아닌 접속자(개인정보취급자)다.
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

const tz = { withTimezone: true } as const

/** 고시 제8조제1항 보관 기간(개월). "2y"는 5만 명 이상·고유식별/민감정보 처리·기간통신사업자일 때 제품 설정으로 고른다. */
export const ACCESS_LOG_RETENTION = { "1y": 12, "2y": 24 } as const
export type AccessLogRetention = keyof typeof ACCESS_LOG_RETENTION
export const DEFAULT_ACCESS_LOG_RETENTION: AccessLogRetention = "1y"

export const accessLogs = pgTable(
  "access_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id"),
    /** 식별자: 접속한 개인정보취급자의 계정 id */
    actorId: text("actor_id").notNull(),
    /** 접속지 정보: IP */
    ip: text("ip").notNull(),
    /** 처리한 정보주체 정보: 정보주체의 내부 id 목록(이메일·전화 같은 개인정보 자체는 넣지 않는다) */
    subjects: text("subjects").array().notNull(),
    /** 수행업무: 조회·수정·삭제·다운로드·대리 로그인 등 */
    action: text("action").notNull(),
    /** 무엇을(표·화면 이름) */
    target: text("target"),
    /** 접속일시 */
    occurredAt: timestamp("occurred_at", tz).notNull(),
    /** 개인정보 다운로드 여부(고시 제8조제2항 점검 대상) */
    download: boolean("download").notNull().default(false),
  },
  (t) => [index("access_logs_occurred_idx").on(t.occurredAt), index("access_logs_actor_idx").on(t.actorId)],
)
