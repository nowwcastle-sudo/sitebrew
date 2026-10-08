// 주문 확인 메일. 영수증·세금계산서는 판매사(Merchant of Record)인 Paddle 이 따로 보낸다 — 겹치지 않게 「주문 확인」만 싣고,
// 영수증은 Paddle 메일로 온다는 안내(receiptNote)를 둔다.
import type { IsoDate, Money } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, formatMoney, isValidDate } from "../format.ts"
import { messagesFor } from "../messages/index.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, row, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface OrderConfirmationInput extends BaseInput<EmailMessages["email"]["orderConfirmation"]> {
  orderId: string
  planName: string
  amount: Money
  orderedAt: IsoDate
  /** 구독 관리 화면 주소 */
  manageUrl: string
}

export function moneyWithTax(money: Money, input: BaseInput<unknown>): string {
  const common = messagesFor(input.locale).common
  return `${formatMoney(money, input.locale)} ${money.vatIncluded ? common.vatIncluded : common.vatExcluded}`
}

export function orderConfirmation(input: OrderConfirmationInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!input.orderId) problems.push("orderId is required")
  if (!input.planName) problems.push("planName is required")
  if (!input.amount || !Number.isInteger(input.amount.amount)) problems.push("amount must be an integer in minor units")
  if (!isValidDate(input.orderedAt)) problems.push("orderedAt must be an ISO date")
  requireLink(input.manageUrl, "manageUrl", problems)
  throwIfProblems("orderConfirmation", problems)

  const t = copyOf(input, "orderConfirmation")
  const v = { productName: input.productName, planName: input.planName }
  return {
    subject: fill(t.subject, v, "orderConfirmation.subject"),
    element: layout(input, {
      preview: fill(t.preview, v, "orderConfirmation.preview"),
      heading: fill(t.heading, v, "orderConfirmation.heading"),
      children: [
        p(fill(t.body, v, "orderConfirmation.body")),
        row(t.orderIdLabel, input.orderId),
        row(t.planLabel, input.planName),
        row(t.amountLabel, moneyWithTax(input.amount, input)),
        row(t.orderedAtLabel, formatDate(input.orderedAt, input.locale, timeZoneOf(input))),
        p(t.receiptNote),
        actions(input.locale, [{ href: input.manageUrl, label: t.cta }]),
      ],
    }),
  }
}
