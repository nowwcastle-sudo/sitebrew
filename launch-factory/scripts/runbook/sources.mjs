// 런북 원천 읽기 — docs/runbook/ 의 장 글·카드·대안·rubric·키 모양 표를 읽고 손 검사기로 모양을 본다(LF 루트에는 zod 가 없다).
// 모양 문제는 던지지 않고 problems 에 모은다(한 번에 다 보이게). 모양이 틀린 카드·대안 항목은 싣지 않는다.
// 이 모듈만 파일을 읽는다 — parse.mjs·build.mjs 는 순수하다. 시계는 인자(today)로 받는다.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { GID, parseChapterFile } from "./parse.mjs"

export const NEEDS = ["always", "feature", "optional"]
export const COSTS = ["none", "free-tier", "usage", "monthly", "per-sale", "one-time"]
export const LANGS = ["ko", "en"]
export const TAGS = ["free", "cheaper", "better", "ko"]
export const SUPPORTS = ["builtin", "code", "no"]
const ROLE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const ENV_NAME = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/
const HOME = /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const CARD_KEYS = ["service", "role", "need", "cost", "after", "home", "checked", "ifSkipped", "when", "devOnly", "notEnv"]
const ALT_KEYS = ["service", "tags", "support", "item", "switchCost", "note", "home", "checked"]

export function isDay(v) {
  if (typeof v !== "string" || !DAY.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) // 2026-02-30 처럼 넘어간 날은 아니다
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v)
const isText = (v) => typeof v === "string" && v.trim() !== ""
const sortedEntries = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/** 칸 검사 도구: where = "cards/G-x.json" 처럼 문제 앞머리 */
function checker(where, problems, today) {
  let ok = true
  const bad = (field, why) => {
    ok = false
    problems.push({ rule: "shape", detail: `${where}: ${field} ${why}` })
  }
  const c = {
    get ok() {
      return ok
    },
    fail: bad,
    text: (v, field) => isText(v) || bad(field, "must be a non-empty string"),
    oneOf: (v, field, allowed) => allowed.includes(v) || bad(field, `must be one of ${allowed.join("|")} (got ${JSON.stringify(v)})`),
    list: (v, field, test, what, { nonEmpty = false } = {}) => {
      if (!Array.isArray(v)) return bad(field, "must be an array")
      if (nonEmpty && v.length === 0) return bad(field, "must not be empty")
      if (new Set(v).size !== v.length) bad(field, "has duplicates")
      v.forEach((x, i) => test(x) || bad(`${field}[${i}]`, `must be ${what} (got ${JSON.stringify(x)})`))
    },
    bilingual: (v, field) => {
      if (!isObject(v)) return bad(field, "must be { ko, en }")
      for (const lang of LANGS) c.text(v[lang], `${field}.${lang}`)
      for (const k of Object.keys(v)) if (!LANGS.includes(k)) bad(`${field}.${k}`, "is not a language")
    },
    home: (v, field) => v === undefined || HOME.test(v) || bad(field, `must be "https://domain" with no path (got ${JSON.stringify(v)})`),
    day: (v, field) => {
      if (!isDay(v)) return bad(field, `must be a date YYYY-MM-DD (got ${JSON.stringify(v)})`)
      if (today && v > today) problems.push({ rule: "checked-future", detail: `${where}: ${v}` })
    },
    keys: (v, allowed) => {
      for (const k of Object.keys(v)) if (!allowed.includes(k)) bad(k, "is not a known field")
    },
  }
  return c
}

export function checkCard(card, where, problems, today) {
  const c = checker(where, problems, today)
  if (!isObject(card)) {
    problems.push({ rule: "shape", detail: `${where}: not an object` })
    return false
  }
  c.keys(card, CARD_KEYS)
  c.text(card.service, "service")
  if (!ROLE.test(card.role ?? "")) c.fail("role", "must be lowercase words joined by dashes")
  c.oneOf(card.need, "need", NEEDS)
  c.list(card.cost, "cost", (x) => COSTS.includes(x), COSTS.join("|"), { nonEmpty: true })
  c.list(card.after, "after", (x) => GID.test(x), "a chapter id")
  c.home(card.home, "home")
  c.day(card.checked, "checked")
  c.bilingual(card.ifSkipped, "ifSkipped")
  if (card.when !== undefined) {
    if (!isObject(card.when)) c.fail("when", "must be an object")
    else {
      for (const k of Object.keys(card.when)) if (!["outcomes", "locale"].includes(k)) c.fail(`when.${k}`, "is not a known field")
      if (card.when.outcomes !== undefined) c.list(card.when.outcomes, "when.outcomes", isText, "an outcome id", { nonEmpty: true })
      if (card.when.locale !== undefined) c.oneOf(card.when.locale, "when.locale", LANGS)
    }
  }
  for (const field of ["devOnly", "notEnv"]) c.list(card[field], field, (x) => ENV_NAME.test(x), "an UPPER_SNAKE name")
  return c.ok
}

