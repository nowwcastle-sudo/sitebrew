// launch-factory: 관리 화면이 「지금 누구인가」를 읽는 한 곳(계획 3d). 세션과 사용자 행을 요청당 한 번 읽어 판정에 필요한 값만 돌려준다.
// 신원의 모양(signed_out = 로그아웃·만료·읽기 실패, impersonating = 관리자가 대신 들어온 세션, user = 로그인한 사람)은 콘솔 패키지가 정한다.
// 판정(관리자 벽·소유자 규칙·확인 벽)은 여기서 하지 않는다 — 콘솔(@launch-factory/admin-console)이 이 값을 받아 순수하게 정한다. 구획 모듈은 세션을 보지 못한다.
// 입력(요청 본문·주소)의 role·userId 는 읽지 않는다 — 세션의 사용자 행에서만 온다. 서버 전용.
import type { AdminIdentity } from "@launch-factory/admin-console"
import { user } from "@launch-factory/db"
import { eq } from "drizzle-orm"
import { authPort } from "@/lib/launch/auth"
import { database } from "@/lib/launch/db"

export type { AdminIdentity }

/** 세션을 읽고(없으면 signed_out) 사용자 행을 읽는다. 행이 없으면 정지된 사람처럼 권한 없는 사람이다(banned: true) */
export async function identify(): Promise<AdminIdentity> {
  let s: Awaited<ReturnType<Awaited<ReturnType<typeof authPort>>["session"]>>
  try {
    s = await (await authPort()).session()
  } catch {
    return { kind: "signed_out" }
  }
  if (!s.ok || !s.data) return { kind: "signed_out" }
  if (s.data.impersonatedBy) return { kind: "impersonating" }
  const [row] = await (await database()).select({ role: user.role, banned: user.banned, twoFactorEnabled: user.twoFactorEnabled, email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, s.data.userId)).limit(1)
  if (!row) return { kind: "user", userId: s.data.userId, role: null, banned: true, twoFactor: false, verifiedEmail: null }
  return { kind: "user", userId: s.data.userId, role: row.role ?? null, banned: row.banned === true, twoFactor: row.twoFactorEnabled === true, verifiedEmail: row.emailVerified === true && row.email ? row.email : null }
}
