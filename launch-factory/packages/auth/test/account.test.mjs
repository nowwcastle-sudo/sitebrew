// @launch-factory/auth — Task 19 계정 편의(D70~D74): 비밀번호 변경·재설정 뒤 세션, 이메일 변경(재인증·승인·새 주소 확인·옛 주소 알림),
// 이메일 확인·다시 보내기, 기기 목록·기기별 로그아웃, 언어·시간대. PGlite 메모리 하나를 파일 전체가 같이 쓴다. 네트워크는 쓰지 않는다.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import { db, account as accountTable, session as sessionTable, user as userTable } from "@launch-factory/db"
import { authEmails, createMailer } from "@launch-factory/email"
import {
  AUTH_MESSAGES,
  authActions,
  authAdapter,
  changeOf,
  createAuth,
  deviceName,
  kakaoPlaceholderEmail,
  localeFromAcceptLanguage,
  maskIp,
} from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const NEW_PASSWORD = "New-Horse-Battery-77"
const UA = {
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  safariIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  edgeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
}

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
let ipSeq = 0
const nextIp = () => `198.18.0.${++ipSeq}`
let emailSeq = 0
const nextEmail = () => `acct${++emailSeq}@example.com`

before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

/** 브라우저 한 개: 쿠키 병 + 고정 IP·UA·언어 */
function memoryIO({ ip = nextIp(), ua = "lf-test", lang } = {}) {
  const jar = new Map()
  return {
    jar,
    headers() {
      const h = new Headers({ "x-forwarded-for": ip, "user-agent": ua })
      if (lang) h.set("accept-language", lang)
      if (jar.size) h.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
      return h
    },
    setCookies(list) {
      for (const line of list) {
        const [pair, ...attrs] = line.split(";")
        const i = pair.indexOf("=")
        const name = pair.slice(0, i).trim()
        const value = pair.slice(i + 1).trim()
        if (attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "") jar.delete(name)
        else jar.set(name, value)
      }
    },
  }
}

/** 받은 메일을 적는 AuthMailer(모양은 @launch-factory/email authEmails 와 같다) */
function recorder() {
  const mails = []
  return {
    mails,
    of: (kind) => mails.filter((m) => m.kind === kind),
    mailer: {
      passwordReset: async (to, url, who) => void mails.push({ kind: "reset", to, url, who }),
      verifyEmail: async (to, url, who) => void mails.push({ kind: "verify", to, url, who }),
      changeEmailConfirm: async (to, { newEmail, url }, who) => void mails.push({ kind: "confirm", to, url, newEmail, who }),
      emailChanged: async (to, { newEmail }, who) => void mails.push({ kind: "changed", to, newEmail, who }),
      passwordChanged: async (to, who) => void mails.push({ kind: "pwChanged", to, who }),
    },
  }
}

const quiet = { onError: () => {} }
const consents = { terms: true, privacy: true, ageOver14: true }
const CONSENT_VERSIONS = { terms: "2026-09-30", privacy: "2026-09-30" } // 시험용 문서 판
const make = (mailer, extra = {}) => createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, mailer, onError: () => {}, consentVersions: CONSENT_VERSIONS, ...extra })

