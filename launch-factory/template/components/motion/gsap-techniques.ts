"use client"

import { gsap } from "gsap"
import { CustomEase } from "gsap/CustomEase"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

import { ACCENT_DELAY, bezierArgs, blurToSharpPlan, countUpHold, DEFAULT_EASE, EASES, kenBurnsPlan, kineticStagger, lowerThirdTiming, magneticOffset, objectSwap3dPlan, pageTransitionPlan, preloaderIntroPlan, PRELOADER_MAX_MS, previewFollowPlan, punchFrom, scrollHintPlan, staggerPlan, TECH, tiltAngles, whipPlan, type EaseName, type MotionLevel } from "@/components/motion/motion-scale"
import type { Scene } from "@/components/motion/use-gsap-scene"

// 등록은 멱등이다 — 이 파일만 따로 불러도 플러그인이 켜져 있게(use-gsap-scene 도 같은 것을 등록한다).
gsap.registerPlugin(CustomEase, ScrollTrigger, SplitText)

// §8-6 기법 id 에 맞춘 GSAP 도우미(motion-gsap). 모두 useGsapScene 의 build 안에서 부른다 — 장면(s)이 토큰 길이·곡선과 강도 배율을 준다.
// 등장 도우미는 s.tl(등장 한 줄)의 at 자리에 넣고, 끝나면 자기가 쓴 인라인 속성만 지운다(clearProps — 뒤의 hover CSS 가 다시 먹게).
// 스크롤 도우미는 s.scroll()(첫 화면 스크롤 60% 안 scrub), 포인터 도우미는 고운 포인터에서만 달린다(s.finePointer).
type Targets = gsap.TweenTarget
type At = gsap.Position | undefined
const el = (s: Scene, t: Element | string | null) => (typeof t === "string" ? s.root.querySelector<HTMLElement>(t) : (t as HTMLElement | null))

// ── 등장 ────────────────────────────────────────────────────────────────
// 떠오르며 나타남(연쇄 정착). y 는 M2 기준 px — 강도가 곱해진다.
export function rise(s: Scene, targets: Targets, { at, y = 16, stagger = 0.06, duration, ease }: { at?: At; y?: number; stagger?: number; duration?: number; ease?: string } = {}) {
  return s.tl.from(targets, { autoAlpha: 0, y: y * s.scale.distance, stagger: stagger * s.scale.stagger, duration: duration ?? s.t.enter, ease: ease ?? s.t.ease.standard, clearProps: "transform,opacity,visibility" }, at)
}

// 쪼개기 공통(splitReveal·kineticType) — 쪼갠 상태에서도 줄바꿈이 안 쪼갠 상태와 같은 자리에서 일어나게 한다.
// 원인(실측, v0.0.9 FB9): 글자·낱말이 inline-block(원자 요소)이 되면 글자 폭 합이 어긋나고 원자 요소는 text-wrap: balance 를 못 받아 줄 구성이 안 쪼갠 글과 달라진다.
// 그래서 쪼갰다 되돌릴 때(등장 끝·물결 끝·스크럽 진입·이탈) 낱말이 줄을 넘나든다(키네틱 띠 1440: 「가마를」이 윗줄 ↔ 아랫줄).
// 고침: 쪼갠 뒤 줄 첫 낱말 앞에 <br> 를 넣어 안 쪼갠 글과 같은 자리에서 끊는다. 안 쪼갠 줄 구성은 같은 순간에(그리기 전에) 쪼갠 가지를 잠깐 빼고 원본 글을 되돌려 놓고 재 뒤 도로 끼워 넣어
// 얻는다 — 가지(요소)는 그대로라 진행 중인 트윈이 쥔 요소·변형은 그대로이고 화면은 그 사이에 칠해지지 않는다. 낱말은 한 덩어리(inline-block 안에 글자)라 낱말 사이에서만 줄이 바뀐다.
// 글꼴이 오는 중(document.fonts.status loading)이면 재지 않는다 — 대체 글꼴로 잰 줄은 진짜 글꼴과 다르다. 글꼴이 도착하거나(loadingdone·loadingerror) 창 폭이 바뀌면 다시 잰다.
// revert() 가 원본을 되돌릴 때 <br> 도 사라지고 리스너도 걷힌다. lines 단위는 SplitText 가 줄을 직접 만든다 — 낱말 수가 안 맞으면(낱말 개념이 다른 경우) 아무것도 넣지 않는다.
const wordTops = (root: HTMLElement) => {
  const tops: number[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    for (const m of t.data.matchAll(/\S+/g)) {
      const r = document.createRange()
      r.setStart(t, m.index ?? 0)
      r.setEnd(t, (m.index ?? 0) + 1)
      tops.push(Math.round(r.getBoundingClientRect().top))
    }
  }
  return tops
}
export function splitKeepLines(node: HTMLElement, vars: SplitText.Vars): SplitText {
  const orig = Array.from(node.childNodes, (c) => c.cloneNode(true))
  const sp = SplitText.create(node, vars)
  const fonts = document.fonts
  const stop = () => {
    fonts?.removeEventListener("loadingdone", apply)
    fonts?.removeEventListener("loadingerror", apply)
    window.removeEventListener("resize", apply)
  }
  function apply() {
    node.querySelectorAll("br[data-wf-br]").forEach((b) => b.remove())
    const words = sp.words ?? []
    if (!words.length || !words[0].isConnected) return stop()
    if (fonts?.status === "loading" || words.length < 2) return
    const kids = Array.from(node.childNodes)
    node.replaceChildren(...orig.map((c) => c.cloneNode(true)))
    const tops = wordTops(node)
    node.replaceChildren(...kids)
    if (words.length !== tops.length) return
    words.forEach((w, i) => {
      if (i > 0 && tops[i] !== tops[i - 1]) {
        const br = document.createElement("br")
        br.setAttribute("data-wf-br", "")
        w.parentNode?.insertBefore(br, w)
      }
    })
  }
  if (vars.type !== "lines") {
    apply()
    fonts?.addEventListener("loadingdone", apply)
    fonts?.addEventListener("loadingerror", apply)
    window.addEventListener("resize", apply)
    const revert = sp.revert.bind(sp)
    sp.revert = (...a: Parameters<SplitText["revert"]>) => {
      stop()
      return revert(...a)
    }
  }
  return sp
}

// split-text: SplitSource 가 그린 보이는 사본([data-wf-split], aria-hidden)을 GSAP SplitText 로 쪼개 칸(mask) 안에서 올린다.
// 읽기 도구는 sr-only 원문을 읽는다(aria: "none" — 사본은 이미 숨었다). 등장이 끝나면 쪼갠 것을 되돌린다(글자 사이 간격이 원래대로).
export function splitReveal(s: Scene, target: Element | string, { at, type = "words", stagger = 0.04, duration, from = 110 }: { at?: At; type?: "chars" | "words" | "lines"; stagger?: number; duration?: number; from?: number } = {}) {
  const host = el(s, target)
  const node = host?.matches("[data-wf-split]") ? host : host?.querySelector<HTMLElement>("[data-wf-split]")
  if (!node) return null
  const split = splitKeepLines(node, { type: type === "chars" ? "words,chars" : type, mask: type, aria: "none" })
  const pieces = type === "chars" ? split.chars : type === "lines" ? split.lines : split.words
  s.onCleanup(() => split.revert())
  return s.tl.from(pieces, { yPercent: from, duration: duration ?? s.t.enter * 1.4, ease: s.t.ease.emphasized, stagger: stagger * s.scale.stagger, onComplete: () => split.revert() }, at)
}

