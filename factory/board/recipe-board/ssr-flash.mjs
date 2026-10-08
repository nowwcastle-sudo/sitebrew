// 서버 렌더 첫 칠 번쩍임 검사(Task 11 fix · fix 2 — 모션 키트 motion-boot): node factory/board/recipe-board/ssr-flash.mjs [origin=http://localhost:3000] [--only <id,id>] [--blocks <블록@레시피,…> — 블록 서버 렌더 쪽 /qa/blocks/ssr]
// 서버가 그린 히어로(/qa/recipes/ssr — 서버 컴포넌트 페이지, MotionBoot 는 루트 레이아웃 <head>)를 `next start` 로 열고, 탐색 시작부터 화면 프레임(CDP screencast)을 찍는다.
// JS 청크를 CDP Fetch 로 붙잡아 하이드레이션을 늦춘다 — 서버 HTML 만 칠해진 구간을 일부러 만들어 그 구간의 프레임을 잰다(로컬 서버는 너무 빨라 구간이 없다).
// 여섯 갈래(히어로마다):
//   ref      숨김 기준 — 가림 CSS 와 따로 등장 대상([data-enter], keep 제외)을 !important 로 숨긴 하이드레이션 전 마지막 프레임(픽셀 판정의 기준).
//   gate     가림 있음, JS 0.9초 늦춤 → 하이드레이션 전 프레임이 어느 등장 대상 상자에서도 끝 모양이면 안 된다. keep 대상은 하이드레이션 전에도 보여야 한다.
//   control  가림 끔(양성 대조 — 파싱 전에 <html data-motion="off"> 를 달아 머리의 MotionBoot 가 돌지 않게 한다) → 번쩍임을 잡아야 한다(못 잡으면 도구가 눈먼 것).
//   leak     가림 있음 + 등장 대상 하나(와 그 아래 등장 대상)에서만 data-enter 를 뗀다(부분 누출 양성 대조, fix 2 N5) → 그 상자에서 번쩍임을 잡아야 한다.
//            떼는 대상은 control 에서 번쩍임이 잡힌 최상위·keep 아닌 상자 가운데 가장 덜 가려진 것(leakPick). 문서 파싱 중 MutationObserver 로 첫 칠 전에 뗀다.
//            고를 대상이 없으면 「해당 없음」(모든 대상이 keep 구획 안이면 settleKept 가 등장을 끝 상태로 둬 뗀 대상도 튀지 않는다).
//   leak2    두 번째 부분 누출 대조(Task 16 — 리뷰 14 #9): 같은 조건에서 가장 작은 상자(leakPickSmall, 첫 대조와 다른 것) — 작은 대상에서도 상자별 판정이 눈멀지 않았는가.
//   failsafe 가림 있음, JS 3초 늦춤 → 안전장치(DOMContentLoaded + 1.5초)가 드러낸 뒤(data-motion="late") 하이드레이션된 장면은 등장을 건너뛰어야 한다
//            (data-wf-entered="skipped"), 드러난 뒤의 프레임이 다시 시작 자세로 돌아가면(숨김 → 재등장) 실패. 드러난 시각은 페이지에서 잰다.
//            그리고 DOM 에서 등장 대상이 모두 실제로 보여야 한다(HIDDEN_TARGETS — visibility·불투명도 곱 > 0.01·clip-path 가 다 자르지 않음, Task 16 리뷰 14 #8).
//            양성 대조: 보이는 대상 하나를 clip-path·불투명도·visibility 로 차례로 숨기면 셋 다 잡아야 한다(HIDE_ONE).
// keep 전용 히어로(P3-4 perf 합침 — 대장 C173): 히어로의 글·그림은 data-enter="keep" 이라 하이드레이션 전에도 보이고 장면은 그것을 끝 상태로 둔다. 그래서 숨김 대상(keep 이 아닌
//   등장 대상)이 화면 안에 없거나 시작↔끝 차가 2 미만이라 잴 수 없는 히어로가 있다. 그런 히어로는 위 여섯 갈래의 번쩍임 대신 「keep 상자가 하이드레이션 직전·뒤 프레임에서
//   끝 프레임과 같다」를 잰다(keepRow — 바뀐 점 40개 이상이고 내용 ink 의 30% 이상이면 번쩍임, 등장이 바꾸는 숨김 대상 상자와 영상은 뺀다). 가림을 끌 대상이 없어 control·leak 은
//   해당 없음이고, 양성 대조는 keepctl(장면이 시작할 때 글 있는 keep 전부를 옮겨 지운다 — 판정이 하나라도 잡아야 한다)이 맡는다. 안전장치 갈래는 드러난 뒤 keep 상자가 끝 프레임과
//   달라진 프레임을 「숨김 → 재등장」으로 센다. keep 도 숨김도 잴 것이 없으면 도구 실패다. 모든 갈래에서 영상은 투명으로 둔다(VIDEO_OFF — 프레임마다 다른 그림이 판정을 흔든다).
// 번쩍임 판정은 상자마다(평균이 아니라 상자별 최대, fix 2 N5) 두 가지 — 어느 하나라도 걸리면 번쩍임:
//   차 비율  상자 밝기 차 평균: 하이드레이션 전 프레임이 등장 시작보다 훨씬 끝에 가깝다(d끝 < d시작 × 0.5, 차이 ≥ 2) — judgeFlash.
//   픽셀     하이드레이션 전 프레임이 끝과 같고(< 16) 시작·숨김 기준과 다른(> 24) 픽셀이 40개 이상이고 등장이 바꾸는 픽셀의 1% 이상 — judgeLeakPixels.
//            상자가 다른 숨은 대상(뒤의 영상 등)으로 차 있어도 새어 나온 글자 픽셀만 센다.
//   얇은 상자(폭이나 높이 < 4px — 1px 선)는 격자 대신 모든 픽셀을 본다. 두께 0 인 SVG 선 상자는 1px 로 편다(Task 16 — 리뷰 14 #9).
//   (잡음 바닥 40px 을 넓이에 비례하게 바꾸는 일은 보류 — 보고서 후속 항목.)
// 결과: .tmp/board/gates/ssr-flash.json · 종료 0 = 모두 통과, 1 = 실패 있음 또는 도구 실패(「도구 실패:」, 결과 파일 없음).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, sceneUrl } from '../../qa/cdp.mjs'
import { loadHeads, optionsOf, OUT, GATE_CHROME_FLAGS } from './jobs.mjs'
import { ENTERED_WAIT } from '../../qa/hit-area.mjs'

