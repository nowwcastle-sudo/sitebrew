// launch-factory: 서버 계측(posthog-node). 웹훅·서버 액션에서 나는 이벤트(예: checkout_complete)를 보낸다.
// 서버는 방문자의 동의를 모른다 — 부르는 쪽이 저장해 둔 결정을 forRequest 에 넘긴다. analytics 가 true 가 아니면 보내지도 쌓지도 않는다.
// distinctId 는 제품 내부 사용자 id 다(이메일 금지 — 어댑터가 거절한다).
// 분석은 선택이다(LFOBS·LFOBS2): live 에서 POSTHOG_HOST 나 POSTHOG_PROJECT_KEY 가 없으면 분석이 꺼진 것이다 — 이 함수는 던지지 않고, 아무것도 보내지 않는 같은 모양의 계측(enabled false)을 돌려준다.
// mock 도 마찬가지다(공급자에 보내지 않는다). 켜졌는지는 analytics().enabled 로 본다.
import { createServerAnalytics, disabledServerAnalytics, type DisabledServerAnalytics, type ServerAnalytics } from "@launch-factory/analytics-posthog/server"
import { env, optional } from "@/lib/launch/env"

let cached: ServerAnalytics | DisabledServerAnalytics | undefined

export function analytics(): ServerAnalytics | DisabledServerAnalytics {
  if (cached) return cached
  const host = optional("POSTHOG_HOST")
  const projectKey = optional("POSTHOG_PROJECT_KEY")
  return (cached = env().LF_MODE === "live" && host && projectKey ? createServerAnalytics({ projectKey, host }) : disabledServerAnalytics())
}
