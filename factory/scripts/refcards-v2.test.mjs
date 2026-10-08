// 레퍼런스 패턴 카드 v2 검사(factory v1 Task 2.2). 카드 폴더는 references/patterns-v2/*.json.
// 원천은 저장소 밖 수집 폴더($WF_DESIGN_RULES_DIR/factory/refs-v2/cards)이고, 이 폴더는 부적합 카드를 교체한 뒤의 사본이다.
// 실행: node --test factory/scripts/refcards-v2.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RefCardV2, ARCHETYPES, longQuotes } from '../../references/patterns-v2/_schema.mjs'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references', 'patterns-v2')
const cards = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, card: JSON.parse(readFileSync(join(DIR, f), 'utf8')) }))

// 적합도 미달 = gap-matrix 와 같은 정의(점수 0.5 미만이거나 자기 원형이 적합 원형 목록에 없음).
const misfit = (c) => c.fit.score < 0.5 || !c.fit.archetypes.includes(c.archetype)

// 대담 카드가 5장에 못 미친 원형과 실측 값(2026-10-10 교체 레인 — 진짜 대담한 예시를 더 찾지 못했고 판정을 부풀리지 않았다).
// 값이 이보다 줄면 실패, 5장을 채우면 이 줄을 지워야 통과한다(낡은 예외를 남기지 않는다).
const BOLD_SHORTFALL = { local: 4, public: 4 }

test('카드 250장 이상 모두 스키마를 통과하고 파일 이름 = id', () => {
  assert.ok(cards.length >= 250, `카드 ${cards.length}장`)
  for (const { f, card } of cards) {
    const r = RefCardV2.safeParse(card)
    assert.ok(r.success, `${f}: ${r.success ? '' : r.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`)
    assert.equal(`${card.id}.json`, f)
  }
})

test('적합도 미달 카드 없음', () => {
  const bad = cards.filter(({ card }) => misfit(card)).map(({ f }) => f)
  assert.deepEqual(bad, [])
})

test('원형마다 25장 이상, 대담 카드는 원형마다 5장 이상(미달 기록 원형은 기록 값 이상)', () => {
  for (const a of ARCHETYPES) {
    const mine = cards.filter(({ card }) => card.archetype === a)
    assert.ok(mine.length >= 25, `${a}: ${mine.length}`)
    const bold = mine.filter(({ card }) => card.boldness === 'bold').length
    const floor = BOLD_SHORTFALL[a] ?? 5
    assert.ok(bold >= floor, `${a} bold ${bold} < ${floor}`)
    if (a in BOLD_SHORTFALL) assert.ok(bold < 5, `${a}: 대담 ${bold}장 — 5장을 채웠으니 BOLD_SHORTFALL 에서 지운다`)
  }
  for (const a of Object.keys(BOLD_SHORTFALL)) assert.ok(ARCHETYPES.includes(a), `없는 원형 ${a}`)
})

test('제3자 글 긴 인용 없음 · 같은 주소 두 번 없음', () => {
  for (const { f, card } of cards) assert.deepEqual(longQuotes(card), [], f)
  const urls = cards.map(({ card }) => new URL(card.url).host.replace(/^www\./, ''))
  assert.equal(new Set(urls).size, urls.length)
})

test('검사 도구 자체: 값 안의 12낱말 인용은 잡고, 짧은 인용·따옴표 없는 긴 서술은 통과(양성·음성 대조)', () => {
  assert.equal(longQuotes({ t: '헤드라인은 "one two three four five six seven eight nine ten eleven twelve" 였다' }).length, 1)
  assert.equal(longQuotes({ t: ['「하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열 열하나 열둘」'] }).length, 1)
  assert.equal(longQuotes({ t: '"short phrase only"' }).length, 0)
  assert.equal(longQuotes({ t: '첫 화면은 큰 제목 아래에 제품 사진 세 장을 가로로 놓고 아래로 내리면 후기와 요금 미리보기가 차례로 나온다' }).length, 0)
})
