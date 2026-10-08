// cdp.mjs 의 기한 기본값(문서 읽기 15초·CDP 호출 45초)은 그대로이고, 환경 변수로만 늘릴 수 있다(REL9, 대장 G16).
// Chrome 은 필요 없다 — 가짜 send·ev 로 기한 계산만 본다. 환경 변수는 모듈을 읽을 때 정해지므로 자식 프로세스로 확인한다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/qa/cdp-timeout-env.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cdp = fileURLToPath(new URL('./cdp.mjs', import.meta.url))
const child = (env, code) => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import * as c from ${JSON.stringify('file:///' + cdp.replace(/\\/g, '/'))}\n${code}`], { env: { ...process.env, WF_NAV_TIMEOUT_MS: '', WF_CDP_TIMEOUT_MS: '', ...env }, encoding: 'utf8', timeout: 30000 })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}

test('기본값: 문서 읽기 15000 · CDP 호출 45000(환경 변수가 없거나 쓸 수 없는 값이면 그대로)', () => {
  assert.equal(child({}, 'console.log(c.NAV_TIMEOUT_MS, c.CDP_TIMEOUT_MS)'), '15000 45000')
  assert.equal(child({ WF_NAV_TIMEOUT_MS: 'abc', WF_CDP_TIMEOUT_MS: '-5' }, 'console.log(c.NAV_TIMEOUT_MS, c.CDP_TIMEOUT_MS)'), '15000 45000')
  assert.equal(child({ WF_NAV_TIMEOUT_MS: '0' }, 'console.log(c.NAV_TIMEOUT_MS)'), '15000')
})

test('환경 변수가 두 기한을 바꾼다', () => {
  assert.equal(child({ WF_NAV_TIMEOUT_MS: '60000', WF_CDP_TIMEOUT_MS: '120000' }, 'console.log(c.NAV_TIMEOUT_MS, c.CDP_TIMEOUT_MS)'), '60000 120000')
})

test('navigateAndWait: 기한은 환경 변수가 정하고, 호출이 준 기한이 환경 변수보다 앞선다 — 새 문서가 안 읽히면 그 기한으로 던진다', () => {
  const code = `
    const send = async () => ({ result: {} })
    const ev = async () => 'old' // 새 문서가 끝내 안 읽힌다
    const t = Date.now()
    let msg = ''
    try { await c.navigateAndWait(send, ev, 'http://x.test/') } catch (e) { msg = e.message }
    let msg2 = ''
    try { await c.navigateAndWait(send, ev, 'http://x.test/', { timeoutMs: 120 }) } catch (e) { msg2 = e.message }
    console.log(JSON.stringify({ msg, msg2 }))`
  const out = JSON.parse(child({ WF_NAV_TIMEOUT_MS: '300' }, code))
  assert.match(out.msg, /^300ms 안에 새 문서를 다 읽지 못했다/)
  assert.match(out.msg2, /^120ms 안에 새 문서를 다 읽지 못했다/)
})

test('양성 대조: 새 문서가 기한 안에 complete 가 되면 환경 변수가 작아도 통과한다', () => {
  const code = `
    let n = 0
    const send = async () => ({ result: {} })
    const ev = async () => (++n < 2 ? 'old' : 'complete')
    const nav = await c.navigateAndWait(send, ev, 'http://x.test/')
    console.log(JSON.stringify(nav))`
  assert.equal(child({ WF_NAV_TIMEOUT_MS: '2000' }, code), '{"result":{}}')
})
