// 03-variants — 섹션마다 블록 고르기(P3-3 Task 6, J11).
//   후보(방향 3안)마다, 사이트맵에서 블록에 묶인 섹션(status "block") 하나에 블록 이름 하나를 정한다. 키는 "<쪽>/<섹션>", 전역 섹션은 "global/<이름>".
//   순서(사전식): ⓪ 못 채우는 변형(readiness 2)·가장 좋은 경우에도 예시 누설이 남는 변형(leaks — ui-copy.mjs leakTable, 적은 쪽 먼저)은 다른 변형이 있으면 피한다
//                 ① 같은 칸에서 덜 쓰인 블록(후보끼리 다르게 — 변형이 후보 수보다 적으면 겹치되 전부 같아지지 않게)
//                 ② 선택 학습 가중치(factory v1 4.4, 큰 쪽 먼저 — preferences 옵션이 없거나 모두 1 이면 모두 같아 순서를 바꾸지 않는다)
//                 ③ J11 가중치 lift(전환 30건 이상 행만, 이 원형의 block 행) ④ 레시피 히어로와 같은 히어로 블록
//                 ⑤ 레시피 밀도 경향과 블록 meta.density 의 거리 ⑥ 씨앗으로 만든 고정 순서(Math.random 없음).
//   가중치는 원형 allowedVariants 안에서, 이미 관문을 통과한 후보들 사이의 순서만 바꾼다 — 블록을 새로 넣거나 후보·관문을 건드리지 않는다.
//   가중치 파일이 없으면 가중치 없이 돈다(loadWeights).
import { readFileSync } from 'node:fs'
import { BLOCK_REGISTRY } from '../scripts/archetypes.mjs'
import { loadLibrary } from '../scripts/style-presets.mjs'
import { loadWeights, mulberry32, MIN_CONVERSIONS } from './directions.mjs'
import { weightOf } from '../board/preferences.mjs'

// 기본 순위 힌트(v0.0.9 FB9 — 운영자 판정 10-03: brand-2·commerce-1 은 모션 히어로가 「이번 것이 낫다」, saas-1 은 「비슷」이고 키네틱 띠·펀치 인·스태거는 「별로」, 기법 단독은 「좋다」).
//   DEMOTED: 이 원형에서 기본으로 고르지 않는다 — 허용 변형(allowedVariants)은 그대로라 브리프 prefer 로는 여전히 고를 수 있다(prefer 한 블록은 내림에서 면제).
//     순위는 readiness·leaks 다음, 「덜 쓰인 것」 앞이다 — 내릴 블록은 같은 섹션에 다른 변형이 있는 한 후보 셋 어디에도 안 뽑힌다.
//   BOOSTED: 이 원형 홈 히어로에서 같은 조건이면 먼저 고른다 — readiness·leaks·후보끼리 덜 쓰인 것·prefer 다음, 가중치 앞이다(03 의 leakTable·readiness 순서 규칙은 그대로, 후보끼리 겹치지 않는 규칙도 그대로).
export const DEMOTED = { saas: ['block-hero-punch-in-statement', 'block-features-stagger-cards', 'block-final-cta-kinetic-band'] }
export const BOOSTED = {
  brand: ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills', 'block-hero-punch-in-statement'],
  commerce: ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills', 'block-hero-punch-in-statement'],
}

// 업종에 맞지 않는 블록(FINAL-WF3 항목 14②): 돌봄·의료 업종 사이트의 첫 화면에 세로쓰기 제목(vertical-title-slides — 옛 서책·추모 같은 어둡고 무거운 인상)을 고르지 않는다.
// 업종은 브리프의 주제·사실 글에서 읽는다(원형 local 은 업종 칸이 따로 없다). 읽는 글이 비면 아무것도 막지 않는다(지어내지 않는다).
export const CARE_INDUSTRY = /돌봄|요양|의료|병원|의원|치과|한의|약국|간호|재가|주야간|방문\s*(?:요양|간호|목욕)|노인|복지관|케어|care\s*home|nursing|clinic|hospital|dental|medical|pharmacy|home\s*care|elder/i
export const UNFIT_FOR = { care: ['block-hero-vertical-title-slides'] }
/** 브리프에서 업종을 읽어, 그 업종에 맞지 않는 블록 이름 집합을 돌려준다. */
export function unfitBlocks(brief) {
  const text = [brief?.topic, ...Object.values(brief?.facts ?? {})].filter((x) => typeof x === 'string').join(' ')
  return new Set(CARE_INDUSTRY.test(text) ? UNFIT_FOR.care : [])
}

