import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs'
import http from 'node:http'
import { tmpdir, homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })
const url = (f) => pathToFileURL(join(here, 'fixtures', f)).href

test('behavior passes the good fixture', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'qa-')), 'b.json')
  assert.equal(await run([join(here, 'behavior.mjs'), url('good.html'), out]), 0)
  const r = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(r.dialogFocus, '취소'); assert.equal(r.enterSendsOrder, false)
  assert.equal(r.toastSeen, true)
  assert.equal(r.toastButtonInTabOrderAfterExpiry, false); assert.equal(r.filterKeepsFocus, true)
})

test('behavior fails the bad fixture on all three defects', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'qa-')), 'b.json')
  assert.equal(await run([join(here, 'behavior.mjs'), url('bad.html'), out]), 3)
  const r = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(r.enterSendsOrder, true); assert.equal(r.toastButtonInTabOrderAfterExpiry, true); assert.equal(r.filterKeepsFocus, false)
})

// "toast never appeared" is a failure in both modes; --strict here only proves
// the strict n/a branch stays quiet when every marker is present. The strict
// branch itself is pinned by the no-markers test below.
test('behavior fails when the toast never appears (strict stays quiet with all markers present)', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'qa-')), 'b.json')
  assert.equal(await run([join(here, 'behavior.mjs'), '--strict', url('toast-never.html'), out]), 3)
  const r = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(r.toastSeen, false)
  assert.ok(r.fail.includes('toast never appeared'))
  // the dialog and filter markers on this fixture are wired correctly, so
  // --strict must not also complain about them — only the real defect.
  assert.ok(!r.fail.some((f) => f.includes('--strict:')))
})

test('behavior --strict turns missing markers (n/a) into failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-'))
  const loose = join(dir, 'loose.json'), strict = join(dir, 'strict.json')
  // sequential: behavior.mjs picks a random debug port, two at once could collide
  const looseCode = await run([join(here, 'behavior.mjs'), url('no-markers.html'), loose])
  const strictCode = await run([join(here, 'behavior.mjs'), '--strict', url('no-markers.html'), strict])
  assert.equal(looseCode, 0)
  assert.equal(strictCode, 3)
  const l = JSON.parse(readFileSync(loose, 'utf8'))
  const s = JSON.parse(readFileSync(strict, 'utf8'))
  for (const r of [l, s]) {
    assert.equal(r.dialogFocus, 'n/a'); assert.equal(r.toastSeen, 'n/a'); assert.equal(r.filterKeepsFocus, 'n/a')
  }
  assert.deepEqual(l.fail, [])
  assert.deepEqual(s.fail, [
    '--strict: no [data-qa=confirm-open] on the page',
    '--strict: no [data-qa=toast-trigger] on the page',
    '--strict: fewer than two [data-qa=filter] items on the page',
  ])
})

test('ux-gate skips visually-hidden text but still catches real clipping', async () => {
  const outGood = mkdtempSync(join(tmpdir(), 'qa-'))
  const outBad = mkdtempSync(join(tmpdir(), 'qa-'))
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('good.html'), outGood]), 0)
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('bad.html'), outBad]), 3)
  const badGate = JSON.parse(readFileSync(join(outBad, 'ux_gate.json'), 'utf8'))
  assert.ok(badGate.fail.some((f) => f.includes('clipped text')))
})

test('ux-gate fails low-contrast body text in a leaf div', async () => {
  const out = mkdtempSync(join(tmpdir(), 'qa-'))
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('low-contrast.html'), out]), 3)
  const g = JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8'))
  assert.ok(g.fail.some((f) => f.includes('body blocks < 7:1')), g.fail.join(' | '))
  for (const row of Object.values(g.gate)) assert.ok(row.bodyBelow7 >= 1 && row.bodyChecked >= 1)
})

