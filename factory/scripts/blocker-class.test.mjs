// 공개 불가 사유 두 갈래(factory v1 Task 6.1 · 합의안 D19) — 순수 함수라 브라우저·파일 없이 돈다.
//   input   = 대표 입력을 기다리는 사유(실제 사진 필요 · 사이트 주소 미정 · 확인 필요 사실 · 예시 연락처 · 법률 검토 미완)
//   quality = 그 밖 전부(기계 기준은 quality 0)
//   ① 접두 표(gen-pages BLOCKER · qa QA_PREFIX · sitemap BLOCKER_PREFIX)의 모든 접두가 정확히 한 갈래에 든다 — 표에 접두를 더하고 분류를 빼먹으면 여기서 실패한다
//   ② 대표 사례 10줄은 갈래가 고정이다 ③ 보드 카드의 두 줄은 stamp-board.test.mjs, 07-qa 요약의 blockerKinds 는 stamp-qa.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blockerClass, splitBlockers, INPUT_PREFIXES, QUALITY_PREFIXES } from '../stamp/blocker-class.mjs'
import { BLOCKER } from '../stamp/gen-pages.mjs'
import { QA_PREFIX } from '../stamp/qa.mjs'
import { BLOCKER_PREFIX as SITEMAP_PREFIX } from '../stamp/sitemap.mjs'

const STAMP = join(dirname(fileURLToPath(import.meta.url)), '..', 'stamp')

/** 접두 표 전부 — [표 이름.키, 접두]. 사이트맵은 표가 아니라 상수 하나다. */
const TABLES = [
  ...Object.entries(BLOCKER).map(([k, p]) => [`gen-pages BLOCKER.${k}`, p]),
  ...Object.entries(QA_PREFIX).map(([k, p]) => [`qa QA_PREFIX.${k}`, p]),
  ['sitemap BLOCKER_PREFIX', SITEMAP_PREFIX],
]
const KIND_OF = (prefix) => (INPUT_PREFIXES.includes(prefix) ? 'input' : QUALITY_PREFIXES.includes(prefix) ? 'quality' : null)

test('접두 표: 양성 대조 — 표를 못 읽었거나 비었으면 아래 전수 검사가 아무것도 안 본 채 통과하지 않게 개수를 못 박는다', () => {
  assert.equal(Object.keys(BLOCKER).length, 14)
  assert.equal(Object.keys(QA_PREFIX).length, 8)
  assert.equal(TABLES.length, 23)
  assert.ok(TABLES.every(([, p]) => p.startsWith('공개 불가 — ')))
})

test('접두 표 전수: 모든 접두가 input·quality 목록 중 정확히 한 곳에 있다(빠지거나 둘 다에 있으면 실패)', () => {
  for (const [name, prefix] of TABLES) {
    const n = (INPUT_PREFIXES.includes(prefix) ? 1 : 0) + (QUALITY_PREFIXES.includes(prefix) ? 1 : 0)
    assert.equal(n, 1, `${name} = 「${prefix}」 는 분류 목록(blocker-class.mjs)에 정확히 한 번 있어야 한다 — 지금 ${n}번`)
  }
})

test('접두 표 전수: blockerClass 가 목록의 갈래를 그대로 돌려준다(접두 뒤에 무엇이 와도)', () => {
  for (const [name, prefix] of TABLES) {
    assert.equal(blockerClass(`${prefix}임의의 뒷부분 home/hero`), KIND_OF(prefix), name)
    assert.equal(blockerClass(prefix), KIND_OF(prefix), `${name} (접두만)`)
  }
})

test('분류 목록에 낡은 접두가 없다: 목록의 모든 접두는 어느 접두 표에도 실제로 있고, 두 목록은 겹치지 않는다', () => {
  const all = new Set(TABLES.map(([, p]) => p))
  for (const p of [...INPUT_PREFIXES, ...QUALITY_PREFIXES]) assert.ok(all.has(p), `분류 목록의 「${p}」 가 접두 표에 없다 — 표에서 빠졌으면 목록에서도 뺀다`)
  assert.deepEqual(INPUT_PREFIXES.filter((p) => QUALITY_PREFIXES.includes(p)), [])
  assert.equal(new Set([...INPUT_PREFIXES, ...QUALITY_PREFIXES]).size, INPUT_PREFIXES.length + QUALITY_PREFIXES.length, '목록 안에 같은 접두가 두 번 없다')
})

test('접두 모호성: 한 접두가 다른 접두의 앞부분이면 두 접두는 같은 갈래다(startsWith 로 갈래를 정하므로)', () => {
  for (const [na, a] of TABLES) for (const [nb, b] of TABLES) if (a !== b && a.startsWith(b)) assert.equal(KIND_OF(a), KIND_OF(b), `${na} 는 ${nb} 로 시작한다`)
})

test('input 은 운영자가 말한 다섯 가지다: 실제 사진 필요 · 사이트 주소 미정 · 확인 필요 사실 · 예시 연락처 · 법률 검토 미완', () => {
  assert.deepEqual([...INPUT_PREFIXES].sort(), [BLOCKER.photo, BLOCKER.site, BLOCKER.fact, BLOCKER.reserved, QA_PREFIX.legalPending].sort())
})

