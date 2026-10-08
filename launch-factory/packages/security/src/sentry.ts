// Sentry 설정 조각. `@sentry/nextjs` 의 `Sentry.init({ ...sentryOptions({ dsn }) })` 에 펼쳐 넣는다.
//   이 패키지는 Sentry 를 의존하지 않는다(설치는 템플릿이 한다). 필요한 모양만 여기서 정한다.
import { maskDeep } from "./pii.ts"

// Sentry 의 ErrorEvent·Breadcrumb 는 인덱스 시그니처가 없는 인터페이스라 Record<string, unknown> 제약을 못 맞춘다(@sentry/nextjs 11.4.0 실타입 검사에서 확인 — D16). 객체면 된다.
type SentryEvent = object
type Breadcrumb = object

const SECRET_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "paddle-signature", "proxy-authorization"])

/** 이벤트 하나를 가린다: 사용자는 내부 id 만 남기고, 비밀 헤더·쿠키를 지우고, 모든 문자열에서 이메일·전화·토큰 모양을 가린다. */
export function scrubEvent<E extends SentryEvent>(event: E): E {
  const out = maskDeep(event) as Record<string, unknown>
  const user = out.user as Record<string, unknown> | undefined
  if (user && typeof user === "object") {
    if (user.id !== undefined) out.user = { id: user.id }
    else delete out.user
  }
  const request = out.request as Record<string, unknown> | undefined
  if (request && typeof request === "object") {
    delete request.cookies
    const headers = request.headers as Record<string, unknown> | undefined
    if (headers && typeof headers === "object") {
      for (const k of Object.keys(headers)) if (SECRET_HEADERS.has(k.toLowerCase())) headers[k] = "[token]"
    }
  }
  return out as E
}

export interface SentryOptionsInput {
  dsn: string
  environment?: string
  release?: string
}

export function sentryOptions({ dsn, environment, release }: SentryOptionsInput) {
  return {
    dsn,
    environment,
    release,
    // IP·쿠키·요청 본문 같은 기본 개인정보 수집을 끈다.
    sendDefaultPii: false as const,
    beforeSend: <E extends SentryEvent>(event: E): E => scrubEvent(event),
    beforeBreadcrumb: <B extends Breadcrumb>(breadcrumb: B): B => maskDeep(breadcrumb),
  }
}

/**
 * DSN 에서 수집 출처(https://호스트)를 꺼낸다 — 브라우저 SDK 가 오류를 보내는 곳이라 CSP connect-src 에 이 한 곳만 연다(LFOBS).
 * DSN 이 없거나 https 가 아니거나 모양이 틀리면 undefined(그러면 아무것도 열지 않는다).
 */
export function sentryIngestOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined
  try {
    const u = new URL(dsn)
    return u.protocol === "https:" && u.username ? u.origin : undefined
  } catch {
    return undefined
  }
}
