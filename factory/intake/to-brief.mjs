// 대화형 입구의 답 → 브리프(factory v1 Task 4.1 · 합의안 D3). 파일 없이 메모리에서 만들고, 만든 브리프는 loadBrief 와 같은 스키마를 통과한다.
//   지어내지 않는다(§9 Q8): 빈 답·「없음」류는 사실로 싣지 않는다. 빠진 사실은 브리프에 없고(04-content 가 「확인 필요」 자리 표시로 남긴다)
//   `previewOnly: true` 표지와 missingFacts() 목록으로 사람에게 알린다 — 미리보기 자산 + 「공개 전 교체」 표지로 끝까지 가고, 공개 관문이 막는다.
import { factPath, loadBriefObject } from '../stamp/brief.mjs'
import { contactFact, questionsFor } from './questions.mjs'

// 「모른다」는 뜻의 흔한 답 — 사실 칸에 이 글자가 들어가면 04-content 가 그것을 사실로 읽는다.
const NO_ANSWER = /^(없음|없어요|없습니다|모름|몰라요|나중에|미정|해당\s*없음|none|n\/a|no|-+)$/i

const clean = (v) => {
  const s = v === undefined || v === null ? '' : String(v).trim()
  return NO_ANSWER.test(s) ? '' : s
}

/** 사실 이름 → 사람이 읽는 자리 이름. 회사 정보 칸은 콘텐츠 경로(business.phone), 그 밖은 사실 이름 그대로(hours). */
const labelOf = (archetype, fact) => {
  const path = factPath(archetype, fact)
  return path[0] === 'facts' ? fact : path.join('.')
}

// FIT-3 F2 — 브랜드 색·서체 칸. 색은 올바른 색 코드(#rgb·#rrggbb, 대소문자 무관)만 받는다. 「초록」 같은 말은 어떤 색인지 지어내 바꾸지 않고
// brief 에 넣지 않으며 `unread` 로 돌려준다 — 에이전트가 사용자에게 색 코드로 다시 묻는다. 서체 이름은 검증할 수 없어 그대로 싣는다(brand.mjs 가 키트 서체로 대체하고 기록한다).
const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi
const SPLIT = /[,;/、·\n]+/
export const MAX_BRAND_COLORS = 3
export const MAX_BRAND_FONTS = 2 // 제목용 · 본문용

/** 색 답 → { colors, unread[] } (colors 는 사용자가 쓴 글자 그대로, 같은 색은 한 번) */
function readColors(answer) {
  const seen = new Map()
  for (const m of answer.match(HEX) ?? []) if (!seen.has(m.toLowerCase())) seen.set(m.toLowerCase(), m)
  const all = [...seen.values()]
  const colors = all.slice(0, MAX_BRAND_COLORS)
  const words = answer.split(SPLIT).map((f) => f.replace(HEX, ' ').trim()).filter(Boolean)
  const unread = []
  if (words.length) unread.push({ id: 'brandColors', answer: words.join(', '), why: '색 코드가 아님' })
  if (all.length > MAX_BRAND_COLORS) unread.push({ id: 'brandColors', answer: all.slice(MAX_BRAND_COLORS).join(', '), why: `색은 ${MAX_BRAND_COLORS}개까지만 받아요` })
  return { values: colors, unread }
}

/** 서체 답 → { fonts, unread[] } (제목용 · 본문용 순서) */
function readFonts(answer) {
  const names = answer.split(SPLIT).map((f) => f.trim()).filter(Boolean)
  const unread = names.length > MAX_BRAND_FONTS ? [{ id: 'brandFonts', answer: names.slice(MAX_BRAND_FONTS).join(', '), why: '서체는 제목용·본문용 두 개까지만 받아요' }] : []
  return { values: names.slice(0, MAX_BRAND_FONTS), unread }
}

