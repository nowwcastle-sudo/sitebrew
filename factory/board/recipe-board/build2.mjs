// 레시피 보드 v2 HTML(Task 10f): node factory/board/recipe-board/build2.mjs [--manifest .tmp/board2/manifest.json] [--out factory/board/recipe-board/board2.html] [--publish <폴더>]
// 대표(디자이너 아님)가 레시피마다 두 안(A = 머리, B = alternates 전체)의 완성된 첫 화면을 **움직이는 영상**으로 보고 「마음에 드나」를 답한다.
// 보드 v1(build.mjs · board.html)은 게시한 기록이라 그대로 둔다. 이 스크립트는 파일만 만든다(게시는 컨트롤러).
// 자산은 곁에 싣는 상대 경로: `video/<id>-<A|B>.mp4`·`.webm`(MP4 를 먼저 고른다), `shots/<id>-<A|B>-<1440|375>.webp`(video.mjs 가 .tmp/board2 에 찍는다).
//   --publish <폴더>: board2.html + shots/ + video/ 를 그 폴더에 모은다(컨트롤러가 files 로 게시할 묶음). 목록의 bytes 와 파일 크기가 다르면 멈춘다(리뷰 L4).
// 보는 법(대표 피드백 2026-09-28 「화면이 작아서 제대로 판단이 안 돼」): 레시피 카드 한 장에 A 위 B 아래로 두 안을 쌓고, 안마다 영상이 본문 폭(최대 약 1310px)을 다 쓴다.
//   휴대폰 정지는 자리가 있으면 375 CSS px 그대로. 「크게 보기」는 페이지 안 <dialog> — 영상 1440px 원래 크기(넘치면 스크롤)·휴대폰 375 전환·A↔B 전환(같은 크기·같은 자리).
// 4판(Task 16 — 3판 판정 반영 뒤 다음 보드): 레시피마다 있는 안만 보인다(r5 는 A 하나). 카드마다 「3판 뒤 바뀐 점」 한 줄(changesOf), 안마다 3판 답·2판 답
//   한 줄씩. 글자 잇기는 합성이다(letterKeys): 지금 글자 → 3판 글자(v3Keys — 3판에서 B를 골라 머리로 올린 r2·r6·r8·r10 은 A↔B) → 2판 글자(v2Keys —
//   2판에서 B를 골라 올린 r2 는 한 번 더 A↔B, 그래서 r2 는 제자리). 합성한 글자가 판마다 보인 히어로 기록(recipe-board-letters.json)과 안 맞으면
//   보드를 짓지 않는다(도구 실패). --publish 는 뼈대 태그를 뺀 board4.html(artifactHtml).
// 저장: 아티팩트 db 기능(capabilities {db:{}}) — `await window.claude.use('db')` → collection "likes" · 문서 id = 레시피 id ·
//   4판 답은 문서 안 한 칸 v4 = { board: 4, likes: { A?, B? }, aspects?: { A?: { color?, type?, layout?, motion? }, B?: … }, notes?: { A?, B? }, note?, pick?: "A"|"B", decidedAt }
//   에만 쓴다 — 값은 "like"|"dislike"(지운 값은 null, 읽을 때 버린다). 문서의 나머지는 이전 판 답이라 그대로 둔다: board 3 문서(지금 저장된 모양)는 본문이
//   3판 답(3판 글자)이고 v2 가 2판 답(2판 글자), 그보다 옛 문서(board 없음 — 2판·옛 모양 { recipe, likes, pick?, note?, decidedAt })는 통째로 2판 답이다.
//   4판이 새로 만드는 문서는 { recipe, board: 4, v4 }. (4판 답을 문서 윗단으로 옮기는 전체 쓰기를 두지 않는다 — 두 탭이 동시에 옮기면 한쪽 답이 사라진다.)
// 쓰기 규칙(리뷰 14 #1·#2 — 2판·3판 답과 다른 탭의 답을 지우지 않는다):
//   · 문서마다 원격 상태를 읽은 뒤에만 쓴다(loaded — 서버가 확정한 스냅숏이나 get). 읽지 못하면 쓰지 않고 알린 뒤 다시 시도한다.
//   · 첫 스냅숏 전에는 준비(ready)가 아니다 — 고른 것은 쌓아 두었다가 첫 스냅숏 뒤 한꺼번에 쓴다. 구독이 끊기면(onSnapshot 오류) 다시 읽을 때까지 쓰지 않는다.
//   · 있는 문서에는 v4 안의 바뀐 칸만 update 로 쓴다(겹친 객체는 합쳐진다) — 3판 본문·v2·다른 탭이 고친 칸은 건드리지 않는다. 문서가 없을 때만 바로 전에
//     다시 읽고 set 한 번. 스냅숏이 와도 아직 쓰지 않은 내 칸은 그 위에 다시 얹는다(건너뛰고 잊지 않는다).
//   · db 가 null 이면 저장했다고 말하지 않는다. 같은 값은 다시 쓰지 않고(L5), 잘 만든 쓰기가 invalid_argument 로 거절되면 그 방문 동안
//     읽기 전용으로 둔다(L6 — update 는 문서가 사라졌을 때도 invalid_argument 라 한 번 다시 읽어 본다). 브라우저 저장소는 쓰지 않는다.
// 기술 정보(팔레트 hex·K/M/역동 기법·DNA 카드 경로·AI 티 점수·출처 분류)는 접힌 <details> 안에만 둔다. 실존 사이트 이름은 보드에 싣지 않는다 —
// 출처는 DNA 카드의 큐레이션 출처를 한국어 분류로만 옮긴다(dnaSources).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COLOR_LOGIC_LABEL, DYNAMICS, koreanEntry } from '../../scripts/recipe.mjs'
import { oklchToLinearSrgb } from '../../scripts/lib/contrast-lib.mjs'
import { aiTellScores } from './build.mjs'
import { loadHeads, optionsOf, ROOT } from './jobs.mjs'
import { OUT2, SPAN, themeOf, fileNames, naturalOrder } from './video.mjs'

export const COLLECTION = 'likes'
export const INTRO = '각 레시피의 안을 보고 마음에 드는지 골라 주세요. 움직임은 영상으로 보이고, 「크게 보기」를 누르면 실제 크기로 볼 수 있습니다.'
// 4판(Task 16): 3판 판정(r2·r6·r8·r10 은 고른 B안이 머리로)을 반영해 다시 찍은 보드. 같은 아티팩트에 다시 게시한다 — likes 문서가 이어진다.
export const BOARD = 4
export const EDITION = '4판 — 3판 판정 반영(고른 안이 머리로)'
export const DECISIONS2 = join(ROOT, 'factory', 'board', 'recipe-board2-decisions.json')
// 3판 판정 기록(Task 14) — recipe-board3-decisions.json. 같은 모양(레시피 id → { pick?, … }), v2Keys 와 같은 swap 규칙으로 쓴다.
export const DECISIONS3 = join(ROOT, 'factory', 'board', 'recipe-board3-decisions.json')
// 판마다 글자가 보인 히어로(Task 16) — 합성한 글자 대응을 검산한다.
export const LETTERS = join(ROOT, 'factory', 'board', 'recipe-board-letters.json')
export const MEDIA_MANIFEST = join(ROOT, 'public', 'media', 'manifest.json')
const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d)

