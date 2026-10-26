// 사이트 서버 모듈(sitebrew v0.2.0 계획 4 Task 6, 모듈 S) — 전달받은 사이트 폴더를 production 으로 설치·빌드·서버 켜기까지만 한다.
//   prepareSite(dir, kind, ctx) → { installed, built } — node_modules/next 가 없으면 npm install, 빌드 결과(서버형 .next/BUILD_ID · 정적 내보내기 <outDir>/index.html)가 없거나 빌드 기록(.tmp/tunnel/built-for)이 요청한 종류와 다르면 npm run build.
//   serveSite(dir, env, opts) → { port, pid, stop } — 서버형은 기존 startServer(next start, 127.0.0.1 에만 바인딩), 정적 내보내기(kind.outDir)는 static-server.mjs 로 그 폴더를 서빙한다. next start 는 output: "export" 를 서빙하지 못한다.
//   kind = { product, outDir? } — outDir 는 static-export.mjs 가 정한 내보내기 폴더 이름(없거나 null 이면 서버형).
//   scrubTail(text, { dir, home, env }) → 출력 끝 20줄에서 이 PC 경로와 비밀 이름 값을 가린 글.
//   · 환경은 받은 그대로 자식에 넘긴다 — 비밀 제거와 제품형 mock 값은 site-kind.mjs serveEnv 가 이미 정한 환경이다(여기서 만들지 않는다).
//   · 프로세스·파일은 모두 ctx(run·exists·read·write·onStep)로 받아 시험이 바꿔 끼운다. 실패는 Error 에 .reason(installFailed·buildFailed·timeout)·.step·.tail 을 달아 던진다 — 사용자 문장은 notices.mjs/copy.json 몫이라 여기에는 없다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { SECRET_ENV_NAMES } from '../lib/secret-env.mjs'
import { run as runProc, startServer } from '../stamp/run-proc.mjs'
import { startStaticServer } from './static-server.mjs'

/** 설치·빌드 시간 제한(ms) */
export const INSTALL_TIMEOUT_MS = 20 * 60_000
export const BUILD_TIMEOUT_MS = 30 * 60_000
/** 실패 출력에서 남기는 끝줄 수 */
export const TAIL_LINES = 20
/** 이 모듈이 던지는 reason — copy.json failures 에 모두 있어야 한다 */
export const REASONS = Object.freeze(['installFailed', 'buildFailed', 'timeout', 'outputMissing', 'serverFailed', 'exportNeedsStatic'])
/** next start 가 정적 내보내기 설정 때문에 거절할 때 출력에 나오는 글 */
const EXPORT_REFUSAL = /output:\s*["']?export/i
/** 비밀 값으로 보고 가릴 최소 길이 — 너무 짧은 값은 일반 글자를 망가뜨린다 */
const MIN_SECRET_LEN = 4

const isSecretName = (k) => SECRET_ENV_NAMES.includes(k) || /^HIGGSFIELD_/i.test(k)
/** 경로의 역슬래시·슬래시 두 모양 */
const shapes = (p) => [...new Set([p, p.replaceAll('\\', '/'), p.replaceAll('/', '\\')])]

/** 출력 끝 20줄만 남기고 비밀 이름 값 → ***, 사이트 폴더 → <site>, 홈 폴더 → ~ 로 바꾼다. 긴 경로(사이트 폴더)를 먼저 바꾼다. */
export function scrubTail(text, { dir, home = homedir(), env = {} } = {}, lines = TAIL_LINES) {
  let out = String(text ?? '').split(/\r?\n/).filter((l) => l.trim() !== '').slice(-lines).join('\n')
  for (const [k, v] of Object.entries(env)) {
    if (isSecretName(k) && typeof v === 'string' && v.length >= MIN_SECRET_LEN) out = out.replaceAll(v, '***')
  }
  for (const [p, to] of [[dir, '<site>'], [home, '~']]) {
    if (!p) continue
    for (const s of shapes(p)) out = out.replaceAll(s, to)
  }
  return out
}

const fail = (reason, step, tail, ctx, dir) => Object.assign(new Error(`${step} ${reason}`), { reason, step, tail: scrubTail(tail, { dir, home: ctx.home, env: { ...process.env, ...ctx.env } }) })

const defaults = {
  env: process.env,
  platform: process.platform,
  home: undefined,
  run: runProc,
  exists: existsSync,
  read: (p) => readFileSync(p, 'utf8'),
  write: (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text) },
  onStep: () => {},
}

/** 설치·빌드가 필요한 만큼만 돌린다. 던지면 .reason 이 키다. */
export async function prepareSite(dir, kind, ctx = {}) {
  const c = { ...defaults, ...ctx }
  const npm = c.platform === 'win32' ? 'npm.cmd' : 'npm'
  const label = `${kind.product ? 'product' : 'site'}${kind.outDir ? '-static' : ''}`
  const builtOutput = () => c.exists(kind.outDir ? join(dir, kind.outDir, 'index.html') : join(dir, '.next', 'BUILD_ID'))
  const recordFile = join(dir, '.tmp', 'tunnel', 'built-for')
  const step = async (name, args, timeoutMs, failKey) => {
    const r = await c.run(npm, args, { cwd: dir, env: c.env, timeoutMs })
    if (r.timedOut) throw fail('timeout', name, r.tail, c, dir)
    if (r.code !== 0) throw fail(failKey, name, r.tail, c, dir)
  }

  let installed = false
  if (!c.exists(join(dir, 'node_modules', 'next'))) {
    c.onStep('preparing')
    await step('install', ['install', '--no-audit', '--no-fund', '--prefer-offline'], INSTALL_TIMEOUT_MS, 'installFailed')
    installed = true
  }

  let recorded = null
  try { recorded = c.read(recordFile).trim() } catch { /* 기록 없음 */ }
  let built = false
  if (!builtOutput() || recorded !== label) {
    c.onStep('building')
    await step('build', ['run', 'build'], BUILD_TIMEOUT_MS, 'buildFailed')
    if (kind.outDir && !builtOutput()) throw fail('outputMissing', 'build', '', c, dir)
    c.write(recordFile, label)
    built = true
  }
  return { installed, built }
}

/** 서버를 켠다. 정적 내보내기는 out 폴더 정적 서버, 서버형은 next start. 켜지지 않으면 reason(serverFailed·exportNeedsStatic)과 가려진 끝줄을 달아 던진다. */
export async function serveSite(dir, env, { kind = {}, start = startServer, startStatic = startStaticServer, waitMs, home, env: scrubEnv } = {}) {
  try {
    const s = kind.outDir
      ? await startStatic(join(dir, kind.outDir))
      : await start(dir, env, '/', { tail: true, ...(waitMs === undefined ? {} : { waitMs }) })
    return { port: s.port, pid: s.pid, stop: s.stop }
  } catch (e) {
    const raw = String(e?.tail ?? '')
    const reason = EXPORT_REFUSAL.test(raw) ? 'exportNeedsStatic' : 'serverFailed'
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), {
      reason: typeof e?.reason === 'string' ? e.reason : reason,
      step: 'serve',
      tail: scrubTail(raw, { dir, home, env: { ...process.env, ...scrubEnv, ...env } }),
    })
  }
}
