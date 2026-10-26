// 구획 단위 수정(factory v1 Task 4.3 · 합의안 D13) — 「히어로를 더 대담하게」 같은 말 한 줄을 사상해 그 구획만 2안으로 다시 만들고, 전·후 보드 자료를 낸다.
//
//   parseRevision(text, site, design?)  → { scope: "section"|"copy", target, intent } | { scope: "design", classification, text } | 구조 요청(revise-structure.mjs) | { ask }
//     scope section  target = 섹션 키("<쪽>/<섹션>", 예 home/hero)   copy  target = 섹션 키.   구획 이름이 붙은 교체와 문구만 낱말로 사상한다.
//     intent: bolder(더 대담) · calmer(더 차분) · different(다르게 — 기본) · 문구는 shorter·warmer·formal 도. 크게·화려·단순·줄여·덜·많이 같은 말은 구획 이름이 있을 때만 구획 교체 의도다.
//     scope design   그 밖의 디자인 말. 사전 분류(vocab/classify.mjs)를 그대로 싣는다 — 확정이면 읽기, 후보 둘이면 두 해석, 근사·모름이면 revise() 가 되묻는다.
//                    CLI --revise-readings 는 분류 없이 { scope: "design", input: { readings } | { options }, text: null } 를 직접 만든다.
//     구조(구획 더하기·빼기·옮기기)·문구·디자인 중 어느 것으로도 사상하지 못하면(빈 말 · 문구인데 구획이 없음) {ask} — 짧은 질문 하나만 돌려주고 아무것도 바꾸지 않는다(Review Focus 4). 질문은 요청 언어로 80자 미만.
//   revise(runDir, candId, request, opts) → { index, boardFile, variants[{ id, block|say, diff, blockers, weight, qa, siteRel, previewUrl }], notes[] } | { boards: […] } | { ask }
//     section: 같은 섹션의 허용 변형 중 지금 것(사이트에 그려진 것·03 이 고른 것)을 뺀 상위 n(기본 2)개 — 03 과 같은 chooseVariants 순서(못 채움·누설·내린 블록·덜 쓰인 것·브리프 선호·올린 블록)에
//             선택 학습 가중치(4.4)를 동점 꼬리표로 더한다. 안마다 후보 폴더 사본에서 그 섹션만 바꿔 06 을 다시 돈다(지금 사이트·03·04 는 건드리지 않는다). 07 관문은 바뀐 쪽만(전역 섹션은 모든 쪽).
//     design:  읽기를 범위로 나눈다. site·element 범위 = 레시피 머리를 읽기대로 옮긴 안(planReadings, 구조 유지 — 섹션의 블록은 그대로) · section·page 범위 = 그 구획들의 블록 교체(sectionPlan 이 정한 뜻으로 구획마다 한 판).
//              사이트 전체와 구획·쪽 범위가 섞이면 되묻는다. 맞출 수 없으면 아무것도 만들지 않고 {ask} 로 되묻는다. 판(board.json)은 version 2 — readings·say·변형별 changes·before(지금 머리 요약)·why 가 더해진다.
//     copy:    04 문구 칸만 다시 요청한다 — 이 도구는 LLM 을 부르지 않는다: 요청 파일을 내고 멈춘다(status waiting-copy), 에이전트가 응답 파일을 쓴 뒤 같은 요청을 다시 돌리면 안을 만든다.
//     결과는 후보 폴더의 09-revise/<번호>/board.json — 전·후 보드가 읽는다. 안의 사이트 사본은 09-revise/<번호>/<안>/ 아래에 있고 previewUrl 은 배포를 하지 않으면 null 이다.
//   applyRevision(runDir, candId, index, variantId, opts) — 고른 안을 반영한다(입력 해시는 그대로, 06·07 은 낡음 표시). 판을 만든 뒤 그 갈래의 파일이 바뀌었으면(board.stateHash 가 다르면) 아무것도 바꾸지 않고 { outdated: true, index, text } 를 돌려준다: section = 03-variants(+선택 학습, 새 블록의 빈 화면 문구 칸은 04 요청에 싣고 waitingCopy) · design = 후보 레시피 머리 갈아 끼우기 · copy = 04 본문 칸 바꾸기.
//
//   무엇을 하지 않나: 지금 사이트(site/)·03·04 를 고치지 않는다(제안만으로 바뀌지 않는다) · 분석 서버·네트워크로 보내지 않는다 · 문구를 지어내지 않는다(새 블록의 화면 문구 칸은 비어 「예시 문구 남음」 blocker 로 보인다).
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { BLOCK_REGISTRY } from '../scripts/archetypes.mjs'
import { loadPreferences, recordPick, savePreferences, weightOf } from '../board/preferences.mjs'
import { bindCopy, UI_ROLE, uiNumberKind, validateContent } from './content.mjs'
import { generateSite } from './gen-pages.mjs'
import { titleOverAdvice } from './revise-picks.mjs'
import { nextSeq, restoreSnapshot, snapshot, stateHash, writeJson } from './revise-history.mjs'
import { STALE_STAGES, markStale } from './revise-stale.mjs'
import { chooseVariants } from './variants.mjs'
import { applyStructure, reviseStructure, STRUCTURE_SCOPES } from './revise-structure.mjs'
import { applyAxis, colorsOf, reviseHeads } from './revise-axis.mjs'
import { writeCompare } from './revise-compare.mjs'
import { recipeHeadOf } from './site-files.mjs'
import { designLexicon } from './design-context.mjs'
import { isPartScope, sectionNameOf, sectionPlan } from './section-plan.mjs'
import { fill } from '../vocab/fill.mjs'
import { askIn, grammar, langOf } from '../vocab/grammar.mjs'
import { leakTable, readinessTable, uiSlotTable } from './ui-copy.mjs'

// 나눈 모듈의 이름을 그대로 다시 내보낸다 — 시험·호출부는 이 파일에서 가져온다.
export { parseRevision } from './revise-parse.mjs'

