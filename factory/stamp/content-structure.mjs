// 04-content 구조 칸(대장 C297, 레인 DATA04) — 본문 섹션 렌더러(content-sections.mjs)가 읽는 구조 자료를 문구 에이전트에게 알린다.
//   · 렌더러는 콘텐츠의 구조 칸(brand news·leaders·reports·history·careersUrl, public quickLinks·notices, portfolio works·caseStudies, saas changelog …)에서
//     값을 읽는다. 04 요청은 그 칸을 요청한 적이 없어 문구 에이전트가 채우지 않았고 본문 섹션이 「자료 연결 안 됨」으로 비었다.
//   · 이 모듈은 사이트맵에 든 본문 섹션의 원형 noBlock.render 가 읽는 콘텐츠 경로(render.from·rows·links·fields)를 뿌리별로 모아
//     요청의 `structureSlots[]` 로 만든다(모양은 콘텐츠 스키마에서 — 새 칸을 더하면 요청이 따라온다).
//   · 사실을 지어내지 않는다: 이 칸은 브리프 사실로만 채운다. 사실이 없으면(empty) 칸을 비운다 → 06 이 「자료 연결 안 됨」 blocker.
//   · checkStructure(request, content) 가 `--check` 에서 본다 — 사실 없는 칸을 채움 · 사실 있는 칸을 비움 · 항목의 이름·날짜·연도·주소·숫자가 브리프 사실에 없음.
//   스키마가 필수인 뿌리 중 사진·결정 칸은 다른 규칙이 맡는다(STRUCTURE_EXEMPT).
import { z } from 'zod'
import { isNeedsCheck } from './needs-check.mjs'

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// 콘텐츠 뿌리 → 이 뿌리를 채우는 브리프 사실 이름(원형별). 섹션 이름이 사실 이름이 되는 sitemap.mjs SECTION_FACTS 와 같은 이름이다.
export const STRUCTURE_FACTS = {
  brand: { news: ['news'], history: ['history'], leaders: ['leaders', 'leadership'], reports: ['reports', 'sustainability'], careersUrl: ['careersUrl', 'careers'] },
  public: { quickLinks: ['quickLinks'], notices: ['notices'], subBody: ['guide'], hours: ['hours'], directions: ['transit', 'parking'], mapLinks: ['naverMapUrl', 'kakaoMapUrl'] },
  portfolio: { works: ['works'], caseStudies: ['caseStudies'] },
  saas: { changelog: ['changelog', 'releases'], testimonials: ['testimonials'], integrations: ['integrations'] },
  local: { departments: ['departments'], doctors: ['doctors'], notices: ['notices'] },
  // QFIX [3] — 쪽 제목 줄의 주 행동 주소(링크 렌더러)와 목록 표(블록 binder 가 읽는다 — 아래 BLOCK_STRUCTURE_ROOTS)
  dashboard: { primaryActionHref: ['primaryActionUrl'], table: ['tableColumns', 'tableRows'] },
  // pwa 앱 고유 화면의 안내 글(주 화면 카드 · 상세 문단 · 결과 문단)
  pwa: { homeItems: ['homeItems'], detailBody: ['detailBody'], resultBody: ['resultBody'] },
  // detail: 묻고 답한 질문 · 다른 방식 비교 · 상세 이미지 조각(사진 파일 없이 글만 — 「실제 사진 필요」 입력 대기)
  detail: { faq: ['faq'], compare: ['compare'], slices: ['story'] },
}

