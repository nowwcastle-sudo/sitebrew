// runbook.mjs(CLI) 시험 — 진짜 명령을 자식 프로세스로 돌려 종료 코드·표준출력 JSON 하나·키 모양 없음을 본다.
// 고정물: 임시 LF(작은 결과 표 + 런북 고정물) · 임시 실행/사용자 폴더. --lf·--today 를 늘 준다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DATA, delivered, fakeKey, makeLf, makeRun, table, TODAY } from './fixtures/fake-lf.mjs'
import { recordDelivery } from './index.mjs'
import { writeFeatures } from '../intake/features.mjs'
import { createRecord } from './record.mjs'

const CLI = join(import.meta.dirname, 'runbook.mjs')
const KEY = fakeKey()

function setup(t, d = delivered()) {
  const root = mkdtempSync(join(tmpdir(), 'runbook-cli-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const lf = makeLf(root)
  const run = makeRun(root, d)
  /** 명령 하나 — 표준출력이 JSON 하나인지, 어떤 출력에도 키 모양이 없는지 늘 본다. */
  const cli = (args, { at = ['--run', run], lfDir = lf } = {}) => {
    const r = spawnSync(process.execPath, [CLI, ...args, ...at, '--lf', lfDir, '--today', TODAY], { encoding: 'utf8', env: { ...process.env, LF_DIR: '' } })
    assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY), 'no key-shaped string in any output')
    return { code: r.status, json: JSON.parse(r.stdout), stderr: r.stderr }
  }
  return { root, lf, run, cli }
}

const koAuth = () => [
  '로그인 장이에요. 환경 변수는 사이트가 읽는 비밀 메모예요. 돈은 들지 않아요.',
  '',
  '1. 외부 계정은 필요 없어요. 바로 다음 단계로 가요.',
  '2. 길고 무작위인 비밀 문자열을 만들어요. 값은 채팅에 붙이지 않아요.',
  '3. 호스팅 대시보드의 「설정」 메뉴에서 `BETTER_AUTH_SECRET` 이름으로 넣어요. 저장하면 목록에 이름이 보여요.',
  '4. 가입한 뒤 로그인해요. 로그인이 되면 끝이에요.',
  '',
  '로그인 직후 풀리면 `NEXT_PUBLIC_APP_URL` 이 실제 주소인지 봐요. 출처는 example-auth.com 이에요.',
  DATA.rubric.helpLine.ko,
  DATA.rubric.closing.ko,
].join('\n')

