// 대표 검수 화면 review — 3문장 holdout 으로 HTML 모양을 보고, 화면 스크립트를 가짜 DOM 에 돌려 내려받는 파일 모양을 확인한다.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'
import { buildHtml, readingText, run } from '../vocab/eval/review.mjs'
import { DEFAULT_FILE, loadLexicon } from '../vocab/lexicon.mjs'
import { HOLDOUT_MIN, NOTE_VERDICT, REVIEW_FILE, VERDICTS } from '../vocab/eval/score.mjs'

const cases = [
  { id: 'r-1', text: '글씨 크게', kind: 'axis', expect: [] }, // 확정
  { id: 'r-2', text: 'ㅋㅋㅋ', kind: 'none', expect: 'ask' }, // 모름
  { id: 'r-3', text: '둥글게 <b>해줘</b>', kind: 'axis', expect: [] }, // 확정 + 글자 이스케이프
]

test('3문장 → 카드 3개 · 버튼 9개 · 외부 스크립트 0개 · 한국어 버튼 글자', () => {
  const html = buildHtml(cases)
  assert.equal((html.match(/<section class="card"/g) ?? []).length, 3)
  assert.equal((html.match(/<button /g) ?? []).length, 9)
  assert.equal((html.match(/<script[^>]*\ssrc=/g) ?? []).length, 0)
  assert.doesNotMatch(html, /https?:\/\//, '네트워크 주소 없음')
  assert.doesNotMatch(html, /<link |@import|@font-face/, '외부 스타일·글꼴 없음')
  for (const t of ['맞음', '고침', '이건 물어봐야 함', '결과 파일 저장', '0/3 판정함']) assert.ok(html.includes(t), t)
  assert.match(html, /name="viewport"/)
})

test('제안 해석: 확정은 say 문장, 모름은 되묻는 말을 보이고 원문은 이스케이프한다', () => {
  const html = buildHtml(cases)
  assert.match(html, /class="say">[^<]*이해했어요/)
  assert.match(html, /잘 모르겠어요/)
  assert.ok(html.includes('&lt;b&gt;해줘&lt;/b&gt;'))
  assert.ok(!html.includes('<b>해줘</b>'))
})

test('최소 문장 수는 score.mjs 의 상수를 쓴다(100)', () => {
  assert.equal(HOLDOUT_MIN, 100)
  const src = readFileSync(new URL('../vocab/eval/review.mjs', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
  assert.ok(!/(?<![\w%.])100(?![\w%])/.test(src), '100 을 따로 적지 않았다(CSS 의 100% 는 제외)')
})

// 가짜 DOM: 화면 스크립트가 쓰는 만큼만 흉내 낸다
function fakePage(html, store) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const data = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)[1]
  const el = () => ({ listeners: {}, attrs: {}, cls: new Set(), hidden: false, value: '', textContent: '', addEventListener(t, f) { this.listeners[t] = f }, getAttribute(k) { return this.attrs[k] }, classList: { toggle() {} } })
  const ids = JSON.parse(data).ids
  const cards = ids.map((id) => {
    const c = el(); c.attrs['data-id'] = id
    c.note = el(); c.btns = ['ok', 'fix', 'ask'].map((v) => { const b = el(); b.attrs['data-v'] = v; return b })
    c.querySelector = () => c.note
    c.querySelectorAll = () => c.btns
    return c
  })
  const dl = el(), progress = el(), msg = el(), dataEl = { textContent: data }
  const saved = []
  const doc = {
    getElementById: (id) => ({ data: dataEl, dl, progress, msg })[id],
    querySelectorAll: () => cards,
    createElement: () => ({ click() { saved.push(this) }, remove() {} }),
    body: { appendChild() {} },
  }
  const Blob = class { constructor(parts, o) { this.text = parts.join(''); this.type = o.type } }
  const URL = { createObjectURL: (b) => { saved.blob = b; return 'blob:x' } }
  const localStorage = store ? { getItem: () => store.v ?? null, setItem: (k, v) => { store.v = v } } : { getItem() { throw new Error('막힘') }, setItem() { throw new Error('막힘') } }
  vm.runInNewContext(script, { document: doc, localStorage, Blob, URL, JSON, Date, Array })
  return { cards, dl, progress, msg, saved }
}

test('화면 스크립트: 판정 → 진행 줄 · 내려받는 파일이 {reviewedAt, verdicts} 모양 · 메모는 「고침」만', () => {
  const store = {}
  const p = fakePage(buildHtml(cases), store)
  assert.equal(p.progress.textContent, '0/3 판정함')
  p.cards[0].btns[0].listeners.click() // ok
  p.cards[1].btns[1].listeners.click() // fix
  p.cards[1].note.listeners.input({ target: { value: ' 더 크게 ' } })
  p.cards[2].btns[2].listeners.click() // ask
  p.cards[2].note.listeners.input({ target: { value: '무시됨' } })
  assert.equal(p.progress.textContent, '3/3 판정함')
  p.dl.listeners.click()
  const out = JSON.parse(p.saved.blob.text)
  assert.deepEqual(Object.keys(out).sort(), ['reviewedAt', 'verdicts'])
  assert.ok(!Number.isNaN(Date.parse(out.reviewedAt)))
  assert.deepEqual(out.verdicts, { 'r-1': { verdict: 'ok' }, 'r-2': { verdict: 'fix', note: '더 크게' }, 'r-3': { verdict: 'ask' } })
  assert.equal(p.saved[0].download, 'holdout.review.json')
  // 창을 닫았다 열면 이어서
  const again = fakePage(buildHtml(cases), store)
  assert.equal(again.progress.textContent, '3/3 판정함')
})

test('고침(메모) → 맞음 → 고침: 화면의 메모가 상태와 내려받는 파일에 남는다', () => {
  const store = {}
  const p = fakePage(buildHtml(cases), store)
  p.cards[0].btns[1].listeners.click() // fix
  p.cards[0].note.listeners.input({ target: { value: '더 크게' } })
  p.cards[0].btns[0].listeners.click() // ok
  p.cards[0].btns[1].listeners.click() // fix again
  p.dl.listeners.click()
  assert.deepEqual(JSON.parse(p.saved.blob.text).verdicts['r-1'], { verdict: 'fix', note: '더 크게' })
  assert.match(store.v, /더 크게/, '새로 열어도 메모가 남는다')
  // 맞음으로 끝내면 메모는 파일에 안 나간다
  p.cards[0].btns[0].listeners.click()
  p.dl.listeners.click()
  assert.deepEqual(JSON.parse(p.saved.blob.text).verdicts['r-1'], { verdict: 'ok' })
})

test('판정 목록·메모 판정·파일 이름은 score.mjs 에서 와서 화면 코드에 글자로 반복되지 않는다', () => {
  const html = buildHtml(cases)
  assert.deepEqual([...html.matchAll(/class="v" data-v="(\w+)"/g)].slice(0, 3).map((m) => m[1]), [...VERDICTS])
  const src = readFileSync(new URL('../vocab/eval/review.mjs', import.meta.url), 'utf8')
  assert.ok(!/holdout\.(jsonl|review\.json)/.test(src.replace(/\/\/.*$/gm, '')), '파일 이름을 따로 적지 않았다')
  assert.ok(!/===\s*'fix'/.test(src))
  const data = JSON.parse(html.match(/id="data">([\s\S]*?)<\/script>/)[1])
  assert.deepEqual(Object.keys(data).sort(), ['ids', 'noteVerdict', 'reviewFile', 'total'])
  assert.equal(data.reviewFile, REVIEW_FILE)
  assert.equal(data.noteVerdict, NOTE_VERDICT)
})

test('값 id 대신 사전의 한국어 이름을 보인다(고급스러움 → 글꼴)', () => {
  const html = buildHtml([{ id: 'v-1', text: '고급스럽게 해줘', kind: 'impression', expect: [] }])
  assert.ok(html.includes('명조나 가는 고딕'))
  assert.ok(!html.includes('serif-or-thin-sans'))
})

test('localStorage 가 막혀 있어도 화면은 돈다', () => {
  const p = fakePage(buildHtml(cases), null)
  p.cards[0].btns[0].listeners.click()
  assert.equal(p.progress.textContent, '1/3 판정함')
  p.dl.listeners.click()
  assert.equal(JSON.parse(p.saved.blob.text).verdicts['r-1'].verdict, 'ok')
  assert.match(p.msg.textContent, /2개/)
})

test('축 목록 글: 끝 이름 · 값 이름 · 상한 · 범위를 한국어로', () => {
  const lex = loadLexicon()
  assert.equal(readingText({ axis: 'shape', direction: 'round' }, lex), '모서리: 둥글게')
  assert.equal(readingText({ axis: 'type-family', value: 'clear-sans' }, lex), '글꼴: 또박또박한 고딕')
  assert.equal(readingText({ axis: 'type-family', value: 'no-label' }, lex), '글꼴: no-label', '이름이 없으면 값 그대로(사전 검사가 막는 경우)')
  assert.equal(readingText({ axis: 'color-temperature', direction: 'cool', cap: true, scope: 'element:버튼' }, lex), '색 온도: 차갑게 (그 쪽으로 더 가지 않게 · 「버튼」에만)')
  assert.match(readingText({ axis: 'spacing', direction: 'airy', scope: 'section:hero' }, lex), /「hero」 구획에만/)
  assert.match(readingText({ axis: 'spacing', direction: 'airy', scope: 'page:home' }, lex), /「home」 쪽에만/)
  assert.equal(readingText({ axis: 'unknown-axis', direction: 'x' }, lex), 'unknown-axis: x')
})

test('후보 둘 · 선택지가 있는 모름은 모두 보인다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-lex-'))
  try {
    const f = join(dir, 'lex.yaml')
    const extra = `
  - id: stuffy
    kind: diagnosis
    label: 답답함
    match: { ko: ["막막"] }
    causes:
      - { reading: [{ axis: spacing, direction: airy, strength: 1 }], say: "여백이 좁아서" }
      - { reading: [{ axis: type-scale, direction: smaller, strength: 1 }], say: "글자가 커서" }
    ask: "어디가 답답해 보여요?"
  - id: lone
    kind: diagnosis
    label: 흔함
    match: { ko: ["그저그래"] }
    causes:
      - { reading: [{ axis: contrast, direction: crisp, strength: 1 }], say: "대비가 약해서" }
    ask: "어디가 흔해 보여요?"
`
    writeFileSync(f, `${readFileSync(DEFAULT_FILE, 'utf8')}\n${extra}\n`)
    const html = buildHtml([{ id: 'd-1', text: '막막해' }, { id: 'd-2', text: '그저그래' }], loadLexicon(f))
    assert.match(html, /두 가지로 읽혀요/)
    assert.ok(html.includes('여백이 좁아서') && html.includes('글자가 커서'))
    assert.ok(html.includes('어디가 흔해 보여요?') && html.includes('대비가 약해서'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('run: holdout.jsonl 로 HTML 파일을 쓴다 · 파일이 없으면 종료 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-'))
  try {
    const out = join(dir, 'sub', 'vocab-review.html')
    assert.equal(run({ dir, out, log: () => {} }), 2)
    writeFileSync(join(dir, 'holdout.jsonl'), cases.map((c) => JSON.stringify(c)).join('\n') + '\n')
    const logs = []
    assert.equal(run({ dir, out, log: (s) => logs.push(s) }), 0)
    assert.equal((readFileSync(out, 'utf8').match(/<section class="card"/g) ?? []).length, 3)
    assert.match(logs.join('\n'), /주의: 시험 문장이 3개/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