// N판 글자 ↔ 그다음 판 글자(한 걸음). N판 판정(decisions 파일)에서 B를 고른 레시피는 B가 머리로 올라가고 옛 A가 alternates(B)로
// 내려간다(swap 규칙은 v2·v3 공통) → 글자가 뒤바뀐다. 나머지는 그대로다. keys 는 뒤 판의 글자들이다.
// v2Keys: 3판 글자 → 2판 글자(DECISIONS2). v3Keys: 4판(지금) 글자 → 3판 글자(DECISIONS3). 지금 글자에서 2판 글자는 둘을 합성한다(letterKeys).
export function v2Keys(recipe, keys, decisions = readJson(DECISIONS2, {})) {
  const swap = decisions?.[recipe]?.pick === 'B' && keys.includes('B')
  return Object.fromEntries(keys.map((k) => [k, swap ? (k === 'A' ? 'B' : 'A') : k]))
}
export function v3Keys(recipe, keys, decisions = readJson(DECISIONS3, {})) {
  const swap = decisions?.[recipe]?.pick === 'B' && keys.includes('B')
  return Object.fromEntries(keys.map((k) => [k, swap ? (k === 'A' ? 'B' : 'A') : k]))
}
// 지금 선택지 글자 → { v3, v2 }(그 안이 3판·2판에서 달았던 글자, 그 판에 없던 안은 null). 합성: 지금 → v3Keys → v2Keys(3판 글자 목록 위에서).
// 검산(리뷰 14 #3): 합성한 글자가 판마다 보인 히어로 기록과 맞아야 한다 — 지금 안의 히어로 = 3판 그 글자의 히어로 = 2판 그 글자의 히어로.
// 기록이 없거나 어긋나면(판정 기록 없이 글자가 바뀐 경우) 던진다 — 보드를 짓지 않는다. 기록에 없는 레시피(새 레시피)는 이전 판 답이 없다(null).
export function letterKeys(head, { decisions2 = readJson(DECISIONS2, {}), decisions3 = readJson(DECISIONS3, {}), letters = readJson(LETTERS, null) } = {}) {
  const opts = optionsOf(head)
  if (!letters?.boards?.['3'] || !letters?.boards?.['2']) throw new Error(`글자 대응 없음: 판별 히어로 기록(${LETTERS})이 없다`)
  const b3 = letters.boards['3'].heroes?.[head.id], b2 = letters.boards['2'].heroes?.[head.id]
  if (!b3) return Object.fromEntries(opts.map((o) => [o.key, { v3: null, v2: null }]))
  const k3 = v3Keys(head.id, opts.map((o) => o.key), decisions3)
  const k2 = v2Keys(head.id, Object.keys(b3), decisions2)
  const bad = []
  const out = {}
  for (const o of opts) {
    const v3 = b3[k3[o.key]] !== undefined ? k3[o.key] : null
    const v2 = v3 && b2 && b2[k2[v3]] !== undefined ? k2[v3] : null
    if (v3 && b3[v3] !== o.head.hero) bad.push(`${o.key}안(${o.head.hero}) → 3판 ${v3}안은 ${b3[v3]}`)
    if (!v3 && Object.values(b3).includes(o.head.hero)) bad.push(`${o.key}안(${o.head.hero})은 3판에 있었는데 이어지지 않는다`)
    if (v2 && b2[v2] !== b3[v3]) bad.push(`3판 ${v3}안(${b3[v3]}) → 2판 ${v2}안은 ${b2[v2]}`)
    out[o.key] = { v3, v2 }
  }
  if (bad.length) throw new Error(`글자 대응 없음(${head.id}): ${bad.join(' · ')} — 판정 기록(recipe-board2·3-decisions.json)과 히어로 기록이 지금 머리와 맞지 않는다`)
  return out
}

// 3판 뒤 바뀐 점(글자 바뀜 말고) — Task 14·16 에서 레시피 원천·히어로를 고친 것. 글자는 3판 글자로 적는다.
export const CHANGES_SINCE_3 = {
  'r1-measure': 'B안 치수 라벨 「3 600」을 치수선 옆으로 옮겼다(휴대폰은 세로쓰기)',
  'r6-civic': 'B안(3판 A안)에 신청 단계 도장 선 긋기를 더했다',
  'r10-console': 'B안(3판 A안)에 커서를 따르는 행 강조를 더했다',
}
// 3판 뒤 바뀐 점 한 줄: 글자 바뀜(3판에서 고른 안이 머리로) · 고친 것 · 3판에 없던 안.
export function changesOf(recipe, options, { pick3 = null, notes = CHANGES_SINCE_3 } = {}) {
  const parts = []
  const moved = options.filter((o) => o.v3Key && o.v3Key !== o.key)
  if (moved.length) parts.push(`${moved.map((o) => `${o.key}안 = 3판 ${o.v3Key}안`).join(' · ')}${pick3 ? `(3판에서 고른 ${pick3}안이 머리로)` : ''}`)
  if (notes[recipe]) parts.push(notes[recipe])
  const fresh = options.filter((o) => !o.v3Key)
  if (fresh.length) parts.push(`${fresh.map((o) => o.key).join('·')}안은 3판에 없던 안`)
  return `3판 뒤 바뀐 점: ${parts.length ? parts.join(' · ') : '없음(3판 그대로)'}`
}
// 부분 판정 네 가지(선택) — 문서 키와 화면 이름.
export const ASPECTS = [['color', '색감'], ['type', '글씨체'], ['layout', '배치'], ['motion', '움직임']]
const DNA_DIR = join(ROOT, 'docs', 'recipes', 'dna')

// 큐레이션 출처 id → 한국어 분류(이름을 싣지 않는다). 모르는 출처는 「확인 안 됨」.
const SOURCE_KIND = {
  awwwards: '국제 웹 어워드 후보·수상작', cssda: '국제 웹 어워드 선정작',
  siteinspire: '웹 디자인 큐레이션 선정작', httpster: '웹 디자인 큐레이션 선정작', onepagelove: '한 장 사이트 큐레이션 선정작', lapaninja: '랜딩 페이지 큐레이션 선정작',
  saasframe: 'SaaS 랜딩 모음 수록작', saaslandingpage: 'SaaS 랜딩 모음 수록작',
  krds: '정부 디자인 시스템 정본', imweb: '국내 제작 사례',
}
const GENRE = [[/restaurant/i, '식당'], [/ecommerce/i, '쇼핑몰'], [/accommodation/i, '숙박'], [/숙박/, '숙박·여행'], [/landing-page/i, '랜딩']]

// DNA 카드 → 레시피마다 { A, B } 출처 분류. A 히어로 = 카드 「### 수 1」, B = 「### 수 2」이고, 수 제목 끝의 「(사이트 N)」이 그 수의 구조를
// 가져온 사이트다(리뷰 L1 — r1 은 수 1 이 사이트 2). 표시가 없으면 같은 번호의 사이트로 본다.
export function dnaSources(ids = loadHeads().map((h) => h.id)) {
  return ids.map((recipe) => {
    const file = join(DNA_DIR, `${recipe}.md`)
    const md = existsSync(file) ? readFileSync(file, 'utf8') : ''
    const site = (n) => {
      const m = md.match(new RegExp(`^- 사이트 ${n}: \\S+ · 출처 \`([^\`]+)\` · (.+?) · 방문`, 'm'))
      if (!m) return { site: n, source: null, category: '확인 안 됨' }
      const genre = GENRE.find(([re]) => re.test(m[2]))?.[1]
      return { site: n, source: m[1], category: `${SOURCE_KIND[m[1]] ?? '확인 안 됨'}${genre ? ` · ${genre}` : ''}` }
    }
    const siteOfMove = (k) => Number(md.match(new RegExp(`^### 수 ${k} — .*\\(사이트 ([12])\\)\\s*$`, 'm'))?.[1] ?? k)
    return { recipe, card: `docs/recipes/dna/${recipe}.md`, A: site(siteOfMove(1)), B: site(siteOfMove(2)) }
  })
}

