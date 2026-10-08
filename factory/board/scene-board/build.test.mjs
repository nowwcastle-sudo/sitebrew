// 보드 A2(장면 보드) 순수 시험 — 브라우저 없음(Chrome 을 쓰는 시험은 board.behavior.test.mjs).
// 목록(jobs.mjs)이 손 목록이 아니라 블록 메타·레시피 초안에서 나오는지, 문서 id, 게시본의 뼈대 태그, 초안 준비(draft-preview.mjs)의 거절을 본다.
// 모듈은 시험 안에서 불러온다 — 아직 없는 모듈은 시험 하나씩 실패로 드러난다(RED).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { FV1_HEROES, loadBlocks, blockName } from '../../scripts/blocks.mjs'
import { isUnconfirmed } from '../../scripts/recipe.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { judgeRecipes, metaOf } from '../block-board/jobs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const load = (f) => import(`./${f}`)
const noScript = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '')
const blocks = loadBlocks()
const heads = loadHeads()
const blockMeta = (b) => metaOf(b)
const isBold = (b) => blockMeta(b)?.boldness === 'bold'

// ── 목록(jobs.mjs) ──────────────────────────────────────────────────────────
test('jobs: scene blocks are FV1_HEROES plus every block whose meta says boldness bold — no hand list', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const jobs = sceneJobs()
  const got = jobs.filter((j) => j.kind === 'block').map((j) => j.id).sort()
  const want = new Set(FV1_HEROES.map((v) => blockName('hero', v)))
  for (const b of blocks) if (isBold(b)) want.add(blockName(b.kind, b.variant))
  assert.deepEqual(got, [...want].sort())
  for (const v of FV1_HEROES) assert.ok(got.includes(blockName('hero', v)), `FV1_HEROES ${v}`)
  // 손 목록 금지: 원천에 블록 변형 이름·레시피 id 가 글자로 박혀 있지 않다.
  const src = readFileSync(join(HERE, 'jobs.mjs'), 'utf8')
  for (const v of FV1_HEROES) assert.ok(!src.includes(v), `jobs.mjs 에 ${v} 가 박혀 있다`)
  assert.ok(!/['"`]r1[2-6]-/.test(src), '레시피 초안 id 를 글자로 박지 않는다')
})

test('jobs: the list follows the meta — a new bold block appears, a block turned standard disappears (FV1 heroes always stay)', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const synthetic = { kind: 'final-cta', variant: 'zz-bold-test', source: '', meta: { kind: 'final-cta', variant: 'zz-bold-test', title: '시험용 대담 마무리 띠', archetypes: ['brand'], motion: ['rise'], boldness: 'bold', boldMode: 'motion', layout: 'x', density: 'compact', states: [], media: [], archetypeKinds: ['final-cta'] } }
  const withNew = sceneJobs({ blocks: [...blocks, synthetic] }).filter((j) => j.kind === 'block').map((j) => j.id)
  assert.ok(withNew.includes('block-final-cta-zz-bold-test'))
  const motionBold = blocks.find((b) => isBold(b) && !FV1_HEROES.includes(b.variant))
  assert.ok(motionBold, '기존 대담안 블록 가운데 FV1_HEROES 밖의 것이 하나는 있다')
  const demoted = blocks.map((b) => (b === motionBold ? { ...b, meta: { ...blockMeta(b), boldness: 'standard', boldMode: undefined } } : b))
  const ids = sceneJobs({ blocks: demoted }).filter((j) => j.kind === 'block').map((j) => j.id)
  assert.ok(!ids.includes(blockName(motionBold.kind, motionBold.variant)))
  const heroDemoted = blocks.map((b) => (b.kind === 'hero' && b.variant === FV1_HEROES[0] ? { ...b, meta: { ...blockMeta(b), boldness: 'standard', boldMode: undefined } } : b))
  assert.ok(sceneJobs({ blocks: heroDemoted }).some((j) => j.id === blockName('hero', FV1_HEROES[0])), 'FV1_HEROES 는 대담안 표시와 상관없이 들어간다')
})

