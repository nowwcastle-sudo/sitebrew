// 블록 갤러리 상태 주입(P3-2 Task 1c — 리뷰 I-6). 순수 함수라 보기(클라이언트)와 node 검사(blocks-states.test.mjs, 정적 렌더)가 같이 부른다.
// 메타 states → 쿼리 이름은 factory/scripts/block-states.mjs STATE_QUERY 한 표다(blocks.mjs 가 다시 내보내고 Task 7 job 빌더도 부른다).
//   · 메타가 적은 쪽(읽기 &state= · 제출 &submit=)만 주입한다 — 폼만 있는 블록에 ?state=ready 가 와도 데이터를 찾지 않는다.
//   · 재료는 예시 모듈의 fixtureStates(adapter-mock FixtureStates<블록 props>)에서: data(없으면 예시 props 의 ready 상태 data)·receipt·문구·retry.
//   · 폼 블록에 receipt 가 없으면 DEFAULT_RECEIPT 로 &submit=ok(쿼리가 없을 때의 기본)도 돈다.
// 읽기 상태 지연·기본 retry(P3-2 레인 C 0 — 레인 B 걱정 1: loading → ready 와 [다시 시도] 호출을 갤러리에서 잰다):
//   · &delay=<ms> 는 제출뿐 아니라 읽기 상태에도 간다 — &state=ready&delay=800 이면 loading 으로 그리고 800ms 뒤 요청 상태로 바꾼다.
//   · 오류 상태의 retry 를 예시가 주지 않으면 갤러리가 준다 — window.__wfRetried 를 1 올리고 ready 로 다시 그린다.
//   · 제출 포트는 불릴 때마다 window.__wfSubmitted 를 1 올린다(Task 14c — 보내는 중 두 번 보내기 막기를 잰다).
//   상태를 바꾸는 일은 주소를 바꾸는 것으로 한다: 보기는 page.tsx 가 넘기는 쿼리가 바뀌면 다시 주입한다. 주소는 앱 라우터의 replace 로
//   새로 고침 없이 바꾼다(window.next.router — Next 앱 라우터가 싣는 공개 인스턴스, 없으면 location.replace). 새로 고침이 없으니
//   window.__wfRetried 가 남고, 블록은 같은 자리에서 다시 그려진다(loading → ready 레이아웃 이동을 잴 수 있다).
import { stateFromQuery, MAX_DELAY_MS, type FixtureStates } from "@/registry/factory/contract/adapter-mock"
import { withAttribution } from "@/registry/factory/contract/attribution"
import type { AnalyticsPort, Attribution } from "@/registry/factory/contract/ports"
import { STATE_QUERY } from "@/factory/scripts/block-states.mjs"

export const DEFAULT_RECEIPT = { id: "EX-0001", message: "접수했습니다(예시)." }

type StateQuery = { key: string; value: string }
const TABLE = STATE_QUERY as Record<string, StateQuery | undefined>

export type BlockProps = Record<string, unknown> & { state?: { status?: string; data?: unknown } }

// 메타 상태 하나 → 갤러리 주소의 쿼리 조각("state=loading"). 모르는 값이면 null.
export const stateParam = (state: string) => {
  const q = TABLE[state]
  return q ? `${q.key}=${q.value}` : null
}

// 어느 블록의 FixtureStates<P> 든 받는 모양(data·receipt 는 블록마다 타입이 다르다).
export type AnyFixtureStates = Omit<FixtureStates<unknown>, "data" | "receipt"> & { data?: unknown; receipt?: unknown }

/** 상태를 바꾸는 부수 효과 셋. 기본은 브라우저(아래 browserEnv), 검사는 가짜를 넘겨 무엇을 했는지 본다. */
export type StatesEnv = {
  // ms 뒤 fn — 그 사이 주소가 바뀌었으면(다른 블록·상태로 옮겼으면) 부르지 않는다
  schedule: (fn: () => void, ms: number) => void
  // 지금 주소의 쿼리를 고쳐 새로 고침 없이 옮긴다
  go: (mutate: (q: URLSearchParams) => void) => void
  // 기본 retry 가 불린 횟수를 센다(window.__wfRetried)
  count: () => void
  // 제출 포트가 불린 횟수를 센다(window.__wfSubmitted — Task 14c: 보내는 중 두 번 보내기 막기를 갤러리에서 잰다)
  submitted: () => void
}

