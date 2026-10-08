// 레시피 보드 HTML: node factory/board/recipe-board/build.mjs [--manifest .tmp/board/manifest.json] [--out factory/board/recipe-board/board.html]
// claude.ai 아티팩트로 게시하는 한 장짜리 페이지(컨트롤러가 게시한다 — 이 스크립트는 파일만 만든다). 스크린샷은 게시 때 files 로
// 곁에 싣는다: 페이지는 `shots/<파일>`을 상대 경로로 부른다(.tmp/board/<파일> → shots/<파일>).
// 운영자가 레시피마다 판정(승인·반려·수정)과 A/B(레지스트리 alternateCombos 의 조합만 — recipe.mjs validCombos)를 고르고 메모를 적는다.
// 저장: 아티팩트 db 기능(capabilities {db:{}}) — `await window.claude.use("db")` → collection "decisions" · 문서 id = 레시피 id ·
//   { recipe, verdict, axisPicks, note?, decidedAt } (계획 Task 8 Interfaces). 브라우저 저장소는 쓰지 않는다(Review Focus 5).
// 분포 계수기: 지금 고른 값으로 다시 센다 — recipes-diversity.mjs 의 tallyDistribution·limitsFor 소스를 그대로 싣고(Function.toString),
//   선택지마다 분류(골격·K6~8·다크·M3·M0)는 여기서 미리 계산한다(색 계산을 브라우저에 옮기지 않는다). 반려한 레시피는 세지 않는다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALT_AXES, applyAlternate, validCombos, COLOR_LOGIC_LABEL, DYNAMICS, SCENES } from '../../scripts/recipe.mjs'
import { classifyHead, tallyDistribution, limitsFor, BASE, TARGET } from '../../scripts/recipes-diversity.mjs'
import { loadHeads, themesFor, ROOT, OUT } from './jobs.mjs'

export const QUESTION = '이 레시피로 고객 사이트를 찍어도 되겠나?'
export const COMMON_LABEL = '모든 레시피 공통 견본'
export const AXIS_LABEL = { colorLogic: '색 논리', motion: '모션', dynamics: '역동 기법', fonts: '제목 서체' }
const STYLE_AXIS = { button: '버튼', input: '입력', surface: '표면', table: '표', header: '머리', radius: '반경', shadow: '그림자' }
export const comboKey = (picks) => ALT_AXES.filter((k) => picks.includes(k)).join('+')

// AI 티 점수: docs/qa/ai-tell-baseline.md 레시피 표의 마지막 줄(레시피마다 가장 최근 측정).
export function aiTellScores(md) {
  const out = {}
  for (const m of md.matchAll(/^\|\s*(r\d+-[a-z]+)[^|]*\|[^|]*\|\s*\*\*(\d+)\*\*/gm)) out[m[1]] = Number(m[2])
  return out
}

// fonts(Task 10c): A 값은 머리 fonts 전체, B 값은 alternates.fonts — 둘 다 제목 서체(display·displayKo)만 보인다.
const valueText = (axis, v) => (axis === 'colorLogic' ? `${v} ${COLOR_LOGIC_LABEL[v] ?? ''}`.trim() : axis === 'dynamics' ? (v ?? []).map((d) => DYNAMICS[d]?.label ?? d).join(' · ')
  : axis === 'fonts' ? ['display', 'displayKo'].map((k) => v?.[k]?.family).filter(Boolean).join(' · ') : v)

