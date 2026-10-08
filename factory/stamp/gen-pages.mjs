// 06-pages — 후보 사이트 생성(P3-3 Task 9, 접합면 J1·J2·J9·J12·J13).
//   generateSite(runDir, cand, opts) → { siteDir, routes, blockers, sections, skipped, recipeId }
//   입력(모두 후보 폴더 runDir/<후보>/ 의 앞 단계 파일): 02-sitemap · 03-variants · 04-content(+04-content.request.json) · (선택) 05-media/manifest.json · 07-qa/legal/<쪽>.draft.json.
//   사이트 구조(site/):
//     content/site.json       J9 콘텐츠 원천 하나 — 검사를 통과한 원형 콘텐츠 + site + 섹션 props($ref) + 쪽 메타 + 법정 초안. 넘긴 뒤 수정은 이 파일만 고친다(§9 Q6).
//     app/<경로>/page.tsx     서버 컴포넌트: generateMetadata = seoMetadata, JSON-LD, SiteShell(pageTitle={hero ? false : 제목}) — h1 하나.
//     components/site/*.tsx   클라이언트 잎: 블록 하나를 부르고 withAttribution 으로 감싼 track·포트(목)를 넘긴다(블록은 태그를 모른다 — J2).
//     lib/site.tsx            site.json 읽기($ref 풀기) · lib/analytics.ts · lib/ports.ts(어댑터 자리 — launch-factory 관통 때 바꾼다).
//   콘텐츠 규칙:
//     · 검사(safeParseContent)를 통과한 콘텐츠로 그린다(C102) — 빈 사실 자리의 오류만 건너뛴다(04-content 와 같은 규칙).
//     · 필수 사실이 자리 표시(「확인 필요」)로 남으면 candidate.json blockers 에 「공개 불가 — 확인 필요 사실: <경로>」(사이트맵 blockers 와 같은 길).
//     · 문구는 콘텐츠에서만 온다. 슬롯 밖 UI 이름표·캡션만 블록 예시(fixture)에서 오고, 예시 표지·예시 사업체 이름·숫자가 남으면 blocker 다(C101).
//     · pending·묶을 자료가 없는 섹션은 그리지 않는다. 페이지는 빌드되고 blocker 가 남는다.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BLOCK_REGISTRY, loadArchetypes } from '../scripts/archetypes.mjs'
import { draftLegalPages, isPendingReview, PLACEHOLDER } from '../legal/drafts.mjs'
import { inputHash } from './run-dir.mjs'
import { reviseFallbacks } from './revise-picks.mjs'
import { applyWithdrawalPolicy, cookieCategoriesOf, linkAppRoutes, linkLegalRoutes, pageAnchorTargets, sectionsWithWithdrawalNotice } from './site-consistency.mjs'
import { compileCandidate } from './compile-candidate.mjs'
import { planAppShell } from './app-shell.mjs'
import { bindCopy, uiSameAsExample, emptyBusinessSlotIssue, FACT_SCHEMA_HOMES, loadContentSchema } from './content.mjs'
import { emptyStructureHomes, isPlaceholderHref } from './content-structure.mjs'
import { loadTs } from './ts-eval.mjs'
import { isNeedsCheck } from './needs-check.mjs'
import { LEGAL_ROUTES } from './sitemap.mjs'
import { BINDERS, EN_SCREEN_LEADS, FACT_KINDS, SIGNIN_GUIDE_PAGES, emptyGuideProps, signInGuideProps, hasBodyBlock, LABEL_KINDS, UI_SLOT_KINDS, at, collectExampleNames, collectExampleNamesFromSource, delAt, delLeaf, getLeaf, pathKeys, pathOf, setLeaf, optionalKeys, dropOptionalExamples, exampleIssues, mockupIssues, leakIssues, groupLeakIssues, contentTextsOf, foreignTextIssue, leaves, pageLabel, ref, refsOf, resolveRefs, hasExampleMarkerAt, paginationMergedIntoTable, refTargetMissing, usableText } from './site-bind.mjs'
import { copyMediaFiles, mediaRecipeOf, wireMedia } from './site-media.mjs'
import { localizeEnglishLabels } from './ui-labels-en.mjs'
import { cutDescription, pickDescriptionSlot } from './page-meta.mjs'
import { deadLinks as findDeadLinks, deadLinkSummary, readBuiltPages, staticDeadLinks } from './link-check.mjs'
import { bindContentSection } from './content-sections.mjs'
import { recipeColors, recipeHeadOf, writeFavicons, SITE_FILE_ITEMS } from './site-files.mjs'
import { addFallbackFaces, dropKoreanKitImports, recipeWeightsFor, subsetSiteFonts } from './site-fonts.mjs'
import { failMessage } from './fail-message.mjs'
import { TEMPLATE, robocopy, addItems, buildCandidateRegistry, ensureRepoRegistry, ensureTemplateCache, makeLocalRegistry, nextBuild, prepareSiteDir, dirBytes } from './site-install.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'registry', 'factory')

export const BLOCKER = {
  fact: '공개 불가 — 확인 필요 사실: ',
  example: '공개 불가 — 예시 문구 남음: ',
  unbound: '공개 불가 — 자료 연결 안 됨: ',
  photo: '공개 불가 — 실제 사진 필요: ',
  site: '공개 불가 — 사이트 주소 미정',
  jsonld: '공개 불가 — 구조 데이터 만들지 못함: ',
  reserved: '공개 불가 — 예시 연락처(예약 도메인): ',
  link: '공개 불가 — 법정 링크가 이어질 쪽 없음: ',
  metaPlaceholder: '공개 불가 — 메타 설명이 자리표시: ', // FINAL-WF2 AB4 — 메타·OG 설명에 「확인 필요」가 남았다(사이트 설명도 쪽 본문 문장도 없다)
  deadLink: '공개 불가 — 없는 쪽·앵커로 가는 링크: ', // FINAL-WF2 AB1·AB3·AB15 — 빌드한 HTML 의 `<a href>` 가 사이트의 실제 경로·id 에 닿지 않는다(link-check.mjs)
  undrawn: '공개 불가 — 필수 섹션 그리지 않음: ',
  legalStale: '공개 불가 — 법정 초안이 콘텐츠와 다름: ',
  bizInfo: '공개 불가 — 사업자 정보 표시 없음: ', // C356 — 전자상거래법 제10조(상호·대표자·주소·전화·사업자등록번호를 소비자가 보는 곳에 표시)
  foreign: '공개 불가 — 다른 언어·다른 사업의 화면 문구 남음: ', // C359 — 영어 사이트의 한글 글, 콘텐츠에 없는 예약 사업 낱말(제품 화면 예시 말투, C333)
}
// SiteShell 이 그리는 전역 섹션(머리글·건너뛰기 링크) — sitemap 에서는 블록이 없어 status 가 shell·none 이지만 그려진다.
const DRAWN_BY_SHELL = new Set(['header', 'skip-link'])

// 사업자 정보를 소비자에게 보이는 구획(푸터·사업자 정보 줄)이 하나도 없는 사이트(C356). 콘텐츠에 사업체 정보(business)가 있는 통신판매 원형(commerce·detail·saas·local)인데
// 상호 말고는 사업자 항목을 하나도 그리지 않으면 전자상거래법 제10조 표시가 빠진다 — 골든 detail-1·2 는 원형 JSON 에 푸터가 없어 사업자 정보가 어디에도 안 그려졌고 blockers 에도 안 떴다.
export const BIZ_INFO_KEYS = ['representative', 'bizRegNo', 'mailOrderNo', 'address', 'phone', 'email']
export function businessInfoBlocker(content, sections, archetypeId = content?.archetype) {
  if (!isObj(content?.business)) return null
  const text = JSON.stringify(sections ?? {})
  const drawn = BIZ_INFO_KEYS.filter((k) => text.includes(`"$ref":"business.${k}"`))
  if (drawn.length >= 2) return null
  return `${BLOCKER.bizInfo}전자상거래법 제10조 — 상호·대표자·주소·전화·이메일·사업자등록번호를 보이는 곳(푸터·사업자 정보 블록)이 이 사이트에 없다(원형 ${archetypeId} · 그려진 사업자 항목 ${drawn.length}개)`
}

/**
 * 푸터·사업자 정보 줄의 약관·처리방침 링크(C356): 콘텐츠의 business.termsUrl·privacyUrl 이 자리 표시(「확인 필요」)면 이 사이트의 법정 쪽(/terms·/privacy)이 그 링크다 — 사이트가 직접 만드는 쪽이라
 * 운영자가 채울 사실이 아니다(예전엔 푸터 링크 href 가 「확인 필요」 글자 그대로 나가고 「확인 필요 사실」로 막혔다). 법정 쪽이 사이트맵에 없거나 값이 이미 있으면 건드리지 않는다.
 * @returns {{ business: object, bound: string[] }}  bound = 이어 준 사실 경로(`business.termsUrl`) — 그 경로의 「확인 필요 사실」 사유는 내지 않는다
 */
export function ownPolicyLinks(business, sitemap) {
  const out = { business, bound: [] }
  if (!isObj(business)) return out
  for (const [key, id] of [['termsUrl', 'terms'], ['privacyUrl', 'privacy']]) {
    const route = sitemap.pages.find((p) => p.legal && p.id === id)?.route
    if (route && key in business && isNeedsCheck(business[key])) { out.business = { ...out.business, [key]: route }; out.bound.push(`business.${key}`) }
  }
  return out
}

/**
 * C70(대장): 원형의 필수 섹션 중 06 이 그리지 않은 것을 빠뜨리지 않고 공개 불가로 센다 — 본문(`noBlock.mode: content`)·부품(`part`) 모드는 06 이 아직 그리지 않아
 * 조용히 빠져 공개 가능으로 읽혔다(P3T16 지적). 블록이 필수 섹션인데 묶지 못한 것(「자료 연결 안 됨」)·필수 pending(사이트맵의 「필수 섹션 블록 없음」)은 이미 자기 줄이 있어 겹쳐 적지 않는다.
 * 조건부 전역 섹션(`condition`)과 SiteShell 이 그리는 것은 뺀다.
 * @param {{ pages: object[], globals?: object[] }} sitemap
 * @param {Record<string, unknown>} sections  실제로 그린 섹션(`<쪽>/<섹션>` 키)
 * @param {string[]} blockers  지금까지 쌓인 blockers
 * @param {Set<string>} merged  다른 섹션이 같은 자료를 그려 따로 그리지 않은 섹션(히어로 바로가기 칸이 본문 바로가기를 대신한다, C299)
 */
export function undrawnRequiredBlockers(sitemap, sections, blockers = [], merged = new Set()) {
  const covered = (key) => blockers.some((b) => b.startsWith(`${BLOCKER.unbound}${key} `))
  const out = []
  for (const p of sitemap.pages.filter((x) => !x.legal)) {
    for (const s of p.sections) {
      const key = `${p.id}/${s.kind}`
      if (!s.required || s.status === 'pending' || sections[key] || merged.has(key) || covered(key)) continue
      out.push(`${BLOCKER.undrawn}${key}`)
    }
  }
  for (const g of sitemap.globals ?? []) {
    const key = `global/${g.kind}`
    if (!g.required || g.condition || DRAWN_BY_SHELL.has(g.kind) || sections[key] || merged.has(key) || covered(key)) continue
    out.push(`${BLOCKER.undrawn}${key}`)
  }
  return out
}
const OWN_PREFIXES = Object.values(BLOCKER)

// 쪽 → SEO 종류. 나머지는 other. 앱 쪽(로그인 뒤·완료 화면)은 색인 제외.
const PAGE_KIND = { home: 'home', pricing: 'pricing', 'product-detail': 'product', privacy: 'legal', terms: 'legal', refund: 'legal', withdrawal: 'legal', contact: 'contact', about: 'about' }
const NOINDEX = new Set(['signup', 'login', 'onboarding', 'account', 'billing', 'cancel', 'booking-complete'])
// 가격을 화면에 그리는 블록 종류(요금제·상품 요약) — 이런 블록이 없는 쪽은 JSON-LD 에 가격을 싣지 않는다
const PRICE_BLOCK = /^block-(?:pricing|product-list)-/
const LEGAL_NOTICE = { ko: '법률 검토 전 초안이에요. 공개 전에 검토가 필요해요.', en: 'Draft pending legal review. It needs review before publishing.' }

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('')
const kebab = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const unwrap = (saved) => (isObj(saved) && 'inputHash' in saved && 'data' in saved ? saved.data : saved)

function readStage(dir, name) {
  const file = join(dir, `${name}.json`)
  if (!existsSync(file)) throw new Error(`앞 단계 파일이 없다: ${file} — ${name} 단계를 먼저 돌린다`)
  return unwrap(readJson(file))
}

// ── 블록 정보 ───────────────────────────────────────────────────────────
let blockCache
/** 블록 항목 이름 → { name, kind, variant, component, states, target, importPath, source }. */
export function blockItems() {
  if (blockCache) return blockCache
  const map = new Map()
  for (const i of readJson(BLOCK_REGISTRY).items.filter((x) => x.type === 'registry:block' && x.meta?.kind)) {
    const target = i.files[0].target.replace(/\.tsx?$/, '')
    const sourcePath = join(FACTORY, 'blocks', i.meta.kind, `${i.meta.variant}.tsx`)
    // 제목 길이 상한(C296): 레지스트리 항목 meta 에는 안 실리는 블록 메타(.block.json)에서 읽는다.
    const metaFile = join(FACTORY, 'blocks', i.meta.kind, `${i.meta.variant}.block.json`)
    const titleMaxUnits = existsSync(metaFile) ? readJson(metaFile).titleMaxUnits ?? null : null
    map.set(i.name, {
      name: i.name, kind: i.meta.kind, variant: i.meta.variant, component: i.meta.component, states: i.meta.states ?? [], media: i.meta.media ?? [], titleMaxUnits,
      importPath: `@/${target}`, sourcePath, source: existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '',
    })
  }
  return (blockCache = map)
}

