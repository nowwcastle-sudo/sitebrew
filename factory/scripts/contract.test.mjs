// 블록 계약·어댑터(Task 10). 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import { buildItems } from './gen-registry.mjs'
import { LAYERS } from './pincheck.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'contract-test')
const REPO = 'nowwcastle-sudo/sitebrew'
const lines = (s) => s.split(/\r?\n/)

// TS → .tmp/contract-test/<이름>.mjs. 계약 import 는 타입만이라 변환 때 사라진다.
// 공용 lib 값 import(@/registry/factory/lib/<이름>, 전화번호 정규화 — 최종 리뷰 M5)는 같은 방식으로 변환해 파일 주소로 잇는다.
function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  let { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  outputText = outputText.replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) =>
    `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
  assert.doesNotMatch(outputText, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다(타입 import 여야 한다)`)
  const out = join(OUT, `${name}.mjs`)
  writeFileSync(out, outputText)
  return out
}
const load = (name) => import(pathToFileURL(transpile(join(DIR, `${name}.ts`), name)).href)
const mock = await load('adapter-mock')
const stat = await load('adapter-static')
const HANGUL = /[가-힣]/
// 약속이 이벤트 루프 한 바퀴 안에 끝나는가(setImmediate 는 setTimeout 이 아니다).
const settles = (p) => Promise.race([p.then(() => true, () => true), new Promise((r) => setImmediate(() => r(false)))])
const KAKAO = 'https://pf.kakao.com/_ZeUTxl'
const quiet = { open: () => {}, copy: () => {} }

// ① mock ─────────────────────────────────────────────────────────────────
test('stateFromQuery("?state=empty&submit=field-error") → state {status:"empty"}, submit() → {ok:false, fieldErrors:{…}} in Korean', async () => {
  const { state, submit } = mock.stateFromQuery('?state=empty&submit=field-error')
  assert.deepEqual(state, { status: 'empty' })
  const r = await submit()
  assert.equal(r.ok, false)
  const msgs = Object.values(r.fieldErrors ?? {}).flat()
  assert.ok(msgs.length > 0, 'fieldErrors 가 비었다')
  for (const m of [...msgs, r.formError]) assert.match(m, HANGUL)
})

test('stateFromQuery: 4 states × 3 settled outcomes cover the 7 states; data/receipt come from fixtures; URLSearchParams and a full URL work', async () => {
  const fx = { data: ['예시 항목'], receipt: { reference: 'EX-1' } }
  const seen = new Set()
  for (const s of mock.MOCK_STATES) for (const o of ['ok', 'field-error', 'server-error']) {
    const { state, submit } = mock.stateFromQuery(`state=${s}&submit=${o}`, fx)
    assert.equal(state.status, s)
    if (s === 'ready') assert.deepEqual(state.data, fx.data)
    const r = await submit()
    assert.equal(r.ok, o === 'ok')
    if (o === 'ok') assert.deepEqual(r.data, fx.receipt)
    seen.add(state.status).add(o === 'ok' ? 'submit-ok' : o)
  }
  assert.equal(seen.size, 7)
  assert.equal(mock.stateFromQuery(new URLSearchParams({ state: 'loading' })).state.status, 'loading')
  assert.equal(mock.stateFromQuery('http://localhost:3000/qa/blocks?state=loading&submit=server-error').state.status, 'loading')
  assert.equal((await mock.stateFromQuery('https://x.test/qa?submit=server-error').submit()).retryable, true)
})

test('stateFromQuery: no state → ready with data, empty without; a form-only block with ?submit=… and no data works', async () => {
  assert.deepEqual(mock.stateFromQuery('', { data: 1 }).state, { status: 'ready', data: 1 })
  assert.deepEqual(mock.stateFromQuery('').state, { status: 'empty' })
  const { state, submit } = mock.stateFromQuery('?submit=server-error')
  assert.deepEqual(state, { status: 'empty' })
  assert.equal((await submit()).ok, false)
})