// 보드 데이터(페이지에 JSON 으로 싣는다).
export function boardData(heads, manifest = { shots: [] }, ai = {}) {
  return heads.map((h) => {
    const bAxes = h.alternates ? ALT_AXES.filter((k) => h.alternates[k] !== undefined) : []
    const combos = h.alternates ? validCombos(h) : []
    const classes = { '': classifyHead(h) }
    for (const picks of combos) classes[comboKey(picks)] = classifyHead(applyAlternate(h, picks))
    const shots = manifest.shots.filter((s) => s.recipe === h.id)
    return {
      id: h.id, name: h.name, mood: h.mood, axes: h.axes, motion: h.motion, colorLogic: h.colorLogic, defaultTheme: h.defaultTheme ?? 'light',
      dynamics: h.dynamics, fonts: Object.fromEntries(Object.entries(h.fonts).filter(([, f]) => f).map(([k, f]) => [k, f.family])),
      archetypes: h.archetypes, archetypeConditions: h.archetypeConditions ?? {}, aiTell: ai[h.id] ?? null,
      signature: h.signature ?? [], themes: themesFor(h),
      alt: h.alternates ? { note: h.alternates.note, axes: Object.fromEntries(bAxes.map((k) => [k, { A: valueText(k, h[k]), B: valueText(k, h.alternates[k]) }])) } : null,
      bAxes, combos: combos.map((p) => ({ key: comboKey(p), picks: p, whole: p.length === bAxes.length })), classes,
      shots: shots.map((s) => ({ file: s.file, option: s.option, kind: s.kind, scene: s.scene, width: s.width, theme: s.theme, w: s.w, h: s.h })),
    }
  })
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const comboLabel = (c) => (c.whole ? `B 전체(${c.picks.map((k) => AXIS_LABEL[k]).join('·')})` : `${c.picks.map((k) => AXIS_LABEL[k]).join('·')}만 B`)
const img = (r, s, alt) => `<img src="shots/${esc(s.file)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async" alt="${esc(alt)}" data-kind="${s.kind}" data-option="${s.option}" data-scene="${esc(s.scene ?? '')}">`

function card(r) {
  const first = { width: 1440, theme: r.themes[0] }
  const pick = (kind, option, scene) => r.shots.find((s) => s.kind === kind && s.option === option && (s.scene ?? null) === (scene ?? null) && s.width === first.width && s.theme === first.theme)
  const sceneRows = r.signature.map((sc) => {
    const a = pick('scene', 'A', sc), b = pick('scene', 'B', sc)
    return `<figure class="scene" data-shot="signature" data-scene="${esc(sc)}">
        <figcaption><span class="scene-name">${esc(SCENES[sc]?.label ?? sc)}</span> <code>${esc(sc)}</code></figcaption>
        <div class="ab">
          <div class="opt"><p class="opt-tag">A · 지금 값</p>${a ? img(r, a, `${r.name} ${sc} A안`) : '<p class="noshot">스크린샷 없음</p>'}</div>
          ${r.alt ? `<div class="opt"><p class="opt-tag">B · 대안 전체</p>${b ? img(r, b, `${r.name} ${sc} B안`) : '<p class="noshot">스크린샷 없음</p>'}</div>` : ''}
        </div>
      </figure>`
  }).join('\n')
  const spec = pick('specimen', 'A', null)
  const axisRows = r.alt ? Object.entries(r.alt.axes).map(([k, v]) => `<tr data-axis="${k}"><th scope="row">${AXIS_LABEL[k]}</th><td class="va">${esc(v.A)}</td><td class="vb">${esc(v.B)}</td><td class="now" aria-live="off">A</td></tr>`).join('') : ''
  const combos = r.alt ? [{ key: '', label: 'A 그대로' }, ...r.combos.map((c) => ({ key: c.key, label: comboLabel(c) }))] : []
  return `<article class="card" id="card-${esc(r.id)}" data-recipe="${esc(r.id)}" aria-labelledby="t-${esc(r.id)}">
    <header class="card-head">
      <h2 id="t-${esc(r.id)}">${esc(r.name)} <code>${esc(r.id)}</code></h2>
      <p class="mood">${r.mood.map(esc).join(' · ')}</p>
      <p class="tags"><span class="tag">${esc(r.colorLogic)} ${esc(COLOR_LOGIC_LABEL[r.colorLogic])}</span><span class="tag">모션 ${esc(r.motion)}</span>${r.defaultTheme === 'dark' ? '<span class="tag">다크 기본 — 다크 화면을 먼저 보입니다</span>' : ''}<span class="tag">AI 티 ${r.aiTell ?? '확인 안 됨'}${r.aiTell != null ? '점(기준 r1 12)' : ''}</span></p>
    </header>
    <section class="shots" aria-label="${esc(r.name)} 대표 장면">
      <div class="view" role="group" aria-label="스크린샷 보기">
        <span class="view-label">폭</span>
        <button type="button" class="seg" data-view="width" data-value="1440" aria-pressed="true">1440</button><button type="button" class="seg" data-view="width" data-value="375" aria-pressed="false">375</button>
        <span class="view-label">테마</span>
        ${r.themes.map((t, i) => `<button type="button" class="seg" data-view="theme" data-value="${t}" aria-pressed="${i === 0}">${t === 'dark' ? '다크' : '라이트'}</button>`).join('')}
      </div>
      ${sceneRows}
    </section>
    <details class="specimen" data-shot="common">
      <summary>${COMMON_LABEL} <span class="hint">— 부품 모양 확인용, 레시피를 가르는 화면이 아닙니다</span></summary>
      ${spec ? img(r, spec, `${r.name} ${COMMON_LABEL}`) : '<p class="noshot">스크린샷 없음</p>'}
    </details>
    <dl class="facts">
      <div><dt>축 7개</dt><dd>${Object.entries(r.axes).map(([k, v]) => `${STYLE_AXIS[k] ?? k} ${esc(v)}`).join(' · ')}</dd></div>
      <div><dt>서체 짝</dt><dd>${['display', 'displayKo', 'body', 'mono', 'prose'].filter((k) => r.fonts[k]).map((k) => `${k} ${esc(r.fonts[k])}`).join(' · ')}</dd></div>
      <div><dt>적합 원형</dt><dd>${r.archetypes.map((a) => `${esc(a)}${r.archetypeConditions[a] ? ` <span class="cond">(${esc(r.archetypeConditions[a])})</span>` : ''}`).join(' · ')}</dd></div>
      <div><dt>역동 기법</dt><dd>${r.dynamics.map((d) => esc(DYNAMICS[d]?.label ?? d)).join(' · ')}</dd></div>
    </dl>
    ${r.alt ? `<fieldset class="combo">
      <legend>A/B 고르기 <span class="hint">— lint 를 통과한 조합만 고를 수 있습니다</span></legend>
      <p class="note">B안: ${esc(r.alt.note)}</p>
      <div class="table-wrap"><table class="axes"><thead><tr><th scope="col">축</th><th scope="col">A</th><th scope="col">B</th><th scope="col">지금</th></tr></thead><tbody>${axisRows}</tbody></table></div>
      <div class="radios">${combos.map((c, i) => `<label class="radio"><input type="radio" name="combo-${esc(r.id)}" id="combo-${esc(r.id)}-${i}" value="${esc(c.key)}" data-combo${c.key === '' ? ' checked' : ''}> <span>${esc(c.label)}</span></label>`).join('')}</div>
    </fieldset>` : '<p class="note">B안이 없는 레시피입니다.</p>'}
    <fieldset class="verdict">
      <legend>${QUESTION}</legend>
      <div class="radios">
        <label class="radio v-approve"><input type="radio" name="verdict-${esc(r.id)}" id="verdict-${esc(r.id)}-approve" value="approve" data-verdict> <span>승인</span></label>
        <label class="radio v-reject"><input type="radio" name="verdict-${esc(r.id)}" id="verdict-${esc(r.id)}-reject" value="reject" data-verdict> <span>반려</span></label>
        <label class="radio v-revise"><input type="radio" name="verdict-${esc(r.id)}" id="verdict-${esc(r.id)}-revise" value="revise" data-verdict> <span>수정</span></label>
      </div>
    </fieldset>
    <label class="memo" for="note-${esc(r.id)}">메모(선택) <textarea id="note-${esc(r.id)}" data-note rows="2" placeholder="수정이면 무엇을 고칠지 적어 주세요"></textarea></label>
    <p class="save" role="status" data-save>아직 판정하지 않았습니다.</p>
  </article>`
}

// 페이지 스크립트가 쓰는 분포 계산 — recipes-diversity.mjs 소스 그대로.
export const counterSource = () => `const TARGET = ${JSON.stringify(TARGET)};\nconst BASE = ${JSON.stringify(BASE)};\n${limitsFor.toString()}\n${tallyDistribution.toString()}`

const CSS = `
:root { --bg: #f5f6f8; --panel: #ffffff; --ink: #15181e; --muted: #555c68; --line: #d8dce3; --accent: #0b6b69; --accent-ink: #ffffff; --ok: #1d7a3e; --bad: #b3261e; --warn: #8a5a00; --chip: #e9ecf1; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #111418; --panel: #191d23; --ink: #eceff3; --muted: #a8afba; --line: #333a45; --accent: #5cc4bf; --accent-ink: #0b1414; --ok: #6fd08e; --bad: #ff8a80; --warn: #f0c060; --chip: #252b34; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #111418; --panel: #191d23; --ink: #eceff3; --muted: #a8afba; --line: #333a45; --accent: #5cc4bf; --accent-ink: #0b1414; --ok: #6fd08e; --bad: #ff8a80; --warn: #f0c060; --chip: #252b34; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; font-size: 16px; line-height: 1.6; margin: 0; padding-inline: 16px; padding-block: 0 48px; }
h1, h2 { text-wrap: balance; line-height: 1.25; margin: 0; }
code { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; font-size: 0.85em; color: var(--muted); font-weight: 400; }
.wrap { max-width: 1200px; margin-inline: auto; display: flex; flex-direction: column; gap: 32px; }
.intro { display: flex; flex-direction: column; gap: 8px; padding-block: 32px 0; }
.intro h1 { font-size: 1.953rem; }
.intro p { margin: 0; max-width: 68ch; color: var(--muted); }
.counter { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--panel); border: 1px solid var(--line); padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
.meters { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.meters li { display: flex; gap: 6px; align-items: baseline; }
.meters b { font-size: 1.25rem; }
.meters .ok b { color: var(--ok); } .meters .bad b { color: var(--bad); }
.meters .rule { color: var(--muted); font-size: 0.875rem; }
.problems { margin: 0; padding-inline-start: 18px; color: var(--bad); font-size: 0.9375rem; }
.problems:empty { display: none; }
.status-line { margin: 0; font-size: 0.875rem; color: var(--muted); }
.card { background: var(--panel); border: 1px solid var(--line); padding: 24px; display: flex; flex-direction: column; gap: 20px; scroll-margin-top: 140px; }
.card-head { display: flex; flex-direction: column; gap: 6px; }
.card-head h2 { font-size: 1.563rem; }
.mood { margin: 0; font-size: 1.125rem; }
.tags { margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tag { background: var(--chip); padding: 2px 10px; font-size: 0.875rem; }
.shots { display: flex; flex-direction: column; gap: 20px; }
.view { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.view-label { color: var(--muted); font-size: 0.875rem; margin-inline-start: 8px; }
.view-label:first-child { margin-inline-start: 0; }
.seg { min-height: 44px; min-width: 64px; padding: 0 14px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; }
.seg[aria-pressed="true"] { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.scene { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.scene figcaption { font-weight: 600; }
.ab { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
.card[data-width="375"] .ab { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 320px)); }
.opt { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.opt-tag { margin: 0; font-size: 0.875rem; color: var(--muted); }
.opt img, .specimen img { display: block; width: 100%; height: auto; max-width: 100%; border: 1px solid var(--line); background: var(--chip); }
.noshot { margin: 0; padding: 24px; border: 1px dashed var(--line); color: var(--muted); }
.specimen summary { min-height: 44px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600; flex-wrap: wrap; }
.specimen img { max-height: 1600px; object-fit: cover; object-position: top; margin-top: 8px; }
.hint { font-weight: 400; color: var(--muted); font-size: 0.875rem; }
.facts { display: grid; gap: 10px 24px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); margin: 0; }
.facts div { display: flex; flex-direction: column; gap: 2px; }
.facts dt { font-size: 0.875rem; color: var(--muted); }
.facts dd { margin: 0; }
.cond { color: var(--muted); font-size: 0.9375rem; }
fieldset { border: 1px solid var(--line); margin: 0; padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
legend { font-weight: 600; padding-inline: 4px; }
.note { margin: 0; color: var(--muted); }
.table-wrap { overflow-x: auto; }
table.axes { border-collapse: collapse; width: 100%; font-size: 0.9375rem; }
.axes th, .axes td { text-align: start; padding: 6px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
.axes td.now { font-weight: 700; white-space: nowrap; }
.axes tr.is-b td.vb, .axes tr:not(.is-b) td.va { background: var(--chip); }
.radios { display: flex; flex-wrap: wrap; gap: 8px; }
.radio { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); cursor: pointer; }
.radio input { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; }
.radio:has(input:checked) { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.verdict legend { font-size: 1.125rem; }
.v-approve:has(input:checked) { border-color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); }
.v-reject:has(input:checked) { border-color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
.v-revise:has(input:checked) { border-color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }
.memo { display: flex; flex-direction: column; gap: 4px; font-size: 0.9375rem; color: var(--muted); }
textarea { font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); padding: 8px 10px; min-height: 64px; width: 100%; }
.save { margin: 0; font-size: 0.875rem; color: var(--muted); }
.save.err { color: var(--bad); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.toc { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; }
.toc a { color: var(--ink); display: inline-flex; min-height: 32px; align-items: center; }
@media (max-width: 640px) { .card { padding: 16px; } .counter { padding: 10px 12px; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`

// 페이지 스크립트: 선택 상태(메모리) · db 읽기/쓰기 · 계수기 · 스크린샷 보기 전환.
const SCRIPT = `
const DATA = JSON.parse(document.getElementById('board-data').textContent);
const LABEL = { skeleton: '골격', bold: 'K6~8', dark: '다크', m3: 'M3', m0: 'M0' };
const state = Object.fromEntries(DATA.map((r) => [r.id, { verdict: null, combo: '', note: '' }]));
let db = null;
const $ = (s, el = document) => el.querySelector(s);
const cardOf = (id) => document.getElementById('card-' + id);
const axisPicksOf = (r, key) => Object.fromEntries(r.bAxes.map((k) => [k, key.split('+').includes(k) ? 'B' : 'A']));
const comboFromPicks = (r, picks) => { const key = r.bAxes.filter((k) => picks && picks[k] === 'B').join('+'); return key === '' || r.classes[key] ? key : null; };
function entries() {
  return DATA.filter((r) => state[r.id].verdict !== 'reject').map((r) => ({ ...r.classes[state[r.id].combo] }));
}
function renderCounter() {
  const { counts, limits, problems } = tallyDistribution(entries());
  const items = [
    ['skeleton', counts.skeleton, '≤ ' + limits.skeletonMax, counts.skeleton <= limits.skeletonMax],
    ['bold', counts.bold, '≥ ' + limits.boldMin, counts.bold >= limits.boldMin],
    ['dark', counts.darkDefault, '≥ ' + limits.darkMin, counts.darkDefault >= limits.darkMin],
    ['m3', counts.m3, '≥ ' + limits.m3Min, counts.m3 >= limits.m3Min],
    ['m0', counts.m0, '≤ ' + limits.m0Max, counts.m0 <= limits.m0Max],
  ];
  $('#meters').innerHTML = items.map(([k, n, rule, ok]) => '<li class="' + (ok ? 'ok' : 'bad') + '"><span>' + LABEL[k] + '</span><b>' + n + '</b><span class="rule">' + rule + '</span></li>').join('') + '<li><span>센 레시피</span><b>' + counts.total + '</b><span class="rule">반려 제외</span></li>';
  const ul = $('#problems'); ul.textContent = '';
  for (const p of problems) { const li = document.createElement('li'); li.textContent = p; ul.appendChild(li); }
  $('#counter-ok').textContent = problems.length ? '기준을 못 채운 항목 ' + problems.length + '개 — 아래 문장이 무엇이 모자란지 말합니다.' : '지금 고른 값으로 분포 기준을 모두 채웁니다.';
}
function renderCard(r) {
  const c = cardOf(r.id), s = state[r.id];
  for (const i of c.querySelectorAll('input[data-verdict]')) i.checked = i.value === s.verdict;
  for (const i of c.querySelectorAll('input[data-combo]')) i.checked = i.value === s.combo;
  const t = c.querySelector('textarea[data-note]'); if (t && document.activeElement !== t) t.value = s.note;
  const picks = axisPicksOf(r, s.combo);
  for (const tr of c.querySelectorAll('tr[data-axis]')) { const b = picks[tr.dataset.axis] === 'B'; tr.classList.toggle('is-b', b); tr.querySelector('.now').textContent = b ? 'B' : 'A'; }
}
function setSave(id, text, err) { const p = cardOf(id).querySelector('[data-save]'); p.textContent = text; p.classList.toggle('err', !!err); }
const writing = {};
async function save(id) {
  const r = DATA.find((x) => x.id === id), s = state[id];
  if (!s.verdict) { setSave(id, '판정(승인·반려·수정)을 고르면 저장합니다.'); return; }
  if (!db) { setSave(id, '저장할 수 없습니다 — 이 화면에서 db 기능을 쓸 수 없습니다. 선택은 이 창을 닫으면 사라집니다.', true); return; }
  const doc = { recipe: id, verdict: s.verdict, axisPicks: axisPicksOf(r, s.combo), decidedAt: new Date().toISOString() };
  if (s.note.trim()) doc.note = s.note.trim();
  if (writing[id]) { writing[id].again = true; return; }
  writing[id] = { again: false };
  setSave(id, '저장하는 중…');
  try {
    await db.collection('decisions').doc(id).set(doc);
    setSave(id, '저장했습니다 · ' + new Date(doc.decidedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    setSave(id, '저장하지 못했습니다(' + (e && e.code ? e.code : '알 수 없음') + ') — 편집 권한이 있는지 확인해 주세요.', true);
  } finally {
    const again = writing[id].again; delete writing[id];
    if (again) save(id);
  }
}
const noteTimers = {};
document.addEventListener('change', (e) => {
  const el = e.target, c = el.closest('.card'); if (!c) return;
  const id = c.dataset.recipe;
  if (el.matches('input[data-verdict]')) state[id].verdict = el.value;
  else if (el.matches('input[data-combo]')) state[id].combo = el.value;
  else return;
  renderCard(DATA.find((x) => x.id === id)); renderCounter(); save(id);
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.matches('textarea[data-note]')) return;
  const id = el.closest('.card').dataset.recipe; state[id].note = el.value;
  clearTimeout(noteTimers[id]); noteTimers[id] = setTimeout(() => save(id), 900);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]'); if (!b) return;
  const c = b.closest('.card'), r = DATA.find((x) => x.id === c.dataset.recipe);
  for (const x of c.querySelectorAll('button[data-view="' + b.dataset.view + '"]')) x.setAttribute('aria-pressed', String(x === b));
  const width = Number(c.querySelector('button[data-view="width"][aria-pressed="true"]').dataset.value);
  const theme = c.querySelector('button[data-view="theme"][aria-pressed="true"]').dataset.value;
  c.dataset.width = String(width);
  for (const im of c.querySelectorAll('img[data-kind]')) {
    const s = r.shots.find((x) => x.kind === im.dataset.kind && x.option === im.dataset.option && (x.scene || '') === im.dataset.scene && x.width === width && x.theme === theme);
    if (s) { im.src = 'shots/' + s.file; im.width = s.w; im.height = s.h; }
  }
});
function applyDocs(snap) {
  for (const d of snap.docs) {
    const r = DATA.find((x) => x.id === d.id); const v = d.data(); if (!r || !v) continue;
    if (writing[r.id] || noteTimers[r.id] && document.activeElement === cardOf(r.id).querySelector('textarea')) continue;
    const combo = comboFromPicks(r, v.axisPicks);
    state[r.id] = { verdict: ['approve', 'reject', 'revise'].includes(v.verdict) ? v.verdict : null, combo: combo ?? '', note: typeof v.note === 'string' ? v.note : '' };
    renderCard(r);
    setSave(r.id, '저장된 판정 · ' + (v.decidedAt ? new Date(v.decidedAt).toLocaleString('ko-KR') : ''));
  }
  renderCounter();
}
DATA.forEach(renderCard); renderCounter();
(async () => {
  const use = window.claude && window.claude.use;
  const found = use ? await window.claude.use('db').catch(() => null) : null;
  if (!found) { $('#db-status').textContent = '저장 기능을 쓸 수 없는 화면입니다 — 고른 값은 계수기에만 반영되고 저장되지 않습니다.'; return; }
  db = found;
  $('#db-status').textContent = '판정을 고르면 바로 저장합니다(decisions).';
  db.collection('decisions').onSnapshot(applyDocs, (e) => { $('#db-status').textContent = '저장된 판정을 읽지 못했습니다(' + (e && e.code) + '). 새로 고쳐 주세요.'; });
})();
`

export function buildBoard(data, { generatedAt = '' } = {}) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const start = tallyDistribution(data.map((r) => r.classes['']))
  return `<title>레시피 보드</title>
<meta name="description" content="레시피 ${data.length}벌 판정 보드 — 승인·반려·수정과 A/B, 분포 계수기">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap">
<style>${CSS}</style>
<div class="wrap">
  <header class="intro">
    <h1>${QUESTION}</h1>
    <p>레시피 ${data.length}벌을 한 장씩 보고 승인·반려·수정을 고릅니다. 대표 장면이 먼저, 부품 모양을 보는 공통 견본이 그 뒤에 있습니다. B안이 있는 레시피는 lint 를 통과한 조합에서만 고를 수 있습니다.</p>
    <p id="db-status" role="status">저장 기능을 확인하는 중입니다.</p>
    <ul class="toc" aria-label="레시피 바로 가기">${data.map((r) => `<li><a href="#card-${esc(r.id)}">${esc(r.name)}</a></li>`).join('')}</ul>
  </header>
  <section class="counter" aria-label="다양성 분포 계수기" aria-live="polite">
    <ul class="meters" id="meters"><li>골격 ${start.counts.skeleton}</li></ul>
    <p class="status-line" id="counter-ok"></p>
    <ul class="problems" id="problems"></ul>
  </section>
  ${data.map(card).join('\n  ')}
  <p class="status-line">스크린샷 ${generatedAt ? `${esc(generatedAt)} 촬영` : '촬영 시각 확인 안 됨'} · 문구는 모두 예시입니다.</p>
</div>
<script type="application/json" id="board-data">${json}</script>
<script>
${counterSource()}
${SCRIPT}
</script>
`
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
  const mf = flag('--manifest', join(OUT, 'manifest.json'))
  const out = flag('--out', join(ROOT, 'factory', 'board', 'recipe-board', 'board.html'))
  if (!existsSync(mf)) { console.error(`도구 실패: ${mf} 가 없다 — 먼저 shots.mjs`); process.exit(1) }
  const manifest = JSON.parse(readFileSync(mf, 'utf8'))
  const ai = aiTellScores(readFileSync(join(ROOT, 'docs', 'qa', 'ai-tell-baseline.md'), 'utf8'))
  const data = boardData(loadHeads(), manifest, ai)
  const missing = data.flatMap((r) => r.signature.flatMap((sc) => ['A', ...(r.alt ? ['B'] : [])].filter((o) => !r.shots.some((s) => s.scene === sc && s.option === o)).map((o) => `${r.id} ${o} ${sc}`)))
  if (missing.length) { console.error(`도구 실패: 스크린샷 없는 장면 ${missing.join(', ')}`); process.exit(1) }
  writeFileSync(out, buildBoard(data, { generatedAt: manifest.generatedAt }))
  console.log(`board: ${data.length}벌 → ${out} (스크린샷 ${manifest.count}장 · ${(manifest.bytes / 1048576).toFixed(1)}MB)`)
}
