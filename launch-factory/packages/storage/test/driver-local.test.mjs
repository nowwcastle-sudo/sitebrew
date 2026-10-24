// 로컬 폴더 드라이버(mock 전용) — 서비스와 한 바퀴(티켓 → PUT → 끝내기 → GET), 서명·형식·크기·키 모양 거절, 비밀 파일 영속.
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { db, hitRateLimit } from "@launch-factory/db"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createLocalDriver } from "../src/driver-local.ts"
import { createStorageService } from "../src/service.ts"
import { clock } from "./helpers.mjs"

let d
const dirs = []
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "lf-uploads-"))
  dirs.push(dir)
  const c = clock("2026-10-22T00:00:00.000Z")
  const driver = createLocalDriver({ dir, now: c.now })
  const limiter = createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: c.now })
  const service = createStorageService({ db: d, driver, limiter, now: c.now })
  return { dir, c, driver, service }
}
const ORIGIN = "http://localhost:3000"
const put = (driver, ticket, body, headers = ticket.headers) => driver.handle(new Request(ORIGIN + ticket.url, { method: "PUT", headers, body }))
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

test("한 바퀴: 티켓 → PUT → 끝내기(디스크에서 크기·형식 확인) → 공개 종류는 서명 없이 GET, 비공개는 서명 있어야 GET", async () => {
  const { dir, driver, service } = setup()
  const t = (await service.createUpload({ kind: "image", contentType: "image/png", size: PNG.length }, { ip: "198.51.100.9" })).data
  assert.ok(t.url.startsWith("/api/storage/local/image/2026/"), "상대 주소다 — 어느 호스트에서 열어도 같은 서버로 간다")
  assert.equal((await put(driver, t, PNG)).status, 200)
  assert.deepEqual(readFileSync(join(dir, t.key)), Buffer.from(PNG))
  const done = await service.complete({ id: t.id }, { ip: "198.51.100.9" })
  assert.equal(done.ok, true)
  assert.equal(done.data.size, PNG.length)
  assert.equal(done.data.url, `/api/storage/local/${t.key}`)
  const got = await driver.handle(new Request(ORIGIN + done.data.url))
  assert.equal(got.status, 200)
  assert.equal(got.headers.get("content-type"), "image/png")
  assert.equal(got.headers.get("x-content-type-options"), "nosniff")
  assert.deepEqual(new Uint8Array(await got.arrayBuffer()), PNG)

  const a = (await service.createUpload({ kind: "attachment", contentType: "application/pdf", size: 3 }, { ip: "198.51.100.9" })).data
  await put(driver, a, new Uint8Array([1, 2, 3]))
  const adone = (await service.complete({ id: a.id }, { ip: "198.51.100.9" })).data
  assert.equal((await driver.handle(new Request(ORIGIN + `/api/storage/local/${a.key}`))).status, 403, "서명 없는 비공개 읽기는 거절")
  const signed = await driver.handle(new Request(ORIGIN + adone.url))
  assert.equal(signed.status, 200)
  assert.match(signed.headers.get("content-disposition"), /^attachment/, "비공개 첨부는 열지 않고 내려받는다")
})

