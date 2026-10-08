// 네 템플릿이 함께 쓰는 틀. JSX 대신 createElement 를 쓴다 — Node 의 타입 제거(strip)는 .tsx 를 돌리지 못해서
// `node --test` 가 src 를 바로 불러오는 이 저장소 방식(Task 1~8)과 맞추려면 .ts 여야 한다(보고서 「설계 판단」).
// 사용자에게 보이는 글자는 여기 없다. 모두 messages/ 에서 온다.
import { createElement as h, type ReactNode } from "react"
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "react-email"
import { messagesFor, LOCALES, type EmailMessages, type Locale } from "../messages/index.ts"
import { EmailRenderError, fill, isMailLink } from "../format.ts"

/** 모든 템플릿 입력의 공통 칸. `copy` 는 그 템플릿의 기본 문구를 키 단위로 덮어쓴다(§7-A 6 — 문구는 입력으로 받는다). */
export interface BaseInput<C> {
  locale: Locale
  productName: string
  recipientName?: string
  /** 날짜 표시 시간대. 기본 ko → Asia/Seoul, en → UTC */
  timeZone?: string
  copy?: Partial<C>
}

export interface BuiltEmail {
  subject: string
  element: ReactNode
}

const DEFAULT_TZ: Record<Locale, string> = { ko: "Asia/Seoul", en: "UTC" }

export function timeZoneOf(input: BaseInput<unknown>): string {
  return input.timeZone ?? DEFAULT_TZ[input.locale]
}

/** 공통 칸 검사. 문제 목록에 더한다. */
export function checkBase(input: BaseInput<unknown>, problems: string[]): void {
  if (!LOCALES.includes(input.locale)) problems.push("locale must be ko or en")
  if (typeof input.productName !== "string" || input.productName.trim() === "") problems.push("productName is required")
}

export function requireLink(value: unknown, field: string, problems: string[]): void {
  if (!isMailLink(value)) problems.push(`${field} must be an absolute https URL`)
}

export function throwIfProblems(template: string, problems: string[]): void {
  if (problems.length) throw new EmailRenderError(template, problems)
}

/** 기본 문구 + 덮어쓰기. 덮어쓴 값이 빈 문자열이면 기본값을 쓴다. */
export function copyOf<K extends Exclude<keyof EmailMessages["email"], "common">>(
  input: BaseInput<EmailMessages["email"][K]>,
  key: K,
): EmailMessages["email"][K] {
  const base = messagesFor(input.locale)[key] as Record<string, string>
  const out: Record<string, string> = { ...base }
  for (const [k, v] of Object.entries(input.copy ?? {})) {
    if (typeof v === "string" && v !== "" && k in base) out[k] = v
  }
  return out as EmailMessages["email"][K]
}

const DATA_FALLBACK: Record<string, string> = { "data-skip-in-text": "true", "data-lf-fallback-link": "true" }
const DATA_PROMO: Record<string, string> = { "data-lf-promo": "true" }

