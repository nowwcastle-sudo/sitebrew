// 비교 대시보드 동작 시험(v0.2.6 T4) — headless Chrome 이 진짜 iframe 셋을 움직인다. 후보 사이트는 fixtures/fake-site.mjs(진짜 프로세스, frame-ancestors 'none' · script-src 'self').
// 실행 폴더 이름에 공백과 한글이 든다(…/런 폴더 공백/청춘). 한 번의 대시보드 위에서 순서대로 본다:
//   title 메시지 → 폭 768 → 쪽 「요금」이 세 칸 모두에 → 안쪽 pushState 이동이 쪽 버튼을 바꿈 → 스크롤 비율 차 ≤ 0.05 → 크게 보기 열 1개 → 확정.
// 확정 뒤: picks.json · 종료 사유/코드 · 후보 프로세스 0 · record.mjs 가 읽는 모양. 그리고 보안 거절(Host·Origin·토큰)과 탭 닫힘 감시.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { killTree } from '../../stamp/run-proc.mjs'
import { GATE_CHROME_FLAGS } from '../recipe-board/jobs.mjs'
import { loadBoardData } from '../direction-board/build.mjs'
import { recordFinal } from '../direction-board/record.mjs'
import { serveCompare } from './serve.mjs'

const FAKE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-site.mjs')
const HEIGHT = { A: 3000, B: 6000, C: 4500 } // 높이가 다른 세 쪽 — 같은 비율이 같은 자리를 뜻하는지 본다
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, ms = 20000, what = '') => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error(`기한 안에 안 됨: ${what}`); await sleep(100) } }
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

const root = mkdtempSync(join(tmpdir(), 'cmp-behavior-'))
const runDir = join(root, '런 폴더 공백', '청춘')
const spawned = []
let chrome, c, ev

/** 가짜 startSite: 진짜 프로세스(분리됨)를 띄우고 qa.startSite 와 같은 모양을 돌려준다. */
const fakeStartSite = async (siteDir) => {
  const name = basename(dirname(siteDir)).toUpperCase()
  const child = spawn(process.execPath, [FAKE, name, String(HEIGHT[name]), siteDir], { stdio: ['ignore', 'pipe', 'inherit'], detached: process.platform !== 'win32', windowsHide: true })
  spawned.push(child.pid)
  const port = await new Promise((ok, bad) => { child.stdout.once('data', (b) => ok(Number(String(b).match(/PORT (\d+)/)[1]))); child.once('exit', () => bad(new Error('가짜 사이트가 떴다 죽음'))) })
  return { url: `http://127.0.0.1:${port}`, port, pid: child.pid, stop: async () => killTree(child.pid) }
}

function makeRun() {
  mkdirSync(runDir, { recursive: true })
  writeFileSync(join(runDir, 'brief.json'), JSON.stringify({ topic: '시험용 한 줄', archetype: 'saas' }))
  for (const id of ['a', 'b', 'c']) {
    const dir = join(runDir, id)
    mkdirSync(join(dir, 'site', '.next'), { recursive: true })
    writeFileSync(join(dir, 'site', '.next', 'BUILD_ID'), 'x')
    writeFileSync(join(dir, 'candidate.json'), JSON.stringify({ id, source: 'library', recipe: 'r4-evidence', why: `${id} 이유`, blockers: id === 'b' ? ['공개 불가 — 확인 필요 사실: business.phone'] : [] }))
    writeFileSync(join(dir, '02-sitemap.json'), JSON.stringify({ data: { pages: [{ id: 'home', route: '/' }, { id: 'pricing', route: '/pricing' }, { id: 'about', route: '/about' }, { id: 'terms', route: '/terms', legal: true }] } }))
  }
}
const deps = { startSite: fakeStartSite, loadBoardData, headOf: () => null, labelOf: (id) => ({ home: '홈', pricing: '요금', about: '소개' })[id] ?? id }
const open = (extra = {}) => serveCompare(runDir, { handleSignals: false, log: () => {}, info: () => {}, deps, ...extra })

