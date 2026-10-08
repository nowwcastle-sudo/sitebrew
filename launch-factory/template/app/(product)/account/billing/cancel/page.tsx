import { PriceChangeScreen } from "@/components/product/price-change-screen"
import { ROUTES } from "@/lib/launch/config"

export const metadata = { title: "Decline the new price" }

// 가격 변경 메일의 [Cancel my subscription] 링크(ROUTES.decline)가 닿는 쪽(F04). 같은 블록을 보이고, 해지는 사람이 누를 때만 실행된다.
// (대안 제안이 있는 일반 해지 흐름은 /account/cancel 이다 — 이 쪽은 가격 변경을 거절하는 길이다)
export default function DeclinePriceChangePage() {
  return <PriceChangeScreen mode="decline" path={ROUTES.decline} />
}