// ── 파일 도우미 ──────────────────────────────────────────────────────────────

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const unwrap = (saved) => (isObj(saved) && 'inputHash' in saved && 'data' in saved ? saved.data : saved)
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const norm = (p) => p.split('\\').join('/')
function readStage(candDir, name) {
  const file = join(candDir, `${name}.json`)
  if (!existsSync(file)) throw new Error(`앞 단계 파일이 없다: ${file} — ${name} 단계를 먼저 돌린다`)
  return unwrap(readJson(file))
}
/** 단계 파일(래퍼)의 data 만 바꿔 쓴다 — 입력 해시는 그대로 둔다(run.step 이 같은 입력이면 이 data 를 읽는다). */
function patchStage(candDir, name, patch) {
  const file = join(candDir, `${name}.json`)
  const saved = readJson(file)
  if (isObj(saved) && 'inputHash' in saved && 'data' in saved) writeJson(file, { ...saved, data: patch(structuredClone(saved.data)) })
  else writeJson(file, patch(structuredClone(saved)))
}

const COPY_SKIP = new Set(['site', 'build', 'localreg', 'node_modules', '09-revise', '.next', 'add.log', 'build.log'])
/** 후보 폴더를 제안 사본으로 복사한다(무거운 산출물·이전 제안은 뺀다). 07-qa 는 법정 초안·검토 파일(legal)만 — 관문 결과는 사본에서 다시 만든다. */
function cloneCandidate(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (COPY_SKIP.has(e.name)) continue
    if (e.name === '07-qa') {
      if (existsSync(join(src, '07-qa', 'legal'))) cpSync(join(src, '07-qa', 'legal'), join(dest, '07-qa', 'legal'), { recursive: true })
      continue
    }
    cpSync(join(src, e.name), join(dest, e.name), { recursive: true })
  }
}

function listFiles(root) {
  const out = []
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.next-export') continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(join(d, e.name), r)
      else out.push(r)
    }
  }
  if (existsSync(root)) walk(root, '')
  return out
}
/** 두 사이트 폴더에서 내용이 다르거나 한쪽에만 있는 파일(상대 경로, 정렬). */
function changedFiles(baseDir, newDir) {
  const names = [...new Set([...listFiles(baseDir), ...listFiles(newDir)])].sort()
  return names.filter((n) => {
    const a = join(baseDir, n), b = join(newDir, n)
    if (!existsSync(a) || !existsSync(b)) return true
    return sha(readFileSync(a)) !== sha(readFileSync(b))
  })
}

// ── 블록 점수·순위 ───────────────────────────────────────────────────────────

let metaCache
const metas = () => {
  if (!metaCache) {
    const items = JSON.parse(readFileSync(BLOCK_REGISTRY, 'utf8')).items.filter((i) => i.type === 'registry:block' && i.meta?.kind)
    metaCache = new Map(items.map((i) => [i.name, i.meta]))
  }
  return metaCache
}
/** 「얼마나 대담한가」 어림 점수 — 움직임 기법 수 + 밀도(여유 +2·조밀 −1) + 전폭 제목 +1. 블록 메타만 읽는다. 모르는 블록은 0. */
export function boldScore(block) {
  const m = metas().get(block)
  if (!m) return 0
  return (m.motion?.length ?? 0) + (m.density === 'spacious' ? 2 : m.density === 'compact' ? -1 : 0) + (m.titleWidth === 'full' ? 1 : 0)
}

function findSection(sitemap, key) {
  if (key.startsWith('global/')) {
    const section = (sitemap.globals ?? []).find((g) => `global/${g.kind}` === key)
    return section ? { section, page: null } : { section: null, page: null }
  }
  for (const page of sitemap.pages) for (const section of page.sections) if (`${page.id}/${section.kind}` === key) return { section, page }
  return { section: null, page: null }
}

/**
 * 섹션 하나의 「지금 것을 뺀 상위 count개」. 03 의 chooseVariants 순서(못 채움·누설·내린 블록·브리프 선호·올린 블록 → 학습 가중치 → …)를 그대로 쓴다.
 * density(spacious|compact)는 여백만 말한 읽기의 뜻이다 — 블록 메타 density 가 같은 변형만 고른다. intent(bolder|calmer)는 지금 것보다 대담한/차분한 변형만 고른다. 함께 오면 둘 다 만족하는 변형이다.
 * 말한 방향의 변형이 모자라도 다른 방향의 변형으로 채우지 않는다 — 안이 적으면 그 까닭 한 줄을 why 에 싣는다(lang: ko|en).
 * @param {{ sitemap: object, key: string, head: string|object, exclude?: string[], count?: number, intent?: string, density?: string, current?: string, preferences?: object, readiness?: Map, leaks?: Map, seed?: number, lang?: 'ko'|'en' }} a
 * @returns {Promise<{ picks: string[], pool: string[], why: string|null }>}
 */
