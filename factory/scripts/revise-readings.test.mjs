// 수정 명령의 읽기 경로(계획 2 Task 6) — 사전 분류가 낸 읽기(또는 --revise-readings 로 직접 준 읽기)를 레시피 머리 안(site·element)이나 구획 블록 교체(section·page)로 만든다.
//   · checkReadingsInput: 사전 기준 검사 · 파서(scope design) · rankSection 의 density 거르기
//   · revise(): 한 갈래씩 — 머리 안(여백 토큰이 사이트에 실리는지까지) · 구획 교체(판 version 2) · 섞인 범위·모르는 말은 되묻고 아무것도 쓰지 않는다
//   · 명령줄: 인자 · --explain · --revise-readings 의 종료 코드(틀리면 2, 판을 만들면 3)
// 실제 06(generateSite, install: false)을 쓴다 — 안마다 한 번씩 사이트를 다시 만들어 느리다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadLibrary } from './style-presets.mjs'
import { afterEach, beforeEach, test } from 'node:test'
import { BLOCK_REGISTRY } from './archetypes.mjs'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'
import { checkReadingsInput } from '../vocab/eval/predictions.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { applyRevision, boldScore, parseRevision, rankSection, revise } from '../stamp/revise.mjs'
import { EXIT, parseArgs, runReviseCommand, UsageError } from '../stamp/stamp.mjs'
import { fixtureRun, fixtureSite } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-readings-test')
mkdirSync(TMP, { recursive: true })
let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') }) // 이 컴퓨터의 진짜 학습 기록(~/.factory)이 시험에 섞이지 않게
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const lex = loadLexicon()
const site = fixtureSite()
const T = grammar.text
const read = (axis, o = {}) => ({ axis, scope: 'site', strength: 1, ...o })
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const tree = (d) => readdirSync(d, { recursive: true }).map(String).sort().join('\n')
const guardFiles = (run) => ['01-direction.json', '03-variants.json', '04-content.json', 'site/content/site.json'].map((f) => sha(join(run, 'a', f)))
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const filesUnder = (d) => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))
const asReadings = (readings) => ({ scope: 'design', input: { readings }, text: null })
const asJson = (input) => JSON.stringify(input)

// ── 입력 검사 ────────────────────────────────────────────────────────────────

test('checkReadingsInput: 사전 기준으로 틀린 곳을 모아서 돌려준다 · readings 와 options·choices 를 모두 받는다', () => {
  const ok = [read('spacing', { direction: 'airy' })]
  assert.deepEqual(checkReadingsInput({ readings: ok }, lex), [])
  assert.deepEqual(checkReadingsInput({ options: [{ readings: ok }, { readings: [read('type-scale', { direction: 'larger' })] }] }, lex), [])
  assert.deepEqual(checkReadingsInput({ choices: [{ readings: ok }, { readings: ok }] }, lex), [], '계획 1 예측 파일의 choices 도 받는다')
  const bad = checkReadingsInput({ readings: [read('여백', { direction: 'airy' }), read('spacing', { direction: 'wide' }), read('shape', { direction: 'round', scope: 'section:없는구획' })] }, lex)
  assert.equal(bad.length, 3, bad.join(' | '))
  assert.match(bad[0], /없는 축 「여백」/)
  assert.match(bad[1], /spacing 에 없는 방향 「wide」/)
  assert.match(bad[2], /사전에 없는 범위/)
  assert.ok(checkReadingsInput({ readings: [{ axis: 'spacing', direction: 'airy', scope: 'site' }] }, lex).some((p) => /strength 가 없다/.test(p)), '계획 단계는 기본값을 채우지 않는다')
  assert.ok(checkReadingsInput({ readings: [{ axis: 'spacing', direction: 'airy', strength: 1 }] }, lex).some((p) => /scope 가 없다/.test(p)))
  for (const input of [null, [], 'x', {}, { readings: ok, options: [] }, { options: [{ readings: ok }] }, { readings: [] }]) assert.ok(checkReadingsInput(input, lex).length > 0, JSON.stringify(input))
})

