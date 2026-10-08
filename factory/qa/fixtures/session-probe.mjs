// session-scene.test.mjs 가 자식 프로세스로 돌리는 탐침: cdp.mjs 를 읽은 뒤의 argv·장면을 찍고, 주소마다 열어 서버가 본 것은 시험이 본다.
// 사용: node session-probe.mjs [--session <장면>] <url>… — 환경 변수 PROBE_SCENES(JSON 배열)가 있으면 i 번째 탐색에 그 장면을 명시한다(null 이면 기본).
import { startChrome, closeChrome, connect, navigateAndWait, startWatchdog, SESSION_SCENE } from '../cdp.mjs'

const urls = process.argv.slice(2)
const scenes = JSON.parse(process.env.PROBE_SCENES ?? '[]')
const state = { chrome: null, stage: 'Chrome 시작' }
const stopDog = startWatchdog('session-probe', 120000, state)
const chrome = await startChrome([], { prefix: 'session-probe-' })
state.chrome = chrome
try {
  const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
  const pages = []
  for (const [i, url] of urls.entries()) {
    await navigateAndWait(send, ev, url, scenes[i] ? { scene: scenes[i] } : {})
    pages.push({ href: await ev('location.href'), text: await ev('document.body.innerText') })
  }
  ws.close()
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), scene: SESSION_SCENE, env: process.env.WF_SESSION ?? null, pages }) + '\n')
} finally { stopDog(); await closeChrome(chrome) }
setTimeout(() => process.exit(0), 300).unref() // 남은 핸들이 프로세스를 붙잡지 않게(lang-mix 와 같다)
