"use server"
// 계정 화면의 mock 입구(LFACCT). LF_MODE=mock(키 없이 켠 화면)에서는 로그인이 목 인증 포트의 메모리 세션이라, 실 서버 액션(app/actions/auth.ts 등 — Better Auth 세션을 읽는다)이
// 이 세션을 알아보지 못한다. 그래서 계정 화면(components/product/account-blocks.tsx)은 mock 일 때 이 한 입구로 목 포트를 부른다. live 에서는 아무것도 하지 않는다(실 액션을 쓴다).
// 이름 목록에 없는 메서드는 받지 않는다. 입력 모양은 목이 검사한다(목은 어떤 값이든 타입 없이 받는다).
// LFAX(M03): live 와 같게 사람 승인 행동(이메일 바꾸기·탈퇴·내려받기·수신 동의 변경)은 `confirmed: true` 없이는 목 포트도 부르지 않는다.
// 탈퇴는 화면이 받는 이메일 주소 입력(`confirmEmail`)도 같이 본다. 결과는 모두 code·retryable 을 갖는다(M04).
import { confirmEmailMismatchResult, confirmEmailOk, machineResult, requireConfirmation } from "@launch-factory/security/action"
import type { ActionResult } from "@/components/contract/block-contract"
import { DEFAULT_LOCALE } from "@/lib/launch/config"
import { mockAccountPorts, productMode } from "@/lib/ports"

export type MockAccountMethod =
  | "changeEmail"
  | "changePassword"
  | "listSessions"
  | "revokeSession"
  | "revokeOtherSessions"
  | "deleteAccount"
  | "exportMyData"
  | "consents"
  | "setConsents"
  | "history"
  | "updateProfile"

const unavailable = (): ActionResult<never> => ({ ok: false, formError: "This is only available when the app runs in mock mode." })

/** 목 동의 이력(시험용 견본). 가입 때 세 건 + 설정에서 바꾼 것은 목 알림 포트가 기억하므로 이 표에는 싣지 않는다 */
const MOCK_HISTORY = [
  { kind: "terms", granted: true, version: "2026-09-30", source: "sign_up", locale: "en", at: "2026-10-01T00:00:00.000Z" },
  { kind: "privacy", granted: true, version: "2026-09-30", source: "sign_up", locale: "en", at: "2026-10-01T00:00:00.000Z" },
  { kind: "age_over_14", granted: true, version: null, source: "sign_up", locale: "en", at: "2026-10-01T00:00:00.000Z" },
]

export async function mockAccount(method: MockAccountMethod, input?: unknown): Promise<ActionResult<unknown>> {
  return machineResult(await run(method, input), DEFAULT_LOCALE)
}

async function run(method: MockAccountMethod, input?: unknown): Promise<ActionResult<unknown>> {
  if (productMode() !== "mock") return unavailable()
  const { auth, notify, setName } = await mockAccountPorts()
  // live 의 서버 액션은 로그인한 본인에게만 닿는다 — 목도 같게 한다(목 알림·이력은 원래 로그인을 묻지 않는다)
  const me = await auth.session()
  if (!me.ok || !me.data) return { ok: false, formError: "Sign in to continue." }
  switch (method) {
    case "changeEmail": {
      const c = requireConfirmation<Parameters<typeof auth.changeEmail>[0]>(input, DEFAULT_LOCALE)
      return c.ok ? auth.changeEmail(c.rest) : c.failure
    }
    case "changePassword":
      return auth.changePassword(input as Parameters<typeof auth.changePassword>[0])
    case "listSessions":
      return auth.listSessions()
    case "revokeSession":
      return auth.revokeSession(input as Parameters<typeof auth.revokeSession>[0])
    case "revokeOtherSessions":
      return auth.revokeOtherSessions()
    case "deleteAccount": {
      const c = requireConfirmation(input, DEFAULT_LOCALE)
      if (!c.ok) return c.failure
      if (!confirmEmailOk(c.confirmEmail, me.data.email)) return confirmEmailMismatchResult(DEFAULT_LOCALE)
      // live 는 서버가 세션을 모두 끊는다(탈퇴 요청 기록과 같은 트랜잭션) — 목도 같게 로그아웃시킨다
      const r = await auth.deleteAccount()
      if (r.ok) await auth.signOut()
      return r
    }
    case "exportMyData": {
      const c = requireConfirmation(input, DEFAULT_LOCALE)
      return c.ok ? auth.exportMyData() : c.failure
    }
    case "consents":
      return notify.consents()
    case "setConsents": {
      const c = requireConfirmation<Parameters<typeof notify.setConsents>[0]>(input, DEFAULT_LOCALE)
      return c.ok ? notify.setConsents(c.rest) : c.failure
    }
    case "history":
      return { ok: true, data: MOCK_HISTORY }
    case "updateProfile": {
      const name = typeof (input as { name?: unknown } | undefined)?.name === "string" ? (input as { name: string }).name.trim() : ""
      return name.length <= 80 ? { ok: true, data: { name: setName(name) } } : { ok: false, formError: "Check the highlighted field.", fieldErrors: { name: ["Use 80 characters or fewer."] } }
    }
  }
}
