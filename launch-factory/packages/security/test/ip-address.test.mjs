// D205: 프록시·Vercel 뒤에서 어느 머리의 IP 를 믿을지 — 환경에서 한 번 정하고 요청 제한기와 Better Auth 가 같은 값을 쓴다.
// 근거: Vercel request-headers 문서(x-forwarded-for 는 덮어쓴다·x-vercel-forwarded-for 는 앞단 프록시가 있어도 같은 값), Better Auth options(advanced.ipAddress).
import assert from "node:assert/strict"
import { test } from "node:test"
import { clientIp, createRateLimiter, ipAddressFromEnv } from "../src/rate-limit.ts"

const store = { hit: async () => ({ count: 1, windowStartedAt: new Date() }) }
const H = (o) => new Headers(o)
/** 개발·시험 환경 대체값(127.0.0.1)은 신뢰 머리를 못 찾았다는 뜻이다 — 공격자 값이 아니면 된다 */
const notTrusted = (ip, spoof) => assert.ok(ip === null || ip === "127.0.0.1", `속인 값 ${spoof} 이 IP 로 읽혔다: ${ip}`)

test("기본(설정 없음)은 어떤 머리도 믿지 않는다 — 직접 노출된 서버에서 x-forwarded-for 를 속여도 IP 가 되지 않는다", () => {
  const cfg = ipAddressFromEnv({})
  assert.deepEqual(cfg, { ipAddressHeaders: [] })
  for (const spoof of ["6.6.6.6", "6.6.6.6, 203.0.113.9"]) notTrusted(clientIp(H({ "x-forwarded-for": spoof }), cfg), spoof)
  notTrusted(clientIp(H({ "x-real-ip": "6.6.6.6" }), cfg), "x-real-ip")
  notTrusted(clientIp(H({ "x-vercel-forwarded-for": "6.6.6.6" }), cfg), "x-vercel-forwarded-for")
  // 비교: 옛 기본(Better Auth 기본 머리)은 같은 속임수를 믿는다
  assert.equal(clientIp(H({ "x-forwarded-for": "6.6.6.6" })), "6.6.6.6")
})

test("Vercel(VERCEL=1 또는 LF_TRUSTED_PROXY=vercel)은 x-vercel-forwarded-for 를 먼저, x-forwarded-for 를 다음으로 믿는다", () => {
  for (const env of [{ VERCEL: "1" }, { LF_TRUSTED_PROXY: "vercel" }]) {
    const cfg = ipAddressFromEnv(env)
    assert.deepEqual(cfg, { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"] })
    // 앞단 프록시가 x-forwarded-for 를 덮어써도 x-vercel-forwarded-for 가 진짜 클라이언트다
    assert.equal(clientIp(H({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.7" }), cfg), "203.0.113.9")
    assert.equal(clientIp(H({ "x-forwarded-for": "203.0.113.9" }), cfg), "203.0.113.9")
    // 그래도 x-real-ip 는 읽지 않는다
    notTrusted(clientIp(H({ "x-real-ip": "6.6.6.6" }), cfg), "x-real-ip")
    // 체인(여러 값)은 프록시를 모르니 믿지 않는다
    notTrusted(clientIp(H({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), cfg), "chain")
  }
})

test("LF_TRUSTED_PROXY=none 은 VERCEL=1 보다 앞선다(명시한 값이 자동 감지를 이긴다)", () => {
  assert.deepEqual(ipAddressFromEnv({ VERCEL: "1", LF_TRUSTED_PROXY: "none" }), { ipAddressHeaders: [] })
})

test("LF_CLIENT_IP_HEADER: 앞단이 덮어쓰는 머리 하나만 믿는다(예: Cloudflare 의 cf-connecting-ip)", () => {
  const cfg = ipAddressFromEnv({ LF_CLIENT_IP_HEADER: "CF-Connecting-IP" })
  assert.deepEqual(cfg, { ipAddressHeaders: ["cf-connecting-ip"] })
  assert.equal(clientIp(H({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "6.6.6.6" }), cfg), "203.0.113.9")
  notTrusted(clientIp(H({ "x-forwarded-for": "6.6.6.6" }), cfg), "xff")
})

test("LF_TRUSTED_PROXY_CIDRS: 체인을 오른쪽부터 믿는 프록시를 건너뛰어 첫 미신뢰 주소를 쓴다 — 왼쪽에 속인 값을 넣어도 소용없다", () => {
  const cfg = ipAddressFromEnv({ LF_TRUSTED_PROXY_CIDRS: "10.0.0.0/8, 192.168.0.0/16" })
  assert.deepEqual(cfg, { ipAddressHeaders: ["x-forwarded-for"], trustedProxies: ["10.0.0.0/8", "192.168.0.0/16"] })
  assert.equal(clientIp(H({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }), cfg), "203.0.113.9")
  assert.equal(clientIp(H({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1" }), cfg), "203.0.113.9")
  assert.deepEqual(ipAddressFromEnv({ LF_TRUSTED_PROXY_CIDRS: "10.0.0.0/8", LF_CLIENT_IP_HEADER: "x-real-ip" }), { ipAddressHeaders: ["x-real-ip"], trustedProxies: ["10.0.0.0/8"] })
})

test("잘못된 설정은 켜질 때 던진다(조용히 다른 값으로 가지 않는다)", () => {
  assert.throws(() => ipAddressFromEnv({ LF_TRUSTED_PROXY: "cloudflare" }), /LF_TRUSTED_PROXY/)
  assert.throws(() => ipAddressFromEnv({ LF_TRUSTED_PROXY_CIDRS: "10.0.0.0/8, not-an-ip" }), /LF_TRUSTED_PROXY_CIDRS.*not-an-ip/)
  assert.throws(() => ipAddressFromEnv({ LF_CLIENT_IP_HEADER: "bad header!" }), /LF_CLIENT_IP_HEADER/)
})

test("요청 제한기와 clientIp 는 같은 설정으로 같은 IP 를 본다(Better Auth 와 같은 값을 넘기는 근거)", () => {
  const cfg = ipAddressFromEnv({ VERCEL: "1" })
  const limiter = createRateLimiter({ store, ipAddress: cfg })
  const headers = H({ "x-vercel-forwarded-for": "203.0.113.9" })
  assert.equal(limiter.ip({ headers }), clientIp(headers, cfg))
  assert.equal(limiter.ip({ headers }), "203.0.113.9")
})
