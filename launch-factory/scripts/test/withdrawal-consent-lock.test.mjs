// C256·D230: 결제 시작은 언제나 청약철회 제한 동의(withdrawalConsent)를 요구한다 — LF 에는 「동의를 빼는」 정책 값이 없다.
// web-factory 06 이 legal.withdrawalPolicy = "full" 로 결제 블록의 고지·체크를 빼면 블록은 checkout({ planId }) 만 부른다(plan-offer.tsx: copy.withdrawal 없음 → onCheckout({})).
// 그 호출이 서버에서 기계 값(code invalid_input · retryable false · fieldErrors.withdrawalConsent)으로 거절되고, 결제 포트(= Paddle·Gumroad 거래 만들기)도
// 동의 기록도 만들지 않는지를 UI 가 실제로 부르는 길(product.ts → ports.live.ts)과 서버 액션 입구(billing.ts·gumroad-billing.ts)에서 본다. 업그레이드 대화상자의 문구가 늘 고지·체크를 싣는지도 본다.
// 진짜 서버 액션·진짜 어댑터(withWithdrawalConsent)·진짜 PGlite 이고 세션·결제 포트·설정만 대역이다(registry-glue).
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { registerHooks } from "node:module"
import { join, relative } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { eq } from "drizzle-orm"
import { consentRecords, db, user as userTable } from "@launch-factory/db"
import { MESSAGES } from "@launch-factory/i18n"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const T = join(ROOT, "template")

// `@/…`(앱 별칭, lib/launch/* 제외)를 template/ 로 풀어 준다 — product.ts·lib/ports.ts 를 진짜 파일로 불러오려는 것
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx)
    const m = /^@\/(.+)$/.exec(spec)
    if (!m || m[1].startsWith("lib/launch/")) return next(spec, ctx)
    for (const cand of [`${m[1]}.ts`, `${m[1]}.tsx`, `${m[1]}/index.ts`, m[1]]) {
      const abs = join(T, cand)
      if (existsSync(abs) && statSync(abs).isFile() && /\.tsx?$/.test(abs)) return next(pathToFileURL(abs).href, ctx)
    }
    return next(spec, ctx)
  },
})
installGlueStubs({
  auth: ["authPort"],
  billing: ["billing"],
  gumroad: ["gumroad"],
  config: ["DEFAULT_LOCALE"],
  db: ["database"],
  env: ["env", "required"],
  "paddle-plans": ["PLANS"],
  security: ["guardAction"],
})

const at = new Date("2026-09-30T00:00:00.000Z")
let d
let calls = []
let session = null
const fakePort = () => new Proxy({}, { get: (_t, m) => (m === "then" ? undefined : async (arg) => (calls.push([String(m), arg]), { ok: true, data: { redirectUrl: `https://pay.example/${String(m)}` } })) })
const consentRows = async () => (await d.select().from(consentRecords).where(eq(consentRecords.userId, "payer"))).length

before(async () => {
  d = await db.local()
  await d.insert(userTable).values({ id: "payer", name: "x", email: "payer@example.com", emailVerified: true, createdAt: at, updatedAt: at })
  stubs.config = { DEFAULT_LOCALE: "en" }
  stubs["paddle-plans"] = { PLANS: [] }
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: "live" }), required: (n) => `x-${n}` }
  stubs.auth = { authPort: async () => ({ session: async () => ({ ok: true, data: session }), methods: async () => ({ ok: true, data: [] }) }) }
  stubs.billing = { billing: async () => ({ port: () => fakePort() }) }
  stubs.gumroad = { gumroad: async () => ({ port: () => fakePort() }) }
  stubs.security = { guardAction: async () => null } // 요청 제한은 checkout-guard-glue.test.mjs 가 본다
  session = { userId: "payer", email: "payer@example.com" }
})
after(async () => {
  await d?.$client.close()
})

/** 체크가 없는(또는 참이 아닌) 입력들 — 「full 정책」 블록이 보내는 {planId} 만 있는 호출을 포함한다 */
const WITHOUT_CONSENT = [{ planId: "pro" }, { planId: "pro", withdrawalConsent: false }, { planId: "pro", withdrawalConsent: undefined }, { planId: "pro", withdrawalConsent: null }, { planId: "pro", withdrawalConsent: "no" }, { planId: "pro", withdrawalConsent: 0 }]

function assertRefused(r, label) {
  assert.equal(r.ok, false, `${label}: 결제가 열렸다`)
  assert.equal(r.code, "invalid_input", label)
  assert.equal(r.retryable, false, label)
  assert.deepEqual(r.fieldErrors?.withdrawalConsent, [MESSAGES.en.checkout.withdrawal.consentRequired], label)
}

