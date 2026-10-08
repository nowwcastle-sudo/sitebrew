"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { Cta } from "@/registry/factory/content/content-core"
import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { clipReveal, listen, rise, scrubTimeline } from "@/registry/factory/motion/gsap-techniques"

import { Face, faceAt, HeroTexture, RING, useHeroScene, type HeroCommon } from "../_shared/hero-parts"

// 히어로 — 오른쪽 끝에서 잘리는 제목 목록(P3-1 r2 A 구성 승격). 2/12 메타 칸(면 faces[0], 없으면 오른쪽 선 — 라벨/값, 값은 대괄호 링크) +
// 10/12 한 줄 제목 목록(링크, nowrap — 칸이 오른쪽 끝에서 자른다). 제목(h1)은 읽기 도구용.
// 모션(기본 기법 split-text·oversize-crop — M1 세 겹):
//   등장  (머리가 있으면 머리 면 쓸기 · 대괄호 체크 · 머리 버튼) 메타 칸 면이 위에서 내려 칠해진다 → 제목 줄들이 아래에서 올라오며(첫 줄은 글자 단위)
//         → 셋째 줄이 한 번 밀려 잘린 끝을 보여 주고 돌아온다.
//   스크롤 줄마다 다른 속도로 오른쪽 자르는 선 안으로 밀려 잘린 끝이 층층이 어긋난다(줄을 감싼 li 가 오른쪽으로만 움직인다).
//   포인터 지나간 줄이 강조색으로 켜졌다 천천히 식는다(CSS 전환), 왼쪽 가장자리 표지가 포인터 높이를 따라온다.
export type HeroCroppedTitleListCopy = {
  label: string
  // 읽기 도구용 제목(보이는 것은 목록).
  title: string
  listLabel: string
  lines: Cta[]
  meta: { term: string; value: string; href: string }[]
  metaNote?: string
}
export type HeroCroppedTitleListProps = BlockBase<HeroCroppedTitleListCopy> & HeroCommon

const DEFAULT_TECHNIQUES = ["split-text", "oversize-crop"]
const PEEK = 2

