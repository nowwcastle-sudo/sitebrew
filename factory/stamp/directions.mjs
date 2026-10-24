// 01-direction — 방향 3안 고르기(P3-3 Task 3, §9 Q7 · J5 · J11 · 대장 C10).
//   ① safe = 라이브러리 레시피: 원형 적합도(레시피 머리 archetypes) × 가중치, 동률은 씨앗으로 섞은 순서.
//   ② new  = 생성: listPresets({ archetype }) 상위 N 프리셋 × 팔레트(pickPalettes 상위 3) × 서체 짝 2(hintPair · 씨앗으로 고른 레시피 짝) → presetToRecipeHead.
//   ③ bold = 생성 중 새로움(novelty) 최고. 브랜드 입력이 있으면 brand.mjs(Task 4) brandToRecipeHead 결과.
// 탈락: lintRecipe 문제 · ①과 axisDistance < 2 · 라이브러리 한 벌이라도 < 2 → rejected 에 규칙 id 로 남긴다. 칸이 끝까지 안 채워지면
// DirectionsShortError(2안만 조용히 내지 않는다 — Review Focus 2).
// 팔레트 다양성(C10): 프리셋 대표 팔레트가 몇 개에 몰려 있어서, ②·③은 서로 그리고 ①과 팔레트를 같이 쓰지 않는 후보를 먼저 고른다.
// 통과하는 다른 후보가 없을 때만 같은 팔레트를 쓴다(why 에 적는다).
// 가중치(J11): conversions ≥ 30 인 행만, 통과한 후보들 사이의 칸 안 순서만 바꾼다. Math.random 은 쓰지 않는다(mulberry32(seed)).
// 씨앗과 생성 후보(P4GD · 대장 C272): ②③이 쓰는 팔레트는 프리셋마다 「순위 위 PALETTE_WINDOW 개」 중 씨앗이 PALETTES_PER_PRESET 개를 뽑는다(별도 PRNG 줄기 —
// 라이브러리 고름·서체 짝 줄기는 그대로). 뽑힌 뒤의 규칙(lint·축 차이·원형 적합도·③ 새로움 최고·② 점수 1등·C10)은 그대로라 「어느 적격 후보를 쓰나」만 씨앗이 바꾼다.
// 같은 씨앗·같은 브리프면 글자까지 같다. 골든 세트 전체의 겹침 없음은 golden.mjs findSeed 가 씨앗을 골라 보장한다.
// 대담안(factory v1 Task 4.2): 후보 칸은 안마다 boldness("standard"|"bold")를 갖고 ③ 칸이 대담안이다(boldMode "motion"|"layout" 은 ③ 에만). 출처 구성은 표시를 더하기 전과 같다(시험 bold.test.mjs 가 고정 사본과 비교).
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AXIS_ORDER, axisValue } from '../scripts/axes.mjs'
import { checkCompat } from '../scripts/compat.mjs'
import { lintRecipe } from '../scripts/recipe.mjs'
import { recipeDistance } from '../scripts/recipes-distinct.mjs'
import { boldModeFor } from '../qa/bold-safety.mjs'
import { conditionIdsOf } from './brief.mjs'
import { moodProfile, moodSet, moodOverlap } from './mood.mjs'
import { listPresets, pickPalettes, loadPalettePool, presetToRecipeHead, hintPair, loadPairs, loadLibrary, novelty } from '../scripts/style-presets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const WEIGHTS_FILE = join(ROOT, 'factory', 'learning', 'weights.json')
export const TOP_PRESETS = 20
export const PALETTES_PER_PRESET = 3
export const PALETTE_WINDOW = 24 // 프리셋마다 씨앗이 뽑는 팔레트의 후보 창(순위 위쪽 N 개 — 모두 use "recipe")
export const MIN_AXES = 2
export const AXIS_COUNT = AXIS_ORDER.length + 3 // axisDistance 가 세는 칸 수(레시피 축 + 모션 + 색 논리 + 색) — 안 사이 거리가 이보다 클 수는 없다
export const MIN_CONVERSIONS = 30 // §9 Q17
// 분위기 가산(FIT-3 F1): 라이브러리 a 안 고름에서 레시피 mood 3단어 중 사용자의 분위기와 겹친 낱말 하나마다 더하는 점수. 원형 적합도(fit)가 같은 묶음 안에서만 작동하고,
// 가중치 lift(≥30 전환 행)가 있으면 그 곁에서 근소 차이를 가르는 크기다. 프리셋·팔레트 쪽 가산은 style-presets.mjs MOOD_PRESET_W·MOOD_PALETTE_W.
export const MOOD_LIBRARY_W = 0.05