/** 새 사용자 + 그 브라우저 */
async function signedUp(auth, io = memoryIO(), extra = {}) {
  const email = nextEmail()
  const port = authAdapter(auth, io, quiet)
  const r = await port.signUp({ method: "password", email, password: PASSWORD, consents, ...extra })
  assert.ok(r.ok, JSON.stringify(r))
  const s = await port.session()
  return { email, io, port, userId: s.data.userId }
}
/** 같은 사용자로 다른 브라우저에서 로그인 */
async function otherDevice(auth, email, password = PASSWORD, opts = {}) {
  const io = memoryIO(opts)
  const port = authAdapter(auth, io, quiet)
  const r = await port.signIn({ method: "password", email, password })
  assert.ok(r.ok, JSON.stringify(r))
  return port
}
async function raw(auth, io, method, path, body) {
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  if (body) headers.set("content-type", "application/json")
  const res = await auth.handler(new Request(BASE_URL + "/api/auth" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  io.setCookies(res.headers.getSetCookie())
  return res
}
/** 메일 속 링크(절대 주소)를 그 브라우저로 연다 */
async function follow(auth, io, url) {
  const u = new URL(url)
  assert.equal(u.origin, BASE_URL)
  const headers = io.headers()
  const res = await auth.handler(new Request(u, { method: "GET", headers }))
  io.setCookies(res.headers.getSetCookie())
  return res
}
const userRow = async (id) => (await d.select().from(userTable).where(eq(userTable.id, id)))[0]

// ── D72 비밀번호 변경 ────────────────────────────────

test("D72 비밀번호 변경: 틀린 지금 비밀번호는 거절(바뀌지 않음) — 맞으면 바뀌고 알림 메일, revokeOtherSessions 면 다른 기기만 끝난다", async () => {
  const rec = recorder()
  const auth = make(rec.mailer)
  const { email, port } = await signedUp(auth)
  const phone = await otherDevice(auth, email)
  const laptop = await otherDevice(auth, email)

  // 음성: 틀린 지금 비밀번호 — 어댑터·handler 직접 호출 모두 거절, 비밀번호 그대로, 알림 없음
  assert.deepEqual(await port.changePassword({ currentPassword: "wrong-password-1", newPassword: NEW_PASSWORD }), {
    ok: false,
    fieldErrors: { currentPassword: [AUTH_MESSAGES.invalidPassword] },
  })
  assert.equal((await raw(auth, memoryIO(), "POST", "/change-password", { currentPassword: "x", newPassword: NEW_PASSWORD })).status, 401) // 로그인 안 함
  assert.equal(rec.of("pwChanged").length, 0)
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signIn({ method: "password", email, password: PASSWORD })).ok, "틀린 비밀번호로 바뀌었다")
  // 빈 칸은 요청 없이 필드 오류
  assert.deepEqual(await port.changePassword({ currentPassword: "", newPassword: NEW_PASSWORD }), { ok: false, fieldErrors: { currentPassword: [AUTH_MESSAGES.required] } })

  // 다른 기기 유지(기본)
  assert.deepEqual(await port.changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD }), { ok: true, data: { otherSessionsRevoked: false } })
  assert.ok((await phone.session()).data, "선택하지 않았는데 다른 기기가 끝났다")
  assert.deepEqual(rec.of("pwChanged").map((m) => m.to), [email])

  // 다른 기기 로그아웃 선택
  assert.deepEqual(await port.changePassword({ currentPassword: NEW_PASSWORD, newPassword: PASSWORD, revokeOtherSessions: true }), { ok: true, data: { otherSessionsRevoked: true } })
  assert.equal((await phone.session()).data, null)
  assert.equal((await laptop.session()).data, null)
  assert.ok((await port.session()).data, "이 기기도 끝났다")
  assert.equal(rec.of("pwChanged").length, 2)
})

test("D72 비밀번호 재설정: 재설정하면 그 전의 모든 세션이 끝난다 + 알림 메일", async () => {
  const rec = recorder()
  const auth = make(rec.mailer)
  const { email, port } = await signedUp(auth)
  const phone = await otherDevice(auth, email)
  assert.ok((await port.session()).data && (await phone.session()).data)

  assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).requestPasswordReset({ email }), { ok: true, data: { sent: true } })
  const [mail] = rec.of("reset")
  const token = new URL(mail.url).pathname.split("/").pop()
  const reset = await raw(auth, memoryIO(), "POST", "/reset-password", { newPassword: NEW_PASSWORD, token })
  assert.equal(reset.status, 200)

  assert.equal((await port.session()).data, null, "재설정 전 세션이 살아 있다")
  assert.equal((await phone.session()).data, null)
  const rows = await d.select().from(sessionTable).innerJoin(userTable, eq(sessionTable.userId, userTable.id)).where(eq(userTable.email, email))
  assert.equal(rows.length, 0)
  assert.deepEqual(rec.of("pwChanged").map((m) => m.to), [email])
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signIn({ method: "password", email, password: NEW_PASSWORD })).ok)
})

// ── D71 이메일 변경 ─────────────────────────────────

