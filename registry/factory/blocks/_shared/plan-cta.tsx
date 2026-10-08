import type { Cta } from "@/registry/factory/content/content-core"

// 요금제 행동 버튼이 가는 곳(P3-6 WFBLK-A — UX 감사 E01·E03, factory-rules.md §23-3 U9). pricing 세 블록이 같이 쓴다.
//   · 로그아웃(기본·옛 동작): 요금제별 행동(planCtas[i] ?? cta)이 가는 곳 — 가입. 요금제 id(planIds)를 주면 가입 주소에 ?plan=<id> 를 싣는다(가입 뒤 같은 요금제로 이어진다).
//   · 로그인(signedIn): 가입이 아니라 결제 — 「/upgrade?plan=<id>」(signedInHref 틀의 {plan} 자리). 고른 요금제 id 가 주소에 실린다.
//   · 이미 쓰는 요금제(currentPlanId): 눌러서 갈 곳이 없다 — 「지금 쓰는 요금제」 표지(current)로 바뀐다.
//   · 문의형(금액 null)·무료(금액 0) 요금제는 로그인해도 결제로 보내지 않는다(결제할 것이 없다) — 원래 행동 그대로.
// 함수가 아니라 값만 받는다(서버 컴포넌트가 클라이언트 블록에 넘길 수 있게 — 직렬화).
export type PlanCtaCopy = {
  // 요금제 id(BillingPort Plan.id) — plans 와 같은 순서. 없으면 옛 동작(주소에 요금제를 싣지 않는다)
  planIds?: string[]
  // 로그인했을 때 요금제별 행동(순서대로, 선택) — 글·주소를 통째로 바꾼다. 없으면 planCtas[i] ?? cta 의 글 + signedInHref 틀
  signedInCtas?: Cta[]
  // 로그인했을 때 결제로 가는 주소 틀 — {plan} 에 요금제 id, {interval} 에 month·year(월·연 전환이 있는 블록만 알려 준다). 기본 "/upgrade?plan={plan}"
  signedInHref?: string
  // 이미 쓰는 요금제 표지 글(currentPlanId 와 맞는 요금제) — 기본은 행동 글 그대로(링크가 아니라 표지로만 바뀐다)
  currentLabel?: string
}
export type PlanCtaState = {
  signedIn?: boolean
  // 지금 쓰는 요금제 id(로그인한 사람의 구독 planId)
  currentPlanId?: string | null
}
export type PlanCtaTarget = { label: string; href: string; current: boolean }
// 월·연 전환이 있는 블록이 지금 보는 주기를 알린다. 연 요금제가 따로 id 를 가지면(annualPlanIds) 그 id 를 planId 로 주고 interval 은 필요 없다
export type PlanCtaInterval = "month" | "year"

export const DEFAULT_SIGNED_IN_HREF = "/upgrade?plan={plan}"

/** 주소에 쿼리 하나를 붙인다 — 같은 출처 경로(/…)만 건드리고, 이미 있으면 그대로, #해시·바깥 주소는 그대로 둔다 */
export function withQuery(href: string, key: string, value: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href
  const hash = href.indexOf("#")
  const path = hash >= 0 ? href.slice(0, hash) : href
  const tail = hash >= 0 ? href.slice(hash) : ""
  if (new RegExp(`[?&]${key}=`).test(path)) return href
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}${tail}`
}

/**
 * i 번째 요금제의 행동. base 는 요금제별 행동(planCtas[i] ?? cta). planId 는 이 요금제의 id(없을 수 있다),
 * price 는 화면 금액(null 문의형 · 0 무료 — 로그인해도 결제로 보내지 않는다).
 */
export function resolvePlanCta(copy: PlanCtaCopy, state: PlanCtaState, i: number, base: Cta, price: number | null, planId: string | undefined = copy.planIds?.[i], interval?: PlanCtaInterval): PlanCtaTarget {
  const keep: PlanCtaTarget = { label: base.label, href: base.href, current: false }
  if (planId === undefined) return keep
  if (state.currentPlanId && state.currentPlanId === planId) return { label: copy.currentLabel ?? base.label, href: base.href, current: true }
  if (state.signedIn) {
    // 문의형(금액 null)·무료(0)는 결제할 것이 없다 — 원래 행동 그대로
    if (price === null || price <= 0) return keep
    const given = copy.signedInCtas?.[i]
    if (given) return { label: given.label, href: given.href, current: false }
    const href = (copy.signedInHref ?? DEFAULT_SIGNED_IN_HREF).replace("{plan}", encodeURIComponent(planId)).replace("{interval}", interval ?? "month")
    return { label: base.label, href, current: false }
  }
  // 문의형(금액 null)은 가입 주소에 요금제를 싣지 않는다 — 문의 쪽이 ?plan= 을 읽지 않는다
  if (price === null) return keep
  const planned = withQuery(base.href, "plan", planId)
  return { label: base.label, href: interval === "year" ? withQuery(planned, "interval", "year") : planned, current: false }
}
