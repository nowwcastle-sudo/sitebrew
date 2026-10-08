// 실제 브라우저 클립보드 검사(P3-4 Task 8) — 복사 버튼이 「복사했어요」라고 말하는 것이 아니라 진짜 클립보드에 기대한 글이 들어가는지 본다.
// 사용: node factory/qa/clipboard-check.mjs <url> --out <dir> [--inapp kakao] [--allow-none]
//       node factory/qa/clipboard-check.mjs --gallery <origin> --out <dir> [--recipe r1-measure] [--blocks a,b]   (COPY_BLOCKS 전부를 갤러리에서)
//   → <dir>/clipboard-check.json { pages: [{ url, block, controls: [{ kind, label, expected, actual, status, reason? }] }], summary }
//   종료: 0 = 쟀고 어긋남 없음 · 1 = 어긋남(wrong-text·no-copy)·기대 글을 못 정함(na)·복사 조절 0개(재지 않음) **또는** 도구 실패(`도구 실패:` — 결과 파일 없음, 이전 파일도 지운다) · 2 = 인자 오류
// 방법: 창이 있는 Chrome(화면 밖 자리 — headed) + CDP 로 클립보드 권한을 준다(Browser.setPermission, 옛 Browser.grantPermissions 는 deprecated 라 실패할 때만).
//   --headless=new 는 쓰지 않는다: 실측(2026-09-30, 이 데스크톱) 화면 없는 Chrome 은 writeText 가 「ok」인데 readText 가 빈 글이고 운영체제 클립보드에도 닿지 않는다 —
//   운영체제 창 포커스가 없어서다. 창이 있고 Page.bringToFront 를 하면 쓰기가 운영체제 클립보드에 닿고 읽기도 된다.
//   Emulation.setFocusEmulationEnabled 로 문서를 포커스된 것으로 두고(readText 는 포커스가 필요하다), 컨트롤마다 ① 표식 글을 클립보드에 써 두고 ② 진짜 마우스 클릭(Input.dispatchMouseEvent —
//   사용자 활성화가 생긴다)을 보낸 뒤 ③ navigator.clipboard.readText() 로 읽어 기대 글과 견준다. 표식 그대로면 「복사 안 됨」, 다른 글이면 「엉뚱한 글」.
// 이 검사는 운영체제 클립보드를 덮어쓴다 — 시작 때 있던 글(텍스트)을 끝에 되돌려 놓는다(글 아닌 내용은 못 돌린다).
// 기대 글은 컨트롤 표지로 정한다: data-copy-text(컨트롤 또는 조상) → [data-copy-link] 는 같은 묶음의 읽기 전용 입력값 → 인앱 안내([data-inapp]) 안 [data-copy-button] 은 페이지 주소 →
//   그 밖의 [data-copy-button] 은 같은 블록의 <address> 글. 못 정하면 na — 통과가 아니라 실패다(A123).
// 카카오 채널(kakaoChannelSubmit — 글을 복사하고 채팅방을 연다)은 폼에 표식 글을 적고 눌러, 클립보드에 그 글이 다 들어갔는지·창이 채널 채팅 주소로 열렸는지 본다(window.open 은 가로채 실제 창은 열지 않는다).
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, navigateAndWait, startChrome } from './cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const SENTINEL = '__wf-clipboard-sentinel__'
export const INAPP_UA = { kakao: 'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 KAKAOTALK 2500000' }

