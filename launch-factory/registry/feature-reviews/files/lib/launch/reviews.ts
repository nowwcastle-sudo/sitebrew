// launch-factory: 후기·상품 문의 조립. 순서: 요청 제한(DB) → 멱등 키 → 입력 검사 → Turnstile → 저장. 읽기는 게시된 글만 나간다.
// 후기는 로그인한 사람만 쓰고(한 사람이 한 대상에 한 번), 질문은 로그인 없이도 쓴다. 대상(subjectType·subjectId)은 제품이 정한다(예: product / 상품 id).
// 게시 방식: 기본은 바로 게시하고 나중에 검토(after). REVIEWS_MODERATION=before 면 검토를 마친 뒤에 게시한다.
import { hitRateLimit, user } from "@launch-factory/db"
import { actorFromUser } from "@launch-factory/inquiry"
import { createReviewsService, type ReviewsActor, type ReviewsService, type SubmitContext } from "@launch-factory/reviews"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { eq } from "drizzle-orm"
import { authPort } from "@/lib/launch/auth"
import { database } from "@/lib/launch/db"
import { env, optional, required } from "@/lib/launch/env"

let cached: Promise<ReviewsService> | undefined

export function reviews(): Promise<ReviewsService> {
  return (cached ??= build())
}

/** 게시 방식. 모르는 값은 켤 때 멈춘다(켜진 척하며 검토 없이 게시하는 것이 가장 나쁘다) */
function moderation(): "after" | "before" {
  const v = optional("REVIEWS_MODERATION") ?? "after"
  if (v !== "after" && v !== "before") throw new Error('REVIEWS_MODERATION must be "after" or "before"')
  return v
}

async function build(): Promise<ReviewsService> {
  const db = await database()
  const live = env().LF_MODE === "live"
  return createReviewsService({
    db,
    // 믿을 IP 머리는 환경이 정한다(대장 D205). 인증·보안·문의 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
    turnstile: createTurnstile(live ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }),
    moderation: moderation(),
  })
}

/** 지금 요청의 로그인 사용자(제출 맥락). 대리 로그인 세션은 로그인하지 않은 것으로 본다 — 관리자가 사용자 이름으로 글을 쓰지 못한다 */
export async function submitContext(): Promise<Pick<SubmitContext, "userId" | "displayName">> {
  const s = await (await authPort()).session()
  if (!s.ok || !s.data || s.data.impersonatedBy) return {}
  return { userId: s.data.userId, ...(s.data.name ? { displayName: s.data.name } : {}) }
}

/**
 * 지금 로그인한 사람의 행위자(답변·숨김·관리 목록). 로그아웃·정지·대리 세션 → null.
 * 소유자 = 확인된 이메일이 INQUIRY_OWNER_EMAIL 과 같은 사람, 관리자 = user.role 에 admin(Better Auth admin 플러그인과 같은 규칙).
 * 입력의 isOwner·role·userId 는 읽지 않는다 — 세션의 사용자 행으로만 정한다.
 */
export async function reviewsActor(): Promise<ReviewsActor | null> {
  const s = await (await authPort()).session()
  if (!s.ok || !s.data || s.data.impersonatedBy) return null
  const [row] = await (await database()).select({ id: user.id, role: user.role, email: user.email, emailVerified: user.emailVerified, banned: user.banned }).from(user).where(eq(user.id, s.data.userId)).limit(1)
  return row ? actorFromUser(row, optional("INQUIRY_OWNER_EMAIL") ?? "") : null
}
