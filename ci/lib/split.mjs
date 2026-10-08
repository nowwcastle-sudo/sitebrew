// 시험 가름(P3-8): CI 는 「가벼운 시험」만 돌린다. 가름은 파일 목록 하나로 한다 — ci/tests-heavy.txt (줄마다 시험 파일 경로, # 뒤는 까닭).
//   가벼운 시험 = 추적 중인 *.test.mjs 전부 − 무거운 목록. 새 시험 파일은 기본이 「가벼움」이다.
//   무거운 시험 = Chrome 을 띄우거나 파일 하나가 20초를 넘는 것 → 로컬 야간(`npm run ci:test:heavy`)에서 돈다.
// 가드(순수 — splitProblems): ① 무거운 목록에 적힌 파일이 없으면(오래된 줄) 실패 ② 목록에 없는 시험이 Chrome 을 직접 부르면 실패
//   (가벼운 곳에 Chrome 시험이 슬그머니 들어와 러너 메모리를 먹는 것을 막는다).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const HEAVY_FILE = 'ci/tests-heavy.txt'
// Chrome 을 직접 부르는 흔적(factory/qa/cdp.mjs 도우미·직접 실행).
export const CHROME_USE = /startChrome|openSession|chromePath\(|gateOnPage|puppeteer|launchChrome|spawnChrome|CHROME_PATH|chrome\.exe|google-chrome/

export function parseList(text) {
  return text.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
}

export function listTestFiles(root = ROOT) {
  return execFileSync('git', ['ls-files', '--', '*.test.mjs', ':!launch-factory', ':!packages', ':!plugins'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
}

// Chrome 을 띄우는 도구 모듈 — 저장소의 비시험 .mjs 중 startChrome 을 부르는 것(cdp.mjs 자신은 뺀다). 손으로 적지 않고 git grep 으로 모은다.
export function chromeToolPaths(root = ROOT) {
  let out = ''
  try { out = execFileSync('git', ['grep', '-l', 'startChrome(', '--', 'factory/**/*.mjs', ':!*.test.mjs'], { cwd: root, encoding: 'utf8' }) } catch (e) { if (e.status !== 1) throw e } // 1 = 맞는 파일 없음
  return out.split('\n').map((l) => l.trim()).filter((p) => p && p !== 'factory/qa/cdp.mjs').sort()
}

// 도구를 자식으로 부르거나 불러 쓰는 시험도 Chrome 시험이다 — 경로 그대로, 또는 파일 이름이 다른 낱말의 일부가 아닌 채로 글에 나오면 걸린다.
const reEscape = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function usesChromeTool(text, chromeTools) {
  return chromeTools.find((t) => text.includes(t) || new RegExp(`(?<![\\w.-])${reEscape(t.split('/').pop())}(?![\\w-])`).test(text))
}

// 면제 표: 도구 파일 이름이 나오지만 Chrome 을 띄우지 않는 가벼운 시험(순수 함수·판정 도우미만 부른다). 파일마다 까닭을 적고 코드로 확인한 것만 올린다.
// 확인 방법(2026-10-10, FV1 5.1): 가름 가드가 새로 잡은 13개를 child_process.spawn 기록기(--require)를 건 채 돌려 Chrome/Edge 실행 0건을 보았다(227 시험 중 226 통과·1 건너뜀).
export const CHROME_TOOL_EXEMPT = {
  'factory/board/recipe-board/board2.test.mjs': 'gates.mjs 의 순수 판정 함수(oklabChroma·상수)만 부른다',
  'factory/board/recipe-board/hero-motion.test.mjs': 'hero-contrast.mjs 의 상수·수집 식 문자열만 부른다',
  'factory/qa/consumer-markers.test.mjs': '판정 함수와 CLI 인자·--dry-run 만 본다(브라우저 없음)',
  'factory/qa/marketing-blocks.test.mjs': '행 목록·요약 순수 함수만 부른다',
  'factory/qa/ops-gate.test.mjs': '순수 판정·작은 http 픽스처 서버·CLI 종료 코드만 본다(Chrome 은 ops-gate.browser.test.mjs)',
  'factory/qa/strict-archetype.test.mjs': '순수 판정과 가짜 측정기만 부른다(Chrome 은 strict-archetype.browser.test.mjs)',
  'factory/scripts/blocks-human-approval.test.mjs': '블록 소스 글만 읽고 agent-boundary 는 주석에서 가리킬 뿐이다',
  'factory/scripts/bold.test.mjs': '순수 판정과 가짜 측정기만 부른다(Chrome 은 bold-safety.browser.test.mjs)',
  'factory/scripts/marketing-total-en.test.mjs': 'marketing-gate.mjs 소스 글을 읽어 식만 대조한다(실행하지 않는다)',
  'factory/scripts/stamp-board.test.mjs': 'video.mjs 의 순수 함수(fileNames)와 촬영 작업 목록 만들기만 본다',
  'factory/scripts/stamp-qfix3-perf-env.test.mjs': 'ops-gate.mjs 의 순수 판정 함수(lhrToChecks)와 가짜 LHR 만 부른다',
  'factory/scripts/stamp-csp.test.mjs': 'ops-gate.mjs 의 순수 도우미만 부른다',
  'factory/scripts/stamp-export.test.mjs': '순수 변환만 돌고 실제 내보내기(Chrome)는 STAMP_EXPORT_REAL=1 일 때만이다',
  'factory/scripts/stamp-qa.test.mjs': '관문 도구 자리에 가짜 함수를 넣어 배선만 본다',
}

export function splitProblems(files, heavy, read, { chromeTools = [], exempt = {} } = {}) {
  const problems = []
  const all = new Set(files)
  for (const h of heavy) if (!all.has(h)) problems.push(`${HEAVY_FILE}: 없는 시험 파일 — ${h}`)
  for (const [e, why] of Object.entries(exempt)) {
    if (!all.has(e)) problems.push(`CHROME_TOOL_EXEMPT: 없는 시험 파일 — ${e}`)
    if (!String(why).trim()) problems.push(`CHROME_TOOL_EXEMPT: 까닭이 비었다 — ${e}`)
  }
  const heavySet = new Set(heavy)
  for (const f of files) {
    if (heavySet.has(f)) continue
    const text = read(f)
    if (CHROME_USE.test(text)) { problems.push(`${f}: Chrome 을 직접 부르는데 ${HEAVY_FILE} 에 없다(무거운 시험으로 올리거나 Chrome 호출을 뺀다)`); continue }
    if (Object.hasOwn(exempt, f)) continue
    const tool = usesChromeTool(text, chromeTools)
    if (tool) problems.push(`${f}: Chrome 을 띄우는 도구(${tool})를 부르는데 ${HEAVY_FILE} 에 없다(무거운 시험으로 올리거나, Chrome 을 안 띄우면 CHROME_TOOL_EXEMPT 에 까닭과 함께 적는다)`)
  }
  return problems
}

export function loadSplit(root = ROOT) {
  const files = listTestFiles(root)
  const heavy = parseList(readFileSync(join(root, HEAVY_FILE), 'utf8'))
  const problems = splitProblems(files, heavy, (f) => readFileSync(join(root, f), 'utf8'), { chromeTools: chromeToolPaths(root), exempt: CHROME_TOOL_EXEMPT })
  const heavySet = new Set(heavy)
  return { files, heavy, light: files.filter((f) => !heavySet.has(f)), problems }
}
