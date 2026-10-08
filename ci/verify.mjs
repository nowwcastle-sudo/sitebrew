// npm run ci:verify — CI 와 컨트롤러가 병합 전에 같은 명령으로 돌리는 검증 한 줄(P3-8).
// 순서: check:regen → registry:pincheck(현재 버전) → readme:check(README 5개 언어 = 현재 버전) → lint(경고 래칫) → lint:ui → blocks:check --all-kinds → registry:check → registry:closure → typecheck → 가벼운 시험(+커버리지 래칫) → security:osv(OSV-Scanner — 새 취약점 공지를 push 전에 잡는다. 도구가 없으면 SKIP 이유를 찍고 0이며 통과로 세지 않는다: `npm run ci:tools` 로 고정판을 .tmp 에 받는다).
// 첫 실패에서 멈춘다(--keep-going 이면 끝까지 돌려 실패를 모은다). 단계마다 시간·종료 코드를 표로 남기고 $GITHUB_STEP_SUMMARY 가 있으면 거기에도 쓴다.
// 이식성: 드라이브 문자 경로·Windows 전용 명령·저장소 밖 시각 기준을 쓰지 않는다 — 시각 회귀(blocks:visual)는 로컬·릴리스 관문이고 여기에 없다.
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT } from './lib/split.mjs'
import { resolveTool } from './tools.mjs'

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
export const WARNINGS_BASELINE_FILE = join(ROOT, 'ci', 'baselines', 'eslint-warnings.txt')
export const ESLINT_JSON = join(ROOT, '.tmp', 'ci', 'eslint.json')

// npm 스크립트 실행 — `npm run ci:verify` 안에서는 npm_execpath(npm-cli.js)를 node 로 부르고, 밖에서는 npm 을 찾는다(Windows 는 shell).
function npm(args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv }
  if (process.env.npm_execpath?.endsWith('.js')) return spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: ROOT, stdio: 'inherit', env })
  return spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit', env, shell: process.platform === 'win32' })
}

// ESLint 결과 JSON → { errors, warnings }. 순수.
export function eslintCounts(results) {
  return results.reduce((a, r) => ({ errors: a.errors + r.errorCount + r.fatalErrorCount, warnings: a.warnings + r.warningCount }), { errors: 0, warnings: 0 })
}
// 경고 래칫: 오류 0·경고 ≤ 기준선, 기준선보다 줄었으면 기준선도 줄여야 통과. 순수.
export function judgeWarnings({ errors, warnings }, baseline) {
  if (errors > 0) return { ok: false, note: `ESLint 오류 ${errors}건` }
  if (warnings > baseline) return { ok: false, note: `ESLint 경고 ${warnings}건 > 기준선 ${baseline}건 — 새 경고를 만들지 않는다` }
  if (warnings < baseline) return { ok: false, note: `ESLint 경고 ${warnings}건 < 기준선 ${baseline}건 — ci/baselines/eslint-warnings.txt 를 ${warnings} 로 줄인다(래칫)` }
  return { ok: true, note: `ESLint 경고 ${warnings}건 = 기준선 ${baseline}건` }
}

function lintStep() {
  const baseline = Number(readFileSync(WARNINGS_BASELINE_FILE, 'utf8').trim())
  if (!Number.isInteger(baseline) || baseline < 0) { console.error('✖ ci/baselines/eslint-warnings.txt 가 정수가 아니다'); return 1 }
  mkdirSync(join(ROOT, '.tmp', 'ci'), { recursive: true })
  const r = npm(['run', 'lint', '--', '--max-warnings', String(baseline), '--format', 'json', '--output-file', ESLINT_JSON])
  let counts
  try { counts = eslintCounts(JSON.parse(readFileSync(ESLINT_JSON, 'utf8'))) } catch (e) { console.error(`✖ ESLint 결과 JSON 을 못 읽었다: ${e.message}`); return r.status || 1 }
  const j = judgeWarnings(counts, baseline)
  console.log(j.note)
  if (!j.ok) return 1
  return r.status ?? 1
}

// OSV-Scanner 한 단계. 도구(ci/tools.json 고정판 또는 PATH)가 없으면 SKIP 이유를 찍고 0 — main 푸시의 security.yml 이 같은 검사를 돈다.
// 주입 인자는 시험용(실행 파일 찾기·실행·출력).
export function osvStep({ resolve = resolveTool, run = (bin, args) => spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1, log = console.log } = {}) {
  const tool = resolve('osv-scanner')
  if (!tool) {
    log('SKIP(도구 없음): osv-scanner 실행 파일이 없다 — `npm run ci:tools` 로 고정판을 .tmp 에 받는다. 통과가 아니다 (main 푸시의 security.yml 이 같은 검사를 돈다).')
    return 0
  }
  log(`osv-scanner: ${tool.path} (${tool.source === 'pinned' ? '받아 둔 고정판, sha256 확인됨' : 'PATH 의 설치본'})`)
  return run(tool.path, ['scan', 'source', '--lockfile', 'package-lock.json', '--config', 'osv-scanner.toml'])
}

export const STEPS = [
  ['check:regen', () => npm(['run', 'check:regen']).status],
  ['registry:pincheck', () => npm(['run', 'registry:pincheck', '--', `v${pkg.version}`]).status],
  ['readme:check', () => npm(['run', 'readme:check']).status],
  ['lint', lintStep],
  ['lint:ui', () => npm(['run', 'lint:ui']).status],
  ['blocks:check', () => npm(['run', 'blocks:check', '--', '--all-kinds']).status],
  ['registry:check', () => npm(['run', 'registry:check']).status],
  ['registry:closure', () => npm(['run', 'registry:closure']).status],
  ['typecheck', () => npm(['run', 'typecheck'], { NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=4096' }).status],
  ['test:light', () => npm(['run', 'ci:test']).status],
  ['security:osv', () => osvStep()],
]

function main(argv) {
  const keepGoing = argv.includes('--keep-going')
  const only = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
  const rows = []
  for (const [name, run] of STEPS) {
    if (only && !only.includes(name)) continue
    console.log(`\n══════ ci:verify ▶ ${name} ══════`)
    const t0 = Date.now()
    const code = run() ?? 1
    const secs = Math.round((Date.now() - t0) / 1000)
    rows.push({ name, code, secs })
    console.log(`── ${name}: 종료 코드 ${code} · ${secs}초`)
    if (code !== 0 && !keepGoing) break
  }
  const failed = rows.filter((r) => r.code !== 0)
  const total = rows.reduce((a, r) => a + r.secs, 0)
  const table = ['| 단계 | 종료 코드 | 초 |', '|---|---|---|', ...rows.map((r) => `| ${r.name} | ${r.code} | ${r.secs} |`), `| 합계 | ${failed.length ? 1 : 0} | ${total} |`].join('\n')
  console.log(`\n${table}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ci:verify\n\n${table}\n`)
  mkdirSync(join(ROOT, '.tmp', 'ci'), { recursive: true })
  writeFileSync(join(ROOT, '.tmp', 'ci', 'verify-summary.json'), JSON.stringify({ rows, total }, null, 2) + '\n')
  const skipped = only ? '' : STEPS.length - rows.length ? ` (${STEPS.length - rows.length}단계는 앞 실패로 돌지 않았다)` : ''
  if (failed.length) { console.error(`ci:verify 실패: ${failed.map((r) => r.name).join(', ')}${skipped}`); return 1 }
  console.log(`ci:verify 통과: ${rows.length}단계 · ${total}초`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
