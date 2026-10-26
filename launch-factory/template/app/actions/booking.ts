"use server"
// launch-factory: 예약 서버 액션 — web-factory 예약 블록의 submit 포트 모양이다(`(input: Record<string, string>) => Promise<ActionResult>`).
// 서버 액션은 공개 경로라 입력 모양을 먼저 본다. IP 는 요청 머리에서 읽어 요청 제한 키에만 쓴다(저장하지 않는다).
import { headers } from "next/headers"
import { booking } from "@/lib/launch/booking"
import { currentUserId } from "@/lib/launch/booking-session"
import { DEFAULT_LOCALE } from "@/lib/launch/config"

const invalid = { ok: false as const, error: "invalid_input" as const }
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null)

const ctx = async () => ({ headers: new Headers(await headers()), userId: await currentUserId(), locale: DEFAULT_LOCALE })

/** 예약 가능 시간. input: { service, from: "YYYY-MM-DD", days? } */
export async function loadBookingSlots(input: unknown) {
  if (typeof input !== "object" || input === null) return invalid
  const i = input as Record<string, unknown>
  const service = str(i.service, 64)
  const from = str(i.from, 10)
  if (!service || !from) return invalid
  const days = typeof i.days === "number" && Number.isInteger(i.days) ? i.days : undefined
  return (await booking()).slots({ service, from, ...(days ? { days } : {}) }, { locale: DEFAULT_LOCALE })
}

/** 예약 접수. input: 폼 칸(service·startsAt·partySize·name·contact·note + idempotencyKey·cf-turnstile-response) */
export async function submitBooking(input: Record<string, string>) {
  return (await booking()).action(await ctx())(input)
}

/** 예약 번호 + 연락처로 예약을 보여 준다. 틀린 조합은 모두 같은 not_found */
export async function lookupBooking(input: unknown) {
  const p = pair(input)
  return p ? (await booking()).lookup(p, await ctx()) : invalid
}

/** 예약한 사람이 직접 취소한다(취소 마감 전까지) */
export async function cancelBooking(input: unknown) {
  const p = pair(input)
  return p ? (await booking()).cancel(p, await ctx()) : invalid
}

function pair(input: unknown): { reference: string; contact: string } | null {
  if (typeof input !== "object" || input === null) return null
  const i = input as Record<string, unknown>
  const reference = str(i.reference, 64)
  const contact = str(i.contact, 254)
  return reference && contact ? { reference, contact } : null
}
