// Task 7b 블록 규칙 검사(P3-2 Task 7b — 앱·계정 새 블록 + billing-manage 덧붙임): 메타 rules 에 적은 규칙(factory-rules.md §22)마다 정적 검사가 하나 이상 있다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-rules-7b.test.mjs
// 방법은 레인 D1·D2 검사와 같다: 소비자에게 나가는 컴파일본(_compiled — 훅이 실제 클래스로 풀린 것)을 typescript 로 .tmp 에 옮겨 예시 콘텐츠(.fixture.ts)와
// 서버가 미리 읽은 값(initial)으로 정적 렌더(react-dom/server)한 뒤 마크업을 본다 — 브라우저 없음. 클릭·키보드·포커스·타이머가 필요한 흐름(고르기·되돌리기·
// 대기 초 세기·저장 안 한 변경 경고)은 브라우저 동작 검사(레인 보고서 flows-7b)로 넘긴다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { loadBlocks, RULE_ID } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-rules-7b-test')
const COMPILED = join(root, 'registry', 'factory', 'blocks', '_compiled')
const NEW = ['data-table/admin-list', 'data-table/bulk-select', 'data-table/compact', 'data-table/record-panel', 'account/security', 'account/credentials', 'account/delete-account', 'confirmation/verify-email']

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
const mock = await load(join(root, 'registry', 'factory', 'contract', 'adapter-mock.ts'))
const { EVENTS } = await load(join(root, 'registry', 'factory', 'contract', 'events.ts'))
const kit = await load(join(COMPILED, '_shared', 'data-table-kit.tsx'))

const all = loadBlocks(root).filter((b) => b.meta.success)
const blocks = all.filter((b) => NEW.includes(`${b.kind}/${b.variant}`))
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
const mods = new Map()
for (const kv of [...NEW, 'account/billing-manage']) {
  const [kind, variant] = kv.split('/')
  const mod = await load(join(COMPILED, kind, `${variant}.tsx`))
  const fx = await load(join(root, 'registry', 'factory', 'blocks', kind, `${variant}.fixture.ts`))
  const C = mod[pascal(kind) + pascal(variant)]
  assert.equal(typeof C, 'function', `${kv} 컴포넌트`)
  mods.set(kv, { C, fx, mod, source: readFileSync(join(COMPILED, kind, `${variant}.tsx`), 'utf8') })
}
const render = (kv, extra = {}, which = 'fixture') => {
  const { C, fx } = mods.get(kv)
  return renderToStaticMarkup(React.createElement(C, { ...fx[which], ...extra }))
}

// ── 마크업 도우미 ──────────────────────────────────────────────────────────────────────
const tags = (html, sel) => [...html.matchAll(new RegExp(`<([a-z0-9]+)(?=[^>]*${sel})[^>]*>`, 'g'))].map((m) => m[0])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
const count = (html, re) => (html.match(re) ?? []).length
const at = (html, sel) => html.search(new RegExp(sel))
function choiceGroups(html) {
  const out = []
  for (const m of html.matchAll(/data-choice-group=""[^>]*>([\s\S]*?)(?=data-choice-group=""|$)/g)) out.push({ decline: tags(m[1], 'data-choice="decline"'), primary: tags(m[1], 'data-choice="primary"'), at: m.index })
  return out
}
const trackCalls = (source) => [...source.matchAll(/track\?\.\(\s*"([a-z_]+)"\s*,\s*(\{[^}]*\}|[a-zA-Z_]+)/g)].map((m) => ({ name: m[1], props: m[2] }))
const PERSONAL = /\b(email|phone|name|password|detail|address)\s*:/

// ── 예시 + 서버가 미리 읽은 값 ─────────────────────────────────────────────────────────
const SESSION = { userId: 'user-example-1', name: '김예시', email: 'kim@example.com', twoFactor: false }
const auth = mock.mockAuth('?auth=signed-in')
const DEVICES = [...mock.MOCK_DEVICES]
const SUB_ACTIVE = { planId: 'pro', status: 'active', currentPeriodEnd: '2026-10-31T15:00:00.000Z' }
const SUB_SCHEDULED = { ...SUB_ACTIVE, cancelAt: '2026-10-31T15:00:00.000Z' }
const SUB_PAUSED = { planId: 'pro', status: 'paused', pausedUntil: '2026-11-30T15:00:00.000Z' }
const PLANS = [...mock.MOCK_PLANS]
const billing = mock.mockBilling('?sub=active')
const SECURITY = { initial: { session: SESSION, sessions: DEVICES }, listSessions: auth.listSessions, revokeSession: auth.revokeSession, revokeOtherSessions: auth.revokeOtherSessions, enableTwoFactor: auth.enableTwoFactor, disableTwoFactor: auth.disableTwoFactor, verifyTwoFactor: auth.verifyTwoFactor }
const PROPS = {
  'data-table/admin-list': {},
  'data-table/bulk-select': {},
  'data-table/compact': {},
  'data-table/record-panel': {},
  'account/security': SECURITY,
  'account/credentials': { initial: { session: SESSION }, changeEmail: auth.changeEmail, changePassword: auth.changePassword },
  'account/delete-account': { initial: { session: SESSION, subscription: SUB_ACTIVE }, exportMyData: auth.exportMyData, subscription: async () => ({ ok: true, data: SUB_ACTIVE }) },
  'confirmation/verify-email': { initial: { session: { ...SESSION, emailVerified: false } }, sendVerificationEmail: auth.sendVerificationEmail },
}
const html = new Map()
for (const kv of NEW) for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) html.set(`${kv}:${which}`, render(kv, PROPS[kv], which))
const page = (kv, which = 'fixture') => html.get(`${kv}:${which}`)

