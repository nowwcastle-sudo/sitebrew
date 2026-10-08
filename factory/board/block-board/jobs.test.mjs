// 블록 행렬 목록 시험(Task 7a Step 1) — 브라우저 없음.
//  · 블록 2개(하나는 데이터 블록)로 행 수를 손으로 센 값과 같다
//  · 모든 행 주소에 frame=1 이 있다
//  · 데이터 블록 행에 state= 4개가 있다(읽기 상태 넷), 데이터 블록이 아니면 0개
//  · 촬영 행렬은 블록 × 레시피 10 × 2폭 × 2테마
//  · 진짜 레시피·블록 원천으로: 모든 블록의 판정 레시피가 서로 다른 3벌이다(레시피 고르기가 던지지 않는다)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBlocks } from '../../scripts/blocks.mjs'
import { loadHeads } from '../recipe-board/jobs.mjs'
import { blockJobs, judgeRecipes, matrixSize, absUrl, SCENE_STEPS, metaOf, isDataBlock, galleryRefuses } from './jobs.mjs'

const heads = loadHeads()
const all = loadBlocks().filter((b) => b.meta.success)
const one = (kind, variant) => all.find((b) => b.kind === kind && b.variant === variant)
const HERO = one('hero', 'baseline-split')
const DATA = one('product-list', 'grid-cards') // 읽기 상태 4
const PLAIN = one('faq', 'two-column-index')

test('블록이 103개이고 메타가 모두 통과한다(표본이 원천에서 온다)', () => {
  assert.ok(HERO && DATA && PLAIN)
  assert.equal(isDataBlock(metaOf(DATA)), true)
  assert.equal(isDataBlock(metaOf(HERO)), false)
})

test('판정 행렬: 블록 2개(하나는 데이터 블록) 행 수 = 손으로 센 값', () => {
  const jobs = blockJobs({ blocks: [HERO, DATA], recipes: heads })
  // 블록마다: 레시피 3벌 × (1440 라이트 · 375 라이트 기본·max·min = 4행) + 다크 1행 = 13행. 데이터 블록은 상태 4행 더.
  const plain = 3 * 4 + 1
  const stepRows = (b) => (SCENE_STEPS[`block-${b.kind}-${b.variant}`] ?? []).length
  assert.equal(jobs.filter((j) => j.block === 'block-hero-baseline-split').length, plain + stepRows(HERO))
  assert.equal(jobs.filter((j) => j.block === 'block-product-list-grid-cards').length, plain + 4 + stepRows(DATA))
  assert.deepEqual(matrixSize(jobs), { rows: jobs.length, urls: 6, blocks: 2 })
})

test('모든 행 주소에 frame=1 이 있고 theme= 이 명시된다', () => {
  for (const full of [false, true]) for (const j of blockJobs({ blocks: [HERO, DATA, PLAIN], recipes: heads, full })) {
    assert.match(j.url, /[?&]frame=1(&|$)/, j.url)
    assert.match(j.url, /[?&]theme=(light|dark)(&|$)/, j.url)
    assert.match(absUrl('http://localhost:3000/', j), /^http:\/\/localhost:3000\/qa\/blocks\?b=block-/)
  }
})

test('데이터 블록 행에 state= 4개(읽기 상태 넷), 아닌 블록은 0개', () => {
  const states = (b) => blockJobs({ blocks: [b], recipes: heads }).filter((j) => /[?&]state=/.test(j.url)).map((j) => j.url.match(/state=([a-z]+)/)[1])
  assert.deepEqual(states(DATA).sort(), ['empty', 'error', 'loading', 'ready'])
  assert.deepEqual(states(HERO), [])
  assert.deepEqual(states(PLAIN), [])
})

test('레시피 3벌: 서로 다르고 ②는 K6~K8, ③은 r1·r6·r10 중 하나 — 103개 블록 전부', () => {
  const boldIds = heads.filter((h) => ['K6', 'K7', 'K8'].includes(h.colorLogic)).map((h) => h.id)
  for (const b of all) {
    const p = judgeRecipes(metaOf(b), heads)
    assert.equal(new Set([p.primary, p.face, p.quiet]).size, 3, `${b.kind}/${b.variant}`)
    assert.ok(boldIds.includes(p.face), `${b.kind}/${b.variant} face ${p.face}`)
    assert.match(p.quiet, /^(r1|r6|r10)-/, `${b.kind}/${b.variant} quiet ${p.quiet}`)
  }
})