// OKLCH 문자열 → #rrggbb(sRGB 범위로 자른다).
export function toHex(v) {
  const enc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  return '#' + oklchToLinearSrgb(v).map((c) => Math.round(Math.min(1, Math.max(0, enc(c))) * 255).toString(16).padStart(2, '0')).join('')
}

// 한글 제목 서체의 한국어 이름(보드 설명 줄). 목록에 없으면 영문 이름 그대로.
const KO_NAME = {
  'nanum gothic coding': '나눔고딕코딩', pyeojingothic: '펴진고딕', orbit: '오르빗', galmuri11: '갈무리11', 'do hyeon': '도현', 'song myung': '송명',
  'bm euljiro': '을지로체', maruburi: '마루 부리', 'pretendard gov': '프리텐다드 GOV', nanumsquareround: '나눔스퀘어라운드', 'gowun batang': '고운바탕',
  'nanum brush script': '나눔손글씨 붓', dongle: '동글', 'bagel fat one': '베이글 팻 원', 'moirai one': '모이라이 원',
}
const koName = (f) => KO_NAME[String(f).toLowerCase()] ?? f
// 「영문 <display> · 한글 <displayKo>」 — displayKo 가 없으면 한글을 그리는 본문 서체(표시).
export function fontCaption(head) {
  const latin = head.fonts?.display?.family ?? head.fonts?.body?.family
  const ko = head.fonts?.displayKo?.family
  const body = head.fonts?.body?.family
  const koText = ko ? koName(ko) : koreanEntry(body) ? `${koName(body)}(본문 서체)` : '확인 안 됨'
  return `영문 ${latin} · 한글 ${koText}`
}

const SWATCH_ROLES = ['background', 'foreground', 'primary', 'accent', 'field-1', 'field-2', 'block-1', 'block-2', 'block-3', 'block-4']

