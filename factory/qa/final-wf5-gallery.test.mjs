// FINAL-WF5 갤러리 시험(Chrome) — 격자 열 배치(항목 8) · 버튼 포커스 링 대비(항목 10) · 빈 그림 칸 표지(항목 9) · 하단 예약 바 정렬(항목 3). 갤러리 서버(next start)가 있어야 돈다.
// 실행: WF5_ORIGIN=http://localhost:4120 node --test --test-force-exit --test-timeout=900000 factory/qa/final-wf5-gallery.test.mjs   (WF5_ORIGIN 이 없으면 건너뛴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.WF5_ORIGIN?.replace(/\/$/, '') ?? null
const skip = !ORIGIN && 'WF5_ORIGIN(갤러리 서버 주소)이 없다'
const sharp = skip ? null : createRequire(join(root, 'package.json'))('sharp')

// gridCols 는 순수 함수라 원천에서 그대로 뽑는다(복사본이 아니라 출하되는 코드)
const ts = createRequire(join(root, 'package.json'))('typescript')
const gridColsOut = join(root, '.tmp', 'final-wf5-gallery-test', 'grid-cols.mjs')
mkdirSync(dirname(gridColsOut), { recursive: true })
writeFileSync(gridColsOut, ts.transpileModule(readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'grid-cols.tsx'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText)
const { gridCols } = await import(pathToFileURL(gridColsOut).href)

async function withChrome(fn, { width = 1440, height = 900, motion = 'reduce' } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'wf5g-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }] })
    try { return await fn({ send, ev }) } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
}
const gallery = (b, extra = '', r = 'r1-measure') => `${ORIGIN}/qa/blocks?b=${b}&r=${r}${extra}&frame=1`
async function openGalleryBlock({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
}
const tab = async (send, shift = false) => {
  const base = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }); await sleep(80)
}

// ── 항목 8: 격자 열 배치 — 항목 3·4·5·7개일 때 마지막 줄 빈 칸·3+1 이 없다(열 수 × 줄 수 = 항목 수, 또는 마지막 줄이 가운데 정렬) ───────────────────────────
// 갤러리 예시는 항목 수가 정해져 있어, 격자의 자식을 늘리고 줄이고 data-cols 를 gridCols(n) 로 다시 건다(블록이 하는 일과 같다) — CSS 가 정한 모양을 잰다.
const GRIDS = [
  { id: 'content/cards', b: 'block-content-cards', prefer: undefined },
  { id: 'integrations/icon-grid', b: 'block-integrations-icon-grid', prefer: [4, 3, 2] },
]
const MUTATE = (n, cols) => `(() => {
  const ul = document.querySelector('[data-cols]')
  const src = [...ul.children]
  while (ul.children.length < ${n}) ul.append(src[ul.children.length % src.length].cloneNode(true))
  while (ul.children.length > ${n}) ul.lastElementChild.remove()
  ul.setAttribute('data-cols', '${cols}')
})()`
const MEASURE = `(() => {
  const ul = document.querySelector('[data-cols]')
  const u = ul.getBoundingClientRect(), cs = getComputedStyle(ul)
  const left = u.left + parseFloat(cs.paddingLeft), right = u.right - parseFloat(cs.paddingRight)
  const rects = [...ul.children].map((li) => { const r = li.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top } })
  const rows = []
  for (const r of rects) { const row = rows.find((x) => Math.abs(x.t - r.t) < 3); if (row) { row.n++; row.l = Math.min(row.l, r.l); row.r = Math.max(row.r, r.r) } else rows.push({ t: r.t, n: 1, l: r.l, r: r.r }) }
  return { rows, left, right, sw: document.documentElement.scrollWidth, vw: innerWidth, cols: ul.getAttribute('data-cols') }
})()`
for (const g of GRIDS) for (const width of [1440, 768, 375]) {
  test(`WF5-8: ${g.id} ${width}px — 항목 3·4·5·7개: 마지막 줄이 꽉 차거나 가운데에 선다(빈 칸·고아 한 칸 없음)`, { skip }, async () => {
    await withChrome(async (s) => {
      await openGalleryBlock(s, gallery(g.b, '&fx=max'))
      const out = []
      for (const n of [3, 4, 5, 7]) {
        const cols = gridCols(n, g.prefer ? { prefer: g.prefer } : undefined)
        await s.ev(MUTATE(n, cols)); await sleep(250) // 바꾼 뒤 한 박자 — 0.01ms 전환이 끝나게(REL11)
        const m = await s.ev(MEASURE)
        const perRow = m.rows.map((r) => r.n)
        const C = perRow[0]
        const last = m.rows.at(-1)
        const lastFull = last.n === C
        const free = (m.right - m.left) - (last.r - last.l)
        const centered = Math.abs((last.l - m.left) - (m.right - last.r)) <= 2
        out.push({ n, cols: m.cols, perRow: perRow.join('+'), lastFull, centered, free: Math.round(free) })
        assert.equal(m.sw, m.vw, `n=${n}: 가로로 넘친다 ${JSON.stringify(m)}`)
        assert.ok(perRow.slice(0, -1).every((x) => x === C), `n=${n}: 줄마다 칸 수가 다르다 ${perRow}`)
        assert.ok(lastFull || centered, `n=${n}: 마지막 줄 ${last.n}/${C} 이 왼쪽에 붙은 빈 칸(여백 ${Math.round(free)}px, 가운데 아님) — ${perRow.join('+')} (data-cols=${m.cols})`)
        assert.ok(!(C > 1 && last.n === 1 && m.rows.length > 1 && !centered), `n=${n}: 3+1 고아 한 칸 ${perRow.join('+')}`)
      }
      console.log(`WF5-8 ${g.id} ${width}px`, JSON.stringify(out))
    }, { width })
  })
}

