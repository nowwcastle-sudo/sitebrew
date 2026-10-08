// P3-4 PERF2 (대장 C233) — 빌드 뒤 scripts/defer-hydration.mjs: 초기 청크 script 를 첫 칠 뒤 로더로 옮긴다.
// 순수 변환·스크립트(가짜 .next)·csp-hashes 와의 짝(로더 해시가 CSP 에 실린다)은 브라우저 없이, 실제 동작(첫 칠 뒤에 받는다·load 대체·4초 대체)은 Chrome 한 개로 본다.
// 실행: node --test --test-force-exit --test-timeout=180000 factory/scripts/stamp-defer-hydration.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startChrome, connect } from '../qa/cdp.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TEMPLATE = join(root, 'factory', 'stamp', 'site-template')
const mod = await import(new URL(`file:///${join(TEMPLATE, 'scripts', 'defer-hydration.mjs').replaceAll('\\', '/')}`))
const { deferHydration, loaderScript, LOADER_MARK, extractFontFaces } = mod
const sha = (t) => `'sha256-${createHash('sha256').update(t, 'utf8').digest('base64')}'`

// Next 16(Turbopack) 정적 HTML 의 모양 그대로 — 머리: 스타일시트·preload(low)·async 청크, 몸: RSC 흐름 인라인 script, noModule 폴리필, id="_R_" 부트.
const SAMPLE =
  '<!DOCTYPE html><html lang="ko"><head><meta charSet="utf-8"/><link rel="stylesheet" href="/_next/static/chunks/a.css" data-precedence="next"/>' +
  '<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/boot.js"/>' +
  '<script src="/_next/static/chunks/one.js" async=""></script><script src="/_next/static/chunks/two.js" async=""></script>' +
  '<script src="/_next/static/chunks/legacy.js" noModule=""></script><script src="/_next/static/chunks/boot.js" id="_R_" async=""></script>' +
  '<script src="https://cdn.example/analytics.js" async=""></script><title>t</title></head>' +
  '<body><p>본문</p><script>self.__next_f.push([1,"x"])</script></body></html>'

test('deferHydration: 초기 청크(async)를 머리에서 빼 문서 끝 로더 하나로 옮기고, preload·noModule·바깥 주소·인라인 흐름은 건드리지 않는다', () => {
  const { html, moved } = deferHydration(SAMPLE)
  assert.equal(moved, 3)
  assert.doesNotMatch(html, /<script src="\/_next\/static\/chunks\/(?:one|two|boot)\.js"/, '옮긴 청크의 script 태그가 머리에 없다')
  assert.doesNotMatch(html, /<link rel="preload" as="script"/, '옮긴 청크의 preload 도 없다(없으면 JS 가 칠 전에 달린다)')
  assert.match(html, /<link rel="stylesheet" href="\/_next\/static\/chunks\/a\.css"/, '스타일시트는 그대로')
  assert.ok(html.includes('<script src="/_next/static/chunks/legacy.js" noModule=""></script>'), 'noModule 폴리필은 그대로')
  assert.ok(html.includes('<script src="https://cdn.example/analytics.js" async=""></script>'), '바깥 주소 script 는 그대로')
  assert.ok(html.includes('<script>self.__next_f.push([1,"x"])</script>'), 'RSC 흐름 인라인 script 는 그대로')
  const loader = loaderScript([['/_next/static/chunks/one.js'], ['/_next/static/chunks/two.js'], ['/_next/static/chunks/boot.js', '_R_']])
  assert.ok(html.endsWith(`<script>${loader}</script></body></html>`), '로더는 </body> 바로 앞 — 문서 순서(one·two·boot, id _R_ 유지)')
  assert.ok(loader.includes(LOADER_MARK))
})

test('deferHydration: 다시 돌려도 같다(표지) · 옮길 것이 없거나 </body> 가 없으면 그대로 · 한 번 옮긴 HTML 에 로더가 둘이 되지 않는다', () => {
  const once = deferHydration(SAMPLE).html
  assert.deepEqual(deferHydration(once), { html: once, moved: 0 })
  assert.deepEqual(deferHydration('<html><head></head><body>x</body></html>'), { html: '<html><head></head><body>x</body></html>', moved: 0 })
  const noBody = '<script src="/_next/static/chunks/one.js" async=""></script>'
  assert.deepEqual(deferHydration(noBody), { html: noBody, moved: 0 })
})

