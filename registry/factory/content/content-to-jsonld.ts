import { DAYS, hoursTimeline, isNeedsCheck, phoneDigits, type Business, type Cta, type Day, type HolidayPolicy, type Holidays, type OpeningHours, type SpecialHours } from "@/registry/factory/content/content-core"
import { isMedical, type LocalContent } from "@/registry/factory/content/schemas/local"

/** schema.org JSON-LD 객체. `<JsonLd data={…} />`에 그대로 넘긴다. */
export type JsonLdObject = { "@context"?: "https://schema.org"; "@type": string } & Record<string, unknown>

const CONTEXT = "https://schema.org" as const
const DAY_NAMES: Record<Day, string> = {
  mo: "Monday", tu: "Tuesday", we: "Wednesday", th: "Thursday", fr: "Friday", sa: "Saturday", su: "Sunday",
}
const FOOD = new Set(["Bakery", "CafeOrCoffeeShop", "Restaurant"])

/**
 * 화면 전화번호 → JSON-LD telephone(+82). 「02-1234-5678」 → 「+82-2-1234-5678」, 「(02) 1234-5678」 → 「+82-2-1234-5678」,
 * 「+82-02-1234-5678」 → 「+82-2-1234-5678」(국제 형식에서 앞 0 을 뗀다), 전국대표번호 「1588-1234」 → 「+82-1588-1234」.
 * 화면에 적은 묶음(하이픈 자리)은 그대로 두고 숫자는 화면 값과 같다(앞 0 ↔ +82 만 다르다). 형식이 틀리면 한국어 오류를 던진다.
 * 사실 자리 표시(「확인 필요」 — 대장 C102)는 그대로 돌려준다: 던지지 않고, scrubNeedsCheck 가 JSON-LD 에서 그 칸을 뺀다(X4).
 */
export function toIntlPhone(phone: string): string {
  if (isNeedsCheck(phone)) return phone
  if (phoneDigits(phone) === null) throw new Error(`toIntlPhone: 전화번호 형식이 올바르지 않습니다 — "${phone}"`)
  let t = phone.trim().replace(/\(0\)/g, " ")
  if (t.startsWith("+82")) t = t.slice(3)
  const parts = t.split(/[^\d]+/).filter(Boolean)
  parts[0] = parts[0].replace(/^0/, "")
  return ["+82", ...parts.filter(Boolean)].join("-")
}

/**
 * JSON-LD 에서 빈 사실(자리 표시 글자, 대장 C102·X4)을 뺀다: 값이 자리 표시인 칸은 지우고, 이름(name)이 자리 표시인 엔티티는 통째로 뺀다(undefined).
 * 화면에는 「확인 필요」가 보이고 구조 데이터에는 그 칸이 없다 — 화면과 구조가 어긋나지 않는다(jsonLdVisibleIssues).
 */
export function scrubNeedsCheck<T>(v: T): T | undefined {
  if (typeof v === "string") return isNeedsCheck(v) ? undefined : v
  if (Array.isArray(v)) return v.map((x) => scrubNeedsCheck(x)).filter((x) => x !== undefined) as unknown as T
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("@type" in o && isNeedsCheck(o.name)) return undefined
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(o)) {
      const y = scrubNeedsCheck(x)
      if (y !== undefined) out[k] = y
    }
    return out as T
  }
  return v
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

/**
 * 영업시간 → OpeningHoursSpecification[]. 같은 시간대의 요일을 묶고, 쉬는 시간은 구간을 나눈다. 순서는 입력 순서를 따른다.
 * 밤샘 영업은 schema.org 규약대로 closes 가 opens 보다 이른 값(다음 날)으로 싣고, 자정을 넘긴 뒤 시작하는 구간은 다음 요일로 옮긴다.
 * 자정 마감(24:00)은 유효한 Time 이 아니므로 23:59 로 싣는다(Google 권장). 화면 문구는 formatOpeningHours.
 */
export function toOpeningHoursSpecification(hours: OpeningHours) {
  const ranges = new Map<string, { opens: string; closes: string; days: string[] }>()
  for (const h of hours) {
    const { open, close, breaks } = hoursTimeline(h)
    const segs: [number, number][] = []
    let from = open
    for (const [bs, be] of breaks) { segs.push([from, bs]); from = be }
    segs.push([from, close])
    for (const [a, b] of segs) {
      const shift = a >= 1440 ? 1 : 0
      const day = DAYS[(DAYS.indexOf(h.day) + shift) % 7]
      const opens = hhmm(a - shift * 1440)
      const end = b - shift * 1440
      const closes = end === 1440 ? "23:59" : hhmm(end % 1440)
      const key = `${opens}-${closes}`
      const r = ranges.get(key) ?? { opens, closes, days: [] }
      if (!r.days.includes(DAY_NAMES[day])) r.days.push(DAY_NAMES[day])
      ranges.set(key, r)
    }
  }
  return [...ranges.values()].map((r) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: r.days, opens: r.opens, closes: r.closes }))
}

