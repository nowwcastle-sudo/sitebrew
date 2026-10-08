// 구획 단위 수정(factory v1 Task 4.3) 시험 공용 재료 — 06 까지 끝난 실행 폴더(01·02·03·04·06, 설치·빌드 없이 `install: false`)와 그 `content/site.json`.
//   scripts/lib/stamp-site-fixtures.mjs 의 makeRun·gen 으로 후보 하나(라이브러리 레시피)를 만든다. 계획서는 local 원형을 말했지만 local 의 히어로 구획은
//   `home/hero-visit-info` 이고 허용 변형이 2개뿐이라 「지금 것을 뺀 2안」이 나올 수 없다 — 기본은 saas(`home/hero` 변형 10개). local 은 「변형이 모자란 구획」 시험에 쓴다.
//   모듈을 읽을 때 한 번 만들고(약 4초), fixtureRun() 은 매번 새 복사본을 돌려준다(시험끼리 09-revise 번호·03 파일이 섞이지 않게). 프로세스가 끝나면 지운다.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { loadLibrary } from '../style-presets.mjs'
import { axisHeads } from '../../stamp/revise.mjs'
import { GENERATED_MARK, serializeRecipe, tmpRecipeId } from '../../stamp/compile-candidate.mjs'
import { makeRun, gen, root, SAAS_BRIEF, saasContent, localBrief, localContent } from './stamp-site-fixtures.mjs'

const BASE = join(root, '.tmp', 'revise-fixtures')
mkdirSync(BASE, { recursive: true })
const made = []
process.on('exit', () => { for (const d of made) rmSync(d, { recursive: true, force: true }) })

async function build(kind, baseDir) {
  const brief = kind === 'local' ? localBrief() : SAAS_BRIEF
  const contentFor = kind === 'local' ? localContent : saasContent
  const r = await makeRun(baseDir, brief, contentFor)
  // 실제 찍어내기 실행처럼 01-direction 단계 파일도 둔다(revise 는 거기서 후보를 읽는다)
  writeFileSync(join(r.runDir, 'a', '01-direction.json'), JSON.stringify({ inputHash: 'fixture', producedAt: '2026-10-10T00:00:00.000Z', data: r.cand }, null, 2) + '\n')
  const g = await gen(r)
  return { kind, runDir: r.runDir, cand: r.cand, siteDir: g.siteDir, result: g }
}

const master = mkdtempSync(join(BASE, 'm-'))
made.push(master)
const MASTERS = { saas: await build('saas', join(master, 'saas')), local: await build('local', join(master, 'local')) }

/** 06 까지 끝난 실행 폴더의 새 복사본 경로(후보 a). kind: 'saas'(기본) | 'local'. */
export function fixtureRun(kind = 'saas') {
  const dest = mkdtempSync(join(BASE, 'c-'))
  made.push(dest)
  const src = MASTERS[kind].runDir
  const target = join(dest, 'run')
  cpSync(src, target, { recursive: true })
  return target
}

/** 후보 a 의 content/site.json (읽기 전용 사본). */
export function fixtureSite(kind = 'saas') {
  return JSON.parse(readFileSync(join(MASTERS[kind].siteDir, 'content', 'site.json'), 'utf8'))
}

export const fixtureCand = (kind = 'saas') => structuredClone(MASTERS[kind].cand)

// ── 고르기(applyRevision) 시험 재료 — 06 을 돌리지 않는다 ──────────────────────────────────────────────────────────
// revise() 가 내는 것(09-revise/<번호>/board.json · 안의 사이트 사본 자리의 임시 레시피 머리 · 안의 04 요청)을 손으로 놓는다. 시험이 보려는 것은 「고르면 무엇이 바뀌나」뿐이라
// 안마다 06 을 다시 돌리는 시간(구획 약 6초 · 축은 임시 레시피 컴파일까지)이 필요 없다. 보드 모양은 revise.mjs 의 reviseSection·reviseAxis·reviseCopy 가 쓰는 것과 같다.
const writeJ = (file, v) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(v, null, 2) + '\n') }
const readJ = (file) => JSON.parse(readFileSync(file, 'utf8'))

/**
 * 고르기 시험용 실행 폴더 — 06 까지 끝난 새 복사본(fixtureRun)에 09-revise/<index>/board.json(상태 ready, 안 v1) 하나를 더한다.
 * @param {{ scope: 'section'|'axis'|'copy',
 *           texts?: Record<string,string>,   copy: 안 v1 의 새 문구(칸 경로 → 글). 기본: home/hero/subhead 하나
 *           (axis 안은 늘 motion 축 — 더 대담하게, 린트를 통과한 첫 값)
 *           needsCopy?: string[] }} o        section: 새 블록이 비워 둔 화면 문구 칸(잎 이름, 예 'copy.caption') — 있으면 안의 04 요청 사본도 둔다
 * @returns {{ dir: string, cand: string, index: number, variant: string, boardFile: string, before: { content: object, variants: object, direction: object }, variantData: object }}
 */
