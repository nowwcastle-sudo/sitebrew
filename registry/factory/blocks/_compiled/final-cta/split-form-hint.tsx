"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Calendar, ExternalLink, Mail, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"

import { BlockHeading } from "../_shared/block-heading"
import { breakable } from "../_shared/break-text"

// 마지막 행동 유도 — 왼쪽: 제목 h2·머리말(바탕 위 본문), 오른쪽: 연락 채널 목록(전화·메일·채팅·예약 페이지). 채널 한 줄 = 아이콘 · 채널 이름 ·
// 값(전화번호·메일 주소만 — 채팅·예약 페이지의 https 주소는 보이지 않고 안내 한 줄만) · 화살표, 줄 전체가 링크(44px 이상). 전화는 tel:(normalizePhone), 메일은 mailto:, 나머지는 https 주소 그대로.
// 375 에서는 문구 아래로 목록이 쌓인다. 등장: 제목·머리말 → 채널 줄이 차례로(rise). 동작 줄이기·M0 은 끝 모양 그대로.
export type FinalCtaChannelKind = "tel" | "mail" | "kakao" | "naver-booking" | "catchtable"
export type FinalCtaSplitFormHintCopy = {
  title: string
  lead?: string
  channelsLabel: string
  // label = 보이는 채널 이름, value = 전화번호·메일 주소·https 주소(ContactChannel 과 같은 값).
  channels: { kind: FinalCtaChannelKind; label: string; value: string; note?: string }[]
}
export type FinalCtaSplitFormHintProps = BlockBase<FinalCtaSplitFormHintCopy>

const hrefOf = (kind: FinalCtaChannelKind, value: string) =>
  kind === "tel" ? `tel:${normalizePhone(value) ?? value.replace(/[^\d+]/g, "")}` : kind === "mail" ? `mailto:${value}` : value
const ICON = { tel: Phone, mail: Mail, kakao: ExternalLink, "naver-booking": Calendar, catchtable: Calendar } as const

export function FinalCtaSplitFormHint({ copy, id = "contact-cta", className }: FinalCtaSplitFormHintProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
  })
  return (
    <section ref={ref} id={id} data-block="final-cta-split-form-hint" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 md:gap-12 md:px-8 md:py-24 in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
        <ul aria-label={copy.channelsLabel} className="flex flex-col border-t">
          {copy.channels.map((c, i) => {
            const Icon = ICON[c.kind]
            return (
              <li key={i} data-enter="" className="border-b">
                <a href={hrefOf(c.kind, c.value)} className="flex min-h-16 items-center gap-4 py-4 hover:bg-muted focus-visible:-outline-offset-2 md:px-2">
                  <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:size-6">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[1.25rem] leading-[1.3] font-heading">{c.label}</span>
                    {c.kind === "tel" || c.kind === "mail" ? <span className="text-base leading-[1.5] [overflow-wrap:anywhere]">{breakable(c.value)}</span> : null}
                    {c.note ? <span className="text-sm leading-[1.5]">{c.note}</span> : null}
                  </span>
                  <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:size-5">
                    <ArrowRight aria-hidden="true" />
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
