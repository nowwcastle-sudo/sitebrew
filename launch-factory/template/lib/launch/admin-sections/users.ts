// launch-factory: 관리 화면 구획 — 사용자(계획 3d). 관리자만 들어온다(역할 admin + 2단계 인증 + 정지 아님 + 대리 세션 아님 — 콘솔이 먼저 판정한다).
// 구획은 선언이다 — 접근 벽·확인 입력 벽·기록·연락처 가리기는 콘솔(@launch-factory/admin-console)이 한다. 등록은 lib/launch/admin-console.ts 의 ADMIN_SECTIONS 한 줄.
// 읽고 쓰는 일은 인증 패키지의 관리자 서비스(adminActions)를 직접 부른다 — 그 서비스는 자기 관리자 벽(세션 쿠키로 다시 판정)과 기록(admin_actions)을 가진다(두 겹).
// 이 구획 밖으로 AdminResult 의 코드(admin_required · unauthenticated …)가 새지 않게 아래 refusalOf 한 곳에서 콘솔의 거절 코드로 옮긴다.
// 보이는 것: 표(이메일·이름은 가려서, 역할·정지 여부·2단계 여부·가입일) → 기록(계정 칸 + 세션 수 + 최근 관리자 행동). 비밀번호 해시·세션 토큰·소셜 토큰은 읽지도 않는다.
// 행동: 정지(ban, 위험 — 모든 세션이 끊기고 로그인이 막힌다) · 해제(unban). 정지 사유·기한은 입력을 받지 않는다(기록 행동 단추는 입력을 못 싣는다) — 풀 때까지 정지다.
// 대리 로그인·일괄 정지·CSV 는 콘솔에 없다(feature-admin 의 서버 액션이 맡는다). 정지는 두 입구(이 구획 · feature-admin 의 banUser)가 같은 벽을 지난다 — 인증 서비스가 `confirmed: true` 없이는 실행하지 않는다.
import { adminActions, type AdminActions, type AdminErrorCode, type AdminFailure, type AdminUserDetail, type AdminUserRow } from "@launch-factory/auth"
import { defineSection, refuse, type Refusal } from "@launch-factory/admin-console"
import { authIO, getAuth } from "@/lib/launch/auth"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { AUTH_FEATURES } from "@/lib/launch/features"

const STATUSES = ["active", "banned"] as const
/** 인증 서비스의 한 쪽 최대 줄 수(PAGE_SIZE_MAX) */
const MAX_ROWS = 100

/** 인증 서비스의 실패 코드 → 콘솔의 거절 코드. 이 표 밖(새 코드)이 생기면 타입 검사가 여기서 멈춘다 */
const CODES = {
  unauthenticated: "sign_in_required",
  admin_required: "forbidden",
  admin_two_factor_required: "two_factor_required",
  impersonation_blocked: "impersonation_blocked",
  invalid_input: "invalid_input",
  reason_required: "invalid_input",
  export_too_large: "invalid_input",
  not_found: "not_found",
  cannot_ban_self: "invalid_state",
  confirmation_required: "confirmation_required",
  cannot_impersonate_admin: "invalid_state",
  not_impersonating: "invalid_state",
  rate_limited: "action_failed",
  unavailable: "provider_unavailable",
} as const satisfies Record<AdminErrorCode, string>

/** 문구는 인증 서비스가 고정 글로 만든 것(DB 글·개인정보 없음)이라 사람이 읽을 이유가 있는 두 갈래만 싣는다 */
const refusalOf = (f: AdminFailure): Refusal => {
  const code = CODES[f.code]
  return code === "invalid_state" || code === "action_failed" ? refuse(code, f.formError ? { formError: f.formError } : {}) : refuse(code)
}

/** 인증 서비스: 요청마다 만든다(세션 쿠키·머리는 요청 것). 관리자 조각이 꺼져 있으면 provider_unavailable */
async function service(): Promise<AdminActions> {
  return adminActions({ auth: await getAuth(), db: await database(), io: await authIO(), locale: DEFAULT_LOCALE })
}

