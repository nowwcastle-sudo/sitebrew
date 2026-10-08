import { test } from "node:test"
import assert from "node:assert/strict"
import { sentryOptions, sentryIngestOrigin, maskPii, securityHeaders, createNonce, accessLog } from "../src/index.ts"

// ── Sentry ───────────────────────────────────────────────────────────

test("sentryOptions: sendDefaultPii 는 false 이고 beforeSend 가 있다", () => {
  const o = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1" })
  assert.equal(o.sendDefaultPii, false)
  assert.equal(typeof o.beforeSend, "function")
  assert.equal(o.dsn, "https://k@o1.ingest.sentry.io/1")
})

test("beforeSend 가 이메일·전화를 가린다(양성)", () => {
  const { beforeSend } = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1" })
  const event = {
    event_id: "0123456789abcdef0123456789abcdef",
    message: "가입 실패 user.name+tag@example.co.kr 010-1234-5678",
    exception: { values: [{ type: "Error", value: "call +82 10 1234 5678 or 02-123-4567 / 01098765432" }] },
    breadcrumbs: [{ message: "mail to a@b.io" }],
    extra: { nested: { deep: ["x@y.com"] } },
    user: { id: "u_1", email: "a@b.io", ip_address: "1.2.3.4", username: "kim" },
  }
  const out = beforeSend(event, {})
  const s = JSON.stringify(out)
  for (const leaked of ["user.name+tag@example.co.kr", "010-1234-5678", "+82 10 1234 5678", "02-123-4567", "01098765432", "a@b.io", "x@y.com", "1.2.3.4", "kim"]) {
    assert.ok(!s.includes(leaked), `가려져야 함: ${leaked}`)
  }
  assert.match(out.message, /\[email\]/)
  assert.match(out.message, /\[phone\]/)
  assert.equal(out.user.id, "u_1", "내부 id 는 남긴다")
  assert.equal(out.event_id, event.event_id, "event_id 는 건드리지 않는다")
})

test("beforeSend 는 개인정보가 아닌 숫자·식별자를 건드리지 않는다(음성)", () => {
  const { beforeSend } = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1" })
  const keep = [
    "2026-09-30",
    "2026-09-30T12:34:56.789Z",
    "next@16.3.6",
    "@launch-factory/env@0.0.0",
    "order 20260930-0001",
    "price 1,234,567 KRW",
    "uuid 3f2b8c1e-9a4d-4e2b-8f1a-1c2d3e4f5a6b",
    "trace 0123456789abcdef0123456789abcdef",
    "port 6543",
    "version 1.434.18",
  ]
  for (const text of keep) {
    const out = beforeSend({ message: text }, {})
    assert.equal(out.message, text, `그대로여야 함: ${text}`)
  }
})

test("beforeSend 가 토큰 모양을 가린다", () => {
  const { beforeSend } = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1" })
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_-x"
  const out = beforeSend(
    {
      message: `Authorization: Bearer abc.def-123 key pdl_live_apikey_01abc re_AbC123 phc_xyz ${jwt}`,
      request: { url: "https://app.example.com/cb?token=t0k3n&x=1", headers: { authorization: "Bearer zzz", cookie: "sid=1" } },
    },
    {},
  )
  const s = JSON.stringify(out)
  for (const leaked of ["abc.def-123", "pdl_live_apikey_01abc", "re_AbC123", "phc_xyz", jwt, "t0k3n", "zzz", "sid=1"]) {
    assert.ok(!s.includes(leaked), `가려져야 함: ${leaked}`)
  }
  assert.match(out.request.url, /x=1/, "토큰이 아닌 쿼리는 남긴다")
})

test("beforeSend 는 순환 참조에서 멈추지 않는다", () => {
  const { beforeSend } = sentryOptions({ dsn: "https://k@o1.ingest.sentry.io/1" })
  const extra = { a: "a@b.io" }
  extra.self = extra
  const out = beforeSend({ extra }, {})
  assert.equal(out.extra.a, "[email]")
})

test("maskPii 는 문자열 하나에도 쓸 수 있다", () => {
  assert.equal(maskPii("연락 kim@example.com / 010.1234.5678"), "연락 [email] / [phone]")
})

// ── 보안 헤더 ────────────────────────────────────────────────────────