export async function rankSection({ sitemap, key, head, exclude = [], count = 2, intent = 'different', density, current, preferences, readiness, leaks, seed = 0, lang = 'ko' }) {
  const { section, page } = findSection(sitemap, key)
  if (!section || section.status !== 'block') throw new Error(`${key} 는 사이트맵의 블록 섹션이 아니다`)
  const pool = section.allowedVariants.filter((b) => !exclude.includes(b))
  const rd = readiness ?? (await readinessTable(pool))
  const lk = leaks ?? (await leakTable(sitemap))
  // 가장 좋은 변형 하나를 고르고, 그것을 뺀 나머지에서 또 하나 … — chooseVariants 의 순서(후보 하나일 때)를 그대로 쓴다.
  // 후보 여럿을 한 번에 주면 「덜 쓰인 것」 규칙이 못 채우는 변형까지 끌어와 같은 변형을 되풀이하게 둔다.
  const take = (blocks, k) => {
    const left = [...blocks]
    const out = []
    while (out.length < k && left.length) {
      const reduced = page
        ? { archetype: sitemap.archetype, pages: [{ ...page, sections: [{ ...section, allowedVariants: left }] }], globals: [] }
        : { archetype: sitemap.archetype, pages: [], globals: [{ ...section, allowedVariants: left }] }
      const best = chooseVariants(reduced, [{ id: 'r', recipe: head }], { seed, weights: [], readiness: rd, leaks: lk, preferences }).r[key]
      out.push(best)
      left.splice(left.indexOf(best), 1)
    }
    return out
  }
  let primary = pool
  if (density) primary = pool.filter((b) => metas().get(b)?.density === density)
  const directed = (intent === 'bolder' || intent === 'calmer') && current
  if (directed) {
    const cur = boldScore(current)
    primary = primary.filter((b) => (intent === 'bolder' ? boldScore(b) > cur : boldScore(b) < cur))
  }
  const picks = take(primary, count)
  const why = picks.length >= count ? null : density || directed ? fill(grammar.text.section.few[lang], { label: directionLabel({ intent, density }, lang), count: picks.length }) : fill(grammar.text.section.fewTotal[lang], { count: picks.length, total: section.allowedVariants.length })
  return { picks, pool, why }
}

/** 말한 방향의 이름(「더 대담한 쪽」 · 여백과 함께면 「더 여유로운 쪽 · 더 대담한 쪽」), 방향이 없으면 「다른 변형」. */
function directionLabel({ intent, density }, lang) {
  const names = [density, intent === 'bolder' || intent === 'calmer' ? intent : null].filter(Boolean)
  return (names.length ? names : ['different']).map((k) => grammar.text.section.label[k][lang]).join(' · ')
}

// ── 후보·사이트 읽기 ─────────────────────────────────────────────────────────

function loadContext(runDir, candId) {
  const candDir = join(runDir, candId)
  if (!existsSync(candDir)) throw new Error(`후보 폴더가 없다: ${candDir}`)
  const siteDir = join(candDir, 'site')
  const siteFile = join(siteDir, 'content', 'site.json')
  if (!existsSync(siteFile)) throw new Error(`사이트(06-pages)가 없다: ${siteFile} — 먼저 찍어내기를 06 까지 돌린다(npm run stamp -- --run ${runDir} --pick ${candId} --until 06)`)
  const dir01 = join(candDir, '01-direction.json')
  if (!existsSync(dir01)) throw new Error(`후보 정보가 없다: ${dir01}`)
  return {
    runDir, candId, candDir, siteDir, cand: readStage(candDir, '01-direction'),
    sitemap: readStage(candDir, '02-sitemap'), variants: readStage(candDir, '03-variants'), content: readStage(candDir, '04-content'),
    request: readJson(join(candDir, '04-content.request.json')), site: readJson(siteFile),
  }
}
const candidateBlockers = (candDir) => { const f = join(candDir, 'candidate.json'); return existsSync(f) ? readJson(f).blockers ?? [] : [] }

function nextIndex(candDir) {
  const dir = join(candDir, '09-revise')
  if (!existsSync(dir)) return 1
  const nums = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => Number(e.name))
  return (nums.length ? Math.max(...nums) : 0) + 1
}

/** 이 섹션이 영향을 주는 쪽(07 관문이 돌 쪽): 쪽 섹션은 그 쪽 하나, 전역 섹션은 모든 쪽. */
function routesFor(sitemap, key) {
  if (key.startsWith('global/')) return sitemap.pages.map((p) => p.route)
  const { page } = findSection(sitemap, key)
  return page ? [page.route] : []
}

/** 04 요청에서 섹션의 블록이 바뀐 만큼만 고친다 — 그 섹션 칸의 block, 옛 블록의 화면 문구 칸(ui:)은 빼고 새 블록의 것을 더한다. 새 칸의 문구는 비어 있다(지어내지 않는다). */
function patchRequestForBlock(request, key, block, uiLeaves) {
  // 옛 블록의 화면 문구 칸(ui:)은 그대로 둔다 — 문구 칸은 id 와 나온 차례로 04 문구와 짝지어지므로(bindCopy), 빼면 다른 쪽의 같은 id 칸이 한 칸씩 밀려 엉뚱한 문구를 읽는다.
  // 새 블록의 칸은 끝에 더한다(짝지을 문구가 없어 비어 있다). 옛 칸은 block 이 옛 블록이라 새 블록의 잎을 채우지 않는다.
  const slots = request.slots.map((s) => (s.path.startsWith(`${key}/`) && !s.ui ? { ...s, block } : s))
  const added = uiLeaves.map((leaf) => ({
    path: `${key}/ui:${leaf.path}`, id: `ui:${leaf.path}`, role: UI_ROLE(leaf.example), maxChars: null, block, factsUsed: [],
    ui: { path: leaf.path, example: leaf.example, why: leaf.why, ...(leaf.why === 'digits' ? { numbers: uiNumberKind(leaf.example) } : {}) },
  }))
  return { request: { ...request, slots: [...slots, ...added] }, needsCopy: added.map((s) => s.path) }
}

// ── 제안 하나 만들기 ─────────────────────────────────────────────────────────

