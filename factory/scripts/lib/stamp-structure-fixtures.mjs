// 04 구조 칸 시험·시연 공용 재료(대장 C297, 레인 DATA04) — 골든 브리프 → 02·03 → 04 요청 → 「문구 에이전트가 하는 일을 대신하는」 손으로 쓴 04 콘텐츠.
// 콘텐츠는 골든 브리프의 사실만으로 쓴다(지어낸 것 없음 — 시험이 이 콘텐츠가 검사를 0건으로 통과해야 음성 대조가 의미를 갖는다).
import { loadArchetypes } from '../archetypes.mjs'
import { buildSitemap } from '../../stamp/sitemap.mjs'
import { goldenSet } from '../../stamp/golden.mjs'
import { chooseVariants } from '../../stamp/variants.mjs'
import { contentRequest, PLACEHOLDER, SCHEMA_FACTS } from '../../stamp/content.mjs'

const archetypes = await loadArchetypes()
const goldens = goldenSet()
export const goldenOf = (id) => goldens.find((g) => g.id === id)

/** 골든 하나의 04 요청(후보 a, 라이브러리 안). 03 변형은 readiness 없이 고른다(문구 칸 쪽 시험이 아니다). → { golden, archetype, sitemap, request } */
export function goldenRequest(id, { brief } = {}) {
  const golden = goldenOf(id)
  const archetype = archetypes[golden.archetype]
  const b = brief ?? golden.brief
  const sitemap = buildSitemap(archetype, b)
  const cand = { id: 'a', slot: 'library', source: 'library', recipe: 'r1-measure' }
  const variants = chooseVariants(sitemap, [cand], { seed: golden.seed, weights: [] })
  const request = contentRequest(cand, sitemap, variants, golden.seed, { archetype, brief: b })
  return { golden, archetype, sitemap, request }
}

const setPath = (obj, path, value) => {
  let o = obj
  for (const k of path.slice(0, -1)) o = o[k] ??= {}
  o[path.at(-1)] = value
}
const COPY_TEXT = {
  ko: { default: '자세한 내용은 물어봐 주세요.', tagline: '한옥에서 차를 마셔요', h1: '필름으로 기록하는 사진가', mission: '백 년 된 한옥에서 차를 내어 드려요' },
  en: { default: 'Ask us anything about this.', tagline: 'Loose-leaf tea in tins', h1: 'Calm tools for daily use', mission: 'We blend tea from two family gardens' },
}

/** 요청 + 구조 칸 추가분 → 04 콘텐츠. 빈 사실 자리는 자리 표시, 문구 칸은 기본 문장(사실 칸은 자리 표시). */
export function contentFrom(request, extra) {
  const ph = PLACEHOLDER[request.locale]
  const t = COPY_TEXT[request.locale]
  const c = structuredClone(request.seedContent)
  c.archetype = request.archetype
  c.locale = request.locale
  for (const name of request.missing) setPath(c, request.factPaths[name], ph)
  // 스키마 칸이 사실에서 오는 자리(SCHEMA_FACTS — 택배사·약관 주소·전화 안내 …)는 문구 에이전트가 사실 글자 그대로 옮긴다. 숫자·목록 칸으로 가는 detail 은 이 시험 재료가 쓰지 않는다.
  if (request.archetype !== 'detail') for (const { path, from } of Object.values(SCHEMA_FACTS[request.archetype] ?? {})) {
    const fact = from.map((n) => request.facts[n]).find(Boolean)
    if (fact) setPath(c, path, fact)
  }
  c.slots = { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: s.placeholder ? ph : (t[s.id] ?? t.default) })), images: [] }
  return { ...c, ...extra }
}

const portrait = (name) => ({ id: 'portrait', aspect: '4:5', source: 'real-required', alt: `${name} 사진` })
const thumb = (alt) => ({ id: 'work-thumb', aspect: '4:3', source: 'real-required', alt })

