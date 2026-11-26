import assert from "node:assert/strict"
import { test } from "node:test"
import { clientFailureClass, httpFailure, serverFailureClasses } from "./toss-e2e-diagnostics.mjs"

test("오류 진단은 분류와 HTTP 상태만 남기고 인증값과 쿼리를 출력하지 않는다", () => {
  const log = "TypeError: authKey=fake_secret&state=fake_state Cookie: private\nError: Cannot find module fake_secret"
  const result = JSON.stringify(serverFailureClasses(log))
  assert.deepEqual(serverFailureClasses(log), ["module_not_found", "type_error"])
  assert.doesNotMatch(result, /fake_secret|fake_state|Cookie|private/)
  assert.equal(httpFailure("anonymous_charge", 503, 401).message, "HTTP anonymous_charge: expected 401, got 503")
  assert.throws(() => httpFailure("state=fake", 503, 401), /Invalid diagnostic input/)
  assert.equal(clientFailureClass(new Error("Timeout cookie=fake_secret")), "request_timeout")
})
