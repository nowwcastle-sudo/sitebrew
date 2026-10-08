// 해지 확인 메일. 기간 끝 해지(cancelAt)면 그때까지 쓸 수 있다고, 즉시 해지면 끝났다고 알린다.
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface CancellationInput extends BaseInput<EmailMessages["email"]["cancellation"]> {
  /** 기간 끝 해지면 이용이 끝나는 때(Subscription.cancelAt). 없으면 즉시 해지로 본다 */
  accessUntil?: IsoDate
  /** 다시 구독 화면 주소(선택) */
  resubscribeUrl?: string
}

export function cancellation(input: CancellationInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (input.accessUntil !== undefined && !isValidDate(input.accessUntil)) problems.push("accessUntil must be an ISO date")
  if (input.resubscribeUrl !== undefined) requireLink(input.resubscribeUrl, "resubscribeUrl", problems)
  throwIfProblems("cancellation", problems)

  const t = copyOf(input, "cancellation")
  const v = {
    productName: input.productName,
    accessUntil: input.accessUntil ? formatDate(input.accessUntil, input.locale, timeZoneOf(input)) : undefined,
  }
  const access = input.accessUntil ? fill(t.bodyAccessUntil, v, "cancellation.bodyAccessUntil") : t.bodyAccessEnded
  const children = [p(access), p(t.noFurtherCharges)]
  if (input.resubscribeUrl) children.push(actions(input.locale, [{ href: input.resubscribeUrl, label: t.resubscribeCta, secondary: true }]))
  return {
    subject: fill(t.subject, v, "cancellation.subject"),
    element: layout(input, { preview: fill(t.preview, v, "cancellation.preview"), heading: fill(t.heading, v, "cancellation.heading"), children }),
  }
}
