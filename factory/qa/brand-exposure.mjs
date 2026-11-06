// 브랜드 주색 노출 관문(v0.2.6 T10 · S4 · 설계 D16) — 브리프의 첫 색이 첫 화면(히어로 1440×900)에 거의 안 보이면 공개 불가.
//   ① exposureProbe()            쪽 안에서 도는 자기완결 함수. DOM 을 문서 순서로 8px 칸 위에 칠한다(나중에 칠한 요소가 이긴다 — 겹친 상자를 두 번 세지 않는다).
//                                 칠하는 것: 배경색 · 테두리색 · 글자색(글자 줄 상자). 글자색은 배경 층과 따로 둔다 — 칸이 「배경이 주색」이거나 「그 위 글자가 주색」이면 센다(연한 글자가 주색 상자를 지우지 않는다). 사진·그라데이션·영상은 DOM 색이 아니라 세지 않는다(그 칸은 「주색 아님」으로 남는다).
//   ② measureBrandExposure(page) page = { ev } 로 ①을 돌려 { ratio, samples } 를 받는다 — 주색 근처(OKLab 거리 ≤ threshold) 칸 / 전체 칸.
//   ③ brandExposureGate(cand, { ratio }) 순수 판정 → { pass, ratio, floor }. 하한은 colorStrategy 별(Restrained 1% · Committed 15% · 그 밖 1%) — 골든 실측 뒤 조정한다.
//   ④ brandExposureForCandidate  07-qa 어댑터(Chrome 을 띄워 ②를 부른다. 안쪽 측정기 measure 는 시험용으로 바꿀 수 있다).
// 브랜드 색(cand.brand.input.colors[0])이 없는 후보는 이 관문을 돌리지 않는다(qa.mjs 가 brandColorOf 로 거른다).
// 픽셀 방식(스크린샷 해석)은 sharp 가 devDependency 뿐이라 쓰지 않는다(설계 D16).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertOpened, connect, navigateAndWait, startChrome } from './cdp.mjs'

export const DEFAULT_THRESHOLD = 0.07
export const EXPOSURE_FLOOR = { Restrained: 0.01, Committed: 0.15 }
export const DEFAULT_FLOOR = 0.01
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** 후보의 브랜드 주색(첫 색) — 올바른 #hex 일 때만. 없으면 null(관문 생략). */
export const brandColorOf = (cand) => {
  const c = cand?.brand?.input?.colors?.[0]
  return typeof c === 'string' && HEX.test(c.trim()) ? c.trim() : null
}

export const floorFor = (strategy) => EXPOSURE_FLOOR[strategy] ?? DEFAULT_FLOOR

/** 후보의 colorStrategy — 후보 머리의 칸(T21 이 채운다). 아직 없으면 undefined 라 기본 하한이다. */
const strategyOf = (cand) => cand?.colorStrategy ?? cand?.head?.colorStrategy ?? cand?.recipe?.colorStrategy

/**
 * 쪽 안에서 돈다(Function.toString 으로 건넨다 — 바깥 변수를 읽지 않는다).
 * @param {{ colorHex: string, threshold: number, cell?: number }} o
 * @returns {{ ratio: number, samples: number }}
 */
