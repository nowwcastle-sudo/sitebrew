// 06-pages 시험 공용 재료(P3-3 Task 9 → 9b 에서 stamp-pages.test.mjs 에서 옮겼다): 시험용 브리프·콘텐츠(문구 에이전트가 하는 일을 대신하는 함수)와
// 후보 하나의 앞 단계 파일(01~04)을 만드는 makeRun. 실제 원형·블록·라이브러리 레시피·콘텐츠 스키마를 쓴다(녹화 없음).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadArchetypes } from '../archetypes.mjs'
import { loadLibrary } from '../style-presets.mjs'
import { openRun } from '../../stamp/run-dir.mjs'
import { buildSitemap, writeCandidateBlockers } from '../../stamp/sitemap.mjs'
import { chooseVariants } from '../../stamp/variants.mjs'
import { contentRequest, PLACEHOLDER } from '../../stamp/content.mjs'
import { generateSite } from '../../stamp/gen-pages.mjs'
import { readinessTable, uiSlotTable } from '../../stamp/ui-copy.mjs'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const archetypes = await loadArchetypes()
export const library = loadLibrary()

export const KO = {
  headline: '매일 아침 굽는 동네 빵집', tagline: '매일 아침 굽는 동네 식빵집', subhead: '우유와 밀가루만 넣어요', todayHours: '오늘 10:00~20:00에 열어요', addressLine: '서울특별시 마포구 달빛로 12, 1층',
  primaryCta: '전화로 자리 예약하기', secondaryCta: '가격표 열어 보기', item: '우유식빵', address: '서울특별시 마포구 달빛로 12, 1층', transit: '달빛역 2번 출구에서 걸어서 3분이에요', parking: '주차는 어려워요',
  claim: '작은 가게가 쓰는 예약 도구예요', planName: '기본', price: '월 9,900원', quote: '정산이 빨라졌어요', title: '연동 도구', apiNote: '나머지는 API로 이어요', body: '전담 담당자가 도와요',
}
// 화면 문구 칸(slot.ui)은 예시 표지 없이 다시 쓴 안내 문장 — 예시의 {…} 자리 표시는 그대로 가져야 검사를 통과한다(문구 에이전트가 하는 일을 대신한다)
export const uiText = (slot) => `이 서비스 안내예요 ${[...String(slot.ui.example).matchAll(/\{[A-Za-z_]+\}/g)].map((m) => m[0]).join(' ')}`.trim()
export const text = (slot, ph) => (slot.ui ? uiText(slot) : slot.placeholder ? ph : KO[slot.id] ?? '자세한 내용은 물어봐 주세요.')

export const LOCAL_FACTS = { name: '달빛 베이커리', phone: '02-1234-5678', address: '서울특별시 마포구 달빛로 12, 1층', hours: '화-수 10:00-20:00', bizNo: '123-45-67890', email: 'hello@moonlight-bakery.kr', menu: '우유식빵 4,800원 · 소금빵 3,200원', faq: '주차·예약 안내', transit: '달빛역 2번 출구', parking: '주차 어려움', notice: '10월 3일 휴무', notices: '2026-10-03 | 10월 3일은 쉬어요', bookableSlots: '영업일 오전 10시부터 1시간 단위로 상담해요', price: '식빵 4,800원', naverMapUrl: 'https://map.naver.com/p/entry/place/1', kakaoMapUrl: 'https://place.map.kakao.com/1' }
export const localBrief = (facts = LOCAL_FACTS) => ({ topic: '동네 식빵집', archetype: 'local', locale: 'ko', facts })
export const noPhone = () => localBrief(Object.fromEntries(Object.entries(LOCAL_FACTS).filter(([k]) => k !== 'phone')))

