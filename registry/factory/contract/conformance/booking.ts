// 예약 포트 적합성 묶음(항목 contract-conformance — 계약 판 2 안의 선택 추가, sitebrew v0.2.0 계획 3b). 목은 mockBooking("?booking=<장면>")이다.
// 장면은 둘: open(모든 칸이 열려 있다)·full(모든 칸이 마감이다). 실제 어댑터는 make(setup) 이 그 장면의 새 포트를 돌려주게 해 같은 검사를 통과한다.
// 검사는 모양과 관계만 본다 — 칸 수·자리 수·예약 번호 꼴·문구는 어댑터마다 다르다. 가장 중요한 한 줄: 틀린 번호·연락처 조합은 무엇이 틀렸는지 구별되지 않는다(예약 존재 여부를 흘리지 않는다).
// 쓰기 검사는 상태를 바꾸므로 검사마다 make 를 새로 부른다.
import type { BookingPort, BookingStatus } from "@/registry/factory/contract/ports"
import { type ConformanceOptions, type ConformanceResult, deepEqual, runCheck, show } from "./conformance-core"

/** adapter-mock MOCK_BOOKINGS 와 같은 목록(적합성 테스트가 둘이 같은지 본다) */
export const BOOKING_SCENARIO_IDS = ["open", "full"] as const
export type BookingScenarioId = (typeof BOOKING_SCENARIO_IDS)[number]

export interface BookingSetup {
  scenario: BookingScenarioId
}
export type MakeBooking = (setup: BookingSetup) => BookingPort | Promise<BookingPort>

/**
 * 묶음 선택지. service·from·days 는 어댑터의 달력에 맞춘다 — from 은 예약할 수 있는 칸이 있고 취소 기한(시작 전 며칠)이 아직 남은 날짜로 준다.
 * 기본값은 목에 맞춘 값이다(서비스 consult, 첫 날짜 2026-10-05, 3일치).
 */
export interface BookingConformanceOptions extends ConformanceOptions {
  service?: string
  from?: string
  days?: number
  /** 예약에 적는 연락처(이메일). 어댑터가 이메일을 받지 않으면 전화번호를 준다 */
  contact?: string
}

const STATUSES: readonly BookingStatus[] = ["requested", "confirmed", "cancelled", "completed", "no_show"]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v))
const sameInstant = (a: unknown, b: unknown) => isDate(a) && isDate(b) && Date.parse(a) === Date.parse(b)
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0

