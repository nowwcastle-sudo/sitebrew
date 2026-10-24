// 구획 구조 조작(FIT-1) — 「후기 섹션 추가해줘」·「FAQ 빼줘」·「위치를 히어로 바로 아래로 올려줘」 같은 말을 구획 더하기·빼기·순서 바꾸기로 다룬다.
//   이 모듈이 본체이고 revise.mjs 는 분기 몇 줄(parseRevision 맨 앞의 구조 낱말 판정 · revise/applyRevision 의 갈래)만 가진다 — 같은 파일에서 색·서체 값을 다루는 레인과 부딪치지 않게.
//
//   parseStructure(…)   말 → { scope: "remove"|"add"|"order", target, intent, text, [anchor, place] } | { ask } | undefined(구조 말이 아니다 — 기존 사상으로 간다)
//     remove  target = 사이트에 있는 선택 구획 키.        필수 구획(원형이 요구하는 것)은 {ask} — 바꾸지 않는다.
//     add     target = "<쪽>/<섹션>" — 사이트에 없고 원형이 받는 선택 블록 구획.   anchor·place 가 있으면 그 자리, 없으면 원형이 적은 순서.
//     order   target = 옮길 구획, anchor = 기준 구획(없으면 null), place = after | before | start | end.   같은 쪽 안에서만, 히어로는 처음·푸터는 끝 고정.
//     원형은 site.archetype 으로 읽는다(원형 JSON 의 섹션 표만 본다). 칸이 없으면 더하기는 판단할 수 없어 되묻는다.
//   planStructure(sitemap, archetype, op, facts) → { ask } | { plan }   — 사이트맵(02) 기준의 최종 판정. 말 해석이 사이트(06) 키 표를 보고 한 것을 02 로 다시 확인한다.
//   reviseStructure(…)  안 만들기 — remove·order 는 안 1개, add 는 허용 변형 상위 2개(03 의 chooseVariants 순서 = rankSection). 지금 사이트·02·03·04 는 건드리지 않는다.
//   applyStructure(…)   고르기 — 02 에 구획을 넣고/빼고/옮기고, 03 을 맞추고, 04 문구 칸을 같은 순서로 다시 맞춘다(문구 칸은 id·나온 차례로 짝지어지므로 순서가 바뀌면 글이 밀린다).
//                       add 는 새 구획의 문구 칸을 비워 두고(사실이 없는 칸은 자리 표시) 입력 대기로 간다.
//   revisedFor: 03 단계 파일에 이 사이트맵의 해시를 적어 둔다 — stamp.mjs 가 사이트맵이 바뀐 03 을 다시 고르지 않고(앞서 고른 안이 사라진다) 이 선택을 그대로 쓴다.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ARCHETYPE_PATH } from '../scripts/archetypes.mjs'
import { loadPreferences, recordPick, savePreferences, weightOf } from '../board/preferences.mjs'
import { bindCopy, PLACEHOLDER, slotFacts, UI_ROLE, uiNumberKind } from './content.mjs'
import { inputHash } from './run-dir.mjs'
import { FACT_GATED, hasFact, sectionOf } from './sitemap.mjs'
import { uiSlotTable } from './ui-copy.mjs'
import { fill } from '../vocab/fill.mjs'
import { grammar } from '../vocab/grammar.mjs'

export const STRUCTURE_SCOPES = ['remove', 'add', 'order']

// ── 낱말 ─────────────────────────────────────────────────────────────────────

const REMOVE_WORDS = ['빼줘', '빼 줘', '빼주', '빼라', '빼자', '빼요', '삭제', '지워', '지우', '없애', '없앨', '제거', '치워', 'remove', 'delete', 'drop', 'take out', 'get rid of', 'leave out']
// 「히어로 장식 없애줘」의 장식은 구획이 아니라 꾸밈이다 — 이 낱말이 함께 있으면 구획 삭제가 아니라 기존 사상(더 차분하게)으로 간다
const DECOR_WORDS = ['장식', '꾸밈', '효과', '이펙트', '그림자', '테두리', 'decoration', 'decorations', 'ornament', 'ornaments', 'effect', 'effects']
const ADD_STRONG = ['추가', '넣어', '넣고', '넣자', '더해', '더하', '덧붙', '붙여', 'add', 'include', 'insert', 'append', 'put in']
const ADD_WEAK = ['만들어', '만들고', 'create', 'make a', 'make an', 'build a'] // 「히어로를 더 대담하게 만들어줘」 같은 말에도 있다 — 사이트에 없는 구획일 때만 더하기로 읽는다
const ORDER_WORDS = ['위로', '아래로', '앞으로', '뒤로', '다음으로', '위에', '아래에', '밑에', '밑으로', '순서', '옮겨', '옮기', '이동', 'move', 'reorder', 'above', 'below', 'before', 'after']
const ORDER_VERBS = ['put', 'place', 'bring', 'send', 'move']
const AFTER_WORDS = ['아래', '뒤', '다음', '밑', 'below', 'after', 'under', 'beneath', 'behind', 'following']
const BEFORE_WORDS = ['위', '앞', '전에', 'above', 'before', 'over', 'ahead of', 'in front of', 'prior to']
const DEST_START = ['맨 위', '맨위', '맨 앞', '맨앞', '맨 처음', '제일 위', '처음', '첫 번째', 'top', 'first', 'beginning']
const DEST_END = ['맨 아래', '맨아래', '맨 뒤', '맨뒤', '제일 아래', '마지막', '끝', 'bottom', 'last', 'end']
const DEST_AMBIGUOUS_SECTION_WORDS = new Set(['맨 위', '맨 아래']) // 히어로·푸터 이름표이기도 하다 — 순서 말에서는 자리 말이다