test('stateFromQuery: ?state=ready without data names fixtures.data; ok without a receipt rejects naming the receipt; unknown values list the allowed ones', async () => {
  assert.throws(() => mock.stateFromQuery('?state=ready'), /stateFromQuery\(search, \{ data \}\)/)
  await assert.rejects(mock.stateFromQuery('?state=empty').submit(), /receipt/)
  assert.throws(() => mock.stateFromQuery('?state=done'), /state=done.*loading\|empty\|error\|ready/)
  assert.throws(() => mock.stateFromQuery('?submit=maybe'), /submit=maybe.*ok\|field-error\|server-error\|pending/)
  assert.throws(() => mock.stateFromQuery('?delay=soon'), /delay=soon/)
})

test('stateFromQuery: submit=pending never settles; delay=<ms> is honoured and clamped to 0–10000', async () => {
  const pending = mock.stateFromQuery('?submit=pending').submit()
  assert.equal(await settles(pending), false)
  const t0 = performance.now()
  await mock.stateFromQuery('?submit=field-error&delay=30').submit()
  assert.ok(performance.now() - t0 >= 25, 'delay 가 적용되지 않았다')
  // 범위 밖 값은 잘린다: 음수 → 0(타이머 없음), 큰 값 → 10000.
  const saved = globalThis.setTimeout
  const asked = []
  globalThis.setTimeout = (fn, ms) => { asked.push(ms); return saved(fn, 0) }
  try {
    await mock.stateFromQuery('?submit=field-error&delay=-5').submit()
    await mock.stateFromQuery('?submit=field-error&delay=999999').submit()
  } finally { globalThis.setTimeout = saved }
  assert.deepEqual(asked, [mock.MAX_DELAY_MS])
})

test('mockState: four shapes; error carries a Korean message and a retry; ready without data throws; each call is a fresh object', () => {
  assert.deepEqual(mock.mockState('loading'), { status: 'loading' })
  assert.deepEqual(mock.mockState('empty'), { status: 'empty' })
  const e = mock.mockState('error')
  assert.equal(e.status, 'error')
  assert.match(e.message, HANGUL)
  assert.equal(typeof e.retry, 'function')
  assert.deepEqual(mock.mockState('ready', { a: 1 }), { status: 'ready', data: { a: 1 } })
  assert.throws(() => mock.mockState('ready'), /data/)
  assert.notEqual(mock.mockState('empty'), mock.mockState('empty'))
})

test('mockSubmit: ok / field-error / server-error (retryable) are deterministic; overrides win; ok without data throws in Korean', async () => {
  const ok = mock.mockSubmit('ok', { reference: 'EX-2' })
  assert.deepEqual(await ok(), { ok: true, data: { reference: 'EX-2' } })
  assert.throws(() => mock.mockSubmit('ok'), /ok 결과에는 접수 결과/)
  const fe = mock.mockSubmit('field-error', undefined, { fieldErrors: { phone: ['휴대전화 번호 형식을 확인해 주세요'] } })
  assert.deepEqual((await fe()).fieldErrors, { phone: ['휴대전화 번호 형식을 확인해 주세요'] })
  const se = await mock.mockSubmit('server-error')()
  assert.equal(se.ok, false)
  assert.equal(se.retryable, true)
  assert.match(se.formError, HANGUL)
  const a = await mock.mockSubmit('field-error')(), b = await mock.mockSubmit('field-error')()
  assert.deepEqual(a, b)
  assert.notEqual(a, b)
  assert.notEqual(a.fieldErrors, b.fieldErrors)
  assert.throws(() => mock.mockSubmit('nope'), /submit/)
})

test('adapter-mock uses no timer unless a delay is given: with setTimeout stubbed to throw, every settled outcome still resolves', async () => {
  const saved = globalThis.setTimeout
  globalThis.setTimeout = () => { throw new Error('timer used') }
  try {
    for (const o of ['ok', 'field-error', 'server-error']) {
      assert.ok(await mock.mockSubmit(o, { reference: 'EX' })(), o)
      assert.ok(await mock.stateFromQuery(`?submit=${o}`, { receipt: { reference: 'EX' } }).submit(), o)
    }
    assert.equal(await settles(mock.mockSubmit('pending')()), false)
  } finally { globalThis.setTimeout = saved }
})

// ② static: mailto ────────────────────────────────────────────────────────
const parseMailto = (href) => Object.fromEntries(new URL(href).search.slice(1).split('&').map((p) => p.split('=').map(decodeURIComponent)))

