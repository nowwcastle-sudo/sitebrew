// UI 스타일 사전 references/styles/styles.json 의 모양과 검사(P3-2 Task 15m, 접합면 J4). 만드는 곳은 build-styles.mjs,
// 검사는 styles-ref.test.mjs, 읽는 곳은 Task 16a style-presets.mjs(listPresets·presetToRecipeHead).
//   StyleRef          zod 4 — 한 스타일의 필수 칸
//   styleProblems(s)  축 값이 registry/factory/styles/axes/* 에 있는지 · 호환표(compat.json) 충돌 · 원형 조건 · 레시피 필드 → 문장 목록(빈 배열이면 통과)
//   loadStyles()      파일을 읽어 { styles, proposals, … }
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { checkCompat, checkRecipeRules } from './compat.mjs'
import { AXES_DIR } from './axes.mjs'
import { ARCHETYPES } from './recipe.mjs'

export const STYLES_FILE = new URL('../../references/styles/styles.json', import.meta.url)
export const VERDICTS = ['allow', 'allow-with-rules', 'ban']
// 레시피 머리의 axes 칸 이름(recipe DESIGN.md `axes: { button: B1, … }`)과 같다.
// D(디스플레이 규모)·X(질감)는 Task 16a 에서 더한 축이다(레시피 머리에서는 선택 칸, 기본 D1·X0).
export const AXIS_KEYS = { B: 'button', I: 'input', C: 'surface', T: 'table', H: 'header', R: 'radius', S: 'shadow', D: 'display', X: 'texture' }
export const MOTIONS = ['M0', 'M1', 'M2', 'M3']
export const COLOR_LOGICS = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9']

// 축 폴더의 파일 이름(`b1-square.css` → B1)에서 값 목록을 읽는다 — compat.json 과 따로 본다(둘이 어긋나면 잡히게).
export function axisValuesOnDisk() {
  const out = {}
  for (const axis of readdirSync(AXES_DIR)) out[axis] = readdirSync(join(AXES_DIR, axis)).filter((f) => f.endsWith('.css')).map((f) => f.split('-')[0].toUpperCase())
  return out
}

const Evidence = z.object({ url: z.string().url().nullable(), signal: z.union([z.string(), z.number()]).nullable(), type: z.string().min(1) }).passthrough()
const RankPart = z.object({ value: z.number().nullable(), pct: z.number().min(0).max(1), weight: z.number().positive() })
const AxisName = z.enum(Object.values(AXIS_KEYS))
export const StyleRef = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  visualRules: z.array(z.string().min(1)).min(2).max(8),
  axes: z.partialRecord(AxisName, z.string()),
  axesVariants: z.array(z.partialRecord(AxisName, z.string())), // 기본 벌 대신 통째로 쓰는 다른 벌(레인의 「B1|B4」 둘째 자리)
  axesNotes: z.array(z.string()),
  recipeFields: z.object({ motion: z.enum(MOTIONS).optional(), colorLogic: z.array(z.enum(COLOR_LOGICS)).min(1).optional(), defaultTheme: z.enum(['light', 'dark']).optional() }).strict(),
  newAxisValues: z.array(z.string()), // proposals[].id — 제안일 뿐 구현 안 됨
  archetypes: z.array(z.enum(ARCHETYPES)),
  archetypesExcluded: z.array(z.object({ archetype: z.string(), why: z.string() })),
  compatNote: z.string(),
  verdict: z.enum(VERDICTS),
  verdictReason: z.string().min(1),
  evidence: z.array(Evidence).min(1),
  rank_score: z.number().gt(0).lt(1),
  rank_parts: z.record(z.string(), RankPart),
  lanes: z.array(z.enum(['styles', 'sns'])).min(1),
  note: z.string().optional(),
}).strict()

export const Proposal = z.object({
  id: z.string().min(1), axis: z.string().min(1), name: z.string().min(1), description: z.string().min(1),
  from: z.array(z.string()).min(1), lanes: z.array(z.enum(['styles', 'sns'])).min(1),
  status: z.literal('not-implemented'), plan: z.string().min(1),
}).strict()

// 스타일 하나의 축·호환 문제. 원형이 archetypes 에 있으면 그 원형 조건까지 본다.
export function styleProblems(s, disk = axisValuesOnDisk()) {
  const out = []
  const sel = {}
  for (const [axis, v] of Object.entries(s.axes ?? {})) {
    if (!disk[axis]?.includes(v)) out.push(`${s.id}: ${axis}=${v} 는 registry/factory/styles/axes/${axis}/ 에 없다`)
    else sel[axis] = v
  }
  for (const m of checkCompat(sel)) out.push(`${s.id}: ${m}`)
  const variants = []
  for (const [i, v] of (s.axesVariants ?? []).entries()) {
    const vs = {}
    for (const [axis, x] of Object.entries(v)) { if (!disk[axis]?.includes(x)) out.push(`${s.id}: 변형 ${i + 1} ${axis}=${x} 는 축 폴더에 없다`); else vs[axis] = x }
    for (const m of checkCompat(vs)) out.push(`${s.id}: 변형 ${i + 1} — ${m}`)
    variants.push(vs)
  }
  const logics = s.recipeFields?.colorLogic ?? [undefined]
  for (const a of s.archetypes ?? []) {
    for (const m of checkCompat(sel, a)) out.push(`${s.id} × ${a}: ${m}`)
    for (const vs of variants) for (const m of checkCompat(vs, a)) out.push(`${s.id} × ${a}: 변형 ${m}`)
    for (const k of logics) for (const m of checkRecipeRules({ motion: s.recipeFields?.motion, colorLogic: k }, a).violations) out.push(`${s.id} × ${a}: ${m}`)
  }
  return out
}

export const loadStyles = () => JSON.parse(readFileSync(STYLES_FILE, 'utf8'))
// 구현된 제안(Task 16a) — 사전의 implemented 칸.
export const Implemented = z.object({ id: z.string().min(1), axis: z.string().min(1), name: z.string().min(1), task: z.string().min(1), usedBy: z.array(z.string()) }).strict()
