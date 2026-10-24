// 시간대 변환·달력 날짜 도우미. 의존 0 — `Intl` 만 쓴다(DST 가 있는 시간대에서도 [지역 날짜 + 분 → UTC] 가 맞아야 한다).
// 이 파일은 날짜·시간대 계산만 한다. 영업시간·서비스 같은 예약 규칙은 모른다(slots.ts).

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
export type Weekday = (typeof WEEKDAYS)[number]

const DAY_MS = 86_400_000
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** IANA 시간대 이름으로 쓸 수 있는가(모르는 이름은 Intl 이 RangeError 를 던진다) */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

function dateParts(value: string): [number, number, number] | null {
  const m = DATE.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const at = new Date(Date.UTC(y, mo - 1, d))
  // 2026-02-30 같은 없는 날은 Date 가 다음 달로 넘기므로 되돌려 보아 걸러낸다
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d ? [y, mo, d] : null
}

/** "YYYY-MM-DD" 이고 달력에 있는 날인가 */
export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && dateParts(value) !== null
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** 달력 날짜에 일수를 더한다(시간대와 무관한 순수 달력 계산) */
export function addDays(date: string, days: number): string {
  const p = dateParts(date)
  if (!p) throw new RangeError("invalid calendar date")
  const at = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + days * DAY_MS)
  return `${pad(at.getUTCFullYear(), 4)}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`
}

/** 달력 날짜의 요일. 같은 날짜의 요일은 어느 시간대에서나 같다 */
export function weekdayOf(date: string): Weekday {
  const p = dateParts(date)
  if (!p) throw new RangeError("invalid calendar date")
  const sunFirst = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()
  return WEEKDAYS[(sunFirst + 6) % 7] as Weekday
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    formatters.set(timeZone, f)
  }
  return f
}

/** 그 순간 시간대의 벽시계 값을 「UTC 인 척」 밀리초로 (Date.UTC(지역 연·월·일·시·분·초)) */
function wallClockMs(timeZone: string, utcMs: number): number {
  const v: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(utcMs))) if (part.type !== "literal") v[part.type] = Number(part.value)
  return Date.UTC(v.year as number, (v.month as number) - 1, v.day as number, v.hour as number, v.minute as number, v.second as number)
}

/** 그 순간 시간대가 UTC 보다 앞서는 만큼(ms). Asia/Seoul 은 늘 +9시간 */
const offsetAt = (timeZone: string, utcMs: number): number => wallClockMs(timeZone, utcMs) - Math.floor(utcMs / 1000) * 1000

/** 그 순간의 지역 날짜 "YYYY-MM-DD" */
export function localDateOf(utcMs: number, timeZone: string): string {
  const d = new Date(wallClockMs(timeZone, utcMs))
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * 지역 날짜 + 자정부터의 분 → UTC 밀리초. `minutes` 는 1440 이상이어도 된다(24:00 = 다음 날 0시).
 * DST 때문에 없는 시각(봄에 건너뛴 한 시간)은 null, 두 번 있는 시각(가을)은 이른 쪽이다.
 * 방법: 앞뒤 하루의 UTC 차이 두 개로 후보 둘을 만들고, 다시 지역 시각으로 되돌려 맞는 것만 쓴다.
 */
export function zonedToUtc(date: string, minutes: number, timeZone: string): number | null {
  const p = dateParts(date)
  if (!p) throw new RangeError("invalid calendar date")
  const wall = Date.UTC(p[0], p[1] - 1, p[2], 0, minutes, 0)
  const candidates = new Set([wall - offsetAt(timeZone, wall - DAY_MS), wall - offsetAt(timeZone, wall + DAY_MS)])
  const valid = [...candidates].filter((utc) => wallClockMs(timeZone, utc) === wall)
  return valid.length ? Math.min(...valid) : null
}
