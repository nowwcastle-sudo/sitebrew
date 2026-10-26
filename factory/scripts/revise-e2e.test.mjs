// 수정 흐름 끝 검사(계획 2 Task 10) — 스킬이 부르는 순서 그대로 명령줄을 거친다:
//   해석만(--explain) → 읽기로 판 만들기(--revise-readings) → 고르기(--revise-pick) → 되돌리기(--revise-undo)
// 실제 06(generateSite)을 쓰고 설치·빌드·07 관문은 끈다(revOpts install: false). 실행 폴더는 scripts/lib/revise-fixtures.mjs 의 픽스처.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { grammar } from '../vocab/grammar.mjs'
import { AXIS_COUNT } from '../stamp/directions.mjs'
import { EXIT, parseArgs, runRedrawWider, runReviseCommand } from '../stamp/stamp.mjs'
import { fixtureRun } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-e2e-test')
mkdirSync(TMP, { recursive: true })
let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') }) // 이 컴퓨터의 진짜 학습 기록(~/.factory)이 시험에 섞이지 않게
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const tree = (d) => readdirSync(d, { recursive: true }).map(String).sort().join('\n')
const filesUnder = (d) => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))
const OPTS = { revOpts: { install: false } }

/** --explain 출력의 JSON — 「해석: 」 줄 앞의 줄들을 줄 단위로 모아 읽는다(해석 문장에 중괄호가 있어도 깨지지 않는다). */
function explainJson(text) {
  const lines = text.split('\n')
  return JSON.parse(lines.slice(0, lines.findIndex((l) => l.startsWith('해석: '))).join('\n'))
}

/** 명령줄 인자 그대로 한 번 돌린다 — 스킬이 치는 모양. 출력 줄과 종료 코드를 돌려준다. */
async function cli(run, ...args) {
  const lines = []
  const r = await runReviseCommand(parseArgs(['--run', run, '--pick', 'a', ...args]), { say: (s) => lines.push(s), ...OPTS })
  return { ...r, text: lines.join('\n') }
}

test('끝 검사: 해석 → 읽기로 판 → 고르기 → 되돌리기 (여백을 넓게)', async () => {
  const run = fixtureRun()
  const cand = join(run, 'a')
  const head = () => readJson(join(cand, '01-direction.json')).data.recipe
  const before = tree(run)
  const start = head()

  // 1. 해석만 — 종료 3, 앞선 읽기가 여백 airy, 아무 파일도 안 바뀐다
  const explain = await cli(run, '--revise', '여백 좀 넓게', '--explain')
  assert.equal(explain.code, EXIT.waiting)
  const shown = explainJson(explain.text)
  assert.deepEqual(shown.lead, { axis: 'spacing', direction: 'airy' })
  assert.equal(tree(run), before)

  // 2. 읽기로 판 만들기 — 종료 3, 판 version 2, 비교 화면, 안의 컴파일된 레시피에 여백 토큰
  const made = await cli(run, '--revise-readings', JSON.stringify({ readings: [{ axis: 'spacing', direction: 'airy', strength: 1, scope: 'site' }] }))
  assert.equal(made.code, EXIT.waiting, made.text)
  const { index, variants, version } = readJson(join(cand, '09-revise', '1', 'board.json'))
  assert.equal(version, 2)
  assert.equal(existsSync(join(cand, '09-revise', String(index), 'compare.html')), true, 'compare.html')
  const first = variants[0]
  const registry = join(run, dirname(first.siteRel), 'build', 'registry')
  const items = filesUnder(registry).filter((f) => f.endsWith('.json')).map(readJson).flatMap((j) => j.items ?? [j])
  assert.ok(items.some((i) => i.type === 'registry:base' && 'wf-section-py' in (i.cssVars?.light ?? {})), '컴파일된 레시피에 --wf-section-py 가 없다')
  assert.equal(head().spacing, undefined, '고르기 전에는 후보 머리가 그대로')

  // 3. 고르기 — 종료 0, 후보 머리가 spacing: airy
  const picked = await cli(run, '--revise-pick', `${index}:${first.id}`)
  assert.equal(picked.code, EXIT.done, picked.text)
  assert.equal(head().spacing, 'airy')

  // 4. 되돌리기 — 종료 0, 머리에서 spacing 이 없어진다
  const undone = await cli(run, '--revise-undo')
  assert.equal(undone.code, EXIT.done, undone.text)
  assert.equal(head().spacing, undefined)
  assert.deepEqual(head(), start, '되돌리면 처음 머리 그대로')
})

test('끝 검사: 「고급스럽게, 근데 너무 차갑지 않게」는 차가운 쪽 상한(cap)을 읽기에 담는다', async () => {
  const run = fixtureRun()
  const r = await cli(run, '--revise', '고급스럽게, 근데 너무 차갑지 않게', '--explain')
  assert.equal(r.code, EXIT.waiting)
  const { readings } = explainJson(r.text)
  assert.ok(readings.some((x) => x.axis === 'color-temperature' && x.direction === 'cool' && x.cap === true), JSON.stringify(readings))
})

