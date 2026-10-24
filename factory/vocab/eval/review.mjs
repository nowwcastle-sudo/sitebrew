// 대표 검수 화면(설계 7.2). 시험 문장(holdout.jsonl)마다 해석기가 제안한 읽기를 보이고 「맞음/고침/이건 물어봐야 함」을 고르게 한다.
//   산출: out/vocab-review.html 한 파일 — 외부 스크립트·스타일·글꼴·네트워크 없음. 결과는 「결과 파일 저장」으로 holdout.review.json 을 내려받는다.
//   holdout.review.json = { reviewedAt: ISO, verdicts: { [id]: { verdict: <gates.json verdicts 의 id>, note?: string } } } — score.mjs --release 가 읽는 모양 그대로.
//   진행 상태는 브라우저 localStorage(창을 닫아도 이어서). 읽기·쓰기는 모두 try/catch — 막혀 있어도 화면은 돌아간다.
//   문장이 사용자에게 보이는 글은 interpret 의 say 를 주설명으로, 축 목록은 작게 아래에 둔다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { interpret } from '../interpret.mjs'
import { loadLexicon } from '../lexicon.mjs'
import { fill } from '../fill.mjs'
import { grammar } from '../grammar.mjs'
import { HOLDOUT_FILE, HOLDOUT_MIN, NOTE_VERDICT, OUT_DIR, REVIEW_FILE, VERDICTS, VERDICT_DEFS, loadCases } from './score.mjs'

const EVAL_DIR = dirname(fileURLToPath(import.meta.url))
export const OUT_FILE = join(OUT_DIR, 'vocab-review.html')

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// <script> 안에 넣는 JSON 에서 </script> 나 <!-- 가 끼어들지 않게 한다
const jsonForScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

/** 읽기 하나를 「축: 방향」 글자로. */
export function readingText(r, lex) {
  const ax = lex.axes[r.axis]
  const name = ax?.label ?? r.axis
  let to = r.value !== undefined ? ax?.valueLabels?.[r.value] ?? r.value : r.direction ?? '' // 값 id 대신 사전의 한국어 이름
  if (r.direction && ax?.ends) {
    const i = ax.ends.indexOf(r.direction)
    if (i >= 0 && ax.endLabels?.[i]) to = ax.endLabels[i]
  }
  const [sk, sv] = (r.scope ?? 'site').split(/:(.*)/)
  const where = sk === 'site' ? '' : fill(grammar.text.scope[sk].ko, { key: sv }).trim() // 해석기가 사용자에게 보이는 범위 글과 같은 틀
  const extra = [r.cap ? '그 쪽으로 더 가지 않게' : '', where].filter(Boolean).join(' · ')
  return `${name}: ${to}${extra ? ` (${extra})` : ''}`
}

const axisList = (readings, lex) => (readings?.length ? `<ul class="axes">${readings.map((r) => `<li>${esc(readingText(r, lex))}</li>`).join('')}</ul>` : '')

