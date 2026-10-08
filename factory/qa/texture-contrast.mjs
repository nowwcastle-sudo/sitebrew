// 사진 질감(X4~X8, P3-6)의 글자 대비 실측 — axes-measure.mjs(qa:measure)가 /qa/axes 의 `[data-tc-cell]` 칸(질감 × 레시피 팔레트 3벌 × 뒤 장면)마다 부른다.
// 방법은 hero-contrast.mjs 와 같다: 글자 상자(`[data-tc]` — title·body·muted·button)를 모으고, 글자를 투명하게 한 화면을 찍어 상자 안 바탕을 2px 간격으로 표본해 WCAG 비를 잰다(p5 = 아래 5%, min = 가장 낮은 점).
// 문턱: 본문(body)·보조(muted) 7:1, 제목(title, 28px 굵게) 4.5:1, 버튼 4.5:1 — p5 로 판정하고 min 은 함께 적는다(다음 판정은 p5, 최저점은 참고 — README 「견본 측정」과 같다).
// 간유리는 칸마다 `data-tc-cell="<값>|<레시피>|<장면>"` 의 장면이 own(자기 사진 위, 흐르는 구획) · glass-a · glass-b · worst(overlay — 지나가는 화면)이고, 뒤 흐림(backdrop-filter)은 overlay 칸에서만 걸려야 한다(README 허용 조건 2).
// 정적 검사(compat.json·recipe lint)는 사진 위 바탕을 알 수 없어 이 실측이 대신한다 — 새 사진 질감 값·새 레시피 팔레트는 이 관문에 칸을 더해야 통과한다.
export const TEXT_MIN = { body: 7, muted: 7, title: 4.5, button: 4.5 }
export const ROLE_LABEL = { body: '본문', muted: '보조', title: '제목', button: '버튼' }
export const WASH_MIN = 92 // overlay 구획의 글자 면 불투명도(%) — README 허용 조건 3
export const BLUR_MAX = 20 // px — 허용 조건 4

const COLLECT = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgb = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0],d[1],d[2]] }
  const boxes = [], cells = []
  for (const cell of document.querySelectorAll('[data-tc-cell]')) {
    const key = cell.dataset.tcCell
    const tex = cell.querySelector('[data-slot=texture]')
    const after = tex ? getComputedStyle(tex, '::after') : null
    const wash = tex ? parseFloat(getComputedStyle(tex).getPropertyValue('--wf-texture-a-wash')) : NaN
    cells.push({ key, overlay: !!tex && tex.hasAttribute('data-overlay'), backdrop: after ? after.backdropFilter : null, wash, crop: tex ? tex.scrollWidth - tex.clientWidth : 0, texW: tex ? tex.getBoundingClientRect().width : 0, cellW: cell.getBoundingClientRect().width })
    for (const el of cell.querySelectorAll('[data-tc]')) {
      const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); const col = rgb(cs.color)
      const r = document.createRange(); r.selectNodeContents(el)
      for (const b of r.getClientRects()) {
        let T = b.top + scrollY, B = b.bottom + scrollY
        const ex = (B - T) - size * 0.9; if (ex > 0) { T += ex / 2; B -= ex / 2 }
        if (b.width < 2 || B - T < 2) continue
        boxes.push({ key, role: el.dataset.tc, x: b.left + scrollX, y: T, w: b.width, h: B - T, col })
      }
    }
  }
  window.__tcBoxes = boxes
  return { boxes: boxes.length, cells, scrollW: document.documentElement.scrollWidth, innerW: innerWidth }
})()`

// 글자만 지운다 — 글 뒤 바탕(사진·도장·그림자·버튼 면)은 그대로 남긴다.
const HIDE = `(() => { for (const el of document.querySelectorAll('[data-tc-cell] *')) { for (const [p, v] of [['transition', 'none'], ['animation', 'none'], ['color', 'transparent'], ['text-shadow', 'none'], ['-webkit-text-fill-color', 'transparent']]) el.style.setProperty(p, v, 'important') } return 1 })()`

const MEASURE = (b64, from, to) => `(async () => {
  const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode()
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0)
  const px = cx.getImageData(0, 0, cv.width, cv.height).data
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const res = []
  for (const b of window.__tcBoxes) {
    if (b.y < ${from} || b.y >= ${to}) continue
    const lt = L(b.col[0], b.col[1], b.col[2]); const rs = []
    for (let y = Math.floor(b.y - ${from}); y < Math.min(cv.height, b.y - ${from} + b.h); y += 2) for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(cv.width, b.x + b.w); x += 2) {
      if (y < 0) continue
      const i = (y * cv.width + x) * 4; const lb = L(px[i], px[i+1], px[i+2])
      const hi = Math.max(lt, lb), lo = Math.min(lt, lb); rs.push((hi + 0.05) / (lo + 0.05))
    }
    if (!rs.length) continue
    rs.sort((a, c) => a - c)
    res.push({ key: b.key, role: b.role, n: rs.length, min: rs[0], p5: rs[Math.floor(rs.length * 0.05)] })
  }
  return { rows: res, imgW: img.width, imgH: img.height }
})()`

// 칸 모두를 한 번 찍어 표본한다. 반환: { cells[{ key, overlay, backdrop, wash, crop }], rows[{ key, role, p5, min, n }], boxes, imgW, scrollW, innerW }
export async function measureTextureCells({ send, ev, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const meta = await ev(COLLECT)
  if (!meta.boxes) return { cells: meta.cells, rows: [], boxes: 0, scrollW: meta.scrollW, innerW: meta.innerW }
  await ev(HIDE)
  await sleep(250)
  // 문서가 길면(375 는 한 줄 칸이라 수만 px) 한 장으로 못 찍는다(Chrome 이미지 상한 16384px) — 6000px 띠로 나눠 찍는다(띠마다 400px 겹쳐 줄 하나가 띠 경계에 걸리지 않게).
  const docH = await ev('document.documentElement.scrollHeight')
  const BAND = 6000, rows = []
  let imgW = 0
  for (let from = 0; from < docH; from += BAND) {
    const h = Math.min(BAND + 400, docH - from)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: from, width: meta.innerW, height: h, scale: 1 } })
    const data = shot?.result?.data ?? shot?.data
    if (!data) throw new Error('Page.captureScreenshot 가 이미지를 주지 않았다')
    const m = await ev(MEASURE(data, from, from + BAND))
    imgW = m.imgW
    rows.push(...m.rows)
  }
  const m = { rows, imgW }
  // 같은 칸·같은 역할의 줄이 여럿(여러 줄 글)이면 가장 낮은 값으로 합친다.
  const byKey = new Map()
  for (const r of m.rows) {
    const k = `${r.key}#${r.role}`
    const o = byKey.get(k)
    if (!o) byKey.set(k, { ...r }); else { o.p5 = Math.min(o.p5, r.p5); o.min = Math.min(o.min, r.min); o.n += r.n }
  }
  return { cells: meta.cells, rows: [...byKey.values()], boxes: meta.boxes, imgW: m.imgW, scrollW: meta.scrollW, innerW: meta.innerW }
}

