// 히트 영역 측정: node hit-area.mjs <url> <out.json> [--min 44] [--open]
// 누를 수 있는 요소마다 「요소 상자 ∪ 요소 자신의 ::before/::after 확장」 크기를 잰다(web-design-canon audit.js 와 같은 규칙:
// position:absolute · content 있음 · 눌림 가능 · 요소 padding box 와 겹침, 좌표는 padding box 기준).
// 더해서:
//  - <input>·<textarea>·<select>·<img> 는 대체 요소라 가상 요소가 그려지지 않으므로 확장을 세지 않는다.
//  - 확장은 잘라내는 조상(overflow ≠ visible, 요소 자신 포함)의 padding box 로 자른다 — 잘린 부분은 눌리지 않는다.
//  - label 안의 컨트롤은 label 상자와 label 의 가상 요소를 합친다(label 을 누르면 컨트롤이 눌린다).
//  - input-group 안의 입력은 그룹 상자를 합친다(그룹 어디를 눌러도 입력칸에 초점 — InputGroup onClick).
//  - 투명(opacity 0)이어도 눌리면 잰다. pointer-events:none·비활성·tabpanel·부품 밖(data-slot 없는 페이지 요소)은 재지 않는다.
// --open: aria-haspopup 트리거·navigation-menu 트리거를 하나씩 눌러(context-menu 트리거는 오른쪽 클릭) 열린 목록 안 항목도 잰다.
// 판정: factory/qa/hit-area-exceptions.json 의 예외(슬롯 + 맥락)는 24 이상, 나머지는 min(기본 44) 이상.
// 결과: out.json = { viewport, pointer, min, count, rows:[{slot, qa, label, w, h, ownW, ownH, pseudo, exception, pass}], overlaps, fail:[…] }.
// 종료: 0 = 쟀고 실패 없음, 1 = 쟀고 실패 있음(out.json 있음) 또는 도구 실패(탐색 실패·CDP 기한 초과 등 — 「도구 실패:」를 적고 out.json 을 남기지 않는다), 2 = 인자 오류.
// (다른 CDP 도구와 같게 도구 실패는 1 — Task 13a Fix round 2. 예전에는 도구 실패가 3이었다.)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'

// 모션 키트 장면의 등장 끝 신호를 기다린다 → 'entered' · 'no-scene'(3초 안에 장면이 없다) · 'stuck'(10초 안에 신호가 없다). 관문·촬영이 같은 식을 쓴다.
export const ENTERED_WAIT = `(async () => { const t0 = performance.now(); for (;;) { const r = document.querySelector('[data-wf-scene]'); const dt = performance.now() - t0; if (!r) { if (dt > 3000) return 'no-scene' } else if (r.hasAttribute('data-wf-entered')) return 'entered'; if (dt > 10000) return 'stuck'; await new Promise((q) => setTimeout(q, 50)) } })()`
export const EXCEPTIONS = JSON.parse(readFileSync(new URL('./hit-area-exceptions.json', import.meta.url), 'utf8'))