// 대시보드의 iframe 안(다른 출처)에서 식을 돌린다: 틀 나무에서 출처로 틀을 찾고 격리 세계에서 평가.
async function inFrame(origin, expression) {
  const { frameTree } = (await c.send('Page.getFrameTree')).result
  const find = (t) => (t.frame.url.startsWith(origin) ? t.frame : (t.childFrames ?? []).map(find).find(Boolean))
  const frame = find(frameTree)
  if (!frame) throw new Error(`틀을 못 찾음: ${origin}`)
  const { executionContextId } = (await c.send('Page.createIsolatedWorld', { frameId: frame.id, worldName: 'cmp-test' })).result
  const r = await c.send('Runtime.evaluate', { contextId: executionContextId, expression, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}

before(async () => {
  makeRun()
  chrome = await startChrome([...GATE_CHROME_FLAGS, ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])], { prefix: 'cmp-behavior-' })
  c = await connect(chrome.wsUrl)
  await c.send('Page.enable'); await c.send('Runtime.enable')
  ev = c.ev
})
after(async () => {
  c?.ws.close(); await chrome?.close()
  for (const pid of spawned) killTree(pid)
  rmSync(root, { recursive: true, force: true })
})

test('대시보드: 세 칸이 실제 사이트를 띄우고 폭·쪽·안쪽 이동·스크롤·크게 보기·확정이 동작하며, 확정 뒤 후보 프로세스는 0이다', async () => {
  const s = await open()
  const { url } = s
  const titles = () => ev(`[...document.querySelectorAll('[data-title]')].map((e) => e.textContent)`)
  const press = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`)
  const pressed = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).getAttribute('aria-pressed')`)
  const origins = JSON.parse(await (async () => { await navigateAndWait(c.send, ev, url); return ev(`JSON.stringify([...document.querySelectorAll('iframe')].map((f) => new URL(f.src).origin))`) })())
  assert.equal(origins.length, 3)

  // ① 세 iframe 의 title 메시지가 온다 — frame-ancestors 'none' 인 사이트가 그려졌다는 뜻이다
  await until(async () => (await titles()).every((t) => /^홈 · [ABC]$/.test(t)), 20000, `title 메시지 ${JSON.stringify(await titles())}`)

  // ② 폭 768 → 세 iframe 폭 768
  await press('[data-w="768"]')
  assert.deepEqual(await ev(`[...document.querySelectorAll('iframe')].map((f) => f.style.width)`), ['768px', '768px', '768px'])

  // ③ 쪽 「요금」 → 세 칸 모두 /pricing
  await press('[data-p="/pricing"]')
  await until(async () => (await titles()).every((t) => /^요금 · [ABC]$/.test(t)), 15000, `요금 ${JSON.stringify(await titles())}`)

  // ④ 한 칸 안쪽에서 pushState 로 /about 으로 가면(load 이벤트 없음) 쪽 버튼이 소개로 바뀌고 나머지 칸도 따라간다
  await inFrame(origins[0], `document.getElementById('go').click(), 1`)
  await until(async () => (await pressed('[data-p="/about"]')) === 'true' && (await titles()).every((t) => /^소개 · [ABC]$/.test(t)), 15000, `소개 ${JSON.stringify(await titles())}`)
  assert.equal(await pressed('[data-p="/pricing"]'), 'false')

  // ⑤ 스크롤 함께: 높이가 다른 세 쪽이 같은 비율에 선다
  const ratio = (o) => inFrame(o, `(() => { const d = document.scrollingElement, max = d.scrollHeight - innerHeight; return max > 0 ? scrollY / max : -1 })()`)
  await inFrame(origins[0], `(() => { const d = document.scrollingElement; scrollTo(0, Math.round((d.scrollHeight - innerHeight) * 0.6)); return 1 })()`)
  await until(async () => { const r = await Promise.all(origins.map(ratio)); return r.every((x) => x >= 0) && Math.max(...r) - Math.min(...r) <= 0.05 && r[1] > 0.4 }, 15000, `스크롤 비율 ${JSON.stringify(await Promise.all(origins.map(ratio)))}`)

  // ⑥ 크게 보기 → 보이는 열 1개
  await press('[data-focus="b"]')
  assert.equal(await ev(`[...document.querySelectorAll('.col')].filter((e) => getComputedStyle(e).display !== 'none').length`), 1)
  await press('[data-l="three"]')
  assert.equal(await ev(`[...document.querySelectorAll('.col')].filter((e) => getComputedStyle(e).display !== 'none').length`), 3)

  // ⑦ 확정 → picks.json · 종료 사유 · 코드
  await ev(`(() => { const t = document.querySelector('[data-memo="b"]'); t.value = '마음에 들어요'; t.dispatchEvent(new Event('input')) })()`)
  await press('[data-pick="b"]')
  await press('#ok')
  const end = await until(() => Promise.race([s.done, sleep(15000).then(() => null)]), 20000, '확정 뒤 종료')
  assert.deepEqual(end, { reason: 'picked', exitCode: 0 })
  assert.equal(await s.pick, 'b')
  const picks = JSON.parse(readFileSync(join(runDir, 'direction-board', 'picks.json'), 'utf8'))
  assert.deepEqual({ ...picks, decidedAt: typeof picks.decidedAt }, { run: '청춘', board: 1, pick: 'b', promote: {}, note: '마음에 들어요', decidedAt: 'string' })

  // ⑧ 자식 프로세스 0 · 기록 파일 없음 · 결선 기록(record)이 읽는 모양
  await until(() => spawned.every((p) => !alive(p)), 10000, `남은 프로세스 ${spawned.filter(alive)}`)
  assert.throws(() => readFileSync(join(runDir, 'direction-board', 'serve.pids.json')), /ENOENT/)
  const r = recordFinal({ run: runDir, pick: picks.pick, promote: picks.promote, pairsFile: join(root, 'pairs.jsonl') })
  assert.equal(r.rows.length, 2, '고른 안 × 진 안 두 줄')
})