test('jobs: each block gets the first library recipe that fits its archetypes (the block-matrix pick), never a r12~r16 draft; the address is /qa/blocks?b=&r=&frame=1', async () => {
  const { sceneJobs, inDraftRange } = await load('jobs.mjs')
  const lib = heads.filter((h) => !inDraftRange(h.id))
  for (const j of sceneJobs().filter((x) => x.kind === 'block')) {
    const b = blocks.find((x) => blockName(x.kind, x.variant) === j.id)
    assert.equal(j.recipe, judgeRecipes(blockMeta(b), lib).primary, j.id)
    assert.ok(lib.some((h) => h.id === j.recipe), `${j.id}: 라이브러리 레시피`)
    assert.ok(!inDraftRange(j.recipe))
    assert.equal(j.path, `/qa/blocks?b=${j.id}&r=${j.recipe}&frame=1`)
    assert.equal(j.sel, `[data-block="${b.kind}-${b.variant}"]`)
    assert.ok(j.name && /[가-힣]/.test(j.name), `${j.id}: 한국어 한 줄 설명`)
    assert.equal(j.bold, isBold(b))
  }
})

test('jobs: recipe drafts are exactly r12~r16 — doc id = recipe id, address /qa/recipes?r=&scene=<first signature>&frame=1', async () => {
  const { sceneJobs, draftHeads } = await load('jobs.mjs')
  const jobs = sceneJobs().filter((j) => j.kind === 'recipe')
  assert.deepEqual(jobs.map((j) => j.id.slice(0, 3)), ['r12', 'r13', 'r14', 'r15', 'r16'])
  // 보드 A2 에서 운영자가 「좋다」로 골라 확정된 뒤에는 「## 운영자 확인 전」 절이 없어(open: false) 라이브러리 레시피로 읽힌다 — 두 갈래를 다 찾는 draftHeads 가 원천이다.
  const drafts = new Map(draftHeads().map((d) => [d.id, d.head]))
  for (const j of jobs) {
    const h = drafts.get(j.id)
    assert.ok(h, `${j.id} 는 r12~r16 범위의 초안 또는 확정 레시피`)
    assert.equal(j.scene, h.signature[0])
    assert.equal(j.path, `/qa/recipes?r=${j.id}&scene=${h.signature[0]}&frame=1`)
    assert.equal(j.sel, `article[data-scene="${h.signature[0]}"]`)
    assert.equal(j.bold, false)
  }
})

