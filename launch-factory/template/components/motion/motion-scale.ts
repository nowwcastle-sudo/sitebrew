export type MotionLevel = "M0" | "M1" | "M2" | "M3"
export const MOTION_LEVELS: MotionLevel[] = ["M0", "M1", "M2", "M3"]

// 배율: distance(이동 거리·px 값에 곱함) · rotate(각도) · stagger(연쇄 간격) · depth(시차 깊이) · scrub(스크롤 따라잡기 초) · loop(유휴 반복 허용).
// M1 은 거리 0.6·연쇄 0.7 — 정돈되고 빠르게. M3 는 1.5·1.2 — 대담하게. 유휴 반복은 M2·M3 만(브리프 §2 「ambient only M2–M3」).
export type LevelScale = { distance: number; rotate: number; stagger: number; depth: number; scrub: number; loop: boolean }
export const LEVEL_SCALE: Record<MotionLevel, LevelScale> = {
  M0: { distance: 0, rotate: 0, stagger: 0, depth: 0, scrub: 0, loop: false },
  M1: { distance: 0.6, rotate: 0.5, stagger: 0.7, depth: 0.6, scrub: 0.3, loop: false },
  M2: { distance: 1, rotate: 1, stagger: 1, depth: 1, scrub: 0.5, loop: true },
  M3: { distance: 1.5, rotate: 1.5, stagger: 1.2, depth: 1.6, scrub: 0.8, loop: true },
}

export const isLevel = (v: unknown): v is MotionLevel => typeof v === "string" && (MOTION_LEVELS as string[]).includes(v)
// 모르는 값은 M2(모션 토큰 기본값과 같다 — gen-kits MOTION_TOKENS).
export const scaleFor = (level: unknown): LevelScale => LEVEL_SCALE[isLevel(level) ? level : "M2"]

// "300ms" · "0.5s" · "700" → 초. 비었거나 읽을 수 없으면 null.
export function parseDuration(v: string | null | undefined): number | null {
  const m = String(v ?? "").trim().match(/^(-?[\d.]+)\s*(ms|s)?$/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return m[2] === "s" ? n : n / 1000
}

// "cubic-bezier(0.23, 1, 0.32, 1)" → "0.23,1,0.32,1"(CustomEase 가 읽는 네 수). 다른 모양이면 null — 부르는 쪽이 기본 곡선을 쓴다.
export function bezierArgs(v: string | null | undefined): string | null {
  const m = String(v ?? "").trim().match(/^cubic-bezier\(\s*([^)]*)\)$/)
  if (!m) return null
  const xs = m[1].split(",").map((s) => Number(s.trim()))
  if (xs.length !== 4 || xs.some((x) => !Number.isFinite(x))) return null
  return xs.join(",")
}

// 레시피가 싣는 --wf-motion(0|1|2|3, recipe.mjs recipeMarkers) → 강도. 비었거나 0~3 정수가 아니면 null — 부르는 쪽이 등장 길이로 짐작한다(levelFromEnter).
// 장면 훅은 이것을 장면 뿌리의 계산값에서 읽는다(레이아웃 효과 안, 첫 트윈 전 — P3-2 Task 1c, 리뷰 I-7).
export function levelFromVar(v: string | null | undefined): MotionLevel | null {
  const s = String(v ?? "").trim()
  return s === "0" || s === "1" || s === "2" || s === "3" ? (`M${s}` as MotionLevel) : null
}

// 레시피 머리 없이 토큰만 있는 소비자: 등장 길이로 강도를 짐작한다(M0 0ms · M1 300 · M2 500 · M3 700 — gen-kits MOTION_TOKENS).
export function levelFromEnter(seconds: number | null): MotionLevel {
  if (seconds == null) return "M2"
  if (seconds <= 0) return "M0"
  if (seconds <= 0.35) return "M1"
  if (seconds <= 0.6) return "M2"
  return "M3"
}

// 장면 갈래: 동작 줄이기이거나 M0 이면 「정지」 — 트윈을 하나도 만들지 않고 DOM 의 최종 상태 그대로 둔다(0 running).
export type SceneBranch = "static" | "motion"
export const sceneBranch = (reduce: boolean, level: MotionLevel): SceneBranch => (reduce || level === "M0" ? "static" : "motion")

