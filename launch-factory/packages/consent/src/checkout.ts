// 결제 직전 청약철회 제한 동의(v0 Task 18). BillingPort 를 감싸 checkout 앞에서 동의를 검사하고 기록한다.
//
// 전자상거래법 제17조(MST 282793, 시행 2026-07-21, 2026-09-30 법령 API로 확인):
//   ②5: 「용역 또는 「문화산업진흥 기본법」 제2조제5호의 디지털콘텐츠의 제공이 개시된 경우」 청약철회등을 할 수 없다
//       (가분적 디지털콘텐츠는 제공이 개시되지 않은 부분은 예외).
//   ⑥ 단서: 디지털콘텐츠에서 청약철회등을 할 수 없는 경우에는 「청약철회등이 불가능하다는 사실의 표시」와 함께
//       대통령령으로 정하는 바에 따라 시험 사용 상품을 제공하는 등의 방법으로 권리 행사가 방해받지 않게 해야 한다.
//       그렇게 하지 않으면 ② 단서에 따라 ②5 에 해당해도 청약철회를 할 수 있다.
//   시행령 제21조의2(MST 288143): 시험 사용 방법 — 일부 이용(미리보기)·한시적 이용(체험 기간)·체험용 콘텐츠·정보 제공 중 하나 이상.
// → 결제 직전 화면에 checkout.withdrawal.notice(제한 사실) + checkout.withdrawal.trial(시험 사용 안내)을 보이고,
//   checkout.withdrawal.consentLabel 체크를 받는다. 동의가 없으면 결제창을 열지 않는다. 동의는 consent_records 에 판과 함께 남긴다.
// en 은 EU 디지털 콘텐츠 철회권 포기(명시 동의 + 상실 인지) 문구다 — EU 1차 출처는 이번에 조회하지 않았다(보고서 「확인 안 됨」).
// 계약 BillingPort.checkout 에는 이 칸이 없다 — 계약 밖 추가 입력 withdrawalConsent 로 받는다(대장 D6x 계약 요청).
import { z } from "zod"
import type { ActionResult, BillingPort } from "@launch-factory/contract"
import { recordConsent, type Database } from "@launch-factory/db"
import { DEFAULT_LOCALE, messages, type Locale } from "@launch-factory/i18n"

/** 결제 직전 안내 문구의 판. checkout.withdrawal.* 문구를 고치면 올린다 */
export const WITHDRAWAL_NOTICE_VERSION = "2026-09-30"

// 계약 판 2(web-factory 1d3a61d)는 withdrawalConsent?: true 를 갖는다 — LF 입력은 체크 안 함(false)도 받아 fieldErrors 로 거절하므로 boolean 으로 넓힌다
export type LaunchCheckoutInput = Omit<Parameters<BillingPort["checkout"]>[0], "withdrawalConsent"> & { withdrawalConsent?: boolean }

export interface LaunchBillingPort extends BillingPort {
  checkout(input: LaunchCheckoutInput): ReturnType<BillingPort["checkout"]>
}

export interface WithdrawalConsentOptions {
  db: Database
  userId: () => string | null | Promise<string | null>
  locale?: Locale
  now?: () => Date
  noticeVersion?: string
  onError?: (error: unknown) => void
}

export function withWithdrawalConsent(billing: BillingPort, { db, userId, locale = DEFAULT_LOCALE, now = () => new Date(), noticeVersion = WITHDRAWAL_NOTICE_VERSION, onError = (e) => console.error("[checkout]", e) }: WithdrawalConsentOptions): LaunchBillingPort {
  const m = messages(locale)
  return {
    ...billing,
    async checkout({ withdrawalConsent, ...input }) {
      if (withdrawalConsent !== true) return { ok: false, fieldErrors: { withdrawalConsent: [m.checkout.withdrawal.consentRequired] } }
      const id = await userId()
      if (!id) return { ok: false, formError: m.auth.signInRequired }
      try {
        await recordConsent(db, { userId: id, kind: "withdrawal_limit", granted: true, version: noticeVersion, source: "checkout", locale, subject: input.planId, at: now() })
      } catch (e) {
        onError(e)
        return { ok: false, formError: m.checkout.failed, retryable: true }
      }
      return billing.checkout(input)
    },
  }
}

const checkbox = z.union([z.literal(true), z.literal("on"), z.literal("true")]).optional()
const checkoutSchema = z.object({
  planId: z.string().trim().min(1).max(200),
  trial: z.union([z.boolean(), z.literal("true"), z.literal("false")]).transform((v) => v === true || v === "true").optional(),
  withdrawalConsent: z.unknown().optional(),
})

/** 서버 액션 몸통: 결제 시작. 템플릿의 "use server" 파일이 감싼다(Task 10). 동의 체크박스는 폼 이름 withdrawalConsent */
export function checkoutAction(port: LaunchBillingPort, { locale = DEFAULT_LOCALE }: { locale?: Locale } = {}) {
  return async (input: unknown): Promise<ActionResult<{ redirectUrl?: string }>> => {
    const raw = input instanceof FormData ? Object.fromEntries([...input.entries()].filter(([, v]) => typeof v === "string")) : input
    const p = checkoutSchema.safeParse(raw)
    if (!p.success) return { ok: false, fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0] ?? "form"), [messages(locale).auth.required]])) }
    const { withdrawalConsent, ...rest } = p.data
    const r = await port.checkout({ ...rest, withdrawalConsent: checkbox.safeParse(withdrawalConsent).success && withdrawalConsent !== undefined })
    return r.ok ? { ok: true, data: r.data.redirectUrl ? { redirectUrl: r.data.redirectUrl } : {} } : r
  }
}
