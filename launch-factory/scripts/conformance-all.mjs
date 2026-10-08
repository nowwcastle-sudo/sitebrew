#!/usr/bin/env node
// 적합성 일괄(v0 Task 11). 모든 어댑터를 web-factory 적합성 묶음 전체로 **녹화 응답**(가짜 공급자 HTTP + PGlite)에 돌려 표 하나로 보인다.
//   node scripts/conformance-all.mjs [--only <어댑터 일부>] [--json] [--live-sandbox]
//
// 판정: 어댑터마다 (a) 돌린 검사 수가 고정값과 같고 (b) 실패가 「예상 실패 목록」과 정확히 같고 (c) 예상 실패는 정해진 이유로 실패해야 한다.
//       목록 밖 실패·목록 안 통과·검사 수 어긋남은 모두 실패다(Gumroad 의 「지원 안 함」 20개가 그 예 — 대장 D160).
// 종료 코드: 0 = 전부 판정대로 · 1 = 실패가 있음 · 2 = 사용법 오류 · 3 = 돌리지 못한 것이 있음(web-factory 묶음을 못 불러옴, 또는 --live-sandbox 를 요청했는데 샌드박스 키가 없음).
//       1 이 3 보다 앞선다. 3 은 통과가 아니다 — 못 돌린 것을 0 으로 읽지 않으려는 값이다.
// --live-sandbox: Paddle 샌드박스 키(PADDLE_API_KEY·PADDLE_WEBHOOK_SECRET·PADDLE_CLIENT_TOKEN)가 모두 있어야 돌린다. 없으면 「건너뜀」이라고 말하고 종료 3.
//       있으면 doctor --stage sandbox 의 Paddle 읽기 호출만 한다. 결제 → 웹훅 전체 흐름은 공개 웹훅 주소가 필요해 Task 12 몫이다(확인 안 됨).
import { pathToFileURL } from "node:url"
import { readSecrets, windowsUserEnv } from "../packages/env/src/index.ts"
import { loadWfConformance } from "./lib/wf-conformance.mjs"
import { judge, renderTable } from "./lib/judge.mjs"

/** 어댑터 하나 = 실행기 하나. mod: 그 묶음이 들어 있는 web-factory 모듈 */
export const RUNNERS = [
  { name: "billing-paddle", suite: "billing", load: () => import("../packages/billing-paddle/test/conformance-run.mjs"), run: (m, mod) => m.runPaddleConformance({ mod }) },
  { name: "billing-gumroad", suite: "billing", load: () => import("../packages/billing-gumroad/test/conformance-run.mjs"), run: (m, mod) => m.runGumroadConformance({ mod }) },
  { name: "analytics-posthog", suite: "analytics", load: () => import("../packages/analytics-posthog/test/conformance-run.mjs"), run: (m, mod) => m.runAnalyticsConformance({ mod }) },
  { name: "auth", suite: "auth", load: () => import("../packages/auth/test/conformance-run.mjs"), run: (m, mod) => m.runAuthConformance({ mod }) },
  { name: "consent/notify", suite: "notify", load: () => import("../packages/consent/test/conformance-run.mjs"), run: (m, mod) => m.runNotifyConformance({ mod }) },
]

/** 샌드박스 실호출에 필요한 이름(Paddle — 운영자 할 일 O3) */
export const LIVE_SANDBOX_KEYS = ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "PADDLE_CLIENT_TOKEN"]

/**
 * @returns {Promise<{ commit?: string, rows: object[], suites: Record<string, number>, skipped?: string, live: { requested: boolean, status: "not-requested" | "skipped" | "ran", detail?: string, checks?: object[] }, exit: number }>}
 */
