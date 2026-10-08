// 헤드리스 Chrome 띄우기 — behavior.mjs · ux-gate.mjs · hit-area.mjs 가 같이 쓴다.
// 예전 방식(무작위 고정 포트 + /json/list 12초 폴링 + targets.find(...) 바로 사용)은 두 가지로 가끔 깨졌다:
//  1) 무작위 포트가 방금 끝난 다른 Chrome 과 겹치면 옛 프로세스에 붙거나 바인드에 실패한다.
//  2) /json/list 가 page 대상이 생기기 전에 빈 목록으로 답하면 undefined.webSocketDebuggerUrl 로 죽는다(부하가 크면 12초도 모자란다).
// 여기서는 포트를 OS 가 고르게 하고(--remote-debugging-port=0 → 프로필의 DevToolsActivePort 파일), page 대상이 실제로 생길 때까지 기한 안에서 기다린다.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractSessionArg, parseScene, applyScene } from './session-scene.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 실패 경로 안전망(FINAL-WF3 항목 16): 도구가 close() 를 부르기 전에 process.exit 로 끝나도(워치독이 닫기를 5초만 기다리고 나가는 길·던진 예외·기한 초과)
// 띄운 Chrome 트리와 임시 프로필이 남지 않게, 아직 안 닫힌 것을 'exit' 처리기가 동기로 거둔다(taskkill /T /F → 프로필 삭제). close() 가 끝낸 것은 목록에서 빠진다.
const live = new Set()
function reapSync(entry) {
  if (entry.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(entry.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    else { try { process.kill(entry.pid, 'SIGKILL') } catch {} }
  }
  for (let i = 0; i < 5; i++) {
    try { rmSync(entry.profile, { recursive: true, force: true }) } catch {}
    if (!existsSync(entry.profile)) break
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},250)'], { stdio: 'ignore' }) // 동기 대기 — 방금 끝난 Chrome 이 프로필 파일을 놓을 때까지
  }
}
process.on('exit', () => { for (const e of live) reapSync(e) })
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

// 기한 기본값(문서 읽기 15초·CDP 호출 45초)은 그대로다. 기계가 바빠 출시 관문을 돌릴 때만 환경 변수로 늘린다(REL9, 대장 G16 — 부하 중 주소 검사가 15초 기한에서 도구 실패로 끝났다).
// 판정 기준·문턱은 건드리지 않는다: 늘리면 「측정 못 함」이 줄 뿐 통과·실패 판정은 같다.
const envMs = (name, fallback) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : fallback }
export const NAV_TIMEOUT_MS = envMs('WF_NAV_TIMEOUT_MS', 15000)

// 세션 장면(UXGATE1 · G1): 이 모듈을 읽는 모든 관문이 `--session <장면>`(또는 WF_SESSION)을 받는다. 관문마다 위치 인자를 세는 방식이 달라서
// 모듈을 읽을 때 argv 에서 떼어 낸다(import 는 관문 본문보다 먼저 돌므로 본문은 flag 없는 argv 를 본다). 자식 프로세스(run.mjs·gates.mjs 가 띄우는 도구)는
// WF_SESSION 으로 물려받는다. 인자가 없으면 SESSION_SCENE 은 null 이고 아래 어느 길도 달라지지 않는다. 모르는 장면은 인자 오류(종료 2).
export const SESSION_SCENE = (() => {
  try {
    const raw = extractSessionArg(process.argv, process.env)
    if (raw === null) return null
    parseScene(raw)
    process.env.WF_SESSION = raw
    return raw
  } catch (e) {
    console.error(`인자 오류: ${e.message}`)
    process.exit(2)
  }
})()

// 직접 Page.navigate 를 부르는 도구용(ssr-flash): 장면이 있으면 쿠키를 심고 갤러리 쿼리를 덧붙인 주소를, 없으면 CDP 호출 없이 같은 주소를 돌려준다.
export async function sceneUrl(send, url, scene = SESSION_SCENE) {
  return scene ? applyScene(send, url, scene) : url
}

export function chromePath() {
  const found = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync)
  if (!found) throw new Error('Chrome/Edge not found (set CHROME_PATH)')
  return found
}

// 새 프로필에 쓰는 것을 줄인다(T9-c1): 디스크 캐시·확장·구성요소 갱신·백그라운드 통신을 끈다. C: 에 입출력이 몰리면
// (npm 설치 등) 프로필 쓰기가 막혀 CDP 응답이 수십 초 늦어졌다 — 측정에는 영향이 없는 설정만 넣는다.
export const QUIET_FLAGS = ['--disk-cache-size=1', '--media-cache-size=1', '--disable-extensions', '--disable-component-update', '--disable-background-networking', '--disable-sync', '--disable-default-apps', '--disable-breakpad', '--no-pings', '--metrics-recording-only']

