// 결제 실패 안내 메일(F11). 구독이 past_due 가 될 때 우리가 직접 보낸다 — 재시도 날짜(알면)·이용 가능한 마지막 날(알면)·카드 변경 링크.
// Paddle Retain(결제 복구 메일)을 live 에서 켜면 같은 안내가 두 통이 되므로 보내는 쪽(billing-paddle MailConfig.sendPaymentFailedEmails)이 끌 수 있다.
// 카드 변경 링크는 우리 앱의 결제 관리 화면 주소다 — 결제 대행사 포털 링크는 임시 토큰이라 메일에 싣지 않는다(화면의 「Update payment method」가 새 링크를 만든다).
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface PaymentFailedInput extends BaseInput<EmailMessages["email"]["paymentFailed"]> {
  /** 결제 수단을 바꾸는 화면(우리 앱의 결제 관리) 주소 */
  updateUrl: string
  /** 다음 재시도 날짜(알 때만). 없으면 「자동으로 다시 시도한다」고만 한다 */
  retryAt?: IsoDate
  /** 유료 기능을 이용할 수 있는 마지막 날(유예 끝, 알 때만) */
  accessUntil?: IsoDate
}

export function paymentFailed(input: PaymentFailedInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  requireLink(input.updateUrl, "updateUrl", problems)
  if (input.retryAt !== undefined && !isValidDate(input.retryAt)) problems.push("retryAt must be an ISO date")
  if (input.accessUntil !== undefined && !isValidDate(input.accessUntil)) problems.push("accessUntil must be an ISO date")
  throwIfProblems("paymentFailed", problems)

  const t = copyOf(input, "paymentFailed")
  const tz = timeZoneOf(input)
  const v = {
    productName: input.productName,
    retryDate: input.retryAt ? formatDate(input.retryAt, input.locale, tz) : undefined,
    accessUntil: input.accessUntil ? formatDate(input.accessUntil, input.locale, tz) : undefined,
  }
  const children = [p(fill(t.body, v, "paymentFailed.body")), p(input.retryAt ? fill(t.retryOn, v, "paymentFailed.retryOn") : t.retryAuto)]
  if (input.accessUntil) children.push(p(fill(t.accessUntil, v, "paymentFailed.accessUntil")))
  children.push(p(t.fix), actions(input.locale, [{ href: input.updateUrl, label: t.cta }]))
  return {
    subject: fill(t.subject, v, "paymentFailed.subject"),
    element: layout(input, { preview: fill(t.preview, v, "paymentFailed.preview"), heading: t.heading, children }),
  }
}
