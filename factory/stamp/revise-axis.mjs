// 디자인 읽기 수정(revise.mjs 에서 나눔) — 사이트 전체·요소 범위의 읽기를 레시피 머리 사본으로 옮겨 전체를 다시 조립하는 안 만들기(reviseHeads)와 고르기(applyAxis).
//   머리를 옮기는 일은 plan-readings.mjs(planReadings)가 한다 — 여기서는 안마다 임시 레시피로 사본 사이트를 만들고 보드(version 2)를 쓴다.
//   revise.mjs 의 제안 사본·보드 도우미는 순환 import 없이 tools 로 넘겨받는다(revise-structure.mjs 와 같은 방식).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseRecipe } from '../scripts/recipe.mjs'
import { recipeToMaterials } from '../scripts/style-presets.mjs'
import { GENERATED_MARK } from './compile-candidate.mjs'
import { grammar, langOf } from '../vocab/grammar.mjs'
import { designLexicon } from './design-context.mjs'
import { planReadings } from './plan-readings.mjs'
import { writeCompare } from './revise-compare.mjs'
import { previousCandidate } from './revise-history.mjs'
import { recipeColors, recipeHeadOf } from './site-files.mjs'

/** 기본 테마의 바탕·글자·강조 색 — 비교 화면(revise-compare.mjs)이 견본으로 그린다. */
export const colorsOf = (head) => {
  const { background, foreground, accent } = recipeColors(head).og
  return { background, foreground, accent }
}

/** 지금 머리 요약 — 보드에 「전」으로 남긴다(안의 changes 와 짝). */
const summaryOf = (head) => ({ id: head.id, motion: head.motion, spacing: head.spacing ?? 'normal', axes: head.axes, colorLogic: head.colorLogic, defaultTheme: head.defaultTheme ?? 'light', fonts: { display: head.fonts?.display?.family ?? null, body: head.fonts?.body?.family ?? null }, color: colorsOf(head) })

/**
 * 시안 따라 하기({ copyFrom })가 따라 할 머리 — 시안 id 면 같은 실행 폴더의 그 시안 방향 파일, 'previous' 면 방금 고치기 전 방향. 찾지 못하면 빈 표(계획 단계가 되묻는다).
 * 시안 id 는 실행 폴더에 실제로 있는 후보 폴더 이름일 때만 읽는다(경로를 만들 수 없다).
 */
function copySourcesOf(ctx, from, readStage) {
  const previous = from === grammar.match.candidate.previousId
  const found = previous ? previousCandidate(ctx.candDir)
    : readdirSync(ctx.runDir).includes(from) && existsSync(join(ctx.runDir, from, '01-direction.json')) ? readStage(join(ctx.runDir, from), '01-direction') : null
  return found ? { [from]: recipeHeadOf(found) } : {}
}

/**
 * @param {{ ctx: object, input: { readings: object[] } | { options: object[] } | { copyFrom: string }, n: number, opts: object, now: () => string, text: string|null, tools: object }} a
 * @returns {Promise<{ ask: string } | object>} 되묻거나 보드 결과
 */
