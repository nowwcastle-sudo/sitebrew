// 서버 렌더 가림의 절대 상한(Task 16 — 리뷰 14 #7): 스트리밍 문서(꼬리가 6초 늦게 오고 JS 는 404)에서 등장 대상이 숨는 시간은
// 머리 파싱부터 failsafeMs + MOTION_FAILSAFE_CAP_EXTRA_MS(운영 1.5 + 2.5 = 4초) + 300ms 안이어야 한다. 리뷰의 rv-stream.mjs 와 같은 조건을
// next 없이 작은 HTTP 서버로 만든다(머리에 motion-boot 의 CSS·스크립트 그대로). 양성 대조: 상한을 끈(cap 을 아주 크게 준) 스크립트는
// DOMContentLoaded(꼬리 뒤)까지 숨는다 — 도구가 스트리밍을 실제로 재현했다는 증거.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { startChrome, connect } from '../qa/cdp.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const HOLD = 6000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadBoot() {
  const src = readFileSync(join(ROOT, 'registry', 'factory', 'motion', 'motion-boot.tsx'), 'utf8')
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const dir = join(ROOT, '.tmp', 'motion-boot-stream')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `boot-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(file, outputText)
  try { return await import(pathToFileURL(file).href) } finally { rmSync(file, { force: true }) }
}

// 머리: 가림 CSS + 부팅 스크립트 + 재는 표지(머리 파싱 시각, 드러난 시각과 그때의 readyState). 몸: 등장 대상 둘. 꼬리(HOLD 뒤): 404 나는 JS.
const page = (m, boot) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${m.MOTION_GATE_CSS}</style><script>${boot}</script>` +
  `<script>window.__head=performance.now();new MutationObserver(function(){if(window.__late==null&&document.documentElement.dataset.motion==="late"){window.__late=performance.now();window.__lateState=document.readyState}}).observe(document.documentElement,{attributes:true})</script></head>` +
  `<body><h1 data-enter>보이는 제목</h1><p data-enter>본문 한 줄</p>` + ' '.repeat(4096)

async function hiddenFor(boot, m) {
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('.js')) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.write(page(m, boot))
    setTimeout(() => res.end('<script src="/app.js"></script></body></html>'), HOLD)
  }).listen(0)
  const port = server.address().port
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'boot-stream-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
    let r = null
    for (let i = 0; i < 120; i++) {
      r = await ev(`({ head: window.__head ?? null, late: window.__late ?? null, state: window.__lateState ?? null, ready: document.readyState, hidden: [...document.querySelectorAll('[data-enter]')].filter((e) => getComputedStyle(e).visibility === 'hidden').length, targets: document.querySelectorAll('[data-enter]').length })`).catch(() => null)
      if (r?.late != null) break
      await sleep(100)
    }
    ws.close()
    return r
  } finally {
    await chrome.close()
    server.close()
  }
}

test('streaming document + JS failure: the absolute cap (failsafe + 2.5 s from head parse) reveals [data-enter] before DOMContentLoaded — hidden ≤ cap + 300 ms; with the cap disabled it waits for the stream tail (control)', async () => {
  const m = await loadBoot()
  const cap = m.MOTION_FAILSAFE_MS + m.MOTION_FAILSAFE_CAP_EXTRA_MS
  const on = await hiddenFor(m.motionBootScript(m.MOTION_FAILSAFE_MS), m)
  assert.ok(on?.late != null, `드러나지 않았다: ${JSON.stringify(on)}`)
  const hidden = on.late - on.head
  assert.ok(hidden <= cap + 300, `숨은 시간 ${hidden.toFixed(0)}ms > ${cap + 300}ms`)
  assert.equal(on.state, 'loading', '문서가 아직 스트리밍 중일 때 상한이 드러냈다')
  assert.equal(on.targets, 2)
  assert.equal(on.hidden, 0, '드러난 뒤 숨은 등장 대상 없음')
  // 양성 대조: 상한을 끄면(cap 60초) DOMContentLoaded(꼬리 HOLD 뒤) + 1.5초까지 숨는다.
  const off = await hiddenFor(m.motionBootScript(m.MOTION_FAILSAFE_MS, 60000), m)
  assert.ok(off?.late != null, `대조: 드러나지 않았다: ${JSON.stringify(off)}`)
  assert.ok(off.late - off.head >= HOLD, `대조: 스트리밍이 재현되지 않았다(숨은 시간 ${(off.late - off.head).toFixed(0)}ms)`)
  assert.notEqual(off.state, 'loading')
  console.log(`숨은 시간: 상한 있음 ${hidden.toFixed(0)}ms(상한 ${cap}ms) · 상한 끔(대조) ${(off.late - off.head).toFixed(0)}ms`)
})
