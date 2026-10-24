// 접수 입력 읽기·검사 — 순수(DB·시계 없이 now 만 받는다). 칸 이름은 블록이 보내는 그대로 돌려준다.
// 시각 규칙(영업시간·휴무일·lead·horizon)은 slots.ts 의 계산에 그대로 묻는다 — 「이 시각이 정말 슬롯인가」 를 따로 다시 구현하지 않는다.
import { t, type Locale } from "@launch-factory/i18n"
import { findService, type BookingConfig, type ServiceConfig } from "./config.ts"
import { contactKindOf, MAX_CONTACT_LENGTH } from "./contact.ts"
import { computeSlots } from "./slots.ts"
import { localDateOf } from "./zoned.ts"

export const LIMITS = { name: 100, contact: MAX_CONTACT_LENGTH, note: 1000 } as const
const CONTACT_FIELDS = ["contact", "email", "phone"] as const
/** 시간대 표기가 있는 ISO 시각만 받는다(표기가 없으면 서버 시간대로 읽혀 어긋난다) */
const STARTS_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

export type BookingInput = FormData | Record<string, unknown>

/** FormData·객체에서 문자열 칸만 읽는다(자기 속성만 — 프로토타입 칸은 무시) */
export function readFields(input: BookingInput): Map<string, string> {
  const out = new Map<string, string>()
  const entries = input instanceof FormData ? [...input.entries()] : Object.entries(input ?? {})
  for (const [k, v] of entries) if (typeof v === "string") out.set(k, v.trim())
  return out
}

export interface ParsedBooking {
  service: ServiceConfig
  startsAt: Date
  endsAt: Date
  partySize: number
  name?: string
  contact: string
  contactKind: "email" | "phone"
  note?: string
}
export type Parsed = ({ ok: true } & ParsedBooking) | { ok: false; fieldErrors: Record<string, string[]> }

export function parseBookingInput(f: Map<string, string>, config: BookingConfig, locale: Locale, now: Date): Parsed {
  const errors: Record<string, string[]> = {}
  const err = (field: string, text: string) => (errors[field] ??= []).push(text)

  const serviceId = f.get("service") ?? ""
  const service = serviceId ? findService(config, serviceId) : undefined
  if (!service) err("service", t(locale, serviceId ? "booking.serviceUnknown" : "booking.required"))

  let startsAt: Date | undefined
  const rawStart = f.get("startsAt") ?? ""
  if (!rawStart) err("startsAt", t(locale, "booking.required"))
  else if (!STARTS_AT.test(rawStart) || Number.isNaN(Date.parse(rawStart))) err("startsAt", t(locale, "booking.startsInvalid"))
  else startsAt = new Date(rawStart)
  if (service && startsAt) {
    const day = computeSlots(config, service, localDateOf(startsAt.getTime(), config.timeZone), 1, [], now)[0]
    if (!day?.slots.some((s) => s.startsAt.getTime() === startsAt?.getTime())) err("startsAt", t(locale, "booking.slotUnavailable"))
  }

  let partySize = 1
  const rawParty = f.get("partySize")
  if (rawParty !== undefined && rawParty !== "") {
    partySize = /^\d{1,3}$/.test(rawParty) ? Number(rawParty) : 0
    if (partySize < 1 || (service && partySize > service.partyMax)) err("partySize", t(locale, "booking.partyInvalid", { max: service?.partyMax ?? 1 }))
  }

  const name = f.get("name") || undefined
  if (name && name.length > LIMITS.name) err("name", t(locale, "booking.tooLong", { max: LIMITS.name }))
  const note = f.get("note") || undefined
  if (note && note.length > LIMITS.note) err("note", t(locale, "booking.tooLong", { max: LIMITS.note }))

  const contactField = CONTACT_FIELDS.find((k) => f.has(k)) ?? "contact"
  const contact = f.get(contactField) ?? ""
  let contactKind: "email" | "phone" = "email"
  if (!contact) err(contactField, t(locale, "booking.required"))
  else if (contact.length > LIMITS.contact) err(contactField, t(locale, "booking.tooLong", { max: LIMITS.contact }))
  else {
    const kind = contactKindOf(contact)
    if (kind) contactKind = kind
    else err(contactField, t(locale, "booking.contactInvalid"))
  }

  if (Object.keys(errors).length || !service || !startsAt) return { ok: false, fieldErrors: errors }
  return {
    ok: true,
    service,
    startsAt,
    endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
    partySize,
    ...(name ? { name } : {}),
    contact,
    contactKind,
    ...(note ? { note } : {}),
  }
}
