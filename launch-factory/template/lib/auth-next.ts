// 로그인 뒤 돌아갈 곳(`?next=`)을 다루는 순수 함수(B04). 화면은 components/product/sign-in-required.tsx, 로그인 쪽은 app/(product)/sign-in/page.tsx.
// `next` 는 주소에서 오는 값이라 믿지 않는다 — 이 앱 안의 상대 경로(`/…`)만 받고, 남의 주소·스킴·`//host`·역슬래시·제어 문자는 버린다(열린 리다이렉트 방지).
// 로그인·가입 화면으로 되돌아오면 고리가 되므로 그 경로도 버린다.
import { WELCOME_PARAM } from "./welcome.ts"

export const NEXT_PARAM = "next"

/** 되돌아올 곳으로 쓰지 않는 경로(고리 방지) */
const AUTH_PATHS = new Set(["/sign-in", "/sign-up", "/forgot-password", "/reset-password"])
const MAX_LENGTH = 512
const BASE = "http://next.invalid"

/** 주소에서 온 값 → 이 앱 안의 상대 경로(경로+쿼리+해시) 또는 null */
export function safeNext(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return null
  // eslint-disable-next-line no-control-regex
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return null
  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  if (AUTH_PATHS.has(url.pathname.replace(/\/+$/, "") || "/")) return null
  return url.pathname + url.search + url.hash
}

/** 로그인 화면으로 가는 주소. 돌아올 곳이 안전하면 `?next=` 로 싣는다 */
export function signInHref(next?: string | null): string {
  const safe = safeNext(next)
  return safe ? `/sign-in?${NEXT_PARAM}=${encodeURIComponent(safe)}` : "/sign-in"
}

/** 경로에 한 번짜리 안내 표지(`welcome=<kind>`)를 붙인다 — 이미 쿼리가 있으면 `&` 로 */
export function withWelcomeMark(path: string, kind: string): string {
  const url = new URL(path, BASE)
  url.searchParams.set(WELCOME_PARAM, kind)
  return url.pathname + url.search + url.hash
}
