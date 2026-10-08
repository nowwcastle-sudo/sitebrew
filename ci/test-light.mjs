// 가벼운 단위 시험 + 순수 모듈 커버리지 래칫(P3-8). 사용: npm run ci:test [-- --update-baseline] · 무거운 시험: npm run ci:test:heavy
//   가름은 ci/lib/split.mjs(ci/tests-heavy.txt). 커버리지는 Node 내장(--experimental-test-coverage, Node 24.13.0 에서 플래그 확인됨).
//   기준선 ci/baselines/coverage.json = { lines, branches, functions, include } — 래칫: 0.5%p 넘게 내려가면 실패, 1.0%p 넘게 오르면 기준선을 올리라고 실패.
//   건너뜀 기준선 ci/baselines/skipped-tests.txt — 건너뛴 시험 수가 기준선을 넘으면 실패(줄면 기준선도 줄여야 통과).
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSplit, ROOT } from './lib/split.mjs'

export const COVERAGE_INCLUDE = [
  'factory/lib/**/*.mjs',
  'factory/scripts/lib/**/*.mjs',
  'factory/scripts/contrast.mjs',
  'factory/scripts/archetypes.mjs',
  'factory/scripts/axes.mjs',
  'factory/scripts/compat.mjs',
  'factory/scripts/pincheck.mjs',
  'factory/scripts/block-states.mjs',
  'factory/board/block-board/jobs.mjs',
]
export const COVERAGE_DROP_PP = 0.5
export const COVERAGE_RAISE_PP = 1.0
const OUT = join(ROOT, '.tmp', 'ci')

// lcov 본문 → { lines, branches, functions } 퍼센트(소수 둘째 자리) + 파일 수. 순수.
// 같은 SF 기록이 여럿이면(시험이 import(`x.mjs?${tag}`)로 다시 불러 Node 가 주소마다 따로 낸다) 한 파일로 합친다 —
// 줄(DA 줄 번호)·함수(FN 이름)는 「한 번이라도 지나갔나」로 합집합한다. 분기(BRDA)는 기록마다 V8 블록 번호가 달라
// 맞대어 합칠 수 없어서 분기가 가장 많이 잡힌 기록 하나를 쓴다. 기록이 하나면 요약 줄을 그대로 쓴다.
function mergeRecords(recs) {
  if (recs.length === 1) return recs[0].sum
  const lines = new Map(); const fns = new Map()
  const hit = (map, k, on) => map.set(k, (map.get(k) ?? false) || on)
  for (const r of recs) {
    for (const l of r.body) {
      let m
      if ((m = l.match(/^DA:(\d+),(\d+)/))) hit(lines, m[1], Number(m[2]) > 0)
      else if ((m = l.match(/^FN:\d+,(.+)$/))) hit(fns, m[1], false)
      else if ((m = l.match(/^FNDA:(\d+),(.+)$/))) hit(fns, m[2], Number(m[1]) > 0)
    }
  }
  const most = (k) => recs.reduce((a, r) => (r.sum[k] > a[k] ? r.sum : a), recs[0].sum)
  if (lines.size === 0) return most('LF') // 세부 줄이 없는 lcov — 가장 큰 기록 하나
  const count = (map) => [map.size, [...map.values()].filter(Boolean).length]
  const [LF, LH] = count(lines); const [FNF, FNH] = count(fns)
  const { BRF, BRH } = most('BRF')
  return { LF, LH, BRF, BRH, FNF, FNH }
}

export function lcovTotals(text) {
  const t = { LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 }
  const bySf = new Map()
  let cur = null
  for (const l of text.split('\n')) {
    if (l.startsWith('SF:')) {
      cur = { body: [], sum: { LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 } }
      const sf = l.slice(3).trim()
      bySf.set(sf, [...(bySf.get(sf) ?? []), cur])
      continue
    }
    if (!cur) continue
    const m = l.match(/^(LF|LH|BRF|BRH|FNF|FNH):(\d+)/)
    if (m) cur.sum[m[1]] += Number(m[2])
    else cur.body.push(l)
  }
  for (const recs of bySf.values()) {
    const s = mergeRecords(recs)
    for (const k of Object.keys(t)) t[k] += s[k]
  }
  const files = bySf.size
  const pct = (h, f) => (f ? Math.round((h / f) * 10000) / 100 : 100)
  return { lines: pct(t.LH, t.LF), branches: pct(t.BRH, t.BRF), functions: pct(t.FNH, t.FNF), files }
}

// 래칫 판정. 순수 — { ok, notes[] }.
export function judgeCoverage(cur, base, { drop = COVERAGE_DROP_PP, raise = COVERAGE_RAISE_PP } = {}) {
  const notes = []
  let ok = true
  for (const k of ['lines', 'branches', 'functions']) {
    const d = Math.round((cur[k] - base[k]) * 100) / 100
    if (d < -drop) { ok = false; notes.push(`커버리지 ${k} ${base[k]}% → ${cur[k]}% (${d}%p) — 기준선보다 ${drop}%p 넘게 내려갔다`) }
    else if (d > raise) { ok = false; notes.push(`커버리지 ${k} ${base[k]}% → ${cur[k]}% (+${d}%p) — 기준선을 올린다(ci/baselines/coverage.json, npm run ci:test -- --update-baseline)`) }
    else notes.push(`커버리지 ${k} ${cur[k]}% (기준선 ${base[k]}%, ${d >= 0 ? '+' : ''}${d}%p)`)
  }
  return { ok, notes }
}

