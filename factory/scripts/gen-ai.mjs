// 에이전트용 생성물 ai/ — 사용: node factory/scripts/gen-ai.mjs [--ref vX.Y.Z]   (npm run gen:all 의 마지막 단계, check:regen 이 덮는다)
//  - ai/gotchas.json            ← factory/ai/gotchas.source.json (기본 shadcn과 다르게 동작하는 것)
//  - docs/agents/agent-guide.md §5 생성 구역      ← 같은 원천(한 줄씩). 원천 하나에서 둘을 만든다(factory-rules.md §20-1).
//  - ai/tasks/<원형>.json        ← registry/factory/archetypes/<원형>.json 의 coreTask·완성 단계·섹션(allowedVariants = 블록 이름)·전역 섹션·순서 틀·법적 요건·법정 페이지·SEO 기본값
//                                  + 레시피 후보(registry/factory/recipes/*/DESIGN.md 의 archetypes 에 이 원형이 있는 레시피)
//                                  + 블록 목록(registry/factory/blocks/<kind>/<variant>.block.json 의 archetypes 에 이 원형이 있는 블록 — 종류별, P3-2 Task 9)
// 모양은 factory/ai/schemas.mjs(zod 4) — 쓰기 전에 검사하고, 어긋나면 멈춘다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRef, applyRegion as replaceRegion } from './lib/registry-lib.mjs'
import { ARCHETYPES, RECIPES_DIR, REPO, parseRecipe, isUnconfirmed } from './recipe.mjs'
import { ARCHETYPE_PATH, ARCHETYPE_DIR } from './archetypes.mjs'
import { GotchasSource, GotchasFile, TaskFile, GENERATED } from '../ai/schemas.mjs'
import { loadBlocks, blockName } from './blocks.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const AI_DIR = join(root, 'ai')
export const SOURCE = join(root, 'factory', 'ai', 'gotchas.source.json')
export const CLAUDE_MD = join(root, 'docs/agents/agent-guide.md')
export const BEGIN = '<!-- 생성 구역 시작 — factory/scripts/gen-ai.mjs 가 factory/ai/gotchas.source.json 에서 다시 만든다. 손으로 고치지 않는다. -->'
export const END = '<!-- 생성 구역 끝 -->'
// 레시피 목록이 완전한가. P3-1 레시피 보드에서 운영자가 레시피를 승인했고(factory/board/recipe-decisions.json)
// 원형 9개가 모두 1벌 이상 덮여 true 다. 완전한데 후보가 없는 원형이 생기면 taskFile 이 멈춘다(레시피를 빼거나 archetypes 를 줄일 때).
export const RECIPES_COMPLETE = true

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
export const installCmd = (item, ref) => `npx shadcn@4.21.0 add ${REPO}/${item}#${ref} -y -o`

export function loadGotchas(path = SOURCE) {
  return GotchasSource.parse(readJson(path)).gotchas
}

export function gotchasFile(gotchas) {
  return GotchasFile.parse({ $comment: GENERATED, source: 'factory/ai/gotchas.source.json', mirror: 'docs/agents/agent-guide.md §5', gotchas })
}

export function claudeBlock(gotchas) {
  return [BEGIN, ...gotchas.map((g) => `- ${g.rule}`), END].join('\n')
}

// docs/agents/agent-guide.md 의 생성 구역만 바꾼다(registry-lib applyRegion — 표시줄이 없으면 멈추고, 줄바꿈은 원본 것을 따른다).
export const applyRegion = (source, block) => replaceRegion(source, block, { begin: BEGIN, end: END, where: 'docs/agents/agent-guide.md' })

