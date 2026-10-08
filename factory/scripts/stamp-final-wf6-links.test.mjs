// FINAL-WF6 항목 1·2 — 찍어낸 사이트의 「그 쪽에 없는 앵커」(대장 C426·WF4a).
//   · 블록 예시의 `#pricing`(구독 관리 「요금제 고르기」)·`#cookie-settings`(푸터·배너 「쿠키 설정」)·`#sample`·`#dashboard`(온보딩)가 그 쪽에 없는 섹션을 가리켰다
//   · 순수 함수(pageAnchorTargets·linkAppRoutes extra·staticDeadLinks)와, 골든 20 × 방향 3안(실제 03 고름 + 실제 06 generateSite, 빌드 없음)의 정적 링크 감사
// 실행: node --test --test-force-exit --test-timeout=900000 factory/scripts/stamp-final-wf6-links.test.mjs   (골든 감사는 무거운 시험 — ci/tests-heavy.txt)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { APP_ANCHORS, linkAppRoutes, pageAnchorTargets } from '../stamp/site-consistency.mjs'
import { staticDeadLinks } from '../stamp/link-check.mjs'
import { staticLinkProblems } from '../stamp/gen-pages.mjs'
import { goldenIds } from '../stamp/golden.mjs'
import { goldenSites } from './lib/golden-sites.mjs'

const ids = (o) => new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]))
const routes = { home: '/', pricing: '/pricing', billing: '/billing', signup: '/signup', account: '/account' }

// ── 순수 함수 ──────────────────────────────────────────────────────────────────────────────
test('pageAnchorTargets: 같은 쪽에 그 id 가 있으면 건드리지 않고, 없으면 사이트 전체에서 찾은 쪽의 <경로>#<id> 로 잇는다', () => {
  const idsByPage = ids({ home: ['hero'], pricing: ['pricing'], signup: ['cookie-settings'], global: ['site-footer'] })
  assert.deepEqual(pageAnchorTargets({ here: 'pricing', idsByPage, routes }), { '#cookie-settings': '/signup#cookie-settings' })
  assert.deepEqual(pageAnchorTargets({ here: 'signup', idsByPage, routes }), { '#pricing': '/pricing#pricing' })
  assert.deepEqual(pageAnchorTargets({ here: 'billing', idsByPage, routes }), { '#cookie-settings': '/signup#cookie-settings', '#pricing': '/pricing#pricing' })
})

test('pageAnchorTargets: 쿠키 블록이 사이트에 없으면 null(링크를 뺀다), 요금제 블록이 없으면 요금제 쪽 경로 — 요금제 쪽도 없으면 null', () => {
  const none = ids({ home: ['hero'], billing: ['billing'], global: ['site-footer'] })
  assert.deepEqual(pageAnchorTargets({ here: 'billing', idsByPage: none, routes }), { '#cookie-settings': null, '#pricing': '/pricing' })
  const noPricingRoute = { home: '/', billing: '/billing' }
  assert.deepEqual(pageAnchorTargets({ here: 'home', idsByPage: none, routes: noPricingRoute }), { '#cookie-settings': null, '#pricing': null })
})

test('pageAnchorTargets: 03 이 어림한 요금제 앵커가 안 그려졌으면 그 id 의 앵커도 같이 푼다(landing 홈 히어로의 #pricing)', () => {
  const idsByPage = ids({ home: ['hero', 'faq'], global: [] })
  const got = pageAnchorTargets({ here: 'home', idsByPage, routes: { home: '/' }, pricingIds: ['plans'] })
  assert.deepEqual(got, { '#cookie-settings': null, '#pricing': null, '#plans': null })
  const drawn = pageAnchorTargets({ here: 'home', idsByPage: ids({ home: ['hero'], pricing: ['plans'] }), routes, pricing: { page: 'pricing', id: 'plans' }, pricingIds: ['plans'] })
  assert.equal(drawn['#pricing'], '/pricing#plans', '그려진 요금제 섹션의 실제 id 로 간다')
})

