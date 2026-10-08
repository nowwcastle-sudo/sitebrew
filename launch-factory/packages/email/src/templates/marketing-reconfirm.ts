// 광고성 정보 수신동의 2년 재확인 메일(A16 — 정보통신망법 제50조제8항 · 시행령 제62조의3: 동의를 받은 날부터 2년마다 수신동의 여부를 확인한다).
// docs/qa/ux-audit/legal-basis.md §1 「A06(추가)」: 확인할 때 전송자 명칭 · 동의 사실과 날짜 · 유지·철회 방법을 밝힌다.
// 광고가 아니라 법정 안내다 — 권유·할인 문구 없이 사실과 두 선택(계속 받기 · 수신거부)만 싣는다(종류 표: transactional).
// 수신거부 링크는 로그인이 필요 없는 서명 링크(별표 6). 「계속 받기」 링크도 서명 링크이고 기한이 있다(linkValidMinutes — 제품이 토큰 기한과 같은 값을 넣는다).
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { actions, checkBase, copyOf, layout, p, requireLink, throwIfProblems, timeZoneOf, validityOf, type BaseInput, type BuiltEmail } from "./layout.ts"
import { messagesFor } from "../messages/index.ts"

export interface MarketingReconfirmInput extends BaseInput<EmailMessages["email"]["marketingReconfirm"]> {
  /** 동의한 날(재확인 기준일) */
  consentAt: IsoDate
  /** 전송자 명칭. 없으면 productName */
  senderName?: string
  /** 「계속 받기」 서명 링크 */
  keepUrl: string
  /** 「수신거부」 서명 링크(로그인 불필요) */
  unsubscribeUrl: string
  /** 「계속 받기」 링크가 유효한 시간(분) */
  linkValidMinutes: number
}

export function marketingReconfirm(input: MarketingReconfirmInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isValidDate(input.consentAt)) problems.push("consentAt must be an ISO date")
  if (input.senderName !== undefined && input.senderName.trim() === "") problems.push("senderName must not be empty")
  requireLink(input.keepUrl, "keepUrl", problems)
  requireLink(input.unsubscribeUrl, "unsubscribeUrl", problems)
  if (!Number.isInteger(input.linkValidMinutes) || input.linkValidMinutes <= 0) problems.push("linkValidMinutes must be a positive integer")
  throwIfProblems("marketingReconfirm", problems)

  const t = copyOf(input, "marketingReconfirm")
  const common = messagesFor(input.locale).common
  const v = {
    productName: input.productName,
    senderName: input.senderName ?? input.productName,
    consentDate: formatDate(input.consentAt, input.locale, timeZoneOf(input)),
  }
  return {
    subject: fill(t.subject, v, "marketingReconfirm.subject"),
    element: layout(input, {
      preview: t.preview,
      heading: t.heading,
      children: [
        p(fill(t.intro, v, "marketingReconfirm.intro"), true),
        p(t.why),
        actions(input.locale, [
          { href: input.keepUrl, label: t.keepCta },
          { href: input.unsubscribeUrl, label: t.unsubscribeCta, secondary: true },
        ]),
        p(fill(common.linkValid, { duration: validityOf(input.linkValidMinutes, input.locale) }, "common.linkValid")),
        p(t.unsubscribeNote),
        p(t.noResponse),
      ],
    }),
  }
}