test('보안: Host·Origin·토큰이 맞지 않으면 거절하고, 첫 핑 뒤 핑이 끊기면 탭이 닫힌 것으로 보아 끈다 (종료 4)', async () => {
  const before_ = spawned.length
  const s = await open({ tabGoneMs: 400 })
  const u = new URL(s.url)
  const rawGet = (path, headers = {}) => new Promise((ok, bad) => {
    import('node:http').then(({ default: http }) => http.get({ host: '127.0.0.1', port: u.port, path, headers: { host: `127.0.0.1:${u.port}`, ...headers } }, (res) => { res.resume(); ok(res.statusCode) }).on('error', bad))
  })
  assert.equal(await rawGet(u.pathname), 200)
  assert.equal(await rawGet(u.pathname, { host: `evil.example:${u.port}` }), 403, 'Host 다름 — DNS 재바인딩')
  assert.equal(await rawGet(u.pathname, { origin: 'http://evil.example' }), 403, 'Origin 다름')
  assert.equal(await rawGet('/c/0000/'), 404, '토큰 다름')
  assert.equal(await rawGet('/'), 404, '토큰 없음')
  const post = (path, body, type = 'application/json') => fetch(`${u.origin}${path}`, { method: 'POST', headers: { 'content-type': type, origin: u.origin }, body })
  assert.equal((await post(`${u.pathname}api/pick`, '{"pick":"zz"}')).status, 400, '없는 후보')
  assert.equal((await post(`${u.pathname}api/pick`, '{"pick":"a"}', 'text/plain')).status, 415, 'JSON 이 아니면 거절')
  await post(`${u.pathname}api/ping`, '{"active":true}') // 첫 핑 — 이제부터 핑이 끊기는지 본다
  const end = await until(() => Promise.race([s.done, sleep(8000).then(() => null)]), 12000, '탭 닫힘 감시')
  assert.deepEqual(end, { reason: 'tab-gone', exitCode: 4 })
  assert.equal(await s.pick, null)
  await until(() => spawned.slice(before_).every((p) => !alive(p)), 10000, '자식 프로세스 정리')
})
