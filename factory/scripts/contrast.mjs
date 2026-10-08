// 테마 CSS의 OKLCH 값 → sRGB → WCAG 대비. 사용: node factory/scripts/contrast.mjs [테마.css] [--pair <앞> <뒤> [--min 3]]
// --pair: 변수 두 개(-- 없이, 예: foreground background)만 라이트·다크로 재고 기준(기본 3:1 — 선 구획 선·UI 경계) 미달이면 종료 코드 1.
// 필수: 글자·보조글자 7:1, 포커스 링 3:1 (× 라이트·다크). 하나라도 미달이면 종료 코드 1.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ratio } from './lib/contrast-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const pi = argv.indexOf('--pair'), mi = argv.indexOf('--min')
const pair = pi === -1 ? null : [argv[pi + 1], argv[pi + 2]].map((v) => (v?.startsWith('--') ? v : `--${v}`))
const pairMin = mi === -1 ? 3 : Number(argv[mi + 1])
// --pair·--min 이 없으면 그 자리를 표시하지 않는다(-1 + 1 = 0 이 파일 인자 자리를 「사용됨」으로 지우던 결함, Task 5 리뷰 열린 문제 3).
const used = new Set([...(pi >= 0 ? [pi, pi + 1, pi + 2] : []), ...(mi >= 0 ? [mi, mi + 1] : [])])
const file = argv.find((a, i) => !used.has(i)) ?? join(root, 'registry', 'factory', 'themes', 'factory-default.css')
const css = readFileSync(file, 'utf8')

function block(selector) {
  const m = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
  if (!m) throw new Error(`${selector} 블록 없음: ${file}`)
  return Object.fromEntries([...m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]))
}

if (pair) {
  let bad = 0
  for (const [mode, sel] of [['light', ':root'], ['dark', '.dark']]) {
    const vars = block(sel)
    if (!vars[pair[0]] || !vars[pair[1]]) { console.error(`${mode}: 변수 없음 ${pair.join(' ')}`); process.exit(2) }
    const r = ratio(vars[pair[0]], vars[pair[1]])
    if (r < pairMin) bad++
    console.log(`${mode.padEnd(5)} ${pair[0]} / ${pair[1]}`.padEnd(46), r.toFixed(2).padStart(6), `>= ${pairMin}`, r >= pairMin ? 'PASS' : 'FAIL')
  }
  process.exit(bad ? 1 : 0)
}

const PAIRS = [
  ['--foreground', '--background', 7, true],
  ['--muted-foreground', '--background', 7, true],
  ['--primary-foreground', '--primary', 4.5, false],
  ['--muted-foreground', '--muted', 4.5, false],
  ['--input', '--background', 3, true], // 입력·외곽선 버튼 테두리(유일한 식별 수단) — DESIGN §6 3:1
  ['--ring', '--background', 3, true], // 포커스 링(불투명 ring-ring) — DESIGN §7 포커스 3:1
  // 상태 토큰(T7r1-c3): 상태 위 글자 4.5:1, 상태 면/점이 배경에서 보이게 3:1 — 레시피 검사(T7-M13)와 같은 기준
  ...['success', 'warning', 'info'].flatMap((s) => [[`--${s}-foreground`, `--${s}`, 4.5, true], [`--${s}`, '--background', 3, true]]),
]
let failed = 0
for (const [mode, sel] of [['light', ':root'], ['dark', '.dark']]) {
  const vars = block(sel)
  for (const [fg, bg, min, required] of PAIRS) {
    const r = ratio(vars[fg], vars[bg])
    const ok = r >= min
    if (!ok && required) failed++
    console.log(`${mode.padEnd(5)} ${fg} / ${bg}`.padEnd(46), r.toFixed(2).padStart(6), `>= ${min}`, ok ? 'PASS' : required ? 'FAIL' : 'warn', required ? '(필수)' : '(참고)')
  }
}
const requiredCount = PAIRS.filter((p) => p[3]).length * 2
console.log(failed ? `필수 ${failed}쌍 미달` : `필수 ${requiredCount}쌍 모두 통과`)
process.exit(failed ? 1 : 0)
