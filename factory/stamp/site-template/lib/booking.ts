"use client"

// 예약 완료 쪽이 그릴 예약(P3-3 Task 9b, C111) — 예시 예약이 아니라 방문자가 폼으로 보낸 값이다. 폼을 보낸 뒤 이 쪽으로 오는 주소의 ?ref=&at=&people=(&confirmed=1)에서 읽는다.
// 값이 없거나 모양이 틀리면 null — 잎이 아무것도 그리지 않는다(가짜 요청 번호를 보이지 않는다). 폼 → 이 쪽 이동은 접수 서버(launch-factory 어댑터)가 잇는다.
import { useSearchParams } from "next/navigation"

export type UrlBooking = { at: string; people: number; ref: string; confirmed?: boolean }

const REF = /^[A-Za-z0-9_-]{1,40}$/

export function useBookingFromUrl(): UrlBooking | null {
  const q = useSearchParams()
  const ref = q.get("ref")
  const at = q.get("at")
  if (!ref || !REF.test(ref) || !at || Number.isNaN(Date.parse(at))) return null
  const n = Number(q.get("people") ?? 1)
  return { ref, at, people: Number.isInteger(n) && n > 0 && n < 1000 ? n : 1, ...(q.get("confirmed") === "1" ? { confirmed: true } : {}) }
}
