// 이메일 확인 화면들(P1AB B2)이 같이 쓰는 순수 판단. 화면은 components/product/{unverified-banner,verify-email-note,checkout-email-note}.tsx.

/**
 * 확인 안 된 사람에게 위 배너를 보일까(A11). `emailVerified === false` 일 때만 — 값이 없으면(카카오 대체 주소처럼 확인할 수 없는 주소, D43) 배너 대상이 아니다.
 * 확인 쪽(/verify-email)은 제 안내가 있어 배너를 겹쳐 보이지 않는다. 결제는 막지 않는다(운영자 결정 2026-10-07 — 배너 + 결제 직전 주소 표시만).
 */
export function showVerifyBanner(emailVerified: boolean | null | undefined, pathname: string): boolean {
  return emailVerified === false && pathname !== "/verify-email"
}

// 확인 쪽(/verify-email)의 「다시 보내기」 잠금은 상수가 없다(LFPIN12): 이 쪽은 가입 직후가 아니라 배너·만료 링크 안내에서 열려서 블록에 `initialWait={0}` 을 준다(처음엔 풀려 있다).
// 보낸 뒤 잠금은 블록 기본 60초이고 서버의 요청 제한 창(60초에 3번)과 같다. 예전에는 `resendAfter` 를 20초로 줄여 썼다(web-factory 에 첫 잠금을 가르는 속성이 없던 때의 우회).

/** 국내 포털 메일 도메인(A18) — 새 보낸이를 스팸함에 넣거나 늦게 배달하기로 알려진 곳. 도메인이 정확히 같을 때만 맞는다(하위 도메인·접미 일치는 아니다) */
const KOREAN_PORTALS = new Set(["naver.com", "daum.net", "hanmail.net", "kakao.com", "nate.com"])

export function isKoreanPortalMail(email: string | null | undefined): boolean {
  const at = email?.lastIndexOf("@") ?? -1
  return !!email && at > 0 && KOREAN_PORTALS.has(email.slice(at + 1).trim().toLowerCase())
}
