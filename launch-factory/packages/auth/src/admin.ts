// 관리자 서버 액션 몸통(v0 Task 16). 화면은 LF Task 10에서 web-factory 표·상세 블록(A82·A83)으로 짠다 — 여기는 서버만.
// 모든 액션은 먼저 관리자 벽(role=admin + 2단계 인증 켬 + 대리 세션 아님)을 지난다. 아니면 401·403.
// 읽기(목록·상세·CSV)는 여기서 admin_actions 에 남기고, 쓰기(정지·해제·대리 로그인)는 auth.handler 로 보내
// Better Auth 훅(admin-plugin.ts)이 남긴다 — /api/auth/admin/* 를 바로 부르는 길과 같은 규칙·같은 기록이다.
// 이 패키지는 Next 를 불러오지 않는다. 템플릿의 "use server" 파일이 감싼다(Task 10):
//   "use server"; export const listUsers = async (q: unknown) => adminActions(await adminDeps()).listUsers(q)
import { and, asc, count, desc, eq, gt, ilike, isNull, or, type SQL } from "drizzle-orm"
import { z } from "zod"
import type { ActionResult, Subscription } from "@launch-factory/contract"
import { adminActions as adminActionsTable, session as sessionTable, user, type Database } from "@launch-factory/db"
import { DEFAULT_LOCALE, fill, messages, type Locale } from "@launch-factory/i18n"
import type { AuthHandlerLike, AuthIO } from "./adapter.ts"
import { ADMIN_ACTION, adminVerdict, clientIp, isAdminRole, REASON_MAX, writeAdminAction, type AdminActionName } from "./admin-plugin.ts"
import { isPlaceholderEmail } from "./config.ts"
import { seoulDateTime, toCsv, type CsvColumn } from "./csv.ts"
import { formToObject } from "./server-actions.ts"

export * from "./admin-plugin.ts"

// ── 결과 모양 ──────────────────────────────────────────────────────────────────
/** 기계가 읽는 실패 이름. 화면은 formError(메시지 목록 문구)를 보이고, 분기는 code 로 한다 */
export type AdminErrorCode =
  | "unauthenticated"
  | "admin_required"
  | "admin_two_factor_required"
  | "invalid_input"
  | "not_found"
  | "cannot_ban_self"
  | "cannot_impersonate_admin"
  | "reason_required"
  | "not_impersonating"
  | "impersonation_blocked"
  | "export_too_large"
  | "rate_limited"
  | "unavailable"
/** 계약 ActionResult 의 실패 + status·code(billing-paddle protectAction 과 같은 모양) */
export type AdminFailure = { ok: false; status: 400 | 401 | 403 | 404 | 413 | 429 | 500 | 503; code: AdminErrorCode; formError?: string; fieldErrors?: Record<string, string[]>; retryable?: boolean }
export type AdminResult<T> = { ok: true; data: T } | AdminFailure

// ── 목록 질의(표 블록 A82 admin-list 가 보내는 모양) ────────────────────────────
export const ADMIN_SORT_FIELDS = ["createdAt", "email", "name"] as const
export const PAGE_SIZE_DEFAULT = 25
export const PAGE_SIZE_MAX = 100
export const BULK_MAX = 100
export const EXPORT_MAX_ROWS = 10_000

const flag = z.union([z.boolean(), z.enum(["true", "false", "on"])]).transform((v) => v === true || v === "true" || v === "on")
const intLike = (min: number, max: number) => z.coerce.number().int().min(min).max(max)
const filterSchema = z
  .object({
    /** true: 정지된 사람만, false: 정지 안 된 사람만, 없으면 모두 */
    banned: flag.optional(),
    role: z.enum(["admin", "user"]).optional(),
  })
  .strict()
const querySchema = z
  .object({
    /** 이메일·이름 일부(대소문자 무시) 또는 사용자 id 그대로 */
    q: z.string().trim().max(100).optional(),
    filter: filterSchema.optional(),
    sort: z.object({ field: z.enum(ADMIN_SORT_FIELDS), dir: z.enum(["asc", "desc"]) }).strict().optional(),
    page: intLike(1, 1_000_000).optional(),
    pageSize: intLike(1, PAGE_SIZE_MAX).optional(),
  })
  .strict()
