// launch-factory: Better Auth 조립. getAuth() = 요청 처리기(경로용), authPort() = 계약 AuthPort 어댑터(서버 액션용).
// 요청 제한 저장소는 DB 다. 가입 폼은 Cloudflare Turnstile 로 봇을 거른다(mock 은 통과, live 는 TURNSTILE_SECRET_KEY 필수).
import { randomBytes } from "node:crypto"
import { cookies, headers } from "next/headers"
import { after } from "next/server"
import { authAdapter, createAuth, notMeToken, SOCIAL_ENV_NAMES, socialsFromEnv, type Auth, type AuthIO, type LaunchAuthPort } from "@launch-factory/auth"
import { authEmails } from "@launch-factory/email"
import { readSecrets } from "@launch-factory/env"
import { ipAddressFromEnv } from "@launch-factory/security/rate-limit"
import { createTurnstile } from "@launch-factory/security/turnstile"
import { appUrl, CONSENT_VERSIONS, DEFAULT_LOCALE, PRODUCT_NAME, ROUTES } from "@/lib/launch/config"
import { database } from "@/lib/launch/db"
import { AUTH_FEATURES } from "@/lib/launch/features"
import { env, required } from "@/lib/launch/env"
import { linkSecret } from "@/lib/launch/link-secret"
import { mailer } from "@/lib/launch/mailer"
import { sendMarketingNotice } from "@/lib/launch/notices"

/** mock 에서 BETTER_AUTH_SECRET 이 없으면 프로세스마다 새로 만든다(고정값을 코드에 두지 않는다 — 재시작하면 로그인이 풀린다). live 는 32자 이상이 필수다 */
const mockSecret = () => randomBytes(32).toString("hex")

/**
 * 메일 발송은 응답을 기다리지 않는다(대장 D202 — Better Auth 공식 문서: 기다리면 있는 계정만 느려져 이메일 존재 여부가 시간으로 드러난다).
 * Next 의 after 가 응답 뒤에도 서버리스 함수를 살려 발송을 끝낸다(Vercel 에서는 waitUntil 로 구현된다). 요청 밖이면 after 가 던지므로 그냥 백그라운드로 둔다.
 */
function runInBackground(task: Promise<unknown>): void {
  try {
    after(task)
  } catch {
    void task
  }
}

/** 소셜 로그인이 실패하면 돌아오는 화면(?error=signup_disabled 등이 붙는다). 이 화면이 안내를 보인다(app/(product)/sign-in/page.tsx) */
export const SOCIAL_ERROR_PATH = "/sign-in"

/**
 * 확인 메일의 링크를 누르면 닿는 곳(UXOK). `?welcome=verified` 표지를 보고 도착 화면이 「확인됐어요」를 한 번 보인다(components/product/welcome-notice.tsx).
 * 그 안내를 만들지 않은 제품은 이 줄을 `"/"` 로 바꾼다. 링크가 틀리면 Better Auth 가 같은 주소에 `error=` 를 덧붙인다.
 */
export const EMAIL_VERIFIED_PATH = "/?welcome=verified"

let cached: Promise<Auth> | undefined

export function getAuth(): Promise<Auth> {
  return (cached ??= build())
}

