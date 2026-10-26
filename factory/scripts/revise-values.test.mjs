// 값이 든 수정 요청(FIT-2) — 「색을 초록색으로」·「서체를 명조로」를 지킨다.
//   · 읽기: 사전이 색 이름·서체 범주를 value 읽기로 낸다(parseRevision → scope design). #hex·서체 이름 낱말은 옛 낱말 표와 함께 사라졌다
//   · 안 계획(planAxisValue): brandToRecipeHead 로 만든 안 — 주색이 요청 색과 같은 색조·대비 4.5:1 이상 · 맞출 수 없으면 질문 · 서체는 그 범주에서 한글을 그리는 키트 서체 상위 둘
//   · 통합(revise → applyRevision, 06 은 install:false): 판(version 2)에 읽기가 남고, 컴파일된 임시 레시피의 --primary 가 그 색조다
//   · 골든(REVISE_VALUES_GOLDEN=1, 잠금 안): 진짜 06(shadcn add)을 다시 찍은 사이트 CSS 의 --primary
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { askIn, grammar } from '../vocab/grammar.mjs'
import { applyRevision, parseRevision, revise } from '../stamp/revise.mjs'
import { EXIT, runReviseCommand } from '../stamp/stamp.mjs'
import { KIT_CATEGORY, TYPE_CATEGORIES, koreanKitFonts, planAxisValue, primaryHexOf } from '../stamp/revise-values.mjs'
import { lintRecipeReport, isKorean } from './recipe.mjs'
import { loadLibrary } from './style-presets.mjs'
import { ratio } from './lib/contrast-lib.mjs'
import { hexToOklch, hueDist } from './lib/palette-lib.mjs'
import { parseOklch } from './lib/palette-rules.mjs'
import { fixtureCand, fixtureRun, fixtureSite } from './lib/revise-fixtures.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const TMP = join(root, '.tmp', 'revise-values-test')
mkdirSync(TMP, { recursive: true })
let dir
beforeEach(() => { dir = mkdtempSync(join(TMP, 't-')); process.env.CLAUDE_PLUGIN_DATA = join(dir, 'plugin-data') })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const site = fixtureSite()
const library = loadLibrary()
const headOf = (id) => structuredClone(library.find((r) => r.id === id))
const base = headOf(fixtureCand().recipe)
// 안 계획(planAxisValue)의 입력 — 값 읽기는 사전이 맡으므로 시험은 읽은 값을 직접 적는다
const green = { hex: '#2E7D32', from: 'name', name: 'green' }
const white = { hex: '#FFFFFF', from: 'name', name: 'white' }
const ASKED = {
  '메인 색을 #0B6E4F 로': { target: 'color', value: { hex: '#0B6E4F', from: 'hex' } },
  '색을 초록색으로 바꿔줘': { target: 'color', value: green },
  'change the color to green': { target: 'color', value: green },
  '색을 노랑으로 바꿔줘': { target: 'color', value: { hex: '#F2C200', from: 'name', name: 'yellow' } },
  '메인 색을 흰색으로': { target: 'color', value: white },
  'make the main color white': { target: 'color', value: white },
  '색을 베이지로': { target: 'color', value: { hex: '#D8C3A5', from: 'name', name: 'beige' } },
  '서체를 명조로 바꿔줘': { target: 'type', value: { category: 'serif' } },
  '서체를 손글씨로': { target: 'type', value: { category: 'handwriting' } },
  '서체를 Noto Serif KR 로': { target: 'type', value: { family: 'Noto Serif KR' } },
  'use the Sora font': { target: 'type', value: { family: 'Sora' } },
}
const T = (text) => ({ ...ASKED[text], text })
const lch = (hex) => hexToOklch(hex.slice(1))
const themeBg = (head, theme) => head.color[theme].background
const contrast = (head, theme) => ratio(head.color[theme].primary, themeBg(head, theme))
const hueOf = (v) => parseOklch(v)[2]

// ── 읽기 ────────────────────────────────────────────────────────────────────

