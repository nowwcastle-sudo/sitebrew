"use client"

import * as React from "react"

import { fillText, formatMoney } from "@/components/blocks/_shared/billing-format"
import type { PayResult } from "@/components/blocks/_shared/checkout-flow"
import type { PaymentSession } from "@/components/contract/commerce"
import { Button } from "@/components/ui/button"
import { mockPayCopy as copy } from "@/content/copy.shop.en"

// 모의 결제 화면(키 없이 켠 결제 중개의 세션 — provider "mock"). 결제창을 대신하는 확인 칸이다: [모의 결제 완료]는 서버 액션 payWithMock 으로 내 결제 대기 주문의 모의 결제를 완료로 만들고,
// [결제하지 않고 닫기]는 결제창을 닫은 것과 같다(블록이 같은 주문으로 다시 결제하게 한다). 돈이 움직이지 않는다 — 화면이 그렇게 말한다.
// 결제를 마치면 settle 로 PayResult 를 돌려주고, 확정은 블록이 한다(confirmPayment — 이미 완료된 건이라 같은 길로 닫힌다).
export type MockPayRequest = { session: PaymentSession; settle: (result: PayResult) => void }

export function MockPayPanel({ request, pay }: { request: MockPayRequest; pay: (input: { orderId: string }) => Promise<{ ok: boolean; code?: string }> }) {
  const { session, settle } = request
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const complete = async () => {
    const orderId = session.client.orderId
    if (!orderId) return settle({ ok: false, paymentId: session.paymentId, code: "provider_unavailable" })
    setBusy(true)
    setFailed(false)
    const r = await pay({ orderId }).catch(() => ({ ok: false as const, code: "payment_failed" }))
    setBusy(false)
    if (r.ok) settle({ ok: true, paymentId: session.paymentId })
    else setFailed(true)
  }

  return (
    <section data-mock-pay data-testid="mock-pay" aria-labelledby="mock-pay-title" className="mx-auto w-full max-w-6xl px-4 md:px-8">
      <div className="flex flex-col gap-4 border px-4 py-5 md:px-6">
        <h2 id="mock-pay-title" ref={titleRef} tabIndex={-1} className="font-heading text-[1.25rem] leading-[1.35] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
          {copy.title}
        </h2>
        <p className="text-base leading-[1.6]">{copy.body}</p>
        <p data-numeric className="text-base leading-[1.6]">
          {fillText(copy.amount, { amount: formatMoney(session.total, "en") })}
        </p>
        {failed ? (
          <p role="alert" className="text-base leading-[1.6]">
            {copy.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" data-action="mock-pay" disabled={busy} aria-busy={busy || undefined} onClick={() => void complete()}>
            {busy ? copy.paying : copy.pay}
          </Button>
          <Button type="button" variant="outline" data-action="mock-close" disabled={busy} onClick={() => settle({ ok: false, paymentId: session.paymentId, code: "payment_canceled" })}>
            {copy.close}
          </Button>
        </div>
      </div>
    </section>
  )
}
