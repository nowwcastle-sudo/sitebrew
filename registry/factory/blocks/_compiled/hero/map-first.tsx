"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { ExternalLink, MapPin } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"
import { kineticType, rise, scrubTimeline, staggerIn } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { MediaImage, MediaPreviewBadge } from "../_shared/hero-media"
import { HeroTexture, RING, useHeroScene, type HeroCommon, type HeroDisplay } from "../_shared/hero-parts"

// 히어로 — 지도 먼저(FV1 Task 5.7, 배치로 대담 — boldMode layout). 전폭 큰 제목 아래 첫 화면의 무게를 **지도**가 가진다: 왼쪽 큰 지도(정적 그림 위에 지점 표지), 오른쪽에 선택한 지점 카드.
// 지도는 외부 지도 SDK 도 iframe 도 쓰지 않는다 — 정적 그림(media — 없으면 도식 격자) 위에 표지를 겹친다(표지 위치는 그림 안 % 좌표 x·y).
// 표지 상호작용(interaction:map-markers): 표지는 이름을 가진 단추의 **목록**(ul)이다 — 키보드로 Tab 이 목록을 차례로 지나고, 표지(또는 탭)를 누르면 그 지점 카드가 오른쪽에 열린다
// (aria-expanded · aria-controls · 카드는 aria-live=polite 로 바뀐 내용을 읽어 준다). 처음에는 첫 지점 카드가 열려 있다 — 주소·전화가 눌러 보기 전에도 보인다.
// 모션: 등장 제목 낱말이 올라온다 → 표지가 떨어지듯 하나씩 앉는다 → 카드. 스크롤 지도가 살짝 가라앉는다. 동작 줄이기(prefers-reduced-motion)·M0 은 장면(useHeroScene)이 서지 않아 모두 정지 — 표지·카드는 그대로 쓸 수 있다.
export type MapBranch = {
  id: string
  name: string
  address: string
  // 지도 그림 안 위치(0~100, 왼쪽 위가 0·0)
  x: number
  y: number
  phone?: string
  hours?: string
  // 길찾기·지도 앱 링크(https)
  href?: string
}
export type HeroMapFirstCopy = {
  label: string
  title: string
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  mapLabel: string
  listLabel: string
  addressLabel: string
  hoursLabel: string
  phoneLabel: string
  mapLinkLabel: string
  branches: MapBranch[]
}
export type HeroMapFirstProps = BlockBase<HeroMapFirstCopy> & HeroCommon & HeroDisplay & { media?: ImageSlot }

const DEFAULT_TECHNIQUES = ["kinetic-type", "stagger-in"]

