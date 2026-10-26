// 뉴스레터 구독 완료 안내. 정보통신망법 제50조제7항·시행령 제62조의2: 수신동의 의사를 표시한 날부터 14일 안에 ① 전송자 명칭 ② 동의 사실과 그 날짜 ③ 처리 결과를 알린다.
// (docs/qa/ux-audit/legal-basis.md §1 A06) 구독 확인 단추를 누른 직후 보내는 이 메일이 그 통지를 겸한다.
// 광고가 아니다 — 권유 문구 없이 사실과 수신거부 단추(로그인 필요 없는 서명 링크, 별표 6)만 싣는다(종류 표: transactional).
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface NewsletterWelcomeInput extends Omit<BaseInput<EmailMessages["email"]["newsletterWelcome"]>, "recipientName"> {
  /** 동의한 날(구독 신청 시각) */
  consentAt: IsoDate
  /** 전송자 명칭. 없으면 productName */
  senderName?: string
  /** 수신거부 서명 링크(로그인 불필요) */
  unsubscribeUrl: string
}

export function newsletterWelcome(input: NewsletterWelcomeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isValidDate(input.consentAt)) problems.push("consentAt must be an ISO date")
  if (input.senderName !== undefined && input.senderName.trim() === "") problems.push("senderName must not be empty")
  requireLink(input.unsubscribeUrl, "unsubscribeUrl", problems)
  throwIfProblems("newsletterWelcome", problems)

  const t = copyOf(input, "newsletterWelcome")
  const v = {
    productName: input.productName,
    senderName: input.senderName ?? input.productName,
    consentDate: formatDate(input.consentAt, input.locale, timeZoneOf(input)),
  }
  return {
    subject: fill(t.subject, v, "newsletterWelcome.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      {
        preview: t.preview,
        heading: t.heading,
        children: [
          p(fill(t.intro, v, "newsletterWelcome.intro"), true),
          p(t.result),
          p(t.unsubscribeNote),
          actions(input.locale, [{ href: input.unsubscribeUrl, label: t.unsubscribeCta, secondary: true }]),
          p(t.notice),
        ],
        footer: fill(t.why, v, "newsletterWelcome.why"),
      },
    ),
  }
}
