// FV1 Task 5.18 — 06 이 전역 앱 셸을 그린다(골든 1차 「필수 섹션 그리지 않음」 10줄 중 dashboard 3 + pwa 2 곳).
//   dashboard: 사이드바(nav/app-sidebar)·상단 줄(nav/top-bar)·앱 전체 상태 화면(app/loading·error·not-found) / pwa: 연결 띠(offline-cached)·새 판 알림(update-toast).
//   ① 순수(planAppShell): 검색은 검색을 받는 쪽이 그려졌을 때만, 알림은 경고 목록이 그려졌을 때만, 연결 띠·알림은 콘텐츠 상태 문구가 있을 때만(거짓 동작 없음).
//   ② 통합(정적 06 `install: false`): 「필수 섹션 그리지 않음」 0 · 레이아웃 잎 · h1 하나·첫 화면 구획 유지 · 서비스 워커 신호 없이는 알림 없음 · 템플릿에 서비스 워커 등록 없음.
//   ③ 회귀: dashboard·pwa 가 아닌 원형 9개의 06 출력(글자 파일 전부 sha256)은 앱 셸 변경 전(기준 커밋 5801cdd3)과 한 글자도 다르지 않다.
//   ④ 블록: top-bar 의 검색·알림, offline-cached 의 저장 구획은 선택이고 안 주면 그 자리만 빠진다(예시는 예전 그대로).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/scripts/stamp-app-shell.test.mjs
// 기준 해시를 다시 뜰 때(앱 셸이 아닌 다른 변경이 다른 원형의 06 출력을 일부러 바꿀 때만): WF_WRITE_APP_SHELL_BASELINE=1 node --test … (파일 머리 baseCommit 을 함께 고친다. FV1 Task 5.17 BOLD: 새 히어로 허용 목록으로 local·saas 두 곳이 일부러 바뀌어 다시 떴다. FINAL-WF2: 링크·메타 설명·요금제 버튼·빈 쪽 메뉴·문의 완료 문구 등 06 묶기 고침으로 9개 원형의 page.tsx·site.json 이 일부러 바뀌어 다시 떴다. FINAL-WF4: 목 포트·매니페스트 색 템플릿 파일과 요금제 id 로 모든 원형의 lib/ports.ts·lib/site.tsx 와 saas·landing 의 content/site.json 이 일부러 바뀌어 다시 떴다. QFIX3: local 홈 구획 순서(영업시간 표가 메뉴보다 앞)·brand·public 머리글 연락 행동으로 local·brand·public 의 page.tsx·site.json 이 일부러 바뀌어 다시 떴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { BLOCKER, blockItems, h1Problems, installNames, undrawnRequiredBlockers } from '../stamp/gen-pages.mjs'
import { APP_SHELL_UI, planAppShell, STATE_SCREEN_BLOCKS } from '../stamp/app-shell.mjs'
import { gen, root } from './lib/stamp-site-fixtures.mjs'
import { OTHER_RUNS, dashboardRun, hashSite, pwaRun } from './lib/app-shell-fixtures.mjs'

const TMP = join(root, '.tmp', 'stamp-app-shell-test')
const BASELINE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stamp-app-shell', 'other-archetypes.json')
const siteOf = (s) => JSON.parse(readFileSync(join(s.siteDir, 'content', 'site.json'), 'utf8'))
const read = (s, ...p) => readFileSync(join(s.siteDir, ...p), 'utf8')
const undrawn = (s) => s.blockers.filter((b) => b.startsWith(BLOCKER.undrawn))

