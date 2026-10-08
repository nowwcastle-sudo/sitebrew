// 계측 포트 자리(P3-3 Task 9) — 아무것도 보내지 않는다(동의 안 함). 실제 어댑터(PostHog 등)는 launch-factory 에 붙일 때 이 파일 하나만 바꾼다.
// 블록에 넘기는 track 은 이 포트를 withAttribution 으로 감싼 것이다(J2) — 잎 코드(components/site/*)가 한 번 감싼다.
import type { AnalyticsPort } from "@/components/contract/ports"

export const analytics: AnalyticsPort = {
  track() {},
  consent: () => ({ analytics: false, marketing: false }),
  setConsent() {},
}
