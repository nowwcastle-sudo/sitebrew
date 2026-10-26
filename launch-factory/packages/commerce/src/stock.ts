// 재고 — stock_levels 표에 대한 작은 연산 넷. 책임은 「수량을 안전하게 늘리고 줄이는 것」뿐이다(어느 상품이 재고 제한이 있는지는 모른다 — 부르는 쪽이 정한다).
// 예약은 조건부 UPDATE(… WHERE quantity >= n)라 동시에 마지막 한 개를 사려는 둘 중 한 명만 성공한다. 표의 CHECK(quantity >= 0)가 한 번 더 막는다.
// 교착을 피하려고 여러 상품은 항상 이름순으로 잠근다. 트랜잭션 안(tx)에서 부르면 실패 때 함께 되돌아간다.
import { and, eq, gte, inArray, sql } from "drizzle-orm"
import { stockLevels } from "@launch-factory/db"
import type { Executor } from "./deps.ts"

export interface StockLine {
  sku: string
  quantity: number
}

/** 재고가 모자란 상품(sku). 예약 트랜잭션을 되돌리려고 던진다 */
export class OutOfStock extends Error {
  readonly sku: string
  constructor(sku: string) {
    super(`out of stock: ${sku}`)
    this.name = "OutOfStock"
    this.sku = sku
  }
}

function assertWhole(n: number, what: string, min: number): void {
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${what} 는 ${min} 이상의 정수여야 해요 (받은 값: ${String(n)})`)
}

const bySku = (lines: readonly StockLine[]) => [...lines].sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))

/** 남은 수량. 행이 없는 상품은 결과에 없다 */
export async function stockLevelsOf(x: Executor, skus: readonly string[]): Promise<Map<string, number>> {
  if (skus.length === 0) return new Map()
  const rows = await x.select({ sku: stockLevels.sku, quantity: stockLevels.quantity }).from(stockLevels).where(inArray(stockLevels.sku, [...skus]))
  return new Map(rows.map((r) => [r.sku, r.quantity]))
}

/** 시작 수량을 채운다. 이미 있는 상품은 건드리지 않는다(DB 가 정본) */
export async function seedStock(x: Executor, rows: readonly StockLine[], now: Date): Promise<void> {
  if (rows.length === 0) return
  for (const r of rows) assertWhole(r.quantity, `${r.sku} 시작 재고`, 0)
  await x.insert(stockLevels).values(bySku(rows).map((r) => ({ sku: r.sku, quantity: r.quantity, updatedAt: now }))).onConflictDoNothing({ target: stockLevels.sku })
}

/** 재고를 차감한다. 하나라도 모자라면 OutOfStock(트랜잭션 안이면 앞서 한 차감도 되돌아간다) */
export async function reserve(x: Executor, lines: readonly StockLine[], now: Date): Promise<void> {
  for (const line of bySku(lines)) {
    assertWhole(line.quantity, `${line.sku} 수량`, 1)
    const rows = await x
      .update(stockLevels)
      .set({ quantity: sql`${stockLevels.quantity} - ${line.quantity}`, updatedAt: now })
      .where(and(eq(stockLevels.sku, line.sku), gte(stockLevels.quantity, line.quantity)))
      .returning({ sku: stockLevels.sku })
    if (rows.length === 0) throw new OutOfStock(line.sku)
  }
}

/** 재고를 돌려준다(행이 없으면 그 수량으로 만든다) */
export async function release(x: Executor, lines: readonly StockLine[], now: Date): Promise<void> {
  for (const line of bySku(lines)) {
    assertWhole(line.quantity, `${line.sku} 수량`, 1)
    await x
      .insert(stockLevels)
      .values({ sku: line.sku, quantity: line.quantity, updatedAt: now })
      .onConflictDoUpdate({ target: stockLevels.sku, set: { quantity: sql`${stockLevels.quantity} + ${line.quantity}`, updatedAt: now } })
  }
}

/** 운영자가 수량을 정한다(보충·실사). 없으면 만든다 */
export async function setStock(x: Executor, sku: string, quantity: number, now: Date): Promise<void> {
  assertWhole(quantity, `${sku} 재고`, 0)
  await x.insert(stockLevels).values({ sku, quantity, updatedAt: now }).onConflictDoUpdate({ target: stockLevels.sku, set: { quantity, updatedAt: now } })
}