test('parseArgs: --revise-readings 는 --revise·--revise-pick 과 함께 못 쓰고, --explain 은 --revise 와만 쓴다', () => {
  const base = ['--run', 'out/x', '--pick', 'a']
  const json = asJson({ readings: [read('spacing', { direction: 'airy' })] })
  assert.equal(parseArgs([...base, '--revise-readings', json]).reviseReadings, json)
  assert.equal(parseArgs([...base, '--revise', '여백 넓게', '--explain']).explain, true)
  assert.throws(() => parseArgs([...base, '--revise', '여백 넓게', '--revise-readings', json]), UsageError)
  assert.throws(() => parseArgs([...base, '--revise-readings', json, '--revise-pick', '1:v1']), UsageError)
  assert.throws(() => parseArgs([...base, '--revise-readings', json, '--explain']), (e) => e instanceof UsageError && /--explain/.test(e.message))
  assert.throws(() => parseArgs(['--brief', 'b.json', '--explain']), UsageError)
  assert.throws(() => parseArgs(['--pick', 'a', '--revise-readings', json]), (e) => e instanceof UsageError && /--run/.test(e.message))
})

// ── 구획 순위의 밀도 거르기 ──────────────────────────────────────────────────

test('rankSection density: 블록 메타 density 가 같은 변형만 고르고, 모자라면 다른 방향으로 채우지 않고 까닭을 남긴다', async () => {
  const items = readJson(BLOCK_REGISTRY).items.filter((i) => i.type === 'registry:block' && i.meta?.kind === 'hero')
  const by = (density) => items.filter((i) => i.meta.density === density).map((i) => i.name)
  const [spacious, compact] = [by('spacious'), by('compact')]
  assert.ok(spacious.length >= 2 && compact.length >= 1, `재료: 여유 ${spacious.length} · 조밀 ${compact.length}`)
  const sm = { archetype: 'saas', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', status: 'block', allowedVariants: [...spacious.slice(0, 3), ...compact.slice(0, 1), ...by('comfortable').slice(0, 2)] }] }], globals: [] }
  const base = { sitemap: sm, key: 'home/hero', head: 'r1-measure', readiness: new Map(), leaks: new Map(), seed: 1 }
  const wide = await rankSection({ ...base, density: 'spacious', count: 2 })
  assert.ok(wide.picks.every((b) => spacious.includes(b)), wide.picks.join(', '))
  assert.equal(wide.why, null)
  const tight = await rankSection({ ...base, density: 'compact', count: 2 })
  assert.deepEqual(tight.picks, compact.slice(0, 1), '조밀한 변형이 하나뿐이면 안도 하나 — 여유로운 변형으로 채우지 않는다')
  assert.equal(tight.why, fill(T.section.few.ko, { label: T.section.label.compact.ko, count: 1 }))
  assert.match(tight.why, /더 조밀한 쪽 변형이 1개뿐/)
  assert.match((await rankSection({ ...base, density: 'compact', count: 2, lang: 'en' })).why, /^Only 1 tighter option/)
  const plain = await rankSection({ ...base, count: 2 })
  assert.equal(plain.why, null, 'density 가 없으면 예전 그대로')
})

test('rankSection intent: 지금 것보다 대담한/차분한 변형만 고른다 — 모자라도 반대 방향 변형으로 채우지 않는다', async () => {
  const all = readJson(BLOCK_REGISTRY).items.filter((i) => i.type === 'registry:block' && i.meta?.kind === 'hero').map((i) => i.name)
  const sm = { archetype: 'saas', pages: [{ id: 'home', route: '/', sections: [{ kind: 'hero', status: 'block', allowedVariants: all }] }], globals: [] }
  const base = { sitemap: sm, key: 'home/hero', head: 'r1-measure', readiness: new Map(), leaks: new Map(), seed: 1 }
  const top = all.reduce((a, b) => (boldScore(b) > boldScore(a) ? b : a))
  const bolder = await rankSection({ ...base, intent: 'bolder', current: top, exclude: [top], count: 2 })
  assert.deepEqual(bolder.picks, [], '이미 가장 대담한 변형이면 더 대담한 변형은 없다')
  assert.match(bolder.why, /더 대담한 쪽 변형이 0개뿐/)
  const calmer = await rankSection({ ...base, intent: 'calmer', current: top, exclude: [top], count: 2 })
  assert.ok(calmer.picks.length === 2 && calmer.picks.every((b) => boldScore(b) < boldScore(top)))
})

// ── 머리 안(site·element) ────────────────────────────────────────────────────

test('revise design(site): 여백 읽기 → 안 하나 + 까닭, 판 version 2, 사이트 CSS 에 여백 토큰이 실리고 구조·03·04 는 그대로', async () => {
  const run = fixtureRun()
  const before = guardFiles(run)
  const out = await revise(run, 'a', asReadings([read('spacing', { direction: 'airy' })]), { install: false, now: () => '2026-10-17T00:00:00.000Z' })
  assert.equal(out.status, 'ready')
  assert.equal(out.variants.length, 1, '여백은 한 칸만 가면 끝(normal → airy)이라 안 b 가 없다')
  assert.deepEqual(out.notes, [T.plan.onlyOne], '안이 하나뿐인 까닭을 보여 준다')
  assert.deepEqual(guardFiles(run), before, '지금 사이트·01·03·04 는 그대로')
  const v = out.variants[0]
  assert.equal(v.diff.sameStructure, true)
  assert.deepEqual(v.diff.sections, [])
  assert.deepEqual(readJson(join(run, v.siteRel, 'content', 'site.json')).sections, site.sections, '구조 유지')
  const board = readJson(out.boardFile)
  assert.deepEqual([board.kind, board.version, board.scope, board.status, board.picked], ['revise-board', 2, 'design', 'ready', null])
  assert.deepEqual(board.readings, [read('spacing', { direction: 'airy' })])
  assert.match(board.say, /여백/)
  assert.equal(board.why, T.plan.onlyOne)
  assert.equal(board.before.head.spacing, 'normal', '전: 지금 머리 요약')
  assert.deepEqual(board.variants[0].changes.map((c) => c.axis), ['spacing'])
  assert.equal(board.variants[0].say, board.say)
  assert.equal(board.routes.length > 5, true, '07 관문은 모든 쪽')
  // 여백 토큰이 임시 레시피 → 컴파일된 레시피 항목(registry cssVars.light)으로 실제로 간다 — 사이트는 이 항목을 설치한다
  const items = filesUnder(join(run, dirname(v.siteRel), 'build', 'registry')).filter((f) => f.endsWith('.json')).map(readJson).flatMap((j) => j.items ?? [j])
  assert.ok(items.some((i) => i.type === 'registry:base' && 'wf-section-py' in (i.cssVars?.light ?? {})), '컴파일된 레시피 항목에 wf-section-py 가 없다')
  // 고르면 후보 레시피 머리의 spacing 이 airy
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.deepEqual([applied.scope, applied.stale], ['design', ['06', '07']])
  assert.match(applied.say, /여백/)
  assert.equal(readJson(join(run, 'a', '01-direction.json')).data.recipe.spacing, 'airy')
  assert.equal(existsSync(join(dir, 'p.json')), false, '머리 안은 학습에 기록하지 않는다')
  assert.equal(readJson(join(run, 'a', '09-revise', String(out.index), 'board.json')).picked.id, 'v1')
})

test('revise design(site): 모서리 읽기 → 안 둘(세기 1·2), 변형마다 changes · 후보 둘이면 안 a·b 가 각 해석이고, 한쪽이 안 되면 되는 쪽만 안 하나 + 까닭', async () => {
  const run = fixtureRun()
  const two = await revise(run, 'a', asReadings([read('shape', { direction: 'round' })]), { install: false })
  assert.equal(two.variants.length, 2)
  assert.deepEqual(two.variants.map((v) => v.id), ['v1', 'v2'])
  for (const v of two.variants) { assert.equal(v.changes.length, 1); assert.equal(v.changes[0].axis, 'shape'); assert.ok(v.label.startsWith(v.id)) }
  assert.deepEqual(two.notes, [], '안이 둘이면 까닭이 없다')
  const options = (...lists) => ({ scope: 'design', input: { options: lists.map((readings) => ({ readings })) }, text: null })
  const both = await revise(run, 'a', options([read('shape', { direction: 'round' })], [read('motion', { direction: 'dynamic' })]), { install: false })
  assert.deepEqual(both.variants.map((v) => v.changes[0].axis), ['shape', 'motion'])
  const board = readJson(both.boardFile)
  assert.match(board.say, / \/ /, '후보 둘이면 두 해석을 함께 적는다')
  assert.deepEqual(board.readings.map((r) => r.axis), ['shape', 'motion'], '판의 읽기는 두 선택지를 이어 붙인 것')
  // 글자 크기는 이 머리에서 안전하게 바꿀 수 없다(step 이 noSafeChange) — 안 되는 선택지는 빠지고 까닭이 남는다
  const half = await revise(run, 'a', options([read('type-scale', { direction: 'larger' })], [read('shape', { direction: 'round' })]), { install: false })
  assert.deepEqual(half.variants.map((v) => [v.id, v.changes[0].axis]), [['v1', 'shape']])
  assert.deepEqual(half.notes, [T.step.noSafeChange])
  assert.equal(readJson(half.boardFile).why, T.step.noSafeChange)
  const none = await revise(run, 'a', asReadings([read('type-scale', { direction: 'larger' })]), { install: false })
  assert.deepEqual(none, { ask: T.step.noSafeChange }, '안이 하나도 없으면 되묻는다')
})

test('revise design: 읽기 없는 말(모름)·충돌·섞인 범위는 되묻고 아무것도 쓰지 않는다 (종료 3 과 같은 질문)', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const unknown = await revise(run, 'a', parseRevision('더 예쁘게 해줘', site), { install: false })
  assert.deepEqual(Object.keys(unknown), ['ask'])
  assert.match(unknown.ask, /[가-힣]/)
  const near = parseRevision('색을 바꿔줘', site)
  assert.notEqual(near.classification.result, 'confirmed')
  assert.deepEqual(Object.keys(await revise(run, 'a', near, { install: false })), ['ask'])
  const mixed = await revise(run, 'a', asReadings([read('spacing', { direction: 'airy' }), read('type-scale', { direction: 'larger', scope: 'section:hero' })]), { install: false })
  assert.deepEqual(mixed, { ask: T.ask.oneKindAtATime.ko }, '사이트 전체와 구획 범위가 섞이면 한 번에 하나씩')
  const clash = await revise(run, 'a', asReadings([read('spacing', { direction: 'airy' }), read('spacing', { direction: 'tight' })]), { install: false })
  assert.match(clash.ask, /시원하게|빽빽하게/)
  const buttonShape = await revise(run, 'a', asReadings([read('shape', { direction: 'round', scope: 'element:버튼' })]), { install: false })
  assert.deepEqual(buttonShape, { ask: T.ask.siteWide.ko }, 'elements 표에 없는 요소는 사이트 전체에 적용된다고 묻는다')
  assert.equal(tree(run), before, '아무것도 안 썼다')
})

