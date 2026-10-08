// legal-gate (J13·J10): 법률 에이전트가 쓴 07-qa/legal/<page>.review.json 을 판정한다.
//   node factory/qa/legal-gate.mjs <reviewDir> --locale ko|en [--pages privacy,terms,…]
// review.json = 조항별 배열 [{ clause, verdict: "ok"|"fix"|"unverified", basis: [{ law, article, url, mst, effectiveDate, fetchedAt }], note }]
//   또는 초안에 없는 조항을 제안할 때의 객체 { clauses: [위 배열], proposedClauses: [{ id?, title, text, law?, article?, reason? }] }.
//   proposedClauses 가 비어 있지 않으면 그 쪽은 fix 다(초안에 필수 조항이 빠졌다는 뜻 — 초안을 고쳐 다시 검토해야 통과한다).
// 종료 코드(docs/agents/agent-guide.md 「관문 도구의 종료 코드」):
//   0 = 모든 조항 ok 이고 근거가 허용 1차 출처(ko: law.go.kr 현행 인용 주소 / en: EUR-Lex·캘리포니아 주 법령·Paddle)
//   1 = 판정 실패(fix·unverified·근거 규칙 위반 — <reviewDir>/legal-gate.json 을 남긴다)
//       또는 도구 실패(검토 파일 없음·읽기 실패·모양 틀림 — stderr `도구 실패:`, 결과 파일 없음·이전 것도 지운다)
//   2 = 인자 오류
import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const RESULT_FILE = "legal-gate.json"
export const VERDICTS = ["ok", "fix", "unverified"]
/** 근거로 받는 1차 출처(호스트와 그 하위 도메인). */
export const ALLOWED_HOSTS = {
  ko: ["law.go.kr"],
  en: ["eur-lex.europa.eu", "leginfo.legislature.ca.gov", "paddle.com"],
}

class ToolFailure extends Error {}

const hostOk = (host, allowed) => allowed.some((h) => host === h || host.endsWith(`.${h}`))
const str = (v) => typeof v === "string" && v.trim() !== ""

/** 근거 한 칸의 규칙 위반 목록(빈 배열 = 통과). */
export function basisProblems(b, locale) {
  const out = []
  for (const k of ["law", "article", "url", "fetchedAt"]) if (!str(b?.[k])) out.push(`basis-field: ${k} 없음`)
  if (!str(b?.url)) return out
  let u
  try {
    u = new URL(b.url)
  } catch {
    return [...out, `basis-url: 주소가 아님 (${b.url})`]
  }
  if (u.protocol !== "https:") out.push(`basis-url: https 아님 (${b.url})`)
  if (!hostOk(u.hostname, ALLOWED_HOSTS[locale])) out.push(`basis-host: 허용 1차 출처 아님 (${u.hostname}) — ${locale}: ${ALLOWED_HOSTS[locale].join(", ")}`)
  if (locale === "ko" && hostOk(u.hostname, ALLOWED_HOSTS.ko)) {
    for (const k of ["mst", "effectiveDate"]) if (!str(b?.[k])) out.push(`basis-field: ${k} 없음(현행 MST·시행일자)`)
    const seq = u.pathname.endsWith("/LSW/lsInfoP.do") ? u.searchParams.get("lsiSeq") : null
    if (!seq) out.push(`basis-url: 인용 주소는 lsInfoP.do?lsiSeq=<MST> 형식 (${b.url})`)
    else if (str(b?.mst) && seq !== b.mst) out.push(`basis-mst: 주소 lsiSeq ${seq} ≠ mst ${b.mst}`)
  }
  return out
}

/** review.json 두 모양(배열 | { clauses, proposedClauses })을 { entries, proposed } 로 읽는다. */
function unpack(page, parsed) {
  if (Array.isArray(parsed)) return { entries: parsed, proposed: [] }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.clauses)) {
    const proposed = parsed.proposedClauses ?? []
    if (!Array.isArray(proposed)) throw new ToolFailure(`${page}.review.json proposedClauses 는 배열이어야 한다`)
    proposed.forEach((p, i) => {
      if (!str(p?.title) || !str(p?.text)) throw new ToolFailure(`${page}.review.json proposedClauses[${i}] title·text 없음`)
    })
    return { entries: parsed.clauses, proposed }
  }
  throw new ToolFailure(`${page}.review.json 이 조항 배열이 아니거나 { clauses, proposedClauses } 모양이 아니다`)
}

