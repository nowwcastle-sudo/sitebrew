// 접근성 행렬 관문 시험(P3-4 Task 3). 실행: node --test --test-force-exit --test-timeout=400000 factory/qa/a11y-gate.test.mjs (Chrome 를 쓴다 — 관문 잠금 안에서, 다른 Chrome 시험과 직렬로)
// 음성 대조: 규칙마다 그 규칙만 깨는 픽스처(fixtures/a11y/) — 다크에서만 깨지는 대비 · 강제 색에서만 깨지는 대비 · 고정 바닥이 가리는 초점 · 붙여넣기를 막는 비밀번호 ·
// autocomplete off · 글자 캡차 · 앞 값을 다시 묻는 폼 · 20px 대상 · 열리지 않는 주소(도구 실패).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BEHAVIOR_IDS, FAIL_IMPACTS, KWCAG, MODES, RULE_TAGS, ToolFailure, a11yGate, a11yGateForCandidate, featuresFor, openSession, judgeA11y, kwcagFor, mergeBehavior } from './a11y-gate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (name) => pathToFileURL(join(here, 'fixtures', 'a11y', `${name}.html`)).href
const cli = (args) => new Promise((res) => {
  const p = spawn(process.execPath, [join(here, 'a11y-gate.mjs'), ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
  let err = ''
  p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => res({ code, err }))
})

// ── 순수(브라우저 없음) ─────────────────────────────────────────────────────

test('rule set = wcag2a·wcag2aa·wcag21aa·wcag22aa, and axe 4.13 ships target-size in wcag22aa', () => {
  assert.deepEqual(RULE_TAGS, ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  const axe = createRequire(import.meta.url)('axe-core')
  assert.deepEqual(axe.getRules(['wcag22aa']).map((r) => r.ruleId), ['target-size'])
})

test('KWCAG map: every axe rule of the tag set is mapped or explained, every mapped item exists, behaviors carry WCAG 2.2 + KWCAG ids', () => {
  const axe = createRequire(import.meta.url)('axe-core')
  const ids = axe.getRules(RULE_TAGS).map((r) => r.ruleId)
  const missing = ids.filter((id) => !(id in KWCAG.axe) && !(id in KWCAG.unmapped))
  assert.deepEqual(missing, [], `axe 규칙이 kwcag-map.json 에 없다(axe 를 올렸다면 표를 고친다): ${missing}`)
  for (const [rule, item] of Object.entries(KWCAG.axe)) assert.ok(KWCAG.items[item], `${rule} → ${item} 은 items 에 없다`)
  assert.equal(Object.keys(KWCAG.items).every((k) => /^[5-8]\.\d\.\d$/.test(k)), true)
  assert.deepEqual(kwcagFor('color-contrast'), { kwcag: '5.4.3', item: '텍스트 콘텐츠의 명도 대비' })
  assert.deepEqual(kwcagFor('meta-viewport'), { kwcag: null, item: null })
  assert.deepEqual(Object.keys(KWCAG.behaviors).sort(), [...BEHAVIOR_IDS].sort())
  assert.deepEqual(BEHAVIOR_IDS.map((b) => KWCAG.behaviors[b].wcag), ['2.4.11', '3.3.7', '3.3.8', '2.5.8'])
})

test('judgeA11y: critical·serious fail, moderate·minor only warn, behavior fail fails, required na fails, optional na does not', () => {
  assert.deepEqual([...FAIL_IMPACTS].sort(), ['critical', 'serious'])
  const v = (rule, impact) => ({ rule, impact, mode: 'dark', width: 375, nodes: [{}] })
  const r = judgeA11y({ violations: [v('a', 'critical'), v('b', 'serious'), v('c', 'moderate'), v('d', 'minor')], behaviors: [] })
  assert.equal(r.failures.length, 2)
  assert.equal(r.warnings.length, 2)
  const b = judgeA11y({ violations: [], behaviors: [{ id: 'authentication', status: 'na' }, { id: 'target-size', status: 'pass', detail: { warn: ['x'] } }] })
  assert.deepEqual(b.failures, [])
  assert.equal(b.warnings.length, 1)
  const req = judgeA11y({ violations: [], behaviors: [{ id: 'authentication', status: 'na' }] }, { require: ['authentication'] })
  assert.match(req.failures[0], /na\).*통과가 아니다/)
  assert.match(judgeA11y({ violations: [], behaviors: [{ id: 'focus-not-obscured', status: 'fail', detail: { fail: ['가림'] } }] }).failures[0], /focus-not-obscured: 가림/)
})

test('mergeBehavior: any fail → fail; else any pass → pass; else na', () => {
  assert.equal(mergeBehavior('target-size', { 1440: { status: 'pass' }, 375: { status: 'fail', fail: ['x'] } }).status, 'fail')
  assert.equal(mergeBehavior('target-size', { 1440: { status: 'na' }, 375: { status: 'pass' } }).status, 'pass')
  assert.equal(mergeBehavior('target-size', { 1440: { status: 'na' }, 375: { status: 'na' } }).status, 'na')
  assert.deepEqual([mergeBehavior('redundant-entry', {}).wcag, mergeBehavior('redundant-entry', {}).kwcag], ['3.3.7', '7.3.4'])
})

test('featuresFor: forced-colors mode sets forced-colors active, dark sets prefers-color-scheme dark, reduced motion is always on', () => {
  assert.deepEqual(MODES, ['light', 'dark', 'forced-colors'])
  const get = (mode, name) => featuresFor(mode).find((f) => f.name === name).value
  assert.equal(get('forced-colors', 'forced-colors'), 'active')
  assert.equal(get('light', 'forced-colors'), 'none')
  assert.equal(get('dark', 'prefers-color-scheme'), 'dark')
  assert.equal(get('forced-colors', 'prefers-color-scheme'), 'light')
  for (const m of MODES) assert.equal(get(m, 'prefers-reduced-motion'), 'reduce')
  assert.throws(() => featuresFor('sepia'), /모르는 모드/)
})

test('a11yGateForCandidate: gate record shape (id a11y, exit, resultFile, toolFailure) — pass / fail / tool failure per route (fake tool)', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'a11y-cand-'))
  const cand = { id: 'a' }
  const fake = (plan) => async (args) => {
    const url = args[0], out = args[args.indexOf('--out') + 1]
    const p = plan[new URL(url).pathname]
    mkdirSync(out, { recursive: true })
    if (p.file) writeFileSync(join(out, 'a11y-gate.json'), JSON.stringify(p.file))
    return { exit: p.exit, stderr: p.stderr ?? '' }
  }
  const ok = { failures: [], warnings: [], summary: { cells: 6 } }
  const bad = { failures: ['axe color-contrast(serious) dark·375px 1곳'], warnings: [], summary: { cells: 6 } }
  // 통과
  let g = await a11yGateForCandidate(runDir, cand, { origin: 'http://x', routes: ['/', '/pricing'], runTool: fake({ '/': { exit: 0, file: ok }, '/pricing': { exit: 0, file: ok } }) })
  assert.equal(g.id, 'a11y'); assert.equal(g.exit, 0); assert.equal(g.toolFailure, false); assert.equal(g.verdict, 'pass')
  assert.equal(g.resultFile, '07-qa/a11y/a11y-gate.json')
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(runDir, 'a', g.resultFile), 'utf8')).routes), ['/', '/pricing'])
  // 판정 실패(결과 파일 있음)
  g = await a11yGateForCandidate(runDir, cand, { origin: 'http://x', routes: ['/', '/pricing'], runTool: fake({ '/': { exit: 0, file: ok }, '/pricing': { exit: 1, file: bad } }) })
  assert.equal(g.exit, 1); assert.equal(g.toolFailure, false); assert.equal(g.verdict, 'fail'); assert.match(g.note, /\/pricing\(1건\)/)
  assert.ok(g.resultFile)
  // 도구 실패(쪽 하나라도): 결과 파일을 남기지 않고 이전 파일도 지운다
  g = await a11yGateForCandidate(runDir, cand, { origin: 'http://x', routes: ['/', '/pricing'], runTool: fake({ '/': { exit: 0, file: ok }, '/pricing': { exit: 1, stderr: '도구 실패: 탐색 실패(net::ERR_CONNECTION_REFUSED)' } }) })
  assert.equal(g.exit, 1); assert.equal(g.toolFailure, true); assert.equal(g.verdict, 'tool'); assert.equal(g.resultFile, undefined)
  assert.match(g.note, /ERR_CONNECTION_REFUSED/)
  assert.equal(existsSync(join(runDir, 'a', '07-qa', 'a11y', 'a11y-gate.json')), false)
  // 종료 0 인데 결과 파일이 없으면 통과가 아니라 도구 실패
  g = await a11yGateForCandidate(runDir, cand, { origin: 'http://x', routes: ['/'], runTool: fake({ '/': { exit: 0 } }) })
  assert.equal(g.toolFailure, true); assert.match(g.note, /결과 파일이 없다/)
  await assert.rejects(a11yGateForCandidate(runDir, cand, { origin: 'http://x', routes: [] }), /routes/)
})

