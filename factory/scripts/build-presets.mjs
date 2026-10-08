// 스타일 프리셋·레시피 분해 재료를 만든다(P3-2 Task 16a, 접합면 J4·J5). gen:all 의 한 단계 — 원천이 모두 저장소 안이다
// (references/styles/styles.json · registry/factory/recipes/<id>/DESIGN.md · references/palettes/palettes.json · references/fonts/fonts.json).
//   references/styles/presets.json       사전의 allow·allow-with-rules 스타일마다 축 조합 프리셋 + 라이브러리 레시피마다 프리셋(source "recipe:<id>")
//   references/palettes/recipe-derived.json  레시피 A 색(+ 보드 B안 색)을 팔레트로(source "recipe:<id>") — build-palettes.mjs 가 입력으로 읽어 palettes.json 에 싣는다
//   references/fonts/pairs.json           레시피 A 서체(+ B안 서체) 짝(source "recipe:<id>")
// 승격된 레시피도 recipes/ 에 들어오면 다음 gen:all 에서 같은 recipeToMaterials 로 풀에 든다.
// 사용: node factory/scripts/build-presets.mjs [--check]   (--check: 파일이 생성 결과와 다르면 종료 1)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyAlternate } from './recipe.mjs'
import { loadStyles } from './styles-ref.mjs'
import {
  PRESETS_FILE, RECIPE_PALETTES_FILE, PAIRS_FILE, NOVELTY_KEYS, loadLibrary, recipeToMaterials, recipePalette, recipePair, catalogPreset, novelty, representative, loadPalettePool,
} from './style-presets.mjs'

const GEN = 'factory/scripts/build-presets.mjs'
const NL = String.fromCharCode(10)
const json = (o) => JSON.stringify(o, null, 1) + NL

export async function buildAll() {
  const library = loadLibrary()
  const mats = []
  for (const r of library) mats.push(await recipeToMaterials(r))
  // 보드 B안(alternates)도 검증된 재료다 — 색·서체만 풀에 더한다(축은 A와 같아 프리셋은 A 하나).
  const altPalettes = [], altPairs = []
  for (const r of library) if (r.alternates) {
    const b = applyAlternate(r)
    if (r.alternates.color || r.alternates.colorLogic) altPalettes.push(await recipePalette(b, { suffix: '-b', note: `보드 B안(alternates) — ${r.alternates.note}` }))
    if (r.alternates.fonts) altPairs.push(recipePair(b, '-b'))
  }
  const recipePalettes = [...mats.map((m) => m.palette), ...altPalettes].sort((a, b) => (a.id < b.id ? -1 : 1))
  const pairs = [...mats.map((m) => m.fontPair), ...altPairs].sort((a, b) => (a.id < b.id ? -1 : 1))

  const { styles } = loadStyles()
  const libPresets = mats.map((m) => m.preset)
  const catalog = styles.filter((s) => s.verdict !== 'ban').map(catalogPreset)
  // 풀: palettes.json + 방금 만든 레시피 분해분(아직 build-palettes 전이어도 풀에 든다)
  const byId = new Map(loadPalettePool().map((p) => [p.id, p]))
  for (const p of recipePalettes) byId.set(p.id, p)
  const pool = [...byId.values()]
  for (const p of catalog) {
    p.novelty = novelty(p, library)
    const rep = representative(p, { pool })
    p.sample = rep.head ? { palette: rep.palette.id, fonts: 'hint', recipeId: rep.head.id, tried: rep.tried.length } : { palette: null, fonts: 'hint', failures: rep.tried.slice(0, 5) }
  }
  const presets = [...catalog, ...libPresets].sort((a, b) => (a.id < b.id ? -1 : 1))
  const failed = catalog.filter((p) => !p.sample.palette).map((p) => p.id)
  const presetDoc = {
    $comment: `스타일 프리셋(P3-2 Task 16a, J4·J5) — 생성물: ${GEN} 로 다시 만든다(gen:all). 손으로 고치지 않는다. 읽는 곳: factory/scripts/style-presets.mjs listPresets·presetToRecipeHead(P3-3 찍어내기 ②·③).`,
    generator: GEN,
    novelty: { keys: NOVELTY_KEYS, definition: '라이브러리 레시피 10벌 각각과 11개 속성(축 B·I·C·T·H·R·S·D·X + motion + colorLogic 첫 값) 중 다른 것의 비율을 내고, 가장 가까운 레시피와의 값(최솟값). 0 = 라이브러리와 같은 조합, 1 = 모든 레시피와 11개 모두 다름. 머리에 없는 D·X 는 D1·X0 로 비교한다.' },
    rank: 'listPresets 점수 = rank_score(사전 순위, 레시피 프리셋은 사전값 0.5) × 원형 적합도(1 = 맞는 원형으로 적힘, 0.5 = 적히지 않았지만 호환표·레시피 규칙 통과, 0 = 걸림 → 뺀다)',
    sample: '사전 프리셋마다 대표 초안 — pickPalettes 순위대로 팔레트를 대 보고 presetToRecipeHead + lintRecipe 가 깨끗한 첫 팔레트(서체는 hintPair). /qa/presets 와 접촉 시트가 이것을 그린다.',
    counts: { total: presets.length, catalog: catalog.length, recipe: libPresets.length, sampleFailed: failed.length },
    presets,
  }
  const palDoc = { $comment: `레시피 분해 팔레트(P3-2 Task 16a, J5) — 생성물: ${GEN}. build-palettes.mjs 가 입력(--recipes)으로 읽어 palettes.json 에 싣는다. theme = 레시피 color.light·dark 그대로(왕복 테스트).`, generator: GEN, palettes: recipePalettes }
  const pairDoc = { $comment: `서체 짝(P3-2 Task 16a, J5) — 생성물: ${GEN}. 라이브러리 레시피(와 보드 B안)의 fonts 를 그대로. presetToRecipeHead 의 셋째 인자로 쓴다.`, generator: GEN, pairs }
  return { files: [[PRESETS_FILE, json(presetDoc)], [RECIPE_PALETTES_FILE, json(palDoc)], [PAIRS_FILE, json(pairDoc)]], failed, counts: presetDoc.counts }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const check = process.argv.includes('--check')
  const t0 = Date.now()
  const { files, failed, counts } = await buildAll()
  let stale = 0
  for (const [f, text] of files) {
    let have = ''
    try { have = readFileSync(f, 'utf8').replace(/\r\n/g, NL) } catch {}
    if (have === text) continue
    if (check) { stale++; console.error(`낡음: ${f}`) } else { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text) }
  }
  console.log(`build-presets: 프리셋 ${counts.total}(사전 ${counts.catalog} · 레시피 ${counts.recipe}) · 대표 초안 실패 ${failed.length}${failed.length ? ` (${failed.join(', ')})` : ''} · ${Date.now() - t0}ms${check ? ` · 낡은 파일 ${stale}` : ''}`)
  process.exit(stale ? 1 : 0)
}
