"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, IsoDate, Money } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/registry/factory/ui/dialog"

import { DaysLeft, MoneyText, useNow } from "../_shared/billing-format"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { useSnooze } from "../_shared/snooze"

// 장바구니 이탈 제안(마케팅 규칙 A5·A6·L3·L7·L8 — factory-rules.md §22-6, 합성 C-11). 장바구니·결제 화면(context)에서만, 방문당 한 번만(sessionStorage) 뜬다(A5).
// 페이지를 열 때 뜨지 않는다 — 마우스가 창 위 끝을 벗어날 때(이탈 의도)만 연다(A6: 첫 화면을 가리는 모달 금지). 닫기 버튼·거절 선택지·바깥 클릭·Esc 로 닫히고
// 포커스를 가둔다(대화상자 부품). 거절은 받기와 대등한 선택지(L3), 「7일간 보지 않기」를 따로 둔다(L7). 남은 날은 실제 끝나는 때(endsAt)가 있을 때만 보이고
// 끝났으면 제안 자체를 띄우지 않는다(L8). 쿠폰은 원화 금액으로 적는다(합성 C-2). 구역은 hidden — 대화상자는 몸(body)으로 포털된다.
// 계측(선택): 받기·거절·쉬기를 누르면 cta_click.
export type LeadCaptureCartExitOfferCopy = {
  title: string
  body: string
  // 쿠폰 조건 한 줄(최소 금액·적용 범위)
  conditions: string
  amountLabel: string
  // 「{days}일 남았어요」
  countdown: string
  decline: string
  accept: string
  snooze: string
}
export type LeadCaptureCartExitOfferProps = BlockBase<LeadCaptureCartExitOfferCopy> & {
  // 이 블록을 둔 화면 — 장바구니·결제만 제안한다
  context: "cart" | "checkout" | "other"
  offer: { amount: Money; href: string; endsAt?: IsoDate }
  now?: IsoDate
  track?: AnalyticsPort["track"]
}

export function LeadCaptureCartExitOffer({ copy, locale, context, offer, now, track, id = "exit-offer", className }: LeadCaptureCartExitOfferProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const at = useNow(now)
  const allowed = context === "cart" || context === "checkout"
  const ended = !!offer.endsAt && new Date(offer.endsAt).getTime() <= new Date(at).getTime()
  const seen = useDismissMemory(`wf-exit-offer:${id}`, "session")
  const { snoozed, snooze } = useSnooze(`wf-exit-offer-snooze:${id}`, 7)
  const [open, setOpen] = React.useState(false)
  const ready = allowed && !ended && seen.dismissed === false && snoozed === false
  const markSeen = seen.set
  React.useEffect(() => {
    if (!ready) return
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return
      setOpen(true)
      markSeen(true)
    }
    document.addEventListener("mouseout", onOut)
    return () => document.removeEventListener("mouseout", onOut)
  }, [ready, markSeen])
  const close = (why: "decline" | "snooze" | "dismiss") => {
    if (why !== "dismiss") track?.("cta_click", { id: `exit-offer-${why}`, label: why === "decline" ? copy.decline : copy.snooze, section: id })
    if (why === "snooze") snooze()
    setOpen(false)
  }
  return (
    <section ref={ref} id={id} data-block="lead-capture-cart-exit-offer" data-context={context} aria-labelledby={`${id}-title`} hidden className={cn("hidden", className)}>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close("dismiss"))}>
        <DialogContent locale={locale} data-exit-offer="" className="gap-5 px-5 py-6 sm:max-w-lg sm:px-6">
          <DialogHeader>
            <DialogTitle id={`${id}-title`} className="pe-10 text-[1.563rem] leading-[1.25] font-heading-ko">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-base leading-[1.6] text-foreground">{copy.body}</DialogDescription>
          </DialogHeader>
          <div data-offer="" className="flex flex-col gap-1 rounded-md border-2 border-dashed px-4 py-4">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base leading-[1.5]">{copy.amountLabel}</span>
              <MoneyText money={offer.amount} price="plain" className="text-[1.953rem] leading-none font-heading-ko" />
            </p>
            <p className="text-base leading-[1.6]">{copy.conditions}</p>
            {offer.endsAt && !ended ? <DaysLeft endsAt={offer.endsAt} now={at} template={copy.countdown} className="text-base leading-[1.5]" /> : null}
          </div>
          <ChoiceRow label={copy.title} className="w-full">
            <ChoiceButton choice="decline" type="button" onClick={() => close("decline")}>
              {copy.decline}
            </ChoiceButton>
            <ChoiceButton choice="primary" nativeButton={false} role="link" render={<a href={offer.href} />} onClick={() => track?.("cta_click", { id: "exit-offer-accept", label: copy.accept, section: id })}>
              {copy.accept}
            </ChoiceButton>
          </ChoiceRow>
          <Button type="button" variant="link" data-snooze="" onClick={() => close("snooze")} className="self-center">
            {copy.snooze}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
