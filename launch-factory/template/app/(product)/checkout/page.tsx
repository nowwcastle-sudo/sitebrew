import { CheckoutPanel } from "@/components/product/shop-blocks"
import { shopGate } from "@/components/product/shop-gate"

export const metadata = { title: "Checkout" }

// 주문하기(배송지 + 결제). 결제창을 여는 일은 클라이언트 잎(components/product/shop-blocks.tsx)이 맡는다 — 이 쪽은 로그인과 상점 켜짐만 본다.
export default async function CheckoutPage() {
  return (await shopGate("/checkout")) ?? <CheckoutPanel />
}
