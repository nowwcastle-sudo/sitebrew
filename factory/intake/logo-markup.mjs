// 로고 시안의 마크업(v0.2.6 T14 · S2·S13) — 순수 함수만 둔다. Chrome·파일·네트워크 없음.
//   logo-candidates.mjs 가 이 글을 Chrome 으로 찍어 PNG 로 만든다. 서체는 호출하는 쪽이 base64 data URL 로 `fonts` 에 넘긴다(네트워크 0).

const INK_DEFAULT = '#1F2937'
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** HTML 글자 이스케이프 — 상호명은 사용자 입력이다. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** 색 목록 → { ink, accent }. 올바른 색 코드만 받고, 없으면 짙은 회색 한 가지. */
export function paletteOf(colors) {
  const ok = (colors ?? []).filter((c) => typeof c === 'string' && HEX.test(c.trim())).map((c) => c.trim())
  return { ink: ok[0] ?? INK_DEFAULT, accent: ok[1] ?? ok[0] ?? INK_DEFAULT }
}

/** 분위기 낱말 → 기호의 모서리 성격. 표에 없으면 balanced. */
export function softnessOf(mood) {
  const m = String(mood ?? '')
  if (/따뜻|부드|친근|둥|포근|warm|soft|friendly|cozy/i.test(m)) return 'soft'
  if (/단정|정확|엄격|날카|견고|sharp|precise|formal|strict/i.test(m)) return 'sharp'
  return 'balanced'
}
const RADIUS = { soft: 11, balanced: 6, sharp: 1 }

/** 기하 기호 — 40×40 안에 그리는 SVG 조각. 같은 입력이면 같은 글이다. */
export const GEOMETRIC_KINDS = ['ring-dot', 'stack', 'wedge', 'bars']
export function geometricMark(kind, { ink, accent }, softness = 'balanced') {
  const r = RADIUS[softness] ?? RADIUS.balanced
  const body = {
    'ring-dot': `<circle cx="20" cy="20" r="15" fill="none" stroke="${ink}" stroke-width="5"/><circle cx="20" cy="20" r="5.5" fill="${accent}"/>`,
    stack: `<rect x="3" y="3" width="24" height="24" rx="${r}" fill="${ink}"/><rect x="13" y="13" width="24" height="24" rx="${r}" fill="${accent}" fill-opacity="0.88"/>`,
    wedge: `<path d="M4 34 L20 5 L36 34 Z" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="${softness === 'sharp' ? 'miter' : 'round'}"/><circle cx="20" cy="27" r="5" fill="${accent}"/>`,
    bars: `<rect x="3" y="18" width="7" height="19" rx="${Math.min(r, 3.5)}" fill="${ink}"/><rect x="16.5" y="4" width="7" height="33" rx="${Math.min(r, 3.5)}" fill="${accent}"/><rect x="30" y="12" width="7" height="25" rx="${Math.min(r, 3.5)}" fill="${ink}"/>`,
  }[kind]
  if (!body) throw new Error(`모르는 기호 모양: ${kind}`)
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`
}

/**
 * 시안 6개의 명세. 글자형 2(서체 둘) + 기호+글자 4(기하 3 + Codex 1, Codex 가 꺼지면 기하 4).
 * extraFonts = 추가 서체 가족 이름들 — 글자형 시안이 그만큼 뒤에 붙는다.
 */
export function logoSpecs({ codex = false, extraFonts = [] } = {}) {
  const specs = [
    { kind: 'wordmark', symbol: 'geometric', face: 'bold', mark: null },
    { kind: 'wordmark', symbol: 'geometric', face: 'light', mark: null },
    { kind: 'mark+wordmark', symbol: 'geometric', face: 'bold', mark: 'ring-dot' },
    { kind: 'mark+wordmark', symbol: 'geometric', face: 'light', mark: 'stack' },
    { kind: 'mark+wordmark', symbol: 'geometric', face: 'bold', mark: 'wedge' },
    codex ? { kind: 'mark+wordmark', symbol: 'codex', face: 'bold', mark: 'codex' } : { kind: 'mark+wordmark', symbol: 'geometric', face: 'light', mark: 'bars' },
  ]
  for (const family of extraFonts) specs.push({ kind: 'wordmark', symbol: 'geometric', face: family, mark: null })
  return specs.map((s, i) => ({ id: i + 1, ...s }))
}

const FACE_CSS = {
  bold: "font-family:'LogoBold',sans-serif;font-weight:800;letter-spacing:-0.01em",
  light: "font-family:'LogoLight',sans-serif;font-weight:300;letter-spacing:0.14em",
}
const faceCss = (face) => FACE_CSS[face] ?? `font-family:'${face}',sans-serif;font-weight:400;letter-spacing:0.02em`

/** @font-face 규칙들. fonts = [{ family, url(data: URL), format, weight? }] */
export const fontFaceCss = (fonts) => fonts.map((f) => `@font-face{font-family:'${f.family}';src:url(${f.url}) format('${f.format}');font-weight:${f.weight ?? 'normal'}}`).join('\n')

/** 한 시안의 HTML 조각. codexUrl = Codex 기호 그림의 data URL(없으면 기하 기호로 대신한다는 뜻은 호출하는 쪽이 정한다). */
export function logoItemHtml(spec, { name, palette, softness, headerHeight, codexUrl }) {
  const mark = spec.mark === 'codex'
    ? `<img class="mark" src="${codexUrl}" alt="">`
    : spec.mark ? `<span class="mark">${geometricMark(spec.mark, palette, softness)}</span>` : ''
  return `<div class="logo" id="logo-${spec.id}" style="top:${(spec.id - 1) * (headerHeight + 24)}px;height:${headerHeight}px">${mark}<span class="word" style="${faceCss(spec.face)}">${esc(name)}</span></div>`
}

/** 시안 전체를 한 쪽에 겹치지 않게 세로로 쌓은 HTML — 배경은 투명이다. */
export function logoPageHtml({ specs, fonts, name, palette, softness, headerHeight, codexUrl }) {
  const size = Math.round(headerHeight * 0.62)
  const css = `${fontFaceCss(fonts)}
html,body{margin:0;background:transparent}
.logo{position:absolute;left:0;display:inline-flex;align-items:center;gap:${Math.round(headerHeight * 0.25)}px;white-space:nowrap;color:${palette.ink}}
.mark{height:${Math.round(headerHeight * 0.9)}px;width:${Math.round(headerHeight * 0.9)}px;display:block;object-fit:contain}
.mark svg{width:100%;height:100%;display:block}
.word{font-size:${size}px;line-height:1}`
  const items = specs.map((s) => logoItemHtml(s, { name, palette, softness, headerHeight, codexUrl })).join('\n')
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${css}</style><body>${items}</body></html>`
}

