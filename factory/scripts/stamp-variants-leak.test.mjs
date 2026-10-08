// 03 이 06 의 누설을 미리 안다(레인 EXLEAK 후속 — 남은 것 3번). 06 은 묶고도 예시 사업 글(leak)·가짜 앱 창(mockup)이 남는 변형을 같은 섹션의 더 깨끗한 변형으로 바꾼다.
// 03 이 그걸 모르고 고르면 후보 셋이 같은 누설 변형을 고르고 06 폴백이 셋을 같은 블록으로 모았다(골든 brand-1 a·b·c 히어로가 모두 같은 블록).
// ui-copy.mjs leakTable(가장 좋은 경우에도 남는 누설 이슈 수) → variants.mjs chooseVariants({ leaks }) — 누설이 남는 변형은 다른 변형이 있으면 피하고 깨끗한 변형끼리 후보 칸마다 돌린다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-variants-leak.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { loadArchetypes } from './archetypes.mjs'
import { loadLibrary } from './style-presets.mjs'
import { loadBrief } from '../stamp/brief.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { leakKey, leakTable, readinessTable } from '../stamp/ui-copy.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const archetypes = await loadArchetypes()
const siteOf = (golden) => {
  const brief = loadBrief(join(root, 'factory', 'stamp', 'briefs', 'golden', `${golden}.json`))
  return buildSitemap(archetypes[brief.archetype], brief)
}
const lib = loadLibrary()
const CANDS = [0, 1, 2].map((i) => ({ id: 'abc'[i], recipe: lib[i].id }))
const allowedOf = (sm, key) => {
  const [p, k] = key.split('/')
  return sm.pages.find((x) => x.id === p).sections.find((s) => s.kind === k).allowedVariants
}
const pick = async (sm, extra = {}) => chooseVariants(sm, CANDS, { seed: 7, weights: [], readiness: await readinessTable(sm.pages.flatMap((p) => p.sections).filter((s) => s.status === 'block').flatMap((s) => s.allowedVariants)), ...extra })

test('leakTable: 가장 좋은 경우에도 예시 글이 남는 히어로 변형만 표에 오른다 — 깨끗하게 묶이는 변형(staggered-oval-frame·twin-panels)은 없다', async () => {
  const sm = siteOf('brand-1')
  const t = await leakTable(sm)
  const leaky = (b) => (t.get(leakKey('home/hero', b)) ?? 0) > 0
  for (const b of ['block-hero-inline-chip-title', 'block-hero-stepped-crop-figure', 'block-hero-banded-full-bleed', 'block-hero-layered-landscape-logotype']) assert.ok(leaky(b), `${b} 는 구조상 누설이 남는다(lines 객체·lede 조각·paragraphs·logoLines)`)
  for (const b of ['block-hero-staggered-oval-frame', 'block-hero-twin-panels']) assert.ok(!leaky(b), `${b} 는 묶으면 깨끗하다`)
  // 같은 계산을 다시 하면 같은 표(메모) — 03 입력 열쇠로 쓰이므로 결정적이어야 한다
  assert.deepEqual([...(await leakTable(sm))].sort(), [...t].sort())
})

test('leakTable: 가짜 앱 창(mockup) 히어로는 saas 에서 누설로 오른다 — 06 폴백이 바꾸는 것과 같은 판정', async () => {
  const sm = siteOf('saas-1')
  const t = await leakTable(sm)
  assert.ok((t.get(leakKey('home/hero', 'block-hero-narrow-title-wide-window')) ?? 0) > 0)
  // 단계 특징 제목은 binder 가 이름표로 묶으니 누설이 아니다(고침 뒤)
  assert.equal(t.get(leakKey('home/workflow-features', 'block-features-numbered-steps')) ?? 0, 0)
})

test('leakTable: commerce 상품 목록은 제목을 이름표로 묶어 누설이 아니다', async () => {
  const t = await leakTable(siteOf('commerce-1'))
  assert.equal([...t.keys()].some((k) => k.includes('block-product-list-')), false)
})

test('chooseVariants: 누설이 남는 변형은 다른 변형이 있으면 고르지 않고, 후보 칸마다 다른 깨끗한 변형을 고른다(brand-1 히어로)', async () => {
  const sm = siteOf('brand-1')
  const leaks = await leakTable(sm)
  const before = await pick(sm, { hints: {} }) // 예전 03(기본 순위 힌트 FB9 이전) — 힌트가 모션 히어로(깨끗한 변형)를 앞에 올려 이 대조가 흐려지지 않게 끈다
  const after = await pick(sm, { leaks })
  const heroes = (v) => CANDS.map((c) => v[c.id]['home/hero'])
  for (const h of heroes(after)) assert.ok(!(leaks.get(leakKey('home/hero', h)) > 0), `누설이 남는 ${h} 를 골랐다`)
  assert.equal(new Set(heroes(after)).size, 3, `후보 칸마다 다른 깨끗한 변형(brand 히어로는 깨끗한 변형이 셋): ${heroes(after)}`)
  // 이 시험이 의미 있으려면 예전에는 누설 변형을 골랐어야 한다(양성 대조)
  assert.ok(heroes(before).some((h) => leaks.get(leakKey('home/hero', h)) > 0), `예전 03 도 깨끗했다면 이 시험은 잴 것이 없다: ${heroes(before)}`)
})

test('chooseVariants 음성 대조: 표가 비었거나 없으면 예전 그대로이고, 모든 변형이 같은 수로 누설이면 순서를 바꾸지 않는다', async () => {
  const sm = siteOf('brand-1')
  const base = await pick(sm)
  assert.deepEqual(await pick(sm, { leaks: new Map() }), base)
  assert.deepEqual(await pick(sm, { leaks: undefined }), base)
  const all = new Map(allowedOf(sm, 'home/hero').map((b) => [leakKey('home/hero', b), 1]))
  assert.deepEqual(await pick(sm, { leaks: all }), base, '전부 누설이면 고를 수 있는 것이 없다 — 06 몫이다')
  // 다른 섹션은 건드리지 않는다
  const heroOnly = await pick(sm, { leaks: await leakTable(sm) })
  for (const c of CANDS) for (const [k, v] of Object.entries(base[c.id])) if (k !== 'home/hero') assert.equal(heroOnly[c.id][k], v, `${c.id} ${k}`)
})

test('chooseVariants: 모두 누설이면 이슈가 적은 변형을 먼저 고른다(06 폴백 비용과 같은 셈)', async () => {
  const sm = siteOf('brand-1')
  const blocks = allowedOf(sm, 'home/hero')
  const leaks = new Map(blocks.map((b, i) => [leakKey('home/hero', b), i === 0 ? 1 : 3]))
  const v = await pick(sm, { leaks })
  for (const c of CANDS) assert.equal(v[c.id]['home/hero'], blocks[0], '가장 적은 쪽')
})

test('readiness: 히어로 장면 이름(copy.slides)은 binder 가 서수 이름표로 묶으니 「못 채움」이 아니다 — vertical-title-slides 가 03 에서 늘 밀려나던 길(EXLEAK)', async () => {
  const { readinessOf } = await import('../stamp/ui-copy.mjs')
  assert.equal(await readinessOf('block-hero-vertical-title-slides'), 0)
  // 음성 대조: 지어낸 수치가 남는 히어로는 여전히 못 채움
  assert.equal(await readinessOf('block-hero-crosshair-quadrants'), 2)
})
