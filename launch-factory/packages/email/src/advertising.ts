// 광고성 메일 표시(G03). 정보통신망법 제50조·시행령 제61조·별표 6(2021-01-05 개정)과 docs/qa/ux-audit/legal-basis.md §1 「G03·D07」을 그대로 따른다:
//   ① 제목 시작에 「(광고)」 ② 본문에 전송자 명칭·이메일·전화번호·주소 ③ 수신거부·철회 안내문과 간편하게 고를 수 있는 기술적 조치(로그인 없는 링크)
//   ④ 그 안내문과 조치를 한글과 영문으로. 한국 수신자인지 가릴 수 없으면 같은 표시를 모두에게 적용한다(legal-basis 서두) — 그래서 언어와 상관없이 「(광고)」와 한·영 안내를 둔다.
// 사업자 값(상호·이메일·전화·주소)은 여기 없다 — 메일러가 제품 설정(LF_BUSINESS_*)에서 받아 넣는다(send.ts). 이 파일은 모양과 검사만 한다.
// 이 표시가 하나라도 빠지면 렌더하지 않는다(EmailRenderError) — 법정 표시가 없는 광고 메일은 만들어지지 않는다.
import { createElement as h, type ReactNode } from "react"
import { Section } from "react-email"
import { fill, isMailLink } from "./format.ts"
import { messagesFor, type Locale } from "./messages/index.ts"
import { actions, p, row } from "./templates/layout.ts"

/** 광고성 메일의 법정 표시 입력. 메일러가 설정에서 채운다 */
export interface AdvertisingInput {
  senderName: string
  senderEmail: string
  senderPhone: string
  senderAddress: string
  /** 로그인 없이 수신거부가 끝나는 주소(서명 토큰). 헤더 List-Unsubscribe 와 본문 링크가 같은 주소다(RFC 8058: HTTPS) */
  unsubscribeUrl: string
}

/** 광고 표시 한국어 표지. 한·영 어느 쪽 수신자에게도 같다 */
export const adPrefix = (): string => messagesFor("ko").advertising.subjectPrefix

/** 제목 앞에 「(광고)」(이미 붙어 있으면 그대로) */
export function adSubject(subject: string): string {
  const prefix = adPrefix()
  return subject.startsWith(prefix) ? subject : `${prefix} ${subject}`
}

/** 입력 검사. 문제를 목록에 더한다(값은 싣지 않고 칸 이름만) */
export function checkAdvertising(a: Partial<AdvertisingInput> | undefined, problems: string[]): void {
  if (!a || typeof a !== "object") {
    problems.push("advertising (sender name, email, phone, address and unsubscribe link) is required for marketing mail")
    return
  }
  for (const [key, label] of [
    ["senderName", "name"],
    ["senderEmail", "email"],
    ["senderPhone", "phone"],
    ["senderAddress", "address"],
  ] as const) {
    if (typeof a[key] !== "string" || a[key].trim() === "") problems.push(`advertising.${key} (sender ${label}) is required`)
  }
  if (!isMailLink(a.unsubscribeUrl) || !a.unsubscribeUrl.startsWith("http")) problems.push("advertising.unsubscribeUrl must be an absolute https URL")
}

const AD_FOOTER_MARK: Record<string, string> = { "data-lf-ad-footer": "true" }

/** 바닥글: 광고 고지 · 한글·영문 수신거부 안내와 링크 · 전송자 정보. 표지 data-lf-ad-footer 로 renderEmail 이 있는지 확인한다 */
export function adFooter(locale: Locale, a: AdvertisingInput): ReactNode {
  const ko = messagesFor("ko").advertising
  const en = messagesFor("en").advertising
  const labels = messagesFor(locale).advertising
  const v = { senderName: a.senderName }
  // 사용자 언어를 앞에 둔다. 둘 다 항상 있다(별표 6: 한글과 영문)
  const order: Locale[] = locale === "ko" ? ["ko", "en"] : ["en", "ko"]
  const at = (l: Locale) => (l === "ko" ? ko : en)
  return h(
    Section,
    AD_FOOTER_MARK,
    ...order.map((l) => p(fill(at(l).adNotice, v, "advertising.adNotice"))),
    ...order.map((l) => p(at(l).optOutLead)),
    actions(locale, [{ href: a.unsubscribeUrl, label: `${ko.unsubscribeCta} / ${en.unsubscribeCta}`, secondary: true }]),
    row(labels.senderLabel, a.senderName),
    row(labels.emailLabel, a.senderEmail),
    row(labels.phoneLabel, a.senderPhone),
    row(labels.addressLabel, a.senderAddress),
  )
}
