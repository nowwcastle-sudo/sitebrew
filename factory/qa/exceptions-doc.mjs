// 예외 표 생성: node factory/qa/exceptions-doc.mjs [--check]
// factory/qa/hit-area-exceptions.json(유일한 원천) → docs/qa/hit-area-exceptions.md 의 표시 사이 표.
// --check: 문서의 표가 JSON 과 다르면 종료 코드 1(고치지 않음).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const JSON_PATH = fileURLToPath(new URL('./hit-area-exceptions.json', import.meta.url))
export const DOC_PATH = fileURLToPath(new URL('../../docs/qa/hit-area-exceptions.md', import.meta.url))
export const START = '<!-- exceptions:start — factory/qa/exceptions-doc.mjs 가 hit-area-exceptions.json 에서 만든다. 손으로 고치지 않는다. -->'
export const END = '<!-- exceptions:end -->'

export const loadExceptions = () => JSON.parse(readFileSync(JSON_PATH, 'utf8'))

export function renderTable(data) {
  const cell = (s) => String(s ?? '').replaceAll('|', '\\|')
  const rows = data.exceptions.map((e) => {
    const where = [`\`${e.slot}\``, e.within && `안: \`${e.within}\``, e.notMatches && `제외: \`${e.notMatches}\``, e.pointer && `(pointer: ${e.pointer})에서만`, e.rule && `근거: ${e.rule}`].filter(Boolean).join(' · ')
    return `| ${cell(e.component)} | ${cell(data.categories[e.category].split(' — ')[0])} | ${cell(e.size)} | ${cell(e.reason)} | ${cell(where)} |`
  })
  // 받아들인 겹침(Task 13a 항목 4): hit-area.mjs pageOverlaps 가 같은 JSON 의 overlaps 로 판정한다.
  const ov = (data.overlaps ?? []).map((o) => `| ${cell(o.component)} | \`${cell(o.thief)}\` → \`${cell(o.victim)}\`${o.within ? ` · 안: \`${cell(o.within)}\`` : ''} | ${cell(o.reason)} |`)
  const ovTable = ov.length ? ['', '받아들인 겹침(옆 타깃의 확장이 이 타깃의 보이는 자리를 가져가는 것):', '', '| 경우 | 가져가는 쪽 → 뺏기는 쪽(슬롯·맥락) | 이유 |', '|---|---|---|', ...ov] : []
  return [START, '| 부품 | 분류 | 크기(/qa/base) | 이유 | 판정 키(슬롯·맥락) |', '|---|---|---|---|---|', ...rows, ...ovTable, END].join('\n')
}

// 문서에서 표시 사이 블록을 꺼낸다. 표시가 없으면 null.
export function docBlock(doc) {
  const a = doc.indexOf(START), b = doc.indexOf(END)
  return a < 0 || b < a ? null : doc.slice(a, b + END.length)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const doc = readFileSync(DOC_PATH, 'utf8'), want = renderTable(loadExceptions()), have = docBlock(doc)
  if (process.argv.includes('--check')) {
    const ok = have !== null && have.replaceAll('\r\n', '\n') === want
    console.log(`exceptions-doc: ${ok ? 'OK' : 'DIFF — node factory/qa/exceptions-doc.mjs 로 다시 만든다'}`)
    process.exit(ok ? 0 : 1)
  }
  if (have === null) { console.error('문서에 표시(exceptions:start/end)가 없다'); process.exit(2) }
  writeFileSync(DOC_PATH, doc.replace(have, () => want))
  console.log('exceptions-doc: 표를 다시 만들었다')
}
