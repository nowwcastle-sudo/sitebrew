// REL11 (v0.0.11) 갤러리 블록 회귀 시험 — 고치기 전에는 실패해야 한다. 갤러리 서버(next dev·next start)가 있어야 돈다:
//   2) 업그레이드 대화상자(paywall/upgrade-modal) 320·375·390px — 줄바꿈 없는 긴 비교표의 최소 폭이 대화상자 격자 칸을 밀어 제목·본문·단추가 화면 밖으로 나갔다(launch-factory LFADB 발견).
//   3) 진짜 마우스로 보내기를 눌러도 제출·첫 오류 칸 포커스가 일어나야 한다 — 누르는 순간 칸 검사(blur)가 오류 문구를 그려 단추를 밀면 click 이 안 나갔다(LFADB 발견).
//   6) 행동 줄(고정)이 커져도 줄 바로 위 링크가 줄 밑에 가린 채 포커스를 받지 않는다 — 스크롤 여백이 줄의 실제 높이를 따라간다(LF template:screens 1440px a11y 실패).
// 실행: REL11_ORIGIN=http://localhost:4981 node --test --test-force-exit --test-timeout=400000 factory/qa/rel11-gallery.test.mjs   (REL11_ORIGIN 이 없으면 건너뛴다)
// 블록 이름은 `block-<kind>-<variant>`, 갤러리는 컴파일본을 그리므로 cn-* 훅 이름이 아니라 data-* 표지로 찾는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.REL11_ORIGIN?.replace(/\/$/, '') ?? null
const skip = !ORIGIN && 'REL11_ORIGIN(갤러리 서버 주소)이 없다'

