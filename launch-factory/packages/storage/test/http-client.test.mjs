// HTTP 처리기(상태 코드 규칙)와 브라우저 헬퍼(티켓 → PUT → 끝내기)를 서비스·메모리 저장소와 이어 한 바퀴 돈다. 가짜는 저장소와 fetch 배선뿐이다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { db, hitRateLimit, storedFiles, user as userTable } from "@launch-factory/db"
import { eq } from "drizzle-orm"
import { createRateLimiter } from "@launch-factory/security/rate-limit"
import { createStorageClient } from "../src/client.ts"
import { createStorageHandlers } from "../src/http.ts"
import { createStorageService } from "../src/service.ts"
import { clock, memoryDriver } from "./helpers.mjs"

let d
before(async () => {
  d = await db.local()
  await d.insert(userTable).values({ id: "u-http", name: "u", email: "u-http@example.test", emailVerified: true, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") })
})
after(async () => {
  await d?.$client.close()
})

let wires = 0
function wire({ driver = memoryDriver(), userId = null } = {}) {
  const ip = `203.0.113.${++wires}`
  const c = clock("2026-10-22T00:00:00.000Z")
  const limiter = createRateLimiter({ store: { hit: (k, w, n) => hitRateLimit(d, k, w, n) }, now: c.now })
  const service = createStorageService({ db: d, ...(driver ? { driver } : {}), limiter, now: c.now })
  const handlers = createStorageHandlers({ service, userId: async () => userId })
  const objects = driver?.objects
  /** 브라우저의 fetch — 우리 처리기와 메모리 저장소로 간다 */
  const browserFetch = async (url, init = {}) => {
    const u = String(url)
    const withIp = { ...init, headers: { ...init.headers, "x-forwarded-for": ip } }
    if (u === "/api/storage/ticket") return handlers.ticket(new Request("http://site.test" + u, withIp))
    if (u === "/api/storage/complete") return handlers.complete(new Request("http://site.test" + u, withIp))
    if (u.startsWith("https://mem.test/") && init.method === "PUT") {
      const key = new URL(u).pathname.slice(1)
      const body = new Uint8Array(await new Response(init.body).arrayBuffer())
      objects.set(key, { size: body.length, contentType: new Headers(init.headers).get("content-type") })
      return new Response(null, { status: 200 })
    }
    throw new Error(`unexpected ${init.method} ${u}`)
  }
  const client = createStorageClient({ ticketUrl: "/api/storage/ticket", completeUrl: "/api/storage/complete", fetch: browserFetch })
  return { handlers, client, objects, browserFetch, c }
}
const post = (path, body, headers = {}) => new Request("http://site.test" + path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.77", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })

test("클라이언트 한 바퀴: upload(file, {kind}) → { ok, data: { url, key } } — web-factory StoragePort.upload 모양", async () => {
  const { client, objects } = wire()
  const file = new File([new Uint8Array(500)], "사진.png", { type: "image/png" })
  const r = await client.upload(file, { kind: "image" })
  assert.equal(r.ok, true)
  assert.deepEqual(Object.keys(r.data).sort(), ["key", "url"])
  assert.match(r.data.key, /^image\/2026\/.+\.png$/)
  assert.equal(r.data.url, `https://cdn.test/${r.data.key}`)
  assert.equal(objects.get(r.data.key).contentType, "image/png", "서명한 형식 머리가 그대로 실렸다")
})

test("클라이언트: 형식이 빈 파일은 확장자로 짐작한다(.hwp) · 정책 거절은 서버의 칸 오류 그대로 돌려준다 · 저장소 PUT 이 막히면 다시 시도 안내", async () => {
  const { client, browserFetch, objects } = wire()
  const hwp = new File([new Uint8Array(100)], "계약서.hwp", { type: "" })
  const ok = await client.upload(hwp, { kind: "attachment" })
  assert.equal(ok.ok, true)
  assert.equal(objects.get(ok.data.key).contentType, "application/x-hwp")

  const exe = await client.upload(new File([new Uint8Array(5)], "a.exe", { type: "application/x-msdownload" }), { kind: "attachment" })
  assert.equal(exe.ok, false)
  assert.match(exe.fieldErrors.contentType[0], /PDF/)

  const big = await client.upload(new File([new Uint8Array(3 * 1024 * 1024)], "a.png", { type: "image/png" }), { kind: "avatar" })
  assert.equal(big.ok, false, "avatar 는 비로그인이라 거절")

  const blockedPut = createStorageClient({ ticketUrl: "/api/storage/ticket", completeUrl: "/api/storage/complete", fetch: async (u, init) => (String(u).startsWith("https://mem.test/") ? new Response("denied", { status: 403 }) : browserFetch(u, init)) })
  const r = await blockedPut.upload(new File([new Uint8Array(5)], "a.png", { type: "image/png" }), { kind: "image" })
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.match(r.formError, /couldn't process/)
  const offline = createStorageClient({ ticketUrl: "/t", completeUrl: "/c", fetch: async () => { throw new TypeError("fetch failed") } })
  assert.equal((await offline.upload(new File([new Uint8Array(5)], "a.png", { type: "image/png" }), { kind: "image" })).retryable, true)
})

test("HTTP 상태: 성공 200 · 칸 오류 400 · 로그인 필요 401 · 없음 404 · 아직 안 올림 409 · 규칙 위반 422 · 꺼짐 503 — 본문에 status 칸은 없다", async () => {
  const { handlers, objects } = wire()
  const ok = await handlers.ticket(post("/api/storage/ticket", { kind: "image", contentType: "image/png", size: 10 }))
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get("cache-control"), "no-store")
  const t = (await ok.json()).data
  assert.equal((await handlers.complete(post("/api/storage/complete", { id: t.id }))).status, 409)
  objects.set(t.key, { size: 6 * 1024 * 1024, contentType: "image/png" })
  const rejected = await handlers.complete(post("/api/storage/complete", { id: t.id }))
  assert.equal(rejected.status, 422)
  assert.ok(!("status" in (await rejected.json())))
  assert.equal((await handlers.complete(post("/api/storage/complete", { id: "00000000-0000-4000-8000-000000000000" }))).status, 404)
  assert.equal((await handlers.ticket(post("/api/storage/ticket", { kind: "avatar", contentType: "image/png", size: 10 }))).status, 401)
  assert.equal((await handlers.ticket(post("/api/storage/ticket", { kind: "video", contentType: "x", size: 1 }))).status, 400)
  assert.equal((await handlers.ticket(post("/api/storage/ticket", "not json"))).status, 400)
  assert.equal((await handlers.ticket(new Request("http://site.test/api/storage/ticket"))).status, 405)
  const off = wire({ driver: null })
  const res = await off.handlers.ticket(post("/api/storage/ticket", { kind: "image", contentType: "image/png", size: 10 }))
  assert.equal(res.status, 503)
  assert.equal((await res.json()).code, "provider_unavailable")
})

test("HTTP: 로그인한 사람은 userId 로 연결되어 avatar 도 받고, 시간이 지나면 410, 요청 제한은 429 + Retry-After", async () => {
  const { handlers, objects, c } = wire({ userId: "u-http" })
  const r = await handlers.ticket(post("/api/storage/ticket", { kind: "avatar", contentType: "image/png", size: 10 }, { "x-forwarded-for": "198.51.100.90" }))
  assert.equal(r.status, 200)
  const t = (await r.json()).data
  assert.equal((await d.select().from(storedFiles).where(eq(storedFiles.id, t.id)))[0].userId, "u-http")
  objects.set(t.key, { size: 10, contentType: "image/png" })
  c.tick(25 * 3600_000)
  assert.equal((await handlers.complete(post("/api/storage/complete", { id: t.id }, { "x-forwarded-for": "198.51.100.90" }))).status, 410)
  const limited = wire()
  let last
  for (let i = 0; i < 31; i++) last = await limited.handlers.ticket(post("/api/storage/ticket", { kind: "image", contentType: "image/png", size: 10 }, { "x-forwarded-for": "198.51.100.88" }))
  assert.equal(last.status, 429)
  assert.match(last.headers.get("retry-after"), /^\d+$/)
})
