// launch-factory: 웹 푸시 조립. 로그인한 사용자의 기기 구독을 저장하고 VAPID 로 알림을 보낸다(비로그인 방문자는 메일·알림톡).
// live 에서 VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY·VAPID_SUBJECT 가 모두 맞아야 켜진다 — 없거나 틀리면 이 기능만 꺼진다(pushEnabled() 가 false, 구독은 provider_unavailable).
// mock 은 외부 호출 0 이다: 구독은 저장하고 보내기는 기록만 한다. 키 생성: npx web-push generate-vapid-keys
import { createPushService, isValidVapid, type PushService } from "@launch-factory/push"
import { database } from "@/lib/launch/db"
import { env, optional } from "@/lib/launch/env"

function vapid() {
  return { subject: optional("VAPID_SUBJECT") ?? "", publicKey: optional("VAPID_PUBLIC_KEY") ?? "", privateKey: optional("VAPID_PRIVATE_KEY") ?? "" }
}

/** 구독·보내기가 되는가. 데이터베이스에 닿지 않는다 */
export function pushEnabled(): boolean {
  return env().LF_MODE !== "live" || isValidVapid(vapid())
}

let cached: Promise<PushService> | undefined

export function push(): Promise<PushService> {
  return (cached ??= build())
}

async function build(): Promise<PushService> {
  const live = env().LF_MODE === "live"
  const keys = vapid()
  return createPushService({
    db: await database(),
    mode: live ? "live" : "mock",
    ...(isValidVapid(keys) ? { vapid: keys } : {}),
    onError: (e) => console.error("[push]", e instanceof Error ? e.name : "error"),
  })
}
