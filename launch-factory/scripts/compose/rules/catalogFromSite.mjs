// catalogFromSite — 상점이 켜진 출력의 상품표(lib/launch/catalog.ts)를 시안 콘텐츠(content/site.json)의 products·shipping 으로 채운다.
//   템플릿 catalog.ts 는 가상 예시 상품 셋이 든 제품 소유 파일이다. 시안(commerce 원형)이 상품을 이미 말하고 있으면 예시 대신 그 상품이 상품표가 된다.
//   바꾸는 것은 PRODUCTS 와 SHIPPING 두 선언뿐이다(머리 주석·ORDERS_PATH 는 그대로). 가격의 정본은 여전히 이 파일이다 — 시안 화면이 보여 주는 가격과 같은 값에서 만든다.
//   옮기는 칸: slug → id · name · price(원 정수) · shipping.fee → fee · shipping.freeThreshold(1 이상일 때만) → freeOver.
//   옮기지 않는 칸: 재고(stock)와 사진(imageUrl)은 시안에 없거나 공개 주소가 아니라 비워 둔다(재고 제한 없음). 옵션·정가·단위 가격은 상품표가 모른다.
//   상점이 꺼졌거나 시안에 products 가 없으면 아무것도 바꾸지 않고 state.catalogFromSite 에 까닭만 적는다(던지지 않는다).
//   시안의 상품이 상품표 규칙(id 모양·가격 1 이상·중복 없음)을 어기면 출력이 주문 때 깨지므로 모아서 한 번에 던진다.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { turnedOn } from "./drop.mjs"

export const id = "catalogFromSite"

/** 상품표의 id 규칙(packages/commerce catalog.ts ID)에서 시안 slug 가 지키는 부분 집합 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/

/**
 * 시안 콘텐츠에서 상품표 값을 만든다. 상점 상품이 없으면 null, 규칙을 어기면 문제를 모아 던진다.
 * @returns {{ products: { id: string, name: string, price: number }[], shipping: { fee: number, freeOver: number | null } } | null}
 */
export function catalogOf(site) {
  const list = site?.products
  if (!Array.isArray(list) || list.length === 0) return null
  const problems = []
  const seen = new Set()
  const products = list.map((p, i) => {
    const at = `products[${i}]`
    if (typeof p?.slug !== "string" || !SLUG.test(p.slug)) problems.push(`${at}.slug: 영문 소문자·숫자·하이픈 1~64자여야 해요 (받은 값: ${JSON.stringify(p?.slug)})`)
    else if (seen.has(p.slug)) problems.push(`${at}.slug: 같은 상품 id 가 둘이에요 (${p.slug})`)
    else seen.add(p.slug)
    if (typeof p?.name !== "string" || !p.name.trim()) problems.push(`${at}.name: 상품 이름이 비었어요`)
    if (!Number.isSafeInteger(p?.price) || p.price < 1) problems.push(`${at}.price: 1 이상의 정수(원)여야 해요 (받은 값: ${JSON.stringify(p?.price)})`)
    return { id: p?.slug, name: p?.name?.trim(), price: p?.price }
  })
  const fee = site?.shipping?.fee
  const threshold = site?.shipping?.freeThreshold
  if (!Number.isSafeInteger(fee) || fee < 0) problems.push(`shipping.fee: 0 이상의 정수(원)여야 해요 (받은 값: ${JSON.stringify(fee)})`)
  if (threshold !== undefined && (!Number.isSafeInteger(threshold) || threshold < 0)) problems.push(`shipping.freeThreshold: 0 이상의 정수(원)여야 해요 (받은 값: ${JSON.stringify(threshold)})`)
  if (problems.length) throw new Error(`content/site.json 의 상품을 상품표로 옮길 수 없어요:\n- ${problems.join("\n- ")}`)
  return { products, shipping: { fee, freeOver: threshold >= 1 ? threshold : null } }
}

const PRODUCTS_RE = /export const PRODUCTS: readonly CatalogEntry\[\] = \[[\s\S]*?\n\]\n/
const SHIPPING_RE = /export const SHIPPING: ShippingRule = \{[^\n]*\}\n/
const EXAMPLE_NOTE_RE = /^\/\/ 아래는 예시다[^\n]*\n/m

/** catalog.ts 글자에서 PRODUCTS·SHIPPING 을 바꾼다. 선언을 못 찾으면(템플릿 글자가 바뀜) 던진다 — 시험이 템플릿에 그대로 있는지 지킨다 */
export function applyCatalog(text, { products, shipping }) {
  if (!PRODUCTS_RE.test(text) || !SHIPPING_RE.test(text)) throw new Error("lib/launch/catalog.ts: PRODUCTS·SHIPPING 선언을 찾지 못했어요(템플릿 글자가 바뀜)")
  const rows = products.map((p) => `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, price: ${p.price} },`).join("\n")
  return text
    .replace(EXAMPLE_NOTE_RE, "// 아래 상품표와 배송비는 시안(content/site.json)의 상품에서 옮겼다 — 가격을 고치면 시안과 이 표를 함께 고친다. 재고는 적지 않았다(제한 없음).\n")
    .replace(PRODUCTS_RE, () => `export const PRODUCTS: readonly CatalogEntry[] = [\n${rows}\n]\n`)
    .replace(SHIPPING_RE, () => `export const SHIPPING: ShippingRule = { fee: ${shipping.fee}, freeOver: ${shipping.freeOver} }\n`)
}

export function run(state) {
  const spec = state.rules.steps.catalogFromSite
  if (!turnedOn(state.table, state.features).has(spec.requires)) {
    state.catalogFromSite = { status: "skipped", reason: "상점이 꺼져 있어요" }
    return state
  }
  const from = join(state.siteDir, spec.from)
  const file = join(state.to, spec.file)
  const site = existsSync(from) ? JSON.parse(readFileSync(from, "utf8")) : null
  const catalog = site && catalogOf(site)
  if (!catalog || !existsSync(file)) {
    state.catalogFromSite = { status: "skipped", reason: catalog ? "상품표 파일이 없어요" : "시안에 products 가 없어요" }
    return state
  }
  writeFileSync(file, applyCatalog(readFileSync(file, "utf8"), catalog))
  state.catalogFromSite = { status: "applied", count: catalog.products.length }
  return state
}
