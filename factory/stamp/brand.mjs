// ③ 브랜드 입력 → 레시피 머리(P3-3 Task 4). directions.mjs 가 brief.brand 가 있을 때 ③ 칸에서 부른다(바탕 프리셋 = 새로움 최고 생성 후보의 프리셋).
//
//   brandToRecipeHead(brand: { colors?, fonts?, logo? }, basePreset, { archetype }?)
//     → { head, adjustments: { role, theme, from, to, reason, hueDelta }[], fontSubstitutions: { role, asked, used, reason }[] }
//     → 맞출 수 없으면 { blocked: 이유, adjustments, fontSubstitutions } (head 없음)
//
// 색(대표 판단 「명도만 조정」, Review Focus 3):
//  - 역할 배정: 채도 가장 높은 색 = 주색. 나머지 중 밝고(L ≥ 0.9) 무채에 가까운(C ≤ 0.04) 가장 밝은 색 = 바탕, 어두운(L ≤ 0.4) 가장 어두운 색 = 글자.
//    바탕·글자가 없으면 주색 색상각에 아주 옅게 물든 중립으로 채운다(브랜드 색이 아니라 기록하지 않는다).
//  - 두 테마를 derivePalette(프리셋 파생과 같은 코드)로 펼친 뒤, 브랜드 색이 들어가는 주색만 여기서 다시 맞춘다: 테마 바탕 위 4.5:1(link 글자·체크 채움 —
//    lint primary-surface), Tailwind 기본값 복사 피함, 질감(X1·X2) 무늬 위 4.5:1. OKLCH L 만 0.005 단위로 옮긴다.
//  - 「색조 변화」는 브라우저가 실제로 칠하는 색으로 잰다: L 만 옮긴 값이 sRGB 밖이면 채널이 잘리며 색조가 돈다(노랑을 어둡게 하면 올리브로 간다).
//    값은 잘린 뒤의 색(8비트)으로 적는다 — 적힌 값 = 화면 색이라 대비·색조를 한 번 잰 대로다. 그래서 여유는 렌더 반올림 몫 0.15 대신 0.05 다.
//  - 브랜드 주색이 그 테마에서 2° 넘게 돌아야만 맞으면 역할을 다시 배정한다: 주색은 다른 브랜드 색(바탕 색 제외 — 바탕과 같은 버튼은 보이지 않는다),
//    원래 주색은 강조색(accent — 강조 면·hover)으로 내린다. 대신할 브랜드 색도 없으면 blocked(이유에 「색조」).
//  - 보라 주색 금지(ai-tell-violet)는 레퍼런스 팔레트에만 건다. 고객 브랜드 색은 예외 — adjustments 에 적는다.
// 서체: fonts[0] = 제목(display), fonts[1] = 본문(body, 한글을 그려야 한다 — lint font-korean). 라이선스가 확인된 설치 가능한(폰트 키트) 서체만 쓴다.
//  아니면 references/fonts/fonts.json 의 같은 category·script 에서 rank_score 가 가장 높은 키트 서체로 바꾸고 기록한다. 범주를 모르면(레퍼런스에 없는 상용 서체)
//  바탕 프리셋의 제목 서체로 바꾸고 그 이유를 적는다.
// 로고: head.brand.logo 에 경로만 적는다. 파비콘은 Task 9(페이지 생성)가 만든다.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ratio } from '../scripts/lib/contrast-lib.mjs'
import { hexToOklch, hueDist, ACCENT_C } from '../scripts/lib/palette-lib.mjs'
import { parseOklch, tailwindCopy, isAiTellViolet, BG_MAX_C } from '../scripts/lib/palette-rules.mjs'
import { mixOklch, kitFont, isKorean, koreanEntry, loadBanlist, textureContrastProblems, TEXTURE_ALPHA } from '../scripts/recipe.mjs'
import { axisValue } from '../scripts/axes.mjs'
import { derivePalette, presetToRecipeHead, pickPalettes, hintPair, oklchToHex, css, FONTS_FILE } from '../scripts/style-presets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KIT_DIR = join(ROOT, 'registry', 'factory', 'fonts')
export const HUE_LIMIT = 2 // 도(°) — 이보다 더 돌아야 맞으면 그 색은 그 자리에 못 쓴다
const MARGIN = 0.05
const STEP = 0.005
const NEUTRAL_C = 0.02 // 이보다 채도가 낮으면 색조가 뜻이 없다(무채) — 색조 차이를 재지 않는다

