// 제품 화면 레퍼런스 references/product-screens/sources.md 를 만든다(P3-6 REFS).
// 정본은 같은 폴더의 sources.json(행 76개 — 원천 선택 자료 폴더의 ux-audit/references-inbox.md 를 한 번 병합한 것).
// 포인터만 둔다: 주소·패턴 이름·우리 감사 항목 ID·우리 말 한 줄. 제3자 글·그림은 싣지 않는다.
// 이 파일은 gen:all 밖이다(원천이 저장소 밖에서 한 번 들어왔고, 이후는 sources.json 을 직접 고친다).
// 사용: node factory/scripts/build-product-screens.mjs [--check]   (--check: sources.md 가 json 과 다르면 종료 코드 1)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DIR = join(ROOT, 'references', 'product-screens')
export const JSON_PATH = join(DIR, 'sources.json')
export const MD_PATH = join(DIR, 'sources.md')

// 화면 영역 — 순서가 곧 표 순서다. 감사 항목 ID 머리글자(A~N)와 1:1이 아니라 행의 주제로 묶는다.
export const AREAS = [
  ['signup', '가입', '가입 폼·동의·이메일 확인·중복 입력'],
  ['login', '로그인·인증·세션', '로그인 안내·방식 선택·비밀번호·2단계·재설정·세션 만료'],
  ['account', '계정·내 정보', '정정·삭제·파기·이름 칸'],
  ['payment', '결제·확인·완료', '제출 전 확인·되돌리기 어려운 행동·이중 제출·철회·완료 쪽·거래 조건 고지'],
  ['mail', '메일·알림·공지', '광고성 정보 동의·수신 거부·발송 인증·푸시·알림 띠'],
  ['error', '오류·검증', '입력 검증·오류 문구·404·서비스 중단 쪽·오류 요약'],
  ['a11y', '접근성·포용', 'KWCAG 2.2·WCAG 2.2·건너뛰기·초점·대비·모달·언어 바꾸기·공통 지침 입구'],
  ['mobile', '모바일·반응형', '리플로·눌림 크기·화면 구획'],
  ['contact', '문의·고지', '문의 수단·도움·쿠키·처리방침'],
  ['ax', 'AX(에이전트·검색)', 'llms.txt·WebMCP·쪽 제목'],
]

export const ITEM_ID = /^[A-N]\d{2}$/
export const ID = /^[a-z0-9]+-\d{2}$/

export function problems(doc) {
  const out = []
  const areas = new Set(AREAS.map((a) => a[0]))
  const seenId = new Set()
  const seenKey = new Set()
  for (const r of doc.rows) {
    if (!ID.test(r.id)) out.push(`${r.id}: id 모양`)
    if (seenId.has(r.id)) out.push(`${r.id}: id 중복`)
    seenId.add(r.id)
    if (!areas.has(r.area)) out.push(`${r.id}: area ${r.area}`)
    if (!/^https:\/\//.test(r.url)) out.push(`${r.id}: https 아님`)
    const key = `${r.url}\u0000${r.pattern}`
    if (seenKey.has(key)) out.push(`${r.id}: 같은 주소·패턴 중복`)
    seenKey.add(key)
    if (!r.items.length || !r.items.every((x) => ITEM_ID.test(x))) out.push(`${r.id}: 항목 ID ${JSON.stringify(r.items)}`)
    if (!r.source || !r.pattern || !r.summary) out.push(`${r.id}: 빈 칸`)
    if (r.status !== 200) out.push(`${r.id}: status ${r.status} — 죽은 주소는 표에 두지 않는다`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) out.push(`${r.id}: checked`)
  }
  return out
}

const cell = (s) => String(s).replace(/\|/g, '\\|')

export function renderMd(doc) {
  const byArea = new Map(AREAS.map((a) => [a[0], []]))
  for (const r of doc.rows) byArea.get(r.area).push(r)
  const L = []
  L.push('# 제품 화면 레퍼런스 — 표')
  L.push('')
  L.push('> `sources.json`에서 `node factory/scripts/build-product-screens.mjs`가 만든다. 손으로 고치지 않는다 — json 을 고치고 다시 만든다.')
  L.push(`> 행 ${doc.rows.length}개 · 주소 ${new Set(doc.rows.map((r) => r.url)).size}개 · 마지막 확인 ${doc.checked}(전부 GET 200). 읽는 법·한계는 \`README.md\`.`)
  L.push('')
  L.push('영역 바로가기: ' + AREAS.map(([k, label]) => `[${label}](#${k})`).join(' · '))
  for (const [key, label, scope] of AREAS) {
    const rows = byArea.get(key)
    L.push('')
    L.push(`<a id="${key}"></a>`)
    L.push(`## ${label} (${rows.length})`)
    L.push('')
    L.push(`범위: ${scope}.`)
    L.push('')
    L.push('| id | 출처 | 패턴 | 우리 항목 | 한 줄 요지 | 주소 |')
    L.push('|---|---|---|---|---|---|')
    for (const r of rows) {
      const note = r.note ? ` (${r.note})` : ''
      L.push(`| ${r.id} | ${cell(r.source)} | ${cell(r.pattern)} | ${r.items.join(' ')} | ${cell(r.summary + note)} | ${r.url} |`)
    }
  }
  // 거꾸로 찾기: 감사 항목 → 행
  const inv = new Map()
  for (const r of doc.rows) for (const it of r.items) (inv.get(it) ?? inv.set(it, []).get(it)).push(r.id)
  L.push('')
  L.push('<a id="by-item"></a>')
  L.push('## 감사 항목 → 행 (거꾸로 찾기)')
  L.push('')
  L.push(`항목 ${inv.size}개에 행이 있다. 여기 없는 항목은 대응하는 1차 출처를 아직 못 찾은 것이다(\`README.md\` 「아직 없는 것」).`)
  L.push('')
  L.push('| 항목 | 행 id |')
  L.push('|---|---|')
  for (const it of [...inv.keys()].sort()) L.push(`| ${it} | ${inv.get(it).join(' ')} |`)
  L.push('')
  return L.join('\n')
}

export const loadDoc = () => JSON.parse(readFileSync(JSON_PATH, 'utf8'))

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const doc = loadDoc()
  const bad = problems(doc)
  if (bad.length) { console.error(bad.join('\n')); process.exit(1) }
  const md = renderMd(doc)
  if (process.argv.includes('--check')) {
    let cur = ''
    try { cur = readFileSync(MD_PATH, 'utf8') } catch { /* 없으면 다름 */ }
    if (cur !== md) { console.error('sources.md 가 sources.json 과 다르다 — node factory/scripts/build-product-screens.mjs'); process.exit(1) }
    console.log(`ok: ${doc.rows.length}행, sources.md 일치`)
  } else {
    writeFileSync(MD_PATH, md)
    console.log(`wrote ${MD_PATH} (${doc.rows.length}행)`)
  }
}
