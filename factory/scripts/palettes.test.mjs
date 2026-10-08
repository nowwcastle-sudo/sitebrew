import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ratio } from './lib/contrast-lib.mjs'

const pals = JSON.parse(readFileSync(new URL('../../references/palettes/palettes.json', import.meta.url), 'utf8'))
const ok = (v) => `oklch(${v[0]} ${v[1]} ${v[2]})`

test('id가 유일하고 pal- 로 시작한다', () => {
  assert.equal(new Set(pals.map((p) => p.id)).size, pals.length)
  for (const p of pals) assert.match(p.id, /^pal-[a-z0-9-]+$/)
})
test('저장된 대비를 다시 계산해도 같다(±0.05)', () => {
  for (const p of pals.filter((q) => q.roles)) {
    const c = Object.fromEntries(p.colors.map((x) => [x.hex.toLowerCase(), ok(x.oklch)]))
    if (p.augmented) c[p.added.background.toLowerCase()] = p.added.background // 브리프 밖 한 줄: 보강 바탕(pal-01)은 colors[] 밖에 있다
    const r = ratio(c[p.roles.foreground.toLowerCase()], c[p.roles.background.toLowerCase()])
    assert.ok(Math.abs(r - p.contrast.fg_bg) <= 0.05, `${p.id}: ${r} vs ${p.contrast.fg_bg}`)
  }
})
test('use 판정식이 지켜진다', () => {
  for (const p of pals) {
    const recipe = !!p.roles && p.contrast.fg_bg >= 7 && p.contrast.primaryFg_primary >= 4.5 && p.bans.length === 0
    assert.equal(p.use, recipe ? 'recipe' : 'decor-only', p.id)
  }
})
test('운영자가 저장한 게시글 팔레트가 들어 있다', () => {
  assert.ok(pals.filter((p) => p.source.kind === 'sns-owner').length >= 6)
})

// ── 아래는 브리프 밖 추가: 금지 규칙(DESIGN §5-A)의 문턱과 데이터·lint 가 같은 판정을 쓰는지 ──
import { hexToOklch } from './lib/palette-lib.mjs'
import { tailwindCopy, isCreamBackground, hueGroups, parseOklch, DATA_LIGHT_BG_L, BG_MAX_C, SURFACE_MAX_C } from './lib/palette-rules.mjs'
import { isBrandDerived } from './build-palettes.mjs'

test('pal-04 distance boundary: violet-600 moved +0.0045 in L hits, +0.0055 misses', () => {
  const violet = hexToOklch('7C3AED')
  assert.equal(tailwindCopy(violet)?.name, 'violet-600')
  assert.equal(tailwindCopy([violet[0] + 0.0045, violet[1], violet[2]])?.name, 'violet-600')
  assert.equal(tailwindCopy([violet[0] + 0.0055, violet[1], violet[2]]), null)
  assert.equal(tailwindCopy([violet[0] + 0.01, violet[1], violet[2]]), null) // good-near-tailwind 과 같은 거리
})

test('pal-04 chroma boundary: next to teal-100 (C 0.0498), C 0.049 is out of scope and C 0.051 hits', () => {
  const teal = hexToOklch('CCFBF1')
  assert.ok(Math.abs(teal[1] - 0.05) < 0.001, `teal-100 C ${teal[1]}`)
  assert.equal(tailwindCopy([teal[0], 0.049, teal[2]]), null) // 거리 약 0.0008 이지만 C < 0.05
  assert.equal(tailwindCopy([teal[0], 0.051, teal[2]])?.name, 'teal-100') // 거리 약 0.0012, C ≥ 0.05
})

test('pal-04: greys and pale tints near the dense default scale are out of scope (r1-measure ramp)', () => {
  // r1-measure 의 옅은 램프 색(0.02 문턱에서는 걸렸다): zinc-200·blue-100·sky-950 옆.
  for (const lch of [[0.92, 0.01, 255], [0.925, 0.035, 255], [0.3, 0.05, 255], [0.93, 0.04, 255]]) assert.equal(tailwindCopy(lch), null, lch.join(' '))
  assert.equal(tailwindCopy(hexToOklch('F1F5F9')), null) // slate-100 그대로라도 C < 0.05 면 대상 밖
})

test('pal-03: a warm background with C > 0.012 is cream at any lightness; cool or low-chroma ones are not', () => {
  assert.equal(isCreamBackground([0.97, 0.02, 80]), true)
  assert.equal(isCreamBackground([0.82, 0.05, 80]), true) // 모래·황갈 바탕도 lint 에서 잡힌다(리뷰 M1)
  assert.equal(isCreamBackground([0.97, 0.012, 80]), false)
  assert.equal(isCreamBackground([0.97, 0.02, 230]), false)
})

