// 레시피 다양성 분포 검사 — 레시피 묶음이 한 골격(거의 흰 바탕 + 잉크 주색 + 강조 한 점)·정지 화면으로 모이는 것을 막는다.
// 규칙: DESIGN §5-B div-01(골격 분포)·§8-6 끝 div-06(모션 분포·기법), 근거는 선택 자료 폴더(WF_DESIGN_RULES_DIR)의 감사 기록 1e-diversity.md.
//   div-01  거의 흰 바탕 골격 ≤ 5 · 유채색 면 레시피(K6·K7·K8) ≥ 3 · 다크 기본 ≥ 1   (10벌 기준)
//   div-06  M3 ≥ 2 · M0 ≤ 3 · 모든 레시피가 dynamics 1개 이상                        (10벌 기준)
// 문턱(limitsFor): 10벌 기준 수치. 최소치는 10벌 단위 배수(10~19벌 ×1, 20~29벌 ×2 …), 상한은 벌 수 비례 내림(10벌 미만은 10벌 문턱).
//
// 언제 막는가(Task 6b fix 1 — 컨트롤러 판정 C1): 운영자 결정은 「기존 7벌은 A 값 그대로, 보드에서 B안을 고른다」이다. 그래서 분포는
// **보드 결정이 머리에 반영된 뒤**(Task 9)에만 위반이다. 표지는 데이터 하나 — `factory/board/recipe-decisions.json`이 있고
// 그 안의 `applied`가 true 일 때(Task 9가 결정을 머리에 반영하고 이 값을 켠다, diversityEnforced). 그 전에는 벌 수와 상관없이
// 부족분을 경고로만 찍고, 「보드에서 B안을 몇 벌 골라야 골격 상한을 맞추나」 한 줄(boardRequirement)을 함께 찍는다.
//
// 거의 흰 바탕 골격(§5-B 원문 + 리뷰 I3): 라이트 바탕 L ≥ 0.96 · C < 0.015 이고, 칠하는 면 키(primary·secondary·accent) 가운데
// C ≥ 0.08 인 색의 색상각 묶음이 하나 이하. ring·*-foreground 는 면적이 거의 없어 세지 않는다.
// 유채색 면을 칠하는 K6·K7·K8 과 다크 기본 레시피는 「흰 바탕 + 한 점」이 아니므로 골격에서 뺀다.
// 사용: npm run qa:diversity (gen:all·check:regen 도 같은 검사를 돈다).
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRecipeHeads } from './recipes-distinct.mjs'
import { BOLD_LOGICS, applyAlternate } from './recipe.mjs'
import { parseOklch, isNearWhite, PAINT_KEYS, PAINT_MIN_C, hueGroupsAt } from './lib/palette-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const TARGET = 10
export const DECISIONS = join(ROOT, 'factory', 'board', 'recipe-decisions.json')

// 분포를 위반으로 볼지: 보드 결정 파일이 있고 applied === true.
export function diversityEnforced(file = DECISIONS) {
  if (!existsSync(file)) return false
  try { return JSON.parse(readFileSync(file, 'utf8'))?.applied === true } catch { return false }
}

export const BASE = { skeletonMax: 5, boldMin: 3, darkMin: 1, m3Min: 2, m0Max: 3 }
export function limitsFor(n) {
  const k = Math.max(1, Math.floor(n / TARGET))
  const cap = (x) => Math.floor((x * Math.max(n, TARGET)) / TARGET)
  return { skeletonMax: cap(BASE.skeletonMax), boldMin: BASE.boldMin * k, darkMin: BASE.darkMin * k, m3Min: BASE.m3Min * k, m0Max: cap(BASE.m0Max) }
}

export function isSkeleton(h) {
  if (BOLD_LOGICS.includes(h?.colorLogic) || h?.defaultTheme === 'dark') return false
  const light = h?.color?.light ?? {}
  const bg = parseOklch(light.background)
  if (!bg || !isNearWhite(bg)) return false
  return hueGroupsAt(PAINT_KEYS.map((k) => parseOklch(light[k])).filter(Boolean), PAINT_MIN_C).length <= 1
}

// 레시피 하나의 분류(색 계산은 여기서만 — 보드는 선택지마다 이 값을 미리 계산해 싣는다, Task 8).
export function classifyHead(h) {
  return { id: h?.id, skeleton: isSkeleton(h), bold: BOLD_LOGICS.includes(h?.colorLogic), dark: h?.defaultTheme === 'dark',
    m3: h?.motion === 'M3', m0: h?.motion === 'M0', noDynamics: !Array.isArray(h?.dynamics) || h.dynamics.length === 0 }
}

