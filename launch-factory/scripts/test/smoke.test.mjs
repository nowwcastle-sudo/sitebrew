// 빌드 스모크 시험(LFSMOKE) — 브라우저·서버·빌드 없이 도는 부분. 실제 스모크(빌드→서버→Playwright)는 `npm run ci:smoke`, CI 의 build-smoke 작업이 돈다.
// 여기서 지키는 것: (1) live 가짜 환경 표가 실제 필수 이름·형식과 같다 (2) 쪽 목록·장면 규칙이 러너(template:screens)와 같다 (3) axe 기준선 비교 (4) CI 작업이 ci:verify 단계 전체를 덮는다
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { liveRequirements } from "../env-check.mjs"
import { routesFromApp as screensRoutes } from "../template-screens/plan.mjs"
import { STEPS as ROOT_STEPS } from "../ci/verify.mjs"
import { main, parseArgs, planRun, waitForMemory } from "../../template/scripts/ci/smoke.mjs"
import { AMBIENT_ENV, buildModeOf, cleanEnv, compareAxe, LIVE_DUMMY, loopEnv, loopTestEnv, modeEnv, modesFor, pickBrowser, summarizeStats } from "../../template/scripts/ci/smoke-lib.mjs"
import { assertKnownSteps, BILLING_PATH, countByTemplate, hasSignInPrompt, loadLoopSteps, mailThrough, planLoop, readOutbox, routesFromApp, sceneMarker, scenesFor } from "../../template/e2e/lib.ts"
import { templateEnv } from "../../template/lib/live-env.ts"
import { STEPS as TEMPLATE_STEPS } from "../../template/scripts/ci/verify.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), "utf8")

test("LIVE_DUMMY 는 실제 live 필수 이름과 정확히 같다 — 선택 이름은 일부러 없다", async () => {
  const { required, optional } = await liveRequirements()
  assert.deepEqual(Object.keys(LIVE_DUMMY).sort(), [...required].sort(), "새 필수 이름을 더했으면 template/scripts/ci/smoke-lib.mjs 의 LIVE_DUMMY 에도 더한다")
  for (const n of optional) assert.ok(!(n in LIVE_DUMMY), `선택 이름 ${n} 이 가짜 값 표에 있다 — 「선택 이름이 없어도 켜진다」를 못 본다`)
  for (const [n, v] of Object.entries(LIVE_DUMMY)) assert.ok(v.length > 0, `${n} 가 비었다`)
})

test("LIVE_DUMMY 는 실제 검증기(templateEnv)를 선택 이름 없이 통과한다 — 양성 대조: 필수 하나를 빼면 그 이름을 대며 실패", () => {
  assert.doesNotThrow(() => templateEnv({ ...LIVE_DUMMY }))
  for (const name of Object.keys(LIVE_DUMMY).filter((n) => n !== "LF_MODE")) {
    const rest = Object.fromEntries(Object.entries(LIVE_DUMMY).filter(([n]) => n !== name))
    assert.throws(() => templateEnv(rest), (e) => String(e.message).includes(name), `${name} 를 뺐는데 안 멈췄다`)
  }
})

test("쪽 목록·장면 규칙은 화면 관문 러너(template:screens)와 같다", () => {
  const app = join(ROOT, "template", "app")
  const a = routesFromApp(app)
  const b = screensRoutes(app)
  assert.deepEqual(a.routes, b.routes)
  assert.deepEqual(a.dynamic, b.dynamic)
  assert.ok(a.routes.includes("/") && a.routes.length >= 10, `쪽이 너무 적다: ${a.routes.length}`)
  assert.deepEqual(scenesFor("/"), ["signed-out", "signed-in"])
  assert.deepEqual(scenesFor("/pricing"), ["signed-out", "signed-in", "signed-in:sub=past_due"])
  assert.ok(BILLING_PATH.test("/account/billing/cancel") && !BILLING_PATH.test("/contact"))
})

test("응답 읽기: 장면 표지와 로그인 안내", () => {
  assert.equal(sceneMarker('<html lang="en" data-wf-session="signed-in:sub=past_due" data-x="1"><head>'), "signed-in:sub=past_due")
  assert.equal(sceneMarker('<html lang="en"><body data-wf-session="x">'), null, "html 태그 밖의 값은 표지가 아니다")
  assert.equal(hasSignInPrompt('<h1 id="sign-in-required-title">Sign in</h1>'), true)
  assert.equal(hasSignInPrompt("<h1>Account</h1>"), false)
})

test("axe 기준선: 새 위반은 fresh, 사라진 것은 fixed, 못 잰 셀은 fixed 로 세지 않는다", () => {
  const known = ["/a|signed-out|color-contrast", "/b|signed-in|label", "/c|signed-out|region"]
  const records = [
    { cell: "/a|signed-out", violations: [{ id: "color-contrast", impact: "serious", nodes: 2 }, { id: "image-alt", impact: "critical", nodes: 1 }] },
    { cell: "/b|signed-in", violations: [] },
    // /c|signed-out 은 이번에 못 쟀다(테스트가 실패해 axe 가 안 돌았다)
  ]
  const r = compareAxe(records, known)
  assert.deepEqual(r.fresh, ["/a|signed-out|image-alt"])
  assert.deepEqual(r.fixed, ["/b|signed-in|label"], "못 잰 /c 를 「고쳐졌다」로 읽었다")
  assert.equal(r.cells, 2)
  assert.deepEqual(compareAxe([], known).fixed, [], "아무것도 못 쟀을 때 전부 「고쳐졌다」가 되면 안 된다")
})