// 보드 데이터: 레시피(자연 순서 r1 … r10)마다 이름·분위기 한 줄·선택지 두 개(파일·서체 설명·기술 정보).
// 글자 잇기는 letterKeys(합성 + 히어로 기록 검산) — 어긋나면 던진다(보드를 짓지 않는다).
export function board2Data(heads, manifest = { files: [] }, ai = {}, { decisions = readJson(DECISIONS2, {}), decisions3 = readJson(DECISIONS3, {}), letters = readJson(LETTERS, null) } = {}) {
  const ordered = naturalOrder(heads)
  const src = Object.fromEntries(dnaSources(ordered.map((h) => h.id)).map((s) => [s.recipe, s]))
  return ordered.map((h) => {
    const theme = themeOf(h)
    const opts = optionsOf(h)
    const keys = letterKeys(h, { decisions2: decisions, decisions3, letters })
    const options = opts.map((o) => {
      const names = fileNames(h.id, o.key)
      const has = (f) => manifest.files.some((x) => x.file === f)
      const colors = o.head.color?.[theme] ?? {}
      return {
        key: o.key, v3Key: keys[o.key].v3, v2Key: keys[o.key].v2, hero: o.head.hero, fonts: fontCaption(o.head),
        video: names.video, mp4: names.mp4, poster: names[1440], phone: names[375],
        captured: [names.video, names.mp4, names[1440], names[375]].every(has),
        tech: {
          colorLogic: `${o.head.colorLogic} ${COLOR_LOGIC_LABEL[o.head.colorLogic] ?? ''}`.trim(), motion: o.head.motion,
          dynamics: (o.head.dynamics ?? []).map((d) => DYNAMICS[d]?.label ?? d),
          swatches: SWATCH_ROLES.filter((k) => colors[k]).map((k) => ({ role: k, hex: toHex(colors[k]) })),
          source: src[h.id]?.[o.key]?.category ?? '확인 안 됨',
        },
      }
    })
    const pick3 = decisions3?.[h.id]?.pick ?? null
    return { id: h.id, name: h.name, mood: (h.mood ?? []).join(' · '), theme, aiTell: ai[h.id] ?? null, card: src[h.id]?.card ?? `docs/recipes/dna/${h.id}.md`, changes: changesOf(h.id, options, { pick3 }), options }
  })
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function option(r, o) {
  const label = `${r.name} ${o.key}안`
  const oid = `o-${r.id}-${o.key}`
  return `<div class="opt" data-option="${o.key}" role="group" aria-labelledby="${oid}">
        <div class="opt-head">
          <h3 id="${oid}" class="opt-tag">${o.key}안</h3>
          <p class="fonts">${esc(o.fonts)}</p>
          <button type="button" class="big" data-big="${o.key}" aria-haspopup="dialog">크게 보기</button>
        </div>
        <p class="prev" data-prev="${o.key}" data-round="3" hidden></p>
        <p class="prev" data-prev="${o.key}" data-round="2" hidden></p>
        <figure class="desk">
          <video poster="shots/${esc(o.poster)}" width="1440" height="900" autoplay muted loop playsinline preload="metadata" aria-label="${esc(label)} 첫 화면 영상 ${SPAN}초">
            <source src="video/${esc(o.mp4)}" type="video/mp4">
            <source src="video/${esc(o.video)}" type="video/webm">
          </video>
          <button type="button" class="play" data-play aria-label="${esc(label)} 영상 일시정지">일시정지</button>
        </figure>
        <div class="detail">
          <figure class="phone">
            <img src="shots/${esc(o.phone)}" width="375" height="812" loading="lazy" decoding="async" alt="${esc(label)} 휴대폰 첫 화면">
            <figcaption>휴대폰 화면(375)</figcaption>
          </figure>
          <div class="feedback">
            <div class="rate" role="group" aria-label="${esc(label)} 전체가 마음에 드나요">
              <p class="q">${o.key}안 전체</p>
              <button type="button" class="like" data-like="${o.key}" value="like" aria-pressed="false">좋다</button>
              <button type="button" class="like" data-like="${o.key}" value="dislike" aria-pressed="false">별로</button>
            </div>
            <fieldset class="aspects">
              <legend>부분별로(고르고 싶을 때만)</legend>
              ${ASPECTS.map(([k, name]) => `<div class="aspect" role="group" aria-label="${o.key}안 ${name}">
                <span class="a-name">${name}</span>
                <button type="button" class="mark" data-aspect="${k}" data-opt="${o.key}" value="like" aria-pressed="false">좋다</button>
                <button type="button" class="mark" data-aspect="${k}" data-opt="${o.key}" value="dislike" aria-pressed="false">별로</button>
              </div>`).join('\n              ')}
            </fieldset>
            <label class="memo" for="note-${esc(r.id)}-${o.key}">${o.key}안 메모(선택) <textarea id="note-${esc(r.id)}-${o.key}" data-note-opt="${o.key}" rows="3" placeholder="이 안에서 마음에 드는 점이나 걸리는 점"></textarea></label>
          </div>
        </div>
      </div>`
}

function tech(r) {
  const opt = (o) => `<div class="tech-opt">
          <h4>${o.key}안</h4>
          <dl>
            <div><dt>색 논리</dt><dd>${esc(o.tech.colorLogic)}</dd></div>
            <div><dt>모션</dt><dd>${esc(o.tech.motion)}</dd></div>
            <div><dt>역동 기법</dt><dd>${o.tech.dynamics.map(esc).join(' · ')}</dd></div>
            <div><dt>첫 화면 구성</dt><dd><code>${esc(o.hero)}</code></dd></div>
            <div><dt>출처 분류</dt><dd>${esc(o.tech.source)}</dd></div>
          </dl>
          <ul class="swatches" aria-label="${o.key}안 팔레트(${r.theme === 'dark' ? '다크' : '라이트'})">${o.tech.swatches.map((s) => `<li><span class="sw" style="background:${s.hex}"></span><code>${s.hex}</code> <span class="role">${esc(s.role)}</span></li>`).join('')}</ul>
        </div>`
  return `<details class="tech">
      <summary>기술 정보</summary>
      <div class="tech-body">
        <p class="tech-meta">DNA 카드 <code>${esc(r.card)}</code> · AI 티 ${r.aiTell ?? '확인 안 됨'}${r.aiTell != null ? '점(기준 r1 12)' : ''} · 기본 테마 ${r.theme === 'dark' ? '다크' : '라이트'}</p>
        <div class="tech-grid">
        ${r.options.map(opt).join('\n        ')}
        </div>
      </div>
    </details>`
}

// 고르기 질문: 안이 둘 이상이면 「이 안이 가장 좋다」, 하나뿐이면(r5 — 2판에서 B를 뺐다) 「이 안으로 정할까요」.
function pickRadios(r) {
  const radio = (value, text, idPart) => `<label class="radio"><input type="radio" name="pick-${esc(r.id)}" id="pick-${esc(r.id)}-${idPart}" value="${value}" data-pick> <span>${text}</span></label>`
  if (r.options.length === 1) {
    const k = r.options[0].key
    return `<legend>이 안으로 정할까요</legend>
        <div class="radios">${radio(k, `${k}안으로 정한다`, k)}${radio('', '정하지 않음', 'none')}</div>`
  }
  return `<legend>이 안이 가장 좋다</legend>
        <div class="radios">${r.options.map((o) => radio(o.key, `${o.key}안`, o.key)).join('')}${radio('', '고르지 않음', 'none')}</div>`
}

function card(r, i, all) {
  const prev = all[i - 1], next = all[i + 1]
  return `<article class="card" id="card-${esc(r.id)}" data-recipe="${esc(r.id)}" aria-labelledby="t-${esc(r.id)}">
    <header class="card-head">
      <p class="no">${i + 1} / ${all.length}</p>
      <h2 id="t-${esc(r.id)}">${esc(r.name)}</h2>
      <p class="mood" title="${esc(r.mood)}">${esc(r.mood)}</p>
      <p class="changes">${esc(r.changes)}</p>
    </header>
    ${r.options.map((o) => option(r, o)).join('\n    ')}
    <div class="answer">
      <fieldset class="pick">
        ${pickRadios(r)}
      </fieldset>
      <p class="prev" data-prev-recipe="3" hidden></p>
      <p class="prev" data-prev-recipe="2" hidden></p>
      <label class="memo" for="note-${esc(r.id)}">레시피 전체 메모(선택) <textarea id="note-${esc(r.id)}" data-note rows="2" placeholder="두 안을 함께 보고 떠오른 점"></textarea></label>
    </div>
    <p class="save" role="status" data-save>아직 고르지 않았습니다.</p>
    ${tech(r)}
    <div class="steps">
      ${prev ? `<a class="step" href="#card-${esc(prev.id)}" data-step="prev">← 이전 레시피 · ${esc(prev.name)}</a>` : '<span></span>'}
      ${next ? `<a class="step next" href="#card-${esc(next.id)}" data-step="next">다음 레시피 · ${esc(next.name)} →</a>` : '<a class="step next" href="#board-top" data-step="top">처음으로 ↑</a>'}
    </div>
  </article>`
}

const THEME_LIGHT = '--bg: #f4f5f7; --panel: #ffffff; --ink: #16181d; --muted: #545a66; --line: #d6d9df; --line-strong: #767c87; --chip: #eceef2; --accent: #1f5f8b; --like: #1d6b3a; --dislike: #9b2c22;'
const THEME_DARK = '--bg: #121417; --panel: #1a1d22; --ink: #eceef2; --muted: #a9afba; --line: #343a44; --line-strong: #7d8592; --chip: #242830; --accent: #7fb6dd; --like: #74cf92; --dislike: #ff9387;'
const CSS = `
:root { ${THEME_LIGHT} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${THEME_DARK} color-scheme: dark; } }
:root[data-theme="dark"] { ${THEME_DARK} color-scheme: dark; }
* { box-sizing: border-box; }
html { scroll-padding-top: 76px; }
body { background: var(--bg); color: var(--ink); font-family: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; font-size: 16px; line-height: 1.6; margin: 0; padding-inline: 16px; padding-block: 0 48px; }
h1, h2, h3, h4 { text-wrap: balance; line-height: 1.25; margin: 0; }
code { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; font-size: 0.85em; }
button, input, textarea { font: inherit; }
.wrap { max-width: 1360px; margin-inline: auto; display: flex; flex-direction: column; gap: 28px; }
main { display: flex; flex-direction: column; gap: 28px; }
.intro { display: flex; flex-direction: column; gap: 8px; padding-block: 32px 0; }
.intro h1 { font-size: 1.75rem; }
.intro p { margin: 0; max-width: 66ch; }
.intro .sub { color: var(--muted); font-size: 0.9375rem; }
.toc ul { display: flex; flex-wrap: wrap; gap: 0 4px; margin: 0; padding: 0; list-style: none; font-size: 0.9375rem; }
.toc a { color: var(--ink); display: inline-flex; min-height: 44px; align-items: center; padding-inline: 8px; }
.toc a[data-done="true"]::after { content: " ✓"; color: var(--like); }
.bar { position: sticky; top: 0; z-index: 5; background: var(--panel); border: 1px solid var(--line); padding: 10px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
.bar .count { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; }
.bar .count span { font-size: 1.25rem; }
.bar .status { margin: 0; color: var(--muted); font-size: 0.875rem; }
.bar .status.err { color: var(--dislike); }
.card { background: var(--panel); border: 1px solid var(--line); padding: 24px; display: flex; flex-direction: column; gap: 24px; }
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; }
.card-head .no { margin: 0; color: var(--muted); font-variant-numeric: tabular-nums; font-size: 0.9375rem; }
.card-head h2 { font-size: 1.625rem; }
.mood { margin: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.changes { margin: 0; flex-basis: 100%; font-size: 0.9375rem; }
.edition { margin: 0; align-self: flex-start; padding: 4px 12px; border: 1px solid var(--line-strong); font-weight: 600; font-size: 0.9375rem; }
.prev { margin: 0; color: var(--muted); font-size: 0.875rem; overflow-wrap: anywhere; }
.prev[hidden] { display: none; }
.opt { display: flex; flex-direction: column; gap: 14px; padding-block-start: 20px; border-top: 1px solid var(--line); min-width: 0; }
.opt-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.opt-tag { font-size: 1.375rem; }
.opt-head .fonts { margin: 0; color: var(--muted); font-size: 0.9375rem; flex: 1 1 16rem; }
.big, .v-btn { min-height: 44px; padding: 0 18px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font-weight: 600; cursor: pointer; }
figure { margin: 0; min-width: 0; }
.desk { position: relative; }
.desk video { display: block; width: 100%; height: auto; aspect-ratio: 1440 / 900; background: var(--chip); border: 1px solid var(--line); object-fit: cover; }
.play { position: absolute; inset-inline-end: 10px; inset-block-end: 10px; min-height: 44px; min-width: 44px; padding: 0 14px; border: 0; background: color-mix(in srgb, var(--ink) 82%, transparent); color: var(--panel); font-size: 0.875rem; cursor: pointer; }
.detail { display: grid; gap: 20px 28px; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 900px) { .detail { grid-template-columns: 375px minmax(0, 1fr); } }
.phone { display: flex; flex-direction: column; gap: 4px; }
.phone img { display: block; width: min(375px, 100%); height: auto; aspect-ratio: 375 / 812; border: 1px solid var(--line); background: var(--chip); }
.phone figcaption { font-size: 0.875rem; color: var(--muted); }
.feedback { display: flex; flex-direction: column; gap: 18px; min-width: 0; max-width: 40rem; }
.rate { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rate .q { grid-column: 1 / -1; margin: 0; font-weight: 700; }
.like { min-height: 52px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font-weight: 600; font-size: 1.0625rem; cursor: pointer; }
.like[value="like"][aria-pressed="true"], .mark[value="like"][aria-pressed="true"] { background: var(--like); border-color: var(--like); color: var(--panel); }
.like[value="dislike"][aria-pressed="true"], .mark[value="dislike"][aria-pressed="true"] { background: var(--dislike); border-color: var(--dislike); color: var(--panel); }
fieldset { border: 1px solid var(--line); margin: 0; padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
legend { font-weight: 600; padding-inline: 4px; }
.aspect { display: grid; grid-template-columns: 5.5em 1fr 1fr; gap: 8px; align-items: center; }
.a-name { font-weight: 600; }
.mark { min-height: 44px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); cursor: pointer; }
.answer { display: grid; gap: 12px 24px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); align-items: start; padding-block-start: 20px; border-top: 1px solid var(--line); }
.radios { display: flex; flex-wrap: wrap; gap: 8px; }
.radio { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1px solid var(--line-strong); cursor: pointer; }
.radio input { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; }
.radio:has(input:checked) { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.memo { display: flex; flex-direction: column; gap: 4px; font-size: 0.9375rem; color: var(--muted); }
textarea { color: var(--ink); background: var(--panel); border: 1px solid var(--line-strong); padding: 8px 10px; min-height: 64px; width: 100%; }
.save { margin: 0; font-size: 0.875rem; color: var(--muted); }
.save.err { color: var(--dislike); }
.tech summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--muted); font-size: 0.9375rem; }
.tech-body { display: flex; flex-direction: column; gap: 12px; padding-block: 8px 0; font-size: 0.875rem; }
.tech-meta { margin: 0; color: var(--muted); }
.tech-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.tech-opt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.tech-opt h4 { font-size: 0.9375rem; }
.tech-opt dl { margin: 0; display: grid; gap: 2px; }
.tech-opt dl div { display: flex; gap: 8px; }
.tech-opt dt { color: var(--muted); min-width: 6em; }
.tech-opt dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.swatches { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px 12px; }
.swatches li { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 18px; height: 18px; border: 1px solid var(--line); display: inline-block; }
.role { color: var(--muted); }
.steps { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
.step { display: inline-flex; align-items: center; min-height: 48px; padding: 0 18px; border: 1px solid var(--line-strong); color: var(--ink); text-decoration: none; font-weight: 600; }
.step.next { margin-inline-start: auto; }
.foot { margin: 0; font-size: 0.875rem; color: var(--muted); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
dialog.viewer { width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: var(--bg); color: var(--ink); }
dialog.viewer[open] { display: flex; flex-direction: column; }
dialog.viewer::backdrop { background: color-mix(in srgb, var(--ink) 60%, transparent); }
.v-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
.v-head h2 { font-size: 1.125rem; margin-inline-end: auto; }
.seg { display: inline-flex; }
.seg .v-btn + .v-btn { border-inline-start: 0; }
.v-btn[aria-pressed="true"] { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.v-close { font-weight: 700; }
.v-stage { flex: 1; overflow: auto; padding: 16px; }
.v-video { display: block; width: 1440px; height: 900px; max-width: none; background: var(--chip); }
.v-phone { display: block; width: 375px; height: auto; max-width: none; }
.v-stage [hidden] { display: none; }
@media (max-width: 560px) {
  .card { padding: 16px; }
  .v-stage { padding: 0; }
  .aspect { grid-template-columns: 4.5em 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } .play { background: var(--ink); } }
`

const SCRIPT = `
const DATA = JSON.parse(document.getElementById('board-data').textContent);
const COLLECTION = "likes";
const BOARD = ${BOARD};
const KEYS = ['A', 'B'];
const LIKE = ['like', 'dislike'];
const ASPECTS = ${JSON.stringify(ASPECTS)};
const ASPECT_KEYS = ASPECTS.map(([k]) => k);
const answers = () => ({ likes: {}, aspects: { A: {}, B: {} }, notes: { A: '', B: '' }, note: '', pick: null });
// p3: 3판 답(3판 문서 본문, 3판 글자), p2: 2판 답(2판 문서 원본, 2판 글자) — 4판 쓰기가 v3·v2 로 그대로 싣는다(update 는 아예 건드리지 않는다). 없으면 null.
const blank = () => ({ ...answers(), p3: null, p2: null });
const state = Object.fromEntries(DATA.map((r) => [r.id, blank()]));
const $ = (s, el = document) => el.querySelector(s);
const cardOf = (id) => document.getElementById('card-' + id);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 답 읽기: 옛 모양({likes,pick?,note?})과 aspects·notes 를 더한 모양을 모두 읽는다. 모르는 값은 버린다. ──
function parse(v) {
  const s = answers();
  if (!v || typeof v !== 'object') return s;
  for (const k of KEYS) if (v.likes && LIKE.includes(v.likes[k])) s.likes[k] = v.likes[k];
  for (const k of KEYS) for (const a of ASPECT_KEYS) { const x = v.aspects && v.aspects[k] && v.aspects[k][a]; if (LIKE.includes(x)) s.aspects[k][a] = x; }
  for (const k of KEYS) if (v.notes && typeof v.notes[k] === 'string') s.notes[k] = v.notes[k];
  if (typeof v.note === 'string') s.note = v.note;
  if (KEYS.includes(v.pick)) s.pick = v.pick;
  return s;
}
// ── 문서 모양: 4판 답은 문서 안 v4 한 칸 { board: 4, likes, aspects?, notes?, note?, pick?, decidedAt } 에만 쓴다(SLOT). 문서의 나머지는 건드리지 않는다.
//   board 3 문서(지금 저장된 10벌): 본문 = 3판 답(3판 글자, v2·v4 를 뺀 사본), v2 = 2판 답. 그보다 옛 모양(board 없음): 문서 전체(v4 뺌)가 2판 답.
//   4판이 새로 만든 문서: { recipe, board: 4, v4 } — 이전 판 답이 없다. 4판 답이 없으면 빈 채로 시작한다(운영자가 이전 답을 보며 다시 고른다).
const SLOT = 'v' + BOARD;
const obj = (x) => (x && typeof x === 'object' ? clone(x) : null);
function normalize(v) {
  if (!v || typeof v !== 'object') return blank();
  const cur = parse(v[SLOT]);
  const top = clone(v); delete top[SLOT];
  if (v.board === BOARD) return { ...cur, p3: null, p2: null };
  if (v.board === 3) { delete top.v2; return { ...cur, p3: top, p2: obj(v.v2) }; }
  return { ...cur, p3: null, p2: top };
}
// 새 문서(원격에 없을 때만 set): 4판 답 전체를 v4 에. 있는 문서는 update 로 v4 안의 바뀐 칸만 쓴다(patchOf).
function bodyOf(id, s) {
  const d = { board: BOARD, likes: {} };
  for (const k of KEYS) if (s.likes[k]) d.likes[k] = s.likes[k];
  const asp = {}; for (const k of KEYS) if (Object.keys(s.aspects[k]).length) asp[k] = { ...s.aspects[k] };
  if (Object.keys(asp).length) d.aspects = asp;
  const notes = {}; for (const k of KEYS) if (s.notes[k].trim()) notes[k] = s.notes[k].trim();
  if (Object.keys(notes).length) d.notes = notes;
  if (s.note.trim()) d.note = s.note.trim();
  if (s.pick) d.pick = s.pick;
  return { recipe: id, board: BOARD, [SLOT]: d };
}
// 고친 칸의 경로(likes.A · aspects.A.color · notes.A · note · pick) — 저장된 답과 합칠 때 이 칸만 내 값으로 덮는다.
function getPath(s, p) { const [a, b, c] = p.split('.'); return c ? s[a][b][c] : b ? s[a][b] : s[a]; }
function setPath(s, p, v) {
  const [a, b, c] = p.split('.');
  if (c) { if (v == null) delete s[a][b][c]; else s[a][b][c] = v; }
  else if (b) { if (a === 'likes') { if (v == null) delete s.likes[b]; else s.likes[b] = v; } else s[a][b] = v || ''; }
  else s[a] = a === 'pick' ? (v || null) : (v || '');
}
// 칸의 저장 값(비교·쓰기용): 메모는 앞뒤 공백을 뺀 글, 나머지는 값 또는 null(지운 칸 — update 로 null 을 쓰면 읽을 때 버린다).
function val(s, p) { const v = getPath(s, p); return p === 'note' || p.startsWith('notes.') ? String(v || '').trim() : (v || null); }
// 바뀐 칸만의 update 본문 { v4: { board, …바뀐 칸, decidedAt } } — 겹친 객체는 합쳐진다: v4 의 다른 칸(다른 탭이 고친 것)·3판 본문·v2 는 그대로 남는다.
function patchOf(values, at) {
  const d = { board: BOARD };
  for (const [p, v] of Object.entries(values)) {
    const [a, b, c] = p.split('.');
    if (c) { d[a] = d[a] || {}; d[a][b] = d[a][b] || {}; d[a][b][c] = v; }
    else if (b) { d[a] = d[a] || {}; d[a][b] = v; }
    else d[a] = v;
  }
  d.decidedAt = at;
  return { [SLOT]: d };
}
function withValues(base, values) { const s = clone(base); for (const [p, v] of Object.entries(values)) setPath(s, p, v); return s; }

// ── 영상: 동작 줄이기면 포스터를 보이고 멈춘다(재생 버튼으로만 튼다). 화면 밖 영상과 크게 보기가 열린 동안의 카드 영상은 쉰다. ──
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const videos = [...document.querySelectorAll('.desk video')];
const held = new WeakSet(); // 사람이 멈춘 영상
const visible = new WeakSet();
let viewerOpen = false;
function label(v) {
  const b = v.parentElement.querySelector('[data-play]'); const name = v.getAttribute('aria-label').replace(' 첫 화면 영상 ${SPAN}초', '');
  const on = !v.paused;
  b.textContent = on ? '일시정지' : '재생';
  b.setAttribute('aria-label', name + ' 영상 ' + (on ? '일시정지' : '재생'));
}
function want(v) { return !reduce.matches && !held.has(v) && visible.has(v) && !viewerOpen; }
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
reduce.addEventListener('change', () => { applyMotion(); renderViewer(); });
applyMotion();

// ── 크게 보기: 페이지 안 <dialog>. 영상은 1440px 원래 크기(넘치면 스크롤), 휴대폰은 375px. A↔B 는 같은 요소의 파일만 바꿔 같은 크기·같은 자리. ──
const viewer = document.getElementById('viewer');
const vVideo = $('.v-video', viewer), vPhone = $('.v-phone', viewer), vStage = $('.v-stage', viewer), vPlay = $('[data-v-play]', viewer);
const vs = { id: null, opt: 'A', view: 'desk', opener: null, vheld: false };
const pickSrc = (o) => (vVideo.canPlayType('video/mp4') ? 'video/' + o.mp4 : 'video/' + o.webm);
function renderViewer() {
  if (!vs.id) return;
  const r = DATA.find((x) => x.id === vs.id); const o = r.options.find((x) => x.key === vs.opt) || r.options[0];
  $('#viewer-title').textContent = r.name + ' · ' + o.key + '안 · ' + (vs.view === 'desk' ? '컴퓨터 화면 1440' : '휴대폰 화면 375');
  for (const b of viewer.querySelectorAll('[data-v-opt]')) { b.setAttribute('aria-pressed', String(b.dataset.vOpt === o.key)); b.hidden = !r.options.some((x) => x.key === b.dataset.vOpt); }
  for (const b of viewer.querySelectorAll('[data-v-view]')) b.setAttribute('aria-pressed', String(b.dataset.vView === vs.view));
  const src = pickSrc(o);
  if (vVideo.dataset.src !== src) {
    const t = vVideo.currentTime || 0;
    vVideo.poster = 'shots/' + o.poster; vVideo.src = src; vVideo.dataset.src = src;
    vVideo.addEventListener('loadedmetadata', () => { try { vVideo.currentTime = Math.min(t, (vVideo.duration || 6) - 0.05); } catch (e) {} }, { once: true });
  }
  vPhone.src = 'shots/' + o.phone; vPhone.alt = r.name + ' ' + o.key + '안 휴대폰 첫 화면';
  vVideo.hidden = vs.view !== 'desk'; vPlay.hidden = vs.view !== 'desk'; vPhone.hidden = vs.view !== 'phone';
  const play = viewerOpen && vs.view === 'desk' && !reduce.matches && !vs.vheld;
  if (play) vVideo.play().catch(() => {}); else vVideo.pause();
  vPlay.textContent = vVideo.paused && !play ? '재생' : '일시정지';
}
function openViewer(id, opt, opener) {
  Object.assign(vs, { id, opt, view: 'desk', opener, vheld: false });
  viewerOpen = true; for (const v of videos) sync(v);
  viewer.showModal();
  renderViewer();
  vStage.scrollTo(0, 0);
}
viewer.addEventListener('close', () => {
  viewerOpen = false; vVideo.pause();
  for (const v of videos) sync(v);
  if (vs.opener) vs.opener.focus();
});
viewer.addEventListener('click', (e) => {
  const o = e.target.closest('[data-v-opt]'); if (o) { vs.opt = o.dataset.vOpt; renderViewer(); return; }
  const w = e.target.closest('[data-v-view]'); if (w) { vs.view = w.dataset.vView; renderViewer(); return; }
  if (e.target.closest('[data-v-close]')) { viewer.close(); return; }
  if (e.target.closest('[data-v-play]')) { if (vVideo.paused) { vs.vheld = false; vVideo.play().catch(() => {}); } else { vs.vheld = true; vVideo.pause(); } vPlay.textContent = vVideo.paused ? '재생' : '일시정지'; }
});
vVideo.addEventListener('play', () => { vPlay.textContent = '일시정지'; });
vVideo.addEventListener('pause', () => { vPlay.textContent = '재생'; });

// ── 판정 상태 → 화면 ──
function progress() {
  let n = 0;
  for (const r of DATA) {
    const s = state[r.id]; const done = r.options.every((o) => !!s.likes[o.key]);
    if (done) n++;
    const a = document.querySelector('.toc a[href="#card-' + r.id + '"]'); if (a) a.dataset.done = String(done);
  }
  $('#progress').textContent = String(n);
}
function renderCard(id) {
  const c = cardOf(id), s = state[id];
  for (const b of c.querySelectorAll('[data-like]')) b.setAttribute('aria-pressed', String(s.likes[b.dataset.like] === b.value));
  for (const b of c.querySelectorAll('[data-aspect]')) b.setAttribute('aria-pressed', String(s.aspects[b.dataset.opt][b.dataset.aspect] === b.value));
  for (const i of c.querySelectorAll('input[data-pick]')) i.checked = i.value === (s.pick || '');
  const t = c.querySelector('textarea[data-note]'); if (t && document.activeElement !== t) t.value = s.note;
  for (const x of c.querySelectorAll('textarea[data-note-opt]')) if (document.activeElement !== x) x.value = s.notes[x.dataset.noteOpt];
  renderPrior(id);
}
// 이전 판 답(작은 흐린 줄): 선택지마다 그 안의 그 판 글자(v3Key·v2Key — letterKeys 가 합성·검산한 것)로 읽는다. 문서가 없으면 숨긴다.
const word = (x) => (x === 'like' ? '좋다' : '별로');
function priorText(round, raw, k, key) {
  if (!raw) return '';
  const p = parse(raw), parts = [];
  if (k && p.likes[k]) parts.push(word(p.likes[k]));
  if (k) for (const [a, name] of ASPECTS) if (p.aspects[k][a]) parts.push(name + ' ' + word(p.aspects[k][a]));
  let t = round + '판 답: ' + (parts.length ? parts.join(' · ') : '없음');
  if (k && k !== key) t += ' (' + round + '판 ' + k + '안)';
  if (k && p.notes[k]) t += ' · ' + round + '판 메모 「' + p.notes[k] + '」';
  return t;
}
function renderPrior(id) {
  const c = cardOf(id), r = DATA.find((x) => x.id === id), s = state[id];
  const rounds = [[3, s.p3, 'v3Key'], [2, s.p2, 'v2Key']];
  for (const o of r.options) for (const [round, raw, keyOf] of rounds) {
    const el = c.querySelector('[data-prev="' + o.key + '"][data-round="' + round + '"]'); if (!el) continue;
    const t = priorText(round, raw, o[keyOf], o.key); el.textContent = t; el.hidden = !t;
  }
  for (const [round, raw, keyOf] of rounds) {
    const el = c.querySelector('[data-prev-recipe="' + round + '"]'); if (!el) continue;
    const p = raw ? parse(raw) : null, bits = [];
    if (p && p.pick) { const now = r.options.find((o) => o[keyOf] === p.pick); bits.push(round + '판에서 고른 안: ' + (now ? '지금의 ' + now.key + '안' : round + '판 ' + p.pick + '안(지금 보드에서 뺐다)')); }
    if (p && p.note) bits.push(round + '판 전체 메모 「' + p.note + '」');
    el.textContent = bits.join(' · '); el.hidden = !bits.length;
  }
}
function setSave(id, text, err) { const p = cardOf(id).querySelector('[data-save]'); p.textContent = text; p.classList.toggle('err', !!err); }
function setStatus(text, err) { const p = $('#db-status'); p.textContent = text; p.classList.toggle('err', !!err); }
const clock = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

// ── 저장(리뷰 14 #1·#2): 문서마다 원격 상태를 읽은 뒤에만 쓴다. 고친 칸(dirty)은 쓰기가 끝날 때까지 남아 스냅숏 위에 다시 얹힌다.
//   remote[id] = 마지막으로 안 원격 상태 { s: normalize 결과, exists, board } · loaded[id] = 서버가 확정한 읽기(스냅숏·get)를 받았다.
//   dbState: pending(use 대기) → loading(첫 스냅숏 대기) → ready | blocked(구독이 끊겨 다시 읽는 중 — 쓰지 않는다) | none | readonly ──
let db = null;
let dbState = 'pending';
const dirty = {}, remote = {}, loaded = {}, writing = {}, noteTimers = {}, retryTimers = {}, attempts = {}, recheck = {}, savedAt = {};
const codeOf = (e) => (e && e.code) || '알 수 없음';
const FATAL = ['revoked', 'quota_exceeded', 'not_granted', 'capability_disabled', 'capability_removed'];
const backoff = (n) => Math.min(30000, 1000 * 2 ** Math.max(0, n - 1)) + Math.floor(Math.random() * 400);
function touch(id, path) { (dirty[id] || (dirty[id] = new Set())).add(path); }
// 아직 원격과 다른 내 칸(같은 값은 다시 쓰지 않는다 — L5).
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
// 원격 상태를 받는다(스냅숏·get). sure: 서버가 확정한 읽기. 아직 쓰지 않은 내 칸은 새 원격 위에 다시 얹는다(리뷰 14 #2 — 건너뛰고 잊지 않는다).
function acceptRemote(id, v, sure) {
  const cur = state[id];
  remote[id] = v ? { s: normalize(v), exists: true } : { s: blank(), exists: false };
  if (sure) loaded[id] = true;
  const s = clone(remote[id].s); for (const p of (dirty[id] || [])) setPath(s, p, getPath(cur, p));
  state[id] = s; renderCard(id);
  const when = v && v[SLOT] && v[SLOT].decidedAt;
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
      else { const body = bodyOf(id, withValues(r.s, values)); body[SLOT].decidedAt = at; await ref.set(body); }
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
  setPath(state[id], path, value); touch(id, path);
  renderCard(id); progress();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-like]');
  if (b) { const id = b.closest('.card').dataset.recipe, k = b.dataset.like; change(id, 'likes.' + k, state[id].likes[k] === b.value ? null : b.value); requestSave(id); return; }
  const m = e.target.closest('[data-aspect]');
  if (m) { const id = m.closest('.card').dataset.recipe, p = 'aspects.' + m.dataset.opt + '.' + m.dataset.aspect; change(id, p, getPath(state[id], p) === m.value ? null : m.value); requestSave(id); return; }
  const g = e.target.closest('[data-big]');
  if (g) { openViewer(g.closest('.card').dataset.recipe, g.dataset.big, g); return; }
  const p = e.target.closest('[data-play]');
  if (p) { const v = p.parentElement.querySelector('video'); if (v.paused) { held.delete(v); v.play().catch(() => {}); } else { held.add(v); v.pause(); } }
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!el.matches('input[data-pick]')) return;
  const id = el.closest('.card').dataset.recipe; change(id, 'pick', el.value || null); requestSave(id);
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.matches('textarea[data-note], textarea[data-note-opt]')) return;
  const id = el.closest('.card').dataset.recipe;
  setPath(state[id], el.dataset.noteOpt ? 'notes.' + el.dataset.noteOpt : 'note', el.value); touch(id, el.dataset.noteOpt ? 'notes.' + el.dataset.noteOpt : 'note');
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

export function buildBoard2(data, { generatedAt = '' } = {}) {
  const json = JSON.stringify(data.map((r) => ({ id: r.id, name: r.name, options: r.options.map((o) => ({ key: o.key, v3Key: o.v3Key ?? null, v2Key: o.v2Key ?? null, mp4: o.mp4, webm: o.video, poster: o.poster, phone: o.phone })) }))).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>레시피 보드 4판</title>
<meta name="description" content="레시피 ${data.length}벌의 안을 모션·실사를 반영한 움직이는 첫 화면으로 크게 보고, 3판·2판 답을 곁에 두고 다시 고르는 보드">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap" id="board-top">
  <header class="intro">
    <p class="edition">${EDITION}</p>
    <h1>레시피 보드 4판</h1>
    <p>${INTRO}</p>
    <p class="sub">안마다 「좋다」나 「별로」를 누르면 됩니다. 3판과 2판에서 남긴 답은 안마다 작은 글씨로 보이니(3판에서 고른 안은 이제 A안입니다), 그것과 견주어 다시 골라 주세요. 색감·글씨체·배치·움직임을 따로 고르거나 메모를 남기는 것은 하고 싶을 때만 합니다. 카드 아래 「다음 레시피」로 한 벌씩 넘어갈 수 있습니다.</p>
    <nav class="toc" aria-label="레시피 바로 가기"><ul>${data.map((r, i) => `<li><a href="#card-${esc(r.id)}" data-done="false">${i + 1}. ${esc(r.name)}</a></li>`).join('')}</ul></nav>
  </header>
  <div class="bar">
    <p class="count" aria-live="polite"><span id="progress">0</span>/${data.length} 레시피 판정</p>
    <p class="status" id="db-status" role="status">저장 기능을 확인하는 중입니다.</p>
  </div>
  <main>
  ${data.map(card).join('\n  ')}
  </main>
  <p class="foot">영상·화면 ${generatedAt ? `${esc(generatedAt)} 촬영` : '촬영 시각 확인 안 됨'} · 문구는 모두 예시입니다. 실사 사진·영상은 운영자 계정 생성물과 상업 사용이 허락된 사진 자료이고, 출처는 저장소의 출처 목록에 있습니다. 레시피의 안을 모두 「좋다·별로」로 고르면 판정으로 셉니다.</p>
</div>
<dialog class="viewer" id="viewer" aria-labelledby="viewer-title">
  <div class="v-head">
    <h2 id="viewer-title">크게 보기</h2>
    <div class="seg" role="group" aria-label="안 바꾸기"><button type="button" class="v-btn" data-v-opt="A" aria-pressed="true">A안</button><button type="button" class="v-btn" data-v-opt="B" aria-pressed="false">B안</button></div>
    <div class="seg" role="group" aria-label="화면 바꾸기"><button type="button" class="v-btn" data-v-view="desk" aria-pressed="true">컴퓨터 1440</button><button type="button" class="v-btn" data-v-view="phone" aria-pressed="false">휴대폰 375</button></div>
    <button type="button" class="v-btn" data-v-play>일시정지</button>
    <button type="button" class="v-btn v-close" data-v-close>닫기</button>
  </div>
  <div class="v-stage" tabindex="0" aria-label="크게 보는 화면 — 화면보다 크면 스크롤합니다">
    <video class="v-video" width="1440" height="900" muted loop playsinline preload="auto" aria-label="크게 보는 첫 화면 영상"></video>
    <img class="v-phone" width="375" height="812" alt="" hidden>
  </div>
</dialog>
<script type="application/json" id="board-data">${json}</script>
<script>
${SCRIPT}
</script>
</body>
</html>
`
}

