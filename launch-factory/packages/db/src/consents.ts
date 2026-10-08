// 동의 기록 도우미(v0 Task 18, 대장 D40). 표는 schema/consents.ts.
import { and, eq } from "drizzle-orm"
import type { Database } from "./client.ts"
import { consentRecords, MARKETING_CHANNELS, marketingConsents, type ConsentKind, type ConsentSource, type MarketingChannel } from "./schema.ts"

export type MarketingChoices = Record<MarketingChannel, boolean>

/** 약관·개인정보 처리방침의 판. 제품이 문서를 고칠 때마다 올린다(예: "2026-09-30") */
export interface ConsentVersions {
  terms: string
  privacy: string
}

export interface SignUpConsentRecord {
  userId: string
  /** 만 14세 확인을 받지 않는 설정이면 undefined — 행을 남기지 않는다 */
  ageOver14?: true
  marketing: MarketingChoices
  versions: ConsentVersions
  locale?: string | null
  at: Date
}

/**
 * 가입 때 받은 동의를 한 트랜잭션으로 남긴다: 약관·개인정보(판과 함께)·만 14세 확인·마케팅 채널 넷(거부도 남긴다),
 * 그리고 채널별 현재 상태(updatedAt = 가입 시각).
 */
export async function recordSignUpConsents(d: Database, r: SignUpConsentRecord): Promise<void> {
  const base = { userId: r.userId, source: "sign_up" as const, locale: r.locale ?? null, createdAt: r.at }
  const rows: (typeof consentRecords.$inferInsert)[] = [
    { ...base, kind: "terms", granted: true, version: r.versions.terms },
    { ...base, kind: "privacy", granted: true, version: r.versions.privacy },
  ]
  if (r.ageOver14) rows.push({ ...base, kind: "age_over_14", granted: true })
  for (const channel of MARKETING_CHANNELS) rows.push({ ...base, kind: `marketing_${channel}`, granted: r.marketing[channel] })
  await d.transaction(async (tx) => {
    await tx.insert(consentRecords).values(rows)
    await tx.insert(marketingConsents).values(MARKETING_CHANNELS.map((channel) => ({ userId: r.userId, channel, granted: r.marketing[channel], updatedAt: r.at })))
  })
}

/** 채널별 현재 상태. 기록이 없는 채널은 false. updatedAt 은 가장 최근에 바꾼 때(기록이 없으면 undefined) */
export async function readMarketingConsents(d: Database, userId: string): Promise<MarketingChoices & { updatedAt?: Date }> {
  const rows = await d.select().from(marketingConsents).where(eq(marketingConsents.userId, userId))
  const out: MarketingChoices & { updatedAt?: Date } = { email: false, sms: false, kakao: false, push: false }
  for (const row of rows) {
    out[row.channel] = row.granted
    if (!out.updatedAt || row.updatedAt > out.updatedAt) out.updatedAt = row.updatedAt
  }
  return out
}

export interface MarketingChange {
  userId: string
  /** 준 채널만 바꾼다 */
  changes: Partial<MarketingChoices>
  source: ConsentSource
  locale?: string | null
  at: Date
}

/**
 * 채널별 수신 동의를 바꾼다. 준 채널마다 현재 상태를 덮고(updatedAt = at) 이력 한 행을 남긴다 —
 * 값이 같아도 남긴다(의사 표시마다 처리 결과를 알려야 한다, 정보통신망법 제50조제7항).
 */
export async function writeMarketingConsents(d: Database, c: MarketingChange): Promise<{ channel: MarketingChannel; granted: boolean }[]> {
  const given = MARKETING_CHANNELS.filter((ch) => typeof c.changes[ch] === "boolean").map((channel) => ({ channel, granted: c.changes[channel] as boolean }))
  if (!given.length) return []
  await d.transaction(async (tx) => {
    for (const { channel, granted } of given) {
      await tx
        .insert(marketingConsents)
        .values({ userId: c.userId, channel, granted, updatedAt: c.at })
        .onConflictDoUpdate({ target: [marketingConsents.userId, marketingConsents.channel], set: { granted, updatedAt: c.at } })
    }
    await tx.insert(consentRecords).values(
      given.map(({ channel, granted }) => ({ userId: c.userId, kind: `marketing_${channel}` as const, granted, source: c.source, locale: c.locale ?? null, createdAt: c.at })),
    )
  })
  return given
}

export interface ConsentEvent {
  userId: string
  kind: ConsentKind
  granted: boolean
  version?: string | null
  source: ConsentSource
  locale?: string | null
  subject?: string | null
  at: Date
}

/** 한 번의 의사 표시를 남긴다(예: 결제 직전 청약철회 제한 동의) */
export async function recordConsent(d: Database, e: ConsentEvent): Promise<void> {
  await d.insert(consentRecords).values({
    userId: e.userId,
    kind: e.kind,
    granted: e.granted,
    version: e.version ?? null,
    source: e.source,
    locale: e.locale ?? null,
    subject: e.subject ?? null,
    createdAt: e.at,
  })
}

/** 한 사용자의 동의 이력(오래된 것부터). 증빙·관리자 화면용 */
export async function consentHistory(d: Database, userId: string, kind?: ConsentKind) {
  return d
    .select()
    .from(consentRecords)
    .where(kind ? and(eq(consentRecords.userId, userId), eq(consentRecords.kind, kind)) : eq(consentRecords.userId, userId))
    .orderBy(consentRecords.createdAt)
}