test("브라우저 고르기: 지정 > 번들 > 설치된 Chrome > Edge > 없음", () => {
  const has = (...paths) => (p) => paths.includes(p)
  assert.deepEqual(pickBrowser({ env: { SMOKE_CHANNEL: "msedge" }, exists: () => false }), { channel: "msedge", label: "SMOKE_CHANNEL=msedge" })
  assert.equal(pickBrowser({ env: {}, bundled: "/b/chrome", exists: has("/b/chrome") }).channel, null)
  const env = { PROGRAMFILES: "C:\\PF", "PROGRAMFILES(X86)": "C:\\PF86", LOCALAPPDATA: "C:\\LA" }
  assert.equal(pickBrowser({ env, platform: "win32", bundled: "/b/none", exists: has(join("C:\\PF", "Google", "Chrome", "Application", "chrome.exe")) }).channel, "chrome")
  assert.equal(pickBrowser({ env, platform: "win32", exists: has(join("C:\\PF86", "Microsoft", "Edge", "Application", "msedge.exe")) }).channel, "msedge")
  assert.equal(pickBrowser({ env, platform: "win32", exists: () => false }), undefined)
  assert.equal(pickBrowser({ env: {}, platform: "linux", exists: has("/usr/bin/google-chrome") }).channel, "chrome")
})

test("환경: 이 PC 의 공급자·모드 이름은 스모크 서버에 새지 않는다. mock 은 장면 모드, live 는 필수 이름만", () => {
  const dirty = { PATH: "p", POSTHOG_HOST: "https://x", LF_MODE: "live", DATABASE_URL: "postgres://x", NODE_ENV: "development", INQUIRY_OWNER_EMAIL: "a@b.co", NEXT_PUBLIC_APP_URL: "https://x", LF_CI_BASE: "abc", LF_SMOKE_MIN_FREE_GB: "4", LF_ALLOW_MOCK_PROD: "1" }
  const c = cleanEnv(dirty)
  for (const n of ["POSTHOG_HOST", "LF_MODE", "DATABASE_URL", "NODE_ENV", "INQUIRY_OWNER_EMAIL", "NEXT_PUBLIC_APP_URL"]) assert.ok(!(n in c), `${n} 가 새었다`)
  assert.equal(c.PATH, "p")
  assert.equal(c.LF_CI_BASE, "abc", "CI 가 쓰는 이름은 지우지 않는다")
  assert.equal(c.LF_SMOKE_MIN_FREE_GB, "4", "스모크 자신의 설정은 지우지 않는다")
  assert.ok(AMBIENT_ENV.test("PADDLE_API_KEY") && !AMBIENT_ENV.test("PATH"))
  const mock = modeEnv("mock", dirty)
  assert.equal(mock.LF_MODE, "mock")
  assert.equal(mock.LF_MOCK_SCENES, "1")
  assert.equal(mock.LF_ALLOW_MOCK_PROD, "1", "mock 운영 빌드 스모크만 풀어 준다(E1)")
  assert.ok(!("DATABASE_URL" in mock) && !("POSTHOG_HOST" in mock))
  const live = modeEnv("live", dirty)
  assert.equal(live.LF_MODE, "live")
  assert.equal(live.LF_ALLOW_MOCK_PROD, undefined, "live 스모크에는 mock 해제 변수가 없다(이 PC 환경의 값도 새지 않는다)")
  assert.equal(live.POSTHOG_HOST, undefined, "live 스모크에 선택 이름이 들어갔다")
  assert.equal(live.INQUIRY_OWNER_EMAIL, undefined)
  assert.equal(live.DATABASE_URL, LIVE_DUMMY.DATABASE_URL, "이 PC 의 실제 DB 주소가 아니라 가짜 값이어야 한다")
  assert.throws(() => modeEnv("x"))
})

test("인자·메모리 대기·보고서 읽기", async () => {
  assert.deepEqual(parseArgs([]), { mode: "all", root: null, skipBuild: false, updateAxe: false })
  assert.deepEqual(parseArgs(["--mode", "live", "--skip-build", "--update-axe-baseline"]), { mode: "live", root: null, skipBuild: true, updateAxe: true })
  assert.throws(() => parseArgs(["--mode", "x"]))
  assert.throws(() => parseArgs(["--nope"]))
  const seq = [1.0, 2.0, 3.5]
  const waited = []
  const g = await waitForMemory(3, { free: () => seq.shift(), wait: async (ms) => waited.push(ms), log: () => {}, stepMs: 120_000 })
  assert.equal(g, 3.5)
  assert.deepEqual(waited, [120_000, 120_000])
  await assert.rejects(waitForMemory(3, { free: () => 0.5, wait: async () => {}, log: () => {}, steps: 2 }), /아래로/)
  const s = summarizeStats({ expected: 46, unexpected: 1, flaky: 1 })
  assert.equal(s.total, 48)
  assert.match(s.line, /flaky\(재시도 뒤 통과\) 1/)
})

// ── 한 바퀴(loop) — 브라우저 없이 시험할 수 있는 부분 ──────────────────────────────────────

const STEPS_FILE = join(ROOT, "template", "e2e", "loop-steps.json")

