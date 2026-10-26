// 임시 공개 주소 입구 CLI(계획 4 Task 8) — `node factory/tunnel/preview-link.mjs <tools|start|status|stop|notices>`.
//   표준출력은 JSON 하나, 진행은 표준오류 한 줄씩. 종료 코드: 0 성공 · 1 실패(reason) · 2 인자 오류 · 3 사람 확인 필요(need).
//   · 이 파일은 명령을 모듈에 나눠 줄 뿐이다: 인자(cli-args) · 세션(session) · 상태(state) · 도구(tools) · 문장(notices).
//   · `start` 는 세션을 직접 돌리지 않는다. 같은 파일을 내부 명령 `serve` 로 떼어 띄우고(데몬) 상태 파일이 끝 상태가 될 때까지 읽는다 — 챗봇 창이 닫혀도 세션은 이어진다.
//   · 공개 주소는 사용자가 「네」 한 뒤에만 열려야 하므로 이 도구는 묻지 않고, 부르는 쪽(스킬)이 묻는다. 설치 명령도 계획만 낸다.
import { existsSync, readFileSync } from 'node:fs'
import { spawn as nodeSpawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { envWithoutSecrets } from '../lib/secret-env.mjs'
import { killTree } from '../stamp/run-proc.mjs'
import { ArgError, parseCliArgs } from './cli-args.mjs'
import { failure, notices, text } from './notices.mjs'
import { loadProviders } from './providers.mjs'
import { LOG_NAME, runSession } from './session.mjs'
import { siteKind } from './site-kind.mjs'
import { clearState, isAlive, readState, writeState } from './state.mjs'
import { findTool, installPlan } from './tools.mjs'

export const CLI_FILE = fileURLToPath(import.meta.url)
/** 준비(설치·빌드·터널 열기) 전체를 기다리는 한도 */
export const PREPARE_MS = 60 * 60_000
const POLL_MS = 500
const ACTIVE = ['preparing', 'building', 'starting', 'opening', 'ready']
const TERMINAL = ['ready', 'failed', 'stopped']
const MINUTE_MS = 60_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const readOsRelease = () => { try { return readFileSync('/etc/os-release', 'utf8') } catch { return '' } }

const defaults = () => ({
  providers: loadProviders(),
  platform: process.platform,
  env: process.env,
  exists: existsSync,
  osRelease: process.platform === 'linux' ? readOsRelease() : '',
  spawn: nodeSpawn,
  kill: killTree,
  isAlive,
  sleep,
  now: () => Date.now(),
  stderr: (line) => process.stderr.write(`${line}\n`),
  run: runSession,
  kindOf: (dir) => siteKind(dir),
  onSignals: (abort) => {
    const names = ['SIGTERM', 'SIGINT', 'SIGHUP']
    for (const n of names) process.once(n, abort)
    return () => { for (const n of names) process.off(n, abort) }
  },
})

const reply = (code, out) => ({ code, out })
const logPath = join('.tmp', 'tunnel', LOG_NAME)
/** 상태 파일에서 사용자에게 보일 칸만 */
const shown = (s) => Object.fromEntries(['status', 'provider', 'url', 'expiresAt', 'reason'].filter((k) => s[k] !== undefined).map((k) => [k, s[k]]))

/** 도구 있나 + 설치 계획. 계획은 도구가 없을 때만 붙는다. */
function toolReport(p, d, lang) {
  const ctx = { platform: d.platform, env: d.env, exists: d.exists, osRelease: d.osRelease }
  const found = findTool(p, ctx)
  const row = { id: p.id, tool: p.tool, found: found.found }
  if (found.found) return { ...row, path: found.path }
  const plan = installPlan(p, ctx)
  if (!plan.supported) return { ...row, plan: { ...plan, message: failure(lang, plan.manual) } }
  return { ...row, plan: { ...plan, steps: plan.steps.map((s) => ({ ...s, text: text(lang, s.textKey) })) } }
}

function cmdTools(a, d) {
  const ids = a.provider === 'auto' ? d.providers.order : [a.provider]
  return reply(0, { status: 'ok', platform: d.platform, providers: ids.map((id) => toolReport(d.providers.providers[id], d, a.lang)) })
}

function cmdNotices(a, d) {
  const provider = a.provider === 'auto' ? d.providers.default : a.provider
  return reply(0, { status: 'ok', notices: notices({ lang: a.lang, kind: a.kind, provider, minutes: a.minutes }) })
}

/** 열린 세션을 사용자에게 보일 모양으로 */
function readyOut(state, { lang, minutes }) {
  return {
    ...shown(state),
    product: state.product === true,
    notices: notices({ lang, kind: state.product ? 'product' : 'site', provider: state.provider, minutes }),
  }
}

function failedOut(state, lang) {
  const reason = state.reason ?? 'unexpected'
  return { ...shown(state), status: 'failed', reason, message: failure(lang, reason), log: logPath }
}

/** 이 폴더에 살아 있는 세션 상태(없으면 null) */
function liveSession(site, d) {
  const s = readState(site)
  return s && ACTIVE.includes(s.status) && d.isAlive(s.pids?.daemon) ? s : null
}

/** 가장 먼저 쓸 공급자가 없을 때의 설치 확인 요청. 없으면 null. */
function installNeed(a, d) {
  const ids = a.provider === 'auto' ? d.providers.order : [a.provider]
  const rows = ids.map((id) => toolReport(d.providers.providers[id], d, a.lang))
  const preferred = rows[0]
  if (preferred.found) return null
  if (a.provider === 'auto' && rows.some((r) => r.found) && !preferred.plan.supported) return null
  return { status: 'needs', need: 'install', reason: 'toolMissing', message: failure(a.lang, 'toolMissing'), provider: preferred.id, plan: preferred.plan }
}

function daemonArgs(a) {
  return [CLI_FILE, 'serve', '--site', a.site, '--provider', a.provider, '--minutes', String(a.minutes), '--lang', a.lang, ...(a.allowMock ? ['--allow-mock'] : [])]
}

/** 상태 파일이 끝 상태가 될 때까지 읽는다. 데몬이 죽거나 한도를 넘기면 failed 모양으로 돌려준다. */
async function waitForEnd(site, child, d) {
  const deadline = d.now() + PREPARE_MS
  let last = null
  for (;;) {
    const s = readState(site)
    if (s && s.status !== last) { last = s.status; d.stderr(`step: ${s.status}`) }
    if (s && TERMINAL.includes(s.status)) return s
    if (!d.isAlive(child.pid)) return { status: 'failed', reason: 'unexpected' }
    if (d.now() >= deadline) {
      d.kill(child.pid)
      return { status: 'failed', reason: 'timeout' }
    }
    await d.sleep(POLL_MS)
  }
}

async function cmdStart(a, d) {
  if (!d.exists(join(a.site, 'package.json'))) return reply(1, { status: 'failed', reason: 'noPackage', message: failure(a.lang, 'noPackage') })

  const live = liveSession(a.site, d)
  if (live) return reply(0, { ...(live.status === 'ready' ? readyOut(live, a) : shown(live)), alreadyRunning: true })

  const kind = d.kindOf(a.site)
  if (kind.product && !a.allowMock) {
    return reply(3, { status: 'needs', need: 'allowMock', reason: 'mockNeedsOk', message: failure(a.lang, 'mockNeedsOk'), notices: notices({ lang: a.lang, kind: 'product', provider: d.providers.default, minutes: a.minutes }) })
  }
  const install = installNeed(a, d)
  if (install) return reply(3, install)

  clearState(a.site)
  const child = d.spawn(process.execPath, daemonArgs(a), { cwd: a.site, env: envWithoutSecrets(d.env), detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()

  const end = await waitForEnd(a.site, child, d)
  if (end.status === 'ready') return reply(0, readyOut(end, a))
  return reply(1, failedOut(end, a.lang))
}

function cmdStatus(a, d) {
  const s = readState(a.site)
  if (!s) return reply(0, { status: 'none' })
  const alive = d.isAlive(s.pids?.daemon)
  if (!alive) return reply(0, { status: s.status, alive, ...(s.reason ? { reason: s.reason } : {}) })
  const out = { ...shown(s), alive }
  if (s.status !== 'ready') return reply(0, out)
  const minutes = Math.max(1, Math.ceil((Date.parse(s.expiresAt) - d.now()) / MINUTE_MS))
  return reply(0, { ...out, ...readyOut(s, { lang: a.lang, minutes }), alive })
}

function cmdStop(a, d) {
  const s = readState(a.site)
  if (!s) return reply(0, { status: 'none' })
  const pids = ['daemon', 'tunnel', 'server'].map((k) => s.pids?.[k]).filter((p) => Number.isInteger(p))
  for (const pid of pids) d.kill(pid)
  writeState(a.site, { status: 'stopped', reason: 'stopped', url: null, port: null, expiresAt: null, pids: { daemon: null, server: null, tunnel: null } })
  return reply(0, { status: 'stopped', killed: pids.length })
}

/** 데몬 본체: 세션을 끝까지 돌린다. 출력은 없고, 결과는 상태 파일에 있다. */
async function cmdServe(a, d) {
  const abort = new AbortController()
  const off = d.onSignals(() => abort.abort())
  try {
    await d.run({ site: a.site, providerId: a.provider, minutes: a.minutes, allowMock: a.allowMock, lang: a.lang, signal: abort.signal })
  } finally {
    off()
  }
  return reply(0, undefined)
}

const COMMAND_RUNNERS = { tools: cmdTools, start: cmdStart, status: cmdStatus, stop: cmdStop, notices: cmdNotices, serve: cmdServe }

/** 명령 하나를 돌려 { code, out } 을 돌려준다. deps 로 프로세스·시계·도구 확인을 바꿔 끼운다. */
export async function main(argv, deps = {}) {
  const d = { ...defaults(), ...deps }
  let args
  try {
    args = parseCliArgs(argv, { providerIds: Object.keys(d.providers.providers) })
  } catch (e) {
    if (e instanceof ArgError) return reply(2, { status: 'error', error: e.message })
    throw e
  }
  return COMMAND_RUNNERS[args.command](args, d)
}

// 터미널에서 직접 실행했을 때만 돈다(시험은 main 을 가져다 쓴다)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out } = await main(process.argv.slice(2))
  if (out !== undefined) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  process.exitCode = code
}
