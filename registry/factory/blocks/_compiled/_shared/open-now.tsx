import * as React from "react"

import { DAYS, hoursTimeline, type Day, type HolidayPolicy, type Holidays, type OpeningHours, type SpecialHours } from "@/registry/factory/content/content-core"

// 지금 영업 중인가(P3-2 공유 조각 block-shared-open-now — hours-location 세 변형이 같이 쓴다). 순수 함수 openNow(hours, now)와 그 문구.
// 시간대는 Asia/Seoul 로 고정한다 — 방문자 기기의 시간대와 상관없이 가게 시각으로 판정한다(Intl.DateTimeFormat ko-KR).
// 해석은 content-core hoursTimeline 하나를 쓴다(화면 문구·JSON-LD·검사와 같다): 밤샘 영업은 여는 시각보다 이른 시각을 다음 날로 보고,
// 전날 밤샘 영업이 오늘 새벽까지 이어지면 그 구간도 본다. 쉬는 시간은 [시작, 끝) — 끝 시각에는 다시 영업 중이다. 빠진 요일은 휴무다.
// 특수일(대장 A105): 판정은 특수일(hoursSpecial) → 공휴일(holidays × holidayPolicy) → 요일 순이다. 설·추석·대체공휴일에 「영업 중」이 거짓으로 뜨지 않게 한다.

export type OpenState = "open" | "break" | "closed"
export type OpenNow = {
  state: OpenState
  // 서울 달력의 오늘 요일과 그날 0시부터 지난 분
  today: Day
  minutes: number
  // 오늘 요일이 영업시간 목록에 없다(휴무일) — 전날 밤샘 영업이 이어지는 새벽에도 참일 수 있다
  closedToday: boolean
  // open: 닫는 시각(HH:MM, 다음 날이면 nextDay)
  closesAt?: { time: string; nextDay: boolean }
  // break: 다시 여는 시각
  resumesAt?: string
  // closed: 다음에 여는 요일·시각 — inDays 0 은 오늘 늦게, 1 은 내일
  opensAt?: { day: Day; time: string; inDays: number }
  // 오늘 실제로 적용되는 영업시간(특수일이면 그날 시간, 쉬는 날이면 null)
  hoursToday: OpeningHours[number] | null
  // 오늘이 특수일·공휴일이라 요일표를 덮었다(이름이 있으면 label)
  note?: { kind: "special" | "holiday"; label?: string }
}

// 특수일·공휴일(선택) — content-core SpecialHours·Holidays·HolidayPolicy 그대로
export type OpenOptions = { special?: SpecialHours; holidays?: Holidays; holidayPolicy?: HolidayPolicy }

