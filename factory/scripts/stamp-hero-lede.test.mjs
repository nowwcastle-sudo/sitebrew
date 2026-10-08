// P3-5 SHOWFIX — 부제 칸이 없는 원형(brand·commerce)의 모션 히어로 lede 를 04 문구 칸(summary·tileBody·body·lead·text·origin)으로 잇기
// (SHOWA 가 site-bind.mjs bindHero·gen-pages.mjs slotAnyId 에 넣은 고침의 시험). 고침 전 동작(예시 문단이 남아 06 이 오일 프레임으로 폴백) · 고친 뒤 동작(폴백 0, lede 가 $ref) · 이을 칸이 없을 때(예시 문단이 남으면 blocker).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-hero-lede.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bindSection } from '../stamp/gen-pages.mjs'
import { LEDE_SLOTS, resolveRefs } from '../stamp/site-bind.mjs'
import { BLOCKER } from '../stamp/gen-pages.mjs'
import { goldenOf, brand2 } from './lib/stamp-structure-fixtures.mjs'
import { root, makeRun, gen } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-hero-lede-test')
const MOTION = ['block-hero-kinetic-type-video', 'block-hero-ken-burns-stills']
const routes = { home: '/', about: '/about', contact: '/contact' }
const bind = (block, content, copy) =>
  bindSection({ key: 'home/hero', block, content, copyIndex: new Map(Object.entries(copy)), routes, locale: 'en', navLinks: () => [{ label: 'Home', href: '/' }], primaryCta: () => ({ href: '/contact' }), secondaryHref: () => '/about' })
const content = { archetype: 'brand', locale: 'en', business: { name: 'Kiln & Kettle' } }
const ledeIssue = (r) => r.issues.find((i) => i.path === 'copy.lede')

test('lede 연결(단위·고친 뒤): 부제 칸이 없고 04 에 이 사업을 말하는 문단 칸이 있으면 lede 가 그 칸의 $ref — 블록 예시 문단이 남지 않는다(모션 히어로 둘)', async () => {
  for (const block of MOTION) {
    const r = await bind(block, content, { 'home/hero/tagline#0': 0, 'home/business-scope/tileBody#0': 1 })
    assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.1.text' }, block)
    assert.equal(ledeIssue(r), undefined, `${block}: lede 에 예시 문구 이슈가 없다`)
    assert.deepEqual(resolveRefs(r.props.copy, { slots: { copy: [{ text: '제목' }, { text: 'We blend teas from two family gardens' }] } }).lede, 'We blend teas from two family gardens')
  }
})

test('lede 연결(단위): 이을 칸은 LEDE_SLOTS 순서(summary 가 tileBody 보다 먼저) — 칸이 들어온 순서·번호와 무관, 어느 섹션의 칸이든 id 로 찾는다', async () => {
  assert.deepEqual(LEDE_SLOTS.slice(0, 2), ['summary', 'tileBody'])
  const r = await bind(MOTION[0], content, { 'home/hero/tagline#0': 0, 'home/business-scope/tileBody#0': 1, 'about/summary/summary#0': 2 })
  assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.2.text' }, 'tileBody 가 먼저 들어왔어도 summary')
  const only = await bind(MOTION[1], content, { 'home/hero/tagline#0': 0, 'home/story/origin#0': 1 })
  assert.deepEqual(only.props.copy.lede, { $ref: 'slots.copy.1.text' }, 'LEDE_SLOTS 의 맨 끝 origin 도 잇는다')
  const other = await bind(MOTION[0], content, { 'home/hero/tagline#0': 0, 'home/business-scope/caption#0': 1 })
  assert.equal(typeof other.props.copy.lede, 'string', 'LEDE_SLOTS 밖의 칸(caption)은 잇지 않는다')
})

test('lede 연결(단위): 부제 칸이 있으면 그 칸이 먼저 — 대체 칸은 쓰지 않는다', async () => {
  const r = await bind(MOTION[0], content, { 'home/hero/tagline#0': 0, 'home/hero/subhead#0': 1, 'about/summary/summary#0': 2 })
  assert.deepEqual(r.props.copy.lede, { $ref: 'slots.copy.1.text' })
})

