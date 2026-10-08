import { changePlan, plans, portal, resume, subscription, updatePaymentMethod } from "@/app/actions/product"
import { SignInRequired } from "@/components/product/sign-in-required"
import { BillingBlock, PaymentFailedBlock } from "@/components/product/product-blocks"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Billing" }

// 로그아웃·만료 상태면 블록 대신 로그인 안내(돌아올 곳 포함, B04)
// F02: 결제가 실패한 구독이면 결제 관리 위에 결제 실패 띠(다시 결제하는 날·접근이 멈추는 날·카드 변경 단추)
export default async function BillingPage() {
  if (!(await currentSession())) return <SignInRequired next="/account/billing" />
  return (
    <>
      <PaymentFailedBlock subscription={subscription} updatePaymentMethod={updatePaymentMethod} />
      <BillingBlock subscription={subscription} plans={plans} changePlan={changePlan} updatePaymentMethod={updatePaymentMethod} resume={resume} portal={portal} />
    </>
  )
}
