// 구획 단위 수정(factory v1 Task 4.3 · 합의안 D13) — 말 → 요청 사상(모호하면 되묻고 아무것도 안 바꾼다, Review Focus 4) · 구획 2안 만들기(지금 변형 제외·학습 가중치 반영·그 구획만 다시)
// · 07 관문은 바뀐 쪽만 · 전·후 보드 자료 09-revise/<n>/board.json · 고르면 03 에 반영하고 선택을 학습에 기록한다.
// 실제 06(generateSite, install: false)을 쓴다 — 가짜 생성기를 끼우지 않는다. 관문(07)은 Chrome 이 필요해 주입한 가짜로 「어느 쪽만 부르는가」만 본다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision, boldScore, parseRevision, revise } from '../stamp/revise.mjs'
import { emptyPreferences, loadPreferences, recordPick, weightOf } from '../board/preferences.mjs'
import { fixtureRun, fixtureSite } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-test')
mkdirSync(TMP, { recursive: true })

let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') }) // 이 컴퓨터의 진짜 학습 기록(~/.factory)이 시험에 섞이지 않게
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const tree = (d) => readdirSync(d, { recursive: true }).map(String).sort().join('\n')
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const site = fixtureSite()
const userFile = () => join(dir, 'prefs', 'preferences.json')
const prefsOpts = () => ({ seedFile: join(dir, 'no-seed.json'), userFile: userFile() })

// ── 말 → 요청 ───────────────────────────────────────────────────────────────

test('모호한 요청은 되묻고 아무것도 바꾸지 않는다(Review Focus 4) — 빈 말은 바로, 사전이 못 읽은 말은 revise() 가', async () => {
  for (const text of ['', '   ']) {
    const r = parseRevision(text, site)
    assert.ok(typeof r.ask === 'string' && r.ask.length > 0 && r.ask.length < 80, `${JSON.stringify(text)} → ${JSON.stringify(r)}`)
    assert.equal(r.scope, undefined, '되묻는 결과는 범위를 정하지 않는다')
  }
  const run = fixtureRun()
  const before = tree(run)
  for (const text of ['더 예쁘게 해줘', '좀 더 좋게', '다시 해줘', 'make it prettier', 'improve it', '마음에 안 들어']) {
    const request = parseRevision(text, site)
    assert.equal(request.scope, 'design', text) // 사전 분류가 근사·모름이면 revise() 가 되묻는다
    const out = await revise(run, 'a', request, { install: false })
    assert.ok(typeof out.ask === 'string' && out.ask.length > 0 && out.ask.length < 80, `${JSON.stringify(text)} → ${JSON.stringify(out)}`)
    assert.equal(out.variants, undefined)
  }
  assert.match((await revise(run, 'a', parseRevision('더 예쁘게 해줘', site), { install: false })).ask, /[가-힣]/, '한국어 요청에는 한국어로')
  assert.doesNotMatch((await revise(run, 'a', parseRevision('make it prettier', site), { install: false })).ask, /[가-힣]/, '영어 요청에는 영어로')
  assert.equal(tree(run), before, '디렉터리 목록이 그대로다')
})

test('「히어로를 더 차분하게」 → section home/hero, 2안, 지금 변형 제외', async () => {
  const r = parseRevision('히어로를 더 차분하게', site)
  assert.deepEqual([r.scope, r.target, r.intent], ['section', 'home/hero', 'calmer'])
  const run = fixtureRun()
  const out = await revise(run, 'a', r, { n: 2, install: false })
  assert.equal(out.variants.length, 2)
  assert.ok(out.variants.every((v) => v.block !== site.sections['home/hero'].block))
  assert.notEqual(out.variants[0].block, out.variants[1].block, '두 안은 서로 다르다')
})

// ── 구획 2안 ────────────────────────────────────────────────────────────────

