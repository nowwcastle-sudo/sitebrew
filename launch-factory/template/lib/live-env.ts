// 템플릿의 환경 검사(v0 Task 10, Review Focus 5). @launch-factory/env 의 앱 스키마(LF_MODE + 공급자 키 여덟)에
// 템플릿이 live 에서 더 요구하는 이름(메일 발신·앱 주소·Cron 비밀·가명 참조 키)을 얹어 **빠진 이름을 모두 한 번에** 알린다. 값은 싣지 않는다.
// mock 은 이 이름들이 선택이다(넣었으면 형식만 본다). LF_MODE 는 항상 필수다 — 조용히 mock 으로 켜지지 않는다.
import { z } from "zod"
import { resolvePostHog } from "@launch-factory/analytics-posthog/region"
import { POSTHOG_PROJECT_KEY_FORMAT, SENTRY_DSN_FORMAT, appEnvSchema, loadEnv, type AppEnv } from "@launch-factory/env"

/** live 에서만 필수인 템플릿 이름 — 없으면 서버가 켜지지 않는다. 이름과 뜻은 .env.example 의 같은 이름을 본다 */
export const TEMPLATE_LIVE_NAMES = ["EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "CRON_SECRET", "SUBJECT_REF_KEY", "TURNSTILE_SITE_KEY"] as const
/**
 * live 에서도 없어도 켜지는 템플릿 이름 — 없으면 그 기능만 꺼진다(있으면 형식을 보고, 틀리면 켜질 때 멈춘다).
 * INQUIRY_OWNER_EMAIL: 없으면 문의 창구만 꺼진다(운영자 결정 2026-10-05 — 필수였을 때 미리보기 전 쪽이 500 이었다).
 * POSTHOG_HOST: 없으면 분석(PostHog)만 꺼진다 — 분석 스크립트·동의 띠·서버 계측(운영자 결정 2026-10-05, LFOBS). 켜질 때 검사에 없어서, 없으면 live 의 모든 쪽이 500 이었다.
 * POSTHOG_PROJECT_KEY: POSTHOG_HOST 와 같다(운영자 결정 2026-10-05, LFOBS2). 둘 중 하나라도 없으면 분석이 꺼진다. 공급자 필수 목록에서 이리로 옮겼다 — 예전엔 이 이름 하나로 live 가 켜지지 않았다.
 * SENTRY_DSN: 없으면 오류 수집(Sentry)만 꺼진다(LFOBS). 쓰지도 않는 이름이 필수 목록에 있었다.
 * scripts/env-check.mjs 가 이 두 목록을 .env.example 과 맞춰 본다. 값이 필요한 이름을 더하면 먼저 「없으면 사이트가 멈춰야 하는가」를 정한다(docs/qa/lfenv.md).
 */
export const TEMPLATE_OPTIONAL_NAMES = ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"] as const

const FORMATS = {
  EMAIL_FROM: z.string().min(3),
  NEXT_PUBLIC_APP_URL: z.url({ protocol: /^https?$/ }),
  CRON_SECRET: z.string().min(16),
  SUBJECT_REF_KEY: z.string().min(32),
  // 가입 폼의 봇 확인 위젯 키(공개 값). 없으면 live 가입이 거절된다(LFFIX F1)
  TURNSTILE_SITE_KEY: z.string().min(1),
} satisfies Record<(typeof TEMPLATE_LIVE_NAMES)[number], z.ZodType>

const OPTIONAL_FORMATS = {
  // 문의 알림을 받을 운영자 메일(개인정보 — 저장소에 적지 않는다). 없으면 문의 창구만 꺼진다. 있는데 이메일이 아니면 켜질 때 멈춘다(켜진 척하며 메일이 안 가는 것이 가장 나쁘다)
  INQUIRY_OWNER_EMAIL: z.email(),
  // PostHog 수집 호스트(us·eu). 지역을 정할 수 있는 값만 받는다 — 프록시·http 처럼 지역을 못 정하면 국외 이전 고지가 비므로 켜질 때 멈춘다(예전엔 모든 쪽 렌더에서 던졌다)
  POSTHOG_HOST: z.string().refine((v) => {
    try {
      resolvePostHog({ host: v })
      return true
    } catch {
      return false
    }
  }),
  // PostHog 공개 프로젝트 키(phc_…). 있는데 공백이 섞였으면 켜질 때 멈춘다
  POSTHOG_PROJECT_KEY: POSTHOG_PROJECT_KEY_FORMAT,
  // https://공개키@호스트[/경로]/프로젝트번호
  SENTRY_DSN: SENTRY_DSN_FORMAT,
} satisfies Record<(typeof TEMPLATE_OPTIONAL_NAMES)[number], z.ZodType>

type Source = Record<string, string | undefined>

export function templateEnv(source: Source = process.env): AppEnv & Partial<Record<(typeof TEMPLATE_LIVE_NAMES | typeof TEMPLATE_OPTIONAL_NAMES)[number], string>> {
  const mode = source.LF_MODE === "live" ? "live" : "mock"
  const shape: Record<string, z.ZodType> = {}
  for (const name of TEMPLATE_LIVE_NAMES) shape[name] = mode === "live" ? FORMATS[name] : FORMATS[name].optional()
  for (const name of TEMPLATE_OPTIONAL_NAMES) shape[name] = OPTIONAL_FORMATS[name].optional()
  return loadEnv(appEnvSchema(mode).extend(shape), source) as never
}