test('값 읽기: 색 이름·서체 범주는 사전이, 색 코드(#hex)·서체 이름은 문장에서 직접 읽어 value 읽기로 낸다', () => {
  const lead = (text) => { const c = parseRevision(text, site).classification; return c.result === 'confirmed' ? [c.readings[0].axis, c.readings[0].value] : c.result }
  assert.deepEqual(lead('색을 초록색으로 바꿔줘'), ['color-hue', 'green'])
  assert.deepEqual(lead('change the color to green'), ['color-hue', 'green'])
  assert.deepEqual(lead('서체를 명조로 바꿔줘'), ['type-family', 'serif'])
  assert.deepEqual(lead('폰트를 산세리프로'), ['type-family', 'sans'], '산세리프는 세리프가 아니다')
  // 색 코드 — 브리프 문장 + 영어 짝, 소문자·조사 붙임·#rgb 는 #RRGGBB 로 편다
  for (const text of ['메인 색을 #0B6E4F 로', '색을 #0b6e4f로 바꿔줘', '#0B6E4F 로', 'make the color #0B6E4F', 'make the main color #0B6E4F']) assert.deepEqual(lead(text), ['color-hue', '#0B6E4F'], text)
  assert.deepEqual(lead('색을 #0a5 로'), ['color-hue', '#00AA55'])
  assert.deepEqual(lead('메인 색을 #9B6D00 로'), ['color-hue', '#9B6D00'], '맞출 수 없는 색에 제안한 코드는 다음 말로 바로 읽힌다')
  // 서체 이름 — 키트 서체는 대소문자 없이, 더 긴 이름 안의 이름은 뺀다
  assert.deepEqual(lead('서체를 Noto Serif KR 로'), ['type-family', 'Noto Serif KR'])
  assert.deepEqual(lead('폰트를 Pretendard 로'), ['type-family', 'Pretendard'])
  assert.deepEqual(lead('use the Sora font'), ['type-family', 'Sora'])
  const r = parseRevision('메인 색을 #0B6E4F 로', site)
  assert.deepEqual([r.scope, r.text, r.classification.readings[0].scope, r.classification.readings[0].strength], ['design', '메인 색을 #0B6E4F 로', 'site', 1])
  assert.match(r.classification.say, /색.*#0B6E4F/)
  // 값이 둘이면 직접 읽지 않는다 — 사전 분류가 되묻는다
  assert.notEqual(lead('색을 #0B6E4F 나 #C62828 로'), 'confirmed')
})

test('값 읽기: 주색이 아닌 자리(배경·글자 색)를 말한 색 값은 주색만 바꿀까요 하고 되묻는다 — 옛 OTHER_ROLE 과 같다', () => {
  const asks = (text) => parseRevision(text, site).ask
  for (const text of ['배경색을 초록으로', '배경색을 #112233 으로', 'make the background green', '글자 색을 빨강으로', '테두리를 파랑으로']) assert.equal(asks(text), askIn(grammar.text.ask.otherRole, text), text)
  assert.equal(parseRevision('색을 초록색으로 바꿔줘', site).scope, 'design', '배경 낱말이 없으면 그대로')
  assert.equal(parseRevision('배경을 더 어둡게', site).scope, 'design', '색 값이 아닌 읽기는 걸리지 않는다')
})


// ── 색 안 ────────────────────────────────────────────────────────────────────

test('색 안: 주색이 요청 색과 같은 색조(2° 이내)이고 대비 4.5:1 이상 — 두 안, 둘 다 린트 통과', () => {
  const hex = '#0B6E4F'
  const plan = planAxisValue(base, T('메인 색을 #0B6E4F 로'))
  assert.equal(plan.ask, undefined)
  assert.equal(plan.heads.length, 2)
  const want = lch(hex)
  for (const h of plan.heads) {
    for (const theme of ['light', 'dark']) assert.ok(contrast(h.head, theme) >= 4.5, `${h.label} ${theme} 대비 ${contrast(h.head, theme)}`)
    const p = parseOklch(h.head.color[h.head.defaultTheme === 'dark' ? 'dark' : 'light'].primary)
    assert.ok(hueDist(p[2], want[2]) <= 3, `${h.label} 색조 차 ${hueDist(p[2], want[2])}°`)
    assert.deepEqual(lintRecipeReport(h.head).violations, [], h.label)
    assert.equal(h.head.alternates, undefined, 'B안 덮어쓰기는 새 색과 섞이지 않게 뺀다')
    assert.equal(h.head.fonts.display.item, base.fonts.display.item, '색만 바뀐다 — 서체는 그대로')
    assert.equal(h.head.hero, base.hero)
  }
  // (a) 요청 색 그대로(라이트 기본 레시피에서 이 색은 이미 4.5:1) · (b) 같은 색조의 다른 명도
  assert.equal(primaryHexOf(plan.heads[0].head), hex, '(a) 주색 = 요청 색(명도 조정이 필요 없으면 그대로)')
  assert.notEqual(primaryHexOf(plan.heads[1].head), primaryHexOf(plan.heads[0].head))
  assert.ok(Math.abs(lch(primaryHexOf(plan.heads[1].head))[0] - lch(primaryHexOf(plan.heads[0].head))[0]) >= 0.05, '(b) 명도가 눈에 띄게 다르다')
  assert.ok(plan.notes.every((n) => !/읽었어요/.test(n)), '#hex 는 읽은 게 아니라 준 값이라 「읽었어요」 안내가 없다')
  assert.ok(plan.notes.some((n) => /명도만 조정/.test(n) && /dark #/.test(n)), `다크 테마 주색은 대비 때문에 명도만 조정되고 그 값이 안내에 남는다: ${plan.notes.join(' | ')}`)
})

test('색 안: 이름은 해석이라 안내를 단다 — 「초록 → #2E7D32 로 읽었어요. 정확한 색 코드가 있으면 알려 주세요」', () => {
  const plan = planAxisValue(base, T('색을 초록색으로 바꿔줘'))
  assert.equal(plan.heads.length, 2)
  assert.equal(plan.notes[0], '초록 → #2E7D32 로 읽었어요. 정확한 색 코드가 있으면 알려 주세요.')
  assert.deepEqual(plan.heads[0].detail.read, { name: '초록', hex: '#2E7D32' })
  const en = planAxisValue(base, T('change the color to green'))
  assert.match(en.notes[0], /Read "green" as #2E7D32/)
})

test('색 안: 맞출 수 없으면 아무것도 바꾸지 않고 묻는다 — 노랑·흰색·베이지(밝아서 글자 대비 4.5:1 불가)', () => {
  for (const text of ['색을 노랑으로 바꿔줘', '메인 색을 흰색으로', '색을 베이지로']) {
    const plan = planAxisValue(base, T(text))
    assert.equal(plan.heads, undefined, text)
    assert.match(plan.ask, /비슷한 색으로 바꿀까요\?/, plan.ask)
    assert.ok(plan.reason.length > 0, '까닭(brand.mjs 가 준 이유)을 같이 돌려준다')
  }
  const y = planAxisValue(base, T('색을 노랑으로 바꿔줘'))
  assert.match(y.ask, /노랑\(#F2C200\)/, '읽은 값을 보인다')
  assert.match(y.suggestion ?? '', /^#[0-9A-F]{6}$/, '비슷한 색 제안이 있으면 다음 말로 바로 쓸 수 있는 #hex')
  const sugPlan = planAxisValue(base, { target: 'color', value: { hex: y.suggestion, from: 'hex' }, text: '메인 색을 ' + y.suggestion })
  assert.equal(sugPlan.ask, undefined, '제안한 색은 실제로 맞는다')
  assert.match(planAxisValue(base, T('make the main color white')).ask, /similar color\?/, '영어 요청에는 영어로')
  // 라이브러리 레시피 15벌 모두 — 흰색·베이지를 바탕 팔레트로 물러난 결과로 속여 「안」으로 내지 않는다(어두운 기본 레시피 포함)
  for (const r of library) for (const text of ['메인 색을 흰색으로', '색을 베이지로']) assert.ok(planAxisValue(structuredClone(r), T(text)).ask, `${r.id} ${text}`)
})

test('색 안: 색 하나로 못 짠 색 논리(K7 듀오톤)는 기본 짜임으로 바꾸고 안내한다 — 린트를 못 지키는 안은 내지 않는다', () => {
  const k7 = headOf('r2-signal')
  assert.equal(k7.colorLogic, 'K7')
  const plan = planAxisValue(k7, T('메인 색을 #0B6E4F 로'))
  assert.ok(plan.heads?.length >= 1, JSON.stringify(plan.ask ?? plan))
  for (const h of plan.heads) {
    assert.deepEqual(lintRecipeReport(h.head).violations, [])
    assert.equal(h.head.colorLogic, 'K1')
  }
  assert.ok(plan.notes.some((n) => /K7/.test(n) && /K1/.test(n)), plan.notes.join(' | '))
})

test('색 안: 다크 기본 레시피는 다크 주색 기준으로 대비·색조를 본다', () => {
  const dark = library.find((r) => r.defaultTheme === 'dark')
  assert.ok(dark, '다크 기본 레시피가 라이브러리에 있다')
  const plan = planAxisValue(structuredClone(dark), T('메인 색을 #0B6E4F 로'))
  if (plan.ask) return assert.match(plan.ask, /비슷한 색으로/, '맞출 수 없으면 질문 — 거짓 안은 없다')
  for (const h of plan.heads) {
    assert.ok(contrast(h.head, 'dark') >= 4.5)
    assert.ok(hueDist(hueOf(h.head.color.dark.primary), lch('#0B6E4F')[2]) <= 3)
  }
})

// ── 서체 안 ──────────────────────────────────────────────────────────────────

test('서체 안: 범주에서 한글을 그리는 키트 서체 상위 둘 — 제목·본문에 쓰고 린트를 통과한다', () => {
  const plan = planAxisValue(base, T('서체를 명조로 바꿔줘'))
  assert.equal(plan.ask, undefined)
  const pool = koreanKitFonts().filter((f) => f.category === 'serif' && f.item !== base.fonts.display.item && f.item !== base.fonts.body.item)
  assert.equal(plan.heads.length, 2)
  assert.deepEqual(plan.heads.map((h) => h.head.fonts.body.item), pool.slice(0, 2).map((f) => f.item), '상위 둘(tier → rank_score → 이름 순)')
  for (const h of plan.heads) {
    assert.equal(h.head.fonts.display.item, h.head.fonts.body.item)
    assert.ok(isKorean(h.head.fonts.body.family), '본문은 한글을 그린다(lint font-korean)')
    assert.equal(h.head.fonts.displayKo, undefined, '한글 제목체가 새 서체를 가리지 않는다')
    assert.deepEqual(lintRecipeReport(h.head).violations, [])
    assert.equal(h.head.color.light.primary, base.color.light.primary, '서체만 바뀐다 — 색은 그대로')
  }
  assert.match(plan.notes[0], /명조/)
  assert.match(plan.notes[0], /정확한 서체 이름이 있으면 알려 주세요/)
})

test('서체 안: 손글씨·둥근 서체는 제목만(본문은 읽기 쉬운 서체 그대로) · 서체 이름은 그 서체 하나 · 키트에 없는 서체는 묻는다', () => {
  const hand = planAxisValue(base, T('서체를 손글씨로'))
  assert.ok(hand.heads.length >= 1)
  for (const h of hand.heads) {
    assert.equal(h.head.fonts.body.item, base.fonts.body.item)
    assert.notEqual(h.head.fonts.display.item, base.fonts.display.item)
    assert.deepEqual(lintRecipeReport(h.head).violations, [])
  }
  const fam = planAxisValue(base, T('서체를 Noto Serif KR 로'))
  assert.deepEqual(fam.heads.map((h) => h.head.fonts.display.family), ['Noto Serif KR', 'Noto Serif KR'])
  assert.deepEqual(fam.heads.map((h) => h.head.fonts.body.family), ['Noto Serif KR', base.fonts.body.family], '(a) 제목·본문 (b) 제목만')
  const latin = planAxisValue(base, T('use the Sora font')) // 키트에 있는 라틴 서체 — 한글을 못 그리므로 제목만
  assert.equal(latin.heads.length, 1)
  assert.equal(latin.heads[0].head.fonts.display.family, 'Sora')
  assert.equal(latin.heads[0].head.fonts.body.item, base.fonts.body.item)
  assert.ok(latin.notes.some((n) => /한글/.test(n) || /Korean/.test(n)))
  const gone = planAxisValue(base, { target: 'type', value: { family: 'Lobster' }, text: '서체를 Lobster 로' })
  assert.match(gone.ask, /설치할 수 있는 서체가 아니에요/)
})

test('서체 범주 표: 한글을 그리는 키트 서체마다 범주가 있고(새 서체가 오면 이 시험이 알린다) 사용자 범주마다 서체가 있다', () => {
  const pool = koreanKitFonts()
  assert.ok(pool.length >= 30, `키트 한글 서체 ${pool.length}개`)
  for (const f of pool) assert.ok(f.category, `${f.item} 범주 없음 — fonts.json 에 없는 서체면 KIT_CATEGORY 에 적는다`)
  for (const c of TYPE_CATEGORIES) assert.ok(pool.some((f) => f.category === c.key), `범주 ${c.key} 에 서체가 없다`)
  for (const item of Object.keys(KIT_CATEGORY)) assert.ok(pool.some((f) => f.item === item), `KIT_CATEGORY 의 ${item} 가 키트 한글 서체가 아니다 — 표를 정리한다`)
})

// ── 통합: revise → applyRevision (06 은 install:false) ─────────────────────────

const guard = (run) => ['03-variants.json', '04-content.json', 'site/content/site.json'].map((f) => readFileSync(join(run, 'a', f), 'utf8'))
/** 안의 사본에서 컴파일된 임시 레시피의 :root --primary (라이트·다크). */
function compiledPrimary(run, v) {
  const candDir = join(run, v.siteRel, '..')
  const reg = JSON.parse(readFileSync(join(candDir, 'build', 'registry', 'factory', 'r', 'registry.json'), 'utf8'))
  const item = reg.items.find((i) => i.type === 'registry:base' && i.cssVars?.light?.primary)
  assert.ok(item, 'x-… 레시피 base 항목이 있다')
  return { light: item.cssVars.light.primary, dark: item.cssVars.dark?.primary }
}

const valueReading = (axis, value) => ({ axis, value, strength: 1, scope: 'site' })
const asValue = (axis, value) => ({ scope: 'design', input: { readings: [valueReading(axis, value)] }, text: null })

test('통합(색 이름): 읽기 「초록」 → 안, 컴파일된 --primary 가 초록 색조 · 고르면 후보 레시피 머리가 바뀌고 06·07 낡음 · 03·04 는 그대로', async () => {
  const run = fixtureRun()
  const before = guard(run)
  const out = await revise(run, 'a', asValue('color-hue', 'green'), { install: false, now: () => '2026-10-17T00:00:00.000Z' })
  assert.equal(out.status, 'ready')
  assert.ok(out.variants.length >= 1)
  assert.deepEqual(guard(run), before, '지금 사이트·03·04 는 제안만으로 바뀌지 않는다')
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.deepEqual([board.version, board.scope, board.status], [2, 'design', 'ready'])
  assert.deepEqual(board.readings, [valueReading('color-hue', 'green')])
  for (const v of out.variants) {
    assert.equal(v.diff.sameStructure, true, '구조 유지')
    const p = compiledPrimary(run, v)
    assert.ok(hueDist(hueOf(p.light), lch('#2E7D32')[2]) <= 3, `${v.id} 라이트 --primary ${p.light}`)
  }
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.deepEqual(applied.stale, ['06', '07'])
  const d01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data
  assert.equal(d01.source, 'brand')
  assert.ok(hueDist(hueOf(compiledPrimary(run, out.variants[0]).light), lch(primaryHexOf(d01.recipe))[2]) <= 3, '후보 레시피 머리의 주색 = 안의 주색')
  assert.equal(d01.recipe.fonts.display.item, base.fonts.display.item, '색만 바뀐다')
  assert.deepEqual(guard(run), before, '03·04 는 고르기 뒤에도 그대로')
})

test('통합(맞출 수 없는 색): 읽기 「노랑」 → 질문만 — 09-revise 도 안 만들고 아무것도 바꾸지 않는다', async () => {
  const run = fixtureRun()
  const before = guard(run)
  const out = await revise(run, 'a', asValue('color-hue', 'yellow'), { install: false })
  assert.match(out.ask, /비슷한 색으로 바꿀까요\?/)
  assert.equal(out.variants, undefined)
  assert.equal(existsSync(join(run, 'a', '09-revise')), false)
  assert.deepEqual(guard(run), before)
})

test('통합(서체): 읽기 「명조」 → 안, 컴파일된 임시 레시피가 한글을 그리는 명조 서체 · 고르면 머리의 서체가 바뀐다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', asValue('type-family', 'serif'), { install: false })
  assert.equal(out.status, 'ready')
  assert.ok(out.variants.length >= 1)
  assert.equal(out.variants[0].changes[0].axis, 'type-family')
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.equal(applied.scope, 'design')
  const d01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data
  const pool = koreanKitFonts().filter((f) => f.category === 'serif')
  assert.ok(pool.some((f) => f.family === d01.recipe.fonts.body.family), d01.recipe.fonts.body.family)
  assert.ok(isKorean(d01.recipe.fonts.body.family))
})

/** 안의 사본에서 컴파일된 임시 레시피의 meta.recipe (서체·색 논리 …). */
function compiledRecipe(run, v) {
  const reg = JSON.parse(readFileSync(join(run, v.siteRel, '..', 'build', 'registry', 'factory', 'r', 'registry.json'), 'utf8'))
  return reg.items.find((i) => i.type === 'registry:base' && i.meta?.recipe).meta.recipe
}

test('통합(색 코드): 「메인 색을 #0B6E4F 로」 → 안 둘(요청 색 · 같은 색조 다른 명도), 컴파일된 --primary 가 그 색조 · 고르면 후보 레시피 머리의 주색이 요청 색', async () => {
  const run = fixtureRun()
  const before = guard(run)
  const out = await revise(run, 'a', parseRevision('메인 색을 #0B6E4F 로', site), { install: false })
  assert.equal(out.status, 'ready')
  assert.equal(out.variants.length, 2, '값 읽기도 「지금 + 다른 안 2개」 — 안 b 는 planAxisValue 의 둘째 안')
  assert.deepEqual(guard(run), before)
  for (const v of out.variants) {
    assert.equal(v.diff.sameStructure, true)
    assert.ok(hueDist(hueOf(compiledPrimary(run, v).light), lch('#0B6E4F')[2]) <= 3, v.id)
  }
  assert.notEqual(compiledPrimary(run, out.variants[0]).light, compiledPrimary(run, out.variants[1]).light)
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.deepEqual(board.readings.map((r) => [r.axis, r.value]), [['color-hue', '#0B6E4F']])
  assert.equal(board.request, '메인 색을 #0B6E4F 로')
  assert.ok(out.notes.some((n) => /명도만 조정/.test(n) && /dark #/.test(n)), `다크 테마 주색 조정 안내가 판에 남는다: ${out.notes.join(' | ')}`)
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.equal(applied.scope, 'design')
  assert.equal(primaryHexOf(JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data.recipe), '#0B6E4F', '(a) 주색 = 요청 색')
  assert.deepEqual(guard(run), before, '03·04 는 그대로')
})

test('통합(색 이름): 「초록」 → 안 둘 + 판의 안내 「초록 → #2E7D32 로 읽었어요」', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('색을 초록색으로 바꿔줘', site), { install: false })
  assert.equal(out.variants.length, 2)
  assert.ok(out.notes.includes('초록 → #2E7D32 로 읽었어요. 정확한 색 코드가 있으면 알려 주세요.'), out.notes.join(' | '))
  assert.deepEqual(JSON.parse(readFileSync(out.boardFile, 'utf8')).notes, out.notes)
})

test('통합(맞출 수 없는 색): 질문에 색 이름이 남고(노랑(#F2C200)) 제안한 코드로 다시 말하면 판이 나온다 — 되묻기가 끝없이 돌지 않는다', async () => {
  const run = fixtureRun()
  const first = await revise(run, 'a', parseRevision('색을 노랑으로 바꿔줘', site), { install: false })
  assert.match(first.ask, /노랑\(#F2C200\)/)
  const suggested = /예: (#[0-9A-F]{6})/.exec(first.ask)[1]
  const second = await revise(run, 'a', parseRevision(`메인 색을 ${suggested} 로`, site), { install: false })
  assert.equal(second.status, 'ready', JSON.stringify(second.ask))
  assert.ok(second.variants.length >= 1)
})

test('통합(서체): 「명조」 → 안 둘(상위 둘 서체)과 범주 안내 · 서체 이름은 그 서체 하나(제목·본문 / 제목만)', async () => {
  const run = fixtureRun()
  const cat = await revise(run, 'a', parseRevision('서체를 명조로 바꿔줘', site), { install: false })
  assert.equal(cat.variants.length, 2)
  const pool = koreanKitFonts().filter((f) => f.category === 'serif' && f.item !== base.fonts.display.item && f.item !== base.fonts.body.item)
  assert.deepEqual(cat.variants.map((v) => compiledRecipe(run, v).fonts.body.family), pool.slice(0, 2).map((f) => f.family), '명조 상위 둘')
  assert.ok(cat.notes.some((n) => /명조/.test(n) && /정확한 서체 이름이 있으면 알려 주세요/.test(n)), cat.notes.join(' | '))
  const fam = await revise(run, 'a', parseRevision('폰트를 Noto Serif KR 로', site), { install: false })
  assert.deepEqual(fam.variants.map((v) => compiledRecipe(run, v).fonts.display.family), ['Noto Serif KR', 'Noto Serif KR'])
  assert.deepEqual(fam.variants.map((v) => compiledRecipe(run, v).fonts.body.family), ['Noto Serif KR', base.fonts.body.family], '(a) 제목·본문 (b) 제목만')
  const pretendard = await revise(run, 'a', parseRevision('폰트를 Pretendard 로', site), { install: false })
  assert.equal(pretendard.status === 'ready' ? compiledRecipe(run, pretendard.variants[0]).fonts.display.family : pretendard.ask, 'Pretendard')
})

test('명령줄 --revise-readings: 색 코드 값 읽기도 받는다(틀린 코드·모르는 서체는 종료 2)', async () => {
  const run = fixtureRun()
  const json = (value, axis = 'color-hue') => JSON.stringify({ readings: [{ axis, value, strength: 1, scope: 'site' }] })
  const bad = await runReviseCommand({ run, pick: 'a', reviseReadings: json('#12') }, { say: () => {}, revOpts: { install: false } })
  assert.equal(bad.code, EXIT.args)
  const unknownFont = await runReviseCommand({ run, pick: 'a', reviseReadings: json('NoSuchFontAnywhere', 'type-family') }, { say: () => {}, revOpts: { install: false } })
  assert.equal(unknownFont.code, EXIT.args)
  const ok = await runReviseCommand({ run, pick: 'a', reviseReadings: json('#0B6E4F') }, { say: () => {}, revOpts: { install: false } })
  assert.equal(ok.code, EXIT.waiting)
  assert.equal(ok.result.variants.length, 2)
})

test('통합(이름 있는 색): 금색·하늘색은 이름으로 읽어 「금색 → #D4B460 로 읽었어요」 안내가 판에 남는다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('금색으로 바꿔줘', site), { install: false })
  assert.equal(parseRevision('금색으로 바꿔줘', site).classification.result, 'confirmed')
  assert.equal(out.ask, undefined, out.ask)
  assert.equal(out.variants.length, 2)
  assert.ok(out.notes.some((n) => /금색 → #D4B460 로 읽었어요/.test(n)), out.notes.join(' | '))
})

test('통합(값 판 안내): 안이 하나뿐이면 까닭 한 줄(값 읽기가 준 까닭, 없으면 일반 문장)을 맨 앞에 싣고 읽은 방식 안내는 덧붙으며, 두 안은 같은 읽은 값에 서로 다른 모양을 덧붙여 해석을 단다', async () => {
  const run = fixtureRun()
  const one = await revise(run, 'a', parseRevision('메인 색을 #9B6D00 로', site), { install: false })
  assert.equal(one.variants.length, 1, '#9B6D00 은 같은 색조의 둘째 안을 못 낸다')
  const reasons = one.notes.filter((n) => /하나뿐|한 안만/.test(n))
  assert.equal(reasons.length, 1, `까닭 줄은 하나: ${one.notes.join(' | ')}`)
  assert.match(reasons[0], /한 안만 냈어요/, '값 읽기가 까닭을 줬으면 일반 문장 대신 그것')
  assert.equal(one.notes[0], reasons[0], '까닭이 첫 줄')
  assert.ok(one.notes.some((n) => /명도만 조정/.test(n)), `읽은 방식 안내는 덧붙는다: ${one.notes.join(' | ')}`)
  assert.equal(JSON.parse(readFileSync(one.boardFile, 'utf8')).why, reasons[0])
  // 값 읽기가 까닭을 주지 않는 한 안짜리 판은 일반 문장(onlyOne)이 그 줄이다
  const plain = await revise(run, 'a', { scope: 'design', text: null, input: { readings: [{ axis: 'spacing', direction: 'airy', strength: 1, scope: 'site' }] } }, { install: false })
  assert.deepEqual(plain.notes, [grammar.text.plan.onlyOne])
  const two = await revise(run, 'a', parseRevision('색을 초록색으로 바꿔줘', site), { install: false })
  assert.equal(two.variants.length, 2)
  const [a, b] = two.variants.map((v) => v.say)
  const stem = '색을 초록 쪽으로 이해했어요.'
  assert.ok(a.startsWith(stem) && b.startsWith(stem), '두 안 모두 읽은 값을 먼저 말한다')
  assert.notEqual(a, b, '안 b 의 해석은 안 a 와 무엇이 다른지 말한다(같은 색조·다른 명도)')
  assert.match(b, /같은 색조·더 어두운 명도/)
})

test('통합(값 둘): 「색을 빨강이랑 파랑으로」 → 안 a = 빨강, 안 b = 파랑 (되묻지 않는다)', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('색을 빨강이랑 파랑으로', site), { install: false })
  assert.equal(out.ask, undefined, out.ask)
  assert.equal(out.variants.length, 2)
  assert.deepEqual(out.variants.map((v) => v.changes[0].to.split(' (')[0]), ['빨강', '파랑'], '바뀐 곳은 읽은 값과 고른 모양(주색)')
  assert.match(out.say, /빨강/)
  assert.match(out.say, /파랑/)
  const [red, blue] = out.variants.map((v) => hueOf(compiledPrimary(run, v).light))
  assert.ok(hueDist(red, lch('#C62828')[2]) <= 3 && hueDist(blue, lch('#1565C0')[2]) <= 3, `${red} ${blue}`)
})

test('통합(영어 요청): 맞출 수 없는 색의 되묻기는 영어로, 값 읽기 요청 글은 영어 이름이다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('make the color yellow', site), { install: false })
  assert.match(out.ask, /yellow\(#F2C200\)/)
  assert.doesNotMatch(out.ask, /[가-힣]/, out.ask)
  const ko = await revise(run, 'a', parseRevision('색을 노랑으로 바꿔줘', site), { install: false })
  assert.match(ko.ask, /노랑\(#F2C200\)/)
})

test('통합(값 둘): 「서체를 명조랑 고딕으로」 → 안 a = 명조, 안 b = 고딕 (되묻지 않는다)', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', parseRevision('서체를 명조랑 고딕으로', site), { install: false })
  assert.equal(out.ask, undefined, out.ask)
  assert.equal(out.variants.length, 2)
  assert.deepEqual(out.variants.map((v) => v.changes[0].to.split(' (')[0]), ['명조', '고딕'])
  assert.match(out.say, /명조/)
  assert.match(out.say, /고딕/)
})

test('명령줄: 맞출 수 없는 색은 질문(종료 3) · 맞는 색은 판을 만들고 고르면 머리가 바뀐다', async () => {
  const run = fixtureRun()
  const lines = []
  const ask = await runReviseCommand({ run, pick: 'a', revise: '색을 노랑으로 바꿔줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(ask.code, EXIT.waiting)
  assert.ok(lines.some((l) => l.startsWith('질문: ') && /비슷한 색으로 바꿀까요/.test(l)), lines.join('\n'))
  assert.equal(existsSync(join(run, 'a', '09-revise')), false)
  const ok = await runReviseCommand({ run, pick: 'a', revise: '색을 초록색으로 바꿔줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(ok.code, EXIT.done)
  assert.match(lines.join('\n'), /해석: .*초록/, '해석 한 줄이 보인다')
  const pick = await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: (s) => lines.push(s) })
  assert.equal(pick.code, EXIT.done)
  assert.ok(lines.some((l) => /후보 레시피 머리를 바꿨다/.test(l)), lines.join('\n'))
})
