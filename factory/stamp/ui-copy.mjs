// 화면 문구 칸(P3-3 Task 9b, 대장 C112) — 제품 화면·문의 폼 블록의 안내 문장을 04-content 가 문구 칸으로 요청하게 한다.
//   uiLeavesOf(블록 이름) → 그 블록 예시(fixture)에서 예시 표지·가상 이름·지어낸 숫자가 남은 필수 문구 잎 [{ path, example, why }]
//   uiSlotTable(블록 이름들) → Map<블록, 잎[]> — contentRequest 의 { uiSlots } 로 넘긴다(contentRequest 는 동기라 fixture 를 못 읽는다).
//   같은 요청의 슬롯(slot.ui.path)을 06-pages 가 읽어 잎마다 $ref 로 잇는다. 요청과 06 이 같은 계산을 다시 하지 않게 잎 목록은 요청 파일에 실려 간다.
//   종류 규칙(site-bind.mjs): UI_SLOT_KINDS(제품 화면·문의 폼 — 숫자 잎도 요청한다: 「8자 이상」「6자리」는 화면 동작 값이다),
//   UI_MARKER_ONLY_KINDS(히어로·마지막 행동 — 예시 표지만 남은 블록에만 요청한다: 가상 수치·이름이 남으면 요청하지 않는다).
//   C333(FV1 Task 5.14, 대표 위임 결정): 제품 화면 예시 글은 04 의 화면 문구 칸으로 보낸다 — 한국어 사이트는 다른 사업(예약·일정)의 문구가 든 문장을, 영어 사이트는 한글이 든 문장을
//   (예시 표지가 없어도) 이 서비스의 말로 다시 쓰게 한다. 잎이 너무 많으면(> MAX_UI_SLOTS) 이 확장만 접는다 — 기본 요청(표지·이름·숫자 잎)은 예전 그대로다.
import { loadArchetypes } from '../scripts/archetypes.mjs'
import { bindSection, blockItems, ctaTargetOf, exampleNames, fixtureOf } from './gen-pages.mjs'
import { localizeEnglishLabels } from './ui-labels-en.mjs'
import { FOREIGN_BIZ_PATTERNS, MAX_UI_SLOTS, isEnSceneClaim, UI_CLAIMS, UI_MARKER_ONLY_KINDS, UI_SLOT_KINDS, dropOptionalExamples, exampleIssues, leaves } from './site-bind.mjs'

const claimed = (kind, path) => (UI_CLAIMS[kind] ?? []).some((c) => path === c || path.startsWith(`${c}.`) || path.startsWith(`${c}[`))
const HANGUL = /[가-힣]/
// 문구가 아닌 잎: 링크·식별자·단위 낱말처럼 다시 쓸 글이 아닌 것의 경로 꼬리
const NOT_PROSE_PATH = /(?:\.|^)(?:href|url|src|id|kind|icon|type|aspect|source|status|day|opens|closes|start|end|currentHref|locale|number|value)$/

/** 예전 판단 그대로(기본 요청): { list, refused } — refused 면 이 블록은 문구 칸으로 못 채운다(readiness 2). */
async function baseLeaves(block) {
  const b = blockItems().get(block)
  if (!b || !(UI_SLOT_KINDS.has(b.kind) || UI_MARKER_ONLY_KINDS.has(b.kind))) return { list: [], refused: false }
  const names = await exampleNames()
  const props = await fixtureOf(b)
  dropOptionalExamples(props, b.source, names, { ancestors: false, keepDigits: UI_SLOT_KINDS.has(b.kind) }) // 선택 잎은 06 이 빼므로 요청하지 않는다(선택 윗칸 안의 잎은 요청한다 — 윗칸을 통째로 잃으면 기능이 사라진다)
  const found = exampleIssues(leaves(props), names).filter((i) => !claimed(b.kind, i.path))
  if (UI_MARKER_ONLY_KINDS.has(b.kind) && found.some((i) => i.why !== 'marker')) return { list: [], refused: true }
  if (found.some((i) => i.why === 'number')) return { list: [], refused: true } // 숫자 칸(가격·기간·인원)의 예시 수치는 문구로 다시 쓸 수 없다 — 문구 칸을 요청하지 않고 블록은 못 채움(readiness 2)
  const out = found.filter((i) => i.why !== 'link').map((i) => ({ path: i.path, example: i.value, why: i.why }))
  return out.length > MAX_UI_SLOTS ? { list: [], refused: true } : { list: out, refused: false, props }
}

/**
 * 블록 하나의 화면 문구 잎. 이 종류가 아니거나 잎이 너무 많거나 지어낸 수치가 남으면 빈 배열(요청하지 않는다).
 * locale: 사이트 언어 — 제품 화면 블록은 ko 면 다른 사업(예약·일정)의 문구가 든 문장을, en 이면 한글이 든 문장을 더 요청한다(C333).
 */