export async function bookingConformance(makeBooking: MakeBooking, options: BookingConformanceOptions = {}): Promise<ConformanceResult[]> {
  const { service = "consult", from: firstDate = "2026-10-05", days = 3, contact = "kim@example.com" } = options
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  const make = (scenario: BookingScenarioId = "open") => Promise.resolve(makeBooking({ scenario }))

  /** 날짜별 칸을 한 줄로 편 목록 */
  const listSlots = async (port: BookingPort) => {
    const r = await port.slots({ service, from: firstDate, days })
    if (!r.ok) throw new Error(`slots() 실패: ${show(r)}`)
    return r.data.days.flatMap((d) => d.slots)
  }
  const firstSlot = async (port: BookingPort, open: boolean) => {
    const slot = (await listSlots(port)).find((s) => (open ? s.available > 0 : true))
    if (!slot) throw new Error(open ? "자리가 남은 칸이 없어요(from 을 바꿔 보세요)" : "칸이 하나도 없어요(from 을 바꿔 보세요)")
    return slot
  }
  const availableAt = async (port: BookingPort, startsAt: string) => (await listSlots(port)).find((s) => sameInstant(s.startsAt, startsAt))?.available
  const bookFirst = async (port: BookingPort) => {
    const slot = await firstSlot(port, true)
    const r = await port.book({ service, startsAt: slot.startsAt, contact })
    if (!r.ok) throw new Error(`book() 실패: ${show(r)}`)
    return { slot, receipt: r.data }
  }

  await check("booking.slots.shape", async () => {
    const r = await (await make()).slots({ service, from: firstDate, days })
    if (!r.ok) return `slots 실패: ${show(r)}`
    if (!Array.isArray(r.data.days) || r.data.days.length === 0) return `days 가 빈 목록이에요: ${show(r.data)}`
    const badDay = r.data.days.find((d) => !DATE.test(d.date) || !Array.isArray(d.slots))
    if (badDay) return `날짜(YYYY-MM-DD)나 slots 목록이 틀렸어요: ${show(badDay)}`
    const slots = r.data.days.flatMap((d) => d.slots)
    const badSlot = slots.find((s) => !isDate(s.startsAt) || !isCount(s.available))
    if (badSlot) return `칸의 startsAt(ISO)·available(0 이상 정수)이 틀렸어요: ${show(badSlot)}`
    return slots.some((s) => s.available > 0) ? null : "자리가 남은 칸이 하나도 없어요(open 장면이거나 from 이 맞지 않아요)"
  })

  await check("booking.book.happy-path", async () => {
    const { slot, receipt } = await bookFirst(await make())
    if (typeof receipt.id !== "string" || receipt.id.trim() === "") return `예약 번호(id)가 비었어요: ${show(receipt)}`
    if (!sameInstant(receipt.startsAt, slot.startsAt)) return `접수 시각이 고른 칸과 달라요: ${receipt.startsAt} ≠ ${slot.startsAt}`
    if (receipt.status !== "requested" && receipt.status !== "confirmed") return `접수 상태는 requested·confirmed 여야 해요: ${show(receipt.status)}`
    return typeof receipt.message === "string" && receipt.message !== "" ? null : "접수 안내 문구(message)가 비었어요"
  })

  // 예약이 칸을 잡는다: 잡은 칸의 남은 자리가 줄어든다(칸당 자리 수는 어댑터마다 다르다 — 줄었는지만 본다)
  await check("booking.book.holds-slot", async () => {
    const port = await make()
    const { slot } = await bookFirst(port)
    const after = await availableAt(port, slot.startsAt)
    return typeof after === "number" && after < slot.available ? null : `예약한 칸의 남은 자리가 줄지 않았어요: ${slot.available} → ${show(after)}`
  })

  await check("booking.book.invalid-input", async () => {
    const r = await (await make()).book({ service, startsAt: "", contact: "" })
    if (r.ok) return "시간도 연락처도 없는 예약이 접수됐어요"
    const missing = ["startsAt", "contact"].filter((k) => !r.fieldErrors?.[k]?.length)
    return missing.length ? `fieldErrors 에 칸 오류가 없어요: ${missing.join(", ")} — ${show(r)}` : null
  })
  await check("booking.book.unknown-service", async () => {
    const port = await make()
    const slot = await firstSlot(port, true)
    const r = await port.book({ service: "no-such-service", startsAt: slot.startsAt, contact })
    if (r.ok) return "모르는 서비스의 예약이 접수됐어요"
    return r.fieldErrors?.service?.length ? null : `fieldErrors.service 가 없어요: ${show(r)}`
  })

  await check("booking.lookup.happy-path", async () => {
    const port = await make()
    const { slot, receipt } = await bookFirst(port)
    const r = await port.lookup({ reference: receipt.id, contact })
    if (!r.ok) return `lookup 실패: ${show(r)}`
    const v = r.data
    if (v.id !== receipt.id) return `예약 번호가 달라요: ${v.id} ≠ ${receipt.id}`
    if (!sameInstant(v.startsAt, slot.startsAt) || !isDate(v.endsAt) || Date.parse(v.endsAt) <= Date.parse(v.startsAt)) return `startsAt·endsAt 이 틀렸어요: ${show(v)}`
    if (typeof v.service !== "string" || typeof v.serviceName !== "string" || v.serviceName === "") return `service·serviceName 이 틀렸어요: ${show(v)}`
    if (!Number.isInteger(v.partySize) || v.partySize < 1) return `partySize 가 1 이상 정수가 아니에요: ${show(v.partySize)}`
    if (!STATUSES.includes(v.status)) return `알 수 없는 상태: ${show(v.status)}`
    if (typeof v.canCancel !== "boolean" || !isDate(v.cancelBy)) return `canCancel(참/거짓)·cancelBy(ISO)가 틀렸어요: ${show(v)}`
    return JSON.stringify(v).includes(contact) ? "조회 결과가 연락처를 되돌려 줘요(이미 아는 값은 돌려주지 않아요)" : null
  })

  // 틀린 조합: 연락처가 틀린 경우도, 번호를 모르는 경우도 not_found 다. 그리고 둘은 구별되지 않는다(코드·문구·칸 오류가 같다)
  const strangers = async (port: BookingPort, reference: string) => ({
    wrongContact: await port.lookup({ reference, contact: "someone.else@example.com" }),
    unknownReference: await port.lookup({ reference: "no-such-reference", contact }),
  })
  await check("booking.lookup.wrong-contact", async () => {
    const port = await make()
    const { receipt } = await bookFirst(port)
    const r = (await strangers(port, receipt.id)).wrongContact
    return !r.ok && r.code === "not_found" ? null : `연락처가 틀린 조회는 { ok: false, code: "not_found" } 여야 해요: ${show(r)}`
  })
  await check("booking.lookup.unknown-reference", async () => {
    const r = (await strangers(await make(), "unused")).unknownReference
    return !r.ok && r.code === "not_found" ? null : `모르는 예약 번호 조회는 { ok: false, code: "not_found" } 여야 해요: ${show(r)}`
  })
  await check("booking.lookup.indistinguishable", async () => {
    const port = await make()
    const { receipt } = await bookFirst(port)
    const { wrongContact, unknownReference } = await strangers(port, receipt.id)
    if (wrongContact.ok || unknownReference.ok) return `틀린 조합이 성공했어요: ${show({ wrongContact, unknownReference })}`
    return deepEqual(wrongContact, unknownReference) ? null : `틀린 연락처와 모르는 번호의 실패가 달라서 예약이 있는지 드러나요: ${show(wrongContact)} ≠ ${show(unknownReference)}`
  })

  await check("booking.cancel.wrong-contact", async () => {
    const port = await make()
    const { receipt } = await bookFirst(port)
    const r = await port.cancel({ reference: receipt.id, contact: "someone.else@example.com" })
    if (r.ok || r.code !== "not_found") return `연락처가 틀린 취소는 { ok: false, code: "not_found" } 여야 해요: ${show(r)}`
    const view = await port.lookup({ reference: receipt.id, contact })
    return view.ok && view.data.status === receipt.status ? null : `거절된 취소가 예약 상태를 바꿨어요: ${show(view)}`
  })
  await check("booking.cancel.happy-path", async () => {
    const port = await make()
    const { receipt } = await bookFirst(port)
    const r = await port.cancel({ reference: receipt.id, contact })
    if (!r.ok) return `cancel 실패(from 이 취소 기한 안인지 확인하세요): ${show(r)}`
    if (r.data.id !== receipt.id || r.data.status !== "cancelled" || typeof r.data.message !== "string") return `취소 결과 모양이 틀렸어요: ${show(r.data)}`
    const view = await port.lookup({ reference: receipt.id, contact })
    if (!view.ok) return `취소한 예약은 조회돼야 해요: ${show(view)}`
    return view.data.status === "cancelled" && view.data.canCancel === false ? null : `취소 뒤 조회는 status "cancelled"·canCancel false 여야 해요: ${show(view.data)}`
  })
  await check("booking.cancel.again-invalid-state", async () => {
    const port = await make()
    const { receipt } = await bookFirst(port)
    const first = await port.cancel({ reference: receipt.id, contact })
    if (!first.ok) return `첫 취소 실패: ${show(first)}`
    const again = await port.cancel({ reference: receipt.id, contact })
    return !again.ok && again.code === "invalid_state" ? null : `이미 취소한 예약의 취소는 { ok: false, code: "invalid_state" } 여야 해요: ${show(again)}`
  })
  await check("booking.cancel.releases-slot", async () => {
    const port = await make()
    const { slot, receipt } = await bookFirst(port)
    const cancelled = await port.cancel({ reference: receipt.id, contact })
    if (!cancelled.ok) return `취소 실패: ${show(cancelled)}`
    const after = await availableAt(port, slot.startsAt)
    return after === slot.available ? null : `취소했는데 칸의 자리가 돌아오지 않았어요: ${slot.available} → ${show(after)}`
  })

  // full 장면: 모든 칸이 마감이고, 마감된 칸을 예약하면 slot_taken 이다
  await check("booking.full.slots-unavailable", async () => {
    const slots = await listSlots(await make("full"))
    if (slots.length === 0) return "full 장면에도 칸 목록은 있어야 해요(마감 표시를 위해)"
    const open = slots.filter((s) => s.available !== 0)
    return open.length ? `full 장면인데 자리가 남은 칸이 있어요: ${show(open[0])}` : null
  })
  await check("booking.full.book-slot-taken", async () => {
    const port = await make("full")
    const slot = await firstSlot(port, false)
    const r = await port.book({ service, startsAt: slot.startsAt, contact })
    return !r.ok && r.code === "slot_taken" ? null : `마감된 칸의 예약은 { ok: false, code: "slot_taken" } 여야 해요: ${show(r)}`
  })
  return out
}
