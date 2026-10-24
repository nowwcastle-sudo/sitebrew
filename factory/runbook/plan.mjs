// 런북 계획(계획 5 Task 12) — 순수 모듈. 파일·시계를 읽지 않는다(`today` 는 인자).
// 장 고르기 · 전문가용 본문(+ 개요만 overviewText) · 대안 · 오래됨 비교. 파생 계산(순서·환경 이름·staleAfter)은 LF 생성기가 이미 했다 —
// 여기서는 고르고 이어 붙이기만 한다. 사용자 문장은 모두 data.rubric 과 장 글에서 온다(코드에는 마크다운 기호뿐).

const LANGS = ['ko', 'en']
const SITES = ['site', 'composed']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const SWITCH = { code: 'code', no: 'no' }
/** 대안에서 옮기는 칸 — 이 밖의 칸(금액 같은 것)은 만들지도 읽지도 않는다. */
const ALT_FIELDS = ['service', 'tags', 'support', 'via', 'switchCost', 'note', 'home', 'checked', 'item']

// ── 오래됨 ──────────────────────────────────────────────────────────────────

/** ISO 날짜 a 가 b 보다 엄격히 앞인가(같은 날은 아니다). 날짜 계산은 LF `isStale` 이 했다 — 여기는 비교 한 곳. */
export function pastDate(a, b) {
  for (const d of [a, b]) if (typeof d !== 'string' || !DAY.test(d)) throw new TypeError(`pastDate: expected YYYY-MM-DD, got ${JSON.stringify(d)}`)
  return a < b
}

const staleOf = (gids, data, today) => gids.filter((g) => pastDate(data.chapters[g].staleAfter, today))

// ── 장 고르기 ───────────────────────────────────────────────────────────────

/** 적용된 성과 — 못 넣은 쪽에도 있으면 못 넣은 쪽이 이긴다. */
function appliedOf(delivered) {
  if (delivered?.applied === null) throw new Error('planRunbook: delivered.applied is null (choice unknown) — ask the user for features first (NeedsFeatures)')
  if (!Array.isArray(delivered?.applied)) throw new TypeError('planRunbook: delivered.applied must be an array')
  const unapplied = new Set(delivered.unapplied ?? [])
  return new Set(delivered.applied.filter((id) => !unapplied.has(id)))
}

/** 카드 `when` 의 조건이 모두 맞는가(AND). 조건이 하나도 없는 `when` 은 아무 사이트에도 맞지 않는다. */
function whenHolds(when, { locale, applied }) {
  if (!when) return false
  const conds = []
  if (when.locale !== undefined) conds.push(when.locale === locale)
  if (when.outcomes !== undefined) conds.push(when.outcomes.some((id) => applied.has(id)))
  return conds.length > 0 && conds.every(Boolean)
}

/** 넣을 후보 gid: ① 꼭 필요 ② 적용 성과의 guides ③ when 이 맞는 카드. */
function candidates(data, ctx) {
  const out = new Set()
  for (const [gid, ch] of Object.entries(data.chapters)) {
    if (ch.card?.need === 'always' || whenHolds(ch.card?.when, ctx)) out.add(gid)
  }
  for (const id of ctx.applied) for (const gid of data.outcomes[id]?.guides ?? []) out.add(gid)
  return out
}

/** 장을 그 언어로 쓸 수 없는 까닭(쓸 수 있으면 null). */
function whyMissing(ch, lang) {
  if (!ch) return 'noChapter'
  if (!ch.card) return 'noCard'
  if (!ch.text?.[lang]) return 'noText'
  return null
}

/** 데이터 order 로 거른 순서(다시 정렬하지 않는다). order 밖의 후보는 gid 순으로 뒤에. */
function ordered(data, gids) {
  const inOrder = data.order.filter((g) => gids.has(g))
  const rest = [...gids].filter((g) => !data.order.includes(g)).sort()
  return [...inOrder, ...rest]
}

/**
 * 이 사이트에 넣을 장.
 * @returns {{ lang: 'ko'|'en', site: 'site'|'composed', chapters: string[], missing: { gid: string, lang: string, why: 'noChapter'|'noCard'|'noText' }[], stale: string[] }}
 */
export function planRunbook(data, delivered, { lang, today } = {}) {
  const ctx = { locale: delivered?.locale, applied: appliedOf(delivered) }
  const useLang = lang ?? ctx.locale
  if (!LANGS.includes(useLang)) throw new TypeError(`planRunbook: lang must be one of ${LANGS.join('|')}, got ${JSON.stringify(useLang)}`)
  if (!SITES.includes(delivered.completion)) throw new TypeError(`planRunbook: delivered.completion must be one of ${SITES.join('|')}`)
  if (typeof today !== 'string' || !DAY.test(today)) throw new TypeError(`planRunbook: today must be YYYY-MM-DD, got ${JSON.stringify(today)}`)
  const chapters = []
  const missing = []
  for (const gid of ordered(data, candidates(data, ctx))) {
    const why = whyMissing(data.chapters[gid], useLang)
    if (why) missing.push({ gid, lang: useLang, why })
    else chapters.push(gid)
  }
  return { lang: useLang, site: delivered.completion, chapters, missing, stale: staleOf(chapters, data, today) }
}