/** 제안 해석 → 카드 안쪽 HTML (주설명 + 작은 축 목록) */
function proposalHtml(r, lex) {
  if (r.result === 'confirmed') return `<p class="say">${esc(r.say)}</p>${axisList(r.readings, lex)}`
  if (r.result === 'two') {
    return `<p class="say two">두 가지로 읽혀요.</p>${r.options.map((o, i) => `<div class="opt"><p class="say"><b>${i + 1}.</b> ${esc(o.say)}</p>${axisList(o.readings, lex)}</div>`).join('')}`
  }
  return `<p class="say unk">잘 모르겠어요. 이렇게 물어봐요: ${esc(r.ask)}</p>${(r.choices ?? []).length ? `<ul class="axes">${r.choices.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`
}

const BUTTONS = VERDICT_DEFS.map((v) => [v.id, v.label]) // 판정 → 버튼 글자(gates.json)

function cardHtml(c, lex) {
  const r = interpret(c.text, lex, c.ctx ?? {})
  return `<section class="card" data-id="${esc(c.id)}">
<p class="src"><span class="id">${esc(c.id)}</span> ${esc(c.text)}</p>
${proposalHtml(r, lex)}
<div class="btns">${BUTTONS.map(([v, t]) => `<button type="button" class="v" data-v="${v}">${t}</button>`).join('')}</div>
<textarea class="note" rows="2" placeholder="어떻게 고치면 좋을까요? (메모)" hidden></textarea>
</section>`
}

const CSS = `:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1b;--sub:#5f5f5a;--line:#d9d7d0;--c0:#1f7a4d;--c1:#b4531b;--c2:#3a5bb0}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#212120;--ink:#f1f0ec;--sub:#a9a8a2;--line:#3a3a38;--c0:#5fcf97;--c1:#f0a070;--c2:#8fa8f0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Malgun Gothic","Apple SD Gothic Neo",sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;z-index:1}
h1{font-size:18px;margin:0}
#progress{margin:2px 0 0;font-weight:700}
main{padding:12px 16px 96px;max-width:720px;margin:0 auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 12px}
.card.done{border-color:var(--c0)}
.src{font-size:18px;font-weight:700;margin:0 0 8px;word-break:keep-all}
.id{font-size:12px;color:var(--sub);font-weight:400;margin-right:6px}
.say{margin:0 0 6px;font-size:17px}
.axes{margin:0 0 8px;padding-left:18px;color:var(--sub);font-size:13px}
.opt{margin:0 0 6px}
.btns{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
button.v,input.save{min-height:52px;font:inherit;font-size:17px;font-weight:700;border:2px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);cursor:pointer;padding:8px 12px}
${VERDICTS.map((v, i) => `button.v[data-v="${v}"].on{background:var(--c${i});border-color:var(--c${i});color:#fff}`).join('')}
.note{width:100%;margin-top:8px;font:inherit;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.note[hidden]{display:none}
footer{margin-top:16px}
input.save{width:100%;background:var(--ink);color:var(--bg);border-color:var(--ink)}
#msg{color:var(--sub);font-size:14px}
@media (min-width:640px){.btns{grid-template-columns:1fr 1fr 1.4fr}}`

const SCRIPT = `(function(){
var KEY='vocab-review-v1',DATA=JSON.parse(document.getElementById('data').textContent),state={};
function load(){try{var s=localStorage.getItem(KEY);if(s){var o=JSON.parse(s);if(o&&o.verdicts)state=o.verdicts}}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify({verdicts:state}))}catch(e){}}
var cards=[].slice.call(document.querySelectorAll('.card'));
function paint(){var n=0;cards.forEach(function(c){var s=state[c.getAttribute('data-id')],ta=c.querySelector('.note');
c.classList.toggle('done',!!s);if(s)n++;
[].forEach.call(c.querySelectorAll('button.v'),function(b){b.classList.toggle('on',!!s&&s.verdict===b.getAttribute('data-v'))});
ta.hidden=!(s&&s.verdict===DATA.noteVerdict);if(s&&s.note&&ta.value!==s.note)ta.value=s.note});
document.getElementById('progress').textContent=n+'/'+DATA.total+' 판정함'}
cards.forEach(function(c){var id=c.getAttribute('data-id');
[].forEach.call(c.querySelectorAll('button.v'),function(b){b.addEventListener('click',function(){
var v=b.getAttribute('data-v'),prev=state[id];state[id]={verdict:v};if(prev&&prev.note)state[id].note=prev.note;save();paint()})});
c.querySelector('.note').addEventListener('input',function(e){var s=state[id];if(!s)return;s.note=e.target.value;save()})});
document.getElementById('dl').addEventListener('click',function(){
var out={},missing=0;DATA.ids.forEach(function(id){var s=state[id];if(!s){missing++;return}
var o={verdict:s.verdict},t=(s.note||'').trim();if(t&&s.verdict===DATA.noteVerdict)o.note=t;out[id]=o});
var blob=new Blob([JSON.stringify({reviewedAt:new Date().toISOString(),verdicts:out},null,2)+'\\n'],{type:'application/json'});
var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=DATA.reviewFile;document.body.appendChild(a);a.click();a.remove();
document.getElementById('msg').textContent=missing?('아직 판정하지 않은 문장이 '+missing+'개 있어요. 지금까지 한 것만 저장했어요.'):'모두 판정했어요. 저장했어요.'});
load();paint()})();`

/** @param {{id:string,text:string,ctx?:object}[]} cases */
export function buildHtml(cases, lex = loadLexicon()) {
  const data = { ids: cases.map((c) => c.id), total: cases.length, noteVerdict: NOTE_VERDICT, reviewFile: REVIEW_FILE }
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>시험 문장 검수</title><style>${CSS}</style></head>
<body><header><h1>시험 문장 검수</h1><p id="progress">0/${cases.length} 판정함</p></header>
<main>
${cases.map((c) => cardHtml(c, lex)).join('\n')}
<footer><input type="button" class="save" id="dl" value="결과 파일 저장"><p id="msg"></p></footer>
</main>
<script type="application/json" id="data">${jsonForScript(data)}</script>
<script>${SCRIPT}</script>
</body></html>
`
}

/** CLI 본체. opts: { dir: 시험 문장 파일이 있는 폴더, out: 만들 파일, lex, log } */
export function run({ dir = EVAL_DIR, out = OUT_FILE, lex, log = console.log } = {}) {
  let cases
  try { cases = loadCases(join(dir, HOLDOUT_FILE)) } catch (err) { log(`${HOLDOUT_FILE} 을 읽지 못했어요: ${err.message}`); return 2 }
  if (cases.length < HOLDOUT_MIN) log(`주의: 시험 문장이 ${cases.length}개예요. 출시 판정은 ${HOLDOUT_MIN}개 이상이어야 해요.`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, buildHtml(cases, lex))
  log(`검수 화면을 만들었어요: ${out} (${cases.length}문장)`)
  log(`내려받은 ${REVIEW_FILE} 을 factory/vocab/eval/ 에 두세요.`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run()