// 스크롤 연동 구간 끝(px): 뷰포트 높이의 share(기본 60%) — 문서가 그만큼 스크롤되지 않으면 끝까지 스크롤한 값에서 끝난다
// (히어로만 있는 첫 화면은 180~400px 만 스크롤된다). 0 이하면 1(ScrollTrigger 가 빈 구간을 받지 않게).
export const scrubEnd = (viewport: number, maxScroll: number, share = 0.6) => Math.max(1, Math.round(Math.min(viewport * share, maxScroll)))

// 포인터 → 기울임 각(도). 상자 가운데가 0, 가장자리가 ±max. rx 는 위가 +(위로 젖힘), ry 는 오른쪽이 +.
export function tiltAngles(x: number, y: number, box: { left: number; top: number; width: number; height: number }, max: number) {
  const nx = clamp((x - box.left) / Math.max(1, box.width) - 0.5, -0.5, 0.5)
  const ny = clamp((y - box.top) / Math.max(1, box.height) - 0.5, -0.5, 0.5)
  return { rx: round(-ny * 2 * max), ry: round(nx * 2 * max) }
}

// 자석 버튼: 포인터가 버튼 가운데에서 radius 안에 있으면 그쪽으로 strength 비율만큼(최대 maxPx) 끌린다. 밖이면 0.
export function magneticOffset(x: number, y: number, box: { left: number; top: number; width: number; height: number }, { strength = 0.3, radius = 120, maxPx = 10 } = {}) {
  const dx = x - (box.left + box.width / 2)
  const dy = y - (box.top + box.height / 2)
  const d = Math.hypot(dx, dy)
  if (d > radius + Math.max(box.width, box.height) / 2) return { x: 0, y: 0 }
  return { x: round(clamp(dx * strength, -maxPx, maxPx)), y: round(clamp(dy * strength, -maxPx, maxPx)) }
}

// 서버 HTML 로 칠해진 구획이 motion-boot 안전장치가 드러낸 뒤(<html data-motion="late">) 하이드레이션되면 등장을 끝 상태로 건너뛴다 —
// 이미 끝 모양으로 보였으니 시작 자세로 되돌리면 「보임 → 숨김 → 재등장」 번쩍임이다. 속성 상태로 판정하므로 안전장치 뒤에 늦게 스트리밍된
// HTML 도 같다. 클라이언트에서 처음 붙는 구획(fromServer false)은 늦더라도 그대로 움직인다.
export const entranceSkipped = (fromServer: boolean, motion: string | null | undefined) => fromServer && motion === "late"

// countUp 이 세는 동안 붙드는 최소 폭(px, 0.01 올림). 글자 폭(Range)은 안쪽 여백·테두리를 빼고 잰 값인데, border-box(Tailwind preflight)에서는
// min-inline-size 가 여백·테두리를 포함하므로 그만큼 더한다.
export function countUpHold(natural: number, tab: number, cs: { boxSizing: string; paddingLeft: string; paddingRight: string; borderLeftWidth: string; borderRightWidth: string }) {
  const edge = cs.boxSizing === "border-box" ? [cs.paddingLeft, cs.paddingRight, cs.borderLeftWidth, cs.borderRightWidth].reduce((a, v) => a + (parseFloat(v) || 0), 0) : 0
  return Math.ceil((Math.max(natural, tab) + edge) * 100) / 100
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const round = (v: number) => Math.round(v * 1000) / 1000 + 0

// ── 모션 그래픽 기법(P3-5 MOTKIT) — 순수 수치. 근거는 references/motion/effects.json(MOTRES 카드)의 parameters 이고 카드 id 를 줄마다 적는다.
//    제작자 프롬프트 원문은 옮기지 않는다(references/motion/prompts/INDEX.md 규칙) — 수치·용어만.

// 이징 토큰(카드 easing·ease-out): 이름 → cubic-bezier. 들어옴은 out, 나감은 in, 화면 안 이동은 in-out(카드 easing 의 rule). 한 화면에 곡선 3종 이내.
// out 이 기본값이다(DEFAULT_EASE) — 키트의 새 도우미는 곡선을 주지 않으면 out 계열로 들어온다. 레시피 토큰(--ease-standard 등)은 그대로이고
// 이 표는 그 위에 기법마다 이름 붙인 곡선을 더한다(장면이 CustomEase 로 한 번 등록 — gsap-techniques easeOf).
export const EASES = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)", // 기본 들어옴 = 키트 --ease-standard(ease-out quint 근사)
  "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)", // ease-out 「중」(카드 ease-out — --ease-out-quart)
  "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)", // ease-out 「강」 — 글자 마스크 리빌·키네틱 타이포(카드 kinetic-typography·text-mask-reveal)
  "out-lower": "cubic-bezier(0.22, 1, 0.36, 1)", // 로어 서드 들어옴(카드 lower-third easing.in)
  "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)", // 펀치 인 착지 오버슈트(카드 punch-in) — 동작 줄이기에서는 장면 자체가 정지 갈래다
  "in-out-whip": "cubic-bezier(0.76, 0, 0.24, 1)", // 휩 팬 — 빠르게 떠나 빠르게 닿는다(카드 whip-pan·clip-path-wipe)
  drift: "cubic-bezier(0.37, 0, 0.63, 1)", // 켄 번스 느린 줌·팬(카드 ken-burns sine.inOut)
  "in-exit": "cubic-bezier(0.4, 0, 1, 1)", // 나감(카드 lower-third easing.out power2.in — 키트 --ease-exit)
} as const
export type EaseName = keyof typeof EASES
export const DEFAULT_EASE: EaseName = "out"
export const isOutEase = (n: string) => n === "out" || n.startsWith("out-")