// C257: H2 떠 있는 섬(r5-celadon)은 헤더가 static 이고 안쪽 줄만 fixed 라 「내비 자신이 붙었나」만 보던 식이 모든 쪽을 떨어뜨렸다.
// 내비가 fixed/sticky 상자 안에 있고 스크롤 뒤에도 화면 안이면 통과한다. 음성 대조 둘은 내비가 정말 사라지는 쪽 — 이 규칙만 실패해야 한다.
test('C257: ux-gate accepts a nav inside a fixed island, still fails a nav that scrolls away (negative controls)', async () => {
  const gateOf = async (fixture) => {
    const out = mkdtempSync(join(tmpdir(), 'qa-'))
    const code = await run([join(here, 'ux-gate.mjs'), url(fixture), out])
    return { code, g: JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8')) }
  }
  const island = await gateOf('nav-island.html')
  assert.equal(island.code, 0, island.g.fail.join(' | '))
  for (const row of Object.values(island.g.gate)) assert.equal(row.persistentNav, true)
  for (const f of ['nav-scrolls-away.html', 'nav-fixed-sibling.html']) {
    const { code, g } = await gateOf(f)
    assert.equal(code, 3, f)
    assert.deepEqual(g.fail.map((x) => x.replace(/^[^:]+: /, '')), Array(4).fill('nav not persistent after scroll'), `${f}: 이 규칙만 실패해야 한다 — ${g.fail.join(' | ')}`)
  }
})

test('ux-gate fails when no body text was measured at all', async () => {
  const out = mkdtempSync(join(tmpdir(), 'qa-'))
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('no-body.html'), out]), 3)
  const g = JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8'))
  assert.ok(g.fail.some((f) => f.includes('bodyChecked 0')), g.fail.join(' | '))
})

// 히트 영역 식(Task 4): 같은 버튼을 높이 24·32·36·44·48 로 그려 ::after 의 계산 스타일 top/bottom 을 읽는다.
// CSS 는 이 저장소의 Tailwind 로 fixture 클래스를 실제로 빌드한다(식이 CSS 로 바르게 풀리는지까지 확인).
test('hit-area formula: every height reaches 44px, 44px and taller get no expansion, the old numeric inset does not', async () => {
  const { default: postcss } = await import('postcss')
  const { default: tailwind } = await import('@tailwindcss/postcss')
  const dir = mkdtempSync(join(tmpdir(), 'hit-'))
  writeFileSync(join(dir, 'hit-area-styles.html'), readFileSync(join(here, 'fixtures', 'hit-area-styles.html')))
  // tailwindcss 는 저장소 node_modules 에서 찾으므로 from 은 이 폴더, @source 는 임시 폴더의 사본(절대 경로).
  const src = join(dir, 'hit-area-styles.html').split('\\').join('/')
  const css = await postcss([tailwind({ base: here })]).process(`@import "tailwindcss" source(none);\n@source "${src}";`, { from: join(here, 'hit-area.css') })
  writeFileSync(join(dir, 'hit-area-styles.css'), css.css)
  const out = join(dir, 'hit.json')
  assert.equal(await run([join(here, 'hit-area.mjs'), pathToFileURL(join(dir, 'hit-area-styles.html')).href, out]), 1) // 음성 대조군 1개 때문에 1
  const { rows, fail } = JSON.parse(readFileSync(out, 'utf8'))
  const by = Object.fromEntries(rows.map((r) => [r.label, r]))
  const expectTop = { 24: '-10px', 32: '-6px', 36: '-4px', 44: '0px', 48: '0px', '24 테두리': '-11px' }
  for (const [label, top] of Object.entries(expectTop)) {
    const r = by[label]
    assert.ok(r, `row ${label}`)
    assert.equal(r.pseudo?.top, top, `${label}: ::after top`)
    assert.equal(r.pseudo?.bottom, top, `${label}: ::after bottom`)
    assert.ok(r.h >= 44 && r.w >= 44, `${label}: ${r.w}x${r.h}`)
  }
  assert.equal(by['48'].h, 48) // 44px 보다 크면 확장 0 — 히트 영역 = 버튼
  assert.equal(by['옛 식'].h, 34) // 24 + 5 + 5
  assert.equal(fail.length, 1)
  assert.ok(fail[0].includes('옛 식') && fail[0].endsWith('x34'), fail[0])
})