// ── 표: 적은 규칙마다 검사가 있다 ──────────────────────────────────────────────────────
test('새 블록 8개가 모두 rules 를 적었고 규칙 ID 모양이 맞다, data-table 은 4변형(layout 이 겹치지 않는다)', () => {
  assert.equal(blocks.length, 8)
  for (const b of blocks) {
    assert.ok(b.meta.data.rules?.length, `${b.kind}/${b.variant} rules`)
    for (const r of b.meta.data.rules) assert.match(r, RULE_ID)
  }
  const dt = all.filter((b) => b.kind === 'data-table')
  assert.deepEqual(dt.map((b) => b.variant).sort(), ['admin-list', 'bulk-select', 'compact', 'record-panel'])
  assert.equal(new Set(dt.map((b) => b.meta.data.layout)).size, 4)
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

// ── X1: 진짜 버튼·링크, 이름 있음 ─────────────────────────────────────────────────────────
for (const kv of NEW)
  check('X1', kv, () => {
    for (const which of ['fixture', 'fixtureMax', 'fixtureMin']) {
      const h = page(kv, which)
      assert.equal(count(h, /\sonclick=/g), 0)
      assert.equal(count(h, /<a\b(?![^>]*\shref=)/g), 0, `${which} href 없는 링크`)
      for (const m of h.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const name = attr(`<x${m[1]}>`, 'aria-label') || textOf(m[2])
        assert.ok(name, `${which} 이름 없는 버튼: ${m[0].slice(0, 120)}`)
      }
      for (const t of tags(h, 'role="(checkbox|switch)"')) assert.ok(attr(t, 'aria-label') || attr(t, 'id'), `${which} 이름 없는 체크칸: ${t.slice(0, 100)}`)
      for (const t of tags(h, 'role="button"')) assert.match(t, /^<button\b/, `${which} 버튼이 아닌 role=button: ${t.slice(0, 100)}`)
    }
  })

// ── O7: 빈 상태는 무엇인지·왜 비었는지·주 행동 하나, 「결과 없음」은 이유와 초기화 ─────────────────────────────
for (const kv of ['data-table/admin-list', 'data-table/bulk-select', 'data-table/compact', 'data-table/record-panel'])
  check('O7', kv, () => {
    const fx = mods.get(kv).fx.fixture
    const h = render(kv, { state: { status: 'empty' } })
    assert.match(h, /role="status"/)
    assert.ok(h.includes(fx.copy.empty.title), '무엇인지(제목)')
    assert.ok(h.includes(fx.copy.empty.body), '왜 비었는지(설명)')
    const acts = [...h.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    assert.equal(acts.length, 1, '주 행동 하나')
    assert.equal(acts[0][1], fx.copy.empty.action.href)
    assert.equal(count(h, /data-no-results/g), 0, '처음부터 빈 것은 「결과 없음」과 다른 화면')
    if (kv === 'data-table/admin-list' || kv === 'data-table/bulk-select') {
      const none = render(kv, { initialQuery: { search: '존재하지않는검색어' } })
      assert.match(none, /data-no-results=""/)
      assert.ok(none.includes(fx.copy.noResults.title) && none.includes(fx.copy.noResults.body), '결과 없음 이유')
      assert.match(textOf(none), new RegExp(fx.copy.noResults.reset), '필터 초기화')
      assert.ok(!none.includes(fx.copy.empty.title), '빈 상태 문구가 아니다')
      assert.match(none, /data-result-count="0"/)
      assert.match(none, /role="status"[^>]*data-result-count="0"/)
    }
  })

// ── L3: 대등한 두 선택지(거절 먼저) ──────────────────────────────────────────────────────
const equalPair = (h, where) => {
  const gs = choiceGroups(h)
  assert.ok(gs.length >= 1, `${where} 선택 묶음`)
  for (const g of gs) {
    assert.equal(g.decline.length, 1, `${where} 거절 하나`)
    assert.equal(g.primary.length, 1, `${where} 주 하나`)
    assert.equal(attr(g.decline[0], 'class').replace(/\s+/g, ' '), attr(g.primary[0], 'class').replace(/\s+/g, ' '), `${where} 두 버튼 같은 클래스`)
    assert.match(attr(g.decline[0], 'class'), /min-h-12/)
  }
  return gs
}
check('L3', 'account/delete-account', () => {
  const h = page('account/delete-account')
  const gs = equalPair(h, 'delete-account')
  assert.equal(gs.length, 1)
  const a = h.slice(gs[0].at)
  assert.ok(a.search(/data-choice="decline"/) < a.search(/data-choice="primary"/), '거절이 먼저')
  assert.match(textOf(a), /취소.*계정 지우기/)
  // 미리 켜 둔 체크가 없다
  assert.equal(count(h, /aria-checked="true"|\schecked(=|\s|>)|\sdata-checked(=|>|\s)/g), 0)
})
// 누른 뒤에 나오는 확인 — 원천에서 ChoiceRow·decline 먼저·primary 로 본다(레인 D1 방식)
for (const kv of ['data-table/bulk-select', 'data-table/record-panel', 'account/security'])
  check('L3', kv, () => {
    const src = mods.get(kv).source
    assert.match(src, /ChoiceRow/)
    const d = src.indexOf('choice: "decline"') >= 0 ? src.indexOf('choice: "decline"') : src.indexOf('choice="decline"')
    assert.ok(d >= 0, 'decline 선택지')
    assert.ok(src.search(/choice[=:] ?"decline"/) < src.search(/choice[=:] ?"primary"/), '거절이 앞')
    // 처음 그릴 때는 확인 묶음이 없다(누른 뒤에 나온다)
    assert.equal(choiceGroups(page(kv)).length, 0, '처음엔 확인 묶음 없음')
  })

// ── O2: 라벨 늘 보임·(필수)/(선택)·noValidate·알림 자리 ───────────────────────────────────
const formsOk = (h, where) => {
  assert.ok(count(h, /<form\b/g) >= 1, `${where} 폼`)
  for (const f of h.matchAll(/<form\b[^>]*>/g)) assert.match(f[0], /noValidate|novalidate/, `${where} noValidate`)
  assert.equal(count(h, /\srequired(=|\s|>)/g), 0, `${where} required 속성 없음`)
  for (const t of tags(h, 'type="(text|email|password|tel)"|<textarea')) {
    const id = attr(t, 'id')
    assert.ok(id && new RegExp(`<label\\b[^>]*for="${id}"`).test(h), `${where} 라벨 for=${id}`)
  }
  for (const m of h.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)) if (m[1].startsWith('') && /input|textarea/.test(h.slice(h.indexOf(`id="${m[1]}"`) - 30, h.indexOf(`id="${m[1]}"`) + 5) + '')) assert.match(textOf(m[2]), /\((필수|선택)\)/, `${where} ${m[1]} 표시`)
}
check('O2', 'data-table/record-panel', () => {
  const h = page('data-table/record-panel')
  formsOk(h, 'record-panel')
  assert.match(h, /id="record-alert"[^>]*tabindex="-1"[^>]*role="alert"|role="alert"[^>]*tabindex="-1"/)
  const fx = mods.get('data-table/record-panel').fx.fixture.state.data
  for (const f of fx.fields) {
    const input = tags(h, `name="${f.name}"`)[0] ?? ''
    assert.ok(input, `${f.name} 칸`)
  }
  assert.match(h, /defaultValue|value="김예시"/, '값이 미리 들어 있다')
  assert.match(h, /김예시/)
  assert.equal(count(h, /\(필수\)/g), fx.fields.filter((f) => f.required).length)
  assert.equal(count(h, /\(선택\)/g), fx.fields.filter((f) => !f.required).length)
})
check('O2', 'account/credentials', () => {
  const h = page('account/credentials')
  formsOk(h, 'credentials')
  assert.equal(count(h, /<form\b/g), 2, '이메일·비밀번호 두 폼')
  assert.match(h, /autoComplete="new-password"|autocomplete="new-password"/i)
  // 「다른 기기에서도 로그아웃하기」는 선택이고 해제로 시작한다
  const box = tags(h, 'role="checkbox"')[0]
  assert.ok(box, '체크칸')
  assert.match(box, /aria-checked="false"/)
  assert.doesNotMatch(box, /aria-checked="true"/)
  assert.match(textOf(h), /다른 기기에서도 로그아웃하기 \(선택\)/)
  // 비밀번호가 없으면 그 구역만 없다
  assert.equal(count(page('account/credentials', 'fixtureMin'), /<form\b/g), 2)
  assert.equal(count(render('account/credentials', { ...PROPS['account/credentials'], changePassword: undefined }), /<form\b/g), 1)
})
check('O2', 'account/security', () => {
  // 비밀번호·코드 칸은 누른 뒤에 나온다 — 원천의 FormField(라벨·표시)와 noValidate 폼으로 본다
  const src = mods.get('account/security').source
  assert.match(src, /marker=\{copy\.twoFactor\.password\.marker\}/)
  assert.match(src, /marker=\{copy\.twoFactor\.code\.marker\}/)
  assert.equal(count(src, /<form\b[^>]*noValidate/g), 2)
  assert.match(src, /autoComplete="current-password"/)
  assert.match(src, /autoComplete="one-time-code"/)
  // 처음엔 폼이 없다(2단계는 [켜기]를 눌러야 시작)
  assert.equal(count(page('account/security'), /<form\b/g), 0)
})

// ════ 블록별 내용 검사 ═══════════════════════════════════════════════════════════════════

// ── 표 순수 함수(검색·거르기·정렬·쪽) ─────────────────────────────────────────────────────
const COLS = [
  { id: 'name', label: '이름', primary: true, sortable: true },
  { id: 'n', label: '수', kind: 'numeric', sortable: true },
  { id: 'st', label: '상태', kind: 'status', filter: true },
  { id: 'd', label: '일', kind: 'date', sortable: true },
]
const ROW = (id, name, n, st, d) => ({ id, cells: { name, n, st, d } })
const DATA = { columns: COLS, rows: [ROW('a', '가나', 10, '활성', '2026-09-03T00:00:00.000Z'), ROW('b', '다라', 2, '정지', '2026-09-01T00:00:00.000Z'), ROW('c', '마바', null, '활성', null), ROW('d', '사아', 30, '활성', '2026-09-02T00:00:00.000Z')] }
const Q = { search: '', filters: {}, sort: null, page: 1 }
test('data-table-kit: 검색은 글자·상태 열만, 거르기는 열 값 일치, 정렬은 숫자·날짜·한글 순이고 빈 값은 방향과 상관없이 뒤, 값이 같으면 처음 순서', () => {
  const ids = (q) => kit.applyQuery(DATA, { ...Q, ...q }).map((r) => r.id)
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'])
  assert.deepEqual(ids({ search: '나' }), ['a'])
  assert.deepEqual(ids({ search: '정지' }), ['b'], '상태 열도 검색한다')
  assert.deepEqual(ids({ search: '10' }), [], '숫자 열은 검색하지 않는다')
  assert.deepEqual(ids({ filters: { st: '활성' } }), ['a', 'c', 'd'])
  assert.deepEqual(ids({ filters: { st: '활성' }, search: '마' }), ['c'])
  assert.deepEqual(ids({ sort: { column: 'n', dir: 'asc' } }), ['b', 'a', 'd', 'c'])
  assert.deepEqual(ids({ sort: { column: 'n', dir: 'desc' } }), ['d', 'a', 'b', 'c'], '빈 값은 내림차순에서도 뒤')
  assert.deepEqual(ids({ sort: { column: 'd', dir: 'asc' } }), ['b', 'd', 'a', 'c'])
  assert.deepEqual(ids({ sort: { column: 'name', dir: 'desc' } }), ['d', 'c', 'b', 'a'])
  assert.deepEqual(kit.filterOptions(DATA, 'st'), ['정지', '활성'])
  // 서버 검색: 검색어로 다시 거르지 않는다(가린 연락처·표에 안 보이는 칸을 서버가 맞춘 행이 사라지지 않게) — 거르기·정렬은 그대로
  const server = (q) => kit.applyQuery(DATA, { ...Q, ...q }, { serverSearch: true }).map((r) => r.id)
  assert.deepEqual(server({ search: 'nobody@example.com' }), ['a', 'b', 'c', 'd'])
  assert.deepEqual(server({ search: '나', filters: { st: '활성' } }), ['a', 'c', 'd'])
  assert.deepEqual(server({ sort: { column: 'n', dir: 'asc' } }), ['b', 'a', 'd', 'c'])
})
test('data-table-kit: pageOf 는 범위를 맞추고(없는 쪽을 가리키지 않는다) 빈 목록도 한 쪽, cellText 는 숫자 자리 구분·서울 날짜·빈 값 —', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i)
  const p = kit.pageOf(rows, 3, 10)
  assert.deepEqual([p.rows.length, p.page, p.pages, p.from, p.to, p.total], [3, 3, 3, 21, 23, 23])
  assert.equal(kit.pageOf(rows, 99, 10).page, 3)
  assert.equal(kit.pageOf(rows, 0, 10).page, 1)
  const e = kit.pageOf([], 1, 10)
  assert.deepEqual([e.pages, e.from, e.to], [1, 0, 0])
  assert.equal(kit.cellText({ id: 'n', label: '', kind: 'numeric' }, 1234567), '1,234,567')
  assert.equal(kit.cellText({ id: 'd', label: '', kind: 'date' }, '2026-09-30T15:00:00.000Z'), '2026년 10월 1일')
  assert.equal(kit.cellText({ id: 'x', label: '' }, null), '—')
})

