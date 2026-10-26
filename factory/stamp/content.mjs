// 04-content — 문구 요청 파일을 만들고, 돌아온 콘텐츠를 검사한다(P3-3 Task 7, 접합면 J2·J7·J12).
//   스크립트는 LLM 을 부르지 않는다. 사람(문구 에이전트)이 factory/stamp/COPY.md 대로 04-content.json 을 쓰고, 이 파일이 그 결과를 검사한다.
//   contentRequest(cand, sitemap, variants, seed, { archetype, brief })  → 04-content.request.json 모양(순수)
//   validateContent(request, content[, { schema }])                      → 문제 문자열[] (빈 배열이 통과)
//   runContentStage(run, cand, sitemap, variants, seed, { archetype, brief }) → { status: needs-copy|stale|invalid|ok, … }  (J7 단계 파일)
//
// 사실 규칙(§9 Q8·J12): 브리프에 없는 사실은 지어내지 않는다. 사실이 비면 그 자리는 정확히 「확인 필요」(ko) / "To be confirmed"(en) 이다.
//   · 콘텐츠 스키마의 Phone·bizRegNo 는 자리 표시 글자를 못 받는다. 그래서 스키마 검사는 「빈 사실 자리」의 오류만 건너뛴다(그 자리는
//     아래 자리 표시 규칙이 따로 본다). 그 밖의 스키마 오류는 그대로 낸다.
//   · 지어낸 사실 검사는 콘텐츠의 모든 글자에서 전화·사업자번호·가격·주소·메일을 정규식으로 찾아 브리프 사실과 대조한다.
// 문체·금지어(ko: 해요체 + DESIGN §9·§14-C, en: kill-ai-slop 문구 규칙 + no-ai-slop 금지어 + stop-slop 군더더기)는 아래 RULES 가 정본이다.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BriefSchema, briefToSeed, factPath, SCHEMA_BUSINESS_ROOT } from './brief.mjs'
import { inputHash } from './run-dir.mjs'
import { PLACEHOLDER } from '../legal/drafts.mjs'
import { checkStructure, emptyStructureHomes, isPlaceholderHref, STRUCTURE_RULE, structureSlots } from './content-structure.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'registry', 'factory')
export { PLACEHOLDER }

// ── 사실 이름 ────────────────────────────────────────────────────────────
// 브리프 facts 는 자유 키지만, 문구 에이전트와 사이트맵(sitemap.mjs SECTION_FACTS)이 아는 이름은 여기 있는 것뿐이다(대장 C91).
// 테스트가 SECTION_FACTS·SLOT_FACTS·REQUIRED_FACTS 의 이름이 전부 이 목록 안에 있는지 본다 — 이름을 더하면 여기부터 고친다.
export const FACT_NAMES = [
  // 사업자·연락처(brief.mjs BUSINESS_FIELDS)
  'name', 'legalName', 'representative', 'bizNo', 'mailOrderNo', 'address', 'phone', 'email',
  // 원형 필수(brief.mjs REQUIRED_FACTS)
  'hours', 'price', 'seller',
  // 선택 섹션을 여는 이름(sitemap.mjs SECTION_FACTS 의 별칭)
  'reviews', 'testimonials', 'clients', 'awards', 'recognition', 'branches', 'branchList', 'notice', 'announcement',
  'bestsellers', 'products', 'newArrivals', 'curated', 'productLineup', 'brandStory', 'story', 'shipping', 'pickup',
  'metrics', 'charts', 'breakdown', 'usageLimit', 'quota', 'trial', 'trialDays', 'steps', 'howItWorks',
  'externalReviews', 'reviewLinks',
  // 본문 섹션 렌더러가 읽는 구조 자료(content-structure.mjs STRUCTURE_FACTS — 대장 C297)
  'refresh', 'refreshInterval', 'primaryActionUrl', 'tableColumns', 'tableRows', 'homeItems', 'detailBody', 'resultBody', 'guide', 'faq', 'compare', 'news', 'history', 'leaders', 'leadership', 'reports', 'sustainability', 'careersUrl', 'careers', 'quickLinks', 'notices', 'policyCards', 'works', 'caseStudies',
  // 문구 칸이 쓰는 이름(SLOT_FACTS)
  'booking', 'bookingUrl', 'menu', 'items', 'departments', 'doctors', 'transit', 'parking', 'rating', 'returns',
  'origin', 'escrow', 'productInfo', 'specs', 'founded', 'scale', 'claim', 'changelog', 'releases', 'plans',
  // 스키마가 요구하는 주소·경로 칸을 채우는 이름(SCHEMA_FACTS)
  'naverMapUrl', 'kakaoMapUrl', 'productUrl',
  'companyUrl', 'ftcLookupUrl', 'termsUrl', 'privacyUrl', 'phoneNote', 'copyright', 'accessibilityPolicyUrl', 'bookableSlots', 'integrations',
  'shippingFee', 'returnsFeePayer', 'courier', 'noticeCategory', 'noticeRows',
  // 행사형 랜딩(C416) — brief.mjs EVENT_FACTS, 콘텐츠 landing.event 가 채운다
  'eventDate', 'eventVenue',
]

// 스키마가 필수로 요구하는데 브리프 사실 이름이 따로 없는 자리(P3-3 Task 14 골든 — 문구 에이전트 6명이 모두 여기서 막히거나 값을 지어냈다).
//   이름 → { path: 값이 들어갈 경로(자리 표시를 적는 자리), from: 이 자리를 채울 수 있는 사실 이름 }.
//   from 사실이 하나도 없으면 그 이름이 요청의 missing·factPaths 에 오른다 — 에이전트는 그 자리에 정확히 자리 표시를 적고, 화면은 링크 없음으로 그리며,
//   06 이 「공개 불가 — 확인 필요 사실」 blocker 를 남긴다. business.* 는 표에 없어도 스키마를 돌려 빠진 칸을 찾아 올린다(schemaMissing).
// 스키마가 구조·숫자로만 요구하고 브리프 필수 사실 목록(REQUIRED_FACTS)에는 없는 사실 — 없으면 missing 에 오른다(자리 표시는 facts.<이름>).
export const STRUCTURAL_REQUIRED = { detail: ['shipping', 'returns'] }
export const SCHEMA_FACTS = {
  local: {
    booking: { path: ['booking', 'primary', 'value'], from: ['phone', 'booking', 'bookingUrl'] },
    'mapLinks.naver': { path: ['mapLinks', 'naver'], from: ['naverMapUrl'] },
    'mapLinks.kakao': { path: ['mapLinks', 'kakao'], from: ['kakaoMapUrl'] },
    'directions.transit': { path: ['directions', 'transit'], from: ['transit'] },
    'directions.parking': { path: ['directions', 'parking'], from: ['parking'] },
  },
  saas: {
    'product.url': { path: ['product', 'url'], from: ['productUrl'] },
  },
  // brand·commerce·public(P4GR 골든 실측 — 문구 에이전트가 필수인데 요청에 없는 칸에서 막히거나 값을 정했다). 전부 자리 표시를 받는 글자 칸이다 —
  //   Url 은 isNeedsCheck 를 받고(public 의 HREF 칸은 못 받아 검사가 그 칸의 형식 오류만 건너뛴다). 숫자·열거형 칸(commerce shipping.fee·leadDays, public decision)은 사실 이름이 없다.
  brand: {
    'organization.url': { path: ['organization', 'url'], from: ['companyUrl'] },
  },
  commerce: {
    'business.ftcLookupUrl': { path: ['business', 'ftcLookupUrl'], from: ['ftcLookupUrl'] },
    'business.termsUrl': { path: ['business', 'termsUrl'], from: ['termsUrl'] },
    'business.privacyUrl': { path: ['business', 'privacyUrl'], from: ['privacyUrl'] },
    'shipping.courier': { path: ['shipping', 'courier'], from: ['courier'] },
  },
  public: {
    'agency.phoneNote': { path: ['agency', 'phoneNote'], from: ['phoneNote'] },
    'agency.accessibilityPolicyUrl': { path: ['agency', 'accessibilityPolicyUrl'], from: ['accessibilityPolicyUrl'] },
    'agency.copyright': { path: ['agency', 'copyright'], from: ['copyright'] },
  },
  // dashboard: 결정 기록의 갱신 주기(decision.refresh — 운영 대시보드 화면 머리가 읽는다, C297). 사실 refresh 가 없으면 자리 표시(열거형 dashboard_type 은 별도 규칙 — COPY.md).
  dashboard: {
    'decision.refresh': { path: ['decision', 'refresh'], from: ['refresh', 'refreshInterval'] },
  },
  // detail: 스키마가 숫자·고정 목록·비지 않은 글자·배열로 요구하는 자리(P3-3 Task 14b·14a — 문구 에이전트가 fee·feePayer·택배사·고시 항목에서 막히거나 지어냈다).
  //   `shipping`·`returns` 사실 글에 값이 들어 있어도 스키마 칸으로 옮기는 값은 별도 사실 이름이 알린다 — 배송비(shippingFee)·반품 배송비 부담(returnsFeePayer: buyer|seller)·택배사(courier)·
  //   고시 품목(noticeCategory)·고시 항목(noticeRows 또는 productInfo·specs·origin)을 주면 그 값을 쓰고, 안 주면 missing 에 올라 그 자리에 자리 표시를 적는다(검사가 그 칸의 스키마 오류만 건너뛴다 — 06 이 「확인 필요 사실」 blocker).
  //   unless: 이 사실이 없으면 그 윗 구조(product.shipping·product.returns)를 통째로 뺀다(FACT_SCHEMA_HOMES) — 이 자리는 없어서 요구하지 않는다.
  detail: {
    'product.shipping.fee': { path: ['product', 'shipping', 'fee'], from: ['shippingFee'], unless: ['shipping'] },
    'product.shipping.courier': { path: ['product', 'shipping', 'courier'], from: ['courier'], unless: ['shipping'] },
    'product.returns.feePayer': { path: ['product', 'returns', 'feePayer'], from: ['returnsFeePayer'], unless: ['returns'] },
    'notice.category': { path: ['notice', 'category'], from: ['noticeCategory'] },
    'notice.rows': { path: ['notice', 'rows', 0, 'value'], from: ['noticeRows', 'productInfo', 'specs', 'origin'] },
  },
}

