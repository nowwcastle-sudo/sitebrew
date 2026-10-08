"use client"

import * as React from "react"
import { gsap } from "gsap"
import { CustomEase } from "gsap/CustomEase"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

import { bezierArgs, entranceSkipped, levelFromEnter, levelFromVar, parseDuration, scaleFor, sceneBranch, scrubEnd, type LevelScale, type MotionLevel } from "@/components/motion/motion-scale"

// GSAP 장면 훅(motion-gsap — 모션 키트의 첫 설치형 기법 부품). 한 구획(히어로 등)의 모든 트윈·ScrollTrigger·SplitText 를
// gsap.matchMedia 문맥 하나에 모으고, 컴포넌트가 사라지면 mm.revert() 로 인라인 스타일까지 되돌린다.
//   · 동작 줄이기(prefers-reduced-motion: reduce) 또는 M0 → build 를 부르지 않는다. 트윈 0개, DOM 의 최종 상태 그대로(설정 변화도 matchMedia 가 듣는다).
//   · matchMedia 조건은 동작 줄이기 하나다 — 포인터 종류(마우스 ↔ 터치)가 바뀌어도 등장을 다시 돌리지 않는다. 포인터 겹(s.pointer)만 따로 붙였다 뗀다.
//   · 길이·곡선은 레시피 모션 토큰(--duration-enter·--duration-hover·--duration-press·--ease-standard·--ease-emphasized·--ease-in-screen)을
//     구획에서 읽어 CustomEase 로 등록한다 — 레시피가 바뀌면 같은 안무가 그 레시피의 속도로 돈다. 거리·연쇄·깊이는 강도(M1~M3) 배율.
//   · 유휴 반복(s.loop)은 화면 밖·숨은 탭에서 멈춘다(IntersectionObserver + visibilitychange).
//   · 등장이 끝나면 뿌리에 data-wf-entered 를 달고 wf:entered 이벤트를 낸다(정지 갈래는 곧바로). 관문·촬영은 이것을 기다린다.
//   · 서버 렌더(SSR) 첫 화면: motion-boot 의 머리 스크립트·CSS 가 등장 대상([data-enter])을 첫 칠 전에 숨긴다. 장면이 시작하면(data-wf-scene)
//     숨김이 풀리고, 안전장치(DOMContentLoaded 부터 운영 1.5초·개발 8초)가 먼저 드러낸 뒤(<html data-motion="late">) 하이드레이션된
//     서버 HTML 구획은 등장을 끝 상태로 건너뛴다(숨김 → 재등장 번쩍임 없음, 개발에서는 console.info 한 줄).
gsap.registerPlugin(CustomEase, ScrollTrigger, SplitText)

export type SceneTokens = { enter: number; hover: number; press: number; ease: { standard: string; emphasized: string; inScreen: string } }
export type Scene = {
  root: HTMLElement
  level: MotionLevel
  scale: LevelScale
  t: SceneTokens
  // 등장 순서 한 줄(0~2.5초). 기본 곡선·길이는 토큰. 끝나면 장면이 data-wf-entered·wf:entered 를 낸다.
  tl: gsap.core.Timeline
  // 구획 안 선택자(없으면 빈 배열).
  q: (sel: string) => HTMLElement[]
  // 유휴 반복 등록 — M1 이하면 만들지 않고 null(브리프: 유휴 반복은 M2~M3).
  loop: (make: () => gsap.core.Animation) => gsap.core.Animation | null
  // 스크롤 연동 구간: 구획 위끝이 화면 위끝에 닿는 곳부터 뷰포트 60%(또는 문서 끝)까지, 강도만큼 따라잡는 scrub.
  scroll: (extra?: ScrollTrigger.Vars) => ScrollTrigger.Vars
  // 지금 고운 포인터(마우스·트랙패드)인가. 포인터 효과는 이 값을 build 때 읽지 말고 s.pointer 로 단다(포인터 종류가 바뀌면 그 겹만 붙였다 뗀다).
  readonly finePointer: boolean
  // 포인터 겹: 고운 포인터일 때만 fn 을 제 문맥에서 돌리고, 터치로 바뀌면 되돌린다(등장은 다시 돌지 않는다). afterEnter 면 등장이 끝난 뒤부터.
  pointer: (fn: (p: Scene) => void, opts?: { afterEnter?: boolean }) => void
  // 나중에(콜백 안에서) 만드는 트윈을 장면 문맥에 넣는다 — 장면이 되돌려질 때 함께 되돌려진다(손으로 kill 하지 않는다).
  add: <R>(fn: () => R) => R
  // 등장이 끝난 뒤 장면 문맥에서 돈다(커서 깜박임·유휴 반복 등). 등장을 건너뛰면 곧바로.
  afterEnter: (fn: () => void) => void
  // 정리할 것(이벤트 해제 등)을 등록 — 장면(포인터 겹이면 그 겹)이 되돌려질 때 부른다.
  onCleanup: (fn: () => void) => void
  // 포인터 겹 안의 장면인가(도우미가 겹을 다시 만들지 않게).
  readonly inPointer: boolean
}
export type SceneBuild = (s: Scene) => void