test('brand-derived detection: "Inspired", a brand in parentheses, or collect notes naming real brands', () => {
  assert.equal(isBrandDerived({ name: 'Acme Inspired', notes: '' }), true)
  assert.equal(isBrandDerived({ name: 'Cafe (studio.handle)', notes: '' }), true)
  assert.equal(isBrandDerived({ name: 'Pine Shadow', notes: 'Real brand identities (packaging, menus, signage).' }), true)
  assert.equal(isBrandDerived({ name: 'Pine Shadow', notes: 'Brand-derived palettes.' }), true)
  assert.equal(isBrandDerived({ name: 'Luxury & Elegant', notes: 'use: high-end branding' }), false)
})

test('palettes.json bans agree with the shared rules (brand-derived · pal-02·03·04)', () => {
  // 레시피 분해분(source "recipe:<id>")의 금지는 레시피 머리의 oklch 값으로 판정한다(style-presets recipePalette → bansOf) — 같은 입력(저장한 colors[].oklch)으로 다시 잰다.
  // 다른 팔레트는 원천이 hex 라 hex 로 잰다. (r12-spectrum B 주색 oklch(0.42 0.10 172) = #005E47 은 hex 로 되돌리면 Tailwind emerald-800 과 0.0047 — 문턱 0.005 안쪽이지만 원래 값은 밖이다.)
  const byHex = (p) => Object.fromEntries(p.colors.map((c) => [c.hex, typeof p.source === 'string' ? c.oklch : hexToOklch(c.hex.slice(1))]))
  for (const p of pals) {
    assert.equal(p.bans.includes('brand-derived'), p.brand_derived === true, p.id)
    if (!p.roles) continue
    const lch = byHex(p)
    const tw = ['primary', 'accent'].some((k) => p.roles[k] && tailwindCopy(lch[p.roles[k]]))
    assert.equal(p.bans.includes('tailwind-default'), tw, p.id)
    const bg = p.augmented ? parseOklch(p.added.background) : lch[p.roles.background]
    assert.equal(p.bans.includes('cream-background'), bg[0] >= DATA_LIGHT_BG_L && isCreamBackground(bg), p.id)
    // 강조 묶음은 바탕·글자 닻을 빼고 센다(리뷰 M2). 데이터셋은 primary·secondary·accent·ring 이라 여기서는 SNS 만 다시 잰다.
    const accents = Object.entries(lch).filter(([hex]) => hex !== p.roles.background && hex !== p.roles.foreground).map(([, v]) => v)
    if (p.source.kind !== 'dataset') assert.equal(p.bans.includes('accent-hue-groups'), hueGroups(accents) >= 3, p.id)
  }
  const brand = pals.filter((p) => p.brand_derived && !p.batch)
  assert.equal(brand.length, 17)
  assert.ok(brand.every((p) => p.use === 'decor-only' && /dyyfwimcc2c|dlxtgeuswve/.test(p.id)), brand.map((p) => p.id).join(' '))
  // 재료 등록분(Task 15m): 수상 사이트 팔레트는 전부 brand-derived(컨트롤러 판정 1) — 금지 없는 판정은 use_without_brand_ban 에 기록만.
  const siteBrand = pals.filter((p) => p.brand_derived && p.batch)
  assert.ok(siteBrand.length > 0)
  for (const p of siteBrand) {
    assert.equal(p.source.platform, 'awwwards', p.id)
    assert.equal(p.use, 'decor-only', p.id)
    const rest = p.bans.filter((b) => b !== 'brand-derived')
    const wouldBe = p.contrast.fg_bg >= 7 && p.contrast.primaryFg_primary >= 4.5 && rest.length === 0 ? 'recipe' : 'decor-only'
    assert.equal(p.use_without_brand_ban, wouldBe, p.id)
  }
  assert.ok(pals.filter((p) => p.batch && p.source.platform === 'awwwards').every((p) => p.brand_derived), 'every award-site palette is brand-derived')
})

// ── 재료 등록분(P3-2 Task 15m, 2026-09-29) — batch "materials-2026-09-29" ──
import { isAiTellViolet } from './lib/palette-rules.mjs'

