import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { realTossTestSession, tossTestConfig, tossTestService } from "@/lib/launch/toss-test"
import { TossTestButton } from "./toss-test-button"
import { TossTestCharge } from "./toss-test-charge"
import { TossTestControls } from "./toss-test-controls"
import { describeTossTestState } from "@/lib/toss-test-status"

export const dynamic = "force-dynamic"

export default async function TossTestPage({ searchParams }: { searchParams: Promise<{ registration?: string | string[] }> }) {
  const config = tossTestConfig()
  if (!config) notFound()
  const session = await realTossTestSession()
  const title = config.fake ? "모의 카드 등록" : "토스 시험 카드 등록"
  if (!session) return <section><h1>{title}</h1><p>실제 서버 계정으로 로그인해 주세요.</p></section>
  const service = await tossTestService()
  if (!service) notFound()
  const port = service.billing.port(session.userId)
  const resultState = await port.detail()
  const plans = await port.plans()
  if (!resultState.ok || !plans.ok || plans.data.length !== 1) return <section><h1>시험 구독</h1><p role="alert">상태를 확인할 수 없습니다.</p></section>
  const state = resultState.data
  const display = describeTossTestState(state)
  const result = (await searchParams).registration
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return <section>
    <h1>{title}</h1>
    <p data-toss-auth="authenticated">서버 로그인 확인됨</p>
    <p>{config.fake ? "모의 등록 결과입니다." : "토스 테스트키를 사용하는 시험 등록입니다."} 실제 결제나 유료 기능 활성화는 하지 않습니다.</p>
    {result === "failed" && <p role="status">등록이 중단되었습니다. 기존 등록 요청이 만료된 뒤 다시 시작할 수 있습니다.</p>}
    {result === "unresolved" && <p role="status">등록 결과를 확인할 수 없습니다. 자동으로 다시 발급하지 않습니다.</p>}
    <p data-toss-state={state.paymentPending ? "payment-pending" : state.phase === "active" ? "charge-confirmed" : state.phase === "registered_unpaid" ? "registered-unpaid" : state.phase === "registering" ? "pending" : state.phase === "none" ? "not-registered" : state.phase}>
      {display.statusMessage}
    </p>
    {display.holdMessage && <p role="status">{display.holdMessage}</p>}
    {display.retryMessage && <p role="status">{display.retryMessage}</p>}
    {state.subscription.currentPeriodEnd && <p>시험 이용 종료: {state.subscription.currentPeriodEnd}</p>}
    {state.subscription.cancelAt && <p>이용 기간 끝 해지 예약됨</p>}
    {(state.phase === "none" || state.phase === "canceled") && !state.paymentPending && <TossTestButton clientKey={config.clientKey} fake={config.fake} nonce={nonce} />}
    {state.canChargeInitial && state.amount !== undefined && <TossTestCharge amount={state.amount} fake={config.fake} />}
    <TossTestControls pending={state.paymentPending} canCancel={state.registered} canCancelPeriod={state.canCancelPeriod} />
  </section>
}
