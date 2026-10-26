// 템플릿의 탈퇴 파기 확장(lib/launch/purgers.ts) — 후기 익명화·올린 파일 정리가 파기 트랜잭션 안에서 함께 돈다.
// 실제 runPurge 로 한 바퀴 돌린다(PGlite 메모리 DB, 결제·계측은 가짜). 템플릿 파일을 그대로 불러 켜 둔 줄이 실제로 걸리는지 본다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { db, reviews, storedFiles, user } from "@launch-factory/db"
import { requestAccountDeletion, runPurge, NO_ANALYTICS_ERASER } from "../src/index.ts"
import { purgers } from "../../../template/lib/launch/purgers.ts"

const KEY = "lf-test-subject-key-not-real-0123456789"
const DAY = 24 * 3600 * 1000

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

const noSubscription = () => ({
  subscription: async () => ({ ok: true, data: { planId: null, status: "none" } }),
  cancel: async () => ({ ok: true, data: { planId: null, status: "none" } }),
})

async function seed(id) {
  const at = new Date(Date.now() - 30 * DAY)
  await d.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: at, updatedAt: at })
  const [review] = await d
    .insert(reviews)
    .values({ kind: "review", subjectType: "product", subjectId: "p1", userId: id, authorName: "홍**", rating: 5, body: "좋아요", locale: "ko", status: "published", createdAt: at, updatedAt: at })
    .returning()
  const fileId = crypto.randomUUID()
  await d.insert(storedFiles).values({ id: fileId, key: `attachment/2026/${fileId}.pdf`, kind: "attachment", contentType: "application/pdf", declaredBytes: 10, fileName: "서류.pdf", userId: id, createdAt: at, expiresAt: null })
  return { reviewId: review.id, fileId }
}

test("템플릿 purgers 는 후기 익명화와 파일 정리 두 줄이다", () => {
  assert.equal(purgers.length, 2)
})

test("탈퇴 파기: 후기는 익명으로 남고 올린 파일은 지울 때로 당겨지며, 남의 것은 그대로다", async () => {
  const mine = await seed("usr_pg_mine")
  const other = await seed("usr_pg_other")
  const t0 = new Date()
  await requestAccountDeletion({ db: d, billingFor: noSubscription, now: () => t0 }, "usr_pg_mine")
  const now = new Date(t0.getTime() + 30 * DAY)
  const r = await runPurge({ db: d, billingFor: noSubscription, subjectKey: KEY, analytics: NO_ANALYTICS_ERASER, purgers, now: () => now })
  assert.equal(r.purged, 1)
  assert.deepEqual(r.failures, [])

  const [review] = await d.select().from(reviews).where(eq(reviews.id, mine.reviewId))
  assert.equal(review.userId, null)
  assert.notEqual(review.authorName, "홍**", "작성자 이름이 가려진다")
  assert.equal(review.body, "좋아요", "글은 공개 콘텐츠라 남는다")

  const [file] = await d.select().from(storedFiles).where(eq(storedFiles.id, mine.fileId))
  assert.equal(file.userId, null, "사용자 행이 지워져 연결이 끊긴다")
  assert.equal(file.fileName, null)
  assert.ok(file.expiresAt && file.expiresAt.getTime() <= now.getTime(), "파일 파기 Cron 이 바로 지울 수 있다")
  assert.equal(file.status, "pending")

  const [keepReview] = await d.select().from(reviews).where(eq(reviews.id, other.reviewId))
  const [keepFile] = await d.select().from(storedFiles).where(eq(storedFiles.id, other.fileId))
  assert.equal(keepReview.userId, "usr_pg_other")
  assert.equal(keepFile.fileName, "서류.pdf")
  assert.equal(keepFile.expiresAt, null)
})
