// 광고성 메일 기본 틀(G03·G07). 소식·프로모션 한 통을 보낼 때 쓴다 — 제목·제목줄·본문 문단·단추 하나는 보내는 쪽이 정하고, 법정 표시는 이 틀이 맡는다:
// 제목 앞 「(광고)」(renderEmail) · 바닥글의 전송자 명칭·이메일·전화·주소 · 한글·영문 수신거부 안내와 로그인 없는 수신거부 링크(adFooter).
// 전송자 정보와 수신거부 링크는 메일러(createMailer 의 marketing 설정 + SendRequest.unsubscribeUrl)가 채운다 — 입력으로 직접 줄 필요가 없다.
// 본문 블록에는 광고 표지(data-lf-promo)가 붙는다. 이 표지는 거래·법정 안내 템플릿 출력에 나올 수 없다(kinds.ts).
import type { AdvertisingInput } from "../advertising.ts"
import { adFooter, checkAdvertising } from "../advertising.ts"
import { actions, checkBase, layout, p, promoBlock, requireLink, throwIfProblems, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface MarketingAnnouncementInput extends BaseInput<Record<string, never>> {
  /** 메일 제목(「(광고)」는 자동으로 붙는다) */
  subject: string
  /** 받은편지함 미리보기 글. 없으면 첫 문단 */
  preview?: string
  heading: string
  /** 본문 문단. 한 개 이상 */
  paragraphs: string[]
  cta?: { label: string; url: string }
  /** 법정 표시. 메일러가 채운다(직접 렌더할 때만 준다) */
  advertising?: AdvertisingInput
}

export function marketingAnnouncement(input: MarketingAnnouncementInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (typeof input.subject !== "string" || input.subject.trim() === "") problems.push("subject is required")
  if (typeof input.heading !== "string" || input.heading.trim() === "") problems.push("heading is required")
  if (!Array.isArray(input.paragraphs) || input.paragraphs.length === 0 || input.paragraphs.some((x) => typeof x !== "string" || x.trim() === "")) problems.push("paragraphs must have at least one non-empty text")
  if (input.cta !== undefined) {
    if (typeof input.cta.label !== "string" || input.cta.label.trim() === "") problems.push("cta.label is required")
    requireLink(input.cta.url, "cta.url", problems)
  }
  checkAdvertising(input.advertising, problems)
  throwIfProblems("marketingAnnouncement", problems)

  const ad = input.advertising as AdvertisingInput
  const body = input.paragraphs.map((text) => p(text))
  if (input.cta) body.push(actions(input.locale, [{ href: input.cta.url, label: input.cta.label }]))
  return {
    subject: input.subject,
    element: layout(input, {
      preview: input.preview ?? (input.paragraphs[0] as string),
      heading: input.heading,
      children: [promoBlock(body)],
      footerNodes: adFooter(input.locale, ad),
    }),
  }
}