// 등장 끝 신호(뿌리 요소에서 버블링). detail.skipped: 안전장치가 먼저 드러내 등장을 건너뛰었다 · detail.static: 정지 갈래.
export const ENTERED_EVENT = "wf:entered"
export const ENTRANCE_ID = "wf-enter"

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect
const REDUCE = "(prefers-reduced-motion: reduce)"
const FINE = "(hover: hover) and (pointer: fine)"
const easeCache = new Map<string, string>()

// 토큰 곡선 → 등록한 CustomEase 이름. 읽을 수 없으면 fallback(GSAP 내장 곡선).
function easeOf(css: string, fallback: string) {
  const args = bezierArgs(css)
  if (!args) return fallback
  let name = easeCache.get(args)
  if (!name) {
    name = `wf-${easeCache.size}`
    CustomEase.create(name, args)
    easeCache.set(args, name)
  }
  return name
}

export function readTokens(el: Element): SceneTokens {
  const cs = getComputedStyle(el)
  const v = (k: string) => cs.getPropertyValue(k)
  return {
    enter: parseDuration(v("--duration-enter")) ?? 0.5,
    hover: parseDuration(v("--duration-hover")) ?? 0.2,
    press: parseDuration(v("--duration-press")) ?? 0.12,
    ease: {
      standard: easeOf(v("--ease-standard"), "expo.out"),
      emphasized: easeOf(v("--ease-emphasized"), "power4.out"),
      inScreen: easeOf(v("--ease-in-screen"), "power3.inOut"),
    },
  }
}

type QaWindow = { __WF_QA?: unknown; __wfGsap?: typeof gsap; __wfEnterUncovered?: string[] }

function signalEntered(root: HTMLElement, detail: { skipped?: boolean; static?: boolean }) {
  root.dataset.wfEntered = detail.static ? "static" : detail.skipped ? "skipped" : ""
  root.dispatchEvent(new CustomEvent(ENTERED_EVENT, { bubbles: true, detail }))
}

// 관문용(window.__WF_QA 일 때만): 첫 칠 전에 숨지 않는 등장 대상 — 시작 상태를 입히는 트윈(from·fromTo)의 요소 가운데 [data-enter] 아래가 아닌 것.
function uncoveredTargets(root: HTMLElement, tl: gsap.core.Timeline) {
  const out: string[] = []
  for (const tw of tl.getChildren(true, true, false) as gsap.core.Tween[]) {
    const v = tw.vars as gsap.TweenVars & { runBackwards?: boolean }
    if (!v.runBackwards && !v.startAt) continue
    for (const x of tw.targets()) {
      if (!(x instanceof Element) || !root.contains(x) || x.closest("[data-enter]")) continue
      const cls = typeof x.className === "string" ? x.className : x.getAttribute("class") ?? ""
      out.push(`${x.tagName.toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).slice(0, 2).join(".") : ""}`)
    }
  }
  return [...new Set(out)]
}

