// 뉴스레터 구독 명단(Task 4, plan-3c). 로그인 없는 방문자의 이메일 구독이라 user 표와 이어지지 않는다.
// - 이중 동의: 신청하면 status=pending(확인 메일 발송) → 확인 링크를 누르면 subscribed. 동의는 신청한 순간의 것이라 consent_at 은 신청 시각이다.
//   consent_version 은 그때 화면에 있던 동의 문구의 판이다(정보통신망법 제50조① — 명시적 사전 동의의 증빙).
// - 수신거부: status=unsubscribed + unsubscribed_at. 동의·확인 증빙은 지우지 않고(분쟁 대비) expires_at 에 보유 기간을 둔다.
// - expires_at: pending(확인 안 한 신청)과 unsubscribed 에만 있고, 지나면 purgeExpiredSubscribers 가 지운다(개인정보 보호법 제21조①).
//   subscribed 는 null — 구독 중인 사람은 지우지 않는다.
// 저장하지 않는 것: IP·브라우저 정보·토큰(링크의 서명 토큰은 비밀값에서 매번 만든다). 시각은 앱이 넣는다(Task 4 D26 규칙).
import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

const tz = { withTimezone: true } as const

export const NEWSLETTER_STATUSES = ["pending", "subscribed", "unsubscribed"] as const
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number]

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 소문자로 맞춘 주소. 같은 사람이 두 번 들어오지 못하게 unique */
    email: text("email").notNull().unique(),
    status: text("status").$type<NewsletterStatus>().notNull(),
    locale: text("locale").notNull(),
    /** 어느 폼에서 왔는지(블록 id 등, 개인정보 아님) */
    source: text("source").notNull(),
    consentVersion: text("consent_version").notNull(),
    consentAt: timestamp("consent_at", tz).notNull(),
    confirmSentAt: timestamp("confirm_sent_at", tz),
    confirmedAt: timestamp("confirmed_at", tz),
    unsubscribedAt: timestamp("unsubscribed_at", tz),
    createdAt: timestamp("created_at", tz).notNull(),
    expiresAt: timestamp("expires_at", tz),
  },
  (t) => [
    index("newsletter_subscribers_status_id_idx").on(t.status, t.id),
    index("newsletter_subscribers_expires_at_idx").on(t.expiresAt),
    check("newsletter_subscribers_status_check", sql`${t.status} in ('pending', 'subscribed', 'unsubscribed')`),
  ],
).enableRLS() // 공개 표는 RLS 를 명시로 켠다(정책은 만들지 않는다 — 0010_explicit_rls)
