// @launch-factory/auth — 적합성(web-factory authConformance)·2단계 끔/켬·카카오 무이메일 규칙·요청 제한 DB 저장·동의·D26 (v0 Task 4).
// DB는 PGlite 메모리 하나를 파일 전체가 같이 쓴다. 네트워크는 쓰지 않는다(카카오 응답은 fetch 가짜).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { consentRecords, db, marketingConsents, session as sessionTable, user as userTable } from "@launch-factory/db"
import {
  AUTH_MESSAGES,
  authActions,
  authAdapter,
  createAuth,
  formToObject,
  kakaoPlaceholderEmail,
  LAST_METHOD_COOKIE,
  lastSignInMethod,
  normalizeConsents,
  safeRedirect,
  SESSION_DEFAULTS,
  withMachineCodes,
} from "../src/index.ts"
import { loadWfConformance } from "../../../scripts/lib/wf-conformance.mjs"
import { AUTH_PINS, runAuthConformance } from "./conformance-run.mjs"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"

// web-factory 적합성 묶음은 시험에서만 가져온다(계약 잠금 D10은 건드리지 않는다). 다른 패키지와 같은 로더가 한 커밋에 고정해 꺼낸다(대장 D195).
const wf = await loadWfConformance()
if (!wf.skip) process.on("exit", () => wf.cleanup())

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
/** @type {Awaited<ReturnType<typeof db.local>>} */
let broken
let ipSeq = 0
const nextIp = () => `203.0.113.${++ipSeq}`
let emailSeq = 0
const nextEmail = () => `user${++emailSeq}@example.com`

before(async () => {
  d = await db.local()
  broken = await db.local()
  await broken.$client.close() // 「백엔드가 응답하지 않는」 장면용
})
after(async () => {
  await d?.$client.close()
})

/** 브라우저 한 개 흉내: 쿠키 병 + 고정 IP. headers() 는 setCookies 를 곧바로 반영한다 */
function memoryIO(ip = nextIp()) {
  const jar = new Map()
  const log = []
  return {
    ip,
    jar,
    log,
    headers() {
      const h = new Headers({ "x-forwarded-for": this.ip, "user-agent": "lf-test" })
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      log.push(...list)
      for (const line of list) {
        const [pair, ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === ""
        if (expired) jar.delete(name)
        else jar.set(name, value)
      }
    },
  }
}

const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const baseOptions = (extra = {}) => ({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: CONSENT_VERSIONS, ...extra })
const quiet = { onError: () => {} }

/** RFC 6238 TOTP(SHA-1, 6자리, 30초). secret 은 otpauth URI 의 base32 */
function totp(base32, step = Math.floor(Date.now() / 30000)) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0")
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = createHmac("sha1", key).update(msg).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

async function raw(auth, io, method, path, body) {
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  if (body) headers.set("content-type", "application/json")
  const res = await auth.handler(new Request(BASE_URL + "/api/auth" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  io.setCookies(res.headers.getSetCookie())
  return res
}

const consents = { terms: true, privacy: true, ageOver14: true }

test(`web-factory authConformance 를 통과한다(가져온 계약 — 고정 커밋 ${wf.commit ?? "?"})`, { skip: wf.skip ?? false }, async () => {
  const { results } = await runAuthConformance({ mod: wf.auth })
  assert.equal(results.length, AUTH_PINS.total)
  assert.deepEqual(results.filter((r) => !r.ok), [])
})

test("2단계를 끈 설정에서 verifyTwoFactor(totp·backup-code)는 정해진 오류다 — 요청을 보내지 않는다", async () => {
  const auth = createAuth(baseOptions())
  let calls = 0
  const spy = { handler: (r) => (calls++, auth.handler(r)), options: auth.options }
  const port = authAdapter(spy, memoryIO(), quiet)
  for (const method of [undefined, "totp", "backup-code"]) {
    assert.deepEqual(await port.verifyTwoFactor({ code: "123456", method }), { ok: false, formError: AUTH_MESSAGES.twoFactorDisabled })
  }
  assert.equal(calls, 0)
})

test("2단계를 켠 설정: 비밀번호 → needsTwoFactor → TOTP·백업 코드·trustDevice", async () => {
  const auth = createAuth(baseOptions({ twoFactor: true, appName: "LF Test" }))
  const email = nextEmail()
  const io = memoryIO()
  const port = authAdapter(auth, io, quiet)
  assert.ok((await port.signUp({ method: "password", email, password: PASSWORD, consents })).ok)

  const enable = await raw(auth, io, "POST", "/two-factor/enable", { password: PASSWORD })
  assert.equal(enable.status, 200)
  const { totpURI, backupCodes } = await enable.json()
  const secret = new URL(totpURI).searchParams.get("secret")
  const step = Math.floor(Date.now() / 30000)
  const confirm = await port.verifyTwoFactor({ code: totp(secret, step) })
  assert.ok(confirm.ok, JSON.stringify(confirm))
  assert.equal(confirm.data.twoFactor, true)

  // 새 브라우저: 비밀번호만으로는 세션이 없다
  const io2 = memoryIO()
  const port2 = authAdapter(auth, io2, quiet)
  assert.deepEqual(await port2.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: { needsTwoFactor: true } })
  assert.deepEqual(await port2.session(), { ok: true, data: null })
  const wrong = await port2.verifyTwoFactor({ code: "000000" === totp(secret, step + 1) ? "111111" : "000000" })
  assert.deepEqual(wrong, { ok: false, fieldErrors: { code: [AUTH_MESSAGES.invalidCode] } })
  const ok = await port2.verifyTwoFactor({ code: totp(secret, step + 1), trustDevice: true, redirectTo: "/after-2fa" })
  assert.ok(ok.ok, JSON.stringify(ok))
  assert.equal(ok.data.twoFactor, true)
  assert.equal(ok.data.redirectUrl, "/after-2fa")
  assert.equal(lastSignInMethod(io2.headers()), "password") // 2단계로 끝난 로그인도 비밀번호 로그인

  // trustDevice: 같은 브라우저는 다음 로그인에서 2단계를 묻지 않는다
  assert.ok((await port2.signOut()).ok)
  io2.ip = nextIp()
  assert.deepEqual(await port2.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: {} })
  assert.equal((await port2.session()).data?.userId, confirm.data.userId)

  // 백업 코드: 한 번만 쓴다
  const useBackup = async () => {
    const p = authAdapter(auth, memoryIO(), quiet)
    assert.deepEqual(await p.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: { needsTwoFactor: true } })
    return p.verifyTwoFactor({ code: backupCodes[0], method: "backup-code" })
  }
  assert.ok((await useBackup()).ok)
  assert.deepEqual(await useBackup(), { ok: false, fieldErrors: { code: [AUTH_MESSAGES.invalidCode] } })
})

