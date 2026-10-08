// @launch-factory/inquiry — 문의 폼 서버 수신(v0 Task 15, 대장 D97 — 운영자 판정 2026-09-30 02:46 「v0로 앞당김」).
//
// 블록 연결: web-factory contact-form 세 변형은 `submit: (input: Record<string, string>) => Promise<ActionResult<ContactReceipt>>` 포트를 받는다
// (`blocks/_shared/form-flow.tsx`). `service.action(ctx)` 가 그 모양이다. 필드 오류는 블록이 보낸 칸 이름 그대로(`contact`·`phone`·`message`·`request`·`consent`) 돌려준다.
// 조립 쪽이 폼에 숨은 입력 둘을 더한다(블록은 고치지 않는다): Turnstile 토큰 `cf-turnstile-response`, 폼을 열 때 만든 `idempotencyKey`.
//
// 순서: 요청 제한 → 멱등 키(같은 키의 성공 결과가 있으면 그대로) → 입력 검사 → Turnstile → 저장 → 운영자 알림 → (선택) 접수 확인.
//   - 입력 검사를 Turnstile 앞에 둔다: 토큰은 한 번만 검증되므로(timeout-or-duplicate), 칸을 고쳐 다시 보낼 때 토큰을 태우지 않는다.
//   - 멱등 키가 Turnstile 앞에 있다: 시간 초과 뒤 같은 제출을 다시 보내면 이미 쓴 토큰을 다시 검증하지 않고 첫 결과를 돌려준다.
//   - 알림은 멱등 구간 안에서 보낸다: 같은 제출이 두 번 와도 문의 행 하나·알림 한 통이다.
// 개인정보는 최소만(이름 선택·연락처·내용). IP·브라우저 정보는 저장하지 않는다(요청 제한 키에만 잠깐 쓴다 — rate_limits 행).
import { randomInt } from "node:crypto"
import { DEFAULT_INQUIRY_RETENTION, type InquiryRetention } from "@launch-factory/consent"
import { changeInquiryKind, insertInquiry, INQUIRY_KINDS, markInquiry, purgeExpiredInquiries, retainUntil, withIdempotency, type Database, type InquiryKind } from "@launch-factory/db"
import type { Mailer } from "@launch-factory/email"
import { isLocale, t, type Locale } from "@launch-factory/i18n"
import { blockedByBot, blockedByRate, blockedResponse, blockedResult, type LaunchActionResult, type LaunchFailure } from "@launch-factory/security/protect"
import type { RateLimiter } from "@launch-factory/security/rate-limit"
import { TURNSTILE_FIELD, type Turnstile } from "@launch-factory/security/turnstile"

export { DEFAULT_INQUIRY_RETENTION, INQUIRY_KINDS, type InquiryKind, type InquiryRetention }

// ── 종류(kind)와 보유 기간(D134 — 운영자 판정 2026-09-30 03:35: 일반 30일, 불만·분쟁 3년) ─────────────────────────────────
/** 불만·분쟁 처리 기록으로 3년 보관하는 종류(전자상거래법 시행령 제6조①4) */
const DISPUTE_KINDS: readonly InquiryKind[] = ["complaint", "dispute"]
const inDisputeClass = (k: InquiryKind) => DISPUTE_KINDS.includes(k)

/**
 * 불만·분쟁 → 일반 종류로 내리는 것(보유 기간이 3년 → 30일로 줄어 이미 지난 문의는 다음 파기에서 지워진다)을 관리자만 할 수 있는가.
 * true(대표 확정 2026-09-30 04:06): 관리자만. false: 소유자도 가능(한 줄로 바꾼다). 올리는 쪽(일반 → 불만·분쟁)은 이 값과 상관없이 늘 관리자만이다.
 */
export const DISPUTE_DOWNGRADE_ADMIN_ONLY = true

/** 폼의 category 칸 → 종류. 모르는 값·빈 값·문자열이 아닌 값은 general (관리자가 나중에 올릴 수 있다) */
export function kindFromCategory(value: unknown): InquiryKind {
  const v = typeof value === "string" ? value.trim().toLowerCase() : ""
  return INQUIRY_KINDS.find((k) => k === v) ?? "general"
}

/** 바꾸는 사람. role 은 Better Auth user.role(쉼표로 여러 역할). isOwner 는 조립 쪽이 세션으로 판단한다(이 서비스의 소유자 = 운영자 계정) */
export interface InquiryActor {
  userId: string
  role?: string | null
  isOwner?: boolean
}

