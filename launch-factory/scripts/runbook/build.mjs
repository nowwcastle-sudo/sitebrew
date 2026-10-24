// 런북 생성기 — 순수 함수. 원천(readSources 결과)·성과표(outcomes.generated.json)·레지스트리 표를 받아
// runbook.generated.json 의 데이터와 문제 목록을 돌려준다. 파일을 읽지 않고 시계를 모른다.
// 파생값은 여기서 한 번만 계산한다: 장의 환경 이름·행동 수·순서·성과별 장과 uncovered·대안 via·staleAfter.
import { actions, envTokens } from "./parse.mjs"

export const VERSION = 1
export const STALE_AFTER_DAYS = 90
const LANGS = ["ko", "en"]

const uniqSorted = (list) => [...new Set(list)].sort()
const byKey = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

// ── 날짜(한 곳) ───────────────────────────────────────────────────
/** YYYY-MM-DD + n 일(UTC 달력) */
export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 확인일 + days 가 오늘보다 앞이면 오래됨(같은 날은 아직 아님) */
export const isStale = (checked, today, days) => addDays(checked, days) < today

// ── 칸 순서를 고정한 사본 ─────────────────────────────────────────
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]))
const bilingual = (v) => pick(v, LANGS)

function normalCard(c) {
  return {
    ...pick(c, ["service", "role", "need", "cost", "after", "home", "checked"]),
    ifSkipped: bilingual(c.ifSkipped),
    ...(c.when && { when: pick(c.when, ["outcomes", "locale"]) }),
    devOnly: c.devOnly,
    notEnv: c.notEnv,
  }
}

function normalAlt(a, via) {
  return {
    ...pick(a, ["service", "tags", "support", "item"]),
    ...(via && { via }),
    switchCost: bilingual(a.switchCost),
    note: bilingual(a.note),
    ...pick(a, ["home", "checked"]),
  }
}

// ── 계산 ──────────────────────────────────────────────────────────
function chapterData(gid, file, chapter, shared, card) {
  const bodies = LANGS.map((l) => chapter.body[l] ?? "")
  const own = bodies.flatMap(envTokens)
  const skip = new Set([...card.devOnly, ...card.notEnv])
  const text = {}
  for (const lang of LANGS) if (chapter.body[lang] !== undefined) text[lang] = { title: chapter.title[lang] ?? "", body: chapter.body[lang] }
  return {
    gid,
    file,
    card: normalCard(card),
    text,
    envNames: uniqSorted([...own, ...LANGS.flatMap((l) => envTokens(shared[l] ?? ""))]),
    mustName: uniqSorted(own.filter((n) => !skip.has(n))),
    actions: Object.fromEntries(LANGS.map((l) => [l, actions(chapter.body[l] ?? "")])),
    staleAfter: addDays(card.checked, STALE_AFTER_DAYS),
  }
}

/** after 위상 정렬(Kahn), 같은 칸은 gid 순. 남은 것(순환)은 gid 순으로 뒤에 붙이고 문제로 낸다 */
function topoOrder(chapters, known, problems) {
  const gids = Object.keys(chapters).sort()
  const deps = new Map(gids.map((g) => [g, new Set()]))
  for (const g of gids) {
    for (const a of chapters[g].card.after) {
      if (a in chapters) deps.get(g).add(a)
      else if (!known.has(a)) problems.push({ rule: "after-unknown", detail: `${g}: after ${a}` })
    }
  }
  const order = []
  const done = new Set()
  for (;;) {
    const next = gids.find((g) => !done.has(g) && [...deps.get(g)].every((d) => done.has(d)))
    if (!next) break
    order.push(next)
    done.add(next)
  }
  const left = gids.filter((g) => !done.has(g))
  if (left.length) problems.push({ rule: "cycle", detail: `after cycle among ${left.join(", ")}` })
  return [...order, ...left]
}

