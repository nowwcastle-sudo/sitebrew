// 결선 기록(J8, P3-3 Task 12): 방향 보드에서 운영자가 고른 것을 factory/board/pairs.jsonl 에 남기고, 「라이브러리로 올리기」가 눌린 후보를 승격한다.
//   node factory/board/direction-board/record.mjs <run> (--doc <picks 문서.json> | --pick a [--promote b,c]) [--archetype X --brief 「…」] [--date YYYY-MM-DD] [--prune]
//   picks 문서 = 보드가 db 컬렉션 `picks` 에 저장한 문서 { run, board, pick, promote: { b: true }, note?, decidedAt } — 컨트롤러가 읽어 파일로 넘긴다.
// 한 줄(J8): { a, b, winner, archetype, brief, date, sourceA, sourceB, promote? }
//   · 3안에서 하나를 고르면 고른 것이 나머지 각각을 이긴 것으로 적는다(고른 것 × 진 것 = 2줄). 짝은 칸 순서(a·b·c 폴더 이름 순)로 a·b 를 정한다.
//   · a·b = 그 안의 레시피 이름: 라이브러리는 레시피 id, 생성·브랜드는 임시 레시피 id(x-<run>-<후보>) — 실행 폴더로 거슬러 갈 수 있다.
//   · winner = "a" | "b". sourceA·sourceB = "library" | "generated" | "brand".
//   · promote = 그 줄의 "a" | "b" 쪽 후보를 라이브러리로 올렸다. 후보마다 정확히 한 줄에 싣는다(한 줄에 둘을 싣지 못하므로 그 후보가 든 다른 줄로 옮긴다).
// 승격은 결선 줄을 쓰기 전에 모두 끝낸다. 올릴 후보는 먼저 전부 검사(promoteCandidate dryRun)하니 하나라도 거절되면 초안도 줄도 쓰지 않는다.
// 다시 돌려도 안전하다: 이미 올린 후보는 건너뛰고(`already`), 같은 줄이 이미 있으면 다시 쓰지 않는다.
// 탈락 후보의 build/ 정리(대장 C84): --prune 을 줄 때만, 고르지도 올리지도 않은 생성·브랜드 후보의 build/ 를 지운다(recipe/DESIGN.md 가 남아 있어 다시 컴파일할 수 있을 때만).
import { existsSync, readFileSync, readdirSync, rmSync, appendFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { promoteCandidate, readCandidateHead, promotedAs, originOf, resolveRun, PromoteError, PAIRS_FILE } from '../promote.mjs'
import { RECIPES_DIR } from '../../scripts/recipe.mjs'
import { tmpRecipeId } from '../../stamp/compile-candidate.mjs'

const SOURCES = ['library', 'generated', 'brand']
export const PairRow = z.object({
  a: z.string().min(1), b: z.string().min(1), winner: z.enum(['a', 'b']),
  archetype: z.string().min(1), brief: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceA: z.enum(SOURCES), sourceB: z.enum(SOURCES), promote: z.enum(['a', 'b']).optional(),
}).strict()

/** pairs.jsonl 읽기 — 줄마다 모양을 검사한다(깨진 줄은 줄 번호와 함께 던진다). 파일이 없으면 빈 목록. */
export function readPairs(file = PAIRS_FILE) {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split(/\r?\n/).map((l, i) => [l, i + 1]).filter(([l]) => l.trim()).map(([l, n]) => {
    try { return PairRow.parse(JSON.parse(l)) } catch (e) { throw new Error(`${file} ${n}째 줄이 결선 기록 모양이 아니다: ${e.message}`) }
  })
}

/** 후보 폴더 목록(candidate.json 이 있는 하위 폴더, 이름순 = 칸 순서). */
export function loadCandidates(runDir) {
  return readdirSync(runDir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(runDir, d.name, 'candidate.json'))).map((d) => d.name).sort()
    .map((id) => {
      const c = readCandidateHead(join(runDir, id))
      if (!SOURCES.includes(c.source)) throw new Error(`후보 ${id}: source 가 library·generated·brand 가 아니다(${JSON.stringify(c.source)})`)
      const name = c.source === 'library' ? (typeof c.recipe === 'string' ? c.recipe : c.recipe?.id) : tmpRecipeId(runDir, id)
      if (!name) throw new Error(`후보 ${id}: 레시피 이름을 알 수 없다`)
      return { id, source: c.source, name }
    })
}