// ── ① 순수 ───────────────────────────────────────────────────────────────
const BLOCKS = blockItems()
const SM_DASH = {
  archetype: 'dashboard',
  pages: [
    { id: 'operational', route: '/', sections: [{ kind: 'action-list', status: 'block' }, { kind: 'kpi-row', status: 'block' }] },
    { id: 'admin-list', route: '/admin', sections: [{ kind: 'search-filter-bar', status: 'block' }, { kind: 'data-table', status: 'block' }] },
    { id: 'privacy', route: '/privacy', legal: true, sections: [] },
    { id: 'terms', route: '/terms', legal: true, sections: [] },
  ],
  globals: [
    { kind: 'app-shell-sidebar', status: 'block', required: true },
    { kind: 'top-bar', status: 'block', required: true },
    { kind: 'state-screens', status: 'block', required: true },
  ],
}
const CHOSEN_DASH = { 'global/app-shell-sidebar': 'block-nav-app-sidebar', 'global/top-bar': 'block-nav-top-bar', 'global/state-screens': 'block-state-screen-loading' }
const plan = (sitemap, chosen, sections, content, locale = 'ko') => planAppShell({ sitemap, chosen: (k) => chosen[k], sections, content, locale, brandRef: { $ref: 'site.name' }, blocks: BLOCKS })
const DRAWN_ALL = { 'operational/action-list': { block: 'block-dashboard-panel-action-list' }, 'admin-list/search-filter-bar': { block: 'block-filter-bar-search-filter' } }

test('top-bar 검색: 검색을 받는 쪽(filter-bar/search-filter 가 그려진 쪽)이 있을 때만 그 쪽 주소로 — 없으면 검색 칸을 주지 않는다(음성 대조)', () => {
  const withSearch = plan(SM_DASH, CHOSEN_DASH, DRAWN_ALL, {})
  assert.deepEqual(withSearch.sections['global/top-bar'].props.copy.search, { label: APP_SHELL_UI.ko.search, placeholder: APP_SHELL_UI.ko.searchPlaceholder, action: '/admin' })
  // 같은 쪽이 사이트맵에 있어도 그 줄이 그려지지 않았으면(자료 연결 안 됨) 검색 칸이 없다
  const noFilter = plan(SM_DASH, CHOSEN_DASH, { 'operational/action-list': DRAWN_ALL['operational/action-list'] }, {})
  assert.equal('search' in noFilter.sections['global/top-bar'].props.copy, false)
  // 다른 블록(표 자체)만 그려졌다고 검색을 받는 것이 아니다
  const tableOnly = plan(SM_DASH, CHOSEN_DASH, { 'admin-list/data-table': { block: 'block-data-table-bulk-select' } }, {})
  assert.equal('search' in tableOnly.sections['global/top-bar'].props.copy, false)
})

test('top-bar 알림: 경고 목록(action-list)이 그려진 쪽이 있을 때만 그 쪽으로 — 개수는 콘텐츠의 경고 수가 있을 때만', () => {
  const none = plan(SM_DASH, CHOSEN_DASH, {}, {})
  assert.equal('notifications' in none.sections['global/top-bar'].props.copy, false)
  const noAlerts = plan(SM_DASH, CHOSEN_DASH, DRAWN_ALL, { alerts: [] })
  assert.deepEqual(noAlerts.sections['global/top-bar'].props.copy.notifications, { label: APP_SHELL_UI.ko.alerts, href: '/' })
  const alerts = plan(SM_DASH, CHOSEN_DASH, DRAWN_ALL, { alerts: [{ id: 'a' }, { id: 'b' }] })
  assert.deepEqual(alerts.sections['global/top-bar'].props.copy.notifications, { label: APP_SHELL_UI.ko.alerts, href: '/', count: { $ref: 'alerts.length' }, countLabel: APP_SHELL_UI.ko.alertsCount })
})

test('top-bar 계정 메뉴: 이 사이트의 법정 쪽 링크(·콘텐츠 도움말 주소가 쓸 수 있을 때)만 — 로그아웃은 없다', () => {
  const p = plan(SM_DASH, CHOSEN_DASH, {}, { helpUrl: 'https://help.dalbit-stock.kr' })
  const acct = p.sections['global/top-bar'].props.copy.account
  assert.deepEqual(acct.links.map((l) => l.href), ['/privacy', '/terms', { $ref: 'helpUrl' }])
  assert.equal('signOutLabel' in acct, false)
  const noHelp = plan(SM_DASH, CHOSEN_DASH, {}, { helpUrl: '확인 필요' })
  assert.deepEqual(noHelp.sections['global/top-bar'].props.copy.account.links.map((l) => l.href), ['/privacy', '/terms'], '자리 표시 주소는 링크가 아니다')
})

