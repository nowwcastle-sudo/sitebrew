// 장면 보드(보드 A2 — factory v1 Task 5.17)의 촬영 목록. 손으로 적은 목록이 아니라 블록 메타와 레시피 초안에서 만든다(순수 — 브라우저 없음).
//   장면(블록)  : scripts/blocks.mjs FV1_HEROES 의 히어로 + 메타 boldness "bold" 인 블록 전부(대담안 장면). 블록마다 레시피 하나 —
//                 블록 행렬(block-board/jobs.mjs judgeRecipes)의 「메타 archetypes 와 맞는 첫 라이브러리 레시피」를 그대로 쓴다.
//                 주소 /qa/blocks?b=<블록>&r=<레시피>&frame=1 · 문서 id = 블록 이름(block-<kind>-<variant>).
//   레시피 초안 : recipe.mjs listRecipeDrafts() 가운데 r12~r16. 주소 /qa/recipes?r=<id>&scene=<머리 signature 첫 장면>&frame=1 · 문서 id = 레시피 id.
//                 초안은 draft-preview.mjs 가 별도 작업 폴더에서 「## 운영자 확인 전」 절을 지워야 갤러리에 뜬다 — 그 폴더에서는 같은 번호가 이미 라이브러리 레시피이므로 둘 다 찾는다.
// 블록에 붙일 레시피는 초안 번호 범위를 뺀 라이브러리 레시피에서만 고른다(초안 준비 폴더에서 돌려도 같은 결과).
// CLI: node factory/board/scene-board/jobs.mjs — 목록을 보이고 문제가 있으면 종료 1(board:scenes 의 첫 단계).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FV1_HEROES, loadBlocks, blockName } from '../../scripts/blocks.mjs'
import { listRecipeDrafts, recipeIds, parseRecipe } from '../../scripts/recipe.mjs'
import { loadHeads, ROOT } from '../recipe-board/jobs.mjs'
import { themeOf } from '../recipe-board/video.mjs'
import { judgeRecipes, metaOf } from '../block-board/jobs.mjs'

export { ROOT }
export const DRAFT_RANGE = { from: 12, to: 16 }
export const draftNum = (id) => Number(/^r(\d+)-/.exec(String(id))?.[1] ?? NaN)
export const inDraftRange = (id, range = DRAFT_RANGE) => { const n = draftNum(id); return n >= range.from && n <= range.to }
const rangeSize = (range) => range.to - range.from + 1
const BOLD_LABEL = { motion: '움직임으로 대담', layout: '배치·서체로 대담' }

