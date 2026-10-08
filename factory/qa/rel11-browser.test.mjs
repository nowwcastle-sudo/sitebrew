// REL11 (v0.0.11) 브라우저 회귀 시험 — 고치기 전에는 실패해야 한다.
//   5) bottom-bar-space: 동작 줄이기(prefers-reduced-motion: reduce)에서 본문이 자란 뒤 다시 재면 여백이 0 에 가까워져 바닥글이 쿠키 띠 밑에 남는다
//      원인: factory-base 가 동작 줄이기에서 모든 요소에 `transition-duration: 0.01ms` 를 건다 — 여백을 걷었다 다시 재는 방식은 padding-bottom 전환이 막 시작된 상태에서
//      전환 시작 값(옛 여백)을 읽어 「이미 문서 끝에 빈 자리가 있다」고 오판한다. 문서가 화면보다 짧을 때도 scrollHeight 가 화면 높이로 고정되어 같은 오판을 한다.
//   (갤러리 블록 시험 2·3·6 — 업그레이드 대화상자 390px 넘침 · 진짜 마우스 제출의 첫 오류 칸 포커스 · 행동 줄 높이만큼의 스크롤 여백 — 은 갤러리 서버가 필요해 rel11-gallery.test.mjs 에 있다)
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/rel11-browser.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const ts = createRequire(join(root, 'package.json'))('typescript')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withChrome(fn, { width = 1024, height = 800, motion = 'no-preference' } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'rel11-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: motion }] })
    try { return await fn({ send, ev }) } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
}

// ── 5) bottom-bar-space ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 원천에서 훅 모듈을 그대로 뽑는다(TS → JS, React 는 효과를 바로 돌리는 대역) — 복사본이 아니라 출하되는 코드다.
function hookSource() {
  const src = readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'bottom-bar-space.tsx'), 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return js.replace(/^import .*$/m, '').replace(/^export /gm, '')
}
// factory-base 의 실제 동작 줄이기 규칙(모든 요소 전환 0.01ms)을 그대로 싣는다
function reducedMotionRule() {
  const css = readFileSync(join(root, 'registry', 'factory', 'base', 'factory-base.css'), 'utf8')
  const m = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{[^}]*\}\s*\}/)
  assert.ok(m, 'factory-base.css 에서 동작 줄이기 규칙을 못 찾았다')
  return m[0]
}
const MOUNT = () => `(() => {
  const React = { useLayoutEffect: (fn) => { window.__cleanup = fn() } }
  ${hookSource()}
  const style = document.createElement('style'); style.textContent = ${JSON.stringify(reducedMotionRule())}; document.head.append(style)
  useBottomBarSpace({ current: document.getElementById('bar') }, { pad: true })
})()`
// 문서 맨 아래까지 스크롤했을 때 바닥글 아래 끝이 띠 위끝보다 위에 있는가(띠가 바닥글을 가리지 않는가)
const REACHABLE = `(() => {
  scrollTo(0, document.documentElement.scrollHeight)
  const f = document.getElementById('footer').getBoundingClientRect(), b = document.getElementById('bar').getBoundingClientRect()
  return { footerBottom: Math.round(f.bottom * 100) / 100, barTop: Math.round(b.top * 100) / 100, ok: f.bottom <= b.top + 0.5, pad: document.documentElement.style.paddingBottom, scrollH: document.documentElement.scrollHeight, innerH: innerHeight }
})()`

for (const motion of ['reduce', 'no-preference']) {
  test(`REL11-5: bottom-bar-space(pad) — ${motion === 'reduce' ? '동작 줄이기에서' : '동작 줄이기 없이'} 본문이 자라 다시 재도 바닥글이 쿠키 띠 밑에 남지 않는다`, async () => {
    await withChrome(async ({ send, ev }) => {
      await navigateAndWait(send, ev, pathToFileURL(join(here, 'fixtures', 'rel11', 'bottom-bar.html')).href)
      // 내용 높이 300 + 바닥글 60 = 360 — 화면(800)보다 짧으니 먼저 문서를 화면보다 길게 만든다(길이 1000)
      await ev(`document.getElementById('content').style.height = '900px'`)
      await ev(MOUNT())
      await sleep(300)
      const first = await ev(REACHABLE)
      assert.ok(first.ok, `처음 잰 뒤: 바닥글(${first.footerBottom})이 띠(${first.barTop}) 밑에 남는다 — ${JSON.stringify(first)}`)
      // 본문이 자란다(후속 콘텐츠가 도착) → body 크기 관찰자가 다시 잰다
      await ev(`document.getElementById('grow').style.height = '116px'`)
      await sleep(400)
      const grown = await ev(REACHABLE)
      assert.ok(grown.ok, `본문이 자란 뒤 다시 재면: 바닥글(${grown.footerBottom})이 띠(${grown.barTop}) 밑에 남는다 — 여백 ${grown.pad} · ${JSON.stringify(grown)}`)
      // 한 번 더 자라고 줄어도 맞는다
      await ev(`document.getElementById('grow').style.height = '0px'`)
      await sleep(400)
      const shrunk = await ev(REACHABLE)
      assert.ok(shrunk.ok, `본문이 줄어든 뒤: ${JSON.stringify(shrunk)}`)
      await ev('window.__cleanup?.()')
      await sleep(100)
      assert.equal(await ev(`document.documentElement.style.paddingBottom`), '', '떠날 때 여백을 되돌린다')
    }, { motion })
  })
}

test('REL11-5: 문서가 화면보다 짧아도 바닥글이 띠 밑에 남지 않게 여백이 문서를 스크롤 가능하게 만든다', async () => {
  await withChrome(async ({ send, ev }) => {
    await navigateAndWait(send, ev, pathToFileURL(join(here, 'fixtures', 'rel11', 'bottom-bar.html')).href)
    // 화면 800 · 내용 640 + 바닥글 60 → 바닥글 아래 끝 700, 띠 위끝 642 — 문서는 화면보다 짧아 스크롤이 안 된다
    await ev(`document.getElementById('content').style.height = '640px'`)
    await ev(MOUNT())
    await sleep(400)
    const r = await ev(REACHABLE)
    assert.ok(r.ok, `짧은 문서: 바닥글(${r.footerBottom})이 띠(${r.barTop}) 밑에 남는다 — ${JSON.stringify(r)}`)
    await ev('window.__cleanup?.()')
  })
})

test('REL11-5: 양성 대조 — 훅을 안 달면 같은 틀에서 바닥글이 띠 밑에 남는다(시험 틀이 문제를 실제로 재현한다)', async () => {
  await withChrome(async ({ send, ev }) => {
    await navigateAndWait(send, ev, pathToFileURL(join(here, 'fixtures', 'rel11', 'bottom-bar.html')).href)
    await ev(`document.getElementById('content').style.height = '900px'`)
    const r = await ev(REACHABLE)
    assert.equal(r.ok, false, `훅 없이도 바닥글이 보이면 시험 틀이 의미가 없다: ${JSON.stringify(r)}`)
  })
})
