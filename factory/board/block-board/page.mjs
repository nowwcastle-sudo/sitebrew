// 블록 행렬 도구가 같이 쓰는 브라우저 조각 — Chrome 하나·CDP 세션 하나를 행마다 나눠 쓰고(순차), 화면 조건(폭·테마·동작 줄이기·포인터)을 정하고,
// 갤러리 블록이 그려지고 등장이 끝날 때까지 기다린다. 도구 실패(탐색·CDP 기한)는 던지고, 블록이 못 그려진 것은 던지지 않고 결과로 돌려준다(행 실패).
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { ENTERED_WAIT } from '../../qa/hit-area.mjs'
import { GATE_CHROME_FLAGS } from './jobs.mjs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const HEIGHT = { 1440: 900, 375: 812 }

// 콘솔 오류 모으기: 페이지 예외 · console.error · 오류 수준 로그(404 같은 자원 오류). favicon 은 뺀다. takeErrors() 가 쌓인 것을 꺼내며 비운다.
export async function openSession() {
  const chrome = await startChrome(GATE_CHROME_FLAGS, { prefix: 'block-board-' })
  const errors = []
  const onEvent = (d) => {
    if (d.method === 'Runtime.exceptionThrown') errors.push(String(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0].slice(0, 200))
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
    else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url ?? '')) errors.push(`${d.params.entry.text} ${d.params.entry.url ?? ''}`.slice(0, 200))
  }
  const { ws, send, ev } = await connect(chrome.wsUrl, { onEvent })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  return { send, ev, takeErrors: () => errors.splice(0), close: async () => { try { ws.close() } catch {} await chrome.close() } }
}

// 화면 조건. pointer: 'fine' | 'coarse'(터치 — (pointer: coarse)·(hover: none) 과 터치 지점). motion: 'no-preference' | 'reduce'.
export async function setView({ send }, { width, height = HEIGHT[width] ?? 900, theme = 'light', motion = 'no-preference', pointer = 'fine' }) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const features = [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: motion }]
  features.push(...(pointer === 'coarse'
    ? [{ name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }, { name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }]
    : [{ name: 'pointer', value: 'fine' }, { name: 'any-pointer', value: 'fine' }, { name: 'hover', value: 'hover' }, { name: 'any-hover', value: 'hover' }]))
  await send('Emulation.setEmulatedMedia', { features })
  await send('Emulation.setTouchEmulationEnabled', pointer === 'coarse' ? { enabled: true, maxTouchPoints: 5 } : { enabled: false })
}

// 블록이 그려졌는가(갤러리는 그려지면 [data-qa-ready], 못 그리면 [role=alert] 를 단다). 15초 안에 어느 쪽도 없으면 도구 실패로 던진다.
const READY = `(() => { const q = document.querySelector('[data-qa-block]'); if (!q) return 'wait'; if (q.hasAttribute('data-qa-ready')) return 'ready'; const a = q.querySelector('[role=alert]'); return a ? 'error:' + a.textContent.trim().slice(0, 200) : 'wait' })()`

/**
 * 한 주소를 연다. → { ready, error, entered, ms }
 *   entered: 'entered'(등장 끝 신호) | 'no-scene'(모션 장면 없음) | 'stuck'(10초 안에 신호 없음) | 'skipped'
 * waitEntered false 면 등장은 기다리지 않는다(동작 줄이기 행).
 */
export async function openBlock(session, url, view, { waitEntered = true } = {}) {
  const { send, ev } = session
  const t0 = Date.now()
  await setView(session, view)
  const nav = await navigateAndWait(send, ev, url, { timeoutMs: 30000 })
  if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  let state = 'wait'
  for (let i = 0; i < 300 && state === 'wait'; i++) {
    state = await ev(READY)
    if (state === 'wait') await sleep(50)
  }
  if (state === 'wait') throw new Error(`15초 안에 블록도 오류 알림도 그려지지 않았다: ${url}`)
  await ev('document.fonts.ready.then(() => 1)')
  if (state !== 'ready') return { ready: false, error: state.slice(6), entered: 'skipped', ms: Date.now() - t0 }
  await sleep(150)
  const entered = waitEntered ? await ev(ENTERED_WAIT) : 'skipped'
  await sleep(250)
  return { ready: true, error: null, entered, ms: Date.now() - t0 }
}

// 문서 전체 높이(스크롤 높이). 100vh 계열 레이아웃이 뷰포트를 키우면 같이 커지므로 안정될 때까지 두 번 본다.
export async function fullHeight(session, width, { max = 14000 } = {}) {
  const { send, ev } = session
  let h = await ev('document.documentElement.scrollHeight')
  for (let i = 0; i < 3; i++) {
    const next = Math.min(max, Math.ceil(h))
    await send('Emulation.setDeviceMetricsOverride', { width, height: next, deviceScaleFactor: 1, mobile: false })
    await sleep(120)
    const again = await ev('document.documentElement.scrollHeight')
    if (Math.abs(again - h) < 2) return { height: Math.min(max, Math.ceil(again)), capped: again > max }
    h = again
  }
  return { height: Math.min(max, Math.ceil(h)), capped: h > max, unstable: true }
}