async function buildProposal({ ctx, index, vid, cand, mutate, opts, routes }) {
  const scratchRun = join(ctx.candDir, '09-revise', String(index), vid, basename(resolve(ctx.runDir)))
  const scratchCand = join(scratchRun, ctx.candId)
  rmSync(join(ctx.candDir, '09-revise', String(index), vid), { recursive: true, force: true })
  cloneCandidate(ctx.candDir, scratchCand)
  mutate(scratchCand)
  const install = opts.install !== false
  const generate = opts.generate ?? generateSite
  const result = await generate(scratchRun, cand, { install, build: opts.build ?? install, log: opts.log ?? (() => {}) })
  const siteDir = join(scratchCand, 'site')
  let qa = null
  if (opts.runGates ?? install) {
    const run = opts.qa ?? (async (...a) => (await import('./qa.mjs')).runCandidateQa(...a))
    const r = await run(scratchRun, cand, { routes })
    qa = { ran: true, routes, publishable: r.publishable === true, blockers: r.blockers ?? [], gates: (r.gates ?? []).map((g) => ({ id: g.id, verdict: g.verdict, exit: g.exit, toolFailure: g.toolFailure })) }
  }
  const baseBlockers = candidateBlockers(ctx.candDir)
  const newBlockers = candidateBlockers(scratchCand)
  return {
    siteDir, siteRel: norm(join(ctx.candId, '09-revise', String(index), vid, basename(resolve(ctx.runDir)), ctx.candId, 'site')),
    newSite: readJson(join(siteDir, 'content', 'site.json')), result, qa,
    blockers: newBlockers.filter((b) => !baseBlockers.includes(b)), blockersRemoved: baseBlockers.filter((b) => !newBlockers.includes(b)),
    files: changedFiles(ctx.siteDir, siteDir).map(norm),
  }
}

const sectionsChanged = (a, b) => [...new Set([...Object.keys(a.sections ?? {}), ...Object.keys(b.sections ?? {})])].filter((k) => JSON.stringify(a.sections?.[k]) !== JSON.stringify(b.sections?.[k])).sort()

// ── revise ───────────────────────────────────────────────────────────────────

/**
 * @param {string} runDir  찍어내기 실행 폴더
 * @param {string} candId  후보(a·b·c)
 * @param {ReturnType<typeof parseRevision> & { text?: string }} request  parseRevision 결과(원문 text 를 얹으면 보드에 남는다)
 * @param {{ n?: number, install?: boolean, build?: boolean, runGates?: boolean, qa?: Function, generate?: Function, preferences?: object, preferencesFile?: object, now?: () => string, log?: Function }} [opts]
 *   n: 안 개수(기본 2, 최대 3) · install: false 면 설치·빌드·07 관문 없이 파일만(시험·미리보기 없는 확인용) · preferences: 학습(없으면 씨앗+사용자 파일을 읽는다)
 */
export async function revise(runDir, candId, request, opts = {}) {
  if (request?.ask) return { ask: request.ask }
  if (!request?.scope) throw new Error('revise: 요청에 scope 가 없다 — parseRevision 결과를 넘긴다')
  const n = Math.min(3, Math.max(1, opts.n ?? 2))
  const now = opts.now ?? (() => new Date().toISOString())
  const ctx = loadContext(runDir, candId)
  const prefs = opts.preferences ?? loadPreferences(opts.preferencesFile ?? {})
  const archetype = ctx.sitemap.archetype
  const text = request.text ?? null

  if (STRUCTURE_SCOPES.includes(request.scope)) return reviseStructure({ ctx, request, n, opts, prefs, now, text, tools: structureTools() })
  if (request.scope === 'section') return reviseSection({ ctx, request, n, opts, prefs, archetype, now, text })
  if (request.scope === 'design') return reviseDesign({ ctx, request, n, opts, prefs, archetype, now, text })
  if (request.scope === 'copy') return reviseCopy({ ctx, request, n, opts, now, text })
  throw new Error(`revise: 모르는 scope ${request.scope}`)
}

function boardBase({ ctx, request, index, now, text, status }) {
  return { kind: 'revise-board', version: 1, index, candidate: ctx.candId, request: text, scope: request.scope, target: request.target, intent: request.intent, status, createdAt: now(), stateHash: stateHash(ctx.candDir) }
}

/**
 * 구획 하나의 블록 교체 안. design = 디자인 읽기에서 왔을 때만 { plans, readings, say } — plans 는 이 구획에 닿는 읽기 묶음마다 하나(보통 하나, 후보 둘이면 둘)의
 * { intent?, density?, say, readings } 이고, 둘이면 안마다 자기 뜻으로 하나씩 고른다. 이때 판은 version 2 로 readings·say·변형별 say·changes({ axis: 사전 축 id, section, from, to })를 더한다.
 */