test('mailtoSubmit builds a mailto: URL with Hangul percent-encoded (UTF-8), spaces as %20 not +, body line breaks as %0D%0A', async () => {
  const opened = []
  const submit = stat.mailtoSubmit('help@example.com', (i) => `예약 문의 — ${i.name}`, { open: (h) => opened.push(h) })
  const r = await submit({ name: '김예시', note: '창가 자리\n부탁드립니다 & 감사\r끝' })
  assert.equal(r.ok, true)
  assert.equal(opened.length, 1)
  const href = opened[0]
  assert.equal(r.data.href, href)
  assert.equal(r.data.reference, 'mailto')
  assert.match(r.data.nextStep, /창이 열리지 않으면 아래 링크를 눌러 주세요/)
  assert.ok(href.startsWith('mailto:help@example.com?subject='), href)
  assert.doesNotMatch(href, /[가-힣 +\n]/, 'href 에 인코딩 안 된 한글·공백·+·줄바꿈이 남았다')
  assert.ok(href.includes('%EC%98%88%EC%95%BD%20%EB%AC%B8%EC%9D%98'), href) // 「예약 문의」
  assert.ok(href.includes('%26'), '& 는 %26')
  const q = parseMailto(href)
  assert.equal(q.subject, '예약 문의 — 김예시')
  assert.equal(q.body, 'name: 김예시\r\nnote: 창가 자리\r\n부탁드립니다 & 감사\r\n끝', '\\n·\\r 모두 CRLF')
})

test('mailtoSubmit: CR/LF in the subject collapse to a space (no header injection); nested values are JSON; a custom body is used', async () => {
  const r = await stat.mailtoSubmit('a@b.co', () => '제목\r\nBcc: x@y.z', { open: () => {} })({ people: [{ n: 1 }], opt: { a: '가' } })
  const q = parseMailto(r.data.href)
  assert.equal(q.subject, '제목 Bcc: x@y.z')
  assert.doesNotMatch(r.data.href.split('&body=')[0], /%0D|%0A/)
  assert.equal(q.body, 'people: [{"n":1}]\r\nopt: {"a":"가"}')
  const c = await stat.mailtoSubmit('a@b.co', () => '제목', { body: (i) => `안녕하세요 ${i}`, open: () => {} })('예시')
  assert.ok(c.data.href.endsWith(`&body=${encodeURIComponent('안녕하세요 예시')}`))
})

test('mailtoSubmit: an href over 2000 chars opens a subject-only mail and hands the body over by clipboard (ok, Korean nextStep)', async () => {
  const opened = [], copied = []
  const note = '가'.repeat(500)
  const r = await stat.mailtoSubmit('a@b.co', () => '긴 문의', { open: (h) => opened.push(h), copy: (t) => copied.push(t) })({ note })
  assert.equal(r.ok, true)
  assert.ok(r.data.href.length <= stat.MAX_MAILTO_LENGTH)
  assert.doesNotMatch(r.data.href, /body=/)
  assert.equal(r.data.text, `note: ${note}`)
  assert.equal(r.data.copied, true)
  assert.deepEqual(copied, [`note: ${note}`])
  assert.deepEqual(opened, [r.data.href])
  assert.match(r.data.nextStep, /붙여넣/)
  const r2 = await stat.mailtoSubmit('a@b.co', () => '긴 문의', { open: () => {}, copy: () => Promise.reject(new Error('denied')) })({ note })
  assert.equal(r2.ok, true)
  assert.equal(r2.data.copied, false)
  assert.equal(r2.data.text, `note: ${note}`)
})

test('mailtoSubmit: a bad address throws a Korean developer error at setup; no browser and no open → Korean formError', async () => {
  // FINAL-WF E3: 앞부분·도메인의 ? & # % / = 는 숨은 수신자·머리글이 되므로 거절한다
  for (const bad of ['a?bcc=x@y.z', 'a&cc=b@example.com', 'a#b@example.com', 'a%0Abcc:x@example.com', 'a/b@example.com', 'a=b@example.com', 'a@example.com?bcc=x@y.z']) assert.throws(() => stat.mailtoSubmit(bad, () => '제목'), /mailtoSubmit: 받는 메일 주소/, bad)
  for (const bad of ['not-an-email', 'a@b', 'a b@c.co', '<a@b.co>', '']) assert.throws(() => stat.mailtoSubmit(bad, () => '제목'), /mailtoSubmit: 받는 메일 주소/, bad)
  const noWin = await stat.mailtoSubmit('a@b.co', () => '제목')({})
  assert.equal(noWin.ok, false)
  assert.match(noWin.formError, /브라우저/)
})

