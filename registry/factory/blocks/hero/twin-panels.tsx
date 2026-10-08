"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase, ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, parallax, rise } from "@/registry/factory/motion/gsap-techniques"
import { tiltAngles } from "@/registry/factory/motion/motion-scale"
import type { Scene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { Face, faceAt, HeroTexture, reseed, useHeroScene, type HeroCommon } from "../_shared/hero-parts"
import { MediaImage } from "../_shared/hero-media"

// 히어로 — 나란한 큰 칸 두 장 + 칸 밑 캡션(P3-1 r3 B 구성 승격). 12칸 격자 전체 폭을 칸 두 장(각 6칸, 높이 78vh, 간격 8px, 반경 0)으로 채운다.
// 왼쪽 칸 faces[2], 오른쪽 칸 faces[1] 위에 상품 사진(media 두 장, 선택)을 종이처럼 올리고, 칸 밑 왼쪽에 캡션 한 줄. 제목(h1)은 읽기 도구에만.
// 모션(기본 기법 grain·clip-reveal — M2 세 겹):
//   등장  두 칸이 아래에서 위로 차례로 열리고 → 첫 사진이 기울어진 채 떠올라 앉는다 → 둘째 사진이 반대로 기울어 올라와 앉는다 →
//         캡션이 열리고 → 「전부 보기」가 마지막.
//   스크롤 두 사진이 서로 다른 깊이로 떠오르고(둘째가 가깝다) 조금씩 돈다. 포인터 칸 위에서 사진이 포인터를 따라 기울고 들린다(감쇠).
//   그레인은 hover 에 씨앗을 한 번 바꾼다(160ms). 유휴(M2) 두 사진이 숨 쉬듯 아주 조금 뜬다(화면 밖·숨은 탭에서 멈춤).
export type HeroTwinPanelsCopy = {
  label: string
  // 읽기 도구용 제목(화면에는 보이지 않는다 — 칸의 색 면이 첫 화면의 주인).
  title: string
  captions: [string, string]
  // 캡션에 원화 가격이 있을 때 가격 바로 아래 작은 줄(대장 A120) — 「부가세 포함」
  vatNote?: string
  moreNote?: string
  moreCta: Cta
}
export type HeroTwinPanelsProps = BlockBase<HeroTwinPanelsCopy> & HeroCommon & { media?: [ImageSlot, ImageSlot] }

const DEFAULT_TECHNIQUES = ["grain", "clip-reveal"]
// 칸마다 면 번호와 사진 높이(칸에 대한 비).
const PANELS = [
  { face: 2, h: "h-[70%]" },
  { face: 1, h: "h-[62%]" },
] as const

// 칸 위에 놓인 인쇄물 한 장 — 사진의 비로 자리를 잡고(레이아웃 이동 0), 아래로 딱딱한 그림자 한 겹(종이 두께). 첫 화면이라 서둘러 받는다.
function Print({ m, locale }: { m: ImageSlot; locale?: "ko" | "en" }) {
  return (
    <div className="cn-block-hero-twin-panels-print print" style={{ aspectRatio: `${m.width} / ${m.height}` }}>
      <MediaImage locale={locale} m={m} sizes="(min-width: 768px) 21vw, 40vw" priority />
    </div>
  )
}

// 포인터 기울임 + 들림(감쇠): 칸 위에서 상품 감싼 요소가 기울고 -lift px 떠오른다(포인터 겹 — 마우스일 때만).
function tiltLift(s: Scene, panel: Element, target: HTMLElement, { max = 5, lift = 10 } = {}) {
  s.pointer((ps) => {
    const p = { rx: 0, ry: 0, y: 0 }
    const apply = () => {
      target.style.transform = `perspective(900px) translateY(${p.y.toFixed(2)}px) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg)`
    }
    const q = { rx: gsap.quickTo(p, "rx", { duration: 0.6, ease: "power3.out", onUpdate: apply }), ry: gsap.quickTo(p, "ry", { duration: 0.6, ease: "power3.out", onUpdate: apply }), y: gsap.quickTo(p, "y", { duration: 0.5, ease: "power3.out", onUpdate: apply }) }
    const move = (ev: PointerEvent) => {
      const a = tiltAngles(ev.clientX, ev.clientY, panel.getBoundingClientRect(), max * ps.scale.rotate)
      q.rx(a.rx)
      q.ry(a.ry)
      q.y(-lift * ps.scale.distance)
    }
    listen(ps, panel, {
      pointermove: move,
      pointerleave: () => {
        q.rx(0)
        q.ry(0)
        q.y(0)
      },
    })
    ps.onCleanup(() => {
      target.style.transform = ""
    })
  })
}

export function HeroTwinPanels({ copy, locale, id = "hero", className, media, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroTwinPanelsProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const grain = techniques.includes("grain")
  const clip = techniques.includes("clip-reveal")
  useHeroScene(ref, techniques, (s) => {
    // ── 등장(M2: 약 2.2초) ──
    if (clip) clipReveal(s, s.q(".panel"), { from: "bottom", at: 0, duration: s.t.enter * 1.8, stagger: 0.14, ease: s.t.ease.inScreen })
    const [cal, cards] = s.q(".print")
    if (cal) s.tl.from(cal, { y: 90 * s.scale.distance, rotation: 5 * s.scale.rotate, autoAlpha: 0, duration: s.t.enter * 1.8, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.35)
    if (cards) s.tl.from(cards, { y: 110 * s.scale.distance, rotation: -4 * s.scale.rotate, autoAlpha: 0, duration: s.t.enter * 1.8, ease: s.t.ease.standard, clearProps: "transform,opacity,visibility" }, 0.5)
    clipReveal(s, s.q("figcaption, .more-note"), { from: "left", at: 1.0, duration: s.t.enter * 1.4, stagger: 0.1, ease: s.t.ease.standard })
    rise(s, ".more", { at: 1.35, y: 14 })

    // ── 스크롤: 종이 두께만큼의 시차 ──
    parallax(s, [
      { el: s.q(".depth")[0], y: -40, rotate: -1.5 },
      { el: s.q(".depth")[1], y: -72, rotate: 2 },
    ])

    // ── 포인터: 칸마다 상품이 기울고 들린다 + 그레인 다시 찍힘 ──
    s.q(".panel").forEach((panel) => {
      const t = panel.querySelector<HTMLElement>(".tilt")
      if (t) tiltLift(s, panel, t)
    })
    if (grain) s.pointer((ps) => ps.q(".panel").forEach((panel) => listen(ps, panel, { pointerenter: () => void reseed(panel) })))

    // ── 유휴(M2~M3): 두 사진이 숨 쉬듯 뜬다 ──
    if (cal) s.loop(() => gsap.to(cal, { y: -5 * s.scale.distance, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 }))
    if (cards) s.loop(() => gsap.to(cards, { y: 4 * s.scale.distance, duration: 3.1, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.3 }))
  })
  return (
    <div ref={ref} id={id} data-block="hero-twin-panels" data-hero="twin-panels" className={cn("cn-block-hero-root cn-block-hero-twin-panels", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section data-wf-art="" aria-label={copy.label} className="cn-block-hero-twin-panels-first">
        <h1 className="cn-block-hero-twin-panels-title">{copy.title}</h1>
        {PANELS.map((p, i) => (
          <figure key={i} className="cn-block-hero-twin-panels-figure">
            <Face k={faceAt(faces, p.face)} fallback="bg-muted" enter={clip ? "keep" : undefined} grain={grain} className="cn-block-hero-twin-panels-panel cn-block-hero-grain panel">
              <div data-enter="keep" className={cn("cn-block-hero-twin-panels-depth depth", p.h)}>
                <div className="cn-block-hero-twin-panels-tilt tilt">{media?.[i] ? <Print m={media[i]} locale={locale} /> : null}</div>
              </div>
            </Face>
            <figcaption data-enter="keep" className="cn-block-hero-twin-panels-figcaption">
              {copy.captions[i]}
              {copy.vatNote ? <span className="cn-block-hero-twin-panels-vat">{copy.vatNote}</span> : null}
            </figcaption>
          </figure>
        ))}
        {/* 캡션 줄 바로 아래 오른쪽 끝 알약(첫 화면 안) */}
        <div className="cn-block-hero-twin-panels-box-2">
          {copy.moreNote ? (
            <p data-enter="keep" className="cn-block-hero-twin-panels-more-note more-note">
              {copy.moreNote}
            </p>
          ) : null}
          <span data-enter="keep" className="cn-block-hero-twin-panels-more more">
            <Button variant="outline" nativeButton={false} render={<a href={copy.moreCta.href} />} className="cn-block-hero-twin-panels-button-2">
              {copy.moreCta.label}
            </Button>
          </span>
        </div>
      </section>
    </div>
  )
}