async function reviseSection({ ctx, request, n, opts, prefs, archetype, now, text, design }) {
  const key = request.target
  const { section } = findSection(ctx.sitemap, key)
  if (!section || section.status !== 'block') throw new Error(`${key} 는 블록으로 그리는 구획이 아니다(블록 섹션: ${Object.keys(ctx.site.sections).join(', ')})`)
  const rendered = ctx.site.sections[key]?.block ?? null
  const chosen = ctx.variants[key] ?? null
  const exclude = [rendered ?? chosen].filter(Boolean) // 지금 눈에 보이는 변형 — 03 이 고른 것이 06 폴백으로 안 그려졌다면 그것은 아직 못 본 대안이다
  const plans = design?.plans ?? [{ intent: request.intent }]
  const lang = langOf(text)
  const rank = (more) => rankSection({ sitemap: ctx.sitemap, key, head: ctx.cand.recipe, current: rendered ?? chosen, preferences: prefs, seed: opts.seed ?? 0, lang, ...more })
  const ranked = { picks: [], planOf: [], why: null } // planOf[i] = i 번째 안을 낸 plans 칸
  for (const [p, plan] of plans.entries()) { // 후보 둘 — 안마다 자기 뜻으로 하나씩, 앞 안과 겹치지 않게. 해석이 하나면 그 해석이 n 안을 낸다
    const one = await rank({ exclude: [...exclude, ...ranked.picks], count: plans.length === 1 ? n : 1, ...plan })
    ranked.picks.push(...one.picks)
    ranked.planOf.push(...one.picks.map(() => p))
    ranked.why ??= one.why
  }
  if (!ranked.picks.length) return { ask: fill(grammar.text.section.none[lang], { section: sectionNameOf(key, designLexicon(), lang), label: directionLabel(plans[0], lang) }) }
  const notes = []
  const index = nextIndex(ctx.candDir)
  const routes = routesFor(ctx.sitemap, key)
  const variants = []
  for (const [i, block] of ranked.picks.entries()) {
    const vid = `v${i + 1}`
    const uiLeaves = (await uiSlotTable([block], { locale: ctx.request?.locale === 'en' ? 'en' : 'ko' })).get(block) ?? []
    const patch = patchRequestForBlock(ctx.request, key, block, uiLeaves)
    const p = await buildProposal({
      ctx, index, vid, cand: ctx.cand, opts, routes,
      mutate: (candDir) => {
        patchStage(candDir, '02-sitemap', (sm) => {
          const { section: s } = findSection(sm, key)
          s.allowedVariants = [block] // 06 이 이 안을 다른 변형으로 슬쩍 바꾸지 못하게 — 비어 있는 화면 문구는 blocker 로 보인다
          return sm
        })
        patchStage(candDir, '03-variants', (v) => ({ ...v, [key]: block }))
        writeJson(join(candDir, '04-content.request.json'), patch.request)
      },
    })
    const changed = sectionsChanged(ctx.site, p.newSite)
    // 지금 04 문구(제목)로 이 안이 06 에서 살아남는지 미리 본다 — 안은 이 블록 하나로 못 박아 만들어서(위) 06 폴백이 안 보이지만, 고른 뒤 실제 찍어내기에서는
    // 제목이 이 블록의 길이 상한을 넘으면 같은 섹션의 다른 변형으로 바뀐다. 조용히 내지 않고 안마다 알린다(FIT-5).
    const over = (p.result?.titleOverflow ?? []).find((t) => t.key === key && t.block === block) ?? null
    const warnings = over ? [titleOverAdvice(over)] : []
    for (const w of warnings) notes.push(`${vid} ${block}: ${w}`)
    variants.push({
      id: vid, block, label: `${vid} ${block}`, ...(design ? { say: plans[ranked.planOf[i]].say, changes: plans[ranked.planOf[i]].readings.map((r) => ({ axis: r.axis, section: key, from: rendered ?? '', to: block })) } : {}),
      diff: { kind: 'section', key, from: rendered, to: block, sections: changed, files: p.files, blockersAdded: p.blockers, blockersRemoved: p.blockersRemoved, needsCopy: patch.needsCopy, ...(over ? { titleOverflow: over } : {}) },
      blockers: p.blockers, ...(warnings.length ? { warnings } : {}), weight: weightOf(prefs, archetype, block), qa: p.qa, siteRel: p.siteRel, previewUrl: null,
    })
  }
  const status = variants.length ? 'ready' : 'empty'
  const color = design ? colorsOf(recipeHeadOf(ctx.cand)) : null // 구획 교체는 색을 바꾸지 않는다 — 지금 색을 안에도 같이 실어 견본이 나오지 않게 한다(색이 같음)
  const board = { ...boardBase({ ctx, request, index, now, text, status }), ...(design ? { version: 2, readings: design.readings, say: design.say, ...(plans.some((p) => p.density) ? { density: plans.find((p) => p.density).density } : {}) } : {}), route: routes.length === 1 ? routes[0] : null, routes, before: { block: rendered, chosen, blockers: candidateBlockers(ctx.candDir), ...(design ? { head: { color } } : {}) }, variants: design ? variants.map((v) => ({ ...v, colors: color })) : variants, ...(ranked.why ? { why: ranked.why } : {}), notes, picked: null }
  const boardFile = join(ctx.candDir, '09-revise', String(index), 'board.json')
  writeJson(boardFile, board)
  if (design) writeCompare(dirname(boardFile), board, designLexicon())
  return { index, boardFile, scope: 'section', target: key, intent: request.intent, status, variants, notes, ...(ranked.why ? { why: ranked.why } : {}), ...(design ? { say: design.say } : {}) }
}

// ── 디자인 읽기 ──────────────────────────────────────────────────────────────

/** 요청 → 읽기 입력({ readings } | { options } | { copyFrom }) 또는 되물음. 분류가 시안 비교 말이면 copyFrom, 확정이면 읽기, 후보 둘이면 두 해석이고, 근사·모름은 되묻는다. */
function designInput(request) {
  if (request.input) return request.input
  const c = request.classification
  if (c.copyFrom !== undefined) return { copyFrom: c.copyFrom }
  if (c.result === 'confirmed') return { readings: c.readings }
  if (c.result === 'two') return { options: c.options.map((o) => ({ readings: o.readings })) }
  return { ask: c.ask }
}

/**
 * 디자인 읽기 수정. site·element 범위 읽기는 레시피 머리를 옮긴 안(reviseHeads), section·page 범위 읽기는 그 구획들의 블록 교체(구획마다 한 판)다. 둘이 섞이면 되묻는다.
 * 구획이 여럿이면 { boards: […] } — 구획마다 판 번호가 따로다.
 */
