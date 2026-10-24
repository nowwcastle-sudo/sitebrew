// 웹 푸시 브라우저 쪽 순수 도우미(React·DOM 전역 없음 — 가져오는 것만으로는 아무 일도 하지 않는다). 화면은 components/product/push-toggle.tsx.

/** VAPID 공개키(base64url)를 pushManager.subscribe 의 applicationServerKey 가 받는 바이트로 바꾼다 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=")
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** 브라우저가 가진 푸시 재료(전역을 읽는 쪽이 채워 넘긴다) */
export interface PushEnv {
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
}

/** 이 기기에서 푸시를 켤 수 있는가 — 서비스 워커·PushManager·Notification 셋 다 있어야 한다 */
export const pushSupported = (env: PushEnv): boolean => env.serviceWorker && env.pushManager && env.notification

/** 단추가 보일 상태: unsupported=이 브라우저는 안 됨 · blocked=브라우저 설정에서 막힘 · on=이 기기에서 켜짐 · off=꺼짐(켤 수 있음) */
export type PushState = "unsupported" | "blocked" | "on" | "off"

/** 지원 여부·알림 권한·구독 여부로 상태를 정한다. 권한이 막혔으면(denied) 구독이 남아 있어도 알림은 오지 않으므로 blocked 가 이긴다 */
export function derivePushState({ supported, permission, subscribed }: { supported: boolean; permission: NotificationPermission | null; subscribed: boolean }): PushState {
  if (!supported) return "unsupported"
  if (permission === "denied") return "blocked"
  return subscribed && permission === "granted" ? "on" : "off"
}
