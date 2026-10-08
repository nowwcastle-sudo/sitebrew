// 구획 단위 수정(factory v1 Task 4.3)의 축·문구 갈래와 명령줄 — 축: 레시피 머리 사본으로 전체를 다시 조립(구조 유지) · 문구: 요청 파일을 내고 멈춘다(LLM 호출 없음), 응답이 오면 검사해 안을 만든다.
// 실제 06(generateSite, install: false)과 레시피 컴파일을 쓴다(축 갈래는 안마다 임시 레시피를 컴파일해서 구획 시험보다 느리다).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision, axisHeads, parseRevision, revise } from '../stamp/revise.mjs'
import { runReviseCommand, EXIT } from '../stamp/stamp.mjs'
import { loadLibrary } from './style-presets.mjs'
import { fixtureCand, fixtureRun, fixtureSite } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-axis-test')
mkdirSync(TMP, { recursive: true })

let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') }) // 이 컴퓨터의 진짜 학습 기록(~/.factory)이 시험에 섞이지 않게
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const tree = (d) => readdirSync(d, { recursive: true }).map(String).sort().join('\n')
const site = fixtureSite()
const guardFiles = (run) => ['03-variants.json', '04-content.json', 'site/content/site.json'].map((f) => sha(join(run, 'a', f)))
const readSite = (run, v) => JSON.parse(readFileSync(join(run, v.siteRel, 'content', 'site.json'), 'utf8'))

// ── 축 ──────────────────────────────────────────────────────────────────────

test('axisHeads: 모션은 더 대담하게 = 높은 단계만, 더 차분하게 = 낮은 단계만, 린트를 통과하는 값만', () => {
  const head = loadLibrary().find((r) => r.id === fixtureCand().recipe)
  assert.equal(head.motion, 'M1')
  const up = axisHeads(head, 'motion', 'bolder', 2)
  assert.ok(up.length >= 1 && up.every((h) => ['M2', 'M3'].includes(h.value) && h.head.motion === h.value))
  assert.ok(axisHeads(head, 'motion', 'calmer', 2).every((h) => h.value === 'M0'), '낮은 쪽만 — M0 이 린트(정지 기법만)에 걸리면 비어도 좋다')
  const both = axisHeads(head, 'motion', 'different', 3).map((h) => h.value)
  assert.ok(both.includes('M2'))
  assert.ok(!both.includes('M1'), '지금 값은 안에 넣지 않는다')
  assert.equal(axisHeads(head, 'color', 'different', 2)[0].value, 'B')
  assert.deepEqual(axisHeads(head, 'nothing', 'different', 2), [])
})

test('축 수정(색): 구조 유지 — 모든 구획의 블록·props 가 그대로이고 레시피만 바뀐다. 지금 사이트·03·04 는 그대로', async () => {
  const run = fixtureRun()
  const before = guardFiles(run)
  const baseRecipe = JSON.parse(readFileSync(join(run, 'a', 'site', 'lib', 'build.json'), 'utf8')).recipeId
  const r = parseRevision('색을 바꿔줘', site)
  const out = await revise(run, 'a', r, { install: false })
  assert.equal(out.status, 'ready')
  assert.deepEqual(out.variants.map((v) => v.value), ['B', 'dark'])
  assert.deepEqual(guardFiles(run), before)
  for (const v of out.variants) {
    const s = readSite(run, v)
    assert.deepEqual(s.sections, site.sections, '구조 유지')
    assert.equal(v.diff.sameStructure, true)
    assert.deepEqual(v.diff.sections, [])
    const recipeId = JSON.parse(readFileSync(join(run, v.siteRel, 'lib', 'build.json'), 'utf8')).recipeId
    assert.notEqual(recipeId, baseRecipe)
    assert.match(recipeId, /^x-/, '머리를 고친 사본은 임시 레시피로 컴파일된다')
    assert.ok(v.diff.files.includes('lib/build.json'))
  }
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.deepEqual([board.scope, board.target, board.status, board.routes.length > 5], ['axis', 'color', 'ready', true])
  // 축 수정의 반영(FV1 5.3): 고르면 진짜 revise() 가 남긴 임시 레시피 머리가 후보 폴더로 옮겨지고 01 의 후보 칸이 brand 가 된다 — 03·04 와 학습 기록은 그대로
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.deepEqual(applied.stale, ['06', '07'])
  assert.equal(applied.scope, 'axis')
  const d01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data
  assert.equal(d01.source, 'brand')
  assert.match(d01.recipe.id, /^x-/)
  assert.match(readFileSync(join(run, 'a', 'recipe', 'DESIGN.md'), 'utf8'), new RegExp(`id: ${d01.recipe.id}`))
  assert.equal(sha(join(run, 'a', '03-variants.json')), before[0], '03 은 그대로')
  assert.equal(existsSync(join(dir, 'p.json')), false, '축 선택은 학습에 기록하지 않는다')
})

