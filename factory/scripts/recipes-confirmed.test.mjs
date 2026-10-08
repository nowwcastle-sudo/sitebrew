// FV1 레인 DRAFTS — 보드 A2(2026-10-11)에서 운영자가 모두 「좋다」로 고른 레시피 r12~r16 의 확정.
// 확정 = 「## 운영자 확인 전」 절이 없고 recipeIds()(gen:all·갤러리·프리셋·차이 검사)에 들어간다. 라이브러리가 10 → 15 벌이 되어도
// 쌍 차이·서체 고유·히어로 고유 검사가 위반 0이어야 하고(히어로는 묶음 전체에서 한 번씩만), 히어로는 레시피 원형과 맞는 블록이어야 한다.
// 이전 시험(recipes-draft.test.mjs, Task 5.15)의 초안 단계 검사(lint·B안·유행 스타일 표)는 그대로 이어받는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as recipe from './recipe.mjs'
import { distinctProblems, typeProblems, heroProblems, loadRecipeHeads } from './recipes-distinct.mjs'
import { ratio } from './lib/contrast-lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIRMED = ['r12-spectrum', 'r13-folio', 'r14-concrete', 'r15-atelier', 'r16-tonal']
const LOGIC = { 'r12-spectrum': 'K2', 'r13-folio': 'K3', 'r14-concrete': 'K4', 'r15-atelier': 'K5', 'r16-tonal': 'K9' }
const source = (id) => readFileSync(join(ROOT, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8')
const heads = () => loadRecipeHeads()
const headOf = (id) => heads().find((h) => h.id === id)

test('r12~r16 은 확정됐다: 「운영자 확인 전」 절이 없고 recipeIds 에 들어가며 초안 목록에는 없다', () => {
  const ids = recipe.recipeIds()
  const drafts = recipe.listRecipeDrafts().map((d) => d.id)
  for (const id of CONFIRMED) {
    assert.ok(!/^##[ \t]+운영자 확인 전/m.test(source(id)), `${id}: 절이 남았다`)
    assert.ok(!recipe.isUnconfirmed(source(id)), `${id}: isUnconfirmed`)
    assert.ok(ids.includes(id), `${id}: recipeIds 에 없다`)
    assert.ok(!drafts.includes(id), `${id}: 아직 초안 목록에 있다`)
    assert.equal(headOf(id).colorLogic, LOGIC[id], id)
  }
  // 이번 판정 범위 밖인 r11-nocturne 은 그대로 초안이다.
  assert.deepEqual(drafts, ['r11-nocturne'])
  assert.equal(ids.length, 15, `라이브러리 = r1~r10 + r12~r16: ${ids.join()}`)
})

test('확정 5벌은 lint 를 통과하고(A·B 모두) 대표 장면·역동 기법·히어로를 갖는다', () => {
  for (const id of CONFIRMED) {
    const h = headOf(id)
    assert.ok(!h.problem, `${id}: ${h.problem}`)
    const full = recipe.parseRecipe(source(id)) // 본문 절 검사까지 하려면 본문이 든 머리
    const { violations } = recipe.lintRecipeReport(full)
    assert.deepEqual(violations, [], `${id}: ${violations.join(' | ')}`)
    assert.ok(h.alternates, `${id} alternates 없음`)
    const B = recipe.lintRecipeReport(recipe.applyAlternate(full), { headOnly: true }).violations
    assert.deepEqual(B, [], `${id} B안: ${B.join(' | ')}`)
    assert.ok(Array.isArray(h.signature) && h.signature[0] === 'hero', `${id} signature`)
    assert.ok(h.dynamics.length >= 1 && h.hero, `${id} dynamics/hero`)
  }
})

test('라이브러리 15벌: 쌍 차이·대담한 얼굴 면 색·서체 고유·히어로 고유가 위반 0 (히어로는 묶음 전체 A·B 에서 한 번씩만)', () => {
  const all = heads()
  assert.equal(all.length, 15)
  assert.deepEqual(distinctProblems(all), [])
  assert.deepEqual(typeProblems(all).violations, [])
  assert.deepEqual(heroProblems(all), [])
})

test('확정 5벌의 히어로는 카탈로그 id 이고 레시피 원형과 맞는 블록이다(블록 메타 archetypes ∩ 레시피 archetypes)', () => {
  const seen = new Map()
  for (const id of CONFIRMED) {
    const h = headOf(id)
    assert.ok(recipe.HERO_IDS.includes(h.hero), `${id}: 카탈로그에 없는 히어로 ${h.hero}`)
    const metaFile = join(ROOT, 'registry', 'factory', 'blocks', 'hero', `${h.hero}.block.json`)
    assert.ok(existsSync(metaFile), `${id}: 히어로 블록 ${h.hero} 없음`)
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'))
    assert.ok(meta.archetypes.some((a) => h.archetypes.includes(a)), `${id}: 히어로 ${h.hero}(${meta.archetypes}) 가 레시피 원형 ${h.archetypes} 와 안 맞는다`)
    assert.ok(existsSync(join(ROOT, 'app', 'qa', 'recipes', 'heroes', `${h.hero}.tsx`)), `${id}: 검수대 틀 heroes/${h.hero}.tsx 없음`)
    assert.ok(!seen.has(h.hero), `${id}: 히어로 ${h.hero} 를 ${seen.get(h.hero)} 도 쓴다`)
    seen.set(h.hero, id)
  }
})

test('확정 5벌의 히어로는 보드 A2 에서 겹친다고 짚은 셋을 쓰지 않는다', () => {
  assert.notEqual(headOf('r14-concrete').hero, 'grid-lines-baseline-word')
  assert.notEqual(headOf('r15-atelier').hero, 'vertical-title-slides')
  assert.notEqual(headOf('r16-tonal').hero, 'narrow-title-wide-window')
  // 같은 까닭으로 r12·r13 도 라이브러리 B안(r1·r2)의 히어로와 달라야 한다 — 위 묶음 검사가 이미 잡는다.
  assert.notEqual(headOf('r12-spectrum').hero, 'baseline-split')
  assert.notEqual(headOf('r13-folio').hero, 'inline-chip-title')
})

// 보드 A2 에서 r14 의 첫 화면 글이 읽기 어려웠다(사진 위 검은 큰 제목·작은 안내). 새 히어로는 글을 바탕 위에 두므로 남는 것은 주 버튼 글자다 —
// 히어로 글자 대비 관문(board:gates · hero-contrast)은 본문 크기 글자에 7:1 을 요구하고 버튼 글자도 센다. 주색 위 글자(primary-foreground/primary)가 A·B 라이트에서 7:1 을 넘는지 본다.
test('확정 5벌: 라이트 A·B 주색 위 글자(primary-foreground/primary)가 본문 7:1 이상이다(히어로 주 버튼이 관문을 통과한다)', () => {
  for (const id of CONFIRMED) {
    const full = recipe.parseRecipe(source(id))
    for (const [label, head] of [['A', full], ['B', recipe.applyAlternate(full)]]) {
      const c = head.color.light
      const r = ratio(c['primary-foreground'], c.primary)
      assert.ok(r >= 7, `${id} ${label}: primary-foreground/primary ${r.toFixed(2)} < 7`)
    }
  }
})

test('유행 스타일 표와 승격 규칙 한 줄이 있다', () => {
  // (public export: the trend-style table is a maintainers' research record and is not shipped, so only the promotion rule is checked)
  const rules = readFileSync(join(ROOT, 'docs', 'rules', 'factory-rules.md'), 'utf8')
  assert.match(rules, /유행 스타일 승격[^\n]*3곳/)
})
