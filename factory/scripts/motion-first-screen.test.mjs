// 쪽의 첫 화면 구획([data-wf-first], P3-4 PERF2 · 대장 C233): 장면이 시작하기 전(JS 가 안 돈 때)에도 그 안의 등장 대상은 보이고, 밖은 숨는다.
// 양성 대조: 같은 제목을 [data-wf-first] 밖에 두면 숨는다 — 가림이 실제로 걸려 있었다는 증거. 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/motion-first-screen.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { startChrome, connect } from '../qa/cdp.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

async function loadBoot() {
  const src = readFileSync(join(ROOT, 'registry', 'factory', 'motion', 'motion-boot.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const dir = join(ROOT, '.tmp', 'motion-first-screen')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `boot-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(file, outputText)
  try { return await import(pathToFileURL(file).href) } finally { rmSync(file, { force: true }) }
}

// 하이드레이션 JS 는 일부러 없다(스크립트 없음) — 장면이 시작하기 전 모양만 본다. 안전장치(1.5초)가 오기 전에 잰다.
const page = (m) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${m.MOTION_GATE_CSS}</style><script>${m.motionBootScript(60000, 60000)}</script></head><body>` +
  `<div data-wf-first="" style="display:contents"><h1 id="in-first" data-enter="">첫 구획 제목</h1><p id="in-first-keep" data-enter="keep">keep</p></div>` +
  `<div style="height:4000px"></div><h2 id="outside" data-enter="">첫 구획 밖 제목</h2><p id="outside-keep" data-enter="keep">keep</p></body></html>`

test('MOTION_GATE_CSS: [data-wf-first] 안의 [data-enter] 는 장면이 시작하기 전에도 보이고, 밖은 숨는다(양성 대조) — keep 은 어디서나 보인다', async () => {
  const m = await loadBoot()
  assert.match(m.MOTION_GATE_CSS, /\[data-wf-first\] \[data-enter\]/)
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(m)) }).listen(0)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'first-screen-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    let r = null
    for (let i = 0; i < 50; i++) {
      r = await ev(`document.readyState === 'complete' ? { motion: document.documentElement.dataset.motion, vis: Object.fromEntries([...document.querySelectorAll('[id]')].map((e) => [e.id, getComputedStyle(e).visibility])) } : null`)
      if (r) break
      await new Promise((x) => setTimeout(x, 100))
    }
    ws.close()
    assert.equal(r?.motion, 'on', '가림이 걸려 있어야 한다(안전장치 전)')
    assert.equal(r.vis['in-first'], 'visible', '첫 구획 안의 숨기는 data-enter 는 보인다')
    assert.equal(r.vis['in-first-keep'], 'visible')
    assert.equal(r.vis.outside, 'hidden', '양성 대조: 첫 구획 밖의 같은 요소는 숨는다')
    assert.equal(r.vis['outside-keep'], 'visible')
  } finally {
    await chrome.close()
    server.close()
  }
})
