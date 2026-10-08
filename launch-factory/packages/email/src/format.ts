// 자리표시 채우기·금액·날짜 표시. 사용자에게 보이는 글자는 여기서 만들지 않는다(Intl 이 로캘대로 만든다).
import type { Money, IsoDate } from "@launch-factory/contract"
import type { Locale } from "./messages/index.ts"

/** 템플릿 입력이 규칙을 어기면 던진다. 문제를 **모두** 모아 한 번에 알린다. 값은 싣지 않고 칸 이름만 싣는다. */
export class EmailRenderError extends Error {
  readonly template: string
  readonly problems: string[]
  constructor(template: string, problems: string[]) {
    super(`email template "${template}" cannot render: ${problems.join("; ")}`)
    this.name = "EmailRenderError"
    this.template = template
    this.problems = problems
  }
}

const PLACEHOLDER = /\{(\w+)\}/g

/** `"Hi {name}"` 의 자리표시를 채운다. 값이 없는 자리표시가 있으면 던진다(빈칸 메일을 보내지 않게). */
export function fill(template: string, vars: Record<string, string | undefined>, where: string): string {
  const missing: string[] = []
  const out = template.replace(PLACEHOLDER, (_, key: string) => {
    const v = vars[key]
    if (v === undefined || v === "") {
      missing.push(key)
      return ""
    }
    return v
  })
  if (missing.length) throw new EmailRenderError(where, missing.map((k) => `missing value for {${k}}`))
  return out
}

/** 자리표시 이름 목록(키 검사용). */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1] as string).sort()
}

const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", en: "en-US" }
const ZERO_DECIMAL = new Set(["KRW", "JPY"])

/** 최소 단위 정수 금액을 로캘대로 표시한다(KRW·JPY 는 소수 없음, 나머지는 /100). 부가세 표기는 호출하는 쪽이 붙인다. */
export function formatMoney(money: Money, locale: Locale): string {
  const digits = ZERO_DECIMAL.has(money.currency) ? 0 : 2
  const value = digits === 0 ? money.amount : money.amount / 100
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function isValidDate(value: unknown): value is IsoDate {
  return typeof value === "string" && value !== "" && !Number.isNaN(Date.parse(value))
}

/** 날짜 표시. `withTime` 이면 시각과 시간대 이름까지(동의 기한처럼 시각이 뜻을 갖는 값). */
export function formatDate(iso: IsoDate, locale: Locale, timeZone: string, withTime = false): string {
  const options: Intl.DateTimeFormatOptions = withTime
    ? { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" }
    : { year: "numeric", month: "long", day: "numeric", timeZone }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(new Date(iso))
}

/** 메일 속 링크는 절대 주소여야 한다. https, 또는 로컬 개발(localhost·127.0.0.1)의 http 만 받는다. */
export function isMailLink(value: unknown): value is string {
  if (typeof value !== "string") return false
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  if (u.protocol === "https:") return true
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")
}
