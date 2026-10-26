// 템플릿 빌드·기동 시험(v0 Task 10) — 무겁다(next build 약 4분, next start·next dev). `npm run template:verify` 로 따로 돈다.
// 무거운 실행이라 web-factory 공용 잠금 원장(P3-2 progress.md) 아래에서 돌린다(부르는 쪽 책임 — 지침 Global Constraints).
//   1. LF_MODE=mock 빌드 종료 0
//   2. live 인데 키가 없으면 서버가 켜지지 않고, 빠진 이름을 모두 알린다(Review Focus 5)
//   3. 키도 LF_MODE 도 없이 npm run dev 가 켜지고 제품 쪽들이 200 이다(CSP nonce 머리 포함)
// 서버는 시험이 끝나면 프로세스 나무째 끈다.
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { MOCK_ONLY_NAMES } from "@launch-factory/env"

const T = fileURLToPath(new URL("..", import.meta.url))
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"
const NPX = process.platform === "win32" ? "npx.cmd" : "npx"
const PROVIDER_NAMES = ["DATABASE_URL", "BETTER_AUTH_SECRET", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "RESEND_API_KEY", "TURNSTILE_SECRET_KEY"]
const TEMPLATE_NAMES = ["EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "CRON_SECRET", "SUBJECT_REF_KEY", "TURNSTILE_SITE_KEY"]
// live 에서도 없어도 켜지는 이름(LFENV) — 없으면 그 기능만 꺼진다. 빠진 이름 알림에 들어가면 안 된다
const OPTIONAL_NAMES = ["INQUIRY_OWNER_EMAIL", "POSTHOG_HOST", "POSTHOG_PROJECT_KEY", "SENTRY_DSN"]
/**
 * 형식만 맞춘 가짜 값 — 공급자 키는 진짜를 쓰지 않는다(LF_NO_USER_ENV). 다만 DATABASE_URL 만은 닿는 데이터베이스여야 한다:
 * 공개 쪽도 Better Auth 세션 조회가 rate_limit 표를 읽고 쓴다. 그래서 live 서버 시험은 LF_VERIFY_LIVE=1 일 때만 돈다(아래).
 */
const FAKE_LIVE = {
  LF_MODE: "live",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://user:pass@127.0.0.1:1/none",
  BETTER_AUTH_SECRET: "a".repeat(40),
  PADDLE_API_KEY: "pdl_sdbx_apikey_fake",
  PADDLE_WEBHOOK_SECRET: "whsec_fake",
  PADDLE_CLIENT_TOKEN: "test_fake_client_token_000000000",
  RESEND_API_KEY: "re_fake",
  POSTHOG_PROJECT_KEY: "phc_fake",
  POSTHOG_HOST: "https://us.i.posthog.com",
  SENTRY_DSN: "https://key@o0.ingest.sentry.example.test/0",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  EMAIL_FROM: "Fake <hello@example.test>",
  NEXT_PUBLIC_APP_URL: "http://localhost:3424",
  CRON_SECRET: "c".repeat(24),
  SUBJECT_REF_KEY: "s".repeat(40),
}

/** 공급자 키·LF_MODE 를 뺀 환경 — 이 기계에 키가 있어도 「키 없음」을 시험한다 */
function cleanEnv(extra = {}) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", CI: "1" }
  for (const n of [...PROVIDER_NAMES, ...TEMPLATE_NAMES, ...OPTIONAL_NAMES, "PADDLE_CLIENT_TOKEN", "LF_MODE", ...MOCK_ONLY_NAMES, "NODE_ENV", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) delete env[n]
  return { ...env, ...extra }
}
const kill = (child) => {
  if (child.exitCode !== null || child.pid === undefined) return
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"])
  else child.kill("SIGKILL")
}
function start(cmd, args, env) {
  const child = spawn(cmd, args, { cwd: T, env, shell: process.platform === "win32" })
  const out = { text: "" }
  child.stdout.on("data", (d) => (out.text += d))
  child.stderr.on("data", (d) => (out.text += d))
  return { child, out }
}
const until = async (fn, ms, what) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${what}: ${ms}ms 안에 안 됨`)
}

test("mock 모드 빌드 종료 0", { timeout: 20 * 60_000 }, () => {
  const r = spawnSync(NPM, ["run", "build"], { cwd: T, env: cleanEnv({ LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" }), encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 << 20 })
  assert.equal(r.status, 0, `next build 종료 ${r.status}\n${`${r.stdout}${r.stderr}`.slice(-3000)}`)
  assert.ok(existsSync(join(T, ".next", "BUILD_ID")))
  assert.match(r.stdout, /\/sign-in/)
  assert.match(r.stdout, /\/account\/billing/)
})

test("mock 서버가 내보낸 HTML 에 가입·로그인 도착 안내가 이미 들어 있다(자바스크립트 없이도 보인다)", { timeout: 120_000 }, async () => {
  assert.ok(existsSync(join(T, ".next", "BUILD_ID")), "먼저 빌드가 있어야 한다(첫 시험)")
  const { child, out } = start(NPX, ["next", "start", "-p", "3423"], cleanEnv({ LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" }))
  try {
    await until(() => /Ready in/.test(out.text), 60_000, "mock start Ready")
    // 구글 가입·로그인 도착(signup·signin), 확인 메일 링크 도착(verified), 틀린 링크(failed = alert) — 「/」의 서버 응답 본문만 본다(fetch 는 스크립트를 돌리지 않는다)
    const cases = [
      ["/?welcome=signin", /<section[^>]*role="status"[^>]*data-welcome="signin"[\s\S]*Welcome back/],
      ["/?welcome=signup", /<section[^>]*role="status"[^>]*data-welcome="signup"/],
      ["/?welcome=verified", /<section[^>]*role="status"[^>]*data-welcome="verified"/],
      ["/?welcome=verified&error=invalid_token", /<section[^>]*role="alert"[^>]*data-welcome="failed"/],
    ]
    for (const [path, pattern] of cases) {
      const res = await fetch(`http://localhost:3423${path}`, { signal: AbortSignal.timeout(60_000) })
      assert.equal(res.status, 200, path)
      const html = await res.text()
      assert.match(html, pattern, `${path}: 서버 HTML 에 안내가 없다`)
      assert.match(html, /<header/, `${path}: 제품 틀(위 띠)이 없다 — 틀 밖 시작 쪽이 서빙되고 있다`)
    }
    for (const path of ["/", "/?welcome=bogus"]) {
      const html = await fetch(`http://localhost:3423${path}`, { signal: AbortSignal.timeout(60_000) }).then((r) => r.text())
      assert.ok(!html.includes("data-welcome="), `${path}: 표지가 없거나 모르는 값인데 안내가 그려졌다`)
    }
  } finally {
    kill(child)
  }
})