export class DirectionsShortError extends Error {
  constructor(rejected, message) {
    super(message ?? `방향 3안을 채우지 못했다 — ${rejected.filter((r) => r.id.startsWith('slot:')).map((r) => `${r.id}(${r.reasons.join(', ')})`).join(' · ')}`)
    this.name = 'DirectionsShortError'
    this.rejected = rejected
  }
}

export class SeedRequiredError extends Error {
  constructor(got) {
    super(`pickDirections: 씨앗(seed)은 정수여야 한다(받은 값: ${JSON.stringify(got) ?? 'undefined'}) — 인자 seed 나 브리프의 seed 를 준다(기본값 없음)`)
    this.name = 'SeedRequiredError'
  }
}

// 씨앗 PRNG — 같은 씨앗이면 같은 순서.
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seededOrder = (list, rand) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// 축 차이 수: 9축(R·B·I·C·T·H·S·D·X, 머리에 없는 D·X 는 기본값) + 모션(M) + 색 논리(K) + 색(라이트 primary 또는 ring 이 다름 — recipes-distinct 「한 색 쌍의 논리」).
export function axisDistance(a, b) {
  let n = AXIS_ORDER.filter((k) => axisValue(a.axes, k) !== axisValue(b.axes, k)).length
  if (a.motion !== b.motion) n++
  if (a.colorLogic !== b.colorLogic) n++
  if (recipeDistance(a, b).color) n++
  return n
}

// 팔레트 정체성: 레시피 팔레트의 B안(-b)은 같은 레시피 팔레트로 본다.
export const paletteKey = (id) => (id ? String(id).replace(/^(pal-recipe-.+?)-b$/, '$1') : null)
// C10: avoid 에 든 팔레트를 쓰는 후보를 뒤로(안정 정렬). 전부 걸리면 순서 그대로(대안이 없을 때만 같은 팔레트).
export function diversityOrder(list, avoid) {
  const bad = new Set([...avoid].map(paletteKey).filter(Boolean))
  return [...list.filter((c) => !bad.has(paletteKey(c.palette))), ...list.filter((c) => bad.has(paletteKey(c.palette)))]
}

// J11: 파일 없으면 가중치 없음. 배열 또는 { weights: [] }.
export function loadWeights(file = WEIGHTS_FILE) {
  if (!existsSync(file)) return []
  const j = JSON.parse(readFileSync(file, 'utf8'))
  return Array.isArray(j) ? j : j.weights ?? []
}
const liftOf = (weights, archetype, keys) => {
  const rows = weights.filter((w) => w.scope === 'recipe' && keys.includes(w.key) && (!w.archetype || w.archetype === archetype) && (w.conversions ?? 0) >= MIN_CONVERSIONS)
  return rows.reduce((s, w) => s + (Number(w.lift) || 0), 0)
}

// 같은 (원형·후보 key)는 머리가 같다 → 기본 lint 결과를 호출 사이에 기억한다(골든 씨앗 탐색이 같은 후보를 수십 번 다시 본다). 시험용 _lint 는 기억하지 않는다.
const LINT_CACHE = new Map()

const ruleIds = (violations) => [...new Set(violations.map((v) => `lint:${String(v).split(':')[0].trim()}`))]

// 레시피의 쓰임 조건(archetypeConditions[원형] 문장)과 브리프 조건(brief.conditions)이 겹치는 조건 id — 겹치면 조건부 적합도를 1 로 읽는다(P4GD · 대장 C280).
export const matchedConditions = (recipe, arch, conditions = []) => conditionIdsOf(recipe.archetypeConditions?.[arch]).filter((id) => conditions.includes(id))