test('구획 2안: 그 구획만 다시 만든다 — 지금 쪽 파일·03·04 는 그대로, 다른 구획의 props 는 두 안 모두 같다', async () => {
  const run = fixtureRun()
  const siteFile = join(run, 'a', 'site', 'content', 'site.json')
  const guard = { site: sha(siteFile), v: sha(join(run, 'a', '03-variants.json')), c: sha(join(run, 'a', '04-content.json')) }
  const out = await revise(run, 'a', parseRevision('히어로를 더 차분하게', site), { install: false })
  assert.equal(sha(siteFile), guard.site, '지금 사이트는 제안만으로 바뀌지 않는다')
  assert.equal(sha(join(run, 'a', '03-variants.json')), guard.v)
  assert.equal(sha(join(run, 'a', '04-content.json')), guard.c)
  const before = site.sections
  for (const v of out.variants) {
    const after = JSON.parse(readFileSync(join(run, v.siteRel, 'content', 'site.json'), 'utf8')).sections
    assert.equal(after['home/hero'].block, v.block)
    assert.deepEqual(v.diff.sections, ['home/hero'], `바뀐 구획이 대상 하나뿐이다: ${JSON.stringify(v.diff.sections)}`)
    for (const k of Object.keys(before)) if (k !== 'home/hero') assert.deepEqual(after[k], before[k], `${k} 는 그대로`)
    assert.equal(v.diff.from, site.sections['home/hero'].block)
    assert.equal(v.diff.to, v.block)
    assert.ok(v.diff.files.includes('components/site/home-hero.tsx'), v.diff.files.join())
    assert.ok(Array.isArray(v.blockers) && typeof v.weight === 'number')
  }
})

test('전·후 보드 자료 09-revise/<n>/board.json 이 쓰인다 — 번호는 1부터 늘고 안마다 사이트 사본이 있다', async () => {
  const run = fixtureRun()
  const r = parseRevision('히어로를 더 차분하게', site)
  const a = await revise(run, 'a', r, { install: false, now: () => '2026-10-10T00:00:00.000Z' })
  assert.equal(a.index, 1)
  const file = join(run, 'a', '09-revise', '1', 'board.json')
  assert.equal(a.boardFile, file)
  const board = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual([board.kind, board.version, board.candidate, board.scope, board.target, board.intent, board.status], ['revise-board', 1, 'a', 'section', 'home/hero', 'calmer', 'ready'])
  assert.equal(board.request, '히어로를 더 차분하게')
  assert.equal(board.createdAt, '2026-10-10T00:00:00.000Z')
  assert.equal(board.before.block, site.sections['home/hero'].block)
  assert.equal(board.route, '/')
  assert.deepEqual(board.variants.map((v) => v.id), ['v1', 'v2'])
  assert.deepEqual(board.variants.map((v) => v.block), a.variants.map((v) => v.block))
  assert.equal(board.picked, null)
  assert.equal(board.variants.every((v) => v.previewUrl === null && existsSync(join(run, v.siteRel, 'content', 'site.json'))), true)
  const b = await revise(run, 'a', r, { install: false })
  assert.equal(b.index, 2)
  assert.ok(existsSync(join(run, 'a', '09-revise', '2', 'board.json')))
})

test('revise 가 학습 가중치를 안에 싣는다 — 안마다 weight 가 weightOf 와 같다', async () => {
  const run = fixtureRun()
  const r = parseRevision('히어로를 다른 걸로 바꿔줘', site)
  const plain = await revise(run, 'a', r, { install: false })
  assert.ok(plain.variants.every((v) => v.weight === 1))
  let prefs = emptyPreferences()
  for (let i = 0; i < 3; i++) prefs = recordPick(prefs, { archetype: 'saas', winner: plain.variants[1].block, loser: plain.variants[0].block, kind: 'section' })
  const out = await revise(run, 'a', r, { install: false, preferences: prefs })
  for (const v of out.variants) assert.equal(v.weight, weightOf(prefs, 'saas', v.block))
})