const yesNo = (v: boolean): string => (v ? "on" : "off")
const day = (iso: string | null): string | null => (iso ? iso.slice(0, 10) : null)
const stamp = (iso: string | null, none = "—"): string => (iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : none)

export default defineSection({
  id: "users",
  part: "auth",
  label: "Users",
  audience: "admin",
  available: () => AUTH_FEATURES.admin && AUTH_FEATURES.twoFactor,
  statuses: STATUSES,
  serverSearch: true, // 서버 검색이 가린 이메일·이름·번호를 맞춘다(listUsers q — 이메일·이름·번호)
  columns: [
    { id: "email", label: "Email", kind: "contact", primary: true },
    { id: "name", label: "Name", kind: "contact", secondary: true },
    { id: "role", label: "Role", kind: "text" },
    { id: "status", label: "Status", kind: "status", filter: true },
    { id: "twoFactor", label: "2-step", kind: "text", secondary: true },
    { id: "createdAt", label: "Joined", kind: "date", secondary: true },
  ],
  pageSize: MAX_ROWS,
  list: async (_actor, { search, status, limit, offset }) => {
    const size = Math.min(limit, MAX_ROWS)
    const r = await (await service()).listUsers({ ...(search ? { q: search } : {}), ...(status ? { filter: { banned: status === "banned" } } : {}), page: Math.floor(offset / size) + 1, pageSize: size })
    return r.ok ? { items: r.data.rows, total: r.data.total } : refusalOf(r)
  },
  key: (row: AdminUserRow) => row.id,
  cells: (row) => ({ email: row.email, name: row.name, role: row.role, status: row.banned ? "banned" : "active", twoFactor: yesNo(row.twoFactorEnabled), createdAt: day(row.createdAt) }),
  load: async (_actor, id): Promise<AdminUserDetail | null | Refusal> => {
    const r = await (await service()).userDetail({ userId: id })
    if (r.ok) return r.data
    return r.code === "not_found" ? null : refusalOf(r)
  },
  view: ({ user, sessions, recentActions }) => ({
    // 제목은 주소·화면 머리에 그대로 나가므로 이메일·이름 대신 사용자 번호 앞자리를 쓴다
    title: `User ${user.id.slice(0, 8)}`,
    summary: [
      { label: "Email", value: user.email ?? "(none — social sign-in)" },
      { label: "Name", value: user.name },
      { label: "Role", value: user.role },
      { label: "Status", value: user.banned ? "banned" : "active", kind: "status" },
      ...(user.banned ? [{ label: "Ban reason", value: user.banReason ?? "—" }, { label: "Ban ends", value: stamp(user.banExpires, "Until lifted") }] : []),
      { label: "2-step sign-in", value: yesNo(user.twoFactorEnabled) },
      { label: "Email verified", value: user.emailVerified ? "yes" : "no" },
      { label: "Joined", value: stamp(user.createdAt) },
      { label: "Active sessions", value: String(sessions.active), kind: "numeric" },
      { label: "Impersonation sessions", value: String(sessions.impersonation), kind: "numeric" },
      ...recentActions.slice(0, 5).map((a) => ({ label: "Admin action", value: `${a.action} · ${stamp(a.occurredAt)}` })),
    ],
  }),
  actions: {
    ban: {
      label: "Ban user",
      danger: true,
      adminOnly: true,
      when: ({ user }) => !user.banned,
      run: async (_actor, { user }) => {
        const r = await (await service()).banUser({ userId: user.id, confirmed: true }) // 콘솔의 확인 벽(danger)을 지난 뒤라 서비스의 확인 벽에도 확인을 싣는다
        return r.ok ? { message: "User banned. All sessions were ended." } : refusalOf(r)
      },
    },
    unban: {
      label: "Lift ban",
      adminOnly: true,
      when: ({ user }) => user.banned,
      run: async (_actor, { user }) => {
        const r = await (await service()).unbanUser({ userId: user.id })
        return r.ok ? { message: "Ban lifted." } : refusalOf(r)
      },
    },
  },
})