// ── 구획 교체(section·page) ──────────────────────────────────────────────────

test('revise design(section): section:hero 글자 크기 → 구획마다 판(scope section, version 2) · 더 대담한 쪽 변형 · 학습에 쓰지 않는다', async () => {
  const run = fixtureRun()
  const before = guardFiles(run)
  const out = await revise(run, 'a', asReadings([read('type-scale', { direction: 'larger', scope: 'section:hero' })]), { install: false, n: 1 })
  assert.equal(out.target, 'campaign/hero', '홈 히어로는 이미 가장 대담한 변형이라 판을 만들지 않는다 — 같은 이름의 구획은 쪽마다 따로 본다')
  assert.match(out.notes.join(' '), /「히어로」에는 더 대담한 쪽 변형이 없어요/, '빠진 구획은 참고로 알린다')
  assert.deepEqual(guardFiles(run), before)
  for (const b of [out]) {
    assert.deepEqual([b.scope, b.status, b.variants.length, b.intent], ['section', 'ready', 1, 'bolder'])
    const board = readJson(b.boardFile)
    assert.deepEqual([board.version, board.scope, board.target], [2, 'section', b.target])
    assert.equal(board.readings[0].scope, 'section:hero')
    assert.match(board.say, /「히어로」 구획에만/, '구획은 사전 이름표로 말한다')
    assert.doesNotMatch(board.say, /「hero」/, '구획 kind 키(hero)는 사용자 글에 없다')
    assert.deepEqual(board.variants[0].changes.map((c) => [c.axis, c.section]), [['type-scale', b.target]], '변경 칸의 axis 는 사전 축 id, 구획 키는 section 칸')
    assert.equal(board.variants[0].say, board.say)
    assert.ok(board.variants[0].block)
  }
})

