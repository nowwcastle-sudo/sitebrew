import { catalog } from "@/app/actions/commerce"
import { CartPanel } from "@/components/product/shop-blocks"
import { shopGate } from "@/components/product/shop-gate"
import { parseAddParam } from "@/lib/shop-params"

export const metadata = { title: "Cart" }

// 장바구니. 로그인한 사람의 것이라 로그아웃이면 로그인 안내(담으려던 상품은 돌아올 주소에 남는다)다.
// `?add=<상품 id>` 는 주소만으로 아무것도 담지 않는다(GET 부작용 없음) — 담기 확인 줄이 뜨고 [담기]를 눌러야 서버 액션이 담는다.
export default async function CartPage({ searchParams }: { searchParams: Promise<{ add?: string | string[] }> }) {
  const add = parseAddParam((await searchParams).add)
  const blocked = await shopGate(add ? `/cart?add=${encodeURIComponent(add)}` : "/cart")
  if (blocked) return blocked
  if (!add) return <CartPanel />
  const items = await catalog()
  const item = items.ok ? items.data.find((i) => i.id === add) : undefined
  return item ? <CartPanel add={{ productId: item.id, name: item.name, price: item.price }} /> : <CartPanel addNotFound />
}
