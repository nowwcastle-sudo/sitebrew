// 골든 세트 18(P3-4 Task 4) — 원형 9 × 브리프 2, 브리프 파일마다 씨앗이 박혀 있어 같은 브리프는 늘 같은 방향 3안을 낸다.
//   factory/stamp/briefs/golden/<원형>-<n>.json 18개(P3-3 골든 6개는 복사본 — 원본은 factory/stamp/briefs/ 에 그대로).
//   goldenSet()                  → [{ id, archetype, n, briefFile, brief, seed, expectSources }] (원형 순서·n 순서)
//   checkGolden(entry)           → 01 방향만 돌려(빌드·서버 없음, ~0.3초) 출처 조합·팔레트 겹침·브랜드 칸을 본다. problems 가 비면 통과.
//   findSeed(brief, opts)        → 조건(+세트 겹침 없음·라이브러리 덮기)을 채우는 가장 작은 씨앗(1부터). 브리프 파일의 씨앗을 새로 박을 때 쓴다(`--find-seeds`).
//   pickGoldenSeeds()            → 18개를 원형 순서로 훑으며 findSeed 를 이어 불러 세트 전체가 (1)(2)를 채우는 씨앗을 낸다. 브리프 파일의 씨앗은 이 결과다.
//   checkGoldenSet(results)      → 세트 수준 점검: 같은 원형 안 생성 머리 되풀이 없음 · 18개 전체 생성 팔레트 해시 겹침 없음(시험·CLI 가 쓴다).
//   runGolden(id, { until })     → 찍어내기 한 번(stamp.mjs runStamp). 04 문구·06 빌드·07 관문은 무겁다 — 실행 잠금 안에서, 골든 18 전체는 별도 레인.
//   STRICT_BY_ARCHETYPE          → 원형별 엄격 기준(07-qa 의 strict 관문이 읽는다, factory/qa/strict-archetype.mjs).
// 출처 조합: pickDirections 의 칸이 구조로 정한다 — ① 라이브러리 레시피 · ② 생성 · ③ 브랜드 입력이 있으면 브랜드, 없으면 생성. 씨앗이 바꾸는 것은 ①의 고름
// (원형에 맞는 라이브러리 레시피가 둘 이상인 dashboard·portfolio·public·saas)과 ②③의 팔레트 뽑기(P4GD · 대장 C272 — 프리셋마다 순위 위 24개 중 씨앗이 3개)·서체 짝 후보 순서다.
// 씨앗은 pickGoldenSeeds 가 세트 전체의 겹침 없음(같은 원형 생성 머리·전체 팔레트 해시)·라이브러리 덮기를 채우도록 고른다 — 브리프 파일에는 그 결과가 박힌다.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { ARCHETYPE_IDS, loadBrief } from './brief.mjs'
import { libraryPick, paletteKey, pickDirections } from './directions.mjs'
import { STRICT_BY_ARCHETYPE } from '../qa/strict-archetype.mjs'

export { STRICT_BY_ARCHETYPE }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const GOLDEN_DIR = join(ROOT, 'factory', 'stamp', 'briefs', 'golden')
export const PER_ARCHETYPE = 2
export const SEED_SEARCH_MAX = 150

export const goldenIds = () => ARCHETYPE_IDS.flatMap((a) => Array.from({ length: PER_ARCHETYPE }, (_, i) => `${a}-${i + 1}`))

/** 브리프 하나가 낼 방향 3안의 출처 — 칸 순서(safe · new · bold). */
export const expectedSources = (brief) => ['library', 'generated', brief.brand ? 'brand' : 'generated']

