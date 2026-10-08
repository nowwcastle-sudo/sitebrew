// 레시피의 대표 히어로는 자기 원형 중 하나 이상에서 실제로 쓸 수 있어야 한다(FV1 레인 R16-HERO).
// 쓸 수 있다 = 블록 메타 archetypes ∩ 레시피 archetypes 이고, 그 원형 JSON 의 hero 섹션 allowedVariants 에 그 블록이 있다.
// 한쪽만 맞으면(블록은 허용, 원형 JSON 은 빼 둠) 그 레시피로 찍은 사이트는 대표 첫 화면을 못 쓴다 — r16 이 screenshot-window 로 그랬다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRecipeHeads } from './recipes-distinct.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

// 이름 박은 예외: 레시피 id → 사유. 처리되면 이 줄을 지운다(deferred-register).
const EXCEPTIONS = {}

function heroAllowList(archetype) {
  const file = join(ROOT, 'registry', 'factory', 'archetypes', `${archetype}.json`)
  if (!existsSync(file)) return null
  const out = new Set()
  for (const page of readJson(file).pages ?? []) for (const s of page.sections ?? []) if (s.kind === 'hero' || s.blockKinds?.includes('hero')) for (const v of s.allowedVariants ?? []) out.add(v)
  return out
}

test('모든 레시피의 대표 히어로는 자기 원형 중 하나 이상에서 쓸 수 있다(블록 메타 ∩ 원형 JSON hero 허용 목록) — dashboard 전용·이름 박은 예외 제외', () => {
  const bad = []
  let checked = 0
  for (const h of loadRecipeHeads()) {
    if (h.archetypes.every((a) => a === 'dashboard')) continue // 히어로 섹션이 없다(C388 ①)
    if (EXCEPTIONS[h.id]) continue
    checked++
    const meta = readJson(join(ROOT, 'registry', 'factory', 'blocks', 'hero', `${h.hero}.block.json`))
    const usable = h.archetypes.filter((a) => meta.archetypes.includes(a) && heroAllowList(a)?.has(`block-hero-${h.hero}`))
    if (!usable.length) bad.push(`${h.id}: 히어로 ${h.hero} — 블록 원형 [${meta.archetypes}] ∩ 레시피 원형 [${h.archetypes}] 중 원형 JSON 이 허용하는 곳이 없다`)
  }
  assert.deepEqual(bad, [])
  assert.ok(checked >= 12, `검사한 레시피 ${checked}벌 — 목록이 비어 통과하지 않았는지`)
})

test('예외 목록은 실제로 안 맞는 레시피만 담는다(고쳐졌는데 남은 예외를 막는다)', () => {
  for (const id of Object.keys(EXCEPTIONS)) {
    const h = loadRecipeHeads().find((x) => x.id === id)
    assert.ok(h, `${id} 레시피가 없다`)
    const meta = readJson(join(ROOT, 'registry', 'factory', 'blocks', 'hero', `${h.hero}.block.json`))
    const usable = h.archetypes.filter((a) => meta.archetypes.includes(a) && heroAllowList(a)?.has(`block-hero-${h.hero}`))
    assert.equal(usable.length, 0, `${id} 는 이제 쓸 수 있다 — 예외에서 지운다`)
  }
})