test('CLI: arg errors exit 2', async () => {
  assert.equal((await cli([])).code, 2)
  assert.equal((await cli(['http://127.0.0.1:1/', '--modes', 'sepia'])).code, 2)
  assert.equal((await cli(['http://127.0.0.1:1/', '--require', 'nope'])).code, 2)
})

// ── 브라우저(Chrome 하나, 세션 공유) ─────────────────────────────────────────

let session = null // Chrome 는 브라우저 시험이 처음 부를 때 연다(순수 시험만 돌릴 때는 안 뜬다)
const ses = async () => (session ??= await openSession())
after(async () => { await session?.close() })

const gate = async (name, opts = {}) => a11yGate(fx(name), { session: await ses(), sceneWait: false, ...opts })
const only = (r, re) => assert.ok(r.failures.length > 0 && r.failures.every((f) => re.test(f)), `이 규칙만 실패해야 한다 ${re}: ${JSON.stringify(r.failures)}`)

test('emulation really applies: matchMedia reads dark and forced-colors in the page for each mode', async () => {
  const session = await ses()
  await session.send('Page.navigate', { url: fx('good') })
  await new Promise((r) => setTimeout(r, 600))
  for (const mode of MODES) {
    await session.send('Emulation.setEmulatedMedia', { features: featuresFor(mode) })
    const got = await session.ev(`[matchMedia('(prefers-color-scheme: dark)').matches, matchMedia('(forced-colors: active)').matches]`)
    assert.deepEqual(got, [mode === 'dark', mode === 'forced-colors'], mode)
  }
  await session.send('Emulation.setEmulatedMedia', { features: featuresFor('light') })
})

