// 시험 재료: 실제 모양의 구독 키(P-256 + 16바이트 auth)와 VAPID 키. 네트워크 0.
import { createECDH, randomBytes } from "node:crypto"
import webpush from "web-push"

let seq = 0
/** 브라우저가 주는 PushSubscription.toJSON() 과 같은 모양 */
export function makeSub(overrides = {}) {
  const ecdh = createECDH("prime256v1")
  ecdh.generateKeys()
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/device-${++seq}-${randomBytes(6).toString("hex")}`,
    expirationTime: null,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
    ...overrides,
  }
}

/** web-push 가 만든 진짜 VAPID 키 한 쌍(시험마다 새로) */
export function makeVapid(subject = "mailto:ops@example.com") {
  return { subject, ...webpush.generateVAPIDKeys() }
}

export const U1 = "u-push-1"
export const U2 = "u-push-2"

/** user 행을 만든다(push_subscriptions.user_id 외래키) */
export async function insertUsers(d, sql, ids = [U1, U2]) {
  for (const id of ids) await d.execute(sql`insert into "user" (id, name, email) values (${id}, ${id}, ${`${id}@example.com`})`)
}

/** 호출을 기록하고 미리 정한 결과를 돌려주는 가짜 전송기. script 는 endpoint → 결과 또는 () => 결과 */
export function fakeTransport(script = () => ({ ok: true })) {
  const calls = []
  const transport = async (sub, payload, opts) => {
    calls.push({ sub, payload, opts })
    return typeof script === "function" ? script(sub, calls.length) : (script[sub.endpoint] ?? { ok: true })
  }
  transport.calls = calls
  return transport
}
