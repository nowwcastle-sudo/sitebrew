// 블록 행렬 관문 시험(Task 7a Step 2).
//  순수: summarize 는 na 를 통과에 넣지 않는다 · 필수 표에 있는 규칙이 잰 수 0 이면 실패(A123) · 표와 소스 표지가 맞는다 · 단계 구현이 목록과 맞는다
//  CLI(가짜 서버 + Chrome): 한 행 실패 → 종료 1 + 요약 · 모두 통과 → 종료 0 · 도구 실패(서버 없음) → 종료 1 + 「도구 실패:」 + 요약 없음(이전 요약도 지운다)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBlocks, blockName } from '../../scripts/blocks.mjs'
import { summarize, STEPS, REQUIRED_RULES, MARKER_RULES, CHECKS, CHECK_NA_OK } from './gates.mjs'
import { SCENE_STEPS } from './jobs.mjs'
import { RULES } from '../../qa/marketing-gate.mjs'

const ok = { status: 'pass', measured: 1, fails: [] }
const na = { status: 'na', measured: 0, fails: [] }
const bad = { status: 'fail', measured: 1, fails: ['x'] }
const row = (block, over = {}, rules = {}) => {
  const checks = Object.fromEntries(CHECKS.map((c) => [c, over[c] ?? ok]))
  checks.marketing = { ...checks.marketing, rules }
  const failed = CHECKS.filter((c) => checks[c].status === 'fail')
  return { block, recipe: 'r1-measure', checks, pass: !failed.length, failed, na: CHECKS.filter((c) => checks[c].status === 'na') }
}

test('summarize: 모두 통과 → ok, 실패 행 0', () => {
  const s = summarize([row('block-a'), row('block-b')], [], { required: {} })
  assert.equal(s.ok, true)
  assert.equal(s.failedRows, 0)
})

test('summarize: 한 행이 실패하면 ok 가 아니고 실패 행 1', () => {
  const s = summarize([row('block-a'), row('block-b', { overflow: bad })], [], { required: {} })
  assert.equal(s.ok, false)
  assert.equal(s.failedRows, 1)
  assert.deepEqual(s.perCheck.overflow, { pass: 1, fail: 1, na: 0 })
})

test('summarize: na 는 통과가 아니다 — 검사마다 따로 센다', () => {
  const s = summarize([row('block-a', { hit: na }), row('block-b')], [], { required: {} })
  assert.deepEqual(s.perCheck.hit, { pass: 1, fail: 0, na: 1 })
  assert.equal(s.ok, true) // 필수가 아닌 na 는 실패시키지 않지만 통과 칸에도 안 들어간다
})

test('summarize: 필수 규칙이 그 블록의 어느 행에서도 잰 수 0 이면 실패(A123)', () => {
  const req = { 'block-a': ['cancel-steps'] }
  const measured = summarize([row('block-a', {}, { 'cancel-steps': { status: 'pass', measured: 2 } })], [], { required: req })
  assert.equal(measured.ok, true)
  const unmeasured = summarize([row('block-a', {}, { 'cancel-steps': { status: 'na', measured: 0 } })], [], { required: req })
  assert.equal(unmeasured.ok, false)
  assert.deepEqual(unmeasured.naRequired.map((x) => `${x.block}:${x.id}`), ['block-a:cancel-steps'])
  // 다른 행(단계 행)에서 재면 통과 — 「블록의 어느 행에서든」
  const stepRow = summarize([row('block-a', {}, { 'cancel-steps': { status: 'na', measured: 0 } }), row('block-a', {}, { 'cancel-steps': { status: 'pass', measured: 1 } })], [], { required: req })
  assert.equal(stepRow.ok, true)
})

test('summarize: 대비를 어느 행에서도 못 쟀으면(전 행 na) 실패 — 닫힌 창만 있는 블록', () => {
  const s = summarize([row('block-a', { contrast: na }), row('block-a', { contrast: na })], [], { required: {} })
  assert.equal(s.ok, false)
  assert.equal(s.naRequired[0].id, 'contrast')
  assert.equal(summarize([row('block-a', { contrast: na }), row('block-a')], [], { required: {} }).ok, true)
})

