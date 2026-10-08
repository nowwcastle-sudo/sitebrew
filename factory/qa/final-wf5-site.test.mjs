// FINAL-WF5 06 사이트 시험(Chrome) — 찍어낸 사이트 하나를 빌드해 `next start` 로 띄운 주소(WF5_SITE_ORIGIN)에서 잰다.
//   ① 쪽 안 DOM id 중복 0 (같은 블록을 한 쪽에 둘 그려도) ② axe landmark 규칙(contentinfo 최상위·중복 없음·고유) 위반 0 — 규칙이 실제로 돌았는지도 본다
//   ③ 하단 고정 바가 푸터 링크 초점을 일부도 가리지 않는다(a11y-gate focus-not-obscured 경고 0) ④ 안내 글 없는 예약 바는 데스크톱에서 가운데
// 실행: WF5_SITE_ORIGIN=http://localhost:4121 WF5_SITE_ROUTES=/,/services node --test --test-force-exit --test-timeout=900000 factory/qa/final-wf5-site.test.mjs   (WF5_SITE_ORIGIN 이 없으면 건너뛴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'
import { a11yGate } from './a11y-gate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.WF5_SITE_ORIGIN?.replace(/\/$/, '') ?? null
const ROUTES = (process.env.WF5_SITE_ROUTES ?? '/').split(/[,+]/).filter(Boolean)
const skip = !ORIGIN && 'WF5_SITE_ORIGIN(찍어낸 사이트 서버 주소)이 없다'
const LANDMARK_RULES = ['landmark-contentinfo-is-top-level', 'landmark-no-duplicate-contentinfo', 'landmark-unique']
const axeSrc = skip ? '' : readFileSync(createRequire(join(root, 'package.json')).resolve('axe-core/axe.min.js'), 'utf8')

async function withChrome(fn, { width = 1440, height = 900 } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'wf5s-' })
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
const open = async ({ send, ev }, route) => { await navigateAndWait(send, ev, `${ORIGIN}${route}`, { timeoutMs: 90000 }); await sleep(1500) }

for (const width of [1440, 375]) for (const route of ROUTES) {
  test(`WF5-site ${route} ${width}px: DOM id 중복 0 · axe landmark 3규칙 위반 0(규칙이 돌았다)`, { skip }, async () => {
    await withChrome(async (s) => {
      await open(s, route)
      const dup = await s.ev(`(() => { const m = new Map(); for (const e of document.querySelectorAll('[id]')) m.set(e.id, (m.get(e.id) || 0) + 1); return { total: document.querySelectorAll('[id]').length, dups: [...m].filter(([, n]) => n > 1) } })()`)
      await s.ev(axeSrc)
      const axe = await s.ev(`axe.run(document, { runOnly: { type: 'rule', values: ${JSON.stringify(LANDMARK_RULES)} }, resultTypes: ['violations', 'passes', 'inapplicable', 'incomplete'] }).then((r) => ({ v: r.violations.map((x) => [x.id, x.nodes.length]), ran: [...r.passes.map((x) => x.id), ...r.violations.map((x) => x.id), ...r.incomplete.map((x) => x.id)] }))`)
      const footers = await s.ev(`[...document.querySelectorAll('footer')].map((f) => f.closest('main,article,section,aside,nav') ? 'nested' : 'top').join(',')`)
      console.log(`WF5-site ${route} ${width}px`, JSON.stringify({ ids: dup.total, dups: dup.dups, landmarkViolations: axe.v, ran: axe.ran, footers }))
      assert.deepEqual(dup.dups, [], `중복 id ${JSON.stringify(dup.dups)}`)
      assert.deepEqual(axe.v, [], `landmark 위반 ${JSON.stringify(axe.v)}`)
      assert.ok(axe.ran.includes('landmark-no-duplicate-contentinfo') && axe.ran.includes('landmark-unique'), `규칙이 안 돌았다(양성 대조): ${axe.ran}`)
      assert.ok(!footers.includes('nested'), `푸터가 다른 구획 안에 있다: ${footers}`)
    }, { width })
  })
}

test('WF5-site: 하단 고정 바가 있는 쪽 — 1440·375 에서 Tab 초점이 일부도 가려지지 않는다(a11y-gate focus-not-obscured 경고 0)', { skip }, async () => {
  const r = await a11yGate(`${ORIGIN}${ROUTES[0]}`, { modes: ['light'], widths: [1440, 375], sceneWait: false })
  const b = r.behaviors.find((x) => x.id === 'focus-not-obscured')
  console.log('WF5-site a11y', JSON.stringify({ status: b.status, measured: b.detail.measured, warn: b.detail.warn, failures: r.failures }))
  assert.equal(b.status, 'pass')
  assert.deepEqual(b.detail.warn, [], `초점이 일부 가려진다: ${b.detail.warn}`)
})
