// v0.2.6 T0c — 「다른 세계」 규칙이 실행 가능한지 Phase B 전에 재 보는 읽기 전용 점검(06 코드 열쇠 밖: 아무 닫힘 파일도 이 모듈을 import 하지 않는다).
// 규칙 후보(계획 T21 · P2 F3): 한 원형의 세 후보 a(라이브러리)·b·c(프리셋)가 모든 쌍에서 visualDistance ≥ 2 이고, 계열(materialFamily)은 소프트 선호다.
// 분류표·거리 칸은 docs/superpowers/specs/2026-11-04-v026-p1-interfaces.md 4.6절의 임시 사본이다 — T21 이 같은 표를 material-family.mjs·visual-distance.mjs 로 옮기면 이 모듈은 그것을 불러 쓴다.
// 히어로 칸(7번째)은 프리셋에 없어(06 이 정한다) 거리에서 뺀다 → 아래 수치는 모두 「실행 가능성의 아래쪽 어림」이다(히어로가 다르면 거리가 더 늘 뿐이다).
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPresets } from '../style-presets.mjs'
import { ARCHETYPE_IDS } from '../../stamp/brief.mjs'

export const DISTANCE_AXES = ['surface', 'header', 'shadow', 'display', 'texture']
export const MIN_DISTANCE = 2
const DEFAULTS = { display: 'D1', texture: 'X0' }

/** 프리셋(또는 라이브러리 프리셋)을 머리 비슷한 모양으로 편다. */
export const headOf = (p) => ({ id: p.id, axes: p.axes ?? {}, motion: p.recipeHints?.motion, defaultTheme: p.recipeHints?.defaultTheme ?? 'light', colorLogic: (p.recipeHints?.colorLogic ?? [])[0], hero: p.recipe?.hero ?? null, library: p.source?.startsWith('recipe:') ?? false })

/** P1 4.6절 분류표 — 앞에서부터 첫 일치. */
export function materialFamily(h) {
  const a = h.axes
  if (a.surface === 'C5' || ['X7', 'X8'].includes(a.texture)) return 'glass'
  if (a.texture === 'X3' || a.surface === 'C8') return 'collage'
  if (a.texture === 'X2' || a.surface === 'C6') return 'print'
  if (['X1', 'X4', 'X5', 'X6'].includes(a.texture) || a.shadow === 'S3') return 'paper'
  if (a.display === 'D3' || h.motion === 'M3') return 'kinetic'
  if (a.header === 'H5' || a.display === 'D2') return 'editorial'
  if (h.defaultTheme === 'dark' && a.radius === 'R0' && ['T4', 'T1'].includes(a.table)) return 'terminal'
  return 'plain'
}

const axisOf = (h, k) => h.axes[k] ?? DEFAULTS[k] ?? ''
/** 서로 다른 칸 수 — 거리 칸 5개 + 기본 테마(히어로는 뺀다). */
export const distance = (a, b) => DISTANCE_AXES.filter((k) => axisOf(a, k) !== axisOf(b, k)).length + (a.defaultTheme !== b.defaultTheme ? 1 : 0)

/** 원형 하나의 풀과 실행 가능성. */
export function reportFor(archetype) {
  const all = listPresets({ archetype }).map(headOf)
  const lib = all.filter((h) => h.library)
  const gen = all.filter((h) => !h.library)
  const fam = (xs) => xs.reduce((m, h) => { const f = materialFamily(h); m[f] = (m[f] ?? 0) + 1; return m }, {})
  const pairsOk = (xs) => { let ok = 0, n = 0; for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) { n++; if (distance(xs[i], xs[j]) >= MIN_DISTANCE) ok++ } return { ok, n } }
  // 세 후보: a = 라이브러리 하나, b·c = 생성 프리셋 둘. 모든 쌍 거리 ≥ 2 인 조합 수, 계열까지 모두 다른 조합 수.
  let triples = 0, distOk = 0, famOk = 0
  for (const a of lib) for (let i = 0; i < gen.length; i++) for (let j = i + 1; j < gen.length; j++) {
    const b = gen[i], c = gen[j]
    triples++
    if (distance(a, b) >= MIN_DISTANCE && distance(a, c) >= MIN_DISTANCE && distance(b, c) >= MIN_DISTANCE) {
      distOk++
      if (new Set([a, b, c].map(materialFamily)).size === 3) famOk++
    }
  }
  const libWithDistOk = lib.filter((a) => gen.some((b, i) => gen.slice(i + 1).some((c) => distance(a, b) >= 2 && distance(a, c) >= 2 && distance(b, c) >= 2))).map((h) => h.id)
  return { archetype, pool: all.length, libraryPool: lib.length, generatedPool: gen.length, familyAll: fam(all), familyLibrary: fam(lib), familyGenerated: fam(gen), generatedPairs: pairsOk(gen), triples, distOk, famOk, libWithDistOk }
}

