// 내 정보 내려받기(v0 Task 14). GDPR 제15조(접근권)·제20조(이동권) — en 사이트, 개인정보 보호법 제35조(열람) — ko 사이트.
// 그 사용자의 행만 읽는다(모든 쿼리가 user_id = 본인). 비밀(비밀번호 해시·토큰·2단계 비밀·백업 코드)은 싣지 않는다.
import { and, desc, eq, inArray } from "drizzle-orm"
import { account, accountDeletions, consentRecords, marketingConsents, member, session, subscriptions, user, type Database } from "@launch-factory/db"

export const EXPORT_FORMAT_VERSION = 1

const iso = (v: Date | null | undefined) => (v ? v.toISOString() : null)

export async function exportMyData(db: Database, userId: string, now: Date = new Date()) {
  const [u] = await db.select().from(user).where(eq(user.id, userId))
  if (!u) return null
  const [accounts, sessions, subs, consents, marketing, memberships, deletions] = await Promise.all([
    db.select({ providerId: account.providerId, accountId: account.accountId, scope: account.scope, createdAt: account.createdAt }).from(account).where(eq(account.userId, userId)),
    db
      .select({ createdAt: session.createdAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(consentRecords).where(eq(consentRecords.userId, userId)).orderBy(consentRecords.createdAt),
    db.select().from(marketingConsents).where(eq(marketingConsents.userId, userId)),
    db.select({ organizationId: member.organizationId, role: member.role, createdAt: member.createdAt }).from(member).where(eq(member.userId, userId)),
    db.select().from(accountDeletions).where(and(eq(accountDeletions.userId, userId), inArray(accountDeletions.status, ["pending", "purging"]))),
  ])
  return {
    format: "launch-factory/my-data",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    profile: { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified, image: u.image, twoFactorEnabled: u.twoFactorEnabled === true, createdAt: iso(u.createdAt), updatedAt: iso(u.updatedAt) },
    signInMethods: accounts.map((a) => ({ provider: a.providerId, providerAccountId: a.accountId, scope: a.scope, linkedAt: iso(a.createdAt) })),
    sessions: sessions.map((s) => ({ createdAt: iso(s.createdAt), expiresAt: iso(s.expiresAt), ipAddress: s.ipAddress, userAgent: s.userAgent })),
    subscriptions: subs.map((s) => ({
      provider: s.provider,
      providerSubscriptionId: s.providerSubId,
      planId: s.planId,
      status: s.status,
      scheduledPlanId: s.scheduledPlanId,
      currentPeriodEnd: iso(s.currentPeriodEnd),
      trialEnd: iso(s.trialEnd),
      cancelAt: iso(s.cancelAt),
      pausedUntil: iso(s.pausedUntil),
      createdAt: iso(s.createdAt),
    })),
    consents: consents.map((c) => ({ kind: c.kind, granted: c.granted, version: c.version, source: c.source, locale: c.locale, subject: c.subject, at: iso(c.createdAt) })),
    marketing: marketing.map((m) => ({ channel: m.channel, granted: m.granted, updatedAt: iso(m.updatedAt) })),
    organizations: memberships.map((m) => ({ organizationId: m.organizationId, role: m.role, joinedAt: iso(m.createdAt) })),
    deletion: deletions[0] ? { status: deletions[0].status, requestedAt: iso(deletions[0].requestedAt), graceUntil: iso(deletions[0].graceUntil) } : null,
  }
}

export type MyData = NonNullable<Awaited<ReturnType<typeof exportMyData>>>
