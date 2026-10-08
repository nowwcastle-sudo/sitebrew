#!/usr/bin/env node
// npm run check:ux-static — 화면 없는 서버 액션 · 지키지 않는 글의 약속 · 죽은 메일 링크를 정적으로 찾는다(브라우저·빌드·네트워크 없음).
// 종료 코드: 0 = 실패가 baseline 과 같다 · 1 = 새 실패가 있거나 baseline 항목이 이제 통과한다(목록에서 뺀다) · 2 = 사용·설정 오류.
// 옵션: --json · --root <폴더> · --config <promises.json> · --baseline <baseline.json>
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { analyze, compare, validateBaseline } from "./analyze.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const o = { json: false, root: resolve(HERE, "..", ".."), config: join(HERE, "promises.json"), baseline: join(HERE, "baseline.json") }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--json") o.json = true
    else if (a === "--root" || a === "--config" || a === "--baseline") {
      const v = argv[++i]
      if (!v) throw new Error(`${a} 에 값이 필요하다`)
      o[a.slice(2)] = resolve(v)
    } else throw new Error(`알 수 없는 옵션: ${a}`)
  }
  return o
}

const readJson = (file, what) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (e) {
    throw new Error(`${what} 를 읽을 수 없다(${file}): ${e.message}`, { cause: e })
  }
}

const pad = (s, n) => String(s).padEnd(n)

function table(rows) {
  const cols = ["check", "target", "item", "status"]
  const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)))
  const line = (r) => cols.map((c, i) => pad(r[c] ?? "", w[i])).join("  ")
  return [line(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))), ...rows.map(line)].join("\n")
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const config = readJson(o.config, "promises 설정")
  const baseline = existsSync(o.baseline) ? readJson(o.baseline, "baseline") : []
  validateBaseline(baseline)
  const result = analyze(o.root, config)
  const cmp = compare(result.failures, baseline)
  const ok = cmp.added.length === 0 && cmp.fixed.length === 0

  if (o.json) {
    const out = {
      ok,
      stats: result.stats,
      failures: [...cmp.known.map((f) => ({ ...f, status: "known" })), ...cmp.added.map((f) => ({ ...f, status: "NEW" }))],
      fixed: cmp.fixed,
      warnings: result.warnings,
      counts: { failures: result.failures.length, baseline: baseline.length, new: cmp.added.length, fixed: cmp.fixed.length },
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
    return ok ? 0 : 1
  }

  const rows = [
    ...cmp.added.map((f) => ({ check: f.check, target: f.target, item: f.item ?? "?", status: "NEW" })),
    ...cmp.fixed.map((b) => ({ check: b.check, target: b.target, item: b.item, status: "fixed — remove from baseline" })),
    ...cmp.known.map((f) => ({ check: f.check, target: f.target, item: f.item, status: "known" })),
  ]
  const by = {}
  for (const f of result.failures) by[f.check] = (by[f.check] ?? 0) + 1
  const log = (s = "") => process.stdout.write(`${s}\n`)
  log(`check:ux-static — 액션 모듈 ${result.stats.actionModules}개 · 화면 파일 ${result.stats.screens}개 · 약속 ${result.stats.promisesPassed}/${result.stats.promisesTotal} 지킴 · 메일 링크 ${result.stats.emailLinks}개`)
  if (rows.length) log(`\n${table(rows)}\n`)
  for (const f of cmp.added) log(`NEW ${f.check} ${f.target}${f.item ? ` (${f.item})` : ""}: ${f.detail}`)
  for (const w of result.warnings) log(`warning: ${w}`)
  log(
    `failures ${result.failures.length} (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ") || "없음"}) · baseline ${baseline.length} · new ${cmp.added.length} · fixed ${cmp.fixed.length}`,
  )
  if (cmp.added.length) log(`\n새 실패 ${cmp.added.length}건 — 고치거나(권장) 근거를 달아 baseline.json 에 {"check","target","item"} 로 더한다.`)
  if (cmp.fixed.length) log(`\n고쳐진 항목 ${cmp.fixed.length}건 — baseline.json 에서 뺀다(목록은 줄어들기만 한다).`)
  log(ok ? "\nOK — baseline 과 같다" : "\nFAIL")
  return ok ? 0 : 1
}

try {
  process.exitCode = main()
} catch (e) {
  process.stderr.write(`check:ux-static 오류: ${e.message}\n`)
  process.exitCode = 2
}
