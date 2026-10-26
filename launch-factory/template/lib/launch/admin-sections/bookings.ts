// launch-factory: 관리 화면 구획 — 예약(계획 3d L2b). 서버 전용. 대상 = 운영자(BOOKING_OWNER_EMAIL 로 확인된 계정) 또는 관리자.
// 구획은 서버 액션이 아니라 예약 서비스를 직접 부른다: 콘솔이 입장시킨 행위자(actor)를 그대로 넘기면 서비스가 직원 규칙을 한 번 더 검사한다(두 겹).
// 표는 연락처를 가려서(콘솔이) 보이고, 기록 상세에는 연락처·이름·메모 전체가 든다. 직원 메모 칸은 예약 도메인에 없다(note 는 예약한 사람이 남긴 메모) — 그래서 편집 폼은 없다.
// 행동: 확정(mode "request"에서 운영자 확인을 기다리는 예약) · 취소(위험 — 결제된 예약금은 대표 취소 환불 비율(depositPolicy.ownerCancelRefundPercent, 기본 전액)대로 돌려준 뒤에만 취소되고, 환불이 실패하면 거절로 끝나 예약은 그대로 남는다).
import { defineSection, refuse, type AdminActor, type Outcome, type Refusal } from "@launch-factory/admin-console"
import type { BookingResult, BookingStaffRow } from "@launch-factory/booking"
import { booking, bookingOwnerEmail } from "@/lib/launch/booking"

const STATUSES = ["requested", "confirmed", "cancelled", "completed", "no_show"] as const
type Status = (typeof STATUSES)[number]

/** 서비스의 실패를 거절로 옮긴다 — 코드와 서비스가 쓴 안내 문구(개인정보 없음)만 나간다 */
const refusalOf = (r: Extract<BookingResult<unknown>, { ok: false }>): Refusal => refuse(r.code ?? "action_failed", r.formError !== undefined ? { formError: r.formError } : {})

/** 서비스 결과 → 행동 결과(성공이면 안내 문구, 실패면 거절) */
const outcomeOf = (r: BookingResult<{ message: string }>): Outcome => (r.ok ? { message: r.data.message } : refusalOf(r))

/** 자리를 차지하는 상태 — 취소할 수 있다(결제 대기 건은 닫기만 한다) */
const holding = (b: BookingStaffRow) => b.status === "requested" || b.status === "confirmed"
/** 운영자 확인을 기다리는 예약 — 예약금 결제를 기다리는 건은 결제가 끝나야 이어지고, 지난 시각의 요청은 확정하지 않는다 */
const confirmable = (b: BookingStaffRow, at: Date = new Date()) => b.status === "requested" && b.depositStatus !== "pending" && Date.parse(b.startsAt) > at.getTime()

const won = (n: number) => `${n.toLocaleString("en-US")} KRW`

export default defineSection({
  id: "bookings",
  part: "booking",
  label: "Bookings",
  audience: { owner: () => bookingOwnerEmail() },
  statuses: STATUSES,
  serverSearch: true, // 서버 검색: 접수 번호·연락처(메일·전화)·이름 부분 일치(listForStaff). 표의 연락처는 가려서 나가므로 화면이 다시 거르면 이메일로 찾을 수 없다
  columns: [
    { id: "reference", label: "Reference", kind: "text", primary: true },
    { id: "startsAt", label: "Starts", kind: "date", sortable: true },
    { id: "service", label: "Service", kind: "text" },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "depositStatus", label: "Deposit", kind: "status", secondary: true },
    { id: "depositAmount", label: "Deposit (KRW)", kind: "numeric", secondary: true },
    { id: "contact", label: "Contact", kind: "contact", secondary: true },
  ],
  list: async (actor, q) => {
    const r = await (await booking()).listForStaff(actor, { limit: q.limit, offset: q.offset, ...(q.status ? { status: q.status as Status } : {}), ...(q.search ? { search: q.search } : {}) })
    return r.ok ? { items: r.data.rows, total: r.data.total } : refusalOf(r)
  },
  key: (row) => row.reference,
  cells: (row) => ({
    reference: row.reference,
    startsAt: row.startsAt,
    service: row.serviceName,
    status: row.status,
    depositStatus: row.depositStatus === "none" ? null : row.depositStatus,
    depositAmount: row.depositAmount,
    contact: row.contact,
  }),
  load: async (actor, id) => {
    const r = await (await booking()).getForStaff(actor, id)
    if (r.ok) return r.data
    return r.code === "not_found" ? null : refusalOf(r)
  },
  view: (b) => ({
    title: `Booking ${b.reference}`,
    summary: [
      { label: "Reference", value: b.reference },
      { label: "Status", value: b.status, kind: "status" },
      { label: "Service", value: b.serviceName },
      { label: "Starts", value: b.startsAt },
      { label: "Ends", value: b.endsAt },
      { label: "Party size", value: String(b.partySize), kind: "numeric" },
      ...(b.name ? [{ label: "Name", value: b.name }] : []),
      // 기록 상세는 전체 값을 보인다(표에서만 가린다) — 연락하려면 필요하다
      { label: b.contactKind === "email" ? "Email" : "Phone", value: b.contact },
      ...(b.note ? [{ label: "Note from the guest", value: b.note }] : []),
      ...(b.depositStatus !== "none" ? [{ label: "Deposit", value: b.depositStatus, kind: "status" as const }] : []),
      ...(b.depositAmount ? [{ label: "Deposit amount", value: won(b.depositAmount), kind: "numeric" as const }] : []),
      ...(b.depositRefundedAmount != null ? [{ label: "Refunded", value: won(b.depositRefundedAmount), kind: "numeric" as const }] : []),
      { label: "Booked", value: b.createdAt },
      ...(b.cancelledAt ? [{ label: "Cancelled", value: `${b.cancelledAt} (${b.cancelledBy ?? "unknown"})` }] : []),
    ],
  }),
  actions: {
    confirm: {
      label: "Confirm booking",
      when: (b) => confirmable(b),
      run: async (actor: AdminActor, b) => outcomeOf(await (await booking()).confirm(b.reference, actor)),
    },
    cancel: {
      label: "Cancel booking",
      danger: true,
      when: holding,
      run: async (actor: AdminActor, b) => outcomeOf(await (await booking()).cancelAs(b.reference, actor)),
    },
  },
  overview: async (actor) => {
    const r = await (await booking()).listForStaff(actor, { status: "requested", limit: 200 })
    if (!r.ok) return {}
    const waiting = r.data.rows.filter((b) => confirmable(b)).length
    return waiting > 0 ? { todo: [{ id: "confirm", severity: "warning", title: "Bookings waiting for your confirmation", count: waiting, status: "requested" }] } : {}
  },
})