test('축 수정(모션): 낮출 단계가 린트에 걸리면 빈 안과 까닭 — 거짓 안을 채우지 않는다 · 높이면 안이 나온다', async () => {
  const run = fixtureRun()
  const calm = await revise(run, 'a', parseRevision('모션 강도를 낮춰줘', site), { install: false })
  assert.equal(calm.status, 'empty')
  assert.equal(calm.variants.length, 0)
  assert.match(calm.notes.join(' '), /motion 축에서 쓸 수 있는 값이 0개/)
  const up = await revise(run, 'a', parseRevision('모션을 더 강하게', site), { install: false })
  assert.equal(up.status, 'ready')
  assert.ok(up.variants.length >= 1 && up.variants.every((v) => ['M2', 'M3'].includes(v.value) && v.diff.sameStructure))
})

// ── 문구 ────────────────────────────────────────────────────────────────────

const HERO = 'home/hero'
test('문구 수정: 첫 호출은 요청 파일을 내고 멈춘다 — 같은 요청을 다시 돌려도 번호가 늘지 않는다(LLM 호출 없음)', async () => {
  const run = fixtureRun()
  const before = guardFiles(run)
  const r = parseRevision('히어로 문구를 더 짧게', site)
  assert.deepEqual([r.scope, r.target, r.intent], ['copy', HERO, 'shorter'])
  const a = await revise(run, 'a', r, { install: false })
  assert.equal(a.status, 'waiting-copy')
  assert.deepEqual(a.variants, [])
  const reqFile = join(run, 'a', '09-revise', String(a.index), 'copy.request.json')
  const req = JSON.parse(readFileSync(reqFile, 'utf8'))
  assert.equal(req.kind, 'revise-copy-request')
  assert.equal(req.want, 2)
  assert.match(req.instruction, /짧게/)
  assert.ok(req.slots.length >= 4 && req.slots.every((s) => s.path.startsWith(`${HERO}/`)))
  assert.ok(req.slots.some((s) => s.path === `${HERO}/subhead` && s.current === '우유와 밀가루만 넣어요'))
  assert.equal(req.output, a.waiting.output)
  assert.deepEqual(guardFiles(run), before, '지금 사이트·03·04 는 그대로')
  const t0 = tree(join(run, 'a', '09-revise'))
  const b = await revise(run, 'a', r, { install: false })
  assert.equal(b.index, a.index, '같은 요청은 같은 번호에서 이어 간다')
  assert.equal(b.status, 'waiting-copy')
  assert.equal(tree(join(run, 'a', '09-revise')), t0)
  // 다른 요청은 새 번호
  const c = await revise(run, 'a', parseRevision('히어로 문구를 더 따뜻하게', site), { install: false })
  assert.equal(c.index, a.index + 1)
})