export function exposureProbe({ colorHex, threshold, cell = 8 }) {
  const W = innerWidth, H = innerHeight
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell)
  const grid = new Float32Array(cols * rows * 3).fill(255) // 캔버스 기본색(흰색)에서 시작한다. 배경·테두리만 칠한다
  const ink = new Float32Array(cols * rows * 3) // 글자색 층: 글자는 바탕을 지우지 않는다(연한 글자가 주색 상자를 덮어 0% 가 되던 결함). 같은 칸에 나중 배경이 칠해지면 비운다
  const inkOn = new Uint8Array(cols * rows)
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
  const paint = (r, [cr, cg, cb, ca], asInk = false) => {
    if (ca <= 0) return
    const x0 = Math.max(0, Math.floor(r.left / cell)), x1 = Math.min(cols, Math.ceil(r.right / cell))
    const y0 = Math.max(0, Math.floor(r.top / cell)), y1 = Math.min(rows, Math.ceil(r.bottom / cell))
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const j = y * cols + x, i = j * 3
      if (asInk) { ink[i] = cr * ca + grid[i] * (1 - ca); ink[i + 1] = cg * ca + grid[i + 1] * (1 - ca); ink[i + 2] = cb * ca + grid[i + 2] * (1 - ca); inkOn[j] = 1; continue }
      inkOn[j] = 0
      grid[i] = cr * ca + grid[i] * (1 - ca); grid[i + 1] = cg * ca + grid[i + 1] * (1 - ca); grid[i + 2] = cb * ca + grid[i + 2] * (1 - ca)
    }
  }
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const oklab = (r, g, b) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)]
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
  }
  const hex = colorHex.replace('#', '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const target = oklab(parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16))
  const view = { left: 0, top: 0, right: W, bottom: H }
  const inView = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE'])
  const htmlBgClear = rgba(getComputedStyle(document.documentElement).backgroundColor)[3] === 0
  for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    if (SKIP.has(el.tagName)) continue
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) continue
    const op = +s.opacity
    // html 의 배경은 캔버스 전체에, html 배경이 없으면 body 의 배경이 캔버스 전체에 깔린다(CSS 배경 전파)
    const wide = el === document.documentElement || (el === document.body && htmlBgClear)
    const r = wide ? view : el.getBoundingClientRect()
    if (!wide && !inView(r)) continue
    const bg = rgba(s.backgroundColor)
    if (bg[3] > 0) paint(r, [bg[0], bg[1], bg[2], bg[3] * op])
    for (const [side, w] of [['top', s.borderTopWidth], ['right', s.borderRightWidth], ['bottom', s.borderBottomWidth], ['left', s.borderLeftWidth]]) {
      const width = parseFloat(w)
      const style = s[`border${side[0].toUpperCase()}${side.slice(1)}Style`]
      if (!(width > 0) || style === 'none' || style === 'hidden') continue
      const c = rgba(s[`border${side[0].toUpperCase()}${side.slice(1)}Color`])
      const strip = side === 'top' ? { left: r.left, right: r.right, top: r.top, bottom: r.top + width }
        : side === 'bottom' ? { left: r.left, right: r.right, top: r.bottom - width, bottom: r.bottom }
        : side === 'left' ? { left: r.left, right: r.left + width, top: r.top, bottom: r.bottom }
        : { left: r.right - width, right: r.right, top: r.top, bottom: r.bottom }
      paint(strip, [c[0], c[1], c[2], c[3] * op])
    }
    // 글자: 이 요소가 직접 가진 글자 줄 상자에 글자색을 칠한다
    const fg = rgba(s.color)
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      for (const line of range.getClientRects()) if (inView(line)) paint(line, [fg[0], fg[1], fg[2], fg[3] * op], true)
    }
  }
  const cache = new Map()
  let near = 0
  const isNear = (src, i) => {
    const key = (Math.round(src[i]) << 16) | (Math.round(src[i + 1]) << 8) | Math.round(src[i + 2])
    let hit = cache.get(key)
    if (hit === undefined) {
      const [L, a, b] = oklab(Math.round(src[i]), Math.round(src[i + 1]), Math.round(src[i + 2]))
      hit = Math.hypot(L - target[0], a - target[1], b - target[2]) <= threshold
      cache.set(key, hit)
    }
    return hit
  }
  for (let j = 0; j < cols * rows; j++) if (isNear(grid, j * 3) || (inkOn[j] && isNear(ink, j * 3))) near++
  const samples = cols * rows
  return { ratio: Math.round((near / samples) * 10000) / 10000, samples }
}

/** @param {{ ev: (expr: string) => Promise<any> }} page  @param {{ colorHex: string, threshold?: number }} o  → { ratio, samples } */
export async function measureBrandExposure(page, { colorHex, threshold = DEFAULT_THRESHOLD }) {
  if (!HEX.test(colorHex ?? '')) throw new Error(`도구 실패: 브랜드 주색이 #hex 가 아니다 — ${colorHex}`)
  const r = await page.ev(`(${exposureProbe})(${JSON.stringify({ colorHex, threshold })})`)
  if (!r || typeof r.ratio !== 'number' || !(r.samples > 0)) throw new Error('도구 실패: 노출 계측이 값을 돌려주지 않았다')
  return r
}

