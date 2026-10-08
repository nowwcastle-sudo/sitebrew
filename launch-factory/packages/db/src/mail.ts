// 메일 보조 기록 도우미(LFMAIL). 표는 schema/mail.ts.
import { and, eq, isNull, lt, or } from "drizzle-orm"
import type { Database } from "./client.ts"
import { knownDevices, mailLedger, marketingConsents, user } from "./schema.ts"

/**
 * 「한 번만 보내는 메일」 자리를 잡는다. 이 사용자·이 종류로 처음 잡으면 true(보내도 된다), 이미 있으면 false(보내지 않는다).
 * 동시에 두 요청이 와도 한쪽만 true 다(기본 키). 보내기가 실패하면 releaseMailOnce 로 자리를 돌려놓아 다음에 다시 보낼 수 있게 한다.
 */
export async function claimMailOnce(d: Database, userId: string, key: string, at: Date, refAt?: Date): Promise<boolean> {
  const rows = await d
    .insert(mailLedger)
    .values({ userId, key, sentAt: at, refAt: refAt ?? null })
    .onConflictDoNothing()
    .returning({ key: mailLedger.key })
  return rows.length > 0
}

export async function releaseMailOnce(d: Database, userId: string, key: string): Promise<void> {
  await d.delete(mailLedger).where(and(eq(mailLedger.userId, userId), eq(mailLedger.key, key)))
}

/** 기록을 남기거나(처음) 덮어쓴다(이미 있으면 보낸 때·기준 시각을 새 값으로). 재확인 메일처럼 주기마다 한 번인 종류가 쓴다 */
export async function recordMailSent(d: Database, userId: string, key: string, at: Date, refAt?: Date): Promise<void> {
  await d
    .insert(mailLedger)
    .values({ userId, key, sentAt: at, refAt: refAt ?? null })
    .onConflictDoUpdate({ target: [mailLedger.userId, mailLedger.key], set: { sentAt: at, refAt: refAt ?? null } })
}

export async function readMailLedger(d: Database, userId: string, key: string): Promise<{ sentAt: Date; refAt: Date | null } | null> {
  const [row] = await d.select({ sentAt: mailLedger.sentAt, refAt: mailLedger.refAt }).from(mailLedger).where(and(eq(mailLedger.userId, userId), eq(mailLedger.key, key))).limit(1)
  return row ?? null
}

/** 마케팅 수신 재확인 메일의 기록 이름 */
export const MARKETING_RECONFIRM_KEY = "marketing_reconfirm"

export interface ReconfirmCandidate {
  userId: string
  email: string
  name: string
  locale: string | null
  timeZone: string | null
  /** 이메일 수신에 동의한(또는 마지막으로 다시 확인한) 날 */
  consentAt: Date
}

/**
 * 재확인 메일을 보낼 사람: 이메일 채널에 동의한 상태이고, 그 동의가 cutoff(= 지금 − 2년) 이전이며, 그 동의에 대해 재확인 메일을 아직 보내지 않은 사람.
 * 「그 동의에 대해」 = 기록의 기준 시각(ref_at)이 현재 동의 시각보다 이르면 새 주기다(계속 받기를 눌러 동의 시각이 갱신된 경우).
 * 오래된 동의부터 limit 명.
 */
export async function reconfirmCandidates(d: Database, cutoff: Date, limit: number): Promise<ReconfirmCandidate[]> {
  const rows = await d
    .select({
      userId: marketingConsents.userId,
      email: user.email,
      name: user.name,
      locale: user.locale,
      timeZone: user.timeZone,
      consentAt: marketingConsents.updatedAt,
    })
    .from(marketingConsents)
    .innerJoin(user, eq(user.id, marketingConsents.userId))
    .leftJoin(mailLedger, and(eq(mailLedger.userId, marketingConsents.userId), eq(mailLedger.key, MARKETING_RECONFIRM_KEY)))
    .where(
      and(
        eq(marketingConsents.channel, "email"),
        eq(marketingConsents.granted, true),
        lt(marketingConsents.updatedAt, cutoff),
        or(isNull(mailLedger.userId), isNull(mailLedger.refAt), lt(mailLedger.refAt, marketingConsents.updatedAt)),
      ),
    )
    .orderBy(marketingConsents.updatedAt)
    .limit(limit)
  return rows
}

export interface DeviceSeen {
  /** 이 사용자가 이 기기로 로그인한 적이 이미 있었나 */
  known: boolean
  /** 이 사용자에게 다른 기기 기록이 하나라도 있었나(처음 로그인하는 계정이면 false) */
  hadOthers: boolean
}

/** 로그인한 기기를 기록한다. 이미 있으면 마지막으로 본 때만 갱신한다 */
export async function recordDevice(d: Database, c: { userId: string; fingerprint: string; label: string; at: Date }): Promise<DeviceSeen> {
  const rows = await d.select({ fingerprint: knownDevices.fingerprint }).from(knownDevices).where(eq(knownDevices.userId, c.userId))
  const known = rows.some((r) => r.fingerprint === c.fingerprint)
  const hadOthers = rows.some((r) => r.fingerprint !== c.fingerprint)
  await d
    .insert(knownDevices)
    .values({ userId: c.userId, fingerprint: c.fingerprint, label: c.label, firstSeenAt: c.at, lastSeenAt: c.at })
    .onConflictDoUpdate({ target: [knownDevices.userId, knownDevices.fingerprint], set: { lastSeenAt: c.at } })
  return { known, hadOthers }
}

/** 아직 이메일을 확인하지 않은 계정을 지운다(가입한 적 없다는 신고 — A13). 확인된 계정은 건드리지 않는다. 지웠으면 true */
export async function deleteUnverifiedUser(d: Database, userId: string): Promise<boolean> {
  const rows = await d.delete(user).where(and(eq(user.id, userId), eq(user.emailVerified, false))).returning({ id: user.id })
  return rows.length > 0
}

/** 한 채널의 현재 동의(기록 없으면 null) */
export async function readMarketingChannel(d: Database, userId: string, channel: "email" | "sms" | "kakao" | "push"): Promise<{ granted: boolean; updatedAt: Date } | null> {
  const [row] = await d
    .select({ granted: marketingConsents.granted, updatedAt: marketingConsents.updatedAt })
    .from(marketingConsents)
    .where(and(eq(marketingConsents.userId, userId), eq(marketingConsents.channel, channel)))
    .limit(1)
  return row ?? null
}

