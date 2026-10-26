// launch-factory: 상점이 세션을 읽는 한 곳 — 제품 템플릿판(기본판은 registry/feature-commerce/files/lib/launch/commerce-session.ts, 제품 것이라 첫 설치 때만 놓인다).
// live: Better Auth 세션이다. mock(키 없이 켠 화면): 화면의 로그인은 목 인증 포트의 메모리 세션이라 Better Auth 가 알아보지 못한다(app/actions/account-mock.ts 와 같은 이유).
// 그래서 mock 에서는 같은 목 세션을 읽고, 주문·장바구니 표가 user 표를 가리키므로(외래 키) 그 사람의 user 행을 한 번 만든다. live 에서는 이 길을 타지 않는다.
import { user } from "@launch-factory/db"
import { authPort } from "@/lib/launch/auth"
import { database } from "@/lib/launch/db"
import { env } from "@/lib/launch/env"
import { ports } from "@/lib/ports"

export interface ShopSession {
  userId: string
  /** 관리자가 대신 들어온 세션이면 그 관리자 id — 읽기만 된다 */
  impersonatedBy?: string | null
}

/** user 행을 이미 확인한 목 사용자(프로세스 하나 동안) */
const ensured = new Set<string>()

async function mockShopSession(): Promise<ShopSession | null> {
  const s = await (await ports()).auth.session()
  if (!s.ok || !s.data) return null
  const { userId, email, name } = s.data
  if (!ensured.has(userId)) {
    await (await database()).insert(user).values({ id: userId, name: name ?? "Mock user", email: email ?? `${userId}@example.invalid`, emailVerified: true }).onConflictDoNothing()
    ensured.add(userId)
  }
  return { userId }
}

/** 지금 로그인한 사람. 로그아웃·만료·읽기 실패는 null */
export async function shopSession(): Promise<ShopSession | null> {
  if (env().LF_MODE === "mock") return mockShopSession()
  const s = await (await authPort()).session()
  return s.ok && s.data ? { userId: s.data.userId, impersonatedBy: s.data.impersonatedBy } : null
}
