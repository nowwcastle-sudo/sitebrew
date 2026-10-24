// launch-factory: 한국 알림 조립(Solapi 알림톡·문자). live 에서 SOLAPI_API_KEY·SOLAPI_API_SECRET·SOLAPI_SENDER 가 모두 있어야 켜진다 —
// 없으면 이 기능만 꺼진다(사이트·예약은 그대로, 안내는 메일로만). SOLAPI_KAKAO_PFID(카카오 채널 id)가 없으면 알림톡 없이 문자만 나간다.
// mock 은 외부 호출 0 이다: 켜진 것으로 보고, LF_MOCK_NOTIFY_OUTBOX 가 있으면 그 파일에 끝 4자리·템플릿·채널만 한 줄씩 남긴다.
import { consentGuard, createNotifyKr, type NotifyKr } from "@launch-factory/notify-kr"
import { MARKETING_OPT_OUT_NUMBER, NOTIFY_TEMPLATES } from "@/lib/launch/notify-kr-config"
import { database } from "@/lib/launch/db"
import { env, optional } from "@/lib/launch/env"

const SOLAPI_NAMES = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER"] as const

/** 보낼 수 있는가. 데이터베이스에 닿지 않는다 */
export function notifyKrEnabled(): boolean {
  return env().LF_MODE !== "live" || SOLAPI_NAMES.every((n) => optional(n) !== undefined)
}

let cached: Promise<NotifyKr> | undefined

/** 켜져 있을 때만 부른다(notifyKrEnabled). 꺼진 채 부르면 던진다 — 보낸 척하지 않는다 */
export function notifyKr(): Promise<NotifyKr> {
  return (cached ??= build())
}

async function build(): Promise<NotifyKr> {
  if (!notifyKrEnabled()) throw new Error(`notify-kr is off — set ${SOLAPI_NAMES.join(", ")} (see .env.example)`)
  const db = await database()
  const live = env().LF_MODE === "live"
  const outbox = optional("LF_MOCK_NOTIFY_OUTBOX")
  return createNotifyKr({
    db,
    mode: live ? "live" : "mock",
    ...(live ? { solapi: { apiKey: optional("SOLAPI_API_KEY") ?? "", apiSecret: optional("SOLAPI_API_SECRET") ?? "", sender: optional("SOLAPI_SENDER") ?? "", pfId: optional("SOLAPI_KAKAO_PFID") ?? "" } } : {}),
    templates: NOTIFY_TEMPLATES,
    ...(MARKETING_OPT_OUT_NUMBER ? { optOut: { number: MARKETING_OPT_OUT_NUMBER } } : {}),
    ...(outbox && !live ? { outbox } : {}),
    canMarketing: consentGuard(db),
    log: (line) => console.log(line),
  })
}
