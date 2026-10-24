"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { ChevronRight, Mail, MoreHorizontal, Share } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { type KakaoShareTemplate, LinkCopy, type LinkCopyCopy, copyText, kakaoTemplateIssues, shareToKakao, smsHref } from "../_shared/share-link"

// 공유 시트(마케팅 규칙 V2 — factory-rules.md §22-6 · §17 카카오톡 공유 규격). 보낼 글을 먼저 보여 주고(채운 글 — 받는 사람이 무엇을 받는지 미리 안다),
// 채널을 한 줄씩: 카카오톡(템플릿 규격 통과 때만) · 문자 · 메일 · 기기 공유(지원할 때만 — 서버 렌더에서는 숨는다) · 링크 복사(클립보드가 막히면 칸을 골라 둔다).
// 채널 모양은 레시피 버튼이다(플랫폼 색·반경 없음). 계측(선택): 채널마다 referral_share(channel).
export type ReferralShareSheetCopy = {
  title: string
  lead?: string
  previewLabel: string
  // 채운 글 — {link} 자리에 링크
  message: string
  channelsLabel: string
  kakao: string
  kakaoFallback: string
  sms: string
  email: { label: string; subject: string }
  native: string
  link: LinkCopyCopy
}
export type ReferralShareSheetProps = BlockBase<ReferralShareSheetCopy> & {
  url: string
  template: KakaoShareTemplate
  track?: AnalyticsPort["track"]
}

const noop = () => () => {}
// 기기 공유(Web Share)가 되는가 — 서버 렌더에서는 false(버튼을 그리지 않고, 하이드레이션 뒤에 붙인다)
const useCanShare = () =>
  React.useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  )

export function ReferralShareSheet({ copy, url, template, track, id = "share", className }: ReferralShareSheetProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [note, setNote] = React.useState("")
  const canShare = useCanShare()
  const kakaoOk = kakaoTemplateIssues(template).length === 0
  const text = fillText(copy.message, { link: url })
  const kakao = async () => {
    track?.("referral_share", { channel: "kakao" })
    if (shareToKakao(template)) return setNote("")
    setNote((await copyText(url)) ? copy.kakaoFallback : copy.link.manual)
  }
  const native = async () => {
    track?.("referral_share", { channel: "other" })
    try {
      await navigator.share({ title: template.title, text, url })
    } catch {
      // 사용자가 닫았다 — 아무 일도 없다
    }
  }
  return (
    <section ref={ref} id={id} data-block="referral-share-sheet" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8 items-center", className)}>
      <div data-enter className="flex w-full max-w-md flex-col gap-4 rounded-lg border bg-card px-5 py-6 text-card-foreground">
        <h2 id={`${id}-title`} className="text-[1.563rem] leading-[1.25] font-heading-ko">
          {copy.title}
        </h2>
        {copy.lead ? <p className="text-base leading-[1.6]">{copy.lead}</p> : null}
        <figure data-share-preview="" className="flex flex-col gap-1 rounded-md bg-muted px-4 py-3">
          <figcaption className="text-base leading-[1.5]">{copy.previewLabel}</figcaption>
          <p className="text-base leading-[1.5] font-heading-ko">{template.title}</p>
          <p className="text-base leading-[1.6] break-words">{text}</p>
        </figure>
        <ul aria-label={copy.channelsLabel} className="flex flex-col divide-y border-y">
          {kakaoOk ? (
            <li>
              <Button type="button" variant="ghost" size="lg" onClick={kakao} data-share="kakao" className="h-auto min-h-14 w-full justify-start gap-3 px-2 text-base">
                <Share aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <span className="flex-1 text-start">{copy.kakao}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </Button>
            </li>
          ) : null}
          <li>
            <Button variant="ghost" size="lg" nativeButton={false} role="link" render={<a href={smsHref(text)} />} data-share="sms" onClick={() => track?.("referral_share", { channel: "sms" })} className="h-auto min-h-14 w-full justify-start gap-3 px-2 text-base">
              <Mail aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="flex-1 text-start">{copy.sms}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              size="lg"
              nativeButton={false}
              role="link"
              render={<a href={`mailto:?subject=${encodeURIComponent(copy.email.subject)}&body=${encodeURIComponent(text)}`} />}
              data-share="email"
              onClick={() => track?.("referral_share", { channel: "email" })}
              className="h-auto min-h-14 w-full justify-start gap-3 px-2 text-base"
            >
              <Mail aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <span className="flex-1 text-start">{copy.email.label}</span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </li>
          {canShare ? (
            <li>
              <Button type="button" variant="ghost" size="lg" onClick={native} data-share="native" className="h-auto min-h-14 w-full justify-start gap-3 px-2 text-base">
                <MoreHorizontal aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <span className="flex-1 text-start">{copy.native}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </Button>
            </li>
          ) : null}
        </ul>
        <p role="status" className="min-h-6 text-base leading-[1.5] empty:hidden">
          {note}
        </p>
        <LinkCopy id={id} url={url} copy={copy.link} onCopied={() => track?.("referral_share", { channel: "link" })} className="border-t pt-4" />
      </div>
    </section>
  )
}