// ── PERF3(대장 C233 후속): 글꼴 선언을 첫 칠 뒤로 · 로더는 load 가 아니라 첫 칠만 기다린다 ─────────────────────────────────────────
const FACE_A = '@font-face{font-family:Young Serif;font-style:normal;font-weight:400;font-display:swap;src:url(../media/young.woff2)format("woff2")}'
const FACE_B = '@font-face{font-family:Pretendard Variable;font-weight:45 920;font-display:swap;src:url(../media/p.subset.1.woff2)format("woff2");unicode-range:U+AC00-AD00,U+B000-B0FF}'
const FACE_LOCAL = '@font-face{font-family:Young Serif Fallback;src:local("Arial");size-adjust:104%}' // 네트워크 요청이 없는 대체 면 — 칠 전에 있어야 글자 폭이 덜 흔들린다

test('extractFontFaces: url() 이 있는 @font-face 만 빼내고(local() 대체 면은 CSS 에 남긴다) 나머지 CSS 는 그대로, 뺄 것이 없으면 그대로', () => {
  const css = `body{margin:0}${FACE_A}.a{color:red}${FACE_LOCAL}${FACE_B}@media (min-width:1px){.b{top:0}}`
  const { rest, faces } = extractFontFaces(css)
  assert.equal(rest, `body{margin:0}.a{color:red}${FACE_LOCAL}@media (min-width:1px){.b{top:0}}`)
  assert.equal(faces, `${FACE_A}${FACE_B}`)
  assert.deepEqual(extractFontFaces('body{margin:0}'), { rest: 'body{margin:0}', faces: '' })
  assert.deepEqual(extractFontFaces(extractFontFaces(css).rest).faces, '', '다시 돌려도 더 뺄 것이 없다')
})

test('deferHydration: 글꼴 스타일시트 주소를 주면 로더가 첫 칠 뒤에 <link rel=stylesheet> 로 먼저 싣고(스크립트보다 앞), 스크립트가 없는 문서에도 로더가 생기며, JS 없는 방문자는 noscript 로 받는다', () => {
  const fonts = ['/_next/static/chunks/a.fonts.css']
  const { html, moved } = deferHydration(SAMPLE, { fonts })
  assert.equal(moved, 3)
  const loader = loaderScript([['/_next/static/chunks/one.js'], ['/_next/static/chunks/two.js'], ['/_next/static/chunks/boot.js', '_R_']], fonts)
  assert.ok(html.includes(`<script>${loader}</script></body>`), '로더는 글꼴 목록을 품는다')
  assert.ok(loader.indexOf('createElement("link")') > 0 && loader.indexOf('createElement("link")') < loader.indexOf('createElement("script")'), 'go() 안에서 글꼴 link 가 스크립트보다 먼저 만들어진다')
  assert.ok(html.includes('<noscript><link rel="stylesheet" href="/_next/static/chunks/a.fonts.css"/></noscript></head>'), 'JS 없는 방문자는 글꼴을 head 의 noscript 로 받는다')
  const noScripts = deferHydration('<html><head></head><body><p>x</p></body></html>', { fonts })
  assert.ok(noScripts.html.includes(LOADER_MARK) && noScripts.html.includes('.fonts.css'), '청크가 없는 문서(404)도 글꼴은 싣는다 — CSS 에서 뺐으므로')
  assert.equal(noScripts.moved, 0)
  assert.deepEqual(deferHydration(deferHydration(SAMPLE, { fonts }).html, { fonts }).moved, 0, '다시 돌려도 로더가 둘이 되지 않는다')
})

test('로더는 load 를 기다리지 않는다 — 첫 칠(first-contentful-paint 항목)만, 칠 신호를 못 읽는 브라우저에서만 load(대체), 어느 쪽도 없으면 4초', () => {
  const body = loaderScript([['/_next/static/chunks/one.js']])
  assert.doesNotMatch(body, /readyState/, 'load 가 이미 끝났다고 곧바로 싣지 않는다 — 칠은 load 뒤에 올 수 있다(PERF3 실측)')
  assert.match(body, /first-contentful-paint/, 'FCP 항목을 본다(first-paint 는 배경만 칠한 프레임일 수 있다)')
  assert.ok(body.includes('catch(e){addEventListener("load",go)}'), 'PerformanceObserver 를 못 만들면(catch) load')
  assert.equal(body.split('addEventListener("load",go)').length - 1, 2, 'load 에서 싣는 길은 둘뿐 — 숨은 탭(칠이 안 난다)과 위 catch. 무조건 load 에서 싣는 길은 없다')
  assert.ok(body.includes('setTimeout(go,4e3)'))
})

