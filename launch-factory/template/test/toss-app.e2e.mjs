// 실제 Next 템플릿 + Better Auth + PGlite + Chrome. 토스 SDK와 공급자만 가짜다.
/* global document */
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { createConnection, createServer } from "node:net"
import { createRequire } from "node:module"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { randomBytes } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { chromium } from "playwright"
import { cleanEnv } from "../scripts/ci/smoke-lib.mjs"
import { clientFailureClass, httpFailure, serverFailureClasses } from "./toss-e2e-diagnostics.mjs"

const template = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
const next = require.resolve("next/dist/bin/next")
const preload = pathToFileURL(join(template, "test/toss-auth-preload.mjs")).href
const password = "fake-password-only-8X!"

async function freePort() {
  const s = createServer()
  await new Promise((done) => s.listen(0, "127.0.0.1", done))
  const port = s.address().port
  await new Promise((done) => s.close(done))
  return port
}
async function reachable(origin) {
  return new Promise((done) => {
    const target = new URL(origin)
    const socket = createConnection({ host: target.hostname, port: Number(target.port) })
    socket.setTimeout(1000)
    socket.once("connect", () => { socket.destroy(); done(true) })
    socket.once("error", () => done(false))
    socket.once("timeout", () => { socket.destroy(); done(false) })
  })
}
async function login(context, origin, email, label, traceStatus) {
  const signup = await context.request.post(`${origin}/api/auth/sign-up/email`, { data: { name: "Example", email, password, lfConsents: { terms: true, privacy: true, ageOver14: true, locale: "en" } } })
  traceStatus(`${label}_signup`, signup.status())
  if (signup.status() !== 200) throw httpFailure("signup", signup.status(), 200)
  let lastStatus = 0
  for (let i = 0; i < 25; i++) {
    await delay(300)
    const signIn = await context.request.post(`${origin}/api/auth/sign-in/email`, { data: { email, password } })
    traceStatus(`${label}_signin`, signIn.status())
    if (signIn.status() === 200) return
    lastStatus = signIn.status()
  }
  throw httpFailure("sign_in", lastStatus, 200)
}

