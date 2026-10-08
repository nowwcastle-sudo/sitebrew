// 방향 보드·결선 기록 J8·승격(P3-3 Task 12) — 브라우저 없이 도는 검사(보드 페이지 동작은 factory/board/direction-board/board.behavior.test.mjs).
//   ① promote 로 만든 초안이 lintRecipe 를 통과하고 「## 생성 — 승격 전」 절·head.brand 가 빠진다(C83) ② 운영자 확인 전 표시가 있으면 gen:all 이 보는 목록(recipeIds·loadLibrary·gen-ai loadRecipes)에서 빠지고,
//   표시를 지우면 들어간다(음성 대조 — 임시 사본에서만, 추적되는 트리에는 승격 레시피를 두지 않는다) ③ 승격은 쓰기 전 관문(lint·라이브러리와 축 차이)·중복 승격·라이브러리 후보를 거절한다
//   ④ 결선 줄 J8(고른 것 × 진 것, 후보마다 한 줄에만 promote) · 승격이 실패하면 줄을 쓰지 않는다 · 다시 돌려도 같은 줄을 또 쓰지 않는다 · --prune 은 탈락 후보의 build/ 만
//   ⑤ 보드 데이터·HTML: 출처 배지 · blockers 그대로(C95) · 공개 가능/불가/확인 안 됨 · 브랜드 조정 내역(C23) · 생성·브랜드 카드에만 「라이브러리로 올리기」.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRecipe, lintRecipe, recipeIds, isUnconfirmed, UNCONFIRMED_HEADING, knownRegistryItems } from './recipe.mjs'
import { loadLibrary } from './style-presets.mjs'
import { loadRecipes } from './gen-ai.mjs'
import { compileCandidate, serializeRecipe, GENERATED_MARK } from '../stamp/compile-candidate.mjs'
import { pickDirections } from '../stamp/directions.mjs'
import { promoteCandidate, PromoteError, dropSection, nextRecipeId } from '../board/promote.mjs'
import { pairRows, recordFinal, readPairs, PairRow, pruneLosers, loadCandidates } from '../board/direction-board/record.mjs'
import { loadBoardData, buildDirectionBoard, candidateJobs } from '../board/direction-board/build.mjs'
import { fileNames } from '../board/recipe-board/video.mjs'
import { boardData } from '../stamp/stamp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REAL_RECIPES = join(ROOT, 'registry', 'factory', 'recipes')
const DATE = '2026-09-30'
const write = (f, o) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n') }
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))

let base, work, cands
before(async () => {
  work = mkdtempSync(join(tmpdir(), 'wf-t12-'))
  base = join(work, 'base-run')
  const picked = await pickDirections({ brief: { archetype: 'saas' }, archetype: 'saas', seed: 7, weights: [] })
  cands = picked.candidates
  assert.deepEqual(cands.map((c) => c.id), ['a', 'b', 'c'])
  for (const c of cands) {
    const dir = join(base, c.id)
    if (c.source !== 'library') await compileCandidate(c, base)
    write(join(dir, 'candidate.json'), {
      id: c.id, slot: c.slot, source: c.source, recipe: c.source === 'library' ? c.recipe : 'recipe/DESIGN.md', preset: c.preset, palette: c.palette, fonts: c.fonts, why: c.why,
      blockers: c.id === 'b' ? ['공개 불가 — 필수 섹션 블록 없음: home/notice', '공개 불가 — 확인 필요 사실: business.phone'] : [],
    })
  }
  write(join(base, 'brief.json'), { topic: '치과 예약 안내', archetype: 'saas' })
  // 07-qa: a = 공개 가능, b = 공개 불가(여덟 줄 — 접힘 검사), c = 아직 안 돎.
  write(join(base, 'a', '07-qa', 'summary.json'), { publishable: true, blockers: [], gates: [{ id: 'ux', verdict: 'pass' }, { id: 'legal', verdict: 'pass' }], warnings: [] })
  const eight = Array.from({ length: 8 }, (_, i) => `QA 사유 ${i + 1} <script>alert(1)</script>`)
  write(join(base, 'b', '07-qa', 'summary.json'), { publishable: false, blockers: eight, gates: [{ id: 'ux', verdict: 'pass' }, { id: 'marketing', verdict: 'fail' }, { id: 'ai-tell', verdict: 'tool' }], warnings: ['w1'] })
  write(join(base, 'a', '08-board.json'), { inputHash: 'x', producedAt: 'x', data: { previewUrl: 'https://wf-preview-abc.vercel.app' } })
})
after(() => rmSync(work, { recursive: true, force: true }))

