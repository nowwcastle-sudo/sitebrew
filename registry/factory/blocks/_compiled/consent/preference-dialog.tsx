"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, ConsentState } from "@/registry/factory/contract/ports"
import { Settings } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { DateText, fill } from "../_shared/billing-format"
import { useConsentOpener } from "../_shared/consent-open"
import { ConsentPrefsDialog, type ConsentCategory } from "../_shared/consent-prefs"

// 쿠키 설정 — 페이지 안 요약 판(지금 설정: 분석·마케팅 허용/거부 · 결정한 날 · [쿠키 설정 바꾸기])을 누르면 대화상자(사용자가 연다 — 첫 화면에 저절로
// 뜨지 않는다, A6). 대화상자 안: 필수(늘 켜짐 — 끌 수 없음을 글로) · 분석 · 마케팅 스위치(선택 — 결정 전에는 꺼짐, data-consent="optional", L2)
// · [선택한 대로 저장하기] · [모두 거부하기][모두 허용하기] 대등(L3). 저장은 setConsent(포트), 닫기·Esc 는 저장하지 않는다.
// 계측(선택): 저장하면 consent_update{analytics, marketing}.
type Category = ConsentCategory
export type ConsentPreferenceDialogCopy = {
  title: string
  lead?: string
  summary: { analytics: string; marketing: string; on: string; off: string; undecided: string; decidedAt: string }
  open: string
  dialog: { title: string; description: string }
  necessary: { label: string; body: string; always: string }
  categories: Record<Category, { label: string; body: string }>
  marker: string
  save: string
  decline: string
  accept: string
  saved: string
}
export type ConsentPreferenceDialogProps = BlockBase<ConsentPreferenceDialogCopy> & {
  consent: AnalyticsPort["consent"]
  setConsent: AnalyticsPort["setConsent"]
  track?: AnalyticsPort["track"]
  defaultOpen?: boolean
}

export function ConsentPreferenceDialog({ copy, locale, timeZone, consent, setConsent, track, defaultOpen = false, id = "cookie-settings", className }: ConsentPreferenceDialogProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [current, setCurrent] = React.useState<ConsentState>(() => consent())
  const [open, setOpen] = React.useState(defaultOpen)
  const [saved, setSaved] = React.useState(false)
  const [source, setSource] = React.useState(() => consent)
  if (source !== consent) {
    const c = consent()
    setSource(() => consent)
    setCurrent(c)
    setSaved(false)
  }
  // 푸터 같은 곳의 「쿠키 설정」 링크(data-consent-open)도 이 대화상자를 연다(K04 — 우선순위 3). 닫을 때 그 링크로 포커스를 돌려준다.
  const returnRef = React.useRef<Element | null>(null)
  useConsentOpener((from) => {
    returnRef.current = from
    setOpen(true)
  }, 3)
  const onSaved = (next: Record<Category, boolean>) => {
    track?.("consent_update", next)
    setCurrent(consent())
    setSaved(true)
  }
  const state = (on: boolean) => (!current.decidedAt ? copy.summary.undecided : on ? copy.summary.on : copy.summary.off)
  return (
    <section ref={ref} id={id} data-block="consent-preference-dialog" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div data-enter className="grid max-w-3xl grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-5 gap-y-5">
        <Settings aria-hidden="true" className="size-10 border p-2" />
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        <dl className="col-start-2 flex flex-col border-y">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
            <dt className="text-base break-keep">{copy.summary.analytics}</dt>
            <dd className="text-base font-medium">{state(current.analytics)}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0">
            <dt className="text-base break-keep">{copy.summary.marketing}</dt>
            <dd className="text-base font-medium">{state(current.marketing)}</dd>
          </div>
        </dl>
        {current.decidedAt ? <p className="col-start-2 text-base leading-[1.6] empty:hidden">{fill(copy.summary.decidedAt, { date: <DateText locale={locale} timeZone={timeZone} iso={current.decidedAt} as="since" /> })}</p> : null}
        <p role="status" className="col-start-2 text-base leading-[1.6] empty:hidden">
          {saved ? copy.saved : ""}
        </p>
        <Button type="button" variant="outline" size="lg" aria-haspopup="dialog" onClick={() => {
            returnRef.current = null
            setOpen(true)
          }}
          className="col-start-2 justify-self-start">
          {copy.open}
        </Button>
        <ConsentPrefsDialog
          id={id}
          locale={locale}
          open={open}
          onOpenChange={setOpen}
          copy={{ dialog: copy.dialog, necessary: copy.necessary, categories: copy.categories, marker: copy.marker, save: copy.save, decline: copy.decline, accept: copy.accept }}
          consent={consent}
          setConsent={setConsent}
          onSaved={onSaved}
          returnFocusTo={returnRef}
        />
      </div>
    </section>
  )
}