export async function uiLeavesOf(block, { locale = 'ko' } = {}) {
  const base = await baseLeaves(block)
  if (base.refused) return []
  const b = blockItems().get(block)
  if (!b || !UI_SLOT_KINDS.has(b.kind)) return base.list
  const props = base.props ?? (await fixtureOf(b))
  if (!base.props) dropOptionalExamples(props, b.source, await exampleNames(), { ancestors: false, keepDigits: true })
  const have = new Set(base.list.map((l) => l.path))
  // 영어 사이트: 일반 이름표는 번역표(ui-labels-en.mjs)가 바꾸므로 그 뒤에도 한글인 잎(이 사업의 문장)만 문구 칸으로 보낸다 — 06 bindSection 이 문구 칸을 먼저 잇고 표를 적용하는 차례와 같다.
  let view = props
  if (locale === 'en') {
    // 영어 장면(fixtureEn)이 있는 블록은 그 예시에서 남은 한글을 센다(FOLLOW) — 없으면 한국어 예시 그대로라 예전 계산과 같다.
    view = await fixtureOf(b, { locale: 'en' })
    dropOptionalExamples(view, b.source, await exampleNames(), { ancestors: false, keepDigits: true })
    localizeEnglishLabels(view)
  }
  const prose = (l) => l.ref === null && typeof l.value === 'string' && !have.has(l.path) && !claimed(b.kind, l.path) && !NOT_PROSE_PATH.test(l.path)
  // 영어 사업 주장이 든 목록 항목(items[n] — 온보딩 체크리스트)은 항목의 글 전부를 다시 쓰게 한다: 제목만 새 말이고 본문·버튼이 예시 그대로면 한 항목 안에서 말이 어긋난다(FINAL-WF4 EN1)
  const itemOf = (path) => path.match(/^(.*\bitems\[\d+\])\./)?.[1] ?? null
  const claimItems = locale === 'en' ? new Set(leaves(view).filter((l) => prose(l) && isEnSceneClaim(l.value, l.path)).map((l) => itemOf(l.path)).filter(Boolean)) : new Set()
  const extra = leaves(view)
    .filter((l) => prose(l))
    // 영어 사이트(FINAL-WF4 EN1): 한글 잎에 더해 영어 장면의 사업 주장(「프로젝트·팀원·보고서·PDF …」 — site-bind EN_SCENE_CLAIM_PATTERNS)도 이 서비스의 말로 다시 쓰게 한다
    .filter((l) => (locale === 'en' ? HANGUL.test(l.value) || isEnSceneClaim(l.value, l.path) || claimItems.has(itemOf(l.path)) : FOREIGN_BIZ_PATTERNS.some((re) => re.test(l.value))))
    .map((l) => ({ path: l.path, example: l.value, why: locale === 'en' ? (HANGUL.test(l.value) ? 'locale' : 'biz') : 'biz' }))
  const all = [...base.list, ...extra]
  return all.length > MAX_UI_SLOTS ? base.list : all // 확장이 한도를 넘기면 기본 요청만(예전 그대로)
}

/**
 * 블록이 문구만으로 공개 가능한 정도 — 0 깨끗(남는 예시 잎 없음) · 1 문구 칸으로 채울 수 있음 · 2 못 채움(지어낸 수치·가상 이름이 남거나 잎이 너무 많다).
 * 이 표에 없는 종류(binder 가 콘텐츠로 묶는 종류)는 0 으로 본다 — 그 종류는 콘텐츠 유무로 갈리고 06 이 폴백으로 다룬다.
 * C333 확장 잎(biz·locale)은 반영하지 않는다 — 03 의 변형 고르기가 예전과 같아야 한다.
 */
export async function readinessOf(block) {
  const b = blockItems().get(block)
  if (!b || !(UI_SLOT_KINDS.has(b.kind) || UI_MARKER_ONLY_KINDS.has(b.kind))) return 0
  const names = await exampleNames()
  const props = await fixtureOf(b)
  dropOptionalExamples(props, b.source, names, { ancestors: false, keepDigits: UI_SLOT_KINDS.has(b.kind) })
  const found = exampleIssues(leaves(props), names).filter((i) => !claimed(b.kind, i.path))
  if (!found.length) return 0
  return (await baseLeaves(block)).list.length ? 1 : 2
}

/** 블록 이름들 → Map<블록, 0|1|2> — chooseVariants 의 { readiness } 로 넘긴다(2 는 다른 변형이 있으면 고르지 않는다). */
export async function readinessTable(blocks) {
  const table = new Map()
  for (const block of new Set(blocks)) table.set(block, await readinessOf(block))
  return table
}