/**
 * 서버가 읽은 사용자 행에서 행위자를 만든다(대장 D170 — 소유자 판정을 부르는 쪽 깃발에 맡기지 않는다).
 * 소유자 = **확인된** 이메일이 ownerEmail(INQUIRY_OWNER_EMAIL)과 같은 사람(대소문자·앞뒤 공백 무시) — 주소만 같은 미확인 가입은 소유자가 아니다.
 * 정지된 사람은 행위자가 아니다(null). 역할은 Better Auth user.role 그대로(쉼표 목록).
 */
export function actorFromUser(u: { id: string; role?: string | null; email?: string | null; emailVerified?: boolean | null; banned?: boolean | null }, ownerEmail: string): InquiryActor | null {
  if (u.banned) return null
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()
  const owner = norm(ownerEmail)
  return { userId: u.id, role: u.role ?? null, isOwner: owner !== "" && u.emailVerified === true && norm(u.email) === owner }
}

/** Better Auth admin 플러그인과 같은 규칙: adminRoles(기본 ["admin"]) 중 하나가 쉼표 목록에 있거나 adminUserIds 에 든다 */
export function isAdminActor(actor: InquiryActor, o: { adminRoles?: readonly string[]; adminUserIds?: readonly string[] } = {}): boolean {
  if (o.adminUserIds?.includes(actor.userId)) return true
  const admin = o.adminRoles ?? ["admin"]
  return (actor.role ?? "").split(",").some((r) => admin.includes(r.trim()))
}

export type ReclassifyResult = { ok: true; changed: boolean; kind: InquiryKind; expiresAt: Date } | { ok: false; error: "forbidden" | "not_found" | "invalid_kind" }


/** 블록의 ContactReceipt 와 같은 모양(id = 접수 번호) */
export interface InquiryReceipt {
  id: string
  message: string
}

export interface InquiryServiceOptions {
  db: Database
  mailer: Mailer
  limiter: RateLimiter
  turnstile: Turnstile
  /**
   * 알림을 받을 운영자 메일(INQUIRY_OWNER_EMAIL). 알림 문구 언어는 locale(기본 ko).
   * **없으면(undefined) 문의 접수만 꺼진다** — submit·action·handler 는 저장도 알림도 없이 `provider_unavailable`(retryable false)로 거절하고,
   * 지난 문의를 다루는 purgeExpired·reclassify·markAsComplaint 는 그대로 된다(보유 기간 파기·불만 등급 3년 보관은 받는 창구와 별개의 의무다).
   * 주면 형식이 틀린 값은 여전히 던진다(빠르게 실패) — 켜진 척하며 메일이 안 가는 것이 가장 나쁘다.
   */
  owner?: { email: string; locale?: Locale; timeZone?: string }
  productName: string
  /** 알림 메일의 「문의 보기」 주소(선택) */
  adminUrl?: string
  /** 일반 종류의 보유 기간. 기본 30일(D97). complaint·dispute 종류는 이 값과 상관없이 3년(전자상거래법 시행령 제6조①4). { kind: "dispute" } 를 주면 모든 문의를 3년 */
  retain?: InquiryRetention
  /** 관리자 역할 이름(Better Auth admin 의 adminRoles 와 같은 값). 기본 ["admin"] */
  adminRoles?: string[]
  /** 역할과 상관없이 관리자로 보는 사용자 id(Better Auth admin 의 adminUserIds) */
  adminUserIds?: string[]
  /** 폼이 개인정보 수집·이용 동의 체크(`consent`)를 받는지. 기본 false — 문의 답변은 제15조①4(요청에 따른 조치)로 받는다 */
  requireConsent?: boolean
  /**
   * 보낸 사람에게 접수 확인 메일을 보낼지(연락처가 이메일일 때만). 기본 false.
   * 받는 주소를 방문자가 적으므로 남의 주소로 메일을 보내게 할 수 있다 — 켜면 요청 제한·Turnstile 이 그 남용을 막는 유일한 장치다.
   * 메일에는 방문자가 쓴 글을 싣지 않는다(inquiryReceipt 템플릿).
   */
  receipt?: boolean
  /** 접수 확인 메일에 싣는 첫 응답 약속(제품 설정, 예: "1 business day"). 지킬 수 있는 약속만 적는다. 없으면 약속 줄을 싣지 않는다 */
  responseTime?: string
  /** 요청 제한 경로 이름. 기본 "inquiry"(10분에 5번) */
  route?: string
  now?: () => Date
  /** 메일 실패 등 — 문의는 저장됐으므로 결과는 성공이다. 운영 알림으로 보낸다 */
  onError?: (error: Error) => void
}

