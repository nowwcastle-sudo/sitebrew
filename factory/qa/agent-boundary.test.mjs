// 에이전트 승인 경계 관문(P3-7 AXWF · G11) — 순수 판정 + 원천 검사 + 고정 시험 쪽(Chrome, agent-boundary.mjs 를 자식 프로세스로 비동기로 돌린다).
// 양성 대조 good.html(어김 0 — 종료 0) · 음성 대조 bad-*.html(규칙마다 그 규칙만 어긴 쪽 — 종료 1, 결과 파일에 그 규칙) · 잴 것 없는 empty.html(na — 종료 1, 통과가 아니다).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/agent-boundary.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runTool } from './fixtures/run-tool.mjs'
import { loadActionTable, judgePage, toolNameProblem, sourceProblems, parseArgs, summarize, collectScript, REACH, UNREACHED_OK } from './agent-boundary.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const furl = (f) => pathToFileURL(join(here, 'fixtures', 'agent-boundary', f)).href
const run = (args, env = {}) => runTool(join(here, 'agent-boundary.mjs'), args, env)
const outDir = () => mkdtempSync(join(tmpdir(), 'agent-boundary-'))
const readJson = (dir) => JSON.parse(readFileSync(join(dir, 'agent-boundary.json'), 'utf8'))
const table = await loadActionTable()

// ── 행동 표 ─────────────────────────────────────────────────────────────
test('행동 표: id 유일·세 단계, 사람 승인 행동은 제출 컨트롤을 가진 블록이 실재한다, 안내 기본 글은 짧다', () => {
  const ids = table.AGENT_ACTIONS.map((a) => a.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...new Set(table.AGENT_ACTIONS.map((a) => a.tier))].sort(), ['agent-ok', 'fill-human-press', 'human-approval'])
  assert.ok(table.HUMAN_APPROVAL_ACTIONS.length >= 12)
  for (const id of ['checkout', 'change-plan', 'cancel-subscription', 'delete-account', 'change-email', 'marketing-consent', 'export-personal-data', 'send-message']) assert.ok(table.HUMAN_APPROVAL_ACTIONS.includes(id), id)
  for (const id of ['browse-search-filter', 'fill-draft', 'sign-in']) assert.equal(table.AGENT_ACTIONS.find((a) => a.id === id).tier, 'agent-ok', id)
  for (const k of Object.keys(table.APPROVAL_HINT)) assert.ok([...table.APPROVAL_HINT[k]].length <= table.HINT_MAX_CHARS, k)
  assert.deepEqual(table.humanApprovalProps('checkout', 'x'), { 'data-requires-human': 'checkout', 'aria-describedby': 'x' })
})

test('원천 검사: 지금 저장소는 문제 0(표에 적힌 블록은 표지를 달고, 승인 포트 호출은 표에 있고, toolname 블록은 승인 표지가 없다)', () => {
  assert.deepEqual(sourceProblems(table, root), [])
})

test('원천 검사 음성 대조: 표지 빠짐·표에 없는 승인 호출·toolname 과 승인 표지 혼합·toolautosubmit 코드·표 모순을 각각 잡는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-boundary-src-'))
  const w = (rel, text) => { const f = join(dir, 'registry', 'factory', ...rel.split('/')); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text) }
  w('blocks/_shared/human-approval.tsx', 'export const ApprovalHint = () => null\n')
  w('blocks/acct/del.tsx', 'export function Del() { return <button>지우기</button> }\n') // 표에 있는데 표지 없음
  w('blocks/acct/pay.tsx', 'const r = await form.run(() => checkout({ planId }))\n') // 승인 호출인데 표에 이 블록 없음
  w('blocks/contact/form.tsx', 'const agent = agentFormAttrs(tool)\nconst x = <SubmitButton approval={{ action: "sign-up", hint: h }} />\nimport { ApprovalHint } from "../_shared/human-approval"\n') // toolname + 승인
  w('blocks/ok/fine.tsx', 'import { ApprovalHint } from "../_shared/human-approval"\nconst p = humanApprovalProps("delete-account", id)\n<ApprovalHint id={id}>x</ApprovalHint>\n') // 정상
  w('ax/bad.tsx', 'export const attrs = { toolautosubmit: "" }\n') // toolautosubmit 코드
  w('ax/commented.tsx', '// toolautosubmit 은 만들지 않는다\n/* toolautosubmit: 주석 */\nexport const ok = 1\n') // 주석은 괜찮다
  const fake = {
    AGENT_ACTIONS: [
      { id: 'delete-account', tier: 'human-approval', ports: ['deleteAccount'], blocks: ['acct/del', 'ok/fine'], why: 'x' },
      { id: 'checkout', tier: 'human-approval', ports: ['checkout'], blocks: [], why: 'x' },
      { id: 'contact-inquiry', tier: 'fill-human-press', blocks: ['contact/form'], why: 'x' },
      { id: 'ghost', tier: 'human-approval', blocks: ['nope/missing'], why: 'x' },
    ],
  }
  const rules = sourceProblems(fake, dir).map((p) => `${p.rule}:${p.where}`)
  assert.ok(rules.includes('missing-marker:acct/del'), rules.join())
  assert.ok(rules.includes('unlisted-approval-call:acct/pay'), rules.join())
  assert.ok(rules.includes('toolname-with-approval:contact/form'), rules.join())
  assert.ok(rules.includes('toolautosubmit-code:registry/factory/ax/bad.tsx'), rules.join())
  assert.ok(rules.includes('table:ghost'), rules.join())
  assert.ok(!rules.some((r) => r.includes('commented')), '주석 속 toolautosubmit 은 코드가 아니다')
  assert.ok(!rules.some((r) => r.endsWith('ok/fine')), '표지·안내 글이 있는 블록은 문제 없다')
})

