// 소비자 설치 확인(Task 13b Fix round 1 — Step 8 을 운영자가 재현하는 도구).
// 사용: node factory/qa/consumer-markers.mjs <url> --recipe <id> [--consumer <폴더>] [--part button] [--out <json>]
//       node factory/qa/consumer-markers.mjs --dry-run --recipe <id>     브라우저 없이 기대값만 출력(설치 전 확인·테스트용)
// 보는 것:
//  1. 레시피 표지 — <url> 을 헤드리스 Chrome 으로 열어 :root 의 --wf-axes·--wf-font-tuned 가 레지스트리 r/registry.json 의 레시피 cssVars 와 같은가(필수)
//  2. --consumer 를 주면 <폴더>/components/ui/<part>.tsx 가 레시피 컴파일본(r/<id>/ui/<part>.tsx)인가(필수). 기본판(ui/<part>.tsx)이면 실패다 —
//     레시피 뒤에 기본 부품 이름을 add -o 하면 레시피 부품을 덮는다(gotcha recipe-part-overwrite).
//  3. 참고: :root 의 계산값 --font-sans 와 body 서체. init 의 Geist 로더가 남아 있으면 --font-sans 가 Geist 다(gotcha init-geist-loader) — 경고만, 판정에 넣지 않는다.
// 종료: 0 = 통과, 1 = 판정 실패 또는 도구 실패(「도구 실패:」, --out 파일을 남기지 않는다), 2 = 인자 오류. 표: docs/agents/agent-guide.md §3.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 레시피 base 항목 cssVars.light 의 표지(생성물 recipe.mjs recipeMarkers 가 넣은 값)
export function expectedMarkers(recipeId, registry = JSON.parse(readFileSync(join(ROOT, 'registry', 'factory', 'r', 'registry.json'), 'utf8'))) {
  const item = registry.items.find((i) => i.name === recipeId && i.type === 'registry:base')
  if (!item) throw new Error(`레시피 ${recipeId} 가 r/registry.json 에 없다`)
  const light = item.cssVars?.light ?? {}
  if (!light['wf-axes'] || !light['wf-font-tuned']) throw new Error(`레시피 ${recipeId} 의 cssVars 에 표지(--wf-axes·--wf-font-tuned)가 없다`)
  // 보드 B안 항목(<id>-alt, P3-2 Task 8)은 부품을 A 레시피 것으로 쓴다 — 부품 비교 폴더는 meta.recipe.alternateOf.
  return { axes: light['wf-axes'], tuned: light['wf-font-tuned'], partsOf: item.meta?.recipe?.alternateOf ?? recipeId }
}

export function judgeMarkers(measured, expected) {
  const problems = []
  if (measured?.axes !== expected.axes) problems.push(`--wf-axes: ${JSON.stringify(measured?.axes)} ≠ ${JSON.stringify(expected.axes)}`)
  if (measured?.tuned !== expected.tuned) problems.push(`--wf-font-tuned: ${JSON.stringify(measured?.tuned)} ≠ ${JSON.stringify(expected.tuned)}`)
  return problems
}

// 부품 파일의 「모양」 — import 줄 밖의 문자열 리터럴 목록. 설치 때 바뀌는 import 경로·지워지는 주석·줄바꿈에 흔들리지 않는다.
export function shapeStrings(src) {
  const body = src.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^\s*(import|export \* from)\b/.test(l)).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1')
  return [...body.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1])
}

export function whichPart(consumerSrc, recipeSrc, baseSrc) {
  const got = JSON.stringify(shapeStrings(consumerSrc))
  if (got === JSON.stringify(shapeStrings(recipeSrc))) return 'recipe'
  if (got === JSON.stringify(shapeStrings(baseSrc))) return 'base'
  return 'unknown'
}

export const isGeist = (fontSans) => /geist/i.test(fontSans ?? '')

function parseArgs(argv) {
  const opt = { url: null, recipe: null, consumer: null, part: 'button', out: null, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') opt.dryRun = true
    else if (['--recipe', '--consumer', '--part', '--out'].includes(a)) {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} 뒤에 값이 필요하다`)
      opt[a.slice(2)] = v
    } else if (a.startsWith('--')) throw new Error(`모르는 옵션 ${a}`)
    else if (!opt.url) opt.url = a
    else throw new Error(`인자가 너무 많다: ${a}`)
  }
  if (!opt.recipe) throw new Error('--recipe 가 필요하다')
  if (!opt.dryRun && !opt.url) throw new Error('<url> 이 필요하다(또는 --dry-run)')
  return opt
}

async function measure(url) {
  const chrome = await startChrome()
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
    await send('Page.enable')
    const nav = await navigateAndWait(send, ev, url)
    if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText})`)
    const v = await ev(`(() => { const cs = getComputedStyle(document.documentElement); return { axes: cs.getPropertyValue('--wf-axes').trim(), tuned: cs.getPropertyValue('--wf-font-tuned').trim(), fontSans: cs.getPropertyValue('--font-sans').trim(), bodyFont: getComputedStyle(document.body).fontFamily } })()`)
    ws.close()
    return v
  } finally { await chrome.close() }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  let opt
  try { opt = parseArgs(process.argv.slice(2)) } catch (e) {
    console.error(`consumer-markers: ${e.message}\n사용: node factory/qa/consumer-markers.mjs <url> --recipe <id> [--consumer <폴더>] [--part button] [--out <json>] | --dry-run --recipe <id>`)
    process.exit(2)
  }
  let expected
  try { expected = expectedMarkers(opt.recipe) } catch (e) { console.error(`consumer-markers: ${e.message}`); process.exit(2) }
  if (opt.dryRun) { console.log(JSON.stringify({ recipe: opt.recipe, expected, part: opt.part }, null, 2)); process.exit(0) }
  const res = { url: opt.url, recipe: opt.recipe, expected, problems: [], warnings: [] }
  try {
    res.measured = await measure(opt.url)
  } catch (e) { console.error(`consumer-markers: 도구 실패: ${e.message}`); if (opt.out) rmSync(opt.out, { force: true }); process.exit(1) } // 측정 없음이면 이전 결과 파일도 지운다(M2)
  res.problems.push(...judgeMarkers(res.measured, expected))
  if (isGeist(res.measured.fontSans)) res.warnings.push(`:root --font-sans 가 Geist 다(${res.measured.fontSans}) — init 의 Geist 로더가 남아 있다(gotcha init-geist-loader). 화면 서체: ${res.measured.bodyFont}`)
  if (opt.consumer) {
    const p = join(opt.consumer, 'components', 'ui', `${opt.part}.tsx`)
    if (!existsSync(p)) res.problems.push(`${p} 가 없다`)
    else {
      res.part = whichPart(readFileSync(p, 'utf8'),
        readFileSync(join(ROOT, 'registry', 'factory', 'r', expected.partsOf, 'ui', `${opt.part}.tsx`), 'utf8'),
        readFileSync(join(ROOT, 'registry', 'factory', 'ui', `${opt.part}.tsx`), 'utf8'))
      if (res.part !== 'recipe') res.problems.push(`components/ui/${opt.part}.tsx 가 레시피판이 아니다(${res.part}) — 레시피 뒤에 기본 부품을 add -o 했는지 본다`)
    }
  }
  res.pass = res.problems.length === 0
  if (opt.out) { mkdirSync(dirname(opt.out), { recursive: true }); writeFileSync(opt.out, JSON.stringify(res, null, 2)) }
  console.log(JSON.stringify(res, null, 2))
  process.exit(res.pass ? 0 : 1)
}
