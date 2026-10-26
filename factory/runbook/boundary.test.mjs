// 런북 경계 시험(계획 5 Task 14) — import 그래프를 읽어 모듈 경계를 지킨다.
//   ① factory/ 의 다른 모듈은 factory/runbook/ 에서 index.mjs 만 import 한다.
//   ② deliver.mjs 는 index.mjs 의 recordDelivery 만 쓴다.
//   ③ runbook 안: plan · beginner · record 는 서로를 부르지 않는다(묶는 것은 index.mjs 하나), CLI(runbook.mjs)는 index.mjs 만.
//   모양 잠금: 환경에 실제 LF 생성 파일이 있으면 그것으로 openRunbook 을 한 번 연다(없으면 건너뜀).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { openRunbook } from './index.mjs'
import { makeRun } from './fixtures/fake-lf.mjs'

const RUNBOOK = import.meta.dirname
const FACTORY = resolve(RUNBOOK, '..')
const WF_ROOT = resolve(FACTORY, '..')
const SOURCE = /\.(?:mjs|cjs|js|mts|ts|tsx)$/
// 정적 import · export … from · 동적 import('…') · require('…') 의 지정자.
const SPECIFIER = /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g

function* sources(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* sources(p)
    else if (SOURCE.test(e.name)) yield p
  }
}

/** 파일의 상대 import 를 절대 경로로. */
const importsOf = (file) => [...readFileSync(file, 'utf8').matchAll(SPECIFIER)]
  .map((m) => m[1])
  .filter((s) => s.startsWith('.'))
  .map((s) => resolve(dirname(file), s))

const inRunbook = (p) => p === RUNBOOK || p.startsWith(RUNBOOK + sep)

test('the import scanner sees static, re-export, dynamic and require forms (negative control)', () => {
  const text = "import a from './x.mjs'\nimport { b } from \"../y.mjs\"\nexport * from './z.mjs'\nconst c = await import('./w.mjs')\nrequire('./v.cjs')\n"
  assert.deepEqual([...text.matchAll(SPECIFIER)].map((m) => m[1]), ['./x.mjs', '../y.mjs', './z.mjs', './w.mjs', './v.cjs'])
})

test('outside factory/runbook, only factory/runbook/index.mjs is imported', () => {
  const bad = []
  let seen = 0
  for (const file of sources(FACTORY)) {
    if (inRunbook(file)) continue
    for (const target of importsOf(file)) {
      if (!inRunbook(target)) continue
      seen++
      if (target !== join(RUNBOOK, 'index.mjs')) bad.push(`${relative(WF_ROOT, file)} → ${relative(WF_ROOT, target)}`)
    }
  }
  assert.deepEqual(bad, [])
  assert.ok(seen >= 1, 'deliver.mjs 의 import 를 찾아야 한다(스캐너가 도는지)')
})

test('deliver.mjs uses only recordDelivery from the runbook', () => {
  const text = readFileSync(join(FACTORY, 'stamp', 'deliver.mjs'), 'utf8')
  const lines = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*runbook[^'"]*)['"]/g)]
  assert.equal(lines.length, 1)
  assert.equal(resolve(FACTORY, 'stamp', lines[0][2]), join(RUNBOOK, 'index.mjs'))
  assert.deepEqual(lines[0][1].split(',').map((s) => s.trim()).filter(Boolean), ['recordDelivery'])
})

test('inside factory/runbook: plan, beginner and record do not import each other; the CLI imports only index.mjs', () => {
  const siblings = (name) => importsOf(join(RUNBOOK, name)).filter(inRunbook).map((p) => relative(RUNBOOK, p))
  for (const name of ['plan.mjs', 'beginner.mjs', 'record.mjs']) assert.deepEqual(siblings(name), [], name)
  assert.deepEqual(siblings('runbook.mjs'), ['index.mjs'])
})

// 모양 잠금 — LF_DIR 또는 형제 ../launch-factory 의 실제 생성 파일.
const realLf = [process.env.LF_DIR, join(WF_ROOT, '..', 'launch-factory')]
  .filter(Boolean)
  .find((d) => existsSync(join(d, 'docs', 'runbook', 'runbook.generated.json')) && existsSync(join(d, 'features', 'outcomes.generated.json')))

test('shape lock: the real launch-factory runbook data opens, plans every feature and prints the expert text', (t) => {
  if (!realLf) {
    t.skip('no launch-factory with docs/runbook/runbook.generated.json (LF_DIR or ../launch-factory) — shape lock skipped')
    return
  }
  const data = JSON.parse(readFileSync(join(realLf, 'docs', 'runbook', 'runbook.generated.json'), 'utf8'))
  const root = mkdtempSync(join(tmpdir(), 'runbook-shape-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const run = makeRun(root, {
    version: 1, applied: Object.keys(data.outcomes), unapplied: [], completion: 'composed', locale: 'ko',
    tableHash: data.outcomesHash, deliveredAt: '2026-10-20T00:00:00.000Z',
  })
  const rb = openRunbook({ run, lf: realLf, today: '2026-10-22', now: '2026-10-22T00:00:00.000Z', env: {} })
  rb.answerDoor('yes')
  const o = rb.overview()
  assert.equal(o.ask, undefined)
  assert.equal(typeof o.text, 'string')
  assert.ok(Array.isArray(o.plan.chapters) && Array.isArray(o.plan.missing))
  for (const g of o.plan.chapters) assert.ok(data.chapters[g], g)
  assert.equal(typeof rb.chapter('all', 'expert').text, 'string')
  t.diagnostic(`shape lock: ${realLf} — chapters ${o.plan.chapters.join(', ') || '(none)'} · missing ${o.plan.missing.length}`)
})
