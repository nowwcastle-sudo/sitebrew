// 서명된 링크 토큰. 로그인 없이 누르는 메일 링크(수신거부 · 가입 안 했어요 · 수신 계속)에 쓴다 — 값은 DB 에 두지 않고 HMAC-SHA256 으로 서명한다.
// 토큰 = base64url(JSON 본문) + "." + base64url(HMAC). HMAC 입력은 `lf-token:<용도>:<본문>` 이라 용도가 다른 토큰은 서로 통하지 않는다(수신거부 토큰으로 계정을 지울 수 없다).
// 만료(exp, 초 단위 Unix 시각)는 선택이다. 수신거부 토큰은 만료가 없다 — 오래된 메일의 링크도 철회는 되어야 한다(정보통신망법 시행령 별표 6).
// 본문에는 개인정보를 싣지 않는다(사용자 id·채널 같은 내부 값뿐이고, 서명이라 위조는 안 된다).
import { createHmac, timingSafeEqual } from "node:crypto"

export type TokenPayload = Record<string, string | number>

const MAX_TOKEN_LENGTH = 1024
const MIN_SECRET_LENGTH = 16

const mac = (secret: string, purpose: string, body: string): Buffer => createHmac("sha256", secret).update(`lf-token:${purpose}:${body}`).digest()

/** 토큰을 만든다. secret 은 16자 이상(앱 비밀에서 파생한 값), purpose 는 토큰의 용도 이름 */
export function signToken(payload: TokenPayload, { secret, purpose, expiresAt }: { secret: string; purpose: string; expiresAt?: Date }): string {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error("token secret is too short")
  if (!purpose) throw new Error("token purpose is required")
  const body = Buffer.from(JSON.stringify(expiresAt ? { ...payload, exp: Math.floor(expiresAt.getTime() / 1000) } : payload)).toString("base64url")
  return `${body}.${mac(secret, purpose, body).toString("base64url")}`
}

/** 서명·용도·만료가 맞으면 본문, 아니면 null(이유를 구분해 알리지 않는다) */
export function verifyToken(token: unknown, { secret, purpose, now = new Date() }: { secret: string; purpose: string; now?: Date }): TokenPayload | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH || secret.length < MIN_SECRET_LENGTH) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body = "", sig = ""] = parts
  const given = Buffer.from(sig, "base64url")
  const want = mac(secret, purpose, body)
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
    const exp = (payload as Record<string, unknown>).exp
    if (exp !== undefined && (typeof exp !== "number" || exp * 1000 <= now.getTime())) return null
    return payload as TokenPayload
  } catch {
    return null
  }
}
