// 예약 설정 검사. 영업시간·서비스·마감 규칙은 코드가 아니라 제품이 가진 데이터(lib/launch/booking-config.ts)이고,
// 이 파일은 그 모양만 지킨다 — 잘못된 설정은 서비스를 만들 때(켤 때) 던진다. 틀린 설정으로 조용히 예약을 받는 것이 가장 나쁘다.
import { z } from "zod"
import { isCalendarDate, isTimeZone, WEEKDAYS, type Weekday } from "./zoned.ts"

export { WEEKDAYS, type Weekday }

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
/** "HH:MM" → 자정부터의 분. 닫는 시각만 "24:00"(자정)을 쓸 수 있다. 틀리면 null */
export function minutesOfDay(value: string, allowMidnightEnd = false): number | null {
  if (allowMidnightEnd && value === "24:00") return 1440
  const m = HHMM.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** 예약금 상한(원). 자릿수 실수(0 하나 더)를 막는 안전선이다 */
export const MAX_DEPOSIT = 10_000_000
const SERVICE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const positiveInt = (what: string) => z.number({ error: `${what} must be a number` }).int(`${what} must be an integer`).min(1, `${what} must be at least 1`)
const nonNegativeInt = (what: string) => z.number({ error: `${what} must be a number` }).int(`${what} must be an integer`).min(0, `${what} must be 0 or more`)

const ServiceSchema = z
  .object({
    id: z.string().regex(SERVICE_ID, "service id must be lowercase letters, digits and hyphens (max 40)"),
    name: z.object({ ko: z.string().trim().min(1, "service name.ko is required"), en: z.string().trim().min(1, "service name.en is required") }).strict(),
    durationMin: positiveInt("durationMin").max(1440, "durationMin must be at most 1440"),
    /** 같은 시간에 받을 수 있는 예약 건수 */
    capacity: positiveInt("capacity"),
    /** 한 예약의 최대 인원 */
    partyMax: positiveInt("partyMax"),
    /** 예약금(KRW, 원 단위 정수). 없거나 0 이면 예약금 없음. 금액의 정본은 이 설정이다 — 브라우저가 보낸 금액은 읽지 않는다 */
    deposit: nonNegativeInt("deposit").max(MAX_DEPOSIT, `deposit must be at most ${MAX_DEPOSIT}`).optional(),
  })
  .strict()
/** 결제 대기 기본 시간(분) — 이 시간 안에 결제가 없으면 자리를 풀어 준다 */
export const DEFAULT_HOLD_MINUTES = 30

/** 예약금 규칙(선택) — 모두 데이터다. 빠진 칸은 기본값: 대기 30분 · 전액 환불은 취소 마감까지 · 마감 뒤에는 환불 없음 */
const DepositPolicySchema = z
  .object({
    /** 결제 대기 시간(분). 지나면 크론이 자리를 풀고 예약을 닫는다 */
    holdMinutes: positiveInt("depositPolicy.holdMinutes").min(5, "depositPolicy.holdMinutes must be at least 5").max(1440, "depositPolicy.holdMinutes must be at most 1440").optional(),
    /** 시작 이 시간(분) 전까지 취소하면 전액 환불. 없으면 cancelBeforeMinutes */
    fullRefundBeforeMinutes: nonNegativeInt("depositPolicy.fullRefundBeforeMinutes").optional(),
    /** 전액 환불 기한 뒤에 취소(대표·시스템 취소, 또는 취소 마감이 더 늦은 설정)하면 돌려줄 비율(0~99%). 0 이면 돌려주지 않는다 */
    laterRefundPercent: nonNegativeInt("depositPolicy.laterRefundPercent").max(99, "depositPolicy.laterRefundPercent must be at most 99").optional(),
    /** 대표(또는 시스템)가 예약을 취소할 때 고객에게 돌려줄 비율(0~100%). 고객 사정이 아닌 사업자 쪽 취소라 기본은 100% 전액 — 시각과 상관없이 이 비율이다 */
    ownerCancelRefundPercent: nonNegativeInt("depositPolicy.ownerCancelRefundPercent").max(100, "depositPolicy.ownerCancelRefundPercent must be at most 100").optional(),
  })
  .strict()

const IntervalSchema = z.tuple([z.string(), z.string()], { error: "an opening interval must be [start, end] like [\"10:00\", \"18:00\"]" })
const WeeklySchema = z
  .object(Object.fromEntries(WEEKDAYS.map((d) => [d, z.array(IntervalSchema).optional()])) as Record<Weekday, z.ZodOptional<z.ZodArray<typeof IntervalSchema>>>)
  .strict()

export const BookingConfigSchema = z
  .object({
    timeZone: z.string().refine(isTimeZone, "timeZone must be an IANA time zone name like Asia/Seoul"),
    /** instant: 바로 확정 / request: 운영자가 확인한 뒤 확정 */
    mode: z.enum(["instant", "request"], { error: "mode must be instant or request" }),
    services: z.array(ServiceSchema).min(1, "at least one service is required"),
    weekly: WeeklySchema,
    closedDates: z.array(z.string().refine(isCalendarDate, "closedDates entries must be real dates like 2026-12-25")).default([]),
    slotStepMin: positiveInt("slotStepMin").max(1440, "slotStepMin must be at most 1440"),
    leadMinutes: nonNegativeInt("leadMinutes"),
    horizonDays: positiveInt("horizonDays").max(366, "horizonDays must be at most 366"),
    cancelBeforeMinutes: nonNegativeInt("cancelBeforeMinutes"),
    /** 0 이면 알림을 끈다 */
    reminderBeforeMinutes: nonNegativeInt("reminderBeforeMinutes"),
    retainDays: positiveInt("retainDays"),
    depositPolicy: DepositPolicySchema.optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>()
    c.services.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", path: ["services", i, "id"], message: `duplicate service id "${s.id}"` })
      seen.add(s.id)
    })
    const closed = new Set<string>()
    c.closedDates.forEach((d, i) => {
      if (closed.has(d)) ctx.addIssue({ code: "custom", path: ["closedDates", i], message: `duplicate closed date ${d}` })
      closed.add(d)
    })
    for (const day of WEEKDAYS) {
      const spans: Array<[number, number]> = []
      c.weekly[day]?.forEach(([start, end], i) => {
        const from = minutesOfDay(start)
        const to = minutesOfDay(end, true)
        if (from === null) ctx.addIssue({ code: "custom", path: ["weekly", day, i, 0], message: `"${start}" is not a time like 10:00 (00:00-23:59)` })
        if (to === null) ctx.addIssue({ code: "custom", path: ["weekly", day, i, 1], message: `"${end}" is not a time like 18:00 (00:00-24:00)` })
        if (from === null || to === null) return
        if (from >= to) ctx.addIssue({ code: "custom", path: ["weekly", day, i], message: `opening interval ${start}-${end} must end after it starts` })
        else spans.push([from, to])
      })
      spans.sort((a, b) => a[0] - b[0])
      for (let i = 1; i < spans.length; i++) {
        if ((spans[i] as [number, number])[0] < (spans[i - 1] as [number, number])[1]) ctx.addIssue({ code: "custom", path: ["weekly", day], message: `${day} has overlapping opening intervals` })
      }
    }
  })

