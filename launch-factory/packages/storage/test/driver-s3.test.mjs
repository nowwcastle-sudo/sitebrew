// S3 호환 드라이버 — 주소 모양(경로식·가상호스트식)·공개 주소·head/delete 응답 읽기·오류 문구에 서명 주소와 비밀이 없음. 네트워크는 가짜 fetch.
import assert from "node:assert/strict"
import { test } from "node:test"
import { createS3Driver } from "../src/driver-s3.ts"
import { verifyPresigned } from "../src/sigv4.ts"

const SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
const base = { endpoint: "https://acct.r2.cloudflarestorage.com", bucket: "mybucket", region: "auto", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: SECRET }
const NOW = new Date("2026-10-22T00:00:00Z")
const KEY = "image/2026/0b9f3c2a-6c1d-4d57-9a53-0f3e7f6a1b2c.png"

test("경로식(기본): 호스트는 종단점 그대로, 버킷은 경로. PUT 은 content-type 을 서명하고 headers 로 돌려준다", () => {
  const d = createS3Driver({ ...base, pathStyle: true })
  const p = d.presign({ method: "PUT", key: KEY, contentType: "image/png", expiresIn: 900, now: NOW })
  const u = new URL(p.url)
  assert.equal(u.host, "acct.r2.cloudflarestorage.com")
  assert.equal(u.pathname, `/mybucket/${KEY}`)
  assert.equal(u.searchParams.get("X-Amz-Expires"), "900")
  assert.equal(u.searchParams.get("X-Amz-SignedHeaders"), "content-type;host")
  assert.deepEqual(p.headers, { "content-type": "image/png" })
  assert.equal(p.expiresAt.toISOString(), "2026-10-22T00:15:00.000Z")
  // 서명이 자격 증명과 맞는다(같은 입력을 검증기로 다시 계산)
  assert.deepEqual(verifyPresigned({ method: "PUT", url: `${u.pathname}${u.search}`, headers: { "content-type": "image/png" }, endpoint: base.endpoint, bucket: "mybucket", region: "auto", secretAccessKey: SECRET, now: NOW }), { ok: true, key: KEY })
})

test("가상호스트식(pathStyle 아님): 버킷이 호스트 앞에 붙는다 · GET 은 머리를 서명하지 않는다", () => {
  const d = createS3Driver({ ...base, endpoint: "https://s3.ap-northeast-2.amazonaws.com", region: "ap-northeast-2" })
  const u = new URL(d.presign({ method: "GET", key: KEY, expiresIn: 900, now: NOW }).url)
  assert.equal(u.host, "mybucket.s3.ap-northeast-2.amazonaws.com")
  assert.equal(u.pathname, `/${KEY}`)
  assert.equal(u.searchParams.get("X-Amz-SignedHeaders"), "host")
})

test("공개 주소: STORAGE_PUBLIC_BASE_URL 이 있으면 그 아래 키, 없으면 서명 없는 객체 주소(경로식·가상호스트식)", () => {
  assert.equal(createS3Driver({ ...base, publicBaseUrl: "https://cdn.example.test/files/" }).publicUrl(KEY), `https://cdn.example.test/files/${KEY}`)
  assert.equal(createS3Driver({ ...base, pathStyle: true }).publicUrl(KEY), `https://acct.r2.cloudflarestorage.com/mybucket/${KEY}`)
  assert.equal(createS3Driver({ ...base, endpoint: "https://s3.amazonaws.com", region: "us-east-1" }).publicUrl(KEY), `https://mybucket.s3.amazonaws.com/${KEY}`)
})

function fetchOf(handler) {
  const calls = []
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method })
    return handler(String(url), init)
  }
  fn.calls = calls
  return fn
}

test("head: HEAD 서명 주소로 묻고 크기·형식을 읽는다 · 404 는 null", async () => {
  const f = fetchOf(() => new Response(null, { status: 200, headers: { "content-length": "1234", "content-type": "image/png" } }))
  const d = createS3Driver({ ...base, pathStyle: true, fetch: f })
  assert.deepEqual(await d.head(KEY), { size: 1234, contentType: "image/png" })
  assert.equal(f.calls[0].method, "HEAD")
  assert.match(f.calls[0].url, /X-Amz-Signature=[0-9a-f]{64}/)
  const none = createS3Driver({ ...base, pathStyle: true, fetch: fetchOf(() => new Response(null, { status: 404 })) })
  assert.equal(await none.head(KEY), null)
  const noSize = createS3Driver({ ...base, pathStyle: true, fetch: fetchOf(() => new Response(null, { status: 200 })) })
  await assert.rejects(noSize.head(KEY), /no size/)
  const noType = createS3Driver({ ...base, pathStyle: true, fetch: fetchOf(() => new Response(null, { status: 200, headers: { "content-length": "5" } })) })
  assert.deepEqual(await noType.head(KEY), { size: 5, contentType: null })
})

test("delete: DELETE 서명 주소 — 204·200·404(이미 없음)은 성공, 나머지는 던진다", async () => {
  for (const status of [204, 200, 404]) {
    const f = fetchOf(() => new Response(null, { status }))
    await createS3Driver({ ...base, pathStyle: true, fetch: f }).delete(KEY)
    assert.equal(f.calls[0].method, "DELETE")
  }
  await assert.rejects(createS3Driver({ ...base, pathStyle: true, fetch: fetchOf(() => new Response("denied", { status: 403 })) }).delete(KEY), /status 403/)
})

test("오류 문구에 서명 주소·자격 증명·응답 본문이 없다 — 상태 코드와 동작 이름만", async () => {
  const leaky = createS3Driver({
    ...base,
    pathStyle: true,
    fetch: async (url) => {
      throw new TypeError(`fetch failed: ${url}`, { cause: new Error(SECRET) })
    },
  })
  for (const run of [() => leaky.head(KEY), () => leaky.delete(KEY)]) {
    await assert.rejects(run(), (e) => {
      const text = `${e.message} ${e.cause ?? ""}`
      assert.ok(!text.includes(SECRET) && !text.includes("X-Amz") && !text.includes(base.accessKeyId) && !text.includes("acct.r2"), text)
      assert.match(e.message, /^storage (head|delete) failed/)
      return true
    })
  }
  const body = createS3Driver({ ...base, pathStyle: true, fetch: fetchOf(() => new Response(`<Error>${SECRET}</Error>`, { status: 500 })) })
  await assert.rejects(body.head(KEY), (e) => {
    assert.ok(!e.message.includes(SECRET))
    assert.match(e.message, /status 500/)
    return true
  })
})

test("만들 때 잘못된 설정은 던진다(비밀값은 문구에 없다)", () => {
  assert.throws(() => createS3Driver({ ...base, endpoint: "nope" }), (e) => /endpoint/.test(e.message) && !e.message.includes(SECRET))
  assert.throws(() => createS3Driver({ ...base, bucket: "" }), /bucket/)
  assert.throws(() => createS3Driver({ ...base, secretAccessKey: "" }), /credentials/)
  assert.throws(() => createS3Driver({ ...base, publicBaseUrl: "not a url" }), /publicBaseUrl/)
})