const DAY_OF: Record<string, Day> = { 월: "mo", 화: "tu", 수: "we", 목: "th", 금: "fr", 토: "sa", 일: "su" }
const SEOUL = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** 서울 시각의 요일과 분(0~1439). */
export function seoulClock(now: Date): { day: Day; minutes: number } {
  const p = Object.fromEntries(SEOUL.formatToParts(now).map((x) => [x.type, x.value]))
  const day = DAY_OF[p.weekday ?? ""]
  if (!day) throw new Error(`seoulClock: could not read the weekday — ${p.weekday}`)
  return { day, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}

const SEOUL_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
/** 서울 달력의 날짜(YYYY-MM-DD) */
export const seoulDate = (now: Date) => SEOUL_DATE.format(now)
const shiftDate = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

/** hours(요일별 영업시간 — 빠진 요일은 휴무)와 지금(Date), 선택 특수일·공휴일 → 서울 시각 기준 영업 상태. 순수 함수. */
export function openNow(hours: OpeningHours, now: Date, opt: OpenOptions = {}): OpenNow {
  const { day, minutes } = seoulClock(now)
  const date = seoulDate(now)
  const byDay = new Map(hours.map((h) => [h.day, h]))
  const special = new Map((opt.special ?? []).map((x) => [x.date, x]))
  const holiday = new Map((opt.holidays ?? []).map((x) => [x.date, x.label]))
  type Entry = { h: OpeningHours[number] | null; note?: OpenNow["note"] }
  // 그 날짜의 영업시간: 특수일 → 공휴일(closed 정책) → 요일. 특수일은 밤샘·쉬는 시간이 없다
  const entry = (d: string, dk: Day): Entry => {
    const sp = special.get(d)
    if (sp) {
      const note = { kind: "special" as const, label: sp.label ?? holiday.get(d) }
      return sp.closed ? { h: null, note } : { h: { day: dk, opens: sp.opens ?? "00:00", closes: sp.closes ?? "24:00" }, note }
    }
    const label = holiday.get(d)
    if (label !== undefined && opt.holidayPolicy === "closed") return { h: null, note: { kind: "holiday", label } }
    return { h: byDay.get(dk) ?? null }
  }
  const idx = DAYS.indexOf(day)
  const today = entry(date, day)
  const closedToday = !today.h
  const base = { today: day, minutes, closedToday, hoursToday: today.h, ...(today.note ? { note: today.note } : {}) }
  const inBreak = (breaks: [number, number][], m: number) => breaks.find(([s, e]) => m >= s && m < e)
  // 전날 밤샘 영업이 오늘 새벽까지 이어진다(전날 기준 분 = 오늘 분 + 1440) — 전날이 특수일이면 이어지지 않는다
  const prev = entry(shiftDate(date, -1), DAYS[(idx + 6) % 7]).h
  if (prev?.overnight) {
    const t = hoursTimeline(prev)
    const m = minutes + 1440
    if (m >= t.open && m < t.close) {
      const br = inBreak(t.breaks, m)
      return br ? { ...base, state: "break", resumesAt: hhmm(br[1]) } : { ...base, state: "open", closesAt: { time: prev.closes, nextDay: false } }
    }
  }
  const h = today.h
  if (h) {
    const t = hoursTimeline(h)
    if (minutes >= t.open && minutes < t.close) {
      const br = inBreak(t.breaks, minutes)
      return br ? { ...base, state: "break", resumesAt: hhmm(br[1]) } : { ...base, state: "open", closesAt: { time: h.closes, nextDay: !!h.overnight } }
    }
    if (minutes < t.open) return { ...base, state: "closed", opensAt: { day, time: h.opens, inDays: 0 } }
  }
  // 연휴가 길 수 있어 2주 앞까지 본다
  for (let i = 1; i <= 14; i++) {
    const d = DAYS[(idx + i) % 7]
    const n = entry(shiftDate(date, i), d).h
    if (n) return { ...base, state: "closed", opensAt: { day: d, time: n.opens, inDays: i } }
  }
  return { ...base, state: "closed" }
}

/** 영업 상태 문구(블록 copy 로 받는다 — 블록 안에 한국어를 박지 않는다). {time}·{day} 자리를 채운다. */
export type OpenStatusCopy = {
  open: string // 「영업 중」
  break: string // 「쉬는 시간」
  closed: string // 「영업 전」·「영업 종료」 대신 한 말(「지금은 문을 닫았어요」)
  closedToday: string // 「오늘 휴무」
  specialClosed?: string // 「오늘은 {label}이라 쉬어요」(특수일·공휴일 — 이름이 있을 때)
  closesAt: string // 「{time}에 닫아요」
  closesNextDay: string // 「익일 {time}에 닫아요」
  resumesAt: string // 「{time}에 다시 열어요」
  opensToday: string // 「오늘 {time}에 열어요」
  opensTomorrow: string // 「내일 {time}에 열어요」
  opensOn: string // 「{day}요일 {time}에 열어요」
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "")

/** 상태 → [큰 말, 덧붙임]. days 는 요일 이름(copy — 「월」…). */
export function openStatusText(s: OpenNow, copy: OpenStatusCopy, days: Record<Day, string>): [string, string] {
  if (s.state === "open") return [copy.open, s.closesAt ? fill(s.closesAt.nextDay ? copy.closesNextDay : copy.closesAt, { time: s.closesAt.time }) : ""]
  if (s.state === "break") return [copy.break, s.resumesAt ? fill(copy.resumesAt, { time: s.resumesAt }) : ""]
  const head = s.closedToday && s.opensAt?.inDays !== 0 ? (s.note?.label && copy.specialClosed ? fill(copy.specialClosed, { label: s.note.label }) : copy.closedToday) : copy.closed
  if (!s.opensAt) return [head, ""]
  const tpl = s.opensAt.inDays === 0 ? copy.opensToday : s.opensAt.inDays === 1 ? copy.opensTomorrow : copy.opensOn
  return [head, fill(tpl, { time: s.opensAt.time, day: days[s.opensAt.day] })]
}

// 분 단위 시계(외부 저장소): 스냅숏은 「지금이 몇 번째 분인가」라 같은 분 안에서는 같은 값이다(다시 그리지 않는다). 서버 스냅숏은 null.
const minuteSnapshot = () => Math.floor(Date.now() / 60_000)
const serverSnapshot = () => null
function subscribeMinute(onChange: () => void) {
  const t = window.setInterval(onChange, 10_000)
  return () => window.clearInterval(t)
}

/**
 * 지금 시각. at(ISO 문자열)을 주면 그 시각으로 고정한다(예시·검사). 주지 않으면 서버 렌더·하이드레이션에서는 null(상태를 그리지 않는다 —
 * 서버와 브라우저 시각이 달라 하이드레이션이 어긋나지 않게), 붙은 뒤 브라우저 시각을 분 단위로 읽는다.
 */
export function useNow(at?: string): Date | null {
  const minute = React.useSyncExternalStore<number | null>(subscribeMinute, minuteSnapshot, serverSnapshot)
  return React.useMemo(() => (at ? new Date(at) : minute === null ? null : new Date(minute * 60_000)), [at, minute])
}
