// LFOBS: 분석(PostHog)·오류 수집(Sentry)은 선택이다 — 없으면 그 기능만 꺼지고 사이트는 켜진다(운영자 결정 2026-10-05).
// 사고: live 에서 POSTHOG_HOST 가 없으면 app/layout.tsx 가 "cannot determine the PostHog region" 으로 던져 모든 쪽이 500 이었고, 켜질 때 검사도 이를 못 잡았다(docs/qa/lfenv.md §3).
// 이 시험은 단위로 지킨다: 환경 검사(live-env) · 켜짐 판정(lib/observability) · 진짜 Sentry 서버 SDK(가짜 전송)로 오류가 보고서에 닿고 개인정보가 가려지는지.
// 화면·헤더(동의 띠 없음·CSP·표지)는 template/test/verify.heavy.mjs 의 live 서버 시험과 docs/qa/lfobs.md 의 실측이 본다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { EnvError } from "@launch-factory/env"
import * as SentryModule from "@sentry/nextjs"
import { templateEnv } from "../lib/live-env.ts"
import { analyticsEnabled, analyticsOff, sentryCsp, sentryDsn, sentryInitOptions, startSentry } from "../lib/observability.ts"
import { AFTER_LOAD_MAX_MS, EARLY_ERROR_LIMIT, afterLoadWhenIdle, createLazyReporter, reportClientError, setReporter, sentryLoaded } from "../lib/sentry-lazy.ts"

// node 는 이 패키지의 서버 빌드(CJS)를 불러온다 — 이름 있는 내보내기가 일부만 보여 default 를 쓴다(번들러는 이 문제가 없다)
const Sentry = SentryModule.default ?? SentryModule
const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

/** 형식만 맞춘 가짜 live 환경(비밀 아님) — POSTHOG_HOST·POSTHOG_PROJECT_KEY·SENTRY_DSN·INQUIRY_OWNER_EMAIL 은 일부러 뺐다 */
const LIVE = {
  LF_MODE: "live",
  DATABASE_URL: "postgres://u:p@h/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  PADDLE_API_KEY: "k",
  PADDLE_WEBHOOK_SECRET: "k",
  RESEND_API_KEY: "k",
  TURNSTILE_SECRET_KEY: "k",
  EMAIL_FROM: "Name <hello@example.test>",
  NEXT_PUBLIC_APP_URL: "https://preview.example.test",
  CRON_SECRET: "c".repeat(16),
  SUBJECT_REF_KEY: "s".repeat(32),
  TURNSTILE_SITE_KEY: "site",
}
const DSN = "https://abc123@o9.ingest.sentry.io/456"

test("환경 검사: live 에서 POSTHOG_HOST·SENTRY_DSN 이 없어도 켜진다(재현: 예전엔 SENTRY_DSN 이 필수였고 POSTHOG_HOST 가 없으면 모든 쪽이 500)", () => {
  assert.doesNotThrow(() => templateEnv(LIVE))
  // 필수 이름이 빠지면 여전히 멈춘다(이 변경이 다른 보호를 풀지 않았다)
  assert.throws(() => templateEnv({ ...LIVE, CRON_SECRET: undefined }), (e) => e instanceof EnvError && e.missing.length === 1 && e.missing[0] === "CRON_SECRET")
  // 빈 문자열은 없는 값이다
  assert.doesNotThrow(() => templateEnv({ ...LIVE, POSTHOG_HOST: "", POSTHOG_PROJECT_KEY: "", SENTRY_DSN: "" }))
  // LFOBS2: POSTHOG_PROJECT_KEY 도 선택이다 — LIVE 에는 이 이름이 없다(예전엔 이 이름 하나로 live 가 켜지지 않았다)
  assert.ok(!("POSTHOG_PROJECT_KEY" in LIVE))
})

