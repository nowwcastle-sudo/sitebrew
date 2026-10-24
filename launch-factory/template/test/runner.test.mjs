// LFRUNNER 시험 — mock 모드 세션 장면(web-factory G1 계약 `wf_session`)과 화면 관문 러너(scripts/template-screens/)의 순수 부분. 빌드·서버·Chrome 없이 돈다.
// 실제 화면 관문은 `npm run template:screens` 가 서버를 띄워 돌린다(docs/qa/template-screens.md).
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { registerHooks } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

// `@/…` 별칭을 파일로 푼다(Next 가 tsconfig paths 로 하는 일) + next/headers 는 확장자 있는 이름으로
// 쿼리에 ?spy-mailer 가 붙은 mailer.ts 사본만 @launch-factory/email 대신 염탐용 모듈을 받는다 — createMailer 가 받은 옵션을 globalThis 에 남긴다
const SPY_MAILER = "data:text/javascript," + encodeURIComponent('export const createMailer = (options) => { globalThis.__lfMailerOptions = options; return { mode: "mock", send: async () => ({ ok: true, mode: "mock", id: "spy_1" }) } }')
registerHooks({
  resolve: (spec, ctx, next) => {
    if (spec === "@launch-factory/email" && ctx.parentURL?.includes("?spy-mailer")) return { url: SPY_MAILER, shortCircuit: true }
    if (spec.startsWith("@/")) {
      for (const ext of [".ts", "/index.ts"]) {
        const file = join(T, spec.slice(2) + ext)
        if (existsSync(file)) return next(pathToFileURL(file).href, ctx)
      }
    }
    return next(spec === "next/headers" ? "next/headers.js" : spec === "next/server" ? "next/server.js" : spec, ctx)
  },
})

const { parseMockScene, effectiveScene, SCENE_SUBS, SCENE_COOKIE } = await import("../lib/mock-scene.ts")
const { buildMockPorts } = await import("../lib/mock-ports.ts")

const ports = (raw, defaultSub = "active", getName = () => undefined) => buildMockPorts({ scene: parseMockScene(raw), defaultSub, getName })

// ── 장면 계약(web-factory docs/qa/p3-6-uxgates.md §2) ─────────────────────────────────────

