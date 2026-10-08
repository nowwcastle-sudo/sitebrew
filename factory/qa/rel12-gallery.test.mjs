// REL12 (v0.0.12) 갤러리 블록 회귀 시험 — 갤러리 서버(next dev·next start)가 있어야 돈다. 고치기 전에는 실패한다.
//   업그레이드 대화상자(paywall/upgrade-modal) 320·375·390px 의 주 단추 글 — 단추(inline-flex)가 글 조각(글자·금액 요소)마다 칸을 만들어
//   「14일 무료 체험 시작 · 이후 29,000원/월」이 「29,000 / 원 / 월」 세 줄로 갈라졌다(WFCI 열린 창 촬영에서 발견).
//   고친 뒤: 글 전체가 한 칸(.cn-block-choice-label)에 담기고, 금액 덩어리(금액·통화·기간)는 한 줄에 머문다(.cn-block-nowrap).
//   L3 대등성(주 단추와 「나중에 할게요」의 폭·높이가 같다)과 단추가 화면 밖으로 나가지 않는 것도 같이 본다.
// 실행: REL12_ORIGIN=http://localhost:4912 node --test --test-force-exit --test-timeout=400000 factory/qa/rel12-gallery.test.mjs   (REL12_ORIGIN 이 없으면 건너뛴다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startChrome, connect, navigateAndWait, closeChrome } from './cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGIN = process.env.REL12_ORIGIN?.replace(/\/$/, '') ?? null
const skip = !ORIGIN && 'REL12_ORIGIN(갤러리 서버 주소)이 없다'

