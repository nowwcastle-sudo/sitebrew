// 구획 단위 수정(factory v1 Task 4.3 → FV1 5.3) — 고르기(applyRevision)의 세 갈래: axis(레시피 머리 갈아 끼우기) · copy(04 본문 칸 바꾸기) · section(03 + 새 블록의 빈 화면 문구 칸 요청).
// 가벼운 시험: 06 을 돌리지 않는다 — revise-fixtures.mjs 의 fixtureRevisionRun 이 revise() 가 남기는 보드·임시 레시피 머리·안의 04 요청을 손으로 놓는다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision } from '../stamp/revise.mjs'
import { runReviseCommand, EXIT } from '../stamp/stamp.mjs'
import { loadPreferences, weightOf } from '../board/preferences.mjs'
import { fixtureRevisionRun, fixtureSite } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-apply-test')
mkdirSync(TMP, { recursive: true })

let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') }) // 이 컴퓨터의 진짜 학습 기록(~/.factory)이 시험에 섞이지 않게
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const opts = () => ({ seedFile: join(dir, 'no-seed.json'), userFile: join(dir, 'prefs', 'preferences.json') })
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const copyOf = (content) => Object.fromEntries(content.slots.copy.map((c, i) => [`${i}:${c.id}`, c.text]))

// ── axis ────────────────────────────────────────────────────────────────────

test('axis 고르기는 후보 레시피 머리를 바꾸고 01 의 후보 칸을 brand 로 고치고 06·07 을 낡게 한다', async () => {
  const run = fixtureRevisionRun({ scope: 'axis' })
  const value = run.variantData.value // 모션 M2·M3 중 린트를 통과한 첫 값
  assert.equal(typeof run.before.direction.recipe, 'string', '고르기 전 후보는 라이브러리 레시피 id 다')
  assert.equal(existsSync(join(run.cand, 'recipe', 'DESIGN.md')), false, '라이브러리 후보는 레시피 폴더가 없다')
  const r = await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  assert.equal(r.applied, true)
  assert.equal(r.scope, 'axis')
  assert.deepEqual(r.stale, ['06', '07'])
  assert.equal(r.waitingCopy, undefined)
  // 후보 폴더 recipe/DESIGN.md = 고른 안의 임시 레시피 머리
  assert.match(readFileSync(join(run.cand, 'recipe', 'DESIGN.md'), 'utf8'), new RegExp(`motion: ${value}`))
  // 01: 출처가 brand 로, 레시피는 새 id 를 가진 머리 객체로(생성 절은 본문에서 뺀다 — 컴파일이 다시 붙인다)
  const d = readJ(join(run.cand, '01-direction.json'))
  assert.equal(d.inputHash, 'fixture', '01 의 입력 해시는 그대로 — 다시 돌려도 이 선택이 남는다')
  assert.equal(d.data.source, 'brand')
  assert.equal(typeof d.data.recipe, 'object')
  assert.match(d.data.recipe.id, /^x-/)
  assert.equal(d.data.recipe.motion, value)
  assert.ok(!String(d.data.recipe.body ?? '').includes('## 생성 — 승격 전'))
  assert.equal(d.data.id, run.before.direction.id)
  // 06·07 단계 파일은 낡음 표시(입력 해시가 달라 다음 실행이 다시 만든다) — 자료는 지우지 않는다
  for (const n of ['06-pages', '07-qa']) { const s = readJ(join(run.cand, `${n}.json`)); assert.notEqual(s.inputHash, 'fixture', n); assert.match(s.inputHash, /^stale:/); assert.deepEqual(s.data, {}) }
  // 03·04·사이트는 그대로(구조 유지)
  assert.deepEqual(readJ(join(run.cand, '03-variants.json')).data, run.before.variants)
  assert.equal(readJ(join(run.cand, '09-revise', String(run.index), 'board.json')).picked.id, 'v1')
})

test('axis 고르기: 안의 레시피 머리 파일이 없으면 아무것도 바꾸지 않고 던진다', async () => {
  const run = fixtureRevisionRun({ scope: 'axis' })
  rmSync(join(run.dir, 'a', '09-revise', '1', 'v1'), { recursive: true, force: true })
  const before = sha(join(run.cand, '01-direction.json'))
  await assert.rejects(() => applyRevision(run.dir, 'a', run.index, run.variant, opts()), /DESIGN\.md/)
  assert.equal(sha(join(run.cand, '01-direction.json')), before)
  assert.equal(existsSync(join(run.cand, 'recipe')), false)
  assert.equal(readJ(join(run.cand, '09-revise', '1', 'board.json')).picked, null, '골랐다고 적지 않는다')
})

// ── copy ────────────────────────────────────────────────────────────────────

test('copy 고르기는 04 의 그 칸만 바꾸고 입력 해시는 그대로 둔다', async () => {
  const run = fixtureRevisionRun({ scope: 'copy', texts: { 'home/hero/subhead': '우유와 밀가루만 써요' } })
  const before04 = readJ(join(run.cand, '04-content.json'))
  const r = await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  assert.equal(r.applied, true)
  assert.equal(r.scope, 'copy')
  assert.deepEqual(r.stale, ['06', '07'])
  assert.equal(r.waitingCopy, undefined)
  const after04 = readJ(join(run.cand, '04-content.json'))
  assert.equal(after04.inputHash, before04.inputHash)
  const was = copyOf(before04.data), now = copyOf(after04.data)
  const changed = Object.keys(now).filter((k) => now[k] !== was[k])
  assert.equal(changed.length, 1, `바뀐 칸: ${changed.join()}`)
  assert.match(changed[0], /:subhead$/)
  assert.equal(now[changed[0]], '우유와 밀가루만 써요')
  assert.equal(was[changed[0]], '우유와 밀가루만 넣어요')
  // 문구 칸 말고는 한 글자도 안 바뀐다
  assert.deepEqual({ ...after04.data, slots: null }, { ...before04.data, slots: null })
  for (const n of ['06-pages', '07-qa']) assert.match(readJ(join(run.cand, `${n}.json`)).inputHash, /^stale:/)
})

