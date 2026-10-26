import { ProductsPanel } from "@/components/product/shop-blocks"
import { ShopUnavailable } from "@/components/product/shop-gate"
import { productsLoadError } from "@/content/copy.shop.en"
import { commerceEnabled, publicCatalog } from "@/lib/launch/commerce"
import { toProductCards } from "@/lib/shop-products"

export const metadata = { title: "Products" }
// 남은 재고를 DB 에서 읽는다 — 빌드 때 미리 그리지 않는다
export const dynamic = "force-dynamic"

// 상품 목록. 공개 쪽이다(lib/public-paths.json) — 상품표는 누구에게나 보이고, 장바구니·주문만 로그인한 사람의 것이다. 카드를 누르면 /cart?add=<상품 id> 로 가고
// 그 쪽이 로그인(안 했으면 로그인 안내)과 담기 확인을 맡는다. 상점이 꺼져 있으면(live 에서 PortOne 값이 빠짐) 사이트는 켜진 채 닫힘 안내만 보인다.
export default async function ProductsPage() {
  if (!commerceEnabled()) return <ShopUnavailable />
  try {
    const cards = toProductCards(await publicCatalog())
    return <ProductsPanel state={cards.length ? { status: "ready", data: cards } : { status: "empty" }} />
  } catch (e) {
    // 메시지에 DB 글이 섞일 수 있어 이름만 남기고 화면에는 고정 문구
    console.error(`[products] catalog read failed: ${e instanceof Error ? e.name : "unknown"}`)
    return <ProductsPanel state={{ status: "error", message: productsLoadError, code: "provider_unavailable", retryable: true }} />
  }
}