// ② static: 거부하지 않는 포트 ────────────────────────────────────────────
test('static ports never reject: a lone surrogate is replaced (U+FFFD), and a throwing subjectFrom/format/open becomes a retryable Korean formError', async () => {
  const m = await stat.mailtoSubmit('a@b.co', () => '제목\uD83D', { open: () => {} })({ note: '\uDC00끝' })
  assert.equal(m.ok, true)
  assert.equal(parseMailto(m.data.href).subject, '제목�')
  assert.equal(parseMailto(m.data.href).body, 'note: �끝')
  const k = await stat.kakaoChannelSubmit(KAKAO, () => '이모지 잘림 \uD83D', quiet)({})
  assert.equal(k.ok, true)
  assert.equal(k.data.text, '이모지 잘림 �')
  // 짝이 맞는 이모지는 그대로.
  assert.equal((await stat.kakaoChannelSubmit(KAKAO, () => '좋아요 😀', quiet)({})).data.text, '좋아요 😀')
  const boom = () => { throw new Error('boom') }
  const cases = [
    stat.mailtoSubmit('a@b.co', boom, { open: () => {} }),
    stat.mailtoSubmit('a@b.co', () => '제목', { body: boom, open: () => {} }),
    stat.mailtoSubmit('a@b.co', () => '제목', { open: boom }),
    stat.kakaoChannelSubmit(KAKAO, boom, quiet),
    stat.kakaoChannelSubmit(KAKAO, () => '예시', { open: boom, copy: () => {} }),
  ]
  for (const [i, submit] of cases.entries()) {
    const r = await submit({})
    assert.equal(r.ok, false, `case ${i}`)
    assert.equal(r.retryable, true, `case ${i}`)
    assert.match(r.formError, HANGUL, `case ${i}`)
  }
})

// ② static: tel ───────────────────────────────────────────────────────────
test('telLink: separators (incl. ‐ – — and full-width digits) stripped, +82 (0) handled, 8–15 digit E.164; errors go to formError', () => {
  const href = (p) => stat.telLink(p).data?.href
  assert.equal(href('02-123-4567'), 'tel:021234567')
  assert.equal(href('+82 10-1234-5678'), 'tel:+821012345678')
  assert.equal(href('+82 (0)10-1234-5678'), 'tel:+821012345678')
  assert.equal(href('+82 010-1234-5678'), 'tel:+821012345678')
  assert.equal(href('(031) 123.4567'), 'tel:0311234567')
  assert.equal(href('1588-1234'), 'tel:15881234')
  assert.equal(href('010‐1234‐5678'), 'tel:01012345678')
  assert.equal(href('02–123–4567'), 'tel:021234567')
  assert.equal(href('０１０-1234-5678'), 'tel:01012345678')
  assert.equal(href('+44 20 7946 0958 123'), 'tel:+442079460958123') // 15자리
  assert.match(stat.telLink('02-123-4567').data.nextStep, HANGUL)
  for (const bad of ['82-10-1234-5678', 'abc', '123', '010-1234-5678-9999-1', '+1234567', '']) {
    const r = stat.telLink(bad)
    assert.equal(r.ok, false, bad)
    assert.match(r.formError, /전화번호 설정/, bad)
    assert.equal(r.fieldErrors, undefined)
  }
})

// ② static: kakao ─────────────────────────────────────────────────────────
test('kakaoChannelSubmit opens https://pf.kakao.com/<id>/chat with NO user text in the URL, copies the text, always returns href', async () => {
  const opened = [], copied = []
  const fmt = (i) => `예약 요청\n이름: ${i.name}\n연락처: ${i.phone}`
  const input = { name: '김예시', phone: '010-0000-0000' }
  for (const url of [KAKAO, `${KAKAO}/`, `${KAKAO}/chat`, ` ${KAKAO}/chat/ `]) {
    const r = await stat.kakaoChannelSubmit(url, fmt, { open: (h) => opened.push(h), copy: (t) => copied.push(t) })(input)
    assert.equal(r.ok, true, url)
    assert.equal(r.data.reference, 'kakao')
    assert.equal(r.data.href, `${KAKAO}/chat`)
    assert.equal(r.data.copied, true)
    assert.match(r.data.nextStep, /붙여넣/)
    assert.match(r.data.nextStep, /창이 열리지 않으면 아래 링크를 눌러 주세요/)
  }
  // 개인정보가 주소에 실리지 않는다(원문·인코딩 둘 다).
  for (const h of opened) {
    assert.equal(h, `${KAKAO}/chat`)
    for (const piece of ['김예시', '010-0000-0000', encodeURIComponent('김예시'), 'text=']) assert.ok(!h.includes(piece), `${h} ⊃ ${piece}`)
  }
  assert.deepEqual(copied, Array(4).fill('예약 요청\n이름: 김예시\n연락처: 010-0000-0000'))
})