test("쿠키 이름과 구독 상태 표가 web-factory 목 어댑터와 같다", () => {
  assert.equal(SCENE_COOKIE, "wf_session")
  const src = read("components/contract/adapter-mock.ts")
  const list = (name) => [...new RegExp(`export const ${name} = \\[([^\\]]+)\\]`).exec(src)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual([...SCENE_SUBS], [...list("MOCK_SUBS"), ...list("MOCK_SUB_SCENARIOS")])
})

test("장면 문자열 해석 — 정규화·이어 쓰기·쿠키 없음", () => {
  assert.equal(parseMockScene(undefined), null)
  assert.equal(parseMockScene(""), null)
  assert.deepEqual(parseMockScene("signed-out"), { signedIn: false, verified: false, sub: null, canonical: "signed-out" })
  assert.deepEqual(parseMockScene("signed-in"), { signedIn: true, verified: true, sub: null, canonical: "signed-in" })
  assert.deepEqual(parseMockScene(encodeURIComponent("signed-in:sub=past_due")), { signedIn: true, verified: true, sub: "past_due", canonical: "signed-in:sub=past_due" })
  assert.equal(parseMockScene("signed-in:sub=past_due").canonical, "signed-in:sub=past_due", "Next 가 이미 풀어 준 값도 같다")
  assert.deepEqual(parseMockScene("signed-in:unverified"), { signedIn: true, verified: false, sub: null, canonical: "signed-in:unverified" })
  // 이어 쓰기는 순서와 상관없이 같은 정규형
  assert.equal(parseMockScene("signed-in:sub=trialing:unverified").canonical, "signed-in:unverified:sub=trialing")
  assert.equal(parseMockScene("signed-in:unverified:sub=trialing").canonical, "signed-in:unverified:sub=trialing")
  for (const sub of SCENE_SUBS) assert.equal(parseMockScene(`signed-in:sub=${sub}`).sub, sub)
})

test("모르는 장면은 로그아웃이다 — 오타·위조가 로그인 화면을 만들지 않는다", () => {
  for (const bad of ["admin", "signed-in:sub=gold", "signed-in:root", "signed-out:sub=active", "signed-in:", "%E0%A4%A", "SIGNED-IN", "signed-in:sub=active;admin"]) {
    const s = parseMockScene(bad)
    assert.equal(s?.signedIn, false, `${bad} → ${JSON.stringify(s)}`)
    assert.equal(s?.canonical, "signed-out")
  }
})

// ── 장면 → 목 포트(실제 어댑터를 돌린다) ───────────────────────────────────────────────

test("signed-out 장면 — 세션 없음", async () => {
  const p = ports("signed-out")
  assert.deepEqual(await p.auth.session(), { ok: true, data: null })
})

test("signed-in 장면 — 이메일 확인된 목 사용자, 구독은 앱 기본값", async () => {
  const p = ports("signed-in", "trialing")
  const s = await p.auth.session()
  assert.ok(s.ok && s.data)
  assert.equal(s.data.email, "kim@example.com")
  assert.equal(s.data.emailVerified, true)
  const sub = await p.billing.subscription()
  assert.ok(sub.ok)
  assert.equal(sub.data.status, "trialing", "장면이 구독을 안 정하면 앱 기본값(LF_MOCK_SUB)")
})

test("signed-in:sub=<상태> 장면 — 구독 상태가 장면을 따른다(앱 기본값보다 앞선다)", async () => {
  for (const sub of ["past_due", "canceled", "paused", "none", "expired", "trialing"]) {
    const r = await ports(`signed-in:sub=${sub}`, "active").billing.subscription()
    assert.ok(r.ok, sub)
    assert.equal(r.data.status, sub)
  }
  const pending = await ports("signed-in:sub=pending-price-change").billing.subscription()
  assert.ok(pending.ok && pending.data.pendingPriceChange, "가격 변경 장면은 동의를 기다리는 변경이 있다")
})

test("signed-in:unverified 장면 — 이메일 확인 전 사용자", async () => {
  const s = await ports("signed-in:unverified").auth.session()
  assert.ok(s.ok && s.data)
  assert.equal(s.data.emailVerified, false)
})

test("장면이 없으면 기존 동작 — 로그아웃에서 시작하고 로그인이 이어진다, 구독은 LF_MOCK_SUB", async () => {
  const p = ports(undefined, "past_due")
  assert.deepEqual(await p.auth.session(), { ok: true, data: null })
  assert.equal((await p.billing.subscription()).data.status, "past_due")
  const r = await p.auth.signIn({ method: "password", email: "a@b.co", password: "pw-pw-pw-pw" })
  assert.ok(r.ok)
  assert.ok((await p.auth.session()).data, "장면 없는 포트는 로그인 상태를 기억한다")
})

test("장면 포트는 요청마다 새로 만든다 — 한 장면의 로그아웃이 다음 요청을 오염시키지 않는다", async () => {
  const a = ports("signed-in")
  await a.auth.signOut()
  assert.equal((await a.auth.session()).data, null)
  assert.ok((await ports("signed-in").auth.session()).data, "새 요청은 다시 로그인한 장면")
})

test("LF_MOCK_SCENES — 쿠키 없는 요청: 기본은 기존 동작(null), 러너 모드는 로그아웃 장면(계약: 쿠키 없음 = 로그아웃)", async () => {
  assert.equal(effectiveScene(null, false), null)
  const out = effectiveScene(null, true)
  assert.equal(out.signedIn, false)
  assert.equal(out.canonical, "signed-out")
  // 쿠키가 있으면 모드와 상관없이 쿠키의 장면
  const inScene = parseMockScene("signed-in:sub=paused")
  assert.equal(effectiveScene(inScene, true), inScene)
  assert.equal(effectiveScene(inScene, false), inScene)
  // 러너 모드의 로그아웃 요청은 앞 요청의 로그인에 오염되지 않는다(요청마다 새 포트)
  const a = buildMockPorts({ scene: out, defaultSub: "active", getName: () => undefined })
  await a.auth.signIn({ method: "password", email: "a@b.co", password: "pw-pw-pw-pw" })
  assert.ok((await a.auth.session()).data, "한 요청 안에서는 로그인이 된다")
  const b = buildMockPorts({ scene: effectiveScene(null, true), defaultSub: "active", getName: () => undefined })
  assert.equal((await b.auth.session()).data, null, "다음 요청은 다시 로그아웃")
})

test("F6 mock 사용자 이름은 영어 화면 언어다 — 장면 있음·없음 모두 한글이 없다(qa:lang)", async () => {
  const scened = (await ports("signed-in").auth.session()).data
  assert.equal(scened.name, "Alex Example")
  const plain = buildMockPorts({ scene: null, defaultSub: "active", getName: () => undefined })
  await plain.auth.signIn({ method: "password", email: "alex@example.com", password: "pw-pw-pw-pw" })
  const after = (await plain.auth.session()).data
  assert.equal(after.name, "Alex Example")
  assert.doesNotMatch(JSON.stringify([scened, after]), /[ㄱ-ㆎ가-힣]/, "세션에 한글이 없다")
  assert.equal((await ports("signed-in:unverified").auth.session()).data.emailVerified, false, "확인 전 장면은 그대로")
})

test("계정 화면이 저장한 이름은 장면 세션에도 덮어 보인다", async () => {
  const s = await ports("signed-in", "active", () => "Pat").auth.session()
  assert.equal(s.data.name, "Pat")
})

// ── mock 메일(LF_MOCK_OUTBOX 시험 배선) ─────────────────────────────────────────────────

const recordingMail = () => {
  const sent = []
  return { sent, mail: { mode: "mock", send: async (request) => (sent.push(request), { ok: true, mode: "mock", id: `mock_${sent.length}` }) } }
}
const withMail = (mail, defaultSub = "none") => buildMockPorts({ scene: null, defaultSub, getName: () => undefined, mail })
const SIGN_UP = { method: "password", email: "new-person@example.com", password: "correct horse battery", consents: { terms: true, privacy: true, ageOver14: true, marketing: {} } }

test("mock 메일: mail 을 주면 가입 성공 뒤 verifyEmail 한 통, 결제 성공 뒤 orderConfirmation 한 통 — 받는 사람은 목 세션 이메일", async () => {
  const { sent, mail } = recordingMail()
  const p = withMail(mail)
  assert.equal((await p.auth.signUp(SIGN_UP)).ok, true)
  assert.deepEqual(sent.map((r) => r.template), ["verifyEmail"])
  assert.equal((await p.billing.checkout({ planId: "pro", trial: false, withdrawalConsent: true })).ok, true)
  assert.deepEqual(sent.map((r) => [r.template, r.to]), [["verifyEmail", "kim@example.com"], ["orderConfirmation", "kim@example.com"]])
})

test("mock 메일: 거절된 가입·결제는 메일을 보내지 않고, mail 이 없으면 아무 일도 없다", async () => {
  const { sent, mail } = recordingMail()
  const p = withMail(mail)
  assert.equal((await p.auth.signUp({ ...SIGN_UP, email: "taken@example.com" })).ok, false)
  assert.equal((await p.billing.checkout({ planId: "pro" })).ok, false, "청약철회 동의가 없으면 거절")
  assert.equal((await p.billing.checkout({ planId: "nope", withdrawalConsent: true })).ok, false)
  assert.deepEqual(sent, [])
  const bare = buildMockPorts({ scene: null, defaultSub: "none", getName: () => undefined })
  assert.equal((await bare.auth.signUp(SIGN_UP)).ok, true)
})

test("mock 메일러: LF_MOCK_OUTBOX 가 빈 문자열이면 mailer 는 outbox 를 undefined 로 넘기고 파일을 만들지 않는다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-empty-outbox-"))
  const cwd = process.cwd()
  const saved = { LF_MODE: process.env.LF_MODE, LF_MOCK_OUTBOX: process.env.LF_MOCK_OUTBOX }
  process.env.LF_MODE = "mock"
  process.env.LF_MOCK_OUTBOX = ""
  delete globalThis.__lfMailerOptions
  try {
    process.chdir(dir) // 빈 경로가 상대 경로로 새어 파일이 생기면 여기서 보인다
    const { mailer } = await import("../lib/launch/mailer.ts?spy-mailer") // mailer() 는 처음 만든 것을 기억하므로 새 모듈 사본 + 염탐 메일 모듈
    const p = withMail(mailer())
    assert.equal((await p.auth.signUp(SIGN_UP)).ok, true)
    assert.ok(globalThis.__lfMailerOptions, "createMailer 가 불렸다")
    assert.equal(globalThis.__lfMailerOptions.outbox, undefined, "빈 문자열이 아니라 undefined")
    assert.deepEqual(readdirSync(dir), [], "outbox 파일도 폴더도 없다")
  } finally {
    process.chdir(cwd)
    delete globalThis.__lfMailerOptions
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    rmSync(dir, { recursive: true, force: true })
  }
})

