// 콘텐츠 코어·원형 스키마·JSON-LD·AX 부품(Task 11). 실행: node --test --test-force-exit --test-timeout=60000 "factory/scripts/*.test.mjs"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { z } from 'zod'
import { buildItems, parseImports } from './gen-registry.mjs'
import { LAYERS } from './pincheck.mjs'
import { ARCHETYPE_PATH } from './archetypes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(root, 'registry', 'factory')
const OUT = join(root, '.tmp', 'content-test')
const REPO = 'nowwcastle-sudo/sitebrew'
const ARCH_DIR = ARCHETYPE_PATH
const lines = (s) => s.split(/\r?\n/)
const HANGUL = /[가-힣]/
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029)

// TS/TSX → .tmp/content-test/<경로>.mjs. @/registry/factory/… import 는 변환한 파일의 file:// 주소로 바꾼다(재귀).
const loaded = new Map()
function transpile(abs) {
  if (loaded.has(abs)) return loaded.get(abs)
  const rel = relative(FACTORY, abs).split('\\').join('/')
  const out = join(OUT, rel.replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  outputText = outputText.replace(/(from\s+|import\s+)(["'])@\/registry\/factory\/([^"']+)\2/g, (_, kw, q, p) => {
    const base = join(FACTORY, p)
    const src = ['.ts', '.tsx'].map((e) => base + e).find(existsSync)
    if (!src) throw new Error(`import 대상 없음: ${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const load = (p) => import(pathToFileURL(transpile(join(FACTORY, p))).href)

const core = await load('content/content-core.ts')
const ARCHES = readdirSync(ARCH_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
const schemas = Object.fromEntries(await Promise.all(ARCHES.map(async (id) => [id, await load(`content/schemas/${id}.ts`)])))
const SCHEMA = (id) => Object.values(schemas[id]).find((v) => v?.shape?.archetype)
const jsonld = await load('content/content-to-jsonld.ts')
const { JsonLd, serializeJsonLd } = await load('ax/json-ld.tsx')
const { agentFormAttrs } = await load('ax/agent-form-attrs.ts')
const seo = await load('ax/seo-files.ts')
const { SiteShell } = await load('ui/site-shell.tsx')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const h = React.createElement

// ── 예시 콘텐츠(가상 이름 + 「예시」) ─────────────────────────────────────────
const img = (id, aspect, source = 'real-required') => ({ id, aspect, source, alt: `${id} 자리(예시)` })
const BIZ = { name: '달빛베이커리(예시)', representative: '김예시', bizRegNo: '123-45-67890', mailOrderNo: '제2026-서울마포-0000호(예시)', address: '서울특별시 마포구 예시로 12, 1층', phone: '02-1234-5678', email: 'hello@example.com' }
const LOCAL = {
  archetype: 'local',
  business: { ...BIZ, subtype: 'Bakery', geo: { lat: 37.55512, lng: 126.92345 }, url: 'https://bakery.example.com' },
  hours: [
    { day: 'tu', opens: '10:00', closes: '20:00' },
    { day: 'we', opens: '10:00', closes: '20:00' },
    { day: 'sa', opens: '11:00', closes: '18:00', breaks: [{ start: '14:00', end: '15:00' }] },
  ],
  menu: [{ name: '우유식빵(예시)', price: 4800 }],
  servesCuisine: ['베이커리'],
  notices: [{ date: '2026-10-03', text: '10월 3일은 임시 휴무입니다(예시)' }],
  booking: { primary: { kind: 'tel', value: '02-1234-5678' }, secondary: [{ kind: 'kakao', value: 'https://pf.kakao.com/_Example' }] },
  mapLinks: { naver: 'https://map.naver.com/p/entry/place/0', kakao: 'https://place.map.kakao.com/0' },
  directions: { transit: '예시역 2번 출구에서 걸어서 3분', parking: '주차 불가' },
  slots: { copy: [{ id: 'tagline', role: '무엇을 파는 곳인지', text: '매일 아침 굽는 동네 식빵집(예시)' }], images: [img('hero', '16:9')] },
}
const EXAMPLES = {
  local: LOCAL,
  brand: {
    archetype: 'brand',
    organization: { ...BIZ, name: '한결소재(예시)', legalName: '주식회사 한결소재(예시)', url: 'https://hangyeol.example.com', sameAs: ['https://blog.example.com/hangyeol'] },
    tagline: '재생 섬유로 작업복을 만듭니다(예시)',
    news: [{ date: '2026-09-01', title: '새 공장 가동(예시)', url: 'https://hangyeol.example.com/news/1' }],
  },
  commerce: {
    archetype: 'commerce',
    business: { ...BIZ, ftcLookupUrl: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890', termsUrl: 'https://shop.example.com/terms', privacyUrl: 'https://shop.example.com/privacy', bankAccount: { bank: '예시은행', number: '000-000-000000', holder: '김예시' }, escrowProvider: '예시페이 에스크로' },
    products: [{ slug: 'milk-bread', name: '우유식빵(예시)', price: 4800, thumbs: [img('thumb', '1:1')] }],
    shipping: { fee: 3000, freeThreshold: 30000, courier: '예시택배', leadDays: 1 },
  },
  detail: {
    archetype: 'detail',
    product: { name: '린넨 앞치마(예시)', price: 29000, taxIncluded: true, shipping: { fee: 3000, courier: '예시택배', leadDays: 2 }, returns: { feePayer: 'buyer', withdrawalDays: 7 } },
    notice: { category: '의류', rows: [{ label: '제조국', value: '대한민국' }] },
    slices: [{ src: '/d/1.jpg', width: 860, height: 1100, altText: '앞치마 주머니 두 개(예시)' }],
  },
  dashboard: {
    archetype: 'dashboard',
    decision: { dashboard_type: 'operational', refresh: '15분' },
    kpis: [{ id: 'late', label: '지연 주문(예시)', value: 3, unit: '건', baseline: { target: 0 }, rank: 1 }],
  },
  portfolio: {
    archetype: 'portfolio',
    statement: '서울의 작은 브랜드를 짓는 스튜디오(예시)',
    works: [{ slug: 'cafe-identity', title: '카페 아이덴티티(예시)', client: '모래카페(예시)', year: 2026, thumb: img('work-thumb', '4:3') }],
    contact: { email: 'studio@example.com' },
  },
  public: {
    archetype: 'public',
    decision: { krds_scope: { agencyType: 'local-gov', level: 'standard', officialBanner: true, identifier: false } },
    agency: { name: '예시시청', address: '예시도 예시시 시청로 1', mainPhone: '031-123-4567', phoneNote: '평일 9~18시, 일반 통화료', privacyPolicyUrl: '/privacy', accessibilityPolicyUrl: '/a11y', copyright: '© 예시시' },
    quickLinks: [{ label: '민원 신청(예시)', href: '/minwon' }],
  },
  pwa: {
    archetype: 'pwa',
    manifest: { name: '물주기 알림(예시)', short_name: '물주기', description: '화분 물 주는 날을 알려 줍니다(예시)', icons: [{ src: '/i192.png', sizes: '192x192' }, { src: '/i512.png', sizes: '512x512', purpose: 'maskable' }], start_url: '/', theme_color: '#1f4d3a', background_color: '#ffffff' },
    offline: { fallbackUrl: '/offline' },
    strings: { offline: '인터넷 연결이 끊겼어요', serviceDown: '서비스를 점검하고 있어요', savedPending: '저장됨 · 연결되면 보냅니다', synced: '보냈어요', updateAvailable: '새 버전이 있어요 — 새로고침' },
  },
  landing: {
    archetype: 'landing',
    business: { name: '한결 북페어(예시)', representative: '이서윤', address: '서울특별시 성동구 왕십리로 45, 2층', phone: '02-1234-5678', email: 'hello@example.com' },
    oneLiner: '독립 출판사 신간을 먼저 만나는 이틀짜리 북페어(예시)',
    features: [{ title: '신간 먼저 보기', body: '출판사 40곳의 신간을 먼저 만나요(예시)' }],
    faq: [{ q: '사전 등록은 무료인가요?', a: '네, 무료예요(예시)' }],
    plans: [{ name: '사전 등록 입장권', price: 6000, currency: 'KRW', vatIncluded: true }],
    leadMagnet: { title: '참가 출판사 안내지(예시)', what: '출판사별 부스 위치와 신간 목록이에요', format: 'PDF 8쪽' },
  },
  saas: {
    archetype: 'saas',
    product: { name: '마감노트(예시)', url: 'https://note.example.com' },
    plans: [{ name: '기본', monthlyPrice: 9900, features: ['팀원 3명'] }, { name: '기업', monthlyPrice: null }],
  },
}
const clone = (o) => structuredClone(o)
const issues = (r) => r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)

// ① 스키마 ─────────────────────────────────────────────────────────────────
test('ARCHETYPE_IDS equals the 10 archetype JSON files; every archetype has a schema file exporting COPY_SLOTS/IMAGE_SLOTS and a <X>Content schema', () => {
  assert.deepEqual([...core.ARCHETYPE_IDS].sort(), ARCHES)
  assert.equal(ARCHES.length, 10)
  for (const id of ARCHES) {
    assert.ok(schemas[id].COPY_SLOTS && schemas[id].IMAGE_SLOTS, id)
    assert.ok(SCHEMA(id), `${id}: archetype 필드가 있는 스키마가 없다`)
  }
})

test('M5: slot tables are a generated region — gen-content-slots rebuilds exactly what is committed and refuses a file without markers', async () => {
  const g = await import('./gen-content-slots.mjs')
  for (const id of ARCHES) {
    const src = readFileSync(join(FACTORY, 'content', 'schemas', `${id}.ts`), 'utf8')
    const json = JSON.parse(readFileSync(join(ARCH_DIR, `${id}.json`), 'utf8'))
    assert.equal(g.applyRegion(src, g.slotBlock(json)), src, `${id}: 생성 구역이 원형 JSON 과 다르다 — npm run gen:all`)
    assert.equal(lines(src).filter((l) => l === g.BEGIN || l === g.END).length, 2, id)
  }
  assert.throws(() => g.applyRegion('export const X = 1', 'x'), /생성 구역/)
})

test('slot definitions match registry/factory/archetypes/<id>.json copySlots (id·maxChars·role) and imageSlots (id·aspect·source)', () => {
  for (const id of ARCHES) {
    const j = JSON.parse(readFileSync(join(ARCH_DIR, `${id}.json`), 'utf8'))
    const copy = {}, image = {}
    for (const p of j.pages) for (const s of p.sections) {
      for (const c of s.copySlots) { const e = (copy[c.id] ??= { roles: [], maxChars: c.maxChars }); if (!e.roles.includes(c.role)) e.roles.push(c.role); assert.equal(e.maxChars, c.maxChars, `${id}.${c.id}`) }
      for (const m of s.imageSlots) image[m.id] ??= { aspect: m.aspect, source: m.source }
    }
    assert.deepEqual(Object.keys(schemas[id].COPY_SLOTS).sort(), Object.keys(copy).sort(), `${id} copy ids`)
    for (const [k, v] of Object.entries(copy)) assert.deepEqual(schemas[id].COPY_SLOTS[k], { role: v.roles.join(' / '), maxChars: v.maxChars }, `${id}.${k}`)
    assert.deepEqual({ ...schemas[id].IMAGE_SLOTS }, image, `${id} image slots`)
  }
})

// 스키마 나무를 돌며 객체 필드마다 설명이 있는지 본다(중첩 객체·배열 원소·optional/default/nullable/union 안까지, M13).
function undescribed(schema, path, out) {
  const d = schema.def
  switch (d.type) {
    case 'object':
      for (const [k, f] of Object.entries(schema.shape)) {
        if (!f.description) out.push(`${path}.${k}`)
        undescribed(f, `${path}.${k}`, out)
      }
      break
    case 'array': undescribed(d.element, `${path}[]`, out); break
    case 'optional': case 'nullable': case 'default': case 'prefault': case 'readonly': case 'catch': undescribed(d.innerType, path, out); break
    case 'pipe': undescribed(d.in, path, out); break
    case 'union': d.options.forEach((o, i) => undescribed(o, `${path}|${i}`, out)); break
  }
  return out
}

test('every field of the core objects and of the 10 schemas — nested objects and array elements included — has .describe()', () => {
  const objs = { Business: core.Business, ImageSlot: core.ImageSlot, CopySlot: core.CopySlot, Cta: core.Cta, ContactChannel: core.ContactChannel, Faq: core.Faq, OpeningHours: core.OpeningHours }
  for (const id of ARCHES) objs[`${id}Content`] = SCHEMA(id)
  const missing = []
  for (const [name, s] of Object.entries(objs)) {
    assert.ok(s.description, `${name} 자체 설명`)
    undescribed(s, name, missing)
  }
  assert.deepEqual(missing, [])
  // 음성 대조: 설명 없는 중첩 필드를 찾아낸다
  assert.deepEqual(undescribed(z.object({ a: z.array(z.object({ b: z.string() }).describe('x')).describe('a') }), 'N', []), ['N.a[].b'])
})

test('① local example passes; without hours (or with empty hours) it fails with a Korean message', () => {
  const ok = core.safeParseContent(SCHEMA('local'), LOCAL)
  assert.ok(ok.success, ok.success ? '' : issues(ok).join('\n'))
  for (const hours of [undefined, []]) {
    const c = clone(LOCAL); if (hours) c.hours = hours; else delete c.hours
    const r = core.safeParseContent(SCHEMA('local'), c)
    assert.equal(r.success, false)
    const msg = r.error.issues.find((i) => i.path[0] === 'hours')
    assert.ok(msg, issues(r).join('\n'))
    if (hours) assert.match(msg.message, /영업시간/)
  }
})

test('all 10 example contents (fictional 「예시」 names) pass their schema', () => {
  for (const id of ARCHES) {
    const r = core.safeParseContent(SCHEMA(id), EXAMPLES[id])
    assert.ok(r.success, `${id}: ${r.success ? '' : issues(r).join('\n')}`)
  }
})

test('local medical variant (medical:true or subtype Dentist/MedicalClinic) rejects review slots — 의료법 제56조②2', () => {
  const withReviews = (patch) => Object.assign(clone(LOCAL), { externalReviews: [{ label: '네이버 플레이스 후기', url: 'https://m.place.naver.com/x' }] }, patch)
  // 비의료는 후기 링크를 둘 수 있다(양성 대조)
  assert.ok(core.safeParseContent(SCHEMA('local'), withReviews({})).success)
  const cases = [
    withReviews({ medical: true }),
    withReviews({ business: { ...LOCAL.business, subtype: 'Dentist' } }),
    Object.assign(clone(LOCAL), { business: { ...LOCAL.business, subtype: 'MedicalClinic' }, slots: { copy: [{ id: 'link', role: '외부 후기', text: '후기 보러 가기' }], images: [] } }),
    // 하위 유형이 의료기관이면 medical:false 로 끌 수 없다
    withReviews({ medical: false, business: { ...LOCAL.business, subtype: 'MedicalClinic' } }),
  ]
  for (const c of cases) {
    const r = core.safeParseContent(SCHEMA('local'), c)
    assert.equal(r.success, false)
    assert.ok(r.error.issues.some((i) => /의료법 제56조/.test(i.message)), issues(r).join('\n'))
  }
  // 의료 변형이어도 후기 칸이 없으면 통과(진료 정보로 채운다)
  const clinic = Object.assign(clone(LOCAL), { medical: true, business: { ...LOCAL.business, subtype: 'Dentist' }, departments: ['보존과(예시)'], doctors: [{ name: '이예시', gender: '여', license: '치과의사' }] })
  assert.ok(core.safeParseContent(SCHEMA('local'), clinic).success)
})

test('slots: unknown ids, over-long copy (maxChars from the archetype) and image source/aspect policy violations fail in Korean', () => {
  const bad = [
    [{ copy: [{ id: 'tagline', role: 'x', text: '가'.repeat(29) }], images: [] }, /28자 이하/],
    [{ copy: [{ id: 'nope', role: 'x', text: '예시' }], images: [] }, /없는 문구 칸/],
    [{ copy: [], images: [{ ...img('hero', '16:9'), source: 'generated-ok' }] }, /출처 정책은 real-required/],
    [{ copy: [], images: [img('hero', '4:3')] }, /비율은 16:9/],
  ]
  for (const [slots, re] of bad) {
    const r = core.safeParseContent(SCHEMA('local'), { ...clone(LOCAL), slots })
    assert.equal(r.success, false)
    assert.ok(r.error.issues.some((i) => re.test(i.message) && HANGUL.test(i.message)), issues(r).join('\n'))
  }
})

test('archetype legal/content rules: commerce escrow, dashboard KPI baseline, detail 7-day withdrawal, public KRDS footer links, pwa icons, brand ESG proof', () => {
  const fails = (id, mutate, re) => {
    const c = clone(EXAMPLES[id]); mutate(c)
    const r = core.safeParseContent(SCHEMA(id), c)
    assert.equal(r.success, false, `${id} 가 통과했다`)
    for (const i of r.error.issues) assert.match(i.message, HANGUL, `${id}: 한국어가 아닌 메시지 — ${i.message}`)
    assert.ok(r.error.issues.some((i) => re.test(i.message)), `${id}: ${issues(r).join('\n')}`)
  }
  fails('commerce', (c) => delete c.business.escrowProvider, /제13조②10/)
  fails('commerce', (c) => delete c.business.mailOrderNo, /통신판매업 신고번호/)
  fails('dashboard', (c) => (c.kpis[0].baseline = {}), /판단 기준/)
  fails('detail', (c) => (c.product.returns.withdrawalDays = 3), /7일/)
  fails('public', (c) => delete c.agency.accessibilityPolicyUrl, /./)
  fails('public', (c) => (c.agency.accessibilityPolicyUrl = ''), /웹 접근성 정책/)
  fails('public', (c) => (c.quickLinks = []), /자주 찾는 서비스/)
  fails('public', (c) => (c.decision.krds_scope.identifier = true), /운영기관 식별자/)
  fails('pwa', (c) => (c.manifest.icons = c.manifest.icons.slice(0, 1)), /512x512/)
  fails('brand', (c) => (c.slots = { copy: [{ id: 'claim', role: 'x', text: '탄소 배출을 줄였습니다' }], images: [] }), /보고서/)
  fails('local', (c) => (c.booking.primary = { kind: 'mail', value: 'a@example.com' }), /주 예약 채널/)
  fails('local', (c) => (c.business.geo.lat = 37.55), /소수점 5자리/)
  fails('local', (c) => (c.business.bizRegNo = '12345'), /사업자등록번호/)
})

test('I3: medical is inferred from departments/doctors/subtype; review-role slots (link·price) are blocked; medical:true rejects non-medical subtypes; JSON-LD maps to MedicalClinic', () => {
  const reviews = { externalReviews: [{ label: '후기', url: 'https://m.place.naver.com/x' }] }
  const probes = [
    { ...clone(LOCAL), ...reviews, business: { ...LOCAL.business, subtype: 'LocalBusiness' }, departments: ['내과'], doctors: [{ name: '이예시', gender: '여', license: '한의사' }] },
    { ...clone(LOCAL), medical: true, business: { ...LOCAL.business, subtype: 'LocalBusiness' }, slots: { copy: [{ id: 'price', role: 'x', text: '환자 후기: 통증이 싹 사라졌어요' }], images: [] } },
    { ...clone(LOCAL), medical: true },
  ]
  const res = probes.map((c) => core.safeParseContent(SCHEMA('local'), c))
  for (const r of res) assert.equal(r.success, false)
  assert.ok(res[0].error.issues.some((i) => /의료법 제56조/.test(i.message)))
  assert.ok(res[1].error.issues.some((i) => /price/.test(i.message) && /의료법 제56조/.test(i.message)))
  assert.ok(res[2].error.issues.some((i) => /Bakery 하위 유형/.test(i.message)))
  assert.ok(schemas.local.REVIEW_SLOT_IDS.includes('link') && schemas.local.REVIEW_SLOT_IDS.includes('price'))
  // 진료과목만 있는 한의원(플래그 없음)도 의료 변형 → JSON-LD 는 MedicalClinic
  const clinic = core.parseContent(SCHEMA('local'), { ...clone(LOCAL), business: { ...LOCAL.business, subtype: 'LocalBusiness' }, menu: [], departments: ['한방내과'] })
  assert.equal(schemas.local.isMedical(clinic), true)
  assert.equal(jsonld.toLocalBusiness(clinic)['@type'], 'MedicalClinic')
  assert.equal(core.safeParseContent(SCHEMA('local'), { ...clone(LOCAL), medical: false, departments: ['내과'] }).success, false)
})

test('I5: opening-hours breaks must sit inside the hours, run forwards and not overlap', () => {
  const day = (breaks, extra = {}) => core.safeParseContent(core.OpeningHours, [{ day: 'sa', opens: '10:00', closes: '20:00', breaks, ...extra }])
  const bad = [
    [[{ start: '15:00', end: '14:00' }], /끝이 시작보다/],
    [[{ start: '08:00', end: '09:00' }], /사이에/],
    [[{ start: '19:00', end: '21:00' }], /사이에/],
    [[{ start: '12:00', end: '14:00' }, { start: '13:00', end: '15:00' }], /겹칩니다/],
    [[{ start: '10:00', end: '11:00' }], /사이에/],
  ]
  for (const [breaks, re] of bad) {
    const r = day(breaks)
    assert.equal(r.success, false, JSON.stringify(breaks))
    assert.ok(r.error.issues.some((i) => re.test(i.message)), r.error.issues.map((i) => i.message).join(' / '))
  }
  assert.ok(day([{ start: '14:00', end: '15:00' }]).success)
})

test('I7·M1: overnight hours (explicit flag) validate, render 「익일」 and emit schema.org closes<opens; 24:00 renders 「24시」 and emits 23:59', () => {
  const r = core.safeParseContent(core.OpeningHours, [{ day: 'fr', opens: '18:00', closes: '02:00' }])
  assert.equal(r.success, false) // 플래그 없으면 오타로 본다
  assert.match(r.error.issues[0].message, /overnight/)
  const hours = core.parseContent(core.OpeningHours, [
    { day: 'fr', opens: '18:00', closes: '02:00', overnight: true, breaks: [{ start: '23:00', end: '00:30' }] },
    { day: 'sa', opens: '10:00', closes: '24:00' },
  ])
  assert.equal(core.formatOpeningHours(hours[0]), '금 18:00~익일 02:00 (쉬는 시간 23:00~익일 00:30)')
  assert.equal(core.formatOpeningHours(hours[1]), '토 10:00~24시')
  const spec = jsonld.toOpeningHoursSpecification(hours).map((x) => [x.dayOfWeek.join(','), x.opens, x.closes])
  assert.deepEqual(spec, [['Friday', '18:00', '23:00'], ['Saturday', '00:30', '02:00'], ['Saturday', '10:00', '23:59']])
  const plain = jsonld.toOpeningHoursSpecification(core.parseContent(core.OpeningHours, [{ day: 'fr', opens: '18:00', closes: '02:00', overnight: true }]))
  assert.deepEqual(plain.map((x) => [x.dayOfWeek[0], x.opens, x.closes]), [['Friday', '18:00', '02:00']])
  assert.equal(core.safeParseContent(core.OpeningHours, [{ day: 'fr', opens: '18:00', closes: '20:00', overnight: true }]).success, false)
})

test('I6: Phone accepts 15xx/16xx/18xx, parenthesised area codes and +82(0); public civilPhone also takes 3-digit codes', () => {
  for (const ok of ['1588-1234', '1577-0000', '1644-0000', '1899-1234', '(02) 1234-5678', '02)1234-5678', '+82-02-1234-5678', '010.1234.5678', '031-123-4567'])
    assert.ok(core.Phone.safeParse(ok).success, ok)
  for (const bad of ['120', '1234-5678', '+1-202-555-0100', '02-12', 'tel:021234567']) assert.equal(core.Phone.safeParse(bad).success, false, bad)
  const pub = clone(EXAMPLES.public); pub.agency.mainPhone = '1588-1234'; pub.agency.civilPhone = '120'
  assert.ok(core.safeParseContent(SCHEMA('public'), pub).success)
})

// FINAL-WF E3: 메일 앞부분의 ? & # % / = 를 막는다(mailto: 주소줄에서 숨은 수신자·머리글이 되는 길). 링크는 백슬래시 경로(`/\evil.com` — 브라우저는 `//` 로 읽는다)를 거절하고 mailto 는 `?` 앞 주소만 본다.
test('E3: mail addresses and Href reject smuggled recipients / backslash hosts (negative controls) while normal values still pass', async () => {
  const BAD_MAIL = ['a?bcc=x@y.z', 'a&b@example.com', 'a#b@example.com', 'a%40b@example.com', 'a/b@example.com', 'a=b@example.com', 'a@exa?mple.com', 'a@example.com/x']
  const OK_MAIL = ['hello@example.com', 'first.last+tag@sub.example.co.kr', "o'neil@example.org"]
  for (const v of BAD_MAIL) assert.equal(core.isMailAddress(v), false, v)
  for (const v of OK_MAIL) assert.equal(core.isMailAddress(v), true, v)
  const biz = (email) => core.Business.safeParse({ name: 'x', address: '서울', phone: '02-1234-5678', email })
  for (const v of BAD_MAIL) assert.equal(biz(v).success, false, `Business.email ${v}`)
  for (const v of OK_MAIL) assert.equal(biz(v).success, true, `Business.email ${v}`)
  for (const bad of ['mailto:a?bcc=x@y.z', 'mailto:a&b@example.com', 'mailto:@example.com', '/\\evil.com', '/\\\\evil.com', '/a\\b', '//evil.example', 'javascript:alert(1)']) assert.equal(core.Href.safeParse(bad).success, false, bad)
  for (const ok of ['mailto:hello@example.com', 'mailto:hello@example.com?subject=%EB%AC%B8%EC%9D%98', '/a/b?x=1#y', '/', '#top']) assert.equal(core.Href.safeParse(ok).success, true, ok)
  // 같은 식이 세 곳(content-core · 정적 어댑터 · 찍어내기 site-bind)에 있다 — 글자가 어긋나지 않게 맞춰 본다.
  const { MAIL_ADDRESS, resolveRefs } = await import('../stamp/site-bind.mjs')
  assert.equal(MAIL_ADDRESS.source, core.MAILTO_ADDRESS.source)
  const adapter = readFileSync(join(FACTORY, 'contract', 'adapter-static.ts'), 'utf8')
  assert.ok(adapter.includes(`const EMAIL = /${core.MAILTO_ADDRESS.source}/`), '정적 어댑터의 EMAIL 이 MAILTO_ADDRESS 와 다르다')
  assert.equal(resolveRefs({ $ref: 'contact.email', as: 'mailto' }, { contact: { email: 'a?bcc=x@y.z' } }), '#')
  assert.equal(resolveRefs({ $ref: 'contact.email', as: 'mailto' }, { contact: { email: 'hello@example.com' } }), 'mailto:hello@example.com')
})

test('M9·M12: link fields use Href (no //host, no javascript:); PWA icons accept any NxN, reject mixed "any maskable"', () => {
  assert.equal(core.Href.safeParse('//evil.example').success, false)
  assert.equal(core.Href.safeParse('javascript:alert(1)').success, false)
  for (const ok of ['/a', '#top', 'https://a.example.com/x', 'tel:021234567', 'mailto:a@example.com']) assert.ok(core.Href.safeParse(ok).success, ok)
  const pub = clone(EXAMPLES.public); pub.agency.privacyPolicyUrl = '//evil.example'
  assert.equal(core.safeParseContent(SCHEMA('public'), pub).success, false)
  const dash = clone(EXAMPLES.dashboard); dash.alerts = [{ id: 'a', severity: 'warning', recordUrl: 'javascript:x', actions: ['열기'] }]
  assert.equal(core.safeParseContent(SCHEMA('dashboard'), dash).success, false)
  const pwa = clone(EXAMPLES.pwa)
  pwa.manifest.icons.push({ src: '/i384.png', sizes: '384x384' })
  assert.ok(core.safeParseContent(SCHEMA('pwa'), pwa).success)
  pwa.manifest.icons[1].purpose = 'any maskable'
  assert.equal(core.safeParseContent(SCHEMA('pwa'), pwa).success, false)
})

test('M4: factory code never calls .parse/.safeParse directly on a *Content schema (Korean messages need parseContent/safeParseContent)', () => {
  const offenders = []
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(f) } else if (/\.(ts|tsx|mjs)$/.test(e.name) && !f.endsWith('content.test.mjs')) lines(readFileSync(f, 'utf8')).forEach((l, i) => { if (/\b[A-Z]\w*Content\s*\.\s*(safeParse|parse|parseAsync|safeParseAsync)\(/.test(l)) offenders.push(`${relative(root, f)}:${i + 1}`) }) } }
  for (const d of ['registry', 'app', join('factory', 'scripts'), join('factory', 'qa')]) walk(join(root, d))
  assert.deepEqual(offenders, [])
  // 양성 대조: 직접 부르면 영어, 감싸면 한국어
  assert.doesNotMatch(SCHEMA('local').safeParse({ archetype: 'local' }).error.issues[0].message, HANGUL)
  assert.match(core.safeParseContent(SCHEMA('local'), { archetype: 'local' }).error.issues[0].message, HANGUL)
})

test('M11: address parts go into PostalAddress; each branch gets its own LocalBusiness', () => {
  const c = core.parseContent(SCHEMA('local'), { ...clone(LOCAL), business: { ...LOCAL.business, addressRegion: '서울특별시', addressLocality: '마포구', postalCode: '04000' },
    branches: [{ name: '달빛베이커리 합정점(예시)', url: 'https://bakery.example.com/hapjeong', address: '서울특별시 마포구 예시로 34', todayHours: '10:00~20:00', telephone: '02-2222-3333', naverMapUrl: 'https://map.naver.com/p/1', kakaoMapUrl: 'https://place.map.kakao.com/1' }] })
  const ld = jsonld.toLocalBusiness(c)
  assert.deepEqual(ld.address, { '@type': 'PostalAddress', streetAddress: c.business.address, addressLocality: '마포구', addressRegion: '서울특별시', postalCode: '04000', addressCountry: 'KR' })
  const br = jsonld.toLocalBusinessBranches(c)
  assert.equal(br.length, 1)
  assert.deepEqual([br[0]['@type'], br[0].name, br[0].telephone, br[0].url], ['Bakery', '달빛베이커리 합정점(예시)', '+82-2-2222-3333', 'https://bakery.example.com/hapjeong'])
})

// ② JSON-LD ─────────────────────────────────────────────────────────────────
test('② toLocalBusiness: name·address·telephone·openingHoursSpecification come from the same object as the screen', () => {
  const c = core.parseContent(SCHEMA('local'), LOCAL)
  const ld = jsonld.toLocalBusiness(c)
  assert.equal(ld['@context'], 'https://schema.org')
  assert.equal(ld['@type'], 'Bakery')
  assert.equal(ld.name, c.business.name)
  assert.equal(ld.address.streetAddress, c.business.address)
  assert.equal(ld.telephone, '+82-2-1234-5678')
  assert.equal(ld.telephone.replace(/\D/g, '').replace(/^82/, '0'), c.business.phone.replace(/\D/g, ''))
  // 영업시간: 명세를 요일별로 되돌리면 입력(브레이크타임 포함)과 같다
  const DAY = { Monday: 'mo', Tuesday: 'tu', Wednesday: 'we', Thursday: 'th', Friday: 'fr', Saturday: 'sa', Sunday: 'su' }
  const back = {}
  for (const s of ld.openingHoursSpecification) for (const d of s.dayOfWeek) (back[DAY[d]] ??= []).push([s.opens, s.closes])
  for (const hrs of c.hours) {
    const segs = back[hrs.day].sort()
    const want = []; let from = hrs.opens
    for (const b of hrs.breaks ?? []) { want.push([from, b.start]); from = b.end }
    want.push([from, hrs.closes])
    assert.deepEqual(segs, want, hrs.day)
  }
  assert.deepEqual(Object.keys(back).sort(), c.hours.map((x) => x.day).sort())
  assert.deepEqual(ld.geo, { '@type': 'GeoCoordinates', latitude: 37.55512, longitude: 126.92345 })
  assert.equal(ld.hasMenu.hasMenuItem[0].offers.price, 4800)
  assert.deepEqual(ld.servesCuisine, ['베이커리'])
  // 의료기관 하위 유형엔 메뉴·후기·별점이 없다
  const clinic = jsonld.toLocalBusiness(core.parseContent(SCHEMA('local'), { ...clone(LOCAL), business: { ...LOCAL.business, subtype: 'Dentist' } }))
  assert.equal(clinic['@type'], 'Dentist')
  for (const k of ['hasMenu', 'review', 'aggregateRating']) assert.equal(clinic[k], undefined, k)
})

test('toIntlPhone: domestic → +82 without the trunk 0; already international kept', () => {
  assert.equal(jsonld.toIntlPhone('02-1234-5678'), '+82-2-1234-5678')
  assert.equal(jsonld.toIntlPhone('010 1234 5678'), '+82-10-1234-5678')
  assert.equal(jsonld.toIntlPhone('+82 (0)2 1234 5678'), '+82-2-1234-5678')
  assert.equal(jsonld.toIntlPhone('+82-02-1234-5678'), '+82-2-1234-5678') // I6: 국제 형식의 앞 0 을 뗀다
  assert.equal(jsonld.toIntlPhone('(02) 1234-5678'), '+82-2-1234-5678')
  assert.equal(jsonld.toIntlPhone('02)1234-5678'), '+82-2-1234-5678')
  assert.equal(jsonld.toIntlPhone('1588-1234'), '+82-1588-1234')
  assert.throws(() => jsonld.toIntlPhone('12'), (e) => HANGUL.test(e.message))
})

test('phone: one normalizer (lib/phone, final review M5) — content accepts a subset of telLink, and SiteShell tel: equals telLink href (+82 → E.164)', async () => {
  const phone = await load('lib/phone.ts')
  const stat = await load('contract/adapter-static.ts')
  assert.equal(core.phoneDigits, phone.phoneDigits)
  assert.equal(stat.normalizePhone, phone.normalizePhone)
  const samples = ['02-1234-5678', '(02) 1234-5678', '02)1234-5678', '010 1234 5678', '031.123.4567', '1588-1234', '1670-0000',
    '+82 (0)2 1234 5678', '+82-02-1234-5678', '+82 10-1234-5678', '+82-1588-1234',
    '120', '1234-5678', '+1-202-555-0100', '02-12', 'tel:021234567', '０２-1234-5678', '02‐1234‐5678', '']
  for (const v of samples) {
    const d = phone.phoneDigits(v)
    if (d === null) continue
    const n = phone.normalizePhone(v)
    assert.ok(n, `${v}: 콘텐츠가 받으면 telLink 도 받는다`)
    assert.equal(n.startsWith('+82') ? '0' + n.slice(3) : n, d, `${v}: 숫자는 앞 0 ↔ +82 만 다르다`)
    assert.equal(`tel:${n}`, stat.telLink(v).data.href, v)
  }
  // 콘텐츠 범위는 그대로(화면 값): 다른 나라·특수번호·전각·다른 대시는 받지 않는다. telLink 는 설정값이라 전각·대시·E.164 를 받는다.
  for (const bad of ['120', '1234-5678', '+1-202-555-0100', '02-12', 'tel:021234567', '０２-1234-5678', '02‐1234‐5678']) assert.equal(phone.phoneDigits(bad), null, bad)
  for (const ok of ['０２-1234-5678', '02‐1234‐5678', '+1-202-555-0100', '1234-5678']) assert.ok(phone.normalizePhone(ok), ok)
  // SiteShell 연락처 링크 = telLink: 국내로 적으면 국내 숫자, +82 로 적으면 E.164.
  const shellWith = (p) => shell({ business: { ...BIZ, phone: p } })
  assert.match(shellWith('02-1234-5678'), /<a href="tel:0212345678"/)
  assert.match(shellWith('+82-2-1234-5678'), /<a href="tel:\+82212345678"/)
  assert.equal(stat.telLink('+82-2-1234-5678').data.href, 'tel:+82212345678')
})

test('toOrganization · toProduct · toSoftwareApplication · toBreadcrumb', () => {
  const brand = core.parseContent(SCHEMA('brand'), EXAMPLES.brand)
  const org = jsonld.toOrganization(brand.organization)
  assert.deepEqual([org['@type'], org.name, org.legalName, org.url, org.sameAs], ['Organization', '한결소재(예시)', '주식회사 한결소재(예시)', 'https://hangyeol.example.com', ['https://blog.example.com/hangyeol']])
  const shop = core.parseContent(SCHEMA('commerce'), EXAMPLES.commerce)
  const p = jsonld.toProduct(shop.products[0])
  assert.deepEqual([p['@type'], p.name, p.offers.price, p.offers.priceCurrency], ['Product', '우유식빵(예시)', 4800, 'KRW'])
  const saas = core.parseContent(SCHEMA('saas'), EXAMPLES.saas)
  const app = jsonld.toSoftwareApplication(saas.product, saas.plans)
  assert.deepEqual(app.offers, [{ '@type': 'Offer', name: '기본', price: 9900, priceCurrency: 'KRW' }]) // 문의형(null)은 뺀다
  assert.equal(jsonld.toSoftwareApplication(saas.product, [{ name: '기업', monthlyPrice: null }]), null)
  const bc = jsonld.toBreadcrumb([{ label: '홈', href: '/' }, { label: '메뉴', href: '/menu' }], 'https://bakery.example.com')
  assert.deepEqual(bc.itemListElement.map((i) => [i.position, i.name, i.item]), [[1, '홈', 'https://bakery.example.com/'], [2, '메뉴', 'https://bakery.example.com/menu']])
  assert.throws(() => jsonld.toBreadcrumb([{ label: '메뉴', href: '/menu' }]), (e) => HANGUL.test(e.message))
  assert.equal(jsonld.toBreadcrumb([{ label: '홈', href: 'https://a.example.com/' }]).itemListElement[0].item, 'https://a.example.com/')
})

// ③ JsonLd ─────────────────────────────────────────────────────────────────
test('③ <JsonLd> escapes </script, <!--, U+2028/2029 and & — the script block cannot be closed and JSON.parse gives the input back', () => {
  const hostile = {
    '@type': 'Thing',
    name: `</script><script>alert(1)</script>`,
    a: '<!-- x -->', b: `줄${LS}나눔${PS}끝`, c: 'A & B', d: '</SCRIPT >', e: '<\/script>',
  }
  const html = renderToStaticMarkup(h(JsonLd, { data: hostile }))
  const m = html.match(/^<script type="application\/ld\+json">([\s\S]*)<\/script>$/)
  assert.ok(m, html)
  const body = m[1]
  assert.doesNotMatch(body, /<\/script/i)
  assert.doesNotMatch(body, /<!--/)
  assert.ok(!body.includes('<') && !body.includes('>') && !body.includes(LS) && !body.includes(PS), body)
  assert.deepEqual(JSON.parse(body), hostile)
  assert.equal((html.match(/<\/script>/gi) ?? []).length, 1)
  assert.equal(serializeJsonLd([hostile]).startsWith('['), true)
})

// ④ SiteShell ─────────────────────────────────────────────────────────────────
const shell = (props = {}, children = h('p', null, '본문(예시)')) =>
  renderToStaticMarkup(h(SiteShell, { archetype: 'local', logo: h('a', { href: '/' }, '달빛베이커리(예시)'), nav: [{ label: '메뉴', href: '/menu' }, { label: '오시는 길', href: '/#directions' }], pageTitle: '매일 아침 굽는 동네 식빵집(예시)', business: BIZ, ...props }, children))

test('④ SiteShell renders header·nav·main·footer once, a skip link to #main first, exactly one h1, and the Korean business disclosure', () => {
  const html = shell({ currentHref: '/menu' })
  for (const tag of ['header', 'nav', 'main', 'footer']) assert.equal((html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length, 1, tag)
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1)
  const first = html.match(/<a [^>]*>/)[0]
  assert.match(first, /href="#main"/)
  assert.match(html, /본문 바로가기/)
  assert.match(html, /<main id="main" tabindex="-1"/)
  assert.match(html, /<nav aria-label="주 메뉴"/)
  assert.match(html, /<a href="\/menu" aria-current="page"/)
  for (const label of ['상호', '대표자', '사업자등록번호', '통신판매업신고번호', '주소', '연락처']) assert.match(html, new RegExp(`<dt[^>]*>${label}</dt>`), label)
  assert.match(html, /<a href="tel:0212345678"/)
  assert.match(html, /김예시/)
})

test('public: KRDS header order skip → banner(region) → logo → utility → search → nav; pageTitle is required so exactly one h1 (I4·M2·M3)', async () => {
  const pub = await load('content/schemas/public.ts')
  const html = renderToStaticMarkup(h(SiteShell, {
    archetype: 'public', pageTitle: '예시시청 누리집', logo: h('a', { href: '/', id: 'logo' }, '예시시청'),
    banner: h('p', null, pub.OFFICIAL_BANNER_TEXT), utility: h('a', { href: '/font', id: 'util' }, '글자 크기'),
    search: h('a', { href: '/search', id: 'srch' }, '검색'), nav: [{ label: '민원', href: '/minwon' }],
  }))
  const at = (re) => html.search(re)
  const order = [/href="#main"/, /role="region" aria-label="공식 배너"/, /id="logo"/, /id="util"/, /id="srch"/, /<nav /].map(at)
  assert.ok(order.every((x) => x >= 0), JSON.stringify(order))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.ok(html.indexOf(pub.OFFICIAL_BANNER_TEXT) < html.indexOf('<header'), '공식 배너는 고정 헤더 밖')
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1)
})

test('footer disclosure renders the FTC lookup link next to 통신판매업신고번호 plus terms and privacy links (M10)', () => {
  const html = shell({ business: { ...BIZ, ftcLookupUrl: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890', termsUrl: '/terms', privacyUrl: '/privacy' } })
  assert.match(html, /통신판매업신고번호<\/dt><dd>[^<]*<!-- --> <a href="https:\/\/www\.ftc\.go\.kr[^"]*"[^>]*>사업자정보 확인<\/a>|통신판매업신고번호<\/dt><dd>[^<]* <a href="https:\/\/www\.ftc\.go\.kr[^"]*"[^>]*>사업자정보 확인<\/a>/)
  assert.match(html, /<a href="\/terms"[^>]*>이용약관<\/a>/)
  assert.match(html, /<strong[^>]*><a href="\/privacy"[^>]*>개인정보 처리방침<\/a><\/strong>/)
  assert.doesNotMatch(shell(), /사업자정보 확인|이용약관/)
})

test('SiteShell sets data-archetype on its root (T4r1-c4); dashboard activates the compiled sidebar pointer-fine 24px rule', () => {
  for (const a of ['local', 'dashboard']) assert.match(shell({ archetype: a }), new RegExp(`^<div data-slot="site-shell" data-archetype="${a}"`))
  const sidebar = readFileSync(join(FACTORY, 'ui', 'sidebar.tsx'), 'utf8')
  assert.match(sidebar, /in-data-\[archetype=dashboard\]:pointer-fine:/)
})

test('SiteShell sticky is on by default at every width and opt-out: data-sticky-nav follows the effective position; one scroll-padding for all widths; skip link above the header (I1·I2 · P3-2 D4)', () => {
  const on = shell(), off = shell({ sticky: false })
  const cls = (html, re) => html.match(re)[1].split(' ')
  assert.match(on, /<header data-slot="site-shell-header" data-sticky-nav=""/)
  assert.doesNotMatch(off, /data-sticky-nav/)
  assert.ok(cls(off, /<header[^>]*class="([^"]*)"/).includes('static!'))
  assert.ok(cls(off, /data-slot="site-shell-header-inner" class="([^"]*)"/).includes('static!'))
  // D4: 375px 에서도 스티키 — 위치 변수에 md: 조건이 없다(값 훅이 md: 에서만 바꾼다)
  const hdr = cls(on, /<header[^>]*class="([^"]*)"/)
  assert.ok(hdr.includes('[position:var(--site-shell-position,sticky)]') && hdr.includes('top-0'), hdr.join(' '))
  assert.ok(!hdr.some((t) => t.startsWith('md:[position') || t === 'md:top-0'), 'D4: md: 조건 위치가 남았다')
  const base = readFileSync(join(FACTORY, 'base', 'factory-base.css'), 'utf8')
  assert.match(base, /html:has\(\[data-sticky-nav\]\)\s*\{\s*scroll-padding-top:\s*5rem/)
  assert.doesNotMatch(base, /data-sticky-nav="md"/, 'D4: 좁은 화면 여백 0 규칙이 남았다')
  assert.match(on.match(/<a href="#main"[^>]*class="([^"]*)"/)[1], /z-50/)
  assert.match(on.match(/<header[^>]*class="([^"]*)"/)[1], /z-40/)
  // 모든 폭에서 한 줄 고정 높이, 메뉴는 가로 스크롤, 포커스 링은 안쪽(잘리지 않게) — 헤더 높이가 내용과 상관없이 정해져 scroll-padding 과 맞는다
  const inner = cls(on, /data-slot="site-shell-header-inner" class="([^"]*)"/)
  assert.ok(inner.includes('flex-nowrap') && !inner.includes('flex-wrap'), inner.join(' '))
  const ul = cls(on, /<ul data-slot="site-shell-nav-list" class="([^"]*)"/)
  // T11-N1: SiteShell 은 서버 컴포넌트, 포커스 → scrollIntoView 는 클라이언트 조각(site-shell-nav)만.
  assert.doesNotMatch(readFileSync(join(FACTORY, 'ui-src', 'site-shell.tsx'), 'utf8'), /^"use client"/m)
  assert.match(readFileSync(join(FACTORY, 'ui-src', 'site-shell-nav.tsx'), 'utf8'), /^"use client"[\s\S]*scrollIntoView/)
  for (const t of ['flex-nowrap', 'overflow-x-auto', '[scrollbar-width:none]']) assert.ok(ul.includes(t), `ul ${t}`)
  assert.ok(!ul.includes('flex-wrap'))
  assert.match(on.match(/<a href="\/menu"[^>]*class="([^"]*)"/)[1], /focus-visible:-outline-offset-2/)
})

test('SiteShell pageTitle (P3-2 D1): false draws no h1 (a hero block owns it), a node draws exactly one whose shape is only the heading hook; width caps main by a variable', () => {
  assert.equal((shell({ pageTitle: false }).match(/<h1[\s>]/g) ?? []).length, 0)
  const on = shell()
  assert.equal((on.match(/<h1[\s>]/g) ?? []).length, 1)
  // 원천의 h1 클래스는 훅 하나뿐 — text-3xl·px-4 같은 고정 모양은 훅 값(base.css·축 값)에만 있다
  const src = readFileSync(join(FACTORY, 'ui-src', 'site-shell.tsx'), 'utf8')
  assert.deepEqual(src.match(/<h1 className="([^"]*)"/)[1].split(' '), ['cn-site-shell-heading'])
  // 폭: main 이 max-w-(--site-shell-width) 이고, 값은 data-width 에 따라 부품 규칙이 정한다(기본 content 1200px)
  const main = (html) => html.match(/<main ([^>]*)>/)[1]
  assert.match(main(on), /data-width="content"/)
  const cls = main(on).match(/class="([^"]*)"/)[1].split(' ')
  for (const t of ['max-w-(--site-shell-width)', 'mx-auto', '[--site-shell-width:75rem]', 'data-[width=wide]:[--site-shell-width:90rem]', 'data-[width=full]:[--site-shell-width:none]']) assert.ok(cls.includes(t), t)
  for (const w of ['wide', 'full']) assert.match(main(shell({ width: w })), new RegExp(`data-width="${w}"`))
})

test('SiteShell pageTitle never draws an empty h1 (P3-2 Task 1c, review M-12): undefined·null·true·blank string·empty list draw none; the type excludes null·undefined·boolean', () => {
  const warn = console.warn
  const warned = []
  console.warn = (m) => warned.push(String(m))
  try {
    for (const v of [undefined, null, true, '', '   ', []]) assert.equal((shell({ pageTitle: v }).match(/<h1[\s>]/g) ?? []).length, 0, JSON.stringify(v))
    assert.equal(warned.length, 6, '개발에서는 빈 제목마다 경고 한 줄')
    assert.equal((shell({ pageTitle: false }).match(/<h1[\s>]/g) ?? []).length, 0)
    assert.equal(warned.length, 6, 'false 는 경고하지 않는다(의도한 끄기)')
    // 양성 대조: 글자·요소는 h1 하나
    assert.equal((shell({ pageTitle: '제목(예시)' }).match(/<h1[\s>]/g) ?? []).length, 1)
    assert.equal((shell({ pageTitle: h('span', null, '제목(예시)') }).match(/<h1[\s>]/g) ?? []).length, 1)
  } finally { console.warn = warn }
  const src = readFileSync(join(FACTORY, 'ui-src', 'site-shell.tsx'), 'utf8')
  assert.match(src, /type PageTitle = Exclude<React\.ReactNode, null \| undefined \| boolean> \| false/)
  assert.match(src, /pageTitle: PageTitle\n/)
})

// 헤더 축 값(H1~H4)과 base 가 셸 헤더 계열 훅을 모두 쓰고, 768px 이상에서 헤더(또는 섬)를 sticky/fixed 로 두며 바닥이 72px 이하(scroll-padding 5rem − 8px).
test('every header value (and base) writes every site-shell header-family hook; part default + value hook keep the header (or island) sticky/fixed at md with its bottom ≤ 72px, and the outer header sticky one-line below md (I1·I2 · D4)', async () => {
  const { FAMILIES, listValues, styleMapOf, BASE_CSS } = await import('./axes.mjs')
  const baseMap = styleMapOf(BASE_CSS)
  const shellHeaderHooks = Object.keys(baseMap).filter((k) => k.startsWith('cn-site-shell-') && FAMILIES.find(([a]) => a === 'header')[1].some((r) => r.test(k)))
  assert.deepEqual(shellHeaderHooks.sort(), ['cn-site-shell-header', 'cn-site-shell-header-inner', 'cn-site-shell-nav-link', 'cn-site-shell-nav-list'])
  // 부품의 기본 토큰(훅 앞) — 훅이 뒤에서 덮는다(cn = tailwind-merge, 뒤가 이긴다)
  const src = readFileSync(join(FACTORY, 'ui-src', 'site-shell.tsx'), 'utf8')
  const partOf = (hook) => { const m = src.match(new RegExp('"' + hook + ' ([^"]*)"')); assert.ok(m, hook); return m[1].split(/\s+/) }
  const PART = { header: partOf('cn-site-shell-header'), inner: partOf('cn-site-shell-header-inner') }
  // 음수 top(H5 마스트헤드 — 제호가 스크롤로 올라가고 레일만 붙는다, Task 16a): md:-top-18 = -72px
  const px = (t) => { const neg = /^md:-/.test(t) ? -1 : 1; const u = t.replace(/^md:-/, 'md:'); let m = u.match(/^md:(?:h|top)-(\d+(?:\.\d+)?)$/); if (m) return neg * Number(m[1]) * 4; m = u.match(/^md:(?:h|top)-\[(\d+(?:\.\d+)?)rem\]$/); return m ? neg * Number(m[1]) * 16 : null }
  const lastOf = (tokens, re) => tokens.filter((t) => re.test(t)).at(-1)
  const values = [['base', baseMap], ...listValues().filter((v) => v.axis === 'header').map((v) => [v.id, styleMapOf(v.file)])]
  assert.equal(values.length, 6)
  for (const [id, map] of values) {
    for (const hook of shellHeaderHooks) assert.ok(map[hook], id + ': ' + hook + ' 가 없다')
    const hdr = [...PART.header, ...map['cn-site-shell-header'].split(/\s+/)]
    const inn = [...PART.inner, ...map['cn-site-shell-header-inner'].split(/\s+/)]
    // 위치는 부품의 md:[position:var(--변수,기본값)] 과 값 훅의 md:[--변수:값] 으로 정해진다
    const varPos = (tokens, name, fallback) => { const t = tokens.filter((x) => x.startsWith('md:[--' + name + ':')).at(-1); return t ? t.slice(('md:[--' + name + ':').length, -1) : fallback }
    assert.ok(PART.header.includes('[position:var(--site-shell-position,sticky)]') && PART.inner.includes('md:[position:var(--site-shell-inner-position,static)]'))
    // D4(P3-2): 768px 미만에서도 바깥 헤더가 스티키 — 값 훅은 위치 변수를 md: 에서만 바꾸고, 좁은 폭 한 줄 높이(min-h, 줄바꿈 없음)가 72px 이하
    assert.ok(!hdr.some((t) => t.startsWith('[--site-shell-position:')), id + ': 768px 미만 위치 변수를 바꾼다(D4)')
    const narrowH = lastOf(inn, /^min-h-\d+$/)
    assert.ok(narrowH && Number(narrowH.slice(6)) * 4 <= 72 && !inn.some((t) => /^(flex-wrap|h-\d)/.test(t)), id + ': 좁은 폭 헤더 높이가 정해지지 않았다 ' + narrowH)
    const positioned = varPos(inn, 'site-shell-inner-position', 'static') === 'fixed' ? inn : varPos(hdr, 'site-shell-position', 'sticky') === 'sticky' ? hdr : null
    assert.ok(positioned, id + ': 768px 이상에서 헤더도 섬도 sticky/fixed 가 아니다 — data-sticky-nav 와 어긋난다')
    const top = px(lastOf(positioned, /^md:-?top-/) ?? 'md:top-0')
    // 높이: 고정된 요소에 md:h-* 가 없으면 안쪽 줄의 높이(바깥 헤더는 안쪽 줄을 감싼다)
    const hgt = px(lastOf(positioned, /^md:h-(\d|\[)/) ?? lastOf(inn, /^md:h-(\d|\[)/) ?? '')
    assert.ok(hgt, id + ': 768px 이상 높이(md:h-*)가 고정돼 있지 않다')
    assert.ok(top + hgt <= 72, id + ': 헤더 바닥 ' + (top + hgt) + 'px > 72px')
    // 좁은 화면용 min-h 가 768px 이상 높이를 밀어 올리지 않는다(H2 섬 56px 실측 버그)
    const minH = lastOf(positioned, /^min-h-\d+$/)
    if (minH && !positioned.includes('md:min-h-0')) assert.ok(Number(minH.slice(6)) * 4 <= hgt, id + ': ' + minH + ' 이 md 높이 ' + hgt + 'px 보다 크다')
  }
  // 컴파일러는 훅 토큰을 부품 토큰 앞에 넣고 cn(tailwind-merge)은 뒤를 살린다 — 값 훅의 토큰이 부품 토큰에 지워지면 축이 조용히 무력해진다.
  const { twMerge } = await import('cn')
  const PART_ALL = { 'cn-site-shell-header': PART.header, 'cn-site-shell-header-inner': PART.inner, 'cn-site-shell-nav-list': partOf('cn-site-shell-nav-list'), 'cn-site-shell-nav-link': partOf('cn-site-shell-nav-link') }
  for (const [id, m] of values) for (const [hook, part] of Object.entries(PART_ALL)) {
    const hookTokens = m[hook].split(/\s+/)
    const kept = new Set(twMerge([...hookTokens, ...part].join(' ')).split(' '))
    assert.deepEqual(hookTokens.filter((t) => !kept.has(t)), [], `${id} ${hook}: 부품 토큰에 지워지는 훅 토큰`)
  }
  // 현재 위치 표시: 부품 기본(밑줄) + 값 훅이 덮는다 — H3 는 2px 밑줄, H2 는 알약 배경(밑줄 없음)
  const map = Object.fromEntries(values)
  assert.match(map.H3['cn-site-shell-nav-link'], /decoration-2/)
  assert.match(map.H2['cn-site-shell-nav-link'], /aria-\[current=page\]:bg-muted/)
  assert.ok(map.H2['cn-site-shell-nav-link'].split(/\s+/).includes('[--site-shell-current-line:none]'))
})

test('site-shell shape lives on cn-* hooks: the ui-src source has no shape class outside hooks, and the header bar hook is in the header axis family', async () => {
  const { shapeOutsideHooks } = await import('./hooks-audit.mjs')
  const src = readFileSync(join(FACTORY, 'ui-src', 'site-shell.tsx'), 'utf8')
  assert.deepEqual(shapeOutsideHooks(src), [])
  const { axisOfHook } = await import('./axes.mjs')
  assert.equal(axisOfHook('cn-site-shell-header'), 'header')
  assert.equal(axisOfHook('cn-site-shell-nav-link'), 'header')
  assert.equal(axisOfHook('cn-site-shell-footer'), 'radius')
})

// ⑤ agent-form-attrs ─────────────────────────────────────────────────────────
test('agentFormAttrs → exactly { toolname, tooldescription }, never an auto-submit attribute; bad names throw in Korean', () => {
  assert.deepEqual(agentFormAttrs({ toolName: 'request-booking', description: '  예약을 요청합니다.\n사람이 확인해 보냅니다. ' }), { toolname: 'request-booking', tooldescription: '예약을 요청합니다. 사람이 확인해 보냅니다.' })
  assert.deepEqual(Object.keys(agentFormAttrs({ toolName: 'ask', description: '문의', autoSubmit: false })), ['toolname', 'tooldescription'])
  for (const bad of [{ toolName: 'Request Booking', description: 'x' }, { toolName: 'ok', description: '  ' }])
    assert.throws(() => agentFormAttrs(bad), (e) => HANGUL.test(e.message))
  const html = renderToStaticMarkup(h('form', agentFormAttrs({ toolName: 'request-booking', description: '예약 요청' })))
  assert.equal(html, '<form toolname="request-booking" tooldescription="예약 요청"></form>')
})

// ⑥ seo-files ─────────────────────────────────────────────────────────────────
const SITE = { siteUrl: 'https://bakery.example.com', name: '달빛베이커리(예시)', summary: '마포구 예시로의 동네 식빵집입니다(예시).', pages: [{ url: '/', title: '홈' }, { url: '/menu?a=1&b=2', title: '메뉴', description: '식빵 가격표', lastModified: '2026-09-26', section: '가게' }] }

test('⑤ robots allows Yeti (Naver) and Daum by name, splits AI bots by kind, takes daumPin, and links the sitemap', () => {
  const { robots } = seo.seoFiles(SITE, { daumPin: 'abc123:def456', disallow: ['/admin'] })
  const ls = lines(robots)
  assert.equal(ls[0], '#DaumWebMasterTool:abc123:def456')
  for (const bot of ['Yeti', 'Daum']) {
    const i = ls.indexOf(`User-agent: ${bot}`)
    assert.ok(i > 0, bot)
    let j = i + 1; while (ls[j].startsWith('User-agent:')) j++
    assert.deepEqual(ls.slice(j, j + 2), ['Allow: /', 'Disallow: /admin'], bot)
  }
  const blockOf = (bot) => { const i = ls.indexOf(`User-agent: ${bot}`); let j = i; while (ls[j].startsWith('User-agent:')) j++; return ls[j] }
  for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended']) assert.equal(blockOf(bot), 'Allow: /', bot) // 학습용도 기본 허용(I8)
  assert.ok(ls.includes('User-agent: Daumoa'))
  assert.equal(blockOf('Claude-SearchBot'), 'Allow: /')
  assert.equal(blockOf('ChatGPT-User'), 'Allow: /')
  assert.ok(ls.includes('Sitemap: https://bakery.example.com/sitemap.xml'))
  const shut = lines(seo.seoFiles(SITE, { ai: { training: false } }).robots)
  assert.equal(shut[shut.indexOf('User-agent: Google-Extended') + 1], 'Disallow: /') // 명시적으로 끌 수 있다
  assert.equal(shut[shut.indexOf('User-agent: Claude-SearchBot') + 1], 'Allow: /')
  assert.throws(() => seo.seoFiles(SITE, { daumPin: 'x\nUser-agent: *' }), (e) => HANGUL.test(e.message))
  assert.doesNotMatch(seo.seoFiles(SITE).robots, /DaumWebMasterTool/)
})

test('sitemap(urls): absolute, XML-escaped, deduplicated; defaults to the input pages', () => {
  const { sitemap } = seo.seoFiles(SITE)
  const x = sitemap()
  assert.match(x, /<loc>https:\/\/bakery\.example\.com\/menu\?a=1&amp;b=2<\/loc><lastmod>2026-09-26<\/lastmod>/)
  assert.equal((x.match(/<url>/g) ?? []).length, 2)
  assert.equal((sitemap([{ url: '/', title: 'a' }, { url: 'https://bakery.example.com/', title: 'b' }]).match(/<url>/g) ?? []).length, 1)
  assert.throws(() => sitemap([{ url: 'javascript:alert(1)', title: 'x' }]), (e) => HANGUL.test(e.message))
  assert.throws(() => sitemap([{ url: '/a', title: 'a', lastModified: '2026-13-45' }]), (e) => /실제 날짜/.test(e.message))
  assert.throws(() => sitemap([{ url: '/a', title: 'a', lastModified: '2026-02-30' }]), (e) => /실제 날짜/.test(e.message))
  assert.throws(() => sitemap([{ url: 'https://other.example.com/p', title: 'x' }]), (e) => /같은 사이트/.test(e.message))
})

test('llms.txt: H1 + summary quote + H2 link lists; stays ≤ 100KB with whole lines, deterministic, remainder pointed to the sitemap', () => {
  const small = seo.seoFiles(SITE, { llms: true }).llmsTxt
  const sl = lines(small)
  assert.equal(sl[0], '# 달빛베이커리(예시)')
  assert.equal(sl[2], '> 마포구 예시로의 동네 식빵집입니다(예시).')
  assert.ok(sl.includes('## 가게') && sl.includes('- [메뉴](https://bakery.example.com/menu?a=1&b=2): 식빵 가격표'))
  assert.doesNotMatch(small, /나머지/)
  // M7: 목적지의 괄호·공백은 인코딩 — 링크가 일찍 끝나지 않는다
  const paren = seo.seoFiles({ ...SITE, pages: [{ url: '/a)b (c)', title: '괄호' }] }, { llms: true }).llmsTxt
  assert.ok(lines(paren).includes('- [괄호](https://bakery.example.com/a%29b%20%28c%29)'), paren)
  const pages = Array.from({ length: 4000 }, (_, i) => ({ url: `/p/${i}`, title: `예시 페이지 ${i}`, description: '가'.repeat(80), section: i % 2 ? '홀수' : '짝수' }))
  const big = { ...SITE, pages }
  const a = seo.seoFiles(big, { llms: true }).llmsTxt, b = seo.seoFiles(big, { llms: true }).llmsTxt
  const size = new TextEncoder().encode(a).length
  assert.ok(size <= seo.LLMS_MAX_BYTES && seo.LLMS_MAX_BYTES === 102400, `${size}`)
  assert.ok(size > 90 * 1024, `너무 많이 잘랐다: ${size}`)
  assert.equal(a, b)
  const links = lines(a).filter((l) => l.startsWith('- ['))
  for (const l of links) assert.match(l, /^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/)
  const listed = links.filter((l) => l.includes('/p/')).length
  assert.match(a, new RegExp(`나머지 ${4000 - listed}개 페이지는 사이트맵에 있습니다\\n$`))
  // CRLF 로 저장돼도 같은 줄 수로 읽힌다
  assert.equal(lines(a.replace(/\n/g, '\r\n')).length, lines(a).length)
})

// ⑦ 레지스트리 ─────────────────────────────────────────────────────────────────
test('registry: content (core · 10 schemas · to-jsonld) and ax (json-ld · agent-form-attrs · seo-files) items, pinned, in pincheck and the root include', () => {
  assert.ok(LAYERS.includes('content') && LAYERS.includes('ax'))
  const rootReg = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
  for (const l of ['content', 'ax']) assert.ok(rootReg.include.includes(`registry/factory/${l}/registry.json`), l)
  const content = buildItems(join(FACTORY, 'content'), 'content', REPO, join(FACTORY, 'content'), 'v9.9.9', { zod: '^4.6.5' })
  assert.deepEqual(content.map((i) => i.name), ['content-brand', 'content-commerce', 'content-core', 'content-dashboard', 'content-detail', 'content-landing', 'content-local', 'content-portfolio', 'content-public', 'content-pwa', 'content-saas', 'content-to-jsonld'])
  const by = Object.fromEntries(content.map((i) => [i.name, i]))
  assert.deepEqual(by['content-local'].files, [{ path: 'schemas/local.ts', type: 'registry:lib', target: '@components/content/schemas/local.ts' }])
  assert.deepEqual(by['content-local'].registryDependencies, [`${REPO}/content-core#v9.9.9`])
  assert.deepEqual(by['content-core'].dependencies, ['zod@^4.6.5'])
  assert.deepEqual(by['content-to-jsonld'].registryDependencies, [`${REPO}/content-core#v9.9.9`, `${REPO}/content-local#v9.9.9`])
  const ax = Object.fromEntries(buildItems(join(FACTORY, 'ax'), 'ax', REPO, join(FACTORY, 'ax'), 'v9.9.9').map((i) => [i.name, i]))
  assert.deepEqual(Object.keys(ax).sort(), ['agent-form-attrs', 'brand-color', 'favicon-kit', 'freshness', 'geo-entity', 'json-ld', 'og-image', 'seo-files', 'seo-meta'])
  assert.equal(ax['json-ld'].type, 'registry:component')
  assert.equal(ax['json-ld'].files[0].target, '@components/ax/json-ld.tsx')
  assert.deepEqual(ax['json-ld'].registryDependencies, [])
  assert.deepEqual(ax['agent-form-attrs'].registryDependencies, [`${REPO}/block-contract#v9.9.9`])
  assert.deepEqual(parseImports('import { X } from "@/registry/factory/content/schemas/local"').internal, ['content-local'])
  // 커밋된 생성물과 site-shell(ui 층) 항목
  const ui = JSON.parse(readFileSync(join(FACTORY, 'ui', 'registry.json'), 'utf8')).items.find((i) => i.name === 'site-shell')
  assert.ok(ui.registryDependencies.some((d) => /\/content-core#v\d+\.\d+\.\d+$/.test(d)))
  for (const l of ['content', 'ax']) {
    const reg = JSON.parse(readFileSync(join(FACTORY, l, 'registry.json'), 'utf8'))
    for (const it of reg.items) for (const d of it.registryDependencies) assert.match(d, /#v\d+\.\d+\.\d+$/)
  }
})

test('JSDoc consumer notes sit on exports (shadcn strips the file head comment): content-to-jsonld, seo-files, json-ld, site-shell', () => {
  for (const [p, fn] of [['content/content-to-jsonld.ts', 'toLocalBusiness'], ['ax/seo-files.ts', 'seoFiles'], ['ax/json-ld.tsx', 'JsonLd'], ['ui-src/site-shell.tsx', 'SiteShell'], ['ax/agent-form-attrs.ts', 'agentFormAttrs']]) {
    const src = lines(readFileSync(join(FACTORY, p), 'utf8'))
    const i = src.findIndex((l) => new RegExp(`^(export )?function ${fn}\\b`).test(l))
    assert.ok(i > 0, `${p}: ${fn}`)
    assert.match(src[i - 1], /\*\/\s*$/, `${p}: ${fn} 바로 위에 JSDoc 이 없다`)
    assert.ok(/^import |^\/\/ |^"use client"$/.test(src[0]) || /^export const/.test(src[0]), `${p}: 파일 첫 줄이 JSDoc 이면 설치 때 지워진다`)
  }
})

// Task 13a 항목 3(M3): useToastManager().add 로 직접 부른 행동 토스트도 timeout 이 없으면 10초다.
test('toast: an action toast without a timeout gets 10000ms from the manager and from useToastManager; given timeouts and plain toasts stay (M3)', async () => {
  const { withActionTimeout, createToastManager } = await load('ui/toast.tsx')
  assert.equal(withActionTimeout({ title: '예시', actionProps: { children: '되돌리기' } }).timeout, 10000)
  assert.equal(withActionTimeout({ title: '예시', actionProps: { children: '되돌리기' }, timeout: 3000 }).timeout, 3000)
  assert.equal(withActionTimeout({ title: '예시' }).timeout, undefined)
  // 매니저: Base UI 매니저는 add 를 구독자에게 이벤트로 흘린다 — 그 옵션에 10000 이 실렸는지 본다.
  const m = createToastManager()
  const seen = []
  const unsub = m[' subscribe']((e) => seen.push(e)) // Base UI 의 내부 구독 키(앞에 빈칸)
  m.add({ title: '예시', actionProps: { children: '되돌리기' } })
  if (typeof unsub === 'function') unsub()
  assert.ok(JSON.stringify(seen).includes('"timeout":10000'), JSON.stringify(seen))
  // 훅(리뷰 M9): 실제로 ToastProvider 안에서 useToastManager().add 를 불러, Provider 저장소에 들어간 토스트의 timeout 을 본다.
  // 훅의 add 는 매니저를 거치지 않고 Provider 저장소(store.addToast)로 바로 간다 — 그래서 저장소를 읽는다.
  // 저장소는 공개 export 가 아니라 Base UI 의 같은 ESM 파일(ToastProviderContext.mjs)을 파일 주소로 불러 얻는다(같은 모듈 인스턴스).
  const toastMod = await load('ui/toast.tsx')
  const React = (await import('react')).default
  const { renderToString } = await import('react-dom/server')
  const { useToastProviderContext } = await import(pathToFileURL(join(root, 'node_modules', '@base-ui', 'react', 'toast', 'provider', 'ToastProviderContext.mjs')).href)
  let hook, store
  const Probe = () => { hook = toastMod.useToastManager(); store = useToastProviderContext(); return null }
  renderToString(React.createElement(toastMod.ToastProvider, null, React.createElement(Probe)))
  const idA = hook.add({ title: '예시 행동', actionProps: { children: '되돌리기' } })
  const idB = hook.add({ title: '예시 행동 3초', actionProps: { children: '되돌리기' }, timeout: 3000 })
  const idC = hook.add({ title: '예시 알림' })
  const byId = Object.fromEntries(store.state.toasts.map((t) => [t.id, t]))
  assert.equal(byId[idA].timeout, 10000)
  assert.equal(byId[idB].timeout, 3000)
  assert.notEqual(byId[idC].timeout, 10000)
  // 음성 대조: Base UI 훅을 그대로 쓰면 행동 토스트에 10000 이 붙지 않는다
  let base
  const RawProbe = () => { base = useToastProviderContext(); return null }
  renderToString(React.createElement(toastMod.ToastProvider, null, React.createElement(RawProbe)))
  const idR = base.addToast({ title: '예시 행동', actionProps: { children: '되돌리기' } })
  assert.notEqual(base.state.toasts.find((t) => t.id === idR).timeout, 10000)
})

// 특수일·공휴일 스키마와 JSON-LD(P3-2 Task 7a, 대장 A105)
test('SpecialHours: 쉬는 날에는 시각이 없고, 여는 날에는 여는·닫는 시각이 모두 있어야 하며, 날짜는 겹치지 않는다', () => {
  const ok = core.safeParseContent(core.SpecialHours, [{ date: '2026-10-03', label: '개천절', opens: '11:00', closes: '16:00' }, { date: '2026-10-05', closed: true }])
  assert.equal(ok.success, true)
  for (const bad of [
    [{ date: '2026-10-05', closed: true, opens: '10:00', closes: '12:00' }],
    [{ date: '2026-10-05', opens: '10:00' }],
    [{ date: '2026-10-05', opens: '12:00', closes: '10:00' }],
    [{ date: '2026-10-05', closed: true }, { date: '2026-10-05', closed: true }],
    [{ date: '10월 5일', closed: true }],
  ]) assert.equal(core.safeParseContent(core.SpecialHours, bad).success, false, JSON.stringify(bad))
  assert.equal(core.safeParseContent(core.HolidayPolicy, 'closed').success, true)
  assert.equal(core.safeParseContent(core.HolidayPolicy, 'always').success, false)
})

test('toSpecialOpeningHoursSpecification: 날짜마다 validFrom=validThrough, 쉬는 날은 00:00~00:00, 공휴일은 closed 정책일 때만 쉬는 날로, 같은 날 특수일이 이긴다', () => {
  const special = [{ date: '2026-10-05', closed: true }, { date: '2026-10-03', label: '개천절', opens: '11:00', closes: '24:00' }, { date: '2026-10-09', opens: '10:00', closes: '12:00' }]
  const holidays = [{ date: '2026-10-09', label: '한글날' }, { date: '2026-10-10', label: '대체공휴일' }]
  const toObj = (a) => a.map((x) => [x.validFrom, x.validThrough, x.opens, x.closes])
  assert.deepEqual(toObj(jsonld.toSpecialOpeningHoursSpecification(special, holidays, 'closed')), [
    ['2026-10-03', '2026-10-03', '11:00', '23:59'],
    ['2026-10-05', '2026-10-05', '00:00', '00:00'],
    ['2026-10-09', '2026-10-09', '10:00', '12:00'],
    ['2026-10-10', '2026-10-10', '00:00', '00:00'],
  ])
  assert.deepEqual(toObj(jsonld.toSpecialOpeningHoursSpecification(special, holidays, 'open')).map((x) => x[0]), ['2026-10-03', '2026-10-05', '2026-10-09'], 'open 정책의 공휴일은 싣지 않는다')
  assert.deepEqual(jsonld.toSpecialOpeningHoursSpecification(undefined, holidays, undefined), [])
  assert.equal(jsonld.toSpecialOpeningHoursSpecification(special)[0]['@type'], 'OpeningHoursSpecification')
})
