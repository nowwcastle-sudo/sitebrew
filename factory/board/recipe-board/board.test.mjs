// 레시피 보드 검사: node --test --test-force-exit --test-timeout=60000 "factory/board/recipe-board/*.test.mjs"
// 보드 HTML 은 게시한 보드의 머리 고정본(heads-at-board.json, 10벌 — 결정 반영 전)과 가짜 스크린샷 목록(shotJobs 그대로)으로 만든다 — 서버·Chrome 없이 돈다.
// 결정 반영(Task 9) 검사는 맨 아래: 원천 머리 = 고정본에 운영자가 고른 B 축을 적용한 값.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBoard, boardData, comboKey, counterSource, aiTellScores, QUESTION, COMMON_LABEL } from './build.mjs'
import { loadHeads, loadBoardHeads, shotJobs, optionsOf, faceGateKind, themesFor, WIDTHS } from './jobs.mjs'
import { validCombos, applyAlternate, ALT_AXES, lintRecipe, HERO_IDS, dynamicsAllowed } from '../../scripts/recipe.mjs'
import { diversityReport, tallyDistribution, classifyHead, DECISIONS, diversityEnforced, limitsFor } from '../../scripts/recipes-diversity.mjs'

// 고정본은 히어로(Task 10d) 이전의 머리다. 지금 스키마는 hero 를 요구하므로(묶음 2 에서 필수) lint·조합 검사가 돌도록 카탈로그 id 하나를 채운다.
// 고정본의 signature 에는 hero 장면이 없어 보드 출력(장면·스크린샷 목록)은 그대로다.
const heads = loadBoardHeads().map((h) => ({ hero: HERO_IDS[0], ...h }))
const fakeManifest = (hs) => ({ shots: shotJobs(hs).map((j) => ({ ...j, w: j.width === 1440 ? 1376 : 343, h: 600, bytes: 1 })) })
const build = (hs = heads) => buildBoard(boardData(hs, fakeManifest(hs), { [hs[0].id]: 12 }))
const cards = (html) => [...html.matchAll(/<article class="card" id="card-([^"]+)"[\s\S]*?<\/article>/g)].map((m) => ({ id: m[1], html: m[0] }))

test('one card per recipe, in registry order — also for a 9-recipe set', () => {
  for (const hs of [heads, heads.slice(0, 9)]) {
    const cs = cards(build(hs))
    assert.deepEqual(cs.map((c) => c.id), hs.map((h) => h.id))
  }
})

test('signature shots come before the common specimen, which is labelled 「모든 레시피 공통 견본」', () => {
  for (const c of cards(build())) {
    const sig = [...c.html.matchAll(/data-shot="signature"/g)].map((m) => m.index)
    const common = c.html.indexOf('data-shot="common"')
    assert.ok(sig.length >= 1 && common > 0, c.id)
    assert.ok(Math.max(...sig) < common, `${c.id}: 대표 장면이 공통 견본보다 앞`)
    assert.ok(c.html.slice(common).includes(COMMON_LABEL), c.id)
    // 대표 장면 스크린샷(img)도 공통 견본 img 보다 앞.
    const firstCommonImg = c.html.indexOf('data-kind="specimen"')
    assert.ok([...c.html.matchAll(/data-kind="scene"/g)].every((m) => m.index < firstCommonImg), c.id)
  }
  assert.equal(COMMON_LABEL, '모든 레시피 공통 견본')
})

test('dark-default recipes lead with the dark screenshots', () => {
  const html = build()
  for (const h of heads) {
    const c = cards(html).find((x) => x.id === h.id)
    const first = c.html.match(/src="shots\/([^"]+)"/)[1]
    assert.ok(first.endsWith(`-1440-${themesFor(h)[0]}.webp`), `${h.id}: ${first}`)
    if (h.defaultTheme === 'dark') assert.ok(first.endsWith('-dark.webp'), h.id)
  }
  assert.ok(heads.some((h) => h.defaultTheme === 'dark'), '다크 기본 레시피가 하나는 있어야 이 검사가 뜻이 있다')
})

