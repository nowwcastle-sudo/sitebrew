// 대담안 장면 수(factory v1 Task 5.4 · C1) + 블록 메타 boldness 규칙. 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/bold-scenes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BlockMeta } from './blocks.mjs'
import { ARCHETYPE_IDS } from './archetypes.mjs'
import { BOLD_SCENE_KINDS, BOLD_MIN, boldScenes, loadBoldIndex } from './bold-scenes.mjs'

const validHeroMeta = (o = {}) => ({ kind: 'hero', variant: 'x', title: 't', layout: 'l1', density: 'spacious', archetypes: ['brand'], archetypeKinds: ['hero'], states: [], media: [], motion: ['rise'], titleWidth: 'full', ...o })

test('원형 10종 각각 대담안 장면이 3개 이상이다(C1)', () => {
  const counts = boldScenes(loadBoldIndex())
  const short = ARCHETYPE_IDS.filter((a) => (counts[a] ?? []).length < BOLD_MIN)
  assert.equal(ARCHETYPE_IDS.length, 10)
  assert.deepEqual(short, [], `모자란 원형: ${short.map((a) => `${a} ${(counts[a] ?? []).length}`).join(', ')}`)
})
test('계획 5.17 표의 끝 칸: public 은 전폭 제목 layout 배너, pwa 는 흐림→선명 온보딩 장면, dashboard 는 증거 패널 layout 을 센다', () => {
  const idx = loadBoldIndex()
  const counts = boldScenes(idx)
  const by = (n) => idx.find((b) => b.name === n)
  assert.ok(counts.public.includes('block-hero-identity-strip-banner'), 'public identity-strip-banner')
  assert.equal(by('block-hero-identity-strip-banner').boldMode, 'layout')
  assert.equal(by('block-hero-identity-strip-banner').titleWidth, 'full')
  assert.ok(counts.dashboard.includes('block-hero-centered-proof-panel'), 'dashboard centered-proof-panel')
  assert.equal(by('block-hero-centered-proof-panel').boldMode, 'layout')
  for (const n of ['block-hero-ken-burns-stills', 'block-hero-punch-in-statement']) assert.ok(counts.detail.includes(n), `detail ${n}`)
  const onboarding = (counts.pwa ?? []).map(by).filter((b) => b.kind === 'onboarding')
  assert.equal(onboarding.length >= 1 && onboarding.every((b) => b.boldMode === 'motion' && b.motion.includes('blur-to-sharp')), true, 'pwa 온보딩 장면 blur-to-sharp')
})
// 새 히어로 6종(blocks.mjs FV1_HEROES)이 블록 메타 archetypes 에 적은 원형의 hero 섹션 허용 목록에 이어져 있다. 뺀 것은 EXCLUDED 표에 까닭이 있어야 한다.
// 표에 이름이 없는 어긋남은 실패다 — 「메타에는 적고 허용 목록에는 없는」 조용한 빈틈을 막는다.
const EXCLUDED = {
  // 캐릭터 상표·저작권 확인 문구(rightsNote)는 사실인데 콘텐츠에 자료 칸이 없다 — 06 binder 가 null 이라 어느 원형에서도 그릴 수 없다(stamp-bind-widen 5.7).
  'mascot-greeting': { '*': 'rightsNote 자료 칸 없음 — 06 이 쓰지 않는다' },
  // 화면 칸 출처는 섹션 단위(imageSlots)라 변형마다 다르게 못 적는다. landing 히어로 칸은 stock-ok — 스톡 사진을 제품 화면 창에 끼우면 가짜 증거다. saas 의 product-ui 는 real-required.
  'screenshot-window': { landing: '히어로 칸 hero-visual 이 stock-ok(imagePolicy) — 제품 화면은 real-required 여야 한다' },
}
test('새 히어로 6종: 메타 archetypes 에 적은 원형의 hero 섹션 허용 목록에 모두 있다(예외는 표에 까닭)', async () => {
  const { FV1_HEROES } = await import('./blocks.mjs')
  const { loadArchetypes } = await import('./archetypes.mjs')
  const idx = loadBoldIndex()
  const all = await loadArchetypes()
  const list = Array.isArray(all) ? all : all instanceof Map ? [...all.values()] : Object.values(all)
  const missing = []
  for (const v of FV1_HEROES) {
    const meta = idx.find((b) => b.name === `block-hero-${v}`)
    assert.ok(meta, `메타 ${v}`)
    for (const arch of list) {
      if (!meta.archetypes.includes(arch.id)) continue
      const secs = arch.pages.flatMap((p) => p.sections ?? []).filter((s) => (s.blockKinds ?? []).includes('hero'))
      if (!secs.length) continue // hero 섹션이 없는 원형(dashboard·detail·pwa)은 이을 자리가 없다 — 보고서 5번
      const why = EXCLUDED[v]?.['*'] ?? EXCLUDED[v]?.[arch.id]
      for (const s of secs) {
        const has = s.allowedVariants.includes(`block-hero-${v}`)
        if (why) { if (has) missing.push(`${arch.id}/${s.kind} ${v} — 표에서 뺀 변형이 허용 목록에 있다`) }
        else if (!has) missing.push(`${arch.id}/${s.kind} ${v}`)
      }
    }
  }
  assert.deepEqual(missing, [])
})
// 이미지 칸 출처(C12): 칸 출처는 섹션 단위라 변형마다 다르게 못 적는다 — 그림 출처가 정해진 변형은 그 출처가 맞는 섹션에서만 허용한다.
//   screenshot-window 의 화면 칸 = real-required(가짜 증거 금지) · map-first 의 지도 칸 = real-required 또는 generated-ok(스톡 사진을 지도로 쓰지 않는다).
const SLOT_NEEDS = { 'screenshot-window': ['real-required'], 'map-first': ['real-required', 'generated-ok'] }
test('screenshot-window·map-first 는 그림 칸 출처가 맞는 hero 섹션에서만 허용된다', async () => {
  const { loadArchetypes } = await import('./archetypes.mjs')
  const all = await loadArchetypes()
  const list = Array.isArray(all) ? all : all instanceof Map ? [...all.values()] : Object.values(all)
  const bad = []
  let seen = 0
  for (const arch of list) for (const p of arch.pages) for (const s of p.sections ?? []) {
    for (const [v, ok] of Object.entries(SLOT_NEEDS)) {
      if (!s.allowedVariants.includes(`block-hero-${v}`)) continue
      seen++
      const slots = s.imageSlots ?? []
      if (!slots.length || !slots.every((i) => ok.includes(i.source))) bad.push(`${arch.id}/${s.kind} ${v}: ${slots.map((i) => `${i.id}=${i.source}`).join(',') || '칸 없음'}`)
    }
  }
  assert.ok(seen >= 3, `허용된 곳이 ${seen}곳뿐 — 이 시험은 화면·지도 변형이 이어진 곳을 본다`) // 양성 대조: 0곳이면 위 빈 값이 의미가 없다
  assert.deepEqual(bad, [])
})
test('public·dashboard 는 motion 대담 장면을 세지 않는다', () => {
  const idx = [{ name: 'block-hero-x', kind: 'hero', archetypes: ['public'], boldness: 'bold', boldMode: 'motion', motion: ['rise'] }]
  assert.deepEqual(boldScenes(idx).public ?? [], [])
  // 같은 원형도 layout 이면 센다 — 양성 대조(센다는 것이 보여야 위 빈 값이 의미를 갖는다)
  const lay = [{ name: 'block-hero-y', kind: 'hero', archetypes: ['public', 'dashboard'], boldness: 'bold', boldMode: 'layout', motion: [] }]
  assert.deepEqual(boldScenes(lay).public, ['block-hero-y'])
  assert.deepEqual(boldScenes(lay).dashboard, ['block-hero-y'])
})
test('장면 종류·boldness 가 맞는 블록만 센다', () => {
  const idx = [
    { name: 'block-hero-a', kind: 'hero', archetypes: ['brand'], boldness: 'bold', boldMode: 'motion', motion: ['rise'] },
    { name: 'block-faq-b', kind: 'faq', archetypes: ['brand'], boldness: 'bold', boldMode: 'motion', motion: ['rise'] },
    { name: 'block-hero-c', kind: 'hero', archetypes: ['brand'], boldness: 'standard', motion: [] },
    { name: 'block-hero-d', kind: 'hero', archetypes: ['brand'], motion: [] },
  ]
  assert.deepEqual(boldScenes(idx), { brand: ['block-hero-a'] })
  assert.deepEqual(BOLD_SCENE_KINDS, ['hero', 'final-cta', 'announcement', 'onboarding', 'social-proof'])
})
test('이 작업 끝: 실제 블록 메타로 brand·commerce 는 3개 이상이다', () => {
  const counts = boldScenes(loadBoldIndex())
  for (const a of ['brand', 'commerce']) assert.ok((counts[a] ?? []).length >= BOLD_MIN, `${a} ${(counts[a] ?? []).length}`)
})
test('boldness bold 인데 boldMode 가 없으면 메타 검사가 거절한다', () => {
  assert.equal(BlockMeta.safeParse(validHeroMeta()).success, true)
  assert.equal(BlockMeta.safeParse({ ...validHeroMeta(), boldness: 'bold' }).success, false)
  assert.equal(BlockMeta.safeParse({ ...validHeroMeta(), boldness: 'bold', boldMode: 'motion' }).success, true)
})
test('boldMode motion 인데 motion 이 비면 거절한다', () => {
  assert.equal(BlockMeta.safeParse(validHeroMeta({ boldness: 'bold', boldMode: 'motion', motion: [] })).success, false)
})
test('boldMode layout: hero 는 titleWidth full 이어야 하고 hero 가 아닌 장면은 자유다', () => {
  assert.equal(BlockMeta.safeParse(validHeroMeta({ boldness: 'bold', boldMode: 'layout', titleWidth: 'full' })).success, true)
  assert.equal(BlockMeta.safeParse(validHeroMeta({ boldness: 'bold', boldMode: 'layout', titleWidth: 'column' })).success, false)
  const cta = { kind: 'final-cta', variant: 'x', title: 't', layout: 'l1', density: 'comfortable', archetypes: ['brand'], archetypeKinds: ['final-cta'], states: [], media: [], motion: [], boldness: 'bold', boldMode: 'layout' }
  assert.equal(BlockMeta.safeParse(cta).success, true)
})
