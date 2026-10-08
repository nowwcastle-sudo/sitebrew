"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort, ConsentState } from "@/registry/factory/contract/ports"
import { CheckCircle, EyeOff, MapPin } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"
import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useSnooze } from "../_shared/snooze"

// 쿠키 동의 자리 안내 — 동의가 있어야 불러올 수 있는 내용(지도·영상 등 바깥 서비스) 자리에 놓는 점선 판. 자리를 가리는 창이 아니라 그 자리 자체다(X3).
// 판: 무엇이 빠졌고 왜(어느 동의가 필요한지) · [거부하기][허용하고 보기] 대등(L3) · 「7일간 보지 않기」(L7 — 이 판은 들를 때마다 다시 묻는다).
// 이미 허용했으면 내용 자리(allowed — 여는 링크)를, 거부했거나 쉬는 중이면 한 줄(무엇이 빠졌나 · 설정 바꾸기 링크)만 보인다. 결정은 setConsent(포트)로
// 저장하고 다른 항목의 결정은 그대로 둔다. 쉬기는 이 브라우저에만 적고 동의는 바꾸지 않는다. 계측(선택): 결정하면 consent_update.
type Category = "analytics" | "marketing"
export type ConsentInlineNoticeCopy = {
  title: string
  body: string
  decline: string
  accept: string
  snooze: string // 「7일간 보지 않기」
  hidden: string // 거부·쉬는 중 한 줄
  settings: { label: string; href: string }
  allowed: { body: string; label: string; href: string }
}
export type ConsentInlineNoticeProps = BlockBase<ConsentInlineNoticeCopy> & {
  consent: AnalyticsPort["consent"]
  setConsent: AnalyticsPort["setConsent"]
  track?: AnalyticsPort["track"]
  // 이 내용에 필요한 동의 항목
  category: Category
  snoozeDays?: number
}

export function ConsentInlineNotice({ copy, consent, setConsent, track, category, snoozeDays = 7, id = "consent-notice", className }: ConsentInlineNoticeProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [current, setCurrent] = React.useState<ConsentState>(() => consent())
  const [source, setSource] = React.useState(() => consent)
  if (source !== consent) {
    setSource(() => consent)
    setCurrent(consent())
  }
  const [declinedNow, setDeclinedNow] = React.useState(false)
  const { snoozed, snooze } = useSnooze(`wf-consent-notice:${id}:${category}`, snoozeDays)
  const decide = (on: boolean) => {
    const next = { analytics: current.analytics, marketing: current.marketing, [category]: on }
    setConsent(next)
    track?.("consent_update", next)
    setCurrent(consent())
    if (!on) setDeclinedNow(true)
  }
  const granted = current[category]
  const view = granted ? "allowed" : declinedNow || snoozed === true ? "hidden" : "ask"
  return (
    <section ref={ref} id={id} data-block="consent-inline-notice" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div data-enter data-consent-view={view} className="cn-block-cnotice">
        {view === "allowed" ? (
          <div className="cn-block-cnotice-allowed">
            <CheckCircle aria-hidden="true" className="cn-block-cnotice-icon" />
            <h2 id={`${id}-title`} className="cn-block-cnotice-title font-heading">
              {copy.title}
            </h2>
            <p className="cn-block-cnotice-body">{copy.allowed.body}</p>
            <Button size="lg" nativeButton={false} role="link" render={<a href={copy.allowed.href} />}>
              {copy.allowed.label}
            </Button>
          </div>
        ) : view === "hidden" ? (
          <div className="cn-block-cnotice-line">
            <EyeOff aria-hidden="true" className="cn-block-cnotice-line-icon" />
            <h2 id={`${id}-title`} className="cn-block-cnotice-line-text">
              {copy.hidden}
            </h2>
            <a href={copy.settings.href} className="cn-block-cookie-link">
              {copy.settings.label}
            </a>
          </div>
        ) : (
          <div className="cn-block-cnotice-ask">
            <MapPin aria-hidden="true" className="cn-block-cnotice-icon" />
            <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.body} className="cn-block-cnotice-head" />
            <ChoiceRow label={copy.title} className="cn-block-cnotice-choices">
              <ChoiceButton choice="decline" type="button" onClick={() => decide(false)}>
                {copy.decline}
              </ChoiceButton>
              <ChoiceButton choice="primary" type="button" onClick={() => decide(true)}>
                {copy.accept}
              </ChoiceButton>
            </ChoiceRow>
            <Button type="button" variant="link" data-snooze="" onClick={snooze} className="cn-block-cnotice-snooze">
              {copy.snooze}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