export type AdminUserQuery = z.input<typeof querySchema>
export interface NormalizedUserQuery {
  q: string | null
  filter: { banned?: boolean; role?: "admin" | "user" }
  sort: { field: (typeof ADMIN_SORT_FIELDS)[number]; dir: "asc" | "desc" }
  page: number
  pageSize: number
}

const userIdSchema = z.string().trim().min(1).max(200)
const reasonSchema = z.string().trim().max(REASON_MAX)
const byIdSchema = z.object({ userId: userIdSchema }).strict()
const banSchema = z.object({ userId: userIdSchema, reason: reasonSchema.optional(), expiresInSeconds: intLike(60, 10 * 365 * 24 * 3600).optional() }).strict()
const unbanSchema = z.object({ userId: userIdSchema, reason: reasonSchema.optional() }).strict()
const bulkBanSchema = z.object({ userIds: z.array(userIdSchema).min(1).max(BULK_MAX), reason: reasonSchema.optional() }).strict()
const bulkUnbanSchema = z.object({ userIds: z.array(userIdSchema).min(1).max(BULK_MAX), reason: reasonSchema.optional() }).strict()
const impersonateSchema = z.object({ userId: userIdSchema, reason: reasonSchema.min(1) }).strict()
const exportSchema = querySchema.omit({ page: true, pageSize: true })

// ── 돌려주는 모양 ──────────────────────────────────────────────────────────────
/** 표 한 줄. 카카오 대체 주소(…@kakao.invalid)는 이메일이 아니라 null 로 보인다 */
export interface AdminUserRow {
  id: string
  email: string | null
  name: string
  role: string
  isAdmin: boolean
  banned: boolean
  banReason: string | null
  banExpires: string | null
  twoFactorEnabled: boolean
  emailVerified: boolean
  createdAt: string
}
export interface AdminUserPage {
  rows: AdminUserRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** 적용된 질의(기본값을 채운 것) — 표가 정렬·필터 표시를 이것으로 맞춘다 */
  query: NormalizedUserQuery
}
export interface AdminUserDetail {
  user: AdminUserRow
  /** 결제 포트(BillingPort.subscription)에서 읽은 구독 — 읽기 전용. 없거나 못 읽으면 null + subscriptionError */
  subscription: Subscription | null
  subscriptionError?: "billing_not_configured" | "billing_unavailable"
  sessions: { active: number; impersonation: number }
  /** 이 사용자를 대상으로 한 최근 관리자 행동(최신 20개) */
  recentActions: { action: string; adminUserId: string; reason: string | null; occurredAt: string }[]
}
export interface BulkOutcome {
  bulkId: string
  succeeded: string[]
  failed: { userId: string; code: AdminErrorCode }[]
}
export interface CsvFile {
  filename: string
  contentType: "text/csv; charset=utf-8"
  body: string
  rows: number
}

export interface AdminDeps {
  auth: AuthHandlerLike
  db: Database
  io: AuthIO
  /** 상세의 구독 상태(읽기 전용). 템플릿이 결제 포트로 묶는다: (id) => paddle.port({ userId: id }).subscription() */
  subscriptionOf?: (userId: string) => Promise<ActionResult<Subscription>>
  locale?: Locale
  onError?: (error: unknown) => void
  now?: () => Date
}

const FORWARDED_HEADERS = ["cookie", "x-forwarded-for", "x-real-ip", "user-agent", "accept-language"]

