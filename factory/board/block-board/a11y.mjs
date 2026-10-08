// 블록 갤러리 접근성 행렬(P3-4 Task 3 Step 5): node factory/board/block-board/a11y.mjs <origin> [--recipe r1-measure] [--kinds nav,hero] [--only block-nav-…] [--out dir] [--resume]
// 블록마다 /qa/blocks?b=<블록>&r=<레시피>&theme=<모드>&frame=1 을 라이트·다크(&theme=)·강제 색(forced-colors 에뮬레이션) × 1440·375 로 열어 axe + WCAG 2.2 행동 검사를 돈다(factory/qa/a11y-gate.mjs).
// 종류(kind)별로 끊어 돌릴 수 있다(--kinds) — 잠금을 청크 사이에 놓는다. 행마다 <out>/rows/<블록>.json 을 남기고 --resume 이 이어받는다. 요약은 디스크의 모든 행에서 만든다.
// 서버는 빌드 뒤 `npm start`. 종료: 0 = 쟀고 실패 없음 · 1 = 쟀고 실패 있음(요약 있음) 또는 도구 실패(`도구 실패:` — 요약 없음, 이전 요약도 지운다) · 2 = 인자 오류.
// 블록 결함은 여기서 고치지 않는다 — 요약을 대장 행으로 옮긴다.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ToolFailure, a11yGate, openSession } from '../../qa/a11y-gate.mjs'
import { loadBlocks } from '../../scripts/blocks.mjs'
import { ROOT } from './jobs.mjs'

export const OUT = join(ROOT, '.tmp', 'blocks-a11y')
export const DEFAULT_RECIPE = 'r1-measure'
export const IGNORE = '[data-sticky-nav]' // 검수대 띠(marketing-gate 와 같은 범위)
const themeUrl = (mode, url) => `${url}&theme=${mode === 'dark' ? 'dark' : 'light'}`
export const galleryUrl = (origin, block, recipe) => `${origin.replace(/\/$/, '')}/qa/blocks?b=${block}&r=${recipe}&frame=1`

/** 행 파일(디스크)에 남길 줄이는 모양. */
export function rowOf(block, recipe, url, r, ms) {
  return {
    block, recipe, url, ms, exit: r.exit, failures: r.failures, warnings: r.warnings,
    matrix: r.matrix.map(({ mode, width, entered, passes, violations, incomplete }) => ({ mode, width, entered, passes, violations, incomplete })),
    violations: r.violations.map((v) => ({ rule: v.rule, impact: v.impact, mode: v.mode, width: v.width, kwcag: v.kwcag, count: v.count, nodes: v.nodes.slice(0, 2).map((n) => ({ target: n.target, summary: n.summary })) })),
    incomplete: r.incomplete.map((v) => ({ rule: v.rule, mode: v.mode, width: v.width, count: v.count })),
    behaviors: r.behaviors.map((b) => ({ id: b.id, status: b.status, byWidth: b.byWidth, fail: b.detail.fail, warn: b.detail.warn })),
  }
}

/** 행들 → 요약(순수). 규칙 × 모드 표는 「그 규칙으로 실패한 블록 수」다. na 는 통과가 아니라 따로 센다. */
export function summarizeRows(rows) {
  const failImpact = (i) => i === 'critical' || i === 'serious'
  const byRule = {}
  const perMode = { light: 0, dark: 0, 'forced-colors': 0 }
  const modeOnly = { light: [], dark: [], 'forced-colors': [] } // 그 모드에서만 깨진 (블록·규칙)
  for (const row of rows) {
    const seen = new Map() // rule → modes
    for (const v of row.violations) {
      const e = (byRule[`${v.rule}(${v.impact})`] ??= { rule: v.rule, impact: v.impact, kwcag: v.kwcag, blocks: new Set(), modes: {}, fail: failImpact(v.impact) })
      e.blocks.add(row.block)
      e.modes[v.mode] = (e.modes[v.mode] ?? new Set()).add(row.block)
      seen.set(v.rule, new Set([...(seen.get(v.rule) ?? []), v.mode]))
    }
    for (const [rule, modes] of seen) if (modes.size === 1) { const [m] = modes; modeOnly[m].push(`${row.block}:${rule}`) }
  }
  const rules = Object.values(byRule).map((e) => ({ rule: e.rule, impact: e.impact, kwcag: e.kwcag, fail: e.fail, blocks: e.blocks.size, byMode: Object.fromEntries(Object.entries(e.modes).map(([m, s]) => [m, s.size])), sample: [...e.blocks].slice(0, 6) })).sort((a, b) => Number(b.fail) - Number(a.fail) || b.blocks - a.blocks)
  const behaviors = {}
  for (const id of ['focus-not-obscured', 'redundant-entry', 'authentication', 'target-size']) {
    const list = rows.flatMap((r) => r.behaviors.filter((b) => b.id === id).map((b) => ({ block: r.block, ...b })))
    behaviors[id] = { pass: list.filter((b) => b.status === 'pass').length, fail: list.filter((b) => b.status === 'fail').length, na: list.filter((b) => b.status === 'na').length, failing: list.filter((b) => b.status === 'fail').map((b) => `${b.block}: ${(b.fail ?? []).slice(0, 2).join(' | ')}`) }
  }
  const failedRows = rows.filter((r) => r.exit !== 0)
  for (const m of Object.keys(perMode)) perMode[m] = rows.filter((r) => r.violations.some((v) => v.mode === m && failImpact(v.impact))).length
  return {
    blocks: rows.length, cells: rows.reduce((n, r) => n + r.matrix.length, 0), failedBlocks: failedRows.length, failedBlockNames: failedRows.map((r) => r.block),
    warnBlocks: rows.filter((r) => r.exit === 0 && r.warnings.length).length,
    blocksFailingByMode: perMode, modeOnly, rules, behaviors, incompleteRules: [...new Set(rows.flatMap((r) => r.incomplete.map((i) => i.rule)))].sort(),
    ok: failedRows.length === 0,
  }
}

