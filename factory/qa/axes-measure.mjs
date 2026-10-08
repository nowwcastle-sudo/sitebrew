// 축 갤러리 실측: node factory/qa/axes-measure.mjs <url(/qa/axes)> <out.json>
// 명세 수치를 계산된 스타일로 확인한다(1440·375 × 라이트·다크). 종료: 0 = 쟀고 어긋남 없음 · 1 = 쟀고 어긋남 있음(out.json 있음) 또는 도구 실패
// (탐색 실패·CDP 기한 초과 등 — 「도구 실패:」를 적고 out.json 을 남기지 않는다, hit-area 와 같다) · 2 = 인자 오류. 표: docs/agents/agent-guide.md §3.
//  - 표 행 높이: T1 36~40 · T2 48 · T3 56 · T4 40 (tbody 행, ±1px 는 행 경계선)
//  - H4: 메뉴 줄 40px, 레일 폭 240px
//  - 블러(backdrop-filter ≠ none)는 fixed·sticky 요소나 헤더 뿌리(셸이 sticky/fixed 로 둔다)에만 — 흐르는 카드에는 없다
//  - C5 카드: 블러 없음, 바탕 불투명
//  - 설명·문단(data-slot 이 …-description): 행간 1.6 이상
//  Task 16a 새 칸:
//  - C6: 카드 테두리 2~3px·모서리 0·채움 불투명, 잉크 테두리가 채움·바탕 위 3:1, 오프셋 그림자(S2 짝) · C8: 테두리 4px·모서리 0
//  - R3: 아바타(이미지 마스크)만 블롭(모서리 넷이 서로 다름), 체크박스·배지는 R1 칸과 같은 반경
//  - D1~D3: 제목이 칸을 넘지 않는다(잘리는 낱말 없음 — scrollWidth ≤ clientWidth), 가장 작은 폭에서도 44px 이상, D2 는 1440px 에서 10~20vw,
//    D3 은 움직임(transition 에 letter-spacing)이 있고 동작 줄이기(375px 칸은 reduce 로 잰다)에서는 transition 이 0초
//  - X0~X3: 무늬 층(::before) 표시·불투명도(X1 0.03~0.06 곱하기(다크 스크린), X2 ≤ 0.08), X3 은 종이 층(::after) 불투명, 칸이 가로로 넘치지 않는다
//  - K9 예시: 본문·보조 글자 대 바탕 7:1 · 문서 전체 가로 넘침 없음
//  P3-6 사진 질감(X4~X8): 무늬 층 표시 + 사진 질감 × 레시피 팔레트 3벌(r1·r5·r8) × 라이트·다크 × 1440·375 의 글자 대비를 Chrome 픽셀로 잰다(texture-contrast.mjs —
//    본문·보조 p5 7:1, 제목·버튼 p5 4.5:1). 간유리(X7·X8)는 흐르는 구획에 뒤 흐림이 없고(허용 조건 2), overlay 구획은 흐림 ≤ 20px·글자 면 ≥ 92%·장면 셋(튤립·야경·최악 단색) 위 대비 통과,
//    prefers-reduced-transparency 에서 흐림 꺼짐·글자 면 100%(1440 라이트에서 한 번).
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'
import { measureTextureCells, textureCellFailures, reducedTransparencyFailures, REDUCED_TRANSPARENCY, summarize } from './texture-contrast.mjs'