/**
 * 고른 것 → 결선 줄들. promote: { <후보 id>: true }. 올릴 후보는 생성·브랜드여야 한다.
 * @returns {object[]}
 */
export function pairRows(cands, { pick, promote = {}, archetype, brief, date }) {
  const byId = new Map(cands.map((c) => [c.id, c]))
  if (!byId.has(pick)) throw new Error(`고른 후보 ${JSON.stringify(pick)} 가 후보 목록(${cands.map((c) => c.id).join('·')})에 없다`)
  const up = Object.keys(promote).filter((k) => promote[k])
  for (const k of up) {
    if (!byId.has(k)) throw new Error(`올릴 후보 ${JSON.stringify(k)} 가 후보 목록에 없다`)
    if (byId.get(k).source === 'library') throw new Error(`후보 ${k} 는 라이브러리 안이라 올리지 않는다 — 생성·브랜드 안만 올린다`)
  }
  const order = (x) => cands.findIndex((c) => c.id === x)
  const rows = cands.filter((c) => c.id !== pick).map((loser) => {
    const [first, second] = [byId.get(pick), loser].sort((p, q) => order(p.id) - order(q.id))
    return { a: first.name, b: second.name, winner: first.id === pick ? 'a' : 'b', archetype, brief, date, sourceA: first.source, sourceB: second.source, _ids: [first.id, second.id] }
  })
  // 후보마다 한 줄에만 promote — 그 후보가 든 줄 가운데 아직 promote 가 비어 있는 첫 줄.
  for (const k of up) {
    const row = rows.find((r) => r._ids.includes(k) && !r.promote)
    if (!row) throw new Error(`올릴 후보 ${k} 를 싣을 결선 줄이 모자란다(후보 ${cands.length}개)`)
    row.promote = row._ids[0] === k ? 'a' : 'b'
  }
  return rows.map((row) => { const r = { ...row }; delete r._ids; return PairRow.parse(r) })
}

/** 탈락 후보의 build/ 정리(C84): 고르지도 올리지도 않은 생성·브랜드 후보 중 recipe/DESIGN.md 가 남아 있는 것만. → 지운 후보 id */
export function pruneLosers(runDir, cands, { pick, promoted = [] }) {
  const pruned = []
  for (const c of cands) {
    if (c.source === 'library' || c.id === pick || promoted.includes(c.id)) continue
    const build = join(runDir, c.id, 'build')
    const rel = relative(resolve(runDir), resolve(build))
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`build 경로가 실행 폴더 밖이다: ${build}`)
    if (!existsSync(build) || !existsSync(join(runDir, c.id, 'recipe', 'DESIGN.md'))) continue
    rmSync(build, { recursive: true, force: true })
    pruned.push(c.id)
  }
  return pruned
}

/**
 * @param {{ run: string, pick: string, promote?: Record<string, boolean>, archetype?: string, brief?: string, date?: string, pairsFile?: string, recipesDir?: string, prune?: boolean, promoteOpts?: object }} o
 * @returns {{ rows: object[], written: object[], promoted: { id: string, file: string, cand: string }[], pruned: string[] }}
 */