const readRows = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [])

export async function main(argv) {
  const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d }
  const kinds = flag('--kinds')?.split(',').filter(Boolean)
  const only = flag('--only')?.split(',').filter(Boolean)
  const recipe = flag('--recipe', DEFAULT_RECIPE)
  const out = flag('--out', OUT)
  const resume = argv.includes('--resume')
  const [origin] = argv.filter((a) => !a.startsWith('--'))
  if (!origin || !/^https?:\/\//.test(origin)) { console.error('사용: block-board/a11y.mjs <origin> [--recipe r1-measure] [--kinds a,b] [--only block-x,…] [--out dir] [--resume]'); return 2 }
  const rowsDir = join(out, 'rows')
  const summaryFile = join(out, 'summary.json')
  mkdirSync(rowsDir, { recursive: true })
  rmSync(summaryFile, { force: true }) // 앞 실행의 요약을 도구 실패 뒤에 남기지 않는다
  let session = null
  try {
    const blocks = loadBlocks(ROOT).filter((b) => b.meta.success && (!kinds || kinds.includes(b.kind)) && (!only || only.includes(`block-${b.kind}-${b.variant}`)))
    if (!blocks.length) throw new Error('고른 블록이 0개다')
    session = await openSession()
    let n = 0
    for (const b of blocks) {
      const name = `block-${b.kind}-${b.variant}`
      const file = join(rowsDir, `${name}.json`)
      n++
      if (resume && existsSync(file)) { console.log(`[${n}/${blocks.length}] SKIP ${name} (이어받기)`); continue }
      const url = galleryUrl(origin, name, recipe)
      const t0 = Date.now()
      let r
      try { r = await a11yGate(url, { session, modeUrl: themeUrl, ignore: IGNORE }) } catch (e1) {
        if (!(e1 instanceof ToolFailure) && !/CDP |기한|페이지 측정/.test(e1.message)) throw e1
        console.error(`재시도(도구 예외): ${name} — ${e1.message}`) // Chrome 을 새로 띄워 한 번 더. 두 번째도 던지면 도구 실패.
        await session.close().catch(() => {})
        session = await openSession()
        r = await a11yGate(url, { session, modeUrl: themeUrl, ignore: IGNORE })
      }
      const row = rowOf(name, recipe, url, r, Date.now() - t0)
      writeFileSync(file, JSON.stringify(row))
      console.log(`[${n}/${blocks.length}] ${row.exit === 0 ? 'PASS' : 'FAIL'} ${name} ${(row.ms / 1000).toFixed(1)}s beh:${row.behaviors.map((x) => `${x.id.slice(0, 5)}=${x.status}`).join(',')}${row.exit === 0 ? '' : `\n  ${row.failures.slice(0, 4).join('\n  ')}`}`)
      if (n % 25 === 0) { await session.close(); session = await openSession() } // 누적을 끊는다
    }
    await session.close(); session = null
    const rows = readRows(rowsDir)
    const s = summarizeRows(rows)
    writeFileSync(summaryFile, JSON.stringify({ origin, recipe, ...s }, null, 2) + '\n')
    console.log(`블록 접근성 행렬: 디스크의 블록 ${s.blocks}개(셀 ${s.cells}) 중 실패 ${s.failedBlocks} · 경고만 ${s.warnBlocks} · 모드별 실패 블록 ${JSON.stringify(s.blocksFailingByMode)}`)
    console.log(`행동 검사(통과/실패/na): ${Object.entries(s.behaviors).map(([id, x]) => `${id} ${x.pass}/${x.fail}/${x.na}`).join(' · ')}`)
    return s.ok ? 0 : 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(summaryFile, { force: true })
    return 1
  } finally {
    await session?.close().catch(() => {})
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)))