// 기법별 길이·거리 표(초·배율·%). 카드 범위 안의 M2 값 — 강도(LEVEL_SCALE)는 도우미가 곱한다.
export const TECH = {
  // 카드 kinetic-typography: 글자 20~30ms·낱말 60~120ms 연쇄, 히어로 전체 1.2s 이내(M3 showpiece 2s), 마스크 안 yPercent 100~120.
  kinetic: { chars: 0.025, words: 0.08, lines: 0.12, perUnit: 0.6, totalMax: 1.2, showpieceMax: 2, yPercent: 110, waveEm: 0.16 },
  // 카드 lower-third: 들어옴 400~700ms · 머무름 2.5~6s · 나감 250~450ms, 막대 → 글 연쇄 80~150ms, 밀려 들어오는 거리 24~80px.
  lowerThird: { in: 0.55, hold: 4.5, out: 0.35, stagger: 0.1, slidePx: 40 },
  // 카드 ken-burns: 장마다 6~12s, 교차 0.8~1.5s, 확대 1.08~1.2, 팬 2~6%.
  kenBurns: { perSlide: 7, crossfade: 1.2, scale: 1.12, pan: 3 },
  // 카드 punch-in: 들어옴 180~450ms · 착지 250~500ms, 글자 시작 배율 1.1~1.3, 사진·영상 1.4~2.5, 오버슈트 1.04~1.1.
  punchIn: { in: 0.32, settle: 0.38, text: 1.2, media: 1.6, overshoot: 1.06 },
  // 카드 stagger: 형제 30~80ms(기본 60), 항목마다 400~800ms, 전체 1.2s 이내, 첫 화면은 지연 합 300ms 이하, 8개 넘으면 묶는다.
  stagger: { each: 0.06, perItem: 0.6, totalMax: 1.2, firstScreenMax: 0.3, maxItems: 8, y: 24 },
  // 카드 whip-pan: 전체 240~400ms(M3 showpiece 350~700), 가로 60~100%, 흐림 8~28px(가운데에서만), 기울임 ±12°.
  whip: { total: 0.36, showpiece: 0.55, xPercent: 100, blur: 18, skew: 8 },
} as const

// 등장 뒤 강조(액센트)는 이 시간(초)만큼 기다렸다 시작한다. 서버 렌더 첫 화면의 keep 글은 하이드레이션 때 끝 상태로 두고(use-gsap-scene settleKept),
// 번쩍임 관문(ssr-flash)은 등장 끝 신호 + 0.8초까지 keep 상자가 끝 프레임과 같은지 본다 — 강조가 그 창 안에서 글을 옮기면 「번쩍임」이다.
export const ACCENT_DELAY = 1.6

