// 콜백 URL이나 토스 인증 값을 포함한 오류·breadcrumb은 통째로 버린다.
export function hasTossCallbackSecret(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "string") return /\/api\/toss\/registration\/(?:complete|fail)(?:[/?#]|$)|(?:^|[?&])(?:authKey|customerKey)=/i.test(value)
  if (!value || typeof value !== "object" || seen.has(value)) return false
  seen.add(value)
  return Object.entries(value).some(([key, child]) => /^(?:authKey|customerKey)$/i.test(key) || (/^query_string$/i.test(key) && typeof child === "string" && /(?:^|[?&])(?:state|authKey|customerKey)=/i.test(child)) || (/^query_string$/i.test(key) && !!child && typeof child === "object" && Object.keys(child).some((name) => /^(?:state|authKey|customerKey)$/i.test(name))) || hasTossCallbackSecret(child, seen))
}
export function isTossCallbackPath(path: string): boolean {
  return /(?:^|\/)api\/toss\/registration\/(?:complete|fail)(?:[/?#]|$)/i.test(path)
}