test("D71 이메일 변경(확인된 주소): 재인증 없으면 거절 → 지금 주소 승인 → 새 주소 확인 → 바뀜 → 옛 주소에 알림", async () => {
  const rec = recorder()
  const auth = make(rec.mailer)
  const { email, io, port, userId } = await signedUp(auth)
  await d.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, userId))
  rec.mails.length = 0
  const newEmail = nextEmail()

  // 음성: 재인증(지금 비밀번호) 없이 — 어댑터·handler 직접 호출 모두 거절, 메일 0통
  assert.deepEqual(await port.changeEmail({ newEmail }), { ok: false, fieldErrors: { currentPassword: [AUTH_MESSAGES.invalidPassword] } })
  assert.equal((await raw(auth, io, "POST", "/change-email", { newEmail })).status, 400)
  assert.deepEqual(await port.changeEmail({ newEmail, currentPassword: "wrong-password-1" }), { ok: false, fieldErrors: { currentPassword: [AUTH_MESSAGES.invalidPassword] } })
  assert.equal(rec.mails.length, 0, "재인증 없이 메일이 나갔다")
  assert.equal((await userRow(userId)).email, email)

  // 같은 주소
  assert.deepEqual(await port.changeEmail({ newEmail: email, currentPassword: PASSWORD }), { ok: false, fieldErrors: { newEmail: [AUTH_MESSAGES.sameEmail] } })

  // 요청 제한(SENSITIVE_RATE_LIMITS: 60초에 5번)이 비밀번호 추측을 막는다 — 위 음성 호출이 같은 IP 로 4번 썼으니 다음 두 번째에서 막힌다
  assert.equal((await raw(auth, io, "POST", "/change-email", { newEmail, currentPassword: "guess-1" })).status, 400)
  assert.equal((await raw(auth, io, "POST", "/change-email", { newEmail, currentPassword: "guess-2" })).status, 429)
  await d.execute(sql`delete from rate_limit where key like '%change-email'`) // 창이 지난 것처럼

  // 1) 승인 요청은 지금(옛) 주소로만
  assert.deepEqual(await port.changeEmail({ newEmail, currentPassword: PASSWORD, redirectTo: "/settings" }), { ok: true, data: { emailSent: true } })
  assert.deepEqual(rec.mails.map((m) => [m.kind, m.to]), [["confirm", email]])
  assert.equal(rec.mails[0].newEmail, newEmail)
  assert.equal((await userRow(userId)).email, email, "승인 전에 바뀌었다")

  // 2) 승인하면 확인 링크는 새 주소로만
  assert.equal((await follow(auth, io, rec.mails[0].url)).status, 302)
  assert.deepEqual(rec.mails.slice(1).map((m) => [m.kind, m.to]), [["verify", newEmail]])
  assert.equal((await userRow(userId)).email, email, "새 주소 확인 전에 바뀌었다")

  // 3) 새 주소 확인 → 바뀐다, 확인됨. 옛 주소에 알림(새 주소를 알려 준다)
  const res = await follow(auth, io, rec.mails[1].url)
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("location"), "/settings")
  const row = await userRow(userId)
  assert.equal(row.email, newEmail)
  assert.equal(row.emailVerified, true)
  assert.deepEqual(rec.of("changed").map((m) => [m.to, m.newEmail]), [[email, newEmail]])
  assert.equal(rec.of("changed").filter((m) => m.to === newEmail).length, 0)
  assert.equal((await port.session()).data.email, newEmail)

  // 이미 쓰이는 주소로 바꾸려 해도 같은 응답(가입 여부를 드러내지 않는다), 메일은 안 나간다
  const other = await signedUp(auth)
  const before = rec.mails.length
  assert.deepEqual(await port.changeEmail({ newEmail: other.email, currentPassword: PASSWORD }), { ok: true, data: { emailSent: true } })
  assert.equal(rec.mails.length, before)
})