/** 순수 판정 — 못 잰 값(ratio 가 숫자가 아님)은 통과가 아니다. */
export function brandExposureGate(cand, { ratio }) {
  const floor = floorFor(strategyOf(cand))
  return { pass: typeof ratio === 'number' && ratio >= floor, ratio, floor }
}

/** 기본 측정기: Chrome 을 띄워 히어로(1440×900, 라이트, 동작 줄이기)에서 잰다. 관문 잠금 안에서만 부른다. */
export async function measureBrandExposureAt(origin, route, { colorHex, threshold }) {
  const url = `${origin}${route}`
  const chrome = await startChrome(['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'], { prefix: 'brand-exposure-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
    await assertOpened(await navigateAndWait(send, ev, url), ev, url)
    await ev('document.fonts.ready.then(()=>1)')
    await new Promise((r) => setTimeout(r, 2200)) // 등장 연출이 끝난 뒤(ux-gate 와 같은 기다림)
    const out = await measureBrandExposure({ ev }, { colorHex, threshold })
    ws.close()
    return out
  } finally {
    await chrome.close()
  }
}

const pct = (v) => `${Math.round(v * 1000) / 10}%`

/**
 * 07-qa 어댑터. 반환은 qa.mjs 가 믿고 합치는 게이트 기록(ops·strict 와 같은 모양). 판정 실패는 다시 돌지 않고, 도구 실패(측정 못 함)만 qa.mjs 가 다시 돈다.
 * @param {string} runDir
 * @param {{ id: string }} cand
 * @param {{ origin: string, route?: string, threshold?: number, measure?: (origin: string, route: string, o: { colorHex: string, threshold: number }) => Promise<{ ratio: number, samples: number }> }} o
 */
export async function brandExposureForCandidate(runDir, cand, { origin, route = '/', threshold = DEFAULT_THRESHOLD, measure = measureBrandExposureAt } = {}) {
  if (!origin) throw new Error('brandExposureForCandidate: origin 이 필요하다')
  const colorHex = brandColorOf(cand)
  const dir = join(runDir, cand.id, '07-qa', 'brand-exposure')
  const file = join(dir, 'brand-exposure.json')
  rmSync(file, { force: true })
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const base = { id: 'brand-exposure', tool: 'brand-exposure', attempts: 1 }
  const secs = () => Math.round((Date.now() - t0) / 100) / 10
  if (!colorHex) return { ...base, exit: 1, verdict: 'tool', toolFailure: true, note: '도구 실패: 브랜드 주색이 없다 — 이 관문은 브랜드 색이 있을 때만 돈다', seconds: secs() }
  let m
  try { m = await measure(origin, route, { colorHex, threshold }) } catch (e) { return { ...base, exit: 1, verdict: 'tool', toolFailure: true, note: e.message.startsWith('도구 실패') ? e.message : `도구 실패: ${e.message}`, seconds: secs() } }
  const j = brandExposureGate(cand, m)
  const problems = j.pass ? [] : [`${route} 첫 화면(1440px)에서 주색 ${colorHex} 근처 면적이 ${pct(j.ratio)} — 하한 ${pct(j.floor)} 미만이에요`]
  writeFileSync(file, JSON.stringify({ candidate: cand.id, origin, route, colorHex, threshold, strategy: strategyOf(cand) ?? null, ...j, samples: m.samples }, null, 2) + '\n')
  return { ...base, exit: j.pass ? 0 : 1, verdict: j.pass ? 'pass' : 'fail', toolFailure: false, note: j.pass ? '' : `브랜드 주색 노출 ${pct(j.ratio)} < ${pct(j.floor)}`, problems, ratio: j.ratio, floor: j.floor, seconds: secs(), resultFile: join('07-qa', 'brand-exposure', 'brand-exposure.json').replace(/\\/g, '/') }
}
