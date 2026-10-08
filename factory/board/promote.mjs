// 승격(promote) — 결선에서 고른 생성·브랜드 후보를 라이브러리 레시피 초안으로(P3-3 Task 12, J8 · 학습 순환의 절반).
//   node factory/board/promote.mjs <run> <cand> [--id r11-이름] [--date YYYY-MM-DD]      (run = 실행 폴더 경로, 또는 out/ 아래 이름)
//   → registry/factory/recipes/<새 id>/DESIGN.md 하나만 쓴다. 머리 + 본문 + 「## 승격 기록」(출처 프리셋·팔레트·서체·결선 날짜) + 「## 운영자 확인 전」 표시.
// 규칙(대장 C83):
//   · 후보 DESIGN.md(compileCandidate 가 쓴 것)의 「## 생성 — 승격 전」 절을 뺀다. id 는 x-<run>-<cand> → 라이브러리 id(r<다음 번호>-<이름>)로 바꾼다.
//   · `head.brand`(로고 — 고객 한 곳의 자산)는 RecipeHead 스키마에 없고 라이브러리 레시피는 고객 것이 아니다 → 승격 머리에서 뺀다. 승격 기록에 「로고는 싣지 않았다」를 적는다.
//   · 쓰기 전에 lint(lintRecipeReport)를 통과해야 하고, 생성 후보는 지금의 라이브러리 전부와 축 차이 2 이상이어야 한다(그 사이 라이브러리가 늘 수 있다).
//   · 같은 후보를 두 번 승격하지 않는다(승격 기록의 「승격 원본」 줄로 알아본다).
//   · 「## 운영자 확인 전」 절이 있는 동안 gen:all 이 이 레시피를 넣지 않는다(recipe.mjs recipeIds·gen-ai loadRecipes). 운영자가 그 절을 지우면 다음 gen:all 이 넣는다.
//   · 후보 실행 폴더의 build/ 는 지우지 않는다(대장 C84 — 결선 기록 record.mjs 의 --prune 이 탈락 후보의 것만 지운다).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRecipe, lintRecipeReport, knownRegistryItems, RECIPES_DIR, UNCONFIRMED_HEADING } from '../scripts/recipe.mjs'
import { loadLibrary } from '../scripts/style-presets.mjs'
import { axisDistance, MIN_AXES } from '../stamp/directions.mjs'
import { serializeRecipe, GENERATED_MARK, tmpRecipeId } from '../stamp/compile-candidate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PAIRS_FILE = join(ROOT, 'factory', 'board', 'pairs.jsonl')
export const ORIGIN_LINE = '- 승격 원본: '
/** 승격 원본 표기: <실행 폴더 이름>/<후보>. */
export const originOf = (runDir, cand) => `${basename(runDir)}/${cand}`

export class PromoteError extends Error {
  constructor(message, reasons = []) { super(message); this.name = 'PromoteError'; this.reasons = reasons }
}

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'))

/** 후보 머리(source·recipe·preset·palette·fonts…): candidate.json 이 우선. 찍어내기 실행(골든)은 candidate.json 에 blockers 만 두고 머리를 01-direction.json data 에 두므로, 거기서 채운다. 둘 다 없으면 null. */
export function readCandidateHead(candDir) {
  const cj = join(candDir, 'candidate.json'), dj = join(candDir, '01-direction.json')
  const c = existsSync(cj) ? readJson(cj) : null
  if (c?.source || !existsSync(dj)) return c
  return { ...(readJson(dj).data ?? {}), ...(c ?? {}) }
}

/** run 인자 → 실행 폴더. 있는 경로면 그대로, 아니면 out/<run>. */
export function resolveRun(run) {
  for (const p of [resolve(run), join(ROOT, 'out', run)]) if (existsSync(p)) return p
  throw new PromoteError(`실행 폴더를 못 찾았다: ${run} (경로 또는 out/<이름>)`)
}