test("C256·D230 UI 가 부르는 길(product.checkout → ports.live): 동의 없는 결제 시작은 기계 값으로 거절되고 결제 포트·동의 기록이 없다 — 동의가 있으면 열린다(양성 대조)", async () => {
  const product = await import(pathToFileURL(join(T, "app", "actions", "product.ts")).href)
  calls = []
  const rows = await consentRows()
  for (const input of WITHOUT_CONSENT) assertRefused(await product.checkout(input), JSON.stringify(input))
  assert.deepEqual(calls, [], "거절된 요청이 결제 포트(거래 만들기)를 불렀다")
  assert.equal(await consentRows(), rows, "거절된 요청에 동의 기록이 남았다")
  // 폼으로 온 경우(체크 칸이 아예 없음)도 같다
  const form = new FormData()
  form.set("planId", "pro")
  assertRefused(await product.checkout(form), "FormData")
  assert.deepEqual(calls, [])
  // 양성 대조
  const ok = await product.checkout({ planId: "pro", withdrawalConsent: true })
  assert.deepEqual(ok, { ok: true, data: { redirectUrl: "https://pay.example/checkout" } })
  assert.deepEqual(calls, [["checkout", { planId: "pro" }]], "결제 포트에는 계약 칸만 간다")
  assert.equal(await consentRows(), rows + 1)
})

test("C256·D230 업그레이드 대화상자 경로: 대화상자·화면이 부르는 서버 액션은 product.checkout 하나이고, 대화상자 문구가 늘 고지·체크 글을 싣는다", async () => {
  const page = readFileSync(join(T, "app", "(product)", "upgrade", "page.tsx"), "utf8")
  assert.match(page, /import \{[^}]*\bcheckout\b[^}]*\} from "@\/app\/actions\/product"/, "업그레이드 화면이 부르는 checkout 은 product.ts 의 것이다(위 시험이 그 길을 본다)")
  assert.match(page, /checkout=\{checkout\}/)
  const { upgradeCopy } = await import(pathToFileURL(join(T, "content", "copy.en.ts")).href)
  const w = upgradeCopy.offer.withdrawal
  assert.ok(w, "대화상자 문구에 withdrawal 칸이 없으면 블록이 고지·체크를 그리지 않는다(= 동의 없이 결제를 시작한다)")
  for (const k of ["notice", "consentLabel", "consentRequired"]) assert.ok(typeof w[k] === "string" && w[k].trim().length > 10, `withdrawal.${k}`)
  // 블록이 체크 없이 부르면 거절된다는 것은 위 시험이, 체크를 안 받는 블록(copy.withdrawal 없음)은 빈 칸 객체로 checkout 을 부른다는 사실은 블록 코드가 보인다
  const block = readFileSync(join(T, "components", "blocks", "_shared", "plan-offer.tsx"), "utf8")
  assert.match(block, /if \(!withdrawal\) \{\s*onCheckout\(\{\}\)/)
})

test("C256·D230 서버 액션 입구(billing.ts startCheckout · gumroad-billing.ts startGumroadCheckout): 같은 거절 — 결제 포트·동의 기록 없음", async () => {
  const paddle = await importRegistryFile("feature-billing-paddle/files/app/actions/billing.ts")
  const gumroad = await importRegistryFile("feature-billing-gumroad/files/app/actions/gumroad-billing.ts")
  calls = []
  const rows = await consentRows()
  for (const input of WITHOUT_CONSENT) {
    assertRefused(await paddle.startCheckout(input), `paddle ${JSON.stringify(input)}`)
    assertRefused(await gumroad.startGumroadCheckout(input), `gumroad ${JSON.stringify(input)}`)
  }
  assert.deepEqual(calls, [])
  assert.equal(await consentRows(), rows)
  assert.equal((await paddle.startCheckout({ planId: "pro", withdrawalConsent: true })).ok, true)
  assert.equal((await gumroad.startGumroadCheckout({ planId: "pro", withdrawalConsent: true })).ok, true)
  assert.equal(calls.length, 2)
  assert.equal(await consentRows(), rows + 2)
})

test("C256·D230 동의를 끄는 설정 값이 없다: 서버 코드(packages·template/app·template/lib)에 withdrawalPolicy 를 읽는 곳이 없다", () => {
  const found = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", "test"].includes(name)) continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && /withdrawalPolicy/.test(readFileSync(p, "utf8"))) found.push(relative(ROOT, p).split("\\").join("/"))
    }
  }
  for (const dir of [join(ROOT, "packages"), join(T, "app"), join(T, "lib")]) walk(dir)
  assert.deepEqual(found, [])
})