// 서버 HTML 로 이미 칠해진 「숨기지 않는 대상」(data-enter="keep" — 공공 원형의 누르는 요소 등)의 등장은 끝 상태로 둔다: 하이드레이션 때
// 시작 자세로 한 번 튀었다가 돌아오지 않게. 클라이언트에서 처음 붙는 구획은 그대로 움직인다.
// 「숨기지 않는 대상」은 data-enter="keep" 이거나, 쪽의 첫 화면 구획([data-wf-first] — motion-boot MOTION_GATE_CSS)이 감싼 안이다(P3-4 PERF2).
// 화면 안 대상: motion-boot 가 첫 칠 전에 화면 안에 든 것으로 찾아 가림에서 뺀 등장 대상(window.__wfFold, QFIX3-PERF) — 첫 구획과 같이 끝 상태로 둔다.
const keptFromFirstPaint = (e: Element) => {
  if (e.closest("[data-wf-first]") !== null) return true
  const g = e.closest("[data-enter]")
  if (g?.getAttribute("data-enter") === "keep") return true
  return !!g && ((window as unknown as { __wfFold?: Element[] }).__wfFold?.includes(g) ?? false)
}
// 접힘선은 요소 단위다 — 한 트윈(stagger 포함)의 대상이 섞이면(셋 중 둘만 화면 안) 화면 안 대상만 끝 상태로 두고 트윈에서 뺀다
// (FINAL-WF B2). 통째로 끝내면 화면 밖 대상의 등장이 사라지고, 그대로 두면 화면 안 대상이 시작 상태로 되돌아가 번쩍인다.
// 끝 상태로 한 번 그린 뒤(이벤트 없이) kept 대상만 트윈에서 떼고 처음으로 되감으면 남은 대상은 시작 상태·등장 그대로다.
function settleKept(tl: gsap.core.Timeline) {
  for (const tw of tl.getChildren(true, true, false) as gsap.core.Tween[]) {
    const els = tw.targets().filter((x): x is Element => x instanceof Element)
    const kept = els.filter(keptFromFirstPaint)
    if (!kept.length) continue
    if (kept.length === els.length) { tw.progress(1); tw.kill(); continue }
    tw.progress(1, true)
    for (const el of kept) tw.kill(el)
    tw.progress(0, true)
  }
}
// 하이드레이션 커밋은 쪼갤 수 없다 — React 는 렌더를 5 ms 씩 끊어도 레이아웃 효과는 커밋 안에서 한꺼번에 돈다.
// 한 쪽에 장면이 일곱 개(local 홈)면 효과 안의 트윈 만들기·getComputedStyle(스타일 강제 재계산)이 한 작업 150 ms 를 넘어 TBT 가 됐다
// (LOCALTBT 실측: 커밋 작업 156 ms 중 GSAP 이 110 ms · 모의 TBT 400~600 ms → lh-perf 87). 서버 HTML 로 이미 칠해진 구획의 첫 장면은
// 장면마다 새 작업에서 세운다 — 장면 하나가 한 작업이라 어느 작업도 길어지지 않는다. 숨은 등장 대상은 장면이 서야 드러나므로(data-wf-scene)
// 번쩍임은 없고(시작 상태와 숨김 해제가 같은 작업), 화면 안 대상은 처음부터 keep 이다.
const sceneQueue: { run: () => void; live: boolean }[] = []
let scenePumping = false
function pumpScenes() {
  const job = sceneQueue.shift()
  if (!job) { scenePumping = false; return }
  // 장면 하나가 던져도 큐는 멈추지 않는다(FINAL-WF B1) — 오류는 남기고 다음 장면을 이어 세운다.
  try {
    if (job.live) job.run()
  } catch (err) {
    console.error("[motion-gsap] 장면을 세우지 못했다", err)
  } finally {
    setTimeout(pumpScenes, 0)
  }
}
function deferScene(run: () => void) {
  const job = { run, live: true }
  sceneQueue.push(job)
  if (!scenePumping) { scenePumping = true; setTimeout(pumpScenes, 0) }
  return () => { job.live = false }
}
const noopSubscribe = () => () => {}
// 개발에서 건너뛰기를 알린 구획(한 구획에 한 줄 — StrictMode 가 효과를 두 번 돌려도).
const skipLogged = new WeakSet<Element>()

