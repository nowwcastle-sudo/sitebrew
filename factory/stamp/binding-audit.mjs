// binder 빈자리 감사(FV1 Task 5.11, C5 자료 연결) — 「골든 브리프의 사실이 모두 있다」고 가정한 콘텐츠로 실제 bindSection 을 돌려
// 원형 10 × 사이트맵 섹션 × 허용 변형마다 「자료 연결 안 됨」이 나는 자리를 표로 낸다. 03 의 ui-copy.mjs leakTable 과 같은 방식 —
// 손으로 적은 표가 아니라 06 이 쓰는 binder 를 그대로 부르므로 binder 가 늘면 표도 같이 줄어든다.
//   node factory/stamp/binding-audit.mjs [--json] [--all] [--archetype <id>]
//   (기본: 필수 섹션만. --all 은 선택 섹션도.)
//
// 「모든 사실이 있다」의 뜻: 콘텐츠 스키마(zod) 가 받는 모든 칸을 채운 콘텐츠(maxContent) + 사이트맵의 모든 섹션 문구 칸 + 모든 화면 문구 칸.
// 이 가정 아래에서도 묶이지 않는 자리는 둘 중 하나다 — ① 콘텐츠 칸은 있는데 binder 가 안 묶는다(binder 보강) ② 콘텐츠 스키마에 그 칸이 없다
// (04 구조 칸 STRUCTURE_FACTS 에 사실 이름을 더하거나 원형 JSON 허용 목록에서 그 변형을 뺀다). 사실이 브리프에 실제로 없어서 비는 것은
// 이 감사 밖이다(지어내지 않는다 — 그 몫은 04·06 의 「자료 연결 안 됨」 그대로).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { loadBlockIndex } from '../scripts/archetypes.mjs'
import { buildSitemap } from './sitemap.mjs'
import { loadBrief, ARCHETYPE_IDS } from './brief.mjs'
import { FACT_NAMES, loadContentSchema } from './content.mjs'
import { bindSection, blockItems, ctaTargetOf } from './gen-pages.mjs'
import { bindContentSection } from './content-sections.mjs'
import { uiLeavesOf } from './ui-copy.mjs'
import { pageLabel, paginationMergedIntoTable, refsOf, at } from './site-bind.mjs'
import { GOLDEN_DIR } from './golden.mjs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { z } = require('zod')


// ── 스키마에서 「모든 칸이 찬」 값 만들기 ────────────────────────────────────────────
// 패턴이 있는 글자 칸은 후보 값 중 패턴을 통과하는 첫 값을 쓴다(정규식 역생성은 하지 않는다).
const STRING_CANDIDATES = [
  'https://example.org/page', '/guide', '010-1234-5678', '02-1234-5678', '123-45-67890', 'hello@example.org', '2026-10-05', '2026-10', '12:00', '09:00', '2026', 'ko',
  '12345', '192x192', '#336699', '#ffffff', '#section', 'tel:+82212345678', 'mailto:hello@example.org', '가상 값', 'x', 'a', 'Asia/Seoul',
]
const NAME_HINTS = [
  [/email/i, 'hello@example.org'], [/phone|tel$/i, '02-1234-5678'], [/url|href|link|pdf$/i, 'https://example.org/page'], [/date$/i, '2026-10-05'],
  [/^(opens)$/, '09:00'], [/^(closes)$/, '18:00'], [/^(?:day)$/, 'mo'], [/year$/i, '2026'], [/slug|^next$/i, 'sample-slug'],
]

