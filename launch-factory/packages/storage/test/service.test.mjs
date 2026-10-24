// 올리기 서비스 한 바퀴 — 정책 거절 표 · 티켓 · 끝내기(실제 크기·형식 확인) · 속임 거절 · 소유 확인 · 만료 파기 · 꺼짐 · 요청 제한 · 비밀값.
// PGlite 메모리 DB 하나를 나눠 쓴다(db.local() 이 마이그레이션을 실제로 적용한다). 저장소는 메모리 드라이버(어댑터만 가짜).
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { count, eq } from "drizzle-orm"
import { db, hitRateLimit, storedFiles, user as userTable } from "@launch-factory/db"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createStorageService } from "../src/service.ts"
import { isStorageKey } from "../src/key.ts"
import { STORAGE_POLICY } from "../src/policy.ts"
import { clock, MB, memoryDriver } from "./helpers.mjs"

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
  for (const id of ["u1", "u2"]) await d.insert(userTable).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") })
})
after(async () => {
  await d?.$client.close()
})

let ipSeq = 0
function setup(over = {}) {
  const c = clock("2026-10-22T00:00:00.000Z")
  const driver = over.driver === null ? undefined : (over.driver ?? memoryDriver())
  const errors = []
  const limiter = createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: c.now })
  const service = createStorageService({ db: d, ...(driver ? { driver } : {}), limiter, now: c.now, onError: (e) => errors.push(e), ...(over.options ?? {}) })
  const ctx = (extra = {}) => ({ ip: `198.51.100.${(ipSeq = (ipSeq % 250) + 1)}`, locale: "en", ...extra })
  return { c, driver, service, errors, ctx }
}
const rows = async () => (await d.select({ n: count() }).from(storedFiles))[0].n
const rowOf = async (id) => (await d.select().from(storedFiles).where(eq(storedFiles.id, id)))[0]
const ask = { kind: "image", contentType: "image/png", size: 1000 }

test("티켓: 키는 종류/연도/uuid.확장자, 사용자 파일명은 키에 없고, pending 행과 15분 PUT 주소가 나온다", async () => {
  const { service, driver, ctx, c } = setup()
  const r = await service.createUpload({ ...ask, fileName: "../../내 사진 final.png" }, ctx())
  assert.equal(r.ok, true)
  const t = r.data
  assert.match(t.key, /^image\/2026\/[0-9a-f-]{36}\.png$/)
  assert.ok(isStorageKey(t.key))
  assert.ok(!t.key.includes("final"), "파일명은 키에 없다")
  assert.equal(t.id, t.key.split("/")[2].split(".")[0])
  assert.equal(t.method, "PUT")
  assert.deepEqual(t.headers, { "content-type": "image/png" })
  assert.equal(t.maxBytes, STORAGE_POLICY.image.maxBytes)
  assert.equal(t.expiresAt, new Date(c.at.getTime() + 900_000).toISOString())
  assert.ok(t.url.includes(t.key))
  assert.deepEqual(driver.calls.presign.map((p) => [p.method, p.expiresIn]), [["PUT", 900]], "서명 만료는 900초 이하")
  const row = await rowOf(t.id)
  assert.equal(row.status, "pending")
  assert.equal(row.fileName, "내 사진 final.png", "화면 이름은 정리해서 따로 둔다(경로 앞부분 제거)")
  assert.equal(row.declaredBytes, 1000)
  assert.equal(row.userId, null)
  assert.equal(row.expiresAt.toISOString(), new Date(c.at.getTime() + 24 * 3600_000).toISOString(), "끝내지 않으면 24시간 뒤 파기")
})

test("정책 거절 표: 크기·형식·종류·avatar 비로그인 — 행도 서명도 만들지 않고 칸 오류로 돌려준다", async () => {
  const { service, driver, ctx } = setup()
  const before = await rows()
  const cases = [
    [{ ...ask, size: 5 * MB + 1 }, {}, "size", /5 MB/],
    [{ ...ask, size: 0 }, {}, "size", /empty/],
    [{ ...ask, contentType: "image/svg+xml" }, {}, "contentType", /PNG, JPG, WEBP, AVIF/],
    [{ ...ask, kind: "video" }, {}, "kind", /valid kind/],
    [{ kind: "avatar", contentType: "image/png", size: 10 }, {}, null, /Sign in/],
    [{ kind: "avatar", contentType: "image/avif", size: 10 }, { userId: "u1" }, "contentType", /PNG, JPG, WEBP\./],
    [{ kind: "attachment", contentType: "application/x-msdownload", size: 10 }, {}, "contentType", /PDF/],
  ]
  for (const [input, extra, field, text] of cases) {
    const r = await service.createUpload(input, ctx(extra))
    assert.equal(r.ok, false, JSON.stringify(input))
    if (field) assert.match(r.fieldErrors[field][0], text, JSON.stringify(input))
    else assert.match(r.formError, text)
    assert.equal(r.retryable, false)
  }
  assert.equal(await rows(), before, "거절된 요청은 행을 만들지 않는다")
  assert.equal(driver.calls.presign.length, 0)
  // 한국어
  const ko = await service.createUpload({ ...ask, size: 5 * MB + 1 }, ctx({ locale: "ko" }))
  assert.match(ko.fieldErrors.size[0], /5MB 이하로/)
  // 대조군: avatar 는 로그인하면 된다
  const ok = await service.createUpload({ kind: "avatar", contentType: "image/png", size: 10 }, ctx({ userId: "u1" }))
  assert.equal(ok.ok, true)
  assert.equal((await rowOf(ok.data.id)).userId, "u1")
})

