// 후보 레시피 컴파일(P3-3 Task 5). 계획 Step 1 + 계획과 다른 점(코드가 정본):
//   · loadRecipes()·r1.head 는 없다 → parseRecipe(recipes/<id>/DESIGN.md) 가 머리다. 컴파일 결과는 outRoot/registry/factory/{r,recipes}/<id>/ 에 나간다(buildRecipe 배치 그대로).
//   · 바이트 비교는 ui/*.tsx 뿐 아니라 r/<id>/ 아래 전부(GENERATED.md·<id>.css·icons/index.ts)와 README.generated.md, 그리고 레지스트리 항목(-alt 포함)까지 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRecipe, compileRecipeTo, recipeIds, lintRecipe, pkgVersions } from './recipe.mjs'
import { compileCandidate, CandidateRejectedError, tmpRecipeId, serializeRecipe, GENERATED_MARK } from '../stamp/compile-candidate.mjs'
import { pickDirections } from '../stamp/directions.mjs'
import { brandToRecipeHead } from '../stamp/brand.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'registry', 'factory')
const REF = `v${JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version}`
const head = (id) => parseRecipe(readFileSync(join(FACTORY, 'recipes', id, 'DESIGN.md'), 'utf8'))
const tmp = () => mkdtempSync(join(tmpdir(), 'wf-t5-'))
const walk = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name), base) : [relative(base, join(dir, d.name)).split('\\').join('/')])).sort()
const repoItems = JSON.parse(readFileSync(join(FACTORY, 'r', 'registry.json'), 'utf8')).items

test('compileRecipeTo reproduces the library compile byte-for-byte (r/<id>/ 전부 + README + 항목)', async () => {
  for (const id of ['r1-measure', 'r3-woodblock']) {
    const out = tmp()
    try {
      const res = await compileRecipeTo(head(id), out, { ref: REF })
      const mine = join(out, 'registry', 'factory', 'r', id)
      const repo = join(FACTORY, 'r', id)
      assert.deepEqual(walk(mine), walk(repo), `${id}: 파일 목록`)
      for (const f of walk(repo)) assert.equal(readFileSync(join(mine, f), 'utf8'), readFileSync(join(repo, f), 'utf8'), `${id}/${f}`)
      assert.equal(readFileSync(join(out, 'registry', 'factory', 'recipes', id, 'README.generated.md'), 'utf8'), readFileSync(join(FACTORY, 'recipes', id, 'README.generated.md'), 'utf8'), `${id} README`)
      // 항목: 저장소 r/registry.json 의 이 레시피 항목과 같다(gen-registry 는 컴파일된 r/<id>/ui 를 읽어 같은 recipeItems 로 만든다).
      const expected = repoItems.filter((i) => i.name === id || i.name.startsWith(`${id}-`))
      assert.deepEqual(res.items.slice().sort((a, b) => (a.name < b.name ? -1 : 1)), expected.slice().sort((a, b) => (a.name < b.name ? -1 : 1)), `${id} items`)
    } finally { rmSync(out, { recursive: true, force: true }) }
  }
})

test('the -alt path goes through the same compile: r1-measure-alt item is produced and equals the repo item', async () => {
  const r1 = head('r1-measure')
  assert.ok(r1.alternates, 'r1-measure 는 B안이 있다(전제)')
  const out = tmp()
  try {
    const { items } = await compileRecipeTo(r1, out, { ref: REF })
    const alt = items.find((i) => i.name === 'r1-measure-alt')
    assert.ok(alt, 'r1-measure-alt 항목')
    assert.equal(alt.meta.recipe.alternateOf, 'r1-measure')
    assert.deepEqual(alt, repoItems.find((i) => i.name === 'r1-measure-alt'))
  } finally { rmSync(out, { recursive: true, force: true }) }
})

test('compileRecipeTo refuses to run without an outRoot (저장소에 조용히 쓰지 않는다)', async () => {
  await assert.rejects(() => compileRecipeTo(head('r1-measure'), undefined), /outRoot/)
})