export function loadRecipes(dir = RECIPES_DIR) {
  // 운영자 확인 전 승격 초안(recipe.mjs UNCONFIRMED_HEADING)은 에이전트 입구 후보에 넣지 않는다 — recipeIds 와 같은 규칙.
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'DESIGN.md')))
    .map((d) => readFileSync(join(dir, d.name, 'DESIGN.md'), 'utf8')).filter((md) => !isUnconfirmed(md))
    .map((md) => parseRecipe(md))
    .map((r) => ({ id: r.id, name: r.name, archetypes: r.archetypes ?? [], conditions: r.archetypeConditions ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

// 운영자 결정 파일(Task 9) — 안내문의 결정 날짜는 여기서 읽는다(박아 두지 않는다 — Task 9 fix 1, 리뷰 M9). 가장 늦은 decidedAt 의 날짜.
export const DECISIONS_FILE = join(root, 'factory', 'board', 'recipe-decisions.json')
export function decisionDate(file = DECISIONS_FILE) {
  if (!existsSync(file)) return null
  const dates = (readJson(file).decisions ?? []).map((d) => String(d.decidedAt ?? '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  return dates.at(-1) ?? null
}

export function recipeNote(candidates, recipes, complete = RECIPES_COMPLETE, date = decisionDate()) {
  const ids = recipes.map((r) => r.id).join('·') || '없음'
  if (complete) return `운영자가 레시피 보드${date ? `(${date})` : ''}에서 승인한 레시피 ${recipes.length}벌(${ids})에서 archetypes 에 이 원형을 적은 것을 모두 뽑았다(결정: factory/board/recipe-decisions.json). condition 이 있는 후보는 그 조건에 맞는 브리프에만 쓴다.`
  const now = `지금 레시피 ${recipes.length}벌(${ids})은 후보다 — 쓸 레시피는 P3-1 레시피 보드(Task 8)에서 운영자가 승인한 뒤 확정된다.`
  return candidates.length
    ? `레시피 DESIGN.md 의 archetypes 에 이 원형이 있는 것만 뽑았다. ${now}`
    : `아직 archetypes 에 이 원형을 적은 레시피가 없다(후보를 지어내지 않는다). ${now} 그동안은 factory-base 기본 모양을 쓴다.`
}

// 섹션 한 줄: kind·(블록에 묶였으면) blockKinds·allowedVariants(블록 이름), 없으면 noBlock(이유·대장 행).
const sectionRow = (s) => ({
  kind: s.kind,
  blockKinds: s.blockKinds ?? [],
  allowedVariants: s.allowedVariants ?? [],
  ...(s.noBlock ? { noBlock: s.noBlock } : {}),
})

// 원형 seo 기본값을 메타·JSON-LD 부품에 잇는 안내(P3-2 Task 13 부품) — 콘텐츠 객체 { …원형 콘텐츠, site } 하나에서 둘이 나온다.
const seoUse = (ref) => ({
  install: { seoMetadata: installCmd('seo-meta', ref), jsonLdFor: installCmd('geo-entity', ref) },
  usage: 'seoMetadata(content, page) → Next Metadata(generateMetadata) · jsonLdFor(content, page) → <script type="application/ld+json">. titleTemplate 의 {siteName} 은 content.site 이름(없으면 원형의 회사·가게·제품·기관 이름)이고, type 은 원형 기본 종류다.',
})

// 블록은 레시피 base 하나를 먼저 깔아야 모양이 선다(항목 meta.requires "recipe") — 안내문에 순서를 적는다.
export const BLOCKS_NOTE = '블록 메타 archetypes 에 이 원형을 적은 블록만 종류(kind)별로 모았다. 블록은 레시피 base 하나를 먼저 설치한 뒤(recipes.candidates 의 install) 블록 install 을 받는다 — B안 색·서체는 그 다음에 `<레시피>-alt` 를 -o 로 덮는다. 부품이 레시피 모양으로 깔리므로 블록 항목에는 ui 의존이 없다.'

export function blocksFor(archetype, blocks, ref) {
  const out = {}
  const ok = blocks.filter((x) => x.meta.success && x.meta.data.archetypes.includes(archetype))
    .sort((a, z) => blockName(a.kind, a.variant).localeCompare(blockName(z.kind, z.variant)))
  for (const b of ok) {
    const m = b.meta.data
    const item = blockName(b.kind, b.variant)
    ;(out[b.kind] ??= []).push({ item, variant: b.variant, layout: m.layout, density: m.density, sectionKinds: m.archetypeKinds, states: m.states, media: m.media, install: installCmd(item, ref) })
  }
  return out
}

export function taskFile(archetype, recipes, ref, contentItems, blocks = []) {
  const id = archetype.id
  const item = `content-${id}`
  if (!contentItems.includes(item)) throw new Error(`${id}: 콘텐츠 항목 ${item} 이 content/registry.json 에 없다`)
  const candidates = recipes.filter((r) => r.archetypes.includes(id))
    .map((r) => ({ id: r.id, name: r.name, install: installCmd(r.id, ref), ...(r.conditions?.[id] ? { condition: r.conditions[id] } : {}) }))
  if (RECIPES_COMPLETE && !candidates.length) throw new Error(`${id}: RECIPES_COMPLETE 인데 이 원형을 적은 레시피가 없다 — 레시피를 더하거나 RECIPES_COMPLETE 를 false 로`)
  return TaskFile.parse({
    $comment: GENERATED,
    id,
    source: `${ARCHETYPE_DIR}/${id}.json`,
    ref,
    purpose: archetype.purpose,
    coreTask: archetype.coreTask,
    completion: archetype.completion,
    locales: archetype.locales,
    pages: archetype.pages.map((p) => ({
      id: p.id,
      route: p.route,
      ...(p.phase ? { phase: p.phase } : {}),
      required: p.sections.filter((s) => s.required === true).map(sectionRow),
      optional: p.sections.filter((s) => s.required !== true).map(sectionRow),
    })),
    globalSections: (archetype.globalSections ?? []).map(({ kind, required, mustContain, condition, maxItems }) =>
      ({ kind, required: required === true, mustContain: mustContain ?? [], ...(condition ? { condition } : {}), ...(maxItems ? { maxItems } : {}) })),
    sectionOrders: (archetype.sectionOrderTemplates ?? []).map(({ id: oid, order }) => ({ id: oid, order })),
    legal: (archetype.legalRequirements ?? []).map(({ basis, appliesWhen, requirement, source }) => ({ basis, appliesWhen, requirement, source })),
    legalPages: { pages: archetype.legal.pages, laws: archetype.legal.laws },
    seo: { titleTemplate: archetype.seo.titleTemplate, type: archetype.seo.type, ...seoUse(ref) },
    conversion: archetype.conversion ?? [],
    content: { item, install: installCmd(item, ref) },
    recipes: { candidates, complete: RECIPES_COMPLETE, note: recipeNote(candidates, recipes) },
    blocks: blocksFor(id, blocks, ref),
    blocksNote: BLOCKS_NOTE,
  })
}

export function buildAll(ref) {
  const gotchas = loadGotchas()
  const recipes = loadRecipes()
  const contentItems = readJson(join(root, 'registry', 'factory', 'content', 'registry.json')).items.map((i) => i.name)
  const blocks = loadBlocks(root)
  const bad = blocks.filter((b) => !b.meta.success)
  if (bad.length) throw new Error(`블록 메타 ${bad.length}개를 읽지 못했다(${bad.slice(0, 3).map((b) => `${b.kind}/${b.variant}`).join(', ')}) — npm run blocks:check`)
  const tasks = ARCHETYPES.map((id) => taskFile(readJson(join(ARCHETYPE_PATH, `${id}.json`)), recipes, ref, contentItems, blocks))
  return { gotchas: gotchasFile(gotchas), tasks, claude: claudeBlock(gotchas) }
}

const json = (v) => JSON.stringify(v, null, 2) + '\n'

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const pkg = readJson(join(root, 'package.json'))
  const ref = parseRef(process.argv.slice(2)) ?? `v${pkg.version}`
  const { gotchas, tasks, claude } = buildAll(ref)
  // tasks/ 는 통째로 다시 만든다 — 원형이 빠지면 파일도 빠진다.
  rmSync(join(AI_DIR, 'tasks'), { recursive: true, force: true })
  mkdirSync(join(AI_DIR, 'tasks'), { recursive: true })
  writeFileSync(join(AI_DIR, 'gotchas.json'), json(gotchas))
  for (const t of tasks) writeFileSync(join(AI_DIR, 'tasks', `${t.id}.json`), json(t))
  writeFileSync(CLAUDE_MD, applyRegion(readFileSync(CLAUDE_MD, 'utf8'), claude))
  console.log(`gen-ai: gotchas ${gotchas.gotchas.length} · tasks ${tasks.length} · docs/agents/agent-guide.md §5 (ref ${ref})`)
}
