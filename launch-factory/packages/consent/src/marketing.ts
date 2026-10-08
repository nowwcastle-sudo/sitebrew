// 광고성 메일의 보내기 전 점검·수신거부·2년 재확인(LFMAIL — G03·G07·A16). 한국법 근거는 docs/qa/ux-audit/legal-basis.md §1 에 있는 그대로다:
//   • 수신거부·철회 뒤에는 보내지 않는다(정보통신망법 제50조제2항) · 메일 안의 수신거부는 로그인 없이 된다(시행령 별표 6 공통 2) → 서명 링크 + 즉시 반영(withdrawByToken)
//   • 동의를 받은 날부터 2년마다 수신동의 여부를 확인한다(제50조제8항·시행령 제62조의3): 전송자 명칭·동의 사실과 날짜·유지/철회 방법을 알린다(재확인 메일)
//     — 이 규칙에 「답이 없으면 동의가 사라진다」는 문구가 없다. 그래서 답이 없는 사람에게는 계속 보내되, **재확인 메일을 아직 보내지 않은 사람**(= 2년이 지났는데 확인 의무를 못 한 사람)에게는 보내지 않는다(canSendMarketing).
//     답이 없으면 끊도록 바꾸려면 canSendMarketing 의 reconfirm_pending 조건을 「메일을 보낸 뒤 N일 안에 계속 받기가 없으면 불가」로 넓힌다 — 법무 판단이 필요한 일이다(확인 안 됨).
//   • 야간(21시~08시) 전송 점검(G07): 한국 시각. 시행령 제61조제2항은 전자우편을 야간 동의 대상에서 뺀다(legal-basis §1 A05·D07·G03) — 법이 요구하는 점검은 아니고 보수적 기본값이다.
//     nightGuard 를 끄면 점검하지 않는다.
import { createHash } from "node:crypto"
import { MARKETING_CHANNELS, readMailLedger, readMarketingChannel, recordMailSent, reconfirmCandidates, MARKETING_RECONFIRM_KEY, writeMarketingConsents, type Database, type MarketingChannel, type ReconfirmCandidate } from "@launch-factory/db"
import { signToken, verifyToken } from "@launch-factory/security/signed-token"

/** 로그인 없이 처리되는 서명 링크의 경로(링크를 만드는 쪽과 받는 라우트가 같은 값을 쓴다). RFC 8058 의 POST 도 같은 주소다 */
export const MARKETING_LINK_PATHS = { unsubscribe: "/api/marketing/unsubscribe", keep: "/api/marketing/keep" } as const

/** 「계속 받기」 링크 유효 기간(일). 메일 템플릿의 RECONFIRM_LINK_VALID_DAYS 와 같아야 한다(시험이 확인) */
export const RECONFIRM_KEEP_DAYS = 60
/** 재확인 주기(년) */
export const RECONFIRM_YEARS = 2
/** 야간 전송 점검 시간대(한국). 21:00 이상 또는 08:00 미만 */
export const NIGHT_WINDOW = { startHour: 21, endHour: 8, utcOffsetHours: 9 } as const

const PURPOSE = { unsubscribe: "marketing-unsubscribe", keep: "marketing-keep" } as const
const channelOf = (v: unknown): MarketingChannel | null => (typeof v === "string" && (MARKETING_CHANNELS as readonly string[]).includes(v) ? (v as MarketingChannel) : null)

/** 수신거부 토큰. 만료가 없다(오래된 메일의 링크로도 철회된다) */
export function unsubscribeToken(userId: string, channel: MarketingChannel, secret: string): string {
  return signToken({ u: userId, c: channel }, { secret, purpose: PURPOSE.unsubscribe })
}

/** 「계속 받기」 토큰. 기한(RECONFIRM_KEEP_DAYS)이 있다 */
export function keepToken(userId: string, channel: MarketingChannel, secret: string, now: Date = new Date()): string {
  return signToken({ u: userId, c: channel }, { secret, purpose: PURPOSE.keep, expiresAt: new Date(now.getTime() + RECONFIRM_KEEP_DAYS * 86_400_000) })
}

