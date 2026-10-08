import { applyRetentionOffer, cancel, plans, resume, subscription } from "@/app/actions/product"
import { SignInRequired } from "@/components/product/sign-in-required"
import { CancelBlock } from "@/components/product/product-blocks"
import { retentionOffers } from "@/lib/offers"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Cancel subscription" }

// 해지 실행 화면: 해지 방식 → (대안이 있을 때만) 대안 → 완료. 대안이 없으면 확인 장 없이 두 단계(F12). 결제 관리의 「Cancel subscription」이 여기로 온다
// 이미 해지가 예약돼 있으면 흐름 대신 상태와 「Keep my plan」(F05 — resume)
// 로그아웃·만료 상태면 블록 대신 로그인 안내(돌아올 곳 포함, B04)
export default async function CancelPage() {
  if (!(await currentSession())) return <SignInRequired next="/account/cancel" />
  return <CancelBlock subscription={subscription} plans={plans} resume={resume} cancel={cancel} applyRetentionOffer={applyRetentionOffer} offers={await retentionOffers()} />
}
