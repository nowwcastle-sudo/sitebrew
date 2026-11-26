import { test } from "node:test"
import assert from "node:assert/strict"
import { closeWithin, stopPostgres } from "./scheduler-pg-teardown.mjs"

test("종료 제한은 시간 초과를 실패로 표시하고 정상 완료는 통과한다", async () => {
  await closeWithin(Promise.resolve(), "normal", 100)
  await assert.rejects(closeWithin(new Promise(() => {}), "stuck", 20), /stuck timed out/)
})

test("이미 종료된 DB 프로세스는 놓친 exit 이벤트를 다시 기다리지 않는다", async () => {
  let called = false
  const pg = { process: { exitCode: 0, signalCode: null }, stop: () => { called = true; return new Promise(() => {}) } }
  await stopPostgres(pg)
  assert.equal(called, false)
  assert.equal(pg.process, undefined)
})


test("DB 종료가 멈추면 제한 시간 뒤 실패하며 종료 상태를 정리한다", async () => {
  const pg = { process: { exitCode: null, signalCode: null }, stop: () => new Promise(() => {}) }
  await assert.rejects(stopPostgres(pg, 20), /PostgreSQL stop timed out/)
  assert.equal(pg.process, undefined)
})