test("끝내기: 올린 객체의 실제 크기·형식을 확인하고 ready — 공개 종류는 공개 주소, 보유 기간 없는 종류는 expiresAt 이 비는다", async () => {
  const { service, driver, ctx, c } = setup()
  const t = (await service.createUpload(ask, ctx())).data
  driver.objects.set(t.key, { size: 900, contentType: "image/png" })
  c.tick(60_000)
  const r = await service.complete({ id: t.id }, ctx())
  assert.equal(r.ok, true)
  assert.deepEqual(r.data, { id: t.id, key: t.key, url: `https://cdn.test/${t.key}`, kind: "image", contentType: "image/png", size: 900 })
  const row = await rowOf(t.id)
  assert.equal(row.status, "ready")
  assert.equal(row.sizeBytes, 900)
  assert.equal(row.expiresAt, null)
  assert.equal(row.completedAt.toISOString(), c.at.toISOString())
  // 두 번 끝내도 같은 결과, 행은 한 번만 바뀐다
  c.tick(1000)
  const again = await service.complete({ id: t.id }, ctx())
  assert.deepEqual(again, r)
  assert.equal((await rowOf(t.id)).completedAt.toISOString(), new Date("2026-10-22T00:01:00.000Z").toISOString())
})

test("끝내기: 비공개 종류(attachment)는 짧은 GET 서명 주소와 보유 365일", async () => {
  const { service, driver, ctx, c } = setup()
  const t = (await service.createUpload({ kind: "attachment", contentType: "application/pdf", size: 4 * MB, fileName: "a.pdf" }, ctx({ userId: "u1" }))).data
  driver.objects.set(t.key, { size: 4 * MB, contentType: "application/pdf" })
  const r = await service.complete({ id: t.id }, ctx({ userId: "u1" }))
  assert.equal(r.ok, true)
  assert.equal(r.data.url, `https://mem.test/${t.key}?m=GET&e=900`)
  assert.equal(r.data.urlExpiresAt, new Date(c.at.getTime() + 900_000).toISOString())
  assert.equal((await rowOf(t.id)).expiresAt.toISOString(), new Date(c.at.getTime() + 365 * 86_400_000).toISOString())
})

