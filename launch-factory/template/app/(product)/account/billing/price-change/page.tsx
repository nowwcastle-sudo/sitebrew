import { PriceChangeScreen } from "@/components/product/price-change-screen"
import { ROUTES } from "@/lib/launch/config"

export const metadata = { title: "Review your new price" }

// 가격 변경 메일의 [Accept the new price] 링크(ROUTES.acceptPriceChange)가 닿는 쪽(F04)
export default function PriceChangePage() {
  return <PriceChangeScreen mode="accept" path={ROUTES.acceptPriceChange} />
}
