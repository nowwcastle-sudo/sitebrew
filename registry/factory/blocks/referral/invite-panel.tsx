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
    <section ref={ref} id={id} data-block="referral-invite-panel" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <div className="cn-block-rfi-grid">
        <div data-enter className="cn-block-rfi-main">
          <h2 id={`${id}-title`} className="cn-block-rfi-title font-heading-ko">
            {copy.title}
          </h2>
          <p className="cn-block-rfi-lead">{copy.lead}</p>
          <div data-rewards="" className="cn-block-rfi-rewards">
            <h3 className="cn-block-rfi-sub font-heading-ko">{copy.rewards.title}</h3>
            <ul className="cn-block-rfi-reward-list">
              <li data-reward="you" className="cn-block-rfi-reward">
                <User aria-hidden="true" className="cn-block-rfi-reward-icon" />
                {copy.rewards.you}
              </li>
              <li data-reward="friend" className="cn-block-rfi-reward">
                <Share aria-hidden="true" className="cn-block-rfi-reward-icon" />
                {copy.rewards.friend}
              </li>
            </ul>
          </div>
          <LinkCopy id={id} url={url} copy={copy.link} onCopied={() => track?.("referral_share", { channel: "link" })} />
          <div className="cn-block-rfi-share">
            {kakaoOk ? (
              <Button type="button" variant="outline" size="lg" onClick={kakao} data-share="kakao" className="cn-block-rfi-share-button">
                <Share aria-hidden="true" />
                {copy.kakao}
              </Button>
            ) : null}
            <Button size="lg" variant="outline" nativeButton={false} role="link" render={<a href={smsHref(text)} />} data-share="sms" onClick={() => track?.("referral_share", { channel: "sms" })} className="cn-block-rfi-share-button">
              <Mail aria-hidden="true" />
              {copy.sms}
            </Button>
          </div>
          <p role="status" className="cn-block-rfi-note">
            {note}
          </p>
          <a href={copy.terms.href} className="cn-block-rfi-terms">
            {copy.terms.label}
          </a>
        </div>
        <div data-enter data-referral-progress="" className="cn-block-rfi-progress">
          <h3 className="cn-block-rfi-sub font-heading-ko">{copy.progressTitle}</h3>
          <dl className="cn-block-rfi-stats">
            <div className="cn-block-rfi-stat">
              <dt className="cn-block-rfi-stat-label">{copy.stats.invited}</dt>
              <dd data-numeric className="cn-block-rfi-stat-value font-heading-ko">
                {progress.invited}
              </dd>
            </div>
            <div className="cn-block-rfi-stat">
              <dt className="cn-block-rfi-stat-label">{copy.stats.joined}</dt>
              <dd data-numeric className="cn-block-rfi-stat-value font-heading-ko">
                {progress.joined}
              </dd>
            </div>
            <div className="cn-block-rfi-stat">
              <dt className="cn-block-rfi-stat-label">{copy.stats.earned}</dt>
              <dd data-numeric className="cn-block-rfi-stat-value font-heading-ko">
                {fillText(copy.earnedUnit, { n: progress.earnedMonths })}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
