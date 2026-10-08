// ux-gate 글자 상자 겹침·잘림 검사(대장 C296) — 순수 함수 시험(Chrome 없음) + 고정 시험 페이지 4벌(Chrome, ux-gate 를 자식 프로세스로 돌린다).
// 실행: node --test --test-force-exit --test-timeout=600000 factory/qa/text-boxes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { stableText, textBoxFailures } from './text-boxes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const run = (args) => new Promise((res) => { const p = spawn(process.execPath, args, { stdio: 'ignore' }); p.on('exit', (c) => res(c)) })
const fixture = (f) => join(here, 'fixtures', f)
const gateOf = async (file) => {
  const out = mkdtempSync(join(tmpdir(), 'tb-'))
  const code = await run([join(here, 'ux-gate.mjs'), pathToFileURL(file).href, out])
  const f = join(out, 'ux_gate.json')
  return { code, g: existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
}
const KEYS = ['1440-light', '1440-dark', '375-light', '375-dark']

test('C296 순수: 글 줄을 하나도 못 쟀으면 통과가 아니라 실패다(n/a 는 통과가 아니다)', () => {
  assert.deepEqual(textBoxFailures('k', { textLines: 0, overlaps: [], clipped: [] }), ['k: no text boxes measured (textLines 0)'])
  assert.deepEqual(textBoxFailures('k', undefined), ['k: no text boxes measured (textLines 0)'])
  assert.deepEqual(textBoxFailures('k', { textLines: 5, overlaps: [], clipped: [] }), [])
})

test('C296 순수: 실패 줄은 겹침·잘림을 각각 개수와 표본으로 적는다', () => {
  const f = textBoxFailures('1440-light', { textLines: 9, overlaps: [{ a: 'p.cap 「월-금」', b: 'h1#word 「마」', ratio: 1 }], clipped: [{ text: '터', tag: 'h1#word', axis: 'x', visible: 0.4 }] })
  assert.equal(f.length, 2)
  assert.match(f[0], /^1440-light: text overlap x1 — p\.cap 「월-금」 × h1#word 「마」$/)
  assert.match(f[1], /^1440-light: text clipped by ancestor x1 — h1#word 「터」 x 0\.4$/)
})

test('C296 순수: 두 번 잰 결과에서 두 번 다 나온 것만 남긴다(등장 연출 도중의 일시적 겹침을 거른다)', () => {
  const o = (a, b) => ({ a, b, ratio: 1 })
  const c = (tag, text) => ({ tag, text, axis: 'x', visible: 0.5 })
  const r = stableText({ textLines: 10, overlaps: [o('a', 'b'), o('c', 'd')], clipped: [c('h1', 'x'), c('p', 'y')] }, { textLines: 8, overlaps: [o('a', 'b')], clipped: [c('p', 'y')] })
  assert.equal(r.textLines, 8)
  assert.deepEqual(r.overlaps.map((x) => x.a), ['a'])
  assert.deepEqual(r.clipped.map((x) => x.tag), ['p'])
})

test('C296 재현 페이지(옛 한 낱말 히어로: 긴 제목 + 절대 배치 캡션)는 네 조합(1440·375 × 라이트·다크) 모두 겹침과 잘림으로 실패한다', async () => {
  const { code, g } = await gateOf(fixture('text-overlap-bad.html'))
  assert.equal(code, 3)
  for (const k of KEYS) {
    const tb = g.gate[k].textBoxes
    assert.ok(tb.textLines >= 10, `${k}: textLines ${tb.textLines}`)
    assert.ok(tb.overlaps.length >= 1, `${k}: 겹침 없음 ${JSON.stringify(tb)}`)
    assert.ok(tb.overlaps.some((o) => /p\.cap/.test(o.a + o.b) && /h1#word/.test(o.a + o.b)), `${k}: 캡션×제목 ${JSON.stringify(tb.overlaps)}`)
    assert.ok(tb.clipped.length >= 1 && tb.clipped.some((c) => c.tag.startsWith('h1#word')), `${k}: 잘림 없음 ${JSON.stringify(tb.clipped)}`)
  }
  // 이 결함의 실패는 이 두 규칙뿐이어야 한다(내비·대비·가로 스크롤은 멀쩡한 페이지)
  const rules = g.fail.map((x) => x.replace(/^[^:]+: /, '').replace(/ x\d+.*$/, ''))
  assert.deepEqual([...new Set(rules)].sort(), ['text clipped by ancestor', 'text overlap'], g.fail.join(' | '))
})

test('C296 음성 대조: 고친 모양(캡션이 흐름 안, 제목은 글자 크기를 줄여 줄을 나눈다)은 같은 제목·캡션으로 통과한다', async () => {
  const { code, g } = await gateOf(fixture('text-overlap-clean.html'))
  assert.equal(code, 0, g?.fail?.join(' | '))
  for (const k of KEYS) {
    const tb = g.gate[k].textBoxes
    assert.ok(tb.textLines >= 10, `${k}: textLines ${tb.textLines}`)
    assert.deepEqual(tb.overlaps, [], k)
    assert.deepEqual(tb.clipped, [], k)
  }
})

test('C296 면제: aria-hidden 장식·data-decorative·data-clip-ok·고정 막대·불투명도 0 슬라이드·말줄임(옆 배지 자리까지 뻗어도 가려진 만큼은 겹침 아님)·줄 수 제한·접힌 패널·SVG 라벨·같은 제목 안의 좁은 행간은 통과한다', async () => {
  const { code, g } = await gateOf(fixture('text-overlap-exempt.html'))
  assert.equal(code, 0, g?.fail?.join(' | '))
  for (const k of KEYS) {
    const tb = g.gate[k].textBoxes
    assert.ok(tb.textLines >= 8, `${k}: textLines ${tb.textLines}`)
    assert.deepEqual(tb.overlaps, [], `${k} ${JSON.stringify(tb.overlaps)}`)
    assert.deepEqual(tb.clipped, [], `${k} ${JSON.stringify(tb.clipped)}`)
  }
})

test('C296 면제 음성 대조: 같은 페이지에서 면제 표지를 지우면(장식 표지·고정 막대·불투명도 0·말줄임·줄 수 제한·data-clip-ok·가리개) 각각 겹침·잘림으로 실패한다', async () => {
  let html = readFileSync(fixture('text-overlap-exempt.html'), 'utf8')
  const swap = (from, to) => { assert.ok(html.includes(from), `${from} 가 시험 페이지에 없다`); html = html.replace(from, to) }
  swap('<p class="deco-word" aria-hidden="true">', '<p class="deco-word">') // ① aria-hidden 장식
  swap(' data-decorative>', '>') // ② data-decorative
  swap('.bar { position: fixed; left: 0; right: 0; bottom: 0;', '.bar { position: absolute; left: 0; right: 0; top: 100px;') // ③ 고정 막대 → 본문 위에 놓인 일반 상자
  swap('.slide.off { opacity: 0; }', '.slide.off { opacity: 1; }') // ④ 불투명도 0 슬라이드가 보이는 슬라이드와 겹침
  swap('text-overflow: ellipsis;', 'text-overflow: clip;') // ⑤ 말줄임 없이 잘리는 한 줄
  swap('-webkit-line-clamp: 2;', 'max-height: 3.5em; line-height: 1.5;') // ⑤ 줄 수 제한 없이 상자가 줄을 반쯤 자름
  swap('<div class="crop" data-clip-ok>', '<div class="crop">') // ⑧ 일부러 자른 글 표지
  swap('.trunc { flex: 1; min-width: 0; overflow: hidden;', '.trunc { flex: 1; min-width: 0;') // ⑨ 가리지 않으면 글이 배지 위로 뻗어 겹친다
  const file = join(mkdtempSync(join(tmpdir(), 'tb-')), 'exempt-off.html')
  writeFileSync(file, html)
  const { code, g } = await gateOf(file)
  assert.equal(code, 3, '면제 표지를 지웠는데 통과했다')
  for (const k of KEYS) {
    const tb = g.gate[k].textBoxes
    const over = tb.overlaps.map((o) => o.a + ' ' + o.b).join(' / ')
    assert.match(over, /GRANDMA/, `${k}: ① ${over}`)
    assert.match(over, /NEW/, `${k}: ② ${over}`)
    assert.match(over, /전화 02-1234-5678/, `${k}: ③ ${over}`)
    assert.match(over, /(첫 번째|두 번째) 슬라이드/, `${k}: ④ ${over}`)
    const clip = tb.clipped.map((c) => c.tag).join(' / ')
    assert.match(clip, /p\.clamp/, `${k}: ⑤ 말줄임 ${clip}`)
    assert.match(clip, /p\.lines/, `${k}: ⑤ 줄 수 ${clip}`)
    assert.match(clip, /p\.crop-line/, `${k}: ⑧ ${clip}`)
    assert.match(over, /조치 중/, `${k}: ⑨ ${over}`)
  }
})