test("카카오 무이메일 규칙: 이메일 없는 프로필 → 대체 주소 사용자, session 에는 email 없음 · 가입 없이 로그인은 만들지 않음", async () => {
  const auth = createAuth(baseOptions({ socials: ["kakao"], env: { KAKAO_CLIENT_ID: "test-kakao-client", KAKAO_CLIENT_SECRET: "test-kakao-secret" } }))
  const realFetch = globalThis.fetch
  const kakaoFetch = (profile) => async (input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith("https://kauth.kakao.com/oauth/token")) return Response.json({ access_token: "test-access", token_type: "bearer", expires_in: 3600, refresh_token: "test-refresh" })
    if (url.startsWith("https://kapi.kakao.com/v2/user/me")) return Response.json(profile)
    return realFetch(input, init)
  }
  const oauth = async (io, port, kind, profile, extra = {}) => {
    const start = await port[kind]({ method: "kakao", consents, ...extra })
    assert.ok(start.ok, JSON.stringify(start))
    const url = new URL(start.data.redirectUrl)
    assert.equal(url.origin, "https://kauth.kakao.com")
    globalThis.fetch = kakaoFetch(profile)
    try {
      const res = await raw(auth, io, "GET", `/callback/kakao?code=test-code&state=${encodeURIComponent(url.searchParams.get("state"))}`)
      return res.headers.get("location")
    } finally {
      globalThis.fetch = realFetch
    }
  }

  // 가입(동의 받음) — 이메일 없는 카카오 프로필
  const io = memoryIO()
  const port = authAdapter(auth, io, quiet)
  const location = await oauth(io, port, "signUp", { id: 4242, kakao_account: { profile: { nickname: "카카오사용자" } } })
  assert.equal(location, "/", `콜백이 오류로 끝났다: ${location}`)
  const s = await port.session()
  assert.ok(s.ok && s.data, JSON.stringify(s))
  assert.equal(s.data.email, undefined)
  assert.equal(s.data.name, "카카오사용자")
  const [row] = await d.select().from(userTable).where(eq(userTable.id, s.data.userId))
  assert.equal(row.email, kakaoPlaceholderEmail(4242))
  assert.equal(row.emailVerified, false)
  // 소셜 가입도 동의가 OAuth 상태를 거쳐 콜백의 DB 훅에서 기록된다(Task 18)
  const kakaoConsents = await d.select().from(consentRecords).where(eq(consentRecords.userId, s.data.userId))
  assert.deepEqual(kakaoConsents.map((r) => r.kind).sort(), ["age_over_14", "marketing_email", "marketing_kakao", "marketing_push", "marketing_sms", "privacy", "terms"])

  // 같은 카카오 회원이 다시 로그인하면 같은 사용자
  const io2 = memoryIO()
  const port2 = authAdapter(auth, io2, quiet)
  assert.equal(await oauth(io2, port2, "signIn", { id: 4242, kakao_account: {} }), "/")
  assert.equal((await port2.session()).data?.userId, s.data.userId)
  assert.equal(lastSignInMethod(io2.headers()), "kakao")

  // 돌아갈 곳: 같은 출처 경로는 그대로, 다른 출처는 기본 경로로
  const io5 = memoryIO()
  assert.equal(await oauth(io5, authAdapter(auth, io5, quiet), "signIn", { id: 4242, kakao_account: {} }, { redirectTo: "/welcome?from=kakao" }), "/welcome?from=kakao")
  const io6 = memoryIO()
  assert.equal(await oauth(io6, authAdapter(auth, io6, quiet), "signIn", { id: 4242, kakao_account: {} }, { redirectTo: "https://evil.example/steal" }), "/")

  // 가입 안 한 카카오 회원의 signIn 은 사용자를 만들지 않는다(동의 없이 계정이 생기지 않게)
  const before = (await d.execute(sql`select count(*)::int as n from "user"`)).rows[0].n
  const io3 = memoryIO()
  const loc3 = await oauth(io3, authAdapter(auth, io3, quiet), "signIn", { id: 777, kakao_account: {} })
  assert.match(loc3, /error=signup_disabled/)
  assert.equal((await d.execute(sql`select count(*)::int as n from "user"`)).rows[0].n, before)

  // 선점 막기: 비밀번호 가입으로 대체 주소를 만들 수 없다 — 어댑터와 auth.handler 직접 호출 둘 다
  const squat = kakaoPlaceholderEmail(9999)
  assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email: squat, password: PASSWORD, consents }), {
    ok: false,
    fieldErrors: { email: [AUTH_MESSAGES.invalidEmail] },
  })
  assert.equal((await raw(auth, memoryIO(), "POST", "/sign-up/email", { email: squat.toUpperCase(), password: PASSWORD, name: "x", lfConsents: consents })).status, 400)
  assert.equal((await d.execute(sql`select count(*)::int as n from "user" where lower(email) = ${squat}`)).rows[0].n, 0)

  // 동의 없이 소셜 가입을 직접 시작해도(어댑터 우회 — /api/auth/sign-in/social 에 requestSignUp) 콜백의 DB 훅이 사용자를 만들지 않는다(Task 18)
  const directSocialSignUp = async (id, additionalData) => {
    const io7 = memoryIO()
    const start7 = await raw(auth, io7, "POST", "/sign-in/social", { provider: "kakao", callbackURL: "/", requestSignUp: true, additionalData })
    const url7 = new URL((await start7.json()).url)
    globalThis.fetch = kakaoFetch({ id, kakao_account: {} })
    try {
      return (await raw(auth, io7, "GET", `/callback/kakao?code=test-code&state=${encodeURIComponent(url7.searchParams.get("state"))}`)).headers.get("location")
    } finally {
      globalThis.fetch = realFetch
    }
  }
  const kakaoUsers = async (id) => (await d.execute(sql`select count(*)::int as n from "user" where email = ${kakaoPlaceholderEmail(id)}`)).rows[0].n
  assert.notEqual(await directSocialSignUp(8888, undefined), "/")
  assert.notEqual(await directSocialSignUp(8889, { lfConsents: { terms: true, privacy: true } }), "/") // 만 14세 확인 빠짐
  assert.equal((await kakaoUsers(8888)) + (await kakaoUsers(8889)), 0)
  // 양성 대조: 같은 직접 호출에 동의를 다 실으면 만들어진다
  assert.equal(await directSocialSignUp(8890, { lfConsents: consents }), "/")
  assert.equal(await kakaoUsers(8890), 1)

  // 이메일이 있는 프로필은 그 이메일을 쓴다(대체 주소 아님)
  const io4 = memoryIO()
  const port4 = authAdapter(auth, io4, quiet)
  assert.equal(await oauth(io4, port4, "signUp", { id: 5151, kakao_account: { email: "biz@example.com", is_email_valid: true, is_email_verified: true } }), "/")
  assert.equal((await port4.session()).data?.email, "biz@example.com")
})