test("환경 검사: 값이 있으면 읽고(대조군), 있는데 틀리면 켜질 때 멈춘다 — 이름만 알리고 값은 싣지 않는다", () => {
  for (const host of ["https://us.i.posthog.com", "https://eu.i.posthog.com", "https://eu.posthog.com"]) assert.doesNotThrow(() => templateEnv({ ...LIVE, POSTHOG_HOST: host }), host)
  assert.doesNotThrow(() => templateEnv({ ...LIVE, SENTRY_DSN: DSN }))
  assert.doesNotThrow(() => templateEnv({ ...LIVE, POSTHOG_PROJECT_KEY: "phc_fake_not_secret" }))
  // 있는데 공백이 섞였으면 켜질 때 멈춘다 — 이름만 알리고 값은 싣지 않는다
  for (const bad of [" ", "phc fake"]) assert.throws(() => templateEnv({ ...LIVE, POSTHOG_PROJECT_KEY: bad }), (e) => e instanceof EnvError && e.invalid.includes("POSTHOG_PROJECT_KEY") && !String(e.message).includes("phc fake"), JSON.stringify(bad))
  assert.doesNotThrow(() => templateEnv({ ...LIVE, SENTRY_DSN: "https://abc123@sentry.example.test/prefix/42" }), "경로가 있는 자체 호스팅 모양")
  // 지역을 못 정하는 호스트(프록시)·http·URL 이 아닌 값 — 예전엔 켜질 때 통과하고 모든 쪽 렌더에서 던졌다
  for (const bad of ["https://analytics.example.test", "http://us.i.posthog.com", "not a url"]) {
    assert.throws(() => templateEnv({ ...LIVE, POSTHOG_HOST: bad }), (e) => e instanceof EnvError && e.invalid.includes("POSTHOG_HOST") && !String(e.message).includes(bad), bad)
  }
  for (const bad of ["not a url", "http://abc@o9.ingest.sentry.io/1", "https://o9.ingest.sentry.io/1", "https://abc@o9.ingest.sentry.io/notnumber"]) {
    assert.throws(() => templateEnv({ ...LIVE, SENTRY_DSN: bad }), (e) => e instanceof EnvError && e.invalid.includes("SENTRY_DSN") && !String(e.message).includes("o9.ingest"), bad)
  }
})

test("켜짐 판정: 분석은 mock 이면 늘, live 이면 POSTHOG_HOST 와 POSTHOG_PROJECT_KEY 가 둘 다 있을 때만 · Sentry 는 live 이고 DSN 이 있을 때만(mock 은 DSN 이 있어도 보내지 않는다)", () => {
  const HOST = "https://us.i.posthog.com"
  assert.equal(analyticsEnabled("mock", undefined, undefined), true)
  assert.equal(analyticsEnabled("live", HOST, "phc_k"), true)
  assert.equal(analyticsEnabled("live", undefined, "phc_k"), false, "호스트가 없으면 꺼진다(LFOBS)")
  assert.equal(analyticsEnabled("live", HOST, undefined), false, "프로젝트 키가 없으면 꺼진다(LFOBS2)")
  assert.equal(analyticsEnabled("live", HOST, ""), false)
  assert.equal(analyticsEnabled("live", "", "phc_k"), false)
  assert.equal(analyticsEnabled("live", undefined, undefined), false)
  assert.equal(analyticsEnabled(undefined, HOST, "phc_k"), false, "모드를 모르면 켜지 않는다")
  assert.equal(analyticsOff({ LF_MODE: "live" }), true)
  assert.equal(analyticsOff({ LF_MODE: "live", POSTHOG_HOST: HOST }), true, "프로젝트 키가 없으면 PostHog 출처를 CSP 에서 뺀다")
  assert.equal(analyticsOff({ LF_MODE: "live", POSTHOG_PROJECT_KEY: "phc_k" }), true)
  assert.equal(analyticsOff({ LF_MODE: "live", POSTHOG_HOST: HOST, POSTHOG_PROJECT_KEY: "phc_k" }), false)
  assert.equal(analyticsOff({ LF_MODE: "mock" }), false)
  assert.equal(analyticsOff({}), false, "모드를 모르면 CSP 를 좁히지 않는다(예전 동작)")

  assert.equal(sentryDsn({ LF_MODE: "live", SENTRY_DSN: DSN }), DSN)
  assert.equal(sentryDsn({ LF_MODE: "live" }), undefined)
  assert.equal(sentryDsn({ LF_MODE: "live", SENTRY_DSN: "" }), undefined)
  assert.equal(sentryDsn({ LF_MODE: "mock", SENTRY_DSN: DSN }), undefined, "개발 기계가 운영 프로젝트로 오류를 보내지 않는다")
})