// 예외는 슬롯만이 아니라 맥락으로 건다(리뷰 1회차): 묶음 밖 radio · Button 으로 그린 트리거는 예외가 아니다.
// 잘라내는 조상(overflow:hidden)이 자른 ::after 는 히트가 아니고, label 안의 컨트롤은 label 과 합쳐 잰다.
test('hit-area: exceptions are keyed by context, clipped expansion does not count, a label extends its control', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'hitc-')), 'hit.json')
  assert.equal(await run([join(here, 'hit-area.mjs'), url('hit-area-context.html'), out]), 1)
  const { rows, fail } = JSON.parse(readFileSync(out, 'utf8'))
  const by = Object.fromEntries(rows.map((r) => [r.label, r]))
  assert.equal(by['묶음 안 라디오'].exception, 'radio-in-group')
  assert.equal(by['혼자 라디오'].exception, null)
  assert.equal(by['버튼 트리거'].exception, null)
  assert.equal(by['링크 트리거'].exception, 'consumer-triggers')
  assert.equal(by['잘린 식'].h, 24) // overflow:hidden 이 -10px 확장을 자른다
  assert.equal(by['안 잘린 식'].h, 44)
  assert.equal(by['선택지'].h, 44) // 투명 input(24) ∪ label ∪ label::after
  assert.equal(by['스크롤 칸 가장자리'].h, 44) // 스크롤 칸의 보이는 끝이 확장을 자르지만 스크롤하면 닿는다 — 스크롤해 들인 뒤 잰다(C374)
  assert.deepEqual(rows.filter((r) => !r.pass).map((r) => r.label).sort(), ['버튼 트리거', '잘린 식', '혼자 라디오'].sort())
  assert.equal(fail.length, 3)
})

// 리뷰 I2: 모든 CDP 도구가 cdp.mjs session 의 호출 기한을 쓴다. 답이 없는 호출은 호출 이름을 적고 실패한다(매달리지 않는다).
test('cdp session: a call with no reply fails after the deadline and names the call (fake socket and a real stalled evaluate)', async () => {
  const { session, connect, startChrome } = await import('./cdp.mjs')
  const { send } = session({ send() {} }, { timeoutMs: 200 })
  await assert.rejects(send('Page.navigate', { url: 'about:blank' }), /CDP Page\.navigate 가 0\.2초 안에 답하지 않았다/)
  const chrome = await startChrome([], { prefix: 'sess-' })
  try {
    const { ws, ev } = await connect(chrome.wsUrl, { timeoutMs: 1500 })
    assert.equal(await ev('1 + 1'), 2)
    await assert.rejects(ev('new Promise(() => {})'), /CDP Runtime\.evaluate 가 1\.5초 안에 답하지 않았다/)
    ws.close()
  } finally { await chrome.close() }
  // 일곱 도구 모두 session(connect)을 쓰고, 손으로 짠 기한 없는 send 가 남지 않았다
  for (const f of ['ux-gate', 'behavior', 'axes-measure', 'hit-area', 'shell-focus', 'ai-tell', 'a11y-gate']) {
    const src = readFileSync(join(here, `${f}.mjs`), 'utf8')
    assert.match(src, /await connect\(chrome\.wsUrl/, f)
    assert.doesNotMatch(src, /new WebSocket\(/, f)
    assert.doesNotMatch(src, /send\('Page\.navigate'/, f)
  }
})

// Task 13a 항목 4: 옆 타깃의 ::after 가 이 타깃의 보이는 자리를 가져가는 겹침. 합집합 상자로는 못 보던 것.
test('hit-area overlaps: a neighbour expansion taking a visible edge fails, the group rule removes it, a 4px toggle row is not accepted', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'hito-')), 'hit.json')
  assert.equal(await run([join(here, 'hit-area.mjs'), url('hit-area-overlap.html'), out]), 1)
  const { overlaps, fail, pointer, rows } = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(pointer, 'fine')
  const pairs = overlaps.map((o) => `${o.thiefLabel}>${o.victimLabel}:${o.exception ?? 'FAIL'}`).sort()
  // 묶음 규칙 없는 세로 쌓기와 간격 4px 토글 줄(8px MUST 아래)은 실패, 묶음 규칙이 있는 세로 ButtonGroup 두 개는 0
  assert.deepEqual(pairs, ['아래 예시>위 예시:FAIL', '토글 나 예시>토글 가 예시:FAIL'])
  // (pointer: fine) 에서 세로 묶음 항목은 fine 전용 예외로 24 이상 통과
  for (const r of rows.filter((x) => /묶음/.test(x.label))) assert.equal(r.exception, 'grouped-vertical', r.label)
  assert.deepEqual(fail.filter((f) => !f.startsWith('겹침')), [])
})