// ── 전문가용 본문 ────────────────────────────────────────────────────────────

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)
/** 표 칸 — 줄바꿈과 칸 구분 기호만 막는다. */
const cell = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
/** 낱말 표에 없는 값은 값 그대로(던지지 않는다 — 모양은 LF 가 보장한다). */
const word = (map, key, lang) => map?.[key]?.[lang] ?? key
/** 영어 제목은 생략될 수 있다 — 그러면 gid. */
const titleOf = (ch, lang) => ch.text[lang].title || ch.gid

function headline(plan, labels, lang) {
  return fill(labels.headline[lang], { site: word(labels.site, plan.site, lang), lang: labels.langName[lang][plan.lang] })
}

function staleBlock(stale, data, lang) {
  if (stale.length === 0) return []
  const names = stale.map((g) => titleOf(data.chapters[g], lang)).join(', ')
  return [`> ${data.rubric.staleLine[lang]} (${names})`]
}

const COLUMNS = ['chapter', 'service', 'cost', 'need', 'ifSkipped']

function overviewTable(plan, data, lang) {
  const L = data.rubric.labels
  const row = (cells) => `| ${cells.map(cell).join(' | ')} |`
  const lines = [row(COLUMNS.map((k) => L.columns[k][lang])), `|${COLUMNS.map(() => '---').join('|')}|`]
  for (const g of plan.chapters) {
    const ch = data.chapters[g]
    const { card } = ch
    lines.push(row([titleOf(ch, lang), card.service, card.cost.map((c) => word(L.cost, c, lang)).join(', '), word(L.need, card.need, lang), card.ifSkipped?.[lang]]))
  }
  return lines
}

/** 장 본문을 그대로. 같은 파일의 공유 절(환경 이름을 물려주는 절)은 그 파일의 첫 장 앞에 한 번. */
function chapterBlocks(plan, data, lang) {
  const blocks = []
  const sharedDone = new Set()
  for (const g of plan.chapters) {
    const ch = data.chapters[g]
    const shared = data.shared?.[ch.file]?.[lang]
    if (shared && !sharedDone.has(ch.file)) {
      sharedDone.add(ch.file)
      blocks.push(shared)
    }
    blocks.push(`## ${titleOf(ch, lang)}\n\n${ch.text[lang].body}`)
  }
  return blocks
}

function missingBlock(plan, data, lang) {
  if (plan.missing.length === 0) return []
  return [`## ${data.rubric.labels.missing[lang]}\n\n${plan.missing.map((m) => `- \`${m.gid}\``).join('\n')}`]
}

/** 전문가용 런북 한 문서(마크다운). `today` 를 주면 오래됨을 그 날짜로 다시 본다. */
export function expertText(plan, data, { lang, today } = {}) {
  const useLang = lang ?? plan.lang
  if (useLang !== plan.lang) throw new Error(`expertText: lang ${useLang} differs from plan.lang ${plan.lang} — plan again in that language`)
  const stale = today ? staleOf(plan.chapters, data, today) : plan.stale
  const head = [headline(plan, data.rubric.labels, useLang), ...staleBlock(stale, data, useLang)].join('\n\n')
  const parts = [head, overviewTable(plan, data, useLang).join('\n'), ...chapterBlocks(plan, data, useLang), ...missingBlock(plan, data, useLang)]
  return `${parts.join('\n\n')}\n`
}

/** 개요만(맨 위 줄 · 오래됨 줄 · 개요 표 · 못 넣은 장) — expertText 에서 장 본문을 뺀 것. 런북 `open` 이 보인다. */
export function overviewText(plan, data, { lang, today } = {}) {
  const useLang = lang ?? plan.lang
  if (useLang !== plan.lang) throw new Error(`overviewText: lang ${useLang} differs from plan.lang ${plan.lang} — plan again in that language`)
  const stale = today ? staleOf(plan.chapters, data, today) : plan.stale
  const head = [headline(plan, data.rubric.labels, useLang), ...staleBlock(stale, data, useLang)].join('\n\n')
  return `${[head, overviewTable(plan, data, useLang).join('\n'), ...missingBlock(plan, data, useLang)].join('\n\n')}\n`
}

// ── 대안 ────────────────────────────────────────────────────────────────────

function switchOf(alt, applied) {
  if (alt.support === 'builtin') return (alt.via ?? []).some((id) => applied.has(id)) ? 'on' : 'reselect'
  const s = SWITCH[alt.support]
  if (!s) throw new TypeError(`alternativesFor: unknown support ${JSON.stringify(alt.support)} for ${alt.service}`)
  return s
}

function pick(alt) {
  return Object.fromEntries(ALT_FIELDS.filter((k) => alt[k] !== undefined).map((k) => [k, alt[k]]))
}

/**
 * 장의 역할(card.role)에 맞는 대안과 이 사이트에서의 지원.
 * @returns {{ current: { service: string, role: string }, options: object[] } | { none: true, current: { service: string, role: string } }}
 */
export function alternativesFor(data, gid, { want, applied = [] } = {}) {
  const card = data.chapters[gid]?.card
  if (!card) throw new RangeError(`alternativesFor: no chapter card for ${gid}`)
  const current = { service: card.service, role: card.role }
  const list = data.alternatives?.[card.role]
  if (!list?.length) return { none: true, current }
  const on = new Set(applied)
  const options = list.filter((a) => !want || a.tags.includes(want)).map((a) => ({ ...pick(a), switch: switchOf(a, on) }))
  return { current, options }
}
