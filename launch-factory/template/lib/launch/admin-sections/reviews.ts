// launch-factory: 관리 화면 구획 — 후기·상품 문의 검토(계획 3d). 목록(게시됨·검토 대기·숨김) → 상세 → 판매자 답변 저장 → 승인·숨김·되살리기.
// 들어오는 사람: 문의 소유자(확인된 이메일이 INQUIRY_OWNER_EMAIL) 또는 관리자 — 예전 서버 액션(reviews-admin.ts)과 같은 규칙이다. 구획은 서버 액션이 아니라 후기 서비스를 직접 부른다(콘솔이 준 actor 를 그대로 넘긴다).
// 판매자는 후기를 지울 수 없다 — 지우는 행동이 없다. 숨김은 사유가 필수라 서비스에 고정 사유를 싣고(관리 화면의 행동 단추는 입력을 못 싣는다), 누가 언제 숨겼는지는 admin_actions 에 남는다.
import { defineSection, refuse } from "@launch-factory/admin-console"
import { REVIEW_STATUSES, type ModerationItem } from "@launch-factory/reviews"
import { optional } from "@/lib/launch/env"
import { reviews } from "@/lib/launch/reviews"

const MAX_ROWS = 50 // 서비스의 한 쪽 상한
const CODES: Record<string, string> = { forbidden: "forbidden", not_found: "not_found", invalid_input: "invalid_input", reason_required: "invalid_input" }
const fail = (error: string) => refuse(CODES[error] ?? "action_failed")
const HIDE_REASON = "Hidden in the admin console"
const excerpt = (r: ModerationItem) => {
  const text = (r.title?.trim() || r.body).replace(/\s+/g, " ")
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

export const reviewsSection = defineSection({
  id: "reviews",
  part: "reviews",
  label: "Reviews",
  audience: { owner: () => optional("INQUIRY_OWNER_EMAIL") },
  statuses: REVIEW_STATUSES,
  serverSearch: true, // 서버 검색: 제목·본문·작성자 이름 부분 일치(listForModeration). 표에는 제목 일부만 보여서 화면이 다시 거르면 본문에서 찾은 글이 사라진다
  pageSize: MAX_ROWS, // 서비스의 한 쪽 상한과 같게 — 쪽 이동이 줄을 빠뜨리지 않는다
  columns: [
    { id: "excerpt", label: "Review", kind: "text", primary: true },
    { id: "kind", label: "Kind", kind: "text", secondary: true },
    { id: "rating", label: "Rating", kind: "numeric", secondary: true },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "author", label: "Author", kind: "text", secondary: true },
    { id: "subject", label: "About", kind: "text", secondary: true },
    { id: "createdAt", label: "Posted", kind: "date" },
  ],
  list: async (actor, q) => {
    // 서비스는 쪽 번호로 읽는다 — 콘솔이 쪽 크기(pageSize 선언 = MAX_ROWS)로 offset 을 만들었으므로 나누어 떨어진다
    const size = Math.min(q.limit, MAX_ROWS)
    const r = await (await reviews()).listForModeration(actor, { ...(q.status ? { status: q.status } : {}), ...(q.search ? { search: q.search } : {}), page: Math.floor(q.offset / size) + 1, pageSize: size })
    return r.ok ? { items: r.data.items, total: r.data.total } : fail(r.error)
  },
  key: (row: ModerationItem) => row.id,
  cells: (row) => ({ excerpt: excerpt(row), kind: row.kind, rating: row.rating, status: row.status, author: row.author, subject: `${row.subjectType}/${row.subjectId}`, createdAt: row.createdAt }),
  load: async (actor, id) => {
    const r = await (await reviews()).moderationItem(actor, id)
    if (r.ok) return r.data
    return r.error === "not_found" ? null : fail(r.error)
  },
  view: (rec) => ({
    title: `${rec.kind === "review" ? "Review" : "Question"} by ${rec.author}`,
    summary: [
      { label: "Status", value: rec.status, kind: "status" },
      { label: "Kind", value: rec.kind },
      ...(rec.rating !== null ? [{ label: "Rating", value: String(rec.rating), kind: "numeric" as const }] : []),
      { label: "About", value: `${rec.subjectType}/${rec.subjectId}` },
      { label: "Verified purchase", value: rec.verified ? "yes" : "no" },
      { label: "Posted", value: rec.createdAt },
      ...(rec.title ? [{ label: "Title", value: rec.title }] : []),
      { label: "Text", value: rec.body },
      ...(rec.hiddenReason ? [{ label: "Hidden because", value: rec.hiddenReason }] : []),
    ],
  }),
  form: {
    fields: (rec) => [{ name: "answer", label: "Seller reply (shown with the post)", type: "textarea", required: true, value: rec.answerBody ?? "" }],
    save: async (actor, rec, values) => {
      const r = await (await reviews()).answer(actor, { id: rec.id, body: values.answer ?? "" })
      if (r.ok) return { message: "Reply saved." }
      return r.error === "invalid_input" ? refuse("invalid_input", { fieldErrors: { answer: ["Write a reply of up to 2000 characters."] } }) : fail(r.error)
    },
  },
  actions: {
    approve: {
      label: "Approve",
      when: (rec) => rec.status === "pending",
      run: async (actor, rec) => {
        const r = await (await reviews()).setStatus(actor, { id: rec.id, status: "published" })
        return r.ok ? { message: "Approved and published." } : fail(r.error)
      },
    },
    unhide: {
      label: "Show again",
      when: (rec) => rec.status === "hidden",
      run: async (actor, rec) => {
        const r = await (await reviews()).setStatus(actor, { id: rec.id, status: "published" })
        return r.ok ? { message: "Published again." } : fail(r.error)
      },
    },
    hide: {
      label: "Hide",
      danger: true,
      when: (rec) => rec.status !== "hidden",
      run: async (actor, rec) => {
        const r = await (await reviews()).setStatus(actor, { id: rec.id, status: "hidden", reason: HIDE_REASON })
        return r.ok ? { message: "Hidden from the public page." } : fail(r.error)
      },
    },
  },
  overview: async (actor) => {
    const r = await (await reviews()).listForModeration(actor, { status: "pending", pageSize: 1 })
    return r.ok && r.data.total > 0 ? { todo: [{ id: "pending", severity: "warning", title: "Reviews waiting for approval", count: r.data.total, status: "pending" }] } : {}
  },
})

export default reviewsSection