export function pageMeasure(rules) {
  const REPLACED = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'IFRAME'])
  const sel = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=slider],[role=combobox],[tabindex]:not([tabindex="-1"])'
  const visible = (el) => { const cs = getComputedStyle(el); return cs.visibility === 'visible' && cs.display !== 'none' && cs.pointerEvents !== 'none' }
  const paddingBox = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), b = (v) => parseFloat(v) || 0
    return { left: r.left + b(cs.borderLeftWidth), right: r.right - b(cs.borderRightWidth), top: r.top + b(cs.borderTopWidth), bottom: r.bottom - b(cs.borderBottomWidth) }
  }
  const borderBox = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
  const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
  const grow = (box, p) => { box.left = Math.min(box.left, p.left); box.right = Math.max(box.right, p.right); box.top = Math.min(box.top, p.top); box.bottom = Math.max(box.bottom, p.bottom) }
  // 요소 자신부터 위로, overflow 가 visible 이 아닌 조상의 padding box 로 자른다.
  const clip = (owner, p) => {
    for (let n = owner; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n), c = paddingBox(n)
      if (cs.overflowX !== 'visible') { p.left = Math.max(p.left, c.left); p.right = Math.min(p.right, c.right) }
      if (cs.overflowY !== 'visible') { p.top = Math.max(p.top, c.top); p.bottom = Math.min(p.bottom, c.bottom) }
    }
    return p
  }
  const scan = (owner, box) => {
    if (REPLACED.has(owner.tagName)) return null
    const anchor = paddingBox(owner)
    let used = null
    for (const part of ['::before', '::after']) {
      const cs = getComputedStyle(owner, part)
      if (cs.content === 'none' || cs.position !== 'absolute') continue
      if (cs.pointerEvents === 'none' || cs.visibility !== 'visible' || cs.display === 'none') continue
      const n = (v) => (v === 'auto' ? null : parseFloat(v))
      const [l, r, t, b, w, h] = [n(cs.left), n(cs.right), n(cs.top), n(cs.bottom), n(cs.width), n(cs.height)]
      let pl = l !== null ? anchor.left + l : null, pr = r !== null ? anchor.right - r : null
      let pt = t !== null ? anchor.top + t : null, pb = b !== null ? anchor.bottom - b : null
      if (pl === null && pr !== null && w !== null) pl = pr - w
      if (pr === null && pl !== null && w !== null) pr = pl + w
      if (pt === null && pb !== null && h !== null) pt = pb - h
      if (pb === null && pt !== null && h !== null) pb = pt + h
      const p = clip(owner, { left: pl ?? anchor.left, right: pr ?? anchor.right, top: pt ?? anchor.top, bottom: pb ?? anchor.bottom })
      if (p.right <= p.left || p.bottom <= p.top || !overlaps(p, anchor)) continue
      grow(box, p)
      used = { part, top: cs.top, bottom: cs.bottom, left: cs.left, right: cs.right }
    }
    return used
  }
  const hidden = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width <= 1 || r.height <= 1 || (cs.clip && cs.clip !== 'auto') || /^inset\(\s*50%/i.test(cs.clipPath || '') }
  const unreachable = (el) => el.getAttribute('aria-hidden') === 'true' || el.getAttribute('tabindex') === '-1' || !!el.closest('[inert],[hidden]')
  const inlineLink = (el) => el.tagName === 'A' && el.closest('p,li,dd,td') && getComputedStyle(el).display === 'inline'
  const inert = (el) => el.matches(':disabled,[aria-disabled=true],[data-disabled]:not([data-disabled=false]),[role=tabpanel]')
  const compiled = rules.map((r) => ({ ...r, re: new RegExp(r.slot) }))
  const exceptionOf = (el, slot) => compiled.find((r) => r.re.test(slot) && (!r.within || el.closest(r.within)) && (!r.notMatches || !el.matches(r.notMatches))) ?? null
  const rows = []
  for (const el of document.querySelectorAll(sel)) {
    const own = el.getBoundingClientRect()
    if (!own.width || !own.height || !visible(el) || inlineLink(el) || inert(el)) continue
    if (hidden(el) && unreachable(el)) continue
    const slotEl = el.dataset.slot ? el : el.closest('[data-slot]')
    if (!slotEl) continue // 부품 밖(검수대 목차 등 페이지 자체) 은 재지 않는다
    // 달력 날짜는 Button(data-slot=button)으로 그려지므로 data-day 로 구분한다
    const slot = el.hasAttribute('data-day') && el.closest('[data-slot=calendar]') ? 'calendar-day-button' : slotEl.dataset.slot
    // 스크롤 칸(overflow auto·scroll 이고 실제로 넘치는 조상) 안의 타깃은 스크롤해 가운데로 들인 뒤 잰다 — 스크롤 칸의 보이는 끝이 ::after 를 자르는 것은 눌림을 잃는 게 아니라
    // 스크롤 위치의 우연이다(열린 대화상자가 뷰포트보다 길 때 체크 칸 44×37.6, C374). overflow hidden·clip 의 잘림은 스크롤로 닿지 않으니 그대로 센다(pageOverlaps 도 같은 식).
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (/auto|scroll/.test(cs.overflowY + cs.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); break }
    }
    const box = borderBox(el)
    let pseudo = scan(el, box)
    if (!pseudo && hidden(el) && el.parentElement && getComputedStyle(el.parentElement).position !== 'static') pseudo = scan(el.parentElement, box)
    // 시각적으로 숨긴 요소(1px·clip)는 부모 확장이 없으면 포인터 타깃이 아니다(스크린 리더 전용 — 예: Base UI 목록의 「Dismiss」)
    if (!pseudo && hidden(el) && !el.closest('label')) continue
    // 같은 요소를 여러 번 재도 한 줄로 — 팝업을 열 때마다 스크롤이 바뀌어 위치는 키가 될 수 없다
    if (!el.dataset.hitId) el.dataset.hitId = String((window.__hitSeq = (window.__hitSeq ?? 0) + 1))
    const label = el.closest('label')
    if (label && label !== el) { grow(box, borderBox(label)); pseudo = scan(label, box) ?? pseudo }
    const group = slot === 'input-group-control' ? el.closest('[data-slot=input-group]') : null
    if (group) grow(box, borderBox(group))
    const qa = el.closest('[data-qa]')?.getAttribute('data-qa') ?? null
    const text = (el.getAttribute('aria-label') || el.innerText || label?.innerText || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24)
    const ex = exceptionOf(el, slot)
    rows.push({ slot, qa, label: text, tag: el.tagName, key: el.dataset.hitId, w: Math.round((box.right - box.left) * 10) / 10, h: Math.round((box.bottom - box.top) * 10) / 10, ownW: Math.round(own.width * 10) / 10, ownH: Math.round(own.height * 10) / 10, pseudo, exception: ex ? ex.id : null, category: ex ? ex.category : null })
  }
  return rows
}