test("mock 메일러: LF_MOCK_OUTBOX 파일이 있으면 가입 확인 메일이 한 줄로 남는다(ports.ts 가 부르는 mailer())", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-outbox-"))
  const file = join(dir, "outbox.jsonl")
  const saved = { LF_MODE: process.env.LF_MODE, LF_MOCK_OUTBOX: process.env.LF_MOCK_OUTBOX }
  process.env.LF_MODE = "mock"
  process.env.LF_MOCK_OUTBOX = file
  try {
    const { mailer } = await import("../lib/launch/mailer.ts")
    const p = withMail(mailer())
    assert.equal((await p.auth.signUp(SIGN_UP)).ok, true)
    const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l))
    assert.deepEqual(lines.map((l) => [l.template, l.to]), [["verifyEmail", "kim@example.com"]])
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── live 는 쿠키를 읽지 않는다(위조 방지) ──────────────────────────────────────────────

test("운영(live) 빌드는 장면 쿠키를 읽지 않는다 — 모드를 먼저 본다", () => {
  const ports = read("lib/ports.ts")
  const fn = /export async function currentMockScene\(\)[\s\S]*?\r?\n}\r?\n/.exec(ports)[0]
  assert.ok(fn.indexOf('productMode() !== "mock"') >= 0 && fn.indexOf('productMode() !== "mock"') < fn.indexOf("cookies()"), "cookies() 보다 앞서 mock 모드를 확인해야 한다")
  assert.match(read("app/layout.tsx"), /e\.LF_MODE === "mock" \? await currentMockScene\(\) : null/, "표지(data-wf-session)도 mock 에서만")
  assert.ok(!/cookies|wf_session|SCENE_COOKIE/.test(read("lib/ports.live.ts")), "live 포트는 장면을 모른다")
})