// 반환: { proc, port, wsUrl, close() }. 기한(기본 30초) 안에 page 대상이 없으면 이유를 담아 던진다.
// headless: false 는 창이 있는 Chrome — 운영체제 클립보드처럼 화면 없는 Chrome 이 연결하지 않는 것을 잴 때만(clipboard-check.mjs). 기본은 그대로 --headless=new.
export async function startChrome(extraArgs = [], { timeoutMs = 30000, prefix = 'cdp-', headless = true } = {}) {
  const profile = mkdtempSync(join(tmpdir(), prefix))
  const proc = spawn(chromePath(), [...(headless ? ['--headless=new'] : []), '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...QUIET_FLAGS, ...extraArgs, 'about:blank'], { stdio: 'ignore' })
  let exited = null
  const entry = { pid: proc.pid, profile }
  live.add(entry)
  proc.on('exit', (code) => { exited = code })
  // Windows 에서는 Chrome 뿌리만 죽이면 렌더러·GPU·유틸리티 자식이 고아로 남는다(대장 G18 — 관문 한 번에 7~10개씩, 시험 기한에 죽으면 수십 개).
  // 그래서 close() 가 taskkill /T 로 트리째 끝낸다. 그 밖의 운영체제는 뿌리 종료(자식은 Chrome 이 스스로 거둔다).
  const close = async () => {
    if (exited === null) {
      if (process.platform === 'win32' && proc.pid) {
        await new Promise((res) => {
          const k = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
          k.on('exit', res)
          k.on('error', res)
        })
      } else proc.kill()
      // 끝났는지는 exit 이벤트가 아니라 프로세스 번호로 본다 — taskkill 로 끝낸 Chrome 은 이벤트가 2초 넘게 안 올 때가 있었다(실측).
      for (let i = 0; i < 20 && exited === null && pidAlive(proc.pid); i++) await sleep(100)
    }
    // 임시 프로필 폴더를 지운다. Windows 에서는 방금 끝낸 Chrome 의 프로필이 이 프로세스가 끝나기 전까지 EPERM 으로 안 지워질 때가 있다(실측 — 부모가 끝나면 지워진다, 원인 미확정).
    // 그래서 오래 붙잡지 않고 두 번만 더 시도한다.
    for (let i = 0; i < 3; i++) {
      try { rmSync(profile, { recursive: true, force: true }) } catch {}
      if (!existsSync(profile)) break
      await sleep(150)
    }
    if (!existsSync(profile)) live.delete(entry) // 프로필까지 지웠으면 거둘 것이 없다 — 남았으면 exit 처리기가 한 번 더 시도한다
  }
  const deadline = Date.now() + timeoutMs
  try {
    let port = null
    while (!port) {
      if (exited !== null) throw new Error(`chrome exited (${exited}) before opening DevTools`)
      if (Date.now() > deadline) throw new Error(`no DevToolsActivePort after ${timeoutMs}ms`)
      try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || null } catch {}
      if (!port) await sleep(100)
    }
    let page = null
    while (!page) {
      if (Date.now() > deadline) throw new Error(`no page target on port ${port} after ${timeoutMs}ms`)
      // 요청마다 2초 기한 — 연결은 받고 답을 안 주면 fetch 가 끝없이 기다려 위 기한 검사까지 돌아오지 못한다.
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })).json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl) ?? null } catch {}
      if (!page) await sleep(100)
    }
    return { proc, port, wsUrl: page.webSocketDebuggerUrl, close }
  } catch (e) {
    await close()
    throw e
  }
}

// 옛 이름 — close() 가 트리째 끝내므로 부르는 쪽(lang-mix·signed-out-access·agent-boundary·session-probe)은 그대로 둔다.
export async function closeChrome(chrome) {
  await chrome.close()
}