test('CLI: 검증된 토스 시험 전달만 시험 장을 쓰며 사이트별 기록과 기본 결제 장을 분리한다', (t) => {
  const { root, run, cli } = setup(t)
  const site = join(root, 'toss-site')
  mkdirSync(join(site, 'lib'), { recursive: true })
  writeFileSync(join(site, 'lib', 'toss-test-config.ts'), 'const TOSS_COMPOSE_ENABLED = true\n')
  writeFeatures(run, { version: 1, table: DATA.outcomesHash, outcomes: ['signup', 'payments'], billingProvider: 'toss-test' })
  recordDelivery({ run, dest: site }, delivered())
  const at = { at: ['--site', site, '--run', run] }
  cli(['gate', '--answer', 'yes'], at)
  for (const args of [['open'], ['chapter', 'G-billing', '--level', 'expert'], ['chapter', 'G-billing', '--level', 'beginner'], ['chapter', 'all', '--level', 'expert'], ['alternatives', 'G-billing']]) {
    const result = cli(args, at)
    assert.equal(result.code, 0, result.stderr)
    const text = JSON.stringify(result.json)
    assert.match(text, /토스페이먼츠/)
    assert.doesNotMatch(text, /PADDLE|Paddle|paddle|웹훅/)
    if (args[0] === 'chapter') assert.match(text, /실결제|실제 결제/)
  }
  const en = cli(['chapter', 'G-billing', '--level', 'expert', '--lang', 'en'], at)
  assert.equal(en.code, 0, en.stderr)
  assert.match(en.json.text, /does not support real payments/)
  assert.match(en.json.text, /LF_TOSS_TEST_FAKE/)
  assert.doesNotMatch(en.json.text, /Paddle|PADDLE|webhook/i)
  assert.match(cli(['chapter', 'G-auth', '--level', 'expert'], at).json.text, /BETTER_AUTH_SECRET/)

  const other = join(root, 'other-site')
  mkdirSync(other)
  recordDelivery({ dest: other }, delivered())
  const otherAt = { at: ['--site', other, '--run', run] }
  assert.match(cli(['chapter', 'G-billing', '--level', 'expert'], otherAt).json.text, /PADDLE_API_KEY/)
  const missing = join(root, 'missing-site')
  mkdirSync(missing)
  const unknown = cli(['open'], { at: ['--site', missing, '--run', run] })
  assert.equal(unknown.code, 3)
  assert.equal(unknown.json.ask.why, 'unknownChoice')
  const legacy = join(root, 'legacy-toss')
  mkdirSync(join(legacy, 'lib'), { recursive: true })
  writeFileSync(join(legacy, 'lib', 'toss-test-config.ts'), 'const TOSS_COMPOSE_ENABLED = true\n')
  recordDelivery({ dest: legacy }, delivered())
  const unrecorded = cli(['chapter', 'G-billing'], { at: ['--site', legacy, '--run', run] })
  assert.equal(unrecorded.code, 0)
  assert.match(unrecorded.json.text, /토스페이먼츠 시험 전용/)
  assert.doesNotMatch(unrecorded.json.text, /PADDLE|Paddle/)
})

test('토스 사이트의 전달 기록 누락·손상·표 변경 후 일반 기능 재답은 토스 선택을 보존한다', (t) => {
  const { root, cli } = setup(t)
  for (const kind of ['missing', 'broken', 'stale']) {
    const site = join(root, `recover-${kind}`)
    mkdirSync(join(site, '.sitebrew'), { recursive: true })
    mkdirSync(join(site, 'lib'), { recursive: true })
    writeFileSync(join(site, 'lib', 'toss-test-config.ts'), 'const TOSS_COMPOSE_ENABLED = true\n')
    const file = join(site, '.sitebrew', 'delivered.json')
    if (kind === 'broken') writeFileSync(file, '{ broken')
    if (kind === 'stale') writeFileSync(file, JSON.stringify(delivered({ tableHash: 'oldhash', billingProvider: 'toss-test' })))
    const at = { at: ['--site', site] }
    assert.equal(cli(['gate', '--answer', 'yes'], at).code, 0)
    assert.equal(cli(['open'], at).code, 3, kind)
    const noPayment = cli(['open', '--features', 'signup'], at)
    assert.equal(noPayment.code, 2, kind)
    assert.doesNotMatch(JSON.stringify(noPayment), /PADDLE|Paddle/)
    const selected = cli(['open', '--features', 'payments'], at)
    assert.equal(selected.code, 0, selected.stderr)
    assert.match(selected.json.text, /토스페이먼츠/)
    const saved = JSON.parse(readFileSync(join(site, '.sitebrew', 'runbook.json'), 'utf8'))
    assert.equal(saved.features.value.billingProvider, 'toss-test')
    const result = cli(['chapter', 'G-billing', '--level', 'expert'], at)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.json.text, /토스페이먼츠 시험 전용/)
    assert.doesNotMatch(result.json.text, /PADDLE|Paddle|웹훅/)
  }
})

test('손상된 시험 표지와 배송 기록 불일치는 일반 결제 안내로 넘어가지 않는다', (t) => {
  const { root, cli } = setup(t)
  const site = join(root, 'invalid-marker')
  mkdirSync(join(site, 'lib'), { recursive: true })
  writeFileSync(join(site, 'lib', 'toss-test-config.ts'), 'const TOSS_COMPOSE_ENABLED = maybe\n')
  recordDelivery({ dest: site }, delivered())
  const at = { at: ['--site', site] }
  cli(['gate', '--answer', 'yes'], at)
  const bad = cli(['open', '--features', 'payments'], at)
  assert.equal(bad.code, 1)
  assert.equal(bad.json.code, 'providerUnknown')
  assert.doesNotMatch(JSON.stringify(bad), /PADDLE|Paddle/)
})