test('approve·reject·revise buttons and the fixed question on every card', () => {
  const html = build()
  assert.ok(html.includes(`<h1>${QUESTION}</h1>`))
  assert.equal(QUESTION, '이 레시피로 고객 사이트를 찍어도 되겠나?')
  for (const c of cards(html)) {
    for (const [v, label] of [['approve', '승인'], ['reject', '반려'], ['revise', '수정']])
      assert.match(c.html, new RegExp(`value="${v}" data-verdict> <span>${label}</span>`), `${c.id} ${v}`)
    assert.ok(c.html.includes(QUESTION), c.id)
    assert.match(c.html, /<textarea id="note-[^"]+" data-note/)
  }
})

test('only the valid combos (recipe.mjs validCombos) plus 「A 그대로」 are offered; A/B rows only for axes B changes', () => {
  const html = build()
  for (const h of heads) {
    const c = cards(html).find((x) => x.id === h.id)
    const offered = [...c.html.matchAll(/name="combo-[^"]+" id="[^"]+" value="([^"]*)" data-combo/g)].map((m) => m[1]).sort()
    const expected = h.alternates ? ['', ...validCombos(h).map(comboKey)].sort() : []
    assert.deepEqual(offered, expected, h.id)
    const rows = [...c.html.matchAll(/<tr data-axis="([^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(rows, h.alternates ? ALT_AXES.filter((k) => h.alternates[k] !== undefined) : [], h.id)
  }
  // r2 는 「기법만 B」가 M0 위반이라 그 조합이 없다(계획 Task 8 예시).
  const r2 = heads.find((h) => h.id === 'r2-signal')
  assert.ok(r2 && !validCombos(r2).some((p) => p.length === 1 && p[0] === 'dynamics'))
  assert.ok(!cards(html).find((x) => x.id === 'r2-signal').html.includes('value="dynamics" data-combo'))
})

test('external resources: scripts only from cdnjs·jsdelivr (none today), stylesheets only Google Fonts; no browser storage', () => {
  const html = build()
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.match(m[1], /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm)\//, m[1])
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) assert.match(m[1], /^https:\/\/fonts\.googleapis\.com\//)
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie/)
  assert.match(html, /<title>[^<]+<\/title>/)
  assert.match(html, /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/)
  assert.match(html, /:root\[data-theme="dark"\]/)
})

test('decisions go through the artifact db capability: use("db") → collection "decisions" → doc(recipe id).set({recipe, verdict, axisPicks, note?, decidedAt})', () => {
  const html = build()
  assert.match(html, /window\.claude\.use\('db'\)/)
  assert.match(html, /db\.collection\('decisions'\)\.doc\(id\)\.set\(doc\)/)
  assert.match(html, /db\.collection\('decisions'\)\.onSnapshot\(/)
  assert.match(html, /const doc = \{ recipe: id, verdict: s\.verdict, axisPicks: axisPicksOf\(r, s\.combo\), decidedAt: /)
  assert.doesNotMatch(html, /window\.claude\.db/)
})

// 결정적 난수(재현 가능).
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

test('counter parity: the page counter (tallyDistribution source shipped in the page) equals diversityReport for the same picks', () => {
  const data = boardData(heads)
  const pageTally = new Function(`${counterSource()}; return tallyDistribution`)()
  const rand = rng(8)
  const cases = [
    Object.fromEntries(heads.map((h) => [h.id, { verdict: 'approve', combo: '' }])), // 모두 A
    Object.fromEntries(heads.map((h) => [h.id, { verdict: 'approve', combo: h.alternates ? comboKey(validCombos(h).find((p) => p.length === ALT_AXES.filter((k) => h.alternates[k] !== undefined).length)) : '' }])), // 모두 B 전체
  ]
  for (let i = 0; i < 200; i++) cases.push(Object.fromEntries(heads.map((h) => {
    const combos = ['', ...(h.alternates ? validCombos(h).map(comboKey) : [])]
    return [h.id, { verdict: rand() < 0.15 ? 'reject' : rand() < 0.5 ? 'approve' : 'revise', combo: combos[Math.floor(rand() * combos.length)] }]
  })))
  let problemsSeen = 0, passSeen = 0
  for (const picks of cases) {
    const kept = heads.filter((h) => picks[h.id].verdict !== 'reject')
    const applied = kept.map((h) => (picks[h.id].combo ? applyAlternate(h, picks[h.id].combo.split('+')) : h))
    const expect = diversityReport(applied)
    const page = pageTally(data.filter((r) => picks[r.id].verdict !== 'reject').map((r) => ({ ...r.classes[picks[r.id].combo] })))
    assert.deepEqual(page.counts, expect.counts)
    assert.deepEqual(page.problems, expect.problems)
    // 모듈 함수와 페이지에 실은 소스가 같은 답.
    assert.deepEqual(page, tallyDistribution(applied.map(classifyHead)))
    if (expect.problems.length) problemsSeen++
    else passSeen++
  }
  assert.ok(problemsSeen > 0 && passSeen > 0, `양쪽 결과가 다 나와야 비교가 뜻이 있다(부족 ${problemsSeen} · 충족 ${passSeen})`)
})

test('board snapshot: all-A leaves 7 skeletons — the counter says what is missing; B on two skeleton recipes fixes it', () => {
  const data = boardData(heads)
  const allA = tallyDistribution(data.map((r) => r.classes['']))
  assert.equal(allA.counts.skeleton, 7)
  assert.ok(allA.problems.some((p) => p.startsWith('div-01 skeleton')))
  const pick = new Map([['r1-measure', 'colorLogic'], ['r6-civic', 'colorLogic']])
  const two = tallyDistribution(data.map((r) => r.classes[pick.get(r.id) ?? '']))
  assert.equal(two.counts.skeleton, 5)
  assert.ok(!two.problems.some((p) => p.startsWith('div-01')), two.problems.join('\n'))
})

test('face gate kind: K6~K8 non-dashboard → area, K6~K8 with dashboard → top bar, K1~K5 → none', () => {
  const byId = Object.fromEntries(heads.map((h) => [h.id, h]))
  const kinds = (id) => optionsOf(byId[id]).map((o) => faceGateKind(o.head))
  assert.deepEqual(kinds('r1-measure'), [null, 'top-bar'])
  assert.deepEqual(kinds('r10-console'), ['top-bar', 'top-bar'])
  assert.deepEqual(kinds('r9-clay'), ['area', 'area'])
  assert.deepEqual(kinds('r2-signal'), [null, 'area'])
})

test('shot plan stays inside artifact limits (≤ 254 images + page, dark-first for dark-default)', () => {
  const jobs = shotJobs(heads)
  assert.ok(jobs.length + 1 <= 255, `${jobs.length}장`)
  assert.equal(new Set(jobs.map((j) => j.file)).size, jobs.length)
  const r10 = jobs.filter((j) => j.recipe === 'r10-console')
  assert.equal(r10[0].theme, 'dark')
})

test('ai-tell scores come from the last row per recipe in the baseline table', () => {
  const md = '| r9-clay | x | **16** | 5 |\n| r9-clay | y | **13** | 6 |\n| r1-measure (대조) | z | **12** | 6 |'
  assert.deepEqual(aiTellScores(md), { 'r9-clay': 13, 'r1-measure': 12 })
})

// ── 실머리(Task 9 fix 1 — 리뷰 M2): gates.mjs·shots.mjs·build.mjs 가 실제로 쓰는 경로(jobs.mjs loadHeads = 원천 머리) ──
test('live heads: the job list gates·shots·build use is well-formed (options A[+B], signature × widths × themes, specimens, unique files) and the board builds', () => {
  const live = loadHeads()
  assert.ok(live.length >= 1)
  const jobs = shotJobs(live)
  assert.equal(new Set(jobs.map((j) => j.file)).size, jobs.length, '파일 이름이 겹치지 않는다')
  // 아티팩트 한도(255)는 게시한 1판 보드의 레시피(고정본 10벌)로 잰다 — 라이브러리가 15벌이 되면 1판 방식의 정지 화면 목록은 한도를 넘는다(1판은 게시 기록이라 다시 짓지 않는다. 새 레시피는 보드 A2 가 영상으로 받았다).
  const boardIds = new Set(loadBoardHeads().map((h) => h.id))
  const boardJobs = shotJobs(live.filter((h) => boardIds.has(h.id)))
  assert.ok(boardJobs.length + 1 <= 255, `아티팩트 한도 — ${boardJobs.length}장`)
  for (const h of live) {
    const opts = optionsOf(h)
    assert.deepEqual(opts.map((o) => o.key), h.alternates ? ['A', 'B'] : ['A'], h.id)
    assert.equal(opts[0].head, h, `${h.id}: A 는 원천 머리 그대로`)
    if (opts[1]) assert.equal(opts[1].head.alternates, undefined, `${h.id}: B 머리는 B를 적용한 머리`)
    const mine = jobs.filter((j) => j.recipe === h.id)
    const scenes = mine.filter((j) => j.kind === 'scene'), specimens = mine.filter((j) => j.kind === 'specimen')
    assert.equal(scenes.length, opts.length * (h.signature ?? []).length * WIDTHS.length * 2, h.id)
    assert.equal(specimens.length, WIDTHS.length * 2, h.id)
    assert.equal(mine[0].theme, themesFor(h)[0], `${h.id}: 기본 테마 먼저`)
    for (const j of scenes) {
      assert.ok((h.signature ?? []).includes(j.scene), `${h.id}: ${j.scene}`)
      assert.equal(j.query, j.option === 'B' ? '&alt=B' : '', `${h.id}: ${j.file}`)
    }
  }
  const html = buildBoard(boardData(live, fakeManifest(live)))
  assert.deepEqual(cards(html).map((c) => c.id), live.map((h) => h.id))
})

// ── 결정 반영(Task 9) ─────────────────────────────────────────────────────────────
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v)

test('recipe-decisions.json: sorted owner decisions for every board recipe, one board, applied = true (turns on diversity enforcement)', () => {
  const text = readFileSync(DECISIONS, 'utf8')
  const d = JSON.parse(text)
  assert.equal(text, JSON.stringify(sortKeys(d), null, 2) + '\n', '키가 정렬된 JSON')
  assert.equal(d.applied, true)
  assert.equal(diversityEnforced(), true)
  assert.equal(d.decidedBy, 'owner')
  assert.match(d.board, /^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+$/)
  assert.deepEqual(d.decisions.map((x) => x.recipe), heads.map((h) => h.id), '보드 순서(레지스트리 순서)대로 레시피마다 하나')
  for (const x of d.decisions) {
    assert.deepEqual(Object.keys(x), ['axisPicks', 'decidedAt', 'recipe', 'verdict'], x.recipe)
    assert.ok(['approve', 'reject', 'revise'].includes(x.verdict), x.recipe)
    assert.ok(!Number.isNaN(Date.parse(x.decidedAt)), x.recipe)
    const h = heads.find((y) => y.id === x.recipe)
    const b = Object.keys(x.axisPicks).filter((k) => x.axisPicks[k] === 'B')
    if (b.length) assert.ok(validCombos(h).some((p) => comboKey(p) === comboKey(ALT_AXES.filter((k) => b.includes(k)))), `${x.recipe}: 고른 B 축 ${b} 가 보드 조합에 없다`)
  }
})

// 레퍼런스 DNA 이식(Task 10d)이 바꿀 수 있는 머리 키 — 이름을 박은 거부 목록이다. 이 밖의 키는 모두 보드 판정 머리와 같아야 한다(엄격 비교, 리뷰 b1 I3).
//   color·fonts: DNA 카드의 팔레트·배정표 서체 · hero: 첫 화면 구성 · references: 카드·팔레트 id · mood·name: 분위기 낱말·이름 ·
//   body: 본문(분위기·쓰는 법·하지 말 것·레퍼런스 DNA) · signature: 맨 앞 hero + 보드 장면 중 남긴 것(아래에서 따로 본다) · alternates: 다음 보드의 B안(아래에서 따로 본다).
// (Task 9 의 「면 명도만 조정」 표는 color 가 DNA 값으로 바뀐 뒤 죽은 코드라 지웠다 — 색상각·채도 검사는 DNA 카드 대조가 맡는다.)
const DNA_KEYS = ['color', 'fonts', 'hero', 'references', 'mood', 'name', 'body', 'signature', 'alternates']
// 보드 판정 뒤에 생긴 원형 — 그 원형을 레시피 archetypes 에 더하는 것은 판정을 바꾸지 않는다(새 원형마다 레시피 1벌 이상이 필요하다).
//   landing: 5013a097(2026-10-10, C3)이 r2-signal·r4-evidence 에 더했다. 판정 때 있던 원형을 빼거나 바꾸는 것은 여전히 걸린다.
const LATER_ARCHETYPES = ['landing']
const judged = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => !DNA_KEYS.includes(k)).map(([k, v]) => [k, k === 'archetypes' ? v.filter((a) => !LATER_ARCHETYPES.includes(a)) : v]))