test('사이드바: 쪽 목록 = 사이트맵의 쪽(법정 쪽 제외) · 처음 쪽이 첫 항목 · 이름표는 생성기 표', () => {
  const p = plan(SM_DASH, CHOSEN_DASH, {}, {})
  const side = p.sections['global/app-shell-sidebar'].props.copy
  assert.deepEqual(side.groups[0].items.map((i) => i.href), ['/', '/admin'])
  assert.equal(side.navLabel, APP_SHELL_UI.ko.mainMenu)
  assert.deepEqual(side.brand, { name: { $ref: 'site.name' }, href: '/' })
  assert.equal(plan(SM_DASH, CHOSEN_DASH, {}, {}, 'en').sections['global/app-shell-sidebar'].props.copy.navLabel, 'Main menu')
})

test('상태 화면: loading·error·not-found 세 파일이 state-screen 블록을 끼운다 — 03 이 다른 변형(빈 안내)을 골랐으면 fallback 으로 남긴다', () => {
  const p = plan(SM_DASH, CHOSEN_DASH, {}, {})
  assert.deepEqual(Object.keys(p.appFiles).sort(), ['app/error.tsx', 'app/loading.tsx', 'app/not-found.tsx'])
  assert.match(p.appFiles['app/loading.tsx'], /StateScreenLoading/)
  assert.match(p.appFiles['app/error.tsx'], /^"use client"/)
  assert.match(p.appFiles['app/error.tsx'], /onRetry=\{reset\}/)
  assert.doesNotMatch(p.appFiles['app/error.tsx'], /content\/site\.json|@\/lib\/site/, '오류 경계는 클라이언트 번들에 site.json 을 끌어오지 않는다')
  assert.match(p.appFiles['app/not-found.tsx'], /StateScreenNotFound/)
  assert.deepEqual(p.fallbacks, [], '고른 변형이 셋 중 하나면 fallback 이 없다')
  const empty = plan(SM_DASH, { ...CHOSEN_DASH, 'global/state-screens': 'block-state-screen-empty-guide' }, {}, {})
  assert.equal(empty.fallbacks.length, 1)
  assert.equal(empty.fallbacks[0].from, 'block-state-screen-empty-guide')
})

test('03 이 이 파일이 모르는 변형을 고르면 그리지 않고 「자료 연결 안 됨」 까닭을 남긴다(다른 블록을 슬쩍 그리지 않는다)', () => {
  const p = plan(SM_DASH, { ...CHOSEN_DASH, 'global/top-bar': 'block-nav-inline-links' }, {}, {})
  assert.equal('global/top-bar' in p.sections, false)
  assert.equal(p.unbound.length, 1)
  assert.equal(p.unbound[0].key, 'global/top-bar')
  assert.match(p.unbound[0].why, /block-nav-top-bar/)
})

const SM_PWA = {
  archetype: 'pwa',
  pages: [{ id: 'home', route: '/', sections: [] }, { id: 'privacy', route: '/privacy', legal: true, sections: [] }],
  globals: [{ kind: 'connection-banner', status: 'block', required: true }, { kind: 'update-toast', status: 'block', required: true }],
}
const CHOSEN_PWA = { 'global/connection-banner': 'block-state-screen-offline-cached', 'global/update-toast': 'block-announcement-update-toast' }

