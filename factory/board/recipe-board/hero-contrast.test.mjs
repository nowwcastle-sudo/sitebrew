// 히어로 픽셀 대비 관문(hero-contrast.mjs)의 판정·조합 검사 — 서버 없이 돈다(치수 라벨 수집기 검사 하나만 headless Chrome).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { judgeBoxes, isLarge, heroContrastJobs, BODY_MIN, LARGE_MIN, COLLECT, HIDE, VIDEO_AT, VIDEO_TIMES, DIM_LABEL_RE, DIM_COLLECT, DIM_CONTROL, dimensionLabelProblems, dimensionControlProblems } from './hero-contrast.mjs'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { loadHeads } from './jobs.mjs'
import { validCombos, altAxesOf } from '../../scripts/recipe.mjs'

test('thresholds: body 7, large (≥24px, or ≥18.66px bold) 4.5 — judged on p5, lowest per kind reported, zero boxes is a failure', () => {
  assert.equal(BODY_MIN, 7)
  assert.equal(LARGE_MIN, 4.5)
  assert.ok(isLarge(24, 400) && isLarge(18.66, 700) && !isLarge(18.66, 600) && !isLarge(23.9, 400))
  const ok = judgeBoxes([{ t: '본문', p5: 7.2, min: 5, large: false }, { t: '제목', p5: 4.6, min: 2, large: true }])
  assert.deepEqual(ok.fails, [])
  assert.equal(ok.lowestBody, 7.2)
  assert.equal(ok.lowestLarge, 4.6)
  // 양성 대조: 리뷰 b1 I1 의 r5 B 좌하 메타(3.33) · 큰 글자 4.4 는 실패다.
  const bad = judgeBoxes([{ t: '경기 이천', p5: 3.33, min: 3, large: false }, { t: '제목', p5: 4.4, min: 4, large: true }, { t: '괜찮음', p5: 9, min: 9, large: false }])
  assert.equal(bad.fails.length, 2)
  assert.match(bad.fails[0], /본문 「경기 이천」 p5 3\.33 < 7/)
  assert.deepEqual(judgeBoxes([]).fails, ['잰 글자 상자 0개'])
})

test('jobs: every live recipe with a B gets A, B and the board cross combos (B colour × A hero, A colour × B hero) in its default theme; r5-celadon (no B, Task 10f) gets A only', () => {
  const heads = loadHeads()
  assert.ok(heads.length >= 10, "라이브러리 레시피 수는 목록에서 읽는다(r12~r16 확정으로 15벌)")
  for (const h of heads) {
    const jobs = heroContrastJobs(h)
    const keys = jobs.map((j) => j.key)
    if (!h.alternates) assert.deepEqual(keys, ['A'], h.id)
    else assert.deepEqual(keys.slice(0, 2), ['A', 'B'], h.id)
    assert.ok(jobs.every((j) => j.theme === (h.defaultTheme === 'dark' ? 'dark' : 'light') && j.query.startsWith(`&theme=${j.theme}`)), h.id)
    const combos = validCombos(h).map((p) => p.join('+'))
    for (const j of jobs.slice(2)) assert.ok(combos.includes(j.alt), `${h.id} ${j.key}: 보드 조합이 아니다`)
    // B 색 × A 히어로가 보드 조합에 있으면 반드시 잰다(리뷰 b1 I1 — r5 A 히어로가 B 색에서 4.78).
    const bColorAHero = altAxesOf(h.alternates).filter((k) => k !== 'hero').join('+')
    // B가 자기 히어로를 갖는 레시피만 — r12~r16 의 B는 히어로를 바꾸지 않아 B 색 × A 히어로가 B 전체와 같다(교차 조합이 따로 없다).
    if (h.alternates?.hero && combos.includes(bColorAHero)) assert.ok(keys.includes('B색×A히어로'), h.id)
  }
  // B가 자기 히어로를 갖는 레시피는 모두 B 색 × A 히어로 조합을 보드에 낸다 — 이 검사가 빈 가지로 끝나지 않는다.
  assert.ok(heads.filter((h) => h.alternates?.hero).every((h) => heroContrastJobs(h).some((j) => j.key === 'B색×A히어로')))
})

test('page scripts: text is collected under [data-hero] only (sr-only, SVG text and faded layers skipped) and hidden with !important for the background shot', () => {
  assert.match(COLLECT, /querySelector\('\[data-hero\]'\)/)
  assert.match(COLLECT, /closest\('\.sr-only'\)/)
  assert.match(COLLECT, /closest\('svg'\)/)
  assert.match(COLLECT, /op < 0\.99/)
  assert.match(HIDE, /'color', 'transparent'/)
  // 색 전환이 있는 글자도 바로 투명해진다 — 전환을 먼저 끈다(Task 11).
  assert.ok(HIDE.indexOf("'transition', 'none'") >= 0 && HIDE.indexOf("'transition', 'none'") < HIDE.indexOf("'color', 'transparent'"))
  assert.match(HIDE, /setProperty\(p, v, 'important'\)/)
})

