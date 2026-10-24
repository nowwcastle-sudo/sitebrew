import * as React from "react"

import type { IsoDate, Money } from "@/components/contract/ports"
import { cn } from "@/lib/utils"

import { formatPrice } from "../_shared/price-tag"

// 결제·구독 화면 표시(P3-2 레인 D1 공유 조각 block-shared-billing-format — auth·account·paywall·retention 이 같이 쓴다).
//   · 금액(ports Money — 최소 단위 정수)은 price-tag formatPrice 로(원화 12,900원). VAT 표기는 문구로 받는다(vatIncluded → 「VAT 포함」, 아니면 「부가세 별도」).
//   · 날짜는 서울 시각으로 읽는다. 구독 기간 끝(currentPeriodEnd·trialEnd·consentBy)은 「그 순간 직전까지」라 until 로(10-31T15:00Z → 10월 31일까지),
//     새 값이 시작되는 때(effectiveAt·retryAt·pausedUntil)는 from 으로(10-30T15:00Z → 10월 31일부터) 읽는다.
//   · 문구 틀의 {이름} 자리에 글자나 요소(금액 span 등)를 끼운다 — 금액·날짜 칸은 data-numeric 이다.

const DATE = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })

// locale·timeZone 을 받는다(D234) — 둘 다 없으면 위 DATE 그대로라 한국어 사이트의 출력 글자가 그대로다.
// 로캘은 "ko"·"en"(BlockBase.locale) 또는 Intl 로캘 태그, 시간대는 IANA 이름(기본 Asia/Seoul). 조합마다 한 번만 만든다.
const DATES = new Map<string, Intl.DateTimeFormat>()
const intlLocale = (locale?: string) => (!locale || locale === "ko" ? "ko-KR" : locale === "en" ? "en-US" : locale)
const dateFormat = (locale?: string, timeZone?: string) => {
  const tag = intlLocale(locale)
  const zone = timeZone ?? "Asia/Seoul"
  if (tag === "ko-KR" && zone === "Asia/Seoul") return DATE
  const key = `${tag}|${zone}`
  let f = DATES.get(key)
  if (!f) DATES.set(key, (f = new Intl.DateTimeFormat(tag, { timeZone: zone, year: "numeric", month: "long", day: "numeric" })))
  return f
}
// 날짜·시각 모양을 직접 고르는 곳(예약 일시·특별 영업일·설립 연월 …)을 위한 같은 규칙의 자유 모양 — locale·timeZone 을 안 주면 ko-KR·Asia/Seoul 이라 한국어 출력이 예전 글자 그대로다.
// 달력 날짜(「2026-10-05」처럼 순간이 아닌 값)는 호출하는 쪽이 `${날짜}T00:00:00Z` + timeZone "UTC" 로 읽는다(시간대가 날짜를 밀지 않게).
const PARTS = new Map<string, Intl.DateTimeFormat>()
export function formatDateParts(at: Date | IsoDate, parts: Intl.DateTimeFormatOptions, locale?: string, timeZone?: string): string {
  const tag = intlLocale(locale)
  const zone = timeZone ?? "Asia/Seoul"
  const key = `${tag}|${zone}|${JSON.stringify(parts)}`
  let f = PARTS.get(key)
  if (!f) PARTS.set(key, (f = new Intl.DateTimeFormat(tag, { timeZone: zone, ...parts })))
  return f.format(typeof at === "string" ? new Date(at) : at)
}
/** 그날부터(서울 날짜) — 예: 2026년 10월 31일 (locale 을 주면 그 로캘: September 25, 2026 · timeZone 을 주면 그 시간대의 날짜) */
export function formatFrom(iso: IsoDate, locale?: string, timeZone?: string): string {
  return dateFormat(locale, timeZone).format(new Date(iso))
}
/** 그때까지(끝 순간 직전의 서울 날짜) — 10-31T15:00Z(11월 1일 0시)는 10월 31일까지 */
export function formatUntil(iso: IsoDate, locale?: string, timeZone?: string): string {
  return dateFormat(locale, timeZone).format(new Date(new Date(iso).getTime() - 1))
}
/** 금액 글자(12,900원). 부가세 표기는 따로(vatLabel). locale 을 주면 그 로캘 표기(en → ₩12,900) — 안 주면 예전 글자 그대로다(판매 블록이 영어 사이트에서 넘긴다) */
export function formatMoney(m: Money, locale?: string): string {
  const amount = m.currency === "USD" || m.currency === "EUR" ? m.amount / 100 : m.amount
  return locale ? formatPrice(amount, m.currency, { locale: intlLocale(locale) }) : formatPrice(amount, m.currency)
}
/** 「VAT 포함」 또는 「부가세 별도」(문구에서) */
export function vatLabel(m: Money, copy: { vatIncluded: string; vatExcluded: string }): string {
  return m.vatIncluded ? copy.vatIncluded : copy.vatExcluded
}
/** 두 때 사이의 날 수(올림, 0 아래는 0) */
export function daysBetween(fromMs: number, to: IsoDate): number {
  return Math.max(0, Math.ceil((new Date(to).getTime() - fromMs) / 86_400_000))
}
/** from 에서 days 날 뒤(ISO) */
export function addDays(from: IsoDate, days: number): IsoDate {
  return new Date(new Date(from).getTime() + days * 86_400_000).toISOString()
}

