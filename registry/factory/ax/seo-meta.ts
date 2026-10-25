import type { Metadata } from "next"
import { NEEDS_CHECK, type SiteInput } from "@/registry/factory/content/content-core"

/** 페이지 종류 — 메타(og:type)와 JSON-LD 표(geo-entity `JSONLD_BY_PAGE`)가 같은 목록을 쓴다. */
export const PAGE_KINDS = ["home", "about", "product", "pricing", "location", "article", "contact", "legal", "list", "other", "campaign", "app"] as const
export type PageKind = (typeof PAGE_KINDS)[number]

/**
 * 종류별 기본 색인 정책 — 「색인에서 뺄 종류」의 유일한 주인이다.
 * campaign = 광고·캠페인 도착 쪽(검색 유입이 아니라 광고로 오는 쪽이라 중복 콘텐츠가 되기 쉽다, C411),
 * app = 로그인한 사람용 화면(가입·로그인·온보딩·계정·결제·해지·예약 완료).
 */
export const KIND_POLICY: Record<PageKind, { noindex: boolean }> = {
  home: { noindex: false },
  about: { noindex: false },
  product: { noindex: false },
  pricing: { noindex: false },
  location: { noindex: false },
  article: { noindex: false },
  contact: { noindex: false },
  legal: { noindex: false },
  list: { noindex: false },
  other: { noindex: false },
  campaign: { noindex: true },
  app: { noindex: true },
}

/** 색인되는 쪽인가. 쪽이 `noindex` 를 직접 적었으면 그 값이 종류 기본값보다 앞선다. 메타(robots)와 사이트맵이 모두 이 함수 하나만 부른다. */
export const isIndexed = (p: { type: PageKind; noindex?: boolean }): boolean => !(p.noindex ?? KIND_POLICY[p.type].noindex)

/** 페이지 한 쪽의 SEO 입력. 제목·설명·갱신일은 화면과 같은 콘텐츠 값을 넘긴다(J9). */
export interface SeoPage {
  /** 사이트 안 경로(/…) */
  path: string
  title?: string
  description?: string
  type: PageKind
  /** OG 이미지 경로나 절대 주소. 기본 `/opengraph-image`(app/opengraph-image.tsx — og-image 부품) */
  ogImage?: string
  /** YYYY-MM-DD — 화면 「업데이트」·JSON-LD dateModified·sitemap lastmod 가 이 값 하나에서 나온다(freshness) */
  updatedAt?: string
  /** 색인 제외를 직접 정한다. 없으면 종류 기본값(KIND_POLICY — campaign·app 은 제외). 법정 페이지(약관·개인정보 처리방침)는 끄지 않는다 */
  noindex?: boolean
  /** 이 쪽 화면에 가격이 보이는지. `false` 면 JSON-LD 는 가격(Offer)을 싣지 않는다(X4·DESIGN §12-A — 화면에 없는 가격을 구조화 데이터에 두지 않는다). 없으면 예전대로 싣는다 */
  showsPrice?: boolean
}

/** seoMetadata 가 읽는 콘텐츠 — 원형 콘텐츠 + site(J9). 이름은 site.name → 회사·가게·제품·기관 이름 순으로 찾는다. */
export interface SeoContent {
  site: SiteInput
  organization?: { name?: string }
  business?: { name?: string }
  product?: { name?: string }
  agency?: { name?: string }
}

/** OG·트위터 카드 크기. Meta 공유 문서 「최소 1200×630」, Next opengraph-image 예시 크기 */
export const OG_SIZE = { width: 1200, height: 630 } as const

/**
 * 설명 길이 권고(글자). Google·네이버는 길이 제한이 없고 화면 폭에서 자를 뿐이라(1차 출처 2026-09-30) 오류가 아니라 경고다.
 * 수치는 계획의 권고값이다 — 1차 출처 수치 없음.
 */
export const DESCRIPTION_HINT = { ko: 80, en: 155 } as const

export const siteName = (c: SeoContent) =>
  c.site.name ?? c.organization?.name ?? c.business?.name ?? c.product?.name ?? c.agency?.name ?? NEEDS_CHECK

