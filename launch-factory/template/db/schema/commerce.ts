// 판매 표(계획 3a B3) — 상품표 자체는 코드 설정(lib/launch/catalog.ts)이라 여기에 없다. 여기는 재고·장바구니·주문만 있다.
// - stock_levels: 상품(sku = 상품 id)별 남은 수량. 재고 예약은 조건부 UPDATE(… WHERE quantity >= n)로 한다 — DB 제약이 음수를 한 번 더 막는다.
// - cart_items: 로그인 사용자의 장바구니(가격을 두지 않는다 — 가격의 정본은 서버의 상품표). 사용자를 지우면 같이 지워진다.
// - orders / order_items: 주문과 주문 시점의 줄(이름·단가를 복사해 둔다 — 상품표가 바뀌어도 주문 기록은 그대로).
//   금액은 최소 단위 정수(원). 소계 + 배송비 = 합계는 DB 가 지킨다. 통화는 KRW 만.
//   주문은 전자상거래법 시행령 제6조제1항제3호(대금결제 및 재화등의 공급 기록, 5년)로 보존해야 하므로 사용자를 지워도 지우지 않는다 —
//   user_id 만 NULL 로 끊는다(ON DELETE SET NULL). 배송지(address)는 개인정보라 비울 수 있게 NULL 을 받는다(탈퇴 파기가 쓰는 길 — account-lifecycle 의 수집기·파기자).
// 시각은 앱이 넣는다(DB 기본값 now() 에 기대지 않는다 — Task 4 D26 규칙).
import { sql } from "drizzle-orm"
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-base.ts"

const tz = { withTimezone: true } as const
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`)

/**
 * 주문 상태. 한 곳에서만 정의한다 — 전이 표(commerce 패키지 order-states 의 TRANSITIONS)의 키와 같아야 한다(commerce 시험이 대조한다).
 * 계약 타입 OrderStatus 가 LF 에 들어오면(계획 B1) 아래 검사처럼 타입으로도 맞춘다.
 */
export const ORDER_STATUSES = ["pending_payment", "paid", "preparing", "shipped", "delivered", "canceled", "refunded"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** 배송지(계약 ShippingAddress 와 같은 모양 — 계약이 들어오면 그 타입으로 바꾼다) */
export interface StoredShippingAddress {
  recipient: string
  phone: string
  postcode: string
  address1: string
  address2?: string
  note?: string
}

export const stockLevels = pgTable(
  "stock_levels",
  {
    sku: text("sku").primaryKey(),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at", tz).notNull(),
  },
  (t) => [check("stock_levels_quantity_ck", sql`${t.quantity} >= 0`)],
)

export const cartItems = pgTable(
  "cart_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] }), check("cart_items_quantity_ck", sql`${t.quantity} >= 1`)],
)

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 사용자를 지워도 주문은 남는다(5년 보존) — 연결만 끊는다 */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").$type<OrderStatus>().notNull(),
    /** 최소 단위 정수(원) */
    subtotal: integer("subtotal").notNull(),
    shipping: integer("shipping").notNull(),
    total: integer("total").notNull(),
    currency: text("currency").notNull().default("KRW"),
    /** 결제 공급자의 결제 건 id. placeOrder 가 gateway.prepare 뒤에 기록한다(그 전에는 null) */
    paymentId: text("payment_id").unique(),
    /** 개인정보. 탈퇴 파기가 비울 수 있다(null) */
    address: jsonb("address").$type<StoredShippingAddress>(),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at", tz).notNull(),
    paidAt: timestamp("paid_at", tz),
    canceledAt: timestamp("canceled_at", tz),
    /** 결제 대기 주문의 재고 반환 시각(만든 때 + 30분). Cron 이 이 시각이 지난 pending_payment 를 취소한다 */
    expiresAt: timestamp("expires_at", tz).notNull(),
  },
  (t) => [
    check("orders_status_ck", inList("status", ORDER_STATUSES)),
    check("orders_amounts_ck", sql`${t.subtotal} >= 0 and ${t.shipping} >= 0 and ${t.total} = ${t.subtotal} + ${t.shipping}`),
    check("orders_currency_ck", sql`${t.currency} = 'KRW'`),
    // 「내 주문」 목록(최근 순)
    index("orders_user_created_idx").on(t.userId, t.createdAt),
    // 만료 Cron: 결제 대기이고 시각이 지난 것
    index("orders_status_expires_idx").on(t.status, t.expiresAt),
  ],
)

export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    /** 주문 시점의 상품 이름(상품표가 바뀌어도 기록은 그대로) */
    name: text("name").notNull(),
    unitAmount: integer("unit_amount").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.productId] }),
    check("order_items_amount_ck", sql`${t.unitAmount} >= 0 and ${t.quantity} >= 1`),
  ],
)