// clip-reveal: clip-path 로 여는 등장. from = 가려진 쪽(bottom 이면 아래에서 위로 열린다) · center-x(가운데서 좌우로) · ellipse(가운데서 둥글게).
const CLIP_FROM: Record<string, [string, string]> = {
  bottom: ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
  top: ["inset(0% 0% 100% 0%)", "inset(0% 0% 0% 0%)"],
  left: ["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"],
  right: ["inset(0% 0% 0% 100%)", "inset(0% 0% 0% 0%)"],
  "center-x": ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)"],
  ellipse: ["ellipse(0% 0% at 50% 50%)", "ellipse(75% 75% at 50% 50%)"],
}
export function clipReveal(s: Scene, targets: Targets, { at, from = "bottom", duration, stagger = 0.08, ease }: { at?: At; from?: keyof typeof CLIP_FROM; duration?: number; stagger?: number; ease?: string } = {}) {
  const [a, b] = CLIP_FROM[from]
  return s.tl.fromTo(targets, { clipPath: a }, { clipPath: b, duration: duration ?? s.t.enter * 1.6, ease: ease ?? s.t.ease.inScreen, stagger: stagger * s.scale.stagger, clearProps: "clipPath" }, at)
}

// svg-draw: 선을 0에서 긋는다. 선 길이는 pathLength 속성(없으면 getTotalLength), 끝나면 dasharray·dashoffset 을 지운다 — 남은 대시가
// 선 모양을 바꾸지 않는다(no dead dasharray). 작가가 대시를 준 선(stroke-dasharray 속성)은 긋지 않고 나타나게만 한다.
export function svgDraw(s: Scene, paths: Targets, { at, stagger = 0.08, duration, ease }: { at?: At; stagger?: number; duration?: number; ease?: string } = {}) {
  const list = gsap.utils.toArray<SVGGeometryElement>(paths)
  const drawn = list.filter((p) => !p.getAttribute("stroke-dasharray"))
  const dashed = list.filter((p) => p.getAttribute("stroke-dasharray"))
  const len = (p: SVGGeometryElement) => Number(p.getAttribute("pathLength")) || (typeof p.getTotalLength === "function" ? p.getTotalLength() : 1)
  const d = duration ?? s.t.enter * 3
  const tw = s.tl.fromTo(drawn, { strokeDasharray: (_i: number, p: SVGGeometryElement) => `${len(p)} ${len(p)}`, strokeDashoffset: (_i: number, p: SVGGeometryElement) => len(p) }, { strokeDashoffset: 0, duration: d, ease: ease ?? s.t.ease.emphasized, stagger: stagger * s.scale.stagger, clearProps: "strokeDasharray,strokeDashoffset" }, at)
  if (dashed.length) s.tl.from(dashed, { autoAlpha: 0, duration: s.t.enter, clearProps: "opacity,visibility" }, "<50%")
  return tw
}

// 숫자 세기(KPI): 0 → 글자 속 수. 끝나면 원래 글자 그대로. 쉼표·소수 자리·단위는 원문을 따른다.
// 세는 동안 폭을 끝 값의 폭으로 붙든다 — 자릿수가 1 → 2 → 3 으로 늘어도 칩·줄이 밀리지 않는다(레이아웃 이동 없음, Task 11 fix b2 I1).
// 숫자 폭은 tabular-nums 로 고르게, 줄 안(inline) 요소는 폭을 가질 수 있게 inline-block 으로. 서체가 바뀌면(font swap) 끝 폭을 다시 잰다.
// 끝나면(또는 되돌리면) 이 도우미가 쓴 인라인 속성을 모두 지운다 — 끝 모양은 원래 그대로다.
const HOLD = ["min-inline-size", "font-variant-numeric", "display"] as const
export function countUp(s: Scene, targets: Targets, { at, duration, stagger = 0.08 }: { at?: At; duration?: number; stagger?: number } = {}) {
  const list = gsap.utils.toArray<HTMLElement>(targets)
  list.forEach((node, i) => {
    const text = node.textContent ?? ""
    const m = text.match(/[\d,]*\.?\d+/)
    if (!m) return
    const raw = m[0].replace(/,/g, "")
    const dec = raw.includes(".") ? raw.split(".")[1].length : 0
    const to = Number(raw)
    const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[0].includes(",") })
    const box = { v: 0 }
    const show = (v: number) => { node.textContent = text.replace(m[0], fmt.format(v)) }
    let counting = true
    // 끝 글자(원래 서체 모양)와 세는 글자(tabular) 가운데 넓은 쪽을 최소 폭으로. 폭은 글자 자체의 폭(Range)으로 잰다 — 블록 요소의
    // 상자 폭(칸 폭)을 재면 칸이 바뀐 뒤(서체 교체 등) 최소 폭이 칸보다 커져 끝날 때 줄어든다.
    const range = document.createRange()
    const inkWidth = () => { range.selectNodeContents(node); return range.getBoundingClientRect().width }
    const hold = () => {
      if (!counting) return
      const now = node.textContent
      node.style.removeProperty("min-inline-size")
      node.style.removeProperty("font-variant-numeric")
      node.textContent = text
      const natural = inkWidth()
      node.style.fontVariantNumeric = "tabular-nums"
      const tab = inkWidth()
      node.style.minInlineSize = `${countUpHold(natural, tab, getComputedStyle(node))}px`
      node.textContent = now
    }
    const release = () => {
      counting = false
      node.textContent = text
      for (const p of HOLD) node.style.removeProperty(p)
    }
    if (getComputedStyle(node).display === "inline") node.style.display = "inline-block"
    hold()
    // 처음부터 0 을 보인다 — 원래 수가 먼저 보였다가 0 으로 떨어지지 않게.
    show(0)
    document.fonts?.ready.then(hold).catch(() => {})
    s.onCleanup(release)
    s.tl.to(box, { v: to, duration: duration ?? s.t.enter * 2.4, ease: "power2.out", onUpdate: () => show(box.v), onComplete: release }, i === 0 ? at : `<${stagger * s.scale.stagger}`)
  })
}

// ── 스크롤 연동(첫 화면 스크롤 60% 안) ─────────────────────────────────
// 빈 scrub 줄 — 위치 0~1 에 트윈을 놓는다(ease none).
export const scrubTimeline = (s: Scene, extra?: ScrollTrigger.Vars) => gsap.timeline({ scrollTrigger: s.scroll(extra), defaults: { ease: "none", duration: 1 } })