export function judgeSkipped(count, base) {
  if (count > base) return { ok: false, note: `건너뛴 시험 ${count}건 > 기준선 ${base}건 — 새로 건너뛰지 않는다` }
  if (count < base) return { ok: false, note: `건너뛴 시험 ${count}건 < 기준선 ${base}건 — ci/baselines/skipped-tests.txt 를 ${count} 로 줄인다` }
  return { ok: true, note: `건너뛴 시험 ${count}건 (기준선 ${base}건)` }
}

async function main(argv) {
  const update = argv.includes('--update-baseline')
  const { files, heavy, light, problems } = loadSplit()
  console.log(`시험 파일 ${files.length}개 = 가벼움 ${light.length} + 무거움 ${heavy.length} (ci/tests-heavy.txt)`)
  if (problems.length) { console.error(problems.map((p) => `✖ ${p}`).join('\n')); return 1 }
  mkdirSync(OUT, { recursive: true })
  const lcovFile = join(OUT, 'lcov.info')
  const concurrency = process.env.CI_TEST_CONCURRENCY ?? '3'
  const args = [
    '--test', `--test-concurrency=${concurrency}`, '--test-force-exit', '--test-timeout=120000',
    '--experimental-test-coverage', ...COVERAGE_INCLUDE.map((g) => `--test-coverage-include=${g}`),
    '--test-reporter=./ci/reporter.mjs', '--test-reporter-destination=stdout',
    '--test-reporter=spec', `--test-reporter-destination=${join(OUT, 'spec.log')}`,
    '--test-reporter=lcov', `--test-reporter-destination=${lcovFile}`,
    ...light,
  ]
  const started = Date.now()
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' })
    p.on('close', (c) => resolve(c ?? 1))
  })
  const secs = Math.round((Date.now() - started) / 1000)
  console.log(`\n가벼운 시험 종료 코드 ${code} · ${secs}초 · 동시 ${concurrency}`)
  if (code !== 0) { console.error(`✖ 시험 실패 — 전체 기록 ${join('.tmp', 'ci', 'spec.log')}`); return 1 }
  // 건수는 Node 가 spec 리포터 끝에 찍는 요약(ℹ tests·skipped)에서 읽는다 — 우리 리포터의 건수는 --test-force-exit 때 이벤트를 흘리는 실행이 있어(CI 에서 1722↔1759) 쓰지 않는다.
  const specText = existsSync(join(OUT, 'spec.log')) ? readFileSync(join(OUT, 'spec.log'), 'utf8') : ''
  const num = (k) => Number(specText.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm'))?.[1] ?? NaN)
  const [tests, skipped] = [num('tests'), num('skipped')]
  if (!Number.isFinite(tests) || !Number.isFinite(skipped)) { console.error('✖ spec 요약(ℹ tests·skipped)을 못 읽었다 — 0건 통과를 성공으로 읽지 않는다'); return 1 }
  if (tests < 100) { console.error(`✖ 시험이 ${tests}건뿐이다 — 가름이 틀렸을 수 있다`); return 1 }
  if (!existsSync(lcovFile)) { console.error('✖ lcov 파일이 없다'); return 1 }
  const cur = lcovTotals(readFileSync(lcovFile, 'utf8'))
  if (cur.files === 0) { console.error('✖ 커버리지 대상 파일이 0개다 — 포함 목록(COVERAGE_INCLUDE)을 확인한다'); return 1 }
  const covFile = join(ROOT, 'ci', 'baselines', 'coverage.json')
  const skipFile = join(ROOT, 'ci', 'baselines', 'skipped-tests.txt')
  if (update) {
    writeFileSync(covFile, JSON.stringify({ lines: cur.lines, branches: cur.branches, functions: cur.functions, files: cur.files }, null, 2) + '\n')
    writeFileSync(skipFile, `${skipped}\n`)
    console.log(`기준선 갱신: 커버리지 ${JSON.stringify(cur)} · 건너뜀 ${skipped}`)
    return 0
  }
  const base = JSON.parse(readFileSync(covFile, 'utf8'))
  const cov = judgeCoverage(cur, base)
  cov.notes.forEach((n) => console.log(n))
  const skip = judgeSkipped(skipped, Number(readFileSync(skipFile, 'utf8').trim()))
  console.log(skip.note)
  if (!cov.ok || !skip.ok) { console.error('✖ 래칫 실패'); return 1 }
  console.log(`가벼운 시험 통과: ${tests}건 · 대상 파일 ${cur.files}개`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)))
