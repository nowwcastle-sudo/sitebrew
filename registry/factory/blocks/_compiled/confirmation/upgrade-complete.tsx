"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, BillingPort, Subscription } from "@/registry/factory/contract/ports"
import { ArrowRight, Check, LoaderCircle, Mail } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BillingInvoices, type InvoicesCopy } from "../_shared/billing-actions"
import { fill } from "../_shared/billing-format"
import { ReadError, ReadLoading, usePortRead } from "../_shared/port-read"
import type { SubmitNotices } from "../_shared/submit-guard"

// 결제 완료·요금제 열림(대장 A64 — 마케팅 규칙 A10·P10, D82 와 한 짝). 결제창에서 돌아온 화면은 웹훅이 오기 전이면 구독이 아직 「없음」이다 — 그때 「무료」로 보이면 안 된다.
// 구독 읽기(subscription)가 요금제가 열린 상태(active·trialing)가 아니면 「결제를 확인하는 중」(role=status) 한 줄로 pollEvery 초마다 다시 읽고, 최대 pollMax 번 뒤에도 안 열렸으면
// 「메일로 알려드릴게요」로 바꾼다(영수증도 메일). 열리면 가운데 한 판: 무엇이 끝났는지 · 새로 열린 기능(P10) · 영수증은 메일로 · 다음 행동 하나(A10) · 결제 관리 링크.
// P3-6 E09(factory-rules.md §23-3 U10): 영수증이 어느 메일로 가는지(email — copy.receiptTo)와 지난 결제·영수증을 여는 길(portal — 「청구서·영수증 보기」)을 결제 직후 화면에서 잇는다.
// 포트: subscription(읽기 4상태) · portal(선택). 계측(선택): 다음 행동을 누르면 cta_click.
// 폴링은 자리를 옮기지 않는다 — 다시 읽는 동안 보이던 글은 그대로(usePortRead.reload).
export type ConfirmationUpgradeCompleteCopy = {
  title: string
  body: string
  unlockedTitle: string
  unlocked: string[]
  receipt: string
  // 영수증이 가는 메일 주소를 밝히는 틀(선택) — {email}. email prop 이 있을 때만 receipt 대신 쓴다
  receiptTo?: string
  // 「청구서·영수증 보기」(선택) — portal 포트와 notices(폼 보호 문구)가 함께 있을 때만 그린다
  invoices?: InvoicesCopy
  notices?: SubmitNotices
  primary: { label: string; href: string }
  manage: { text: string; label: string; href: string }
  confirming: { title: string; body: string }
  late: { title: string; body: string; label: string; href: string }
  loading: string
  error: string
  retry: string
}
export type ConfirmationUpgradeCompleteProps = BlockBase<ConfirmationUpgradeCompleteCopy> & {
  subscription: BillingPort["subscription"]
  track?: AnalyticsPort["track"]
  // 결제 포털(청구서·영수증 — 선택). 없으면 이 줄을 그리지 않는다
  portal?: BillingPort["portal"]
  onRedirect?: (url: string) => void
  // 영수증을 받는 메일 주소(선택) — 화면에 그대로 적는다(결제한 사람 본인 주소)
  email?: string
  // 다시 읽는 간격(초, 기본 3)과 최대 횟수(기본 6 — 18초). 웹훅은 보통 몇 초 안에 온다
  pollEvery?: number
  pollMax?: number
  initial?: { subscription?: Subscription }
}

const OPEN: Subscription["status"][] = ["active", "trialing"]

export function ConfirmationUpgradeComplete({ copy, subscription, track, portal, onRedirect, email, pollEvery = 3, pollMax = 6, initial, id = "upgrade-complete", className }: ConfirmationUpgradeCompleteProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const read = usePortRead(subscription, initial?.subscription)
  const { reload } = read
  const [polls, setPolls] = React.useState(0)
  const sub = read.state.status === "ready" ? read.state.data : null
  const opened = !!sub && OPEN.includes(sub.status)
  const waiting = !!sub && !opened
  const giveUp = waiting && polls >= pollMax
  React.useEffect(() => {
    if (!waiting || polls >= pollMax) return
    const t = setTimeout(() => {
      setPolls((p) => p + 1)
      reload()
    }, pollEvery * 1000)
    return () => clearTimeout(t)
  }, [waiting, polls, pollMax, pollEvery, reload])

  return (
    <section ref={ref} id={id} data-block="confirmation-upgrade-complete" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 items-center", className)}>
      <div data-enter aria-busy={read.state.status === "loading" || (waiting && !giveUp) || undefined} className="flex w-full max-w-xl flex-col items-center gap-5 rounded-lg border px-5 py-8 text-center md:px-10 md:py-10">
        {read.state.status === "loading" ? (
          <>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.confirming.title}
            </h2>
            <ReadLoading label={copy.loading} lines={3} />
          </>
        ) : null}
        {read.state.status === "error" ? (
          <>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.confirming.title}
            </h2>
            <ReadError state={read.state} title={copy.error} retryLabel={copy.retry} />
          </>
        ) : null}
        {waiting && !giveUp ? (
          <div data-confirming="" className="flex w-full flex-col items-center gap-5">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.confirming.title}
            </h2>
            <p role="status" className="max-w-prose text-base leading-[1.7] break-words">
              {copy.confirming.body}
            </p>
          </div>
        ) : null}
        {giveUp ? (
          <div data-late="" className="flex w-full flex-col items-center gap-5">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Mail className="size-7" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.late.title}
            </h2>
            <p className="max-w-prose text-base leading-[1.7] break-words">{copy.late.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.late.href} />} data-next-action="" className="w-full sm:w-auto">
              {copy.late.label}
            </Button>
          </div>
        ) : null}
        {opened ? (
          <div data-opened="" className="flex w-full flex-col items-center gap-5">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-7" />
            </span>
            <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
              {copy.title}
            </h2>
            <p className="max-w-prose text-base leading-[1.7] break-words">{copy.body}</p>
            {copy.unlocked.length ? (
              <div data-unlocked="" className="flex w-full flex-col gap-3 rounded-md bg-muted px-4 py-4 text-start">
                <h3 className="text-[1.125rem] leading-[1.4] font-heading-ko">{copy.unlockedTitle}</h3>
                <ul className="flex flex-col gap-2">
                  {copy.unlocked.map((u, i) => (
                    <li key={i} className="flex items-start gap-2 text-base leading-[1.6]">
                      <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p data-receipt="" className="flex max-w-prose items-start gap-2 text-start text-base leading-[1.6]">
              <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{email && copy.receiptTo ? fill(copy.receiptTo, { email: <span data-numeric>{email}</span> }) : copy.receipt}</span>
            </p>
            {portal && copy.invoices && copy.notices ? <BillingInvoices id={`${id}-invoices`} portal={portal} copy={copy.invoices} notices={copy.notices} onRedirect={onRedirect} /> : null}
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.primary.href} />} data-next-action="" onClick={() => track?.("cta_click", { id: "upgrade-next", label: copy.primary.label, section: id })} className="w-full sm:w-auto">
              {copy.primary.label}
              <ArrowRight aria-hidden="true" />
            </Button>
            <p data-manage="" className="text-base leading-[1.6]">
              {copy.manage.text}{" "}
              <a href={copy.manage.href} className="relative inline-flex min-h-11 items-center underline underline-offset-4">
                {copy.manage.label}
              </a>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
