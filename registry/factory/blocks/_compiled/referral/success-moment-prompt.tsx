"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { CheckCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { type KakaoShareTemplate, copyText, kakaoTemplateIssues, shareToKakao } from "../_shared/share-link"

// 성공 순간 뒤 초대 권유(마케팅 규칙 V1·V2·V4·L3 — factory-rules.md §22-4·§22-6). 제품 안에서 방금 이룬 일(moment — 첫 예약을 받음 등)이 있을 때만 그린다(V4 —
// 성공 전·온보딩 중·페이월 앞에서는 묻지 않는다. moment 가 없으면 빈 hidden 구역). 성공 한 줄 → 초대 권유 한 줄(양쪽 보상, 제품 가치 — V2) →
// [나중에][친구 초대하기] 대등한 두 선택지(L3). 초대는 카카오톡(템플릿 규격 통과 + SDK 있을 때) 아니면 링크 복사. 「나중에」는 이 방문 동안 다시 묻지 않는다.
// 계측(선택): 초대하면 referral_share(channel), 나중에는 cta_click.
export type ReferralSuccessMomentPromptCopy = {
  ask: { title: string; body: string }
  later: string
  invite: string
  copied: string
  manual: string
}
export type ReferralSuccessMomentPromptProps = BlockBase<ReferralSuccessMomentPromptCopy> & {
  // 방금 이룬 일(성공 순간) — 없으면 그리지 않는다
  moment?: { key: string; title: string; body?: string }
  url: string
  template: KakaoShareTemplate
  track?: AnalyticsPort["track"]
}

export function ReferralSuccessMomentPrompt({ copy, moment, url, template, track, id = "success-invite", className }: ReferralSuccessMomentPromptProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const { dismissed, set } = useDismissMemory(`wf-success-invite:${moment?.key ?? "none"}`, "session")
  const [note, setNote] = React.useState("")
  const [laterNow, setLaterNow] = React.useState(false)
  if (!moment || dismissed === true || laterNow)
    return (
      <section ref={ref} id={id} data-block="referral-success-moment-prompt" aria-labelledby={`${id}-title`} hidden className={cn("mx-auto w-full max-w-3xl px-4 py-8 md:px-8", className)}>
        <h2 id={`${id}-title`}>{copy.ask.title}</h2>
      </section>
    )
  const invite = async () => {
    if (kakaoTemplateIssues(template).length === 0 && shareToKakao(template)) {
      track?.("referral_share", { channel: "kakao" })
      return setNote("")
    }
    const ok = await copyText(url)
    if (ok) track?.("referral_share", { channel: "link" })
    setNote(ok ? copy.copied : copy.manual)
  }
  const later = () => {
    track?.("cta_click", { id: "invite-later", label: copy.later, section: id })
    setLaterNow(true)
    set(true)
  }
  return (
    <section ref={ref} id={id} data-block="referral-success-moment-prompt" data-moment={moment.key} aria-labelledby={`${id}-title`} className={cn("mx-auto w-full max-w-3xl px-4 py-8 md:px-8", className)}>
      <div data-enter className="flex flex-col gap-4 rounded-lg border-2 border-primary px-5 py-5 md:px-6">
        <p data-success-moment="" className="flex items-start gap-3">
          <CheckCircle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
          <span className="text-base leading-[1.6]">
            <span className="text-[1.125rem] leading-[1.4] font-heading-ko">{moment.title}</span>
            {moment.body ? <span className="text-base"> {moment.body}</span> : null}
          </span>
        </p>
        <div className="flex flex-col gap-1 border-t pt-4">
          <h2 id={`${id}-title`} className="text-[1.25rem] leading-[1.35] font-heading-ko">
            {copy.ask.title}
          </h2>
          <p className="text-base leading-[1.6]">{copy.ask.body}</p>
        </div>
        <ChoiceRow label={copy.ask.title} className="max-w-md">
          <ChoiceButton choice="decline" type="button" onClick={later}>
            {copy.later}
          </ChoiceButton>
          <ChoiceButton choice="primary" type="button" onClick={invite}>
            {copy.invite}
          </ChoiceButton>
        </ChoiceRow>
        <p role="status" className="min-h-6 text-base leading-[1.5] empty:hidden">
          {note}
        </p>
      </div>
    </section>
  )
}
