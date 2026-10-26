import { isNeedsCheck, type ArchetypeId, type Business, type Cta } from "@/registry/factory/content/content-core"
import {
  toBreadcrumb,
  toEvent,
  toIntlPhone,
  toItemList,
  toLocalBusiness,
  toLocalBusinessBranches,
  toOrganization,
  scrubNeedsCheck,
  toProduct,
  toSoftwareApplication,
  type JsonLdObject,
} from "@/registry/factory/content/content-to-jsonld"
import type { BrandContent } from "@/registry/factory/content/schemas/brand"
import type { CommerceContent } from "@/registry/factory/content/schemas/commerce"
import type { DetailContent } from "@/registry/factory/content/schemas/detail"
import type { LandingContent } from "@/registry/factory/content/schemas/landing"
import type { LocalContent } from "@/registry/factory/content/schemas/local"
import type { PublicContent } from "@/registry/factory/content/schemas/public"
import type { SaasContent } from "@/registry/factory/content/schemas/saas"
import { assertDate } from "@/registry/factory/ax/freshness"
import { pageUrl, siteName, type PageKind, type SeoContent, type SeoPage } from "@/registry/factory/ax/seo-meta"

export type Entity = "WebSite" | "Organization" | "LocalBusiness" | "Product" | "SoftwareApplication" | "ItemList" | "Event" | "BreadcrumbList" | "WebPage"

/**
 * 페이지 종류별로 내는 JSON-LD(원형에 해당 값이 있을 때만). Organization 은 홈 한 곳(X7 — 가게 원형은 LocalBusiness 가 그 자리),
 * BreadcrumbList 는 화면 이동 경로가 있을 때, WebPage(dateModified)는 화면 「업데이트」가 있을 때(X5). FAQPage 는 표에 없다 —
 * 기본 끔(C-6), `faqPage: true` 로만 켠다. 별점은 Product 에만(X4).
 */
export const JSONLD_BY_PAGE: Record<PageKind, readonly Entity[]> = {
  home: ["WebSite", "Organization", "LocalBusiness", "Product", "SoftwareApplication", "Event", "WebPage"],
  about: ["BreadcrumbList", "WebPage"],
  product: ["Product", "BreadcrumbList", "WebPage"],
  pricing: ["SoftwareApplication", "BreadcrumbList", "WebPage"],
  location: ["LocalBusiness", "BreadcrumbList", "WebPage"],
  article: ["BreadcrumbList", "WebPage"],
  contact: ["BreadcrumbList", "WebPage"],
  legal: ["BreadcrumbList", "WebPage"],
  list: ["ItemList", "BreadcrumbList", "WebPage"],
  other: ["BreadcrumbList", "WebPage"],
  campaign: ["Event", "BreadcrumbList", "WebPage"],
  app: ["BreadcrumbList", "WebPage"],
}

/** jsonLdFor 의 페이지 입력: SEO 페이지 + 화면 이동 경로·상품 slug·FAQ 켜기. */
export interface EntityPage extends SeoPage {
  /** 화면 breadcrumb 과 같은 목록(홈 → 현재) */
  breadcrumb?: Cta[]
  /** commerce 상품 페이지의 상품 slug */
  productSlug?: string
  /** FAQPage 켜기(기본 끔, C-6). 화면에 보이는 local `faq` 문답만 싣는다 */
  faqPage?: boolean
}

/** 원형 콘텐츠 + site. 원형 필드는 스키마 타입 그대로 읽는다. */
export type GeoContent = SeoContent & { archetype: ArchetypeId } & Record<string, unknown>

const CONTEXT = "https://schema.org" as const
const withIds = (o: JsonLdObject, taxID: string | undefined, sameAs: string[]) => {
  if (taxID) o.taxID = taxID
  const all = [...new Set([...((o.sameAs as string[] | undefined) ?? []), ...sameAs])]
  if (all.length) o.sameAs = all
  return o
}

/** 홈의 회사 엔티티. 가게(local)는 LocalBusiness 가 대신한다. taxID = 사업자등록번호(화면 푸터에 보이는 값), sameAs = 공식 채널. */
function organization(c: GeoContent): JsonLdObject | null {
  const sameAs = c.site.sameAs ?? []
  const url = new URL("/", c.site.url).href
  // 영어 사이트(FINAL-WF4 EN10): taxID(= 한국 사업자등록번호)와 한국 고정 국가 코드는 한국 전용 칸이라 싣지 않는다 — 국가는 콘텐츠 주소 사실(addressCountry)에서만.
  const en = c.site.locale === "en"
  const biz = (b: Business & { url?: string; logo?: { src?: string } | string; sameAs?: string[] }) => withIds(toOrganization({ url, ...b }, c.site.locale), en ? undefined : b.bizRegNo, sameAs)
  switch (c.archetype) {
    case "local":
      return null
    case "brand":
      return biz((c as unknown as BrandContent).organization)
    case "commerce":
      return biz((c as unknown as CommerceContent).business)
    case "public": {
      const a = (c as unknown as PublicContent).agency
      return withIds({ "@context": CONTEXT, "@type": "GovernmentOrganization", name: a.name, url, address: { "@type": "PostalAddress", streetAddress: a.address, addressCountry: "KR" }, telephone: toIntlPhone(a.mainPhone) }, undefined, sameAs)
    }
    default: {
      const b = (c as { business?: Business }).business
      if (b) return biz(b)
      const name = siteName(c)
      return isNeedsCheck(name) ? null : withIds({ "@context": CONTEXT, "@type": "Organization", name, url }, undefined, sameAs)
    }
  }
}

