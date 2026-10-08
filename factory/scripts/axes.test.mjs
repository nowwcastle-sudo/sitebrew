import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStyleMap } from 'shadcn/utils'
import { listValues, styleMapOf, axisOfHook, outOfFamily, AXIS_ORDER, AXIS_DEFAULTS, BASE_CSS, monoOnText } from './axes.mjs'
import { COMPAT, checkCompat } from './compat.mjs'
import { compileSource } from './compile-styles.mjs'
import { rulesIntact, ruleClasses } from './hooks-audit.mjs'
import { render, VALUES as RADIUS_VALUES } from './gen-radius-axis.mjs'
import { lintSource } from '../qa/lint-ui.mjs'

const UI_SRC = fileURLToPath(new URL('../../registry/factory/ui-src/', import.meta.url))
const files = readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx'))
const src = Object.fromEntries(files.map((f) => [f, readFileSync(join(UI_SRC, f), 'utf8')]))
const srcHooks = new Set(Object.values(src).flatMap((s) => s.match(/\bcn-[a-z0-9-]+/g) ?? []))
const base = createStyleMap(readFileSync(BASE_CSS, 'utf8'))
const values = listValues()
const mapOf = Object.fromEntries(values.map((v) => [v.id, styleMapOf(v.file)]))

test('44 value files (28 + Task 16a C6·C8·H5·R3·D1~D3·X0~X3 + P3-6 사진 질감 X4~X8), one per value named in compat.json, in axis order', () => {
  assert.equal(values.length, 44)
  for (const axis of AXIS_ORDER) assert.deepEqual(values.filter((v) => v.axis === axis).map((v) => v.id), COMPAT.axes[axis], axis)
})

test('each value file covers only hooks of its own axis family, and only hooks that exist in ui-src', () => {
  for (const v of values) {
    const map = mapOf[v.id]
    assert.ok(Object.keys(map).length > 0, `${v.id}: empty`)
    assert.deepEqual(outOfFamily(v.axis, map), [], `${v.id}: out-of-family keys`)
    assert.deepEqual(Object.keys(map).filter((h) => !srcHooks.has(h)), [], `${v.id}: keys with no hook in ui-src`)
  }
})

test('family check catches a value that touches another axis (negative control)', () => {
  const bad = createStyleMap('.cn-button { @apply rounded-none; } .cn-card { @apply rounded-none; } .cn-card-shadow { @apply shadow-none; } .cn-badge { @apply rounded-none; }')
  assert.deepEqual(outOfFamily('button', bad), ['cn-card', 'cn-card-shadow', 'cn-badge'])
  assert.equal(axisOfHook('cn-button-group-text'), 'button')
  assert.equal(axisOfHook('cn-input-otp-slot'), 'radius')
  assert.equal(axisOfHook('cn-navigation-menu-popup-shadow'), 'shadow')
  assert.equal(axisOfHook('cn-sidebar-menu-button'), 'header')
})

test('radius value files are up to date with base.css (gen-radius-axis.mjs --check)', () => {
  for (const v of RADIUS_VALUES) {
    const file = values.find((x) => x.id === v.id).file
    assert.equal(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), render(base, v), `${v.slug} is stale — run node factory/scripts/gen-radius-axis.mjs`)
  }
})

test('every value compiled on top of base.css keeps every rule class and adds none that fights a rule; lint-ui 0', async () => {
  const bad = []
  for (const v of values) {
    const map = { ...base, ...mapOf[v.id] }
    for (const f of files) {
      const out = await compileSource(src[f], map)
      const r = rulesIntact(src[f], out)
      if (r.missing.length || r.fighting.length) bad.push(`${v.id}/${f}: missing ${r.missing.join(' ')} fighting ${r.fighting.join(' ')}`)
      const lint = lintSource(f, out, { motionCoveredGlobally: true, generated: true })
      if (lint.fails.length) bad.push(`${v.id}/${f}: lint ${lint.fails.map((x) => `${x.rule} ${x.hit}`).join(', ')}`)
    }
  }
  assert.deepEqual(bad, [])
})

