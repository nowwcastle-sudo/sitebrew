// 관문 Chrome 조건(Task 10f 리뷰 M2) — headless Chrome 을 실제로 띄운다(서버 없음).
// 1440×900 뷰포트에 세로로 넘치는 전면 빨강 페이지를 GATE_CHROME_FLAGS 로 열면 배치 폭이 1440 이고 유채 픽셀 비율이 1(= 100%)이다.
// 음성 대조: 플래그 없이 열면 스크롤바(무채 띠)가 생겨 폭 1440 미만 · 비율 < 1 — 리뷰가 잰 0.9903 과 같은 치우침이다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startChrome, connect, navigateAndWait } from '../../qa/cdp.mjs'
import { CHROMA_SHARE } from './gates.mjs'
import { GATE_CHROME_FLAGS } from './jobs.mjs'

const PAGE = 'data:text/html,' + encodeURIComponent('<!doctype html><html><body style="margin:0;background:#ff0000"><div style="height:1200px"></div></body></html>')

async function measure(flags) {
  const chrome = await startChrome(flags, { prefix: 'gate-flags-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await navigateAndWait(send, ev, PAGE, { timeoutMs: 20000 })
    const width = await ev('document.documentElement.clientWidth')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const share = await ev(CHROMA_SHARE(shot.result.data))
    ws.close()
    return { width, share }
  } finally {
    await chrome.close()
  }
}

test('gate Chrome flags: hide scrollbars and pin sRGB — a full chromatic page lays out at 1440 and measures 100%', async () => {
  assert.deepEqual(GATE_CHROME_FLAGS, ['--hide-scrollbars', '--force-color-profile=srgb'])
  const on = await measure(GATE_CHROME_FLAGS)
  assert.equal(on.width, 1440)
  assert.equal(on.share, 1)
  const off = await measure([])
  assert.ok(off.width < 1440, `플래그 없이 배치 폭 ${off.width}`)
  assert.ok(off.share < 1, `플래그 없이 비율 ${off.share}`)
})