// 시차(parallax/depth): 층마다 스크롤 동안 y(px, M2 기준)만큼 — 깊이 배율이 곱해진다. 멀수록 작게, 가까울수록 크게 준다.
export function parallax(s: Scene, layers: { el: Targets; y?: number; x?: number; rotate?: number; scale?: number }[]) {
  const tl = scrubTimeline(s)
  for (const l of layers) tl.to(l.el, { y: (l.y ?? 0) * s.scale.depth, x: (l.x ?? 0) * s.scale.depth, rotation: (l.rotate ?? 0) * s.scale.rotate, ...(l.scale != null ? { scale: l.scale } : {}) }, 0)
  return tl
}

// oversize-crop: 잘린 큰 글자가 스크롤 동안 옆으로 흘러 잘린 끝을 보여 준다(xPercent, M2 기준).
export function oversizeCrop(s: Scene, target: Targets, { from = 0, to = -12 }: { from?: number; to?: number } = {}) {
  return gsap.fromTo(target, { xPercent: from * s.scale.distance }, { xPercent: to * s.scale.distance, ease: "none", scrollTrigger: s.scroll() })
}

// variable-axis: 가변 축(wght·opsz …)을 등장 때 한 번(at) 또는 스크롤 동안(scrub) 옮긴다. 값은 서체 축 범위 안이어야 한다.
export function variableAxis(s: Scene, target: Targets, { axis = "wght", from, to, at, scrub = false, duration }: { axis?: string; from: number; to: number; at?: At; scrub?: boolean; duration?: number }) {
  const v = (n: number) => `"${axis}" ${n}`
  if (scrub) return gsap.fromTo(target, { fontVariationSettings: v(from) }, { fontVariationSettings: v(to), ease: "none", scrollTrigger: s.scroll() })
  return s.tl.fromTo(target, { fontVariationSettings: v(from) }, { fontVariationSettings: v(to), duration: duration ?? s.t.enter * 1.7, ease: s.t.ease.standard, clearProps: "fontVariationSettings" }, at)
}

// sticky-stack: 구획을 고정한 채 층을 한 장씩 올려 쌓는다. 앞 장은 0.96 으로 물러나 한 단계 어두워진다.
export function stickyStack(s: Scene, container: Element, layers: Element[], { per = 0.5 }: { per?: number } = {}) {
  const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: container, start: "top top", end: () => `+=${Math.round(window.innerHeight * per * Math.max(1, layers.length - 1))}`, pin: true, scrub: s.scale.scrub || true, invalidateOnRefresh: true } })
  layers.slice(1).forEach((layer, i) => {
    tl.from(layer, { yPercent: 100 }, i).to(layers[i], { scale: 0.96, filter: "brightness(0.85)" }, i)
  })
  return tl
}

// ── 유휴 반복(M2~M3, 화면 밖·숨은 탭에서 멈춤) ─────────────────────────
// marquee: 두 벌 이어 붙인 띠를 절반만큼 계속 민다(px/초). 정지 단추는 부르는 쪽 몫(DYNAMICS 「정지 버튼 필수」) — 돌려준 트윈을 pause.
export function marquee(s: Scene, track: Element, { speed = 40 }: { speed?: number } = {}) {
  return s.loop(() => gsap.to(track, { xPercent: -50, ease: "none", repeat: -1, duration: Math.max(4, (track as HTMLElement).scrollWidth / 2 / (speed * s.scale.distance || 1)) }))
}
// mesh-gradient · grain: 배경층이 아주 느리게 떠돈다(sine yoyo).
export function ambientDrift(s: Scene, target: Targets, { x = 0, y = 0, rotate = 0, scale, duration = 6 }: { x?: number; y?: number; rotate?: number; scale?: number; duration?: number } = {}) {
  return s.loop(() => gsap.to(target, { x: x * s.scale.distance, y: y * s.scale.distance, rotation: rotate * s.scale.rotate, ...(scale != null ? { scale } : {}), duration, ease: "sine.inOut", yoyo: true, repeat: -1 }))
}

// ── 포인터(고운 포인터만) ─────────────────────────────────────────────
// 포인터 도우미는 장면의 포인터 겹(s.pointer)에서 돈다 — 마우스일 때만 붙고, 터치로 바뀌면 그 겹만 되돌린다(등장은 다시 돌지 않는다).
// 이미 겹 안이면(부르는 쪽이 s.pointer 안에서 불렀다) 그 자리에서 돈다.
const onPointer = (s: Scene, fn: (p: Scene) => void, afterEnter = false) => (s.inPointer ? fn(s) : s.pointer(fn, { afterEnter }))

// 포인터 이벤트를 달고 정리를 장면(겹)에 맡긴다.
export function listen(s: Scene, target: Element | Window, handlers: Record<string, (e: PointerEvent) => void>) {
  for (const [k, fn] of Object.entries(handlers)) target.addEventListener(k, fn as EventListener)
  s.onCleanup(() => { for (const [k, fn] of Object.entries(handlers)) target.removeEventListener(k, fn as EventListener) })
}

// tilt-3d: 포인터를 따라 기울인다(±max°, 강도 배율). 감쇠(quickTo)로 따라가고 떠나면 0으로. SVG 안 요소도 되도록 transform 을 style 로 직접 쓴다
// (부모 CSS 변수를 쓰면 자식 전부의 스타일을 다시 계산한다).
export function tilt3d(s: Scene, surface: Element | null, targets: Targets, { max = 6, perspective = 900, damping = 0.6, afterEnter = false }: { max?: number; perspective?: number; damping?: number; afterEnter?: boolean } = {}) {
  if (!surface) return
  onPointer(s, (ps) => {
    const list = gsap.utils.toArray<HTMLElement>(targets)
    const p = { rx: 0, ry: 0 }
    const apply = () => { for (const t of list) t.style.transform = `perspective(${perspective}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg)` }
    const qx = gsap.quickTo(p, "rx", { duration: damping, ease: "power3.out", onUpdate: apply })
    const qy = gsap.quickTo(p, "ry", { duration: damping, ease: "power3.out", onUpdate: apply })
    const m = max * ps.scale.rotate
    listen(ps, surface, {
      pointermove: (e) => { const a = tiltAngles(e.clientX, e.clientY, surface.getBoundingClientRect(), m); qx(a.rx); qy(a.ry) },
      pointerleave: () => { qx(0); qy(0) },
    })
    ps.onCleanup(() => { for (const t of list) t.style.transform = "" })
  }, afterEnter)
}

// 깊이(포인터): 층마다 포인터 방향으로 x·y px(M2 기준) — 가까운 층일수록 큰 값을 준다. 감쇠로 따라간다.
export function pointerDepth(s: Scene, surface: Element | null, layers: { el: Element | null; x?: number; y?: number }[], { damping = 0.8, afterEnter = false }: { damping?: number; afterEnter?: boolean } = {}) {
  if (!surface) return
  onPointer(s, (ps) => {
    const qs = layers.filter((l) => l.el).map((l) => ({ l, x: gsap.quickTo(l.el, "x", { duration: damping, ease: "power3.out" }), y: gsap.quickTo(l.el, "y", { duration: damping, ease: "power3.out" }) }))
    const k = ps.scale.depth
    listen(ps, surface, {
      pointermove: (e) => {
        const b = surface.getBoundingClientRect()
        const nx = (e.clientX - b.left) / b.width - 0.5, ny = (e.clientY - b.top) / b.height - 0.5
        for (const q of qs) { q.x(nx * 2 * (q.l.x ?? 0) * k); q.y(ny * 2 * (q.l.y ?? 0) * k) }
      },
      pointerleave: () => { for (const q of qs) { q.x(0); q.y(0) } },
    })
  }, afterEnter)
}