function fakeDist({ withCsp = true, css = false } = {}) {
  const site = mkdtempSync(join(tmpdir(), 'defer-hyd-'))
  const app = join(site, '.next', 'server', 'app')
  mkdirSync(join(app, 'privacy'), { recursive: true })
  writeFileSync(join(app, 'index.html'), SAMPLE)
  writeFileSync(join(app, 'privacy.html'), SAMPLE.replace('본문', '개인정보'))
  writeFileSync(join(app, '_not-found.html'), '<html><body>404</body></html>') // 청크가 없는 문서도 던지지 않는다
  if (css) {
    mkdirSync(join(site, '.next', 'static', 'chunks'), { recursive: true })
    writeFileSync(join(site, '.next', 'static', 'chunks', 'a.css'), `body{margin:0}${FACE_A}${FACE_LOCAL}${FACE_B}`)
  }
  writeFileSync(join(site, '.next', 'routes-manifest.json'), JSON.stringify({ version: 3, headers: withCsp ? [{ source: '/(.*)', regex: '^/(.*)$', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; frame-ancestors 'none'" }] }] : [] }))
  return site
}
const run = (name, site, env = {}) => spawnSync(process.execPath, [join(TEMPLATE, 'scripts', name)], { cwd: site, env: { ...process.env, WF_STATIC_EXPORT: '', WF_DEFER_HYDRATION: '', ...env }, encoding: 'utf8' })

test('scripts/defer-hydration.mjs: .next/server/app 의 모든 HTML 을 바꾸고(청크 없는 문서는 그대로), 두 번 돌려도 같고, 이어서 csp-hashes 가 로더의 해시를 CSP 에 싣는다', () => {
  const site = fakeDist()
  const r = run('defer-hydration.mjs', site)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /쪽 3개 중 2개에서 스크립트 6개/)
  const idx = readFileSync(join(site, '.next', 'server', 'app', 'index.html'), 'utf8')
  assert.equal(idx, deferHydration(SAMPLE).html)
  assert.equal(readFileSync(join(site, '.next', 'server', 'app', '_not-found.html'), 'utf8'), '<html><body>404</body></html>')
  const again = run('defer-hydration.mjs', site)
  assert.equal(again.status, 0)
  assert.match(again.stdout, /2개 중 0개|3개 중 0개/)
  assert.equal(readFileSync(join(site, '.next', 'server', 'app', 'index.html'), 'utf8'), idx, '두 번째 실행은 HTML 을 바꾸지 않는다')
  // 짝: 로더는 인라인 script 라 해시가 CSP script-src 에 실려야 한다(안 실리면 CSP 가 로더를 막아 하이드레이션이 영영 안 온다).
  const csp = run('csp-hashes.mjs', site)
  assert.equal(csp.status, 0, csp.stderr + csp.stdout)
  const manifest = JSON.parse(readFileSync(join(site, '.next', 'routes-manifest.json'), 'utf8'))
  const value = manifest.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  const loader = loaderScript([['/_next/static/chunks/one.js'], ['/_next/static/chunks/two.js'], ['/_next/static/chunks/boot.js', '_R_']])
  assert.ok(value.includes(sha(loader)), '로더 해시가 CSP 에 있다')
  assert.ok(value.includes(sha('self.__next_f.push([1,"x"])')), 'RSC 흐름 해시도 그대로 있다')
  assert.doesNotMatch(value.split(';').find((d) => d.trim().startsWith('script-src')), /unsafe-inline|unsafe-eval|strict-dynamic/, '동적 script 를 위해 CSP 를 느슨하게 하지 않는다 — 같은 출처 \'self\' 로 충분')
})

test('scripts/defer-hydration.mjs: WF_STATIC_EXPORT=1 · WF_DEFER_HYDRATION=0 은 건너뛰고(HTML 그대로), .next 가 없거나 HTML 이 없으면 종료 1', () => {
  for (const env of [{ WF_STATIC_EXPORT: '1' }, { WF_DEFER_HYDRATION: '0' }]) {
    const site = fakeDist()
    const r = run('defer-hydration.mjs', site, env)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /건너뜀/)
    assert.equal(readFileSync(join(site, '.next', 'server', 'app', 'index.html'), 'utf8'), SAMPLE)
  }
  const empty = mkdtempSync(join(tmpdir(), 'defer-hyd-empty-'))
  const none = run('defer-hydration.mjs', empty)
  assert.equal(none.status, 1)
  assert.match(none.stderr, /next build 가 먼저/)
  mkdirSync(join(empty, '.next', 'server', 'app'), { recursive: true })
  assert.equal(run('defer-hydration.mjs', empty).status, 1, 'HTML 이 하나도 없으면 조용히 통과하지 않는다')
})

test('scripts/defer-hydration.mjs: CSS 의 url() 글꼴 선언을 <이름>.fonts.css 로 옮기고 그 CSS 를 쓰는 모든 HTML 의 로더가 싣는다 · 두 번 돌려도 같다 · 로더 해시가 CSP 에 실린다', () => {
  const site = fakeDist({ css: true })
  const chunks = join(site, '.next', 'static', 'chunks')
  const app = join(site, '.next', 'server', 'app')
  const r = run('defer-hydration.mjs', site)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /글꼴 선언 2개를 CSS 1개에서 .fonts.css 로 옮겼다/)
  assert.equal(readFileSync(join(chunks, 'a.css'), 'utf8'), `body{margin:0}${FACE_LOCAL}`, 'local() 대체 면만 CSS 에 남는다')
  assert.equal(readFileSync(join(chunks, 'a.fonts.css'), 'utf8'), `${FACE_A}${FACE_B}`, 'url() 면은 같은 폴더의 .fonts.css — 상대 주소(../media/)가 그대로 풀린다')
  const fonts = ['/_next/static/chunks/a.fonts.css']
  const loaderArgs = [['/_next/static/chunks/one.js'], ['/_next/static/chunks/two.js'], ['/_next/static/chunks/boot.js', '_R_']]
  for (const page of ['index.html', 'privacy.html']) assert.ok(readFileSync(join(app, page), 'utf8').includes(loaderScript(loaderArgs, fonts)), `${page} 로더가 글꼴을 싣는다`)
  assert.equal(readFileSync(join(app, '_not-found.html'), 'utf8'), '<html><body>404</body></html>', 'CSS 를 안 쓰는 문서는 그대로')
  const snap = () => [readFileSync(join(chunks, 'a.css'), 'utf8'), readFileSync(join(chunks, 'a.fonts.css'), 'utf8'), readFileSync(join(app, 'index.html'), 'utf8')]
  const before = snap()
  assert.equal(run('defer-hydration.mjs', site).status, 0)
  assert.deepEqual(snap(), before, '두 번째 실행은 아무것도 바꾸지 않는다')
  const csp = run('csp-hashes.mjs', site)
  assert.equal(csp.status, 0, csp.stderr + csp.stdout)
  const value = JSON.parse(readFileSync(join(site, '.next', 'routes-manifest.json'), 'utf8')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value
  assert.ok(value.includes(sha(loaderScript(loaderArgs, fonts))), '글꼴을 품은 로더의 해시가 CSP 에 있다')
})

test('scripts/defer-hydration.mjs: WF_DEFER_FONTS=0 이면 글꼴은 CSS 에 그대로(하이드레이션 로더만) · 그 CSS 를 쓰는 HTML 에 로더를 달 수 없으면(</body> 없음) 그 CSS 는 건드리지 않는다', () => {
  const off = fakeDist({ css: true })
  assert.equal(run('defer-hydration.mjs', off, { WF_DEFER_FONTS: '0' }).status, 0)
  assert.equal(readFileSync(join(off, '.next', 'static', 'chunks', 'a.css'), 'utf8'), `body{margin:0}${FACE_A}${FACE_LOCAL}${FACE_B}`)
  assert.equal(readFileSync(join(off, '.next', 'server', 'app', 'index.html'), 'utf8'), deferHydration(SAMPLE).html, '글꼴 없는 옛 로더 그대로')
  const bad = fakeDist({ css: true })
  writeFileSync(join(bad, '.next', 'server', 'app', 'privacy.html'), SAMPLE.replace('본문', '개인정보').replace('</body>', ''))
  const r = run('defer-hydration.mjs', bad)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readFileSync(join(bad, '.next', 'static', 'chunks', 'a.css'), 'utf8'), `body{margin:0}${FACE_A}${FACE_LOCAL}${FACE_B}`, '로더를 못 다는 문서가 있으면 CSS 를 비우지 않는다 — 글꼴이 영영 안 온다')
  assert.match(r.stdout, /글꼴 선언을 옮기지 않았다/)
})

// ── 실제 동작(Chrome 하나) ──────────────────────────────────────────────────────
// 서버: HTML 은 즉시, CSS 는 300 ms 늦게(칠이 CSS 를 기다린다), 청크 JS 는 즉시. 청크는 window.__ran·__ranAt 을 남기고 요청 시각을 서버가 적는다.
async function observe({ html, noPaintObserver = false, cssDelay = 300, lateObserverMs = 0, waitFor = [], css = 'body{margin:0;font:20px sans-serif}', extra = {} }) {
  const reqAt = {}
  const t0 = Date.now()
  const server = http.createServer((req, res) => {
    reqAt[req.url] = Date.now() - t0
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html) }
    if (req.url === '/a.css') return setTimeout(() => { res.writeHead(200, { 'content-type': 'text/css' }); res.end(css) }, cssDelay)
    if (extra[req.url]) { res.writeHead(200, { 'content-type': extra[req.url].type }); return res.end(extra[req.url].body) }
    if (req.url.startsWith('/_next/static/chunks/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`window.__ran=(window.__ran||[]).concat(${JSON.stringify(req.url)});window.__ranAt=performance.now()`) }
    res.writeHead(404); res.end()
  }).listen(0)
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'defer-hyd-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    if (noPaintObserver) await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.PerformanceObserver=undefined' })
    // 첫 칠 신호를 늦게 받는 상황(실측: 새 Chrome 은 load 뒤 100~300 ms 에 첫 칠이 난다) — 관찰자 콜백만 늦춘다. 칠 자체는 그대로.
    if (lateObserverMs) await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const O=window.PerformanceObserver;window.PerformanceObserver=class extends O{constructor(cb){super((l,o)=>setTimeout(()=>cb(l,o),${lateObserverMs}))}};window.PerformanceObserver.supportedEntryTypes=O.supportedEntryTypes})()` })
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    let r = null
    for (let i = 0; i < 80; i++) {
      r = await ev(`({ ran: window.__ran ?? null, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null, ranAt: window.__ranAt ?? null, state: document.readyState, loadEnd: performance.getEntriesByType('navigation')[0]?.loadEventEnd ?? 0, res: Object.fromEntries(performance.getEntriesByType('resource').map((e) => [new URL(e.name).pathname, e.startTime])) })`)
      if (r?.ran?.length >= 2 && waitFor.every((p) => r.res?.[p] != null) && (!waitFor.length || r.fcp != null)) break
      await new Promise((x) => setTimeout(x, 100))
    }
    ws.close()
    return { ...r, reqAt }
  } finally { await chrome.close(); server.close() }
}
const page = (extraHead = '') => deferHydration(
  `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/a.css"><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/one.js"/>` +
  `<script src="/_next/static/chunks/one.js" async=""></script><script src="/_next/static/chunks/two.js" async=""></script>${extraHead}</head><body><h1>제목</h1></body></html>`).html

test('Chrome: 청크는 CSS 가 와서 첫 칠이 난 뒤에 요청되고 둘 다 실행된다 — 원본(옮기기 전)은 CSS 를 기다리지 않고 바로 요청한다(양성 대조)', async () => {
  const moved = await observe({ html: page() })
  assert.deepEqual(moved.ran?.slice().sort(), ['/_next/static/chunks/one.js', '/_next/static/chunks/two.js'], `둘 다 실행됐다: ${JSON.stringify(moved)}`)
  assert.ok(moved.fcp != null, '첫 칠이 있었다')
  const firstChunkReq = Math.min(moved.reqAt['/_next/static/chunks/one.js'], moved.reqAt['/_next/static/chunks/two.js'])
  assert.ok(firstChunkReq >= moved.reqAt['/a.css'] + 250, `청크 요청(${firstChunkReq} ms)이 CSS 요청(${moved.reqAt['/a.css']} ms)+지연 뒤다`)
  // 대조: 옮기지 않은 문서는 CSS 가 오기도 전에 청크를 요청한다.
  const orig = await observe({ html: `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/a.css"><script src="/_next/static/chunks/one.js" async=""></script><script src="/_next/static/chunks/two.js" async=""></script></head><body><h1>제목</h1></body></html>` })
  const origFirst = Math.min(orig.reqAt['/_next/static/chunks/one.js'], orig.reqAt['/_next/static/chunks/two.js'])
  assert.ok(origFirst < orig.reqAt['/a.css'] + 250, `대조: 원본은 CSS 를 기다리지 않는다(${origFirst} ms)`)
})

