// 소셜 로그인 켜는 규칙(순수 함수 — 의존 없음. scripts/doctor.mjs 도 이 파일을 그대로 읽는다).
// 공급자마다 `<P>_CLIENT_ID`·`<P>_CLIENT_SECRET` 둘 다 있으면 켠다. 하나만 있으면 켜지 않고 알린다(doctor 경고) — 반쪽 키로 켜면 createAuth 가 던진다.
// live·mock 모두 같은 규칙이다(mock 의 화면 확인용 버튼은 목 포트가 따로 보인다 — template/lib/ports.ts).
export const SOCIAL_PROVIDERS = ["google", "kakao", "naver"] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** 소셜 키 이름. 값은 어디에도 싣지 않는다 */
export const socialEnvNames = (p: SocialProvider) => [`${p.toUpperCase()}_CLIENT_ID`, `${p.toUpperCase()}_CLIENT_SECRET`] as const

/** 모든 공급자의 키 이름(환경 읽기 목록) */
export const SOCIAL_ENV_NAMES: readonly string[] = SOCIAL_PROVIDERS.flatMap((p) => socialEnvNames(p))

export interface SocialsFromEnv {
  /** 키가 둘 다 있어 켜는 공급자(SOCIAL_PROVIDERS 순서) */
  enabled: SocialProvider[]
  /** 키가 하나만 있어 켜지 못하는 공급자와 빠진 이름 */
  partial: { provider: SocialProvider; missing: string[] }[]
}

export function socialsFromEnv(env: Record<string, string | undefined>): SocialsFromEnv {
  const enabled: SocialProvider[] = []
  const partial: SocialsFromEnv["partial"] = []
  for (const provider of SOCIAL_PROVIDERS) {
    const names = socialEnvNames(provider)
    const missing = names.filter((n) => !env[n]?.trim())
    if (missing.length === 0) enabled.push(provider)
    else if (missing.length < names.length) partial.push({ provider, missing })
  }
  return { enabled, partial }
}