// 실행 폴더 사본(테스트마다 새로) + 임시 recipes 폴더(번호 확인용으로 r10 하나 들어 있다).
function fresh(name) {
  const run = join(work, name)
  cpSync(base, run, { recursive: true })
  const recipes = join(work, `${name}-recipes`)
  mkdirSync(join(recipes, 'r10-console'), { recursive: true })
  writeFileSync(join(recipes, 'r10-console', 'DESIGN.md'), '---\nid: r10-console\n---\n\nstub\n')
  return { run, recipes, pairs: join(work, `${name}-pairs.jsonl`) }
}
const draftHead = (file) => parseRecipe(readFileSync(file, 'utf8'))

test('promote: 초안이 lintRecipe 를 통과하고, 생성 절·브랜드 로고가 빠지며, 승격 기록과 「운영자 확인 전」 표시가 붙는다 — recipes/<id>/DESIGN.md 하나만 쓴다', () => {
  const { run, recipes, pairs } = fresh('t1')
  const r = promoteCandidate(run, 'b', { recipesDir: recipes, pairsFile: pairs, date: DATE })
  assert.match(r.id, /^r11-[a-z0-9-]+$/, '번호는 폴더의 가장 큰 번호 + 1')
  assert.ok(!/^r11-(gen|preset)-/.test(r.id), `이름에 프리셋 접두가 남지 않는다: ${r.id}`)
  assert.equal(r.file, join(recipes, r.id, 'DESIGN.md'))
  const md = readFileSync(r.file, 'utf8')
  const head = draftHead(r.file)
  assert.equal(head.id, r.id)
  assert.deepEqual(lintRecipe(head, { fontItems: knownRegistryItems() }), [], '초안이 lint 를 통과한다')
  assert.ok(!md.includes(GENERATED_MARK), '「생성 — 승격 전」 절이 빠진다')
  assert.ok(!('brand' in head))
  assert.ok(isUnconfirmed(md) && md.includes(UNCONFIRMED_HEADING), '운영자 확인 전 표시')
  const cj = readJ(join(run, 'b', 'candidate.json'))
  for (const line of ['## 승격 기록', `- 승격 원본: ${run.split(/[\\/]/).at(-1)}/b`, `- 출처 프리셋: ${cj.preset}`, `- 팔레트: ${cj.palette}`, `- 서체: ${cj.fonts.display} / ${cj.fonts.body}`, `- 결선 날짜: ${DATE}`]) assert.ok(md.includes(line), line)
  assert.deepEqual(readdirSync(recipes).sort(), ['r10-console', r.id], '다른 폴더·파일을 만들지 않는다')
  assert.deepEqual(readdirSync(join(recipes, r.id)), ['DESIGN.md'])
  assert.ok(existsSync(join(run, 'b', 'build')), 'build/ 는 지우지 않는다(C84)')
})

test('promote: 브랜드 후보의 head.brand(로고)는 승격 머리에서 빠지고 승격 기록에 이유가 남는다 (C83)', () => {
  const { run, recipes, pairs } = fresh('t2')
  const cj = join(run, 'c', 'candidate.json')
  write(cj, { ...readJ(cj), source: 'brand', brand: { adjustments: [{ role: 'primary', theme: 'light', from: '#fc0', to: '#e6b800', reason: '명도만 조정' }], fontSubstitutions: [] } })
  const dj = join(run, 'c', 'recipe', 'DESIGN.md')
  const parsed = parseRecipe(readFileSync(dj, 'utf8'))
  writeFileSync(dj, serializeRecipe({ ...parsed, brand: { logo: 'logo.svg' } }))
  assert.ok('brand' in draftHead(dj), '픽스처: 초안 머리에 brand 가 있다')
  const r = promoteCandidate(run, 'c', { recipesDir: recipes, pairsFile: pairs, date: DATE })
  const md = readFileSync(r.file, 'utf8')
  assert.ok(!('brand' in draftHead(r.file)))
  assert.match(md, /브랜드 로고\(`head\.brand`\)는 싣지 않았다/)
  assert.match(md, /브랜드 조정: 색 1건/)
  assert.match(md, /^- 출처: 브랜드 입력\(source brand\)$/m)
  assert.match(r.id, /^r11-brand-/)
})