/** brand-1 — 소식 3 · 연혁 4 · 리더 2 · 보고서 1 · 채용 주소. */
export const brand1 = (request) => contentFrom(request, {
  tagline: '한옥에서 차를 마셔요',
  news: [
    { date: '2026-09-03', title: '가을 찻자리 예약을 시작했어요', url: 'https://example.com/news/autumn-tea' },
    { date: '2026-05-02', title: '마루 찻집에 여름 차 메뉴가 나왔어요', url: 'https://example.com/news/summer-menu' },
    { date: '2024-11-20', title: '한옥 보존 우수 업장에 선정됐어요', url: 'https://example.com/news/preservation-award' },
  ],
  history: [
    { year: 2018, event: '백 년 된 한옥을 사서 고치기 시작했어요' }, { year: 2019, event: '마루 찻집 문을 열었어요' },
    { year: 2022, event: '하룻밤 머무는 방 4칸을 열었어요' }, { year: 2024, event: '한옥 보존 우수 업장에 선정됐어요' },
  ],
  leaders: [
    { name: '윤도현', title: '대표', bio: '한옥 보존 설계를 15년 했고 찻집 운영을 맡아요', portrait: portrait('윤도현') },
    { name: '이서윤', title: '찻집 총괄', bio: '차 소믈리에 자격을 갖고 덖음차를 골라요', portrait: portrait('이서윤') },
  ],
  reports: [{ year: 2025, title: '2025 지속가능성 보고서', pdfUrl: 'https://example.com/reports/2025-sustainability.pdf', pages: 12, size: '1.8MB' }],
  careersUrl: 'https://example.com/careers',
})

/** brand-2(en) — 소식 3 · 연혁 3 · 리더 2 · 보고서 1 · 채용 주소(FV1 6.2 가 보고서·채용 주소·소식 주소 사실을 채웠다). */
export const brand2 = (request) => contentFrom(request, {
  tagline: 'Loose-leaf tea in tins',
  news: [
    { date: '2026-09-10', title: 'Dusk No. 4 is back for autumn', url: 'https://example.com/news/dusk-no-4' },
    { date: '2026-06-02', title: 'Our tins now ship to 30 independent cafes', url: 'https://example.com/news/ship-to-30-cafes' },
    { date: '2026-03-15', title: 'A second family garden joins the harvest', url: 'https://example.com/news/second-garden' },
  ],
  history: [{ year: 2021, event: 'Founded with one blend from one garden' }, { year: 2023, event: 'Added a second family garden' }, { year: 2025, event: 'Twelve blends now sit in 30 independent cafes' }],
  leaders: [
    { name: 'Amara Ellis', title: 'Founder and CEO', bio: 'Blends every tea herself and visits both gardens each season', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: 'Amara Ellis photo' } },
    { name: 'Jun Park', title: 'Head of Sourcing', bio: 'Works with the two family gardens all year', portrait: { id: 'portrait', aspect: '4:5', source: 'real-required', alt: 'Jun Park photo' } },
  ],
  reports: [{ year: 2025, title: '2025 Sourcing Report: how we choose and pay our two family gardens', pdfUrl: 'https://example.com/reports/2025-sourcing.pdf', pages: 8, size: '1.2MB' }],
  careersUrl: 'https://example.com/careers',
})

/** public-1 — 바로가기 4 · 공지 4(공지 주소는 사실에 있다). 정책 카드는 문구 칸 셋이다. */
export const public1 = (request) => contentFrom(request, {
  decision: { krds_scope: { agencyType: 'local-gov', level: 'standard', officialBanner: false, identifier: false } },
  quickLinks: [
    { label: '도서 검색', href: 'https://example.com/catalog' }, { label: '대출 기간 연장', href: 'https://example.com/renew' },
    { label: '이용 안내', href: '/guide' }, { label: '프로그램 신청', href: 'https://example.com/programs' },
  ],
  notices: [
    { date: '2026-09-20', category: '이용 안내', title: '추석 연휴 휴관 안내', department: '운영지원팀', url: 'https://example.com/notices/chuseok-closed' },
    { date: '2026-09-12', category: '프로그램', title: '가을 독서 교실 참가자를 모집해요', department: '어린이자료실', url: 'https://example.com/notices/reading-class' },
    { date: '2026-09-05', category: '휴관 공지', title: '서가 정리로 일반자료실이 하루 쉬어요', department: '일반자료실', url: 'https://example.com/notices/shelf-day' },
    { date: '2026-08-28', category: '이용 안내', title: '디지털자료실 컴퓨터를 새로 바꿨어요', department: '디지털자료실', url: 'https://example.com/notices/new-computers' },
  ],
  // QFIX [3] — 기관 안내(영업시간 표 · 오시는 길 · 지도 링크)와 하위 쪽 본문
  hours: [...['tu', 'we', 'th', 'fr'].map((day) => ({ day, opens: '09:00', closes: '20:00' })), ...['sa', 'su'].map((day) => ({ day, opens: '09:00', closes: '17:00' }))],
  directions: { transit: '가까운 지하철역 3번 출구에서 걸어서 5분', parking: '지하 주차장 40면(2시간 무료)' },
  mapLinks: { naver: 'https://example.com/maps/naver/haeoreum-library', kakao: 'https://example.com/maps/kakao/haeoreum-library' },
  subBody: ['도서는 한 번에 열 권까지 빌려요', '반납은 열린 시간에 무인 반납함에도 할 수 있어요', '휴관일에는 반납함만 열어요'],
})

