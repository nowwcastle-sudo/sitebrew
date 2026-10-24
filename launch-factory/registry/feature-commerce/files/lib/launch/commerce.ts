// launch-factory: 상점 조립. 결제 중개(payments)·DB·메일·상품표(catalog)를 @launch-factory/commerce 의 주입 면 하나로 묶는다.
// 상점을 켜는가는 결제가 정한다 — live 에서 PortOne 값이 빠지면 commerceEnabled() 가 false 이고 사이트는 켜진 채 상점 액션만 provider_unavailable(retryable false)로 끝난다.
// 로그인한 사람이 필요한 것(포트)과 사람이 필요 없는 것(웹훅·Cron)이 같은 주입 면을 쓴다.
import { commercePort, defineCatalog, defineShipping, readCatalog, unavailablePort, type CommerceDeps } from "@launch-factory/commerce"
import type { CatalogItem, CommercePort } from "@launch-factory/contract"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { ORDERS_PATH, PRODUCTS, SHIPPING } from "@/lib/launch/catalog"
import { database } from "@/lib/launch/db"
import { mailer } from "@/lib/launch/mailer"
import { payments } from "@/lib/launch/payments"

/** 상점을 여는가. 네트워크·DB 에 닿지 않는다 — 쪽이 상점 대신 안내를 그리고 배포 확인이 경고를 낼 때 읽는다 */
export const commerceEnabled = (): boolean => payments().enabled

let cached: Promise<CommerceDeps> | undefined

/** 상점이 켜져 있을 때의 주입 면(DB·결제·메일·상품표). 꺼져 있으면 던진다 — 부르기 전에 commerceEnabled() 를 본다 */
export function commerceDeps(): Promise<CommerceDeps> {
  return (cached ??= build())
}

async function build(): Promise<CommerceDeps> {
  const config = payments()
  if (!config.enabled) throw new Error(config.reason)
  return {
    db: await database(),
    gateway: config.gateway,
    mailer: mailer(),
    catalog: defineCatalog(PRODUCTS),
    shipping: defineShipping(SHIPPING),
    productName: PRODUCT_NAME,
    ordersUrl: `${appUrl()}${ORDERS_PATH}`,
    locale: DEFAULT_LOCALE,
    // 판매를 막지는 않지만 운영자가 알아야 하는 일(메일 실패·환불 실패). 메시지에는 키·개인정보가 없다
    onError: (e) => console.error(`[commerce] ${e.message}`),
  }
}

/** 로그인한 사람의 판매 포트. 상점이 꺼져 있으면 모든 메서드가 provider_unavailable(retryable false)인 포트를 돌려준다 */
export async function commerceFor(userId: string): Promise<CommercePort> {
  return commerceEnabled() ? commercePort({ ...(await commerceDeps()), userId }) : unavailablePort(DEFAULT_LOCALE)
}

/**
 * 공개 상품 목록(/products)이 읽는 상품표 + 남은 재고. 로그인한 사람이 필요 없다 — 서버 액션이 아니라 서버 컴포넌트가 직접 부른다(브라우저가 부를 수 있는 입구를 더하지 않는다).
 * 상점이 꺼져 있으면 던진다(부르기 전에 commerceEnabled() 를 본다). DB 오류는 그대로 던진다 — 쪽이 오류 상태로 바꾼다.
 */
export async function publicCatalog(): Promise<CatalogItem[]> {
  return readCatalog(await commerceDeps())
}

/** 웹훅 서명 비밀. live 이고 켜져 있을 때만 있다(mock 은 웹훅이 없다) */
export function webhookSecret(): string | undefined {
  const config = payments()
  return config.enabled && config.mode === "live" ? config.webhookSecret : undefined
}