test('gen:all 이 보는 레시피 목록은 운영자 확인 전 초안을 빼고, 표시를 지우면 넣는다 (음성 대조 — 임시 사본)', () => {
  const { run, recipes, pairs } = fresh('t3')
  const r = promoteCandidate(run, 'b', { recipesDir: recipes, pairsFile: pairs, date: DATE })
  // 임시 저장소 뼈대: 진짜 레시피 하나(r1-measure) + 승격 초안.
  const root = join(work, 't3-root')
  const rdir = join(root, 'registry', 'factory', 'recipes')
  cpSync(join(REAL_RECIPES, 'r1-measure'), join(rdir, 'r1-measure'), { recursive: true })
  cpSync(join(recipes, r.id), join(rdir, r.id), { recursive: true })
  assert.deepEqual(recipeIds(root), ['r1-measure'], '표시가 있으면 recipeIds 에 없다(컴파일·갤러리·프리셋·차이 검사가 모두 이 목록을 쓴다)')
  assert.deepEqual(loadLibrary(root).map((h) => h.id), ['r1-measure'], '프리셋 재료의 라이브러리에도 없다')
  assert.deepEqual(loadRecipes(rdir).map((h) => h.id), ['r1-measure'], '에이전트 입구(gen-ai)의 후보에도 없다')
  // 음성 대조: 표시(절)를 지우면 세 목록 모두 이 레시피를 넣는다.
  const f = join(rdir, r.id, 'DESIGN.md')
  const cleared = dropSection(readFileSync(f, 'utf8'), UNCONFIRMED_HEADING) + '\n'
  assert.ok(!isUnconfirmed(cleared))
  writeFileSync(f, cleared)
  assert.deepEqual(recipeIds(root), ['r1-measure', r.id].sort())
  assert.deepEqual(loadLibrary(root).map((h) => h.id).sort(), ['r1-measure', r.id].sort())
  assert.deepEqual(loadRecipes(rdir).map((h) => h.id).sort(), ['r1-measure', r.id].sort())
  // 추적되는 진짜 트리에는 승격 레시피가 없다.
  assert.ok(recipeIds().every((id) => !id.startsWith('x-')), '진짜 라이브러리에 임시 id 가 없다')
  // 진짜 recipes 폴더에는 운영자 확인을 기다리는 승격 초안이 있을 수 있다 — 목록에 없는 폴더는 표시 붙은 초안뿐이고, 표시 붙은 초안은 목록에 없다.
  const ids = new Set(recipeIds())
  for (const d of readdirSync(REAL_RECIPES)) assert.equal(ids.has(d), !isUnconfirmed(readFileSync(join(REAL_RECIPES, d, 'DESIGN.md'), 'utf8')), `진짜 recipes/${d}: 목록에 든 것 = 표시 없는 확인된 레시피`)
})

test('isUnconfirmed: 제목 줄만 표시로 읽는다(본문 속 언급·다른 제목은 아니다)', () => {
  assert.ok(isUnconfirmed('본문\n\n## 운영자 확인 전\n\n설명\n'))
  assert.ok(isUnconfirmed('## 운영자 확인 전\r\n'))
  assert.ok(!isUnconfirmed('본문에 운영자 확인 전 이라는 말이 있다\n'))
  assert.ok(!isUnconfirmed('## 운영자 확인 전 아님\n'))
  assert.ok(!isUnconfirmed('### 운영자 확인 전\n'))
  assert.ok(!isUnconfirmed('  ## 운영자 확인 전\n'))
})

test('promote 는 쓰기 전에 거절한다: 라이브러리 후보 · lint 실패 · 라이브러리와 축 차이 < 2 · 이미 승격 · 이미 있는 폴더 · 나쁜 id', () => {
  const { run, recipes, pairs } = fresh('t4')
  const o = { recipesDir: recipes, pairsFile: pairs, date: DATE }
  const before = readdirSync(recipes).sort()
  assert.throws(() => promoteCandidate(run, 'a', o), (e) => e instanceof PromoteError && /라이브러리 후보는 이미 라이브러리에 있다/.test(e.message))
  // lint 실패: 머리에서 필수 칸(hero)을 뺀다.
  const dj = join(run, 'b', 'recipe', 'DESIGN.md')
  const good = readFileSync(dj, 'utf8')
  const noHero = parseRecipe(good); delete noHero.hero
  writeFileSync(dj, serializeRecipe(noHero))
  assert.throws(() => promoteCandidate(run, 'b', o), (e) => e instanceof PromoteError && e.reasons.some((x) => x.startsWith('lint:')))
  assert.deepEqual(readdirSync(recipes).sort(), before, 'lint 실패는 아무것도 쓰지 않는다')
  writeFileSync(dj, good)
  // 라이브러리 한 벌과 축이 거의 같은 생성 후보: 라이브러리 레시피 머리에 id 만 바꾼 것.
  const lib = parseRecipe(readFileSync(join(REAL_RECIPES, 'r4-evidence', 'DESIGN.md'), 'utf8'))
  writeFileSync(join(run, 'c', 'recipe', 'DESIGN.md'), serializeRecipe({ ...lib, id: 'x-dup' }))
  assert.throws(() => promoteCandidate(run, 'c', o), (e) => e instanceof PromoteError && e.reasons.includes('axis-distance:library:r4-evidence'))
  assert.deepEqual(readdirSync(recipes).sort(), before)
  // 나쁜 id · 이미 있는 폴더
  assert.throws(() => promoteCandidate(run, 'b', { ...o, id: 'R11 나쁨' }), /id 규칙/)
  assert.throws(() => promoteCandidate(run, 'b', { ...o, id: 'r10-console' }), /이미 있는 레시피 폴더/)
  // 이미 승격: 같은 후보를 두 번 올릴 수 없다.
  const r = promoteCandidate(run, 'b', o)
  assert.throws(() => promoteCandidate(run, 'b', o), (e) => e instanceof PromoteError && e.message.includes(`이미 승격했다`) && e.message.includes(r.id))
  assert.equal(nextRecipeId(recipes, 'gen-x'), 'r12-gen-x', '번호는 운영자 확인 전 초안의 것도 센다')
})