export function fixtureRevisionRun({ scope, texts, needsCopy = [] }) {
  const index = 1
  const axis = 'motion'
  const dir = fixtureRun()
  const cand = join(dir, 'a')
  // 실제 실행처럼 06·07 단계 파일도 둔다(고르면 이것이 낡음 표시가 된다). 내용은 비어 있다 — 시험은 입력 해시만 본다.
  for (const name of ['06-pages', '07-qa']) writeJ(join(cand, `${name}.json`), { inputHash: 'fixture', producedAt: '2026-10-10T00:00:00.000Z', data: {} })
  const stage = (name) => readJ(join(cand, `${name}.json`)).data // 01·02·03·04 는 래퍼 모양 { inputHash, producedAt, data }
  const sitemap = stage('02-sitemap')
  const variants = stage('03-variants')
  const content = stage('04-content')
  const direction = stage('01-direction')
  const siteRel = (vid) => `a/09-revise/${index}/${vid}/${basename(dir)}/a/site`
  const base = { kind: 'revise-board', version: 1, index, candidate: 'a', request: null, intent: 'different', status: 'ready', createdAt: '2026-10-10T00:00:00.000Z', routes: ['/'], route: '/', notes: [], picked: null }
  let board
  if (scope === 'axis') {
    const head = loadLibrary().find((r) => r.id === direction.recipe)
    const h = axisHeads(head, axis, 'bolder', 1)[0] // 더 대담하게 = 높은 모션 단계 중 린트를 통과한 첫 값
    const propCand = join(dir, dirname(siteRel('v1')))
    const designHead = { ...structuredClone(h.head), id: tmpRecipeId(dir, 'a') }
    mkdirSync(join(propCand, 'recipe'), { recursive: true })
    writeFileSync(join(propCand, 'recipe', 'DESIGN.md'), serializeRecipe({ ...designHead, body: `${designHead.body.trimEnd()}\n\n${GENERATED_MARK}\n\n이 레시피는 시험 재료다.\n` }))
    board = { ...base, scope, target: axis, before: { recipe: direction.recipe, blockers: [] }, variants: [{ id: 'v1', axis, value: h.value, label: `v1 ${h.label}`, diff: { kind: 'axis', axis, value: h.value, sameStructure: true, sections: [], files: [] }, blockers: [], weight: 1, qa: null, siteRel: siteRel('v1'), previewUrl: null }] }
  } else if (scope === 'copy') {
    const after = texts ?? { 'home/hero/subhead': '우유와 밀가루만 써요' }
    board = { ...base, scope, target: 'home/hero', before: { texts: {}, blockers: [] }, variants: [{ id: 'v1', label: 'v1 문구', texts: after, diff: { kind: 'copy', key: 'home/hero', before: {}, after, sections: ['home/hero'], files: [] }, blockers: [], weight: 1, qa: null, siteRel: siteRel('v1'), previewUrl: null }] }
  } else {
    const key = 'home/hero'
    const section = sitemap.pages.find((p) => p.id === 'home').sections.find((s) => `home/${s.kind}` === key)
    const chosen = variants[key]
    const from = fixtureSite().sections[key].block // 지금 사이트에 그려진 변형 — revise 가 「지금 것」으로 빼는 쪽(03 이 고른 것이 06 폴백으로 안 그려질 수 있다)
    const block = section.allowedVariants.find((b) => b !== from)
    const paths = needsCopy.map((leaf) => `${key}/ui:${leaf}`)
    board = { ...base, scope, target: key, before: { block: from, chosen, blockers: [] }, variants: [{ id: 'v1', block, label: `v1 ${block}`, diff: { kind: 'section', key, from, to: block, sections: [key], files: [], needsCopy: paths }, blockers: [], weight: 1, qa: null, siteRel: siteRel('v1'), previewUrl: null }] }
    if (paths.length) {
      // revise 는 안마다 사본 후보 폴더에 새 블록 칸을 더한 04 요청을 둔다 — 고르면 이것이 입력 대기 요청이 된다.
      const req = readJ(join(cand, '04-content.request.json'))
      const added = paths.map((path) => ({ path, id: `ui:${path.split('ui:')[1]}`, role: '화면 안내 문구 — 시험 재료', maxChars: null, block, factsUsed: [], ui: { path: path.split('ui:')[1], example: '예시 문장', why: 'example' } }))
      writeJ(join(dir, dirname(siteRel('v1')), '04-content.request.json'), { ...req, slots: [...req.slots, ...added] })
    }
  }
  const boardFile = join(cand, '09-revise', String(index), 'board.json')
  writeJ(boardFile, board)
  return { dir, cand, index, variant: 'v1', boardFile, before: { content, variants, direction }, variantData: board.variants[0] }
}