export type ServiceConfig = z.output<typeof ServiceSchema>
export type BookingConfig = z.output<typeof BookingConfigSchema>

/** 설정이 틀렸다. problems 에 「경로: 이유」 가 모두 들어 있다(값은 싣지 않는다) */
export class BookingConfigError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`invalid booking config: ${problems.join("; ")}`)
    this.name = "BookingConfigError"
    this.problems = problems
  }
}

/** 설정 데이터를 검사해 돌려준다. 틀리면 BookingConfigError — 문제를 한 번에 모두 알린다 */
export function parseBookingConfig(input: unknown): BookingConfig {
  const r = BookingConfigSchema.safeParse(input)
  if (r.success) return r.data
  throw new BookingConfigError(r.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(config)"}: ${i.message}`))
}

/** 서비스의 예약금(원). 없으면 0 */
export const depositOf = (service: ServiceConfig): number => service.deposit ?? 0

/** 예약금 규칙에 기본값을 채운 것 */
export interface DepositRules {
  holdMinutes: number
  fullRefundBeforeMinutes: number
  laterRefundPercent: number
  ownerCancelRefundPercent: number
}
export function depositRules(config: BookingConfig): DepositRules {
  const p = config.depositPolicy
  return { holdMinutes: p?.holdMinutes ?? DEFAULT_HOLD_MINUTES, fullRefundBeforeMinutes: p?.fullRefundBeforeMinutes ?? config.cancelBeforeMinutes, laterRefundPercent: p?.laterRefundPercent ?? 0, ownerCancelRefundPercent: p?.ownerCancelRefundPercent ?? 100 }
}

/**
 * 취소하는 때(at)에 돌려줄 예약금. 전액 환불 기한(시작 − fullRefundBeforeMinutes)까지는 전부, 그 뒤에는 laterRefundPercent% (원 미만 버림).
 * 취소한 쪽이 대표·시스템(by "owner"|"system")이면 때와 상관없이 ownerCancelRefundPercent% (기본 100 — 사업자 쪽 사정의 취소는 고객이 손해 보지 않는다).
 * 순수 함수 — 서비스(취소)와 안내 문장(환불 규정)이 같은 계산을 쓴다.
 */
export function refundFor(config: BookingConfig, startsAt: Date, paid: number, at: Date, by: "booker" | "owner" | "system" = "booker"): { amount: number; full: boolean; fullBefore: Date } {
  const rules = depositRules(config)
  const fullBefore = new Date(startsAt.getTime() - rules.fullRefundBeforeMinutes * 60_000)
  if (by !== "booker") {
    const amount = Math.floor((paid * rules.ownerCancelRefundPercent) / 100)
    return { amount, full: amount === paid, fullBefore }
  }
  if (at.getTime() <= fullBefore.getTime()) return { amount: paid, full: true, fullBefore }
  return { amount: Math.floor((paid * rules.laterRefundPercent) / 100), full: false, fullBefore }
}

/** 서비스 id 로 찾는다. 없으면 undefined */
export const findService = (config: BookingConfig, id: string): ServiceConfig | undefined => config.services.find((s) => s.id === id)