test("D71 비밀번호 없는 사용자(소셜 전용·카카오 대체 주소, D43): 방금 로그인한 세션만 바꿀 수 있다 — 새 주소 확인만, 대체 주소엔 메일 없음", async () => {
  const rec = recorder()
  const auth = make(rec.mailer)
  const { io, port, userId } = await signedUp(auth)
  // 카카오 대체 주소 사용자와 같은 모양으로 만든다: 비밀번호 계정 없음 + 대체 주소 + 미확인
  const placeholder = kakaoPlaceholderEmail(900000 + emailSeq) // 카카오 회원번호는 숫자다
  await d.delete(accountTable).where(eq(accountTable.userId, userId))
  await d.update(userTable).set({ email: placeholder, emailVerified: false }).where(eq(userTable.id, userId))
  rec.mails.length = 0
  const real = nextEmail()

  // 음성: 로그인한 지 오래된 세션 → 재인증 필요, 메일 0통
  const [s] = await d.select().from(sessionTable).where(eq(sessionTable.userId, userId))
  await d.update(sessionTable).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) }).where(eq(sessionTable.id, s.id))
  assert.deepEqual(await port.changeEmail({ newEmail: real }), { ok: false, formError: AUTH_MESSAGES.reauthRequired })
  assert.equal(rec.mails.length, 0)

  // 방금 로그인한 세션: 새 주소 확인만(대체 주소로 승인 요청을 보내지 않는다)
  await d.update(sessionTable).set({ createdAt: new Date() }).where(eq(sessionTable.id, s.id))
  assert.deepEqual(await port.changeEmail({ newEmail: real }), { ok: true, data: { emailSent: true } })
  assert.deepEqual(rec.mails.map((m) => [m.kind, m.to]), [["verify", real]])
  const done = await follow(auth, io, rec.mails[0].url)
  assert.equal(done.status, 302)
  assert.doesNotMatch(done.headers.get("location"), /error=/)
  const row = await userRow(userId)
  assert.equal(row.email, real)
  assert.equal(row.emailVerified, true)
  assert.equal(rec.of("changed").length, 0, "대체 주소로 알림을 보냈다")
  // 이제 session 이 실제 주소를 보인다
  assert.equal((await port.session()).data.email, real)
})