// 본문 렌더러가 아니라 **블록 binder** 가 읽는 구조 자료 뿌리 → 그 뿌리를 읽는 섹션(<쪽>/<섹션>). 이 섹션이 사이트맵에 들면 구조 칸으로 요청한다(렌더러 뿌리와 같은 길 — 모양·사실 이름·empty·검사).
// 새 블록 binder 가 콘텐츠 구조 칸을 읽게 되면 여기에 한 줄을 더한다(안 더하면 04 가 그 칸을 요청받지 못해 사실이 있어도 비었다 — 골든 2차 dashboard 표).
export const BLOCK_STRUCTURE_ROOTS = {
  dashboard: { table: ['admin-list/data-table', 'admin-list/search-filter-bar'] },
  public: { hours: ['main/agency-info'], directions: ['main/agency-info'], mapLinks: ['main/agency-info'] },
  detail: { faq: ['product-detail/qna'], compare: ['product-detail/key-points'] },
  // QFIX2 — 후기 벽(social-proof)·연동 격자(integrations)가 읽는 콘텐츠 testimonials·integrations
  saas: { testimonials: ['home/social-proof', 'home/testimonials', 'campaign/testimonials'], integrations: ['home/integrations', 'campaign/integrations'] },
  local: { notices: ['home/notice'] }, // QFIX2 — 날짜 붙은 한 줄 공지(맨 위 띠가 끝나는 날을 읽는다)
}

// 렌더러가 읽지만 이 모듈이 요청하지 않는 뿌리와 까닭(테스트가 「읽는 뿌리 전부 표 또는 여기」를 본다).
export const STRUCTURE_EXEMPT = {
  'commerce.shipping': '스키마 필수 구조 — 배송 사실(shipping·shippingFee)로 기존 규칙이 채운다',
  'commerce.products': '스키마 필수 구조 — 상품·원산지는 브리프 사실(bestsellers·products·origin)로 기존 규칙이 채운다',
  'dashboard.decision': '열거형·결정 칸 — COPY.md 「열거형·불리언 결정 칸」 규칙(가장 덜 주장하는 값)',
  'local.gallery': '사진 칸 — 이미지 파일이 필요하다(05-media·「실제 사진 필요」)',
}

// ImageSlot 칸이 쓰는 원형 이미지 칸 id(IMAGE_SLOTS 의 키) — 요청이 id·비율·출처를 그대로 알린다.
const IMAGE_FIELD_SLOT = {
  'brand.news.thumb': 'news-thumb', 'brand.leaders.portrait': 'portrait', 'portfolio.works.thumb': 'work-thumb', 'local.doctors.portrait': 'portrait',
}
// 주소 글자 칸(JSON Schema 에서는 그냥 string 이라 이름으로 안다).
const URL_FIELDS = new Set(['url', 'pdfUrl', 'careersUrl', 'inquiryUrl'])

// 사실 대조 규칙(칸 이름은 항목 안 경로 — 'meta.client' 처럼). identity = 사실 글에 그대로 있어야 하는 이름·제목, dates = YYYY-MM-DD 가 사실의 날짜여야 하는 칸,
// years = 4자리 연도가 사실에 있어야 하는 칸, urls = 사실에 있는 주소(또는 이 사이트 쪽 경로), ids = 사실에 적힌 주소 조각(slug).
export const STRUCTURE_TRACE = {
  brand: {
    news: { identity: ['title'], dates: ['date'], urls: ['url'] },
    history: { identity: ['event'], years: ['year'] },
    leaders: { identity: ['name', 'title'] },
    reports: { identity: ['title'], years: ['year'], urls: ['pdfUrl'] },
    careersUrl: { urls: ['.'] },
  },
  public: {
    quickLinks: { identity: ['label'], urls: ['href'] },
    notices: { identity: ['title', 'category', 'department'], dates: ['date'], urls: ['url'] },
    subBody: { identity: ['.'] },
    hours: {},
    directions: { identity: ['transit', 'parking'] },
    mapLinks: { urls: ['naver', 'kakao'] },
  },
  portfolio: {
    works: { identity: ['title', 'client', 'disciplines'], years: ['year'], ids: ['slug'] },
    caseStudies: { identity: ['meta.client', 'meta.services'], years: ['meta.year'], ids: ['slug', 'next'] },
  },
  saas: { changelog: { identity: ['title'], dates: ['date'], urls: ['url'] }, testimonials: { identity: ['name', 'title', 'company', 'result'] }, integrations: { identity: ['name'], urls: ['url'] } },
  local: { departments: { identity: ['.'] }, doctors: { identity: ['name'] }, notices: { identity: ['text'], dates: ['date'] } },
  dashboard: { primaryActionHref: { urls: ['.'] }, table: {} },
  pwa: { homeItems: { identity: ['title', 'body'] }, detailBody: { identity: ['.'] }, resultBody: { identity: ['.'] } },
  detail: { faq: { identity: ['q', 'a', 'topic'] }, compare: { identity: ['usLabel', 'themLabel', 'rows.label', 'rows.us', 'rows.them'] }, slices: { identity: ['altText'] } },
}