// magnetic-cta: 주 CTA 하나를 감싼 요소가 포인터 쪽으로 최대 maxPx 끌린다(버튼 자신의 누름 transform 과 겹치지 않게 감싼 요소를 준다).
export function magneticCta(s: Scene, wrap: Element | null, { strength = 0.3, radius = 110, maxPx = 10 }: { strength?: number; radius?: number; maxPx?: number } = {}) {
  if (!wrap) return
  onPointer(s, (ps) => {
    const qx = gsap.quickTo(wrap, "x", { duration: 0.5, ease: "power3.out" })
    const qy = gsap.quickTo(wrap, "y", { duration: 0.5, ease: "power3.out" })
    const move = (e: PointerEvent) => { const o = magneticOffset(e.clientX, e.clientY, wrap.getBoundingClientRect(), { strength, radius, maxPx: maxPx * ps.scale.distance }); qx(o.x); qy(o.y) }
    listen(ps, window, { pointermove: move })
    listen(ps, document.documentElement, { pointerleave: () => { qx(0); qy(0) } })
  })
}

// ── 모션 그래픽 기법(P3-5 MOTKIT) ─────────────────────────────────────
// 수치는 motion-scale TECH(카드 references/motion/effects.json)에서, 곡선은 EASES 이름에서. 모두 장면(s) 안에서 돈다 — 동작 줄이기·M0 는 장면이
// build 를 부르지 않으므로(정지 갈래) DOM 의 최종 상태 그대로다. 유휴 반복은 s.loop(M2~M3, 화면 밖·숨은 탭·사용자 정지에서 멈춘다).
// 히어로 첫 화면 글(keep)에 거는 등장은 서버 렌더 쪽에서는 끝 상태로 놓이고(settleKept), 「강조」(accent)는 등장 끝 + ACCENT_DELAY 뒤 글을
// 숨기지 않고 옮기기만 한다 — 첫 칠·LCP·번쩍임 관문 창(등장 끝 + 0.8초)을 건드리지 않는다.

// 이름 붙인 곡선(EASES) → 등록한 CustomEase 이름. 이름을 주지 않으면 기본 out(ease-out).
const easeNames = new Map<string, string>()
export function namedEase(name: EaseName = DEFAULT_EASE) {
  let n = easeNames.get(name)
  if (!n) {
    n = `wf-${name}`
    CustomEase.create(n, bezierArgs(EASES[name]) ?? "0.23,1,0.32,1")
    easeNames.set(name, n)
  }
  return n
}

// 등장 뒤 강조: 등장이 끝나고 ACCENT_DELAY(초) 뒤 장면 문맥에서 한 번. 등장을 건너뛴 서버 렌더도 같은 시각에 돈다.
export function accent(s: Scene, fn: () => void, delay = ACCENT_DELAY) {
  s.afterEnter(() => { gsap.delayedCall(delay, () => s.add(fn)) })
}

// 화면에 들어올 때 등장(첫 화면 아래 구획): 뿌리가 이미 화면 안이면 그대로, 아니면 s.tl 을 멈춰 두었다가 처음 들어올 때(한 번) 튼다.
// 등장 끝 신호는 실제로 끝났을 때 난다. 관문의 등장 기다림(ENTERED_WAIT)은 쪽의 첫 장면(히어로)만 본다.
export function playOnView(s: Scene, { start = "top 88%" }: { start?: string } = {}) {
  const r = s.root.getBoundingClientRect()
  if (r.top < window.innerHeight * 0.88 && r.bottom > 0) return
  s.tl.pause()
  ScrollTrigger.create({ trigger: s.root, start, once: true, onEnter: () => { s.tl.play() } })
}

// 보이는 사본([data-wf-split])을 찾는다 — 없으면 대상 자신.
const splitNode = (host: HTMLElement | null) => (host?.matches("[data-wf-split]") ? host : host?.querySelector<HTMLElement>("[data-wf-split]") ?? host)
type SplitBy = "chars" | "words" | "lines"
const piecesOf = (sp: SplitText, by: SplitBy) => (by === "chars" ? sp.chars : by === "lines" ? sp.lines : sp.words)

// kinetic-typography: 글자·낱말 단위로 문장이 움직인다(카드 kinetic-typography).
//   rise   등장 — 칸(mask) 안에서 아래에서 올라오며(글자면 살짝 기울었다 선다) 연쇄, 마지막 조각이 1.2s(M3 2s) 안에 끝난다.
//   wave   강조 — 등장 뒤 ACCENT_DELAY 에 글자가 한 줄기 물결처럼 떴다 내려앉는다(숨기지 않는다). 고운 포인터면 제목에 올릴 때 다시 친다.
//   scrub  스크롤 — 첫 화면 스크롤 구간 동안 낱말이 가운데에서 바깥으로 벌어지고 기운다(맨 위에서는 제자리 — 첫 칠 그대로).
export function kineticType(s: Scene, target: Element | string | null, { mode = "rise", by = mode === "scrub" ? "words" : "chars", at, spread = 0.35, skew = 6 }: { mode?: "rise" | "wave" | "scrub"; by?: SplitBy; at?: At; spread?: number; skew?: number } = {}) {
  const node = splitNode(el(s, target))
  if (!node) return null
  if (mode === "rise") {
    const sp = splitKeepLines(node, { type: by === "chars" ? "words,chars" : by, mask: by, aria: "none" })
    const pieces = piecesOf(sp, by)
    s.onCleanup(() => sp.revert())
    // 되돌리기는 등장 전체가 끝난 뒤 — 같은 제목 안의 다른 등장(키워드 펀치 등)이 도는 동안 안쪽 요소를 새로 만들지 않는다.
    s.afterEnter(() => sp.revert())
    return s.tl.from(pieces, { yPercent: TECH.kinetic.yPercent, rotate: by === "chars" ? 8 * s.scale.rotate : 0, transformOrigin: "0% 100%", duration: s.t.enter * 1.2, ease: namedEase("out-expo"), stagger: kineticStagger(pieces.length, by, s.level === "M3") }, at)
  }
  if (mode === "wave") {
    const play = () => {
      if (node.dataset.wfWave || node.dataset.wfScrub) return
      node.dataset.wfWave = ""
      const sp = splitKeepLines(node, { type: "words,chars", aria: "none" })
      const n = sp.chars.length
      gsap.timeline({ onComplete: () => { sp.revert(); delete node.dataset.wfWave } })
        .to(sp.chars, { y: `-${TECH.kinetic.waveEm * s.scale.distance}em`, duration: 0.26, ease: namedEase("out-quart"), stagger: kineticStagger(n, "chars"), yoyo: true, repeat: 1 })
    }
    accent(s, play)
    s.pointer((p) => listen(p, node, { pointerenter: () => p.add(play) }), { afterEnter: true })
    s.onCleanup(() => { delete node.dataset.wfWave })
    return null
  }
  // scrub: 낱말 쪼개기는 스크롤이 0 을 떠날 때 한다(등장이 끝난 뒤, 물결이 돌지 않을 때) — 같은 사본을 쪼개는 rise·wave 와 겹치지 않는다.
  // 맨 위(0)로 돌아오면 되돌린다(첫 칠 모양 그대로). 진행은 장면 스크롤 구간의 scrub 이 부드럽게 따라잡는 대리 값(p)으로 읽는다.
  let sp: SplitText | null = null
  let ready = false
  s.afterEnter(() => { ready = true })
  const release = () => { if (sp) { sp.revert(); sp = null } delete node.dataset.wfScrub }
  s.onCleanup(release)
  const proxy = { p: 0 }
  const apply = () => {
    if (proxy.p <= 0.001) return release()
    if (!sp) {
      if (!ready || node.dataset.wfWave) return
      sp = splitKeepLines(node, { type: "words", aria: "none" })
      node.dataset.wfScrub = ""
    }
    const c = (sp.words.length - 1) / 2
    const em = parseFloat(getComputedStyle(node).fontSize) || 16
    sp.words.forEach((w, i) => gsap.set(w, { x: (i - c) * spread * em * s.scale.distance * proxy.p, skewX: (i < c ? skew : i > c ? -skew : 0) * s.scale.rotate * proxy.p }))
  }
  return gsap.to(proxy, { p: 1, ease: "none", onUpdate: apply, scrollTrigger: s.scroll() })
}