export const reportAll = () => ARCHETYPE_IDS.map(reportFor)

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—')
const famText = (m) => Object.entries(m).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'

/** 마크다운 표(결정적 — 입력이 같으면 같은 글). */
export function renderMarkdown(rows) {
  const out = []
  out.push('# v0.2.6 T0c — 계열·거리 실행 가능성 표', '')
  out.push('기준: 25f3fdf(v0.2.5) 프리셋 풀. 읽기 전용 점검(`factory/scripts/lib/world-spread-report.mjs`)이 만든 스냅샷이다. 풀이 바뀌면 `node factory/scripts/lib/world-spread-report.mjs --write` 로 다시 만든다.')
  out.push('거리 칸: surface·header·shadow·display·texture + 기본 테마(히어로는 프리셋에 없어 뺌 → 아래쪽 어림). 최소 거리 2. 계열표는 P1 문서 4.6절의 임시 사본이다.', '')
  out.push('## 원형별 풀', '', '| 원형 | 라이브러리 | 생성 | 계열(전체) |', '|---|---|---|---|')
  for (const r of rows) out.push(`| ${r.archetype} | ${r.libraryPool} | ${r.generatedPool} | ${famText(r.familyAll)} |`)
  out.push('', '## 세 후보가 모든 쌍에서 거리 ≥ 2 인 조합', '', '조합 = 라이브러리 a 하나 × 생성 b·c 둘. 「계열 모두 다름」은 그 가운데 세 계열이 서로 다른 것(소프트 선호 — 하드 규칙 아님).', '')
  out.push('| 원형 | 조합 수 | 거리 ≥ 2 | 비율 | 계열 모두 다름 | 비율 | 생성끼리 쌍(거리 ≥ 2) | a 로 쓸 수 있는 라이브러리 |', '|---|---|---|---|---|---|---|---|')
  for (const r of rows) out.push(`| ${r.archetype} | ${r.triples} | ${r.distOk} | ${pct(r.distOk, r.triples)} | ${r.famOk} | ${pct(r.famOk, r.triples)} | ${r.generatedPairs.ok}/${r.generatedPairs.n} (${pct(r.generatedPairs.ok, r.generatedPairs.n)}) | ${r.libWithDistOk.length}/${r.libraryPool} |`)
  const hard = rows.filter((r) => r.distOk === 0)
  const famRare = rows.filter((r) => r.triples && r.famOk / r.triples < 0.05)
  out.push(`- 하드 규칙(거리 ≥ 2)이 풀 수준에서 불가능한 원형: ${hard.length ? hard.map((r) => r.archetype).join(', ') : '없음'}. 조합 비율은 ${rows.map((r) => `${r.archetype} ${pct(r.distOk, r.triples)}`).join(' · ')}.`)
  out.push(`- 「계열 모두 다름」이 조합의 5% 미만인 원형: ${famRare.length ? famRare.map((r) => `${r.archetype} ${pct(r.famOk, r.triples)}`).join(', ') : '없음'}. 불가능은 아니지만 하드 규칙으로 두면 후보 선택이 이 소수 조합에 몰린다 → 계열은 소프트로 둔다(P2 F3).`)
  out.push('- 풀 수준 가능은 실제 01 이 성공한다는 뜻이 아니다. 팔레트·린트·다양성 검사와 씨앗이 더 거른다. 골든 20개의 01 전수 비교는 T22 ①이 한다.')
  return out.join('\n') + '\n'
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const md = renderMarkdown(reportAll())
  if (process.argv.includes('--write')) {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'qa', 'v026-world-spread.md')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, md)
    process.stdout.write(`wrote ${file}\n`)
  } else process.stdout.write(md)
}
