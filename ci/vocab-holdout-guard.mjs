// holdout 격리 검사 — 어휘집 쪽 파일(design-lexicon.yaml · grammar.yaml)과 평가 holdout(holdout.jsonl)이 한 커밋에서 함께 바뀌면 실패한다.
// 어휘집을 holdout 에 맞춰 고치면 정확도가 부풀기 때문이다. 순수 guard()·guardCommits() 를 시험하고, CLI 가 git 으로 커밋별 바뀐 파일을 모은다.
// 범위가 아니라 커밋 단위인 까닭: 한 가지에서 holdout 을 들인 뒤에도 dev 로 어휘집을 고쳐 다시 재야 한다(계획 1 작업 8 4단계).
// 기준: origin/main 이 풀리고 `origin/main..HEAD` 에 커밋이 있으면 그 범위, 아니면(풀리지 않거나 main 에서 직접 작업해 범위가 비면) `HEAD~1..HEAD` 의 커밋들. 볼 커밋이 없으면(얕은 복제 따위) 안내를 찍고 건너뛴다 — 통과가 아니다.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// 어휘집 쪽 파일: 해석 결과를 정하는 데이터 전부. 낱말 사전과 말본 데이터(조사·어미·군말·부정)가 모두 holdout 에 맞춰 고쳐질 수 있다.
export const LEXICON_SIDE = Object.freeze(['factory/vocab/design-lexicon.yaml', 'factory/vocab/grammar.yaml'])
export const HOLDOUT = 'factory/vocab/eval/holdout.jsonl'

// 순수: 바뀐 파일 목록 → { ok, reason? }
export function guard(changedFiles) {
  const set = new Set(changedFiles.map((f) => f.replaceAll('\\', '/')))
  const touched = LEXICON_SIDE.filter((f) => set.has(f))
  if (touched.length && set.has(HOLDOUT)) return { ok: false, reason: `${touched.join(', ')} 와 ${HOLDOUT} 가 한 커밋에서 함께 바뀌었다 — 어휘집과 holdout 은 따로 커밋·검토한다` }
  return { ok: true }
}

// 순수: [{ sha, files }] → 처음 걸린 커밋의 { ok:false, reason } 또는 { ok:true }
export function guardCommits(commits) {
  for (const c of commits) {
    const r = guard(c.files)
    if (!r.ok) return { ok: false, reason: `${c.sha}: ${r.reason}` }
  }
  return { ok: true }
}

const gitRun = (args) => spawnSync('git', args, { encoding: 'utf8' })
const BASES = Object.freeze(['origin/main', 'HEAD~1']) // 앞에서부터 풀리고 범위가 비지 않은 첫 기준을 쓴다

// opts: git 실행기·출력을 바꿔 끼울 수 있다(시험용). 종료 코드를 돌려준다.
export function main({ log = console.log, err = console.error, git = gitRun } = {}) {
  const bases = BASES.filter((ref) => git(['rev-parse', '--verify', '-q', `${ref}^{commit}`]).status === 0)
  if (!bases.length) { log('vocab-holdout-guard: SKIP — origin/main 도 HEAD~1 도 없다(얕은 복제). 통과가 아니라 건너뜀이다.'); return 0 }
  // main 에서 직접 작업하면 origin/main..HEAD 가 비어 아무 커밋도 보지 못하고 통과한다 — 범위가 빈 기준은 건너뛰고 다음 기준(HEAD~1)으로 본다.
  let base
  let shas = []
  for (const ref of bases) {
    const l = git(['rev-list', `${ref}..HEAD`])
    if (l.status !== 0) { err(`✖ git rev-list 실패: ${l.stderr.trim()}`); return 1 }
    shas = l.stdout.split('\n').filter(Boolean)
    if (shas.length) { base = ref; break }
  }
  if (!base) { log(`vocab-holdout-guard: SKIP — 기준(${bases.join(', ')})마다 HEAD 까지 범위가 비어 볼 커밋이 없다. 통과가 아니라 건너뜀이다.`); return 0 }
  const commits = []
  for (const sha of shas) {
    const d = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha])
    if (d.status !== 0) { err(`✖ git diff-tree 실패(${sha}): ${d.stderr.trim()}`); return 1 }
    commits.push({ sha, files: d.stdout.split('\n').filter(Boolean) })
  }
  const r = guardCommits(commits)
  if (!r.ok) { err(`✖ ${r.reason}`); return 1 }
  log(`vocab-holdout-guard: 통과 — 기준 ${base}, 커밋 ${commits.length}개`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main())
