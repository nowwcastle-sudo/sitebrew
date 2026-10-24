// 파일 올리기 접착(mock): 같은 서비스 코드가 폴더 드라이버로 한 바퀴 돈다 — 티켓 → 로컬 경로로 PUT → 끝내기 → 공개 읽기.
// 같은 경로는 모드가 live 로 바뀌면 곧바로 404 다(조립이 캐시돼도 모드를 매번 본다).
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { postJson, setupStorageGlue } from "./storage-glue-setup.mjs"

let g
before(async () => {
  g = await setupStorageGlue({ mode: "mock" })
})
after(async () => {
  await g?.close()
})

const ORIGIN = "https://x.test"
const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex")

test("mock 한 바퀴: 티켓(상대 주소) → PUT → 끝내기 → 공개 종류는 서명 없이 읽힌다", async () => {
  const ticketRes = await (await g.route("storage/ticket")).POST(postJson(`${ORIGIN}/api/storage/ticket`, { kind: "image", contentType: "image/png", size: png.length }))
  assert.equal(ticketRes.status, 200)
  const t = (await ticketRes.json()).data
  assert.ok(t.url.startsWith("/api/storage/local/image/"), t.url)
  const local = await g.route("storage/local/[...key]")

  assert.equal((await local.PUT(new Request(`${ORIGIN}${t.url}`, { method: "PUT", headers: t.headers, body: png }))).status, 200)
  assert.ok(existsSync(join(process.cwd(), ".tmp", "uploads")), "폴더는 프로세스 작업 폴더의 .tmp/uploads 아래")

  const done = await (await g.route("storage/complete")).POST(postJson(`${ORIGIN}/api/storage/complete`, { id: t.id }))
  assert.equal(done.status, 200)
  const file = (await done.json()).data
  assert.equal(file.size, png.length)

  const read = await local.GET(new Request(`${ORIGIN}${file.url}`))
  assert.equal(read.status, 200)
  assert.deepEqual(Buffer.from(await read.arrayBuffer()), png)
})

test("서명 없는 PUT 은 거절되고, 모드가 live 가 되면 같은 경로가 404 다", async () => {
  const local = await g.route("storage/local/[...key]")
  const bare = `${ORIGIN}/api/storage/local/image/2026/2f1c5a3e-5b6d-4c1e-9a4b-0d2f4c6a8e10.png`
  assert.equal((await local.PUT(new Request(bare, { method: "PUT", headers: { "content-type": "image/png" }, body: png }))).status, 403)
  g.state.mode = "live"
  assert.equal((await local.PUT(new Request(bare, { method: "PUT", body: png }))).status, 404)
  assert.equal((await local.GET(new Request(bare))).status, 404)
  g.state.mode = "mock"
})
