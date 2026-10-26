// launch-factory: 관리 화면 구획 「재고」(계획 3d). 재고 제한이 있는 상품(상품표 stock 이 숫자인 것)의 남은 수를 보고 정한다. 주문 구획과 따로 둔 까닭: 주문은 주문 번호가 기록이고 재고는 상품이 기록이다.
// 남은 수의 정본은 DB 다 — 상품표의 stock 은 처음 값일 뿐이라, 한 번도 팔리지 않아 재고 표에 행이 없는 상품은 상품표의 수를 보인다. 폼 저장이 보충·실사(setStock)이고 행동 단추는 없다.
// 접근 벽·요청 제한·기록은 콘솔이 한다(재고 수를 바꾸는 일은 주문 취소와 달리 되돌릴 수 있어 위험 행동이 아니다 — 같은 폼으로 다시 정한다).
import { defineSection, refuse } from "@launch-factory/admin-console"
import { setStock, stockLevelsOf, withDefaults } from "@launch-factory/commerce"
import { commerceDeps, commerceEnabled } from "@/lib/launch/commerce"

const MAX_STOCK = 1_000_000

interface StockRow {
  id: string
  name: string
  quantity: number
}

const ctx = async () => withDefaults(await commerceDeps())

/** 재고 제한이 있는 상품과 남은 수 */
async function stockRows(): Promise<StockRow[]> {
  const x = await ctx()
  const limited = x.catalog.items.filter((i) => i.stock !== null)
  const levels = await stockLevelsOf(x.db, limited.map((i) => i.id))
  return limited.map((i) => ({ id: i.id, name: i.name, quantity: levels.get(i.id) ?? (i.stock as number) }))
}

export default defineSection({
  id: "stock",
  part: "commerce",
  label: "Stock",
  audience: "admin",
  available: commerceEnabled,
  columns: [
    { id: "name", label: "Product", kind: "text", primary: true },
    { id: "sku", label: "ID", kind: "text", secondary: true },
    { id: "quantity", label: "In stock", kind: "numeric" },
  ],
  list: async (_actor, q) => {
    const needle = q.search?.toLowerCase()
    const all = (await stockRows()).filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle))
    return { items: all.slice(q.offset, q.offset + q.limit), total: all.length }
  },
  key: (r) => r.id,
  cells: (r) => ({ name: r.name, sku: r.id, quantity: r.quantity }),
  load: async (_actor, id) => (await stockRows()).find((r) => r.id === id) ?? null,
  view: (r) => ({ title: r.name, summary: [{ label: "ID", value: r.id }, { label: "In stock", value: String(r.quantity), kind: "numeric" }] }),
  form: {
    fields: (r) => [{ name: "quantity", label: "In stock", type: "number", required: true, value: String(r.quantity) }],
    save: async (_actor, r, values) => {
      const raw = (values.quantity ?? "").trim()
      const quantity = /^\d{1,7}$/.test(raw) ? Number(raw) : NaN
      if (!Number.isInteger(quantity) || quantity > MAX_STOCK) return refuse("invalid_input", { fieldErrors: { quantity: [`Enter a whole number from 0 to ${MAX_STOCK.toLocaleString("en-US")}.`] } })
      const x = await ctx()
      await setStock(x.db, r.id, quantity, x.now())
      return { message: "Stock updated." }
    },
  },
  overview: async () => {
    const out = (await stockRows()).filter((r) => r.quantity === 0).length
    return { todo: out > 0 ? [{ id: "stock-out", severity: "critical" as const, title: "Products out of stock", count: out }] : [] }
  },
})
