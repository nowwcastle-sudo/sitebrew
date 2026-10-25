// 대화형 입구의 질문 표(factory v1 Task 4.1 · 합의안 D3·D4) — 주제 한 줄 + 원형 뒤에 묻는 짧은 대화 6~8문항.
//   공통 6: 이름 · 대상 고객 · 핵심 행동 · 연락처 · 로고 · 분위기 단어 (D3 가 든 여섯 항목 그대로) + 브랜드 색 · 서체 2(FIT-3 — 필수 사실이 아니라 없어도 missing·previewOnly 가 안 바뀐다)
//   원형별 0~2: 그 원형이 화면에서 꼭 쓰는 사실 하나씩(local 영업시간 · commerce 대표 상품 · saas 요금제 …)
//   질문 하나 = 브리프 한 칸이다. `fact` 는 브리프 facts 의 이름(FACT_NAMES 안), 로고는 `brand.logo`.
//   답이 비면 그 칸은 브리프에 없다 — 04-content 가 「확인 필요」 자리 표시로 남기고 공개 관문이 막는다(지어내지 않는다, §9 Q8).
//   사진 안내(Task 5.16, design-imagery-real): 실사 필수(real-required) 사진 칸은 스톡으로 채우지 않고 「실제 사진 필요」로 막는다. 그래서 로고 질문 뒤에
//   「필요한 사진 N장 · 권장 구도」 한 줄을 붙여 미리 준비하게 한다. N·구도는 원형 JSON 의 imageSlots 에서 센다(질문 칸이 아니라 안내 글이다).
import { readFileSync } from 'node:fs'
import { ARCHETYPE_IDS, requiredFacts } from '../stamp/brief.mjs'

const ARCHETYPE_DIR = new URL('../../registry/factory/archetypes/', import.meta.url)

/** 비율 → 구도 이름: 16:9 → 가로 16:9 · 1:1 → 정사각 1:1 · 4:5 → 세로 4:5 · 860x1000-1200 → 세로 조각(폭 860px) · 없음 → 비율 자유 */
function shapeName(aspect) {
  if (!aspect) return '비율 자유'
  const r = /^(\d+):(\d+)$/.exec(aspect)
  if (r) return `${Number(r[1]) > Number(r[2]) ? '가로' : Number(r[1]) === Number(r[2]) ? '정사각' : '세로'} ${aspect}`
  const s = /^(\d+)x/.exec(aspect)
  return s ? `세로 조각(폭 ${s[1]}px)` : aspect
}

/**
 * 원형이 실사로 받아야 하는 사진 칸의 비율 목록. 쪽·구획·칸 id 가 같은 칸은 하나로 센다.
 * 로고 칸(id 에 logo)은 사진이 아니라 로고 질문이 다루므로 세지 않는다.
 */
export function photoSlots(archetype) {
  const j = JSON.parse(readFileSync(new URL(`${archetype}.json`, ARCHETYPE_DIR), 'utf8'))
  const seen = new Map()
  for (const p of j.pages) for (const s of p.sections) for (const i of s.imageSlots) {
    if (i.source === 'real-required' && !/logo/i.test(i.id)) seen.set(`${p.id}/${s.kind}/${i.id}`, i.aspect ?? null)
  }
  return [...seen.values()]
}

/** 「필요한 사진 N장 · 권장 구도」 안내 한 줄. 실사 칸이 없으면 빈 글. */
export function photoNotice(archetype) {
  const aspects = photoSlots(archetype)
  if (!aspects.length) return ''
  const by = new Map()
  for (const a of aspects) by.set(shapeName(a), (by.get(shapeName(a)) ?? 0) + 1)
  const shapes = [...by].map(([name, n]) => `${name} ${n}장`).join(', ')
  return `필요한 사진 ${aspects.length}장을 미리 준비해 주세요(권장 구도: ${shapes}). 목록에 여러 번 나오는 칸은 항목 수만큼 더 필요해요.`
}

/** 입구가 받는 원형 — 브리프 원형 10종(landing 포함, D4). */
export const INTAKE_ARCHETYPES = [...ARCHETYPE_IDS]

/**
 * @typedef {{ id: string, ask: string, hint?: string, fact?: string, logo?: true, brand?: 'colors'|'fonts', eventOnly?: true }} Question
 *   id = answers 의 키 · ask = 사용자에게 묻는 한 문장 · hint = 예시나 괜찮은 답 · fact = 브리프 facts 이름(contact 는 원형이 정한다) · logo = brand.logo 칸 · brand = brand.colors / brand.fonts 칸(FIT-3)
 */