test("요청 제한은 DB(rate_limit 표)에 쌓이고, 다른 인스턴스도 같은 제한을 본다", async () => {
  const ip = "198.51.100.9"
  const a = authAdapter(createAuth(baseOptions()), memoryIO(ip), quiet)
  const bad = { method: "password", email: "nobody@example.com", password: "wrong-password-1" }
  // LFAX M04: 잘못된 비밀번호는 기계가 읽는 code·retryable 을 갖는다(Better Auth 의 INVALID_EMAIL_OR_PASSWORD → invalid_credentials, 같은 값을 다시 보내도 같은 결과라 retryable false)
  const INVALID = { ok: false, formError: AUTH_MESSAGES.invalidCredentials, retryable: false, code: "invalid_credentials" }
  for (let i = 0; i < 3; i++) assert.deepEqual(await a.signIn(bad), INVALID)
  // D104: 블록이 남은 초를 보이도록 code·retryAfter 를 싣는다(Better Auth X-Retry-After, 창 10초 안)
  const limited = await a.signIn(bad)
  assert.deepEqual({ ...limited, retryAfter: undefined }, { ok: false, formError: AUTH_MESSAGES.tooManyRequests, retryable: true, code: "rate_limited", retryAfter: undefined })
  assert.ok(Number.isInteger(limited.retryAfter) && limited.retryAfter >= 1 && limited.retryAfter <= 10, `retryAfter ${limited.retryAfter}`)

  const rows = (await d.execute(sql`select key, count from rate_limit where key like ${ip + "%"} and key like '%sign-in/email'`)).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].count, 3)

  // 새 인스턴스(= 다른 서버리스 함수)도 막힌다
  const b = authAdapter(createAuth(baseOptions()), memoryIO(ip), quiet)
  assert.equal((await b.signIn(bad)).retryable, true)
  // 양성 대조: DB 행을 지우면 곧바로 다시 받는다 → 판단이 DB를 읽는다
  await d.execute(sql`delete from rate_limit where key like ${ip + "%"}`)
  assert.deepEqual(await b.signIn(bad), INVALID)
})

test("동의: 약관·개인정보·만 14세 확인은 true 만, 마케팅은 채널마다 true 일 때만 true(기본 false)", () => {
  assert.deepEqual(normalizeConsents({}), {
    ok: false,
    fieldErrors: { terms: [AUTH_MESSAGES.consentRequired], privacy: [AUTH_MESSAGES.consentRequired], ageOver14: [AUTH_MESSAGES.ageOver14Required] },
  })
  assert.deepEqual(normalizeConsents({ terms: true, privacy: "yes", ageOver14: true }), { ok: false, fieldErrors: { privacy: [AUTH_MESSAGES.consentRequired] } })
  assert.deepEqual(normalizeConsents({ terms: true, privacy: true, ageOver14: "on" }), { ok: false, fieldErrors: { ageOver14: [AUTH_MESSAGES.ageOver14Required] } })
  assert.deepEqual(normalizeConsents({ terms: true, privacy: true, ageOver14: true, marketing: { email: true, sms: "true" } }), {
    ok: true,
    consents: { terms: true, privacy: true, ageOver14: true, marketing: { email: true, sms: false, kakao: false, push: false } },
  })
  // 만 14세 확인을 끈 설정(법정대리인 동의 절차를 따로 갖춘 제품)
  assert.deepEqual(normalizeConsents({ terms: true, privacy: true }, { requireAgeOver14: false }), { ok: true, consents: { terms: true, privacy: true, marketing: { email: false, sms: false, kakao: false, push: false } } })
  // ko 문구
  assert.deepEqual(normalizeConsents({ terms: true, privacy: true }, { locale: "ko" }), { ok: false, fieldErrors: { ageOver14: ["만 14세 이상만 가입할 수 있어요."] } })
})