/** 블록 이름들 → Map<블록, 잎[]>(잎이 있는 블록만). locale 은 사이트 언어(C333). */
export async function uiSlotTable(blocks, { locale = 'ko' } = {}) {
  const table = new Map()
  for (const block of new Set(blocks)) {
    const list = await uiLeavesOf(block, { locale })
    if (list.length) table.set(block, list)
  }
  return table
}

// ── 누설 예측(레인 EXLEAK, 03 용) ──────────────────────────────────────────────────────────────────
// 06 은 묶고도 남는 예시 사업 글(leak)·가짜 앱 창(mockup)이 있으면 블록을 같은 섹션의 더 깨끗한 변형으로 바꾼다(이슈 주도 폴백). 03 은 04 콘텐츠를 모르고 골라서,
// 누설이 남는 변형을 후보 셋이 똑같이 고르면 06 폴백이 셋을 같은 블록으로 모았다(brand-1 a·b·c 히어로). 그래서 03 이 「이 변형은 가장 좋은 경우에도 누설이 남는다」를 미리 안다.
// 판정은 블록 구조만으로 한다 — 가장 좋은 경우(그 섹션의 문구 칸이 모두 있고, 예약·바로가기 사실이 있고, 04 가 화면 문구 칸을 모두 채운다)를 가정해 06 의 bindSection 을 그대로 돌려
// 그래도 남는 leak·mockup 이슈 수를 센다 — 별도 표를 손으로 적지 않으니 binder 가 늘면 표도 같이 줄어든다. 묶을 자료가 없어 null 인 블록(사실 블록의 데이터 없음)은 0 으로 둔다.
const BEST_CASE = (archetype) => ({
  archetype, locale: 'ko', business: { name: '가상 가게' }, site: { name: '가상 가게' },
  slots: { copy: [{ id: 'x', role: '', text: '문구' }] },
  quickLinks: [{ label: '바로가기', href: '/guide' }],
  booking: { primary: { kind: 'tel', value: '02-1234-5678' } },
  products: [{ slug: 'a', name: '상품', price: 1000, options: [], thumbs: [] }],
  workflowSteps: [{ title: '단계', body: '설명' }],
})
const leakCache = new Map()
/** 표의 칸 이름: `<섹션 키>` + 탭 + `<블록 이름>`. */
export const leakKey = (key, block) => `${key}\t${block}`

/**
 * 사이트맵의 블록 섹션마다 허용 변형의 「가장 좋은 경우에도 남는 누설 이슈 수」. Map<leakKey, 수> — 0 인 것은 넣지 않는다.
 * @param {{ archetype: string, pages: object[], globals?: object[] }} sitemap
 */
export async function leakTable(sitemap) {
  const memo = JSON.stringify([sitemap.archetype, sitemap.pages.map((p) => [p.id, p.route, p.sections.filter((s) => s.status === 'block').map((s) => [s.kind, s.allowedVariants])]), (sitemap.globals ?? []).filter((g) => g.status === 'block').map((g) => [g.kind, g.allowedVariants])])
  if (leakCache.has(memo)) return leakCache.get(memo)
  const arch = (await loadArchetypes())[sitemap.archetype]
  const routes = Object.fromEntries(sitemap.pages.map((p) => [p.id, p.route]))
  const content = BEST_CASE(sitemap.archetype)
  const slotsOf = (pageId, kind) => (pageId === 'global' ? arch?.globalSections?.find((g) => g.kind === kind) : arch?.pages.find((p) => p.id === pageId)?.sections.find((s) => s.kind === kind))?.copySlots ?? []
  const out = new Map()
  const sections = [
    ...sitemap.pages.flatMap((p) => p.sections.map((s) => ({ key: `${p.id}/${s.kind}`, s }))),
    ...(sitemap.globals ?? []).map((g) => ({ key: `global/${g.kind}`, s: g })),
  ].filter(({ s }) => s.status === 'block')
  for (const { key, s } of sections) {
    const [pageId, kind] = key.split('/')
    const copyIndex = new Map(slotsOf(pageId, kind).map((c) => [`${key}/${c.id}#0`, 0]))
    for (const block of s.allowedVariants) {
      const uiLeaves = (await uiLeavesOf(block)).map((l) => ({ path: l.path, ref: 'slots.copy.0.text' }))
      let r
      try { r = await bindSection({ key, block, content, copyIndex, routes, locale: 'ko', navLinks: () => [], primaryCta: () => ctaTargetOf(content, routes), secondaryHref: () => routes.pricing ?? '#', uiLeaves }) } catch { continue }
      if (!r.props) continue
      const n = r.issues.filter((i) => i.why === 'leak' || i.why === 'mockup').length
      if (n) out.set(leakKey(key, block), n)
    }
  }
  leakCache.set(memo, out)
  return out
}