export function localContent(request) {
  const ph = PLACEHOLDER.ko
  const business = { ...request.seedContent.business }
  for (const name of request.missing) { const p = request.factPaths[name]; if (p[0] === 'business') business[p[1]] = ph }
  return {
    archetype: 'local', locale: 'ko', business,
    hours: [{ day: 'tu', opens: '10:00', closes: '20:00' }, { day: 'we', opens: '10:00', closes: '20:00' }],
    booking: { primary: { kind: 'tel', value: request.missing.includes('booking') ? ph : '02-1234-5678' } },
    mapLinks: { naver: 'https://map.naver.com/p/entry/place/1', kakao: 'https://place.map.kakao.com/1' },
    directions: { transit: '달빛역 2번 출구에서 걸어서 3분이에요', parking: '주차는 어려워요' },
    faq: [{ q: '주차가 되나요?', a: '주차는 어려워요.' }, { q: '예약이 필요한가요?', a: '전화로 예약하면 자리를 잡아 둬요.' }],
    menu: [{ name: '우유식빵', price: 4800 }, { name: '소금빵', price: 3200 }],
    notices: [{ date: '2026-10-03', text: '10월 3일은 쉬어요' }],
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, ph) })), images: [] },
  }
}

export const SAAS_BRIEF = { topic: '예약 관리 도구', archetype: 'saas', locale: 'ko', facts: { name: '예약노트', bizNo: '123-45-67890', email: 'hello@yeyaknote.kr', price: '월 9,900원', address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678', productUrl: 'https://yeyaknote.kr' } }
export function saasContent(request) {
  const business = { ...request.seedContent.business, address: '서울특별시 마포구 달빛로 12', phone: '02-1234-5678' }
  return {
    archetype: 'saas', locale: 'ko', business,
    product: { name: request.seedContent.business.name, url: 'https://yeyaknote.kr' },
    plans: [{ name: '기본', monthlyPrice: 9900, currency: 'KRW', features: ['예약 관리', '문자 알림'] }, { name: '팀', monthlyPrice: 19900, currency: 'KRW', features: ['직원 계정 5개'] }],
    integrations: [{ name: '달빛메일', url: 'https://mail.dalbit-mail.kr/integration', kind: 'native' }],
    testimonials: [], workflowSteps: [{ title: '예약 받기', body: '손님이 고른 시간이 달력에 들어와요', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: '예약 화면' } }, { title: '알림 보내기', body: '방문 전날 문자가 나가요', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: '예약 화면' } }, { title: '하루 마감', body: '오늘 온 예약을 한 화면에서 봐요', uiCrop: { id: 'step-ui-crop', aspect: '4:3', source: 'real-required', alt: '예약 화면' } }],
    facts: { ...request.seedContent.facts },
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: text(s, PLACEHOLDER.ko) })), images: [] },
  }
}

/**
 * 후보 하나의 앞 단계 파일을 만든다(01~04). → { runDir, cand, sitemap, request, content, archetype }
 * @param {string} tmp  실행 폴더를 만들 부모(저장소 .tmp 아래 — check:regen 밖)
 */
export async function makeRun(tmp, brief, contentFor, { recipe = library[0].id, patch = (c) => c, patchVariants = (v) => v, uiSlots: uiSlotsIn } = {}) {
  mkdirSync(tmp, { recursive: true })
  const runDir = mkdtempSync(join(tmp, 'run-'))
  const archetype = archetypes[brief.archetype]
  const sitemap = buildSitemap(archetype, brief)
  const cand = { id: 'a', slot: 'library', source: 'library', recipe }
  // 03-variants: 문구로 못 채우는 변형(지어낸 수치·가상 이름이 남는 것)은 다른 변형이 있으면 고르지 않는다(readiness)
  const allowed = [...sitemap.pages.flatMap((p) => p.sections), ...(sitemap.globals ?? [])].flatMap((x) => x.allowedVariants ?? [])
  const variants = { a: patchVariants(chooseVariants(sitemap, [cand], { seed: 7, weights: [], readiness: await readinessTable(allowed) }).a) }
  const run = openRun(runDir)
  await run.step('a', '02-sitemap', {}, () => sitemap)
  await run.step('a', '03-variants', {}, () => variants.a)
  // 화면 문구 칸(C112): 기본으로 켠다. uiSlots: false 면 끈다(옛 요청 모양 시험)
  const uiSlots = uiSlotsIn === false ? undefined : uiSlotsIn ?? (await uiSlotTable(Object.values(variants.a)))
  const request = contentRequest(cand, sitemap, variants, 7, { archetype, brief, ...(uiSlots ? { uiSlots } : {}) })
  writeFileSync(join(runDir, 'a', '04-content.request.json'), JSON.stringify(request))
  const content = patch(contentFor(request))
  await run.step('a', '04-content', {}, () => content)
  writeCandidateBlockers(runDir, 'a', sitemap)
  return { runDir, cand, sitemap, request, content, archetype }
}
export const gen = (r, opts = {}) => generateSite(r.runDir, r.cand, { install: false, ...opts })