test('linkAppRoutes extra: 문자열이면 잇고, null 이면 선택 칸을 통째로 빼며, 필수면 홈으로 보내지 않고 dead 로 남긴다', () => {
  const props = { copy: { none: { label: '요금제 보기', href: '#pricing' }, settings: { label: '쿠키 설정', href: '#cookie-settings' } } }
  const r = linkAppRoutes(props, routes, new Set(['settings']), { '#pricing': '/pricing', '#cookie-settings': null })
  assert.equal(props.copy.none.href, '/pricing')
  assert.equal('settings' in props.copy, false, '쿠키 블록이 없으면 선택 칸(settings)을 뺀다')
  assert.deepEqual(r.dead, [])
  const req = { copy: { settings: { label: '쿠키 설정', href: '#cookie-settings' } } }
  const r2 = linkAppRoutes(req, routes, new Set(), { '#cookie-settings': null })
  assert.equal(req.copy.settings.href, '#cookie-settings', '필수 칸은 못 빼고, 예시 앱 화면용 홈 대체도 하지 않는다')
  assert.deepEqual(r2.dead.map((d) => d.path), ['copy.settings.href'])
})

test('APP_ANCHORS: #sample·#dashboard 는 이어질 쪽이 없다 — 선택 칸이면 링크를 빼고 필수면 계정 쪽으로(온보딩 건너뛰기)', () => {
  assert.equal(APP_ANCHORS['#sample'], null)
  assert.equal(APP_ANCHORS['#dashboard'], null)
  const wizard = { copy: { skip: { label: '건너뛰기', href: '#dashboard' }, sample: { label: '예시 먼저', href: '#sample' } } }
  linkAppRoutes(wizard, routes, new Set(['sample']))
  assert.equal(wizard.copy.skip.href, '/account', '필수 건너뛰기는 닿는 쪽으로')
  assert.equal('sample' in wizard.copy, false, '선택 「예시 먼저 보기」는 뺀다')
})

test('staticDeadLinks(음성 대조): 그 쪽 파일이 부르는 섹션 id 에 없는 #id·/쪽#id 와 사이트에 없는 경로를 잡고, 있는 것·바깥 주소는 통과한다', () => {
  const site = {
    pages: { '/': {}, '/pricing': {}, '/billing': {} },
    sections: {
      'billing/subscription': { block: 'block-x', props: { id: 'sub', copy: { none: { href: '#pricing' }, ok: { href: '/pricing#pricing' }, gone: { href: '/nowhere' }, ext: { href: 'https://example.org/#x' }, blank: { href: '#' } } } },
      'pricing/plans': { block: 'block-y', props: { id: 'pricing', copy: { self: { href: '#pricing' } } } },
      'global/footer': { block: 'block-f', props: { id: 'footer', copy: { cookie: { href: '#cookie-settings' } } } },
    },
  }
  const pageKeys = { '/': ['global/footer'], '/pricing': ['pricing/plans'], '/billing': ['billing/subscription', 'global/footer'] }
  const got = staticDeadLinks({ site, pageKeys, defaultIdOf: () => null }).map((d) => `${d.route} ${d.key} ${d.href} ${d.why}`).sort()
  assert.deepEqual(got, [
    '/ global/footer #cookie-settings anchor',
    '/billing billing/subscription # empty',
    '/billing billing/subscription #pricing anchor',
    '/billing billing/subscription /nowhere route',
    '/billing global/footer #cookie-settings anchor',
  ].sort())
})

