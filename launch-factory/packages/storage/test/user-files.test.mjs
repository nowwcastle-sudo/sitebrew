// 탈퇴 정리 — 장부에서 지울 때를 당기기만 하고(객체 삭제는 트랜잭션 밖), purgeExpired 가 객체를 지운다. 남의 파일·이미 지운 파일은 건드리지 않는다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { eq } from "drizzle-orm"
import { db, hitRateLimit, storedFiles, user as userTable } from "@launch-factory/db"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createStorageService } from "../src/service.ts"
import { scheduleUserFilesForPurge } from "../src/user-files.ts"
import { clock, memoryDriver } from "./helpers.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  for (const id of ["a", "b"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") })
})
after(async () => {
  await d?.$client.close()
})

const rowOf = async (id) => (await d.select().from(storedFiles).where(eq(storedFiles.id, id)))[0]

test("탈퇴 정리: 그 사람의 파일만 지울 때로 당기고, 파기 Cron 이 객체까지 지운다", async () => {
  const c = clock("2026-10-22T00:00:00.000Z")
  const driver = memoryDriver()
  const limiter = createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: c.now })
  const service = createStorageService({ db: d, driver, limiter, now: c.now })
  let ip = 0
  const upload = async (userId, kind, contentType, fileName) => {
    const t = await service.createUpload({ kind, contentType, size: 1000, fileName }, { ip: `198.51.100.${++ip}`, userId, locale: "en" })
    assert.equal(t.ok, true)
    driver.objects.set(t.data.key, { size: 1000, contentType })
    assert.equal((await service.complete({ id: t.data.id }, { ip: `198.51.100.${++ip}`, userId, locale: "en" })).ok, true)
    return t.data
  }
  const mine = await upload("a", "attachment", "application/pdf", "내 서류.pdf")
  const avatar = await upload("a", "avatar", "image/png", "me.png")
  const other = await upload("b", "attachment", "application/pdf", "other.pdf")

  assert.equal(await scheduleUserFilesForPurge(d, "a", c.now()), 2)
  assert.equal(await scheduleUserFilesForPurge(d, "a", c.now()), 2, "아직 지우기 전이라 다시 불러도 같은 행이 걸린다")
  assert.equal((await rowOf(mine.id)).fileName, null)
  assert.equal((await rowOf(other.id)).fileName, "other.pdf", "남의 파일은 그대로")
  assert.ok(driver.objects.has(mine.key), "장부만 바꿨다 — 객체는 아직 있다")

  c.tick(1000)
  assert.deepEqual(await service.purgeExpired(), { purged: 2, failed: 0 })
  assert.ok(!driver.objects.has(mine.key) && !driver.objects.has(avatar.key))
  assert.ok(driver.objects.has(other.key))
  assert.equal((await rowOf(mine.id)).status, "purged")
  assert.equal(await scheduleUserFilesForPurge(d, "a", c.now()), 0, "지운 행은 건드리지 않는다")
})
