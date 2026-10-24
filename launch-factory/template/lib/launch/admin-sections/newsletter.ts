// launch-factory: 관리 화면 구획 — 뉴스레터 구독 명단(계획 3d). 관리자만 들어온다(이 부품에는 소유자 이메일이 없다).
// 구획은 선언이다 — 접근 벽·확인 입력 벽·기록·연락처 가리기는 콘솔(@launch-factory/admin-console)이 한다. 등록은 lib/launch/admin-console.ts 의 ADMIN_SECTIONS 한 줄.
// 보여 주는 것: 표(이메일은 가려서, 상태·출처·동의한 날) → 기록(동의 증빙: 동의 문구 판·동의/확인/철회 시각·보유 기한). 서명 링크·토큰은 어느 쪽에도 싣지 않는다(수신거부 링크는 구독자 본인의 열쇠다).
// 행동은 하나: 수신거부 대행(mark-unsubscribed, 위험 — 구독자가 되돌리려면 새로 신청해 새 확인을 거쳐야 한다). 구독자가 요청한 철회를 대신 처리할 뿐이고(정보통신망법 제50조⑥ — 철회는 지체 없이),
// 구독을 만들거나 확인해 주는 길은 만들지 않는다 — 동의는 구독자 본인의 것이다. 상태 이름은 명단의 이름 그대로다(pending · subscribed · unsubscribed).
import { defineSection, refuse } from "@launch-factory/admin-console"
import type { SubscriberAdminView } from "@launch-factory/newsletter"
import { newsletter } from "@/lib/launch/newsletter"

const STATUSES = ["pending", "subscribed", "unsubscribed"] as const
type Status = (typeof STATUSES)[number]

const isStatus = (v: string | undefined): v is Status => STATUSES.includes(v as Status)
const day = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)
const stamp = (d: Date | null, none = "—"): string => (d ? `${d.toISOString().slice(0, 16).replace("T", " ")} UTC` : none)

export default defineSection({
  id: "newsletter",
  part: "newsletter",
  label: "Newsletter",
  audience: "admin",
  statuses: STATUSES,
  serverSearch: true, // 서버 검색: 이메일 부분 일치(listSubscribersForAdmin)
  columns: [
    { id: "email", label: "Email", kind: "contact", primary: true },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "source", label: "Form", kind: "text", secondary: true },
    { id: "consentAt", label: "Consented", kind: "date", secondary: true },
  ],
  list: async (_actor, { search, status, limit, offset }) => {
    const page = await (await newsletter()).listForAdmin({ ...(isStatus(status) ? { status } : {}), ...(search ? { search } : {}), limit, offset })
    return { items: page.items, total: page.total }
  },
  key: (row: SubscriberAdminView) => row.id,
  cells: (row) => ({ email: row.email, status: row.status, source: row.source, consentAt: day(row.consentAt) }),
  load: async (_actor, id) => (await (await newsletter()).getForAdmin(id)) ?? null,
  view: (rec) => ({
    // 제목은 주소·화면 머리에 그대로 나가므로 이메일 대신 기록 번호 앞자리를 쓴다
    title: `Subscriber ${rec.id.slice(0, 8)}`,
    summary: [
      { label: "Email", value: rec.email },
      { label: "Status", value: rec.status, kind: "status" },
      { label: "Language", value: rec.locale },
      { label: "Form", value: rec.source },
      { label: "Consent version", value: rec.consentVersion },
      { label: "Consent given", value: stamp(rec.consentAt) },
      { label: "Confirmation mail sent", value: stamp(rec.confirmSentAt) },
      { label: "Confirmed", value: stamp(rec.confirmedAt, "Not confirmed") },
      { label: "Unsubscribed", value: stamp(rec.unsubscribedAt) },
      { label: "Record kept until", value: stamp(rec.expiresAt, "While subscribed") },
    ],
  }),
  actions: {
    "mark-unsubscribed": {
      label: "Unsubscribe",
      danger: true,
      when: (rec) => rec.status !== "unsubscribed",
      run: async (_actor, rec) => {
        const done = await (await newsletter()).withdraw(rec.id)
        if (!done.ok) return refuse("not_found")
        return { message: "Unsubscribed. The consent record is kept until its retention date." }
      },
    },
  },
})
