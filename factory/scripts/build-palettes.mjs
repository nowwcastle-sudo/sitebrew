// 색 팔레트 레퍼런스 references/palettes/palettes.json 을 만든다(P3-1 Task 0, DESIGN §5-A).
// 입력(저장소 밖 선택 자료, 기본 $WF_DESIGN_RULES_DIR/factory/palettes — 없으면 한 줄 알리고 종료 0, 기존 palettes.json 은 그대로): palettes.jsonl(SNS 186) · dataset-uupm.jsonl(ui-ux-pro-max colors.csv 192행).
// 재료 등록분(P3-2 Task 15m, 2026-09-29): materials/palettes/registered.jsonl(Colorhunt·Awwwards·Coolors·트렌드 기사·SNS 454) —
// 측정·역할·금지·순위까지 끝난 행이라 그대로 싣는다(`batch: "materials-2026-09-29"`). 만드는 법은 README 「재료 등록분」.
// 레시피 분해분(P3-2 Task 16a, J5): references/palettes/recipe-derived.json(style-presets.mjs 가 라이브러리 레시피 머리에서 만든다 — gen:all 의 build-presets)
// 의 팔레트를 그대로 싣는다(source "recipe:<id>"). palettes.json 을 손으로 고치면 다음 빌드가 지우므로 이 입력 파일로만 넣는다.
// 보라 금지 확대(Task 16a, 컨트롤러 판정 23:08): 주색이 색상각 265~300°·C > 0.15 이면 기존 SNS·데이터셋 팔레트에도 ai-tell-violet(decor-only).
// 라이브러리 레시피에서 온 팔레트(source "recipe:<id>")만 뺀다 — 레시피 쪽 판정은 style-presets.mjs recipePalette 가 같은 bansOf(exemptViolet)로 한다.
// 원천이 저장소 밖이라 gen:all 에 넣지 않는다 — 다시 만드는 법은 references/palettes/README.md.
// 사용: node factory/scripts/build-palettes.mjs [--src <폴더>] [--materials <jsonl>|none] [--recipes <json>|none] [--out <파일>]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { absentNote, designRulesPath, skipAndExit } from '../lib/design-rules.mjs'
import { hexToOklch, hueDist, ACCENT_C } from './lib/palette-lib.mjs'
import { ratio } from './lib/contrast-lib.mjs'
import { tailwindCopy, isCreamBackground, hueGroups, isAiTellViolet, MAX_HUE_GROUPS, DATA_LIGHT_BG_L, BG_MAX_C, SURFACE_MAX_C } from './lib/palette-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const WEIGHT = { sns: 0.2, dataset: 0.6 }
export const ROLE_KEYS = ['background', 'foreground', 'primary', 'primary-foreground', 'accent', 'muted', 'border']
export const BANS = ['brand-derived', 'cream-background', 'accent-hue-groups', 'tailwind-default', 'ai-tell-violet']

