// 수정 기록(Task 7) — 적용 전 보관(snapshot) · 「되돌려」(undoLast) · 「둘 다 아니에요」(pickNone) · CLI. 06 을 돌리지 않는 가벼운 시험이다(fixtureRevisionRun).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision } from '../stamp/revise.mjs'
import { hasAppliedRevision, pickNone, previousCandidate, snapshot, stateHash, undoLast } from '../stamp/revise-history.mjs'
import { EXIT, parseArgs, runReviseCommand } from '../stamp/stamp.mjs'
import { loadPreferences } from '../board/preferences.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { fixtureRevisionRun } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-history-test')
mkdirSync(TMP, { recursive: true })

let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const opts = () => ({ seedFile: join(dir, 'no-seed.json'), userFile: join(dir, 'prefs', 'preferences.json') })
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const sha = (f) => (existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : null)
// 후보 폴더에서 수정이 건드릴 수 있는 파일의 바이트 지문
const FILES = ['01-direction.json', '02-sitemap.json', '03-variants.json', '04-content.json', '04-content.request.json', 'recipe/DESIGN.md']
const prints = (cand) => Object.fromEntries(FILES.map((f) => [f, sha(join(cand, f))]))
const stageHash = (cand, n) => readJ(join(cand, `${n}.json`)).inputHash

const writeJ = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2))

/** 판을 지금 상태에서 만든 것으로 친다 — 판의 상태 해시를 다시 적는다(앞선 적용 뒤에 만든 판 흉내: 같은 상태에서 만든 판은 하나만 고를 수 있다). */
function restamp(run, index) {
  const file = join(run.cand, '09-revise', String(index), 'board.json')
  const board = readJ(file)
  writeJ(file, { ...board, stateHash: stateHash(run.cand) })
}

/** 번호 2 에 구조(order) 판을 더한다 — 연동 구획을 사회적 증거 뒤로. */
function addOrderBoard(run) {
  const board = readJ(run.boardFile)
  const second = { ...board, index: 2, scope: 'order', target: 'home/integrations', structure: { scope: 'order', key: 'home/integrations', page: 'home', anchor: 'home/social-proof', place: 'after' }, variants: [{ id: 'v1', op: 'order', blockers: [] }] }
  mkdirSync(join(run.cand, '09-revise', '2'), { recursive: true })
  writeJ(join(run.cand, '09-revise', '2', 'board.json'), second)
}

/** 같은 실행 폴더에 두 번째 문구 판(번호 2)을 더한다. */
function addSecondCopyBoard(run, text) {
  const board = readJ(run.boardFile)
  const texts = { 'home/hero/subhead': text }
  const second = { ...board, index: 2, variants: [{ ...board.variants[0], texts, diff: { ...board.variants[0].diff, after: texts } }] }
  mkdirSync(join(run.cand, '09-revise', '2'), { recursive: true })
  writeFileSync(join(run.cand, '09-revise', '2', 'board.json'), JSON.stringify(second, null, 2))
}

for (const scope of ['copy', 'section', 'design']) {
  test(`적용 → 되돌리기: ${scope} 는 01/03/04 바이트까지 같다`, async () => {
    const run = fixtureRevisionRun({ scope })
    const before = prints(run.cand)
    await applyRevision(run.dir, 'a', run.index, run.variant, opts())
    assert.notDeepEqual(prints(run.cand), before, '적용하면 파일이 바뀐다')
    const r = undoLast(run.dir, 'a')
    assert.ok(r.restored >= 1)
    assert.deepEqual(prints(run.cand), before)
    assert.match(readJ(run.boardFile).undone, /^\d{4}-/)
  })
}

test('두 번 적용 → 한 번 되돌리기 = 첫 적용 뒤 · 두 번 = 처음', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  addSecondCopyBoard(run, '반죽부터 직접 만들어요')
  const start = prints(run.cand)
  await applyRevision(run.dir, 'a', 1, 'v1', opts())
  const afterFirst = prints(run.cand)
  restamp(run, 2)
  await applyRevision(run.dir, 'a', 2, 'v1', opts())
  assert.notDeepEqual(prints(run.cand), afterFirst)
  assert.equal(undoLast(run.dir, 'a').index, 2)
  assert.deepEqual(prints(run.cand), afterFirst)
  assert.equal(undoLast(run.dir, 'a').index, 1)
  assert.deepEqual(prints(run.cand), start)
  assert.deepEqual(undoLast(run.dir, 'a'), { none: true }, '되돌린 판은 건너뛴다(되돌림의 되돌림은 없다)')
})