export const DENSITIES = ['compact', 'comfortable', 'spacious']

let densityCache
/** 블록 이름 → meta.density(없으면 comfortable). */
export function blockDensities() {
  if (!densityCache) {
    const items = JSON.parse(readFileSync(BLOCK_REGISTRY, 'utf8')).items.filter((i) => i.type === 'registry:block' && i.meta?.kind)
    densityCache = new Map(items.map((i) => [i.name, i.meta.density ?? 'comfortable']))
  }
  return densityCache
}

/**
 * 레시피 머리의 밀도 경향. 머리에는 layout 칸이 없어서 밀도를 정하는 축에서 읽는다:
 * 표 밀도 T1(dense) → 조밀 · 표 T3(relaxed)·디스플레이 D2(초대형)·D3(키네틱) → 여유 · 그 밖 → 보통. 조밀과 여유가 겹치면 보통.
 */
export function densityOf(head) {
  const t = head?.axes?.table
  const d = head?.axes?.display
  const tight = t === 'T1'
  const loose = t === 'T3' || d === 'D2' || d === 'D3'
  return tight && !loose ? 'compact' : loose && !tight ? 'spacious' : 'comfortable'
}

const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const jitter = (seed, key, block) => mulberry32(fnv(`${seed}|${key}|${block}`))()

/**
 * @param {{ archetype?: string, pages: object[], globals?: object[] }} sitemap  buildSitemap 결과
 * @param {{ id: string, recipe: string|object }[]} candidates  Task 3 후보(recipe: 라이브러리 id 또는 머리)
 * @param {{ seed?: number, weights?: object[], readiness?: Map<string, number>, leaks?: Map<string, number> }} [opts]  leaks: 「섹션 키 + 탭 + 블록」 → 가장 좋은 경우에도 남는 누설 이슈 수(없으면 0)
 * @returns {Record<string, Record<string, string>>}  후보 id → { "<쪽>/<섹션>": 블록 이름 }
 */
