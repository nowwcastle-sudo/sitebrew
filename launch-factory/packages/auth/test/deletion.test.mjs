// @launch-factory/auth — 셀프 탈퇴(LaunchAuthPort.deleteAccount·exportMyData)와 「유예 중 로그인하면 취소」(v0 Task 14).
// 실제 Better Auth(PGlite 메모리)로 돈다. 결제는 가짜 포트. 네트워크 없음.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { eq } from "drizzle-orm"
import { accountDeletions, db, session as sessionTable } from "@launch-factory/db"
import { exportMyData, requestAccountDeletion } from "@launch-factory/account-lifecycle"
import { AUTH_MESSAGES, authAdapter, createAuth } from "../src/index.ts"

// 고정 시험값 — 실제 비밀이 아니다.
const SECRET = "lf-test-secret-not-real-0123456789abcdef"
const BASE_URL = "http://localhost:3000"
const PASSWORD = "Correct-Horse-Battery-9"
const consents = { terms: true, privacy: true, ageOver14: true }

/** @type {Awaited<ReturnType<typeof db.local>>} */
let d
before(async () => {
  d = await db.local()
})
after(async () => {
  await d?.$client.close()
})

let ipSeq = 0
let emailSeq = 0
const nextEmail = () => `deleter${++emailSeq}@example.com`

function memoryIO(ip = `198.51.100.${++ipSeq}`) {
  const jar = new Map()
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

function billing(init = {}) {
  const state = { status: "active", failCancel: false, cancels: [], ...init }
  return {
    state,
    billingFor: () => ({
      subscription: async () => ({ ok: true, data: { planId: "pro", status: state.status } }),
      cancel: async (input) => {
        state.cancels.push(input.when)
        if (state.failCancel) return { ok: false, formError: "x", retryable: true }
        state.status = "canceled"
        return { ok: true, data: { planId: "pro", status: "canceled" } }
      },
    }),
  }
}

const lifecycle = (b) => ({ requestDeletion: (userId) => requestAccountDeletion({ db: d, billingFor: b.billingFor }, userId), exportData: (userId) => exportMyData(d, userId) })
const options = (extra = {}) => ({ db: d, secret: SECRET, baseURL: BASE_URL, onError: () => {}, consentVersions: { terms: "t1", privacy: "p1" }, ...extra })
const statusOf = async (userId) => (await d.select().from(accountDeletions).where(eq(accountDeletions.userId, userId))).map((r) => r.status)

test("탈퇴: 구독 해지 → 유예 기록 → 세션 끊김, 유예 중 비밀번호로 다시 로그인하면 취소된다 · 내려받기는 본인 것", async () => {
  const auth = createAuth(options())
  const b = billing()
  const email = nextEmail()
  const io = memoryIO()
  const port = authAdapter(auth, io, { onError: () => {}, account: lifecycle(b) })
  assert.ok((await port.signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  const me = (await port.session()).data.userId

  const mine = await port.exportMyData()
  assert.equal(mine.ok, true)
  assert.equal(mine.data.profile.email, email)

  const del = await port.deleteAccount()
  assert.equal(del.ok, true, JSON.stringify(del))
  assert.ok(Date.parse(del.data.graceUntil) > Date.now() + 6 * 24 * 3600 * 1000)
  assert.deepEqual(b.state.cancels, ["period_end"])
  assert.deepEqual(await statusOf(me), ["pending"])
  assert.deepEqual(await port.session(), { ok: true, data: null })
  assert.equal((await d.select().from(sessionTable).where(eq(sessionTable.userId, me))).length, 0)
  // 로그인하지 않은 채로는 탈퇴·내려받기를 못 한다
  // LFAX M04: 로그인 필요 결과는 기계가 읽는 code·retryable 을 갖는다
  const SIGN_IN = { ok: false, formError: AUTH_MESSAGES.signInRequired, retryable: false, code: "sign_in_required" }
  assert.deepEqual(await port.deleteAccount(), SIGN_IN)
  assert.deepEqual(await port.exportMyData(), SIGN_IN)

  // 유예 중 로그인 → 취소
  assert.deepEqual(await port.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: {} })
  assert.deepEqual(await statusOf(me), ["cancelled"])
  // 틀린 비밀번호는 취소하지 않는다
  assert.ok((await port.deleteAccount()).ok)
  assert.equal((await port.signIn({ method: "password", email, password: "Wrong-Password-000" })).ok, false)
  assert.deepEqual((await statusOf(me)).sort(), ["cancelled", "pending"])
})

test("2단계가 켜진 계정: 비밀번호만으로는 탈퇴가 취소되지 않고, 2단계 확인까지 마쳐야 취소된다", async () => {
  const auth = createAuth(options({ twoFactor: true, appName: "LF Test" }))
  const email = nextEmail()
  const io = memoryIO()
  const port = authAdapter(auth, io, { onError: () => {}, account: lifecycle(billing({ status: "none" })) })
  assert.ok((await port.signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  const headers = io.headers()
  headers.set("origin", BASE_URL)
  headers.set("content-type", "application/json")
  const enable = await auth.handler(new Request(`${BASE_URL}/api/auth/two-factor/enable`, { method: "POST", headers, body: JSON.stringify({ password: PASSWORD }) }))
  io.setCookies(enable.headers.getSetCookie())
  const secret = new URL((await enable.json()).totpURI).searchParams.get("secret")
  const step = Math.floor(Date.now() / 30000)
  const confirm = await port.verifyTwoFactor({ code: totp(secret, step) })
  assert.ok(confirm.ok, JSON.stringify(confirm))
  const me = confirm.data.userId

  assert.ok((await port.deleteAccount()).ok)
  assert.deepEqual(await port.signIn({ method: "password", email, password: PASSWORD }), { ok: true, data: { needsTwoFactor: true } })
  assert.deepEqual(await statusOf(me), ["pending"], "비밀번호만으로는 취소되지 않는다")
  const ok = await port.verifyTwoFactor({ code: totp(secret, step + 1) })
  assert.ok(ok.ok, JSON.stringify(ok))
  assert.deepEqual(await statusOf(me), ["cancelled"])
})

test("탈퇴: 구독 해지가 실패하면 탈퇴하지 않고 로그인도 유지 · 처리기가 없으면 조용히 성공하지 않는다", async () => {
  const auth = createAuth(options())
  const b = billing({ failCancel: true })
  const email = nextEmail()
  const io = memoryIO()
  const port = authAdapter(auth, io, { onError: () => {}, account: lifecycle(b) })
  assert.ok((await port.signUp({ method: "password", email, password: PASSWORD, consents })).ok)
  const me = (await port.session()).data.userId
  assert.deepEqual(await port.deleteAccount(), { ok: false, formError: AUTH_MESSAGES.subscriptionCancelFailed, retryable: true })
  assert.deepEqual(await statusOf(me), [])
  assert.equal((await port.session()).data?.userId, me)

  const errors = []
  const bare = authAdapter(auth, io, { onError: (e) => errors.push(String(e)) })
  assert.deepEqual(await bare.deleteAccount(), { ok: false, formError: AUTH_MESSAGES.deletionUnavailable })
  assert.deepEqual(await bare.exportMyData(), { ok: false, formError: AUTH_MESSAGES.deletionUnavailable })
  assert.equal(errors.length, 2)
})