// 운영자 확인 전 초안 + (초안 준비 폴더라서) 절이 이미 지워진 같은 번호 레시피 → [{ id, head, open }] 번호순.
export function draftHeads({ root = ROOT, range = DRAFT_RANGE } = {}) {
  const open = listRecipeDrafts(root).filter((d) => inDraftRange(d.id, range)).map((d) => ({ ...d, open: true }))
  const seen = new Set(open.map((d) => d.id))
  const previewed = recipeIds(root).filter((id) => inDraftRange(id, range) && !seen.has(id))
    .map((id) => ({ id, head: parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8')), open: false }))
  return [...open, ...previewed].sort((a, b) => draftNum(a.id) - draftNum(b.id))
}

// 장면이 되는 블록: FV1_HEROES(항상) + 메타가 bold 인 것 — FV1_HEROES 순서 먼저, 나머지는 이름순.
export function sceneBlocks(blocks, heroes = FV1_HEROES) {
  const byName = new Map(blocks.map((b) => [blockName(b.kind, b.variant), b]))
  const picked = new Map()
  for (const v of heroes) {
    const name = blockName('hero', v)
    const b = byName.get(name)
    if (!b || !metaOf(b)) throw new Error(`${name}: 블록이나 그 메타가 없다(FV1_HEROES)`)
    picked.set(name, b)
  }
  for (const [name, b] of [...byName].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) if (!picked.has(name) && metaOf(b)?.boldness === 'bold') picked.set(name, b)
  return [...picked].map(([name, b]) => ({ name, b, meta: metaOf(b) }))
}

const blockJob = ({ name, b, meta }, libHeads, pick) => {
  const recipe = pick(meta, libHeads)
  const head = libHeads.find((h) => h.id === recipe)
  return {
    id: name, kind: 'block', name: meta.title, code: name, block: name,
    recipe, theme: themeOf(head), displayKo: head.fonts?.displayKo?.family ?? null,
    bold: meta.boldness === 'bold', boldMode: meta.boldness === 'bold' ? meta.boldMode : null,
    boldLabel: meta.boldness === 'bold' ? BOLD_LABEL[meta.boldMode] ?? null : null,
    path: `/qa/blocks?b=${name}&r=${recipe}&frame=1`, sel: `[data-block="${b.kind}-${b.variant}"]`,
    tech: { layout: meta.layout, archetypes: meta.archetypes, motion: meta.motion, media: meta.media },
  }
}
const draftJob = ({ id, head, open }) => {
  const scene = head.signature?.[0]
  if (!scene) throw new Error(`${id}: 머리 signature 가 비어 있다`)
  return {
    id, kind: 'recipe', name: `${head.name} — ${(head.mood ?? []).join(' · ')}`.replace(/ — $/, ''), code: id, recipe: id, scene,
    theme: themeOf(head), displayKo: head.fonts?.displayKo?.family ?? null, bold: false, boldMode: null, boldLabel: null, open,
    path: `/qa/recipes?r=${id}&scene=${scene}&frame=1`, sel: `article[data-scene="${scene}"]`,
    tech: { colorLogic: head.colorLogic, motion: head.motion, archetypes: head.archetypes },
  }
}

/** 촬영 목록 — 블록 장면 먼저, 레시피 초안은 번호순. 옵션은 시험이 메타·머리를 갈아 끼우는 자리다. */
export function sceneJobs({ root = ROOT, blocks = loadBlocks(root), heads = loadHeads(), range = DRAFT_RANGE, pick = (meta, lib) => judgeRecipes(meta, lib).primary } = {}) {
  const lib = heads.filter((h) => !inDraftRange(h.id, range))
  return [...sceneBlocks(blocks).map((s) => blockJob(s, lib, pick)), ...draftHeads({ root, range }).map(draftJob)]
}

// 목록 점검: 문서 id 중복 · 초안이 범위만큼(5벌)인가 · 블록 장면이 하나는 있는가. 문제 목록(빈 목록 = 통과).
export function checkJobs(jobs, { range = DRAFT_RANGE } = {}) {
  const p = []
  const ids = jobs.map((j) => j.id)
  for (const d of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) p.push(`문서 id 중복: ${d}`)
  const drafts = jobs.filter((j) => j.kind === 'recipe')
  if (drafts.length !== rangeSize(range)) p.push(`레시피 초안 ${drafts.length}벌 ≠ ${rangeSize(range)}벌(r${range.from}~r${range.to}) — ${drafts.map((d) => d.id).join(', ') || '없음'}`)
  if (!jobs.some((j) => j.kind === 'block')) p.push('블록 장면이 하나도 없다')
  return p
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  try {
    const jobs = sceneJobs()
    const problems = checkJobs(jobs)
    const blocksN = jobs.filter((j) => j.kind === 'block'), drafts = jobs.filter((j) => j.kind === 'recipe')
    console.log(`장면 보드 목록: 블록 장면 ${blocksN.length}개(대담안 ${blocksN.filter((j) => j.bold).length}) · 레시피 초안 ${drafts.length}벌${drafts.some((d) => !d.open) ? '(절이 이미 지워진 폴더)' : ''}`)
    for (const j of jobs) console.log(`  ${j.kind === 'block' ? '장면' : '초안'} ${j.id}${j.bold ? ` [대담안 ${j.boldLabel}]` : ''} → ${j.path} · 레시피 ${j.recipe}`)
    for (const m of problems) console.error(`문제: ${m}`)
    process.exit(problems.length ? 1 : 0)
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exit(1)
  }
}
