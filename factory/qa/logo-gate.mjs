// 머리글 로고 관문(v0.2.6 T9 · S5·S13) — 브리프에 로고가 있는데 머리글에 로고가 안 보이면 공개 불가.
//   ① logoProbe()          쪽 안에서 도는 자기완결 함수 — ux-gate.mjs 가 폭·테마마다 한 번 재서 ux_gate.json 의 gate[<키>].logo 에 적는다 (이 파일은 판정하지 않는다)
//   ② judgeLogo(probes)    순수 판정 — 폭·테마별 계측 → { pass, problems[] }
//   ③ logoGateForCandidate 07-qa 어댑터 — ux 관문이 남긴 ux_gate.json 을 읽어 판정한다 (Chrome 을 다시 띄우지 않는다)
// 로고가 없는 브리프는 이 관문을 아예 돌리지 않는다(qa.mjs 가 hasBrandLogo 로 거른다).
import { readFileSync } from 'node:fs'

export const LOGO_MIN_HEIGHT = 20

/** 브리프에 로고가 있는가 — 후보의 브랜드 입력(directions.mjs brandInfo.input)에 로고 경로가 있을 때. */
export const hasBrandLogo = (cand) => typeof cand?.brand?.input?.logo === 'string' && cand.brand.input.logo.trim() !== ''

/**
 * 쪽 안에서 돈다(Function.toString 으로 건넨다 — 바깥 변수를 읽지 않는다). 머리글 로고 칸 `[data-slot=site-shell-logo]` 의 그려진 모양을 잰다.
 * kind: img(<img>) | mask(CSS mask-image 로 칠한 상자) | svg(인라인 <svg>) | text(그림이 없는 글자) | none(로고 칸 자체가 없음).
 * 다크 짝처럼 둘 이상이면 눈에 보이는 것을 고른다. img 의 complete 는 「다 받았고 깨지지 않았다」(naturalWidth > 0) — 깨진 그림은 complete 가 true 여도 naturalWidth 가 0 이다.
 */
export function logoProbe() {
  const slot = document.querySelector('[data-slot="site-shell-logo"]')
  const none = { present: false, kind: 'none', renderedHeight: 0, naturalWidth: 0, complete: false }
  if (!slot) return none
  const shown = (e) => {
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e)
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05
  }
  const maskOf = (e) => { const s = getComputedStyle(e); const m = s.maskImage || s.webkitMaskImage; return !!m && m !== 'none' }
  const pick = (list) => list.find(shown) ?? list[0]
  const out = (kind, e, extra = {}) => ({ present: true, kind, renderedHeight: Math.round(e.getBoundingClientRect().height * 10) / 10, naturalWidth: 0, complete: true, ...extra })
  const img = pick([...slot.querySelectorAll('img')])
  if (img) return out('img', img, { naturalWidth: img.naturalWidth, complete: img.complete && img.naturalWidth > 0 })
  const mask = pick([slot, ...slot.querySelectorAll('*')].filter(maskOf))
  if (mask) return out('mask', mask)
  const svg = pick([...slot.querySelectorAll('svg')])
  if (svg) return out('svg', svg)
  return out('text', slot, { complete: true })
}

const KIND_TEXT = { none: '로고 칸이 머리글에 없어요', text: '로고가 그림이 아니라 글자로 그려졌어요' }

/**
 * @param {Record<string, { present: boolean, kind: string, renderedHeight: number, naturalWidth: number, complete: boolean }|undefined>} probes  ux_gate.json 의 gate[키].logo — 키는 `<폭>-<테마>`
 * @returns {{ pass: boolean, problems: string[] }}  잰 값이 하나도 없으면 통과가 아니라 던진다(못 잰 값은 통과가 아니다)
 */
export function judgeLogo(probes) {
  const entries = Object.entries(probes ?? {}).filter(([, p]) => p && typeof p === 'object')
  if (!entries.length) throw new Error('도구 실패: 로고 계측이 하나도 없다 — ux-gate 가 logo 를 못 적었다')
  const problems = []
  for (const [key, p] of entries) {
    if (KIND_TEXT[p.kind]) { problems.push(`${key}: ${KIND_TEXT[p.kind]}`); continue }
    if (p.complete === false) problems.push(`${key}: 로고 그림이 깨졌거나 다 받아지지 않았어요`)
    else if (!(p.renderedHeight >= LOGO_MIN_HEIGHT)) problems.push(`${key}: 로고 높이가 ${p.renderedHeight}px 라 ${LOGO_MIN_HEIGHT}px 보다 작아요`)
  }
  return { pass: problems.length === 0, problems }
}

/**
 * 07-qa 어댑터 — ux 관문의 ux_gate.json 한 개(머리글은 모든 쪽에서 같으므로 쪽 하나)를 읽어 판정한다.
 * @param {{ id: string }} cand
 * @param {{ uxGateFile: string }} o  ux 관문이 남긴 `<07-qa>/ux/<쪽>/gate/ux_gate.json`
 * @returns 게이트 기록 { id, tool, exit, verdict, toolFailure, note, problems }
 */
export function logoGateForCandidate(cand, { uxGateFile }) {
  const base = { id: 'logo', tool: 'logo', attempts: 1 }
  const tool = (note) => ({ ...base, exit: 1, verdict: 'tool', toolFailure: true, note: `도구 실패: ${note}` })
  let gate
  try { gate = JSON.parse(readFileSync(uxGateFile, 'utf8')).gate } catch (e) { return tool(`${uxGateFile} 를 읽지 못했다 — ${e.code ?? e.message}`) }
  let verdict
  try { verdict = judgeLogo(Object.fromEntries(Object.entries(gate ?? {}).map(([k, g]) => [k, g?.logo]))) } catch (e) { return tool(e.message.replace(/^도구 실패: /, '')) }
  return { ...base, exit: verdict.pass ? 0 : 1, verdict: verdict.pass ? 'pass' : 'fail', toolFailure: false, note: verdict.pass ? '' : `머리글 로고 ${verdict.problems.length}건`, problems: verdict.problems }
}
