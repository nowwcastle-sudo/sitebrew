// P3-4 일관성 레인(P4CON) 수정 6 — 첫 실측 07-qa 가 잡은 접근성 결함(대장 C242): 셸 로고 링크 24px 미만·푸터 「홈」 링크 폭 14.7px·
// /services 에서 고정 예약 줄이 둘 겹쳐 서로의 초점 요소를 가림(2.4.11). 원천에서 고친다(훅·셸 부품·생성기) — 실제 크기 재측정은 07-qa a11y 관문.
// 실행: node --test --test-force-exit --test-timeout=200000 factory/scripts/site-a11y-fixes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root, localBrief, localContent, makeRun as makeRunIn, gen } from './lib/stamp-site-fixtures.mjs'

const read = (rel) => readFileSync(join(root, rel), 'utf8')
const TMP = join(root, '.tmp', 'site-a11y-fixes-test')

/** base.css 안 훅 규칙 하나의 @apply 본문. */
const hook = (css, name) => css.match(new RegExp(`\\n\\.${name} \\{\\n  @apply ([^;]+);\\n\\}`))?.[1] ?? ''

test('푸터 링크 훅: 글이 짧은 링크(「홈」)도 폭 44px 이상 — 세로만 44 이던 14.7×44 를 24px 미만 폭으로 두지 않는다(2.5.8)', () => {
  const css = read('registry/factory/styles/base.css')
  const link = hook(css, 'cn-block-footer-link')
  assert.match(link, /\bmin-h-11\b/)
  assert.match(link, /\bmin-w-11\b/, `푸터 링크 훅에 min-w-11 이 없다: ${link}`)
  // 컴파일된 블록에도 훅이 풀려 들어갔다(3개 푸터 변형이 같은 훅을 쓴다)
  for (const v of ['columns-business', 'compact-strip', 'stacked-legal']) assert.match(read(`registry/factory/blocks/footer/${v}.tsx`), /cn-block-footer-link/, v)
})

test('사이트 템플릿 로고 링크: 글 높이(23px)만 잡히던 링크를 inline-flex min-h-11 로 — 88.5×23 → 44px 높이 대상(2.5.8)', () => {
  // SiteShell 의 logo 는 소비자가 넘기는 요소다(셸 부품은 훅 밖 모양 클래스를 못 단다 — lint-ui shape-outside-hook). 로고 링크를 만드는 곳은 사이트 템플릿 하나.
  const src = read('factory/stamp/site-template/lib/site.tsx')
  const cls = src.match(/<a href="\/" className="([^"]+)"/)?.[1] ?? ''
  assert.ok(cls, '로고 링크를 못 찾았다')
  for (const c of ['inline-flex', 'min-h-11', 'items-center']) assert.ok(cls.split(' ').includes(c), `${c} — ${cls}`)
  // 셸 부품은 그대로다(훅 밖 모양 클래스를 더하지 않았다)
  assert.doesNotMatch(read('registry/factory/ui-src/site-shell.tsx'), /\[&_a\]:min-h/)
})

test('생성기: 쪽마다 고정 하단 줄은 하나다 — 쪽이 제 예약 줄(bottom-tab)을 그리면 전역 줄을 또 얹지 않는다(겹쳐 서로의 초점을 가린다, 2.4.11)', async () => {
  const r = await makeRunIn(TMP, localBrief(), localContent)
  const s = await gen(r)
  const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
  const bottomKeys = Object.entries(site.sections).filter(([, v]) => /^block-bottom-tab-/.test(v.block)).map(([k]) => k)
  assert.ok(bottomKeys.includes('global/sticky-booking-bar'), `전역 줄이 있다 — ${bottomKeys.join(', ')}`)
  const ownBar = bottomKeys.find((k) => k !== 'global/sticky-booking-bar')
  assert.ok(ownBar, '이 원형은 쪽 안에 제 예약 줄도 그린다(product-detail/booking-cta)')
  const tagOf = (key) => `<${key.split('/').map((p) => p.split('-').map((x) => x[0].toUpperCase() + x.slice(1)).join('')).join('')}`
  const pages = []
  for (const route of s.routes) {
    const file = join(s.siteDir, 'app', route === '/' ? '' : route.slice(1), 'page.tsx')
    const src = readFileSync(file, 'utf8')
    const n = bottomKeys.filter((k) => src.includes(tagOf(k) + ' ')).length
    pages.push([route, n])
    assert.ok(n <= 1, `${route} 에 고정 하단 줄이 ${n}개`)
  }
  const services = pages.find(([route]) => route === '/services')
  assert.ok(services, `/services 쪽이 있다 — ${s.routes.join(',')}`)
  const src = readFileSync(join(s.siteDir, 'app', 'services', 'page.tsx'), 'utf8')
  assert.ok(src.includes(tagOf(ownBar) + ' '), '쪽 자신의 예약 줄은 그대로')
  assert.equal(src.includes('<GlobalStickyBookingBar'), false, '전역 줄은 빠진다')
  // 다른 쪽에는 전역 줄이 그대로 있다
  const home = readFileSync(join(s.siteDir, 'app', 'page.tsx'), 'utf8')
  assert.ok(home.includes('<GlobalStickyBookingBar'), '홈에는 전역 줄')
})