test('문구 수정: 응답이 오면 검사해서 안을 만든다 — 틀린 칸·검사 실패는 안을 만들지 않고 문제를 돌려준다', async () => {
  const run = fixtureRun()
  const r = parseRevision('히어로 문구를 더 짧게', site)
  const w = await revise(run, 'a', r, { install: false })
  const respFile = w.waiting.output
  // 모르는 칸
  writeFileSync(respFile, JSON.stringify({ variants: [{ texts: { 'home/final-cta/headline': '남의 칸' } }] }))
  const bad = await revise(run, 'a', r, { install: false })
  assert.equal(bad.status, 'invalid-copy')
  assert.match(bad.problems.join('\n'), /모르는 칸 home\/final-cta\/headline/)
  assert.equal(JSON.parse(readFileSync(w.boardFile, 'utf8')).status, 'invalid-copy')
  // 검사 실패(해요체 요청에 합쇼체로 쓰면 어체 검사에 걸린다)
  writeFileSync(respFile, JSON.stringify({ variants: [{ texts: { [`${HERO}/subhead`]: '우유와 밀가루만 넣습니다' } }] }))
  const eng = await revise(run, 'a', r, { install: false })
  assert.equal(eng.status, 'invalid-copy')
  assert.ok(eng.problems.length >= 1)
  assert.equal(existsSync(join(run, 'a', '09-revise', String(w.index), 'v1')), false, '안을 만들지 않았다')
  // 응답 파일이 JSON 이 아니면
  writeFileSync(respFile, '{ 깨진')
  assert.equal((await revise(run, 'a', r, { install: false })).status, 'invalid-copy')
  // 고친 응답은 같은 번호에서 안이 된다
  writeFileSync(respFile, JSON.stringify({ variants: [
    { texts: { [`${HERO}/subhead`]: '우유와 밀가루만 써요' } },
    { texts: { [`${HERO}/subhead`]: '우유와 밀가루가 전부예요', [`${HERO}/secondaryCta`]: '가격 보기' } },
  ] }))
  const ok = await revise(run, 'a', r, { install: false })
  assert.equal(ok.status, 'ready')
  assert.equal(ok.index, w.index)
  assert.equal(ok.variants.length, 2)
  const s0 = readSite(run, ok.variants[0])
  const texts0 = s0.slots.copy.map((c) => c.text)
  assert.ok(texts0.includes('우유와 밀가루만 써요'))
  assert.ok(!texts0.includes('우유와 밀가루만 넣어요'))
  assert.deepEqual(ok.variants[0].diff.after, { [`${HERO}/subhead`]: '우유와 밀가루만 써요' })
  assert.deepEqual(ok.variants[0].diff.before, { [`${HERO}/subhead`]: '우유와 밀가루만 넣어요' })
  assert.deepEqual(ok.variants[1].diff.after, { [`${HERO}/subhead`]: '우유와 밀가루가 전부예요', [`${HERO}/secondaryCta`]: '가격 보기' })
  assert.deepEqual(ok.variants[0].diff.sections, [HERO])
  assert.ok(ok.variants[0].diff.files.includes('content/site.json'))
  // 지금 사이트의 문구는 그대로
  assert.ok(JSON.parse(readFileSync(join(run, 'a', 'site', 'content', 'site.json'), 'utf8')).slots.copy.some((c) => c.text === '우유와 밀가루만 넣어요'))
  // 문구 수정의 반영(FV1 5.3): 고르면 04 의 그 칸만 바뀌고 입력 해시는 그대로다
  const hash04 = JSON.parse(readFileSync(join(run, 'a', '04-content.json'), 'utf8')).inputHash
  const applied = await applyRevision(run, 'a', ok.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.deepEqual([applied.scope, applied.stale], ['copy', ['06', '07']])
  const after04 = JSON.parse(readFileSync(join(run, 'a', '04-content.json'), 'utf8'))
  assert.equal(after04.inputHash, hash04)
  assert.ok(after04.data.slots.copy.some((c) => c.text === '우유와 밀가루만 써요'))
  assert.ok(!after04.data.slots.copy.some((c) => c.text === '우유와 밀가루만 넣어요'))
})

// ── 명령줄 ──────────────────────────────────────────────────────────────────

test('runReviseCommand: 되묻기는 종료 3·아무것도 안 바뀜, 안 만들기는 0, 고르기는 0 — 사이트가 없으면 도구 실패 1', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const lines = []
  const ask = await runReviseCommand({ run, pick: 'a', revise: '더 예쁘게 해줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(ask.code, EXIT.waiting)
  assert.match(lines.join('\n'), /질문: .*아무것도 바꾸지 않았다/s)
  assert.equal(tree(run), before)

  const made = await runReviseCommand({ run, pick: 'a', revise: '히어로를 더 대담하게' }, { say: () => {}, revOpts: { install: false } })
  assert.equal(made.code, EXIT.done)
  assert.equal(made.result.variants.length, 2)
  assert.match(made.lines.join('\n'), /--revise-pick 1:<안>/)

  const copy = await runReviseCommand({ run, pick: 'a', revise: '히어로 문구를 더 짧게' }, { say: () => {}, revOpts: { install: false } })
  assert.equal(copy.code, EXIT.waiting)
  assert.match(copy.lines.join('\n'), /대기: 문구 수정 요청/)

  const picked = await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: () => {} })
  // 새 블록이 비워 둔 화면 문구 칸이 있으면 입력 대기(종료 3, 요청 파일 경로 출력), 없으면 0 (FV1 5.3)
  const needsCopy = made.result.variants[0].diff.needsCopy.length > 0
  assert.equal(picked.code, needsCopy ? EXIT.waiting : EXIT.done)
  if (needsCopy) assert.match(picked.lines.join('\n'), /04-content\.request\.json/)
  assert.equal(JSON.parse(readFileSync(join(run, 'a', '03-variants.json'), 'utf8')).data[HERO], made.result.variants[0].block)

  const none = await runReviseCommand({ run: join(dir, 'nope'), pick: 'a', revise: '히어로를 더 대담하게' }, { say: () => {} })
  assert.equal(none.code, EXIT.fail)
  assert.match(none.lines.join('\n'), /도구 실패/)
})
