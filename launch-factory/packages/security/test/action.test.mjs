// @launch-factory/security/action — 서버 액션 결과의 기계 값(code·retryable)과 승인 행동 확인 입력(LFAX M03·M04).
import assert from "node:assert/strict"
import test from "node:test"
import { ACTION_CODES, RETRYABLE, coded, confirmEmailOk, confirmationRequiredResult, isAwaitingApproval, machineResult, requireConfirmation, signInRequiredResult } from "../src/action.ts"
import { messages } from "@launch-factory/i18n"

test("requireConfirmation: confirmed 가 true(또는 on·true 문자열)일 때만 통과하고, 나머지 칸은 그대로 돌려준다", () => {
  for (const yes of [true, "on", "true"]) {
    const c = requireConfirmation({ planId: "pro", when: "now", idempotencyKey: "k1", confirmed: yes })
    assert.equal(c.ok, true)
    assert.deepEqual(c.rest, { planId: "pro", when: "now", idempotencyKey: "k1" }, "confirmed 만 빠지고 멱등 키 같은 다른 칸은 그대로")
  }
  // FormData 도 같다
  const fd = new FormData()
  fd.set("confirmed", "on")
  fd.set("newEmail", "a@example.com")
  const f = requireConfirmation(fd)
  assert.equal(f.ok, true)
  assert.deepEqual(f.rest, { newEmail: "a@example.com" })
  // 입력한 이메일 주소(confirmEmail)는 rest 가 아니라 따로 나온다
  const d = requireConfirmation({ confirmed: true, confirmEmail: "me@example.com" })
  assert.equal(d.ok && d.confirmEmail, "me@example.com")
  assert.deepEqual(d.rest, {})
})

test("requireConfirmation: 없거나 true 가 아니면 confirmation_required — 값 모양을 바꿔 가며 전부 거절한다(양성 대조 포함)", () => {
  const cases = [undefined, null, 0, "x", [], {}, { confirmed: false }, { confirmed: "false" }, { confirmed: "yes" }, { confirmed: 1 }, { confirmed: "" }, { confirmed: [true] }, { confirmed: {} }, { Confirmed: true }, { confirm: true }]
  for (const input of cases) {
    const c = requireConfirmation(input)
    assert.equal(c.ok, false, JSON.stringify(input))
    assert.equal(c.failure.code, "confirmation_required")
    assert.equal(c.failure.retryable, false)
    assert.deepEqual(c.failure.fieldErrors, { confirmed: [messages("en").protect.confirmationRequired] })
  }
  assert.equal(requireConfirmation({ confirmed: true }).ok, true, "양성 대조: true 는 통과")
  // 언어
  assert.equal(requireConfirmation({}, "ko").failure.formError, messages("ko").protect.confirmationRequired)
})

test("confirmation_required 는 실패가 아니라 승인 대기다(isAwaitingApproval)", () => {
  assert.equal(isAwaitingApproval(confirmationRequiredResult()), true)
  assert.equal(isAwaitingApproval({ ok: false, code: "rate_limited" }), false)
  assert.equal(isAwaitingApproval({ ok: true }), false)
})

test("confirmEmailOk: 대소문자·앞뒤 공백은 무시하고, 이메일 없는 계정은 확인 칸이 없어 통과한다", () => {
  assert.equal(confirmEmailOk(" Me@Example.com ", "me@example.com"), true)
  assert.equal(confirmEmailOk("other@example.com", "me@example.com"), false)
  assert.equal(confirmEmailOk(undefined, "me@example.com"), false)
  assert.equal(confirmEmailOk("", "me@example.com"), false)
  assert.equal(confirmEmailOk(undefined, undefined), true)
})

test("machineResult: 모든 실패에 code·retryable 을 채운다 — 이미 있는 값은 덮지 않는다", () => {
  const en = messages("en")
  // 성공은 그대로(같은 객체)
  const ok = { ok: true, data: 1 }
  assert.equal(machineResult(ok), ok)
  // 칸 오류 → invalid_input, false
  assert.deepEqual(machineResult({ ok: false, fieldErrors: { email: ["x"] } }), { ok: false, fieldErrors: { email: ["x"] }, code: "invalid_input", retryable: false })
  // 로그인 필요 문구만 있는 옛 결과 → sign_in_required (두 언어)
  assert.equal(machineResult({ ok: false, formError: en.auth.signInRequired }).code, "sign_in_required")
  assert.equal(machineResult({ ok: false, formError: messages("ko").auth.signInRequired }).code, "sign_in_required")
  // retryable 만 true → provider_unavailable, true
  assert.deepEqual(machineResult({ ok: false, formError: "x", retryable: true }), { ok: false, formError: "x", retryable: true, code: "provider_unavailable" })
  // 그 밖 → action_failed, false
  assert.deepEqual(machineResult({ ok: false, formError: "x" }), { ok: false, formError: "x", code: "action_failed", retryable: false })
  // code 만 있으면 retryable 은 표가 정한다
  assert.equal(machineResult({ ok: false, formError: "x", code: "rate_limited", retryAfter: 10 }).retryable, true)
  assert.equal(machineResult({ ok: false, formError: "x", code: "confirmation_required" }).retryable, false)
  // 공급자가 준 더 넓은 문자열은 그대로 두고 retryable 은 false
  assert.deepEqual(machineResult({ ok: false, formError: "x", code: "trial_unavailable" }), { ok: false, formError: "x", code: "trial_unavailable", retryable: false })
  // 있는 값은 덮지 않는다
  assert.deepEqual(machineResult({ ok: false, formError: "x", code: "rate_limited", retryable: false }).retryable, false)
  // 글이 하나도 없는 실패에는 일반 문구를 더한다(빈 실패를 보이지 않는다)
  assert.equal(machineResult({ ok: false }).formError, en.protect.actionFailed)
})

test("RETRYABLE 표는 닫힌 code 목록과 짝이 맞고, 사람이 먼저 해야 하는 code 는 false 다", () => {
  assert.deepEqual(Object.keys(RETRYABLE).sort(), [...ACTION_CODES].sort())
  for (const c of ["sign_in_required", "confirmation_required", "invalid_input", "invalid_credentials", "invalid_token"]) assert.equal(RETRYABLE[c], false, c)
  for (const c of ["rate_limited", "provider_unavailable", "in_progress"]) assert.equal(RETRYABLE[c], true, c)
})

test("coded: 액션 함수를 감싸 어떤 실패든 기계 값을 갖고 나간다", async () => {
  const f = coded(async (n) => (n > 0 ? { ok: true, data: n } : { ok: false, fieldErrors: { n: ["bad"] } }))
  assert.deepEqual(await f(1), { ok: true, data: 1 })
  assert.equal((await f(0)).code, "invalid_input")
  assert.deepEqual(signInRequiredResult("en"), { ok: false, code: "sign_in_required", retryable: false, formError: messages("en").auth.signInRequired })
})
