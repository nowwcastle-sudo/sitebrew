// 로그인 뒤 시작 쪽의 상태 한 줄과 다음 행동(H05) — 판단만 한다(순수 함수). 글은 content/copy.shell.en.ts 의 homeCopy.
// 구독을 못 읽었으면(null) 상태를 지어내지 않는다: 줄도 행동도 없다. 「Upgrade」 행동은 유료 요금제를 쓰지 않을 때(none·expired)만 나온다.
import type { Subscription } from "../components/contract/ports.ts"
import { homeCopy as c } from "../content/copy.shell.en.ts"

export interface HomeStatus {
  text: string | null
  action: { label: string; href: string } | null
}

/** @param date ISO 날짜 문자열 → 화면에 적을 날짜(사용자 시간대는 부르는 쪽이 정한다) */
export function homeStatus(sub: Subscription | null, planName: string | undefined, date: (iso: string) => string): HomeStatus {
  if (!sub) return { text: null, action: null }
  const plan = planName || "current"
  const line = (withDate: string, noDate: string, iso: string | undefined) => (iso ? withDate.replace("{date}", date(iso)) : noDate).replace("{plan}", plan)
  switch (sub.status) {
    case "none":
      return { text: c.free, action: c.actions.upgrade }
    case "expired":
      return { text: c.expired, action: c.actions.upgrade }
    case "past_due":
      return { text: c.pastDue, action: c.actions.fixPayment }
    case "trialing":
      return { text: line(c.trial, c.trialNoDate, sub.trialEnd), action: c.actions.manage }
    case "canceled":
      return { text: line(c.canceled, c.canceledNoDate, sub.cancelAt ?? sub.currentPeriodEnd), action: c.actions.keep }
    case "paused":
      return { text: line(c.paused, c.pausedNoDate, sub.pausedUntil), action: c.actions.manage }
    default:
      return { text: line(c.active, c.activeNoDate, sub.currentPeriodEnd), action: c.actions.manage }
  }
}
