// 7상태 감사 시험(Task 7a Step 3) — 가짜 서버가 쿼리(state·submit·delay)마다 좋은 화면 / 나쁜 화면을 낸다(음성 대조).
//  읽기: error 에 [다시 시도] 없음 → 실패 · loading 표시 없음 → 실패 · loading→ready 에서 밀림(CLS ≥ 0.1) → 실패
//  제출: field-error 첫 오류 칸 포커스 없음 → 실패 · server-error 에서 입력이 지워짐 → 실패 · pending 에서 두 번 눌리면 두 번 나감 → 실패
//  좋은 화면은 모두 통과(양성 대조). 도구 실패(서버 없음)는 요약 없음.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeStates } from './states.mjs'

const page = (bad, loose = false) => `<!doctype html><html><body style="margin:0;font:16px sans-serif"><div data-qa-block="b" data-qa-ready><section data-block="x" style="padding:16px">
<h2>시험 블록</h2><div id="live"></div><div id="body"></div><footer style="height:200px;background:#eee">아래 영역</footer>
<form id="f"><input name="email" value=""><input name="name" value=""><button type="submit" id="go" data-choice="primary">보내기</button></form></section></div>
<script>
const q = new URLSearchParams(location.search), submit = q.get('submit'), state = q.get('state'), delay = Number(q.get('delay') || 0), BAD = ${bad ? 'true' : 'false'}, LOOSE = ${loose ? 'true' : 'false'}
const body = document.getElementById('body'), live = document.getElementById('live'), form = document.getElementById('f')
if (!submit) form.remove()
const LONG = '준비된 목록입니다. 이 화면에는 스무 글자가 넘는 안내 글과 항목이 들어 있어요.'
const show = (s) => {
  if (s === 'loading') body.innerHTML = BAD ? '<p>잠시만요</p>' : '<div role="status" aria-busy="true">불러오는 중이에요…</div>'
  if (s === 'empty') body.innerHTML = '<p>아직 항목이 없어요. 새로 만들어 보세요.</p>'
  if (s === 'error') { body.innerHTML = '<div role="alert">불러오지 못했어요.</div>' + (BAD ? '' : '<button id="retry" type="button">다시 시도</button>'); document.getElementById('retry')?.addEventListener('click', () => { window.__wfRetried = (window.__wfRetried || 0) + 1 }) }
  if (s === 'ready') body.innerHTML = '<p>' + LONG + '</p><ul><li>첫째 항목</li><li>둘째 항목</li></ul>'
}
if (delay && state === 'ready') {
  body.style.minHeight = BAD ? '0' : '420px'
  body.innerHTML = '<div role="status" aria-busy="true">불러오는 중이에요…</div>'
  setTimeout(() => show('ready'), delay)
} else if (state) show(state)
if (delay && state === 'ready' && BAD) setTimeout(() => { body.innerHTML = '<div style="height:400px;background:#ddd"></div><p>' + LONG + '</p>' }, delay + 50)
// 폼이 둘인 블록(계정 자격 — 이메일 폼·비밀번호 폼): 두 번째 폼은 자기 버튼만 잠근다. 보내면 이탈 경고(beforeunload)를 건다(A49) — 다음 행의 주소 이동을 막지 않아야 한다.
if (new URLSearchParams(location.search).get('b') === 'block-account-credentials') {
  const f2 = document.createElement('form'); f2.innerHTML = '<input name="pw" value=""><button type="submit" id="go2" data-choice="primary">비밀번호 바꾸기</button>'
  form.after(f2)
  f2.addEventListener('submit', (e) => {
    e.preventDefault(); window.__wfSubmitted = (window.__wfSubmitted || 0) + 1
    if (submit === 'ok') { live.setAttribute('role', 'status'); live.textContent = '접수했습니다.' }
    if (submit === 'field-error') { f2.pw.setAttribute('aria-invalid', 'true'); f2.pw.focus() }
    if (submit === 'server-error') { live.setAttribute('role', 'alert'); live.textContent = '서버에서 오류가 났어요.' }
    if (submit === 'pending') { f2.setAttribute('aria-busy', 'true'); document.getElementById('go2').disabled = true }
  })
}
form.addEventListener('submit', (e) => {
  e.preventDefault(); window.__wfSubmitted = (window.__wfSubmitted || 0) + 1
  window.addEventListener('beforeunload', (ev) => { ev.preventDefault(); ev.returnValue = '' })
  const btn = document.getElementById('go')
  if (submit === 'ok') { live.setAttribute('role', 'status'); live.textContent = '접수했습니다.'; window.__wfCalls = [{ name: 'cancel', input: LOOSE ? { when: 'now' } : { when: 'now', confirmed: true } }] }
  if (submit === 'field-error') { form.email.setAttribute('aria-invalid', 'true'); if (!BAD) form.email.focus() }
  if (submit === 'server-error') { live.setAttribute('role', 'alert'); live.textContent = '서버에서 오류가 났어요.'; if (BAD) { form.email.value = ''; form.name.value = '' } }
  if (submit === 'pending') { form.setAttribute('aria-busy', 'true'); if (!BAD) btn.disabled = true }
})
</script></body></html>`

let server, origin, tmp, bad = false, loose = false
before(async () => {
  server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(page(bad, loose)) })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  tmp = mkdtempSync(join(tmpdir(), 'states-test-'))
})
after(() => { server?.close(); rmSync(tmp, { recursive: true, force: true }) })

