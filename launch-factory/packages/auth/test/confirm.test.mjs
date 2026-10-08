// @launch-factory/auth — 승인 행동의 확인 입력(LFAX M03)과 기계 값(code·retryable, M04·H07).
// 가짜 포트에 호출 기록을 달아, 확인이 없으면 포트가 한 번도 불리지 않는지(부수 효과 0), 있으면 실행되는지를 본다.
import assert from "node:assert/strict"
import test from "node:test"
import { authActions, withMachineCodes } from "../src/index.ts"
import { messages } from "@launch-factory/i18n"

const EMAIL = "me@example.com"

function fakePort({ email = EMAIL, signedIn = true } = {}) {
  const calls = []
  const rec = (name, result) => async (input) => {
    calls.push([name, input])
    return result
  }
  return {
    calls,
    port: {
      session: async () => ({ ok: true, data: signedIn ? { userId: "u1", twoFactor: false, ...(email ? { email } : {}) } : null }),
      changeEmail: rec("changeEmail", { ok: true, data: { emailSent: true } }),
      deleteAccount: rec("deleteAccount", { ok: true, data: { graceUntil: "2026-10-11T00:00:00.000Z" } }),
      exportMyData: rec("exportMyData", { ok: true, data: { profile: {} } }),
      signIn: rec("signIn", { ok: false, formError: "Incorrect email or password.", retryable: false, code: "invalid_credentials" }),
    },
  }
}

const REFUSED = (r) => {
  assert.equal(r.ok, false)
  assert.equal(r.code, "confirmation_required")
  assert.equal(r.retryable, false)
  assert.ok(r.formError && r.fieldErrors?.confirmed?.length, "글과 칸 오류가 함께 온다")
}

test("changeEmail: 확인 입력 없이는 포트를 부르지 않는다 — 있으면 실행하고 다른 칸은 그대로 넘긴다", async () => {
  const { port, calls } = fakePort()
  const a = authActions(port)
  for (const input of [undefined, {}, { newEmail: "new@example.com" }, { newEmail: "new@example.com", confirmed: false }, { newEmail: "new@example.com", confirmed: "no" }]) REFUSED(await a.changeEmail(input))
  assert.deepEqual(calls, [], "거절된 요청은 포트에 닿지 않는다")
  const ok = await a.changeEmail({ newEmail: "new@example.com", currentPassword: "pw", confirmed: true, redirectTo: "/account" })
  assert.deepEqual(ok, { ok: true, data: { emailSent: true } })
  assert.deepEqual(calls, [["changeEmail", { newEmail: "new@example.com", currentPassword: "pw", redirectTo: "/account" }]], "confirmed 는 포트로 새지 않는다")
  // FormData 도 같다
  const fd = new FormData()
  fd.set("newEmail", "new2@example.com")
  fd.set("confirmed", "on")
  assert.equal((await a.changeEmail(fd)).ok, true)
  // 확인은 있는데 다른 칸이 틀리면 invalid_input(칸 오류) — 확인과 별개다
  const bad = await a.changeEmail({ confirmed: true })
  assert.equal(bad.ok, false)
  assert.equal(bad.code, "invalid_input")
  assert.equal(calls.length, 2)
})

test("deleteAccount: 확인 입력과 입력한 이메일 주소가 맞아야만 실행한다 — 서버가 세션의 주소와 직접 맞춰 본다", async () => {
  const { port, calls } = fakePort()
  const a = authActions(port)
  // 확인 없음 → 세션도 묻지 않고 거절
  REFUSED(await a.deleteAccount())
  REFUSED(await a.deleteAccount({ confirmEmail: EMAIL }))
  // 확인은 있는데 주소가 없거나 다르다 → 거절(code 는 같고 칸은 confirmEmail)
  for (const input of [{ confirmed: true }, { confirmed: true, confirmEmail: "" }, { confirmed: true, confirmEmail: "other@example.com" }]) {
    const r = await a.deleteAccount(input)
    assert.equal(r.ok, false)
    assert.equal(r.code, "confirmation_required")
    assert.equal(r.retryable, false)
    assert.ok(r.fieldErrors?.confirmEmail?.length)
  }
  assert.deepEqual(calls, [], "거절된 탈퇴는 포트에 닿지 않는다")
  // 맞으면 실행(대소문자·공백 무시)
  const ok = await a.deleteAccount({ confirmed: true, confirmEmail: ` ${EMAIL.toUpperCase()} ` })
  assert.deepEqual(ok, { ok: true, data: { graceUntil: "2026-10-11T00:00:00.000Z" } })
  assert.deepEqual(calls, [["deleteAccount", undefined]])
})

