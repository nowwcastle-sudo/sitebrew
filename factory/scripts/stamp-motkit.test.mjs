// P3-5 MOTKIT 찍어내기 연결: 모션 그래픽 블록 6종(히어로 3 · 기능·후기·마지막 행동 각 1)을 03 이 고를 수 있고(원형 allowedVariants·블록 메타 archetypes·
// readiness·leakTable), 04 가 로어 서드 이름표를 화면 문구 칸(ui:)으로 요청하며, 06 이 예시 글 누설 없이 묶는다(leakTable = bindSection 가장 좋은 경우).
// 브리프 선택 칸 prefer 로 후보 a·b·c 가 새 히어로를 차례로 고른다. 05 미디어 모양(video·stills)은 블록 메타 media 가 정한다.
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-motkit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { loadArchetypes, checkArchetypes, loadBlockIndex } from './archetypes.mjs'
import { loadBlocks, MOTION_HEROES } from './blocks.mjs'
import { loadLibrary } from './style-presets.mjs'
import { BriefSchema, loadBrief } from '../stamp/brief.mjs'
import { buildSitemap } from '../stamp/sitemap.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { leakKey, leakTable, readinessOf, uiLeavesOf } from '../stamp/ui-copy.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const archetypes = await loadArchetypes()
const siteOf = (golden) => {
  const brief = loadBrief(join(root, 'factory', 'stamp', 'briefs', 'golden', `${golden}.json`))
  return buildSitemap(archetypes[brief.archetype], brief)
}
const lib = loadLibrary()
const CANDS = [0, 1, 2].map((i) => ({ id: 'abc'[i], recipe: lib[i].id }))
const NEW = {
  'block-hero-kinetic-type-video': { archetypes: ['brand', 'commerce'], key: 'home/hero' },
  'block-hero-ken-burns-stills': { archetypes: ['brand', 'commerce'], key: 'home/hero' },
  'block-hero-punch-in-statement': { archetypes: ['brand', 'commerce', 'saas'], key: 'home/hero' },
  'block-features-stagger-cards': { archetypes: ['saas'], key: 'home/workflow-features' },
  'block-social-proof-whip-quotes': { archetypes: ['saas', 'commerce'], key: 'home/social-proof' },
  'block-final-cta-kinetic-band': { archetypes: ['saas'], key: 'home/final-cta' },
}
const GOLDEN = { brand: 'brand-1', commerce: 'commerce-1', saas: 'saas-1' }

test('원형 JSON: 새 블록이 brand·commerce·saas 의 해당 섹션 allowedVariants 에 있고, 블록 메타 archetypes 가 그 원형을 적었다 — checkArchetypes 0', async () => {
  for (const [block, { archetypes: as, key }] of Object.entries(NEW)) for (const a of as) {
    const [pid, kind] = key.split('/')
    const sec = archetypes[a].pages.find((p) => p.id === pid).sections.find((s) => s.kind === kind)
    assert.ok(sec.allowedVariants.includes(block), `${a} ${key} 에 ${block}`)
  }
  const { names, fit } = loadBlockIndex()
  assert.deepEqual(checkArchetypes(archetypes, names, fit), [])
})

test('03 readiness: 새 블록은 문구로 채울 수 있다(2 아님) — 히어로 로어 서드 이름표는 「예시」 표지만 남아 04 화면 문구 칸(ui:)으로 요청된다', async () => {
  for (const block of Object.keys(NEW)) assert.ok((await readinessOf(block)) < 2, `${block} readiness`)
  for (const block of ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills']) {
    const leaves = await uiLeavesOf(block)
    const paths = leaves.map((l) => l.path)
    assert.ok(paths.some((p) => /^copy\.captions\[0\]\.name$/.test(p)), `${block} 이름표 이름을 요청: ${paths}`)
    assert.ok(leaves.every((l) => l.why === 'marker'), '표지 잎만(가상 이름·숫자 없음)')
    assert.ok(!paths.some((p) => /Label$/.test(p)), '…Label 은 화면 이름표라 요청하지 않는다')
  }
})

test('06 누설 없음: 골든 brand-1·commerce-1·saas-1 사이트맵에서 새 블록은 가장 좋은 경우 누설·가짜 창 이슈 0(leakTable — bindSection 그대로)', async () => {
  for (const [arch, golden] of Object.entries(GOLDEN)) {
    const sm = siteOf(golden)
    const t = await leakTable(sm)
    for (const [block, { archetypes: as, key }] of Object.entries(NEW)) {
      if (!as.includes(arch)) continue
      assert.equal(t.get(leakKey(key, block)) ?? 0, 0, `${golden} ${key} ${block}`)
    }
  }
})