// ── 골든 20 × 방향 3안 ─────────────────────────────────────────────────────────────────────
// 아래는 「블록 안쪽 id 로 닿거나 상태(오류·완료·빈 목록·승인 대기)에서만 그려지는」 예시 앵커·경로다 — 이 레인 밖(대장 C427). 목록에 없는 새 죽은 링크는 시험이 막고,
// 목록의 줄이 더는 안 나오면(고쳐졌으면) 시험이 알려 목록에서 빼게 한다.
const KNOWN = [
  [/ copy\.notices\.approval\.route\.href=#contact$/, '승인 대기 알림(approval_required 결과일 때만 그려진다)의 문의 링크 — 블록 17종 공통'],
  [/^block-account-billing-manage copy\.(?:cancel|restart)\.href=/, '구독 관리의 해지·재시작 단추 — 포트 호출이 우선이고 href 는 포트가 없을 때의 폴백'],
  [/^block-account-profile-settings copy\.(?:actions\..+|remove)\.href=/, '계정 설정의 항목별 안쪽 앵커(이름·메일·비밀번호·2단계·탈퇴)'],
  [/^block-auth-sign-in copy\.(?:done|twoFactor)\.href=/, '로그인 완료·2단계 화면 — 로그인 성공 뒤 상태에서만 그려진다'],
  [/^block-auth-sign-up-consents copy\.done\.href=/, '가입 완료 화면 — 가입 성공 뒤 상태에서만 그려진다'],
  [/^block-confirmation-booking-complete copy\.(?:help\.channel|primary)\.href=/, '예약 완료의 길 안내·카카오 채널 — 예약 쪽 구조 칸이 따로 있어야 이어진다(C143 줄기)'],
  [/^block-onboarding-setup-wizard copy\.branches\./, '온보딩 마법사 분기(가져오기·알림 예약)의 예시 앱 화면'],
  [/^block-paywall-limit-meter copy\.blocked\.free\.href=/, '한도 도달 상태에서만 그려지는 무료 보관함 링크'],
  [/^block-product-list-grid-cards copy\.empty\.action\.href=/, '목록이 빈 상태에서만 그려지는 사전 주문 단추'],
  [/^block-retention-cancel-flow copy\.done\.back\.href=/, '해지 완료 상태에서만 그려지는 돌아가기'],
  [/^block-state-screen-(?:empty-guide|offline-cached) /, '빈 상태·오프라인 안내의 예시 앱 경로(/admin/…·/app/…) — 앱 쪽이 없는 사이트는 이 안내를 그리지 않는다(C427)'],
]
const SKIP = process.env.WF6_SKIP_GOLDEN === '1' ? 'WF6_SKIP_GOLDEN=1' : false

test('골든 20 × 방향 3안(실제 03 고름 + 실제 06): 쪽에 없는 앵커·사이트에 없는 경로가 알려진 상태 전용 줄 말고는 0 — #pricing·#cookie-settings·#sample·#dashboard 는 한 곳도 없다', { skip: SKIP, timeout: 900000 }, async () => {
  const stamp = await import('../stamp/stamp.mjs')
  const deps = await stamp.defaultDeps()
  const tmp = join(process.env.WF6_TMP ?? tmpdir(), 'fv1-final-wf6-golden-sites')
  const unknown = [], hit = new Set(), failed = []
  let sites = 0
  for (const id of goldenIds()) {
    for (const s of await goldenSites(tmp, id, { stamp, deps })) {
      if (!s.siteDir) { failed.push(`${id}/${s.cand}: ${s.error}`); continue }
      sites++
      const site = JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
      for (const p of staticLinkProblems(s.siteDir)) {
        const line = `${site.sections[p.key].block} ${p.path}=${p.href}`
        const k = KNOWN.findIndex(([re]) => re.test(line))
        if (k >= 0) hit.add(k)
        else unknown.push(`${id}/${s.cand} ${p.why} ${p.route} ${line}`)
      }
    }
  }
  assert.deepEqual(failed, [], '06 이 던진 후보가 없다')
  assert.equal(sites, 60, '골든 20 × 3안')
  assert.deepEqual(unknown, [])
  assert.deepEqual(KNOWN.map(([, why], i) => (hit.has(i) ? null : why)).filter(Boolean), [], '더는 안 나오는 줄은 목록에서 뺀다(낡은 항목)')
})