test('pairRows: 고른 안이 나머지 각각을 이긴 줄 — 칸 순서로 a·b, winner, 출처, 후보마다 한 줄에만 promote', () => {
  const c = [{ id: 'a', source: 'library', name: 'r4-evidence' }, { id: 'b', source: 'generated', name: 'x-run-b' }, { id: 'c', source: 'brand', name: 'x-run-c' }]
  const m = { archetype: 'saas', brief: '치과', date: DATE }
  // a 를 골랐다
  let rows = pairRows(c, { pick: 'a', ...m })
  assert.deepEqual(rows.map((r) => [r.a, r.b, r.winner, r.sourceA, r.sourceB]), [['r4-evidence', 'x-run-b', 'a', 'library', 'generated'], ['r4-evidence', 'x-run-c', 'a', 'library', 'brand']])
  assert.ok(rows.every((r) => !('promote' in r)), '올리기를 안 눌렀으면 promote 칸이 없다')
  // c 를 골랐다 — 진 쪽이 앞 칸이면 winner 는 b
  rows = pairRows(c, { pick: 'c', ...m })
  assert.deepEqual(rows.map((r) => [r.a, r.b, r.winner]), [['r4-evidence', 'x-run-c', 'b'], ['x-run-b', 'x-run-c', 'b']])
  // 올리기: a 를 골랐고 b·c 를 올린다 → 줄마다 하나씩
  rows = pairRows(c, { pick: 'a', promote: { b: true, c: true }, ...m })
  assert.deepEqual(rows.map((r) => r.promote), ['b', 'b'])
  // c 를 골랐고 b·c 를 올린다 → c 는 (a,c) 줄의 b 쪽, b 는 (b,c) 줄의 a 쪽
  rows = pairRows(c, { pick: 'c', promote: { b: true, c: true }, ...m })
  assert.deepEqual(rows.map((r) => [r.a, r.b, r.promote]), [['r4-evidence', 'x-run-c', 'b'], ['x-run-b', 'x-run-c', 'a']])
  // 이긴 안만 올린다 — 후보가 든 첫 줄에 하나
  rows = pairRows(c, { pick: 'b', promote: { b: true }, ...m })
  assert.deepEqual(rows.map((r) => r.promote), ['b', undefined])
  // 거절: 라이브러리 안 올리기 · 없는 후보 · 없는 pick
  assert.throws(() => pairRows(c, { pick: 'a', promote: { a: true }, ...m }), /라이브러리 안이라 올리지 않는다/)
  assert.throws(() => pairRows(c, { pick: 'z', ...m }), /후보 목록/)
  assert.throws(() => pairRows(c, { pick: 'a', promote: { q: true }, ...m }), /후보 목록/)
  // 모양: 엄격(모르는 칸·잘못된 날짜·winner)
  assert.throws(() => PairRow.parse({ ...rows[0], extra: 1 }))
  assert.throws(() => PairRow.parse({ ...rows[0], date: '어제' }))
  assert.throws(() => PairRow.parse({ ...rows[0], winner: 'c' }))
})