// 등장 중간 프레임(Task 11 fix): 떠오르는 중인 글자(fading)는 잰 값을 남기고(fadingBelow) 판정에서 뺀다 — 머무는 글자는 그대로 판정한다.
// WF_STRICT_FADE=1(strictFade)이면 떠오르는 중인 글자도 실패다(브리프 fix 8 문자 그대로 — 컨트롤러 판정 대기).
test('mid-frame judge: fading text is measured and reported but only resting text fails (strictFade fails both)', () => {
  const res = [
    { t: '떠오르는 설명', p5: 3.2, large: false, fading: true },
    { t: '머무는 반투명 글자', p5: 5.1, large: false },
    { t: '큰 제목', p5: 9, large: true },
  ]
  const j = judgeBoxes(res, { strictFade: false })
  assert.equal(j.boxes, 3)
  assert.equal(j.fading, 1)
  assert.equal(j.fadingBelow, 1)
  assert.deepEqual(j.fails, ['본문 「머무는 반투명 글자」 p5 5.1 < 7'])
  assert.equal(j.lowestBody, 3.2, '최저값 보고에는 떠오르는 중인 글자도 들어간다')
  const s = judgeBoxes(res, { strictFade: true })
  assert.equal(s.fails.length, 2)
  assert.match(s.fails[0], /떠오르는 설명/)
})

// 영상 프레임(Task 12): 0·2·5초와 포스터를 잰다. VIDEO_AT(t) 는 보이는 영상을 멈추고 그 시각으로 옮겨 보이게 하고(data-playing), 'poster' 는 영상을 숨긴다.
test('VIDEO_AT: seeks visible videos to the time and shows them; poster hides them; invisible videos are skipped', async () => {
  assert.deepEqual(VIDEO_TIMES, [0, 2, 5])
  const mk = (visible) => { const ls = {}, attrs = {}, style = {}; const v = { readyState: 4, duration: 8, currentTime: 0, pause() { this.paused = true }, getClientRects: () => (visible ? [1] : []), addEventListener: (e, fn) => { ls[e] = fn }, setAttribute: (k, x) => { attrs[k] = x }, style: { setProperty: (k, x) => { style[k] = x }, removeProperty: (k) => { delete style[k] } }, attrs, css: style }; return new Proxy(v, { set(o, k, x) { o[k] = x; if (k === 'currentTime') setTimeout(() => ls.seeked?.(), 0); return true } }) }
  const vs = [mk(true), mk(false)]
  const sb = { document: { querySelectorAll: () => vs }, getComputedStyle: (v) => ({ visibility: v.css.visibility ?? 'visible', opacity: 'data-playing' in v.attrs ? '1' : '0' }), requestAnimationFrame: (f) => setTimeout(f, 0), setTimeout }
  const at2 = await runInNewContext(VIDEO_AT(2), sb)
  assert.deepEqual(JSON.parse(JSON.stringify(at2)), [{ t: 2, ready: 4, shown: true }])
  assert.equal(vs[1].currentTime, 0, '보이지 않는 영상은 건드리지 않는다')
  const poster = await runInNewContext(VIDEO_AT('poster'), sb)
  assert.equal(poster[0].shown, false)
})

// 치수 라벨 줄바꿈 관문(Task 14 — r1 B 「3600」이 375 에서 「3 / 60 / 0」으로 잘린 자리).
test('DIM_LABEL_RE: digits/spaces/punctuation with an optional unit is a dimension label; letters are not', () => {
  for (const t of ['3600', '3 600', '12 000 mm', '45°', '100%', '10x20cm', '10 x 20 mm', '1,234.5', '12:34']) assert.match(t, DIM_LABEL_RE, t)
  for (const t of ['SECTION A–A', 'New', '3600건', 'mm']) assert.doesNotMatch(t, DIM_LABEL_RE, t)
})

test('DIM_COLLECT: walks [data-hero] text, skips sr-only/svg, matches the label regex or a [data-dim-label] marker, counts line/column boxes', () => {
  assert.match(DIM_COLLECT, /querySelector\('\[data-hero\]'\)/)
  assert.match(DIM_COLLECT, /closest\('\.sr-only'\)/)
  assert.match(DIM_COLLECT, /closest\('svg'\)/)
  assert.match(DIM_COLLECT, /data-dim-label/)
  assert.match(DIM_COLLECT, /getClientRects/)
  assert.ok(DIM_COLLECT.includes(DIM_LABEL_RE.toString()), '정규식 소스가 그대로 박혔다')
})

