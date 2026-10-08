"use client"

import * as React from "react"
import { gsap } from "gsap"
import { CustomEase } from "gsap/CustomEase"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ArrowRight, Bell, Clock, Eye, Filter, Search, User } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, parallax, rise, splitReveal } from "@/registry/factory/motion/gsap-techniques"
import { SplitSource } from "@/registry/factory/motion/split-source"
import { usePauseOffscreen } from "@/registry/factory/motion/use-pause-offscreen"
import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"
import { Badge } from "@/registry/factory/ui/badge"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창(P3-1 r10 B 구성 승격). 위 면 띠(faces[0]) 위에 두 줄 제목(h1)과 같은 기준선의
// 설명·새 소식 링크, 그 띠 아래 끝에 걸쳐 올라오는 앱 창(작업 공간 머리 · 옆 메뉴 · 알림 목록 · 상세 — 알림 행을 누르면 제목이 상세로 날아간다).
// 모션(기본 기법 view-transition·svg-draw — M1 세 겹):
//   등장  면 띠가 위에서 열리고 제목 줄이 올라온다 → 설명 → 앱 창이 기울어진 채 들려 올라와 앉는다 → 창 머리가 열리고 옆 메뉴·알림 행이 정착 → 상세·새 소식.
//         첫 화면에서 1.4초 뒤 한 번 스스로 둘째 알림을 고른다(동작 줄이기·화면 밖·숨은 탭에서는 기다린다, 사람이 먼저 고르면 하지 않는다).
//   스크롤 앱 창이 면 띠 위로 들리고 제목 칸은 조금 늦게. 포인터 알림 목록 뒤 강조 띠가 커서의 세로 위치를 따라간다(마우스만).
//   알림을 고르면 View Transitions 로 행 제목이 상세 제목 자리로 날아간다(기법 view-transition · 동작 줄이기가 아닐 때만, 길이는 레시피 --duration-enter).
type Icon = "bell" | "user" | "eye" | "filter" | "clock"
const ICONS = { bell: Bell, user: User, eye: Eye, filter: Filter, clock: Clock } as const
export type HeroBaselineNewsAppWindowCopy = {
  label: string
  title: string
  titleLines?: string[]
  lede?: string
  news: { badge: string; label: string; href: string }
  workspace: { name: string; count: string; shortcut: string; menuLabel: string; teamsLabel: string; listLabel: string; trendLabel: string }
  menu: { label: string; href: string; icon: Icon; count?: number }[]
  teams: { label: string; href: string }[]
  rows: { id: string; title: string; status: string; urgent?: boolean; time: string; owner: string; since: string; impact: string }[]
  detailTerms: { owner: string; since: string; impact: string }
  // 상세 칸의 두 단추(창 안 예시 조작).
  detailActions: [string, string]
}
export type HeroBaselineNewsAppWindowProps = BlockBase<HeroBaselineNewsAppWindowCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["view-transition", "svg-draw"]
const VT = "hero-vt-title"
type ViewTransition = { ready?: Promise<unknown> }
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => ViewTransition }