// 작은 정규식 역생성기 — ^ $ 리터럴 · [..] 문자 집합(범위) · \d \w \s · (..|..) 묶음 · {n}{n,m} + * ? 만 다룬다(스키마 패턴이 이 부분집합이다).
// 전방 탐색 등 모르는 구문이 나오면 던진다 — 호출하는 쪽이 후보 값으로 폴백한다.
function fromPattern(src) {
  let i = 0
  const take = () => src[i++]
  const classChars = (neg) => {
    const set = []
    while (src[i] !== ']') {
      let c = take()
      if (c === '\\') { const e = take(); set.push(...(e === 'd' ? '0123456789' : e === 'w' ? 'abcXYZ019_' : e)); continue }
      if (src[i] === '-' && src[i + 1] !== ']') { take(); const to = take(); for (let x = c.charCodeAt(0); x <= to.charCodeAt(0); x++) set.push(String.fromCharCode(x)); continue }
      set.push(c)
    }
    take()
    if (!neg) return set
    return 'abc가'.split('').filter((x) => !set.includes(x))
  }
  const atom = () => {
    const c = take()
    if (c === '(') {
      if (src[i] === '?') { take(); const k = take(); if (k !== ':') throw new Error('구문') }
      const alts = [alt()]
      while (src[i] === '|') { take(); alts.push(alt()) }
      take()
      return alts[0]
    }
    if (c === '[') { const neg = src[i] === '^'; if (neg) take(); return [classChars(neg)[0]] .join('') }
    if (c === '\\') { const e = take(); return e === 'd' ? '1' : e === 'w' ? 'a' : e === 's' ? ' ' : e }
    if (c === '.') return 'a'
    if (c === '^' || c === '$') return ''
    return c
  }
  const quant = (unit, startI) => {
    let min = 1
    if (src[i] === '{') { take(); let n = ''; while (/\d/.test(src[i])) n += take(); min = Number(n); if (src[i] === ',') { take(); while (/\d/.test(src[i])) take() } take() }
    else if (src[i] === '+') { take() } else if (src[i] === '*') { take(); min = 0 } else if (src[i] === '?') { take(); min = 0 }
    void startI
    return unit.repeat(min)
  }
  const seq = () => {
    let out = ''
    while (i < src.length && src[i] !== '|' && src[i] !== ')') {
      const start = i
      let unit = atom()
      // [..] 는 매번 같은 첫 글자를 쓰면 {n} 이 같은 글자 n 번이 되어도 통과한다 — 충분하다
      out += quant(unit, start)
    }
    return out
  }
  const alt = seq
  return alt()
}

// ix: 배열 항목 번호(0부터). 둘째 항목부터 같은 칸의 값이 서로 달라지게 한다 — 실제 브리프는 상품마다 분류가 다를 수 있는데 모든 항목이 같은 값이면 「분류 하나뿐」 같은 자리가 가려진다.
function sampleString(js, name, ix = 0) {
  const re = js.pattern ? new RegExp(js.pattern) : null
  const ok = (s) => (!re || re.test(s)) && (js.minLength == null || [...s].length >= js.minLength) && (js.maxLength == null || [...s].length <= js.maxLength)
  for (const [rx, v] of NAME_HINTS) if (rx.test(name) && ok(v)) return v
  if (js.format === 'email') return 'hello@example.org'
  if (js.format === 'uri' || js.format === 'url') return 'https://example.org/page'
  if (js.format === 'date') return '2026-10-05'
  const base = ix > 0 ? `가상 ${name}${ix + 1}` : `가상 ${name}`
  if (ok(base)) return base
  for (const c of STRING_CANDIDATES) if (ok(c)) return c
  if (!re) { const pad = base.padEnd(js.minLength ?? 1, '가'); return pad }
  try { const g = fromPattern(js.pattern); if (ok(g)) return g } catch { /* 후보 폴백 실패 → 던진다 */ }
  throw new Error(`글자 칸 ${name} 의 값을 만들지 못했다(pattern ${js.pattern})`)
}

function sample(js, name = '', depth = 0, ix = 0) {
  if (depth > 8) return undefined
  if (js.const !== undefined) return js.const
  if (js.enum) return js.enum[0]
  const alts = js.anyOf ?? js.oneOf
  if (alts) {
    const real = alts.filter((a) => a.type !== 'null')
    const pick = real.find((a) => a.type === 'object') ?? real[0]
    return pick ? sample(pick, name, depth + 1, ix) : null
  }
  if (js.allOf) return sample(Object.assign({}, ...js.allOf), name, depth + 1, ix)
  const t = Array.isArray(js.type) ? js.type.find((x) => x !== 'null') : js.type
  switch (t) {
    case 'object': {
      const out = {}
      for (const [k, v] of Object.entries(js.properties ?? {})) { const x = sample(v, k, depth + 1, ix); if (x !== undefined) out[k] = x }
      return out
    }
    case 'array': {
      const n = Math.min(js.maxItems ?? 3, Math.max(js.minItems ?? 0, 2))
      // 글자 항목은 아래에서 번호를 붙이고, 객체 항목은 항목 번호(ix)를 안쪽 글자 칸에 내려 보낸다
      const stringItems = (Array.isArray(js.items?.type) ? js.items.type[0] : js.items?.type) === 'string'
      return Array.from({ length: n }, (_, i) => sample(js.items ?? {}, name, depth + 1, stringItems ? 0 : i))
        .map((x, i) => (typeof x === 'string' && n > 1 ? `${x} ${i + 1}` : x))
    }
    case 'string': return sampleString(js, name, ix)
    case 'integer': case 'number': {
      const lo = js.minimum ?? (js.exclusiveMinimum != null ? js.exclusiveMinimum + 1 : 0)
      const hi = js.maximum ?? Infinity
      const prefer = /price|amount|fee/i.test(name) ? 9900 : /rating|avg/i.test(name) ? 4.5 : /count|total|users|reviews/i.test(name) ? 120 : /year/i.test(name) ? 2026 : 4
      const v = Math.min(hi, Math.max(lo, prefer))
      return t === 'integer' ? Math.round(v) : v
    }
    case 'boolean': return true
    default: return undefined
  }
}