export function goldenSet({ dir = GOLDEN_DIR } = {}) {
  return goldenIds().map((id) => {
    const briefFile = join(dir, `${id}.json`)
    if (!existsSync(briefFile)) throw new Error(`골든 브리프가 없다: ${briefFile}`)
    const raw = JSON.parse(readFileSync(briefFile, 'utf8'))
    if (!Number.isInteger(raw.seed)) throw new Error(`골든 브리프 ${id} 에 정수 seed 가 없다 — 씨앗은 파일에 박아 둔다(기본값 없음)`)
    const brief = loadBrief(briefFile)
    const archetype = id.replace(/-\d+$/, '')
    if (brief.archetype !== archetype) throw new Error(`골든 ${id} 의 원형이 이름과 다르다: ${brief.archetype}`)
    return { id, archetype, n: Number(id.match(/-(\d+)$/)[1]), briefFile, brief, seed: brief.seed, expectSources: expectedSources(brief) }
  })
}

const recipeOf = (c) => (typeof c.recipe === 'string' ? c.recipe : c.recipe?.id ?? null)

/** 01 방향만 돌려 골든 조건을 본다. problems 가 비면 통과. */
export async function checkGolden(entry, { archetypes } = {}) {
  const archs = archetypes ?? (await loadArchetypes())
  const problems = []
  let picked = null
  try {
    picked = await pickDirections({ brief: entry.brief, archetype: archs[entry.archetype], seed: entry.seed })
  } catch (e) {
    return { id: entry.id, archetype: entry.archetype, sources: [], expectSources: entry.expectSources, problems: [`방향 3안을 못 골랐다: ${e.message}`], library: null, palettes: [], generated: [], heads: [] }
  }
  const cands = picked.candidates
  const sources = cands.map((c) => c.source)
  if (cands.length !== 3) problems.push(`방향이 ${cands.length}안이다`)
  if (sources.join('+') !== entry.expectSources.join('+')) problems.push(`출처 조합이 ${sources.join('+')} — 기대 ${entry.expectSources.join('+')}`)
  const shared = cands.filter((c) => /C10 예외/.test(c.why ?? ''))
  if (shared.length) problems.push(`팔레트가 겹친다(C10 예외): ${shared.map((c) => c.id).join('·')}`)
  const palettes = cands.map((c) => c.palette).filter(Boolean)
  const keys = palettes.map(paletteKey)
  if (new Set(keys).size !== keys.length) problems.push(`팔레트가 같은 후보가 있다: ${palettes.join(' · ')}`)
  if (entry.brief.brand) {
    const b = cands.find((c) => c.source === 'brand')
    if (!b?.brand?.input) problems.push('브랜드 입력이 있는데 브랜드 후보의 입력 기록이 없다')
  }
  // 세트 수준 점검용: 생성(source generated) 후보의 머리 id·팔레트 키, 그리고 브랜드 후보까지 합친 생성계 머리 id 전부.
  const generated = cands.filter((c) => c.source === 'generated').map((c) => ({ slot: c.id, head: recipeOf(c), palette: paletteKey(c.palette) }))
  const heads = cands.filter((c) => c.source !== 'library').map(recipeOf)
  return { id: entry.id, archetype: entry.archetype, sources, expectSources: entry.expectSources, problems, library: recipeOf(cands[0]), palettes, generated, heads }
}

/** 팔레트 id 의 짧은 해시(문서·로그 표시용): pal-ch-2c3333395b… → 2c333339. */
export const paletteHash = (id) => String(paletteKey(id) ?? '').replace(/^pal-(ch-)?/, '').slice(0, 8)

/**
 * 세트 수준 점검(P4GD · 대장 C272). results = checkGolden 결과 배열.
 *  - 같은 원형 안에서 생성계 머리(생성·브랜드) id 가 되풀이되면 안 된다.
 *  - 세트 전체에서 생성 후보의 팔레트 키가 되풀이되면 안 된다.
 *  - 해시 표시(앞 8자)가 다른 팔레트와 같으면 표에서 구별이 안 되므로 그것도 막는다.
 * @returns {string[]} problems — 비면 통과
 */
