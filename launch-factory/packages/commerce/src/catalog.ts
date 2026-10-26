// 상품표 검사와 조회 — 가격의 정본은 서버의 이 표다(클라이언트가 보낸 금액은 어디서도 읽지 않는다).
// 제품이 lib/launch/catalog.ts 에 적은 항목을 켤 때 한 번 검사한다. 문제는 하나씩 던지지 않고 모아서 한 번에 알린다.
// 가격은 원 단위 정수(1 이상)이고 통화는 KRW 만. stock 은 처음 주문 때 DB(stock_levels)에 채워지는 시작 수량이고(null/없음 = 제한 없음), 그 뒤는 DB 가 정본이다.
import type { CatalogItem, Money } from "@launch-factory/contract"
import { won } from "@launch-factory/payments-kr"

/** 제품 설정 파일에 적는 모양. price 는 원 단위 정수(또는 KRW Money) */
export interface CatalogEntry {
  id: string
  name: string
  price: number | Money
  imageUrl?: string
  stock?: number | null
}

export interface Catalog {
  readonly items: readonly CatalogItem[]
  get(id: string): CatalogItem | undefined
}

export class CatalogError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`상품표가 올바르지 않아요:\n- ${problems.join("\n- ")}`)
    this.name = "CatalogError"
    this.problems = problems
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
const NAME_MAX = 200
const isSafeUrl = (v: string) => (v.startsWith("/") && !v.startsWith("//")) || v.startsWith("https://")

function priceOf(entry: CatalogEntry, problems: string[]): Money | undefined {
  const raw = entry.price
  const amount = typeof raw === "number" ? raw : raw?.amount
  if (typeof raw === "object" && raw !== null && raw.currency !== "KRW") {
    problems.push(`${entry.id}: 통화는 KRW 만 지원해요 (받은 통화: ${String(raw.currency)})`)
    return undefined
  }
  if (!Number.isSafeInteger(amount) || (amount as number) < 1) {
    problems.push(`${entry.id}: 가격은 1 이상의 정수(원)여야 해요 (받은 값: ${String(amount)})`)
    return undefined
  }
  return won(amount as number)
}

export function defineCatalog(entries: readonly CatalogEntry[]): Catalog {
  const problems: string[] = []
  if (!Array.isArray(entries) || entries.length === 0) throw new CatalogError(["상품이 하나도 없어요"])
  const seen = new Set<string>()
  const items: CatalogItem[] = []
  for (const entry of entries) {
    const label = String(entry?.id)
    if (typeof entry?.id !== "string" || !ID.test(entry.id)) problems.push(`${label}: id 는 영문·숫자·_ . - 로 64자 안이어야 해요`)
    else if (seen.has(entry.id)) problems.push(`${label}: id 가 겹쳐요`)
    else seen.add(entry.id)
    if (typeof entry?.name !== "string" || entry.name.trim() === "" || entry.name.length > NAME_MAX) problems.push(`${label}: 이름은 비어 있지 않고 ${NAME_MAX}자 안이어야 해요`)
    const price = priceOf(entry, problems)
    const stock = entry.stock ?? null
    if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0)) problems.push(`${label}: 재고는 0 이상의 정수(또는 비움 = 제한 없음)여야 해요 (받은 값: ${String(stock)})`)
    if (entry.imageUrl !== undefined && (typeof entry.imageUrl !== "string" || !isSafeUrl(entry.imageUrl))) problems.push(`${label}: 이미지는 https 주소 또는 / 로 시작하는 경로여야 해요`)
    if (price && problems.length === 0) {
      items.push(Object.freeze({ id: entry.id, name: entry.name.trim(), price: Object.freeze(price), ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}), stock }))
    }
  }
  if (problems.length > 0) throw new CatalogError(problems)
  const byId = new Map(items.map((item) => [item.id, item]))
  return Object.freeze({ items: Object.freeze(items), get: (id: string) => byId.get(id) })
}
