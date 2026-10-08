// 후보 레시피 컴파일(P3-3 Task 5) — 생성·브랜드 레시피 머리를 설치 가능한 임시 레시피로.
//   compileCandidate(cand, runDir) → { recipeId, registryDir, outRoot?, designPath?, items?, aiTell? }
//   · 라이브러리 후보(source "library", recipe = id)는 기존 r/<id> 를 가리키기만 한다. 아무것도 쓰지 않는다.
//   · 생성·브랜드 후보(recipe = 머리)는 runDir/<cand>/recipe/DESIGN.md(머리 + 「생성 — 승격 전」 절)를 쓰고,
//     runDir/<cand>/build/registry/factory/{r,recipes}/<tmp-id>/ 로 컴파일하고(recipe.mjs compileRecipeTo — gen:all 과 같은 코드),
//     항목을 registryDir/registry.json 에 쓴다. tmp-id = x-<run>-<cand>(run = runDir 폴더 이름). 저장소 생성물 경로(registry·ai)에는 쓰지 않는다.
//   · 탈락: lint(kit 항목 존재까지) · 라이브러리와 축 차이 < 2(생성 후보만 — 브랜드는 색이 축이라 directions 와 같게 ①과만) · 키트 항목 없음 → CandidateRejectedError(reasons = 규칙 id).
//     directions.mjs pickDirections({ exclude: [{ id, reasons }] }) 가 그대로 받아 같은 칸의 다음 순위로 채운다.
//   · AI 티: 문턱이 아직 없다(docs/qa/ai-tell-baseline.md — 대표 쌍대 결선 뒤 정함). 여기서는 재지 않고 aiTell 을 비운다. Task 11 이 만든 사이트(Task 9)를
//     factory/qa/ai-tell.mjs 로 잰다 — 컴파일 결과에 필요한 것(recipeId·registryDir)은 이 반환에 있다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify as stringifyYaml } from 'yaml'
import { compileRecipeTo, lintRecipeReport, knownRegistryItems, kitItems, R_DIR, REPO } from '../scripts/recipe.mjs'
import { loadLibrary } from '../scripts/style-presets.mjs'
import { axisDistance, MIN_AXES } from './directions.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
// 생성물이 사는 추적 경로 — 실행 폴더가 여기 있으면 check:regen 이 깨진다.
const TRACKED_GENERATED = [join(ROOT, 'registry'), join(ROOT, 'ai')]
export const GENERATED_MARK = '## 생성 — 승격 전'

export class CandidateRejectedError extends Error {
  constructor(candId, reasons, violations = []) {
    super(`후보 ${candId} 탈락 — ${reasons.join(' · ')}${violations.length ? `\n${violations.join('\n')}` : ''}`)
    this.name = 'CandidateRejectedError'
    this.candidate = candId
    this.reasons = reasons
    this.violations = violations
  }
}

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** 임시 레시피 id: x-<run>-<cand>. run = 실행 폴더 이름, 둘 다 [a-z0-9-] 로 정리한다(레시피 id 규칙). */
export function tmpRecipeId(runDir, candId) {
  const run = slug(basename(resolve(runDir)))
  const cand = slug(candId)
  if (!run) throw new Error(`실행 폴더 이름에서 run 이름을 못 만든다: ${runDir}`)
  if (!cand) throw new Error(`후보 이름이 비었다: ${JSON.stringify(candId)}`)
  return `x-${run}-${cand}`
}

/** 레시피 머리(+ body) → DESIGN.md 텍스트. parseRecipe 의 역(YAML 머리 --- … --- + 본문). */
export function serializeRecipe(r) {
  const { body = '', ...head } = r
  return `---\n${stringifyYaml(head, { lineWidth: 0 })}---\n\n${body.replace(/^\s+/, '')}`
}

const ruleIds = (violations) => [...new Set(violations.map((v) => `lint:${String(v).split(':')[0].trim()}`))]