test('pwa: 연결 띠·새 판 알림 문구는 콘텐츠 상태 문구($ref)에서만 — 없으면 그리지 않는다', () => {
  const ok = plan(SM_PWA, CHOSEN_PWA, {}, { strings: { offline: '인터넷 연결이 끊겼어요', updateAvailable: '새 버전이 있어요 — 새로고침' } })
  assert.deepEqual(ok.sections['global/connection-banner'].props.copy.offline, { $ref: 'strings.offline' })
  assert.deepEqual(ok.sections['global/connection-banner'].props.items, [], '저장해 둔 내용을 지어내지 않는다')
  assert.equal('lastSaved' in ok.sections['global/connection-banner'].props.copy, false, '마지막 저장 시각을 지어내지 않는다')
  assert.deepEqual(ok.sections['global/update-toast'].props.copy.title, { $ref: 'strings.updateAvailable' })
  assert.deepEqual(ok.leaves.map((l) => l.role), ['banner', 'toast'])
  const none = plan(SM_PWA, CHOSEN_PWA, {}, { strings: { offline: '확인 필요' } })
  assert.deepEqual(none.unbound.map((u) => u.key), ['global/connection-banner', 'global/update-toast'])
  assert.deepEqual(none.leaves, [])
})

test('다른 원형(전역 앱 셸 섹션이 없는 사이트맵)은 아무것도 만들지 않는다', () => {
  const p = plan({ archetype: 'local', pages: [{ id: 'home', route: '/', sections: [] }], globals: [{ kind: 'footer', status: 'block', required: true }] }, {}, {}, {})
  assert.deepEqual(p, { sections: {}, leaves: [], appFiles: {}, unbound: [], fallbacks: [], placement: { sidebar: null, topBar: null, banner: null, toast: null } })
})

// ── ② 통합(정적 06) ──────────────────────────────────────────────────────
test('dashboard: 「필수 섹션 그리지 않음」 0 · 사이드바·상단 줄 잎이 쪽마다 레이아웃에 든다 · h1 하나·첫 화면 구획 유지', async () => {
  const R = await dashboardRun(TMP)
  const s = await gen(R)
  assert.deepEqual(undrawn(s), [], s.blockers.join('\n'))
  for (const k of ['global/app-shell-sidebar', 'global/top-bar', 'global/state-screens', 'global/state-error', 'global/state-not-found']) assert.ok(s.sections.includes(k), k)
  for (const route of s.routes) {
    const f = route === '/' ? ['app', 'page.tsx'] : ['app', ...route.split('/').filter(Boolean), 'page.tsx']
    const src = read(s, ...f)
    assert.match(src, /<GlobalAppShellSidebar props=\{\{ \.\.\.\(sectionProps\("global\/app-shell-sidebar"\) as object\), currentHref: ROUTE \} as never\}/, route)
    assert.match(src, /<GlobalTopBar props=\{sectionProps\("global\/top-bar"\)\}/, route)
    assert.match(src, /<SiteShell\s+\{\.\.\.shell\}\s+nav=\{undefined\}\s+sticky=\{false\}\s+width="full"\s+pageTitle=/, `${route}: 셸 머리는 로고 띠(주 메뉴는 사이드바)`)
    assert.equal((src.match(/pageTitle=/g) ?? []).length, 1, `${route}: SiteShell pageTitle 하나`)
    assert.ok(src.indexOf('GlobalAppShellSidebar props') < src.indexOf('GlobalTopBar props'), route)
  }
  assert.deepEqual(h1Problems(s.siteDir, s.pageMeta), [], 'h1 은 쪽마다 하나(셸 pageTitle)')
  const home = read(s, 'app', 'page.tsx')
  assert.match(home, /data-wf-first="" className="contents">\s*<OperationalPageHeader /, '첫 화면 구획은 쪽 내용 첫 블록(앱 셸 잎은 구획 밖)')
  assert.doesNotMatch(home.slice(home.indexOf('data-wf-first'), home.indexOf('</div>', home.indexOf('data-wf-first'))), /GlobalAppShellSidebar|GlobalTopBar/)
  const side = read(s, 'components', 'site', 'global-app-shell-sidebar.tsx')
  assert.match(side, /from "@\/components\/blocks\/nav\/app-sidebar"/)
})

