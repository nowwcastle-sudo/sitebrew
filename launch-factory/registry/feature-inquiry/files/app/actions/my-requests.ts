"use server"
// launch-factory: 내 신청 내역 서버 액션(계획 3c Task 5). 사용자 id 는 입력으로 받지 않는다 — 세션에서 읽는다(남의 것을 볼 수 없다).
//   myRequests: 로그인한 본인 문의 목록. 연락처·내용은 가린 앞부분만 내려간다(전체 내용·이름은 읽지도 않는다).
// 처리 상태 바꾸기(관리자·소유자)는 이 파일에 없다 — 관리 콘솔의 문의 구획(admin-sections/inquiries.ts)만 그 입구다(두 번째 입구 금지, 계획 3d).
import { messages } from "@launch-factory/i18n"
import { authPort } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { inquiry } from "@/lib/launch/inquiry"

const signInRequired = () => ({ ok: false as const, formError: messages(DEFAULT_LOCALE).auth.signInRequired })
const impersonationBlocked = () => ({ ok: false as const, status: 403 as const, code: "impersonation_blocked" as const, formError: messages(DEFAULT_LOCALE).auth.impersonationBlocked })
const invalidInput = { ok: false as const, error: "invalid_input" as const }

/** 지금 로그인한 사람의 id. 로그아웃 → null(로그인 요구), 대리 세션 → "impersonated" */
async function session(): Promise<{ userId: string } | "impersonated" | null> {
  const s = await (await authPort()).session()
  if (!s.ok || !s.data) return null
  return s.data.impersonatedBy ? "impersonated" : { userId: s.data.userId }
}

/** 입력: { page? }(정수 1 이상). 모양이 틀리면 invalid_input */
export async function myRequests(input?: unknown) {
  const i = input === undefined ? {} : input
  if (typeof i !== "object" || i === null) return invalidInput
  const page = (i as Record<string, unknown>).page
  if (page !== undefined && !(typeof page === "number" && Number.isInteger(page) && page >= 1)) return invalidInput
  const who = await session()
  if (who === "impersonated") return impersonationBlocked()
  if (!who) return signInRequired()
  return { ok: true as const, data: await (await inquiry()).listMine(who.userId, page === undefined ? {} : { page: page as number }) }
}
