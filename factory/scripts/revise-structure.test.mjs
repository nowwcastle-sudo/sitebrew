// 구획 구조 조작(FIT-1) — 빼기·순서 바꾸기·더하기의 제안(revise)·고르기(applyRevision)·다시 찍기(runStamp)까지 왕복한다.
// 06 은 설치·빌드 없이(install: false) 실제 gen-pages 로 돈다 — 생성된 쪽 파일(app/page.tsx)의 구획 순서를 읽어 「실제 페이지에 반영됐는가」를 본다. 관문(07)·미디어는 주입한 가짜.
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import { bindCopy, runContentStage, validateContent } from '../stamp/content.mjs'
import { loadBrief } from '../stamp/brief.mjs'
import { generateSite } from '../stamp/gen-pages.mjs'
import { applyRevision, parseRevision, revise } from '../stamp/revise.mjs'
import { buildSitemap, writeCandidateBlockers } from '../stamp/sitemap.mjs'
import { chooseVariants } from '../stamp/variants.mjs'
import { leakTable, readinessTable, uiSlotTable } from '../stamp/ui-copy.mjs'
import { EXIT, runReviseCommand, runStamp } from '../stamp/stamp.mjs'
import { archetypes, library, LOCAL_FACTS, localContent, root } from './lib/stamp-site-fixtures.mjs'
import { loadPreferences, weightOf } from '../board/preferences.mjs'
import { fixtureRun, fixtureSite } from './lib/revise-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-structure-test')
mkdirSync(TMP, { recursive: true })
const readJ = (f) => JSON.parse(readFileSync(f, 'utf8'))
const unwrapped = (f) => { const s = readJ(f); return s && typeof s === 'object' && 'inputHash' in s && 'data' in s ? s.data : s }
const prefsOpts = (dir) => ({ seedFile: join(dir, 'no-seed.json'), userFile: join(dir, 'prefs', 'preferences.json') })

