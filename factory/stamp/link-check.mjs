// 생성 사이트 내부 링크 검사(FINAL-WF2 AB1·AB3·AB15) — 순수 모듈(파일 읽기만, Next·Chrome 을 끌어오지 않는다).
//   `<a href>` 가 사이트의 실제 경로·같은 쪽(또는 대상 쪽) id 에 닿는지 본다: ① `/…` 는 사이트맵 경로여야 한다 ② `#id`·`/쪽#id` 의 id 는 그 쪽 HTML 에 있어야 한다
//   ③ 빈 앵커(`#`)는 어디로도 가지 않는다. 바깥 주소(http·mailto·tel)와 확장자가 있는 파일 경로(/sitemap.xml·/llms.txt)는 보지 않는다.
//   06 이 next build 뒤에 .next/server/app 의 HTML 로 돌린다 — 소스가 아니라 렌더 결과를 본다(블록 id 기본값·$ref 가 풀린 뒤의 값).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leaves } from './site-bind.mjs'

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
const normRoute = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p)
const FILE_PATH = /\.[a-z0-9]{2,5}$/i

/** HTML 의 id 집합(요소 id 와 `<a name>`). */
export function idsOf(html) {
  const ids = new Set()
  for (const m of html.matchAll(/\s(?:id|name)="([^"]*)"/g)) ids.add(decode(m[1]))
  return ids
}

/** HTML 의 `<a … href="…">` 목록(속성 순서 무관, 따옴표 두 가지). */
export function anchorHrefs(html) {
  const out = []
  for (const m of html.matchAll(/<a\s[^>]*?\bhref=(?:"([^"]*)"|'([^']*)')/gi)) out.push(decode(m[1] ?? m[2] ?? ''))
  return out
}

/**
 * @param {{ routes: Iterable<string>, pages: Record<string, string> }} input  routes = 사이트의 경로 목록, pages = { <경로>: <렌더된 HTML> }
 * @returns {{ route: string, href: string, why: 'empty'|'route'|'anchor' }[]}  쪽마다 같은 링크는 한 번만
 */
export function deadLinks({ routes, pages }) {
  const known = new Set([...routes].map(normRoute))
  const idsByRoute = new Map(Object.entries(pages).map(([r, html]) => [normRoute(r), idsOf(html)]))
  const out = []
  for (const [route, html] of Object.entries(pages)) {
    const seen = new Set()
    for (const href of anchorHrefs(html)) {
      if (seen.has(href)) continue
      seen.add(href)
      const t = href.trim()
      if (t === '' || t === '#') { out.push({ route, href, why: 'empty' }); continue }
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t)) continue // http·mailto·tel·javascript·프로토콜 상대
      const hashAt = t.indexOf('#')
      const beforeHash = hashAt < 0 ? t : t.slice(0, hashAt)
      const frag = hashAt < 0 ? '' : decodeURIComponent(t.slice(hashAt + 1))
      const path = beforeHash.split('?')[0]
      let target
      if (path === '' ) target = normRoute(route) // `#id`·`?q#id` — 같은 쪽
      else if (path.startsWith('/')) {
        if (FILE_PATH.test(path)) continue
        target = normRoute(path)
        if (!known.has(target)) { out.push({ route, href, why: 'route' }); continue }
      } else continue // 상대 경로(`x/y`)는 만들지 않는다
      if (frag === '' || frag === 'top') continue
      const ids = idsByRoute.get(target)
      if (ids && !ids.has(frag)) out.push({ route, href, why: 'anchor' })
    }
  }
  return out
}

/** next build 결과(.next/server/app)에서 경로마다 HTML 을 읽는다 — 파일이 없는 경로는 건너뛴다(동적 경로). */
export function readBuiltPages(siteDir, routes) {
  const base = join(siteDir, '.next', 'server', 'app')
  const pages = {}
  for (const route of routes) {
    const file = route === '/' ? join(base, 'index.html') : join(base, ...route.split('/').filter(Boolean)) + '.html'
    if (existsSync(file)) pages[route] = readFileSync(file, 'utf8')
  }
  return pages
}