// ── 렌더러가 읽는 콘텐츠 경로 ─────────────────────────────────────────────
const isContentPath = (s) => typeof s === 'string' && !/^(?:@|slot:|images:)/.test(s)
const fieldPath = (f) => String(f).replace(/:(?:text|date|year|money|days|pages)$/, '')

/** 원형 noBlock.render 하나가 읽는 콘텐츠 경로 → [{ root, rest }] (rest 는 뿌리 아래 경로, 배열 뿌리는 항목 안 경로 앞에 `[]`). */
export function renderReads(render) {
  if (!render) return []
  const out = []
  const sources = [...(render.from ?? []), ...(render.rows ?? []).flatMap((r) => r.from ?? []), ...(render.links ?? []).flatMap((l) => l.from ?? [])]
  for (const src of sources) {
    if (!isContentPath(src)) continue
    const [root, ...rest] = src.split('.')
    // 배열 뿌리의 항목 필드는 fields 가 정한다 — 여기서는 뿌리만
    out.push({ root, rest: rest.join('.') })
  }
  const arrayFrom = (render.from ?? []).find(isContentPath)
  if (arrayFrom && render.fields) {
    const [root, ...rest] = arrayFrom.split('.')
    if (rest.length === 0) {
      for (const spec of Object.values(render.fields)) for (const f of [spec].flat()) {
        if (typeof f === 'string' && f === '@case-link') { out.push({ root: 'caseStudies', rest: '0.slug' }); continue }
        if (isContentPath(f)) out.push({ root, rest: `[].${fieldPath(f)}` })
      }
    }
  }
  if (render.fields && Object.values(render.fields).includes('@case-link')) out.push({ root: 'caseStudies', rest: '0.slug' })
  return out
}

// ── 스키마 → 요청에 싣는 모양 ─────────────────────────────────────────────
const HREF_NOTE = '링크: https://·/경로·#앵커·tel:·mailto: 중 하나'
function leafShape(js, name) {
  if (js.enum) return `${js.enum.map((v) => JSON.stringify(v)).join(' | ')}`
  if (js.pattern && /\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(js.pattern)) return 'YYYY-MM-DD 날짜'
  if (js.pattern && /mailto/.test(js.pattern)) return `${HREF_NOTE}(사실이 없으면 「확인 필요」 — 검사가 이 칸의 형식 오류만 건너뛴다)`
  if (js.type === 'string' && URL_FIELDS.has(name)) return 'http(s) 절대 주소(사실이 없으면 「확인 필요」)'
  if (js.type === 'string') return js.minLength ? '글자(비지 않음)' : '글자'
  if (js.type === 'integer') return '정수'
  if (js.type === 'number') return '숫자'
  if (js.type === 'boolean') return 'true | false'
  return js.type ?? '값'
}
const isImageSlotJs = (js) => js?.type === 'object' && ['id', 'aspect', 'source', 'alt'].every((k) => js.properties?.[k])

