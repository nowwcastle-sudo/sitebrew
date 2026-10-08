// Cloudflare siteverify 녹화 응답(운영자 할 일 O7 전 — 실제 키 없이 시험한다).
// 모양의 출처: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (응답 예시·오류 코드 표, 2026-09-30 확인)
// 시험 키: https://developers.cloudflare.com/turnstile/troubleshooting/testing/ — 비밀 1x…AA 늘 통과·2x…AA 늘 실패·3x…AA 이미 쓴 토큰, 토큰 XXXX.DUMMY.TOKEN.XXXX
export const TEST_SECRET_PASS = "1x0000000000000000000000000000000AA"
export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"

export const RECORDED = {
  success: { success: true, challenge_ts: "2022-02-28T15:14:30.096Z", hostname: "example.com", "error-codes": [], action: "login", cdata: "sessionid-123456789", metadata: { ephemeral_id: "x:9f78e0ed210960d7693b167e" } },
  invalid: { success: false, "error-codes": ["invalid-input-response"] },
  duplicate: { success: false, "error-codes": ["timeout-or-duplicate"] },
  badSecret: { success: false, "error-codes": ["invalid-input-secret"] },
  internal: { success: false, "error-codes": ["internal-error"] },
}

/** 토큰마다 녹화 응답을 돌려주는 가짜 fetch. calls 에 보낸 본문(URLSearchParams)을 남긴다 */
export function fakeSiteverify(byToken = {}) {
  const calls = []
  const fetch = async (url, init) => {
    const body = new URLSearchParams(init.body)
    calls.push({ url: String(url), method: init.method, body })
    const token = body.get("response")
    const reply = byToken[token] ?? (token === DUMMY_TOKEN ? RECORDED.success : RECORDED.invalid)
    if (reply === "network") throw new TypeError("fetch failed")
    if (typeof reply === "number") return new Response("oops", { status: reply })
    return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } })
  }
  return { fetch, calls }
}