/**
 * 소스 단계 링크 검사(FINAL-WF6) — 빌드 없이 06 출력(site.json 의 섹션 props)만 본다. 섹션 props 의 `…href` 잎이 사이트의 실제 경로·「그 쪽에 그려지는 섹션 id」에 닿는지 센다.
 * 쪽이 그리는 id = 그 쪽 파일이 부르는 섹션(전역 푸터·바 포함)의 id. 블록 안쪽 id 는 모르므로 `#섹션-id` 와 `/쪽#섹션-id` 만 맞춘다(06 이 만든 앵커는 모두 섹션 id 다).
 * @param {{ site: { pages: Record<string, any>, sections: Record<string, { block?: string, props?: any }> }, pageKeys: Record<string, string[]>, defaultIdOf: (block: string) => string|null }} input
 *   pageKeys = { <경로>: [<쪽에 그려지는 섹션 키>] }(쪽 파일의 `sectionProps("<키>")`)
 * @returns {{ route: string, key: string, path: string, href: string, why: 'empty'|'route'|'anchor' }[]}  섹션·잎마다 한 번
 */
export function staticDeadLinks({ site, pageKeys, defaultIdOf }) {
  const routes = Object.keys(site.pages ?? {})
  const known = new Set(routes.map(normRoute))
  const sections = site.sections ?? {}
  const idOf = (key) => { const sec = sections[key]; return sec?.block ? (sec.props?.id ?? defaultIdOf(sec.block)) : null }
  const keysOf = (route) => [...new Set(pageKeys[route] ?? [])] // 전역 섹션(푸터·하단 바)도 쪽 파일이 부르는 쪽에만 그려진다 — 키는 쪽 파일의 sectionProps 에서 읽는다
  const idsByRoute = new Map(routes.map((r) => [normRoute(r), new Set(keysOf(r).map(idOf).filter(Boolean))]))
  const out = []
  for (const route of routes) {
    for (const key of keysOf(route)) {
      const sec = sections[key]
      if (!sec?.block) continue
      for (const l of leaves(sec.props)) {
        if (typeof l.value !== 'string' || !/(?:^|\.)href$/.test(l.path)) continue
        const t = decode(l.value).trim()
        if (t === '' || t === '#') { out.push({ route, key, path: l.path, href: l.value, why: 'empty' }); continue }
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t)) continue
        const hashAt = t.indexOf('#')
        const beforeHash = hashAt < 0 ? t : t.slice(0, hashAt)
        const frag = hashAt < 0 ? '' : decodeURIComponent(t.slice(hashAt + 1))
        const path = beforeHash.split('?')[0]
        let target
        if (path === '') target = normRoute(route)
        else if (path.startsWith('/')) {
          if (FILE_PATH.test(path)) continue
          target = normRoute(path)
          if (!known.has(target)) { out.push({ route, key, path: l.path, href: l.value, why: 'route' }); continue }
        } else continue
        if (frag === '' || frag === 'top') continue
        if (!idsByRoute.get(target)?.has(frag)) out.push({ route, key, path: l.path, href: l.value, why: 'anchor' })
      }
    }
  }
  return out
}

/** 사유 한 줄(접두는 호출자가 붙인다): `<href>(<쪽>) · …`. 같은 링크가 여러 쪽에 있으면 쪽을 모아 한 번만 적는다. */
export function deadLinkSummary(list, max = 8) {
  const byHref = new Map()
  for (const d of list) byHref.set(d.href || '(빈 href)', [...(byHref.get(d.href || '(빈 href)') ?? []), d.route])
  const rows = [...byHref].map(([href, rs]) => `${href === '#' ? '#(빈 앵커)' : href}(${[...new Set(rs)].slice(0, 3).join('·')}${new Set(rs).size > 3 ? ` 외 ${new Set(rs).size - 3}쪽` : ''})`)
  return `${rows.slice(0, max).join(', ')}${rows.length > max ? ` 외 ${rows.length - max}곳` : ''}`
}