test("H07(LFAX): 진짜 Better Auth 의 429 응답은 code 가 없다 — withMachineCodes 가 code·retryable·retryAfter·Retry-After 를 더한다, 다른 오류 본문은 그대로", async () => {
  const ip = "198.51.100.77"
  const auth = createAuth(baseOptions())
  const io = memoryIO(ip)
  const bad = { email: "nobody@example.com", password: "wrong-password-1" }
  // 양성 대조: 한도 안의 잘못된 비밀번호는 Better Auth 가 이미 code 를 준다(감사 H07 의 「다른 오류는 code」)
  const wrong = await withMachineCodes(await raw(auth, io, "POST", "/sign-in/email", bad))
  assert.equal(wrong.status, 401)
  assert.equal((await wrong.json()).code, "INVALID_EMAIL_OR_PASSWORD")
  for (let i = 0; i < 2; i++) await raw(auth, io, "POST", "/sign-in/email", bad)
  const limitedRaw = await raw(auth, io, "POST", "/sign-in/email", bad)
  assert.equal(limitedRaw.status, 429)
  assert.equal((await limitedRaw.clone().json()).code, undefined, "고치기 전: Better Auth 의 429 에는 code 가 없다")
  const limited = await withMachineCodes(limitedRaw)
  assert.equal(limited.status, 429)
  const body = await limited.json()
  assert.equal(body.code, "RATE_LIMITED")
  assert.equal(body.retryable, true)
  assert.ok(Number.isInteger(body.retryAfter) && body.retryAfter >= 1 && body.retryAfter <= 10, `retryAfter ${body.retryAfter}`)
  assert.equal(limited.headers.get("retry-after"), String(body.retryAfter))
  assert.match(body.message, /too many requests/i, "글은 그대로")
})

test("서버 액션: 폼(FormData)으로 가입·로그인·로그아웃, 필수 동의 빠지면 필드 오류, 모르는 방법은 거절", async () => {
  const auth = createAuth(baseOptions())
  const io = memoryIO()
  const actions = authActions(authAdapter(auth, io, quiet))
  const form = (entries) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(entries)) f.set(k, v)
    return f
  }
  const email = nextEmail()
  const noPrivacy = await actions.signUp(form({ method: "password", email, password: PASSWORD, "consents.terms": "on", "consents.ageOver14": "on" }))
  // LFAX M04: 서버 액션 결과는 모든 실패에 code·retryable 을 갖는다(칸 오류 = invalid_input)
  assert.deepEqual(noPrivacy, { ok: false, fieldErrors: { privacy: [AUTH_MESSAGES.consentRequired] }, code: "invalid_input", retryable: false })
  assert.deepEqual(await actions.signUp(form({ method: "password", email, password: PASSWORD, "consents.terms": "on", "consents.privacy": "on", "consents.ageOver14": "on" })), { ok: true, data: {} })
  assert.ok((await authAdapter(auth, io, quiet).session()).data)
  assert.deepEqual(await actions.signOut(), { ok: true, data: {} })
  assert.deepEqual(await actions.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: {} })
  const bogus = await actions.signIn({ method: "facebook", email })
  assert.equal(bogus.ok, false)
  assert.ok(bogus.fieldErrors.method)
  assert.deepEqual(await actions.verifyTwoFactor(form({ code: "123456" })), { ok: false, formError: AUTH_MESSAGES.twoFactorDisabled, code: "action_failed", retryable: false })
})

test("선택 조각: methods() 는 켠 것만, 소셜 키가 빠지면 이름을 모두 알린다(값 없이)", async () => {
  assert.deepEqual((await authAdapter(createAuth(baseOptions()), memoryIO(), quiet).methods()).data, ["password"])
  const env = { GOOGLE_CLIENT_ID: "test-g", GOOGLE_CLIENT_SECRET: "test-gs", NAVER_CLIENT_ID: "test-n", NAVER_CLIENT_SECRET: "test-ns" }
  const all = createAuth(baseOptions({ socials: ["google", "naver"], env, twoFactor: true, organization: true, mailer: { passwordReset: async () => {}, magicLink: async () => {} } }))
  assert.deepEqual((await authAdapter(all, memoryIO(), quiet).methods()).data, ["password", "google", "naver", "magic-link"])
  assert.throws(() => createAuth(baseOptions({ socials: ["kakao", "naver"], env: { NAVER_CLIENT_ID: "x" } })), (e) => {
    assert.equal(e.message, "missing social sign-in keys: KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, NAVER_CLIENT_SECRET")
    return true
  })
  // 켜지 않은 소셜은 methodUnavailable
  assert.deepEqual(await authAdapter(createAuth(baseOptions()), memoryIO(), quiet).signIn({ method: "kakao" }), { ok: false, formError: AUTH_MESSAGES.methodUnavailable })
})

test("비밀번호 재설정: 있는 계정·없는 계정·메일 실패가 모두 같은 결과(가입 여부를 드러내지 않는다)", async () => {
  const sent = []
  const errors = []
  const mailer = { passwordReset: async (to) => { sent.push(to); if (to.startsWith("fail")) throw new Error("smtp down") } }
  const auth = createAuth(baseOptions({ mailer, onError: (e) => errors.push(e) }))
  const email = nextEmail()
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  const failing = `fail-${nextEmail()}`
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email: failing, password: PASSWORD, consents })).ok)
  const expected = { ok: true, data: { sent: true } }
  for (const to of [email, "nobody-here@example.com", failing]) assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).requestPasswordReset({ email: to }), expected)
  assert.deepEqual(sent, [email, failing])
  assert.equal(errors.length, 1)
})