test('a generated head compiles: ui/*.tsx count equals the library, DESIGN.md carries the mark and round-trips', async () => {
  const { candidates } = await pickDirections({ brief: { archetype: 'saas' }, archetype: 'saas', seed: 7, weights: [] })
  const gen = candidates.find((c) => c.source === 'generated')
  assert.ok(gen, '생성 후보')
  const runDir = join(tmp(), 'run-t5')
  try {
    const res = await compileCandidate(gen, runDir)
    assert.equal(res.recipeId, tmpRecipeId(runDir, gen.id))
    assert.match(res.recipeId, /^x-run-t5-[a-z0-9]+$/)
    assert.equal(res.aiTell, undefined, 'AI 티는 Task 11 이 잰다')
    const ui = readdirSync(join(res.registryDir, res.recipeId, 'ui')).filter((f) => f.endsWith('.tsx'))
    const libUi = readdirSync(join(FACTORY, 'r', 'r1-measure', 'ui')).filter((f) => f.endsWith('.tsx'))
    assert.equal(ui.length, libUi.length, 'ui 파일 개수가 라이브러리와 같다')
    for (const f of ui) assert.ok(!readFileSync(join(res.registryDir, res.recipeId, 'ui', f), 'utf8').includes('@/registry/factory/ui/'), `${f}: 부품 import 는 임시 레시피 폴더를 가리킨다`)
    // DESIGN.md: 머리 + 「생성 — 승격 전」 표시. 다시 읽으면 같은 머리이고 lint 를 통과한다.
    const md = readFileSync(res.designPath, 'utf8')
    assert.ok(md.includes(GENERATED_MARK))
    const back = parseRecipe(md)
    assert.equal(back.id, res.recipeId)
    assert.deepEqual(lintRecipe(back), [])
    const { body, ...h } = back
    const { body: b0, ...h0 } = gen.recipe
    assert.deepEqual(h, { ...h0, id: res.recipeId })
    assert.ok(body.startsWith(b0.trim()))
    // 로컬 레지스트리: 항목 이름은 전부 tmp id 로 시작하고, registry.json 이 항목과 같다.
    const reg = JSON.parse(readFileSync(join(res.registryDir, 'registry.json'), 'utf8'))
    assert.deepEqual(reg.items, res.items)
    assert.ok(reg.name && String(reg.homepage).startsWith('https://'), 'shadcn build 는 루트 registry.json 에 name·homepage 를 요구한다(골든 실행에서 생성 후보 06 이 이걸로 죽었다)')
    assert.ok(reg.items.every((i) => i.name === res.recipeId || i.name.startsWith(`${res.recipeId}-`)))
    assert.ok(reg.items.some((i) => i.type === 'registry:base' && i.name === res.recipeId))
    // 저장소 생성물 경로에는 아무것도 쓰지 않았다.
    assert.ok(!existsSync(join(FACTORY, 'r', res.recipeId)) && !existsSync(join(FACTORY, 'recipes', res.recipeId)))
  } finally { rmSync(dirname(runDir), { recursive: true, force: true }) }
})

test('a brand head (Task 4) compiles too, with the logo kept in the DESIGN.md head', async () => {
  const presets = JSON.parse(readFileSync(join(ROOT, 'references', 'styles', 'presets.json'), 'utf8')).presets
  const r = brandToRecipeHead({ colors: ['#0B5FFF', '#FFFFFF'], logo: 'brand/logo.svg' }, presets[0], { archetype: 'saas' })
  assert.equal(r.blocked, undefined)
  const runDir = join(tmp(), 'run-brand')
  try {
    const res = await compileCandidate({ id: 'c', slot: 'bold', source: 'brand', recipe: r.head }, runDir)
    assert.equal(res.recipeId, 'x-run-brand-c')
    const back = parseRecipe(readFileSync(res.designPath, 'utf8'))
    assert.equal(back.brand?.logo, 'brand/logo.svg')
    assert.ok(existsSync(join(res.registryDir, res.recipeId, 'ui')) && res.items.some((i) => i.name === res.recipeId))
  } finally { rmSync(dirname(runDir), { recursive: true, force: true }) }
})

