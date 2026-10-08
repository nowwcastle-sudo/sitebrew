// 02-sitemap — 원형 + 브리프 → 쪽·섹션 목록(P3-3 Task 6, 대장 C75·C77).
//   · 필수 섹션은 모두 넣는다. 선택 섹션은 브리프에 그 섹션을 채울 사실이 있을 때만 넣는다(사실을 지어내지 않는다 — §9 Q8).
//   · 섹션 status 는 원형의 묶음 방식이다: block(블록 변형 고르기) · content(본문으로 그림) · part(ui 부품으로 그림) · pending(블록 없음, 대장 행).
//   · C75: 필수 pending 은 조용히 빼지 않는다 — status "pending" 과 대장 행 번호를 달고, 후보의 candidate.json 에 blockers(공개 불가)를 남긴다.
//         결선 보드(Task 12)가 그 문구를 보이고 공개가 막힌다. 선택 pending 은 사실이 있을 때만 들어오고 막지 않는다.
//         phase 가 v0 가 아닌 쪽(commerce 장바구니 — v0.2)은 사이트맵에 넣지 않고 excluded 에 이유를 적는다.
//   · C77: 원형 globalSections 를 블록 kind 에 묶는다(header→nav 등). 묶을 블록이 원형에 없으면 status "none".
//   · 법정 쪽(/privacy 등)은 원형 legal.pages 에서 온다(sections 없음, legal: true).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBlockIndex } from '../scripts/archetypes.mjs'

// 선택 섹션이 사실 없이도 들어가는 것 — 첫 화면·문의·동의처럼 브랜드 사실이 없어도 그릴 수 있는 기능 자리.
export const ALWAYS_INCLUDED = new Set(['hero', 'statement', 'contact-form', 'consent', 'notification-settings'])

// QFIX2 — 원형 JSON 이 필수로 적었지만 사실 없이는 지어내야만 그릴 수 있는 섹션(<원형>/<쪽>/<섹션>): 사실이 없으면 사이트맵에 넣지 않는다(공개 불가로 막지 않고 뺀다 — commerce notice-bar 와 같은 방식).
//  · local 공지 띠: 끝나는 날이 있는 공지만 그린다(마케팅 A8) — 날짜 붙은 공지 사실(notices)이 없으면 끝나는 날을 지어내야 한다.
//  · local 예약 단계 폼(C143): 날짜·시간 칩은 자체 예약 시스템이 있어야 참이다 — 가능한 날짜·시간 사실(bookableSlots)이 없으면 거짓 가능 시간을 그리게 된다. 실제 예약 행동(전화·채널)은 booking-cta 가 맡는다.
export const FACT_GATED = {
  'local/home/notice': ['notices'],
  'local/product-detail/bookable-item': ['bookableSlots'],
  //  · portfolio 소개(C111): 허용 변형이 브랜드 사실표 하나뿐이고 설립일(필수)·수치 차별점·대표 역할이 필요한데 portfolio 콘텐츠에 그 칸이 없다 — 설립일 사실이 있는 브리프에서만 둔다.
  'portfolio/home/about': ['founded'],
}

// 선택 섹션 → 그 섹션을 채우는 사실 이름(하나라도 있으면 채울 수 있다). 여기 없는 섹션은 섹션 이름 자체가 사실 이름이다
// (kind `key-facts` ↔ 사실 keyFacts·key-facts·keyfacts). 이름 비교는 소문자·영숫자·한글만 남겨 한다.
// 이 표는 첫 판이다(대장 C91) — 골든 브리프(Task 14)의 실제 사실 이름으로 다시 맞춘다.
export const SECTION_FACTS = {
  'social-proof': ['reviews', 'testimonials', 'clients', 'awards'],
  testimonials: ['testimonials', 'reviews'],
  'external-reviews': ['reviews', 'externalReviews', 'reviewLinks'],
  'review-list': ['reviews'],
  'client-roster': ['clients'],
  recognition: ['awards', 'recognition'],
  'hours-table': ['hours'],
  branches: ['branches', 'branchList'],
  'notice-bar': ['notice', 'announcement'],
  best: ['bestsellers', 'products'],
  'new-arrivals': ['newArrivals', 'products'],
  curated: ['curated', 'products'],
  'product-lineup': ['products', 'productLineup'],
  'brand-story': ['brandStory', 'story'],
  'shipping-pickup-info': ['shipping', 'pickup'],
  'trend-charts': ['metrics', 'charts'],
  'breakdown-panels': ['metrics', 'breakdown'],
  pricing: ['price', 'plans'], // landing 의 선택 요금 섹션 — 가격 사실이 있을 때만
  paywall: ['price'],
  'payment-failed': ['price'],
  'renewal-consent': ['price'],
  'usage-limit': ['usageLimit', 'quota'],
  'trial-ending': ['trial', 'trialDays'],
  'how-it-works': ['steps', 'howItWorks'],
  // 본문 섹션(C297 — 렌더러가 읽는 구조 자료의 사실 이름이 섹션을 연다, content-structure.mjs STRUCTURE_FACTS 와 같은 이름)
  leadership: ['leadership', 'leaders'],
  sustainability: ['sustainability', 'reports'],
  changelog: ['changelog', 'releases'],
  'policy-cards': ['policyCards'],
  'origin-info': ['origin'],
}

