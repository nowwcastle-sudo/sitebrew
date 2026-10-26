// launch-factory: 국내 결제 중개 조립. 어느 구현을 쓸지는 @launch-factory/payments-kr 의 resolvePayments 한 곳이 정한다.
//   mock  → 모의 게이트웨이(키가 있어도 실결제로 새지 않는다). 메모리만 써서 서버가 다시 뜨면 결제 대기가 사라진다 — 미리보기 용이다.
//   live  → PortOne 값 넷(NEXT_PUBLIC_PORTONE_STORE_ID · NEXT_PUBLIC_PORTONE_CHANNEL_KEY · PORTONE_API_SECRET · PORTONE_WEBHOOK_SECRET)이 다 있어야 켠다.
//           하나라도 없으면 던지지 않고 **상점만 꺼진다**(문의 창구와 같은 규칙) — 사이트는 켜지고 payments().enabled 가 false 다.
// 값은 어디에도 찍지 않는다. 꺼진 까닭에는 이름만 있다.
import { resolvePayments, type PaymentsConfig } from "@launch-factory/payments-kr"
import { env } from "@/lib/launch/env"

let cached: PaymentsConfig | undefined

export function payments(): PaymentsConfig {
  // env() 가 LF_MODE 를 먼저 검사한다(없으면 조용히 mock 으로 가지 않고 멈춘다)
  return (cached ??= resolvePayments({ ...process.env, LF_MODE: env().LF_MODE }))
}

/** 결제를 받는가. 쪽이 상점 대신 안내를 그리고, 배포 확인이 경고를 낼 때 읽는다. 네트워크·DB 에 닿지 않는다 */
export const paymentsEnabled = (): boolean => payments().enabled
