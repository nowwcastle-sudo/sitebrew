// 지금 사이트와 2안 비교 화면(계획 2 Task 8) — 판(version 2)을 읽어 09-revise/<번호>/compare.html 을 쓴다.
//   · writeCompare: 칸 수 · 안마다 바뀐 곳 · 축 영어 id 없음 · 안 하나뿐 · 글자 이스케이프 · 색 견본 · 상대 링크
//   · revise(): 판을 쓰면 비교 화면도 같은 폴더에 생긴다(실제 06, install: false)
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { grammar } from '../vocab/grammar.mjs'
import { loadLexicon } from '../vocab/lexicon.mjs'
import { writeCompare } from '../stamp/revise-compare.mjs'
import { revise } from '../stamp/revise.mjs'
import { fixtureRun } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-compare-test')
mkdirSync(TMP, { recursive: true })
let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const lex = loadLexicon()
const C = grammar.text.compare
const count = (html, needle) => html.split(needle).length - 1
const visibleText = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')
const colors = (bg, primary) => ({ background: bg, foreground: 'oklch(0.2 0 0)', accent: primary })
const variant = (id, changes, extra = {}) => ({ id, say: `해석 ${id}`, changes, siteRel: `a/09-revise/3/${id}/run/a/site`, ...extra })
const board = (variants, extra = {}) => ({
  kind: 'revise-board', version: 2, index: 3, candidate: 'a', request: '여백을 넓게', say: '전체 해석', before: { head: { color: colors('oklch(0.98 0 0)', 'oklch(0.5 0.2 30)') } }, variants, ...extra,
})
const TWO = board([
  variant('v1', [{ axis: 'spacing', from: '지금', to: '한 칸 더 시원하게' }]),
  variant('v2', [{ axis: 'spacing', from: '지금', to: '두 칸 더 시원하게' }, { axis: 'shape', from: '지금', to: '한 칸 더 둥글게' }]),
])
const write = (b) => { const d = join(dir, '09-revise', '3'); mkdirSync(d, { recursive: true }); return readFileSync(writeCompare(d, b, lex), 'utf8') }

test('세 칸, 안마다 changes 줄 수만큼 바뀐 곳', () => {
  const html = write(TWO)
  assert.equal(count(html, 'class="col"'), 3, '지금 · 안 a · 안 b')
  const cols = html.split('class="col"').slice(1)
  assert.ok(cols[0].includes(C.now.ko))
  assert.equal(count(cols[1], '<li class="change">'), 1)
  assert.equal(count(cols[2], '<li class="change">'), 2)
  assert.match(cols[2], /해석 v2/)
  assert.match(cols[2], /여백: 지금 → 두 칸 더 시원하게/, '축 이름은 사전 label')
  assert.match(cols[2], /모서리: 지금 → 한 칸 더 둥글게/)
})

test('화면 글에 축 영어 id(spacing 등)가 없다', () => {
  const html = write(TWO)
  const text = visibleText(html)
  for (const id of Object.keys(lex.axes)) assert.equal(text.includes(id), false, `화면 글에 ${id}`)
  assert.equal(html.includes('spacing'), false, '속성·클래스에도 축 id 를 싣지 않는다')
})

test('안 하나뿐: 두 칸 + grammar.onlyOne', () => {
  const one = [variant('v1', [{ axis: 'spacing', from: '지금', to: '한 칸 더 시원하게' }])]
  const html = write(board(one, { why: grammar.text.plan.onlyOne }))
  assert.equal(count(html, 'class="col"'), 2)
  assert.ok(html.includes(grammar.text.plan.onlyOne))
  assert.ok(write(board(one)).includes(grammar.text.plan.onlyOne), '까닭이 판에 없어도 같은 문장')
})

test('색 축 변경이면 이전·이후 견본, 색이 같으면 견본 없음', () => {
  const html = write(board([
    variant('v1', [{ axis: 'color-hue', from: '지금', to: '파랑' }], { colors: colors('oklch(0.2 0 0)', 'oklch(0.6 0.2 250)') }),
    variant('v2', [{ axis: 'spacing', from: '지금', to: '한 칸 더 시원하게' }], { colors: colors('oklch(0.98 0 0)', 'oklch(0.5 0.2 30)') }),
  ]))
  const cols = html.split('class="col"').slice(1)
  assert.equal(count(cols[1], 'class="swatch"'), 6, '안 a: 이전 3 + 이후 3')
  assert.ok(cols[1].includes('oklch(0.6 0.2 250)') && cols[1].includes('oklch(0.5 0.2 30)'))
  assert.equal(count(cols[2], 'class="swatch"'), 0)
  assert.ok(cols[1].includes(C.swatchBefore.ko))
})

test('영어로 말한 요청이면 영어 화면 글, 글자는 이스케이프한다', () => {
  const html = write(board([variant('v1', [{ axis: 'color-hue', from: '<b>', to: 'a&"b' }], { say: '<script>x</script>' })], { request: 'make it airy' }))
  assert.match(html, /lang="en"/)
  assert.ok(html.includes(C.now.en))
  assert.equal(html.includes('<script'), false)
  assert.ok(html.includes('&lt;script&gt;') && html.includes('a&amp;&quot;b'))
})