// 원형 전역 섹션 → 블록 kind(대장 C77). 여기 없는 것(kakao-channel-button·skip-link·top-bar 등)은 묶을 블록이 없다.
export const GLOBAL_BLOCK_KIND = {
  header: 'nav', footer: 'footer',
  'sticky-booking-bar': 'bottom-tab', 'sticky-buy-bar': 'bottom-tab', 'bottom-tab-bar': 'bottom-tab',
  'state-screens': 'state-screen', 'official-banner': 'announcement', 'emergency-notice': 'announcement',
  consent: 'consent', // landing 전역 동의 띠(선택) — 쪽 안 consent 섹션이 있는 원형은 쪽에서 고른다
}

// 법정 쪽 이름 → 경로.
export const LEGAL_ROUTES = { privacy: '/privacy', terms: '/terms', refund: '/refund', withdrawal: '/withdrawal' }

export const BLOCKER_PREFIX = '공개 불가 — 필수 섹션 블록 없음: '

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')

/** 브리프에 이 이름(들) 중 하나가 비지 않은 사실로 있는지. */
export function hasFact(brief, names) {
  const want = new Set(names.map(norm))
  return Object.entries(brief?.facts ?? {}).some(([k, v]) => want.has(norm(k)) && String(v ?? '').trim() !== '')
}

/** 선택 섹션이 이 브리프로 채워지는가. */
export const sectionHasFacts = (kind, brief) => ALWAYS_INCLUDED.has(kind) || hasFact(brief, SECTION_FACTS[kind] ?? [kind])

/** 원형 섹션 하나 → 사이트맵 섹션(buildSitemap 이 쓰고, 구획 더하기(revise-structure.mjs)도 같은 모양으로 넣는다). */
export function sectionOf(s) {
  const base = { kind: s.kind, required: s.required, importance: s.importance }
  if (s.allowedVariants.length) return { ...base, status: 'block', blockKinds: s.blockKinds, allowedVariants: s.allowedVariants }
  const nb = s.noBlock
  const register = nb.register ?? s.register
  return { ...base, status: nb.mode, reason: nb.reason, ...(nb.parts ? { parts: nb.parts } : {}), ...(register ? { register } : {}) }
}

// C110(P3-3 Task 9b): 머리글은 SiteShell(ui 부품 — 건너뛰기 링크·h1·고정 방식·현재 위치, 모양은 레시피 헤더 축 H1~H5)이 그린다. nav 블록을 쓰면 두 곳에서 그려 중복이고,
// 레시피 헤더 축이 무의미해진다. 그래서 이 전역 섹션에는 블록을 고르지 않는다(status "shell") — 03-variants 가 쓰이지 않을 nav 블록을 고르지 않게.
// nav 블록은 쪽 안 섹션(pwa 앱바 등)에서만 쓴다.
export const SHELL_GLOBALS = new Set(['header'])