test('summarize: 주소 단위 실패(run)도 ok 를 깬다', () => {
  const s = summarize([row('block-a')], [{ block: 'block-a', recipe: 'r1-measure', checks: { run: { status: 'fail', measured: 1, fails: ['ux'] }, aiTell: { status: 'pass', measured: 1, fails: [], score: 3 } } }], { required: {} })
  assert.equal(s.ok, false)
  assert.equal(s.failedUrls, 1)
})

// ── 필수 표 ↔ 소스 ──────────────────────────────────────────────────────────────────────────────
const blocks = loadBlocks().filter((b) => b.meta.success)
const names = new Set(blocks.map((b) => blockName(b.kind, b.variant)))

test('필수 표의 블록·규칙 이름은 실제다(오타로 조용히 빠지지 않는다)', () => {
  const ids = new Set(RULES.map((r) => r.id))
  for (const [block, rules] of Object.entries(REQUIRED_RULES)) {
    assert.ok(names.has(block), `${block} 이 없다`)
    for (const r of rules) assert.ok(ids.has(r), `규칙 ${r} 이 없다`)
  }
})

// C376(G7): 글자가 그려지지 않는 블록(로딩 틀)은 필수 contrast 가 na 여도 된다 — 표에 이름이 있는 블록·검사만, 다른 블록은 그대로 실패(음성 대조).
test('summarize: 글자 없는 블록(CHECK_NA_OK)은 contrast 전 행 na 여도 통과, 표에 없는 블록은 실패', () => {
  const allNa = (block) => [row(block, { contrast: na }), row(block, { contrast: na })]
  assert.equal(summarize(allNa('block-content-skeleton'), [], { required: {} }).ok, true)
  assert.equal(summarize(allNa('block-content-skeleton'), [], { required: {} }).naRequired.length, 0)
  const other = summarize(allNa('block-content-list'), [], { required: {} })
  assert.equal(other.ok, false)
  assert.deepEqual(other.naRequired.map((x) => `${x.block}:${x.id}`), ['block-content-list:contrast'])
  // 예외는 그 검사 하나만 — 표에 없는 검사(여기서는 가짜 requiredChecks 의 overflow)는 그대로 필수
  const s = summarize(allNa('block-content-skeleton').map((r) => ({ ...r, checks: { ...r.checks, overflow: na } })), [], { required: {}, requiredChecks: ['contrast', 'overflow'] })
  assert.deepEqual(s.naRequired.map((x) => x.id), ['overflow'])
})