test('토스 전달 기록은 features·표·생성 설정이 일치할 때만 작성한다', (t) => {
  const { root, run } = setup(t)
  const site = join(root, 'site')
  mkdirSync(join(site, 'lib'), { recursive: true })
  const config = join(site, 'lib', 'toss-test-config.ts')
  const features = { version: 1, table: DATA.outcomesHash, outcomes: ['signup', 'payments'], billingProvider: 'toss-test' }
  writeFeatures(run, features)
  assert.throws(() => recordDelivery({ run, dest: site }, delivered()), /configuration/)
  writeFileSync(config, 'const TOSS_COMPOSE_ENABLED = false\n')
  assert.throws(() => recordDelivery({ run, dest: site }, delivered()), /does not enable/)
  writeFileSync(config, 'const TOSS_COMPOSE_ENABLED = true\n')
  assert.throws(() => recordDelivery({ run, dest: site }, delivered({ tableHash: 'other' })), /does not match/)
  assert.throws(() => recordDelivery({ run, dest: site }, delivered({ applied: ['payments'] })), /does not match/)
  writeFeatures(run, { version: 1, table: DATA.outcomesHash, outcomes: ['signup', 'payments'] })
  assert.throws(() => recordDelivery({ run, dest: site }, delivered({ billingProvider: 'toss-test' })), /validated feature selection/)
  writeFeatures(run, features)
  assert.equal(existsSync(join(site, '.sitebrew', 'delivered.json')), false)
  assert.equal(recordDelivery({ run, dest: site }, delivered()).saved, true)
})

test('저장된 runbook 선택도 토스 시험 장으로 읽되 다른 사이트의 상태는 신뢰하지 않는다', (t) => {
  const { root, cli } = setup(t)
  const run = makeRun(root, undefined, 'state-only')
  const record = createRecord()
  record.writeState({ run }, { door: 'use', features: { table: DATA.outcomesHash, outcomes: ['signup', 'payments'], billingProvider: 'toss-test' } }, '2026-10-22T00:00:00Z')
  const result = cli(['chapter', 'G-billing', '--level', 'expert'], { at: ['--run', run] })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.json.text, /토스페이먼츠 시험 전용/)
  assert.doesNotMatch(result.json.text, /PADDLE|Paddle/)
  const site = join(root, 'state-foreign-site')
  mkdirSync(join(site, '.sitebrew'), { recursive: true })
  const foreign = cli(['open'], { at: ['--site', site, '--run', run] })
  assert.equal(foreign.code, 3)
  assert.equal(foreign.json.ask.why, 'unknownChoice')
})

test('door: ask → body commands exit 5 → gate --answer yes → open/chapter work', (t) => {
  const { cli } = setup(t)
  assert.deepEqual(cli(['gate']), { code: 0, json: { door: 'ask' }, stderr: '' })
  for (const args of [['open'], ['chapter', 'all'], ['check', 'G-auth', '--file', CLI], ['alternatives', 'G-email'], ['mark', '--level', 'expert']]) {
    const r = cli(args)
    assert.equal(r.code, 5, args.join(' '))
    assert.deepEqual(r.json, { error: 'doorClosed', door: 'ask' })
  }
  assert.deepEqual(cli(['gate', '--answer', 'yes']).json, { door: 'use', saved: true })
  const open = cli(['open'])
  assert.equal(open.code, 0)
  assert.deepEqual(open.json.plan.chapters.slice(0, 2), ['G-hosting', 'G-domain'])
  assert.match(open.json.text, /\| /)
  const all = cli(['chapter', 'all', '--level', 'expert'])
  assert.equal(all.code, 0)
  for (const g of open.json.plan.chapters) for (const n of DATA.chapters[g].mustName) assert.ok(all.json.text.includes(n), n)
  const brief = cli(['chapter', 'G-auth', '--level', 'beginner'])
  assert.equal(brief.json.brief.chapter.gid, 'G-auth')
})