test('기록 없음 → none', () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  assert.deepEqual(undoLast(run.dir, 'a'), { none: true })
  assert.deepEqual(undoLast(run.dir, 'b'), { none: true }, '09-revise 가 없는 후보도 none')
})

test('되돌린 뒤 06/07 stale — 자료는 남는다', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  undoLast(run.dir, 'a')
  for (const n of ['06-pages', '07-qa']) {
    assert.match(stageHash(run.cand, n), /^stale:revise-1$/, n)
    assert.deepEqual(readJ(join(run.cand, `${n}.json`)).data, {})
  }
})

test('before/ 에는 쓸 파일만 갈래대로 보관한다', async () => {
  const design = fixtureRevisionRun({ scope: 'design' })
  const { dir: before } = snapshot(design.dir, 'a', 1)
  const m = readJ(join(before, 'manifest.json'))
  assert.deepEqual(m.files, ['01-direction.json'], '라이브러리 후보는 recipe/DESIGN.md 가 없었다')
  assert.deepEqual(m.absent, ['recipe/DESIGN.md'])
  assert.deepEqual(readdirSync(before).sort(), ['01-direction.json', 'manifest.json'])
})

test('before/ 에는 갈래마다 applyRevision 이 쓰는 파일만 있다(문구 · 구획 · 구조)', () => {
  const kept = (scope, extra) => {
    const run = fixtureRevisionRun({ scope })
    if (extra) extra(run)
    return readJ(join(snapshot(run.dir, 'a', 1).dir, 'manifest.json'))
  }
  assert.deepEqual(kept('copy'), { files: ['04-content.json'], absent: [] })
  assert.deepEqual(kept('section'), { files: ['03-variants.json', '04-content.request.json'], absent: [] })
  const order = kept('copy', (run) => writeJ(run.boardFile, { ...readJ(run.boardFile), scope: 'order' }))
  assert.deepEqual(order, { files: ['02-sitemap.json', '03-variants.json', '04-content.json', '04-content.request.json'], absent: [] })
})

test('구조(order) 판: 적용 → 되돌리기가 02/03/04 바이트까지 같다', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  addOrderBoard(run)
  restamp(run, 2)
  const before = prints(run.cand)
  await applyRevision(run.dir, 'a', 2, 'v1', opts())
  assert.notDeepEqual(prints(run.cand), before, '순서를 바꾸면 02 가 바뀐다')
  assert.equal(undoLast(run.dir, 'a').index, 2)
  assert.deepEqual(prints(run.cand), before)
})

test('적용한 순서로 되돌린다: 2번을 먼저 적용하고 1번을 나중에 적용하면 1번이 먼저 되돌려진다', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  addSecondCopyBoard(run, '반죽부터 직접 만들어요')
  const start = prints(run.cand)
  await applyRevision(run.dir, 'a', 2, 'v1', opts())
  const afterSecond = prints(run.cand)
  restamp(run, 1)
  await applyRevision(run.dir, 'a', 1, 'v1', opts())
  assert.equal(readJ(run.boardFile).picked.seq, 2)
  assert.equal(undoLast(run.dir, 'a').index, 1)
  assert.deepEqual(prints(run.cand), afterSecond, '한 번 되돌리면 2번만 적용된 상태')
  assert.equal(undoLast(run.dir, 'a').index, 2)
  assert.deepEqual(prints(run.cand), start)
})

test('구획 고르기를 되돌리면 그 고르기가 학습에 더한 것만 덜어 낸다', async () => {
  const run = fixtureRevisionRun({ scope: 'section' })
  const o = opts()
  const none = loadPreferences(o).user
  await applyRevision(run.dir, 'a', run.index, run.variant, o)
  assert.notDeepEqual(loadPreferences(o).user, none, '고르면 학습에 기록된다')
  assert.ok(readJ(run.boardFile).picked.learned.losers.length >= 1)
  undoLast(run.dir, 'a', o)
  assert.deepEqual(loadPreferences(o).user, none)
})