test("mock 이어도 LF_MOCK_SCENES=1 이 아니면 장면 쿠키를 읽지 않는다 — 쿠키 하나로 유료 구독자가 되지 않는다(E1)", () => {
  const ports = read("lib/ports.ts")
  const fn = /export async function currentMockScene\(\)[\s\S]*?\r?\n}\r?\n/.exec(ports)[0]
  const gate = fn.indexOf('process.env.LF_MOCK_SCENES !== "1"')
  assert.ok(gate >= 0, "LF_MOCK_SCENES 확인이 있다")
  assert.ok(gate < fn.indexOf("cookies()"), "cookies() 보다 앞서 확인한다")
  assert.ok(gate > fn.indexOf('productMode() !== "mock"'), "모드 확인 뒤, 쿠키 읽기 앞")
})

test("live 모드에서 currentMockScene 은 null — 쿠키를 읽지 않는다(실행)", async () => {
  const env = { ...process.env }
  process.env.LF_MODE = "live"
  try {
    // live 는 환경 검사가 모든 키를 요구해 env() 가 던진다 — 던지든 null 이든 장면(세션 위조)이 나오지 않아야 한다
    const { currentMockScene } = await import("../lib/ports.ts")
    const scene = await currentMockScene().catch(() => "threw")
    assert.ok(scene === null || scene === "threw", `live 인데 장면이 나왔다: ${JSON.stringify(scene)}`)
  } finally {
    process.env = env
  }
})
