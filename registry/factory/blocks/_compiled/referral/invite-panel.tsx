"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Mail, Share, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { fillText } from "../_shared/billing-format"
import { type KakaoShareTemplate, LinkCopy, type LinkCopyCopy, copyText, kakaoTemplateIssues, shareToKakao, smsHref } from "../_shared/share-link"

// 초대 판(마케팅 규칙 V1·V2 — factory-rules.md §22-6). 제품 안 늘 같은 자리(설정·메뉴)에 두는 상시 진입점(V1). 양쪽 보상은 제품 가치로 적는다(V2 — 현금·할인 코드가 아니라
// 「한 달 무료」처럼). 문구를 채운 원클릭 공유: 카카오톡(§17 템플릿이 규격에 맞을 때만 버튼을 그린다 — SDK 가 없으면 링크를 복사하고 알린다)·문자·링크 복사.
// 진행 상태판(보낸 초대·가입한 친구·받은 보상)은 숫자 글자로. 계측(선택): 공유 채널마다 referral_share(channel) — 받는 사람·링크 값은 싣지 않는다.
export type ReferralInvitePanelCopy = {
  title: string
  lead: string
  rewards: { title: string; you: string; friend: string }
  link: LinkCopyCopy
  kakao: string
  kakaoFallback: string
  sms: string
  // 문자로 보낼 채운 글 — {link} 자리에 초대 링크
  message: string
  progressTitle: string
  stats: { invited: string; joined: string; earned: string }
  // 「{n}개월」
  earnedUnit: string
  terms: { label: string; href: string }
}
export type ReferralInvitePanelProps = BlockBase<ReferralInvitePanelCopy> & {
  url: string
  template: KakaoShareTemplate
  progress: { invited: number; joined: number; earnedMonths: number }
  track?: AnalyticsPort["track"]
}

export function ReferralInvitePanel({ copy, url, template, progress, track, id = "invite", className }: ReferralInvitePanelProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  const [note, setNote] = React.useState("")
  const kakaoOk = kakaoTemplateIssues(template).length === 0
  const text = fillText(copy.message, { link: url })
  const kakao = async () => {
    track?.("referral_share", { channel: "kakao" })
    if (shareToKakao(template)) return setNote("")
    setNote((await copyText(url)) ? copy.kakaoFallback : copy.link.manual)
  }
  return (
    <section ref={ref} id={id} data-block="referral-invite-panel" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <div data-enter className="flex min-w-0 flex-col gap-5">
          <h2 id={`${id}-title`} className="text-[1.953rem] leading-[1.2] md:text-[2.441rem] md:leading-[1.15] font-heading-ko">
            {copy.title}
          </h2>
          <p className="text-base leading-[1.7]">{copy.lead}</p>
          <div data-rewards="" className="flex flex-col gap-3 rounded-lg bg-muted px-5 py-4">
            <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.rewards.title}</h3>
            <ul className="flex flex-col gap-2">
              <li data-reward="you" className="flex items-start gap-2 text-base leading-[1.6]">
                <User aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                {copy.rewards.you}
              </li>
              <li data-reward="friend" className="flex items-start gap-2 text-base leading-[1.6]">
                <Share aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                {copy.rewards.friend}
              </li>
            </ul>
          </div>
          <LinkCopy id={id} url={url} copy={copy.link} onCopied={() => track?.("referral_share", { channel: "link" })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kakaoOk ? (
              <Button type="button" variant="outline" size="lg" onClick={kakao} data-share="kakao" className="w-full">
                <Share aria-hidden="true" />
                {copy.kakao}
              </Button>
            ) : null}
            <Button size="lg" variant="outline" nativeButton={false} role="link" render={<a href={smsHref(text)} />} data-share="sms" onClick={() => track?.("referral_share", { channel: "sms" })} className="w-full">
              <Mail aria-hidden="true" />
              {copy.sms}
            </Button>
          </div>
          <p role="status" className="min-h-6 text-base leading-[1.5] empty:hidden">
            {note}
          </p>
          <a href={copy.terms.href} className="relative inline-flex min-h-11 items-center self-start text-base underline underline-offset-4">
            {copy.terms.label}
          </a>
        </div>
        <div data-enter data-referral-progress="" className="flex flex-col gap-4 rounded-lg border px-5 py-5 lg:self-start">
          <h3 className="text-[1.25rem] leading-[1.35] font-heading-ko">{copy.progressTitle}</h3>
          <dl className="grid grid-cols-3 gap-3">
            <div className="flex min-w-0 flex-col-reverse gap-1 border-t-2 border-primary pt-3">
              <dt className="text-base leading-[1.4]">{copy.stats.invited}</dt>
              <dd data-numeric className="text-[1.953rem] leading-none tabular-nums break-keep max-sm:text-[1.563rem] font-heading-ko">
                {progress.invited}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col-reverse gap-1 border-t-2 border-primary pt-3">
              <dt className="text-base leading-[1.4]">{copy.stats.joined}</dt>
              <dd data-numeric className="text-[1.953rem] leading-none tabular-nums break-keep max-sm:text-[1.563rem] font-heading-ko">
                {progress.joined}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col-reverse gap-1 border-t-2 border-primary pt-3">
              <dt className="text-base leading-[1.4]">{copy.stats.earned}</dt>
              <dd data-numeric className="text-[1.953rem] leading-none tabular-nums break-keep max-sm:text-[1.563rem] font-heading-ko">
                {fillText(copy.earnedUnit, { n: progress.earnedMonths })}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