// 복사 기능이 있는 블록 전부(갤러리 id). 새 복사 블록을 만들면 여기에 넣는다 — clipboard-check.test.mjs 가 블록 소스와 이 표가 맞는지 본다.
//   kinds: 그 블록이 낼 컨트롤 종류 · inapp: 인앱 브라우저 UA 로 열어야 나타난다(InAppEscape) · open: 컨트롤이 보이려면 먼저 눌러야 하는 버튼의 글(창·다음 단계)
export const COPY_BLOCKS = [
  { block: 'hours-location-hours-table-map-link', kinds: ['copy-button'] },
  { block: 'referral-invite-panel', kinds: ['copy-link'] },
  { block: 'referral-share-sheet', kinds: ['copy-link'] },
  // 화면에 링크 칸이 없고 버튼 하나가 곧바로 링크를 복사한다(copyText(url)) — 표지가 없어 기대 글을 표에 적는다(fixture 의 INVITE_URL, 시험이 같은지 본다)
  { block: 'referral-success-moment-prompt', kinds: ['press-copy'], press: { text: '초대 링크 보내기', expect: 'https://example.com/invite/K7P2Q9' } },
  { block: 'contact-form-channel-first', kinds: ['kakao-channel'] },
  { block: 'auth-sign-in', kinds: ['copy-button'], inapp: 'kakao' },
  { block: 'auth-sign-up-consents', kinds: ['copy-button'], inapp: 'kakao' },
  { block: 'paywall-upgrade-modal', kinds: ['copy-button'], inapp: 'kakao', open: '요금제 살펴보기' },
  { block: 'trust-payment-trust-panel', kinds: ['copy-button'], inapp: 'kakao' },
]
const KAKAO_BLOCK = 'contact-form-channel-first'
// 컴파일된 갤러리는 cn-block-* 훅 클래스를 유틸리티로 바꿔 클래스가 남지 않는다(실측) — 구조로 찾는다: 채널 목록의 첫 항목 버튼
const KAKAO_BUTTON = '[data-block="contact-form-channel-first"] ul li:first-child button'
const KAKAO_FIELDS = [['input[name="name"]', 'wf-이름-확인'], ['input[name="contact"]', 'wf-check@example.com'], ['textarea[name="message"]', 'wf-문의-내용-확인']]

// ── 페이지 안에서 도는 조각(toString 으로 보낸다) ─────────────────────────
function pageFind() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  window.__wfCopy = [...document.querySelectorAll('[data-copy-button], [data-copy-link]')].filter(vis)
  return window.__wfCopy.map((el, index) => {
    const link = el.hasAttribute('data-copy-link')
    let expected = null, how = null
    const declared = el.closest('[data-copy-text]')
    if (declared) { expected = declared.getAttribute('data-copy-text'); how = 'data-copy-text' }
    else if (link) {
      for (let p = el.parentElement; p && expected === null; p = p.parentElement) { const i = p.querySelector('input[readonly]'); if (i) { expected = i.value; how = 'readonly-input' } }
    } else if (el.closest('[data-inapp]')) { expected = location.href; how = 'page-url' }
    else { const a = el.closest('[data-block]')?.querySelector('address'); if (a) { expected = a.textContent.trim(); how = 'address' } }
    const status = el.closest('div, section, li')?.querySelector('[role="status"]')
    return { index, kind: link ? 'copy-link' : 'copy-button', label: (el.textContent || '').trim().slice(0, 40), expected: expected === '' ? null : expected, how, inapp: !!el.closest('[data-inapp]'), hasStatus: !!status }
  })
}
const centerOf = (expr) => `(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`

// ── CDP 조각 ────────────────────────────────────────────────────────────
async function grantClipboard(port, origin) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) })).json()
  const b = await connect(v.webSocketDebuggerUrl, { timeoutMs: 15000 })
  // 이 브라우저 연결을 검사가 끝날 때까지 열어 둔다 — 권한 덮어쓰기는 연결이 닫히면 되돌려진다(실측: 닫으면 readText 가 답하지 않았다). 부르는 쪽이 close() 한다.
  try {
    // Browser.setPermission 의 descriptor name 은 Permissions API 이름(clipboard-read·clipboard-write). 둘 다 granted.
    const set = async (name, extra = {}) => (await b.send('Browser.setPermission', { permission: { name, ...extra }, setting: 'granted', origin })).error
    const errs = [await set('clipboard-read'), await set('clipboard-write', { allowWithoutSanitization: true })].filter(Boolean)
    if (!errs.length) return { via: 'Browser.setPermission', close: () => b.ws.close() }
    // 폴백: deprecated 지만 같은 뜻(PermissionType clipboardReadWrite·clipboardSanitizedWrite)
    const g = await b.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin })
    if (g.error) throw new Error(`클립보드 권한을 줄 수 없다: ${JSON.stringify(errs[0])} / ${JSON.stringify(g.error)}`)
    return { via: 'Browser.grantPermissions', close: () => b.ws.close() }
  } catch (e) { b.ws.close(); throw e }
}