const BUSINESS_NAME_BY_FIELD = { name: 'name', legalName: 'legalName', representative: 'representative', bizRegNo: 'bizNo', mailOrderNo: 'mailOrderNo', address: 'address', phone: 'phone', email: 'email' }
// public 의 agency 는 Business 가 아니라 이름·주소·대표전화(mainPhone)만 사실 이름이 있다(brief.mjs FACT_PATHS).
const AGENCY_NAME_BY_FIELD = { name: 'name', address: 'address', mainPhone: 'phone' }

/**
 * 스키마가 필수로 요구하는데 브리프 사실이 없는 자리 → { 이름: 경로 }. 이름은 사실 이름(business.* — REQUIRED_FACTS 밖의 address·phone 등)이거나 SCHEMA_FACTS 의 이름이다.
 * 요청 하나가 「missing 에 없는데 스키마는 요구하는 칸」을 갖지 않게 한다 — 그런 칸은 에이전트가 값을 지어내거나 막힌다.
 */
export function schemaMissing(archetype, seedContent, facts, locale) {
  const out = {}
  const has = (names) => names.some((n) => Object.keys(facts).some((k) => norm(k) === norm(n)))
  for (const [name, { path, from, unless }] of Object.entries(SCHEMA_FACTS[archetype] ?? {})) if (!has(from) && !(unless && !has(unless))) out[name] = path
  // 숫자·구조로만 받는 사실(FACT_SCHEMA_HOMES: 가격·배송·반품·영업시간 …)이 없으면 그 이름이 missing 에 오른다 — 자리 표시는 facts.<이름> 에 적고 구조는 뺀다.
  for (const name of STRUCTURAL_REQUIRED[archetype] ?? []) if (!(name in out) && !has([name])) out[name] = factPath(archetype, name)
  const parsed = loadContentSchema(archetype).safeParse({ ...seedContent, archetype, locale })
  const root = SCHEMA_BUSINESS_ROOT[archetype]
  if (root && !parsed.success) for (const issue of parsed.error.issues) {
    if (issue.path[0] !== root) continue
    const name = (archetype === 'public' ? AGENCY_NAME_BY_FIELD : BUSINESS_NAME_BY_FIELD)[issue.path[1]]
    if (name && !has([name])) out[name] = factPath(archetype, name)
  }
  return out
}

// 문구 칸 id → 그 칸을 채우는 사실 이름. 칸 id 는 원형마다 뜻이 다를 수 있어 원형별 표(_ 는 공통)를 나눈다.
// 사실이 하나도 없으면 그 칸은 자리 표시(「확인 필요」)여야 한다. 표에 없는 칸은 사실 칸이 아니라 문구 칸이다(헤드라인·설명 등).
export const SLOT_FACTS = {
  _: {
    price: ['price'], hours: ['hours'], todayHours: ['hours'], address: ['address'], addressLine: ['address'],
    notice: ['notice', 'announcement'], department: ['departments'], doctor: ['doctors'], transit: ['transit'], parking: ['parking'],
    branch: ['branches', 'branchList'], quote: ['testimonials', 'reviews'], // `link` 는 local 외부 후기 링크 칸에만 후기 링크 사실이 필요하다(아래 local) — public 히어로의 「바로가기 1개」 칸은 사실 칸이 아니다(QFIX [1])
    rating: ['reviews'], shipping: ['shipping'], returnsSummary: ['returns', 'shipping'], origin: ['origin'], escrowNotice: ['escrow'],
    rows: ['productInfo', 'specs'], award: ['awards', 'recognition'], email: ['email'], fact: ['founded', 'scale'], claim: ['claim'],
    entryTitle: ['changelog', 'releases'], planName: ['plans', 'price'],
  },
  local: { notice: ['notice', 'notices', 'announcement'], primaryCta: ['phone', 'booking', 'bookingUrl'], item: ['menu', 'items', 'price'], 'external-reviews/link': ['reviews', 'reviewLinks', 'externalReviews'] },
  saas: { claim: ['claim', 'clients'] },
  detail: { name: ['name'] },
  commerce: { name: ['name'], text: ['shipping'] },
  // 본문 섹션 문구 칸(C297): 칸 id 가 다른 섹션과 겹치면(public 히어로도 title) 「섹션/칸」 키로 좁힌다. 연혁·리더십·소식 칸은 구조 칸(content-structure)과 같은 사실에서 온다.
  brand: { entry: ['history'], person: ['leaders', 'leadership'], title: ['news'], headline: ['news'] },
  public: { 'policy-cards/title': ['policyCards'], 'policy-cards/desc': ['policyCards'], 'policy-cards/deadline': ['policyCards'] },
}
export const slotFacts = (archetypeId, slotId, sectionKind) => (sectionKind && SLOT_FACTS[archetypeId]?.[`${sectionKind}/${slotId}`]) || SLOT_FACTS[archetypeId]?.[slotId] || SLOT_FACTS._[slotId] || []

// 사실이 콘텐츠 스키마에서 차지하는 자리(brief.mjs factPath 말고, 스키마가 구조로 받는 자리). 이 자리 아래의 스키마 오류는
// 그 사실이 비었을 때 건너뛴다 — 예: 영업시간이 없으면 hours 배열이 없다.
export const FACT_SCHEMA_HOMES = {
  local: { hours: [['hours']], phone: [['booking']], booking: [['booking']] },
  saas: { price: [['plans']] },
  detail: { price: [['product', 'price'], ['product', 'taxIncluded'], ['product', 'currency']], shipping: [['product', 'shipping']], returns: [['product', 'returns']] },
  // 회사 정보 칸이 없는 원형(factPath 가 facts 에 둔다)의 구조 칸 — 사실이 비면 자리 표시는 facts.<이름> 에 적고 구조 칸의 형식 오류는 건너뛴다(P4GR 골든 실측).
  portfolio: { email: [['contact', 'email']] },
  pwa: { name: [['manifest', 'name'], ['manifest', 'short_name']] },
  // 행사 일시·장소가 비면 event 칸 전체의 형식 오류를 건너뛴다(C416) — 사실이 없는데 지어낸 일시·장소를 두지 않는다
  landing: { eventDate: [['event']], eventVenue: [['event']] },
}