export function adminActions({ auth, db, io, subscriptionOf, locale = DEFAULT_LOCALE, onError = (e) => console.error("[auth:admin]", e), now = () => new Date() }: AdminDeps) {
  const AUTH = messages(locale).auth
  const M = AUTH.admin
  const baseURL = String(auth.options.baseURL)
  const basePath = auth.options.basePath ?? "/api/auth"

  const failure = (status: AdminFailure["status"], code: AdminErrorCode, formError?: string, extra: Partial<AdminFailure> = {}): AdminFailure => ({ ok: false, status, code, ...(formError ? { formError } : {}), ...extra })
  const invalid = (error: z.ZodError): AdminFailure => {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of error.issues) fieldErrors[issue.path.map(String).join(".") || "form"] = [AUTH.required]
    return failure(400, "invalid_input", undefined, { fieldErrors })
  }

  /** Better Auth 로 보낸다(요청 제한·출처 검사·훅이 브라우저 요청과 같이 걸린다) */
  async function call(method: "GET" | "POST", path: string, body?: object): Promise<{ status: number; body: Record<string, unknown> | null } | AdminFailure> {
    const incoming = await io.headers()
    const headers = new Headers({ origin: new URL(baseURL).origin })
    for (const name of FORWARDED_HEADERS) {
      const v = incoming.get(name)
      if (v) headers.set(name, v)
    }
    if (body) headers.set("content-type", "application/json")
    let res: Response
    try {
      res = await auth.handler(new Request(new URL(basePath + path, baseURL), { method, headers, body: body ? JSON.stringify(body) : undefined }))
    } catch (e) {
      onError(e)
      return failure(503, "unavailable", AUTH.unavailable, { retryable: true })
    }
    const setCookie = res.headers.getSetCookie()
    if (setCookie.length) await io.setCookies(setCookie)
    if (res.status === 429) return failure(429, "rate_limited", AUTH.tooManyRequests, { retryable: true })
    const parsed: unknown = await res.json().catch(() => null)
    const out = { status: res.status, body: parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null }
    if (res.status >= 500) {
      onError(new Error(`auth ${path} → ${res.status} ${String(out.body?.code ?? "")}`))
      return failure(503, "unavailable", AUTH.unavailable, { retryable: true })
    }
    return out
  }
  const isFailure = (r: unknown): r is AdminFailure => !!r && typeof r === "object" && (r as { ok?: unknown }).ok === false

  /** Better Auth 오류 코드 → 관리자 실패 */
  function toFailure(r: { status: number; body: Record<string, unknown> | null }): AdminFailure {
    const code = String(r.body?.code ?? "")
    if (r.status === 401) return failure(401, "unauthenticated", AUTH.signInRequired)
    if (code === "ADMIN_TWO_FACTOR_REQUIRED") return failure(403, "admin_two_factor_required", M.twoFactorRequired)
    if (code === "IMPERSONATION_BLOCKED") return failure(403, "impersonation_blocked", AUTH.impersonationBlocked)
    if (code === "YOU_CANNOT_IMPERSONATE_ADMINS") return failure(403, "cannot_impersonate_admin", M.cannotImpersonateAdmin)
    if (code === "YOU_CANNOT_BAN_YOURSELF") return failure(400, "cannot_ban_self", M.cannotBanSelf)
    if (code === "IMPERSONATION_REASON_REQUIRED") return failure(400, "reason_required", M.reasonRequired, { fieldErrors: { reason: [M.reasonRequired] } })
    if (code === "USER_NOT_FOUND" || r.status === 404) return failure(404, "not_found", M.notFound)
    if (r.status === 403) return failure(403, "admin_required", M.adminRequired)
    onError(new Error(`auth admin response ${r.status} ${code}`))
    return failure(400, "invalid_input", AUTH.failed)
  }

  /** 관리자 벽. 통과하면 관리자 id 와 요청 IP */
  async function requireAdmin(): Promise<{ adminId: string; ip: string | null } | AdminFailure> {
    const r = await call("GET", "/get-session")
    if (isFailure(r)) return r
    const verdict = adminVerdict(r.status === 200 ? (r.body as { user?: Record<string, unknown>; session?: Record<string, unknown> } | null) : null)
    if (!verdict.ok) {
      if (verdict.status === 401) return failure(401, "unauthenticated", AUTH.signInRequired)
      return verdict.code === "ADMIN_TWO_FACTOR_REQUIRED" ? failure(403, "admin_two_factor_required", M.twoFactorRequired) : failure(403, "admin_required", M.adminRequired)
    }
    return { adminId: verdict.adminId, ip: clientIp(await io.headers()) }
  }

  /** 읽기 기록. 못 남기면 데이터를 돌려주지 않는다 */
  async function audit(admin: { adminId: string; ip: string | null }, action: AdminActionName, targetUserId: string | null, meta: Record<string, unknown>): Promise<AdminFailure | null> {
    try {
      await writeAdminAction(db, { adminUserId: admin.adminId, action, targetUserId, ipAddress: admin.ip, meta })
      return null
    } catch (e) {
      onError(e)
      return failure(503, "unavailable", AUTH.failed, { retryable: true })
    }
  }

  const parse = <S extends z.ZodType>(schema: S, input: unknown): z.infer<S> | AdminFailure => {
    const p = schema.safeParse(formToObject(input) ?? {})
    return p.success ? p.data : invalid(p.error)
  }

  function normalize(q: z.infer<typeof querySchema>): NormalizedUserQuery {
    return { q: q.q || null, filter: { ...q.filter }, sort: q.sort ?? { field: "createdAt", dir: "desc" }, page: q.page ?? 1, pageSize: q.pageSize ?? PAGE_SIZE_DEFAULT }
  }

  function whereOf(q: NormalizedUserQuery): SQL | undefined {
    const parts: (SQL | undefined)[] = []
    if (q.q) {
      const pattern = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      parts.push(or(ilike(user.email, pattern), ilike(user.name, pattern), eq(user.id, q.q)))
    }
    if (q.filter.banned === true) parts.push(eq(user.banned, true))
    if (q.filter.banned === false) parts.push(or(eq(user.banned, false), isNull(user.banned)))
    if (q.filter.role === "admin") parts.push(eq(user.role, "admin"))
    if (q.filter.role === "user") parts.push(or(eq(user.role, "user"), isNull(user.role)))
    return and(...parts)
  }

  /** 정렬 + id 로 끝을 묶는다 — 정렬 값이 같은 행(같은 가입 시각·같은 이름)도 쪽마다 순서가 같다(쪽 사이 빠짐·겹침 없음) */
  function orderOf(q: NormalizedUserQuery) {
    const col = q.sort.field === "email" ? user.email : q.sort.field === "name" ? user.name : user.createdAt
    const dir = q.sort.dir === "asc" ? asc : desc
    return [dir(col), dir(user.id)]
  }

  const rowOf = (u: typeof user.$inferSelect): AdminUserRow => ({
    id: u.id,
    email: isPlaceholderEmail(u.email) ? null : u.email,
    name: u.name,
    role: u.role ?? "user",
    isAdmin: isAdminRole(u.role),
    banned: u.banned === true,
    banReason: u.banReason ?? null,
    banExpires: u.banExpires ? new Date(u.banExpires).toISOString() : null,
    twoFactorEnabled: u.twoFactorEnabled === true,
    emailVerified: u.emailVerified,
    createdAt: new Date(u.createdAt).toISOString(),
  })

  /** 쓰기: Better Auth admin 경로로 보낸다. 기록은 훅이 남긴다 */
  async function adminPost(path: string, body: Record<string, unknown>): Promise<AdminResult<Record<string, unknown>>> {
    const r = await call("POST", path, { ...body, via: "server-action" })
    if (isFailure(r)) return r
    return r.status === 200 ? { ok: true, data: r.body ?? {} } : toFailure(r)
  }

  /** 관리자 벽을 지난 뒤에만 부른다. 사람마다 Better Auth 경로를 지나므로 사람마다 벽·기록이 다시 걸린다 */
  async function bulk(path: "/admin/ban-user" | "/admin/unban-user", userIds: string[], extra: Record<string, unknown>): Promise<AdminResult<BulkOutcome>> {
    const bulkId = crypto.randomUUID()
    const out: BulkOutcome = { bulkId, succeeded: [], failed: [] }
    // 한 명씩(Better Auth 는 일괄 경로가 없다). 한 명이 실패해도 나머지를 계속하고, 결과에 사람마다 적는다.
    for (const userId of [...new Set(userIds)]) {
      const r = await adminPost(path, { userId, bulkId, ...extra })
      if (r.ok) out.succeeded.push(userId)
      else out.failed.push({ userId, code: r.code })
    }
    return { ok: true, data: out }
  }

  return {
    /** 사용자 목록: 검색·필터·정렬·쪽. 쪽 번호 방식(A82 「쪽」) — 정렬 값이 같아도 id 로 순서를 묶어 안정적이다 */
    async listUsers(input: unknown = {}): Promise<AdminResult<AdminUserPage>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const parsed = parse(querySchema, input)
      if (isFailure(parsed)) return parsed
      const q = normalize(parsed)
      const where = whereOf(q)
      const [{ n }] = await db.select({ n: count() }).from(user).where(where)
      const rows = await db
        .select()
        .from(user)
        .where(where)
        .orderBy(...orderOf(q))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize)
      // 검색어(이메일일 수 있다)는 기록에 싣지 않는다 — 대상이 정해지는 상세 보기가 대상 id 를 남긴다.
      const logged = await audit(admin, ADMIN_ACTION.userList, null, { hasQuery: !!q.q, filter: q.filter, sort: q.sort, page: q.page, pageSize: q.pageSize, total: n })
      if (logged) return logged
      return { ok: true, data: { rows: rows.map(rowOf), total: n, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(n / q.pageSize)), query: q } }
    },

    /** 사용자 한 명: 계정 칸 + 구독 상태(결제 포트, 읽기 전용) + 세션 수 + 최근 관리자 행동 */
    async userDetail(input: unknown): Promise<AdminResult<AdminUserDetail>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const parsed = parse(byIdSchema, input)
      if (isFailure(parsed)) return parsed
      const [u] = await db.select().from(user).where(eq(user.id, parsed.userId))
      if (!u) return failure(404, "not_found", M.notFound)
      let subscription: Subscription | null = null
      let subscriptionError: AdminUserDetail["subscriptionError"]
      if (!subscriptionOf) subscriptionError = "billing_not_configured"
      else {
        const s = await subscriptionOf(u.id).catch((e: unknown) => {
          onError(e)
          return null
        })
        if (s?.ok) subscription = s.data
        else subscriptionError = "billing_unavailable"
      }
      const at = now()
      const sessions = await db.select({ impersonatedBy: sessionTable.impersonatedBy }).from(sessionTable).where(and(eq(sessionTable.userId, u.id), gt(sessionTable.expiresAt, at)))
      const actions = await db.select().from(adminActionsTable).where(eq(adminActionsTable.targetUserId, u.id)).orderBy(desc(adminActionsTable.occurredAt), desc(adminActionsTable.id)).limit(20)
      const logged = await audit(admin, ADMIN_ACTION.userView, u.id, {})
      if (logged) return logged
      return {
        ok: true,
        data: {
          user: rowOf(u),
          subscription,
          ...(subscriptionError ? { subscriptionError } : {}),
          sessions: { active: sessions.filter((s) => !s.impersonatedBy).length, impersonation: sessions.filter((s) => !!s.impersonatedBy).length },
          recentActions: actions.map((a) => ({ action: a.action, adminUserId: a.adminUserId, reason: a.reason, occurredAt: a.occurredAt.toISOString() })),
        },
      }
    },

    /** 정지(모든 세션이 끊기고 로그인이 막힌다). expiresInSeconds 가 없으면 풀 때까지 */
    async banUser(input: unknown): Promise<AdminResult<{ userId: string }>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const p = parse(banSchema, input)
      if (isFailure(p)) return p
      const r = await adminPost("/admin/ban-user", { userId: p.userId, banReason: p.reason || undefined, banExpiresIn: p.expiresInSeconds })
      return r.ok ? { ok: true, data: { userId: p.userId } } : r
    },

    async unbanUser(input: unknown): Promise<AdminResult<{ userId: string }>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const p = parse(unbanSchema, input)
      if (isFailure(p)) return p
      const r = await adminPost("/admin/unban-user", { userId: p.userId, reason: p.reason || undefined })
      return r.ok ? { ok: true, data: { userId: p.userId } } : r
    },

    /** 일괄 정지(표의 체크 열 — 최대 100명, 사람마다 결과). 되돌리기는 bulkUnban 에 같은 id 들 */
    async bulkBan(input: unknown): Promise<AdminResult<BulkOutcome>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const p = parse(bulkBanSchema, input)
      if (isFailure(p)) return p
      return bulk("/admin/ban-user", p.userIds, { banReason: p.reason || undefined })
    },

    async bulkUnban(input: unknown): Promise<AdminResult<BulkOutcome>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const p = parse(bulkUnbanSchema, input)
      if (isFailure(p)) return p
      return bulk("/admin/unban-user", p.userIds, { reason: p.reason || undefined })
    },

    /**
     * 대리 로그인 시작(사유 필수). 성공하면 이 브라우저의 세션이 대상 사용자의 대리 세션(기본 1시간)으로 바뀌고,
     * 관리자 세션은 admin_session 쿠키에 보관된다. 화면은 session().impersonatedBy 로 「대리 로그인 중」 띠를 띄운다.
     */
    async impersonate(input: unknown): Promise<AdminResult<{ userId: string; expiresAt: string | null }>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const p = parse(impersonateSchema, input)
      if (isFailure(p)) return p.fieldErrors?.reason ? failure(400, "reason_required", M.reasonRequired, { fieldErrors: { reason: [M.reasonRequired] } }) : p
      const r = await adminPost("/admin/impersonate-user", { userId: p.userId, reason: p.reason })
      if (!r.ok) return r
      const s = r.data.session as { expiresAt?: string } | undefined
      return { ok: true, data: { userId: p.userId, expiresAt: s?.expiresAt ? new Date(s.expiresAt).toISOString() : null } }
    },

    /** 대리 로그인 끝내기 — 관리자 벽이 없다(대리 세션 = 대상 사용자의 세션에서 부른다). 관리자 세션으로 돌아간다 */
    async stopImpersonating(): Promise<AdminResult<{ adminUserId: string }>> {
      const r = await call("POST", "/admin/stop-impersonating", {})
      if (isFailure(r)) return r
      if (r.status === 400) return failure(400, "not_impersonating", M.notImpersonating)
      if (r.status !== 200) return toFailure(r)
      return { ok: true, data: { adminUserId: String((r.body?.user as { id?: string } | undefined)?.id ?? "") } }
    },

    /** 사용자 CSV(대장 D90 — BOM·수식 무력화·서울 시각). 목록과 같은 검색·필터·정렬. 최대 EXPORT_MAX_ROWS 행, 넘으면 413 */
    async exportUsersCsv(input: unknown = {}): Promise<AdminResult<CsvFile>> {
      const admin = await requireAdmin()
      if (isFailure(admin)) return admin
      const parsed = parse(exportSchema, input)
      if (isFailure(parsed)) return parsed
      const q = normalize(parsed)
      const where = whereOf(q)
      const [{ n }] = await db.select({ n: count() }).from(user).where(where)
      if (n > EXPORT_MAX_ROWS) return failure(413, "export_too_large", fill(M.exportTooLarge, { max: EXPORT_MAX_ROWS }))
      const rows = (await db.select().from(user).where(where).orderBy(...orderOf(q))).map(rowOf)
      const logged = await audit(admin, ADMIN_ACTION.userExport, null, { hasQuery: !!q.q, filter: q.filter, sort: q.sort, rows: rows.length })
      if (logged) return logged
      const C = M.csv
      const yesNo = (b: boolean) => (b ? C.yes : C.no)
      const columns: CsvColumn<AdminUserRow>[] = [
        { header: C.id, value: (r) => r.id },
        { header: C.email, value: (r) => r.email },
        { header: C.name, value: (r) => r.name },
        { header: C.role, value: (r) => r.role },
        { header: C.banned, value: (r) => yesNo(r.banned) },
        { header: C.banReason, value: (r) => r.banReason },
        { header: C.twoFactor, value: (r) => yesNo(r.twoFactorEnabled) },
        { header: C.emailVerified, value: (r) => yesNo(r.emailVerified) },
        { header: C.createdAt, value: (r) => new Date(r.createdAt) },
      ]
      const stamp = seoulDateTime(now()).replace(/[-:]/g, "").replace(" ", "-").slice(0, 13)
      return { ok: true, data: { filename: `users-${stamp}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(rows, columns), rows: rows.length } }
    },
  }
}
export type AdminActions = ReturnType<typeof adminActions>

// ── 대리 로그인 중 막기(결제·탈퇴처럼 Better Auth 경로를 지나지 않는 서버 액션) ────────────
/** 결제 포트에서 대리 로그인 중에도 부를 수 있는 것(읽기만). 나머지 메서드는 모두 막는다 — 새 메서드도 기본으로 막힌다 */
export const BILLING_READS = ["plans", "subscription"] as const

/**
 * 대리 세션이면 allow 밖의 메서드를 부르지 않고 403 impersonation_blocked 로 끝내는 포트를 돌려준다. 아니면 그대로.
 * 템플릿(Task 10): billing = blockWhileImpersonating(paddle.port({ userId }), session, BILLING_READS) — 청약철회 동의 감싸기보다 바깥에 둔다
 * (막힌 결제에 동의 기록이 남지 않게).
 */
export function blockWhileImpersonating<T extends object>(port: T, session: { impersonatedBy?: string | null } | null | undefined, allow: readonly PropertyKey[], locale: Locale = DEFAULT_LOCALE): T {
  if (!session?.impersonatedBy) return port
  const blocked: AdminFailure = { ok: false, status: 403, code: "impersonation_blocked", formError: messages(locale).auth.impersonationBlocked }
  return new Proxy(port, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver)
      if (typeof value !== "function") return value
      if (allow.includes(key)) return (value as (...a: unknown[]) => unknown).bind(target)
      return async () => ({ ...blocked })
    },
  })
}