// hints: 기본 순위 힌트({ DEMOTED, BOOSTED } — 위 표). 시험이 「힌트 없던 예전 03」을 재현할 때 {} 를 준다.
// prefer(브리프 선택 칸, P3-5 MOTKIT): { "<쪽>/<섹션>": [블록, …] } — 「덜 쓰인 것」 바로 다음 순서로 이 차례를 따른다(후보 a 가 첫째, b 가 둘째 …).
//   allowedVariants 밖의 블록·없는 섹션은 던진다(브리프 오류). 못 채우는 변형·누설이 남는 변형은 선호해도 피한다(⓪ 이 먼저).
export function chooseVariants(sitemap, candidates, { seed = 0, weights, readiness, leaks, prefer, preferences, hints = { DEMOTED, BOOSTED } } = {}) {
  const library = loadLibrary()
  const heads = new Map(candidates.map((c) => [c.id, typeof c.recipe === 'string' ? library.find((r) => r.id === c.recipe) : c.recipe]))
  for (const [id, h] of heads) if (!h) throw new Error(`후보 ${id}: 레시피 머리를 찾지 못했다 (${JSON.stringify(candidates.find((c) => c.id === id).recipe)?.slice(0, 60)})`)
  const rows = (weights ?? loadWeights()).filter((w) => w.scope === 'block' && (w.conversions ?? 0) >= MIN_CONVERSIONS && (!w.archetype || w.archetype === sitemap.archetype))
  const lift = (block) => rows.filter((w) => w.key === block).reduce((s, w) => s + (Number(w.lift) || 0), 0)
  const dens = blockDensities()
  const slots = [
    ...sitemap.pages.flatMap((p) => p.sections.map((s) => ({ key: `${p.id}/${s.kind}`, s }))),
    ...(sitemap.globals ?? []).map((g) => ({ key: `global/${g.kind}`, s: g })),
  ].filter(({ s }) => s.status === 'block')

  for (const [key, list] of Object.entries(prefer ?? {})) {
    const slot = slots.find((x) => x.key === key)
    if (!slot) throw new Error(`prefer: 섹션 ${key} 가 사이트맵의 블록 섹션이 아니다`)
    for (const b of list) if (!slot.s.allowedVariants.includes(b)) throw new Error(`prefer: ${key} 에 ${b} 는 허용 변형이 아니다(${slot.s.allowedVariants.join(', ')})`)
  }
  const out = Object.fromEntries(candidates.map((c) => [c.id, {}]))
  for (const { key, s } of slots) {
    const pref = prefer?.[key] ?? []
    const demoted = new Set(hints.DEMOTED?.[sitemap.archetype] ?? [])
    const boosted = new Set(hints.BOOSTED?.[sitemap.archetype] ?? [])
    const prefRank = (b) => (pref.includes(b) ? pref.indexOf(b) : pref.length)
    const used = new Map()
    for (const c of candidates) {
      const head = heads.get(c.id)
      const want = DENSITIES.indexOf(densityOf(head))
      const rank = (b) => [
        (readiness?.get(b) ?? 0) >= 2 ? 1 : 0, // 지어낸 수치·가상 이름이 남아 문구로 못 채우는 변형은 다른 변형이 있으면 고르지 않는다(ui-copy.mjs readinessTable — 06 폴백이 덜 일한다)
        leaks?.get(`${key}\t${b}`) ?? 0, // 06 이 폴백으로 바꿀 변형(누설·가짜 앱 창이 남는 것)은 다른 변형이 있으면 처음부터 고르지 않는다 — 후보 셋이 같은 변형으로 모이지 않게(아래 used 가 깨끗한 변형끼리 돌려 준다)
        demoted.has(b) && !pref.includes(b) ? 1 : 0, // 운영자 판정으로 기본에서 내린 블록(DEMOTED) — prefer 한 것은 면제
        used.get(b) ?? 0,
        prefRank(b), // 브리프 선호 차례(없으면 모두 같다 — 옛 순서 그대로)
        boosted.has(b) ? 0 : 1, // 운영자 판정으로 앞에 올린 블록(BOOSTED)
        preferences ? -weightOf(preferences, sitemap.archetype, b) : 0, // 선택 학습(4.4): 앞 순서 기준이 같을 때 먼저 보는 꼬리표 — 학습이 없으면 모두 0 이라 순서가 그대로다
        -lift(b),
        b === `block-hero-${head.hero}` ? 0 : 1,
        Math.abs(DENSITIES.indexOf(dens.get(b) ?? 'comfortable') - want),
        jitter(seed, key, b),
      ]
      const best = [...s.allowedVariants].sort((a, b) => {
        const ra = rank(a), rb = rank(b)
        for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
        return 0
      })[0]
      used.set(best, (used.get(best) ?? 0) + 1)
      out[c.id][key] = best
    }
  }
  return out
}

/**
 * 03-variants 단계 파일(J7) — 후보 전부를 함께 골라야 서로 다르게 나오므로 한 번에 계산하고 후보마다 파일을 쓴다.
 * 입력 해시에 사이트맵·후보 머리·씨앗·쓰인 가중치 행이 들어 있어, 앞 단계나 후보가 바뀌면 다시 돈다.
 */
export async function runVariantStages(run, sitemap, candidates, { seed = 0, weights, readiness, leaks } = {}) {
  const w = (weights ?? loadWeights()).filter((x) => x.scope === 'block' && (x.conversions ?? 0) >= MIN_CONVERSIONS)
  const shared = { sitemap, seed, hints: { DEMOTED, BOOSTED }, weights: w, candidates: candidates.map((c) => ({ id: c.id, recipe: c.recipe })), ...(readiness ? { readiness: [...readiness] } : {}), ...(leaks ? { leaks: [...leaks] } : {}) }
  let all
  const compute = () => (all ??= chooseVariants(sitemap, candidates, { seed, weights: w, readiness, leaks }))
  const result = {}
  for (const c of candidates) result[c.id] = await run.step(c.id, '03-variants', shared, async () => compute()[c.id])
  return result
}
