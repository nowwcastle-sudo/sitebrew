// holdout 격리 검사의 순수 부분 — 어휘집과 holdout 이 한 커밋에서 함께 바뀌면 실패한다(빠른 시험, git 불필요).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEXICON_SIDE, guard, guardCommits, main } from '../../ci/vocab-holdout-guard.mjs'

const LEX = 'factory/vocab/design-lexicon.yaml'
const GRAMMAR = 'factory/vocab/grammar.yaml'
const HOLD = 'factory/vocab/eval/holdout.jsonl'

test('어휘집과 holdout 이 함께 바뀌면 실패한다', () => {
  const r = guard([LEX, HOLD, 'README.md'])
  assert.equal(r.ok, false)
  assert.ok(r.reason && r.reason.length > 0)
})
test('말본 데이터(grammar.yaml)도 어휘집 쪽이라 holdout 과 함께 바뀌면 실패한다 · 이유에 그 파일이 나온다', () => {
  const r = guard([GRAMMAR, HOLD])
  assert.equal(r.ok, false)
  assert.match(r.reason, /grammar\.yaml/)
  assert.doesNotMatch(r.reason, /design-lexicon/)
  assert.deepEqual(LEXICON_SIDE, [LEX, GRAMMAR])
})
test('어휘집만 바뀌면 통과한다', () => assert.deepEqual(guard([LEX, 'a.mjs']), { ok: true }))
test('holdout 만 바뀌면 통과한다', () => assert.deepEqual(guard([HOLD]), { ok: true }))
test('빈 목록은 통과한다', () => assert.deepEqual(guard([]), { ok: true }))
test('Windows 식 경로 구분자도 같은 파일로 본다', () => assert.equal(guard(['factory\\vocab\\design-lexicon.yaml', 'factory\\vocab\\eval\\holdout.jsonl']).ok, false))
test('따로 커밋한 어휘집과 holdout 은 통과한다', () => assert.deepEqual(guardCommits([{ sha: 'a1', files: [LEX] }, { sha: 'b2', files: [HOLD] }, { sha: 'c3', files: [LEX] }]), { ok: true }))
test('한 커밋이 둘을 함께 바꾸면 그 커밋 이름과 함께 실패한다', () => {
  const r = guardCommits([{ sha: 'a1', files: [LEX] }, { sha: 'b2', files: [LEX, HOLD] }])
  assert.equal(r.ok, false)
  assert.match(r.reason, /^b2: /)
})

// ---- main(): git 을 가짜로 끼워 기준 고르기를 확인한다 ----
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' })
const fail = { status: 1, stdout: '', stderr: 'boom' }
/** refs = 풀리는 기준, ranges = 기준 → 커밋 목록, files = 커밋 → 바뀐 파일 */
function fakeGit({ refs, ranges, files = {} }) {
  return (args) => {
    if (args[0] === 'rev-parse') return refs.some((r) => args.at(-1).startsWith(`${r}^`)) ? ok() : fail
    if (args[0] === 'rev-list') return ok((ranges[args[1].split('..')[0]] ?? []).join('\n'))
    return ok((files[args.at(-1)] ?? []).join('\n')) // diff-tree
  }
}
const run = (git) => {
  const out = { log: [], err: [] }
  const code = main({ log: (s) => out.log.push(s), err: (s) => out.err.push(s), git })
  return { code, ...out }
}

test('main: origin/main..HEAD 에 커밋이 있으면 그 범위를 본다', () => {
  const r = run(fakeGit({ refs: ['origin/main', 'HEAD~1'], ranges: { 'origin/main': ['a1', 'b2'], 'HEAD~1': ['b2'] }, files: { a1: [LEX], b2: [HOLD] } }))
  assert.equal(r.code, 0)
  assert.match(r.log.at(-1), /기준 origin\/main, 커밋 2개/)
})

test('main: main 에서 직접 작업해 origin/main..HEAD 가 비면 HEAD~1..HEAD 로 넘어가 검사한다(빈 범위로 통과하지 않는다)', () => {
  const r = run(fakeGit({ refs: ['origin/main', 'HEAD~1'], ranges: { 'origin/main': [], 'HEAD~1': ['c3'] }, files: { c3: [GRAMMAR, HOLD] } }))
  assert.equal(r.code, 1)
  assert.match(r.err.join(), /^✖ c3: .*grammar\.yaml/)
  const clean = run(fakeGit({ refs: ['origin/main', 'HEAD~1'], ranges: { 'origin/main': [], 'HEAD~1': ['c3'] }, files: { c3: [LEX] } }))
  assert.equal(clean.code, 0)
  assert.match(clean.log.at(-1), /기준 HEAD~1, 커밋 1개/)
})

test('main: 기준이 하나도 안 풀리거나 모든 범위가 비면 통과가 아니라 건너뜀이라고 말한다', () => {
  assert.match(run(fakeGit({ refs: [], ranges: {} })).log.join(), /SKIP.*얕은 복제/)
  const empty = run(fakeGit({ refs: ['origin/main'], ranges: { 'origin/main': [] } }))
  assert.equal(empty.code, 0)
  assert.match(empty.log.join(), /SKIP.*볼 커밋이 없다/)
})

test('main: git 이 실패하면 1', () => {
  assert.equal(run((args) => (args[0] === 'rev-list' ? fail : ok())).code, 1)
  assert.equal(run((args) => (args[0] === 'diff-tree' ? fail : ok(args[0] === 'rev-list' ? 'a1' : ''))).code, 1)
})