test('a library candidate only points at r/<id> (아무것도 쓰지 않는다)', async () => {
  const runDir = join(tmp(), 'run-lib')
  try {
    const res = await compileCandidate({ id: 'a', slot: 'safe', source: 'library', recipe: 'r1-measure' }, runDir)
    assert.equal(res.recipeId, 'r1-measure')
    assert.equal(res.registryDir, join(FACTORY, 'r'))
    assert.ok(!existsSync(join(runDir, 'a')), '라이브러리 후보는 실행 폴더에 쓰지 않는다')
    await assert.rejects(() => compileCandidate({ id: 'a', source: 'library', recipe: 'r0-nope' }, runDir), /r0-nope/)
  } finally { rmSync(dirname(runDir), { recursive: true, force: true }) }
})

test('a head that fails lint is rejected with rule ids, and nothing is compiled', async () => {
  const good = head('r1-measure')
  const broken = structuredClone(good)
  broken.color.light.foreground = broken.color.light.background // 본문 대비 붕괴
  const violations = lintRecipe({ ...broken, id: 'x-probe-a' })
  assert.ok(violations.length, '전제: 이 머리는 lint 에서 떨어진다')
  const runDir = join(tmp(), 'run-bad')
  try {
    // source brand: 라이브러리 축 차이는 보지 않는다(색이 축) — 이 테스트는 lint 탈락만 본다.
    await assert.rejects(() => compileCandidate({ id: 'a', slot: 'bold', source: 'brand', recipe: broken }, runDir), (e) => {
      assert.ok(e instanceof CandidateRejectedError, String(e))
      assert.ok(e.reasons.includes('lint:contrast') && e.reasons.every((r) => /^lint:[a-z0-9-]+$/.test(r)), JSON.stringify(e.reasons))
      assert.ok(e.violations.length)
      return true
    })
    assert.ok(!existsSync(join(runDir, 'a', 'build')), '떨어진 후보는 컴파일하지 않는다')
    assert.ok(!existsSync(join(runDir, 'a', 'recipe', 'DESIGN.md')), '떨어진 후보는 DESIGN.md 도 남기지 않는다')
  } finally { rmSync(dirname(runDir), { recursive: true, force: true }) }
})

test('a generated head too close to a library recipe is rejected (axis-distance:library:<id>)', async () => {
  const runDir = join(tmp(), 'run-near')
  const clone = { ...structuredClone(head('r1-measure')), id: 'gen-copy' } // 라이브러리 그대로 = 거리 0
  try {
    await assert.rejects(() => compileCandidate({ id: 'b', slot: 'new', source: 'generated', recipe: clone }, runDir), (e) => {
      assert.ok(e instanceof CandidateRejectedError)
      assert.ok(e.reasons.includes('axis-distance:library:r1-measure'), JSON.stringify(e.reasons))
      return true
    })
  } finally { rmSync(dirname(runDir), { recursive: true, force: true }) }
})

test('a run dir inside the tracked generated paths is refused (registry/ · ai/)', async () => {
  const bad = join(FACTORY, 'r', '__t5-run')
  await assert.rejects(() => compileCandidate({ id: 'a', source: 'generated', recipe: head('r1-measure') }, bad), /추적|생성물|tracked/)
  assert.ok(!existsSync(bad))
})

test('tmpRecipeId sanitises the run folder name and candidate id', () => {
  assert.equal(tmpRecipeId('/x/out/Run_2026-09-30 A', 'c'), 'x-run-2026-09-30-a-c')
  assert.throws(() => tmpRecipeId('/x/out/___', 'a'), /run/)
  assert.throws(() => tmpRecipeId('/x/out/run', ''), /후보/)
})

test('serializeRecipe: head + body round-trip through parseRecipe (library head, no mark)', () => {
  const r1 = head('r1-measure')
  const md = serializeRecipe(r1)
  const back = parseRecipe(md)
  assert.deepEqual(back, r1)
})

test('library recipe ids are unchanged after compile tests (no file written into the repo r/)', () => {
  for (const id of recipeIds()) assert.ok(statSync(join(FACTORY, 'r', id)).isDirectory())
  assert.deepEqual(readdirSync(join(FACTORY, 'r')).filter((n) => n.startsWith('x-')), [])
  assert.ok(pkgVersions())
})