test("CSP: Sentry 수집 출처 한 곳만 connect-src 로 연다(DSN 이 없으면 아무것도)", () => {
  assert.deepEqual(sentryCsp(DSN), { connectSrc: ["https://o9.ingest.sentry.io"] })
  assert.deepEqual(sentryCsp(undefined), {})
  assert.deepEqual(sentryCsp("http://abc@o9.ingest.sentry.io/1"), {}, "https 가 아니면 열지 않는다")
})

test("DSN 이 없으면 init 을 부르지 않는다(오류 수집 꺼짐) — 있으면 개인정보 기본값을 끈 옵션으로 한 번 부른다", () => {
  const calls = []
  const fake = (o) => calls.push(o)
  assert.equal(startSentry(fake, sentryInitOptions(undefined)), false)
  assert.equal(startSentry(fake, sentryInitOptions(sentryDsn({ LF_MODE: "live" }))), false)
  assert.equal(startSentry(fake, sentryInitOptions(sentryDsn({ LF_MODE: "mock", SENTRY_DSN: DSN }))), false)
  assert.equal(calls.length, 0)

  assert.equal(startSentry(fake, sentryInitOptions(DSN, { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: "abc1234" })), true)
  assert.equal(calls.length, 1)
  const o = calls[0]
  assert.equal(o.dsn, DSN)
  assert.equal(o.sendDefaultPii, false, "IP·쿠키·요청 본문 같은 기본 개인정보 수집을 끈다")
  assert.equal(o.environment, "preview")
  assert.equal(o.release, "abc1234")
  assert.equal(typeof o.beforeSend, "function")
  assert.equal(typeof o.beforeBreadcrumb, "function")
  // 녹화·추적은 연결하지 않는다 — 개인정보처리방침이 알리지 않는다
  for (const key of ["replaysSessionSampleRate", "replaysOnErrorSampleRate", "tracesSampleRate", "tracesSampler", "profilesSampleRate", "enableLogs"]) assert.ok(!(key in o) || !o[key], `${key} 는 꺼져 있다`)
  assert.ok(!("integrations" in o), "서버 옵션에는 통합을 더하지 않는다(브라우저 파일이 BrowserSession 을 빼고 피드백을 켠다)")
  // 추가 옵션은 그대로 얹힌다
  const extra = []
  startSentry((x) => extra.push(x), sentryInitOptions(DSN), { integrations: () => [] })
  assert.equal(typeof extra[0].integrations, "function")
})

