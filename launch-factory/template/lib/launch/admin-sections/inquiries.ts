// launch-factory: 관리 화면 구획 — 문의(계획 3d). 목록(처리 상태로 거르고 접수 번호·이름·연락처로 찾기) → 상세(전체 내용 + 답변 글타래) → 답변 저장 → 상태·불만 행동.
// 들어오는 사람: 문의 소유자(확인된 이메일이 INQUIRY_OWNER_EMAIL) 또는 관리자 — 예전 서버 액션(inquiry-admin.ts)과 같은 규칙이다. 규칙을 콘솔이 먼저 지키고, 서비스(lib/launch/inquiry)가 한 번 더 판정한다.
// 구획은 서버 액션이 아니라 문의 서비스를 직접 부른다(콘솔이 준 actor 를 그대로 넘긴다) — 문의를 바꾸는 입구는 이 구획 하나다.
// 개인정보: 표의 연락처 열은 콘솔이 가려서 내보낸다. 상세에는 답하는 데 필요해서 전체 값이 나가고(읽을 때마다 접속 기록이 한 줄 남는다), 행동 기록에는 폼 값이 없다.
import { defineSection, refuse, type Outcome } from "@launch-factory/admin-console"
import { INQUIRY_STATUSES, type StaffInquiry, type StaffInquiryItem } from "@launch-factory/inquiry"
import { inquiry, inquiryOwnerEmail } from "@/lib/launch/inquiry"

/** 서비스가 돌려주는 실패 이름 → 콘솔 실패 코드 */
const CODES: Record<string, string> = { forbidden: "forbidden", not_found: "not_found", invalid_input: "invalid_input", invalid_status: "invalid_input", invalid_kind: "invalid_input" }
const fail = (error: string) => refuse(CODES[error] ?? "action_failed")
const done = (r: { ok: true } | { ok: false; error: string }, message: string): Outcome => (r.ok ? { message } : fail(r.error))
const DISPUTE = ["complaint", "dispute"]

export const inquiriesSection = defineSection({
  id: "inquiries",
  part: "inquiry",
  label: "Inquiries",
  audience: { owner: inquiryOwnerEmail },
  statuses: INQUIRY_STATUSES,
  serverSearch: true, // 서버 검색: 접수 번호·이름·연락처 부분 일치(listInquiriesForStaff)
  columns: [
    { id: "reference", label: "Reference", kind: "text", primary: true },
    { id: "kind", label: "Kind", kind: "text", secondary: true },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "name", label: "Name", kind: "contact", secondary: true },
    { id: "contact", label: "Contact", kind: "contact", secondary: true },
    { id: "createdAt", label: "Received", kind: "date" },
  ],
  list: async (actor, q) => {
    const r = await (await inquiry()).listForStaff(actor, { ...(q.status ? { status: q.status } : {}), ...(q.search ? { search: q.search } : {}), limit: q.limit, offset: q.offset })
    return r.ok ? r.data : fail(r.error)
  },
  key: (row: StaffInquiryItem) => row.reference,
  cells: (row) => ({ reference: row.reference, kind: row.kind, status: row.status, name: row.name, contact: row.contact, createdAt: row.createdAt }),
  load: async (actor, id): Promise<StaffInquiry | null | ReturnType<typeof refuse>> => {
    const r = await (await inquiry()).getForStaff(actor, id)
    if (r.ok) return r.data
    return r.error === "not_found" ? null : fail(r.error)
  },
  view: (rec) => ({
    title: `Inquiry ${rec.reference}`,
    summary: [
      { label: "Status", value: rec.status, kind: "status" },
      { label: "Kind", value: rec.kind },
      { label: "Received", value: rec.createdAt },
      { label: "Kept until", value: rec.expiresAt },
      { label: "Form", value: rec.form },
      { label: "Name", value: rec.name ?? "" },
      // 답하려면 전체 값이 필요하다 — 연락처 종류(contact)로 두면 콘솔이 가린다. 표에서는 가려서 나간다
      { label: rec.contactKind === "email" ? "Email" : "Phone", value: rec.contact },
      { label: "Message", value: rec.message },
      ...rec.replies.map((r, i) => ({ label: `Reply ${i + 1} · ${r.createdAt} · ${r.mailedAt ? "emailed" : "not emailed"}`, value: r.body })),
    ],
  }),
  form: {
    fields: (rec) => [{ name: "reply", label: rec.contactKind === "email" ? "Reply (emailed to the sender)" : "Reply (the sender left a phone number — saved here only, call back yourself)", type: "textarea", required: true, value: "" }],
    // 화면이 폼을 열 때 만든 중복 전송 방지 키(ctx.idempotencyKey)를 서비스에 그대로 넘긴다 — 두 번 눌러도, 응답이 늦어 다시 보내도 답변·메일은 한 번이다
    save: async (actor, rec, values, ctx) => {
      const r = await (await inquiry()).reply(actor, { reference: rec.reference, body: values.reply ?? "", ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}) })
      if (!r.ok) {
        if (r.error === "in_progress") return refuse("invalid_state", { formError: "This reply is already being sent. Wait a moment, then check the thread before sending again." })
        return r.error === "invalid_input" ? refuse("invalid_input", { fieldErrors: { reply: ["Write a reply of up to 2000 characters."] } }) : fail(r.error)
      }
      if (r.data.mailed) return { message: "Reply saved and emailed to the sender." }
      return { message: rec.contactKind === "email" ? "Reply saved, but the email could not be sent — let the sender know another way." : "Reply saved. Nothing was emailed — the sender left a phone number." }
    },
  },
  actions: {
    "mark-in-progress": { label: "Mark in progress", when: (rec) => rec.status === "received", run: async (actor, rec) => done(await (await inquiry()).setStatus(actor, { reference: rec.reference, status: "in_progress" }), "Marked in progress.") },
    "mark-done": { label: "Mark done", when: (rec) => rec.status !== "done", run: async (actor, rec) => done(await (await inquiry()).setStatus(actor, { reference: rec.reference, status: "done" }), "Marked done.") },
    reopen: { label: "Reopen", when: (rec) => rec.status === "done", run: async (actor, rec) => done(await (await inquiry()).setStatus(actor, { reference: rec.reference, status: "in_progress" }), "Reopened.") },
    // 불만·분쟁은 3년 보관 대상이 된다(전자상거래법 시행령 제6조①4) — 올리는 일은 관리자만, 되돌리기는 종류 변경 서비스로 관리자만 한다
    "mark-complaint": {
      label: "Escalate to complaint",
      danger: true,
      adminOnly: true,
      when: (rec) => !DISPUTE.includes(rec.kind),
      run: async (actor, rec) => done(await (await inquiry()).markAsComplaint(rec.reference, actor, { reason: "Escalated in the admin console" }), "Escalated to a complaint. It is now kept for three years."),
    },
  },
  overview: async (actor) => {
    const r = await (await inquiry()).listForStaff(actor, { status: "received", limit: 1 })
    return r.ok && r.data.total > 0 ? { todo: [{ id: "received", severity: "warning", title: "New inquiries to answer", count: r.data.total, status: "received" }] } : {}
  },
})

export default inquiriesSection
