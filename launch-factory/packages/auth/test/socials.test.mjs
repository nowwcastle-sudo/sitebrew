// 소셜 로그인 켜는 규칙과 구글 흐름(v0 소셜 레인). DB 는 PGlite 메모리, 네트워크는 쓰지 않는다(구글 토큰 응답은 fetch 가짜).
// 규칙: 공급자마다 <P>_CLIENT_ID·<P>_CLIENT_SECRET 둘 다 있으면 켠다. 하나만 있으면 켜지 않는다(createAuth 에 넘기지 않으니 던지지도 않는다).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { eq, sql } from "drizzle-orm"
import { consentRecords, db, user as userTable } from "@launch-factory/db"
import { AUTH_MESSAGES, authActions, authAdapter, createAuth, SOCIAL_ENV_NAMES, socialsFromEnv } from "../src/index.ts"
import * as envPkg from "../../env/src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다. 형식만 구글을 닮았다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const GOOGLE_ID = "1234567890-lftestclientid.apps.googleusercontent.com"
const GOOGLE_SECRET = "GOCSPX-lf-test-not-real"
const KEYS = { GOOGLE_CLIENT_ID: GOOGLE_ID, GOOGLE_CLIENT_SECRET: GOOGLE_SECRET }
const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const consents = { terms: true, privacy: true, ageOver14: true }
const quiet = { onError: () => {}, errorCallbackURL: "/sign-in" }

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let ipSeq = 0
function memoryIO() {
  const jar = new Map()
  const ip = `198.51.100.${++ipSeq}`
  return {
    headers() {
      const h = new Headers({ "x-forwarded-for": ip, "user-agent": "lf-test" })
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
const makeAuth = (socials, env) => createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: CONSENT_VERSIONS, socials, env })
async function raw(auth, io, method, path, body) {
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  if (body) headers.set("content-type", "application/json")
  const res = await auth.handler(new Request(BASE_URL + "/api/auth" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  io.setCookies(res.headers.getSetCookie())
  return res
}

test("켜는 규칙: 공급자마다 ID·비밀이 둘 다 있을 때만 켠다 · 하나만 있으면 켜지 않고 빠진 이름을 알린다 · 빈 값은 없는 것", () => {
  assert.deepEqual(socialsFromEnv({}), { enabled: [], partial: [] })
  assert.deepEqual(socialsFromEnv(KEYS), { enabled: ["google"], partial: [] })
  assert.deepEqual(socialsFromEnv({ GOOGLE_CLIENT_ID: "x" }), { enabled: [], partial: [{ provider: "google", missing: ["GOOGLE_CLIENT_SECRET"] }] })
  assert.deepEqual(socialsFromEnv({ KAKAO_CLIENT_SECRET: "x" }), { enabled: [], partial: [{ provider: "kakao", missing: ["KAKAO_CLIENT_ID"] }] })
  assert.deepEqual(socialsFromEnv({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "" }).enabled, [])
  assert.deepEqual(socialsFromEnv({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "   " }).enabled, [])
  // 켜는 순서는 SOCIAL_PROVIDERS 순서(google·kakao·naver)이고, 켜진 것과 반쪽이 섞일 수 있다
  const mixed = socialsFromEnv({ NAVER_CLIENT_ID: "n", NAVER_CLIENT_SECRET: "n", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "g", KAKAO_CLIENT_ID: "k" })
  assert.deepEqual(mixed.enabled, ["google", "naver"])
  assert.deepEqual(mixed.partial, [{ provider: "kakao", missing: ["KAKAO_CLIENT_SECRET"] }])
})

test("환경 읽기 목록: 소셜 키 이름 여섯이 모두 env 패키지의 비밀(SECRET)·설정값(PLAIN) 목록에 있다 — 앱·doctor 가 같은 이름을 읽는다", () => {
  assert.equal(SOCIAL_ENV_NAMES.length, 6)
  for (const n of SOCIAL_ENV_NAMES) {
    const secret = n.endsWith("_CLIENT_SECRET")
    assert.ok((secret ? envPkg.SECRET_NAMES : envPkg.PLAIN_NAMES).includes(n), `${n} 이 ${secret ? "SECRET_NAMES" : "PLAIN_NAMES"} 에 없다`)
  }
})

test("구글을 켜면 methods 에 google 이 있고, signIn 은 accounts.google.com 로 가는 주소(콜백 /api/auth/callback/google)를 만든다 — 키가 없으면 버튼 목록에도 없고 거절된다", async () => {
  const { enabled } = socialsFromEnv(KEYS)
  const on = authAdapter(makeAuth(enabled, KEYS), memoryIO(), quiet)
  assert.deepEqual(await on.methods(), { ok: true, data: ["password", "google"] })
  const r = await on.signIn({ method: "google" })
  assert.ok(r.ok, JSON.stringify(r))
  const url = new URL(r.data.redirectUrl)
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth")
  assert.equal(url.searchParams.get("client_id"), GOOGLE_ID)
  assert.equal(url.searchParams.get("redirect_uri"), `${BASE_URL}/api/auth/callback/google`)
  assert.equal(url.searchParams.get("response_type"), "code")
  assert.deepEqual(url.searchParams.get("scope")?.split(" ").sort(), ["email", "openid", "profile"])
  assert.equal(url.searchParams.get("code_challenge_method"), "S256")
  assert.ok(url.searchParams.get("state"))
  // 비밀은 주소에 실리지 않는다
  assert.ok(!r.data.redirectUrl.includes(GOOGLE_SECRET))
  // 템플릿의 서버 액션(authActions — 블록이 부르는 입구)도 같은 주소를 낸다: 로그인은 동의 없이, 가입은 동의를 싣고
  const actions = authActions(on)
  const viaSignIn = await actions.signIn({ method: "google" })
  const viaSignUp = await actions.signUp({ method: "google", consents: { terms: true, privacy: true, ageOver14: true } })
  for (const x of [viaSignIn, viaSignUp]) {
    assert.ok(x.ok, JSON.stringify(x))
    assert.equal(new URL(x.data.redirectUrl).origin, "https://accounts.google.com")
  }

  // 키가 없으면: socials 가 비어 있다(앱의 규칙) → 방법 목록에 없고, 직접 불러도 거절된다
  const off = authAdapter(makeAuth(socialsFromEnv({}).enabled, {}), memoryIO(), quiet)
  assert.deepEqual(await off.methods(), { ok: true, data: ["password"] })
  assert.deepEqual(await off.signIn({ method: "google" }), { ok: false, formError: AUTH_MESSAGES.methodUnavailable })
  // 반쪽 키(ID 만): 켜지 않는다 — 던지지도 않는다
  const half = socialsFromEnv({ GOOGLE_CLIENT_ID: GOOGLE_ID })
  assert.deepEqual(await authAdapter(makeAuth(half.enabled, { GOOGLE_CLIENT_ID: GOOGLE_ID }), memoryIO(), quiet).methods(), { ok: true, data: ["password"] })
})

test("구글 가입은 동의를 거친다: 동의 없이는 시작도 못 하고, 가입 없이 로그인하면 계정이 생기지 않으며(signup_disabled), 동의를 받은 가입만 계정과 동의 기록 7줄을 만든다", async () => {
  const auth = makeAuth(["google"], KEYS)
  const realFetch = globalThis.fetch
  let sub = 100
  const idToken = (profile) => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
    return `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: "https://accounts.google.com", aud: GOOGLE_ID, ...profile })}.sig`
  }
  const googleFetch = (profile) => async (input, init) => {
    const u = String(input instanceof Request ? input.url : input)
    if (u.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access", token_type: "Bearer", expires_in: 3600, id_token: idToken(profile) })
    return realFetch(input, init)
  }
  const callback = async (io, startUrl, profile) => {
    const state = new URL(startUrl).searchParams.get("state")
    globalThis.fetch = googleFetch(profile)
    try {
      return (await raw(auth, io, "GET", `/callback/google?code=test-code&state=${encodeURIComponent(state)}`)).headers.get("location")
    } finally {
      globalThis.fetch = realFetch
    }
  }
  const profileOf = (n) => ({ sub: String(n), email: `google${n}@example.com`, email_verified: true, name: `구글${n}` })
  const usersWith = async (email) => (await d.execute(sql`select count(*)::int as n from "user" where email = ${email}`)).rows[0].n

  // 1) 동의 없이 가입을 시작하면 막힌다(어댑터가 먼저 본다)
  const io = memoryIO()
  const port = authAdapter(auth, io, quiet)
  assert.deepEqual(await port.signUp({ method: "google", consents: { terms: true, privacy: true } }), { ok: false, fieldErrors: { ageOver14: [AUTH_MESSAGES.ageOver14Required] } })

  // 2) 가입 안 한 구글 계정으로 로그인 → 사용자를 만들지 않고, 실패 경로(/sign-in?error=signup_disabled)로 돌아온다
  const a = sub++
  const start2 = await port.signIn({ method: "google" })
  assert.ok(start2.ok)
  const loc2 = await callback(io, start2.data.redirectUrl, profileOf(a))
  assert.match(loc2 ?? "", /\/sign-in\?error=signup_disabled/)
  assert.equal(await usersWith(profileOf(a).email), 0)
  assert.equal(await port.session().then((s) => s.data), null)

  // 3) 동의를 받은 가입 → 계정 + 동의 기록(약관·개인정보·만 14세·마케팅 4채널 = 7줄)
  const start3 = await port.signUp({ method: "google", consents })
  assert.ok(start3.ok, JSON.stringify(start3))
  assert.equal(await callback(io, start3.data.redirectUrl, profileOf(a)), "/")
  const s3 = await port.session()
  assert.ok(s3.ok && s3.data)
  assert.equal(s3.data.email, profileOf(a).email)
  const [row] = await d.select().from(userTable).where(eq(userTable.id, s3.data.userId))
  assert.equal(row.emailVerified, true)
  const rows = await d.select().from(consentRecords).where(eq(consentRecords.userId, row.id))
  assert.equal(rows.length, 7)
  assert.deepEqual([...new Set(rows.map((x) => x.source))], ["sign_up"])
  assert.equal(rows.find((x) => x.kind === "terms")?.version, CONSENT_VERSIONS.terms)

  // 4) 같은 구글 계정으로 다시 로그인하면 같은 사용자
  const io4 = memoryIO()
  const port4 = authAdapter(auth, io4, quiet)
  const start4 = await port4.signIn({ method: "google" })
  assert.equal(await callback(io4, start4.data.redirectUrl, profileOf(a)), "/")
  assert.equal((await port4.session()).data?.userId, row.id)

  // 5) 어댑터를 건너뛴 직접 호출: requestSignUp 인데 동의가 없거나 만 14세 확인이 빠지면 계정을 만들지 않는다 — 양성 대조로 같은 호출에 동의를 실으면 만들어진다
  const direct = async (n, additionalData) => {
    const ioD = memoryIO()
    const start = await raw(auth, ioD, "POST", "/sign-in/social", { provider: "google", callbackURL: "/", requestSignUp: true, additionalData })
    return callback(ioD, (await start.json()).url, profileOf(n))
  }
  const b = sub++
  const c = sub++
  // 어댑터를 거치지 않은 호출이라 errorCallbackURL 이 없다 → Better Auth 기본 오류 경로로 간다(코드는 CONSENT_REQUIRED)
  assert.match((await direct(b, undefined)) ?? "", /\/error\?error=CONSENT_REQUIRED/)
  assert.match((await direct(c, { lfConsents: { terms: true, privacy: true } })) ?? "", /\/error\?error=CONSENT_REQUIRED/)
  assert.equal((await usersWith(profileOf(b).email)) + (await usersWith(profileOf(c).email)), 0)
  const e = sub
  assert.equal(await direct(e, { lfConsents: consents }), "/")
  assert.equal(await usersWith(profileOf(e).email), 1)
})
