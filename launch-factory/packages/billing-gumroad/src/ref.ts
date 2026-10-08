// 사용자 연결 표(lf_ref). Gumroad 상품 링크에 붙인 URL 매개변수는 판매 알림의 url_params 사전으로 돌아온다
// (https://gumroad.com/ping 「You can pass unique URL parameters by adding them to any Gumroad product URL」). 하지만 판매 재조회(GET /sales/:id)
// 응답에는 url_params 가 없어 API 로 확인할 수 없다. 그래서 값 자체에 서명을 붙인다: base64url(userId).만료(36진).HMAC-SHA256.
// 손님이 주소를 고쳐 남의 사용자 id 를 넣어도 서명이 맞지 않는다. 한 구독의 사용자는 처음 연결된 뒤 바뀌지 않는다(ping.ts).
import { createHmac, timingSafeEqual } from "node:crypto"

export const REF_PARAM = "lf_ref"
/** 결제 링크를 연 뒤 결제를 끝낼 때까지의 여유 */
export const REF_TTL_MS = 7 * 24 * 3600 * 1000

const mac = (secret: string, body: string) => createHmac("sha256", secret).update(`lf-gumroad-ref|${body}`).digest("base64url")

export function signRef(secret: string, userId: string, now: Date): string {
  const body = `${Buffer.from(userId, "utf8").toString("base64url")}.${(now.getTime() + REF_TTL_MS).toString(36)}`
  return `${body}.${mac(secret, body)}`
}

/** 맞으면 사용자 id, 아니면 null(서명 틀림·만료·모양 틀림) */
export function verifyRef(secret: string, ref: string | undefined | null, now: Date): string | null {
  if (!secret || typeof ref !== "string" || ref.length > 512) return null
  const parts = ref.split(".")
  if (parts.length !== 3) return null
  const [user, exp, sig] = parts as [string, string, string]
  const want = Buffer.from(mac(secret, `${user}.${exp}`))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  const expires = parseInt(exp, 36)
  if (!Number.isFinite(expires) || expires < now.getTime()) return null
  const userId = Buffer.from(user, "base64url").toString("utf8")
  return userId || null
}
