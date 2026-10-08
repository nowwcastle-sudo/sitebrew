// 환경 검증. 빠진 이름을 **모두** 모아 한 번에 알린다(계획 Review Focus 5). 오류에는 이름만 싣고 값은 싣지 않는다.
import { z } from "zod"
import { readSecrets } from "./secret.ts"

export { readSecret, readSecrets, maskSecrets, windowsUserEnv, windowsPowerShellPath } from "./secret.ts"
export type { UserEnvReader } from "./secret.ts"
import { BUSINESS_ENV_NAMES } from "./business.ts"
export { BUSINESS_ENV, BUSINESS_ENV_NAMES, BUSINESS_KEYS, BUSINESS_LABELS, REQUIRED_BUSINESS_KEYS, businessInfo, filledBusinessInfo, missingRequiredBusinessInfo } from "./business.ts"
export type { BusinessField, BusinessInfo, BusinessKey } from "./business.ts"

type Source = Record<string, string | undefined>

export class EnvError extends Error {
  readonly missing: string[]
  readonly invalid: string[]
  constructor(missing: string[], invalid: string[]) {
    const parts: string[] = []
    if (missing.length) parts.push(`없음 ${missing.length}개: ${missing.join(", ")}`)
    if (invalid.length) parts.push(`형식 오류 ${invalid.length}개: ${invalid.join(", ")}`)
    super(`환경 변수 확인 실패 — ${parts.join(" · ")}. 이름과 뜻은 .env.example 을 본다.`)
    this.name = "EnvError"
    this.missing = missing
    this.invalid = invalid
  }
}

/**
 * `schema`로 `source`를 검사한다. 빈 문자열은 없는 것으로 본다.
 * 실패하면 빠진 이름과 형식이 틀린 이름을 모두 모아 `EnvError` 하나로 던진다(zod 메시지는 값이 섞일 수 있어 싣지 않는다).
 */
export function loadEnv<S extends z.ZodObject>(schema: S, source: Source = process.env): z.infer<S> {
  const cleaned: Source = {}
  for (const [k, v] of Object.entries(source)) if (v !== undefined && v !== "") cleaned[k] = v
  const r = schema.safeParse(cleaned)
  if (r.success) return r.data
  const missing = new Set<string>()
  const invalid = new Set<string>()
  for (const issue of r.error.issues) {
    const name = String(issue.path[0] ?? "(전체)")
    if (cleaned[name] === undefined) missing.add(name)
    else invalid.add(name)
  }
  throw new EnvError([...missing], [...invalid].filter((n) => !missing.has(n)))
}

/** 공급자 비밀값 이름. `.env.example`과 같은 목록이다. live 모드에서만 요구한다. */
export const PROVIDER_SECRET_NAMES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "TURNSTILE_SECRET_KEY",
] as const
export type ProviderSecretName = (typeof PROVIDER_SECRET_NAMES)[number]

const FORMATS: Record<ProviderSecretName, z.ZodString | z.ZodURL> = {
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/\S+$/),
  BETTER_AUTH_SECRET: z.string().min(32),
  PADDLE_API_KEY: z.string().min(1),
  PADDLE_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
}

/**
 * 앱이 선택적으로 읽는 비밀 이름(설치한 항목이 required() 로 요구한다 — live 에서도 env 검사는 없어도 통과하고, 있으면 형식만 본다).
 * 공급자 비밀(PROVIDER_SECRET_NAMES)과 합쳐 SECRET_NAMES 가 된다.
 */
export const EXTRA_SECRET_NAMES = ["POSTHOG_PROJECT_KEY", "SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SUBJECT_REF_KEY", "POSTHOG_PERSONAL_API_KEY", "GUMROAD_ACCESS_TOKEN", "GUMROAD_PING_SECRET", "CRON_SECRET", "GITHUB_TOKEN", "GH_TOKEN", "GOOGLE_CLIENT_SECRET", "KAKAO_CLIENT_SECRET", "NAVER_CLIENT_SECRET"] as const
/**
 * 값을 출력·로그에 절대 싣지 않는 이름 전부(비밀이거나 비밀이 섞인 URL). **한 원천**이다 — scripts/doctor.mjs 가 이 배열을 그대로 쓴다(대장 D193).
 * 새 비밀을 더하면 여기 한 곳만 고친다.
 */
export const SECRET_NAMES = [...PROVIDER_SECRET_NAMES, ...EXTRA_SECRET_NAMES] as const
/** 비밀은 아니지만 앱·doctor 가 읽는 이름 */
export const PLAIN_NAMES = ["LF_MODE", "LF_PADDLE_LIVE", "PADDLE_CLIENT_TOKEN", "POSTHOG_HOST", "POSTHOG_PROJECT_ID", "EMAIL_FROM", "TURNSTILE_SITE_KEY", "GITHUB_REPOSITORY", "GOOGLE_CLIENT_ID", "KAKAO_CLIENT_ID", "NAVER_CLIENT_ID", ...BUSINESS_ENV_NAMES] as const