test('recordFinal: 올릴 후보를 먼저 전부 검사한다 — 하나라도 거절되면 초안도 줄도 없다 · 성공하면 초안이 결선 날짜·원형·브리프를 받는다 · 다시 돌려도 같은 줄·같은 승격을 또 하지 않는다', () => {
  const { run, recipes, pairs } = fresh('t5')
  const opt = { run, recipesDir: recipes, pairsFile: pairs, date: DATE }
  const dj = join(run, 'c', 'recipe', 'DESIGN.md')
  const good = readFileSync(dj, 'utf8')
  const noHero = parseRecipe(good); delete noHero.hero
  writeFileSync(dj, serializeRecipe(noHero))
  assert.throws(() => recordFinal({ ...opt, pick: 'b', promote: { b: true, c: true } }), PromoteError)
  assert.deepEqual(readdirSync(recipes), ['r10-console'], 'c 가 거절되면 b 의 초안도 쓰지 않는다')
  assert.equal(existsSync(pairs), false, '결선 줄도 쓰지 않는다')
  writeFileSync(dj, good)
  // 성공: b 를 골랐고 b 를 올린다. 원형·브리프는 실행 폴더 brief.json 에서.
  const res = recordFinal({ ...opt, pick: 'b', promote: { b: true } })
  assert.equal(res.rows.length, 2)
  assert.equal(res.written.length, 2)
  assert.equal(res.promoted.length, 1)
  assert.equal(res.promoted[0].already, undefined)
  const lines = readPairs(pairs)
  assert.deepEqual(lines.map((l) => l.winner), ['b', 'a'], '(a,b) 줄에서 b 가 이기고, (b,c) 줄에서 b 는 앞 칸이라 a')
  assert.equal(lines.filter((l) => l.promote).length, 1)
  assert.ok(lines.every((l) => l.archetype === 'saas' && l.brief === '치과 예약 안내' && l.date === DATE))
  const md = readFileSync(res.promoted[0].file, 'utf8')
  assert.match(md, /결선 날짜: 2026-09-30/)
  assert.match(md, /원형·브리프: saas · 치과 예약 안내/)
  // 같은 결정을 다시 돌린다: 승격은 건너뛰고(이미 올림), 같은 줄은 쓰지 않는다.
  const again = recordFinal({ ...opt, pick: 'b', promote: { b: true } })
  assert.equal(again.promoted[0].already, true)
  assert.equal(again.promoted[0].id, res.promoted[0].id)
  assert.equal(again.written.length, 0)
  assert.equal(readPairs(pairs).length, 2)
  assert.deepEqual(readdirSync(recipes).sort(), ['r10-console', res.promoted[0].id].sort(), '초안이 하나 더 생기지 않는다')
  // 올리기 없이 같은 안을 고른 결정은 다른 줄이라 새로 쓴다(옛 줄은 그대로).
  const noUp = recordFinal({ ...opt, pick: 'b' })
  assert.equal(noUp.written.length, 1)
  assert.equal(readPairs(pairs).length, 3)
  assert.equal(recordFinal({ ...opt, pick: 'b' }).written.length, 0)
})

test('recordFinal --prune: 고르지도 올리지도 않은 생성·브랜드 후보의 build/ 만 지운다(C84) — 초안 recipe/DESIGN.md 는 남는다', () => {
  const { run, recipes, pairs } = fresh('t6')
  assert.ok(['a', 'b', 'c'].every((k) => k === 'a' || existsSync(join(run, k, 'build'))))
  const res = recordFinal({ run, recipesDir: recipes, pairsFile: pairs, date: DATE, pick: 'a', promote: { b: true }, prune: true })
  assert.deepEqual(res.pruned, ['c'], '올린 b·고른 a 는 두고 c 만')
  assert.ok(existsSync(join(run, 'b', 'build')))
  assert.ok(!existsSync(join(run, 'c', 'build')))
  assert.ok(existsSync(join(run, 'c', 'recipe', 'DESIGN.md')), '다시 컴파일할 수 있게 초안은 남는다')
  // 초안이 없으면 다시 컴파일할 수 없으니 지우지 않는다
  const { run: run2 } = fresh('t6b')
  rmSync(join(run2, 'c', 'recipe'), { recursive: true })
  assert.deepEqual(pruneLosers(run2, loadCandidates(run2), { pick: 'a' }), ['b'])
  assert.ok(existsSync(join(run2, 'c', 'build')))
  // --prune 이 없으면 아무것도 안 지운다
  const { run: run3, recipes: rc3, pairs: pr3 } = fresh('t6c')
  assert.deepEqual(recordFinal({ run: run3, recipesDir: rc3, pairsFile: pr3, date: DATE, pick: 'a' }).pruned, [])
  assert.ok(existsSync(join(run3, 'b', 'build')) && existsSync(join(run3, 'c', 'build')))
})

test('골든 실행 폴더: candidate.json 에 blockers 만 있고 후보 머리는 01-direction.json data 에 있어도 결선 기록·승격이 된다(P3-4 골든 18)', () => {
  const { run, recipes, pairs } = fresh('t6golden')
  for (const k of ['a', 'b', 'c']) {
    const { blockers, ...data } = readJ(join(run, k, 'candidate.json'))
    write(join(run, k, 'candidate.json'), { blockers })
    write(join(run, k, '01-direction.json'), { inputHash: 'x', producedAt: 'x', data })
  }
  rmSync(join(run, 'brief.json'))
  assert.deepEqual(loadCandidates(run).map((c) => [c.id, c.source]), [['a', 'library'], ['b', cands[1].source], ['c', cands[2].source]])
  const res = recordFinal({ run, recipesDir: recipes, pairsFile: pairs, date: DATE, archetype: 'saas', brief: '치과 예약 안내', pick: 'b', promote: { b: true } })
  assert.equal(res.written.length, 2)
  assert.equal(res.promoted.length, 1)
  assert.match(readFileSync(res.promoted[0].file, 'utf8'), /원형·브리프: saas · 치과 예약 안내/)
})