async function withChrome(fn, { width = 1024, height = 800 } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'rel11g-' })
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
const gallery = (b, extra = '') => `${ORIGIN}/qa/blocks?b=${b}&r=r1-measure${extra}&frame=1`
async function openGalleryBlock({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
}
async function openUpgradeDialog(s, url) {
  await openGalleryBlock(s, url)
  await s.ev(`document.querySelector('[aria-haspopup="dialog"]').click()`)
  for (let i = 0; i < 100 && !(await s.ev(`!!document.querySelector('[data-slot="dialog-content"] [data-terms="links"]')`)); i++) await sleep(100)
  await sleep(700)
}

for (const width of [320, 375, 390]) {
  test(`REL11-2: 업그레이드 대화상자 ${width}px — 줄바꿈 없는 긴 비교표가 있어도 제목·본문·단추가 대화상자 안에 들고 가로로 넘치지 않는다(표는 자기 칸에서 민다)`, { skip }, async () => {
    await withChrome(async (s) => {
      await openUpgradeDialog(s, gallery('block-paywall-upgrade-modal', '&fx=max'))
      const m = await s.ev(`(() => {
        const d = document.querySelector('[data-slot="dialog-content"]'), dr = d.getBoundingClientRect()
        const out = []
        for (const c of d.querySelectorAll('[data-slot="dialog-title"], [data-slot="dialog-description"], [data-slot="table-container"], [data-pinned-bar], [data-pinned-bar] button, [data-pinned-bar] a')) {
          const r = c.getBoundingClientRect(); if (r.width === 0) continue
          if (r.right > dr.right + 1 || r.left < dr.left - 1) out.push({ el: c.getAttribute('data-slot') || c.tagName, left: Math.round(r.left), right: Math.round(r.right) })
        }
        const box = d.querySelector('[data-slot="table-container"]'), hint = document.querySelector('[data-scroll-hint]')
        return { vw: innerWidth, docSW: document.documentElement.scrollWidth, dialog: [Math.round(dr.left), Math.round(dr.right)], overflowing: out, tableScrolls: box.scrollWidth > box.clientWidth, hintShown: !!hint && getComputedStyle(hint).display !== 'none', dialogScrollsX: d.scrollWidth > d.clientWidth }
      })()`)
      assert.equal(m.docSW, m.vw, `문서가 가로로 넘친다: ${JSON.stringify(m)}`)
      assert.deepEqual(m.overflowing, [], `대화상자(${m.dialog})를 벗어난 요소: ${JSON.stringify(m)}`)
      assert.equal(m.dialogScrollsX, false, `대화상자가 가로로 스크롤된다: ${JSON.stringify(m)}`)
      assert.equal(m.tableScrolls, true, `시험 자료가 표를 넘치게 하지 못했다(긴 줄이 빠졌나): ${JSON.stringify(m)}`)
      assert.equal(m.hintShown, true, '표가 넘칠 때 「옆으로 밀어 보세요」 안내가 보인다')
    }, { width, height: 812 })
  })
}

test('REL11-2: L3 대등한 두 선택지 — 대화상자 두 단추의 크기가 같다(운영자 결정 유지)', { skip }, async () => {
  await withChrome(async (s) => {
    await openUpgradeDialog(s, gallery('block-paywall-upgrade-modal'))
    const w = await s.ev(`[...document.querySelector('[data-pinned-terms]').parentElement.querySelectorAll('button')].filter((b) => b.offsetWidth > 0).map((b) => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])`)
    assert.ok(w.length >= 2, `단추가 둘 이상: ${JSON.stringify(w)}`)
    assert.deepEqual(w[0], w[1], `두 단추 크기가 같다: ${JSON.stringify(w)}`)
  }, { width: 390, height: 812 })
})

for (const block of ['block-auth-new-password', 'block-auth-sign-up-consents', 'block-auth-sign-in']) {
  test(`REL11-3: ${block} — 첫 칸에 값을 넣고 진짜 마우스(CDP Input.dispatchMouseEvent)로 보내기를 누르면 제출되고 포커스가 첫 오류 칸으로 간다(JS click 과 같다)`, { skip }, async () => {
    for (const mode of ['mouse', 'js']) {
      await withChrome(async (s) => {
        await openGalleryBlock(s, gallery(block))
        const BTN = `document.querySelector('[data-qa-block] form button[type=submit]')`
        await s.ev(`window.__sub = 0; document.querySelector('[data-qa-block] form').addEventListener('submit', () => { window.__sub++ }, true)`)
        const pos = await s.ev(`(() => { const f = document.querySelector('[data-qa-block] form'); const inp = f.querySelector('input:not([type=hidden]):not([type=checkbox])'); const btn = ${BTN}; btn.scrollIntoView({ block: 'center' }); const r = btn.getBoundingClientRect(); inp.focus(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
        await s.send('Input.insertText', { text: 'a' }) // 값이 있는 칸은 떠날 때 검사한다 — 오류 문구가 그려져 단추를 아래로 민다
        await sleep(200)
        if (mode === 'mouse') {
          for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
            await s.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 })
            if (type === 'mousePressed') await sleep(150) // 누른 동안 칸 검사(blur)가 오류 문구를 그린다
          }
        } else await s.ev(`${BTN}.click()`)
        await sleep(900)
        const after = await s.ev(`(() => { const a = document.activeElement; return { tag: a.tagName, invalid: a.getAttribute('aria-invalid'), name: a.getAttribute('name'), firstInvalid: document.querySelector('[data-qa-block] [aria-invalid="true"]')?.getAttribute('name') ?? null, submitEvents: window.__sub } })()`)
        assert.equal(after.submitEvents, 1, `${mode}: 제출이 일어나지 않았다(단추가 밀려 click 이 안 나갔다) — ${JSON.stringify(after)}`)
        assert.equal(after.tag, 'INPUT', `${mode}: 포커스가 칸이 아니다 — ${JSON.stringify(after)}`)
        assert.equal(after.invalid, 'true')
        assert.equal(after.name, after.firstInvalid, `${mode}: 포커스가 첫 오류 칸이 아니다 — ${JSON.stringify(after)}`)
      }, { width: 1024, height: 900 })
    }
  })
}

// 병합 관문에서 찾음(320·375 넘침 측정): AXWF 승인 안내 글이 결제 관리 블록의 격자에서 1.25rem 아이콘 열에 들어가 한 글자씩 줄바꿈됐다(11줄)
for (const width of [320, 375, 1024]) {
  test(`REL11-7: account/billing-manage ${width}px — 승인 안내 글(data-human-hint)이 글 칸 폭으로 그려져 한 글자씩 줄바꿈되지 않는다`, { skip }, async () => {
    await withChrome(async (s) => {
      await openGalleryBlock(s, gallery('block-account-billing-manage'))
      const r = await s.ev(`[...document.querySelectorAll('[data-qa-block] [data-human-hint]')].map((p) => { const b = p.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(p).lineHeight); return { w: Math.round(b.width), lines: Math.round(b.height / lh), text: p.textContent } })`)
      assert.ok(r.length >= 1, '승인 안내 글이 하나 이상 있다')
      for (const h of r) {
        assert.ok(h.w >= 120, `안내 글 폭 ${h.w}px 가 너무 좁다(한 글자씩 줄바꿈): ${JSON.stringify(h)}`)
        assert.ok(h.lines <= 3, `안내 글이 ${h.lines}줄이다: ${JSON.stringify(h)}`)
      }
    }, { width, height: 900 })
  })
}

for (const width of [1440, 375]) {
  test(`REL11-6: 업그레이드 대화상자 ${width}px — 행동 줄이 커져도(고지 글이 길어져도) 줄 바로 위 링크가 줄 밑에 가린 채 포커스를 받지 않는다(2.4.11)`, { skip }, async () => {
    await withChrome(async (s) => {
      await openUpgradeDialog(s, gallery('block-paywall-upgrade-modal'))
      // 행동 줄에 고지 글을 더해 줄 높이를 144px(옛 고정 스크롤 여백)보다 훨씬 키운다 — 줄은 늘 높이를 다시 잰다
      await s.ev(`(() => { const ul = document.querySelector('[data-pinned-terms]'); for (let i = 0; i < 3; i++) { const li = document.createElement('li'); li.textContent = '시험용 고지 글입니다. 첫 결제일과 금액, 결제 수단, 해지 방법을 이 줄에서 알려 드려요. 글이 길어 줄이 높아져요.'; ul.append(li) } })()`)
      await sleep(400)
      const r = await s.ev(`(() => {
        const d = document.querySelector('[data-slot="dialog-content"]'), bar = document.querySelector('[data-pinned-bar]')
        const out = { barH: bar.offsetHeight, pad: parseFloat(getComputedStyle(d).scrollPaddingBottom), covered: [], links: 0 }
        for (const a of d.querySelectorAll('[data-terms="links"] a')) {
          out.links++
          d.scrollTop = 0; document.activeElement?.blur(); a.focus()
          const ar = a.getBoundingClientRect(), br = bar.getBoundingClientRect()
          if (ar.bottom > br.top && ar.top < br.bottom) out.covered.push({ t: a.textContent, aTop: Math.round(ar.top), aBottom: Math.round(ar.bottom), barTop: Math.round(br.top) })
        }
        return out
      })()`)
      assert.ok(r.links >= 2, `링크를 못 찾았다: ${JSON.stringify(r)}`)
      assert.ok(r.barH > 144, `시험이 줄을 144px 보다 키우지 못했다: ${JSON.stringify(r)}`)
      assert.ok(r.pad >= r.barH, `스크롤 여백(${r.pad}px)이 행동 줄 높이(${r.barH}px)를 따라가지 않는다`)
      assert.deepEqual(r.covered, [], `행동 줄에 가려진 링크: ${JSON.stringify(r)}`)
    }, { width, height: width === 1440 ? 900 : 812 })
  })
}