const SA = {
  ko: {
    mustStay: '이 구획은 이 사이트 종류에 꼭 있어야 해요',
    already: (names) => `이미 있는 구획이에요: ${names}`,
    canAdd: (names) => (names ? `더할 수 있는 구획: ${names}` : '이 사이트에 더할 수 있는 구획이 없어요'),
    whichAdd: (names) => (names ? `어떤 구획을 더할까요? 더할 수 있는 구획: ${names}` : '이 사이트에 더할 수 있는 구획이 없어요'),
    needsFacts: '그 구획은 사실이 있어야 그려요. 브리프에 사실을 더해 주세요',
    heroFirst: '히어로는 맨 위에 고정이에요. 그 위로는 못 옮겨요',
    footerLast: '푸터는 맨 아래에 고정이에요',
    globalFixed: '이 구획은 쪽 순서에 없어서 옮길 수 없어요',
    whereOrder: '어디로 옮길까요? 기준 구획이나 맨 위/맨 아래를 알려 주세요',
    samePage: '두 구획이 다른 쪽에 있어요. 같은 쪽 안에서만 옮겨요',
    relation: '위인지 아래인지 알려 주세요. 예: 히어로 아래로',
    onlyOne: (names) => `구획은 하나씩 바꿔요. 하나만 알려 주세요: ${names}`,
    sameSpot: '이미 그 순서예요',
    wouldEmpty: '그 쪽에 구획이 하나도 안 남아요. 빼지 않았어요',
    noSection: (names) => `이 사이트에 그 구획이 없어요. 구획: ${names}`,
    pages: (names) => `그 구획이 여러 쪽에 있어요. 어느 쪽인가요? ${names}`,
    vague: '어느 부분을 바꿀까요? 구획(예: 히어로)·색/서체/모션·문구 중 하나를 알려 주세요.',
    changed: '이 제안이 만들어진 뒤 사이트맵이 바뀌었어요. 다시 제안해 주세요',
    schemaRefused: (why) => `이 사이트에는 더할 수 없어요: ${why}`,
  },
  en: {
    mustStay: 'This section must stay on this kind of site.',
    already: (names) => `That section is already here: ${names}`,
    canAdd: (names) => (names ? `Sections you can add: ${names}` : 'No sections can be added to this site.'),
    whichAdd: (names) => (names ? `Which section? Sections you can add: ${names}` : 'No sections can be added to this site.'),
    needsFacts: 'That section needs facts. Add them to the brief first.',
    heroFirst: 'The hero stays at the top. Nothing goes above it.',
    footerLast: 'The footer stays at the bottom.',
    globalFixed: 'That section has no place in the page order.',
    whereOrder: 'Move where? Name another section, or top/bottom.',
    samePage: 'Those sections are on different pages. Moves stay on one page.',
    relation: 'Above or below? e.g. below the hero.',
    onlyOne: (names) => `One section at a time. Pick one: ${names}`,
    sameSpot: 'It is already in that order.',
    wouldEmpty: 'That page would have no sections left. Nothing removed.',
    noSection: (names) => `No such section here. Sections: ${names}`,
    pages: (names) => `That section is on several pages. Which? ${names}`,
    vague: 'Which part? A section (e.g. hero), color/type/motion, or the copy.',
    changed: 'The sitemap changed since this proposal. Propose again.',
    schemaRefused: (why) => `Cannot add it to this site: ${why}`,
  },
}
const ASK_MAX = 79
const clipList = (prefix, list, suffix = '') => {
  let names = list.join(', ')
  while ((prefix + names + suffix).length > ASK_MAX && list.length > 1) { list = list.slice(0, -1); names = `${list.join(', ')}…` }
  return (prefix + names + suffix).slice(0, ASK_MAX)
}
const say = (L, key, ...a) => { const v = SA[L][key]; const s = typeof v === 'function' ? v(...a) : v; return s.length > ASK_MAX ? s.slice(0, ASK_MAX) : s }
const ask = (L, key, ...a) => ({ ask: say(L, key, ...a) })
/** 목록이 든 질문 — 80자 미만이 되도록 목록을 줄인다. */
const askList = (L, key, list) => {
  const probe = SA[L][key]('\u0000')
  const [pre, post = ''] = probe.split('\u0000')
  return { ask: list.length ? clipList(pre, list, post) : SA[L][key]('') }
}

// ── 원형·사이트 표 ───────────────────────────────────────────────────────────

const archCache = new Map()
/** 원형 JSON(zod 검사 없이 섹션 표만 읽는다). 모르는 원형이면 null. */
export function archetypeOf(id) {
  if (!id) return null
  if (!archCache.has(id)) {
    const file = join(ARCHETYPE_PATH, `${id}.json`)
    archCache.set(id, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null)
  }
  return archCache.get(id)
}
const archSections = (arch) => (arch?.pages ?? []).filter((p) => (p.phase ?? 'v0') === 'v0').flatMap((p) => p.sections.map((s) => ({ page: p.id, kind: s.kind, key: `${p.id}/${s.kind}`, required: s.required === true, block: (s.allowedVariants?.length ?? 0) > 0, spec: s })))
const kindOf = (key) => key.split('/')[1]
const pageIdOf = (key) => key.split('/')[0]
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')