test('jobs: draft ids are also found when a preview folder already removed the 「운영자 확인 전」 section (then they are library recipes, still not used for blocks)', async () => {
  const { draftHeads, inDraftRange } = await load('jobs.mjs')
  const root = mkdtempSync(join(tmpdir(), 'scene-board-roots-'))
  try {
    const md = readFileSync(join(HERE, '..', '..', '..', 'registry', 'factory', 'recipes', 'r12-spectrum', 'DESIGN.md'), 'utf8')
    const { stripUnconfirmedSection } = await load('draft-preview.mjs')
    mkdirSync(join(root, 'registry', 'factory', 'recipes', 'r12-spectrum'), { recursive: true })
    writeFileSync(join(root, 'registry', 'factory', 'recipes', 'r12-spectrum', 'DESIGN.md'), stripUnconfirmedSection(md))
    assert.deepEqual(draftHeads({ root }).map((d) => d.id), ['r12-spectrum'])
    assert.ok(inDraftRange('r12-spectrum') && inDraftRange('r16-tonal') && !inDraftRange('r11-nocturne') && !inDraftRange('r17-x') && !inDraftRange('r1-measure'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('jobs: doc ids are unique — block name or recipe id — and the list passes its own check', async () => {
  const { sceneJobs, checkJobs } = await load('jobs.mjs')
  const jobs = sceneJobs()
  const ids = jobs.map((j) => j.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const j of jobs) assert.ok(j.kind === 'block' ? /^block-[a-z0-9-]+$/.test(j.id) : /^r(1[2-6])-[a-z0-9-]+$/.test(j.id), j.id)
  assert.deepEqual(checkJobs(jobs), [])
  assert.ok(checkJobs(jobs.filter((j) => j.kind === 'block')).some((p) => /초안/.test(p)), '초안이 5벌이 아니면 문제로 센다')
  assert.ok(checkJobs([...jobs, jobs[0]]).some((p) => /중복/.test(p)))
})

// ── 촬영(capture.mjs) ───────────────────────────────────────────────────────
test('capture: jobs map onto the board v2 captureAll jobs unchanged — absolute url, own selector, file names, same size budget as board v2', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const cap = await load('capture.mjs')
  const jobs = sceneJobs()
  const mapped = cap.captureJobs(jobs, 'http://localhost:3999/')
  assert.equal(mapped.length, jobs.length)
  mapped.forEach((m, i) => {
    assert.equal(m.url, `http://localhost:3999${jobs[i].path}`)
    assert.equal(m.sel, jobs[i].sel)
    assert.equal(m.recipe, jobs[i].id)
    assert.equal(m.option, 'A')
    assert.deepEqual(m.files, { video: `${jobs[i].id}.webm`, mp4: `${jobs[i].id}.mp4`, 1440: `${jobs[i].id}-1440.webp`, 375: `${jobs[i].id}-375.webp` })
  })
  assert.equal(cap.BUDGET.videoMaxBytes, 4 * 1048576, '파일 하나 ≤ 4MB(보드 v2 와 같다)')
  assert.equal(cap.BUDGET.totalMaxBytes, 60 * 1048576, '합 ≤ 60MB(보드 v2 와 같다)')
  assert.ok(/\.tmp[\\/]scene-board$/.test(cap.OUT))
  assert.deepEqual(cap.pickJobs(jobs, { only: [jobs[1].id] }).map((j) => j.id), [jobs[1].id])
  assert.deepEqual(cap.pickJobs(jobs, { limit: 2 }).map((j) => j.id), jobs.slice(0, 2).map((j) => j.id))
  assert.throws(() => cap.pickJobs(jobs, { only: ['block-nope'] }), /block-nope/)
})

// ── 보드(build.mjs) ─────────────────────────────────────────────────────────
const fakeManifest = (jobs, only) => ({
  files: jobs.filter((j) => !only || only.includes(j.id)).flatMap((j) => [`${j.id}.mp4`, `${j.id}.webm`, `${j.id}-1440.webp`, `${j.id}-375.webp`].map((file) => ({ file, recipe: j.id, option: 'A', kind: /webp$/.test(file) ? 'still' : 'video', bytes: 1 }))),
})

test('build: published bundle has no doctype/html/head/body tags, keeps title/style/script; the full page has them; data collection is scenes', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const b = await load('build.mjs')
  const jobs = sceneJobs()
  const data = b.sceneBoardData(jobs, fakeManifest(jobs))
  const html = b.buildSceneBoard(data, { generatedAt: '2026-10-10T00:00:00.000Z' })
  assert.match(html, /^<!doctype html>/i)
  assert.match(html, /<body>/)
  const pub = b.artifactHtml(html)
  assert.doesNotMatch(pub, /<!doctype/i)
  assert.doesNotMatch(pub, /<\/?(html|head|body)[\s>]/i)
  assert.match(pub, /<title>[^<]+<\/title>/)
  assert.match(pub, /<style>/)
  assert.match(pub, /<script>/)
  assert.equal(b.COLLECTION, 'scenes')
  assert.match(html, /const COLLECTION = "scenes"/)
  assert.doesNotMatch(html, /collection\("likes"\)/)
})

test('build: every scene is a card with its Korean one-line name, a 대담안 mark where bold, video (mp4 first, webm), 좋다·별로 and a memo; drafts are marked as drafts', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const b = await load('build.mjs')
  const jobs = sceneJobs()
  const data = b.sceneBoardData(jobs, fakeManifest(jobs))
  assert.equal(data.length, jobs.length)
  const html = noScript(b.buildSceneBoard(data))
  for (const j of jobs) {
    assert.match(html, new RegExp(`id="card-${j.id}"`), j.id)
    assert.ok(html.includes(b.esc(j.name)), `${j.id} 이름`)
  }
  const bold = jobs.filter((j) => j.bold).length
  assert.equal((html.match(/class="badge bold"/g) ?? []).length, bold)
  assert.ok(bold >= 6)
  assert.equal((html.match(/data-like="like"/g) ?? []).length, jobs.length)
  assert.equal((html.match(/data-like="dislike"/g) ?? []).length, jobs.length)
  assert.equal((html.match(/data-note/g) ?? []).length, jobs.length)
  const j0 = jobs[0]
  assert.ok(html.indexOf(`video/${j0.id}.mp4`) > -1 && html.indexOf(`video/${j0.id}.mp4`) < html.indexOf(`video/${j0.id}.webm`), 'MP4 를 먼저 고른다')
  assert.equal((html.match(/class="badge draft"/g) ?? []).length, jobs.filter((j) => j.kind === 'recipe').length)
})

test('build: scenes not captured yet show 「촬영 전」 and no answer controls; --strict style check lists them', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const b = await load('build.mjs')
  const jobs = sceneJobs()
  const only = [jobs[0].id]
  const data = b.sceneBoardData(jobs, fakeManifest(jobs, only))
  assert.deepEqual(data.filter((d) => d.captured).map((d) => d.id), only)
  const html = noScript(b.buildSceneBoard(data))
  assert.equal((html.match(/촬영 전/g) ?? []).length >= jobs.length - 1, true)
  assert.equal((html.match(/data-like="like"/g) ?? []).length, 1)
  assert.deepEqual(b.missingScenes(data), jobs.slice(1).map((j) => j.id))
})

test('build: the page script keeps the board v2 save rules (confirmed read first, hold while the subscription is down, update only changed fields, set only after a re-read) and the scenes doc shape', async () => {
  const b = await load('build.mjs')
  const s = b.SCRIPT
  assert.match(s, /loaded\[id\]/)
  assert.match(s, /dbState = 'blocked'/)
  assert.match(s, /ref\.update\(patchOf\(values, at\)\)/)
  assert.match(s, /ref\.set\(body\)/)
  assert.match(s, /await ref\.get\(\)/)
  assert.match(s, /fromCache/)
  assert.match(s, /invalid_argument/)
  assert.doesNotMatch(s, /localStorage|sessionStorage|indexedDB/, '브라우저 저장소는 쓰지 않는다')
  // 문서 모양 { like, note?, at }
  assert.equal(b.docShape({ like: 'like', note: ' 좋다 ', at: 'x' }).like, 'like')
  assert.deepEqual(b.docShape({ like: 'dislike', note: '', at: '2026-10-10T00:00:00.000Z' }), { like: 'dislike', at: '2026-10-10T00:00:00.000Z' })
  assert.deepEqual(b.docShape({ like: null, note: '메모', at: 'a' }), { like: null, note: '메모', at: 'a' })
})

test('build: both themes (light tokens + dark tokens on :root) and a 375px-safe layout rule are present', async () => {
  const b = await load('build.mjs')
  const html = b.buildSceneBoard([])
  assert.match(html, /:root \{[^}]*--bg: #/)
  assert.match(html, /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/)
  assert.match(html, /:root\[data-theme="dark"\]/)
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/)
  assert.match(html, /<html lang="ko">/)
})

// ── 초안 준비(draft-preview.mjs) ────────────────────────────────────────────
const DRAFT = ['---', 'name: 시험 초안', '---', '', '## 분위기', '', '조용하다.', '', '## 운영자 확인 전', '', '운영자가 확인하기 전이다.', '', '- 알아 둘 것', ''].join('\n')

test('draft-preview: stripUnconfirmedSection removes the section (heading to next ## or end), keeps the rest and the line ending', async () => {
  const { stripUnconfirmedSection } = await load('draft-preview.mjs')
  assert.equal(isUnconfirmed(DRAFT), true)
  const out = stripUnconfirmedSection(DRAFT)
  assert.equal(isUnconfirmed(out), false)
  assert.equal(out, ['---', 'name: 시험 초안', '---', '', '## 분위기', '', '조용하다.', ''].join('\n'))
  const mid = ['## 앞', '', '가', '', '## 운영자 확인 전', '', '나', '', '## 뒤', '', '다', ''].join('\n')
  assert.equal(stripUnconfirmedSection(mid), ['## 앞', '', '가', '', '## 뒤', '', '다', ''].join('\n'))
  const crlf = DRAFT.replace(/\n/g, '\r\n')
  const o2 = stripUnconfirmedSection(crlf)
  assert.equal(isUnconfirmed(o2), false)
  assert.ok(o2.includes('\r\n') && !/[^\r]\n/.test(o2), 'CRLF 를 지킨다')
  assert.equal(stripUnconfirmedSection('## 분위기\n\n가\n'), '## 분위기\n\n가\n', '절이 없으면 그대로')
})

test('draft-preview: refuses the repo base checkout, this lane worktree, the tree the script lives in, a main checkout (.git directory) and a non-worktree — before touching any file', async () => {
  const { previewDirProblems, BASE_CHECKOUT, LANE_WORKTREE } = await load('draft-preview.mjs')
  const root = join(HERE, '..', '..', '..')
  assert.ok(previewDirProblems(BASE_CHECKOUT, { root: 'X:/elsewhere' }).some((p) => /기본 작업 폴더/.test(p)))
  assert.ok(previewDirProblems(BASE_CHECKOUT.toUpperCase().replace(/\//g, '\\'), { root: 'X:/elsewhere' }).some((p) => /기본 작업 폴더/.test(p)), '대소문자·역슬래시가 달라도')
  assert.ok(previewDirProblems(LANE_WORKTREE, { root: 'X:/elsewhere' }).some((p) => /레인 worktree/.test(p)))
  assert.ok(previewDirProblems(root, { root }).some((p) => /스크립트가 있는/.test(p)))
  const tmp = mkdtempSync(join(tmpdir(), 'scene-board-prev-'))
  try {
    mkdirSync(join(tmp, 'main', '.git'), { recursive: true })
    mkdirSync(join(tmp, 'main', 'registry', 'factory', 'recipes'), { recursive: true })
    assert.ok(previewDirProblems(join(tmp, 'main'), { root }).some((p) => /기본 작업 폴더|\.git 이 폴더/.test(p)), '.git 이 폴더면 기본 체크아웃')
    mkdirSync(join(tmp, 'plain', 'registry', 'factory', 'recipes'), { recursive: true })
    assert.ok(previewDirProblems(join(tmp, 'plain'), { root }).some((p) => /worktree/.test(p)))
    mkdirSync(join(tmp, 'wt', 'registry', 'factory', 'recipes'), { recursive: true })
    writeFileSync(join(tmp, 'wt', '.git'), 'gitdir: /somewhere/.git/worktrees/wt\n')
    assert.deepEqual(previewDirProblems(join(tmp, 'wt'), { root }), [])
    assert.ok(previewDirProblems(join(tmp, 'absent'), { root }).length > 0)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('draft-preview: the CLI exits non-zero with a Korean reason for the base checkout and the lane worktree, and leaves their files alone', async () => {
  await load('draft-preview.mjs')
  // r12~r16 은 보드 A2 판정(2026-10-11)으로 확정돼 절이 없다 — 아직 초안인 r11-nocturne 이 「건드리지 않았다」의 표본이고, r12 도 글자 그대로여야 한다.
  const recipePath = (id) => join(HERE, '..', '..', '..', 'registry', 'factory', 'recipes', id, 'DESIGN.md')
  const before = readFileSync(recipePath('r12-spectrum'), 'utf8')
  const draftBefore = readFileSync(recipePath('r11-nocturne'), 'utf8')
  for (const dir of ['<sitebrew checkout>', '<worktree>', join(HERE, '..', '..', '..')]) {
    const r = spawnSync(process.execPath, [join(HERE, 'draft-preview.mjs'), dir], { encoding: 'utf8' })
    assert.notEqual(r.status, 0, dir)
    assert.match(r.stderr, /거절/, dir)
  }
  assert.equal(readFileSync(recipePath('r12-spectrum'), 'utf8'), before)
  assert.equal(readFileSync(recipePath('r11-nocturne'), 'utf8'), draftBefore)
  assert.equal(isUnconfirmed(draftBefore), true, 'r11-nocturne 은 아직 확인 전 초안이다')
  assert.equal(isUnconfirmed(before), false, 'r12-spectrum 은 확정됐다')
})

test('draft-preview: on an allowed folder it strips only the draft sections inside that folder, then runs gen:all and qa:recipes there — no git command, nothing outside', async () => {
  const { previewDrafts } = await load('draft-preview.mjs')
  const tmp = mkdtempSync(join(tmpdir(), 'scene-board-prev-'))
  const wt = join(tmp, 'wt')
  try {
    for (const id of ['r12-spectrum', 'r13-folio', 'r11-nocturne', 'r1-measure']) {
      mkdirSync(join(wt, 'registry', 'factory', 'recipes', id), { recursive: true })
      writeFileSync(join(wt, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), id === 'r1-measure' ? '## 분위기\n\n가\n' : DRAFT)
    }
    writeFileSync(join(wt, '.git'), 'gitdir: /x/.git/worktrees/wt\n')
    const calls = []
    const res = await previewDrafts({ dir: wt, root: join(HERE, '..', '..', '..'), run: (cmd, args, opts) => { calls.push({ cmd, args, cwd: opts.cwd }); return { status: 0 } } })
    assert.deepEqual(res.stripped, ['r12-spectrum', 'r13-folio'], 'r12~r16 범위의 초안만')
    assert.equal(isUnconfirmed(readFileSync(join(wt, 'registry', 'factory', 'recipes', 'r12-spectrum', 'DESIGN.md'), 'utf8')), false)
    assert.equal(isUnconfirmed(readFileSync(join(wt, 'registry', 'factory', 'recipes', 'r11-nocturne', 'DESIGN.md'), 'utf8')), true, 'r11 은 범위 밖')
    assert.deepEqual(calls.map((c) => c.args.join(' ')), ['run gen:all', 'run qa:recipes'])
    assert.ok(calls.every((c) => c.cwd === wt))
    assert.ok(!calls.some((c) => /git|commit/.test(`${c.cmd} ${c.args.join(' ')}`)))
    assert.equal(res.ok, true)
    // 한쪽이 실패해도 둘 다 돌고 ok 는 false.
    const calls2 = []
    for (const id of ['r14-concrete']) { mkdirSync(join(wt, 'registry', 'factory', 'recipes', id), { recursive: true }); writeFileSync(join(wt, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), DRAFT) }
    const bad = await previewDrafts({ dir: wt, root: join(HERE, '..', '..', '..'), run: (cmd, args) => { calls2.push(args.join(' ')); return { status: args[1] === 'gen:all' ? 1 : 0 } } })
    assert.deepEqual(calls2, ['run gen:all', 'run qa:recipes'])
    assert.equal(bad.ok, false)
    // 거절된 폴더에서는 아무것도 부르지 않는다.
    const none = []
    await assert.rejects(previewDrafts({ dir: '<sitebrew checkout>', root: 'X:/e', run: (c, a) => { none.push(a); return { status: 0 } } }), /거절/)
    assert.deepEqual(none, [])
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('package.json and docs/agents/agent-guide.md carry the board A2 entries (one npm line, one sentence); heavy list names the Chrome test', async () => {
  const root = join(HERE, '..', '..', '..')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.match(pkg.scripts['board:scenes'], /scene-board\/jobs\.mjs.*scene-board\/capture\.mjs.*scene-board\/build\.mjs/)
  assert.match(readFileSync(join(root, 'docs/agents/agent-guide.md'), 'utf8'), /보드 A2/)
  assert.match(readFileSync(join(root, 'ci', 'tests-heavy.txt'), 'utf8'), /factory\/board\/scene-board\/board\.behavior\.test\.mjs/)
})

test('build: a later round shows only the picked scenes, says which round it is, and keeps the same save collection', async () => {
  const { sceneJobs } = await load('jobs.mjs')
  const b = await load('build.mjs')
  const jobs = sceneJobs()
  const data = b.sceneBoardData(jobs, fakeManifest(jobs))
  const pick = [jobs[jobs.length - 1].id, jobs[0].id]
  const picked = b.pickScenes(data, pick)
  assert.deepEqual(picked.map((d) => d.id), data.filter((d) => pick.includes(d.id)).map((d) => d.id), '보드 순서를 지킨다')
  assert.throws(() => b.pickScenes(data, ['block-nope']), /block-nope/)
  assert.deepEqual(b.pickScenes(data, null), data, '고르지 않으면 전부')
  const html = noScript(b.buildSceneBoard(picked, { round: 2 }))
  assert.match(html, /<title>장면 보드 A2 · 2차<\/title>/)
  assert.match(html, /<h1>장면 보드 A2 · 2차<\/h1>/)
  assert.match(html, /1차 판정 뒤 바뀐 장면/)
  assert.equal((html.match(/data-like="like"/g) ?? []).length, 2)
  assert.match(b.buildSceneBoard(picked, { round: 2 }), /const COLLECTION = "scenes"/)
  assert.doesNotMatch(noScript(b.buildSceneBoard(data)), /2차/, '1차 보드 문구는 그대로')
})
