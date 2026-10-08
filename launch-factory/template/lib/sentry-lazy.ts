// 브라우저 Sentry 를 「페이지가 열린 뒤」에 받아 오는 장치(LFOBS2 · 운영자 결정 2026-10-05). 이 파일은 첫 번째 JS 에 들어가므로 Sentry 를 정적으로 가져오지 않는다 — 타입만 본다.
//
// 왜: @sentry/nextjs 브라우저 SDK 를 instrumentation-client.ts 가 정적으로 가져오면 모든 쪽의 first-load JS 에 약 83 KB(gzip, +17%)가 얹힌다(docs/qa/lfobs.md §5).
// 어떻게: init 전체를 동적 import() 로 옮기고(lib/sentry-browser.ts — 쓰는 이름만 다시 내보내 번들러가 나머지를 걷어 낸다), `load` 이벤트 뒤 브라우저가 한가할 때 받아 온다. Sentry 공식 문서가 통합을 늦게 받는 권장 방법으로 쓰는 것이 이 동적 import 이다
// (https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/ 「Lazy Loading Integrations > Dynamic Import (recommended)」, 확인 2026-10-05) — 같은 번들러 기능을 SDK 본체에 쓴다.
// 공식 문서가 SDK 본체를 늦게 받는 방법으로 직접 안내하는 것은 로더 스크립트(js.sentry-cdn.com)이고 그쪽은 이른 오류를 스스로 쌓아 둔다. 그 길을 가지 않은 이유는 docs/qa/lfobs2.md §2 에 있다
// (외부 CDN 스크립트라 엄격 CSP script-src 에 외부 출처를 열어야 하고, SDK 구성이 Sentry 대시보드 설정에 따라 바뀌어 개인정보 설정을 코드로 고정할 수 없다).
// 그래서 로더가 해 주는 「이른 오류 쌓기」만 여기서 작게 한다: 받아 오는 동안 난 오류(window error·unhandledrejection)와 오류 화면이 보낸 오류를 최대 LIMIT 개 모아 두었다가 init 뒤에 보낸다.
//
// 포기하는 것: ① `load` 전에 난 오류는 이 쌓기가 잡는 것만 보고된다(브레드크럼·콘솔 기록은 없다). ② 쌓기는 LIMIT 개까지이고 넘치면 버린다. ③ 받아 오기 자체가 실패하면(차단·오프라인) 이 방문의 오류는 보고되지 않는다.

type SentryModule = typeof import("@sentry/nextjs")

/** 늦게 받은 SDK 에서 이 템플릿이 쓰는 것만 */
export type SentryHandle = Pick<SentryModule, "captureException" | "captureRouterTransitionStart" | "getFeedback">

export const EARLY_ERROR_LIMIT = 10

interface Target {
  addEventListener(type: string, listener: (event: any) => void): void // eslint-disable-line @typescript-eslint/no-explicit-any
  removeEventListener(type: string, listener: (event: any) => void): void // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface LazyDeps {
  /** 이른 오류를 듣는 곳(브라우저에서는 window) */
  target: Target
  /** 언제 받아 올지: `run` 을 「load 뒤 한가할 때」 한 번 부른다 */
  schedule: (run: () => void) => void
  /** SDK 를 받아 와 init 하고 손잡이를 준다. 실패하면 던진다 */
  load: () => Promise<SentryHandle>
}

export interface LazyReporter {
  /** 오류를 보낸다. SDK 가 아직이면 쌓아 둔다(LIMIT 개까지) */
  capture(error: unknown): void
  /** SDK 가 받아지면 손잡이, 실패했으면 undefined */
  whenLoaded(): Promise<SentryHandle | undefined>
  /** 받아졌으면 동기로 손잡이 */
  handle(): SentryHandle | undefined
  /** 쌓여 있는 오류 수(시험용) */
  buffered(): number
}

export function createLazyReporter({ target, schedule, load }: LazyDeps): LazyReporter {
  const queue: { error: unknown; mechanism?: { handled: boolean; type: string } }[] = []
  let sdk: SentryHandle | undefined
  let failed = false
  let resolveLoaded!: (value: SentryHandle | undefined) => void
  const loaded = new Promise<SentryHandle | undefined>((resolve) => (resolveLoaded = resolve))

  const push = (error: unknown, mechanism?: { handled: boolean; type: string }) => {
    if (queue.length < EARLY_ERROR_LIMIT) queue.push({ error, mechanism })
  }
  // SDK 의 전역 처리기(GlobalHandlers)가 달았을 표지를 그대로 단다 — 잡히지 않은 오류가 「처리됨」으로 보고되지 않게
  const onError = (event: { error?: unknown; message?: string }) => push(event.error ?? new Error(event.message || "Script error."), { handled: false, type: "auto.browser.global_handlers.onerror" })
  const onRejection = (event: { reason?: unknown }) => push(event.reason, { handled: false, type: "auto.browser.global_handlers.onunhandledrejection" })
  target.addEventListener("error", onError)
  target.addEventListener("unhandledrejection", onRejection)
  const stopListening = () => {
    target.removeEventListener("error", onError)
    target.removeEventListener("unhandledrejection", onRejection)
  }

  schedule(() => {
    load().then(
      (handle) => {
        sdk = handle
        stopListening() // SDK 자신의 전역 처리기가 init 에서 켜졌다 — 이제 같은 오류를 두 번 잡지 않는다
        for (const { error, mechanism } of queue.splice(0)) handle.captureException(error, mechanism ? { mechanism } : undefined)
        resolveLoaded(handle)
      },
      () => {
        failed = true
        stopListening()
        queue.length = 0
        resolveLoaded(undefined)
      },
    )
  })

  return {
    capture(error) {
      if (sdk) sdk.captureException(error)
      else if (!failed) push(error)
    },
    whenLoaded: () => loaded,
    handle: () => sdk,
    buffered: () => queue.length,
  }
}

// 모듈 하나(브라우저에서 한 벌) — instrumentation-client.ts 가 켜고, 오류 화면·신고 단추가 쓴다. 켜지 않았으면(DSN 없음·mock) 모두 아무 일도 하지 않는다.
let current: LazyReporter | undefined

export function setReporter(reporter: LazyReporter | undefined) {
  current = reporter
}

/** 오류 화면(app/error.tsx·global-error.tsx)이 부른다. Sentry 가 꺼져 있으면 아무 일도 하지 않는다 */
export function reportClientError(error: unknown) {
  current?.capture(error)
}

export function sentryLoaded(): Promise<SentryHandle | undefined> {
  return current ? current.whenLoaded() : Promise.resolve(undefined)
}

export function sentryHandle(): SentryHandle | undefined {
  return current?.handle()
}

/** `load` 이벤트가 지난 뒤 브라우저가 한가할 때 한 번 부른다(한가해지지 않아도 AFTER_LOAD_MAX_MS 뒤에는 부른다) */
export const AFTER_LOAD_MAX_MS = 3000
export function afterLoadWhenIdle(run: () => void, win: Window = window): void {
  const idle = () => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(run, { timeout: AFTER_LOAD_MAX_MS })
    else win.setTimeout(run, 1)
  }
  if (win.document.readyState === "complete") idle()
  else win.addEventListener("load", idle, { once: true })
}
