// 올린 파일 장부 저장·조회(계획 3c Task 3). 정책 판단·객체 입출력은 @launch-factory/storage 가 한다.
import { and, eq, isNotNull, lt, ne } from "drizzle-orm"
import type { Database } from "./client.ts"
import { storedFiles } from "./schema.ts"

export type NewStoredFile = Omit<typeof storedFiles.$inferInsert, "status" | "sizeBytes" | "completedAt" | "purgedAt">
export type StoredFileRow = typeof storedFiles.$inferSelect

export async function insertStoredFile(d: Database, row: NewStoredFile): Promise<StoredFileRow> {
  const [saved] = await d.insert(storedFiles).values(row).returning()
  return saved as StoredFileRow
}

export async function getStoredFile(d: Database, id: string): Promise<StoredFileRow | null> {
  const [row] = await d.select().from(storedFiles).where(eq(storedFiles.id, id))
  return row ?? null
}

/** pending → ready. 이미 끝난 행이면 null(두 번 끝내도 한 번만 바뀐다 — 부르는 쪽이 행을 다시 읽는다) */
export async function markStoredFileReady(d: Database, id: string, o: { sizeBytes: number; at: Date; expiresAt: Date | null }): Promise<StoredFileRow | null> {
  const [row] = await d
    .update(storedFiles)
    .set({ status: "ready", sizeBytes: o.sizeBytes, completedAt: o.at, expiresAt: o.expiresAt })
    .where(and(eq(storedFiles.id, id), eq(storedFiles.status, "pending")))
    .returning()
  return row ?? null
}

/** 지울 때가 된 파일(아직 지우지 않은 것 중 expires_at 이 지났다). 오래된 것부터 limit 개 */
export async function listExpiredStoredFiles(d: Database, now: Date, limit = 100): Promise<StoredFileRow[]> {
  return d
    .select()
    .from(storedFiles)
    .where(and(ne(storedFiles.status, "purged"), isNotNull(storedFiles.expiresAt), lt(storedFiles.expiresAt, now)))
    .orderBy(storedFiles.expiresAt)
    .limit(limit)
}

/** 객체를 지웠다고 적는다(파일 이름은 비운다). 이미 지운 행이면 false */
export async function markStoredFilePurged(d: Database, id: string, at: Date): Promise<boolean> {
  const rows = await d
    .update(storedFiles)
    .set({ status: "purged", purgedAt: at, fileName: null })
    .where(and(eq(storedFiles.id, id), ne(storedFiles.status, "purged")))
    .returning({ id: storedFiles.id })
  return rows.length > 0
}

/**
 * 탈퇴하는 사람의 파일을 지울 때가 됐다고 적는다 — expires_at 을 지금으로 당기고 파일 이름을 비운다.
 * 객체 삭제는 저장소 입출력이라 DB 트랜잭션 안에서 하지 않는다. 장부만 바꾸면 파기 Cron(또는 purgeExpired)이 객체를 지운다.
 * 다시 불러도 결과가 같다. 바꾼 행의 수를 돌려준다.
 */
export async function scheduleUserFilesPurge(d: Database, userId: string, at: Date): Promise<number> {
  const rows = await d
    .update(storedFiles)
    .set({ expiresAt: at, fileName: null })
    .where(and(eq(storedFiles.userId, userId), ne(storedFiles.status, "purged")))
    .returning({ id: storedFiles.id })
  return rows.length
}
