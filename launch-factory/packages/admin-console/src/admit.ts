// 입장 판단(순수, 내부). 신원 × 대상 → 행위자 또는 거부 code. 세션·DB 를 모른다 — 신원은 템플릿이 읽어 넘긴다.
//   로그아웃 → sign_in_required · 대리 로그인 → impersonation_blocked · 차단 → forbidden
//   관리자 역할: 2단계 인증이 있으면 admin, 없으면 two_factor_required(같은 사람이 이 구획의 확인된 소유자면 owner 로 들어온다)
//   소유자 구획: 확인된 이메일이 소유자 이메일과 같으면(앞뒤 공백·대소문자 무시, 둘 다 비어 있지 않아야) owner, 아니면 forbidden
import type { AdminFailureCode } from "./port.ts"
import type { AdminActor, AdminIdentity, Audience } from "./section.ts"

export type Admission = { ok: true; actor: AdminActor } | { ok: false; code: AdminFailureCode }

const norm = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase()

export const DEFAULT_ADMIN_ROLES: readonly string[] = ["admin"]

export function admit(identity: AdminIdentity, audience: Audience, adminRoles: readonly string[] = DEFAULT_ADMIN_ROLES): Admission {
  if (identity.kind === "signed_out") return { ok: false, code: "sign_in_required" }
  if (identity.kind === "impersonating") return { ok: false, code: "impersonation_blocked" }
  if (identity.banned) return { ok: false, code: "forbidden" }
  const ownerEmail = audience === "admin" ? "" : norm(audience.owner())
  const isOwner = ownerEmail !== "" && norm(identity.verifiedEmail) === ownerEmail
  // Better Auth 는 역할을 쉼표 목록으로 저장한다("admin,support") — 목록 중 하나라도 관리자 역할이면 관리자다
  const isAdmin = (identity.role ?? "").split(",").some((r) => adminRoles.includes(r.trim()))
  const enter = (via: AdminActor["via"]): Admission => ({
    ok: true,
    actor: { userId: identity.userId, role: identity.role, isOwner, via } as AdminActor,
  })
  if (isAdmin && identity.twoFactor) return enter("admin")
  if (isOwner) return enter("owner")
  return { ok: false, code: isAdmin ? "two_factor_required" : "forbidden" }
}
