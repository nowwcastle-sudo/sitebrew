// 동의 기록(v0 Task 18, 대장 D40). 쓰는 곳: 가입(@launch-factory/auth), 마케팅 수신 설정·결제 직전 청약철회 동의(@launch-factory/consent).
// - consent_records: 추가만 하는 이력. 한 행 = 한 번의 의사 표시(무엇에·동의했는지·어느 판에·언제·어디서).
//   약관·개인정보 동의의 증빙이고, 마케팅 수신 동의·거부·철회의 이력이다(정보통신망법 제50조제7항 — 처리 결과 통지의 근거,
//   같은 법 시행령 제62조의3 — 2년마다 수신동의 여부 확인에 동의한 날짜가 필요하다).
// - marketing_consents: 채널별 현재 상태와 마지막으로 바꾼 때(updatedAt). NotifyPort.consents() 가 읽는다.
// 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다 — Task 4 D26 규칙과 같다).
import { sql } from "drizzle-orm"
import { boolean, check, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`)

export const MARKETING_CHANNELS = ["email", "sms", "kakao", "push"] as const
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]

export const CONSENT_KINDS = [
  "terms",
  "privacy",
  "age_over_14",
  "marketing_email",
  "marketing_sms",
  "marketing_kakao",
  "marketing_push",
  "withdrawal_limit",
] as const
export type ConsentKind = (typeof CONSENT_KINDS)[number]

export const CONSENT_SOURCES = ["sign_up", "settings", "checkout", "unsubscribe_link", "reconfirm"] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ConsentKind>().notNull(),
    granted: boolean("granted").notNull(),
    /** 동의한 문서의 판(약관·개인정보 처리방침·청약철회 안내). 판이 없는 항목(만 14세 확인·마케팅 채널)은 null */
    version: text("version"),
    source: text("source").$type<ConsentSource>().notNull(),
    /** 사용자가 본 문구의 언어 */
    locale: text("locale"),
    /** 무엇에 대한 동의인지(결제 직전 동의면 요금제 id) */
    subject: text("subject"),
    createdAt: timestamp("created_at", tz).notNull(),
  },
  (t) => [
    check("consent_records_kind_ck", inList("kind", CONSENT_KINDS)),
    check("consent_records_source_ck", inList("source", CONSENT_SOURCES)),
    index("consent_records_user_idx").on(t.userId, t.kind, t.createdAt),
  ],
)

export const marketingConsents = pgTable(
  "marketing_consents",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: text("channel").$type<MarketingChannel>().notNull(),
    granted: boolean("granted").notNull(),
    updatedAt: timestamp("updated_at", tz).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channel] }), check("marketing_consents_channel_ck", inList("channel", MARKETING_CHANNELS))],
)
