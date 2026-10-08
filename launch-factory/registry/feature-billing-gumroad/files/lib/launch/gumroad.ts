// launch-factory: Gumroad 대비 결제 조립(Paddle 승인 전). 결제는 호스팅 상품 링크이고, 구독을 바꾸는 API 는 Gumroad 에 없다 —
// 해지·재시작·등급 변경·결제수단 변경은 손님이 Gumroad 「Manage membership」에서 한다(해당 포트 메서드는 provider_unsupported 로 끝난다).
import { gumroadBilling, type GumroadBilling } from "@launch-factory/billing-gumroad"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME, ROUTES } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { required } from "@/lib/launch/env"
import { GUMROAD_PLANS } from "@/lib/launch/gumroad-plans"
import { mailer } from "@/lib/launch/mailer"

let cached: Promise<GumroadBilling> | undefined

export function gumroad(): Promise<GumroadBilling> {
  return (cached ??= build())
}

async function build(): Promise<GumroadBilling> {
  return gumroadBilling({
    db: await database(),
    plans: GUMROAD_PLANS,
    accessToken: required("GUMROAD_ACCESS_TOKEN"),
    pingSecret: required("GUMROAD_PING_SECRET"),
    mail: {
      mailer: mailer(),
      locale: DEFAULT_LOCALE,
      productName: PRODUCT_NAME,
      urls: { manage: `${appUrl()}${ROUTES.billing}`, acceptPriceChange: `${appUrl()}${ROUTES.acceptPriceChange}`, decline: `${appUrl()}${ROUTES.decline}` },
    },
  })
}
