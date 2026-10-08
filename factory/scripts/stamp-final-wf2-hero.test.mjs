// FINAL-WF2 #20 — portfolio 홈 히어로가 3D 오브젝트(hero-object-3d-orbit)로 골라진 원인.
// 원인: 03 의 3D 히어로 readiness(applyObjectReadiness)는 「재료 도구(Higgsfield 폴더·Codex 이미지)가 이 PC 에 있는가」만 봤다 —
//   portfolio 의 첫 화면(statement)은 원형 JSON 에 이미지 칸(imageSlots)이 하나도 없어 오브젝트 칸이 없는데도(재료가 있어도 그릴 사진이 들어갈 자리가 없다)
//   도구가 있는 PC 에서는 3D 히어로가 「채울 수 있음(0)」이라 a 안이 골랐다. 고침: 이 원형에서 3D 히어로를 허용하는 섹션에 이미지 칸이 없으면 못 채움(2).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-final-wf2-hero.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyObjectReadiness, OBJECT_HERO_BLOCK } from '../stamp/object-media.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { archetypes } from './lib/stamp-site-fixtures.mjs'
import { goldenOf } from './lib/stamp-structure-fixtures.mjs'

const sitemapOf = (archetype, id) => buildSitemap(archetypes[archetype], goldenOf(id).brief)
const zero = new Map([[OBJECT_HERO_BLOCK, 0]])

test('#20 3D 히어로: 이미지 칸이 없는 첫 화면(portfolio statement)은 재료 도구가 있어도 못 채운다 · 이미지 칸이 있는 원형은 도구가 정한다', () => {
  const port = sitemapOf('portfolio', 'portfolio-1')
  assert.equal(applyObjectReadiness(zero, { any: true }, { archetype: archetypes.portfolio, sitemap: port }).get(OBJECT_HERO_BLOCK), 2)
  const com = sitemapOf('commerce', 'commerce-1')
  assert.equal(applyObjectReadiness(zero, { any: true }, { archetype: archetypes.commerce, sitemap: com }).get(OBJECT_HERO_BLOCK), 0, '이미지 칸이 있으면 재료 도구가 정한다')
  assert.equal(applyObjectReadiness(zero, { any: false }, { archetype: archetypes.commerce, sitemap: com }).get(OBJECT_HERO_BLOCK), 2, '재료가 없으면 못 채운다(예전 그대로)')
  assert.equal(applyObjectReadiness(zero, { any: true }).get(OBJECT_HERO_BLOCK), 0, '원형·사이트맵을 안 주면 예전 그대로')
})

test('#20 portfolio-1 03: 재료 도구가 있어도 세 후보 중 3D 히어로가 없다 · 고침 전 표(원형 안 줌)에서는 a 안이 3D 를 고른다(양성 대조)', () => {
  const g = goldenOf('portfolio-1')
  const sm = buildSitemap(archetypes.portfolio, g.brief)
  const blocks = [...sm.pages.flatMap((p) => p.sections), ...(sm.globals ?? [])].flatMap((x) => x.allowedVariants ?? [])
  const table = new Map(blocks.map((b) => [b, 0]))
  const cands = ['a', 'b', 'c'].map((id) => ({ id, slot: 'library', source: 'library', recipe: 'r1-measure' }))
  const pick = (readiness) => chooseVariants(sm, cands, { seed: g.seed, weights: [], readiness })
  const fixed = pick(applyObjectReadiness(table, { any: true }, { archetype: archetypes.portfolio, sitemap: sm }))
  assert.deepEqual(['a', 'b', 'c'].filter((c) => fixed[c]['home/statement'] === OBJECT_HERO_BLOCK), [])
  const old = pick(applyObjectReadiness(table, { any: true }))
  assert.ok(['a', 'b', 'c'].some((c) => old[c]['home/statement'] === OBJECT_HERO_BLOCK), '옛 표에서는 3D 히어로가 골라진다 — 이 시험이 원인을 재현한다')
})
