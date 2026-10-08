// launch-factory: Gumroad 요금제 설정. 이 파일은 제품 것이다 — 멤버십 상품 id 와 상품 링크를 적는다.
// Gumroad 체험은 상품 설정이다(7일 또는 1개월(30)). 체험이 있는 요금제는 체험을 켠 상품이 따로 있어야 한다(trialProductId·trialUrl).
// 비어 있으면 결제를 시작할 수 없다. 조용히 아무 요금제나 만들지 않는다.
import type { GumroadPlan } from "@launch-factory/billing-gumroad"

export const GUMROAD_PLANS: GumroadPlan[] = []
