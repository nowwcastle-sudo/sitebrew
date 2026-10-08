// mock 모드의 요금제(v0 Task 10). web-factory 목의 기본 요금제는 한국어·원화라 영어 제품 화면(content/copy.en.ts)과 어긋난다 — 같은 이름·금액(USD)으로 맞춘다.
// live 에서는 이 파일을 쓰지 않는다(요금제 정본은 lib/launch/paddle-plans.ts). 금액은 최소 단위 정수(센트)다.
import type { Plan, RetentionOffer } from "@/components/contract/ports"

const usd = (amount: number) => ({ amount, currency: "USD" as const, vatIncluded: false })

export const MOCK_PLANS: readonly Plan[] = [
  { id: "starter", name: "Starter", price: usd(900), interval: "month", features: ["3 projects", "Basic reports"], limits: { projects: 3 } },
  { id: "pro", name: "Pro", price: usd(2900), interval: "month", trialDays: 14, recommended: true, features: ["20 projects", "Advanced reports", "Priority support"], limits: { projects: 20 } },
  { id: "team", name: "Team", price: usd(7900), interval: "month", features: ["Unlimited projects", "10 members", "Admin controls"], limits: { projects: 1000 } },
]

/** 해지 대안(일시정지 → 다운그레이드 → 할인 순서, 할인은 30%·3개월 — lib/retention-offer 한도 안) */
export const MOCK_RETENTION_OFFERS: readonly RetentionOffer[] = [
  { id: "pause-1m", kind: "pause", pauseMonths: 1 },
  { id: "downgrade-starter", kind: "downgrade", planId: "starter" },
  { id: "discount-30-3m", kind: "discount", discount: { percent: 30, months: 3 } },
]