/** 블록 하나의 조립 방식: track 을 받는가 · 포트를 받는가 · 폼을 가졌는가(멱등 키). */
export function blockTraits(b) {
  const src = b.source
  return {
    track: /\btrack\??:/.test(src),
    // 동의 상태(consent·setConsent·identify)를 받는 블록도 포트 블록이다 — track 만 받는 블록(AnalyticsPort["track"])은 아니다
    ports: /\b(?:BillingPort|AuthPort|NotifyPort|StoragePort)\[|AnalyticsPort\["(?:consent|setConsent|identify)"\]/.test(src),
    form: b.states.some((s) => s.startsWith('submit')),
    // 문의 폼: 보내기·전화·카카오 채널은 서버 없이 되는 정적 어댑터(mailto·tel·카카오 채널)를 lib/contact.ts 가 만든다(C111)
    contact: /\bContactSubmit\b/.test(src),
    contactKakao: /\bkakao\?:/.test(src),
    contactCall: /\bcall\?:/.test(src),
    // 신청 폼(lead-capture): 제출은 서버 없이 되는 정적 어댑터(메일 앱 열기)를 lib/contact.ts makeLeadPorts 가 만든다(5.11)
    lead: b.kind === 'lead-capture' && /\bsubmit:\s*\(input:\s*\{\s*email\b/.test(src),
    // 예약 완료: 요청한 예약(날짜·인원·요청 번호)은 폼을 보낸 뒤 주소(?ref=&at=&people=)에서 읽는다(lib/booking.ts)
    booking: /\bbooking:\s*\{\s*at:/.test(src),
    // 블록 머리를 공유 조각 BlockHeading 으로 그린다 — 쪽 제목을 맡을 수 있다(PageHeading level=1 로 감싸면 h1, FINAL-WF3)
    heading: /<BlockHeading\b/.test(src),
  }
}

let namesCache
/** 예시 모듈이 쓰는 가상 사업체 이름(C101 — 마커 없이 남은 이름도 잡는다). */
export async function exampleNames() {
  if (namesCache) return namesCache
  const mods = []
  const sources = []
  for (const b of blockItems().values()) {
    const f = join(FACTORY, 'blocks', b.kind, `${b.variant}.fixture.ts`)
    if (!existsSync(f)) continue
    sources.push(readFileSync(f, 'utf8'))
    try { const m = await loadTs(f); mods.push(m.fixture, m.fixtureMax, m.fixtureMin) } catch { /* 포트 어댑터를 못 불러오는 예시는 이름 수집에서 뺀다 */ }
  }
  // 수출한 값의 brand·company… 칸(collectExampleNames) + 예시 모듈 머리 주석이 밝히는 가상 이름·업종어(collectExampleNamesFromSource — P4CON 수정 3)
  return (namesCache = new Set([...collectExampleNames(mods.filter(Boolean)), ...collectExampleNamesFromSource(sources)]))
}

/**
 * 블록 예시(fixture). 영어 사이트(locale "en")는 예시 모듈이 영어 장면 `fixtureEn` 을 내보내면 그것을 쓴다(FV1 FOLLOW — 가입·로그인·계정·결제·해지·온보딩 같은 큰 제품 화면은
 * 한글 잎이 수십 개라 번역표(ui-labels-en.mjs)·화면 문구 칸(한도 12칸)으로 닫히지 않았다). 없으면 한국어 예시 그대로 — 한국어 사이트는 언제나 `fixture` 라 출력이 그대로다.
 */
export async function fixtureOf(b, { locale = 'ko' } = {}) {
  const f = join(FACTORY, 'blocks', b.kind, `${b.variant}.fixture.ts`)
  if (!existsSync(f)) return {}
  const m = await loadTs(f)
  const src = locale === 'en' && m.fixtureEn ? m.fixtureEn : m.fixture
  return JSON.parse(JSON.stringify(src ?? {})) // 함수·undefined 는 떨어진다 — 포트는 잎이 목으로 다시 준다
}

/**
 * 법정 쪽 초안(drafts.mjs)이 읽는 회사 정보. 초안은 `business` 만 읽는데 원형마다 회사 정보를 받는 뿌리가 다르다 —
 * business(commerce·detail·local·saas) · organization(brand) · agency(public: 이름·주소·대표전화만) · 없으면(dashboard·portfolio·pwa) facts 원문.
 * 이것이 없을 때는 brand·public 의 처리방침이 상호·주소·메일을 전부 「확인 필요」로 읽었다(P4GR 골든 실측, 06 blocker `business.name`…).
 * 값이 하나도 없으면 undefined(초안이 그대로 빈 사실로 읽는다).
 */
export function legalBusinessOf(content, facts) {
  if (isObj(content.business)) return content.business
  if (isObj(content.organization)) return content.organization
  const f = isObj(facts) ? facts : {}
  const agency = isObj(content.agency) ? { name: content.agency.name, address: content.agency.address, phone: content.agency.mainPhone } : {}
  const FIELDS = { name: 'name', legalName: 'legalName', representative: 'representative', bizNo: 'bizRegNo', mailOrderNo: 'mailOrderNo', address: 'address', phone: 'phone', email: 'email' }
  const out = {}
  for (const [fact, field] of Object.entries(FIELDS)) {
    const v = agency[field] ?? f[fact]
    if (typeof v === 'string' && v.trim()) out[field] = v.trim()
  }
  return Object.keys(out).length ? out : undefined
}

// ── 콘텐츠 검사 ──────────────────────────────────────────────────────────
const startsWith = (path, prefix) => prefix.every((k, i) => String(path[i]) === String(k))

/** 검사(safeParseContent)를 통과한 콘텐츠. 빈 사실 자리의 오류만 건너뛴다(04-content validateContent 와 같은 규칙). 통과 못 하면 던진다. */
export function validatedContent(raw, request) {
  const schema = loadContentSchema(request.archetype)
  const parsed = schema.safeParse(raw)
  const homes = (name) => [request.factPaths[name], ...(FACT_SCHEMA_HOMES[request.archetype]?.[name] ?? [])].filter(Boolean)
  const emptyHomes = [...request.missing.flatMap(homes), ...emptyStructureHomes(request)] // 사실 없는 구조 칸(C297)
  if (parsed.success) return { content: { ...parsed.data, ...(raw.site ? { site: raw.site } : {}), ...(raw.copyVariants ? { copyVariants: raw.copyVariants } : {}), ...(raw.media ? { media: raw.media } : {}) }, strict: true }
  const real = parsed.error.issues.filter((i) => !emptyHomes.some((h) => startsWith(i.path, h)) && !emptyBusinessSlotIssue(request, raw, i.path) && !isPlaceholderHref(request, raw, i.path))
  if (real.length) throw new Error(`콘텐츠가 스키마를 통과하지 못했다: ${real.slice(0, 5).map((i) => `${i.path.join('.') || '(맨 위)'} — ${i.message}`).join('; ')}`)
  // 빈 사실 자리 때문에 전체 검사는 못 통과했다 — 칸마다 검사해 통과하는 칸은 기본값이 채워진 값으로 바꾼다(JSON-LD·화면이 기본값(예: 지점 [])에 기댄다).
  const out = { ...raw }
  for (const [k, sch] of Object.entries(schema.shape ?? {})) {
    const r = sch.safeParse(raw[k])
    if (r.success && r.data !== undefined) out[k] = r.data
  }
  return { content: out, strict: false }
}

/**
 * QFIX2 [5] 이름 칸이 없는 원형(portfolio·dashboard)의 이름은 브리프 사실(facts.name)에만 있다 — 스키마 검사가 봉투 칸 facts 를 버려 binder 가 이름을 못 읽었다(푸터 「자료 연결 안 됨」, 머리글 이름 자리 표시).
 * 이름 칸(site·business·product·organization·agency·manifest 의 name)이 하나도 없고 사실 이름이 쓸 수 있는 값이면 사이트 이름 칸(site.name — 공개 값)에 싣는다. 원본은 바꾸지 않는다.
 */
export function withSiteName(content, facts) {
  const name = facts?.name
  if (typeof name !== 'string' || name.trim() === '' || isNeedsCheck(name)) return content
  if (['site', 'business', 'product', 'organization', 'agency', 'manifest'].some((k) => typeof content?.[k]?.name === 'string')) return content
  return { ...content, site: { ...(isObj(content.site) ? content.site : {}), name: name.trim() } }
}

/**
 * binder 가 읽는 콘텐츠. 엄격 검사를 통과한 콘텐츠는 스키마가 봉투 칸 facts 를 떼어 낸다(FINAL-WF B5, 실측: brand-1) — 부가세 표기(vatStatusOf)·머리글 연락 폴백(headerContactActionOf)의
 * facts 갈래가 죽는다. 원본 facts 를 되살려 넘긴다. factsRestored 면 호출하는 쪽이 site.json 에는 싣지 않는다(엄격 경로의 출력은 facts 때문에 바뀌지 않는다).
 */
export function bindableContent(validated, rawContent) {
  const factsRestored = !!validated.strict && isObj(rawContent.facts) && validated.content.facts === undefined
  return { content: withSiteName(factsRestored ? { ...validated.content, facts: rawContent.facts } : validated.content, rawContent.facts), factsRestored }
}

/** 콘텐츠 안의 자리 표시 글자 자리(경로). slots.copy 는 칸 경로(<쪽>/<섹션>/<칸>)로 적는다. */
export function placeholderPaths(content, request, referenced = null) {
  const out = new Set()
  const walk = (v, path) => {
    if (typeof v === 'string') { if (isNeedsCheck(v)) out.add(path.join('.')) }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (k !== 'slots' && k !== 'facts') walk(x, [...path, k])
  }
  walk(content, [])
  // referenced(06 이 그린 섹션이 $ref 로 잇는 문구 칸 번호의 집합)를 주면 사이트 어디에도 안 나가는 자리 표시 칸은 공개를 막지 않는다 — 예: detail 의 별점 칸 rating 은 리뷰 0건이면 자리 표시이고 어떤 binder 도 안 쓴다(C96)
  for (const { slot, entry } of bindCopy(request, content).values()) if (isNeedsCheck(entry.text) && (!referenced || referenced.has(content.slots.copy.indexOf(entry)))) out.add(slot.path)
  for (const name of request.missing) out.add((request.factPaths[name] ?? [name]).join('.'))
  return [...out].sort()
}

// 예약 도메인(RFC 2606·6761) — 시험·문서용 이름이라 실제 연락처가 아니다. 사실로 들어온 메일·주소가 여기 속하면 공개 불가다(C116: 사이트 주소 example.com 과 같은 길).
const RESERVED_HOST = /(?:^|\.)(?:example\.(?:com|org|net|edu)|example|test|invalid|localhost)$/i
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g
const URL_IN_TEXT = /\bhttps?:\/\/([^\s/:?#"'<>]+)/gi
export const isReservedHost = (host) => RESERVED_HOST.test(String(host).replace(/\.$/, ''))

/** 콘텐츠의 글자에서 예약 도메인 메일·주소가 든 자리(경로) — 정렬·중복 없음. 문구 칸의 role(요청에서 옮긴 설명)은 뺀다. */
export function reservedContactPaths(content) {
  const out = new Set()
  const walk = (v, path) => {
    if (typeof v === 'string') {
      const hosts = [...v.matchAll(EMAIL_IN_TEXT)].map((m) => m[1]).concat([...v.matchAll(URL_IN_TEXT)].map((m) => m[1]))
      if (hosts.some(isReservedHost)) out.add(path.join('.'))
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i]))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (!(path[0] === 'slots' && k === 'role')) walk(x, [...path, k])
  }
  walk(content, [])
  return [...out].sort()
}

// ── candidate.json blockers ─────────────────────────────────────────────
/** 후보 폴더 candidate.json 의 blockers 중 이 단계가 남긴 줄(prefix 로 구분)만 바꾼다. 다른 단계의 줄·다른 칸은 그대로. */
export function writeSiteBlockers(runDir, candId, lines) {
  const file = join(runDir, candId, 'candidate.json')
  let cur = {}
  if (existsSync(file)) { try { cur = readJson(file) } catch { cur = {} } }
  const keep = (cur.blockers ?? []).filter((b) => !OWN_PREFIXES.some((p) => b.startsWith(p)))
  const next = { ...cur, blockers: [...keep, ...lines] }
  writeAtomic(file, JSON.stringify(next, null, 2) + '\n')
  return next.blockers
}

// ── 섹션 묶기 ────────────────────────────────────────────────────────────
/**
 * 섹션 하나의 props 를 만든다: 블록 예시 + binder(콘텐츠 $ref) + 예시 표지 검사.
 * @returns {Promise<{ props: object|null, why?: string, issues: object[], dropped: string[] }>}
 */
export async function bindSection({ key, block, content, copyIndex, routes, locale, navLinks, primaryCta, secondaryHref, featuresHref, legal, uiLeaves = [], pageKinds = [] }) {
  const b = blockItems().get(block)
  if (!b) throw new Error(`블록을 모른다: ${block} (${key})`)
  const names = await exampleNames()
  const fixture = await fixtureOf(b, { locale })
  const original = JSON.parse(JSON.stringify(fixture)) // binder 가 손대기 전의 블록 예시 — 누설 대조(leakIssues)의 기준
  const ctx = {
    // 묶을 자료가 없을 때 binder 가 null 을 돌려주며 까닭을 적는다(ctx.why) — 없으면 기본 문장
    why: undefined,
    content, key, kind: b.kind, block, fixture, routes, locale, navLinks, primaryCta, secondaryHref, featuresHref, pageKinds, // featuresHref: 영어 사이트 보조 버튼이 기능 구획으로 가는 길(secondaryDest, FINAL-WF4 EN4) · pageKinds: 같은 쪽의 섹션 종류들 — 같은 쪽 도구 줄과 겹치는 알림을 줄이는 binder 가 본다

    // 선택 칸(타입에 ?:)만 지운다 — 필수 칸을 지우면 블록이 깨진다. 지웠으면 true.
    drop: (props, path) => { if (!optionalKeys(b.source).has(path.split('.').at(-1))) return false; delAt(props, path); return true },
    // 이 블록의 props 타입에서 선택 칸(`?:`)인가 — 선택 칸에만 문장을 새로 더한다(필수 칸 구조를 바꾸지 않는다)
    isOptional: (key) => optionalKeys(b.source).has(key),
    slot: (id, n = 0) => { const i = copyIndex.get(`${key}/${id}#${n}`); return i === undefined ? undefined : `slots.copy.${i}.text` },
    // 같은 종류(섹션 이름)의 다른 쪽 섹션이 가진 문구 칸 — 문구 칸이 없는 반복 섹션(캠페인 쪽 마지막 행동 띠)이 같은 사이트의 같은 문구를 쓴다
    // 섹션 이름을 모르고 문구 칸 id 만으로 찾는다(부제 칸이 없는 첫 화면의 lede 대체 — site-bind.mjs bindHero)
    slotAnyId: (id) => { for (const [k, i] of copyIndex) if (k.endsWith(`/${id}#0`)) return `slots.copy.${i}.text`; return undefined },
    slotAny: (sectionKind, id) => { for (const [k, i] of copyIndex) if (k.split('/')[1] === sectionKind && k.endsWith(`/${id}#0`)) return `slots.copy.${i}.text`; return undefined },
  }
  const binder = BINDERS[b.kind]
  let props
  if (binder) props = binder(ctx)
  else if (LABEL_KINDS.has(b.kind)) props = fixture
  else props = FACT_KINDS.has(b.kind) ? null : fixture
  if (props === null || props === undefined) return { props: null, why: binder ? (ctx.why ?? '콘텐츠에 이 블록을 채울 자료가 없다') : '이 블록 종류는 콘텐츠와 아직 이어지지 않았다', issues: [], dropped: [], ...(ctx.omit ? { omit: true } : {}), ...(ctx.inputWait ? { inputWait: true } : {}) }
  // 영어 사이트(D234·D235): 블록의 locale 칸(BlockBase)에 en 을 싣는다 — 날짜가 영어로 읽히고 부품의 접근 이름(닫기 등)이 영어 표로 간다. 한국어 사이트는 칸을 비워 두어 출력이 그대로다(content 블록은 base 가 이미 싣는다).
  if (locale === 'en' && isObj(props) && props.locale === undefined) props.locale = 'en'
  // 화면 문구 칸(C112): 04-content 가 써 준 문구를 예시 잎 자리에 $ref 로 잇는다(문구가 없으면 잎이 남아 아래 검사가 공개 불가로 잡는다)
  for (const u of uiLeaves) if (getLeaf(props, u.path) !== undefined) setLeaf(props, u.path, ref(u.ref))
  // 문구 칸이 블록 예시 문장을 그대로(예시 표지만 떼고) 베낀 곳(FINAL-WF2 AB5): 이 글은 문구 칸 $ref 라 아래 누설 검사가 「콘텐츠가 말한 글」로 면제한다 — 04 검사가 못 막은 콘텐츠의 안전망
  const copiedUi = uiLeaves.filter((u) => u.example !== undefined && !u.structural && getLeaf(props, u.path) !== undefined && typeof at(content, u.ref) === 'string' && uiSameAsExample(at(content, u.ref), u.example))
  // 영어 사이트(5.14): 블록 예시의 일반 화면 이름표(푸터 항목·상태 화면 단추·동의 항목·요일 …)는 한글이라 번역표(ui-labels-en.mjs)로 바꾼다 — 한국어 사이트는 건드리지 않는다. 표에 없는 한글은 남아 foreignTextIssue 가 사유로 낸다.
  if (locale === 'en') localizeEnglishLabels(props)
  // 사업 수치 칸(omit)의 문구가 비어 있으면(브리프 사실이 없어 문구를 못 쓴 칸) 그 칸이 든 배열 행을 통째로 빼고, 행이 아니면 선택 칸만 뺀다 — 예시 수치도 빈 칸도 화면에 나가지 않는다.
  const emptyOmits = uiLeaves.filter((u) => u.omit && typeof at(content, u.ref) === 'string' && !at(content, u.ref).trim())
  const rowOf = (path) => { const k = pathKeys(path); const i = k.findLastIndex((x) => typeof x === 'number'); return i < 0 ? null : k.slice(0, i + 1) }
  const rowsToDrop = [...new Map(emptyOmits.map((u) => rowOf(u.path)).filter(Boolean).map((k) => [pathOf(k), k])).values()].sort((a, b) => pathOf(b).localeCompare(pathOf(a), undefined, { numeric: true }))
  for (const k of rowsToDrop) delLeaf(props, pathOf(k))
  for (const u of emptyOmits) if (!rowOf(u.path) && optionalKeys(b.source).has(String(pathKeys(u.path).at(-1)))) delLeaf(props, u.path)
  // 누설 대조(EXLEAK)도 같은 길로 — 선택 칸(타입에 ?:)에 남은 예시 사업 글은 지운다(없는 편이 거짓 문구보다 낫다). 필수 칸이면 남아 아래에서 「예시 문구 남음」이 된다.
  const contentTexts = contentTextsOf(content)
  const leaksOf = (pr) => leakIssues(leaves(pr).filter((l) => l.ref === null), original, { kind: b.kind, contentTexts })
  const dropped = dropOptionalExamples(props, b.source, names, { keepDigits: UI_SLOT_KINDS.has(b.kind), extra: leaksOf })
  // 만 14세 이상 동의(FINAL-WF4 EN11): 한국 개인정보 보호법 제22조의2 의 칸이다 — 영어 사이트(EU·미국 소비자)는 콘텐츠 법정 사실(legal.ageGate)이 나이 기준을 말할 때만 둔다.
  if (locale === 'en' && isObj(props.copy) && props.copy.ageOver14 !== undefined && !hasAgeGateFact(legal)) delLeaf(props, 'copy.ageOver14')
  if (locale === 'en') neutralOpenLabelEn(props, block)
  if (locale === 'en') fillBlankAddressEn(props) // 확인 메일 안내의 빈 주소(FINAL-WF4 EN1) — 예시 주소를 뺀 뒤에 본다
  // 영어 사이트(FINAL-WF4 EN2): 뺀 한 줄 설명(lead)을 어느 제품에나 맞는 화면 설명으로 되돌린다 — 서버 HTML 첫 화면에 쪽이 무엇인지 글이 있게. 한국어 사이트는 그대로.
  if (locale === 'en' && EN_SCREEN_LEADS[block] && isObj(props.copy) && props.copy.lead === undefined && optionalKeys(b.source).has('lead')) props.copy.lead = EN_SCREEN_LEADS[block]
  // 법정 링크(P4CON): 블록 예시의 #terms·#privacy 는 사이트에 없는 앵커다 — 사이트맵의 실제 법정 쪽 경로로 잇는다. 이어질 쪽이 없으면 공개 불가 사유로 남긴다.
  const { dead: deadLinks } = linkLegalRoutes(props, routes)
  // 앱 화면 앵커(FINAL-WF2 AB15): 로그인·가입·계정 앵커는 사이트의 실제 경로로, 이어질 쪽이 없는 것은 링크를 뺀다
  linkAppRoutes(props, routes, optionalKeys(b.source))
  const literal = leaves(props).filter((l) => l.ref === null)
  const issues = exampleIssues(literal, names)
  issues.push(...mockupIssues(literal, issues.map((i) => i.path))) // 앱 화면 목업 안의 예시 앱 글(06 에서만 — 03·04 의 readiness 는 그대로)
  // 블록 예시의 평범한 사업 내용 글(「이번 주 빵」·「Loud ideas」·「SIGNAL」)이 콘텐츠 없이 남은 곳(EXLEAK) — 표지·숫자·이름이 없어 위 검사가 못 본다. 06 에서만 돈다.
  issues.push(...groupLeakIssues(leakIssues(literal, original, { kind: b.kind, contentTexts, alreadyFlagged: issues.flatMap((i) => [i.path, ...(i.leaves ?? [])]) })))
  for (const u of copiedUi) issues.push({ path: u.path, why: 'copied', value: String(at(content, u.ref)) })
  // 콘텐츠 값(ref)에도 예시 표지가 붙어 있으면 화면에 그대로 나간다 — 공개 불가
  for (const l of leaves(props).filter((x) => x.ref !== null)) {
    const v = at(content, l.ref)
    if (typeof v === 'string' && hasExampleMarkerAt(l.ref, v)) issues.push({ path: l.path, why: 'marker', value: v })
  }
  return { props, issues, dropped, deadLinks }
}

/**
 * 가입 확인 안내의 빈 주소(FINAL-WF4 EN1): 확인 메일 안내 `copy.confirm.body` 의 `{email}` 자리는 실행 때 가입한 사람의 주소가 들어간다. 정적 사이트에는 그 값(props.email)이 없어
 * (예시 주소 kim@example.com 은 06 이 뺀다) 「We sent a confirmation email to .」처럼 주소가 빈 문장이 나갔다. 값이 없으면 자리 표시를 걷고 「the address you signed up with」로 쓴다.
 * 영어 사이트만 부른다 — 한국어 사이트의 출력은 그대로.
 */
/** 콘텐츠 법정 사실이 가입 나이 기준을 말하는가(legal.ageGate — 14 또는 "guardian", 자리표시는 아니다). */
export const hasAgeGateFact = (legal) => isObj(legal) && legal.ageGate != null && !(typeof legal.ageGate === 'string' && (legal.ageGate.trim() === '' || isNeedsCheck(legal.ageGate)))

/**
 * 업그레이드 안내를 여는 단추 글(FINAL-WF4 EN1): 예시의 「See the {plan} plan」은 요금제 이름이 읽히기 전(서버 HTML·로딩)에 「See the … plan」으로 나갔다.
 * 영어 사이트는 자리 표시가 없는 글로 쓴다 — 단추를 열면 나오는 대화상자 제목(「Upgrade to {plan}」)은 요금제를 읽은 뒤라 그대로다.
 */
export const EN_OPEN_LABEL = { 'block-paywall-upgrade-modal': 'See upgrade options' }
export function neutralOpenLabelEn(props, block) {
  const label = EN_OPEN_LABEL[block]
  if (label && isObj(props?.copy) && typeof props.copy.open === 'string' && props.copy.open.includes('{plan}')) props.copy.open = label
}

export function fillBlankAddressEn(props) {
  if (!isObj(props) || props.email !== undefined) return
  const body = props.copy?.confirm?.body
  if (typeof body === 'string' && body.includes('{email}')) props.copy.confirm.body = body.split('{email}').join('the address you signed up with')
}

const EMPTY_GUIDE_BLOCK = 'block-state-screen-empty-guide'
const dedupe = (a) => [...new Set(a)]

// 제목 폭 어림 함수(블록 조각 _shared/title-fit — 블록이 쓰는 것과 같은 원천을 읽는다).
let titleFitCache
const titleFitMod = () => (titleFitCache ??= loadTs(join(FACTORY, 'blocks', '_shared', 'title-fit.tsx')))

/** 히어로 주 버튼이 가는 곳 — 가입 → 예약 값 → 요금제 → 상품 목록(commerce) → 소개(brand) → 없음('#'). 06 과 03 의 누설 예측(ui-copy leakTable)이 같은 규칙을 쓴다. */
export function ctaTargetOf(content, routes, { lead } = {}) {
  if (routes.signup) return { href: routes.signup }
  const p = at(content, 'booking.primary')
  if (isObj(p)) return { href: p.kind === 'tel' ? ref('booking.primary.value', { as: 'tel' }) : ref('booking.primary.value') }
  // FINAL-WF2 AB3 landing: 한 쪽 사이트의 주 행동은 같은 쪽 신청 폼(lead-capture)이다 — 예시 버튼의 죽은 앵커('#') 대신 폼 id 로 간다. 다른 쪽(머리글 행동·법정 쪽)에서는 호출자가 `<경로>#id` 로 바꾼다(anchorPage).
  if (lead && routes[lead.page]) return { href: `#${lead.id}`, anchorPage: lead.page }
  if (routes.pricing) return { href: routes.pricing }
  if (routes['category-list']) return { href: routes['category-list'] } // commerce: 구매 흐름의 시작은 상품 목록 쪽이다(예시 버튼의 죽은 앵커 대신)
  if (routes.about) return { href: routes.about } // brand: 전환이 없는 소개 사이트 — 주 버튼은 소개 쪽으로 간다
  // QFIX2 [5] portfolio: 가입·요금제·예약 채널이 없고 행동은 문의 메일 하나다 — 갈 곳은 mailto(쓸 수 있는 메일이 있을 때만)
  const mail = at(content, 'contact.email')
  if (typeof mail === 'string' && mail.trim() !== '' && !isNeedsCheck(mail)) return { href: ref('contact.email', { as: 'mailto' }) }
  return { href: '#' }
}

/**
 * 머리글 행동 폴백(QFIX3) — brand·public 은 가입·예약 전환이 없어 주 행동 문구 칸(primaryCta)이 없고 머리글 행동이 비었다. 연락 길이 콘텐츠에 있으면 머리글에 하나 둔다:
 * brand = 「문의하기」(메일, 없으면 「전화 문의」) · public = 대표 전화(번호가 글자인 tel 링크, 없으면 메일 → 「문의하기」). 쓸 수 있는 값이 없으면 null(가짜 버튼을 그리지 않는다).
 * 다른 원형은 null 이라 출력이 바뀌지 않는다.
 */
// 머리글 행동 글자 상한(글자 수) — 이보다 길면 375px 한 줄 머리글이 가로로 넘친다. 폴백(headerContactActionOf)도 같은 상한을 받는다(FINAL-WF B6).
export const SHELL_ACTION_MAX = 14
const SHELL_CONTACT_UI = { ko: { contact: '문의하기', call: '전화 문의' }, en: { contact: 'Contact', call: 'Call us' } }
export function headerContactActionOf(content, locale) {
  const ui = SHELL_CONTACT_UI[locale === 'en' ? 'en' : 'ko']
  const usable = (p) => { const v = at(content, p); return typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v) }
  if (content?.archetype === 'brand') {
    if (usable('organization.email')) return { label: ui.contact, href: ref('organization.email', { as: 'mailto' }) }
    if (usable('organization.phone')) return { label: ui.call, href: ref('organization.phone', { as: 'tel' }) }
  }
  if (content?.archetype === 'public') {
    // 대표 전화 번호가 길면(국제 번호·내선) 번호 대신 짧은 문구 — href 는 그대로 그 번호의 tel 링크다.
    if (usable('agency.mainPhone')) return { label: [...String(at(content, 'agency.mainPhone'))].length <= SHELL_ACTION_MAX ? ref('agency.mainPhone') : ui.call, href: ref('agency.mainPhone', { as: 'tel' }) }
    if (usable('facts.email')) return { label: ui.contact, href: ref('facts.email', { as: 'mailto' }) }
  }
  return null
}

/**
 * dashboard 쪽에서 데이터가 없어 빈 상태로 그려지는 패널(경고 목록·KPI·추세)은 데이터가 있는 구획 뒤로 보낸다(안정 정렬 — 나머지 순서는 그대로, QFIX3).
 * 빈 안내 카드 둘이 첫 화면을 차지해 숫자 지표·표가 두 화면째로 밀렸다. 대시보드 패널이 아닌 블록의 empty 는 건드리지 않는다.
 */
export function sinkEmptyPanels(list, sections) {
  const empty = (l) => /^block-dashboard-panel-/.test(l.block) && sections[l.key]?.props?.state?.status === 'empty'
  return [...list.filter((l) => !empty(l)), ...list.filter(empty)]
}

/** 폴백에서 비용이 같은 변형들 중 후보 칸(a·b·c → 0·1·2)마다 하나를 고른다 — 후보가 하나뿐이거나 칸 이름을 모르면 첫 번째. */
export function pickTie(ties, candId) {
  const i = Math.max(0, 'abc'.indexOf(String(candId)))
  return ties[i % ties.length]
}

/**
 * 한 쪽 안 섹션 `id` 를 유일하게 한다(FINAL-WF5, 대장 C410·C423). 블록의 기본 `id`(`id = "social-proof"`)는 블록 종류마다 하나라,
 * 같은 블록(또는 기본 id 가 같은 변형)을 한 쪽에 둘 그리면(portfolio 고객·수상 로고 줄, saas 후기·활용 사례, detail 사양표·고시표) 섹션 `id` 가 겹친다.
 * 쪽의 첫 인스턴스는 기본 id 를 지키고(앵커 `#pricing`·`#newsletter` 가 그대로), 뒤 것은 `<기본>-<섹션 이름>` 을 props.id 로 받는다.
 * 전역 잎(푸터·하단 바·앱 셸)은 모든 쪽에 같은 id 로 서므로 먼저 예약한다. 블록 안의 id 는 모두 이 id 에서 파생된다(blocks:check).
 * @param {{ pages: Array<Array<{ key: string, block: string }>>, globals: Array<{ key: string, block: string }>, sections: Record<string, { block?: string, props?: object }>, defaultIdOf: (block: string) => string|null }} a
 * @returns {Record<string, string>}  바뀐 섹션 키 → 새 id
 */
export function uniqueSectionIds({ pages, globals, sections, defaultIdOf }) {
  const idOf = (l) => sections[l.key]?.props?.id ?? defaultIdOf(l.block)
  const changed = {}
  for (const list of pages) {
    const used = new Set(globals.map(idOf).filter(Boolean))
    for (const l of list) {
      const base = idOf(l)
      if (!base) continue
      if (!used.has(base)) { used.add(base); continue }
      const kind = String(l.key).split('/').slice(1).join('-')
      let next = `${base}-${kebab(kind)}`
      for (let n = 2; used.has(next); n++) next = `${base}-${kebab(kind)}-${n}`
      used.add(next)
      changed[l.key] = next
      if (sections[l.key]?.props) sections[l.key].props.id = next
    }
  }
  return changed
}

// 같은 사실 묶음(FINAL-WF5, 대장 C424) — 콘텐츠 $ref 가 영업시간·주소·전화로 이어지면 그 블록이 그 사실을 화면에 그린다.
const FACT_GROUP_REFS = [['hours', /^hours(?:\.|$)/], ['address', /^business\.address$/], ['phone', /^business\.phone$/]]
/** 섹션 props 가 그리는 사실 묶음 집합({hours, address, phone}). */
export function factGroupsOf(props) {
  const out = new Set()
  for (const r of refsOf(props ?? {})) for (const [name, re] of FACT_GROUP_REFS) if (re.test(r)) out.add(name)
  return out
}
/**
 * 같은 쪽에 같은 사실을 두 번 그리는 선택 섹션 찾기(local 홈: 오늘 영업시간 블록과 오시는 길 블록이 같은 요일 표·주소를 둘 다 그렸다).
 * 선택 섹션(required 아님)이 그리는 사실 묶음을 같은 쪽의 다른 잎과 전역 잎(푸터·하단 바)이 이미 모두 그리면 건너뛴다. 뒤에서부터 보아, 선택끼리 같으면 앞 것이 남고
 * 필수 섹션은 겹쳐도 건너뛰지 않는다. 사실을 하나도 안 그리는 섹션은 대상이 아니다.
 * @returns {string[]} 건너뛸 섹션 키(쪽 순서대로)
 */
export function redundantFactKeys({ leaves: list, globals = [], sections, required }) {
  const groups = (l) => factGroupsOf(sections[l.key]?.props)
  const alive = [...list]
  const out = []
  for (let i = list.length - 1; i >= 0; i--) {
    const l = list[i]
    if (required(l.key)) continue
    const mine = groups(l)
    if (mine.size === 0) continue
    const elsewhere = new Set([...alive.filter((x) => x !== l), ...globals].flatMap((x) => [...groups(x)]))
    if ([...mine].every((g) => elsewhere.has(g))) { alive.splice(alive.indexOf(l), 1); out.unshift(l.key) }
  }
  return out
}

// 묶지 못한 선택 섹션이 읽으려던 사실 묶음 — 종류마다 그 블록의 바탕 사실(영업시간 표를 그리는 hours-location 은 요일 표)이다. 사실을 말하지 않는 종류는 없다.
const UNBOUND_FACT_GROUPS = { 'hours-location': ['hours'] }
/**
 * 묶지 못해 「자료 연결 안 됨」이 남은 선택 섹션 중, 그 섹션이 그리려던 사실을 같은 쪽의 다른 잎·전역 잎이 이미 다 그리는 것(FIT-7, W1b C3).
 * 오시는 길(directions, 필수)이 요일 표를 그리는데 선택 섹션 hours-table(오늘 영업시간)이 지도 링크가 없어 못 그려진 것이 「콘텐츠에 이 블록을 채울 자료가 없다」로 남던 길 —
 * 화면에는 영업시간이 있으니 거짓 사유다. redundantFactKeys 는 그려진 섹션만 보고 이 함수는 못 그려진 섹션을 본다(같은 규칙, 같은 사실 묶음).
 * @param {{ unbound: Array<{ key: string, kind: string }>, leaves: Array<{ key: string }>, globals?: Array<{ key: string }>, sections: Record<string, { props?: object }> }} a
 * @returns {string[]} 사유를 낼 필요 없는 섹션 키
 */
export function unboundRedundantKeys({ unbound, leaves: list, globals = [], sections }) {
  const drawn = new Set([...list, ...globals].flatMap((x) => [...factGroupsOf(sections[x.key]?.props)]))
  return unbound.filter((u) => { const need = UNBOUND_FACT_GROUPS[u.kind]; return !!need && need.every((g) => drawn.has(g)) }).map((u) => u.key)
}

/**
 * 같은 쪽에 같은 것을 두 번 그리지 않기 위한 키(EXLEAK): 같은 쪽의 같은 블록·같은 props 이거나, 상품 목록이면 변형이 달라도 같은 자료($ref)를 그리는 것.
 * 콘텐츠에는 상품 목록이 하나뿐이라 사이트맵이 「신상품」·「인기」·「기획전」으로 나눠도 같은 상품 전체를 세 번 그리던 길이다. 전역 섹션(푸터·하단 바)은 쪽이 아니라 null.
 */
export function dedupeKey(key, { block, props }) {
  const page = String(key).split('/')[0]
  if (page === 'global') return null
  if (/^block-product-list-/.test(block) && isObj(props?.state) && isObj(props.state.data) && typeof props.state.data.$ref === 'string') return `${page}|product-list|${props.state.data.$ref}`
  return `${page}|${block}|${JSON.stringify(props)}`
}

const arr0 = (v) => (Array.isArray(v) ? v : [])
const clip = (t, n = 28) => { const x = String(t).replace(/\s+/g, ' ').trim(); return [...x].length > n ? `${[...x].slice(0, n).join('')}…` : x }
/** 다른 언어·다른 사업 문구 이슈(site-bind foreignTextIssue) 한 줄 — 한 섹션 = 한 줄. */
const foreignLine = (key, f) =>
  `${BLOCKER.foreign}${key} — ${f.why === 'locale' ? `영어 사이트인데 한글 글 ${f.count}곳 남음` : `이 콘텐츠에 없는 사업 낱말(${f.words.join('·')})이 든 화면 문구 ${f.count}곳 남음`}(예: 「${clip(f.sample)}」)`

const issueLine = (key, issues) => {
  // 누설(leak)은 한 섹션에 몇 곳이어도 이슈 하나(groupLeakIssues) — 줄에는 어느 칸들인지 보인다
  const shown = issues.slice(0, 3).map((i) => (i.why === 'leak' ? `${i.leaves.slice(0, 3).join('·')}${i.leaves.length > 3 ? ` 외 ${i.leaves.length - 3}곳` : ''}(leak)` : `${i.path}(${i.why})`)).join(', ')
  return `${BLOCKER.example}${key} — ${shown}${issues.length > 3 ? ` 외 ${issues.length - 3}곳` : ''}`
}

// ── 코드 만들기 ──────────────────────────────────────────────────────────
export function leafSource({ name, block, recipeId, h1 = false }) {
  const b = blockItems().get(block)
  const t = blockTraits(b)
  const blockId = `${b.kind}-${b.variant}`
  const contactProps = t.contact ? ` submit={contact.submit}${t.contactKakao ? ' kakao={contact.kakao}' : ''}${t.contactCall ? ' call={contact.call}' : ''}` : ''
  const leadProps = t.lead ? ' submit={lead.submit}' : ''
  const inner = `<${b.component} {...props}${t.ports ? ' {...ports}' : ''}${contactProps}${leadProps}${t.booking ? ' booking={booking}' : ''}${t.track ? ' track={track}' : ''} />`
  const formed = t.form ? `<FormKeys>${inner}</FormKeys>` : inner
  const owner = h1 && t.heading && !t.booking
  const body = owner ? `<PageHeading level={1}>${formed}</PageHeading>` : formed
  if (t.booking) return bookingLeafSource({ name, b, blockId, recipeId, inner: body, track: t.track })
  return `"use client"

// 생성 파일(gen-pages.mjs) — ${blockId} 블록 하나를 조립한다. 문구·값은 content/site.json 에 있고 이 파일에는 없다(J9).
import * as React from "react"

import { ${b.component} } from "${b.importPath}"
import { withAttribution } from "@/components/contract/attribution"
import { analytics } from "@/lib/analytics"
${t.ports ? 'import { makePorts } from "@/lib/ports"\n' : ''}${t.contact ? 'import { makeContactPorts } from "@/lib/contact"\n' : ''}${t.lead ? 'import { makeLeadPorts } from "@/lib/contact"\n' : ''}${t.form ? 'import { FormKeys } from "@/components/site/form-keys"\n' : ''}${owner ? 'import { PageHeading } from "@/components/blocks/_shared/heading-level"\n' : ''}
const RECIPE = ${JSON.stringify(recipeId)}

export function ${name}({ props, copyVariant }: { props: React.ComponentProps<typeof ${b.component}>; copyVariant?: string }) {
${t.track ? `  const track = React.useMemo(() => withAttribution(analytics, { blockId: ${JSON.stringify(blockId)}, recipeId: RECIPE, copyVariant }).track, [copyVariant])\n` : `  void RECIPE\n  void copyVariant\n`}${t.ports ? '  const ports = React.useMemo(() => makePorts(), [])\n' : ''}${t.contact ? '  const contact = React.useMemo(() => makeContactPorts(), [])\n' : ''}${t.lead ? '  const lead = React.useMemo(() => makeLeadPorts(), [])\n' : ''}  return ${body}
}
`
}

// 예약 완료 잎: 예약(날짜·인원·요청 번호)은 주소에서 읽고(useBookingFromUrl), 없으면 그리지 않는다. useSearchParams 는 정적 쪽에서 Suspense 안에 있어야 한다.
function bookingLeafSource({ name, b, blockId, recipeId, inner, track }) {
  return `"use client"

// 생성 파일(gen-pages.mjs) — ${blockId} 블록 하나를 조립한다. 문구·값은 content/site.json 에 있고, 요청한 예약은 주소(?ref=&at=&people=)에서 온다(J9).
import * as React from "react"

import { ${b.component} } from "${b.importPath}"
import { withAttribution } from "@/components/contract/attribution"
import { analytics } from "@/lib/analytics"
import { useBookingFromUrl } from "@/lib/booking"
${inner.includes('FormKeys') ? 'import { FormKeys } from "@/components/site/form-keys"\n' : ''}
const RECIPE = ${JSON.stringify(recipeId)}
type Props = Omit<React.ComponentProps<typeof ${b.component}>, "booking">

function Inner({ props, copyVariant }: { props: Props; copyVariant?: string }) {
${track ? `  const track = React.useMemo(() => withAttribution(analytics, { blockId: ${JSON.stringify(blockId)}, recipeId: RECIPE, copyVariant }).track, [copyVariant])\n` : '  void RECIPE\n  void copyVariant\n'}  const booking = useBookingFromUrl()
  if (!booking) return null
  return ${inner}
}

export function ${name}({ props, copyVariant }: { props: Props; copyVariant?: string }) {
  return (
    <React.Suspense fallback={null}>
      <Inner props={props} copyVariant={copyVariant} />
    </React.Suspense>
  )
}
`
}

// 첫 화면 구획(P3-4 PERF2, 대장 C233): 쪽의 첫 블록(앞의 얇은 띠 — 공지·동의·내비 — 는 같이)을 `<div data-wf-first="" className="contents">` 로 감싼다. 모션 키트가 그 안의 등장 대상을
// data-enter="keep" 처럼 첫 칠부터 보이게 한다(motion-boot MOTION_GATE_CSS · use-gsap-scene settleKept) — 히어로가 아닌 첫 구획(상세 쪽 상품 제목 등)이 LCP 후보일 때 하이드레이션 뒤로 밀리지 않게.
// 잃는 것: 그 구획의 서버 렌더 등장 연출(히어로 keep 과 같다). 첫 화면 밖 구획은 그대로 숨었다 등장한다. contents 라 레이아웃·선택자(> 자식)는 그대로다.
export const FIRST_SCREEN_BAR = /^block-(?:(?:announcement|consent|nav)-|content-breadcrumb$)/ // 본문 섹션의 현재 위치 띠(공공 서브 쪽)도 얇은 띠다 — 그 뒤 섹션까지 첫 구획(레인 CONTENT)
/**
 * 첫 화면 구획에 드는 잎의 개수 — 앞의 띠 + 첫 본문 블록(띠만 있으면 띠 전부).
 * 첫 본문 블록이 히어로가 아니면 그 다음 블록까지: 히어로는 첫 화면을 채우지만 다른 블록(스켈레톤·상품 구획·본문 섹션)은 짧을 수 있어 둘째 블록이 375 첫 화면에 든다 —
 * pwa 홈은 스켈레톤 다음 빈 상태 카드가 LCP 후보인데 `data-enter` 로 숨겨져 하이드레이션 뒤에 그려져 모의 LCP 가 4.3~4.7 s 였다(PERF3).
 * 잃는 것: 히어로가 없는 쪽의 둘째 블록의 서버 렌더 등장 연출(첫 구획의 keep 과 같다).
 */
export function firstScreenCount(list) {
  let n = 0
  while (n < list.length && FIRST_SCREEN_BAR.test(list[n].block)) n++
  const body = list[n]
  return Math.min(list.length, n + (body && !/^block-hero-/.test(body.block) ? 2 : 1))
}

/**
 * @param {object} a
 * @param {{ sidebar?: object, topBar?: object, banner?: object, toast?: object }} [a.shell]  앱 셸 잎(FV1 Task 5.18) — dashboard 사이드바·상단 줄 / pwa 연결 띠·새 판 알림. 없으면(다른 원형) 출력이 예전 그대로다.
 */
export function pageSource({ route, leaves: list, hero, legal, footer, bar, shell: appShell }) {
  const sh = appShell ?? {}
  const shellLeaves = [sh.sidebar, sh.topBar, sh.banner, sh.toast].filter(Boolean)
  const imports = [...list, ...(footer ? [footer] : []), ...(bar ? [bar] : []), ...shellLeaves].map((l) => `import { ${l.name} } from "@/components/site/${l.file}"`).join('\n')
  const tag = (l) => `<${l.name} props={sectionProps(${JSON.stringify(l.key)})} copyVariant={copyVariantOf(${JSON.stringify(l.key)})} />`
  // 사이드바는 쪽마다 지금 쪽을 알아야 한다(aria-current) — 사이트 하나에 하나인 섹션 props 에 이 쪽 주소를 더해 넘긴다
  const sidebarTag = (l) => `<${l.name} props={{ ...(sectionProps(${JSON.stringify(l.key)}) as object), currentHref: ROUTE } as never} copyVariant={copyVariantOf(${JSON.stringify(l.key)})} />`
  const legalBody = legal ? `        <LegalBody clauses={legalPage(${JSON.stringify(legal)}).clauses} notice={legalPage(${JSON.stringify(legal)}).draft ? ${JSON.stringify(LEGAL_NOTICE)}[locale] : undefined} />\n` : ''
  const nFirst = firstScreenCount(list)
  const firstScreen = nFirst ? `      <div data-wf-first="" className="contents">\n${list.slice(0, nFirst).map((l) => `        ${tag(l)}`).join('\n')}\n      </div>` : ''
  const rest = list.slice(nFirst).map((l) => `\n      ${tag(l)}`).join('')
  const content = `${legalBody}${firstScreen}${rest}${bar ? `\n      ${tag(bar)}` : ''}`
  // 앱 셸: 사이드바·상단 줄이 있으면 본문(main 안)을 [사이드바 | 상단 줄 + 쪽 내용] 두 칸으로 감싼다. 셸 머리는 한 줄 로고 띠로 남기고(주 메뉴는 사이드바가 맡는다) 위에 붙지 않으며,
  // 사이드바가 있으면 폭 한계도 없다. 쪽 제목(h1)은 그대로 SiteShell 이 그린다(pageTitle) — 랜드마크·h1 규칙은 예전과 같다.
  const wrapped = sh.sidebar || sh.topBar
    ? `      <div className="flex flex-col lg:flex-row">\n${sh.sidebar ? `        ${sidebarTag(sh.sidebar)}\n` : ''}        <div className="min-w-0 flex-1">${sh.topBar ? `\n          ${tag(sh.topBar)}` : ''}\n${content.split('\n').map((l) => (l ? `    ${l}` : l)).join('\n')}\n        </div>\n      </div>`
    : content
  const shellProp = sh.sidebar || sh.topBar ? `      {...shell}\n      ${sh.sidebar ? 'nav={undefined}\n      ' : ''}sticky={false}\n      ${sh.sidebar ? 'width="full"\n      ' : ''}` : '      {...shell}\n      '
  return `// 생성 파일(gen-pages.mjs) — 서버 컴포넌트. 메타·JSON-LD·제목은 content/site.json 에서 읽는다.
import type { Metadata, Viewport } from "next"

import { JsonLd } from "@/components/ax/json-ld"
import { jsonLdFor } from "@/components/ax/geo-entity"
import { seoMetadata } from "@/components/ax/seo-meta"
import { SiteShell } from "@/components/ui/site-shell"
${legal ? 'import { LegalBody } from "@/lib/legal"\n' : ''}import { copyVariantOf, ${legal ? 'legalPage, locale, ' : ''}pageSeo, pageTitle, sectionProps, seoContent, shellProps } from "@/lib/site"
${imports}

const ROUTE = ${JSON.stringify(route)}

export function generateMetadata(): Metadata {
  return seoMetadata(seoContent(), pageSeo(ROUTE))
}

// 노치 기기의 safe-area(viewport-fit=cover)와 안드로이드 키보드가 하단 CTA·입력칸을 가리지 않게 하는 것(interactive-widget) — 대장 C61, ops-gate viewport-fit 이 meta 를 확인한다.
export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content" }

export default function Page() {
  const { action, ...shell } = shellProps(ROUTE)
  return (
    <SiteShell
${shellProp}pageTitle={${hero || list.some((l) => l.h1) ? 'false' : 'pageTitle(ROUTE)'}}
      actions={action ? <a href={action.href}>{action.label}</a> : undefined}
      footer={${footer ? tag(footer) : 'undefined'}}
    >
      <JsonLd data={jsonLdFor(seoContent(), pageSeo(ROUTE))} />
${sh.banner ? `      ${tag(sh.banner)}\n` : ''}${wrapped}${sh.toast ? `\n      ${tag(sh.toast)}` : ''}
    </SiteShell>
  )
}
`
}

const routeFile = (route) => (route === '/' ? join('app', 'page.tsx') : join('app', ...route.split('/').filter(Boolean), 'page.tsx'))

// ── 정적 검사(테스트가 부른다) ────────────────────────────────────────────
/** 페이지 파일(app/**\/page.tsx)마다 h1 이 정확히 하나가 되게 짜였는가: 히어로 잎이 있으면 pageTitle={false}(히어로가 h1), 없으면 pageTitle={…}(셸이 h1). 히어로 잎은 하나뿐. */
export function h1Problems(siteDir, meta) {
  const out = []
  for (const [route, info] of Object.entries(meta)) {
    const file = join(siteDir, routeFile(route))
    if (!existsSync(file)) { out.push(`${route}: 페이지 파일이 없다`); continue }
    const src = readFileSync(file, 'utf8')
    const heroLeaves = info.heroLeaves ?? 0
    const owners = info.h1Leaves ?? 0 // 쪽 제목을 맡은 블록 잎(PageHeading level=1, FINAL-WF3) — 히어로와 같이 h1 을 가진다
    const h1s = heroLeaves + owners
    const shellOff = /pageTitle=\{false\}/.test(src)
    const shellOn = /pageTitle=\{pageTitle\(ROUTE\)\}/.test(src)
    if (heroLeaves > 1) out.push(`${route}: 히어로 잎이 ${heroLeaves}개다 — h1 이 여럿`)
    else if (h1s > 1) out.push(`${route}: h1 을 가진 잎이 ${h1s}개다(히어로 ${heroLeaves} + 쪽 제목을 맡은 블록 ${owners}) — h1 이 여럿`)
    if (h1s === 1 && !shellOff) out.push(heroLeaves === 1 ? `${route}: 히어로가 h1 을 가지는데 셸도 h1 을 그린다` : `${route}: 쪽 제목을 맡은 블록이 h1 을 가지는데 셸도 h1 을 그린다`)
    if (h1s === 0 && !shellOn) out.push(`${route}: h1 이 없다(셸 pageTitle 없음, 히어로 없음)`)
  }
  return out
}

/** 생성된 코드의 블록 import 가 모두 설치되는 경로(블록 항목 target)에 있는가. */
export function importProblems(siteDir) {
  const known = new Set([...blockItems().values()].map((b) => b.importPath))
  // 공유 조각(`components/blocks/_shared/*` — 쪽 제목을 맡는 잎의 PageHeading 이 이쪽에서 온다)도 설치되는 경로다
  for (const i of readJson(BLOCK_REGISTRY).items) if (i.meta?.shared) known.add(`@/${i.files[0].target.replace(/\.tsx?$/, '')}`)
  const out = []
  const dir = join(siteDir, 'components', 'site')
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.tsx')) : []) {
    const src = readFileSync(join(dir, f), 'utf8')
    for (const m of src.matchAll(/from "(@\/components\/blocks\/[^"]+)"/g)) if (!known.has(m[1])) out.push(`${f}: 설치되지 않는 블록 경로 ${m[1]}`)
  }
  return out
}

/** 블록에 넘기는 track 은 모두 withAttribution 결과인가. */
export function trackProblems(siteDir) {
  const dir = join(siteDir, 'components', 'site')
  const out = []
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.tsx') && x !== 'form-keys.tsx') : []) {
    const src = readFileSync(join(dir, f), 'utf8')
    for (const m of src.matchAll(/track=\{(\w+)\}/g)) {
      const def = new RegExp(`const ${m[1]} = [^\\n]*withAttribution\\(analytics,[^\\n]*\\)\\.track`).test(src)
      if (!def) out.push(`${f}: track={${m[1]}} 가 withAttribution 결과가 아니다`)
    }
    if (/track=\{(?!\w+\})/.test(src)) out.push(`${f}: track 에 식별자가 아닌 값을 넘겼다`)
  }
  return out
}

/**
 * 콘텐츠 값(J9)이 content/site.json 한 곳에만 있는가: ① 생성 코드(app·components/site·lib 의 생성·템플릿 파일)에 콘텐츠 문자열이 없다
 * ② site.json 의 섹션 props 에 콘텐츠 문자열이 literal 로 또 있지 않다($ref 여야 한다). 법정 초안(legal)은 콘텐츠 사실을 문장에 풀어 담는 파생본이라 뺀다.
 */
export function duplicateProblems(siteDir) {
  const site = readJson(join(siteDir, 'content', 'site.json'))
  const { sections, pages, legal, shell, ...content } = site
  void legal
  const values = new Set()
  // 콘텐츠 값이 아닌 칸(식별자·역할 설명·종류 이름)은 뺀다 — 04-content 검사와 같은 목록이다.
  const NOT_VALUES = new Set(['id', 'role', 'tone', 'forbid', 'aspect', 'source', 'kind', 'subtype', 'category', 'os', 'archetype', 'locale', 'currency', 'day', 'opens', 'closes'])
  const walk = (v, key) => {
    if (typeof v === 'string') { if (v.trim().length >= 4 && !/^(?:https?:\/\/|\/|#)/.test(v) && !NOT_VALUES.has(key) && !isNeedsCheck(v)) values.add(v.trim()) }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(content, '')
  const out = []
  const scan = (dir, base) => {
    for (const e of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
      const p = join(dir, e.name)
      if (e.isDirectory()) { scan(p, base); continue }
      if (!/\.(?:tsx?|jsx?|css)$/.test(e.name)) continue
      const src = readFileSync(p, 'utf8')
      for (const v of values) if (src.includes(v)) out.push(`${p.slice(base.length + 1).split('\\').join('/')}: 콘텐츠 값이 코드에 있다 — ${JSON.stringify(v.slice(0, 30))}`)
    }
  }
  scan(join(siteDir, 'app'), siteDir)
  scan(join(siteDir, 'components', 'site'), siteDir)
  for (const f of ['site.tsx', 'analytics.ts', 'ports.ts', 'legal.tsx']) if (existsSync(join(siteDir, 'lib', f))) scan(join(siteDir, 'lib'), siteDir)
  for (const [key, s] of Object.entries(sections ?? {})) {
    for (const l of leaves(s.props)) if (l.ref === null && typeof l.value === 'string' && values.has(l.value.trim())) out.push(`site.json sections.${key}.${l.path}: 콘텐츠 값이 literal 로 또 있다 — $ref 여야 한다`)
  }
  void pages; void shell
  return [...new Set(out)]
}

/**
 * 쪽마다 그려지는 섹션(`sectionProps("<키>")`)의 `id` 가 유일한가(FINAL-WF5). 한 쪽 HTML 안 id 중복의 윗단 — 블록 안쪽 id 는 모두 이 id 에서 파생되므로(blocks:check)
 * 섹션 id 가 유일하면 쪽 안 id 가 겹치지 않는다. → "<경로>: <id> ← <키>, <키>" 줄들.
 */
export function sectionIdProblems(siteDir) {
  const site = readJson(join(siteDir, 'content', 'site.json'))
  const out = []
  for (const route of Object.keys(site.pages ?? {})) {
    const file = join(siteDir, routeFile(route))
    if (!existsSync(file)) continue
    const keys = [...new Set([...readFileSync(file, 'utf8').matchAll(/sectionProps\("([^"]+)"\)/g)].map((m) => m[1]))]
    const byId = new Map()
    for (const key of keys) {
      const sec = site.sections?.[key]
      if (!sec?.block) continue
      const id = sec.props?.id ?? blockItems().get(sec.block)?.source?.match(/\bid = "([^"]+)"/)?.[1]
      if (!id) continue
      byId.set(id, [...(byId.get(id) ?? []), key])
    }
    for (const [id, list] of byId) if (list.length > 1) out.push(`${route}: id "${id}" ← ${list.join(', ')}`)
  }
  return out
}

/**
 * 소스 단계 링크 검사(FINAL-WF6): 06 출력(site.json + 쪽 파일의 `sectionProps("<키>")`)만으로 섹션 props 의 내부 링크가 사이트의 실제 경로·섹션 id 에 닿는지 센다(빌드 없음).
 * → link-check.staticDeadLinks 의 줄들(`{ route, key, path, href, why }`).
 */
export function staticLinkProblems(siteDir) {
  const site = readJson(join(siteDir, 'content', 'site.json'))
  const pageKeys = {}
  for (const route of Object.keys(site.pages ?? {})) {
    const file = join(siteDir, routeFile(route))
    pageKeys[route] = existsSync(file) ? [...new Set([...readFileSync(file, 'utf8').matchAll(/sectionProps\("([^"]+)"\)/g)].map((m) => m[1]))] : []
  }
  return staticDeadLinks({ site, pageKeys, defaultIdOf: (blk) => blockItems().get(blk)?.source?.match(/\bid = "([^"]+)"/)?.[1] ?? null })
}

/** 법정 쪽 경로(/privacy 등)가 원형 legal.pages 대로 모두 있는가. */
export function legalRouteProblems(siteDir, archetype) {
  const out = []
  for (const name of archetype.legal.pages) {
    const route = LEGAL_ROUTES[name]
    if (!route || !existsSync(join(siteDir, routeFile(route)))) out.push(`법정 쪽 ${name}(${route}) 파일이 없다`)
  }
  return out
}

// ── 본체 ────────────────────────────────────────────────────────────────
/**
 * @param {string} runDir  찍어내기 실행 폴더(out/<run>)
 * @param {{ id: string, source: string, recipe: string|object }} cand  Task 3 후보
 * @param {{ install?: boolean, build?: boolean, siteUrl?: string, log?: Function, only?: Set<string> }} [opts]
 *   install false 면 파일만 만든다(정적 검사용 — 레지스트리·npm 을 건드리지 않는다). build true 면 next build 까지.
 */
export async function generateSite(runDir, cand, opts = {}) {
  const { install = true, build = false, siteUrl = 'https://example.com', log = () => {} } = opts
  const candDir = join(runDir, cand.id)
  const sitemap = readStage(candDir, '02-sitemap')
  const variants = readStage(candDir, '03-variants')
  const request = readJson(join(candDir, '04-content.request.json'))
  const rawContent = readStage(candDir, '04-content')
  const archetype = (await loadArchetypes())[sitemap.archetype]
  if (!archetype) throw new Error(`원형을 모른다: ${sitemap.archetype}`)
  const locale = rawContent.locale === 'en' ? 'en' : 'ko'

  // 1. 검사를 통과한 콘텐츠(C102) + 후보 레시피 컴파일
  const validated = validatedContent(rawContent, request)
  const { content, factsRestored } = bindableContent(validated, rawContent)
  const strict = validated.strict
  const compiled = await compileCandidate(cand, runDir)
  const recipeId = compiled.recipeId

  // 2. 섹션 묶기
  const copyIndex = new Map()
  for (const { slot, entry } of bindCopy(request, rawContent).values()) {
    const n = [...copyIndex.keys()].filter((k) => k.startsWith(`${slot.path}#`)).length // 같은 칸 id 가 한 섹션에 여럿일 때 순서
    copyIndex.set(`${slot.path}#${n}`, rawContent.slots.copy.indexOf(entry))
  }
  const routes = Object.fromEntries(sitemap.pages.map((p) => [p.id, p.route]))
  const navPages = sitemap.pages.filter((p) => !p.legal && p.sections.some((s) => s.status === 'block') && p.route !== '/' && !NOINDEX.has(p.id))
  const emptyPages = new Set() // 본문이 하나도 안 그려져 빈 상태 안내만 든 쪽(06 이 empty-guide 를 그린 쪽) — 메뉴·사이트맵에서 빼고 noindex(FINAL-WF2 AB6)
  const navLinks = () => [
    { label: pageLabel('home', locale), href: '/' },
    ...navPages.filter((p) => !emptyPages.has(p.id)).map((p) => ({ label: pageLabel(p.id, locale), href: p.route })), // 빈 상태 안내뿐인 쪽은 메뉴에 없다(AB6)
    ...sitemap.pages.filter((p) => p.legal).map((p) => ({ label: pageLabel(p.id, locale), href: p.route })),
  ]
  // 같은 쪽 구획 앵커(FINAL-WF2 AB3): 사이트맵의 블록 섹션이 03 에서 고른 블록의 기본 id(`id = "…"`)로 간다 — 06 이 폴백으로 블록을 바꿔 id 가 달라져도 빌드 뒤 링크 검사(link-check)가 잡는다.
  const defaultIdOf = (blk) => blockItems().get(blk)?.source?.match(/\bid = "([^"]+)"/)?.[1] ?? null
  const sectionAnchor = (kind) => {
    for (const p of sitemap.pages) for (const s of p.sections) {
      if (s.kind !== kind || s.status !== 'block') continue
      const id = defaultIdOf(variants[`${p.id}/${s.kind}`])
      if (id) return { page: p.id, id }
    }
    return null
  }
  let lead = sectionAnchor('lead-capture') // 03 이 고른 블록 기준 어림 — 06 폴백이 블록을 바꾸면 아래 「앵커 보정」이 실제 그려진 블록의 id 로 고친다
  let pricingAnchor = sectionAnchor('pricing')
  const ctaTarget = () => ctaTargetOf(content, routes, { lead })
  // 앵커 행선지는 그 쪽 안에서는 `#id`, 다른 쪽(머리글·법정 쪽·다른 쪽 구획)에서는 `<경로>#id`
  const toward = (t, page) => { if (!t?.anchorPage) return t; const { anchorPage, ...rest } = t; return anchorPage === page ? rest : { ...rest, href: `${routes[anchorPage]}${t.href}` } }
  const pageOfKey = (key) => String(key).split('/')[0]
  const primaryCtaFor = (key) => () => toward(ctaTarget(), pageOfKey(key))
  // 기능 구획 앵커(FINAL-WF4 EN4·EN5 — 영어 사이트의 「See how it works」류 보조 버튼): 사이트맵의 기능·작동 방식 구획. 없으면 null(버튼을 뺀다).
  const featureKinds = ['workflow-features', 'features', 'how-it-works']
  const featureAnchor = () => { for (const kind of featureKinds) { const a = sectionAnchor(kind); if (a) return { ...a, kind } } return null }
  let featureGuess = featureAnchor()
  const featuresHrefFor = (key) => () => (featureGuess ? toward({ href: `#${featureGuess.id}`, anchorPage: featureGuess.page }, pageOfKey(key)).href : null)
  const secondaryHrefFor = (key) => () => routes.pricing ?? (pricingAnchor ? toward({ href: `#${pricingAnchor.id}`, anchorPage: pricingAnchor.page }, pageOfKey(key)).href : '#')

  const sections = {}
  const skipped = []
  const blockers = []
  const rendered = {} // route → { leaves, heroLeaves, footer, bar, ... }
  const leafFiles = new Map()
  const pageMeta = {}

  const chosen = (key) => variants[key]
  const merged = new Set() // 다른 섹션이 같은 자료를 그려 따로 그리지 않은 필수 섹션(C299)
  const unboundOptional = [] // 못 묶어 「자료 연결 안 됨」이 남은 선택 섹션 — 같은 사실을 다른 섹션이 그리면 그 줄을 거둔다(unboundRedundantKeys, FIT-7)
  const drawnBy = new Map() // dedupeKey → 그것을 처음 그린 섹션 키
  const fallbacks = [] // 03-variants 가 고른 블록이 콘텐츠로 안 채워져 같은 섹션의 다른 변형으로 바꾼 곳(06 이 정한다 — 03 은 콘텐츠를 모르고 고른다)
  const titleOverflow = [] // 끝까지 고른 블록의 제목 길이 상한을 넘은 곳 { key, block, units, max, text } — 폴백으로 바뀐 곳은 fallbacks 에 따로 있다
  const droppedByKey = {} // 예시가 남은 선택 칸이라 뺀 경로
  // 화면 문구 칸(요청의 slot.ui) → 이 블록의 잎 목록 [{ path, ref }] — 요청이 고른 블록과 같은 블록일 때만
  const uiLeavesFor = (key, blk) => request.slots
    .filter((sl) => sl.ui && sl.block === blk && sl.path.startsWith(`${key}/ui:`))
    .flatMap((sl) => { const i = copyIndex.get(`${sl.path}#0`); return i === undefined ? [] : [{ path: sl.ui.path, ref: `slots.copy.${i}.text`, example: sl.ui.example, ...(sl.ui.numbers === 'structural' ? { structural: true } : {}), ...(sl.ui.numbers === 'business' ? { omit: true } : {}) }] })
  // 제목 길이 상한(C296): 블록 메타 titleMaxUnits(em — 한 낱말을 크게 쓰는 히어로가 한 줄에 그릴 수 있는 폭)를 넘는 제목이면 { units, max, text }, 아니면 null.
  // 03-variants 는 콘텐츠(제목)를 모르고 고르므로(위 fallbacks 주석) 길이는 제목이 묶인 지금 여기서 본다 — 이슈와 같은 폴백 길을 탄다.
  const titleOver = async (blk, r) => {
    const max = blockItems().get(blk)?.titleMaxUnits
    if (max == null || !r.props) return null
    const t = r.props.copy?.title
    if (t === undefined) return null
    let text
    try { text = resolveRefs(t, content) } catch { return null } // 못 푸는 ref 는 아래 resolveRefs(res.props) 가 이름을 붙여 던진다
    if (typeof text !== 'string') return null
    const units = (await titleFitMod()).titleUnits(text)
    return units > max ? { units, max, text } : null
  }
  // 콘텐츠에 있는 말(브리프 사실·04 문구 본문 — 문구 칸 설명 role 은 뺀다): 다른 사업 낱말 검사(foreignTextIssue)가 「콘텐츠가 그 말을 쓰면 누설이 아니다」를 가리는 근거
  const bizTexts = contentTextsOf({ ...rawContent, slots: { copy: arr0(rawContent.slots?.copy).map((c) => ({ text: c.text })) } })
  const bindKey = async (key, block, alternatives = [], required = true) => {
    const attempt = (blk) => bindSection({ key, block: blk, content, copyIndex, routes, locale, navLinks, primaryCta: primaryCtaFor(key), secondaryHref: secondaryHrefFor(key), featuresHref: featuresHrefFor(key), legal: rawContent.legal, uiLeaves: uiLeavesFor(key, blk), pageKinds: (sitemap.pages.find((p) => p.id === pageOfKey(key))?.sections ?? []).map((x) => x.kind) })
    const first = await attempt(block)
    const firstOver = await titleOver(block, first)
    let res = first
    let used = block
    // 이슈 주도 폴백: 고른 변형이 콘텐츠로 안 채워지거나(null) 예시 문구가 남거나(가상 데모 화면 등) 제목이 그 변형의 길이 상한을 넘으면
    // 같은 섹션의 다른 허용 변형 중 비용(남는 이슈 수 + 제목 초과 0.5)이 가장 낮은 것을 쓴다. 이슈가 있는 변형보다 제목만 넘는 변형이 낫다(예시 문구는 공개 불가, 제목 초과는 블록이 줄여 그린다).
    if (!first.props || first.issues.length || firstOver) {
      let cost = res.props ? res.issues.length + (firstOver ? 0.5 : 0) : Infinity
      // 비용이 가장 낮은 변형이 여럿이면(깨끗한 변형이 둘 이상) 후보 칸(a·b·c)마다 돌려 고른다(EXLEAK) — 늘 첫 번째만 고르면 한 사이트 a·b·c 의 이 섹션이 같은 블록으로 모인다.
      let ties = []
      for (const alt of alternatives.filter((a) => a !== block)) {
        const r = await attempt(alt)
        const over = await titleOver(alt, r)
        const c = r.props ? r.issues.length + (over ? 0.5 : 0) : Infinity
        if (!r.props) continue
        if (c < cost) { cost = c; ties = [{ alt, r }] } else if (c === cost && ties.length) ties.push({ alt, r })
      }
      // 돌려 고르기는 누설(leak) 때문에 폴백할 때만 한다 — 그 밖의 폴백은 예전 그대로 첫 번째(골든 06 결과가 이 일과 무관하게 바뀌지 않게)
      if (ties.length) { const pick = pickTie(ties, first.issues.some((i) => i.why === 'leak') ? cand.id : 'a'); res = pick.r; used = pick.alt }
      if (used !== block) {
        const why = !first.props ? first.why : [first.issues.length ? `예시 문구 ${first.issues.length}곳 남음` : null, firstOver ? `제목 ${firstOver.units}em 이 이 변형의 상한 ${firstOver.max}em 을 넘는다(「${firstOver.text}」)` : null].filter(Boolean).join(' · ')
        fallbacks.push({ key, from: block, to: used, why, ...(firstOver ? { titleOver: firstOver } : {}) })
      }
    }
    // 고른 블록이 끝까지 제목 상한을 넘으면(바꿀 변형이 없거나 수정 제안이 이 블록 하나로 못 박아 둔 사이트맵) 기록한다 — 블록이 제목을 줄여 그리지만
    // 실제 찍어내기에서는 같은 섹션의 다른 변형이 있으면 폴백하므로, 수정 제안(revise)이 「지금 제목으로는 적용되지 않는다」를 미리 알린다(FIT-5).
    const keptOver = used === block ? firstOver : await titleOver(used, res)
    if (keptOver && res.props) titleOverflow.push({ key, block: used, ...keptOver })
    // 선택 섹션(required false)이 「지어내지 않는다」 때문에 그릴 자료가 없으면(res.omit — 판매 순위 없는 ranked-list, D238) 공개 불가로 막지 않고 뺀다. 필수 섹션은 그대로 막는다.
    if (!res.props) {
      skipped.push({ key, block, why: res.why })
      // 입력 대기(전화번호가 「확인 필요」라 전화 단추를 못 그린다 등)는 「확인 필요 사실」 사유가 이미 있다 — 같은 일을 품질 사유로 한 번 더 세지 않고, 「그리지 않음」으로도 세지 않는다(FIT-7).
      if (res.inputWait) merged.add(key)
      else if (!(res.omit && !required)) {
        const line = `${BLOCKER.unbound}${key} (${block}) — ${res.why}`
        blockers.push(line)
        if (!required) unboundOptional.push({ key, kind: blockItems().get(block)?.kind, line })
      }
      return null
    }
    // 같은 쪽의 앞 섹션이 같은 것을 이미 그렸으면 되풀이하지 않는다(EXLEAK) — 그리지 않은 필수 섹션 blocker 도 내지 않는다(merged).
    const dk = dedupeKey(key, { block: used, props: res.props })
    if (dk && drawnBy.has(dk)) {
      skipped.push({ key, block: used, why: `같은 쪽의 앞 섹션 ${drawnBy.get(dk)} 가 같은 자료를 이미 그린다 — 되풀이하지 않는다` })
      merged.add(key)
      const i = fallbacks.findIndex((f) => f.key === key)
      if (i >= 0) fallbacks.splice(i, 1)
      return null
    }
    if (dk) drawnBy.set(dk, key)
    if (res.issues.length) blockers.push(issueLine(key, res.issues))
    const foreign = foreignTextIssue(leaves(res.props), { locale, kind: blockItems().get(used).kind, contentTexts: bizTexts })
    if (foreign) blockers.push(foreignLine(key, foreign))
    for (const d of res.deadLinks ?? []) blockers.push(`${BLOCKER.link}${key} — ${d.path}(${d.anchor} → ${d.page} 쪽이 사이트맵에 없다)`)
    if (res.dropped.length) droppedByKey[key] = res.dropped
    // 참조 대상이 모두 콘텐츠에 있는지(빠지면 여기서 던진다)
    resolveRefs(res.props, content)
    sections[key] = { block: used, props: res.props, ...(rawContent.copyVariants?.[key] ? { copyVariant: rawContent.copyVariants[key] } : {}) }
    return { ...res, block: used }
  }
  const leaf = (key, block) => {
    const b = blockItems().get(block)
    const [page, kind] = key.split('/')
    const file = `${kebab(page)}-${kebab(kind)}`
    const info = { key, block, file, name: pascal(`${page}-${kind}`), hero: b.kind === 'hero' }
    leafFiles.set(file, info)
    return info
  }

  // 쪽 제목 문구(대장 C70): 히어로가 없는 쪽의 본문 섹션에 제목 칸(h1·title)이 있으면 그 문구가 쪽 제목이다(공공 서브 쪽 h1·대시보드 화면 이름). 없으면 쪽 이름표.
  const contentTitleRef = (page) => {
    for (const s of page.sections) if (s.status === 'content' || s.status === 'part') for (const id of ['h1', 'title']) {
      const i = copyIndex.get(`${page.id}/${s.kind}/${id}#0`)
      if (i !== undefined && !isNeedsCheck(rawContent.slots.copy[i].text)) return ref(`slots.copy.${i}.text`)
    }
    return null
  }
  const pageTitleOf = (pageId) => { const p = sitemap.pages.find((x) => x.id === pageId); return (p && contentTitleRef(p)) ?? pageLabel(pageId, locale) }
  const sectionSpec = (pageId, kind) => archetype.pages.find((pg) => pg.id === pageId)?.sections.find((x) => x.kind === kind)
  // 본문·부품 섹션(대장 C70): 원형 noBlock.render 로 렌더러(block-content-*) props 를 콘텐츠 $ref 로 만든다. 자료가 없으면 그리지 않고 「자료 연결 안 됨」.
  const names = await exampleNames()
  const bindContent = (key, page, first) => {
    const nb = sectionSpec(page.id, key.split('/')[1])?.noBlock ?? {}
    const res = bindContentSection({ key, pageId: page.id, render: nb.render, missing: nb.missing, content, copyIndex, routes, locale, sitemap, pageTitleOf, first, now: opts.now })
    if (!res.props) {
      skipped.push({ key, block: null, why: res.why })
      if (!res.omit) blockers.push(`${BLOCKER.unbound}${key} (본문) — ${res.why}`)
      return null
    }
    const issues = exampleIssues(leaves(res.props).filter((l) => l.ref === null), names)
    for (const l of leaves(res.props).filter((x) => x.ref !== null)) {
      const v = at(content, l.ref)
      if (typeof v === 'string' && hasExampleMarkerAt(l.ref, v)) issues.push({ path: l.path, why: 'marker', value: v })
    }
    if (issues.length) blockers.push(issueLine(key, issues))
    for (const ph of res.photos) blockers.push(`${BLOCKER.photo}${ph}`)
    resolveRefs(res.props, content)
    sections[key] = { block: res.block, props: res.props }
    return res
  }

  for (const page of sitemap.pages.filter((p) => !p.legal)) {
    const list = []
    for (const s of page.sections) {
      if (s.status === 'content' || s.status === 'part') {
        const key = `${page.id}/${s.kind}`
        // 히어로의 「자주 찾는 서비스」 칸이 콘텐츠 바로가기(quickLinks)를 그렸으면 본문 바로가기 섹션은 같은 링크를 되풀이한다 — 한 번만 그린다(C299).
        if (s.kind === 'quick-links' && [...refsOf(sections[`${page.id}/hero`]?.props ?? {})].some((r) => r.startsWith('quickLinks.'))) {
          skipped.push({ key, block: null, why: '히어로의 「자주 찾는 서비스」 칸이 같은 바로가기를 그린다 — 본문 바로가기 섹션을 따로 그리지 않는다' })
          merged.add(key)
          continue
        }
        // 쪽 나누기 부품(FV1 Task 5.9): 같은 쪽에 목록 표 블록(data-table)이 묶여 있으면 표가 쪽 나누기를 표 아래에 함께 그린다 — 따로 그리지 않는다(표가 안 그려지면 표의 「자료 연결 안 됨」이 이미 막는다).
        if (paginationMergedIntoTable(page, s)) {
          skipped.push({ key, block: null, why: '목록 표 블록이 쪽 나누기를 표 아래에 함께 그린다 — 따로 그리지 않는다' })
          merged.add(key)
          continue
        }
        const res = bindContent(key, page, list.length === 0)
        if (res) list.push(leaf(key, res.block))
        continue
      }
      if (s.status !== 'block') continue
      const key = `${page.id}/${s.kind}`
      const block = chosen(key)
      if (!block) throw new Error(`03-variants 에 ${key} 가 없다`)
      const bound = await bindKey(key, block, s.allowedVariants, s.required)
      if (!bound) continue
      list.push(leaf(key, bound.block))
    }
    // 로그인해야 보이는 쪽(영어 사이트)의 서버 HTML 에 로그인 길을 보인다(FINAL-WF4 EN2) — 블록의 읽기 상태는 그대로, 쪽 끝에 안내 한 장
    if (SIGNIN_GUIDE_PAGES.has(page.id) && list.length && routes.login) {
      const guide = signInGuideProps(locale, routes.login)
      if (guide) { const key = `${page.id}/signin-guide`; sections[key] = { block: EMPTY_GUIDE_BLOCK, props: guide }; list.push(leaf(key, EMPTY_GUIDE_BLOCK)) }
    }
    // 본문이 하나도 안 그려진 쪽(앱 고유 화면처럼 콘텐츠로 못 그리는 섹션뿐)은 빈 상태 안내 + 첫 행동을 그린다(UX H08, ux 관문 bodyChecked 0). 섹션이 안 그려진 사유 blocker 는 그대로 남는다.
    if (!hasBodyBlock(list.map((l) => l.block))) {
      const key = `${page.id}/empty-guide`
      sections[key] = { block: EMPTY_GUIDE_BLOCK, props: emptyGuideProps(locale) }
      list.push(leaf(key, EMPTY_GUIDE_BLOCK))
      if (page.route !== '/') emptyPages.add(page.id)
    }
    // titleLeaves: 쪽 제목은 그리는 순서가 아니라 사이트맵 순서의 첫 블록 제목으로 정한다(빈 패널을 뒤로 보내도 쪽 이름이 바뀌지 않게)
    rendered[page.route] = { id: page.id, leaves: sitemap.archetype === 'dashboard' ? sinkEmptyPanels(list, sections) : list, titleLeaves: list }
  }
  // 전역 섹션: 푸터 블록 → SiteShell footer 자리, 하단 고정 바 → 본문 끝. 머리글은 SiteShell 헤더(레시피 헤더 축)가 그린다.
  let footer = null
  const bars = new Map()
  for (const g of sitemap.globals ?? []) {
    if (g.status !== 'block') continue
    const key = `global/${g.kind}`
    const block = chosen(key)
    if (!block) continue
    if (g.kind === 'footer') { const b = await bindKey(key, block, g.allowedVariants); if (b) footer = leaf(key, b.block) }
    else if (/^(?:sticky-booking-bar|sticky-buy-bar|bottom-tab-bar)$/.test(g.kind)) { const b = await bindKey(key, block, g.allowedVariants, g.required); if (b) bars.set(g.kind, leaf(key, b.block)) } // required: 선택 하단 줄(pwa bottom-tab-bar)이 omit 이면 막지 않고 뺀다
  }
  const bar = [...bars.values()][0] ?? null
  // 같은 사실(영업시간·주소·전화)을 이미 다른 블록·푸터·하단 바가 그리는 선택 섹션은 건너뛴다(FINAL-WF5 C424) — 필수 섹션이 아니므로 「그리지 않음」 blocker 는 없다
  for (const page of sitemap.pages.filter((p) => !p.legal)) {
    const r = rendered[page.route]
    if (!r) continue
    const drop = redundantFactKeys({ leaves: r.leaves, globals: [footer, ...bars.values()].filter(Boolean), sections, required: (k) => !!sectionSpec(page.id, k.split('/')[1])?.required })
    for (const key of drop) {
      const info = r.leaves.find((l) => l.key === key)
      skipped.push({ key, block: info.block, why: '같은 사실(영업시간·주소·전화)을 같은 쪽의 다른 블록과 푸터·하단 바가 이미 그린다 — 선택 섹션이라 따로 그리지 않는다' })
      merged.add(key)
      delete sections[key]
      leafFiles.delete(info.file)
    }
    if (drop.length) {
      r.leaves = r.leaves.filter((l) => !drop.includes(l.key))
      for (let i = r.titleLeaves.length - 1; i >= 0; i--) if (drop.includes(r.titleLeaves[i].key)) r.titleLeaves.splice(i, 1)
    }
    // 못 그려진 선택 섹션의 사실을 이 쪽의 다른 잎이 이미 그린다면 「자료 연결 안 됨」은 거짓이다 — 줄을 거두고 건너뜀 까닭에 「같은 사실」을 적는다(W1b C3)
    const redundantUnbound = unboundRedundantKeys({ unbound: unboundOptional.filter((u) => u.key.split('/')[0] === page.id), leaves: r.leaves, globals: [footer, ...bars.values()].filter(Boolean), sections })
    for (const key of redundantUnbound) {
      const u = unboundOptional.find((x) => x.key === key)
      const i = blockers.indexOf(u.line)
      if (i >= 0) blockers.splice(i, 1)
      const sk = skipped.find((x) => x.key === key)
      if (sk) sk.why = `같은 사실(영업시간)을 같은 쪽의 다른 블록이 이미 그린다 — 선택 섹션이라 따로 그리지 않는다(이 변형은 자료가 모자라 못 그리기도 한다: ${sk.why})`
      merged.add(key)
    }
  }
  // 앱 셸(FV1 Task 5.18): dashboard 사이드바·상단 줄·상태 화면, pwa 연결 띠·새 판 알림 — 03 이 고른 전역 섹션 중 푸터·하단 줄 밖의 것(app-shell.mjs). 쪽 섹션이 먼저 끝나 있어야 검색·알림이 갈 곳을 안다.
  const brandRef = at(content, 'site.name') ? ref('site.name') : ['business.name', 'product.name', 'organization.name', 'agency.name'].map((p) => (at(content, p) ? ref(p) : null)).find(Boolean) ?? PLACEHOLDER[locale]
  const shellPlan = planAppShell({ sitemap, chosen, sections, content, locale, brandRef, blocks: blockItems() })
  for (const u of shellPlan.unbound) {
    skipped.push({ key: u.key, block: u.block, why: u.why })
    blockers.push(`${BLOCKER.unbound}${u.key} (${u.block}) — ${u.why}`)
  }
  fallbacks.push(...shellPlan.fallbacks)
  for (const [key, sec] of Object.entries(shellPlan.sections)) { resolveRefs(sec.props, content); sections[key] = sec }
  const shellLeaf = {}
  for (const l of shellPlan.leaves) { const info = leaf(l.key, l.block); if (l.render) info.render = l.render; shellLeaf[l.role] = info }
  // 섹션 id 유일화(FINAL-WF5 C410·C423): 같은 블록 종류를 한 쪽에 둘 그리면 뒤 것은 `<기본>-<섹션 이름>` — 앵커 보정보다 먼저 해서 보정이 실제 id 를 읽는다
  uniqueSectionIds({
    pages: Object.values(rendered).map((r) => r.leaves),
    globals: [footer, ...bars.values(), ...Object.values(shellLeaf)].filter(Boolean),
    sections, defaultIdOf,
  })
  // 앵커 보정(FINAL-WF2 AB3): 06 폴백이 같은 섹션의 다른 변형으로 바꾸면(예: 자료 칸이 없는 lead-capture 변형 → 소식지 폼) 블록 기본 id 가 달라진다 — 실제 그려진 블록의 id 로 앵커를 고친다
  const pricingGuessIds = [pricingAnchor?.id].filter(Boolean) // 03 이 어림한 요금제 앵커 — 아래 「쪽에 없는 앵커」가 안 그려진 경우를 푼다(FINAL-WF6)
  for (const [kind, guess] of [['lead-capture', lead], ['pricing', pricingAnchor], [featureGuess?.kind, featureGuess]]) {
    const drawnSec = guess ? sections[`${guess.page}/${kind}`] : null
    const id = drawnSec?.block ? (drawnSec.props?.id ?? defaultIdOf(drawnSec.block)) : null
    if (!guess || !id || id === guess.id) continue
    for (const [from, to] of [[`#${guess.id}`, `#${id}`], [`${routes[guess.page]}#${guess.id}`, `${routes[guess.page]}#${id}`]]) {
      for (const sec of Object.values(sections)) for (const l of leaves(sec.props)) if (typeof l.value === 'string' && l.value === from && /(?:^|\.)href$/.test(l.path)) setLeaf(sec.props, l.path, to)
    }
    if (kind === 'lead-capture') lead = { page: guess.page, id }
    else if (kind === 'pricing') pricingAnchor = { page: guess.page, id }
    else featureGuess = { ...guess, id }
  }
  // 쪽에 없는 섹션 앵커(FINAL-WF6 C426·WF4a): 블록 예시의 `#pricing`·`#cookie-settings` 는 같은 쪽에 그 섹션이 그려질 때만 닿는다 — 안 그려진 쪽에서는 사이트 전체에서 찾은 쪽의 `<경로>#<id>`,
  // 요금제는 요금제 쪽 경로로 잇고, 이어질 곳이 없으면 선택 칸의 링크를 뺀다(필수면 빌드 뒤 링크 검사가 막는다).
  {
    const idsByPage = new Map()
    for (const [key, sec] of Object.entries(sections)) {
      const id = sec.block ? (sec.props?.id ?? defaultIdOf(sec.block)) : null
      const page = key.split('/')[0]
      if (id) idsByPage.set(page, (idsByPage.get(page) ?? new Set()).add(id))
    }
    const drawnPricing = pricingAnchor && idsByPage.get(pricingAnchor.page)?.has(pricingAnchor.id) ? pricingAnchor : null
    for (const [key, sec] of Object.entries(sections)) {
      if (!sec.block || !sec.props) continue
      const extra = pageAnchorTargets({ here: key.split('/')[0], idsByPage, routes, pricing: drawnPricing, pricingIds: pricingGuessIds })
      if (Object.keys(extra).length) linkAppRoutes(sec.props, routes, optionalKeys(blockItems().get(sec.block)?.source ?? ''), extra)
    }
  }
  blockers.push(...undrawnRequiredBlockers(sitemap, sections, blockers, merged)) // C70 — 그리지 않은 필수 섹션을 숨기지 않는다

  // 3. 법정 쪽 초안(07-qa/legal — 있으면 그것을 쓴다: 법률 에이전트·사람이 다듬은 글)
  const legalDir = join(candDir, '07-qa', 'legal')
  // 스키마 검사가 버리는 브리프 사실(facts — 무료 체험 등)·법정 사실(legal)도 초안은 읽는다(유료·체험 조항 조건). site.json 에는 싣지 않는다.
  // 고른 블록이 스스로 하는 일은 사실로 옮긴다(콘텐츠가 따로 적은 legal 이 이긴다): 가입 블록(sign-up-consents)은 선택 마케팅 동의 4채널을 받고
  // 나이 확인 칸(copy.ageOver14)이 있으면 만 14세 이상만 가입시킨다. 동의 설정 창(consent-preference-dialog)은 이용 통계 자동 수집의 동의를 받는다.
  const blockOf = (re) => Object.values(sections).find((s) => re.test(s.block ?? ''))
  const signupBlock = blockOf(/sign-up-consents$/)
  // 동의 블록(쿠키 설정 창·하단 띠·지도 자리 안내)이 실제로 묻는 쿠키 항목이 처리방침의 자동 수집 항목이다(P4CON 수정 5 — 화면에 마케팅 쿠키 스위치가 있는데 방침은 이용 통계만 적던 어긋남).
  const cookieCategories = cookieCategoriesOf(sections, content, locale)
  const legalFromBlocks = {
    ...(signupBlock ? { marketingConsent: true, marketingChannels: locale === 'ko' ? ['이메일', '문자', '카카오톡', '앱 푸시'] : ['email', 'SMS', 'Kakao', 'push'], ...(signupBlock.props?.copy?.ageOver14 ? { ageGate: 14 } : {}) } : {}),
    ...(cookieCategories.length ? { autoCollect: true, cookieCategories } : {}),
  }
  const legalFacts = { ...legalFromBlocks, ...(isObj(rawContent.legal) ? rawContent.legal : {}) }
  // 철회 정책(P4CON 수정 4): full 이면 결제 블록의 철회 제한 고지·필수 체크를 뺀다 — 환불·철회 쪽 글(legal.withdrawalPolicy)과 같은 사실 하나가 둘을 정한다.
  // 정해지지 않았는데 결제 화면이 고지를 그리면 그 사실이 비어 있는 것이다(「확인 필요」).
  const withdrawalStripped = applyWithdrawalPolicy(sections, legalFacts.withdrawalPolicy)
  if (!['full', 'limited'].includes(legalFacts.withdrawalPolicy) && sectionsWithWithdrawalNotice(sections).length) blockers.push(`${BLOCKER.fact}legal.withdrawalPolicy`)
  const legalBusiness = legalBusinessOf(content, rawContent.facts)
  const draftInput = { ...content, ...(legalBusiness && !content.business ? { business: legalBusiness } : {}), ...(isObj(rawContent.facts) ? { facts: rawContent.facts } : {}), ...(Object.keys(legalFacts).length ? { legal: legalFacts } : {}) }
  const drafts = draftLegalPages(draftInput, archetype, locale)
  // 초안 낡음(C122·C114): 초안은 만든 때의 입력 사실 해시(inputHash — 초안이 읽는 콘텐츠 객체 전체 + 원형 법정 칸 + 언어)를 적어 둔다. 기존 초안의 해시가 다르면 사실이 바뀐 것이다.
  const draftHash = inputHash({ input: draftInput, legal: archetype.legal, locale })
  const legal = {}
  const legalMissing = new Set() // 초안이 빈 사실로 읽은 자리(법정 페이지에 「확인 필요」로 보인다)
  const staleDrafts = [] // 사실이 바뀌었는데 검토본이라 덮지 못한 초안(쪽 이름)
  for (const name of archetype.legal.pages) {
    const file = join(legalDir, `${name}.draft.json`)
    const reviewFile = join(legalDir, `${name}.review.json`)
    const reviewText = existsSync(reviewFile) ? readFileSync(reviewFile, 'utf8') : null
    const realReview = reviewText !== null && !isPendingReview(reviewText) // 07-qa 가 남긴 「검토 전」 자리 파일은 검토가 아니다
    const fresh = { ...drafts[name], inputHash: draftHash }
    let d = existsSync(file) ? readJson(file) : null
    // 해시가 있으면 같아야 낡지 않다. 해시 없는 옛 파일은 지금 사실로 만든 초안과 글이 같을 때만 낡지 않은 것으로 본다.
    const stale = d !== null && (typeof d.inputHash === 'string' ? d.inputHash !== draftHash : d.markdown !== fresh.markdown)
    if (d === null || (stale && !realReview)) {
      if (d !== null && reviewText !== null) rmSync(reviewFile) // 자리 파일은 옛 초안의 조항 목록 — 새 초안과 어긋난다(07-qa 가 다시 채운다)
      writeAtomic(file, JSON.stringify(fresh, null, 2) + '\n')
      d = fresh
    } else if (stale) staleDrafts.push(name) // 검토본 초안은 덮지 않는다 — 공개 불가 사유로 남긴다
    else if (typeof d.inputHash !== 'string') {
      // 해시 없는 옛 초안인데 지금 사실의 초안과 글이 같다(낡지 않았다) — 해시만 더해 둔다(C357). 안 그러면 다음에 사실이 바뀔 때도 글 비교만 하게 되고,
      // 글에 안 드러나는 입력(원형 법정 칸·언어)이 바뀐 것은 못 본다. 다른 칸(조항·검토본)은 건드리지 않는다.
      d = { ...d, inputHash: draftHash }
      writeAtomic(file, JSON.stringify(d, null, 2) + '\n')
    }
    let reviewed = false
    if (existsSync(reviewFile)) { try { const r = readJson(reviewFile); const rows = Array.isArray(r) ? r : r.clauses ?? []; reviewed = rows.length > 0 && rows.every((c) => c.verdict === 'ok') && !(Array.isArray(r.proposedClauses) && r.proposedClauses.length > 0) } catch { reviewed = false } }
    if (staleDrafts.includes(name)) reviewed = false // 사실이 바뀐 뒤의 검토는 지금 사실의 검토가 아니다 — 쪽의 「초안」 안내를 걷지 않는다
    for (const c of d.clauses) for (const m of c.missing ?? []) legalMissing.add(m)
    legal[name] = { title: d.markdown.match(/^# (.+)$/m)?.[1] ?? pageLabel(name, locale), draft: !reviewed, clauses: d.clauses.map((c) => ({ title: c.title, text: c.text })) }
  }

  if (staleDrafts.length) blockers.push(`${BLOCKER.legalStale}${staleDrafts.join('·')} — 검토한 법정 초안의 입력 사실이 지금 콘텐츠와 다르다(초안을 다시 쓰고 법률 검토를 다시 한다)`)

  // 4. 쪽 메타(제목·설명·종류) — 값은 콘텐츠 ref
  const heroTitleOf = (route) => {
    for (const l of rendered[route].titleLeaves ?? rendered[route].leaves) {
      if (/^block-content-/.test(l.block)) continue // 본문 섹션의 머리는 UI 이름표(「연혁」)라 쪽 제목이 아니다 — 쪽 제목은 contentTitleRef·쪽 이름표
      const t = sections[l.key].props?.copy?.title
      if (typeof t === 'string' || (isObj(t) && t.$ref)) {
        // 쪽 제목 두 번(FINAL-WF3): 히어로가 없는 쪽은 셸이 쪽 제목 h1 을 그리고 이 블록이 같은 제목을 h2 로 또 그렸다 — 블록 머리를 BlockHeading 으로 그리는 블록이면
        // 이 블록의 잎이 머리를 h1 로 그리고(PageHeading level=1) 셸은 자기 h1 을 끈다. BlockHeading 이 아닌 제 머리를 가진 블록은 예전 그대로(셸 h1 + 블록 h2).
        if (!l.hero && !rendered[route].leaves.some((x) => x.hero) && blockTraits(blockItems().get(l.block)).heading) l.h1 = true
        return t
      }
    }
    return null
  }
  const descRefOld = (() => {
    for (const p of sitemap.pages) for (const s of p.sections) for (const id of ['subhead', 'lede', 'tagline', 'headline']) {
      const i = copyIndex.get(`${p.id}/${s.kind}/${id}#0`)
      if (i !== undefined && !isNeedsCheck(rawContent.slots.copy[i].text)) return ref(`slots.copy.${i}.text`)
    }
    return null
  })()
  // 쪽 설명(FINAL-WF2 AB4·AB8): 쪽마다 그 쪽의 부제·본문 문단에서 만든다(160자 안이면 문구 $ref, 넘으면 문장 끝에서 자른 글). 문구 칸이 없으면 히어로 제목, 법정 쪽은 첫 조항 문장.
  const pageSlotEntries = (pageId) => [...copyIndex].filter(([k]) => k.startsWith(`${pageId}/`)).map(([k, i]) => ({ id: k.slice(k.indexOf('/', k.indexOf('/') + 1) + 1).replace(/#\d+$/, ''), text: rawContent.slots.copy[i]?.text, index: i }))
  const describePage = (page) => {
    const hit = pickDescriptionSlot(pageSlotEntries(page.id))
    if (hit) return cutDescription(hit.text) === hit.text.replace(/\s+/g, ' ').trim() ? ref(`slots.copy.${hit.index}.text`) : cutDescription(hit.text)
    if (page.legal) {
      const c = legal[page.id]?.clauses?.find((x) => typeof x.text === 'string' && x.text.trim() && !Object.values(PLACEHOLDER).some((ph) => x.text.includes(ph)))
      return c ? cutDescription(c.text) : null
    }
    // 영어 사이트(FINAL-WF4 EN11): 문구 칸이 없는 앱 화면 쪽(account·billing·cancel)의 설명이 제목과 같은 한 낱말(「Billing」)이던 길 — 그 쪽 첫 블록의 한 줄 설명(copy.lead)이 있으면 그것을 쓴다.
    if (locale === 'en' && rendered[page.route]) {
      for (const l of rendered[page.route].leaves) {
        const lead = sections[l.key]?.props?.copy?.lead
        if (typeof lead === 'string' && lead.trim() && !/^block-content-/.test(l.block)) return lead.trim()
      }
    }
    return rendered[page.route] ? heroTitleOf(page.route) : null
  }
  const homePage = sitemap.pages.find((p) => p.route === '/')
  const descRef = descRefOld ?? (homePage ? describePage(homePage) : null)
  const siteDescriptionOk = typeof content.site?.description === 'string' && content.site.description.trim() !== '' && !isNeedsCheck(content.site.description)
  const pages = {}
  for (const page of sitemap.pages) {
    const r = rendered[page.route]
    const hero = !!r && r.leaves.filter((l) => l.hero).length
    const own = page.route === '/' ? null : describePage(page)
    pages[page.route] = {
      id: page.id, type: PAGE_KIND[page.id] ?? 'other', hero: hero === 1,
      // JSON-LD 가격(Offer)은 그 쪽 화면에 가격 블록(요금제·상품 요약)이 그려질 때만 싣는다(X4 — 홈에 요금표가 없는데 Offer 만 있으면 marketing jsonld-visible 이 떨어진다)
      showsPrice: !!r && r.leaves.some((l) => PRICE_BLOCK.test(l.block)),
      title: page.legal ? legal[page.id].title : (heroTitleOf(page.route) ?? contentTitleRef(page) ?? pageLabel(page.id, locale)),
      ...(NOINDEX.has(page.id) || emptyPages.has(page.id) ? { noindex: true } : {}),
      ...(page.legal ? { legal: true } : {}),
      ...(own ? { description: own } : {}),
    }
    pageMeta[page.route] = { heroLeaves: hero || 0, h1Leaves: r ? r.leaves.filter((l) => l.h1).length : 0 }
  }
  const home = pages['/']
  if (home && descRef && !siteDescriptionOk) home.description = descRef

  // 5. site.json — 콘텐츠 + site + 섹션 + 쪽 + 법정 초안 + 셸
  const siteBase = { url: siteUrl, locale, ...(isObj(content.site) ? content.site : {}) }
  const siteDefaulted = !isObj(content.site) || !content.site.url
  const siteObj = { ...siteBase }
  if (!siteDescriptionOk) { delete siteObj.description; if (descRef) siteObj.description = descRef } // 「확인 필요」 설명은 없는 것과 같다 — 히어로·본문 문장으로 대체한다(AB4)
  const action = toward(ctaTarget(), null) // 머리글은 모든 쪽에 있다 — 앵커 행선지는 늘 경로까지 적는다(/#폼-id)
  // 머리글 행동 버튼 글자는 짧을 때만 쓴다 — primaryCta 는 「02-1234-5678로 전화해 상담 예약하기」처럼 길 수 있고, 375px 한 줄 머리글에 그대로 넣으면 가로 스크롤이 생긴다(P3-3 Task 14b 골든 local-ko-ltc ux-gate 375 hScroll 50px). 길면 머리글 행동은 없고 히어로·하단 바가 그 행동을 맡는다
  const ctaSlot = (() => { for (const p of sitemap.pages) for (const s of p.sections) { const i = copyIndex.get(`${p.id}/${s.kind}/primaryCta#0`); if (i !== undefined && usableText(rawContent.slots.copy[i].text) && [...String(rawContent.slots.copy[i].text)].length <= SHELL_ACTION_MAX) return ref(`slots.copy.${i}.text`) } return null })()
  const siteJson = {
    ...content,
    archetype: sitemap.archetype, locale,
    site: siteObj,
    sections, pages, legal,
    // 머리글 행동은 글이 「확인 필요」가 아니고 가는 곳이 비지 않았을 때만 둔다(FIT-7, W1b C4) — 전화번호가 비면 「확인 필요」 글에 # 링크인 버튼이 머리글에 나갔다
    shell: { brand: brandRef, nav: navLinks(), action: ctaSlot && !refTargetMissing(content, action.href) ? { label: ctaSlot, href: action.href } : headerContactActionOf(content, locale) },
  }
  delete siteJson.media
  if (factsRestored) delete siteJson.facts
  const policyLinks = ownPolicyLinks(siteJson.business, sitemap)
  if (policyLinks.bound.length) siteJson.business = policyLinks.business
  // 법정 쪽은 푸터에만(FINAL-WF2 AB17): 푸터가 이미 그 쪽으로 가는 링크를 그리면 머리글 메뉴에서 뺀다 — 푸터가 안 그리면(링크 없는 푸터·푸터 없음) 법정 쪽이 고아가 되므로 메뉴에 둔다.
  {
    let footerHrefs = new Set()
    try { footerHrefs = new Set(leaves(resolveRefs(sections['global/footer']?.props ?? {}, siteJson)).filter((l) => /(?:^|\.)href$/.test(l.path) && typeof l.value === 'string').map((l) => l.value)) } catch { /* 못 푸는 ref 는 아래 검사가 이미 사유로 낸다 */ }
    const legalRoutes = new Set(sitemap.pages.filter((p) => p.legal).map((p) => p.route))
    siteJson.shell.nav = siteJson.shell.nav.filter((l) => !(legalRoutes.has(l.href) && footerHrefs.has(l.href)))
  }

  // 6. 공개 불가 사유
  const referencedCopy = new Set([...JSON.stringify(siteJson).matchAll(/"\$ref":"slots\.copy\.(\d+)\./g)].map((m) => Number(m[1])))
  // 주 행동 문구 칸(primaryCta)은 화면에서 빠졌어도(갈 곳 없는 버튼을 그리지 않았다, FIT-7) 비어 있다는 사실은 남는다 — 번호가 채워지면 04 가 이 글을 다시 써야 하므로 입력 대기 사유로 계속 센다
  arr0(rawContent.slots?.copy).forEach((c, i) => { if (c?.id === 'primaryCta') referencedCopy.add(i) })
  for (const p of placeholderPaths(rawContent, request, referencedCopy)) if (!policyLinks.bound.includes(p)) blockers.push(`${BLOCKER.fact}${p}`)
  { const biz = businessInfoBlocker(content, sections, sitemap.archetype); if (biz) blockers.push(biz) }
  for (const m of [...legalMissing].sort()) blockers.push(`${BLOCKER.fact}${m}`)
  if (siteDefaulted) blockers.push(BLOCKER.site)
  for (const p of reservedContactPaths(rawContent)) blockers.push(`${BLOCKER.reserved}${p}`)
  // 미디어(C113): 05-media manifest 의 자산을 히어로 media props 로 잇는다. 자리 표시(실제 사진 필요·이미지 준비 중)는 media 를 비우고 공개 불가로 남긴다.
  const media = readOptionalMedia(candDir)
  const wiredAssets = []
  if (media) {
    for (const ph of media.placeholders ?? []) blockers.push(`${BLOCKER.photo}${ph.slot}${ph.reason === 'generate-pending' || ph.reason === 'render-pending' || ph.reason === 'stock-pending' ? ' (이미지 준비 중)' : ''}`)
    const mediaRecipe = mediaRecipeOf(cand)
    for (const [key, sec] of Object.entries(sections)) {
      const [pid, kind] = key.split('/')
      const spec = archetype.pages.find((pg) => pg.id === pid)?.sections.find((x) => x.kind === kind)
      const optional = optionalKeys(blockItems().get(sec.block).source)
      // 보드 미리보기 전용(WF_MEDIA_PREVIEW=1)만 previewOnly 자산을 잇는다 — 이어도 placeholders 의 「공개 불가 — 실제 사진 필요」 blocker 는 그대로이고 슬롯에 previewLabel 이 붙는다(site-media.mjs wireMedia).
      const asset = wireMedia({ props: sec.props, sectionKey: key, imageSlots: spec?.imageSlots, assets: media.assets ?? [], recipeId: mediaRecipe, contentMedia: rawContent.media ?? {}, hasMediaProp: optional.has('media'), hasStillsProp: optional.has('stills'), hasModelProp: optional.has('model'), allowPreview: process.env.WF_MEDIA_PREVIEW === '1', placeholders: media.placeholders ?? [], locale })
      if (asset) wiredAssets.push(...[].concat(asset))
    }
  }

  // 7. 파일 쓰기(+ 설치)
  const siteDir = join(candDir, 'site')
  let installLog = null
  if (install) {
    const cache = await ensureTemplateCache()
    prepareSiteDir(siteDir, cache)
  } else {
    if (existsSync(siteDir)) for (const e of readdirSync(siteDir)) if (e !== 'node_modules') rmSync(join(siteDir, e), { recursive: true, force: true })
    mkdirSync(siteDir, { recursive: true })
    // 정적 검사용: 템플릿 파일만(node_modules 없이)
    robocopy(TEMPLATE, siteDir, { exclude: ['node_modules'] })
  }
  writeAtomic(join(siteDir, 'content', 'site.json'), JSON.stringify(siteJson, null, 2) + '\n')
  const mediaFiles = wiredAssets.length ? copyMediaFiles(join(candDir, '05-media'), siteDir, wiredAssets) : []
  // 공유 그림·파비콘 색은 레시피에서(C115) — 기본 테마 쪽 색을 lib/build.json 에 두고 app/opengraph-image.tsx 가 읽는다
  const head = recipeHeadOf(cand)
  const colors = recipeColors(head)
  const brandText = resolveRefs(siteJson.shell.brand, siteJson)
  // locale·brand: error·global-error(클라이언트 번들)가 site.json 을 끌어오지 않고 읽는 작은 값(P3-4 perf, C172)
  // 영어 사이트에서 가입 블록이 나이 동의 칸을 안 그리면 목 인증 포트(lib/ports.ts)도 14세 확인을 요구하지 않는다(요구하면 가입이 늘 거절된다) — 한국어 사이트는 칸을 싣지 않아 그대로(FINAL-WF4 EN11)
  const noAgeGate = locale === 'en' && Object.values(sections).some((x) => /sign-up-consents$/.test(x.block ?? '')) && !Object.values(sections).some((x) => x.props?.copy?.ageOver14 !== undefined)
  writeAtomic(join(siteDir, 'lib', 'build.json'), JSON.stringify({ recipeId, theme: colors.theme, og: colors.og, locale, brand: typeof brandText === 'string' ? brandText : '', ...(noAgeGate ? { requireAgeOver14: false } : {}) }, null, 2) + '\n')
  const favicons = await writeFavicons(siteDir, head, typeof brandText === 'string' ? brandText : '', { logoPath: head.brand?.logo, baseDir: candDir })
  for (const l of leafFiles.values()) writeAtomic(join(siteDir, 'components', 'site', `${l.file}.tsx`), l.render ? l.render({ name: l.name, block: blockItems().get(l.block), recipeId }) : leafSource({ name: l.name, block: l.block, recipeId, h1: !!l.h1 }))
  // 앱 전체 상태 화면(dashboard): 템플릿의 loading(없음)·error·not-found 를 state-screen 블록을 끼운 것으로 바꾼다. 다른 원형은 shellPlan.appFiles 가 비어 템플릿 그대로다.
  for (const [rel, src] of Object.entries(shellPlan.appFiles)) writeAtomic(join(siteDir, ...rel.split('/')), src)
  const routesOut = []
  for (const page of sitemap.pages) {
    const r = rendered[page.route]
    const src = pageSource({
      route: page.route, leaves: r?.leaves ?? [], hero: pageMeta[page.route].heroLeaves === 1, legal: page.legal ? page.id : null,
      footer, bar: r && !r.leaves.some((l) => /^block-bottom-tab-/.test(l.block)) ? bar : null, // 고정 하단 줄은 쪽마다 하나 — 쪽이 제 예약 줄을 그리면 전역 줄을 또 얹지 않는다(겹쳐 서로의 초점을 가린다)
      shell: shellLeaf,
    })
    writeAtomic(join(siteDir, routeFile(page.route)), src)
    routesOut.push(page.route)
  }

  // 8. JSON-LD·메타를 노드에서 만들어 본다 — 빈 사실(X4)에서 던지거나 자리 표시 글자가 남으면 공개 불가
  const seoCheck = await checkSeo(siteJson, sitemap)
  blockers.push(...seoCheck.map((m) => `${BLOCKER.jsonld}${m}`))
  blockers.push(...(await metaPlaceholderProblems(siteJson)).map((m) => `${BLOCKER.metaPlaceholder}${m}`))

  const all = dedupe(blockers)
  writeSiteBlockers(runDir, cand.id, all)

  // 수정(09-revise)으로 고른 블록이 위 폴백으로 바뀌었으면 조용히 두지 않는다 — 고른 사람이 모르게 다른 디자인이 나가는 길을 막는다(FIT-5)
  const reviseDropped = reviseFallbacks(candDir, fallbacks)
  for (const d of reviseDropped) log(`경고: ${d.line}`)

  const result = { siteDir, routes: routesOut, blockers: all, sections: Object.keys(sections), skipped, recipeId, strict, pageMeta, favicons, mediaFiles, fallbacks, titleOverflow, reviseFallbacks: reviseDropped, dropped: droppedByKey, withdrawalStripped, cookieCategories }
  if (install) {
    const r0 = await ensureRepoRegistry()
    const buildDirs = [r0]
    if (compiled.outRoot) buildDirs.push(await buildCandidateRegistry(compiled.registryDir, join(candDir, 'build', 'r')))
    const reg = makeLocalRegistry(buildDirs, join(candDir, 'localreg'))
    result.localRegistry = reg
    const names = installNames({ archetype: sitemap.archetype, recipeId, blocks: dedupe(Object.values(sections).map((s) => s.block)) })
    installLog = join(candDir, 'add.log')
    const added = await addItems(siteDir, names, installLog)
    result.add = added
    if (added.code !== 0) throw new Error(failMessage('shadcn add', added.code, installLog))
    // 영어 사이트(FINAL-WF4 EN7): 한글 제목체(displayKo)의 키트 @import(네이버 CDN 등)는 영어 글자를 그리지 않는다 — 줄만 뺀다. 한국어 사이트는 그대로.
    result.koreanKitImports = dropKoreanKitImports(siteDir, head, locale)
    // 글꼴: next/font/google 의 한글 조각 90~190개 × 서체를 사이트 글자만 든 파일로 바꾼다(P3-4 perf, C173) — 실패한 서체는 원래 로더 그대로. STAMP_SITE_FONTS=0 이면 건너뛴다.
    if (process.env.STAMP_SITE_FONTS !== '0') result.fonts = await subsetSiteFonts(siteDir, { weightsFor: (family) => recipeWeightsFor(head, family), log })
    // 대체 글꼴 면(C384): 웹폰트가 바뀔 때 글줄이 밀리지 않게 「<서체> Fallback」 에 크기·줄 메트릭을 단다 — 구글 서체(위에서 받은 woff2)와 Pretendard(css @import) 모두. 못 읽는 서체는 건너뛴다.
    result.fallbackFaces = await addFallbackFaces(siteDir)
    for (const s of result.fallbackFaces.skipped) log(`대체 글꼴 면 ${s.family}: 건너뜀 — ${s.reason}`)
    if (build) {
      const b = await nextBuild(siteDir, join(candDir, 'build.log'))
      result.build = { ...b, bytes: dirBytes(join(siteDir, '.next')) }
      log(`next build 종료 ${b.code} (${b.seconds}초)`)
      // 링크 대상 검사(FINAL-WF2 AB1·AB3·AB15): 빌드한 HTML 의 내부 링크가 사이트의 실제 경로·id 에 닿는지 본다 — 안 닿으면 공개 불가(품질).
      if (b.code === 0) {
        const dead = findDeadLinks({ routes: routesOut, pages: readBuiltPages(siteDir, routesOut) })
        result.deadLinks = dead
        if (dead.length) { all.push(`${BLOCKER.deadLink}${deadLinkSummary(dead)}`); writeSiteBlockers(runDir, cand.id, all); log(`링크 검사: 닿지 않는 링크 ${dead.length}곳`) }
      }
    }
  }
  return result
}

/** 설치할 항목: 레시피 base(부품 전부) + 쓰는 블록 + 조립 코드가 부르는 계약·콘텐츠·AX·모션·전화 항목. */
export function installNames({ archetype, recipeId, blocks }) {
  return dedupe([recipeId, ...blocks, ...SITE_FILE_ITEMS, 'attribution', 'adapter-mock', 'adapter-static', 'content-core', `content-${archetype}`, 'content-to-jsonld', 'seo-meta', 'geo-entity', 'json-ld', 'phone', 'motion-gsap', 'utils'])
}

function readOptionalMedia(candDir) {
  const f = join(candDir, '05-media', 'manifest.json')
  return existsSync(f) ? readJson(f) : null
}

/** 메타 설명·OG 설명·트위터 설명에 자리표시(「확인 필요」/"To be confirmed")가 남은 쪽 → 문제 문자열[] (FINAL-WF2 AB4). 한 쪽 = 한 줄. */
export async function metaPlaceholderProblems(siteJson) {
  const { sections: _s, pages: _p, legal: _l, shell: _h, ...content } = siteJson
  void _s; void _l; void _h
  const c = { ...content, site: resolveRefs(siteJson.site, siteJson) }
  const meta = await loadTs(join(FACTORY, 'ax', 'seo-meta.ts'))
  const out = []
  for (const route of Object.keys(_p)) {
    const p = _p[route]
    const page = { path: route, type: p.type, title: typeof p.title === 'string' ? p.title : resolveRefs(p.title, siteJson), description: p.description ? resolveRefs(p.description, siteJson) : undefined, noindex: p.noindex, showsPrice: p.showsPrice }
    let m
    try { m = meta.seoMetadata(c, page) } catch { continue } // 던지는 쪽은 checkSeo 가 이미 사유로 낸다
    const texts = [m.description, m.openGraph?.description, m.twitter?.description].filter((t) => typeof t === 'string')
    if (!texts.length || texts.some((t) => !t.trim() || Object.values(PLACEHOLDER).some((ph) => t.includes(ph)))) out.push(`${route} — 메타·OG 설명이 ${texts.some((t) => t.trim()) ? '「확인 필요」 자리표시' : '비었다'}`)
  }
  return out
}

/** seoMetadata·jsonLdFor 를 노드에서 돌려 본다 → 문제 문자열[]. */
export async function checkSeo(siteJson, sitemap) {
  const problems = []
  const { sections: _s, pages: _p, legal: _l, shell: _h, ...content } = siteJson
  void _s; void _l; void _h
  const site = resolveRefs(siteJson.site, siteJson)
  const c = { ...content, site }
  const geo = await loadTs(join(FACTORY, 'ax', 'geo-entity.ts'))
  const meta = await loadTs(join(FACTORY, 'ax', 'seo-meta.ts'))
  for (const route of Object.keys(_p)) {
    const p = _p[route]
    const page = { path: route, type: p.type, title: typeof p.title === 'string' ? p.title : resolveRefs(p.title, siteJson), description: p.description ? resolveRefs(p.description, siteJson) : undefined, noindex: p.noindex, showsPrice: p.showsPrice }
    try {
      const ld = geo.jsonLdFor(c, page)
      const text = JSON.stringify(ld)
      for (const ph of Object.values(PLACEHOLDER)) if (text.includes(ph)) problems.push(`${route} JSON-LD 에 「${ph}」가 남았다`)
    } catch (e) {
      problems.push(`${route}: ${e.message}`)
    }
    try { meta.seoMetadata(c, page) } catch (e) { problems.push(`${route} 메타: ${e.message}`) }
  }
  void sitemap
  return problems
}

// CLI: node factory/stamp/gen-pages.mjs <runDir> <candId> [--no-install]
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [runDir, candId, ...flags] = process.argv.slice(2)
  if (!runDir || !candId) { console.error('사용법: node factory/stamp/gen-pages.mjs <runDir> <candId> [--no-install] [--build]'); process.exit(2) }
  const cand = readJson(join(runDir, candId, '01-direction.json'))
  const r = await generateSite(runDir, cand.data ?? cand, { install: !flags.includes('--no-install'), build: flags.includes('--build'), log: console.error })
  console.log(JSON.stringify({ siteDir: r.siteDir, routes: r.routes, blockers: r.blockers.length, skipped: r.skipped.length, build: r.build }, null, 2))
  process.exit(r.build && r.build.code !== 0 ? 1 : 0)
}
