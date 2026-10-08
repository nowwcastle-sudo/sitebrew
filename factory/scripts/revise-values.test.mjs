// 값이 든 수정 요청(FIT-2) — 「색을 초록색으로」·「메인 색을 #0B6E4F 로」·「서체를 명조로」를 지킨다.
//   · 읽기(parseRevision): 색 값(#hex·색 이름)·서체 값(범주·서체 이름) → intent "value" · 값 없는 예전 요청(「색 다르게」「서체 바꿔줘」)은 그대로 · 모호하면 되묻기
//   · 안 계획(planAxisValue): brandToRecipeHead 로 만든 안 — 주색이 요청 색과 같은 색조·대비 4.5:1 이상 · 맞출 수 없으면 질문 · 서체는 그 범주에서 한글을 그리는 키트 서체 상위 둘
//   · 통합(revise → applyRevision, 06 은 install:false): 보드에 값·읽은 방식이 남고, 컴파일된 임시 레시피의 --primary 가 그 색이다
//   · 골든(REVISE_VALUES_GOLDEN=1, 잠금 안): 진짜 06(shadcn add)을 다시 찍은 사이트 CSS 의 --primary
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { applyRevision, parseRevision, revise } from '../stamp/revise.mjs'
import { EXIT, runReviseCommand } from '../stamp/stamp.mjs'
import { COLOR_NAMES, KIT_CATEGORY, TYPE_CATEGORIES, koreanKitFonts, planAxisValue, primaryHexOf } from '../stamp/revise-values.mjs'
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
const T = (text) => parseRevision(text, site)
const lch = (hex) => hexToOklch(hex.slice(1))
const themeBg = (head, theme) => head.color[theme].background
const contrast = (head, theme) => ratio(head.color[theme].primary, themeBg(head, theme))
const hueOf = (v) => parseOklch(v)[2]

// ── 읽기 ────────────────────────────────────────────────────────────────────

test('값 읽기(색): #hex 와 색 이름을 읽는다 — 브리프 세 문장 + 영어 짝', () => {
  const colorValue = (text) => { const r = T(text); return [r.scope, r.target, r.intent, r.value] }
  assert.deepEqual(colorValue('색을 초록색으로 바꿔줘'), ['axis', 'color', 'value', { hex: '#2E7D32', from: 'name', name: 'green' }])
  assert.deepEqual(colorValue('메인 색을 #0B6E4F 로'), ['axis', 'color', 'value', { hex: '#0B6E4F', from: 'hex' }])
  assert.deepEqual(colorValue('make the main color #0B6E4F'), ['axis', 'color', 'value', { hex: '#0B6E4F', from: 'hex' }])
  assert.deepEqual(colorValue('change the color to green'), ['axis', 'color', 'value', { hex: '#2E7D32', from: 'name', name: 'green' }])
  assert.deepEqual(colorValue('메인 색을 #0b6e4f로 바꿔줘').at(-1), { hex: '#0B6E4F', from: 'hex' }, '소문자·조사 붙임')
  assert.deepEqual(colorValue('메인 색을 #0a5 로').at(-1), { hex: '#00AA55', from: 'hex' }, '#rgb 는 #rrggbb 로 편다')
  assert.equal(T('#0B6E4F 로 바꿔줘').target, 'color', '「색」 낱말이 없어도 #hex 만으로 색 축이다')
  assert.equal(T('색을 초록색으로 바꿔줘').text, '색을 초록색으로 바꿔줘', '원문이 요청에 남는다(보드에 적는다)')
})

test('값 읽기(색): 이름 표 — 한국어·영어, 이름마다 대표 색 하나, 표의 모든 이름이 읽힌다', () => {
  const expect = { 빨강: '#C62828', 빨간색: '#C62828', 주황색: '#B45309', 노랑: '#F2C200', 노란색: '#F2C200', 초록: '#2E7D32', 녹색: '#2E7D32', 청록색: '#00796B', 파랑: '#1565C0', 파란색: '#1565C0', 남색: '#1F3A8A', 보라색: '#6A1B9A', 분홍색: '#D6336C', 갈색: '#7B4A2D', 베이지: '#D8C3A5', 검정: '#111111', 검은색: '#111111', 회색: '#707070', 흰색: '#FFFFFF' }
  for (const [name, hex] of Object.entries(expect)) {
    const r = T(`색을 ${name}으로 바꿔줘`)
    assert.equal(r.intent, 'value', name)
    assert.deepEqual([r.value.hex, r.value.from], [hex, 'name'], name)
  }
  for (const c of COLOR_NAMES) {
    const r = T(`change the color to ${c.words[0]}`)
    assert.equal(r.value?.name, c.key, c.key)
    assert.equal(r.value.hex, c.hex)
  }
  assert.equal(T('보라고 했는데 색 바꿔줘').intent, 'different', '「보라고」는 보라색이 아니다')
})