/** @type {Question[]} */
const COMMON = [
  { id: 'name', ask: '이름(상호·브랜드·서비스 이름)이 무엇인가요?', fact: 'name' },
  { id: 'audience', ask: '누가 이 사이트를 보나요? 대상 고객을 한 줄로 알려 주세요.', hint: '예: 출근길 직장인', fact: 'audience' },
  { id: 'action', ask: '방문한 사람이 가장 먼저 해야 할 행동은 무엇인가요?', hint: '예: 전화 예약, 무료로 시작하기', fact: 'action' },
  { id: 'contact', ask: '연락처가 있나요? 전화번호나 이메일 중 알려 줄 수 있는 것을 적어 주세요.', hint: '없으면 비워 두세요. 공개 전에 확인 필요로 남아요.' }, // fact 는 원형이 정한다(contactFact)
  { id: 'logo', ask: '로고 파일이 있나요? 있다면 파일 위치를 알려 주세요.', hint: '없으면 비워 두세요. 미리보기용 로고를 쓰고 공개 전 교체 표지를 달아요.', logo: true },
  { id: 'mood', ask: '분위기를 한 단어로 고른다면 무엇인가요?', hint: '예: 따뜻한, 단정한, 대담한', fact: 'mood' },
  // FIT-3 F2: 대화로 브랜드 색·서체를 받는다. mood 뒤에 붙여 앞 6개 id 순서는 그대로 둔다. 색은 색 코드만 받는다(to-brief: 「초록」은 지어내 바꾸지 않고 되묻는다).
  { id: 'brandColors', ask: '브랜드 색이 있나요? 색 코드로 최대 3개(예: #0B6E4F). 없으면 비워 두세요.', brand: 'colors' },
  { id: 'brandFonts', ask: '꼭 쓰고 싶은 서체가 있나요? 제목용·본문용 순서로. 없으면 비워 두세요.', brand: 'fonts' },
]

/** 원형별로 더 묻는 것(0~3개). 이름은 브리프 FACT_NAMES 안의 사실 이름이다. eventOnly 질문은 행사형 브리프에서만 빠진 사실로 센다. */
const EXTRA = {
  brand: [{ id: 'claim', ask: '브랜드를 한 문장으로 소개한다면 어떻게 말하나요?', fact: 'claim' }],
  commerce: [{ id: 'bestsellers', ask: '대표 상품은 무엇인가요? 몇 가지만 적어 주세요.', fact: 'bestsellers' }],
  dashboard: [{ id: 'metrics', ask: '화면에서 가장 먼저 보여 줄 핵심 지표는 무엇인가요?', fact: 'metrics' }],
  detail: [{ id: 'price', ask: '판매 가격은 얼마인가요?', fact: 'price' }],
  local: [{ id: 'hours', ask: '영업시간은 어떻게 되나요? 휴무일도 알려 주세요.', fact: 'hours' }],
  portfolio: [{ id: 'works', ask: '대표 작업이나 프로젝트 이름을 몇 가지 알려 주세요.', fact: 'works' }],
  public: [{ id: 'hours', ask: '민원 창구 운영시간은 어떻게 되나요?', fact: 'hours' }],
  pwa: [{ id: 'price', ask: '요금제가 있나요? 있다면 가격을 알려 주세요.', fact: 'price' }],
  saas: [{ id: 'price', ask: '요금제가 있나요? 있다면 가격을 알려 주세요.', fact: 'price' }],
  landing: [
    { id: 'claim', ask: '이 한 쪽 안에서 약속하는 핵심 메시지는 무엇인가요?', fact: 'claim' },
    // 행사형 랜딩(C416)만 묻는다 — 행사가 아니면 비워 두고, 비워도 missing·previewOnly 가 생기지 않는다(to-brief missingFacts).
    { id: 'eventDate', ask: '행사라면 일시(날짜와 시간)는 언제인가요? 행사가 아니면 비워 두세요.', hint: '예: 2026-11-14 14:00', fact: 'eventDate', eventOnly: true },
    { id: 'eventVenue', ask: '행사라면 장소는 어디인가요? 행사가 아니면 비워 두세요.', hint: '예: 서울 ○○홀 3층', fact: 'eventVenue', eventOnly: true },
  ],
}

/** 연락처 답이 들어가는 사실 이름: 원형이 전화를 필수로 요구하면 phone, 아니면 email. 답에 @ 가 있으면 어느 원형에서든 email. */
export const contactFact = (archetype) => (requiredFacts(archetype).includes('phone') ? 'phone' : 'email')

export function questionsFor(archetype) {
  if (!INTAKE_ARCHETYPES.includes(archetype)) throw new Error(`모르는 원형: ${archetype} — ${INTAKE_ARCHETYPES.join('·')} 중 하나`)
  const photos = photoNotice(archetype)
  const common = COMMON.map((q) => (q.id === 'contact' ? { ...q, fact: contactFact(archetype) } : q.logo && photos ? { ...q, ask: `${q.ask} ${photos}` } : q))
  return [...common, ...EXTRA[archetype]]
}