test("F4: 재설정 메일 링크는 resetPasswordPath 로 ?token= 을 붙여 돌려보내고, 그 토큰으로 새 비밀번호를 정한다(한 번만·틀리면 invalid_token·짧으면 newPassword 칸)", async () => {
  const links = []
  const mailer = { passwordReset: async (_to, url) => void links.push(url) }
  const auth = createAuth(baseOptions({ mailer }))
  const email = nextEmail()
  const adapter = () => authAdapter(auth, memoryIO(), { ...quiet, resetPasswordPath: "/reset-password" })
  assert.ok((await adapter().signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  assert.deepEqual(await adapter().requestPasswordReset({ email }), { ok: true, data: { sent: true } })
  assert.equal(links.length, 1)
  // 메일 링크를 열면 Better Auth 가 resetPasswordPath 로 ?token= 을 붙여 보낸다(문서 「Password reset」)
  const res = await auth.handler(new Request(links[0], { redirect: "manual" }))
  assert.equal(res.status, 302)
  const where = new URL(res.headers.get("location") ?? "", BASE_URL)
  assert.equal(where.pathname, "/reset-password")
  const token = where.searchParams.get("token")
  assert.ok(token && token.length > 10, "토큰이 붙는다")
  // 짧은 비밀번호는 newPassword 칸 오류이고 토큰은 아직 살아 있다
  const short = await adapter().resetPassword({ token, newPassword: "short" })
  assert.deepEqual(short, { ok: false, fieldErrors: { newPassword: [AUTH_MESSAGES.weakPassword] } })
  const NEW = "Another-Horse-Battery-7"
  assert.deepEqual(await adapter().resetPassword({ token, newPassword: NEW }), { ok: true, data: {} })
  assert.ok((await adapter().signIn({ method: "password", email, password: NEW })).ok, "새 비밀번호로 로그인된다")
  assert.equal((await adapter().signIn({ method: "password", email, password: PASSWORD })).ok, false, "옛 비밀번호는 안 된다")
  // 토큰은 한 번만 쓴다 · 틀린 토큰도 같은 결과
  for (const t of [token, "not-a-real-token"]) assert.deepEqual(await adapter().resetPassword({ token: t, newPassword: NEW }), { ok: false, formError: AUTH_MESSAGES.invalidResetToken, code: "invalid_token" })
  assert.deepEqual(await adapter().resetPassword({ token: "", newPassword: NEW }), { ok: false, fieldErrors: { token: [AUTH_MESSAGES.required] } })
  // 서버 액션 입구: 모양이 틀리면 포트에 닿기 전에 거절한다
  const actions = authActions(adapter())
  assert.equal((await actions.resetPassword({ token: 5, newPassword: NEW })).ok, false)
  // resetPasswordPath 를 안 주면 예전처럼 redirectTo 없이 요청한다(링크의 callbackURL 이 비어 있다)
  await authAdapter(auth, memoryIO(), quiet).requestPasswordReset({ email })
  assert.doesNotMatch(links[1], /callbackURL=%2Freset-password/)
})

test("D202: 재설정 메일 발송을 요청 경로에서 기다리지 않는다 — 있는 계정도 메일이 끝나기 전에 응답하고, 백그라운드 훅(waitUntil·after)이 그 약속을 받는다", async () => {
  const gates = []
  const started = []
  const mailer = { passwordReset: (to) => new Promise((resolve) => (started.push(to), gates.push(resolve))) }
  const handed = []
  const email = nextEmail()
  const expected = { ok: true, data: { sent: true } }
  /** 응답이 메일 약속보다 먼저 오는지(메일 게이트는 우리가 열 때까지 닫혀 있다). 기다렸다면 500ms 뒤 "hung" 이 이긴다 */
  const answered = (auth, to) =>
    Promise.race([authAdapter(auth, memoryIO(), quiet).requestPasswordReset({ email: to }), new Promise((r) => setTimeout(() => r("hung"), 500))])

  // 훅을 준 경우: 훅이 약속을 받는다(서버리스에서는 이 훅이 waitUntil 을 부른다)
  const auth = createAuth(baseOptions({ mailer, runInBackground: (task) => void handed.push(task) }))
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  assert.deepEqual(await answered(auth, email), expected)
  assert.deepEqual(started, [email], "메일 발송은 시작했다")
  assert.equal(handed.length, 1, "발송 약속이 백그라운드 훅으로 넘어갔다")
  // 없는 계정도 같은 결과이고, 훅에 넘길 발송이 없다
  assert.deepEqual(await answered(auth, "nobody-d202@example.com"), expected)
  assert.equal(handed.length, 1)
  gates.forEach((open) => open())
  await Promise.all(handed)

  // 훅을 안 준 기본값도 기다리지 않는다(Node 서버: 응답 뒤에 백그라운드로 끝난다)
  const errors = []
  const failMail = { passwordReset: () => new Promise((_, reject) => gates.push(() => reject(new Error("smtp down")))) }
  const plain = createAuth(baseOptions({ mailer: failMail, onError: (e) => errors.push(e) }))
  const email2 = nextEmail()
  assert.ok((await authAdapter(plain, memoryIO(), quiet).signUp({ method: "password", email: email2, password: PASSWORD, consents })).ok)
  gates.length = 0
  assert.deepEqual(await answered(plain, email2), expected)
  assert.equal(errors.length, 0, "발송이 아직 끝나지 않았다")
  gates.forEach((open) => open())
  await new Promise((r) => setImmediate(r))
  assert.equal(errors.length, 1, "실패는 응답 뒤에 onError 로만 알린다")
})

test("D205: createAuth 의 ipAddress 는 Better Auth advanced.ipAddress 로 그대로 간다 — 안 주면 Better Auth 기본이다", () => {
  const cfg = { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"] }
  assert.deepEqual(createAuth(baseOptions({ ipAddress: cfg })).options.advanced.ipAddress, cfg)
  assert.equal(createAuth(baseOptions()).options.advanced.ipAddress, undefined)
  const none = { ipAddressHeaders: [] }
  assert.deepEqual(createAuth(baseOptions({ ipAddress: none })).options.advanced.ipAddress, none)
})

test("D26: Better Auth 표의 timestamp(시간대 없음)는 DB 세션 시간대가 서울이어도 같은 순간으로 읽힌다", async () => {
  const auth = createAuth(baseOptions())
  await d.execute(sql`set time zone 'Asia/Seoul'`)
  try {
    const t0 = Date.now()
    const io = memoryIO()
    assert.ok((await authAdapter(auth, io, quiet).signUp({ method: "password", email: nextEmail(), password: PASSWORD, consents })).ok)
    const s = await authAdapter(auth, io, quiet).session()
    const [row] = await d.select().from(userTable).where(eq(userTable.id, s.data.userId))
    assert.ok(Math.abs(row.createdAt.getTime() - t0) < 60_000, `created_at ${row.createdAt.toISOString()} vs ${new Date(t0).toISOString()}`)
  } finally {
    await d.execute(sql`set time zone 'UTC'`)
  }
})

test("로그인 유지: false 는 브라우저 세션 쿠키, true 는 expiresIn — 기본값은 Better Auth 1.7.6(7일·1일), 설정으로 바뀌고 쓰면 만료가 밀린다", async () => {
  assert.deepEqual(SESSION_DEFAULTS, { expiresIn: 604800, updateAge: 86400 })
  assert.deepEqual(createAuth(baseOptions()).options.session, SESSION_DEFAULTS)

  const auth = createAuth(baseOptions({ session: { expiresIn: 3600, updateAge: 0 } }))
  const email = nextEmail()
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  const sessionCookies = (io) => io.log.filter((l) => l.startsWith("better-auth.session_token="))
  const expiresAt = async (io) => {
    const token = decodeURIComponent(io.jar.get("better-auth.session_token")).split(".")[0]
    return (await d.select().from(sessionTable).where(eq(sessionTable.token, token)))[0].expiresAt
  }

  // 끔: Max-Age·Expires 없는 쿠키(브라우저를 닫으면 끝) + dont_remember 표시
  const off = memoryIO()
  const offPort = authAdapter(auth, off, quiet)
  assert.deepEqual(await offPort.signIn({ method: "password", email, password: PASSWORD, rememberMe: false }), { ok: true, data: {} })
  assert.doesNotMatch(sessionCookies(off).at(-1), /max-age|expires/i)
  assert.ok(off.jar.has("better-auth.dont_remember"))

  // 켬: 설정한 expiresIn(3600초)
  const on = memoryIO()
  const onPort = authAdapter(auth, on, quiet)
  assert.deepEqual(await onPort.signIn({ method: "password", email, password: PASSWORD, rememberMe: true }), { ok: true, data: {} })
  assert.match(sessionCookies(on).at(-1), /Max-Age=3600/i)

  // 밀어내기(updateAge 0 = 쓸 때마다): DB 만료가 늘고, 끈 쪽은 다시 써도 브라우저 세션 쿠키로 남는다
  const before = await expiresAt(on)
  await new Promise((r) => setTimeout(r, 30))
  assert.ok((await onPort.session()).data)
  assert.ok((await expiresAt(on)) > before, "사용했는데 만료가 밀리지 않았다")
  // 끈 쪽은 밀지 않는다: 서버 만료는 24시간 고정(Better Auth 1.7.6 internal-adapter createSession), 쿠키는 브라우저 세션 그대로
  const offBefore = await expiresAt(off)
  assert.ok(Math.abs(offBefore.getTime() - (Date.now() + 86_400_000)) < 60_000, `끈 쪽 만료 ${offBefore.toISOString()}`)
  assert.ok((await offPort.session()).data)
  assert.equal((await expiresAt(off)).getTime(), offBefore.getTime())
  assert.doesNotMatch(sessionCookies(off).at(-1), /max-age|expires/i)

  // 서버 액션: 폼에 체크박스가 없으면 끈 것, "on" 이면 켠 것
  const f = (extra) => {
    const form = new FormData()
    for (const [k, v] of Object.entries({ method: "password", email, password: PASSWORD, ...extra })) form.set(k, v)
    return form
  }
  const unchecked = memoryIO()
  assert.ok((await authActions(authAdapter(auth, unchecked, quiet)).signIn(f({}))).ok)
  assert.doesNotMatch(sessionCookies(unchecked).at(-1), /max-age/i)
  const checkedIo = memoryIO()
  assert.ok((await authActions(authAdapter(auth, checkedIo, quiet)).signIn(f({ rememberMe: "on" }))).ok)
  assert.match(sessionCookies(checkedIo).at(-1), /Max-Age=3600/i)
})

test("돌아갈 곳(redirectTo): 같은 출처 경로만, 나머지는 기본 경로 — 열린 리디렉트 음성 대조", async () => {
  const evil = [
    "https://evil.example/x",
    "//evil.example/x",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "javascript:alert(1)",
    "http://localhost:3000.evil.example/",
    "http://localhost:3001/",
    "http://user@evil.example/",
    "",
    42,
    undefined,
  ]
  for (const t of evil) assert.equal(safeRedirect(t, BASE_URL), "/", `통과하면 안 된다: ${JSON.stringify(t)}`)
  assert.equal(safeRedirect("/billing?plan=pro#top", BASE_URL), "/billing?plan=pro#top")
  assert.equal(safeRedirect("http://localhost:3000/app", BASE_URL), "/app")
  assert.equal(safeRedirect("settings", BASE_URL), "/settings")

  const auth = createAuth(baseOptions())
  const email = nextEmail()
  assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents, redirectTo: "/onboarding" }), { ok: true, data: { redirectUrl: "/onboarding" } })
  const signIn = (redirectTo) => authAdapter(auth, memoryIO(), quiet).signIn({ method: "password", email, password: PASSWORD, redirectTo })
  assert.deepEqual(await signIn("/billing"), { ok: true, data: { redirectUrl: "/billing" } })
  assert.deepEqual(await signIn("https://evil.example/steal"), { ok: true, data: { redirectUrl: "/" } })
  // 서버 액션도 같은 판정을 거친다
  assert.deepEqual(await authActions(authAdapter(auth, memoryIO(), quiet)).signIn({ method: "password", email, password: PASSWORD, redirectTo: "//evil.example" }), { ok: true, data: { redirectUrl: "/" } })
})

