// 소셜 로그인이 실패해 돌아왔을 때의 안내(v0 소셜 레인 · B05). Better Auth 가 공급자 콜백의 실패를 `<errorCallbackURL>?error=<코드>` 로 돌려준다(lib/launch/auth.ts 의 SOCIAL_ERROR_PATH).
// 코드는 Better Auth 1.7.6 의 콜백(dist/api/routes/callback.mjs · oauth2/errors.mjs · oauth2/link-account.mjs · oauth2/state.mjs)이 만든다. 코드마다 「무슨 일이고, 다음에 무엇을 하는지」를 말하고, 할 수 있는 행동은 링크로 준다.
// 같은 말이 필요한 코드는 한 칸을 함께 쓴다(예: 세션·상태가 어긋난 여섯). 모르는 코드는 일반 문구로 — 주소의 글자를 화면에 그대로 싣지 않는다.
// 읽은 뒤 주소의 ?error= 를 지우고(새로고침해도 다시 뜨지 않는다) 안내 상자로 포커스를 옮긴다(social-error-effects.tsx — 화면 읽기 프로그램·키보드 사용자가 놓치지 않게).
import Link from "next/link"
import { SocialErrorEffects } from "@/components/product/social-error-effects"

interface Entry {
  text: string
  links: { href: string; label: string }[]
}

const CREATE = { href: "/sign-up", label: "Create an account" }
const RESET = { href: "/forgot-password", label: "Reset your password" }
const AGAIN = { href: "/sign-in", label: "Start again" }

const SESSION: Entry = {
  text: "That sign-in took too long or was opened in a different tab or browser. Start again from this page and finish it in the same tab.",
  links: [AGAIN],
}
const PROFILE: Entry = {
  text: "We couldn't read your details from that provider. Try again, or sign in with your email and password instead.",
  links: [AGAIN],
}
const LINK_CONFLICT: Entry = {
  text: "That login is already connected to a different account, or doesn't match the email on this one. Sign in with the method you used when you signed up.",
  links: [AGAIN, RESET],
}

const KNOWN: Record<string, Entry> = {
  signup_disabled: { text: "We couldn't find an account for that login. Create an account first, then you can sign in with it.", links: [CREATE] },
  consent_required: { text: "Creating an account needs your agreement to the terms. Please start from the sign-up page.", links: [CREATE] },
  account_not_linked: {
    text: "An account with that email already exists, but it isn't connected to this login. Sign in with your email and password. If you don't remember the password, reset it. If you never confirmed your email, open the confirmation link we sent you first.",
    links: [RESET],
  },
  unable_to_link_account: {
    text: "We couldn't connect that login to your account. Sign in with your email and password instead, or try a different login method.",
    links: [RESET],
  },
  email_does_not_match: LINK_CONFLICT,
  account_already_linked_to_different_user: LINK_CONFLICT,
  account_ownership_conflict: LINK_CONFLICT,
  email_not_found: {
    text: "That provider didn't share an email address with us, so we can't match or create your account. Allow email access on the provider's consent screen and try again, or sign up with your email.",
    links: [AGAIN, CREATE],
  },
  email_not_verified: {
    text: "That provider hasn't confirmed your email address yet. Confirm it with the provider and try again, or sign in with your email and password.",
    links: [AGAIN],
  },
  state_mismatch: SESSION,
  state_not_found: SESSION,
  invalid_code: SESSION,
  no_code: SESSION,
  issuer_mismatch: SESSION,
  nonce_binding_missing: SESSION,
  unable_to_get_user_info: PROFILE,
  unable_to_create_user: PROFILE,
  unable_to_create_session: PROFILE,
  oauth_provider_not_found: { text: "That sign-in method isn't available here. Use another method below.", links: [AGAIN] },
  access_denied: { text: "Sign-in was cancelled. You can try again whenever you like.", links: [AGAIN] },
}

const FALLBACK: Entry = { text: "We couldn't finish signing you in with that provider. Please try again, or sign in with your email and password.", links: [AGAIN] }

export const SOCIAL_ERROR_ID = "social-error"

export function SocialErrorNotice({ code }: { code?: string | string[] }) {
  if (typeof code !== "string" || !code) return null
  const known = KNOWN[code.toLowerCase()]
  const { text, links } = known ?? FALLBACK
  return (
    <div id={SOCIAL_ERROR_ID} tabIndex={-1} role="alert" data-social-error={known ? code.toLowerCase() : "other"} className="mx-auto mt-8 w-full max-w-md border border-destructive px-4 py-3 text-base leading-[1.6] outline-offset-4">
      <p>{text}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="underline underline-offset-4">
            {l.label}
          </Link>
        ))}
      </p>
      <SocialErrorEffects targetId={SOCIAL_ERROR_ID} />
    </div>
  )
}