function assertOutsideTracked(runDir) {
  const at = resolve(runDir)
  for (const t of TRACKED_GENERATED) {
    const rel = relative(t, at)
    if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error(`실행 폴더 ${runDir} 가 추적되는 생성물 경로(${relative(ROOT, t)}/) 안이다 — check:regen 이 깨진다. out/ 아래를 쓴다`)
  }
}

/**
 * @param {{ id: string, slot?: string, source: 'library'|'generated'|'brand', recipe: string|object }} cand  Task 3 Candidate
 * @param {string} runDir
 * @param {{ ref?: string, repo?: string }} [opts]  항목 의존 표기(기본: gen:all 과 같은 v<package.json version>)
 * @returns {Promise<{ recipeId: string, registryDir: string, outRoot?: string, designPath?: string, items?: object[], aiTell?: number }>}
 */
export async function compileCandidate(cand, runDir, { ref = `v${PKG_VERSION}`, repo = REPO } = {}) {
  if (!cand?.id) throw new Error('compileCandidate: 후보 id 가 없다')
  if (cand.source === 'library') {
    if (typeof cand.recipe !== 'string') throw new Error(`라이브러리 후보 ${cand.id}: recipe 는 레시피 id 문자열이다`)
    if (!existsSync(join(R_DIR, cand.recipe, 'ui'))) throw new Error(`라이브러리 후보 ${cand.id}: r/${cand.recipe}/ui 가 없다 — 레시피 id 가 맞는지, gen:all 을 돌렸는지 본다`)
    return { recipeId: cand.recipe, registryDir: R_DIR, aiTell: undefined }
  }
  if (cand.source !== 'generated' && cand.source !== 'brand') throw new Error(`후보 ${cand.id}: 모르는 source ${JSON.stringify(cand.source)}`)
  if (!cand.recipe || typeof cand.recipe !== 'object') throw new Error(`후보 ${cand.id}: ${cand.source} 후보의 recipe 는 레시피 머리 객체다`)
  assertOutsideTracked(runDir)

  const recipeId = tmpRecipeId(runDir, cand.id)
  const head = { ...structuredClone(cand.recipe), id: recipeId }
  const knownItems = knownRegistryItems()

  // 탈락 관문 — 아무것도 쓰기 전에.
  const { violations } = lintRecipeReport(head, { fontItems: knownItems })
  const reasons = ruleIds(violations)
  if (cand.source === 'generated') {
    for (const lib of loadLibrary()) if (axisDistance(head, lib) < MIN_AXES) reasons.push(`axis-distance:library:${lib.id}`)
  }
  // 키트 항목이 없으면 registryDependencies 에서 조용히 빠진다(라이브러리는 경고) — 후보는 설치했을 때 서체·모션이 빠지므로 쓰기 전에 탈락시킨다.
  for (const k of kitItems(head)) if (!knownItems.has(k)) reasons.push(`kit-missing:${k}`)
  if (reasons.length) throw new CandidateRejectedError(cand.id, reasons, violations)

  const candDir = join(runDir, cand.id)
  const designPath = join(candDir, 'recipe', 'DESIGN.md')
  const mark = `${GENERATED_MARK}\n\n이 레시피는 찍어내기 실행(${basename(resolve(runDir))}/${cand.id}, 출처 ${cand.source})이 만든 후보다. 라이브러리에 없다 — 승격(promote) 전에는 recipes/ 에 넣지 않는다.\n`
  mkdirSync(dirname(designPath), { recursive: true })
  writeFileSync(designPath, serializeRecipe({ ...head, body: `${String(head.body ?? '').replace(/\s+$/, '')}\n\n${mark}` }))

  const outRoot = join(candDir, 'build')
  const { items } = await compileRecipeTo(head, outRoot, { ref, repo, knownItems })
  const registryDir = join(outRoot, 'registry', 'factory', 'r')
  writeFileSync(join(registryDir, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', name: 'wf-candidate', homepage: 'https://github.com/nowwcastle-sudo/sitebrew', items }, null, 2) + '\n')
  return { recipeId, registryDir, outRoot, designPath, items, aiTell: undefined }
}