function globalOf(g, archetypeId, index) {
  if (SHELL_GLOBALS.has(g.kind)) return { kind: g.kind, required: g.required, ...(g.condition ? { condition: g.condition } : {}), status: 'shell', reason: 'SiteShell 헤더가 그린다 — 모양은 레시피 헤더 축(H1~H5)이 정한다(대장 C110)' }
  const base = { kind: g.kind, required: g.required, ...(g.condition ? { condition: g.condition } : {}) }
  // 원형 JSON 이 전역 섹션의 허용 변형을 직접 적었으면(FV1 Task 5.9 — 같은 kind 의 두 블록을 두 전역 자리가 나눠 쓰는 앱 사이드바·상단 바 …) 그것을 따른다(원형 연결을 적은 블록만)
  if (g.allowedVariants?.length) {
    const own = g.allowedVariants.filter((n) => index.fit.get(n)?.includes(archetypeId))
    if (own.length) return { ...base, status: 'block', blockKinds: g.blockKinds, allowedVariants: own }
    return { ...base, status: 'none', reason: `${archetypeId} 원형을 archetypes 에 적은 허용 블록이 없다` }
  }
  const blockKind = GLOBAL_BLOCK_KIND[g.kind]
  const allowed = blockKind ? [...index.fit.keys()].filter((n) => n.startsWith(`block-${blockKind}-`) && index.fit.get(n).includes(archetypeId)).sort() : []
  if (allowed.length) return { ...base, status: 'block', blockKinds: [blockKind], allowedVariants: allowed }
  return { ...base, status: 'none', reason: blockKind ? `${archetypeId} 원형을 archetypes 에 적은 ${blockKind} 블록이 없다` : '묶을 블록 kind 가 없다' }
}

/**
 * @param {object} archetype  Task 1 원형(loadArchetypes 의 값)
 * @param {{ archetype: string, facts?: Record<string,string> }} brief  Task 2 Brief
 * @returns {{ archetype: string, pages: object[], globals: object[], excluded: object[], blockers: string[] }}
 */
export function buildSitemap(archetype, brief, { blockIndex } = {}) {
  if (archetype?.id !== brief?.archetype) throw new Error(`원형이 브리프와 다르다: 브리프 ${brief?.archetype} · 넘긴 원형 ${archetype?.id}`)
  const index = blockIndex ?? loadBlockIndex()
  const pages = []
  const excluded = []
  for (const p of archetype.pages) {
    if ((p.phase ?? 'v0') !== 'v0') { excluded.push({ page: p.id, why: `phase-${p.phase}` }); continue }
    const sections = []
    for (const s of p.sections) {
      const gate = FACT_GATED[`${archetype.id}/${p.id}/${s.kind}`]
      if (gate && !hasFact(brief, gate)) { excluded.push({ page: p.id, kind: s.kind, why: 'no-facts' }); continue }
      if (!s.required && !sectionHasFacts(s.kind, brief)) { excluded.push({ page: p.id, kind: s.kind, why: 'no-facts' }); continue }
      sections.push(sectionOf(s))
    }
    if (!sections.length) { excluded.push({ page: p.id, why: 'no-sections' }); continue }
    pages.push({ id: p.id, route: p.route, sections })
  }
  for (const name of archetype.legal.pages) pages.push({ id: name, route: LEGAL_ROUTES[name], legal: true, sections: [] })
  const globals = (archetype.globalSections ?? []).map((g) => globalOf(g, archetype.id, index))
  const sitemap = { archetype: archetype.id, pages, globals, excluded, blockers: [] }
  sitemap.blockers = sitemapBlockers(sitemap)
  return sitemap
}

/** 필수 pending 섹션마다 한 줄 — 후보의 candidate.json blockers 와 결선 보드가 그대로 쓴다. */
export function sitemapBlockers(sitemap) {
  return sitemap.pages.flatMap((p) => p.sections
    .filter((s) => s.required && s.status === 'pending')
    .map((s) => `${BLOCKER_PREFIX}${p.id}/${s.kind}${s.register ? ` (${s.register.join(', ')})` : ''}`))
}

/** 후보 폴더의 candidate.json 에 blockers 를 합친다(다른 칸은 그대로, 이 규칙이 남긴 줄만 바꾼다). 없으면 만든다. */
export function writeCandidateBlockers(runDir, candId, sitemap) {
  const file = join(runDir, candId, 'candidate.json')
  let cur = {}
  if (existsSync(file)) {
    try { cur = JSON.parse(readFileSync(file, 'utf8')) } catch { cur = {} }
  }
  const keep = (cur.blockers ?? []).filter((b) => !b.startsWith(BLOCKER_PREFIX))
  const next = { ...cur, blockers: [...keep, ...sitemap.blockers] }
  mkdirSync(join(runDir, candId), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
  return next.blockers
}

/** 02-sitemap 단계 파일(J7) — 입력 해시가 같으면 건너뛴다. 필수 pending 은 candidate.json blockers 로도 남긴다. */
export async function runSitemapStage(run, candId, { archetype, brief }) {
  const sitemap = await run.step(candId, '02-sitemap', { archetype, brief }, async () => buildSitemap(archetype, brief))
  writeCandidateBlockers(run.dir, candId, sitemap)
  return sitemap
}