test('dashboard: 기본 콘텐츠(표 자료·경고 목록 없음)의 상단 줄은 검색·알림 칸이 없다 — 거짓 동작 없음, 계정 메뉴만', async () => {
  const R = await dashboardRun(TMP)
  const s = await gen(R)
  const bar = siteOf(s).sections['global/top-bar'].props.copy
  assert.equal('search' in bar, false)
  assert.equal('notifications' in bar, false)
  assert.deepEqual(bar.account.links.map((l) => l.href), ['/privacy', '/terms'])
  assert.equal(s.blockers.some((b) => b.includes('global/top-bar')), false)
})

const TABLE = { columns: [{ id: 'item', label: '품목' }, { id: 'status', label: '상태' }, { id: 'qty', label: '수량', numeric: true }], density: 40, rows: [{ item: '식빵', status: '출고 대기', qty: 12 }, { item: '소금빵', status: '입고 완료', qty: 30 }, { item: '바게트', status: '출고 대기', qty: 8 }, { item: '모닝빵', status: '입고 완료', qty: 21 }] }

test('dashboard: 표 자료가 있어 거르기 줄(search-filter)이 그려지면 상단 줄 검색이 그 쪽(?q=)으로 간다', async () => {
  const R = await dashboardRun(TMP, { extra: { table: TABLE } })
  const s = await gen(R)
  assert.ok(s.sections.includes('admin-list/search-filter-bar'), s.blockers.join('\n'))
  const bar = siteOf(s).sections['global/top-bar'].props.copy
  assert.equal(bar.search.action, '/admin')
  assert.deepEqual(undrawn(s), [])
})

test('dashboard: 앱 전체 상태 화면 파일 — loading 은 서버, error 는 클라이언트(site.json 없이 build.json), not-found 는 셸 안', async () => {
  const R = await dashboardRun(TMP)
  const s = await gen(R)
  const loading = read(s, 'app', 'loading.tsx')
  assert.match(loading, /from "@\/components\/blocks\/state-screen\/loading"/)
  assert.doesNotMatch(loading, /"use client"/)
  const err = read(s, 'app', 'error.tsx')
  assert.match(err, /from "@\/components\/blocks\/state-screen\/error-retry"/)
  assert.match(err, /requestId=\{error\.digest\}/)
  assert.match(err, /from "@\/lib\/build\.json"/)
  const nf = read(s, 'app', 'not-found.tsx')
  assert.match(nf, /from "@\/components\/blocks\/state-screen\/not-found"/)
  assert.match(nf, /<SiteShell \{\.\.\.shell\} pageTitle=\{false\}/, 'h1 은 블록의 제목(headingLevel 1) 하나')
  assert.match(nf, /headingLevel=\{1\}/)
  assert.match(nf, /"\/analytics"/, '이 사이트의 쪽으로 이어 준다')
  // 블록은 설치 목록에 든다(상태 화면 셋)
  const names = installNames({ archetype: 'dashboard', recipeId: s.recipeId, blocks: [...new Set(Object.values(siteOf(s).sections).map((x) => x.block))] })
  for (const b of Object.values(STATE_SCREEN_BLOCKS)) assert.ok(names.includes(b), b)
})

test('pwa: 「필수 섹션 그리지 않음」 0 · 연결 띠는 쪽 맨 위(첫 화면 구획 밖), 새 판 알림은 끝에 · h1 하나', async () => {
  const R = await pwaRun(TMP)
  const s = await gen(R)
  assert.deepEqual(undrawn(s), [], s.blockers.join('\n'))
  assert.ok(s.sections.includes('global/connection-banner') && s.sections.includes('global/update-toast'))
  for (const route of s.routes) {
    const f = route === '/' ? ['app', 'page.tsx'] : ['app', ...route.split('/').filter(Boolean), 'page.tsx']
    const src = read(s, ...f)
    assert.match(src, /<GlobalConnectionBanner props=\{sectionProps\("global\/connection-banner"\)\}/, route)
    assert.match(src, /<GlobalUpdateToast props=\{sectionProps\("global\/update-toast"\)\}/, route)
    assert.doesNotMatch(src, /nav=\{undefined\}|sticky=\{false\}/, `${route}: pwa 는 셸 머리를 바꾸지 않는다`)
    assert.ok(src.indexOf('GlobalConnectionBanner props') < src.indexOf('GlobalUpdateToast props'), route)
  }
  assert.deepEqual(h1Problems(s.siteDir, s.pageMeta), [])
  const home = read(s, 'app', 'page.tsx')
  assert.doesNotMatch(home.slice(home.indexOf('data-wf-first'), home.indexOf('</div>', home.indexOf('data-wf-first'))), /GlobalConnectionBanner|GlobalUpdateToast/, '띠·알림은 첫 화면 구획 밖')
})

