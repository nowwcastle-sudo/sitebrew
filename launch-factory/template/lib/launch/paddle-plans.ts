// launch-factory: 요금제 설정. 이 파일은 제품 것이다 — 요금제와 Paddle 가격 id 를 여기에 적는다(운영자 할 일 O3: 샌드박스 가격 만들기).
// 체험이 있는 요금제는 가격이 둘이다: paddle.priceId(체험 없음) + paddle.trialPriceId(trial_period 있음). 체험은 30일 이하만 받는다.
// entitlements 는 서버가 검사하는 기능 키다(requireEntitlement) — 화면용 features 문구와 따로 둔다.
// 비어 있으면 결제를 시작할 수 없다(unknown_plan). 조용히 아무 요금제나 만들지 않는다.
import type { PaddlePlan } from "@launch-factory/billing-paddle"
import type { RetentionOffer } from "@launch-factory/contract"

export const PLANS: PaddlePlan[] = []

// 해지 대안(R2: 일시정지 → 다운그레이드 → 할인 순으로 쓸 수 있는 첫 하나만 해지 화면에 보인다). 할인은 30% 이하·2~3개월(lib/retention-offer 가 검사).
// 다운그레이드는 옮겨 갈 요금제 id(PLANS 안)가 있어야 한다 — 요금제를 채운 뒤 제품이 더한다.
export const RETENTION_OFFERS: RetentionOffer[] = [
  { id: "pause-1m", kind: "pause", pauseMonths: 1 },
  { id: "discount-30-3m", kind: "discount", discount: { percent: 30, months: 3 } },
]