/** 요청이 에이전트에게 알려 주는 「사실 → 채울 구조 칸」 표(문자열 경로) — 사실이 있으면 이 칸들을 그 사실로 채운다(가격 → product.price·taxIncluded 처럼). */
export const structuresOf = (archetype) => Object.fromEntries(Object.entries(FACT_SCHEMA_HOMES[archetype] ?? {}).map(([name, homes]) => [name, homes.map((h) => h.join('.'))]))

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')

// ── 규칙(정본) ───────────────────────────────────────────────────────────
// 금지어 출처: ko = DESIGN §9(다른 회사 이름을 넣어도 성립하는 문장·「~의 힘」「혁신」「원활한」) · §14-C(대비 구문·헛기침·가짜 통찰·해석 메타·중요성 과장·
//   근거 없는 권위·요약 반복·수사 질문·극적 파편·느낌표) · §9(「당신」·의미 없는 강조어 정말/진짜/그냥·lorem).
//   en = kill-ai-slop scripts/scan.mjs tell 14·15(AI 문구 목소리·이모지) + no-ai-slop 「Words to cut」 + stop-slop(보류 중이라 phrases.md 만 읽음) 군더더기.
//   ko·en 공통 = 이모지(kill-ai-slop 15)·느낌표·em dash(factory/qa/ai-tell.mjs G010).
export const KO_BANNED = [
  ['ko-new-standard', /의\s?새로운\s?기준/, '「~의 새로운 기준」'],
  ['ko-experience', /경험(?:하세요|해\s?보세요)/, '「~를 경험하세요」'],
  ['ko-smarter', /더\s?스마트하게/, '「더 스마트하게」'],
  ['ko-at-a-glance', /한눈에/, '「한눈에」 남발'],
  ['ko-innovate', /혁신/, '「혁신·혁신적」(근거 없는 형용)'],
  ['ko-empty-adjectives', /원활한|최첨단|획기적/, '「원활한·최첨단·획기적」'],
  ['ko-thousands-chose', /수(?:천|만|십만)\s?명이\s?선택/, '「수천 명이 선택한」(근거 없는 인기)'],
  ['ko-power', /의\s?힘/, '「~의 힘」'],
  ['ko-contrast', /(?:이|가)\s?아니라\s|단순(?:한|히)[^.!?\n]{0,30}아니(?:라|다|에요|예요)/, '대비 구문 「X가 아니라 Y」·「단순한 X가 아니다」'],
  ['ko-negation-list', /\S+도\s[^.!?\n]{1,20}도\s?아닌/, '부정 나열 「X도 Y도 아닌 Z」'],
  ['ko-drama', /그게\s?(?:다입니다|다예요|전부(?:예요|입니다))|(?:^|[.!?]\s)(?:[가-힣]{1,6}\.\s+){2}[가-힣]{1,6}\./, '극적 파편 「빠르게. 쉽게. 당신답게.」·「그게 다입니다」'],
  ['ko-rhetorical-question', /만약[^.!?\n]{1,40}(?:라면|다면)\s?\?/, '수사 질문 도입 「만약 ~라면?」'],
  ['ko-throat-clearing', /솔직히\s?(?:말하면|말해)|핵심은\s?이렇습니다|대부분이?\s?놓치는|이\s?점이\s?중요합니다|보시다시피|결론적으로/, '헛기침·가짜 통찰·해석 메타·요약 반복'],
  ['ko-authority', /전문가들은|연구에\s?따르면/, '근거 없는 권위(출처를 대거나 뺀다)'],
  ['ko-filler-emphasis', /(?:^|\s)(?:정말|진짜|그냥)(?=\s|$|[,.!?])/, '의미 없는 강조어 정말·진짜·그냥'],
  ['ko-you', /당신/, '주어 「당신」(청자 기준 문장으로 쓴다)'],
  ['placeholder-text', /lorem|ipsum|john doe|jane doe/i, 'lorem·John Doe(실제 콘텐츠로 만든다)'],
]

