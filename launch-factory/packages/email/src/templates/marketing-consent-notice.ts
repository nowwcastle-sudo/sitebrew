// 광고성 정보 수신 의사 처리 결과 통지 메일(정보통신망법 제50조제7항 · 시행령 제62조의2 — 대장 D201).
// 수신동의·수신거부·동의 철회 의사를 표시한 날부터 14일 안에 ① 전송자 명칭 ② 의사 표시 사실과 그 날짜 ③ 처리 결과를 알린다.
// 광고가 아니다 — 링크·권유 문구 없이 사실만 적는다(이 메일 자체가 광고성 정보가 되면 안 된다).
import type { IsoDate } from "@launch-factory/contract"
import type { EmailMessages } from "../messages/index.ts"
import { fill, formatDate, isValidDate } from "../format.ts"
import { checkBase, copyOf, layout, p, throwIfProblems, timeZoneOf, type BaseInput, type BuiltEmail } from "./layout.ts"

export const MARKETING_NOTICE_CHANNELS = ["email", "sms", "kakao", "push"] as const
export type MarketingNoticeChannel = (typeof MARKETING_NOTICE_CHANNELS)[number]

export interface MarketingConsentNoticeInput extends BaseInput<EmailMessages["email"]["marketingConsentNotice"]> {
  /** 이번에 처리한 채널별 의사(받겠다 true · 받지 않겠다 false). 하나 이상 */
  changes: { channel: MarketingNoticeChannel; granted: boolean }[]
  /** 의사를 표시한 때. 메일에는 날짜로 보인다 */
  changedAt: IsoDate
  /** 전송자 명칭. 없으면 productName */
  senderName?: string
}

const CHANNEL_KEY = { email: "channelEmail", sms: "channelSms", kakao: "channelKakao", push: "channelPush" } as const

export function marketingConsentNotice(input: MarketingConsentNoticeInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (!isValidDate(input.changedAt)) problems.push("changedAt must be an ISO date")
  if (!Array.isArray(input.changes) || input.changes.length === 0) problems.push("changes must have at least one channel")
  else {
    for (const c of input.changes) {
      if (!MARKETING_NOTICE_CHANNELS.includes(c?.channel)) problems.push("changes[].channel must be email, sms, kakao or push")
      if (typeof c?.granted !== "boolean") problems.push("changes[].granted must be a boolean")
    }
  }
  if (input.senderName !== undefined && input.senderName.trim() === "") problems.push("senderName must not be empty")
  throwIfProblems("marketingConsentNotice", problems)
  const t = copyOf(input, "marketingConsentNotice")
  const senderName = input.senderName ?? input.productName
  const date = formatDate(input.changedAt, input.locale, timeZoneOf(input))
  const v = { senderName }
  const children = [p(fill(t.intro, v, "marketingConsentNotice.intro"))]
  for (const c of input.changes) {
    children.push(p(fill(t.changeLine, { channel: t[CHANNEL_KEY[c.channel]], status: c.granted ? t.granted : t.withdrawn, date }, "marketingConsentNotice.changeLine"), true))
    children.push(p(c.granted ? t.resultGranted : t.resultWithdrawn))
  }
  children.push(p(t.manageNote))
  return {
    subject: fill(t.subject, v, "marketingConsentNotice.subject"),
    element: layout(input, { preview: t.preview, heading: t.heading, children }),
  }
}