export function checkAlt(alt, where, problems, today) {
  const c = checker(where, problems, today)
  if (!isObject(alt)) {
    problems.push({ rule: "shape", detail: `${where}: not an object` })
    return false
  }
  c.keys(alt, ALT_KEYS)
  c.text(alt.service, "service")
  c.list(alt.tags, "tags", (x) => TAGS.includes(x), TAGS.join("|"))
  c.oneOf(alt.support, "support", SUPPORTS)
  if (alt.support === "builtin") c.text(alt.item, "item")
  else if (alt.item !== undefined) c.fail("item", "is allowed only with support builtin")
  c.bilingual(alt.switchCost, "switchCost")
  c.bilingual(alt.note, "note")
  c.home(alt.home, "home")
  c.day(alt.checked, "checked")
  return c.ok
}

export function checkRubric(rubric, problems) {
  const c = checker("rubric.json", problems)
  if (!isObject(rubric)) return c.fail("root", "must be an object")
  for (const field of ["helpLine", "staleLine", "closing"]) c.bilingual(rubric[field], field)
  for (const field of ["rules", "generalWords"]) {
    if (!isObject(rubric[field])) c.fail(field, "must be { ko: [], en: [] }")
    else for (const lang of LANGS) c.list(rubric[field][lang], `${field}.${lang}`, isText, "a sentence", { nonEmpty: true })
  }
  if (!isObject(rubric.problems)) c.fail("problems", "must be an object")
  else for (const [rule, text] of Object.entries(rubric.problems)) c.bilingual(text, `problems.${rule}`)
  if (!isObject(rubric.labels)) c.fail("labels", "must be an object")
}

export function checkSecretShapes(shapes, problems) {
  if (!Array.isArray(shapes)) return problems.push({ rule: "shape", detail: "secret-shapes.json: not an array" })
  shapes.forEach((s, i) => {
    const c = checker(`secret-shapes.json[${i}]`, problems)
    if (!isObject(s)) return c.fail("entry", "must be { id, re }")
    c.keys(s, ["id", "re"])
    c.text(s.id, "id")
    try {
      new RegExp(s.re)
    } catch {
      c.fail("re", "does not compile")
    }
  })
}

/** JSON 파일 하나 — 없거나 깨지면 문제를 남기고 undefined. raw 를 주면 원문을 남긴다(금액·키 모양 검사는 모양이 틀린 파일도 본다) */
function readJsonFile(dir, rel, problems, raw) {
  const file = join(dir, rel)
  if (!existsSync(file)) return void problems.push({ rule: "shape", detail: `${rel}: missing` })
  const text = readFileSync(file, "utf8")
  if (raw) raw[rel] = text
  try {
    return JSON.parse(text)
  } catch (e) {
    problems.push({ rule: "shape", detail: `${rel}: invalid JSON (${e.message})` })
  }
}

const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [])

/**
 * @param {string} dir docs/runbook 폴더
 * @param {{ today?: string }} [opts] today 가 있으면 확인일이 오늘 뒤인 항목을 checked-future 로 낸다
 */
export function readSources(dir, { today } = {}) {
  const problems = []
  const files = []
  const raw = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
    const text = readFileSync(join(dir, file), "utf8")
    try {
      files.push({ file, text, ...parseChapterFile(text, file) })
    } catch (e) {
      if (!e.code) throw e
      problems.push({ rule: "parse", detail: `${e.code} ${e.message}` })
    }
  }

  const cards = {}
  for (const f of listJson(join(dir, "cards"))) {
    const where = `cards/${f}`
    const gid = basename(f, ".json")
    const card = readJsonFile(dir, where, problems, raw)
    if (card === undefined) continue
    let ok = checkCard(card, where, problems, today)
    if (!GID.test(gid)) {
      problems.push({ rule: "shape", detail: `${where}: file name must be a chapter id G-xxx` })
      ok = false
    }
    if (ok) cards[gid] = card
  }

  const alternatives = {}
  for (const f of listJson(join(dir, "alternatives"))) {
    const where = `alternatives/${f}`
    const role = basename(f, ".json")
    const list = readJsonFile(dir, where, problems, raw)
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      problems.push({ rule: "shape", detail: `${where}: not an array` })
      continue
    }
    if (!ROLE.test(role)) problems.push({ rule: "shape", detail: `${where}: file name must be a role (lowercase, dashes)` })
    alternatives[role] = list.filter((alt, i) => checkAlt(alt, `${where}[${i}]`, problems, today))
  }

  const rubric = readJsonFile(dir, "rubric.json", problems, raw)
  if (rubric !== undefined) checkRubric(rubric, problems)
  const secretShapes = readJsonFile(dir, "secret-shapes.json", problems)
  if (secretShapes !== undefined) checkSecretShapes(secretShapes, problems)

  return { files, cards: sortedEntries(cards), alternatives: sortedEntries(alternatives), rubric: rubric ?? {}, secretShapes: secretShapes ?? [], raw, problems }
}
