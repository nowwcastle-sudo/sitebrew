// 가짜 터널 도구(계획 4 Task 7 시험 재료) — 진짜 cloudflared 대신 `node fake-tunnel.mjs <모드>` 로 돌려 출력만 흉내 낸다. 네트워크를 쓰지 않는다.
//   url          cloudflared 출력 모양(로그의 api 주소 + 상자 그림 안 주소)을 찍고 살아 있는다
//   url-split    주소를 두 번에 나눠 찍는다
//   none         주소 없이 로그만 찍고 살아 있는다
//   api-only     api.trycloudflare.com 만 찍고 살아 있는다
//   exit         한 줄 찍고 종료 코드 3 으로 끝난다
//   url-exit     주소를 찍고 바로 끝난다
//   env          VERCEL_TOKEN 값을 찍고 종료 코드 1 로 끝난다
//   home         홈 폴더 경로를 찍고 종료 코드 1 로 끝난다
//   grandchild   손자 프로세스를 띄워 PID 를 찍고(grandchild=<pid>), 주소도 찍고 살아 있는다
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

const URL_LINE = 'https://fake-abc-123.trycloudflare.com'
const mode = process.argv[2] ?? 'url'
const say = (s) => process.stdout.write(`${s}\n`)
const alive = () => setInterval(() => {}, 1000)

if (mode === 'url') {
  say('2026-10-22T00:00:00Z INF Thank you for trying Cloudflare Tunnel.')
  say('2026-10-22T00:00:00Z INF Requesting new quick Tunnel on https://api.trycloudflare.com...')
  say('2026-10-22T00:00:01Z INF +--------------------------------------------------------------------------------------------+')
  say('2026-10-22T00:00:01Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |')
  say(`2026-10-22T00:00:01Z INF |  ${URL_LINE}                              |`)
  say('2026-10-22T00:00:01Z INF +--------------------------------------------------------------------------------------------+')
  alive()
} else if (mode === 'url-split') {
  process.stdout.write('visit https://fake-abc-')
  setTimeout(() => { say('123.trycloudflare.com now'); alive() }, 150)
} else if (mode === 'none') {
  say('INF starting up')
  say('INF still starting')
  alive()
} else if (mode === 'api-only') {
  say('INF Requesting new quick Tunnel on https://api.trycloudflare.com/tunnel')
  alive()
} else if (mode === 'exit') {
  say('boom: cannot start')
  process.exit(3)
} else if (mode === 'url-exit') {
  say(URL_LINE)
  process.exit(0)
} else if (mode === 'env') {
  say(`token=${process.env.VERCEL_TOKEN ?? 'none'}`)
  process.exit(1)
} else if (mode === 'home') {
  say(`failed in ${homedir()}/.cloudflared/cert.pem`)
  process.exit(1)
} else if (mode === 'grandchild') {
  const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  say(`grandchild=${g.pid}`)
  say(URL_LINE)
  alive()
} else {
  say(`unknown mode ${mode}`)
  process.exit(2)
}