/** 낱말이 text 에 나온 자리들 [시작, 끝) — 영어 낱말은 단어 경계로, 그 밖은 포함으로(revise.mjs has 와 같은 구분). */
function occurrences(s, w) {
  const out = []
  if (/^[a-z][a-z' -]*$/i.test(w)) {
    for (const m of s.matchAll(new RegExp(`(?<![a-z])${esc(w)}(?![a-z])`, 'gi'))) out.push([m.index, m.index + m[0].length])
  } else {
    let i = s.indexOf(w)
    while (i >= 0) { out.push([i, i + w.length]); i = s.indexOf(w, i + w.length) }
  }
  return out
}
const hasAny = (s, words) => words.some((w) => occurrences(s, w).length > 0)

/** 구획 이름표를 긴 낱말부터 찾고 찾은 자리를 지워 가며 센다 — 「위치」의 「위」나 「마지막 행동」의 「마지막」이 다른 낱말로 읽히지 않게. */
function nameSections(lc, table, skip = new Set()) {
  const cands = table.flatMap((e) => e.words.filter((w) => typeof w === 'string' && !skip.has(w)).map((w) => ({ e, w }))).sort((a, b) => b.w.length - a.w.length)
  let rest = lc
  const hits = new Map()
  for (const { e, w } of cands) {
    for (const [a, b] of occurrences(rest, w)) {
      const cur = hits.get(e)
      if (!cur || a < cur.idx) hits.set(e, { idx: a, end: b })
      rest = rest.slice(0, a) + ' '.repeat(b - a) + rest.slice(b)
    }
  }
  return { hits: [...hits].map(([e, h]) => ({ e, ...h })).sort((x, y) => x.idx - y.idx), rest }
}

function mergedTable(t, siteKinds, archKinds) {
  const byKind = new Map()
  for (const e of [...t.SECTION_WORDS, ...t.EXTRA_SECTION_WORDS]) {
    const k = e.kind.source
    const cur = byKind.get(k)
    byKind.set(k, cur ? { kind: cur.kind, words: [...new Set([...cur.words, ...e.words])] } : { kind: e.kind, words: [...e.words] })
  }
  // 「workflow-features」·「external-reviews」처럼 kind 이름을 그대로 쓴 말
  for (const kind of new Set([...siteKinds, ...archKinds])) if (kind.includes('-') && ![...byKind.values()].some((e) => e.kind.test(kind))) byKind.set(`^${kind}$`, { kind: new RegExp(`^${esc(kind)}$`), words: [kind] })
  return [...byKind.values()]
}

/** 같은 이름이 여러 쪽에 있을 때 고를 쪽: 쪽 이름이 나왔으면 그 쪽, 아니면 home, 그래도 여럿이면 null. */
function choosePage(pageIds, kind, lc, t) {
  const uniq = [...new Set(pageIds)]
  if (uniq.length === 1) return uniq[0]
  const mentioned = uniq.filter((id) => (t.PAGE_WORDS[id] && t.has(lc, t.PAGE_WORDS[id])) || (id !== kind && /^[a-z-]+$/.test(id) && new RegExp(`(?<![a-z])${esc(id)}(?![a-z])`, 'i').test(lc)))
  if (mentioned.length === 1) return mentioned[0]
  if (!mentioned.length && uniq.includes('home')) return 'home'
  return null
}

// ── 말 → 요청 ───────────────────────────────────────────────────────────────

/**
 * @param {{ raw: string, lc: string, lang: 'ko'|'en', site: object, wantsCopy: boolean, t: object }} a  t: 낱말·도우미(has·esc·SECTION_WORDS·EXTRA_SECTION_WORDS·PAGE_WORDS — 표는 사전 revise 에서 온다)
 * @returns {object|undefined}  undefined = 구조 말이 아니다
 */
export function parseStructure({ raw, lc, lang, site, wantsCopy, t }) {
  const L = lang
  if (wantsCopy) return undefined // 문구 말은 기존 사상이 맡는다
  const removeHit = hasAny(lc, REMOVE_WORDS)
  const addStrong = hasAny(lc, ADD_STRONG)
  const addWeak = hasAny(lc, ADD_WEAK)
  const orderHit = hasAny(lc, ORDER_WORDS) || (hasAny(lc, ORDER_VERBS) && (hasAny(lc, DEST_START) || hasAny(lc, DEST_END)))
  if (!removeHit && !addStrong && !addWeak && !orderHit) return undefined
  if (removeHit && hasAny(lc, DECOR_WORDS)) return undefined // 「장식 없애줘」 — 구획을 빼라는 말이 아니다
  const siteKeys = Object.keys(site?.sections ?? {})
  const arch = archetypeOf(site?.archetype)
  const aSecs = archSections(arch)
  const table = mergedTable(t, siteKeys.map(kindOf), aSecs.map((s) => s.kind))
  const positional = orderHit || addStrong || addWeak
  const skip = positional && !removeHit ? DEST_AMBIGUOUS_SECTION_WORDS : new Set()
  const { hits, rest } = nameSections(lc, table, skip)

  // 자리 말(맨 위·맨 아래·처음·끝) — 구획 이름을 지운 글에서 찾는다
  const destOf = () => {
    const start = hasAny(rest, DEST_START), end = hasAny(rest, DEST_END)
    return start && !end ? 'start' : end && !start ? 'end' : null
  }
  const relationOf = () => {
    const after = hasAny(rest, AFTER_WORDS), before = hasAny(rest, BEFORE_WORDS)
    return after && !before ? 'after' : before && !after ? 'before' : null
  }

  if (removeHit) {
    if (orderHit && relationOf()) return { ask: say(L, 'vague') }
    if (!hits.length) return undefined // 구획 이름 없는 「없애줘」 — 기존 사상(되묻기)이 맡는다
    if (hits.length > 1) return askList(L, 'onlyOne', hits.map((h) => h.e.words[0]))
    return parseRemove({ raw, lc, L, hit: hits[0], siteKeys, arch, t })
  }
  if (addStrong || addWeak) return parseAdd({ raw, lc, L, hits, siteKeys, arch, aSecs, strong: addStrong, relationOf, destOf, t })
  if (!hits.length) return undefined // 구획 이름이 없는 「위로」 — 기존 사상이 맡는다
  return parseOrder({ raw, lc, L, hits, siteKeys, relationOf, destOf, t })
}

const keysOfEntry = (entry, siteKeys) => siteKeys.filter((k) => entry.e.kind.test(kindOf(k)))

function requiredSpec(arch, key) {
  if (!arch) return null
  if (key.startsWith('global/')) return (arch.globalSections ?? []).find((g) => `global/${g.kind}` === key) ?? null
  return archSections(arch).find((s) => s.key === key)?.spec ?? null
}

function parseRemove({ raw, lc, L, hit, siteKeys, arch, t }) {
  const keys = keysOfEntry(hit, siteKeys)
  if (!keys.length) return askList(L, 'noSection', [...new Set(siteKeys.map(kindOf))])
  const kinds = [...new Set(keys.map(kindOf))]
  if (kinds.length > 1) return askList(L, 'onlyOne', kinds)
  let target = keys[0]
  if (keys.length > 1) {
    const page = choosePage(keys.map(pageIdOf), kinds[0], lc, t)
    if (!page) return askList(L, 'pages', [...new Set(keys.map(pageIdOf))])
    target = keys.find((k) => pageIdOf(k) === page)
  }
  if (requiredSpec(arch, target)?.required === true) return ask(L, 'mustStay')
  return { scope: 'remove', target, intent: 'remove', text: raw }
}

function parseAdd({ raw, lc, L, hits, siteKeys, arch, aSecs, strong, relationOf, destOf, t }) {
  if (!arch) return strong ? askList(L, 'noSection', [...new Set(siteKeys.map(kindOf))]) : undefined
  const present = new Set(siteKeys)
  const addable = aSecs.filter((s) => !s.required && s.block && !present.has(s.key))
  const addableKinds = [...new Set(addable.map((s) => s.kind))]
  if (!hits.length) return strong ? askList(L, 'whichAdd', addableKinds) : undefined
  if (hits.length > 2) return askList(L, 'onlyOne', addableKinds)

  // 더할 구획과 기준 구획(둘을 말했을 때) 가리기 — 더할 것은 사이트에 없는 쪽
  const info = hits.map((h) => {
    const cands = aSecs.filter((s) => h.e.kind.test(s.kind))
    return { h, cands, canAdd: cands.filter((s) => !s.required && s.block && !present.has(s.key)), here: siteKeys.filter((k) => h.e.kind.test(kindOf(k))) }
  })
  const adding = info.filter((i) => i.canAdd.length)
  if (info.length === 2 && adding.length === 1 && adding[0].here.length === 0 && info.find((i) => i !== adding[0]).here.length) {
    const other = info.find((i) => i !== adding[0])
    return addRequest({ raw, lc, L, item: adding[0], anchorInfo: other, relationOf, destOf, t })
  }
  if (info.length === 2) return askList(L, 'onlyOne', addableKinds)
  const item = info[0]
  if (!item.canAdd.length) {
    if (!strong) return undefined // 「히어로를 대담하게 만들어줘」 — 있는 구획이면 기존 사상
    if (item.here.length || item.cands.some((c) => c.required)) return askList(L, 'already', [...new Set([...item.here.map(kindOf), ...item.cands.filter((c) => c.required).map((c) => c.kind)])])
    return askList(L, 'canAdd', addableKinds)
  }
  return addRequest({ raw, lc, L, item, anchorInfo: null, relationOf, destOf, t })
}

function addRequest({ raw, lc, L, item, anchorInfo, relationOf, destOf, t }) {
  const pages = item.canAdd.map((s) => s.page)
  const page = choosePage(pages, item.canAdd[0].kind, lc, t)
  if (!page) return askList(L, 'pages', [...new Set(pages)])
  const target = item.canAdd.find((s) => s.page === page).key
  const out = { scope: 'add', target, intent: 'add', text: raw }
  let place = anchorInfo ? relationOf() : destOf()
  if (anchorInfo) {
    if (!place) return ask(L, 'relation')
    const anchorKeys = anchorInfo.here.filter((k) => pageIdOf(k) === page)
    if (!anchorKeys.length) return ask(L, 'samePage')
    return { ...out, anchor: anchorKeys[0], place }
  }
  place = destOf()
  return place ? { ...out, anchor: null, place } : out
}

function parseOrder({ raw, lc, L, hits, siteKeys, relationOf, destOf, t }) {
  if (hits.length > 2) return askList(L, 'onlyOne', hits.map((h) => h.e.words[0]))
  const infos = hits.map((h) => ({ h, keys: keysOfEntry(h, siteKeys) }))
  if (infos.some((i) => !i.keys.length)) return askList(L, 'noSection', [...new Set(siteKeys.map(kindOf))])
  // 푸터 같은 전역 구획은 쪽 순서에 없다 — 쪽을 가리기 전에 알려 준다
  const globalKey = infos.flatMap((i) => i.keys).find((k) => k.startsWith('global/'))
  if (globalKey) return /^footer/.test(kindOf(globalKey)) ? ask(L, 'footerLast') : ask(L, 'globalFixed')
  // 옮길 구획: 목적격 조사가 붙은 쪽(~를/~을), 없으면 먼저 말한 쪽
  const marked = (i) => /^\s*(?:구획|섹션|부분|section)?\s*[을를]/.test(lc.slice(i.h.end))
  let mover = infos[0]
  if (infos.length === 2 && !marked(infos[0]) && marked(infos[1])) mover = infos[1]
  const anchorInfo = infos.length === 2 ? infos.find((i) => i !== mover) : null
  // 쪽 가리기: 두 구획이 함께 있는 쪽
  let moverKey, anchorKey = null
  if (anchorInfo) {
    const common = [...new Set(mover.keys.map(pageIdOf))].filter((p) => anchorInfo.keys.some((k) => pageIdOf(k) === p))
    if (!common.length) return ask(L, 'samePage')
    const page = choosePage(common, kindOf(mover.keys[0]), lc, t)
    if (!page) return askList(L, 'pages', common)
    moverKey = mover.keys.find((k) => pageIdOf(k) === page)
    anchorKey = anchorInfo.keys.find((k) => pageIdOf(k) === page)
  } else {
    const kinds = [...new Set(mover.keys.map(kindOf))]
    if (kinds.length > 1) return askList(L, 'onlyOne', kinds)
    moverKey = mover.keys[0]
    if (mover.keys.length > 1) {
      const page = choosePage(mover.keys.map(pageIdOf), kinds[0], lc, t)
      if (!page) return askList(L, 'pages', [...new Set(mover.keys.map(pageIdOf))])
      moverKey = mover.keys.find((k) => pageIdOf(k) === page)
    }
  }
  const place = anchorKey ? relationOf() : destOf()
  if (!anchorKey && !place) return ask(L, 'whereOrder')
  if (anchorKey && !place) return ask(L, 'relation')
  const op = { scope: 'order', target: moverKey, anchor: anchorKey, place, intent: 'order', text: raw }
  // 고정 위치는 이 쪽에서 곧바로 알 수 있는 만큼 확인한다(최종 확인은 사이트맵 기준 planStructure)
  const bad = orderViolation(L, op, siteKeys)
  return bad ?? op
}

/** 히어로는 처음·푸터는 끝 고정, 전역 구획은 쪽 순서에 없다. 어기면 되묻기. */
function orderViolation(L, op, siteKeys) {
  const keys = [op.target, op.anchor].filter(Boolean)
  if (keys.some((k) => k.startsWith('global/'))) return keys.some((k) => /^footer/.test(kindOf(k))) ? ask(L, 'footerLast') : ask(L, 'globalFixed')
  if (/^hero/.test(kindOf(op.target))) return ask(L, 'heroFirst')
  if (/^footer/.test(kindOf(op.target)) || (op.anchor && /^footer/.test(kindOf(op.anchor)) && op.place === 'after')) return ask(L, 'footerLast')
  const pageHasHero = siteKeys.some((k) => pageIdOf(k) === pageIdOf(op.target) && /^hero/.test(kindOf(k)))
  if (pageHasHero && (op.place === 'start' || (op.place === 'before' && op.anchor && /^hero/.test(kindOf(op.anchor))))) return ask(L, 'heroFirst')
  return null
}

// ── 사이트맵 기준 계획 ───────────────────────────────────────────────────────

const clone = (v) => JSON.parse(JSON.stringify(v))
function locate(sitemap, key) {
  if (key.startsWith('global/')) {
    const i = (sitemap.globals ?? []).findIndex((g) => `global/${g.kind}` === key)
    return i < 0 ? null : { global: true, i, section: sitemap.globals[i] }
  }
  const page = sitemap.pages.find((p) => !p.legal && p.id === pageIdOf(key))
  const i = page ? page.sections.findIndex((s) => s.kind === kindOf(key)) : -1
  return i < 0 ? null : { global: false, page, i, section: page.sections[i] }
}

/**
 * 사이트맵(02)에 이 조작을 적용한 결과를 정한다. 말 해석(parseStructure)이 사이트(06)의 키 표를 보고 한 판단을 사이트맵 기준으로 다시 확인한다.
 * @returns {{ ask: string } | { plan: { scope: string, key: string, sitemap: object, page: string|null, before: string[], after: string[], index: number|null, archSection?: object } }}
 */
export function planStructure({ sitemap, archetype, op, facts = {}, lang = 'ko' }) {
  const L = lang
  const sm = clone(sitemap)
  const key = op.target
  const loc = locate(sm, key)
  const orderOf = (page) => page.sections.map((s) => s.kind)

  if (op.scope === 'remove') {
    if (!loc) return askList(L, 'noSection', sm.pages.filter((p) => !p.legal).flatMap((p) => p.sections.map((s) => s.kind)))
    if (loc.section.required === true) return ask(L, 'mustStay')
    if (!loc.global && loc.page.sections.length === 1) return ask(L, 'wouldEmpty')
    const before = loc.global ? sm.globals.map((g) => g.kind) : orderOf(loc.page)
    if (loc.global) sm.globals.splice(loc.i, 1)
    else {
      loc.page.sections.splice(loc.i, 1)
      sm.excluded = [...(sm.excluded ?? []), { page: loc.page.id, kind: loc.section.kind, why: 'revise-removed' }]
    }
    return { plan: { scope: 'remove', key, sitemap: sm, page: loc.global ? null : loc.page.id, before, after: loc.global ? sm.globals.map((g) => g.kind) : orderOf(loc.page), index: loc.i } }
  }

  if (op.scope === 'order') {
    const anchor = op.anchor ? locate(sm, op.anchor) : null
    if (!loc || (op.anchor && !anchor)) return askList(L, 'noSection', sm.pages.filter((p) => !p.legal).flatMap((p) => p.sections.map((s) => s.kind)))
    if (loc.global || anchor?.global) return /^footer/.test(kindOf(key)) || (op.anchor && /^footer/.test(kindOf(op.anchor))) ? ask(L, 'footerLast') : ask(L, 'globalFixed')
    if (anchor && anchor.page !== loc.page) return ask(L, 'samePage')
    const page = loc.page
    const bad = orderViolation(L, op, page.sections.map((s) => `${page.id}/${s.kind}`))
    if (bad) return bad
    const before = orderOf(page)
    const moving = page.sections.splice(loc.i, 1)[0]
    let at
    if (op.place === 'start') at = 0
    else if (op.place === 'end') at = page.sections.length
    else {
      const ai = page.sections.findIndex((s) => s.kind === kindOf(op.anchor))
      at = op.place === 'before' ? ai : ai + 1
    }
    page.sections.splice(at, 0, moving)
    const after = orderOf(page)
    if (after.join() === before.join()) return ask(L, 'sameSpot')
    return { plan: { scope: 'order', key, sitemap: sm, page: page.id, before, after, index: at } }
  }

  if (op.scope === 'add') {
    const [pid, kind] = key.split('/')
    const archSec = archetype?.pages?.find((p) => p.id === pid)?.sections.find((s) => s.kind === kind)
    const addableKinds = () => archSections(archetype).filter((s) => !s.required && s.block && !locate(sm, s.key)).map((s) => s.kind)
    if (loc) return askList(L, 'already', [kind])
    if (!archSec || (archSec.allowedVariants?.length ?? 0) === 0 || archSec.required === true) return askList(L, 'canAdd', [...new Set(addableKinds())])
    const gate = FACT_GATED[`${archetype.id}/${key}`]
    if (gate && !hasFact({ facts }, gate)) return ask(L, 'needsFacts')
    const page = sm.pages.find((p) => !p.legal && p.id === pid)
    if (!page) return askList(L, 'canAdd', [...new Set(addableKinds())])
    const before = orderOf(page)
    let at
    if (op.place) {
      if (op.place === 'start') at = 0
      else if (op.place === 'end') at = page.sections.length
      else {
        const ai = page.sections.findIndex((s) => s.kind === kindOf(op.anchor ?? ''))
        if (ai < 0) return ask(L, 'samePage')
        at = op.place === 'before' ? ai : ai + 1
      }
    } else {
      // 원형이 적은 순서를 지킨다: 이미 있는 구획 중 원형에서 앞에 있는 것들의 마지막 뒤
      const order = archetype.pages.find((p) => p.id === pid).sections.map((s) => s.kind)
      const mine = order.indexOf(kind)
      at = 0
      page.sections.forEach((s, i) => { const o = order.indexOf(s.kind); if (o >= 0 && o < mine) at = i + 1 })
    }
    if (page.sections[0] && /^hero/.test(page.sections[0].kind) && at === 0) {
      if (op.place) return ask(L, 'heroFirst')
      at = 1
    }
    page.sections.splice(at, 0, sectionOf(archSec))
    sm.excluded = (sm.excluded ?? []).filter((e) => !(e.page === pid && e.kind === kind))
    return { plan: { scope: 'add', key, sitemap: sm, page: pid, before, after: orderOf(page), index: at, archSection: archSec } }
  }
  throw new Error(`planStructure: 모르는 scope ${op.scope}`)
}

// ── 04 문구 칸을 새 사이트맵에 맞추기 ────────────────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const unwrap = (saved) => (isObj(saved) && 'inputHash' in saved && 'data' in saved ? saved.data : saved)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
function writeAtomic(file, text) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}
const writeJson = (file, v) => writeAtomic(file, JSON.stringify(v, null, 2) + '\n')

