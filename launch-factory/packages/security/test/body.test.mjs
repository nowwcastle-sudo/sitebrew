// 요청 본문 상한 읽기(CWE-400) — 상한 경계·선언 길이 거절·chunked 중간 차단·원문 바이트 보존·폼 파싱.
import { test } from "node:test"
import assert from "node:assert/strict"
import { BodyTooLargeError, DEFAULT_FORM_BODY_BYTES, DEFAULT_WEBHOOK_BODY_BYTES, payloadTooLarge, readBodyBytes, readBodyText, readFormInput } from "../src/body.ts"
import { CHUNK, streamPost } from "./body-fixtures.mjs"

const post = (body, headers = {}) => new Request("https://x.test/in", { method: "POST", body, headers })

test("상한 경계: 상한과 같은 길이는 읽고 한 바이트 넘으면 던진다 — 읽은 바이트는 그대로다", async () => {
  const bytes = new Uint8Array(1000).map((_, i) => i % 251)
  assert.deepEqual(await readBodyBytes(post(bytes), 1000), bytes)
  await assert.rejects(readBodyBytes(post(new Uint8Array(1001)), 1000), (e) => e instanceof BodyTooLargeError && e.limit === 1000)
  assert.equal((await readBodyBytes(new Request("https://x.test/in", { method: "POST" }), 10)).byteLength, 0, "본문이 없으면 빈 배열")
})

test("Content-Length 가 상한을 넘으면 한 바이트도 읽지 않는다", async () => {
  const s = streamPost(10_000_000, { headers: { "content-length": "10000000" } })
  await assert.rejects(readBodyBytes(s.req, 64 * 1024), BodyTooLargeError)
  assert.equal(s.pulled(), 0)
})

test("Content-Length 가 없거나 거짓이어도(chunked) 상한 근처에서 끊는다 — 끝까지 읽지 않는다", async () => {
  const limit = 64 * 1024
  const none = streamPost(10_000_000)
  await assert.rejects(readBodyBytes(none.req, limit), BodyTooLargeError)
  assert.ok(none.pulled() <= limit + CHUNK, `상한 + 청크 하나 안에서 멈춰야 한다: ${none.pulled()}`)
  const lie = streamPost(10_000_000, { headers: { "content-length": "100" } })
  await assert.rejects(readBodyBytes(lie.req, limit), BodyTooLargeError)
  assert.ok(lie.pulled() <= limit + CHUNK, `거짓 선언도 같다: ${lie.pulled()}`)
})

test("readBodyText: 여러 바이트 글자가 청크 경계에 걸려도 원문 그대로다(웹훅 서명은 이 원문에 대해 한다)", async () => {
  const text = JSON.stringify({ memo: "한글🙂".repeat(20_000) })
  const raw = new TextEncoder().encode(text)
  const chunks = []
  for (let i = 0; i < raw.length; i += 7001) chunks.push(raw.subarray(i, i + 7001)) // 7001 은 3·4 바이트 글자의 경계를 가른다
  let at = 0
  const body = new ReadableStream({ pull: (c) => (at < chunks.length ? c.enqueue(chunks[at++]) : c.close()) })
  const req = new Request("https://x.test/in", { method: "POST", body, duplex: "half" })
  assert.equal(await readBodyText(req, DEFAULT_WEBHOOK_BODY_BYTES), text)
})

test("readFormInput: JSON·urlencoded·multipart 를 읽고, 깨진 본문·빈 본문은 빈 객체 — 상한 초과만 던진다", async () => {
  assert.deepEqual(await readFormInput(post('{"a":"1"}', { "content-type": "application/json" }), 1024), { a: "1" })
  const url = await readFormInput(post("a=1&b=2", { "content-type": "application/x-www-form-urlencoded" }), 1024)
  assert.deepEqual([...url.entries()], [["a", "1"], ["b", "2"]])
  const fd = new FormData()
  fd.set("message", "안녕하세요")
  const multi = await readFormInput(post(fd), 4096)
  assert.equal(multi.get("message"), "안녕하세요")
  assert.deepEqual(await readFormInput(post("{broken", { "content-type": "application/json" }), 1024), {})
  assert.deepEqual(await readFormInput(post("", { "content-type": "application/json" }), 1024), {})
  await assert.rejects(readFormInput(post("x".repeat(2000), { "content-type": "application/json" }), 1024), BodyTooLargeError)
})

test("상한 값은 양의 정수만 — 0·소수·NaN 은 던진다(상한이 사라지거나 모든 본문이 막히지 않게). 기본값과 413 응답 모양", async () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Infinity]) await assert.rejects(readBodyBytes(post("x"), bad), RangeError, String(bad))
  assert.equal(DEFAULT_FORM_BODY_BYTES, 64 * 1024)
  assert.equal(DEFAULT_WEBHOOK_BODY_BYTES, 512 * 1024)
  const res = payloadTooLarge()
  assert.equal(res.status, 413)
  assert.equal(res.headers.get("retry-after"), null)
  assert.deepEqual(await res.json(), { ok: false, code: "payload_too_large", retryable: false })
})
