// 찍어낸 사이트의 콘텐츠 읽기(P3-3 Task 9, J9) — 콘텐츠 값은 content/site.json 한 곳에만 있다. 페이지·잎 코드는 이 파일로 읽는다.
//   $ref 는 site.json 안의 자리를 가리킨다({ "$ref": "business.name" }, tel: 링크는 "as": "tel"). 손볼 때는 site.json 의 그 자리 하나만 고친다.
import * as React from "react"

import siteJson from "@/content/site.json"
import build from "@/lib/build.json"
import { normalizePhone } from "@/lib/phone"
import { NEEDS_CHECK_LITERALS, isMailAddress, type ArchetypeId } from "@/components/content/content-core"
import type { SeoPage, PageKind } from "@/components/ax/seo-meta"
import type { SeoInput } from "@/components/ax/seo-files"
import { toHex } from "@/components/ax/brand-color"

type Ref = { $ref: string; as?: "tel" | "mailto"; template?: string }
type Section = { block: string; props: unknown; copyVariant?: string }
type PageMeta = { id: string; type: PageKind; title: unknown; description?: unknown; noindex?: boolean; hero: boolean; legal?: boolean; showsPrice?: boolean }
type Legal = { title: string; draft: boolean; clauses: { title: string; text: string }[] }
type SiteFile = {
  archetype: ArchetypeId
  locale: "ko" | "en"
  site: Record<string, unknown>
  sections: Record<string, Section>
  pages: Record<string, PageMeta>
  legal: Record<string, Legal>
  shell: { brand: unknown; nav: { label: string; href: string }[]; action?: { label: unknown; href: unknown } | null }
} & Record<string, unknown>

const site = siteJson as unknown as SiteFile

const isRef = (v: unknown): v is Ref => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as Ref).$ref === "string"
const at = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), site)

/** $ref 를 site.json 의 값으로 푼다(깊이 우선). 없는 자리는 던진다 — 조용히 빈 글자를 그리지 않는다. */
export function resolve<T>(v: T): T {
  if (isRef(v)) {
    const got = at(v.$ref)
    if (got === undefined) throw new Error(`site.json 에 ${v.$ref} 가 없다`)
    if (v.as === "tel") return (typeof got === "string" && !(NEEDS_CHECK_LITERALS as readonly string[]).includes(got.trim()) ? `tel:${normalizePhone(got) ?? got}` : "#") as T
    if (v.as === "mailto") return (typeof got === "string" && got.trim() !== "" && !(NEEDS_CHECK_LITERALS as readonly string[]).includes(got.trim()) && isMailAddress(got.trim()) ? `mailto:${got.trim()}` : "#") as T
    const value = resolve(got)
    return (v.template && typeof value === "string" ? v.template.replace("{}", value) : value) as T
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x)) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)])) as T
  return v
}

/** 콘텐츠 값 한 자리(경로) — lib/contact.ts 처럼 잎이 아닌 곳이 읽을 때. 없는 자리는 undefined. */
export const contentAt = (path: string): unknown => at(path)

export const locale = site.locale
export const archetype = site.archetype

/** 섹션 props(문구·값). 블록·변형 이름은 잎 코드가 안다. */
export const sectionProps = (key: string) => resolve((site.sections[key] as Section).props) as never
export const copyVariantOf = (key: string): string | undefined => site.sections[key]?.copyVariant

/** SEO 메타·JSON-LD 가 읽는 콘텐츠 객체(J9 — 원형 콘텐츠 + site 하나). */
export function seoContent() {
  const { sections: _s, pages: _p, legal: _l, shell: _h, ...content } = site
  void _s; void _p; void _l; void _h
  return { ...content, site: resolve(site.site) } as never
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined)

/** 쪽 하나의 SEO 입력(seoMetadata·jsonLdFor 가 받는 모양). */
export function pageSeo(route: string): SeoPage {
  const p = site.pages[route]
  return { path: route, type: p.type, title: str(resolve(p.title)), description: str(resolve(p.description)), noindex: p.noindex, showsPrice: p.showsPrice }
}
export const pageTitle = (route: string): string => str(resolve(site.pages[route].title)) ?? ""
export const pageHasHero = (route: string) => site.pages[route].hero
export const legalPage = (name: string) => site.legal[name]

/** SiteShell 에 펼치는 값: 로고·주 메뉴·헤더 행동. 푸터(사업자 정보)는 푸터 블록이 그린다. */
export function shellProps(route: string) {
  const s = site.shell
  const brand = str(resolve(s.brand)) ?? ""
  const action = s.action ? { label: str(resolve(s.action.label)) ?? "", href: str(resolve(s.action.href)) ?? "#" } : null
  return {
    archetype: site.archetype,
    logo: (
      <a href="/" className="font-heading inline-flex min-h-11 items-center">
        {brand}
      </a>
    ),
    nav: s.nav,
    currentHref: route,
    action,
    // 영어 사이트: 셸의 접근 이름(건너뛰기·주 메뉴 …)과 사업자 정보 이름표를 영어 표로(ko 는 칸을 비워 출력이 그대로, D235)
    ...(locale === "en" ? { locale } : {}),
  }
}

/** robots.txt·sitemap.xml 입력(seo-files) — 색인 제외(noindex) 쪽은 사이트맵에 싣지 않는다(robots 로 막지도 않는다: 막으면 봇이 noindex 를 읽지 못한다). */
export function seoInput(): SeoInput {
  const brand = str(resolve(site.shell.brand)) ?? ""
  const pages = Object.entries(site.pages)
    .filter(([, p]) => !p.noindex)
    .map(([route, p]) => ({ url: route, title: str(resolve(p.title)) ?? route, description: str(resolve(p.description)) }))
  return { siteUrl: str(resolve(site.site.url)) ?? "https://example.com", name: brand, summary: str(resolve(site.site.description)) ?? brand, pages }
}

/** app/manifest.ts 가 읽는 값: 이름·설명·로캘·색(lib/build.json — 기본 테마 쪽 색). */
export function manifestProps() {
  const { name, summary } = seoInput()
  // 웹 앱 매니페스트의 색은 #hex 여야 설치 화면·주소창이 읽는다(oklch 는 브라우저가 못 읽는다, FINAL-WF4 EN11) — 못 바꾸는 색은 그대로 둔다
  const hex = (c: string) => { try { return toHex(c) } catch { return c } }
  return { name, description: summary, lang: site.locale, background: hex(build.og.background), theme: hex(build.og.accent) }
}

/** 기본 공유 그림(app/opengraph-image.tsx)이 읽는 값: 홈 제목·이름·레시피 색(lib/build.json — 기본 테마 쪽 색). */
export function ogProps() {
  const brand = str(resolve(site.shell.brand)) ?? ""
  return { title: str(resolve(site.pages["/"]?.title)) ?? brand, name: brand, colors: build.og }
}
