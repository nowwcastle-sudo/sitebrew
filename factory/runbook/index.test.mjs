// index.mjs 시험 — 문 강제·선택의 출처·키트 오류를 객체로 본다(CLI 종료 코드는 runbook.test.mjs).
// 고정물: 임시 LF(작은 결과 표 + 런북 고정물) · 임시 실행/사용자 폴더. 시각은 인자로 준다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DoorClosed, openRunbook, RunbookArgError, RunbookToolError } from './index.mjs'
import { DATA, delivered, fakeKey, makeLf, makeRun, table, TODAY } from './fixtures/fake-lf.mjs'

const NOW = '2026-10-22T03:00:00.000Z'
const NO_ENV = {}

function setup(t, { d = delivered(), lfOver } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'runbook-index-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const lf = makeLf(root, lfOver)
  const run = makeRun(root, d)
  const open = (over = {}) => openRunbook({ run, lf, today: TODAY, now: NOW, env: NO_ENV, wfRoot: root, ...over })
  return { root, lf, run, open }
}

test('door: ask → closed body → yes → use; a second object on the same run (other folder) is not asked again', (t) => {
  const { root, run, open } = setup(t)
  const rb = open()
  assert.equal(rb.door(), 'ask')
  for (const call of [() => rb.overview(), () => rb.chapter('all'), () => rb.check('G-auth', ''), () => rb.alternatives('G-email'), () => rb.mark({ level: 'expert' })]) {
    assert.throws(call, DoorClosed)
  }
  assert.equal(rb.answerDoor('unsure'), 'skip')
  assert.throws(() => rb.overview(), (e) => e instanceof DoorClosed && e.door === 'skip')
  assert.equal(rb.answerDoor('yes'), 'use')
  assert.ok(existsSync(join(run, '.sitebrew', 'runbook.json')), '문은 실행 폴더에 남는다')

  const other = join(root, 'other-folder')
  mkdirSync(other)
  const again = open({ site: other })
  assert.equal(again.door(), 'use')
  assert.ok(!again.overview().ask)
  assert.throws(() => rb.answerDoor('maybe'), RunbookArgError)
})

test('door with nowhere to store: kept in memory for the object only, nothing created', (t) => {
  const { root, lf } = setup(t)
  const site = join(root, 'old-site')
  mkdirSync(site)
  const open = () => openRunbook({ site, lf, today: TODAY, now: NOW, env: NO_ENV, wfRoot: root })
  const rb = open()
  assert.equal(rb.canStore(), false)
  assert.equal(rb.answerDoor('yes'), 'use')
  assert.equal(rb.door(), 'use')
  assert.equal(rb.mark({ level: 'beginner' }).saved, false)
  assert.equal(existsSync(join(site, '.sitebrew')), false)
  assert.equal(open().door(), 'ask')
})

test('selection: no record → ask(noRecord) with the data questions; told features close over requires and are used', (t) => {
  const { root, lf } = setup(t)
  const run = makeRun(root, undefined, 'old-run')
  const rb = openRunbook({ run, lf, today: TODAY, now: NOW, env: NO_ENV, wfRoot: root })
  rb.answerDoor('yes')
  const r = rb.overview()
  assert.equal(r.ask.why, 'noRecord')
  assert.deepEqual(r.ask.questions.map((q) => q.id), ['signup', 'payments', 'push'])
  assert.deepEqual(r.ask.questions[0], { id: 'signup', ...DATA.outcomes.signup.question })

  assert.deepEqual(rb.answerFeatures(['payments']).features, ['signup', 'payments'])
  const o = rb.overview()
  assert.ok(o.plan.chapters.includes('G-auth') && o.plan.chapters.includes('G-billing'), 'requires 로 signup 장도 든다')
  assert.equal(o.plan.site, 'composed', '기록이 없으면 표의 product 로 완성 방식을 정한다')
  assert.match(o.text, /\|/)
  assert.ok(!o.text.includes(DATA.chapters['G-auth'].text.ko.body), '개요에는 장 본문이 없다')
  assert.throws(() => rb.answerFeatures(['intro-site']), RunbookArgError)
})