// lower-third: 이름표 띠 — 막대가 왼쪽에서 펼쳐지고(scaleX) 그 위 글이 칸 안에서 올라온다(막대 → 이름 → 역할 연쇄). 들어옴 0.55s·머무름 2.5~6s·나감 0.35s.
// 표지 약속(_shared/lower-third): 뿌리 [data-lt] > [data-lt-item](첫째만 보이고 나머지는 CSS 가 숨긴다) > .lt-bar · .lt-mask > .lt-text.
// 항목이 둘 이상이고 loop 면 등장 뒤 차례로 바뀐다(유휴 반복 — 정지 단추 몫은 부르는 쪽, 5초 넘는 자동 변화).
const ltParts = (it: Element) => ({ bar: it.querySelector(".lt-bar"), text: gsap.utils.toArray<HTMLElement>(".lt-text", it) })
function ltSwap(tl: gsap.core.Timeline, from: Element, to: Element, pos: number) {
  const t = lowerThirdTiming(), k = TECH.lowerThird
  const a = ltParts(from), b = ltParts(to)
  const easeIn = namedEase("out-lower"), easeOut = namedEase("in-exit")
  tl.fromTo(a.text, { yPercent: 0 }, { yPercent: -110, duration: t.out, ease: easeOut, stagger: k.stagger * 0.5, immediateRender: false }, pos)
  if (a.bar) tl.fromTo(a.bar, { scaleX: 1 }, { scaleX: 0, transformOrigin: "100% 50%", duration: t.out, ease: easeOut, immediateRender: false }, pos)
  tl.fromTo(from, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, immediateRender: false }, pos + t.out)
  tl.fromTo(to, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, pos + t.out)
  if (b.bar) tl.fromTo(b.bar, { scaleX: 0 }, { scaleX: 1, transformOrigin: "0% 50%", duration: t.in, ease: easeIn, immediateRender: false }, pos + t.out)
  tl.fromTo(b.text, { yPercent: 110 }, { yPercent: 0, duration: t.in, ease: easeIn, stagger: k.stagger, immediateRender: false }, pos + t.out + k.stagger)
  return t.out + t.in + k.stagger
}
export function lowerThird(s: Scene, root: Element | null, { at, hold, loop = true }: { at?: At; hold?: number; loop?: boolean } = {}) {
  if (!root) return null
  const items = gsap.utils.toArray<HTMLElement>("[data-lt-item]", root)
  if (!items.length) return null
  const t = lowerThirdTiming({ hold }), k = TECH.lowerThird
  const first = ltParts(items[0])
  if (first.bar) s.tl.from(first.bar, { scaleX: 0, transformOrigin: "0% 50%", duration: t.in, ease: namedEase("out-lower") }, at)
  s.tl.from(first.text, { yPercent: 110, duration: t.in, ease: namedEase("out-lower"), stagger: k.stagger }, at == null ? "<" : typeof at === "number" ? at + k.stagger : at)
  if (!loop || items.length < 2) return null
  s.afterEnter(() => {
    s.loop(() => {
      const tl = gsap.timeline({ repeat: -1, delay: ACCENT_DELAY })
      items.forEach((it, i) => { ltSwap(tl, it, items[(i + 1) % items.length], i * t.cycle + t.hold) })
      tl.to({}, { duration: 0 }, items.length * t.cycle)
      return tl
    })
  })
  return null
}