export async function reviseHeads({ ctx, input, n, opts, now, text, tools }) {
  const { nextIndex, buildProposal, sectionsChanged, boardBase, candidateBlockers, writeJson, readStage } = tools
  const head = recipeHeadOf(ctx.cand)
  const copySources = input.copyFrom === undefined ? undefined : copySourcesOf(ctx, input.copyFrom, readStage)
  const planned = planReadings(head, input, { lex: designLexicon(), archetype: ctx.sitemap.archetype, palette: (await recipeToMaterials(head)).palette, site: ctx.site, lang: langOf(text), ...(copySources ? { copySources } : {}) })
  if (planned.ask) return { ask: planned.ask }
  const picked = planned.variants.slice(0, n)
  // 안이 하나뿐인 까닭은 한 줄만 — 값 읽기가 자기 까닭을 줬으면 그것, 아니면 계획의 일반 문장. 읽은 방식 같은 안내(notes)는 덧붙는다.
  const why = planned.why === grammar.text.plan.onlyOne && picked.length === 1 && picked[0].reason ? picked[0].reason : planned.why
  const notes = [...(why ? [why] : []), ...new Set(picked.flatMap((v) => v.notes ?? []))] // 안이 하나뿐이면 안 b 가 없는 까닭을, 값 읽기는 읽은 방식(이름 → 코드 · 주색 명도 조정)을 보여 준다
  const index = nextIndex(ctx.candDir)
  const routes = ctx.sitemap.pages.map((p) => p.route)
  const variants = []
  for (const [i, v] of picked.entries()) {
    const vid = `v${i + 1}`
    const cand = { ...structuredClone(ctx.cand), source: 'brand', recipe: v.head } // 머리를 고친 사본은 임시 레시피로 컴파일된다(compile-candidate: brand 는 라이브러리와의 거리 검사를 하지 않는다 — 수정 머리는 린트와 호환표를 planReadings 가 이미 지켰다. 여백(spacing)이 axisDistance 에 들어가지 않는 것도 의도다 — 골든 출력을 바꾸지 않는다)
    const p = await buildProposal({ ctx, index, vid, cand, opts, routes, mutate: () => {} })
    const changed = sectionsChanged(ctx.site, p.newSite)
    variants.push({
      id: vid, label: `${vid} ${v.say}`, say: v.say, readings: v.readings, changes: v.changes, colors: colorsOf(v.head), ...(v.notes ? { notes: v.notes } : {}),
      diff: { kind: 'design', sameStructure: changed.length === 0, sections: changed, files: p.files, blockersAdded: p.blockers, blockersRemoved: p.blockersRemoved },
      blockers: p.blockers, weight: 1, qa: p.qa, siteRel: p.siteRel, previewUrl: null,
    })
  }
  const status = variants.length ? 'ready' : 'empty'
  const readings = input.copyFrom !== undefined ? [] : (input.readings ? [input.readings] : input.options.map((o) => o.readings)).flat()
  const target = [...new Set(readings.map((r) => r.scope))].join(',') || 'site' // 시안 따라 하기는 읽기가 없다 — 사이트 전체
  const board = {
    ...boardBase({ ctx, request: { scope: 'design', target, intent: 'readings' }, index, now, text, status }), version: 2,
    readings, say: planned.byOption ? picked.map((v) => v.say).join(' / ') : picked[0].say, ...(why ? { why } : {}),
    route: null, routes, before: { recipe: typeof ctx.cand.recipe === 'string' ? ctx.cand.recipe : ctx.cand.recipe?.id ?? null, blockers: candidateBlockers(ctx.candDir), head: summaryOf(head) }, variants, notes, picked: null,
  }
  const boardFile = join(ctx.candDir, '09-revise', String(index), 'board.json')
  writeJson(boardFile, board)
  writeCompare(join(boardFile, '..'), board, designLexicon())
  return { index, boardFile, scope: 'design', target, intent: 'readings', status, variants, notes, say: board.say }
}

export function applyAxis({ runDir, candDir, v, tools }) {
  const { proposalDir, patchStage } = tools
  const dir = proposalDir(runDir, v)
  const design = dir && join(dir, 'recipe', 'DESIGN.md')
  if (!design || !existsSync(design)) throw new Error(`안 ${v.id} 의 임시 레시피 머리가 없다(DESIGN.md): ${design ?? '(안의 사이트 사본 자리를 모른다)'} — 수정 안을 다시 만든다`)
  const { body = '', ...head } = parseRecipe(readFileSync(design, 'utf8'))
  const mark = body.indexOf(GENERATED_MARK)
  const recipe = { ...head, body: (mark >= 0 ? body.slice(0, mark) : body).trimEnd() } // 「생성 — 승격 전」 절은 컴파일이 다시 붙인다
  mkdirSync(join(candDir, 'recipe'), { recursive: true })
  copyFileSync(design, join(candDir, 'recipe', 'DESIGN.md'))
  patchStage(candDir, '01-direction', (cand) => ({ ...cand, source: 'brand', recipe }))
  return { target: 'design', say: v.say, changes: v.changes, recipe: recipe.id, learned: 0, next: `같은 --run 으로 찍어내기를 다시 돌린다 — 06·07 이 새 레시피(${recipe.id})로 다시 만들어진다` }
}