/** 본문에서 절 하나(제목 줄부터 다음 「## 」 제목 전까지)를 뺀다. */
export function dropSection(body, heading) {
  const lines = String(body).split(/\r?\n/)
  const out = []
  let skipping = false
  for (const line of lines) {
    if (/^##[ \t]/.test(line)) skipping = line.trim() === heading
    if (!skipping) out.push(line)
  }
  return out.join('\n').replace(/\s+$/, '')
}

/** 다음 라이브러리 id: r<가장 큰 번호 + 1>-<이름>. 운영자 확인 전 초안의 번호도 센다(번호가 겹치지 않게). */
export function nextRecipeId(recipesDir, name) {
  const nums = existsSync(recipesDir) ? readdirSync(recipesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => Number(d.name.match(/^r(\d+)-/)?.[1])).filter(Number.isFinite) : []
  const n = Math.max(0, ...nums) + 1
  return `r${n}-${slug(name) || 'candidate'}`
}

/** 이미 승격한 후보인가: recipes 아래 DESIGN.md 의 「승격 원본」 줄. → 그 레시피 id 또는 null. */
export function promotedAs(recipesDir, origin) {
  if (!existsSync(recipesDir)) return null
  for (const d of readdirSync(recipesDir, { withFileTypes: true })) {
    const f = join(recipesDir, d.name, 'DESIGN.md')
    if (d.isDirectory() && existsSync(f) && readFileSync(f, 'utf8').split(/\r?\n/).some((l) => l === `${ORIGIN_LINE}${origin}`)) return d.name
  }
  return null
}

/** 결선 기록(pairs.jsonl)에서 이 후보의 승격 줄 — 날짜·원형·브리프를 승격 기록에 옮긴다. */
function pairInfo(pairsFile, tmpId) {
  if (!existsSync(pairsFile)) return null
  const rows = readFileSync(pairsFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
  return rows.filter((r) => (r.promote === 'a' && r.a === tmpId) || (r.promote === 'b' && r.b === tmpId)).at(-1) ?? null
}

/**
 * dryRun: 관문(lint·축 차이·중복)만 돌리고 아무것도 쓰지 않는다 — 여러 후보를 올릴 때 먼저 전부 검사하는 데 쓴다.
 * @param {string} run  실행 폴더(경로 또는 out/ 아래 이름)
 * @param {string} cand 후보 폴더 이름(a·b·c)
 * @param {{ recipesDir?: string, id?: string, date?: string, archetype?: string, brief?: string, pairsFile?: string, fontItems?: Set<string>, library?: object[] }} [opts]
 * @returns {{ id: string, file: string, date: string, origin: string }}
 */
export function promoteCandidate(run, cand, { recipesDir = RECIPES_DIR, id, date, archetype: archetypeIn, brief: briefIn, pairsFile = PAIRS_FILE, fontItems, library, dryRun = false } = {}) {
  const runDir = resolveRun(run)
  const candDir = join(runDir, cand)
  const c = readCandidateHead(candDir)
  if (!c) throw new PromoteError(`후보 파일이 없다: ${join(candDir, 'candidate.json')}`)
  if (c.source !== 'generated' && c.source !== 'brand') throw new PromoteError(`후보 ${cand}: source ${JSON.stringify(c.source)} 는 승격하지 않는다 — 생성·브랜드 후보만 올린다(라이브러리 후보는 이미 라이브러리에 있다)`)
  const origin = originOf(runDir, cand)
  const done = promotedAs(recipesDir, origin)
  if (done) throw new PromoteError(`이미 승격했다: ${origin} → ${done}`)

  // 후보 머리: compileCandidate 가 쓴 초안 DESIGN.md, 없으면 candidate.json 의 머리 객체.
  const draft = join(candDir, 'recipe', 'DESIGN.md')
  let recipe
  if (existsSync(draft)) recipe = parseRecipe(readFileSync(draft, 'utf8'))
  else if (c.recipe && typeof c.recipe === 'object') recipe = { ...structuredClone(c.recipe), body: String(c.recipe.body ?? '') }
  else throw new PromoteError(`후보 ${cand}: 초안 ${draft} 도 머리 객체(candidate.json recipe)도 없다 — 먼저 compileCandidate`)

  const { brand, ...head } = recipe
  const newId = id ?? nextRecipeId(recipesDir, `${c.source === 'brand' ? 'brand-' : ''}${String(c.preset ?? head.name ?? '').replace(/^(gen|preset)-/, '')}`)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newId)) throw new PromoteError(`레시피 id 규칙에 안 맞는다: ${newId}`)
  if (existsSync(join(recipesDir, newId))) throw new PromoteError(`이미 있는 레시피 폴더: ${newId}`)

  const info = pairInfo(pairsFile, tmpRecipeId(runDir, cand))
  const when = date ?? info?.date ?? new Date().toISOString().slice(0, 10)
  const archetype = archetypeIn ?? info?.archetype ?? c.archetype ?? null
  const brief = briefIn ?? info?.brief ?? c.brief ?? null
  const fonts = c.fonts ?? { display: head.fonts?.display?.family, body: head.fonts?.body?.family }
  const record = [
    '## 승격 기록',
    '',
    `${ORIGIN_LINE}${origin}`,
    `- 출처: ${c.source === 'brand' ? '브랜드 입력' : '생성'}(source ${c.source})`,
    `- 출처 프리셋: ${c.preset ?? '확인 안 됨'}`,
    `- 팔레트: ${c.palette ?? '확인 안 됨'}`,
    `- 서체: ${fonts.display ?? '확인 안 됨'} / ${fonts.body ?? '확인 안 됨'}`,
    `- 결선 날짜: ${when}`,
    `- 원형·브리프: ${archetype ?? '확인 안 됨'} · ${brief ?? '확인 안 됨'}`,
    ...(brand ? ['- 브랜드 로고(`head.brand`)는 싣지 않았다 — 고객 한 곳의 자산이라 라이브러리 레시피 머리에 두지 않는다(대장 C83).'] : []),
    ...((c.brand?.adjustments?.length || c.brand?.fontSubstitutions?.length) ? [`- 브랜드 조정: 색 ${c.brand.adjustments?.length ?? 0}건 · 서체 대체 ${c.brand.fontSubstitutions?.length ?? 0}건(후보 카드에 있던 내역)`] : []),
  ].join('\n')
  const mark = `${UNCONFIRMED_HEADING}\n\n운영자가 이 초안을 확인하기 전이라 \`gen:all\` 은 이 레시피를 넣지 않는다(컴파일·갤러리·프리셋·에이전트 입구에서 모두 빠진다). 확인이 끝나면 이 절(제목 줄 포함)을 지운다 — 다음 \`gen:all\` 이 넣고, 그때 레시피 사이 차이·다양성 검사가 처음으로 이 레시피를 본다.`
  const body = `${dropSection(head.body, GENERATED_MARK)}\n\n${record}\n\n${mark}\n`
  const out = { ...head, id: newId, body }

  // 쓰기 전 관문.
  const reasons = []
  const { violations } = lintRecipeReport(out, { fontItems: fontItems ?? knownRegistryItems() })
  for (const v of violations) reasons.push(`lint:${String(v).split(':')[0].trim()}`)
  if (c.source === 'generated') for (const lib of library ?? loadLibrary()) if (axisDistance(out, lib) < MIN_AXES) reasons.push(`axis-distance:library:${lib.id}`)
  if (reasons.length) throw new PromoteError(`승격하지 않았다 — ${[...new Set(reasons)].join(' · ')}${violations.length ? `\n${violations.join('\n')}` : ''}`, reasons)

  const file = join(recipesDir, newId, 'DESIGN.md')
  if (!dryRun) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, serializeRecipe(out))
  }
  return { id: newId, file, date: when, origin }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined }
  const id = flag('--id'), date = flag('--date')
  const [run, cand] = argv
  if (!run || !cand) { console.error('사용: node factory/board/promote.mjs <run> <cand> [--id r11-이름] [--date YYYY-MM-DD]'); process.exit(2) }
  try {
    const r = promoteCandidate(run, cand, { id, date })
    console.log(`승격 초안: ${r.id} (${r.origin}, 결선 ${r.date}) → ${r.file}\n운영자 확인 전 표시가 붙어 gen:all 에 안 들어간다. 확인 뒤 「## 운영자 확인 전」 절을 지우고 npm run gen:all.`)
  } catch (e) {
    console.error(e instanceof PromoteError ? `승격 안 함: ${e.message}` : `도구 실패: ${e.message}`)
    process.exit(1)
  }
}