test('pwa 연결 띠 잎: offline·online 이벤트로만 — 서버 렌더·온라인이면 null, 끊긴 동안만 그린다(쪽을 다시 읽지 않는다)', async () => {
  const R = await pwaRun(TMP)
  const s = await gen(R)
  const src = read(s, 'components', 'site', 'global-connection-banner.tsx')
  assert.match(src, /addEventListener\("offline", on\)/)
  assert.match(src, /addEventListener\("online", on\)/)
  assert.match(src, /useSyncExternalStore\(subscribe, isOnline, serverOnline\)/)
  assert.match(src, /const serverOnline = \(\) => true/, '서버 HTML 에는 거짓 「오프라인」 띠가 없다')
  assert.match(src, /if \(online\) return null/)
  assert.match(src, /online=\{false\}/)
  assert.doesNotMatch(src, /location\.reload|router\.refresh/, '입력은 그대로 — 쪽을 다시 읽지 않는다')
  const p = siteOf(s).sections['global/connection-banner'].props
  assert.deepEqual(p.copy.offline, { $ref: 'strings.offline' })
  assert.deepEqual(p.items, [])
  assert.equal('onRecheck' in p, false)
})

test('pwa 새 판 알림 잎: 서비스 워커 신호가 있을 때만 — 등록된 워커의 waiting·updatefound 외에는 보이지 않고, 이 사이트는 서비스 워커를 등록하지 않는다', async () => {
  const R = await pwaRun(TMP)
  const s = await gen(R)
  const src = read(s, 'components', 'site', 'global-update-toast.tsx')
  assert.match(src, /"serviceWorker" in navigator/)
  assert.match(src, /navigator\.serviceWorker\.ready/, '등록된 워커가 없으면 끝내 풀리지 않는다')
  assert.match(src, /addEventListener\("updatefound"/)
  assert.match(src, /reg\.waiting && navigator\.serviceWorker\.controller/, '첫 설치(controller 없음)는 새 판이 아니다')
  assert.match(src, /available=\{registration !== null\}/, '신호가 오기 전에는 available 이 거짓')
  assert.match(src, /postMessage\(\{ type: "SKIP_WAITING" \}\)/)
  assert.match(src, /withAttribution\(analytics, \{ blockId: "announcement-update-toast"/)
  // 서비스 워커를 등록하는 코드는 생성 사이트 어디에도, 템플릿에도 없다
  const all = []
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p) } else if (/\.(?:tsx?|mjs|js)$/.test(e.name)) all.push(p) } }
  walk(s.siteDir)
  walk(join(root, 'factory', 'stamp', 'site-template'))
  for (const f of all) assert.doesNotMatch(readFileSync(f, 'utf8'), /serviceWorker\s*\.\s*register\s*\(/, relative(root, f))
  assert.equal(all.some((f) => /(?:^|[\\/])sw\.(?:js|ts)$/.test(f)), false, '서비스 워커 파일이 없다')
})

test('음성 대조: 앱 셸 섹션이 있는 사이트맵도 그린 게 없으면 예전처럼 「필수 섹션 그리지 않음」으로 센다', () => {
  const sm = { pages: [], globals: [{ kind: 'app-shell-sidebar', required: true, status: 'block' }, { kind: 'connection-banner', required: true, status: 'block' }] }
  assert.deepEqual(undrawnRequiredBlockers(sm, {}, []), [`${BLOCKER.undrawn}global/app-shell-sidebar`, `${BLOCKER.undrawn}global/connection-banner`])
  assert.deepEqual(undrawnRequiredBlockers(sm, { 'global/app-shell-sidebar': {}, 'global/connection-banner': {} }, []), [])
})