async function build(): Promise<Auth> {
  const e = env()
  const live = e.LF_MODE === "live"
  const emails = authEmails(mailer(), {
    productName: PRODUCT_NAME,
    defaultLocale: DEFAULT_LOCALE,
    securityUrl: `${appUrl()}${ROUTES.security}`,
    // C02: 비밀번호·이메일 변경 알림의 「문의하기」 버튼
    contactUrl: `${appUrl()}${ROUTES.contact}`,
    // G05: 이메일을 확인한 뒤 한 번 보내는 환영 메일의 「열기」 링크
    appUrl: appUrl(),
    // A13: 확인 메일의 「제가 가입한 게 아니에요」 — 서명 토큰 링크(확인 화면 /email 을 거쳐 아직 확인 안 된 그 계정만 지운다)
    notMeUrl: (r) => (r.id ? `${appUrl()}/api/account/not-me?t=${notMeToken(r.id, linkSecret())}` : undefined),
  })
  // 소셜 로그인: 공급자마다 <P>_CLIENT_ID·<P>_CLIENT_SECRET 둘 다 있을 때만 켠다(live·mock 같은 규칙). 하나만 있으면 켜지 않는다 — 이름만 알린다(값은 싣지 않는다).
  // 키는 프로세스 환경 → Windows 사용자 환경 순으로 읽는다(doctor 와 같은 순서라 doctor 가 통과하면 앱도 켜진다).
  const socialEnv = readSecrets(SOCIAL_ENV_NAMES)
  const { enabled: socials, partial } = socialsFromEnv(socialEnv)
  for (const { provider, missing } of partial) console.warn(`[auth] ${provider} sign-in is off: missing ${missing.join(", ")} (both CLIENT_ID and CLIENT_SECRET are needed)`)
  return createAuth({
    db: await database(),
    secret: live ? required("BETTER_AUTH_SECRET") : (e.BETTER_AUTH_SECRET ?? mockSecret()),
    baseURL: appUrl(),
    consentVersions: CONSENT_VERSIONS,
    socials,
    env: socialEnv,
    // 선택 조각(lib/launch/features.ts). 관리자는 2단계 인증이 필요해 둘이 함께 켜진다(feature-admin)
    twoFactor: AUTH_FEATURES.twoFactor,
    admin: AUTH_FEATURES.admin,
    botCheck: createTurnstile(live ? { mode: "live", secretKey: required("TURNSTILE_SECRET_KEY") } : { mode: "mock" }),
    // 재설정 메일(sendResetPassword)을 포함한 계정 보안 메일 다섯이 authEmails 로 나간다(D180). 보내기 실패는 Better Auth 가 onError 로만 알린다.
    mailer: emails,
    runInBackground,
    // A06: 가입 때 마케팅 수신에 동의했으면 처리 결과 통지 메일(정보통신망법 제50조제7항 · 시행령 제62조의2 — 14일 안에 전송자·사실과 날짜·결과). 설정 화면의 통지(lib/launch/consents.ts)와 같은 메일이다.
    // 보내기가 실패하면 발신함에 남고 Cron(/api/cron/notices)이 다시 보낸다(D210). 가입은 되돌리지 않는다.
    onSignUpMarketing: (e) => sendMarketingNotice({ userId: e.userId, changes: e.changes, at: e.at }, "sign_up"),
    // 요청 제한이 믿을 IP 머리(대장 D205). 요청 제한 항목·문의 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    ipAddress: ipAddressFromEnv(process.env),
  })
}

type Cookie = { name: string; value: string; path?: string; domain?: string; maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" }

/** Set-Cookie 한 줄 → cookies().set 인자. Better Auth 는 값을 URL 인코딩해 보내므로 한 번 풀어 넘긴다(Next 가 다시 인코딩한다) */
function parseSetCookie(line: string): { cookie: Cookie; raw: string } {
  const [pair = "", ...attrs] = line.split(";").map((s) => s.trim())
  const eq = pair.indexOf("=")
  const name = pair.slice(0, eq)
  const raw = pair.slice(eq + 1)
  const cookie: Cookie = { name, value: decodeURIComponent(raw) }
  for (const attr of attrs) {
    const [k = "", v = ""] = attr.split("=")
    switch (k.toLowerCase()) {
      case "path": cookie.path = v; break
      case "domain": cookie.domain = v; break
      case "max-age": cookie.maxAge = Number(v); break
      case "expires": cookie.expires = new Date(v); break
      case "httponly": cookie.httpOnly = true; break
      case "secure": cookie.secure = true; break
      case "samesite": cookie.sameSite = v.toLowerCase() as Cookie["sameSite"]; break
    }
  }
  return { cookie, raw }
}

/** 요청 하나에 붙는 입출력. 이 요청에서 방금 받은 쿠키는 다음 headers() 호출부터 보인다(로그아웃 뒤 session() 이 null 이 되도록) */
export async function authIO(): Promise<AuthIO> {
  const fresh = new Map<string, string | null>()
  return {
    async headers() {
      const h = new Headers(await headers())
      if (fresh.size) {
        const kept = (h.get("cookie") ?? "").split(";").map((s) => s.trim()).filter((c) => c && !fresh.has(c.split("=")[0] ?? ""))
        for (const [name, raw] of fresh) if (raw !== null) kept.push(`${name}=${raw}`)
        h.set("cookie", kept.join("; "))
      }
      return h
    },
    async setCookies(lines) {
      const store = await cookies()
      for (const line of lines) {
        const { cookie, raw } = parseSetCookie(line)
        const { name, value, ...options } = cookie
        store.set(name, value, options)
        fresh.set(name, (options.maxAge ?? 1) <= 0 || value === "" ? null : raw)
      }
    },
  }
}

export async function authPort(): Promise<LaunchAuthPort> {
  // 재설정 메일 링크는 /reset-password?token=… 로 닿는다(LFFIX F4 — 그 쪽은 제품이 만든다. 안 만들었으면 이 줄을 지운다)
  return authAdapter(await getAuth(), await authIO(), { callbackURL: "/", errorCallbackURL: SOCIAL_ERROR_PATH, locale: DEFAULT_LOCALE, resetPasswordPath: "/reset-password", emailVerifiedPath: EMAIL_VERIFIED_PATH })
}