test('kakaoChannelSubmit: copy failure (sync throw or rejection) still opens the chat — ok, copied:false, different guidance', async () => {
  for (const copy of [() => { throw new Error('denied') }, () => Promise.reject(new Error('not focused'))]) {
    const opened = []
    const r = await stat.kakaoChannelSubmit(KAKAO, () => '예시', { open: (h) => opened.push(h), copy })({})
    assert.equal(r.ok, true)
    assert.equal(r.data.copied, false)
    assert.doesNotMatch(r.data.nextStep, /붙여넣/)
    assert.equal(opened.length, 1)
  }
})

test('kakaoChannelSubmit: a non-channel URL throws a Korean developer error at setup; no browser and no open → Korean formError', async () => {
  for (const bad of ['http://pf.kakao.com/_ZeUTxl', 'https://example.com/_ZeUTxl', 'https://pf.kakao.com/', 'https://pf.kakao.com/_ZeUTxl/friend', 'javascript:alert(1)']) {
    assert.throws(() => stat.kakaoChannelSubmit(bad, () => '예시'), /kakaoChannelSubmit: 카카오톡 채널 주소/, bad)
  }
  const r = await stat.kakaoChannelSubmit(KAKAO, () => '예시')({})
  assert.equal(r.ok, false)
  assert.match(r.formError, /브라우저/)
})