test('good page: 6 cells, 0 failures, all four WCAG 2.2 behaviors measured and passing', async () => {
  const r = await gate('good')
  assert.equal(r.exit, 0, JSON.stringify(r.failures))
  assert.equal(r.matrix.length, 6)
  assert.deepEqual(r.matrix.map((c) => `${c.mode}@${c.width}`).sort(), ['dark@1440', 'dark@375', 'forced-colors@1440', 'forced-colors@375', 'light@1440', 'light@375'])
  assert.ok(r.matrix.every((c) => c.passes > 10 && c.violations === 0))
  assert.equal(r.axeVersion, '4.13.0')
  assert.deepEqual(Object.fromEntries(r.behaviors.map((b) => [b.id, b.status])), { 'focus-not-obscured': 'pass', 'redundant-entry': 'pass', authentication: 'pass', 'target-size': 'pass' })
  assert.deepEqual(r.summary.behaviors, { pass: 4, fail: 0, na: 0 })
})

test('C63 dark-only contrast: light and forced-colors pass, dark fails color-contrast (KWCAG 5.4.3) — a light-only run would miss it', async () => {
  const r = await gate('dark-contrast')
  only(r, /^axe color-contrast\(serious\) dark·/)
  assert.deepEqual(r.violations.map((v) => v.mode), ['dark', 'dark'])
  assert.equal(r.violations[0].kwcag, '5.4.3')
  assert.ok(r.violations[0].wcag.includes('wcag2aa'))
  assert.equal(r.exit, 1)
  const lightOnly = await gate('dark-contrast', { modes: ['light'] })
  assert.equal(lightOnly.exit, 0, '라이트만 돌리면 통과한다 — 그래서 행렬이 필요하다')
})

test('forced-colors-only contrast: only the forced-colors mode fails', async () => {
  const r = await gate('forced-contrast')
  only(r, /^axe color-contrast\(serious\) forced-colors·/)
  assert.ok(r.violations.every((v) => v.mode === 'forced-colors'))
  assert.equal((await gate('forced-contrast', { modes: ['light', 'dark'] })).exit, 0)
})

