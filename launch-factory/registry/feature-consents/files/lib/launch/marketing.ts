// launch-factory: 광고성 메일 보내기와 2년 재확인(LFMAIL — G03·G07·A16). 광고성 메일은 **이 파일의 sendMarketingEmail 로만** 보낸다:
//   ① 동의·재확인·야간 점검(canSendMarketing) ② 받는 사람 전용 로그인 없는 수신거부 링크(서명 토큰) ③ 법정 표시·수신거부 헤더는 메일러가 단다(제목 「(광고)」·사업자 표시·한·영 안내·List-Unsubscribe).
// 한국법 근거와 이 구현이 따르는 규칙은 docs/qa/ux-audit/legal-basis.md §1 의 「G03·D07」「A05」「A06(추가)」다.
// 야간 점검은 기본으로 켠다(LF_MARKETING_NIGHT_GUARD=off 로 끈다) — 전자우편은 야간 동의 대상이 아니라서(시행령 제61조제2항) 법이 요구하는 점검은 아니다.
import { isPlaceholderEmail } from "@launch-factory/auth"
import { canSendMarketing, marketingLinks, runMarketingReconfirm, type MarketingSendDecision, type ReconfirmRunResult } from "@launch-factory/consent"
import { user } from "@launch-factory/db"
import { consentEmails, type MarketingAnnouncementInput } from "@launch-factory/email"
import { eq } from "drizzle-orm"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { linkSecret } from "@/lib/launch/link-secret"
import { mailer } from "@/lib/launch/mailer"

const nightGuardOn = () => process.env.LF_MARKETING_NIGHT_GUARD?.toLowerCase() !== "off"

/** 메일 한 통의 내용(받는 사람·언어·전송자는 이 파일이 채운다) */
export type MarketingContent = Pick<MarketingAnnouncementInput, "subject" | "heading" | "paragraphs"> & Partial<Pick<MarketingAnnouncementInput, "preview" | "cta">>

export type MarketingSendResult = { sent: true; id: string } | { sent: false; reason: Exclude<MarketingSendDecision, { ok: true }>["reason"] | "no_user" | "no_email" | "send_failed"; retryAt?: Date }

/**
 * 광고성 메일 한 통을 한 사람에게. 보내면 { sent: true }, 보내지 않으면 이유를 돌려준다(night 면 다시 시도할 시각 retryAt — 호출하는 쪽이 그때 다시 부른다).
 * 사업자 정보(LF_BUSINESS_*)가 비어 있으면 던진다(MarketingComplianceError) — 법정 표시 없는 광고 메일은 만들어지지 않는다.
 */
export async function sendMarketingEmail(userId: string, content: MarketingContent, o: { now?: Date } = {}): Promise<MarketingSendResult> {
  const db = await database()
  const [u] = await db.select({ email: user.email, name: user.name, locale: user.locale, timeZone: user.timeZone }).from(user).where(eq(user.id, userId)).limit(1)
  if (!u) return { sent: false, reason: "no_user" }
  if (isPlaceholderEmail(u.email)) return { sent: false, reason: "no_email" }
  const decision = await canSendMarketing(db, userId, { channel: "email", nightGuard: nightGuardOn(), ...(o.now ? { now: o.now } : {}) })
  if (!decision.ok) return decision.reason === "night" ? { sent: false, reason: "night", retryAt: decision.retryAt } : { sent: false, reason: decision.reason }
  const { unsubscribeUrl } = marketingLinks({ baseUrl: appUrl(), secret: linkSecret(), userId })
  const r = await mailer().send({
    to: u.email,
    template: "marketingAnnouncement",
    unsubscribeUrl,
    input: {
      ...content,
      locale: u.locale === "ko" || u.locale === "en" ? u.locale : DEFAULT_LOCALE,
      productName: PRODUCT_NAME,
      ...(u.name ? { recipientName: u.name } : {}),
      ...(u.timeZone ? { timeZone: u.timeZone } : {}),
    },
  })
  return r.ok ? { sent: true, id: r.id } : { sent: false, reason: "send_failed" }
}

/**
 * 2년 재확인 작업(A16, /api/cron/consents 가 하루 한 번 부른다). 동의한 지 2년이 지난 이메일 수신자에게 재확인 메일(전송자 명칭·동의 사실과 날짜·계속 받기/수신거부 링크)을 한 통씩 보낸다.
 * 두 번 돌아도 안전하고, 실패한 사람은 다음 실행이 이어서 한다. 이메일이 없는 대체 주소 계정은 기록만 남기고 넘어간다.
 */
export async function runReconfirm(): Promise<ReconfirmRunResult> {
  const emails = consentEmails(mailer(), { productName: PRODUCT_NAME, defaultLocale: DEFAULT_LOCALE })
  return runMarketingReconfirm({
    db: await database(),
    skip: (c) => isPlaceholderEmail(c.email),
    send: (c) => {
      const links = marketingLinks({ baseUrl: appUrl(), secret: linkSecret(), userId: c.userId })
      return emails.marketingReconfirm(c.email, { consentAt: c.consentAt, ...links, idempotencyKey: c.idempotencyKey }, { name: c.name, locale: c.locale, timeZone: c.timeZone })
    },
  })
}