// ── admin-list ────────────────────────────────────────────────────────────────────────────
test('admin-list: 검색 라벨·거르기 라벨·결과 수(role=status)·표(caption·th scope·aria-sort)·쪽 이동, 첫 열은 행 머리·링크, 숫자 열 data-numeric', () => {
  const h = page('data-table/admin-list')
  const fx = mods.get('data-table/admin-list').fx.fixture.copy
  assert.match(h, /<label\b[^>]*for="admin-list-search"[^>]*>이메일 검색<\/label>/)
  assert.match(h, /<label\b[^>]*for="admin-list-filter-status"[^>]*>계정 상태<\/label>/)
  assert.match(h, /data-result-count="23"/)
  assert.ok(textOf(h).includes('전체 23건 중 23건'))
  assert.match(h, /<caption class="sr-only">사용자 목록<\/caption>/)
  for (const t of tags(h, '<th\\b')) assert.match(t, /scope="(col|row)"/)
  const sorts = tags(h, 'aria-sort=')
  assert.ok(sorts.length >= 3)
  for (const t of sorts) assert.match(attr(t, 'aria-sort'), /^(none|ascending|descending)$/)
  assert.equal(count(h, /<th\b[^>]*scope="row"/g), 10, '한 쪽 10줄, 첫 열이 행 머리')
  assert.equal(count(h, /class="[^"]*" href="#user-\d+"/g) >= 10 || count(h, /href="#user-\d+"/g) >= 10, true)
  assert.ok(count(h, /<time\b[^>]*data-numeric/g) >= 10, '날짜 칸')
  assert.match(h, /aria-label="쪽 이동"/)
  assert.ok(textOf(h).includes('1–10 / 전체 23건'))
  assert.equal(attr(tags(h, 'aria-label="쪽 이동"')[0], 'aria-label'), '쪽 이동')
  // 덜 중요한 열은 좁은 화면에서 숨는다(data-secondary), 상태 열은 글자 배지
  assert.ok(count(h, /data-secondary=""/g) >= 2)
  assert.match(h, /data-slot="badge"[^>]*>활성</)
  assert.ok(fx.search.label)
  // 정렬 상태를 준 첫 그림: 정렬이 실제로 적용된다
  const sorted = render('data-table/admin-list', { initialQuery: { sort: { column: 'logins', dir: 'desc' } } })
  assert.match(sorted, /aria-sort="descending"/)
})
test('admin-list: 필터를 준 첫 그림은 결과 수·쪽 수가 그 필터를 따른다(1쪽으로), 서버 쪽 이동 알림 onQueryChange 는 props', () => {
  const h = render('data-table/admin-list', { initialQuery: { filters: { status: '정지' }, page: 5 } })
  const n = kit.applyQuery(mods.get('data-table/admin-list').fx.fixture.state.data, { search: '', filters: { status: '정지' }, sort: null, page: 1 }).length
  assert.match(h, new RegExp(`data-result-count="${n}"`))
  assert.doesNotMatch(h, /aria-label="쪽 이동"/, '한 쪽이면 쪽 이동을 그리지 않는다')
  assert.match(mods.get('data-table/admin-list').source, /onQueryChange/)
  assert.match(mods.get('data-table/admin-list').source, /serverSearch/)
})

// ── bulk-select ────────────────────────────────────────────────────────────────────────────
test('bulk-select: 처음엔 아무것도 고르지 않고(미리 체크 없음), 행마다 이름 있는 체크칸·머리 체크칸(이 쪽 N명), 작업 줄 자리는 늘 있고 힌트만, 작업 버튼은 고른 뒤에', () => {
  const h = page('data-table/bulk-select')
  assert.equal(count(h, /aria-checked="true"|\sdata-checked(=|>|\s)|\schecked(=|\s|>)/g), 0)
  const rows = tags(h, 'data-select-row')
  assert.equal(rows.length, 10)
  assert.match(attr(rows[0], 'aria-label'), /^kim\.example1@example\.com 고르기$/)
  const head = tags(h, 'data-select-page')[0]
  assert.equal(attr(head, 'aria-label'), '이 쪽 10명 모두 고르기')
  assert.match(h, /data-bulk-bar="" data-count="0"/)
  assert.match(textOf(h), /사용자를 고르면 할 수 있는 작업이 여기에 나와요/)
  assert.equal(count(h, /data-bulk-action=/g), 0, '고르기 전엔 작업 버튼이 없다')
  assert.match(h, /aria-label="고른 사용자에게 할 작업"/)
  assert.equal(count(h, /data-select-all/g), 0)
})
test('bulk-select: 서버로 나가는 묶음은 id 목록 또는 { mode: query, query, expectedTotal }(개수 확인), 지우기는 확인·되돌리기 없음, 나머지는 되돌리기 표를 받는다', async () => {
  const src = mods.get('data-table/bulk-select').source
  assert.match(src, /mode: "query"/)
  assert.match(src, /mode: "query", query: \{ search: api\.query\.search, filters: api\.query\.filters \}, expectedTotal: matched\.length/)
  assert.match(src, /mode: "ids"/)
  const fx = mods.get('data-table/bulk-select').fx.fixture
  const del = fx.copy.actions.find((a) => a.id === 'delete')
  assert.ok(del.destructive && del.effect === 'remove')
  const r1 = await fx.bulk({ action: 'archive', selection: { mode: 'ids', ids: ['x'] } })
  const r2 = await fx.bulk({ action: 'delete', selection: { mode: 'ids', ids: ['x', 'y'] } })
  const r3 = await fx.bulk({ action: 'suspend', selection: { mode: 'query', query: { search: '', filters: {} }, expectedTotal: 23 } })
  assert.deepEqual([r1.data.done, r1.data.undoToken], [1, 'undo-archive'])
  assert.deepEqual([r2.data.done, 'undoToken' in r2.data], [2, false], '지우기는 되돌릴 수 없다')
  assert.equal(r3.data.done, 23)
  // 검색·거르기를 바꾸면 고른 것을 지운다
  assert.match(src, /JSON\.stringify\(\[api\.query\.search, api\.query\.filters\]\)/)
})

// ── compact ────────────────────────────────────────────────────────────────────────────────
test('compact: 최근 N건만 보이고(검색·거르기·쪽 이동 없음) 표에 다 못 담으면 「전체 M건 보기」 링크, 다 담으면 링크 없음, 정렬은 진짜 버튼', () => {
  const h = page('data-table/compact')
  assert.equal(count(h, /<tr\b[^>]*data-row=/g), 5)
  assert.match(h, /href="#billing-history"[^>]*>전체 7건 보기/)
  assert.equal(count(h, /type="search"|aria-label="쪽 이동"|<select\b/g), 0)
  assert.ok(count(h, /class="[^"]*cn-block-dt-sort|data-sort="none"/g) >= 1 || count(h, /data-sort="none"/g) >= 1)
  assert.doesNotMatch(page('data-table/compact', 'fixtureMin'), /전체 \d+건 보기/)
  assert.equal(count(page('data-table/compact', 'fixtureMin'), /<tr\b[^>]*data-row=/g), 2)
})