test('forced-colors false positive is neutralised: a primary button (light text on dark) that the UA repaints does not fail in any mode (axe reads -webkit-text-fill-color, which Chrome does not force)', async () => {
  const r = await gate('forced-primary-button', { modes: ['light', 'dark', 'forced-colors'], widths: [1440] })
  assert.equal(r.exit, 0, JSON.stringify(r.failures))
  const s = await ses()
  await s.send('Emulation.setEmulatedMedia', { features: featuresFor('forced-colors') })
  await s.send('Page.navigate', { url: fx('forced-primary-button') })
  await new Promise((res) => setTimeout(res, 800))
  const probe = await s.ev("(() => { const c = getComputedStyle(document.querySelector('.primary')); return [c.color, c.getPropertyValue('-webkit-text-fill-color')] })()")
  assert.notEqual(probe[0], probe[1], '이 Chrome 에서는 강제 색의 -webkit-text-fill-color 가 color 와 달라야 이 시험이 뜻이 있다 — 같아졌다면 FORCED_FILL_FIX 가 필요 없어졌는지 본다')
  await s.send('Emulation.setEmulatedMedia', { features: featuresFor('light') })
})

test('A180: 플랫폼 로그인 규격색 버튼([data-social])만 대비가 낮으면 통과하고, 뺀 것은 exempt 로 남는다', async () => {
  const r = await gate('social-contrast')
  assert.equal(r.exit, 0, JSON.stringify(r.failures))
  assert.equal(r.violations.length, 0)
  assert.ok(r.exempt.length >= 1, 'exempt 가 비었다 — 규격색 버튼이 대비 실패로 잡히지도 않았다면 이 시험이 아무것도 안 잰 것')
  for (const e of r.exempt) {
    assert.equal(e.rule, 'color-contrast')
    assert.match(e.selector, /button|naver|span/)
    assert.equal(e.reason, '플랫폼 로그인 규격색 — 운영자 결정 A180·A5')
  }
  assert.deepEqual([...new Set(r.exempt.map((e) => e.mode))].sort(), ['dark', 'light'], '대비 실패가 나는 라이트·다크에서 빠진다(강제 색은 UA 가 색을 정해 실패 자체가 없다)')
})

test('A180 음성 대조: 같은 버튼이 data-social 이 아니면 color-contrast 로 실패하고 exempt 는 비어 있다', async () => {
  const r = await gate('social-contrast-plain')
  only(r, /^axe color-contrast\(serious\)/)
  assert.deepEqual(r.exempt, [])
})

test('A180: 면제는 color-contrast 규칙과 [data-social] 요소뿐 — 같은 쪽의 다른 글 대비 실패는 그대로 실패한다', async () => {
  const r = await gate('social-contrast-mixed')
  only(r, /^axe color-contrast\(serious\)/)
  assert.ok(r.violations.length > 0)
  const flagged = r.violations.flatMap((v) => v.nodes.map((n) => (n.target ?? []).join(' ')))
  assert.ok(flagged.every((t) => !/naver|button/.test(t) || /faint/.test(t)), `규격색 버튼이 실패 노드에 남았다: ${flagged}`)
  assert.ok(flagged.some((t) => /faint|p/.test(t)))
  assert.ok(r.exempt.length >= 1 && r.exempt.every((e) => e.rule === 'color-contrast'))
})

test('2.4.11: a fixed footer covering the focused link fails only focus-not-obscured (KWCAG 6.1.2)', async () => {
  const r = await gate('obscured-focus')
  only(r, /^행동 focus-not-obscured: .*가려진 링크.*footer/)
  const b = r.behaviors.find((x) => x.id === 'focus-not-obscured')
  assert.deepEqual([b.status, b.wcag, b.kwcag], ['fail', '2.4.11', '6.1.2'])
  assert.equal(r.violations.length, 0)
})

test('3.3.8: a paste-blocked password fails only authentication; autocomplete="off" and a text captcha each fail only it too', async () => {
  const paste = await gate('paste-blocked', { modes: ['light'] })
  only(paste, /^행동 authentication: .*password: 붙여넣기를 막는다/)
  const off = await gate('autocomplete-off', { modes: ['light'] })
  only(off, /^행동 authentication: .*autocomplete="off"/)
  const captcha = await gate('captcha', { modes: ['light'] })
  only(captcha, /^행동 authentication: .*인지 시험: 글자·수식을 입력하는 캡차/)
  for (const r of [paste, off, captcha]) assert.equal(r.violations.length, 0)
})

