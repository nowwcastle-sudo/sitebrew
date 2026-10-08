// 외부 의존 풀기(FV1 Task 7.2 · D24) — 공장 규칙 문서와 인용 규약.
//   ① docs/rules/factory-rules.md 가 있고 절(20-1 … 23-8)·규칙 줄 수·규칙 ID 가 원본 번호 그대로다(코드의 인용이 1:1 로 풀린다).
//   ② 공개 독자용이다: 소유자 지칭·로컬 경로·개인 도구·사업 코드명이 없다.
//   ③ 추적 파일 어디에도 `~/.claude/DESIGN.md` 경로나 「DESIGN §20~23」 인용이 남지 않는다(이 계획·스펙 문서만 허용 — 지시문 원문을 인용한다).
//   ④ 「factory-rules.md §N」 인용은 전부 문서에 있는 절로 풀린다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOC = join(ROOT, 'docs', 'rules', 'factory-rules.md')
const TEXT_EXT = new Set(['.md', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.json', '.css', '.txt', '.yml', '.yaml', '.html', '.mdx', '.toml', '.jsonl'])

// 허용 목록: 이 과제의 지시문(계획 Task 7.2 · 스펙 D24)이 옛 인용 문구를 원문 그대로 적는다 — 고치면 지시문이 사라진다.
export const ALLOW = new Map([
  ['docs/superpowers/plans/2026-10-09-factory-v1.md', '계획 Task 7.2 가 옛 인용 문구(DESIGN §20~23)를 지시문으로 적는다'],
  ['docs/superpowers/specs/2026-10-09-factory-v1-agreement.md', '스펙 D24 가 옛 인용 문구(DESIGN §20~23)를 결정문으로 적는다'],
  ['factory/scripts/factory-rules-doc.test.mjs', '이 시험이 옛 인용 모양을 설명과 양성 대조 문자열로 적는다'],
])

const PATH_REF = /\.claude[\\/]DESIGN/
const SECTION_REF = /DESIGN(?:\.md)?`?[^\n§]{0,6}§\s*2[0-3](?!\d)/
const NEW_REF = /factory-rules\.md`?\s*§\s*(\d{2}(?:-\d+)?)/g

function trackedText() {
  const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f && TEXT_EXT.has(extname(f).toLowerCase()))
  return files.filter((f) => existsSync(join(ROOT, f))).map((f) => [f, readFileSync(join(ROOT, f), 'utf8')])
}

// 원본 DESIGN §20~23 에서 센 값(2026-10-10): 절마다 `- [MUST]`/`- [SHOULD]` 줄 수. 규칙 ID 는 22·23절의 L P O R T A V X M U 계열.
const RULE_LINES = {
// 20-5: 원본 3줄 + 3D 오브젝트 규칙 4줄(3D-GEN, 2026-10-11).
  '20-1': 1, '20-2': 3, '20-3': 3, '20-4': 4, '20-5': 7, '20-6': 3, '20-7': 2, '20-8': 3, '20-9': 1,
  '21-1': 9, '21-2': 8, '21-3': 9, '21-4': 8, '21-5': 7, '21-6': 9, '21-7': 10, '21-8': 11, '21-9': 10,
  '22-1': 8, '22-2': 7, '22-3': 5, '22-4': 4, '22-5': 5, '22-6': 5, '22-7': 4, '22-8': 2,
  '23-1': 3, '23-2': 5, '23-3': 4, '23-4': 2, '23-5': 3, '23-6': 2, '23-7': 2,
}
const range = (p, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`)
const RULE_IDS = [
  ...range('L', 1, 8), 'L10', 'L11', 'L12', ...range('P', 1, 12), 'P14', ...range('O', 1, 10), 'R1', 'R3', 'R4', 'R5',
  ...range('T', 1, 7), 'T9', 'V1', 'V2', 'V4', ...range('X', 1, 11), ...range('A', 1, 8), 'A10', 'A12', 'M1', 'M2', ...range('U', 1, 21),
]

function sections(text) {
  const out = new Map()
  let cur = null
  for (const line of text.split('\n')) {
    const h = /^### (\d+-\d+)\./.exec(line)
    if (h) { cur = h[1]; out.set(cur, []) } else if (/^## /.test(line) || /^---\s*$/.test(line)) cur = null
    else if (cur) out.get(cur).push(line)
  }
  return out
}

test('factory-rules.md: 20~23 대제목과 절 33개가 원본 번호 그대로 있다', () => {
  assert.ok(existsSync(DOC), 'docs/rules/factory-rules.md 가 없다')
  const text = readFileSync(DOC, 'utf8')
  for (const n of [20, 21, 22, 23]) assert.match(text, new RegExp(`^## ${n}\\. `, 'm'), `## ${n}.`)
  const secs = sections(text)
  assert.deepEqual([...secs.keys()].filter((k) => !(k in RULE_LINES) && k !== '22-9' && k !== '23-8'), [], '원본에 없는 절')
  for (const k of Object.keys(RULE_LINES)) assert.ok(secs.has(k), `절 ${k} 없음`)
  assert.ok(secs.has('22-9') && secs.has('23-8'))
})

