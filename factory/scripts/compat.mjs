// 스타일 축 호환 검사: checkCompat({ button:'B1', surface:'C2', … }, archetype?, { lineContrast? }) → 위반 문장 목록(빈 배열이면 통과).
// checkCompatWarnings(selection, archetype?) → 막지 않는 주의 목록(cautions, 원형 없이 고른 원형 전용 값).
// checkRecipeRules({ motion, colorLogic }, archetype) → { violations, warnings } — 축이 아닌 레시피 필드 × 원형(recipeRules).
// 표는 registry/factory/styles/compat.json 한 곳. CLI: node factory/scripts/compat.mjs button=B1 surface=C2 [--archetype dashboard]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const COMPAT = JSON.parse(readFileSync(new URL('../../registry/factory/styles/compat.json', import.meta.url), 'utf8'))

// 선 구획 값(compat.json requiresLineContrast 항목의 values) — recipe.mjs·ai-tell 이 이 상수 하나만 읽는다(값을 더해도 compat.json 한 곳).
export const LINE_VALUES = COMPAT.conditional.filter((c) => c.requiresLineContrast).flatMap((c) => c.values)

const familyOf = (v) => Object.keys(COMPAT.families).find((f) => COMPAT.families[f].includes(v))

export function checkCompat(selection, archetype, { lineContrast } = {}) {
  const out = []
  const chosen = []
  for (const [axis, value] of Object.entries(selection)) {
    if (!COMPAT.axes[axis]) { out.push(`${axis}: 모르는 축`); continue }
    if (!COMPAT.axes[axis].includes(value)) { out.push(`${axis}=${value}: 이 축의 값이 아니다(${COMPAT.axes[axis].join('·')})`); continue }
    chosen.push(value)
  }
  const has = (v) => chosen.includes(v)

  // 반경 계열: 금지된 계열 짝마다 한 번만 보고한다.
  for (const [a, b] of COMPAT.familyConflicts) {
    const inA = chosen.filter((v) => familyOf(v) === a), inB = chosen.filter((v) => familyOf(v) === b)
    if (inA.length && inB.length) out.push(`반경 계열 충돌: ${a}(${inA.join('·')}) × ${b}(${inB.join('·')}) — DESIGN §6 각진 것과 둥근 것을 섞지 않는다`)
  }
  for (const f of COMPAT.forbidden) if (f.values.every(has)) out.push(`금지 조합 ${f.values.join('×')}: ${f.why}`)
  for (const c of COMPAT.conditional) {
    const hit = c.values.filter(has)
    if (!hit.length) continue
    if (c.requires) for (const [axis, allowed] of Object.entries(c.requires)) {
      const got = selection[axis]
      if (got !== undefined && !allowed.includes(got)) out.push(`${hit.join('·')} 는 ${axis}=${allowed.join('|')} 와만 (지금 ${got}): ${c.why}`)
    }
    if (archetype && c.archetypesForbidden?.includes(archetype)) out.push(`${hit.join('·')} 는 ${archetype} 원형에 쓰지 않는다: ${c.why}`)
    if (archetype && c.archetypesAllowed && !c.archetypesAllowed.includes(archetype)) out.push(`${hit.join('·')} 는 ${c.archetypesAllowed.join('·')} 원형 전용 (지금 ${archetype}): ${c.why}`)
    if (c.requiresLineContrast && lineContrast !== undefined && lineContrast < c.requiresLineContrast)
      out.push(`${hit.join('·')} 선 대비 ${lineContrast.toFixed(2)} < ${c.requiresLineContrast}:1: ${c.why}`)
  }
  return out
}

// 경고(막지 않음): cautions 의 값이 모두 골라졌을 때, 그리고 원형 전용 값(archetypesAllowed)을 원형 없이 골랐을 때.
export function checkCompatWarnings(selection, archetype) {
  const chosen = Object.values(selection)
  const out = []
  for (const c of COMPAT.cautions ?? []) if (c.values.every((v) => chosen.includes(v))) out.push(`주의 ${c.values.join('×')}: ${c.why}`)
  if (!archetype) for (const c of COMPAT.conditional) {
    const hit = c.values.filter((v) => chosen.includes(v))
    if (hit.length && c.archetypesAllowed) out.push(`주의 ${hit.join('·')}: ${c.archetypesAllowed.join('·')} 전용 — 원형을 넘겨 확인할 것`)
  }
  return out
}

// 레시피 필드(motion·colorLogic) × 원형(compat.json recipeRules, Task 6b): { violations, warnings }. fields = { motion?, colorLogic? }.
export function checkRecipeRules(fields, archetype) {
  const out = { violations: [], warnings: [] }
  if (!archetype) return out
  const rules = COMPAT.recipeRules ?? { forbidden: [], cautions: [] }
  for (const [list, key] of [[rules.forbidden, 'violations'], [rules.cautions, 'warnings']]) for (const r of list) {
    const v = fields?.[r.field]
    if (r.values.includes(v) && r.archetypes.includes(archetype)) out[key].push(`${r.field}=${v} × ${archetype}: ${r.why}`)
  }
  return out
}

// 축 값 × 레시피 필드(compat.json axisRecipeRules, Task 16a): 예) D3 키네틱 × motion M0. axes = 레시피 머리 axes, fields = { motion?, colorLogic? } → 위반 문장 목록.
export function checkAxisRecipeRules(axes, fields) {
  const chosen = Object.values(axes ?? {})
  const out = []
  for (const r of COMPAT.axisRecipeRules?.forbidden ?? []) {
    const hit = r.values.filter((v) => chosen.includes(v))
    const f = fields?.[r.field]
    if (hit.length && r.fieldValues.includes(f)) out.push(`${hit.join('·')} × ${r.field}=${f}: ${r.why}`)
  }
  return out
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const a = process.argv.slice(2)
  const i = a.indexOf('--archetype')
  const archetype = i === -1 ? undefined : a[i + 1]
  const sel = Object.fromEntries(a.filter((x, j) => x.includes('=') && (i === -1 || j !== i + 1)).map((x) => x.split('=')))
  if (!Object.keys(sel).length) { console.error('사용: node factory/scripts/compat.mjs <축>=<값> … [--archetype <원형>]'); process.exit(2) }
  const v = checkCompat(sel, archetype)
  const w = checkCompatWarnings(sel, archetype)
  for (const line of [...v, ...w]) console.log(line)
  console.log(`compat: 위반 ${v.length}, 주의 ${w.length}`)
  process.exit(v.length ? 1 : 0)
}