test('디자인 되돌리기: 없던 recipe/ 폴더까지 지운다', async () => {
  const run = fixtureRevisionRun({ scope: 'design' })
  await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  assert.ok(existsSync(join(run.cand, 'recipe', 'DESIGN.md')))
  undoLast(run.dir, 'a')
  assert.equal(existsSync(join(run.cand, 'recipe')), false)
})

test('적용이 던지면 처음 상태로 되살린 뒤 던진다 · 고른 표시는 없다', async () => {
  const run = fixtureRevisionRun({ scope: 'design' })
  writeFileSync(join(run.cand, '01-direction.json'), '{ 깨진 json') // DESIGN.md 를 복사한 뒤 01 을 고치다 던진다
  restamp(run, run.index)
  const before = prints(run.cand)
  await assert.rejects(() => applyRevision(run.dir, 'a', run.index, run.variant, opts()))
  assert.deepEqual(prints(run.cand), before)
  assert.equal(existsSync(join(run.cand, 'recipe')), false)
  assert.equal(readJ(run.boardFile).picked, null)
})

test('none 고르기: 파일 변경 없음 · 되돌리기 대상 아님', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  const before = prints(run.cand)
  const stale = [stageHash(run.cand, '06-pages'), stageHash(run.cand, '07-qa')]
  const r = pickNone(run.dir, 'a', run.index, { now: () => '2026-10-17T00:00:00.000Z' })
  assert.deepEqual(r, { index: 1, id: 'none', text: null })
  assert.deepEqual(prints(run.cand), before)
  assert.deepEqual([stageHash(run.cand, '06-pages'), stageHash(run.cand, '07-qa')], stale)
  assert.deepEqual(readJ(run.boardFile).picked, { id: 'none', at: '2026-10-17T00:00:00.000Z' })
  assert.deepEqual(undoLast(run.dir, 'a'), { none: true })
  assert.throws(() => pickNone(run.dir, 'a', run.index), /이미 골랐다/)
})

test('none 고르기는 고를 수 있는(ready) 판만 받는다', () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  writeJ(run.boardFile, { ...readJ(run.boardFile), status: 'invalid-copy' })
  assert.throws(() => pickNone(run.dir, 'a', run.index), /아직 고를 수 없다/)
  assert.equal(readJ(run.boardFile).picked, null)
})

test('none 판은 건너뛰고 그 앞의 적용을 되돌린다', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  addSecondCopyBoard(run, '반죽부터 직접 만들어요')
  const start = prints(run.cand)
  await applyRevision(run.dir, 'a', 1, 'v1', opts())
  pickNone(run.dir, 'a', 2)
  assert.equal(undoLast(run.dir, 'a').index, 1)
  assert.deepEqual(prints(run.cand), start)
})

test('CLI: --revise-undo 는 되돌리면 0, 없으면 3 · --revise-pick n:none 은 3', async () => {
  const run = fixtureRevisionRun({ scope: 'copy' })
  const args = (...more) => parseArgs(['--run', run.dir, '--pick', 'a', ...more])
  assert.equal(args('--revise-undo').reviseUndo, true)
  assert.throws(() => args('--revise-undo', '--revise', '바꿔줘'), /하나만/)
  let r = await runReviseCommand(args('--revise-undo'), { say: () => {} })
  assert.equal(r.code, EXIT.waiting)
  assert.ok(r.lines.includes(grammar.text.nothingToUndo.ko))
  await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  r = await runReviseCommand(args('--revise-undo'), { say: () => {} })
  assert.equal(r.code, EXIT.done)
  assert.ok(r.lines[0].includes(grammar.text.undone.ko))
  assert.match(r.lines[1], /^낡은 단계: 06·07/)
  // 처음 요청이 영어였던 판은 영어로 알린다
  const en = fixtureRevisionRun({ scope: 'copy' })
  writeJ(en.boardFile, { ...readJ(en.boardFile), request: 'make it warmer' })
  await applyRevision(en.dir, 'a', en.index, en.variant, opts())
  r = await runReviseCommand(parseArgs(['--run', en.dir, '--pick', 'a', '--revise-undo']), { say: () => {} })
  assert.ok(r.lines[0].includes(grammar.text.undone.en))
  assert.match(r.lines[1], /^Stale steps: 06·07/)
  const fresh = fixtureRevisionRun({ scope: 'copy' })
  const before = prints(fresh.cand)
  r = await runReviseCommand(parseArgs(['--run', fresh.dir, '--pick', 'a', '--revise-pick', '1:none']), { say: () => {} })
  assert.equal(r.code, EXIT.waiting)
  assert.deepEqual(r.lines, [grammar.text.neitherAsk.ko])
  assert.deepEqual(prints(fresh.cand), before)
})

