// SiteShell 고정 헤더가 포커스를 가리지 않는지 잰다(Task 11 리뷰 I2, WCAG 2.4.11).
// 사용: node factory/qa/shell-focus.mjs <origin> [out.json]   예) node factory/qa/shell-focus.mjs http://localhost:3000 .tmp/shell-focus.json
// base 와 헤더 축 값(H1~H5)마다 /qa/shell?h=<값> 을 768·1024px 로 열고, 본문 링크를 Tab 으로 내려갔다 Shift+Tab 으로 올라오며
// 매번 「헤더(스티키 바나 떠 있는 섬) 바닥 ≤ 포커스된 요소 위쪽」을 본다. 주 메뉴 링크는 포커스하면 가로 스크롤 안에 다 보이는지 본다.
// 375px 긴 헤더는 접이식 메뉴(FINAL-WF3 — 「메뉴」 버튼 → 패널)를 잰다: 접힘·aria-expanded·Enter 펼침·패널이 화면·패널 안·Esc 닫기와 초점 복귀(FINAL-WF5).
// scrollLeft 는 정수라 링크 끝이 1px 미만 어긋날 수 있다(허용 1px). 종료: 0 = 쟀고 어긋남 없음 · 1 = 쟀고 어긋남 있음(out.json 있음) 또는
// 도구 실패(「도구 실패:」를 적고 out.json 을 남기지 않는다, hit-area 와 같다) · 2 = 인자 오류. 표: docs/agents/agent-guide.md §3.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'

const [origin, out] = process.argv.slice(2)
if (!origin) { console.error('사용: node factory/qa/shell-focus.mjs <origin> [out.json]'); process.exit(2) }
const VALUES = ['base', 'H1', 'H2', 'H3', 'H4', 'H5'] // H5 마스트헤드(Task 16a) — 768px 이상 제호가 올라가고 레일만 붙는다
const WIDTHS = [375, 768, 1024] // 375 도 헤더가 붙는다(P3-2 D4 — 한 줄 스티키 바) — 포커스·앵커 간격을 모든 폭에서 잰다
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 페이지 안에서 도는 측정: 고정(sticky/fixed)인 헤더·섬의 바닥과 지금 포커스의 위쪽.
const PROBE = `(() => {
  const els = [...document.querySelectorAll('[data-slot=site-shell-header],[data-slot=site-shell-header-inner]')]
  const fixedBottom = Math.max(0, ...els.filter((e) => ['sticky', 'fixed'].includes(getComputedStyle(e).position)).map((e) => e.getBoundingClientRect().bottom))
  const a = document.activeElement, r = a.getBoundingClientRect()
  const ul = a.closest('ul'), u = ul && ul.getBoundingClientRect()
  return { text: a.textContent.trim().slice(0, 20), inMain: !!a.closest('main'), inNav: !!a.closest('[data-slot=site-shell-nav]'), top: r.top, bottom: r.bottom, left: r.left, right: r.right,
    headerBottom: fixedBottom, ulLeft: u ? u.left : null, ulRight: u ? u.right : null, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    barTop: (() => { const b = document.querySelector('[data-qa=shell-bar]'); return b ? b.getBoundingClientRect().top : null })() }
})()`