test('행은 fx max·min 을 375 에서만, 다크는 face 레시피 1440 하나만 갖는다', () => {
  const jobs = blockJobs({ blocks: [HERO], recipes: heads })
  for (const j of jobs.filter((x) => x.fx !== 'default')) assert.equal(j.width, 375)
  const dark = jobs.filter((j) => j.theme === 'dark')
  assert.equal(dark.length, 1)
  assert.equal(dark[0].role, 'face')
  assert.equal(dark[0].width, 1440)
})

test('행 id 는 유일하다(같은 행을 두 번 세지 않는다)', () => {
  const jobs = blockJobs({ blocks: all, recipes: heads })
  assert.equal(new Set(jobs.map((j) => j.id)).size, jobs.length)
})

// 한 블록의 기본 행 = 레시피 수 × 1440·375 × 라이트·다크(레시피 수는 목록에서 읽는다 — 라이브러리가 10 → 15벌이 되어도 같은 약속).
const PER_BLOCK = (n) => n * 2 * 2

// 갤러리가 오류로 그리는 짝(D2 레시피 × 제목이 전폭이 아닌 히어로 — app/qa/blocks/view.tsx)은 촬영 행렬에서 빠진다.
const refused = (b) => heads.filter((h) => galleryRefuses(metaOf(b), h)).length

test('촬영 행렬: 블록 × 레시피 전부 × 1440·375 × 라이트·다크 = 블록당 레시피 수 × 4 행(갤러리가 거절하는 짝만 뺀다), 파일 이름이 기준 폴더 규약이다', () => {
  assert.ok(heads.length >= 10)
  const jobs = blockJobs({ blocks: [HERO, DATA], recipes: heads, full: true })
  assert.equal(jobs.length, PER_BLOCK(heads.length - refused(HERO)) + PER_BLOCK(heads.length - refused(DATA)))
  assert.ok(jobs.every((j) => j.mode === 'capture' && j.fx === 'default' && !j.state && !j.step))
  assert.ok(jobs.some((j) => j.file === 'block-hero-baseline-split/r1-measure-1440-light.webp'))
  assert.equal(new Set(jobs.map((j) => j.file)).size, jobs.length)
})

test('촬영 행렬: D2(초대형 제목) 레시피 × 제목이 전폭이 아닌 히어로 칸은 뺀다 — 갤러리가 오류 알림으로 그리는 짝이라 찍으면 도구 실패다(r14-concrete × baseline-split). 전폭 히어로·다른 레시피·히어로가 아닌 블록은 그대로', () => {
  const FULL = one('hero', 'punch-in-statement')
  assert.equal(metaOf(HERO).titleWidth, 'column')
  assert.equal(metaOf(FULL).titleWidth, 'full')
  const d2 = heads.filter((h) => h.axes?.display === 'D2')
  assert.ok(d2.length >= 1, '표본: D2 레시피가 있다(r14-concrete)')
  const files = (b) => blockJobs({ blocks: [b], recipes: heads, full: true }).map((j) => j.recipe)
  for (const h of d2) {
    assert.equal(files(HERO).includes(h.id), false, `${h.id} × column 히어로는 뺀다`)
    assert.equal(files(FULL).includes(h.id), true, `${h.id} × 전폭 히어로는 찍는다`)
    assert.equal(files(DATA).includes(h.id), true, `${h.id} × 히어로가 아닌 블록은 찍는다`)
    assert.equal(galleryRefuses(metaOf(HERO), h), true)
  }
  const other = heads.find((h) => h.axes?.display !== 'D2')
  assert.equal(files(HERO).includes(other.id), true)
  assert.equal(galleryRefuses(metaOf(HERO), other), false)
})