test('revise design(section): 여백만 말한 읽기는 intent 없이 density 로 — 판의 intent 는 different, density 는 따로, 고른 변형이 여유로운 블록이다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', asReadings([read('spacing', { direction: 'airy', scope: 'section:hero' })]), { install: false, n: 1 })
  const first = out.boards[0]
  assert.equal(first.intent, 'different', '판의 intent 는 bolder·calmer·different 만')
  const board = readJson(first.boardFile)
  assert.equal(board.density, 'spacious')
  assert.equal(board.intent, 'different')
  const meta = new Map(readJson(BLOCK_REGISTRY).items.map((i) => [i.name, i.meta]))
  assert.equal(meta.get(first.variants[0].block)?.density, 'spacious')
  assert.deepEqual(board.variants[0].changes.map((c) => [c.axis, c.section]), [['spacing', 'home/hero']], '변경 칸의 axis 는 사전 축 id, 구획 키는 section 칸')
  assert.equal(readJson(out.boards[0].boardFile).picked, null)
})

test('revise design(section): 후보 둘이면 해석마다 자기 구획 · 안마다 자기 해석(say) — 구획 하나에는 그 구획에 닿는 해석만 안이 된다', async () => {
  const run = fixtureRun()
  const options = { scope: 'design', text: null, input: { options: [
    { readings: [read('type-scale', { direction: 'larger', scope: 'section:hero' })] },
    { readings: [read('spacing', { direction: 'airy', scope: 'section:final-cta' })] },
  ] } }
  const out = await revise(run, 'a', options, { install: false })
  const hero = out.boards.find((b) => b.target === 'campaign/hero') // 홈 히어로는 이미 가장 대담해 판이 없다
  const cta = out.boards.find((b) => b.target === 'home/final-cta')
  assert.ok(hero && cta, out.boards.map((b) => b.target).join(', '))
  assert.ok(hero.variants.every((v) => v.changes.map((c) => c.axis).join() === 'type-scale'), '히어로 판의 안은 모두 글자 크기 해석')
  assert.ok(cta.variants.every((v) => v.changes.map((c) => c.axis).join() === 'spacing'), '마지막 행동 판의 안은 모두 여백 해석')
  assert.match(hero.variants[0].say, /글자 크기/)
  assert.match(cta.variants[0].say, /여백/)
  assert.doesNotMatch(hero.variants[0].say, / \/ /)
})