test("마지막 로그인 방법: 서버에서 읽는 쿠키, 값은 방법 이름뿐(개인정보 없음)", async () => {
  const auth = createAuth(baseOptions())
  const email = nextEmail()
  const io = memoryIO()
  assert.equal(lastSignInMethod(io.headers()), null)
  const port = authAdapter(auth, io, quiet)
  assert.ok((await port.signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  assert.ok((await port.signOut()).ok)
  assert.ok((await port.signIn({ method: "password", email, password: PASSWORD })).ok)
  assert.equal(io.jar.get(LAST_METHOD_COOKIE), "email")
  assert.equal(lastSignInMethod(io.headers()), "password")
  const line = io.log.findLast((l) => l.startsWith(LAST_METHOD_COOKIE + "="))
  assert.doesNotMatch(line, new RegExp(email.replace(/[.@]/g, ".")))
  // 로그아웃해도 남는다(다음 로그인 화면에서 강조)
  assert.ok((await port.signOut()).ok)
  assert.equal(lastSignInMethod(io.headers()), "password")
  // 모르는 값·다른 쿠키는 무시
  assert.equal(lastSignInMethod(new Headers({ cookie: `${LAST_METHOD_COOKIE}=facebook` })), null)
  assert.equal(lastSignInMethod(new Headers({ cookie: `x=1; ${LAST_METHOD_COOKIE}=naver` })), "naver")
})

test("formToObject: __proto__·constructor 이름은 버린다(프로토타입 오염 막기), 이름 충돌에도 던지지 않는다", () => {
  const f = new FormData()
  f.set("__proto__.polluted", "yes")
  f.set("constructor.prototype.polluted2", "yes")
  f.set("consents", "x")
  f.set("consents.terms", "on")
  const out = formToObject(f)
  assert.equal({}.polluted, undefined)
  assert.equal({}.polluted2, undefined)
  assert.deepEqual(out, { consents: { terms: "on" } })
})

// ── Task 18: 만 14세 확인 · 동의 기록 · 가입 열거 정책(D48) · 문구 언어 ─────────────────────────

const userCount = async (email) => (await d.execute(sql`select count(*)::int as n from "user" where email = ${email}`)).rows[0].n

test("만 14세 확인 없이 가입하면 거부된다 — 어댑터·서버 액션·소셜·auth.handler 직접 호출 모두, 사용자 0", async () => {
  const auth = createAuth(baseOptions({ socials: ["kakao"], env: { KAKAO_CLIENT_ID: "kid", KAKAO_CLIENT_SECRET: "ksecret" } }))
  const email = nextEmail()
  const noAge = { terms: true, privacy: true }
  const port = authAdapter(auth, memoryIO(), quiet)
  assert.deepEqual(await port.signUp({ method: "password", email, password: PASSWORD, consents: noAge }), { ok: false, fieldErrors: { ageOver14: [AUTH_MESSAGES.ageOver14Required] } })
  assert.deepEqual(await port.signUp({ method: "kakao", consents: noAge }), { ok: false, fieldErrors: { ageOver14: [AUTH_MESSAGES.ageOver14Required] } })
  const f = new FormData()
  for (const [k, v] of Object.entries({ method: "password", email, password: PASSWORD, "consents.terms": "on", "consents.privacy": "on" })) f.set(k, v)
  assert.deepEqual(await authActions(port).signUp(f), { ok: false, fieldErrors: { ageOver14: [AUTH_MESSAGES.ageOver14Required] }, code: "invalid_input", retryable: false })
  // 어댑터를 건너뛴 직접 호출: 동의가 아예 없거나 만 14세만 빠져도 사용자를 만들지 않는다
  for (const body of [{}, { lfConsents: noAge }, { lfConsents: { ...noAge, ageOver14: "on" } }]) {
    const res = await raw(auth, memoryIO(), "POST", "/sign-up/email", { email, password: PASSWORD, name: "x", ...body })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).code, "CONSENT_REQUIRED")
  }
  assert.equal(await userCount(email), 0)
  // 양성 대조: 같은 직접 호출에 만 14세 확인을 넣으면 만들어진다 → 거부 이유가 그 칸이다
  assert.equal((await raw(auth, memoryIO(), "POST", "/sign-up/email", { email, password: PASSWORD, name: "x", lfConsents: consents })).status, 200)
  assert.equal(await userCount(email), 1)
})