test('applied: every source head = the board head with the owner-picked B axes on every non-DNA key (strict), B keeps K and M, B dynamics within what lint allows, lint clean, distribution passes', () => {
  const { decisions } = JSON.parse(readFileSync(DECISIONS, 'utf8'))
  // 판정 기록(decisions)은 1판 보드의 레시피에 대한 것이다 — 그 뒤 확정된 r12~r16 은 기록이 없다(기록 파일을 지어내지 않는다).
  const decided = new Set(decisions.map((x) => x.recipe))
  const now = new Map(loadHeads().filter((h) => decided.has(h.id)).map((h) => [h.id, h]))
  assert.equal(now.size, decisions.filter((x) => x.verdict !== 'reject').length)
  let strict = 0
  for (const x of decisions) {
    const board = heads.find((h) => h.id === x.recipe)
    const picks = ALT_AXES.filter((k) => x.axisPicks[k] === 'B')
    const want = picks.length ? applyAlternate(board, picks) : (({ alternates, ...rest }) => rest)(board)
    const cur = now.get(x.recipe)
    // 엄격 비교 — 색 논리·다크 기본·모션·역동 기법·축·원형·아이콘·원형 조건·id … 거부 목록 밖의 모든 키.
    assert.deepEqual(judged(cur), judged(want), `${x.recipe}: DNA 밖 키가 보드 판정 머리와 다르다`)
    strict++
    // signature: 맨 앞은 hero, 나머지는 보드 장면에서만(장 수 한도로 뺄 수는 있어도 새 장면을 들이지 않는다).
    assert.equal(cur.signature[0], 'hero', x.recipe)
    assert.ok(cur.signature.slice(1).every((s) => want.signature.includes(s)), `${x.recipe}: ${cur.signature} ⊄ hero + ${want.signature}`)
    // B안: 같은 K, 같은 M(모션 대안 없음 또는 같은 값), 역동 기법은 그 K/M 에서 lint 가 허락하는 것만.
    // r5-celadon 은 선택 보드 2판(2026-09-28)에서 B를 버렸다(빈 공간·단순 모션으로 별로) — alternates 가 없다(Task 10f).
    const alt = cur.alternates
    if (!alt) assert.equal(x.recipe, 'r5-celadon', `${x.recipe}: 다음 보드의 B안(alternates)이 없다`)
    else {
      assert.equal(alt.colorLogic ?? cur.colorLogic, cur.colorLogic, `${x.recipe}: B안도 같은 색 논리`)
      assert.ok(alt.motion === undefined || alt.motion === cur.motion, `${x.recipe}: B안 모션 ${alt.motion} ≠ A ${cur.motion}`)
      const bMotion = alt.motion ?? cur.motion
      const bDyn = alt.dynamics ?? cur.dynamics
      assert.ok(bDyn.every((d) => dynamicsAllowed(bMotion).includes(d)), `${x.recipe}: B 기법 ${bDyn} 이 ${bMotion} 에서 허락되지 않는다`)
      assert.deepEqual(lintRecipe(applyAlternate(cur)), [], `${x.recipe}: B 전체`)
    }
    assert.deepEqual(lintRecipe(cur), [], x.recipe)
    assert.match(cur.body, /^## 선택 보드 판정/m, `${x.recipe}: 본문에 판정 기록이 없다`)
  }
  assert.equal(strict, decisions.length, '엄격 비교가 모든 레시피에서 돌았다')
  // 음성 대조: DNA 밖 키 하나(mood 는 거부 목록 안이라 대신 icons)를 바꾸면 엄격 비교가 잡는다.
  const any = now.get(decisions[0].recipe)
  assert.notDeepEqual(judged({ ...any, icons: { ...any.icons, library: 'x' } }), judged(any))
  // 분포는 성질로 본다(정확한 벌 수를 박지 않는다 — 리뷰 M9): 집행 켜짐 · 문제 없음 · limitsFor 문턱 안.
  const { counts, problems } = diversityReport([...now.values()])
  assert.equal(diversityEnforced(), true)
  assert.deepEqual(problems, [])
  const L = limitsFor(counts.total)
  assert.ok(counts.skeleton <= L.skeletonMax && counts.bold >= L.boldMin && counts.darkDefault >= L.darkMin && counts.m3 >= L.m3Min && counts.m0 <= L.m0Max && counts.noDynamics === 0, JSON.stringify({ counts, L }))
})
