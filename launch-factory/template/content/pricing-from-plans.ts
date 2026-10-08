// /pricing 의 요금제 카드를 live 요금제(결제가 쓰는 같은 목록)에서 만든다(LFFIX F7) — 정적 문구와 결제 화면의 금액이 갈라지지 않게 한다.
// 월 요금제만 카드로 만든다(카드는 「/mo」 형식). 월 요금제가 없거나 요금제를 못 읽으면 문구 파일의 기본 카드를 그대로 쓴다.
// 이름·금액·세금 표기·기능 문구는 요금제(Plan) 것이고, 카드의 행동 버튼·꼬리말 같은 나머지는 문구 파일(content/copy.en.ts) 것이다.
import type { PricingThreeTierCardsCopy } from "@/components/blocks/pricing/three-tier-cards"
import type { Plan } from "@/components/contract/ports"
import { onlyOffered } from "../lib/plan-param.ts"

/** 최소 단위 정수 → 화면 단위(USD·EUR 는 센트를 100 으로, KRW·JPY 는 그대로 — 통화별 소수 자릿수는 Intl 이 안다) */
const toMajor = (amount: number, currency: string) => {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 0
  return digits ? amount / 10 ** digits : amount
}

export function pricingFromPlans(base: PricingThreeTierCardsCopy, plans: readonly Plan[] | null | undefined): PricingThreeTierCardsCopy {
  const monthly = onlyOffered(plans ?? []) // E03: 내는 주기는 lib/plan-param.ts 의 OFFERED_INTERVALS 한 곳 — 카드는 「/mo」 형식이라 월이어야 한다
  if (monthly.length === 0) return base
  const recommended = monthly.find((p) => p.recommended)?.name
  return {
    ...base,
    plans: monthly.map((p) => ({ name: p.name, monthlyPrice: toMajor(p.price.amount, p.price.currency), currency: p.price.currency, vatIncluded: p.price.vatIncluded, features: [...p.features] })),
    recommended,
    planCtas: monthly.map((p) => ({ label: `Get ${p.name}`, href: "/sign-up" })),
    // E01: 요금제 id(plans 와 같은 순서) — 로그아웃은 가입 주소에 ?plan=<id>, 로그인은 /upgrade?plan=<id>, 지금 쓰는 요금제는 표지
    planIds: monthly.map((p) => p.id),
  }
}
