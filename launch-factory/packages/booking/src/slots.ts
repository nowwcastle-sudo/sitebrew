// 예약 가능 시간 계산 — 순수 함수. DB 도 시계도 모른다(이미 잡힌 예약 `taken` 과 현재 시각 `now` 를 받는다).
// 영업시간 − 휴무일 − (지금 + leadMinutes 이내) − (오늘 + horizonDays 밖) − 서비스 길이가 영업 끝을 넘는 칸, 수용량에서 겹치는 예약 수를 뺀 만큼이 available 이다.
// 수용량이 다 찬 칸도 available: 0 으로 돌려준다(화면이 「마감」으로 보일 수 있게). 실제 초과 예약 방지는 저장 트랜잭션이 한다(db bookByCapacity).
import { findService, minutesOfDay, type BookingConfig, type ServiceConfig } from "./config.ts"
import { addDays, isCalendarDate, localDateOf, weekdayOf, zonedToUtc } from "./zoned.ts"

const MINUTE_MS = 60_000

export interface TakenRange {
  startsAt: Date
  endsAt: Date
}
export interface Slot {
  startsAt: Date
  endsAt: Date
  /** 남은 자리(0 이면 마감) */
  available: number
}
export interface SlotDay {
  /** 지역 날짜 "YYYY-MM-DD" */
  date: string
  slots: Slot[]
}

/** 구간 [aStart, aEnd) 와 [bStart, bEnd) 가 겹치는가 — 맞닿기만 하면 겹치지 않는다(db 의 겹침 규칙과 같다) */
const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => aStart < bEnd && aEnd > bStart

/**
 * `from` 날(지역 날짜)부터 `days` 일 동안의 슬롯. service 는 설정의 서비스 id 또는 서비스 객체.
 * 모르는 서비스·없는 날짜·잘못된 일수는 던진다 — 부르는 쪽이 먼저 걸러야 하는 프로그램 오류다.
 */
export function computeSlots(config: BookingConfig, service: string | ServiceConfig, from: string, days: number, taken: readonly TakenRange[], now: Date): SlotDay[] {
  const svc = typeof service === "string" ? findService(config, service) : service
  if (!svc) throw new RangeError("unknown service")
  if (!isCalendarDate(from)) throw new RangeError("from must be a real date like 2026-11-02")
  if (!Number.isInteger(days) || days < 1) throw new RangeError("days must be a positive integer")

  const tz = config.timeZone
  const nowMs = now.getTime()
  const earliest = nowMs + config.leadMinutes * MINUTE_MS
  const lastDate = addDays(localDateOf(nowMs, tz), config.horizonDays)
  const closed = new Set(config.closedDates)
  const durationMs = svc.durationMin * MINUTE_MS
  const takenMs = taken.map((t) => [t.startsAt.getTime(), t.endsAt.getTime()] as const)

  const out: SlotDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const slots: Slot[] = []
    if (!closed.has(date) && date <= lastDate) {
      for (const [open, close] of config.weekly[weekdayOf(date)] ?? []) {
        const first = minutesOfDay(open)
        const to = minutesOfDay(close, true)
        if (first === null || to === null) continue // 설정 검사를 거친 값이면 일어나지 않는다
        const closeMs = zonedToUtc(date, to, tz)
        for (let t = first; t < to; t += config.slotStepMin) {
          const startMs = zonedToUtc(date, t, tz)
          if (startMs === null || startMs < earliest) continue // DST 로 없는 시각이거나 너무 가까운 시각
          const endMs = startMs + durationMs
          if (closeMs !== null && endMs > closeMs) break // 이 구간의 뒤쪽 칸은 모두 영업 끝을 넘는다
          const used = takenMs.filter(([s, e]) => overlaps(startMs, endMs, s, e)).length
          slots.push({ startsAt: new Date(startMs), endsAt: new Date(endMs), available: Math.max(0, svc.capacity - used) })
        }
      }
    }
    out.push({ date, slots })
  }
  return out
}