test('의도가 정한 쪽으로 좁힌다: 더 대담하게 = 지금 것보다 움직임·밀도 점수가 큰 변형만, 더 차분하게 = 작은 변형만 — 모자라도 반대 방향으로 채우지 않고 그 사실을 알린다', async () => {
  // 허용 변형 수는 히어로가 늘 때마다 바뀐다 — 개수가 아니라 「모든 안이 조건에 맞고, 모자라면 채우지 않으며 그때 까닭(why)을 알린다」를 고정한다.
  const run = fixtureRun()
  const cur = boldScore(site.sections['campaign/hero'].block)
  const check = (out, ok, label) => {
    assert.ok(out.variants.length >= 1, `${label}: 안이 있다`)
    assert.ok(out.variants.every((v) => ok(boldScore(v.block))), `${label}: 모든 안이 조건에 맞아야 한다 ${cur} → ${out.variants.map((v) => boldScore(v.block))}`)
    if (out.variants.length < 2) assert.match(out.why, new RegExp(`${out.variants.length}개뿐`), `${label}: 맞는 안이 모자라면 채우지 않고 까닭을 알린다`)
    else assert.equal(out.why, undefined, `${label}: 다 채웠으면 모자란다고 하지 않는다`)
  }
  const bolder = await revise(run, 'a', parseRevision('캠페인 히어로를 더 대담하게', site), { install: false })
  const calmer = await revise(run, 'a', parseRevision('캠페인 히어로를 더 차분하게', site), { install: false })
  check(bolder, (x) => x > cur, '더 대담하게')
  check(calmer, (x) => x < cur, '더 차분하게')
})

test('07 관문은 바뀐 쪽만 돈다 — 홈 히어로는 /, 캠페인 히어로는 /campaign, 전역 푸터는 모든 쪽. 설치 없이는 관문을 부르지 않는다', async () => {
  const run = fixtureRun()
  const calls = []
  const qa = async (scratchRun, cand, opts) => { calls.push({ routes: opts.routes, cand: cand.id, run: scratchRun }); return { publishable: false, blockers: ['가짜 관문 사유'], gates: [{ id: 'fake', verdict: 'pass' }] } }
  const out = await revise(run, 'a', parseRevision('히어로를 더 차분하게', site), { install: false, qa })
  assert.equal(calls.length, 0, 'install:false 면 관문을 돌리지 않는다(Chrome 이 필요하다)')
  assert.equal(out.variants.every((v) => v.qa === null), true)
  const out2 = await revise(run, 'a', parseRevision('히어로를 더 차분하게', site), { install: false, qa, runGates: true })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map((c) => c.routes), [['/'], ['/']])
  assert.deepEqual(out2.variants.map((v) => v.qa.routes), [['/'], ['/']])
  assert.equal(out2.variants[0].qa.publishable, false)
  assert.notEqual(calls[0].run, run, '관문은 지금 사이트가 아니라 제안 사본에서 돈다')
  calls.length = 0
  await revise(run, 'a', parseRevision('캠페인 히어로 다르게', site), { n: 1, install: false, qa, runGates: true })
  assert.deepEqual(calls.map((c) => c.routes), [['/campaign']])
  calls.length = 0
  await revise(run, 'a', parseRevision('푸터를 단순하게', site), { n: 1, install: false, qa, runGates: true })
  assert.ok(calls.length >= 1 && calls[0].routes.length > 3 && calls[0].routes.includes('/') && calls[0].routes.includes('/pricing'), JSON.stringify(calls[0]?.routes))
})