test('모르는 참조 이름(askUnknownReference)은 세 갈래를 보이는 되묻기이고 한국어·영어가 모두 있다', () => {
  const ask = grammar.text.askUnknownReference
  assert.equal(ask.ko, '그 사이트의 어떤 점이 좋았어요? 1) 색 2) 글꼴 3) 배치')
  assert.match(ask.en, /1\).*2\).*3\)/)
  assert.doesNotMatch(ask.en, /[가-힣]/)
})

// ── 마지막 고침 라운드(최종 리뷰) ─────────────────────────────────────────────

const T = grammar.text
const head = (run) => readJson(join(run, 'a', '01-direction.json')).data.recipe
const readingsOf = (...readings) => JSON.stringify({ readings: readings.map((r) => ({ strength: 1, scope: 'site', ...r })) })
const AIRY = { axis: 'spacing', direction: 'airy' }
const ROUND = { axis: 'shape', direction: 'round' }
/** 읽기 JSON 으로 판을 만들고 판 번호를 돌려준다. */
async function makeBoard(run, reading) {
  const before = new Set(readdirSync(join(run, 'a', '09-revise')).filter((n) => /^\d+$/.test(n)))
  const r = await cli(run, '--revise-readings', readingsOf(reading))
  assert.equal(r.code, EXIT.waiting, r.text)
  return Number(readdirSync(join(run, 'a', '09-revise')).find((n) => /^\d+$/.test(n) && !before.has(n)))
}

test('끝 검사: 같은 상태에서 만든 두 판 중 하나를 고르면 나머지는 낡은 판이다 — 아무것도 바꾸지 않고 다시 만들라고 묻는다(종료 3)', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  const first = await makeBoard(run, AIRY)
  const second = await makeBoard(run, ROUND)
  assert.equal((await cli(run, '--revise-pick', `${first}:v1`)).code, EXIT.done)
  const afterFirst = tree(run)
  const headAfterFirst = head(run)
  const stale = await cli(run, '--revise-pick', `${second}:v1`)
  assert.equal(stale.code, EXIT.waiting, stale.text)
  assert.equal(stale.text, T.ask.boardStale.ko)
  assert.equal(tree(run), afterFirst, '아무것도 안 바뀌었다')
  assert.deepEqual(head(run), headAfterFirst)
  assert.equal(readJson(join(run, 'a', '09-revise', String(second), 'board.json')).picked, null, '고른 표시도 없다')
})

test('끝 검사: 되돌린 뒤에 그 앞 상태에서 만든 판을 고르면 낡은 판이다 — 되돌린 변경이 조용히 되살아나지 않는다', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  const start = head(run)
  const first = await makeBoard(run, AIRY)
  assert.equal((await cli(run, '--revise-pick', `${first}:v1`)).code, EXIT.done)
  assert.equal(head(run).spacing, 'airy')
  const later = await makeBoard(run, ROUND) // 여백을 넓힌 머리에서 만든 판
  assert.equal((await cli(run, '--revise-undo')).code, EXIT.done)
  assert.deepEqual(head(run), start)
  const picked = await cli(run, '--revise-pick', `${later}:v1`)
  assert.equal(picked.code, EXIT.waiting, picked.text)
  assert.equal(picked.text, T.ask.boardStale.ko)
  assert.deepEqual(head(run), start, '되돌린 여백이 되살아나지 않았다')
  // 같은 말로 다시 만든 판은 고를 수 있다
  const again = await makeBoard(run, ROUND)
  assert.equal((await cli(run, '--revise-pick', `${again}:v1`)).code, EXIT.done)
  assert.notDeepEqual(head(run), start, '다시 만든 판은 고를 수 있다')
  assert.equal(head(run).spacing, undefined)
})

test('끝 검사: 영어로 만든 판이 낡으면 영어로 묻는다', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  const first = await makeBoard(run, AIRY)
  const second = await makeBoard(run, ROUND)
  const file = join(run, 'a', '09-revise', String(second), 'board.json')
  writeFileSync(file, JSON.stringify({ ...readJson(file), request: 'make it rounder' }, null, 2))
  await cli(run, '--revise-pick', `${first}:v1`)
  assert.equal((await cli(run, '--revise-pick', `${second}:v1`)).text, T.ask.boardStale.en)
})

test('끝 검사: 둘 다 아니에요(--revise-pick <번호>:none)는 종료 3 · 파일은 그대로 · 되돌릴 대상이 아니다', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  const index = await makeBoard(run, AIRY)
  const before = head(run)
  const none = await cli(run, '--revise-pick', `${index}:none`)
  assert.equal(none.code, EXIT.waiting)
  assert.equal(none.text, T.neitherAsk.ko)
  assert.deepEqual(head(run), before)
  assert.equal(readJson(join(run, 'a', '09-revise', String(index), 'board.json')).picked.id, 'none')
  assert.equal((await cli(run, '--revise-undo')).code, EXIT.waiting, '고르지 않은 판은 되돌릴 것이 없다')
})

