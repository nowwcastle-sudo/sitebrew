// 띄운 프로세스를 다루는 작은 도구 모음(sitebrew v0.2.0 계획 3 Task 10) — 완성 확인(check-loop.mjs)과 무거운 시험(deliver-product.test.mjs)이 같이 쓴다.
// 규칙은 하나다: 띄운 것은 띄운 쪽이 PID 나무째 끈다. 시간 제한이 넘어도, 정상 종료 뒤에도 남은 자손을 정리한다.
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'

const WIN = process.platform === 'win32'

/** PID 나무째 끈다. 이미 끝났으면 아무 일도 없다. */
export function killTree(pid) {
  if (pid === undefined) return
  if (WIN) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  else { try { process.kill(-pid, 'SIGKILL') } catch { /* 이미 끝났다 */ } }
}

/** 명령을 끝까지 돌려 { code, tail, timedOut } — 출력 끝 40줄만 남긴다. timeoutMs 가 넘으면 나무째 끄고 timedOut 이 true 다(code 는 셸에 따라 null 이나 1). */
export function run(cmd, args, { cwd, env, timeoutMs }) {
  return new Promise((done) => {
    // Windows 의 npm.cmd 는 셸이 필요하다 — 인자를 따로 주면 Node 가 경고하므로 한 줄로 붙인다(인자는 모두 이 코드가 정한 값)
    const child = WIN && cmd.endsWith('.cmd')
      ? spawn(`${cmd} ${args.join(' ')}`, { cwd, env, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn(cmd, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: !WIN })
    let tail = ''
    const keep = (b) => { tail = `${tail}${b}`.split('\n').slice(-40).join('\n') }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid) }, timeoutMs)
    child.on('error', (e) => { clearTimeout(timer); done({ code: 1, tail: String(e), timedOut }) })
    child.on('close', (code) => { clearTimeout(timer); killTree(child.pid); done({ code, tail, timedOut }) })
  })
}

export const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) }) })

/** url 이 500 아래로 답할 때까지 기다린다. deadline(ms 시각)을 넘으면 던진다. */
export async function waitFor(url, deadline, exited = () => null) {
  for (;;) {
    const gone = exited()
    if (gone !== null) throw new Error(`서버가 켜지다 종료 ${gone}: ${url}`)
    try { const r = await fetch(url, { redirect: 'manual' }); if (r.status < 500) return r } catch { /* 아직 안 켜졌다 */ }
    if (Date.now() > deadline) throw new Error(`서버가 ${url} 에 답하지 않았다`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

/** 제품 폴더의 next 로 서버를 켠다(next start). 끝나면 stop() 으로 PID 나무째 끈다. 켜지지 않으면 끄고 던진다. */
export async function startServer(dir, env, path = '/', { waitMs = 120_000, tail = false } = {}) {
  const port = await freePort()
  const nextBin = join(dir, 'node_modules', 'next', 'dist', 'bin', 'next')
  // tail: true 면 서버 출력 끝 40줄을 모아 두었다가 켜지지 않을 때 던지는 오류의 .tail 에 단다(기본은 출력을 버린다)
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: dir, env, stdio: tail ? ['ignore', 'pipe', 'pipe'] : 'ignore', windowsHide: true, detached: !WIN })
  let kept = ''
  if (tail) for (const stream of [child.stdout, child.stderr]) stream.on('data', (b) => { kept = `${kept}${b}`.split('\n').slice(-40).join('\n') })
  let gone = null
  child.on('exit', (code) => { gone = code ?? 'signal' })
  child.on('error', () => { gone = 'error' })
  const stop = () => killTree(child.pid)
  try { await waitFor(`http://127.0.0.1:${port}${path}`, Date.now() + waitMs, () => gone) } catch (e) {
    stop()
    if (tail) await new Promise((r) => setTimeout(r, 100)) // 끝난 자식의 남은 출력이 들어올 틈
    throw Object.assign(e, tail ? { tail: kept } : {})
  }
  return { port, pid: child.pid, stop }
}