// ── 상세페이지(detail) — 한국어 원화·영어 USD(센트) 두 벌(P3-3 detail 레인, 대장 C160) ──
export const DETAIL_KO_FACTS = { name: '린넨 앞치마', price: '29,000원', seller: '결이 공방', bizNo: '123-45-67890', email: 'hello@gyeol.kr', address: '서울특별시 성동구 성수로 3, 2층', phone: '02-555-0100', shipping: '배송비 3,000원, 5만원 이상 무료, 3일 안에 출고', returns: '7일 안 반품, 반품 배송비는 구매자 부담', shippingFee: '3000', returnsFeePayer: 'buyer', courier: '한진택배', noticeCategory: '의류', specs: '린넨 100%' }
export const DETAIL_EN_FACTS = { name: 'Hand-thrown ceramic dripper', price: '$48 including VAT', seller: 'Kiln & Kettle Studio', bizNo: '123-45-67890', email: 'hello@kilnkettle.com', address: '12 Studio Road, Seoul', phone: '+82-2-555-0100', shipping: 'Ships within 3 business days, free over $80', returns: 'Return within 14 days', shippingFee: '5', returnsFeePayer: 'buyer', courier: 'CJ Logistics', noticeCategory: 'Kitchenware', specs: 'Stoneware, dishwasher safe' }
export const detailBrief = (locale) => ({ topic: locale === 'ko' ? '린넨 앞치마' : 'Ceramic pour-over dripper', archetype: 'detail', locale, facts: locale === 'ko' ? DETAIL_KO_FACTS : DETAIL_EN_FACTS })
const DETAIL_EN_TEXT = { name: 'Hand-thrown ceramic dripper', shipping: 'Ships within 3 business days, free over $80', returnsSummary: 'Return within 14 days of delivery', price: '$48 including VAT' }
/** detail 콘텐츠(문구 에이전트가 하는 일을 대신한다). 영어는 USD 센트(4800 = $48.00), 한국어는 원화. 리뷰 둘(낮은 별점에 판매자 답글). */
export const detailContent = (locale, { reviews } = {}) => (request) => {
  const ko = locale === 'ko'
  const review = (rating, body, date, extra = {}) => ({ rating, text: body, photos: [], date, ...extra })
  return {
    archetype: 'detail', locale, business: { ...request.seedContent.business },
    product: ko
      ? { name: '린넨 앞치마', rating: { avg: 4.5, count: 2 }, price: 29000, currency: 'KRW', taxIncluded: true, shipping: { fee: 3000, freeThreshold: 50000, courier: '한진택배', leadDays: 3 }, returns: { feePayer: 'buyer', withdrawalDays: 7, exclusions: [] }, options: [{ name: '색상', values: ['아이보리', '차콜'] }] }
      : { name: 'Hand-thrown ceramic dripper', rating: { avg: 4.5, count: 2 }, price: 4800, currency: 'USD', taxIncluded: true, shipping: { fee: 500, freeThreshold: 8000, courier: 'CJ Logistics', leadDays: 3 }, returns: { feePayer: 'buyer', withdrawalDays: 14, exclusions: [] }, options: [{ name: 'Glaze', values: ['Sand', 'Ink'] }] },
    notice: { category: ko ? '의류' : 'Kitchenware', rows: [{ label: ko ? '소재' : 'Material', value: ko ? '린넨 100%' : 'Stoneware' }] },
    slices: [],
    reviews: reviews ?? (ko
      ? [review(5, '두께가 좋아요', '2026-09-20'), review(4, '끈이 조금 짧아요', '2026-09-25', { sellerReply: { text: '끈 길이를 늘릴게요', date: '2026-09-26' } })]
      : [review(5, 'Sturdy and pours evenly', '2026-09-20'), review(4, 'Slightly heavy', '2026-09-25', { sellerReply: { text: 'Thanks for the note', date: '2026-09-26' } })]),
    slots: { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: ko ? text(s, PLACEHOLDER.ko) : s.placeholder ? PLACEHOLDER.en : (DETAIL_EN_TEXT[s.id] ?? 'Ask us anything about this product.') })), images: [] },
  }
}