test('끝 검사: 되돌릴 수정이 없으면 종료 3 과 안내 한 줄', async () => {
  const run = fixtureRun()
  const before = tree(run)
  const r = await cli(run, '--revise-undo')
  assert.equal(r.code, EXIT.waiting)
  assert.equal(r.text, T.nothingToUndo.ko)
  assert.equal(tree(run), before)
})

test('끝 검사: 적용한 디자인 수정이 있으면 --redraw-wider 는 아무것도 바꾸지 않고 묻는다(종료 3) — 되돌린 뒤에는 막지 않는다', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  writeFileSync(join(run, 'stamp-summary.json'), JSON.stringify({ brief: {} }))
  writeFileSync(join(run, 'directions.json'), JSON.stringify({ minAxes: AXIS_COUNT })) // 더 넓힐 수 없는 끝 — 막히지 않으면 이 안내가 나온다
  const index = await makeBoard(run, AIRY)
  assert.equal((await cli(run, '--revise-pick', `${index}:v1`)).code, EXIT.done)
  const applied = tree(run)
  const said = []
  const blocked = await runRedrawWider({ run }, { say: (s) => said.push(s) })
  assert.equal(blocked.code, EXIT.waiting)
  assert.deepEqual(said, [T.ask.redrawDrops.ko])
  assert.equal(tree(run), applied, '아무것도 안 바뀌었다')
  assert.equal((await cli(run, '--revise-undo')).code, EXIT.done)
  const free = []
  const limit = await runRedrawWider({ run }, { say: (s) => free.push(s) })
  assert.equal(limit.code, EXIT.waiting)
  assert.deepEqual(free, [T.redrawLimit.ko], '되돌렸으니 이 막힘은 풀렸다(끝이라 못 넓히는 안내가 나온다)')
})

test('끝 검사: 구획 말은 --explain 이 보인 읽기를 그대로 --revise-readings 에 넘겨도 사이트 전체로 되묻지 않고 같은 구획 판이 된다', async () => {
  const run = fixtureRun()
  const explain = await cli(run, '--revise', '히어로 더 차분하게', '--explain')
  assert.equal(explain.code, EXIT.waiting)
  const shown = explainJson(explain.text)
  assert.deepEqual([shown.scope, shown.target, shown.intent], ['section', 'home/hero', 'calmer'])
  assert.match(explain.text, /해석: section home\/hero — /)
  const made = await cli(run, '--revise-readings', JSON.stringify({ readings: shown.classification.readings }))
  assert.equal(made.code, EXIT.waiting, made.text)
  assert.doesNotMatch(made.text, new RegExp(T.ask.siteWide.ko))
  assert.match(made.text, /section home\/hero/)
})

// ── 남은 고침(재검토) ─────────────────────────────────────────────────────────

test('끝 검사: 구획 수정을 고르면 그 전에 만든 디자인 판은 낡은 판이고, --redraw-wider 도 구획 수정이 있으면 묻는다 — 갈래를 가리지 않는다', async () => {
  const run = fixtureRun()
  mkdirSync(join(run, 'a', '09-revise'), { recursive: true })
  writeFileSync(join(run, 'stamp-summary.json'), JSON.stringify({ brief: {} }))
  writeFileSync(join(run, 'directions.json'), JSON.stringify({ minAxes: AXIS_COUNT }))
  const design = await makeBoard(run, AIRY)
  const made = await cli(run, '--revise', '히어로를 더 차분하게')
  assert.equal(made.code, EXIT.done, made.text)
  const section = Number(/--revise-pick (\d+):<안>/.exec(made.text)[1])
  const picked = await cli(run, '--revise-pick', `${section}:v1`)
  assert.ok([EXIT.done, EXIT.waiting].includes(picked.code), picked.text) // 새 블록의 화면 문구가 비어 있으면 입력 대기(3)
  assert.equal(readJson(join(run, 'a', '09-revise', String(section), 'board.json')).picked.id, 'v1')
  const afterSection = tree(run)
  const start = head(run)
  const stale = await cli(run, '--revise-pick', `${design}:v1`)
  assert.equal(stale.code, EXIT.waiting, stale.text)
  assert.equal(stale.text, T.ask.boardStale.ko)
  assert.equal(tree(run), afterSection)
  assert.deepEqual(head(run), start)
  const said = []
  const blocked = await runRedrawWider({ run }, { say: (s) => said.push(s) })
  assert.equal(blocked.code, EXIT.waiting)
  assert.deepEqual(said, [T.ask.redrawDrops.ko], '구획 수정만 있어도 막는다')
  assert.equal(tree(run), afterSection)
})
