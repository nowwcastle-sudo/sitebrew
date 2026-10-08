// Better Auth HTTP 응답에 기계가 읽는 값을 더한다(LFAX M04 · 감사 H07).
// Better Auth 의 오류 응답은 `{ code, message }` 인데 요청 제한(429)만 `{ message }` 뿐이다(`X-Retry-After` 헤더로 남은 초를 줄 뿐).
// 자동화가 글을 해석하지 않고 원인을 알도록 429 본문에 code(`RATE_LIMITED` — Better Auth 오류 코드와 같은 대문자 표기)·retryable·retryAfter 를 더하고,
// 표준 `Retry-After` 헤더(RFC 9110 §10.2.3, 초)도 붙인다. 본문 message·상태·나머지 헤더는 그대로다. 다른 응답은 건드리지 않는다.
export async function withMachineCodes(res: Response): Promise<Response> {
  if (res.status !== 429) return res
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null)
  const obj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const seconds = Math.ceil(Number(res.headers.get("x-retry-after") ?? res.headers.get("retry-after")))
  const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
  const headers = new Headers(res.headers)
  headers.set("content-type", "application/json")
  headers.delete("content-length")
  if (retryAfter !== undefined) headers.set("retry-after", String(retryAfter))
  const next = { ...obj, code: typeof obj.code === "string" && obj.code ? obj.code : "RATE_LIMITED", retryable: true, ...(retryAfter !== undefined ? { retryAfter } : {}) }
  return new Response(JSON.stringify(next), { status: 429, statusText: res.statusText, headers })
}