const round = (x, d = 4) => Number(x.toFixed(d))
const cr = (a, b) => ratio(css(a), css(b))
// 화면에 칠해지는 색: OKLCH → sRGB(채널 자름) → 8비트 → OKLCH.
const render = (c) => hexToOklch(oklchToHex(css(c)).slice(1))
const hueDelta = (to, from) => (from[1] < NEUTRAL_C ? 0 : round(hueDist(to[2], from[2]), 2))

function parseColor(s) {
  if (typeof s !== 'string') return null
  const v = s.trim()
  let m = v.match(/^#([0-9a-f]{3})$/i)
  if (m) return hexToOklch(m[1].split('').map((x) => x + x).join(''))
  m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) return hexToOklch(m[1])
  if (/^oklch\(/i.test(v)) { try { return parseOklch(v) } catch { return null } }
  return null
}

// L 만 옮겨 ok(화면 색)가 참이 되는 가장 가까운 값. 바탕이 밝으면 어둡게, 어두우면 밝게.
function fitL(c, bg, ok) {
  const down = bg[0] >= 0.5
  for (let L = c[0]; down ? L >= 0 : L <= 1; L = round(L + (down ? -STEP : STEP))) {
    const x = render([L, c[1], c[2]])
    if (ok(x)) return x
  }
  return null
}

// 표면 위 글자: 후보를 순서대로 보고 minimum 을 넘는 첫 색, 없으면 L 만 옮긴 글자색.
function onColor(surface, cands, min) {
  const hit = cands.find((c) => cr(c, surface) >= min)
  if (hit) return hit
  return fitL(cands[0], surface, (x) => cr(x, surface) >= min) ?? cands[0]
}
const avoidTailwind = (c, bg) => {
  let x = c
  for (let i = 0; i < 8 && tailwindCopy(x); i++) x = render([round(x[0] + (bg[0] >= 0.5 ? -0.012 : 0.012)), x[1], x[2]])
  return x
}

// ── 서체 ────────────────────────────────────────────────────────────────
let refCache, kitCache
const refFonts = () => (refCache ??= JSON.parse(readFileSync(FONTS_FILE, 'utf8')).fonts)
const kitByFamily = () => (kitCache ??= new Map(readdirSync(KIT_DIR).filter((f) => /^font-[a-z0-9-]+\.json$/.test(f)).map((f) => {
  const k = JSON.parse(readFileSync(join(KIT_DIR, f), 'utf8'))
  return [String(k.title ?? '').toLowerCase(), { item: f.slice(0, -5), kit: k }]
})))
const kitItemOf = (ref) => ref.kitItem ?? (kitFont(`font-${ref.id}`) ? `font-${ref.id}` : null)
const licensed = (ref) => !ref.reject && ref.license?.commercial === true && ref.license?.webEmbedding === true
const banned = (family, role) => loadBanlist().fonts.find((b) => b.family.toLowerCase() === family.toLowerCase() && !b.untunedOnly && (!b.roles || b.roles.includes(role)))

function resolveDisplay(asked, base) {
  const key = asked.trim().toLowerCase()
  const ref = refFonts().find((f) => f.family.toLowerCase() === key)
  const kit = kitByFamily().get(key)
  const ban = banned(asked, 'display')
  if (!ban) {
    if (ref && licensed(ref) && kitItemOf(ref)) return { font: { family: ref.family, item: kitItemOf(ref) } }
    if (!ref && kit?.kit?.meta?.license) return { font: { family: kit.kit.title, item: kit.item } }
  }
  const why = ban ? `금지 목록: ${ban.why}`
    : ref && !licensed(ref) ? '라이선스 통과 기록이 없다(상업·웹 임베딩)'
    : ref ? '라이선스는 통과지만 폰트 키트 항목이 없어 설치할 수 없다'
    : kit ? '폰트 키트 항목에 라이선스 기록이 없다'
    : '라이선스를 확인할 수 없다 — references/fonts/fonts.json·폰트 키트에 없는 서체(상용 서체일 수 있다)'
  if (ref) {
    const pool = refFonts().filter((f) => f.id !== ref.id && f.category === ref.category && f.script === ref.script && licensed(f) && !f.aiOverused && kitItemOf(f) && !banned(f.family, 'display'))
      .sort((a, b) => (b.rank_score ?? 0.5) - (a.rank_score ?? 0.5) || (a.id < b.id ? -1 : 1))
    if (pool[0]) return { font: { family: pool[0].family, item: kitItemOf(pool[0]) }, sub: `${why} → 같은 범주(${ref.category})·문자(${ref.script}) 키트 서체 중 rank_score 1등(${pool[0].rank_score ?? 0.5})` }
    return { font: base, sub: `${why} → 같은 범주(${ref.category})·문자(${ref.script})의 설치 가능한 서체가 없어 바탕 프리셋 제목 서체` }
  }
  return { font: base, sub: `${why} → 범주를 알 수 없어 바탕 프리셋 제목 서체` }
}
function resolveBody(asked, base) {
  const e = koreanEntry(asked)
  if (isKorean(asked) && e?.item && kitFont(e.item) && !banned(asked, 'body')) return { font: { family: e.family ?? asked, item: e.item } }
  const why = !isKorean(asked) ? '본문은 한글을 그려야 한다(lint font-korean)' : banned(asked, 'body') ? `금지 목록: ${banned(asked, 'body').why}` : '한글 서체지만 폰트 키트 항목이 없어 설치할 수 없다'
  return { font: base, sub: `${why} → 바탕 프리셋 본문 서체` }
}
function brandFonts(asked, preset) {
  const fonts = structuredClone(hintPair(preset).fonts)
  const subs = []
  const list = (asked ?? []).filter((x) => typeof x === 'string' && x.trim())
  if (list[0]) { const r = resolveDisplay(list[0], fonts.display); fonts.display = r.font; if (r.sub) subs.push({ role: 'display', asked: list[0], used: r.font.family, reason: r.sub }) }
  if (list[1]) { const r = resolveBody(list[1], fonts.body); fonts.body = r.font; if (r.sub) subs.push({ role: 'body', asked: list[1], used: r.font.family, reason: r.sub }) }
  for (const x of list.slice(2)) subs.push({ role: 'unused', asked: x, used: null, reason: '세 번째 이후 서체는 쓰지 않는다(제목·본문 두 자리)' })
  return { fonts, subs }
}

// ── 색 ──────────────────────────────────────────────────────────────────
function assignRoles(cols) {
  const chroma = cols.filter((c) => c.lch[1] >= ACCENT_C).sort((a, b) => b.lch[1] - a.lch[1])
  const primary = chroma[0] ?? [...cols].filter((c) => c.lch[0] <= 0.6).sort((a, b) => a.lch[0] - b.lch[0])[0] ?? null
  const rest = cols.filter((c) => c !== primary)
  const background = rest.filter((c) => c.lch[0] >= 0.9 && c.lch[1] <= BG_MAX_C).sort((a, b) => b.lch[0] - a.lch[0])[0] ?? null
  const foreground = rest.filter((c) => c !== background && c.lch[0] <= 0.4).sort((a, b) => a.lch[0] - b.lch[0])[0] ?? null
  const accent = rest.filter((c) => c !== background && c !== foreground && c.lch[1] >= ACCENT_C).sort((a, b) => b.lch[1] - a.lch[1])[0] ?? null
  const unused = rest.filter((c) => ![background, foreground, accent].includes(c))
  return { primary, background, foreground, accent, unused }
}

export function brandToRecipeHead(brand = {}, basePreset, opts = {}) {
  if (!basePreset?.recipeHints) throw new Error('brandToRecipeHead: 바탕 프리셋(references/styles/presets.json 원소)이 없다')
  const adjustments = []
  const { fonts, subs: fontSubstitutions } = brandFonts(brand.fonts, basePreset)
  const blocked = (reason) => ({ blocked: reason, adjustments, fontSubstitutions })

  const raw = (brand.colors ?? []).filter((x) => x !== undefined && x !== null && x !== '')
  const bad = raw.filter((x) => !parseColor(x))
  if (bad.length) return blocked(`색 형식을 읽을 수 없다: ${bad.join(', ')} — #RGB·#RRGGBB·oklch(…)로 준다`)
  const cols = [...new Map(raw.map((x) => [oklchToHex(css(parseColor(x))), { input: x, lch: render(parseColor(x)) }])).values()]
  const roles = assignRoles(cols)
  const hints = basePreset.recipeHints
  const logic = hints.colorLogic?.[0] ?? 'K1'
  const axes = basePreset.axes ?? {}
  const id8 = createHash('sha1').update(JSON.stringify({ c: raw, f: brand.fonts ?? [], p: basePreset.id })).digest('hex').slice(0, 8)

  let theme
  if (roles.primary) {
    // 무채색(C < 0.02)의 색조는 뜻이 없다 — 흰색·검정의 H 0 이 파생 중립(다크 바탕 C ≥ 0.012)·섞은 면을 붉게 끌지 않게 주색 색조로 둔다.
    // 브랜드가 무채뿐이면 바탕 프리셋 첫 팔레트의 색조(주색, 없으면 바탕). 화면 색은 바뀌지 않는다.
    const hue = roles.primary.lch[1] >= NEUTRAL_C ? roles.primary.lch[2] : baseHue(basePreset)
    const tint = (c) => (c[1] < NEUTRAL_C ? [c[0], c[1], hue] : c)
    const pC = roles.primary.lch[1] >= ACCENT_C ? 1 : 0
    const bg = tint(roles.background?.lch ?? [0.985, 0.004 * pC, hue])
    const fg = tint(roles.foreground?.lch ?? [0.21, 0.012 * pC, hue])
    const palette = {
      roles: { background: css(bg), foreground: css(fg), primary: css(tint(roles.primary.lch)), ...(roles.accent ? { accent: css(roles.accent.lch) } : {}) },
      colors: cols.map((c) => ({ hex: oklchToHex(css(c.lch)) })),
    }
    const derived = derivePalette(palette, { colorLogic: logic, axes })
    theme = { light: {}, dark: {} }
    for (const t of ['light', 'dark']) {
      const T = Object.fromEntries(Object.entries(derived[t]).map(([k, v]) => [k, parseOklch(v)]))
      const r = fitTheme(t, T, roles, { axes, logic, adjustments, tint })
      if (r.blocked) return blocked(r.blocked)
      theme[t] = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, css(v)]))
    }
    // 브랜드가 준 바탕·글자가 라이트 테마에서 바뀌었으면(크림 바탕 채도 내림·7:1 명도) 적는다. 2° 넘게 돌면 멈춘다.
    for (const k of ['background', 'foreground']) {
      const src = roles[k]
      if (!src) continue
      const to = render(parseOklch(theme.light[k]))
      const d = hueDelta(to, src.lch)
      if (d > HUE_LIMIT) return blocked(`색조(hue)를 바꿔야 맞는다: 브랜드 ${k === 'background' ? '바탕' : '글자'} ${src.input} 가 라이트에서 ${d}° 돈다(한도 ${HUE_LIMIT}°)`)
      if (oklchToHex(theme.light[k]) !== oklchToHex(css(src.lch)))
        adjustments.push({ role: k, theme: 'light', from: src.input, to: theme.light[k], reason: k === 'background' ? '바탕 규칙(크림 바탕 채도 상한·파생)으로 조정' : '명도만 조정: 본문 7:1', hueDelta: d })
    }
    if (isAiTellViolet(roles.primary.lch))
      adjustments.push({ role: 'primary', theme: 'both', from: roles.primary.input, to: roles.primary.input, reason: 'ai-tell-violet(보라 주색 금지)은 레퍼런스 팔레트에만 건다 — 고객 브랜드 색이라 예외로 그대로 쓴다', hueDelta: 0 })
    for (const c of roles.unused) adjustments.push({ role: 'unused', theme: 'both', from: c.input, to: null, reason: '주색·바탕·글자·강조 자리가 이미 찼다 — 쓰지 않는다', hueDelta: 0 })
  }

  const palette = {
    id: `pal-brand-${id8}`, source: 'brand', use: 'recipe', mood: [], colorLogic: logic,
    ...(theme ? { roles: {}, colors: [], theme, defaultTheme: 'light' } : {}),
  }
  const base = theme ? palette : pickBase(basePreset)
  const head = presetToRecipeHead(basePreset, base, { fonts }, opts.archetype ? { archetype: opts.archetype } : {})
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  head.id = `brand-${slug(basePreset.styleId ?? basePreset.id).replace(/^preset-/, '')}-${id8}`
  head.name = `${basePreset.name} 브랜드 안`
  if (brand.logo) head.brand = { logo: brand.logo }
  return { head, adjustments, fontSubstitutions }
}

