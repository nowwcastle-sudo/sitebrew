// 런북 생성·검사 명령. 파일을 읽고 쓰는 곳은 여기와 sources.mjs 뿐이다(build.mjs 는 순수).
//   node scripts/runbook/runbook.mjs gen [--check]     docs/runbook/runbook.generated.json 을 쓴다(--check: 쓰지 않고 다르면 1)
//   node scripts/runbook/runbook.mjs check [--partial] [--fresh <일>] [--today YYYY-MM-DD]
//                                                       원천 대조(check.mjs 의 규칙). 오류 있으면 1, 인자 오류 2.
//                                                       --partial: 장이 아직 다 모이지 않은 동안 규칙 1·4 를 경고로 낮춘다
// 생성물이 병합 충돌하면 손으로 고치지 말고 `npm run runbook:gen` 을 다시 돌린다.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { OUT as OUTCOMES, readItems, readSource, ROOT } from "../gen-outcomes.mjs"
import { buildRunbook, renderRunbook } from "./build.mjs"
import { checkRunbook } from "./check.mjs"
import { isDay, readSources } from "./sources.mjs"

export const DIR = "docs/runbook"
export const GENERATED = "runbook.generated.json"

/** buildRunbook 의 registry 인자: 항목 이름 → envVars, outcomes.yaml 의 parts */
export function readRegistry(root) {
  const parts = readSource(root).parts
  return {
    items: Object.fromEntries([...readItems(root)].sort(([a], [b]) => (a < b ? -1 : 1))),
    parts: Object.fromEntries(Object.entries(parts).map(([name, p]) => [name, { ...(p.feature && { feature: p.feature }), guides: p.guides ?? [] }])),
  }
}

/** 저장소 기본값 위에 시험이 넘긴 값(dir·out·outcomes·registry·today·stdout·stderr)을 얹는다 */
function context(opts) {
  const dir = opts.dir ?? join(ROOT, DIR)
  return {
    dir,
    out: opts.out ?? join(dir, GENERATED),
    outcomes: () => opts.outcomes ?? JSON.parse(readFileSync(join(ROOT, OUTCOMES), "utf8")),
    registry: () => opts.registry ?? readRegistry(ROOT),
    today: opts.today ?? new Date().toISOString().slice(0, 10),
    stdout: opts.stdout ?? ((line) => console.log(line)),
    stderr: opts.stderr ?? ((line) => console.error(line)),
  }
}

const USAGE = "usage: runbook.mjs gen [--check] | check [--partial] [--fresh <days>] [--today YYYY-MM-DD]"

function gen(flags, ctx) {
  const { data, problems } = buildRunbook(readSources(ctx.dir), ctx.outcomes(), ctx.registry())
  const text = renderRunbook(data)
  if (problems.length) ctx.stderr(`${problems.length} problem(s) in the runbook sources — see npm run runbook:check`)
  if (flags.has("--check")) {
    const same = existsSync(ctx.out) && readFileSync(ctx.out, "utf8") === text
    if (same) ctx.stdout(`${GENERATED} is current`)
    else ctx.stderr(`${GENERATED} differs from the sources — run npm run runbook:gen (never edit it by hand)`)
    return same ? 0 : 1
  }
  writeFileSync(ctx.out, text)
  ctx.stdout(`wrote ${GENERATED} (${data.order.length} chapters)`)
  return 0
}

/** check 인자 → { partial, fresh?, today? } 또는 null(인자 오류) */
function checkFlags(rest) {
  const flags = { partial: false }
  for (let i = 0; i < rest.length; i++) {
    const [flag, value] = [rest[i], rest[i + 1]]
    if (flag === "--partial") flags.partial = true
    else if (flag === "--fresh" && /^\d+$/.test(value ?? "")) [flags.fresh, i] = [Number(value), i + 1]
    else if (flag === "--today" && isDay(value)) [flags.today, i] = [value, i + 1]
    else return null
  }
  return flags
}

function check(flags, ctx) {
  const today = flags.today ?? ctx.today
  const sources = readSources(ctx.dir, { today })
  const outcomes = ctx.outcomes()
  const registry = ctx.registry()
  const built = buildRunbook(sources, outcomes, registry)
  const { errors, warnings } = checkRunbook({ sources, built, outcomes, registry }, { partial: flags.partial, fresh: flags.fresh, today })
  for (const p of errors) ctx.stderr(`error ${p.rule}: ${p.detail}`)
  for (const p of warnings) ctx.stderr(`warning ${p.rule}: ${p.detail}`)
  ctx.stdout(`runbook:check — ${errors.length} error(s), ${warnings.length} warning(s)${flags.partial ? " (partial)" : ""}`)
  return errors.length ? 1 : 0
}

/** @returns {number} 종료 코드 */
export function main(argv = process.argv.slice(2), opts = {}) {
  const ctx = context(opts)
  const [command, ...rest] = argv
  if (command === "gen") {
    const flags = new Set(rest)
    if ([...flags].some((f) => f !== "--check")) {
      ctx.stderr(USAGE)
      return 2
    }
    return gen(flags, ctx)
  }
  if (command === "check") {
    const flags = checkFlags(rest)
    if (flags) return check(flags, ctx)
  }
  ctx.stderr(USAGE)
  return 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main()
