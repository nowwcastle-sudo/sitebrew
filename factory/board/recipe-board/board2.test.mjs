// 레시피 보드 v2 검사(Task 10f): node --test --test-force-exit --test-timeout=60000 "factory/board/recipe-board/*.test.mjs"
// 보드 HTML 은 원천 머리(loadHeads — hero·alternates 가 있다)와 가짜 촬영 목록(optionJobs 그대로)으로 만든다 — 서버·Chrome·ffmpeg 없이 돈다.
// video.mjs 는 순수 함수(앞 프레임 자르기·concat 목록·ffmpeg 인자·목록 모양)만, gates.mjs 는 히어로 유채 픽셀 판정(§2b)의 순수 부분만 본다.
// 페이지 스크립트의 동작(db 준비 전 저장·합치기·읽기 전용·동작 줄이기·크게 보기·배치)은 board2.behavior.test.mjs 가 headless Chrome 에서 돌린다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBoard2, board2Data, COLLECTION, INTRO, EDITION, ASPECTS, dnaSources, fontCaption, toHex, v2Keys, v3Keys, letterKeys, changesOf, artifactHtml } from './build2.mjs'
import { optionJobs, frameUrl, trimLeading, concatList, ffmpegArgs, manifestOf, checkManifest, naturalOrder, sawFont, SPAN, VIDEO_MAX, TOTAL_MAX, CRF_STEPS } from './video.mjs'
import { oklabChroma, CHROMA_MIN, PIXEL_SHARE_MIN } from './gates.mjs'
import { loadHeads, loadBoardHeads, optionsOf, faceGateKind, ROOT } from './jobs.mjs'
import { BOLD_LOGICS } from '../../scripts/recipe.mjs'

