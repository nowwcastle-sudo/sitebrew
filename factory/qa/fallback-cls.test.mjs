// 대체 글꼴 면의 효과를 진짜 Chrome 으로 잰다(FV1 Task 5.10, 대장 C384 — saas-1 홈 CLS 0.15 가 웹폰트가 도착해 시스템 글꼴과 바뀌는 순간 글줄이 밀려서 생겼다).
//   같은 쪽을 두 번 연다: 느리게 도착하는 Pretendard(서버가 0.9초 늦춘다) 하나만 부른 쪽 · `site-fonts.mjs fallbackFaceCss` 가 만든 「<서체> Fallback」 면을 사이에 낀 쪽.
//   글이 좁은 칸에서 줄을 바꾸는 단락 뒤에 버튼이 있다 — 글꼴이 바뀌면 단락 높이가 달라져 버튼이 밀린다. 이때 layout-shift 합(CLS)이 대체 면을 낀 쪽에서 더 작아야 하고 0.1 아래여야 한다.
// 실행: node --test --test-force-exit --test-timeout=240000 factory/qa/fallback-cls.test.mjs   (Chrome — ci/tests-heavy.txt)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { closeChrome, connect, navigateAndWait, startChrome } from './cdp.mjs'
import { fallbackFaceCss, parseFontMetrics } from '../stamp/site-fonts.mjs'

const FONT = readFileSync(join(process.cwd(), 'node_modules', 'pretendard', 'dist', 'web', 'variable', 'woff2', 'PretendardVariable.woff2'))
const FALLBACK = fallbackFaceCss({ family: 'Pretendard Variable', metrics: parseFontMetrics(FONT) })
// 한글 글(시스템 한글 글꼴 → Pretendard 로 바뀌는 쪽이 saas-1 CLS 의 실제 원인) + 영어 글 한 줄
const TEXT = '견적서를 링크로 보내고 고객이 열어 봤는지, 승인했는지를 한 화면에서 확인해요. 보낸 뒤 기다리는 시간과 다시 연락할 사람을 팀이 함께 봐요.'
const PAGE = (stack, extraCss) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>cls</title><style>
@font-face{font-family:"Pretendard Variable";font-weight:45 920;font-display:swap;src:url(/font.woff2) format("woff2")}
${extraCss}
body{margin:0;padding:20px;font-family:${stack};font-size:24px}
main{width:380px}
.below{height:560px;margin-top:20px;background:#dde7ff}
p{margin:0 0 16px}
a.cta{display:inline-block;padding:12px 20px;background:#111;color:#fff}
</style></head><body><main><h1 style="font-size:26px;margin:0 0 12px">Send quotes and track approvals</h1><p>${TEXT}</p><p>${TEXT}</p><a class="cta" href="/start">Start free</a><div class="below"></div></main></body></html>`

let server
let origin
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/font.woff2') return setTimeout(() => { res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'no-store' }); res.end(FONT) }, 900)
    if (req.url === '/plain') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE('"Pretendard Variable", sans-serif', '')) }
    if (req.url === '/adjusted') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE('"Pretendard Variable", "Pretendard Variable Fallback", sans-serif', FALLBACK)) }
    res.writeHead(404); res.end('no')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise((r) => server.close(r)))

async function clsOf(chrome, path) {
  const cdp = await connect(chrome.wsUrl)
  try {
    await cdp.send('Page.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 420, height: 800, deviceScaleFactor: 1, mobile: false })
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: "layout-shift", buffered: true })' })
    await navigateAndWait(cdp.send, cdp.ev, `${origin}${path}`, { timeoutMs: 20000 })
    await new Promise((r) => setTimeout(r, 2200)) // 글꼴이 늦게(0.9초) 와서 바뀐 뒤까지
    const fontLoaded = await cdp.ev('document.fonts.check("24px \\"Pretendard Variable\\"")')
    return { cls: await cdp.ev('window.__cls'), fontLoaded }
  } finally { try { cdp.ws.close() } catch {} }
}

test('대체 글꼴 면(size-adjust·ascent-override)을 낀 쪽은 글꼴이 바뀔 때 덜 밀린다 — CLS 0.1 아래이고 대체 면 없는 쪽보다 작다', { timeout: 200_000 }, async () => {
  const chrome = await startChrome([], { prefix: 'fallback-cls-' })
  try {
    const plain = await clsOf(chrome, '/plain')
    const adjusted = await clsOf(chrome, '/adjusted')
    assert.equal(plain.fontLoaded, true, '글꼴이 실제로 도착해 바뀌었다(아니면 시험이 아무것도 안 잰 것이다)')
    assert.equal(adjusted.fontLoaded, true)
    assert.ok(plain.cls > 0.03, `대체 면 없는 쪽이 밀려야 시험이 의미가 있다: CLS ${plain.cls}`)
    assert.ok(adjusted.cls < plain.cls, `대체 면을 낀 쪽 ${adjusted.cls} 가 없는 쪽 ${plain.cls} 보다 작아야 한다`)
    assert.ok(adjusted.cls < 0.1, `대체 면을 낀 쪽 CLS ${adjusted.cls}`)
    console.log(`CLS 대체 면 없음 ${plain.cls.toFixed(4)} → 있음 ${adjusted.cls.toFixed(4)}`)
  } finally { await closeChrome(chrome) }
})
