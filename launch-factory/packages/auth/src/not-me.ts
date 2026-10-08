// 「제가 가입한 게 아니에요」(A13). 남의 주소로 가입이 되면 그 주소 주인이 확인 메일을 받는다 — 메일의 서명 링크를 누르면 아직 이메일을 확인하지 않은 그 계정을 지운다.
// 지우는 조건: ① 서명·기한이 맞는 토큰(가입 때 만든다, 기한 14일) ② 이메일이 아직 확인되지 않은 계정 ③ 구독·결제 기록이 없는 계정(돈이 오간 계정은 이 길로 지우지 않는다 — 탈퇴 절차를 거친다).
// 확인된 계정은 건드리지 않는다. 사용자 id 는 서명으로 묶여 있어 다른 계정을 지울 수 없다. 지우기는 사용자 행 삭제 한 번이고 세션·동의·기기 기록은 외래키 cascade 로 같이 지워진다.
// 메일 보안 프로그램이 링크를 미리 열어도 지워지지 않게, 이 링크는 GET 이 아니라 확인 화면의 POST 로만 처리한다(템플릿의 /email 화면 → /api/account/not-me).
import { count, eq } from "drizzle-orm"
import { deleteUnverifiedUser, subscriptions, user, type Database } from "@launch-factory/db"
import { signToken, verifyToken } from "@launch-factory/security/signed-token"

export const NOT_ME_PURPOSE = "signup-not-me"
/** 링크 기한(일). 확인 링크(1시간)보다 길다 — 늦게 메일을 본 주소 주인도 신고할 수 있어야 한다 */
export const NOT_ME_DAYS = 14

export function notMeToken(userId: string, secret: string, now: Date = new Date()): string {
  return signToken({ u: userId }, { secret, purpose: NOT_ME_PURPOSE, expiresAt: new Date(now.getTime() + NOT_ME_DAYS * 86_400_000) })
}

export type NotMeResult =
  | { ok: true; removed: true }
  | { ok: true; removed: false; reason: "verified" | "has_subscription" | "gone" }
  | { ok: false; reason: "invalid" }

export async function removeUnverifiedByToken(db: Database, token: unknown, o: { secret: string; now?: Date }): Promise<NotMeResult> {
  const p = verifyToken(token, { secret: o.secret, purpose: NOT_ME_PURPOSE, now: o.now })
  if (!p || typeof p.u !== "string" || !p.u) return { ok: false, reason: "invalid" }
  const [row] = await db.select({ verified: user.emailVerified }).from(user).where(eq(user.id, p.u)).limit(1)
  if (!row) return { ok: true, removed: false, reason: "gone" }
  if (row.verified) return { ok: true, removed: false, reason: "verified" }
  const [paid] = await db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.userId, p.u))
  if ((paid?.n ?? 0) > 0) return { ok: true, removed: false, reason: "has_subscription" }
  return (await deleteUnverifiedUser(db, p.u)) ? { ok: true, removed: true } : { ok: true, removed: false, reason: "verified" }
}