test("진짜 Sentry 서버 SDK(가짜 전송): 서버가 던진 오류가 보고서에 닿고, 이메일·토큰·쿠키는 가려진다", async () => {
  const envelopes = []
  const transport = () => ({ send: async (envelope) => (envelopes.push(envelope), {}), flush: async () => true })
  Sentry.init({ ...sentryInitOptions(DSN, { NODE_ENV: "test" }), transport })
  // Next 의 onRequestError 가 부르는 함수(instrumentation.ts 의 onRequestError = Sentry.captureRequestError)
  Sentry.captureRequestError(
    new Error("render failed for ops@example.test with Bearer abc.def.ghi"),
    { path: "/pricing?token=sekret-value", method: "GET", headers: { cookie: "session=abc", authorization: "Bearer zzz", "x-trace": "ok" } },
    { routerKind: "App Router", routePath: "/pricing", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined },
  )
  assert.equal(await Sentry.flush(5000), true)
  const events = envelopes.flatMap((e) => e[1]).filter(([h]) => h.type === "event").map(([, p]) => p)
  assert.equal(events.length, 1, `이벤트 1건이 전송되어야 한다 (envelopes ${envelopes.length})`)
  // 스택의 소스 줄(context_line)은 이 시험 파일 자신의 코드라 가짜 비밀 문자열이 그대로 보인다 — 앱 소스는 개인정보가 아니므로 스택은 빼고 본다
  const text = JSON.stringify(events[0], (key, value) => (key === "stacktrace" ? undefined : value))
  assert.equal(events[0].exception.values[0].type, "Error")
  assert.match(events[0].exception.values[0].value, /^render failed for \[email\] with Bearer \[token\]$/, "메시지의 이메일·토큰이 가려졌다")
  if (process.env.LFOBS_DEBUG) console.log(JSON.stringify(events[0], null, 1))
  for (const secret of ["ops@example.test", "abc.def.ghi", "sekret-value", "session=abc", "Bearer zzz"]) assert.ok(!text.includes(secret), `보고서에 ${secret} 이 남았다`)
  assert.equal(events[0].environment, "test")
  assert.ok(!events[0].user?.ip_address, "IP 를 싣지 않는다(sendDefaultPii false)")
  await Sentry.close(2000)
})

