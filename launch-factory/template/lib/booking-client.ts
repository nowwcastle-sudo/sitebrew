// 예약 화면의 브라우저 쪽 순수 도우미(React 없음). 날짜·시각은 모두 설정의 시간대(timeZone)로 읽고 적는다 — 방문자 기기의 시간대로 적으면 슬롯 날짜가 어긋난다.

/** 그 시간대의 오늘 날짜(YYYY-MM-DD). loadBookingSlots 의 from 으로 쓴다 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

/** "Monday, October 26" */
export const formatDayLong = (iso: string, timeZone: string): string => new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(new Date(iso))

/** "10:00 AM" */
export const formatTime = (iso: string, timeZone: string): string => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/** "Monday, October 26, 10:00 AM" — 슬롯 라디오의 접근 이름(날짜와 시각이 함께 들어간다) */
export const formatSlotName = (iso: string, timeZone: string): string => `${formatDayLong(iso, timeZone)}, ${formatTime(iso, timeZone)}`

/** "Monday, October 26, 2026 at 10:00 AM" — 접수 영수증·조회 결과 */
export const formatWhen = (iso: string, timeZone: string): string =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(/, (\d{1,2}:\d{2})/, " at $1")

export interface SlotDay {
  date: string
  slots: ReadonlyArray<{ startsAt: string; available: number }>
}

/** 자리가 남은 슬롯이 있는 날만, 날짜순으로 */
export function openDays(days: readonly SlotDay[]): SlotDay[] {
  return days
    .map((d) => ({ date: d.date, slots: d.slots.filter((s) => s.available > 0) }))
    .filter((d) => d.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 예약금 금액(원화, 소수 없음) — "₩30,000" */
export const formatKrw = (amount: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(amount)

/** 환불 기한 같은 「시작 전 N 시간」: 1440 의 배수면 일, 60 의 배수면 시간, 아니면 분 */
export function formatLead(minutes: number): string {
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`
  if (minutes >= 1440 && minutes % 1440 === 0) return unit(minutes / 1440, "day")
  if (minutes >= 60 && minutes % 60 === 0) return unit(minutes / 60, "hour")
  return unit(minutes, "minute")
}