// C370(G1): shadcn BreadcrumbPage 의 현재 쪽 표식은 눌리지 않아 겹침의 한쪽이 못 된다. 표식이 없는 같은 모양은 그대로 겹침 실패(음성 대조).
test('hit-area overlaps: a current-page marker (aria-current=page + aria-disabled=true) is not an overlap party, the same span without aria-current still is', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'hitc-')), 'hit.json')
  await run([join(here, 'hit-area.mjs'), url('hit-area-current-page.html'), out])
  const { overlaps } = JSON.parse(readFileSync(out, 'utf8'))
  const pairs = overlaps.map((o) => `${o.thiefLabel}>${o.victimLabel}:${o.exception ?? 'FAIL'}`).sort()
  assert.equal(pairs.length, 1, pairs.join(' | '))
  assert.match(pairs[0], /가/)
  assert.doesNotMatch(pairs.join('|'), /나/)
})

// Fix round 2: 도구 실패(탐색 실패·CDP 기한 초과)는 다른 CDP 도구처럼 종료 1 — 「도구 실패:」를 적고 out.json 을 남기지 않는다.
test('hit-area tool failure exits 1, says 도구 실패 and leaves no (stale) out.json; measured failures keep out.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hitf-'))
  const out = join(dir, 'hit.json')
  writeFileSync(out, '{"stale":true}')
  const res = await new Promise((resolve) => {
    const p = spawn(process.execPath, [join(here, 'hit-area.mjs'), 'http://127.0.0.1:9/', out], { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('exit', (code) => resolve({ code, err }))
  })
  assert.equal(res.code, 1, res.err)
  assert.match(res.err, /도구 실패: 탐색 실패\(net::ERR_/)
  assert.equal(existsSync(out), false)
})

// 리뷰 I1(DESIGN §7:274): 묶음 안 타깃은 (pointer: coarse) 에서 44. coarse 에서는 fine 전용 예외가 빠진다.
test('hit-area --pointer coarse: grouped targets must reach 44 — the touch floor passes, a group without it fails', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'hitp-')), 'hit.json')
  assert.equal(await run([join(here, 'hit-area.mjs'), url('hit-area-overlap.html'), out, '--pointer', 'coarse']), 1)
  const { pointer, rows, fail } = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(pointer, 'coarse')
  const by = Object.fromEntries(rows.map((r) => [r.label, r]))
  for (const l of ['묶음 위 예시', '묶음 아래 예시']) { assert.equal(by[l].exception, null, l); assert.equal(by[l].h, 44, l); assert.equal(by[l].pass, true, l) }
  for (const l of ['바닥 없는 위 예시', '바닥 없는 아래 예시']) { assert.equal(by[l].exception, null, l); assert.equal(by[l].pass, false, l) }
  const sizeFails = fail.filter((f) => !f.startsWith('겹침'))
  assert.equal(sizeFails.length, 2, sizeFails.join(' | '))
  assert.ok(sizeFails.every((f) => f.includes('바닥 없는')), sizeFails.join(' | '))
  assert.equal(await run([join(here, 'hit-area.mjs'), url('hit-area-overlap.html'), out, '--pointer', 'thumb']), 2)
})