function outcomeData(o, chapters, order, registry, problems) {
  for (const field of ["say", "question"]) for (const l of LANGS) if (!o[field]?.[l]) problems.push({ rule: "outcome-text", detail: `${o.id}: ${field}.${l}` })
  const parts = [...o.parts, ...o.closure]
  const ids = uniqSorted(parts.flatMap((p) => registry.parts[p]?.guides ?? []))
  const rank = new Map(order.map((g, i) => [g, i]))
  const guides = [...ids.filter((g) => rank.has(g)).sort((a, b) => rank.get(a) - rank.get(b)), ...ids.filter((g) => !rank.has(g))]
  const mine = Object.values(chapters).filter((c) => guides.includes(c.gid) || c.card.need === "always")
  const excused = new Set(mine.flatMap((c) => [...c.card.devOnly, ...c.card.notEnv]))
  const named = new Set(mine.flatMap((c) => c.envNames))
  return {
    say: bilingual(o.say ?? {}),
    question: bilingual(o.question ?? {}),
    guides,
    uncovered: uniqSorted(o.needs.filter((n) => !excused.has(n) && !named.has(n))),
  }
}

/** 부품 이름 → 그 부품에 parts·closure 로 닿는 성과 id(정렬) */
const reachOf = (outcomes) => (part) => outcomes.filter((o) => o.parts.includes(part) || o.closure.includes(part)).map((o) => o.id).sort()

/**
 * @param {ReturnType<import("./sources.mjs").readSources>} sources
 * @param {{ hash: string, outcomes: { id: string, say: object, question: object, parts: string[], closure: string[], needs: string[] }[] }} outcomes
 * @param {{ items: Record<string, string[]>, parts: Record<string, { feature?: string, guides: string[] }> }} registry
 * @returns {{ data: object, problems: { rule: string, detail: string }[] }}
 */
export function buildRunbook(sources, outcomes, registry) {
  const problems = []
  const texts = new Map()
  for (const f of sources.files) {
    for (const ch of f.chapters) {
      if (texts.has(ch.gid)) problems.push({ rule: "parse", detail: `dupGid ${ch.gid} in ${texts.get(ch.gid).file} and ${f.file}` })
      else texts.set(ch.gid, { file: f.file, chapter: ch, shared: f.shared })
    }
  }

  const chapters = {}
  for (const [gid, card] of Object.entries(sources.cards)) {
    const t = texts.get(gid)
    if (!t) problems.push({ rule: "card-orphan", detail: `${gid}: card without chapter text` })
    else chapters[gid] = chapterData(gid, t.file, t.chapter, t.shared, card)
  }

  const guideIds = Object.values(registry.parts).flatMap((p) => p.guides)
  const known = new Set([...texts.keys(), ...Object.keys(sources.cards), ...guideIds])
  const order = topoOrder(chapters, known, problems)

  const outcomeMap = {}
  for (const o of outcomes.outcomes) outcomeMap[o.id] = outcomeData(o, chapters, order, registry, problems)

  const reach = reachOf(outcomes.outcomes)
  const alternatives = {}
  for (const [role, list] of Object.entries(sources.alternatives)) {
    alternatives[role] = list.map((a) => {
      if (a.support !== "builtin") return normalAlt(a)
      const via = reach(a.item)
      if (via.length === 0) problems.push({ rule: "alt-unreachable", detail: `${role}: ${a.service} (item ${a.item})` })
      return normalAlt(a, via)
    })
  }

  const shared = {}
  for (const f of sources.files) if (Object.keys(f.shared).length) shared[f.file] = bilingual(f.shared)

  const data = {
    version: VERSION,
    outcomesHash: outcomes.hash,
    staleAfterDays: STALE_AFTER_DAYS,
    order,
    chapters: byKey(chapters),
    shared: byKey(shared),
    outcomes: byKey(outcomeMap),
    alternatives: byKey(alternatives),
    rubric: sources.rubric,
    secretShapes: sources.secretShapes,
  }
  return { data, problems }
}

export const renderRunbook = (data) => JSON.stringify(data, null, 2) + "\n"
