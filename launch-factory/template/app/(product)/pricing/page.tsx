import { plans, subscription } from "@/app/actions/product"
import { PricingBlock } from "@/components/product/product-blocks"
import { IN_USE_STATUSES } from "@/lib/plan-param"
import { currentSession } from "@/lib/session-server"
import { euSalesOpen } from "@/lib/launch/eu-sales"

export const metadata = { title: "Pricing" }

// 요금제 카드는 결제가 쓰는 같은 요금제 목록에서 만든다(정적 문구와 결제 화면의 금액이 갈라지지 않게). 못 읽으면 문구 파일의 기본 카드
// E01: 단추는 로그인 상태를 따른다 — 로그인한 사람은 가입이 아니라 결제(/upgrade?plan=<id>)로 가고, 지금 쓰는 요금제 카드는 표지다. 세션·구독은 서버가 읽어 값으로 넘긴다
export default async function PricingPage() {
  const [r, s] = await Promise.all([plans().catch(() => null), currentSession()])
  const sub = s ? await subscription().catch(() => null) : null
  const current = sub?.ok && sub.data && (IN_USE_STATUSES as readonly string[]).includes(sub.data.status) ? sub.data.planId : null
  // F10: EU 판매가 닫힌 동안(LF_EU_SALES=off) 요금표 아래 안내 한 줄
  return <PricingBlock plans={r?.ok ? r.data : null} signedIn={!!s} currentPlanId={current} euClosed={!euSalesOpen(process.env.LF_EU_SALES)} />
}