// 연쇄 간격(초): n 개가 each 간격으로 들어오되 마지막 시작이 cap 을 넘지 않게 줄인다(카드 stagger·kinetic 의 totalMax). n ≤ 1 이면 0.
export function staggerEach(n: number, each: number, cap: number) {
  if (n <= 1) return 0
  return Math.floor(Math.min(each, Math.max(0, cap) / (n - 1)) * 1e4) / 1e4 // 내림 — 올림하면 마지막 시작이 상한을 넘는다
}

// 카드·목록 연쇄(카드 stagger): 8개까지는 하나씩, 넘으면 묶음으로(같은 묶음은 함께 — 묶음 수가 8 이하). 첫 화면이면 지연 합 300ms 이하.
// → { each(초), groups: 항목 번호 묶음[] }
export function staggerPlan(n: number, { firstScreen = false, each = TECH.stagger.each as number }: { firstScreen?: boolean; each?: number } = {}) {
  const cap = firstScreen ? TECH.stagger.firstScreenMax : TECH.stagger.totalMax - TECH.stagger.perItem
  const size = n > TECH.stagger.maxItems ? Math.ceil(n / TECH.stagger.maxItems) : 1
  const groups: number[][] = []
  for (let i = 0; i < n; i += size) groups.push(Array.from({ length: Math.min(size, n - i) }, (_, k) => i + k))
  return { each: staggerEach(groups.length, each, cap), groups }
}

// 키네틱 타이포 연쇄(초): 단위(chars·words·lines)·개수 → 간격. 마지막 단위가 perUnit 만큼 움직여 끝나는 시각이 상한(1.2s, showpiece 2s) 안.
export function kineticStagger(n: number, by: "chars" | "words" | "lines", showpiece = false) {
  const k = TECH.kinetic
  return staggerEach(n, k[by], (showpiece ? k.showpieceMax : k.totalMax) - k.perUnit)
}

// 켄 번스 한 장의 시작·끝 자세. 장마다 확대 ↔ 축소, 팬 방향(왼·오른·위·아래 순)을 번갈아 — 이웃한 두 장이 같은 쪽으로 움직이지 않는다.
// 덮개 조건: 칸 가장자리가 비지 않게 배율 ≥ 1 + 2 × |팬%|/100(가운데 기준 확대 + 이동). 그래서 「축소」도 1 이 아니라 그 하한에서 멈춘다.
export type KbPose = { scale: number; xPercent: number; yPercent: number }
export function kenBurnsPlan(n: number, { scale = TECH.kenBurns.scale as number, pan = TECH.kenBurns.pan as number, intensity = 1 }: { scale?: number; pan?: number; intensity?: number } = {}) {
  const p = round(pan * intensity)
  const low = round(1 + (2 * p) / 100 + 0.004)
  const high = round(Math.max(low + 0.02, 1 + (scale - 1) * intensity + (2 * p) / 100))
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  return Array.from({ length: Math.max(1, n) }, (_, i) => {
    const [dx, dy] = dirs[i % dirs.length]
    const zoomIn = i % 2 === 0
    const from: KbPose = { scale: zoomIn ? low : high, xPercent: round(-dx * p * 0.5), yPercent: round(-dy * p * 0.5) }
    const to: KbPose = { scale: zoomIn ? high : low, xPercent: round(dx * p * 0.5), yPercent: round(dy * p * 0.5) }
    return { from, to }
  })
}
// 자세가 칸을 덮는가(가장자리가 비지 않는다) — 시험·도우미가 같이 쓴다.
export const kbCovers = (q: KbPose) => (q.scale - 1) / 2 + 1e-9 >= Math.max(Math.abs(q.xPercent), Math.abs(q.yPercent)) / 100

// 펀치 인 시작 배율: 글자는 읽히는 크기 안(1.1~1.3), 사진·영상 층만 크게(1.4~2.5). 강도(distance 배율)를 곱하되 카드 범위 밖으로 나가지 않는다.
export function punchFrom(kind: "text" | "media", distance = 1) {
  const k = TECH.punchIn
  return kind === "text" ? round(clamp(1 + (k.text - 1) * distance, 1.1, 1.3)) : round(clamp(1 + (k.media - 1) * distance, 1.4, 2.5))
}