/** 수신자 하나의 서명 링크 둘. baseUrl 은 앱 주소(끝 슬래시 없음) */
export function marketingLinks(o: { baseUrl: string; secret: string; userId: string; channel?: MarketingChannel; now?: Date }): { unsubscribeUrl: string; keepUrl: string } {
  const channel = o.channel ?? "email"
  const base = o.baseUrl.replace(/\/+$/, "")
  return {
    unsubscribeUrl: `${base}${MARKETING_LINK_PATHS.unsubscribe}?t=${unsubscribeToken(o.userId, channel, o.secret)}`,
    keepUrl: `${base}${MARKETING_LINK_PATHS.keep}?t=${keepToken(o.userId, channel, o.secret, o.now)}`,
  }
}

export type WithdrawResult = { ok: true; userId: string; channel: MarketingChannel; changed: boolean; at: Date } | { ok: false; reason: "invalid" }

/**
 * 수신거부 링크를 처리한다(로그인 없음). 서명이 맞으면 그 채널의 동의를 바로 철회하고 이력을 남긴다(source unsubscribe_link).
 * 이미 철회된 채널이면 아무것도 쓰지 않는다(changed: false — 같은 링크를 다시 누르거나 메일 보안 프로그램이 미리 열어도 통지 메일이 되풀이되지 않는다).
 * changed 이면 부르는 쪽이 처리 결과 통지 메일(정보통신망법 제50조제7항)을 보낸다.
 */
export async function withdrawByToken(db: Database, token: unknown, o: { secret: string; now?: Date }): Promise<WithdrawResult> {
  const now = o.now ?? new Date()
  const p = verifyToken(token, { secret: o.secret, purpose: PURPOSE.unsubscribe, now })
  const channel = channelOf(p?.c)
  if (!p || typeof p.u !== "string" || !p.u || !channel) return { ok: false, reason: "invalid" }
  const current = await readMarketingChannel(db, p.u, channel)
  if (!current) return { ok: false, reason: "invalid" } // 지워진 사용자(탈퇴)의 링크
  if (!current.granted) return { ok: true, userId: p.u, channel, changed: false, at: now }
  await writeMarketingConsents(db, { userId: p.u, changes: { [channel]: false }, source: "unsubscribe_link", at: now })
  return { ok: true, userId: p.u, channel, changed: true, at: now }
}

export type KeepResult = { ok: true; userId: string; channel: MarketingChannel; at: Date } | { ok: false; reason: "invalid" | "withdrawn" }

/**
 * 「계속 받기」 링크. 서명·기한이 맞고 지금 동의 상태일 때만 동의 시각을 지금으로 갱신한다(새 2년이 시작된다). 이력 한 줄(source reconfirm).
 * 이미 철회한 사람은 다시 동의시키지 않는다(withdrawn) — 철회 뒤 재동의는 명시적 사전 동의 절차(설정 화면)로만 한다.
 */
export async function keepByToken(db: Database, token: unknown, o: { secret: string; now?: Date }): Promise<KeepResult> {
  const now = o.now ?? new Date()
  const p = verifyToken(token, { secret: o.secret, purpose: PURPOSE.keep, now })
  const channel = channelOf(p?.c)
  if (!p || typeof p.u !== "string" || !p.u || !channel) return { ok: false, reason: "invalid" }
  const current = await readMarketingChannel(db, p.u, channel)
  if (!current) return { ok: false, reason: "invalid" }
  if (!current.granted) return { ok: false, reason: "withdrawn" }
  await writeMarketingConsents(db, { userId: p.u, changes: { [channel]: true }, source: "reconfirm", at: now })
  return { ok: true, userId: p.u, channel, at: now }
}

/** 한국 시각 기준 시(0~23) */
const hourKst = (d: Date): number => (d.getUTCHours() + NIGHT_WINDOW.utcOffsetHours) % 24

/** 한국 시각 21:00~다음 날 08:00 인가 */
export function isNightKst(now: Date): boolean {
  const h = hourKst(now)
  return h >= NIGHT_WINDOW.startHour || h < NIGHT_WINDOW.endHour
}

/** 야간이면 그날 아침 08:00(한국)의 시각, 아니면 지금 */
export function nextSendTime(now: Date): Date {
  if (!isNightKst(now)) return now
  const kst = new Date(now.getTime() + NIGHT_WINDOW.utcOffsetHours * 3_600_000)
  const day = kst.getUTCHours() >= NIGHT_WINDOW.startHour ? 1 : 0 // 21시 이후면 다음 날 아침
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + day, NIGHT_WINDOW.endHour - NIGHT_WINDOW.utcOffsetHours, 0, 0))
}

