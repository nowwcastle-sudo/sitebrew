// launch-factory: 제품마다 고치는 값. 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
import type { Locale } from "@launch-factory/email"
import { env, required } from "@/lib/launch/env"

export const PRODUCT_NAME = "My Product"
/** 사용자 칸(user.locale)이 비었을 때 메일·오류 문구의 언어 */
export const DEFAULT_LOCALE: Locale = "en"
/** 가입 때 동의 기록에 남길 약관·개인정보 처리방침의 판. 문서를 고치면 올린다 */
export const CONSENT_VERSIONS = { terms: "2026-09-30", privacy: "2026-09-30" }
/** 결제 메일이 가리키는 화면 경로 */
export const ROUTES = { billing: "/account/billing", acceptPriceChange: "/account/billing/price-change", decline: "/account/billing/cancel", security: "/forgot-password", contact: "/contact" }

/** 앱 주소. mock 에서는 로컬 주소로 켜지고, live 에서는 NEXT_PUBLIC_APP_URL 이 필수다 */
export function appUrl(): string {
  // 빈 문자열은 없는 것으로 본다 — shadcn CLI 가 envVars 이름을 `NAME=`(빈 값)으로 .env.local 에 적는다
  return process.env.NEXT_PUBLIC_APP_URL || (env().LF_MODE === "mock" ? "http://localhost:3000" : required("NEXT_PUBLIC_APP_URL"))
}