test('revise design(section): 변형마다 자기 해석(say) — 같은 구획의 후보 둘은 안 a·b 가 각 해석이다', async () => {
  const run = fixtureRun()
  const options = { scope: 'design', text: null, input: { options: [
    { readings: [read('type-scale', { direction: 'larger', scope: 'section:final-cta' })] },
    { readings: [read('motion', { direction: 'static', scope: 'section:final-cta' })] },
  ] } }
  const out = await revise(run, 'a', options, { install: false })
  const board = out.boards?.[0] ?? out
  assert.equal(board.variants.length, 2)
  assert.deepEqual(board.variants.map((v) => v.changes.map((c) => c.axis)), [['type-scale'], ['motion']])
  assert.match(board.variants[0].say, /글자 크기/)
  assert.match(board.variants[1].say, /움직임/)
})

test('revise design(section): 구획·쪽이 사이트에 없으면 묻는다', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const out = await revise(run, 'a', asReadings([read('type-scale', { direction: 'larger', scope: 'section:faq' })]), { install: false })
  assert.deepEqual(out, { ask: T.plan.noSection })
  assert.equal(tree(run), before)
})

// ── 명령줄 ──────────────────────────────────────────────────────────────────

test('명령줄 --revise-readings: 축 이름이 틀리면 종료 2 · 아무것도 안 바뀐다 / 옳으면 판을 만들고 종료 3, 판 version 2·안 1~2·changes', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const bad = await runReviseCommand({ run, pick: 'a', reviseReadings: asJson({ readings: [read('여백', { direction: 'airy' })] }) }, { say: () => {}, revOpts: { install: false } })
  assert.equal(bad.code, EXIT.args)
  assert.match(bad.lines.join('\n'), /문제 없는 축 「여백」/)
  const broken = await runReviseCommand({ run, pick: 'a', reviseReadings: '{ 읽기' }, { say: () => {}, revOpts: { install: false } })
  assert.equal(broken.code, EXIT.args)
  assert.match(broken.lines.join('\n'), /JSON 을 읽지 못했다/)
  assert.equal(tree(run), before)

  const lines = []
  const ok = await runReviseCommand({ run, pick: 'a', reviseReadings: asJson({ readings: [read('shape', { direction: 'round' })] }) }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(ok.code, EXIT.waiting, lines.join('\n'))
  const board = readJson(ok.result.boardFile)
  assert.equal(board.version, 2)
  assert.ok(board.variants.length >= 1 && board.variants.length <= 2)
  assert.ok(board.variants.every((v) => v.changes.length > 0))
  assert.match(lines.join('\n'), /해석: .*모서리/)
  assert.match(lines.join('\n'), /--revise-pick 1:<안>/)
  const picked = await runReviseCommand({ run, pick: 'a', revisePick: { index: board.index, id: 'v1' } }, { say: (s) => lines.push(s) })
  assert.equal(picked.code, EXIT.done)
  assert.match(lines.join('\n'), /후보 레시피 머리를 바꿨다/)
})

