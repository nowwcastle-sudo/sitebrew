// 가입·로그인 성공 안내(UXOK)가 기대는 서버 쪽 약속: 도착 화면의 `?welcome=` 표지가 실제 Better Auth 흐름의 끝 주소에 실려 온다.
// DB 는 PGlite 메모리, 네트워크는 쓰지 않는다(구글 토큰 응답은 fetch 가짜 — socials.test.mjs 와 같은 방식).
//   ① 확인 메일 링크의 callbackURL 이 emailVerifiedPath 이고, 링크를 열면 그 주소로 간다(다시 보내기 메일도 같다) · 틀린 링크는 같은 주소에 error= 가 붙는다 · 옵션이 없으면 예전처럼 `/`
//   ② 소셜 가입·로그인은 redirectTo 로 준 주소에서 끝난다(같은 출처만 — 남의 주소는 `/` 로)
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { db } from "@launch-factory/db"
import { authAdapter, createAuth } from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const GOOGLE_ID = "1234567890-lftestclientid.apps.googleusercontent.com"
const KEYS = { GOOGLE_CLIENT_ID: GOOGLE_ID, GOOGLE_CLIENT_SECRET: "GOCSPX-lf-test-not-real" }
const CONSENT_VERSIONS = { terms: "terms-2026-09-30", privacy: "privacy-2026-09-30" }
const consents = { terms: true, privacy: true, ageOver14: true }
const VERIFIED = "/?welcome=verified"

let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let seq = 0
function memoryIO() {
  const jar = new Map()
  const ip = `203.0.113.${++seq}`
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
  const res = await auth.handler(new Request(new URL(url), { method: "GET", headers: io.headers() }))
  io.setCookies(res.headers.getSetCookie())
  return res
}
function recorder() {
  const mails = []
  return {
    mails,
    mailer: {
      passwordReset: async () => {},
      verifyEmail: async (to, url) => void mails.push({ to, url }),
      changeEmailConfirm: async () => {},
      emailChanged: async () => {},
      passwordChanged: async () => {},
    },
  }
}
const quiet = { onError: () => {}, errorCallbackURL: "/sign-in" }
const makeAuth = (extra) => createAuth({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: CONSENT_VERSIONS, ...extra })

test("확인 메일 링크가 도착 표지로 닿는다: callbackURL=emailVerifiedPath · 열면 그 주소 · 다시 보내기도 같다 · 틀린 링크는 error= 가 붙는다 · 옵션이 없으면 `/`", async () => {
  const rec = recorder()
  const auth = makeAuth({ mailer: rec.mailer })
  const io = memoryIO()
  const port = authAdapter(auth, io, { ...quiet, emailVerifiedPath: VERIFIED })
  const r = await port.signUp({ method: "password", email: "uxok1@example.com", password: PASSWORD, consents })
  assert.ok(r.ok, JSON.stringify(r))
  assert.equal(rec.mails.length, 1)
  const link = new URL(rec.mails[0].url)
  assert.equal(link.searchParams.get("callbackURL"), VERIFIED)

  // 같은 브라우저(가입 때 로그인된 채)로 열면 확인되고 표지 주소로 간다
  assert.equal((await port.session()).data.emailVerified, false)
  const ok = await follow(auth, io, link)
  assert.equal(ok.status, 302)
  assert.equal(ok.headers.get("location"), VERIFIED)
  assert.equal((await port.session()).data.emailVerified, true)

  // 다시 보내기(가입 직후 안내의 버튼 — 아직 확인 전인 다른 사용자)도 같은 표지를 싣는다
  const io2 = memoryIO()
  const port2 = authAdapter(auth, io2, { ...quiet, emailVerifiedPath: VERIFIED })
  assert.ok((await port2.signUp({ method: "password", email: "uxok2@example.com", password: PASSWORD, consents })).ok)
  assert.deepEqual(await port2.sendVerificationEmail(), { ok: true, data: { sent: true } })
  assert.equal(rec.mails.length, 3)
  assert.equal(new URL(rec.mails[2].url).searchParams.get("callbackURL"), VERIFIED)

  // 틀린 토큰: 표지 주소에 error= 가 덧붙는다 — 화면이 이것을 성공 글로 읽지 않는다(welcome-notice 의 failed)
  const bad = new URL(rec.mails[2].url)
  bad.searchParams.set("token", bad.searchParams.get("token").slice(0, -3) + "xxx")
  const failed = await follow(auth, io2, bad)
  assert.equal(failed.status, 302)
  const loc = new URL(failed.headers.get("location"), BASE_URL)
  assert.equal(loc.pathname, "/")
  assert.equal(loc.searchParams.get("welcome"), "verified")
  assert.ok(loc.searchParams.get("error"), loc.href)
  assert.equal((await port2.session()).data.emailVerified, false)

  // 옵션이 없으면 예전 동작: 링크의 callbackURL 은 Better Auth 기본(`/`)
  const rec3 = recorder()
  const auth3 = makeAuth({ mailer: rec3.mailer })
  const port3 = authAdapter(auth3, memoryIO(), quiet)
  assert.ok((await port3.signUp({ method: "password", email: "uxok3@example.com", password: PASSWORD, consents })).ok)
  assert.equal(new URL(rec3.mails[0].url).searchParams.get("callbackURL"), "/")
})