test('readPairs: 깨진 줄은 줄 번호와 함께 던진다 · 파일이 없으면 빈 목록 · 진짜 pairs.jsonl 이 있으면 전부 모양이 맞는다', () => {
  assert.deepEqual(readPairs(join(work, '없음.jsonl')), [])
  const f = join(work, 'bad.jsonl')
  writeFileSync(f, JSON.stringify({ a: 'x', b: 'y', winner: 'a', archetype: 'saas', brief: 'b', date: DATE, sourceA: 'library', sourceB: 'brand' }) + '\n{"a":1}\n')
  assert.throws(() => readPairs(f), /2째 줄/)
  const real = join(ROOT, 'factory', 'board', 'pairs.jsonl')
  if (existsSync(real)) assert.ok(readPairs(real).length >= 0)
})

test('보드 데이터: 후보마다 출처·blockers·공개 상태·07-qa 요약·미리보기 주소를 읽고, 07-qa 가 없으면 공개 「확인 안 됨」이다', () => {
  const d = loadBoardData(base)
  assert.equal(d.archetype, 'saas'); assert.equal(d.brief, '치과 예약 안내')
  const [a, b, c] = d.cands
  assert.deepEqual(d.cands.map((x) => x.source), ['library', 'generated', 'generated'])
  assert.equal(a.state, 'ready'); assert.deepEqual(a.qa.gates, { pass: 2 })
  assert.equal(a.previewUrl, 'https://wf-preview-abc.vercel.app')
  assert.equal(b.state, 'blocked'); assert.equal(b.blockers.length, 2 + 8, 'candidate.json 과 07-qa 의 사유를 합친다(같은 줄은 한 번)')
  assert.deepEqual(b.qa.gates, { pass: 1, fail: 1, tool: 1 })
  assert.equal(c.state, 'unknown', '07-qa 가 없고 사유도 없으면 「공개 가능」이 아니라 확인 안 됨')
  assert.equal(c.qa, null)
  assert.equal(c.previewUrl, null)
  assert.ok(d.cands.every((x) => x.media === null))
})

test('보드 HTML: 출처 배지 · blockers 전부(접힘 포함·이스케이프) · 공개 상태 · 고르기 버튼 · 생성·브랜드 카드에만 「라이브러리로 올리기」 · 스크립트 문법', () => {
  const d = loadBoardData(base)
  const html = buildDirectionBoard(d)
  const card = (id) => html.match(new RegExp(`<article class="card" id="card-${id}"[\\s\\S]*?</article>`))[0]
  assert.match(card('a'), /class="badge b-library"[^>]*>검증</); assert.match(card('b'), /class="badge b-generated"[^>]*>생성</)
  for (const id of ['a', 'b', 'c']) assert.match(card(id), new RegExp(`data-pick="${id}" aria-pressed="false"`))
  // 라이브러리 카드에는 올리기 체크가 없고, 생성 카드에는 있다.
  assert.ok(!/data-promote/.test(card('a')))
  assert.match(card('b'), /<input type="checkbox" data-promote="b"> 라이브러리로 올리기/); assert.match(card('c'), /data-promote="c"/)
  assert.equal((html.match(/<input type="checkbox" data-promote=/g) ?? []).length, 2)
  // blockers: 10줄이 모두 있고(앞 5줄 + 접힌 5줄), 스크립트 태그는 글자로만 나간다.
  const b = card('b')
  assert.equal((b.match(/<li data-blocker>/g) ?? []).length, 10)
  assert.match(b, /공개 불가 <span class="n">10가지<\/span>/)
  assert.match(b, /<details><summary>나머지 5가지 보기<\/summary>/)
  assert.match(b, /공개 불가 — 필수 섹션 블록 없음: home\/notice/)
  assert.ok(!b.includes('<script>alert'), '사유 속 태그는 이스케이프된다')
  assert.match(b, /QA 사유 8 &lt;script&gt;/)
  assert.match(card('a'), /data-state="ready"[\s\S]*공개 가능/); assert.match(card('c'), /data-state="unknown"[\s\S]*공개 여부 확인 안 됨/)
  assert.match(card('a'), /data-preview/); assert.match(card('a'), /rel="noopener noreferrer"/)
  assert.match(b, /관문 1개 통과 · 판정 실패 1개 · 도구 실패 1개 · 경고 1개/)
  assert.match(card('a'), /data-media="none"/, '촬영 전이면 영상 자리에 그렇게 적는다')
  // 스크립트가 문법 오류 없이 컴파일된다.
  const script = html.match(/<script>\n([\s\S]*?)\n<\/script>\n<\/body>/)[1]
  assert.doesNotThrow(() => new vm.Script(script))
  assert.ok(!script.includes('${'), '템플릿 조각이 남지 않았다')
  assert.match(html, /<title>방향 보드<\/title>/)
})