type Win = Window & { __wfRetried?: number; __wfSubmitted?: number; next?: { router?: { replace: (href: string, o?: { scroll?: boolean }) => void } } }
const browserEnv: StatesEnv = {
  schedule(fn, ms) {
    if (typeof window === "undefined") return
    const at = window.location.href
    window.setTimeout(() => {
      if (window.location.href === at) fn()
    }, ms)
  },
  go(mutate) {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    mutate(url.searchParams)
    const router = (window as Win).next?.router
    if (router?.replace) router.replace(`${url.pathname}${url.search}`, { scroll: false })
    else window.location.replace(url.href)
  },
  count() {
    if (typeof window === "undefined") return
    const w = window as Win
    w.__wfRetried = (w.__wfRetried ?? 0) + 1
  },
  submitted() {
    if (typeof window === "undefined") return
    const w = window as Win
    w.__wfSubmitted = (w.__wfSubmitted ?? 0) + 1
  },
}

// ── 포트 목 주입(P3-2 레인 D1) ─────────────────────────────────────────────────────────────────────────────
// 포트를 받는 블록(auth·account·paywall·retention·consent)은 예시 모듈이 fixturePorts(쿼리, { fx, onTrack })를 낸다 — adapter-mock 의
// mockBilling·mockAuth·mockNotify·mockAnalytics 를 그 쿼리로 만들어 블록이 받는 메서드만 props 로 돌려준다.
// 쿼리: 포트 처음 상태 ?sub=(구독 7상태 + pending-price-change) · ?auth= · ?consent= · 판매 목 ?cart=empty|filled · ?order=<주문 상태> · ?stock=out, 읽기·쓰기 결과 ?state=·?submit=·&delay=(목이 직접 읽는다).
// 이 블록들은 withStates 를 거치지 않는다 — 메타 states 는 포트 목이 같은 쿼리로 그린다(state 는 읽기 메서드, submit 은 쓰기 메서드).
export const PORT_QUERY_KEYS = ["sub", "auth", "consent", "state", "submit", "delay", "retryAfter", "unsupported", "last", "initialWait", "channels", "cart", "order", "stock"] as const
// attribution: 출처 태그(P3-2 Task 10c 계약 판 2 · 대장 A16) — 갤러리가 withPorts 에서 track 을 withAttribution 으로 감싸면 목이 기록에 싣는다.
export type TrackedCall = { name: string; props: unknown; attribution?: Attribution }
export type FixturePorts = (q: URLSearchParams, gallery: { fx: string; onTrack: (e: TrackedCall) => void }) => Record<string, unknown>

type TrackWin = Window & { __wfTracked?: TrackedCall[] }
// 기본 계측 기록: 동의가 있을 때 목이 남긴 호출을 window.__wfTracked 에 쌓는다(갤러리에서 track 호출을 본다).
const browserTrack = (e: TrackedCall) => {
  if (typeof window === "undefined") return
  const w = window as TrackWin
  ;(w.__wfTracked ??= []).push(e)
}