function compact(js, name, path, ctx) {
  if (isImageSlotJs(js)) {
    const id = IMAGE_FIELD_SLOT[path]
    const def = id ? ctx.imageSlots?.[id] : null
    return { type: 'ImageSlot', ...(def ? { id, aspect: def.aspect ?? '비율을 직접 적는다(예: 4:3 — 원형이 정한 비율이 없다)', source: def.source } : {}), alt: '이 항목의 이름으로 쓴 설명(예: 「<이름> 사진」)', src: '적지 않는다(실제 파일이 없다 — 화면이 「실제 사진 필요」 틀을 그리고 05-media 가 공개 불가 사유로 남긴다)' }
  }
  if (js.type === 'array') {
    const desc = js.description ? `${js.description}` : undefined
    return { type: 'array', ...(js.minItems ? { min: js.minItems } : {}), ...(desc ? { about: desc } : {}), item: compact(js.items ?? {}, name, path, ctx) }
  }
  if (js.type === 'object') {
    const req = new Set(js.required ?? [])
    return Object.fromEntries(Object.entries(js.properties ?? {}).map(([k, v]) => [req.has(k) ? k : `${k}?`, compact(v, k, `${path}.${k}`, ctx)]))
  }
  const note = js.description ? ` — ${js.description}` : ''
  return `${leafShape(js, name)}${note}`
}

const IF_EMPTY = '브리프에 이 사실이 없다 — 칸을 적지 않는다(배열은 적지 않거나 []). 지어내지 않는다. 06 이 「자료 연결 안 됨」 blocker 를 남긴다'
export const STRUCTURE_RULE = '구조 칸(structureSlots[])은 브리프 사실로만 채운다 — 사실에 있는 항목마다 한 항목씩 옮기고(이름·제목·주소는 사실의 글자 그대로, 날짜는 YYYY-MM-DD), 사실에 없는 항목·숫자·날짜·주소는 더하지 않는다. empty 인 칸은 적지 않는다(지어내지 않는다 — 06 이 「자료 연결 안 됨」 blocker 를 남긴다)'

/**
 * 04 요청의 구조 칸 목록.
 * @param {{ archetype: object, sitemap: { pages: object[] }, facts: Record<string,string>, schema: { shape: Record<string, any>, imageSlots?: object } }} a
 */
export function structureSlots({ archetype, sitemap, facts, schema }) {
  const wantedByRoot = STRUCTURE_FACTS[archetype.id] ?? {}
  const roots = new Map() // root → { sections: Set, reads: Set, renderers: Set }
  for (const page of sitemap.pages) for (const s of page.sections) {
    if (s.status !== 'content' && s.status !== 'part') continue
    const spec = archetype.pages.find((p) => p.id === page.id)?.sections.find((x) => x.kind === s.kind)
    for (const { root, rest } of renderReads(spec?.noBlock?.render)) {
      const cur = roots.get(root) ?? { sections: new Set(), reads: new Set(), renderers: new Set() }
      cur.sections.add(`${page.id}/${s.kind}`)
      cur.renderers.add(spec.noBlock.render.as)
      if (rest) cur.reads.add(rest)
      roots.set(root, cur)
    }
  }
  // 블록 binder 가 읽는 구조 뿌리(QFIX [3]) — 읽는 섹션이 사이트맵에 있을 때만
  const inMap = new Set(sitemap.pages.flatMap((p) => p.sections.map((s) => `${p.id}/${s.kind}`)))
  for (const [root, secs] of Object.entries(BLOCK_STRUCTURE_ROOTS[archetype.id] ?? {})) {
    const here = secs.filter((k) => inMap.has(k))
    if (!here.length) continue
    const cur = roots.get(root) ?? { sections: new Set(), reads: new Set(), renderers: new Set() }
    for (const k of here) cur.sections.add(k)
    roots.set(root, cur)
  }
  const out = []
  for (const [root, info] of roots) {
    if (STRUCTURE_EXEMPT[`${archetype.id}.${root}`]) continue
    const wanted = wantedByRoot[root]
    if (!wanted) continue // 모르는 뿌리 — 테스트(「읽는 뿌리 전부 표 또는 면제」)가 잡는다
    const used = Object.keys(facts).filter((k) => wanted.some((w) => norm(w) === norm(k)))
    const field = schema?.shape?.[root]
    const js = field ? z.toJSONSchema(field, { io: 'input', unrepresentable: 'any' }) : null
    const ctx = { imageSlots: schema?.imageSlots }
    const required = field ? !field.safeParse(undefined).success : false
    out.push({
      path: root,
      sections: [...info.sections],
      renderers: [...info.renderers],
      factsWanted: wanted,
      factsUsed: used,
      empty: used.length === 0,
      schemaRequired: required,
      reads: [...info.reads],
      ...(js ? { shape: compact(js, root, `${archetype.id}.${root}`, ctx) } : {}),
      ...(used.length === 0 ? { ifEmpty: IF_EMPTY } : {}),
    })
  }
  return out
}