test('값 읽기(색): 모호하면 되묻는다 — 색이 둘 · 배경/글자 색 · 구획과 함께', () => {
  for (const text of ['색을 빨강이랑 초록으로', '색을 #0B6E4F 나 #C62828 로', 'color red or blue', '배경색을 초록으로 바꿔줘', 'make the background green',
    '빨강 말고 다른 색으로', 'change the color, not red', '서체를 고딕 말고 다른 걸로']) { // 「말고」「not」 — 그 값을 그대로 적용하면 반대로 간다
    const r = T(text)
    assert.deepEqual(Object.keys(r), ['ask'], `${text} → ${JSON.stringify(r)}`)
    assert.ok(r.ask.length > 0 && r.ask.length < 80, r.ask)
  }
  assert.match(T('히어로 색을 초록으로').ask, /전체/, '구획과 함께면 예전 질문 그대로')
})

test('값 읽기(서체): 범주 낱말과 서체 이름 — 브리프 문장 + 영어 짝', () => {
  const typeValue = (text) => { const r = T(text); return [r.scope, r.target, r.intent, r.value] }
  assert.deepEqual(typeValue('서체를 명조로 바꿔줘'), ['axis', 'type', 'value', { category: 'serif' }])
  assert.deepEqual(typeValue('use a serif font'), ['axis', 'type', 'value', { category: 'serif' }])
  assert.deepEqual(typeValue('글꼴을 고딕으로'), ['axis', 'type', 'value', { category: 'sans' }])
  assert.deepEqual(typeValue('폰트를 산세리프로'), ['axis', 'type', 'value', { category: 'sans' }], '산세리프는 세리프가 아니다')
  assert.deepEqual(typeValue('use a sans-serif typeface'), ['axis', 'type', 'value', { category: 'sans' }])
  assert.deepEqual(typeValue('서체를 손글씨로'), ['axis', 'type', 'value', { category: 'handwriting' }])
  assert.deepEqual(typeValue('서체를 둥근 걸로'), ['axis', 'type', 'value', { category: 'rounded' }])
  assert.deepEqual(typeValue('고정폭 서체로 바꿔줘'), ['axis', 'type', 'value', { category: 'mono' }])
  assert.deepEqual(typeValue('use a monospace font'), ['axis', 'type', 'value', { category: 'mono' }])
  assert.deepEqual(typeValue('서체를 Noto Serif KR 로'), ['axis', 'type', 'value', { family: 'Noto Serif KR' }])
  assert.deepEqual(typeValue('use the Pretendard font'), ['axis', 'type', 'value', { family: 'Pretendard' }])
  assert.deepEqual(typeValue('명조로 바꿔줘').slice(0, 3), ['axis', 'type', 'value'], '「서체」 낱말이 없어도 명조/고딕은 서체 이야기다')
  for (const text of ['서체를 명조랑 고딕으로', 'use a serif or mono font']) assert.deepEqual(Object.keys(T(text)), ['ask'], text)
})

test('회귀: 값이 없는 요청은 지금 결과 그대로 — 「색 다르게」「더 차분한 색」「서체 바꿔줘」', () => {
  const R = (text) => { const r = T(text); return [r.scope, r.target, r.intent, 'value' in r] }
  assert.deepEqual(R('색을 바꿔줘'), ['axis', 'color', 'different', false])
  assert.deepEqual(R('색을 다르게'), ['axis', 'color', 'different', false])
  assert.deepEqual(R('더 차분한 색으로 해줘'), ['axis', 'color', 'calmer', false])
  assert.deepEqual(R('change the color palette'), ['axis', 'color', 'different', false])
  assert.deepEqual(R('서체 바꿔줘'), ['axis', 'type', 'different', false])
  assert.deepEqual(R('서체를 다른 걸로'), ['axis', 'type', 'different', false])
  assert.deepEqual(R('글꼴을 더 차분하게'), ['axis', 'type', 'calmer', false])
  assert.deepEqual(R('use a different font'), ['axis', 'type', 'different', false])
  assert.deepEqual(R('모션 강도를 낮춰줘'), ['axis', 'motion', 'calmer', false])
  assert.deepEqual(R('less motion'), ['axis', 'motion', 'calmer', false])
  assert.ok(T('검색 결과가 색다르게 보였으면').ask, '「검색」·「색다르게」는 색 축이 아니다 — 되묻는다')
  assert.ok(T('더 예쁘게 해줘').ask && T('make it prettier').ask)
  assert.deepEqual([T('히어로를 더 대담하게').scope, T('히어로를 더 대담하게').target], ['section', 'home/hero'])
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
  const sugPlan = planAxisValue(base, { scope: 'axis', target: 'color', intent: 'value', value: { hex: y.suggestion, from: 'hex' }, text: '메인 색을 ' + y.suggestion })
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
  const gone = planAxisValue(base, { scope: 'axis', target: 'type', intent: 'value', value: { family: 'Lobster' }, text: '서체를 Lobster 로' })
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

test('통합(색): --revise "메인 색을 #0B6E4F 로" → 안 둘, 보드에 값·원문, 컴파일된 --primary = 그 색 · 고르면 후보 레시피 머리가 바뀌고 06·07 낡음', async () => {
  const run = fixtureRun()
  const before = guard(run)
  const out = await revise(run, 'a', T('메인 색을 #0B6E4F 로'), { install: false, now: () => '2026-10-10T00:00:00.000Z' })
  assert.equal(out.status, 'ready')
  assert.equal(out.intent, 'value')
  assert.equal(out.variants.length, 2)
  assert.equal(out.variants[0].value, '#0B6E4F')
  assert.notEqual(out.variants[1].value, '#0B6E4F')
  assert.deepEqual(guard(run), before, '지금 사이트·03·04 는 제안만으로 바뀌지 않는다')
  const board = JSON.parse(readFileSync(out.boardFile, 'utf8'))
  assert.deepEqual([board.scope, board.target, board.intent, board.status], ['axis', 'color', 'value', 'ready'])
  assert.deepEqual(board.value, { hex: '#0B6E4F', from: 'hex' })
  assert.equal(board.request, '메인 색을 #0B6E4F 로')
  for (const v of out.variants) {
    assert.equal(v.diff.sameStructure, true, '구조 유지')
    const p = compiledPrimary(run, v)
    assert.ok(hueDist(hueOf(p.light), lch('#0B6E4F')[2]) <= 3, `${v.id} 라이트 --primary ${p.light}`)
    assert.ok(v.diff.primary.light && v.diff.primary.dark, '안의 주색(라이트·다크)이 diff 에 남는다')
  }
  // 고르기
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.deepEqual(applied.stale, ['06', '07'])
  assert.equal(applied.value, '#0B6E4F')
  const d01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data
  assert.equal(d01.source, 'brand')
  assert.equal(primaryHexOf(d01.recipe), '#0B6E4F', '후보 레시피 머리의 주색이 요청 색')
  assert.equal(d01.recipe.fonts.display.item, base.fonts.display.item)
  assert.deepEqual(guard(run), before, '03·04 는 고르기 뒤에도 그대로')
})

test('통합(색 이름): 보드 안내에 「초록 → #2E7D32 로 읽었어요」가 남는다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', T('색을 초록색으로 바꿔줘'), { install: false })
  assert.equal(out.status, 'ready')
  assert.ok(out.notes.includes('초록 → #2E7D32 로 읽었어요. 정확한 색 코드가 있으면 알려 주세요.'), out.notes.join(' | '))
  assert.deepEqual(JSON.parse(readFileSync(out.boardFile, 'utf8')).notes, out.notes)
})

