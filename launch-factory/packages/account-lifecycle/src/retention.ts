// 거래기록 분리 보존(대장 D21·LF-T3-D3).
// 근거(국가법령정보센터 Open API, 2026-09-30 확인 — 출처 값은 @launch-factory/db RETENTION_SOURCE):
//   - 전자상거래법 제6조제1항·제3항, 시행령 제6조제1항: 표시·광고 6개월, 계약·청약철회 5년, 대금결제·공급 5년, 불만·분쟁 3년
//   - 시행령 제6조제2항제3호: 동의를 철회한 소비자의 기록은 다른 기록과 따로 보존
//   - 개인정보 보호법 제21조제1항 단서·제3항: 다른 법령이 보존을 요구하면 파기하지 않되 분리해 저장·관리
// 표 retained_transactions 에는 이름·이메일 칸이 없다. 사람은 subject_ref(키 있는 해시)로만 가리킨다.
// 행은 고칠 수 없고, retain_until 전에는 지울 수 없다(마이그레이션 0005 트리거).
import { and, eq, lte, sql } from "drizzle-orm"
import {
  accessLogPurgeBefore,
  accessLogs,
  consentRecords,
  retainUntil,
  retainedTransactions,
  subscriptions,
  type AccessLogRetention,
  type Database,
  type RetainedTransactionKind,
} from "@launch-factory/db"
import { subjectRef } from "./subject.ts"

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]
type Db = Database | Tx

export interface RetainedItem {
  kind: RetainedTransactionKind
  provider: string
  providerRef: string
  /** 보존 기간을 세기 시작하는 때 */
  occurredAt: Date
  /** 개인 식별 칸을 뺀 거래 내용(금액·요금제·판·시각). 이름·이메일·주소·전화·IP 를 넣지 않는다 */
  record: Record<string, unknown>
  orgId?: string | null
}

/** 파기 직전에 이 사용자의 보존 대상 거래기록을 모은다(파기와 같은 트랜잭션 안). 제품이 표를 더하면(분쟁·광고·결제 내역) 수집기를 더한다 */
export type RetentionCollector = (tx: Tx, ctx: { userId: string; now: Date }) => Promise<RetainedItem[]>

/** record 에 이런 이름의 칸이 있으면 넣지 않는다(개인 식별 칸 금지 — 실수로 행을 통째로 넣는 것을 막는다) */
const IDENTIFYING_WORDS = new Set(["email", "mail", "name", "phone", "tel", "mobile", "address", "addr", "ip"])
const IDENTIFYING_PAIRS = ["user id", "user agent"]
/** 칸 이름을 낱말로 쪼갠다(camelCase·snake_case·kebab-case) */
const words = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
export const isIdentifyingKey = (key: string): boolean => {
  const w = words(key)
  return w.some((x) => IDENTIFYING_WORDS.has(x)) || IDENTIFYING_PAIRS.some((p) => ` ${w.join(" ")} `.includes(` ${p} `))
}

export function identifyingKeys(record: Record<string, unknown>, path = ""): string[] {
  return Object.entries(record).flatMap(([k, v]) => {
    const here = path ? `${path}.${k}` : k
    const bad = isIdentifyingKey(k) ? [here] : []
    const nested = (Array.isArray(v) ? v : [v]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x) && !(x instanceof Date))
    return [...bad, ...nested.flatMap((x) => identifyingKeys(x, here))]
  })
}

/** 보존 기록 하나를 넣는다. 같은 (provider, provider_ref, kind) 가 있으면 넣지 않는다(파기 Cron 재실행 대비). 넣었으면 true */
export async function retainTransaction(d: Db, ref: string, item: RetainedItem): Promise<boolean> {
  const bad = identifyingKeys(item.record)
  if (bad.length) throw new Error(`retained record must not carry identifying fields: ${bad.join(", ")}`)
  const rows = await d
    .insert(retainedTransactions)
    .values({
      subjectRef: ref,
      orgId: item.orgId ?? null,
      kind: item.kind,
      provider: item.provider,
      providerRef: item.providerRef,
      occurredAt: item.occurredAt,
      retainUntil: retainUntil(item.kind, item.occurredAt),
      record: item.record,
    })
    .onConflictDoNothing()
    .returning({ id: retainedTransactions.id })
  return rows.length > 0
}

const iso = (v: Date | null | undefined) => (v ? v.toISOString() : null)

/**
 * 구독 = 계약 기록(시행령 제6조제1항제2호, 5년). 기간은 파기 시각부터 센다 — 탈퇴로 계약이 끝나는 때이고,
 * 이보다 이른 시각(가입·첫 결제)에서 세면 법정 기간보다 짧게 지울 수 있다.
 * 가입 때 동의한 약관의 판·시각을 함께 남긴다(유료 이용자에게 약관은 계약 내용이다).
 */