async function reviseDesign({ ctx, request, n, opts, prefs, archetype, now, text }) {
  const input = designInput(request)
  if (input.ask) return { ask: input.ask }
  const lists = input.copyFrom !== undefined ? [] : input.readings ? [input.readings] : input.options.map((o) => o.readings) // 시안 따라 하기({ copyFrom })는 읽기가 없다 — 사이트 전체 안이다
  const parts = lists.flat().filter(isPartScope)
  if (!parts.length) return reviseHeads({ ctx, input, n, opts, now, text, tools: axisTools() })
  if (parts.length < lists.flat().length) return { ask: askIn(grammar.text.ask.oneKindAtATime, text) }
  const planned = lists.map((list) => ({ list, plan: sectionPlan(list, { lex: designLexicon(), site: ctx.site, lang: langOf(text) }) }))
  const asked = planned.find((p) => p.plan.ask)
  if (asked) return asked.plan
  const isBlock = (k) => findSection(ctx.sitemap, k).section?.status === 'block' // 블록으로 그리지 않는 구획은 바꿀 블록이 없다
  const keys = [...new Set(planned.flatMap((p) => p.plan.keys))].filter(isBlock)
  if (!keys.length) return { ask: grammar.text.plan.noSection }
  const made = []
  for (const key of keys) { // 해석마다 자기 구획만 — 구획 하나에는 그 구획에 닿는 해석들만 안이 된다
    const mine = planned.filter((p) => p.plan.keys.includes(key))
    const design = {
      plans: mine.map(({ list, plan }) => ({ intent: plan.intent, density: plan.density, say: plan.say, readings: list.filter((r) => !r.cap && r.strength > 0) })),
      readings: mine.flatMap((p) => p.list), say: mine.map((p) => p.plan.say).join(' / '),
    }
    made.push(await reviseSection({ ctx, request: { scope: 'section', target: key, intent: mine[0].plan.intent ?? 'different' }, n, opts, prefs, archetype, now, text, design }))
  }
  const [skipped, ready] = [made.filter((b) => b.ask), made.filter((b) => !b.ask)] // 말한 방향의 변형이 없는 구획은 판을 만들지 않는다 — 모두 없으면 그 되물음
  if (!ready.length) return skipped[0]
  const boards = ready.map((b, i) => (i === 0 && skipped.length ? { ...b, notes: [...b.notes, ...skipped.map((s) => s.ask)] } : b)) // 빠진 구획은 첫 판의 참고로 알린다
  return boards.length === 1 ? boards[0] : { boards }
}

// ── 문구 ─────────────────────────────────────────────────────────────────────

const COPY_INSTRUCTION = {
  shorter: '지금 문구보다 짧게(글자 수를 줄이되 사실은 그대로)', warmer: '더 친근하고 따뜻한 말투로', formal: '더 정중하고 격식 있는 말투로', different: '지금과 다른 표현으로(뜻과 사실은 그대로)',
  bolder: '더 힘 있고 분명한 표현으로', calmer: '더 차분한 표현으로',
}
const sameRequest = (b, request, text) => b.scope === request.scope && b.target === request.target && b.intent === request.intent && (b.request ?? null) === (text ?? null)

async function reviseCopy({ ctx, request, n, opts, now, text }) {
  const key = request.target
  const slots = ctx.request.slots.filter((s) => s.path.startsWith(`${key}/`))
  if (!slots.length) throw new Error(`${key} 에는 다시 쓸 문구 칸이 없다`)
  const dir09 = join(ctx.candDir, '09-revise')
  // 같은 요청의 대기 중인 보드가 있으면 이어서 한다(같은 명령을 다시 돌리는 흐름)
  let index = null
  if (existsSync(dir09)) {
    for (const e of readdirSync(dir09, { withFileTypes: true })) {
      const f = join(dir09, e.name, 'board.json')
      if (e.isDirectory() && existsSync(f)) { const b = readJson(f); if ((b.status === 'waiting-copy' || b.status === 'invalid-copy') && sameRequest(b, request, text)) index = Number(e.name) }
    }
  }
  const fresh = index === null
  index ??= nextIndex(ctx.candDir)
  const revDir = join(dir09, String(index))
  const boardFile = join(revDir, 'board.json')
  const requestFile = join(revDir, 'copy.request.json')
  const responseFile = join(revDir, 'copy.response.json')
  const bound = bindCopy(ctx.request, ctx.content)
  const routes = routesFor(ctx.sitemap, key)
  const base = { ...boardBase({ ctx, request, index, now, text, status: 'waiting-copy' }), route: routes.length === 1 ? routes[0] : null, routes, before: { texts: Object.fromEntries(slots.map((s) => [s.path, bound.get(s.path)?.entry?.text ?? null])), blockers: candidateBlockers(ctx.candDir) } }

  if (fresh) {
    writeJson(requestFile, {
      kind: 'revise-copy-request', version: 1, candidate: ctx.candId, target: key, intent: request.intent, request: text, instruction: COPY_INSTRUCTION[request.intent] ?? COPY_INSTRUCTION.different,
      guide: 'factory/stamp/COPY.md', voice: ctx.request.voice, placeholder: ctx.request.placeholder, checks: ctx.request.checks, facts: ctx.request.facts,
      want: n, output: responseFile, shape: { variants: Array.from({ length: n }, () => ({ texts: { '<칸 경로>': '새 문구' } })) },
      slots: slots.map((s) => ({ path: s.path, id: s.id, role: s.role, maxChars: s.maxChars, ...(s.ui ? { ui: s.ui } : {}), current: bound.get(s.path)?.entry?.text ?? null })),
    })
    writeJson(boardFile, { ...base, variants: [], notes: [], picked: null, waiting: { requestFile: norm(join(ctx.candId, '09-revise', String(index), 'copy.request.json')), output: norm(join(ctx.candId, '09-revise', String(index), 'copy.response.json')) } })
  }
  if (!existsSync(responseFile)) {
    return { index, boardFile, scope: 'copy', target: key, intent: request.intent, status: 'waiting-copy', variants: [], notes: ['문구는 에이전트가 쓴다 — 요청 파일을 내고 멈춘다'], waiting: { requestFile, output: responseFile } }
  }

  // 응답 검사 → 안 만들기
  let response
  try { response = readJson(responseFile) } catch (e) { return invalidCopy({ index, boardFile, base, key, request, problems: [`copy.response.json 을 읽지 못했다: ${e.message}`] }) }
  const list = Array.isArray(response?.variants) ? response.variants.slice(0, n) : []
  const problems = []
  const existing = new Set(validateContent(ctx.request, ctx.content))
  if (!list.length) problems.push('variants 가 비었다')
  const patched = list.map((v, vi) => {
    const content = structuredClone(ctx.content)
    const copy = Array.isArray(content.slots?.copy) ? content.slots.copy : []
    for (const [path, newText] of Object.entries(v?.texts ?? {})) {
      const hit = bound.get(path)
      if (!hit || !path.startsWith(`${key}/`)) { problems.push(`v${vi + 1}: 모르는 칸 ${path} (이 요청의 칸: ${slots.map((s) => s.path).join(', ')})`); continue }
      const i = ctx.content.slots.copy.indexOf(hit.entry)
      copy[i] = { ...copy[i], text: String(newText) }
    }
    for (const p of validateContent(ctx.request, content)) if (!existing.has(p)) problems.push(`v${vi + 1}: ${p}`) // 이 수정이 새로 만든 문제만 막는다 — 04 에 원래 있던 문제는 04 단계가 다룬다
    return content
  })
  if (problems.length) return invalidCopy({ index, boardFile, base, key, request, problems })

  const variants = []
  for (const [i, content] of patched.entries()) {
    const vid = `v${i + 1}`
    const p = await buildProposal({
      ctx, index, vid, cand: ctx.cand, opts, routes,
      mutate: (candDir) => patchStage(candDir, '04-content', () => content),
    })
    const changed = sectionsChanged(ctx.site, p.newSite)
    const after = Object.fromEntries(Object.keys(response.variants[i].texts ?? {}).map((path) => [path, content.slots.copy[ctx.content.slots.copy.indexOf(bound.get(path).entry)].text]))
    variants.push({
      id: vid, label: `${vid} 문구`, texts: after,
      diff: { kind: 'copy', key, before: Object.fromEntries(Object.keys(after).map((path) => [path, bound.get(path).entry.text])), after, sections: [...new Set([key, ...changed])].sort(), files: p.files, blockersAdded: p.blockers, blockersRemoved: p.blockersRemoved }, // 섹션 props 는 문구를 $ref 로만 가리켜 안 바뀐다 — 그래도 보이는 글이 바뀌는 구획은 이 섹션이다
      blockers: p.blockers, weight: 1, qa: p.qa, siteRel: p.siteRel, previewUrl: null,
    })
  }
  const board = { ...base, status: 'ready', variants, notes: [], picked: null }
  writeJson(boardFile, board)
  return { index, boardFile, scope: 'copy', target: key, intent: request.intent, status: 'ready', variants, notes: [] }
}