/** 새 구획의 문구 칸(원형이 적은 copySlots + 블록의 화면 문구 칸). 사실이 없는 칸은 자리 표시(placeholder)여야 하는 칸이다. */
export function newSlotsFor({ archetype, kind, key, block, facts, uiLeaves = [] }) {
  const sec = archetype.pages.find((p) => p.id === pageIdOf(key))?.sections.find((s) => s.kind === kind)
  const out = []
  for (const c of sec?.copySlots ?? []) {
    const wanted = slotFacts(archetype.id, c.id, kind)
    const used = Object.keys(facts ?? {}).filter((k) => wanted.some((w) => norm(w) === norm(k)))
    out.push({ path: `${key}/${c.id}`, id: c.id, role: c.role, maxChars: c.maxChars ?? null, block, factsUsed: used, ...(wanted.length ? { factsWanted: wanted, placeholder: used.length === 0 } : {}) })
  }
  for (const leaf of uiLeaves) {
    out.push({ path: `${key}/ui:${leaf.path}`, id: `ui:${leaf.path}`, role: UI_ROLE(leaf.example), maxChars: null, block, factsUsed: [], ui: { path: leaf.path, example: leaf.example, why: leaf.why, ...(leaf.why === 'digits' ? { numbers: uiNumberKind(leaf.example) } : {}) } })
  }
  return out
}