test('ids are sorted (build-palettes writes them in id order)', () => {
  const ids = pals.map((p) => p.id)
  assert.deepEqual(ids, [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
})

test('source is an object with a known kind, or "recipe:<id>" for palettes taken apart from a library recipe (J5, Task 16a)', () => {
  for (const p of pals) {
    if (typeof p.source === 'string') assert.match(p.source, /^recipe:[a-z0-9-]+$/, p.id)
    else assert.ok(['sns-owner', 'sns', 'dataset', 'site'].includes(p.source.kind), `${p.id} ${p.source.kind}`)
  }
})

test('ai-tell-violet: in the materials batch a primary at hue 265-300 with C > 0.15 is banned and decor-only (controller ruling 2)', () => {
  const batch = pals.filter((p) => p.batch)
  assert.ok(batch.length >= 150, `batch ${batch.length}`)
  let hits = 0
  for (const p of batch) {
    const prim = p.roles.primary.startsWith('#') ? hexToOklch(p.roles.primary.slice(1)) : parseOklch(p.roles.primary)
    const v = isAiTellViolet(prim)
    hits += v
    assert.equal(p.bans.includes('ai-tell-violet'), v, p.id)
    if (v) assert.equal(p.use, 'decor-only', p.id)
  }
  assert.ok(hits > 0)
  // 문턱 경계(양성·음성 대조): C 0.151 은 걸리고 0.15 는 안 걸린다, 색상각 264.9 는 밖이다.
  assert.equal(isAiTellViolet([0.55, 0.151, 280]), true)
  assert.equal(isAiTellViolet([0.55, 0.15, 280]), false)
  assert.equal(isAiTellViolet([0.55, 0.2, 264.9]), false)
  assert.equal(isAiTellViolet([0.55, 0.2, 300]), true)
})

test('ai-tell-violet extended to every palette (Task 16a, controller ruling 23:08): 32 older palettes, 1 of them was recipe; palettes from a library recipe are exempt', () => {
  const older = pals.filter((p) => !p.batch && typeof p.source !== 'string')
  const prim = (p) => (p.roles.primary.startsWith('#') ? hexToOklch(p.roles.primary.slice(1)) : parseOklch(p.roles.primary))
  const hits = older.filter((p) => isAiTellViolet(prim(p)))
  assert.equal(hits.length, 32)
  for (const p of older) assert.equal(p.bans.includes('ai-tell-violet'), isAiTellViolet(prim(p)), p.id)
  for (const p of hits) assert.equal(p.use, 'decor-only', p.id)
  assert.ok(hits.some((p) => p.id === 'pal-sns-instagram-de9uynfabjg-3'), 'the one former recipe palette')
  // 레시피 분해분은 보라 금지를 받지 않는다(라이브러리 레시피 자체는 바꾸지 않는다 — r2-signal A·r4-evidence B 가 규칙에 걸리지만 recipe 로 남는다).
  const lib = pals.filter((p) => typeof p.source === 'string')
  assert.ok(lib.length >= 10)
  for (const p of lib) assert.ok(!p.bans.includes('ai-tell-violet'), p.id)
  const libViolet = lib.filter((p) => ['light', 'dark'].some((t) => isAiTellViolet(parseOklch(p.theme[t].primary)))).map((p) => p.id)
  // r14-concrete B(강조 파랑 268° — 보드 A2 에서 운영자가 「좋다」로 고른 안)도 같은 범위다: 라이브러리 레시피 자체는 바꾸지 않으니 recipe 로 남는다.
  assert.deepEqual(libViolet, ['pal-recipe-r14-concrete-b', 'pal-recipe-r2-signal', 'pal-recipe-r4-evidence-b'])
  for (const id of libViolet) assert.equal(pals.find((p) => p.id === id).use, 'recipe', id)
})

test('recipe-derived palettes (J5): palettes.json carries references/palettes/recipe-derived.json unchanged (build-palettes --recipes input)', () => {
  const derived = JSON.parse(readFileSync(new URL('../../references/palettes/recipe-derived.json', import.meta.url), 'utf8')).palettes
  assert.ok(derived.length >= 10)
  for (const d of derived) assert.deepEqual(pals.find((p) => p.id === d.id), d, `${d.id} — palettes.json 이 낡았다: node factory/scripts/build-palettes.mjs`)
  assert.equal(pals.filter((p) => typeof p.source === 'string').length, derived.length)
})

test('materials batch rows carry evidence and a merged rank (merge_sources formula, 0..1)', () => {
  for (const p of pals.filter((q) => q.batch)) {
    assert.ok(Array.isArray(p.evidence) && p.evidence.length && p.evidence.every((e) => e.url && e.signal && e.type), p.id)
    assert.ok(typeof p.rank_score === 'number' && p.rank_score > 0 && p.rank_score < 1, `${p.id} ${p.rank_score}`)
    assert.equal(typeof p.rank_parts, 'object', p.id)
  }
})

test('roles respect the chroma caps (I3): background C ≤ 0.04, muted·border C ≤ 0.06; every palette gets roles', () => {
  for (const p of pals.filter((q) => q.roles && q.source.kind !== 'dataset' && !q.augmented)) {
    const c = (hex) => p.colors.find((x) => x.hex === hex).oklch[1]
    assert.ok(c(p.roles.background) <= BG_MAX_C + 1e-4, `${p.id} background`)
    for (const k of ['muted', 'border']) if (p.roles[k]) assert.ok(c(p.roles[k]) <= SURFACE_MAX_C + 1e-4, `${p.id} ${k}`)
  }
  assert.deepEqual(pals.filter((q) => !q.roles).map((q) => q.id), [])
})

test('pal-01 augmentation: palettes with no background candidate get an added background outside colors[]', () => {
  const aug = pals.filter((p) => p.augmented)
  assert.ok(aug.length > 0)
  for (const p of aug) {
    assert.equal(p.role_source, 'augmented', p.id)
    assert.equal(p.roles.background, p.added.background, p.id)
    assert.ok(!p.colors.some((c) => c.hex === p.added.background), p.id)
    // 원래 팔레트에는 바탕 후보(C ≤ 0.04)가 없었다 — 2색 쌍은 밝은 쪽만 바탕 후보다(I2).
    const exactC = (c) => hexToOklch(c.hex.slice(1))[1]
    const candidates = p.colors.length === 2 ? [p.colors.reduce((a, b) => (b.oklch[0] > a.oklch[0] ? b : a))] : p.colors
    assert.ok(candidates.every((c) => exactC(c) > BG_MAX_C), p.id)
    const [bl, bc, bh] = parseOklch(p.added.background)
    const Ls = p.colors.map((c) => c.oklch[0])
    const pick = (f) => p.colors.find((c) => c.oklch[0] === f(...Ls))
    if (p.added.variant === 'light') {
      assert.equal(bl, 0.975, p.id); assert.ok(bc <= 0.010 + 1e-9, p.id)
      assert.equal(bh, pick(Math.max).oklch[2], p.id)
      assert.equal(p.roles.foreground, pick(Math.min).hex, p.id)
    } else {
      assert.equal(p.added.variant, 'dark', p.id)
      assert.equal(bl, 0.16, p.id); assert.ok(bc <= 0.012 + 1e-9, p.id)
      assert.ok(Math.min(...Ls) <= 0.25 && Ls.filter((l) => l >= 0.6).length > Ls.length / 2, p.id)
      assert.equal(p.roles.foreground, pick(Math.max).hex, p.id)
    }
    const rest = p.colors.filter((c) => c.hex !== p.roles.foreground)
    assert.equal(p.colors.find((c) => c.hex === p.roles.primary).oklch[1], Math.max(...rest.map((c) => c.oklch[1])), p.id)
    assert.ok(!p.bans.includes('cream-background'), p.id)
  }
})

test('2-colour pairs get pair roles: lighter or post-named background, higher chroma primary, the other on it', () => {
  const pairs = pals.filter((p) => p.role_source === 'pair')
  assert.ok(pairs.length > 0)
  for (const p of pairs) {
    const [a, b] = p.colors
    const other = (hex) => (hex === a.hex ? b.hex : a.hex)
    assert.equal(p.roles.foreground, other(p.roles.background), p.id)
    assert.equal(p.roles.primary, (a.oklch[1] >= b.oklch[1] ? a : b).hex, p.id)
    assert.equal(p.roles['primary-foreground'], other(p.roles.primary), p.id)
  }
})

test('roles point at colors in the palette, and dataset duplicates keep every product type', () => {
  for (const p of pals.filter((q) => q.roles)) for (const hex of Object.values(p.roles))
    assert.ok(p.colors.some((c) => c.hex === hex) || (p.augmented && hex === p.added.background), `${p.id} ${hex}`)
  const ds = pals.filter((p) => p.source.kind === 'dataset')
  assert.equal(ds.length, 166)
  assert.equal(ds.reduce((t, p) => t + p.product_types.length, 0), 192)
})

// 순수 판정 두 개의 갈래를 모두 지난다(커버리지 래칫 — 레시피가 15벌로 늘며 V8 이 새 분기를 보고했다, 2026-10-11).
test('parseOklch reads plain and percent lightness and returns null for non-oklch input; isNeon needs high chroma, high lightness and a neon hue', async () => {
  const { isNeon } = await import('./lib/palette-rules.mjs')
  assert.deepEqual(parseOklch('oklch(0.62 0.18 145)'), [0.62, 0.18, 145])
  assert.deepEqual(parseOklch('oklch(62% 0.18 145)'), [0.62, 0.18, 145])
  assert.equal(parseOklch('#0f766e'), null)
  assert.equal(parseOklch(undefined), null)
  assert.equal(isNeon([0.8, 0.25, 140]), true, '형광 초록')
  assert.equal(isNeon([0.7, 0.22, 40]), true, '형광 주홍')
  assert.equal(isNeon([0.8, 0.1, 140]), false, '채도 낮음')
  assert.equal(isNeon([0.5, 0.25, 140]), false, '명도 낮음')
  assert.equal(isNeon([0.8, 0.25, 260]), false, '형광 색상각 밖')
})
