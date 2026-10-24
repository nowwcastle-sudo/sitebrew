// 알림톡·문자 발송 기록(계획 3b). 보내기·동의 검사는 @launch-factory/notify-kr 가 한다.
import { eq, lt } from "drizzle-orm"
import type { Database } from "./client.ts"
import { notifications } from "./schema.ts"

export type NewNotification = Omit<typeof notifications.$inferInsert, "id">
export type NotificationRow = typeof notifications.$inferSelect

export const NOTIFICATION_RETENTION_DAYS = 365

/**
 * 멱등 키를 먼저 차지한다. 차지했으면 행을 돌려주고(그 쪽이 보낸다), 이미 있으면 undefined(보내지 않는다).
 * status 는 차지할 때 "failed" 로 두었다가 결과가 나오면 settleNotification 으로 고친다 — 보내다 죽은 요청이 「보냈다」로 남지 않게.
 */
export async function claimNotification(d: Database, row: NewNotification): Promise<NotificationRow | undefined> {
  const [saved] = await d.insert(notifications).values(row).onConflictDoNothing().returning()
  return saved
}

export async function settleNotification(d: Database, id: string, set: Pick<NewNotification, "status"> & Partial<Pick<NewNotification, "channel" | "reason" | "providerRef">>): Promise<void> {
  await d.update(notifications).set(set).where(eq(notifications.id, id))
}

export async function purgeExpiredNotifications(d: Database, now: Date): Promise<number> {
  const rows = await d.delete(notifications).where(lt(notifications.expiresAt, now)).returning({ id: notifications.id })
  return rows.length
}
