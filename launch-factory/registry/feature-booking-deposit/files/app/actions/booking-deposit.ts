"use server"
// launch-factory: 예약금 서버 액션 — 결제창이 닫히거나 돌아온 뒤 결제를 확정하고(confirmBookingDeposit), 모의 결제를 일으킨다(payBookingWithMock, mock 전용).
// 공개 경로다(예약 조회와 같다 — 로그인 없이 예약한다). 입력 모양을 먼저 보고, 금액은 읽지 않는다: 결제 번호로 공급자에 다시 물어 예약 행의 금액과 맞을 때만 확정한다.
import { getBookingByReference } from "@launch-factory/db"
import { normalizeReference } from "@launch-factory/booking"
import { headers } from "next/headers"
import { booking } from "@/lib/launch/booking"
import { currentUserId } from "@/lib/launch/booking-session"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { payments } from "@/lib/launch/payments"

const invalid = { ok: false as const, error: "invalid_input" as const }
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null)

const ctx = async () => ({ headers: new Headers(await headers()), userId: await currentUserId(), locale: DEFAULT_LOCALE })

/** 결제 확정. input: { paymentId } — 결제창의 반환 주소(?paymentId=)나 결제창을 닫은 뒤 부른다. 이미 확정된 건은 같은 성공, 아직이면 payment_pending(다시 시도) */
export async function confirmBookingDeposit(input: unknown) {
  const paymentId = typeof input === "object" && input !== null ? str((input as Record<string, unknown>).paymentId, 128) : null
  if (!paymentId) return invalid
  return (await booking()).confirmDeposit({ paymentId }, await ctx())
}

/**
 * 모의 결제(LF_MODE=mock 미리보기 전용): 내 결제 대기 예약의 모의 결제를 「완료」로 만든다. 확정은 이어서 confirmBookingDeposit 이 같은 길로 한다.
 * live 에서는 code provider_unsupported 로 거절한다 — 실결제는 PortOne 결제창과 웹훅뿐이다. input: { orderId } (= 예약 번호)
 */
export async function payBookingWithMock(input: unknown) {
  const unsupported = { ok: false as const, code: "provider_unsupported", retryable: false }
  const config = payments()
  if (!config.enabled || config.mode !== "mock") return unsupported
  const raw = typeof input === "object" && input !== null ? str((input as Record<string, unknown>).orderId, 64) : null
  const reference = raw ? normalizeReference(raw) : null
  if (!reference) return invalid
  const notFound = { ok: false as const, code: "not_found", retryable: false }
  const row = await getBookingByReference(await database(), reference)
  if (!row?.depositRef || row.depositStatus !== "pending") return notFound
  try {
    config.gateway.markPaid(row.depositRef)
  } catch {
    // 서버가 다시 떠서 모의 결제 대기가 사라졌다 — 예약은 결제 대기 시간이 지나면 Cron 이 닫는다
    return notFound
  }
  return { ok: true as const }
}