// Task 13a 항목 12c: axes-measure.mjs 의 판정을 fixture 로 고정한다(명세 수치를 지키는 쪽 0, 검사마다 결함 하나인 쪽 1).
test('axes-measure: the good fixture passes all four views, the bad one names each defect', async () => {
  const tool = join(here, 'axes-measure.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'axm-'))
  assert.equal(await run([tool]), 2)
  assert.equal(await run([tool, url('axes-good.html'), join(dir, 'good.json')]), 0)
  const good = JSON.parse(readFileSync(join(dir, 'good.json'), 'utf8'))
  assert.deepEqual(Object.keys(good).sort(), ['1440-dark', '1440-light', '375-dark', '375-light'])
  for (const v of Object.values(good)) assert.deepEqual(v.fail, [])
  assert.equal(await run([tool, url('axes-bad.html'), join(dir, 'bad.json')]), 1)
  const bad = JSON.parse(readFileSync(join(dir, 'bad.json'), 'utf8'))['1440-light'].fail
  for (const want of ['T2: 행 44px (명세 48~49)', 'T3: 행 없음', 'H4 레일 폭 200px (명세 240)', 'H4 메뉴 줄 36px (명세 40)', '흐르는 요소에 블러: flow-panel blur(8px)', '행간 card-description 1.4'])
    assert.ok(bad.includes(want), `${want} 없음: ${bad.join(' | ')}`)
  // 바탕 알파는 캔버스 8비트로 읽어 0.50196… 이다
  assert.ok(bad.some((f) => /^C5 카드: backdrop none · 바탕 알파 0\.5\d*$/.test(f)), bad.join(' | '))
  // Task 16a 새 칸(A22): 검사마다 결함 하나 — 이름으로 짚고, 건수는 옛 7건 + 새 14건 = 21
  for (const want of ['R3 아바타 블롭 아님: 50% 50% 50% 50%', 'D1 제목 30px < 36', 'D2 8vw (명세 10~20vw)', 'D3 움직임 없음: none', 'X0 무늬가 있다: block/none', '문서가 가로로 160px 넘친다'])
    assert.ok(bad.includes(want), `${want} 없음: ${bad.join(' | ')}`)
  for (const re of [/^C6 카드: \{"border":1,/, /^C8 카드: \{"border":2,/, /^R3 컨트롤이 R1 과 다르다: /, /^D1 제목이 칸을 넘는다\(잘림 \d+px\)$/, /^X1 그레인: \{"id":"X1","before":"block","opacity":0\.2,/, /^X2 망점: \{"id":"X2","before":"block","opacity":0\.2,/, /^X3 콜라주: \{"id":"X3",/, /^K9 예시 대비: \{"body":[\d.]+,"muted":2\.85\}$/])
    assert.ok(bad.some((f) => re.test(f)), `${re} 없음: ${bad.join(' | ')}`)
  // P3-6 질감: bad fixture 의 의도된 가로 넘침(160px)을 새 질감 칸 관문(texture-contrast)도 한 번 더 센다 — 21 + 1 = 22
  assert.ok(bad.includes('질감 칸 문서가 가로로 160px 넘친다'), bad.join(' | '))
  assert.equal(bad.length, 22, bad.join(' | '))
})

// 예외 목록의 유일한 원천(hit-area-exceptions.json)과 문서 표가 같아야 한다.
test('exceptions doc table is generated from hit-area-exceptions.json and they agree', async () => {
  const { renderTable, docBlock, loadExceptions, DOC_PATH } = await import('./exceptions-doc.mjs')
  const data = loadExceptions()
  const doc = readFileSync(DOC_PATH, 'utf8')
  assert.equal(docBlock(doc)?.replaceAll('\r\n', '\n'), renderTable(data))
  assert.equal(await run([join(here, 'exceptions-doc.mjs'), '--check']), 0)
  // 음성 대조: JSON 을 바꾸면(항목 하나 빼기) 문서 표와 달라진다
  assert.notEqual(docBlock(doc)?.replaceAll('\r\n', '\n'), renderTable({ ...data, exceptions: data.exceptions.slice(1) }))
  // hit-area.mjs 는 같은 JSON 을 읽는다(따로 가진 목록 없음)
  const { EXCEPTIONS } = await import('./hit-area.mjs')
  assert.deepEqual(EXCEPTIONS, data)
})

// audit.js (web-design-canon skill, outside this repo) unions a small control's
// own pseudo-element hit area (and, only when the control itself is visually
// hidden, its positioned parent's) when checking target size, and skips a
// framework's aria-hidden form-mirror input when checking field labels — but
// must not be fooled by a decorative parent pseudo (pointer-events:none) or a
// CSS tooltip bubble parked entirely outside the element (whatever its
// opacity or paint; geometry measured from the padding box) into rescuing a
// real small target, and must not excuse an unlabeled input just because it's
// clip-hidden if it's still keyboard-reachable. Pinned here since a
// regression in that shared script would otherwise only show up on
// /qa/base's full audit.
const AUDIT_RUN = join(homedir(), '.claude', 'skills', 'web-design-canon', 'scripts', 'audit_run.mjs')

// Portable: this test needs the owner's external checker; skip with a message when it isn't installed.
const auditSkip = existsSync(AUDIT_RUN) ? false : `external audit_run.mjs not found at ${AUDIT_RUN} (web-design-canon skill) — skipped`

test('audit.js skips the pseudo-hit-area checkbox and hidden form mirror, still catches real defects', { skip: auditSkip }, async () => {
  const outGood = join(mkdtempSync(join(tmpdir(), 'qa-')), 'good.json')
  const outBad = join(mkdtempSync(join(tmpdir(), 'qa-')), 'bad.json')
  assert.equal(await run([AUDIT_RUN, url('audit-good.html'), '--json', outGood]), 0)
  assert.equal(await run([AUDIT_RUN, url('audit-bad.html'), '--json', outBad]), 1)

  // audit-good.html: the content-box 16px checkbox (padding box 16) with an
  // inset:-14px ::after measures 44 and passes outright; the border-box 16px
  // one with a 1px border (padding box 14) measures exactly 42x42 — the
  // pseudo resolves against the padding box, not the border box — so it
  // clears 24 but lands in the targetsUnder44 warning, not the pass bucket.
  // The visually-hidden range input inside the positioned .thumb wrapper is
  // rescued by the parent scan (44x44), so it appears in neither list.
  const good = JSON.parse(readFileSync(outGood, 'utf8'))
  for (const row of good) {
    assert.equal(row.fail.targetsUnder24, 0)
    assert.equal(row.fail.unlabeledFields, 0)
    assert.equal(row.warn.targetsUnder44, 1)
    assert.deepEqual(row.samples.targetsUnder44, ['42 체크박스 42x42'])
    assert.ok(!row.samples.targetsUnder24.some((s) => s.includes('부모 확장 음량')), 'parent-scan input must pass 24')
  }

  // audit-bad.html carries one labelled case per defect: a button inside a
  // parent with a decorative pointer-events:none ::before (p1), a button
  // with its own CSS-tooltip ::after that sits outside it (p2), a bordered
  // button whose painted, clickable tooltip ::after sits entirely above it
  // (p4), a plain 16px checkbox with no pseudo at all, a clip-hidden but
  // keyboard-reachable unlabeled input, and a sr-only tabindex=-1 unlabeled
  // input (p3). Every one of them must be counted by name, not just ">0" —
  // a broad regression that still flags *something* must not pass this.
  const bad = JSON.parse(readFileSync(outBad, 'utf8'))
  for (const row of bad) {
    assert.equal(row.fail.targetsUnder24, 5)
    assert.ok(row.samples.targetsUnder24.some((s) => s.includes('p1 부모 장식')), 'p1 decorative parent pseudo must still count as under 24')
    assert.ok(row.samples.targetsUnder24.some((s) => s.includes('p2 툴팁')), 'p2 tooltip pseudo must still count as under 24')
    assert.ok(row.samples.targetsUnder24.includes('p4 칠한 툴팁 16x16'), 'p4 painted tooltip outside the bordered button must not rescue it')
    assert.ok(row.samples.targetsUnder24.some((s) => s.includes('일반 체크박스')), 'the plain checkbox with no pseudo must still count as under 24')
    assert.ok(row.samples.targetsUnder24.some((s) => s.startsWith('INPUT')), 'the clip-hidden but focusable input must still count as under 24')

    assert.equal(row.fail.unlabeledFields, 2)
    assert.ok(row.samples.unlabeledFields.some((s) => s.includes('id="p3-sr-input"')), 'p3 sr-only tabindex=-1 input must still count as unlabeled')
    assert.ok(row.samples.unlabeledFields.some((s) => s.includes('id="clip-hidden-focusable"')), 'the clip-hidden but focusable input must still count as unlabeled')
  }
})

// C123: 열리지 않는 쪽(Chrome 오류 페이지·HTTP 4xx)은 판정 실패(3)가 아니라 도구 실패다 — ux-gate·behavior·run.mjs 모두 종료 1 + 「도구 실패:」 + 결과 파일 없음(이전 파일도 지운다).
test('C123: ux-gate, behavior and run.mjs treat an unreachable page as a tool failure (exit 1, 도구 실패, stale result files removed), not a judgement (3)', async () => {
  const spawnErr = (args) => new Promise((resolve) => {
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('exit', (code) => resolve({ code, err }))
  })
  const dead = 'http://127.0.0.1:9/'
  const dir = mkdtempSync(join(tmpdir(), 'c123-'))
  const stale = (f) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, '{"stale":true}') }
  stale(join(dir, 'g', 'ux_gate.json'))
  let r = await spawnErr([join(here, 'ux-gate.mjs'), dead, join(dir, 'g')])
  assert.equal(r.code, 1, r.err); assert.match(r.err, /도구 실패: 탐색 실패\(net::ERR_/); assert.equal(existsSync(join(dir, 'g', 'ux_gate.json')), false)
  stale(join(dir, 'b.json'))
  r = await spawnErr([join(here, 'behavior.mjs'), dead, join(dir, 'b.json')])
  assert.equal(r.code, 1, r.err); assert.match(r.err, /도구 실패: 탐색 실패\(net::ERR_/); assert.equal(existsSync(join(dir, 'b.json')), false)
  stale(join(dir, 'run', 'report.json'))
  r = await spawnErr([join(here, 'run.mjs'), dead, join(dir, 'run')])
  assert.equal(r.code, 1, r.err); assert.match(r.err, /도구 실패: ux-gate 종료 1 · behavior 종료 1/); assert.equal(existsSync(join(dir, 'run', 'report.json')), false)
  // HTTP 404 도 같다
  const srv = http.createServer((_, res) => { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>x</title><p>없음</p>') })
  await new Promise((res) => srv.listen(0, '127.0.0.1', res))
  try {
    r = await spawnErr([join(here, 'ux-gate.mjs'), `http://127.0.0.1:${srv.address().port}/x`, join(dir, 'g404')])
    assert.equal(r.code, 1, r.err); assert.match(r.err, /도구 실패: HTTP 404/)
  } finally { srv.close() }
  // 좋은 쪽은 그대로 0(회귀)
  assert.equal(await run([join(here, 'run.mjs'), url('good.html'), join(dir, 'ok')]), 0)
})

// 대장 A(7a-run): 가로 스크롤 칸 밖으로 삐져나가 옆 버튼 밑에 깔린 링크 부분은 눌리지 않는다 — 그 점을 「이웃이 빼앗았다」고 세면 거짓 겹침이다(375 nav-inline-links).
test('hit-area overlaps: points of a link outside its clipping scroller are not counted (no false overlap); an unclipped overlap still fails', async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'hitc-')), 'hit.json')
  const code = await run([join(here, 'hit-area.mjs'), url('hit-area-clipped.html'), out])
  const { overlaps, fail } = JSON.parse(readFileSync(out, 'utf8'))
  assert.deepEqual(overlaps.filter((o) => o.victimLabel.includes('링크')), [], JSON.stringify(overlaps))
  assert.deepEqual(fail.filter((f) => f.startsWith('겹침')), [], fail.join(' | '))
  assert.equal(code, 0, fail.join(' | '))
})

// 대장 A(7a-run): 글자 뒤 바탕을 조상 칠에서만 읽으면 형제 층(뒤에 깔린 색면)이 칠한 바탕 위 글자가 흰 바탕으로 읽혀 1.01 로 잡힌다(hero crop-marks-typed-title r6 — 교정지 면).
test('ux-gate reads a painted sibling layer under the text (no false 1:1), while a really low pair still fails', async () => {
  const out = mkdtempSync(join(tmpdir(), 'qa-'))
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('sibling-bg.html'), out]), 0)
  const g = JSON.parse(readFileSync(join(out, 'ux_gate.json'), 'utf8'))
  assert.ok(!g.fail.some((f) => f.includes('body blocks')), g.fail.join(' | '))
  const out2 = mkdtempSync(join(tmpdir(), 'qa-'))
  assert.equal(await run([join(here, 'ux-gate.mjs'), url('low-contrast.html'), out2]), 3, '음성 대조: 정말 낮은 짝은 여전히 실패')
})
