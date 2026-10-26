// 앱 셸(FV1 Task 5.18) — 06 이 03 이 고른 전역 섹션 중 푸터·하단 고정 줄 밖의 것을 그린다.
//   dashboard: global/app-shell-sidebar · global/top-bar · global/state-screens
//     · 사이드바(nav/app-sidebar)는 쪽 안 왼쪽에 앉고 쪽 목록 = 사이트맵의 쪽이다. 상단 줄(nav/top-bar)은 사이드바 오른쪽 위에 앉는다.
//     · 상단 줄의 칸은 갈 곳이 있을 때만 준다(거짓 동작을 만들지 않는다): 검색은 「검색을 받는 쪽」(?q= 를 읽는 거르기 줄 filter-bar/search-filter 가 실제로 그려진 쪽)이 있을 때만,
//       알림은 「조치가 필요한 경고」를 그린 쪽(action-list 가 실제로 그려진 쪽)이 있을 때만이다. 계정 메뉴는 이 사이트의 법정 쪽(·콘텐츠 도움말 주소)으로 가는 링크다.
//     · 상태 화면은 앱 전체 app/loading.tsx · error.tsx · not-found.tsx 에 state-screen 블록을 그대로 끼운다(글은 템플릿 lib/system-copy 와 이 파일의 이름표 표).
//   pwa: global/connection-banner · global/update-toast
//     · 연결 띠(state-screen/offline-cached)는 브라우저 offline·online 이벤트로만 보인다: 온라인이면 아무것도 그리지 않고 끊긴 동안만 위에 얹는다(입력은 그대로 — 쪽을 다시 읽지 않는다).
//       저장해 둔 것이 없으므로(템플릿은 서비스 워커·저장소를 쓰지 않는다) 「마지막 저장」·「저장된 내용」은 그리지 않는다.
//     · 새 판 알림(announcement/update-toast)은 서비스 워커가 있고 새 판이 기다릴 때(updatefound → installed, 또는 waiting)만 보인다. 템플릿이 서비스 워커를 등록하지 않으면 신호가 오지 않아 결코 뜨지 않는다.
// 이 파일은 순수 계획만 만든다(파일을 쓰지 않는다): gen-pages 가 sections·잎·앱 파일을 받아 쓴다. gen-pages 와 순환하지 않게 블록 정보는 인자(blocks)로 받는다.
import { at, pageLabel, ref } from './site-bind.mjs'
import { isNeedsCheck } from './needs-check.mjs'

/** 이 파일이 다루는 전역 섹션 종류 — 이 밖의 전역 섹션(푸터·하단 줄)은 gen-pages 가 예전 길로 그린다. */
export const SHELL_GLOBALS = ['app-shell-sidebar', 'top-bar', 'state-screens', 'connection-banner', 'update-toast']

/** 앱 셸이 그릴 줄 아는 블록(전역 섹션 종류 → 블록). 03 이 다른 변형을 고르면 그리지 않고 까닭을 남긴다. */
export const SHELL_BLOCKS = {
  'app-shell-sidebar': 'block-nav-app-sidebar',
  'top-bar': 'block-nav-top-bar',
  'connection-banner': 'block-state-screen-offline-cached',
  'update-toast': 'block-announcement-update-toast',
}
/** 앱 전체 상태 화면 셋 — Next 의 loading.tsx · error.tsx · not-found.tsx 에 끼우는 state-screen 블록. */
export const STATE_SCREEN_BLOCKS = { loading: 'block-state-screen-loading', error: 'block-state-screen-error-retry', notFound: 'block-state-screen-not-found' }
const STATE_KEYS = { loading: 'global/state-screens', error: 'global/state-error', notFound: 'global/state-not-found' }