/**
 * 새 사이트맵의 구획 순서로 04 요청의 문구 칸을 다시 늘어놓고, 04 콘텐츠의 문구 항목을 그 칸에 다시 짝짓는다.
 * 문구 칸은 id 와 나온 차례로 짝지어지므로(bindCopy) 칸이 빠지거나 자리가 바뀌면 같은 id 를 가진 다른 구획의 글을 읽는다 — 항목을 칸과 같이 옮겨야 글이 밀리지 않는다.
 * @param {{ request: object, content: object, sitemap: object, removedKey?: string, added?: { key: string, slots: object[] }, preview: boolean, locale: string }} a
 */
export function realign({ request, content, sitemap, removedKey, added, preview, locale }) {
  const bound = bindCopy(request, content)
  const keyOf = (path) => path.split('/').slice(0, 2).join('/')
  const byKey = new Map()
  for (const s of request.slots) byKey.set(keyOf(s.path), [...(byKey.get(keyOf(s.path)) ?? []), s])
  const order = sitemap.pages.filter((p) => !p.legal).flatMap((p) => p.sections.map((s) => `${p.id}/${s.kind}`))
  const fresh = new Set(added?.slots.map((s) => s.path) ?? [])
  const slots = order.flatMap((k) => byKey.get(k) ?? (added && added.key === k ? added.slots : []))
  const ph = PLACEHOLDER[locale] ?? PLACEHOLDER.ko
  const copy = []
  for (const s of slots) {
    const hit = bound.get(s.path)
    if (hit) { copy.push(structuredClone(hit.entry)); continue }
    if (!fresh.has(s.path)) continue // 옛 칸에 글이 없던 것(안내 문구 칸 등)은 그대로 비워 둔다
    if (s.ui) continue // 안내 문구 칸은 문구 에이전트가 쓴다(기존 구획 교체와 같다)
    // 새 문구 칸: 사실이 없는 칸은 정확히 자리 표시, 사실이 있는 칸은 에이전트가 쓸 때까지 비운다(미리보기만 자리 표시로 채워 그린다)
    copy.push({ id: s.id, role: s.role, text: s.placeholder || preview ? ph : '' })
  }
  const nextRequest = { ...request, slots, sections: order.filter((k) => locate(sitemap, k)?.section.status === 'block') }
  if (Array.isArray(request.skipped) && removedKey) nextRequest.skipped = request.skipped.filter((x) => x.path !== removedKey)
  if (Array.isArray(request.structureSlots) && removedKey) nextRequest.structureSlots = request.structureSlots.map((x) => ({ ...x, sections: (x.sections ?? []).filter((k) => k !== removedKey) })).filter((x) => (x.sections ?? []).length)
  const nextContent = structuredClone(content)
  nextContent.slots = { ...(isObj(content.slots) ? content.slots : {}), copy }
  if (removedKey && isObj(nextContent.copyVariants)) {
    delete nextContent.copyVariants[removedKey]
    if (!Object.keys(nextContent.copyVariants).length) delete nextContent.copyVariants
  }
  return { request: nextRequest, content: nextContent }
}