test('static adapters use no network and no dependency: no fetch/XHR/beacon/socket/zod in the source, and they succeed while fetch throws', async () => {
  const src = readFileSync(join(DIR, 'adapter-static.ts'), 'utf8')
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|from\s+["']zod/)
  const saved = globalThis.fetch
  globalThis.fetch = () => { throw new Error('network used') }
  try {
    assert.equal((await stat.mailtoSubmit('a@b.co', () => '제목', { open: () => {} })({})).ok, true)
    assert.equal((await stat.kakaoChannelSubmit(KAKAO, () => '예시', quiet)({})).ok, true)
    assert.equal(stat.telLink('010-1234-5678').ok, true)
  } finally { globalThis.fetch = saved }
})

test('each exported port factory carries the server→client boundary note in its own JSDoc (shadcn strips file-head comments)', () => {
  for (const [file, fns] of [['adapter-static.ts', ['mailtoSubmit', 'kakaoChannelSubmit', 'hostedCheckoutLink']], ['adapter-mock.ts', ['mockState', 'mockSubmit', 'stateFromQuery', 'mockBilling', 'mockAuth', 'mockNotify', 'mockAnalytics', 'mockStorage']]]) {
    const src = readFileSync(join(DIR, file), 'utf8')
    for (const fn of fns) {
      const doc = src.match(new RegExp(`/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export function ${fn}\\b`))
      assert.ok(doc, `${fn}: JSDoc 이 없다`)
      assert.match(doc[1], /서버 컴포넌트/, `${fn}: 경계 안내가 없다`)
    }
  }
})

// ③ 계약 타입 ────────────────────────────────────────────────────────────
test('block-contract is types only (no runtime import) and keeps the draft shape: autoSubmit?: false', () => {
  const src = readFileSync(join(DIR, 'block-contract.ts'), 'utf8')
  assert.doesNotMatch(src, /^\s*import\s/m)
  assert.equal(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace(/\/\/.*|\s|export\s*\{\s*\};?/g, ''), '')
  assert.ok(lines(src).some((l) => /^\s*autoSubmit\?:\s*false\b/.test(l)))
  for (const t of ['ActionResult<TData>', 'AsyncState<T>', 'BlockBase<TCopy>', 'AgentToolMeta']) assert.ok(src.includes(t), t)
})

test('tsc: AgentToolMeta with autoSubmit: true (literal or a boolean) is a type error — the @ts-expect-error fixture compiles; without the comments it fails with 2 × TS2322 on autoSubmit', () => {
  const fixture = join(root, 'factory', 'scripts', 'fixtures', 'contract')
  const neg = join(OUT, 'tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  const src = readFileSync(join(fixture, 'auto-submit.tsx'), 'utf8')
  const stripped = lines(src).filter((l) => !/^\s*\/\/ @ts-expect-error/.test(l)).join('\n')
  assert.equal(lines(src).length - lines(stripped).length, 2, '고정물의 @ts-expect-error 는 두 줄이다')
  writeFileSync(join(neg, 'no-expect-error.tsx'), stripped)
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.tsx'], exclude: [] }))
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const r = spawnSync(process.execPath, [tsc, '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  const errors = lines(r.stdout).filter((l) => /error TS\d+/.test(l))
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 autoSubmit: true 가 허용된다')
  assert.equal(errors.length, 2, errors.join('\n'))
  const negLines = lines(stripped)
  for (const e of errors) {
    const m = e.match(/no-expect-error\.tsx\((\d+),\d+\).*TS2322/)
    assert.ok(m, e)
    assert.match(negLines[Number(m[1]) - 1], /^\s*autoSubmit:/, `오류가 autoSubmit 줄이 아니다: ${e}`)
  }
  const ok = spawnSync(process.execPath, [tsc, '-p', join(fixture, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)
})

// ④ 레지스트리 ───────────────────────────────────────────────────────────
test('contract layer → 8 registry:lib items under @components/contract, none with npm dependencies; adapters depend on block-contract (+ ports) pinned to the ref; pincheck and the root registry cover it', () => {
  const items = buildItems(DIR, 'contract', REPO, DIR, 'v9.9.9', { zod: '^4.6.5' })
  assert.deepEqual(items.map((i) => i.name), ['adapter-mock', 'adapter-static', 'attribution', 'block-contract', 'contract-conformance', 'events', 'human-actions', 'ports'])
  for (const it of items) {
    if (it.name === 'contract-conformance') continue // 여러 파일 묶음(P3-3 Task 15) — conformance.test.mjs 가 본다
    assert.equal(it.type, 'registry:lib')
    assert.deepEqual(it.files, [{ path: `${it.name}.ts`, type: 'registry:lib', target: `@components/contract/${it.name}.ts` }])
    assert.deepEqual(it.dependencies, [], it.name)
  }
  const by = Object.fromEntries(items.map((i) => [i.name, i]))
  assert.deepEqual(by['block-contract'].registryDependencies, [])
  // 포트 목·결제 링크는 포트 타입을 부른다(P3-2 Task 10). adapter-mock 은 events 도 직접 부른다.
  assert.deepEqual(by['adapter-mock'].registryDependencies, [`${REPO}/block-contract#v9.9.9`, `${REPO}/events#v9.9.9`, `${REPO}/ports#v9.9.9`, `${REPO}/retention-offer#v9.9.9`])
  // 전화번호 정규화는 lib 항목 phone 하나(최종 리뷰 M5) — npm 의존은 여전히 0.
  assert.deepEqual(by['adapter-static'].registryDependencies, [`${REPO}/block-contract#v9.9.9`, `${REPO}/phone#v9.9.9`, `${REPO}/ports#v9.9.9`])
  // 출처 태그 감싸기(Task 10c)는 포트 타입만 부른다 — events 는 여전히 아무것도 부르지 않는다(ports ↔ events 순환 없음).
  assert.deepEqual(by.attribution.registryDependencies, [`${REPO}/ports#v9.9.9`])
  assert.deepEqual(by.events.registryDependencies, [])
  assert.ok(LAYERS.includes('contract'))
  const reg = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  assert.ok(reg.include.includes('registry/factory/contract/registry.json'))
  const gen = JSON.parse(readFileSync(join(DIR, 'registry.json'), 'utf8'))
  assert.deepEqual(gen.items.map((i) => [i.name, i.dependencies]), [['adapter-mock', []], ['adapter-static', []], ['attribution', []], ['block-contract', []], ['contract-conformance', []], ['events', []], ['human-actions', []], ['ports', []]])
})