test('CHECK_NA_OK 의 블록·검사 이름은 실제이고, 예외 블록은 눈에 보이는 글을 그리지 않는다(sr-only 이름만)', () => {
  for (const [block, checks] of Object.entries(CHECK_NA_OK)) {
    assert.ok(names.has(block), `${block} 이 없다`)
    for (const c of checks) assert.ok(CHECKS.includes(c), `검사 ${c} 가 없다`)
    const src = blocks.find((b) => blockName(b.kind, b.variant) === block).source
    // 글자가 되는 JSX 식은 sr-only 제목 하나뿐 — {copy.…} 가 둘 이상이면 그려진 글자가 생긴 것이라 표에서 빼야 한다
    assert.equal((src.match(/\{copy\.[\w.]+\}/g) ?? []).length, 1, `${block}: 글자를 그리는 식이 늘었다`)
    assert.match(src, /className="sr-only"[^>]*>\s*\{copy\./, `${block}: 유일한 글자가 sr-only 가 아니다`)
  }
})

test('소스에 표지가 있는 블록은 필수 표에 그 규칙이 있다(표지를 지워도 na 로 빠지지 않게)', () => {
  for (const b of blocks) {
    const name = blockName(b.kind, b.variant)
    for (const [marker, rule] of Object.entries(MARKER_RULES)) if ((b.source ?? '').includes(marker)) assert.ok((REQUIRED_RULES[name] ?? []).includes(rule), `${name} 소스에 ${marker} 가 있는데 필수 표에 ${rule} 이 없다`)
    if (/data-flow="cancel"/.test(b.source ?? '')) assert.ok((REQUIRED_RULES[name] ?? []).includes('cancel-steps'), `${name} 에 cancel-steps 가 없다`)
  }
})

test('단계 구현(STEPS)이 SCENE_STEPS 목록과 맞는다', () => {
  const listed = new Set(Object.values(SCENE_STEPS).flat())
  for (const id of listed) assert.equal(typeof STEPS[id], 'function', `단계 ${id} 구현이 없다`)
  for (const id of Object.keys(STEPS)) assert.ok(listed.has(id), `쓰이지 않는 단계 구현 ${id}`)
})

// ── CLI(가짜 서버) ─────────────────────────────────────────────────────────────────────────────
let server, origin, tmp, mode = 'good'
const BASE = (extra = '', ready = ' data-qa-ready') => `<!doctype html><html><body style="margin:0;background:#fff;color:#111"><div data-qa-block="b"${ready}><section data-block="faq-two-column-index"><h2>자주 묻는 질문</h2><p>이 문단은 대비를 재기 위한 스무 글자가 넘는 시험 글입니다. 검은 글씨에 흰 바탕입니다.</p><button type="button" data-slot="button" style="min-height:44px;min-width:120px">눌러 보기</button>${extra}</section></div></body></html>`
const PAGES = {
  good: () => BASE(),
  wide: () => BASE('<div style="width:3000px;height:10px;background:#f00"></div>'),
  enterhidden: () => BASE('<div data-enter style="opacity:0">등장하지 않는 대상입니다 스무 글자 넘게</div>'),
  lowcontrast: () => BASE('<p style="color:#bbb">흐릿한 글씨입니다 이 문단은 스무 글자가 넘습니다 정말로요</p>'),
  smallhit: () => BASE('<button type="button" data-slot="button" style="width:20px;height:20px;padding:0">x</button>'),
  reducedanim: () => BASE('<style>@keyframes t7spin{to{transform:rotate(1turn)}}</style><div style="width:10px;height:10px;background:#000;animation:t7spin 1s linear infinite"></div>'),
  // 부품 밖 링크(data-slot 없음) — hit-area 원본은 건너뛰던 자리. 높이 20 은 실패, 짧은 말(너비 30·높이 44)은 통과.
  orphanhit: () => BASE('<a href="#x" style="display:block;margin-top:24px;width:120px;height:20px">작은 링크</a>'),
  shortlink: () => BASE('<a href="#x" style="display:block;margin-top:24px;width:30px;height:44px">소개</a>'),
  norender: () => BASE('<p role="alert">블록이 오류로 그려지지 않았어요</p>', ''),
}
before(async () => {
  server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(PAGES[mode]()) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  tmp = mkdtempSync(join(tmpdir(), 'gates-test-'))
})
after(() => { server?.close(); rmSync(tmp, { recursive: true, force: true }) })

const cli = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./gates.mjs', import.meta.url)), ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => resolve({ code, out, err }))
})
const ARGS = (o, extra = []) => [o, '--only', 'block-faq-two-column-index', '--limit', '1', '--skip', 'run,aiTell', '--out', join(tmp, 'out'), ...extra]
const SUMMARY = () => join(tmp, 'out', 'summary.json')

test('CLI: 모두 통과하는 화면 → 종료 0 + 요약(검사별 통과·실패·na)', async () => {
  mode = 'good'
  const r = await cli(ARGS(origin))
  assert.equal(r.code, 0, r.out + r.err)
  const s = JSON.parse(readFileSync(SUMMARY(), 'utf8'))
  assert.equal(s.rows, 1)
  assert.equal(s.failedRows, 0)
  assert.ok(s.perCheck.contrast.pass >= 1)
  assert.equal(s.perCheck.overflow.pass, 1)
})

test('CLI: 한 행이 실패(가로 넘침) → 종료 1 + 요약이 남고 실패 행 1', async () => {
  mode = 'wide'
  const r = await cli(ARGS(origin))
  assert.equal(r.code, 1, r.out + r.err)
  assert.doesNotMatch(r.err, /도구 실패:/)
  const s = JSON.parse(readFileSync(SUMMARY(), 'utf8'))
  assert.equal(s.failedRows, 1)
  assert.ok(s.rowsDetail[0].failed.includes('overflow'))
})