test("조립: onRequestError 는 Sentry 의 captureRequestError 이고, 설정 파일은 DSN 이 없으면 init 을 부르지 않는 한 줄만 쓴다", () => {
  const inst = read("instrumentation.ts")
  assert.match(inst, /export const onRequestError = Sentry\.captureRequestError/)
  assert.match(inst, /await import\("\.\/sentry\.server\.config"\)/)
  assert.match(inst, /await import\("\.\/sentry\.edge\.config"\)/)
  assert.ok(inst.indexOf("templateEnv()") < inst.indexOf("sentry.server.config"), "환경 검사가 먼저 — 틀리면 Sentry 를 켜기 전에 멈춘다")
  for (const f of ["sentry.server.config.ts", "sentry.edge.config.ts"]) assert.match(read(f), /startSentry\(Sentry\.init, sentryInitOptions\(sentryDsn\(\)\)\)/, f)
  const client = read("instrumentation-client.ts")
  assert.match(client, /NEXT_PUBLIC_SENTRY_DSN/)
  assert.match(client, /export function onRouterTransitionStart\(/)
  assert.match(client, /captureRouterTransitionStart\(href, navigationType\)/)
  assert.match(client, /"BrowserSession"/, "세션 보고 통합은 뺀다")
  assert.match(client, /"BrowserTracing"/, "추적 통합도 뺀다")
  assert.ok(!/replayIntegration|replaysSessionSampleRate|browserTracingIntegration/.test(client + read("sentry.server.config.ts")), "녹화·추적은 연결하지 않는다")
  for (const f of ["app/error.tsx", "app/global-error.tsx"]) assert.match(read(f), /reportClientError\(error\)/, f)
})

test("문제 신고(D95): 스위치는 기본 꺼짐이고, 피드백은 이름·이메일·스크린샷을 받지 않는다", async () => {
  const { REPORT_PROBLEM_ENABLED } = await import("../lib/launch/feedback.ts")
  const { REPORT_PROBLEM_OPTIONS: o } = await import("../lib/report-problem.ts")
  assert.equal(REPORT_PROBLEM_ENABLED, false, "방침에 사용자가 직접 보내는 글이 적히기 전에는 꺼 둔다")
  assert.deepEqual([o.showName, o.showEmail, o.enableScreenshot, o.autoInject], [false, false, false, false])
  assert.match(read("instrumentation-client.ts"), /REPORT_PROBLEM_ENABLED \? \[Sentry\.feedbackIntegration/)
})

test("분석이 꺼져 있으면: 동의 띠·쿠키 설정 링크·서버 계측이 모두 같은 판정을 따른다(소스 연결)", () => {
  assert.match(read("components/product/analytics.tsx"), /analyticsEnabled\(mode, host, projectKey\)[\s\S]*OffBridge/)
  assert.match(read("components/product/product-blocks.tsx"), /if \(!enabled\) return null/)
  assert.match(read("components/product/product-footer.tsx"), /analyticsEnabled\(process\.env\.LF_MODE, process\.env\.POSTHOG_HOST, process\.env\.POSTHOG_PROJECT_KEY\) \? footerCopy : withoutCookies/)
  assert.match(read("app/layout.tsx"), /data-analytics=\{analyticsOn \? "enabled" : "disabled"\}/)
  assert.match(read("app/layout.tsx"), /analyticsEnabled\(e\.LF_MODE, host, projectKey\)/, "프로젝트 키도 호스트처럼 같은 판정에 든다(LFOBS2)")
  assert.match(read("lib/launch/analytics.ts"), /disabledServerAnalytics\(\)/)
  assert.match(read("lib/launch/analytics.ts"), /env\(\)\.LF_MODE === "live" && host && projectKey \?/, "서버 계측: 호스트나 프로젝트 키가 없으면 꺼진 계측(LFOBS2)")
  assert.ok(!/required\("POSTHOG_PROJECT_KEY"\)/.test(read("lib/launch/analytics.ts")), "프로젝트 키가 없다고 던지지 않는다")
  assert.match(read("lib/launch/account.ts"), /if \(!host && !personalApiKey && !projectId\) return NO_ANALYTICS_ERASER/)
})

// ── LFOBS2: 브라우저 Sentry 는 페이지가 열린 뒤에 받아진다(lib/sentry-lazy.ts) ─────────────────────────────────────────────────────────────

/** 가짜 window 의 이벤트 대상: 듣는 것·떼는 것을 센다 */
function fakeTarget() {
  const handlers = new Map()
  return {
    removed: 0,
    addEventListener(type, fn) {
      handlers.set(type, [...(handlers.get(type) ?? []), fn])
    },
    removeEventListener(type, fn) {
      this.removed++
      handlers.set(type, (handlers.get(type) ?? []).filter((h) => h !== fn))
    },
    emit(type, event) {
      for (const h of handlers.get(type) ?? []) h(event)
    },
    count: (type) => (handlers.get(type) ?? []).length,
  }
}
/** 가짜 SDK 손잡이: 받은 오류를 순서대로 모은다 */
function fakeSdk() {
  const seen = []
  const hints = []
  return { seen, hints, captureException: (e, hint) => (seen.push(e), hints.push(hint)), captureRouterTransitionStart() {}, getFeedback: () => undefined }
}

test("늦게 받기: 예약이 돌기 전에는 SDK 를 받지 않고, 그동안 난 오류(window error·unhandledrejection·오류 화면)를 모았다가 받은 뒤 순서대로 보낸다", async () => {
  const target = fakeTarget()
  const sdk = fakeSdk()
  let loads = 0
  let runLoad = () => {}
  const reporter = createLazyReporter({ target, schedule: (run) => (runLoad = run), load: async () => (loads++, sdk) })
  assert.equal(loads, 0, "예약이 돌기 전에는 SDK 를 받지 않는다")
  assert.equal(target.count("error"), 1)
  assert.equal(target.count("unhandledrejection"), 1)

  const boom = new Error("boom")
  target.emit("error", { error: boom, message: "boom" })
  target.emit("error", { error: null, message: "Script error." }) // 다른 출처 스크립트 — 오류 개체가 없다
  target.emit("unhandledrejection", { reason: "rejected" })
  reporter.capture(new Error("from error boundary"))
  assert.equal(reporter.buffered(), 4)
  assert.equal(sdk.seen.length, 0, "SDK 가 아직이면 아무것도 보내지 않는다")
  assert.equal(reporter.handle(), undefined)

  runLoad()
  const handle = await reporter.whenLoaded()
  assert.equal(handle, sdk)
  assert.equal(loads, 1)
  assert.deepEqual(sdk.seen.map((e) => (e instanceof Error ? e.message : e)), ["boom", "Script error.", "rejected", "from error boundary"], "모은 순서대로")
  assert.equal(sdk.seen[0], boom, "오류 개체 그대로 보낸다")
  assert.deepEqual(sdk.hints.map((h) => h?.mechanism?.handled), [false, false, false, undefined], "전역 오류는 「처리 안 됨」 표지를 달고, 오류 화면이 보낸 것은 표지 없이(기본 처리됨)")
  assert.equal(sdk.hints[0].mechanism.type, "auto.browser.global_handlers.onerror")
  assert.equal(sdk.hints[2].mechanism.type, "auto.browser.global_handlers.onunhandledrejection")
  assert.equal(reporter.buffered(), 0)
  assert.equal(target.count("error"), 0, "받은 뒤에는 듣기를 그만둔다(SDK 의 전역 처리기가 이어받는다 — 같은 오류를 두 번 잡지 않는다)")
  assert.equal(target.count("unhandledrejection"), 0)

  // 받은 뒤: 오류 화면의 오류는 바로 간다, 이벤트는 더 모으지 않는다
  reporter.capture(new Error("after load"))
  target.emit("error", { error: new Error("ignored by buffer"), message: "x" })
  assert.equal(sdk.seen.length, 5)
  assert.equal(sdk.seen[4].message, "after load")
  assert.equal(reporter.handle(), sdk)
})

test("늦게 받기: 모으는 오류는 최대 EARLY_ERROR_LIMIT 개 — 넘치면 버린다", async () => {
  const target = fakeTarget()
  const sdk = fakeSdk()
  let runLoad = () => {}
  const reporter = createLazyReporter({ target, schedule: (run) => (runLoad = run), load: async () => sdk })
  for (let i = 0; i < EARLY_ERROR_LIMIT + 7; i++) target.emit("error", { error: new Error(`e${i}`), message: "" })
  assert.equal(reporter.buffered(), EARLY_ERROR_LIMIT)
  runLoad()
  await reporter.whenLoaded()
  assert.equal(sdk.seen.length, EARLY_ERROR_LIMIT)
  assert.equal(sdk.seen.at(-1).message, `e${EARLY_ERROR_LIMIT - 1}`, "앞쪽(먼저 난) 오류를 남긴다")
})

test("늦게 받기: 받기가 실패하면(차단·오프라인) 듣기를 그만두고 모은 것을 버리며, 이후에도 던지지 않고 아무 일도 하지 않는다", async () => {
  const target = fakeTarget()
  let runLoad = () => {}
  const reporter = createLazyReporter({ target, schedule: (run) => (runLoad = run), load: async () => Promise.reject(new Error("chunk blocked")) })
  target.emit("error", { error: new Error("early"), message: "" })
  runLoad()
  assert.equal(await reporter.whenLoaded(), undefined)
  assert.equal(reporter.buffered(), 0)
  assert.equal(target.count("error"), 0)
  assert.doesNotThrow(() => reporter.capture(new Error("later")))
  assert.equal(reporter.buffered(), 0, "실패한 뒤에는 더 모으지 않는다")
  assert.equal(reporter.handle(), undefined)
})

test("늦게 받기: 켜지 않았으면(DSN 없음·mock) 오류 화면의 보고도 신고 단추의 기다림도 아무 일도 하지 않는다", async () => {
  setReporter(undefined)
  assert.doesNotThrow(() => reportClientError(new Error("x")))
  assert.equal(await sentryLoaded(), undefined)
  // 켠 뒤에는 같은 경로로 간다
  const target = fakeTarget()
  const sdk = fakeSdk()
  let runLoad = () => {}
  setReporter(createLazyReporter({ target, schedule: (run) => (runLoad = run), load: async () => sdk }))
  reportClientError(new Error("queued"))
  runLoad()
  assert.equal(await sentryLoaded(), sdk)
  assert.equal(sdk.seen[0].message, "queued")
  setReporter(undefined)
})

test("늦게 받기: `load` 이벤트 뒤 한가할 때 한 번 — 문서가 아직 로딩 중이면 load 를 기다리고, 이미 끝났으면 바로 한가할 때를 기다린다", () => {
  const make = (readyState, withIdle = true) => {
    const listeners = []
    const idle = []
    const timers = []
    const win = {
      document: { readyState },
      addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }),
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
    }
    if (withIdle) win.requestIdleCallback = (fn, opts) => idle.push({ fn, opts })
    return { win, listeners, idle, timers }
  }
  let ran = 0
  const run = () => ran++

  const loading = make("loading")
  afterLoadWhenIdle(run, loading.win)
  assert.deepEqual(loading.listeners.map((l) => [l.type, l.opts?.once]), [["load", true]])
  assert.equal(loading.idle.length, 0, "load 전에는 한가해지길 기다리지도 않는다")
  assert.equal(ran, 0)
  loading.listeners[0].fn()
  assert.equal(loading.idle.length, 1)
  assert.equal(loading.idle[0].opts.timeout, AFTER_LOAD_MAX_MS, "한가해지지 않아도 상한 뒤에는 돈다")
  assert.equal(ran, 0)
  loading.idle[0].fn()
  assert.equal(ran, 1)

  const done = make("complete")
  afterLoadWhenIdle(run, done.win)
  assert.equal(done.listeners.length, 0)
  assert.equal(done.idle.length, 1)

  const noIdle = make("complete", false)
  afterLoadWhenIdle(run, noIdle.win)
  assert.equal(noIdle.timers.length, 1, "requestIdleCallback 이 없는 브라우저는 타이머로")
})

