// 파일 올리기 접착(live · 저장소 설정 없음): 사이트는 켜지고 올리기만 꺼진다 — 문의 창구(LFENV)와 같은 방식.
// 티켓·끝내기는 provider_unavailable(503), 파기 Cron 은 그대로 돌고(0), 로컬 폴더 경로는 live 에서 404 다. 반쯤 켜진 설정도 꺼진 것으로 본다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { FAKE_STORAGE_ENV, postJson, setupStorageGlue } from "./storage-glue-setup.mjs"

let g
before(async () => {
  for (const n of Object.keys(FAKE_STORAGE_ENV)) delete process.env[n]
  g = await setupStorageGlue({ mode: "live" })
})
after(async () => {
  await g?.close()
})

const body = { kind: "image", contentType: "image/png", size: 1024 }

test("live 에 STORAGE_* 가 없으면 storageEnabled 는 false, 하나라도 빠진 설정도 false, 다섯이 다 있어야 true", () => {
  assert.equal(g.lib.storageEnabled(), false)
  for (const skip of Object.keys(FAKE_STORAGE_ENV)) {
    for (const [n, v] of Object.entries(FAKE_STORAGE_ENV)) if (n !== skip) process.env[n] = v
    assert.equal(g.lib.storageEnabled(), false, `${skip} 없이`)
    for (const n of Object.keys(FAKE_STORAGE_ENV)) delete process.env[n]
  }
  Object.assign(process.env, FAKE_STORAGE_ENV)
  assert.equal(g.lib.storageEnabled(), true)
  for (const n of Object.keys(FAKE_STORAGE_ENV)) delete process.env[n]
  g.state.mode = "mock"
  assert.equal(g.lib.storageEnabled(), true, "mock 은 이름이 없어도 폴더로 켜진다")
  g.state.mode = "live"
})

test("티켓·끝내기는 503 provider_unavailable — 받은 척 장부에 쓰지 않는다", async () => {
  const ticket = await (await g.route("storage/ticket")).POST(postJson("https://x.test/api/storage/ticket", body))
  assert.equal(ticket.status, 503)
  assert.equal((await ticket.json()).code, "provider_unavailable")
  const done = await (await g.route("storage/complete")).POST(postJson("https://x.test/api/storage/complete", { id: "2f1c5a3e-5b6d-4c1e-9a4b-0d2f4c6a8e10" }))
  assert.equal(done.status, 503)
  const rows = await g.db.$client.query("select count(*)::int as n from stored_files")
  assert.equal(rows.rows[0].n, 0)
})

test("파기 Cron 은 꺼진 채로도 돈다(0), 로컬 폴더 경로는 live 에서 GET·PUT 모두 404", async () => {
  const cron = await (await g.route("cron/storage")).GET(new Request("https://x.test/api/cron/storage"))
  assert.deepEqual(await cron.json(), { purged: 0, failed: 0 })
  const local = await g.route("storage/local/[...key]")
  const url = "https://x.test/api/storage/local/image/2026/2f1c5a3e-5b6d-4c1e-9a4b-0d2f4c6a8e10.png"
  assert.equal((await local.GET(new Request(url))).status, 404)
  assert.equal((await local.PUT(new Request(url, { method: "PUT", body: "x" }))).status, 404)
})