/** 문구 틀 채우기: 「{date}에 {amount}이 결제돼요」 + { date: "10월 15일", amount: <MoneyText …/> } → 글자·요소 배열 */
export function fill(template: string, vars: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/(\{[a-zA-Z]+\})/g).map((part, i) => {
    const m = part.match(/^\{([a-zA-Z]+)\}$/)
    return m && m[1] in vars ? <React.Fragment key={i}>{vars[m[1]]}</React.Fragment> : part
  })
}
/** 문구 틀 채우기(글자만 — aria-label·계측 라벨처럼 요소를 못 넣는 곳) */
export function fillText(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all))
}

/**
 * 금액 한 칸(data-numeric). price 로 이 금액의 역할을 적는다 — billed 는 실제 청구 총액(가장 크게, 마케팅 규칙 P1),
 * equivalent 는 환산가(하루·한 달 꼴 — 보조 크기), 그 밖은 비교·안내용. 크기는 부르는 쪽 훅이 정한다.
 */
export function MoneyText({ money, price, className, locale }: { money: Money; price?: "billed" | "equivalent" | "before" | "after" | "plain"; className?: string; locale?: string }) {
  return (
    <span data-numeric data-price={price} className={cn("tabular-nums", className)}>
      {formatMoney(money, locale)}
    </span>
  )
}
/** 「지금」(ISO). now 를 주면 그것(서버 렌더·스크린샷이 흔들리지 않게), 아니면 처음 그릴 때의 시각 하나를 붙잡아 쓴다 */
export function useNow(now?: IsoDate): IsoDate {
  const [first] = React.useState(() => now ?? new Date().toISOString())
  return now ?? first
}

/**
 * 남은 날 — 카운트다운은 실제 끝나는 때(endsAt, 필수)에 묶는다(마케팅 규칙 L8: 되돌아가는 타이머·상시 「곧 종료」 금지).
 * 초를 세지 않고 날 수만 적는다. data-countdown·data-ends-at 은 관문이 실제 값인지 대조하는 표지다
 */
export function DaysLeft({ endsAt, now, template, className }: { endsAt: IsoDate; now: IsoDate; template: string; className?: string }) {
  return (
    <span data-countdown="" data-ends-at={endsAt} className={cn("tabular-nums", className)}>
      {fill(template, { days: <span data-numeric>{daysBetween(new Date(now).getTime(), endsAt)}</span> })}
    </span>
  )
}

/** 날짜 한 칸(data-numeric) — until: 끝 날짜(그날까지), since: 시작 날짜(그날부터) */
export function DateText({ iso, as = "until", locale, timeZone, className }: { iso: IsoDate; as?: "until" | "since"; locale?: string; timeZone?: string; className?: string }) {
  return (
    <time data-numeric dateTime={iso} className={cn("tabular-nums", className)}>
      {as === "until" ? formatUntil(iso, locale, timeZone) : formatFrom(iso, locale, timeZone)}
    </time>
  )
}