test("live 인데 키가 없으면 서버가 켜지지 않고 빠진 이름을 모두 알린다", { timeout: 120_000 }, async () => {
  assert.ok(existsSync(join(T, ".next", "BUILD_ID")), "먼저 빌드가 있어야 한다(첫 시험)")
  const { child, out } = start(NPX, ["next", "start", "-p", "3421"], cleanEnv({ LF_MODE: "live" }))
  try {
    await until(() => /EnvError|환경 변수 확인 실패/.test(out.text), 60_000, "환경 검사 오류")
    for (const name of [...PROVIDER_NAMES, ...TEMPLATE_NAMES]) assert.ok(out.text.includes(name), `${name} 이 알림에 없다`)
    assert.match(out.text, new RegExp(`없음 ${PROVIDER_NAMES.length + TEMPLATE_NAMES.length}개`))
    for (const name of OPTIONAL_NAMES) assert.ok(!out.text.includes(name), `${name} 은 선택 이름이라 빠진 이름 알림에 없어야 한다(LFENV)`)
    const res = await fetch("http://localhost:3421/sign-in").then((r) => r.status, () => 0)
    assert.notEqual(res, 200, "키 없는 live 서버가 화면을 내면 안 된다")
  } finally {
    kill(child)
  }
})

// LFENV: 운영자 메일(INQUIRY_OWNER_EMAIL)이 없으면 사이트는 켜지고 문의만 꺼진다. 미리보기 배포가 이 이름 하나 때문에 전 쪽 500 이었다 —
// 로컬 점검이 모두 mock 이라 못 잡았다. 그래서 이 시험은 live 로 켠다(공급자 키는 형식만 맞춘 가짜, 데이터베이스는 이 기계 환경의 DATABASE_URL — 로그인 없는 공개 쪽 GET 만).
// 닿는 데이터베이스가 필요하고 rate_limit 행을 남기므로 LF_VERIFY_LIVE=1 일 때만 돈다(예: LF_VERIFY_LIVE=1 npm run template:verify). 꺼져 있어도 같은 판정은 npm test 의
// templateEnv 시험·scripts/test/inquiry-disabled-glue.test.mjs 가 단위로 지킨다.
const LIVE_SKIP = process.env.LF_VERIFY_LIVE === "1" && process.env.DATABASE_URL ? false : "LF_VERIFY_LIVE=1 과 닿는 DATABASE_URL 이 있을 때만 돈다(공개 쪽 GET 도 rate_limit 행을 쓴다)"
for (const [label, extra, expectInquiry] of [
  ["INQUIRY_OWNER_EMAIL 없음 → 사이트는 켜지고 문의만 꺼진다", {}, "disabled"],
  ["INQUIRY_OWNER_EMAIL 있음(대조군) → 문의 폼이 보인다", { INQUIRY_OWNER_EMAIL: "ops@example.test" }, "enabled"],
]) {
  test(`live 서버: ${label}`, { timeout: 180_000, skip: LIVE_SKIP }, async () => {
    assert.ok(existsSync(join(T, ".next", "BUILD_ID")), "먼저 빌드가 있어야 한다(첫 시험)")
    const port = expectInquiry === "disabled" ? 3424 : 3425
    const { child, out } = start(NPX, ["next", "start", "-p", String(port)], cleanEnv({ ...FAKE_LIVE, NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, LF_NO_USER_ENV: "1", ...extra }))
    try {
      await until(() => /Ready in|EnvError|환경 변수 확인 실패/.test(out.text), 60_000, "live start")
      assert.ok(!/EnvError|환경 변수 확인 실패/.test(out.text), `환경 검사에서 멈췄다: ${out.text.slice(-600)}`)
      for (const path of ["/", "/pricing", "/sign-in", "/privacy", "/terms", "/contact"]) {
        const res = await fetch(`http://localhost:${port}${path}`, { signal: AbortSignal.timeout(60_000) })
        assert.equal(res.status, 200, `${path} → ${res.status}\n${out.text.slice(-1200)}`)
        if (path !== "/contact") continue
        const html = await res.text()
        assert.match(html, new RegExp(`data-inquiry="${expectInquiry}"`), "/contact 의 문의 창구 표지")
        if (expectInquiry === "disabled") {
          assert.match(html, /We&#x27;re not accepting messages right now\.|We're not accepting messages right now\./, "안내 한 줄이 보인다")
          assert.ok(!/<form[\s>]/.test(html), "꺼졌으면 폼이 없다")
          assert.ok(!html.includes("You get a request number"), "접수 약속 글도 없다")
        } else {
          assert.match(html, /<form[\s>]/, "켜졌으면 폼이 있다")
          assert.ok(!html.includes("not accepting messages"), "켜졌으면 안내가 없다")
        }
      }
      // 접수 경로: 꺼졌으면 503 + code(데이터베이스에 닿지 않고 거절한다). 켜진 쪽은 보내지 않는다 — 접수는 DB 가 필요하고 패키지 시험이 맡는다
      if (expectInquiry === "disabled") {
        const post = await fetch(`http://localhost:${port}/api/inquiry`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
        assert.equal(post.status, 503)
        assert.equal((await post.json()).code, "provider_unavailable")
      }
    } finally {
      kill(child)
    }
  })
}

// LFOBS·LFOBS2: 분석 호스트(POSTHOG_HOST)·분석 프로젝트 키(POSTHOG_PROJECT_KEY — 둘 중 하나라도 없으면 분석이 꺼진다)·Sentry DSN 이 없으면 사이트는 켜지고 그 기능만 꺼진다. 예전엔 POSTHOG_HOST 가 없으면 레이아웃이 던져 live 의 모든 쪽이 500 이었다(docs/qa/lfenv.md §3).
// 위 LFENV 시험과 같은 이유로 LF_VERIFY_LIVE=1 일 때만 돈다(닿는 DATABASE_URL 필요). 같은 판정의 단위 시험은 template/test/lfobs.test.mjs.
for (const [label, port, drop, want] of [
  ["POSTHOG_HOST·SENTRY_DSN 없음 → 모든 쪽 200, 분석·오류 수집만 꺼진다", 3426, ["POSTHOG_HOST", "SENTRY_DSN"], { analytics: "disabled", errors: "disabled" }],
  ["POSTHOG_HOST·SENTRY_DSN 있음(대조군) → 둘 다 켜진다", 3427, [], { analytics: "enabled", errors: "enabled" }],
  ["POSTHOG_PROJECT_KEY 없음(호스트·DSN 있음, LFOBS2) → 모든 쪽 200, 분석만 꺼진다", 3428, ["POSTHOG_PROJECT_KEY"], { analytics: "disabled", errors: "enabled" }],
  ["POSTHOG_HOST 없음(프로젝트 키·DSN 있음) → 모든 쪽 200, 분석만 꺼진다", 3429, ["POSTHOG_HOST"], { analytics: "disabled", errors: "enabled" }],
]) {
  test(`live 서버(LFOBS): ${label}`, { timeout: 180_000, skip: LIVE_SKIP }, async () => {
    assert.ok(existsSync(join(T, ".next", "BUILD_ID")), "먼저 빌드가 있어야 한다(첫 시험)")
    const env = cleanEnv({ ...FAKE_LIVE, NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, LF_NO_USER_ENV: "1" })
    for (const n of drop) delete env[n]
    const { child, out } = start(NPX, ["next", "start", "-p", String(port)], env)
    try {
      await until(() => /Ready in|EnvError|환경 변수 확인 실패/.test(out.text), 60_000, "live start")
      assert.ok(!/EnvError|환경 변수 확인 실패/.test(out.text), `환경 검사에서 멈췄다: ${out.text.slice(-600)}`)
      for (const path of ["/", "/pricing", "/sign-in", "/privacy", "/terms", "/contact"]) {
        const res = await fetch(`http://localhost:${port}${path}`, { signal: AbortSignal.timeout(60_000) })
        assert.equal(res.status, 200, `${path} → ${res.status}\n${out.text.slice(-1200)}`)
        const html = await res.text()
        assert.match(html, new RegExp(`data-analytics="${want.analytics}"`), `${path}: 분석 표지`)
        assert.match(html, new RegExp(`data-error-reporting="${want.errors}"`), `${path}: 오류 수집 표지`)
        const csp = res.headers.get("content-security-policy") ?? ""
        assert.equal(csp.includes("posthog.com"), want.analytics === "enabled", `${path}: CSP 의 PostHog 출처(${want.analytics})`)
        assert.equal(csp.includes(new URL(FAKE_LIVE.SENTRY_DSN).origin), want.errors === "enabled", `${path}: CSP 의 Sentry 수집 출처(${want.errors})`)
        // 바닥글의 「Cookie settings」: 분석이 꺼져 있으면 링크가 없다
        assert.equal(html.includes("data-consent-open"), want.analytics === "enabled", `${path}: 쿠키 설정 링크(${want.analytics})`)
      }
    } finally {
      kill(child)
    }
  })
}

test("키도 LF_MODE 도 없이 npm run dev 가 켜지고 제품 쪽이 200 이다", { timeout: 15 * 60_000 }, async () => {
  const { child, out } = start(NPM, ["run", "dev", "--", "-p", "3422"], cleanEnv())
  try {
    await until(() => /Ready in/.test(out.text), 120_000, "dev 서버 Ready")
    // 가격 변경 메일의 두 링크(F04)는 로그인 전이면 로그인 안내를 그리고, 그 링크가 돌아올 주소(next)를 단다(LFADA — 예전의 redirect() 는 app/loading.tsx 때문에 스트리밍
    // 응답의 이동 표지(meta refresh + NEXT_REDIRECT)가 되어 하이드레이션 뒤에야 따라가졌고, 화면 관문이 그 전에 쟀다). 상태 200, 본문에 로그인 링크가 있다
    const PRICE_CHANGE_LINKS = ["/account/billing/price-change", "/account/billing/cancel"]
    for (const path of ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/pricing", "/upgrade", "/billing/return", "/account/billing", "/account/cancel", "/contact", ...PRICE_CHANGE_LINKS, "/privacy", "/terms", "/refund", "/no-such-page"]) {
      const res = await fetch(`http://localhost:3422${path}`, { signal: AbortSignal.timeout(240_000) })
      assert.equal(res.status, path === "/no-such-page" ? 404 : 200, `${path} → ${res.status}`)
      if (res.headers.get("x-robots-tag")) assert.match(res.headers.get("x-robots-tag"), /noindex/, `${path}`)
      const csp = res.headers.get("content-security-policy") ?? ""
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
      assert.ok(nonce, `${path}: CSP nonce 가 없다`)
      const html = await res.text()
      assert.ok(html.includes(`nonce="${nonce}"`), `${path}: 문서의 스크립트에 nonce 가 안 붙었다`)
      // D14: 서버가 그린 모든 style 속성의 sha256 이 CSP style-src 에 있어야 한다(브라우저가 막지 않는다)
      for (const m of html.replace(/<script[\s\S]*?<\/script>/g, "").matchAll(/\sstyle="([^"]*)"/g)) {
        const value = m[1].replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&")
        assert.ok(csp.includes(`'sha256-${createHash("sha256").update(value).digest("base64")}'`), `${path}: style 속성이 CSP 에 없다: ${value.slice(0, 80)}`)
      }
      if (path === "/privacy") assert.match(html, /International transfers of personal data/)
      if (PRICE_CHANGE_LINKS.includes(path)) {
        // (LFADA) 로그인 전이면 다른 보호된 쪽과 같은 로그인 안내 — 서버 HTML 의 링크에 돌아올 주소(next)가 있다(h1 은 안내의 제목 하나)
        assert.ok(html.includes(`href="/sign-in?next=${encodeURIComponent(path)}"`), `${path}: 로그인 전이면 next 를 단 로그인 링크가 있어야 한다`)
        assert.ok(!html.includes("NEXT_REDIRECT"), `${path}: 이동 표지(스트리밍 redirect)가 아니라 안내를 그려야 한다`)
      }
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${path}: h1 이 정확히 하나여야 한다(J04)`)
      assert.match(html, /<title>[^<]*\S[^<]*<\/title>/, `${path}: 쪽 제목이 비었다(L01·H02)`)
    }
    // L01·L02: 제목 템플릿·OG·canonical, noindex 머리(색인 제외 쪽만), robots.txt·sitemap.xml·manifest·아이콘이 있다
    const home = await fetch("http://localhost:3422/").then((r) => r.text())
    assert.match(home, /<meta name="description" content="[^"]+"/)
    assert.match(home, /<meta property="og:title"/)
    assert.match(home, /<link rel="canonical"/)
    assert.match(await fetch("http://localhost:3422/pricing").then((r) => r.text()), /<title>Pricing · [^<]+<\/title>/, "제목 템플릿 「쪽 · 제품」")
    for (const [path, noindex] of [["/pricing", false], ["/contact", false], ["/sign-in", true], ["/account/billing", true], ["/upgrade", true]]) {
      const tag = (await fetch(`http://localhost:3422${path}`)).headers.get("x-robots-tag") ?? ""
      assert.equal(/noindex/.test(tag), noindex, `${path} 의 X-Robots-Tag(${tag})`)
    }
    const robots = await fetch("http://localhost:3422/robots.txt")
    assert.equal(robots.status, 200)
    assert.match(await robots.text(), /Sitemap: http:\/\/localhost:3000\/sitemap\.xml/)
    const sitemap = await fetch("http://localhost:3422/sitemap.xml")
    assert.equal(sitemap.status, 200)
    const xml = await sitemap.text()
    for (const p of ["/pricing", "/contact", "/terms"]) assert.ok(xml.includes(`http://localhost:3000${p}</loc>`), `sitemap 에 ${p}`)
    assert.ok(!xml.includes("/account"), "sitemap 에 로그인 쪽이 없다")
    const manifest = await fetch("http://localhost:3422/manifest.webmanifest")
    assert.equal(manifest.status, 200)
    assert.equal((await manifest.json()).start_url, "/")
    for (const p of ["/icon", "/apple-icon"]) {
      const r = await fetch(`http://localhost:3422${p}`)
      assert.equal(r.status, 200, p)
      assert.match(r.headers.get("content-type") ?? "", /image\/png/, p)
    }
  } finally {
    kill(child)
  }
})