export function checkGoldenSet(results) {
  const problems = []
  const headsBy = new Map(), palettes = new Map(), hashes = new Map()
  for (const r of results) {
    for (const h of r.heads ?? []) {
      const k = `${r.archetype}|${h}`
      if (headsBy.has(k)) problems.push(`같은 원형(${r.archetype}) 안 생성 머리 되풀이: ${h} — ${headsBy.get(k)} · ${r.id}`)
      else headsBy.set(k, r.id)
    }
    for (const g of r.generated ?? []) {
      if (palettes.has(g.palette)) problems.push(`생성 팔레트 해시 되풀이: ${paletteHash(g.palette)} — ${palettes.get(g.palette)} · ${r.id}`)
      else palettes.set(g.palette, r.id)
      const hh = paletteHash(g.palette)
      if (hashes.has(hh) && hashes.get(hh) !== g.palette) problems.push(`팔레트 해시 앞 8자가 다른 팔레트와 같다: ${hh}`)
      hashes.set(hh, g.palette)
    }
  }
  return problems
}

/** 세트가 덮는 라이브러리 레시피(a 안) 목록 — 정렬·중복 제거. */
export const libraryCoverage = (results) => [...new Set(results.map((r) => r.library).filter(Boolean))].sort()

/**
 * 조건(오류 없음 · 출처 조합 · 팔레트 겹침 없음)에 더해 세트 수준 조건(takenPalettes: 앞 골든의 생성 팔레트 키 · takenHeads: 같은 원형 앞 골든의 생성계 머리 id)을 채우는
 * 가장 작은 씨앗. 라이브러리 a 안은 원형 적합도(libraryPick.fitting)가 먼저이고, 그 안에서 위 층부터 차례로 고른다:
 *   ⓪ 이 브리프가 마지막 기회인 안 덮인 레시피(mustLibrary — 남은 브리프 중 이 레시피에 맞는 것이 이것뿐)  ① 세트에 아직 안 덮였고(coveredLibrary) preferLibrary 에 든 것
 *   ② 아직 안 덮인 것  ③ 같은 원형 앞 브리프가 안 쓴 것(takenLibrary)  ④ 맞는 것 아무거나.
 * 윗층에서 조건을 채우는 씨앗이 없으면 아랫층으로 내려간다(원형에 안 맞는 레시피는 애초에 후보가 아니라 억지로 넣지 않는다).
 * 라이브러리 고름은 lint 없이 싸게 먼저 걸러, 안 맞는 씨앗은 01 방향 전체를 돌리지 않는다.
 */
export async function findSeed(brief, { archetypes, from = 1, to = SEED_SEARCH_MAX, takenLibrary = [], coveredLibrary = [], preferLibrary = [], mustLibrary = [], takenPalettes = [], takenHeads = [] } = {}) {
  const archs = archetypes ?? (await loadArchetypes())
  const { fitting } = libraryPick({ archetype: brief.archetype, seed: from, conditions: brief.conditions, mood: brief.facts?.mood })
  const uncovered = fitting.filter((r) => !coveredLibrary.includes(r))
  const tiers = [['last-chance', fitting.filter((r) => mustLibrary.includes(r))], ['prefer', uncovered.filter((r) => preferLibrary.includes(r))], ['uncovered', uncovered], ['not-sibling', fitting.filter((r) => !takenLibrary.includes(r))], ['any', fitting]]
    .filter(([, t], i, all) => t.length && all.findIndex(([, u]) => u.join() === t.join()) === i)
  const tried = new Map() // 씨앗 → 점검 결과(층을 내려가도 다시 안 돌린다)
  for (const [tierName, tier] of tiers) {
    for (let seed = from; seed <= to; seed++) {
      if (!tier.includes(libraryPick({ archetype: brief.archetype, seed, conditions: brief.conditions, mood: brief.facts?.mood }).id)) continue
      if (!tried.has(seed)) tried.set(seed, await checkGolden({ id: `seed-${seed}`, archetype: brief.archetype, brief, seed, expectSources: expectedSources(brief) }, { archetypes: archs }))
      const r = tried.get(seed)
      if (r.problems.length) continue
      if (r.generated.some((g) => takenPalettes.includes(g.palette))) continue
      // 표에 싣는 앞 8자 해시도 세트 안에서 달라야 한다(checkGoldenSet) — 분위기 가산(FIT-3)이 레시피 팔레트(pal-recipe-rN-…, 앞 8자가 모두 「recipe-r」)를 더 자주 뽑으므로 씨앗을 고를 때 미리 거른다.
      const hashes = r.generated.map((g) => paletteHash(g.palette))
      if (new Set(hashes).size !== hashes.length || hashes.some((h) => takenPalettes.some((t) => paletteHash(t) === h))) continue
      if (r.heads.some((h) => takenHeads.includes(h))) continue
      return { seed, library: r.library, tier: tierName, result: r }
    }
  }
  throw new Error(`씨앗 ${from}~${to} 안에 조건(세트 겹침 없음·라이브러리 ${fitting.join('·')})을 채우는 것이 없다: ${brief.archetype}`)
}