test('door: no and unsure both skip; the same run is not asked again from another pick or folder', (t) => {
  const { root, run, cli } = setup(t)
  assert.equal(cli(['gate', '--answer', 'no']).json.door, 'skip')
  assert.equal(cli(['gate', '--answer', 'unsure']).json.door, 'skip')
  assert.equal(cli(['open']).code, 5)
  cli(['gate', '--answer', 'yes'])
  const folder = join(root, 'delivered-b')
  mkdirSync(join(folder, '.sitebrew'), { recursive: true })
  assert.equal(cli(['gate'], { at: ['--run', run, '--pick', 'b'] }).json.door, 'use')
  assert.equal(cli(['gate'], { at: ['--site', folder, '--run', run] }).json.door, 'use')
  cli(['mark', '--level', 'beginner'], { at: ['--site', folder, '--run', run] })
  assert.equal(cli(['gate'], { at: ['--site', folder] }).json.door, 'use', '사본이 수렴한다')
})

test('old folder (no delivered.json) asks with exit 3; --features records the answer and the 3 goes away', (t) => {
  const { root, cli } = setup(t)
  const old = makeRun(root, undefined, 'old-run')
  const at = { at: ['--run', old] }
  cli(['gate', '--answer', 'yes'], at)
  const r = cli(['open'], at)
  assert.equal(r.code, 3)
  assert.equal(r.json.ask.why, 'noRecord')
  assert.deepEqual(r.json.ask.questions.map((q) => q.id), ['signup', 'payments', 'push'])
  assert.equal(cli(['chapter', 'all'], at).code, 3)
  assert.equal(cli(['open', '--features', 'payments'], at).code, 0)
  assert.equal(cli(['open'], at).code, 0)
  assert.equal(cli(['open', '--features', 'intro-site'], at).code, 2)
  // 상태를 남길 자리가 없는 옛 사용자 폴더: 대화에서 받은 문 답을 --answer 로 넘긴다(아무것도 만들지 않는다).
  const site = join(root, 'old-site')
  mkdirSync(site)
  assert.equal(cli(['open'], { at: ['--site', site] }).code, 5)
  assert.equal(cli(['open', '--answer', 'yes'], { at: ['--site', site] }).code, 3)
  assert.equal(existsSync(join(site, '.sitebrew')), false)
})

test('table hash: delivered from another table → 3 (tableChanged); runbook data from another table → 1 tool failure', (t) => {
  const { root, cli } = setup(t, delivered({ tableHash: 'other0001' }))
  cli(['gate', '--answer', 'yes'])
  const r = cli(['open'])
  assert.equal(r.code, 3)
  assert.equal(r.json.ask.why, 'tableChanged')
  const stale = makeLf(join(root, 'stale-kit'), { table: table({ hash: 'fixture0009' }) })
  const bad = cli(['open'], { lfDir: stale })
  assert.equal(bad.code, 1)
  assert.deepEqual(bad.json, { error: 'tool', code: 'hashMismatch' })
  assert.match(bad.stderr, /^도구 실패: .*next:/)
})

test('LF not found → exit 1 with 도구 실패 and a next action; the gate still answers without LF', (t) => {
  const { root, cli } = setup(t)
  const nowhere = join(root, 'nowhere')
  assert.equal(cli(['gate', '--answer', 'yes'], { lfDir: nowhere }).code, 0)
  const r = cli(['open'], { lfDir: nowhere })
  assert.equal(r.code, 1)
  assert.match(r.stderr, /^도구 실패: .*next: /)
})

