import { CheckoutReturnConfirm } from "@/components/product/checkout-return"
import { CheckoutReturnNotice } from "@/components/product/checkout-return-notice"
import { shopGate } from "@/components/product/shop-gate"
import { parseCheckoutReturn } from "@/lib/shop-params"

export const metadata = { title: "Confirming your payment" }

// 결제창을 마치고 돌아오는 쪽(모바일 리디렉션): ?orderId=…&paymentId=…(성공) 또는 &code=…(실패·취소). 성공이면 서버가 결제 공급자에 다시 물어 주문을 확정한다(confirmPayment).
// 로그아웃·만료면 로그인 안내 — 돌아올 주소에 주문·결제 번호가 그대로 남아, 로그인하면 이어서 확정한다.
export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const ret = parseCheckoutReturn(params)
  const query = new URLSearchParams()
  for (const key of ["orderId", "paymentId", "code"] as const) {
    const v = params[key]
    if (typeof v === "string") query.set(key, v)
  }
  const blocked = await shopGate(`/checkout/return${query.size ? `?${query}` : ""}`)
  if (blocked) return blocked
  if (ret.kind === "confirm") return <CheckoutReturnConfirm orderId={ret.orderId} paymentId={ret.paymentId} />
  if (ret.kind === "failed") return <CheckoutReturnNotice kind="failed" orderId={ret.orderId} code={ret.code} />
  return <CheckoutReturnNotice kind="missing" />
}