test('보드 카드의 공개 불가 사유는 두 줄로 따로 보인다(Task 6.1·D19): 품질 사유 줄 + 입력 대기 줄, 사유마다 갈래 표지, 품질이 먼저, 접힘은 전체에서 앞 5줄', () => {
  const html = buildDirectionBoard(loadBoardData(base))
  const card = (id) => html.match(new RegExp(`<article class="card" id="card-${id}"[\\s\\S]*?</article>`))[0]
  const b = card('b')
  // b = 사유 10줄: 입력 대기 1(확인 필요 사실) + 품질 9(필수 섹션 블록 없음 + QA 사유 8)
  const lines = [...b.matchAll(/<p class="kind-line" data-kind-line="(\w+)">([\s\S]*?)<\/p>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()])
  assert.deepEqual(lines.map(([k]) => k), ['quality', 'input'], '두 줄이고 품질이 먼저다')
  assert.match(lines[0][1], /^품질 사유 9가지/); assert.match(lines[1][1], /^입력 대기 1가지/)
  assert.match(b, /공개 불가 <span class="n">10가지<\/span>/, '제목의 합계는 그대로')
  // 사유 줄마다 갈래 표지(<li data-blocker> 모양은 그대로, 안에 표지 span)
  const lis = [...b.matchAll(/<li data-blocker><span class="kind" data-kind="(\w+)">[^<]*<\/span> ([\s\S]*?)<\/li>/g)].map((m) => [m[1], m[2]])
  assert.equal(lis.length, 10)
  assert.deepEqual(lis.map(([k]) => k), [...Array(9).fill('quality'), 'input'], '품질 9줄 다음에 입력 1줄')
  assert.equal(lis.find(([, t]) => t.includes('확인 필요 사실: business.phone'))[0], 'input')
  assert.equal(lis.find(([, t]) => t.includes('필수 섹션 블록 없음: home/notice'))[0], 'quality')
  // 앞 5줄만 펼치고 나머지 5줄은 하나의 접힘에 — 입력 대기 줄이 접힘 안으로 밀려도 두 줄 요약은 접힘 밖에 있다
  const open = b.split('<details>')[0], folded = b.split('<details>')[1]
  assert.equal((open.match(/<li data-blocker>/g) ?? []).length, 5); assert.equal((folded.match(/<li data-blocker>/g) ?? []).length, 5)
  assert.ok(open.includes('data-kind-line="input"'), '입력 대기 줄은 접히지 않는다')
  assert.ok(!card('a').includes('data-kind-line') && !card('c').includes('data-kind-line'), '공개 가능·확인 안 됨 카드에는 두 줄이 없다')
  // 입력 대기만 남은 카드: 품질 사유 0가지가 눈에 보인다(기계 기준 = 품질 0)
  const run = join(work, 't6-1-run')
  cpSync(base, run, { recursive: true })
  write(join(run, 'c', 'candidate.json'), { ...readJ(join(run, 'c', 'candidate.json')), blockers: ['공개 불가 — 사이트 주소 미정', '공개 불가 — 실제 사진 필요: home/hero/x'] })
  const c = buildDirectionBoard(loadBoardData(run)).match(/<article class="card" id="card-c"[\s\S]*?<\/article>/)[0]
  const cl = [...c.matchAll(/<p class="kind-line" data-kind-line="(\w+)">([\s\S]*?)<\/p>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()])
  assert.deepEqual(cl.map(([k]) => k), ['quality', 'input'])
  assert.match(cl[0][1], /^품질 사유 0가지/); assert.match(cl[1][1], /^입력 대기 2가지/)
  assert.equal((c.match(/data-kind="quality"/g) ?? []).length, 0)
})

