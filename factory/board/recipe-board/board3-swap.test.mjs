// 3판 판정 반영(Task 14, 64fa2bb)의 A↔B 맞바꿈 검사(Task 16 — 리뷰 14 #4): r2·r6·r8·r10 은 머리(A)와 대안(B)을 통째로 맞바꿨다.
// 맞바꾼 뒤의 얼굴은 맞바꾸기 전(c5b0ea3 — 보드 3판을 지은 원천)의 얼굴과 같아야 하고 A·B 만 뒤바뀌어야 한다(parseRecipe + applyAlternate 로 비교).
// 허용하는 차이: 서체 조정 메모(tuned)와 r6 머리 display.weight 400(Fragment Mono 키트의 유일한 굵기 — 머리 lint 가 굵기를 요구한다)·
// display.weightKo 700(Task 14c — 한글 제목 굵기를 머리에 명시, 보드 3판에서 본 한글 700 그대로).
// 음성 대조: 리뷰가 찾은 새어 든 값(r6 대안 라이트 field-1-foreground ← r10 DNA #FBEFFF)을 다시 넣으면 잡혀야 한다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecipe } from '../../scripts/recipe.mjs'
import { optionsOf, ROOT } from './jobs.mjs'

const BEFORE = 'c5b0ea3'
const SWAPPED = ['r2-signal', 'r6-civic', 'r8-dusk', 'r10-console']
const FIELDS = ['colorLogic', 'defaultTheme', 'motion', 'dynamics', 'hero', 'fonts', 'color', 'icons', 'axes', 'signature']
const LEAK = 'oklch(0.9661 0.0246 317.72)'

const headOf = (md) => { const h = parseRecipe(md); delete h.body; return h }
const show = (rev, id) => { try { return execFileSync('git', ['-C', ROOT, 'show', `${rev}:registry/factory/recipes/${id}/DESIGN.md`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null } }
const face = (h) => {
  const f = structuredClone(Object.fromEntries(FIELDS.map((k) => [k, h[k] ?? null])))
  for (const role of Object.values(f.fonts ?? {})) if (role && typeof role === 'object') delete role.tuned
  return f
}
export function faceDiff(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => faceDiff(a[k], b[k], path ? `${path}.${k}` : k))
  return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`]
}
// 허용 차이를 뺀 나머지.
// + 7a-run(대장 A172): 글자로 쓰이는 primary 를 본문 7:1 에 맞추려고 명도만 바꾼 것(색상·채도 그대로) — 맞바꾼 뒤 A 의 의도된 차이다.
const ALLOWED = {
  'r2-signal': ['color.dark.primary: "oklch(0.6887 0.1695 283.30)" → "oklch(0.7387 0.1695 283.30)"'],
  'r6-civic': ['fonts.display.weight: undefined → 400', 'fonts.display.weightKo: undefined → 700',
    'color.light.primary: "oklch(0.5232 0.2011 261.59)" → "oklch(0.4200 0.2011 261.59)"', 'color.light.ring: "oklch(0.5232 0.2011 261.59)" → "oklch(0.4200 0.2011 261.59)"'],
  'r8-dusk': ['color.light.primary: "oklch(0.4494 0.0479 215.62)" → "oklch(0.4144 0.0479 215.62)"', 'color.light.ring: "oklch(0.4494 0.0479 215.62)" → "oklch(0.4144 0.0479 215.62)"'],
}
const unexpected = (id, diffs) => diffs.filter((d) => !(ALLOWED[id] ?? []).includes(d))

const available = show(BEFORE, 'r2-signal') != null

test('board-3 swap (r2, r6, r8, r10): each face after the swap equals the face before it with A and B exchanged (tuned notes and r6 display.weight 400 excepted)', { skip: available ? false : `커밋 ${BEFORE} 이 이 clone 에 없다` }, () => {
  for (const id of SWAPPED) {
    const [oA, oB] = optionsOf(headOf(show(BEFORE, id))).map((o) => face(o.head))
    const [nA, nB] = optionsOf(headOf(readFileSync(join(ROOT, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8'))).map((o) => face(o.head))
    assert.ok(oB && nB, `${id}: A·B 두 안이 있어야 한다`)
    assert.deepEqual(unexpected(id, faceDiff(oB, nA)), [], `${id}: 새 A ≠ 옛 B`)
    assert.deepEqual(unexpected(id, faceDiff(oA, nB)), [], `${id}: 새 B ≠ 옛 A`)
  }
})

test('board-3 swap negative control: the leaked r6 alternate value (r10 field-1-foreground) is caught', { skip: available ? false : `커밋 ${BEFORE} 이 이 clone 에 없다` }, () => {
  const [oA] = optionsOf(headOf(show(BEFORE, 'r6-civic'))).map((o) => face(o.head))
  const cur = headOf(readFileSync(join(ROOT, 'registry', 'factory', 'recipes', 'r6-civic', 'DESIGN.md'), 'utf8'))
  const leaked = structuredClone(cur)
  leaked.alternates.color.light['field-1-foreground'] = LEAK
  const nB = face(optionsOf(leaked)[1].head)
  assert.deepEqual(unexpected('r6-civic', faceDiff(oA, nB)), [`color.light.field-1-foreground: "oklch(1.0000 0.0000 0.00)" → "${LEAK}"`])
})
