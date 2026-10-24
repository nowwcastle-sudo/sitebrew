// launch-factory: 예약이 세션에서 읽는 것 두 가지. 서버 전용이다(공개 서버 액션으로 열지 않는다).
//   currentUserId — 로그인했으면 그 사용자 id(예약 행·요청 제한 키에 들어간다). 로그아웃·만료·대리 로그인 세션은 null(대리 세션이 그 사람 이름으로 예약하지 못한다).
//   bookingActor  — 확정·대신 취소를 하는 사람(세션은 액션이 먼저 읽어 넘긴다). 소유자 = 확인된 이메일이 BOOKING_OWNER_EMAIL 과 같은 사람, 관리자 = user.role 에 admin. 정지된 사람은 아니다.
import { user } from "@launch-factory/db"
import { eq } from "drizzle-orm"
import type { BookingActor } from "@launch-factory/booking"
import { authPort } from "@/lib/launch/auth"
import { bookingOwnerEmail } from "@/lib/launch/booking"
import { database } from "@/lib/launch/db"

export async function currentUserId(): Promise<string | null> {
  try {
    const s = await (await authPort()).session()
    return s.ok && s.data && !s.data.impersonatedBy ? s.data.userId : null
  } catch {
    return null
  }
}

/** 세션(액션이 `authPort().session()` 으로 읽은 것)의 행위자. 정지된 사람 → null, 대리 세션 → "impersonated" */
export async function bookingActor(session: { userId: string; impersonatedBy?: string | null }): Promise<BookingActor | "impersonated" | null> {
  if (session.impersonatedBy) return "impersonated"
  const [row] = await (await database()).select({ id: user.id, role: user.role, email: user.email, emailVerified: user.emailVerified, banned: user.banned }).from(user).where(eq(user.id, session.userId)).limit(1)
  if (!row || row.banned) return null
  const owner = bookingOwnerEmail()
  return { userId: row.id, role: row.role, isOwner: Boolean(owner && row.emailVerified && row.email.toLowerCase() === owner.toLowerCase()) }
}
