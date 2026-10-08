// 방향 보드(08-board, P3-3 Task 12) — 찍어내기 한 번의 방향 3안(후보 a·b·c)을 운영자가 한 화면에서 보고 하나를 고른다.
//   node factory/board/direction-board/build.mjs <run> [--manifest <촬영 목록.json>] [--out <board.html>] [--publish <폴더>]
//   node factory/board/direction-board/build.mjs <run> --capture [--urls a=<주소>,b=<주소>,c=<주소>]      (후보 첫 화면을 8초 영상·정지로 찍는다 — 서버·Chrome 을 쓰니 관문 잠금 안에서)
// 입력(후보 폴더마다, J7): candidate.json(source·slot·why·recipe·brand·blockers) · 07-qa/summary.json(publishable·blockers·gates) · 08-board.json data.previewUrl(Task 13).
// 카드마다: 출처 배지(검증 = 라이브러리 · 생성 · 브랜드) · 「공개 불가」 사유(blockers 그대로 — 대장 C95) · 브랜드 조정 내역(C23) · 첫 화면 영상·정지(`video.mjs` 를 그대로 쓴다 —
//   후보 사이트 주소를 j.url 로 준다) · 고르기 버튼 · 생성·브랜드 카드에는 「라이브러리로 올리기」 체크(라이브러리 안은 이미 라이브러리에 있어 없다).
// 저장: 아티팩트 db 컬렉션 `picks`, 문서 하나 = 실행 하나(문서 id = 실행 폴더 이름) { run, board: 1, pick, promote: { <후보>: true }, note?, decidedAt }.
//   레시피 보드 v2(build2.mjs)의 저장 규칙을 그대로 지킨다: 확정 읽기(첫 스냅숏·get) 전에는 쓰지 않는다 · 구독이 끊긴 동안은 쌓아 두었다가 다시 읽은 뒤 쓴다 ·
//   있는 문서는 고친 칸만 update(지운 값은 null), 없는 문서만 바로 전에 다시 읽고 set · 같은 값은 다시 쓰지 않는다. 동작 검사 board.behavior.test.mjs(headless Chrome).
// 결선 기록은 이 문서를 컨트롤러가 읽어 record.mjs 로 넘긴다(pairs.jsonl · 승격). 이 파일은 아티팩트를 게시하지 않는다 — 게시는 Task 14.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRun } from '../promote.mjs'
import { artifactHtml } from '../recipe-board/build2.mjs'
import { captureAll, manifestOf, checkManifest, fileNames } from '../recipe-board/video.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { loadCandidates } from './record.mjs'
import { loadRunPrescreen } from '../prescreen.mjs'
import { blockerClass, splitBlockers } from '../../stamp/blocker-class.mjs'

export const COLLECTION = 'picks'
export const BOARD = 1
const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d)

export const SOURCE_LABEL = { library: '검증', generated: '생성', brand: '브랜드' }
export const SOURCE_TITLE = { library: '라이브러리에 이미 있는 검증된 레시피', generated: '찍어내기가 새로 조합해 만든 생성 레시피', brand: '고객 브랜드 입력으로 만든 브랜드 레시피' }
export const SLOT_LABEL = { safe: '무난한 안', new: '새 조합 안', bold: '과감한 안' }
export const PROMOTABLE = ['generated', 'brand']
const AI_PICK_TITLE = 'AI 예선이 사용자의 과거 선택으로 예측한 안 — 참고일 뿐이고, 고르는 것은 사용자입니다'
const SLOT_BY_INDEX = ['safe', 'new', 'bold']
const KEEP_OPEN = 5 // 공개 불가 사유는 이만큼만 펼쳐 두고 나머지는 접는다(전부 DOM 에 있다). 품질 사유가 앞이라 접힘에는 입력 대기가 먼저 든다.
const KIND_LABEL = { quality: '품질 사유', input: '입력 대기' }
const KIND_HINT = { quality: '— 공장이 고칠 것(기계 기준은 0)', input: '— 사용자 자료·결정이 오면 풀림' }