test('3.3.7: a second step that re-asks the email fails only redundant-entry; the prefilled version (good) passes', async () => {
  const r = await gate('reask', { modes: ['light'] })
  only(r, /^행동 redundant-entry: .*다시 비워 묻는다/)
  assert.equal(r.behaviors.find((b) => b.id === 'redundant-entry').kwcag, '7.3.4')
  assert.equal((await gate('good', { modes: ['light'] })).behaviors.find((b) => b.id === 'redundant-entry').status, 'pass')
})

test('2.5.8: two 20px targets fail target-size (axe and the hit-area measure at the 24px floor), nothing else', async () => {
  const r = await gate('small-target', { modes: ['light'] })
  assert.ok(r.failures.length > 0 && r.failures.every((f) => /target-size/.test(f)), JSON.stringify(r.failures))
  assert.ok(r.failures.some((f) => /^axe target-size/.test(f)))
  assert.ok(r.failures.some((f) => /^행동 target-size: .*20x20/.test(f)))
  assert.equal(r.behaviors.find((b) => b.id === 'target-size').kwcag, '6.1.3')
})

test('na is not a pass: a required behavior with nothing to measure fails; without --require it stays na', async () => {
  const plain = await gate('dark-contrast', { modes: ['light'] })
  assert.equal(plain.behaviors.find((b) => b.id === 'authentication').status, 'na')
  assert.equal(plain.summary.behaviors.na, 2)
  const req = await gate('good', { modes: ['light'], require: ['authentication'] })
  assert.equal(req.exit, 0)
  const noAuth = await a11yGate(fx('dark-contrast'), { session: await ses(), sceneWait: false, modes: ['light'], require: ['authentication'] })
  assert.equal(noAuth.exit, 1)
  assert.match(noAuth.failures.join('|'), /authentication: 잴 것이 없음\(na\)/)
})

test('C123: an unreachable address is a tool failure (ToolFailure / 「도구 실패:」 + no result file, stale file removed), not a judgement', async () => {
  await assert.rejects(a11yGate('http://127.0.0.1:1/', { session: await ses(), sceneWait: false }), (e) => e instanceof ToolFailure && /탐색 실패|Chrome 오류/.test(e.message))
  const out = mkdtempSync(join(tmpdir(), 'a11y-dead-'))
  writeFileSync(join(out, 'a11y-gate.json'), '{"stale":true}')
  const { code, err } = await cli(['http://127.0.0.1:1/', '--out', out, '--widths', '1440', '--modes', 'light', '--no-scene-wait'])
  assert.equal(code, 1)
  assert.match(err, /도구 실패:/)
  assert.equal(existsSync(join(out, 'a11y-gate.json')), false)
})

test('C123: an HTTP 404 page is a tool failure too', async () => {
  const srv = http.createServer((_, res) => { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>없음</title><p>없는 쪽입니다</p>') })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  try {
    await assert.rejects(a11yGate(`http://127.0.0.1:${srv.address().port}/x`, { session: await ses(), sceneWait: false, modes: ['light'], widths: [1440] }), (e) => e instanceof ToolFailure && /HTTP 404/.test(e.message))
  } finally { srv.close() }
})

test('CLI end to end: a failing page exits 1 with a result file and FAIL lines; a good page exits 0', async () => {
  const bad = mkdtempSync(join(tmpdir(), 'a11y-cli-'))
  const r = await cli([fx('dark-contrast'), '--out', bad, '--widths', '1440', '--no-scene-wait'])
  assert.equal(r.code, 1)
  assert.match(r.err, /FAIL axe color-contrast\(serious\) dark·1440px/)
  const saved = JSON.parse(readFileSync(join(bad, 'a11y-gate.json'), 'utf8'))
  assert.equal(saved.exit, 1)
  const good = mkdtempSync(join(tmpdir(), 'a11y-cli-'))
  assert.equal((await cli([fx('good'), '--out', good, '--widths', '1440', '--no-scene-wait'])).code, 0)
})
