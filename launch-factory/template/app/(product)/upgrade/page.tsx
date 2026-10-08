import { checkout, plans, subscription, updatePaymentMethod } from "@/app/actions/product"
import { CheckoutEmailNote } from "@/components/product/checkout-email-note"
import { SignInRequired } from "@/components/product/sign-in-required"
import { PaymentFailedBlock, UpgradeBlock } from "@/components/product/product-blocks"
import { IN_USE_STATUSES, planParam } from "@/lib/plan-param"
import { currentSession } from "@/lib/session-server"
import { checkoutClientToken } from "@/lib/site-keys"
import { EuUnavailable } from "@/components/product/eu-unavailable"
import { euSalesOpen, regionVerdict } from "@/lib/launch/eu-sales"
import { headers } from "next/headers"

export const metadata = { title: "Upgrade" }

// 결제 시작 — 청약철회 제한 고지와 필수 체크를 거쳐 checkout({ planId, withdrawalConsent: true }) 를 부른다(블록이 한다).
// 클라이언트 토큰이 있으면 결제 창을 이 화면 위에 오버레이로 연다(없으면 결제 링크로 이동)
// 로그아웃·만료 상태면 블록 대신 로그인 안내(돌아올 곳 포함, B04 — `?plan=` 도 돌아올 주소에 실린다)
// A11: 위에 받는 주소 안내(CheckoutEmailNote) — 확인 여부로 결제를 막지 않는다.
// E01·E04: 요금표가 실어 보낸 요금제(`?plan=`)를 고른 채로 열고, 지금 쓰는 요금제를 알려 준다(무료면 비교표 머리가 「Free plan」). F02: 결제가 실패한 사람에게는 위에 결제 실패 띠
export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[]; country?: string | string[] }> }) {
  const sp = await searchParams
  const plan = planParam(sp.plan)
  if (!(await currentSession())) return <SignInRequired next={plan ? `/upgrade?plan=${encodeURIComponent(plan)}` : "/upgrade"} />
  const me = (await currentSession())! // 한 요청에서 한 번만 읽는다(React cache) — 위에서 있음을 확인했다
  const sub = await subscription().catch(() => null)
  const current = sub?.ok && sub.data && (IN_USE_STATUSES as readonly string[]).includes(sub.data.status) ? sub.data.planId : null
  // F10: EU 판매가 닫힌 동안(LF_EU_SALES) 결제 국가가 EU 면 결제 창 대신 안내. 사람이 고른 나라(?country=)가 접속 지역보다 앞선다
  const region = regionVerdict({ open: euSalesOpen(process.env.LF_EU_SALES), declared: sp.country, geo: (await headers()).get("x-vercel-ip-country") ?? undefined })
  if (region.kind === "unavailable") return <EuUnavailable country={region.country} />
  return (
    <>
      {/* A11: 결제 직전에 영수증·청구 메일이 갈 주소를 보인다(확인 안 됐으면 그 사실과 고치는 길까지). 결제는 막지 않는다 — 운영자 결정 2026-10-07 */}
      {me.email ? <CheckoutEmailNote email={me.email} verified={me.emailVerified} /> : null}
      <PaymentFailedBlock subscription={subscription} updatePaymentMethod={updatePaymentMethod} />
      <UpgradeBlock plans={plans} checkout={checkout} checkoutToken={checkoutClientToken()} planId={plan} currentPlanId={current} email={me.email} emailVerified={me.emailVerified} billingCountry={typeof sp.country === "string" && region.country === sp.country.trim().toUpperCase() ? region.country : undefined} />
    </>
  )
}