test('새 접두는 표에만 더하면 안 된다: 접두 표를 가진 소스(gen-pages·qa·sitemap)의 「공개 불가 — 」 글자 상수는 전부 분류 목록의 접두로 시작한다', () => {
  const known = [...INPUT_PREFIXES, ...QUALITY_PREFIXES]
  let seen = 0
  for (const file of ['gen-pages.mjs', 'qa.mjs', 'sitemap.mjs']) {
    const src = readFileSync(join(STAMP, file), 'utf8')
    for (const m of src.matchAll(/(['"`])(공개 불가 — [^'"`]*)/g)) {
      seen++
      assert.ok(known.some((p) => m[2].startsWith(p)), `${file}: 「${m[2]}」 는 분류 목록에 없는 접두다 — blocker-class.mjs 에 input·quality 로 더한다`)
    }
  }
  assert.ok(seen >= 20, `소스에서 읽은 글자 상수가 ${seen}개뿐이다 — 읽기가 깨졌다`)
})

// ② 대표 사례 10줄 — 실제 생성기가 내는 모양 그대로. 갈래는 고정이다.
const CASES = [
  ['공개 불가 — 실제 사진 필요: home/hero/product-ui (이미지 준비 중)', 'input'],
  ['공개 불가 — 사이트 주소 미정', 'input'],
  ['공개 불가 — 확인 필요 사실: business.phone', 'input'],
  ['공개 불가 — 예시 연락처(예약 도메인): business.email', 'input'],
  ['공개 불가 — 법률 검토 미완: privacy·terms — 조항 검토 전(legal-gate: 검토 파일 없음)', 'input'],
  ['공개 불가 — 법률 검토 실패: privacy c3 — fix: 근거 조문이 맞지 않는다', 'quality'],
  ['공개 불가 — 예시 문구 남음: home/hero — copy.title(예시 표지)', 'quality'],
  ['공개 불가 — 필수 섹션 블록 없음: home/notice (D44)', 'quality'],
  ['공개 불가 — 운영 점검 실패: lh-perf / — LCP 3.1s', 'quality'],
  ['07-qa 가 공개 불가로 판정했지만 사유가 기록되지 않았다 — 07-qa/summary.json 을 확인한다', 'quality'],
]
test('대표 사례 10줄: 갈래가 고정이다(접두가 없는 문장은 quality)', () => {
  assert.equal(CASES.length, 10)
  for (const [line, kind] of CASES) assert.equal(blockerClass(line), kind, line)
})

test('접두에 이어붙지 않은 글은 quality 다: 가운데에 입력 접두가 들어 있어도 · 빈 값 · 문자열이 아닌 값', () => {
  assert.equal(blockerClass(`앞에 글이 있다 ${BLOCKER.fact}business.phone`), 'quality', '줄의 첫머리가 접두일 때만 input')
  for (const v of ['', undefined, null, 42, {}]) assert.equal(blockerClass(v), 'quality')
})

test('splitBlockers: 순서를 지키며 두 갈래로 나눈다 · 합이 원래 줄 수와 같다 · 입력을 바꾸지 않는다', () => {
  const lines = CASES.map(([l]) => l)
  const copy = [...lines]
  const r = splitBlockers(lines)
  assert.deepEqual(lines, copy)
  assert.deepEqual(r.input, CASES.filter(([, k]) => k === 'input').map(([l]) => l))
  assert.deepEqual(r.quality, CASES.filter(([, k]) => k === 'quality').map(([l]) => l))
  assert.equal(r.input.length + r.quality.length, lines.length)
  assert.deepEqual(splitBlockers(undefined), { input: [], quality: [] })
  assert.deepEqual(splitBlockers([]), { input: [], quality: [] })
})

// ── FV1 5.2: 운영 점검의 facts-empty 줄은 입력 갈래다(확인 필요 사실이 비어서 생긴다) — 나머지 운영 점검 줄은 그대로 품질 ──
test('facts-empty 운영 점검 줄은 입력 대기다', () => {
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: facts-empty (확인 필요 사실 3칸)'), 'input')
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: facts-empty 3곳 — 「확인 필요」 3곳: business.phone · business.bizRegNo'), 'input')
  // describeCheck 가 앞에 붙이는 [레시피 쪽] 이름표가 있어도 같다
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: [r1-measure /] facts-empty 1곳'), 'input')
})
test('facts-empty 가 아닌 운영 점검 줄·가운데에 낱말이 낀 줄은 품질이다', () => {
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: cls 0.15 > 0.1'), 'quality')
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: lh-perf / — LCP 3.1s'), 'quality')
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: facts-empty-extra 1곳'), 'quality')
  assert.equal(blockerClass('공개 불가 — 운영 점검 실패: cls 0.2 — 근처에 facts-empty 가 있다'), 'quality')
  assert.equal(blockerClass('공개 불가 — 관문 실패: facts-empty'), 'quality')
})
test('splitBlockers: facts-empty 줄이 입력 쪽에 든다(순서 유지)', () => {
  const lines = ['공개 불가 — 운영 점검 실패: cls 0.15 > 0.1', '공개 불가 — 운영 점검 실패: facts-empty 2곳', '공개 불가 — 확인 필요 사실: business.phone']
  const r = splitBlockers(lines)
  assert.deepEqual(r.input, [lines[1], lines[2]])
  assert.deepEqual(r.quality, [lines[0]])
})