/** 후보 폴더들 → 보드 데이터. manifest = video.mjs manifestOf 결과(없으면 영상·정지 없이 그린다). */
export function loadBoardData(run, { manifest = null, scoreFile } = {}) {
  const runDir = resolveRun(run)
  const brief = readJson(join(runDir, 'brief.json'), {})
  // AI 예선(P3-4 Task 6): 측정에서 켜져 있고 실행 폴더에 예측(prescreen.json)이 있을 때만 값이 있다. 꺼져 있으면 null — 보드는 아무것도 더하지 않는다.
  const prescreen = loadRunPrescreen(runDir, scoreFile ? { scoreFile } : {})
  const cands = loadCandidates(runDir).map((base, i) => {
    const dir = join(runDir, base.id)
    const c = readJson(join(dir, 'candidate.json'))
    const qa = readJson(join(dir, '07-qa', 'summary.json'))
    const b8 = readJson(join(dir, '08-board.json'))
    const blockers = [...new Set([...(c.blockers ?? []), ...(qa?.blockers ?? [])])]
    // 07-qa 가 공개 불가로 판정했는데 사유가 기록되지 않았으면 그것을 사유로 보인다(조용히 「공개 가능」으로 읽히지 않게).
    if (qa && qa.publishable === false && !blockers.length) blockers.push('07-qa 가 공개 불가로 판정했지만 사유가 기록되지 않았다 — 07-qa/summary.json 을 확인한다')
    const state = blockers.length ? 'blocked' : qa?.publishable === true ? 'ready' : 'unknown'
    const gates = (qa?.gates ?? []).reduce((n, g) => ({ ...n, [g.verdict ?? 'pass']: (n[g.verdict ?? 'pass'] ?? 0) + 1 }), {})
    const url = b8?.data?.previewUrl
    const opt = manifest?.options?.find((o) => o.recipe === base.id && o.option === 'A')
    const media = opt ? {
      mp4: opt.videos?.find((v) => v.codec === 'h264')?.file ?? null, webm: opt.videos?.find((v) => v.codec === 'vp9')?.file ?? opt.video?.file ?? null,
      poster: opt.stills?.find((s) => s.width === 1440)?.file ?? null, phone: opt.stills?.find((s) => s.width === 375)?.file ?? null,
    } : null
    return {
      id: base.id, slot: c.slot ?? SLOT_BY_INDEX[i] ?? null, source: base.source, recipe: base.name, preset: c.preset ?? null, palette: c.palette ?? null,
      fonts: c.fonts ?? null, why: c.why ?? null, blockers, state, qa: qa ? { publishable: qa.publishable === true, gates, warnings: (qa.warnings ?? []).length } : null,
      brand: c.brand ? { adjustments: c.brand.adjustments ?? [], fontSubstitutions: c.brand.fontSubstitutions ?? [] } : null,
      previewUrl: typeof url === 'string' && /^https:\/\/[^\s]+$/.test(url) ? url : null, media, aiPick: prescreen?.winner === base.id,
    }
  })
  return { run: basename(runDir), archetype: brief.archetype ?? null, brief: brief.topic ?? null, cands, prescreen: prescreen?.winner ? { winner: prescreen.winner, rate: prescreen.rate, answered: prescreen.answered } : null }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function adjustmentLines(brand) {
  if (!brand) return ''
  const a = brand.adjustments.map((x) => `<li data-adjust="color">${esc(x.role)}${x.theme ? `(${esc(x.theme)})` : ''}: ${esc(x.from ?? '없음')} → ${esc(x.to ?? '쓰지 않음')} — ${esc(x.reason)}</li>`)
  const f = brand.fontSubstitutions.map((x) => `<li data-adjust="font">${esc(x.role)}: ${esc(x.asked)} → ${esc(x.used)} — ${esc(x.reason)}</li>`)
  if (!a.length && !f.length) return '<p class="quiet" data-adjust-none>브랜드 입력을 조정 없이 그대로 썼다.</p>'
  return `<section class="adjust"><h3>브랜드 조정 내역 <span class="n">${a.length + f.length}건</span></h3><ul>${[...a, ...f].join('')}</ul></section>`
}

function publishBlock(c) {
  if (c.state === 'ready') return '<section class="publish ok" data-state="ready"><h3>공개 가능</h3><p>07-qa 관문을 모두 통과했고 막는 사유가 없다.</p></section>'
  if (c.state === 'unknown') return '<section class="publish unknown" data-state="unknown"><h3>공개 여부 확인 안 됨</h3><p>07-qa 를 아직 돌리지 않았다. 관문을 돌린 뒤에야 공개 가능 여부를 알 수 있다.</p></section>'
  // Task 6.1(D19): 사유를 두 갈래로 가른다 — 품질(공장이 고칠 것, 기계 기준은 0)이 먼저, 입력 대기(대표 자료·결정이 오면 풀림)가 뒤. 두 줄 요약은 접히지 않고, 사유 줄은 두 갈래를 이어 앞 5줄만 펼친다.
  const { quality, input } = splitBlockers(c.blockers)
  const kinds = { quality, input }
  const ordered = [...quality, ...input]
  const head = ordered.slice(0, KEEP_OPEN), rest = ordered.slice(KEEP_OPEN)
  const li = (b) => { const k = blockerClass(b); return `<li data-blocker><span class="kind" data-kind="${k}">${KIND_LABEL[k]}</span> ${esc(b)}</li>` }
  const line = (k) => `<p class="kind-line" data-kind-line="${k}"><strong>${KIND_LABEL[k]}</strong> <span class="n">${kinds[k].length}가지</span> <span class="quiet">${KIND_HINT[k]}</span></p>`
  return `<section class="publish blocked" data-state="blocked"><h3>공개 불가 <span class="n">${c.blockers.length}가지</span></h3>${line('quality')}${line('input')}<ul>${head.map(li).join('')}</ul>${rest.length ? `<details><summary>나머지 ${rest.length}가지 보기</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}</section>`
}

function mediaBlock(c) {
  const m = c.media
  if (!m || !(m.mp4 || m.webm)) return `<div class="media empty" data-media="none"><p>첫 화면 영상이 아직 없다 — 촬영 전.${c.previewUrl ? ' 아래 미리보기 주소로 직접 볼 수 있다.' : ''}</p></div>`
  const src = [m.mp4 ? `<source src="video/${esc(m.mp4)}" type="video/mp4">` : '', m.webm ? `<source src="video/${esc(m.webm)}" type="video/webm">` : ''].join('')
  return `<div class="media" data-media="video"><video muted loop playsinline preload="metadata"${m.poster ? ` poster="shots/${esc(m.poster)}"` : ''} aria-label="${esc(c.id.toUpperCase())}안 첫 화면 영상">${src}</video>${m.phone ? `<img class="phone" src="shots/${esc(m.phone)}" alt="${esc(c.id.toUpperCase())}안 휴대폰 첫 화면" width="375" height="812" loading="lazy">` : ''}</div>`
}

function card(c) {
  const up = PROMOTABLE.includes(c.source)
  const label = `${c.id.toUpperCase()}안`
  return `<article class="card" id="card-${esc(c.id)}" data-cand="${esc(c.id)}" data-source="${esc(c.source)}">
    <header><h2><span class="slot">${label}${c.slot ? ` · ${esc(SLOT_LABEL[c.slot] ?? c.slot)}` : ''}</span> <span class="badge b-${esc(c.source)}" title="${esc(SOURCE_TITLE[c.source])}">${esc(SOURCE_LABEL[c.source])}</span>${c.aiPick ? ` <span class="badge b-ai" data-ai-pick title="${esc(AI_PICK_TITLE)}">AI 추천</span>` : ''}</h2>${c.why ? `<p class="why">${esc(c.why)}</p>` : ''}</header>
    ${mediaBlock(c)}
    <dl class="facts"><dt>레시피</dt><dd>${esc(c.recipe)}</dd>${c.preset ? `<dt>출처 프리셋</dt><dd>${esc(c.preset)}</dd>` : ''}${c.palette ? `<dt>팔레트</dt><dd>${esc(c.palette)}</dd>` : ''}${c.fonts ? `<dt>서체</dt><dd>${esc(c.fonts.display ?? '')} / ${esc(c.fonts.body ?? '')}</dd>` : ''}</dl>
    ${adjustmentLines(c.brand)}
    ${publishBlock(c)}
    ${c.qa ? `<p class="qa" data-qa>관문 ${c.qa.gates.pass ?? 0}개 통과 · 판정 실패 ${c.qa.gates.fail ?? 0}개 · 도구 실패 ${c.qa.gates.tool ?? 0}개${c.qa.warnings ? ` · 경고 ${c.qa.warnings}개` : ''}</p>` : ''}
    ${c.previewUrl ? `<p class="preview"><a href="${esc(c.previewUrl)}" target="_blank" rel="noopener noreferrer" data-preview>배포된 미리보기 열기</a></p>` : ''}
    <div class="actions"><button type="button" class="pick" data-pick="${esc(c.id)}" aria-pressed="false">${label}으로 정하기</button>${up ? `<label class="promote"><input type="checkbox" data-promote="${esc(c.id)}"> 라이브러리로 올리기</label>` : ''}</div>
  </article>`
}

const CSS = `
:root { --bg: #f4f5f7; --panel: #fff; --ink: #16181d; --muted: #545a66; --line: #d6d9df; --line-strong: #767c87; --chip: #eceef2; --accent: #1f5f8b; --ok: #1d6b3a; --bad: #9b2c22; --warn: #7a5b00; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #121417; --panel: #1a1d22; --ink: #eceef2; --muted: #a9afba; --line: #343a44; --line-strong: #7d8592; --chip: #242830; --accent: #7fb6dd; --ok: #74cf92; --bad: #ff9387; --warn: #e6c25a; } }
:root[data-theme="dark"] { --bg: #121417; --panel: #1a1d22; --ink: #eceef2; --muted: #a9afba; --line: #343a44; --line-strong: #7d8592; --chip: #242830; --accent: #7fb6dd; --ok: #74cf92; --bad: #ff9387; --warn: #e6c25a; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 "IBM Plex Sans KR", system-ui, sans-serif; }
.wrap { max-width: 1440px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; margin: 0 0 8px; } h2 { font-size: 1.15rem; margin: 0; } h3 { font-size: 1rem; margin: 0 0 6px; }
.intro p { max-width: 70ch; margin: 4px 0; color: var(--muted); }
.bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; background: var(--bg); border-bottom: 1px solid var(--line); padding: 8px 0; margin: 12px 0; }
.bar p { margin: 0; } .status.err, .err { color: var(--bad); }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; display: grid; gap: 12px; }
.card[data-picked="true"] { border: 2px solid var(--accent); }
.slot { font-weight: 700; }
.badge { display: inline-block; font-size: .8rem; font-weight: 700; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--chip); vertical-align: middle; }
.b-library { color: var(--ok); } .b-generated { color: var(--accent); } .b-brand { color: var(--warn); }
.b-ai { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.why, .quiet, .qa, .facts dt { color: var(--muted); } .why { margin: 4px 0 0; font-size: .92rem; }
.media video, .media img.phone { display: block; max-width: 100%; height: auto; border-radius: 6px; background: var(--chip); }
.media video { width: 100%; aspect-ratio: 1440 / 900; } .media img.phone { width: 120px; margin-top: 8px; }
.media.empty p { margin: 0; padding: 32px 16px; background: var(--chip); border-radius: 6px; color: var(--muted); text-align: center; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: .92rem; } .facts dd { margin: 0; word-break: break-all; }
.publish { border-left: 4px solid var(--line-strong); padding: 6px 12px; border-radius: 0 6px 6px 0; background: var(--chip); }
.publish.ok { border-color: var(--ok); } .publish.blocked { border-color: var(--bad); } .publish.unknown { border-color: var(--warn); }
.publish ul, .adjust ul { margin: 4px 0; padding-left: 20px; font-size: .92rem; } .publish p { margin: 0; font-size: .92rem; }
.kind-line { margin: 2px 0; } .kind-line .quiet { font-size: .85rem; }
.kind { display: inline-block; font-size: .78rem; font-weight: 700; padding: 0 6px; border-radius: 999px; border: 1px solid currentColor; margin-right: 4px; }
.kind[data-kind="quality"] { color: var(--bad); } .kind[data-kind="input"] { color: var(--warn); }
.n { font-weight: 400; color: var(--muted); font-size: .85rem; } summary { cursor: pointer; color: var(--accent); }
.actions { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; }
button.pick { font: inherit; min-height: 44px; padding: 0 20px; border-radius: 6px; border: 1px solid var(--accent); background: var(--panel); color: var(--accent); cursor: pointer; font-weight: 700; }
button.pick[aria-pressed="true"] { background: var(--accent); color: var(--bg); }
.promote { display: inline-flex; gap: 8px; align-items: center; min-height: 44px; } .promote input { width: 20px; height: 20px; }
textarea { width: 100%; max-width: 70ch; min-height: 72px; font: inherit; padding: 8px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--panel); color: var(--ink); }
.foot { color: var(--muted); font-size: .88rem; margin-top: 24px; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`

// ── 저장 스크립트: build2.mjs(레시피 보드 v2) 의 규칙을 문서 하나짜리로 옮긴 것. 문자열 안에는 백틱·달러 중괄호·역슬래시를 쓰지 않는다.
const SCRIPT = `
const DATA = JSON.parse(document.getElementById('board-data').textContent);
const COLLECTION = ${JSON.stringify(COLLECTION)};
const BOARD = ${BOARD};
const DOC = DATA.run;
const CANDS = DATA.cands.map((c) => c.id);
const UPPABLE = DATA.cands.filter((c) => c.promotable).map((c) => c.id);
const $ = (s, el = document) => el.querySelector(s);
const clone = (x) => JSON.parse(JSON.stringify(x));
const blank = () => ({ pick: null, promote: {}, note: '' });
let state = blank();
function normalize(v) {
  const o = blank();
  if (v && typeof v === 'object') {
    if (typeof v.pick === 'string' && CANDS.includes(v.pick)) o.pick = v.pick;
    if (v.promote && typeof v.promote === 'object') for (const k of UPPABLE) if (v.promote[k] === true) o.promote[k] = true;
    if (typeof v.note === 'string') o.note = v.note;
  }
  return o;
}
function getPath(s, p) { const a = p.split('.'); return a[1] ? s[a[0]][a[1]] : s[a[0]]; }
function setPath(s, p, v) {
  const a = p.split('.');
  if (a[1]) { if (v) s[a[0]][a[1]] = true; else delete s[a[0]][a[1]]; } else s[a[0]] = v == null ? (p === 'note' ? '' : null) : v;
}
function val(s, p) { const v = getPath(s, p); return p === 'note' ? String(v || '').trim() : (v || null); }
function patchOf(values, at) {
  const o = { decidedAt: at };
  for (const p of Object.keys(values)) { const a = p.split('.'); if (a[1]) { (o[a[0]] || (o[a[0]] = {}))[a[1]] = values[p]; } else o[p] = values[p]; }
  return o;
}
function withValues(base, values) { const s = clone(base); for (const p of Object.keys(values)) setPath(s, p, values[p]); return s; }
function bodyOf(s, at) {
  const b = { run: DOC, board: BOARD, decidedAt: at };
  if (s.pick) b.pick = s.pick;
  if (Object.keys(s.promote).length) b.promote = clone(s.promote);
  if (s.note) b.note = s.note;
  return b;
}
function render() {
  for (const id of CANDS) {
    const card = document.getElementById('card-' + id);
    const on = state.pick === id;
    card.dataset.picked = String(on);
    const b = $('[data-pick]', card);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = id.toUpperCase() + (on ? '안으로 정함 — 다시 누르면 취소' : '안으로 정하기');
    const c = $('[data-promote]', card);
    if (c) c.checked = state.promote[id] === true;
  }
  $('#picked').textContent = state.pick ? '고른 안: ' + state.pick.toUpperCase() + '안' : '아직 고르지 않았습니다';
  const n = $('#note');
  if (document.activeElement !== n && n.value !== state.note) n.value = state.note;
}
function setSave(text, err) { const p = $('#save-status'); p.textContent = text; p.classList.toggle('err', !!err); }
function setStatus(text, err) { const p = $('#db-status'); p.textContent = text; p.classList.toggle('err', !!err); }
const clock = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

// ── 저장: 원격 상태를 확정 읽기(첫 스냅숏·get)로 받은 뒤에만 쓴다. 고친 칸(dirty)은 쓰기가 끝날 때까지 남아 스냅숏 위에 다시 얹힌다.
//   dbState: pending(use 대기) → loading(첫 스냅숏 대기) → ready | blocked(구독이 끊겨 다시 읽는 중 — 쓰지 않는다) | none | readonly
let db = null;
let dbState = 'pending';
const dirty = new Set();
let remote = null, loaded = false, writing = null, noteTimer = null, retryTimer = null, attempts = 0, recheck = false, savedAt = null;
const codeOf = (e) => (e && e.code) || '알 수 없음';
const FATAL = ['revoked', 'quota_exceeded', 'not_granted', 'capability_disabled', 'capability_removed'];
const backoff = (n) => Math.min(30000, 1000 * Math.pow(2, Math.max(0, n - 1))) + Math.floor(Math.random() * 400);
function pending() { return [...dirty].filter((p) => !remote || val(state, p) !== val(remote.s, p)); }
function requestSave() {
  clearTimeout(noteTimer); noteTimer = null;
  attempts = 0;
  if (dbState === 'pending') { setSave('저장 기능을 확인하는 중입니다. 준비되면 바로 저장합니다.'); return; }
  if (dbState === 'loading') { setSave('저장된 답을 읽는 중입니다. 다 읽으면 바로 저장합니다.'); return; }
  if (dbState === 'blocked') { setSave('저장된 답을 다시 읽는 중입니다. 다 읽으면 바로 저장합니다.', true); return; }
  if (dbState === 'none') { setSave('저장되지 않습니다 — 이 화면에서는 저장 기능을 쓸 수 없습니다.', true); return; }
  if (dbState === 'readonly') { setSave('읽기 전용 화면이라 저장하지 않습니다.', true); return; }
  write();
}
function enterReadOnly() {
  if (dbState === 'readonly') return;
  dbState = 'readonly';
  setStatus('읽기 전용 화면입니다. 볼 수는 있지만 고른 것은 저장되지 않습니다.', true);
}
function retryLater(e, text) {
  attempts++;
  if (attempts > 6) { setSave(text + '(' + codeOf(e) + '). 잠시 뒤 다시 눌러 주세요.', true); return; }
  setSave(text + '(' + codeOf(e) + '). 곧 다시 시도합니다.', true);
  clearTimeout(retryTimer); retryTimer = setTimeout(write, backoff(attempts));
}
// 원격 상태를 받는다(스냅숏·get). sure: 서버가 확정한 읽기. 아직 쓰지 않은 내 칸은 새 원격 위에 다시 얹는다(건너뛰고 잊지 않는다).
function acceptRemote(v, sure) {
  const cur = state;
  remote = v ? { s: normalize(v), exists: true } : { s: blank(), exists: false };
  if (sure) loaded = true;
  const s = clone(remote.s);
  for (const p of dirty) setPath(s, p, getPath(cur, p));
  state = s; render();
  const when = v && v.decidedAt;
  if (when && !dirty.size && !writing && when !== savedAt) setSave('저장된 답 · ' + new Date(when).toLocaleString('ko-KR'));
}
async function write() {
  if (dbState !== 'ready') return;
  if (writing) { writing.again = true; return; }
  const w = writing = { again: false };
  clearTimeout(retryTimer);
  try {
    const ref = db.collection(COLLECTION).doc(DOC);
    // 읽은 뒤에만 쓴다: 확정 읽기가 없거나, 문서가 없어 새로 만들(set) 때는 바로 전에 다시 읽는다. 읽지 못하면 쓰지 않는다.
    if (!loaded || !remote || !remote.exists) {
      setSave('저장된 답을 확인하는 중…');
      let snap;
      try { snap = await ref.get(); } catch (e) { retryLater(e, '저장된 답을 읽지 못해 아직 저장하지 않았습니다'); return; }
      acceptRemote(snap && snap.exists ? snap.data() : null, true);
      if (recheck && remote.exists) { enterReadOnly(); setSave('읽기 전용 화면이라 저장하지 않았습니다.', true); return; }
    }
    const paths = pending();
    if (!paths.length) { dirty.clear(); return; }
    const values = {};
    for (const p of paths) values[p] = val(state, p);
    const r = remote, at = new Date().toISOString(), merge = r.exists;
    setSave('저장하는 중…');
    try {
      if (merge) await ref.update(patchOf(values, at));
      else await ref.set(bodyOf(withValues(r.s, values), at));
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument' || code === 'transform_error') {
        // update 는 문서가 사라졌을 때도 invalid_argument — 한 번 다시 읽어 없으면 set, 있으면 읽기 전용.
        if (merge && !recheck) { recheck = true; loaded = false; w.again = true; return; }
        enterReadOnly(); setSave('읽기 전용 화면이라 저장하지 않았습니다.', true); return;
      }
      if (FATAL.indexOf(code) >= 0) { setSave('저장하지 못했습니다(' + code + ').', true); return; }
      retryLater(e, '저장하지 못했습니다'); return;
    }
    recheck = false; attempts = 0; savedAt = at;
    remote = { s: withValues(r.s, values), exists: true };
    for (const p of paths) if (val(state, p) === values[p]) dirty.delete(p);
    setSave('저장했습니다 · ' + clock(at));
  } finally {
    writing = null;
    if (w.again && dbState === 'ready') write();
  }
}
function change(path, value) { setPath(state, path, value); dirty.add(path); render(); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  change('pick', state.pick === b.dataset.pick ? null : b.dataset.pick);
  requestSave();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!el.matches('input[data-promote]')) return;
  change('promote.' + el.dataset.promote, el.checked ? true : null);
  requestSave();
});
document.addEventListener('input', (e) => {
  if (!e.target.matches('#note')) return;
  setPath(state, 'note', e.target.value); dirty.add('note');
  clearTimeout(noteTimer); noteTimer = setTimeout(requestSave, 900);
});
// 스냅숏(컬렉션 전체): 서버가 확정한 것(fromCache 아님)이면 이 문서를 확정으로 받는다 — 스냅숏에 없으면 「없음」으로 확정한다.
// 캐시 스냅숏은 보이기만 하고(있는 문서만) loaded 를 세우지 않는다 — 쓰기 전에 get 으로 다시 읽는다.
const definitive = (snap) => !(snap && snap.metadata && snap.metadata.fromCache);
function applyDocs(snap, sure) {
  const ok = sure || definitive(snap), docs = (snap && snap.docs) || [];
  const d = docs.find((x) => x.id === DOC);
  const v = d && d.exists !== false ? d.data() : null;
  if (!ok && !v) return;
  acceptRemote(v || null, ok);
}
function becomeReady(text) { dbState = 'ready'; setStatus(text); if (dirty.size) write(); }
let subTimer = null, subFails = 0, rereadTimer = null, rereadFails = 0;
function onSnap(snap) {
  if (dbState === 'none') return;
  subFails = 0;
  applyDocs(snap);
  // 첫 스냅숏(또는 끊긴 뒤 다시 읽기) 전에는 준비가 아니다 — 그 전에 고른 것은 여기서 쓴다.
  if ((dbState === 'loading' || dbState === 'blocked') && definitive(snap)) becomeReady('고르면 바로 저장합니다.');
}
function subscribe() {
  clearTimeout(subTimer);
  try { db.collection(COLLECTION).onSnapshot(onSnap, onSnapErr); } catch (e) { onSnapErr(e); }
}
// 구독이 끊기면(오류 콜백은 끝이다) 다시 읽을 때까지 쓰지 않는다. 다시 읽기는 컬렉션 get — 되면 준비, 새 구독은 거듭 끊길수록 천천히 다시 건다.
function onSnapErr(e) {
  if (dbState === 'readonly' || dbState === 'none') return;
  if (codeOf(e) === 'revoked') { dbState = 'none'; setStatus('저장 기능을 더 쓸 수 없습니다. 고른 것은 저장되지 않습니다.', true); return; }
  subFails++;
  dbState = 'blocked';
  setStatus('저장된 답을 읽지 못했습니다(' + codeOf(e) + '). 다시 읽을 때까지 고른 것은 저장하지 않고 쌓아 둡니다.', true);
  reread();
}
async function reread() {
  clearTimeout(rereadTimer);
  let snap;
  try { snap = await db.collection(COLLECTION).get(); }
  catch (e) {
    rereadFails++;
    setStatus('저장된 답을 읽지 못했습니다(' + codeOf(e) + '). 곧 다시 읽습니다 — 그동안 고른 것은 저장하지 않고 쌓아 둡니다.', true);
    rereadTimer = setTimeout(reread, backoff(rereadFails));
    return;
  }
  rereadFails = 0;
  applyDocs(snap, true);
  becomeReady('저장된 답을 다시 읽었습니다. 고르면 바로 저장합니다.');
  subTimer = setTimeout(subscribe, backoff(subFails));
}
// 동작 줄이기면 영상을 멈춘다. 아니면 화면에 보일 때만 재생한다.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const videos = [...document.querySelectorAll('.media video')];
const visible = new WeakSet();
function syncVideo(v) { if (!reduce.matches && visible.has(v)) v.play().catch(() => {}); else v.pause(); }
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => { for (const en of es) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); syncVideo(en.target); } });
  videos.forEach((v) => io.observe(v));
}
reduce.addEventListener('change', () => videos.forEach(syncVideo));
videos.forEach(syncVideo);
render();
(async () => {
  const use = window.claude && window.claude.use;
  const found = use ? await Promise.resolve().then(() => window.claude.use('db')).catch(() => null) : null;
  if (!found) {
    dbState = 'none';
    setStatus('저장 기능을 쓸 수 없는 화면입니다. 고른 것은 저장되지 않습니다.', true);
    if (dirty.size) setSave('저장되지 않습니다 — 이 화면에서는 저장 기능을 쓸 수 없습니다.', true);
    return;
  }
  db = found;
  dbState = 'loading';
  setStatus('저장 기능을 확인했습니다. 저장된 답을 읽는 중입니다.');
  if (dirty.size) setSave('저장된 답을 읽는 중입니다. 다 읽으면 바로 저장합니다.');
  subscribe();
})();
`

export function buildDirectionBoard(data, { generatedAt = '' } = {}) {
  if (!data.cands.length) throw new Error('방향 보드: 후보가 0개다')
  const json = JSON.stringify({ run: data.run, cands: data.cands.map((c) => ({ id: c.id, source: c.source, promotable: PROMOTABLE.includes(c.source) })) }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>방향 보드</title>
<meta name="description" content="찍어내기 방향 ${data.cands.length}안을 첫 화면 영상과 공개 불가 사유로 견주어 하나를 고르는 보드">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="intro">
    <h1>방향 보드</h1>
    <p>${data.archetype ? `원형 ${esc(data.archetype)} · ` : ''}${data.brief ? `브리프 「${esc(data.brief)}」 · ` : ''}실행 ${esc(data.run)}</p>
    <p>세 안의 첫 화면을 견주어 하나를 정해 주세요. 카드의 「공개 불가」 사유는 그 안으로 사이트를 열기 전에 풀어야 할 것입니다 — 사유가 있어도 방향으로는 고를 수 있습니다. 생성·브랜드 안이 마음에 들면 「라이브러리로 올리기」를 체크해 두세요(라이브러리 초안으로 만들어 운영자 확인을 거칩니다).</p>${data.prescreen ? `
    <p data-ai-note>「AI 추천」은 사용자의 과거 선택 ${esc(data.prescreen.answered)}쌍으로 재어 일치율 ${esc(Math.round(data.prescreen.rate * 100))}%였던 예선의 예측입니다. 참고일 뿐이고, 다르게 고르셔도 그 판이 그대로 기록에 쌓입니다.</p>` : ''}
  </header>
  <div class="bar">
    <p class="status" id="db-status" role="status">저장 기능을 확인하는 중입니다.</p>
    <p id="picked" aria-live="polite">아직 고르지 않았습니다</p>
    <p class="status" id="save-status" role="status"></p>
  </div>
  <main class="grid">
  ${data.cands.map(card).join('\n  ')}
  </main>
  <section class="memo"><h2><label for="note">메모(선택)</label></h2><textarea id="note" placeholder="고른 이유나 마음에 걸린 점"></textarea></section>
  <p class="foot">${generatedAt ? `영상·화면 ${esc(generatedAt)} 촬영 · ` : ''}문구는 모두 예시입니다. 고른 결과는 결선 기록(pairs.jsonl)으로 옮겨져 다음 후보 고르기에 쓰입니다.</p>
</div>
<script type="application/json" id="board-data">${json}</script>
<script>
${SCRIPT}
</script>
</body>
</html>
`
}