test("가입 동의 기록: 약관·개인정보는 판과 시각, 만 14세 확인, 마케팅은 채널마다 기록 + updatedAt(D40)", async () => {
  const auth = createAuth(baseOptions())
  const io = memoryIO()
  const email = nextEmail()
  const r = await authAdapter(auth, io, { ...quiet, locale: "ko" }).signUp({ method: "password", email, password: PASSWORD, consents: { ...consents, marketing: { email: true, kakao: false } } })
  assert.deepEqual(r, { ok: true, data: {} })
  const [u] = await d.select().from(userTable).where(eq(userTable.email, email))
  const rows = await d.select().from(consentRecords).where(eq(consentRecords.userId, u.id))
  const byKind = Object.fromEntries(rows.map((x) => [x.kind, x]))
  assert.equal(rows.length, 7)
  assert.equal(byKind.terms.version, CONSENT_VERSIONS.terms)
  assert.equal(byKind.privacy.version, CONSENT_VERSIONS.privacy)
  assert.equal(byKind.age_over_14.version, null)
  for (const x of rows) {
    assert.equal(x.source, "sign_up")
    assert.equal(x.locale, "ko")
    assert.equal(x.createdAt.getTime(), u.createdAt.getTime(), `${x.kind} 시각`)
  }
  assert.deepEqual(
    Object.fromEntries(rows.filter((x) => x.kind.startsWith("marketing_")).map((x) => [x.kind, x.granted])),
    { marketing_email: true, marketing_sms: false, marketing_kakao: false, marketing_push: false },
  )
  const mc = await d.select().from(marketingConsents).where(eq(marketingConsents.userId, u.id))
  assert.deepEqual(Object.fromEntries(mc.map((x) => [x.channel, x.granted])), { email: true, sms: false, kakao: false, push: false })
  for (const x of mc) assert.equal(x.updatedAt.getTime(), u.createdAt.getTime())
})

test("동의 기록을 남기지 못하면 사용자도 남기지 않는다(증빙 없는 계정 0)", async () => {
  const auth = createAuth(baseOptions())
  const email = nextEmail()
  await d.execute(sql`alter table marketing_consents rename to marketing_consents_off`)
  try {
    const r = await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents })
    assert.equal(r.ok, false)
  } finally {
    await d.execute(sql`alter table marketing_consents_off rename to marketing_consents`)
  }
  assert.equal(await userCount(email), 0)
  // 표를 되돌리면 같은 이메일로 가입된다(남은 사용자 행이 없다는 양성 대조)
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signUp({ method: "password", email, password: PASSWORD, consents })).ok)
})