const round = (lch) => [+lch[0].toFixed(4), +lch[1].toFixed(4), +lch[2].toFixed(1)]
const color = (hex) => { const h = hex.replace(/^#/, '').toUpperCase(); const exact = hexToOklch(h); return { hex: '#' + h, oklch: round(exact), exact } }
const css = (c) => `oklch(${c.oklch[0]} ${c.oklch[1]} ${c.oklch[2]})`
// 대비는 저장하는 반올림 oklch 로 잰다(palettes.test.mjs 가 같은 값으로 다시 잰다).
const contrast = (a, b) => +ratio(css(a), css(b)).toFixed(2)
const L = (c) => c.exact[0], C = (c) => c.exact[1], H = (c) => c.exact[2]
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const by = (arr, f) => [...arr].sort((a, b) => f(a) - f(b))[0]
const bgOk = (c) => C(c) <= BG_MAX_C
const surfaceOk = (c) => C(c) <= SURFACE_MAX_C

// 실존 브랜드에서 따온 팔레트(리뷰 I1): 원천 이름의 「Inspired」·괄호 속 브랜드·스튜디오, 수집 메모의 브랜드 파생·실제 브랜드 아이덴티티.
// 이름은 저장소에 싣지 않고 표시만 남긴다.
export const isBrandDerived = (r) => /\bInspired\b/.test(r.name ?? '') || /\(.+\)/.test(r.name ?? '') || /brand-derived|real brand identit/i.test(r.notes ?? '')

// ── 역할 배정 ─────────────────────────────────────────────────────────────
// 바탕 후보는 C ≤ 0.04, muted·border 후보는 C ≤ 0.06(리뷰 I3). 바탕 후보가 없으면 assignRoles 는 needsBackground 를 돌려주고
// snsPalettes 가 팔레트 밖 바탕을 더한다(아래 「바탕 보강」, pal-01).
// 2색: 밝은 쪽 → background(게시글이 바탕을 적었으면 그것), 다른 쪽 → foreground, 채도 높은 쪽 → primary, 나머지 → primary-foreground.
// 3색 이상: 게시글이 적은 역할(role_hint)을 먼저 쓰고, 나머지는 pal-07 자동 배정 — 가장 밝음 → background, 바탕 대비 가장 큼 → foreground,
// 채도 가장 높음 → primary, 주색과 45° 넘게 떨어진 강조 → accent, 바탕과 명도가 가까운 색 → muted, 바탕·글자 중간 명도 → border.
const HINT = {
  primary: /\bprimary\b/,
  background: /background|backdrop|negative space|canvas/,
  surface: /surface/,
  anchor: /anchor|base|foundation|dark|ground/,
  accent: /accent|highlight|glow|key message/,
}
const hint = (c) => (c.hint ?? '').toLowerCase()
const NEEDS_BG = { roles: null, source: null, needsBackground: true }

function pairRoles(cols) {
  const bg = cols.find((c) => HINT.background.test(hint(c))) ?? by(cols, (c) => -L(c))
  if (!bgOk(bg)) return NEEDS_BG
  const fg = cols.find((c) => c !== bg)
  const primary = by(cols, (c) => -C(c))
  return { roles: { background: bg, foreground: fg, primary, 'primary-foreground': primary === bg ? fg : bg }, source: 'pair' }
}

export function assignRoles(cols) {
  if (cols.length < 2) return { roles: null, source: null }
  if (cols.length === 2) return pairRoles(cols)
  const taken = new Set()
  const free = () => cols.filter((c) => !taken.has(c.hex))
  const take = (c) => { if (c) taken.add(c.hex); return c }
  const roles = {}
  roles.primary = take(cols.find((c) => HINT.primary.test(hint(c))))
  roles.background = take(by(free().filter((c) => HINT.background.test(hint(c)) && bgOk(c)), (c) => -L(c)))
    ?? take(by(free().filter((c) => HINT.surface.test(hint(c)) && L(c) >= 0.5 && bgOk(c)), (c) => -L(c)))
  roles.foreground = take(by(free().filter((c) => HINT.anchor.test(hint(c)) && L(c) < 0.5), (c) => L(c)))
  const accentLike = free().filter((c) => HINT.accent.test(hint(c))).sort((a, b) => C(b) - C(a))
  if (!roles.background) roles.background = take(by(free().filter(bgOk), (c) => -L(c)))
  if (!roles.background) return NEEDS_BG
  if (!roles.foreground) roles.foreground = take(by(free(), (c) => -contrast(c, roles.background)))
  if (!roles.primary) roles.primary = take(accentLike.find((c) => !taken.has(c.hex)) ?? by(free(), (c) => -C(c)))
  if (!roles.primary) return { roles: null, source: null }
  roles.accent = take(accentLike.find((c) => !taken.has(c.hex))
    ?? by(free().filter((c) => C(c) >= ACCENT_C && hueDist(H(c), H(roles.primary)) > 45), (c) => -C(c)))
  roles.muted = take(by(free().filter((c) => surfaceOk(c) && Math.abs(L(c) - L(roles.background)) <= 0.2), (c) => Math.abs(L(c) - L(roles.background))))
  const mid = (L(roles.background) + L(roles.foreground)) / 2
  roles.border = take(by(free().filter(surfaceOk), (c) => Math.abs(L(c) - mid)))
  roles['primary-foreground'] = contrast(roles.background, roles.primary) >= contrast(roles.foreground, roles.primary) ? roles.background : roles.foreground
  return { roles, source: cols.some((c) => c.hint) ? 'post+pal-07' : 'pal-07' }
}

// ── 바탕 보강(pal-01 「못 채우면 팔레트 밖의 짙은 닻색이나 밝은 면색을 더해 채운다」, 2026-09-27 컨트롤러 판정) ──
// 바탕 후보(C ≤ 0.04)가 없을 때 팔레트 밖 바탕을 하나 더한다. colors[] 에는 넣지 않고 added.background 에 둔다.
// 밝은 면: oklch(0.975, min(0.010, 가장 밝은 색 C), 가장 밝은 색 H) — 팔레트 색이 글자(가장 어두운 색)·주색·강조가 된다.
// 짙은 닻: 가장 어두운 색 L ≤ 0.25 이고 색 과반이 L ≥ 0.6(어두운 바탕 위 밝은 색으로 읽히는 팔레트)이면
//          oklch(0.16, min(0.012, 가장 어두운 색 C), 가장 어두운 색 H)도 후보 — 글자는 가장 밝은 색.
// 둘 다 후보면 use 판정식을 통과하는 쪽, 같으면 fg/bg 대비가 큰 쪽(snsPalettes). 바탕 C ≤ 0.012 라 크림 금지에 걸리지 않는다.
export const ADDED_LIGHT = { L: 0.975, maxC: 0.010 }
export const ADDED_DARK = { L: 0.16, maxC: 0.012 }
const synthetic = (lch) => {
  const o = round(lch)
  return { hex: `oklch(${o[0]} ${o[1]} ${o[2]})`, oklch: o, exact: o }
}
export function augmentVariants(cols) {
  const lightest = by(cols, (c) => -L(c)), darkest = by(cols, (c) => L(c))
  const variants = [['light', synthetic([ADDED_LIGHT.L, Math.min(ADDED_LIGHT.maxC, C(lightest)), H(lightest)]), darkest]]
  if (L(darkest) <= 0.25 && cols.filter((c) => L(c) >= 0.6).length > cols.length / 2)
    variants.push(['dark', synthetic([ADDED_DARK.L, Math.min(ADDED_DARK.maxC, C(darkest)), H(darkest)]), lightest])
  return variants.map(([variant, background, foreground]) => {
    const rest = cols.filter((c) => c !== foreground)
    const primary = by(rest, (c) => -C(c))
    const accent = by(rest.filter((c) => c !== primary && C(c) >= ACCENT_C && hueDist(H(c), H(primary)) > 45), (c) => -C(c))
    const pf = contrast(background, primary) >= contrast(foreground, primary) ? background : foreground
    return { variant, roles: { background, foreground, primary, accent, 'primary-foreground': pf }, source: 'augmented' }
  })
}

// ── 금지 ─────────────────────────────────────────────────────────────────
// 브랜드 파생(I1) · pal-03 크림 바탕(바탕 L ≥ 0.6일 때) · pal-02 강조 색상 묶음 3개 이상 · pal-04 복사한 Tailwind 기본값(primary·accent).
export function bansOf({ roles, cols, brand, brandDerived, exemptViolet = false }) {
  const bans = [], detail = []
  if (brandDerived) { bans.push('brand-derived'); detail.push('실존 브랜드에서 따온 팔레트(이름은 싣지 않음)') }
  const bg = roles ? roles.background : by(cols.filter(bgOk), (c) => -L(c))
  if (bg && L(bg) >= DATA_LIGHT_BG_L && isCreamBackground(bg.exact)) { bans.push('cream-background'); detail.push(`background ${bg.hex} C ${C(bg).toFixed(3)} h ${H(bg).toFixed(0)}`) }
  const groups = hueGroups(brand.map((c) => c.exact))
  if (groups > MAX_HUE_GROUPS) { bans.push('accent-hue-groups'); detail.push(`강조 색상 묶음 ${groups}개`) }
  const tw = roles ? ['primary', 'accent'].filter((k) => roles[k]).map((k) => [k, roles[k], tailwindCopy(roles[k].exact)]).filter((x) => x[2]) : []
  if (tw.length) { bans.push('tailwind-default'); for (const [k, c, t] of tw) detail.push(`${k} ${c.hex} ≈ ${t.name} ${t.hex} (${t.dist.toFixed(4)})`) }
  if (!exemptViolet && roles?.primary && isAiTellViolet(roles.primary.exact)) { bans.push('ai-tell-violet'); detail.push(`primary ${roles.primary.hex} h ${H(roles.primary).toFixed(0)} C ${C(roles.primary).toFixed(3)} — AI 티 보라(265~300°, C > 0.15)`) }
  return { bans, detail }
}

function finish(p, { roles, source }, cols, brand, brandDerived = false) {
  const out = { ...p, role_source: roles ? source : null }
  if (brandDerived) out.brand_derived = true
  out.roles = null
  out.colors = cols.map(({ hex, oklch }) => ({ hex, oklch }))
  out.contrast = { fg_bg: null, primaryFg_primary: null }
  if (roles) {
    out.roles = Object.fromEntries(ROLE_KEYS.filter((k) => roles[k]).map((k) => [k, roles[k].hex]))
    out.contrast = { fg_bg: contrast(roles.foreground, roles.background), primaryFg_primary: contrast(roles['primary-foreground'], roles.primary) }
  }
  const { bans, detail } = bansOf({ roles, cols, brand, brandDerived })
  out.bans = bans
  if (detail.length) out.ban_detail = detail
  out.use = out.roles && out.contrast.fg_bg >= 7 && out.contrast.primaryFg_primary >= 4.5 && bans.length === 0 ? 'recipe' : 'decor-only'
  return out
}

const uniq = (list) => { const seen = new Map(); for (const c of list) if (!seen.has(c.hex)) seen.set(c.hex, c); return [...seen.values()] }

export function snsPalettes(rows) {
  const perPost = new Map()
  return rows.map((r) => {
    const segs = new URL(r.source_url).pathname.split('/').filter(Boolean)
    const post = slug(segs.at(-1))
    const key = `${r.platform}-${post}`
    perPost.set(key, (perPost.get(key) ?? 0) + 1)
    const cols = uniq(r.colors.map((c) => ({ ...color(c.hex), hint: c.role_hint })))
    const base = {
      id: `pal-sns-${slug(r.platform)}-${post}-${perPost.get(key)}`,
      source: { url: r.source_url, platform: r.platform, author: r.author, kind: r.owner_saved ? 'sns-owner' : 'sns' },
      weight: WEIGHT.sns, mood: r.mood ?? [], harmony: r.harmony,
    }
    const brandDerived = isBrandDerived(r)
    // 강조 묶음은 「강조」만 센다(리뷰 M2): 역할이 섰으면 바탕·글자 닻은 뺀다.
    const brandOf = (roles) => (roles ? cols.filter((c) => c !== roles.background && c !== roles.foreground) : cols)
    const assigned = assignRoles(cols)
    if (!assigned.needsBackground) return finish(base, assigned, cols, brandOf(assigned.roles), brandDerived)
    const tries = augmentVariants(cols).map((a) =>
      finish({ ...base, augmented: true, added: { background: a.roles.background.hex, variant: a.variant } }, a, cols, brandOf(a.roles), brandDerived))
    return tries.sort((x, y) => (y.use === 'recipe') - (x.use === 'recipe') || y.contrast.fg_bg - x.contrast.fg_bg)[0]
  })
}

export function datasetPalettes(rows) {
  const groups = new Map()
  for (const r of rows) {
    const key = JSON.stringify(Object.entries(r.roles).sort(([a], [b]) => a.localeCompare(b)))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.values()].map((g) => {
    const r = g[0]
    const cols = uniq(r.colors.map((c) => color(c.hex)))
    const get = (k) => (/^#[0-9a-f]{6}$/i.test(r.roles[k] ?? '') ? cols.find((c) => c.hex === r.roles[k].toUpperCase()) : undefined)
    const roles = Object.fromEntries(ROLE_KEYS.map((k) => [k, get(k)]).filter(([, c]) => c))
    const brand = uniq(['primary', 'secondary', 'accent', 'ring'].map(get).filter(Boolean))
    return finish({
      id: `pal-uupm-${r.id.split('-').at(-1)}`,
      source: { url: r.source_url, platform: r.platform, author: r.author, kind: 'dataset' },
      weight: WEIGHT.dataset, mood: r.mood ?? [], harmony: r.harmony,
      product_types: g.map((x) => x.product_type),
    }, { roles, source: 'dataset' }, cols, brand)
  })
}

// 읽기 쉬운 JSON: 색 하나를 한 줄로.
export const format = (pals) => JSON.stringify(pals, null, 2)
  .replace(/\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]/g, '[$1, $2, $3]')
  .replace(/\{\s+"hex": ("#[0-9A-F]{6}"),\s+"oklch": (\[[^\]]*\])\s+\}/g, '{ "hex": $1, "oklch": $2 }') + '\n'

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def }
  const src = opt('--src', designRulesPath('factory/palettes'))
  const outFile = opt('--out', join(ROOT, 'references', 'palettes', 'palettes.json'))
  const materials = opt('--materials', designRulesPath('factory/materials/palettes/registered.jsonl') ?? 'none')
  const recipes = opt('--recipes', join(ROOT, 'references', 'palettes', 'recipe-derived.json'))
  if (!src || !existsSync(join(src, 'palettes.jsonl'))) {
    skipAndExit(absentNote('팔레트 원천(factory/palettes)', 'palette sources (factory/palettes)'))
  }
  const read = (f) => readFileSync(join(src, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const readAbs = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const pals = [...snsPalettes(read('palettes.jsonl')), ...datasetPalettes(read('dataset-uupm.jsonl')), ...(materials === 'none' ? [] : readAbs(materials)), ...(recipes === 'none' ? [] : JSON.parse(readFileSync(recipes, 'utf8')).palettes)]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const ids = new Set(pals.map((p) => p.id))
  if (ids.size !== pals.length) { console.error('id 가 겹친다'); process.exit(1) }
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, format(pals))
  const count = (f) => pals.filter(f).length
  const kinds = ['sns-owner', 'sns', 'dataset', 'site']
  console.log(`재료 등록분(batch) ${count((p) => p.batch)} · recipe ${count((p) => p.batch && p.use === 'recipe')}`)
  const recipe = (p) => p.use === 'recipe'
  console.log(`팔레트 ${pals.length} · ${kinds.map((k) => `${k} ${count((p) => p.source.kind === k)}`).join(' · ')}`)
  console.log(`use recipe ${count(recipe)}(${kinds.map((k) => `${k} ${count((p) => recipe(p) && p.source.kind === k)}`).join(' · ')}) · decor-only ${count((p) => !recipe(p))}`)
  const owner = pals.filter((p) => p.source.kind === 'sns-owner')
  const posts = [...new Set(owner.map((p) => p.source.url))]
  const bgL = (p) => (p.augmented ? (p.added.variant === 'dark' ? 0.16 : 0.975) : p.colors.find((c) => c.hex === p.roles.background).oklch[0])
  console.log(`roles null ${count((p) => !p.roles)} · 2색 쌍 역할 ${count((p) => p.role_source === 'pair')}(recipe ${count((p) => p.role_source === 'pair' && recipe(p))}) · 바탕 보강 ${count((p) => p.augmented)}(밝은 면 ${count((p) => p.added?.variant === 'light')} · 짙은 닻 ${count((p) => p.added?.variant === 'dark')}, recipe ${count((p) => p.augmented && recipe(p))})`)
  console.log(`대표 저장 recipe(게시글별): ${posts.map((u) => `${u.split('/').filter(Boolean).at(-1)} ${owner.filter((p) => p.source.url === u && recipe(p)).length}/${owner.filter((p) => p.source.url === u).length}`).join(' · ')}`)
  console.log(`어두운 바탕(L < 0.4) recipe ${count((p) => recipe(p) && bgL(p) < 0.4)}`)
  for (const b of BANS) console.log(`ban ${b}: ${count((p) => p.bans.includes(b))}`)
  console.log(`레시피 분해분(source recipe:) ${count((p) => typeof p.source === 'string')} · recipe ${count((p) => typeof p.source === 'string' && recipe(p))}`)
}