test('08-board.json 의 publishLabel 과 보드 카드 두 줄은 같은 낱말이다(FV1 5.2) — 라벨은 「공개 불가: 품질 사유 N가지 · 입력 대기 N가지」', () => {
  const html = buildDirectionBoard(loadBoardData(base))
  const b = html.match(/<article class="card" id="card-b"[\s\S]*?<\/article>/)[0]
  const lines = [...b.matchAll(/<p class="kind-line" data-kind-line="(\w+)">([\s\S]*?)<\/p>/g)].map((m) => m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  const quality = lines[0].match(/^품질 사유 \d+가지/)[0], input = lines[1].match(/^입력 대기 \d+가지/)[0]
  // 카드 b 와 같은 개수(품질 9 · 입력 1)의 사유를 보드 자료 만드는 함수에 그대로 넣는다.
  const blockers = [...Array(9).fill('공개 불가 — 운영 점검 실패: cls 0.2 > 0.1'), '공개 불가 — 확인 필요 사실: business.phone']
  assert.equal(boardData({ cand: { id: 'b' }, qa: { publishable: false, blockers, gates: [] } }).publishLabel, `공개 불가: ${quality} · ${input}`)
})

test('보드 데이터: 브랜드 조정 내역(C23)이 카드에 보인다 · 영상 목록이 있으면 영상·휴대폰 정지가 붙는다', () => {
  const run = join(work, 't9-run')
  cpSync(base, run, { recursive: true })
  const cj = join(run, 'c', 'candidate.json')
  write(cj, { ...readJ(cj), source: 'brand', brand: {
    adjustments: [{ role: 'primary', theme: 'light', from: '#ffcc00', to: '#e6b800', reason: '명도만 조정: 본문 7:1' }],
    fontSubstitutions: [{ role: 'display', asked: 'Acme Sans', used: 'Pretendard', reason: '라이선스 확인 안 된 서체' }] } })
  const manifest = { options: [{ recipe: 'c', option: 'A', videos: [{ codec: 'h264', file: 'c-A.mp4' }, { codec: 'vp9', file: 'c-A.webm' }], stills: [{ width: 1440, file: 'c-A-1440.webp' }, { width: 375, file: 'c-A-375.webp' }] }] }
  const html = buildDirectionBoard(loadBoardData(run, { manifest }))
  const c = html.match(/<article class="card" id="card-c"[\s\S]*?<\/article>/)[0]
  assert.match(c, /브랜드 조정 내역 <span class="n">2건<\/span>/)
  assert.match(c, /primary\(light\): #ffcc00 → #e6b800 — 명도만 조정: 본문 7:1/)
  assert.match(c, /display: Acme Sans → Pretendard — 라이선스 확인 안 된 서체/)
  assert.match(c, /<source src="video\/c-A\.mp4" type="video\/mp4"><source src="video\/c-A\.webm" type="video\/webm">/)
  assert.match(c, /poster="shots\/c-A-1440\.webp"/); assert.match(c, /src="shots\/c-A-375\.webp"/)
  assert.match(c, /data-badge|class="badge b-brand"[^>]*>브랜드</)
  assert.ok(!/data-adjust/.test(html.match(/<article class="card" id="card-b"[\s\S]*?<\/article>/)[0]), '생성 카드에는 조정 내역이 없다')
})

test('07-qa 가 공개 불가라고 했는데 사유가 비어 있으면, 그 사실 자체를 사유로 보인다(조용히 「공개 가능」이 되지 않는다)', () => {
  const run = join(work, 't10-run')
  cpSync(base, run, { recursive: true })
  write(join(run, 'c', '07-qa', 'summary.json'), { publishable: false, blockers: [], gates: [], warnings: [] })
  const c = loadBoardData(run).cands[2]
  assert.equal(c.state, 'blocked')
  assert.match(c.blockers[0], /사유가 기록되지 않았다/)
})

test('촬영 작업: video.mjs 그대로 — 후보 사이트 주소·선택자를 싣고, 주소 없는 후보는 건너뛰며, 하나도 없으면 던진다', () => {
  const jobs = candidateJobs(base)
  assert.deepEqual(jobs.map((j) => [j.recipe, j.option, j.url, j.sel]), [['a', 'A', 'https://wf-preview-abc.vercel.app', 'main']], '08-board.json 의 미리보기 주소가 있는 a 만')
  assert.deepEqual(jobs[0].files, fileNames('a', 'A'))
  assert.equal(jobs[0].theme === 'light' || jobs[0].theme === 'dark', true)
  const two = candidateJobs(base, { b: 'http://127.0.0.1:4100' })
  assert.deepEqual(two.map((j) => [j.recipe, j.url]), [['a', 'https://wf-preview-abc.vercel.app'], ['b', 'http://127.0.0.1:4100']])
  assert.equal(two[1].theme === 'light' || two[1].theme === 'dark', true)
  const run = join(work, 't11-run')
  cpSync(base, run, { recursive: true })
  rmSync(join(run, 'a', '08-board.json'))
  assert.throws(() => candidateJobs(run), /촬영할 주소가 있는 후보가 없다/)
  assert.deepEqual(candidateJobs(run, { c: 'http://127.0.0.1:1' }).map((j) => j.recipe), ['c'])
})
