// QFIX3-PERF — 첫 화면(뷰포트) 안의 등장 대상은 하이드레이션을 기다리지 않고 첫 칠부터 보인다.
// 원인(Lighthouse 모바일 모의 LCP 3.8~5.6 s · 관측 LCP 는 0.3~0.6 s): LCP 후보 글이 [data-enter] 인데 [data-wf-first] 밖(쪽의 셋째 구획·둘째 구획)에 있어
//   MOTION_GATE_CSS 가 하이드레이션까지 가려, 모의 LCP 가 JS 150~380 KB 를 4G 로 다시 받는 시간을 통째로 먹었다. 구획 개수(firstScreenCount)로는 높이를 몰라 못 막는다.
// 고침: MotionBoot 의 머리 스크립트가 문서 파싱이 끝난 때(첫 칠 전) 보이는 화면 안에 든 가려진 등장 대상을 찾아 가림 CSS 의 :not() 목록에 더하고 window.__wfFold 에 싣는다(장면은 이것을 끝 상태로 둔다).
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/stamp-qfix3-perf-fold.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { runInNewContext } from 'node:vm'
import { gsap } from 'gsap'
import { startChrome, connect } from '../qa/cdp.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

async function loadBoot() {
  const src = readFileSync(join(ROOT, 'registry', 'factory', 'motion', 'motion-boot.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const dir = join(ROOT, '.tmp', 'qfix3-perf-fold')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `boot-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(file, outputText)
  try { return await import(pathToFileURL(file).href) } finally { rmSync(file, { force: true }) }
}

// 하이드레이션 JS 는 일부러 없다. 첫 구획([data-wf-first]) 밖이지만 화면 안(near)·display:contents 감싸개 안(near-wrap)·화면 밖(far)에 같은 등장 대상을 둔다.
const page = (m) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>body{margin:0}</style><style data-wf-motion-gate="">${m.MOTION_GATE_CSS}</style><script>${m.motionBootScript(60000, 60000)}</script></head><body><main>` +
  `<div data-wf-first="" style="display:contents"><h1 id="in-first" data-enter="">첫 구획 제목</h1></div>` +
  `<p id="near" data-enter="true">화면 안 글</p>` +
  `<div id="near-wrap" data-enter="true" style="display:contents"><p id="near-wrap-child">감싸개 안 글</p></div>` +
  `<div style="height:4000px"></div>` +
  `<p id="far" data-enter="true">화면 밖 글</p><p id="far-keep" data-enter="keep">keep</p></main></body></html>`

async function run(m) {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(m)) }).listen(0)
  const chrome = await startChrome(['--hide-scrollbars', '--window-size=412,823'], { prefix: 'qfix3-perf-fold-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    let r = null
    for (let i = 0; i < 50; i++) {
      r = await ev(`document.readyState === 'complete' ? { motion: document.documentElement.dataset.motion, fold: (window.__wfFold || []).map((e) => e.id), vis: Object.fromEntries([...document.querySelectorAll('[id]')].map((e) => [e.id, getComputedStyle(e).visibility])) } : null`)
      if (r) break
      await new Promise((x) => setTimeout(x, 100))
    }
    ws.close()
    return r
  } finally {
    await chrome.close()
    server.close()
  }
}

test('화면 안의 [data-enter] 는 [data-wf-first] 밖이어도 장면 전에 보이고, 화면 밖은 숨는다(양성 대조) — window.__wfFold 에 화면 안 대상만 실린다', async () => {
  const m = await loadBoot()
  const r = await run(m)
  assert.equal(r?.motion, 'on', '가림이 걸려 있어야 한다(안전장치 전)')
  assert.equal(r.vis['in-first'], 'visible')
  assert.equal(r.vis.near, 'visible', '화면 안 등장 대상은 하이드레이션을 기다리지 않는다')
  assert.equal(r.vis['near-wrap-child'], 'visible', 'display:contents 감싸개 안의 글도 보인다(감싸개의 visibility 를 상속)')
  assert.equal(r.vis.far, 'hidden', '양성 대조: 화면 밖의 같은 요소는 숨는다')
  assert.equal(r.vis['far-keep'], 'visible')
  assert.deepEqual([...r.fold].sort(), ['near', 'near-wrap'], '화면 안 대상만 장면에 알린다')
})

// FINAL-WF B2(T18): settleKept 는 접힘선(요소 단위)을 트윈 안에서도 요소 단위로 지킨다 — 실제 gsap 위에서 훅 원천의 settleKept 를 돌린다.
function loadSettleKept() {
  const src = readFileSync(join(ROOT, 'registry', 'factory', 'motion', 'use-gsap-scene.ts'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve, esModuleInterop: true } })
  class FakeElement {}
  class El extends FakeElement {
    constructor(id, { enter = true } = {}) { super(); this.id = id; this.opacity = 1; this.enter = enter }
    closest(sel) { return sel === '[data-enter]' && this.enter ? this : null }
    getAttribute() { return '' }
  }
  const win = { __wfFold: [] }
  const mods = {
    react: {}, gsap: { gsap }, 'gsap/CustomEase': { CustomEase: {} }, 'gsap/ScrollTrigger': { ScrollTrigger: {} }, 'gsap/SplitText': { SplitText: {} },
    '@/registry/factory/motion/motion-scale': {},
  }
  const cjsModule = { exports: {} }
  const sandbox = { module: cjsModule, exports: cjsModule.exports, require: (id) => mods[id], window: win, Element: FakeElement, document: {}, process: { env: {} }, console }
  const patched = outputText.replace(/gsap_1\.gsap\.registerPlugin\(/, '(() => {})(') + '\nmodule.exports.__settleKept = settleKept;\n'
  runInNewContext(patched, sandbox)
  return { settleKept: cjsModule.exports.__settleKept, El, win }
}

test('use-gsap-scene settleKept: 접힘선은 요소 단위 — 섞인 stagger 트윈에서 화면 안(__wfFold) 대상은 끝 상태로 남고, 화면 밖 대상은 시작 상태에서 등장한다', () => {
  const { settleKept, El, win } = loadSettleKept()
  const [a, b, c] = [new El('a'), new El('b'), new El('c')]
  win.__wfFold = [a, b]
  const tl = gsap.timeline({ paused: true })
  tl.from([a, b, c], { opacity: 0, duration: 1, stagger: 0.2 })
  settleKept(tl)
  tl.progress(0)
  assert.equal(a.opacity, 1, '화면 안 대상 a 는 시작 상태(0)로 되돌아가지 않는다')
  assert.equal(b.opacity, 1, '화면 안 대상 b 도 마찬가지')
  assert.equal(c.opacity, 0, '화면 밖 대상 c 는 시작 상태에서 등장한다(양성 대조: 통째로 끝내지 않는다)')
  tl.progress(1)
  assert.deepEqual([a.opacity, b.opacity, c.opacity], [1, 1, 1], '끝에서는 셋 모두 끝 상태')
  tl.kill()
})

test('use-gsap-scene settleKept: 대상이 전부 화면 안이면 트윈째 끝내고, 하나도 없으면 건드리지 않는다', () => {
  const { settleKept, El, win } = loadSettleKept()
  const [a, b, c] = [new El('a'), new El('b'), new El('c')]
  win.__wfFold = [a, b]
  const all = gsap.timeline({ paused: true })
  all.from([a, b], { opacity: 0, duration: 1, stagger: 0.2 })
  settleKept(all)
  all.progress(0)
  assert.deepEqual([a.opacity, b.opacity], [1, 1], '전부 kept 면 끝 상태로 두고 트윈을 지운다')
  all.kill()
  const none = gsap.timeline({ paused: true })
  none.from(c, { opacity: 0, duration: 1 })
  settleKept(none)
  none.progress(0)
  assert.equal(c.opacity, 0, '화면 밖 대상만 있는 트윈은 그대로 등장한다')
  none.kill()
})