export function HeroMapFirst({ copy, locale, id = "hero", className, media, techniques = DEFAULT_TECHNIQUES, header, texture, display: Display }: HeroMapFirstProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const cardId = React.useId()
  const [picked, setPicked] = React.useState(0)
  const branches = copy.branches
  const sel = Math.min(picked, Math.max(branches.length - 1, 0))
  const open = branches[sel]
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장 ──
    kineticType(s, q(".mf-title"), { mode: "rise", by: "words", at: 0 })
    staggerIn(s, s.q(".mf-pin"), { at: 0.45, y: -14 })
    rise(s, q(".mf-card"), { at: 0.7, y: 14 })
    // ── 스크롤: 지도가 살짝 가라앉는다 ──
    const tl = scrubTimeline(s)
    tl.to(q(".mf-map-k"), { yPercent: 4 * s.scale.depth }, 0)
  })
  const titleBody = <SplitSource label={copy.title}>{copy.title}</SplitSource>
  return (
    <div ref={ref} id={id} data-block="hero-map-first" data-hero="map-first" className={cn("[&_.hero-first]:[min-height:calc(100svh_-_var(--hero-top)_-_4.5rem)] [&_.hero-mask]:[display:inline-block] [&_.hero-mask]:[overflow:clip] [&_.hero-mask]:[padding-block:0.12em] [&_.hero-mask]:[margin-block:-0.12em] [&_.hero-mask]:[vertical-align:bottom] [&_.hero-ch]:[display:inline-block] [&_[data-paused]]:[animation-play-state:paused]! [&_[data-paused]_*]:[animation-play-state:paused]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::after]:[animation:none]! motion-reduce:[&_*::after]:[transition:none]! has-[>[data-hero-texture]]:relative has-[>[data-hero-texture]]:isolate relative isolate [--hero-top:4rem]", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="flex flex-col gap-8 px-5 py-10 md:px-10 md:py-14 hero-first">
        {Display ? (
          <Display as="h1" className="text-balance mf-title">
            {titleBody}
          </Display>
        ) : (
          <h1 className="text-[clamp(2.75rem,8vw,7.5rem)] leading-[0.95] tracking-[-0.03em] text-balance mf-title font-heading">{titleBody}</h1>
        )}
        <div data-enter="keep" className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {copy.lede ? <p className="max-w-[36rem] text-lg leading-[1.6]">{copy.lede}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />}>
              {copy.primaryCta.label}
            </Button>
            {copy.secondaryCta ? (
              <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />}>
                {copy.secondaryCta.label}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* 지도: 정적 그림(없으면 도식 격자) 위에 지점 표지 목록. 그림 자체는 지도 한 장이라 표지 목록이 상호작용의 전부다. */}
          <div role="group" aria-label={copy.mapLabel} className="relative aspect-[4/3] overflow-clip rounded-xl bg-muted shadow-(--wf-shadow-surface) lg:col-span-8 lg:aspect-[16/10]">
            <div className="size-full mf-map-k">
              <div data-enter="keep" className="absolute inset-0 [&_picture]:block [&_picture]:size-full">
                {media ? (
                  <MediaImage locale={locale} m={media} sizes="(min-width: 1024px) 66vw, 100vw" priority badge={false} />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 100 60" preserveAspectRatio="none" className="size-full text-muted-foreground/40">
                    <g fill="none" stroke="currentColor" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
                      {[15, 30, 45].map((y) => (
                        <path key={`h${y}`} d={`M0 ${y} H100`} vectorEffect="non-scaling-stroke" />
                      ))}
                      {[20, 40, 60, 80].map((x) => (
                        <path key={`v${x}`} d={`M${x} 0 V60`} vectorEffect="non-scaling-stroke" />
                      ))}
                      <path d="M0 42 C 22 30, 38 52, 66 38 S 94 20, 100 24" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </g>
                  </svg>
                )}
              </div>
              <ul data-enter="keep" aria-label={copy.listLabel} className="absolute inset-0 m-0 list-none p-0">
                {branches.map((b, i) => (
                  <li key={b.id} style={{ insetInlineStart: `${b.x}%`, top: `${b.y}%` }} className="absolute -translate-x-1/2 -translate-y-full">
                    <button type="button" data-map-pin="" aria-expanded={i === sel} aria-controls={cardId} onClick={() => setPicked(i)} className={cn("inline-flex size-11 items-center justify-center rounded-full bg-foreground text-background shadow-(--wf-shadow-surface) outline-hidden [transition:transform_var(--duration-hover)_var(--ease-standard)] aria-expanded:scale-110 aria-expanded:bg-primary aria-expanded:text-primary-foreground mf-pin", RING)}>
                      <MapPin aria-hidden="true" className="size-5" />
                      <span className="sr-only">{b.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <MediaPreviewBadge m={media} />
          </div>
          <div id={cardId} aria-live="polite" data-enter="keep" className="flex flex-col gap-5 rounded-xl border border-border bg-background p-6 text-foreground shadow-(--wf-shadow-surface) lg:col-span-4 mf-card">
            {open ? (
              <>
                <p className="text-2xl leading-tight font-heading">{open.name}</p>
                <dl className="grid gap-3 [&_dt]:text-sm [&_dt]:text-muted-foreground [&_dd]:text-base">
                  <div>
                    <dt>{copy.addressLabel}</dt>
                    <dd>{open.address}</dd>
                  </div>
                  {open.hours ? (
                    <div>
                      <dt>{copy.hoursLabel}</dt>
                      <dd data-numeric="">{open.hours}</dd>
                    </div>
                  ) : null}
                  {open.phone ? (
                    <div>
                      <dt>{copy.phoneLabel}</dt>
                      <dd data-numeric="">
                        <a href={`tel:${normalizePhone(open.phone) ?? open.phone.replace(/[^\d+]/g, "")}`} className={cn("underline underline-offset-4 outline-hidden", RING)}>
                          {open.phone}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {open.href ? (
                  <Button size="lg" variant="outline" nativeButton={false} render={<a href={open.href} />} className="self-start">
                    {copy.mapLinkLabel}
                    <ExternalLink aria-hidden="true" data-icon="inline-end" />
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
