// 서명 링크 토큰(로그인 없이 누르는 메일 링크). 서명·용도 분리는 @launch-factory/security 의 signToken 이 한다 — 이 파일은 뉴스레터 용도의 본문과 기한만 정한다.
//   • 확인 토큰: 구독자 id + 신청 시각. 7일 뒤 닫힌다. 신청 시각이 들어 있어 「그 신청」에만 쓸 수 있다(수신거부 뒤 다시 신청하면 옛 메일의 링크는 통하지 않는다).
//   • 수신거부 토큰: 구독자 id 만. 만료가 없다 — 몇 년 지난 메일의 링크로도 철회된다(정보통신망법 시행령 별표 6, @launch-factory/consent 의 수신거부와 같은 방식).
// 본문에 이메일 주소를 싣지 않는다(id 는 내부 값).
import { signToken, verifyToken } from "@launch-factory/security/signed-token"

/** 링크가 가리키는 경로(링크를 만드는 쪽과 받는 라우트가 같은 값을 쓴다). 수신거부 주소는 RFC 8058 의 POST 도 받는다 */
export const NEWSLETTER_LINK_PATHS = { confirm: "/api/newsletter/confirm", unsubscribe: "/api/newsletter/unsubscribe" } as const
/** 확인 링크 유효 기간(일). 메일 본문의 유효 시간 문구가 같은 값을 쓴다 */
export const CONFIRM_VALID_DAYS = 7

const PURPOSE = { confirm: "newsletter-confirm", unsubscribe: "newsletter-unsubscribe" } as const

export function confirmToken(o: { id: string; consentAt: Date }, secret: string, now: Date = new Date()): string {
  return signToken({ s: o.id, c: o.consentAt.getTime() }, { secret, purpose: PURPOSE.confirm, expiresAt: new Date(now.getTime() + CONFIRM_VALID_DAYS * 86_400_000) })
}

export function readConfirmToken(token: unknown, secret: string, now: Date = new Date()): { id: string; consentAt: Date } | null {
  const p = verifyToken(token, { secret, purpose: PURPOSE.confirm, now })
  return p && typeof p.s === "string" && p.s && typeof p.c === "number" ? { id: p.s, consentAt: new Date(p.c) } : null
}

export function unsubscribeToken(id: string, secret: string): string {
  return signToken({ s: id }, { secret, purpose: PURPOSE.unsubscribe })
}

export function readUnsubscribeToken(token: unknown, secret: string): string | null {
  const p = verifyToken(token, { secret, purpose: PURPOSE.unsubscribe })
  return p && typeof p.s === "string" && p.s ? p.s : null
}

const urlOf = (baseUrl: string, path: string, token: string): string => `${baseUrl.replace(/\/+$/, "")}${path}?t=${token}`

/** 수신거부 링크 하나(보내는 쪽이 메일마다 단다 — 본문 링크이자 List-Unsubscribe 주소) */
export const unsubscribeUrl = (baseUrl: string, secret: string, id: string): string => urlOf(baseUrl, NEWSLETTER_LINK_PATHS.unsubscribe, unsubscribeToken(id, secret))

/** 구독자 하나의 서명 링크 둘. baseUrl 은 앱 주소 */
export function newsletterLinks(o: { baseUrl: string; secret: string; id: string; consentAt: Date; now?: Date }): { confirmUrl: string; unsubscribeUrl: string } {
  return {
    confirmUrl: urlOf(o.baseUrl, NEWSLETTER_LINK_PATHS.confirm, confirmToken({ id: o.id, consentAt: o.consentAt }, o.secret, o.now)),
    unsubscribeUrl: unsubscribeUrl(o.baseUrl, o.secret, o.id),
  }
}
