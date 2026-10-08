// FINAL-WF5 항목 3 — 같은 사실(영업시간·주소·전화)을 그리는 블록 둘이 한 쪽에 오면 겹치는 쪽의 선택 섹션은 건너뛴다(대장 C424).
// local 홈: hours-table(today-highlight: 주소·지도·요일 표·전화)와 directions(hours-table-map-link: 요일 표·주소·교통·주차·지도)가 같은 요일 표와 주소를 두 번 그렸다.
// 실행: node --test --test-force-exit --test-timeout=600000 factory/scripts/stamp-final-wf5-facts.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gen, localBrief, localContent, root, makeRun } from './lib/stamp-site-fixtures.mjs'
import { OTHER_RUNS } from './lib/app-shell-fixtures.mjs'
import { factGroupsOf, redundantFactKeys } from '../stamp/gen-pages.mjs'
import { refsOf } from '../stamp/site-bind.mjs'

const TMP = join(root, '.tmp', 'final-wf5-facts-test')
const siteOf = (g) => JSON.parse(readFileSync(join(g.siteDir, 'content', 'site.json'), 'utf8'))
const L = await gen(await makeRun(TMP, localBrief(), localContent))
const local = siteOf(L)
const outs = new Map()
for (const r of OTHER_RUNS) outs.set(r.id, await gen(await r.make(TMP)))

const ref = (p) => ({ $ref: p })

test('factGroupsOf: hours.N → hours, business.address → address, business.phone → phone, 그 밖 ref 는 세지 않는다', () => {
  assert.deepEqual([...factGroupsOf({ a: ref('hours.0'), b: [ref('hours.3'), ref('business.address')], c: ref('business.phone'), d: ref('mapLinks.naver'), e: ref('business.email') })].sort(), ['address', 'hours', 'phone'])
  assert.deepEqual([...factGroupsOf({ x: ref('directions.transit') })], [])
})

test('redundantFactKeys: 다른 잎·전역 잎이 이미 다 그린 선택 섹션만, 뒤에서부터 센다(서로 같으면 앞 것이 남는다)', () => {
  const sec = (...p) => ({ props: Object.fromEntries(p.map((x, i) => [`k${i}`, ref(x)])) })
  const sections = {
    'home/a': sec('hours.0', 'business.address', 'business.phone'),
    'home/b': sec('hours.0', 'business.address', 'directions.transit'),
    'home/c': sec('hours.0', 'business.address', 'business.phone'),
    'global/footer': sec('business.address', 'business.phone'),
  }
  const mk = (k) => ({ key: k, block: 'block-x' })
  // a 는 선택, b 는 필수: a 의 사실을 b(시간·주소)와 푸터(전화)가 다 그린다 → a 건너뜀
  assert.deepEqual(redundantFactKeys({ leaves: [mk('home/a'), mk('home/b')], globals: [mk('global/footer')], sections, required: (k) => k === 'home/b' }), ['home/a'])
  // 둘 다 선택이고 사실이 같으면 뒤 것(c)만 건너뛰고 앞 것(a)은 남는다
  assert.deepEqual(redundantFactKeys({ leaves: [mk('home/a'), mk('home/c')], globals: [], sections, required: () => false }), ['home/c'])
  // 필수 섹션은 겹쳐도 건너뛰지 않는다
  assert.deepEqual(redundantFactKeys({ leaves: [mk('home/a'), mk('home/b')], globals: [mk('global/footer')], sections, required: () => true }), [])
  // 사실이 하나라도 다른 곳에 없으면(영업시간) 그대로 둔다
  assert.deepEqual(redundantFactKeys({ leaves: [mk('home/a')], globals: [mk('global/footer')], sections, required: () => false }), [])
  // 사실을 하나도 그리지 않는 섹션은 대상이 아니다
  assert.deepEqual(redundantFactKeys({ leaves: [{ key: 'home/n', block: 'block-x' }, mk('home/a')], globals: [mk('global/footer')], sections: { ...sections, 'home/n': { props: {} } }, required: () => false }), [])
})

const pageKeys = (g, route) => {
  const file = route === '/' ? 'app/page.tsx' : `app/${route.split('/').filter(Boolean).join('/')}/page.tsx`
  return [...new Set([...readFileSync(join(g.siteDir, file), 'utf8').matchAll(/sectionProps\("([^"]+)"\)/g)].map((m) => m[1]))]
}

test('local 홈: 요일 표(hours)와 주소가 히어로·푸터·하단 바 밖 본문 블록 한 곳에만 있다', () => {
  const keys = pageKeys(L, '/').filter((k) => !k.startsWith('global/'))
  const drawing = (grp) => keys.filter((k) => !/^block-hero-/.test(local.sections[k].block) && factGroupsOf(local.sections[k].props).has(grp)) // 첫 화면(히어로)이 주소를 한 번 보이는 것은 의도다
  assert.equal(drawing('hours').length, 1, `hours: ${drawing('hours')}`)
  assert.equal(drawing('address').length, 1, `address: ${drawing('address')}`)
  assert.ok(keys.includes('home/directions'), '필수 섹션 directions 는 그려진다')
  assert.ok(!keys.includes('home/hours-table'), '겹치는 선택 섹션은 건너뛴다')
})

test('건너뛴 섹션은 site.json·페이지 파일·블록 설치 목록 어디에도 남지 않는다', () => {
  assert.equal(local.sections['home/hours-table'], undefined)
  assert.ok(!readFileSync(join(L.siteDir, 'app', 'page.tsx'), 'utf8').includes('home/hours-table'))
  assert.ok(!JSON.stringify(L.skipped.map((s) => s.key)).includes('home/directions'))
  assert.ok(L.skipped.some((s) => s.key === 'home/hours-table' && /같은 사실/.test(s.why)), JSON.stringify(L.skipped.map((s) => [s.key, s.why])))
  // 필수 섹션이 merged 로 센 것이 아니라 그려졌으니 「필수 섹션 그리지 않음」 blocker 가 없다
  assert.deepEqual(L.blockers.filter((b) => /필수 섹션 그리지 않음/.test(b) && /hours|directions/.test(b)), [])
})

test('원형 11 후보 어디서든 본문 블록 둘이 같은 요일 표(hours)를 그리지 않는다 — 건너뜀이 다른 원형의 필수 섹션을 지우지 않는다', () => {
  const bad = []
  for (const [id, g] of outs) {
    const site = siteOf(g)
    for (const route of Object.keys(site.pages)) {
      const keys = pageKeys(g, route).filter((k) => !k.startsWith('global/') && site.sections[k])
      const hours = keys.filter((k) => factGroupsOf(site.sections[k].props).has('hours'))
      if (hours.length > 1) bad.push(`${id} ${route} ${hours}`)
    }
  }
  assert.deepEqual(bad, [])
  assert.ok(refsOf({ a: ref('hours.0') }).size === 1) // 양성 대조용 가져오기가 살아 있다
})