/** 라이브러리 a 안에서 먼저 덮을 레시피(P4T4 실측: 세트가 한 번도 안 뽑던 r4·r8·r9). 원형에 맞는 것(fitting)만 실제로 뽑힌다. */
export const LIBRARY_PRIORITY = ['r4-evidence', 'r8-dusk', 'r9-clay', 'r15-atelier']

/**
 * 18개를 원형 순서(goldenIds)로 훑으며 씨앗을 고른다 — 앞 골든이 쓴 생성 팔레트·머리·라이브러리를 다음 골든의 findSeed 에 넘긴다.
 * @returns {Promise<{ id, archetype, seed, library, tier, result }[]>}
 */
export async function pickGoldenSeeds({ archetypes, briefs = goldenSet(), log } = {}) {
  const archs = archetypes ?? (await loadArchetypes())
  const covered = [], takenPalettes = [], takenLibraryBy = {}, takenHeadsBy = {}
  const out = []
  // 브리프마다 a 안이 될 수 있는 레시피(브리프 조건 포함) — 남은 브리프 중 이 레시피에 맞는 것이 이 브리프뿐이면 지금이 마지막 기회다.
  const fits = briefs.map((b) => libraryPick({ archetype: b.archetype, seed: 1, conditions: b.brief.conditions, mood: b.brief.facts?.mood }).fitting)
  for (const [i, e] of briefs.entries()) {
    const mustLibrary = fits[i].filter((r) => !covered.includes(r) && fits.slice(i + 1).every((f) => !f.includes(r)))
    const r = await findSeed(e.brief, {
      archetypes: archs, coveredLibrary: covered, preferLibrary: LIBRARY_PRIORITY, mustLibrary, takenPalettes,
      takenLibrary: takenLibraryBy[e.archetype] ?? [], takenHeads: takenHeadsBy[e.archetype] ?? [],
    })
    covered.push(r.library)
    ;(takenLibraryBy[e.archetype] ??= []).push(r.library)
    takenPalettes.push(...r.result.generated.map((g) => g.palette))
    ;(takenHeadsBy[e.archetype] ??= []).push(...r.result.heads)
    out.push({ id: e.id, archetype: e.archetype, seed: r.seed, library: r.library, tier: r.tier, result: r.result })
    log?.(`${e.id} 씨앗 ${r.seed} (라이브러리 ${r.library}, ${r.tier})`)
  }
  return out
}

const readJsonMaybe = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }

/**
 * 골든 하나를 찍어낸다(stamp.mjs runStamp). 기본은 보드 실행(방향 3안 모두 08 까지, --pick 없음). until 로 중간 단계에서 멈출 수 있다.
 * 04 문구·법률은 에이전트가 쓴다 — 대기면 code 3 과 summary.waiting 을 그대로 돌려준다. 무거운 단계는 부르는 쪽이 실행 잠금을 잡는다.
 * @returns {{ id, runDir, code, status, candidates, publishable: string[], times: object[], summary }}
 */
