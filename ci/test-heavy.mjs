// 무거운 시험(Chrome·20초 초과) — 로컬 야간용. 사용: npm run ci:test:heavy (서버·Chrome 은 시험이 스스로 띄운다). CI 는 돌리지 않는다.
// Chrome 시험은 겹치면 메모리를 먹으므로 동시 실행 1(CI_TEST_CONCURRENCY 로 바꾼다). 가름 목록은 ci/tests-heavy.txt.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadSplit, ROOT } from './lib/split.mjs'

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { heavy, problems } = loadSplit()
  if (problems.length) { console.error(problems.map((p) => `✖ ${p}`).join('\n')); process.exit(1) }
  console.log(`무거운 시험 ${heavy.length}개 파일`)
  const r = spawnSync(process.execPath, ['--test', `--test-concurrency=${process.env.CI_TEST_CONCURRENCY ?? '1'}`, '--test-force-exit', '--test-timeout=600000', ...heavy], { cwd: ROOT, stdio: 'inherit' })
  process.exit(r.status ?? 1)
}