// ken-burns: 사진 여러 장이 느리게 확대·축소·팬하며 교차한다(장마다 방향을 번갈아, 칸 가장자리는 비지 않는다 — kenBurnsPlan). 한 장이면 왕복.
// 표지 약속: 무대 안 [data-kb-slide](첫 장만 보이고 나머지는 CSS 가 숨긴다) > .kb-img(움직이는 층). 첫 장 아래에 깔리고 위 장이 차례로 덮었다가
// 마지막 장이 걷히며 첫 장으로 돌아온다 — 반복이 이음매 없이 처음과 같은 상태에서 다시 시작한다. captions([data-lt] 뿌리)를 주면 교차 시각에 이름표도 바뀐다.
// 유휴 반복이라 M2~M3 만 돌고(M1 은 첫 장 정지), 등장 끝 + ACCENT_DELAY 뒤 시작한다(첫 칠·LCP 그림은 그 사이 그대로).
export function kenBurns(s: Scene, stage: Element | null, { perSlide = TECH.kenBurns.perSlide as number, crossfade = TECH.kenBurns.crossfade as number, captions = null }: { perSlide?: number; crossfade?: number; captions?: Element | null } = {}) {
  if (!stage) return null
  const slides = gsap.utils.toArray<HTMLElement>("[data-kb-slide]", stage)
  const imgs = slides.map((sl) => sl.querySelector<HTMLElement>(".kb-img") ?? sl)
  if (!slides.length) return null
  const plan = kenBurnsPlan(slides.length, { intensity: Math.min(1.4, Math.max(0.6, s.scale.distance)) })
  const lts = captions ? gsap.utils.toArray<HTMLElement>("[data-lt-item]", captions) : []
  let anim: gsap.core.Animation | null = null
  // 첫 장은 제자리(배율 1·이동 0 — 첫 칠 그대로)에서 출발해 끝 자세로 간다: 반복을 만드는 순간 시작 자세를 입히면(fromTo 즉시 적용) 하이드레이션 직후
  // 첫 화면 그림이 튄다(ssr-flash keep 상자). 제자리 → 확대·팬 사이도 덮개 조건을 지킨다(둘이 같은 곡선으로 함께 움직여 |이동| ≤ (배율-1)/2).
  const REST = { scale: 1, xPercent: 0, yPercent: 0 }
  s.afterEnter(() => {
    anim = s.loop(() => {
      const drift = namedEase("drift")
      if (slides.length === 1) return gsap.to(imgs[0], { ...plan[0].to, duration: perSlide, ease: drift, yoyo: true, repeat: -1, delay: ACCENT_DELAY })
      const n = slides.length, T = perSlide, cf = crossfade
      const tl = gsap.timeline({ repeat: -1, delay: ACCENT_DELAY })
      for (let i = 0; i < n; i++) {
        if (i === 0) tl.fromTo(imgs[0], REST, { ...plan[0].to, duration: T + cf, ease: drift, immediateRender: false }, 0)
        else tl.fromTo(imgs[i], plan[i].from, { ...plan[i].to, duration: T + cf, ease: drift, immediateRender: false }, i * T - cf)
        if (i > 0) tl.fromTo(slides[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: cf, ease: "none", immediateRender: false }, i * T - cf)
        if (i > 1) tl.fromTo(slides[i - 1], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, immediateRender: false }, i * T)
      }
      // 마지막 장이 걷히며 첫 장(맨 아래, 늘 보인다)으로. 첫 장 그림은 그 전에 제자리로 되돌려 둔다(다음 바퀴가 제자리에서 다시 시작 — 튐 없음).
      tl.fromTo(imgs[0], plan[0].to, { ...REST, duration: 0.01, immediateRender: false }, n * T - cf - 0.02)
      tl.fromTo(slides[n - 1], { autoAlpha: 1 }, { autoAlpha: 0, duration: cf, ease: "none", immediateRender: false }, n * T - cf)
      if (lts.length > 1) for (let i = 0; i < n; i++) ltSwap(tl, lts[i % lts.length], lts[(i + 1) % lts.length], (i + 1) * T - cf)
      return tl
    })
  })
  return { get animation() { return anim } }
}

// punch-in: 빠른 확대 컷. enter — 글자는 1.1~1.3배·사진·영상 층은 1.4~2.5배에서 제자리로 착지(out-expo, 글자는 out-back 의 짧은 오버슈트).
// accent — 등장 뒤 ACCENT_DELAY 에 한 번 「쿵」(1 → 1.06 → 1, 숨기지 않는다). 고운 포인터면 올릴 때 다시 친다. 한 화면 동시 펀치 3개 이하(카드 guards).
// targets 가 선택자 글이면 강조는 칠 때마다 다시 찾는다 — 글자 쪼개기(SplitText)가 되돌릴 때 안쪽 요소를 새로 만들어 처음 찾은 요소가 문서에서 떨어진다.
export function punchIn(s: Scene, targets: Targets, { kind = "text", mode = "enter", at, delay = ACCENT_DELAY }: { kind?: "text" | "media"; mode?: "enter" | "accent"; at?: At; delay?: number } = {}) {
  const find = () => gsap.utils.toArray<HTMLElement>(typeof targets === "string" ? s.root.querySelectorAll(targets) : targets).slice(0, 3)
  const list = find()
  if (!list.length) return null
  const k = TECH.punchIn
  if (mode === "enter") {
    return s.tl.from(list, { scale: punchFrom(kind, s.scale.distance), duration: kind === "text" ? k.in + k.settle : k.in + 0.13, ease: namedEase(kind === "text" ? "out-back" : "out-expo"), stagger: 0.08 * s.scale.stagger, clearProps: "scale" }, at)
  }
  const hit = (t: HTMLElement) => {
    if (t.dataset.wfPunch) return
    t.dataset.wfPunch = ""
    gsap.timeline({ onComplete: () => { gsap.set(t, { clearProps: "scale" }); delete t.dataset.wfPunch } })
      .to(t, { scale: 1 + (k.overshoot - 1) * Math.max(0.6, s.scale.distance), duration: 0.16, ease: namedEase("out-expo") })
      .to(t, { scale: 1, duration: k.settle, ease: namedEase("out-back") })
  }
  accent(s, () => find().forEach((t, i) => gsap.delayedCall(i * 0.12, () => s.add(() => hit(t)))), delay)
  // 다시 치기: 뿌리에서 포인터가 대상 위로 들어올 때(위임 — 대상이 새로 만들어져도 된다).
  s.pointer((p) => listen(p, s.root, { pointerover: (e) => { const t = find().find((x) => x.contains(e.target as Node) && !x.contains(e.relatedTarget as Node | null)); if (t) p.add(() => hit(t)) } }), { afterEnter: true })
  return null
}

// stagger: 카드·목록이 한 줄기로 차례로 들어온다(형제 60ms, 전체 1.2s 이내, 첫 화면이면 지연 합 0.3s 이하, 8개 넘으면 묶음 — staggerPlan).
// from: 어느 쪽부터(start·center·edges·end), grid: [행, 열] 이면 2차원 물결. y 는 M2 기준 px.
export function staggerIn(s: Scene, targets: Targets, { at, y = TECH.stagger.y as number, from = "start", grid, firstScreen = false, ease }: { at?: At; y?: number; from?: "start" | "center" | "edges" | "end"; grid?: [number, number] | "auto"; firstScreen?: boolean; ease?: EaseName } = {}) {
  const list = gsap.utils.toArray<HTMLElement>(targets)
  if (!list.length) return null
  const plan = staggerPlan(list.length, { firstScreen })
  const each = plan.groups.length < list.length ? plan.each / Math.max(1, list.length / plan.groups.length) : plan.each
  return s.tl.from(list, { autoAlpha: 0, y: y * s.scale.distance, duration: TECH.stagger.perItem * (s.t.enter / 0.5), ease: namedEase(ease ?? "out-quart"), stagger: { each: each * s.scale.stagger, from, ...(grid ? { grid } : {}) }, clearProps: "transform,opacity,visibility" }, at)
}