export const MODES = { ref: { gate: true, delay: 900, hideAll: true }, gate: { gate: true, delay: 900 }, keepctl: { gate: true, delay: 900, keepShift: true }, control: { gate: false, delay: 900 }, leak: { gate: true, delay: 900, leak: true }, leak2: { gate: true, delay: 900, leak: true, small: true }, failsafe: { gate: true, delay: 3000 } }
// 상자 번쩍임: 끝까지의 차가 시작까지의 차의 이 비율보다 작고, 둘의 차가 MIN_GAP 이상. transform 만 하는 등장(숨긴 프레임이 시작·끝과 비슷하게 멀다)을 번쩍임으로 읽지 않는다.
export const FLASH_RATIO = 0.5
const MIN_GAP = 2
const MEASURABLE = 2
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 판정(순수). pre: 하이드레이션 전 프레임들의 { dStart:[상자], dFinal:[상자] }, dStartFinal:[상자] — 시작 ↔ 끝 차(그 상자의 등장이 화면에서 얼마나 달라 보이는지).
// 시작과 끝이 거의 같은(< 2) 상자는 잴 수 없다. 잴 수 있는 상자가 하나도 없거나 프레임이 없으면 measurable false(실패로 센다: 빈 결과를 통과로 읽지 않는다).
export function judgeFlash({ pre, dStartFinal }) {
  const ok = dStartFinal.map((d) => d >= MEASURABLE)
  const boxes = new Set()
  let flashFrames = 0
  for (const f of pre) {
    let hit = false
    for (let b = 0; b < dStartFinal.length; b++) {
      if (!ok[b]) continue
      if (f.dFinal[b] < f.dStart[b] * FLASH_RATIO && f.dStart[b] - f.dFinal[b] >= MIN_GAP) { boxes.add(b); hit = true }
    }
    if (hit) flashFrames++
  }
  return { frames: pre.length, flashFrames, flash: flashFrames > 0, measurable: pre.length > 0 && ok.some(Boolean), boxes: ok.filter(Boolean).length, flashBoxes: [...boxes].sort((a, b) => a - b) }
}
// 안전장치 판정(순수). after: 드러난 뒤 프레임들의 { dStartRef, dFinal }(상자 합집합 평균) — 시작 자세 참조는 gate 실행의 시작 프레임.
// 합집합 평균으로 둔다: 영상 칸은 재생으로 끝 프레임이 달라져 상자별로 재면 되돌아감으로 잘못 읽는다.
// rehiddenFrames: keep 전용 히어로(숨김 대상이 없다)는 시작 자세 프레임이 없어 keep 상자가 끝 프레임과 달라진 프레임 수를 밖에서 센다.
// 시작 자세에 가깝다는 판정은 번쩍임 판정과 같은 잡음 여유(MIN_GAP)를 둔다 — 시작 ≈ 끝(차가 작은) 장면은 어느 쪽이 가까운지가 잡음으로 갈린다.
export function judgeFailsafe({ after, entered, motion, rehiddenFrames }) {
  const rehidden = rehiddenFrames != null ? { length: rehiddenFrames } : after.filter((f) => f.dStartRef < f.dFinal && f.dFinal - f.dStartRef >= MIN_GAP)
  const fails = []
  if (motion !== 'late') fails.push(`안전장치가 드러내지 않았다(data-motion=${motion})`)
  if (entered !== 'skipped') fails.push(`늦게 시작한 장면이 등장을 건너뛰지 않았다(data-wf-entered=${entered})`)
  if (!after.length) fails.push('드러난 뒤 프레임 0개')
  if (rehidden.length) fails.push(`드러난 뒤 시작 자세로 돌아간 프레임 ${rehidden.length}개(숨김 → 재등장)`)
  return { frames: after.length, rehidden: rehidden.length, fails }
}
// 안전장치 뒤 최종 보임(Task 16 — 리뷰 14 #8): 건너뛴(skipped) 장면의 등장 대상([data-enter], keep 포함)이 DOM 에서 실제로 보여야 한다 — 프레임 비교는
// 끝 프레임을 기준으로 삼아 숨은 채 끝난 대상을 못 잡는다. 대상마다: visibility 가 hidden 이 아니고, 자신·조상 불투명도의 곱 > 0.01,
// 자신·조상의 clip-path 가 다 잘라 내지 않는다(inset 이 폭이나 높이를 다 먹지 않는다). 그려지지 않는 대상(상자 0 — 반응형으로 display:none)은 뺀다.
// clip-path inset 이 상자를 다 가리는가(순수 — 페이지 안에도 그대로 싣는다). inset(위 오른 아래 왼 [round …]) — 값 1~4개, % 는 높이·폭 기준.
export function insetCovers(clip, w, h) {
  const m = /^inset\(([^)]*)\)/.exec(String(clip ?? '').trim())
  if (!m) return false
  const vals = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/).filter(Boolean)
  if (!vals.length) return false
  const [t, r = t, b = t, l = r] = vals
  const px = (v, base) => (v.endsWith('%') ? (parseFloat(v) / 100) * base : parseFloat(v) || 0)
  return px(t, h) + px(b, h) >= h - 0.5 || px(l, w) + px(r, w) >= w - 0.5
}
export const HIDDEN_TARGETS = `(() => {
  const insetCovers = ${insetCovers.toString()}
  const out = []
  for (const e of document.querySelectorAll('[data-enter]')) {
    const box = e.getBoundingClientRect()
    if (box.width < 0.5 && box.height < 0.5) continue
    const why = []
    if (getComputedStyle(e).visibility === 'hidden') why.push('visibility hidden')
    let op = 1
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      op *= Number(cs.opacity)
      const b = n.getBoundingClientRect()
      if (insetCovers(cs.clipPath, b.width, b.height)) why.push('clip-path ' + cs.clipPath + (n === e ? '' : ' (조상)'))
    }
    if (op <= 0.01) why.push('opacity ' + op.toFixed(3))
    if (why.length) out.push({ t: e.tagName.toLowerCase() + '.' + String(e.getAttribute('class') ?? '').split(' ')[0], why: why.join(', '), hid: e.hasAttribute('data-wf-hid') })
  }
  return out
})()`
// 양성 대조(Task 16): 보이는 등장 대상 하나를 세 가지 방법(clip-path 다 자름 · 불투명도 0 · visibility hidden)으로 차례로 숨겨 HIDDEN_TARGETS 가 잡는지 본다.
// 돌려주기: 방법마다 잡았나. 숨긴 값은 바로 되돌린다.
export const HIDE_ONE = (how) => `(() => {
  const e = [...document.querySelectorAll('[data-enter]')].find((x) => { const b = x.getBoundingClientRect(); return b.width > 4 && b.height > 4 })
  if (!e) return null
  const prop = ${JSON.stringify({ clip: 'clip-path', opacity: 'opacity', visibility: 'visibility' })}[${JSON.stringify(how)}]
  const val = ${JSON.stringify({ clip: 'inset(0% 100% 0% 0%)', opacity: '0', visibility: 'hidden' })}[${JSON.stringify(how)}]
  const prev = [e.style.getPropertyValue(prop), e.style.getPropertyPriority(prop)]
  e.style.setProperty(prop, val, 'important'); e.setAttribute('data-wf-hid', '')
  window.__wfUnhide = () => { if (prev[0]) e.style.setProperty(prop, prev[0], prev[1]); else e.style.removeProperty(prop); e.removeAttribute('data-wf-hid') }
  return e.tagName.toLowerCase() + '.' + String(e.getAttribute('class') ?? '').split(' ')[0]
})()`
export function hiddenAfterSkipFails(hidden) {
  return (hidden ?? []).map((x) => `건너뛴 뒤 숨은 등장 대상: ${x.t}(${x.why})`)
}
// 대조 판정(순수): 방법마다 { picked, caught } — 고른 대상이 없거나 하나라도 못 잡으면 실패(검사가 눈멀었다).
export function hiddenControlFails(rows) {
  const out = []
  for (const r of rows ?? []) {
    if (!r.picked) out.push(`숨김 대조(${r.how}): 숨길 등장 대상이 없다`)
    else if (!r.caught) out.push(`숨김 대조(${r.how}): ${r.picked} 를 숨겼는데 잡지 못했다 — 보임 검사가 눈멀었다`)
  }
  return out
}