/** 생성기가 갖는 UI 이름표(콘텐츠 사실이 아니다 — FILTER_UI·PAGE_LABELS 와 같은 자리). */
export const APP_SHELL_UI = {
  ko: {
    mainMenu: '주 메뉴', collapse: '사이드바 접기', expand: '사이드바 펴기',
    search: '목록 검색', searchPlaceholder: '목록에서 찾기',
    alerts: '조치가 필요한 항목', alertsCount: '조치가 필요한 항목 {count}건',
    account: '계정', help: '도움말',
    loading: '화면을 불러오는 중이에요', retrying: '다시 불러오는 중이에요', pagesTitle: '이동할 수 있는 쪽',
    online: '다시 연결됐어요', recheck: '연결 다시 확인', reload: '새로 고침', cachedBadge: '저장된 내용',
    updateNow: '지금 새로 고침', later: '나중에',
  },
  en: {
    mainMenu: 'Main menu', collapse: 'Collapse the sidebar', expand: 'Expand the sidebar',
    search: 'Search the list', searchPlaceholder: 'Search the list',
    alerts: 'Items needing action', alertsCount: 'Items needing action: {count}',
    account: 'Account', help: 'Help',
    loading: 'Loading the page', retrying: 'Trying again', pagesTitle: 'Pages you can open',
    online: 'Back online', recheck: 'Check the connection again', reload: 'Refresh', cachedBadge: 'Saved',
    updateNow: 'Refresh now', later: 'Later',
  },
}

const ICONS = { operational: 'home', analytics: 'analytics', 'admin-list': 'file' }
const usable = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v)

/**
 * @param {object} a
 * @param {{ pages: object[], globals?: object[] }} a.sitemap
 * @param {(key: string) => string|undefined} a.chosen  03 이 고른 블록 이름
 * @param {Record<string, {block: string, props: any}>} a.sections  지금까지 그려진 섹션(쪽 섹션이 먼저 끝나 있어야 한다)
 * @param {object} a.content  검사를 통과한 콘텐츠
 * @param {'ko'|'en'} a.locale
 * @param {unknown} a.brandRef  제품 이름($ref 또는 글자)
 * @returns {{ sections: Record<string, object>, leaves: object[], appFiles: Record<string, string>, unbound: {key:string, block:string, why:string}[], fallbacks: object[], placement: Record<string, string|null> }}
 */
