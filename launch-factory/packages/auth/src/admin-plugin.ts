// 관리자 벽 + 관리자 행동 기록 + 대리 로그인 중 막기(v0 Task 16). Better Auth 플러그인 하나로 건다.
// 서버 액션(admin.ts)만 막으면 부족하다: 템플릿은 auth.handler 를 /api/auth/* 에 그대로 연다(Task 4) — 그 길로
// /admin/* 를 바로 불러도 같은 규칙이 걸려야 한다. 그래서 규칙은 여기(모든 경로가 지나는 훅)에 두고, 서버 액션은 이 경로로 보낸다.
//
// 1. /admin/* : 허용 목록(ban·unban·impersonate·stop) 밖은 403. 허용된 것도 role=admin + 2단계 인증 켬이 아니면 403.
//    stop-impersonating 은 예외 — 대리 세션(대상 사용자의 세션)에서 부르므로 관리자 검사를 하지 않는다(플러그인이 impersonatedBy 로 검사한다).
// 2. 대리 로그인 세션(session.impersonatedBy)에서는 비밀번호·이메일·2단계·탈퇴·세션 끊기·소셜 연결 경로를 403 으로 막는다.
// 3. 성공한 ban·unban·impersonate 시작·stop(또는 대리 세션의 로그아웃)을 admin_actions 에 남긴다(누가·누구를·무엇을·언제·IP).
//    대리 로그인 시작은 기록을 못 남기면 만든 대리 세션을 지우고 실패로 끝낸다(기록 없는 대리 로그인을 남기지 않는다).
import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { eq } from "drizzle-orm"
import { adminActions, session as sessionTable, type Database } from "@launch-factory/db"

/** admin_actions.action 값 */
export const ADMIN_ACTION = {
  userList: "user_list",
  userView: "user_view",
  userExport: "user_export",
  ban: "ban",
  unban: "unban",
  impersonateStart: "impersonate_start",
  impersonateStop: "impersonate_stop",
} as const
export type AdminActionName = (typeof ADMIN_ACTION)[keyof typeof ADMIN_ACTION]

/** 관리자 역할 이름(Better Auth admin 플러그인 adminRoles) */
export const ADMIN_ROLE = "admin"

/** 열어 둔 Better Auth admin 경로. 나머지(create-user·remove-user·set-role·set-user-password·list-users…)는 403 — v0 범위 밖(대장 D3) */
export const ADMIN_ENDPOINTS_ALLOWED: readonly string[] = ["/admin/ban-user", "/admin/unban-user", "/admin/impersonate-user", "/admin/stop-impersonating"]

/**
 * 대리 로그인 세션에서 막는 Better Auth 경로: 자격 증명(비밀번호·이메일·2단계·소셜 연결), 탈퇴, 본인 세션 끊기, 조직 지우기.
 * 결제·셀프 탈퇴 서버 액션은 이 경로를 지나지 않으므로 admin.ts 의 blockWhileImpersonating·어댑터가 따로 막는다.
 */
export const IMPERSONATION_BLOCKED_PATHS: readonly string[] = [
  "/change-password",
  "/set-password",
  "/change-email",
  "/delete-user",
  "/delete-user/callback",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/link-social",
  "/unlink-account",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/organization/delete",
]

/** 대리 로그인 사유 길이 상한 */
export const REASON_MAX = 500

export const isAdminRole = (role: unknown): boolean => typeof role === "string" && role.split(",").some((r) => r.trim() === ADMIN_ROLE)

/**
 * 요청한 사람의 IP: x-forwarded-for 의 첫 값, 없으면 x-real-ip. 믿을 수 있는 머리인지는 배포 환경이 정한다(Vercel 은 덮어쓴다 — 대장 D31).
 * 머리 모양만 보고 45자(IPv6 최대)를 넘으면 버린다.
 */
export function clientIp(headers: Headers | null | undefined): string | null {
  const raw = headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip")?.trim() || ""
  return raw && raw.length <= 45 ? raw : null
}

/** 관리자 판정. 서버 액션(admin.ts)과 훅이 같은 판정을 쓴다 */
export type AdminVerdict = { ok: true; adminId: string } | { ok: false; status: 401 | 403; code: "UNAUTHORIZED" | "ADMIN_REQUIRED" | "ADMIN_TWO_FACTOR_REQUIRED" }
export function adminVerdict(s: { user?: Record<string, unknown> | null; session?: Record<string, unknown> | null } | null | undefined): AdminVerdict {
  if (!s?.user || !s.session) return { ok: false, status: 401, code: "UNAUTHORIZED" }
  // 대리 세션의 주인은 대상 사용자다 — 관리자라도 대리 세션으로는 관리자 기능을 쓰지 않는다.
  if (s.session.impersonatedBy || !isAdminRole(s.user.role) || s.user.banned === true) return { ok: false, status: 403, code: "ADMIN_REQUIRED" }
  if (s.user.twoFactorEnabled !== true) return { ok: false, status: 403, code: "ADMIN_TWO_FACTOR_REQUIRED" }
  return { ok: true, adminId: String(s.user.id) }
}

export interface AdminLogRow {
  adminUserId: string
  action: AdminActionName
  targetUserId?: string | null
  ipAddress?: string | null
  reason?: string | null
  meta?: Record<string, unknown> | null
}
export async function writeAdminAction(db: Database, row: AdminLogRow): Promise<void> {
  await db.insert(adminActions).values({ adminUserId: row.adminUserId, action: row.action, targetUserId: row.targetUserId ?? null, ipAddress: row.ipAddress ?? null, reason: row.reason ?? null, meta: row.meta ?? null })
}