// keep 대상 판정(순수). 하이드레이션 전 탐침(scene null)에서 keep 이 모두 보여야 한다.
export function keepFails(probe) {
  if (!probe || probe.scene != null || !probe.keep) return []
  const hidden = probe.keep - probe.keepVisible
  return hidden > 0 ? [`keep 대상 ${hidden}/${probe.keep} 개가 하이드레이션 전에 숨었다(숨긴 [data-enter] 조상 아래)`] : []
}
// keep 전용 판정(P3-4 perf 합침 뒤 — 대장 C173): 히어로의 글·그림은 data-enter="keep" 이라 하이드레이션 전에도 보이고 장면은 그것을 끝 상태로 둔다.
// 그래서 숨김 대상이 없거나(모두 keep) 시작↔끝 차가 작아 잴 수 없는 히어로가 생겼다. 그런 히어로는 「keep 상자가 하이드레이션 전·뒤 어느 프레임에서도 끝 프레임과 같다」를 잰다.
// frames: 프레임마다 { boxes: [{ content, ink, changed }] } — content: 그 keep 상자(등장이 바꾸는 숨김 대상 상자를 뺀)의 표본 점 수, ink: 그 가운데 끝 프레임에서 상자 평균 밝기와 24 넘게 다른 점(글자·그림 — 바탕이 아닌 것),
// changed: 끝 프레임과 밝기가 24 넘게 다른 점 수. 번쩍임 = 바뀐 점이 40개 이상이고 내용(ink, 바탕만 있는 상자는 content 의 1%)의 30% 이상 — 글자가 사라지거나 옮겨 가면 내용 전부가 달라지고,
// 서체 안티앨리어싱·합성 층 차이는 굵은 글자 가장자리 몇 %뿐이다(실측 r8-dusk B: 큰 낱말 ink 의 8%).
export const KEEP_MIN_PX = 40
export const KEEP_MIN_INK_SHARE = 0.3
const KEEP_MEASURABLE_PTS = 25
export function judgeKeepChange(frames) {
  const n = Math.max(0, ...frames.map((f) => f.boxes.length))
  const content = Array.from({ length: n }, (_, b) => Math.max(0, ...frames.map((f) => f.boxes[b]?.content ?? 0)))
  const ok = content.map((c) => c >= KEEP_MEASURABLE_PTS)
  const ink = Array.from({ length: n }, (_, b) => Math.max(0, ...frames.map((f) => f.boxes[b]?.ink ?? 0)))
  const changes = (x, b) => ok[b] && x.changed >= KEEP_MIN_PX && x.changed >= KEEP_MIN_INK_SHARE * Math.max(ink[b], 0.01 * content[b])
  const changed = Array.from({ length: n }, (_, b) => Math.max(0, ...frames.map((f) => f.boxes[b]?.changed ?? 0)))
  const flashBoxes = ok.map((_, b) => b).filter((b) => changes({ changed: changed[b] }, b))
  return { frames: frames.length, boxes: ok.filter(Boolean).length, flashBoxes, flashFrames: frames.filter((f) => f.boxes.some((x, b) => changes(x, b))).length, flash: flashBoxes.length > 0, measurable: frames.length > 0 && ok.some(Boolean), changed, ink }
}
// keep 전용 히어로의 실패 목록(순수): keep 대상이 하이드레이션 전에 가려져 있다 · keep 상자가 하이드레이션 때 바뀐다 · 잴 것이 하나도 없다(keep 도 숨김도 0 — 도구 실패).
export function keepOnlyFails({ probeEarly, probeMid, change }) {
  const out = [...keepFails(probeEarly), ...keepFails(probeMid)]
  if (!change.measurable) out.push(`잴 것이 없다(숨김 대상이 없거나 잴 수 없고, 잴 keep 상자도 없다 — 프레임 ${change.frames}개·잴 수 있는 keep 상자 ${change.boxes}개)`)
  else if (change.flash) out.push(`keep 대상이 하이드레이션 때 바뀐다: 상자 ${change.flashBoxes.join(',')}(끝 프레임과 다른 점 ${change.flashBoxes.map((b) => change.changed[b]).join('/')}, 프레임 ${change.flashFrames}개)`)
  return out
}
// 픽셀 판정(순수, fix 2 N5). boxes: 상자마다 { content, leaked } — content: 등장이 바꾸는 픽셀(시작 ≠ 끝, 끝 ≠ 숨김 기준), leaked: 그 가운데 하이드레이션
// 전 프레임이 끝과 같고 숨김 기준과 다른 픽셀(= 끝 모양이 샜다). 새어 나온 픽셀이 LEAK_MIN_PX 이상이고 내용의 LEAK_MIN_SHARE 이상이면 그 상자는 번쩍임.
export const LEAK_MIN_PX = 40
export const LEAK_MIN_SHARE = 0.01
export function judgeLeakPixels(boxes) {
  const flashBoxes = []
  boxes.forEach((b, i) => { if (b.content > 0 && b.leaked >= LEAK_MIN_PX && b.leaked / b.content >= LEAK_MIN_SHARE) flashBoxes.push(i) })
  return { flashBoxes, leaked: boxes.map((b) => b.leaked) }
}
// 부분 누출 대상 고르기(순수). cands: 같은 히어로 양성 대조(가림 끔)의 상자마다 { sig, nth, nested, keep, flash, leaked } — flash: 그 상자에서 번쩍임이
// 잡혔다, leaked: 새어 나온 픽셀 수(최대). 다른 등장 대상 아래(nested)는 떼어도 숨는 조상이면 visibility 상속으로 여전히 숨고, keep 조상이면
// settleKept 가 등장을 끝 상태로 둬 번쩍임 자체가 없다. 번쩍임이 잡힌 최상위·keep 아닌 상자 가운데 다른 대상 상자에 가장 덜 가려진 것(cover —
// 겹친 층의 맨 뒤는 제 픽셀이 앞 층에 가려 대조가 흐려진다), 같으면 leaked 가 많은 것. 잡음 바닥(LEAK_MIN_PX) 아래는 뺀다. 없으면 null.
export function leakPick(cands) {
  const ok = cands.filter((c) => c.flash && !c.nested && !c.keep && c.leaked >= LEAK_MIN_PX).sort((a, b) => a.cover - b.cover || b.leaked - a.leaked)
  return ok.length ? { sig: ok[0].sig, nth: ok[0].nth } : null
}
// 두 번째 부분 누출 대조(Task 16 — 리뷰 14 #9): leakPick 은 가장 잘 보이는(덜 가려진) 대상을 골라 큰 대상에서만 민감도를 보인다. 그래서 같은 조건(번쩍임이 잡힌
// 최상위·keep 아님·잡음 바닥 이상)에서 가장 작은 상자(넓이)를 하나 더 고른다 — 첫 대조와 다른 것. 같으면 새어 나온 픽셀이 많은 것. 없으면 null.
export function leakPickSmall(cands, first = null) {
  const ok = cands.filter((c) => c.flash && !c.nested && !c.keep && c.leaked >= LEAK_MIN_PX && !(first && c.sig === first.sig && c.nth === first.nth)).sort((a, b) => a.area - b.area || b.leaked - a.leaked)
  return ok.length ? { sig: ok[0].sig, nth: ok[0].nth } : null
}

// 상자 안 표본 픽셀(순수 — 페이지 안 DIFF·PIX 에 그대로 싣는다): k px 격자(기본). 얇은 상자(폭이나 높이 < 4px)는 모든 픽셀 — 격자는 floor(left/k)*k 에서
// 시작해 1px 선(예: x 621~622)을 통째로 건너뛸 수 있다(620 만 본다, 리뷰 14 #9). 돌려주기: y*W+x 목록.
export function gridPoints(r, W, H, k) {
  const step = r.right - r.left < 4 || r.bottom - r.top < 4 ? 1 : k
  const out = []
  for (let y = Math.floor(r.top / step) * step; y < Math.min(H, r.bottom); y += step) for (let x = Math.floor(r.left / step) * step; x < Math.min(W, r.right); x += step) out.push(y * W + x)
  return out
}