// 무채뿐인 브랜드의 중립 색조: 바탕 프리셋 첫 팔레트의 주색(유채일 때), 아니면 바탕 색조.
function baseHue(preset) {
  const r = pickBase(preset).roles
  const p = parseColor(r.primary ?? ''), b = parseColor(r.background ?? '')
  return p && p[1] >= ACCENT_C ? p[2] : b ? b[2] : 0
}
// 색 입력이 없으면 바탕 프리셋의 첫 팔레트를 그대로(서체·로고만 브랜드).
function pickBase(preset) {
  const p = pickPalettes(preset, { n: 1 })[0]
  if (!p) throw new Error(`brandToRecipeHead: 바탕 프리셋 ${preset.id} 에 맞는 팔레트가 없다`)
  return p
}

// 한 테마의 주색(과 딸린 primary-foreground·ring·accent)을 브랜드 색으로 다시 맞춘다. T 는 [L,C,H] 값의 테마(제자리에서 고친다).
function fitTheme(t, T, roles, { axes, logic, adjustments, tint }) {
  const bg = T.background
  const dark = t === 'dark'
  const textured = !!TEXTURE_ALPHA[axisValue(axes, 'texture')]
  const textureOk = (p) => !textured || !textureContrastProblems({ axes, color: { [t]: Object.fromEntries(Object.entries({ ...T, primary: p }).map(([k, v]) => [k, css(v)])) } }).some((m) => / primary\//.test(m))
  const okPrimary = (x) => cr(x, bg) >= 4.5 + MARGIN && !tailwindCopy(x) && textureOk(x)
  // 주색 후보: 브랜드 주색 → 다른 유채 브랜드 색 → 브랜드 글자색. 바탕 색은 빼다(바탕과 같은 버튼은 보이지 않는다).
  const cands = [roles.primary, roles.accent, roles.foreground].filter(Boolean)
  const tried = []
  let chosen
  for (const c of cands) {
    const x = fitL(c.lch, bg, okPrimary)
    if (!x) { tried.push(`${c.input}: 명도만으로 4.5:1 에 닿지 않는다`); continue }
    const d = hueDelta(x, c.lch)
    if (d > HUE_LIMIT) { tried.push(`${c.input}: 명도만으로 4.5:1 을 맞추면 색조가 ${d}° 돈다`); continue }
    chosen = { c, x, d }
    break
  }
  if (!chosen) return { blocked: `색조(hue)를 바꿔야만 맞는다 — ${t} 테마 주색: ${tried.join(' · ')}(한도 ${HUE_LIMIT}°, 대신 쓸 브랜드 색 없음)` }
  const moved = chosen.c !== roles.primary
  const p = tint(chosen.x)
  if (moved) adjustments.push({ role: 'primary', theme: t, from: roles.primary.input, to: css(p),
    reason: `역할 재배정: ${tried[0]} → 주색은 브랜드 색 ${chosen.c.input}${oklchToHex(css(p)) !== oklchToHex(css(chosen.c.lch)) ? '(명도만 조정)' : ''}, ${roles.primary.input} 는 강조색(accent)으로`, hueDelta: chosen.d })
  else if (oklchToHex(css(p)) !== oklchToHex(css(roles.primary.lch)))
    adjustments.push({ role: 'primary', theme: t, from: roles.primary.input, to: css(p), reason: `명도만 조정: ${t} 바탕 위 4.5:1(link 글자·체크 채움)${tailwindCopy(render(fitL(roles.primary.lch, bg, (x) => cr(x, bg) >= 4.5 + MARGIN) ?? p)) ? ' · Tailwind 기본값 복사 피함' : ''}${textured ? ' · 질감 무늬 위 대비' : ''}`, hueDelta: chosen.d })
  T.primary = p
  const pH = p[2]
  T['primary-foreground'] = onColor(p, [bg, dark ? [0.16, 0.01, pH] : [0.99, 0.004, pH], [0.99, 0, 0], [0.16, 0, 0]], 4.5 + MARGIN)
  T.ring = cr(p, bg) >= 3 + MARGIN ? p : T.foreground
  const onAccent = (a) => onColor(a, [T.foreground, T['primary-foreground'], dark ? [0.97, 0, 0] : [0.16, 0, 0]], 4.5 + MARGIN)
  if (moved) {
    // 내린 브랜드 주색 = 강조 면. 글자 4.5:1 이 되는 후보가 있으면 색 그대로, 없으면 명도만.
    const src = roles.primary.lch
    let a = avoidTailwind(src, bg)
    if (![T.foreground, T['primary-foreground'], dark ? [0.97, 0, 0] : [0.16, 0, 0]].some((f) => cr(f, a) >= 4.5 + MARGIN))
      // 둘째 인자는 방향만 정한다: 라이트는 글자가 어두우니 면을 밝게(어두운 기준), 다크는 반대.
      a = fitL(a, dark ? [1, 0, 0] : [0, 0, 0], (x) => cr(T.foreground, x) >= 4.5 + MARGIN && !tailwindCopy(x)) ?? a
    const d = hueDelta(a, src)
    if (d > HUE_LIMIT) return { blocked: `색조(hue)를 바꿔야만 맞는다 — ${t} 테마 강조색 ${roles.primary.input} 가 ${d}° 돈다(한도 ${HUE_LIMIT}°)` }
    T.accent = a
    adjustments.push({ role: 'accent', theme: t, from: roles.primary.input, to: css(a), reason: `브랜드 주색을 강조색(accent — 강조 면·hover)으로 옮겼다${oklchToHex(css(a)) !== oklchToHex(css(src)) ? '(명도만 조정)' : ''}`, hueDelta: d })
  } else if (axes.surface !== 'C6') {
    // derivePalette 와 같은 식(주색이 옅게 스민 면) — 주색을 바꿨으니 다시 섞는다.
    T.accent = avoidTailwind(parseOklch(mixOklch(css(p), css(bg), logic === 'K9' ? 14 : 12)), bg)
  }
  T['accent-foreground'] = onAccent(T.accent)
  return {}
}