test('명령줄 --revise-readings section:hero type-scale larger → 구획 교체 판(scope section)', async () => {
  const run = fixtureRun()
  const r = await runReviseCommand({ run, pick: 'a', reviseReadings: asJson({ readings: [read('type-scale', { direction: 'larger', scope: 'section:hero' })] }) }, { say: () => {}, revOpts: { install: false, n: 1 } })
  assert.equal(r.code, EXIT.waiting)
  assert.equal(r.result.scope, 'section')
  assert.match(r.lines.join('\n'), /section campaign\/hero/, '홈 히어로는 이미 가장 대담해 판이 없다')
  assert.match(r.lines.join('\n'), /참고: .*「히어로」에는 더 대담한 쪽 변형이 없어요/)
})

test('명령줄 --revise "<말>" --explain: 분류 JSON 과 해석 문장을 보이고 파일은 바꾸지 않고 종료 3', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const hashes = guardFiles(run)
  const lines = []
  const r = await runReviseCommand({ run, pick: 'a', revise: '여백 넓게', explain: true }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(r.code, EXIT.waiting)
  assert.equal(r.explain, true)
  const json = JSON.parse(lines[0])
  assert.equal(json.result, 'confirmed')
  assert.equal(json.readings[0].axis, 'spacing')
  assert.match(lines[1], /^해석: /)
  assert.ok(lines[1].length > '해석: '.length)
  assert.equal(tree(run), before)
  assert.deepEqual(guardFiles(run), hashes)
  // 사전이 못 읽는 말도 분류를 그대로 보인다
  const unknown = []
  const u = await runReviseCommand({ run, pick: 'a', revise: '더 예쁘게 해줘', explain: true }, { say: (s) => unknown.push(s), revOpts: { install: false } })
  assert.equal(u.code, EXIT.waiting)
  assert.equal(JSON.parse(unknown[0]).result, 'unknown')
  // 구획 교체 말은 갈래와 대상을 보인다
  const section = []
  await runReviseCommand({ run, pick: 'a', revise: '히어로를 더 대담하게', explain: true }, { say: (s) => section.push(s), revOpts: { install: false } })
  assert.match(section.at(-1), /^해석: section home\/hero/)
  assert.equal(tree(run), before)
})