// 페이지 안: 하이드레이션 전 상태(서버 HTML 에 히어로가 있는가, 장면이 아직 없는가, 보이는 등장 대상 수, 보이는 keep 수).
const PROBE = `(() => {
  const vis = (e) => getComputedStyle(e).visibility !== 'hidden'
  const all = [...document.querySelectorAll('[data-enter]:not([data-enter="keep"])')]
  const keep = [...document.querySelectorAll('[data-enter="keep"]')]
  return { ssr: !!document.querySelector('[data-hero]'), scene: document.querySelector('[data-wf-scene]')?.dataset.wfScene ?? null, motion: document.documentElement.dataset.motion ?? null, targets: all.length, visible: all.filter(vis).length, keep: keep.length, keepVisible: keep.filter(vis).length }
})()`
// 페이지 안: 끝 화면에서 등장 대상 상자(화면 안으로 자름, keep 제외). leak: 부분 누출 대조에서 뗀 대상. sig·nth: 서명(태그|class)과 같은 서명의
// [data-enter] 가운데 문서 순서(부분 누출 스크립트가 같은 방법으로 센다) · nested: 다른 등장 대상(keep 포함) 아래 · cover: 다른 대상 상자가 덮는 비율(8px 격자).
const RECTS = `(() => {
  const seen = {}
  const out = [...document.querySelectorAll('[data-enter], [data-wf-leak]')].map((e) => {
    const sig = e.tagName.toLowerCase() + '|' + (e.getAttribute('class') ?? '')
    const nth = e.hasAttribute('data-enter') ? (seen[sig] = (seen[sig] ?? -1) + 1) : -1
    const r = e.getBoundingClientRect()
    // 두께 0 인 상자(가로·세로 SVG 선 — 획은 상자에 들지 않는다)는 1px 로 편다(리뷰 14 #9: 1px 선이 판정에서 통째로 빠졌다).
    let { left, top, right, bottom } = r
    if (right - left < 1) { const c = (left + right) / 2; left = c - 0.5; right = c + 0.5 }
    if (bottom - top < 1) { const c = (top + bottom) / 2; top = c - 0.5; bottom = c + 0.5 }
    return { left: Math.max(0, left), top: Math.max(0, top), right: Math.min(innerWidth, right), bottom: Math.min(innerHeight, bottom), leak: e.hasAttribute('data-wf-leak'), keep: e.getAttribute('data-enter') === 'keep', sig, nth, nested: !!e.parentElement?.closest('[data-enter]'), el: e }
  }).filter((r) => !r.keep && r.right - r.left >= 1 && r.bottom - r.top >= 1 && (r.right - r.left) * (r.bottom - r.top) >= 4)
  for (const r of out) {
    let n = 0, hit = 0
    for (let y = r.top; y < r.bottom; y += 8) for (let x = r.left; x < r.right; x += 8) { n++; if (out.some((o) => o !== r && !r.el.contains(o.el) && !o.el.contains(r.el) && x >= o.left && x < o.right && y >= o.top && y < o.bottom)) hit++ }
    r.cover = n ? +(hit / n).toFixed(3) : 0
    r.area = Math.round((r.right - r.left) * (r.bottom - r.top))
  }
  return out.map(({ el, ...r }) => r)
})()`
// 새 문서마다(파싱 전): 부분 누출 — 고른 대상이 붙는 순간 그것과 그 아래 등장 대상의 data-enter 를 떼고 data-wf-leak 을 단다(마이크로태스크라 첫 칠 전이다).
const LEAK_SCRIPT = (pick) => `(() => {
  const P = ${JSON.stringify(pick)}; const seen = new WeakSet(); const count = {}; let root = null
  const look = (e) => {
    if (seen.has(e) || !e.hasAttribute('data-enter')) return
    seen.add(e)
    // 고른 대상 아래의 등장 대상도 뗀다(남기면 그 안이 여전히 숨어 control 에서 본 번쩍임과 다른 상자가 된다). keep 은 원래 보인다.
    if (root) { if (root.contains(e) && e.getAttribute('data-enter') !== 'keep') { e.removeAttribute('data-enter'); e.setAttribute('data-wf-leak-inner', '') } return }
    const sig = e.tagName.toLowerCase() + '|' + (e.getAttribute('class') ?? '')
    const n = count[sig] = (count[sig] ?? -1) + 1
    if (sig === P.sig && n === P.nth) { e.removeAttribute('data-enter'); e.setAttribute('data-wf-leak', ''); root = e; for (const d of e.querySelectorAll('[data-enter]')) look(d) }
  }
  const visit = (n) => { if (n.nodeType !== 1) return; look(n); for (const e of n.querySelectorAll('[data-enter]')) look(e) }
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) visit(n) }).observe(document, { childList: true, subtree: true })
})()`
// 양성 대조: <html> 이 붙는 순간 data-motion="off" — 머리 스크립트보다 먼저다(파서는 인라인 스크립트를 돌리기 전에 마이크로태스크를 비운다).
const GATE_OFF = `new MutationObserver((_, o) => { const h = document.documentElement; if (h) { h.setAttribute('data-motion', 'off'); o.disconnect() } }).observe(document, { childList: true })`
// 숨김 기준(ref): 문서가 생길 때부터 등장 대상([data-enter], keep 제외)을 가림 CSS 와 따로 !important 로 숨긴다(adoptedStyleSheets — 파싱 전에
// 걸린다). 가림이 맞으면 하이드레이션 전 프레임 = 기준이다. 기준은 원래 서버 HTML 의 표시를 따르므로 부분 누출 대조에서 뗀 대상도 기준에서는 숨는다.
// 한계: 원천에서 data-enter 가 빠진 대상은 기준에서도 보인다 — 그것은 하이드레이션 뒤 uncovered(시작 상태를 입히는 트윈의 대상)가 잡는다.
const HIDE_TARGETS = `(() => { const s = new CSSStyleSheet(); s.replaceSync('[data-enter]:not([data-enter=\"keep\"]){visibility:hidden!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s] })()`
// 페이지 안: 픽셀 판정 재료 — imgs = [시작, 끝, 기준, …하이드레이션 전]. 상자마다(2px 격자) 하이드레이션 전 프레임별 { content, leaked }.
const PIX = (imgs, rects) => `(async () => {
  const ims = []
  for (const b of ${JSON.stringify(imgs)}) { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); ims.push(x.getImageData(0, 0, c.width, c.height).data) }
  const W = ${1440}, H = ${900}, SAME = 16, DIFF = 24
  const gridPoints = ${gridPoints.toString()}
  const L = (d, p) => 0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2]
  const [S, F, R] = ims
  return ${JSON.stringify(rects)}.map((r) => {
    const pts = []
    for (const p of gridPoints(r, W, H, 2)) { if (Math.abs(L(S, p) - L(F, p)) > DIFF && Math.abs(L(F, p) - L(R, p)) > DIFF) pts.push(p) }
    return ims.slice(3).map((P) => { let leaked = 0; for (const p of pts) if (Math.abs(L(P, p) - L(F, p)) < SAME && Math.abs(L(P, p) - L(R, p)) > DIFF) leaked++; return { content: pts.length, leaked } })
  })
})()`
// 새 문서마다: 관문 표지 + 안전장치가 드러낸 시각(performance.now ms).
const QA_SCRIPT = `window.__WF_QA = { pauseAt: null }
new MutationObserver(() => { if (window.__wfLateAt == null && document.documentElement?.dataset.motion === 'late') window.__wfLateAt = performance.now() }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-motion'] })`
// 영상 끄기(모든 실행): 히어로 배경 영상(keep — LCP)은 프레임마다 다른 그림이라 시작·끝·기준·하이드레이션 전 프레임의 픽셀 비교를 흔든다(실측: r8-dusk A 의
// 세로 제목 상자에서 영상 프레임 우연 일치 150px 가 「새어 나온 글자」로 셌다 — 제목은 하이드레이션 전에 숨어 있었다). 영상 요소만 투명으로 둔다(visibility 는 keep 보임 탐침이 읽으므로 건드리지 않는다).
export const VIDEO_OFF = `(() => { const s = new CSSStyleSheet(); s.replaceSync('video{opacity:0!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, s] })()`
// keep 상자(끝 화면): 안쪽에 다른 keep 이 없는 것만(바깥 keep 은 안쪽을 품는다), 화면 안으로 자른 상자. shift: keep 이동 대조가 옮긴 대상.
export const KEEP_RECTS = `(() => {
  const out = []
  for (const e of document.querySelectorAll('[data-enter="keep"]')) {
    if (e.querySelector('[data-enter="keep"]')) continue
    const r = e.getBoundingClientRect()
    const left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom)
    if (right - left < 1 || bottom - top < 1 || (right - left) * (bottom - top) < 4) continue
    out.push({ left, top, right, bottom, shift: e.hasAttribute('data-wf-shift'), text: (e.textContent ?? '').trim().length })
  }
  return out
})()`
// keep 이동 양성 대조(새 문서마다): 장면이 시작해 data-wf-t0 가 붙는 순간 글이 있는 keep 대상 전부를 아래로 옮기고 지운다(하이드레이션 때 keep 이 바뀌는 번쩍임 흉내).
// 끝 프레임에서도 옮긴 채라, 하이드레이션 전 프레임과 끝 프레임의 그 상자들이 달라진다 — keep 판정이 하나라도 잡아야 한다.
export const KEEP_SHIFT = `(() => {
  const go = () => {
    for (const e of document.querySelectorAll('[data-enter="keep"]')) {
      if (e.querySelector('[data-enter="keep"]') || !(e.textContent ?? '').trim().length || e.getBoundingClientRect().width <= 8) continue
      e.setAttribute('data-wf-shift', ''); e.style.setProperty('transform', 'translateY(48px)', 'important'); e.style.setProperty('opacity', '0', 'important')
    }
  }
  new MutationObserver((_, o) => { if (document.querySelector('[data-wf-t0]')) { o.disconnect(); go() } }).observe(document, { attributes: true, childList: true, subtree: true })
})()`
// 페이지 안: keep 상자마다 프레임(JPEG b64)이 끝 프레임과 다른 점 수 — imgs = [끝, …프레임], rects = keep 상자, mask = 숨김 대상 상자(그 안은 등장이 바꾸므로 뺀다).
export const KEEPPIX = (imgs, rects, mask) => `(async () => {
  const W = ${1440}, H = ${900}, DIFF = 24
  const gridPoints = ${gridPoints.toString()}
  const L = (d, p) => 0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2]
  const load = async (b) => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
  const masks = ${JSON.stringify(mask)}
  const inMask = (p) => { const x = p % W, y = Math.floor(p / W); return masks.some((m) => x >= m.left - 1 && x < m.right + 1 && y >= m.top - 1 && y < m.bottom + 1) }
  const pts = ${JSON.stringify(rects)}.map((r) => gridPoints(r, W, H, 2).filter((p) => !inMask(p)))
  const F = await load(${JSON.stringify(imgs[0])})
  const inks = pts.map((ps) => { let sum = 0; for (const p of ps) sum += L(F, p); const m = ps.length ? sum / ps.length : 0; let ink = 0; for (const p of ps) if (Math.abs(L(F, p) - m) > DIFF) ink++; return ink })
  const out = []
  for (const b of ${JSON.stringify(imgs.slice(1))}) {
    const P = await load(b)
    out.push({ boxes: pts.map((ps, i) => { let changed = 0; for (const p of ps) if (Math.abs(L(P, p) - L(F, p)) > DIFF) changed++; return { content: ps.length, ink: inks[i], changed } }) })
  }
  return out
})()`
// 페이지 안: 프레임(JPEG b64)들의 쌍 차이 — 상자마다(4px 격자)와 상자 합집합. pairs: [[i, j], …] → [{ u: 합집합 평균, b: [상자 평균] }].
const DIFF = (imgs, rects, pairs) => `(async () => {
  const ims = []
  for (const b of ${JSON.stringify(imgs)}) { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); ims.push(x.getImageData(0, 0, c.width, c.height).data) }
  const W = ${1440}, H = ${900}
  const rects = ${JSON.stringify(rects)}
  const gridPoints = ${gridPoints.toString()}
  const grid = (r) => gridPoints(r, W, H, 4)
  const per = (rects.length ? rects : [{ left: 0, top: 0, right: W, bottom: H }]).map(grid)
  const union = [...new Set(per.flat())]
  const L = (d, p) => 0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2]
  const mean = (a, b, pts) => { let s = 0; for (const p of pts) s += Math.abs(L(ims[a], p) - L(ims[b], p)); return +(s / Math.max(1, pts.length)).toFixed(2) }
  return ${JSON.stringify(pairs)}.map(([a, b]) => ({ u: mean(a, b, union), b: per.map((pts) => mean(a, b, pts)) }))
})()`