const S = {
  body: { backgroundColor: "#f6f6f4", fontFamily: "-apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", borderRadius: "8px", maxWidth: "560px", margin: "0 auto", padding: "32px" },
  heading: { color: "#1a1a1a", fontSize: "22px", lineHeight: "30px", margin: "0 0 16px" },
  text: { color: "#333333", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" },
  strong: { color: "#1a1a1a", fontSize: "15px", lineHeight: "24px", margin: "0 0 12px", fontWeight: 600 },
  primary: { backgroundColor: "#1a1a1a", borderRadius: "6px", color: "#ffffff", fontSize: "15px", fontWeight: 600, padding: "12px 20px", textDecoration: "none" },
  secondary: { backgroundColor: "#ffffff", border: "1px solid #1a1a1a", borderRadius: "6px", color: "#1a1a1a", fontSize: "15px", fontWeight: 600, padding: "11px 19px", textDecoration: "none" },
  actions: { margin: "20px 0 8px" },
  action: { margin: "0 0 12px" },
  hr: { borderColor: "#e5e5e5", margin: "24px 0 16px" },
  footer: { color: "#777777", fontSize: "12px", lineHeight: "18px", margin: 0 },
  row: { color: "#333333", fontSize: "15px", lineHeight: "24px", margin: "0 0 4px" },
  fallback: { color: "#777777", fontSize: "12px", lineHeight: "18px", margin: "6px 0 0", wordBreak: "break-all" },
  link: { color: "#555555", textDecoration: "underline" },
  promo: { margin: "0 0 12px" },
} as const

export const p = (text: string, strong = false): ReactNode => h(Text, { style: strong ? S.strong : S.text }, text)
export const row = (label: string, value: string): ReactNode => h(Text, { style: S.row }, `${label}: ${value}`)

export interface Action {
  href: string
  label: string
  secondary?: boolean
}

/**
 * 버튼마다 한 구역(세로로 쌓는다) — 평문 판에서 버튼 글·주소가 한 줄에 붙지 않게.
 * 버튼 바로 아래에 같은 주소를 글자 링크로 한 번 더 둔다(G02 — 버튼이 안 열리는 메일 앱 대비).
 * 평문 판은 버튼 글 뒤에 주소가 이미 붙으므로 이 줄은 평문에서 뺀다(data-skip-in-text).
 */
export function actions(locale: Locale, list: Action[]): ReactNode {
  const fallback = messagesFor(locale).common.buttonFallback
  return h(
    Section,
    { style: S.actions },
    ...list.map((a) =>
      h(
        Section,
        { key: a.href, style: S.action },
        h(Button, { href: a.href, style: a.secondary ? S.secondary : S.primary }, a.label),
        h(Text, { style: S.fallback, ...DATA_FALLBACK }, `${fallback} `, h(Link, { href: a.href, style: S.link }, a.href)),
      ),
    ),
  )
}

/** 링크가 유효한 시간을 사람 말로: 2시간 미만이고 정시가 아니면 분, 48시간 미만이면 시간, 그 위는 일 */
export function validityOf(minutes: number, locale: Locale): string {
  const c = messagesFor(locale).common
  if (!Number.isInteger(minutes) || minutes <= 0) throw new EmailRenderError("validity", ["linkValidMinutes must be a positive integer"])
  const hours = minutes / 60
  if (Number.isInteger(hours) && hours < 48) return hours === 1 ? c.validHour : fill(c.validHours, { n: String(hours) }, "common.validHours")
  if (minutes < 48 * 60) return fill(c.validMinutes, { n: String(minutes) }, "common.validMinutes")
  return fill(c.validDays, { n: String(Math.round(minutes / 1440)) }, "common.validDays")
}

/** 링크 유효 시간 기본값(분). Better Auth 의 인증·재설정 링크 기본값 3600초와 같다 — auth 패키지가 같은 값을 설정에 명시하고 시험이 둘이 같은지 본다 */
export const DEFAULT_LINK_VALID_MINUTES = 60

/** 광고 블록(광고성 템플릿만). 거래·법정 안내 템플릿 출력에 이 표지가 있으면 renderEmail 이 거절한다(G07) */
export const promoBlock = (children: ReactNode[]): ReactNode => h(Section, { style: S.promo, ...DATA_PROMO }, ...children)

/** 틀: 미리보기 글·인사·제목·본문·바닥글. */
export function layout(input: BaseInput<unknown>, parts: { preview: string; heading: string; children: ReactNode[]; footer?: string; footerNodes?: ReactNode }): ReactNode {
  const common = messagesFor(input.locale).common
  const greeting = input.recipientName
    ? fill(common.greeting, { name: input.recipientName }, "common.greeting")
    : common.greetingNoName
  const footer = parts.footer ?? fill(common.footer, { productName: input.productName }, "common.footer")
  return h(
    Html,
    { lang: input.locale },
    h(Head, null),
    h(Preview, null, parts.preview),
    h(
      Body,
      { style: S.body },
      h(
        Container,
        { style: S.container },
        h(Heading, { as: "h1", style: S.heading }, parts.heading),
        p(greeting),
        ...parts.children,
        h(Hr, { style: S.hr }),
        parts.footerNodes ?? h(Text, { style: S.footer }, footer),
      ),
    ),
  )
}
