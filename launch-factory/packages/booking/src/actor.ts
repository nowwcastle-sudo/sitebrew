// 상태를 바꿀 권한. 소유자(INQUIRY_OWNER_EMAIL 로 확인된 계정)나 관리자만 확정·대신 취소할 수 있다.
// 행위자는 서버가 세션에서 만든다 — 모양은 문의 패키지의 InquiryActor 와 같아 같은 조립 코드(actorFromUser)를 쓴다.
import type { BookingActor } from "./types.ts"

export interface StaffRules {
  /** 관리자 역할 이름(Better Auth admin 의 adminRoles 와 같은 값). 기본 ["admin"] */
  adminRoles?: readonly string[]
  /** 역할과 상관없이 관리자로 보는 사용자 id */
  adminUserIds?: readonly string[]
}

export const isSystemActor = (actor: BookingActor): actor is { system: true } => "system" in actor && actor.system === true

/** 사람 중 소유자 또는 관리자인가(시스템 작업은 사람이 아니다) */
export function isStaffActor(actor: BookingActor, rules: StaffRules = {}): boolean {
  if (isSystemActor(actor) || typeof actor.userId !== "string" || actor.userId === "") return false
  if (actor.isOwner === true || rules.adminUserIds?.includes(actor.userId)) return true
  const admin = rules.adminRoles ?? ["admin"]
  return (actor.role ?? "").split(",").some((r) => admin.includes(r.trim()))
}