// 양성 대조: 줄 상자가 둘 이상이면(줄바꿈·세로쓰기 칸 나뉨) 실패를 낸다 — r1 B 「3600」이 375 에서 두 줄로 잘렸을 때와 같은 모양.
test('dimensionLabelProblems: a wrapped label (rects > 1) fails; a single-line label (rects === 1) does not (positive control)', () => {
  const wrapped = [{ t: '3 600', rects: 2 }, { t: '12 000 mm', rects: 1 }, { t: 'SECTION A–A', rects: 1 }]
  const problems = dimensionLabelProblems(wrapped)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /「3 600」.*2줄/)
  assert.deepEqual(dimensionLabelProblems([{ t: '3 600', rects: 1 }]), [])
  assert.deepEqual(dimensionLabelProblems([]), [])
  assert.deepEqual(dimensionLabelProblems(undefined), [])
  // 세로쓰기(writing-mode: vertical-rl)로 두 칸에 나뉜 라벨도 같은 식으로 잡힌다(칸 = rects).
  assert.equal(dimensionLabelProblems([{ t: '01', rects: 3 }])[0].includes('3줄'), true)
})

// ── Task 16(리뷰 14 #6): 수집기를 실제 CSS 로 — 옛 r1 B 라벨 CSS(nowrap 없음, start 88.8%, 375 폭)가 만드는 진짜 줄바꿈, 마디가 나뉜 라벨, 세로쓰기 한 칸,
//    그리고 억지 줄바꿈 대조(DIM_CONTROL). 옛 수집기(글자 마디마다 잰다)는 나뉜 라벨을 놓친다(음성 대조로 같은 페이지에서 센다). ──
test('dimensionControlProblems: labels of two or more characters must show a forced wrap; none eligible → nothing to judge', () => {
  assert.deepEqual(dimensionControlProblems([{ t: '3 600', rects: 4 }, { t: '12 000 mm', rects: 1 }]), [])
  assert.match(dimensionControlProblems([{ t: '3 600', rects: 1 }], 768)[0], /치수 라벨 대조\(768\).*잡지 못했다/)
  assert.deepEqual(dimensionControlProblems([{ t: '1', rects: 1 }]), [])
  assert.deepEqual(dimensionControlProblems([]), [])
  assert.match(dimensionLabelProblems([{ t: '3 600', rects: 2 }], 768)[0], /\(768\)$/)
})