export function planAppShell({ sitemap, chosen, sections, content, locale, brandRef, blocks }) {
  const L = APP_SHELL_UI[locale === 'en' ? 'en' : 'ko']
  const out = { sections: {}, leaves: [], appFiles: {}, unbound: [], fallbacks: [], placement: { sidebar: null, topBar: null, banner: null, toast: null } }
  const globals = new Map((sitemap.globals ?? []).filter((g) => g.status === 'block' && SHELL_GLOBALS.includes(g.kind)).map((g) => [g.kind, g]))
  if (!globals.size) return out
  const pages = sitemap.pages.filter((p) => !p.legal && p.kind !== 'app') // 로그인한 사람용 화면(kind app)은 사이드바 쪽 목록에 넣지 않는다
  const legalPages = sitemap.pages.filter((p) => p.legal)
  const drawnBlock = (page, kind) => sections[`${page.id}/${kind}`]?.block
  const unbound = (kind, block, why) => out.unbound.push({ key: `global/${kind}`, block: block ?? SHELL_BLOCKS[kind] ?? kind, why })
  // 03 이 고른 변형이 이 파일이 아는 블록이 아니면 그리지 않는다(알려 주지 않고 다른 블록을 그리지 않는다).
  const known = (kind) => {
    const want = SHELL_BLOCKS[kind]
    const got = chosen(`global/${kind}`)
    if (got === want) return true
    unbound(kind, got, `03 이 고른 블록(${got ?? '없음'})을 앱 셸이 그리지 못한다 — 그릴 수 있는 블록은 ${want}`)
    return false
  }

  // ── dashboard: 사이드바 ──
  if (globals.has('app-shell-sidebar') && known('app-shell-sidebar')) {
    const items = pages.map((p) => ({ label: pageLabel(p.id, locale), href: p.route, icon: ICONS[p.id] ?? 'file' }))
    if (!items.length) unbound('app-shell-sidebar', SHELL_BLOCKS['app-shell-sidebar'], '사이드바에 둘 쪽이 사이트맵에 없다')
    else {
      out.sections['global/app-shell-sidebar'] = { block: SHELL_BLOCKS['app-shell-sidebar'], props: { copy: { brand: { name: brandRef, href: '/' }, navLabel: L.mainMenu, groups: [{ items }], collapse: L.collapse, expand: L.expand } } }
      out.leaves.push({ role: 'sidebar', key: 'global/app-shell-sidebar', block: SHELL_BLOCKS['app-shell-sidebar'] })
    }
  }

  // ── dashboard: 상단 줄 ──
  if (globals.has('top-bar') && known('top-bar')) {
    const copy = {}
    // 검색: ?q= 를 읽어 거르는 줄(filter-bar/search-filter)이 실제로 그려진 쪽이 있을 때만 — 없으면 검색 칸을 그리지 않는다(눌러도 거를 것이 없는 칸은 거짓이다)
    const searchPage = pages.find((p) => p.sections.some((s) => drawnBlock(p, s.kind) === 'block-filter-bar-search-filter'))
    if (searchPage) copy.search = { label: L.search, placeholder: L.searchPlaceholder, action: searchPage.route }
    // 알림: 조치가 필요한 경고(action-list)가 실제로 그려진 쪽이 있을 때만 — 그 쪽으로 간다. 개수는 콘텐츠의 경고 수(있을 때만)
    // 경고 자료가 없어 빈 상태(state.status = empty)로 그린 목록은 알림이 모일 곳이 아니다 — 빈 목록으로 가는 종을 그리지 않는다
    const alertPage = pages.find((p) => p.sections.some((s) => {
      const sec = s.kind === 'action-list' && sections[`${p.id}/${s.kind}`]
      return sec && sec.props?.state?.status !== 'empty'
    }))
    if (alertPage) {
      const n = Array.isArray(content.alerts) ? content.alerts.length : 0
      copy.notifications = { label: L.alerts, href: alertPage.route, ...(n > 0 ? { count: ref('alerts.length'), countLabel: L.alertsCount } : {}) }
    }
    const links = legalPages.map((p) => ({ label: pageLabel(p.id, locale), href: p.route }))
    if (usable(at(content, 'helpUrl'))) links.push({ label: L.help, href: ref('helpUrl') })
    if (!links.length && !copy.search && !copy.notifications) unbound('top-bar', SHELL_BLOCKS['top-bar'], '상단 줄에 둘 칸(검색 받는 쪽·알림이 모이는 쪽·약관 쪽·도움말)이 하나도 없다')
    else {
      copy.account = { menuLabel: L.account, links }
      out.sections['global/top-bar'] = { block: SHELL_BLOCKS['top-bar'], props: { copy } }
      out.leaves.push({ role: 'topBar', key: 'global/top-bar', block: SHELL_BLOCKS['top-bar'] })
    }
  }

  // ── dashboard: 상태 화면 → 앱 전체 loading·error·not-found ──
  if (globals.has('state-screens')) {
    const got = chosen('global/state-screens')
    if (!Object.values(STATE_SCREEN_BLOCKS).includes(got)) out.fallbacks.push({ key: 'global/state-screens', from: got, to: STATE_SCREEN_BLOCKS.loading, why: '앱 전체 상태 화면은 읽는 중·오류·없는 주소 셋으로 그린다(고른 변형은 쪽 안에서 쓴다)' })
    for (const [role, key] of Object.entries(STATE_KEYS)) {
      const appFile = { loading: 'app/loading.tsx', error: 'app/error.tsx', notFound: 'app/not-found.tsx' }[role]
      out.sections[key] = { block: STATE_SCREEN_BLOCKS[role], props: {}, appFile }
    }
    const b = (role) => blocks.get(STATE_SCREEN_BLOCKS[role])
    const pageLinks = pages.slice(0, 5).map((p) => ({ label: pageLabel(p.id, locale), href: p.route }))
    out.appFiles['app/loading.tsx'] = loadingSource(b('loading'), L)
    out.appFiles['app/error.tsx'] = errorSource(b('error'), L)
    out.appFiles['app/not-found.tsx'] = notFoundSource(b('notFound'), L, pageLinks)
  }

  // ── pwa: 연결 띠 ──
  if (globals.has('connection-banner') && known('connection-banner')) {
    const offline = at(content, 'strings.offline')
    if (!usable(offline)) unbound('connection-banner', SHELL_BLOCKS['connection-banner'], '콘텐츠에 연결 끊김 상태 문구(strings.offline)가 없다')
    else {
      out.sections['global/connection-banner'] = {
        block: SHELL_BLOCKS['connection-banner'],
        props: { copy: { offline: ref('strings.offline'), online: L.online, recheckLabel: L.recheck, reloadLabel: L.reload, cachedBadge: L.cachedBadge }, items: [] },
      }
      out.leaves.push({ role: 'banner', key: 'global/connection-banner', block: SHELL_BLOCKS['connection-banner'], render: connectionBannerSource })
    }
  }

  // ── pwa: 새 판 알림 ──
  if (globals.has('update-toast') && known('update-toast')) {
    const title = at(content, 'strings.updateAvailable')
    if (!usable(title)) unbound('update-toast', SHELL_BLOCKS['update-toast'], '콘텐츠에 새 판 안내 문구(strings.updateAvailable)가 없다')
    else {
      out.sections['global/update-toast'] = { block: SHELL_BLOCKS['update-toast'], props: { copy: { title: ref('strings.updateAvailable'), update: L.updateNow, later: L.later } } }
      out.leaves.push({ role: 'toast', key: 'global/update-toast', block: SHELL_BLOCKS['update-toast'], render: updateToastSource })
    }
  }

  for (const l of out.leaves) out.placement[l.role] = l.key
  return out
}