/** 후보 첫 화면 촬영 작업(video.mjs 그대로 — 후보 사이트 주소를 j.url 로). urls = { <후보 id>: 주소 } — 없으면 08-board.json 의 미리보기 주소. 주소가 없는 후보는 건너뛴다(카드에 「촬영 전」). */
export function candidateJobs(run, urls = {}) {
  const data = loadBoardData(run)
  const heads = loadHeads()
  const runDir = resolveRun(run)
  const jobs = data.cands.flatMap((c) => {
    const url = urls[c.id] ?? c.previewUrl
    if (!url) return []
    const cj = readJson(join(runDir, c.id, 'candidate.json'))
    const head = typeof cj.recipe === 'object' ? cj.recipe : heads.find((h) => h.id === cj.recipe)
    return [{ recipe: c.id, option: 'A', theme: head?.defaultTheme === 'dark' ? 'dark' : 'light', query: '', hero: null, displayKo: null, url, sel: 'main', files: fileNames(c.id, 'A') }]
  })
  if (!jobs.length) throw new Error('촬영할 주소가 있는 후보가 없다 — --urls a=<주소>,… 또는 08-board.json 의 미리보기 주소(Task 13)')
  return jobs
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined }
  const has = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0 }
  const capture = has('--capture'), urlsFlag = flag('--urls'), manifestFlag = flag('--manifest'), outFlag = flag('--out'), publish = flag('--publish')
  const [run] = argv
  if (!run) { console.error('사용: node factory/board/direction-board/build.mjs <run> [--capture [--urls a=…,b=…]] [--manifest f] [--out board.html] [--publish 폴더]'); process.exit(2) }
  try {
    const runDir = resolveRun(run)
    const work = join(runDir, 'direction-board')
    mkdirSync(work, { recursive: true })
    const mf = manifestFlag ?? join(work, 'manifest.json')
    if (capture) {
      const urls = Object.fromEntries((urlsFlag ?? '').split(',').filter(Boolean).map((p) => p.split(/=(.*)/s).slice(0, 2)))
      const jobs = candidateJobs(run, urls)
      const options = await captureAll(jobs, { origin: '', out: work, heroSel: 'main' })
      const m = manifestOf({ origin: '', options })
      writeFileSync(mf, JSON.stringify(m, null, 2) + '\n')
      const problems = checkManifest(m, { expectOptions: jobs.length })
      for (const p of problems) console.error(`문제: ${p}`)
      console.log(`촬영: 파일 ${m.count}개 · ${m.totalMB}MB → ${work}`)
      if (problems.length) process.exit(1)
    }
    const manifest = readJson(mf)
    const data = loadBoardData(run, { manifest })
    const html = buildDirectionBoard(data, { generatedAt: manifest?.generatedAt })
    const out = outFlag ?? join(work, 'board.html')
    writeFileSync(out, html)
    console.log(`방향 보드: 후보 ${data.cands.length}개 · 공개 불가 ${data.cands.filter((c) => c.state === 'blocked').length}개 → ${out}${manifest ? '' : ' (영상 없음 — 촬영 전)'}`)
    if (publish) {
      for (const d of ['shots', 'video']) mkdirSync(join(publish, d), { recursive: true })
      writeFileSync(join(publish, 'direction-board.html'), artifactHtml(html))
      for (const f of manifest?.files ?? []) copyFileSync(join(work, f.file), join(publish, f.kind === 'video' ? 'video' : 'shots', f.file))
      console.log(`게시 묶음: ${publish} (direction-board.html — 뼈대 태그 뺀 게시본. 게시는 컨트롤러가 한다)`)
    }
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exit(1)
  }
}
