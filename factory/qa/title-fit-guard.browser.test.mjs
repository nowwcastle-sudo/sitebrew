// 대장 C296 — 한 낱말 히어로의 크기 안전망(블록 원천의 useLayoutEffect)을 Chrome 에서 시험한다.
//   블록 원천(grid-lines-baseline-word.tsx)에서 효과 본문(guard + 관찰자 연결 + 정리 함수)을 그대로 뽑아(TS → JS) 시험 페이지의 제목 칸에 돌린다 — 복사본이 아니라 출하되는 코드다.
//   시험 페이지는 자간 0.3em 으로 글자를 넓혀 어림(titleFit)이 실제보다 좁게 나오는 경우를 서체와 상관없이 만든다.
//   · 안전망 없이: 어림이 설계 크기를 허락했는데 가장 긴 낱말이 칸 폭을 넘어 잘린다(음성 대조 — 새 글자 상자 검사가 잘림으로 잡는다).
//   · 안전망 뒤: 가장 긴 낱말이 칸 안쪽 폭 안에 들어오고 잘림 0. 글자 폭이 늦게 달라져도(서체 도착) 관찰자가 다시 재서 맞춘다.
//   · 이미 들어가는 제목(짧은 한글)은 안전망이 크기를 건드리지 않는다(설계 크기 유지).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/title-fit-guard.browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from './cdp.mjs'
import { textBoxScan } from './text-boxes.mjs'
import { loadTs } from '../stamp/ts-eval.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const ts = createRequire(join(root, 'package.json'))('typescript')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fit = await loadTs(join(root, 'registry', 'factory', 'blocks', '_shared', 'title-fit.tsx'))

// 블록 원천에서 useLayoutEffect 본문 → 실행 가능한 JS 함수 본문(ref 를 받고 정리 함수를 돌려준다)
function effectSource() {
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', 'hero', 'grid-lines-baseline-word.tsx'), 'utf8')
  const m = src.match(/React\.useLayoutEffect\(\(\) => \{\r?\n([\s\S]*?)\r?\n  \}, \[copy\.title, split, Display\]\)/)
  assert.ok(m, '블록 원천에서 안전망 효과를 못 찾았다')
  return ts.transpileModule(m[1], { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
const RUN_EFFECT = () => `(() => { window.__cleanup = (new Function('ref', ${JSON.stringify(effectSource())}))({ current: document.querySelector('.gw') }) })()`

const MEASURE = `(() => {
  const el = document.getElementById('word')
  const cs = getComputedStyle(el)
  const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const widest = Math.max(0, ...[...el.querySelectorAll('span.inline-block')].map((w) => w.offsetWidth))
  return { px: parseFloat(cs.fontSize), room, widest, inline: el.style.fontSize }
})()`

// 서체가 늦게 도착해 글자 폭이 달라지는 경우(칸 폭은 그대로): 자간 0 에서 안전망을 걸어 들어가는 것을 확인하고, 자간을 0.3em 으로 넓혀 관찰자가 다시 재는지 본다.
async function lateWidenCheck(ev) {
  await ev("(() => { window.__cleanup?.(); const el = document.getElementById('word'); el.style.letterSpacing = '0'; el.style.removeProperty('font-size') })()")
  await ev(RUN_EFFECT())
  await sleep(150)
  const fits = await ev(MEASURE)
  await ev("document.getElementById('word').style.letterSpacing = '0.3em'")
  await sleep(600)
  const widened = await ev(MEASURE)
  await ev('window.__cleanup?.()')
  return { fits, widened }
}

async function run(title, width, { guard, lateWiden = false }) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'tfg-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false })
    await navigateAndWait(send, ev, pathToFileURL(join(here, 'fixtures', 'title-fit-guard.html')).href + '#' + encodeURIComponent(title))
    await ev('document.fonts.ready.then(() => 1)')
    // 블록이 하듯 어림 크기를 --gw-size 로 넘긴다
    await ev(`document.getElementById('word').style.setProperty('--gw-size', '${fit.titleFit(title, 17.8).vw}vw')`)
    await sleep(200)
    const before = await ev(MEASURE)
    const scanBefore = await ev(`(${textBoxScan})({})`)
    if (guard) await ev(RUN_EFFECT())
    await sleep(300)
    const after = await ev(MEASURE)
    const scanAfter = await ev(`(${textBoxScan})({})`)
    const late = lateWiden ? await lateWidenCheck(ev) : null
    ws.close()
    return { before, after, scanBefore, scanAfter, late }
  } finally {
    await chrome.close()
  }
}

for (const width of [1440, 375]) {
  test(`C296 안전망 ${width}: 어림이 모자란 넓은 글자(자간 0.3em)의 긴 낱말은 안전망 없이는 칸을 넘어 잘리고, 안전망 뒤에는 칸 안에 든다(늦게 넓어져도 다시 맞춘다)`, async () => {
    const r = await run('WWWWWW', width, { guard: true, lateWiden: true })
    assert.equal(fit.titleFit('WWWWWW', 17.8).vw, 17.8, '어림은 설계 크기를 허락한다(그래서 안전망이 필요하다)')
    // 음성 대조: 안전망 전
    assert.ok(r.before.widest > r.before.room + 1, `안전망 전에 넘쳐야 한다 ${JSON.stringify(r.before)}`)
    assert.ok(r.scanBefore.clipped.length >= 1, `안전망 전: 새 검사가 잘림을 잡아야 한다 ${JSON.stringify(r.scanBefore)}`)
    // 안전망 뒤
    assert.ok(r.after.widest <= r.after.room + 1, `안전망 뒤 칸 안 ${JSON.stringify(r.after)}`)
    assert.ok(r.after.px < r.before.px, '글자 크기가 줄었다')
    assert.deepEqual(r.scanAfter.clipped, [], `안전망 뒤 잘림 0 ${JSON.stringify(r.scanAfter)}`)
    // 늦은 서체: 처음엔 들어가던 글자가 넓어져도 관찰자가 다시 재서 칸 안에 맞춘다
    assert.ok(r.late.fits.widest <= r.late.fits.room + 1, `자간 0 에서는 들어간다 ${JSON.stringify(r.late.fits)}`)
    assert.ok(r.late.widened.widest <= r.late.widened.room + 1, `글자가 넓어져도 다시 맞춘다 ${JSON.stringify(r.late.widened)}`)
    assert.ok(r.late.widened.px < r.late.fits.px, '넓어진 만큼 글자 크기가 줄었다')
  })
}

test('C296 안전망: 이미 들어가는 짧은 한글 낱말은 크기를 건드리지 않는다(설계 크기 유지)', async () => {
  const r = await run('달빛식빵', 1440, { guard: true })
  assert.ok(r.before.widest <= r.before.room, JSON.stringify(r.before))
  assert.equal(r.after.px, r.before.px)
  assert.equal(r.after.inline, '', '인라인 font-size 를 더하지 않는다')
  assert.deepEqual(r.scanAfter.clipped, [])
})