test("늦게 받기(조립): 첫 번째 JS 에 들어가는 브라우저 파일은 @sentry/nextjs 를 정적으로 가져오지 않는다 — 동적 import() 만", () => {
  for (const f of ["instrumentation-client.ts", "app/error.tsx", "app/global-error.tsx", "components/product/report-problem.tsx", "lib/sentry-lazy.ts"]) {
    const src = read(f)
    assert.ok(!/^\s*import\s+(?:[^"']*\sfrom\s+)?["']@sentry\//m.test(src), `${f}: @sentry/* 를 정적으로 가져온다 — 모든 쪽의 첫 JS 에 SDK 가 실린다`)
  }
  const client = read("instrumentation-client.ts")
  assert.match(client, /import\("\.\/lib\/sentry-browser"\)/, "SDK 는 동적 import — 쓰는 이름만 다시 내보내는 입구를 통해(이름공간 통째로 가져오면 걷어지지 않는다)")
  assert.match(read("lib/sentry-browser.ts"), /export \{[^}]*\} from "@sentry\/nextjs"/)
  assert.ok(!/import\("@sentry\/nextjs"\)/.test(client), "이름공간 통째 동적 import 를 쓰지 않는다")
  assert.match(client, /afterLoadWhenIdle/, "load 뒤 한가할 때")
  assert.match(client, /if \(dsn && typeof window !== "undefined"\)/, "DSN 이 없으면 아무것도 켜지 않는다(내려받지도 않는다)")
  assert.match(client, /startSentry\(Sentry\.init, sentryInitOptions\(dsn\)/, "개인정보 옵션은 그대로(sendDefaultPii false·scrub) — 추적·녹화 없음")
  // 서버·엣지는 그대로 정적(이 변경이 건드리지 않았다)
  assert.match(read("instrumentation.ts"), /import \* as Sentry from "@sentry\/nextjs"/)
  assert.match(read("sentry.server.config.ts"), /@sentry\/nextjs/)
  assert.match(read("sentry.edge.config.ts"), /@sentry\/nextjs/)
})