test('previousCandidate: 가장 최근에 적용한 방향 판의 적용 전 후보 칸 — 되돌린 판·둘 다 아니에요·방향 파일이 없는 판은 건너뛴다', () => {
  const cand = join(dir, 'a')
  const board = (n, picked, extra = {}, held = null) => {
    mkdirSync(join(cand, '09-revise', String(n), 'before'), { recursive: true })
    writeJ(join(cand, '09-revise', String(n), 'board.json'), { index: n, picked, ...extra })
    if (held) writeJ(join(cand, '09-revise', String(n), 'before', '01-direction.json'), held)
  }
  assert.equal(previousCandidate(cand), null, '판이 없다')
  board(1, { id: 'v1', seq: 1 }, {}, { inputHash: 'h', data: { recipe: 'r-first' } })
  board(2, { id: 'v2', seq: 2 }, {}, { inputHash: 'h', data: { recipe: 'r-second' } })
  board(3, { id: 'v1', seq: 3 }, {}, null) // 구획 판 — 방향 파일 없음
  board(4, { id: 'none' }, {}, { inputHash: 'h', data: { recipe: 'r-none' } })
  board(5, { id: 'v1', seq: 4 }, { undone: 't' }, { inputHash: 'h', data: { recipe: 'r-undone' } })
  board(6, null, {}, { inputHash: 'h', data: { recipe: 'r-open' } }) // 아직 안 고른 판
  assert.deepEqual(previousCandidate(cand), { recipe: 'r-second' })
  board(7, { id: 'v1', seq: 5 }, {}, { recipe: 'r-plain' }) // 래퍼 없는 옛 파일
  assert.deepEqual(previousCandidate(cand), { recipe: 'r-plain' })
})

test('낡은 판 막기는 갈래를 가리지 않는다: 구획을 고른 뒤 그 전에 만든 문구 판은 낡은 판이다 — 아무것도 바꾸지 않는다', async () => {
  const run = fixtureRevisionRun({ scope: 'section' })
  const board = readJ(run.boardFile)
  const texts = { 'home/hero/subhead': '반죽부터 직접 만들어요' }
  const copy = { ...board, index: 2, scope: 'copy', target: 'home/hero', before: { texts: {}, blockers: [] }, variants: [{ id: 'v1', label: 'v1 문구', texts, diff: { kind: 'copy', key: 'home/hero', before: {}, after: texts, sections: ['home/hero'], files: [] }, blockers: [], weight: 1, qa: null, siteRel: board.variants[0].siteRel, previewUrl: null }] }
  mkdirSync(join(run.cand, '09-revise', '2'), { recursive: true })
  writeJ(join(run.cand, '09-revise', '2', 'board.json'), copy) // 구획 판과 같은 상태에서 만든 문구 판(상태 해시가 같다)
  await applyRevision(run.dir, 'a', 1, 'v1', opts())
  const afterSection = prints(run.cand)
  const r = await applyRevision(run.dir, 'a', 2, 'v1', opts())
  assert.equal(r.outdated, true)
  assert.deepEqual(prints(run.cand), afterSection, '아무것도 안 바뀌었다')
  assert.equal(readJ(join(run.cand, '09-revise', '2', 'board.json')).picked, null)
})

test('hasAppliedRevision: 적용한 뒤 되돌리지 않은 판이면 갈래를 가리지 않고 센다 · 고르지 않은 판(none)·되돌린 판은 세지 않는다', async () => {
  for (const scope of ['copy', 'section', 'design']) {
    const run = fixtureRevisionRun({ scope })
    assert.equal(hasAppliedRevision(run.cand), false, `${scope}: 아직 안 골랐다`)
    await applyRevision(run.dir, 'a', run.index, run.variant, opts())
    assert.equal(hasAppliedRevision(run.cand), true, scope)
    undoLast(run.dir, 'a')
    assert.equal(hasAppliedRevision(run.cand), false, `${scope}: 되돌렸다`)
  }
  const none = fixtureRevisionRun({ scope: 'copy' })
  pickNone(none.dir, 'a', none.index)
  assert.equal(hasAppliedRevision(none.cand), false)
})