/** 시트 — 시안마다 1배(머리글 실제 크기)와 2배(확대)를 함께 보인다(S13). 이미지는 같은 폴더의 `<번호>.png` 상대 경로. */
export function sheetHtml({ items, name, headerHeight }) {
  const rows = items.map((it) => {
    const w1 = Math.round(it.width / 2)
    return `<tr><th scope="row">${it.id}<small>${esc(it.kind)}</small></th>
<td data-scale="1"><img src="${it.id}.png" width="${w1}" height="${headerHeight}" alt="${esc(name)} 시안 ${it.id} 1배"></td>
<td data-scale="2"><img src="${it.id}.png" width="${it.width}" height="${it.height}" alt="${esc(name)} 시안 ${it.id} 2배"></td></tr>`
  }).join('\n')
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>로고 시안 — ${esc(name)}</title>
<style>body{margin:24px;font:14px/1.4 'Pretendard',system-ui,sans-serif;background:#fff;color:#111}table{border-collapse:collapse}th,td{padding:14px 24px 14px 0;text-align:left;vertical-align:middle;border-bottom:1px solid #e5e7eb}th small{display:block;font-weight:400;color:#6b7280}caption{caption-side:top;text-align:left;font-weight:700;padding-bottom:10px}</style>
<table><caption>로고 시안 — 왼쪽은 머리글에서 보이는 실제 크기(1배), 오른쪽은 2배</caption><thead><tr><th>시안</th><th>1배</th><th>2배</th></tr></thead><tbody>
${rows}
</tbody></table></html>`
}