// 겹침(Task 13a 항목 4): 합집합 상자만 재면 「옆 타깃의 ::after 가 이 타깃의 보이는 자리를 가져가는 것」을 못 본다.
// 타깃마다 화면 가운데로 굴린 뒤 보이는 상자 안 9점(가장자리 1px 안쪽·가운데)을 elementFromPoint 로 눌러 본다.
// 맞은 요소의 가장 가까운 타깃이 다른 타깃(서로 조상·자손 아님)이면 그 점을 뺏긴 것이다. 가상 요소를 누르면 주인 요소가 돌아온다.
// 판정: hit-area-exceptions.json 의 overlaps(victim·thief 슬롯 정규식 + within)에 맞으면 받아들인 겹침, 아니면 실패.
export function pageOverlaps(rules) {
  // 눌리지 않는 현재 쪽 표식(aria-current=page + aria-disabled=true — shadcn BreadcrumbPage)은 겹침의 한쪽이 아니다(C370).
  // slider 손잡이는 역할이 숨은 input 에 있어 손잡이 자체를 더한다(두 손잡이 겹침)
  const sel = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=slider],[role=combobox],[tabindex]:not([tabindex="-1"]),[data-slot=slider-thumb]'
  const shown = (el) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && cs.visibility === 'visible' && cs.display !== 'none' && cs.pointerEvents !== 'none' && Number(cs.opacity) > 0 && !el.closest('[inert],[hidden],[aria-hidden=true]') && !el.matches(':disabled,[role=tabpanel],[aria-current=page][aria-disabled=true]') }
  const targets = [...document.querySelectorAll(sel)].filter((el) => el.closest('[data-slot]') && shown(el))
  const set = new Set(targets)
  const ownerOf = (n) => { for (let x = n; x; x = x.parentElement) if (set.has(x)) return x; return null }
  const slotOf = (el) => (el.dataset.slot ? el : el.closest('[data-slot]'))?.dataset.slot ?? el.tagName
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.closest('label')?.innerText || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 20)
  const compiled = (rules ?? []).map((r) => ({ ...r, v: new RegExp(r.victim), t: new RegExp(r.thief) }))
  const out = new Map()
  for (const el of targets) {
    el.scrollIntoView({ block: 'center', inline: 'center' })
    // 가로·세로로 잘리는 조상(overflow 가 visible 이 아닌 스크롤·자르기 칸) 밖으로 삐져나간 부분은 눌리지 않는다 — 그 밖의 점은 이웃이 「빼앗은」 게 아니다(가로 스크롤 메뉴의 화면 밖 링크).
    const r0 = el.getBoundingClientRect()
    const r = { left: r0.left, top: r0.top, right: r0.right, bottom: r0.bottom }
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const b = p.getBoundingClientRect()
      r.left = Math.max(r.left, b.left); r.top = Math.max(r.top, b.top); r.right = Math.min(r.right, b.right); r.bottom = Math.min(r.bottom, b.bottom)
    }
    if (r.right - r.left < 2 || r.bottom - r.top < 2) continue
    const xs = [r.left + 1, (r.left + r.right) / 2, r.right - 1], ys = [r.top + 1, (r.top + r.bottom) / 2, r.bottom - 1]
    for (const x of xs) for (const y of ys) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue
      const hit = document.elementFromPoint(x, y)
      if (!hit || el.contains(hit)) continue
      const o = ownerOf(hit)
      if (!o || o === el || o.contains(el) || el.contains(o)) continue
      // 같은 label 안(label 을 누르면 안의 컨트롤이 눌린다)은 한 타깃이다
      if (el.closest('label') && el.closest('label') === o.closest('label')) continue
      const key = `${slotOf(el)}|${nameOf(el)}|${slotOf(o)}|${nameOf(o)}`
      const row = out.get(key) ?? { victim: slotOf(el), victimLabel: nameOf(el), thief: slotOf(o), thiefLabel: nameOf(o), points: 0, w: Math.round(r0.width), h: Math.round(r0.height) }
      row.points++
      out.set(key, row)
      const ex = compiled.find((c) => c.v.test(row.victim) && c.t.test(row.thief) && (!c.within || el.closest(c.within)))
      row.exception = ex ? ex.id : null
    }
  }
  window.scrollTo(0, 0)
  return [...out.values()]
}

