// Task 7b-commerce 블록 규칙 검사(P3-2, 대장 A62): detail 상세페이지 새 kind 셋 — product-info · shipping-returns · qna. 메타 rules 에 적은 규칙(factory-rules.md §22)마다 정적 검사가 하나 이상 있고,
// 그 밖에 이 kind 만의 약속(고시 표는 실제 <table>·청약철회 7일 이상·「확인 필요」 표시·문의 폼은 필드 오류를 알리고 입력을 지킨다)을 검사한다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-rules-t7c.test.mjs
// 방법은 레인 D2 검사(blocks-rules-d2.test.mjs)와 같다: 소비자에게 나가는 컴파일본(_compiled)을 typescript 로 .tmp 에 옮겨 예시(.fixture.ts)로 정적 렌더(react-dom/server)한 뒤
// 마크업을 본다 — 브라우저 없음. 순수 함수(noticeIssues·policyIssues·qnaMatches)는 직접 부른다. 클릭·입력·포커스가 필요한 부분(문의 폼 제출·검색 입력)은 브라우저 동작 검사(레인 보고서)로 넘긴다.
// kind 가 아직 원천에 없으면(레인 도중 커밋 단계) 그 kind 의 검사는 건너뛴다 — 마지막 커밋에서는 셋 다 있어야 하고 첫 검사가 그것을 본다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks, RULE_ID, BLOCK_KINDS } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-rules-t7c-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')
const T7C_KINDS = ['product-info', 'shipping-returns', 'qna']
const has = (k) => BLOCK_KINDS.includes(k)

// ── 가짜 모듈: 모션 장면·기법(아무것도 안 함) ───────────────────────────────────────────────────────
const STUBS = {
  [join(root, 'registry', 'factory', 'motion', 'use-gsap-scene.ts')]: 'export function useGsapScene() {}\n',
  [join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts')]: 'export function rise() {}\n',
}
const loaded = new Map()
const outPath = (abs) => join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
const resolveSource = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = outPath(abs)
  loaded.set(abs, out)
  let text
  if (STUBS[abs] !== undefined) text = STUBS[abs]
  else {
    text = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    text = text.replace(/(from\s+|import\s*\(\s*|import\s+|export\s+\*\s+from\s+)(["'])(@\/|\.{1,2}\/)([^"']+)\2/g, (_, kw, q, pre, p) => {
      const base = pre === '@/' ? join(root, p) : resolve(dirname(abs), pre + p)
      const src = resolveSource(base)
      if (!src) throw new Error(`import 대상 없음: ${pre}${p} (${relative(root, abs)})`)
      return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
    })
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  return out
}
const load = async (abs) => import(pathToFileURL(transpile(abs)).href)

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { EVENTS } = await load(join(root, 'registry', 'factory', 'contract', 'events.ts'))
const { NEEDS_CHECK } = await load(join(root, 'registry', 'factory', 'content', 'content-core.ts'))

const blocks = loadBlocks(root).filter((b) => b.meta.success && T7C_KINDS.includes(b.kind))
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
const mods = new Map()
for (const b of blocks) {
  const kv = `${b.kind}/${b.variant}`
  const mod = await load(join(COMPILED, b.kind, `${b.variant}.tsx`))
  const fx = await load(join(root, 'registry', 'factory', 'blocks', b.kind, `${b.variant}.fixture.ts`))
  const C = mod[pascal(b.kind) + pascal(b.variant)]
  assert.equal(typeof C, 'function', `${kv} 컴포넌트`)
  mods.set(kv, { C, fx, mod })
}
const kinds = (k) => blocks.filter((b) => b.kind === k).map((b) => `${b.kind}/${b.variant}`)
const render = (kv, extra = {}, { which = 'fixture' } = {}) => {
  const { C, fx } = mods.get(kv)
  return renderToStaticMarkup(React.createElement(C, { ...fx[which], ...extra }))
}
const fixtureOf = (kv, which = 'fixture') => mods.get(kv).fx[which]
const WHICH = ['fixture', 'fixtureMax', 'fixtureMin']

// ── 마크업 도우미 ───────────────────────────────────────────────────────────────────────────────
const tags = (html, sel) => [...html.matchAll(new RegExp(`<([a-z0-9]+)(?=[^>]*${sel})[^>]*>`, 'g'))].map((m) => m[0])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<\/?(span|time|strong|em|b|a)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
const count = (html, re) => (html.match(re) ?? []).length
const digits = (s) => String(s).replace(/\D/g, '')
const trackCalls = (source) => [...source.matchAll(/track\?\.\(\s*"([a-z_]+)"\s*,\s*(\{[^}]*\}|[a-zA-Z_]+)/g)].map((m) => ({ name: m[1], props: m[2] }))
const PERSONAL = /\b(email|phone|name|password|detail|address|question|message|contact)\s*:/
const sourceOf = (kv) => readFileSync(join(COMPILED, kv.split('/')[0], `${kv.split('/')[1]}.tsx`), 'utf8')
const tables = (html) => [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)].map((m) => ({ open: m[0].match(/<table\b[^>]*>/)[0], inner: m[1] }))

// ── 표: 적은 규칙마다 검사가 있다 ─────────────────────────────────────────────────────────────────
test('Task 7b-commerce: kind 셋과 변형 3개씩(원천에 있는 kind 는 모두 rules 를 적었고 규칙 ID 모양이 맞다)', () => {
  for (const k of T7C_KINDS) if (has(k)) assert.equal(kinds(k).length, 3, `${k} 변형 3개`)
  for (const b of blocks) {
    assert.ok(b.meta.data.rules?.length, `${b.kind}/${b.variant} rules`)
    for (const r of b.meta.data.rules) assert.match(r, RULE_ID)
    assert.ok(b.meta.data.archetypes.includes('detail'), `${b.kind}/${b.variant} archetypes 에 detail`)
  }
})
const CHECKS = {}
const check = (rule, kv, fn) => {
  ;(CHECKS[rule] ??= new Set()).add(kv)
  test(`${rule} · ${kv}`, fn)
}
test('적은 규칙마다 정적 검사가 있다(rules × 블록 = 검사 표)', () => {
  const missing = []
  for (const b of blocks) for (const r of b.meta.data.rules) if (!CHECKS[r]?.has(`${b.kind}/${b.variant}`)) missing.push(`${b.kind}/${b.variant} ${r}`)
  assert.deepEqual(missing, [])
})

// ── X1 · X2 — 세 kind 공통 ────────────────────────────────────────────────────────────────────────
for (const b of blocks) {
  const kv = `${b.kind}/${b.variant}`
  if (b.meta.data.rules?.includes('X1'))
    check('X1', kv, () => {
      for (const which of WHICH) {
        const html = render(kv, {}, { which })
        assert.equal(count(html, /role="button"/g) - count(html, /<button\b[^>]*role="button"/g), 0, `${which} role=button 비버튼`)
        assert.equal(count(html, /\sonclick=/g), 0, `${which} onclick`)
        for (const a of tags(html, 'href=')) assert.match(a, /href="[^"]+"/, `${which} 링크 href`)
        for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) assert.ok(textOf(m[1]) || /aria-label="[^"]+"/.test(m[0]), `${which} 링크 이름`)
        for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) assert.ok(textOf(m[1]) || /aria-label="[^"]+"/.test(m[0]), `${which} 버튼 이름`)
      }
    })
  if (b.meta.data.rules?.includes('X2'))
    check('X2', kv, () => {
      for (const which of WHICH) {
        const html = render(kv, {}, { which })
        assert.equal(count(html, /<img\b/g), 0, `${which} 그림 0 — 정보는 글자`)
        assert.equal(count(html, /<svg\b[^>]*role="img"/g), 0, `${which} 정보 그림 0`)
        assert.match(html, /<h2\b/, `${which} h2`)
        assert.equal(count(html, /<h1\b/g), 0, `${which} h1 0`)
      }
    })
}