// whip-pan: 빠른 가로 이동 + 모션 블러로 판을 바꾼다(나가는 판은 반대쪽으로 휙, 들어오는 판은 흐림이 걷히며 착지 — 흐림은 가운데에서만, 끝나면 지운다).
// blurFilter: 가로로만 흐리는 SVG feGaussianBlur(stdDeviation "x 0") 요소를 주면 방향 블러, 없으면 CSS blur. 상호작용 전환이라 장면 문맥에 넣어 돌려준다.
export function whipPan(s: Scene, out: Element | null, into: Element, { dir = 1, blurFilter = null, onDone }: { dir?: 1 | -1; blurFilter?: Element | null; onDone?: () => void } = {}) {
  const p = whipPlan(s.level, dir)
  return s.add(() => {
    const tl = gsap.timeline({ defaults: { ease: namedEase("in-out-whip"), duration: p.duration }, onComplete: onDone })
    if (out) tl.fromTo(out, { xPercent: 0, skewX: 0 }, { xPercent: p.outX, skewX: p.skew, clearProps: "transform" }, 0)
    tl.fromTo(into, { xPercent: p.inX, skewX: -p.skew, autoAlpha: 1 }, { xPercent: 0, skewX: 0, clearProps: "transform" }, 0)
    if (blurFilter) tl.fromTo(blurFilter, { attr: { stdDeviation: "0 0" } }, { attr: { stdDeviation: `${p.blur[1]} 0` }, duration: p.duration / 2, ease: "power2.in", yoyo: true, repeat: 1 }, 0)
    else tl.fromTo([out, into].filter(Boolean), { filter: "blur(0px)" }, { filter: `blur(${p.blur[1] / 3}px)`, duration: p.duration / 2, ease: "power2.in", yoyo: true, repeat: 1, clearProps: "filter" }, 0)
    return tl
  })
}
// 화면에 들어오는 구획의 휩 등장(섹션 전환 효과): 대상이 옆에서 휙 들어와 흐림이 걷히며 착지한다(s.tl — 등장 줄 안). 뿌리는 가로 넘침을 자른다.
export function whipIn(s: Scene, targets: Targets, { at, dir = 1 }: { at?: At; dir?: 1 | -1 } = {}) {
  const p = whipPlan(s.level, dir)
  return s.tl.from(targets, { xPercent: p.inX * 0.6, skewX: -p.skew, filter: `blur(${p.blur[1] / 3}px)`, duration: p.duration * 1.6, ease: namedEase("out-expo"), stagger: 0.06 * s.scale.stagger, clearProps: "transform,filter" }, at)
}

// ── 프리셋 7종(FV1 Task 5.6, C2) ──────────────────────────────────────
// 실행부는 얇다: 무엇을 할지(animates·길이·흐림 값 …)는 motion-scale 의 순수 계획 함수(scrollHintPlan 등)가 정하고 여기서는 그대로 옮긴다.
// 모두 장면(s) 안에서 부른다 — 동작 줄이기·M0 는 장면이 build 를 부르지 않아 DOM 의 최종 상태(정지 그림·hidden 띠) 그대로다.
// 이름은 5.7 히어로 블록이 부른다: scrollHint · preloaderIntro · blurToSharp · objectSwap3d · previewFollow · pageTransition.

// 제목(h1)에 초점을 준다 — 쪽 전환·프리로더 건너뛰기 뒤 초점이 사라지지 않게(UX J03). 제목은 본래 초점 대상이 아니므로 tabindex=-1 을 더해 준다(탭 순서에는 안 든다).
function focusHeading(selector: string) {
  const h = document.querySelector<HTMLElement>(selector)
  if (!h) return false
  if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1")
  h.focus({ preventScroll: true })
  return true
}

// scroll-hint: 첫 화면 아래 「더 있어요」 표시가 까딱인다(카드 scroll-hint). 등장 끝 + ACCENT_DELAY 뒤 repeats(3)번만, 사용자가 스크롤하면 그 즉시 멈추고 제자리.
// 합계가 5초 넘게 설정하면(계획의 pauseButton) 부르는 쪽이 _shared/loop-pause 단추를 달아야 한다 — 기본값은 4.8초라 필요 없다.
export function scrollHint(s: Scene, target: Element | string | null, { delay = ACCENT_DELAY, cycleMs, repeats }: { delay?: number; cycleMs?: number; repeats?: number } = {}) {
  const node = el(s, target)
  const p = scrollHintPlan({ level: s.level, cycleMs, repeats })
  if (!node || !p.animates) return null
  accent(s, () => {
    const tw = gsap.to(node, { y: p.travelPx, duration: p.durationMs / 2000, ease: "sine.inOut", yoyo: true, repeat: p.repeats * 2 - 1, clearProps: "transform" })
    const stop = () => tw.revert()
    window.addEventListener("scroll", stop, { passive: true, once: true })
    s.onCleanup(() => window.removeEventListener("scroll", stop))
  }, delay)
  return p
}

// preloader-intro: 첫 방문(세션 첫 쪽)에만 얇은 진행 띠가 1.2초 안에 차고 걷힌다. 띠(band)는 서버 HTML 에 hidden 으로 들어 있다 — 정지 갈래·재방문에서는 열리지 않는다(아예 그리지 않는다).
// 띠는 글 위에 덮지 않는 얇은 줄이라 LCP·첫 칠을 막지 않는다(등장 줄 s.tl 과 별개 줄이라 히어로 등장도 늦추지 않는다). [data-preloader-skip] 단추로 언제든 건너뛴다. [data-preloader-bar] 가 채워지는 막대.
const PRELOADER_SEEN = "wf-preloader-seen"
export function preloaderIntro(s: Scene, band: Element | string | null, { maxMs = PRELOADER_MAX_MS }: { maxMs?: number } = {}) {
  const node = el(s, band)
  if (!node) return null
  let seen = false
  try { seen = sessionStorage.getItem(PRELOADER_SEEN) === "1" } catch { /* 저장소를 못 읽으면 첫 방문으로 본다 */ }
  const p = preloaderIntroPlan({ level: s.level, maxMs, firstVisit: !seen })
  if (!p.renders) return null
  try { sessionStorage.setItem(PRELOADER_SEEN, "1") } catch { /* 못 써도 이번 한 번은 그린다 */ }
  const bar = node.querySelector<HTMLElement>("[data-preloader-bar]") ?? node
  const skip = node.querySelector<HTMLElement>("[data-preloader-skip]")
  const total = p.durationMs / 1000
  node.hidden = false
  const close = () => {
    const hadFocus = node.contains(document.activeElement)
    node.hidden = true
    if (hadFocus) focusHeading("h1")
  }
  const tl = s.add(() => gsap.timeline({ onComplete: close })
    .fromTo(bar, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: total * 0.7, ease: namedEase("out-quart") })
    .to(node, { autoAlpha: 0, duration: total * 0.3, ease: namedEase("in-exit") }))
  const onSkip = () => tl.progress(1)
  skip?.addEventListener("click", onSkip)
  s.onCleanup(() => { skip?.removeEventListener("click", onSkip); node.hidden = true; gsap.set(node, { clearProps: "opacity,visibility" }); gsap.set(bar, { clearProps: "transform" }) })
  return p
}

// blur-to-sharp: 흐림에서 선명으로(카드 blur-to-sharp). 흐림 값은 휩 팬의 것(whipPlan)을 그대로 쓴다. 글은 숨기지 않는다 — 흐림만 걷히고 끝나면 filter 를 지운다.
export function blurToSharp(s: Scene, targets: Targets, { at }: { at?: At } = {}) {
  const p = blurToSharpPlan({ level: s.level })
  if (!p.animates) return null
  return s.tl.from(targets, { filter: `blur(${p.fromBlurPx}px)`, duration: p.durationMs / 1000, ease: namedEase("out-expo"), stagger: 0.06 * s.scale.stagger, clearProps: "filter" }, at)
}