test('링크는 사이트 폴더 기준 상대 경로, 절대 경로 없음', () => {
  const html = write(board([variant('v1', [{ axis: 'type-scale', section: 'home/hero', from: 'hero-a', to: 'hero-b' }])]))
  assert.ok(html.includes('href="../../site"'), '지금 사이트')
  assert.ok(html.includes('href="v1/run/a/site"'), '안 사본')
  assert.equal(/href="(?:[a-zA-Z]:|\/|file:|https?:)/.test(html), false)
  assert.equal(/<(?:script|link)\b/.test(html), false, '외부 스크립트·글꼴 없음')
})

test('구획 판은 구획 이름과 블록 구성 글만 보인다 — 구획 키(home/hero)·블록 id 는 화면에 없다', () => {
  const change = (to) => [{ axis: 'type-scale', section: 'home/hero', from: 'block-hero-punch-in-statement', to }]
  const html = write(board([variant('v1', change('block-hero-banded-full-bleed')), variant('v2', change('hero-unknown'))]))
  const text = visibleText(html)
  assert.match(text, /글자 크기 · 히어로: 지금 → 불투명 머리 띠 아래 전폭 영상 \+ 좌상단 한 줄/, '구획은 사전 이름표, 블록은 레지스트리 제목의 구성 설명')
  assert.match(text, /글자 크기 · 히어로: 지금 → 다른 구성/, '레지스트리에 없는 블록은 중립 글')
  assert.equal(/home\/hero|block-hero|hero-unknown/.test(html), false)
  const en = visibleText(write(board([variant('v1', change('block-hero-banded-full-bleed'))], { request: 'make the hero bolder' })))
  assert.match(en, /· hero: Now → another layout/, '영어 화면은 영어 구획 이름과 중립 글')
})

test('안 이름은 「1안 (v1)」 — 칸 순서와 명령줄 --revise-pick 의 안 번호가 함께 보인다', () => {
  const html = write(TWO)
  assert.match(html, /<h2>1안 \(v1\)<\/h2>/)
  assert.match(html, /<h2>2안 \(v2\)<\/h2>/)
  assert.match(visibleText(write(board([variant('v1', [{ axis: 'spacing', from: '지금', to: '한 칸 더 시원하게' }])], { request: 'make it airy' }))), /Option 1 \(v1\)/)
})

test('판의 까닭(why)은 구획 판에도 화면에 보인다', () => {
  const one = [variant('v1', [{ axis: 'type-scale', section: 'home/hero', from: 'a', to: 'block-hero-banded-full-bleed' }])]
  assert.ok(write(board(one, { why: '더 대담한 쪽 변형이 1개뿐이에요.' })).includes('더 대담한 쪽 변형이 1개뿐이에요.'))
})

test('revise(): 판을 쓰면 compare.html 도 같은 폴더에 생긴다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', { scope: 'design', input: { readings: [{ axis: 'shape', direction: 'round', scope: 'site', strength: 1 }] }, text: null }, { install: false })
  const file = join(out.boardFile, '..', 'compare.html')
  assert.ok(existsSync(file))
  const html = readFileSync(file, 'utf8')
  assert.equal(count(html, 'class="col"'), 1 + out.variants.length)
  assert.match(html, /모서리/)
})

test('색 값 검증: 16진수·숫자 oklch 만 견본이 되고 주입 값은 견본도 url( 도 없다', () => {
  const evil = ['red;background:url(https://evil/x)', 'oklch(0.5 0.1 30);x:y', 'oklch(0.5 0.1 30) url(x)']
  for (const bad of evil) {
    const html = write(board([variant('v1', [{ axis: 'color-hue', from: '지금', to: '파랑' }], { colors: colors(bad, bad) })]))
    assert.equal(html.includes('url('), false, bad)
    assert.equal(html.includes(bad), false, bad)
    assert.equal(count(html, 'class="swatch"'), 4, `${bad}: 지금 3 + 안의 foreground 1`)
  }
  const ok = write(board([variant('v1', [{ axis: 'color-hue', from: '지금', to: '파랑' }], { colors: { background: '#fff', foreground: '#1a2b3c', accent: 'oklch(0.5 0.1 30 / 0.5)' } })]))
  assert.equal(count(ok, 'class="swatch"'), 6)
})

test('영어 화면에는 한국어 축 이름·「지금」이 없고, 모르는 축 id 는 중립 글로 대신한다', () => {
  const html = write(board([variant('v1', [{ axis: 'spacing', from: grammar.text.step.current, to: 'airier' }, { axis: 'no-such-axis', from: '', to: 'x' }])], { request: 'make it airy' }))
  const text = visibleText(html)
  assert.equal(/[가-힣]/.test(text.replace('해석 v1', '')), false, text)
  assert.ok(text.includes(`${C.axisFallback.en}: ${C.now.en} → airier`))
  const ko = write(board([variant('v1', [{ axis: 'no-such-axis', from: '', to: 'x' }])]))
  assert.ok(ko.includes(`${C.axisFallback.ko}: ${C.now.ko} → x`))
})

test('색 필드가 없는 옛 판 · 안이 없는 판(지금 칸 + 까닭/되물음 줄)도 그려진다', () => {
  const old = write({ ...TWO, before: { head: {} } })
  assert.equal(count(old, 'class="col"'), 3)
  assert.equal(count(old, 'class="swatch"'), 0)
  const none = write(board([], { why: '까닭 줄' }))
  assert.equal(count(none, 'class="col"'), 1)
  assert.ok(none.includes('까닭 줄'))
  assert.ok(write(board([], { ask: '되물음 줄' })).includes('되물음 줄'))
})
