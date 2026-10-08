"use client"

import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Calendar, Download, File, Home, MapPin, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { parallax, pointerDepth, rise, scrubTimeline, splitReveal, svgDraw } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 십자 기준선 4분면 + 교차점 표식(P3-1 r6 B 구성 승격, 공공 원형). 1px 기준선 두 개(세로 50% · 가로 44%)가 첫 화면을 넷으로 나누고 교차점에 「+」.
// 좌상: 처리 현황 면(faces[0]) · 우상: 점 격자 원 위 신청 단계 판 · 좌하: 제목(h1) · 설명 · 버튼 둘 · 우하: 「자주 찾는 서비스」 여섯 칸(면, 누르는 칸 —
// §21-8 첫 화면 안). 수치·접수번호는 본문 서체 tabular-nums. 넓은 화면(1024 이상)에서만 네 칸 격자와 기준선, 좁은 화면은 차례로 쌓인다.
// 모션(기본 기법 view-transition·svg-draw — M1, 공공 원형이라 차분하고 빠르게 약 1.1초):
//   등장  기준선 두 개가 가운데서 그어지고 → 「+」가 돌아 앉는다 → 대각 두 면이 교차점에서 바깥으로 열린다(서비스 면은 자르지 않고 조금 커지며 —
//         누르는 칸은 첫 프레임부터 보이고 눌린다, data-enter="keep") → 제목 줄 → 단계 판이 앉고 연결선을 현재 단계까지 긋고 지나온 점이 칠해지고
//         현재 점 둘레에 인장선을 한 번 긋는다 → 설명·현황 → 버튼. (머리를 header 로 넘기면 머리의 .cq-vline 도 같이 그어진다.)
//   스크롤 「+」가 4분의 1 바퀴, 원은 멀리·판은 가깝게. 포인터 원은 포인터 쪽으로, 판은 반대로 조금.
type IconName = "file" | "home" | "calendar" | "user" | "map" | "download"
const ICONS = { file: File, home: Home, calendar: Calendar, user: User, map: MapPin, download: Download } as const
export type HeroCrosshairQuadrantsCopy = {
  label: string
  title: string
  titleLines?: string[]
  lede?: string
  primaryCta: Cta
  secondaryCta?: Cta
  stats: { caption: string; items: { term: string; value: string; unit: string }[] }
  receipt: { label: string; number: string; status: string; steps: { name: string; date: string }[]; current: number }
  services: { label: string; items: { label: string; href: string; icon: IconName }[] }
}
export type HeroCrosshairQuadrantsProps = BlockBase<HeroCrosshairQuadrantsCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["view-transition", "svg-draw"]