/** 앞 훅이 뒤 훅에 넘기는 기록 초안. ctx.context 는 요청마다 새로 만든 객체라(dispatch.mjs) 요청끼리 섞이지 않는다 */
type Pending = Omit<AdminLogRow, "action"> & { action?: AdminActionName }
const PENDING = "lfAdminPending"

const text = (v: unknown, max = REASON_MAX): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)
const bodyOf = (ctx: { body?: unknown }): Record<string, unknown> => (ctx.body && typeof ctx.body === "object" ? (ctx.body as Record<string, unknown>) : {})

export interface AdminPluginOptions {
  db: Database
  onError?: (error: unknown) => void
}

export function lfAdminPlugin({ db, onError = (e) => console.error("[auth:admin]", e) }: AdminPluginOptions): BetterAuthPlugin {
  const watched = (path: string | undefined) => !!path && (path.startsWith("/admin/") || IMPERSONATION_BLOCKED_PATHS.includes(path) || path === "/sign-out")
  return {
    id: "lf-admin",
    hooks: {
      before: [
        {
          matcher: (ctx) => watched(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const path = ctx.path
            const s = (await getSessionFromCtx(ctx).catch(() => null)) as { user: Record<string, unknown>; session: Record<string, unknown> } | null
            const impersonatedBy = typeof s?.session?.impersonatedBy === "string" ? s.session.impersonatedBy : null
            const ip = clientIp(ctx.headers ?? ctx.request?.headers)
            const stash = (p: Pending) => Object.assign(ctx.context, { [PENDING]: p })

            if (IMPERSONATION_BLOCKED_PATHS.includes(path)) {
              if (impersonatedBy) throw new APIError("FORBIDDEN", { code: "IMPERSONATION_BLOCKED", message: "Not allowed while impersonating" })
              return
            }
            // 대리 세션을 로그아웃으로 끝내도 종료를 남긴다(stop 을 누르지 않고 나가는 경우).
            if (path === "/sign-out" || path === "/admin/stop-impersonating") {
              if (impersonatedBy && s) stash({ action: ADMIN_ACTION.impersonateStop, adminUserId: impersonatedBy, targetUserId: String(s.user.id), ipAddress: ip, meta: { via: path === "/sign-out" ? "sign-out" : "stop" } })
              return
            }
            if (!ADMIN_ENDPOINTS_ALLOWED.includes(path)) throw new APIError("FORBIDDEN", { code: "ADMIN_ENDPOINT_DISABLED", message: "This admin endpoint is disabled" })
            const verdict = adminVerdict(s)
            if (!verdict.ok) throw new APIError(verdict.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", { code: verdict.code, message: verdict.code })
            const body = bodyOf(ctx)
            const targetUserId = text(body.userId, 200)
            const meta: Record<string, unknown> = { via: typeof body.via === "string" ? text(body.via, 40) : "http" }
            if (typeof body.bulkId === "string") meta.bulkId = text(body.bulkId, 64)
            if (path === "/admin/impersonate-user") {
              const reason = text(body.reason)
              if (!reason) throw new APIError("BAD_REQUEST", { code: "IMPERSONATION_REASON_REQUIRED", message: "A reason is required" })
              stash({ action: ADMIN_ACTION.impersonateStart, adminUserId: verdict.adminId, targetUserId, ipAddress: ip, reason, meta })
            } else if (path === "/admin/ban-user") {
              if (typeof body.banExpiresIn === "number") meta.banExpiresIn = body.banExpiresIn
              stash({ action: ADMIN_ACTION.ban, adminUserId: verdict.adminId, targetUserId, ipAddress: ip, reason: text(body.banReason), meta })
            } else if (path === "/admin/unban-user") {
              stash({ action: ADMIN_ACTION.unban, adminUserId: verdict.adminId, targetUserId, ipAddress: ip, reason: text(body.reason), meta })
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => watched(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const pending = (ctx.context as unknown as Record<string, Pending | undefined>)[PENDING]
            if (!pending?.action) return
            if (ctx.context.returned instanceof Error) return // 실패한 행동은 남기지 않는다(일어나지 않았다)
            const row = { ...pending, action: pending.action }
            if (row.action === ADMIN_ACTION.impersonateStart) {
              const created = ctx.context.newSession?.session as { token?: string; expiresAt?: Date; impersonatedBy?: string } | undefined
              row.meta = { ...row.meta, expiresAt: created?.expiresAt ? new Date(created.expiresAt).toISOString() : null }
              try {
                await writeAdminAction(db, row)
              } catch (e) {
                // 기록 없는 대리 로그인을 남기지 않는다: 방금 만든 대리 세션을 지우고 실패로 끝낸다.
                if (created?.token) await db.delete(sessionTable).where(eq(sessionTable.token, created.token)).catch(onError)
                onError(e)
                throw new APIError("INTERNAL_SERVER_ERROR", { code: "ADMIN_AUDIT_FAILED", message: "Could not record the admin action" })
              }
              return
            }
            // 정지·해제·종료는 이미 일어났다 — 기록 실패는 알리고 결과는 그대로 둔다(종료를 막지 않는다).
            await writeAdminAction(db, row).catch(onError)
          }),
        },
      ],
    },
  }
}
