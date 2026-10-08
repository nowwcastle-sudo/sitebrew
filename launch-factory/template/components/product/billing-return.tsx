"use client"

import * as React from "react"
import Link from "next/link"

import { BillingInvoices } from "@/components/blocks/_shared/billing-actions"
import type { ActionResult } from "@/components/contract/block-contract"
import type { BillingPort, Subscription } from "@/components/contract/ports"
import { billingCopy, billingReturnCopy as copy, submitNotices } from "@/content/copy.en"

// 결제 창을 마치고 돌아온 화면(LFFIX F3). `_ptxn`(거래 id)으로 서버가 공급자 거래를 읽어 구독을 바로 맞춘다 — 웹훅이 늦어도 「구독 없음」으로 보이지 않는다.
// 구독은 비동기로 만들어져서 처음 몇 번은 아직 없을 수 있다 → 2초 간격으로 최대 10번(약 20초) 다시 묻고, 그래도 없으면 「받았어요, 잠시 뒤에 보여요」로 끝낸다.
const POLL_MS = 2000
const MAX_TRIES = 10
const LIVE = new Set<Subscription["status"]>(["trialing", "active", "past_due", "paused"])

type State = "waiting" | "done" | "slow" | "error" | "missing"

export function BillingReturn({
  transactionId,
  sync,
  portal,
}: {
  transactionId?: string
  sync: (input: { transactionId: string }) => Promise<ActionResult<Subscription & { receiptEmail?: string }>>
  portal: NonNullable<BillingPort["portal"]>
}) {
  const [state, setState] = React.useState<State>(transactionId ? "waiting" : "missing")
  const [receiptEmail, setReceiptEmail] = React.useState<string>()
  const head = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (!transactionId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const ask = async (n: number) => {
      const r = await sync({ transactionId }).catch(() => null)
      if (dead) return
      if (r?.ok) {
        if (LIVE.has(r.data.status)) {
          setReceiptEmail(r.data.receiptEmail)
          return setState("done")
        }
        if (n >= MAX_TRIES) return setState("slow")
      } else if (!r || !r.retryable || n >= MAX_TRIES) return setState("error")
      timer = setTimeout(() => ask(n + 1), POLL_MS)
    }
    void ask(1)
    return () => {
      dead = true
      clearTimeout(timer)
    }
  }, [transactionId, sync])
  React.useEffect(() => {
    if (state !== "waiting") head.current?.focus()
  }, [state])
  const text = state === "waiting" ? { title: copy.title, body: copy.lead } : copy[state]
  const link = state === "waiting" ? null : copy[state]
  // E09: 결제가 닿은 화면(done·slow)에만 영수증 줄과 「청구서·영수증 보기」를 둔다 — 결제를 확인하지 못한 화면(error·missing)에서 영수증을 말하지 않는다
  const paid = state === "done" || state === "slow"
  const [before, after] = copy.receipt.toEmail.split("{email}")
  return (
    <section data-block="billing-return" aria-labelledby="billing-return-title" aria-busy={state === "waiting" || undefined} className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 py-10">
      <h1 id="billing-return-title" ref={head} tabIndex={-1} className="font-heading text-2xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
        {text.title}
      </h1>
      <p role="status" aria-live="polite" className="text-base leading-[1.7]">
        {state === "waiting" ? copy.waiting : text.body}
      </p>
      {paid ? (
        <>
          <p data-receipt="" className="text-base leading-[1.7]">
            {receiptEmail ? (
              <>
                {before}
                <strong className="font-medium break-all">{receiptEmail}</strong>
                {after}
              </>
            ) : (
              copy.receipt.unknown
            )}
          </p>
          <BillingInvoices id="billing-return-invoices" portal={portal} copy={billingCopy.invoices!} notices={submitNotices} />
        </>
      ) : null}
      {link ? (
        <Link href={link.href} className="underline underline-offset-4">
          {link.label}
        </Link>
      ) : null}
    </section>
  )
}