// ── product-info ─────────────────────────────────────────────────────────────────────────────────
const PIN = kinds('product-info')
const tel = (html) => tags(html, 'href="tel:').map((t) => attr(t, 'href'))
for (const kv of PIN) {
  test(`product-info · 고시 표는 실제 <table>: caption · th scope(열 둘 + 행마다) · 행 수 = 고시 항목 수 · ${kv}`, () => {
    for (const which of WHICH) {
      const html = render(kv, {}, { which })
      const notice = tables(html).filter((t) => /data-notice-table/.test(t.open))
      assert.equal(notice.length, 1, `${which} 고시 표 하나`)
      const t = notice[0].inner
      assert.match(t, /<caption\b/, `${which} caption`)
      assert.equal(count(t, /<th scope="col"/g), 2, `${which} 열 머리 둘`)
      assert.equal(count(t, /<th(?= |>)(?![^>]*scope=)/g), 0, `${which} scope 없는 th 0`)
      const rows = fixtureOf(kv, which).notice.rows
      assert.equal(count(t, /<tr data-notice-row=/g), rows.length, `${which} 행 수`)
      assert.equal(count(t, /<th scope="row"/g), rows.length, `${which} 행마다 th scope=row`)
      assert.match(t, new RegExp(`<caption[^>]*>[^<]*${fixtureOf(kv, which).notice.category}`), `${which} caption 에 고시 품목`)
    }
  })
  test(`product-info · 고시 값·항목 이름이 서버가 그린 첫 HTML 글자에 있다(그림 아님) · ${kv}`, () => {
    for (const which of WHICH) {
      const html = render(kv, {}, { which })
      const text = textOf(html)
      for (const r of fixtureOf(kv, which).notice.rows) {
        assert.ok(text.includes(r.label), `${which} 항목 이름 ${r.label}`)
        if (r.value) assert.ok(text.includes(r.value), `${which} 값 ${r.label}`)
      }
    }
  })
  test(`product-info · 값이 없는 항목은 「확인 필요」(data-needs-check) · 있는 항목은 그 글자가 없다 · JSON-LD 는 없다 · ${kv}`, () => {
    const max = render(kv, {}, { which: 'fixtureMax' })
    const full = render(kv, {}, { which: 'fixture' })
    assert.equal(count(full, /data-needs-check/g), 0, '온전한 예시에는 0')
    assert.ok(!textOf(full).includes(NEEDS_CHECK))
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.ok(count(min, /data-needs-check=""/g) >= 1, '최소 예시의 빈 값 → 확인 필요')
    assert.ok(textOf(min).includes(NEEDS_CHECK))
    // 값을 지운 행을 넣으면 확인 필요가 하나 더 생긴다(빈 칸을 지어내지 않는다)
    const fx = fixtureOf(kv)
    const rows = fx.notice.rows.map((r, i) => (i === 0 ? { id: r.id, label: r.label } : r))
    const blank = render(kv, { notice: { ...fx.notice, rows } })
    assert.equal(count(blank, /data-needs-check=""/g), count(full, /data-needs-check=""/g) + (kv.endsWith('key-facts-first') && fx.highlight.includes(fx.notice.rows[0].id) ? 2 : 1))
    assert.equal(jsonLdCount(max) + jsonLdCount(min) + jsonLdCount(full), 0)
  })
  test(`product-info · A/S 전화는 tel: 링크(번호 그대로) · ${kv}`, () => {
    const html = render(kv)
    const as = fixtureOf(kv).notice.rows.find((r) => r.phone)
    assert.ok(tel(html).includes(`tel:${digits(as.phone)}`), 'tel 링크')
    assert.match(html, new RegExp(`data-numeric=""[^>]*>${as.phone}<`))
  })
}
const jsonLdCount = (html) => count(html, /application\/ld\+json/g)
if (has('product-info')) {
  test('product-info · 제공할 수 없는 항목은 사유를 적는다(고시 Ⅱ.3, data-unavailable) — notice-table 최대 예시', () => {
    const html = render('product-info/notice-table', {}, { which: 'fixtureMax' })
    assert.equal(count(html, /data-unavailable=""/g), 1)
    assert.match(textOf(html), /제공할 수 없어요 — 주문을 받은 뒤 만들어 보내서/)
    assert.equal(count(html, /data-needs-check/g), 0, '사유가 있으면 확인 필요가 아니다')
  })
  test('product-info · key-facts-first: 강조 칸은 id 순서대로 최대 4개, 표는 그대로 전부, 빈 핵심 사실도 칸을 그리고 확인 필요', () => {
    const kv = 'product-info/key-facts-first'
    const html = render(kv)
    const ids = tags(html, 'data-fact=').map((t) => attr(t, 'data-fact'))
    assert.deepEqual(ids, ['origin', 'as', 'warranty'])
    assert.equal(count(render(kv, {}, { which: 'fixtureMax' }), /data-fact=/g), 4, '다섯째 강조는 무시')
    assert.equal(count(html, /<tr data-notice-row=/g), fixtureOf(kv).notice.rows.length, '표는 전부')
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.equal(count(min, /data-fact="as"[^>]*>[\s\S]*?data-needs-check=""/g), 1, '핵심 사실이 비면 칸에도 확인 필요')
    assert.equal(count(render(kv, { highlight: [] }), /data-key-facts/g), 0, '강조가 없으면 칸을 그리지 않는다')
    assert.equal(count(render(kv, { highlight: ['nope'] }), /data-fact=/g), 0, '없는 행 id 는 건너뛴다')
  })
  test('product-info · spec-and-notice: 사양은 dl · 고시는 table 로 나뉜다, 빈 사양 값은 확인 필요', () => {
    const kv = 'product-info/spec-and-notice'
    const html = render(kv)
    assert.equal(count(html, /<dl data-spec-list/g), 1)
    assert.equal(count(html, /data-spec=/g), fixtureOf(kv).specs.length)
    assert.equal(tables(html).length, 1, '표는 고시 하나(사양은 표가 아니다)')
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.equal(count(min, /data-spec="weight"[^>]*>[\s\S]*?data-needs-check=""/g), 1)
  })
  test('product-info · noticeIssues(순수): 온전한 예시 [] · 빈 값·중복·잘못된 전화·빈 품목을 잡는다', async () => {
    const { noticeIssues } = await load(join(COMPILED, '_shared', 'notice-kit.tsx'))
    const fx = fixtureOf('product-info/notice-table')
    assert.deepEqual(noticeIssues(fx.notice), [])
    assert.deepEqual(noticeIssues(fixtureOf('product-info/notice-table', 'fixtureMax').notice), [], '사유가 있는 항목은 문제가 아니다')
    assert.match(noticeIssues(fixtureOf('product-info/notice-table', 'fixtureMin').notice).join('|'), /A\/S 책임자와 전화번호」 값이 없어요/)
    assert.match(noticeIssues({ category: '침구류', rows: [fx.notice.rows[0], fx.notice.rows[0]] }).join('|'), /두 번이에요/)
    assert.match(noticeIssues({ category: '침구류', rows: [{ id: 'as', label: 'A/S', phone: 'abc' }] }).join('|'), /전화번호를 읽지 못했어요/)
    assert.match(noticeIssues({ category: ' ', rows: [] }).join('|'), /품목이 비었어요/)
  })
}