test('copy 고르기: 칸 경로가 04 에 없으면 던진다 — 04 는 그대로', async () => {
  const run = fixtureRevisionRun({ scope: 'copy', texts: { 'home/final-cta/nonexistent': '없는 칸' } })
  const before = sha(join(run.cand, '04-content.json'))
  await assert.rejects(() => applyRevision(run.dir, 'a', run.index, run.variant, opts()), /home\/final-cta\/nonexistent/)
  assert.equal(sha(join(run.cand, '04-content.json')), before)
  assert.match(readJ(join(run.cand, '06-pages.json')).inputHash, /^fixture$/, '낡음 표시도 하지 않는다')
  assert.equal(readJ(join(run.cand, '09-revise', '1', 'board.json')).picked, null)
})

test('copy 고르기: 콘텐츠 검사를 통과하지 못하는 문구는 쓰지 않고 던진다(해요체 요청에 합쇼체)', async () => {
  const run = fixtureRevisionRun({ scope: 'copy', texts: { 'home/hero/subhead': '우유와 밀가루만 넣습니다' } })
  const before = sha(join(run.cand, '04-content.json'))
  await assert.rejects(() => applyRevision(run.dir, 'a', run.index, run.variant, opts()), /ko-register|해요체/)
  assert.equal(sha(join(run.cand, '04-content.json')), before)
  assert.equal(readJ(join(run.cand, '09-revise', '1', 'board.json')).picked, null)
})

// ── section ─────────────────────────────────────────────────────────────────

test('section 고르기는 03 을 고치고, 새 블록의 빈 화면 문구 칸이 없으면 기다리지 않는다', async () => {
  const run = fixtureRevisionRun({ scope: 'section' })
  assert.equal(run.variantData.diff.from, fixtureSite().sections['home/hero'].block, '지금 사이트에 그려진 히어로가 「지금 것」이다')
  const hash03 = readJ(join(run.cand, '03-variants.json')).inputHash
  const r = await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  assert.equal(r.applied, true)
  assert.equal(r.scope, 'section')
  assert.equal(r.block, run.variantData.block)
  assert.equal(r.waitingCopy, undefined)
  assert.deepEqual(r.stale, ['06', '07'])
  const v = readJ(join(run.cand, '03-variants.json'))
  assert.equal(v.inputHash, hash03, '03 의 입력 해시는 그대로 — 다시 돌려도 이 선택이 남는다')
  assert.equal(v.data['home/hero'], run.variantData.block)
  assert.ok(weightOf(loadPreferences(opts()), 'saas', run.variantData.block) > 1, '선택 학습은 그대로 기록한다')
})

test('section 고르기에서 새 블록 문구 칸이 비면 04 요청에 그 칸을 싣고 기다린다', async () => {
  const run = fixtureRevisionRun({ scope: 'section', needsCopy: ['copy.caption'] })
  const r = await applyRevision(run.dir, 'a', run.index, run.variant, opts())
  assert.ok(r.waitingCopy.endsWith('04-content.request.json'), r.waitingCopy)
  assert.equal(r.waitingCopy, join(run.cand, '04-content.request.json'))
  const req = readJ(r.waitingCopy)
  assert.deepEqual(req.pendingSlots, ['home/hero/ui:copy.caption'])
  assert.ok(req.slots.some((s) => s.path === 'home/hero/ui:copy.caption'), '새 칸이 요청에 있다')
  assert.equal(readJ(join(run.cand, '03-variants.json')).data['home/hero'], run.variantData.block, '03 은 그대로 고친다')
})

// ── 명령줄 ──────────────────────────────────────────────────────────────────

test('--revise-pick: 문구 칸 요청이 남으면 경로를 출력하고 종료 3, 아니면 0', async () => {
  const waiting = fixtureRevisionRun({ scope: 'section', needsCopy: ['copy.caption'] })
  const lines = []
  const w = await runReviseCommand({ run: waiting.dir, pick: 'a', revisePick: { index: waiting.index, id: waiting.variant } }, { say: (s) => lines.push(s) })
  assert.equal(w.code, EXIT.waiting)
  assert.match(lines.join('\n'), /04-content\.request\.json/)
  assert.match(lines.join('\n'), /대기/)

  const axis = fixtureRevisionRun({ scope: 'axis' })
  const a = await runReviseCommand({ run: axis.dir, pick: 'a', revisePick: { index: axis.index, id: axis.variant } }, { say: () => {} })
  assert.equal(a.code, EXIT.done)
  assert.match(a.lines.join('\n'), /motion/)
  assert.match(a.lines.join('\n'), /06·07|06, 07/)

  const copy = fixtureRevisionRun({ scope: 'copy' })
  const c = await runReviseCommand({ run: copy.dir, pick: 'a', revisePick: { index: copy.index, id: copy.variant } }, { say: () => {} })
  assert.equal(c.code, EXIT.done)
})
