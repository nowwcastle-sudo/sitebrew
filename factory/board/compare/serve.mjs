// 비교 서버(v0.2.6 T4 · 설계 D1~D4, P2 F1·F2·F7) — 후보 3개를 각자 `next start` 로 띄우고, 중계(proxy.mjs)를 앞에 세우고, 대시보드(page.mjs)를 내주며,
// 사용자가 「이 안으로」를 누르면 picks.json 을 쓰고 모두 끈다. 파일·프로세스·소켓을 만지는 곳은 compare/ 에서 여기 하나뿐이다.
//
// 순서가 중요하다: 대시보드 서버가 먼저 listen 해서 포트를 얻고(그래야 중계가 frame-ancestors 에 그 출처를 넣는다) → 후보 서버 → 중계 → 페이지.
// 안전: 모두 127.0.0.1 · 대시보드 주소에 실행마다 랜덤 토큰(/c/<토큰>/) · Host 가 127.0.0.1:<포트>가 아니면 403(DNS 재바인딩) ·
//   Origin 이 있으면 대시보드 출처일 때만(남의 페이지가 쏜 POST 거절) · 페이지는 CSP(인라인은 해시만) · 쓰기 API 는 JSON 만.
// 수명: 대시보드가 10초마다 핑 → 첫 핑 뒤 90초 동안 핑이 없으면 탭이 닫힌 것으로 보고 끈다 · 입력이 idleMs 동안 없으면 끈다 ·
//   exit·SIGINT·SIGTERM·SIGHUP 에서 후보 서버를 동기로 끈다 · 비정상 종료로 남은 서버는 다음 실행의 cleanupStale 이 신원(PID+시작 시각+명령줄)을 대조해 끈다.
// 종료 코드(build.mjs 가 쓴다): 확정·stop 0 · 무입력/탭 닫힘 4 · 띄운 후보 0개 1(serveCompare 가 .exitCode = 1 인 Error 를 던진다).
import http from 'node:http'
import os from 'node:os'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { startSite } from '../../stamp/qa.mjs'
import { killTree } from '../../stamp/run-proc.mjs'
import { readCandidateHead } from '../promote.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { readRunBrief } from '../direction-board/run-brief.mjs'
import { parseRecipe } from '../../scripts/recipe.mjs'
import { oklchToHex } from '../../scripts/style-presets.mjs'
import { renderComparePage, pageCsp } from './page.mjs'
import { startProxy } from './proxy.mjs'
import { bridgeSourceFor } from './bridge-source.mjs'
import { buildCompareData, commonRoutes } from './compare-data.mjs'
import { inspectProcess } from './proc-info.mjs'
import { cleanupStale, clearPids, writePids } from './pids.mjs'

export const EXIT = { done: 0, nothingStarted: 1, idle: 4 }
const HERO_REL = join('07-qa', 'ux', 'home', 'gate', 'hero-1440-light.png')
const BODY_LIMIT = 64 * 1024

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
function writeAtomic(file, text) { writeFileSync(`${file}.tmp`, text); renameSync(`${file}.tmp`, file) }

/** 후보의 레시피 머리 객체(색 칩용). 못 읽으면 null — 칩이 없을 뿐 비교는 계속된다. */
function defaultHeadOf(candDir, cand) {
  try {
    const h = readCandidateHead(candDir)
    if (h?.recipe && typeof h.recipe === 'object') return h.recipe
    const draft = join(candDir, 'recipe', 'DESIGN.md')
    if (existsSync(draft)) return parseRecipe(readFileSync(draft, 'utf8'))
    return loadHeads().find((x) => x.id === cand.recipe) ?? null
  } catch { return null }
}

function readBody(req) {
  return new Promise((done, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => { size += c.length; if (size > BODY_LIMIT) { fail(new Error('본문이 너무 크다')); req.destroy() } else chunks.push(c) })
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}
const send = (res, status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra })
  res.end(body)
}

/**
 * @param {string} runDir 실행 폴더(공백·한글 경로 가능)
 * @param {{ idleMs?: number, tabGoneMs?: number, log?: (s:string)=>void, info?: (s:string)=>void, handleSignals?: boolean, deps?: object }} [opts]
 *   log = 표준출력 규약 줄(COMPARE · PICK) · info = 진행 안내(표준오류). tabGoneMs = 첫 핑 뒤 핑이 끊기는 한도(기본 90초).
 *   deps = 바꿔 끼우기(시험·build.mjs): loadBoardData · startSite · killTree · startProxy · inspect · headOf · labelOf
 * @returns {Promise<{ url: string, pick: Promise<string|null>, done: Promise<{ reason: string, exitCode: number }>, stop(): Promise<void> }>}
 */
