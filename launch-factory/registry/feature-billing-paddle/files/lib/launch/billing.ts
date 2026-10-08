// launch-factory: Paddle 결제 조립. 기본은 샌드박스다. 실결제(production)는 LF_PADDLE_LIVE=1 이 있을 때만 받는다 — 이 값은 운영자만 넣는다.
import { paddleBilling, paymentFailedEmailsEnabled, type PaddleBilling } from "@launch-factory/billing-paddle"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME, ROUTES } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { optional, required } from "@/lib/launch/env"
import { mailer } from "@/lib/launch/mailer"
import { PLANS, RETENTION_OFFERS } from "@/lib/launch/paddle-plans"

let cached: Promise<PaddleBilling> | undefined

export function billing(): Promise<PaddleBilling> {
  return (cached ??= build())
}

async function build(): Promise<PaddleBilling> {
  return paddleBilling({
    db: await database(),
    plans: PLANS,
    // 해지 흐름의 대안(해지 화면이 보이는 것과 같은 목록 — 할인은 30% 이하·2~3개월, 만들 때 검사한다)
    retentionOffers: RETENTION_OFFERS,
    apiKey: required("PADDLE_API_KEY"),
    webhookSecret: required("PADDLE_WEBHOOK_SECRET"),
    env: process.env.LF_PADDLE_LIVE === "1" ? "production" : "sandbox",
    // 영수증·해지 메일은 Paddle(판매자 대행)이 보낸다. 우리는 가격 변경 동의 요청만 보낸다(법이 요구하는 동의·거절 링크).
    // 결제 실패 안내(F11)는 우리가 보낸다 — 구독이 past_due 가 될 때 한 통(재시도 날짜 알면·이용 가능한 마지막 날·카드 변경 링크).
    // live 에서 Paddle Retain(Payment recovery 메일)을 켰다면 같은 안내가 두 통이 되므로 LF_PAYMENT_FAILED_EMAIL=off 로 끈다(기본 켜짐).
    mail: {
      mailer: mailer(),
      sendPaymentFailedEmails: paymentFailedEmailsEnabled(optional("LF_PAYMENT_FAILED_EMAIL")),
      locale: DEFAULT_LOCALE,
      productName: PRODUCT_NAME,
      urls: { manage: `${appUrl()}${ROUTES.billing}`, updatePaymentMethod: `${appUrl()}${ROUTES.billing}`, acceptPriceChange: `${appUrl()}${ROUTES.acceptPriceChange}`, decline: `${appUrl()}${ROUTES.decline}` },
    },
  })
}