test("CSP 에 nonce 가 있고 unsafe-inline 이 없다", () => {
  const nonce = createNonce()
  for (const dev of [false, true]) {
    const h = securityHeaders(nonce, { dev })
    const csp = h.get("content-security-policy")
    assert.ok(csp, "CSP 헤더가 있다")
    assert.match(csp, new RegExp(`script-src [^;]*'nonce-${nonce.replace(/[+/=]/g, (c) => "\\" + c)}'`))
    assert.match(csp, /style-src [^;]*'nonce-/)
    assert.doesNotMatch(csp, /unsafe-inline/)
    assert.match(csp, /object-src 'none'/)
    assert.match(csp, /frame-ancestors 'none'/)
  }
})

test("개발 모드에서만 unsafe-eval 을 더한다", () => {
  const nonce = createNonce()
  assert.doesNotMatch(securityHeaders(nonce).get("content-security-policy"), /unsafe-eval/)
  assert.match(securityHeaders(nonce, { dev: true }).get("content-security-policy"), /unsafe-eval/)
})

test("HSTS·Referrer-Policy·Permissions-Policy 가 있다", () => {
  const h = securityHeaders(createNonce())
  assert.match(h.get("strict-transport-security"), /max-age=\d+/)
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin")
  assert.match(h.get("permissions-policy"), /camera=\(\)/)
  assert.equal(h.get("x-content-type-options"), "nosniff")
})

test("nonce 는 요청마다 다르고 base64 모양이다", () => {
  const a = createNonce()
  const b = createNonce()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9+/]+={0,2}$/)
})

test("nonce 모양이 아니면 던진다(헤더 주입 막기)", () => {
  assert.throws(() => securityHeaders("abc'; script-src *"), /nonce/)
  assert.throws(() => securityHeaders(""), /nonce/)
})

test("extend 로 출처를 더할 수 있지만 unsafe-inline 은 거부한다", () => {
  const nonce = createNonce()
  const csp = securityHeaders(nonce, { extend: { frameSrc: ["https://sandbox-buy.paddle.com"] } }).get("content-security-policy")
  assert.match(csp, /frame-src [^;]*https:\/\/sandbox-buy\.paddle\.com/)
  assert.throws(() => securityHeaders(nonce, { extend: { styleSrc: ["'unsafe-inline'"] } }), /unsafe-inline/)
})

// ── 접속기록 ─────────────────────────────────────────────────────────

test("accessLog: 고시 제2조 제3호 다섯 항목을 남긴다", async () => {
  const rows = []
  const rec = await accessLog(
    { actorId: "admin_1", ip: "203.0.113.7", subjects: ["user_9"], action: "view", target: "subscriptions" },
    (r) => rows.push(r),
  )
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], rec)
  assert.equal(rec.actorId, "admin_1")
  assert.equal(rec.ip, "203.0.113.7")
  assert.deepEqual(rec.subjects, ["user_9"])
  assert.equal(rec.action, "view")
  assert.equal(rec.download, false)
  assert.match(rec.occurredAt, /^\d{4}-\d{2}-\d{2}T/)
})

test("accessLog: 빠진 항목은 한 번에 알린다", async () => {
  await assert.rejects(
    accessLog({}, () => {}),
    (e) => ["actorId", "ip", "subjects", "action"].every((k) => e.message.includes(k)),
  )
})

test("accessLog: 정보주체 칸에 이메일·전화를 넣으면 거부한다(식별자만)", async () => {
  await assert.rejects(accessLog({ actorId: "a", ip: "1.1.1.1", subjects: ["kim@example.com"], action: "view" }, () => {}), /식별자/)
  await assert.rejects(accessLog({ actorId: "a", ip: "1.1.1.1", subjects: ["010-1234-5678"], action: "view" }, () => {}), /식별자/)
})

test("accessLog: ip 모양이 아니면 거부한다", async () => {
  await assert.rejects(accessLog({ actorId: "a", ip: "not-ip", subjects: ["u1"], action: "view" }, () => {}), /IP/)
})

test("accessLog: 다운로드는 표시가 남는다(고시 제8조 제2항)", async () => {
  const rec = await accessLog({ actorId: "a", ip: "::1", subjects: ["u1", "u2"], action: "download" }, () => {})
  assert.equal(rec.download, true)
})

test("accessLog: 저장 실패는 조용히 넘어가지 않는다", async () => {
  await assert.rejects(
    accessLog({ actorId: "a", ip: "1.1.1.1", subjects: ["u1"], action: "view" }, async () => {
      throw new Error("db down")
    }),
    /db down/,
  )
})


test("LFOBS: sentryIngestOrigin 은 DSN 에서 수집 출처만 꺼낸다(키·프로젝트 번호는 버린다)", () => {
  assert.equal(sentryIngestOrigin("https://abc123@o9.ingest.sentry.io/456"), "https://o9.ingest.sentry.io")
  assert.equal(sentryIngestOrigin("https://abc123@sentry.example.test:8443/prefix/42"), "https://sentry.example.test:8443")
  for (const bad of [undefined, "", "not a url", "http://abc@o9.ingest.sentry.io/1", "https://o9.ingest.sentry.io/1"]) assert.equal(sentryIngestOrigin(bad), undefined, String(bad))
})