/**
 * 후보 폴더(제안 사본 또는 진짜 후보)에 계획을 쓴다 — 02 사이트맵 · 03 변형 · 04 요청 · 04 콘텐츠(원본 모양으로).
 * 03 과 04 의 입력 해시는 건드리지 않는다: 03 은 revisedFor 로 이 사이트맵을 적어 stamp 가 다시 고르지 않게 하고, 04 콘텐츠는 래퍼 없는 원본으로 다시 써 다음 실행이 새 요청으로 검사해 해시를 붙인다.
 */
export function writeStructure({ candDir, plan, archetype, block = null, uiLeaves = [], preview = false, pin = false }) {
  const sitemap = clone(plan.sitemap)
  if (pin && plan.scope === 'add') { const s = locate(sitemap, plan.key)?.section; if (s) s.allowedVariants = [block] } // 제안 사본: 06 이 이 안을 다른 변형으로 슬쩍 바꾸지 못하게
  const patch = (name, fn, extra = {}) => {
    const file = join(candDir, `${name}.json`)
    const saved = readJson(file)
    if (isObj(saved) && 'inputHash' in saved && 'data' in saved) writeJson(file, { ...saved, ...extra, data: fn(structuredClone(saved.data)) })
    else writeJson(file, fn(structuredClone(saved)))
  }
  patch('02-sitemap', () => sitemap)
  patch('03-variants', (v) => { if (plan.scope === 'remove') delete v[plan.key]; if (plan.scope === 'add') v[plan.key] = block; return v }, { revisedFor: inputHash(clone(sitemap)) })
  const request = readJson(join(candDir, '04-content.request.json'))
  const content = unwrap(readJson(join(candDir, '04-content.json')))
  const locale = request.locale ?? 'ko'
  const added = plan.scope === 'add' ? { key: plan.key, slots: newSlotsFor({ archetype, kind: kindOf(plan.key), key: plan.key, block, facts: request.facts, uiLeaves }) } : undefined
  const r = realign({ request, content, sitemap, removedKey: plan.scope === 'remove' ? plan.key : undefined, added, preview, locale })
  const pending = added ? added.slots.map((s) => s.path) : []
  writeJson(join(candDir, '04-content.request.json'), { ...r.request, ...(pending.length && !preview ? { pendingSlots: pending } : {}) })
  writeJson(join(candDir, '04-content.json'), r.content)
  return { pending }
}