export async function runAll({ only, liveSandbox = false, loaded, runners = RUNNERS, env = process.env, userEnv = windowsUserEnv, doctor } = {}) {
  const live = { requested: liveSandbox, status: "not-requested" }
  const wf = loaded ?? (await loadWfConformance())
  const rows = []
  const suites = {}
  let skipped
  if (wf.skip) {
    skipped = wf.skip
  } else {
    try {
      for (const r of runners) {
        if (only && !r.name.includes(only)) continue
        const m = await r.load()
        const out = await r.run(m, wf[r.suite])
        for (const run of Array.isArray(out) ? out : [out]) {
          const j = judge(run)
          rows.push(j)
          suites[run.suite] = (suites[run.suite] ?? 0) + 1
        }
      }
    } finally {
      wf.cleanup?.()
    }
  }
  if (liveSandbox) {
    const have = readSecrets(LIVE_SANDBOX_KEYS, env, userEnv)
    const gone = LIVE_SANDBOX_KEYS.filter((n) => !have[n])
    if (gone.length) {
      live.status = "skipped"
      live.detail = `--live-sandbox 건너뜀 — 샌드박스 키 없음: ${gone.join(", ")}(운영자 할 일 O3). 녹화 응답 결과만 유효하다`
    } else {
      const { runDoctor } = doctor ?? (await import("./doctor.mjs"))
      const rep = await runDoctor({ stage: "sandbox", only: ["paddle", "paddle-webhook", "paddle-client-token", "paddle-live-guard"], env, userEnv })
      live.status = "ran"
      live.checks = rep.checks
      live.detail = `Paddle 샌드박스 읽기 호출 ${rep.checks.length}개 — 통과 ${rep.counts.pass} · 경고 ${rep.counts.warn} · 실패 ${rep.counts.fail}. 결제→웹훅 전체 흐름은 Task 12(확인 안 됨)`
      if (rep.exit) live.failed = true
    }
  }
  const failed = rows.some((r) => r.status === "FAIL") || live.failed === true
  const notRun = Boolean(skipped) || live.status === "skipped" || (rows.length === 0 && !only)
  return { commit: wf.commit, rows, suites, skipped, live, exit: failed ? 1 : notRun ? 3 : 0 }
}

export function renderReport(report) {
  const out = []
  out.push(`conformance-all — web-factory 적합성 묶음 @ ${report.commit ?? "(불러오지 못함)"}`)
  if (report.skipped) out.push(`돌리지 못함: ${report.skipped}`)
  if (report.rows.length) out.push(renderTable(report.rows))
  for (const r of report.rows) for (const p of r.problems) out.push(`  ! ${r.adapter}: ${p}`)
  const total = report.rows.reduce((a, r) => a + r.total, 0)
  const pass = report.rows.reduce((a, r) => a + r.passed, 0)
  const exp = report.rows.reduce((a, r) => a + r.expectedFail, 0)
  out.push(`어댑터 ${report.rows.length}개 · 검사 ${total}개 · 통과 ${pass} · 예상 실패 ${exp} · 판정 실패 ${report.rows.filter((r) => r.status === "FAIL").length}`)
  out.push(`묶음별 어댑터 수: ${Object.entries(report.suites).map(([k, v]) => `${k} ${v}`).join(" · ") || "없음"}`)
  if (report.live.requested) out.push(`live-sandbox: ${report.live.status} — ${report.live.detail}`)
  out.push(`종료 ${report.exit}(0 판정대로 · 1 실패 · 3 돌리지 못한 것 있음)`)
  return out.join("\n")
}

function parseArgs(argv) {
  const a = { only: undefined, json: false, liveSandbox: false }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === "--only") a.only = argv[++i]
    else if (x === "--json") a.json = true
    else if (x === "--live-sandbox") a.liveSandbox = true
    else return { error: `모르는 인자 ${x}` }
  }
  if (a.only !== undefined && !RUNNERS.some((r) => r.name.includes(a.only))) return { error: `--only ${a.only} 에 맞는 어댑터가 없다(있는 것: ${RUNNERS.map((r) => r.name).join(", ")})` }
  return a
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.error) {
    console.error(`${a.error}\nusage: node scripts/conformance-all.mjs [--only <어댑터>] [--json] [--live-sandbox]`)
    process.exitCode = 2
    return
  }
  const report = await runAll({ only: a.only, liveSandbox: a.liveSandbox })
  console.log(a.json ? JSON.stringify(report, null, 2) : renderReport(report))
  process.exitCode = report.exit
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`conformance-all 자체 오류: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  })
}