// ── 순수 판정 ───────────────────────────────────────────────────────────
test('toolNameProblem: 승인 행동 이름·낱말은 잡고 문의·예약 요청·질문 이름은 놓아 준다', () => {
  const ids = [...table.HUMAN_APPROVAL_ACTIONS]
  for (const n of ['checkout', 'start-checkout', 'delete-account', 'cancel-subscription', 'change-plan', 'subscribe-newsletter', 'sign-up', 'reset-password', 'marketing-consent', 'upgrade-now']) assert.ok(toolNameProblem(n, ids), n)
  for (const n of ['send-inquiry', 'request-booking', 'ask-product-question', 'search-products', 'contact-us', 'find-store']) assert.equal(toolNameProblem(n, ids), null, n)
})

test('judgePage: 어김 없는 사실은 pass, 아무것도 못 잰 사실은 na, 규칙마다 어긴 사실은 그 규칙 한 줄', () => {
  const hint = { described: true, visible: true, text: '직접 확인하고 눌러 주세요', length: 13 }
  const ctl = (o = {}) => ({ action: 'checkout', selector: 'button', label: '결제', inToolForm: false, hint, ...o })
  const clean = { forms: [{ toolname: 'send-inquiry', selector: 'form', humanControls: 0, consents: 0, passwordFields: 0 }], autoSubmit: [], controls: [ctl()] }
  assert.deepEqual(judgePage(clean, table), { findings: [], measured: 2, status: 'pass' })
  assert.equal(judgePage({ forms: [], autoSubmit: [], controls: [] }, table).status, 'na')
  const rule = (facts) => judgePage(facts, table).findings.map((f) => f.rule)
  assert.deepEqual(rule({ ...clean, forms: [{ ...clean.forms[0], humanControls: 1 }] }), ['toolname-contains-human-approval'])
  assert.deepEqual(rule({ ...clean, forms: [{ ...clean.forms[0], toolname: 'start-checkout' }] }), ['toolname-is-human-approval'])
  assert.deepEqual(rule({ ...clean, autoSubmit: [{ selector: 'form', tag: 'form' }] }), ['toolautosubmit-present'])
  assert.deepEqual(rule({ ...clean, controls: [ctl({ hint: { described: false, visible: false, text: '', length: 0 } })] }), ['human-control-no-hint'])
  assert.deepEqual(rule({ ...clean, controls: [ctl({ hint: { ...hint, length: 90, text: 'x'.repeat(90) } })] }), ['hint-too-long'])
  assert.deepEqual(rule({ ...clean, controls: [ctl({ action: 'launch-rocket' })] }), ['unknown-action'])
  assert.deepEqual(rule({ ...clean, controls: [ctl({ inToolForm: true })] }), ['toolname-contains-human-approval'])
})

