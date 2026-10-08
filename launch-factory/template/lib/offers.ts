// 해지 화면이 보일 대안 목록(LFFIX F5). 화면과 서버(공급자 어댑터)가 같은 목록을 써야 한다 — 화면이 보인 대안의 id 를 서버가 몰라 거절하는 일이 없게.
//   mock → lib/mock-plans.ts 의 MOCK_RETENTION_OFFERS(mock 어댑터가 같은 목록을 쓴다)
//   live → lib/launch/paddle-plans.ts 의 RETENTION_OFFERS(lib/launch/billing.ts 가 어댑터에 같은 목록을 준다)
// 서버 전용(서버 페이지가 부르고, 순수 데이터만 클라이언트 블록에 넘긴다).
import type { RetentionOffer } from "@/components/contract/ports"
import { env } from "@/lib/launch/env"
import { MOCK_RETENTION_OFFERS } from "@/lib/mock-plans"

export async function retentionOffers(): Promise<RetentionOffer[]> {
  if (env().LF_MODE === "mock") return [...MOCK_RETENTION_OFFERS]
  return [...(await import("@/lib/launch/paddle-plans")).RETENTION_OFFERS]
}