/** 사이트 안 경로 → 절대 주소. canonical·OG·JSON-LD 가 같은 함수를 쓴다(Google: canonical 은 절대 주소). */
export function pageUrl(c: SeoContent, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`pageUrl: 경로는 /로 시작하는 사이트 안 경로여야 합니다 — ${path}`)
  return new URL(path, c.site.url).href
}

/** 브라우저 탭·검색 결과 제목. 「페이지 제목 | 사이트 이름」, 홈은 사이트 이름. 제목이 이미 이름을 담으면 붙이지 않는다. */
export function pageTitle(c: SeoContent, page: SeoPage): string {
  const name = siteName(c)
  const t = page.title?.trim() || (page.type === "home" ? "" : NEEDS_CHECK)
  return !t ? name : t.includes(name) ? t : `${t} | ${name}`
}

export const pageDescription = (c: SeoContent, page: SeoPage) => page.description?.trim() || c.site.description?.trim() || NEEDS_CHECK

/**
 * 콘텐츠 객체 → Next `Metadata`. `generateMetadata` 안에서 `return seoMetadata(content, { path, type, … })`.
 * 제목은 `absolute`(레이아웃 템플릿과 겹치지 않게), canonical·OG·트위터 이미지는 절대 주소, hreflang 은 site.hreflang 이 있을 때만(§9 Q4),
 * 소유확인 메타(Google·네이버·Bing)는 홈에만 싣는다. 빈 사실은 「확인 필요」로 나가고 metaIssues 가 잡는다(J12).
 */
export function seoMetadata(c: SeoContent, page: SeoPage): Metadata {
  const url = pageUrl(c, page.path)
  const title = pageTitle(c, page)
  const description = pageDescription(c, page)
  const locale = c.site.locale ?? "ko"
  const image = new URL(page.ogImage ?? "/opengraph-image", c.site.url).href
  const pairs = Object.entries(c.site.hreflang ?? {})
  const languages = pairs.length ? { [locale]: url, ...Object.fromEntries(pairs.map(([lang, base]) => [lang, new URL(page.path, base).href])) } : undefined
  const v = c.site.verification ?? {}
  const other: Record<string, string> = {}
  if (v.naver) other["naver-site-verification"] = v.naver
  if (v.bing) other["msvalidate.01"] = v.bing
  const verify = page.type === "home" && (!!v.google || Object.keys(other).length > 0)
  return {
    metadataBase: new URL(c.site.url),
    title: { absolute: title },
    description,
    alternates: { canonical: url, ...(languages && { languages }) },
    openGraph: {
      type: page.type === "article" ? "article" : "website",
      url,
      siteName: siteName(c),
      title,
      description,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      images: [{ url: image, ...OG_SIZE, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: isIndexed(page), follow: true },
    ...(verify ? { verification: { ...(v.google ? { google: v.google } : {}), ...(Object.keys(other).length ? { other } : {}) } } : {}),
  }
}

export interface MetaIssue {
  level: "error" | "warn"
  path: string
  message: string
}

/**
 * 공개 전 검사(P3-4 ops-gate): 빈 사실(「확인 필요」)·페이지끼리 겹치는 제목·설명은 오류, 권고 길이를 넘는 설명은 경고.
 */
export function metaIssues(c: SeoContent, pages: SeoPage[]): MetaIssue[] {
  const out: MetaIssue[] = []
  const seen = { title: new Map<string, string>(), description: new Map<string, string>() }
  const hint = DESCRIPTION_HINT[c.site.locale ?? "ko"]
  for (const p of pages) {
    const got = { title: pageTitle(c, p), description: pageDescription(c, p) }
    for (const key of ["title", "description"] as const) {
      if (got[key].includes(NEEDS_CHECK)) out.push({ level: "error", path: p.path, message: `${key} 에 「${NEEDS_CHECK}」가 남았습니다` })
      const dup = seen[key].get(got[key])
      if (dup) out.push({ level: "error", path: p.path, message: `${key} 가 ${dup} 와 같습니다` })
      else seen[key].set(got[key], p.path)
    }
    const n = [...got.description].length
    if (n > hint) out.push({ level: "warn", path: p.path, message: `설명이 ${n}자입니다 — 권고 ${hint}자 안쪽(검색 결과에서 잘릴 수 있음)` })
  }
  return out
}