// 판정 — 순수 함수(시험 가능). 문턱 미달·잰 칸 부족·overlay 가 아닌 칸의 뒤 흐림·overlay 칸의 낮은 불투명도·흐림 상한·가로 넘침을 돌려준다.
export function textureCellFailures(tc, { expectCells } = {}) {
  const fail = []
  const keys = new Set(tc.cells.map((c) => c.key))
  if (expectCells != null && keys.size !== expectCells) fail.push(`질감 대비 칸 ${keys.size}개 (기대 ${expectCells})`)
  if (!tc.rows.length) fail.push('질감 대비: 잰 글자 상자 0 — 통과가 아니라 측정 없음')
  for (const r of tc.rows) {
    const need = TEXT_MIN[r.role]
    if (need != null && r.p5 < need) fail.push(`질감 대비 ${r.key} ${ROLE_LABEL[r.role]} p5 ${r.p5.toFixed(2)} < ${need}`)
  }
  for (const key of keys) for (const role of Object.keys(TEXT_MIN)) if (!tc.rows.some((r) => r.key === key && r.role === role)) fail.push(`질감 대비 ${key} ${ROLE_LABEL[role]} 칸을 못 쟀다`)
  for (const c of tc.cells) {
    const glass = /^X[78]\|/.test(c.key)
    if (!c.overlay && c.backdrop && c.backdrop !== 'none') fail.push(`${c.key}: 흐르는 구획에 뒤 흐림(${c.backdrop}) — overlay 구획에만 건다`)
    if (glass && c.overlay) {
      const blur = parseFloat((c.backdrop.match(/blur\(([\d.]+)px\)/) ?? [])[1])
      if (!(blur > 0)) fail.push(`${c.key}: overlay 간유리에 뒤 흐림이 없다(${c.backdrop})`)
      else if (blur > BLUR_MAX) fail.push(`${c.key}: 뒤 흐림 ${blur}px > ${BLUR_MAX}px`)
      if (!(c.wash >= WASH_MIN)) fail.push(`${c.key}: overlay 글자 면 불투명도 ${c.wash}% < ${WASH_MIN}%`)
    }
    if (c.crop > 1) fail.push(`${c.key}: 질감 구획이 가로로 넘친다(${c.crop}px)`)
  }
  if (tc.scrollW > tc.innerW) fail.push(`질감 칸 문서가 가로로 ${tc.scrollW - tc.innerW}px 넘친다`)
  return fail
}

// 투명도 줄이기(`prefers-reduced-transparency: reduce`) 대체 확인 — overlay 칸이 흐림을 끄고 글자 면 100% 인지(허용 조건 5). 호출하는 쪽이 미디어 에뮬레이션을 넣고 되돌린다.
export const REDUCED_TRANSPARENCY = `(() => [...document.querySelectorAll('[data-tc-cell]')].filter((c) => /^X[78]\\|/.test(c.dataset.tcCell)).map((c) => {
  const t = c.querySelector('[data-slot=texture]'); const a = getComputedStyle(t, '::after')
  return { key: c.dataset.tcCell, overlay: t.hasAttribute('data-overlay'), backdrop: a.backdropFilter, wash: parseFloat(getComputedStyle(t).getPropertyValue('--wf-texture-a-wash')) }
}))()`
export function reducedTransparencyFailures(cells) {
  const fail = []
  if (!cells.length) fail.push('투명도 줄이기: 간유리 칸 0개 — 잰 것이 없다')
  for (const c of cells) {
    if (c.backdrop !== 'none') fail.push(`투명도 줄이기: ${c.key} 뒤 흐림이 꺼지지 않았다(${c.backdrop})`)
    if (c.wash !== 100) fail.push(`투명도 줄이기: ${c.key} 글자 면 ${c.wash}% ≠ 100%`)
  }
  return fail
}

// 결과 파일에 싣는 요약: 칸 × 역할의 p5·min.
export function summarize(tc) {
  const out = {}
  for (const r of tc.rows) (out[r.key] ??= {})[r.role] = { p5: +r.p5.toFixed(2), min: +r.min.toFixed(2) }
  return out
}
