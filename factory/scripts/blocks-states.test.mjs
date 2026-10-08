// 블록 갤러리 상태 주입(P3-2 Task 1c — 리뷰 I-6). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-states.test.mjs
// 합성 데이터 블록·합성 폼 블록을 app/qa/blocks/states.ts withStates 로 모든 메타 상태(STATE_QUERY 표로 만든 쿼리)마다 주입해 정적 렌더한다 — 브라우저 없음.
// TS 는 typescript transpileModule 로 .tmp/blocks-states-test 에 옮기고, @/ import 는 옮긴 파일(.ts·.tsx) 또는 원본(.mjs)의 file:// 주소로 바꾼다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { BLOCK_STATES, STATE_QUERY, stateQuery, READ_STATES, SUBMIT_STATES } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-states-test')
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  // @/ 와 상대 경로(./ ../ — 아이콘 정본 모듈이 어댑터를 다시 내보낸다, Task 14c) 둘 다 옮긴 파일로 잇는다. 폴더면 index.ts.
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(@\/|\.\.?\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
    const base = pre === '@/' ? join(root, p) : join(dirname(abs), pre, p)
    const src = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: ${pre}${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const { withStates, withPorts, PORT_QUERY_KEYS, DEFAULT_RECEIPT, stateParam } = await import(pathToFileURL(transpile(join(root, 'app', 'qa', 'blocks', 'states.ts'))).href)
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement

// 합성 데이터 블록: 네 상태를 모두 그린다(block-contract AsyncState).
function DataBlock({ copy, state }) {
  const body = state.status === 'loading' ? h('p', { 'aria-busy': 'true' }, '불러오는 중')
    : state.status === 'empty' ? h('p', null, state.reason ?? '비었다')
    : state.status === 'error' ? h('p', { role: 'alert' }, state.message)
    : h('ul', null, state.data.map((x) => h('li', { key: x.name }, x.name)))
  return h('section', { 'data-block': 'product-list-probe', 'data-status': state.status }, h('h2', null, copy.title), body)
}
// 합성 폼 블록: 제출 결과를 그리지 않고 포트만 받는다(결과는 submit() 을 불러 본다).
function FormBlock({ copy, submit }) {
  if (typeof submit !== 'function') throw new Error('submit 포트가 없다')
  return h('section', { 'data-block': 'contact-form-probe' }, h('h2', null, copy.title), h('form', null, h('button', { type: 'submit' }, '보내기')))
}
const dataMeta = ['loading', 'empty', 'error', 'ready']
const formMeta = ['submit-ok', 'submit-field-error', 'submit-server-error', 'submit-pending']
const products = [{ name: '예시 상품 가' }, { name: '예시 상품 나' }]

test('STATE_QUERY 표로 만든 쿼리가 갤러리 링크와 같다(stateParam = stateQuery)', () => {
  for (const s of BLOCK_STATES) assert.equal(stateParam(s), stateQuery(s))
  assert.equal(stateParam('nope'), null)
  assert.deepEqual([...READ_STATES, ...SUBMIT_STATES], BLOCK_STATES)
})

test('합성 데이터 블록: 메타 읽기 상태 넷을 모두 정적 렌더한다(데이터는 fixtureStates.data, 없으면 예시의 ready data)', () => {
  for (const fxStates of [{ data: products, reason: '아직 상품이 없습니다(예시).' }, undefined]) {
    const base = { copy: { title: '상품(예시)' }, state: { status: 'ready', data: products } }
    for (const s of dataMeta) {
      const props = withStates(dataMeta, base, fxStates, stateQuery(s))
      const html = renderToStaticMarkup(h(DataBlock, props))
      assert.match(html, new RegExp(`data-status="${STATE_QUERY[s].value}"`), s)
      if (s === 'ready') assert.match(html, /예시 상품 나/)
      if (s === 'error') assert.equal(typeof props.state.retry, 'function', '오류에는 다시 시도 함수')
    }
    // 쿼리가 없으면 데이터가 있으니 ready
    assert.equal(withStates(dataMeta, base, fxStates, '').state.status, 'ready')
  }
  // 메타에 없는 쪽(submit)은 주입하지 않는다
  assert.equal('submit' in withStates(dataMeta, { copy: {}, state: { status: 'ready', data: products } }, undefined, 'submit=ok'), false)
})

test('합성 폼 블록: 메타 제출 상태(ok·field-error·server-error·pending)를 정적 렌더하고 submit() 이 멈추지 않는다 — receipt 가 없으면 기본 접수 결과', async () => {
  const base = { copy: { title: '문의(예시)' } }
  for (const fxStates of [undefined, { receipt: { id: 'R-1' }, fieldErrors: { phone: ['번호를 확인해 주세요(예시).'] } }]) {
    for (const s of formMeta) {
      const props = withStates(formMeta, base, fxStates, stateQuery(s))
      assert.match(renderToStaticMarkup(h(FormBlock, props)), /data-block="contact-form-probe"/, s)
      assert.equal('state' in props, false, '폼만 있는 블록에는 읽기 상태를 주입하지 않는다')
      if (s === 'submit-pending') {
        const r = await Promise.race([props.submit({}), new Promise((res) => setTimeout(() => res('pending'), 50))])
        assert.equal(r, 'pending')
        continue
      }
      const r = await props.submit({})
      if (s === 'submit-ok') assert.deepEqual(r, { ok: true, data: fxStates?.receipt ?? DEFAULT_RECEIPT })
      if (s === 'submit-field-error') assert.deepEqual(r.fieldErrors, fxStates?.fieldErrors ?? { name: ['이 항목을 확인해 주세요.'] })
      if (s === 'submit-server-error') assert.equal(r.retryable, true)
    }
    // &submit 이 없을 때(갤러리 기본) ok 도 receipt 없이 돈다(리뷰 I-6 가: NEED_RECEIPT)
    assert.equal((await withStates(formMeta, base, fxStates, '').submit({})).ok, true)
  }
  // 폼만 있는 블록에 ?state=ready 가 와도 데이터를 찾지 않는다(리뷰 I-6 다)
  assert.doesNotThrow(() => withStates(formMeta, base, undefined, 'state=ready&submit=ok'))
})

// 가짜 부수 효과(StatesEnv): 예약·주소 이동·세기를 기록하고, 예약은 run() 으로 부른다.
function fakeEnv(search) {
  const log = { scheduled: [], went: [], counted: 0 }
  const env = {
    schedule: (fn, ms) => log.scheduled.push({ fn, ms }),
    go: (mutate) => { const u = new URLSearchParams(search); mutate(u); log.went.push(u.toString()) },
    count: () => { log.counted++ },
    submitted: () => {},
  }
  return { env, log }
}

test('읽기 지연(레인 C 0): &delay 가 읽기 상태에도 간다 — loading 으로 그리고 ms 뒤 지연을 뗀 요청 상태 주소로 옮긴다', () => {
  const base = { copy: { title: '상품(예시)' }, state: { status: 'ready', data: products } }
  for (const s of ['ready', 'empty', 'error']) {
    const search = `state=${s}&delay=800`
    const { env, log } = fakeEnv(search)
    const props = withStates(dataMeta, base, undefined, search, env)
    assert.equal(props.state.status, 'loading', `${s}: 지연 동안은 loading`)
    assert.equal(log.scheduled.length, 1, s)
    assert.equal(log.scheduled[0].ms, 800, s)
    assert.equal(log.went.length, 0, `${s}: 예약 전에는 옮기지 않는다`)
    log.scheduled[0].fn()
    assert.deepEqual(log.went, [`state=${s}`], `${s}: 지연을 뗀 요청 상태`)
    // 옮긴 주소로 다시 주입하면 요청 상태
    assert.equal(withStates(dataMeta, base, undefined, log.went[0], fakeEnv(log.went[0]).env).state.status, s)
  }
  // state 가 없으면 데이터가 있으니 ready 로 옮긴다
  const { env, log } = fakeEnv('delay=300')
  assert.equal(withStates(dataMeta, base, undefined, 'delay=300', env).state.status, 'loading')
  log.scheduled[0].fn()
  assert.deepEqual(log.went, ['state=ready'])
  // loading 요청·지연 0·지연 없음은 예약하지 않는다
  for (const search of ['state=loading&delay=800', 'state=ready&delay=0', 'state=ready']) {
    const t = fakeEnv(search)
    withStates(dataMeta, base, undefined, search, t.env)
    assert.equal(t.log.scheduled.length, 0, search)
  }
  // 폼만 있는 블록: 지연은 제출에 가고 읽기 예약은 없다
  const t = fakeEnv('submit=ok&delay=800')
  withStates(formMeta, { copy: {} }, undefined, 'submit=ok&delay=800', t.env)
  assert.equal(t.log.scheduled.length, 0)
})

test('기본 retry(레인 C 0): 예시가 retry 를 주지 않으면 갤러리 것이 세고(__wfRetried) ready 로 옮긴다 — 예시 retry 가 있으면 그것', () => {
  const base = { copy: { title: '상품(예시)' }, state: { status: 'ready', data: products } }
  const search = 'state=error&delay=0'
  const { env, log } = fakeEnv(search)
  const props = withStates(dataMeta, base, { message: '못 불러왔다(예시)' }, search, env)
  assert.equal(props.state.status, 'error')
  props.state.retry()
  props.state.retry()
  assert.equal(log.counted, 2, '누를 때마다 센다')
  assert.deepEqual(log.went, ['state=ready', 'state=ready'], '지연을 떼고 ready 로')
  // 데이터가 없으면 세기만 한다(ready 를 그릴 수 없다)
  const noData = fakeEnv('state=error')
  withStates(dataMeta, { copy: {}, state: { status: 'loading' } }, undefined, 'state=error', noData.env).state.retry()
  assert.equal(noData.log.counted, 1)
  assert.equal(noData.log.went.length, 0)
  // 예시 retry 가 이긴다
  let own = 0
  const mine = fakeEnv('state=error')
  withStates(dataMeta, base, { retry: () => { own++ } }, 'state=error', mine.env).state.retry()
  assert.equal(own, 1)
  assert.equal(mine.log.counted, 0)
  // 브라우저 밖(기본 부수 효과)에서 불러도 멈추지 않는다
  assert.doesNotThrow(() => withStates(dataMeta, base, undefined, 'state=error').state.retry())
  assert.equal(withStates(dataMeta, base, undefined, 'state=ready&delay=500').state.status, 'loading')
})

test('메타 상태가 없는 블록은 예시 props 그대로', () => {
  const base = { copy: { title: 'x' } }
  assert.equal(withStates([], base, undefined, 'state=loading&submit=ok'), base)
})

// 포트 목 주입(레인 D1): 예시 fixturePorts 가 받는 쿼리에 ?sub=·?auth=·?consent= 와 state·submit·delay 가 그대로 가고, 다른 쿼리는 가지 않는다.
test('포트 목 주입: withPorts 가 sub·auth·consent·state·submit·delay 를 fixturePorts 로 넘기고 목이 그 상태를 그린다', async () => {
  const mock = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'))).href)
  assert.deepEqual([...PORT_QUERY_KEYS], ['sub', 'auth', 'consent', 'state', 'submit', 'delay', 'retryAfter', 'unsupported', 'last', 'initialWait', 'channels'])
  const seen = []
  const tracked = []
  // 합성 포트 블록의 예시: 결제·인증·계측 목에서 블록이 받는 메서드만 낸다(구독이 없으면 active 로 — 예시 기본값)
  const fixturePorts = (q, { fx, onTrack }) => {
    seen.push({ q: q.toString(), fx })
    const qq = new URLSearchParams(q)
    if (!qq.has('sub')) qq.set('sub', 'active')
    const billing = mock.mockBilling(qq)
    const auth = mock.mockAuth(q)
    const analytics = mock.mockAnalytics(q, { onTrack })
    return { subscription: billing.subscription, cancel: billing.cancel, session: auth.session, consent: analytics.consent, track: analytics.track }
  }
  const base = { copy: { title: '구독(예시)' } }
  const onTrack = (e) => tracked.push(e)

  for (const sub of ['past_due', 'pending-price-change', 'trialing']) {
    const props = withPorts(base, fixturePorts, `sub=${sub}&b=x&r=y&theme=dark`, { fx: 'max', onTrack })
    assert.equal(props.copy, base.copy, '예시 props 는 그대로')
    const r = await props.subscription()
    assert.equal(r.ok, true)
    assert.equal(r.data.status, sub === 'pending-price-change' ? 'active' : sub, sub)
    if (sub === 'pending-price-change') assert.equal(r.data.pendingPriceChange.to.amount, 33_000)
  }
  assert.deepEqual(seen.map((s) => s.q), ['sub=past_due', 'sub=pending-price-change', 'sub=trialing'], '갤러리 쿼리(b·r·theme)는 넘기지 않는다')
  assert.equal(seen[0].fx, 'max')
  // 쿼리가 없으면 예시 기본값(active)
  assert.equal((await withPorts(base, fixturePorts, '').subscription()).data.status, 'active')
  // auth·consent
  const signedIn = withPorts(base, fixturePorts, 'auth=signed-in&consent=all', { onTrack })
  assert.equal((await signedIn.session()).data.name, '김예시')
  assert.deepEqual({ ...signedIn.consent(), decidedAt: undefined }, { analytics: true, marketing: true, decidedAt: undefined })
  signedIn.track('cta_click', { id: 'x', label: '해지하기', section: 'retention' })
  assert.equal(tracked.length, 1, '동의가 있으면 onTrack 으로 기록')
  withPorts(base, fixturePorts, 'consent=denied', { onTrack }).track('cta_click', { id: 'x', label: 'y', section: 'z' })
  assert.equal(tracked.length, 1, '거부면 기록하지 않는다')
  // 읽기·쓰기 결과: state=error 는 다시 시도할 수 있는 오류, submit=field-error 는 해지하지 않는다
  const err = withPorts(base, fixturePorts, 'sub=active&state=error')
  assert.equal((await err.subscription()).retryable, true)
  const fe = withPorts(base, fixturePorts, 'sub=active&submit=field-error')
  assert.equal((await fe.cancel({ when: 'period_end' })).ok, false)
  assert.equal((await fe.subscription()).data.cancelAt, undefined)
  // state=loading 은 끝나지 않는다, &delay 는 목이 기다린다
  const loading = withPorts(base, fixturePorts, 'state=loading')
  assert.equal(await Promise.race([loading.subscription(), new Promise((res) => setTimeout(() => res('pending'), 50))]), 'pending')
  const t0 = Date.now()
  await withPorts(base, fixturePorts, 'delay=120').subscription()
  assert.ok(Date.now() - t0 >= 100, '&delay 만큼 기다린다')
  // 브라우저 밖 기본 onTrack 도 멈추지 않는다
  assert.doesNotThrow(() => withPorts(base, fixturePorts, 'consent=all').track('cta_click', { id: 'a', label: 'b', section: 'c' }))
})

// Task 14c(레인 C 걱정 6): 갤러리 제출 포트는 불릴 때마다 센다(__wfSubmitted) — 보내는 중 두 번 보내기 막기를 브라우저에서 잴 때 쓴다.
test('제출 세기(Task 14c): 주입한 submit 은 부를 때마다 submitted() 를 부르고 결과는 그대로다', async () => {
  let n = 0
  const env = { ...fakeEnv('submit=ok').env, submitted: () => { n++ } }
  const props = withStates(formMeta, { copy: {} }, undefined, 'submit=ok', env)
  assert.deepEqual(await props.submit({}), { ok: true, data: DEFAULT_RECEIPT })
  await props.submit({})
  assert.equal(n, 2)
  // 브라우저 밖(기본 부수 효과)에서 불러도 멈추지 않는다
  assert.equal((await withStates(formMeta, { copy: {} }, undefined, 'submit=ok').submit({})).ok, true)
})

// Task 14c(레인 C 걱정 6): 보내는 중 보내기 버튼은 disabled 가 아니라 aria-disabled — 포커스가 버튼에 남는다(disabled 면 body 로 빠진다).
test('SubmitButton(Task 14c): 보내는 중이면 aria-disabled="true" + 「보내는 중」, disabled 속성은 없다 · 평소에는 둘 다 없다', async () => {
  const { SubmitButton } = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'blocks', '_shared', 'form-flow.tsx'))).href)
  const copy = { submitLabel: '보내기', pendingLabel: '보내는 중' }
  const disabledAttr = /\sdisabled(="[^"]*")?[\s>]/
  const busy = renderToStaticMarkup(h(SubmitButton, { flow: { pending: true }, copy }))
  assert.match(busy, /aria-disabled="true"/)
  assert.doesNotMatch(busy, disabledAttr)
  assert.match(busy, /보내는 중/)
  const idle = renderToStaticMarkup(h(SubmitButton, { flow: { pending: false }, copy }))
  assert.doesNotMatch(idle, /aria-disabled/)
  assert.doesNotMatch(idle, disabledAttr)
  assert.match(idle, /보내기/)
  // 두 번 보내기 막기는 흐름(useFormFlow)의 ref 잠금 — 원천에 있다(브라우저 검사는 __wfSubmitted 로 잰다)
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'form-flow.tsx'), 'utf8')
  assert.match(src, /if \(sending\.current(?: \|\| cooldown\.seconds > 0)?\) return/)
  assert.doesNotMatch(src, /disabled=\{flow\.pending\}/)
})