// 한 번 열어 프레임을 찍는다 → { frames:[{t,data}], nav, fcp, t0, entered, motion, lateAt, dcl, probeEarly, probeMid, rects, uncovered, leaked }.
export async function record(c, url, { delay }) {
  const { send, ev } = c
  const frames = []
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(300)
  c.delay = delay
  c.onFrame = (p) => frames.push({ t: p.metadata.timestamp, data: p.data })
  await send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 })
  await sleep(300)
  frames.length = 0
  const nav = Date.now() / 1000
  await send('Page.navigate', { url: await sceneUrl(send, url) }) // --session 이 없으면 같은 주소(UXGATE1)
  // 하이드레이션 전(JS 를 붙잡은 동안) 한 번 — 서버 HTML 이 칠해진 상태.
  let probeEarly = null
  for (let i = 0; i < 40 && !(probeEarly?.ssr); i++) { await sleep(50); probeEarly = await ev(PROBE).catch(() => null) }
  await sleep(Math.max(0, delay * 0.45 - 200))
  const probeMid = await ev(PROBE).catch(() => null)
  const entered = await ev(ENTERED_WAIT)
  await sleep(800)
  await send('Page.stopScreencast')
  c.onFrame = null
  c.delay = 0
  const info = await ev(`({ t0: document.querySelector('[data-wf-t0]') ? performance.timeOrigin / 1000 + Number(document.querySelector('[data-wf-t0]').dataset.wfT0) / 1000 : null, enteredValue: document.querySelector('[data-wf-scene]')?.dataset.wfEntered ?? null, motion: document.documentElement.dataset.motion ?? null, fcp: (performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0) / 1000 + performance.timeOrigin / 1000, lateAt: window.__wfLateAt == null ? null : performance.timeOrigin / 1000 + window.__wfLateAt / 1000, dcl: performance.timeOrigin / 1000 + (performance.getEntriesByType('navigation')[0]?.domContentLoadedEventStart ?? 0) / 1000, uncovered: window.__wfEnterUncovered ?? null, leaked: !!document.querySelector('[data-wf-leak]') })`)
  const rects = await ev(RECTS)
  const keepRects = await ev(KEEP_RECTS)
  return { frames, nav, entered, probeEarly, probeMid, rects, keepRects, ...info }
}

// keep 전용 줄 판정(P3-4 perf 합침 뒤): 하이드레이션 전 프레임(전부)과 뒤 프레임(고르게 6개 이하)에서 keep 상자가 끝 프레임과 같은가.
// 숨김 대상 상자(r.rects)는 등장이 바꾸므로 뺀다. 판정 실패 목록은 호출하는 쪽이 keepOnlyFails 로 만든다(양성 대조는 실패 대신 잡았는지를 본다).
async function keepRow(c, r, mask = []) {
  const { frames, fcp, t0 } = r
  const finalF = frames.at(-1)
  const cand = frames.filter((f) => f.t >= fcp - 0.01 && f !== finalF)
  const pre = cand.filter((f) => t0 == null || f.t < t0 - 0.005)
  const post = cand.filter((f) => !pre.includes(f))
  const step = Math.max(1, Math.ceil(post.length / 6))
  // 하이드레이션 전은 마지막 프레임 하나만 — 서버 HTML 이 다 칠해진 상태(그 앞은 그림·서체가 아직 들어오는 중이라 하이드레이션과 상관없이 다르다).
  const use = [...pre.slice(-1), ...post.filter((_, i) => i % step === 0)]
  const px = finalF && r.keepRects.length && use.length ? await c.ev(KEEPPIX([finalF.data, ...use.map((f) => f.data)], r.keepRects, mask)) : []
  const change = judgeKeepChange(px)
  return { keepOnly: true, mask, pre: pre.length, keepBoxes: r.keepRects.length, keepFramesAt: use.map((f) => +(f.t - r.nav).toFixed(2)), keepPerFrame: px.map((f) => f.boxes.map((b) => b.changed)), keepContent: px[0]?.boxes.map((b) => b.content), keepInk: px[0]?.boxes.map((b) => b.ink), ...change, fails: [] }
}