// JSON Schema 가 못 옮기는 검사(refine·tuple·교차 칸)로 떨어진 자리를 알려진 값으로 고친다 — 감사 콘텐츠가 06 이 받는 콘텐츠(검사를 통과한 것)와 같은 모양이 되게.
const setPath = (obj, path, value) => { let o = obj; for (const k of path.slice(0, -1)) { if (o?.[k] === undefined) return false; o = o[k] } o[path.at(-1)] = value; return true }
const REPAIRS = [
  { when: (i) => /사업자등록번호/.test(i.message), fix: (c, i) => setPath(c, i.path, '123-45-67890') },
  { when: (i) => i.path.at(-1) === 'license', fix: (c, i) => setPath(c, i.path, 'https://example.org/license') },
  { when: (i) => /위도/.test(i.message), fix: (c, i) => setPath(c, i.path, 37.12345) },
  { when: (i) => /경도/.test(i.message), fix: (c, i) => setPath(c, i.path, 127.12345) },
  { when: (i) => /밤샘/.test(i.message), fix: (c, i) => { const row = i.path.slice(0, -1).reduce((o, k) => o?.[k], c); if (row) { row.overnight = false; row.opens = '09:00'; row.closes = '18:00' } return !!row } },
  { when: (i) => i.path.at(-2) === 'range' && /number/.test(i.message), fix: (c, i) => setPath(c, i.path.slice(0, -1), [0, 100]) },
  { when: (i) => /후기 칸을 싣지/.test(i.message), fix: (c) => { delete c.externalReviews; c.medical = true; return true } }, // 의료 변형은 후기 칸을 싣지 않는다(의료법 제56조②2)
  { when: (i) => /채널 값/.test(i.message), fix: (c, i) => { const row = i.path.slice(0, -1).reduce((o, k) => o?.[k], c); if (!row) return false; row.value = row.kind === 'tel' ? '02-1234-5678' : row.kind === 'mail' ? 'hello@example.org' : 'https://example.org/channel'; return true } },
  { when: (i) => i.path[0] === 'mapLinks' && /http/.test(i.message), fix: (c, i) => setPath(c, i.path, `https://example.org/${i.path.at(-1)}`) },
  { when: (i) => /같은 요일/.test(i.message), fix: (c, i) => { const rows = i.path.reduce((o, k) => o?.[k], c); if (!Array.isArray(rows)) return false; rows.forEach((r, n) => { r.day = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'][n % 7] }); return true } },
  { when: (i) => /쉬는 날/.test(i.message), fix: (c, i) => { const row = i.path.slice(0, -1).reduce((o, k) => o?.[k], c); if (!row) return false; delete row.opens; delete row.closes; delete row.breaks; return true } },
  { when: (i) => /같은 날짜/.test(i.message), fix: (c, i) => { const rows = i.path.reduce((o, k) => o?.[k], c); if (!Array.isArray(rows)) return false; rows.forEach((r, n) => { r.date = `2026-10-${String(n + 1).padStart(2, '0')}` }); return true } },
  { when: (i) => i.path.at(-2) === 'sameAs', fix: (c, i) => setPath(c, i.path, `https://example.org/${i.path.at(-1)}`) },
  { when: (i) => /쉬는 시간/.test(i.message) || i.path.at(-2) === 'breaks', fix: (c, i) => { const hours = c.hours?.[i.path[1]]; if (!hours) return false; hours.breaks = [{ start: '12:00', end: '13:00' }]; return true } },
  { when: (i) => i.path.join('.') === 'manifest.icons', fix: (c) => setPath(c, ['manifest', 'icons'], [{ src: '/icon-192.png', sizes: '192x192', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', purpose: 'any' }, { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }]) },
]
function repair(archetypeId, content) {
  const schema = loadContentSchema(archetypeId)
  for (let round = 0; round < 8; round++) {
    const r = schema.safeParse(content)
    if (r.success) return true
    let progressed = false
    for (const issue of r.error.issues) {
      const rule = REPAIRS.find((x) => x.when(issue))
      if (rule && rule.fix(content, issue) !== false) progressed = true
    }
    if (!progressed) return false
  }
  return false
}

// JSON Schema 가 모양을 못 내는 칸(z.record 로 받는 표 행)과, 값이 법이 정한 이름이어야 의미가 있는 칸(고시 항목 이름)은 실제와 같은 모양의 값으로 채운다 — 감사가 믿을 만하게.
const AUDIT_FIXUPS = {
  dashboard: (c) => {
    c.table = {
      columns: [{ id: 'name', label: '가상 이름', numeric: false }, { id: 'status', label: '가상 상태', numeric: false }, { id: 'amount', label: '가상 금액', numeric: true }],
      density: 40,
      rows: [{ name: '가상 항목 1', status: '가상 진행', amount: 1200 }, { name: '가상 항목 2', status: '가상 완료', amount: 3400 }, { name: '가상 항목 3', status: '가상 진행', amount: 5600 }],
    }
  },
  // 상품정보제공고시의 항목 이름은 고시 품목이 정한다(공정위 고시) — 핵심 항목(제조국·A/S·품질보증기준)이 든 의류 품목
  detail: (c) => {
    c.notice = {
      category: '가상 의류',
      rows: [['제품 소재', '가상 소재'], ['치수', '가상 치수'], ['제조자(수입자)', '가상 제조자'], ['제조국', '가상 제조국'], ['품질보증기준', '가상 보증'], ['A/S 책임자와 전화번호', '가상 책임자 02-1234-5678']].map(([label, value]) => ({ label, value })),
    }
  },
}

const cache = new Map()
/** 원형 콘텐츠 스키마가 받는 모든 칸을 채운 콘텐츠(slots 는 비움 — 호출하는 쪽이 사이트맵으로 채운다). 스키마를 통과해야 한다. */
export function maxContent(archetypeId, locale = 'ko') {
  const key = `${archetypeId}/${locale}`
  if (cache.has(key)) return structuredClone(cache.get(key))
  const schema = loadContentSchema(archetypeId)
  const out = {}
  for (const [k, field] of Object.entries(schema.shape)) {
    if (k === 'slots') continue
    const js = z.toJSONSchema(field, { io: 'input', unrepresentable: 'any' })
    const v = sample(js, k)
    if (v !== undefined) out[k] = v
  }
  out.archetype = archetypeId
  out.locale = locale
  AUDIT_FIXUPS[archetypeId]?.(out)
  // 봉투 칸(content.mjs ENVELOPE_KEYS): 회사 정보 칸이 없는 원형(portfolio·pwa·dashboard)은 이름·메일을 facts 에 원문으로 둔다(brief.mjs factPath).
  out.facts = { name: '가상 이름', email: 'hello@example.org', phone: '02-1234-5678' }
  out.site = { url: 'https://example.org', locale }
  out.slots = { copy: [], images: [] }
  const valid = repair(archetypeId, out)
  if (!valid) Object.defineProperty(out, '__invalid', { value: true, enumerable: false })
  cache.set(key, out)
  return structuredClone(out)
}

/** 감사에 쓰는 사이트맵 — 골든 브리프 1 번 + 브리프가 모를 수 있는 사실 이름을 모두 채워 선택 섹션이 모두 들어오게 한다. */
export async function auditSitemap(archetypeId, archetypes) {
  const brief = loadBrief(join(GOLDEN_DIR, `${archetypeId}-1.json`))
  const facts = { ...Object.fromEntries(FACT_NAMES.map((n) => [n, `${n} 사실`])), ...brief.facts }
  return { brief, sitemap: buildSitemap(archetypes[archetypeId], { ...brief, facts }) }
}

/** 문구 칸 하나에 한 줄 — 사이트맵 섹션의 원형 copySlots 마다. 칸 경로 = `<쪽>/<섹션>/<칸>`. */
function fillSlots(content, sitemap, arch) {
  const copyIndex = new Map()
  // 같은 칸 id 를 한 섹션에서 여러 번 쓸 수 있다(04 가 항목마다 쓴 칸 — gen-pages 가 `#<순서>` 로 센다) — 둘씩 둔다.
  const push = (path, id) => { for (const n of [0, 1]) { const i = content.slots.copy.length; content.slots.copy.push({ id, role: '', text: `${id} 문구 ${n + 1}` }); copyIndex.set(`${path}#${n}`, i) } }
  const sections = [
    ...sitemap.pages.flatMap((p) => p.sections.map((s) => ({ key: `${p.id}/${s.kind}`, pageId: p.id, kind: s.kind }))),
    ...(sitemap.globals ?? []).map((g) => ({ key: `global/${g.kind}`, pageId: 'global', kind: g.kind })),
  ]
  for (const { key, pageId, kind } of sections) {
    const spec = pageId === 'global' ? arch.globalSections?.find((g) => g.kind === kind) : arch.pages.find((p) => p.id === pageId)?.sections.find((s) => s.kind === kind)
    for (const c of spec?.copySlots ?? []) push(`${key}/${c.id}`, c.id)
  }
  return copyIndex
}

const AUDIT_NOW = Date.parse('2026-10-10T00:00:00Z')

/**
 * 알려진 빈자리 — 이 감사의 가정(콘텐츠 스키마의 모든 칸이 차 있다)에서도 묶을 수 없는 섹션. 원인이 binder 가 아니라 콘텐츠 스키마·블록·제품 기능에 있어
 * 이 레인의 범위(binder 보강·구조 칸·허용 목록)로 닫히지 않는다. 항목마다 이유와 미룬 일 대장 행을 적는다(낡으면 시험이 알려 준다).
 * 감사 표에는 `issue: 'known-gap'` 으로 나오고, 「필수 섹션에 자료 연결 안 됨 0」 시험은 이 줄을 세지 않는다.
 */
export const KNOWN_GAPS = [
  { archetype: 'local', section: 'product-detail/bookable-item', register: ['C143'], why: '허용 변형이 stepped-booking 하나뿐인데 단계 예약 폼은 가능한 날짜·시간표가 필요하다 — 자체 예약 시스템이 없어 지어내면 거짓 가능 시간이다' },
  { archetype: 'portfolio', section: 'home/about', register: ['C111'], why: '허용 변형이 brand-fact-sheet 하나뿐인데 설립일·대표 소개 등 조직 사실 칸이 portfolio 콘텐츠 스키마에 없다' },
]

/** 묶인 props 의 $ref 중 콘텐츠에 없는 경로(06 이 resolveRefs 에서 `$ref 대상이 콘텐츠에 없다` 로 멈추는 자리) — 감사가 「묶였다」만 보면 이 결함을 못 잡는다. */
export const dangling = (props, content) => (props ? [...refsOf(props)].filter((p) => at(content, p) === undefined) : [])

const knownGap = (archetype, section) => KNOWN_GAPS.find((g) => g.archetype === archetype && g.section === section)

/**
 * @param {{ requiredOnly?: boolean, archetype?: string, includeBound?: boolean }} [opts]  includeBound: 묶인 자리도 `issue: 'bound'` 로 센다(양성 대조)
 * @returns {Promise<{ archetype: string, section: string, variant: string, required: boolean, issue: 'unbound'|'known-gap'|'throws'|'bound', why?: string, register?: string[] }[]>}
 */
export async function bindingAudit({ requiredOnly = true, archetype = null, includeBound = false } = {}) {
  const archetypes = await loadArchetypes()
  const rows = []
  for (const id of ARCHETYPE_IDS.filter((x) => !archetype || x === archetype)) {
    const arch = archetypes[id]
    const { sitemap } = await auditSitemap(id, archetypes)
    const content = maxContent(id)
    const routes = Object.fromEntries(sitemap.pages.map((p) => [p.id, p.route]))
    const copyIndex = fillSlots(content, sitemap, arch)
    const navLinks = () => [{ label: pageLabel('home', 'ko'), href: '/' }]
    const primaryCta = () => ctaTargetOf(content, routes)
    const secondaryHref = () => routes.pricing ?? '#'
    const pageTitleOf = (pageId) => pageLabel(pageId, 'ko')
    const sections = [
      ...sitemap.pages.filter((p) => !p.legal).flatMap((p) => p.sections.map((s, i) => ({ key: `${p.id}/${s.kind}`, page: p, s, first: i === 0 }))),
      ...(sitemap.globals ?? []).filter((g) => g.status === 'block').map((g) => ({ key: `global/${g.kind}`, page: null, s: g, first: false })),
    ]
    for (const { key, page, s, first } of sections) {
      if (requiredOnly && !s.required) continue
      if (s.status === 'content' || s.status === 'part') {
        // 쪽 나누기 부품은 같은 쪽의 목록 표 블록이 함께 그린다(06 gen-pages 와 같은 규칙) — 표가 안 묶이면 표의 줄이 막는다
        if (paginationMergedIntoTable(page, s)) { if (includeBound) rows.push({ archetype: id, section: key, variant: '(본문)', required: s.required, issue: 'bound' }); continue }
        const spec = arch.pages.find((p) => p.id === page.id)?.sections.find((x) => x.kind === s.kind)
        const nb = spec?.noBlock ?? {}
        const res = bindContentSection({ key, pageId: page.id, render: nb.render, missing: nb.missing, content, copyIndex, routes, locale: 'ko', sitemap, pageTitleOf, first, now: AUDIT_NOW })
        const gap = knownGap(id, key)
        if (!res.props && !res.omit) rows.push({ archetype: id, section: key, variant: '(본문)', required: s.required, issue: gap ? 'known-gap' : 'unbound', why: res.why, ...(gap ? { register: gap.register } : {}) })
        else if (dangling(res.props, content).length) rows.push({ archetype: id, section: key, variant: '(본문)', required: s.required, issue: 'dangling-ref', why: dangling(res.props, content).join(', ') })
        else if (includeBound) rows.push({ archetype: id, section: key, variant: '(본문)', required: s.required, issue: 'bound' })
        continue
      }
      if (s.status !== 'block') continue
      for (const block of s.allowedVariants) {
        const uiLeaves = (await uiLeavesOf(block)).map((l) => ({ path: l.path, ref: 'slots.copy.0.text' }))
        let r
        try { r = await bindSection({ key, block, content, copyIndex, routes, locale: 'ko', navLinks, primaryCta, secondaryHref, uiLeaves }) } catch (e) {
          rows.push({ archetype: id, section: key, variant: block, required: s.required, issue: 'throws', why: String(e.message).slice(0, 160) })
          continue
        }
        // 알려진 빈자리는 그 섹션의 허용 변형이 전부 안 묶일 때만 해당한다 — 일부만 안 묶이면 아래에서 그 변형 줄이 unbound 로 남는다.
        if (!r.props && !r.omit) rows.push({ archetype: id, section: key, variant: block, required: s.required, issue: 'unbound', why: r.why })
        else if (dangling(r.props, content).length) rows.push({ archetype: id, section: key, variant: block, required: s.required, issue: 'dangling-ref', why: dangling(r.props, content).join(', ') })
        else if (includeBound) rows.push({ archetype: id, section: key, variant: block, required: s.required, issue: 'bound', ...(r.issues?.length ? { exampleIssues: r.issues.map((i) => `${i.path ?? ''}(${i.why})`) } : {}) })
      }
      // 이 섹션의 허용 변형이 모두 안 묶이고 알려진 빈자리면 줄 종류를 바꾼다
      const gap = knownGap(id, key)
      if (gap) {
        const mine = rows.filter((r) => r.archetype === id && r.section === key && r.issue === 'unbound')
        if (mine.length === s.allowedVariants.length) for (const r of mine) { r.issue = 'known-gap'; r.register = gap.register }
      }
    }
  }
  return rows
}

/** 한 줄 표시: `<원형>:<섹션>:<변형>`. */
export const rowKey = (r) => `${r.archetype}:${r.section}:${r.variant}`

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const arch = args.includes('--archetype') ? args[args.indexOf('--archetype') + 1] : null
  const withIssues = args.includes('--issues') // 묶였지만 예시 문구가 남는 자리도 보인다(참고 — 이 감사가 막는 것은 「자료 연결 안 됨」뿐이다)
  const rows = await bindingAudit({ requiredOnly: !args.includes('--all'), archetype: arch, includeBound: withIssues })
  if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  else if (withIssues) { for (const r of rows.filter((x) => x.exampleIssues)) console.log(`issues\t${rowKey(r)}\t${r.exampleIssues.join(' ')}`); console.log(`예시 문구 이슈가 남은 묶음 ${rows.filter((x) => x.exampleIssues).length}곳`) }
  else { for (const r of rows) console.log(`${r.issue}\t${rowKey(r)}\t${r.why}`); console.log(`합계 ${rows.length}줄`) }
  void blockItems; void loadBlockIndex
}