export async function serveCompare(runDirIn, { idleMs = 7_200_000, tabGoneMs = 90_000, log = console.log, info = console.error, handleSignals = true, deps = {} } = {}) {
  const d = { startSite, killTree, startProxy, inspect: inspectProcess, headOf: defaultHeadOf, labelOf: null, ...deps }
  const runDir = resolve(runDirIn)
  const boardDir = join(runDir, 'direction-board')
  mkdirSync(boardDir, { recursive: true })

  // ── 지난 실행이 남긴 서버 ──
  const stale = cleanupStale(boardDir, { inspect: d.inspect, kill: d.killTree })
  if (stale.killed.length) info(`지난 실행이 남긴 후보 서버 ${stale.killed.length}개를 껐어요.`)
  for (const s of stale.skipped) info(`남은 프로세스 ${s.pid}는 끄지 않았어요 — ${s.why}. 직접 확인해 주세요.`)

  // ── 수명 · 정리 장치(후보 서버를 띄우기 전에 준비한다) ──
  const owned = new Map() // pid → entry
  const killOwned = () => { for (const pid of owned.keys()) d.killTree(pid) }
  const onExit = () => killOwned()
  process.on('exit', onExit)
  const signalHandlers = handleSignals ? ['SIGINT', 'SIGTERM', 'SIGHUP'].map((sig) => [sig, () => { killOwned(); process.exit(128 + (os.constants.signals[sig] ?? 2)) }]) : []
  for (const [sig, fn] of signalHandlers) process.on(sig, fn)

  const proxies = [], sites = []
  let dashServer = null, watchdog = null, stopped = null
  let resolvePick, resolveDone
  const pick = new Promise((r) => { resolvePick = r })
  const done = new Promise((r) => { resolveDone = r })
  const state = { picked: null, html: null, csp: null, images: new Map(), ping: false, lastPing: Date.now(), lastInput: Date.now() }

  const stop = (reason = 'stopped') => {
    stopped ??= (async () => {
      clearInterval(watchdog)
      for (const p of proxies) await p.close().catch(() => {})
      if (dashServer) { dashServer.closeAllConnections(); await new Promise((r) => dashServer.close(() => r())) }
      for (const s of sites) await s.stop().catch(() => {})
      killOwned() // stop() 이 놓친 자식이 있어도
      owned.clear()
      clearPids(boardDir)
      process.off('exit', onExit)
      for (const [sig, fn] of signalHandlers) process.off(sig, fn)
      resolvePick(state.picked)
      resolveDone({ reason, exitCode: reason === 'idle' || reason === 'tab-gone' ? EXIT.idle : EXIT.done })
    })()
    return stopped
  }

  try {
    // ── 1) 대시보드 서버가 먼저 listen ──
    const token = randomBytes(16).toString('hex')
    const base = `/c/${token}/`
    dashServer = http.createServer((req, res) => handle(req, res).catch((e) => { try { send(res, 500, `서버 오류: ${e.message}`) } catch { /* 이미 끝남 */ } }))
    await new Promise((ok, bad) => { dashServer.once('error', bad); dashServer.listen(0, '127.0.0.1', ok) })
    const port = dashServer.address().port
    const dashOrigin = `http://127.0.0.1:${port}`
    const url = `${dashOrigin}${base}`

    // ── 2) 후보 서버 → 3) 중계 ──
    // build.mjs 가 직접 실행될 때는 자기 loadBoardData 를 넘긴다 — 여기서 build.mjs 를 import 하면 실행 중인 모듈과 순환해 멈춘다.
    const board = (d.loadBoardData ?? (await import('../direction-board/build.mjs')).loadBoardData)(runDir)
    if (!board.cands.length) throw Object.assign(new Error('후보가 없다'), { exitCode: EXIT.nothingStarted })
    const bridgeSource = bridgeSourceFor(dashOrigin)
    const origins = {}, fallbackImgs = {}, extras = {}
    await Promise.all(board.cands.map(async (c) => {
      const candDir = join(runDir, c.id), siteDir = join(candDir, 'site')
      extras[c.id] = { aiTell: readJson(join(candDir, '08-board.json'))?.data?.aiTell ?? null }
      const hero = join(candDir, HERO_REL)
      if (existsSync(hero)) { state.images.set(c.id, hero); fallbackImgs[c.id] = `img/${c.id}.png` }
      if (!existsSync(join(siteDir, '.next', 'BUILD_ID'))) { info(`후보 ${c.id}: 빌드가 없어 실사이트를 못 띄워요${fallbackImgs[c.id] ? ' — 첫 화면 사진으로 대신해요' : ''}.`); return }
      try {
        const site = await d.startSite(siteDir)
        sites.push(site)
        if (Number.isInteger(site.pid)) {
          const id = d.inspect(site.pid)
          owned.set(site.pid, { pid: site.pid, port: site.port, siteDir, startedAt: new Date().toISOString(), startTime: id?.startTime ?? null })
          writePids(boardDir, [...owned.values()])
        }
        const proxy = await d.startProxy({ upstreamPort: Number(new URL(site.url).port), dashboardOrigin: dashOrigin, bridgeSource })
        proxies.push(proxy)
        origins[c.id] = proxy.origin
      } catch (e) { info(`후보 ${c.id}: 실사이트를 못 띄웠어요 — ${String(e.message).split('\n')[0]}`) }
    }))
    if (!Object.keys(origins).length) throw Object.assign(new Error('띄운 후보 사이트가 하나도 없다 — 먼저 06 까지 빌드(npm run stamp)가 끝나야 한다'), { exitCode: EXIT.nothingStarted })

    // ── 페이지 ──
    const locale = readRunBrief(runDir).locale === 'en' ? 'en' : 'ko'
    const labelOf = d.labelOf ?? (await import('../../stamp/site-bind.mjs').then((m) => (id) => m.pageLabel(id, locale)).catch(() => (id) => id))
    const routes = commonRoutes(board.cands.map((c) => readJson(join(runDir, c.id, '02-sitemap.json'))?.data), labelOf)
    const heads = Object.fromEntries(board.cands.map((c) => [c.id, d.headOf(join(runDir, c.id), c)]))
    const data = buildCompareData({ board, notes: readJson(join(boardDir, 'notes.json')) ?? {}, origins, fallbackImgs, routes, heads, extras, toHex: oklchToHex })
    state.html = renderComparePage(data)
    state.csp = pageCsp(state.html, Object.values(origins))

    // ── 감시: 탭 닫힘 · 무입력 ──
    const tick = Math.min(5000, Math.max(50, Math.floor(tabGoneMs / 4)))
    watchdog = setInterval(() => {
      const now = Date.now()
      if (state.ping && now - state.lastPing > tabGoneMs) { info('대시보드 탭이 닫힌 것 같아 후보 서버를 껐어요.'); stop('tab-gone') }
      else if (now - state.lastInput > idleMs) { info('입력이 오래 없어 후보 서버를 껐어요.'); stop('idle') }
    }, tick)
    watchdog.unref?.()

    log(`COMPARE ${url}`)
    return { url, pick, done, stop: () => stop('stopped') }

    // ── 요청 처리 ──
    async function handle(req, res) {
      if (req.headers.host !== `127.0.0.1:${port}`) return send(res, 403, 'Host 가 맞지 않아요')
      if (req.headers.origin !== undefined && req.headers.origin !== dashOrigin) return send(res, 403, 'Origin 이 맞지 않아요')
      let path
      try { path = new URL(req.url, dashOrigin).pathname } catch { return send(res, 400, '주소가 잘못됐어요') }
      if (!path.startsWith(base)) return send(res, 404, '없어요')
      const route = path.slice(base.length)
      if (req.method === 'GET' && route === '') {
        return send(res, 200, state.html, 'text/html; charset=utf-8', { 'content-security-policy': state.csp, 'cross-origin-opener-policy': 'same-origin' })
      }
      const img = /^img\/([a-z0-9._-]+)\.png$/i.exec(route)
      if (req.method === 'GET' && img && state.images.has(img[1])) return send(res, 200, readFileSync(state.images.get(img[1])), 'image/png')
      if (req.method === 'POST' && route === 'api/ping') {
        state.ping = true; state.lastPing = Date.now()
        try { if (JSON.parse(await readBody(req) || '{}').active === true) state.lastInput = Date.now() } catch { /* 본문 없음 */ }
        return send(res, 204, '')
      }
      if (req.method === 'POST' && route === 'api/pick') {
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return send(res, 415, 'JSON 만 받아요')
        let body
        try { body = JSON.parse(await readBody(req)) } catch { return send(res, 400, 'JSON 이 아니에요') }
        if (state.picked) return send(res, 409, '이미 골랐어요')
        if (!board.cands.some((c) => c.id === body?.pick)) return send(res, 400, '없는 후보예요')
        const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : ''
        writeAtomic(join(boardDir, 'picks.json'), JSON.stringify({ run: board.run, board: 1, pick: body.pick, promote: {}, note, decidedAt: new Date().toISOString() }, null, 2) + '\n')
        state.picked = body.pick
        log(`PICK ${body.pick}`)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true }), () => setImmediate(() => stop('picked')))
        return
      }
      return send(res, 404, '없어요')
    }
  } catch (e) {
    await stop('failed')
    throw e
  }
}