// 휩 팬 한 번: 길이(초)·나가는 쪽/들어오는 쪽 가로 위치·흐림(가운데에서만 최대, 양 끝 0 — 전환 중에만 filter)·기울임. M3 만 showpiece 길이.
export function whipPlan(level: MotionLevel, dir: 1 | -1 = 1) {
  const w = TECH.whip, s = scaleFor(level)
  return {
    duration: level === "M3" ? w.showpiece : w.total,
    outX: -dir * w.xPercent, inX: dir * w.xPercent,
    blur: [0, round(w.blur * Math.min(1, s.distance)), 0] as [number, number, number],
    skew: round(-dir * w.skew * Math.min(1, s.rotate)),
  }
}

// 로어 서드 한 바퀴(초): 들어옴 → 머무름 → 나감. 머무름은 읽을 시간이라 2.5~6s 안(카드 lower-third durationMs.hold).
export function lowerThirdTiming({ hold = TECH.lowerThird.hold as number }: { hold?: number } = {}) {
  const k = TECH.lowerThird
  const h = clamp(hold, 2.5, 6)
  return { in: k.in, hold: h, out: k.out, cycle: round(k.in + h + k.out) }
}

// ── 프리셋 7종(FV1 Task 5.6, C2) — 순수 계획 함수. 도우미마다 xxxPlan(opts) → { animates, hidesText, durationMs, … } 와 그것을 쓰는 GSAP 실행부
//    (gsap-techniques.ts — scrollHint·preloaderIntro·blurToSharp·objectSwap3d·previewFollow·pageTransition, motion-lottie.tsx)로 나눈다.
//    시험(motion-presets.test.mjs)은 계획 함수만 부른다. 공통 규칙: 동작 줄이기이거나 M0 이면 animates false(정지 — 첫 프레임·포스터), 글은 어떤 경우에도 숨기지 않는다.
//    5초 넘게 스스로 도는 것은 멈춤 단추(WCAG 2.2.2 — _shared/loop-pause)가 필요하다: needsPauseButton(ms).
export type PlanBase = { reducedMotion?: boolean; level?: MotionLevel }
const still = (o: PlanBase) => !!o.reducedMotion || (o.level ?? "M2") === "M0"
export const AUTO_MOTION_MAX_MS = 5000
export const needsPauseButton = (runMs: number) => runMs > AUTO_MOTION_MAX_MS

// scroll-hint: 첫 화면 아래 「더 있어요」 화살표가 위아래로 까딱인다 — cycleMs 한 번, repeats 번만 하고 멈춘다. 사용자가 스크롤하면 그 즉시 멈춘다.
// 합계가 5초를 넘으면(cycleMs × repeats) 멈춤 단추가 필요하다.
export function scrollHintPlan(o: PlanBase & { cycleMs?: number; repeats?: number } = {}) {
  const cycleMs = o.cycleMs ?? 1600, repeats = o.repeats ?? 3
  const animates = !still(o)
  return { animates, hidesText: false as const, durationMs: cycleMs, repeats, stopsOnScroll: true, pauseButton: animates && needsPauseButton(cycleMs * repeats), travelPx: Math.round(8 * scaleFor(o.level).distance) }
}

// preloader-intro: 첫 방문에만 얇은 진행 띠(글 위에 덮지 않는다)가 1.2초 안에 차고 걷힌다. 건너뛰기 단추가 늘 있고 LCP·첫 칠을 막지 않는다.
// 동작 줄이기·M0·재방문이면 아예 그리지 않는다(renders false — 띠는 hidden 으로 시작해 열리지 않는다).
export const PRELOADER_MAX_MS = 1200
export function preloaderIntroPlan(o: PlanBase & { maxMs?: number; firstVisit?: boolean } = {}) {
  const renders = !still(o) && (o.firstVisit ?? true)
  return { animates: renders, hidesText: false as const, durationMs: Math.min(o.maxMs ?? PRELOADER_MAX_MS, PRELOADER_MAX_MS), renders, skipButton: true, blocksLcp: false, coversText: false }
}

