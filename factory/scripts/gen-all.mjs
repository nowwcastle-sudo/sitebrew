// 모든 생성기를 정해진 순서로 돌린다. 사용: npm run gen:all [-- --ref vX.Y.Z]
// 순서(컨트롤러 판정 T5-c4): gen:radius → gen:styles → gen-fonts(폰트 키트 — 레시피가 항목 이름을 읽는다, Task 8) → gen-kits(모션·아이콘 키트, Task 9) → 레시피(recipe.mjs) → build-presets(스타일 프리셋·레시피 분해 재료, P3-2 Task 16a) → gen-content-slots(원형 JSON → 스키마 칸 정의, Task 11) → gen-blocks(블록 컴파일본·blocks/registry.json, P3-2) → gen-registry → gen-ai(factory/scripts/gen-ai.mjs 가 있을 때, Task 13).
// --ref 를 안 주면 package.json version 으로 고정한다(v<version>) — 지금 커밋된 고정값이 그것이다.
// --check(= npm run check:regen): 다 돌린 뒤 생성물이 커밋과 같은지 본다 — git diff --exit-code 0, 그리고 생성물 경로에 추적 안 된 새 파일 0.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRef } from './lib/registry-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// [이름, 명령, 인자][] — 순서가 곧 계약이다(gen-registry.test.mjs 가 본다). 인자는 명시한다(npm 스크립트 문자열을 쪼개지 않는다).
export function steps(ref, { hasAi = existsSync(join(root, 'factory', 'scripts', 'gen-ai.mjs')) } = {}) {
  const node = (script, ...args) => [process.execPath, [join(root, 'factory', 'scripts', script), ...args]]
  return [
    ['gen:radius', ...node('gen-radius-axis.mjs')],
    ['gen:styles', ...node('compile-styles.mjs', '--src', 'registry/factory/ui-src', '--out', 'registry/factory/ui', '--css', 'registry/factory/styles/base.css')],
    ['gen-fonts', ...node('gen-fonts.mjs')],
    ['gen-kits', ...node('gen-kits.mjs', '--ref', ref)],
    ['recipes', ...node('recipe.mjs', '--ref', ref)],
    // Task 16a: 스타일 프리셋·레시피 분해 재료(references/styles/presets.json · palettes/recipe-derived.json · fonts/pairs.json) — 레시피 머리를 읽는다.
    ['build-presets', ...node('build-presets.mjs')],
    ['gen-content-slots', ...node('gen-content-slots.mjs')],
    ['gen-blocks', ...node('gen-blocks.mjs', '--ref', ref)],
    ['gen-registry', ...node('gen-registry.mjs', '--ref', ref)],
    ...(hasAi ? [['gen-ai', ...node('gen-ai.mjs', '--ref', ref)]] : []),
  ]
}

// 재생성 검사에 쓰는 git 명령(인자 배열). 둘째는 생성물이 사는 경로의 추적 안 된 새 파일(git diff 는 못 본다).
export const regenCheckCommands = () => [
  ['diff', '--exit-code', '--stat'],
  ['ls-files', '--others', '--exclude-standard', '--', 'registry', 'ai'],
]

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const ref = parseRef(argv) ?? `v${pkg.version}`
  const all = steps(ref)
  for (const [name, cmd, args] of all) {
    console.log(`gen:all ▶ ${name}`)
    const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' })
    if (r.status !== 0) { console.error(`gen:all: ${name} 실패(종료 코드 ${r.status ?? r.signal})`); process.exit(r.status || 1) }
  }
  console.log(`gen:all: ${all.length}단계 완료 (ref ${ref})`)
  // 레시피 사이 차이 검사(원천 검사라 steps 계약 밖에서 돈다) — 문제가 있으면 gen:all·check:regen 모두 종료 1.
  // 늦게 불러온다: recipe.mjs·zod·서체 목록이 깨져도 gen-all 은 뜨고, 그 경우 recipes 단계가 이름을 붙여 먼저 실패한다(M4).
  const { reportDistinct } = await import('./recipes-distinct.mjs')
  if (reportDistinct()) { console.error('gen:all: 레시피 사이 차이 검사 실패'); process.exit(1) }
  // 레시피 다양성 분포(DESIGN §5-B div-01·§8-6 div-06) — 10벌 미만은 경고만, 10벌 이상에서 위반이면 gen:all·check:regen 모두 종료 1.
  const { reportDiversity } = await import('./recipes-diversity.mjs')
  if (reportDiversity()) { console.error('gen:all: 레시피 다양성 분포 검사 실패'); process.exit(1) }
  if (argv.includes('--check')) {
    const [diff, untracked] = regenCheckCommands().map((a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }))
    if (diff.status !== 0) { console.error(`check:regen: 생성물이 커밋과 다르다(git diff 종료 코드 ${diff.status})\n${diff.stdout}${diff.stderr}`); process.exit(1) }
    if (untracked.status !== 0 || untracked.stdout.trim()) { console.error(`check:regen: 추적 안 된 생성물\n${untracked.stdout}${untracked.stderr}`); process.exit(1) }
    console.log('check:regen: 생성물이 커밋과 같다(diff 0, 새 파일 0)')
  }
}
