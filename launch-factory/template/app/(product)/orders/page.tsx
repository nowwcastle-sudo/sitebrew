import { OrdersPanel } from "@/components/product/shop-blocks"
import { shopGate } from "@/components/product/shop-gate"

export const metadata = { title: "Your orders" }

// 내 주문(주문 확인 메일의 버튼이 오는 곳 — lib/launch/catalog.ts 의 ORDERS_PATH). 로그인한 사람의 주문만 보인다.
export default async function OrdersPage() {
  return (await shopGate("/orders")) ?? <OrdersPanel />
}
