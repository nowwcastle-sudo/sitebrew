"use client"

import * as React from "react"
import * as shop from "@/app/actions/commerce"
import { Button } from "@/components/ui/button"
import { checkoutReturnCopy as copy } from "@/content/copy.shop.en"

// 결제창을 마치고 돌아온 쪽(/checkout/return?orderId=…&paymentId=…)의 확정. 한 번 서버 액션 confirmPayment 를 부르고(서버가 결제 공급자에 다시 물어 확정한다 — 웹훅과 같은 길이라 두 번 불러도 한 번만 확정된다),
// 결과를 글로 말한다: 확정 / 아직 확인 중(다시 확인) / 끝나지 않음. 결제 금액·상태는 브라우저가 정하지 않는다.
type State = "confirming" | "confirmed" | "pending" | "failed"

export function CheckoutReturnConfirm({ orderId, paymentId }: { orderId: string; paymentId: string }) {
  const [state, setState] = React.useState<State>("confirming")
  const started = React.useRef(false)
  const run = React.useCallback(async () => {
    setState("confirming")
    const r = await shop.confirmPayment({ orderId, paymentId }).catch(() => null)
    if (r?.ok) setState("confirmed")
    else setState(r && r.retryable === false ? "failed" : "pending")
  }, [orderId, paymentId])
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    void run()
  }, [run])

  const orderHref = `/orders/${encodeURIComponent(orderId)}`
  return (
    <section data-checkout-return={state} aria-labelledby="checkout-return-title" aria-busy={state === "confirming" || undefined} className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 md:px-8">
      {state === "confirming" ? (
        <h1 id="checkout-return-title" role="status" className="font-heading text-[1.953rem] leading-[1.2]">
          {copy.confirming}
        </h1>
      ) : (
        <>
          <h1 id="checkout-return-title" className="font-heading text-[1.953rem] leading-[1.2]">
            {state === "confirmed" ? copy.confirmed.title : state === "pending" ? copy.pending.title : copy.failed.title}
          </h1>
          <p role="status" className="max-w-prose text-[1.125rem] leading-[1.7]">
            {state === "confirmed" ? copy.confirmed.body : state === "pending" ? copy.pending.body : copy.failed.body}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {state === "pending" ? (
              <Button type="button" size="lg" onClick={() => void run()}>
                {copy.pending.retry}
              </Button>
            ) : null}
            <Button size="lg" variant={state === "pending" ? "outline" : "default"} nativeButton={false} render={<a href={orderHref} />}>
              {state === "confirmed" ? copy.confirmed.link : copy.failed.link}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
