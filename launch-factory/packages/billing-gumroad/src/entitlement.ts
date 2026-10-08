// 요금제 권한 서버 검사 — billing-paddle 의 requireEntitlement 를 그대로 쓰고 provider 만 "gumroad" 로 둔다.
// 같은 구독 표·같은 past_due 유예(대장 D57, 기본 7일)·같은 401/403 규칙이다.
import { EntitlementError, protectAction as protectActionBase, requireEntitlement as requireBase, withEntitlement as withBase, type EntitlementOptions } from "@launch-factory/billing-paddle"
import { PROVIDER } from "./map.ts"

export type GumroadEntitlementOptions = Omit<EntitlementOptions, "provider">

export const requireEntitlement = (session: { userId: string } | null | undefined, feature: string, opts: GumroadEntitlementOptions) =>
  requireBase(session, feature, { ...opts, provider: PROVIDER })

export const withEntitlement = (...[feature, opts, handler]: Parameters<typeof withBase>) => withBase(feature, { ...opts, provider: PROVIDER }, handler)

export const protectAction = <A extends unknown[], R>(
  feature: string,
  opts: GumroadEntitlementOptions & { session: () => Promise<{ userId: string } | null> },
  action: (...args: A) => Promise<R>,
) => protectActionBase(feature, { ...opts, provider: PROVIDER }, action)
export { EntitlementError }
