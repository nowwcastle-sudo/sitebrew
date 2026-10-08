// launch-factory: 문의 접수 조립. 순서: 요청 제한(DB) → 멱등 키 → 입력 검사 → Turnstile → 저장 → 운영자 알림 → (선택) 접수 확인.
// 개인정보는 최소만 저장한다(이름 선택·연락처·내용). 보유 기간은 일반 30일, 불만·분쟁 3년(Cron 이 지난 것을 지운다).
// 접수 확인 메일과 첫 응답 약속은 lib/launch/support.ts(제품 설정)가 정한다.
// 운영자 메일(INQUIRY_OWNER_EMAIL)이 없으면 문의 창구만 꺼진다 — inquiryEnabled() 가 false 이고 서비스는 접수를 provider_unavailable 로 거절한다.
import { hitRateLimit } from "@launch-factory/db"
import { createInquiryService, type InquiryService } from "@launch-factory/inquiry"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { env, optional, required } from "@/lib/launch/env"
import { mailer } from "@/lib/launch/mailer"
import { SUPPORT } from "@/lib/launch/support"

let cached: Promise<InquiryService> | undefined

export function inquiry(): Promise<InquiryService> {
  return (cached ??= build())
}

/**
 * 문의 알림을 받을 운영자 메일. **없으면 문의 창구만 꺼진다**(사이트는 켜진다 — 운영자 결정 2026-10-05, 미리보기 전 쪽 500 사고).
 * 있으면 켜지 않는 척 속이지 않고 형식을 본다(live-env.ts 가 켜질 때 z.email() 로 확인). mock 은 없으면 가짜 주소로 켠다 —
 * 메일은 콘솔에만 찍히므로 어디로도 나가지 않는다. LF_BUSINESS_EMAIL 로 대신하지 않는다: 그것은 바닥글에 공개하는 표시 주소이지 개인정보가 오는 창구가 아니다.
 */
export function inquiryOwnerEmail(): string | undefined {
  const set = optional("INQUIRY_OWNER_EMAIL")
  return set ?? (env().LF_MODE === "live" ? undefined : "owner@example.test")
}

/** 문의를 받는가. 쪽(/contact)이 폼 대신 안내를 그리고, 배포 확인이 경고를 낼 때 읽는다. 데이터베이스에 닿지 않는다 */
export const inquiryEnabled = (): boolean => inquiryOwnerEmail() !== undefined

async function build(): Promise<InquiryService> {
  const db = await database()
  const live = env().LF_MODE === "live"
  const ownerAddress = inquiryOwnerEmail()
  return createInquiryService({
    db,
    mailer: mailer(),
    // 믿을 IP 머리는 환경이 정한다(대장 D205). 인증 항목·보안 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
    turnstile: createTurnstile(live ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }),
    // 주소가 없으면 owner 를 빼 접수만 끈다: 접수는 provider_unavailable 로 거절하고, 파기 Cron·종류 변경은 그대로 된다
    ...(ownerAddress ? { owner: { email: ownerAddress, locale: DEFAULT_LOCALE } } : {}),
    productName: PRODUCT_NAME,
    receipt: SUPPORT.receipt,
    ...(SUPPORT.responseTime ? { responseTime: SUPPORT.responseTime } : {}),
  })
}
