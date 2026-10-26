"use client"

import * as React from "react"
import { confirmBookingDeposit } from "@/app/actions/booking-deposit"
import { Button } from "@/components/ui/button"
import { bookReturnCopy as copy } from "@/content/copy.ux.en"

// 예약금 결제창을 마치고 돌아온 쪽(/book/return?orderId=…&paymentId=…)의 확정. 한 번 서버 액션 confirmBookingDeposit 을 부르고(서버가 결제 공급자에 다시 물어 확정한다 — 웹훅과 같은 길이라 두 번 불러도 한 번만 확정된다),
// 결과를 글로 말한다: 확정 / 아직 확인 중(다시 확인) / 예약이 닫혔다 / 끝나지 않음. 결제 금액·상태는 브라우저가 정하지 않는다.
type State = "confirming" | "confirmed" | "pending" | "closed" | "failed"

export function BookingReturnConfirm({ reference, paymentId }: { reference: string; paymentId: string }) {
  const [state, setState] = React.useState<State>("confirming")
  const started = React.useRef(false)
  const run = React.useCallback(async () => {
    setState("confirming")
    const r = await confirmBookingDeposit({ paymentId }).catch(() => null)
    if (r?.ok) return setState("confirmed")
    const code = r && "code" in r ? r.code : undefined
    const retryable = r && "retryable" in r ? r.retryable : undefined
    if (code === "payment_pending" || !r || retryable !== false) setState(code === "deposit_failed" ? "failed" : "pending")
    else setState(code === "invalid_state" ? "closed" : "failed")
  }, [paymentId])
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    void run()
  }, [run])

  const c = state === "confirmed" ? copy.confirmed : state === "pending" ? copy.pending : state === "closed" ? copy.closed : copy.failed
  return (
    <section data-book-return={state} data-reference={reference} aria-labelledby="book-return-title" aria-busy={state === "confirming" || undefined} className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
      {state === "confirming" ? (
        <h1 id="book-return-title" role="status" className="font-heading text-2xl">
          {copy.confirming}
        </h1>
      ) : (
        <>
          <h1 id="book-return-title" className="font-heading text-2xl">
            {c.title}
          </h1>
          <p role="status" className="max-w-prose text-base leading-[1.7]">
            {c.body}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {state === "pending" ? (
              <Button type="button" size="lg" onClick={() => void run()}>
                {copy.pending.retry}
              </Button>
            ) : null}
            <Button size="lg" variant={state === "pending" ? "outline" : "default"} nativeButton={false} render={<a href={state === "confirmed" ? "/book/manage" : "/book"} />}>
              {state === "confirmed" ? copy.confirmed.link : "link" in c ? c.link : copy.failed.link}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
