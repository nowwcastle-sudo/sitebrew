// 마케팅 관문을 블록 목록 위에서 돈다(P3-2 Task 12 — blocks:gates(Task 7)의 행렬이 부르는 자리): node marketing-blocks.mjs <origin> [--kinds a,b] [--blocks n1,n2] [--recipes r1-measure,r7-docs] [--widths 1440,375] [--out <dir>]
// 갤러리 `/qa/blocks?b=<블록>&r=<레시피>&frame=1` 한 줄 = 한 행. Chrome 하나를 모든 행이 나눠 쓴다(gateOnPage). 주소를 만드는 일과 요약은 이 파일이 하고 규칙은 marketing-gate.mjs 가 한다.
// 행렬(blocks:gates)이 쓰는 함수: blockRows(options) → 행 목록, marketingOverBlocks(session, origin, rows) → 요약. 요약 = { rows[], totals }.
// 종료: 0 = 모든 행 MUST 어김 없음 · 1 = 어김 있음(summary.json 있음) 또는 도구 실패(`도구 실패:`, summary.json 없음) · 2 = 인자 오류.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect } from './cdp.mjs'
import { gateOnPage, RULES } from './marketing-gate.mjs'
import { loadBlocks, blockName } from '../scripts/blocks.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')

// 기본 그림으로는 그려지지 않는 조건 화면(구독 상태가 있어야 뜨는 블록)은 그 상태를 한 행 더 돈다.
export const EXTRA_SCENES = {
  'block-paywall-trial-ending': ['sub=trialing'],
  'block-confirmation-upgrade-complete': ['sub=none'], // 웹훅 전 「결제를 확인하는 중」(기본 행은 열린 화면)
  'block-retention-payment-failed-banner': ['sub=past_due'],
  'block-retention-renewal-consent': ['sub=pending-price-change'],
}

// 순수 함수: 행 목록. blocks: [{ kind, variant }], recipes, widths → [{ block, recipe, width, query, url }]
export function blockRows({ origin, blocks, recipes, widths = [1440], extra = EXTRA_SCENES }) {
  const rows = []
  for (const b of blocks) {
    const name = blockName(b.kind, b.variant)
    for (const recipe of recipes) for (const width of widths) {
      for (const query of ['', ...(extra[name] ?? [])]) {
        rows.push({ block: name, recipe, width, query, url: `${origin.replace(/\/$/, '')}/qa/blocks?b=${name}&r=${recipe}&frame=1${query ? `&${query}` : ''}` })
      }
    }
  }
  return rows
}

// 요약(순수): 규칙별 실패 행 수·잰 행 수(측정 0 은 na 로 따로 센다).
export function summarize(results) {
  const perRule = Object.fromEntries(RULES.map((r) => [r.id, { fail: 0, warn: 0, pass: 0, na: 0 }]))
  for (const r of results) for (const x of r.rules) perRule[x.id][x.status]++
  return {
    rows: results.length,
    failRows: results.filter((r) => r.fail.length).length,
    warnRows: results.filter((r) => r.warn.length).length,
    perRule,
  }
}

// 한 세션으로 행 전부를 돈다. onRow(행, 결과)는 진행 표시용. 탐색·측정 실패는 던진다(도구 실패).
export async function marketingOverBlocks(session, rows, { onRow } = {}) {
  const results = []
  for (const row of rows) {
    const r = await gateOnPage(session, row.url, { width: row.width, height: row.width <= 500 ? 812 : 900 })
    const item = { block: row.block, recipe: row.recipe, width: row.width, query: row.query, fail: r.fail, warn: r.warn, measured: r.measured, rules: r.rules }
    results.push(item)
    onRow?.(row, item)
  }
  return { rows: results, totals: summarize(results) }
}

const usage = () => { console.error('사용: marketing-blocks.mjs <origin> [--kinds a,b] [--blocks n1,n2] [--recipes id,id] [--widths 1440,375] [--out <dir>]'); process.exit(2) }
const main = async () => {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) usage(); argv.splice(i, 2); return v }
  const kinds = flag('--kinds', null)?.split(',').filter(Boolean)
  const names = flag('--blocks', null)?.split(',').filter(Boolean)
  const recipes = flag('--recipes', 'r1-measure').split(',').filter(Boolean)
  const widths = flag('--widths', '1440').split(',').map(Number)
  const out = flag('--out', join(ROOT, '.tmp', 'marketing-gate', 'blocks'))
  const [origin, ...rest] = argv
  if (!origin || rest.length || !/^https?:\/\//.test(origin) || widths.some((w) => !Number.isFinite(w) || w < 200) || !recipes.length) usage()
  const file = join(out, 'summary.json')
  mkdirSync(out, { recursive: true })
  rmSync(file, { force: true })
  let code = 0, chrome
  try {
    const all = loadBlocks(ROOT).filter((b) => b.meta.success)
    const blocks = all.filter((b) => (!kinds || kinds.includes(b.kind)) && (!names || names.includes(blockName(b.kind, b.variant))))
    if (!blocks.length) throw new Error('고른 블록이 0개다')
    const rows = blockRows({ origin, blocks, recipes, widths })
    chrome = await startChrome(['--hide-scrollbars', '--force-color-profile=srgb'], { prefix: 'mkt-blocks-' })
    const { ws, ...session } = await connect(chrome.wsUrl)
    let n = 0
    const summary = await marketingOverBlocks(session, rows, { onRow: (row, item) => { n++; if (item.fail.length || item.warn.length) console.error(`${item.fail.length ? 'FAIL' : 'WARN'} ${row.block} ${row.recipe} ${row.width}${row.query ? ` ?${row.query}` : ''}: ${[...item.fail, ...item.warn].join(', ')}`); if (n % 20 === 0) console.log(`… ${n}/${rows.length}`) } })
    ws.close()
    writeFileSync(file, JSON.stringify({ origin, recipes, widths, ...summary }, null, 2))
    console.log(JSON.stringify({ rows: summary.totals.rows, failRows: summary.totals.failRows, warnRows: summary.totals.warnRows }))
    code = summary.totals.failRows ? 1 : 0
  } catch (e) { console.error(`도구 실패: ${e.message}`); code = 1; rmSync(file, { force: true }) } finally { await chrome?.close() }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