test('CLI: 도구 실패(서버 없음) → 종료 1 + 「도구 실패:」 + 요약 없음(이전 요약도 지운다)', async () => {
  mkdirSync(join(tmp, 'out'), { recursive: true })
  writeFileSync(SUMMARY(), '{"stale":true}')
  const r = await cli(ARGS('http://127.0.0.1:1'))
  assert.equal(r.code, 1)
  assert.match(r.err, /도구 실패:/)
  assert.equal(existsSync(SUMMARY()), false)
})

test('CLI: 인자 오류(--skip 에 모르는 값) → 종료 2', async () => {
  const r = await cli([origin, '--skip', 'nope', '--out', join(tmp, 'out')])
  assert.equal(r.code, 2)
})

test('CLI: --rows-only 와 --urls-only 는 같이 못 쓴다 → 종료 2(나눠 돌리기 플래그)', async () => {
  const r = await cli([origin, '--rows-only', '--urls-only', '--out', join(tmp, 'out')])
  assert.equal(r.code, 2)
  assert.match(r.err, /같이 못 쓴다/)
})

const one = async (m) => {
  mode = m
  const r = await cli(ARGS(origin))
  const f = join(tmp, 'out', 'summary.json')
  return { ...r, s: existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
}
// 음성 대조: 검사마다 그 검사만 어기는 화면 하나 — 그 검사가 잡고 다른 검사는 그대로 통과한다(나머지 검사가 우연히 잡은 것이 아니다).
for (const [m, only] of [['enterhidden', ['entered', 'reduced']], ['lowcontrast', ['contrast']], ['smallhit', ['hit']], ['orphanhit', ['hit']], ['reducedanim', ['reduced']], ['norender', ['render']]]) {
  test(`CLI 음성 대조: ${m} → 종료 1, 실패한 검사는 ${only.join('·')}만`, async () => {
    const r = await one(m)
    assert.equal(r.code, 1, r.out + r.err)
    const failed = r.s.rowsDetail[0].failed
    for (const c of only) assert.ok(failed.includes(c), `${c} 가 안 잡았다: ${failed}`)
    if (m !== 'norender') assert.deepEqual(failed.filter((c) => !only.includes(c)), [], `딴 검사가 같이 실패: ${failed} ${JSON.stringify(r.s.rowsDetail[0].checks.contrast.fails)}`)
  })
}

test('CLI 양성 대조: 짧은 글자 링크(너비 30·높이 44, 부품 밖)는 hit 를 통과한다', async () => {
  const r = await one('shortlink')
  assert.equal(r.code, 0, r.out + r.err + JSON.stringify(r.s?.rowsDetail[0].checks))
  assert.ok(r.s.rowsDetail[0].checks.hit.measured >= 1, '재긴 했다(na 아님)')
})

// ── 면(K6~K8) 판정 — 순수 ─────────────────────────────────────────────────────────────────────
import { faceResult, FACE_AREA_MIN } from './checks.mjs'
test('faceResult: K6~K8 이 아니면 na, 면을 까는 블록은 면이 0 이면 실패·25% 미만 실패·이상 통과', () => {
  assert.equal(faceResult({ bold: false, faceBlock: true, area: { faces: 0, ratio: 0 }, contrast: [] }).status, 'na')
  assert.equal(faceResult({ bold: true, faceBlock: true, area: { faces: 0, ratio: 0 }, contrast: [] }).status, 'fail')
  assert.equal(faceResult({ bold: true, faceBlock: true, area: { faces: 3, ratio: FACE_AREA_MIN - 0.01 }, contrast: [] }).status, 'fail')
  assert.equal(faceResult({ bold: true, faceBlock: true, area: { faces: 3, ratio: FACE_AREA_MIN }, contrast: [] }).status, 'pass')
  assert.equal(faceResult({ bold: true, faceBlock: false, area: { faces: 0, ratio: 0 }, contrast: [] }).status, 'na', '면을 안 까는 블록은 면이 없어도 na')
  assert.equal(faceResult({ bold: true, faceBlock: false, area: { faces: 1, ratio: 0.1 }, contrast: ['x token a/b 1 < 4.5'] }).status, 'fail', '면 스코프 대비 실패는 잡는다')
})