test("changeOf: 변경 확인 토큰만 옛·새 주소를 돌려준다", () => {
  const tok = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`
  const req = (t) => new Request(`${BASE_URL}/api/auth/verify-email?token=${t}`)
  assert.deepEqual(changeOf(req(tok({ email: "a@x.test", updateTo: "b@x.test", requestType: "change-email-verification" }))), { from: "a@x.test", to: "b@x.test" })
  assert.equal(changeOf(req(tok({ email: "a@x.test", updateTo: "b@x.test", requestType: "change-email-confirmation" }))), null)
  assert.equal(changeOf(req(tok({ email: "a@x.test" }))), null)
  assert.equal(changeOf(req("garbage")), null)
  assert.equal(changeOf(undefined), null)
})

// ── D70 이메일 확인 ────────────────────────────────

test("D70 이메일 확인: 가입하면 확인 메일, 확인 전에도 로그인된다(소프트) · 다시 보내기 · 링크를 열면 확인됨 · 요청 제한", async () => {
  const rec = recorder()
  const auth = make(rec.mailer)
  const { email, io, port } = await signedUp(auth)
  assert.deepEqual(rec.of("verify").map((m) => m.to), [email])
  assert.equal((await port.session()).data.emailVerified, false)
  // 확인하지 않아도 로그인을 막지 않는다
  const other = await otherDevice(auth, email)
  assert.ok((await other.session()).data)

  assert.deepEqual(await port.sendVerificationEmail({ redirectTo: "/welcome" }), { ok: true, data: { sent: true } })
  assert.equal(rec.of("verify").length, 2)
  const res = await follow(auth, io, rec.of("verify")[1].url)
  assert.equal(res.status, 302)
  assert.equal(res.headers.get("location"), "/welcome")
  assert.equal((await port.session()).data.emailVerified, true)
  assert.deepEqual(await port.sendVerificationEmail(), { ok: false, formError: AUTH_MESSAGES.alreadyVerified })

  // 요청 제한: 같은 IP 에서 60초에 3번(SENSITIVE_RATE_LIMITS) — 4번째는 막힌다
  const u2 = await signedUp(auth)
  const results = []
  for (let i = 0; i < 4; i++) results.push(await u2.port.sendVerificationEmail())
  assert.deepEqual(results.map((r) => r.ok), [true, true, true, false])
  assert.equal(results[3].formError, AUTH_MESSAGES.tooManyRequests)

  // 로그인 안 함
  assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).sendVerificationEmail(), { ok: false, formError: AUTH_MESSAGES.signInRequired, retryable: false, code: "sign_in_required" })
})

test("D70 메일러에 verifyEmail 이 없으면 확인·변경은 꺼진다(가입은 그대로) — Task 4 설정과 같은 동작", async () => {
  const auth = make({ passwordReset: async () => {} })
  const { port } = await signedUp(auth)
  assert.equal(auth.options.emailVerification, undefined)
  const r = await port.changeEmail({ newEmail: nextEmail(), currentPassword: PASSWORD })
  assert.equal(r.ok, false)
})

// ── D73 기기 목록 ────────────────────────────────

test("D73 기기 목록: 사람이 읽는 기기 이름·가린 IP·지금 기기 표시, 토큰은 내보내지 않는다", async () => {
  const auth = make(recorder().mailer)
  const { email, port } = await signedUp(auth, memoryIO({ ip: "203.0.113.77", ua: UA.chromeWin }))
  await otherDevice(auth, email, PASSWORD, { ua: UA.safariIos })
  await otherDevice(auth, email, PASSWORD, { ua: UA.edgeMac })
  const r = await port.listSessions()
  assert.ok(r.ok, JSON.stringify(r))
  assert.equal(r.data.length, 3)
  assert.deepEqual(r.data.map((x) => x.current), [true, false, false])
  assert.equal(r.data[0].device, "Chrome on Windows")
  assert.equal(r.data[0].ip, "203.0.113.*")
  assert.deepEqual(new Set(r.data.map((x) => x.device)), new Set(["Chrome on Windows", "Safari on iOS", "Edge on macOS"]))
  assert.doesNotMatch(JSON.stringify(r.data), /token/i)
  for (const x of r.data) assert.ok(!Number.isNaN(Date.parse(x.lastActiveAt)) && !Number.isNaN(Date.parse(x.expiresAt)))
})

test("D73 기기별 로그아웃: 내 다른 기기는 끝나고, 남의 세션은 끝낼 수 없다(어댑터·handler 직접 모두)", async () => {
  const auth = make(recorder().mailer)
  const alice = await signedUp(auth)
  const alicePhone = await otherDevice(auth, alice.email)
  const bob = await signedUp(auth)

  const list = (await alice.port.listSessions()).data
  const phoneId = list.find((x) => !x.current).id
  // 음성: 밥이 앨리스의 세션 id 로 — 목록에 없어 거절, 앨리스 세션 그대로
  assert.deepEqual(await bob.port.revokeSession({ sessionId: phoneId }), { ok: false, formError: AUTH_MESSAGES.sessionNotFound })
  // 음성: 밥이 앨리스의 토큰을 알아도 handler 직접 호출로 못 끝낸다(Better Auth 가 소유자를 본다)
  const [phoneRow] = await d.select().from(sessionTable).where(eq(sessionTable.id, phoneId))
  assert.equal((await raw(auth, bob.io, "POST", "/revoke-session", { token: phoneRow.token })).status, 200)
  assert.ok((await alicePhone.session()).data, "남이 내 세션을 끝냈다")
  assert.ok((await bob.port.session()).data)

  // 양성: 앨리스는 자기 폰을 끝낸다
  assert.deepEqual(await alice.port.revokeSession({ sessionId: phoneId }), { ok: true, data: {} })
  assert.equal((await alicePhone.session()).data, null)
  assert.ok((await alice.port.session()).data)
  assert.deepEqual(await alice.port.revokeSession({ sessionId: phoneId }), { ok: false, formError: AUTH_MESSAGES.sessionNotFound })

  // 이 기기 말고 모두
  const tablet = await otherDevice(auth, alice.email)
  const laptop = await otherDevice(auth, alice.email)
  assert.deepEqual(await alice.port.revokeOtherSessions(), { ok: true, data: {} })
  assert.equal((await tablet.session()).data, null)
  assert.equal((await laptop.session()).data, null)
  assert.ok((await alice.port.session()).data)
  assert.equal((await alice.port.listSessions()).data.length, 1)
  assert.ok((await bob.port.session()).data, "남의 세션까지 끝났다")
})

test("기기 이름·IP 가리기", () => {
  assert.equal(deviceName(UA.chromeWin), "Chrome on Windows")
  assert.equal(deviceName(UA.safariIos), "Safari on iOS")
  assert.equal(deviceName(UA.edgeMac), "Edge on macOS")
  assert.equal(deviceName("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36"), "Samsung Internet on Android")
  assert.equal(deviceName("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 KAKAOTALK 10.8.0"), "KakaoTalk on iOS")
  assert.equal(deviceName(""), "Unknown device")
  assert.equal(deviceName(null), "Unknown device")
  assert.equal(maskIp("203.0.113.9"), "203.0.113.*")
  assert.equal(maskIp("2001:db8:85a3:0:0:8a2e:370:7334"), "2001:db8:85a3:0:*")
  assert.equal(maskIp(null), undefined)
})

// ── D74 언어·시간대 ────────────────────────────────

test("D74 언어·시간대: 가입 때 accept-language·브라우저 시간대로 채우고, 틀린 값은 버린다 · 바꾸기는 검사한다", async () => {
  const auth = make(recorder().mailer)
  const ko = await signedUp(auth, memoryIO({ lang: "ko-KR,ko;q=0.9,en-US;q=0.8" }), { timeZone: "Asia/Seoul" })
  assert.deepEqual([(await ko.port.session()).data.locale, (await ko.port.session()).data.timeZone], ["ko", "Asia/Seoul"])

  // 준 locale 이 우선, 모르는 시간대는 비운다(가입은 막지 않는다)
  const en = await signedUp(auth, memoryIO({ lang: "ko-KR" }), { locale: "en", timeZone: "Mars/Olympus" })
  const row = await userRow(en.userId)
  assert.deepEqual([row.locale, row.timeZone], ["en", null])
  // 지원하지 않는 언어만 오면 null
  const fr = await signedUp(auth, memoryIO({ lang: "fr-FR,fr;q=0.9" }))
  assert.equal((await userRow(fr.userId)).locale, null)

  assert.deepEqual(await ko.port.updatePreferences({ timeZone: "Not/AZone" }), { ok: false, fieldErrors: { timeZone: [AUTH_MESSAGES.invalidTimeZone] } })
  assert.deepEqual(await ko.port.updatePreferences({ locale: "fr" }), { ok: false, fieldErrors: { locale: [AUTH_MESSAGES.invalidLocale] } })
  assert.equal((await userRow(ko.userId)).timeZone, "Asia/Seoul", "틀린 값이 저장됐다")
  // handler 직접 호출도 같은 검사
  assert.equal((await raw(auth, ko.io, "POST", "/update-user", { timeZone: "Not/AZone" })).status, 400)
  assert.deepEqual(await ko.port.updatePreferences({ locale: "en", timeZone: "America/New_York" }), { ok: true, data: { locale: "en", timeZone: "America/New_York" } })
  // 서버 액션: 빈 문자열은 지우기
  assert.deepEqual(await authActions(ko.port).updatePreferences({ timeZone: "" }), { ok: true, data: { locale: "en", timeZone: null } })

  assert.equal(localeFromAcceptLanguage("en-GB;q=0.5, ko;q=0.8"), "ko")
  assert.equal(localeFromAcceptLanguage("*"), null)
  assert.equal(localeFromAcceptLanguage(undefined), null)
})

test("D02 이름 저장: 로그인한 본인의 이름을 바꾸고(빈 칸은 지움), 80자 넘는 이름은 거절하며, 로그인 없이는 닿지 않는다", async () => {
  const auth = make(recorder().mailer)
  const me = await signedUp(auth, memoryIO())
  assert.deepEqual(await authActions(me.port).updateProfile({ name: "  Jamie Park  " }), { ok: true, data: { name: "Jamie Park" } })
  assert.equal((await userRow(me.userId)).name, "Jamie Park")
  assert.equal((await me.port.session()).data.name, "Jamie Park")
  // 빈 칸은 이름 지우기
  assert.deepEqual(await authActions(me.port).updateProfile({ name: "" }), { ok: true, data: { name: "" } })
  // 80자 넘으면 서버 액션이 먼저 거절한다 — 저장된 값은 그대로
  const long = await authActions(me.port).updateProfile({ name: "x".repeat(81) })
  assert.equal(long.ok, false)
  assert.equal((await userRow(me.userId)).name, "")
  // 로그인 없이는(쿠키 없는 브라우저) 저장되지 않는다
  const guest = authAdapter(auth, memoryIO(), quiet)
  assert.equal((await guest.updateProfile({ name: "Nobody" })).ok, false)
})

test("D180 비밀번호 재설정 메일이 실제로 나간다: authEmails 가 받는 사람의 언어로 재설정 링크를 렌더한다(요청 → 메일 → 그 링크로 재설정)", async () => {
  const lines = []
  const mailer = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const auth = make(authEmails(mailer, { productName: "SampleCo", defaultLocale: "en" }))
  const { email } = await signedUp(auth, memoryIO({ lang: "ko-KR" }), { locale: "ko" })
  lines.length = 0
  assert.deepEqual(await authAdapter(auth, memoryIO(), quiet).requestPasswordReset({ email }), { ok: true, data: { sent: true } })
  const out = lines.join("\n")
  assert.match(out, /template=passwordReset/)
  assert.match(out, /비밀번호를 재설정해 주세요/)
  const url = /https?:\/\/\S*reset-password\/[A-Za-z0-9_-]+\S*/.exec(out)?.[0]
  assert.ok(url, `재설정 링크가 메일에 있다:\n${out.slice(0, 600)}`)
  const token = new URL(url).pathname.split("/").pop()
  assert.equal((await raw(auth, memoryIO(), "POST", "/reset-password", { newPassword: NEW_PASSWORD, token })).status, 200)
  assert.ok((await authAdapter(auth, memoryIO(), quiet).signIn({ method: "password", email, password: NEW_PASSWORD })).ok)
})

test("D74 → 메일 언어: 알림 메일이 받는 사람의 locale·timeZone 으로 렌더된다(@launch-factory/email authEmails)", async () => {
  const lines = []
  const mailer = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const emails = authEmails(mailer, { productName: "SampleCo", defaultLocale: "en", securityUrl: "https://app.example.test/forgot-password", now: () => new Date("2026-09-30T03:00:00Z") })
  const auth = make({ passwordReset: async () => {}, ...emails })
  const { port } = await signedUp(auth, memoryIO({ lang: "ko-KR" }), { timeZone: "Asia/Seoul" })
  lines.length = 0
  assert.ok((await port.changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).ok)
  const out = lines.join("\n")
  assert.match(out, /template=passwordChanged/)
  assert.match(out, /비밀번호가 바뀌었어요/)
  assert.match(out, /2026년 9월 30일 오후 12:00/) // 03:00Z = 서울 12:00
  // 영어 사용자는 영어로
  const { port: enPort } = await signedUp(auth, memoryIO({ lang: "en-US" }), { timeZone: "America/New_York" })
  lines.length = 0
  assert.ok((await enPort.changePassword({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })).ok)
  assert.match(lines.join("\n"), /Your SampleCo password was changed/)
})

test("D09 탈퇴 접수 메일: authEmails 가 받는 사람의 언어로 지워지는 날·취소하는 길(로그인 링크)을 렌더한다 — 잘못된 입력은 아무것도 보내지 않는다", async () => {
  const lines = []
  const mailer = createMailer({ mode: "mock", log: (l) => lines.push(l) })
  const emails = authEmails(mailer, { productName: "SampleCo", defaultLocale: "en" })
  await emails.accountDeletionRequested("jamie@example.com", { graceUntil: "2026-10-07T03:00:00.000Z", signInUrl: "https://app.example.test/sign-in" }, { locale: "ko", timeZone: "Asia/Seoul" })
  const ko = lines.join("\n")
  assert.match(ko, /template=accountDeletionRequested/)
  assert.match(ko, /계정 삭제 요청을 받았어요/)
  assert.match(ko, /2026년 10월 7일 낮 12:00|2026년 10월 7일 오후 12:00/) // 03:00Z = 서울 12:00
  lines.length = 0
  await emails.accountDeletionRequested("jamie@example.com", { graceUntil: "2026-10-07T03:00:00.000Z", signInUrl: "https://app.example.test/sign-in" }, { locale: "en", timeZone: "America/New_York" })
  assert.match(lines.join("\n"), /We received your request to delete your SampleCo account/)
  // 음성: 날짜가 아니면(버그로 undefined 가 오면) 보내지 않고 던진다 — 접수 메일이 조용히 깨지지 않는다
  lines.length = 0
  await assert.rejects(emails.accountDeletionRequested("jamie@example.com", { graceUntil: "soon", signInUrl: "https://app.example.test/sign-in" }))
  assert.equal(lines.length, 0)
})

test("서버 액션(Task 19): 폼으로 비밀번호 변경 — 체크박스가 없으면 다른 기기 유지, 대상 사용자를 입력으로 받지 않는다", async () => {
  const auth = make(recorder().mailer)
  const { email, port } = await signedUp(auth)
  const phone = await otherDevice(auth, email)
  const actions = authActions(port)
  const form = (entries) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(entries)) f.set(k, v)
    return f
  }
  assert.ok((await actions.changePassword(form({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, userId: "someone-else" }))).ok)
  assert.ok((await phone.session()).data)
  assert.ok((await actions.changePassword(form({ currentPassword: NEW_PASSWORD, newPassword: PASSWORD, revokeOtherSessions: "on" }))).ok)
  assert.equal((await phone.session()).data, null)
  const bad = await actions.revokeSession({})
  assert.equal(bad.ok, false)
  assert.ok(bad.fieldErrors.sessionId)
  assert.equal((await d.execute(sql`select count(*)::int as n from "user" where email = ${email}`)).rows[0].n, 1)
})

// ── P1AB A10·A09 확인 링크가 어떤 코드로 돌아오는지 ────────────────────────────────

test("A10·A09 확인 링크 결과: 만료 = TOKEN_EXPIRED · 틀린 서명 = INVALID_TOKEN · 확인된 사람이 유효한 링크를 다시 열면 오류 없는 같은 callback (링크는 한 번만 쓰이지 않는다) — 템플릿 welcomeKind 가 이 값을 읽는다", async () => {
  const { welcomeKind } = await import("../../../template/lib/welcome.ts")
  const { SignJWT } = await import("jose")
  const rec = recorder()
  const auth = make(rec.mailer)
  const { io, port } = await signedUp(auth)
  const CALLBACK = "/?welcome=verified"
  const kindOf = (res) => welcomeKind(new URL(res.headers.get("location"), BASE_URL).searchParams)

  // 만료된 링크(1시간이 지난 토큰 — 같은 비밀로 서명한 과거 만료 JWT)
  const now = Math.floor(Date.now() / 1000)
  const expired = await new SignJWT({ email: (await port.session()).data.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 7200)
    .setExpirationTime(now - 3600)
    .sign(new TextEncoder().encode(SECRET))
  const linkWith = (token) => `${BASE_URL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(CALLBACK)}`
  const r1 = await follow(auth, io, linkWith(expired))
  assert.equal(r1.status, 302)
  assert.equal(r1.headers.get("location"), `${CALLBACK}&error=TOKEN_EXPIRED`)
  assert.equal(kindOf(r1), "expired")
  assert.equal((await port.session()).data.emailVerified, false, "만료된 링크는 확인하지 않는다")

  // 서명이 틀린 링크
  const r2 = await follow(auth, io, linkWith("garbage"))
  assert.equal(r2.headers.get("location"), `${CALLBACK}&error=INVALID_TOKEN`)
  assert.equal(kindOf(r2), "failed")

  // 새 링크를 받아 열면 확인된다
  assert.deepEqual(await port.sendVerificationEmail({ redirectTo: CALLBACK }), { ok: true, data: { sent: true } })
  const fresh = rec.of("verify").at(-1).url
  const r3 = await follow(auth, io, fresh)
  assert.equal(r3.headers.get("location"), CALLBACK)
  assert.equal(kindOf(r3), "verified")
  assert.equal((await port.session()).data.emailVerified, true)

  // 같은 링크를 다시 열면(토큰은 서명 JWT 라 쓴 흔적이 없다) 오류 없이 같은 callback — 「이미 확인됨」과 「방금 확인됨」은 주소만으로 가를 수 없다
  const r4 = await follow(auth, io, fresh)
  assert.equal(r4.headers.get("location"), CALLBACK)
  assert.equal(kindOf(r4), "verified")
  // 확인된 뒤 만료된 옛 링크를 열면 오류 코드가 붙는다 — 화면이 세션의 emailVerified 를 보고 「이미 확인됨」으로 말한다(template welcomeView)
  const r5 = await follow(auth, io, linkWith(expired))
  assert.equal(kindOf(r5), "expired")
  assert.equal((await port.session()).data.emailVerified, true)
})
