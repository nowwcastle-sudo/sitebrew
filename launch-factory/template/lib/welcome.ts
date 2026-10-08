// 가입·로그인에 성공해 도착한 화면의 한 번짜리 안내가 읽는 주소 표지(UXOK). 순수 함수만 둔다 — 화면은 components/product/welcome-notice.tsx.
//   표지: `?welcome=signup|signin|verified|signedout`(signedout = 로그아웃 뒤 — 위 띠가 붙이고, 도착 화면이 「로그아웃했어요」를 한 번 보인다). 소셜 가입·로그인은 product-blocks.tsx 가 redirectTo 로(WELCOME_HREF),
//   확인 메일 링크는 lib/launch/auth.ts 의 EMAIL_VERIFIED_PATH 가 callbackURL 로 단다 — 둘 다 이 이름·값과 같아야 한다(template.test.mjs 가 본다).
export const WELCOME_PARAM = "welcome"
export const WELCOME_HREF = { signup: `/?${WELCOME_PARAM}=signup`, signin: `/?${WELCOME_PARAM}=signin`, signedout: `/?${WELCOME_PARAM}=signedout` } as const

export type WelcomeKind = "signup" | "signin" | "verified" | "signedout" | "failed" | "expired"
const KINDS = new Set(["signup", "signin", "verified", "signedout"])

/**
 * 주소 → 보일 안내. 확인 링크가 틀리면 Better Auth 가 같은 주소에 error= 를 붙여 보낸다 — 그때는 성공 글이 아니라 실패 글이다.
 * 코드는 진짜 Better Auth 가 내는 값이다(packages/auth/test/account.test.mjs 가 잠근다): 만료 = TOKEN_EXPIRED, 틀린·쓴 흔적 없는 서명 = INVALID_TOKEN. 모르는 값은 아무것도 보이지 않는다
 */
export function welcomeKind(params: { get(name: string): string | null }): WelcomeKind | null {
  const w = params.get(WELCOME_PARAM)
  if (!w || !KINDS.has(w)) return null
  if (w !== "verified") return w as WelcomeKind
  const error = params.get("error")
  return error ? (error === "TOKEN_EXPIRED" ? "expired" : "failed") : "verified"
}

export type WelcomeCopyKey = "signup" | "signin" | "verified" | "verifiedSignedOut" | "signedout" | "failed" | "expired" | "failedSignedOut" | "alreadyVerified"
/**
 * 어느 문구를 보일지와 「새 확인 메일 받기」 단추가 필요한지(A10·A09). 로그인한 사람의 확인 여부가 갈림길이다:
 *   이미 확인됨(옛 링크를 다시 연 경우) → 「이미 확인됐어요」 · 확인 안 됨 → 만료/틀림을 말하고 단추 · 로그아웃 → 로그인이 먼저(로그인하면 위 배너가 다시 보내기를 준다)
 */
export function welcomeView(kind: WelcomeKind, who: { signedIn: boolean; emailVerified?: boolean }): { copy: WelcomeCopyKey; resend: boolean } {
  if (kind === "expired" || kind === "failed") {
    if (!who.signedIn) return { copy: "failedSignedOut", resend: false }
    return who.emailVerified === true ? { copy: "alreadyVerified", resend: false } : { copy: kind, resend: true }
  }
  if (kind === "verified" && !who.signedIn) return { copy: "verifiedSignedOut", resend: false }
  return { copy: kind, resend: false }
}

/** 안내를 붙든 뒤 주소에서 표지(실패면 error 도)를 지운 경로 — 새로고침하면 다시 뜨지 않게. 다른 쿼리·해시는 그대로 둔다 */
export function withoutWelcome(href: string, kind: WelcomeKind): string {
  const url = new URL(href, "http://x.invalid")
  url.searchParams.delete(WELCOME_PARAM)
  if (kind === "failed" || kind === "expired") url.searchParams.delete("error")
  return url.pathname + url.search + url.hash
}

/**
 * 이 화면 안에서 로그인·가입이 끝났다는 신호(UXOK). 위 띠(session-sync.tsx 가 서버에게 세션을 다시 읽게 한다)는 쪽을 옮길 때만 다시 묻는데, 이메일 로그인·가입은 쪽을 옮기지 않고
 * 제 화면에서 「됐어요」를 보이므로, 그 순간 위 띠가 아직 「Sign in」으로 남아 있으면 안 된다. 조립하는 쪽(product-blocks.tsx)이 성공 때 알리고 위 띠가 다시 묻는다.
 */
export const SESSION_CHANGED_EVENT = "lf:session-changed"
export function announceSessionChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}