// ref: 구획 뿌리. build: 안무(한 번 — 동작 줄이기 설정이 바뀌면 되돌리고 다시). level: 레시피 motion(M0~M3) — 없으면 뿌리의 --wf-motion,
// 그것도 없으면 --duration-enter 로 짐작. 블록은 level 을 넘기지 않는다(레시피 구획의 값을 장면이 직접 읽는다).
export function useGsapScene<T extends HTMLElement>(ref: React.RefObject<T | null>, build: SceneBuild, { level, deps = [] }: { level?: MotionLevel; deps?: React.DependencyList } = {}) {
  // build 는 deps 가 바뀔 때만 다시 돈다(렌더마다 새 함수라 의존에 넣지 않는다). 의존 배열의 길이는 늘 셋이다.
  const key = deps.join("|")
  // 첫 렌더가 하이드레이션인가(서버 스냅숏 = true) — 서버 HTML 이 이미 칠해진 구획. 첫 값만 붙든다.
  const hydrating = React.useSyncExternalStore(noopSubscribe, () => false, () => true)
  const fromServer = React.useRef(hydrating)
  const built = React.useRef(false)
  useIsoLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const setup = () => {
    built.current = true
    const mm = gsap.matchMedia(root)
    const loops: gsap.core.Animation[] = []
    let inView = true
    // 사용자 정지(P3-5 MOTKIT — 5초 넘는 유휴 반복의 정지 단추, WCAG 2.2.2): 부르는 쪽이 뿌리에 data-wf-user-paused 를 달면 유휴 반복이 멈추고,
    // 화면에 다시 들어와도 다시 돌지 않는다. 속성은 블록의 단추 상태가 정한다(장면은 듣기만).
    const syncLoops = () => {
      const run = inView && document.visibilityState !== "hidden" && !root.hasAttribute("data-wf-user-paused")
      for (const a of loops) {
        if (run) a.resume()
        else a.pause()
      }
      root.toggleAttribute("data-wf-paused", !run)
    }
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((es) => { inView = es.some((e) => e.isIntersecting); syncLoops() })
    io?.observe(root)
    const userPause = typeof MutationObserver === "undefined" ? null : new MutationObserver(syncLoops)
    userPause?.observe(root, { attributes: true, attributeFilter: ["data-wf-user-paused"] })
    document.addEventListener("visibilitychange", syncLoops)

    // "all" 은 늘 참인 조건이다(없으면 동작 줄이기가 꺼진 기기에서 build 가 불리지 않는다).
    mm.add({ all: "all", reduce: REDUCE }, (c) => {
      const ctx = c as gsap.Context & { conditions: { reduce: boolean } }
      const { reduce } = ctx.conditions
      const t = readTokens(root)
      // 강도: level 을 주면 그것, 아니면 뿌리의 --wf-motion 계산값(조상 [data-recipe] 구획에서 이어받는다), 그것도 없으면 등장 길이로 짐작.
      // 레이아웃 효과 안에서 첫 트윈 전에 읽으므로 하이드레이션 뒤 값이 바뀌어 장면을 다시 세우는 일(등장 두 번)이 없다(리뷰 I-7).
      const lv = level ?? levelFromVar(getComputedStyle(root).getPropertyValue("--wf-motion")) ?? levelFromEnter(t.enter)
      const branch = sceneBranch(reduce, lv)
      root.dataset.wfScene = branch
      if (branch === "static") {
        signalEntered(root, { static: true })
        return () => { delete root.dataset.wfEntered }
      }
      const cleanups: (() => void)[] = []
      const whenEntered: (() => void)[] = []
      let entered = false, skip = false
      const scale = scaleFor(lv)
      // id: 관문의 유휴 정지(FREEZE_IDLE)가 등장 줄을 알아본다 — 끝나지 않은 채 남아 있으면 「등장이 멈췄다」로 경고한다.
      const tl = gsap.timeline({ id: ENTRANCE_ID, defaults: { duration: t.enter, ease: t.ease.standard } })
      const fineMq = window.matchMedia(FINE)
      type Layer = { fn: (p: Scene) => void; ready: boolean; ctx: gsap.Context | null }
      const layers: Layer[] = []
      const attach = (L: Layer) => {
        if (L.ctx || !L.ready || !fineMq.matches) return
        const own: (() => void)[] = []
        // 겹 안의 add 는 그 겹의 문맥에 넣는다 — 터치로 바뀌어 겹을 되돌릴 때 hover 중에 만든 트윈도 함께 되돌린다.
        const p: Scene = { ...base, onCleanup: (fn) => own.push(fn), add: <R,>(fn: () => R): R => (L.ctx ? (L.ctx.add(fn) as R) : fn()), finePointer: true, inPointer: true }
        L.ctx = gsap.context(() => {
          L.fn(p)
          return () => { for (const fn of own.splice(0)) fn() }
        }, root)
      }
      const detach = (L: Layer) => { L.ctx?.revert(); L.ctx = null }
      const onFine = () => { for (const L of layers) if (fineMq.matches) attach(L); else detach(L) }
      fineMq.addEventListener("change", onFine)
      cleanups.push(() => { fineMq.removeEventListener("change", onFine); for (const L of layers) detach(L) })

      const base = {
        root, level: lv, scale, t, tl,
        q: (sel: string) => gsap.utils.toArray<HTMLElement>(sel, root),
        loop: (make: () => gsap.core.Animation) => {
          if (!scale.loop) return null
          const a = make()
          loops.push(a)
          syncLoops()
          return a
        },
        scroll: (extra: ScrollTrigger.Vars = {}): ScrollTrigger.Vars => ({
          trigger: root, start: "top top", end: () => `+=${scrubEnd(window.innerHeight, ScrollTrigger.maxScroll(window))}`,
          scrub: scale.scrub || true, invalidateOnRefresh: true, ...extra,
        }),
        add: <R,>(fn: () => R): R => ctx.add(fn) as R,
        afterEnter: (fn: () => void) => { if (entered) ctx.add(fn); else whenEntered.push(() => ctx.add(fn)) },
        pointer: (fn: (p: Scene) => void, { afterEnter = false }: { afterEnter?: boolean } = {}) => {
          const L: Layer = { fn, ready: !afterEnter || entered, ctx: null }
          layers.push(L)
          if (L.ready) attach(L)
          else whenEntered.push(() => { L.ready = true; attach(L) })
        },
        onCleanup: (fn: () => void) => cleanups.push(fn),
      }
      const s: Scene = { ...base, get finePointer() { return fineMq.matches }, inPointer: false }
      const finish = () => {
        if (entered) return
        entered = true
        for (const fn of whenEntered.splice(0)) fn()
        signalEntered(root, { skipped: skip })
      }
      tl.eventCallback("onComplete", finish)
      build(s)
      // 촬영·관문이 등장 시작 시각을 읽는다(performance.now 기준 ms).
      root.dataset.wfT0 = String(Math.round(performance.now()))
      const w = window as unknown as QaWindow
      // 관문(Task 11 §3)이 중간 프레임을 멈춰 재도록 — window.__WF_QA 가 있을 때만 gsap 과 첫 칠 전에 숨지 않는 등장 대상 목록을 내어 준다.
      if (w.__WF_QA) {
        w.__wfGsap = gsap
        w.__wfEnterUncovered = uncoveredTargets(root, tl)
      }
      if (fromServer.current) settleKept(tl)
      // 안전장치가 이미 드러낸 서버 HTML → 등장을 끝 상태로 건너뛴다(같은 작업 안이라 시작 상태가 칠해지지 않는다). 빈 줄도 곧바로 끝.
      if (entranceSkipped(fromServer.current, document.documentElement.dataset.motion)) {
        skip = true
        tl.progress(1)
        if (process.env.NODE_ENV !== "production" && !skipLogged.has(root)) {
          skipLogged.add(root)
          console.info(`[motion-gsap] 등장을 건너뛰었다: 서버 HTML 이 안전장치(MotionBoot failsafeMs)보다 늦게 하이드레이션돼 이미 끝 모양으로 보였다 — 느린 기기에서도 같다. 개발 기본값 8초, prop 으로 바꾼다.`)
        }
      }
      else if (tl.duration() === 0) tl.progress(1)
      if (skip || tl.duration() === 0) finish()
      return () => {
        for (const fn of cleanups.splice(0)) fn()
        loops.length = 0
        delete root.dataset.wfT0
        delete root.dataset.wfEntered
      }
    })
    return () => {
      mm.revert()
      io?.disconnect()
      userPause?.disconnect()
      document.removeEventListener("visibilitychange", syncLoops)
      root.removeAttribute("data-wf-paused")
      delete root.dataset.wfScene
    }
    }
    if (fromServer.current && !built.current) {
      let off: (() => void) | undefined
      const cancel = deferScene(() => { off = setup() })
      return () => { cancel(); off?.() }
    }
    return setup()
  }, [ref, level, key])
}