function invalidCopy({ index, boardFile, base, key, request, problems }) {
  writeJson(boardFile, { ...base, status: 'invalid-copy', variants: [], notes: [], picked: null, problems })
  return { index, boardFile, scope: 'copy', target: key, intent: request.intent, status: 'invalid-copy', variants: [], notes: [], problems }
}

// ── 고르기 ───────────────────────────────────────────────────────────────────

export { STALE_STAGES }

/** 안의 사이트 사본이 있는 후보 폴더(09-revise/<번호>/<안>/<실행 이름>/<후보>) — revise 가 안마다 만든 사본이고 그 안에 임시 레시피 머리·04 요청 사본이 있다. */
const proposalDir = (runDir, v) => (v.siteRel ? join(runDir, dirname(v.siteRel)) : null)

/**
 * 고른 안을 반영한다.
 *   section  03-variants 에 쓴다. 새 블록이 비워 둔 화면 문구 칸(diff.needsCopy)이 있으면 04-content.request.json 에 그 요청을 싣고(`pendingSlots`) 결과에 waitingCopy 를 둔다.
 *   axis     안의 임시 레시피 머리(<안 사본>/recipe/DESIGN.md)를 후보 폴더 recipe/DESIGN.md 로 옮기고, 01-direction 의 후보 칸을 source "brand"·새 레시피 머리로 고친다.
 *   copy     안의 문구(texts)를 04-content 의 해당 칸에 쓴다 — 칸 경로가 04 에 없거나 콘텐츠 검사가 이 수정으로 새 문제를 내면 쓰지 않고 던진다.
 * 세 갈래 모두 단계 파일의 입력 해시는 그대로라 같은 --run 으로 다시 돌려도 이 선택이 남고, 06·07 은 낡음 표시가 된다. 던질 때는 아무것도 바꾸지 않는다(고른 안 표시도 없다).
 * section 선택은 학습에 기록한다(이긴 변형 = 고른 블록, 진 변형 = 지금 블록과 다른 안들).
 * @param {{ seedFile?: string, userFile?: string, now?: () => string }} [opts]
 */
export async function applyRevision(runDir, candId, index, variantId, opts = {}) {
  const candDir = join(runDir, candId)
  const boardFile = join(candDir, '09-revise', String(index), 'board.json')
  if (!existsSync(boardFile)) throw new Error(`09-revise/${index} 보드가 없다: ${boardFile}`)
  const board = readJson(boardFile)
  if (board.picked) throw new Error(`09-revise/${index} 는 이미 골랐다(${board.picked.id})`)
  if (board.status !== 'ready') throw new Error(`09-revise/${index} 는 아직 고를 수 없다(상태 ${board.status})`)
  const v = board.variants.find((x) => x.id === variantId)
  if (!v) throw new Error(`09-revise/${index} 에 안 ${variantId} 가 없다(안: ${board.variants.map((x) => x.id).join(', ')})`)
  if (board.stateHash !== stateHash(candDir)) return { outdated: true, index, text: board.request ?? null } // 안을 만든 뒤 이 갈래의 파일이 바뀌었다(다른 안을 골랐거나 되돌렸다) — 낡은 안은 그 사이 바뀐 것을 덮어쓰므로 아무것도 바꾸지 않는다
  const at = (opts.now ?? (() => new Date().toISOString()))()
  const base = { index, id: v.id, scope: board.scope, applied: true, stale: [...STALE_STAGES] }
  snapshot(runDir, candId, index) // 적용 전 상태를 둔다 — 「되돌려」가 이것으로 되살린다
  let result
  try {
    if (board.scope === 'section') result = applySection({ runDir, candDir, board, v, opts })
    else if (board.scope === 'design') result = applyAxis({ runDir, candDir, v, tools: axisTools() })
    else if (board.scope === 'copy') result = applyCopy({ candDir, v })
    else if (STRUCTURE_SCOPES.includes(board.scope)) result = await applyStructure({ candDir, board, v, opts })
    else throw new Error(`09-revise/${index}: 모르는 수정 갈래 ${board.scope}`)
  } catch (e) {
    restoreSnapshot(candDir, index) // 쓰다 만 파일을 보관해 둔 처음 상태로 되돌린 뒤 던진다
    throw e
  }
  const { learnedPicks, ...shown } = result
  markStale(candDir, index)
  writeJson(boardFile, { ...board, picked: { id: v.id, ...(v.block ? { block: v.block } : {}), at, seq: nextSeq(candDir), ...(learnedPicks ? { learned: learnedPicks } : {}) } })
  return { ...base, ...shown }
}

