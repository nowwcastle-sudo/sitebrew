"use client"

import * as React from "react"

import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

// 사회적 증거 — 로고 한 줄. 왼쪽 짧은 제목·근거 한 줄, 오른쪽 고객 로고를 흑백으로 한 줄에 늘어놓는다(흐르지 않는다 — 움직이는 띠는 읽기 어렵고
// 멈출 수단이 필요하다). 로고 그림이 없으면 이름을 글자 표지로 그린다(깨진 그림 없이). 좁은 화면에서는 로고가 두 열로 접힌다.
export type SocialProofLogoRailCopy = {
  title: string
  // 참인 고객 수·규모와 기준일(예: 「가게 1,200곳이 씁니다 — 2026년 9월 기준」).
  claim?: string
  logos: { name: string; logo?: ImageSlot }[]
}
export type SocialProofLogoRailProps = BlockBase<SocialProofLogoRailCopy>

export function SocialProofLogoRail({ copy, id = "social-proof", className }: SocialProofLogoRailProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { y: 8 })
  })
  return (
    <section ref={ref} id={id} data-block="social-proof-logo-rail" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-proof-rail", className)}>
      <div data-enter className="cn-block-proof-rail-head">
        <h2 id={`${id}-title`} className="cn-block-proof-rail-title font-heading">
          {copy.title}
        </h2>
        {copy.claim ? <p className="cn-block-proof-rail-claim">{copy.claim}</p> : null}
      </div>
      {copy.logos.length > 0 ? (
        <ul data-enter className="cn-block-proof-rail-list" data-count={copy.logos.length}>
          {copy.logos.map((l, i) => (
            <li key={i} className="cn-block-proof-rail-item">
              {l.logo ? (
                <img
                  src={l.logo.src}
                  srcSet={l.logo.srcSet}
                  alt={l.logo.alt || l.name}
                  width={l.logo.width}
                  height={l.logo.height}
                  loading="lazy"
                  decoding="async"
                  className="cn-block-proof-rail-logo"
                />
              ) : (
                <span className="cn-block-proof-rail-wordmark font-heading">{l.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