/** portfolio-1 — 작업 4 · 사례 1(첫 사례를 사례 쪽이 그린다). */
export const portfolio1 = (request) => contentFrom(request, {
  statement: '필름으로 기록하는 사진가',
  contact: { email: 'hello@example.com' },
  works: [
    { slug: 'market-morning', title: '시장의 아침', client: '솔빛출판', disciplines: ['다큐멘터리'], year: 2025, thumb: thumb('시장의 아침 대표 사진') },
    { slug: 'alley-map', title: '골목 지도', client: '나들길 잡지', disciplines: ['여행'], year: 2024, thumb: thumb('골목 지도 대표 사진') },
    { slug: 'summer-coast', title: '여름 해변', client: '한뼘 카페', disciplines: ['브랜드'], year: 2025, thumb: thumb('여름 해변 대표 사진') },
    { slug: 'shop-people', title: '가게 사람들', client: '개인 작업', disciplines: ['인물'], year: 2023, thumb: thumb('가게 사람들 대표 사진') },
  ],
  caseStudies: [{
    slug: 'market-morning',
    meta: { client: '솔빛출판', services: ['필름 촬영', '보정'], year: 2025, role: '기획부터 촬영·보정까지 전부' },
    challenge: '새벽 시장의 흐름을 끊지 않고 사람들의 하루를 담아야 했어요',
    role: '편집자와 컷을 함께 골랐어요',
    process: ['새벽 시장을 사흘 걸어 다니며 동선을 익혔어요', '필름 두 롤로 시험 촬영을 했어요', '인물 중심 컷을 버리고 손과 물건 중심으로 다시 찍었어요'],
    solution: '손과 물건이 말하는 장면으로 연작을 짰어요',
    results: ['사진집 표지에 실렸어요', '2025년 사진 공모전에서 입선했어요'],
    next: 'alley-map',
  }],
})

/** public-2 — 바로가기 3 · 공지 3(공지 주소는 사실에 있다). */
export const public2 = (request) => contentFrom(request, {
  decision: { krds_scope: { agencyType: 'local-gov', level: 'standard', officialBanner: false, identifier: false } },
  quickLinks: [{ label: '진료 시간 안내', href: '/guide' }, { label: '예방접종 안내', href: '/guide' }, { label: '방문건강관리 신청', href: 'https://example.com/visit' }],
  notices: [
    { date: '2026-09-18', category: '예방접종', title: '독감 예방접종 시작 안내', department: '예방접종실', url: 'https://example.com/notices/flu-shot' },
    { date: '2026-09-02', category: '휴진', title: '추석 연휴 진료 안내', department: '진료실', url: 'https://example.com/notices/chuseok-hours' },
    { date: '2026-08-20', category: '방문건강관리', title: '방문건강관리 대상자를 모집해요', department: '방문건강관리팀', url: 'https://example.com/notices/visit-care' },
  ],
})

/** portfolio-2(en) — 작업 2 · 사례 1(첫 사례를 사례 쪽이 그린다). */
export const portfolio2 = (request) => contentFrom(request, {
  statement: 'Calm tools for daily use',
  contact: { email: 'hello@example.com' },
  works: [
    { slug: 'redesigning-pill-reminder', title: 'Redesigning a pill reminder app', client: 'Example Health App', disciplines: ['Interface design', 'User research'], year: 2025, thumb: { id: 'work-thumb', aspect: '4:3', source: 'real-required', alt: 'Redesigning a pill reminder app cover' } },
    { slug: 'budget-tool-for-couples', title: 'A budgeting tool for couples', client: 'Example Budget Tool', disciplines: ['Interface design'], year: 2024, thumb: { id: 'work-thumb', aspect: '4:3', source: 'real-required', alt: 'A budgeting tool for couples cover' } },
  ],
  caseStudies: [{
    slug: 'redesigning-pill-reminder',
    meta: { client: 'Example Health App', services: ['Interface design', 'User research'], year: 2025, role: 'Lead designer' },
    challenge: 'People skipped doses because reminders were easy to dismiss',
    role: 'Worked with one engineer and one pharmacist',
    process: ['Interviewed patients about their morning routine', 'Mapped when reminders get ignored', 'Dropped the streak counter after testing'],
    solution: 'A calm daily card that stays on screen until the dose is logged',
    results: ['Shortlisted for Example Design Awards 2025'],
    next: 'budget-tool-for-couples',
  }],
})