test('명령줄 --revise "<말>": 사전이 못 읽은 말은 질문(종료 3)이고 아무것도 안 바뀐다', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const lines = []
  const r = await runReviseCommand({ run, pick: 'a', revise: '더 예쁘게 해줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(r.code, EXIT.waiting)
  assert.match(lines.join('\n'), /질문: .*아무것도 바꾸지 않았다/s)
  assert.equal(tree(run), before)
})

test('revise design {copyFrom}: 같은 실행 폴더의 다른 시안 값을 지금 시안으로 옮긴 안 하나 + 까닭 · 판은 읽기 없이 사이트 전체 · 없는 시안·경로·아직 고친 적 없는 아까 모양은 되묻고 아무것도 쓰지 않는다', async () => {
  const run = fixtureRun()
  const dir01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8'))
  mkdirSync(join(run, 'b'), { recursive: true })
  const src = loadLibrary().find((r) => r.id === 'r12-spectrum')
  assert.notEqual(dir01.data.recipe, src.id, '시험 재료: 시안 a 와 b 의 레시피가 다르다')
  writeFileSync(join(run, 'b', '01-direction.json'), JSON.stringify({ inputHash: 'fixture', producedAt: 'x', data: { ...dir01.data, id: 'b', recipe: src.id } }, null, 2))
  const before = guardFiles(run)
  const copy = (copyFrom) => revise(run, 'a', { scope: 'design', input: { copyFrom }, text: null }, { install: false, now: () => '2026-10-17T00:00:00.000Z' })

  const t0 = tree(join(run, 'a'))
  for (const [from, ask] of [['z', T.plan.copyMissing], ['..', T.plan.copyMissing], ['previous', T.plan.noPrevious]]) assert.deepEqual(await copy(from), { ask }, from)
  assert.equal(tree(join(run, 'a')), t0, '되묻기는 아무것도 쓰지 않는다')

  const out = await copy('b')
  assert.equal(out.status, 'ready')
  assert.equal(out.variants.length, 1)
  assert.deepEqual(out.notes, [T.plan.onlyOne])
  assert.deepEqual(guardFiles(run), before, '지금 사이트·01·03·04 는 그대로')
  const board = readJson(out.boardFile)
  assert.deepEqual([board.version, board.scope, board.target, board.picked], [2, 'design', 'site', null])
  assert.deepEqual(board.readings, [])
  assert.equal(board.say, T.plan.sayCopy)
  assert.ok(board.variants[0].changes.length > 0 && board.variants[0].changes.every((c) => c.to === T.plan.copyTo))
  // 고르면 후보의 레시피 머리가 시안 b 의 값을 갖는다
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.equal(applied.scope, 'design')
  const head = readJson(join(run, 'a', '01-direction.json')).data.recipe
  assert.equal(head.motion, src.motion)
  assert.deepEqual(head.color, src.color)
  // 이제 고친 적이 있으니 「아까 모양」은 고치기 전 머리(처음 시안 a)로 옮기는 안이다
  const back = await copy('previous')
  assert.equal(back.status, 'ready')
  assert.equal(readJson(back.boardFile).say, T.plan.sayPrevious)
})

test('명령줄 --revise-readings {"copyFrom"}: 글자 하나만 받고, 판을 만들면 종료 3', async () => {
  const run = fixtureRun()
  const base = ['--run', run, '--pick', 'a', '--revise-readings']
  const lines = []
  const bad = await runReviseCommand(parseArgs([...base, JSON.stringify({ copyFrom: 'b', readings: [] })]), { say: (s) => lines.push(s) })
  assert.equal(bad.code, EXIT.args)
  const noSuch = await runReviseCommand(parseArgs([...base, JSON.stringify({ copyFrom: 'b' })]), { say: (s) => lines.push(s) })
  assert.equal(noSuch.code, EXIT.waiting, '없는 시안은 되묻는다')
  assert.ok(lines.some((l) => l.includes(T.plan.copyMissing)), lines.join(' | '))
})

test('명령줄 --revise: 「2번 시안처럼」은 시안 b 를 따라 하는 안(종료 0, 판 읽기 없음) · 「아까 게 나았어」는 고친 적이 없으면 되묻고 아무것도 쓰지 않는다', async () => {
  const run = fixtureRun()
  const t0 = tree(join(run, 'a'))
  const lines = []
  const say = (s) => lines.push(s)
  const noPrev = await runReviseCommand({ run, pick: 'a', revise: '아까 게 나았어' }, { say, revOpts: { install: false } })
  assert.equal(noPrev.code, EXIT.waiting)
  assert.ok(lines.some((l) => l.includes(T.plan.noPrevious)), lines.join(' | '))
  assert.equal(tree(join(run, 'a')), t0)
  const dir01 = readJson(join(run, 'a', '01-direction.json'))
  mkdirSync(join(run, 'b'), { recursive: true })
  writeFileSync(join(run, 'b', '01-direction.json'), JSON.stringify({ ...dir01, data: { ...dir01.data, id: 'b', recipe: 'r12-spectrum' } }, null, 2))
  const copy = await runReviseCommand({ run, pick: 'a', revise: '2번 시안처럼' }, { say, revOpts: { install: false } })
  assert.equal(copy.code, EXIT.done)
  const board = readJson(join(run, 'a', '09-revise', '1', 'board.json'))
  assert.deepEqual(board.readings, [])
  assert.equal(board.say, T.plan.sayCopy)
  const gone = await runReviseCommand({ run, pick: 'a', revise: '3번 시안처럼' }, { say, revOpts: { install: false } })
  assert.equal(gone.code, EXIT.waiting, '폴더가 없는 c 는 번호를 밀지 않고 시안을 못 찾는다고 되묻는다')
  assert.ok(lines.some((l) => l.includes(T.plan.copyMissing)))
})

// ── 마지막 고침 라운드(최종 리뷰) ─────────────────────────────────────────────

test('결과 규칙: 구획 하나를 말한 문장은 --explain 이 보인 읽기를 --revise-readings 에 넘겨도 평소 --revise 와 같은 종류의 판이 나온다(사이트 전체로 되묻지 않는다)', async () => {
  for (const text of ['히어로 더 차분하게', '히어로 더 화려하게']) {
    const request = parseRevision(text, site)
    assert.equal(request.scope, 'section', text)
    const plainRun = fixtureRun()
    const plain = await revise(plainRun, 'a', request, { install: false })
    const viaRun = fixtureRun()
    const via = await revise(viaRun, 'a', asReadings(request.classification.readings), { install: false })
    assert.equal(JSON.stringify(via).includes(T.ask.siteWide.ko), false, `${text}: 사이트 전체 되물음이 아니다`)
    const boards = (o) => o.boards ?? [o]
    const home = boards(via).find((b) => b.target === 'home/hero')
    if (request.intent === 'calmer') {
      assert.deepEqual([plain.scope, plain.intent, plain.target], ['section', 'calmer', 'home/hero'])
      assert.deepEqual([home.scope, home.intent], ['section', 'calmer'], text)
      assert.deepEqual(home.variants.map((v) => v.block), plain.variants.map((v) => v.block), `${text}: 같은 블록`)
    } else {
      // 홈 히어로는 이미 가장 대담한 변형이라 두 길 모두 홈 히어로에는 판이 없다 — 읽기 길은 그 사실을 참고로 알린다
      assert.ok(plain.ask, text)
      assert.equal(home, undefined)
      assert.ok(boards(via).every((b) => b.scope === 'section' && b.intent === 'bolder'), text)
    }
  }
})

test('구획 판: 말한 방향의 변형이 모자라면 반대 방향으로 채우지 않고 까닭(why)을 판과 compare.html 에 남긴다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', asReadings([read('type-scale', { direction: 'larger', scope: 'section:hero' })]), { install: false, n: 2 })
  assert.equal(out.target, 'campaign/hero')
  assert.equal(out.variants.length, 1, '더 대담한 변형은 하나뿐 — 차분한 변형으로 채우지 않는다')
  const meta = new Map(readJson(BLOCK_REGISTRY).items.map((i) => [i.name, i.meta]))
  assert.ok(boldScore(out.variants[0].block) > boldScore(fixtureSite().sections['campaign/hero'].block))
  assert.ok(meta.get(out.variants[0].block))
  const board = readJson(out.boardFile)
  assert.equal(board.why, '더 대담한 쪽 변형이 1개뿐이에요.')
  assert.equal(out.why, board.why)
  assert.ok(readFileSync(join(out.boardFile, '..', 'compare.html'), 'utf8').includes(board.why), 'compare.html 에 까닭이 보인다')
  assert.equal(board.notes.some((n) => /채웠다/.test(n)), false)
})

