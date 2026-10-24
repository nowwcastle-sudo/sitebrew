// launch-factory: 상점이 세션을 읽는 한 곳(제품 것 — 첫 설치 때만 놓이고 이후는 제품이 고친다). 기본은 Better Auth 세션이다.
// 상점 서버 액션(app/actions/commerce.ts)은 이 함수 하나로 「누구의 장바구니·주문인가」를 정한다 — userId 는 여기서만 나오고 입력으로는 받지 않는다.
// 로그인 방식을 따로 쓰는 제품(예: 키 없이 켜는 목 인증)은 이 파일만 바꿔 같은 모양 { userId, impersonatedBy } 를 돌려주면 된다.
import { authPort } from "@/lib/launch/auth"

export interface ShopSession {
  userId: string
  /** 관리자가 대신 들어온 세션이면 그 관리자 id — 읽기만 된다 */
  impersonatedBy?: string | null
}

/** 지금 로그인한 사람. 로그아웃·만료·읽기 실패는 null */
export async function shopSession(): Promise<ShopSession | null> {
  const s = await (await authPort()).session()
  return s.ok && s.data ? { userId: s.data.userId, impersonatedBy: s.data.impersonatedBy } : null
}