let chrome, code = 0, toolFailed = false
const results = []
try {
  chrome = await startChrome([], { prefix: 'shell-' })
  const { ws, send, ev } = await connect(chrome.wsUrl) // 호출마다 기한(cdp.mjs session)
  const key = async (shift) => {
    const base = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }); await sleep(60)
  }
  await send('Page.enable'); await send('Runtime.enable')
  for (const v of VALUES) for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: false })
    const target = `${origin}/qa/shell${v === 'base' ? '' : `?h=${v}`}`
    const nav = await navigateAndWait(send, ev, target) // 리뷰 I2 — 고정 sleep 대신 새 문서를 기다린다
    if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${target}`)
    await sleep(500) // 하이드레이션(포커스 처리기)
    // 양성 대조: SHELL_FOCUS_NO_PADDING=1 이면 scroll-padding 을 0 으로 눌러 앵커 검사가 실패하는지 본다.
    if (process.env.SHELL_FOCUS_NO_PADDING) await ev(`document.documentElement.style.setProperty('scroll-padding-top', '0px', 'important')`)
    await ev('scrollTo(0, 0); document.activeElement && document.activeElement.blur()')
    const row = { value: v, width: w, minGap: Infinity, navHidden: 0, steps: 0, overflowX: false, fail: [] }
    // 아래로: 건너뛰기 → 로고 → 메뉴 6 → 행동 → 본문 링크 12(스크롤이 일어난다)
    for (let i = 0; i < 20; i++) {
      await key(false)
      const s = await ev(PROBE)
      row.steps++
      if (s.scrollW > s.innerW) row.overflowX = true
      if (s.inMain) row.minGap = Math.min(row.minGap, s.top - s.headerBottom)
      if (s.inNav && (s.left < s.ulLeft - 1 || s.right > s.ulRight + 1)) { row.navHidden++; row.fail.push(`메뉴 「${s.text}」 ${s.left}~${s.right} ⊄ ${s.ulLeft}~${s.ulRight}`) }
    }
    // 가장 나쁜 경우: 다음 링크를 헤더 밑(뷰포트 위 10px)에 걸쳐 두고 Tab 으로 들어간다 — scroll-padding 이 없으면 브라우저는 「보인다」고 보고 스크롤하지 않는다.
    for (let i = 1; i < 12; i++) {
      await ev(`(() => { const ls = document.querySelectorAll('[data-qa=shell-link]'); ls[${i - 1}].focus({ preventScroll: true }); scrollTo(0, ls[${i}].getBoundingClientRect().top + scrollY - 10) })()`)
      await key(false)
      const s = await ev(PROBE)
      row.steps++
      if (s.inMain) row.underHeaderGap = Math.min(row.underHeaderGap ?? Infinity, s.top - s.headerBottom)
    }
    row.minGap = Math.min(row.minGap, row.underHeaderGap)
    // 앵커 이동(#s5 — 건너뛰기 링크와 같은 경로): 목적지 위쪽이 헤더 바닥 아래여야 한다. 여기서는 scroll-padding 만이 지킨다.
    await ev(`location.hash = ''; scrollTo(0, 0); location.hash = '#s5'`)
    await sleep(200)
    row.anchorGap = await ev(`(() => { const t = document.getElementById('s5').getBoundingClientRect().top; const els = [...document.querySelectorAll('[data-slot=site-shell-header],[data-slot=site-shell-header-inner]')]; return t - Math.max(0, ...els.filter((e) => ['sticky', 'fixed'].includes(getComputedStyle(e).position)).map((e) => e.getBoundingClientRect().bottom)) })()`)
    if (!(row.anchorGap >= 0)) row.fail.push(`앵커 목적지가 헤더에 가린다(${row.anchorGap}px)`)
    row.headerBottom = (await ev(PROBE)).headerBottom
    if (!(row.minGap >= 0)) row.fail.push(`헤더가 포커스를 가린다(최소 간격 ${row.minGap}px)`)
    if (row.navHidden) row.fail.push(`포커스된 메뉴 링크 ${row.navHidden}개가 가로 스크롤 밖에 있다`)
    if (row.overflowX) row.fail.push('가로로 넘친다')
    if (row.fail.length) code = 1
    results.push(row)
    console.log(`${v.padEnd(4)} ${w}px  헤더 바닥 ${row.headerBottom}px · 본문 포커스와 최소 간격 ${row.minGap}px(헤더 밑에 걸친 경우 ${row.underHeaderGap}px) · 앵커 목적지 간격 ${row.anchorGap}px · 숨은 메뉴 포커스 ${row.navHidden} · ${row.fail.length ? '실패: ' + row.fail.join(', ') : '통과'}`)
  }
  // ── 좁은 폭 한 줄 헤더·접이식 메뉴(대장 A131 → FINAL-WF3·WF5): 공개 원형처럼 긴 로고 + 유틸리티 + 검색 + 행동 둘이 함께 있어도 375 에서 한 줄·넘침 없음·말줄임 로고.
  // 칸이 폭을 넘으면 하이드레이션 직후 띠가 「메뉴」 진짜 버튼 뒤 패널로 접힌다(행동은 띠에 남는다) — 버튼(aria-expanded·aria-controls) → Enter 로 펼침 → 패널 안 모든 항목이 Tab 으로 닿고 화면 안·패널 안에 있다 → Esc 가 닫고 초점을 버튼으로.
  // 양성 대조: 같은 화면의 평범한 헤더와 높이가 같아야 하고, 긴 헤더는 접혀 있어야 한다(접히지 않으면 이 검사가 아무것도 안 잰다).
  const HEADER_FACTS = `(() => { const h = document.querySelector('[data-slot=site-shell-header]'); const strip = document.querySelector('[data-slot=site-shell-strip]'); const logo = document.querySelector('[data-slot=site-shell-logo] a'); const lr = document.querySelector('[data-slot=site-shell-logo]').getBoundingClientRect(); return { h: Math.round(h.getBoundingClientRect().height), scrollW: document.documentElement.scrollWidth, innerW: innerWidth, stripDisplay: getComputedStyle(strip).display, collapsed: strip.hasAttribute('data-collapsed'), logoW: Math.round(lr.width), logoClipped: logo.scrollWidth > logo.clientWidth } })()`
  const MENU_FACTS = `(() => { const b = document.querySelector('[data-slot=site-shell-menu-button]'); if (!b) return null; const p = document.getElementById(b.getAttribute('aria-controls') || ''); const pr = p && !p.hidden ? p.getBoundingClientRect() : null; const br = b.getBoundingClientRect(); return { tag: b.tagName, type: b.type, expanded: b.getAttribute('aria-expanded'), panelFound: !!p, panelHidden: p ? p.hidden : null, pl: pr ? pr.left : null, pr: pr ? pr.right : null, pt: pr ? pr.top : null, pb: pr ? pr.bottom : null, ps: p && !p.hidden ? [p.scrollHeight, p.clientHeight] : null, bh: Math.round(br.height), bw: Math.round(br.width), innerW: innerWidth, innerH: innerHeight, active: document.activeElement === b, label: b.textContent.trim() } })()`
  const ITEM_PROBE = `(() => { const a = document.activeElement, r = a.getBoundingClientRect(), p = a.closest('[data-slot=site-shell-menu-panel]'), pr = p && p.getBoundingClientRect(); return { text: a.textContent.trim().slice(0, 12), inPanel: !!p, l: r.left, r: r.right, t: r.top, b: r.bottom, pl: pr ? pr.left : null, pr: pr ? pr.right : null, pt: pr ? pr.top : null, pb: pr ? pr.bottom : null, innerW: innerWidth, innerH: innerHeight } })()`
  const press = async (name) => {
    const codes = { Enter: [13, '\r'], Escape: [27, ''] }
    const [vk, text] = codes[name]
    const base = { key: name, code: name, windowsVirtualKeyCode: vk }
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }); await sleep(120)
  }
  for (const v of VALUES) {
    const row = { value: v, width: 375, wide: true, fail: [] }
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: false })
    const q = (wide) => `${origin}/qa/shell?${v === 'base' ? '' : `h=${v}&`}wide=${wide}`
    await navigateAndWait(send, ev, q(0)); await sleep(300)
    const plain = await ev(HEADER_FACTS)
    await navigateAndWait(send, ev, q(1)); await sleep(700)
    const f = await ev(HEADER_FACTS)
    row.facts = f
    if (f.h > plain.h + 1) row.fail.push(`한 줄이 아니다(헤더 ${f.h}px > 평범한 헤더 ${plain.h}px)`)
    if (f.scrollW > f.innerW) row.fail.push('가로로 넘친다')
    if (f.stripDisplay === 'contents') row.fail.push('375 에서 띠가 켜지지 않았다(display: contents)')
    if (!f.collapsed) row.fail.push('양성 대조 실패: 칸이 폭을 넘는데 메뉴가 접히지 않았다(data-collapsed 없음)')
    if (!f.logoClipped) row.fail.push('긴 로고가 말줄임되지 않았다(양성 대조 — 로고가 잘려야 한다)')
    if (f.logoW > f.innerW / 2 + 1) row.fail.push(`로고가 폭의 절반을 넘는다(${f.logoW}px)`)
    // Tab: 건너뛰기 → 로고 → 「메뉴」 버튼 — 버튼에 닿을 때까지
    await ev('scrollTo(0, 0); document.activeElement && document.activeElement.blur()')
    let m = null
    for (let i = 0; i < 6; i++) { await key(false); m = await ev(MENU_FACTS); if (m?.active) break }
    row.menu = m
    let seen = 0
    if (!m?.active) row.fail.push('Tab 6번 안에 「메뉴」 버튼에 닿지 않았다')
    else {
      if (m.tag !== 'BUTTON' || m.type !== 'button') row.fail.push(`메뉴 단추가 진짜 <button type=button> 이 아니다(${m.tag})`)
      if (m.expanded !== 'false' || !m.panelFound || m.panelHidden !== true) row.fail.push(`닫힌 상태 어긋남: aria-expanded=${m.expanded} 패널 ${m.panelFound ? (m.panelHidden ? '숨김' : '보임') : '없음'}`)
      if (m.bh < 24) row.fail.push(`메뉴 단추 높이 ${m.bh}px < 24(WCAG 2.5.8) — 눌리는 칸 44px 는 단추의 after 가 넓힌다(qa:hit 몫)`)
      await press('Enter')
      const o = await ev(MENU_FACTS)
      row.menuOpen = o
      if (o.expanded !== 'true' || o.panelHidden !== false) row.fail.push(`Enter 로 안 펼쳐진다(aria-expanded=${o.expanded})`)
      else {
        if (o.pl < -1 || o.pr > o.innerW + 1) row.fail.push(`메뉴 패널이 화면 밖으로 잘린다(${Math.round(o.pl)}~${Math.round(o.pr)} / 폭 ${o.innerW})`)
        if (o.pb > o.innerH) row.fail.push(`메뉴 패널 아래가 화면 밖이다(${Math.round(o.pb)} > ${o.innerH})`)
        if (o.ps[0] > o.ps[1] + 1) row.fail.push(`메뉴 패널 안이 잘린다(scrollHeight ${o.ps[0]} > clientHeight ${o.ps[1]})`)
        // 펼친 뒤 Tab: 패널 안 항목(유틸리티 3 · 검색 1 · 메뉴 6 = 10)이 화면 안·패널 안에 있어야 한다
        for (let i = 0; i < 14; i++) {
          await key(false)
          const p = await ev(ITEM_PROBE)
          if (!p.inPanel) break
          seen++
          if (p.l < -1 || p.r > p.innerW + 1) row.fail.push(`패널 항목 「${p.text}」 ${Math.round(p.l)}~${Math.round(p.r)} 가 화면 밖`)
          if (p.l < p.pl - 1 || p.r > p.pr + 1 || p.t < p.pt - 1 || p.b > p.pb + 1) row.fail.push(`패널 항목 「${p.text}」 가 패널 밖(${Math.round(p.t)}~${Math.round(p.b)} ⊄ ${Math.round(p.pt)}~${Math.round(p.pb)})`)
        }
        if (seen < 10) row.fail.push(`패널 안 항목 ${seen}개만 Tab 으로 닿았다(10개 기대)`)
        // Esc: 닫고 초점을 단추로
        // 띠 밖으로 나가면 패널이 닫힌다(blur) — 버튼에서 다시 펼쳐 Esc 를 잰다
        await ev(`(document.querySelector('[data-slot=site-shell-menu-button]')).focus()`)
        if ((await ev(MENU_FACTS)).expanded !== 'true') await press('Enter')
        const o2 = await ev(MENU_FACTS)
        if (o2.expanded !== 'true') row.fail.push('다시 펼치지 못했다')
        await key(false) // 패널 첫 항목으로
        await press('Escape')
        const c = await ev(MENU_FACTS)
        if (c.expanded !== 'false') row.fail.push(`Esc 가 안 닫는다(aria-expanded=${c.expanded})`)
        if (!c.active) row.fail.push('Esc 뒤 초점이 「메뉴」 버튼으로 돌아오지 않았다')
        row.escape = { expanded: c.expanded, focusOnButton: c.active }
      }
    }
    row.itemsSeen = seen
    if (row.fail.length) code = 1
    results.push(row)
    console.log(`${v.padEnd(4)} 375px 긴 헤더  헤더 ${f.h}px(평범 ${plain.h}px) · 접힘 ${f.collapsed} · 로고 ${f.logoW}px(말줄임 ${f.logoClipped}) · 메뉴 단추 ${m?.bw}×${m?.bh} · 패널 ${row.menuOpen ? `${Math.round(row.menuOpen.pl)}~${Math.round(row.menuOpen.pr)}/${row.menuOpen.innerW} 높이 ${Math.round(row.menuOpen.pb - row.menuOpen.pt)}` : '-'} · 패널 안 Tab ${seen}칸 · Esc ${row.escape ? (row.escape.expanded === 'false' && row.escape.focusOnButton ? '닫힘+초점 복귀' : '실패') : '-'} · ${row.fail.length ? '실패: ' + row.fail.join(', ') : '통과'}`)
  }
  // ── 하단 고정 바(대장 A107 뒤쪽 절반): scroll-padding-bottom 이 있으면 Tab 포커스가 바에 안 가린다. 음성 대조(&pad=0): 여백을 빼면 가려져야 한다.
  for (const w of [375, 1024]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: false })
    const gaps = {}
    for (const pad of [1, 0]) {
      await navigateAndWait(send, ev, `${origin}/qa/shell?bar=1${pad ? '' : '&pad=0'}`); await sleep(400)
      let minGap = Infinity
      for (let i = 1; i < 12; i++) {
        // 다음 링크를 바 밑(뷰포트 아래 끝에서 10px 위)에 걸쳐 두고 Tab 으로 들어간다
        await ev(`(() => { const ls = document.querySelectorAll('[data-qa=shell-link]'); ls[${i - 1}].focus({ preventScroll: true }); scrollTo(0, ls[${i}].getBoundingClientRect().top + scrollY - (innerHeight - 10)) })()`)
        await key(false)
        const s = await ev(PROBE)
        if (s.inMain && s.barTop != null) minGap = Math.min(minGap, s.barTop - s.bottom)
      }
      gaps[pad] = minGap
    }
    const row = { value: 'bar', width: w, fail: [], gaps }
    if (!(gaps[1] >= 0)) row.fail.push(`하단 고정 바가 포커스를 가린다(scroll-padding-bottom 있음, 최소 간격 ${gaps[1]}px)`)
    if (!(gaps[0] < 0)) row.fail.push(`양성 대조 실패: 여백 없이도 안 가려진다(최소 간격 ${gaps[0]}px) — 이 검사가 아무것도 안 잰다`)
    if (row.fail.length) code = 1
    results.push(row)
    console.log(`bar  ${w}px  하단 바 위 최소 간격: 여백 있음 ${gaps[1]}px · 여백 없음(음성 대조) ${gaps[0]}px · ${row.fail.length ? '실패: ' + row.fail.join(', ') : '통과'}`)
  }
  // 흐르는 헤더(sticky={false}, Task 6 리뷰 M1): 반투명·블러가 있는 H1·H2 를 1024px 로 열어, 셸 헤더·안쪽 줄에 블러도 고정 위치도 없는지 본다.
  // 양성 대조: 같은 값의 스티키 셸(기본)에는 블러가 있어야 한다 — 없으면 이 검사가 아무것도 재지 않는 것이다.
  const SHELL_EL = `[...document.querySelectorAll('[data-slot=site-shell-header],[data-slot=site-shell-header-inner]')].map((e) => { const c = getComputedStyle(e); return { slot: e.dataset.slot, pos: c.position, blur: c.backdropFilter } })`
  for (const v of ['H1', 'H2']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 800, deviceScaleFactor: 1, mobile: false })
    const row = { value: v, width: 1024, sticky: false, fail: [] }
    await navigateAndWait(send, ev, `${origin}/qa/shell?h=${v}`)
    const on = await ev(SHELL_EL)
    if (!on.some((e) => e.blur !== 'none')) row.fail.push('양성 대조 실패: 스티키 셸에 블러가 없다')
    await navigateAndWait(send, ev, `${origin}/qa/shell?h=${v}&sticky=0`)
    const off = await ev(SHELL_EL)
    for (const e of off) {
      if (e.blur !== 'none') row.fail.push(`${e.slot} 블러 ${e.blur}`)
      if (['sticky', 'fixed'].includes(e.pos)) row.fail.push(`${e.slot} ${e.pos}`)
    }
    if (row.fail.length) code = 1
    results.push(row)
    console.log(`${v.padEnd(4)} 1024px sticky={false}  ${off.map((e) => `${e.slot} ${e.pos}·${e.blur}`).join(' / ')} · ${row.fail.length ? '실패: ' + row.fail.join(', ') : '통과'}`)
  }
  ws.close()
} catch (e) {
  console.error(`도구 실패: ${e.message}`); code = 1; toolFailed = true
} finally {
  if (chrome) await chrome.close()
}
// 측정 없음(도구 실패)이면 결과 파일을 남기지 않는다 — 부분 결과·이전 실행의 결과가 읽히지 않게(최종 리뷰 M2).
if (out && toolFailed) rmSync(out, { force: true })
else if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(results, null, 2)) }
process.exit(code)