/** 선택 이름의 형식(있을 때만 본다). 공급자에 실제로 되는지는 doctor 가 부른다 */
/**
 * Sentry DSN 모양: https://공개키@호스트[/경로]/프로젝트번호. 없으면 오류 수집이 꺼진다(LFOBS — 필수였을 때는 쓰지도 않는데 켜질 때 막았다). 있는데 모양이 틀리면 켜질 때 멈춘다.
 * Sentry 에는 DSN 이 살아 있는지 읽는 공개 엔드포인트가 없어 모양만 본다(scripts/doctor.mjs 의 같은 규칙).
 */
export const SENTRY_DSN_FORMAT = z.url({ protocol: /^https$/ }).refine((v) => {
  try {
    const u = new URL(v)
    return u.username !== "" && /\/\d+$/.test(u.pathname)
  } catch {
    return false
  }
})

/**
 * PostHog 프로젝트 키(공개 키 phc_…). 없으면 분석이 꺼진다(LFOBS2 — POSTHOG_HOST 와 같은 선택 이름). 있는데 비어 보이거나 공백이 섞였으면 켜질 때 멈춘다
 * (예전 필수 검사는 min(1) 이라 「 」(공백 하나)가 통과했고 클라이언트가 렌더 중에 던졌다).
 */
export const POSTHOG_PROJECT_KEY_FORMAT = z.string().regex(/^\S+$/)

const OPTIONAL_FORMATS: Record<string, z.ZodType> = {
  POSTHOG_PROJECT_KEY: POSTHOG_PROJECT_KEY_FORMAT,
  SENTRY_DSN: SENTRY_DSN_FORMAT,
  SUBJECT_REF_KEY: z.string().min(32),
  CRON_SECRET: z.string().min(16),
  POSTHOG_PERSONAL_API_KEY: z.string().min(1),
  GUMROAD_ACCESS_TOKEN: z.string().min(1),
  GUMROAD_PING_SECRET: z.string().min(1),
  PADDLE_CLIENT_TOKEN: z.string().min(1),
  POSTHOG_HOST: z.url({ protocol: /^https?$/ }),
  POSTHOG_PROJECT_ID: z.string().regex(/^\d+$/),
  EMAIL_FROM: z.string().min(3),
}

export type LfMode = "mock" | "live"
export type AppEnv = { LF_MODE: LfMode } & Partial<Record<ProviderSecretName | "POSTHOG_PROJECT_KEY", string>>

/** mock 이면 공급자 키는 선택(넣었으면 형식만 본다), live 이면 모두 필수다. `LF_MODE` 는 항상 필수다 — 조용히 mock 으로 켜지지 않는다. */
export function appEnvSchema(mode: LfMode) {
  const shape: Record<string, z.ZodType> = { LF_MODE: z.enum(["mock", "live"]) }
  for (const name of PROVIDER_SECRET_NAMES) shape[name] = mode === "live" ? FORMATS[name] : FORMATS[name].optional()
  for (const [name, format] of Object.entries(OPTIONAL_FORMATS)) shape[name] = format.optional()
  return z.object(shape)
}

/** mock 모드를 운영(NODE_ENV=production) 실행에서 막았을 때 던진다. 이름만 싣는다. */
export class MockModeError extends Error {
  constructor() {
    super(
      "mock 모드는 공개할 수 없어요 — LF_MODE=live 와 공급자 키를 넣으세요. 내 기계에서 운영 빌드를 시험만 할 때는 LF_ALLOW_MOCK_PROD=1. " +
        "/ mock mode cannot be deployed — set LF_MODE=live and the provider keys. To smoke-test a production build on your own machine only, set LF_ALLOW_MOCK_PROD=1.",
    )
    this.name = "MockModeError"
  }
}

/**
 * 운영 실행(NODE_ENV=production — next build·next start, Vercel 의 production·preview 배포가 모두 여기다)에서 mock 이면 막는다:
 * mock 은 로그인 없이 구독 상태를 보이고 세션이 방문자끼리 이어지는 개발 도구라, 공개되면 안 된다. 내 기계의 운영 빌드 시험만 LF_ALLOW_MOCK_PROD=1 로 연다.
 */
export function assertMockNotDeployed(src: Source): void {
  if (src.NODE_ENV === "production" && src.LF_ALLOW_MOCK_PROD !== "1") throw new MockModeError()
}

/** 앱 환경을 읽고 검사한다. `source`를 주지 않으면 프로세스 환경 → Windows 사용자 환경 순으로 읽는다. */
export function loadAppEnv(source?: Source): AppEnv {
  const src = source ?? { ...process.env, ...readSecrets(["LF_MODE", ...PROVIDER_SECRET_NAMES]) }
  const mode: LfMode = src.LF_MODE === "live" ? "live" : "mock"
  if (src.LF_MODE === "mock") assertMockNotDeployed(src)
  return loadEnv(appEnvSchema(mode), src) as AppEnv
}