test('다른 변형이 모자라면 있는 만큼만 돌려주고 까닭을 남긴다(허용 변형 수가 요청 안 수 + 1 보다 적은 구획)', async () => {
  // 허용 변형 수는 블록이 늘 때마다 바뀐다(local 히어로는 2개 → 4개가 됐다) — 구획 이름을 박지 않고 지금 사이트맵에서 변형이 모자란 구획을 찾아 쓴다.
  const run = fixtureRun()
  const sitemap = JSON.parse(readFileSync(join(run, 'a', '02-sitemap.json'), 'utf8'))
  const data = sitemap.data ?? sitemap
  const N = 3 // revise 가 한 번에 내는 안의 상한
  const found = data.pages.flatMap((pg) => pg.sections.map((x) => ({ key: `${pg.id}/${x.kind}`, x })))
    .find(({ key, x }) => x.status === 'block' && site.sections[key] && x.allowedVariants.includes(site.sections[key].block) && x.allowedVariants.length >= 2 && x.allowedVariants.length - 1 < N)
  assert.ok(found, '변형이 모자란 구획이 사이트맵에 하나는 있어야 이 시험이 뜻을 가진다')
  const available = found.x.allowedVariants.length - 1
  const now = site.sections[found.key].block
  const out = await revise(run, 'a', { scope: 'section', target: found.key, intent: 'different', text: '다르게' }, { n: N, install: false })
  assert.equal(out.variants.length, available)
  assert.ok(out.variants.every((v) => v.block !== now))
  assert.equal(new Set(out.variants.map((v) => v.block)).size, available, '안끼리 서로 다르다')
  assert.match(out.why, new RegExp(`${available}개뿐`), '모자란다는 까닭을 남긴다')
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.equal(board.variants.length, available)
})

// ── 고르기 → 03 반영 → 학습 기록 ──────────────────────────────────────────────

test('고르면 03-variants 에 반영하고(입력 해시는 그대로라 다시 돌려도 유지), 이긴 변형·진 변형을 학습에 기록한다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('히어로를 더 차분하게', site), { install: false })
  const chosen = out.variants[1]
  const stageFile = join(run, 'a', '03-variants.json')
  const old = JSON.parse(readFileSync(stageFile, 'utf8'))
  const res = await applyRevision(run, 'a', out.index, chosen.id, prefsOpts())
  const now = JSON.parse(readFileSync(stageFile, 'utf8'))
  assert.equal(now.inputHash, old.inputHash, '입력 해시를 바꾸지 않는다 — 찍어내기가 다시 돌 때 run.step 이 이 선택을 그대로 읽는다')
  assert.equal(now.data['home/hero'], chosen.block)
  assert.deepEqual(Object.keys(now.data), Object.keys(old.data))
  for (const k of Object.keys(old.data)) if (k !== 'home/hero') assert.equal(now.data[k], old.data[k])
  assert.equal(res.block, chosen.block)
  // 학습: 고른 블록이 오르고, 지금 블록·다른 안이 내린다
  const prefs = loadPreferences(prefsOpts())
  assert.ok(weightOf(prefs, 'saas', chosen.block) > 1)
  assert.ok(weightOf(prefs, 'saas', site.sections['home/hero'].block) < 1)
  assert.ok(weightOf(prefs, 'saas', out.variants[0].block) < 1)
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.equal(board.picked.id, chosen.id)
  assert.equal(board.picked.block, chosen.block)
  // 두 번 고를 수 없고, 모르는 번호는 던진다
  await assert.rejects(() => applyRevision(run, 'a', out.index, out.variants[0].id, prefsOpts()), /이미 골랐다/)
  await assert.rejects(() => applyRevision(run, 'a', 99, 'v1', prefsOpts()), /09-revise\/99/)
})

test('고르기 오류: 모르는 안 id 는 아무것도 바꾸지 않는다(03·학습 기록 모두)', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('히어로를 더 차분하게', site), { install: false })
  const guard = sha(join(run, 'a', '03-variants.json'))
  await assert.rejects(() => applyRevision(run, 'a', out.index, 'v9', prefsOpts()), /v9/)
  assert.equal(sha(join(run, 'a', '03-variants.json')), guard)
  assert.equal(existsSync(userFile()), false, '기록도 없다')
})