test("PUT 거절: 서명 없음·바뀐 서명·다른 content-type·다른 메서드·만료 · 정책 상한을 넘는 몸통(413) · 키 모양이 틀린 경로(404)", async () => {
  const { driver, service, c } = setup()
  const t = (await service.createUpload({ kind: "image", contentType: "image/png", size: 10 }, { ip: "198.51.100.20" })).data
  assert.equal((await driver.handle(new Request(ORIGIN + t.url.split("?")[0], { method: "PUT", body: PNG, headers: t.headers }))).status, 403, "서명 없음")
  assert.equal((await put(driver, t, PNG, { "content-type": "text/html" })).status, 403, "서명한 형식이 아니다")
  assert.equal((await put(driver, t, PNG, {})).status, 403, "형식 머리가 없다")
  assert.equal((await put(driver, { ...t, url: t.url.replace(/(Signature=)([0-9a-f])/, (_m, k, c) => k + (c === "0" ? "1" : "0")) }, PNG)).status, 403, "서명이 바뀌었다")
  assert.equal((await driver.handle(new Request(ORIGIN + t.url, { method: "POST", body: PNG, headers: t.headers }))).status, 405)
  const swapped = t.url.replace(t.key, "image/2026/11111111-1111-4111-8111-111111111111.png")
  assert.equal((await put(driver, { ...t, url: swapped }, PNG)).status, 403, "다른 키로 바꾸면 서명이 어긋난다")
  assert.equal((await driver.handle(new Request(ORIGIN + t.url.replace(t.key, "image/2026/../../../etc/passwd"), { method: "PUT", body: PNG, headers: t.headers }))).status, 404, "경로 이동은 주소 정규화 뒤 이 경로가 아니다")
  assert.equal((await driver.handle(new Request(ORIGIN + "/api/storage/local/..%2F..%2Fetc%2Fpasswd"))).status, 404)
  const big = new Uint8Array(10 * 1024 * 1024 + 1)
  assert.equal((await put(driver, t, big)).status, 413, "가장 큰 정책 상한(10MB)을 넘는 몸통은 디스크에 쓰지 않는다")
  c.tick(901_000)
  assert.equal((await put(driver, t, PNG)).status, 403, "15분이 지났다")
})

test("크기 속임: 작다고 알리고 정책 상한(image 5MB)을 넘는 파일을 올리면 끝내기가 거절하고 디스크의 파일을 지운다", async () => {
  const { dir, service, driver } = setup()
  const t = (await service.createUpload({ kind: "image", contentType: "image/png", size: 10 }, { ip: "198.51.100.30" })).data
  assert.equal((await put(driver, t, new Uint8Array(6 * 1024 * 1024))).status, 200, "로컬 경로의 몸통 상한은 가장 큰 정책(10MB)이라 올라간다")
  assert.equal(existsSync(join(dir, t.key)), true)
  const r = await service.complete({ id: t.id }, { ip: "198.51.100.30" })
  assert.equal(r.ok, false)
  assert.equal(existsSync(join(dir, t.key)), false)
})

test("head·delete: 디스크 왕복 — 없으면 null, 지우면 없어지고 두 번 지워도 오류가 없다. 키 모양이 틀리면 던진다", async () => {
  const { dir, driver, c } = setup()
  const key = "image/2026/0b9f3c2a-6c1d-4d57-9a53-0f3e7f6a1b2c.png"
  assert.equal(await driver.head(key), null)
  const r = await driver.handle(new Request(ORIGIN + driver.presign({ method: "PUT", key, contentType: "image/png", expiresIn: 900, now: c.now() }).url, { method: "PUT", body: PNG, headers: { "content-type": "image/png" } }))
  assert.equal(r.status, 200)
  assert.deepEqual(await driver.head(key), { size: PNG.length, contentType: "image/png" })
  await driver.delete(key)
  await driver.delete(key)
  assert.equal(await driver.head(key), null)
  assert.equal(existsSync(join(dir, key)), false)
  await assert.rejects(driver.head("../x"), /key/)
  await assert.rejects(driver.delete("../../x"), /key/)
})

test("비밀 파일: 폴더에 한 번 만들고 다시 열어도 같다(다른 모듈 사본·재시작에서도 티켓이 통한다) · 서명은 비밀이 다르면 거절", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-uploads-"))
  dirs.push(dir)
  const a = createLocalDriver({ dir })
  const b = createLocalDriver({ dir })
  const key = "image/2026/0b9f3c2a-6c1d-4d57-9a53-0f3e7f6a1b2c.png"
  const p = a.presign({ method: "PUT", key, contentType: "image/png", expiresIn: 900, now: new Date() })
  assert.equal((await b.handle(new Request(ORIGIN + p.url, { method: "PUT", body: PNG, headers: p.headers }))).status, 200)
  const other = mkdtempSync(join(tmpdir(), "lf-uploads-"))
  dirs.push(other)
  assert.equal((await createLocalDriver({ dir: other }).handle(new Request(ORIGIN + p.url, { method: "PUT", body: PNG, headers: p.headers }))).status, 403)
  // 비밀 파일 자체는 어떤 요청으로도 읽히지 않는다
  assert.equal((await a.handle(new Request(ORIGIN + "/api/storage/local/.secret"))).status, 404)
})
