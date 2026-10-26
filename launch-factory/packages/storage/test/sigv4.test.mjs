// SigV4 쿼리 방식 presign — AWS 공식 문서의 예제(Authenticating Requests: Using Query Parameters, AWS Signature Version 4)와 서명이 글자 그대로 같아야 한다.
// 출처: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html (예제 자격 증명은 문서에 공개된 가짜 값이다)
import assert from "node:assert/strict"
import { test } from "node:test"
import { presignUrl, verifyPresigned } from "../src/sigv4.ts"

const AWS_EXAMPLE = {
  method: "GET",
  endpoint: "https://s3.amazonaws.com",
  bucket: "examplebucket",
  key: "test.txt",
  region: "us-east-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  expiresIn: 86400,
  now: new Date("2013-05-24T00:00:00Z"),
}
const AWS_EXAMPLE_URL =
  "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"

test("AWS 공식 예제(GET /test.txt, examplebucket, 20130524): URL 과 서명이 문서와 같다", () => {
  const p = presignUrl(AWS_EXAMPLE)
  assert.equal(p.url, AWS_EXAMPLE_URL)
  assert.deepEqual(p.headers, {})
  assert.equal(p.expiresAt.toISOString(), "2013-05-25T00:00:00.000Z")
})

test("경로식(path-style)은 버킷이 경로에 들어가고 호스트는 그대로 — 가상호스트식과 서명이 다르다", () => {
  const p = presignUrl({ ...AWS_EXAMPLE, endpoint: "https://acct.r2.cloudflarestorage.com", pathStyle: true })
  const u = new URL(p.url)
  assert.equal(u.host, "acct.r2.cloudflarestorage.com")
  assert.equal(u.pathname, "/examplebucket/test.txt")
  assert.notEqual(u.searchParams.get("X-Amz-Signature"), "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404")
  assert.match(u.searchParams.get("X-Amz-Signature"), /^[0-9a-f]{64}$/)
  // 포트가 있는 MinIO 주소는 호스트 머리에 포트가 들어간다(서명 대상)
  const m = presignUrl({ ...AWS_EXAMPLE, endpoint: "http://127.0.0.1:9000", pathStyle: true })
  assert.equal(new URL(m.url).host, "127.0.0.1:9000")
})

test("PUT: 서명한 머리(content-type)는 URL 의 SignedHeaders 에 들고 돌려주는 headers 에 그대로 있다 — 다른 형식으로 올리면 서명이 어긋난다", () => {
  const a = presignUrl({ ...AWS_EXAMPLE, method: "PUT", expiresIn: 900, headers: { "Content-Type": "image/png" } })
  const u = new URL(a.url)
  assert.equal(u.searchParams.get("X-Amz-SignedHeaders"), "content-type;host")
  assert.deepEqual(a.headers, { "content-type": "image/png" })
  const b = presignUrl({ ...AWS_EXAMPLE, method: "PUT", expiresIn: 900, headers: { "Content-Type": "image/jpeg" } })
  assert.notEqual(new URL(b.url).searchParams.get("X-Amz-Signature"), u.searchParams.get("X-Amz-Signature"))
})

test("키의 특수 문자는 구간마다 퍼센트 인코딩하고 / 는 남긴다", () => {
  const p = presignUrl({ ...AWS_EXAMPLE, key: "image/2026/a b+c(1)!.png" })
  assert.equal(new URL(p.url).pathname, "/image/2026/a%20b%2Bc%281%29%21.png")
})

test("만료는 1~604800 초만 받는다", () => {
  for (const bad of [0, -1, 604801, 1.5, Number.NaN]) assert.throws(() => presignUrl({ ...AWS_EXAMPLE, expiresIn: bad }), /expiresIn/)
  assert.doesNotThrow(() => presignUrl({ ...AWS_EXAMPLE, expiresIn: 604800 }))
})

test("잘못된 입력은 던진다: 메서드·종단점 모양·빈 키·빈 자격 증명", () => {
  assert.throws(() => presignUrl({ ...AWS_EXAMPLE, method: "POST" }), /method/)
  assert.throws(() => presignUrl({ ...AWS_EXAMPLE, endpoint: "not a url" }), /endpoint/)
  assert.throws(() => presignUrl({ ...AWS_EXAMPLE, key: "" }), /key/)
  assert.throws(() => presignUrl({ ...AWS_EXAMPLE, secretAccessKey: "" }), /credentials/)
})

test("던지는 오류에 비밀 키가 들어 있지 않다", () => {
  try {
    presignUrl({ ...AWS_EXAMPLE, expiresIn: 0 })
    assert.fail("던져야 한다")
  } catch (e) {
    assert.ok(!String(e.message).includes(AWS_EXAMPLE.secretAccessKey))
    assert.ok(!String(e.message).includes(AWS_EXAMPLE.accessKeyId))
  }
})

test("verifyPresigned: 우리가 만든 URL 은 맞고, 바뀐 키·메서드·서명·만료는 거절한다", () => {
  const base = { ...AWS_EXAMPLE, method: "PUT", endpoint: "http://local.invalid", pathStyle: true, bucket: "local", region: "local", expiresIn: 900, now: new Date("2026-10-22T00:00:00Z"), headers: { "content-type": "image/png" } }
  const p = presignUrl({ ...base, key: "image/2026/x.png" })
  const rel = p.url.slice("http://local.invalid".length)
  const check = (o = {}) => verifyPresigned({ method: "PUT", url: rel, headers: { "content-type": "image/png" }, endpoint: base.endpoint, bucket: "local", region: "local", secretAccessKey: base.secretAccessKey, now: new Date("2026-10-22T00:05:00Z"), ...o })
  assert.deepEqual(check(), { ok: true, key: "image/2026/x.png" })
  assert.equal(check({ method: "GET" }).ok, false, "메서드가 다르다")
  assert.equal(check({ headers: { "content-type": "image/jpeg" } }).ok, false, "서명한 머리가 다르다")
  assert.equal(check({ headers: {} }).ok, false, "서명한 머리가 없다")
  assert.equal(check({ url: rel.replace("x.png", "y.png") }).ok, false, "키가 다르다")
  assert.equal(check({ url: rel.replace(/Signature=[0-9a-f]/, "Signature=0") }).ok, false, "서명이 다르다")
  assert.equal(check({ secretAccessKey: "other-secret" }).ok, false, "비밀이 다르다")
  assert.equal(check({ now: new Date("2026-10-22T00:15:01Z") }).ok, false, "만료됐다")
  assert.equal(check({ now: new Date("2026-10-21T23:00:00Z") }).ok, false, "서명 시각보다 한참 이르다")
  assert.equal(check({ url: "/local/image/2026/x.png" }).ok, false, "쿼리가 없다")
})
