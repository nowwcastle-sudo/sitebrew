// ux-gate 「글자 상자 겹침·잘림」 검사(대장 C296) — 골든 local-1 b 에서 한 낱말 히어로의 긴 제목이 오른쪽에서 잘리고 아래 캡션과 겹쳤는데
// ux·a11y·strict 관문이 모두 통과했다: 잘린 글자는 가로 스크롤을 만들지 않고(조상이 overflow clip), 글자 상자끼리 겹침을 재는 검사가 없었다.
//
// textBoxScan(opts) 은 **페이지 안에서** 돈다(ux-gate.mjs 가 `(${textBoxScan})(opts)` 로 보낸다 — 이 파일의 다른 값은 쓰지 않는 자기완결 함수).
//   재는 것: 화면에 보이는 글자 줄 상자(텍스트 노드 Range 의 줄별 사각형, 줄 높이로 줄인다)를 모은다.
//     · 겹침(overlaps): 서로 다른 글 상자(가장 가까운 블록 조상 — 같은 문단·제목 안의 줄·글자끼리는 비교하지 않는다)의 줄 상자가
//       교차 면적이 작은 쪽의 20% 이상이고 가로·세로 3px 이상 겹치면 겹침이다.
//     · 잘림(clipped): 조상 중 overflow hidden/clip 인 상자(스크롤하지 않는 상자)에 글자 줄이 일부만 보이거나, 같은 글 상자의 어떤 줄은 보이는데
//       어떤 줄은 통째로 가려지면(긴 제목의 뒤쪽 글자·낱말이 조상 밖으로 밀려난 경우) 잘린 것이다. 글 상자 전체가 가려진 것(접힌 패널·화면 밖 슬라이드)은 잘림이 아니다.
//       가로는 보이는 비율 92% 미만, 세로는 55% 미만(줄 높이로 줄인 상자 기준 — 행간이 좁은 마스크 안 제목은 통과).
//     겹침은 눈에 보이는 부분끼리 잰다(줄 상자를 overflow hidden/clip 조상 안으로 줄인 뒤 비교 — 말줄임 글이 옆 배지 자리까지 뻗어도 가려진 만큼은 겹침이 아니다).
//   빼는 것(면제 규칙 — 일부러 겹치거나 가린 글):
//     · `[data-clip-ok]` 아래의 글은 잘림에서 뺀다(일부러 오른쪽 끝에서 자르는 제목 목록 등 — 블록이 표지를 단다. 겹침은 그대로 잰다).
//     · `[data-decorative]` 아래의 글, 그리고 `aria-hidden="true"` 아래의 글(장식 층 — 읽기 도구에서 빠진 글). 단 aria-hidden 상자 옆에 **같은 글을 담은 보이지 않는(sr-only) 형제**가 있으면
//       그 상자는 장식이 아니라 같은 글의 시각 사본(글자 쪼개기 제목의 읽기용 원문 + 눈에 보이는 쪼갠 사본)이라 잰다 — 이 조각이 없으면 이 결함의 제목이 면제된다.
//     · 보이지 않는 글(display none·visibility hidden·불투명도 5% 미만·1px 이하 sr-only 상자·clip) · SVG 안의 글(차트·도형 라벨) · 스크립트·스타일.
//     · 떠 있는 층(position fixed·sticky 아래 글 — 내비·토스트·고정 예약 막대는 본문 위에 겹치는 것이 설계)은 겹침에서만 뺀다(잘림은 잰다).
//     · 말줄임(text-overflow ellipsis)·줄 수 제한(-webkit-line-clamp) 글 상자는 잘림에서 뺀다(일부러 자른 글).
//   돌려줌: { textLines, overlaps: [{ a, b, ratio }], clipped: [{ text, tag, axis, visible }] } — 최대 12건씩.
export function textBoxScan(opts) {
  const { overlapMin = 0.2, minPx = 3, maxNodes = 8000, maxHits = 12 } = opts || {}
  const cs = (e) => getComputedStyle(e)
  const norm = (s) => (s || '').replace(/\s+/g, '')
  const BLOCKISH = new Set(['block', 'flex', 'grid', 'list-item', 'flow-root', 'table', 'table-cell', 'table-row', 'table-caption', '-webkit-box'])
  const ownerOf = (el) => { let e = el; while (e && e !== document.body && !BLOCKISH.has(cs(e).display)) e = e.parentElement; return e || document.body }
  // 1px 이하 상자 + overflow 를 가졌거나 clip 이 있는 상자 = 읽기 도구 전용 글(Tailwind sr-only 등)
  const hiddenBox = (e) => { const r = e.getBoundingClientRect(); const s = cs(e); if ((r.width <= 1 || r.height <= 1) && (s.overflow !== 'visible' || s.overflowX !== 'visible')) return true; if (s.clip && s.clip !== 'auto') return true; return /^inset\(\s*50%/i.test(s.clipPath || '') }
  const label = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''}`

  // aria-hidden 상자가 장식인가: 옆에 같은 글을 담은 보이지 않는 형제가 있으면 시각 사본이라 장식이 아니다
  const twinCache = new Map()
  const isVisualTwin = (box) => {
    if (twinCache.has(box)) return twinCache.get(box)
    const mine = norm(box.textContent)
    const twin = !!mine && [...(box.parentElement ? box.parentElement.children : [])].some((s) => s !== box && s.getAttribute('aria-hidden') !== 'true' && hiddenBox(s) && norm(s.textContent) === mine)
    twinCache.set(box, twin)
    return twin
  }

  const lines = []
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = tw.nextNode(), seen = 0; n && seen < maxNodes; n = tw.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue
    seen++
    const el = n.parentElement
    if (!el || el.closest('script,style,noscript,template,svg,canvas')) continue
    // 조상을 한 번 훑으며 보임·장식·떠 있는 층을 가린다
    let opacity = 1, hidden = false, decorative = false, floating = false, ariaRoot = null
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const s = cs(a)
      if (s.display === 'none' || s.visibility === 'hidden') { hidden = true; break }
      opacity *= +s.opacity
      if (hiddenBox(a)) { hidden = true; break }
      if (a.hasAttribute('data-decorative')) decorative = true
      if (a.getAttribute('aria-hidden') === 'true') ariaRoot = a // 가장 바깥 aria-hidden 상자가 남는다
      if (s.position === 'fixed' || s.position === 'sticky') floating = true
    }
    if (hidden || opacity < 0.05) continue
    if (ariaRoot && !isVisualTwin(ariaRoot)) decorative = true
    if (decorative) continue
    const s = cs(el)
    const lh = parseFloat(s.lineHeight)
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue
      const h = Number.isFinite(lh) && lh > 0 ? Math.min(r.height, lh) : r.height
      const top = r.top + (r.height - h) / 2
      lines.push({ l: r.left, r: r.right, t: top, b: top + h, el, owner: ownerOf(el), floating, text: n.nodeValue.trim().slice(0, 40) })
    }
  }

  // ── 가려짐: 스크롤하지 않는 조상(overflow hidden/clip)이 줄 상자를 얼마나 가리는가 + 눈에 보이는 부분 상자(vl·vr·vt·vb) ──
  const clipping = (a, axis) => { const s = cs(a); if (s.display === 'inline') return false; const v = axis === 'x' ? s.overflowX : s.overflowY; return v === 'hidden' || v === 'clip' } // 인라인 상자에는 overflow 가 적용되지 않는다
  for (const ln of lines) {
    let fx = 1, fy = 1
    let vl = ln.l, vr = ln.r, vt = ln.t, vb = ln.b
    for (let a = ln.el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const r = a.getBoundingClientRect()
      const left = r.left + a.clientLeft, top = r.top + a.clientTop
      if (clipping(a, 'x')) { vl = Math.max(vl, left); vr = Math.min(vr, left + a.clientWidth) }
      if (clipping(a, 'y')) { vt = Math.max(vt, top); vb = Math.min(vb, top + a.clientHeight) }
    }
    fx = Math.max(0, vr - vl) / (ln.r - ln.l)
    fy = Math.max(0, vb - vt) / (ln.b - ln.t)
    Object.assign(ln, { fx, fy, vl, vr, vt, vb })
  }

  // ── 겹침: 서로 다른 글 상자의 줄 상자(눈에 보이는 부분끼리 — 말줄임·잘린 글이 가려진 만큼은 겹침이 아니다) ──
  const overlaps = []
  const pairSeen = new Set()
  const seen = lines.filter((x) => !x.floating && x.vr - x.vl > 0 && x.vb - x.vt > 0).sort((x, y) => x.vt - y.vt)
  for (let i = 0; i < seen.length; i++) {
    const p = seen[i]
    for (let j = i + 1; j < seen.length && seen[j].vt < p.vb; j++) {
      const q = seen[j]
      if (q.owner === p.owner) continue
      const ix = Math.min(p.vr, q.vr) - Math.max(p.vl, q.vl)
      const iy = Math.min(p.vb, q.vb) - Math.max(p.vt, q.vt)
      if (ix < minPx || iy < minPx) continue
      const ratio = (ix * iy) / Math.min((p.vr - p.vl) * (p.vb - p.vt), (q.vr - q.vl) * (q.vb - q.vt))
      if (ratio < overlapMin) continue
      const key = p.text + '|' + q.text
      if (pairSeen.has(key)) continue
      pairSeen.add(key)
      overlaps.push({ a: `${label(p.owner)} 「${p.text}」`, b: `${label(q.owner)} 「${q.text}」`, ratio: +ratio.toFixed(2) })
      if (overlaps.length >= maxHits) break
    }
    if (overlaps.length >= maxHits) break
  }

  // ── 잘림: 글 상자(owner)마다 줄이 일부만 보이거나, 어떤 줄은 보이는데 어떤 줄은 통째로 가려진 경우 ──
  const byOwner = new Map()
  for (const ln of lines) {
    if (ln.el.closest('[data-clip-ok]')) continue // 일부러 자른 글(잘리는 제목 목록 등 — 면제 표지)
    const rec = byOwner.get(ln.owner) || { owner: ln.owner, n: 0, visible: 0, hidden: 0, partial: [] }
    rec.n++
    const sx = ln.fx < 0.92 ? (ln.fx <= 0.02 ? 'hidden' : 'partial') : 'visible'
    const sy = ln.fy < 0.55 ? (ln.fy <= 0.02 ? 'hidden' : 'partial') : 'visible'
    if (sx === 'visible' && sy === 'visible') rec.visible++
    else if (sx === 'hidden' || sy === 'hidden') rec.hidden++
    else rec.partial.push({ text: ln.text, axis: sx === 'partial' ? 'x' : 'y', visible: +(sx === 'partial' ? ln.fx : ln.fy).toFixed(2) })
    byOwner.set(ln.owner, rec)
  }
  const clipped = []
  for (const rec of byOwner.values()) {
    const o = cs(rec.owner)
    if (o.textOverflow === 'ellipsis' || (o.webkitLineClamp && o.webkitLineClamp !== 'none')) continue
    if (rec.partial.length) clipped.push({ text: rec.partial[0].text, tag: label(rec.owner), axis: rec.partial[0].axis, visible: rec.partial[0].visible })
    else if (rec.visible && rec.hidden) clipped.push({ text: '(일부 줄이 가려짐)', tag: label(rec.owner), axis: 'x|y', visible: +(rec.visible / rec.n).toFixed(2) })
    if (clipped.length >= maxHits) break
  }
  return { textLines: lines.length, overlaps, clipped }
}

/** 두 번 잰 결과에서 두 번 다 나온 건만 남긴다(등장 연출 도중의 일시적 겹침·잘림을 거른다). */
export function stableText(a, b) {
  const keep = (xs, ys, key) => xs.filter((x) => ys.some((y) => key(y) === key(x)))
  return {
    textLines: Math.min(a.textLines, b.textLines),
    overlaps: keep(a.overlaps, b.overlaps, (o) => `${o.a}|${o.b}`),
    clipped: keep(a.clipped, b.clipped, (c) => `${c.tag}|${c.text}|${c.axis}`),
  }
}

/** ux-gate 실패 줄(해상도 키 k 별). 글 줄을 하나도 못 쟀으면 통과가 아니라 실패다(n/a 는 통과가 아니다). */
export function textBoxFailures(k, t) {
  const f = []
  if (!t || !t.textLines) f.push(`${k}: no text boxes measured (textLines 0)`)
  if (t?.overlaps?.length) f.push(`${k}: text overlap x${t.overlaps.length} — ${t.overlaps.slice(0, 3).map((o) => `${o.a} × ${o.b}`).join(' | ')}`)
  if (t?.clipped?.length) f.push(`${k}: text clipped by ancestor x${t.clipped.length} — ${t.clipped.slice(0, 3).map((c) => `${c.tag} 「${c.text}」 ${c.axis} ${c.visible}`).join(' | ')}`)
  return f
}