test('03 prefer(브리프): 후보 a·b·c 가 선호 차례대로 새 히어로를 고른다 — 허용 밖·없는 섹션은 거절, prefer 없으면 예전 선택 그대로', async () => {
  const sm = siteOf('brand-1')
  const leaks = await leakTable(sm)
  const prefer = { 'home/hero': ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills', 'block-hero-punch-in-statement'] }
  const v = chooseVariants(sm, CANDS, { seed: 7, weights: [], leaks, prefer })
  assert.deepEqual(CANDS.map((c) => v[c.id]['home/hero']), prefer['home/hero'])
  // prefer 가 없으면 결과는 prefer 를 모르는 예전 순서와 같다(빈 선호 = 모두 같은 차례)
  assert.deepEqual(chooseVariants(sm, CANDS, { seed: 7, weights: [], leaks }), chooseVariants(sm, CANDS, { seed: 7, weights: [], leaks, prefer: {} }))
  assert.throws(() => chooseVariants(sm, CANDS, { seed: 7, weights: [], prefer: { 'home/hero': ['block-hero-crosshair-quadrants'] } }), /허용 변형이 아니다/)
  assert.throws(() => chooseVariants(sm, CANDS, { seed: 7, weights: [], prefer: { 'home/nowhere': ['block-hero-kinetic-type-video'] } }), /블록 섹션이 아니다/)
  // saas: 기능·후기·마지막 행동도 같은 길
  const saas = siteOf('saas-1')
  const sv = chooseVariants(saas, CANDS, { seed: 3, weights: [], leaks: await leakTable(saas), prefer: { 'home/workflow-features': ['block-features-stagger-cards'], 'home/final-cta': ['block-final-cta-kinetic-band'], 'home/hero': ['block-hero-punch-in-statement'] } })
  assert.equal(sv.a['home/workflow-features'], 'block-features-stagger-cards')
  assert.equal(sv.a['home/final-cta'], 'block-final-cta-kinetic-band')
  assert.equal(sv.a['home/hero'], 'block-hero-punch-in-statement')
})

test('브리프 스키마: prefer 는 "<쪽>/<섹션>" → 블록 이름 배열만 받는다', () => {
  const base = { topic: '가상 찻집(예시)', archetype: 'brand', locale: 'ko', facts: {} }
  assert.equal(BriefSchema.safeParse({ ...base, prefer: { 'home/hero': ['block-hero-ken-burns-stills'] } }).success, true)
  assert.equal(BriefSchema.safeParse({ ...base, prefer: { hero: ['block-hero-ken-burns-stills'] } }).success, false)
  assert.equal(BriefSchema.safeParse({ ...base, prefer: { 'home/hero': [] } }).success, false)
  assert.equal(BriefSchema.safeParse({ ...base, prefer: { 'home/hero': ['hero-ken-burns-stills'] } }).success, false)
})

test('05 모양: 새 히어로의 블록 메타 media 가 video·stills·punch 를 적는다 — 05-media 가 이 이름으로 영상 한 줄·사진 넷을 계획한다', () => {
  const heroes = loadBlocks().filter((b) => b.kind === 'hero' && MOTION_HEROES.includes(b.variant))
  assert.equal(heroes.length, 3)
  const media = Object.fromEntries(heroes.map((b) => [b.variant, b.meta.data.media]))
  assert.deepEqual(media, { 'kinetic-type-video': ['video'], 'ken-burns-stills': ['stills'], 'punch-in-statement': ['punch'] })
  // props 칸: video·punch 는 media, stills 는 stills(05·06 site-media wireMedia 가 채운다)
  for (const b of heroes) assert.match(b.source, b.variant === 'ken-burns-stills' ? /stills\?: ImageSlot\[\]/ : /media\?: VideoSlot \| ImageSlot/)
})

test('03 기본 순위(FB9, 운영자 판정 10-03): saas 는 새 모션 블록 셋(펀치 인·스태거·키네틱 띠)을 기본으로 안 고르고 prefer 로는 고른다 · brand·commerce 는 새 모션 히어로가 후보 a·b·c 를 채운다', async () => {
  const MOTION_HEROES_ALL = ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills', 'block-hero-punch-in-statement']
  const DEMOTED_SAAS = ['block-hero-punch-in-statement', 'block-features-stagger-cards', 'block-final-cta-kinetic-band']
  // saas: 씨앗 여럿 × 레시피 조합 여럿에서도, 내린 블록은 같은 섹션의 다른 변형이 그것보다 못할 때(readiness·누설이 더 나쁠 때 — 03 의 앞선 순서 규칙)만 뽑힌다.
  // 지금 그런 곳은 홈 히어로 하나다: 허용 변형 10개 중 펀치 인만 06 에서 누설 0 이고 나머지 9개는 누설이 남아 06 폴백·blocker 가 된다(레인 SHOWA saas-1 blockers 38 → 35 의 까닭) — 내리면 blocker 가 늘어 누설 규칙을 깬다.
  const saas = siteOf('saas-1')
  const sleaks = await leakTable(saas)
  const cost = async (key, b) => [(await readinessOf(b)) >= 2 ? 1 : 0, sleaks.get(leakKey(key, b)) ?? 0]
  const worse = (a, b) => (a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]) // a 가 b 보다 나쁘다
  const forced = new Set()
  for (const seed of [0, 1, 2, 3, 5, 8, 13]) for (const off of [0, 3, 6]) {
    const cands = [0, 1, 2].map((i) => ({ id: 'abc'[i], recipe: lib[(off + i) % lib.length].id }))
    const v = chooseVariants(saas, cands, { seed, weights: [], leaks: sleaks })
    for (const c of cands) for (const [key, block] of Object.entries(v[c.id])) {
      if (!DEMOTED_SAAS.includes(block)) continue
      const [pid, kind] = key.split('/')
      const alts = saas.pages.find((p) => p.id === pid).sections.find((s) => s.kind === kind).allowedVariants.filter((b) => !DEMOTED_SAAS.includes(b))
      const mine = await cost(key, block)
      for (const alt of alts) assert.ok(worse(await cost(key, alt), mine), `seed ${seed} 후보 ${c.id} ${key} = ${block} — 같거나 더 깨끗한 ${alt} 가 있는데 내린 블록이 뽑혔다`)
      forced.add(`${key} ${block}`)
    }
  }
  // 5.17(BOLD): 새 히어로(object-3d-orbit·illustration-scene·video-montage·screenshot-window)가 saas 허용 목록에 이어져, 예전에 누설 때문에 어쩔 수 없이 뽑히던 히어로 하나(punch-in-statement)도 더 깨끗한 새 히어로가 대신한다 — 내린 블록이 뽑히는 곳은 없다.
  assert.deepEqual([...forced], [], '내린 블록이 뽑히는 곳이 없다(위 반복의 모든 뽑기에서 더 깨끗한 허용 변형이 있었다)')
  for (const [key, block] of [['home/hero', 'block-hero-punch-in-statement'], ['home/workflow-features', 'block-features-stagger-cards'], ['home/final-cta', 'block-final-cta-kinetic-band']]) {
    assert.ok(saas.pages.find((p) => p.id === key.split('/')[0]).sections.find((s) => s.kind === key.split('/')[1]).allowedVariants.includes(block), `${block} 는 saas 허용 변형에 남아 있다`)
    const v = chooseVariants(saas, CANDS, { seed: 3, weights: [], leaks: sleaks, prefer: { [key]: [block] } })
    assert.equal(v.a[key], block, `prefer 로는 ${block} 를 고를 수 있다`)
  }
  // brand·commerce: 홈 히어로 후보 셋이 서로 다른 모션 히어로(03 의 후보끼리 겹치지 않는 규칙 그대로)
  for (const golden of ['brand-1', 'brand-2', 'commerce-1']) {
    const sm = siteOf(golden)
    const leaks = await leakTable(sm)
    for (const seed of [0, 1, 2, 3, 5, 8]) {
      const v = chooseVariants(sm, CANDS, { seed, weights: [], leaks })
      const heroes = CANDS.map((c) => v[c.id]['home/hero'])
      assert.ok(heroes.every((h) => MOTION_HEROES_ALL.includes(h)), `${golden} seed ${seed}: ${heroes}`)
      assert.equal(new Set(heroes).size, 3, `${golden} seed ${seed}: 후보끼리 겹치지 않는다 ${heroes}`)
    }
  }
})