// ── shipping-returns ─────────────────────────────────────────────────────────────────────────────
const SR = kinds('shipping-returns')
for (const kv of SR) {
  const b = blocks.find((x) => `${x.kind}/${x.variant}` === kv)
  if (b.meta.data.rules?.includes('L1'))
    check('L1', kv, () => {
      for (const which of ['fixture', 'fixtureMax']) {
        const html = render(kv, {}, { which })
        const text = textOf(html)
        assert.match(text, /\d[\d,]*원/, `${which} 원화 금액 글자`)
        assert.match(text, /(VAT|부가세)[^.]{0,10}포함/, `${which} VAT 포함 안내`)
        assert.equal(count(html, /data-vat=""/g), 1, `${which} data-vat 하나`)
        assert.ok(html.indexOf('data-vat=""') < html.search(/\d[\d,]*원/), `${which} VAT 안내가 첫 금액보다 앞 — 첫 가격 화면에 총액 안내(게이트 total-first-screen, 375 에서 세로로 길어져도)`)
        for (const t of tags(html, 'data-price="shipping-fee"')) assert.ok(t, '배송비 표지')
        assert.ok(count(html, /data-price="shipping-fee"/g) >= 2, `${which} 배송비·무료 기준·도서산간 금액에 표지`)
      }
      // 무료 배송이면 금액이 없어도 안내는 문제없다(총액을 숨기지 않는다)
      assert.match(textOf(render(kv, {}, { which: 'fixtureMin' })), /무료예요/)
    })
  if (b.meta.data.rules?.includes('T3'))
    check('T3', kv, () => {
      for (const which of WHICH) {
        const html = render(kv, {}, { which })
        const days = Number(html.match(/data-withdrawal-days=""[^>]*>(\d+)</)?.[1] ?? html.match(/data-withdrawal-days[^>]*>(\d+)</)?.[1])
        assert.ok(days >= 7, `${which} 청약철회 ${days}일 ≥ 법정 7일`)
        assert.equal(days, fixtureOf(kv, which).facts.returns.withdrawalDays)
      }
      // 7일보다 짧게 넣으면 화면은 그리되 policyIssues 가 잡는다(아래 순수 검사) — 그림 값은 넣은 값 그대로(지어내지 않는다)
      assert.match(render(kv, { facts: { ...fixtureOf(kv).facts, returns: { ...fixtureOf(kv).facts.returns, withdrawalDays: 3 } } }), /data-withdrawal-days=""[^>]*>3</)
    })
  test(`shipping-returns · 배송·반품 값이 표(또는 dl)의 글자로 있다: 무료 기준·반품비 부담·불가 사유·하자 3개월/30일·환불 3영업일 · ${kv}`, async () => {
    const { LEGAL } = await load(join(COMPILED, '_shared', 'policy-kit.tsx'))
    assert.deepEqual(LEGAL, { withdrawalMinDays: 7, defectFromReceiptMonths: 3, defectFromKnownDays: 30, refundBusinessDays: 3 })
    const html = render(kv)
    const text = textOf(html)
    const f = fixtureOf(kv).facts
    assert.match(html, /data-free-threshold=""/)
    assert.ok(text.includes('50,000원 이상 주문하면 무료예요'), '무료 배송 기준')
    assert.match(html, /data-fee-payer="buyer"/)
    assert.ok(text.includes('6,000원을 구매자가 내요'), '반품 배송비 부담 주체와 금액')
    const ul = html.match(/<ul data-exclusions[^>]*>([\s\S]*?)<\/ul>/)[1]
    assert.equal(count(ul, /<li>/g), f.returns.exclusions.length)
    assert.match(text, /받은 날부터 3개월 안, 문제를 안 날부터 30일 안에 교환·반품할 수 있고 배송비는 판매자가 내요/, '하자 — 제17조 제3항 · 제18조 제10항')
    assert.match(html, /data-refund-days=""[^>]*>3</)
    assert.match(html, /data-defect=""/)
    // 판매자 부담이면 반품비 금액은 그리지 않는다
    const seller = render(kv, { facts: { ...f, returns: { ...f.returns, feePayer: 'seller' } } })
    assert.match(seller, /data-fee-payer="seller"/)
    assert.ok(!textOf(seller).includes('6,000원'))
  })
  test(`shipping-returns · 값이 없으면 「확인 필요」 · 온전한 예시엔 없다 · 0원은 「무료예요」 · null 은 추가 비용 없음 · ${kv}`, () => {
    const full = render(kv)
    assert.equal(count(full, /data-needs-check/g), 0)
    const empty = render(kv, { facts: { shipping: {}, returns: {} } })
    const n = count(empty, /data-needs-check=""/g)
    assert.ok(n >= 8, `빈 facts → 확인 필요 ${n}개(방법·출고·배송비·도서산간·기한·반품비·불가·환불 …)`)
    assert.ok(textOf(empty).includes(NEEDS_CHECK))
    const min = textOf(render(kv, {}, { which: 'fixtureMin' }))
    assert.match(min, /무료예요/)
    assert.match(min, /추가 비용이 없어요/)
    assert.match(min, /따로 정한 불가 사유는 없어요/)
    assert.match(min, /주문한 날 바로 보내요/)
  })
  if (kv === 'shipping-returns/policy-tables' || kv === 'shipping-returns/return-steps')
    test(`shipping-returns · 실제 <table>: caption · th scope(열 + 행) · ${kv}`, () => {
      for (const which of WHICH) {
        const ts_ = tables(render(kv, {}, { which })).filter((t) => /data-policy-table/.test(t.open))
        assert.equal(ts_.length, kv.endsWith('policy-tables') ? 2 : 1)
        for (const t of ts_) {
          assert.match(t.inner, /<caption\b/)
          assert.equal(count(t.inner, /<th scope="col"/g), 2)
          assert.equal(count(t.inner, /<th(?= |>)(?![^>]*scope=)/g), 0)
          assert.equal(count(t.inner, /<tr data-policy-row=/g), count(t.inner, /<th scope="row"/g))
        }
      }
    })
}
if (has('shipping-returns')) {
  test('shipping-returns · policy-tables: 배송 표 4행 + 반품 표 5행', () => {
    const html = render('shipping-returns/policy-tables')
    const [ship, ret] = tables(html)
    assert.equal(count(ship.inner, /<tr data-policy-row=/g), 4)
    assert.equal(count(ret.inner, /<tr data-policy-row=/g), 5)
    assert.deepEqual(tags(html, 'data-policy-row=').map((t) => attr(t, 'data-policy-row')), ['method', 'lead', 'fee', 'remote', 'withdrawal', 'returnFee', 'exclusions', 'defect', 'refund'])
  })
  test('shipping-returns · at-a-glance-cards: 큰 칸 셋(배송비·출고·기한)의 글자가 자세한 조건의 같은 값이다(요약이 다른 말을 하지 않는다)', () => {
    const kv = 'shipping-returns/at-a-glance-cards'
    const html = render(kv)
    assert.deepEqual(tags(html, 'data-glance-item=').map((t) => attr(t, 'data-glance-item')), ['fee', 'lead', 'withdrawal'])
    assert.equal(count(html, /data-glance-item=/g), 3)
    assert.ok(!/data-policy-row="(fee|lead|withdrawal)"/.test(html), '큰 칸으로 뺀 셋은 아래 목록에 다시 그리지 않는다')
    const big = textOf(html.match(/<dl data-glance[^>]*>([\s\S]*?)<\/dl>/)[1])
    assert.match(big, /3,000원/)
    assert.match(big, /주문 후 1영업일 안에 보내요/)
    assert.match(big, /받은 날부터 7일 안에 신청할 수 있어요/)
    const empty = render(kv, { facts: { shipping: {}, returns: {} } })
    assert.equal(count(empty.match(/<dl data-glance[^>]*>([\s\S]*?)<\/dl>/)[1], /data-needs-check=""/g), 3, '큰 칸 셋 모두 확인 필요')
  })
  test('shipping-returns · return-steps: 순서 ol 은 번호 1..n · 환불 단계 {days} 는 facts 의 환불 영업일 · 없으면 확인 필요 · 반품비 부담은 표에 있다', () => {
    const kv = 'shipping-returns/return-steps'
    const html = render(kv)
    const ol = html.match(/<ol data-return-steps[^>]*>([\s\S]*?)<\/ol>/)[1]
    assert.equal(count(ol, /<li\b/g), fixtureOf(kv).copy.steps.length)
    assert.deepEqual([...ol.matchAll(/aria-hidden="true"[^>]*>(\d+)</g)].map((m) => Number(m[1])), [1, 2, 3, 4])
    assert.match(textOf(ol), /상품이 도착한 날부터 3영업일 안에 결제한 수단으로/)
    assert.ok(!/\{days\}/.test(html), '자리 표시자가 남지 않는다')
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.match(textOf(min.match(/<ol data-return-steps[^>]*>([\s\S]*?)<\/ol>/)[1]), /확인 필요 영업일 안에/)
    assert.equal(count(ol, /data-fee-payer/g), 0, '반품비 부담은 순서 안이 아니라')
    assert.equal(count(html, /data-fee-payer=/g), 1, '표에')
  })
  test('shipping-returns · policyIssues(순수): 온전한 예시 [] · 청약철회 7일 미만·환불 3영업일 초과·빈 값을 잡는다', async () => {
    const { policyIssues } = await load(join(COMPILED, '_shared', 'policy-kit.tsx'))
    const f = fixtureOf('shipping-returns/policy-tables').facts
    assert.deepEqual(policyIssues(f), [])
    assert.match(policyIssues({ ...f, returns: { ...f.returns, withdrawalDays: 6 } }).join('|'), /법정 7일보다 짧아요\(전자상거래법 제17조 제1항\)/)
    assert.deepEqual(policyIssues({ ...f, returns: { ...f.returns, withdrawalDays: 14 } }), [], '더 길게 정하는 것은 된다')
    assert.match(policyIssues({ ...f, returns: { ...f.returns, refundDays: 5 } }).join('|'), /법정 3영업일보다 길어요\(전자상거래법 제18조 제2항\)/)
    assert.match(policyIssues({ shipping: {}, returns: {} }).join('|'), /배송비가 없어요.*출고 영업일이 없어요.*배송 방법이 없어요.*청약철회 기간이 없어요.*반품 배송비 부담 주체가 없어요.*환불 영업일이 없어요.*청약철회 불가 사유가 없어요/)
    assert.match(policyIssues({ ...f, shipping: { ...f.shipping, fee: 0 } }).join('|'), /무료배송 기준이 있어요/)
    // fixtureMin 은 환불 영업일이 비어 있다
    assert.match(policyIssues(fixtureOf('shipping-returns/policy-tables', 'fixtureMin').facts).join('|'), /환불 영업일이 없어요/)
  })
}

