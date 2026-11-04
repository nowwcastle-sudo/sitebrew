// 비교 대시보드 bridge(v0.2.6 T3) — 중계(proxy.mjs)가 후보 사이트 HTML 의 `</head>` 앞에 `<script src="/__sitebrew/bridge.js">` 로 넣는다. 사이트 파일에는 없다.
// iframe 안에서만 일한다(창 최상위로 열면 아무것도 하지 않는다). 대시보드와는 postMessage 로만 말한다.
//   보냄: { sb:1, type:'nav', path } · { sb:1, type:'scroll', ratio } · { sb:1, type:'title', title }
//   받음: { sb:1, type:'go', path }  · { sb:1, type:'scroll', ratio }
// 부모 출처는 아래 자리표시자 값 하나만 믿는다 — 중계가 이 파일을 내줄 때 대시보드 출처(bridge-source.mjs)를 박는다.
// (document.referrer 는 안쪽 링크로 이동하면 앞 쪽 주소로 바뀌어 쓸 수 없다.) targetOrigin 은 '*' 가 아니다.
// Next 클라이언트 이동은 load 이벤트가 없다 → history.pushState·replaceState 를 감싸고, popstate 를 듣고, 마지막으로 주소를 400ms 마다 본다.
;(() => {
  const DASH = '__SITEBREW_DASHBOARD_ORIGIN__'
  if (window.parent === window || window.__sitebrewBridge) return
  window.__sitebrewBridge = true

  const send = (msg) => { try { window.parent.postMessage({ sb: 1, ...msg }, DASH) } catch { /* 부모가 사라졌다 */ } }
  const doc = () => document.scrollingElement || document.documentElement

  // ── 쪽 이동 · 제목 ──
  let lastPath = null, lastTitle = null
  const sendTitle = () => { if (document.title !== lastTitle) { lastTitle = document.title; send({ type: 'title', title: lastTitle }) } }
  const sendNav = () => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; send({ type: 'nav', path: lastPath }) }
    sendTitle()
  }
  for (const k of ['pushState', 'replaceState']) {
    const orig = history[k]
    history[k] = function (...args) { const r = orig.apply(this, args); setTimeout(sendNav, 0); return r }
  }
  addEventListener('popstate', sendNav)
  addEventListener('hashchange', sendNav)
  addEventListener('DOMContentLoaded', sendNav)
  addEventListener('load', sendNav)
  setInterval(sendNav, 400)
  sendNav()

  // ── 스크롤: 비율로 주고받는다(쪽 높이가 열마다 달라도 같은 자리를 가리킨다). 받아서 움직인 직후의 스크롤 이벤트는 되돌려 보내지 않는다. ──
  let quietUntil = 0, queued = false
  addEventListener('scroll', () => {
    if (queued || performance.now() < quietUntil) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      const d = doc(), max = d.scrollHeight - window.innerHeight
      send({ type: 'scroll', ratio: max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0 })
    })
  }, { passive: true })

  // ── 받기 ──
  addEventListener('message', (e) => {
    if (e.origin !== DASH || e.source !== window.parent) return
    const m = e.data
    if (!m || m.sb !== 1) return
    if (m.type === 'go' && typeof m.path === 'string' && /^\/(?![/\\])/.test(m.path) && m.path !== location.pathname) location.assign(m.path)
    else if (m.type === 'scroll' && typeof m.ratio === 'number' && Number.isFinite(m.ratio)) {
      const d = doc(), max = d.scrollHeight - window.innerHeight
      quietUntil = performance.now() + 250
      window.scrollTo(0, Math.round(Math.min(1, Math.max(0, m.ratio)) * Math.max(0, max)))
    }
  })
})()