/**
 * 답 → 브리프와 되물을 것. toBrief 는 브리프만, toBriefReport 는 { brief, missing, unread } 를 돌려준다.
 * unread = 받지 못한 답 [{ id, answer, why }] — 에이전트가 사용자에게 다시 묻는다(예: 색 코드로).
 */
function build({ topic, archetype, locale = 'ko', answers = {} } = {}) {
  const questions = questionsFor(archetype) // 모르는 원형이면 여기서 던진다
  const known = new Set(questions.map((q) => q.id))
  const stray = Object.keys(answers).filter((k) => !known.has(k))
  if (stray.length) throw new Error(`모르는 답 칸: ${stray.join('·')} — ${archetype} 의 질문 id 는 ${[...known].join('·')}`)
  const title = String(topic ?? '').trim()
  if (!title) throw new Error('주제 한 줄(topic)을 적어 주세요')

  const facts = {}
  const brand = {}
  const unread = []
  for (const q of questions) {
    const a = clean(answers[q.id])
    if (!a) continue
    if (q.logo) brand.logo = a
    else if (q.brand) {
      const r = (q.brand === 'colors' ? readColors : readFonts)(a)
      if (r.values.length) brand[q.brand] = r.values
      unread.push(...r.unread)
    } else if (q.id === 'contact') facts[a.includes('@') ? 'email' : 'phone'] = a // 연락처 칸에는 이메일이나 전화번호가 온다
    else facts[q.fact] = a
  }
  // brand 칸 순서: logo · colors · fonts (로고만 있는 브리프는 예전과 글자까지 같다)
  const ordered = Object.fromEntries(['logo', 'colors', 'fonts'].filter((k) => brand[k]).map((k) => [k, brand[k]]))
  const brief = { topic: title, archetype, locale, facts, ...(Object.keys(ordered).length ? { brand: ordered } : {}) }
  const checked = (b) => loadBriefObject(b, { label: '대화 입구' })
  const out = checked(brief)
  return { brief: missingFacts(out).length ? checked({ ...out, previewOnly: true }) : out, unread }
}

/**
 * @param {{ topic: string, archetype: string, locale?: 'ko'|'en', answers?: Record<string, unknown> }} input  answers 의 키는 questionsFor(archetype) 의 id
 * @returns 브리프 — { topic, archetype, locale, facts, brand?, previewOnly? }
 *   landing 도 BriefSchema 의 원형 목록에 있다(흐름 5 Task 5.5) — 원형마다 같은 스키마로 검사한다.
 */
export function toBrief(input) {
  return build(input).brief
}

/** toBrief + 입구가 아직 못 받은 것: { brief, missing: missingFacts(brief), unread: [{ id, answer, why }] } — unread 는 에이전트가 사용자에게 다시 묻는다. */
export function toBriefReport(input) {
  const { brief, unread } = build(input)
  return { brief, missing: missingFacts(brief), unread }
}

/**
 * 입구가 물었는데 브리프에 없는 것 — 사람에게 「이건 아직 비어 있다」고 알릴 이름들.
 * 회사 정보 칸은 콘텐츠 경로(business.phone), 그 밖은 사실 이름(hours·audience), 로고는 `logo`.
 */
export function missingFacts(brief) {
  const facts = brief.facts ?? {}
  const has = (k) => typeof facts[k] === 'string' && facts[k].trim() !== ''
  const missing = []
  for (const q of questionsFor(brief.archetype)) {
    if (q.logo) { if (!brief.brand?.logo) missing.push('logo'); continue }
    if (q.brand) continue // 브랜드 색·서체는 필수 사실이 아니다 — 없어도 missing·previewOnly 를 바꾸지 않는다(FIT-3)
    // 연락처: 전화가 필수인 원형은 전화가 있어야 하고, 아니면 전화나 이메일 중 하나면 된다.
    const filled = q.id === 'contact' ? (contactFact(brief.archetype) === 'phone' ? has('phone') : has('email') || has('phone')) : has(q.fact)
    if (!filled) missing.push(labelOf(brief.archetype, q.fact))
  }
  return missing
}
