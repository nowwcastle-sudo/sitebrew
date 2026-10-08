// web-factory 알림(마케팅 수신 동의) 적합성 묶음(notifyConformance)을 NotifyPort 어댑터에 돌리는 실행기. conformance.test.mjs 와 scripts/conformance-all.mjs 가 같이 쓴다.
// 이 어댑터는 Task 18 에서 만들 때 묶음을 돌리지 않았다 — Task 11 이 처음 잇는다.
import { db, user as userTable } from "@launch-factory/db"
import { confirmedNotifyActions, notifyAdapter } from "../src/index.ts"

/** 묶음이 돌려야 하는 검사 수(web-factory v0.0.12 기준 — v0.0.10 의 4개에서 5개로: requireConfirmation 을 켜서 `notify.confirmation.*` 1개(set-consents)가 늘었다) */
export const NOTIFY_PINS = { total: 5, expectedFailures: {} }

/** @param {{ mod: { notifyConformance: Function } }} loaded */
export async function runNotifyConformance(loaded) {
  const d = await db.local()
  try {
    let seq = 0
    // make 는 수신 동의를 한 번도 정하지 않은 새 사람의 포트를 돌려준다
    const make = async () => {
      const id = `notify-${++seq}`
      const at = new Date("2026-09-30T00:00:00.000Z")
      await d.insert(userTable).values({ id, name: "x", email: `${id}@example.com`, emailVerified: true, createdAt: at, updatedAt: at })
      const port = notifyAdapter({ db: d, userId: () => id })
      // LFPIN11: 수신 동의 변경은 서버 입구가 `confirmed: true` 를 요구한다 — 입구를 거친 포트를 묶음에 준다(requireConfirmation)
      return { ...port, ...confirmedNotifyActions(port) }
    }
    const results = await loaded.mod.notifyConformance(make, { timeoutMs: 8_000, requireConfirmation: true })
    return { adapter: "consent/notify", suite: "notifyConformance", results, pins: NOTIFY_PINS }
  } finally {
    await d.$client.close()
  }
}