const tokens = (s = '') => s.split(/\s+/).filter(Boolean)
const units = (s, re) => tokens(s).map((t) => t.match(re)).filter(Boolean).map((m) => Number(m[1]))
test('floors: 44px controls, 16px mobile input text, textarea min-h ≥ 44px, no text under 14px', () => {
  for (const v of values) {
    const m = mapOf[v.id]
    for (const [h, s] of Object.entries(m)) assert.doesNotMatch(s, /\btext-xs\b|text-\[(0\.|1[0-3]px|[0-9]px)/, `${v.id} ${h}: text under 14px`)
    if (v.axis === 'button') {
      assert.ok(Math.min(...units(m['cn-button-size-default'], /^h-(\d+)$/)) >= 11, `${v.id}: default height`)
      assert.ok(Math.min(...units(m['cn-button-size-icon'], /^size-(\d+)$/)) >= 11, `${v.id}: icon size`)
    }
    if (v.axis === 'input') {
      assert.ok(units(m['cn-input'], /^h-(\d+)$/)[0] >= 11, `${v.id}: input height`)
      assert.ok(tokens(m['cn-input']).includes('text-base') && tokens(m['cn-input']).includes('md:text-sm'), `${v.id}: mobile 16px`)
      assert.ok(units(m['cn-textarea'], /^min-h-(\d+)$/)[0] >= 11, `${v.id}: textarea min-h`)
      assert.ok(units(m['cn-select-trigger'], /^data-\[size=default\]:h-(\d+)$/)[0] >= 11, `${v.id}: select height`)
      assert.ok(units(m['cn-native-select'], /^h-(\d+)$/)[0] >= 11, `${v.id}: native select height`)
    }
  }
})

// 토큰마다 유틸리티(변형을 뗀 끝)를 본다: 색/NN 알파·backdrop-*·opacity-* 가 있으면 반투명이다.
const utilOf = (t) => { let d = 0, cut = -1; for (let i = 0; i < t.length; i++) { const c = t[i]; if (c === '[' || c === '(') d++; else if (c === ']' || c === ')') d--; else if (c === ':' && d === 0) cut = i } return t.slice(cut + 1).replace(/^!|!$/g, '') }
export const translucent = (s) => tokens(s).filter((t) => { const u = utilOf(t); return /^(bg|border(-[xytrblse])?|ring|text|from|via|to|outline|fill|stroke)-[a-z-]+(-\d+)?\/\d+$/.test(u) || /^backdrop-/.test(u) || /^opacity-/.test(u) })
test('no translucent brutal values (token by token), no rounded-full on large containers', () => {
  assert.deepEqual(translucent('rounded-none [&_svg:not([class*=size-])]:size-4 bg-foreground/60'), ['bg-foreground/60']) // 리뷰 음성 대조
  assert.deepEqual(translucent('hover:bg-muted border-foreground'), [])
  for (const id of ['B1', 'I3', 'C2', 'T4', 'H3', 'S2', 'C6', 'C8']) for (const [h, s] of Object.entries(mapOf[id]))
    assert.deepEqual(translucent(s), [], `${id} ${h}: translucent`)
  for (const id of Object.keys(mapOf)) for (const h of ['cn-card', 'cn-dialog-content', 'cn-alert-dialog-content', 'cn-sheet-content', 'cn-popover-content', 'cn-table'])
    assert.doesNotMatch(mapOf[id][h] ?? '', /(^|\s)rounded-full\b/, `${id} ${h}`)
})

// 실루엣이 실제로 다르다: 축마다 대표 부품을 값별로 컴파일한 결과가 서로 다르고 base 와도 다르다.
test('values of one axis compile to pairwise different components', async () => {
  // 반경 운영자는 배지 + 아바타(R3 은 컨트롤이 R1 과 같고 이미지 마스크만 다르다 — Task 16a). 새 축 D·X 는 제 부품.
  const REP = { button: ['button.tsx'], input: ['input.tsx'], surface: ['card.tsx'], table: ['table.tsx'], header: ['navigation-menu.tsx'], radius: ['badge.tsx', 'avatar.tsx'], shadow: ['card.tsx'], display: ['display.tsx'], texture: ['texture.tsx'] }
  const compileRep = async (axis, map) => (await Promise.all(REP[axis].map((f) => compileSource(src[f], map)))).join('\n')
  for (const axis of AXIS_ORDER) {
    const baseOut = await compileRep(axis, base)
    // 선택 축의 기본값(D1·X0)은 base 와 같은 모양이다 — 기존 레시피(머리에 없음 → 기본값)가 바뀌지 않는 근거. 나머지 값은 base 와 다르다.
    const seen = new Map(AXIS_DEFAULTS[axis] ? [] : [['base', baseOut]])
    if (AXIS_DEFAULTS[axis]) assert.equal(await compileRep(axis, { ...base, ...mapOf[AXIS_DEFAULTS[axis]] }), baseOut, `${AXIS_DEFAULTS[axis]} must compile the same as base`)
    for (const v of values.filter((x) => x.axis === axis)) {
      const out = await compileRep(axis, { ...base, ...mapOf[v.id] })
      for (const [k, o] of seen) assert.notEqual(out, o, `${axis}: ${v.id} compiles the same as ${k}`)
      seen.set(v.id, out)
    }
  }
  // 헤더: H4 는 sidebar 도 바꾼다 — 메뉴 줄은 크기 훅(뒤에 붙어 이기는 훅)에서 40px, 레일 폭 240px(리뷰 I5·M11).
  const sbBase = await compileSource(src['sidebar.tsx'], base), sbH4 = await compileSource(src['sidebar.tsx'], { ...base, ...mapOf.H4 })
  assert.notEqual(sbH4, sbBase)
  assert.match(mapOf.H4['cn-sidebar-menu-button-size-default'], /(^|\s)h-10(\s|$)/)
  assert.doesNotMatch(mapOf.H4['cn-sidebar-menu-button'], /(^|\s)h-\d/, 'H4 body hook must not carry a height the size hook overrides')
  for (const h of ['cn-sidebar-frame', 'cn-sidebar-static']) assert.match(mapOf.H4[h], /\[--sidebar-width:15rem\]/, h)
})

// 리뷰 M7: 클래스 단위 격리. 높이 그림자는 -shadow 훅에만(base·모든 값), 그림자 축은 반경을 그리지 않는다,
// 다른 축 값의 반경은 base 가 반경을 두는 훅(또는 축의 뿌리 훅)에만. shadow-none(초기화)과 0 오프셋 1px 링은 높이가 아니다.
const elevation = (t) => { const u = utilOf(t); return /^shadow(-(2xs|xs|sm|md|lg|xl|2xl))?$/.test(u) || (/^shadow-\[/.test(u) && !/^shadow-\[0_0_0_/.test(u)) }
const ROUND = /^rounded(-|$)/
const ROOT_SHAPE = new Set(['cn-navigation-menu', 'cn-site-shell-header-inner']) // 셸의 떠 있는 섬(H2)도 헤더 뿌리 모양 // 헤더 바의 모양은 내비 뿌리 훅이 그린다(base 는 모서리 없음)
test('class-level isolation: elevation only in -shadow hooks, radius only where base rounds it', () => {
  const bad = []
  for (const [label, map] of [['base', base], ...values.map((v) => [v.id, mapOf[v.id]])])
    for (const [h, s] of Object.entries(map)) for (const t of tokens(s)) if (elevation(t) && !h.endsWith('-shadow')) bad.push(`${label} ${h}: ${t}`)
  for (const v of values.filter((x) => x.axis === 'shadow')) for (const [h, s] of Object.entries(mapOf[v.id])) if (tokens(s).some((t) => ROUND.test(utilOf(t)))) bad.push(`${v.id} ${h}: rounded`)
  for (const v of values.filter((x) => x.axis !== 'radius' && x.axis !== 'shadow')) for (const [h, s] of Object.entries(mapOf[v.id])) {
    const baseRounds = tokens(base[h] ?? '').some((t) => ROUND.test(utilOf(t)))
    if (!baseRounds && !ROOT_SHAPE.has(h) && tokens(s).some((t) => ROUND.test(utilOf(t)))) bad.push(`${v.id} ${h}: rounded where base has none`)
  }
  assert.deepEqual(bad, [])
  assert.ok(elevation('shadow-2xl') && !elevation('shadow-none') && !elevation('shadow-[0_0_0_1px_var(--sidebar-border)]') && !elevation('inset-shadow-[0_1px_0_white]'))
})

// 리뷰 I1: 블러(backdrop-*)는 고정·스티키·모달 배경 자리에만 — 모달 배경(overlay)과 헤더 뿌리(셸이 sticky/fixed 로 둔다). 흐르는 카드에는 없다.
const BACKDROP_OK = (h) => /-overlay$/.test(h) || h === 'cn-navigation-menu' || h === 'cn-site-shell-header' || h === 'cn-site-shell-header-inner'
test('backdrop-filter only on overlay and header-root hooks; blur ≤ 20px', () => {
  const bad = []
  for (const [label, map] of [['base', base], ...values.map((v) => [v.id, mapOf[v.id]])]) for (const [h, s] of Object.entries(map)) for (const t of tokens(s)) {
    const u = utilOf(t)
    if (/^backdrop-/.test(u) && !BACKDROP_OK(h)) bad.push(`${label} ${h}: ${t}`)
    const px = u.match(/^backdrop-blur-\[(\d+)px\]$/); if (px && Number(px[1]) > 20) bad.push(`${label} ${h}: ${t} > 20px`)
    if (/^backdrop-blur-(xl|2xl|3xl)$/.test(u)) bad.push(`${label} ${h}: ${t} > 20px`)
  }
  assert.deepEqual(bad, [])
  // 반투명·블러 면은 reduced-transparency 에서 블러를 끈다(DESIGN §6 MUST).
  for (const v of values) for (const [h, s] of Object.entries(mapOf[v.id])) if (tokens(s).some((t) => /^backdrop-blur-/.test(utilOf(t)) && utilOf(t) !== 'backdrop-blur-none'))
    assert.match(s, /prefers-reduced-transparency:reduce\)\]:backdrop-blur-none/, `${v.id} ${h}: reduced-transparency fallback`)
})

// 리뷰 I2: S1 — 단계가 오를수록 가장 먼 층의 오프셋·블러는 커지고 가장 진한 층의 불투명도는 낮아진다. 층 안에서도 멀수록 옅다.
test('S1 opacity falls while offset and blur rise with elevation', () => {
  const layers = (s) => [...s.matchAll(/(-?\d+)px_(\d+)px_(\d+)px_color-mix\(in_oklch,var\(--sh\)_(\d+)%/g)].map((m) => ({ x: +m[1], y: +m[2], blur: +m[3], a: +m[4] }))
  const LEVEL = ['cn-card-shadow', 'cn-dropdown-menu-content-shadow', 'cn-dropdown-menu-sub-content-shadow', 'cn-sheet-content-shadow', 'cn-dialog-content-shadow']
  const per = LEVEL.map((h) => layers(mapOf.S1[h]))
  for (const [i, ls] of per.entries()) {
    assert.ok(ls.length >= 4 && ls.length <= 6, `level ${i + 1}: ${ls.length} layers`)
    for (let k = 1; k < ls.length; k++) { assert.ok(ls[k].y > ls[k - 1].y && ls[k].blur > ls[k - 1].blur, `level ${i + 1} layer ${k}: grows`); assert.ok(ls[k].a < ls[k - 1].a, `level ${i + 1} layer ${k}: fades`) }
    assert.ok(ls.every((l) => l.x >= 0 && l.x <= l.y / 2), `level ${i + 1}: light from above, slightly left`)
  }
  // 모든 S1 훅은 다섯 단계 중 하나와 똑같다(한 훅만 진해지는 변이도 잡는다).
  const sig = (ls) => JSON.stringify(ls), known = new Set(per.map(sig))
  for (const [h, s] of Object.entries(mapOf.S1)) assert.ok(known.has(sig(layers(s))), `${h}: not one of the 5 elevation levels`)
  for (let i = 1; i < per.length; i++) {
    const [p, q] = [per[i - 1], per[i]], max = (ls, k) => Math.max(...ls.map((l) => l[k]))
    assert.ok(max(q, 'y') > max(p, 'y') && max(q, 'blur') > max(p, 'blur'), `level ${i + 1}: offset and blur rise`)
    assert.ok(max(q, 'a') < max(p, 'a'), `level ${i + 1}: opacity falls`)
  }
})

// 판정(행간): 한국어 설명·문단 훅은 행간 1.6 이상(DESIGN §2). 한 줄 UI 글자(표 칸·라벨·버튼·배지)는 제외.
export const DESCRIPTION_HOOKS = /^cn-[a-z-]*-description$|^cn-accordion-content$/
const leadOf = (s) => { for (const t of tokens(s).reverse()) { const u = utilOf(t); const m = u.match(/^leading-(relaxed|loose|\[(\d+(?:\.\d+)?)\]|(\d+))$/) ?? u.match(/^text-[a-z0-9]+\/(relaxed|loose)$/); if (m) return m[1] === 'relaxed' ? 1.625 : m[1] === 'loose' ? 2 : m[2] ? +m[2] : (+m[3] * 4) / 14; if (/^leading-/.test(u)) return 0 } return 0 }
test('description and paragraph hooks keep Korean line-height ≥ 1.6 (base and every value)', () => {
  const bad = []
  for (const [label, map] of [['base', base], ...values.map((v) => [v.id, mapOf[v.id]])]) for (const [h, s] of Object.entries(map))
    if (DESCRIPTION_HOOKS.test(h) && leadOf(s) < 1.6) bad.push(`${label} ${h}: ${s}`)
  assert.deepEqual(bad, [])
  assert.ok(Object.keys(base).filter((h) => DESCRIPTION_HOOKS.test(h)).length >= 12)
  assert.equal(leadOf('text-sm leading-normal'), 0) // 음성 대조: 1.5 는 통과 못 한다
})

test('gallery cache key is a stable hash of its inputs; companions stay compatible', async () => {
  const { inputsHash, COMPANIONS } = await import('./gen-axes-gallery.mjs')
  const h = inputsHash()
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.equal(inputsHash(), h)
  const byId = Object.fromEntries(values.map((v) => [v.id, v]))
  for (const [id, withIds] of Object.entries(COMPANIONS))
    assert.deepEqual(checkCompat(Object.fromEntries([id, ...withIds].map((x) => [byId[x].axis, x]))), [], `${id} + ${withIds}`)
  assert.deepEqual(COMPANIONS.S2, ['C2', 'R0'])
  assert.deepEqual(COMPANIONS.S3, ['C3', 'R1'])
})

test('grouped-button width floor is a component rule (ruling c3)', () => {
  assert.ok(ruleClasses(src['button.tsx']).has('in-data-[slot=button-group]:min-w-11'))
  for (const v of values.filter((x) => x.axis === 'button')) assert.doesNotMatch(Object.values(mapOf[v.id]).join(' '), /min-w-11/, `${v.id}: floor belongs to the component`)
})

test('compat families match the radius each value actually draws', () => {
  const radiusOf = (s) => tokens(s).filter((t) => /^rounded(-[a-z]+)?-/.test(t)).map((t) => t.replace(/^rounded(-[a-z]+)?-/, ''))
  const zero = { B1: 'cn-button', I3: 'cn-input', C2: 'cn-card', H3: 'cn-navigation-menu', C6: 'cn-card', C8: 'cn-card' }
  for (const [id, h] of Object.entries(zero)) assert.deepEqual([...new Set(radiusOf(mapOf[id][h]))], ['none'], id)
  const large = { B4: 'cn-button', I4: 'cn-input', C4: 'cn-card', C5: 'cn-card', H2: 'cn-navigation-menu' }
  // 반경을 그리는 값은 모두 계열에 든다(리뷰 M9).
  const families = new Set(Object.values(COMPAT.families).flat())
  const drawsRadius = (id) => ['S2', 'S3'].includes(id) || Object.values(mapOf[id]).some((s) => tokens(s).some((t) => ROUND.test(utilOf(t)) && !/-none!?$/.test(utilOf(t))))
  for (const v of values) if (drawsRadius(v.id)) assert.ok(families.has(v.id), `${v.id} draws a radius but has no family`)
  assert.ok(families.has('C5') && families.has('H4'))
  for (const [id, h] of Object.entries(large)) assert.ok(radiusOf(mapOf[id][h]).some((r) => r === 'full' || Number(r.match(/\[(\d+)px\]/)?.[1]) >= 16), id)
  // 브루탈 한 벌은 호환, 섞으면 걸린다.
  assert.deepEqual(checkCompat({ button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0', shadow: 'S2' }), [])
})

test('mono axes set font-mono only on numeric/code content, never on Korean text-bearing hooks (T7-I1)', () => {
  for (const v of values) assert.deepEqual(monoOnText(mapOf[v.id]), [], v.id)
  assert.deepEqual(monoOnText(base), [], 'base')
  // 숫자 자리는 남아 있다: I3 숫자 입력, T4 data-numeric 셀.
  assert.match(mapOf.I3['cn-input'], /\[&\[inputmode=decimal\]\]:font-mono/)
  assert.match(mapOf.T4['cn-table-cell'], /data-numeric:font-mono/)
  for (const h of ['cn-table', 'cn-table-head', 'cn-table-caption']) assert.doesNotMatch(mapOf.T4[h] ?? '', /(^|\s)font-mono/, h)
  for (const h of ['cn-textarea', 'cn-native-select', 'cn-select-trigger', 'cn-input-group']) assert.doesNotMatch(mapOf.I3[h] ?? '', /font-mono/, h)
  for (const h of ['cn-navigation-menu-link', 'cn-navigation-menu-trigger-style']) assert.doesNotMatch(mapOf.H3[h] ?? '', /font-mono/, h)
})

test('mono check catches plain or wrongly-scoped font-mono on a text hook (negative control)', () => {
  const bad = createStyleMap('.cn-table { @apply font-mono; } .cn-textarea { @apply md:font-mono; } .cn-table-cell { @apply data-numeric:font-mono; } .cn-kbd { @apply font-mono; }')
  assert.deepEqual(monoOnText(bad), ['cn-table font-mono', 'cn-textarea md:font-mono'])
})

// ── Task 16a: 새 축 값(C6·C8·H5·R3·D·X) ──
test('Task 16a family isolation: display·texture hooks are their own families; a D value touching a card hook is caught (negative control)', () => {
  assert.equal(axisOfHook('cn-display-title'), 'display')
  assert.equal(axisOfHook('cn-texture'), 'texture')
  const bad = createStyleMap('.cn-display-title { @apply text-9xl; } .cn-card { @apply rounded-none; } .cn-texture { @apply opacity-50; }')
  assert.deepEqual(outOfFamily('display', bad), ['cn-card', 'cn-texture'])
  assert.deepEqual(outOfFamily('texture', bad), ['cn-display-title', 'cn-card'])
  for (const id of ['D1', 'D2', 'D3']) assert.deepEqual(Object.keys(mapOf[id]), ['cn-display-title'], id)
  for (const id of ['X0', 'X1', 'X2', 'X3']) assert.deepEqual(Object.keys(mapOf[id]), ['cn-texture'], id)
})

test('R3 organic: controls and surfaces are exactly R1; only image-mask hooks (avatar) get the blob radius', () => {
  const diff = Object.keys(mapOf.R3).filter((h) => mapOf.R3[h] !== mapOf.R1[h])
  assert.deepEqual(diff.sort(), ['cn-avatar', 'cn-avatar-fallback', 'cn-avatar-image'])
  for (const h of diff) assert.match(mapOf.R3[h], /rounded-\[42%_58%_63%_37%\/41%_44%_56%_59%\]/, h)
  for (const h of ['cn-button', 'cn-checkbox', 'cn-switch', 'cn-tabs-trigger', 'cn-badge']) if (mapOf.R3[h]) assert.doesNotMatch(mapOf.R3[h], /%_/, `${h}: blob on a control`)
})

test('C6 bold-border colour card: 3px ink border, accent fill through card variables, zero radius; C8 comic cut: 4px ink border', () => {
  const c6 = mapOf.C6['cn-card']
  for (const t of ['border-[3px]', 'border-foreground', 'rounded-none', '[--card:var(--accent)]', '[--card-foreground:var(--accent-foreground)]', '[--muted-foreground:var(--accent-foreground)]']) assert.ok(c6.split(/\s+/).includes(t), t)
  const c8 = mapOf.C8['cn-card']
  for (const t of ['border-4', 'border-foreground', 'rounded-none']) assert.ok(c8.split(/\s+/).includes(t), t)
  assert.doesNotMatch(Object.values(mapOf.C8).join(' '), /bubble|--card:/, 'C8 has no speech-bubble shape and no fill swap')
})

test('D2 oversized sits in 10~20vw with a 44px floor; D3 moves only under motion-safe (static with reduced motion); every D value keeps words whole (part rule)', () => {
  const size = (id) => mapOf[id]['cn-display-title'].match(/text-\[clamp\(([\d.]+)rem,([\d.]+)vw,([\d.]+)rem\)\]/)
  const d2 = size('D2')
  assert.ok(d2 && +d2[2] >= 10 && +d2[2] <= 20 && +d2[1] * 16 >= 44, 'D2 clamp')
  assert.ok(+d2[2] * 14.4 >= 144 && +d2[2] * 14.4 <= 288, 'D2 at 1440px is 10~20vw')
  const d3 = mapOf.D3['cn-display-title'].split(/\s+/)
  const moving = d3.filter((t) => /(^|:)(transition|duration|ease|starting)/.test(t))
  assert.ok(moving.length >= 4 && moving.every((t) => t.startsWith('motion-safe:')), moving.join(' '))
  for (const id of ['D1', 'D2', 'D3']) assert.doesNotMatch(mapOf[id]['cn-display-title'], /overflow-|truncate|line-clamp|clip/, id)
  assert.ok(ruleClasses(src['display.tsx']).has('[overflow-wrap:anywhere]') && ruleClasses(src['display.tsx']).has('break-keep'))
})

test('X values only set --wf-texture-* variables (the part draws the layers); X1 grain opacity 0.03~0.06, X2 ≤ 0.08; X0 draws nothing', () => {
  // P3-6 사진 질감(X4~X8)은 변수 이름에 하이픈(a-wash-flow)이 들고 overlay·투명도 줄이기·대비 높이기 변형 아래의 변수도 정한다 — 그래도 변수 설정만이다.
  for (const id of ['X0', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']) for (const t of mapOf[id]['cn-texture'].split(/\s+/)) assert.match(t, /^((dark|contrast-more|data-\[overlay\]|\[@media\(prefers-reduced-transparency:reduce\)\]):)?\[--wf-texture-[ab]-[a-z-]+:.+\]$/, `${id} ${t}`)
  const op = (id) => Number(mapOf[id]['cn-texture'].match(/\[--wf-texture-b-opacity:([\d.]+)\]/)?.[1])
  assert.ok(op('X1') >= 0.03 && op('X1') <= 0.06, 'X1 opacity')
  assert.ok(op('X2') <= 0.08, 'X2 opacity')
  assert.match(mapOf.X0['cn-texture'], /--wf-texture-b-display:none/)
  assert.match(mapOf.X0['cn-texture'], /--wf-texture-a-display:none/)
  // 무늬는 음수 z 로 내용 뒤에 — 부품 규칙
  assert.match(src['texture.tsx'], /before:\[z-index:var\(--wf-texture-b-z,-1\)\]/)
  assert.match(src['texture.tsx'], /after:\[z-index:var\(--wf-texture-a-z,-1\)\]/)
  // 새 변수의 기본값은 예전 모양(X0~X3 의 그림이 그대로) — 기본값 없이 var() 만 쓰면 값을 안 정한 레시피의 구획이 깨진다.
  for (const d of ['b-radius,0', 'b-shadow,none', 'a-inset,0', 'a-radius,0', 'a-shadow,none', 'a-backdrop,none']) assert.ok(src['texture.tsx'].includes(`var(--wf-texture-${d})`), d)
  // 사진 질감의 뒤 흐림은 고정·스티키·오버레이(overlay prop)에서만 — X7·X8 의 흐림 변수는 data-[overlay] 변형 아래에서만 정해진다.
  for (const id of ['X7', 'X8']) {
    const ts = mapOf[id]['cn-texture'].split(/\s+/)
    assert.ok(!ts.some((t) => /^\[--wf-texture-a-backdrop:/.test(t)), `${id}: 흐르는 구획에 뒤 흐림이 걸린다`)
    assert.ok(ts.some((t) => /^data-\[overlay\]:\[--wf-texture-a-backdrop:/.test(t)), `${id}: overlay 에서 뒤 흐림이 없다`)
    const blur = Number(mapOf[id]['cn-texture'].match(/\[--wf-texture-a-blur:blur\(([\d.]+)px\)/)?.[1])
    assert.ok(blur > 0 && blur <= 20, `${id}: 블러 ${blur}px (허용 조건 4 ≤ 20)`)
    const solid = Number(mapOf[id]['cn-texture'].match(/\[--wf-texture-a-wash-solid:(\d+)%\]/)?.[1])
    assert.ok(solid >= 92, `${id}: overlay 글자 면 ${solid}% (허용 조건 3 ≥ 92)`)
    for (const reduce of ['[@media(prefers-reduced-transparency:reduce)]:[--wf-texture-a-blur:none]', 'contrast-more:[--wf-texture-a-blur:none]']) assert.ok(ts.includes(reduce), `${id}: ${reduce} 없음 (허용 조건 5)`)
  }
  // 골판지 X4~X6 은 뒤 흐림이 없다.
  for (const id of ['X4', 'X5', 'X6']) assert.doesNotMatch(mapOf[id]['cn-texture'], /backdrop|blur/, id)
})
