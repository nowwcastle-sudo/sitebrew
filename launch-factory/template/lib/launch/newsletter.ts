// launch-factory: 뉴스레터 구독 명단 조립. 순서: 요청 제한(DB) → 멱등 키 → 입력 검사 → Turnstile → 저장 → 확인 메일(이중 동의).
// 구독은 확인 링크를 눌러야 완료되고, 그때 구독 완료 안내(전송자·동의한 날·결과 — 정보통신망법 제50조제7항)가 한 통 간다. 수신거부는 로그인 없이 링크 하나(만료 없음).
// 이 항목은 명단만 관리한다 — 보내기(캠페인)는 하지 않는다. 보낼 때는 service.listSubscribed 로 구독자와 그의 서명 수신거부 링크를 읽어 간다.
// 확인하지 않은 신청 14일·수신거부 기록 1년이 지나면 Cron(/api/cron/newsletter)이 지운다.
import { hitRateLimit } from "@launch-factory/db"
import { createNewsletterService, type NewsletterService } from "@launch-factory/newsletter"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { appUrl, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { env, required } from "@/lib/launch/env"
import { linkSecret } from "@/lib/launch/link-secret"
import { mailer } from "@/lib/launch/mailer"

let cached: Promise<NewsletterService> | undefined

export function newsletter(): Promise<NewsletterService> {
  return (cached ??= build())
}

async function build(): Promise<NewsletterService> {
  const db = await database()
  const live = env().LF_MODE === "live"
  return createNewsletterService({
    db,
    mailer: mailer(),
    // 믿을 IP 머리는 환경이 정한다(대장 D205). 문의·인증 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
    turnstile: createTurnstile(live ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }),
    secret: linkSecret(),
    baseUrl: appUrl(),
    productName: PRODUCT_NAME,
  })
}