/**
 * 특수일·공휴일 → specialOpeningHoursSpecification(schema.org Place — 「일반 영업시간을 덮어쓰는 특수 영업시간」, P3-2 Task 7a 대장 A105).
 * 날짜마다 validFrom = validThrough = 그 날짜, 쉬는 날은 opens = closes = 00:00(Google 이 쓰는 표기), 여는 날은 그 시각. 공휴일은 holidayPolicy 가 closed 일 때만 쉬는 날로 싣고
 * 같은 날짜에 특수일이 있으면 특수일이 이긴다(화면 판정 openNow 와 같은 순서). 자정 마감(24:00)은 23:59 로 싣는다.
 */
export function toSpecialOpeningHoursSpecification(special?: SpecialHours, holidays?: Holidays, policy?: HolidayPolicy) {
  const byDate = new Map<string, { opens: string; closes: string }>()
  for (const s of special ?? []) byDate.set(s.date, s.closed ? { opens: "00:00", closes: "00:00" } : { opens: s.opens ?? "00:00", closes: s.closes === "24:00" ? "23:59" : (s.closes ?? "00:00") })
  if (policy === "closed") for (const h of holidays ?? []) if (!byDate.has(h.date)) byDate.set(h.date, { opens: "00:00", closes: "00:00" })
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ "@type": "OpeningHoursSpecification", validFrom: date, validThrough: date, opens: v.opens, closes: v.closes }))
}

/**
 * 주소 → PostalAddress. 화면 주소 한 줄은 streetAddress 로 그대로, 시·도·시군구·우편번호는 있으면 더한다.
 * 국가(FINAL-WF4 EN10): 콘텐츠가 `addressCountry` 를 적었으면 그 값, 아니면 한국어 사이트(locale 없음·"ko")는 예전처럼 KR, 영어 사이트는 칸을 싣지 않는다 — 한국 고정값을 영어 사이트 주소에 달지 않는다.
 */
const postal = (b: Pick<Business, "address" | "addressRegion" | "addressLocality" | "postalCode"> & { addressCountry?: string }, locale?: string) => ({
  "@type": "PostalAddress",
  streetAddress: b.address,
  ...(b.addressLocality && { addressLocality: b.addressLocality }),
  ...(b.addressRegion && { addressRegion: b.addressRegion }),
  ...(b.postalCode && { postalCode: b.postalCode }),
  ...((b.addressCountry ?? (locale === "en" ? undefined : "KR")) && { addressCountry: b.addressCountry ?? "KR" }),
})

/**
 * local 콘텐츠 → LocalBusiness(가장 구체적인 하위 유형) JSON-LD. name·address·telephone·영업시간은 화면과 같은 객체에서 나온다
 * (factory-rules.md §20-5: 어긋나면 불합격). 음식점 계열은 메뉴(hasMenu)·servesCuisine 을 싣는다. 후기·별점은 싣지 않는다.
 * 의료 변형(isMedical)인데 하위 유형이 LocalBusiness 면 MedicalClinic 으로 싣는다. 지점은 toLocalBusinessBranches.
 */
export function toLocalBusiness(c: LocalContent): JsonLdObject {
  const b = c.business
  const out: JsonLdObject = {
    "@context": CONTEXT,
    "@type": isMedical(c) && b.subtype === "LocalBusiness" ? "MedicalClinic" : b.subtype,
    name: b.name,
    address: postal(b),
    telephone: toIntlPhone(b.phone),
    openingHoursSpecification: toOpeningHoursSpecification(c.hours),
  }
  const special = toSpecialOpeningHoursSpecification(c.hoursSpecial, c.holidays, c.holidayPolicy)
  if (special.length) out.specialOpeningHoursSpecification = special
  if (b.legalName) out.legalName = b.legalName
  if (b.url) out.url = b.url
  if (b.email) out.email = b.email
  if (b.geo) out.geo = { "@type": "GeoCoordinates", latitude: b.geo.lat, longitude: b.geo.lng }
  const sameAs = [c.mapLinks.naver, c.mapLinks.kakao, c.mapLinks.google].filter(Boolean)
  if (sameAs.length) out.hasMap = sameAs
  if (FOOD.has(b.subtype)) {
    if (c.servesCuisine?.length) out.servesCuisine = c.servesCuisine
    if (c.menu.length)
      out.hasMenu = {
        "@type": "Menu",
        hasMenuItem: c.menu.map((m) => ({ "@type": "MenuItem", name: m.name, offers: { "@type": "Offer", price: m.price, priceCurrency: "KRW" } })),
      }
  }
  return out
}

