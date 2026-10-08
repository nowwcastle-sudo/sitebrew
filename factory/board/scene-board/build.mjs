// 장면 보드(보드 A2) HTML: node factory/board/scene-board/build.mjs [--manifest .tmp/scene-board/manifest.json] [--out .tmp/scene-board/scene-board.html] [--publish <폴더>] [--strict]
// 운영자가 새 히어로·대담안 장면(블록)과 레시피 초안 r12~r16 의 첫 화면을 **움직이는 영상**(8초)으로 보고 「좋다·별로」(+ 메모)를 답한다. 장면 목록은 jobs.mjs, 영상은 capture.mjs.
// 카드마다: 장면 이름(블록 메타 한국어 한 줄 설명 · 초안은 이름과 분위기) · 대담안 표시 · 영상 · 휴대폰 정지 화면 · 좋다/별로 · 메모. 화면 문구는 한국어, 라이트·다크 두 테마, 375px 에서 가로 스크롤 없음.
// 저장: 아티팩트 db 기능(capabilities {db:{}}) — `await window.claude.use('db')` → 컬렉션 "scenes" · 문서 id = 블록 이름 또는 레시피 id · 모양 { like: "like"|"dislike"|null, note?: string, at: ISO }.
// 저장 규칙은 보드 v2(recipe-board/build2.mjs SCRIPT)와 같다 — 문서마다 확정 읽기(첫 스냅숏·get) 전·구독이 끊긴 동안은 쓰지 않고 쌓아 둔다, 있는 문서는 바뀐 칸만 update,
// 없는 문서만 바로 전에 다시 읽고 set, 스냅숏이 와도 아직 쓰지 않은 내 칸은 그 위에 다시 얹는다, db 가 null 이면 저장했다고 말하지 않는다, invalid_argument 로 거절되면 그 방문은 읽기 전용.
// 브라우저 저장소는 쓰지 않는다. 에셋은 곁에 싣는 상대 경로: `video/<id>.mp4|.webm`(MP4 를 먼저 고른다), `shots/<id>-<1440|375>.webp`.
// --publish <폴더>: scene-board.html(문서 뼈대 태그를 뺀 게시본) + shots/ + video/ 를 모은다(게시는 부모가 한다). 목록의 bytes 와 파일 크기가 다르면 멈춘다.
// --strict: 촬영 안 된 장면이 있으면 종료 1(전체 촬영 뒤 게시 때). 기본은 「촬영 전」 카드로 두고 0.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { artifactHtml } from '../recipe-board/build2.mjs'
import { sceneJobs } from './jobs.mjs'
import { OUT, filesOf } from './capture.mjs'

export { artifactHtml }
export const COLLECTION = 'scenes'
export const SPAN = 8
export const INTRO = '새로 만든 히어로·대담 장면과 레시피 초안의 첫 화면입니다. 영상을 보고 마음에 드는지 「좋다」나 「별로」를 눌러 주세요. 메모는 하고 싶을 때만 남기면 됩니다.'

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// 문서 모양 { like, note?, at } — 메모가 비면 note 칸을 두지 않는다. 페이지 스크립트가 이 함수 원문을 그대로 싣는다(시험과 같은 함수).
export const docShape = (s) => {
  const d = { like: s.like || null }
  const n = String(s.note || '').trim()
  if (n) d.note = n
  d.at = s.at
  return d
}

/** 보드 데이터: 장면(jobs.mjs)마다 이름·표시·파일 이름·촬영 여부. 목록(manifest)에 네 파일이 다 있어야 captured. */
export function sceneBoardData(jobs, manifest = { files: [] }) {
  return jobs.map((j) => {
    const f = filesOf(j.id)
    const has = (file) => manifest.files.some((x) => x.file === file)
    return {
      id: j.id, kind: j.kind, name: j.name, code: j.code, bold: j.bold, boldLabel: j.boldLabel, open: j.open ?? null, theme: j.theme, recipe: j.recipe, scene: j.scene ?? null, tech: j.tech, path: j.path,
      mp4: f.mp4, webm: f.video, poster: f[1440], phone: f[375],
      captured: [f.mp4, f.video, f[1440], f[375]].every(has),
    }
  })
}
export const missingScenes = (data) => data.filter((d) => !d.captured).map((d) => d.id)