const [url, outPath] = process.argv.slice(2)
if (!url || !outPath) { console.error('사용: node factory/qa/axes-measure.mjs <url> <out.json>'); process.exit(2) }
mkdirSync(dirname(outPath), { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const ROWS = { T1: [36, 40], T2: [48, 49], T3: [56, 57], T4: [40, 41] }
const MEASURE = `(() => {
  const rows = {}
  for (const id of ${JSON.stringify(Object.keys(ROWS))}) rows[id] = [...document.querySelectorAll('[aria-label^="' + id + ' "] tbody tr')].map((r) => +r.getBoundingClientRect().height.toFixed(1))
  const rail = document.querySelector('[aria-label="H4 사이드 레일"]')
  const h4Menu = [...document.querySelectorAll('[aria-label^="H4 "] [data-slot=sidebar-menu-button]')].map((b) => +b.getBoundingClientRect().height.toFixed(1))
  const blurred = [...document.querySelectorAll('body *')].filter((e) => { const b = getComputedStyle(e).backdropFilter; return b && b !== 'none' })
    .map((e) => ({ slot: e.dataset.slot || e.tagName, position: getComputedStyle(e).position, filter: getComputedStyle(e).backdropFilter }))
  const c5 = document.querySelector('[aria-label^="C5 "] [data-slot=card]')
  const cv = document.createElement('canvas').getContext('2d'); const alpha = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0,0,1,1); return cv.getImageData(0,0,1,1).data[3] / 255 }
  const desc = [...document.querySelectorAll('[data-slot$=-description]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => { const s = getComputedStyle(e); return { slot: e.dataset.slot, ratio: +(parseFloat(s.lineHeight) / parseFloat(s.fontSize)).toFixed(3) } })
  // Task 16a — 색은 캔버스로 sRGB 바이트를 얻어 WCAG 대비를 잰다(oklch 계산값도 같은 길로).
  const rgb = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0,0,1,1); return [...cv.getImageData(0,0,1,1).data].slice(0,3) }
  const lum = (c) => rgb(c).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0)
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2) }
  const pageBg = getComputedStyle(document.body).backgroundColor
  const card = (id) => document.querySelector('[aria-label^="' + id + ' "] [data-slot=card]')
  const cardOf = (id) => { const e = card(id); if (!e) return null; const c = getComputedStyle(e); return { border: parseFloat(c.borderTopWidth), radius: c.borderTopLeftRadius, bgAlpha: alpha(c.backgroundColor), shadow: c.boxShadow, onFill: cr(c.borderTopColor, c.backgroundColor), onPage: cr(c.borderTopColor, pageBg) } }
  const radiusOf = (id, sel) => { const e = document.querySelector('[aria-label^="' + id + ' "] ' + sel); if (!e) return null; const c = getComputedStyle(e); return [c.borderTopLeftRadius, c.borderTopRightRadius, c.borderBottomRightRadius, c.borderBottomLeftRadius].join(' ') }
  const display = ['D1', 'D2', 'D3'].map((id) => [...document.querySelectorAll('[aria-label^="' + id + ' "] [data-slot=display-title]')].map((e) => { const c = getComputedStyle(e); return { id, font: parseFloat(c.fontSize), vw: +(parseFloat(c.fontSize) / innerWidth * 100).toFixed(2), crop: e.scrollWidth - e.clientWidth, right: +e.getBoundingClientRect().right.toFixed(1), transition: c.transitionProperty, duration: c.transitionDuration } })).flat()
  const texture = ['X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8'].map((id) => { const e = document.querySelector('[aria-label^="' + id + ' "] [data-slot=texture]'); if (!e) return { id, missing: true }; const b = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after'); return { id, before: b.display, opacity: +(+b.opacity).toFixed(3), blend: b.mixBlendMode, after: a.display, afterAlpha: a.display === 'none' ? null : alpha(a.backgroundColor), crop: e.scrollWidth - e.clientWidth, textOnPage: cr(getComputedStyle(e.querySelector('p')).color, pageBg) } })
  const k9 = document.querySelector('[data-qa=k9]')
  const k9m = k9 ? { body: cr(getComputedStyle(k9.querySelectorAll('p')[0]).color, getComputedStyle(k9).backgroundColor), muted: cr(getComputedStyle(k9.querySelectorAll('p')[1]).color, getComputedStyle(k9).backgroundColor) } : null
  return { rows, railWidth: rail ? +rail.getBoundingClientRect().width.toFixed(1) : null, h4Menu, blurred,
    c5: c5 ? { backdrop: getComputedStyle(c5).backdropFilter, bgAlpha: alpha(getComputedStyle(c5).backgroundColor) } : null, desc,
    c6: cardOf('C6'), c8: cardOf('C8'), r3: { avatar: radiusOf('R3', '[data-slot=avatar]'), checkbox: radiusOf('R3', '[data-slot=checkbox]'), badge: radiusOf('R3', '[data-slot=badge]') }, r1: { checkbox: radiusOf('R1', '[data-slot=checkbox]'), badge: radiusOf('R1', '[data-slot=badge]') },
    display, texture, k9: k9m, overflowX: document.documentElement.scrollWidth - innerWidth }
})()`

let chrome, code = 0, toolFailed = false
const result = {}
try {
  chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'axes-measure-' })
  const { ws, send, ev } = await connect(chrome.wsUrl) // 호출마다 기한(cdp.mjs session)
  await send('Page.enable'); await send('Runtime.enable')
  for (const [w, scheme] of [[1440, 'light'], [1440, 'dark'], [375, 'light'], [375, 'dark']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false })
    // 375px 칸은 동작 줄이기로 잰다(D3 키네틱이 정지하는지 — Task 16a). 나머지 검사는 동작과 무관하다.
    const reduce = w === 375
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
    const nav = await navigateAndWait(send, ev, url)
    if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
    await ev('document.fonts.ready.then(()=>1)'); await sleep(1800)
    const m = await ev(MEASURE)
    const fail = []
    for (const [t, [lo, hi]] of Object.entries(ROWS)) {
      if (!m.rows[t]?.length) fail.push(`${t}: 행 없음`)
      for (const h of m.rows[t] ?? []) if (h < lo || h > hi) fail.push(`${t}: 행 ${h}px (명세 ${lo}~${hi})`)
    }
    // 레일은 sidebar 부품이 md 미만에서 숨기지 않는(collapsible none) 정적 레일이다 — 폭 240.
    if (m.railWidth !== 240) fail.push(`H4 레일 폭 ${m.railWidth}px (명세 240)`)
    if (!m.h4Menu.length || m.h4Menu.some((h) => h !== 40)) fail.push(`H4 메뉴 줄 ${m.h4Menu.join(',')}px (명세 40)`)
    for (const b of m.blurred) if (!['fixed', 'sticky'].includes(b.position) && b.slot !== 'navigation-menu') fail.push(`흐르는 요소에 블러: ${b.slot} ${b.filter}`)
    if (!m.c5 || m.c5.backdrop !== 'none' || m.c5.bgAlpha < 1) fail.push(`C5 카드: backdrop ${m.c5?.backdrop} · 바탕 알파 ${m.c5?.bgAlpha}`)
    for (const d of m.desc) if (d.ratio < 1.6) fail.push(`행간 ${d.slot} ${d.ratio}`)
    // ── Task 16a ──
    const c6 = m.c6, c8 = m.c8
    if (!c6 || c6.border < 2 || c6.border > 3 || c6.radius !== '0px' || c6.bgAlpha < 1 || c6.onFill < 3 || c6.onPage < 3 || c6.shadow === 'none') fail.push(`C6 카드: ${JSON.stringify(c6)}`)
    if (!c8 || c8.border !== 4 || c8.radius !== '0px' || c8.onPage < 3) fail.push(`C8 카드: ${JSON.stringify(c8)}`)
    const blob = (r) => !!r && r.includes('%') && new Set(r.split(' ')).size > 1
    if (!blob(m.r3.avatar)) fail.push(`R3 아바타 블롭 아님: ${m.r3.avatar}`)
    if (m.r3.checkbox !== m.r1.checkbox || m.r3.badge !== m.r1.badge) fail.push(`R3 컨트롤이 R1 과 다르다: ${JSON.stringify(m.r3)} vs ${JSON.stringify(m.r1)}`)
    if (m.display.length !== 6) fail.push(`디스플레이 제목 ${m.display.length}개 (명세 6)`)
    for (const d of m.display) {
      if (d.crop > 1) fail.push(`${d.id} 제목이 칸을 넘는다(잘림 ${d.crop}px)`)
      if (d.font < 36) fail.push(`${d.id} 제목 ${d.font}px < 36`)
      if (d.id === 'D2' && w === 1440 && (d.vw < 10 || d.vw > 20)) fail.push(`D2 ${d.vw}vw (명세 10~20vw)`)
      if (d.id !== 'D1' && w === 375 && d.font < 44) fail.push(`${d.id} 375px 제목 ${d.font}px < 44`)
      if (d.id === 'D3' && !reduce && !/letter-spacing/.test(d.transition)) fail.push(`D3 움직임 없음: ${d.transition}`)
      // factory-base 가 동작 줄이기에서 모든 전이를 0.00001s 로 누른다 — D3 의 letter-spacing 전이(motion-safe)가 빠지고 길이가 10ms 이하면 정지다.
      if (d.id === 'D3' && reduce && (/letter-spacing/.test(d.transition) || d.duration.split(',').some((x) => parseFloat(x) > 0.01))) fail.push(`D3 동작 줄이기에서 움직인다: ${d.transition} ${d.duration}`)
    }
    for (const t of m.texture) {
      if (t.missing) { fail.push(`${t.id} 칸 없음`); continue }
      if (t.crop > 1) fail.push(`${t.id} 칸이 가로로 넘친다(${t.crop}px)`)
      if (t.id === 'X0' && (t.before !== 'none' || t.after !== 'none')) fail.push(`X0 무늬가 있다: ${t.before}/${t.after}`)
      if (t.id === 'X1' && (t.before === 'none' || t.opacity < 0.03 || t.opacity > 0.06 || t.blend !== (scheme === 'dark' ? 'screen' : 'multiply'))) fail.push(`X1 그레인: ${JSON.stringify(t)}`)
      if (t.id === 'X2' && (t.before === 'none' || t.opacity > 0.08)) fail.push(`X2 망점: ${JSON.stringify(t)}`)
      if (t.id === 'X3' && (t.before === 'none' || t.after === 'none' || t.afterAlpha < 1)) fail.push(`X3 콜라주: ${JSON.stringify(t)}`)
      if (['X4', 'X5', 'X6', 'X7', 'X8'].includes(t.id) && (t.before === 'none' || t.after === 'none')) fail.push(`${t.id} 사진 질감 층이 없다: ${t.before}/${t.after}`)
    }
    // ── P3-6 사진 질감 × 레시피 팔레트 3벌 대비(texture-contrast.mjs) ──
    const tc = await measureTextureCells({ send, ev })
    for (const f of textureCellFailures(tc, { expectCells: 3 * (3 + 2 * 4) })) fail.push(f)
    if (w === 1440 && scheme === 'light') {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-reduced-transparency', value: 'reduce' }] })
      await sleep(300)
      const rt = await ev(REDUCED_TRANSPARENCY)
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
      for (const f of reducedTransparencyFailures(rt)) fail.push(f)
      m.reducedTransparency = rt
    }
    if (!m.k9 || m.k9.body < 7 || m.k9.muted < 7) fail.push(`K9 예시 대비: ${JSON.stringify(m.k9)}`)
    if (m.overflowX > 0) fail.push(`문서가 가로로 ${m.overflowX}px 넘친다`)
    result[`${w}-${scheme}`] = { ...m, desc: { count: m.desc.length, min: Math.min(...m.desc.map((d) => d.ratio)) }, textureContrast: summarize(tc), fail }
    if (fail.length) code = 1
  }
  ws.close()
} catch (e) { console.error(`도구 실패: ${e.message}`); code = 1; toolFailed = true } finally { await chrome?.close() }
// 측정 없음(도구 실패)이면 결과 파일을 남기지 않는다 — 부분 결과·이전 실행의 결과가 읽히지 않게(최종 리뷰 M2).
if (toolFailed) { rmSync(outPath, { force: true }); process.exit(code) }
writeFileSync(outPath, JSON.stringify(result, null, 2))
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, { rows: Object.fromEntries(Object.entries(v.rows).map(([t, hs]) => [t, [...new Set(hs)]])), rail: v.railWidth, h4Menu: [...new Set(v.h4Menu)], blurred: v.blurred.length, c5: v.c5, desc: v.desc, c6: v.c6, c8: v.c8, r3: v.r3, display: v.display.map((d) => `${d.id} ${d.font}px ${d.vw}vw crop ${d.crop}`), texture: v.texture.map((t) => `${t.id} ${t.before}/${t.after} op ${t.opacity} ${t.blend}`), k9: v.k9, overflowX: v.overflowX, fail: v.fail }]))))
process.exit(code)