test('DIM_COLLECT in Chrome: the old r1 B label CSS wraps for real and is caught; a label split across text nodes is caught by its element box (the old per-text-node count misses it); a vertical label in one column and a nowrap label pass; DIM_CONTROL forces and catches a wrap', async () => {
  const PAGE = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0">
    <div data-hero="t" style="position:relative;width:375px;height:420px;font:16px/1.5 sans-serif">
      <p class="old" style="position:absolute;margin:0;inset-inline-start:88.8%;top:40px;letter-spacing:0.2em;padding-inline:0.375rem">3 600</p>
      <p class="split" style="position:absolute;margin:0;left:0;top:120px;width:3ch;font-family:monospace">3 <span>600</span></p>
      <p class="vert" style="position:absolute;margin:0;inset-inline-start:88.8%;top:180px;white-space:nowrap;writing-mode:vertical-rl;text-orientation:upright;letter-spacing:0.2em">3 600</p>
      <p class="ok" style="position:absolute;margin:0;left:10px;top:330px;white-space:nowrap">12 000 mm</p>
      <p class="word" style="position:absolute;margin:0;left:10px;top:370px">SECTION A–A</p>
      <p class="ino" style="position:absolute;margin:0;left:10px;top:395px;white-space:nowrap">접수 <b class="num">2026-0927-114</b></p>
    </div></body></html>`)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'dim-collect-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
    await navigateAndWait(send, ev, PAGE, { timeoutMs: 20000 })
    const rows = await ev(DIM_COLLECT)
    const by = Object.fromEntries(rows.map((r) => [r.t + (r.vertical ? ' (세로)' : ''), r]))
    assert.deepEqual(Object.keys(by).sort(), ['12 000 mm', '2026-0927-114', '3 600', '3 600 (세로)'], JSON.stringify(rows))
    assert.equal(rows.length, 5, JSON.stringify(rows))
    assert.equal(by['2026-0927-114'].rects, 1, '인라인 라벨(부모 글은 라벨이 아니다)')
    const [oldRow, splitRow] = rows.filter((r) => r.t === '3 600' && !r.vertical)
    assert.ok(oldRow.rects > 1, `옛 CSS 라벨이 실제로 줄바꿈되어 잡힌다: ${JSON.stringify(oldRow)}`)
    assert.ok(splitRow.rects > 1, `나뉜 마디 라벨: ${JSON.stringify(splitRow)}`)
    assert.equal(by['3 600 (세로)'].rects, 1, '세로쓰기 한 칸')
    assert.equal(by['12 000 mm'].rects, 1)
    assert.equal(dimensionLabelProblems(rows).length, 2)
    // 음성 대조: 옛 수집기처럼 글자 마디마다 세면 나뉜 라벨의 마디는 하나같이 한 줄이다(「3」·「600」) — 놓친다.
    const perNode = await ev(`(() => { const p = document.querySelector('.split'); return [...p.childNodes].map((n) => { const r = document.createRange(); r.selectNodeContents(n); return [...r.getClientRects()].filter((b) => b.width > 1 && b.height > 1).length }) })()`)
    assert.ok(perNode.every((n) => n <= 1), `마디마다: ${JSON.stringify(perNode)}`)
    // 양성 대조(게이트 안에서 쓰는 것): 줄바꿈 없는 두 라벨도 억지로 줄바꿈시키면 잡는다. 재고 나면 스타일이 돌아온다.
    await ev(`document.querySelector('.old').style.whiteSpace = 'nowrap'; document.querySelector('.split').style.width = 'auto'; 1`)
    assert.equal(dimensionLabelProblems(await ev(DIM_COLLECT)).length, 0, 'nowrap·넓힘 뒤에는 모두 한 줄')
    const ctrl = await ev(DIM_CONTROL)
    assert.deepEqual(dimensionControlProblems(ctrl), [])
    assert.ok(ctrl.filter((r) => r.rects > 1).length >= 4, JSON.stringify(ctrl))
    assert.ok(ctrl.find((r) => r.t === '2026-0927-114').rects > 1, '인라인 라벨도 억지 줄바꿈이 잡힌다(대조가 inline-block 으로 바꾼다 — r6 게이트에서 드러난 빈틈)')
    assert.equal(dimensionLabelProblems(await ev(DIM_COLLECT)).length, 0, '대조가 스타일을 되돌렸다')
    ws.close()
  } finally {
    await chrome.close()
  }
})

// 대장 A(7a-run): 테두리 있는 칩·번호 동그라미의 글자 상자는 테두리 안쪽으로 잘려야 한다 — 글꼴 content area 가 줄 높이보다 커서 테두리 줄에 걸치면
// 테두리 색이 바탕 표본에 섞여 글자 대비가 가짜로 낮게 잰다(4.03·4.77 — r1·r3 의 「오늘」「품절」「활성」).
test('COLLECT in Chrome: a bordered chip with a tight line-height is sampled inside its border (padding box), an unbordered line is untouched', async () => {
  const PAGE = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body style="margin:0">
    <div data-hero="t" style="position:relative;width:375px;height:200px;font:16px/1.5 sans-serif">
      <span id="chip" style="position:absolute;left:20px;top:20px;display:inline-block;border:2px solid #888;padding:0 6px;line-height:1.05">활성</span>
      <span id="plain" style="position:absolute;left:20px;top:80px;display:inline-block;line-height:1.05">활성</span>
    </div></body></html>`)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'hc-border-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await navigateAndWait(send, ev, PAGE, { timeoutMs: 20000 })
    await ev(COLLECT)
    const px = await ev('window.__heroPx')
    const chip = await ev(`(() => { const r = document.getElementById('chip').getBoundingClientRect(); return { top: r.top + 2, bottom: r.bottom - 2, left: r.left + 2, right: r.right - 2 } })()`)
    assert.equal(px.length, 2, JSON.stringify(px))
    const [c, p] = [px.find((x) => x.y < 60), px.find((x) => x.y >= 60)]
    assert.ok(c.y >= chip.top - 0.01 && c.y + c.h <= chip.bottom + 0.01 && c.x >= chip.left - 0.01 && c.x + c.w <= chip.right + 0.01, `칩 글자 상자가 테두리 안쪽: ${JSON.stringify(c)} ⊂ ${JSON.stringify(chip)}`)
    assert.ok(p.h > c.h, `테두리 없는 줄은 글꼴 상자 그대로(잘리지 않는다): ${p.h} > ${c.h}`)
    ws.close()
  } finally { await chrome.close() }
})
