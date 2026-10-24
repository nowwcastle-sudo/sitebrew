// 뉴스레터 구독 확인 메일(이중 동의 — 신청한 주소의 주인이 누른 뒤에만 구독이 시작된다).
// 받는 주소를 방문자가 적으므로 남의 주소일 수 있다: 이름 인사를 쓰지 않고(recipientName 을 받지 않는다) 방문자가 쓴 글을 싣지 않는다 — 문의 접수 확인(inquiryReceipt)과 같은 이유다.
// 광고가 아니다: 권유·할인 문구 없이 확인 단추 하나만 둔다(종류 표: transactional). 확인 링크는 서명 토큰이고 기한이 있다(linkValidMinutes — 제품이 토큰 기한과 같은 값을 넣는다).
import type { EmailMessages } from "../messages/index.ts"
import { fill } from "../format.ts"
import { messagesFor } from "../messages/index.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, validityOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface NewsletterConfirmInput extends Omit<BaseInput<EmailMessages["email"]["newsletterConfirm"]>, "recipientName"> {
  /** 구독 확인 서명 링크 */
  confirmUrl: string
  /** 확인 링크가 유효한 시간(분) */
  linkValidMinutes: number
}

export function newsletterConfirm(input: NewsletterConfirmInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  requireLink(input.confirmUrl, "confirmUrl", problems)
  if (!Number.isInteger(input.linkValidMinutes) || input.linkValidMinutes <= 0) problems.push("linkValidMinutes must be a positive integer")
  throwIfProblems("newsletterConfirm", problems)

  const t = copyOf(input, "newsletterConfirm")
  const common = messagesFor(input.locale).common
  const v = { productName: input.productName }
  return {
    subject: fill(t.subject, v, "newsletterConfirm.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      {
        preview: t.preview,
        heading: t.heading,
        children: [
          p(fill(t.body, v, "newsletterConfirm.body")),
          actions(input.locale, [{ href: input.confirmUrl, label: t.cta }]),
          p(fill(common.linkValid, { duration: validityOf(input.linkValidMinutes, input.locale) }, "common.linkValid")),
          p(t.ignoreNote),
        ],
        footer: fill(t.why, v, "newsletterConfirm.why"),
      },
    ),
  }
}