// 아티팩트 게시본(Task 13): 게시 호스트가 문서 뼈대를 대므로 <!doctype>·<html>·<head>·<body> 태그(여닫이)를 뺀다. <title>·<meta>·서체 <link>·<style> 은
// 맨 위에 그대로 남고, 본문과 스크립트는 그 뒤에 온다.
export const artifactHtml = (html) => html.replace(/^<!doctype html>\n/i, '').replace(/^<\/?(html|head|body)(\s[^>]*)?>\n/gm, '')

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d }
  const mf = flag('--manifest', join(OUT2, 'manifest.json'))
  const out = flag('--out', join(ROOT, 'factory', 'board', 'recipe-board', 'board2.html'))
  const publish = flag('--publish', null)
  if (!existsSync(mf)) { console.error(`도구 실패: ${mf} 가 없다 — 먼저 video.mjs`); process.exit(1) }
  const manifest = JSON.parse(readFileSync(mf, 'utf8'))
  const dir = join(mf, '..')
  // 목록의 크기와 실제 파일이 다르면(도중에 실패한 촬영이 일부만 덮은 경우) 보드를 만들지 않는다(리뷰 L4).
  const stale = manifest.files.filter((f) => !existsSync(join(dir, f.file)) || statSync(join(dir, f.file)).size !== f.bytes).map((f) => f.file)
  if (stale.length) { console.error(`도구 실패: 목록과 다른 파일 ${stale.length}개(${stale.slice(0, 5).join(', ')}) — video.mjs 를 다시 돌린다`); process.exit(1) }
  const ai = aiTellScores(readFileSync(join(ROOT, 'docs', 'qa', 'ai-tell-baseline.md'), 'utf8'))
  let data
  try { data = board2Data(loadHeads(), manifest, ai) } catch (e) { console.error(`도구 실패: ${e.message}`); process.exit(1) }
  const missing = data.flatMap((r) => r.options.filter((o) => !o.captured).map((o) => `${r.id} ${o.key}`))
  if (missing.length) { console.error(`도구 실패: 촬영 파일 없는 안 ${missing.join(', ')}`); process.exit(1) }
  const html = buildBoard2(data, { generatedAt: manifest.generatedAt })
  writeFileSync(out, html)
  console.log(`board 4판: ${data.length}벌 · 안 ${data.reduce((n, r) => n + r.options.length, 0)}개 → ${out} (파일 ${manifest.count}개 · ${manifest.totalMB}MB)`)
  if (publish) {
    for (const d of ['shots', 'video']) mkdirSync(join(publish, d), { recursive: true })
    writeFileSync(join(publish, 'board4.html'), artifactHtml(html))
    for (const f of manifest.files) copyFileSync(join(dir, f.file), join(publish, f.kind === 'video' ? 'video' : 'shots', f.file))
    console.log(`게시 묶음: ${publish} (board4.html — 뼈대 태그 뺀 게시본 + shots ${manifest.files.filter((f) => f.kind === 'still').length} + video ${manifest.files.filter((f) => f.kind === 'video').length})`)
  }
}
