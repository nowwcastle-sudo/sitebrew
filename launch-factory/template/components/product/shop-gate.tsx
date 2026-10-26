import type * as React from "react"
import { StateScreenNotFound } from "@/components/blocks/state-screen/not-found"
import { SignInRequired } from "@/components/product/sign-in-required"
import { shopUnavailableCopy } from "@/content/copy.shop.en"
import { commerceEnabled } from "@/lib/launch/commerce"
import { currentSession } from "@/lib/session-server"

/** 상점이 꺼져 있을 때(live 에서 PortOne 값이 빠짐)의 쪽. 사이트는 켜져 있고 상점만 닫혀 있다 — 서버 액션도 같은 이유(provider_unavailable)로 끝난다 */
export function ShopUnavailable() {
  return <StateScreenNotFound id="shop-unavailable" errorCode="provider_unavailable" headingLevel={1} copy={{ title: shopUnavailableCopy.title, body: shopUnavailableCopy.body, home: shopUnavailableCopy.home, support: shopUnavailableCopy.support }} />
}

/**
 * 상점 쪽 공통 관문(서버): 로그아웃·만료면 로그인 안내(돌아올 곳 `next` 포함 — 다른 보호된 쪽과 같다), 상점이 꺼져 있으면 닫힘 안내.
 * 둘 다 아니면 null — 쪽이 본 화면을 그린다. 상점 쪽은 모두 로그인한 사람의 것이다(lib/public-paths.json 에 없다).
 */
export async function shopGate(next: string): Promise<React.ReactElement | null> {
  if (!(await currentSession())) return <SignInRequired next={next} />
  if (!commerceEnabled()) return <ShopUnavailable />
  return null
}