// ── record-panel ───────────────────────────────────────────────────────────────────────────
test('record-panel: 요약 dl·작업 버튼·편집 폼·위험한 작업(처음엔 [지우기] 버튼 하나, 확인 묶음 없음), 저장 안 한 변경은 beforeunload(A49), 폼은 form-flow(비제어)', () => {
  const h = page('data-table/record-panel')
  assert.match(h, /data-record-summary=""/)
  assert.equal(count(h, /<dt\b/g), 6)
  assert.equal(count(h, /data-record-action=/g), 2)
  assert.match(h, /data-danger-zone=""/)
  assert.match(h, /data-danger-trigger=""/)
  assert.equal(count(h, /data-choice-group/g), 0, '누르기 전엔 확인 묶음 없음')
  assert.match(h, /aria-live|role="alert"/)
  const src = mods.get('data-table/record-panel').source
  assert.match(src, /addEventListener\("beforeunload"/)
  assert.match(src, /removeEventListener\("beforeunload"/)
  assert.match(src, /e\.returnValue = ""/)
  assert.match(src, /useFormFlow\(/)
  // 작업 버튼이 없는 예시는 작업 구역이 없다
  assert.equal(count(page('data-table/record-panel', 'fixtureMin'), /data-record-action=/g), 0)
  assert.doesNotMatch(page('data-table/record-panel', 'fixtureMin'), /이 사용자에게 하는 작업/)
  // 읽기 상태: 찾을 수 없음(empty)에는 폼이 없다
  assert.equal(count(render('data-table/record-panel', { state: { status: 'empty' } }), /<form\b/g), 0)
})

// ── 관리 구획 모듈 모양(계획 3d) ───────────────────────────────────────────────────────────
// 관리 포트(contract/admin)의 표·상세를 블록에 그대로 넘길 수 있고, 구획에 없는 칸(편집 칸·위험한 작업)은 그 구역을 그리지 않는다. 예시 출력은 위 검사들이 그대로 지킨다.
const adminMod = await load(join(root, 'registry', 'factory', 'contract', 'adapter-mock-admin.ts'))
test('record-panel(관리 상세): 편집 칸이 비면 편집 폼을 그리지 않고, remove 가 없으면 위험한 작업 구역이 없다 — 주면 예전 그대로', () => {
  const data = mods.get('data-table/record-panel').fx.fixture.state.data
  const noFields = render('data-table/record-panel', { state: { status: 'ready', data: { ...data, fields: [] } } })
  assert.equal(count(noFields, /<form\b/g), 0)
  assert.doesNotMatch(noFields, /정보 고치기/)
  assert.match(noFields, /data-danger-zone=""/, '위험한 작업은 남는다')
  const noRemove = render('data-table/record-panel', { remove: undefined })
  assert.doesNotMatch(noRemove, /data-danger-zone=|data-danger-trigger=/)
  assert.equal(count(noRemove, /<form\b/g), 1, '편집 폼은 남는다')
  const noDangerCopy = render('data-table/record-panel', { copy: { ...mods.get('data-table/record-panel').fx.fixture.copy, danger: undefined } })
  assert.doesNotMatch(noDangerCopy, /data-danger-zone=/, 'copy.danger 가 없으면 remove 가 있어도 구역이 없다')
  const bare = render('data-table/record-panel', { remove: undefined, state: { status: 'ready', data: { ...data, fields: [] } } })
  assert.doesNotMatch(bare, /cn-block-rp-main/, '편집 칸도 위험한 작업도 없으면 오른쪽 칸 자체가 없다')
  // 숫자 칸(AdminRecordField type: number)
  const num = render('data-table/record-panel', { state: { status: 'ready', data: { ...data, fields: [{ name: 'qty', label: '수량', type: 'number', value: '3' }] } } })
  assert.match(num, /<input[^>]*type="number"[^>]*name="qty"|<input[^>]*name="qty"[^>]*type="number"/)
})

test('관리 포트 목의 표·상세를 admin-list·record-panel 에 그대로 넘기면 그려진다 — 식별자 열은 상세 링크, 연락처 열은 가려진 글, 후기 상세는 편집 폼 없음', async () => {
  const port = adminMod.mockAdmin('')
  const table = (await port.table({ section: 'orders' })).data
  const list = render('data-table/admin-list', { state: { status: 'ready', data: table } })
  assert.match(list, /<a href="\/admin\/orders\/ord-1003"[^>]*>ord-1003<\/a>/)
  assert.match(list, /010-\*\*\*\*-1111/)
  assert.doesNotMatch(list, /010-0000/)
  const order = (await port.record({ section: 'orders', id: 'ord-1003' })).data
  const panel = render('data-table/record-panel', { state: { status: 'ready', data: order }, actions: order.actions })
  assert.match(panel, /data-record-action="advance"/)
  assert.match(panel, /name="memo"/)
  const review = (await port.record({ section: 'reviews', id: 'rev-2002' })).data
  const reviewPanel = render('data-table/record-panel', { state: { status: 'ready', data: review }, actions: review.actions })
  assert.equal(count(reviewPanel, /<form\b/g), 0)
  assert.match(reviewPanel, /data-danger-zone=""/)
})

// ── security ───────────────────────────────────────────────────────────────────────────────
test('security: 이 기기는 「이 기기」 표시만 있고 끊는 버튼이 없다, 다른 기기마다 이름 있는 [로그아웃], 다른 기기가 있을 때만 [다른 기기 모두 로그아웃]', () => {
  const h = page('account/security')
  const cur = h.slice(h.indexOf('data-device="device-current"'), h.indexOf('data-device="device-phone"'))
  assert.match(cur, /data-current=""/)
  assert.match(textOf(cur), /이 기기/)
  assert.doesNotMatch(cur, /data-revoke=/)
  const rev = tags(h, 'data-revoke="device-phone"')[0]
  assert.equal(attr(rev, 'aria-label'), 'Safari · iPhone 기기 로그아웃')
  assert.match(h, /data-revoke-others=""/)
  const only = render('account/security', { ...SECURITY, initial: { session: SESSION, sessions: [DEVICES[0]] } })
  assert.doesNotMatch(only, /data-revoke-others=|data-revoke=/)
  assert.match(textOf(h), /마지막 사용 2026년 10월 1일/)
  assert.match(h, /<span data-numeric[^>]*>198\.51\.100\.\*<\/span>/)
  // 토큰은 포트가 내보내지 않는다 — 화면에 없다
  assert.doesNotMatch(h, /token|Bearer/i)
})
test('security: 2단계 인증은 꺼져 있으면 [켜기], 켜져 있으면 [끄기]이고 없는 메서드는 그 구역이 없다(죽은 버튼 없음), 미리 켜 둔 것 없음', () => {
  const off = page('account/security')
  assert.match(off, /data-two-factor="off"/)
  assert.match(textOf(tags(off, 'data-two-factor-trigger')[0] ? off.slice(off.indexOf('data-two-factor-trigger')) : ''), /2단계 인증 켜기/)
  const on = render('account/security', { ...SECURITY, initial: { session: { ...SESSION, twoFactor: true }, sessions: DEVICES } })
  assert.match(on, /data-two-factor="on"/)
  assert.match(textOf(on.slice(on.indexOf('data-two-factor-trigger'))), /2단계 인증 끄기/)
  assert.equal(count(off, /aria-checked="true"/g), 0)
  const min = page('account/security', 'fixtureMin')
  assert.match(min, /data-sessions=""/)
  const noTwo = render('account/security', { ...SECURITY, enableTwoFactor: undefined })
  assert.doesNotMatch(noTwo, /data-two-factor=/)
  const noSessions = render('account/security', { ...SECURITY, listSessions: undefined })
  assert.doesNotMatch(noSessions, /data-sessions=/)
  // 켜기는 첫 코드 확인(verifyTwoFactor) 뒤에야 켜진다 — 설정 키·백업 코드는 켜기 결과에서만 나온다
  const src = mods.get('account/security').source
  assert.match(src, /verifyTwoFactor\(\{ code:/)
  assert.match(src, /data-backup-codes/)
})

// ── credentials ────────────────────────────────────────────────────────────────────────────
test('credentials: 지금 이메일을 보이고, 이메일은 확인 메일 뒤에 바뀐다고 말하고, 값은 계측에 싣지 않는다(track 없음)', () => {
  const h = page('account/credentials')
  assert.match(textOf(h), /지금 이메일 kim@example\.com/)
  assert.match(textOf(h), /확인 메일이 이 주소로 가요\. 메일의 링크를 눌러야 바뀌어요/)
  const src = mods.get('account/credentials').source
  assert.equal(trackCalls(src).length, 0)
  assert.doesNotMatch(src, /track/)
  assert.match(src, /changeEmail\(\{ newEmail: v\.newEmail, currentPassword: v\.currentPassword, confirmed: true \}\)/) // 확인 단계 뒤 confirmed 를 싣는다(P3-7 AXC)
  assert.match(src, /revokeOtherSessions: revokeOthers/)
  const noSession = render('account/credentials', { ...PROPS['account/credentials'], initial: { session: null } })
  assert.match(noSession, /href="#sign-in"/)
  assert.equal(count(noSession, /<form\b/g), 0)
})

// ── delete-account ─────────────────────────────────────────────────────────────────────────
test('delete-account: 보존 기간 4종(6개월·5년·5년·3년)과 근거, 지워지는 것 목록, 유예 일수, 내 데이터 받기는 exportMyData 가 있을 때만', () => {
  const h = page('account/delete-account')
  const periods = tags(h, 'data-retention=').map((t) => attr(t, 'data-retention'))
  assert.deepEqual(periods, ['6개월', '5년', '5년', '3년'])
  assert.match(textOf(h), /전자상거래법 시행령 제6조/)
  assert.ok(count(h.slice(at(h, 'data-deleted')), /<li\b/g) >= 4)
  assert.match(textOf(h), /7일 동안 기다려요\. 그 안에 다시 로그인하면 지우기가 취소돼요/)
  assert.match(h, /data-export=""/)
  assert.doesNotMatch(render('account/delete-account', { ...PROPS['account/delete-account'], exportMyData: undefined }), /data-export=/)
  // 순서: 내 데이터 → 무엇이 지워지나 → 유예 → 결정
  assert.ok(at(h, 'data-part="export"') < at(h, 'data-part="what-happens"') && at(h, 'data-part="what-happens"') < at(h, 'data-part="grace"') && at(h, 'data-part="grace"') < at(h, 'data-part="decision"'))
})
test('delete-account: 구독이 살아 있으면 어떻게 되는지 알리되 막지 않는다(결정 묶음이 그대로), 해지 예약이면 그 날짜, 구독 없음이면 안내 없음', () => {
  const live = page('account/delete-account')
  assert.match(live, /data-part="subscription"/)
  assert.match(textOf(live), /구독 중이에요\. 계정을 지우면 2026년 10월 31일에 구독이 끝나고/)
  assert.equal(choiceGroups(live).length, 1, '구독이 있어도 지우기를 막지 않는다')
  assert.doesNotMatch(live, /<button[^>]*disabled=""[^>]*data-choice="primary"/)
  const sched = render('account/delete-account', { ...PROPS['account/delete-account'], initial: { session: SESSION, subscription: SUB_SCHEDULED } })
  assert.match(textOf(sched), /이미 해지가 예약돼 있어요\. 2026년 10월 31일까지 쓸 수 있고/)
  const none = render('account/delete-account', { ...PROPS['account/delete-account'], initial: { session: SESSION, subscription: { planId: null, status: 'none' } } })
  assert.doesNotMatch(none, /data-part="subscription"/)
})

test('delete-account 입력 확인(P3-7 AXC, DESIGN §7-B): copy.decision.typed 가 있고 로그인한 주소가 있으면 이메일 입력 칸(라벨·필수 표시·주소가 든 설명)이 결정 묶음에 그려지고, 둘 중 하나라도 없으면 예전 그대로(칸 없음)', () => {
  const h = page('account/delete-account')
  const inputs = tags(h, 'name="confirmEmail"')
  assert.equal(inputs.length, 1, '입력 확인 칸이 하나')
  assert.match(inputs[0], /type="email"/)
  assert.match(inputs[0], /autoComplete="off"|autocomplete="off"/i)
  assert.ok(at(h, 'name="confirmEmail"') > at(h, 'data-part="decision"'), '결정 묶음 안에 있다')
  assert.ok(at(h, 'name="confirmEmail"') < at(h, 'data-choice-group'), '확정 버튼 앞이다')
  assert.match(textOf(h), /지울 계정의 이메일 주소 \(필수\)/)
  assert.match(textOf(h), /계정 주소 kim@example\.com 을\(를\) 그대로 입력해 주세요/)
  assert.match(h, /id="delete-account-form"/, '폼 id 는 usePortForm 이 값을 읽는 자리')
  // 칸은 입력 확인일 뿐 새 확인 단계가 아니다 — 지우기 버튼은 그대로 한 쌍
  assert.equal(choiceGroups(h).length, 1)
  const fx = mods.get('account/delete-account').fx.fixture
  const noTyped = render('account/delete-account', { ...PROPS['account/delete-account'], copy: { ...fx.copy, decision: { ...fx.copy.decision, typed: undefined } } })
  assert.doesNotMatch(noTyped, /name="confirmEmail"/)
  const noEmail = render('account/delete-account', { ...PROPS['account/delete-account'], initial: { session: { userId: 'u', twoFactor: false }, subscription: SUB_ACTIVE } })
  assert.doesNotMatch(noEmail, /name="confirmEmail"/, '이메일이 없는 계정(소셜 가입)은 칸이 없다')
})
test('delete-account·확인 입력 원천: [계정 지우기] 는 confirmed: true 와 입력한 주소(confirmEmail)를 싣고, 틀리면 포트를 부르기 전에 그 칸 오류, [내 데이터 받기] 는 confirmed: true', () => {
  const src = mods.get('account/delete-account').source
  assert.match(src, /deleteAccount\(\{ confirmed: true, \.\.\.\(entered !== undefined \? \{ confirmEmail: entered \} : \{\}\) \}\)/)
  assert.match(src, /exportMyData\(\{ confirmed: true \}\)/)
  assert.match(src, /form\.showErrors\(\{ confirmEmail: \[typed\.mismatch\] \}\)/)
  assert.ok(src.indexOf('form.showErrors') < src.indexOf('form.run(() => deleteAccount({ confirmed'), '틀린 주소는 포트를 부르기 전에 막는다')
  assert.match(src, /entered\.toLowerCase\(\) !== me\.email\.toLowerCase\(\)/, '대소문자는 무시한다(서버와 같은 규칙)')
})

// ── verify-email ───────────────────────────────────────────────────────────────────────────
test('verify-email: 보낸 주소·걸음·스팸함 안내·[다시 보내기]와 role=timer 줄(남은 초를 센다 — useCooldown 시작), 이메일 바꾸기 링크', () => {
  const h = page('confirmation/verify-email')
  assert.match(textOf(h), /kim@example\.com 주소로 확인 메일을 보냈어요/)
  assert.equal(count(h, /<ol\b[^>]*>[\s\S]*?<\/ol>/g), 1)
  assert.equal(count(h, /<li\b/g), 2)
  assert.match(h, /data-resend=""/)
  assert.match(h, /<p role="timer" data-cooldown="0"/)
  assert.match(h, /href="#settings-credentials"[^>]*>이메일 바꾸기/)
  const src = mods.get('confirmation/verify-email').source
  assert.match(src, /useCooldown\(\)/)
  assert.match(src, /start\(resendAfter\)/)
  assert.match(src, /wait\.start\(resendAfter\)/)
  assert.match(src, /disabled: form\.pending \|\| held|disabled=\{form\.pending \|\| held\}/)
  // 요청 제한(rate_limited) 초는 폼의 대기(form.cooldown)로 같은 버튼을 잠근다
  assert.match(src, /form\.cooldown > 0/)
  assert.equal(count(h, /class="[^"]*"[^>]*role="timer"/g) + count(h, /role="timer"/g) >= 1, true)
})
test('verify-email: 이미 확인한 계정은 「확인했어요」와 다음 행동만(다시 보내기 없음), 로그인 안 했으면 로그인 링크, 다시 보내기 메서드가 없으면 버튼 없음', () => {
  const ok = render('confirmation/verify-email', { ...PROPS['confirmation/verify-email'], initial: { session: { ...SESSION, emailVerified: true } } })
  assert.match(ok, /data-verified=""/)
  assert.doesNotMatch(ok, /data-resend=|role="timer"/)
  assert.match(ok, /href="#today"/)
  const out = render('confirmation/verify-email', { ...PROPS['confirmation/verify-email'], initial: { session: null } })
  assert.match(out, /href="#sign-in"/)
  assert.doesNotMatch(out, /data-resend=/)
  assert.doesNotMatch(page('confirmation/verify-email', 'fixtureMin'), /data-verified=/)
  assert.doesNotMatch(render('confirmation/verify-email', { ...PROPS['confirmation/verify-email'], sendVerificationEmail: undefined }), /data-resend=/)
})

// ── billing-manage 덧붙임(A81 되살리기 · A48 청구서) ───────────────────────────────────────────
const BM = (subscription, extra = {}) => render('account/billing-manage', { initial: { subscription, plans: PLANS }, resume: billing.resume, portal: billing.portal, ...extra })
test('billing-manage: 해지 예약 구독은 [해지 취소하고 계속 쓰기], 일시정지는 [지금 다시 시작](resume 하나), 이용 중·이미 끝난 해지는 되살리기 없음', () => {
  const sched = BM(SUB_SCHEDULED)
  assert.match(sched, /data-revive="cancel-scheduled"/)
  assert.match(textOf(sched.slice(sched.indexOf('data-resume'))), /^[^<]*해지 취소하고 계속 쓰기/)
  const paused = BM(SUB_PAUSED)
  assert.match(paused, /data-revive="paused"/)
  assert.match(textOf(paused.slice(paused.indexOf('data-resume'))), /^[^<]*지금 다시 시작/)
  assert.doesNotMatch(BM(SUB_ACTIVE), /data-revive=/)
  assert.doesNotMatch(BM({ planId: 'pro', status: 'canceled', cancelAt: '2026-09-30T15:00:00.000Z' }), /data-revive=/, '이미 끝난 해지는 되살릴 수 없다')
  assert.doesNotMatch(BM({ planId: 'pro', status: 'expired', currentPeriodEnd: '2026-09-30T15:00:00.000Z' }), /data-revive=/)
  assert.doesNotMatch(BM(SUB_SCHEDULED, { resume: undefined }), /data-revive=/, 'resume 를 안 주면 버튼이 없다')
  const src = mods.get('account/billing-manage').source
  assert.match(src, /onRevived=\{subRead\.set\}/)
})
test('billing-manage: 「청구서·영수증 보기」는 portal 이 있고 문구를 줄 때만, 새 창으로 여는 버튼(아이콘 aria-hidden), 누를 때마다 portal 을 부른다(주소를 저장하지 않는다)', () => {
  const h = BM(SUB_ACTIVE)
  assert.match(h, /data-invoices=""/)
  assert.match(textOf(h.slice(h.indexOf('data-invoices'))), /^[^<]*청구서·영수증 보기/)
  assert.doesNotMatch(BM(SUB_ACTIVE, { portal: undefined }), /data-invoices=/)
  const copy = mods.get('account/billing-manage').fx.fixture.copy
  assert.doesNotMatch(BM(SUB_ACTIVE, { copy: { ...copy, invoices: undefined } }), /data-invoices=/, '문구가 없으면 나오지 않는다')
  const src = readFileSync(join(COMPILED, '_shared', 'billing-actions.tsx'), 'utf8')
  assert.match(src, /window\.open\("", "_blank"\)/)
  assert.match(src, /win\.opener = null/)
  assert.match(src, /portal\(\)/)
  assert.doesNotMatch(src, /localStorage|sessionStorage/)
  // 계측: resume 는 이벤트 표 안이고 개인정보 키가 없다
  for (const c of trackCalls(src)) {
    assert.ok(EVENTS.includes(c.name), c.name)
    assert.doesNotMatch(c.props, PERSONAL)
  }
  assert.ok(trackCalls(src).length >= 1)
})

// ── 계측 이름·개인정보(M1) ─────────────────────────────────────────────────────────────────
test('새 블록의 track 호출은 이벤트 표 안이고 props 에 개인정보 키가 없다(대부분 track 을 부르지 않는다)', () => {
  for (const kv of NEW) for (const c of trackCalls(mods.get(kv).source)) {
    assert.ok(EVENTS.includes(c.name), `${kv} ${c.name}`)
    assert.doesNotMatch(c.props, PERSONAL, `${kv} ${c.name}`)
  }
})