// attribution(대장 A16): 조립하는 쪽(갤러리)이 블록·레시피 태그를 준다 — 예시가 낸 track 을 withAttribution 으로 한 번 감싼다(블록은 태그를 모른다).
// 감싼 포트의 consent·setConsent 는 쓰이지 않는다 — 동의는 목의 원래 track 이 본다. consent 블록은 목의 consent·setConsent 를 그대로 받는다.
export function withPorts(
  base: BlockProps,
  fixturePorts: FixturePorts,
  search: string,
  { fx = "default", onTrack = browserTrack, attribution }: { fx?: string; onTrack?: (e: TrackedCall) => void; attribution?: Attribution } = {},
): BlockProps {
  const q = new URLSearchParams(search)
  const own = new URLSearchParams()
  for (const k of PORT_QUERY_KEYS) {
    const v = q.get(k)
    if (v !== null) own.set(k, v)
  }
  const ports = fixturePorts(own, { fx, onTrack })
  // 포트 쓰기·읽기 호출 기록(P3-2 Task 10d): 블록이 무엇을 실어 불렀는지 window.__wfCalls 에서 본다(예: checkout 의 withdrawalConsent · signIn 의 rememberMe · signUp 의 ageOver14).
  // 계측·동의 메서드는 track 이 따로 기록하니 건드리지 않는다. 입력은 얕게 복사해 기록한다(갤러리 예시 값뿐이다).
  if (typeof window !== "undefined")
    for (const [k, v] of Object.entries(ports))
      if (typeof v === "function" && !["track", "consent", "setConsent", "identify"].includes(k))
        ports[k] = (...args: unknown[]) => {
          const w = window as Window & { __wfCalls?: { name: string; input: unknown }[] }
          ;(w.__wfCalls ??= []).push({ name: k, input: typeof args[0] === "object" && args[0] ? structuredClone(args[0]) : args[0] })
          return (v as (...a: unknown[]) => unknown)(...args)
        }
  if (attribution && typeof ports.track === "function")
    ports.track = withAttribution({ track: ports.track as AnalyticsPort["track"], consent: () => ({ analytics: true, marketing: false }), setConsent: () => {} }, attribution).track
  return { ...base, ...ports }
}

export function withStates(states: readonly string[], base: BlockProps, fx: AnyFixtureStates | undefined, search: string, env: Partial<StatesEnv> = {}): BlockProps {
  const keys = new Set(states.map((s) => TABLE[s]?.key).filter((k): k is string => !!k))
  if (!keys.size) return base
  const { schedule, go, count, submitted } = { ...browserEnv, ...env }
  const q = new URLSearchParams(search)
  const own = new URLSearchParams()
  for (const k of keys) {
    const v = q.get(k)
    if (v !== null) own.set(k, v)
  }
  // 지연은 제출과 읽기 모두에 간다(값 검사·자르기는 stateFromQuery 가 한다 — 틀린 값이면 거기서 멈춘다)
  const delay = q.get("delay")
  if (delay !== null) own.set("delay", delay)
  const retryAfter = q.get("retryAfter")
  if (retryAfter !== null) own.set("retryAfter", retryAfter)
  const f = fx ?? {}
  const data = f.data !== undefined ? f.data : base.state?.status === "ready" ? base.state.data : undefined
  // 읽기 지연: 요청 상태(없으면 데이터가 있을 때 ready)가 loading 이 아니면 loading 으로 그리고 ms 뒤 지연을 뗀 주소로 옮긴다
  const readDelay = keys.has("state") && delay !== null ? Math.min(MAX_DELAY_MS, Math.max(0, Number(delay))) : 0
  const wanted = own.get("state") ?? (data !== undefined ? "ready" : "empty")
  if (readDelay > 0 && wanted !== "loading") {
    own.set("state", "loading")
    schedule(
      () =>
        go((u) => {
          u.set("state", wanted)
          u.delete("delay")
        }),
      readDelay,
    )
  }
  // 기본 retry: 세고, 데이터가 있으면 ready 로 다시 그린다(없으면 ready 를 그릴 수 없으니 세기만)
  const retry =
    f.retry ??
    (() => {
      count()
      if (data !== undefined)
        go((u) => {
          u.set("state", "ready")
          u.delete("delay")
        })
    })
  const { state, submit } = stateFromQuery(own, {
    data,
    receipt: f.receipt ?? DEFAULT_RECEIPT,
    reason: f.reason,
    message: f.message,
    retry,
    fieldErrors: f.fieldErrors,
    formError: f.formError,
  })
  // 제출은 부를 때마다 센다(window.__wfSubmitted) — 블록이 보내는 중에 두 번 보내지 않는지 갤러리에서 잰다.
  const countedSubmit: typeof submit = () => {
    submitted()
    return submit()
  }
  return { ...base, ...(keys.has("state") ? { state } : {}), ...(keys.has("submit") ? { submit: countedSubmit } : {}) }
}