export function recordFinal({ run, pick, promote = {}, archetype, brief, date, pairsFile = PAIRS_FILE, recipesDir, prune = false, promoteOpts = {} }) {
  const runDir = resolveRun(run)
  const cands = loadCandidates(runDir)
  if (cands.length < 2) throw new Error(`후보가 ${cands.length}개뿐이다(${runDir}) — 결선 기록은 둘 이상이 있어야 한다`)
  const brf = existsSync(join(runDir, 'brief.json')) ? JSON.parse(readFileSync(join(runDir, 'brief.json'), 'utf8')) : {}
  const arch = archetype ?? brf.archetype
  const topic = brief ?? brf.topic
  if (!arch || !topic) throw new Error('원형(archetype)과 브리프(brief) 한 줄이 필요하다 — --archetype·--brief 로 주거나 실행 폴더에 brief.json 을 둔다')
  const day = date ?? new Date().toISOString().slice(0, 10)
  const rows = pairRows(cands, { pick, promote, archetype: arch, brief: topic, date: day })
  // 승격: 이미 올린 후보는 건너뛰고(다시 돌려도 안전), 나머지는 먼저 전부 검사(dryRun)한 뒤에 쓴다 — 하나라도 거절되면 아무것도 쓰지 않는다.
  const dir = recipesDir ?? RECIPES_DIR
  const ups = Object.keys(promote).filter((x) => promote[x])
  const already = new Map(ups.map((k) => [k, promotedAs(dir, originOf(runDir, k))]).filter(([, id]) => id))
  const opts = { ...(recipesDir ? { recipesDir } : {}), pairsFile, date: day, archetype: arch, brief: topic, ...promoteOpts }
  for (const k of ups) if (!already.has(k)) promoteCandidate(runDir, k, { ...opts, dryRun: true })
  const promoted = ups.map((k) => {
    if (already.has(k)) return { id: already.get(k), file: join(dir, already.get(k), 'DESIGN.md'), cand: k, already: true }
    const r = promoteCandidate(runDir, k, opts)
    return { id: r.id, file: r.file, cand: k }
  })
  const have = new Set(readPairs(pairsFile).map((r) => JSON.stringify(r)))
  const written = rows.filter((r) => !have.has(JSON.stringify(r)))
  if (written.length) {
    mkdirSync(dirname(pairsFile), { recursive: true })
    appendFileSync(pairsFile, written.map((r) => JSON.stringify(r)).join('\n') + '\n')
  }
  const pruned = prune ? pruneLosers(runDir, cands, { pick, promoted: promoted.map((p) => p.cand) }) : []
  return { rows, written, promoted, pruned }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined }
  const has = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0 }
  const docFile = flag('--doc'), pickFlag = flag('--pick'), promoteFlag = flag('--promote')
  const archetype = flag('--archetype'), brief = flag('--brief'), date = flag('--date'), prune = has('--prune')
  const [run] = argv
  if (!run || (!docFile && !pickFlag)) { console.error('사용: node factory/board/direction-board/record.mjs <run> (--doc <picks.json> | --pick a [--promote b,c]) [--archetype X --brief 「…」] [--date D] [--prune]'); process.exit(2) }
  try {
    const doc = docFile ? JSON.parse(readFileSync(docFile, 'utf8')) : {}
    const pick = pickFlag ?? doc.pick
    if (!pick) throw new PromoteError('고른 안이 없다(pick 이 비었다)')
    const promote = promoteFlag ? Object.fromEntries(promoteFlag.split(',').filter(Boolean).map((k) => [k, true])) : (doc.promote ?? {})
    const r = recordFinal({ run, pick, promote, archetype, brief, date, prune })
    console.log(`결선 기록: ${r.rows.length}줄(새로 ${r.written.length}줄) → ${PAIRS_FILE}`)
    for (const p of r.promoted) console.log(`승격 초안: ${p.cand} → ${p.id} (${p.file})`)
    if (r.pruned.length) console.log(`build/ 정리: ${r.pruned.join('·')}`)
  } catch (e) {
    console.error(`${e instanceof PromoteError ? '승격 안 함' : '도구 실패'}: ${e.message}`)
    process.exit(1)
  }
}