const shortOf = (d) => d.id.replace(/^block-/, '')
const list = (a) => (a ?? []).map(esc).join(' · ') || '없음'

function badges(d) {
  return [
    `<span class="badge kind">${d.kind === 'block' ? '새 장면' : '레시피 초안'}</span>`,
    d.bold ? `<span class="badge bold">대담안${d.boldLabel ? ` · ${esc(d.boldLabel)}` : ''}</span>` : '',
    d.kind === 'recipe' ? '<span class="badge draft">초안 — 고른 것만 라이브러리에 들어갑니다</span>' : '',
  ].filter(Boolean).join(' ')
}

function tech(d) {
  const rows = d.kind === 'block'
    ? [['블록', `<code>${esc(d.code)}</code>`], ['붙인 레시피', `<code>${esc(d.recipe)}</code>`], ['배치', `<code>${esc(d.tech.layout)}</code>`], ['원형', list(d.tech.archetypes)], ['모션', list(d.tech.motion)]]
    : [['레시피', `<code>${esc(d.code)}</code>`], ['대표 장면', `<code>${esc(d.scene)}</code>`], ['색 논리', esc(d.tech.colorLogic)], ['모션', esc(d.tech.motion)], ['원형', list(d.tech.archetypes)]]
  return `<details class="tech">
      <summary>기술 정보</summary>
      <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}<div><dt>갤러리 주소</dt><dd><code>${esc(d.path)}</code></dd></div></dl>
    </details>`
}

function card(d, i, all) {
  const prev = all[i - 1], next = all[i + 1]
  const label = `${d.name}`
  const body = d.captured
    ? `<figure class="desk">
      <video poster="shots/${esc(d.poster)}" width="1440" height="900" autoplay muted loop playsinline preload="metadata" aria-label="${esc(label)} 첫 화면 영상 ${SPAN}초">
        <source src="video/${esc(d.mp4)}" type="video/mp4">
        <source src="video/${esc(d.webm)}" type="video/webm">
      </video>
      <button type="button" class="play" data-play aria-label="${esc(label)} 영상 일시정지">일시정지</button>
    </figure>
    <div class="detail">
      <figure class="phone">
        <img src="shots/${esc(d.phone)}" width="375" height="812" loading="lazy" decoding="async" alt="${esc(label)} 휴대폰 첫 화면">
        <figcaption>휴대폰 화면(375)</figcaption>
      </figure>
      <div class="feedback">
        <div class="rate" role="group" aria-label="${esc(label)} 마음에 드나요">
          <p class="q">이 장면은 어떤가요</p>
          <button type="button" class="like" data-like="like" value="like" aria-pressed="false">좋다</button>
          <button type="button" class="like" data-like="dislike" value="dislike" aria-pressed="false">별로</button>
        </div>
        <label class="memo" for="note-${esc(d.id)}">메모(선택) <textarea id="note-${esc(d.id)}" data-note rows="3" placeholder="마음에 드는 점이나 걸리는 점"></textarea></label>
        <p class="save" role="status" data-save>아직 고르지 않았습니다.</p>
      </div>
    </div>`
    : '<p class="pending">촬영 전 — 아직 영상이 없습니다. 촬영(capture.mjs)을 마친 뒤 보드를 다시 만듭니다.</p>'
  return `<article class="card" id="card-${esc(d.id)}" data-scene-id="${esc(d.id)}" aria-labelledby="t-${esc(d.id)}">
    <header class="card-head">
      <p class="no">${i + 1} / ${all.length}</p>
      <h3 id="t-${esc(d.id)}">${esc(d.name)}</h3>
      <p class="badges">${badges(d)}</p>
      <p class="code"><code>${esc(d.code)}</code></p>
    </header>
    ${body}
    ${tech(d)}
    <div class="steps">
      ${prev ? `<a class="step" href="#card-${esc(prev.id)}" data-step="prev">← 이전 · ${esc(shortOf(prev))}</a>` : '<span></span>'}
      ${next ? `<a class="step next" href="#card-${esc(next.id)}" data-step="next">다음 · ${esc(shortOf(next))} →</a>` : '<a class="step next" href="#board-top" data-step="top">처음으로 ↑</a>'}
    </div>
  </article>`
}