function checkShape(page, entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new ToolFailure(`${page}.review.json 이 조항 배열이 아니거나 비었다`)
  entries.forEach((e, i) => {
    if (!str(e?.clause)) throw new ToolFailure(`${page}.review.json [${i}] clause 없음`)
    if (!VERDICTS.includes(e.verdict)) throw new ToolFailure(`${page}.review.json [${i}] verdict 는 ok|fix|unverified (${e.verdict})`)
    if (!Array.isArray(e.basis)) throw new ToolFailure(`${page}.review.json [${i}] basis 배열 없음`)
  })
}

/** 판정. 도구 실패는 ToolFailure 로 던진다. */
export async function judge(reviewDir, { locale, pages }) {
  if (!existsSync(reviewDir)) throw new ToolFailure(`검토 폴더 없음: ${reviewDir}`)
  const files = (await readdir(reviewDir)).filter((f) => f.endsWith(".review.json")).sort()
  const found = files.map((f) => f.slice(0, -".review.json".length))
  if (found.length === 0) throw new ToolFailure(`검토 파일(*.review.json) 없음: ${reviewDir} — 법률 에이전트가 돌지 않았다`)
  const missingPages = (pages ?? []).filter((p) => !found.includes(p))
  if (missingPages.length) throw new ToolFailure(`검토 파일 없음: ${missingPages.map((p) => `${p}.review.json`).join(", ")}`)

  const result = { locale, ok: true, pages: {} }
  for (const page of found) {
    let parsed
    try {
      parsed = JSON.parse(await readFile(join(reviewDir, `${page}.review.json`), "utf8"))
    } catch (e) {
      throw new ToolFailure(`${page}.review.json 읽기 실패: ${e.message}`)
    }
    const { entries, proposed } = unpack(page, parsed)
    checkShape(page, entries)
    const failures = []
    for (const p of proposed) failures.push({ clause: p.id ?? p.title, rule: "proposed-clause", detail: `초안에 없는 조항 제안 — ${p.title}${str(p.reason) ? `: ${p.reason}` : ""}` })
    for (const e of entries) {
      if (e.verdict !== "ok") {
        failures.push({ clause: e.clause, rule: `verdict-${e.verdict}`, detail: e.note ?? "" })
        continue
      }
      if (e.basis.length === 0) failures.push({ clause: e.clause, rule: "basis-missing", detail: "ok 인데 조문 근거가 없다 — unverified 로 둔다" })
      for (const b of e.basis) for (const p of basisProblems(b, locale)) failures.push({ clause: e.clause, rule: p.split(":")[0], detail: p })
    }
    result.pages[page] = { clauses: entries.length, ok: entries.filter((e) => e.verdict === "ok").length, proposed: proposed.length, failures }
    if (failures.length) result.ok = false
  }
  return result
}

function parseArgs(argv) {
  const args = { dir: null, locale: null, pages: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--locale") args.locale = argv[++i]
    else if (a === "--pages") args.pages = (argv[++i] ?? "").split(",").filter(Boolean)
    else if (a.startsWith("--")) return null
    else if (args.dir) return null
    else args.dir = a
  }
  if (!args.dir || !["ko", "en"].includes(args.locale) || (args.pages && args.pages.length === 0)) return null
  return args
}

export async function main(argv) {
  const args = parseArgs(argv)
  if (!args) {
    console.error("인자 오류: legal-gate.mjs <reviewDir> --locale ko|en [--pages privacy,terms,…]")
    return 2
  }
  const dir = resolve(args.dir)
  const out = join(dir, RESULT_FILE)
  let result
  try {
    result = await judge(dir, args)
  } catch (e) {
    if (existsSync(out)) await rm(out, { force: true })
    console.error(`도구 실패: ${e instanceof ToolFailure ? e.message : (e?.stack ?? e)}`)
    return 1
  }
  await writeFile(out, JSON.stringify(result, null, 2) + "\n")
  for (const [page, r] of Object.entries(result.pages)) {
    console.log(`${page}: 조항 ${r.clauses} · ok ${r.ok} · 실패 ${r.failures.length}`)
    for (const f of r.failures) console.log(`  ${f.clause} [${f.rule}] ${f.detail}`)
  }
  console.log(result.ok ? "legal-gate: 통과 — 대표 최종 검토로 넘긴다" : "legal-gate: 실패 — 공개 불가(법률 검토 미완)")
  return result.ok ? 0 : 1
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) process.exitCode = await main(process.argv.slice(2))