// 줄 판정(frame 비교 모드). 상자 번호 → 끝 화면 상자(leak 표시 포함). refF: 배경 기준 프레임(없으면 픽셀 판정을 건너뛴다 — ref 실행 자신).
// 숨김 대상이 없거나(모두 keep) 시작↔끝 차가 작아 잴 수 없는데 keep 상자가 있으면 keep 전용 판정으로 간다(keepRow). 둘 다 없을 때만 「잴 것이 없다」(도구 실패).
async function flashRow(c, r, refF) {
  const { frames, t0, fcp } = r
  if (r.rects.length === 0 && r.keepRects.length) {
    const k = await keepRow(c, r, [])
    k.fails.push(...keepOnlyFails({ probeEarly: r.probeEarly, probeMid: r.probeMid, change: k }))
    return k
  }
  // 하이드레이션 전: 첫 칠(FCP) 뒤 ~ 장면 시작(t0) 전. 끝: 마지막 프레임. 시작 프레임: t0 뒤 0.25초 안의 프레임 가운데 끝과 가장 다른 것 —
  // t0 는 build 끝의 JS 시각이라 그 직후 도착한 프레임이 커밋 전 합성일 수 있다(시작 자세는 끝과 가장 멀다).
  const pre = frames.filter((f) => f.t >= fcp - 0.01 && t0 != null && f.t < t0 - 0.005)
  const finalF = frames.at(-1)
  const cands = t0 != null ? frames.filter((f) => f.t >= t0 && f.t <= t0 + 0.25 && f !== finalF).slice(0, 12) : []
  const out = { pre: pre.length, fails: [] }
  if (!cands.length || !finalF) { out.fails.push('시작·끝 프레임이 없다'); return out }
  const dc = await c.ev(DIFF([finalF.data, ...cands.map((f) => f.data)], r.rects, cands.map((_, i) => [i + 1, 0])))
  const us = dc.map((d) => d.u)
  const startF = cands[us.indexOf(Math.max(...us))]
  const imgs = [startF.data, finalF.data, ...pre.map((f) => f.data)]
  const pairs = [[0, 1], ...pre.flatMap((_, i) => [[i + 2, 0], [i + 2, 1]])]
  const d = await c.ev(DIFF(imgs, r.rects, pairs))
  const judged = judgeFlash({ pre: pre.map((_, i) => ({ dStart: d[1 + i * 2].b, dFinal: d[2 + i * 2].b })), dStartFinal: d[0].b })
  Object.assign(out, { startRef: startF.data, dStartFinal: d[0].b, dStartFinalUnion: d[0].u, pre: pre.map((f, i) => ({ at: +(f.t - r.nav).toFixed(2), dStart: d[1 + i * 2].b, dFinal: d[2 + i * 2].b })), ...judged, ratioBoxes: judged.flashBoxes, leakBox: r.rects.findIndex((x) => x.leak) })
  if (!judged.measurable && r.keepRects.length) {
    // 숨김 대상은 있으나 시작↔끝 차가 작아 번쩍임이 보이지 않는다(옅은 선 장식 등) — keep 전용 판정으로 잰다. 시작 참조 프레임은 안전장치 판정이 그대로 쓴다.
    const k = await keepRow(c, r, r.rects.filter((_, i) => d[0].b[i] >= MEASURABLE))
    k.fails.push(...keepOnlyFails({ probeEarly: r.probeEarly, probeMid: r.probeMid, change: k }))
    return { ...k, startRef: startF.data, dStartFinal: d[0].b, dStartFinalUnion: d[0].u }
  }
  if (!judged.measurable) out.fails.push(`잴 것이 없다(하이드레이션 전 프레임 ${pre.length}개, 시작↔끝 차 ${d[0].b.join('/')})`)
  // 픽셀 판정: 상자마다 하이드레이션 전 프레임 가운데 새어 나온 픽셀이 가장 많은 것.
  if (refF && pre.length) {
    const px = await c.ev(PIX([startF.data, finalF.data, refF, ...pre.map((f) => f.data)], r.rects))
    const boxes = px.map((perFrame) => perFrame.reduce((a, b) => (b.leaked > a.leaked ? b : a), { content: perFrame[0]?.content ?? 0, leaked: 0 }))
    const pj = judgeLeakPixels(boxes)
    out.pixel = { content: boxes.map((b) => b.content), leaked: pj.leaked, flashBoxes: pj.flashBoxes }
    out.flashBoxes = [...new Set([...judged.flashBoxes, ...pj.flashBoxes])].sort((a, b) => a - b)
    out.flash = out.flashBoxes.length > 0
  }
  return out
}

