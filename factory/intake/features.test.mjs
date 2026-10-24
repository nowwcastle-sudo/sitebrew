// 기능 질문·features.json·경로 해석기 시험. 표는 launch-factory 생성본 사본(fixtures/outcomes.sample.json)을 쓴다.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ARCHETYPE_IDS } from '../scripts/archetypes.mjs'
import { ARCHETYPE_IDS as BRIEF_ARCHETYPE_IDS } from '../stamp/brief.mjs'
import { describeFeatures, featureQuestionsFor, isProduct, loadOutcomes, readFeatures, toFeatures, writeFeatures } from './features.mjs'
import { resolveLf } from './resolve-lf.mjs'

const SAMPLE = new URL('./fixtures/outcomes.sample.json', import.meta.url)
const table = JSON.parse(readFileSync(SAMPLE, 'utf8'))
const ids = (q) => q.map((x) => x.id)
const tmp = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'wf-features-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}
const LOOP = { signup: ['가입'], payments: ['결제'], inquiry: ['문의'] }
const putTable = (lf, body) => {
  mkdirSync(join(lf, 'features'), { recursive: true })
  writeFileSync(join(lf, 'features', 'outcomes.generated.json'), typeof body === 'string' ? body : JSON.stringify(body))
}

test('saas 질문 = signup, payments, inquiry, marketing, analytics', () => {
  assert.deepEqual(ids(featureQuestionsFor('saas', table, { limit: 6 })), ['signup', 'payments', 'inquiry', 'marketing', 'analytics'])
})

test('질문은 { id, ko, en } 이고 문장은 표에서 온다', () => {
  const [q] = featureQuestionsFor('saas', table, { limit: 6 })
  assert.deepEqual(q, { id: 'signup', ko: table.outcomes[0].question.ko, en: table.outcomes[0].question.en })
})

test('landing 에 payments 있음, dashboard 에 inquiry 없음', () => {
  assert.ok(ids(featureQuestionsFor('landing', table, { limit: 6 })).includes('payments'))
  assert.ok(!ids(featureQuestionsFor('dashboard', table, { limit: 6 })).includes('inquiry'))
})

test('limit 3 → 앞 3개', () => {
  assert.deepEqual(ids(featureQuestionsFor('saas', table, { limit: 3 })), ['signup', 'payments', 'inquiry'])
})

test('toFeatures({payments:true}) 는 requires 를 닫고 표 order 로 정렬한다 — signup, payments', () => {
  const f = toFeatures({ payments: true }, table)
  assert.deepEqual(f, { version: 1, table: table.hash, outcomes: ['signup', 'payments'] })
})

test('false 답은 켜지 않는다', () => {
  assert.deepEqual(toFeatures({ signup: false, inquiry: true }, table).outcomes, ['inquiry'])
})

test('toFeatures: 표에 없는 답 키는 던진다', () => {
  assert.throws(() => toFeatures({ nope: true }, table), /unknown answer key: nope/)
})

test('toFeatures: requires 가 표에 없는 id 를 가리키면 던진다', () => {
  const bad = { ...table, outcomes: table.outcomes.map((o) => (o.id === 'payments' ? { ...o, requires: ['ghost'] } : o)) }
  assert.throws(() => toFeatures({ payments: true }, bad), /unknown outcome id in requires: ghost/)
})

test('describeFeatures: {inquiry} product false, {signup} product true', () => {
  assert.equal(describeFeatures(toFeatures({ inquiry: true }, table), table, { loopSteps: LOOP }).product, false)
  assert.equal(describeFeatures(toFeatures({ signup: true }, table), table, { loopSteps: LOOP }).product, true)
})

test('describeFeatures: needs·guides 는 정렬된 합집합, loop 는 표 order 를 따른다', () => {
  const d = describeFeatures(toFeatures({ payments: true, analytics: true }, table), table, { loopSteps: LOOP })
  assert.deepEqual(d.loop, ['signup', 'payments'])
  assert.deepEqual(d.outcomes.map((o) => o.id), ['signup', 'payments', 'analytics'])
  assert.deepEqual(d.guides, [...d.guides].sort())
  assert.ok(d.guides.includes('G-billing') && d.guides.includes('G-auth'))
  assert.ok(d.needs.includes('BETTER_AUTH_SECRET'))
})

test('saas + 전부 아니요 → 소개형(features.json 이 completion 보다 앞선다)', () => {
  assert.equal(isProduct(toFeatures({ signup: false, payments: false }, table), table), false)
})

test('landing + 가입 예 → 제품형', () => {
  assert.equal(isProduct(toFeatures({ signup: true }, table), table), true)
})

test('features.json 없음·hash 불일치 → null(원형 completion 그대로)', () => {
  assert.equal(isProduct(null, table), null)
  assert.equal(isProduct({ ...toFeatures({ signup: true }, table), table: 'other' }, table), null)
})

test('writeFeatures / readFeatures 왕복, 없는 폴더·파일은 null', (t) => {
  const dir = tmp(t)
  const f = toFeatures({ signup: true }, table)
  writeFeatures(dir, f)
  assert.deepEqual(readFeatures(dir), f)
  assert.equal(readFeatures(join(dir, 'nope')), null)
  assert.equal(readFeatures(tmp(t)), null)
})

