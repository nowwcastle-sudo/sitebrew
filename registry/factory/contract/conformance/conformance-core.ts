// 어댑터 적합성 묶음 공용(registry:lib "contract-conformance" — P3-3 Task 15, 접합면 J3).
// 목 시나리오가 곧 어댑터 적합성 명세다: adapter-mock 과 launch-factory 의 실제 어댑터(Paddle·Better Auth·Resend·PostHog …)가
// 같은 시나리오 표를 받아 같은 검사를 통과해야 한다. 프레임워크 중립 — node:test·vitest 를 부르지 않는다. 검사 함수는 던지지 않고
// { id, ok, message }[] 만 돌려준다. 실행기(러너)는 쓰는 쪽이 고른다: 결과 중 ok 가 false 인 것이 하나라도 있으면 그 어댑터는 맞지 않는다.

/** 검사 하나의 결과. id 는 「포트.무엇.경우」 점 표기로 묶음 안에서 하나뿐이다 */
export interface ConformanceResult {
  id: string
  ok: boolean
  message: string
}

/**
 * 묶음 공통 선택지. timeoutMs 는 검사 하나(포트 호출 여러 번 포함)의 제한 시간 — 끝나지 않는 약속도 실패로 끝낸다.
 *
 * requireConfirmation(P3-7 AXC — 규칙 G11(d), launch-factory LFAX R20): 어댑터가 **승인 행동의 확인 입력을 요구한다**고 선언한다. 켜면 ① 새 검사 `*.confirmation.*` 가 돈다 —
 * 확인 입력(`confirmed: true`) 없이 부른 승인 행동은 `{ ok: false, code: "confirmation_required", retryable: false }` 이고 구독·계정·동의 상태는 그대로이며,
 * 확인과 함께 부르면 성공한다 ② 기존 검사가 부르는 승인 행동은 `confirmed: true` 를 자동으로 싣는다(`autoConfirmed`) — 확인을 요구하는 어댑터가 옛 검사에서 거짓으로 떨어지지 않는다.
 * 끄면(기본) 옛 묶음과 똑같다 — 확인을 요구하지 않는 어댑터도 계약을 지킨다(선택 칸이다). 켠 어댑터만 이 검사를 받는다.
 */
export interface ConformanceOptions {
  timeoutMs?: number
  requireConfirmation?: boolean
}

/** 확인 입력(`confirmed: true`)을 받는 승인 행동의 포트 메서드(contract/human-actions 표의 포트 메서드 중 확인 칸이 있는 것) */
export const CONFIRMED_METHODS = {
  billing: ["changePlan", "cancel", "applyRetentionOffer", "acceptPriceChange"],
  auth: ["changeEmail", "deleteAccount", "exportMyData"],
  notify: ["setConsents"],
} as const

/** 포트의 승인 행동 메서드가 늘 `confirmed: true` 를 싣고 불리게 감싼 사본(없는 메서드는 그대로 둔다). 기존 검사가 확인을 요구하는 어댑터에서도 의미를 지키게 한다 */
export function autoConfirmed<P extends object>(port: P, methods: readonly string[]): P {
  const out = { ...port } as Record<string, unknown>
  for (const m of methods) {
    const fn = (port as Record<string, unknown>)[m]
    if (typeof fn === "function") out[m] = (input?: object) => (fn as (i: object) => unknown).call(port, { ...(input ?? {}), confirmed: true })
  }
  return out as P
}

/** 확인 없이 부른 승인 행동의 결과 모양 검사 — 문제 없으면 null. 승인 대기는 실패로 끝나되 code 가 confirmation_required 이고 retryable 이 false 다(오류가 아니라 정해진 결과) */
export function confirmationProblem(r: { ok: boolean; code?: unknown; retryable?: unknown }): string | null {
  if (r.ok) return "확인 입력 없이 부른 승인 행동이 성공했어요"
  if (r.code !== "confirmation_required") return `확인 없이 부르면 code: "confirmation_required" 여야 해요: ${show(r)}`
  return r.retryable === false ? null : `승인 대기는 retryable: false 여야 해요: ${show(r)}`
}

export const DEFAULT_TIMEOUT_MS = 10_000

export const result = (id: string, ok: boolean, message: string): ConformanceResult => ({ id, ok, message: ok ? "ok" : message })

/** 실패한 결과만 */
export const failures = (results: readonly ConformanceResult[]): ConformanceResult[] => results.filter((r) => !r.ok)

/**
 * 검사 하나를 돌린다. 본문이 던지거나 거부하거나 제한 시간을 넘기면 그 id 의 실패 결과가 된다 — 묶음은 끝까지 돈다.
 * 본문은 조건이 여럿이면 첫 실패 문구를 돌려주고, 모두 맞으면 null 을 돌려준다.
 */
export async function runCheck(id: string, body: () => Promise<string | null>, { timeoutMs = DEFAULT_TIMEOUT_MS }: ConformanceOptions = {}): Promise<ConformanceResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(`${timeoutMs}ms 안에 끝나지 않았어요`), timeoutMs)
  })
  try {
    const problem = await Promise.race([body(), timeout])
    return result(id, problem === null, problem ?? "")
  } catch (e) {
    return result(id, false, `던짐: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** JSON 모양 값의 깊은 같음(키 순서 무관, undefined 칸은 없는 것으로 본다) */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = (o: object) => Object.keys(o).filter((k) => (o as Record<string, unknown>)[k] !== undefined).sort()
  const ka = keys(a), kb = keys(b)
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

export const show = (v: unknown): string => {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}