// 줄마다 잘린 길이(최대 20vw)를 --push 로 — hover·focus 밀기와 첫 등장 한 번 밀기가 같은 값을 쓴다.
function usePush(ref: React.RefObject<HTMLUListElement | null>) {
  React.useEffect(() => {
    const ul = ref.current
    if (!ul) return
    const set = () => {
      const w = ul.clientWidth
      for (const a of ul.querySelectorAll<HTMLElement>("a")) a.style.setProperty("--push", `${Math.max(0, Math.min(window.innerWidth * 0.2, a.scrollWidth - w))}px`)
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(ul)
    document.fonts?.ready.then(set)
    return () => ro.disconnect()
  }, [ref])
}

// 줄 강조 색(hover·focus·첫 밀기)을 --line-hi 로: 면 색(field-1)이 바탕 위 큰 글자 4.5 를 넘으면 면 색, 아니면 주색, 그것도 아니면 글자색.
function useLineHighlight(ref: React.RefObject<HTMLUListElement | null>) {
  React.useEffect(() => {
    const ul = ref.current
    if (!ul) return
    const cv = document.createElement("canvas")
    cv.width = cv.height = 1
    const ctx = cv.getContext("2d", { willReadFrequently: true })
    if (!ctx) return
    const probe = document.createElement("span")
    ul.appendChild(probe)
    const tone = (v: string) => {
      probe.style.color = `var(${v})`
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = "#000"
      ctx.fillStyle = getComputedStyle(probe).color
      ctx.fillRect(0, 0, 1, 1)
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    }
    const lum = (c: number[]) => {
      const f = (x: number) => {
        x /= 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const bg = tone("--background")
    const pick = ["--field-1", "--primary", "--foreground"].find((v) => ratio(tone(v), bg) >= 4.5) ?? "--foreground"
    probe.remove()
    ul.style.setProperty("--line-hi", `var(${pick})`)
    return () => {
      ul.style.removeProperty("--line-hi")
    }
  }, [ref])
}

function Letters({ text, on }: { text: string; on: boolean }) {
  if (!on) return <>{text}</>
  return (
    <>
      <span className="cn-block-hero-cropped-title-list-span">{text}</span>
      <span aria-hidden="true" className="chars">
        {[...text].map((c, i) => (
          <span key={i} className="cn-block-hero-cropped-title-list-span-2">
            {c}
          </span>
        ))}
      </span>
    </>
  )
}

const pushOf = (el: Element) => parseFloat(getComputedStyle(el).getPropertyValue("--push")) || 0

export function HeroCroppedTitleList({ copy, id = "hero", className, faces = [], techniques = DEFAULT_TECHNIQUES, header, texture }: HeroCroppedTitleListProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const k = faceAt(faces, 0)
  const ref = React.useRef<HTMLUListElement>(null)
  usePush(ref)
  useLineHighlight(ref)
  useHeroScene(root, techniques, (s) => {
    const q = (sel: string) => s.root.querySelector<HTMLElement>(sel)
    const rows = s.q(".title-list > li")
    // ── 등장(M1: 약 2.2초 — 셋째 줄 밀기 포함) ──
    // 머리 칸(header 로 넘긴 머리에 있을 때만): 면 쓸기 · 대괄호 체크 · 머리 버튼.
    if (q(".head-face")) clipReveal(s, ".head-face", { from: "right", at: 0, duration: s.t.enter * 1.8 })
    clipReveal(s, ".meta-face", { from: "top", at: 0.12, duration: s.t.enter * 2 })
    const boxes = s.q(".bracket .box")
    if (boxes.length) s.tl.from(boxes, { scale: 0.3, autoAlpha: 0, duration: s.t.enter, ease: "back.out(2.4)", stagger: 0.07, clearProps: "transform,opacity,visibility" }, 0.35)
    // 줄은 li 가 올라온다(링크 .line 은 hover 밀기의 CSS 전환을 가져 GSAP 과 겹치면 안 된다).
    s.tl.from(rows, { yPercent: 80, clipPath: "inset(100% 0% 0% 0%)", duration: s.t.enter * 1.6, ease: s.t.ease.emphasized, stagger: 0.055 * s.scale.stagger, clearProps: "transform,clipPath" }, 0.2)
    const chars = s.q(".chars > span")
    if (chars.length) s.tl.from(chars, { yPercent: 100, autoAlpha: 0, duration: s.t.enter, ease: s.t.ease.emphasized, stagger: 0.012, clearProps: "transform,opacity,visibility" }, 0.25)
    const peek = q(".line.peek")
    // 셋째 줄 밀기: hover 와 같은 CSS 전환을 클래스로 켜고 끈다.
    if (peek) {
      s.tl.call(() => peek.classList.add("peeking"), undefined, 1.1).call(() => peek.classList.remove("peeking"), undefined, 2.1)
      s.onCleanup(() => peek.classList.remove("peeking"))
    }
    if (q(".head-cta")) rise(s, ".head-cta", { at: 0.95, y: 10 })

    // ── 스크롤: 줄마다 다른 속도로 오른쪽 자르는 선 안으로 밀려 들어간다(오른쪽으로만 — 첫 글자는 잘리지 않는다) ──
    const sc = scrubTimeline(s)
    rows.forEach((li, i) => {
      const a = li.querySelector(".line")
      if (a) sc.to(li, { x: () => Math.max(0, Math.min(pushOf(a), 160) * (0.12 + 0.1 * (i % 3)) * s.scale.distance) }, 0)
    })

    // ── 포인터: 표지가 포인터 높이를 따라온다(자취는 CSS) ──
    const list = q(".title-list")
    const mark = q(".trail")
    if (!list || !mark) return
    s.pointer((ps) => {
      const box = mark.parentElement ?? list
      gsap.set(mark, { height: rows[0]?.getBoundingClientRect().height ?? 0 })
      const qy = gsap.quickTo(mark, "y", { duration: 0.45, ease: "power3.out" })
      const move = (e: PointerEvent) => {
        const row = (e.target as Element).closest?.("li")
        if (!row) return
        qy(row.getBoundingClientRect().top - box.getBoundingClientRect().top)
        ps.add(() => gsap.to(mark, { autoAlpha: 1, duration: ps.t.hover, overwrite: "auto" }))
      }
      listen(ps, list, { pointermove: move, pointerleave: () => ps.add(() => gsap.to(mark, { autoAlpha: 0, duration: ps.t.hover * 3 })) })
    })
  })
  return (
    <div ref={root} id={id} data-block="hero-cropped-title-list" data-hero="cropped-title-list" className={cn("cn-block-hero-root cn-block-hero-cropped-title-list", className)}>
      <HeroTexture texture={texture} />
      {header}
      <section aria-label={copy.label} className="cn-block-hero-cropped-title-list-h-first hero-first">
        <Face k={k} fallback="" enter="keep" className="cn-block-hero-cropped-title-list-meta-face meta-face">
          <dl className="cn-block-hero-cropped-title-list-dl">
            {copy.meta.map((m) => (
              <div key={m.term} className="cn-block-hero-cropped-title-list-box">
                <dt className="cn-block-hero-cropped-title-list-dt">{m.term}</dt>
                <dd>
                  <a href={m.href} className={cn("cn-block-hero-cropped-title-list-link", RING)}>
                    [ {m.value} ]
                  </a>
                </dd>
              </div>
            ))}
          </dl>
          {copy.metaNote ? <p className="cn-block-hero-cropped-title-list-text-2">{copy.metaNote}</p> : null}
        </Face>
        <div className="cn-block-hero-cropped-title-list-box-2">
          <h1 className="cn-block-hero-cropped-title-list-title">{copy.title}</h1>
          <span aria-hidden="true" className="cn-block-hero-cropped-title-list-trail trail" />
          <ul ref={ref} data-wf-art="" data-enter="keep" data-clip-ok="" className="cn-block-hero-cropped-title-list-title-list title-list" aria-label={copy.listLabel}>
            {copy.lines.map((t, i) => (
              <li key={i}>
                <a href={t.href} className={cn("line font-heading", RING, i === PEEK && "peek")}>
                  <Letters text={t.label} on={i === 0 && techniques.includes("split-text")} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
