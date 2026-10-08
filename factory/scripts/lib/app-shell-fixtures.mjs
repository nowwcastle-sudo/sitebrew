// 앱 셸(FV1 Task 5.18) 시험 공용 재료 — dashboard·pwa 후보 하나와 「다른 원형」 후보들의 06 출력을 만들고 해시를 뜬다.
//   · dashboardRun / pwaRun: stamp-site-fixtures.makeRun 으로 02~04 를 만든 뒤 06(정적, install: false)을 돌릴 수 있는 실행.
//   · OTHER_RUNS: dashboard·pwa 가 아닌 원형 후보들(local·saas·detail ko/en·brand·public·portfolio·commerce·landing). 이들의 06 출력은 앱 셸 변경 전과 글자 하나도 달라지면 안 된다.
//   · hashSite: 사이트 폴더의 글자 파일(.tsx .ts .json .mjs .css .txt .md)을 상대 경로 순으로 sha256 한 표. 그림·글꼴 같은 이진 파일은 뺀다(sharp 판에 따라 바이트가 달라질 수 있다).
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLACEHOLDER } from '../../stamp/content.mjs'
import { LOCAL_FACTS, SAAS_BRIEF, detailBrief, detailContent, localBrief, localContent, makeRun, saasContent, text } from './stamp-site-fixtures.mjs'
import { brand1, goldenOf, portfolio1, public1 } from './stamp-structure-fixtures.mjs'

/** 문구 칸은 기본 문장, 사실 칸은 자리 표시인 04 콘텐츠(구조 칸 없음). */
export const plainContent = (archetype, extra = {}) => (request) => {
  const { facts, ...seed } = request.seedContent
  return { archetype, locale: request.locale, ...seed, ...extra, facts: { ...facts }, slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER[request.locale] ?? PLACEHOLDER.ko) })), images: [] } }
}

export const DASHBOARD_BRIEF = { topic: '창고 재고 현황판', archetype: 'dashboard', locale: 'ko', facts: { name: '한결재고판', email: 'ops@dalbit-stock.kr', phone: '02-1234-5678', address: '인천광역시 서구 달빛로 300', refresh: '5분마다 새로 고쳐요' } }
export const dashboardContent = (extra = {}) => plainContent('dashboard', { decision: { dashboard_type: 'operational', refresh: '5분마다 새로 고쳐요' }, kpis: [], alerts: [], ...extra })
export const dashboardRun = (tmp, { extra, locale } = {}) => makeRun(tmp, { ...DASHBOARD_BRIEF, ...(locale ? { locale } : {}) }, dashboardContent(extra))

export const PWA_BRIEF = { topic: '습관 기록 앱', archetype: 'pwa', locale: 'ko', facts: { name: '하루셈', email: 'hello@haru-sem.kr' } }
export const pwaExtra = {
  manifest: { name: '하루셈', short_name: '하루셈', description: '습관을 두 번 눌러 기록해요', icons: [{ src: '/icon-192.png', sizes: '192x192', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', purpose: 'any' }, { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }], start_url: '/', display: 'standalone', theme_color: '#1f2933', background_color: '#ffffff', screenshots: [] },
  offline: { fallbackUrl: '/offline', precache: [] },
  strings: { offline: '인터넷 연결이 끊겼어요', serviceDown: '서비스를 점검하고 있어요', savedPending: '저장됨 · 연결되면 보내요', synced: '동기화했어요', updateAvailable: '새 버전이 있어요 — 새로고침' },
}
export const pwaRun = (tmp, { extra = {} } = {}) => makeRun(tmp, PWA_BRIEF, plainContent('pwa', { ...pwaExtra, ...extra }))

/** dashboard·pwa 가 아닌 원형 후보들 — [{ id, make(tmp) → makeRun 결과 }]. */
export const OTHER_RUNS = [
  { id: 'local', make: (tmp) => makeRun(tmp, localBrief(LOCAL_FACTS), localContent) },
  { id: 'saas', make: (tmp) => makeRun(tmp, SAAS_BRIEF, saasContent) },
  { id: 'detail-ko', make: (tmp) => makeRun(tmp, detailBrief('ko'), detailContent('ko')) },
  { id: 'detail-en', make: (tmp) => makeRun(tmp, detailBrief('en'), detailContent('en')) },
  { id: 'brand-1', make: (tmp) => makeRun(tmp, goldenOf('brand-1').brief, brand1) },
  { id: 'public-1', make: (tmp) => makeRun(tmp, goldenOf('public-1').brief, public1) },
  { id: 'portfolio-1', make: (tmp) => makeRun(tmp, goldenOf('portfolio-1').brief, portfolio1) },
  { id: 'commerce-1', make: (tmp) => makeRun(tmp, goldenOf('commerce-1').brief, plainContent('commerce', { products: [{ slug: 'house-blend', name: '하우스 블렌드 200g', price: 14000, category: '원두', thumbs: [{ id: 'thumb', aspect: '1:1', source: 'real-required', alt: '하우스 블렌드 200g 사진' }] }, { slug: 'drip-bag', name: '드립백 10개', price: 9000, category: '드립백', thumbs: [{ id: 'thumb', aspect: '1:1', source: 'real-required', alt: '드립백 10개 사진' }] }], shipping: { fee: 3000, freeThreshold: 50000, courier: '한진택배', leadDays: 2 } })) },
  { id: 'landing-1', make: (tmp) => makeRun(tmp, goldenOf('landing-1').brief, plainContent('landing', { oneLiner: '가을 북페어에 미리 등록해요' })) },
]

const TEXT_FILE = /\.(?:tsx?|json|mjs|css|txt|md)$/
/** 사이트 폴더의 글자 파일 → { 상대경로: sha256 앞 16자 } (상대 경로 순). node_modules·.next·localreg 는 뺀다. */
export function hashSite(siteDir) {
  const out = {}
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) { if (!['node_modules', '.next', '.next-export', 'localreg'].includes(e.name)) walk(join(dir, e.name), `${rel}${e.name}/`); continue }
      if (!TEXT_FILE.test(e.name)) continue
      if (rel === '' && e.name === 'package-lock.json') continue // 템플릿의 의존성 잠금 파일(FINAL-WF P5) — 06 이 만든 출력이 아니다
      out[`${rel}${e.name}`] = createHash('sha256').update(readFileSync(join(dir, e.name))).digest('hex').slice(0, 16)
    }
  }
  walk(siteDir, '')
  return out
}