/** 생성된 쪽 파일에서 구획이 그려지는 차례(전역 구획 제외). route "/" → app/page.tsx */
const pageOrder = (siteDir, route = '/') => {
  const file = route === '/' ? join(siteDir, 'app', 'page.tsx') : join(siteDir, 'app', ...route.split('/').filter(Boolean), 'page.tsx')
  return [...readFileSync(file, 'utf8').matchAll(/sectionProps\("([^"]+)"\)/g)].map((m) => m[1]).filter((k) => !k.startsWith('global/'))
}

/** 06 까지 끝난 새 복사본 + 04 가 콘텐츠 검사를 통과하도록 가격 칸을 브리프 사실의 글로 고친 것(공용 재료의 예시 글은 다른 사업의 가격이다) */
function validRun(kind) {
  const run = fixtureRun(kind)
  const f = join(run, 'a', '04-content.json')
  const s = readJ(f)
  for (const e of s.data.slots.copy) if (e.id === 'price') e.text = '식빵 4,800원'
  writeFileSync(f, JSON.stringify(s, null, 2))
  return run
}

// ── 제안·고르기 (실행 폴더 = 06 까지 끝난 새 복사본) ─────────────────────────────────────────

test('빼기 제안: FAQ 를 뺀 안 1개 — 지금 사이트·02·03·04 는 그대로, 안의 사이트에는 FAQ 가 없다', async () => {
  const run = fixtureRun('local')
  const site = fixtureSite('local')
  const files = ['02-sitemap.json', '03-variants.json', '04-content.json', '04-content.request.json', 'site/content/site.json'].map((f) => join(run, 'a', f))
  const before = files.map((f) => readFileSync(f, 'utf8'))
  const req = parseRevision('FAQ 빼줘', site)
  assert.deepEqual([req.scope, req.target], ['remove', 'home/faq'])
  const out = await revise(run, 'a', req, { install: false })
  assert.equal(out.status, 'ready')
  assert.equal(out.variants.length, 1, '빼기는 안 1개다')
  assert.deepEqual(files.map((f) => readFileSync(f, 'utf8')), before, '제안만으로 아무것도 바뀌지 않는다')
  const v = out.variants[0]
  assert.equal(v.id, 'v1')
  assert.equal(v.diff.kind, 'remove')
  assert.equal(v.diff.key, 'home/faq')
  assert.ok(v.diff.pageOrder.before.includes('faq') && !v.diff.pageOrder.after.includes('faq'))
  const proposed = readJ(join(run, v.siteRel, 'content', 'site.json'))
  assert.ok('home/faq' in site.sections && !('home/faq' in proposed.sections), 'FAQ 가 안의 사이트에서 사라졌다')
  assert.deepEqual(pageOrder(join(run, v.siteRel)), pageOrder(join(run, 'a', 'site')).filter((k) => k !== 'home/faq'), '나머지 구획의 차례는 그대로')
  const board = readJ(join(run, 'a', '09-revise', String(out.index), 'board.json'))
  assert.equal(board.scope, 'remove')
  assert.equal(board.target, 'home/faq')
  assert.equal(board.status, 'ready')
  assert.equal(board.picked, null)
})

test('빼기: 필수 구획은 사이트맵 기준으로도 거절하고 아무것도 쓰지 않는다 · 쪽에 하나뿐인 구획도', async () => {
  const run = fixtureRun('local')
  const noRev = () => assert.equal(existsSync(join(run, 'a', '09-revise')), false, '09-revise 를 만들지 않았다')
  const r1 = await revise(run, 'a', { scope: 'remove', target: 'home/hero-visit-info', intent: 'remove', text: '히어로 빼줘' }, { install: false })
  assert.match(r1.ask, /꼭 있어야/)
  const r2 = await revise(run, 'a', { scope: 'remove', target: 'booking-complete/confirmation', intent: 'remove', text: '확인 빼줘' }, { install: false })
  assert.ok(r2.ask, '필수이거나 쪽의 마지막 구획')
  const r3 = await revise(run, 'a', { scope: 'remove', target: 'global/footer', intent: 'remove', text: '푸터 빼줘' }, { install: false })
  assert.match(r3.ask, /꼭 있어야/)
  noRev()
})

test('빼기 고르기: 02 에서 빼고 03 에서 지우고 04 문구를 칸과 같이 옮겨 콘텐츠 검사를 통과한다 — 06·07 은 낡음', async () => {
  const run = validRun('local')
  const dir = mkdtempSync(join(TMP, 'a-'))
  try {
    const site = fixtureSite('local')
    const beforeReq = readJ(join(run, 'a', '04-content.request.json'))
    const beforeContent = unwrapped(join(run, 'a', '04-content.json'))
    const beforeBound = new Map([...bindCopy(beforeReq, beforeContent)].map(([p, h]) => [p, h.entry.text]))
    const out = await revise(run, 'a', parseRevision('FAQ 빼줘', site), { install: false })
    const r = await applyRevision(run, 'a', out.index, 'v1', prefsOpts(dir))
    assert.equal(r.applied, true)
    assert.equal(r.scope, 'remove')
    assert.deepEqual(r.stale, ['06', '07'])
    assert.equal(r.waitingCopy, undefined, '빼기는 문구를 기다리지 않는다')
    const sm = unwrapped(join(run, 'a', '02-sitemap.json'))
    const home = sm.pages.find((p) => p.id === 'home')
    assert.ok(!home.sections.some((s) => s.kind === 'faq'))
    assert.ok(sm.excluded.some((e) => e.page === 'home' && e.kind === 'faq' && e.why === 'revise-removed'), '뺀 까닭이 남는다')
    const v03 = readJ(join(run, 'a', '03-variants.json'))
    assert.ok(!('home/faq' in v03.data))
    assert.equal(typeof v03.revisedFor, 'string', 'stamp 가 이 선택을 지키게 사이트맵 해시를 적는다')
    const req = readJ(join(run, 'a', '04-content.request.json'))
    const content = unwrapped(join(run, 'a', '04-content.json'))
    assert.ok(!req.slots.some((s) => s.path.startsWith('home/faq/')) && !req.sections.includes('home/faq'))
    assert.deepEqual(validateContent(req, content), [], '옮긴 04 가 콘텐츠 검사를 통과한다')
    const afterBound = new Map([...bindCopy(req, content)].map(([p, h]) => [p, h.entry.text]))
    for (const [p, t] of afterBound) assert.equal(t, beforeBound.get(p), `${p} 의 글이 밀리지 않았다`)
    assert.equal(afterBound.size, beforeBound.size - [...beforeBound.keys()].filter((p) => p.startsWith('home/faq/')).length)
    for (const n of ['06-pages', '07-qa']) if (existsSync(join(run, 'a', `${n}.json`))) assert.match(readJ(join(run, 'a', `${n}.json`)).inputHash, /^stale:/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('순서 제안·고르기: 위치를 히어로 바로 아래로 — 같은 쪽 안에서 옮긴 안 1개, 04 문구가 칸과 같이 움직여 글이 밀리지 않는다', async () => {
  const run = validRun('local')
  const dir = mkdtempSync(join(TMP, 'o-'))
  try {
    const site = fixtureSite('local')
    const req0 = parseRevision('위치를 히어로 바로 아래로 올려줘', site)
    assert.deepEqual([req0.scope, req0.target, req0.anchor, req0.place], ['order', 'home/directions', 'home/hero-visit-info', 'after'])
    const beforeReq = readJ(join(run, 'a', '04-content.request.json'))
    const beforeContent = unwrapped(join(run, 'a', '04-content.json'))
    const beforeBound = new Map([...bindCopy(beforeReq, beforeContent)].map(([p, h]) => [p, h.entry.text]))
    const oldOrder = pageOrder(join(run, 'a', 'site'))
    const out = await revise(run, 'a', req0, { install: false })
    assert.equal(out.variants.length, 1)
    const v = out.variants[0]
    assert.deepEqual(v.diff.pageOrder.before.slice(0, 3), ['hero-visit-info', 'notice', 'hours-table'])
    assert.deepEqual(v.diff.pageOrder.after.slice(0, 3), ['hero-visit-info', 'directions', 'notice'])
    const proposedOrder = pageOrder(join(run, v.siteRel))
    assert.equal(proposedOrder.indexOf('home/directions'), 1, `히어로 바로 아래: ${proposedOrder.join(' > ')}`)
    assert.equal(oldOrder.indexOf('home/directions') > 1, true, '옮기기 전에는 아래에 있었다')
    assert.deepEqual([...proposedOrder].sort(), [...oldOrder].sort(), '구획은 늘거나 줄지 않았다')
    const r = await applyRevision(run, 'a', out.index, 'v1', prefsOpts(dir))
    assert.equal(r.scope, 'order')
    assert.equal(r.waitingCopy, undefined)
    const home = unwrapped(join(run, 'a', '02-sitemap.json')).pages.find((p) => p.id === 'home')
    assert.deepEqual(home.sections.map((s) => s.kind).slice(0, 3), ['hero-visit-info', 'directions', 'notice'])
    const req = readJ(join(run, 'a', '04-content.request.json'))
    const content = unwrapped(join(run, 'a', '04-content.json'))
    assert.deepEqual(validateContent(req, content), [])
    const afterBound = new Map([...bindCopy(req, content)].map(([p, h]) => [p, h.entry.text]))
    assert.equal(afterBound.size, beforeBound.size)
    for (const [p, t] of afterBound) assert.equal(t, beforeBound.get(p), `${p} 의 글이 밀리지 않았다`)
    assert.notDeepEqual(req.slots.map((s) => s.path), beforeReq.slots.map((s) => s.path), '문구 칸의 차례도 새 구획 순서를 따른다')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('순서: 이미 그 순서이거나 히어로를 어기면 거절한다 — 아무것도 쓰지 않는다', async () => {
  const run = fixtureRun('local')
  const noRev = () => assert.equal(existsSync(join(run, 'a', '09-revise')), false)
  assert.match((await revise(run, 'a', { scope: 'order', target: 'home/notice', anchor: 'home/hero-visit-info', place: 'after', intent: 'order', text: '공지를 히어로 아래로' }, { install: false })).ask, /이미/)
  assert.match((await revise(run, 'a', { scope: 'order', target: 'home/faq', anchor: null, place: 'start', intent: 'order', text: 'FAQ 맨 위로' }, { install: false })).ask, /히어로/)
  assert.ok((await revise(run, 'a', { scope: 'order', target: 'home/faq', anchor: 'booking-complete/confirmation', place: 'after', intent: 'order', text: 'x' }, { install: false })).ask, '다른 쪽')
  noRev()
})

test('더하기 제안·고르기(saas FAQ): 허용 변형 상위 2개를 내고, 고르면 02·03 에 원형이 적은 자리로 넣고 새 칸을 입력 대기로 둔다', async () => {
  const run = fixtureRun('saas')
  const dir = mkdtempSync(join(TMP, 'd-'))
  try {
    const site = fixtureSite('saas')
    const req0 = parseRevision('FAQ 추가해줘', site)
    assert.deepEqual([req0.scope, req0.target], ['add', 'home/faq'])
    const out = await revise(run, 'a', req0, { install: false })
    assert.equal(out.status, 'ready')
    assert.equal(out.variants.length, 2)
    const blocks = out.variants.map((v) => v.block)
    assert.equal(new Set(blocks).size, 2, '두 안은 서로 다른 변형이다')
    const allowed = archetypes.saas.pages.find((p) => p.id === 'home').sections.find((s) => s.kind === 'faq').allowedVariants
    for (const b of blocks) assert.ok(allowed.includes(b), `${b} 는 원형이 허용한 변형`)
    for (const v of out.variants) {
      assert.equal(v.diff.kind, 'add')
      assert.ok(v.diff.pageOrder.after.includes('faq') && !v.diff.pageOrder.before.includes('faq'))
      assert.ok(v.diff.needsCopy.some((p) => p === 'home/faq/qa'), '새 구획의 문구 칸이 있다')
    }
    // 안마다 사이트맵 사본에는 그 변형으로 못 박힌 구획이 원형 순서로 들어 있다. (이 브리프에는 FAQ 자료가 없어 06 은 「자료 연결 안 됨」으로 쪽에 그리지 않는다 — 그리는 쪽은 local 왕복 시험이 본다)
    for (const v of out.variants) {
      const smCopy = unwrapped(join(run, dirname(v.siteRel), '02-sitemap.json'))
      const kinds = smCopy.pages.find((p) => p.id === 'home').sections.map((x) => x.kind)
      assert.equal(kinds.indexOf('faq'), kinds.indexOf('final-cta') - 1, `마지막 행동 띠 바로 앞(원형 순서): ${kinds.join(' > ')}`)
      assert.deepEqual(smCopy.pages.find((p) => p.id === 'home').sections.find((x) => x.kind === 'faq').allowedVariants, [v.block], '제안 사본에서는 06 이 다른 변형으로 슬쩍 바꾸지 못하게 못 박는다')
      assert.ok(v.blockers.some((b) => /faq/.test(b)), `자료가 없다는 사실을 공개 불가 사유로 보인다: ${JSON.stringify(v.blockers)}`)
    }
    // 지금 상태는 그대로
    assert.ok(!unwrapped(join(run, 'a', '02-sitemap.json')).pages[0].sections.some((s) => s.kind === 'faq'))
    const r = await applyRevision(run, 'a', out.index, 'v2', prefsOpts(dir))
    assert.equal(r.scope, 'add')
    assert.equal(r.block, blocks[1])
    assert.ok(r.waitingCopy.endsWith('04-content.request.json'), '새 구획의 문구는 입력 대기다')
    const home = unwrapped(join(run, 'a', '02-sitemap.json')).pages.find((p) => p.id === 'home')
    const kinds = home.sections.map((s) => s.kind)
    assert.equal(kinds.indexOf('faq'), kinds.indexOf('final-cta') - 1, `원형이 적은 자리: ${kinds.join(' > ')}`)
    assert.deepEqual(home.sections.find((s) => s.kind === 'faq').allowedVariants, allowed, '02 에는 허용 변형 전부가 남는다(고른 안 하나로 못 박지 않는다)')
    assert.equal(readJ(join(run, 'a', '03-variants.json')).data['home/faq'], blocks[1])
    assert.ok(!unwrapped(join(run, 'a', '02-sitemap.json')).excluded.some((e) => e.page === 'home' && e.kind === 'faq'), '더했으니 「사실 없음」 제외 줄은 지운다')
    const req = readJ(join(run, 'a', '04-content.request.json'))
    assert.ok(req.pendingSlots.includes('home/faq/qa') && req.pendingSlots.every((p) => p.startsWith('home/faq/')))
    const slotPaths = req.slots.map((s) => s.path)
    assert.ok(slotPaths.indexOf('home/faq/qa') < slotPaths.findIndex((p) => p.startsWith('home/final-cta/')), '새 칸은 새 구획 순서에 있다')
    const content = unwrapped(join(run, 'a', '04-content.json'))
    const entry = bindCopy(req, content).get('home/faq/qa')?.entry
    assert.ok(entry, '새 칸의 항목이 04 콘텐츠에 있다(글을 쓸 자리)')
    // 학습: 고른 변형이 이기고 다른 안이 진다
    assert.ok(weightOf(loadPreferences(prefsOpts(dir)), 'saas', blocks[1]) > 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('더하기(local 후기): 허용 변형이 하나뿐인 구획은 안 1개 + 까닭을 알린다 · 사실이 없는 칸은 자리 표시를 놓는다', async () => {
  const run = validRun('local')
  const dir = mkdtempSync(join(TMP, 'd2-'))
  try {
    const out = await revise(run, 'a', parseRevision('후기 섹션 추가해줘', fixtureSite('local')), { install: false })
    assert.equal(out.variants.length, 1)
    assert.ok(out.notes.includes('허용 변형이 1개뿐이에요.'), JSON.stringify(out.notes)) // grammar.yaml text.section.fewAllowed
    const r = await applyRevision(run, 'a', out.index, 'v1', prefsOpts(dir))
    const req = readJ(join(run, 'a', '04-content.request.json'))
    const content = unwrapped(join(run, 'a', '04-content.json'))
    const bound = bindCopy(req, content)
    const slot = req.slots.find((s) => s.path.startsWith('home/external-reviews/'))
    assert.ok(slot.placeholder === true, '후기 사실이 없는 브리프라 이 칸은 자리 표시 칸이다')
    assert.equal(bound.get(slot.path).entry.text, '확인 필요', '지어내지 않고 자리 표시를 놓는다')
    assert.ok(r.waitingCopy)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('더하기: 콘텐츠 스키마가 이 사이트에서 그 구획의 칸을 거절하면(의료 업종의 후기) 도구 실패가 아니라 정직한 거절이고 만들다 만 제안 폴더를 남기지 않는다', async () => {
  const run = fixtureRun('local')
  const refuse = async () => { throw new Error('콘텐츠가 스키마를 통과하지 못했다: slots.copy.10 — 의료 변형에서는 후기 칸을 싣지 않습니다(의료법 제56조②2) — 「link」 칸은 후기를 담는 칸입니다') }
  const r = await revise(run, 'a', parseRevision('후기 섹션 추가해줘', fixtureSite('local')), { install: false, generate: refuse })
  assert.match(r.ask, /더할 수 없어요: 의료 변형에서는 후기 칸을/)
  assert.ok(r.ask.length < 80)
  assert.equal(existsSync(join(run, 'a', '09-revise')) ? readdirSync(join(run, 'a', '09-revise')).length : 0, 0, '09-revise/<번호> 가 남지 않았다')
  // 스키마와 무관한 도구 오류는 삼키지 않는다
  await assert.rejects(() => revise(run, 'a', parseRevision('후기 섹션 추가해줘', fixtureSite('local')), { install: false, generate: async () => { throw new Error('디스크가 가득 찼다') } }), /디스크/)
})

test('더하기: 이미 있거나 이 원형이 받지 못하는 구획은 거절한다', async () => {
  const run = fixtureRun('local')
  for (const target of ['home/faq', 'home/gallery', 'home/hero-visit-info', 'home/nothing', 'booking-complete/nothing']) {
    const r = await revise(run, 'a', { scope: 'add', target, intent: 'add', text: 'x' }, { install: false })
    assert.ok(r.ask && r.ask.length < 80, `${target} → ${JSON.stringify(r)}`)
  }
  assert.equal(existsSync(join(run, 'a', '09-revise')), false)
})

// ── stamp 왕복: 실제 단계(02~06, install: false)로 처음 찍고 → 수정 → 고르기 → 다시 찍기 ──────────────────

// 문구 에이전트가 하는 일을 대신한다: 지어낸 사실 검사를 넘기려고 가격 칸은 브리프 사실의 글로 쓴다
const agentContent = (request) => { const c = localContent(request); for (const e of c.slots.copy) if (e.id === 'price') e.text = '식빵 4,800원'; return c }
const BRIEF = { topic: '동네 식빵집', archetype: 'local', locale: 'ko', seed: 3, facts: LOCAL_FACTS }
let master, deps, calls, agentRuns
function makeDeps() {
  calls = {}
  agentRuns = 0
  const hit = (k) => { calls[k] = (calls[k] ?? 0) + 1 }
  const cands = ['a', 'b', 'c'].map((id, i) => ({ id, slot: 'library', source: 'library', recipe: library[i].id }))
  const blockNames = (sm) => [...new Set([...sm.pages.flatMap((p) => p.sections), ...(sm.globals ?? [])].filter((s) => s.status === 'block').flatMap((s) => s.allowedVariants))]
  return {
    say: () => {},
    doctor: async () => ({ ok: true, results: [] }),
    loadBrief: (f) => loadBrief(f),
    loadArchetype: async (id) => archetypes[id],
    weights: () => [],
    directions: async () => ({ candidates: cands.map((c) => ({ ...c })), rejected: [] }),
    screen: async () => {},
    sitemap: async ({ archetype, brief }) => { hit('sitemap'); return buildSitemap(archetype, brief) },
    afterSitemap: ({ runDir, cand, sitemap }) => writeCandidateBlockers(runDir, cand.id, sitemap),
    variants: async ({ sitemap, candidates, seed }) => {
      hit('variants')
      return chooseVariants(sitemap, candidates.map((c) => ({ id: c.id, recipe: c.recipe })), { seed, weights: [], readiness: await readinessTable(blockNames(sitemap)), leaks: await leakTable(sitemap) })
    },
    variantsKey: async ({ sitemap }) => [...(await leakTable(sitemap))].sort(),
    // 문구 에이전트: 요청이 처음 나왔을 때만 쓴다. 옮기기·빼기는 04 가 이미 맞춰져 있어 에이전트가 필요 없다.
    content: async ({ run, cand, sitemap, variants, seed, archetype, brief }) => {
      const uiSlots = await uiSlotTable(Object.values(variants), { locale: brief.locale })
      const ctx = { archetype, brief, uiSlots }
      let r = runContentStage(run, cand, sitemap, variants, seed, ctx)
      if (r.status === 'needs-copy' && !existsSync(join(run.dir, cand.id, '04-content.json'))) {
        agentRuns++
        writeFileSync(join(run.dir, cand.id, '04-content.json'), JSON.stringify(agentContent(r.request), null, 2))
        r = runContentStage(run, cand, sitemap, variants, seed, ctx)
      }
      return r
    },
    media: async () => ({ plan: 0, assets: 0, placeholders: 0, requests: 0, credits: 0 }),
    pages: async ({ runDir, cand }) => {
      hit('pages')
      const r = await generateSite(runDir, cand, { install: false })
      return { siteDir: r.siteDir, routes: r.routes, blockers: r.blockers.length, skipped: r.skipped.length, build: null, builtAt: `p${calls.pages}` }
    },
    qa: async () => { throw new Error('07 은 부르지 않는다') },
  }
}
const stamp = (run, extra = {}) => runStamp({ brief: join(TMP, 'brief.json'), run, until: '06-pages', pick: 'a', ...extra }, deps)

before(async () => {
  writeFileSync(join(TMP, 'brief.json'), JSON.stringify(BRIEF))
  master = mkdtempSync(join(TMP, 'm-'))
  deps = makeDeps()
  const r = await stamp(master)
  assert.equal(r.code, EXIT.done, r.lines.join('\n'))
  assert.equal(agentRuns, 1)
})
after(() => { if (master) rmSync(master, { recursive: true, force: true }) })

const copyRun = () => { const dest = mkdtempSync(join(TMP, 'c-')); const run = join(dest, 'run'); cpSync(master, run, { recursive: true }); return run }

test('왕복 — FAQ 빼줘: 제안 → 고르기 → 다시 찍기에서 03 을 다시 고르지 않고 04 도 에이전트 없이 통과해 쪽에서 FAQ 가 사라진다', async () => {
  const run = copyRun()
  const dir = mkdtempSync(join(TMP, 'rt1-'))
  try {
    const order0 = pageOrder(join(run, 'a', 'site'))
    assert.ok(order0.includes('home/faq'))
    const lines = []
    const p = await runReviseCommand({ run, pick: 'a', revise: 'FAQ 빼줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
    assert.equal(p.code, EXIT.done, lines.join('\n'))
    assert.match(lines.join('\n'), /고르려면: .*--revise-pick 1:<안>/)
    const k = await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: (s) => lines.push(s) })
    assert.equal(k.code, EXIT.done, k.lines.join('\n'))
    assert.match(k.lines.join('\n'), /낡은 단계: 06·07/)
    assert.match(k.lines.join('\n'), /home\/faq 구획을 뺐다/)
    assert.match(k.lines.join('\n'), /다음:/)
    const variantsBefore = calls.variants, agentBefore = agentRuns, pagesBefore = calls.pages
    const r = await stamp(run)
    assert.equal(r.code, EXIT.done, r.lines.join('\n'))
    assert.equal(calls.variants, variantsBefore, '03 을 다시 고르지 않았다(수정으로 고른 안이 그대로다)')
    assert.equal(agentRuns, agentBefore, '문구 에이전트를 부르지 않았다')
    assert.equal(calls.pages, pagesBefore + 1, '06 은 다시 돌았다')
    const order1 = pageOrder(join(run, 'a', 'site'))
    assert.deepEqual(order1, order0.filter((x) => x !== 'home/faq'), `쪽의 구획 차례: ${order0.join(' > ')}  ⇒  ${order1.join(' > ')}`)
    const stage04 = readJ(join(run, 'a', '04-content.json'))
    assert.ok('inputHash' in stage04 && 'data' in stage04, '04 는 새 요청의 해시로 다시 감싸졌다')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('왕복 — 위치를 히어로 바로 아래로: 쪽에서 구획 순서가 바뀐다', async () => {
  const run = copyRun()
  const order0 = pageOrder(join(run, 'a', 'site'))
  const lines = []
  assert.equal((await runReviseCommand({ run, pick: 'a', revise: '위치를 히어로 바로 아래로 올려줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })).code, EXIT.done, lines.join('\n'))
  assert.equal((await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: (s) => lines.push(s) })).code, EXIT.done)
  const variantsBefore = calls.variants, agentBefore = agentRuns
  const r = await stamp(run)
  assert.equal(r.code, EXIT.done, r.lines.join('\n'))
  assert.equal(calls.variants, variantsBefore)
  assert.equal(agentRuns, agentBefore)
  const order1 = pageOrder(join(run, 'a', 'site'))
  assert.equal(order0.indexOf('home/directions') > 1, true)
  assert.equal(order1.indexOf('home/directions'), 1, `${order0.join(' > ')}  ⇒  ${order1.join(' > ')}`)
  assert.deepEqual([...order1].sort(), [...order0].sort())
  // 글이 밀리지 않았다: 모든 구획의 props 를 $ref 까지 풀어 보면 옮기기 전과 같은 글이다(문구 칸 번호는 순서와 같이 바뀐다)
  const s0 = readJ(join(master, 'a', 'site', 'content', 'site.json')), s1 = readJ(join(run, 'a', 'site', 'content', 'site.json'))
  const at = (o, path) => path.split('.').reduce((v, k) => v?.[k], o)
  const resolved = (v, site) => (Array.isArray(v) ? v.map((x) => resolved(x, site)) : v && typeof v === 'object' ? ('$ref' in v ? at(site, v.$ref) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolved(x, site)]))) : v)
  assert.deepEqual(Object.keys(s1.sections).sort(), Object.keys(s0.sections).sort())
  for (const key of Object.keys(s0.sections)) assert.deepEqual(resolved(s1.sections[key].props, s1), resolved(s0.sections[key].props, s0), `${key} 의 글이 밀리지 않았다`)
  assert.notDeepEqual(JSON.stringify(s1.content ?? s1.slots), JSON.stringify(s0.content ?? s0.slots), '문구 항목의 차례는 새 구획 순서를 따라 바뀌었다')
})

test('왕복 — FAQ 를 빼고 다시 FAQ 추가해줘: 원형이 적은 자리로 돌아오고 새 문구 칸은 입력 대기(종료 3)다 — 에이전트가 쓰면 쪽에 그려진다', async () => {
  const run = copyRun()
  const dir = mkdtempSync(join(TMP, 'rt3-'))
  try {
    const order0 = pageOrder(join(run, 'a', 'site'))
    const lines = []
    // 빼기
    const r1 = await runReviseCommand({ run, pick: 'a', revise: 'FAQ 빼줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
    assert.equal(r1.code, EXIT.done)
    assert.equal((await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: () => {} })).code, EXIT.done)
    assert.equal((await stamp(run)).code, EXIT.done)
    assert.ok(!pageOrder(join(run, 'a', 'site')).includes('home/faq'))
    // 더하기 — 안 2개
    const lines2 = []
    const r2 = await runReviseCommand({ run, pick: 'a', revise: 'FAQ 추가해줘' }, { say: (s) => lines2.push(s), revOpts: { install: false } })
    assert.equal(r2.code, EXIT.done, lines2.join('\n'))
    assert.match(lines2.join('\n'), /v1 .*\n.*v2 /s)
    assert.match(lines2.join('\n'), /고르려면: .*--revise-pick 2:<안>/)
    const k = await runReviseCommand({ run, pick: 'a', revisePick: { index: 2, id: 'v1' } }, { say: () => {} })
    assert.equal(k.code, EXIT.waiting, k.lines.join('\n'))
    assert.match(k.lines.join('\n'), /대기: 새 구획의 문구 칸|대기:/)
    // 다시 찍기: 새 칸이 비어 있어 04 에서 멈춘다(종료 3) — 03 은 다시 고르지 않는다
    const variantsBefore = calls.variants
    const w = await stamp(run)
    assert.equal(w.code, EXIT.waiting, w.lines.join('\n'))
    assert.match(w.lines.join('\n'), /문구가 비었다: home\/faq\/qa|home\/faq\/qa/)
    assert.equal(calls.variants, variantsBefore)
    // 에이전트가 새 칸을 쓴다
    const file = join(run, 'a', '04-content.json')
    const content = unwrapped(file)
    const req = readJ(join(run, 'a', '04-content.request.json'))
    const bound = bindCopy(req, content)
    const slot = req.slots.find((s) => s.path === 'home/faq/qa')
    assert.ok(slot && bound.get(slot.path), '새 칸이 04 콘텐츠에 비어 있는 항목으로 있다')
    const entry = bound.get(slot.path).entry
    entry.text = '자주 묻는 질문을 모았어요'
    writeFileSync(file, JSON.stringify(content, null, 2))
    const done = await stamp(run)
    assert.equal(done.code, EXIT.done, done.lines.join('\n'))
    const order2 = pageOrder(join(run, 'a', 'site'))
    assert.deepEqual(order2, order0, `FAQ 가 원형이 적은 자리로 돌아왔다: ${order2.join(' > ')}`)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