test('factory-rules.md: 절마다 [MUST]/[SHOULD] 줄 수가 원본과 같다', () => {
  const secs = sections(readFileSync(DOC, 'utf8'))
  for (const [k, n] of Object.entries(RULE_LINES)) {
    const got = secs.get(k).filter((l) => /^- \[(MUST|SHOULD)\]/.test(l)).length
    assert.equal(got, n, `절 ${k}: 규칙 줄 ${got} ≠ ${n}`)
  }
})

test('factory-rules.md: 규칙 ID(L P O R T A V X M U) 가 빠지지 않는다', () => {
  const text = readFileSync(DOC, 'utf8')
  // 문서는 P6~P10 처럼 범위로 적기도 한다 — 범위를 풀어서 센다.
  const found = new Set()
  for (const m of text.matchAll(/([LPORTAVXMU])(\d{1,2})~[LPORTAVXMU]?(\d{1,2})/g)) for (let n = Number(m[2]); n <= Number(m[3]); n++) found.add(m[1] + n)
  for (const m of text.matchAll(/(?<![A-Za-z0-9])([LPORTAVXMU]\d{1,2})(?![0-9])/g)) found.add(m[1])
  assert.deepEqual(RULE_IDS.filter((id) => !found.has(id)), [])
})

test('factory-rules.md: 공개 독자용 — 소유자 지칭·로컬 경로·개인 도구·사업 코드명이 없다', () => {
  const text = readFileSync(DOC, 'utf8')
  const bad = [
    [/대표/, '소유자 지칭'], [/[A-Za-z]:[\\/]/, '로컬 경로'], [/~[\\/]\.claude/, '개인 설정 경로'], [/design-rules/i, '개인 자료 폴더'],
    [/launch-factory|LFFIX|product-ux-audit|legal-basis\.md/i, '사업·내부 문서 이름'], [/Higgsfield|HIGGSFIELD|Pexels/i, '개인 도구·공급자 선택'],
  ].filter(([re]) => re.test(text)).map(([, why]) => why)
  assert.deepEqual(bad, [])
})

test('추적 파일에 ~/.claude/DESIGN.md 경로나 「DESIGN §20~23」 인용이 남지 않는다 (허용: 이 계획·스펙)', () => {
  const hits = []
  for (const [f, text] of trackedText()) {
    if (ALLOW.has(f)) continue
    const lines = text.split('\n')
    lines.forEach((l, i) => { if (PATH_REF.test(l) || SECTION_REF.test(l)) hits.push(`${f}:${i + 1}`) })
  }
  assert.deepEqual(hits.slice(0, 20), [], `${hits.length}곳 남음`)
})

test('양성 대조: 정규식이 옛 인용 모양을 잡는다', () => {
  for (const s of ['DESIGN §22-1 L1', 'DESIGN.md §20·§21', '`DESIGN.md` v4(§20', 'DESIGN §20~23', '~/.claude/DESIGN.md §7-B', '<home>\\.claude\\DESIGN.md']) assert.ok(PATH_REF.test(s) || SECTION_REF.test(s), s)
  for (const s of ['DESIGN §7-B', 'DESIGN.md §13', 'registry/factory/recipes/r1/DESIGN.md']) assert.ok(!SECTION_REF.test(s) && !PATH_REF.test(s), s)
})

test('「factory-rules.md §N」 인용은 전부 문서의 절로 풀린다', () => {
  const secs = new Set(sections(readFileSync(DOC, 'utf8')).keys())
  const heads = new Set([20, 21, 22, 23].map(String))
  const bad = []
  let total = 0
  for (const [f, text] of trackedText()) {
    for (const m of text.matchAll(NEW_REF)) {
      total++
      const ref = m[1]
      if (!(heads.has(ref) || secs.has(ref))) bad.push(`${f}: §${ref}`)
    }
  }
  assert.ok(total > 100, `인용 ${total}곳 — 치환이 적용되지 않았다`)
  assert.deepEqual(bad.slice(0, 20), [])
})
