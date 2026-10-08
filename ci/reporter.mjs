// node:test 사용자 리포터(P3-8): 시험 파일별 최상위 시험 시간을 모아 「느린 파일 표」와 실패 요약을 짧게 낸다.
// 전체 줄 단위 기록은 spec 리포터가 파일로 따로 쓴다(ci/test-light.mjs 가 --test-reporter-destination 으로 연결).
// 파일 시간은 최상위(nesting 0) 시험 시간의 합이라 모듈 불러오기 시간은 빠진다 — 느린 파일을 가리는 용도다.
import { relative } from 'node:path'

export default async function* reporter(source) {
  const perFile = new Map()
  const failures = []
  let tests = 0, pass = 0, fail = 0, skipped = 0, todo = 0
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue
    const d = ev.data
    const isLeaf = d.details?.type !== 'suite'
    if (isLeaf) {
      tests++
      if (ev.type === 'test:fail') fail++
      else if (d.skip) skipped++
      else if (d.todo) todo++
      else pass++
    }
    if (d.nesting === 0 && d.file) {
      const key = relative(process.cwd(), d.file).replaceAll('\\', '/')
      const row = perFile.get(key) ?? { ms: 0, failed: 0 }
      row.ms += d.details?.duration_ms ?? 0
      if (ev.type === 'test:fail') row.failed++
      perFile.set(key, row)
    }
    if (ev.type === 'test:fail' && isLeaf) failures.push(`${d.file ? relative(process.cwd(), d.file).replaceAll('\\', '/') : '?'} › ${d.name}`)
  }
  const rows = [...perFile.entries()].sort((a, b) => b[1].ms - a[1].ms)
  yield `\n── 느린 시험 파일 상위 10 (최상위 시험 시간 합, 초) ──\n`
  for (const [f, r] of rows.slice(0, 10)) yield `${(r.ms / 1000).toFixed(1).padStart(7)}  ${f}\n`
  // 동시 실행 아래 시간은 직렬 시간보다 부풀어 있다 — 60초를 넘으면 무거운 시험 후보로만 알린다(가름 기준은 직렬 20초·Chrome).
  const over = rows.filter(([, r]) => r.ms > 60000).map(([f]) => f)
  yield `60초 넘는 파일: ${over.length}${over.length ? ` → ${over.join(', ')} (ci/tests-heavy.txt 로 옮길 후보)` : ''}\n`
  if (failures.length) yield `\n── 실패한 시험 ${failures.length}건 ──\n${failures.slice(0, 50).map((f) => `  ✖ ${f}`).join('\n')}\n`
  yield `\nTESTS tests=${tests} pass=${pass} fail=${fail} skipped=${skipped} todo=${todo} files=${perFile.size}\n`
}