test('통합(맞출 수 없는 색): 질문만 — 09-revise 도 안 만들고 아무것도 바꾸지 않는다', async () => {
  const run = fixtureRun()
  const before = guard(run)
  const out = await revise(run, 'a', T('색을 노랑으로 바꿔줘'), { install: false })
  assert.match(out.ask, /비슷한 색으로 바꿀까요\?/)
  assert.equal(out.variants, undefined)
  assert.equal(existsSync(join(run, 'a', '09-revise')), false)
  assert.deepEqual(guard(run), before)
})

test('통합(서체): --revise "서체를 명조로 바꿔줘" → 안 둘, 컴파일된 임시 레시피가 그 서체 · 고르면 머리의 서체가 바뀐다', async () => {
  const run = fixtureRun()
  const out = await revise(run, 'a', T('서체를 명조로 바꿔줘'), { install: false })
  assert.equal(out.status, 'ready')
  assert.equal(out.variants.length, 2)
  const pool = koreanKitFonts().filter((f) => f.category === 'serif')
  for (const v of out.variants) assert.ok(pool.some((f) => f.family === v.value), v.value)
  const applied = await applyRevision(run, 'a', out.index, 'v1', { userFile: join(dir, 'p.json'), seedFile: join(dir, 'no.json') })
  assert.equal(applied.value, out.variants[0].value)
  const d01 = JSON.parse(readFileSync(join(run, 'a', '01-direction.json'), 'utf8')).data
  assert.equal(d01.recipe.fonts.body.family, out.variants[0].value)
  assert.ok(isKorean(d01.recipe.fonts.body.family))
})

test('명령줄: 맞출 수 없는 색은 질문(종료 3) · 고른 값은 출력에 보인다', async () => {
  const run = fixtureRun()
  const lines = []
  const ask = await runReviseCommand({ run, pick: 'a', revise: '색을 노랑으로 바꿔줘' }, { say: (s) => lines.push(s), revOpts: { install: false } })
  assert.equal(ask.code, EXIT.waiting)
  assert.ok(lines.some((l) => l.startsWith('질문: ') && /비슷한 색으로 바꿀까요/.test(l)), lines.join('\n'))
  assert.equal(existsSync(join(run, 'a', '09-revise')), false)
  const ok = await runReviseCommand({ run, pick: 'a', revise: '메인 색을 #0B6E4F 로' }, { say: () => {}, revOpts: { install: false } })
  assert.equal(ok.code, EXIT.done)
  const pick = await runReviseCommand({ run, pick: 'a', revisePick: { index: 1, id: 'v1' } }, { say: (s) => lines.push(s) })
  assert.equal(pick.code, EXIT.done)
  assert.ok(lines.some((l) => /color 축을 #0B6E4F 로 정했다/.test(l)), lines.join('\n'))
})