test("끝내기: 아직 안 올렸으면 다시 시도할 수 있는 안내이고 행은 pending 그대로", async () => {
  const { service, ctx } = setup()
  const t = (await service.createUpload(ask, ctx())).data
  const r = await service.complete({ id: t.id }, ctx())
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.match(r.formError, /hasn't arrived/)
  assert.equal((await rowOf(t.id)).status, "pending")
})

test("크기 속임 거절: 작다고 알리고 정책 상한을 넘는 객체를 올리면 객체를 지우고 거절한다(행은 purged)", async () => {
  const { service, driver, ctx } = setup()
  const t = (await service.createUpload(ask, ctx())).data
  driver.objects.set(t.key, { size: 6 * MB, contentType: "image/png" })
  const r = await service.complete({ id: t.id }, ctx())
  assert.equal(r.ok, false)
  assert.equal(r.retryable, false)
  assert.match(r.formError, /removed it/)
  assert.deepEqual(driver.calls.delete, [t.key])
  assert.equal(driver.objects.has(t.key), false)
  const row = await rowOf(t.id)
  assert.equal(row.status, "purged")
  assert.equal(row.fileName, null)
  // 지운 뒤 다시 끝내려 하면 없는 파일이다
  assert.match((await service.complete({ id: t.id }, ctx())).formError, /couldn't find/)
})

test("형식 속임 거절: 저장소가 알려 준 형식이 서명한 형식과 다르거나 크기가 0 이면 지우고 거절한다", async () => {
  const { service, driver, ctx } = setup()
  const a = (await service.createUpload(ask, ctx())).data
  driver.objects.set(a.key, { size: 100, contentType: "text/html" })
  assert.equal((await service.complete({ id: a.id }, ctx())).ok, false)
  assert.equal(driver.objects.has(a.key), false)
  const b = (await service.createUpload(ask, ctx())).data
  driver.objects.set(b.key, { size: 0, contentType: "image/png" })
  assert.equal((await service.complete({ id: b.id }, ctx())).ok, false)
  assert.equal(driver.objects.has(b.key), false)
  // 형식을 알려 주지 않는 저장소(null)는 서명이 형식을 묶으므로 받는다
  const c2 = (await service.createUpload(ask, ctx())).data
  driver.objects.set(c2.key, { size: 100, contentType: null })
  assert.equal((await service.complete({ id: c2.id }, ctx())).ok, true)
})

test("소유 확인: 로그인한 사람이 만든 티켓은 그 사람만 끝낸다 — 남·비로그인은 없는 파일처럼 본다. 비로그인이 만든 티켓은 id 를 가진 사람이 끝낸다", async () => {
  const { service, driver, ctx } = setup()
  const mine = (await service.createUpload({ kind: "avatar", contentType: "image/png", size: 10 }, ctx({ userId: "u1" }))).data
  driver.objects.set(mine.key, { size: 10, contentType: "image/png" })
  for (const extra of [{ userId: "u2" }, {}]) {
    const r = await service.complete({ id: mine.id }, ctx(extra))
    assert.equal(r.ok, false)
    assert.match(r.formError, /couldn't find/)
  }
  assert.equal((await rowOf(mine.id)).status, "pending", "남이 끝낼 수 없다")
  assert.equal((await service.complete({ id: mine.id }, ctx({ userId: "u1" }))).ok, true)
  const anon = (await service.createUpload(ask, ctx())).data
  driver.objects.set(anon.key, { size: 10, contentType: "image/png" })
  assert.equal((await service.complete({ id: anon.id }, ctx({ userId: "u2" }))).ok, true)
  // 모양이 틀린 id
  assert.match((await service.complete({ id: "../x" }, ctx())).formError, /couldn't find/)
  assert.match((await service.complete({}, ctx())).formError, /couldn't find/)
})

test("끝내기 시한: 올리기를 시작하고 24시간이 지나면 끝낼 수 없다", async () => {
  const { service, driver, ctx, c } = setup()
  const t = (await service.createUpload(ask, ctx())).data
  driver.objects.set(t.key, { size: 10, contentType: "image/png" })
  c.tick(24 * 3600_000 + 1)
  const r = await service.complete({ id: t.id }, ctx())
  assert.equal(r.ok, false)
  assert.match(r.formError, /timed out/)
  assert.equal((await rowOf(t.id)).status, "pending", "지우는 일은 파기 Cron 이 한다")
})

test("내려받기 주소: 비공개는 올린 사람과 관리자만, 공개는 누구나, 끝나지 않은 파일은 없다", async () => {
  const { service, driver, ctx } = setup()
  const file = async (kind, contentType, userId) => {
    const t = (await service.createUpload({ kind, contentType, size: 100 }, ctx(userId ? { userId } : {}))).data
    driver.objects.set(t.key, { size: 100, contentType })
    await service.complete({ id: t.id }, ctx(userId ? { userId } : {}))
    return t
  }
  const priv = await file("attachment", "application/pdf", "u1")
  const own = await service.getDownloadUrl({ id: priv.id }, { userId: "u1" })
  assert.equal(own.ok, true)
  assert.match(own.data.url, /m=GET&e=900/)
  assert.equal((await service.getDownloadUrl({ id: priv.id }, { userId: "u2" })).ok, false)
  assert.equal((await service.getDownloadUrl({ id: priv.id }, {})).ok, false)
  assert.equal((await service.getDownloadUrl({ id: priv.id }, { userId: "u2", isAdmin: true })).ok, true)
  const anonPriv = await file("attachment", "application/pdf", null)
  assert.equal((await service.getDownloadUrl({ id: anonPriv.id }, { userId: "u1" })).ok, false, "주인이 없는 비공개는 관리자만")
  assert.equal((await service.getDownloadUrl({ id: anonPriv.id }, { isAdmin: true })).ok, true)
  const pub = await file("image", "image/png", null)
  assert.deepEqual((await service.getDownloadUrl({ id: pub.id }, {})).data, { url: `https://cdn.test/${pub.key}` })
  const pending = (await service.createUpload(ask, ctx())).data
  assert.equal((await service.getDownloadUrl({ id: pending.id }, { isAdmin: true })).ok, false)
})

test("파기: 끝내지 않은 것(24시간)과 보유 기간(365일)이 지난 것의 객체를 지우고 행에 purgedAt — 보유 기간 없는 ready 는 남는다", async () => {
  const { service, driver, ctx, c } = setup()
  const make = async (input, ready) => {
    const t = (await service.createUpload(input, ctx({ userId: "u1" }))).data
    driver.objects.set(t.key, { size: 10, contentType: input.contentType })
    if (ready) await service.complete({ id: t.id }, ctx({ userId: "u1" }))
    return t
  }
  const abandoned = await make({ ...ask, fileName: "x.png" }, false)
  const attach = await make({ kind: "attachment", contentType: "application/pdf", size: 10, fileName: "secret.pdf" }, true)
  const keeper = await make({ kind: "avatar", contentType: "image/png", size: 10 }, true)
  const recent = await make(ask, false)

  c.tick(24 * 3600_000 + 1000)
  await service.createUpload(ask, ctx()) // 시계가 간 뒤에 만든 새 pending 은 남는다
  let r = await service.purgeExpired()
  assert.equal(r.failed, 0)
  assert.ok(r.purged >= 2, "끝내지 않은 둘(abandoned·recent) 이상(다른 시험이 남긴 만료 행도 지운다)")
  assert.equal(driver.objects.has(abandoned.key), false)
  assert.equal(driver.objects.has(recent.key), false)
  assert.equal(driver.objects.has(attach.key), true)
  const gone = await rowOf(abandoned.id)
  assert.equal(gone.status, "purged")
  assert.equal(gone.fileName, null)
  assert.equal(gone.purgedAt.toISOString(), c.at.toISOString())

  c.tick(365 * 86_400_000)
  r = await service.purgeExpired()
  assert.equal(r.failed, 0)
  assert.equal(driver.objects.has(attach.key), false)
  assert.equal((await rowOf(attach.id)).status, "purged")
  assert.equal((await rowOf(attach.id)).fileName, null)
  assert.equal(driver.objects.has(keeper.key), true, "보유 기간 없는 공개 종류는 남는다")
  assert.equal((await rowOf(keeper.id)).status, "ready")
  assert.deepEqual(await service.purgeExpired(), { purged: 0, failed: 0 }, "다시 돌려도 더 지울 것이 없다")
})

test("파기: 객체 삭제가 실패하면 행을 purged 로 적지 않고 다음에 다시 시도한다(실패 수를 센다)", async () => {
  const driver = memoryDriver({ failDelete: true })
  const { service, ctx, c, errors } = setup({ driver })
  const t = (await service.createUpload(ask, ctx())).data
  driver.objects.set(t.key, { size: 10, contentType: "image/png" })
  c.tick(25 * 3600_000)
  const r = await service.purgeExpired()
  assert.equal(r.failed >= 1, true)
  assert.equal((await rowOf(t.id)).status, "pending")
  assert.ok(errors.length >= 1)
  assert.ok(errors.every((e) => !String(e.message).includes("boom")), "저장소 오류 원문은 로그에 싣지 않는다")
})

test("꺼짐: 드라이버가 없으면(환경 이름이 없을 때) 접수는 provider_unavailable — 저장도 요청 제한도 없고 사이트는 켜진다", async () => {
  const { service, ctx } = setup({ driver: null })
  assert.equal(service.enabled, false)
  const before = await rows()
  const r = await service.createUpload(ask, ctx())
  assert.deepEqual(r, { ok: false, code: "provider_unavailable", retryable: false, formError: "Uploads aren't available right now." })
  assert.equal((await service.complete({ id: "00000000-0000-4000-8000-000000000000" }, ctx())).code, "provider_unavailable")
  assert.equal((await service.getDownloadUrl({ id: "x" }, { isAdmin: true })).code, "provider_unavailable")
  assert.equal(await rows(), before)
  assert.deepEqual(await service.purgeExpired(), { purged: 0, failed: 0 }, "객체를 지울 길이 없으면 행을 건드리지 않는다")
})

test("요청 제한: 한도를 넘으면 429 모양(rate_limited + retryAfter) — 티켓·끝내기가 같은 경로를 센다", async () => {
  const { service, ctx } = setup()
  const who = ctx()
  for (let i = 0; i < 30; i++) assert.equal((await service.createUpload({ ...ask, size: 0 }, who)).code, undefined, `${i + 1}번째는 검사에서 거절될 뿐 제한은 아니다`)
  const blocked = await service.createUpload(ask, who)
  assert.equal(blocked.code, "rate_limited")
  assert.ok(blocked.retryAfter >= 1)
  assert.equal((await service.complete({ id: "00000000-0000-4000-8000-000000000000" }, who)).code, "rate_limited")
})

test("비밀값: 서명·저장소 오류의 원문(자격 증명이 든 문구)은 응답에도 로그에도 없다", async () => {
  const secret = "SUPERSECRETVALUE"
  const driver = memoryDriver({ failPresign: new Error(`bad credentials ${secret}`) })
  const { service, ctx, errors } = setup({ driver })
  const r = await service.createUpload(ask, ctx())
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.ok(!JSON.stringify(r).includes(secret))
  assert.ok(errors.length === 1 && !errors[0].message.includes(secret), errors[0]?.message)
})