const THEME_LIGHT = '--bg: #f4f5f7; --panel: #ffffff; --ink: #16181d; --muted: #545a66; --line: #d6d9df; --line-strong: #767c87; --chip: #eceef2; --accent: #1f5f8b; --like: #1d6b3a; --dislike: #9b2c22;'
const THEME_DARK = '--bg: #121417; --panel: #1a1d22; --ink: #eceef2; --muted: #a9afba; --line: #343a44; --line-strong: #7d8592; --chip: #242830; --accent: #7fb6dd; --like: #74cf92; --dislike: #ff9387;'
export const CSS = `
:root { ${THEME_LIGHT} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${THEME_DARK} color-scheme: dark; } }
:root[data-theme="dark"] { ${THEME_DARK} color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-padding-top: 76px; }
body { background: var(--bg); color: var(--ink); font-family: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; font-size: 16px; line-height: 1.6; margin: 0; padding-inline: 16px; padding-block: 0 48px; }
h1, h2, h3 { text-wrap: balance; line-height: 1.25; margin: 0; overflow-wrap: anywhere; }
code { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; font-size: 0.85em; overflow-wrap: anywhere; }
button, input, textarea { font: inherit; }
.wrap { max-width: 1360px; margin-inline: auto; display: flex; flex-direction: column; gap: 28px; }
main, .group-box { display: flex; flex-direction: column; gap: 28px; min-width: 0; }
.intro { display: flex; flex-direction: column; gap: 8px; padding-block: 32px 0; }
.intro h1 { font-size: 1.75rem; }
.intro p { margin: 0; max-width: 66ch; }
.intro .sub { color: var(--muted); font-size: 0.9375rem; }
.toc ul { display: flex; flex-wrap: wrap; gap: 0 4px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; }
.toc a { color: var(--ink); display: inline-flex; min-height: 44px; align-items: center; padding-inline: 8px; overflow-wrap: anywhere; }
.toc a[data-done="true"]::after { content: " ✓"; color: var(--like); }
.toc a[data-pending="true"] { color: var(--muted); }
.bar { position: sticky; top: 0; z-index: 5; background: var(--panel); border: 1px solid var(--line); padding: 10px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
.bar .count { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
.bar .count span { font-size: 1.25rem; }
.bar .status { margin: 0; color: var(--muted); font-size: 0.875rem; }
.bar .status.err { color: var(--dislike); }
.group { font-size: 1.375rem; }
.group-note { margin: 0; color: var(--muted); font-size: 0.9375rem; max-width: 66ch; }
.card { background: var(--panel); border: 1px solid var(--line); padding: 24px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; }
.card-head .no { margin: 0; color: var(--muted); font-variant-numeric: tabular-nums; font-size: 0.9375rem; }
.card-head h3 { font-size: 1.375rem; flex: 1 1 18rem; }
.badges { margin: 0; flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 6px 8px; }
.badge { display: inline-block; padding: 2px 10px; border: 1px solid var(--line-strong); font-size: 0.875rem; font-weight: 600; }
.badge.bold { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.badge.draft { color: var(--muted); border-style: dashed; font-weight: 400; }
.code { margin: 0; flex-basis: 100%; color: var(--muted); }
.pending { margin: 0; padding: 24px; border: 1px dashed var(--line-strong); color: var(--muted); }
figure { margin: 0; min-width: 0; }
.desk { position: relative; }
.desk video { display: block; width: 100%; height: auto; aspect-ratio: 1440 / 900; background: var(--chip); border: 1px solid var(--line); object-fit: cover; }
.play { position: absolute; inset-inline-end: 10px; inset-block-end: 10px; min-height: 44px; min-width: 44px; padding: 0 14px; border: 0; background: color-mix(in srgb, var(--ink) 82%, transparent); color: var(--panel); font-size: 0.875rem; cursor: pointer; }
.detail { display: grid; gap: 20px 28px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 900px) { .detail { grid-template-columns: 375px minmax(0, 1fr); } }
.phone { display: flex; flex-direction: column; gap: 4px; }
.phone img { display: block; width: min(375px, 100%); height: auto; aspect-ratio: 375 / 812; border: 1px solid var(--line); background: var(--chip); }
.phone figcaption { font-size: 0.875rem; color: var(--muted); }
.feedback { display: flex; flex-direction: column; gap: 16px; min-width: 0; max-width: 40rem; }
.rate { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rate .q { grid-column: 1 / -1; margin: 0; font-weight: 700; }
.like { min-height: 52px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font-weight: 600; font-size: 1.0625rem; cursor: pointer; }
.like[value="like"][aria-pressed="true"] { background: var(--like); border-color: var(--like); color: var(--panel); }
.like[value="dislike"][aria-pressed="true"] { background: var(--dislike); border-color: var(--dislike); color: var(--panel); }
.memo { display: flex; flex-direction: column; gap: 4px; font-size: 0.9375rem; color: var(--muted); }
textarea { color: var(--ink); background: var(--panel); border: 1px solid var(--line-strong); padding: 8px 10px; min-height: 64px; width: 100%; }
.save { margin: 0; font-size: 0.875rem; color: var(--muted); }
.save.err { color: var(--dislike); }
.tech summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--muted); font-size: 0.9375rem; }
.tech dl { margin: 0; display: grid; gap: 2px; font-size: 0.875rem; }
.tech dl div { display: flex; flex-wrap: wrap; gap: 0 8px; }
.tech dt { color: var(--muted); min-width: 6em; }
.tech dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.steps { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
.step { display: inline-flex; align-items: center; min-height: 48px; padding: 0 18px; border: 1px solid var(--line-strong); color: var(--ink); text-decoration: none; font-weight: 600; overflow-wrap: anywhere; }
.step.next { margin-inline-start: auto; }
.foot { margin: 0; font-size: 0.875rem; color: var(--muted); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
@media (max-width: 560px) { .card { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } .play { background: var(--ink); } }
`