async function withChrome(fn, { width = 1024, height = 800 } = {}) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'rel12g-' })
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
async function openUpgradeDialog({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
  await ev(`document.querySelector('[aria-haspopup="dialog"]').click()`)
  for (let i = 0; i < 100 && !(await ev(`!!document.querySelector('[data-slot="dialog-content"] [data-terms="links"]')`)); i++) await sleep(100)
  await sleep(700)
}

// 주 단추 글의 모양을 잰다: 금액 덩어리 안의 글 조각이 모두 같은 줄(top 이 같다)에 있는가 · 단추 글이 한 칸에 담겼는가 · 두 단추의 크기
const MEASURE = `(() => { try {
  const dlg = document.querySelector('[data-slot="dialog-content"]')
  const primary = dlg.querySelector('[data-choice="primary"]')
  const dismiss = dlg.querySelector('[data-choice="decline"], [data-choice="dismiss"]')
  // 갤러리는 컴파일본을 그려 cn-* 훅 이름이 유틸리티 클래스로 바뀌어 있다 — 단추의 (스피너 아닌) 첫 직접 자식이 글 칸, 그 안의 whitespace-nowrap 이 금액 덩어리
  const label = [...primary.children].find((c) => !c.matches('svg')) ?? null
  const group = label?.querySelector('[class*="whitespace-nowrap"]') ?? null
  const tops = []
  if (group) {
    const w = document.createTreeWalker(group, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const r = document.createRange(); r.selectNodeContents(n)
      const b = r.getBoundingClientRect(); tops.push(Math.round(b.top))
    }
  }
  // 단추의 직접 자식 칸 수(스피너 제외) — 글이 조각마다 칸이면 3 이상이다
  const cells = [...primary.children].filter((c) => !c.matches('svg')).length
  const rp = primary.getBoundingClientRect(), rd = dismiss.getBoundingClientRect()
  return {
    text: primary.textContent.trim(), hasLabel: !!label, hasGroup: !!group, groupText: group?.textContent ?? null, tops, cells,
    primary: { x: rp.left, r: rp.right, w: Math.round(rp.width), h: Math.round(rp.height) },
    dismiss: { w: Math.round(rd.width), h: Math.round(rd.height) },
    vw: document.documentElement.clientWidth,
    labelOverflow: label ? label.scrollWidth - label.clientWidth : null,
  }
  } catch (e) { return { error: String(e) } }
})()`

for (const width of [320, 375, 390]) {
  test(`업그레이드 대화상자 ${width}px: 주 단추의 금액·통화·기간이 한 줄에 머물고 단추 글은 한 칸이며 두 단추는 대등하다`, { skip, timeout: 400000 }, async () => {
    await withChrome(async (s) => {
      await openUpgradeDialog(s, gallery('block-paywall-upgrade-modal'))
      const m = await s.ev(MEASURE)
      if (process.env.REL12_SHOTS) {
        const { writeFileSync, mkdirSync } = await import('node:fs')
        mkdirSync(process.env.REL12_SHOTS, { recursive: true })
        const shot = await s.send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(`${process.env.REL12_SHOTS}/upgrade-${width}.png`, Buffer.from(shot.result.data, 'base64'))
      }
      console.log(`  ${width}px`, JSON.stringify(m))
      assert.ok(m && !m.error, `측정 실패: ${m?.error}`)
      assert.ok(m.hasLabel, '단추 글이 한 칸(.cn-block-choice-label)에 담겨야 한다')
      assert.ok(m.text.length > 0)
      assert.equal(m.cells, 1, `단추의 직접 칸은 글 하나여야 한다(조각마다 칸이면 공백이 벌어진다): ${m.cells}`)
      assert.ok(m.hasGroup, '금액 덩어리(.cn-block-nowrap)가 있어야 한다')
      assert.ok(m.tops.length >= 1 && m.tops.every((t) => Math.abs(t - m.tops[0]) <= 2), `금액·통화·기간이 한 줄이어야 한다: top ${m.tops.join(',')}`)
      assert.match(m.groupText, /\d[\d,]*\D*\//, `금액 덩어리에 「금액/기간」이 함께 든다: ${m.groupText}`)
      assert.ok(Math.abs(m.primary.w - m.dismiss.w) <= 1 && Math.abs(m.primary.h - m.dismiss.h) <= 1, `L3 대등: 주 ${m.primary.w}x${m.primary.h} · 보조 ${m.dismiss.w}x${m.dismiss.h}`)
      assert.ok(m.primary.r <= m.vw + 0.5 && m.primary.x >= -0.5, `단추가 화면 안: ${m.primary.x}..${m.primary.r} / ${m.vw}`)
      assert.ok((m.labelOverflow ?? 0) <= 1, `단추 글이 단추 밖으로 넘치지 않는다: ${m.labelOverflow}`)
    }, { width, height: 900 })
  })
}

// ── REL12 5b·5c·5d (launch-factory P1AB 후속) ──────────────────────────────────────────────────────────────────────
async function openGalleryBlock({ send, ev }, url) {
  await navigateAndWait(send, ev, url, { timeoutMs: 120000 })
  for (let i = 0; i < 1200 && !(await ev('!!document.querySelector("[data-qa-ready]")')); i++) await sleep(100)
  await sleep(900)
}
const mouse = async (send, type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 })
const center = async (ev, sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)

test('REL12 5b: 진짜 마우스로 보내기를 눌러도 앱(포트)이 돌려준 칸 오류가 칸 이동 검사에 지워지지 않는다(로그인 — 비밀번호 칸 오류)', { skip, timeout: 400000 }, async () => {
  await withChrome(async (s) => {
    await openGalleryBlock(s, gallery('block-auth-sign-in', '&submit=field-error&auth=signed-out'))
    // 이메일·비밀번호를 진짜 클릭 + 입력으로 채운다(비밀번호 칸이 마지막 포커스 — 보내기를 누르면 그 칸이 포커스를 잃는다)
    for (const [sel, text] of [['input[type="email"], input[name="email"]', 'someone@example.com'], ['input[type="password"]', 'Passw0rd!123']]) {
      const c = await center(s.ev, sel)
      assert.ok(c, `${sel} 칸이 있어야 한다`)
      await mouse(s.send, 'mousePressed', c.x, c.y); await mouse(s.send, 'mouseReleased', c.x, c.y)
      await s.send('Input.insertText', { text })
    }
    const b = await center(s.ev, 'form button[type="submit"]')
    assert.ok(b, '보내기 단추가 있어야 한다')
    await mouse(s.send, 'mouseMoved', b.x, b.y); await mouse(s.send, 'mousePressed', b.x, b.y); await mouse(s.send, 'mouseReleased', b.x, b.y)
    await sleep(1500)
    const r = await s.ev(`(() => { const p = document.querySelector('input[type="password"]'); return { invalid: p.getAttribute('aria-invalid'), msg: (document.getElementById(p.getAttribute('aria-describedby')?.split(' ')[0] ?? '')?.textContent ?? '').trim(), active: document.activeElement === p } })()`)
    console.log('  비밀번호 칸 오류:', JSON.stringify(r))
    assert.equal(r.invalid, 'true', '앱이 돌려준 비밀번호 칸 오류가 남아 있어야 한다(칸 이동 검사가 지우지 않는다)')
    assert.ok(r.msg.length > 0, '오류 문구가 보인다')
    assert.ok(r.active, '첫 오류 칸에 포커스')
  }, { width: 1024, height: 900 })
})

test('REL12 5c: account/notification-consents — &channels=email 이면 이메일 스위치 하나, 없으면 네 채널(예전 그대로)', { skip, timeout: 400000 }, async () => {
  const count = async (extra) => withChrome(async (s) => {
    await openGalleryBlock(s, gallery('block-account-notification-consents', extra))
    for (let i = 0; i < 100 && !(await s.ev('document.querySelectorAll(\'[data-consent="optional"]\').length')); i++) await sleep(100)
    return s.ev('document.querySelectorAll(\'[data-consent="optional"]\').length')
  })
  assert.equal(await count(''), 4)
  assert.equal(await count('&channels=email'), 1)
})

test('REL12 5d: confirmation/verify-email — &initialWait=0 이면 처음부터 다시 보내기가 풀려 있고, 안 주면 예전 그대로 처음 resendAfter 초 잠긴다', { skip, timeout: 400000 }, async () => {
  const read = async (extra) => withChrome(async (s) => {
    await openGalleryBlock(s, gallery('block-confirmation-verify-email', extra))
    await sleep(600)
    return s.ev(`(() => { const t = document.querySelector('[role="timer"]'); const b = document.querySelector('[data-resend]'); return { cooldown: Number(t?.getAttribute('data-cooldown') ?? -1), locked: b?.getAttribute('aria-disabled') === 'true' || !!b?.disabled, hasButton: !!b } })()`)
  })
  const locked = await read('')
  const open = await read('&initialWait=0')
  console.log('  기본:', JSON.stringify(locked), ' initialWait=0:', JSON.stringify(open))
  assert.ok(locked.hasButton && locked.cooldown > 0 && locked.locked, '기본은 처음에 잠긴다(예전 그대로)')
  assert.ok(open.hasButton && open.cooldown === 0 && !open.locked, 'initialWait=0 이면 처음부터 풀려 있다')
})
