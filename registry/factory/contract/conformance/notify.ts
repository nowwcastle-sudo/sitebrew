// 알림(마케팅 수신 동의) 포트 적합성 묶음(항목 contract-conformance — P3-3 Task 15, J3). 목은 mockNotify("")(?consent= 없음)다.
// 선택 동의는 기본 false 이고 미리 체크해 두지 않는다(전자상거래법 §21-2①2·정보통신망법 §50). 바꾸면 준 채널만 바뀌고 updatedAt 이 남는다.
import type { NotifyPort } from "@/registry/factory/contract/ports"
import { CONFIRMED_METHODS, type ConformanceOptions, type ConformanceResult, autoConfirmed, confirmationProblem, deepEqual, runCheck, show } from "./conformance-core"

export const NOTIFY_CHANNELS = ["email", "sms", "kakao", "push"] as const
/** make 는 이 사람의 수신 동의를 한 번도 정하지 않은 새 포트를 돌려준다 */
export type MakeNotify = () => NotifyPort | Promise<NotifyPort>

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))

export async function notifyConformance(makeNotify: MakeNotify, options: ConformanceOptions = {}): Promise<ConformanceResult[]> {
  const out: ConformanceResult[] = []
  const check = async (id: string, body: () => Promise<string | null>) => out.push(await runCheck(id, body, options))
  // 확인을 요구하는 어댑터(options.requireConfirmation)는 옛 검사의 승인 행동 호출에 `confirmed: true` 를 자동으로 싣는다. raw 는 확인 검사가 쓰는 감싸지 않은 포트다
  const raw = makeNotify
  const make: MakeNotify = options.requireConfirmation ? async () => autoConfirmed(await raw(), CONFIRMED_METHODS.notify) : raw
  const read = async (port: NotifyPort) => {
    const r = await port.consents()
    if (!r.ok) throw new Error(`consents() 실패: ${show(r)}`)
    return r.data
  }

  await check("notify.consents.channels", async () => {
    const c = await read(await make())
    const bad = NOTIFY_CHANNELS.filter((k) => typeof c[k] !== "boolean")
    return bad.length ? `참/거짓이 아닌 채널: ${bad.join(", ")}` : null
  })
  await check("notify.consents.default-false", async () => {
    const c = await read(await make())
    const on = NOTIFY_CHANNELS.filter((k) => c[k] !== false)
    return on.length ? `정하기 전인데 켜진 채널(사전 선택): ${on.join(", ")}` : null
  })
  // 준 채널만 바뀐다 — 나머지는 바꾸기 전 값 그대로
  await check("notify.set-consents.partial", async () => {
    const port = await make()
    const before = await read(port)
    const r = await port.setConsents({ email: true })
    if (!r.ok) return `setConsents 실패: ${show(r)}`
    if (!isDate(r.data.updatedAt)) return `updatedAt 이 날짜가 아니에요: ${show(r.data)}`
    const after = await read(port)
    if (after.email !== true) return "email 을 켰는데 꺼져 있어요"
    const moved = NOTIFY_CHANNELS.filter((k) => k !== "email" && after[k] !== before[k])
    if (moved.length) return `주지 않은 채널이 바뀌었어요: ${moved.join(", ")}`
    return isDate(after.updatedAt) ? null : "consents() 에 updatedAt 이 없어요"
  })
  await check("notify.set-consents.withdraw", async () => {
    const port = await make()
    for (const on of [true, false]) {
      const r = await port.setConsents({ email: on, sms: on })
      if (!r.ok) return `setConsents 실패: ${show(r)}`
    }
    const after = await read(port)
    return after.email === false && after.sms === false ? null : `철회했는데 켜져 있어요: ${show(after)}`
  })

  // 승인 행동의 확인 입력(G11(d), P3-7 AXC — options.requireConfirmation 인 어댑터만): 동의·철회 모두 사람이 확인한 뒤에만 이력이 남는다.
  // ① 확인 없이 부르면 confirmation_required(retryable false)이고 동의 상태가 그대로 ② 확인과 함께 부르면 성공하고 바뀐다
  if (options.requireConfirmation) {
    await check("notify.confirmation.set-consents", async () => {
      const port = await raw()
      const before = await read(port)
      const refused = await port.setConsents({ email: true })
      const problem = confirmationProblem(refused)
      if (problem) return problem
      const unchanged = await read(port)
      if (!deepEqual(before, unchanged)) return `승인 대기인데 동의 상태가 바뀌었어요: ${show(before)} → ${show(unchanged)}`
      const done = await port.setConsents({ email: true, confirmed: true })
      if (!done.ok) return `확인과 함께 부르면 성공해야 해요: ${show(done)}`
      return (await read(port)).email === true ? null : "확인과 함께 불렀는데 email 이 켜지지 않았어요"
    })
  }
  return out
}
