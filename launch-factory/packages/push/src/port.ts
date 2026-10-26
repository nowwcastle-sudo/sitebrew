// NotifyPort 에 얹는 두 메서드(subscribePush·unsubscribePush). 로그인한 사용자 기준이다(D6) — 로그인 안 했으면 서비스를 부르지 않는다.
import type { ActionResult, IsoDate, NotifyPort } from "@launch-factory/contract"
import { pushMessages, type PushLocale } from "./messages.ts"
import type { PushService } from "./index.ts"

/** 지금 로그인한 사용자 id 또는 그것을 돌려주는 함수(요청마다 세션에서 읽는다) */
export type UserIdSource = string | null | undefined | (() => string | null | undefined | Promise<string | null | undefined>)

export type PushPortMethods = Required<Pick<NotifyPort, "subscribePush" | "unsubscribePush">>

export function pushPortMethods(service: PushService, who: UserIdSource, opts: { locale?: PushLocale } = {}): PushPortMethods {
  const locale = opts.locale
  const current = async (): Promise<string | null> => {
    const id = typeof who === "function" ? await who() : who
    return typeof id === "string" && id.length > 0 ? id : null
  }
  const signInRequired = (): { ok: false; code: "signInRequired"; retryable: false; formError: string } => ({
    ok: false,
    code: "signInRequired",
    retryable: false,
    formError: pushMessages(locale).signInRequired,
  })
  return {
    async subscribePush(input): Promise<ActionResult<{ subscribedAt: IsoDate }>> {
      const userId = await current()
      if (!userId) return signInRequired()
      return service.subscribe(userId, input, { locale })
    },
    async unsubscribePush(input): Promise<ActionResult<Record<string, never>>> {
      const userId = await current()
      if (!userId) return signInRequired()
      const result = await service.unsubscribe(userId, (input as { endpoint?: unknown } | null | undefined)?.endpoint, { locale })
      return result.ok ? { ok: true, data: {} } : result
    },
  }
}
