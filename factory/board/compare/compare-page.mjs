// 비교 대시보드 페이지(v0.2.6 T3) — 후보 3개의 실제 사이트를 나란히 보이는 HTML 한 장을 문자열로 만든다. 순수 함수 · 외부 요청 없음(글꼴은 시스템 글꼴).
// 동작은 page-client.js 가 맡는다(여기서는 읽어서 넣기만 한다). 파일·프로세스·소켓은 만지지 않는다 — 그건 serve.mjs 몫이다.
// 페이지는 CSP 로 감싸 내준다(pageCsp): 인라인 script·style 은 해시로만 허용하고, 모양 값(색 칩)은 CSS 클래스로 낸다(style 속성 없음).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLIENT_JS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page-client.js'), 'utf8')
const DEFAULT_WIDTHS = [1440, 768, 390]
const WIDTH_LABEL = { 1440: '데스크톱', 768: '태블릿', 390: '휴대폰' }
const ROWS = [['첫 화면 문장', 'msg'], ['주 행동', 'act'], ['기억에 남는 동작', 'sig'], ['로고', 'logo'], ['솔직한 위험', 'risk']]
const HEX = /^#[0-9a-f]{3,8}$/i

/** HTML 글·속성값에 안전하게 넣는다. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
/** <script type="application/json"> 안에 넣을 JSON — `<` 와 줄 구분 문자를 막는다. */
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const sha256 = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`

const CSS = `
  :root { --bg:#f3f3f1; --panel:#fff; --ink:#17171a; --muted:#5a5a63; --line:#dcdcd7; --accent:#1f4fd8; --ok:#1d7a4a; --warn:#8f5e0e; --bad:#b4232c; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
  button, textarea { font:inherit; }
  button:focus-visible, textarea:focus-visible, summary:focus-visible, input:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
  .bar { position:sticky; top:0; z-index:20; background:var(--panel); border-bottom:1px solid var(--line); padding:12px 20px; display:flex; flex-wrap:wrap; gap:12px 22px; align-items:center; }
  .bar h1 { font-size:18px; margin:0; }
  .brief { color:var(--muted); font-size:14px; }
  .group { display:flex; gap:6px; align-items:center; }
  .group > span { font-size:13px; color:var(--muted); margin-right:2px; }
  .seg button { border:1px solid var(--line); background:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; min-height:36px; }
  .seg button[aria-pressed="true"] { background:var(--ink); color:#fff; border-color:var(--ink); }
  .grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; padding:16px 20px 8px; }
  .grid.focus { grid-template-columns:minmax(0,1fr); }
  .grid.focus .col:not(.on) { display:none; }
  .col { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
  .col.picked { outline:3px solid var(--accent); }
  .head { padding:14px 16px 10px; border-bottom:1px solid var(--line); }
  .head .top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .head h2 { margin:0; font-size:18px; }
  .kind { font-size:12px; color:var(--muted); border:1px solid var(--line); border-radius:99px; padding:1px 8px; white-space:nowrap; }
  .thesis { margin:6px 0 8px; font-size:14px; color:var(--muted); }
  .chips { display:flex; gap:6px; flex-wrap:wrap; align-items:center; font-size:12px; color:var(--muted); }
  .sw { width:18px; height:18px; border-radius:4px; border:1px solid rgba(0,0,0,.15); display:inline-block; }
  .badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .b { font-size:12px; padding:2px 8px; border-radius:99px; background:#f0f0ed; }
  .b.ok { color:var(--ok); } .b.warn { color:var(--warn); } .b.bad { color:var(--bad); }
  .ptitle { margin:6px 0 0; font-size:12px; color:var(--muted); min-height:1.5em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .stage { position:relative; background:#e9e9e6; overflow:hidden; min-height:120px; }
  .stage iframe { position:absolute; top:0; left:0; border:0; transform-origin:0 0; background:#fff; }
  .stage img { display:block; width:100%; height:auto; }
  .stage .nolive { position:absolute; top:8px; left:8px; background:var(--ink); color:#fff; font-size:12px; padding:2px 8px; border-radius:99px; }
  .foot { padding:12px 16px 16px; border-top:1px solid var(--line); display:grid; gap:10px; }
  details summary { cursor:pointer; font-size:14px; }
  details h3 { margin:8px 0 0; font-size:13px; }
  details ul { margin:4px 0 0; padding-left:18px; font-size:13px; color:var(--muted); }
  textarea { width:100%; min-height:56px; border:1px solid var(--line); border-radius:6px; padding:8px; font-size:14px; resize:vertical; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .actions button { border:1px solid var(--line); background:#fff; border-radius:6px; padding:8px 12px; cursor:pointer; min-height:40px; }
  .actions .pick { background:var(--accent); color:#fff; border-color:var(--accent); }
  .actions button:disabled { opacity:.5; cursor:default; }
  .table { margin:8px 20px 24px; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:auto; }
  table { border-collapse:collapse; width:100%; font-size:14px; }
  th, td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; width:180px; }
  .note { margin:0 20px 6px; font-size:13px; color:var(--muted); }
  #status { margin:0 20px 40px; font-size:14px; min-height:1.5em; }
  dialog { border:1px solid var(--line); border-radius:10px; padding:22px; max-width:540px; }
  dialog h2 { margin-top:0; font-size:20px; }
  .memo { color:var(--muted); font-size:14px; }
  @media (max-width:1100px) { .grid { grid-template-columns:minmax(0,1fr); } }
`

/** 색 칩 클래스(.sw-<칸>-<번호>) — style 속성 없이 CSS 클래스로 낸다. 색 값이 아니면 건너뛴다. */
function swatchCss(candidates) {
  return candidates
    .map((c, i) => (c.head?.palette ?? []).map((hex, k) => (HEX.test(hex) ? `.sw-${i}-${k}{background:${hex}}` : '')).join(''))
    .join('')
}

const badge = (cls, text) => `<span class="b ${cls}">${esc(text)}</span>`
function badgesOf(b = {}) {
  const out = []
  if (Number.isInteger(b.aiTell)) out.push(badge(b.aiTell === 0 ? 'ok' : b.aiTell < 5 ? 'warn' : 'bad', `자동 점검 경고 ${b.aiTell}건`))
  if (Number.isInteger(b.qualityN)) out.push(badge(b.qualityN === 0 ? 'ok' : 'bad', `품질 사유 ${b.qualityN}가지`))
  if (Number.isInteger(b.inputN)) out.push(badge(b.inputN === 0 ? 'ok' : 'warn', `입력 대기 ${b.inputN}가지`))
  if (Number.isInteger(b.routesTotal)) out.push(badge(b.routesOpen === b.routesTotal ? 'ok' : 'bad', `${b.routesTotal}쪽 중 ${b.routesOpen ?? 0}쪽 열림`))
  return out.join('')
}
const listOf = (title, items) => (items?.length ? `<h3>${esc(title)}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')

function stageOf(c, route) {
  if (c.origin) return `<div class="stage" data-id="${esc(c.id)}"><iframe title="${esc(c.name)} 미리보기" src="${esc(c.origin)}${esc(route.path)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe></div>`
  const img = c.fallbackImg ? `<img src="${esc(c.fallbackImg)}" alt="${esc(c.name)} 첫 화면 사진">` : ''
  return `<div class="stage" data-id="${esc(c.id)}">${img}<span class="nolive">실사이트 못 띄움</span></div>`
}

function columnOf(c, i, route) {
  const sw = (c.head?.palette ?? []).map((hex, k) => (HEX.test(hex) ? `<span class="sw sw-${i}-${k}" title="${esc(hex)}"></span>` : '')).join('')
  const blockers = listOf('품질 사유', c.blockers?.quality) + listOf('입력 대기', c.blockers?.input)
  return `
  <section class="col" id="col-${esc(c.id)}" data-id="${esc(c.id)}">
    <div class="head">
      <div class="top"><h2>${esc(c.name)}</h2>${c.kind ? `<span class="kind">${esc(c.kind)}</span>` : ''}</div>
      ${c.head?.thesis ? `<p class="thesis">${esc(c.head.thesis)}</p>` : ''}
      <div class="chips">${sw}${c.head?.fonts ? `<span>${esc(c.head.fonts)}</span>` : ''}${c.head?.colorStrategy ? `<span>· ${esc(c.head.colorStrategy)}</span>` : ''}</div>
      <div class="badges">${badgesOf(c.badges)}</div>
      <p class="ptitle" data-title></p>
    </div>
    ${stageOf(c, route)}
    <div class="foot">
      ${blockers ? `<details><summary>공개 전에 남은 것</summary>${blockers}</details>` : ''}
      <textarea aria-label="${esc(c.name)} 메모" placeholder="이 안에 대한 메모(마음에 드는 곳, 고칠 곳)" data-memo="${esc(c.id)}"></textarea>
      <div class="actions">
        <button class="pick" data-pick="${esc(c.id)}">이 안으로 고르기</button>
        <button data-focus="${esc(c.id)}">크게 보기</button>
        ${c.origin ? `<button data-newtab="${esc(c.id)}">새 탭으로 열기</button>` : ''}
      </div>
    </div>
  </section>`
}

/** 비교표 — 값이 하나도 없는 행은 통째로 숨기고, 일부만 없으면 「—」로 둔다. */
function tableOf(candidates) {
  const rows = ROWS.filter(([, key]) => candidates.some((c) => String(c.row?.[key] ?? '').trim()))
  if (!rows.length) return ''
  const head = `<tr><th></th>${candidates.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr>`
  const body = rows.map(([label, key]) => `<tr><th>${esc(label)}</th>${candidates.map((c) => `<td>${esc(c.row?.[key] || '—')}</td>`).join('')}</tr>`).join('')
  return `<div class="table"><table id="cmp">${head}${body}</table></div>`
}

const dialogOf = (sampleLeft) => `
<dialog id="dlg" aria-labelledby="dlgTitle">
  <h2 id="dlgTitle"></h2>
  <p>고르면 이렇게 이어져요.</p>
  <ol>
    <li>고른 안 완성(--pick, 관문 재검사)</li>
    <li>${Number.isInteger(sampleLeft) && sampleLeft > 0 ? `예시 정보 ${sampleLeft}개를 실제 값으로 바꾸기` : '예시 정보를 실제 값으로 바꾸기'}</li>
    <li>마감 리뷰와 고칠 곳(revise)</li>
    <li>전달(deliver, 예시가 남으면 막힘)</li>
  </ol>
  <p id="dlgMemo" class="memo"></p>
  <div class="actions"><button class="pick" id="ok">이 안으로 확정</button><button id="cancel">취소</button></div>
</dialog>`

/**
 * @typedef {{ path: string, label: string }} Route
 * @typedef {{ id: string, name: string, kind?: string, origin?: string, fallbackImg?: string,
 *   head?: { thesis?: string, palette?: string[], fonts?: string, colorStrategy?: string },
 *   badges?: { aiTell?: number, qualityN?: number, inputN?: number, routesOpen?: number, routesTotal?: number },
 *   blockers?: { quality?: string[], input?: string[] }, row?: { msg?: string, act?: string, sig?: string, logo?: string, risk?: string } }} Candidate
 * @param {{ run: string, title?: string, briefLine?: string, routes: Route[], widths?: number[], candidates: Candidate[], scaleNote?: boolean, sampleLeft?: number }} data
 * @returns {string} 완성된 HTML 문서. 후보 origin 은 `http://127.0.0.1:<포트>` 꼴이어야 한다.
 */
export function renderComparePage(data) {
  const { run, routes, candidates } = data
  const widths = data.widths?.length ? data.widths : DEFAULT_WIDTHS
  if (!routes?.length) throw new Error('쪽 목록이 비었다')
  if (!candidates?.length) throw new Error('후보가 없다')
  for (const c of candidates) if (c.origin && !/^http:\/\/127\.0\.0\.1:\d+$/.test(c.origin)) throw new Error(`후보 출처가 127.0.0.1 주소가 아니다: ${c.origin}`)
  const clientData = { run, routes, widths, candidates: candidates.map(({ id, name, origin }) => ({ id, name, origin: origin ?? null })) }
  const style = CSS + swatchCss(candidates)
  const title = data.title ?? '시안 비교'
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${style}</style>
</head>
<body>
<div class="bar">
  <h1>${esc(title)}</h1>
  ${data.briefLine ? `<span class="brief">${esc(data.briefLine)}</span>` : ''}
  <div class="group seg" id="vp"><span>화면 폭</span>${widths.map((w, i) => `<button data-w="${w}" aria-pressed="${i === 0}">${esc(WIDTH_LABEL[w] ?? `${w}px`)}</button>`).join('')}</div>
  <div class="group seg" id="pg"><span>쪽</span>${routes.map((r, i) => `<button data-p="${esc(r.path)}" aria-pressed="${i === 0}">${esc(r.label)}</button>`).join('')}</div>
  <div class="group seg" id="lay"><span>보기</span><button data-l="three" aria-pressed="true">셋 나란히</button><button data-l="focus" aria-pressed="false">하나 크게</button></div>
  <label class="group"><input type="checkbox" id="sync" checked> <span>스크롤 함께</span></label>
</div>
${data.scaleNote === false ? '' : '<p class="note" data-scale>실제 크기로 보여 줘요.</p>'}
<div class="grid" id="grid">${candidates.map((c, i) => columnOf(c, i, routes[0])).join('')}</div>
${tableOf(candidates)}
<p id="status" role="status" aria-live="polite"></p>
${dialogOf(data.sampleLeft)}
<script type="application/json" id="cmp-data">${safeJson(clientData)}</script>
<script>${CLIENT_JS}</script>
</body>
</html>
`
}

/**
 * 이 페이지를 내줄 때 붙일 Content-Security-Policy 값. 인라인 script·style 은 이 HTML 안의 것 그대로의 해시로만 허용한다.
 * @param {string} html renderComparePage 결과
 * @param {string[]} frameOrigins 후보 iframe 출처들
 */
export function pageCsp(html, frameOrigins) {
  const inline = (tag) => [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => sha256(m[1]))
  // 인라인 style 속성은 해시로 허용할 수 없다 — 이 페이지는 마크업에 style 속성을 쓰지 않는다(시험이 지킨다).
  return [
    "default-src 'none'",
    `script-src ${inline('script').join(' ')}`,
    `style-src ${inline('style').join(' ')}`,
    "img-src 'self'",
    "connect-src 'self'",
    `frame-src ${frameOrigins.length ? frameOrigins.join(' ') : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}
