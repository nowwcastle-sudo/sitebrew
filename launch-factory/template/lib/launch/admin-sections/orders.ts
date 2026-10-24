// launch-factory: 관리 화면 구획 「주문」(계획 3d). 판매 규칙(@launch-factory/commerce)의 서비스를 직접 부른다 — 서버 액션을 감싸지 않는다(입구는 콘솔 하나).
// 접근 벽(관리자 · 2단계 인증 · 대리 세션 · 정지)·확인 입력 벽(주문 취소)·요청 제한·기록은 콘솔이 한다. 이 파일은 무엇을 보이고 어떤 행동이 있는지만 선언한다.
//   목록: 주문 번호(앞 8자)·상태·합계·주문 시각·받는 분(연락처 열이라 콘솔이 가린다). 상세: 줄·합계·받는 분·배송지·송장·상태 요약(상세는 배송에 쓰는 전체 값 — 읽은 기록은 접속 기록에 남는다).
//   행동은 도착 상태 이름이다: mark-preparing(결제 완료 → 준비 중) · mark-shipped(준비 중 → 배송 중, 저장해 둔 송장 번호가 같이 간다) · mark-delivered(배송 중 → 완료). 전이는 판매 규칙의 전이 표가 정한다.
//   cancel 이 유일한 위험 행동이다: 결제된 주문은 전액 환불이 성공해야 취소된다(환불이 안 되면 상태는 그대로). 송장 번호는 폼 저장(행동 단추는 입력을 못 싣는다) — 배송 전 상태에서만 고친다.
//   검색어는 받지 않는다(주문 번호는 길고 받는 분은 가려져 있다) — 상태 거르기로 좁힌다.
import { defineSection, refuse, type AdminCell } from "@launch-factory/admin-console"
import { advanceOrder, cancelOrder, countOrders, listAllOrders, loadOrder, setTrackingNumber, TRACKING_EDITABLE, withDefaults, type Failure, type OrderRecord } from "@launch-factory/commerce"
import type { OrderStatus } from "@launch-factory/contract"
import { commerceDeps, commerceEnabled } from "@/lib/launch/commerce"

const STATUSES = ["pending_payment", "paid", "preparing", "shipped", "delivered", "canceled", "refunded"] as const satisfies readonly OrderStatus[]
const CANCELABLE: readonly OrderStatus[] = ["pending_payment", "paid", "preparing"]

const ctx = async () => withDefaults(await commerceDeps())
const isStatus = (v: string | undefined): v is OrderStatus => STATUSES.includes(v as OrderStatus)
const short = (id: string): string => id.slice(0, 8)
const won = (n: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n)
const when = (d: Date | null): string => (d ? d.toISOString() : "")

/** 판매 규칙의 실패 → 콘솔 거절. 사람 글이 필요한 것만 문구를 싣고(DB·결제 공급자 글은 없다) 나머지는 콘솔의 기본 문구를 쓴다 */
function refusalOf(f: Failure) {
  switch (f.code) {
    case "not_found":
      return refuse("not_found")
    case "invalid_transition":
    case "not_cancelable":
      return refuse("invalid_state")
    case "invalid_input":
      return refuse("invalid_input")
    case "refund_failed":
      return refuse("refund_failed", { formError: "The refund didn't go through, so the order was not canceled. Check the payment provider, then try again." })
    default:
      return refuse("action_failed")
  }
}

/** 한 칸 앞으로 */
const forward = (to: "preparing" | "shipped" | "delivered") => async (_actor: unknown, rec: OrderRecord) => {
  const result = await advanceOrder(await ctx(), { orderId: rec.id, to, ...(to === "shipped" && rec.trackingNumber ? { trackingNumber: rec.trackingNumber } : {}) })
  return result.ok ? undefined : refusalOf(result)
}

