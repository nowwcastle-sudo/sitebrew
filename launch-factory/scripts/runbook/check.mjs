// runbook:check 의 대조 규칙 — 순수 함수. 원천(readSources)·생성 결과(buildRunbook)·성과표·레지스트리를 받아 오류와 경고를 돌려준다.
// 문제 글은 규칙 id + 자료(파일·id·이름)뿐이다. 키 모양에 걸린 값은 되풀이하지 않는다.
//  1 guide-missing   guides id(와 장 글의 id)에 장 글·카드가 모두 있다          (--partial: 경고)
//  2 card-orphan · after-unknown · cycle                                    (생성기가 낸다)
//  3 env-unknown     장의 환경 이름은 needs 또는 레지스트리 envVars 에 있다(devOnly·notEnv 예외)
//  4 uncovered       성과의 needs 는 그 성과의 장(+ always 장) 어딘가에 있다  (--partial: 경고)
//  5 alt-role · alt-unreachable · shape(enum)
//  6 amount          장 글·카드·대안에 금액 모양이 없다
//  7 secret          장 글·카드·대안·rubric 에 secret-shapes.json 의 모양이 없다
//  8 checked-future · stale(--fresh <일>)
//  9 launcher-unpinned  장 글·카드·대안의 npx 류 실행기는 버전을 박는다(플러그인 디렉터리 검사가 막는 모양)
import { isStale } from "./build.mjs"

export const PARTIAL_RULES = ["guide-missing", "uncovered"]
const AMOUNTS = [/\d[\d,.]*\s?(?:원|달러|USD|KRW|\$|€|만원)/g, /[$€₩]\s?\d[\d,.]*/g]

const compile = (shapes) =>
  shapes.flatMap(({ id, re }) => {
    try {
      return [{ id, re: new RegExp(re) }]
    } catch {
      return [] // 컴파일 안 되는 표는 readSources 가 shape 문제로 이미 냈다
    }
  })

/** 검사할 글: [어디, 원문] — 모양이 틀려 싣지 않은 카드·대안도 원문으로 본다 */
function texts(sources, { rubric }) {
  const md = sources.files.map((f) => [f.file, f.text])
  const json = Object.entries(sources.raw).filter(([rel]) => rubric || rel !== "rubric.json")
  return [...md, ...json]
}

function guideMissing(sources, registry) {
  const ids = new Set(Object.values(registry.parts).flatMap((p) => p.guides))
  const withText = new Set(sources.files.flatMap((f) => f.chapters.map((c) => c.gid)))
  for (const gid of withText) ids.add(gid)
  return [...ids].sort().flatMap((gid) => {
    const lack = [!withText.has(gid) && "chapter text", !(gid in sources.cards) && "card"].filter(Boolean)
    return lack.length ? [{ rule: "guide-missing", detail: `${gid}: no ${lack.join(", no ")}` }] : []
  })
}

function envUnknown(built, outcomes, registry) {
  const allowed = new Set([...outcomes.outcomes.flatMap((o) => o.needs), ...Object.values(registry.items).flat()])
  return Object.values(built.data.chapters).flatMap(({ gid, envNames, card }) => {
    const excused = new Set([...card.devOnly, ...card.notEnv])
    const bad = envNames.filter((n) => !allowed.has(n) && !excused.has(n))
    return bad.length ? [{ rule: "env-unknown", detail: `${gid}: ${bad.join(", ")}` }] : []
  })
}

const uncovered = (built) =>
  Object.entries(built.data.outcomes).flatMap(([id, o]) => (o.uncovered.length ? [{ rule: "uncovered", detail: `${id}: ${o.uncovered.join(", ")}` }] : []))

function altRole(sources) {
  const roles = new Set(Object.values(sources.cards).map((c) => c.role))
  return Object.keys(sources.alternatives).flatMap((role) => (roles.has(role) ? [] : [{ rule: "alt-role", detail: `alternatives/${role}.json: no card has role ${role}` }]))
}

function amounts(sources) {
  return texts(sources, { rubric: false }).flatMap(([where, text]) => {
    const found = [...new Set(AMOUNTS.flatMap((re) => [...text.matchAll(re)].map((m) => m[0])))]
    return found.length ? [{ rule: "amount", detail: `${where}: ${found.map((f) => JSON.stringify(f)).join(", ")}` }] : []
  })
}

function secrets(sources) {
  const shapes = compile(sources.secretShapes)
  return texts(sources, { rubric: true }).flatMap(([where, text]) => {
    const hit = shapes.filter(({ re }) => re.test(text)).map(({ id }) => id)
    return hit.length ? [{ rule: "secret", detail: `${where}: matches ${hit.join(", ")} (value not shown)` }] : []
  })
}

// 플러그인 디렉터리 검사(sitebrew ci/directory-check.mjs)의 LAUNCHER·pinned 와 같은 모양
const LAUNCHER = /\b(npx|bunx|pnpm dlx|yarn dlx|uvx|pipx run)\s+(?:-{1,2}[\w-]+(?:=\S+)?\s+)*([@\w./-]+(?:\$\{\w+\})?)/g
const PINNED = /@\d+\.\d+\.\d+([-+][\w.]+)?$/

function launchers(sources) {
  return texts(sources, { rubric: false }).flatMap(([where, text]) => {
    const bad = [...new Set([...text.matchAll(LAUNCHER)].filter((m) => !PINNED.test(m[2])).map((m) => m[0].trim()))]
    return bad.length ? [{ rule: "launcher-unpinned", detail: `${where}: ${bad.map((b) => JSON.stringify(b)).join(", ")}` }] : []
  })
}

function staleItems(sources, today, days) {
  const cards = Object.entries(sources.cards).map(([gid, c]) => [`cards/${gid}.json`, c.checked])
  const alts = Object.entries(sources.alternatives).flatMap(([role, list]) => list.map((a) => [`alternatives/${role}.json: ${a.service}`, a.checked]))
  return [...cards, ...alts].flatMap(([where, checked]) => (isStale(checked, today, days) ? [{ rule: "stale", detail: `${where}: checked ${checked}, older than ${days} days` }] : []))
}

/**
 * @param {{ sources: object, built: { data: object, problems: object[] }, outcomes: object, registry: object }} input
 * @param {{ partial?: boolean, fresh?: number, today: string }} opts readSources 는 같은 today 로 읽었어야 한다(checked-future)
 * @returns {{ errors: { rule: string, detail: string }[], warnings: { rule: string, detail: string }[] }}
 */
export function checkRunbook({ sources, built, outcomes, registry }, { partial = false, fresh, today }) {
  const problems = [
    ...sources.problems,
    ...built.problems,
    ...guideMissing(sources, registry),
    ...envUnknown(built, outcomes, registry),
    ...uncovered(built),
    ...altRole(sources),
    ...amounts(sources),
    ...secrets(sources),
    ...launchers(sources),
    ...(fresh === undefined ? [] : staleItems(sources, today, fresh)),
  ]
  const soft = (p) => partial && PARTIAL_RULES.includes(p.rule)
  return { errors: problems.filter((p) => !soft(p)), warnings: problems.filter(soft) }
}
