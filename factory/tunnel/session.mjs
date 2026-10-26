// 터널 세션(계획 4 Task 8, 모듈 X) — 앞선 모듈을 이어 한 번의 공개 주소 세션을 끝까지 돌린다.
//   runSession(opts, deps) → 마지막 상태 객체. 단계마다 상태 파일(state.mjs)을 쓰고, 어떤 길로 끝나든 터널 → 서버 순으로 정리한다.
//   · 이 모듈은 흐름만 안다: 종류 판정·환경(site-kind)·설치와 빌드(site-server)·터널 열기(open-tunnel)·도구 찾기(tools)·상태(state)는 deps 로 바꿔 끼운다.
//   · 사용자에게 보일 문장은 여기에 없다 — 상태의 reason 은 copy.json 의 failures 키이고 문장은 notices.mjs 가 만든다.
//   · 끝나는 길: 만료 시간 · 중지 신호(opts.signal) · 터널 프로세스 종료 중 먼저 오는 쪽. 실패는 status failed + reason.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { LANGS } from './notices.mjs'
import { loadProviders } from './providers.mjs'
import { openTunnel } from './open-tunnel.mjs'
import { TAIL_LINES, prepareSite, scrubTail, serveSite } from './site-server.mjs'
import { exportDir } from './static-export.mjs'
import { serveEnv, siteKind } from './site-kind.mjs'
import { writeState } from './state.mjs'
import { findTool } from './tools.mjs'

export const DEFAULT_MINUTES = 120
export const MIN_MINUTES = 5
export const MAX_MINUTES = 480

/** 터널 로그 파일 이름(<사이트>/.tmp/tunnel/ 아래) */
export const LOG_NAME = 'tunnel.log'
/** 모를 때 쓰는 실패 키(copy.json failures) */
const UNEXPECTED = 'unexpected'

const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve()
  const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve() }
  const timer = setTimeout(done, ms)
  signal?.addEventListener('abort', done, { once: true })
})

const defaults = () => ({
  providers: loadProviders(),
  kindOf: (dir) => siteKind(dir),
  exportOf: (dir) => exportDir(dir),
  envOf: (kind, o) => serveEnv(kind, o),
  prepare: prepareSite,
  serve: serveSite,
  open: openTunnel,
  find: (p) => findTool(p, { platform: process.platform, env: process.env, exists: existsSync }),
  wait: sleep,
  now: () => Date.now(),
  env: process.env,
  pid: process.pid,
  onState: () => {},
})

/** 입력 검사. 잘못된 값은 시작 전에 던진다. */
function check({ minutes, lang, providerId }, providers) {
  if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    throw new Error(`minutes must be an integer from ${MIN_MINUTES} to ${MAX_MINUTES}: ${JSON.stringify(minutes)}`)
  }
  if (!LANGS.includes(lang)) throw new Error(`lang must be one of ${LANGS.join(', ')}: ${JSON.stringify(lang)}`)
  if (providerId !== 'auto' && !providers.providers[providerId]) throw new Error(`unknown provider: ${JSON.stringify(providerId)}`)
}

/** 시도할 공급자 목록. auto 는 표 순서대로 도구가 있는 것만, 이름을 주면 그것 하나만(도구가 없으면 빈 목록). */
function candidates(providerId, providers, find) {
  const ids = providerId === 'auto' ? providers.order : [providerId]
  return ids.map((id) => providers.providers[id]).filter((p) => find(p).found)
}

/** 세션 하나를 끝까지 돌린다. */
export async function runSession(opts, deps = {}) {
  const d = { ...defaults(), ...deps }
  const { site, providerId = 'auto', minutes = DEFAULT_MINUTES, allowMock = false, lang = 'ko', signal } = opts
  check({ minutes, lang, providerId }, d.providers)

  const logDir = join(site, '.tmp', 'tunnel')
  const logFile = join(logDir, LOG_NAME)
  const write = (patch) => { const s = writeState(site, patch); d.onState(s); return s }
  // 로그는 어떤 길로 끝나든 남는다: 시작 줄 · 터널 출력 · 실패 이유와 끝줄 · 끝 줄. 비밀 값·경로는 scrubTail 이 가린다.
  const log = (text, lines = 1) => {
    try { mkdirSync(logDir, { recursive: true }); appendFileSync(logFile, `${scrubTail(text, { dir: site, env: d.env }, lines)}\n`) } catch { /* 로그 실패가 세션을 막지 않는다 */ }
  }
  const stopped = { server: null, tunnel: null }
  const cleanup = async () => {
    for (const key of ['tunnel', 'server']) {
      const handle = stopped[key]
      stopped[key] = null
      try { await handle?.stop() } catch { /* 이미 끝났다 */ }
    }
  }
  const end = (status, reason) => write({ status, reason, url: null, port: null, expiresAt: null, pids: { daemon: null, server: null, tunnel: null } })

  log(`session start provider=${providerId} minutes=${minutes}`)
  try {
    const kind = { ...d.kindOf(site), outDir: d.exportOf(site) }
    log(`site kind=${kind.product ? 'product' : 'site'} serve=${kind.outDir ? `static:${kind.outDir}` : 'next start'}`)
    write({ status: 'preparing', site, product: kind.product, startedAt: new Date(d.now()).toISOString(), reason: null, pids: { daemon: d.pid } })
    if (kind.product && !allowMock) throw Object.assign(new Error('mock needs ok'), { reason: 'mockNeedsOk' })
    const tools = candidates(providerId, d.providers, d.find)
    if (tools.length === 0) throw Object.assign(new Error('no tunnel tool'), { reason: 'toolMissing' })

    const env = d.envOf(kind, { outboxFile: join(logDir, 'outbox') })
    await d.prepare(site, kind, { env, onStep: (status) => write({ status }) })

    write({ status: 'starting' })
    const server = await d.serve(site, env, { kind })
    stopped.server = server
    write({ pids: { server: server.pid } })

    write({ status: 'opening' })
    let tunnel = null
    let last = null
    for (const p of tools) {
      try {
        tunnel = await d.open(p, server.port, { onLine: log })
        write({ provider: p.id })
        break
      } catch (e) {
        last = e
        log(`open ${p.id} failed: ${e?.reason ?? UNEXPECTED}`)
        if (e.tail) log(e.tail, TAIL_LINES)
      }
    }
    if (!tunnel) throw last
    stopped.tunnel = tunnel

    write({ status: 'ready', url: tunnel.url, port: server.port, expiresAt: new Date(d.now() + minutes * 60_000).toISOString(), pids: { tunnel: tunnel.pid } })

    // 먼저 오는 쪽에서 끝낸다: 만료 · 중지 신호 · 터널이 스스로 죽음
    const timer = new AbortController()
    const onSignal = () => timer.abort()
    signal?.addEventListener('abort', onSignal, { once: true })
    const why = await Promise.race([
      Promise.resolve(d.wait(minutes * 60_000, timer.signal)).then(() => (signal?.aborted ? 'stopped' : 'expired')),
      tunnel.exited.then(() => 'tunnelExited'),
    ])
    timer.abort()
    signal?.removeEventListener('abort', onSignal)
    await cleanup()
    log(`session end: ${why}`)
    return end('stopped', why)
  } catch (e) {
    const reason = typeof e?.reason === 'string' ? e.reason : UNEXPECTED
    log(`session failed: ${reason}${e?.step ? ` (step ${e.step})` : ''}`)
    if (e?.tail) log(e.tail, TAIL_LINES)
    else if (reason === UNEXPECTED) log(String(e?.stack ?? e), TAIL_LINES)
    await cleanup()
    return end('failed', reason)
  }
}