// ── 앱 전체 상태 화면 파일 ───────────────────────────────────────────────
const head = (what) => `// 생성 파일(gen-pages.mjs · app-shell.mjs, FV1 Task 5.18) — ${what}\n`

function loadingSource(b, L) {
  return `${head('앱 전체 읽는 중 화면. state-screen/loading 블록을 Next 의 loading.tsx 에 그대로 끼운다.')}import { ${b.component} } from "${b.importPath}"

export default function Loading() {
  return (
    <main id="main" tabIndex={-1} className="bg-background text-foreground mx-auto min-h-dvh w-full max-w-5xl outline-none">
      <${b.component} copy={{ label: ${JSON.stringify(L.loading)} }} />
    </main>
  )
}
`
}

function errorSource(b, L) {
  return `"use client"

${head('앱 전체 오류 화면. state-screen/error-retry 블록을 Next 의 error.tsx 에 그대로 끼운다(다시 시도 = reset, 요청 번호 = error.digest).')}import * as React from "react"

import { ${b.component} } from "${b.importPath}"
import build from "@/lib/build.json"
import { ERROR_COPY, type SystemLocale } from "@/lib/system-copy"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])
  const t = ERROR_COPY[(build as { locale?: SystemLocale }).locale === "en" ? "en" : "ko"]
  return (
    <main id="main" tabIndex={-1} className="bg-background text-foreground mx-auto min-h-dvh w-full max-w-5xl outline-none">
      <${b.component}
        headingLevel={1}
        requestId={error.digest}
        onRetry={reset}
        copy={{ title: t.title, body: t.body, retryLabel: t.retry, retryingLabel: ${JSON.stringify(L.retrying)}, home: { label: t.home, href: "/" }, requestIdLabel: t.code }}
      />
    </main>
  )
}
`
}

function notFoundSource(b, L, links) {
  return `${head('앱 전체 없는 주소(404) 화면. state-screen/not-found 블록을 Next 의 not-found.tsx 에 끼운다 — 사이트 셸(머리) 안에서 안내하고 이 사이트의 쪽으로 이어 준다.')}import type { Metadata } from "next"

import { ${b.component} } from "${b.importPath}"
import { SiteShell } from "@/components/ui/site-shell"
import { locale, shellProps } from "@/lib/site"
import { NOT_FOUND_COPY } from "@/lib/system-copy"

const t = NOT_FOUND_COPY[locale === "en" ? "en" : "ko"]
const LINKS = ${JSON.stringify(links)}

export const metadata: Metadata = { title: t.title }

export default function NotFound() {
  const { action, ...shell } = shellProps("/404")
  return (
    <SiteShell {...shell} pageTitle={false} actions={action ? <a href={action.href}>{action.label}</a> : undefined}>
      <${b.component} headingLevel={1} copy={{ title: t.title, body: t.body, home: { label: t.home, href: "/" }, linksTitle: ${JSON.stringify(L.pagesTitle)}, links: LINKS }} />
    </SiteShell>
  )
}
`
}