/**
 * 지점 → 지점마다 따로 쓰는 LocalBusiness JSON-LD(factory-rules.md §21-3: 지점별 구조화 데이터). 하위 유형은 본점과 같다.
 * 지점 카드와 같은 객체(c.branches)에서 나온다. 지점이 없으면 빈 배열.
 */
export function toLocalBusinessBranches(c: LocalContent): JsonLdObject[] {
  const type = isMedical(c) && c.business.subtype === "LocalBusiness" ? "MedicalClinic" : c.business.subtype
  return c.branches.map((br) => ({
    "@context": CONTEXT,
    "@type": type,
    name: br.name,
    url: br.url,
    address: postal({ address: br.address }),
    telephone: toIntlPhone(br.telephone),
    hasMap: [br.naverMapUrl, br.kakaoMapUrl],
    parentOrganization: { "@type": "Organization", name: c.business.name },
  }))
}

/** 회사 정보 → Organization JSON-LD. brand 의 `organization`, 다른 원형의 `business` 를 그대로 받는다. */
export function toOrganization(org: Business & { url?: string; logo?: { src?: string } | string; sameAs?: string[] }, locale?: string): JsonLdObject {
  const out: JsonLdObject = { "@context": CONTEXT, "@type": "Organization", name: org.name, address: postal(org, locale), telephone: toIntlPhone(org.phone) }
  if (org.legalName) out.legalName = org.legalName
  if (org.url) out.url = org.url
  const logo = typeof org.logo === "string" ? org.logo : org.logo?.src
  if (logo) out.logo = logo
  if (org.email) out.email = org.email
  if (org.sameAs?.length) out.sameAs = org.sameAs
  return out
}

/** 판매 상품 → Product + Offer JSON-LD. 실제 가격을 보여 주는 페이지에만 싣는다(DESIGN §12-A). */
export function toProduct(p: {
  name: string
  price: number
  currency?: string
  url?: string
  sku?: string
  images?: { src?: string }[]
  thumbs?: { src?: string }[]
  soldOut?: boolean
  rating?: { avg: number; count: number }
}): JsonLdObject {
  const images = (p.images ?? p.thumbs ?? []).map((i) => i.src).filter((s): s is string => !!s)
  const out: JsonLdObject = {
    "@context": CONTEXT,
    "@type": "Product",
    name: p.name,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: p.currency ?? "KRW",
      availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      ...(p.url && { url: p.url }),
    },
  }
  if (images.length) out.image = images
  if (p.sku) out.sku = p.sku
  if (p.rating && p.rating.count > 0) out.aggregateRating = { "@type": "AggregateRating", ratingValue: p.rating.avg, reviewCount: p.rating.count }
  return out
}

/**
 * SaaS 제품·요금제 → SoftwareApplication JSON-LD. 요금제가 화면 요금표와 같은 객체에서 offers 가 된다.
 * 가격이 공개된 요금제가 없으면 null 을 돌려준다 — 그때는 Organization 만 싣는다(factory-rules.md §21-1).
 */
export function toSoftwareApplication(
  product: { name: string; url?: string; category?: string; os?: string },
  plans: { name: string; monthlyPrice: number | null; currency?: string }[]
): JsonLdObject | null {
  const priced = plans.filter((p) => p.monthlyPrice !== null)
  if (!priced.length) return null
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: product.name,
    ...(product.url && { url: product.url }),
    applicationCategory: product.category ?? "BusinessApplication",
    operatingSystem: product.os ?? "Web",
    offers: priced.map((p) => ({ "@type": "Offer", name: p.name, price: p.monthlyPrice, priceCurrency: p.currency ?? "KRW" })),
  }
}

/**
 * 이동 경로 → BreadcrumbList JSON-LD. 화면 breadcrumb 과 같은 Cta 목록을 넘긴다. Google 은 item 에 절대 주소를 요구하므로
 * 상대 경로는 base(사이트 주소)로 절대 주소로 만들고, base 없이 상대 경로가 오면 한국어 오류를 던진다.
 */
export function toBreadcrumb(items: Cta[], base?: string): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => {
      const absolute = /^https?:\/\//i.test(it.href)
      if (!absolute && !base) throw new Error(`toBreadcrumb: 상대 경로 "${it.href}" 는 base(사이트 주소)가 있어야 절대 주소로 바꿀 수 있습니다`)
      return { "@type": "ListItem", position: i + 1, name: it.label, item: absolute ? it.href : new URL(it.href, base).href }
    }),
  }
}