test("가입 열거 정책(D48): 기본 reveal 은 필드 오류, conceal 은 있는 계정·없는 계정이 같은 응답이고 주인에게만 알린다", async () => {
  // reveal(기본): 업계 관행 — 가입 즉시 로그인
  const reveal = createAuth(baseOptions())
  const taken = nextEmail()
  assert.deepEqual(await authAdapter(reveal, memoryIO(), quiet).signUp({ method: "password", email: taken, password: PASSWORD, consents }), { ok: true, data: {} })
  assert.deepEqual(await authAdapter(reveal, memoryIO(), quiet).signUp({ method: "password", email: taken, password: PASSWORD, consents }), { ok: false, fieldErrors: { email: [AUTH_MESSAGES.userExists] }, retryable: false, code: "email_exists" })

  assert.throws(() => createAuth(baseOptions({ signUpEnumeration: "conceal" })), /mailer\.verifyEmail/)
  const sent = []
  const mailer = {
    passwordReset: async () => {},
    verifyEmail: async (to, url) => void sent.push({ kind: "verify", to, url }),
    existingAccount: async (to) => void sent.push({ kind: "existing", to }),
  }
  const conceal = createAuth(baseOptions({ signUpEnumeration: "conceal", mailer }))
  const fresh = nextEmail()
  const a = await authAdapter(conceal, memoryIO(), quiet).signUp({ method: "password", email: fresh, password: PASSWORD, consents })
  const b = await authAdapter(conceal, memoryIO(), quiet).signUp({ method: "password", email: taken, password: PASSWORD, consents })
  assert.deepEqual(a, { ok: true, data: { emailSent: true } })
  assert.deepEqual(b, a)
  assert.deepEqual(sent.map((m) => [m.kind, m.to]), [["verify", fresh], ["existing", taken]])
  assert.equal(await userCount(taken), 1)
  // 있는 계정 쪽에는 동의 기록이 새로 생기지 않는다(합성 사용자는 DB에 없다)
  const [owner] = await d.select().from(userTable).where(eq(userTable.email, taken))
  assert.equal((await d.select().from(consentRecords).where(eq(consentRecords.userId, owner.id))).length, 7)
  // 인증 전 로그인은 막힌다 — 문구는 인증 안내
  assert.deepEqual(await authAdapter(conceal, memoryIO(), quiet).signIn({ method: "password", email: fresh, password: PASSWORD }), { ok: false, formError: AUTH_MESSAGES.emailNotVerified })
  // 동의가 빠진 직접 호출도 계정 유무와 상관없이 같은 응답(엔드포인트 앞에서 막는다)
  const noConsent = async (email) => {
    const res = await raw(conceal, memoryIO(), "POST", "/sign-up/email", { email, password: PASSWORD, name: "x" })
    return [res.status, (await res.json()).code]
  }
  assert.deepEqual(await noConsent(taken), await noConsent(nextEmail()))
})

test("문구 언어: locale ko 면 오류 문구가 메시지 목록의 ko 다", async () => {
  const auth = createAuth(baseOptions())
  const ko = authAdapter(auth, memoryIO(), { ...quiet, locale: "ko" })
  assert.deepEqual(await ko.signIn({ method: "password", email: nextEmail(), password: "wrong-password-1" }), { ok: false, formError: "이메일이나 비밀번호가 맞지 않아요.", retryable: false, code: "invalid_credentials" })
  assert.deepEqual(await ko.signIn({ method: "password" }), { ok: false, fieldErrors: { email: ["꼭 입력해 주세요."], password: ["꼭 입력해 주세요."] } })
  assert.equal(AUTH_MESSAGES.invalidCredentials, "Incorrect email or password.")
})

test("가입 봇 방어(v0 Task 15): botCheck 를 켜면 토큰 없거나 틀린 가입은 400 BOT_CHECK_FAILED·사용자 0 — 어댑터·서버 액션·auth.handler 직접 호출 모두", async () => {
  const { createTurnstile } = await import("@launch-factory/security/turnstile")
  const { MESSAGES } = await import("@launch-factory/i18n")
  const { DUMMY_TOKEN, fakeSiteverify, TEST_SECRET_PASS } = await import("../../security/test/turnstile-fixtures.mjs")
  const cf = fakeSiteverify()
  const auth = createAuth(baseOptions({ botCheck: createTurnstile({ mode: "live", secretKey: TEST_SECRET_PASS, fetch: cf.fetch }) }))
  const port = authAdapter(auth, memoryIO(), { ...quiet, locale: "ko" })
  const email = nextEmail()
  for (const turnstileToken of [undefined, "forged"]) {
    assert.deepEqual(await port.signUp({ method: "password", email, password: PASSWORD, consents, turnstileToken }), { ok: false, formError: MESSAGES.ko.protect.botCheckFailed, retryable: true, code: "bot_check_failed" })
  }
  const res = await raw(auth, memoryIO(), "POST", "/sign-up/email", { email, password: PASSWORD, name: "x", lfConsents: consents })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).code, "BOT_CHECK_FAILED")
  assert.equal(await userCount(email), 0)
  // 서버 액션은 폼의 cf-turnstile-response 를 넘긴다 → 통과
  const form = new FormData()
  for (const [k, v] of Object.entries({ method: "password", email, password: PASSWORD, "consents.terms": "on", "consents.privacy": "on", "consents.ageOver14": "on", "cf-turnstile-response": DUMMY_TOKEN })) form.set(k, v)
  assert.equal((await authActions(authAdapter(auth, memoryIO(), quiet)).signUp(form)).ok, true)
  assert.equal(await userCount(email), 1)
  assert.equal(cf.calls.at(-1).body.get("response"), DUMMY_TOKEN)
  // mock 모드 Turnstile 이면 토큰 없이 가입된다(키 없는 개발 흐름)
  const mockAuth = createAuth(baseOptions({ botCheck: createTurnstile({ mode: "mock" }) }))
  const other = nextEmail()
  assert.equal((await authAdapter(mockAuth, memoryIO(), quiet).signUp({ method: "password", email: other, password: PASSWORD, consents })).ok, true)
})
