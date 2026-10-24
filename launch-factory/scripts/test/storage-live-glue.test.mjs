// 파일 올리기 접착(live · 저장소 설정 있음): 티켓은 설정한 종단점의 SigV4 서명 주소(브라우저가 직접 PUT)이고, 로컬 폴더 경로는 여전히 404 다.
// 저장소 호출은 하지 않는다(서명은 순수 계산) — 응답·장부에 비밀 키가 없는지도 본다.
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { FAKE_STORAGE_ENV, postJson, setupStorageGlue } from "./storage-glue-setup.mjs"

let g
before(async () => {
  Object.assign(process.env, FAKE_STORAGE_ENV)
  g = await setupStorageGlue({ mode: "live", userId: null })
})
after(async () => {
  for (const n of Object.keys(FAKE_STORAGE_ENV)) delete process.env[n]
  await g?.close()
})

test("티켓: 가상호스트식 서명 주소 · 키에 사용자 파일명 없음 · 장부에 pending · 응답에 비밀 키 없음", async () => {
  const res = await (await g.route("storage/ticket")).POST(postJson("https://x.test/api/storage/ticket", { kind: "image", contentType: "image/png", size: 2048, fileName: "내 사진.png" }))
  const text = await res.text()
  assert.equal(res.status, 200)
  const t = JSON.parse(text).data
  const url = new URL(t.url)
  assert.equal(url.host, "demo-bucket.s3.example.test")
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256")
  assert.ok(url.searchParams.get("X-Amz-Signature"))
  assert.equal(t.method, "PUT")
  assert.match(t.key, /^image\/\d{4}\/[0-9a-f-]{36}\.png$/)
  assert.ok(!text.includes(FAKE_STORAGE_ENV.STORAGE_SECRET_ACCESS_KEY) && !text.includes("내 사진"))
  const row = (await g.db.$client.query("select status from stored_files where id = $1", [t.id])).rows[0]
  assert.equal(row.status, "pending")
})

test("avatar 는 로그인 없이 401, 로컬 폴더 경로는 설정이 있어도 live 에서 404", async () => {
  const res = await (await g.route("storage/ticket")).POST(postJson("https://x.test/api/storage/ticket", { kind: "avatar", contentType: "image/png", size: 1024 }))
  assert.equal(res.status, 401)
  const local = await g.route("storage/local/[...key]")
  assert.equal((await local.PUT(new Request("https://x.test/api/storage/local/image/2026/x.png", { method: "PUT", body: "x" }))).status, 404)
})