test("loop 인자: --mode loop 허용 · --mode x 거부 · --root 파싱", () => {
  assert.equal(parseArgs(["--mode", "loop"]).mode, "loop")
  assert.throws(() => parseArgs(["--mode", "x"]), /mock\|live\|loop\|all/)
  assert.equal(parseArgs(["--root", "D:/site"]).root, "D:/site")
  assert.deepEqual(parseArgs(["--mode", "loop", "--root", "D:/site", "--skip-build"]), { mode: "loop", root: "D:/site", skipBuild: true, updateAxe: false })
  assert.throws(() => parseArgs(["--root"]), /--root/)
  assert.throws(() => parseArgs(["--root", "--mode", "loop"]), /--root/, "--root 뒤에 값 대신 다른 인자가 오면 거부")
})

test("loop 모드 계획: all = mock → loop → live, loop 는 mock 빌드를 쓴다", () => {
  assert.deepEqual(modesFor("all"), ["mock", "loop", "live"])
  assert.deepEqual(modesFor("loop"), ["loop"])
  assert.deepEqual(modesFor("mock"), ["mock"])
  assert.throws(() => modesFor("x"))
  assert.equal(buildModeOf("loop"), "mock")
  assert.equal(buildModeOf("live"), "live")
})

test("loop 서버 환경: 장면 없음 · 구독 none · 새 메일 기록 · 이 PC 의 값은 새지 않는다", () => {
  const dirty = { PATH: "p", LF_MOCK_SCENES: "1", LF_MOCK_SUB: "active", LF_MOCK_OUTBOX: "C:/old.jsonl", LF_MODE: "live", DATABASE_URL: "postgres://x", LOOP_FEATURES: "inquiry", INQUIRY_OWNER_EMAIL: "a@b.co" }
  const env = loopEnv("C:/new.jsonl", dirty)
  assert.equal(env.LF_MODE, "mock")
  assert.equal(env.LF_ALLOW_MOCK_PROD, "1")
  assert.equal(env.LF_MOCK_SUB, "none", "결제 전 구독이 없어야 한다")
  assert.equal(env.LF_MOCK_OUTBOX, "C:/new.jsonl", "이 PC 의 옛 기록 경로가 아니라 이번 실행의 새 경로")
  assert.ok(!("LF_MOCK_SCENES" in env), "장면이 켜지면 로그인이 요청 사이에 이어지지 않는다")
  assert.ok(!("DATABASE_URL" in env) && !("INQUIRY_OWNER_EMAIL" in env))
  assert.equal(env.PATH, "p")
  assert.throws(() => loopEnv(""), /outbox/)
  // 시험 쪽: cleanEnv 가 LF_* 를 지우므로 이름이 다르다. LOOP_FEATURES 는 있을 때만 넘긴다
  assert.deepEqual(loopTestEnv("C:/new.jsonl", { LOOP_FEATURES: "signup,payments" }), { SMOKE_OUTBOX: "C:/new.jsonl", LOOP_FEATURES: "signup,payments" })
  assert.deepEqual(loopTestEnv("C:/new.jsonl", {}), { SMOKE_OUTBOX: "C:/new.jsonl" })
  // 빌드는 mock 환경(장면 켬)이고 서버만 다르다
  assert.equal(modeEnv("mock", dirty).LF_MOCK_SCENES, "1")
})