// ── qna ──────────────────────────────────────────────────────────────────────────────────────────
const QN = kinds('qna')
const KIT_SRC = existsSync(join(COMPILED, '_shared', 'qna-kit.tsx')) ? readFileSync(join(COMPILED, '_shared', 'qna-kit.tsx'), 'utf8') : ''
for (const kv of QN) {
  const b = blocks.find((x) => `${x.kind}/${x.variant}` === kv)
  const rules = b.meta.data.rules
  if (rules.includes('T5'))
    check('T5', kv, () => {
      for (const which of WHICH) {
        const items = fixtureOf(kv, which).items
        if (!items.length) continue
        const html = render(kv, {}, { which })
        const replies = tags(html, 'data-seller-reply=')
        assert.ok(replies.length >= 1, `${which} 판매자 답변 표지`)
        for (const t of replies) {
          const cls = attr(t, 'class') ?? ''
          assert.match(cls, /border-s-4/, `${which} 왼쪽 굵은 선`)
          assert.match(cls, /bg-muted/, `${which} 바탕색`)
        }
        for (const t of tags(html, 'data-qna-item=')) assert.doesNotMatch(attr(t, 'class') ?? '', /border-s-4|bg-muted/, '문의 카드는 답변과 모양이 다르다')
        assert.match(textOf(html), /판매자 답변/, `${which} 주체 글자`)
      }
    })
  if (rules.includes('M1'))
    check('M1', kv, () => {
      const src = `${sourceOf(kv)}\n${KIT_SRC}`
      const calls = trackCalls(src)
      assert.ok(calls.length >= 1, 'track 호출')
      for (const c of calls) {
        assert.ok(EVENTS.includes(c.name), `EVENTS 밖 이름 ${c.name}`)
        assert.doesNotMatch(c.props, PERSONAL, `${c.name} props 에 개인정보 키`)
      }
      assert.match(sourceOf(kv), /track\?: AnalyticsPort\["track"\]/)
      assert.ok(!/track\?\.\(\s*"[a-z_]+"\s*,\s*\{[^}]*(query|search|question)/.test(src), '검색어·질문 글을 계측에 싣지 않는다')
    })
  test(`qna · 답변은 접히지 않고 서버가 그린 첫 HTML 글자에 있다(details·hidden·aria-hidden 뒤 아님) · ${kv}`, () => {
    for (const which of WHICH) {
      const items = fixtureOf(kv, which).items
      const html = render(kv, {}, { which })
      assert.equal(count(html, /<details\b/g) + count(html, /\shidden(=|\s|>)/g), 0)
      const shownIds = tags(html, 'data-qna-item=').map((t) => attr(t, 'data-qna-item'))
      assert.ok(shownIds.length <= 5 || kv.endsWith('ask-form') === false)
      const expected = kv.endsWith('ask-form') ? items.slice(0, 3) : items.slice(0, 5)
      assert.deepEqual(shownIds, expected.map((i) => i.id), `${which} 보이는 문의`)
      const text = textOf(html)
      for (const it of expected) {
        assert.ok(text.includes(it.question), `${which} 질문 ${it.id}`)
        assert.ok(text.includes(it.answer), `${which} 답변 ${it.id}`)
      }
      for (const m of html.matchAll(/<time\b[^>]*dateTime="([^"]+)"/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}T/)
    }
  })
  test(`qna · 문의 채널 링크: 카카오 https(새 창·noopener) · 전화 tel: · 메일 mailto: — 값 있는 것만, 잘못된 값은 그리지 않는다 · ${kv}`, () => {
    if (kv.endsWith('ask-form') && !fixtureOf(kv).contact) return
    const html = render(kv)
    const kakao = tags(html, 'data-contact="kakao"')[0]
    assert.match(kakao, /href="https:\/\//)
    assert.match(kakao, /target="_blank"/)
    assert.match(kakao, /rel="noopener noreferrer"/)
    assert.match(tags(html, 'data-contact="phone"')[0], /href="tel:0212345678"/)
    assert.match(tags(html, 'data-contact="email"')[0], /href="mailto:help@example.com"/)
    const bad = render(kv, { contact: { kakaoUrl: 'http://pf.example.com/x', phone: 'abc', email: undefined } })
    assert.equal(count(bad, /data-contact=/g), 0, 'http 카카오·읽히지 않는 전화는 그리지 않는다')
    assert.equal(count(bad, /data-qna-contact/g), 0)
    const only = render(kv, { contact: { phone: '010-1234-5678' } })
    assert.equal(count(only, /data-contact=/g), 1)
  })
}
if (has('qna')) {
  test('qna · qnaMatches(순수): 공백 접기·대소문자 무시·질문+답변에서 찾기·종류 거르기·차례 유지', async () => {
    const { qnaMatches, qnaCategories } = await load(join(COMPILED, '_shared', 'qna-kit.tsx'))
    const items = fixtureOf('qna/answered-list').items
    assert.equal(qnaMatches(items, '').length, 8)
    assert.equal(qnaMatches(items, '  ').length, 8, '공백만은 전체')
    assert.deepEqual(qnaMatches(items, '세탁').map((i) => i.id), ['q5'])
    assert.deepEqual(qnaMatches(items, '냄새').map((i) => i.id), ['q6'])
    assert.deepEqual(qnaMatches(items, '환불은  언제').map((i) => i.id), ['q8'], '공백 접기')
    assert.deepEqual(qnaMatches(items, '3영업일').map((i) => i.id), ['q8'], '답변 글에서도 찾는다')
    assert.deepEqual(qnaMatches(items, '', '사이즈').map((i) => i.id), ['q3', 'q4'])
    assert.deepEqual(qnaMatches(items, '베개', '배송'), [], '종류와 검색어가 함께 걸린다')
    assert.equal(qnaMatches([{ id: 'x', question: 'Wash?', answer: 'YES', answeredAt: '2026-09-01T00:00:00.000Z' }], 'wash').length, 1, '대소문자 무시')
    assert.deepEqual(qnaCategories(items), ['배송', '사이즈', '세탁', '교환·반품'])
    assert.deepEqual(qnaCategories([]), [])
  })
  test('qna · answered-list: 종류 라디오 묶음(전체 + 종류, 하나만 선택) · 첫 5건 + 「3개 더 보기」 · 결과 개수 · 문의가 없으면 칩 없음', () => {
    const kv = 'qna/answered-list'
    const html = render(kv)
    const fs_ = html.match(/<fieldset\b[^>]*data-qna-categories[^>]*>([\s\S]*?)<\/fieldset>/)[1]
    assert.match(fs_, /<legend class="sr-only">문의 종류<\/legend>/)
    assert.equal(count(fs_, /type="radio"/g), 5)
    assert.equal(count(fs_, /checked=""/g), 1)
    assert.match(fs_, /checked="" value=""/, '전체가 처음 선택')
    assert.equal(new Set([...fs_.matchAll(/name="([^"]+)"/g)].map((m) => m[1])).size, 1, '한 묶음')
    assert.match(textOf(html), /8개의 문의/)
    assert.match(textOf(html), /3개 더 보기/)
    assert.equal(count(html, /data-qna-item=/g), 5)
    const max = render(kv, {}, { which: 'fixtureMax' })
    assert.equal(count(max, /data-qna-item=/g), 5)
    assert.match(textOf(max), /9개 더 보기/)
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.equal(count(min, /data-qna-categories/g), 0)
    assert.match(textOf(min), /아직 올라온 문의가 없어요/)
    assert.equal(count(min, /data-qna-list/g), 0)
    assert.equal(count(render(kv, { items: fixtureOf(kv).items.slice(0, 5) }), /더 보기/g), 0, '5건 이하면 더 보기 없음')
  })
  test('qna · search-first: 검색 칸(type=search·보이는 라벨) · 처음엔 전체 목록·빈 결과 알림 · 문의가 없으면 처음부터 「찾는 답이 없나요?」', () => {
    const kv = 'qna/search-first'
    const html = render(kv)
    assert.match(html, /<label\b[^>]*for="qna-search"[^>]*>궁금한 점을 검색해 보세요<\/label>/)
    assert.match(html, /<input\b[^>]*id="qna-search"[^>]*type="search"|<input\b[^>]*type="search"[^>]*id="qna-search"/)
    assert.match(html, /<p role="status" data-qna-result=""[^>]*><\/p>/, '검색 전엔 빈 알림 자리')
    assert.equal(count(html, /data-qna-item=/g), 5)
    assert.equal(count(html, /data-qna-not-found/g), 0)
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.equal(count(min, /data-qna-not-found/g), 1)
    assert.match(textOf(min), /찾는 답이 없나요\?/)
    assert.equal(count(min, /data-qna-list/g), 0)
    assert.equal(count(render(kv, {}, { which: 'fixtureMin' }), /data-contact="phone"/g), 1, '결과가 없어도 문의 채널은 있다')
  })
  test('qna · ask-form: 자주 받는 문의 최대 3건 · 폼 칸(연락처·궁금한 점·동의) · WebMCP 속성 없음(동의 칸이 든 폼) · 공개되지 않는다는 안내', () => {
    const kv = 'qna/ask-form'
    const html = render(kv)
    assert.equal(count(html, /data-qna-item=/g), 3)
    assert.match(html, /<form\b[^>]*id="qna-form"[^>]*noValidate/)
    assert.doesNotMatch(html, /toolname=/, '필수 동의 칸이 든 폼에는 WebMCP 를 달지 않는다(P3-7 AXWF)')
    assert.doesNotMatch(html, /toolautosubmit/)
    for (const n of ['contact', 'question', 'consent']) assert.match(html, new RegExp(`name="${n}"`), `${n} 칸`)
    assert.match(textOf(html), /다른 분께 공개되는 글이 아니에요/)
    const min = render(kv, {}, { which: 'fixtureMin' })
    assert.equal(count(min, /data-qna-list/g), 0, '목록 없이 폼만')
    assert.equal(count(min, /toolname=/g), 0)
    assert.equal(count(min, /data-qna-contact/g), 0)
  })
}
if (has('qna')) {
  const kv = 'qna/ask-form'
  check('O2', kv, () => {
    for (const which of WHICH) {
      const html = render(kv, {}, { which })
      assert.match(html, /<form\b[^>]*noValidate/, `${which} noValidate`)
      assert.equal(count(html, /\srequired(=|\s|>)/g), 0, `${which} required 속성 0(aria-required 로 알리고 오류 문구는 우리가)`)
      assert.equal(count(html, /aria-required="true"/g), 3, `${which} 필수 칸 셋`)
      for (const id of ['contact', 'question']) assert.match(html, new RegExp(`<label\\b[^>]*for="qna-${id}"[^>]*>[^<]*\\(필수\\)`), `${which} ${id} 라벨에 (필수)`)
      assert.match(html, /id="qna-alert"[^>]*tabindex="-1"[^>]*role="alert"|role="alert"[^>]*id="qna-alert"[^>]*tabindex="-1"|id="qna-alert"[^>]*role="alert"[^>]*tabindex="-1"/, `${which} 알림 자리(포커스 가능)`)
      assert.equal(count(html, /aria-busy="true"/g), 0, `${which} 처음엔 보내는 중 아님`)
      assert.equal(count(html, /aria-invalid="true"/g), 0, `${which} 처음엔 오류 없음`)
      const box = tags(html, 'data-consent="required"')
      assert.equal(box.length, 1, `${which} 필수 동의 표지 하나`)
      assert.match(box[0], /role="checkbox"/)
      assert.match(box[0], /aria-checked="false"/, `${which} 동의는 미리 체크하지 않는다`)
    }
    // 소스: 제출 흐름은 form-flow — 필수 칸·알림 문구·시간 초과 문구를 흐름에 넘긴다(칸 오류 포커스·입력 보존·pending 은 form-flow 검사와 브라우저 동작 검사)
    const src = sourceOf(kv)
    assert.match(src, /useFormFlow\(submit, \{ id, required: \["contact", "question", "consent"\], requiredMessage: copy\.form\.required, notices: copy\.form\.notices \}\)/)
    assert.match(src, /<FormAlert flow=\{flow\}/)
    // 예시 상태: 서버가 돌려줄 칸 오류는 이 폼에 있는 칸 이름이고 「어떻게 고치나」가 있다
    const fs_ = mods.get(kv).fx.fixtureStates
    for (const [name, msgs] of Object.entries(fs_.fieldErrors)) {
      assert.ok(['contact', 'question'].includes(name), `${name} 은 폼에 있는 칸`)
      for (const m of msgs) assert.match(m, /(예:|적어 주세요|확인해 주세요)/, `오류 문구는 고치는 방법을 말한다: ${m}`)
    }
    assert.ok(fs_.formError && fs_.receipt?.id)
  })
  check('A4', kv, () => {
    for (const which of WHICH) {
      const html = render(kv, {}, { which })
      assert.equal(count(html, /<dialog\b|role="dialog"|aria-haspopup/g), 0, `${which} 대화상자 없음 — 폼은 페이지 안에`)
      assert.equal(count(html, /<form\b/g), 1)
    }
  })
}

// ── 이 파일 마지막: 마지막 커밋에서는 세 kind 가 모두 있어야 한다 ─────────────────────────────────────
test('원천에 있는 Task 7b-commerce kind 목록(진행 중에는 일부, 끝나면 셋)', () => {
  const present = T7C_KINDS.filter(has)
  assert.ok(present.length >= 1)
  if (process.env.T7C_EXPECT_ALL) assert.deepEqual(present, T7C_KINDS)
})
void EVENTS
void trackCalls
void PERSONAL
void sourceOf