export const subscriptionCollector: RetentionCollector = async (tx, { userId, now }) => {
  const subs = await tx.select().from(subscriptions).where(eq(subscriptions.userId, userId))
  if (!subs.length) return []
  const terms = await tx
    .select({ version: consentRecords.version, at: consentRecords.createdAt, locale: consentRecords.locale })
    .from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), eq(consentRecords.kind, "terms"), eq(consentRecords.granted, true)))
    .orderBy(consentRecords.createdAt)
  return subs.map((s) => ({
    kind: "contract" as const,
    provider: s.provider,
    providerRef: s.providerSubId,
    occurredAt: now,
    orgId: s.orgId,
    record: {
      type: "subscription",
      planId: s.planId,
      statusAtDeletion: s.status,
      startedAt: iso(s.createdAt),
      currentPeriodEnd: iso(s.currentPeriodEnd),
      trialEnd: iso(s.trialEnd),
      cancelAt: iso(s.cancelAt),
      termsAccepted: terms.map((t) => ({ version: t.version, at: iso(t.at), locale: t.locale })),
    },
  }))
}

/**
 * 결제 직전 청약철회 제한 동의(withdrawal_limit) = 청약철회에 관한 기록(시행령 제6조제1항제2호, 5년). 파기 시각부터 센다.
 * 약관·개인정보·만 14세 동의는 옮기지 않는다 — 파기한다(보고서 「동의 기록 보존 판정」). 마케팅 수신 동의는 아래 수집기.
 */
export const withdrawalConsentCollector: RetentionCollector = async (tx, { userId, now }) => {
  const rows = await tx
    .select()
    .from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), eq(consentRecords.kind, "withdrawal_limit")))
  return rows.map((c) => ({
    kind: "contract" as const,
    provider: "launch-factory",
    providerRef: `consent:${c.id}`,
    occurredAt: now,
    record: { type: "withdrawal_limit_consent", granted: c.granted, version: c.version, planId: c.subject, locale: c.locale, at: iso(c.createdAt), source: c.source },
  }))
}

const MARKETING_PREFIX = "marketing_"

/**
 * 마케팅 수신 동의 이력(email·sms·kakao·push) = 분쟁 대비 증빙, 파기 시각부터 3년(종류 dispute — 기간 36개월).
 * 근거: 운영자 결정 2026-10-08(대장 D127) — 개인정보 보호법 제39조①(손해배상, 처리자가 고의·과실 없음을 입증)에 대비해
 * 민법 제766조①(손해배상청구권 — 안 날부터 3년, 국가법령정보센터 현행 MST 284415·시행 2026-03-17 확인) 동안 남긴다.
 * 남는 위험: 같은 조 ②(행위한 날부터 10년)는 덮지 않는다. 처리방침 초안의 보관 항목이 이 기간을 적는다.
 */
export const marketingConsentCollector: RetentionCollector = async (tx, { userId, now }) => {
  const rows = await tx
    .select()
    .from(consentRecords)
    .where(and(eq(consentRecords.userId, userId), sql`${consentRecords.kind} like ${MARKETING_PREFIX + "%"}`))
  return rows.map((c) => ({
    kind: "dispute" as const,
    provider: "launch-factory",
    providerRef: `consent:${c.id}`,
    occurredAt: now,
    record: { type: "marketing_consent", channel: c.kind.slice(MARKETING_PREFIX.length), granted: c.granted, version: c.version, locale: c.locale, at: iso(c.createdAt), source: c.source },
  }))
}

export const DEFAULT_COLLECTORS: readonly RetentionCollector[] = [subscriptionCollector, withdrawalConsentCollector, marketingConsentCollector]

/** 열람·분쟁 요청: 이메일로 보존 기록을 찾는다(키가 있어야 찾을 수 있다) */
export async function findRetainedByEmail(d: Database, key: string, email: string) {
  return d.select().from(retainedTransactions).where(eq(retainedTransactions.subjectRef, subjectRef(key, email))).orderBy(retainedTransactions.occurredAt)
}

export interface SweepReport {
  retained: Record<RetainedTransactionKind, number>
  accessLogs: number
}

/**
 * 보존 기간이 지난 것을 지운다: 보존 거래기록(종류마다 제 기간 — retain_until), 접속기록(고시 제8조제1항 1년/2년).
 * now 는 실제 시각보다 뒤일 수 없다 — 트리거가 DB 시각으로 다시 막는다.
 */
export async function sweepExpired(d: Database, now: Date, accessLogRetention?: AccessLogRetention): Promise<SweepReport> {
  const gone = await d.delete(retainedTransactions).where(lte(retainedTransactions.retainUntil, now)).returning({ kind: retainedTransactions.kind })
  const retained = { advertising: 0, contract: 0, payment: 0, dispute: 0 } satisfies Record<RetainedTransactionKind, number>
  for (const g of gone) retained[g.kind]++
  const logs = await d.delete(accessLogs).where(sql`${accessLogs.occurredAt} < ${accessLogPurgeBefore(now, accessLogRetention)}`).returning({ id: accessLogs.id })
  return { retained, accessLogs: logs.length }
}
