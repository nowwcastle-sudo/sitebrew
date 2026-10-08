// 요금제 권한 서버 검사(계획 개정 — gap-audit). 결제 벽 화면만 있으면 서버 액션·경로를 직접 불러 우회할 수 있다.
// 그래서 유료 기능의 서버 쪽 입구마다 requireEntitlement 를 부른다: DB 구독 상태 → 요금제 권한표(PaddlePlan.entitlements) 순서로 본다.
// 웹훅이 늦어도 Paddle 상태가 DB 에 들어와야 권한이 바뀐다 — 화면 상태나 클라이언트가 보낸 값을 믿지 않는다.
import type { Database } from "@launch-factory/db"
import { liveRowOf } from "./adapter.ts"
import { graceEndsAtOf, PAST_DUE_GRACE_MS } from "./map.ts"
import { PROVIDER } from "./map.ts"

/** 권한표만 보는 요금제 모양(Paddle·Gumroad 요금제가 모두 맞는다) */
export interface EntitledPlan {
  id: string
  entitlements?: readonly string[]
}

/**
 * 늘 권한을 주는 구독 상태. past_due 는 여기 없다 — 유예(pastDueGraceMs, 기본 7일) 안에서만 권한을 준다(대장 D57, 2026-09-30 운영자 판정).
 * Task 5 는 past_due 를 여기 넣어 Paddle 재시도 기간 내내 권한을 줬다.
 */
export const DEFAULT_GRANT_STATUSES = ["trialing", "active"] as const

export interface EntitlementOptions {
  db: Database
  plans: readonly EntitledPlan[]
  /** 구독 표의 provider(기본 paddle). 대비 어댑터(billing-gumroad)는 "gumroad" */
  provider?: string
  /** 구독이 없는(무료) 사용자에게 주는 기능 */
  freeEntitlements?: readonly string[]
  grantStatuses?: readonly string[]
  /** past_due 가 시작된 뒤 유료 기능을 유지하는 시간(ms). 기본 7일, 0 이면 바로 막는다 */
  pastDueGraceMs?: number
  now?: () => Date
}

export class EntitlementError extends Error {
  readonly status: 401 | 403
  readonly code: "unauthenticated" | "entitlement_required"
  readonly feature: string
  constructor(status: 401 | 403, feature: string) {
    super(status === 401 ? "Sign in to use this feature." : `Your plan does not include ${feature}.`)
    this.name = "EntitlementError"
    this.status = status
    this.code = status === 401 ? "unauthenticated" : "entitlement_required"
    this.feature = feature
  }
}

/**
 * 권한이 있으면 { planId }(무료면 null, 결제 실패 유예 중이면 graceEndsAt 도), 없으면 EntitlementError(403, 로그인 안 했으면 401)를 던진다.
 * 유예가 끝나도 막는 것은 유료 기능뿐이다 — 데이터는 지우지 않고, 무료 기능(freeEntitlements)은 그대로 준다.
 */
export async function requireEntitlement(
  session: { userId: string } | null | undefined,
  feature: string,
  opts: EntitlementOptions,
): Promise<{ planId: string | null; graceEndsAt?: string }> {
  if (!session?.userId) throw new EntitlementError(401, feature)
  const grant = opts.grantStatuses ?? DEFAULT_GRANT_STATUSES
  const row = await liveRowOf(opts.db, session.userId, opts.provider ?? PROVIDER)
  if (row) {
    const grace = graceEndsAtOf(row, opts.pastDueGraceMs ?? PAST_DUE_GRACE_MS)
    const inGrace = !!grace && (opts.now ?? (() => new Date()))().getTime() < grace.getTime()
    if (grant.includes(row.status) || inGrace) {
      const plan = opts.plans.find((p) => p.id === row.planId)
      if (plan?.entitlements?.includes(feature)) return inGrace && grace ? { planId: row.planId, graceEndsAt: grace.toISOString() } : { planId: row.planId }
    }
  }
  if (opts.freeEntitlements?.includes(feature)) return { planId: null }
  throw new EntitlementError(403, feature)
}

/** 경로 처리기용: 권한이 없으면 401·403 응답, 있으면 처리기를 부른다 */
export function withEntitlement(
  feature: string,
  opts: EntitlementOptions & { session: (req: Request) => Promise<{ userId: string } | null> },
  handler: (req: Request, ctx: { planId: string | null; graceEndsAt?: string }) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      const ctx = await requireEntitlement(await opts.session(req), feature, opts)
      return await handler(req, ctx)
    } catch (e) {
      if (e instanceof EntitlementError) return new Response(JSON.stringify({ error: e.code, feature }), { status: e.status, headers: { "content-type": "application/json" } })
      throw e
    }
  }
}

/** 서버 액션용: 권한이 없으면 액션 본문을 부르지 않고 실패 결과(status 403)를 돌려준다 */
export function protectAction<A extends unknown[], R>(
  feature: string,
  opts: EntitlementOptions & { session: () => Promise<{ userId: string } | null> },
  action: (...args: A) => Promise<R>,
): (...args: A) => Promise<R | { ok: false; status: 401 | 403; code: string; formError: string }> {
  return async (...args) => {
    try {
      await requireEntitlement(await opts.session(), feature, opts)
    } catch (e) {
      if (e instanceof EntitlementError) return { ok: false, status: e.status, code: e.code, formError: e.message }
      throw e
    }
    return action(...args)
  }
}