// 페이지 스크립트(보드 v2 SCRIPT 의 저장 상태 기계를 장면 문서 { like, note?, at } 에 맞췄다). 최상위 const/let 은 시험이 loaded 같은 값을 직접 읽는다.
export const SCRIPT = `
const DATA = JSON.parse(document.getElementById('board-data').textContent);
const COLLECTION = ${JSON.stringify(COLLECTION)};
const LIKE = ['like', 'dislike'];
const docShape = ${docShape.toString()};
const blank = () => ({ like: null, note: '' });
const state = Object.fromEntries(DATA.map((r) => [r.id, blank()]));
const $ = (s, el = document) => el.querySelector(s);
const cardOf = (id) => document.getElementById('card-' + id);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 답 읽기: 모르는 값은 버린다. ──
function parse(v) {
  const s = blank();
  if (!v || typeof v !== 'object') return s;
  if (LIKE.includes(v.like)) s.like = v.like;
  if (typeof v.note === 'string') s.note = v.note;
  return s;
}
// 고친 칸 하나의 저장 값(비교·쓰기용): 메모는 앞뒤 공백을 뺀 글, 좋다·별로는 값 또는 null(지운 칸).
function val(s, p) { return p === 'note' ? String(s.note || '').trim() : (s.like || null); }
function patchOf(values, at) { return Object.assign({}, values, { at: at }); }
function withValues(base, values) { const s = clone(base); for (const p of Object.keys(values)) s[p] = values[p] == null ? (p === 'note' ? '' : null) : values[p]; return s; }

// ── 영상: 동작 줄이기면 포스터를 보이고 멈춘다(재생 버튼으로만 튼다). 화면 밖 영상은 쉰다. ──
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const videos = [...document.querySelectorAll('.desk video')];
const held = new WeakSet();
const visible = new WeakSet();
function label(v) {
  const b = v.parentElement.querySelector('[data-play]'); const name = v.getAttribute('aria-label').replace(' 첫 화면 영상 ${SPAN}초', '');
  const on = !v.paused;
  b.textContent = on ? '일시정지' : '재생';
  b.setAttribute('aria-label', name + ' 영상 ' + (on ? '일시정지' : '재생'));
}
function want(v) { return !reduce.matches && !held.has(v) && visible.has(v); }
function sync(v) { if (want(v)) v.play().catch(() => {}); else v.pause(); label(v); }
function applyMotion() {
  for (const v of videos) {
    if (reduce.matches) { v.autoplay = false; v.pause(); }
    sync(v);
  }
}
for (const v of videos) { v.addEventListener('play', () => label(v)); v.addEventListener('pause', () => label(v)); }
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); sync(e.target); } }, { rootMargin: '200px 0px' });
  for (const v of videos) io.observe(v);
} else for (const v of videos) visible.add(v);
reduce.addEventListener('change', applyMotion);
applyMotion();

// ── 판정 상태 → 화면 ──
function progress() {
  let n = 0;
  for (const r of DATA) {
    const done = !!state[r.id].like;
    if (done) n++;
    const a = document.querySelector('.toc a[href="#card-' + r.id + '"]'); if (a) a.dataset.done = String(done);
  }
  $('#progress').textContent = String(n);
}
function renderCard(id) {
  const c = cardOf(id), s = state[id];
  for (const b of c.querySelectorAll('[data-like]')) b.setAttribute('aria-pressed', String(s.like === b.value));
  const t = c.querySelector('textarea[data-note]'); if (t && document.activeElement !== t) t.value = s.note;
}
function setSave(id, text, err) { const p = cardOf(id).querySelector('[data-save]'); p.textContent = text; p.classList.toggle('err', !!err); }
function setStatus(text, err) { const p = $('#db-status'); p.textContent = text; p.classList.toggle('err', !!err); }
const clock = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

// ── 저장(보드 v2 규칙): 문서마다 원격 상태를 읽은 뒤에만 쓴다. 고친 칸(dirty)은 쓰기가 끝날 때까지 남아 스냅숏 위에 다시 얹힌다.
//   remote[id] = 마지막으로 안 원격 상태 { s, exists } · loaded[id] = 서버가 확정한 읽기(스냅숏·get)를 받았다.
//   dbState: pending(use 대기) → loading(첫 스냅숏 대기) → ready | blocked(구독이 끊겨 다시 읽는 중 — 쓰지 않는다) | none | readonly ──
let db = null;
let dbState = 'pending';
const dirty = {}, remote = {}, loaded = {}, writing = {}, noteTimers = {}, retryTimers = {}, attempts = {}, recheck = {}, savedAt = {};
const codeOf = (e) => (e && e.code) || '알 수 없음';
const FATAL = ['revoked', 'quota_exceeded', 'not_granted', 'capability_disabled', 'capability_removed'];
const backoff = (n) => Math.min(30000, 1000 * 2 ** Math.max(0, n - 1)) + Math.floor(Math.random() * 400);
function touch(id, path) { (dirty[id] || (dirty[id] = new Set())).add(path); }
// 아직 원격과 다른 내 칸(같은 값은 다시 쓰지 않는다).
function pending(id) { const r = remote[id]; return [...(dirty[id] || [])].filter((p) => !r || val(state[id], p) !== val(r.s, p)); }
function requestSave(id) {
  clearTimeout(noteTimers[id]); delete noteTimers[id];
  attempts[id] = 0;
  if (dbState === 'pending') { setSave(id, '저장 기능을 확인하는 중입니다. 준비되면 바로 저장합니다.'); return; }
  if (dbState === 'loading') { setSave(id, '저장된 답을 읽는 중입니다. 다 읽으면 바로 저장합니다.'); return; }
  if (dbState === 'blocked') { setSave(id, '저장된 답을 다시 읽는 중입니다. 다 읽으면 바로 저장합니다.', true); return; }
  if (dbState === 'none') { setSave(id, '저장되지 않습니다 — 이 화면에서는 저장 기능을 쓸 수 없습니다.', true); return; }
  if (dbState === 'readonly') { setSave(id, '읽기 전용 화면이라 저장하지 않습니다.', true); return; }
  write(id);
}
function enterReadOnly() {
  if (dbState === 'readonly') return;
  dbState = 'readonly';
  setStatus('읽기 전용 화면입니다. 볼 수는 있지만 고른 것은 저장되지 않습니다.', true);
}
function retryLater(id, e, text) {
  attempts[id] = (attempts[id] || 0) + 1;
  if (attempts[id] > 6) { setSave(id, text + '(' + codeOf(e) + '). 잠시 뒤 다시 눌러 주세요.', true); return; }
  setSave(id, text + '(' + codeOf(e) + '). 곧 다시 시도합니다.', true);
  clearTimeout(retryTimers[id]); retryTimers[id] = setTimeout(() => write(id), backoff(attempts[id]));
}
// 원격 상태를 받는다(스냅숏·get). sure: 서버가 확정한 읽기. 아직 쓰지 않은 내 칸은 새 원격 위에 다시 얹는다 — 건너뛰고 잊지 않는다.
function acceptRemote(id, v, sure) {
  const cur = state[id];
  remote[id] = v ? { s: parse(v), exists: true } : { s: blank(), exists: false };
  if (sure) loaded[id] = true;
  const s = clone(remote[id].s); for (const p of (dirty[id] || [])) s[p] = cur[p];
  state[id] = s; renderCard(id);
  const when = v && v.at;
  if (when && !(dirty[id] && dirty[id].size) && !writing[id] && when !== savedAt[id]) setSave(id, '저장된 답 · ' + new Date(when).toLocaleString('ko-KR'));
}
async function write(id) {
  if (dbState !== 'ready') return;
  if (writing[id]) { writing[id].again = true; return; }
  const w = writing[id] = { again: false };
  clearTimeout(retryTimers[id]);
  try {
    const ref = db.collection(COLLECTION).doc(id);
    // 읽은 뒤에만 쓴다: 확정 읽기가 없거나, 문서가 없어 새로 만들(set) 때는 바로 전에 다시 읽는다. 읽지 못하면 쓰지 않는다.
    if (!loaded[id] || !remote[id] || !remote[id].exists) {
      setSave(id, '저장된 답을 확인하는 중…');
      let snap;
      try { snap = await ref.get(); } catch (e) { retryLater(id, e, '저장된 답을 읽지 못해 아직 저장하지 않았습니다'); return; }
      acceptRemote(id, snap && snap.exists ? snap.data() : null, true);
      if (recheck[id] && remote[id].exists) { enterReadOnly(); setSave(id, '읽기 전용 화면이라 저장하지 않았습니다.', true); return; }
    }
    const paths = pending(id);
    if (!paths.length) { if (dirty[id]) dirty[id].clear(); return; }
    const values = Object.fromEntries(paths.map((p) => [p, val(state[id], p)]));
    const r = remote[id], at = new Date().toISOString(), merge = r.exists;
    setSave(id, '저장하는 중…');
    try {
      if (merge) await ref.update(patchOf(values, at));
      else { const body = docShape(Object.assign({}, withValues(r.s, values), { at: at })); await ref.set(body); }
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument' || code === 'transform_error') {
        // update 는 문서가 사라졌을 때도 invalid_argument — 한 번 다시 읽어 없으면 set, 있으면 읽기 전용.
        if (merge && !recheck[id]) { recheck[id] = true; loaded[id] = false; w.again = true; return; }
        enterReadOnly(); setSave(id, '읽기 전용 화면이라 저장하지 않았습니다.', true); return;
      }
      if (FATAL.includes(code)) { setSave(id, '저장하지 못했습니다(' + code + ').', true); return; }
      retryLater(id, e, '저장하지 못했습니다'); return;
    }
    recheck[id] = false; attempts[id] = 0; savedAt[id] = at;
    remote[id] = { s: withValues(r.s, values), exists: true };
    for (const p of paths) if (val(state[id], p) === values[p]) dirty[id].delete(p);
    setSave(id, '저장했습니다 · ' + clock(at));
  } finally {
    delete writing[id];
    if (w.again && dbState === 'ready') write(id);
  }
}
function change(id, path, value) {
  state[id][path] = path === 'note' ? value : (value || null); touch(id, path);
  renderCard(id); progress();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-like]');
  if (b) { const id = b.closest('.card').dataset.sceneId; change(id, 'like', state[id].like === b.value ? null : b.value); requestSave(id); return; }
  const p = e.target.closest('[data-play]');
  if (p) { const v = p.parentElement.querySelector('video'); if (v.paused) { held.delete(v); v.play().catch(() => {}); } else { held.add(v); v.pause(); } }
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.matches('textarea[data-note]')) return;
  const id = el.closest('.card').dataset.sceneId;
  change(id, 'note', el.value);
  clearTimeout(noteTimers[id]); noteTimers[id] = setTimeout(() => requestSave(id), 900);
});
// 스냅숏(컬렉션 전체): 서버가 확정한 것(fromCache 아님)이면 문서마다 loaded — 스냅숏에 없는 문서는 「없음」으로 확정한다.
// 캐시 스냅숏은 보이기만 하고(있는 문서만) loaded 를 세우지 않는다 — 쓰기 전에 get 으로 다시 읽는다.
const definitive = (snap) => !(snap && snap.metadata && snap.metadata.fromCache);
function applyDocs(snap, sure) {
  const ok = sure || definitive(snap), docs = (snap && snap.docs) || [];
  for (const r of DATA) {
    const d = docs.find((x) => x.id === r.id);
    const v = d && d.exists !== false ? d.data() : null;
    if (!ok && !v) continue;
    acceptRemote(r.id, v || null, ok);
  }
  progress();
}
function flush() { for (const id of Object.keys(dirty)) if (dirty[id].size) write(id); }
function becomeReady(text) { dbState = 'ready'; setStatus(text); flush(); }
let subTimer = null, subFails = 0, rereadTimer = null, rereadFails = 0;
function onSnap(snap) {
  if (dbState === 'none') return;
  subFails = 0;
  applyDocs(snap);
  // 첫 스냅숏(또는 끊긴 뒤 다시 읽기) 전에는 준비가 아니다 — 그 전에 고른 것은 여기서 한꺼번에 쓴다.
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
DATA.forEach((r) => renderCard(r.id)); progress();
(async () => {
  const use = window.claude && window.claude.use;
  const found = use ? await Promise.resolve().then(() => window.claude.use('db')).catch(() => null) : null;
  if (!found) {
    dbState = 'none';
    setStatus('저장 기능을 쓸 수 없는 화면입니다. 고른 것은 저장되지 않습니다.', true);
    for (const id of Object.keys(dirty)) if (dirty[id].size) setSave(id, '저장되지 않습니다 — 이 화면에서는 저장 기능을 쓸 수 없습니다.', true);
    return;
  }
  db = found;
  dbState = 'loading';
  setStatus('저장 기능을 확인했습니다. 저장된 답을 읽는 중입니다.');
  for (const id of Object.keys(dirty)) if (dirty[id].size) setSave(id, '저장된 답을 읽는 중입니다. 다 읽으면 바로 저장합니다.');
  subscribe();
})();
`