export async function measureSsrFlash(c, url) {
  const out = {}
  let startRef = null, refF = null, pick = null, pick2 = null, keepOnly = false, keepMask = []
  for (const [mode, cfg] of Object.entries(MODES)) {
    const u = url
    // keep 전용 히어로(숨김 대상이 없거나 잴 수 없다): 가림을 끌 대상이 없어 양성 대조는 keepctl(keep 대상을 옮겨 본다)이 맡는다. 아니면 keepctl 은 해당 없음.
    if (mode === 'keepctl' && !keepOnly) { out[mode] = { url: u, na: 'keep 전용 히어로가 아니다(숨김 대상을 잴 수 있다)', fails: [] }; continue }
    if (mode === 'control' && keepOnly) { out[mode] = { url: u, na: 'keep 전용 히어로 — 가림을 끌 숨김 대상이 없다(양성 대조는 keepctl)', fails: [] }; continue }
    const ids = []
    const inject = async (source) => ids.push((await c.send('Page.addScriptToEvaluateOnNewDocument', { source })).result.identifier)
    await inject(VIDEO_OFF)
    if (cfg.hideAll) await inject(HIDE_TARGETS)
    if (cfg.keepShift) await inject(KEEP_SHIFT)
    if (!cfg.gate) await inject(GATE_OFF)
    const lp = cfg.small ? pick2 : pick
    if (cfg.leak) {
      if (!lp) { out[mode] = { url: u, na: cfg.small ? '두 번째 대조 대상 없음 — 첫 대조 말고는 번쩍임이 잡힌 최상위·keep 아닌 상자가 없다' : '대조 대상 없음 — 최상위(다른 등장 대상 아래가 아닌) 대상이 양성 대조에서 번쩍이지 않는다(모든 대상이 keep 구획 안이면 settleKept 가 등장을 끝 상태로 둬 뗀 대상도 튀지 않는다)', fails: [] }; continue }
      await inject(LEAK_SCRIPT(lp))
    }
    let r
    try { r = await record(c, u, cfg) } finally { for (const identifier of ids) await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }) }
    const row = { url: u, entered: r.entered, motion: r.motion, probeEarly: r.probeEarly, probeMid: r.probeMid, uncovered: r.uncovered, frames: r.frames.length, hydrateAfter: r.t0 != null ? +(r.t0 - r.nav).toFixed(2) : null, dclAfter: +(r.dcl - r.nav).toFixed(2), lateAfter: r.lateAt != null ? +(r.lateAt - r.nav).toFixed(2) : null, enteredValue: r.enteredValue, fails: [] }
    if (cfg.leak) row.leak = { pick: lp, leaked: r.leaked }
    row.rects = r.rects.map((x) => ({ sig: x.sig.slice(0, 60), nth: x.nth, nested: x.nested, cover: x.cover, leak: x.leak, box: [Math.round(x.left), Math.round(x.top), Math.round(x.right - x.left), Math.round(x.bottom - x.top)] }))
    if (!r.probeEarly?.ssr) row.fails.push('서버 HTML 에 히어로가 없다(하이드레이션 전 [data-hero] 없음)')
    if (mode === 'ref') {
      // 배경 기준: 하이드레이션 전 마지막 프레임(서체까지 칠해진 뒤).
      const pre = r.frames.filter((f) => r.t0 != null && f.t < r.t0 - 0.005)
      refF = pre.at(-1)?.data ?? null
      row.refFrames = pre.length
      if (!refF) row.fails.push('배경 기준 프레임이 없다(하이드레이션 전 프레임 0개)')
    } else if (mode === 'failsafe') {
      // 드러난 시각(페이지에서 잰 값) 뒤 한 프레임 여유부터.
      const from = r.lateAt != null ? r.lateAt + 0.05 : r.nav + 1.75
      const after = r.frames.filter((f) => f.t >= from && (r.t0 == null || f.t < r.t0 + 1.5))
      const finalF = r.frames.at(-1)
      const pick10 = after.filter((_, i) => i % Math.max(1, Math.ceil(after.length / 10)) === 0)
      if (r.lateAt != null && r.t0 != null && r.lateAt > r.t0) row.fails.push(`안전장치가 하이드레이션 뒤에 왔다(드러냄 ${row.lateAfter}s · 하이드레이션 ${row.hydrateAfter}s) — 늦춤을 늘려야 한다`)
      if (keepOnly && finalF && pick10.length && r.keepRects.length) {
        // keep 전용: 시작 자세가 없다 — 드러난 뒤 프레임에서 keep 상자가 끝 프레임과 달라지면(숨김 → 재등장) 실패.
        const kc = judgeKeepChange(await c.ev(KEEPPIX([finalF.data, ...pick10.map((f) => f.data)], r.keepRects, keepMask)))
        const judged = judgeFailsafe({ after: pick10, entered: r.enteredValue, motion: r.motion, rehiddenFrames: kc.flashFrames })
        Object.assign(row, { failsafe: judged, keepOnly: true, keepChange: { frames: kc.frames, boxes: kc.boxes, flashBoxes: kc.flashBoxes, changed: kc.changed } })
        row.fails.push(...judged.fails)
      } else if (startRef && finalF && pick10.length) {
        const imgs = [startRef, finalF.data, ...pick10.map((f) => f.data)]
        const d = await c.ev(DIFF(imgs, r.rects, pick10.flatMap((_, i) => [[i + 2, 0], [i + 2, 1]])))
        const judged = judgeFailsafe({ after: pick10.map((_, i) => ({ dStartRef: d[i * 2].u, dFinal: d[i * 2 + 1].u })), entered: r.enteredValue, motion: r.motion })
        Object.assign(row, { failsafe: judged })
        row.fails.push(...judged.fails)
      } else row.fails.push('비교할 프레임이 없다(시작 참조 또는 드러난 뒤 프레임)')
      // 최종 보임(DOM) + 양성 대조(Task 16 — 리뷰 14 #8). 프레임 비교와 따로 돈다(드러난 뒤 화면이 바뀌지 않아 프레임이 없어도 DOM 은 판정한다).
      const hidden = await c.ev(HIDDEN_TARGETS)
      if (!Array.isArray(hidden)) throw new Error(`보임 검사 실패 — ${u}`)
      row.fails.push(...hiddenAfterSkipFails(hidden))
      const control = []
      for (const how of ['clip', 'opacity', 'visibility']) {
        const picked = await c.ev(HIDE_ONE(how))
        const after = picked ? await c.ev(HIDDEN_TARGETS) : []
        await c.ev('window.__wfUnhide?.()')
        control.push({ how, picked, caught: !!picked && Array.isArray(after) && after.some((x) => x.hid) })
      }
      row.visible = { hidden, control }
      row.fails.push(...hiddenControlFails(control))
    } else if (mode === 'keepctl') {
      // keep 이동 양성 대조: 글이 있는 keep 대상 전부를 하이드레이션 때 옮겼다 — keep 판정이 그 상자들의 변화를 하나라도 잡아야 한다(못 잡으면 검사가 눈멀었다).
      const k = await keepRow(c, r, keepMask)
      Object.assign(row, { ...k, fails: row.fails })
      const shifted = r.keepRects.map((x, i) => (x.shift ? i : -1)).filter((i) => i >= 0)
      row.shiftBoxes = shifted
      if (!shifted.length) row.fails.push('양성 대조: 옮길 keep 대상(글이 있는 것)을 찾지 못했다')
      else if (!shifted.some((i) => k.flashBoxes.includes(i))) row.fails.push(`양성 대조: 옮긴 keep 대상(상자 ${shifted.join(',')})의 변화를 못 잡았다 — keep 판정이 눈멀었다`)
    } else {
      const f = await flashRow(c, r, refF)
      const { startRef: sr, fails: ff, ...rest } = f
      Object.assign(row, rest)
      row.fails.push(...ff)
      if (!ff.length && !f.pixel && !f.keepOnly) row.fails.push('픽셀 판정을 하지 못했다(배경 기준 없음)')
      if (mode === 'gate' && sr) startRef = sr
      if (mode === 'gate' && f.keepOnly) { keepOnly = true; keepMask = f.mask ?? [] }
      if (mode === 'gate' && !f.fails.length) {
        if (f.flash) row.fails.push(`끝 모양 번쩍임: 상자 ${f.flashBoxes.join(',')}(차 비율 ${f.ratioBoxes.join(',') || '-'} · 픽셀 ${f.pixel?.flashBoxes.join(',') || '-'})`)
        if (r.probeMid && r.probeMid.scene == null && r.probeMid.visible !== 0) row.fails.push(`하이드레이션 전 보이는 등장 대상 ${r.probeMid.visible}/${r.probeMid.targets}`)
        row.fails.push(...keepFails(r.probeEarly), ...keepFails(r.probeMid))
        if (r.enteredValue !== '') row.fails.push(`등장 끝 신호 값 ${r.enteredValue}(보통 등장이어야 한다)`)
        if (r.uncovered?.length) row.fails.push(`첫 칠 전에 숨지 않는 등장 대상: ${r.uncovered.join(', ')}`)
      }
      if (mode === 'control' && !f.fails.length && !f.flash) row.fails.push('양성 대조: 가림 없이도 번쩍임을 못 잡았다(검사가 눈멀었다)')
      // 부분 누출 대상: 이 양성 대조에서 번쩍임이 잡힌 최상위 상자 가운데 가장 덜 가려진 것(leakPick).
      if (mode === 'control' && !f.fails.length) {
        const cands = r.rects.map((x, b) => ({ sig: x.sig, nth: x.nth, nested: x.nested, cover: x.cover, area: x.area, keep: false, flash: f.flashBoxes.includes(b), leaked: f.pixel?.leaked[b] ?? 0 }))
        pick = leakPick(cands)
        pick2 = pick && leakPickSmall(cands, pick)
      }
      if (cfg.leak && !f.fails.length) {
        if (!r.leaked) row.fails.push('부분 누출 대조: 대상에서 data-enter 를 떼지 못했다')
        else if (f.leakBox < 0) row.fails.push('부분 누출 대조: 뗀 대상의 상자가 화면에 없다')
        else if (!f.flashBoxes.includes(f.leakBox)) row.fails.push(`부분 누출 대조: 뗀 대상(상자 ${f.leakBox})의 번쩍임을 못 잡았다 — 상자별 판정이 눈멀었다`)
      }
    }
    out[mode] = row
  }
  return out
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',')
  // --blocks <블록@레시피,…>(P3-5 MOTKIT): 레시피 히어로 대신 블록 서버 렌더 쪽(/qa/blocks/ssr)을 잰다 — 레시피 검수대에 구성이 없는 모션 그래픽 히어로용.
  const blocks = flag('--blocks')?.split(',').map((x) => { const [b, r] = x.split('@'); if (!b || !r) throw new Error(`--blocks 는 <블록>@<레시피>: ${x}`); return { b, r } })
  const origin = (argv.filter((a) => !a.startsWith('--'))[0] ?? 'http://localhost:3000').replace(/\/$/, '')
  const dir = join(OUT, 'gates')
  const file = join(dir, blocks ? `ssr-flash-blocks-${blocks.map((x) => `${x.b.replace(/^block-hero-/, '')}@${x.r}`).join('_')}.json` : only ? `ssr-flash-${only.join('_')}.json` : 'ssr-flash.json')
  mkdirSync(dir, { recursive: true })
  rmSync(file, { force: true })
  let code = 0, chrome
  try {
    chrome = await startChrome(GATE_CHROME_FLAGS, { prefix: 'ssr-flash-' })
    const c = { onFrame: null, delay: 0 }
    const conn = await connect(chrome.wsUrl, {
      onEvent: (d) => {
        if (d.method === 'Page.screencastFrame') { c.onFrame?.(d.params); conn.send('Page.screencastFrameAck', { sessionId: d.params.sessionId }).catch(() => {}) }
        // JS 청크를 붙잡았다가 delay 뒤 놓는다(하이드레이션 늦춤). 서버 HTML·CSS·서체는 그대로.
        if (d.method === 'Fetch.requestPaused') { const id = d.params.requestId; setTimeout(() => conn.send('Fetch.continueRequest', { requestId: id }).catch(() => {}), c.delay) }
      },
    })
    Object.assign(c, conn)
    await c.send('Page.enable'); await c.send('Runtime.enable')
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'no-preference' }] })
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: QA_SCRIPT })
    await c.send('Fetch.enable', { patterns: [{ urlPattern: '*/_next/static/*', resourceType: 'Script', requestStage: 'Request' }] })
    const rows = []
    const heads = loadHeads()
    const themeOf = (h) => (h.defaultTheme === 'dark' ? 'dark' : 'light')
    const targets = blocks
      ? blocks.map(({ b, r }) => {
          const h = heads.find((x) => x.id === r)
          if (!h) throw new Error(`레시피 없음 ${r}`)
          return { h: { ...h, id: `${b}@${r}` }, o: { key: 'block', query: '' }, url: `${origin}/qa/blocks/ssr?b=${b}&r=${r}&theme=${themeOf(h)}` }
        })
      : heads.filter((x) => !only || only.includes(x.id)).flatMap((h) => optionsOf(h).map((o) => ({ h, o, url: `${origin}/qa/recipes/ssr?r=${h.id}&theme=${themeOf(h)}${o.query}` })))
    for (const { h, o, url } of targets) {
      // 데우기(서버 첫 컴파일·서체) — 재지 않는다.
      c.delay = 0
      await c.send('Page.navigate', { url: await sceneUrl(c.send, url) }); await sleep(2500)
      await c.ev(ENTERED_WAIT)
      const m = await measureSsrFlash(c, url)
      const fails = Object.entries(m).flatMap(([k, x]) => x.fails.map((f) => `${k}: ${f}`))
      rows.push({ recipe: h.id, option: o.key, pass: !fails.length, fails, modes: m })
      const g = m.gate, k = m.control, l = m.leak, l2 = m.leak2, f = m.failsafe
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${h.id}-${o.key}${g.keepOnly ? ' [keep 전용]' : ''} gate: 하이드레이션 ${g.hydrateAfter}s 전 프레임 ${g.frames ?? '-'}개 번쩍임 상자 ${g.flashBoxes?.length ?? '-'}/${g.boxes ?? '-'} · 새어 나온 픽셀 최대 ${g.pixel ? Math.max(0, ...g.pixel.leaked) : '-'} · 보이는 대상 ${g.probeMid?.visible ?? '-'}/${g.probeMid?.targets ?? '-'} · keep 보임 ${g.probeMid?.keepVisible ?? '-'}/${g.probeMid?.keep ?? 0} · 끝 신호 「${g.enteredValue}」 | control: 번쩍임 ${k.flashFrames ?? '-'}/${k.frames ?? '-'} 상자 ${k.flashBoxes?.length ?? '-'}/${k.boxes ?? '-'} | leak ${l.na ? '해당 없음' : `${(l.leak?.pick?.sig ?? '-').slice(0, 40)}: 상자 ${l.leakBox} 새어 나온 픽셀 ${l.pixel?.leaked[l.leakBox] ?? '-'} 잡음 ${l.flashBoxes ? l.flashBoxes.includes(l.leakBox) : '-'}`} | leak2 ${l2.na ? '해당 없음' : `${(l2.leak?.pick?.sig ?? '-').slice(0, 40)}: 상자 ${l2.leakBox} 새어 나온 픽셀 ${l2.pixel?.leaked[l2.leakBox] ?? '-'} 잡음 ${l2.flashBoxes ? l2.flashBoxes.includes(l2.leakBox) : '-'}`} | keepctl ${m.keepctl.na ? '해당 없음' : `옮긴 상자 ${m.keepctl.shiftBoxes?.length} 잡음 ${m.keepctl.shiftBoxes?.some((i) => m.keepctl.flashBoxes?.includes(i))}`} | failsafe: DCL ${f.dclAfter}s 드러냄 ${f.lateAfter}s 하이드레이션 ${f.hydrateAfter}s ${f.motion} · 끝 신호 「${f.enteredValue}」 · 드러난 뒤 프레임 ${f.failsafe?.frames ?? '-'} 재숨김 ${f.failsafe?.rehidden ?? '-'} · 건너뛴 뒤 숨은 대상 ${f.visible?.hidden.length ?? '-'} · 숨김 대조 ${f.visible ? f.visible.control.filter((x) => x.caught).length : '-'}/3${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`)
    }
    conn.ws.close()
    const failed = rows.filter((r) => !r.pass)
    writeFileSync(file, JSON.stringify({ origin, modes: MODES, count: rows.length, failed: failed.length, rows }, null, 2) + '\n')
    const na = rows.filter((r) => r.modes.leak?.na).length
    const keepOnlyN = rows.filter((r) => r.modes.gate?.keepOnly).length
    console.log(`SSR 번쩍임 검사: ${rows.length}개 히어로 중 실패 ${failed.length} · keep 전용 ${keepOnlyN}(양성 대조 잡음 ${rows.filter((r) => r.modes.gate?.keepOnly && !r.modes.keepctl?.fails.length).length}) · 부분 누출 대조 실행 ${rows.length - na}(잡음 ${rows.filter((r) => !r.modes.leak?.na && !r.modes.leak?.fails.length).length}) · 해당 없음 ${na} · 작은 상자 대조 실행 ${rows.filter((r) => !r.modes.leak2?.na).length}(잡음 ${rows.filter((r) => !r.modes.leak2?.na && !r.modes.leak2?.fails.length).length}) · 건너뛴 뒤 보임 검사 ${rows.filter((r) => r.modes.failsafe?.visible && !r.modes.failsafe.visible.hidden.length).length}/${rows.length}(숨김 대조 잡음 ${rows.filter((r) => r.modes.failsafe?.visible?.control.every((x) => x.caught)).length}/${rows.length})`)
    code = failed.length ? 1 : 0
  } catch (e) {
    console.error(`도구 실패: ${e.stack || e.message}`)
    rmSync(file, { force: true })
    code = 1
  } finally {
    await chrome?.close()
  }
  process.exit(code)
}