// ── ③ 회귀: 다른 원형의 06 출력은 기준 커밋과 같다 ─────────────────────────────
test('dashboard·pwa 가 아닌 원형 9개의 06 출력(글자 파일 전부)은 기준 커밋과 sha256 이 같다 — 파일이 늘거나 줄지도 않는다', async () => {
  const write = process.env.WF_WRITE_APP_SHELL_BASELINE === '1'
  const out = { baseCommit: 'c277c5b1', note: 'dashboard·pwa 가 아닌 원형 후보의 06 출력(install: false) 글자 파일 sha256 앞 16자 — 앱 셸(FV1 Task 5.18)이 없는 BIND2 끝 커밋에서 떴고, FV1 Task 5.17 BOLD 가 새 히어로 6종을 원형 허용 목록에 이은 뒤 다시 떴다(바뀐 곳은 local 홈 히어로 → map-first · saas 캠페인 히어로 → screenshot-window 둘뿐, 나머지 7개 원형 불변 — 원형 JSON 을 되돌리면 옛 기준과 같다). FV1 Task 6.2 가 골든 브리프의 빈 사실을 채운 뒤 content/site.json 의 값만 다시 떴다(원형 셋 — 쪽·잎·앱 파일은 불변, 골든 사실로 쓴 시험 콘텐츠가 달라진 것). FV1 Task 6.3 QFIX 가 다시 떴다: detail 스키마의 선택 칸(faq·compare) 기본값으로 detail 둘의 content/site.json 이 바뀌었고, 골든 사실로 쓰는 brand-1(수상 로고 줄)·public-1(기관 안내·하위 쪽 본문)·portfolio-1(고객·수상 로고 줄)은 이제 그릴 수 있는 섹션이 늘어 쪽·잎 파일이 늘었다(나머지 원형은 불변). FINAL-WF 가 다시 떴다: 모든 원형의 사이트 템플릿 파일 셋만 바뀌었다 — lib/site.tsx(mailto $ref 검사, E3)·package.json(shadcn 4.21.0 고정, P5)·security-headers.mjs(form-action, E4), 쪽·잎 파일은 불변 (의존성 잠금 package-lock.json 은 06 출력이 아니라 기준에서 뺀다). FINAL-WF5 가 다시 떴다: 같은 사실(영업시간·주소·전화)을 이미 다른 블록·푸터·하단 바가 그리는 선택 섹션을 건너뛰어(redundantFactKeys) local 의 홈 hours-table 섹션이 빠졌고(site.json·홈 page.tsx 바뀜, home-hours-table.tsx 사라짐), 같은 블록이 한 쪽에 둘이면 뒤 것에 props.id 가 생겨 portfolio-1·saas·detail 의 site.json 이 바뀌었다(uniqueSectionIds). deliver 분기(sitebrew v0.2.0 계획 3 Task 9)가 다시 떴다: 모든 원형의 사이트 템플릿 next.config.ts 한 파일만 바뀌었다 — 정적 내보내기 빌드 동안 소개형 전달물의 app/api/inquiry 를 옆 폴더로 치웠다 끝날 때 되돌리고 NEXT_PUBLIC_WF_STATIC 을 켠다(쪽·잎·site.json 불변). deliver Task 9 수정 3회차: 모든 원형의 app/manifest.ts 한 파일에 export const dynamic = force-static 한 줄이 더해졌다(정적 내보내기가 manifest.webmanifest 에서 멈췄다 — 평소 빌드 출력은 같다). 계획 3a(판매·결제) Task A3 가 다시 떴다: 모든 원형의 lib/ports.ts 한 파일만 바뀌었다 — 판매 목 mockCommerce(adapter-mock-commerce)를 makePorts() 에 끼웠다(쪽·잎·site.json 불변, 화면 출력 불변)', archetypes: {} }
  const want = write ? null : JSON.parse(readFileSync(BASELINE, 'utf8'))
  if (want) assert.deepEqual(Object.keys(want.archetypes).sort(), OTHER_RUNS.map((r) => r.id).sort(), '기준에 든 원형 = 시험하는 원형')
  for (const r of OTHER_RUNS) {
    const s = await gen(await r.make(TMP))
    const got = hashSite(s.siteDir)
    out.archetypes[r.id] = { files: got }
    if (!want) continue
    const base = want.archetypes[r.id].files
    assert.deepEqual(Object.keys(got), Object.keys(base), `${r.id}: 파일 목록이 기준과 다르다`)
    const changed = Object.keys(base).filter((f) => base[f] !== got[f])
    assert.deepEqual(changed, [], `${r.id}: 06 출력이 기준 커밋과 달라진 파일`)
  }
  if (write) { mkdirSync(dirname(BASELINE), { recursive: true }); writeFileSync(BASELINE, `${JSON.stringify(out, null, 1)}\n`) }
})

