// 승인 행동의 서버 입구 검사(LFAX — 감사 M03, 규칙 R20, factory-rules.md §23-7 U20). 사람이 요약을 보고 확정해야 하는 결제·동의 행동은
// 입력에 `confirmed: true` 가 있어야 포트를 부른다. 없으면 포트는 건드리지 않고(DB·메일·공급자 호출 0) code `confirmation_required` 로 끝난다.
// 화면(블록)은 자기 확인 단계를 마친 뒤에 포트를 부르므로, 그 호출을 감싸는 조립 쪽(template/components/product)이 confirmed 를 실어 준다.
// 계약 BillingPort·NotifyPort 의 입력에는 이 칸이 없다 — 계약 밖 추가 입력이다(web-factory 가 더할 것: docs/qa/ux-audit/apply-lfax.md).
import type { BillingPort, NotifyPort } from "@launch-factory/contract"
import type { Locale } from "@launch-factory/i18n"
import { coded, requireConfirmation, type ActionFailure } from "@launch-factory/security/action"

/** 계약 입력에 확인 칸을 더한 모양 */
export type Confirmed<I> = I & { confirmed: true }
type Result<F> = F extends (...a: never[]) => Promise<infer R> ? R : never

function gate<I, R extends { ok: boolean }>(run: (input: I) => Promise<R>, locale?: Locale) {
  return coded(async (input: unknown): Promise<R | (ActionFailure & { code: "confirmation_required"; retryable: false })> => {
    const c = requireConfirmation<I>(input, locale)
    return c.ok ? run(c.rest) : c.failure
  }, locale)
}

export type ConfirmedBillingPort = Pick<BillingPort, "changePlan" | "cancel" | "acceptPriceChange" | "applyRetentionOffer">

/**
 * 결제 승인 행동: 요금제 변경·해지(가격 변경 거절 포함)·가격 변경 동의·해지 대안 적용.
 * 해지 사유·자유 글 같은 다른 칸과 멱등 키는 건드리지 않고 그대로 포트에 넘긴다.
 */
export function confirmedBillingActions(port: ConfirmedBillingPort, { locale }: { locale?: Locale } = {}) {
  return {
    changePlan: gate((i: Parameters<BillingPort["changePlan"]>[0]) => port.changePlan(i), locale) as (input: Confirmed<Parameters<BillingPort["changePlan"]>[0]>) => Promise<Result<BillingPort["changePlan"]> | ActionFailure>,
    cancel: gate((i: Parameters<BillingPort["cancel"]>[0]) => port.cancel(i), locale) as (input: Confirmed<Parameters<BillingPort["cancel"]>[0]>) => Promise<Result<BillingPort["cancel"]> | ActionFailure>,
    acceptPriceChange: gate(() => port.acceptPriceChange(), locale) as (input: { confirmed: true }) => Promise<Result<BillingPort["acceptPriceChange"]> | ActionFailure>,
    applyRetentionOffer: gate((i: Parameters<BillingPort["applyRetentionOffer"]>[0]) => port.applyRetentionOffer(i), locale) as (input: Confirmed<Parameters<BillingPort["applyRetentionOffer"]>[0]>) => Promise<Result<BillingPort["applyRetentionOffer"]> | ActionFailure>,
  }
}

/** 마케팅 수신 동의 변경(채널마다 동의·철회). 채널 칸 검사는 포트가 한다 */
export function confirmedNotifyActions(port: Pick<NotifyPort, "setConsents">, { locale }: { locale?: Locale } = {}) {
  return {
    setConsents: gate((i: Parameters<NotifyPort["setConsents"]>[0]) => port.setConsents(i), locale) as (input: Confirmed<Parameters<NotifyPort["setConsents"]>[0]>) => Promise<Result<NotifyPort["setConsents"]> | ActionFailure>,
  }
}
