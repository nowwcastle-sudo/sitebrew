"use server"
// launch-factory: 웹 푸시 서버 액션 — 로그인한 사용자만. 공개 경로라 입력은 서비스가 먼저 검사한다(구독 모양·길이).
// 브라우저는 pushPublicKey() 로 받은 공개키로 pushManager.subscribe 한 뒤 그 결과(toJSON)를 subscribePush 에 넘긴다. 푸시를 보내는 쪽은 서버 코드가 push().sendToUser 를 부른다.
import { pushPortMethods } from "@launch-factory/push"
import type { ActionResult, IsoDate } from "@launch-factory/contract"
import { authPort } from "@/lib/launch/auth"
import { push, pushEnabled } from "@/lib/launch/push"

/** 로그인했으면 사용자 id. 로그아웃·만료·대리 로그인 세션은 null(대리 세션이 그 사람 기기를 등록하지 못한다) */
async function userId(): Promise<string | null> {
  try {
    const s = await (await authPort()).session()
    return s.ok && s.data && !s.data.impersonatedBy ? s.data.userId : null
  } catch {
    return null
  }
}

/** 구독에 쓰는 공개키. 기능이 꺼져 있으면 null — 화면은 푸시 단추를 그리지 않는다 */
export async function pushPublicKey(): Promise<string | null> {
  return pushEnabled() ? (await push()).publicKey() : null
}

// 로그인 확인(userId)은 액션이 직접 부른다 — 포트에는 읽은 값만 넘긴다(가드가 이 파일에서 보이도록)
export async function subscribePush(input: unknown): Promise<ActionResult<{ subscribedAt: IsoDate }>> {
  const uid = await userId()
  return pushPortMethods(await push(), () => uid).subscribePush(input as never)
}

export async function unsubscribePush(input: unknown): Promise<ActionResult<Record<string, never>>> {
  const uid = await userId()
  return pushPortMethods(await push(), () => uid).unsubscribePush(input as never)
}