// ── ④ 블록 선택 칸 ───────────────────────────────────────────────────────
const OUT = join(root, '.tmp', 'stamp-app-shell-test', 'render')
const loaded = new Map()
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let outputText
  if (STUBS[abs]) outputText = STUBS[abs]
  else ({ outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }))
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (rel) => import(pathToFileURL(transpile(join(root, rel))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')

test('nav/top-bar: 검색·알림을 안 주면 그 자리만 빠지고 계정 메뉴는 남는다 — 예시(검색·알림 있음)는 예전 그대로', async () => {
  const mod = await load('registry/factory/blocks/nav/top-bar.tsx')
  const fx = await load('registry/factory/blocks/nav/top-bar.fixture.ts')
  const full = renderToStaticMarkup(React.createElement(mod.NavTopBar, fx.fixture))
  assert.match(full, /role="search"/)
  assert.match(full, /href="#alerts"/)
  const bare = renderToStaticMarkup(React.createElement(mod.NavTopBar, { copy: { account: { menuLabel: '계정', links: [{ label: '이용약관', href: '/terms' }] } } }))
  assert.doesNotMatch(bare, /role="search"|type="search"/)
  assert.doesNotMatch(bare, /cn-block-nav-top-bell/)
  assert.match(bare, /<details/)
  assert.match(bare, /href="\/terms"/)
  assert.doesNotMatch(bare, /data-sticky-nav/) // GATES2: 붙지 않는 줄 — 표지를 달면 관문이 검수대 띠로 읽어 안쪽을 재지 않는다
})

test('state-screen/offline-cached: 저장해 둔 것이 없으면 위 띠만 — 마지막 저장·저장된 내용 구획이 없다 · 예시는 예전 그대로', async () => {
  const mod = await load('registry/factory/blocks/state-screen/offline-cached.tsx')
  const fx = await load('registry/factory/blocks/state-screen/offline-cached.fixture.ts')
  const full = renderToStaticMarkup(React.createElement(mod.StateScreenOfflineCached, fx.fixture))
  assert.match(full, /cn-block-soff-cached/)
  assert.match(full, /마지막 저장/)
  assert.match(full, /aria-labelledby="offline-title"/)
  const bar = renderToStaticMarkup(React.createElement(mod.StateScreenOfflineCached, { copy: { offline: '인터넷 연결이 끊겼어요', online: '다시 연결됐어요', recheckLabel: '확인', reloadLabel: '새로 고침', cachedBadge: '저장된 내용' }, items: [], online: false }))
  assert.match(bar, /role="status"/)
  assert.match(bar, /인터넷 연결이 끊겼어요/)
  assert.doesNotMatch(bar, /cn-block-soff-cached|cn-block-soff-saved|<h2/)
  assert.match(bar, /aria-label="인터넷 연결이 끊겼어요"/, '구획 이름은 띠 문구')
  assert.doesNotMatch(bar, /aria-labelledby/)
})