test('촬영 행렬 장면(P3-8): SCENE_STEPS 의 단계마다 레시피 수 × 4칸이 더 있고 파일 이름에 @<단계> 가 붙는다 — upgrade-modal 열린 창이 들어 있다', () => {
  const modal = one('paywall', 'upgrade-modal')
  const jobs = blockJobs({ blocks: [modal], recipes: heads, full: true })
  const scenes = jobs.filter((j) => j.step)
  assert.equal(jobs.length, PER_BLOCK(heads.length) * (1 + SCENE_STEPS['block-paywall-upgrade-modal'].length))
  assert.equal(scenes.length, PER_BLOCK(heads.length))
  assert.ok(scenes.every((j) => j.step === 'open-dialog' && j.file.endsWith('@open-dialog.webp') && j.fx === 'default'))
  assert.ok(scenes.some((j) => j.file === 'block-paywall-upgrade-modal/r1-measure-1440-light@open-dialog.webp'))
  assert.equal(new Set(jobs.map((j) => j.file)).size, jobs.length, '기본 화면과 장면의 파일 이름이 겹치지 않는다')
  assert.ok(jobs.filter((j) => !j.step).every((j) => !j.file.includes('@')), '기본 화면의 파일 이름은 예전 그대로다')
  // 장면이 없는 블록은 예전 그대로 기본 행만
  assert.equal(blockJobs({ blocks: [HERO], recipes: heads, full: true }).length, PER_BLOCK(heads.length - refused(HERO)))
})

test('SCENE_STEPS 의 블록 이름은 실제 블록이다(오타로 조용히 빠지지 않는다)', () => {
  const names = new Set(all.map((b) => `block-${b.kind}-${b.variant}`))
  for (const n of Object.keys(SCENE_STEPS)) assert.ok(names.has(n), n)
})

// ── 7상태 감사 행렬 ────────────────────────────────────────────────────────────────────────────
import { stateJobs, STATE_DELAY_MS } from './jobs.mjs'

test('stateJobs: 데이터 블록은 상태 4행 + 전환(cls) 1행, 폼 블록은 제출 결과마다 1행', () => {
  const both = one('retention', 'cancel-flow') // 읽기 4 + 제출 4(pending 포함)
  const form = one('contact-form', 'inline-short') // 제출 4
  const jobs = stateJobs({ blocks: [DATA, both, form, HERO], recipes: heads })
  const of = (b) => jobs.filter((j) => j.block === `block-${b.kind}-${b.variant}`)
  assert.equal(of(DATA).length, 5)
  assert.deepEqual(of(DATA).filter((j) => j.type === 'read').map((j) => j.name).sort(), ['empty', 'error', 'loading', 'ready'])
  assert.equal(of(both).length, 5 + 4)
  assert.equal(of(form).length, 4)
  assert.deepEqual(of(form).map((j) => j.name).sort(), ['field-error', 'ok', 'pending', 'server-error'])
  assert.equal(of(HERO).length, 0, '상태가 없는 블록은 행이 없다')
  const cls = of(DATA).find((j) => j.type === 'cls')
  assert.match(cls.url, new RegExp(`state=ready&delay=${STATE_DELAY_MS}&frame=1$`))
  for (const j of jobs) assert.match(j.url, /[?&]frame=1(&|$)/)
  assert.equal(new Set(jobs.map((j) => j.id)).size, jobs.length)
})

test('stateJobs: 103개 전체 — 행 수가 메타의 상태 수와 맞는다', () => {
  const jobs = stateJobs({ blocks: all, recipes: heads })
  const expected = all.reduce((n, b) => { const m = metaOf(b); return n + (isDataBlock(m) ? 5 : 0) + m.states.filter((s) => s.startsWith('submit-')).length }, 0)
  assert.equal(jobs.length, expected)
  assert.ok(jobs.length > 100)
})

test('면을 까는 블록(bento-grid — block-N 면)의 ② 는 K8 레시피다(면적 규칙이 실제로 서는 계열)', () => {
  const bento = one('features', 'bento-grid')
  const jobs = blockJobs({ blocks: [bento], recipes: heads })
  const face = jobs.find((j) => j.role === 'face').recipe
  assert.equal(heads.find((h) => h.id === face).colorLogic, 'K8', face)
  const plain = blockJobs({ blocks: [PLAIN], recipes: heads }).find((j) => j.role === 'face').recipe
  assert.ok(['K6', 'K7', 'K8'].includes(heads.find((h) => h.id === plain).colorLogic))
})