// ① 라이브러리 고름(원형 적합도가 먼저, 이 원형에 archetypeConditions 가 붙은 레시피는 브리프 조건이 맞을 때 1, 아니면 0.9 라 조건 없는 레시피가 없을 때만, 동률은 씨앗 순서).
// pickDirections 와 골든 씨앗 탐색(golden.mjs)이 같은 식을 쓰게 한 곳에 둔다. 돌려주는 값: { libOrder, bestFit, safePool } — safePool[0] 이 a 안.
function librarySafePool(arch, rand, w, library, conditions = [], moodP = null) {
  const fitOf = (r) => (r.archetypes?.includes(arch) ? (r.archetypeConditions?.[arch] ? (matchedConditions(r, arch, conditions).length ? 1 : 0.9) : 1) : checkCompat(r.axes, arch).length ? 0 : 0.5)
  const libOrder = seededOrder(library, rand)
    .map((r) => ({ r, fit: fitOf(r), lift: liftOf(w, arch, [r.id]) }))
    .filter((x) => x.fit > 0)
  const bestFit = Math.max(0, ...libOrder.map((x) => x.fit))
  // 분위기 겹침(FIT-3): 분위기가 표에 있을 때만 레시피 mood 와 센다. 없으면 key 가 예전 식 그대로(+0)라 정렬 결과가 바이트까지 같다.
  const moodWords = moodP ? new Set(moodP.recipeTokens) : null
  const keyOf = (x) => x.fit * (1 + x.lift) + (moodWords ? MOOD_LIBRARY_W * moodOverlap(x.r.mood, moodWords) : 0)
  const safePool = libOrder.filter((x) => x.fit === bestFit).sort((a, b) => keyOf(b) - keyOf(a))
  const topKey = safePool.length ? keyOf(safePool[0]) : 0
  return { libOrder, bestFit, safePool, topKey, keyOf, moodWords }
}

/**
 * 원형·씨앗이 주는 라이브러리 a 안의 레시피 id(lint·생성 후보 없이 싸게 — 골든 씨앗 탐색이 안 맞는 씨앗을 미리 거른다).
 * fitting 은 이 원형에서 a 안이 될 수 있는 레시피 전부(최고 적합도 묶음, 가중치 lift 는 무시 — 씨앗 순서만 바꾼다는 기록용).
 */
export function libraryPick({ archetype, seed, weights, conditions = [], mood } = {}) {
  const arch = typeof archetype === 'string' ? archetype : archetype?.id
  const w = (weights ?? loadWeights()).filter((x) => (x.conversions ?? 0) >= MIN_CONVERSIONS)
  const library = loadLibrary()
  const moodP = moodProfile(mood)
  const { safePool } = librarySafePool(arch, mulberry32(seed), w, library, conditions, moodP)
  // 분위기가 표에 있으면 a 안이 될 수 있는 것은 그 분위기 점수가 가장 높은 묶음뿐이다(분위기가 없으면 예전처럼 적합도 묶음 전부).
  const base = librarySafePool(arch, mulberry32(0), [], library, conditions, moodP)
  const fitting = base.safePool.filter((x) => base.keyOf(x) === base.topKey).map((x) => x.r.id).sort()
  return { id: safePool[0]?.r.id ?? null, fitting }
}

/**
 * @returns {Promise<{ candidates: object[], rejected: { id: string, reasons: string[] }[] }>}
 */