test('구획 판의 까닭 글은 요청 언어를 따른다 — 영어 요청의 판에는 한글 까닭이 없다', async () => {
  const run = fixtureRun()
  const request = { ...parseRevision('make the hero bolder', site), text: 'make the hero bolder' }
  const out = await revise(run, 'a', { scope: 'design', input: { readings: [read('type-scale', { direction: 'larger', scope: 'section:hero' })] }, text: request.text }, { install: false, n: 2 })
  assert.match(out.why, /^Only 1 bolder option/)
  assert.ok(readFileSync(join(out.boardFile, '..', 'compare.html'), 'utf8').includes(out.why), '영어 화면에도 같은 까닭')
})

test('색 이름을 둘 말한 읽기(빨강·파랑)의 판: 해석 문장이 두 값을 모두 말하고, 안 a·b 는 각 값이다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', asReadings([read('color-hue', { value: 'red' }), read('color-hue', { value: 'blue' })]), { install: false })
  assert.equal(out.variants.length, 2)
  assert.match(out.say, /빨강/)
  assert.match(out.say, /파랑/)
  const board = readJson(out.boardFile)
  assert.equal(board.say, out.say)
  assert.match(board.variants[0].say, /빨강/)
  assert.match(board.variants[1].say, /파랑/)
})

test('원래 색→바뀔 색 문장(빨간색을 파란색으로)의 판: 바뀔 색 하나만 읽어, 안 어디에도 원래 색이 없다', async () => {
  const run = fixtureRun()
  const request = parseRevision('빨간색을 파란색으로 바꿔줘', site)
  const out = await revise(run, 'a', request, { install: false })
  const board = readJson(out.boardFile)
  assert.deepEqual(board.readings.map((r) => r.value), ['blue'])
  assert.doesNotMatch(JSON.stringify(board.variants.map((v) => [v.say, v.changes])), /빨강/)
  assert.match(board.say, /파랑/)
})

test('값 읽기의 안 b 는 안 a 와 무엇이 다른지 말한다 — say·changes 가 서로 다르다(주색·서체)', async () => {
  const run = fixtureRun()
  const green = await revise(run, 'a', asReadings([read('color-hue', { value: 'green' })]), { install: false })
  assert.equal(green.variants.length, 2)
  const [a, b] = green.variants
  assert.notEqual(a.say, b.say, '색: 안 a·b 해석 문장이 같지 않다')
  assert.notDeepEqual(a.changes, b.changes)
  assert.match(b.say, /명도/, '안 b 는 같은 색조에서 명도만 다른 안이라고 말한다')
  const font = await revise(run, 'a', asReadings([read('type-family', { value: 'serif' })]), { install: false })
  assert.equal(font.variants.length, 2)
  assert.notEqual(font.variants[0].say, font.variants[1].say)
  assert.notDeepEqual(font.variants[0].changes, font.variants[1].changes)
})