// 다음 판(2차 …)은 1차 판정 뒤 바뀐 장면만 다시 묻는다 — 고른 id 만 보드 순서대로 남긴다. 목록에 없는 id 는 오타라 멈춘다.
export function pickScenes(data, only) {
  if (!only?.length) return data
  const ids = new Set(data.map((d) => d.id))
  const bad = only.filter((id) => !ids.has(id))
  if (bad.length) throw new Error(`장면 목록에 없는 id: ${bad.join(', ')}`)
  return data.filter((d) => only.includes(d.id))
}
const ROUND_INTRO = (n) => `${n - 1}차 판정 뒤 바뀐 장면만 다시 묻습니다. 영상을 보고 「좋다」나 「별로」를 눌러 주세요. 메모는 하고 싶을 때만 남기면 됩니다.`

export function buildSceneBoard(data, { generatedAt = '', round = 1 } = {}) {
  const title = round > 1 ? `장면 보드 A2 · ${round}차` : '장면 보드 A2'
  const rateable = data.filter((d) => d.captured)
  const json = JSON.stringify(rateable.map((d) => ({ id: d.id, name: d.name }))).replace(/</g, '\\u003c')
  const blocks = data.filter((d) => d.kind === 'block'), drafts = data.filter((d) => d.kind === 'recipe')
  const idx = new Map(data.map((d, i) => [d.id, i]))
  const group = (gid, title, note, items) => (items.length ? `<section class="group-box" aria-labelledby="g-${gid}">
    <h2 class="group" id="g-${gid}">${esc(title)}</h2>
    <p class="group-note">${esc(note)}</p>
    ${items.map((d) => card(d, idx.get(d.id), data)).join('\n  ')}
  </section>` : '')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="새 히어로·대담 장면 ${blocks.length}개와 레시피 초안 ${drafts.length}벌을 움직이는 첫 화면으로 보고 좋다·별로를 고르는 보드">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap" id="board-top">
  <header class="intro">
    <h1>${esc(title)}</h1>
    <p>${round > 1 ? ROUND_INTRO(round) : INTRO}</p>
    ${round > 1 ? '<p class="sub">대담안 표시는 움직임이나 배치·서체로 일부러 크게 벌린 장면입니다.</p>' : `<p class="sub">대담안 표시는 움직임이나 배치·서체로 일부러 크게 벌린 장면입니다. 레시피 초안은 고른 것만 「운영자 확인 전」 표시를 지우고 라이브러리에 넣습니다. 카드 아래 「다음」으로 하나씩 넘어갈 수 있습니다.</p>`}
    <nav class="toc" aria-label="장면 바로 가기"><ul>${data.map((d, i) => `<li><a href="#card-${esc(d.id)}" data-done="false"${d.captured ? '' : ' data-pending="true"'}>${i + 1}. ${esc(shortOf(d))}${d.captured ? '' : ' (촬영 전)'}</a></li>`).join('')}</ul></nav>
  </header>
  <div class="bar">
    <p class="count" aria-live="polite"><span id="progress">0</span>/${rateable.length} 장면 판정</p>
    <p class="status" id="db-status" role="status">저장 기능을 확인하는 중입니다.</p>
  </div>
  <main>
  ${group('scenes', '새 히어로·대담 장면', '블록 갤러리에서 레시피 하나를 붙여 찍은 첫 화면입니다.', blocks)}
  ${round > 1 ? group('drafts', '레시피 r12~r16 — 바뀐 첫 화면', '1차에서 고른 레시피의 첫 화면 히어로를 바꿨습니다. 바뀐 첫 화면이 마음에 드는지 봐 주세요.', drafts) : group('drafts', '레시피 초안 r12~r16', '운영자 확인 전 초안의 대표 장면입니다.', drafts)}
  </main>
  <p class="foot">영상·화면 ${generatedAt ? `${esc(generatedAt)} 촬영` : '촬영 시각 확인 안 됨'} · 문구는 모두 예시입니다. 실사 사진·영상은 상업 사용이 허락된 자료이고 출처는 저장소의 출처 목록에 있습니다.</p>
</div>
<script type="application/json" id="board-data">${json}</script>
<script>
${SCRIPT}
</script>
</body>
</html>
`
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
  const strict = argv.includes('--strict')
  const mf = flag('--manifest', join(OUT, 'manifest.json'))
  const out = flag('--out', join(OUT, 'scene-board.html'))
  const publish = flag('--publish', null)
  const only = flag('--only', null)?.split(',').map((x) => x.trim()).filter(Boolean) ?? null
  const round = Number(flag('--round', '1'))
  try {
    if (!existsSync(mf)) throw new Error(`${mf} 가 없다 — 먼저 capture.mjs`)
    const manifest = JSON.parse(readFileSync(mf, 'utf8'))
    const dir = dirname(mf)
    // 목록의 크기와 실제 파일이 다르면(도중에 실패한 촬영이 일부만 덮은 경우) 보드를 만들지 않는다.
    const stale = manifest.files.filter((f) => !existsSync(join(dir, f.file)) || statSync(join(dir, f.file)).size !== f.bytes).map((f) => f.file)
    if (stale.length) throw new Error(`목록과 다른 파일 ${stale.length}개(${stale.slice(0, 5).join(', ')}) — capture.mjs 를 다시 돌린다`)
    if (!Number.isInteger(round) || round < 1) throw new Error(`--round 는 1 이상 정수다: ${round}`)
    const data = pickScenes(sceneBoardData(sceneJobs(), manifest), only)
    const missing = missingScenes(data)
    if (strict && missing.length) throw new Error(`촬영 전 장면 ${missing.length}개: ${missing.join(', ')}`)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, buildSceneBoard(data, { generatedAt: manifest.generatedAt, round }))
    console.log(`장면 보드: 장면 ${data.length}개(촬영됨 ${data.length - missing.length}${missing.length ? ` · 촬영 전 ${missing.length}` : ''}) → ${out} (파일 ${manifest.count}개 · ${manifest.totalMB}MB)`)
    if (publish) {
      for (const d of ['shots', 'video']) mkdirSync(join(publish, d), { recursive: true })
      writeFileSync(join(publish, 'scene-board.html'), artifactHtml(buildSceneBoard(data, { generatedAt: manifest.generatedAt, round })))
      const keep = new Set(data.map((d) => d.id))
      for (const f of manifest.files.filter((x) => keep.has(x.recipe))) copyFileSync(join(dir, f.file), join(publish, f.kind === 'video' ? 'video' : 'shots', f.file))
      console.log(`게시 묶음: ${publish} (scene-board.html — 뼈대 태그 뺀 게시본 + shots ${manifest.files.filter((f) => keep.has(f.recipe) && f.kind === 'still').length} + video ${manifest.files.filter((f) => keep.has(f.recipe) && f.kind === 'video').length}). 게시는 부모가 한다`)
    }
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    process.exit(1)
  }
}