// ── pwa 잎 ───────────────────────────────────────────────────────────────
/** 연결 띠 잎: 브라우저 online·offline 이벤트로만 보인다(서버 렌더·온라인이면 null). 다시 읽지 않는다 — 쪽의 입력은 그대로다. */
export function connectionBannerSource({ name, block: b }) {
  return `"use client"

${head(`${b.kind}-${b.variant} 블록 하나를 조립한다. 브라우저 offline·online 이벤트로만 보인다: 온라인이면 아무것도 그리지 않고, 연결이 끊긴 동안만 띠를 얹는다(쪽을 다시 읽지 않으므로 입력은 그대로다).`)}import * as React from "react"

import { ${b.component} } from "${b.importPath}"

const subscribe = (on: () => void) => {
  window.addEventListener("online", on)
  window.addEventListener("offline", on)
  return () => {
    window.removeEventListener("online", on)
    window.removeEventListener("offline", on)
  }
}
const isOnline = () => navigator.onLine
// 서버 렌더에서는 온라인으로 본다 — 끊긴 연결은 브라우저만 안다(거짓 「오프라인」 띠가 서버 HTML 에 없다)
const serverOnline = () => true

export function ${name}({ props }: { props: React.ComponentProps<typeof ${b.component}>; copyVariant?: string }) {
  const online = React.useSyncExternalStore(subscribe, isOnline, serverOnline)
  if (online) return null
  return <${b.component} {...props} online={false} />
}
`
}

/** 새 판 알림 잎: 서비스 워커가 있고 새 판이 기다릴 때만 보인다. 서비스 워커가 없으면 신호가 오지 않아 결코 뜨지 않는다(이 템플릿은 서비스 워커를 등록하지 않는다). */
export function updateToastSource({ name, block: b, recipeId }) {
  const blockId = `${b.kind}-${b.variant}`
  return `"use client"

${head(`${blockId} 블록 하나를 조립한다. 서비스 워커가 있고 새 판이 기다릴 때(waiting · updatefound → installed)만 보인다. 서비스 워커가 없으면 신호가 오지 않아 알림은 결코 뜨지 않는다.`)}import * as React from "react"

import { ${b.component} } from "${b.importPath}"
import { withAttribution } from "@/components/contract/attribution"
import { analytics } from "@/lib/analytics"

const RECIPE = ${JSON.stringify(recipeId)}

// 등록된 서비스 워커(navigator.serviceWorker.ready — 없으면 끝내 풀리지 않는다)의 새 판을 지켜본다. 이미 기다리는 판(waiting)이 있거나 새 판이 설치를 마치면(installed) 등록을 돌려준다.
function useWaitingWorker() {
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null)
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let alive = true
    const undo: (() => void)[] = []
    void navigator.serviceWorker.ready.then((reg) => {
      if (!alive) return
      const waiting = () => {
        if (alive && reg.waiting && navigator.serviceWorker.controller) setRegistration(reg)
      }
      const onFound = () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener("statechange", waiting)
        undo.push(() => next.removeEventListener("statechange", waiting))
      }
      waiting()
      reg.addEventListener("updatefound", onFound)
      undo.push(() => reg.removeEventListener("updatefound", onFound))
    })
    return () => {
      alive = false
      undo.forEach((fn) => fn())
    }
  }, [])
  return registration
}

export function ${name}({ props, copyVariant }: { props: React.ComponentProps<typeof ${b.component}>; copyVariant?: string }) {
  const track = React.useMemo(() => withAttribution(analytics, { blockId: ${JSON.stringify(blockId)}, recipeId: RECIPE, copyVariant }).track, [copyVariant])
  const registration = useWaitingWorker()
  // 새로 고침: 기다리는 판에 건너뛰기 신호를 보내고, 새 판이 쪽을 맡으면(controllerchange) 다시 읽는다
  const onUpdate = React.useCallback(() => {
    const waiting = registration?.waiting
    if (!waiting) {
      window.location.reload()
      return
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true })
    waiting.postMessage({ type: "SKIP_WAITING" })
  }, [registration])
  return <${b.component} {...props} available={registration !== null} onUpdate={onUpdate} track={track} />
}
`
}