test("소셜 가입·로그인은 redirectTo 로 준 표지 주소에서 끝난다(같은 출처만)", async () => {
  const auth = makeAuth({ socials: ["google"], env: KEYS })
  const realFetch = globalThis.fetch
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const profile = { sub: "9001", email: "uxok-google@example.com", email_verified: true, name: "UXOK" }
  const idToken = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: "https://accounts.google.com", aud: GOOGLE_ID, ...profile })}.sig`
  const callback = async (io, startUrl) => {
    const state = new URL(startUrl).searchParams.get("state")
    globalThis.fetch = async (input, init) => {
      const u = String(input instanceof Request ? input.url : input)
      if (u.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access", token_type: "Bearer", expires_in: 3600, id_token: idToken })
      return realFetch(input, init)
    }
    try {
      return (await raw(auth, io, "GET", `/callback/google?code=test-code&state=${encodeURIComponent(state)}`)).headers.get("location")
    } finally {
      globalThis.fetch = realFetch
    }
  }

  // 가입: 동의를 받고 구글을 다녀오면 `/?welcome=signup`
  const io = memoryIO()
  const port = authAdapter(auth, io, quiet)
  const up = await port.signUp({ method: "google", consents, redirectTo: "/?welcome=signup" })
  assert.ok(up.ok, JSON.stringify(up))
  assert.equal(await callback(io, up.data.redirectUrl), "/?welcome=signup")
  assert.ok((await port.session()).data)

  // 로그인(다른 브라우저): `/?welcome=signin`
  const io2 = memoryIO()
  const port2 = authAdapter(auth, io2, quiet)
  const inn = await port2.signIn({ method: "google", redirectTo: "/?welcome=signin" })
  assert.ok(inn.ok, JSON.stringify(inn))
  assert.equal(await callback(io2, inn.data.redirectUrl), "/?welcome=signin")
  assert.ok((await port2.session()).data)

  // 남의 출처는 받지 않는다(안전한 기본 `/` 로) — 표지가 붙어 있어도 마찬가지
  const io3 = memoryIO()
  const port3 = authAdapter(auth, io3, quiet)
  const evil = await port3.signIn({ method: "google", redirectTo: "https://evil.example/?welcome=signin" })
  assert.ok(evil.ok)
  assert.equal(await callback(io3, evil.data.redirectUrl), "/")

  // 표지 없이 부르면 예전처럼 `/`
  const io4 = memoryIO()
  const plain = await authAdapter(auth, io4, quiet).signIn({ method: "google" })
  assert.equal(await callback(io4, plain.data.redirectUrl), "/")
})
