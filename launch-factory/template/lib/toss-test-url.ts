/** Next 개발 HTTPS 프록시의 내부 localhost URL을 검증된 외부 오리진으로 복원한다. */
export function canonicalTossCallback(request: Request, origin: string, path: string): Request | null {
  const expected = new URL(origin), incoming = new URL(request.url)
  const host = request.headers.get("host")
  const forwardedHost = request.headers.get("x-forwarded-host") ?? host
  if (request.method !== "GET" || expected.protocol !== "https:" || expected.origin !== origin || host !== expected.host || forwardedHost !== expected.host || request.headers.get("x-forwarded-proto") !== "https" || incoming.pathname !== path) return null
  const canonical = new URL(`${incoming.pathname}${incoming.search}`, expected)
  return new Request(canonical, { method: "GET", headers: request.headers })
}