test('readFeatures: 깨진 JSON·모양 틀림은 파일 경로를 붙여 던진다', (t) => {
  const dir = tmp(t)
  const file = join(dir, 'features.json')
  writeFileSync(file, '{ not json')
  assert.throws(() => readFeatures(dir), (e) => e.message.includes(file))
  for (const bad of [{ version: 2, table: 'x', outcomes: [] }, { version: 1, table: 5, outcomes: [] }, { version: 1, table: 'x', outcomes: [1] }, { version: 1, table: 'x' }]) {
    writeFileSync(file, JSON.stringify(bad))
    assert.throws(() => readFeatures(dir), (e) => e.message.includes(file), JSON.stringify(bad))
  }
})

test('loadOutcomes: version 2 → 던짐(로그에 TableVersionError 이름), 표가 정상이면 읽는다', (t) => {
  const lf = tmp(t)
  putTable(lf, { ...table, version: 2 })
  assert.throws(() => loadOutcomes(lf), { name: 'TableVersionError', message: /outcomes\.generated\.json/ })
  putTable(lf, table)
  assert.equal(loadOutcomes(lf).hash, table.hash)
})

test('loadOutcomes: 결과 말(say)을 지우지 않는다', (t) => {
  const lf = tmp(t)
  putTable(lf, table)
  assert.equal(loadOutcomes(lf).outcomes[0].say.ko, table.outcomes[0].say.ko)
})

test('loadOutcomes: 표의 모든 칸(closure·needs·guides·쪽·API 소유표)을 그대로 돌려준다 — 얹기 엔진이 읽는 칸이다', (t) => {
  const lf = tmp(t)
  putTable(lf, { ...table, newField: 1 })
  const got = loadOutcomes(lf)
  assert.deepEqual(got.outcomes, table.outcomes, '칸을 빠뜨리거나 지우지 않는다(closure 가 빠져 얹기가 던졌다)')
  assert.ok(got.outcomes.some((o) => o.closure.length > 0), '시험 표에 closure 가 든 결과가 있다')
  assert.deepEqual(got.pages, table.pages)
  assert.deepEqual(got.routes, table.routes)
  assert.equal(got.newField, 1, '모르는 새 칸도 지우지 않는다')
})

test('loadOutcomes: 모양이 틀린 표·깨진 JSON 은 파일 경로를 붙여 던진다', (t) => {
  const lf = tmp(t)
  const file = join(lf, 'features', 'outcomes.generated.json')
  putTable(lf, '{ not json')
  assert.throws(() => loadOutcomes(lf), (e) => e.message.includes(file))
  putTable(lf, { ...table, outcomes: [{ id: 'x' }] })
  assert.throws(() => loadOutcomes(lf), (e) => e.message.includes(file))
  putTable(lf, { ...table, hash: undefined })
  assert.throws(() => loadOutcomes(lf), (e) => e.message.includes(file))
})

// ── resolveLf: 임시 폴더로 두 배치 ───────────────────────────────────────────
const makeLf = (dir) => {
  putTable(dir, '{}')
  return dir
}

test('resolveLf 순서: 인자 > LF_DIR > <wfRoot>/launch-factory > 형제, 넷 다 없으면 null', (t) => {
  const base = tmp(t)
  const wfRoot = join(base, 'web-factory')
  mkdirSync(wfRoot)
  assert.equal(resolveLf({ env: {}, wfRoot }), null)
  const sibling = makeLf(join(base, 'launch-factory'))
  assert.equal(resolveLf({ env: {}, wfRoot }), sibling)
  const inside = makeLf(join(wfRoot, 'launch-factory'))
  assert.equal(resolveLf({ env: {}, wfRoot }), inside)
  const envDir = makeLf(join(base, 'from-env'))
  assert.equal(resolveLf({ env: { LF_DIR: envDir }, wfRoot }), envDir)
  const argDir = makeLf(join(base, 'from-arg'))
  assert.equal(resolveLf({ arg: argDir, env: { LF_DIR: envDir }, wfRoot }), argDir)
})

test('resolveLf: 표 파일이 없는 후보는 채택하지 않는다', (t) => {
  const base = tmp(t)
  const wfRoot = join(base, 'web-factory')
  mkdirSync(join(wfRoot, 'launch-factory'), { recursive: true })
  const sibling = makeLf(join(base, 'launch-factory'))
  assert.equal(resolveLf({ arg: join(base, 'none'), env: { LF_DIR: join(base, 'none2') }, wfRoot }), sibling)
})

// ── 동기 시험 ────────────────────────────────────────────────────────────────
test('fixture 의 archetypes ⊆ ARCHETYPE_IDS (archetypes.mjs 폴더 기준, brief.mjs 목록 모두)', () => {
  for (const list of [ARCHETYPE_IDS, BRIEF_ARCHETYPE_IDS]) {
    const known = new Set(list)
    for (const o of table.outcomes) for (const a of o.archetypes) assert.ok(known.has(a), `${o.id}: ${a}`)
  }
})

const LF = process.env.LF_DIR
test('fixture == loadOutcomes(LF_DIR) 의 id·order', { skip: LF ? false : 'LF_DIR 없음 — 건너뜀' }, () => {
  const pick = (t) => t.outcomes.map((o) => [o.id, o.order])
  assert.deepEqual(pick(table), pick(loadOutcomes(LF)))
})