test('parseArgs·summarize·표: 모드는 하나만, 갤러리 표의 장면과 면제는 모양이 맞다', () => {
  assert.throws(() => parseArgs(['--source', 'http://x']), /하나만/)
  assert.throws(() => parseArgs(['http://x']), /--out/)
  assert.deepEqual(parseArgs(['--source']).source, true)
  assert.equal(parseArgs(['--gallery', 'http://localhost:3000', '--out', 'o']).recipe, 'r1-measure')
  const s = summarize([{ controls: 2, toolForms: 1, status: 'pass' }, { controls: 0, toolForms: 0, status: 'na' }], [])
  assert.deepEqual([s.pass, s.na, s.ok], [1, 1, false])
  for (const [b, list] of Object.entries(REACH)) assert.ok(/^[a-z-]+\/[a-z0-9-]+$/.test(b) && list.every((r) => typeof r.click === 'string'), b)
  for (const [b, why] of Object.entries(UNREACHED_OK)) assert.ok(/^[a-z-]+\/[a-z0-9-]+$/.test(b) && why.length > 10, b)
  assert.match(collectScript(), /toolautosubmit/)
})

// ── 고정 시험 쪽(Chrome) ─────────────────────────────────────────────────
test('양성 대조(Chrome): good.html — toolname 폼은 문의뿐이고 승인 컨트롤 둘은 눈에 보이는 안내 글이 있다 → 종료 0', async () => {
  const out = outDir()
  const r = await run([furl('good.html'), '--out', out])
  assert.equal(r.code, 0, r.out + r.err)
  const j = readJson(out)
  assert.equal(j.pages[0].status, 'pass')
  assert.equal(j.pages[0].controls, 2)
  assert.equal(j.pages[0].toolForms, 1)
  assert.deepEqual(j.pages[0].findings, [])
  assert.equal(j.summary.ok, true)
})

const NEGATIVES = [
  ['bad-toolname-human.html', ['toolname-contains-human-approval']],
  ['bad-toolname-word.html', ['toolname-is-human-approval']],
  ['bad-toolname-consent.html', ['toolname-contains-human-approval', 'toolname-contains-consent']],
  ['bad-autosubmit.html', ['toolautosubmit-present']],
  ['bad-no-hint.html', ['human-control-no-hint', 'hint-too-long']],
  ['bad-unknown-action.html', ['unknown-action']],
]
for (const [file, expected] of NEGATIVES) {
  test(`음성 대조(Chrome): ${file} → 종료 1, 결과에 ${expected.join('·')}`, async () => {
    const out = outDir()
    const r = await run([furl(file), '--out', out])
    assert.equal(r.code, 1, r.out + r.err)
    assert.ok(existsSync(join(out, 'agent-boundary.json')), '판정 실패는 결과 파일이 있다(도구 실패와 구분)')
    const j = readJson(out)
    assert.equal(j.pages[0].status, 'fail')
    const got = new Set(j.pages[0].findings.map((f) => f.rule))
    for (const rule of expected) assert.ok(got.has(rule), `${rule} 가 없다 — ${[...got].join()}`)
    if (file === 'bad-no-hint.html') {
      assert.equal(j.pages[0].findings.filter((f) => f.rule === 'human-control-no-hint').length, 4, '안내 없음·display:none·sr-only·빈 글 넷이 모두 걸려야 한다')
      assert.equal(j.pages[0].findings.filter((f) => f.rule === 'hint-too-long').length, 1)
    }
    if (file === 'bad-toolname-word.html') assert.equal(j.pages[0].findings.length, 2, '결제·계정 지우기 두 toolname 이 모두 걸려야 한다')
  })
}

test('잴 것이 없는 쪽(Chrome): empty.html → na 는 통과가 아니라 종료 1(결과 파일 있음)', async () => {
  const out = outDir()
  const r = await run([furl('empty.html'), '--out', out])
  assert.equal(r.code, 1, r.out + r.err)
  assert.equal(readJson(out).pages[0].status, 'na')
})

test('열리지 않는 쪽은 도구 실패: 종료 1 + stderr 「도구 실패:」 + 결과 파일 없음(이전 파일도 지운다)', async () => {
  const out = outDir()
  writeFileSync(join(out, 'agent-boundary.json'), '{"stale":true}')
  const r = await run(['http://127.0.0.1:9/never', '--out', out], { WF_NAV_TIMEOUT_MS: '4000', WF_CDP_TIMEOUT_MS: '30000' })
  assert.equal(r.code, 1)
  assert.match(r.err, /도구 실패:/)
  assert.equal(existsSync(join(out, 'agent-boundary.json')), false)
})

test('--source CLI: 종료 0 + 결과 파일(원천 문제 0)', async () => {
  const out = outDir()
  const r = await run(['--source', '--out', out])
  assert.equal(r.code, 0, r.out + r.err)
  const j = readJson(out)
  assert.equal(j.mode, 'source')
  assert.deepEqual(j.source, [])
})
