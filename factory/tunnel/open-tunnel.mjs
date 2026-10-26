// 터널 열기 모듈(sitebrew v0.2.0 계획 4 Task 7, 모듈 O) — 터널 도구 프로세스 하나를 띄워 공개 주소를 출력에서 찾고, 그 주소가 실제로 열릴 때까지 기다린다.
//   openTunnel(p, port, ctx) → { url, pid, stop(), exited } — 실패는 Error 의 .reason: toolMissing · urlNotFound · notReachable · exited, 출력 끝줄은 .tail(경로·비밀 가림).
//   · 자식 프로세스·fetch·시계는 ctx(spawn·fetch·now)로 받는다. command 를 주면 시험용으로 그 argv 를 쓰고, 기본은 [p.tool, ...providerArgs(p, port)] — 사용자 값은 들어가지 않는다.
//   · 모든 실패 경로에서 자식을 PID 나무째 끄고 실제로 끝날 때까지 기다린 뒤 던진다. 성공하면 stop() 이 같은 일을 한다(여러 번 불러도 안전).
//   · 로그 파일은 쓰지 않는다 — onLine(줄) 콜백만 연다(session 모듈이 .tmp/tunnel/tunnel.log 에 쓴다). 사용자 문장도 여기에 없다(notices.mjs/copy.json).
//   exited 는 자식이 끝나면 풀리는 약속이다(성공 뒤에 터널이 죽는 것을 session 이 알아챈다).
import { spawn as nodeSpawn } from 'node:child_process'
import { envWithoutSecrets } from '../lib/secret-env.mjs'
import { killTree } from '../stamp/run-proc.mjs'
import { findUrl, providerArgs } from './providers.mjs'
import { scrubTail } from './site-server.mjs'

const WIN = process.platform === 'win32'
/** 주소 찾기용으로 쥐고 있는 출력 길이 한도(글자) */
const BUF_MAX = 16_384
/** 끄고 나서 자식이 끝나기를 기다리는 한도(ms) */
const KILL_WAIT_MS = 3000
/** 'exit' 뒤 출력 통이 닫히기를 기다리는 한도(ms) — 손자가 통을 쥐고 있어도 끝난 것으로 본다 */
const DRAIN_MS = 300

const defaults = {
  spawn: nodeSpawn,
  fetch: (...a) => globalThis.fetch(...a),
  now: () => Date.now(),
  command: undefined,
  env: undefined,
  onLine: () => {},
  intervalMs: 1000,
  requestMs: 5000,
}

/** 터널 도구를 띄워 주소를 얻고 도달을 확인한다. */
export async function openTunnel(p, port, ctx = {}) {
  const c = { ...defaults, ...ctx }
  const argv = c.command ?? [p.tool, ...providerArgs(p, port)]
  const env = c.env ?? envWithoutSecrets(process.env)

  const st = { buf: '', rest: '', lines: [], gone: false, spawnError: null }
  let wake = null
  const changed = () => { const w = wake; wake = null; w?.() }
  const pause = (ms) => new Promise((resolve) => {
    const t = setTimeout(resolve, Math.max(1, ms))
    wake = () => { clearTimeout(t); resolve() }
  })

  const child = c.spawn(argv[0], argv.slice(1), { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: !WIN })
  let exitCode = null
  let exitedFlag = false
  let drainTimer = null
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      exitedFlag = true
      exitCode = code ?? signal
      drainTimer = setTimeout(() => { st.gone = true; changed() }, DRAIN_MS)
      resolve(exitCode)
    })
    child.once('error', (e) => { st.spawnError = e; exitedFlag = true; resolve(null); changed() })
  })
  child.once('close', () => { clearTimeout(drainTimer); st.gone = true; changed() })

  const take = (chunk) => {
    const text = String(chunk)
    st.buf = `${st.buf}${text}`.slice(-BUF_MAX)
    const parts = `${st.rest}${text}`.split(/\r?\n/)
    st.rest = parts.pop() ?? ''
    for (const line of parts) { st.lines.push(line); if (st.lines.length > 40) st.lines.shift(); c.onLine(line) }
    changed()
  }
  child.stdout?.on('data', take)
  child.stderr?.on('data', take)

  const stop = async () => {
    killTree(child.pid)
    if (!exitedFlag) await Promise.race([exited, new Promise((r) => setTimeout(r, KILL_WAIT_MS))])
    clearTimeout(drainTimer)
  }
  const fail = async (reason) => {
    await stop()
    const text = [...st.lines, st.rest].join('\n')
    throw Object.assign(new Error(`tunnel ${reason}`), { reason, tail: scrubTail(text, { env: { ...process.env, ...env } }) })
  }

  // 1) 출력에서 주소를 찾는다(주소가 있으면 자식이 곧 끝났어도 그것을 먼저 본다)
  const readyDeadline = c.now() + p.readyMs
  let url = null
  for (;;) {
    if (st.spawnError) return fail(st.spawnError.code === 'ENOENT' ? 'toolMissing' : 'exited')
    url = findUrl(p, st.buf)
    if (url) break
    if (st.gone) return fail('exited')
    const left = readyDeadline - c.now()
    if (left <= 0) return fail('urlNotFound')
    await pause(left)
  }

  // 2) 그 주소가 실제로 열릴 때까지 기다린다
  const reachDeadline = c.now() + p.reachMs
  for (;;) {
    if (st.gone || st.spawnError) return fail('exited')
    try {
      const r = await c.fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(c.requestMs) })
      r.body?.cancel?.().catch?.(() => {})
      if (r.status < 500) break
    } catch { /* 아직 안 열렸다 */ }
    const left = reachDeadline - c.now()
    if (left <= 0) return fail('notReachable')
    await pause(Math.min(c.intervalMs, left))
  }
  return { url, pid: child.pid, stop, exited }
}