export default defineSection({
  id: "orders",
  part: "commerce",
  label: "Orders",
  audience: "admin",
  available: commerceEnabled,
  statuses: STATUSES,
  columns: [
    { id: "id", label: "Order", kind: "text", primary: true },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "total", label: "Total", kind: "numeric" },
    { id: "created", label: "Ordered", kind: "date", secondary: true },
    { id: "recipient", label: "Recipient", kind: "contact", secondary: true },
  ],
  list: async (_actor, q) => {
    const status = isStatus(q.status) ? q.status : undefined
    const x = await ctx()
    const [items, total] = await Promise.all([listAllOrders(x.db, { ...(status ? { status } : {}), limit: q.limit, offset: q.offset }), countOrders(x.db, status)])
    return { items, total }
  },
  key: (o) => o.id,
  cells: (o): Record<"id" | "status" | "total" | "created" | "recipient", AdminCell> => ({ id: short(o.id), status: o.status, total: o.total, created: o.createdAt.toISOString(), recipient: o.address?.recipient ?? null }),
  load: async (_actor, id) => loadOrder((await ctx()).db, id),
  view: (o) => ({
    title: `Order ${short(o.id)}`,
    summary: [
      { label: "Status", value: o.status, kind: "status" },
      ...o.items.map((i) => ({ label: i.name, value: `${i.quantity} × ${won(i.unitAmount)}`, kind: "numeric" as const })),
      { label: "Subtotal", value: won(o.subtotal), kind: "numeric" },
      { label: "Shipping", value: won(o.shipping), kind: "numeric" },
      { label: "Total", value: won(o.total), kind: "numeric" },
      { label: "Ordered", value: when(o.createdAt) },
      ...(o.paidAt ? [{ label: "Paid", value: when(o.paidAt) }] : []),
      ...(o.canceledAt ? [{ label: "Canceled", value: when(o.canceledAt) }] : []),
      { label: "Tracking number", value: o.trackingNumber ?? "" },
      ...(o.address
        ? [
            { label: "Recipient", value: o.address.recipient },
            { label: "Phone", value: o.address.phone },
            { label: "Address", value: [o.address.postcode, o.address.address1, o.address.address2].filter(Boolean).join(" ") },
            ...(o.address.note ? [{ label: "Delivery note", value: o.address.note }] : []),
          ]
        : []),
    ],
  }),
  form: {
    // 배송이 시작된 주문의 송장 번호는 바꾸지 않는다(칸이 없으면 콘솔이 칸 이름을 받지 않는다)
    fields: (o) => (TRACKING_EDITABLE.some((s) => s === o.status) ? [{ name: "trackingNumber", label: "Tracking number", type: "text", required: true, value: o.trackingNumber ?? "" }] : []),
    save: async (_actor, o, values) => {
      const result = await setTrackingNumber(await ctx(), { orderId: o.id, trackingNumber: values.trackingNumber })
      return result.ok ? { message: "Tracking number saved." } : refusalOf(result)
    },
  },
  actions: {
    "mark-preparing": { label: "Mark preparing", when: (o) => o.status === "paid", run: forward("preparing") },
    "mark-shipped": { label: "Mark shipped", when: (o) => o.status === "preparing", run: forward("shipped") },
    "mark-delivered": { label: "Mark delivered", when: (o) => o.status === "shipped", run: forward("delivered") },
    cancel: {
      label: "Cancel order",
      danger: true,
      when: (o) => CANCELABLE.includes(o.status),
      run: async (_actor, o) => {
        const result = await cancelOrder(await ctx(), { orderId: o.id, by: "admin" })
        return result.ok ? { message: o.status === "pending_payment" ? "Order canceled." : "Order canceled and refunded." } : refusalOf(result)
      },
    },
  },
  overview: async () => {
    const x = await ctx()
    const [paid, preparing] = await Promise.all([countOrders(x.db, "paid"), countOrders(x.db, "preparing")])
    return {
      todo: [
        ...(paid > 0 ? [{ id: "orders-paid", severity: "warning" as const, title: "Paid orders to prepare", count: paid, status: "paid" }] : []),
        ...(preparing > 0 ? [{ id: "orders-preparing", severity: "warning" as const, title: "Orders to ship", count: preparing, status: "preparing" }] : []),
      ],
    }
  },
})