export async function runGolden(id, { until = null, pick = null, runDir, deps, goldenDir = GOLDEN_DIR, stamp } = {}) {
  const entry = goldenSet({ dir: goldenDir }).find((e) => e.id === id)
  if (!entry) throw new Error(`골든 ${JSON.stringify(id)} 이 없다 — ${goldenIds().join(' · ')}`)
  // stamp.mjs 가 CLI 로 돌고 있으면(top-level await 중) 다시 import 하면 끝나기를 기다리며 멈춘다 — CLI 는 자기 함수를 stamp 로 넘긴다.
  const { runStamp, defaultDeps, normalizeStep } = stamp ?? (await import('./stamp.mjs'))
  const dir = runDir ?? join(ROOT, '.tmp', 'stamp', 'golden', id)
  const r = await runStamp({ brief: entry.briefFile, run: dir, until: until ? normalizeStep(until) : null, pick, deployPreview: false }, deps ?? (await defaultDeps()))
  return {
    id, runDir: dir, code: r.code, status: r.summary.status, candidates: r.summary.candidates,
    publishable: r.summary.candidates.filter((c) => c.publishable === true).map((c) => c.id),
    times: readJsonMaybe(join(dir, 'stamp-timings.json')) ?? [], summary: r.summary,
  }
}

/** 18개를 차례로(한 번에 하나) 찍어낸다. 종료 코드 중 가장 큰 것을 돌려준다. */
export async function runAllGolden({ until = null, runDir, deps, goldenDir = GOLDEN_DIR, log = console.log, stamp } = {}) {
  const results = []
  for (const e of goldenSet({ dir: goldenDir })) {
    const r = await runGolden(e.id, { until, runDir: runDir ? join(runDir, e.id) : undefined, deps, goldenDir, stamp })
    log(`[golden ${e.id}] 종료 ${r.code} (${r.status}) — 공개 가능 ${r.publishable.length}/${r.candidates.length}안`)
    results.push(r)
  }
  return { results, code: Math.max(0, ...results.map((r) => r.code)) }
}

// CLI: node factory/stamp/golden.mjs [--find-seeds]  — 18개 브리프의 조건을 점검하고(기본: 개별 조건 + 세트 수준 조건 + 라이브러리 덮기), --find-seeds 면 세트 전체가 조건을 채우는 씨앗을 제안한다(파일은 고치지 않는다).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const archetypes = await loadArchetypes()
  if (process.argv.includes('--find-seeds')) {
    const picked = await pickGoldenSeeds({ archetypes })
    const files = Object.fromEntries(goldenSet().map((e) => [e.id, e.seed]))
    for (const p of picked) console.log(`${p.id} 제안 씨앗 ${p.seed} (라이브러리 ${p.library}, ${p.tier}) · 파일 씨앗 ${files[p.id]}${files[p.id] === p.seed ? '' : ' ← 다름'}`)
    const cov = libraryCoverage(picked.map((p) => p.result))
    console.log(`덮는 라이브러리(${cov.length}벌): ${cov.join(' · ')}`)
    const sp = checkGoldenSet(picked.map((p) => p.result))
    if (sp.length) { console.log(sp.join('\n')); process.exitCode = 1 }
  } else {
    let bad = 0
    const results = []
    for (const e of goldenSet()) {
      const r = await checkGolden(e, { archetypes })
      results.push(r)
      bad += r.problems.length
      console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${e.id} seed ${e.seed} — ${r.sources.join('+')} · ${r.library} · ${r.heads.join(' , ')}${r.problems.length ? ` · ${r.problems.join(' | ')}` : ''}`)
    }
    const sp = checkGoldenSet(results)
    bad += sp.length
    for (const p of sp) console.log(`FAIL 세트 — ${p}`)
    const cov = libraryCoverage(results)
    console.log(`덮는 라이브러리(${cov.length}벌): ${cov.join(' · ')}`)
    process.exitCode = bad ? 1 : 0
  }
}