test("loop-steps.json: 모양·단계 id·메일 기대 합", () => {
  const spec = loadLoopSteps(STEPS_FILE)
  assert.deepEqual(Object.keys(spec.steps), ["signup", "payments", "inquiry", "booking", "booking-deposit", "shop"])
  assert.deepEqual(spec.steps.signup, ["signUp", "verifyMail", "signOut", "signIn"])
  assert.deepEqual(spec.mail, { signup: { verifyEmail: 1 }, payments: { orderConfirmation: 1 }, inquiry: { inquiryNotice: 1, inquiryReceipt: 1 }, booking: { bookingNotice: 1, bookingConfirmation: 1, bookingCancellation: 1 }, "booking-deposit": { bookingNotice: 1, bookingConfirmation: 2, bookingCancellation: 1 }, shop: { shopOrderConfirmation: 1 } })
  const all = planLoop("signup,payments,inquiry,booking", spec)
  assert.equal(all.mailTotal, 7)
  assert.deepEqual(all.mail, { verifyEmail: 1, orderConfirmation: 1, inquiryNotice: 1, inquiryReceipt: 1, bookingNotice: 1, bookingConfirmation: 1, bookingCancellation: 1 })
  assert.equal(all.steps.length, 13)
  assert.equal(planLoop(undefined, spec).mailTotal, 12, "LOOP_FEATURES 가 없으면 전부")
  assert.equal(planLoop("booking", spec).mailTotal, 3, "예약은 로그인 없이 돈다")
  assert.deepEqual(planLoop("booking", spec).steps.map((s) => s.id), ["bookPage", "manageCancel", "bookingMail"])
  // 예약금: 예약이 함께 있어야 한다. 접수(결제 대기) → 모의 결제 → 취소·환불, 메일은 대표 알림 1 + 예약한 사람 확인 2(결제 대기 안내·확정) + 취소 1
  assert.deepEqual(spec.steps["booking-deposit"], ["bookDepositPage", "payDeposit", "cancelDeposit", "bookingDepositMail"])
  assert.deepEqual(spec.requires["booking-deposit"], ["booking"])
  assert.throws(() => planLoop("booking-deposit", spec), /booking-deposit 는 booking/, "예약금은 예약이 함께 있어야 한다")
  assert.deepEqual(planLoop("booking,booking-deposit", spec).mail, { bookingNotice: 2, bookingConfirmation: 3, bookingCancellation: 2 })
  assert.deepEqual(planLoop("booking-deposit,booking", spec).features, ["booking", "booking-deposit"], "실행 순서는 json 의 순서다 — 예약이 먼저")
  assert.deepEqual(mailThrough(planLoop("booking,booking-deposit", spec), spec, "booking"), { bookingNotice: 1, bookingConfirmation: 1, bookingCancellation: 1 })
  // 상점: 가입한(로그인한) 사람이 담고 → 배송지 → 모의 결제 → 주문 확인 메일 1통 → 내 주문
  assert.deepEqual(spec.steps.shop, ["addToCart", "checkoutAddress", "payMock", "orderMail", "orderHistory"])
  assert.deepEqual(spec.requires.shop, ["signup"])
  assert.throws(() => planLoop("shop", spec), /shop 는 signup/, "상점은 로그인이 필요해 가입이 함께 있어야 한다")
  assert.deepEqual(planLoop("signup,shop", spec).mail, { verifyEmail: 1, shopOrderConfirmation: 1 })
  assert.deepEqual(planLoop("shop,signup", spec).features, ["signup", "shop"])
  assert.deepEqual(mailThrough(planLoop(undefined, spec), spec, "shop"), { verifyEmail: 1, orderConfirmation: 1, inquiryNotice: 1, inquiryReceipt: 1, bookingNotice: 2, bookingConfirmation: 3, bookingCancellation: 2, shopOrderConfirmation: 1 })
  assert.equal(planLoop("inquiry", spec).mailTotal, 2)
  assert.deepEqual(planLoop("inquiry", spec).steps.map((s) => s.id), ["contact", "inquiryMail"])
  assert.equal(planLoop("signup", spec).mailTotal, 1)
  assert.deepEqual(planLoop("inquiry,signup", spec).features, ["signup", "inquiry"], "실행 순서는 json 의 순서다")
  assert.throws(() => planLoop("bogus", spec), /모르는 기능: bogus/)
  assert.throws(() => planLoop("signup,bogus", spec), /bogus/)
  assert.throws(() => planLoop("payments", spec), /payments 는 signup/, "결제는 로그인한 사람이 하므로 가입이 함께 있어야 한다")
  // 기능이 끝날 때까지 쌓인 메일(시험이 중간에도 센다)
  assert.deepEqual(mailThrough(all, spec, "signup"), { verifyEmail: 1 })
  assert.deepEqual(mailThrough(all, spec, "payments"), { verifyEmail: 1, orderConfirmation: 1 })
  assert.deepEqual(mailThrough(all, spec, "inquiry"), { verifyEmail: 1, orderConfirmation: 1, inquiryNotice: 1, inquiryReceipt: 1 })
  assert.deepEqual(mailThrough(all, spec, "booking"), all.mail)
  assert.throws(() => mailThrough(planLoop("inquiry", spec), spec, "signup"), /계획에 없는/)
})