// 분포 판정(순수 함수 — 색 계산·import 없음): 분류 목록 → { counts, problems[] }. 문장은 「규칙 id: 내용」.
// 레시피 보드(factory/board/recipe-board/build.mjs)가 이 함수와 limitsFor 의 소스를 그대로 페이지에 싣는다(Function.toString) —
// 보드 계수기와 diversityReport 가 같은 코드로 센다. 그래서 바깥 이름은 limitsFor 하나만 부른다.
export function tallyDistribution(entries) {
  const n = entries.length
  const L = limitsFor(n)
  const ids = (k) => entries.filter((e) => e[k]).map((e) => e.id)
  const skeleton = ids('skeleton'), bold = ids('bold'), dark = ids('dark'), m3 = ids('m3'), m0 = ids('m0'), noDyn = ids('noDynamics')
  const counts = { total: n, skeleton: skeleton.length, bold: bold.length, darkDefault: dark.length, m3: m3.length, m0: m0.length, noDynamics: noDyn.length }
  const list = (xs) => (xs.length ? ` (${xs.join(', ')})` : '')
  const problems = []
  if (skeleton.length > L.skeletonMax) problems.push(`div-01 skeleton: 거의 흰 바탕 + 잉크 + 강조 한 점 골격 ${skeleton.length}벌 > ${L.skeletonMax}${list(skeleton)} — 색 면(K6)·듀오톤(K7)·색 블록(K8)·다크 기본으로 골격을 나눈다(DESIGN §5-B)`)
  if (bold.length < L.boldMin) problems.push(`div-01 bold: 유채색 면 레시피(K6·K7·K8) ${bold.length}벌 < ${L.boldMin}${list(bold)}`)
  if (dark.length < L.darkMin) problems.push(`div-01 dark: 다크 기본 레시피 ${dark.length}벌 < ${L.darkMin}${list(dark)}`)
  if (m3.length < L.m3Min) problems.push(`div-06 m3: 모션 M3 레시피 ${m3.length}벌 < ${L.m3Min}${list(m3)} — dashboard·public 원형 밖 레시피에서(DESIGN §8-6)`)
  if (m0.length > L.m0Max) problems.push(`div-06 m0: 모션 M0 레시피 ${m0.length}벌 > ${L.m0Max}${list(m0)}`)
  if (noDyn.length) problems.push(`div-06 dynamics: 역동 기법(dynamics)을 고르지 않은 레시피 ${noDyn.length}벌${list(noDyn)} — 모든 레시피가 §8-6 표에서 1~3개`)
  return { counts, limits: L, problems }
}

// heads: 레시피 YAML 머리 목록 → { counts, problems[] }.
export function diversityReport(heads) {
  const { counts, problems } = tallyDistribution(heads.map(classifyHead))
  return { counts, problems }
}

// 보드 요구(C1): 지금 골격이 상한을 넘는 만큼 보드에서 B안을 골라야 한다. 후보 = 골격이고, B 전체를 적용하면 골격이 아닌 레시피.
// B 전체는 lint(recipe.mjs lintRecipeReport alternates)가 통과를 보장한다.
export function boardRequirement(heads) {
  const need = Math.max(0, heads.filter(isSkeleton).length - limitsFor(heads.length).skeletonMax)
  const candidates = heads.filter((h) => isSkeleton(h) && h.alternates).map((h) => ({ id: h.id, b: applyAlternate(h) }))
    .filter(({ b }) => b && !isSkeleton(b))
    .map(({ id, b }) => `${id}(${[BOLD_LOGICS.includes(b.colorLogic) && b.colorLogic, b.defaultTheme === 'dark' && '다크 기본'].filter(Boolean).join('·')})`)
  const line = need
    ? `보드에서 B안(비골격) 최소 ${need}벌 필요 — 후보: ${candidates.join(', ') || '없음'}${candidates.length < need ? ` · 후보 ${candidates.length}벌 < ${need}벌 — 묶음을 더 대담하게` : ''}`
    : null
  return { need, candidates, line }
}

// gen-all 과 CLI 가 같이 쓴다. 표지 전(enforced false): 경고와 보드 요구 줄만 찍고 0. 표지 뒤: 위반을 찍고 위반 수를 돌려준다.
export function reportDiversity(heads = loadRecipeHeads(), log = console, { enforced = diversityEnforced() } = {}) {
  const { counts, problems } = diversityReport(heads)
  const summary = `골격 ${counts.skeleton} · K6~K8 ${counts.bold} · 다크 기본 ${counts.darkDefault} · M3 ${counts.m3} · M0 ${counts.m0} · 기법 없음 ${counts.noDynamics}`
  if (!enforced) {
    for (const p of problems) log.warn(`WARN 레시피 다양성 경고(보드 결정 반영 전 — factory/board/recipe-decisions.json applied 뒤부터 위반): ${p}`)
    const board = boardRequirement(heads)
    if (board.line) log.warn(`WARN 레시피 다양성 경고: ${board.line}`)
    log.log(`레시피 다양성 분포: ${counts.total}벌 — ${summary}${problems.length ? ` · 부족 ${problems.length}건(경고)` : ' · 문제 없음'}`)
    return 0
  }
  for (const p of problems) log.error(`레시피 다양성 위반: ${p}`)
  if (!problems.length) log.log(`레시피 다양성 분포: ${counts.total}벌 — ${summary} · 문제 없음`)
  return problems.length
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exit(reportDiversity() ? 1 : 0)
