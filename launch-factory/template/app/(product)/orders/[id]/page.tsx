import { notFound } from "next/navigation"
import { OrderDetailPanel } from "@/components/product/shop-blocks"
import { shopGate } from "@/components/product/shop-gate"
import { parseOrderId } from "@/lib/shop-params"

export const metadata = { title: "Order details" }

// 주문 하나(상태·배송·취소). 남의 주문 번호는 서버가 not_found 로 막고 블록이 「주문을 찾을 수 없어요」 빈 상태를 그린다. 모양이 틀린 번호는 404.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseOrderId((await params).id)
  if (!id) notFound()
  return (await shopGate(`/orders/${encodeURIComponent(id)}`)) ?? <OrderDetailPanel orderId={id} />
}
