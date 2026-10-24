// launch-factory: 예약 서비스 조립. 순서: 요청 제한(DB) → 멱등 키 → 입력 검사 → Turnstile → 수용량 잠금 안에서 저장 → 메일(+선택 통로) 안내.
// 설정(영업시간·서비스·마감·예약금)은 lib/launch/booking-config.ts 데이터가 정한다. 예약금은 lib/launch/booking-deposit.ts 가 넘기는 훅으로 받는다(기본 없음 — feature-booking-deposit 가 채운다).
// 운영자 메일(BOOKING_OWNER_EMAIL)이 없으면 예약 접수만 꺼진다 — bookingEnabled() 가 false 이고 서비스는 접수를 provider_unavailable 로 거절한다.
import { BOOKING_RATE_RULES, createBookingService, depositOf, depositRules, parseBookingConfig, type BookingConfig, type BookingService } from "@launch-factory/booking"
import { hitRateLimit } from "@launch-factory/db"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { BOOKING_CONFIG } from "@/lib/launch/booking-config"
import { bookingDeposit } from "@/lib/launch/booking-deposit"
import { bookingNotifier } from "@/lib/launch/booking-notify"
import { appUrl, DEFAULT_LOCALE, PRODUCT_NAME } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { env, optional, required } from "@/lib/launch/env"
import { mailer } from "@/lib/launch/mailer"

/** 검사를 거친 설정. 틀리면 모듈을 읽을 때 던진다(켜진 척하지 않는다) */
export const bookingConfig: BookingConfig = parseBookingConfig(BOOKING_CONFIG)

/** 예약 폼이 보여 주는 서비스 한 줄. 설정 전체가 아니라 화면이 쓰는 칸만 직렬화 가능한 모양으로 낸다. 예약금 있는 서비스는 금액·대기 시간·환불 규정도 싣는다(전부 설정 값 — 브라우저는 보여 주기만 한다) */
export interface BookingServiceView {
  id: string
  name: string
  durationMin: number
  partyMax: number
  deposit?: { amount: number; holdMinutes: number; fullRefundBeforeMinutes: number; laterRefundPercent: number }
}

export function bookingServiceViews(locale: "en" = "en"): BookingServiceView[] {
  const rules = depositRules(bookingConfig)
  return bookingConfig.services.map((s) => ({
    id: s.id,
    name: s.name[locale],
    durationMin: s.durationMin,
    partyMax: s.partyMax,
    ...(depositOf(s) > 0 ? { deposit: { amount: depositOf(s), holdMinutes: rules.holdMinutes, fullRefundBeforeMinutes: rules.fullRefundBeforeMinutes, laterRefundPercent: rules.laterRefundPercent } } : {}),
  }))
}

let cached: Promise<BookingService> | undefined

export function booking(): Promise<BookingService> {
  return (cached ??= build())
}

/**
 * 새 예약 알림을 받을 운영자 메일. **없으면 예약 접수만 꺼진다**(사이트는 켜진다 — 문의 창구와 같은 규칙). mock 은 없으면 가짜 주소로 켠다 — 메일은 콘솔에만 찍힌다.
 * 운영자 확인 권한(confirm)도 이 주소의 확인된 계정이 가진다.
 */
export function bookingOwnerEmail(): string | undefined {
  return optional("BOOKING_OWNER_EMAIL") ?? (env().LF_MODE === "live" ? undefined : "owner@example.test")
}

/** 예약을 받는가. 쪽(/book)이 폼 대신 안내를 그린다. 데이터베이스에 닿지 않는다 */
export const bookingEnabled = (): boolean => bookingOwnerEmail() !== undefined

async function build(): Promise<BookingService> {
  const db = await database()
  const live = env().LF_MODE === "live"
  const ownerAddress = bookingOwnerEmail()
  const deposit = await bookingDeposit()
  return createBookingService({
    db,
    mailer: mailer(),
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, rules: BOOKING_RATE_RULES, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
    turnstile: createTurnstile(live ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }),
    config: BOOKING_CONFIG,
    // 주소가 없으면 owner 를 빼 접수만 끈다: 이미 받은 예약의 조회·취소·알림·파기 Cron 은 그대로 된다
    ...(ownerAddress ? { owner: { email: ownerAddress, locale: DEFAULT_LOCALE } } : {}),
    productName: PRODUCT_NAME,
    manageUrl: `${appUrl()}/book/manage`,
    bookUrl: `${appUrl()}/book`,
    ...(bookingNotifier ? { notify: bookingNotifier } : {}),
    ...(deposit ? { deposit } : {}),
    onError: (e) => console.error("[booking]", e.message),
  })
}