// ── 안 만들기 ────────────────────────────────────────────────────────────────

const LABEL = { remove: '빼기', order: '순서 바꾸기', add: '더하기' }

/** tools: revise.mjs 가 넘기는 내부 도우미(제안 사본 만들기·보드 틀 등) */
export async function reviseStructure({ ctx, request, n, opts, prefs, now, text, tools }) {
  const archetype = archetypeOf(ctx.sitemap.archetype)
  if (!archetype) throw new Error(`원형을 모른다: ${ctx.sitemap.archetype}`)
  const lang = text && !/[가-힣]/.test(text) ? 'en' : 'ko'
  const planned = planStructure({ sitemap: ctx.sitemap, archetype, op: request, facts: ctx.request?.facts ?? {}, lang })
  if (planned.ask) return { ask: planned.ask }
  const { plan } = planned
  const index = tools.nextIndex(ctx.candDir)
  const routesOf = plan.scope === 'add' ? plan.sitemapRoutes ?? ctx.sitemap.pages.filter((p) => p.id === plan.page).map((p) => p.route) : tools.routesFor(ctx.sitemap, request.target)
  const locale = ctx.request?.locale === 'en' ? 'en' : 'ko'
  const notes = []
  const picks = []
  if (plan.scope === 'add') {
    const ranked = await tools.rankSection({ sitemap: plan.sitemap, key: plan.key, head: ctx.cand.recipe, exclude: [], count: n, intent: 'different', preferences: prefs, seed: opts.seed ?? 0 })
    picks.push(...ranked.picks)
    if (ranked.picks.length < n) notes.push(fill(grammar.text.section.fewAllowed[lang], { count: ranked.picks.length }))
  } else picks.push(null)
  const variants = []
  for (const [i, block] of picks.entries()) {
    const vid = `v${i + 1}`
    const uiLeaves = block ? (await uiSlotTable([block], { locale })).get(block) ?? [] : []
    let p
    try {
      p = await tools.buildProposal({
        ctx, index, vid, cand: ctx.cand, opts, routes: routesOf,
        mutate: (candDir) => writeStructure({ candDir, plan, archetype, block, uiLeaves, preview: true, pin: true }),
      })
    } catch (e) {
      // 콘텐츠 스키마가 이 사이트에서 그 구획의 칸을 거절하면(예: 의료 업종 사이트의 후기 칸 — 의료법) 도구 실패가 아니라 정직한 거절이다. 만들다 만 제안 폴더는 지운다.
      const m = /콘텐츠가 스키마를 통과하지 못했다: (?:\S+ — )?(.+?)(?:;|$)/.exec(String(e?.message ?? ''))
      if (!m) throw e
      rmSync(join(ctx.candDir, '09-revise', String(index)), { recursive: true, force: true })
      return { ask: say(lang, 'schemaRefused', m[1]) }
    }
    const changed = tools.sectionsChanged(ctx.site, p.newSite)
    const needsCopy = block ? newSlotsFor({ archetype, kind: kindOf(plan.key), key: plan.key, block, facts: ctx.request?.facts, uiLeaves }).map((s) => s.path) : []
    variants.push({
      id: vid, ...(block ? { block } : {}), op: plan.scope, label: block ? `${vid} ${LABEL[plan.scope]} — ${block}` : `${vid} ${LABEL[plan.scope]}`,
      diff: { kind: plan.scope, key: plan.key, page: plan.page, ...(request.anchor ? { anchor: request.anchor } : {}), ...(request.place ? { place: request.place } : {}), pageOrder: { before: plan.before, after: plan.after }, from: null, to: block, sections: changed, files: p.files, blockersAdded: p.blockers, blockersRemoved: p.blockersRemoved, needsCopy },
      blockers: p.blockers, weight: block ? weightOf(prefs, ctx.sitemap.archetype, block) : 1, qa: p.qa, siteRel: p.siteRel, previewUrl: null,
    })
  }
  const status = variants.length ? 'ready' : 'empty'
  const board = {
    ...tools.boardBase({ ctx, request, index, now, text, status }), route: routesOf.length === 1 ? routesOf[0] : null, routes: routesOf,
    structure: { scope: plan.scope, key: plan.key, ...(request.anchor !== undefined ? { anchor: request.anchor } : {}), ...(request.place ? { place: request.place } : {}), page: plan.page, before: plan.before },
    before: { pageOrder: plan.before, blockers: tools.candidateBlockers(ctx.candDir) }, variants, notes, picked: null,
  }
  const boardFile = join(ctx.candDir, '09-revise', String(index), 'board.json')
  writeJson(boardFile, board)
  return { index, boardFile, scope: plan.scope, target: request.target, intent: request.intent, status, variants, notes }
}