export type MarketingSendDecision =
  | { ok: true }
  | { ok: false; reason: "no_consent" | "reconfirm_pending" }
  | { ok: false; reason: "night"; retryAt: Date }

/** 두 날짜 사이가 N년 이상인가(달력 기준 — 윤년을 일수로 어림하지 않는다) */
export function yearsAgo(now: Date, years: number): Date {
  const d = new Date(now.getTime())
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d
}

/**
 * 광고성 메일을 이 사람에게 지금 보내도 되는가. 보내는 모든 경로가 먼저 이것을 부른다(G07).
 *  1) 채널 동의가 켜져 있어야 한다(없거나 철회면 no_consent).
 *  2) 동의한 지 2년이 넘었는데 그 동의에 대한 재확인 메일이 아직 나가지 않았으면 reconfirm_pending(확인 의무를 다하기 전에는 보내지 않는다).
 *  3) 야간(한국 21~08시)이면 night + 다시 시도할 시각(nightGuard: false 로 끈다).
 */
export async function canSendMarketing(db: Database, userId: string, o: { channel?: MarketingChannel; now?: Date; nightGuard?: boolean } = {}): Promise<MarketingSendDecision> {
  const now = o.now ?? new Date()
  const channel = o.channel ?? "email"
  const consent = await readMarketingChannel(db, userId, channel)
  if (!consent || !consent.granted) return { ok: false, reason: "no_consent" }
  if (consent.updatedAt.getTime() < yearsAgo(now, RECONFIRM_YEARS).getTime()) {
    const sent = await readMailLedger(db, userId, MARKETING_RECONFIRM_KEY)
    if (!sent?.refAt || sent.refAt.getTime() < consent.updatedAt.getTime()) return { ok: false, reason: "reconfirm_pending" }
  }
  if ((o.nightGuard ?? true) && isNightKst(now)) return { ok: false, reason: "night", retryAt: nextSendTime(now) }
  return { ok: true }
}

export interface ReconfirmRunOptions {
  db: Database
  now?: Date
  /** 한 번에 처리할 최대 인원(기본 200) */
  limit?: number
  /** 한 사람에게 재확인 메일을 보낸다. 던지면 그 사람은 기록하지 않고(다음 실행이 다시 시도) 센다 */
  send: (c: ReconfirmCandidate & { idempotencyKey: string }) => Promise<void>
  /** 메일을 보낼 수 없는 사람(예: 이메일 없는 대체 주소). 기록만 남기고 넘어간다 — 같은 사람이 매일 다시 뽑히지 않게 */
  skip?: (c: ReconfirmCandidate) => boolean
}

export interface ReconfirmRunResult {
  /** 이번에 대상이 된 사람 수 */
  due: number
  sent: number
  skipped: number
  failed: number
}

/**
 * 2년 재확인 작업(A16, 하루 한 번 Cron). 동의한 지 2년이 지난 이메일 수신자에게 재확인 메일을 한 통씩 보내고 기록(mail_ledger)을 남긴다.
 * 두 번 돌아도 안전하다 — 기록이 있는 동의는 다시 뽑히지 않고, 메일에는 같은 멱등 키가 간다. 실패한 사람은 기록하지 않아 다음 실행이 이어서 한다.
 */
export async function runMarketingReconfirm(o: ReconfirmRunOptions): Promise<ReconfirmRunResult> {
  const now = o.now ?? new Date()
  const candidates = await reconfirmCandidates(o.db, yearsAgo(now, RECONFIRM_YEARS), o.limit ?? 200)
  const result: ReconfirmRunResult = { due: candidates.length, sent: 0, skipped: 0, failed: 0 }
  for (const c of candidates) {
    if (o.skip?.(c)) {
      await recordMailSent(o.db, c.userId, MARKETING_RECONFIRM_KEY, now, c.consentAt)
      result.skipped += 1
      continue
    }
    try {
      await o.send({ ...c, idempotencyKey: `reconfirm:${createHash("sha256").update(`${c.userId}:${c.consentAt.getTime()}`).digest("hex").slice(0, 24)}` })
      await recordMailSent(o.db, c.userId, MARKETING_RECONFIRM_KEY, now, c.consentAt)
      result.sent += 1
    } catch {
      result.failed += 1
    }
  }
  return result
}