test('Chrome: PerformanceObserver 가 없는 브라우저에서도 load 에서 실행된다(대체 경로)', async () => {
  const r = await observe({ html: page(), noPaintObserver: true })
  assert.deepEqual(r.ran?.slice().sort(), ['/_next/static/chunks/one.js', '/_next/static/chunks/two.js'], JSON.stringify(r))
})

test('Chrome: load 가 첫 칠 신호보다 먼저 와도 청크는 칠 신호 뒤에 요청된다(PERF3 — 옛 로더는 load 에서 바로 싣어 칠 전에 JS 가 달렸다)', async () => {
  const r = await observe({ html: page(), lateObserverMs: 700 })
  assert.deepEqual(r.ran?.slice().sort(), ['/_next/static/chunks/one.js', '/_next/static/chunks/two.js'], JSON.stringify(r))
  const first = Math.min(r.res['/_next/static/chunks/one.js'], r.res['/_next/static/chunks/two.js'])
  assert.ok(r.loadEnd > 0 && first >= r.loadEnd + 400, `청크 시작(${Math.round(first)} ms)이 load 끝(${Math.round(r.loadEnd)} ms)보다 한참 뒤다 — load 에서 싣지 않았다`)
})

test('Chrome: 글꼴 스타일시트는 첫 칠 뒤에 요청되고 글꼴 파일도 그 뒤에 온다 — 옮기기 전 문서는 칠 전에 글꼴을 요청한다(양성 대조) · 칠 신호가 없는 브라우저는 load 에서 함께 받는다', async () => {
  const faces = '@font-face{font-family:T;src:url(/t.woff2)format("woff2");font-display:swap}'
  const css = 'body{margin:0;font:20px T,sans-serif}'
  const extra = { '/t.woff2': { type: 'font/woff2', body: 'x' }, '/a.fonts.css': { type: 'text/css', body: faces } }
  const base = (head) => `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/a.css">${head}<script src="/_next/static/chunks/one.js" async=""></script><script src="/_next/static/chunks/two.js" async=""></script></head><body><h1>제목</h1></body></html>`
  const moved = await observe({ html: deferHydration(base(''), { fonts: ['/a.fonts.css'] }).html, css, extra, waitFor: ['/a.fonts.css', '/t.woff2'] })
  assert.ok(moved.fcp != null && moved.res['/a.fonts.css'] != null, JSON.stringify(moved))
  assert.ok(moved.res['/a.fonts.css'] >= moved.fcp, `글꼴 스타일시트(${Math.round(moved.res['/a.fonts.css'])} ms)는 첫 칠(${Math.round(moved.fcp)} ms) 뒤`)
  assert.ok(moved.res['/t.woff2'] != null && moved.res['/t.woff2'] >= moved.fcp, '글꼴 파일은 글꼴 스타일시트가 와야 알 수 있으므로 더 뒤')
  const orig = await observe({ html: base(''), css: css + faces, extra, waitFor: ['/t.woff2'] })
  assert.ok(orig.res['/t.woff2'] != null && orig.res['/t.woff2'] < orig.fcp, `대조: 옮기기 전 문서는 글꼴을 첫 칠 전에 요청한다(${Math.round(orig.res['/t.woff2'])} < ${Math.round(orig.fcp)})`)
  const nopo = await observe({ html: deferHydration(base(''), { fonts: ['/a.fonts.css'] }).html, css, extra, noPaintObserver: true, waitFor: ['/a.fonts.css'] })
  assert.ok(nopo.res['/a.fonts.css'] != null, '칠 신호가 없어도 load 에서 글꼴을 받는다')
})