test('lede 연결(단위·이을 칸 없음): 04 에 문단 칸이 하나도 없으면 예시 문단이 그대로 남아 이슈(marker)가 된다 — 지어내서 채우지 않는다 = 고침 전 동작과 같다', async () => {
  for (const block of MOTION) {
    const r = await bind(block, content, { 'home/hero/tagline#0': 0 })
    assert.equal(typeof r.props.copy.lede, 'string', `${block}: 블록 예시 문단 그대로`)
    assert.match(r.props.copy.lede, /예시/)
    assert.deepEqual(ledeIssue(r)?.why, 'marker', `${block}: 예시 문단이 남으면 이슈`)
  }
})

// ── 06 통합(brand-2 골든 04 콘텐츠): 모션 히어로를 03 이 골랐다고 두고 찍는다 ──
const stamp = async (patch) => {
  const g = goldenOf('brand-2')
  const R = await makeRun(TMP, g.brief, brand2, { patchVariants: (v) => ({ ...v, 'home/hero': MOTION[0] }), patch })
  return gen(R)
}
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))

test('06 통합·고친 뒤: 부제 칸 없는 brand 가 고른 kinetic-type-video 는 폴백 0 — home/hero 가 그대로 모션 히어로이고 lede 는 04 문구 $ref, 예시 문구 blocker 에 hero lede 가 없다', async () => {
  const s = await stamp((c) => c)
  assert.equal(s.fallbacks.find((f) => f.key === 'home/hero'), undefined, JSON.stringify(s.fallbacks))
  const hero = siteOf(s).sections['home/hero']
  assert.equal(hero.block, MOTION[0])
  assert.match(hero.props.copy.lede.$ref, /^slots\.copy\.\d+\.text$/)
  assert.equal(s.blockers.some((b) => b.startsWith(BLOCKER.example) && /home\/hero/.test(b) && /lede/.test(b)), false, s.blockers.join('\n'))
})

test('06 통합·이을 칸 없음(고침 전 동작): 04 에서 LEDE_SLOTS 칸을 빼면 모션 히어로가 예시 문단을 남겨 같은 섹션의 다른 변형으로 폴백한다', async () => {
  const s = await stamp((c) => ({ ...c, slots: { ...c.slots, copy: c.slots.copy.filter((e) => !LEDE_SLOTS.includes(e.id)) } }))
  const f = s.fallbacks.find((x) => x.key === 'home/hero')
  assert.ok(f, JSON.stringify(s.fallbacks))
  assert.equal(f.from, MOTION[0])
  assert.notEqual(f.to, f.from)
  assert.match(f.why, /예시 문구 \d+곳 남음/)
})

test('06 통합·이을 칸 없음 + 바꿀 변형 없음: 예시 문단이 남은 채 그려지고 「공개 불가 — 예시 문구 남음: home/hero … copy.lede(marker)」 blocker 가 선다(숨기지 않는다)', async () => {
  const g = goldenOf('brand-2')
  const R = await makeRun(TMP, g.brief, brand2, {
    patchVariants: (v) => ({ ...v, 'home/hero': MOTION[0] }),
    patch: (c) => ({ ...c, slots: { ...c.slots, copy: c.slots.copy.filter((e) => !LEDE_SLOTS.includes(e.id)) } }),
  })
  // 02 의 첫 화면 허용 변형을 모션 히어로 하나로 좁혀 폴백할 곳을 없앤다.
  const file = join(R.runDir, 'a', '02-sitemap.json')
  const env = JSON.parse(readFileSync(file, 'utf8'))
  env.data.pages.find((p) => p.id === 'home').sections.find((x) => x.kind === 'hero').allowedVariants = [MOTION[0]]
  writeFileSync(file, JSON.stringify(env))
  const s = await gen(R)
  assert.equal(s.fallbacks.find((f) => f.key === 'home/hero'), undefined, '바꿀 변형이 없다')
  assert.equal(siteOf(s).sections['home/hero'].block, MOTION[0])
  const line = s.blockers.find((b) => b.startsWith(BLOCKER.example) && b.includes('home/hero'))
  assert.ok(line, s.blockers.join('\n'))
  assert.match(line, /copy\.lede\(marker\)/)
})
