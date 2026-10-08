// launch-factory: 탈퇴·파기가 구독을 해지할 때 쓰는 결제 포트를 고르는 자리. 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
// 기본은 Paddle 이다. 다른 결제(Gumroad 등)를 쓰면 이 파일만 그 포트로 바꾼다: 사용자 id 하나로 그 사용자의 BillingPort 를 돌려주면 된다.
// 결제가 없는 제품은 구독이 없다고 답하는 포트를 돌려준다(빠뜨려서 조용히 건너뛰지 않도록 일부러 여기서 고른다).
import type { BillingPort } from "@launch-factory/contract"
import { billing } from "@/lib/launch/billing"

export async function billingPorts(): Promise<(userId: string) => BillingPort> {
  const paddle = await billing()
  return (userId) => paddle.port({ userId })
}