export function HeroCrosshairQuadrants({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroCrosshairQuadrantsProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const draw = techniques.includes("svg-draw")
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  const cur = copy.receipt.current
  // 연결선은 지금 단계 점까지(단계가 하나면 긋지 않는다).
  const progress = copy.receipt.steps.length > 1 ? (300 * cur) / (copy.receipt.steps.length - 1) : 0
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // ── 등장(M1: 약 1.1초) ──
    const line = s.t.enter * (4 / 3)
    s.tl.from(q(".cq-hline"), { scaleX: 0, transformOrigin: "50% 50%", duration: line, ease: s.t.ease.inScreen, clearProps: "transform" }, 0)
    s.tl.from(s.q(".cq-vline"), { scaleY: 0, transformOrigin: "50% 0%", duration: line * 0.6, ease: s.t.ease.inScreen, stagger: line * 0.5, clearProps: "transform" }, 0)
    // 「+」: 등장은 안쪽 g, 스크롤 4분의 1 바퀴는 바깥 svg — 한 요소의 transform 을 두 트윈이 함께 쓰지 않는다.
    s.tl.from(q(".cq-plus-in"), { rotation: -90, scale: 0.6, autoAlpha: 0, svgOrigin: "7 7", duration: s.t.enter, ease: s.t.ease.standard, clearProps: "opacity,visibility" }, line * 0.8)
    // 대각 두 면: 교차점 쪽 모서리에서 바깥으로 열린다.
    s.tl.fromTo(q(".cq-stat-face"), { clipPath: "inset(100% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: s.t.enter * 1.6, ease: s.t.ease.inScreen, clearProps: "clipPath" }, 0.18)
    // 서비스 면(누르는 칸을 담는다): 자르지 않고 교차점 모서리(왼쪽 위)에서 조금 커지며 앉는다 — 처음부터 보이고 눌린다.
    s.tl.from(q(".cq-fav-face"), { scale: 0.96, transformOrigin: "0% 0%", duration: s.t.enter * 1.6, ease: s.t.ease.inScreen, clearProps: "transform" }, 0.22)
    splitReveal(s, "h1", { type: "lines", at: 0.08, stagger: 0.1 })
    s.tl.from(q(".cq-dots"), { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%", duration: s.t.enter * 2, ease: s.t.ease.standard, clearProps: "opacity,visibility,transform" }, 0.1)
    rise(s, ".cq-steps", { at: 0.2, y: 14 })
    if (draw) svgDraw(s, s.q(".cq-progress path"), { at: 0.4, duration: line, ease: s.t.ease.inScreen })
    // 지나온 단계 점: 판 바탕색에서 주색으로(하나씩) — 연결선이 그 점에 닿을 무렵.
    const card = q(".cq-steps")
    if (card) s.tl.from(s.q(".cq-dot-on"), { backgroundColor: getComputedStyle(card).backgroundColor, duration: s.t.hover, ease: s.t.ease.standard, stagger: line * 0.55, clearProps: "backgroundColor" }, 0.4)
    // 인장선: 연결선이 지금 단계에 닿은 뒤 한 번(svg-draw 기법의 연장, 반복 없음).
    if (draw) svgDraw(s, s.q(".cq-seal circle"), { at: 0.4 + line * 0.7, duration: s.t.enter * 1.1, ease: s.t.ease.standard })
    if (q(".cq-lede")) rise(s, ".cq-lede", { at: 0.3, y: 10 })
    rise(s, s.q(".cq-stat > div"), { at: 0.36, y: 10, stagger: 0.06 })
    // 누르는 것: 투명도·visibility 없이 transform 만(보이는 자리에서 내려앉는다).
    s.tl.from(s.q(".cq-fav-face li"), { y: 8 * s.scale.distance, duration: s.t.enter, stagger: 0.03 * s.scale.stagger, clearProps: "transform" }, 0.42)
    s.tl.from(s.q(".cq-ctas > *"), { y: 10 * s.scale.distance, duration: s.t.enter, stagger: 0.06 * s.scale.stagger, clearProps: "transform" }, 0.72)

    // ── 스크롤: 「+」가 4분의 1 바퀴, 원은 멀리·판은 가깝게 ──
    scrubTimeline(s).to(q(".cq-plus"), { rotation: 90, transformOrigin: "50% 50%" }, 0)
    parallax(s, [{ el: q(".cq-dots-s"), y: 36 }, { el: q(".cq-steps-s"), y: -14 }])

    // ── 포인터: 원은 포인터 쪽으로, 판은 반대로 조금 ──
    pointerDepth(s, q(".cq-quad"), [{ el: q(".cq-dots-p"), x: 22, y: 16 }, { el: q(".cq-steps-p"), x: -8, y: -6 }], { damping: 0.7 })
  })
  return (
    <div ref={ref} id={id} data-block="hero-crosshair-quadrants" data-hero="crosshair-quadrants" className={cn("cn-block-hero-root cn-block-hero-crosshair-quadrants", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section id={`${id}-main`} aria-label={copy.label} className="cn-block-hero-crosshair-quadrants-first hero-first">
        <span aria-hidden="true" data-enter="" className="cn-block-hero-crosshair-quadrants-cq-vline-2 cq-vline" />
        <span aria-hidden="true" data-enter="" className="cn-block-hero-crosshair-quadrants-cq-hline cq-hline" />
        <svg aria-hidden="true" data-enter="" viewBox="0 0 14 14" className="cn-block-hero-crosshair-quadrants-cq-plus cq-plus">
          <g className="cq-plus-in">
            <path d="M7 0V14M0 7H14" stroke="currentColor" strokeWidth="2" />
          </g>
        </svg>

        {/* 좌상: 처리 현황 면 — 우하 서비스 면과 대각으로 짝을 이뤄 기준선 네 칸을 색으로 읽히게 한다. 수치는 본문 서체 tabular-nums. */}
        <Face k={k} fallback="bg-muted" enter="keep" className="cn-block-hero-crosshair-quadrants-cq-stat-face cq-stat-face">
          <p className="cn-block-hero-crosshair-quadrants-text">{copy.stats.caption}</p>
          <dl className="cn-block-hero-crosshair-quadrants-cq-stat cq-stat">
            {copy.stats.items.map((x) => (
              <div key={x.term}>
                <dt className="cn-block-hero-crosshair-quadrants-dt">{x.term}</dt>
                <dd data-numeric="" className="cn-block-hero-crosshair-quadrants-dd">
                  {x.value}
                  <span className="cn-block-hero-crosshair-quadrants-span-4">{x.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Face>

        {/* 우상: 점 격자 원형 면 + 신청 단계 판. 겹 요소(-s 스크롤 · -p 포인터 · 안쪽 등장)가 transform 을 나눠 쓴다. */}
        <div data-wf-art="" className="cn-block-hero-crosshair-quadrants-cq-quad cq-quad">
          <span aria-hidden="true" className="cn-block-hero-crosshair-quadrants-cq-dots-s cq-dots-s">
            <span className="cn-block-hero-crosshair-quadrants-cq-dots-p cq-dots-p">
              <span data-enter="" className="cn-block-hero-crosshair-quadrants-cq-dots cq-dots" />
            </span>
          </span>
          <div className="cn-block-hero-crosshair-quadrants-cq-steps-s cq-steps-s">
            <div className="cq-steps-p">
              <div data-enter="keep" className="cn-block-hero-crosshair-quadrants-cq-steps cq-steps">
                <p className="cn-block-hero-crosshair-quadrants-text-2">
                  {copy.receipt.label} <span data-numeric="" className="cn-block-hero-crosshair-quadrants-span-6">{copy.receipt.number}</span>
                </p>
                <p className="cn-block-hero-crosshair-quadrants-text-3">{copy.receipt.status}</p>
                <div className="cn-block-hero-crosshair-quadrants-box">
                  <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" className="cn-block-hero-crosshair-quadrants-svg-2">
                    <path d="M0 6H300" stroke="var(--border)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" className="cn-block-hero-crosshair-quadrants-cq-progress cq-progress">
                    <path pathLength={1} d={`M0 6H${progress}`} stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <ol className="cn-block-hero-crosshair-quadrants-list-2">
                    {copy.receipt.steps.map((st, i) => (
                      <li key={st.name} aria-current={i === cur ? "step" : undefined} className="cn-block-hero-crosshair-quadrants-item">
                        <span className="cn-block-hero-crosshair-quadrants-span-7">
                          <span aria-hidden="true" className={cn("cn-block-hero-crosshair-quadrants-span-8", i <= cur ? "cq-dot-on border-primary bg-primary" : "border-border bg-background")} />
                          {/* 지금 단계 점 둘레 인장선 — 연결선이 닿을 무렵 한 번 그린다(반복하지 않는다). */}
                          {i === cur ? (
                            <svg aria-hidden="true" viewBox="0 0 28 28" className="cn-block-hero-crosshair-quadrants-cq-seal cq-seal">
                              <circle pathLength={1} cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="cn-block-hero-crosshair-quadrants-span-9">{st.name}</span>
                        <span className="cn-block-hero-crosshair-quadrants-span-10">{st.date}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 좌하: 제목 · 설명 · 버튼 */}
        <div className="cn-block-hero-crosshair-quadrants-box-2">
          <h1 className="cn-block-hero-crosshair-quadrants-title font-heading">
            <SplitSource label={copy.title}>
              {lines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {l}
                </React.Fragment>
              ))}
            </SplitSource>
          </h1>
          {copy.lede ? (
            <p data-enter="keep" className="cn-block-hero-crosshair-quadrants-cq-lede cq-lede">
              {copy.lede}
            </p>
          ) : null}
          <div data-enter="keep" className="cn-block-hero-crosshair-quadrants-cq-ctas cq-ctas">
            <Button size="lg" nativeButton={false} render={<a href={copy.primaryCta.href} />} className="cn-block-hero-crosshair-quadrants-button">
              {copy.primaryCta.label}
            </Button>
            {copy.secondaryCta ? (
              <Button size="lg" variant="outline" nativeButton={false} render={<a href={copy.secondaryCta.href} />} className="cn-block-hero-crosshair-quadrants-button">
                {copy.secondaryCta.label}
              </Button>
            ) : null}
          </div>
        </div>

        {/* 우하: 자주 찾는 서비스 — 면(§21-8 바로가기 칸). 칸 선·아이콘·hover 는 면 스코프 토큰이 면의 짝으로 바꾼다. */}
        <Face k={k} fallback="" as="nav" label={copy.services.label} enter="keep" className="cn-block-hero-crosshair-quadrants-cq-fav-face cq-fav-face">
          <h2 id={`${id}-fav`} className="cn-block-hero-crosshair-quadrants-heading font-heading-ko">
            {copy.services.label}
          </h2>
          <ul className="cn-block-hero-crosshair-quadrants-list-3">
            {copy.services.items.map(({ label, href, icon }) => {
              const I = ICONS[icon]
              return (
                <li key={label} className="cn-block-hero-crosshair-quadrants-item-2">
                  <a href={href} className={cn("cn-block-hero-crosshair-quadrants-cq-tile cq-tile", RING)}>
                    <I aria-hidden="true" className="cn-block-hero-crosshair-quadrants-i" />
                    <span className="cn-block-hero-crosshair-quadrants-span-11">
                      {label}
                      <ArrowRight aria-hidden="true" className="cn-block-hero-crosshair-quadrants-cq-arrow cq-arrow" />
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </Face>
      </section>
    </div>
  )
}