function products(c: GeoContent, page: EntityPage): JsonLdObject[] {
  const url = pageUrl(c, page.path)
  if (c.archetype === "detail") {
    const p = (c as unknown as DetailContent).product
    // 금액은 ports Money 처럼 최소 단위 정수다 — schema.org Offer.price 는 큰 단위(달러·유로)라 센트를 100 으로 나눈다
    const currency = p.currency ?? "KRW"
    return [toProduct({ name: p.name, price: currency === "USD" || currency === "EUR" ? p.price / 100 : p.price, currency, url, rating: p.rating })]
  }
  if (c.archetype === "commerce" && page.productSlug) {
    const p = (c as unknown as CommerceContent).products.find((x) => x.slug === page.productSlug)
    if (!p) throw new Error(`jsonLdFor: 상품 slug 「${page.productSlug}」가 콘텐츠에 없습니다`)
    return [toProduct({ ...p, url })]
  }
  return []
}

/**
 * 콘텐츠 객체 + 페이지 → 그 페이지에 싣는 JSON-LD 목록(`<JsonLd data={jsonLdFor(content, page)} />`). content-to-jsonld 를 감싸
 * 페이지 종류 표(`JSONLD_BY_PAGE`)대로 고른다. 값은 모두 화면과 같은 콘텐츠 객체에서 나온다(X4) — 빈 사실(「확인 필요」)은 싣지 않는다.
 */
export function jsonLdFor(c: GeoContent, page: EntityPage): JsonLdObject[] {
  const want = new Set(JSONLD_BY_PAGE[page.type])
  const out: JsonLdObject[] = []
  const locale = c.site.locale ?? "ko"
  if (want.has("WebSite") && !isNeedsCheck(siteName(c)))
    out.push({ "@context": CONTEXT, "@type": "WebSite", name: siteName(c), url: new URL("/", c.site.url).href, inLanguage: locale })
  if (want.has("Organization")) {
    const o = organization(c)
    if (o) out.push(o)
  }
  if (want.has("LocalBusiness") && c.archetype === "local") {
    const l = c as unknown as LocalContent
    out.push(withIds(toLocalBusiness(l), l.business.bizRegNo, c.site.sameAs ?? []), ...toLocalBusinessBranches(l))
  }
  if (want.has("Product") && page.showsPrice !== false) out.push(...products(c, page))
  if (want.has("SoftwareApplication") && c.archetype === "saas") {
    const s = c as unknown as SaasContent
    const app = toSoftwareApplication(s.product, page.showsPrice === false ? [] : s.plans)
    if (app) out.push(app)
  }
  // 상품 목록 쪽(C413): 화면에 상품 요약 블록이 그려진 쪽만, 이름만 싣는다(가격은 상세 Product 가 맡는다)
  if (want.has("ItemList") && c.archetype === "commerce" && page.showsPrice !== false) {
    const list = toItemList((c as unknown as CommerceContent).products.map((p) => ({ name: p.name })), c.site.url)
    if (list) out.push(list)
  }
  // 행사형 랜딩(C413·C416): 콘텐츠에 event 사실이 있을 때만 — 없는 일시·장소를 지어내지 않는다
  if (want.has("Event") && c.archetype === "landing") {
    const e = (c as unknown as LandingContent).event
    if (e) out.push(toEvent(e, pageUrl(c, page.path)))
  }
  if (want.has("BreadcrumbList") && page.breadcrumb?.length) out.push(toBreadcrumb(page.breadcrumb, c.site.url))
  if (want.has("WebPage") && page.updatedAt)
    out.push({
      "@context": CONTEXT,
      "@type": "WebPage",
      ...(page.title ? { name: page.title } : {}),
      url: pageUrl(c, page.path),
      inLanguage: locale,
      dateModified: assertDate(page.updatedAt),
    })
  if (page.faqPage) {
    const faq = (c as { faq?: { q: string; a: string }[] }).faq ?? []
    if (faq.length)
      out.push({
        "@context": CONTEXT,
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      })
  }
  return out.map((o) => scrubNeedsCheck(o)).filter((o): o is JsonLdObject => o !== undefined)
}

// 화면 글자와 대조하는 키. 주소·코드성 값(@type·url·sameAs·availability·통화·요일 등)은 화면 문구와 모양이 달라 대조하지 않는다.
const VISIBLE_KEYS = new Set(["name", "legalName", "streetAddress", "telephone", "email", "price", "taxID", "dateModified", "text"])

/**
 * JSON-LD 값이 화면 글자에 있는지 본다(X4 — P3-4 ops-gate 「구조와 화면 일치」). 화면 글자(렌더된 HTML 의 텍스트)에서 찾지 못한 값의
 * 목록을 돌려준다. 전화는 +82 형식을 화면의 0 형식으로, 가격은 12900·12,900 둘 다 찾는다. 공백은 하나로 줄여 비교한다.
 */
export function jsonLdVisibleIssues(objects: JsonLdObject[], screenText: string): { path: string; value: string }[] {
  const text = screenText.replace(/\s+/g, " ")
  const digits = text.replace(/\D/g, "")
  const issues: { path: string; value: string }[] = []
  const visit = (v: unknown, path: string, key: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`, key))
    if (v && typeof v === "object") return Object.entries(v).forEach(([k, x]) => visit(x, `${path}.${k}`, k))
    if (!VISIBLE_KEYS.has(key) || v === null || v === undefined) return
    const s = String(v).replace(/\s+/g, " ").trim()
    const found =
      key === "telephone" ? digits.includes(s.replace(/^\+82-?/, "0").replace(/\D/g, "")) || digits.includes(s.replace(/\D/g, ""))
      : key === "price" && typeof v === "number" ? text.includes(String(v)) || text.includes(v.toLocaleString("en-US"))
      : text.includes(s)
    if (!found) issues.push({ path, value: s })
  }
  objects.forEach((o, i) => visit(o, `[${i}]`, ""))
  return issues
}