export function HeroBaselineNewsAppWindow({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroBaselineNewsAppWindowProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [sel, setSel] = React.useState(0)
  // 날아가는 중인 행(이 행 제목에만 이름이 붙는다 — 같은 이름이 두 곳에 있으면 전환이 취소된다).
  const [moving, setMoving] = React.useState<number | null>(null)
  const vt = techniques.includes("view-transition")
  const selRef = React.useRef(sel)
  React.useEffect(() => {
    selRef.current = sel
  }, [sel])
  // 커밋 기다리기: 상태를 바꾼 뒤 DOM 이 바뀐 다음에 풀리는 약속(전환의 옛 모습·새 모습을 잡는 때를 맞춘다).
  const commitWaiters = React.useRef<(() => void)[]>([])
  React.useLayoutEffect(() => {
    for (const f of commitWaiters.current.splice(0)) f()
  })
  const afterCommit = () => new Promise<void>((r) => commitWaiters.current.push(r))
  const pick = React.useCallback(
    async (i: number) => {
      if (i === selRef.current) return
      const doc = document as ViewTransitionDoc
      if (!vt || !doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSel(i)
        return
      }
      setMoving(i)
      await afterCommit()
      const t = doc.startViewTransition(() => {
        setSel(i)
        setMoving(null)
        return afterCommit()
      })
      // 날아가는 제목의 길이·곡선: 레시피 --duration-enter · 관측 곡선(전환 의사 요소는 문서에 있어 클래스로 닿지 않는다 — 애니메이션을 직접 고친다).
      const ms = parseFloat(getComputedStyle(ref.current ?? document.documentElement).getPropertyValue("--duration-enter")) || 300
      t.ready?.then(() => {
        for (const a of document.getAnimations()) {
          const e = a.effect as KeyframeEffect | null
          if (e?.pseudoElement === `::view-transition-group(${VT})`) e.updateTiming({ duration: ms, easing: "cubic-bezier(0.32, 0.72, 0, 1)" })
        }
      })
    },
    [vt],
  )
  // 첫 화면에서 한 번 스스로 고른다. 동작 줄이기에서는 고르지 않고, 앱 창이 화면 밖이거나 탭이 숨었으면 기다렸다가 다시 보일 때 1.4초를 새로 센다.
  const windowRef = React.useRef<HTMLDivElement>(null)
  const offscreen = usePauseOffscreen(windowRef)
  const reduced = useReducedMotion()
  const [autoDone, setAutoDone] = React.useState(false)
  React.useEffect(() => {
    if (autoDone || reduced || offscreen) return
    const t = window.setTimeout(() => {
      setAutoDone(true)
      if (selRef.current === 0 && copy.rows.length > 1) void pick(1)
    }, 1400)
    return () => window.clearTimeout(t)
  }, [pick, autoDone, reduced, offscreen, copy.rows.length])
  const cur = copy.rows[sel] ?? copy.rows[0]
  const k = faceAt(faces, 0)
  const lines = copy.titleLines?.length ? copy.titleLines : [copy.title]
  useHeroScene(ref, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    // 앱 창 들기 곡선: DNA 관측값(목록 → 상세 전환과 같은 곡선).
    const sheet = CustomEase.create("hero-bnw-sheet", "0.32,0.72,0,1")
    // ── 등장(M1: 약 1.2초) ──
    s.tl.fromTo(q(".bnw-face"), { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: s.t.enter * 1.5, ease: s.t.ease.inScreen, clearProps: "clipPath" }, 0)
    splitReveal(s, "h1", { type: "lines", at: 0.06, stagger: 0.09 })
    if (q(".bnw-lede")) rise(s, ".bnw-lede", { at: 0.28, y: 10 })
    s.tl.from(q(".bnw-window"), { y: 90 * s.scale.distance, rotationX: 14, transformPerspective: 1600, transformOrigin: "50% 0%", autoAlpha: 0, duration: s.t.enter * 2.4, ease: sheet, clearProps: "transform,opacity,visibility" }, 0.3)
    clipReveal(s, ".bnw-bar", { from: "left", at: 0.55, duration: s.t.enter * 1.4, ease: s.t.ease.standard })
    s.tl.from(s.q(".bnw-side > *"), { x: -6, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.025, clearProps: "transform,opacity,visibility" }, 0.6)
    // 알림 행 8px 정착은 앱 창 등장의 일부다 — 값·선·표 칸은 제자리에서 바뀌지 않는다.
    s.tl.from(s.q(".bnw-list > li"), { y: 8, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.standard, stagger: 0.04, clearProps: "transform,opacity,visibility" }, 0.6)
    rise(s, ".bnw-detail", { at: 0.75, y: 8 })
    rise(s, ".bnw-news", { at: 0.85, y: 8 })

    // ── 스크롤: 앱 창이 면 띠 위로 들리고, 제목 칸은 조금 늦게 ──
    parallax(s, [{ el: q(".bnw-window-s"), y: -40 }, { el: q(".bnw-copy"), y: 8 }])

    // ── 포인터: 알림 목록 뒤 층의 강조 띠가 커서의 세로 위치를 따라간다(마우스만 — 포인터 겹). 띠는 행들 뒤라 글자를 덮지 않는다. ──
    const wrap = q(".bnw-list-wrap")
    const glow = q(".bnw-cursor-glow")
    if (wrap && glow) {
      s.pointer((ps) => {
        const qy = gsap.quickTo(glow, "y", { duration: 0.18, ease: "power3.out" })
        const move = (e: PointerEvent) => {
          const b = wrap.getBoundingClientRect()
          const h = glow.offsetHeight
          // 띠 가운데가 커서에 온다 — 첫 행·끝 행 가운데(띠 높이의 1/4 안쪽)에서 멈춘다.
          qy(Math.max(-h / 4, Math.min(b.height - (h * 3) / 4, e.clientY - b.top - h / 2)))
        }
        const enter = () => ps.add(() => gsap.to(glow, { autoAlpha: 1, duration: ps.t.hover }))
        const leave = () => ps.add(() => gsap.to(glow, { autoAlpha: 0, duration: ps.t.hover }))
        listen(ps, wrap, { pointermove: move, pointerenter: enter, pointerleave: leave })
      })
    }
  })
  return (
    <div ref={ref} id={id} data-block="hero-baseline-news-app-window" data-hero="baseline-news-app-window" className={cn("cn-block-hero-root cn-block-hero-baseline-news-app-window", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-baseline-news-app-window-h-first hero-first">
        {/* 면 띠: 제목·새 소식이 면 위에 서고, 앱 창이 띠 아래 끝에 걸쳐 올라온다. */}
        <Face k={k} fallback="" enter="keep" className="cn-block-hero-baseline-news-app-window-bnw-face bnw-face">
          <div className="cn-block-hero-baseline-news-app-window-bnw-copy bnw-copy">
            <h1 className="cn-block-hero-baseline-news-app-window-title font-heading">
              <SplitSource label={copy.title}>
                {lines.map((l, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {l}
                  </React.Fragment>
                ))}
              </SplitSource>
            </h1>
            <div className="cn-block-hero-baseline-news-app-window-box-2">
              {copy.lede ? <p className="cn-block-hero-baseline-news-app-window-bnw-lede bnw-lede">{copy.lede}</p> : null}
              <a href={copy.news.href} className={cn("cn-block-hero-baseline-news-app-window-bnw-news bnw-news", RING)}>
                <b>{copy.news.badge}</b>
                <span className="cn-block-hero-baseline-news-app-window-span-2">{copy.news.label}</span>
                <ArrowRight aria-hidden="true" className="cn-block-hero-baseline-news-app-window-arrow-right" />
              </a>
            </div>
          </div>
        </Face>

        {/* 앱 창 겹: .bnw-window-s(자리·스크롤 들기) → .bnw-window(등장·모양). */}
        <div ref={windowRef} data-wf-art="" className="cn-block-hero-baseline-news-app-window-bnw-window-s bnw-window-s">
          <div data-enter="keep" className="cn-block-hero-baseline-news-app-window-bnw-window bnw-window">
            <div className="cn-block-hero-baseline-news-app-window-bnw-bar bnw-bar">
              <span className="cn-block-hero-baseline-news-app-window-span-3">{copy.workspace.name}</span>
              <span className="cn-block-hero-baseline-news-app-window-span-4">{copy.workspace.count}</span>
              <span data-numeric="" className="cn-block-hero-baseline-news-app-window-span-5">
                <Search aria-hidden="true" className="cn-block-hero-baseline-news-app-window-search" /> {copy.workspace.shortcut}
              </span>
            </div>
            <div className="cn-block-hero-baseline-news-app-window-box-3">
              <nav aria-label={copy.workspace.menuLabel} className="cn-block-hero-baseline-news-app-window-bnw-side bnw-side">
                {copy.menu.map(({ label, href, icon, count }, i) => {
                  const I = ICONS[icon]
                  return (
                    <a key={label} href={href} aria-current={i === 0 ? "page" : undefined} className={cn("cn-block-hero-baseline-news-app-window-link-4", RING)}>
                      <I aria-hidden="true" className="cn-block-hero-baseline-news-app-window-i" />
                      {label}
                      {count ? <span className="cn-block-hero-baseline-news-app-window-span-6">{count}</span> : null}
                    </a>
                  )
                })}
                <p className="cn-block-hero-baseline-news-app-window-text">{copy.workspace.teamsLabel}</p>
                {copy.teams.map((t) => (
                  <a key={t.label} href={t.href} className={cn("cn-block-hero-baseline-news-app-window-link-5", RING)}>
                    <span aria-hidden="true" className="cn-block-hero-baseline-news-app-window-span-7" />
                    {t.label}
                  </a>
                ))}
              </nav>
              <div className="cn-block-hero-baseline-news-app-window-bnw-list-wrap bnw-list-wrap">
                {/* 커서를 따르는 행 강조: 행들 뒤의 층 하나(마우스만, 데이터는 건드리지 않는다). */}
                <div aria-hidden="true" className="cn-block-hero-baseline-news-app-window-bnw-cursor-glow bnw-cursor-glow" />
                <ul aria-label={copy.workspace.listLabel} className="cn-block-hero-baseline-news-app-window-bnw-list bnw-list">
                  {copy.rows.map((x, i) => (
                    <li key={x.id} className="cn-block-hero-baseline-news-app-window-item">
                      <button type="button" aria-pressed={sel === i} onClick={() => void pick(i)} className={cn("cn-block-hero-baseline-news-app-window-bnw-row bnw-row", RING)}>
                        <span data-numeric="" className="cn-block-hero-baseline-news-app-window-span-8">
                          {x.id}
                        </span>
                        <span className="cn-block-hero-baseline-news-app-window-span-9" style={{ viewTransitionName: moving === i ? VT : undefined }}>
                          {x.title}
                        </span>
                        <span className="cn-block-hero-baseline-news-app-window-span-10">
                          <Badge variant={x.urgent ? "default" : "outline"}>{x.status}</Badge>
                          <span className="cn-block-hero-baseline-news-app-window-span-11">{x.time}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {cur ? (
                <div className="cn-block-hero-baseline-news-app-window-bnw-detail bnw-detail">
                  <p data-numeric="" className="cn-block-hero-baseline-news-app-window-text-2">
                    {cur.id}
                  </p>
                  <p className="cn-block-hero-baseline-news-app-window-text-3" style={{ viewTransitionName: moving === null ? VT : undefined }}>
                    {cur.title}
                  </p>
                  <svg viewBox="0 0 300 80" role="img" aria-label={copy.workspace.trendLabel} className="cn-block-hero-baseline-news-app-window-svg-2">
                    <path pathLength={1} d="M0 64 L30 60 L60 62 L90 50 L120 54 L150 40 L180 44 L210 22 L240 30 L270 14 L300 18" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <dl className="cn-block-hero-baseline-news-app-window-dl">
                    <div>
                      <dt className="cn-block-hero-baseline-news-app-window-dt">{copy.detailTerms.owner}</dt>
                      <dd className="cn-block-hero-baseline-news-app-window-dd">{cur.owner}</dd>
                    </div>
                    <div>
                      <dt className="cn-block-hero-baseline-news-app-window-dt">{copy.detailTerms.since}</dt>
                      <dd data-numeric="" className="cn-block-hero-baseline-news-app-window-dd-2">
                        {cur.since}
                      </dd>
                    </div>
                    <div>
                      <dt className="cn-block-hero-baseline-news-app-window-dt">{copy.detailTerms.impact}</dt>
                      <dd className="cn-block-hero-baseline-news-app-window-dd">{cur.impact}</dd>
                    </div>
                  </dl>
                  <div className="cn-block-hero-baseline-news-app-window-box-4">
                    <Button size="sm">{copy.detailActions[0]}</Button>
                    <Button size="sm" variant="outline">
                      {copy.detailActions[1]}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
