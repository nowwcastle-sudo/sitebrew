// 제품 쉘 블록(P3-6 WFBLK-B — 감사 I01~I04·J01·J02·J05·J07·K03·K04·H01·H02·H04·B04·N10·L04).
// 푸터(사업자 정보 선택 칸)·세션 머리·상태 화면·읽기 오류의 로그인 슬롯·쿠키 다시 열기·대화상자 포커스 복귀·건너뛰기 링크를 서버 렌더 글자로 본다(브라우저 없음).
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/blocks-shell-p36.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, baseOk, h, html, load, root } from './lib/base-compare.mjs'

const B = 'registry/factory/blocks'
const src = (rel) => readFileSync(join(root, rel), 'utf8')

// ── K03 푸터 ─────────────────────────────────────────────────────────────────────────────────────
test('K03: footer/product-legal — 값이 있는 사업자 칸만 그리고, 하나도 없으면 칸 자체가 없다', async () => {
  const { FooterProductLegal } = await load(`${B}/footer/product-legal.tsx`)
  const fx = await load(`${B}/footer/product-legal.fixture.ts`)
  const full = html(h(FooterProductLegal, fx.fixture))
  for (const f of ['name', 'owner', 'address', 'phone', 'email', 'registrationNo', 'mailOrderNo', 'hostingProvider']) assert.match(full, new RegExp(`data-field="${f}"`), `${f} 칸`)
  assert.match(full, /href="tel:\+821000000000"/)
  assert.match(full, /href="mailto:hello@example\.com"/)
  // 일부만(전화·상호) — 나머지 여섯 칸은 없다
  const partial = html(h(FooterProductLegal, { ...fx.fixture, business: { name: 'Example Co.', phone: '+82 10-0000-0000', owner: '  ', email: '' } }))
  assert.equal([...partial.matchAll(/data-field="/g)].length, 2, '채워진 칸 둘만')
  assert.doesNotMatch(partial, /data-field="owner"|data-field="email"/, '공백·빈 문자열은 칸이 아니다')
  // 하나도 없음 — 사업자 구획이 없다(빈 제목·빈 dl 을 그리지 않는다)
  for (const business of [undefined, {}, { name: ' ' }]) {
    const none = html(h(FooterProductLegal, { ...fx.fixture, business }))
    assert.doesNotMatch(none, /data-business|<dl/, JSON.stringify(business))
  }
  const min = html(h(FooterProductLegal, fx.fixtureMin))
  assert.doesNotMatch(min, /data-business/)
  assert.match(min, /Terms of Service/)
  assert.doesNotMatch(min, /Refund Policy|Cookie settings/, '없는 링크는 그리지 않는다')
})

test('K03·K04: 푸터의 「쿠키 설정」은 data-consent-open 앵커(href 대체 길)이고, 법정 링크는 서버 HTML 에 있다', async () => {
  const { FooterProductLegal } = await load(`${B}/footer/product-legal.tsx`)
  const fx = await load(`${B}/footer/product-legal.fixture.ts`)
  const out = html(h(FooterProductLegal, fx.fixture))
  assert.match(out, /<a href="#cookie-settings" data-consent-open="" class="[^"]*">Cookie settings<\/a>/)
  for (const href of ['/terms', '/privacy', '/refund', '/contact']) assert.match(out, new RegExp(`href="${href}"`))
})

test('K03: 푸터 블록·예시에 실제 사업자 값이 없다(남도 쓰는 공장) — 예시는 누가 봐도 가짜 값', () => {
  const fixture = src(`${B}/footer/product-legal.fixture.ts`)
  const block = src(`${B}/footer/product-legal.tsx`)
  // 한국 전화·사업자번호 모양의 진짜 같은 숫자 금지: 예시 값은 0 으로만 이루어진 자리 값이다
  for (const m of fixture.matchAll(/\b(\d{2,3}-\d{2,4}-\d{4,5})\b/g)) assert.match(m[1], /^(10-)?[0-]+$/, `진짜 같은 번호: ${m[1]}`)
  assert.match(fixture, /Example Co\./)
  assert.match(fixture, /\+82 10-0000-0000/)
  assert.doesNotMatch(block, /\d{3}-\d{2}-\d{5}|\+82\s?10/, '블록 코드에 값이 박혀 있지 않다')
})

// ── N10·U1 세션 머리 ───────────────────────────────────────────────────────────────────────────────
test('N10: nav/account-bar — 세션 prop 이 머리를 정한다(로그아웃: 로그인·가입 / 로그인: 계정 메뉴 + 떨어진 로그아웃 폼)', async () => {
  const { NavAccountBar } = await load(`${B}/nav/account-bar.tsx`)
  const fx = await load(`${B}/nav/account-bar.fixture.ts`)
  const out = html(h(NavAccountBar, fx.fixture))
  assert.match(out, /data-session="signed-out"/)
  assert.match(out, />Sign in</)
  assert.match(out, />Sign up</)
  assert.doesNotMatch(out, /Sign out|<details|<form/)
  const inn = html(h(NavAccountBar, { ...fx.fixture, session: { status: 'signed-in', name: 'Example Person', email: 'p@example.com' }, signOutAction: '/sign-out' }))
  assert.match(inn, /data-session="signed-in"/)
  assert.doesNotMatch(inn, />Sign in<|>Sign up</, '로그인한 사람 머리에 「Sign in」 이 남지 않는다')
  assert.match(inn, /<details/)
  assert.match(inn, /Signed in as Example Person/)
  // 로그아웃은 주 메뉴 nav 밖의 POST 폼이다
  assert.match(inn, /<form [^>]*data-sign-out=""[^>]*action="\/sign-out"[^>]*method="post"[^>]*><button type="submit"[^>]*>Sign out<\/button><\/form>/)
  const nav = inn.slice(inn.indexOf('<nav'), inn.indexOf('</nav>'))
  assert.doesNotMatch(nav, /Sign out|<form/, '로그아웃이 주 메뉴 안에 없다')
  // 로그아웃 주소가 없으면 단추를 그리지 않는다(눌러도 갈 곳이 없는 단추 금지)
  assert.doesNotMatch(html(h(NavAccountBar, { ...fx.fixture, session: { status: 'signed-in' }, signOutAction: undefined })), /Sign out/)
})

test('N10: 세션 머리는 서버 컴포넌트이고 자바스크립트 없이 열린다(details) · 누름 대상 44px 훅', () => {
  const code = src(`${B}/nav/account-bar.tsx`)
  assert.doesNotMatch(code, /^"use client"/m, '서버 컴포넌트')
  assert.doesNotMatch(code, /useState|useEffect/)
  const css = src('registry/factory/styles/base.css')
  for (const cls of ['cn-block-nav-account-button', 'cn-block-nav-account-link']) assert.match(css.match(new RegExp(`\\.${cls} \\{[^}]*\\}`))?.[0] ?? '', /min-h-11/, `${cls} 44px`)
})

// ── H01·H02·H04·L04 상태 화면 ────────────────────────────────────────────────────────────────────
test('H01·H04·L04: state-screen 오류·404·로딩 — 머리 칸·지원 경로·요청 번호·data-error-code, 스타일 속성 없음(엄격 CSP)', async () => {
  const { StateScreenErrorRetry } = await load(`${B}/state-screen/error-retry.tsx`)
  const { StateScreenNotFound } = await load(`${B}/state-screen/not-found.tsx`)
  const { StateScreenLoading } = await load(`${B}/state-screen/loading.tsx`)
  const er = await load(`${B}/state-screen/error-retry.fixture.ts`)
  const nf = await load(`${B}/state-screen/not-found.fixture.ts`)
  const ld = await load(`${B}/state-screen/loading.fixture.ts`)
  const header = h('header', { 'data-test-header': '' }, 'HEADER')
  const e = html(h(StateScreenErrorRetry, { ...er.fixtureMax, header, headingLevel: 1 }))
  assert.ok(e.indexOf('HEADER') >= 0 && e.indexOf('HEADER') < e.indexOf('<section'), '머리가 블록 앞')
  assert.match(e, /<section[^>]*data-error-code="service_unavailable"/)
  assert.match(e, /data-request-id="req_01J9Z7Q4K3M8N2P5R6S7T8U9V0"/)
  assert.match(e, /href="\/contact"[^>]*>고객센터에 문의</)
  assert.match(e, /<h1[^>]*>예약 목록을/)
  assert.doesNotMatch(html(h(StateScreenErrorRetry, er.fixture)), /<h1|data-error-code|data-request-id/, '기본 출력은 예전 그대로(h2 · 새 칸 없음)')
  // 로그인 필요(401): [다시 시도] 대신 로그인 링크
  const si = html(h(StateScreenErrorRetry, { ...er.fixture, copy: { ...er.fixture.copy, signIn: { label: 'Sign in', href: '/sign-in?next=%2Faccount' } } }))
  assert.match(si, /href="\/sign-in\?next=%2Faccount"[^>]*>Sign in</)
  assert.doesNotMatch(si, /data-retry/)
  const n = html(h(StateScreenNotFound, { ...nf.fixtureMax, header }))
  assert.ok(n.indexOf('HEADER') < n.indexOf('<section'))
  assert.match(n, /data-error-code="not_found"/)
  assert.match(n, /data-request-id=/)
  assert.match(n, /href="\/contact"/)
  const l = html(h(StateScreenLoading, { ...ld.fixtureMax, header }))
  assert.match(l, /aria-busy="true"/)
  assert.match(l, /role="status"[^>]*>예약 목록과 일정/)
  assert.match(l, /data-slow/)
  assert.doesNotMatch(html(h(StateScreenLoading, ld.fixture)), /data-slow/)
  for (const out of [e, si, n, l]) assert.doesNotMatch(out, /\sstyle="/, '인라인 style 속성이 없다')
})

// ── B04·L04 읽기 오류 ────────────────────────────────────────────────────────────────────────────
test('B04: ReadError — signInRequired 이면 [다시 시도] 대신 로그인 링크, 아니면 예전 그대로, data-error-code 가 남는다', async () => {
  const { ReadError, ReadErrorProvider, signInHref } = await load(`${B}/_shared/port-read.tsx`)
  const signIn = { href: signInHref('/sign-in', '/account/billing'), label: 'Sign in', title: 'Sign in to see your subscription', message: 'Your session ended.' }
  assert.equal(signIn.href, '/sign-in?next=%2Faccount%2Fbilling')
  const err = { status: 'error', message: 'Sign in to continue.', code: 'signInRequired', retry: () => {} }
  const a = html(h(ReadError, { state: err, title: "We couldn't load it", retryLabel: 'Reload', signIn }))
  assert.match(a, /data-error-code="signInRequired"/)
  assert.match(a, /data-sign-in-required/)
  assert.match(a, /<a [^>]*href="\/sign-in\?next=%2Faccount%2Fbilling"[^>]*>Sign in<\/a>/)
  assert.match(a, /Sign in to see your subscription/)
  assert.doesNotMatch(a, /Reload/)
  // 컨텍스트로도 받는다(쪽 위쪽에서 한 번)
  const b = html(h(ReadErrorProvider, { signIn }, h(ReadError, { state: err, title: "We couldn't load it", retryLabel: 'Reload' })))
  assert.match(b, /href="\/sign-in\?next=%2Faccount%2Fbilling"/)
  // 다른 오류 — 다시 시도, 로그인 링크 없음
  const c = html(h(ReadError, { state: { status: 'error', message: 'Down', code: 'server_error', retry: () => {} }, title: 'T', retryLabel: 'Reload', signIn }))
  assert.match(c, /Reload/)
  assert.doesNotMatch(c, /sign-in|data-sign-in-required/)
  assert.match(c, /data-error-code="server_error"/)
  // code 없는 예전 오류 — 출력이 예전과 같다(속성 없음)
  const d = html(h(ReadError, { state: { status: 'error', message: 'Down', retry: () => {} }, title: 'T', retryLabel: 'Reload' }))
  assert.doesNotMatch(d, /data-error-code|data-sign-in/)
  // 로그인 행동이 없으면 signInRequired 도 예전 그대로(다시 시도)
  const e = html(h(ReadError, { state: err, title: 'T', retryLabel: 'Reload' }))
  assert.match(e, /Reload/)
})

test('B04: signInHref — 같은 사이트 경로만 next 로 싣는다(열린 리다이렉트 방지)', async () => {
  const { signInHref } = await load(`${B}/_shared/port-read.tsx`)
  assert.equal(signInHref('/sign-in', '/account?tab=billing'), '/sign-in?next=%2Faccount%3Ftab%3Dbilling')
  assert.equal(signInHref('/sign-in?lang=en', '/a'), '/sign-in?lang=en&next=%2Fa')
  for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, undefined]) assert.equal(signInHref('/sign-in', bad), '/sign-in', String(bad))
})

test('L04: 폼 알림 상자에 실패 code 가 data-error-code 로 남는다(원천 검사)', () => {
  for (const f of ['port-form', 'form-flow']) {
    const code = src(`${B}/_shared/${f}.tsx`)
    // P3-7 AXWF: 속성은 submit-guard noticeAttrs 한 곳이 단다(data-error-code 는 그대로, data-retryable·data-state 가 곁에 — blocks-human-approval.test.mjs)
    assert.match(code, /\{\.\.\.noticeAttrs\(e\)\}/, f)
    assert.match(src(`${B}/_shared/submit-guard.tsx`), /"data-error-code": n\.code \|\| undefined/, f)
    assert.ok([...code.matchAll(/code: r\.code/g)].length >= 3, `${f}: 실패 갈래마다 code 를 싣는다`)
  }
})

// ── K04·J07 쿠키 다시 열기 ────────────────────────────────────────────────────────────────────────
test('K04: consent/bottom-banner — preferences 가 있으면 「항목별로 고르기」가 대화상자를 여는 단추(href 없음), 없으면 예전 링크', async () => {
  const { ConsentBottomBanner } = await load(`${B}/consent/bottom-banner.tsx`)
  const fx = await load(`${B}/consent/bottom-banner.fixture.ts`)
  const withPrefs = html(h(ConsentBottomBanner, fx.fixture))
  assert.match(withPrefs, /<button type="button" aria-haspopup="dialog" class="[^"]*">항목별로 고르기<\/button>/)
  assert.doesNotMatch(withPrefs, /href="#cookie-settings"/)
  const min = html(h(ConsentBottomBanner, fx.fixtureMin))
  assert.doesNotMatch(min, /항목별로 고르기/)
  const linkOnly = html(h(ConsentBottomBanner, { ...fx.fixture, copy: { ...fx.fixture.copy, preferences: undefined } }))
  assert.match(linkOnly, /<a href="#cookie-settings" class="[^"]*">항목별로 고르기<\/a>/)
})

test('J07: 쿠키 띠 CSS — 좁은 화면 높이 상한 20dvh(1/5), 넘치는 글은 글 칸 안에서만 스크롤하고 단추 줄은 남는다', () => {
  const css = src('registry/factory/styles/base.css')
  const rule = (name) => css.match(new RegExp(`\\.${name} \\{[^}]*\\}`))?.[0] ?? ''
  assert.match(rule('cn-block-cookie'), /max-h-\[20dvh\]/)
  assert.match(rule('cn-block-cookie'), /md:max-h-\[28dvh\]/)
  assert.match(rule('cn-block-cookie-text'), /overflow-y-auto/)
  assert.match(rule('cn-block-cookie-actions'), /shrink-0/)
})

// ── J02 대화상자 포커스 복귀 ────────────────────────────────────────────────────────────────────
test('J02: ui dialog — 닫으면 연 요소로 포커스가 돌아간다(트리거 없이 상태로 연 대화상자도) · 닫기 이름은 locale 표', () => {
  const code = src('registry/factory/ui-src/dialog.tsx')
  assert.match(code, /finalFocus=\{finalFocus \?\? \(\(\) => \(opener\?\.isConnected \? opener : true\)\)\}/)
  assert.match(code, /function DialogPanel\(/, '연 요소는 포털 안쪽 부품이 열리는 순간에 붙잡는다')
  assert.match(code, /<DialogPortal>\s*<DialogPanel \{\.\.\.props\} \/>\s*<\/DialogPortal>/)
  assert.match(code, /uiLabels\(locale\)\.close/)
})

// ── J01 건너뛰기 링크 ───────────────────────────────────────────────────────────────────────────
test('J01: SiteShell — 첫 요소가 「본문으로 건너뛰기」이고 목적지 main#main 이 있다 · SiteShellSkipLink 를 따로 쓸 수 있다', async () => {
  const mod = await load('registry/factory/ui-src/site-shell.tsx')
  const out = html(h(mod.SiteShell, { archetype: 'saas', logo: h('a', { href: '/' }, 'Logo'), pageTitle: 'Title', locale: 'en' }, 'body'))
  const firstLink = out.match(/<a [^>]*>/)[0]
  assert.match(firstLink, /href="#main"/)
  assert.match(firstLink, /data-slot="site-shell-skip-link"/)
  assert.match(out, /<main id="main" tabindex="-1"/)
  assert.match(out, /Skip to main content/)
  const solo = html(h(mod.SiteShellSkipLink, { mainId: 'content', locale: 'en' }))
  assert.match(solo, /href="#content"/)
  assert.match(solo, /Skip to main content/)
  assert.match(html(h(mod.SiteShellSkipLink, {})), /href="#main"[^>]*>본문 바로가기</)
})

// ── I01~I04 날짜 ───────────────────────────────────────────────────────────────────────────────
test('I01~I04: DateText — 영어는 월 이름 글자 · <time datetime> · 시간대 prop (v0.0.9 D234 로 이미 됨 — 회귀 고정)', async () => {
  const { DateText } = await load(`${B}/_shared/billing-format.tsx`)
  const en = html(h(DateText, { iso: '2026-10-31T15:00:00Z', as: 'since', locale: 'en', timeZone: 'America/New_York' }))
  assert.match(en, /<time[^>]*datetime="2026-10-31T15:00:00Z"[^>]*>October 31, 2026<\/time>/i)
  const ko = html(h(DateText, { iso: '2026-10-31T15:00:00Z', as: 'since' }))
  assert.match(ko, />2026년 11월 1일</)
})

test('I01~I04: 날짜 모양을 직접 고르는 블록 셋(예약 일시·특별 영업일·설립 연월) — 한국어 출력은 기준 커밋과 같고, locale en 이면 한글 날짜가 없다', { skip: !baseOk && `기준 커밋 ${BASE} 없음` }, async () => {
  const pascal = (s) => s.split(/[/-]/).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  const KO_DATE = /\d{1,2}월 \d{1,2}일|\d{4}년 \d{1,2}월/
  let seen = 0
  for (const name of ['confirmation/booking-complete', 'hours-location/hours-table-map-link', 'trust/brand-fact-sheet']) {
    const render = async (mode, extra) => {
      const mod = await load(`${B}/${name}.tsx`, mode)
      const fx = await load(`${B}/${name}.fixture.ts`, mode)
      const Comp = mod[pascal(name)]
      // 캘린더 링크 속 DTSTAMP 는 만든 순간의 시각이라 매번 다르다 — 비교에서 뺀다
      return ['fixture', 'fixtureMax', 'fixtureMin'].map((k) => html(h(Comp, { ...fx[k], ...extra })).replace(/DTSTAMP%3A\d{8}T\d{6}Z/g, 'DTSTAMP').replace(/ focus-visible:ring-offset-2 focus-visible:ring-offset-background/g, '').replace(/(<a\b[^>]*?) role="button"( tabindex="0")?/g, '$1').replace(/(<a\b[^>]*?) tabindex="0"(?= data-slot="button")/g, '$1').replace(/(<a\b[^>]*?) data-slot="button"/g, '$1')) // FINAL-WF3 항목 10·11: 버튼 포커스 링 바깥 간격·이동 링크의 role=button 제거
    }
    const old = await render('old')
    const cur = await render('new')
    cur.forEach((out, i) => {
      let at = 0
      while (at < out.length && out[at] === old[i][at]) at++
      assert.equal(out, old[i], `${name}[${i}]: 한국어 출력이 기준 커밋과 다르다 — 처음 다른 곳 ${at}: 기준 「${old[i].slice(Math.max(0, at - 40), at + 80)}」 / 지금 「${out.slice(Math.max(0, at - 40), at + 80)}」`)
    })
    const en = await render('new', { locale: 'en' })
    const times = (out) => [...out.matchAll(/<time[^>]*>(.*?)<\/time>/gi)].map((m) => m[1]).join(" | ")
    cur.forEach((ko, i) => {
      if (!KO_DATE.test(times(ko))) return
      seen++
      assert.doesNotMatch(times(en[i]), KO_DATE, `${name}[${i}]: en 인데 한글 날짜`)
    })
  }
  assert.ok(seen >= 3, `날짜가 그려진 출력이 ${seen}개뿐 — 시험이 날짜 경로를 못 본다`)
})