// ── 고르기 ───────────────────────────────────────────────────────────────────

export async function applyStructure({ candDir, board, v, opts }) {
  const sitemap = unwrap(readJson(join(candDir, '02-sitemap.json')))
  const archetype = archetypeOf(sitemap.archetype)
  const request = readJson(join(candDir, '04-content.request.json'))
  const s = board.structure
  if (!s) throw new Error(`09-revise/${board.index} 보드에 구조 조작 정보(structure)가 없다`)
  const op = { scope: s.scope, target: s.key, ...(s.anchor !== undefined ? { anchor: s.anchor } : {}), ...(s.place ? { place: s.place } : {}) }
  const planned = planStructure({ sitemap, archetype, op, facts: request.facts ?? {}, lang: request.locale === 'en' ? 'en' : 'ko' })
  if (planned.ask) throw new Error(`${planned.ask} (${board.structure.scope} ${s.key}) — 아무것도 바꾸지 않았다`)
  const { plan } = planned
  if (plan.before.join() !== (s.before ?? plan.before).join()) throw new Error(`${say('ko', 'changed')} — 아무것도 바꾸지 않았다`)
  const locale = request.locale === 'en' ? 'en' : 'ko'
  const uiLeaves = v.block ? (await uiSlotTable([v.block], { locale })).get(v.block) ?? [] : []
  // 학습(구획 교체와 같다): 더하기는 고른 변형이 이기고 다른 안이 진다. 빼기·순서는 변형을 고르지 않는다.
  let learned = 0
  let learnedPicks
  let prefsNext
  if (plan.scope === 'add') {
    const prefs = loadPreferences({ ...(opts.seedFile ? { seedFile: opts.seedFile } : {}), ...(opts.userFile ? { userFile: opts.userFile } : {}) })
    prefsNext = prefs
    const losers = [...new Set(board.variants.filter((x) => x.id !== v.id).map((x) => x.block).filter((b) => b && b !== v.block))]
    for (const loser of losers) prefsNext = recordPick(prefsNext, { archetype: sitemap.archetype, winner: v.block, loser, kind: 'section' })
    learned = losers.length
    if (losers.length) learnedPicks = { archetype: sitemap.archetype, winner: v.block, losers, kind: 'section' }
  }
  const { pending } = writeStructure({ candDir, plan, archetype, block: v.block ?? null, uiLeaves, preview: false, pin: false })
  if (prefsNext) savePreferences(prefsNext, opts.userFile ? { userFile: opts.userFile } : {})
  const requestFile = join(candDir, '04-content.request.json')
  const out = { target: plan.key, op: plan.scope, learned, ...(learnedPicks ? { learnedPicks } : {}), pageOrder: { before: plan.before, after: plan.after }, ...(v.block ? { block: v.block } : {}) }
  if (plan.scope === 'add' && pending.length) {
    return { ...out, waitingCopy: requestFile, next: `새 구획의 문구 칸 ${pending.length}개가 비어 있다 — 문구 에이전트가 ${requestFile} 의 pendingSlots 를 factory/stamp/COPY.md 대로 채운 04-content.json 을 쓴 뒤 같은 --run 으로 찍어내기를 다시 돌린다` }
  }
  return { ...out, next: '같은 --run 으로 찍어내기를 다시 돌린다 — 06·07 은 그 입력이 바뀌어 다시 돈다 (문구는 새 구획 순서에 맞춰 04 에서 이미 옮겨 두었다)' }
}
