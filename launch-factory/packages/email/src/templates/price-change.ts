// 가격 변경 안내 메일(마케팅 규칙 L6 — 무료→유료 전환·가격 인상은 전후 가격·적용일·동의 기한·해지 방법을 보이고 명시 동의를 받는다.
// 무응답은 동의가 아니다). 입력은 계약의 `Subscription.pendingPriceChange` 를 그대로 받는다.
// 적용일(effectiveAt)·동의 기한(consentBy)·동의 링크·거절(해지) 링크 중 하나라도 없거나 틀리면 **렌더하지 않고 던진다** —
// 기한이나 거절 방법이 빠진 안내는 L6 을 어긴 안내라 보내면 안 된다.
import type { PendingPriceChange } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { moneyWithTax } from "./order-confirmation.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface PriceChangeInput extends BaseInput<EmailMessages["email"]["priceChange"]> {
  planName: string
  change: PendingPriceChange
  /** 새 가격 동의 화면(BillingPort.acceptPriceChange 를 부르는 곳) */
  acceptUrl: string
  /** 거절 = 해지 화면(BillingPort.cancel 을 부르는 곳) */
  declineUrl: string
}

export function priceChange(input: PriceChangeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!input.planName) problems.push("planName is required")
  const c = input.change
  if (!c) problems.push("change (pendingPriceChange) is required")
  if (!c || !isValidDate(c.effectiveAt)) problems.push("change.effectiveAt (effective date) is required")
  if (!c || !isValidDate(c.consentBy)) problems.push("change.consentBy (consent deadline) is required")
  if (c && isValidDate(c.effectiveAt) && isValidDate(c.consentBy) && Date.parse(c.consentBy) > Date.parse(c.effectiveAt)) {
    problems.push("change.consentBy must not be after change.effectiveAt")
  }
  if (c && c.kind !== "price_increase" && c.kind !== "trial_to_paid") problems.push("change.kind must be price_increase or trial_to_paid")
  if (!c || !c.to || !Number.isInteger(c.to.amount)) problems.push("change.to must be an integer amount in minor units")
  if (c && c.kind === "price_increase" && (!c.from || !Number.isInteger(c.from.amount))) problems.push("change.from must be an integer amount in minor units")
  requireLink(input.acceptUrl, "acceptUrl", problems)
  requireLink(input.declineUrl, "declineUrl (decline/cancel link)", problems)
  throwIfProblems("priceChange", problems)

  const tz = timeZoneOf(input)
  const t = copyOf(input, "priceChange")
  const v = {
    productName: input.productName,
    planName: input.planName,
    from: c.from ? moneyWithTax(c.from, input) : undefined,
    to: moneyWithTax(c.to, input),
    effectiveDate: formatDate(c.effectiveAt, input.locale, tz),
    consentBy: formatDate(c.consentBy, input.locale, tz, true),
  }
  const body = c.kind === "trial_to_paid" ? t.bodyTrialToPaid : t.bodyPriceIncrease
  return {
    subject: fill(t.subject, v, "priceChange.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "priceChange.preview"),
      heading: fill(t.heading, v, "priceChange.heading"),
      children: [
        p(fill(body, v, "priceChange.body")),
        p(fill(t.consentDeadline, v, "priceChange.consentDeadline"), true),
        p(fill(t.noResponse, v, "priceChange.noResponse")),
        p(fill(t.declineNote, v, "priceChange.declineNote")),
        actions(input.locale, [
          { href: input.acceptUrl, label: fill(t.acceptCta, v, "priceChange.acceptCta") },
          { href: input.declineUrl, label: fill(t.declineCta, v, "priceChange.declineCta"), secondary: true },
        ]),
      ],
    }),
  }
}