const EN_WORD_STEMS = [
  'delve\\w*', 'foster\\w*', 'leverag\\w*', 'utiliz\\w*', 'facilitat\\w*', 'empower\\w*', 'streamlin\\w*', 'robust', 'cutting-edge', 'paradigm shift',
  'game[- ]?changer', 'this is huge', 'this changes everything', 'tapestry', 'realm', 'beacon', 'multifaceted', 'meticulous', 'intricate',
  'paramount', 'transformative', 'elevat\\w*', 'embark\\w*', 'supercharg\\w*', 'harness\\w*', 'ever-evolving', 'seamless(?:ly)?', 'effortless(?:ly)?',
  'blazing[- ]fast', 'next[- ]level', 'unlock the power', 'say goodbye to', 'meet your new', 'in seconds,? not',
]
export const EN_BANNED = [
  ['en-words', new RegExp(`\\b(?:${EN_WORD_STEMS.join('|')})\\b`, 'i'), 'kill-ai-slop 14 · no-ai-slop 금지어'],
  ['en-contrast', /\bnot (?:just|only|merely)\b.{0,40}\b(?:but|it['’]?s|it is)\b|\b(?:isn['’]t|is not|aren['’]t)\b[^.!?\n]{1,40},\s?it['’]?s\b/i, '「not just X, it’s Y」 대비 구문'],
  ['en-theater', /\b(?:growth|security|process|privacy|productivity|compliance|feature|innovation) theater\b/i, '「X theater」'],
  ['en-filler', /\b(?:it['’]?s (?:worth|important) (?:noting|to note)|at the end of the day|when it comes to|at its core|in today['’]s world|in the age of|in the world of|the reality is|the truth is|going forward|in this article|let['’]s dive in)\b/i, 'no-ai-slop 빈 문구'],
  ['en-throat-clearing', /\b(?:here['’]s (?:the thing|what|why|this|that)|let me be clear|the uncomfortable truth|make no mistake|let that sink in|full stop)\b/i, 'stop-slop 헛기침·강조 목발'],
  ['en-jargon', /\b(?:deep dive|circle back|lean into|double down|on the same page)\b/i, 'stop-slop 업계 은어'],
]
export const COMMON_BANNED = [
  ['emoji', /\p{Extended_Pictographic}/u, '이모지(kill-ai-slop 15)'],
  ['exclamation', /!/, '느낌표(DESIGN §14-C)'],
  ['em-dash', /—/, 'em dash(ai-tell G010)'],
]

// 해요체(ko): 합쇼체는 어디서나, 해라체(-다.)는 마침표가 있는 문장에서만 잡는다(「바다」「모두 다」 같은 이름 명사 오탐을 피하려고).
export const KO_FORMAL = /(?:니다|니까|십시오)$/
export const KO_PLAIN = /[가-힣]다$/

// CTA 칸(A3): 동사 + 받는 것. 맨 동사·맨 명사 라벨을 막는다.
export const CTA_SLOT_ID = /(?:^|[a-z])(?:cta|action)$/i
export const CTA_BANNED = {
  ko: /^(?:확인|제출|더\s?보기|클릭|클릭하세요|자세히|자세히\s?보기|보기)$/,
  en: /^(?:submit|click here|learn more|read more|more|ok|okay)$/i,
}

export const COPY_VARIANT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/

const VOICE_ADJECTIVES = {
  ko: ['담백한', '따뜻한', '또렷한', '차분한', '정직한', '친근한', '단단한', '가벼운'],
  en: ['plain', 'warm', 'precise', 'calm', 'candid', 'friendly', 'steady', 'light'],
}
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** 요청 파일에 실어 에이전트가 볼 규칙 목록(id 는 validateContent 문제 앞의 [id]와 같다). */
export function ruleList(locale, withStructure = false) {
  const rows = [
    ['schema', '원형 콘텐츠 스키마(content/schemas/<원형>.ts)를 통과한다. 빈 사실 자리의 오류만 건너뛴다'],
    ['locale', 'content.locale 이 요청의 locale 이고, 코퍼스(slots.copy)에 다른 언어 글자가 없다'],
    ['copy-slot', 'slots.copy 는 요청 slots 와 같은 순서·개수이고(같은 id 는 요청 순서대로) 글자 수가 maxChars 이하다'],
    ['ui-copy', '「ui:」 칸(slot.ui)은 예시 표지(「예시」)·예시 문장 그대로를 남기지 않고, 예시의 {…} 자리 표시를 그대로 가진다'],
    ['placeholder', `사실이 없는 자리는 정확히 「${PLACEHOLDER[locale]}」이다. 사실이 있는데 자리 표시를 남기지 않는다`],
    ['vat', 'saas: price 사실이 부가세 포함/별도를 말하면 요금제마다 vatIncluded 가 그 값이다(true/false)'],
    ['currency', 'detail: product.currency 는 브리프 가격의 통화이고, 금액(price·fee·freeThreshold)은 그 통화의 최소 단위 정수다(USD·EUR 는 센트 — $48 → 4800)'],
    ['invented-fact', '전화·사업자번호·가격·주소·메일은 브리프 사실에 있는 값만 쓴다'],
    ...(withStructure ? [
    ['structure-invented', '구조 칸(structureSlots[])의 사실이 브리프에 없으면(empty) 그 칸을 채우지 않는다 — 지어낸 소식·인물·연혁·링크를 막는다'],
    ['structure-missing', '구조 칸의 사실이 브리프에 있으면 그 칸을 사실 항목마다 채운다(본문 섹션이 그 칸을 읽는다)'],
    ['structure-trace', '구조 칸 항목의 이름·제목·날짜·연도·주소·숫자는 브리프 사실에 있는 것만이다'],
    ] : []),
    ['cta', 'CTA 칸은 동사 + 받는 것으로 쓴다(맨 「확인·제출·더보기」 같은 라벨 금지)'],
    ['copy-variant', 'copyVariants 는 요청 sections 의 키에만, 소문자·숫자·- 32자 이하 id 로 붙인다'],
    ...COMMON_BANNED.map(([id, , why]) => [id, why]),
    ...(locale === 'ko'
      ? [['ko-register', '해요체·능동형. 합쇼체(-습니다)·해라체(-다.)로 끝맺지 않는다'], ...KO_BANNED.map(([id, , why]) => [id, why])]
      : EN_BANNED.map(([id, , why]) => [id, why])),
  ]
  return rows.map(([id, rule]) => ({ id, rule }))
}

// ── 요청 ─────────────────────────────────────────────────────────────────
export const UI_ROLE = (example) => `화면 안내 문구 — 블록 예시 「${example}」 를 이 서비스에 맞게 다시 쓴다. 예시 표지(「예시」)·가상 이름·지어낸 숫자·약속을 쓰지 않고, {…} 자리 표시는 예시와 같은 것을 그대로 둔다`
// 콘텐츠 봉투 칸 — 스키마 밖이지만 04-content.json 이 싣는 것: locale · facts(브리프 사실 원문·빈 사실의 자리 표시) · copyVariants(J2) · media(대표 파일) · site(사이트 주소)
export const ENVELOPE_KEYS = ['locale', 'facts', 'copyVariants', 'media', 'site']
export const UI_EXAMPLE_MARKER = /예시|\((?:example|sample)\)/i

// 화면 구조·기능 이름의 숫자(「2단계 인증」「6자리」「8자 이상」「만 14세」) — 화면이 실제로 지키는 값이라 예시 그대로 쓸 수 있다.
// 이것들을 지우고도 숫자가 남으면 사업 수치다(월 300건·직원 3명·13개월).
const STRUCTURAL_NUMBER = /만\s*\d+\s*세|\d+\s*(?:단계|자리|자(?![가-힣]))|\b\d+-(?:step|digit)\b|\b\d+\s+(?:digits?|characters?)\b/gi
/** why 가 digits 인 ui: 칸의 숫자 종류 — structural(예시 그대로 가능) | business(브리프 사실의 숫자로 바꾸거나 숫자 없이 쓴다, 안 되면 빈 문자열로 남긴다). */
export const uiNumberKind = (example) => (/\d/.test(String(example).replace(STRUCTURAL_NUMBER, '')) ? 'business' : 'structural')
/** 예시 표지(「(예시)」·"(example)"·끝의 「· 예시」)를 떼고 공백을 하나로 모은 글 — 예시 문장과 같은지 비교하는 바탕(FINAL-WF2 AB5). */
export const stripExampleMarker = (v) => String(v).replace(/\s*[(（][^)）]*(?:예시|example|sample)[^)）]*[)）]/gi, '').replace(/\s*[·•\-–—:]\s*(?:예시|example|sample)\s*$/i, '').replace(/\s+/g, ' ').trim()
/** 문구 칸의 글이 블록 예시 문장과 같은가 — 공백을 하나로 모으고 예시 표지를 뗀 뒤에도 같으면 같다(표지만 떼고 베낀 글을 거절). */
export const uiSameAsExample = (text, example) => {
  const norm = (v) => String(v).replace(/\s+/g, ' ').trim()
  if (norm(text) === norm(example)) return true
  const ex = stripExampleMarker(example)
  return ex !== '' && stripExampleMarker(text) === ex
}
const uiTokens = (s) => [...String(s).matchAll(/\{[A-Za-z_]+\}/g)].map((m) => m[0]).sort().join('|')
/**
 * @param {{ id: string }} cand  방향 후보(Task 3)
 * @param {{ archetype: string, pages: object[] }} sitemap  buildSitemap 결과(Task 6)
 * @param {object} variants  chooseVariants 결과 전체({ 후보 id: { "<쪽>/<섹션>": 블록 } }) 또는 이 후보의 것
 * @param {number} seed  결정 씨앗 — 이 후보의 문구 목소리(형용사 3개)를 고른다
 * @param {{ archetype: object, brief: object, uiSlots?: Map<string, { path: string, example: string, why: string }[]> }} ctx  원형(Task 1)·브리프(Task 2). 사이트맵은 문구 칸을 싣지 않아 원형에서 읽는다.
 *   uiSlots(선택, ui-copy.mjs uiSlotTable): 블록 → 예시 표지·가상 이름·지어낸 숫자가 남은 화면 문구 잎. 있으면 그 블록의 잎마다 문구 칸("ui:<잎 경로>")을 더 요청한다(대장 C112)
 */
export function contentRequest(cand, sitemap, variants, seed = 0, { archetype, brief, uiSlots } = {}) {
  if (!cand?.id) throw new Error('후보(cand.id)가 없다')
  if (!archetype || !brief) throw new Error('contentRequest 는 { archetype, brief } 를 받아야 한다')
  const b = BriefSchema.parse(brief)
  if (archetype.id !== b.archetype || sitemap?.archetype !== archetype.id) throw new Error(`원형이 맞지 않는다: 브리프 ${b.archetype} · 원형 ${archetype.id} · 사이트맵 ${sitemap?.archetype}`)
  const { content: seedContent, missing: briefMissing } = briefToSeed(b, archetype)
  // saas 스키마의 product(이름·주소)는 사실 이름이 따로 없어 씨앗에 비어 있었다 — 이름은 상호, 주소는 productUrl 사실에서 옮겨 둔다(에이전트가 짐작하지 않게)
  if (archetype.id === 'saas' && seedContent.business?.name) {
    const url = String(b.facts.productUrl ?? '').trim()
    seedContent.product = { name: seedContent.business.name, ...(url ? { url } : {}) }
  }
  // public 의 처리방침 링크는 이 사이트가 만드는 법정 쪽(02 사이트맵 경로)이라 사실이 아니라 씨앗에서 잇는다 — 에이전트가 짐작하거나 빈 앵커를 두지 않게(P4GR).
  if (archetype.id === 'public') {
    const privacy = sitemap.pages.find((pg) => pg.id === 'privacy')?.route
    if (privacy) (seedContent.agency ??= {}).privacyPolicyUrl ??= privacy
  }
  const facts = Object.fromEntries(Object.entries(b.facts).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  // 스키마가 필수로 요구하는데 사실이 없는 자리도 missing 에 올린다(에이전트가 지어내거나 막히지 않게 — SCHEMA_FACTS)
  const extraMissing = Object.fromEntries(Object.entries(schemaMissing(archetype.id, seedContent, facts, b.locale)).filter(([n]) => !briefMissing.includes(n)))
  const missing = [...briefMissing, ...Object.keys(extraMissing)]
  const chosen = variants && typeof variants[cand.id] === 'object' && variants[cand.id] !== null ? variants[cand.id] : (variants ?? {})
  const sectionOf = (pageId, kind) => archetype.pages.find((p) => p.id === pageId)?.sections.find((s) => s.kind === kind)
  const slots = [], sections = [], skipped = []
  for (const page of sitemap.pages) for (const s of page.sections) {
    const key = `${page.id}/${s.kind}`
    if (s.status === 'pending') { skipped.push({ path: key, why: 'pending — 블록 없음, 화면이 「확인 필요」를 그린다' }); continue }
    let block = null
    if (s.status === 'block') {
      block = chosen[key] ?? null
      if (!block) throw new Error(`03-variants 에 ${key} 가 없다 — 후보 ${cand.id} 의 변형을 다시 골라야 한다`)
      sections.push(key)
    }
    for (const c of sectionOf(page.id, s.kind)?.copySlots ?? []) {
      const wanted = slotFacts(archetype.id, c.id, s.kind)
      const used = Object.keys(facts).filter((k) => wanted.some((w) => norm(w) === norm(k)))
      slots.push({ path: `${key}/${c.id}`, id: c.id, role: c.role, maxChars: c.maxChars ?? null, block, factsUsed: used, ...(wanted.length ? { factsWanted: wanted, placeholder: used.length === 0 } : {}) })
    }
    // 화면 문구 칸(C112): 블록 예시의 안내 문장 중 예시 표지·가상 이름·지어낸 숫자가 남은 잎. 예시를 이 서비스에 맞게 다시 쓴다.
    for (const leaf of (block && uiSlots?.get(block)) || []) {
      slots.push({
        path: `${key}/ui:${leaf.path}`, id: `ui:${leaf.path}`, role: UI_ROLE(leaf.example), maxChars: null, block, factsUsed: [],
        ui: { path: leaf.path, example: leaf.example, why: leaf.why, ...(leaf.why === 'digits' ? { numbers: uiNumberKind(leaf.example) } : {}) },
      })
    }
  }
  const locale = b.locale
  const structure = structureSlots({ archetype, sitemap, facts, schema: loadContentSchema(archetype.id) })
  const factPaths = { ...Object.fromEntries(Object.keys({ ...facts, ...Object.fromEntries(briefMissing.map((m) => [m, 1])) }).map((k) => [k, factPath(archetype.id, k)])), ...extraMissing }
  const adjectives = [...VOICE_ADJECTIVES[locale]].sort((x, y) => fnv(`${seed}|${cand.id}|${x}`) - fnv(`${seed}|${cand.id}|${y}`)).slice(0, 3)
  return {
    version: 1, candidate: cand.id, archetype: archetype.id, locale, topic: b.topic,
    voice: { register: locale === 'ko' ? '해요체' : 'plain', adjectives },
    placeholder: PLACEHOLDER[locale],
    facts, missing, factPaths, structures: structuresOf(archetype.id), ...(archetype.id === 'detail' ? { currency: briefCurrency(facts.price) } : {}), seedContent,
    sections, slots, skipped,
    ...(structure.length ? { structureRule: STRUCTURE_RULE, structureSlots: structure, siteRoutes: sitemap.pages.map((pg) => pg.route) } : {}), // 구조 칸이 없는 요청은 옛 모양 그대로(요청 해시·이미 쓴 04 가 안 바뀐다)
    checks: ruleList(locale, structure.length > 0),
  }
}

// ── 스키마 ───────────────────────────────────────────────────────────────
const nodeRequire = createRequire(import.meta.url)
function writeIfChanged(file, text) {
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}
// TS → CJS(.tmp/stamp-content). 동기로 불러야 validateContent 가 동기다. @/registry/factory/… import 는 변환본의 절대 경로 require 로 바꾼다.
function transpileCjs(ts, abs, outRoot, seen) {
  const rel = relative(FACTORY, abs).split(sep).join('/')
  const out = join(outRoot, rel.replace(/\.tsx?$/, '.cjs'))
  if (seen.has(abs)) return out
  seen.add(abs)
  let js = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  js = js.replace(/require\((["'])@\/registry\/factory\/([^"']+)\1\)/g, (_, _q, p) => {
    const base = join(FACTORY, p)
    const src = ['.ts', '.tsx'].map((e) => base + e).find(existsSync)
    if (!src) throw new Error(`import 대상 없음: ${p} (${rel})`)
    return `require(${JSON.stringify(transpileCjs(ts, src, outRoot, seen))})`
  })
  writeIfChanged(out, js)
  return out
}
const schemaCache = new Map()
/** 원형 콘텐츠 스키마 — { safeParse(data) } (content-core safeParseContent: 한국어 오류 메시지). */
export function loadContentSchema(archetypeId) {
  if (schemaCache.has(archetypeId)) return schemaCache.get(archetypeId)
  const ts = nodeRequire('typescript')
  const outRoot = join(ROOT, '.tmp', 'stamp-content')
  const seen = new Set()
  const core = nodeRequire(transpileCjs(ts, join(FACTORY, 'content', 'content-core.ts'), outRoot, seen))
  const mod = nodeRequire(transpileCjs(ts, join(FACTORY, 'content', 'schemas', `${archetypeId}.ts`), outRoot, seen))
  const schema = Object.values(mod).find((v) => v?.shape?.archetype)
  if (!schema) throw new Error(`${archetypeId} 콘텐츠 스키마를 찾지 못했다`)
  // shape: 최상위 칸마다의 스키마 — 06-pages 가 빈 사실 때문에 전체 검사를 못 통과한 콘텐츠에도 칸별 기본값(default)을 채운다.
  const loaded = { safeParse: (data) => core.safeParseContent(schema, data), shape: schema.shape, imageSlots: mod.IMAGE_SLOTS }
  schemaCache.set(archetypeId, loaded)
  return loaded
}

// ── 검사 도우미 ──────────────────────────────────────────────────────────
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const at = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj)
const fmt = (path) => path.reduce((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : String(k)), '')
const startsWith = (path, prefix) => prefix.every((k, i) => String(path[i]) === String(k))

function walk(v, path, out) {
  if (typeof v === 'string' || typeof v === 'number') out.push({ path, value: v })
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i], out))
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, [...path, k], out)
  return out
}

// 문구로 읽을 글자만: 사업자·사이트·원본 사실 아래와 식별자·링크·날짜·숫자는 뺀다.
const SKIP_ROOTS = new Set(['business', 'site', 'facts', 'archetype', 'locale', 'copyVariants'])
const SKIP_KEYS = new Set(['id', 'role', 'tone', 'forbid', 'aspect', 'source', 'kind', 'subtype', 'category', 'os', 'href', 'url', 'src', 'license', 'email', 'phone', 'value', 'date'])
const NON_PROSE = /^(?:https?:|mailto:|tel:|[/#])|^[\w.+-]+@[\w-]+\.[\w.-]+$|^\d{4}-\d{2}-\d{2}|^\d{1,2}:\d{2}|^[\d\s,.:%+~-]+$/i
const HAS_LETTER = /[A-Za-z가-힣]/

function proseOf(content, factValues) {
  return walk(content, [], []).filter(({ path, value }) =>
    typeof value === 'string' && !SKIP_ROOTS.has(String(path[0])) && !SKIP_KEYS.has(String(path.at(-1))) &&
    HAS_LETTER.test(value) && !NON_PROSE.test(value.trim()) && !factValues.has(norm(value)) && norm(value) !== '' &&
    !Object.values(PLACEHOLDER).includes(value.trim()))
}

const sentencesOf = (text) => text.split(/(?<=[.!?…。])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
const stripEnd = (s) => s.replace(/[\s.!?…。"'”’)」』\]]+$/u, '')

// 사실 추출 — 전화·사업자번호·가격·주소·메일을 정규식으로 찾는다. 같은 함수를 브리프 사실과 콘텐츠 양쪽에 쓴다.
const SEP = '[ .\\u00a0-]' // 줄바꿈은 구분자가 아니다 — 다음 줄의 숫자를 삼키지 않는다
const PHONE = new RegExp(
  [
    `(?<!\\d)(?:\\+82${SEP}?)?0\\d{1,2}${SEP}?\\d{3,4}${SEP}?\\d{4}(?!\\d)`,
    `(?<!\\d)1[5-9]\\d{2}${SEP}\\d{4}(?!\\d)`,
    `\\+\\d{1,3}${SEP}?\\(?\\d{1,4}\\)?(?:${SEP}?\\d{2,4}){2,4}`,
    `\\(\\d{3}\\) ?\\d{3}${SEP}\\d{4}`,
    `(?<!\\d)\\d{3}${SEP}\\d{3}${SEP}\\d{4}(?!\\d)`,
  ].join('|'),
  'g',
)
const BIZNO = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g
const AMOUNT_KO_MAN = /(\d[\d,]*)\s*만\s*원/g
const AMOUNT_KO = /(\d[\d,]*(?:\.\d+)?)\s*원/g
const AMOUNT_SYM = /[$€£₩]\s?(\d[\d,]*(?:\.\d{1,2})?)/g
const AMOUNT_CODE = /(\d[\d,]*(?:\.\d{1,2})?)\s?(?:USD|EUR|GBP|KRW)\b/g
/** 가격 사실 글의 통화 — ports Currency(KRW·USD·EUR·JPY) 하나 또는 null(가격이 없거나 알 수 없다). detail 의 product.currency 가 이것과 같아야 한다. */
export function briefCurrency(text) {
  const t = String(text ?? '')
  if (/USD|US\$|\$/.test(t)) return 'USD'
  if (/EUR|€/.test(t)) return 'EUR'
  if (/JPY|円|¥/.test(t)) return 'JPY'
  if (/KRW|₩|원/.test(t)) return 'KRW'
  return null
}
const ADDR_KO = /[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|시|도|군|구)\s+(?:[가-힣]+(?:시|군|구)\s+)?([가-힣0-9]+(?:대로|로|길)\s?\d+(?:-\d+)?)/g
const ADDR_EN = /\b\d{1,6}\s+(?:[A-Z][\w.'-]*\s+){1,4}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?|Way|Court|Ct\.?)\b/g

const digits = (s) => s.replace(/\D/g, '')
export const phoneKey = (raw) => { const d = digits(raw); return /^\+82/.test(raw.trim()) ? `0${d.slice(2).replace(/^0/, '')}` : d }
const matches = (re, text) => [...text.matchAll(new RegExp(re.source, re.flags))]
const num = (s) => Number(String(s).replace(/,/g, ''))
export function extractFacts(text) {
  return {
    phones: matches(PHONE, text).map((m) => ({ raw: m[0].trim(), key: phoneKey(m[0]) })),
    bizNos: matches(BIZNO, text).map((m) => ({ raw: m[0], key: m[0] })),
    emails: matches(EMAIL, text).map((m) => ({ raw: m[0], key: m[0].toLowerCase() })),
    amounts: [
      ...matches(AMOUNT_KO_MAN, text).map((m) => ({ raw: m[0].trim(), key: num(m[1]) * 10000 })),
      ...matches(AMOUNT_KO, text).map((m) => ({ raw: m[0].trim(), key: num(m[1]) })),
      ...matches(AMOUNT_SYM, text).map((m) => ({ raw: m[0].trim(), key: num(m[1]) })),
      ...matches(AMOUNT_CODE, text).map((m) => ({ raw: m[0].trim(), key: num(m[1]) })),
    ],
    addresses: [
      ...matches(ADDR_KO, text).map((m) => ({ raw: m[0].trim(), key: m[1].replace(/\s/g, '') })),
      ...matches(ADDR_EN, text).map((m) => ({ raw: m[0].trim(), key: m[0].toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '') })),
    ],
  }
}
// price 사실이 부가세 포함(true)·별도(false)를 말하는지, 말하지 않으면 null
const VAT_SAID = (text) => (/부가세\s?(?:별도|제외)|VAT\s?(?:별도|제외)|(?:excl(?:uding|usive of|ude|udes|uded)?|ex\.?|plus|\+)\s*(?:of\s+)?(?:VAT|tax)|(?:VAT|tax)\s+(?:is\s+|are\s+)?(?:not\s+(?:included|incl\.?)|extra|excluded)|not\s+(?:including|inclusive of)\s+(?:VAT|tax)/i.test(text) ? false : /부가세\s?포함|VAT\s?포함|(?:incl(?:uding|usive of|ude|udes|uded)?|with)\s+(?:VAT|tax)|(?:VAT|tax)\s+(?:is\s+|are\s+)?included/i.test(text) ? true : null)
const PRICE_KEY = /price|amount|fee|cost|threshold/i
/** 통화의 소수 자릿수(최소 단위 배율의 지수) — 모르는 통화·null 은 0. */
export const currencyDigits = (currency) => { try { return currency ? new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits : 0 } catch { return 0 } }

function inventedFacts(request, content) {
  const corpus = Object.values(request.facts).join('\n')
  const known = extractFacts(corpus)
  // 브리프가 무료를 말하면(free·무료) 0 은 지어낸 가격이 아니다 — 무료 요금제를 구조로 담을 수 있게 한다
  const freeStated = /\b(?:free|no charge)\b|무료/i.test(corpus)
  // USD·EUR 는 ports Money 처럼 최소 단위(센트)로 담으므로 브리프의 달러·유로 값 ×100 도 같은 가격이다
  // 소수 통화(USD·EUR)는 브리프의 달러 값(48)이 아니라 최소 단위(4800)만 같은 가격이다 — 자릿수는 Intl 이 안다(KRW·JPY 0, USD·EUR 2). 달러 값을 그대로 넣으면 48센트가 된다
  const factor = 10 ** currencyDigits(request.currency)
  const has = (list, key) => list.some((x) => x.key === key) || (key === 0 && freeStated)
  // 구조 칸의 숫자(price·fee·freeThreshold)는 최소 단위라 브리프 글의 금액 × 배율과 같아야 한다 — 문구(prose)에 적힌 금액은 글 그대로($48)라 has 로 본다
  const hasMinor = (list, key) => list.some((x) => Math.round(x.key * factor) === key) || (key === 0 && freeStated)
  const corpusNoSpace = corpus.replace(/\s/g, '')
  const corpusEn = corpus.toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '')
  const problems = []
  for (const { path, value } of walk(content, [], [])) {
    // 문구 칸의 role 은 요청에서 옮긴 설명이다(화면 글이 아니다) — 「ui:」 칸의 role 은 블록 예시 문장을 담아 예시 메일·전화가 들어 있을 수 있다
    if (path[0] === 'slots' && path.at(-1) === 'role') continue
    const where = fmt(path)
    if (typeof value === 'number') {
      if (PRICE_KEY.test(String(path.at(-1))) && !hasMinor(known.amounts, value)) problems.push(`[invented-fact] 지어낸 사실(invented fact): 가격 ${value} 은 브리프 사실에 없다 — ${where}`)
      continue
    }
    const f = extractFacts(value)
    for (const p of f.phones) if (!has(known.phones, p.key)) problems.push(`[invented-fact] 지어낸 사실(invented fact): 전화번호 "${p.raw}" 는 브리프 사실에 없다 — ${where}`)
    for (const p of f.bizNos) if (!has(known.bizNos, p.key)) problems.push(`[invented-fact] 지어낸 사실(invented fact): 사업자등록번호 "${p.raw}" 는 브리프 사실에 없다 — ${where}`)
    for (const p of f.emails) if (!has(known.emails, p.key)) problems.push(`[invented-fact] 지어낸 사실(invented fact): 메일 "${p.raw}" 는 브리프 사실에 없다 — ${where}`)
    for (const p of f.amounts) if (!has(known.amounts, p.key)) problems.push(`[invented-fact] 지어낸 사실(invented fact): 가격 "${p.raw}" 는 브리프 사실에 없다 — ${where}`)
    for (const p of f.addresses) {
      const found = /[가-힣]/.test(p.key) ? corpusNoSpace.includes(p.key) : corpusEn.includes(p.key)
      if (!found) problems.push(`[invented-fact] 지어낸 사실(invented fact): 주소 "${p.raw}" 는 브리프 사실에 없다 — ${where}`)
    }
  }
  return problems
}

// ── 검사 ─────────────────────────────────────────────────────────────────
/**
 * @param {object} request  contentRequest 결과
 * @param {object} content  문구 에이전트가 쓴 04-content.json(원형 콘텐츠 + slots.copy + 선택 site·copyVariants)
 * @param {{ schema?: { safeParse: Function } }} [opts]  스키마(기본은 원형 스키마를 변환해 불러온다)
 * @returns {string[]}  문제 목록 — 각 줄은 「[규칙 id] 설명 — 위치」. 빈 배열이 통과.
 */
/**
 * 사업 수치 `ui:` 칸(numbers: business)을 빈 문자열로 남기는 것은 COPY.md 가 허락한 방법이다(사실로 못 쓰면 비운다 — 06 이 그 잎·표 행을 뺀다).
 * 그런데 콘텐츠 스키마의 문구 칸은 빈 글자를 거절하므로(「문구가 비었습니다」) 같은 칸이 [schema] 로 떨어져 허락한 방법이 통과하지 못했다
 * (P4GR 골든 실측 — saas 문구 에이전트가 비울 수 있는 칸을 못 비우고 지어낸 문장으로 채웠다). 그 칸의 그 오류만 건너뛴다.
 */
export function emptyBusinessSlotIssue(request, content, path) {
  if (path.length !== 4 || path[0] !== 'slots' || path[1] !== 'copy' || path[3] !== 'text') return false
  const i = Number(path[2])
  return request.slots?.[i]?.ui?.numbers === 'business' && content?.slots?.copy?.[i]?.text === ''
}

export function validateContent(request, content, { schema } = {}) {
  const out = []
  const add = (id, msg, where) => out.push(`[${id}] ${msg}${where ? ` — ${where}` : ''}`)
  if (!isObj(content)) return ['[schema] 콘텐츠가 객체가 아니다']
  const locale = request.locale
  const ph = PLACEHOLDER[locale]
  const otherPh = PLACEHOLDER[locale === 'ko' ? 'en' : 'ko']

  // 1) 스키마 — 빈 사실 자리의 오류만 건너뛴다.
  const homes = (name) => [request.factPaths[name], ...(FACT_SCHEMA_HOMES[request.archetype]?.[name] ?? [])].filter(Boolean)
  const emptyHomes = [...request.missing.flatMap(homes), ...emptyStructureHomes(request)] // 사실 없는 구조 칸(예: public quickLinks 필수 1개)은 비어도 스키마 오류로 막지 않는다 — 06 이 「자료 연결 안 됨」
  const parsed = (schema ?? loadContentSchema(request.archetype)).safeParse(content)
  if (!parsed.success) for (const issue of parsed.error.issues) {
    if (emptyHomes.some((h) => startsWith(issue.path, h)) || emptyBusinessSlotIssue(request, content, issue.path) || isPlaceholderHref(request, content, issue.path)) continue
    add('schema', issue.message, fmt(issue.path))
  }

  // 1a) detail 가격의 통화 — 브리프 가격의 통화와 같아야 한다(스키마 기본값 KRW 는 $ 브리프의 가격을 원으로 바꿔 버린다)
  if (request.currency && isObj(content.product) && content.product.price !== undefined && (content.product.currency ?? 'KRW') !== request.currency)
    add('currency', `product.currency 는 브리프 가격의 통화 ${request.currency} 여야 한다(지금 ${JSON.stringify(content.product.currency) ?? '없음 — 기본 KRW'}) — 금액은 최소 단위 정수(USD·EUR 은 센트)`, 'product.currency')

  // 1b) 알 수 없는 최상위 칸 — 스키마가 조용히 떼어 내던 칸(스키마에 없는 이름)이 통과하지 않게 한다. 봉투 칸(ENVELOPE_KEYS)만 더 허용한다.
  const knownTop = new Set([...Object.keys((schema ?? loadContentSchema(request.archetype)).shape ?? {}), ...ENVELOPE_KEYS])
  for (const k of Object.keys(content)) if (!knownTop.has(k)) add('schema', `알 수 없는 최상위 칸이다(스키마에도 봉투에도 없다): ${k}`, k)

  // 1c) saas 요금제의 부가세 표기 — price 사실이 포함/별도를 말하면 요금제마다 vatIncluded 가 그 값이어야 한다(없으면 요금표가 세금 표기를 못 그려 marketing price-notation 이 떨어진다, P3-3 Task 14b)
  if (request.archetype === 'saas' && Array.isArray(content.plans) && typeof request.facts?.price === 'string') {
    const said = VAT_SAID(request.facts.price)
    if (said !== null) content.plans.forEach((pl, i) => {
      if (isObj(pl) && pl.monthlyPrice !== null && pl.vatIncluded !== said) add('vat', `price 사실이 부가세 ${said ? '포함' : '별도'}라고 말하니 plans[${i}].vatIncluded 는 ${said} 여야 한다(지금 ${JSON.stringify(pl.vatIncluded) ?? '없음'})`, `plans.${i}.vatIncluded`)
    })
  }

  // 2) 언어·원형
  if (content.locale !== locale) add('locale', `content.locale 은 "${locale}" 여야 한다(지금 ${JSON.stringify(content.locale) ?? '없음'})`, 'locale')
  if (content.archetype !== request.archetype) add('schema', `content.archetype 은 "${request.archetype}" 여야 한다`, 'archetype')
  if (isObj(content.site) && content.site.locale !== undefined && content.site.locale !== locale) add('locale', `site.locale 은 "${locale}" 여야 한다`, 'site.locale')

  // 3) 빈 사실 자리 — 정확히 자리 표시. 사실이 있는 자리에 자리 표시가 남아도 안 된다.
  for (const name of request.missing) {
    const path = request.factPaths[name]
    const v = at(content, path)
    if (v !== ph) add('placeholder', `사실 「${name}」 이 비었으니 정확히 「${ph}」로 적어야 한다(지금 ${v === undefined || v === '' || v === null ? '비어 있다' : JSON.stringify(v)})`, fmt(path))
  }
  for (const [name, { path }] of Object.entries(SCHEMA_FACTS[request.archetype] ?? {})) {
    if (request.missing.includes(name)) continue
    const v = at(content, path)
    if (typeof v === 'string' && (v.trim() === ph || v.trim() === otherPh)) add('placeholder', `「${name}」 자리는 사실이 있는데 자리 표시 「${v}」가 남았다`, fmt(path))
  }
  for (const name of Object.keys(request.facts)) {
    const path = request.factPaths[name]
    const v = at(content, path)
    if (typeof v === 'string' && (v.trim() === ph || v.trim() === otherPh)) add('placeholder', `사실 「${name}」 이 있는데 자리 표시 「${v}」가 남았다`, fmt(path))
  }

  // 4) 문구 칸 — 요청과 같은 순서·개수, 글자 수, 자리 표시, CTA
  const copy = Array.isArray(content.slots?.copy) ? content.slots.copy : []
  const byId = new Map()
  copy.forEach((c, i) => byId.set(c?.id, [...(byId.get(c?.id) ?? []), { c, i }]))
  const seen = new Map()
  for (const slot of request.slots) {
    const k = seen.get(slot.id) ?? 0
    seen.set(slot.id, k + 1)
    const hit = byId.get(slot.id)?.[k]
    if (!hit) { add('copy-slot', `문구 칸이 없다: ${slot.path}`, 'slots.copy'); continue }
    const { c, i } = hit
    const where = `slots.copy[${i}] (${slot.path})`
    const text = typeof c.text === 'string' ? c.text : ''
    if (!text.trim()) { if (slot.ui?.numbers !== 'business') add('copy-slot', '문구가 비었다', where); continue } // 사업 수치 칸은 숫자 없이 못 쓰면 빈 문자열로 남길 수 있다(06 이 그 잎을 빼거나 공개 불가로 남긴다)
    if (slot.maxChars != null && [...text].length > slot.maxChars) add('copy-slot', `「${slot.id}」 문구가 ${[...text].length}자다 — ${slot.maxChars}자 이하로 줄여야 한다`, where)
    if (slot.placeholder && text.trim() !== ph) add('placeholder', `「${slot.id}」 칸은 사실(${(slot.factsWanted ?? []).join('·')})이 없으니 정확히 「${ph}」여야 한다`, where)
    if (!slot.placeholder && (text.trim() === ph || text.trim() === otherPh)) add('placeholder', `「${slot.id}」 칸에 자리 표시 「${text.trim()}」가 남았다 — 사실이 있거나 사실 칸이 아니다`, where)
    if (CTA_SLOT_ID.test(slot.id) && text.trim() !== ph && CTA_BANNED[locale].test(text.trim())) add('cta', `CTA 「${text.trim()}」는 동사 + 받는 것으로 쓴다(예: 「예약하기」가 아니라 「자리 예약하기」처럼 다음 화면이 예측되게)`, where)
    if (locale === 'en' && /[가-힣]/.test(text)) add('locale', `en 문구에 한글이 있다: ${text.slice(0, 20)}`, where)
    if (slot.ui) {
      if (UI_EXAMPLE_MARKER.test(text)) add('ui-copy', `예시 표지가 남았다 — "${text.slice(0, 30)}"`, where)
      else if (uiSameAsExample(text, slot.ui.example) && slot.ui.numbers !== 'structural') add('ui-copy', '예시 문장 그대로다(예시 표지만 뗀 것도 같다) — 이 서비스에 맞게 다시 쓴다', where)
      if (uiTokens(text) !== uiTokens(slot.ui.example)) add('ui-copy', `자리 표시 ${uiTokens(slot.ui.example) || '없음'} 을 그대로 가져야 한다(지금 ${uiTokens(text) || '없음'})`, where)
    }
  }
  const have = new Map()
  for (const [id, list] of byId) have.set(id, list.length)
  for (const [id, n] of have) if (n > (seen.get(id) ?? 0)) add('copy-slot', `요청에 없는 문구 칸이다(요청 ${seen.get(id) ?? 0}개, 콘텐츠 ${n}개): ${id}`, 'slots.copy')

  // 5) 문구 변형 태그(J2 copyVariant)
  if (content.copyVariants !== undefined) {
    if (!isObj(content.copyVariants)) add('copy-variant', 'copyVariants 는 { "<쪽>/<섹션>": id } 객체여야 한다', 'copyVariants')
    else for (const [key, id] of Object.entries(content.copyVariants)) {
      if (!request.sections.includes(key)) add('copy-variant', `요청에 없는 섹션이다: ${key}`, `copyVariants.${key}`)
      if (typeof id !== 'string' || !COPY_VARIANT_ID.test(id)) add('copy-variant', `id 는 소문자·숫자·- 32자 이하여야 한다: ${JSON.stringify(id)}`, `copyVariants.${key}`)
    }
  }

  // 6) 문체·금지어 — 문구로 읽을 글자만
  const factValues = new Set(Object.values(request.facts).map(norm))
  const banned = [...COMMON_BANNED, ...(locale === 'ko' ? KO_BANNED : EN_BANNED)]
  for (const { path, value } of proseOf(content, factValues)) {
    const where = fmt(path)
    for (const [id, re, why] of banned) if (re.test(value)) add(id, `${why} — "${value.slice(0, 40)}"`, where)
    if (locale === 'ko') for (const s of sentencesOf(value)) {
      if (!/[가-힣]/.test(s)) continue
      const end = stripEnd(s)
      if (KO_FORMAL.test(end) || (/[.。]$/.test(s) && KO_PLAIN.test(end))) add('ko-register', `해요체로 쓴다(합쇼체·해라체 끝맺음) — "${s.slice(0, 40)}"`, where)
    }
  }

  // 7) 지어낸 사실
  out.push(...inventedFacts(request, content))

  // 8) 구조 칸 — 사실 없는 칸을 채움 · 사실 있는 칸을 비움 · 항목이 사실에 없음(content-structure.mjs)
  out.push(...checkStructure(request, content))
  return [...new Set(out)]
}

/** 콘텐츠의 문구 칸을 요청 칸에 묶는다(같은 id 는 요청 순서). 06-pages 가 같은 규칙으로 읽는다. → Map<slot.path, { slot, entry }> */
export function bindCopy(request, content) {
  const copy = Array.isArray(content?.slots?.copy) ? content.slots.copy : []
  const seen = new Map()
  const bound = new Map()
  for (const slot of request.slots) {
    const k = seen.get(slot.id) ?? 0
    seen.set(slot.id, k + 1)
    const entry = copy.filter((c) => c?.id === slot.id)[k]
    if (entry) bound.set(slot.path, { slot, entry })
  }
  return bound
}

/** 섹션 키("<쪽>/<섹션>")의 copyVariant id(없으면 undefined) — withAttribution(analytics, { blockId, recipeId, copyVariant })에 넘긴다. */
export const copyVariantFor = (content, sectionKey) => {
  const id = content?.copyVariants?.[sectionKey]
  return typeof id === 'string' && COPY_VARIANT_ID.test(id) ? id : undefined
}

// ── 단계(J7) ─────────────────────────────────────────────────────────────
function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}

/**
 * 04-content 단계. 요청 파일(04-content.request.json)을 쓰고, 문구 에이전트가 쓴 04-content.json 을 검사한다.
 *   needs-copy  아직 04-content.json 이 없다 — 에이전트가 COPY.md 대로 쓴다
 *   stale       04-content.json 이 다른 요청(앞 단계·브리프가 바뀜)으로 만든 것이다 — 다시 쓴다
 *   invalid     검사에서 떨어졌다(problems) — 고쳐 쓴다
 *   ok          통과. 에이전트가 쓴 원본이면 J7 단계 파일 모양({ inputHash, producedAt, data })으로 다시 써 이후 실행이 건너뛴다.
 */
export function runContentStage(run, cand, sitemap, variants, seed, ctx) {
  const request = contentRequest(cand, sitemap, variants, seed, ctx)
  const dir = join(run.dir, cand.id)
  const requestFile = join(dir, '04-content.request.json')
  writeAtomic(requestFile, JSON.stringify(request, null, 2) + '\n')
  const file = join(dir, '04-content.json')
  const hash = inputHash(request)
  if (!existsSync(file)) return { status: 'needs-copy', request, requestFile }
  let saved
  try { saved = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return { status: 'invalid', problems: [`[schema] 04-content.json 을 읽지 못했다: ${e.message}`], request, requestFile } }
  const wrapped = isObj(saved) && 'inputHash' in saved && 'data' in saved
  if (wrapped && saved.inputHash !== hash) return { status: 'stale', request, requestFile }
  const content = wrapped ? saved.data : saved
  const problems = validateContent(request, content)
  if (problems.length) return { status: 'invalid', problems, request, requestFile }
  if (!wrapped) writeAtomic(file, JSON.stringify({ inputHash: hash, producedAt: new Date().toISOString(), data: content }, null, 2) + '\n')
  return { status: 'ok', content, request, requestFile }
}

// ── CLI ──────────────────────────────────────────────────────────────────
// node factory/stamp/content.mjs --check <04-content.request.json> <04-content.json>
//   0 = 통과 · 1 = 문제 있음(줄마다 출력) · 2 = 인자·파일 오류. 문구 에이전트가 쓰는 도중에 돌린다(COPY.md).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [flag, requestFile, contentFile] = process.argv.slice(2)
  if (flag !== '--check' || !requestFile || !contentFile) {
    console.error('사용법: node factory/stamp/content.mjs --check <04-content.request.json> <04-content.json>')
    process.exit(2)
  }
  let request, content
  try {
    request = JSON.parse(readFileSync(requestFile, 'utf8'))
    const saved = JSON.parse(readFileSync(contentFile, 'utf8'))
    content = isObj(saved) && 'inputHash' in saved && 'data' in saved ? saved.data : saved
  } catch (e) {
    console.error(`도구 실패: 파일을 읽지 못했다 — ${e.message}`)
    process.exit(2)
  }
  const problems = validateContent(request, content)
  for (const p of problems) console.log(p)
  console.log(problems.length ? `문제 ${problems.length}건` : '통과 — 문제 0건')
  process.exit(problems.length ? 1 : 0)
}