test("loop-steps.json: 모르는 단계 id 는 던진다 · 모양이 틀린 파일은 어디가 틀렸는지 말하며 던진다", () => {
  const spec = loadLoopSteps(STEPS_FILE)
  const known = ["signUp", "verifyMail", "signOut", "signIn", "upgrade", "checkout", "billingReturn", "receiptMail", "contact", "inquiryMail", "bookPage", "manageCancel", "bookingMail", "bookDepositPage", "payDeposit", "cancelDeposit", "bookingDepositMail", "addToCart", "checkoutAddress", "payMock", "orderMail", "orderHistory"]
  assert.doesNotThrow(() => assertKnownSteps(spec, known))
  assert.throws(() => assertKnownSteps(spec, known.filter((k) => k !== "checkout")), /payments 단계 「checkout」/)
  assert.throws(() => assertKnownSteps({ ...spec, steps: { ...spec.steps, inquiry: ["contact", "inquiryMial"] } }, known), /inquiryMial/, "오타가 「건너뛴 통과」가 되면 안 된다")
  const dir = mkdtempSync(join(tmpdir(), "lf-loop-steps-"))
  try {
    const write = (name, o) => {
      const f = join(dir, name)
      writeFileSync(f, JSON.stringify(o))
      return f
    }
    const good = JSON.parse(readFileSync(STEPS_FILE, "utf8"))
    assert.throws(() => loadLoopSteps(write("no-mail.json", { ...good, mail: { signup: good.mail.signup } })), /mail\.payments/)
    assert.throws(() => loadLoopSteps(write("extra-mail.json", { ...good, mail: { ...good.mail, ghost: { x: 1 } } })), /mail\.ghost/)
    assert.throws(() => loadLoopSteps(write("zero.json", { ...good, mail: { ...good.mail, signup: { verifyEmail: 0 } } })), /mail\.signup/)
    assert.throws(() => loadLoopSteps(write("empty-steps.json", { ...good, steps: { ...good.steps, inquiry: [] } })), /steps\.inquiry/)
    assert.throws(() => loadLoopSteps(write("bad-requires.json", { ...good, requires: { payments: ["ghost"] } })), /requires\.payments/)
    assert.throws(() => loadLoopSteps(write("bad-selector.json", { ...good, selectors: { ...good.selectors, inquiry: { done: "" } } })), /selectors\.inquiry/)
    assert.throws(() => loadLoopSteps(write("not-object.json", [])), /steps·mail·selectors/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("메일 기록 읽기: 파일 없음 = 0줄 · template 별 개수 · 모양이 틀린 줄은 던진다", () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-loop-outbox-"))
  try {
    const file = join(dir, "outbox.jsonl")
    assert.deepEqual(readOutbox(file), [], "시작 때 파일이 없으면 0줄")
    assert.throws(() => readOutbox(undefined), /SMOKE_OUTBOX/)
    const line = (id, template, to) => JSON.stringify({ id, template, to, subject: "s", at: "2026-10-18T00:00:00.000Z" })
    writeFileSync(file, [line("1", "verifyEmail", "a@example.com"), line("2", "inquiryNotice", "o@example.test"), line("3", "inquiryNotice", "o@example.test"), ""].join("\n"))
    const lines = readOutbox(file)
    assert.equal(lines.length, 3)
    assert.deepEqual(countByTemplate(lines), { verifyEmail: 1, inquiryNotice: 2 })
    writeFileSync(file, `${line("1", "verifyEmail", "a@example.com")}\n{"id":"2"}\n`)
    assert.throws(() => readOutbox(file), /outbox\.jsonl:2/)
    writeFileSync(file, "not json\n")
    assert.throws(() => readOutbox(file))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("loop 선택자는 화면 소스에 실제로 있는 표지를 가리킨다(브라우저 없이 소스 대조)", () => {
  const spec = loadLoopSteps(STEPS_FILE)
  // 선택자 → [소스 파일, ...소스에 있어야 하는 글(문자열 또는 정규식)]. 화면 쪽 표지가 바뀌면 여기서 먼저 빨개진다. 선택자마다 하나씩 있어야 한다
  const SU = "template/components/blocks/auth/sign-up-consents.tsx"
  const SI = "template/components/blocks/auth/sign-in.tsx"
  const NAV = "template/components/blocks/nav/account-bar.tsx"
  const PO = "template/components/blocks/_shared/plan-offer.tsx"
  const BM = "template/components/blocks/account/billing-manage.tsx"
  const CF = "template/components/product/contact-form.tsx"
  const BF = "template/components/product/booking-form.tsx"
  const BMG = "template/components/product/booking-manage.tsx"
  const BR = "template/components/product/booking-receipt.tsx"
  const BDP = "template/components/product/booking-deposit-pay.tsx"
  const ATC = "template/components/product/add-to-cart-confirm.tsx"
  const CKO = "template/components/blocks/cart/checkout-form.tsx"
  const needles = {
    "signup.flow": [SU, 'data-flow="signup" data-step={step}'],
    "signup.email": [SU, '<FormField form={form} name="email"'],
    "signup.password": [SU, '<FormField form={form} name="password"'],
    "signup.next": [SU, /<Button type="submit" size="lg" disabled=\{form\.pending\}[^>]*>\s*\{copy\.next\}/],
    "signup.requiredBoxes": [SU, /<Checkbox id=\{`\$\{id\}-\$\{name\}`\} name=\{name\} data-consent="required"/, /<Checkbox id=\{`\$\{id\}-ageOver14`\} name="ageOver14" data-consent="required"/],
    "signup.submit": [SU, /<SubmitButton form=\{form\} label=\{copy\.submit\}/],
    "signup.finished": [SU, /role="status" className="flex flex-col items-start gap-3">\s*\{emailSent/],
    "shell.accountMenu": [NAV, 'data-slot="session"', "<summary"],
    "shell.signOut": [NAV, /<form method="post" action=\{signOutAction\} data-sign-out=""[^>]*>\s*<button type="submit"/],
    "signin.email": [SI, 'data-block="auth-sign-in"', '<FormField form={form} name="email"'],
    "signin.password": [SI, '<FormField form={form} name="password"'],
    "signin.submit": [SI, /<SubmitButton form=\{form\} label=\{copy\.submit\}/],
    "signin.done": [SI, /\{result \? \(\s*<div role="status"/],
    "payments.planLink": ["template/components/blocks/_shared/plan-cta.tsx", 'DEFAULT_SIGNED_IN_HREF = "/upgrade?plan={plan}"'],
    "payments.withdrawalBox": [PO, /data-terms="consent"[^>]*>\s*<Field[^>]*>\s*<Checkbox/],
    "payments.pay": [PO, 'data-choice="primary"'],
    "payments.paid": ["template/components/blocks/paywall/upgrade-modal.tsx", /\{done \? \(\s*<div role="status"/],
    "payments.billingBlock": [BM, 'data-block="account-billing-manage"', "{copy.none.title}"],
    "payments.billingPlan": [BM, 'data-billing="plan"'],
    "payments.billingPlanText": [BM, /data-billing="plan"[\s\S]{0,400}<dd[^>]*>[\s\S]{0,400}copy\.status\[sub\.status\]/],
    "payments.receipt": ["template/components/product/billing-return.tsx", 'data-block="billing-return"', 'data-receipt=""'],
    "inquiry.contact": [CF, '<FormField form={form} name="contact"'],
    "inquiry.message": [CF, '<Textarea id="contact-message" name="message"'],
    "inquiry.submit": [CF, 'id: "contact"', /<form id=\{form\.formId\}[\s\S]*<SubmitButton form=\{form\}/],
    "inquiry.done": [CF, 'role="status" data-testid="contact-done"'],
    "inquiry.reference": [CF, 'data-testid="contact-reference"'],
    "booking.slot": ["template/components/product/booking-slots.tsx", 'data-testid="book-slot"', 'type="radio"'],
    "booking.name": [BF, '<FormField form={form} name="name"'],
    "booking.contact": [BF, '<FormField form={form} name="contact"'],
    "booking.submit": [BF, 'id: "book"', /<SubmitButton form=\{form\} label=\{copy\.submit\}/],
    "booking.done": ["template/components/product/booking-receipt.tsx", 'data-testid="book-done"'],
    "booking.reference": ["template/components/product/booking-receipt.tsx", 'data-testid="book-reference"'],
    "booking.manageReference": [BMG, '<FormField form={find} name="reference"', 'id: "manage"'],
    "booking.manageContact": [BMG, '<FormField form={find} name="contact"'],
    "booking.manageFind": [BMG, /<SubmitButton form=\{find\} label=\{copy\.find\}/],
    "booking.manageFound": [BMG, 'data-testid="manage-found"'],
    "booking.manageCancel": [BMG, 'data-testid="manage-cancel"'],
    "booking.manageConfirm": [BMG, 'data-testid="manage-confirm"', /<SubmitButton form=\{form\}/],
    "booking.manageResult": [BMG, 'data-testid="manage-result"'],
    "bookingDeposit.serviceSelect": [BF, 'id="book-service"', 'name="service"'],
    "bookingDeposit.serviceOption": [BF, "<NativeSelectOption key={s.id} value={s.id}>"],
    "bookingDeposit.slotsStatus": ["template/components/product/booking-slots.tsx", 'data-testid="book-slots-status"', "data-state={state.status}"],
    "bookingDeposit.formNote": [BF, 'data-testid="book-deposit-note"'],
    "bookingDeposit.pending": [BR, 'data-testid="book-done"', 'data-deposit={receipt.deposit ? (waiting ? "pending" : "paid") : undefined}'],
    "bookingDeposit.pay": [BDP, 'data-testid="book-deposit-pay"', /onClick=\{\(\) => void pay\(\)\}/],
    "bookingDeposit.mockPay": ["template/components/product/mock-pay-panel.tsx", "data-mock-pay", 'data-action="mock-pay"'],
    "bookingDeposit.paid": [BR, 'data-testid="book-done"', '"paid"'],
    "bookingDeposit.manageDeposit": [BMG, "data-testid={`manage-${key}`}", '["deposit", copy.found.deposit'],
    "bookingDeposit.refundNote": [BMG, 'data-testid="manage-refund-note"'],
    "shop.addPath": ["template/app/(product)/cart/page.tsx", "parseAddParam((await searchParams).add)"],
    "shop.addConfirm": [ATC, 'data-testid="shop-add-confirm"', 'data-action="confirm"'],
    "shop.added": [ATC, 'data-testid="shop-added"'],
    "shop.cartLine": ["template/components/blocks/cart/lines-table.tsx", 'data-block="cart-lines-table"', "data-cart-line={line.productId}"],
    "shop.recipient": [CKO, 'data-block="cart-checkout-form"', '<FormField form={form} name="recipient"'],
    "shop.phone": [CKO, '<FormField form={form} name="phone"'],
    "shop.postcode": [CKO, '<FormField form={form} name="postcode"'],
    "shop.address1": [CKO, '<FormField form={form} name="address1"'],
    "shop.pay": [CKO, /<SubmitButton form=\{form\} label=\{fillText\(copy\.submit/, 'action: "place-order"'],
    "shop.mockPay": ["template/components/product/mock-pay-panel.tsx", "data-mock-pay", 'data-action="mock-pay"'],
    "shop.done": [CKO, 'data-checkout="done"'],
    "shop.orderRow": ["template/components/blocks/account/order-history.tsx", 'data-block="account-order-history"', "data-order={order.id}"],
  }
  const named = Object.entries(spec.selectors).flatMap(([g, m]) => Object.keys(m).map((n) => `${g}.${n}`))
  assert.deepEqual([...named].sort(), Object.keys(needles).sort(), "선택자와 소스 대조가 일대일이 아니다")
  for (const [key, [file, ...list]] of Object.entries(needles)) {
    const src = read(file)
    for (const needle of list) assert.ok(typeof needle === "string" ? src.includes(needle) : needle.test(src), `${file} 에 ${needle} 이 없다 — 선택자 ${key} 가 가리킬 표지가 사라졌다`)
  }
  // 가입·로그인이 끝나면 서버가 쪽을 다시 그려 「이미 로그인했어요」 안내로 바뀔 수 있다(signup.finished·signin.done 의 두 번째 갈래)
  for (const [g, key] of [["signup", "finished"], ["signin", "done"]]) assert.ok(spec.selectors[g][key].endsWith(", [data-already-signed-in]"), `${g}.${key} 는 「이미 로그인했어요」 갈래를 받는다`)
  assert.ok(read("template/components/product/already-signed-in.tsx").includes("<section data-already-signed-in"))
  // 폼 id: usePortForm 의 id 에서 `-form` 을 붙여 만든다(form#contact-form)
  assert.ok(read("template/components/blocks/_shared/port-form.tsx").includes("const formId = `${id}-form`"))
  // 로그인 판정은 /account 의 로그인 안내 제목 id (e2e/lib.ts hasSignInPrompt) — 안내 컴포넌트가 그 id 를 만든다
  assert.ok(read("template/components/product/sign-in-required.tsx").includes('id="sign-in-required"'), "sign-in-required-title id 의 뿌리")
  assert.ok(read("template/components/blocks/state-screen/error-retry.tsx").includes("id={`${id}-title`}"))
  // 결제할 요금제: planLink 의 요금제 id 는 mock 요금제 표에 있다
  const planId = /plan=([\w-]+)/.exec(spec.selectors.payments.planLink)?.[1]
  assert.ok(planId, "planLink 선택자에 plan=<id> 가 없다")
  assert.match(read("template/lib/mock-plans.ts"), new RegExp(`id: "${planId}"`), `mock 요금제 표에 ${planId} 가 없다`)
  // 예약금 서비스: serviceOption 의 value 는 예약 설정(견본)의 예약금 있는 서비스 id 다 — mock 에서만 나온다
  const depositId = /value="([\w-]+)"/.exec(spec.selectors.bookingDeposit.serviceOption)?.[1]
  assert.ok(depositId, "bookingDeposit.serviceOption 에 value=<서비스 id> 가 없다")
  assert.match(read("template/lib/launch/booking-config.ts"), new RegExp(`id: "${depositId}"[\\s\\S]{0,200}deposit: \\d+`), `예약 설정에 예약금 있는 서비스 ${depositId} 가 없다`)
  assert.match(read("template/lib/launch/booking-config.ts"), /LF_MODE === "mock" && bookingDepositEnabled\(\)/, "견본 예약금 서비스는 mock 에서 예약금 연결이 있을 때만")
  // 담을 상품: addPath 의 ?add=<id> 는 상품표(lib/launch/catalog.ts)에 있다
  const productId = /^\/cart\?add=([\w-]+)$/.exec(spec.selectors.shop.addPath)?.[1]
  assert.ok(productId, "shop.addPath 는 /cart?add=<상품 id> 꼴이어야 한다")
  assert.match(read("template/lib/launch/catalog.ts"), new RegExp(`id: "${productId}"`), `상품표에 ${productId} 가 없다`)
})

test("loop 화면 글 기대값은 content/copy.en.ts 와 같다 — 결제 관리 상태를 글로 보는 까닭: 블록(billing-manage.tsx)은 잠긴 파일이라 data-* 표지를 더할 수 없다", () => {
  const spec = loadLoopSteps(STEPS_FILE)
  const copy = read("template/content/copy.en.ts")
  const status = /status: \{([^}]*)\}/.exec(copy)?.[1] ?? ""
  const label = (k) => new RegExp(`${k}: "([^"]+)"`).exec(status)?.[1]
  assert.deepEqual(spec.expect.billingStatusAfter, [label("active"), label("trialing")], "결제 뒤 상태 글이 copy.en.ts 의 active·trialing 과 다르다")
  assert.ok(copy.includes(`none: { title: ${JSON.stringify(spec.expect.billingNone)}`), "결제 전 글이 copy.en.ts 의 billingCopy.none.title 과 다르다")
  assert.ok(read("template/components/blocks/account/billing-manage.tsx").includes("copy.status[sub.status]"), "상태 글을 그리는 줄")
  // 결제 뒤 글에 결제 전 글이 섞이지 않는다(서로 다른 글이다)
  assert.ok(!spec.expect.billingStatusAfter.some((t) => spec.expect.billingNone.includes(t)))
})

test("loop 기능은 표(outcomes.generated.json)의 기능 id 이고, requires 는 표와 같다(loop 안에서)", () => {
  const spec = loadLoopSteps(STEPS_FILE)
  const table = JSON.parse(read("features/outcomes.generated.json"))
  const byId = new Map(table.outcomes.map((o) => [o.id, o]))
  const loop = Object.keys(spec.steps)
  for (const f of loop) {
    const o = byId.get(f)
    assert.ok(o, `loop 기능 ${f} 가 features/outcomes.generated.json 에 없다`)
    assert.deepEqual(spec.requires[f] ?? [], o.requires.filter((r) => loop.includes(r)), `${f} 의 requires 가 표와 다르다`)
  }
  // 양성 대조: 표에 payments → signup 이 있다(없으면 위 비교가 비어서 통과한다)
  assert.deepEqual(byId.get("payments").requires, ["signup"])
})

test("planRun: --root 가 다르면 out 은 root 아래, Playwright 는 이 템플릿 폴더 · package.json 없는 root 는 거절 · 잘못된 --root 는 브라우저 없이도 1", async () => {
  const self = join(ROOT, "template")
  const dir = mkdtempSync(join(tmpdir(), "lf-plan-root-"))
  try {
    const none = planRun({ root: null }, { self })
    assert.deepEqual(none, { root: self, out: join(self, ".tmp", "smoke"), playwrightCwd: self })
    writeFileSync(join(dir, "package.json"), "{}")
    const other = planRun({ root: dir }, { self })
    assert.equal(other.root, resolve(dir))
    assert.equal(other.out, join(resolve(dir), ".tmp", "smoke"))
    assert.equal(other.playwrightCwd, self, "시험은 늘 이 템플릿 폴더 것")
    assert.notEqual(other.root, other.playwrightCwd)
    const empty = mkdtempSync(join(tmpdir(), "lf-plan-empty-"))
    try {
      assert.throws(() => planRun({ root: empty }, { self }), /package\.json 이 없다/)
      assert.throws(() => planRun({ root: join(empty, "nope") }, { self }), /package\.json 이 없다/)
      // main 은 브라우저·Playwright 를 보기 전에 거절하고 1 로 끝낸다(3 = 브라우저 없음 과 섞이지 않는다)
      const log = console.log
      console.log = () => {}
      try {
        assert.equal(await main(["--mode", "loop", "--root", empty]), 1)
      } finally {
        console.log = log
      }
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── CI 가 ci:verify 단계 전체를 덮는다 ────────────────────────────────────────────────────

/** 워크플로 글에서 verify·build-smoke 작업의 규칙을 점검해 문제 목록을 돌려준다 */
function smokeJobProblems(text, { name }) {
  const problems = []
  const jobs = text.split(/^ {2}(?=[a-z][\w-]*:\s*$)/m)
  const verify = jobs.find((j) => /^verify:/.test(j))
  const smoke = jobs.find((j) => /^build-smoke:/.test(j))
  if (!verify) problems.push(`${name}: verify 작업이 없다`)
  else if (!/run: npm run ci:verify -- --skip smoke\b/.test(verify)) problems.push(`${name}: verify 작업이 「--skip smoke」 로 스모크를 따로 돌리지 않는다(둘 다 돌면 분이 두 배, 둘 다 안 돌면 구멍)`)
  if (!smoke) problems.push(`${name}: build-smoke 작업이 없다`)
  else {
    if (!/needs: verify\b/.test(smoke)) problems.push(`${name}: build-smoke 는 verify 뒤에 돌아야 한다(needs: verify)`)
    if (!/run: npx playwright install --with-deps chromium/.test(smoke)) problems.push(`${name}: build-smoke 가 Playwright 브라우저를 설치하지 않는다`)
    if (!/run: npm run ci:verify -- --only smoke\b/.test(smoke)) problems.push(`${name}: build-smoke 가 smoke 단계를 돌리지 않는다`)
    if (!/actions\/upload-artifact@[0-9a-f]{40}/.test(smoke) || !/failure\(\)/.test(smoke)) problems.push(`${name}: build-smoke 가 실패 때 보고서·추적을 올리지 않는다`)
    if (!/timeout-minutes: \d+/.test(smoke)) problems.push(`${name}: build-smoke 에 timeout-minutes 가 없다`)
  }
  return problems
}

const WORKFLOWS = ["../.github/workflows/launch-factory-ci.yml", "template/.github/workflows/ci.yml", "../.github/workflows/launch-product-ci.yml"]

test("CI: verify 작업은 smoke 만 빼고, build-smoke 작업이 smoke 를 돈다 — 합치면 ci:verify 전체", () => {
  for (const f of WORKFLOWS) assert.deepEqual(smokeJobProblems(read(f), { name: f }), [])
  for (const [label, steps] of [["launch-factory", ROOT_STEPS], ["제품 템플릿", TEMPLATE_STEPS]]) {
    assert.ok(steps.some((s) => s.id === "smoke"), `${label} ci:verify 에 smoke 단계가 없다`)
    assert.equal(steps.filter((s) => s.id === "smoke").length, 1)
  }
})

test("CI 양성 대조: build-smoke 를 지우거나 verify 의 --skip 을 빼면 잡는다", () => {
  const ci = read("../.github/workflows/launch-factory-ci.yml")
  const noSkip = ci.replace("npm run ci:verify -- --skip smoke", "npm run ci:verify")
  assert.ok(smokeJobProblems(noSkip, { name: "x" }).some((p) => /--skip smoke/.test(p)))
  const noJob = ci.slice(0, ci.indexOf("  build-smoke:")) // 작업 통째로 삭제
  assert.ok(smokeJobProblems(noJob, { name: "x" }).some((p) => /build-smoke 작업이 없다/.test(p)))
  const noInstall = ci.replace("run: npx playwright install --with-deps chromium", "run: echo skip")
  assert.ok(smokeJobProblems(noInstall, { name: "x" }).some((p) => /브라우저를 설치하지/.test(p)))
  const noNeeds = ci.replace("    needs: verify\n", "")
  assert.ok(smokeJobProblems(noNeeds, { name: "x" }).some((p) => /needs: verify/.test(p)))
})

test("Playwright 설정: workers 1 · retries 1 · forbidOnly, 의존성은 정확한 판 고정", () => {
  const cfg = read("template/playwright.config.ts")
  assert.match(cfg, /workers: 1,/)
  assert.match(cfg, /retries: 1,/)
  assert.match(cfg, /forbidOnly: true,/)
  assert.match(cfg, /name: "loop", testMatch: "loop\.mock\.spec\.ts", retries: 0/, "loop 프로젝트는 재시도하지 않는다 — 재시도는 메일 기록을 두 번 쓴다")
  const pkg = JSON.parse(read("template/package.json"))
  for (const n of ["@playwright/test", "@axe-core/playwright"]) assert.match(pkg.devDependencies[n] ?? "", /^\d+\.\d+\.\d+$/, `${n} 는 정확한 판으로 고정한다`)
  assert.ok(!pkg.dependencies["@playwright/test"], "브라우저 시험 도구는 devDependencies 다")
})

test("a11y 기준선 파일 모양", () => {
  const j = JSON.parse(read("template/e2e/a11y-known.json"))
  assert.ok(Array.isArray(j.known))
  for (const k of j.known) assert.match(k, /^\/[^|]*\|[^|]+\|[a-z0-9-]+$/, `키 모양이 다르다: ${k}`)
  assert.deepEqual([...j.known], [...j.known].sort(), "정렬돼 있어야 diff 가 읽힌다")
})