test('selection: applied:null → unknownChoice; delivered table hash differs → tableChanged; an old told answer is not trusted', (t) => {
  for (const [d, why] of [[delivered({ applied: null, tableHash: null }), 'unknownChoice'], [delivered({ tableHash: 'other0001' }), 'tableChanged']]) {
    const { open } = setup(t, { d })
    const rb = open()
    rb.answerDoor('yes')
    assert.equal(rb.overview().ask.why, why)
  }
  const { run, lf, root } = setup(t, { d: delivered({ tableHash: 'other0001' }) })
  const rb = openRunbook({ run, lf, today: TODAY, now: NOW, env: NO_ENV, wfRoot: root })
  rb.answerDoor('yes')
  rb.answerFeatures(['signup'])
  assert.ok(!rb.overview().ask, '지금 표로 답하면 쓴다')
  const newer = { ...DATA, outcomesHash: 'fixture0002' }
  const lf2 = makeLf(join(root, 'next'), { data: newer, table: table({ hash: 'fixture0002' }) })
  const later = openRunbook({ run, lf: lf2, today: TODAY, now: NOW, env: NO_ENV, wfRoot: root })
  assert.equal(later.overview().ask.why, 'tableChanged', '다른 표로 받은 답은 다시 묻는다')
})

test('kit errors are RunbookToolError(noData|badVersion|hashMismatch) from body methods; the door still works without LF', (t) => {
  const { root, run } = setup(t)
  const cases = [
    ['noData', { lf: join(root, 'nowhere') }],
    ['noData', { lf: makeLf(join(root, 'empty'), { noData: true }) }],
    ['badVersion', { lf: makeLf(join(root, 'v2'), { data: { ...DATA, version: 2 } }) }],
    ['badVersion', { lf: makeLf(join(root, 't2'), { table: table({ version: 2 }) }) }],
    ['hashMismatch', { lf: makeLf(join(root, 'hm'), { table: table({ hash: 'fixture0009' }) }) }],
  ]
  for (const [code, over] of cases) {
    const rb = openRunbook({ run, today: TODAY, now: NOW, env: NO_ENV, wfRoot: join(root, 'no-wf'), ...over })
    rb.answerDoor('yes')
    assert.throws(() => rb.overview(), (e) => e instanceof RunbookToolError && e.code === code && /next:/.test(e.message), code)
  }
})

test('state: later writes in one object win (done → doing); asked alternatives are recorded', (t) => {
  const { run, open } = setup(t)
  const rb = open()
  rb.answerDoor('yes')
  rb.mark({ gid: 'G-auth', status: 'done' })
  rb.mark({ gid: 'G-auth', status: 'doing' })
  assert.equal(open().overview().progress['G-auth'], 'doing')
  assert.equal(rb.alternatives('G-email').options.length, 3)
  const saved = JSON.parse(readFileSync(join(run, '.sitebrew', 'runbook.json'), 'utf8'))
  assert.deepEqual(Object.keys(saved.alternatives), ['email'])
  assert.throws(() => rb.mark({ gid: fakeKey(), status: 'done' }), (e) => e instanceof RunbookArgError && !e.message.includes(fakeKey()))
})

test('check: a pasted key is reported as secret-shape and never echoed in any problem', (t) => {
  const { open } = setup(t)
  const rb = open()
  rb.answerDoor('yes')
  const key = fakeKey()
  const problems = rb.check('G-auth', `1. 「${key}」 를 넣어요.\n2. ${key}\n`)
  assert.ok(problems.some((p) => p.rule === 'secret-shape'))
  assert.ok(problems.every((p) => typeof p.text === 'string' && p.text.length > 0))
  assert.ok(!JSON.stringify(problems).includes(key))
  assert.equal(rb.redact(`a ${key} b`).includes(key), false)
})

test('language: --lang wins, else delivered.locale; an English chapter that is empty is missing, not hidden', (t) => {
  const { open } = setup(t, { d: delivered({ locale: 'en' }) })
  const rb = open()
  rb.answerDoor('yes')
  const en = rb.overview().plan
  assert.equal(en.lang, 'en')
  assert.ok(en.missing.some((m) => m.gid === 'G-db' && m.why === 'noText'))
  assert.equal(open({ lang: 'ko' }).overview().plan.lang, 'ko')
})
