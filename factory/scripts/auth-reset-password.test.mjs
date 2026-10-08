// 비밀번호 재설정 마무리(P3-5 I18N, 대장 D236) — AuthPort.resetPassword(선택 메서드, 판 그대로 2)·mockAuth·적합성 시나리오·auth/new-password 블록.
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/auth-reset-password.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, baseOk, git, h, html, load, renderToStaticMarkup, root } from './lib/base-compare.mjs'

const MOCK = 'registry/factory/contract/adapter-mock.ts'

test('D236: mockAuth.resetPassword — 가상 토큰만 한 번 통하고, 빈 토큰·모르는 토큰·이미 쓴 토큰·짧은 비밀번호는 거절한다', async () => {
  const { mockAuth, MOCK_RESET_TOKEN } = await load(MOCK)
  const a = mockAuth('?auth=signed-out')
  assert.equal(typeof a.resetPassword, 'function')
  const empty = await a.resetPassword({ token: '', newPassword: 'Passw0rd!123' })
  assert.equal(empty.ok, false)
  assert.ok(empty.fieldErrors?.token?.length)
  const unknown = await a.resetPassword({ token: 'nope', newPassword: 'Passw0rd!123' })
  assert.deepEqual([unknown.ok, unknown.code], [false, 'invalid_token'])
  const short = await a.resetPassword({ token: MOCK_RESET_TOKEN, newPassword: 'short' })
  assert.equal(short.ok, false)
  assert.ok(short.fieldErrors?.newPassword?.length)
  assert.deepEqual(await a.resetPassword({ token: MOCK_RESET_TOKEN, newPassword: 'Passw0rd!123' }), { ok: true, data: {} })
  const again = await a.resetPassword({ token: MOCK_RESET_TOKEN, newPassword: 'Passw0rd!123' })
  assert.deepEqual([again.ok, again.code], [false, 'invalid_token'], '토큰은 한 번만')
  // 다른 포트(새 mockAuth)는 따로 센다, ?submit= 결과도 따른다
  assert.equal((await mockAuth('').resetPassword({ token: MOCK_RESET_TOKEN, newPassword: 'Passw0rd!123' })).ok, true)
  assert.equal((await mockAuth('?submit=server-error').resetPassword({ token: MOCK_RESET_TOKEN, newPassword: 'Passw0rd!123' })).ok, false)
})

test('D236: 계약 — AuthPort.resetPassword 는 선택 메서드(판 그대로 2)이고, requestPasswordReset 은 이미 있었다', () => {
  const ports = readFileSync(join(root, 'registry', 'factory', 'contract', 'ports.ts'), 'utf8')
  assert.match(ports, /requestPasswordReset\(input: \{ email: string \}\)/)
  assert.match(ports, /resetPassword\?\(input: \{ token: string; newPassword: string \}\): Promise<ActionResult<Record<string, never>>>/)
  const events = readFileSync(join(root, 'registry', 'factory', 'contract', 'events.ts'), 'utf8')
  assert.match(events, /CONTRACT_VERSION\s*=\s*2\b/)
})

test('D236: 적합성 묶음 — resetPassword 가 있는 목은 새 시나리오 둘을 통과하고, 없는 어댑터도 통과하며, 모르는 토큰을 받아주는 어댑터는 실패한다(음성 대조)', async () => {
  const { authConformance } = await load('registry/factory/contract/conformance/auth.ts')
  const { mockAuth } = await load(MOCK)
  const make = ({ auth }) => (auth === 'error' ? mockAuth('?state=error') : mockAuth(`?auth=${auth}`))
  const ids = (rs) => rs.map((r) => r.id)
  const full = await authConformance(make)
  assert.deepEqual(full.filter((r) => !r.ok), [])
  for (const id of ['auth.signed-out.reset-password-unknown-token', 'auth.signed-out.reset-password-empty-token']) assert.ok(ids(full).includes(id), id)
  const without = await authConformance((s) => { const p = make(s); const { resetPassword: _drop, ...rest } = p; return rest })
  assert.deepEqual(without.filter((r) => !r.ok), [], '선택 메서드가 없는 어댑터도 계약을 지킨다')
  const lax = await authConformance((s) => ({ ...make(s), resetPassword: async () => ({ ok: true, data: {} }) }))
  assert.deepEqual(ids(lax.filter((r) => !r.ok)).sort(), ['auth.signed-out.reset-password-empty-token', 'auth.signed-out.reset-password-unknown-token'])
  const wrongCode = await authConformance((s) => ({ ...make(s), resetPassword: async ({ token }) => (token ? { ok: false, formError: '안 돼요' } : { ok: false, formError: '안 돼요' }) }))
  assert.deepEqual(ids(wrongCode.filter((r) => !r.ok)), ['auth.signed-out.reset-password-unknown-token'], 'invalid_token code 가 없으면 실패')
})

test('D236: auth/new-password 블록 — 토큰이 있으면 두 칸 폼, 없으면 틀린 링크 안내(폼 없음), 규약 표지', async () => {
  const mod = await load('registry/factory/blocks/auth/new-password.tsx')
  const fx = await load('registry/factory/blocks/auth/new-password.fixture.ts')
  const form = html(h(mod.AuthNewPassword, fx.fixture))
  assert.match(form, /data-block="auth-new-password"/)
  assert.match(form, /<h2[^>]*>새 비밀번호를 만들어요/)
  assert.equal((form.match(/type="password"/g) ?? []).length, 2)
  assert.match(form, /autoComplete="new-password"|autocomplete="new-password"/i)
  assert.doesNotMatch(form, /data-link-invalid/)
  const bad = html(h(mod.AuthNewPassword, { ...fx.fixture, token: '' }))
  assert.match(bad, /data-link-invalid/)
  assert.match(bad, /role="alert"/)
  assert.equal((bad.match(/type="password"/g) ?? []).length, 0)
  assert.match(bad, /href="#password-reset"/)
  for (const k of ['fixtureMax', 'fixtureMin']) assert.match(html(h(mod.AuthNewPassword, fx[k])), /data-block="auth-new-password"/)
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', 'auth', 'new-password.tsx'), 'utf8')
  assert.doesNotMatch(src, /(?:aria-label|placeholder|title)="[^"]*[가-힣]/, '접근 이름·문구는 copy 로만')
  const meta = JSON.parse(readFileSync(join(root, 'registry', 'factory', 'blocks', 'auth', 'new-password.block.json'), 'utf8'))
  assert.deepEqual([meta.kind, meta.variant], ['auth', 'new-password'])
})