test("실제 템플릿·서버 인증·가짜 SDK·콜백·DB 등록 전 과정", { timeout: 600_000 }, async () => {
  const sandbox = process.env.TOSS_E2E_SANDBOX === "1"
  const chargeMode = sandbox ? "토스 시험" : "모의"
  const deletion = process.env.TOSS_E2E_DELETE === "1"
  const billing = process.env.TOSS_E2E_BILLING === "1"
  const pending = process.env.TOSS_E2E_PENDING === "1"
  const defaultOnly = process.env.TOSS_E2E_DEFAULT_ONLY === "1"
  const tmpRoot = resolve(".tmp")
  await mkdir(tmpRoot, { recursive: true })
  const work = await mkdtemp(join(tmpRoot, "toss-app-e2e-"))
  const distName = `.next-toss-e2e-${randomBytes(8).toString("hex")}`
  const tsconfigName = `.tsconfig-toss-e2e-${randomBytes(8).toString("hex")}.json`
  const tsconfigPath = join(template, tsconfigName)
  const dist = join(template, distName)
  const keyPath = join(work, "test-key.pem"), certPath = join(work, "test-cert.pem"), proofPath = join(work, "proof.json"), renewPath = join(work, "renew.marker")
  const openssl = process.env.TOSS_E2E_OPENSSL || "openssl"
  let child, browser, logs = "", cleanupFailure = false, failure, stage = "startup"
  const started = Date.now()
  const setStage = (value) => { stage = value; if (process.env.TOSS_E2E_TRACE === "1") console.log(`TOSS_E2E stage=${value} elapsed_ms=${Date.now() - started}`) }
  const traceStatus = (name, status) => { if (process.env.TOSS_E2E_TRACE === "1") console.log(`TOSS_E2E ${name} status=${status}`) }
  try {
    const cert = spawnSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=127.0.0.1"], { env: { ...process.env, MSYS_NO_PATHCONV: "1" }, stdio: "ignore", windowsHide: true })
    assert.equal(cert.status, 0, "test TLS certificate generation")
    await writeFile(tsconfigPath, await readFile(join(template, "tsconfig.json")), { flag: "wx" })
    const port = await freePort()
    const origin = `https://127.0.0.1:${port}`
    const baseEnv = Object.fromEntries(Object.entries(cleanEnv(process.env)).filter(([name]) => !name.startsWith("TOSS_")))
    const paddle = process.env.TOSS_E2E_NO_PADDLE === "1" ? {} : { PADDLE_API_KEY: "test_paddle_fake", PADDLE_WEBHOOK_SECRET: "test_webhook_fake" }
    const env = { ...baseEnv, ...paddle, NODE_ENV: "development", LF_MODE: "mock", LF_MOCK_SUB: "none", LF_TOSS_TEST: defaultOnly ? "0" : "1", LF_TOSS_TEST_FAKE: sandbox ? "0" : "1", TOSS_TEST_CLIENT_KEY: sandbox ? "test_ck_dummy" : "test_ck_fake", TOSS_TEST_SECRET_KEY: sandbox ? "test_sk_dummy" : "test_sk_fake", TOSS_TEST_MERCHANT_ID: "e2e-mid", TOSS_E2E_SANDBOX: sandbox ? "1" : "0", TOSS_E2E_DELETE: deletion ? "1" : "0", TOSS_E2E_BILLING: billing ? "1" : "0", TOSS_E2E_PENDING: pending ? "1" : "0", TOSS_E2E_RENEW_MARKER: renewPath, TOSS_TEST_ENCRYPTION_KEY: "55".repeat(32), NEXT_PUBLIC_APP_URL: origin, NODE_OPTIONS: `--import=${preload}`, TOSS_E2E_PROOF_PATH: proofPath, LF_TOSS_TEST_DIST: distName, LF_TOSS_TEST_TSCONFIG: tsconfigName, CRON_SECRET: "test_cron_fake_0123456789", SUBJECT_REF_KEY: "fake_subject_key_0123456789_0123456789", NEXT_TELEMETRY_DISABLED: "1" }
    if (sandbox) env.TOSS_TEST_DB_DIRECTORY = work
    child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", String(port), "--experimental-https", "--experimental-https-key", keyPath, "--experimental-https-cert", certPath], { cwd: template, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
    child.stdout.on("data", (data) => { logs += data.toString() })
    child.stderr.on("data", (data) => { logs += data.toString() })
    let ready = false
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) {
        let safe = logs
        for (const value of Object.values(env).filter((v) => typeof v === "string" && v.length >= 6).sort((a, b) => b.length - a.length)) safe = safe.split(value).join("[redacted]")
        throw new Error(`test server exited before ready: ${safe.slice(-2000)}`)
      }
      if (await reachable(origin)) { ready = true; break }
      await delay(500)
    }
    assert.equal(ready, true, "test server ready")
    browser = await chromium.launch({ channel: "chrome", headless: true })
    if (defaultOnly) {
      setStage("default_toss_page")
      const page = await browser.newPage({ ignoreHTTPSErrors: true })
      const response = await page.goto(`${origin}/account/billing/toss-test`, { timeout: 90_000 })
      const status = response?.status() ?? 0
      if (status !== 404 && status !== 200) throw httpFailure(stage, status, 404)
      traceStatus(stage, status)
      await page.locator('[data-error-code="not_found"]').first().waitFor({ state: "visible" })
      await page.locator('meta[name="robots"][content*="noindex"]').first().waitFor({ state: "attached", timeout: 20_000 })
      const noindex = await page.locator('meta[name="robots"][content*="noindex"]').count()
      if (process.env.TOSS_E2E_TRACE === "1") console.log(`TOSS_E2E default_noindex count=${noindex}`)
      assert.ok(noindex >= 1)
      assert.equal(await page.getByRole("button", { name: "모의 카드 등록" }).count(), 0)
      await page.close()
    } else {
    const anonymous = await browser.newContext({ ignoreHTTPSErrors: true })
    setStage("anonymous_registration")
    const unauthenticated = await anonymous.request.post(`${origin}/api/toss/registration/start`, { headers: { Origin: origin }, timeout: 45_000 })
    traceStatus(stage, unauthenticated.status())
    if (unauthenticated.status() !== 401) throw httpFailure(stage, unauthenticated.status(), 401)
    setStage("anonymous_charge")
    const chargeResponse = await anonymous.request.post(`${origin}/api/toss/test-charge`, { headers: { Origin: origin }, timeout: 45_000 })
    traceStatus(stage, chargeResponse.status())
    if (chargeResponse.status() !== 401) throw httpFailure(stage, chargeResponse.status(), 401)
    if (deletion) assert.equal((await anonymous.request.post(`${origin}/api/toss/test-account-delete`, { headers: { Origin: origin }, data: { confirmed: true, confirmEmail: "toss-a@example.test" } })).status(), 401)
    await anonymous.close()
    const owner = await browser.newContext({ ignoreHTTPSErrors: true })
    const other = await browser.newContext({ ignoreHTTPSErrors: true })
    // 페이지별 가짜 SDK 응답 외의 모든 토스 브라우저 요청은 차단한다.
    for (const context of [owner, other]) await context.route(/^https?:\/\/(?:[^/]+\.)?tosspayments\.com\//i, (route) => route.abort())
    owner.setDefaultTimeout(60_000)
    other.setDefaultTimeout(60_000)
    owner.setDefaultNavigationTimeout(90_000)
    other.setDefaultNavigationTimeout(90_000)
    setStage("owner_login")
    await login(owner, origin, "toss-a@example.test", "owner", traceStatus)
    setStage("other_login")
    await login(other, origin, "toss-b@example.test", "other", traceStatus)
    setStage("registration_ui")
    if (sandbox) {
      const badSdk = await owner.newPage()
      await badSdk.route("https://js.tosspayments.com/v2/standard", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "window.TossPayments = {};" }))
      await badSdk.goto(`${origin}/account/billing/toss-test`)
      await badSdk.getByText("등록창을 불러오지 못했습니다.").waitFor()
      assert.equal(await badSdk.getByRole("button", { name: "토스 시험 카드 등록" }).isDisabled(), true)
      await badSdk.close()
    } else {
      const badResponse = await owner.newPage()
      await badResponse.route("**/api/toss/registration/start", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ready", customerKey: ["invalid"], successUrl: ["invalid"], failUrl: ["invalid"] }) }))
      await badResponse.goto(`${origin}/account/billing/toss-test`)
      await badResponse.getByRole("button", { name: "모의 카드 등록" }).click()
      await badResponse.getByText("모의 등록을 시작할 수 없습니다. 기존 등록 또는 설정을 확인해 주세요.").waitFor()
      await badResponse.close()
    }
    const wrongOrigin = await owner.request.post(`${origin}/api/toss/registration/start`, { headers: { Origin: "https://elsewhere.example.test" } })
    assert.equal(wrongOrigin.status(), 403)
    const page = await owner.newPage()
    let capture, release
    const captured = new Promise((done) => { capture = done })
    const gate = new Promise((done) => { release = done })
    await page.route("**/api/toss/registration/complete?*", async (route) => { capture(route.request().url()); await gate; await route.continue() })
    await page.route("https://js.tosspayments.com/v2/standard", (route) => sandbox ? route.fulfill({ status: 200, contentType: "application/javascript", body: "window.TossPayments=()=>({payment:({customerKey})=>({requestBillingAuth:async ({successUrl,windowTarget})=>{if(windowTarget!=='self')throw Error('windowTarget');const u=new URL(successUrl);u.searchParams.set('customerKey',customerKey);u.searchParams.set('authKey','fake-sdk-auth');window.location.assign(u.href)}})});" }) : route.abort())
    setStage("registration_page")
    const initial = await page.goto(`${origin}/account/billing/toss-test`)
    assert.equal(initial.status(), 200)
    assert.equal(await page.locator("[data-toss-state]").getAttribute("data-toss-state"), "not-registered")
    const button = page.getByRole("button", { name: sandbox ? "토스 시험 카드 등록" : "모의 카드 등록" })
    await button.waitFor()
    await page.waitForFunction(() => !document.querySelector("button[data-requires-human]")?.hasAttribute("disabled"))
    await button.click({ noWaitAfter: true })
    setStage("registration_callback")
    const callbackUrl = await Promise.race([captured, delay(30_000).then(() => { throw new Error("fake callback was not reached") })])
    const failureUrl = new URL("/api/toss/registration/fail", origin)
    failureUrl.searchParams.set("state", new URL(callbackUrl).searchParams.get("state"))
    const denied = await other.request.get(callbackUrl, { maxRedirects: 0 })
    assert.equal(denied.status(), 303)
    assert.equal(new URL(denied.headers().location).searchParams.get("registration"), "invalid")
    const wrongHost = await owner.request.get(callbackUrl, { maxRedirects: 0, headers: { Host: "elsewhere.example.test" } })
    assert.equal(wrongHost.status(), 400)
    const fail = await owner.request.get(failureUrl.toString(), { maxRedirects: 0 })
    assert.equal(fail.status(), 303)
    assert.equal(new URL(fail.headers().location).searchParams.get("registration"), "failed")
    assert.ok(!fail.headers().location.includes("state="))
    release()
    await page.waitForURL("**/account/billing/toss-test?registration=registered")
    assert.equal(await page.locator("[data-toss-state]").getAttribute("data-toss-state"), "registered-unpaid")
    assert.ok(!page.url().includes("authKey="))
    let proof
    for (let i = 0; i < 30; i++) {
      await delay(100)
      try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.registered === 1) break } catch { /* 아직 기록 중 */ }
    }
    assert.equal(proof.registered, 1); assert.equal(proof.paid, 0); assert.equal(proof.intercepted, sandbox ? 1 : 0)
    if (pending && !sandbox) {
      await writeFile(renewPath, "test pending")
      for (let i = 0; i < 50; i++) { await delay(100); try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.pendingPrepared) break } catch { /* 기록 대기 */ } }
      assert.equal(proof.pendingPrepared, true)
      await page.reload()
      assert.equal(await page.locator("[data-toss-state]").getAttribute("data-toss-state"), "payment-pending")
      assert.equal(await page.getByRole("button", { name: "모의 첫 청구 확인 (4,900원, 실제 결제 없음)" }).count(), 0)
      assert.equal((await owner.request.post(`${origin}/api/toss/test-charge`, { headers: { Origin: origin } })).status(), 409)
      await page.getByRole("button", { name: "기존 주문 확인" }).click()
      await page.getByRole("status").getByText("기존 주문은 아직 확인되지 않았습니다. 다시 승인하지 않습니다.").waitFor()
      await page.locator('[data-toss-state="payment-pending"]').waitFor()
    } else if (!sandbox || billing) {
      setStage("other_user_charge")
      const otherCharge = await other.request.post(`${origin}/api/toss/test-charge`, { headers: { Origin: origin }, timeout: 90_000 })
      traceStatus(stage, otherCharge.status())
      if (otherCharge.status() !== 409) throw httpFailure(stage, otherCharge.status(), 409)
      setStage("wrong_origin_charge")
      const wrongCharge = await owner.request.post(`${origin}/api/toss/test-charge`, { headers: { Origin: "https://elsewhere.example.test" }, timeout: 90_000 })
      traceStatus(stage, wrongCharge.status())
      if (wrongCharge.status() !== 403) throw httpFailure(stage, wrongCharge.status(), 403)
      setStage("initial_charge")
      await page.getByRole("button", { name: `${chargeMode} 첫 청구 확인 (4,900원, 실제 결제 없음)` }).click()
      await page.getByText(`${chargeMode} 청구를 확인했습니다. 유료 권한은 활성화되지 않습니다.`).waitFor()
      await page.locator('[data-toss-state="charge-confirmed"]').waitFor()
      for (let i = 0; i < 30; i++) {
        await delay(100)
        try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.paid === 1) break } catch { /* 아직 기록 중 */ }
      }
      assert.equal(proof.registered, 1); assert.equal(proof.paid, 1); assert.equal(proof.intercepted, sandbox ? 2 : 0)
      assert.equal((await owner.request.post(`${origin}/api/toss/test-charge`, { headers: { Origin: origin } })).status(), 409)
      if (billing) {
        setStage("monthly_renewal")
        await writeFile(renewPath, "test due")
        for (let i = 0; i < 50; i++) { await delay(100); try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.renewalPrepared) break } catch { /* 기록 대기 */ } }
        assert.equal(proof.renewalPrepared, true)
        const cron = await owner.request.get(`${origin}/api/cron/toss-test`, { headers: { Authorization: "Bearer test_cron_fake_0123456789" } })
        assert.equal(cron.status(), 200); assert.equal((await cron.json()).paid, 1)
        for (let i = 0; i < 50; i++) { await delay(100); try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.paid === 2) break } catch { /* 기록 대기 */ } }
        assert.equal(proof.paid, 2)
        await page.reload(); assert.equal(await page.locator("[data-toss-state]").getAttribute("data-toss-state"), "charge-confirmed")
        setStage("cancel")
        await page.getByRole("button", { name: "이용 기간 끝에 해지" }).click()
        await page.getByText("이용 기간 끝 해지 예약됨").waitFor()
        assert.equal(await page.locator("[data-toss-state]").getAttribute("data-toss-state"), "charge-confirmed")
        const noRenew = await owner.request.get(`${origin}/api/cron/toss-test`, { headers: { Authorization: "Bearer test_cron_fake_0123456789" } })
        assert.equal((await noRenew.json()).examined, 0)
        await page.getByRole("button", { name: "시험 구독 즉시 해지" }).click()
        await page.locator('[data-toss-state="canceled"]').waitFor()
      }
      if (deletion) {
        const path = `${origin}/api/toss/test-account-delete`, body = { confirmed: true, confirmEmail: "toss-a@example.test" }
        assert.equal((await owner.request.post(path, { headers: { Origin: "https://elsewhere.example.test" }, data: body })).status(), 403)
        assert.equal((await owner.request.post(path, { headers: { Origin: origin }, data: { confirmEmail: "toss-a@example.test" } })).status(), 400)
        assert.equal((await owner.request.post(path, { headers: { Origin: origin }, data: { confirmed: true, confirmEmail: "wrong@example.test" } })).status(), 400)
        assert.equal((await owner.request.post(path, { headers: { Origin: origin }, data: body })).status(), 200)
        for (let i = 0; i < 40; i++) { await delay(100); try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.pending_deletions === 1) break } catch { /* 기록 대기 */ } }
        assert.equal(proof.pending_deletions, 1)
        const purged = await owner.request.get(`${origin}/api/cron/purge`, { headers: { Authorization: "Bearer test_cron_fake_0123456789" } })
        assert.equal(purged.status(), 200)
        const report = await purged.json(); assert.equal(report.purged, 1); assert.deepEqual(report.failures, [])
        for (let i = 0; i < 40; i++) { await delay(100); try { proof = JSON.parse(await readFile(proofPath, "utf8")); if (proof.purged_deletions === 1 && proof.owner_exists === 0) break } catch { /* 기록 대기 */ } }
        assert.equal(proof.toss_retained, billing ? 3 : 2); assert.equal(proof.owner_exists, 0)
        if (sandbox && billing) {
          assert.equal(proof.intercepted, 4)
          assert.equal(proof.blocked, 0)
          console.log(`TOSS_E2E intercepted=${proof.intercepted} blocked=${proof.blocked}`)
        }
        assert.equal((await owner.request.post(`${origin}/api/toss/registration/start`, { headers: { Origin: origin } })).status(), 401)
      }
    }
    await delay(500)
    assert.ok(!logs.includes(new URL(callbackUrl).searchParams.get("authKey")), "callback authKey is absent from Next logs")
    assert.ok(!logs.includes(new URL(callbackUrl).searchParams.get("state")), "callback state is absent from Next logs")
    assert.ok(!logs.includes(new URL(callbackUrl).searchParams.get("customerKey")), "callback customerKey is absent from Next logs")
    await owner.close(); await other.close()
    }
  } catch (error) {
    // Playwright 오류는 요청 Cookie를 포함하므로 메시지·원본 스택을 출력하지 않는다.
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z_0-9]+$/.test(error.code) ? error.code : "test_failed"
    const location = error instanceof Error ? error.stack?.match(/toss-app\.e2e\.mjs:\d+:\d+/)?.[0] : undefined
    const http = error instanceof Error && error.name === "TossHttpDiagnostic" && /^HTTP [a-z0-9_-]+: expected \d+, got \d+$/.test(error.message) ? error.message : "HTTP 응답 상태 미확인"
    const failures = serverFailureClasses(logs)
    // 원본 오류에는 인증 쿠키가 있어 보존하지 않는다.
    failure = new Error(`Toss app E2E failed: stage=${stage} ${http}; client=${clientFailureClass(error)}; server=${failures.join(",") || "로그에 분류 가능한 예외 없음"}; ${code} ${location ?? ""}`)
  } finally {
    try { if (browser) await browser.close() } catch { cleanupFailure = true }
    if (child && child.exitCode === null) {
      if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
      else child.kill("SIGTERM")
      await Promise.race([new Promise((done) => child.once("exit", done)), delay(5000)])
      if (child.exitCode === null) cleanupFailure = true
    }
    if (sandbox && !defaultOnly && !failure && !cleanupFailure) {
      try {
        const { PGlite } = await import("@electric-sql/pglite")
        const reopened = new PGlite(join(work, "e2e-mid"))
        try {
          const purged = deletion && billing
          const sql = purged ? "SELECT count(*)::int n FROM retained_transactions WHERE provider='toss'" : "SELECT count(*)::int n FROM toss_ledger_subscriptions"
          const { rows } = await reopened.query(sql)
          assert.equal(rows[0].n, purged ? 3 : 1)
          if (purged) console.log(`TOSS_E2E reopened_retained=${rows[0].n}`)
        } finally { await reopened.close() }
      } catch { failure = new Error("공식 시험 모드 파일 DB를 다시 열어 시험 기록을 확인하지 못했습니다.") }
    }
    let realTemplate = ""
    try {
      const realRoot = await realpath(tmpRoot), realWork = await realpath(work)
      realTemplate = await realpath(template)
      if (!realWork.startsWith(`${realRoot}\\`) && !realWork.startsWith(`${realRoot}/`)) cleanupFailure = true
      else await rm(realWork, { recursive: true, force: true })
    } catch { cleanupFailure = true }
    try {
      const realDist = await realpath(dist)
      if (!realDist.startsWith(`${realTemplate}\\`) && !realDist.startsWith(`${realTemplate}/`)) cleanupFailure = true
      else await rm(realDist, { recursive: true, force: true })
    } catch (error) { if (error.code !== "ENOENT") cleanupFailure = true }
    try {
      const realConfig = await realpath(tsconfigPath)
      if (!realConfig.startsWith(`${realTemplate}\\`) && !realConfig.startsWith(`${realTemplate}/`)) cleanupFailure = true
      else await rm(realConfig)
    } catch (error) { if (error.code !== "ENOENT") cleanupFailure = true }
  }
  if (failure && cleanupFailure) throw new AggregateError([failure, new Error("Unexpected temporary path")], "시험과 정리가 모두 실패했습니다")
  if (failure) throw failure
  if (cleanupFailure) throw new Error("Unexpected temporary path")
})
