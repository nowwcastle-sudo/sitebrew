import { portal, syncCheckout } from "@/app/actions/product"
import { BillingReturn } from "@/components/product/billing-return"
import { SignInRequired } from "@/components/product/sign-in-required"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Confirming your payment" }

// 결제 창을 마치고 돌아오는 쪽: ?_ptxn=<거래 id>. 서버가 그 거래를 읽어 구독을 바로 맞춘다(웹훅이 늦어도 「구독 없음」으로 안 보이게)
// 로그아웃·만료 상태면 「결제 확인 실패」로 숨기지 않고 로그인 안내를 보인다 — 로그인 뒤 거래 id 를 들고 이 자리로 돌아온다(B04)
export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<{ _ptxn?: string | string[] }> }) {
  const { _ptxn } = await searchParams
  const transactionId = typeof _ptxn === "string" ? _ptxn : undefined
  if (!(await currentSession())) return <SignInRequired kind="payment" next={transactionId ? `/billing/return?_ptxn=${encodeURIComponent(transactionId)}` : "/billing/return"} />
  return <BillingReturn transactionId={transactionId} sync={syncCheckout} portal={portal} />
}
