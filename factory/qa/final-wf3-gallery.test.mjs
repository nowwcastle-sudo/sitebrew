// FINAL-WF3 갤러리 시험(Chrome) — 블록·셸 화면 배치·접근성 결함. 갤러리 서버(next dev·next start)가 있어야 돈다.
// 실행: WF3_ORIGIN=http://localhost:4110 node --test --test-force-exit --test-timeout=600000 factory/qa/final-wf3-gallery.test.mjs   (WF3_ORIGIN 이 없으면 건너뛴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.WF3_ORIGIN?.replace(/\/$/, '') ?? null
const skip = !ORIGIN && 'WF3_ORIGIN(갤러리 서버 주소)이 없다'

async function withChrome(fn, { width = 1440, height = 900 } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'wf3g-' })
  try {
    const { ws, send, ev } = await connect(chrome.wsUrl)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try { return await fn({ send, ev }) } finally { ws.close() }
  } finally {
    await closeChrome(chrome)
  }
}
const gallery = (b, extra = '', r = 'r1-measure') => `${ORIGIN}/qa/blocks?b=${b}&r=${r}${extra}&frame=1`
async function openGalleryBlock({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
}

// 항목 1: 가로 행에 승인 안내 글이 들어가 입력칸이 찌그러지지 않는다 — 입력칸 폭 ≥ 240px
for (const width of [1440, 768, 375]) {
  test(`WF3-1: lead-capture/inline-newsletter ${width}px — 이메일 입력칸 폭 ≥ 240px, 라벨이 한 글자씩 쌓이지 않는다`, { skip }, async () => {
    await withChrome(async (s) => {
      await openGalleryBlock(s, gallery('block-lead-capture-inline-newsletter'))
      const m = await s.ev(`(() => {
        const root = document.querySelector('[data-block="lead-capture-inline-newsletter"]')
        const i = root.querySelector('input[type=email]'), l = root.querySelector('label[for="' + i.id + '"]')
        const lr = l.getBoundingClientRect()
        return { input: Math.round(i.getBoundingClientRect().width), labelH: Math.round(lr.height), labelW: Math.round(lr.width), docSW: document.documentElement.scrollWidth, vw: innerWidth }
      })()`)
      assert.ok(m.input >= 240, `입력칸 폭 ${m.input}px < 240 ${JSON.stringify(m)}`)
      assert.ok(m.labelH < 60, `라벨이 세로로 쌓였다 ${JSON.stringify(m)}`)
      assert.equal(m.docSW, m.vw, `가로로 넘친다 ${JSON.stringify(m)}`)
    }, { width })
  })
}