// blur-to-sharp: 흐림에서 선명으로 — 흐림 값은 휩 팬(whipPlan)의 것을 그대로 쓴다(가운데 최대 값의 1/3, whipIn 과 같다). 글을 숨기지 않는다(불투명도는 건드리지 않는다).
export function blurToSharpPlan(o: PlanBase = {}) {
  const animates = !still(o)
  const w = whipPlan(o.level ?? "M2")
  return { animates, hidesText: false as const, durationMs: animates ? Math.round(w.duration * 1.6 * 1000) : 0, fromBlurPx: animates ? round(w.blur[1] / 3) : 0, toBlurPx: 0 }
}

// object-swap-3d: 3D 장면에서 오브젝트를 바꿔 끼운다(5.7 object-3d-orbit). 동작 줄이기·M0 면 포스터 그림만(3D 를 올리지 않는다).
// 끌어 돌리기는 고운 포인터에서만(터치에서는 스크롤을 가로채지 않는다). 스스로 돌지 않는다 — 바꿈은 사용자 조작(단추·키)으로만 — 그래서 5초 반복·멈춤 단추가 없다.
export function objectSwap3dPlan(o: PlanBase & { items?: number; pointerFine?: boolean } = {}) {
  const posterOnly = still(o)
  const items = o.items ?? 1
  return { animates: !posterOnly && items >= 2, hidesText: false as const, durationMs: 800, posterOnly, drag: !posterOnly && (o.pointerFine ?? true), autoplays: false, items }
}

// preview-follow: 목록 항목에 호버하면 미리보기 그림이 포인터를 따라온다. `(hover: hover) and (pointer: fine)` 에서만 — 그 밖에서는 그림이 정지로 남고
// 탭·클릭은 그대로 링크를 따라간다(blocksTap 은 늘 false).
export function previewFollowPlan(o: PlanBase & { hover?: boolean; pointerFine?: boolean } = {}) {
  const capable = (o.hover ?? true) && (o.pointerFine ?? true)
  const animates = capable && !still(o)
  return { animates, hidesText: false as const, durationMs: 400, staticImage: !animates, blocksTap: false as const }
}

// view-transition-page: 쪽 전환(View Transitions API). 전환 뒤 초점은 새 쪽 h1 로 옮긴다(UX J03) — 전환이 꺼진 경우(동작 줄이기·API 없음·M0)에도 옮긴다.
export function pageTransitionPlan(o: PlanBase & { supported?: boolean } = {}) {
  const animates = (o.supported ?? true) && !still(o)
  return { animates, hidesText: false as const, durationMs: animates ? 320 : 0, focusTarget: "h1" as const, moveFocus: true as const }
}

// lottie-playback: dotLottie 재생(motion-lottie). 동작 줄이기면 첫 프레임 정지(autoplay false), 화면 밖이면 멈춤, 무한 반복이거나 한 바퀴가 5초 넘으면 멈춤 단추.
export function lottiePlan(o: PlanBase & { loopSeconds?: number; loop?: boolean } = {}) {
  const loopSeconds = o.loopSeconds ?? 2
  const loop = o.loop ?? true
  const autoplay = !still(o)
  const runMs = loop ? Infinity : loopSeconds * 1000
  return { animates: autoplay, hidesText: false as const, durationMs: Math.round(loopSeconds * 1000), autoplay, firstFrameOnly: !autoplay, pausesOffscreen: autoplay, pauseButton: autoplay && needsPauseButton(runMs), loop }
}

export const PRESET_IDS = ["scroll-hint", "preloader-intro", "blur-to-sharp", "lottie-playback", "view-transition-page", "object-swap-3d", "preview-follow"] as const
export type PresetId = (typeof PRESET_IDS)[number]
// 효과 카드 id → 계획. 카드 시험·5.7 블록 시험이 한 입구로 부른다.
export function presetPlan(id: string, opts: Record<string, unknown> = {}) {
  const o = opts as never
  switch (id) {
    case "scroll-hint": return scrollHintPlan(o)
    case "preloader-intro": return preloaderIntroPlan(o)
    case "blur-to-sharp": return blurToSharpPlan(o)
    case "lottie-playback": return lottiePlan(o)
    case "view-transition-page": return pageTransitionPlan(o)
    case "object-swap-3d": return objectSwap3dPlan(o)
    case "preview-follow": return previewFollowPlan(o)
    default: throw new Error(`알 수 없는 프리셋: ${id}`)
  }
}