test('chapter --out writes a new file (0) and never overwrites an existing one (4)', (t) => {
  const { root, cli } = setup(t)
  cli(['gate', '--answer', 'yes'])
  const file = join(root, 'RUNBOOK.md')
  const ok = cli(['chapter', 'all', '--out', file])
  assert.equal(ok.code, 0)
  assert.deepEqual(ok.json, { file })
  const first = readFileSync(file, 'utf8')
  assert.match(first, /NEXT_PUBLIC_APP_URL/)
  const again = cli(['chapter', 'G-auth', '--out', file])
  assert.equal(again.code, 4)
  assert.equal(readFileSync(file, 'utf8'), first)
})

test('check: a good draft passes (0); a draft with problems exits 1 with rubric sentences and no key echo', (t) => {
  const { root, cli } = setup(t)
  cli(['gate', '--answer', 'yes'])
  const good = join(root, 'good.md')
  writeFileSync(good, koAuth())
  assert.deepEqual(cli(['check', 'G-auth', '--file', good]), { code: 0, json: { problems: [] }, stderr: '' })
  const bad = join(root, 'bad.md')
  writeFileSync(bad, koAuth().replace('`BETTER_AUTH_SECRET` 이름으로', `「${KEY}」 값으로`))
  const r = cli(['check', 'G-auth', '--file', bad])
  assert.equal(r.code, 1)
  assert.deepEqual(r.json.problems.map((p) => p.rule).sort(), ['env-missing', 'secret-shape', 'unknown-name'])
  for (const p of r.json.problems) assert.equal(p.text, DATA.rubric.problems[p.rule].ko)
})

test('alternatives: on · reselect · code · no from the applied features; --want filters; unknown tag is 2', (t) => {
  const { cli } = setup(t)
  cli(['gate', '--answer', 'yes'])
  const on = cli(['alternatives', 'G-email'])
  assert.equal(on.code, 0)
  assert.deepEqual(on.json.options.map((o) => o.switch), ['on', 'code', 'no'])
  assert.deepEqual(cli(['alternatives', 'G-email', '--want', 'free']).json.options.map((o) => o.service), [DATA.alternatives.email[0].service])
  assert.equal(cli(['alternatives', 'G-email', '--want', 'fastest']).code, 2)
  assert.equal(cli(['alternatives', 'G-hosting']).json.none, true)
})

test('alternatives: a builtin choice whose feature is off says reselect', (t) => {
  const { cli } = setup(t, delivered({ applied: ['signup'] }))
  cli(['gate', '--answer', 'yes'])
  assert.equal(cli(['alternatives', 'G-email']).json.options[0].switch, 'reselect')
})

test('argument errors exit 2 and never echo a key-shaped value', (t) => {
  const { cli } = setup(t)
  cli(['gate', '--answer', 'yes'])
  const cases = [
    ['frobnicate'], ['gate', '--answer', 'maybe'], ['open', '--nope', 'x'], ['chapter'], ['mark', 'G-auth', 'finished'],
    ['mark', KEY, 'done'], ['mark', 'G-auth', 'done', '--level', 'expert'], ['open', '--features', KEY], ['chapter', KEY],
    ['check', 'G-auth'], ['gate', '--today', '22-10-2026'], ['gate', KEY], ['open', '--answer', 'yes'],
  ]
  for (const args of cases) {
    const r = cli(args)
    assert.equal(r.code, 2, args.join(' '))
    assert.deepEqual(r.json, { error: 'usage' })
  }
  const r = spawnSync(process.execPath, [CLI, 'gate'], { encoding: 'utf8' })
  assert.equal(r.status, 2, '--site 나 --run 이 없음')
})

test('mark records progress through the state owner', (t) => {
  const { run, cli } = setup(t)
  cli(['gate', '--answer', 'yes'])
  assert.deepEqual(cli(['mark', 'G-auth', 'done']).json, { saved: true })
  assert.deepEqual(cli(['open']).json.progress, { 'G-auth': 'done' })
  assert.match(readFileSync(join(run, '.sitebrew', 'runbook.json'), 'utf8'), /"G-auth"/)
})