// ── 항목 10: 버튼 포커스 링이 인접 배경과 3:1 이상 — Tab 으로 초점을 준 뒤 버튼 둘레 픽셀을 읽는다 ─────────────────────────────────────────────────────────────
const rgb = (p) => [p[0], p[1], p[2]]
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
const lum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const recipes = () => readdirSync(join(root, 'registry', 'factory', 'recipes')).filter((d) => /^r\d+-/.test(d)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
const RING_RECIPES = (process.env.WF5_RING_RECIPES ?? '').split(',').filter(Boolean)
async function ringContrast(s, recipe) {
  await navigateAndWait(s.send, s.ev, gallery('block-lead-capture-inline-newsletter', '', recipe), { timeoutMs: 120000 })
  await sleep(1500)
  if (await s.ev(`document.body.innerText.includes('이 없습니다')`)) return { recipe, skipped: '갤러리에 없는 레시피' }
  for (let i = 0; i < 1200 && !(await s.ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
  // 첫 주 행동 버튼(제출)에 Tab 으로 초점 — 키보드 방식이라 :focus-visible 이 켜진다
  let active = null
  for (let i = 0; i < 40; i++) { await tab(s.send); active = await s.ev(`(() => { const a = document.activeElement; return a && a.tagName === 'BUTTON' && a.type === 'submit' ? true : false })()`); if (active) break }
  assert.ok(active, `${recipe}: 제출 버튼에 초점이 안 닿았다`)
  const box = await s.ev(`(() => { const r = document.activeElement.getBoundingClientRect(); const cs = getComputedStyle(document.activeElement); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, fv: document.activeElement.matches(':focus-visible'), bg: cs.backgroundColor, shadow: cs.boxShadow, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor } })()`)
  assert.ok(box.fv, `${recipe}: :focus-visible 이 안 켜졌다`)
  await s.ev('scrollTo(0, 0)')
  const y0 = Math.max(0, Math.round(box.y - 24)), x0 = Math.max(0, Math.round(box.x - 24))
  const shot = await s.send('Page.captureScreenshot', { format: 'png', clip: { x: x0, y: y0, width: Math.round(box.w + 48), height: Math.round(box.h + 48), scale: 1 }, captureBeyondViewport: true })
  const { data, info } = await sharp(Buffer.from(shot.result.data, 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]] }
  const cx = Math.round(box.x - x0 + box.w / 2), top = Math.round(box.y - y0)
  // 링은 버튼 위쪽 가장자리 바깥으로: [버튼] → 바깥 간격(ring-offset 2px, 바탕색) → 링(3px) → 바깥 바탕. 인접 배경 = 간격(top-1)과 링 바깥(top-9) 둘 다 3:1 이상이어야 한다.
  const gap = px(cx, top - 1)
  let ring = gap, best = 0
  for (let d = 2; d <= 6; d++) { const p = px(cx, top - d); const c = contrast(p, gap); if (c > best) { best = c; ring = p } }
  // 링 바깥 바탕 = 버튼 폭 한 줄(top-9)에서 가장 많은 색(글자 같은 잡음은 소수)
  const tally = new Map()
  for (let x = Math.max(0, cx - Math.round(box.w / 2) + 2); x < Math.min(info.width, cx + Math.round(box.w / 2) - 2); x += 2) { const k = px(x, top - 9).join(','); tally.set(k, (tally.get(k) ?? 0) + 1) }
  const outer = [...tally].sort((m, n) => n[1] - m[1])[0][0].split(',').map(Number)
  const btn = px(cx, top + Math.round(box.h / 2))
  const vsGap = Math.round(contrast(ring, gap) * 100) / 100, vsOuter = Math.round(contrast(ring, outer) * 100) / 100
  return { recipe, ringVsPage: Math.min(vsGap, vsOuter), vsGap, vsOuter, ring: rgb(ring), page: gap, outer, button: btn, shadow: box.shadow.slice(0, 80), outline: box.outline }
}
test('WF5-10: 버튼 포커스 링 — 갤러리의 레시피마다 링이 인접 배경(바깥 간격·링 바깥 바탕)과 3:1 이상', { skip }, async () => {
  const list = RING_RECIPES.length ? RING_RECIPES : recipes()
  const out = []
  for (const r of list) await withChrome(async (s) => { try { out.push(await ringContrast(s, r)) } catch (e) { out.push({ recipe: r, error: String(e.message).slice(0, 200) }) } }, { width: 1024 })
  const measured = out.filter((o) => o.vsGap !== undefined)
  const failed = out.filter((o) => o.error)
  console.log('WF5-10 건너뜀', JSON.stringify(out.filter((o) => o.skipped).map((o) => o.recipe)), '오류', JSON.stringify(failed))
  assert.ok(measured.length >= 3, `측정한 레시피 ${measured.length}벌 < 3`)
  assert.deepEqual(failed, [], '측정 오류')
  console.log('WF5-10', JSON.stringify(measured.map((o) => [o.recipe, o.vsGap, o.vsOuter, `ring ${o.ring.join(',')}`, `gap ${o.page.join(',')}`, `outer ${o.outer.join(',')}`, `btn ${o.button.join(',')}`])))
  const bad = measured.filter((o) => o.ringVsPage < 3)
  assert.deepEqual(bad.map((o) => `${o.recipe} 간격 ${o.vsGap}:1 · 바깥 ${o.vsOuter}:1 링 rgb(${o.ring}) 간격 rgb(${o.page}) 바깥 rgb(${o.outer}) ${o.shadow}`), [])
})

// ── 항목 9: 빈 그림 칸 표지 — src 가 빈 슬롯은 「실제 사진 필요」 판으로 보인다(갤러리 &media=empty) ───────────────────────────────────────────────────────────
for (const [b, label] of [['block-hero-baseline-split', '실제 사진 필요'], ['block-hero-screenshot-window', '실제 사진 필요']]) {
  test(`WF5-9: ${b} — 빈 그림 칸에 「${label}」 표지(보이고, 이름이 붙고, 판이 비어 보이지 않는다)`, { skip }, async () => {
    await withChrome(async (s) => {
      await openGalleryBlock(s, gallery(b, '&media=empty'))
      const m = await s.ev(`(() => { const e = document.querySelector('[data-block] [data-photo-needed]'); if (!e) return null; const r = e.getBoundingClientRect(), t = e.textContent.trim(); const img = [...document.querySelectorAll('[data-block] img')].filter((i) => !i.getAttribute('src')).length; return { text: t, label: e.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), emptyImgs: img, visible: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' } })()`)
      assert.ok(m, '표지 요소가 없다')
      console.log(`WF5-9 ${b}`, JSON.stringify(m))
      assert.equal(m.text, label)
      assert.ok(m.visible && m.w >= 80 && m.h >= 60, `판이 너무 작다 ${JSON.stringify(m)}`)
      assert.equal(m.emptyImgs, 0, '깨진 빈 <img> 가 남았다')
    })
  })
}

// ── 항목 3: 하단 예약 바 — 안내 글이 없으면 데스크톱에서 버튼 둘이 가운데(또는 전폭)에 선다 ──────────────────────────────────────────────────────────────────────
test('WF5-3: bottom-tab/split-booking-bar 1440px(안내 글 없음) — 두 버튼 묶음이 가운데에 선다', { skip }, async () => {
  await withChrome(async (s) => {
    await openGalleryBlock(s, gallery('block-bottom-tab-split-booking-bar', '&fx=min'))
    const m = await s.ev(`(() => { const row = document.querySelector('[data-block="bottom-tab-split-booking-bar"] a').closest('div').parentElement; const b = [...document.querySelectorAll('[data-block="bottom-tab-split-booking-bar"] a')].map((a) => a.getBoundingClientRect()); const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); return { left: Math.min(...b.map((x) => x.left)) - (rr.left + parseFloat(cs.paddingLeft)), right: (rr.right - parseFloat(cs.paddingRight)) - Math.max(...b.map((x) => x.right)), solo: row.hasAttribute('data-solo'), n: b.length, vw: innerWidth } })()`)
    console.log('WF5-3', JSON.stringify(m))
    assert.equal(m.solo, true)
    assert.ok(Math.abs(m.left - m.right) <= 2, `버튼 묶음이 가운데가 아니다(왼쪽 여백 ${Math.round(m.left)}px · 오른쪽 ${Math.round(m.right)}px)`)
  })
})
test('WF5-3: 안내 글이 있으면 예전 그대로 — 안내는 왼쪽, 버튼 묶음은 오른쪽(양성 대조)', { skip }, async () => {
  await withChrome(async (s) => {
    await openGalleryBlock(s, gallery('block-bottom-tab-split-booking-bar'))
    const m = await s.ev(`(() => { const row = document.querySelector('[data-block="bottom-tab-split-booking-bar"] a').closest('div').parentElement; const note = row.querySelector('p').getBoundingClientRect(), btn = [...row.querySelectorAll('a')].map((a) => a.getBoundingClientRect()); return { solo: row.hasAttribute('data-solo'), noteRight: note.right, btnLeft: Math.min(...btn.map((x) => x.left)), vw: innerWidth } })()`)
    assert.equal(m.solo, false)
    assert.ok(m.noteRight <= m.btnLeft, JSON.stringify(m))
  })
})