// 새 문서가 다 읽힐 때까지 기다린다(T9-c1). Page.navigate 가 답한 직후에는 아직 옛 문서(about:blank 나 같은 주소의 이전 문서)일 수 있다.
// 그 옛 문서의 readyState 는 이미 complete 라, 그것만 보면 빈 화면을 잰다(부하가 크면 /qa/recipes 에서 실제로 났다).
// 그래서 옛 문서에 표지를 달고, 표지가 없는 문서가 complete 가 될 때까지 기한 안에서 기다린다.
// ev(expression) 는 값을 돌려주는 Runtime.evaluate 감싸개. 돌려주는 값은 Page.navigate 응답.
// 기한은 탐색 전에 잡는다. send 가 session() 의 것이면 Page.navigate 호출 자체도 호출 기한에 걸린다(리뷰 I2).
// scene: 이 탐색에만 쓸 세션 장면(예: G13 은 'signed-out' 을 못 박는다). 없으면 --session 이 정한 SESSION_SCENE, 둘 다 없으면 아무것도 안 한다.
export async function navigateAndWait(send, ev, url, { timeoutMs = NAV_TIMEOUT_MS, scene = SESSION_SCENE } = {}) {
  const deadline = Date.now() + timeoutMs
  if (scene) url = await applyScene(send, url, scene)
  try { await ev('window.__wfOldDoc = 1') } catch {}
  const nav = await send('Page.navigate', { url })
  if (nav?.result?.errorText) return nav
  for (;;) {
    let state = null
    try { state = await ev('window.__wfOldDoc === 1 ? "old" : document.readyState') } catch {}
    if (state === 'complete') return nav
    if (Date.now() > deadline) throw new Error(`${timeoutMs}ms 안에 새 문서를 다 읽지 못했다: ${url}`)
    await sleep(100)
  }
}

// CDP 세션(리뷰 I2): 호출마다 기한이 있는 send·ev. 기한을 넘기면 어느 호출이 막혔는지 적어 던진다 — 도구는 종료 1로 끝난다.
// 응답(id 있는 메시지)이 아닌 것은 onEvent 로 넘긴다. ev 는 페이지 예외면 undefined(값이 아니다), throwOnException 이면 던진다.
export const CDP_TIMEOUT_MS = envMs('WF_CDP_TIMEOUT_MS', 45000)
export function session(ws, { timeoutMs = CDP_TIMEOUT_MS, onEvent, throwOnException = false } = {}) {
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } else onEvent?.(d)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id
    const t = setTimeout(() => { pending.delete(i); reject(new Error(`CDP ${method} 가 ${timeoutMs / 1000}초 안에 답하지 않았다`)) }, timeoutMs)
    pending.set(i, (d) => { clearTimeout(t); resolve(d) })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) {
      if (throwOnException) throw new Error(`페이지 측정 실패: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`)
      return undefined
    }
    return r.result?.result?.value
  }
  return { send, ev }
}

// startChrome 의 wsUrl 에 붙어 session 을 돌려준다.
export async function connect(wsUrl, opts) {
  const ws = new WebSocket(wsUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  return { ws, ...session(ws, opts) }
}

// 새 문서가 진짜 열렸는지(C123): Chrome 오류 페이지(연결 거부·DNS)와 HTTP 4xx/5xx 는 「본문 대비 실패」 같은 판정으로 읽히면 안 된다 — 도구 실패로 던진다.
// nav 는 navigateAndWait 의 반환. ev 는 페이지 예외면 undefined 를 돌려도 된다(그러면 상태를 못 읽은 것으로 넘어간다).
export async function assertOpened(nav, ev, url) {
  if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  const info = await ev(`({ proto: location.protocol, status: performance.getEntriesByType('navigation')[0]?.responseStatus ?? 0 })`)
  if (info?.proto === 'chrome-error:') throw new Error(`열리지 않는 쪽(Chrome 오류 페이지): ${url}`)
  if (info?.status >= 400) throw new Error(`HTTP ${info.status}: ${url}`)
}

// 도구 전체 기한(UXGATE1): 기한 안에 안 끝나면 멈춘 단계를 적고 Chrome 트리를 닫은 뒤 종료 1(도구 실패)로 나간다. connect() 의 WebSocket 열림처럼 기한이 없는 대기가
// 있어도 도구가 끝없이 멈추지 않는다(부하가 큰 기계에서 시험이 5분씩 걸린 일). 새 도구(lang-mix·signed-out-access)가 쓴다. state = { chrome, stage } 를 도구가 갱신한다.
// 돌려주는 값은 기한을 끄는 함수. 환경 변수 WF_TOOL_TIMEOUT_MS 가 기본 기한을 바꾼다.
export function startWatchdog(label, defaultMs, state) {
  const ms = envMs('WF_TOOL_TIMEOUT_MS', defaultMs)
  const t = setTimeout(async () => {
    console.error(`도구 실패: ${label} 가 ${ms / 1000}초 안에 끝나지 않았다 (멈춘 단계: ${state.stage})`)
    try { if (state.chrome) await Promise.race([closeChrome(state.chrome), sleep(5000)]) } catch {}
    process.exit(1)
  }, ms)
  t.unref()
  return () => clearTimeout(t)
}