const readClip = (ev) => ev('navigator.clipboard.readText()')
async function writeSentinel(ev) {
  await ev(`navigator.clipboard.writeText(${JSON.stringify(SENTINEL)}).then(() => 1)`)
  const back = await readClip(ev)
  if (back !== SENTINEL) throw new Error(`클립보드에 쓰고 읽을 수 없다(쓴 값 ${JSON.stringify(SENTINEL)} → 읽은 값 ${JSON.stringify(back)}) — 권한·포커스 문제라 검사할 수 없다`)
}
async function realClick(send, ev, expr) {
  const pt = await ev(centerOf(expr))
  if (!pt) throw new Error(`누를 컨트롤을 찾지 못했다: ${expr}`)
  await sleep(80)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', buttons: 0, clickCount: 1 })
}
// 누른 뒤 클립보드가 표식에서 바뀌기를 기한 안에서 기다린다(복사는 비동기 — 바뀌지 않으면 「복사 안 됨」)
async function afterClick(ev, waitMs = 1500) {
  const until = Date.now() + waitMs
  for (;;) {
    const v = await readClip(ev)
    if (v !== SENTINEL || Date.now() > until) return v
    await sleep(100)
  }
}

// 판정(순수 함수 — 시험이 직접 부른다)
export function judge({ expected, actual }) {
  if (expected === null || expected === undefined) return { status: 'na', reason: '기대하는 글을 정할 수 없다(data-copy-text·읽기 전용 입력·인앱 주소·<address> 없음)' }
  if (actual === SENTINEL) return { status: 'fail', reason: 'no-copy: 눌렀는데 클립보드가 그대로다' }
  if (String(actual).trim() === String(expected).trim()) return { status: 'pass' }
  return { status: 'fail', reason: 'wrong-text: 클립보드에 다른 글이 들어갔다' }
}

