// 적합성 실행 결과를 판정한다. 통과·실패 개수만 보지 않고 「무엇이 몇 개 돌았나」와 「예상 실패가 정확히 그 이유로 실패했나」까지 본다.
// run = { adapter, suite, results: { id, ok, message }[], pins: { total, expectedFailures: { [id]: 이유 } } }

/** @returns {{ adapter: string, suite: string, total: number, passed: number, expectedFail: number, problems: string[], unexpected: { id: string, message: string }[], status: "PASS" | "FAIL" }} */
export function judge(run) {
  const { adapter, suite, results, pins } = run
  const expected = pins.expectedFailures ?? {}
  const problems = []
  if (results.length !== pins.total) problems.push(`검사 수 ${results.length}개 — 기대 ${pins.total}개(0건·모자란 통과는 통과가 아니다)`)
  const byId = new Map(results.map((r) => [r.id, r]))
  if (byId.size !== results.length) problems.push("검사 id 가 겹친다")
  const failed = results.filter((r) => !r.ok)
  const unexpected = failed.filter((r) => !(r.id in expected))
  for (const u of unexpected) problems.push(`목록 밖 실패: ${u.id} — ${u.message}`)
  for (const [id, reason] of Object.entries(expected)) {
    const r = byId.get(id)
    if (!r) problems.push(`돌지 않은 예상 실패: ${id}`)
    else if (r.ok) problems.push(`지원 안 함으로 고정했는데 통과: ${id}`)
    else if (!r.message.includes(reason)) problems.push(`예상 실패 이유가 다르다: ${id} — 기대 ${reason}, 실제 ${r.message}`)
  }
  const expectedFail = failed.length - unexpected.length
  return { adapter, suite, total: results.length, passed: results.length - failed.length, expectedFail, problems, unexpected, status: problems.length ? "FAIL" : "PASS" }
}

/** 한 줄 표. 열 너비는 글자 수 기준(한글 폭은 맞추지 않는다) */
export function renderTable(rows) {
  const head = ["adapter", "suite", "checks", "pass", "expected-fail", "unexpected", "status"]
  const body = rows.map((r) => [r.adapter, r.suite, String(r.total), String(r.passed), String(r.expectedFail), String(r.problems.length), r.status])
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)))
  const line = (cols) => "| " + cols.map((c, i) => c.padEnd(widths[i])).join(" | ") + " |"
  return [line(head), "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|", ...body.map(line)].join("\n")
}