export interface SubmitContext {
  /** 요청 머리(IP). ip 를 직접 줘도 된다 */
  headers?: Headers
  ip?: string | null
  /** 로그인했으면 사용자 id — 요청 제한 키와 문의 행에 들어간다 */
  userId?: string | null
  locale?: Locale
  /** 어느 폼인지(블록 id 등). 기본 "contact" */
  form?: string
}

export type InquiryInput = FormData | Record<string, unknown>

export const LIMITS = { name: 100, contact: 254, message: 5000 } as const
const CONTACT_FIELDS = ["contact", "email", "phone"] as const
const MESSAGE_FIELDS = ["message", "request"] as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[\d\s\-().]+$/
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/
const FORM_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const CONSENT_YES = new Set(["yes", "on", "true"])
// 접수 번호: 헷갈리는 글자(I·L·O·U)를 뺀 Crockford base32 8자
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const newReference = () => `Q-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`

/** FormData·객체에서 문자열 칸만 읽는다(자기 속성만 — 프로토타입 칸은 무시) */
function readFields(input: InquiryInput): Map<string, string> {
  const out = new Map<string, string>()
  const entries = input instanceof FormData ? [...input.entries()] : Object.entries(input ?? {})
  for (const [k, v] of entries) if (typeof v === "string") out.set(k, v.trim())
  return out
}

type Parsed = { ok: true; name?: string; contact: string; contactKind: "email" | "phone"; message: string; kind: InquiryKind } | { ok: false; fieldErrors: Record<string, string[]> }

function parse(f: Map<string, string>, locale: Locale, requireConsent: boolean): Parsed {
  const errors: Record<string, string[]> = {}
  const err = (field: string, text: string) => (errors[field] ??= []).push(text)
  const contactField = CONTACT_FIELDS.find((k) => f.has(k)) ?? "contact"
  const messageField = MESSAGE_FIELDS.find((k) => f.has(k)) ?? "message"
  const name = f.get("name") || undefined
  const contact = f.get(contactField) ?? ""
  const message = f.get(messageField) ?? ""
  const tooLong = (max: number) => t(locale, "inquiry.tooLong", { max })

  if (name && name.length > LIMITS.name) err("name", tooLong(LIMITS.name))
  let contactKind: "email" | "phone" = "email"
  if (!contact) err(contactField, t(locale, "inquiry.required"))
  else if (contact.length > LIMITS.contact) err(contactField, tooLong(LIMITS.contact))
  else if (EMAIL.test(contact)) contactKind = "email"
  else if (PHONE.test(contact) && /^\d{8,15}$/.test(contact.replace(/\D/g, ""))) contactKind = "phone"
  else err(contactField, t(locale, "inquiry.contactInvalid"))
  if (!message) err(messageField, t(locale, "inquiry.required"))
  else if (message.length > LIMITS.message) err(messageField, tooLong(LIMITS.message))
  if (requireConsent && !CONSENT_YES.has((f.get("consent") ?? "").toLowerCase())) err("consent", t(locale, "inquiry.consentRequired"))

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors }
  return { ok: true, ...(name ? { name } : {}), contact, contactKind, message, kind: kindFromCategory(f.get("category")) }
}

export interface InquiryService {
  /** 문의를 받는가(owner 가 있을 때만 true). false 면 접수 경로는 모두 provider_unavailable 로 거절한다 */
  readonly enabled: boolean
  submit(input: InquiryInput, ctx?: SubmitContext): Promise<LaunchActionResult<InquiryReceipt>>
  /** 블록 submit 포트. ctx 는 요청마다 만든다(서버 액션 안에서 headers()·세션으로) */
  action(ctx?: SubmitContext): (input: Record<string, string>) => Promise<LaunchActionResult<InquiryReceipt>>
  /** 라우트 처리기(POST, FormData 또는 JSON). 429 + Retry-After · 봇 400 · 칸 오류 400 · 확인 불가 503 · 처리 중 409 */
  handler(request: Request, ctx?: Omit<SubmitContext, "headers">): Promise<Response>
  /** 보유 기간이 지난 문의를 지운다(Cron) */
  purgeExpired(): Promise<number>
  /**
   * 문의 종류를 바꾸고 보유 기간을 접수일 기준으로 다시 정한다(D134). 한 트랜잭션에서 admin_actions 한 줄을 남긴다(바뀐 것이 없으면 안 남긴다).
   * 불만·분쟁 등급을 넘나드는 변경은 관리자만(내리는 쪽은 DISPUTE_DOWNGRADE_ADMIN_ONLY), 같은 등급끼리는 소유자 또는 관리자.
   */
  reclassify(reference: string, to: InquiryKind, actor: InquiryActor, opts?: { reason?: string }): Promise<ReclassifyResult>
  /** 불만 문의로 올린다(관리자만) — `reclassify(reference, "complaint", …)` */
  markAsComplaint(reference: string, actor: InquiryActor, opts?: { reason?: string }): Promise<ReclassifyResult>
}