const cli = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [fileURLToPath(new URL('./states.mjs', import.meta.url)), ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d }); p.stderr.on('data', (d) => { err += d })
  p.on('exit', (code) => resolve({ code, out, err }))
})
const run = async (block, isBad, o = origin, isLoose = false) => {
  bad = isBad
  loose = isLoose
  const r = await cli([o, '--only', block, '--out', join(tmp, 'out')])
  const f = join(tmp, 'out', 'summary.json')
  return { ...r, summary: existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
}
const failsOf = (s) => s.rowsDetail.filter((r) => !r.pass).map((r) => `${r.type}:${r.name}`).sort()

const DATA = 'block-product-list-grid-cards'
const FORM = 'block-contact-form-inline-short'

test('읽기 상태 — 좋은 화면은 5행(상태 4 + 전환) 모두 통과', async () => {
  const r = await run(DATA, false)
  assert.equal(r.code, 0, r.out + r.err)
  assert.equal(r.summary.rows, 5)
  assert.equal(r.summary.failed, 0)
  const err = r.summary.rowsDetail.find((x) => x.name === 'error')
  assert.equal(err.checks.state.retried, 1, '[다시 시도]를 눌렀더니 retry 가 1번 불렸다')
})

test('읽기 상태 — 나쁜 화면: 로딩 표시 없음 · error 에 다시 시도 없음 · 전환에서 밀림 → 종료 1, 실패 행이 그 셋', async () => {
  const r = await run(DATA, true)
  assert.equal(r.code, 1, r.out + r.err)
  assert.deepEqual(failsOf(r.summary), ['cls:ready-delayed', 'read:error', 'read:loading'])
  const cls = r.summary.rowsDetail.find((x) => x.type === 'cls')
  assert.ok(cls.checks.state.cls >= 0.1, `cls ${cls.checks.state.cls}`)
})

test('제출 결과 — 좋은 화면은 4행(ok·field-error·server-error·pending) 모두 통과', async () => {
  const r = await run(FORM, false)
  assert.equal(r.code, 0, r.out + r.err)
  assert.equal(r.summary.rows, 4)
  assert.equal(r.summary.failed, 0)
})

test('제출 결과 — 나쁜 화면: 포커스 없음 · 입력 지워짐 · pending 두 번 나감 → 종료 1, 실패 행이 그 셋(ok 는 통과)', async () => {
  const r = await run(FORM, true)
  assert.equal(r.code, 1, r.out + r.err)
  assert.deepEqual(failsOf(r.summary), ['submit:field-error', 'submit:pending', 'submit:server-error'])
})

test('제출 결과 — 승인 행동 호출에 confirmed: true 가 없으면 ok 행이 떨어진다(P3-7 AXC), 있으면 통과(양성 대조)', async () => {
  const good = await run(FORM, false)
  assert.equal(good.code, 0, good.out + good.err)
  assert.equal(good.summary.rowsDetail.find((r) => r.name === 'ok').checks.state.approvalCalls, 1, '승인 행동 호출 1건을 봤다')
  const loose = await run(FORM, false, origin, true)
  assert.equal(loose.code, 1, loose.out + loose.err)
  assert.deepEqual(failsOf(loose.summary), ['submit:ok'])
  assert.match(loose.summary.rowsDetail.find((r) => r.name === 'ok').checks.state.fails.join(' '), /confirmed: true 가 없다\(cancel\)/)
})

test('제출 결과 — 폼이 둘인 블록: 두 번 누르기는 누른 그 버튼을 누른다(첫 버튼이 아니다) — 좋은 화면 4행 통과', async () => {
  const r = await run('block-account-credentials', false)
  assert.equal(r.code, 0, r.out + r.err)
  assert.equal(r.summary.rows, 9) // 읽기 넷 + 전환 + 제출 넷
  const pending = r.summary.rowsDetail.find((x) => x.name === 'pending')
  assert.equal(pending.checks.state.submitted, 1, '두 번 눌렀는데 한 번만 나갔다(같은 버튼)')
})

test('이탈 경고(beforeunload)를 건 채로 다음 행으로 넘어가도 콘솔 오류가 없다 — 위 좋은 화면 시험이 4행 모두 통과하는 것이 그 증거(보내면 경고를 건다)', async () => {
  const r = await run(FORM, false)
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(r.summary.rowsDetail.every((x) => x.checks.render.status === 'pass'), '콘솔 오류 행 없음')
})

test('도구 실패(서버 없음)는 종료 1 + 「도구 실패:」 + 요약 없음', async () => {
  const r = await run(FORM, false, 'http://127.0.0.1:1')
  assert.equal(r.code, 1)
  assert.match(r.err, /도구 실패:/)
  assert.equal(r.summary, null)
})

test('summarizeStates: na 는 통과가 아니고 종류별 행·실패를 센다', () => {
  const ok = { status: 'pass', measured: 1, fails: [] }
  const na = { status: 'na', measured: 0, fails: [] }
  const rows = [
    { type: 'read', pass: true, na: [], checks: { render: ok, state: ok } },
    { type: 'submit', pass: true, na: ['state'], checks: { render: ok, state: na } },
    { type: 'submit', pass: false, na: [], checks: { render: ok, state: { status: 'fail', measured: 1, fails: ['x'] } } },
  ]
  const s = summarizeStates(rows)
  assert.equal(s.failed, 1)
  assert.equal(s.na, 1)
  assert.deepEqual(s.per.state, { pass: 1, fail: 1, na: 1 })
  assert.deepEqual(s.byType.submit, { rows: 2, fail: 1 })
  assert.equal(s.ok, false)
})