async function checkPage(send, ev, { url, block, inapp, open, press }) {
  await ev('window.__wfOpened = []')
  const nav = await navigateAndWait(send, ev, url)
  if (nav.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
  if (String(await ev('location.href')).startsWith('chrome-error://')) throw new Error(`Chrome 오류 페이지가 떴다: ${url}`)
  await ev('document.fonts.ready.then(() => 1)'); await sleep(1200)
  // 컨트롤이 창·다음 단계 안에 있는 블록은 그것을 여는 버튼(글로 찾는다)을 먼저 누른다 — 진짜 클릭이라 열리는 길도 함께 잰다
  if (open) { await realClick(send, ev, `[...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(open)}))`); await sleep(1200) }
  const controls = []
  const found = await ev(`(${pageFind.toString()})()`)
  for (const c of found) {
    await writeSentinel(ev)
    await realClick(send, ev, `window.__wfCopy[${c.index}]`)
    const actual = await afterClick(ev)
    const j = judge({ expected: c.expected, actual })
    controls.push({ kind: c.kind, label: c.label, how: c.how, inapp: c.inapp, expected: c.expected, actual, ...j })
  }
  // 카카오 채널: 폼에 표식 글을 적고 누른다 — 클립보드에 표식이 다 있고, 창은 채널 채팅 주소로 열려야 한다
  if (await ev(`!!document.querySelector(${JSON.stringify(KAKAO_BUTTON)})`)) {
    for (const [sel, text] of KAKAO_FIELDS) {
      if (!(await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.focus(); return true })()`))) continue
      await send('Input.insertText', { text })
    }
    await writeSentinel(ev)
    await realClick(send, ev, `document.querySelector(${JSON.stringify(KAKAO_BUTTON)})`)
    const actual = await afterClick(ev)
    const opened = await ev('window.__wfOpened')
    const label = await ev(`document.querySelector(${JSON.stringify(KAKAO_BUTTON)}).textContent.trim().slice(0, 40)`)
    const missing = KAKAO_FIELDS.map(([, t]) => t).filter((t) => !String(actual).includes(t))
    let j
    if (actual === SENTINEL) j = { status: 'fail', reason: 'no-copy: 눌렀는데 클립보드가 그대로다' }
    else if (missing.length) j = { status: 'fail', reason: `wrong-text: 클립보드에 폼에 적은 글이 빠졌다(${missing.join(', ')})` }
    else if (!opened.some((u) => /^https:\/\/pf\.kakao\.com\/_[A-Za-z0-9]+\/chat$/.test(u))) j = { status: 'fail', reason: `채널 채팅 창이 열리지 않았다(열린 주소: ${JSON.stringify(opened)})` }
    else j = { status: 'pass' }
    controls.push({ kind: 'kakao-channel', label, how: 'form-tokens', inapp: false, expected: KAKAO_FIELDS.map(([, t]) => t), actual, opened, ...j })
  }
  // 표에 기대 글을 적은 「눌러서 바로 복사」 버튼(press-copy)
  if (press) {
    const btn = `[...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(press.text)}))`
    const label = await ev(`(${btn})?.textContent.trim().slice(0, 40) ?? null`)
    if (label === null) controls.push({ kind: 'press-copy', label: press.text, how: 'table-expect', inapp: false, expected: press.expect, actual: null, status: 'fail', reason: `누를 버튼이 없다: ${press.text}` })
    else {
      await writeSentinel(ev)
      await realClick(send, ev, btn)
      const actual = await afterClick(ev)
      controls.push({ kind: 'press-copy', label, how: 'table-expect', inapp: false, expected: press.expect, actual, ...judge({ expected: press.expect, actual }) })
    }
  }
  return { url, block: block ?? null, inapp: inapp ?? null, controls }
}

export const USAGE = '사용: node factory/qa/clipboard-check.mjs <url> --out <dir> [--inapp kakao] [--allow-none]\n' +
  '      node factory/qa/clipboard-check.mjs --gallery <origin> --out <dir> [--recipe r1-measure] [--blocks a,b]\n' +
  '종료: 0 = 쟀고 어긋남 없음 · 1 = 어긋남·na·복사 조절 0개 또는 도구 실패(결과 파일 없음) · 2 = 인자 오류'
export function parseArgs(argv) {
  const a = { recipe: 'r1-measure', allowNone: false }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === '--out') a.out = rest.shift()
    else if (t === '--gallery') a.gallery = rest.shift()
    else if (t === '--recipe') a.recipe = rest.shift()
    else if (t === '--blocks') a.blocks = (rest.shift() ?? '').split(',').filter(Boolean)
    else if (t === '--inapp') a.inapp = rest.shift()
    else if (t === '--allow-none') a.allowNone = true
    else if (t.startsWith('--') || a.url) throw new Error(`알 수 없는 인자: ${t}`)
    else a.url = t
  }
  if (!a.out) throw new Error('--out <dir> 이 없다')
  if (!a.url && !a.gallery) throw new Error('<url> 또는 --gallery <origin> 이 없다')
  if (a.url && a.gallery) throw new Error('<url> 과 --gallery 는 함께 쓸 수 없다')
  if (a.url && !/^https?:\/\//i.test(a.url)) throw new Error(`url 은 http(s):// 로 시작해야 한다(클립보드 API 는 보안 문맥 — localhost·https): ${a.url}`)
  if (a.gallery && !/^https?:\/\//i.test(a.gallery)) throw new Error(`--gallery 는 http(s):// origin: ${a.gallery}`)
  if (a.inapp !== undefined && !INAPP_UA[a.inapp]) throw new Error(`--inapp 은 ${Object.keys(INAPP_UA).join('·')} 중 하나: ${a.inapp}`)
  if (a.blocks) for (const b of a.blocks) if (!COPY_BLOCKS.some((x) => x.block === b)) throw new Error(`COPY_BLOCKS 에 없는 블록: ${b}`)
  if (a.blocks && !a.gallery) throw new Error('--blocks 는 --gallery 와 함께 쓴다')
  return a
}

export function summarize(pages, { allowNone = false } = {}) {
  const all = pages.flatMap((p) => p.controls)
  const count = (s) => all.filter((c) => c.status === s).length
  const empty = pages.filter((p) => !p.controls.length).map((p) => p.block ?? p.url)
  const kindMissing = pages.flatMap((p) => (p.block ? (COPY_BLOCKS.find((b) => b.block === p.block)?.kinds ?? []).filter((k) => !p.controls.some((c) => c.kind === k)).map((k) => `${p.block}:${k}`) : []))
  const summary = { pages: pages.length, controls: all.length, pass: count('pass'), fail: count('fail'), na: count('na'), pagesWithNone: empty, kindsMissing: kindMissing }
  summary.ok = summary.fail === 0 && summary.na === 0 && (allowNone || (empty.length === 0 && kindMissing.length === 0 && all.length > 0))
  return summary
}

export async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`clipboard-check: ${e.message}\n${USAGE}`); return 2 }
  mkdirSync(a.out, { recursive: true })
  const jsonPath = join(a.out, 'clipboard-check.json')
  rmSync(jsonPath, { force: true }) // 재지 못하고 끝나면(도구 실패) 이전 실행의 결과가 남아 읽히지 않게

  const targets = a.gallery
    ? (a.blocks ? COPY_BLOCKS.filter((b) => a.blocks.includes(b.block)) : COPY_BLOCKS).map((b) => ({ url: `${a.gallery.replace(/\/$/, '')}/qa/blocks?b=block-${b.block}&r=${a.recipe}&frame=1`, block: b.block, inapp: b.inapp, open: b.open, press: b.press }))
    : [{ url: a.url, inapp: a.inapp }]
  let chrome, granted, permission, pages = [], previous = null
  try {
    chrome = await startChrome(['--hide-scrollbars', '--window-position=-2400,-2400', '--window-size=1440,900'], { prefix: 'clipboard-check-', headless: false })
    granted = await grantClipboard(chrome.port, new URL(targets[0].url).origin)
    permission = granted.via
    const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setFocusEmulationEnabled', { enabled: true })
    await send('Page.bringToFront')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    // window.open 은 가로채 기록만 한다 — 검사 중에 진짜 창(카카오 채널 등)이 열리지 않게
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__wfOpened = []; window.open = function (u) { window.__wfOpened.push(String(u)); return null }' })
    const baseUa = await ev('navigator.userAgent')
    let lastUa
    for (const t of targets) {
      const ua = t.inapp ? INAPP_UA[t.inapp] : null
      if (ua !== lastUa) { await send('Emulation.setUserAgentOverride', { userAgent: ua ?? baseUa }); lastUa = ua }
      if (previous === null) { await navigateAndWait(send, ev, t.url); previous = (await ev('navigator.clipboard.readText().catch(() => "")')) ?? '' }
      pages.push(await checkPage(send, ev, t))
    }
    // 시작 때 있던 글을 돌려놓는다(글이 아니었으면 빈 글이라 그대로 두는 편이 낫다)
    if (previous) await ev(`navigator.clipboard.writeText(${JSON.stringify(previous)}).then(() => 1, () => 0)`)
    ws.close()
  } catch (e) {
    console.error(`clipboard-check: 측정 없음(도구 실패) — ${e.message}`)
    return 1
  } finally { granted?.close(); await chrome?.close() }

  const summary = summarize(pages, { allowNone: a.allowNone })
  writeFileSync(jsonPath, JSON.stringify({ permission, mode: a.gallery ? 'gallery' : 'url', recipe: a.gallery ? a.recipe : null, pages, summary }, null, 2) + '\n')
  console.log(`clipboard-check: 쪽 ${summary.pages} · 컨트롤 ${summary.controls} — 통과 ${summary.pass} · 실패 ${summary.fail} · na ${summary.na} · 권한 ${permission}`)
  for (const p of pages) for (const c of p.controls) console.log(`  ${c.status === 'pass' ? 'PASS' : c.status.toUpperCase()} ${p.block ?? p.url} [${c.kind}] "${c.label}"${c.reason ? ` — ${c.reason}` : ''}`)
  for (const b of summary.pagesWithNone) console.log(`  NONE ${b} — 복사 조절이 하나도 보이지 않는다(재지 않음 — 통과 아님)`)
  for (const k of summary.kindsMissing) console.log(`  MISSING ${k} — 표가 낸다고 한 컨트롤 종류가 없다`)
  return summary.ok ? 0 : 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = await main(process.argv.slice(2))
