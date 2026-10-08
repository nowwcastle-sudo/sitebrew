import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recipeDistance, distinctProblems, boldProblems, boldFace, typeProblems } from './recipes-distinct.mjs'

const base = { id: 'a', axes: { button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S0' },
  fonts: { display: { family: 'IBM Plex Sans' }, body: { family: 'IBM Plex Sans KR' } },
  color: { light: { primary: 'oklch(0.24 0.02 255)' } } }
const clone = (patch) => ({ ...structuredClone(base), ...patch })

test('축 1개만 다르고 색·서체가 같으면 문제', () => {
  const b = clone({ id: 'b', axes: { ...base.axes, button: 'B2' } })
  assert.equal(distinctProblems([base, b]).length, 1)
})
test('축 2개 다르고 서체가 다르면 통과', () => {
  const b = clone({ id: 'b', axes: { ...base.axes, button: 'B2', radius: 'R1' }, fonts: { display: { family: 'Sora' }, body: { family: 'Pretendard' } } })
  assert.deepEqual(distinctProblems([base, b]), [])
})
test('색상각 30° 이상이면 색이 다르다', () => {
  const b = clone({ id: 'b', color: { light: { primary: 'oklch(0.5 0.15 20)' } } })
  assert.equal(recipeDistance(base, b).color, true)
})
test('저장소의 실제 레시피 전부가 통과한다', async () => {
  const { loadRecipeHeads } = await import('./recipes-distinct.mjs')
  assert.deepEqual(distinctProblems(loadRecipeHeads()), [])
})

// ── fix 1: 색 논리 분기·서체 정규화·읽지 못하는 머리 ─────────────────────────
const withPrimary = (id, primary) => clone({ id, color: { light: { primary } } })
const colorOf = (p, q) => recipeDistance(withPrimary('p', p), withPrimary('q', q)).color

test('색상각은 원 둘레로 잰다: 350° 대 10° 는 20°(같음), 345° 대 15° 는 30°(다름)', () => {
  assert.equal(colorOf('oklch(0.5 0.15 350)', 'oklch(0.5 0.15 10)'), false)
  assert.equal(colorOf('oklch(0.5 0.15 345)', 'oklch(0.5 0.15 15)'), true)
})
test('둘 다 무채색이면 색상각 값이 달라도 같은 색이다', () => {
  assert.equal(colorOf('oklch(0.2 0 0)', 'oklch(0.2 0 90)'), false)
  assert.equal(colorOf('oklch(0.24 0.02 255)', 'oklch(0.18 0 0)'), false)
  assert.equal(colorOf('oklch(0.2 0.01 30)', 'oklch(0.5 0.03 200)'), false)
})
test('한쪽만 무채색이면 다른 색이다(r1 거의 검정 남색 대 선명한 코발트)', () => {
  assert.equal(colorOf('oklch(0.24 0.02 255)', 'oklch(0.5 0.18 250)'), true)
})
test('무채색 경계는 C 0.04: 0.04 는 유채색, 0.0399 는 무채색', () => {
  assert.equal(colorOf('oklch(0.5 0.04 255)', 'oklch(0.5 0.0399 255)'), true)
  assert.equal(colorOf('oklch(0.5 0.04 255)', 'oklch(0.5 0.04 260)'), false)
  assert.equal(colorOf('oklch(0.5 0.04 255)', 'oklch(0.5 0.04 285)'), true)
})
test('lint 가 받는 oklch 표기(% 명도·색상각 none)도 읽는다', () => {
  assert.equal(colorOf('oklch(62% 0.15 20)', 'oklch(0.62 0.15 20)'), false)
  assert.equal(colorOf('oklch(0.2 0 none)', 'oklch(0.5 0.15 20)'), true)
})
test('primary 가 없거나 oklch 가 아니면 멈추지 않고 문제 한 줄로 보고한다', () => {
  const missing = clone({ id: 'm', color: { light: {} } })
  const hex = withPrimary('h', '#1e3a8a')
  const good = clone({ id: 'g', axes: { ...base.axes, button: 'B2', radius: 'R1' }, fonts: { display: { family: 'Sora' }, body: { family: 'Pretendard' } } })
  const out = distinctProblems([base, missing, hex, good])
  assert.deepEqual(out, ['m: primary 를 읽지 못함 — (없음)', 'h: primary 를 읽지 못함 — #1e3a8a'])
})
test('서체는 저장소 정규화로 비교한다: Pretendard = Pretendard Variable, 대소문자·앞뒤 공백 무시', () => {
  const a = clone({ id: 'x', fonts: { display: { family: 'IBM Plex Sans' }, body: { family: 'Pretendard' } } })
  const b = clone({ id: 'y', fonts: { display: { family: ' ibm plex sans ' }, body: { family: 'Pretendard Variable' } } })
  assert.equal(recipeDistance(a, b).fonts, false)
})
// Task 3 컨트롤러 판정: Pretendard GOV 는 Pretendard 와 메트릭 호환 변형이라 레시피 차이 검사에서 같은 서체로 센다
// (font-pretendard-gov.json meta.aliasOf 로 데이터에 적었다 — 하드코딩 문자열 비교가 아니다). 폰트 폴백 스택(fontStacks)에는
// 이 별칭이 새지 않는다 — recipe.test.mjs 「every fallback list …」가 그 경계를 지킨다.
test('Pretendard GOV 와 Pretendard 는 메트릭 호환 별칭이라 서체가 같다(컨트롤러 판정, meta.aliasOf 데이터 기반)', () => {
  const a = clone({ id: 'gov', fonts: { display: { family: 'Pretendard GOV' }, body: { family: 'Pretendard GOV' } } })
  const b = clone({ id: 'reg', fonts: { display: { family: 'Pretendard' }, body: { family: 'Pretendard' } } })
  assert.equal(recipeDistance(a, b).fonts, false)
  // 대소문자·공백도 무시하고, Variable 표기도 같은 별칭으로 묶인다.
  const c = clone({ id: 'gov2', fonts: { display: { family: ' pretendard gov variable ' }, body: { family: 'Pretendard GOV Variable' } } })
  assert.equal(recipeDistance(b, c).fonts, false)
})
test('mono 는 비교하지 않는다: 한쪽에만 있거나 달라도 서체 같음', () => {
  const b = clone({ id: 'b', fonts: { ...base.fonts, mono: { family: 'IBM Plex Mono' } } })
  assert.equal(recipeDistance(base, b).fonts, false)
})
test('prose 는 더하는 신호: display·body 가 같아도 prose 가 다르거나 한쪽에만 있으면 서체 다름, 같은 prose 면 같음(Task 5 fix 1)', () => {
  const serif = { family: 'Noto Serif KR' }
  assert.equal(recipeDistance(base, clone({ id: 'b', fonts: { ...base.fonts, prose: serif } })).fonts, true)
  const a = clone({ fonts: { ...base.fonts, prose: serif } })
  assert.equal(recipeDistance(a, clone({ id: 'b', fonts: { ...base.fonts, prose: serif } })).fonts, false)
  assert.equal(recipeDistance(a, clone({ id: 'b', fonts: { ...base.fonts, prose: { family: 'Hahmlet' } } })).fonts, true)
  // 더하는 신호일 뿐 — display 가 다르면 prose 가 같아도 여전히 다름
  assert.equal(recipeDistance(a, clone({ id: 'b', fonts: { display: { family: 'Sora' }, body: base.fonts.body, prose: serif } })).fonts, true)
})

test('문제 줄은 모자란 조건과 같은 축 값을 알려 준다', () => {
  const b = clone({ id: 'b', axes: { ...base.axes, button: 'B2' } })
  assert.deepEqual(distinctProblems([base, b]), ['a ~ b: 축 1개, 색 같음, 서체 같음 — 필요: 축 2개 이상 다름 · 색 또는 서체 중 하나 다름 — 같은 축: R0 I3 C2 T4 H3 S0'])
})

// ── fix 2: 강조색은 ring 에 산다 — primary 또는 ring 중 하나라도 다르면 색 다름 ─────
const withColors = (id, light) => clone({ id, color: { light } })
const NEAR_BLACK = 'oklch(0.24 0.02 255)'

test('primary 가 둘 다 거의 검정이어도 ring 색상각이 다르면 색이 다르다', () => {
  const a = withColors('a', { primary: NEAR_BLACK, ring: 'oklch(0.47 0.15 255)' })
  const b = withColors('b', { primary: NEAR_BLACK, ring: 'oklch(0.55 0.16 30)' })
  assert.equal(recipeDistance(a, b).color, true)
})
test('primary 도 ring 도 같으면 색이 같다', () => {
  const a = withColors('a', { primary: NEAR_BLACK, ring: 'oklch(0.47 0.15 255)' })
  const b = withColors('b', { primary: NEAR_BLACK, ring: 'oklch(0.5 0.14 262)' })
  assert.equal(recipeDistance(a, b).color, false)
})
test('ring 이 없으면 primary 만 본다(문제 줄 아님)', () => {
  const withRing = withColors('a', { primary: NEAR_BLACK, ring: 'oklch(0.55 0.16 30)' })
  const noRing = withColors('b', { primary: NEAR_BLACK })
  assert.equal(recipeDistance(withRing, noRing).color, false)
  assert.equal(recipeDistance(withColors('c', { primary: 'oklch(0.5 0.15 30)' }), noRing).color, true)
  const b2 = clone({ id: 'b2', axes: { ...base.axes, button: 'B2', radius: 'R1' }, fonts: { display: { family: 'Sora' }, body: { family: 'Pretendard' } }, color: { light: { primary: NEAR_BLACK } } })
  assert.deepEqual(distinctProblems([withRing, b2]), [])
})

// ── Task 6b fix 1 (리뷰 I4): 대담한 얼굴끼리 닮지 않게 — A 값과 보드 B안 모두 ─────────────
const k6 = (id, field, extra = {}) => ({ id, axes: base.axes, fonts: base.fonts, colorLogic: 'K6',
  color: { light: { primary: 'oklch(0.24 0.02 255)', 'field-1': field } }, ...extra })
const altK6 = (field) => ({ alternates: { colorLogic: 'K6', color: { light: { 'field-1': field }, dark: { 'field-1': field } }, note: 'x' } })

test('bold faces: K6·K7 use field-1, K8 the peak-chroma block', () => {
  assert.deepEqual(boldFace(k6('a', 'oklch(0.93 0.06 165)')), { l: 0.93, c: 0.06, h: 165 })
  const k8 = { id: 'k', colorLogic: 'K8', color: { light: { 'block-1': 'oklch(0.8 0.1 90)', 'block-2': 'oklch(0.6 0.19 30)', 'block-3': 'oklch(0.5 0.1 150)' } } }
  assert.deepEqual(boldFace(k8), { l: 0.6, c: 0.19, h: 30 })
  assert.equal(boldFace(clone({ colorLogic: 'K1' })), null)
})

test('three K6 recipes with the same pale mint field are look-alikes; hue >= 30° or a clear L/C gap separates them', () => {
  const mint = [k6('m1', 'oklch(0.93 0.06 165)'), k6('m2', 'oklch(0.92 0.065 170)'), k6('m3', 'oklch(0.93 0.06 160)')]
  assert.equal(boldProblems(mint).length, 3)
  assert.deepEqual(boldProblems([k6('a', 'oklch(0.93 0.06 165)'), k6('b', 'oklch(0.9 0.07 230)')]), []) // 65°
  assert.deepEqual(boldProblems([k6('a', 'oklch(0.9 0.07 250)'), k6('b', 'oklch(0.36 0.12 255)')]), []) // 밝은 면 대 짙은 면
  assert.deepEqual(boldProblems([k6('a', 'oklch(0.93 0.06 165)'), { ...k6('b', 'oklch(0.93 0.06 165)'), colorLogic: 'K7' }]), []) // 색 논리가 다르다
})

test('B options are compared too (not against their own A): two recipes whose B fields match are flagged', () => {
  const r1 = clone({ id: 'r1', colorLogic: 'K1', ...altK6('oklch(0.36 0.12 255)') })
  const r2 = clone({ id: 'r2', colorLogic: 'K1', ...altK6('oklch(0.35 0.11 262)') })
  const p = boldProblems([r1, r2])
  assert.equal(p.length, 1)
  assert.match(p[0], /r1\(B\) ~ r2\(B\)/)
  const self = { ...k6('s', 'oklch(0.36 0.12 255)'), ...altK6('oklch(0.36 0.12 255)') }
  assert.deepEqual(boldProblems([self]), []) // 같은 레시피의 A·B 는 비교하지 않는다
  const r1far = clone({ ...r1, axes: { ...base.axes, button: 'B2', radius: 'R1' }, fonts: { display: { family: 'Sora' }, body: { family: 'Pretendard' } } })
  assert.equal(distinctProblems([r1far, r2]).length, 1) // 쌍 검사는 통과해도 대담한 얼굴 검사가 남는다
})

// ── Task 10c: 서체 고유 검사 — 쌍이 아니라 묶음 전체에서, 얼굴(A·B)마다 ─────────────────
const typeHead = (id, display, displayKo, alternates) => ({ id, fonts: { display: { family: display }, ...(displayKo ? { displayKo: { family: displayKo } } : {}), body: { family: 'Pretendard' } }, ...(alternates ? { alternates } : {}) })
const altFonts = (display, displayKo) => ({ fonts: { display: { family: display }, ...(displayKo ? { displayKo: { family: displayKo } } : {}) }, note: 'x' })

test('typeProblems: two recipes with the same display (face A) are a violation, normalised like recipeDistance', () => {
  const out = typeProblems([typeHead('a', 'Young Serif'), typeHead('b', ' young serif '), typeHead('c', 'Antonio')])
  assert.equal(out.violations.length, 1)
  assert.match(out.violations[0], /A안 display/)
  assert.match(out.violations[0], /a · b/)
  assert.deepEqual(typeProblems([typeHead('a', 'Young Serif'), typeHead('c', 'Antonio')]).violations, [])
})

test('typeProblems: two recipes with the same displayKo are a violation; a recipe without one (r6 case) is left out', () => {
  const same = typeProblems([typeHead('a', 'Young Serif', 'Do Hyeon'), typeHead('b', 'Antonio', 'Do Hyeon')])
  assert.equal(same.violations.length, 1)
  assert.match(same.violations[0], /A안 displayKo/)
  // displayKo 가 없는 레시피는 비교하지 않는다(둘 다 없어도 문제 아님).
  assert.deepEqual(typeProblems([typeHead('a', 'Young Serif', 'Do Hyeon'), typeHead('r6', 'Unbounded'), typeHead('r6b', 'Tektur')]).violations, [])
  // 한글 서체는 키트 항목으로 묶는다(Pretendard = Pretendard Variable).
  assert.equal(typeProblems([typeHead('a', 'X', 'Pretendard'), typeHead('b', 'Y', 'Pretendard Variable')]).violations.length, 1)
})

test('typeProblems: face B (whole-B applied) is checked on its own; A∪B repeats across recipes only warn', () => {
  // B 끼리 같은 display → 위반(B안).
  const bb = typeProblems([typeHead('a', 'Young Serif', null, altFonts('Tektur')), typeHead('c', 'Antonio', null, altFonts('Tektur'))])
  assert.equal(bb.violations.length, 1)
  assert.match(bb.violations[0], /B안 display/)
  // A 끼리·B 끼리는 다르지만 a 의 A 가 c 의 B 와 같다 → 경고만.
  const cross = typeProblems([typeHead('a', 'Young Serif', null, altFonts('Tektur')), typeHead('c', 'Antonio', null, altFonts('Young Serif'))])
  assert.deepEqual(cross.violations, [])
  assert.equal(cross.warnings.length, 1)
  assert.match(cross.warnings[0], /Young Serif/)
  // 같은 레시피의 A·B 가 같은 display(B 가 서체를 안 바꿈)는 한 번으로 센다.
  assert.deepEqual(typeProblems([typeHead('a', 'Young Serif', null, { motion: 'M2', note: 'x' }), typeHead('c', 'Antonio')]).warnings, [])
})

test('reportDistinct (qa:distinct · gen:all) counts type violations, so the CLI exits 1; warnings do not count', async () => {
  const { reportDistinct } = await import('./recipes-distinct.mjs')
  const log = { lines: [], log(m) { this.lines.push(`log ${m}`) }, warn(m) { this.lines.push(`warn ${m}`) }, error(m) { this.lines.push(`error ${m}`) } }
  const ok = (id, display, extra = {}) => ({ ...clone({ id, axes: { ...base.axes, ...extra } }), fonts: { display: { family: display }, body: { family: 'Pretendard' } } })
  const heads = [ok('p', 'Young Serif'), ok('q', 'Young Serif', { button: 'B2', radius: 'R1' })]
  heads[1].color = { light: { primary: 'oklch(0.5 0.15 20)' } } // 쌍 검사는 통과(축 2·색 다름)
  assert.deepEqual(distinctProblems(heads), [])
  assert.equal(reportDistinct(heads, log), 1)
  assert.ok(log.lines.some((l) => l.startsWith('error 서체 고유 위반: A안 display Young Serif')), log.lines.join('\n'))
  const warnOnly = [ok('p', 'Young Serif'), { ...ok('q', 'Antonio', { button: 'B2', radius: 'R1' }), color: heads[1].color, alternates: altFonts('Young Serif') }]
  assert.equal(reportDistinct(warnOnly, log), 0)
})

// ── Task 10c fix 1 ─────────────────────────────────────────────────────
test('M1: typeProblems keys on the kit item (canonicalItem) — the same item under two family spellings is one face (reviewer reproduction)', () => {
  const h = (id, family, item) => ({ id, fonts: { display: { family, item }, body: { family: 'Pretendard', item: 'font-pretendard' } } })
  const out = typeProblems([h('a', 'Big Shoulders', 'font-big-shoulders'), h('b', 'Big Shoulders Display', 'font-big-shoulders')])
  assert.equal(out.violations.length, 1, JSON.stringify(out))
  // 별칭 항목(meta.aliasOf)도 따라간다: Pretendard GOV = Pretendard.
  const ko = (id, family, item) => ({ id, fonts: { display: { family: 'X' + id, item: `font-x${id}` }, displayKo: { family, item }, body: { family: 'Noto Sans KR' } } })
  assert.equal(typeProblems([ko('1', 'Pretendard', 'font-pretendard'), ko('2', 'Pretendard GOV', 'font-pretendard-gov')]).violations.length, 1)
  // 항목이 없으면 이름으로 키트 항목을 찾는다(한쪽만 item 을 적어도 같은 서체).
  assert.equal(typeProblems([h('a', 'Martian Mono', 'font-martian-mono'), h('b', ' martian mono variable ', undefined)]).violations.length, 1)
  // 음성 대조: 다른 항목이면 통과.
  assert.deepEqual(typeProblems([h('a', 'Big Shoulders', 'font-big-shoulders'), h('b', 'Antonio', 'font-antonio')]).violations, [])
})

test('M2: a Korean face repeating across roles or faces warns (not a violation): display↔displayKo, B displayKo ↔ A displayKo', () => {
  const head = (id, fonts, alternates) => ({ id, fonts: { body: { family: 'Pretendard' }, ...fonts }, ...(alternates ? { alternates } : {}) })
  // X 의 display(한글 서체 Do Hyeon) = Y 의 displayKo.
  const cross = typeProblems([head('x', { display: { family: 'Do Hyeon', item: 'font-do-hyeon' } }), head('y', { display: { family: 'Antonio' }, displayKo: { family: 'Do Hyeon', item: 'font-do-hyeon' } })])
  assert.deepEqual(cross.violations, [])
  assert.equal(cross.warnings.length, 1, JSON.stringify(cross))
  assert.match(cross.warnings[0], /한글 서체 Do Hyeon .*x\(A display\).*y\(A displayKo\)/)
  // X 의 B displayKo = Y 의 A displayKo.
  const b = typeProblems([
    head('x', { display: { family: 'Antonio' }, displayKo: { family: 'Orbit' } }, { fonts: { displayKo: { family: 'Dongle' } }, note: 'x' }),
    head('y', { display: { family: 'Tektur' }, displayKo: { family: 'Dongle' } }),
  ])
  assert.deepEqual(b.violations, [])
  assert.equal(b.warnings.length, 1)
  assert.match(b.warnings[0], /Dongle /)
  assert.ok(b.warnings[0].includes('x(B displayKo)') && b.warnings[0].includes('y(A displayKo)'), b.warnings[0])
  // 같은 얼굴·같은 역할의 겹침은 위반만(경고를 겹쳐 내지 않는다), 한 레시피의 A·B 가 같은 displayKo 는 한 번.
  const same = typeProblems([head('x', { display: { family: 'Antonio' }, displayKo: { family: 'Orbit' } }), head('y', { display: { family: 'Tektur' }, displayKo: { family: 'Orbit' } })])
  assert.equal(same.violations.length, 1)
  assert.deepEqual(same.warnings, [])
  assert.deepEqual(typeProblems([head('x', { display: { family: 'Antonio' }, displayKo: { family: 'Orbit' } }, { fonts: { display: { family: 'Tektur' } }, note: 'x' })]).warnings, [])
})

// 컨트롤러 배정표(docs/recipes/dna/fonts-assignment.md) 그대로 — 10e 가 쓸 20안이 위반·경고 없이 통과한다(양성 대조, 모든 항목이 키트에 있다).
const ASSIGNMENT = [
  ['r1-measure', 'Martian Mono', 'Nanum Gothic Coding', 'Tektur', 'PyeojinGothic', 'IBM Plex Sans KR'],
  ['r2-signal', 'Bricolage Grotesque', 'Do Hyeon', 'Dela Gothic One', 'Moirai One', 'Gothic A1'],
  ['r3-woodblock', 'Young Serif', 'Song Myung', 'Shrikhand', 'BM Euljiro', 'Noto Sans KR'],
  ['r4-evidence', 'Newsreader', 'MaruBuri', 'Spectral', 'SeochoBatang', 'Noto Sans KR'],
  ['r5-celadon', 'Bodoni Moda', 'Diphylleia', 'Tenor Sans', 'Grandiflora One', 'Pretendard'],
  ['r6-civic', 'Unbounded', null, 'Fragment Mono', null, 'Pretendard GOV'],
  ['r7-docs', 'Besley', 'NanumSquareRound', 'Libre Caslon Display', 'NaturalSans', 'Pretendard'],
  ['r8-dusk', 'Big Shoulders', 'Gowun Batang', 'Alegreya', 'Nanum Brush Script', 'Nanum Gothic'],
  ['r9-clay', 'Grandstander', 'Bagel Fat One', 'Titan One', 'Dongle', 'Gothic A1'],
  ['r10-console', 'Antonio', 'Orbit', 'Azeret Mono', 'Galmuri11', 'Pretendard'],
]
test('the controller assignment table (20 faces) passes typeProblems with 0 violations and 0 warnings, every face a kit item', async () => {
  const { loadSources } = await import('./gen-fonts.mjs')
  const kit = loadSources()
  const f = (family) => {
    if (!family) return undefined
    const i = kit.find((x) => x.title === family || x.meta?.family === family)
    assert.ok(i, `${family} 가 키트에 없다`)
    return { family, item: i.name }
  }
  const heads = ASSIGNMENT.map(([id, aD, aK, bD, bK, body]) => ({ id,
    fonts: { display: f(aD), ...(aK ? { displayKo: f(aK) } : {}), body: f(body) },
    alternates: { fonts: { display: f(bD), ...(bK ? { displayKo: f(bK) } : {}) }, note: 'B' } }))
  assert.deepEqual(typeProblems(heads), { violations: [], warnings: [] })
  // 양성 대조: 표의 한 칸을 다른 레시피의 한글 제목체로 바꾸면 경고가 난다.
  heads[0].alternates.fonts.displayKo = f('Orbit')
  assert.equal(typeProblems(heads).warnings.length, 1)
})

test('typeProblems: the repository recipes pass (no violations)', async () => {
  const { loadRecipeHeads } = await import('./recipes-distinct.mjs')
  assert.deepEqual(typeProblems(loadRecipeHeads()).violations, [])
})

// Task 10d: 첫 화면 히어로는 묶음 전체에서 A·B 모두 달라야 한다. 히어로가 없는 레시피(묶음 2 전)는 빠진다.
test('heroProblems: a hero used twice across A·B faces is a violation; recipes without a hero are skipped; the live set passes', async () => {
  const { heroProblems, loadRecipeHeads } = await import('./recipes-distinct.mjs')
  const a = { id: 'a', hero: 'cropped-title-list', alternates: { hero: 'inline-chip-title' } }
  const b = { id: 'b', hero: 'twin-panels' }
  assert.deepEqual(heroProblems([a, b, { id: 'c' }]), [])
  const dup = heroProblems([a, { id: 'd', hero: 'inline-chip-title' }])
  assert.equal(dup.length, 1)
  assert.match(dup[0], /inline-chip-title 를 a\(B\) · d\(A\)/)
  assert.equal(heroProblems([{ id: 'e', hero: 'twin-panels', alternates: { hero: 'twin-panels' } }]).length, 1)
  const live = loadRecipeHeads()
  assert.deepEqual(heroProblems(live), [])
  assert.ok(live.filter((h) => h.hero).length >= 5, '묶음 1(r1~r5)은 히어로가 있다')
})