test("deleteAccount: 이메일이 없는 계정은 주소 입력 칸이 없으니 confirmed 만 있으면 된다 · 로그아웃이면 sign_in_required", async () => {
  const none = fakePort({ email: "" })
  assert.equal((await authActions(none.port).deleteAccount({ confirmed: true })).ok, true)
  assert.deepEqual(none.calls, [["deleteAccount", undefined]])
  const out = fakePort({ signedIn: false })
  const r = await authActions(out.port).deleteAccount({ confirmed: true, confirmEmail: EMAIL })
  assert.equal(r.code, "sign_in_required")
  assert.equal(r.retryable, false)
  assert.deepEqual(out.calls, [])
})

test("exportMyData: 확인 입력 없이는 내 정보를 만들지 않는다", async () => {
  const { port, calls } = fakePort()
  const a = authActions(port)
  REFUSED(await a.exportMyData())
  REFUSED(await a.exportMyData({}))
  REFUSED(await a.exportMyData({ confirmed: false }))
  assert.deepEqual(calls, [])
  assert.deepEqual(await a.exportMyData({ confirmed: true }), { ok: true, data: { profile: {} } })
  assert.deepEqual(calls, [["exportMyData", undefined]])
})

test("모든 authActions 실패 결과가 code·retryable 을 갖는다(칸 오류는 invalid_input, 로그인 실패는 invalid_credentials)", async () => {
  const { port } = fakePort()
  const a = authActions(port)
  const shape = await a.signIn({ method: "nope" })
  assert.deepEqual([shape.ok, shape.code, shape.retryable], [false, "invalid_input", false])
  const wrong = await a.signIn({ method: "password", email: "x@example.com", password: "wrong" })
  assert.deepEqual([wrong.ok, wrong.code, wrong.retryable], [false, "invalid_credentials", false])
})

test("H07: Better Auth 의 429 본문에 code·retryable·retryAfter 를 더하고 Retry-After 헤더를 단다 — 다른 응답은 그대로", async () => {
  const raw = new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), { status: 429, headers: { "content-type": "application/json", "x-retry-after": "7" } })
  const res = await withMachineCodes(raw)
  assert.equal(res.status, 429)
  assert.equal(res.headers.get("retry-after"), "7")
  assert.deepEqual(await res.json(), { message: "Too many requests. Please try again later.", code: "RATE_LIMITED", retryable: true, retryAfter: 7 })
  // 남은 초를 모르면 retryAfter·헤더 없이 code 만
  const noWait = await withMachineCodes(new Response(JSON.stringify({ message: "x" }), { status: 429, headers: { "content-type": "application/json" } }))
  assert.deepEqual(await noWait.json(), { message: "x", code: "RATE_LIMITED", retryable: true })
  assert.equal(noWait.headers.get("retry-after"), null)
  // 본문이 JSON 이 아니어도 깨지지 않는다
  const text = await withMachineCodes(new Response("slow down", { status: 429 }))
  assert.equal((await text.json()).code, "RATE_LIMITED")
  // 이미 code 가 있으면 덮지 않는다
  const own = await withMachineCodes(new Response(JSON.stringify({ code: "CUSTOM", message: "x" }), { status: 429 }))
  assert.equal((await own.json()).code, "CUSTOM")
  // 429 가 아니면 같은 응답 객체를 돌려준다(본문을 읽지도 않는다)
  const fine = new Response(JSON.stringify({ code: "INVALID_EMAIL_OR_PASSWORD", message: "x" }), { status: 401 })
  assert.equal(await withMachineCodes(fine), fine)
  assert.equal(messages("en").protect.confirmationRequired.length > 0, true)
})