// object-swap-3d: 3D 장면의 오브젝트를 바꿔 끼운다(카드 object-swap-3d). three 를 부르지 않는다 — scene 은 오브젝트 배열(visible·scale·rotation.y)만 본다(5.7 object-3d-orbit 이 three 의 Object3D 를 그대로 넘긴다).
// 바꿈은 사용자 조작(단추·키 → swapTo/next/prev)으로만 일어난다 — 스스로 돌지 않는다. 끌어 돌리기는 고운 포인터 겹에서만(surface 에 touch-action: pan-y 를 준다 — 터치는 스크롤 그대로).
// 동작 줄이기·M0 에서는 장면이 build 를 부르지 않으므로 3D 를 올리지 않고 포스터 그림만 남는다.
export type Swap3dObject = { visible: boolean; scale: { x: number; y: number; z: number }; rotation: { y: number } }
export type Swap3dScene = { objects: Swap3dObject[]; invalidate?: () => void }
export function objectSwap3d(s: Scene, scene: Swap3dScene, { surface = null, start = 0, onSwap }: { surface?: Element | null; start?: number; onSwap?: (index: number) => void } = {}) {
  const items = scene.objects
  const p = objectSwap3dPlan({ level: s.level, items: items.length })
  let index = Math.min(Math.max(0, start), Math.max(0, items.length - 1))
  items.forEach((o, i) => { o.visible = i === index; o.scale.x = o.scale.y = o.scale.z = i === index ? 1 : 0.001 })
  scene.invalidate?.()
  let running: gsap.core.Timeline | null = null
  const swapTo = (to: number) => {
    const next = ((to % items.length) + items.length) % items.length
    if (!p.animates || next === index) return null
    running?.progress(1)
    const out = items[index], into = items[next]
    const outEnd = out.rotation.y + Math.PI / 2, intoEnd = into.rotation.y
    index = next
    into.visible = true
    into.scale.x = into.scale.y = into.scale.z = 0.001
    const half = p.durationMs / 2000
    const tick = () => scene.invalidate?.()
    running = s.add(() => gsap.timeline({ onUpdate: tick, onComplete: () => { out.visible = false; running = null; scene.invalidate?.() } })
      .to(out.scale, { x: 0.001, y: 0.001, z: 0.001, duration: half * 0.8, ease: namedEase("in-exit") }, 0)
      .to(out.rotation, { y: outEnd, duration: half * 0.8, ease: namedEase("in-exit") }, 0)
      .fromTo(into.rotation, { y: intoEnd - Math.PI / 2 }, { y: intoEnd, duration: half * 1.2, ease: namedEase("out-expo") }, half * 0.8)
      .to(into.scale, { x: 1, y: 1, z: 1, duration: half * 1.2, ease: namedEase("out-expo") }, half * 0.8))
    onSwap?.(next)
    return running
  }
  if (surface && p.drag) {
    onPointer(s, (ps) => {
      let from: number | null = null
      listen(ps, surface, {
        pointerdown: (e) => { if (!e.isPrimary) return; from = e.clientX; surface.setPointerCapture?.(e.pointerId) },
        pointermove: (e) => { if (from == null) return; items[index].rotation.y += (e.clientX - from) * 0.01; from = e.clientX; scene.invalidate?.() },
        pointerup: () => { from = null },
        pointercancel: () => { from = null },
      })
    }, true)
  }
  return { get index() { return index }, swapTo, next: () => swapTo(index + 1), prev: () => swapTo(index - 1) }
}

// preview-follow: 목록 항목([data-preview-src])에 올리면 미리보기 그림([data-preview-follow] 안 img)이 포인터를 따라온다(카드 preview-follow).
// 고운 포인터 겹(`(hover: hover) and (pointer: fine)`)에서만 붙는다 — 그 밖에서는 아무것도 달리지 않고 그림은 정지로 남으며 탭·클릭은 링크를 그대로 따라간다.
// 미리보기 요소는 목록 안(position: relative 인 뿌리)에 두고 aria-hidden — 장식 사본이다. 붙을 때 절대 위치·숨김을 입히고, 터치로 바뀌어 겹이 되돌려지면 그 속성을 모두 지운다.
export function previewFollow(s: Scene, list: Element | string | null, { offset = 16, damping = 0.4 }: { offset?: number; damping?: number } = {}) {
  const root = el(s, list)
  const preview = root?.querySelector<HTMLElement>("[data-preview-follow]")
  const p = previewFollowPlan({ level: s.level, hover: true, pointerFine: true })
  if (!root || !preview || !p.animates) return null
  onPointer(s, (ps) => {
    const img = preview.querySelector<HTMLImageElement>("img")
    gsap.set(preview, { position: "absolute", left: 0, top: 0, pointerEvents: "none", autoAlpha: 0 })
    const qx = gsap.quickTo(preview, "x", { duration: damping, ease: "power3.out" })
    const qy = gsap.quickTo(preview, "y", { duration: damping, ease: "power3.out" })
    const hide = () => { gsap.to(preview, { autoAlpha: 0, duration: 0.15, overwrite: "auto" }) }
    listen(ps, root, {
      pointermove: (e) => { const b = root.getBoundingClientRect(); qx(e.clientX - b.left + offset); qy(e.clientY - b.top + offset) },
      pointerover: (e) => {
        const item = (e.target as Element).closest<HTMLElement>("[data-preview-src]")
        if (!item || !root.contains(item)) return
        const src = item.dataset.previewSrc
        if (img && src && img.getAttribute("src") !== src) img.setAttribute("src", src)
        gsap.to(preview, { autoAlpha: 1, duration: 0.2, overwrite: "auto" })
      },
      pointerleave: hide,
    })
    ps.onCleanup(() => gsap.set(preview, { clearProps: "position,left,top,pointerEvents,opacity,visibility,transform" }))
  }, true)
  return p
}

// ── 전환 ──────────────────────────────────────────────────────────────
// page-transition(view-transition-page): 쪽 전환을 View Transitions API 로 한다. update 는 새 쪽의 DOM 이 자리 잡았을 때 끝나는 함수(Promise)여야 한다.
// 전환이 꺼진 경우(동작 줄이기 · API 없음 · M0)에는 바로 바꾼다. 어느 쪽이든 끝난 뒤 초점을 새 쪽 h1 로 옮긴다(UX J03 — 전환 뒤 초점이 이전 쪽 링크에 남지 않게).
export function pageTransition(update: () => void | Promise<void>, { reducedMotion, level }: { reducedMotion?: boolean; level?: MotionLevel } = {}) {
  const d = document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } }
  const p = pageTransitionPlan({ reducedMotion: reducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches, level, supported: typeof d.startViewTransition === "function" })
  const done = () => { if (p.moveFocus) focusHeading(p.focusTarget) }
  if (!p.animates || !d.startViewTransition) return Promise.resolve(update()).then(done)
  return d.startViewTransition(update).finished.then(done, done)
}

// view-transition: 지원하는 브라우저면 문서 전환으로, 아니면(또는 동작 줄이기) 바로 바꾼다.
export function viewTransition(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!d.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return void update()
  d.startViewTransition(update)
}