// 이 시험은 게시한 4판 보드의 레시피(고정본 heads-at-board.json 의 10벌)를 본다. 라이브러리에 r12~r16 이 확정으로 들어와도(FV1 레인 DRAFTS) 4판 기록은 그대로이고,
// 새 레시피는 보드 A2(scene-board)에서 판정했다 — 판정 기록 파일(recipe-board*-decisions.json)에는 새 레시피 항목이 없다.
const BOARD_IDS = new Set(loadBoardHeads().map((h) => h.id))
const heads = loadHeads().filter((h) => BOARD_IDS.has(h.id))
const fakeOptions = (hs, over = {}) => optionJobs(hs).map((j) => ({
  recipe: j.recipe, option: j.option, theme: j.theme, hero: j.hero, fonts: ['Latin Face', '한글 서체'], fontsOk: true,
  videos: [{ file: j.files.mp4, codec: 'h264', bytes: 1_000_000, duration: SPAN, crf: 22, frames: 120 }, { file: j.files.video, codec: 'vp9', bytes: 900_000, duration: SPAN, crf: 26, frames: 120 }],
  displayKo: { expected: j.displayKo, seen: j.displayKo ? true : null, stills: j.displayKo ? [true, true] : [null, null] },
  stills: [[1440, 900], [375, 812]].map(([w, h]) => ({ file: j.files[w], width: w, height: h, dpr: 2, bytes: 300_000, fonts: ['Latin Face'] })),
  reducedMotion: { still: true, diff: 0, running: 0 },
  ...over,
}))
const manifest = manifestOf({ origin: 'http://localhost:3000', commit: 'test', generatedAt: '2026-09-28T00:00:00.000Z', options: fakeOptions(heads) })
const data = board2Data(heads, manifest, { [heads[0].id]: 12 })
const html = buildBoard2(data)
const cards = (h) => [...h.matchAll(/<article class="card" id="card-([^"]+)"[\s\S]*?<\/article>/g)].map((m) => ({ id: m[1], html: m[0] }))
const columns = (c) => [...c.matchAll(/<div class="opt" data-option="([AB])" role="group"[\s\S]*?<textarea id="note-[^"]+-[AB]"[^>]*><\/textarea><\/label>/g)].map((m) => ({ key: m[1], html: m[0] }))

test('one card per recipe in natural order r1 … r10 (not a string sort), each with option A stacked above option B', () => {
  const cs = cards(html)
  assert.deepEqual(cs.map((c) => c.id), ['r1-measure', 'r2-signal', 'r3-woodblock', 'r4-evidence', 'r5-celadon', 'r6-civic', 'r7-docs', 'r8-dusk', 'r9-clay', 'r10-console'])
  assert.deepEqual(naturalOrder(heads).map((h) => h.id), cs.map((c) => c.id))
  assert.notDeepEqual(heads.map((h) => h.id), cs.map((c) => c.id), '양성 대조: 원천 순서(문자열 정렬)는 r10 이 둘째다')
  assert.equal(cs.length, 10)
  // r5-celadon: 선택 보드 2판(2026-09-28)에서 B를 버려 alternates 가 없다 — A 한 칸뿐이다(Task 10f).
  for (const c of cs) assert.deepEqual(columns(c.html).map((o) => o.key), optionsOf(heads.find((h) => h.id === c.id)).map((o) => o.key), c.id)
  assert.deepEqual(optionJobs(heads).map((j) => j.recipe).filter((x, i, a) => a.indexOf(x) === i), cs.map((c) => c.id), '촬영 순서도 자연 순서')
})

test('each card ends with previous / next recipe links (first has no previous, last returns to the top)', () => {
  const cs = cards(html)
  cs.forEach((c, i) => {
    const steps = c.html.match(/<div class="steps">[\s\S]*?<\/div>/)[0]
    if (i > 0) assert.ok(steps.includes(`href="#card-${cs[i - 1].id}" data-step="prev"`), c.id)
    else assert.doesNotMatch(steps, /data-step="prev"/)
    if (i < cs.length - 1) assert.ok(steps.includes(`href="#card-${cs[i + 1].id}" data-step="next"`), c.id)
    else assert.match(steps, /href="#board-top" data-step="top"/)
    assert.match(c.html, new RegExp(`<p class="no">${i + 1} / 10</p>`))
  })
})

test('each option: autoplaying muted looping inline video, MP4 source first then WebM, 1440 poster, 375 still at 375 CSS px, play/pause and 크게 보기', () => {
  for (const c of cards(html)) for (const o of columns(c.html)) {
    const v = o.html.match(/<video [^>]*>([\s\S]*?)<\/video>/)
    assert.ok(v, `${c.id} ${o.key}: video`)
    for (const a of ['autoplay', 'muted', 'loop', 'playsinline']) assert.match(v[0], new RegExp(`\\s${a}[\\s>]`), `${c.id} ${o.key}: ${a}`)
    assert.match(v[0], /preload="metadata"/)
    assert.ok(v[0].includes(`poster="shots/${c.id}-${o.key}-1440.webp"`), `${c.id} ${o.key}: poster`)
    const sources = [...v[1].matchAll(/<source src="([^"]+)" type="([^"]+)">/g)].map((m) => [m[1], m[2]])
    assert.deepEqual(sources, [[`video/${c.id}-${o.key}.mp4`, 'video/mp4'], [`video/${c.id}-${o.key}.webm`, 'video/webm']], `${c.id} ${o.key}: MP4 먼저`)
    assert.match(o.html, new RegExp(`<img src="shots/${c.id}-${o.key}-375\\.webp" width="375" height="812"`), `${c.id} ${o.key}: 375 still`)
    assert.match(o.html, /<button type="button" class="play" data-play/, `${c.id} ${o.key}: play/pause control`)
    assert.match(o.html, new RegExp(`<button type="button" class="big" data-big="${o.key}" aria-haspopup="dialog">크게 보기</button>`), `${c.id} ${o.key}: 크게 보기`)
  }
  assert.match(html, /\.phone img \{ display: block; width: min\(375px, 100%\)/, '휴대폰 정지는 자리가 있으면 375 CSS px')
  assert.match(html, /<dialog class="viewer" id="viewer" aria-labelledby="viewer-title">/)
  assert.match(html, /\.v-video \{ display: block; width: 1440px; height: 900px; max-width: none;/, '크게 보기 영상은 1440 원래 크기')
  assert.doesNotMatch(html, /window\.open|target="_blank"/, '새 창·새 탭 없음')
})

test('per option: overall 좋다/별로, four optional aspect marks (색감·글씨체·배치·움직임) and its own memo; per recipe: a clearable pick and a recipe memo', () => {
  assert.deepEqual(ASPECTS, [['color', '색감'], ['type', '글씨체'], ['layout', '배치'], ['motion', '움직임']])
  for (const c of cards(html)) {
    for (const o of columns(c.html)) {
      assert.match(o.html, new RegExp(`data-like="${o.key}" value="like"[^>]*>좋다</button>`), `${c.id} ${o.key} 좋다`)
      assert.match(o.html, new RegExp(`data-like="${o.key}" value="dislike"[^>]*>별로</button>`), `${c.id} ${o.key} 별로`)
      for (const [k, name] of ASPECTS) {
        assert.ok(o.html.includes(`<span class="a-name">${name}</span>`), `${c.id} ${o.key} ${name}`)
        for (const v of ['like', 'dislike']) assert.ok(o.html.includes(`data-aspect="${k}" data-opt="${o.key}" value="${v}" aria-pressed="false"`), `${c.id} ${o.key} ${k} ${v}`)
      }
      assert.match(o.html, new RegExp(`<textarea id="note-${c.id}-${o.key}" data-note-opt="${o.key}"`), `${c.id} ${o.key} 메모`)
    }
    const radios = [...c.html.matchAll(/<input type="radio" name="([^"]+)" id="[^"]+" value="([AB]?)" data-pick>/g)]
    assert.deepEqual(radios.map((m) => m[2]), [...optionsOf(heads.find((h) => h.id === c.id)).map((o) => o.key), ''], `${c.id}: 있는 선택지 · 고르지 않음`)
    assert.equal(new Set(radios.map((m) => m[1])).size, 1, `${c.id}: 한 묶음`)
    // 안이 하나뿐인 레시피(r5-celadon)는 「가장 좋다」가 아니라 「이 안으로 정할까요」를 묻는다(Task 13).
    if (radios.length > 2) assert.ok(c.html.includes('이 안이 가장 좋다') && c.html.includes('고르지 않음'), c.id)
    else assert.ok(c.html.includes('이 안으로 정할까요') && c.html.includes('A안으로 정한다') && c.html.includes('정하지 않음') && !c.html.includes('이 안이 가장 좋다'), c.id)
    assert.match(c.html, /<textarea id="note-[^"]+" data-note rows/, c.id)
  }
})

test('document head and landmarks: doctype, lang ko, charset, viewport, 2–4 word title; one banner · one navigation · one main (cards are articles, options are groups)', () => {
  assert.match(html, /^<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>([^<]+)<\/title>/)
  const words = html.match(/<title>([^<]+)<\/title>/)[1].trim().split(/\s+/)
  assert.ok(words.length >= 2 && words.length <= 4, words.join(' '))
  assert.equal((html.match(/<main[\s>]/g) ?? []).length, 1)
  assert.equal((html.match(/<nav[\s>]/g) ?? []).length, 1)
  assert.doesNotMatch(html, /<section[\s>]|<aside[\s>]|role="region"/)
  assert.equal((html.match(/<article class="card"/g) ?? []).length, 10)
  // r5-celadon 은 B가 없다(Task 10f) — 10벌 중 9벌 A·B, 1벌 A만 = 19.
  assert.equal((html.match(/<div class="opt" data-option="[AB]" role="group"/g) ?? []).length, heads.reduce((n, h) => n + optionsOf(h).length, 0))
})

// WCAG 상대 휘도 대비(#rrggbb).
const ratio = (a, b) => {
  const lum = (h) => { const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
test('input and control borders (--line-strong) keep ≥ 3:1 against the panel and page in both themes (review M3); textarea, like, aspect and radio use it', () => {
  const blocks = [html.match(/:root \{ ([^}]+) color-scheme: light; \}/)[1], html.match(/:root\[data-theme="dark"\] \{ ([^}]+) color-scheme: dark; \}/)[1]]
  for (const b of blocks) {
    const tok = (k) => b.match(new RegExp(`--${k}: (#[0-9a-f]{6});`))[1]
    for (const bg of ['panel', 'bg']) assert.ok(ratio(tok('line-strong'), tok(bg)) >= 3, `line-strong/${bg} ${ratio(tok('line-strong'), tok(bg)).toFixed(2)}`)
    assert.ok(ratio(tok('line'), tok('panel')) < 3, '양성 대조: 옛 --line 은 3:1 미만')
  }
  for (const sel of ['textarea \\{[^}]*border: 1px solid var\\(--line-strong\\)', '\\.like \\{[^}]*border: 1px solid var\\(--line-strong\\)', '\\.mark \\{[^}]*border: 1px solid var\\(--line-strong\\)', '\\.radio \\{[^}]*border: 1px solid var\\(--line-strong\\)']) assert.match(html, new RegExp(sel), sel)
})

test('top: one instruction sentence and the n/10 progress counter in the sticky bar', () => {
  assert.ok(html.includes(INTRO))
  assert.match(html, /<span id="progress">0<\/span>\/10 레시피 판정/)
  assert.match(html, /\.bar \{ position: sticky; top: 0;/)
})

test('technical info (palette hex, K/M/dynamics, DNA card, AI-tell, source category) sits only inside a collapsed <details>', () => {
  for (const c of cards(html)) {
    const d = c.html.match(/<details class="tech">[\s\S]*?<\/details>/)?.[0]
    assert.ok(d, `${c.id}: details`)
    assert.doesNotMatch(d, /<details class="tech" open/)
    assert.ok(d.includes(`docs/recipes/dna/${c.id}.md`), `${c.id}: DNA 카드 경로`)
    assert.match(d, /#[0-9a-f]{6}/, `${c.id}: 팔레트 hex`)
    assert.match(d, /K[1-8] /, `${c.id}: 색 논리`)
    assert.match(d, /M[0-3]/, `${c.id}: 모션`)
    assert.match(d, /AI 티/, `${c.id}: AI 티`)
    assert.match(d, /출처 분류/, `${c.id}: 출처 분류`)
    const outside = c.html.replace(d, '')
    assert.doesNotMatch(outside, /#[0-9a-f]{6}|docs\/recipes\/dna|AI 티/, `${c.id}: 기술 정보가 details 밖에 있다`)
  }
})

test('font caption per option names the Latin and Korean display faces (r2 A = 영문 Bricolage Grotesque · 한글 도현, Task 14 board 3 reverted the Task 10f board 2 promotion)', () => {
  const r2 = heads.find((h) => h.id === 'r2-signal')
  assert.equal(fontCaption(optionsOf(r2)[0].head), '영문 Bricolage Grotesque · 한글 도현')
  for (const c of cards(html)) for (const o of columns(c.html)) assert.match(o.html, /<p class="fonts">영문 [^<]+ · 한글 [^<]+<\/p>/, `${c.id} ${o.key}`)
})

// 출처 도메인(index.md 의 r1~r10 행 20개 — 이 보드는 r1~r10 만 그린다. r11~r16 카드의 줄기(dashboard·neon 등)는 흔한 낱말이라 이 보드에 대지 않는다,
// 그 레시피의 실명 검사는 real-names.test.mjs BRANDS)·호스트 이름 줄기·큐레이션 출처 id. 공통 영어 낱말인 linear 는 CSS 의 linear-gradient 를 빼고 잡는다.
const INDEX = readFileSync(join(ROOT, 'docs', 'recipes', 'dna', 'index.md'), 'utf8')
const BOARD_ROWS = INDEX.split('\n').filter((l) => { const m = /^\| \[r(\d+)-/.exec(l); return m && Number(m[1]) <= 10 }).join('\n')
function realNameHits(text) {
  const hosts = [...new Set([...BOARD_ROWS.matchAll(/https?:\/\/([^/\s|]+)\//g)].map((m) => m[1].toLowerCase().replace(/^www\./, '')))]
  assert.equal(hosts.length, 20, 'index.md r1~r10 출처 20개')
  const stems = hosts.map((h) => h.split('.')[0])
  const sources = dnaSources().flatMap((s) => [s.A?.source, s.B?.source]).filter(Boolean)
  assert.ok(sources.length >= 18, `큐레이션 출처 id ${sources.length}`)
  const out = []
  for (const w of [...hosts, ...stems, ...sources, 'instagram', 'threads']) {
    const re = new RegExp(w === 'linear' ? '\\blinear\\b(?!-)' : w.replace(/[.]/g, '\\.'), 'gi')
    for (const m of text.matchAll(re)) out.push(m[0])
  }
  return out
}

test('no real brand or site names on the board (DNA source domains, their name stems, curation sources); positive control on index.md', () => {
  assert.deepEqual(realNameHits(html), [])
  assert.ok(realNameHits(INDEX).length >= 20, '양성 대조: index.md 에서는 걸린다')
  // 출처 분류는 한국어 분류만(예: 「국제 웹 어워드 후보·수상작」).
  for (const s of dnaSources()) for (const k of ['A', 'B']) assert.match(s[k].category, /^[가-힣·()\s0-9A-Za-z-]+$/, `${s.recipe} ${k}`)
})

test('external scripts only from cdnjs·jsdelivr (none today), stylesheets only Google Fonts; no browser storage; theme tokens', () => {
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.match(m[1], /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm)\//, m[1])
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) assert.match(m[1], /^https:\/\/fonts\.googleapis\.com\//)
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie/)
  assert.match(html, /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/)
  assert.match(html, /:root\[data-theme="dark"\]/)
  // 자산은 곁에 싣는 상대 경로만.
  for (const m of html.matchAll(/\s(?:src|poster)="([^"]+)"/g)) assert.match(m[1], /^(shots|video)\/r\d+-[a-z]+-[AB](-1440|-375)?\.(webp|webm|mp4)$/, m[1])
})

test('the collection stays "likes" (the owner\'s saved answers carry over); the old v1 collection and API shape are not used', () => {
  assert.equal(COLLECTION, 'likes')
  assert.match(html, /const COLLECTION = "likes"/)
  assert.doesNotMatch(html, /'decisions'|window\.claude\.db/)
})

// ── video.mjs ───────────────────────────────────────────────────────────────
test('optionJobs: 10 recipes × A·B in the default theme (r5-celadon A only, Task 10f — B dropped), frame URLs, file names', () => {
  const jobs = optionJobs(heads)
  assert.equal(jobs.length, heads.reduce((n, h) => n + optionsOf(h).length, 0))
  for (const j of jobs) {
    const h = heads.find((x) => x.id === j.recipe)
    assert.equal(j.theme, h.defaultTheme === 'dark' ? 'dark' : 'light')
    assert.deepEqual(j.files, { video: `${j.recipe}-${j.option}.webm`, mp4: `${j.recipe}-${j.option}.mp4`, 1440: `${j.recipe}-${j.option}-1440.webp`, 375: `${j.recipe}-${j.option}-375.webp` })
    assert.equal(j.hero, j.option === 'A' ? h.hero : h.alternates.hero)
    assert.equal(frameUrl('http://o', j), `http://o/qa/recipes?r=${j.recipe}&scene=hero${j.option === 'B' ? '&alt=B' : ''}&theme=${j.theme}&frame=1`)
  }
  assert.equal(jobs.find((j) => j.recipe === 'r10-console').theme, 'dark')
})

test('trimLeading drops frames before navigation and near-blank frames until the first painted one', () => {
  const fr = [{ t: 9.5, bytes: 1000 }, { t: 10.1, bytes: 1050 }, { t: 10.2, bytes: 1150 }, { t: 10.3, bytes: 9000 }, { t: 10.4, bytes: 1100 }]
  assert.deepEqual(trimLeading(fr, { from: 10, blankBytes: 1000 }).map((f) => f.t), [10.3, 10.4], '빈 프레임 뒤 첫 그려진 프레임부터, 그 뒤 작은 프레임은 둔다')
  assert.deepEqual(trimLeading(fr, { from: 10 }).map((f) => f.t), [10.1, 10.2, 10.3, 10.4], '빈 페이지 기준이 없으면 시각만')
  assert.deepEqual(trimLeading(fr, { from: 11 }), [])
})

test('concatList: per-frame durations to the next frame, last frame to the span end, frames past the span dropped, last file repeated', () => {
  const fr = [0, 0.5, 2, 5.9, 6.5].map((t, i) => ({ t: 100 + t, name: `f${i}.jpg` }))
  const l = concatList(fr, { span: 6 })
  assert.equal(l.frames, 4)
  assert.deepEqual(l.durations.map((d) => +d.toFixed(3)), [0.5, 1.5, 3.9, 0.1])
  assert.ok(Math.abs(l.durations.reduce((a, b) => a + b, 0) - 6) < 1e-9, '합 = span')
  assert.equal(l.text, "file 'f0.jpg'\nduration 0.5000\nfile 'f1.jpg'\nduration 1.5000\nfile 'f2.jpg'\nduration 3.9000\nfile 'f3.jpg'\nduration 0.1000\nfile 'f3.jpg'\n")
  // 같은 시각 프레임은 뒤 프레임만 남고, 몰려 온 프레임이 있어도 합은 span 그대로(최소 길이로 늘리지 않는다 — 영상 시간이 밀린다).
  const same = concatList([{ t: 1, name: 'a' }, { t: 1, name: 'b' }, { t: 1.004, name: 'c' }, { t: 1.008, name: 'd' }], { span: 1 })
  assert.equal(same.text.split('\n')[0], "file 'b'")
  assert.equal(same.frames, 3)
  assert.ok(Math.abs(same.durations.reduce((a, b) => a + b, 0) - 1) < 1e-9)
  assert.throws(() => concatList([]))
})

test('ffmpegArgs: concat input, -t span after the input, 30 fps yuv420p, no audio; VP9 crf 26 and H.264 crf 22 slow +faststart (legible small text)', () => {
  assert.deepEqual(CRF_STEPS.vp9.slice(0, 1), [26])
  assert.deepEqual(CRF_STEPS.h264.slice(0, 1), [22])
  for (const [codec, out] of [['vp9', 'out.webm'], ['h264', 'out.mp4']]) {
    const a = ffmpegArgs('list.txt', out, { codec })
    const i = a.indexOf('-i'), t = a.indexOf('-t')
    assert.ok(i > 0 && t > i, '-t 는 출력 쪽(입력 뒤)')
    assert.equal(a[t + 1], String(SPAN))
    assert.deepEqual(a.slice(a.indexOf('-f'), a.indexOf('-f') + 4), ['-f', 'concat', '-safe', '0'])
    assert.ok(a.includes('fps=30,format=yuv420p'))
    assert.ok(a.includes('-an'))
    assert.equal(a.at(-1), out)
  }
  const v = ffmpegArgs('l', 'o.webm', { codec: 'vp9' })
  for (const [k, x] of [['-c:v', 'libvpx-vp9'], ['-b:v', '0'], ['-crf', '26'], ['-row-mt', '1'], ['-deadline', 'good'], ['-cpu-used', '2']]) assert.equal(v[v.indexOf(k) + 1], x, k)
  const h = ffmpegArgs('l', 'o.mp4', { codec: 'h264', crf: 23 })
  for (const [k, x] of [['-c:v', 'libx264'], ['-preset', 'slow'], ['-crf', '23'], ['-pix_fmt', 'yuv420p'], ['-movflags', '+faststart']]) assert.equal(h[h.indexOf(k) + 1], x, k)
})

test('manifest shape: MP4 + WebM + two stills per option with bytes, duration, recipe, option, fonts; totals; reduced-motion per option; checkManifest', () => {
  // 보드 전체 선택지 수(Task 10f — r5-celadon 은 B가 없다): 9벌 A·B + 1벌 A = 19.
  const N = heads.reduce((n, h) => n + optionsOf(h).length, 0)
  assert.equal(N, 19)
  assert.equal(manifest.count, N * 4)
  assert.equal(manifest.files.length, N * 4)
  assert.equal(manifest.bytes, N * (1_000_000 + 900_000 + 600_000))
  assert.deepEqual(manifest.files.filter((f) => f.recipe === 'r1-measure' && f.option === 'A').map((f) => f.file), ['r1-measure-A.mp4', 'r1-measure-A.webm', 'r1-measure-A-1440.webp', 'r1-measure-A-375.webp'])
  assert.equal(manifest.byKind.mp4, +(N * 1_000_000 / 1048576).toFixed(2))
  for (const f of manifest.files) {
    for (const k of ['file', 'kind', 'recipe', 'option', 'bytes', 'duration', 'fonts']) assert.ok(k in f, `${f.file}: ${k}`)
    assert.equal(f.duration === null, f.kind === 'still', f.file)
  }
  assert.equal(manifest.maxVideoBytes, 1_000_000)
  assert.deepEqual(manifest.reducedMotion, { checked: N, still: N, moving: [], failed: [] })
  assert.deepEqual(checkManifest(manifest, { expectOptions: N }), [])
  // 음성 대조: 예산 초과·길이·동작 줄이기 없음·서체 실패·선택지 수.
  const one = naturalOrder(heads).slice(0, 1)
  const bad = manifestOf({ origin: 'x', options: fakeOptions(one, { videos: [{ file: 'v.webm', codec: 'vp9', bytes: VIDEO_MAX + 1, duration: 7.2, crf: 34, frames: 1 }], reducedMotion: undefined, fontsOk: false, fontsWhy: 'Geist' }) })
  const p = checkManifest(bad, { expectOptions: N })
  for (const re of [new RegExp(`선택지 2 ≠ ${N}`), /영상 webm · 정지 2/, /> 4MB/, /영상 길이 7\.2/, /동작 줄이기 검사 없음/, /서체 대기 실패/]) assert.ok(p.some((x) => re.test(x)), `${re} ∈ ${p.join(' | ')}`)
  const moving = manifestOf({ origin: 'x', options: fakeOptions(one, { reducedMotion: { still: false, diff: 0.01, running: 2 } }) })
  assert.equal(moving.reducedMotion.still, 0)
  assert.equal(moving.reducedMotion.moving.length, 2)
  // 동작 줄이기 캡처 실패는 「멈춤」이 아니라 오류로(리뷰 L2).
  const broken = manifestOf({ origin: 'x', options: fakeOptions(one, { reducedMotion: { still: null, error: '동작 줄이기 캡처 실패', running: 0 } }) })
  assert.equal(broken.reducedMotion.still, 0)
  assert.deepEqual(broken.reducedMotion.failed, ['r1-measure-A', 'r1-measure-B'])
  assert.ok(checkManifest(broken).some((x) => /동작 줄이기 검사 실패 — 동작 줄이기 캡처 실패/.test(x)))
  // 한글 제목 서체가 영상이나 정지 한 장에서라도 안 보이면 문제(리뷰 L3). 기대가 없는 레시피(r6 — 본문 GOV)는 보지 않는다.
  const noKo = manifestOf({ origin: 'x', options: fakeOptions(one, { displayKo: { expected: 'Nanum Gothic Coding', seen: true, stills: [true, false] } }) })
  assert.ok(checkManifest(noKo).some((x) => /한글 제목 서체 Nanum Gothic Coding 가 보이지 않았다/.test(x)))
  assert.equal(sawFont(['Martian Mono', 'Nanum Gothic Coding'], 'Nanum Gothic Coding'), true)
  assert.equal(sawFont(['Martian Mono'], 'Nanum Gothic Coding'), false)
  assert.equal(sawFont(['Martian Mono'], null), null)
  // 옛 목록(영상 한 형식 o.video)도 읽힌다.
  const old = manifestOf({ origin: 'x', options: fakeOptions(one).map(({ videos, ...o }) => ({ ...o, video: videos[1] })) })
  assert.equal(old.files.filter((f) => f.kind === 'video').length, 2)
  assert.ok(TOTAL_MAX === 60 * 1048576 && VIDEO_MAX === 4 * 1048576)
})

// ── gates.mjs §2b(히어로 유채 픽셀) ─────────────────────────────────────────────
test('hero face gate: K6~K8 hero scenes are judged by rendered chromatic pixel share (C ≥ 0.06, ≥ 25%); other scenes keep area / top bar', () => {
  assert.equal(CHROMA_MIN, 0.06)
  assert.equal(PIXEL_SHARE_MIN, 0.25)
  assert.ok(oklabChroma(255, 255, 255) < 0.001)
  assert.ok(oklabChroma(128, 128, 128) < 0.001)
  assert.ok(Math.abs(oklabChroma(255, 0, 0) - 0.2577) < 0.002, `빨강 C ${oklabChroma(255, 0, 0)}`)
  assert.ok(oklabChroma(245, 240, 230) < CHROMA_MIN, '크림 바탕은 유채로 세지 않는다')
  for (const h of heads) for (const o of optionsOf(h)) {
    const bold = BOLD_LOGICS.includes(o.head.colorLogic)
    assert.equal(faceGateKind(o.head, 'hero'), bold ? 'pixel' : null, `${h.id} ${o.key}`)
    assert.notEqual(faceGateKind(o.head, 'app-shell'), 'pixel')
  }
  const r10 = heads.find((h) => h.id === 'r10-console')
  assert.equal(faceGateKind(r10, 'hero'), 'pixel', '대시보드 레시피라도 히어로는 상단 바 규칙을 받지 않는다')
  assert.equal(faceGateKind(r10, 'app-shell'), 'top-bar')
})

test('source category follows the DNA card move ↔ site mapping (review L1: r1 move 1 comes from site 2)', () => {
  const r1 = dnaSources(['r1-measure'])[0]
  assert.equal(r1.A.site, 2)
  assert.equal(r1.A.source, 'cssda')
  assert.equal(r1.A.category, '국제 웹 어워드 선정작')
  assert.equal(r1.B.site, 1)
  assert.equal(r1.B.source, 'awwwards')
  for (const s of dnaSources().filter((x) => x.recipe !== 'r1-measure')) assert.deepEqual([s.A.site, s.B.site], [1, 2], s.recipe)
})

test('palette hex conversion', () => {
  assert.equal(toHex('oklch(1 0 0)'), '#ffffff')
  assert.equal(toHex('oklch(0 0 0)'), '#000000')
  assert.equal(toHex('oklch(0.6279 0.2577 29.23)'), '#ff0000')
})

// ── 보드 4판(Task 16 — 3판 판정 반영 뒤 다음 보드) ─────────────────────────────
// 글자 잇기(리뷰 14 #3): 지금 글자 → 3판 글자(v3Keys, 3판 판정) → 2판 글자(v2Keys, 2판 판정)를 합성하고 판별 히어로 기록으로 검산한다.
test('board 4: edition note at the top; one change line per recipe (letters moved by the board-3 picks; the fixes since board 3; otherwise 「없음」)', () => {
  assert.equal(EDITION, '4판 — 3판 판정 반영(고른 안이 머리로)')
  assert.ok(html.includes(`<p class="edition">${EDITION}</p>`))
  assert.ok(html.indexOf(EDITION) < html.indexOf(INTRO), '맨 위')
  const line = (id) => cards(html).find((c) => c.id === id).html.match(/<p class="changes">([^<]+)<\/p>/)?.[1]
  for (const c of cards(html)) assert.match(line(c.id) ?? '', /^3판 뒤 바뀐 점: /, c.id)
  for (const id of ['r2-signal', 'r6-civic', 'r8-dusk', 'r10-console']) assert.match(line(id), /A안 = 3판 B안 · B안 = 3판 A안\(3판에서 고른 B안이 머리로\)/, id)
  assert.match(line('r1-measure'), /치수 라벨 「3 600」/)
  assert.match(line('r6-civic'), /도장 선/)
  assert.match(line('r10-console'), /커서를 따르는 행 강조/)
  assert.equal(line('r3-woodblock'), '3판 뒤 바뀐 점: 없음(3판 그대로)')
  assert.equal(changesOf('rX', [{ key: 'A', v3Key: 'A' }, { key: 'B', v3Key: null }], { notes: {} }), '3판 뒤 바뀐 점: B안은 3판에 없던 안')
})

test('board 4 letters: composed current → v3 → v2 — r2 double swap puts cropped-title-list back on v2 A (and v3 B); r6 current A (identity-strip-banner) is v3 B; identity where nothing was picked; r5 A only', () => {
  const byId = Object.fromEntries(heads.map((h) => [h.id, h]))
  const keys = (id) => letterKeys(byId[id])
  const hero = (id, k) => optionsOf(byId[id]).find((o) => o.key === k).head.hero
  assert.equal(hero('r2-signal', 'A'), 'cropped-title-list')
  assert.deepEqual(keys('r2-signal'), { A: { v3: 'B', v2: 'A' }, B: { v3: 'A', v2: 'B' } })
  assert.equal(hero('r6-civic', 'A'), 'identity-strip-banner')
  assert.deepEqual(keys('r6-civic'), { A: { v3: 'B', v2: 'B' }, B: { v3: 'A', v2: 'A' } })
  for (const id of ['r8-dusk', 'r10-console']) assert.deepEqual(keys(id), { A: { v3: 'B', v2: 'B' }, B: { v3: 'A', v2: 'A' } }, id)
  for (const id of ['r1-measure', 'r3-woodblock', 'r4-evidence', 'r7-docs', 'r9-clay']) assert.deepEqual(keys(id), { A: { v3: 'A', v2: 'A' }, B: { v3: 'B', v2: 'B' } }, id)
  assert.deepEqual(keys('r5-celadon'), { A: { v3: 'A', v2: 'A' } })
  // 한 걸음 함수(규칙)는 그대로: 고른 B가 올라간 판 사이에서만 A↔B.
  const d2 = JSON.parse(readFileSync(join(ROOT, 'factory', 'board', 'recipe-board2-decisions.json'), 'utf8'))
  assert.deepEqual(v2Keys('r2-signal', ['A', 'B'], d2), { A: 'B', B: 'A' })
  assert.deepEqual(v3Keys('r6-civic', ['A', 'B']), { A: 'B', B: 'A' })
  assert.deepEqual(v3Keys('r1-measure', ['A', 'B']), { A: 'A', B: 'B' })
  // 페이지 데이터에도 실린다.
  const json = JSON.parse(html.match(/<script type="application\/json" id="board-data">([\s\S]*?)<\/script>/)[1])
  assert.deepEqual(json.find((r) => r.id === 'r2-signal').options.map((o) => [o.key, o.v3Key, o.v2Key]), [['A', 'B', 'A'], ['B', 'A', 'B']])
  assert.deepEqual(json.find((r) => r.id === 'r6-civic').options.map((o) => [o.key, o.v3Key, o.v2Key]), [['A', 'B', 'B'], ['B', 'A', 'A']])
})

test('board 4 letters refuse: letters that differ from the board records without a decision mapping stop the build (no pick recorded, heroes swapped, record missing)', () => {
  const byId = Object.fromEntries(heads.map((h) => [h.id, h]))
  const d3 = JSON.parse(readFileSync(join(ROOT, 'factory', 'board', 'recipe-board3-decisions.json'), 'utf8'))
  const noPick = structuredClone(d3); delete noPick['r6-civic'].pick
  assert.throws(() => letterKeys(byId['r6-civic'], { decisions3: noPick }), /글자 대응 없음\(r6-civic\)/)
  assert.throws(() => board2Data(heads, manifest, {}, { decisions3: noPick }), /r6-civic/)
  // 판정은 그대로인데 머리가 기록과 다르면(글자를 손으로 뒤집었다) 멈춘다.
  const flipped = structuredClone(byId['r1-measure'])
  const altHero = flipped.alternates.hero; flipped.alternates.hero = flipped.hero; flipped.hero = altHero
  assert.throws(() => letterKeys(flipped), /글자 대응 없음\(r1-measure\)/)
  // 2판 판정을 잃으면(r2 의 두 번째 뒤집기가 설명되지 않는다) 멈춘다.
  const d2 = JSON.parse(readFileSync(join(ROOT, 'factory', 'board', 'recipe-board2-decisions.json'), 'utf8'))
  delete d2['r2-signal'].pick
  assert.throws(() => letterKeys(byId['r2-signal'], { decisions2: d2 }), /2판 [AB]안은/)
  assert.throws(() => letterKeys(byId['r1-measure'], { letters: {} }), /판별 히어로 기록/)
  // 기록에 없는 새 레시피는 이전 판 답이 없다(멈추지 않는다).
  assert.deepEqual(letterKeys({ ...byId['r1-measure'], id: 'r11-new' }), { A: { v3: null, v2: null }, B: { v3: null, v2: null } })
})

test('board 4: every option has muted slots for its v3 and v2 answers; each card has one per round for the pick and memo; board-4 answers go only into the v4 slot (update of changed fields; set only for a missing doc)', () => {
  for (const c of cards(html)) {
    for (const o of columns(c.html)) for (const round of [3, 2]) assert.match(o.html, new RegExp(`<p class="prev" data-prev="${o.key}" data-round="${round}" hidden></p>`), `${c.id} ${o.key} ${round}`)
    for (const round of [3, 2]) assert.match(c.html, new RegExp(`<p class="prev" data-prev-recipe="${round}" hidden></p>`), c.id)
  }
  assert.match(html, /\.prev \{[^}]*color: var\(--muted\)/)
  assert.match(html, /const BOARD = 4;/)
  // 4판 답은 v4 한 칸에만 — 있는 문서는 update(바뀐 칸), set 은 원격에 문서가 없을 때 한 곳뿐이다.
  assert.match(html, /const SLOT = 'v' \+ BOARD;/)
  assert.match(html, /if \(merge\) await ref\.update\(patchOf\(values, at\)\);/)
  assert.equal(html.match(/\.set\(/g).length, 1, 'set 은 새 문서 하나')
})

test('board 4 artifact variant: no doctype / html / head / body tags of its own; title, meta description, the Google Fonts link and style stay at the top; the rest is unchanged', () => {
  const a = artifactHtml(html)
  assert.doesNotMatch(a, /<!doctype|<\/?html[\s>]|<\/?head[\s>]|<\/?body[\s>]/i)
  const top = a.slice(0, a.indexOf('<div class="wrap"'))
  for (const re of [/<title>레시피 보드 4판<\/title>/, /<meta name="description" content="[^"]+">/, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+">/, /<style>/]) assert.match(top, re)
  assert.ok(top.indexOf('<title>') < top.indexOf('<style>'))
  assert.equal(a.length, html.length - ['<!doctype html>\n', '<html lang="ko">\n', '<head>\n', '</head>\n', '<body>\n', '</body>\n', '</html>\n'].join('').length, '뼈대 태그 일곱 줄만 뺐다')
})
