"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { Download } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"

// 마지막 행동 유도 — 앱 스토어·확장 설치 배지 줄(앱·PWA·브라우저 확장 안내). 제목 h2 + 한 줄 설명 + 스토어마다 글자 단추 하나(스토어 이름 + 받는 방법).
// 공식 배지 그림(각 스토어가 정한 로고·여백·문구)은 저장소에 넣지 않는다 — 그림은 스토어의 상표 규칙을 지켜야 하므로, 이 블록은 글자 단추만 낸다.
// 공식 배지를 쓰려면 조립하는 쪽이 각 스토어의 규칙 페이지에서 직접 받아 규칙대로 쓴다(규칙 링크: docs/qa/factory-v1/asset-licenses.md 「스토어 배지」).
// 단추는 반전 색 면(전경색 바탕 · 바탕색 글자) 위에 스토어 이름이 보이고, 모두 같은 크기다(어느 스토어도 더 크게 밀지 않는다). 계측(선택): cta_click.
export type StoreBadge = {
  // 스토어 종류 — 표지(data-store)만 정한다. 이름과 문구는 label 이 준다
  store: "app-store" | "google-play" | "web-store" | "direct"
  // 단추에 보이는 글(= 접근 이름): 「앱 스토어에서 받기」
  label: string
  href: string
  // 작은 한 줄(선택): 「iPhone·iPad」 「무료」
  hint?: string
}
export type FinalCtaStoreBadgesCopy = {
  title: string
  lead?: string
  badges: StoreBadge[]
  // 아래 작은 안내(선택): 지원 기기·상표 안내 같은 것
  note?: string
}
export type FinalCtaStoreBadgesProps = BlockBase<FinalCtaStoreBadgesCopy> & {
  track?: AnalyticsPort["track"]
}

export function FinalCtaStoreBadges({ copy, track, id = "get-the-app", className }: FinalCtaStoreBadgesProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"))
  })
  return (
    <section ref={ref} id={id} data-block="final-cta-store-badges" aria-labelledby={`${id}-title`} className={cn("cn-block-section", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul data-enter className="cn-block-sb-list">
        {copy.badges.map((b, i) => (
          <li key={i}>
            <a href={b.href} data-store={b.store} onClick={() => track?.("cta_click", { id: `store-${b.store}`, label: b.label, section: id })} className="cn-block-sb-badge">
              <Download aria-hidden="true" className="cn-block-sb-icon" />
              <span className="cn-block-sb-text">
                <span className="cn-block-sb-label">{b.label}</span>
                {b.hint ? <span className="cn-block-sb-hint">{b.hint}</span> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {copy.note ? (
        <p data-enter className="cn-block-sb-note">
          {copy.note}
        </p>
      ) : null}
    </section>
  )
}