// 판정(CLI·블록 행렬 blocks:gates 가 같이 쓴다): 잰 줄(pageMeasure 결과)과 겹침(pageOverlaps 결과) → { rows(pass 표시), fail(사람이 읽는 줄) }.
export function hitJudge(measured, overlaps, min = 44) {
  const rows = measured.map(({ key, ...x }) => ({ ...x, pass: x.exception ? x.w >= 24 && x.h >= 24 : x.w >= min && x.h >= min }))
  const fail = [
    ...rows.filter((x) => !x.pass).map((x) => `${x.slot ?? x.tag} ${x.qa ?? ''} ${x.label} ${x.w}x${x.h}`),
    ...overlaps.filter((o) => !o.exception).map((o) => `겹침 ${o.thief}「${o.thiefLabel}」 → ${o.victim}「${o.victimLabel}」 ${o.points}점`),
  ]
  return { rows, fail }
}

const main = async () => {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d }
  const min = Number(flag('--min', 44))
  const pointer = flag('--pointer', 'fine')
  const openPopups = argv.includes('--open')
  const [url, out] = argv.filter((a) => a !== '--open')
  if (!url || !out || !['fine', 'coarse'].includes(pointer)) { console.error('사용: hit-area.mjs <url> <out.json> [--min 44] [--open] [--pointer fine|coarse]'); process.exit(2) }
  // 포인터 방식(리뷰 I1, DESIGN §7): pointer 가 붙은 예외는 그 방식에서만 선다. coarse 에서는 fine 전용 예외가 빠져 44 로 잰다.
  const scoped = (list) => (list ?? []).filter((r) => !r.pointer || r.pointer === pointer)
  mkdirSync(dirname(out), { recursive: true })
  rmSync(out, { force: true }) // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let chrome, code = 0
  try {
    chrome = await startChrome(['--hide-scrollbars'], { prefix: 'hit-' })
    const { ws, send, ev } = await connect(chrome.wsUrl) // 호출마다 기한(cdp.mjs session)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    if (pointer === 'coarse') {
      // 터치 화면처럼: (pointer: coarse)·(hover: none) 미디어와 터치 지점. 탐색 뒤 matchMedia 로 실제로 걸렸는지 본다.
      // setEmitTouchEventsForMouse 는 쓰지 않는다 — --open 의 마우스 클릭이 답 없이 멈췄다(45초 기한으로 드러남).
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }, { name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }] })
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    }
    await send('Page.enable')
    await send('Runtime.enable')
    const nav = await navigateAndWait(send, ev, url) // 옛 문서의 complete 를 새 문서로 읽지 않는다(리뷰 I2)
    if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
    await sleep(800)
    // 모션 키트 장면(data-wf-scene — Task 11)은 등장 끝 신호(data-wf-entered)까지 기다린다(최대 10초) — 주 CTA 가 등장 순서 마지막이라 0.8초에는 아직 숨어 있다.
    // 장면이 3초 안에 붙지 않으면 모션 키트를 쓰지 않는 페이지로 보고 바로 잰다. 10초 안에 신호가 없으면 경고하고 잰다(숨은 CTA 는 잰 수 0 = 실패로 드러난다).
    const entered = await ev(ENTERED_WAIT)
    if (entered === 'stuck') console.error(`경고: 등장 끝 신호(data-wf-entered)가 10초 안에 없다 — ${url}`)
    const matched = await ev(`matchMedia('(pointer: ${pointer})').matches`)
    if (!matched) throw new Error(`(pointer: ${pointer}) 가 페이지에서 맞지 않는다 — 포인터 에뮬레이션 실패`)
    const measure = async () => (await ev(`(${pageMeasure.toString()})(${JSON.stringify(scoped(EXCEPTIONS.exceptions))})`)) ?? []
    const byKey = new Map()
    for (const r of await measure()) byKey.set(r.key, r)
    const opened = []
    if (openPopups) {
      // 열 것: aria-haspopup 트리거(드롭다운·메뉴 막대·select·combobox), navigation-menu 트리거, context-menu 영역(오른쪽 클릭)
      const openers = await ev(`[...document.querySelectorAll('[aria-haspopup]:not([aria-haspopup=false]),[data-slot=navigation-menu-trigger],[data-slot=context-menu-trigger]')].filter((e) => !e.closest('[inert],[hidden]') && !e.matches(':disabled')).map((e, i) => { e.setAttribute('data-hit-open', i); return { i, slot: e.dataset.slot ?? e.closest('[data-slot]')?.dataset.slot ?? e.tagName, right: e.dataset.slot === 'context-menu-trigger' } })`) ?? []
      for (const o of openers) {
        const pt = await ev(`(() => { const e = document.querySelector('[data-hit-open="${o.i}"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
        if (!pt) continue
        const button = o.right ? 'right' : 'left'
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y })
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button, clickCount: 1 })
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button, clickCount: 1 })
        await sleep(500)
        const before = byKey.size
        for (const r of await measure()) if (!byKey.has(r.key)) byKey.set(r.key, { ...r, openedBy: o.slot })
        opened.push({ opener: o.slot, added: byKey.size - before })
        for (let k = 0; k < 2; k++) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(150) }
      }
    }
    // 겹침은 팝업을 닫은 첫 화면에서 잰다(열린 목록은 조밀 예외라 식이 없다)
    const overlaps = (await ev(`(${pageOverlaps.toString()})(${JSON.stringify(scoped(EXCEPTIONS.overlaps))})`)) ?? []
    const { rows, fail } = hitJudge([...byKey.values()], overlaps, min)
    writeFileSync(out, JSON.stringify({ url, viewport: '1440x900', pointer, min, count: rows.length, opened, rows, overlaps, fail }, null, 2))
    console.log(JSON.stringify({ url, pointer, count: rows.length, formulaOrFloor: rows.filter((x) => !x.exception).length, exceptions: rows.filter((x) => x.exception).length, opened: opened.length, overlaps: overlaps.length, overlapsAccepted: overlaps.filter((o) => o.exception).length, fail: fail.length }))
    for (const f of fail) console.error(`FAIL ${f}`)
    code = rows.length === 0 ? 1 : fail.length ? 1 : 0
    ws.close()
  } catch (e) { console.error(`도구 실패: ${e.message}`); code = 1; rmSync(out, { force: true }) } finally {
    await chrome?.close()
  }
  process.exit(code)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