// ── 사실 대조 ────────────────────────────────────────────────────────────
const stripFmt = (s) => String(s).toLowerCase().replace(/[\s·,.;:!?'"“”‘’()（）[\]「」『』/|\-—–_~]/g, '')
const DATE_RES = [
  /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
  /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
]
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const pad = (n) => String(n).padStart(2, '0')
export function factDates(text) {
  const set = new Set()
  for (const re of DATE_RES) for (const m of String(text).matchAll(re)) set.add(`${m[1]}-${pad(m[2])}-${pad(m[3])}`)
  const en = new RegExp(`(${MONTHS.map((m) => m.slice(0, 3)).join('|')})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'gi')
  for (const m of String(text).matchAll(en)) set.add(`${m[3]}-${pad(MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase())) + 1)}-${pad(m[2])}`)
  const en2 = new RegExp(`(\\d{1,2})\\s+(${MONTHS.map((m) => m.slice(0, 3)).join('|')})[a-z]*\\.?,?\\s+(\\d{4})`, 'gi')
  for (const m of String(text).matchAll(en2)) set.add(`${m[3]}-${pad(MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase())) + 1)}-${pad(m[1])}`)
  return set
}
const numberTokens = (text) => new Set([...String(text).matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => m[0].replace(/,/g, '')))
const NUMBER_SKIP_KEYS = new Set(['id', 'aspect', 'source', 'slug', 'next', 'src', 'license', 'alt', 'density', 'width', 'height'])
const present = (v) => !(v === undefined || v === null || (typeof v === 'string' && (v.trim() === '' || isNeedsCheck(v))) || (Array.isArray(v) && v.length === 0))

// 경로 한 마디가 배열을 만나면 항목마다 이어서 내려간다(compare.rows.label — QFIX [3])
const leafAt = (item, path) => {
  if (path === '.') return [item]
  let cur = [item]
  for (const k of path.split('.')) cur = cur.flatMap((o) => (o == null ? [undefined] : Array.isArray(o) ? o.map((x) => x?.[k]) : [o[k]]))
  return cur.flat()
}

/**
 * 구조 칸 검사 — 문제 문자열[](「[규칙 id] 설명 — 위치」). 규칙: structure-invented(사실 없는 칸을 채움) · structure-missing(사실 있는 칸이 비었다) · structure-trace(항목이 사실에 없다).
 */
export function checkStructure(request, content) {
  const out = []
  const slots = request.structureSlots ?? []
  const text = Object.values(request.facts ?? {}).join('\n')
  const flat = stripFmt(text)
  const lower = text.toLowerCase()
  const dates = factDates(text)
  // 사실의 날짜는 연도만 숫자로 센다(2024-11-20 의 11·20 이 「20년」 같은 지어낸 숫자를 통과시키지 않게)
  const nums = numberTokens(DATE_RES.reduce((t, re) => t.replace(re, '$1'), text))
  const routes = new Set((request.siteRoutes ?? []).map((r) => r.replace(/\/+$/, '') || '/'))
  const spec = STRUCTURE_TRACE[request.archetype] ?? {}
  for (const s of slots) {
    const v = content?.[s.path]
    const has = present(v)
    if (s.empty) {
      if (has) out.push(`[structure-invented] 사실 「${s.factsWanted.join('·')}」 이 브리프에 없으니 ${s.path} 는 비워 둔다(06 이 「자료 연결 안 됨」을 남긴다) — ${s.path}`)
      continue
    }
    if (!has) { out.push(`[structure-missing] 사실 「${s.factsUsed.join('·')}」 이 있는데 ${s.path} 가 비었다 — 사실 항목마다 구조 칸에 옮긴다(${s.sections.join(' · ')} 가 이 칸을 그린다) — ${s.path}`); continue }
    const rules = spec[s.path] ?? {}
    const items = Array.isArray(v) ? v : [v]
    items.forEach((item, i) => {
      const where = Array.isArray(v) ? `${s.path}[${i}]` : s.path
      const bad = (msg, field) => out.push(`[structure-trace] ${msg} — ${where}${field && field !== '.' ? `.${field}` : ''}`)
      for (const f of rules.identity ?? []) for (const x of leafAt(item, f)) if (typeof x === 'string' && present(x) && !flat.includes(stripFmt(x))) bad(`이름·제목 "${x.slice(0, 30)}" 이 브리프 사실에 없다`, f)
      for (const f of rules.dates ?? []) for (const x of leafAt(item, f)) if (typeof x === 'string' && !dates.has(x)) bad(`날짜 ${x} 가 브리프 사실에 없다`, f)
      for (const f of rules.years ?? []) for (const x of leafAt(item, f)) if (x !== undefined && !new RegExp(`(?<!\\d)${String(x)}(?!\\d)`).test(text)) bad(`연도 ${x} 가 브리프 사실에 없다`, f)
      for (const f of rules.ids ?? []) for (const x of leafAt(item, f)) if (typeof x === 'string' && x && !lower.includes(x.toLowerCase())) bad(`주소 조각 "${x}" 가 브리프 사실에 없다`, f)
      for (const f of rules.urls ?? []) for (const x of leafAt(item, f)) {
        if (typeof x !== 'string' || !present(x)) continue
        if (x.startsWith('/')) { const r = x.split(/[#?]/)[0].replace(/\/+$/, '') || '/'; if (!routes.has(r) && !lower.includes(x.toLowerCase())) bad(`경로 ${x} 가 이 사이트의 쪽도 브리프 사실도 아니다`, f) }
        else if (!lower.includes(x.toLowerCase())) bad(`주소 ${x} 가 브리프 사실에 없다`, f)
      }
      // 나머지 글의 숫자(월 12건·30% 같은 지어낸 수치) — 사실 글에 있는 숫자만 쓴다. 날짜·연도·주소 조각 칸은 위에서 봤다.
      const walk = (x, key) => {
        if (typeof x === 'string') { if (!NUMBER_SKIP_KEYS.has(key) && !/^\d{4}-\d{2}-\d{2}$/.test(x) && !/^(?:https?:|mailto:|tel:|\/)/i.test(x)) for (const t of numberTokens(x)) if (!nums.has(t)) bad(`숫자 ${t} 가 브리프 사실에 없다("${x.slice(0, 24)}")`, key) }
        else if (typeof x === 'number') { if (!NUMBER_SKIP_KEYS.has(key) && !/^(?:year|date)$/.test(key) && !nums.has(String(x)) && !(rules.years ?? []).some((f) => f.endsWith(key))) bad(`숫자 ${x} 가 브리프 사실에 없다`, key) }
        else if (Array.isArray(x)) x.forEach((y) => walk(y, key))
        else if (isObj(x)) for (const [k, y] of Object.entries(x)) walk(y, k)
      }
      walk(item, '')
    })
  }
  return [...new Set(out)]
}

/** 구조 칸에서 사실이 비어 있어 스키마 오류를 건너뛸 경로 목록(뿌리 경로 배열들). */
export const emptyStructureHomes = (request) => (request.structureSlots ?? []).filter((s) => s.empty).map((s) => [s.path])
/** Href 형식을 쓰는 구조 칸의 오류 경로인가 — 값이 자리 표시면 사실이 없는 링크라 형식 오류를 건너뛴다. */
export function isPlaceholderHref(request, content, path) {
  const s = (request.structureSlots ?? []).find((x) => x.path === String(path[0]))
  if (!s || path.length < 2) return false
  const v = path.reduce((o, k) => (o == null ? undefined : o[k]), content)
  return typeof v === 'string' && isNeedsCheck(v) && (path.at(-1) === 'href' || path.at(-1) === 'url')
}