function applySection({ runDir, candDir, board, v, opts }) {
  const sitemap = readStage(candDir, '02-sitemap')
  const prefs = loadPreferences({ ...(opts.seedFile ? { seedFile: opts.seedFile } : {}), ...(opts.userFile ? { userFile: opts.userFile } : {}) })
  let next = prefs
  const losers = [...new Set([board.before.block, ...board.variants.filter((x) => x.id !== v.id).map((x) => x.block)].filter((b) => b && b !== v.block))]
  for (const loser of losers) next = recordPick(next, { archetype: sitemap.archetype, winner: v.block, loser, kind: 'section' })
  // 새 블록의 빈 화면 문구 칸 요청 — 안의 04 요청 사본(새 칸이 끝에 붙은 것)을 후보의 04 요청으로 싣는다. 03 을 고치기 전에 읽어 둔다(없으면 던진다).
  const needs = v.diff?.needsCopy ?? []
  let waitingCopy
  const requestFile = join(candDir, '04-content.request.json')
  let request = null
  if (needs.length) {
    const copyOfProposal = proposalDir(runDir, v) && join(proposalDir(runDir, v), '04-content.request.json')
    request = { ...readJson(copyOfProposal && existsSync(copyOfProposal) ? copyOfProposal : requestFile), pendingSlots: needs }
  }
  patchStage(candDir, '03-variants', (vars) => ({ ...vars, [board.target]: v.block }))
  savePreferences(next, opts.userFile ? { userFile: opts.userFile } : {})
  if (request) { writeJson(requestFile, request); waitingCopy = requestFile }
  const warnings = v.warnings ?? [] // 제안 때 본 「지금 제목으로는 이 디자인이 적용되지 않는다」(FIT-5) — 고를 때도 다시 알린다
  return { block: v.block, target: board.target, learned: losers.length, ...(losers.length ? { learnedPicks: { archetype: sitemap.archetype, winner: v.block, losers, kind: 'section' } } : {}), ...(warnings.length ? { warnings } : {}), ...(waitingCopy ? { waitingCopy } : {}), next: waitingCopy ? `새 블록의 화면 문구 칸 ${needs.length}개가 비어 있다 — 문구 에이전트가 ${waitingCopy} 의 pendingSlots 를 factory/stamp/COPY.md 대로 채운 04-content.json 을 쓴 뒤 같은 --run 으로 찍어내기를 다시 돌린다` : `같은 --run 으로 찍어내기를 다시 돌린다 — 06·07 은 그 입력이 바뀌어 다시 돈다` }
}

function applyCopy({ candDir, v }) {
  const texts = v.texts ?? v.diff?.after ?? {}
  const paths = Object.keys(texts)
  if (!paths.length) throw new Error(`안 ${v.id} 에 바꿀 문구가 없다`)
  const file = join(candDir, '04-content.json')
  const saved = readJson(file)
  const wrapped = isObj(saved) && 'inputHash' in saved && 'data' in saved
  const old = wrapped ? saved.data : saved
  const request = readJson(join(candDir, '04-content.request.json'))
  const content = structuredClone(old)
  const bound = bindCopy(request, content)
  const copy = content.slots?.copy
  for (const path of paths) {
    const hit = bound.get(path)
    if (!hit) throw new Error(`문구 칸 ${path} 가 04-content 에 없다(04 의 칸: ${[...bound.keys()].slice(0, 8).join(', ')}…) — 아무것도 바꾸지 않았다`)
    const i = copy.indexOf(hit.entry)
    copy[i] = { ...copy[i], text: String(texts[path]) }
  }
  // 쓰기 전에 콘텐츠 검사(스키마·문체·글자 수·예시 표지)를 다시 돈다 — 이 수정이 새로 만든 문제만 막는다(04 에 원래 있던 문제는 04 단계가 다룬다).
  const had = new Set(validateContent(request, old))
  const problems = validateContent(request, content).filter((p) => !had.has(p))
  if (problems.length) throw new Error(`바뀐 문구가 콘텐츠 검사를 통과하지 못한다 — 04 는 그대로다: ${problems.slice(0, 4).join(' | ')}`)
  writeJson(file, wrapped ? { ...saved, data: content } : content)
  return { target: paths.length === 1 ? paths[0] : v.diff?.key ?? paths[0], texts, learned: 0, next: '같은 --run 으로 찍어내기를 다시 돌린다 — 04 는 입력 해시가 그대로라 이 문구가 남고, 06·07 은 바뀐 문구로 다시 돈다' }
}

// ── 구획 구조 조작(revise-structure.mjs)에 넘기는 내부 도우미 ─────────────────────────────────────────────────────────
// 본체는 새 모듈이다. 이 파일의 제안 사본 도우미를 순환 import 없이 쓰게 호출 때 묶어 넘긴다.
function structureTools() {
  return { buildProposal, nextIndex, routesFor, boardBase, candidateBlockers, sectionsChanged, rankSection }
}

// 디자인 읽기 수정(revise-axis.mjs)에 넘기는 내부 도우미 — 같은 이유로 호출 때 묶어 넘긴다.
function axisTools() {
  return { buildProposal, nextIndex, boardBase, candidateBlockers, sectionsChanged, writeJson, proposalDir, patchStage, readStage }
}