export function createInquiryService(o: InquiryServiceOptions): InquiryService {
  const owner = o.owner
  if (owner !== undefined && (typeof owner.email !== "string" || !EMAIL.test(owner.email))) throw new Error("inquiry service needs a valid owner.email (INQUIRY_OWNER_EMAIL) — omit owner to turn inquiries off")
  if (!o.productName) throw new Error("inquiry service needs productName")
  const retain = o.retain ?? DEFAULT_INQUIRY_RETENTION
  if (retain.kind === "days" && !(Number.isInteger(retain.days) && retain.days >= 1)) throw new Error("retain.days must be a positive integer")
  const now = o.now ?? (() => new Date())
  const route = o.route ?? "inquiry"
  const onError = o.onError ?? ((e: Error) => console.error(e.message))
  const ownerLocale = owner?.locale ?? "ko"
  const expiresAt = (kind: InquiryKind, at: Date) => (inDisputeClass(kind) || retain.kind === "dispute" ? retainUntil("dispute", at) : new Date(at.getTime() + retain.days * 86_400_000))
  const adminOpts = { ...(o.adminRoles ? { adminRoles: o.adminRoles } : {}), ...(o.adminUserIds ? { adminUserIds: o.adminUserIds } : {}) }

  /** 종류를 바꿔도 되는가(D134). 불만·분쟁 등급 밖 → 안은 늘 관리자만, 안 → 밖은 상수에 따라, 같은 등급끼리는 소유자 또는 관리자 */
  function mayChange(from: InquiryKind, to: InquiryKind, actor: InquiryActor): boolean {
    if (isAdminActor(actor, adminOpts)) return true
    const entering = !inDisputeClass(from) && inDisputeClass(to)
    const leaving = inDisputeClass(from) && !inDisputeClass(to)
    if (entering || (leaving && DISPUTE_DOWNGRADE_ADMIN_ONLY)) return false
    return actor.isOwner === true
  }

  async function reclassify(reference: string, to: InquiryKind, actor: InquiryActor, opts: { reason?: string } = {}): Promise<ReclassifyResult> {
    if (!INQUIRY_KINDS.includes(to)) return { ok: false, error: "invalid_kind" }
    const r = await changeInquiryKind(o.db, {
      reference,
      to,
      adminUserId: actor.userId,
      ...(opts.reason ? { reason: opts.reason } : {}),
      at: now(),
      plan: (row) => (mayChange(row.kind, to, actor) ? { ok: true, expiresAt: expiresAt(to, row.createdAt) } : { ok: false, error: "forbidden" }),
    })
    return r.ok ? r : { ok: false, error: r.error as "forbidden" | "not_found" }
  }

  async function store(owner: NonNullable<InquiryServiceOptions["owner"]>, p: Extract<Parsed, { ok: true }>, ctx: SubmitContext, locale: Locale, at: Date): Promise<LaunchActionResult<InquiryReceipt>> {
    const form = ctx.form && FORM_ID.test(ctx.form) ? ctx.form : "contact"
    const row = await insertInquiry(o.db, {
      reference: newReference(),
      form,
      name: p.name ?? null,
      contact: p.contact,
      contactKind: p.contactKind,
      message: p.message,
      kind: p.kind,
      locale,
      userId: ctx.userId ?? null,
      createdAt: at,
      expiresAt: expiresAt(p.kind, at),
    })
    const notice = await o.mailer.send({
      to: owner.email,
      template: "inquiryNotice",
      idempotencyKey: `inquiry-notice:${row.id}`,
      input: {
        locale: ownerLocale,
        productName: o.productName,
        ...(owner.timeZone ? { timeZone: owner.timeZone } : {}),
        reference: row.reference,
        form,
        ...(p.name ? { name: p.name } : {}),
        contact: p.contact,
        message: p.message,
        receivedAt: at.toISOString(),
        deleteOn: row.expiresAt.toISOString(),
        ...(o.adminUrl ? { adminUrl: o.adminUrl } : {}),
      },
    })
    if (notice.ok) await markInquiry(o.db, row.id, { ownerNotifiedAt: now() })
    else onError(new Error(`inquiry ${row.reference}: owner notice failed (${notice.error.name})`))
    if (o.receipt && p.contactKind === "email") {
      const r = await o.mailer.send({
        to: p.contact,
        template: "inquiryReceipt",
        idempotencyKey: `inquiry-receipt:${row.id}`,
        input: { locale, productName: o.productName, reference: row.reference, ...(o.responseTime ? { responseTime: o.responseTime } : {}) },
      })
      if (r.ok) await markInquiry(o.db, row.id, { receiptSentAt: now() })
      else onError(new Error(`inquiry ${row.reference}: receipt failed (${r.error.name})`))
    }
    return { ok: true, data: { id: row.reference, message: t(locale, "inquiry.received", { reference: row.reference }) } }
  }

  async function submit(input: InquiryInput, ctx: SubmitContext = {}): Promise<LaunchActionResult<InquiryReceipt>> {
    const locale: Locale = isLocale(ctx.locale) ? ctx.locale : "en"
    // 받을 사람이 없으면 접수하지 않는다 — 저장하고 알림을 버리는 것(받은 척)이 가장 나쁘다. 요청 제한·봇 확인·DB 에 닿기 전에 거절한다
    if (!owner) return { ok: false, code: "provider_unavailable", retryable: false, formError: t(locale, "inquiry.unavailable") }
    try {
      const who = { ...(ctx.headers ? { headers: ctx.headers } : {}), ...(ctx.ip !== undefined ? { ip: ctx.ip } : {}), userId: ctx.userId ?? null }
      const rate = blockedByRate(await o.limiter.check(route, who))
      if (rate) return blockedResult(rate, locale)

      const f = readFields(input)
      const key = f.get("idempotencyKey")
      const at = now()
      const run = async (): Promise<LaunchActionResult<InquiryReceipt>> => {
        const parsed = parse(f, locale, o.requireConsent ?? false)
        if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors }
        const bot = blockedByBot(await o.turnstile.verify({ token: f.get(TURNSTILE_FIELD), remoteIp: o.limiter.ip(who), ...(key ? { idempotencyKey: key } : {}) }))
        if (bot) return blockedResult(bot, locale)
        return store(owner, parsed, ctx, locale, at)
      }
      if (!key || !IDEMPOTENCY_KEY.test(key)) return await run()
      const outcome = await withIdempotency(o.db, { scope: `inquiry:${route}`, key, now: at }, run)
      if ("inProgress" in outcome) return { ok: false, code: "in_progress", retryable: true, formError: t(locale, "protect.inProgress") }
      return outcome.result
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)))
      return { ok: false, retryable: true, formError: t(locale, "inquiry.failed") }
    }
  }

  return {
    enabled: owner !== undefined,
    submit,
    action: (ctx = {}) => (input) => submit(input, ctx),
    async handler(request, ctx = {}) {
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } })
      let input: InquiryInput
      try {
        input = (request.headers.get("content-type") ?? "").includes("application/json") ? ((await request.json()) as Record<string, unknown>) : await request.formData()
      } catch {
        input = {}
      }
      const result = await submit(input, { ...ctx, headers: request.headers })
      return toResponse(result, isLocale(ctx.locale) ? ctx.locale : "en")
    },
    purgeExpired: () => purgeExpiredInquiries(o.db, now()),
    reclassify,
    markAsComplaint: (reference, actor, opts) => reclassify(reference, "complaint", actor, opts),
  }
}

/** 서버 액션 결과 → HTTP 응답(상태 코드 규칙은 한 곳에서) */
export function toResponse(result: LaunchActionResult<unknown>, locale: Locale = "en"): Response {
  const json = (status: number) => new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
  if (result.ok) return json(200)
  const f: LaunchFailure = result
  if (f.code === "rate_limited") return blockedResponse({ kind: "rate_limited", retryAfter: f.retryAfter ?? 1 }, locale)
  if (f.code === "bot_check_failed") return json(400)
  if (f.code === "bot_check_unavailable") return json(503)
  if (f.code === "provider_unavailable") return json(503) // 문의 창구가 꺼져 있다 — Retry-After 없음(기다려도 같다)
  if (f.code === "in_progress") return json(409)
  if (f.fieldErrors) return json(400)
  return json(500)
}
