// guardKeep — 훅·시험 본문이 던지면 보존 표시를 하고 오류는 그대로 다시 던진다. 가벼운 시험(브라우저·서버 없음).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { guardKeep } from './lib/keep-on-fail.mjs'

test('guardKeep: 던지면 보존 표시를 한 뒤 같은 오류를 다시 던진다 · 성공하면 값을 돌려주고 표시하지 않는다', async () => {
  let keep = false
  const boom = new Error('before 훅 실패')
  await assert.rejects(guardKeep(async () => { throw boom }, () => { keep = true })(), (e) => e === boom)
  assert.equal(keep, true)
  keep = false
  assert.equal(await guardKeep(async (a, b) => a + b, () => { keep = true })(1, 2), 3)
  assert.equal(keep, false)
})
