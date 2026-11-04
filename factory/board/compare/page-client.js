// 비교 대시보드 브라우저 쪽 동작(v0.2.6 T3) — compare-page.mjs 가 이 파일을 읽어 HTML 안에 넣는다. 자료는 <script type="application/json" id="cmp-data"> 에서 읽는다.
// 후보 사이트(iframe)와는 postMessage 로만 말한다(규약은 bridge.js 머리). 받을 때는 출처와 source 가 그 후보 iframe 일 때만 믿는다. targetOrigin 은 '*' 가 아니다.
// 서버와는 상대 주소(api/ping · api/pick)로 말한다 — 대시보드 쪽 주소가 /c/<토큰>/ 로 끝나는 구조를 가정하지 않는다.
;(() => {
  const D = JSON.parse(document.getElementById('cmp-data').textContent)
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const grid = $('#grid'), dlg = $('#dlg'), statusEl = $('#status'), syncEl = $('#sync')

  const cols = $$('.col').map((el) => {
    const meta = D.candidates.find((c) => c.id === el.dataset.id)
    const frame = $('iframe', el)
    return { ...meta, el, frame, stage: $('.stage', el), titleEl: $('[data-title]', el), ready: false, path: null, want: null, wantAt: 0 }
  })
  const live = () => cols.filter((c) => c.frame)

  let W = D.widths[0], cur = D.routes[0]?.path ?? '/', focusId = cols[0]?.id, fwd = { from: null, t: 0 }

  // ── 화면 폭 · 배율 ──
  const viewH = (w) => (w >= 1200 ? 900 : w >= 700 ? 1024 : 844)
  function render() {
    let shown = 1
    for (const c of live()) {
      const colW = c.stage.clientWidth || c.el.clientWidth
      if (!colW) continue // 숨은 칸(하나 크게 보기)
      const scale = Math.min(1, colW / W), h = viewH(W)
      c.frame.style.width = W + 'px'
      c.frame.style.height = h + 'px'
      c.frame.style.transform = `scale(${scale})`
      c.frame.style.left = W < colW ? Math.round((colW - W) / 2) + 'px' : '0px'
      c.stage.style.height = Math.round(h * scale) + 'px'
      shown = Math.min(shown, scale)
    }
    const sc = $('[data-scale]')
    if (sc) sc.textContent = shown < 1 ? `지금은 실제 크기의 ${Math.round(shown * 100)}%로 줄여 보여 줘요.` : '지금은 실제 크기로 보여 줘요.'
  }
  const press = (group, attr, val) => $$(`#${group} button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)))

  // ── 후보 iframe 과 말하기 ──
  const post = (c, msg) => { try { c.frame.contentWindow.postMessage({ sb: 1, ...msg }, c.origin) } catch { /* 아직 안 떴다 */ } }
  function direct(c, path) {
    c.want = path; c.wantAt = performance.now()
    if (c.ready) { if (c.path !== path) post(c, { type: 'go', path }) } else c.frame.src = c.origin + path
  }
  function goAll(path) {
    cur = path
    press('pg', 'p', path)
    live().forEach((c) => direct(c, path))
  }
  const isRoute = (p) => D.routes.some((r) => r.path === p)

  addEventListener('message', (e) => {
    const m = e.data
    if (!m || m.sb !== 1) return
    const c = live().find((x) => e.source === x.frame.contentWindow && e.origin === x.origin)
    if (!c) return
    if (m.type === 'nav' || m.type === 'scroll') active = true
    if (m.type === 'title' && typeof m.title === 'string') c.titleEl.textContent = m.title.slice(0, 80)
    else if (m.type === 'nav' && typeof m.path === 'string' && /^\/(?![/\\])/.test(m.path)) {
      c.ready = true
      // 우리가 보낸 이동이 끝나기 전에 옛 문서가 늦게 보고한 쪽은 무시한다(되돌림 방지).
      if (c.want && m.path !== c.want && performance.now() - c.wantAt < 3000) return
      c.want = null
      c.path = m.path
      if (m.path === cur) return
      cur = m.path
      press('pg', 'p', isRoute(m.path) ? m.path : '')
      if (isRoute(m.path)) live().forEach((o) => { if (o !== c) direct(o, m.path) }) // 알려진 쪽만 다른 안에 따라 보낸다
    } else if (m.type === 'scroll' && typeof m.ratio === 'number' && Number.isFinite(m.ratio) && syncEl.checked) {
      const now = performance.now()
      if (fwd.from && fwd.from !== c.id && now - fwd.t < 400) return // 방금 우리가 다른 칸에서 옮긴 결과가 되돌아온 것
      fwd = { from: c.id, t: now }
      const ratio = Math.min(1, Math.max(0, m.ratio))
      live().forEach((o) => { if (o !== c && o.ready) post(o, { type: 'scroll', ratio }) })
    }
  })

  // ── 단추 ──
  $('#vp').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; W = +b.dataset.w; press('vp', 'w', b.dataset.w); render() }
  $('#pg').onclick = (e) => { const b = e.target.closest('button'); if (b) goAll(b.dataset.p) }
  $('#lay').onclick = (e) => { const b = e.target.closest('button'); if (b) setLayout(b.dataset.l) }
  function setLayout(l, id) {
    press('lay', 'l', l)
    grid.classList.toggle('focus', l === 'focus')
    if (l === 'focus') { focusId = id || focusId; cols.forEach((c) => c.el.classList.toggle('on', c.id === focusId)) }
    requestAnimationFrame(render)
  }

  // ── 메모 · 고르기 ──
  const memoKey = (id) => `sitebrew-compare:${D.run}:${id}`
  const memoOf = (id) => $(`[data-memo="${id}"]`)
  for (const c of cols) {
    const t = memoOf(c.id)
    try { t.value = localStorage.getItem(memoKey(c.id)) ?? '' } catch { /* 저장소 막힘 */ }
    t.addEventListener('input', () => { try { localStorage.setItem(memoKey(c.id), t.value) } catch { /* 저장소 막힘 */ } })
  }
  let picking = null
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('button')
    if (!t) return
    if (t.dataset.focus) setLayout('focus', t.dataset.focus)
    else if (t.dataset.newtab) { const c = cols.find((x) => x.id === t.dataset.newtab); window.open(c.origin + (c.path ?? cur), '_blank', 'noopener') }
    else if (t.dataset.pick) {
      picking = cols.find((x) => x.id === t.dataset.pick)
      $('#dlgTitle').textContent = `${picking.name}으로 고를까요?`
      const memo = memoOf(picking.id).value.trim()
      $('#dlgMemo').textContent = memo ? `남긴 메모: ${memo}` : '메모 없이 골라요.'
      dlg.showModal()
    }
  })
  $('#cancel').onclick = () => dlg.close()
  $('#ok').onclick = async () => {
    const id = picking.id, note = memoOf(id).value.trim()
    $('#ok').disabled = true
    try {
      const r = await fetch('api/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pick: id, note }) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      cols.forEach((c) => c.el.classList.toggle('picked', c.id === id))
      $$('[data-pick]').forEach((b) => { b.disabled = true })
      statusEl.textContent = `${picking.name}으로 기록했어요. 터미널로 돌아가면 이어서 진행돼요. 이 탭은 닫아도 돼요.`
      dlg.close()
    } catch (err) {
      statusEl.textContent = `기록하지 못했어요 (${err.message}). 서버가 꺼졌을 수 있어요. 터미널을 확인해 주세요.`
      dlg.close()
    } finally { $('#ok').disabled = false }
  }

  // ── 살아 있음 알림: 서버는 90초 동안 이것이 없으면 후보 서버를 끈다 ──
  // active = 이번 핑 사이에 사람이 만졌나(서버의 「입력 없음」 한도 계산용).
  let active = false
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { active = true }, { passive: true })
  const ping = () => { const body = JSON.stringify({ active }); active = false; fetch('api/ping', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {}) }
  ping()
  setInterval(ping, 10000)

  addEventListener('resize', render)
  render()
  setLayout('three')
})()