export async function pickDirections({ brief, archetype, seed, weights, exclude = [], minAxes = MIN_AXES, _presetFilter, _lint = lintRecipe, _paletteDiversity = true } = {}) {
  const arch = typeof archetype === 'string' ? archetype : archetype?.id ?? brief?.archetype
  if (!arch) throw new Error('pickDirections: 원형 id 가 없다')
  if (brief?.archetype && brief.archetype !== arch) throw new Error(`원형이 브리프와 다르다: 브리프 ${brief.archetype} · 넘긴 원형 ${arch}`)
  // 씨앗은 기본값 없이 받는다(P3-4 Task 4) — 「씨앗을 안 줘서 0」이 조용히 골든 세트의 결정성을 깨지 않게. 호출자가 seed 를 넘기거나 브리프가 seed 를 갖고 있어야 한다.
  const s = seed ?? brief?.seed
  if (!Number.isInteger(s)) throw new SeedRequiredError(s)
  const rand = mulberry32(s)
  const w = (weights ?? loadWeights()).filter((x) => (x.conversions ?? 0) >= MIN_CONVERSIONS)
  const library = loadLibrary()
  const rejected = []

  // ① 라이브러리. 이 원형에 archetypeConditions(자연어 조건, 예: r8 local 「헤리티지 업장에만」)가 붙은 레시피는 브리프 conditions 가 그 조건 id 와 맞을 때만 적합도 1, 아니면 조건 없는 레시피가 없을 때만 쓴다.
  // 분위기(FIT-3 F1): 인테이크의 facts.mood 를 표(mood.mjs)로 무드 어휘에 옮겨 ① 라이브러리 고름 ② 프리셋 점수 ③ 팔레트 점수에 가중 요소로 더한다. 표에 없으면 효과 없음(why 에 이유).
  const moodWord = typeof brief?.facts?.mood === 'string' ? brief.facts.mood.trim() : ''
  const moodP = moodWord ? moodProfile(moodWord) : null
  const moodTokens = moodSet(moodP)
  const moodShown = moodWord.length > 20 ? `${moodWord.slice(0, 20)}…` : moodWord
  const { bestFit, safePool, moodWords } = librarySafePool(arch, rand, w, library, brief?.conditions ?? [], moodP)
  if (!safePool.length) throw new DirectionsShortError([{ id: 'slot:safe', reasons: [`no-library-recipe:${arch}`] }])
  const safeHead = safePool[0].r
  // 안마다 붙는 근거 한 줄 — 분위기가 없으면 빈 글(예전 why 그대로).
  const moodClause = (hit, what) => (!moodWord ? '' : !moodP ? ` · 분위기 '${moodShown}' 은 표에 없어 반영 못 함` : hit > 0 ? ` · 분위기 '${moodShown}' 반영(${what})` : ` · 분위기 '${moodShown}' 과 겹치는 재료가 이 안에는 없어 가산 없음`)
  const safeHit = moodWords ? moodOverlap(safeHead.mood, moodWords) : 0
  const safe = {
    id: 'a', slot: 'safe', source: 'library', recipe: safeHead.id, palette: `pal-recipe-${safeHead.id}`,
    fonts: { display: safeHead.fonts.display.family, body: safeHead.fonts.body.family }, novelty: 0,
    why: `① 무난 — 라이브러리 레시피 ${safeHead.id}: ${bestFit === 0.5 ? `${arch} 원형을 적은 레시피가 없어 호환표를 통과한` : `${arch} 원형을 archetypes 에 적은`} ${safePool.length}벌 중${safePool[0].lift ? ` 가중치 lift ${safePool[0].lift}로` : ` 씨앗 ${s} 순서로`} 골랐다${safeHead.archetypeConditions?.[arch] ? ` · 조건: ${safeHead.archetypeConditions[arch]}(${matchedConditions(safeHead, arch, brief?.conditions).length ? `브리프 조건 ${matchedConditions(safeHead, arch, brief?.conditions).join('·')} 이 맞아 적합도 1` : '브리프가 맞는지 확인 필요'})` : ''}${moodClause(safeHit, `레시피 무드 ${safeHead.mood.filter((m) => moodWords?.has(m)).join('·')} 일치`)}`,
  }

  // ② ③ 생성 후보 풀
  const pool = loadPalettePool()
  const pairs = loadPairs().filter((p) => p.source !== `recipe:${safeHead.id}`)
  let presets = listPresets({ archetype: arch, ...(moodTokens ? { mood: moodTokens } : {}) })
  if (_presetFilter) presets = presets.filter(_presetFilter)
  presets = presets.slice(0, TOP_PRESETS)
  const gens = []
  const randPal = mulberry32((s ^ 0x5bd1e995) >>> 0) // 팔레트 뽑기 전용 줄기(rand 를 건드리지 않는다)
  presets.forEach((preset, pi) => {
    const pairB = pairs.length ? pairs[Math.floor(rand() * pairs.length)] : null
    const fontSets = [hintPair(preset), ...(pairB ? [pairB] : [])]
    const window = pickPalettes(preset, { n: PALETTE_WINDOW, pool, ...(moodTokens ? { mood: moodTokens } : {}) })
    // 창에서 씨앗이 PALETTES_PER_PRESET 개를 뽑는다. 뽑힌 순서가 칸 안 동률 순서(ki)라 첫 번째가 창 안에서 고르게 나온다(순위순으로 다시 세우면 위쪽 팔레트로 쏠린다).
    const chosen = seededOrder(window, randPal).slice(0, PALETTES_PER_PRESET)
    chosen.forEach((palette, ki) => fontSets.forEach((pair, fi) => {
      const head = presetToRecipeHead(preset, palette, pair, { archetype: arch })
      gens.push({
        key: `${preset.id}|${palette.id}|${pair.id}`, preset, palette: palette.id, pair: pair.id, head,
        novelty: novelty(head, library), score: preset.score * (1 + liftOf(w, arch, [preset.id, head.id])), order: [pi, ki, fi],
        lift: liftOf(w, arch, [preset.id, head.id]),
        moodHit: moodTokens ? { preset: moodOverlap(preset.recipeHints?.paletteMoods, moodTokens), palette: moodOverlap(palette.mood, moodTokens) } : null,
      })
    }))
  })
  // 전역 탈락(모든 칸 공통): ①·라이브러리와 축 차이. lint 는 칸 순서대로 필요할 때만 돌리고 기억한다(머리 하나 60ms 안팎).
  // exclude: 뒤 관문(AI 티 등, Task 11)에서 떨어진 후보 — { id: 후보 key 또는 머리 id, reasons: 규칙 id[] }. 같은 칸의 다음 순위로 다시 채운다.
  const excluded = new Map(exclude.map((x) => [x.id, x.reasons ?? ['excluded']]))
  const alive = []
  for (const g of gens) {
    const ex = excluded.get(g.key) ?? excluded.get(g.head.id)
    if (ex) { rejected.push({ id: g.key, reasons: [...ex] }); continue }
    const near = [
      ...(axisDistance(g.head, safeHead) < minAxes ? ['axis-distance:safe'] : []),
      ...library.filter((r) => r.id !== safeHead.id && axisDistance(g.head, r) < minAxes).map((r) => `axis-distance:library:${r.id}`),
    ]
    if (near.length) rejected.push({ id: g.key, reasons: near })
    else alive.push(g)
  }
  const lintMemo = new Map()
  const passes = (g) => {
    if (!lintMemo.has(g.key)) {
      const ck = `${arch}|${g.key}`
      let v
      if (_lint === lintRecipe && LINT_CACHE.has(ck)) v = LINT_CACHE.get(ck)
      else { v = _lint(g.head); if (_lint === lintRecipe) LINT_CACHE.set(ck, v) }
      lintMemo.set(g.key, v)
      if (v.length) rejected.push({ id: g.key, reasons: ruleIds(v) })
    }
    return !lintMemo.get(g.key).length
  }
  const cmpOrder = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]
  const byScore = (a, b) => b.score - a.score || cmpOrder(a, b)
  const byNovelty = (a, b) => b.novelty - a.novelty || b.lift - a.lift || byScore(a, b)
  const firstPassing = (list, avoid) => (_paletteDiversity ? diversityOrder(list, avoid) : list).find(passes)
  const shared = (g, avoid) => [...avoid].map(paletteKey).includes(paletteKey(g.palette))
  const genMoodClause = (g) => moodClause((g.moodHit?.preset ?? 0) + (g.moodHit?.palette ?? 0), `${[g.moodHit?.preset ? `프리셋 무드 ${g.moodHit.preset}` : '', g.moodHit?.palette ? `팔레트 무드 ${g.moodHit.palette}` : ''].filter(Boolean).join('·')} 일치`)

  // ③ 먼저: 통과한 생성 후보 중 새로움 최고(①과 팔레트가 다른 것 먼저). 그다음 ②: ③과 축 2개 이상 다르고 새로움이 ③ 이하인 것 중 점수 1등.
  let bold, boldHead, brandInfo
  const genBold = firstPassing([...alive].sort(byNovelty), [safe.palette])
  if (brief?.brand) {
    let mod
    try { mod = await import('./brand.mjs') } catch (e) { throw new Error(`브랜드 입력이 있는데 factory/stamp/brand.mjs(P3-3 Task 4)를 불러오지 못했다 — ${e.message}`) }
    const base = genBold?.preset ?? presets[0]
    if (!base) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: ['brand-no-base-preset'] }])
    const r = mod.brandToRecipeHead(brief.brand, base, { archetype: arch })
    if (r.blocked) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: [`brand-blocked: ${r.blocked}`] }])
    const v = _lint(r.head)
    const near = [...(axisDistance(r.head, safeHead) < minAxes ? ['axis-distance:safe'] : [])]
    if (v.length || near.length) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: [...ruleIds(v), ...near].map((x) => `brand-${x}`) }])
    boldHead = r.head
    brandInfo = { input: brief.brand, adjustments: r.adjustments ?? [], fontSubstitutions: r.fontSubstitutions ?? [], basePreset: base.id }
    bold = {
      id: 'c', slot: 'bold', source: 'brand', recipe: r.head, preset: base.id,
      fonts: { display: r.head.fonts?.display?.family, body: r.head.fonts?.body?.family }, brand: brandInfo,
      novelty: novelty(r.head, library),
      why: `③ 과감 — 브랜드 입력으로 만든 안(바탕 프리셋 ${base.id}, 색 조정 ${brandInfo.adjustments.length}건 · 서체 대체 ${brandInfo.fontSubstitutions.length}건)${!moodWord ? '' : !moodP ? ` · 분위기 '${moodShown}' 은 표에 없어 반영 못 함` : ` · 분위기 '${moodShown}' 은 브랜드 입력이 색·서체를 정해 반영 안 함`}`,
    }
  } else if (genBold) {
    boldHead = genBold.head
    bold = candidateOf(genBold, 'c', 'bold', `③ 과감 — 통과한 생성 후보 중 새로움 최고 ${genBold.novelty}(프리셋 ${genBold.preset.id}, 팔레트 ${genBold.palette})${shared(genBold, [safe.palette]) ? ' · ①과 팔레트가 같다: 통과한 다른 후보가 없다(C10 예외)' : ''}${genMoodClause(genBold)}`)
  }
  if (!bold) throw new DirectionsShortError([...rejected, { id: 'slot:bold', reasons: ['no-passing-generated-candidate'] }])

  const avoidNew = [safe.palette, bold.palette].filter(Boolean)
  const newPool = alive.filter((g) => g !== genBold || bold.source === 'brand')
    .filter((g) => axisDistance(g.head, boldHead) >= minAxes && (bold.source === 'brand' || g.novelty <= bold.novelty))
    .sort(byScore)
  const gNew = firstPassing(newPool, avoidNew)
  if (!gNew) throw new DirectionsShortError([...rejected, { id: 'slot:new', reasons: [alive.length ? 'no-passing-candidate-2-axes-from-bold' : 'no-passing-generated-candidate'] }])
  const newC = candidateOf(gNew, 'b', 'new', `② 새 조합 — 통과한 생성 후보 중 점수 1등(프리셋 ${gNew.preset.id} 점수 ${round(gNew.score)}, 팔레트 ${gNew.palette})${shared(gNew, avoidNew) ? ' · ①·③과 팔레트가 같다: 통과한 다른 후보가 없다(C10 예외)' : ''}${genMoodClause(gNew)}`)

  // 대담안 표시(factory v1 Task 4.2 · 합의안 D5·D20): 3안 중 정확히 1안(③ 과감 칸)이 대담안이다. 출처 구성·고름은 그대로 두고 표시만 더한다.
  // boldMode: public·dashboard 는 모션 대신 배치·서체로만 대담("layout"), 그 밖은 모션("motion"). 안전 판정은 factory/qa/bold-safety.mjs(07-qa 관문 bold-safety).
  Object.assign(bold, { boldness: 'bold', boldMode: boldModeFor(arch) })
  for (const c of [safe, newC]) c.boldness = 'standard'
  return { candidates: [safe, newC, bold], rejected }
}

const round = (x) => Math.round(x * 1e4) / 1e4
function candidateOf(g, id, slot, why) {
  return {
    id, slot, source: 'generated', recipe: g.head, preset: g.preset.id, palette: g.palette,
    fonts: { display: g.head.fonts.display.family, body: g.head.fonts.body.family }, novelty: g.novelty, why,
  }
}
