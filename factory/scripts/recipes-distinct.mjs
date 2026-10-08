// 레시피 사이 차이 검사 — 레시피가 이름만 다른 같은 모양으로 모이는 것을 막는다.
// 쌍마다: 7축 중 2개 이상 다름 + (라이트 색 다름 또는 display·body 서체 다름 — prose 가 있으면 prose 다름도 더하는 신호). 아니면 한 줄 문제.
// 색은 라이트 primary 와 라이트 ring 을 본다 — 둘 중 하나라도 다르면 「색 다름」(T4 fix 2 판정: primary 가 거의 검정인
// 레시피가 많아 강조색은 ring 에 산다). 두 레시피 중 하나라도 ring 이 없거나 읽지 못하면 primary 만 본다(문제 줄 아님).
// 다크 테마·accent·chart 는 비교하지 않는다.
// 한 색 쌍의 논리(T4 fix 1 판정): C < 0.04 는 무채색(색상각은 의미 없음). 둘 다 유채색이면 원 둘레 색상각 차 ≥ 30° 가 「다름」,
// 한쪽만 유채색이면 「다름」, 둘 다 무채색이면 「같음」.
// 대담한 얼굴(K6·K7·K8 — A 값과 보드 B안 모두)은 대표 면 색으로 한 번 더 비교한다(boldProblems, Task 6b fix 1 — 리뷰 I4).
// 서체 고유(typeProblems, Task 10c)는 쌍이 아니라 묶음 전체에서 얼굴 A·B 마다 display·displayKo 가 겹치지 않는지 본다.
// 사용: npm run qa:distinct (gen:all·check:regen 도 같은 검사를 돈다). 문제가 있으면 종료 1.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AXIS_ORDER, AXIS_DEFAULTS, axisValue } from './axes.mjs'
import { familyOf, canonicalItem, loadSources } from './gen-fonts.mjs'
import { recipeIds, RECIPES_DIR, parseRecipe, faceNames, koreanEntry, isKorean, RecipeHead, BOLD_LOGICS, applyAlternate } from './recipe.mjs'

export const ACHROMATIC_C = 0.04
const OKLCH = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+|none)/

// 라이트 색 하나(key)의 { l, c, h }. 읽지 못하면 null. 색상각 none 은 무채색.
export function lightLch(head, key) {
  const m = OKLCH.exec(String(head?.color?.light?.[key] ?? ''))
  if (!m) return null
  const l = m[1].endsWith('%') ? Number(m[1].slice(0, -1)) / 100 : Number(m[1])
  return { l, c: m[3] === 'none' ? 0 : Number(m[2]), h: m[3] === 'none' ? 0 : Number(m[3]) }
}
export const primaryLch = (head) => lightLch(head, 'primary')

// 원 둘레 기준 색상각 차(0~180°).
const hueGap = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return Math.min(d, 360 - d) }

// 두 색이 다른가(한 색 쌍의 논리).
function lchDiffers(p, q) {
  const [cp, cq] = [p.c >= ACHROMATIC_C, q.c >= ACHROMATIC_C]
  return cp && cq ? hueGap(p.h, q.h) >= 30 : cp !== cq
}

// 서체 정체성: 저장소의 정규화(gen-fonts familyOf — 앞뒤 공백·" Variable" 제거)에 소문자, 같은 키트 항목의 별칭(faceNames)까지 묶는다.
// 한글 서체는 그걸로도 부족할 수 있다: 메트릭 호환 별칭 항목(meta.aliasOf, 예: font-pretendard-gov → font-pretendard, 컨트롤러
// 판정 T3)은 다른 item 이라 faceNames 로는 안 묶인다 — 그 목록은 fontStacks 의 실제 CSS 폴백이기도 해서 여기서는 넓히지 않는다.
// korean-fonts.json 에 item 이 있으면 canonicalItem 정규화 값만으로 정체성을 판정한다(별칭 항목까지 한 서체로 묶인다).
// item 이 없는 이름(라틴 전용 display 등)은 그대로 faceNames + familyOf 정규화로 비교한다.
const fontKey = (family) => {
  const f = String(family ?? '').trim()
  const item = koreanEntry(f)?.item
  if (item) return `item:${canonicalItem(item)}`
  return [...new Set(faceNames(f).map((n) => (familyOf({ font: { family: n } }) ?? '').toLowerCase()))].sort().join('|')
}

export function recipeDistance(a, b) {
  const axes = AXIS_ORDER.filter((k) => axisValue(a.axes, k) !== axisValue(b.axes, k)).length
  const [p, q] = [primaryLch(a), primaryLch(b)]
  if (!p || !q) throw new Error(`${p ? b.id : a.id}: 라이트 primary 를 읽지 못함`)
  const [ra, rb] = [lightLch(a, 'ring'), lightLch(b, 'ring')]
  const color = lchDiffers(p, q) || (!!ra && !!rb && lchDiffers(ra, rb))
  // prose(선택 역할)는 더하는 신호일 뿐이다 — display·body 가 같아도 prose 가 다르면(한쪽만 있어도) 서체가 다르다(Task 5 fix 1).
  const fonts = ['display', 'body'].some((k) => fontKey(a.fonts?.[k]?.family) !== fontKey(b.fonts?.[k]?.family))
    || (!!(a.fonts?.prose || b.fonts?.prose) && fontKey(a.fonts?.prose?.family) !== fontKey(b.fonts?.prose?.family))
  return { axes, color, fonts }
}

// 쌍 비교 전에 레시피 하나만 보고 알 수 있는 문제(읽지 못하는 primary·axes 없음·스키마 위반). 문제가 있는 레시피는 쌍 비교에서 뺀다.
function headProblem(h) {
  if (h.problem) return h.problem
  if (!h.axes || typeof h.axes !== 'object') return 'axes 가 없다'
  if (!primaryLch(h)) return `primary 를 읽지 못함 — ${h.color?.light?.primary ?? '(없음)'}`
  return null
}

// 대담한 레시피끼리 닮지 않게(Task 6b fix 1 — 리뷰 I4): K6·K7·K8 을 쓰는 얼굴(A 값, 그리고 B안을 적용한 값)은 대표 면 색으로도 비교한다.
// 대표 면 색 = K6·K7 은 라이트 field-1, K8 은 라이트 칸 가운데 가장 채도 높은 칸. 같은 레시피의 A·B끼리는 비교하지 않는다.
// 같은 색 논리인 두 얼굴은 면 색이 달라야 한다: 한 색 쌍의 논리(둘 다 유채색이면 색상각 30° 이상, 한쪽만 유채색이면 다름) 또는
// 분명한 명도·채도 차(|ΔL| ≥ 0.25 — 밝은 면 대 짙은 면, |ΔC| ≥ 0.08). 색 논리가 다르면 면의 쓰임(면·듀오톤·칸)이 달라 통과다.
export const FACE_GAP = { l: 0.25, c: 0.08 }
export function boldFace(head) {
  if (!BOLD_LOGICS.includes(head?.colorLogic)) return null
  if (head.colorLogic !== 'K8') return lightLch(head, 'field-1')
  const blocks = Object.keys(head.color?.light ?? {}).filter((k) => /^block-\d+$/.test(k)).map((k) => lightLch(head, k)).filter(Boolean)
  return blocks.sort((a, b) => b.c - a.c)[0] ?? null
}
const faceDiffers = (p, q) => lchDiffers(p, q) || Math.abs(p.l - q.l) >= FACE_GAP.l || Math.abs(p.c - q.c) >= FACE_GAP.c
export function boldProblems(heads) {
  const faces = []
  for (const h of heads) for (const [label, x] of [['A', h], ['B', applyAlternate(h)]]) {
    const f = x && boldFace(x)
    if (f) faces.push({ id: h.id, label, logic: x.colorLogic, f })
  }
  const out = []
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const [a, b] = [faces[i], faces[j]]
    if (a.id === b.id || a.logic !== b.logic || faceDiffers(a.f, b.f)) continue
    const s = (x) => `oklch(${x.l} ${x.c} ${x.h})`
    out.push(`${a.id}(${a.label}) ~ ${b.id}(${b.label}): 둘 다 ${a.logic} 이고 대표 면 색이 닮았다 ${s(a.f)} · ${s(b.f)} — 색상각 30° 이상 또는 |ΔL| ≥ ${FACE_GAP.l}·|ΔC| ≥ ${FACE_GAP.c} 로 가른다(리뷰 I4)`)
  }
  return out
}

export function distinctProblems(heads) {
  const out = [], ok = []
  for (const h of heads) {
    const p = headProblem(h)
    if (p) out.push(`${h.id}: ${p}`)
    else ok.push(h)
  }
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const [a, b] = [ok[i], ok[j]]
      const d = recipeDistance(a, b)
      if (d.axes >= 2 && (d.color || d.fonts)) continue
      const need = [d.axes < 2 && '축 2개 이상 다름', !(d.color || d.fonts) && '색 또는 서체 중 하나 다름'].filter(Boolean).join(' · ')
      // 선택 축(D·X)은 둘 중 하나라도 머리에 적었을 때만 적는다(둘 다 기본값이면 말하지 않는다 — Task 16a 전 문장 그대로).
      const same = AXIS_ORDER.filter((k) => axisValue(a.axes, k) === axisValue(b.axes, k) && !(a.axes[k] === undefined && b.axes[k] === undefined && k in AXIS_DEFAULTS)).map((k) => axisValue(a.axes, k)).join(' ')
      out.push(`${a.id} ~ ${b.id}: 축 ${d.axes}개, 색 ${d.color ? '다름' : '같음'}, 서체 ${d.fonts ? '다름' : '같음'} — 필요: ${need} — 같은 축: ${same || '없음'}`)
    }
  }
  return [...out, ...boldProblems(ok)]
}

// 서체 고유 검사(Task 10c — 운영자 판정: 모든 디자인이 같은 서체를 쓴다는 것이 가장 큰 AI 티). 쌍이 아니라 묶음 전체에서, 얼굴마다 따로:
// 얼굴 A(머리 그대로)와 얼굴 B(B안 전체 적용 — B안이 없는 레시피는 B 얼굴이 없다. 10e 가 10벌 모두에 B안을 쓰면 빈 곳이 없어진다 — 리뷰 M3)
// 각각에서 display 는 모두 달라야 하고, displayKo 는 가진 레시피끼리 모두 달라야 한다(r6 처럼 없는 레시피는 빠진다). 위반.
// 경고(모두 A∪B, 같은 레시피 안의 반복은 한 번으로 센다):
//   · 라틴 display 가 두 레시피 이상에 나온다.
//   · 한글 서체(displayKo, 그리고 한글 서체를 display 로 쓴 것)가 두 레시피 이상에 나온다 — 역할이나 얼굴이 달라도(fix 1 — 리뷰 M2:
//     X 의 display = Y 의 displayKo, X 의 B displayKo = Y 의 A displayKo 등). 같은 얼굴·같은 역할끼리의 겹침은 위반이 이미 알린다.
// 서체 정체성(fix 1 — 리뷰 M1): 키트 항목이 있으면 canonicalItem(항목), 항목이 없으면 이름으로 키트 항목을 찾고(한글은 korean-fonts.json,
// 라틴은 키트 family), 그래도 없으면 fontKey(정규화한 이름). 같은 항목을 다른 철자로 적어도 한 서체로 센다.
let kit
// 이름 정규화: 앞뒤 공백·따옴표를 떼고, 끝의 « Variable»(대소문자 무시)을 떼고, 소문자로.
const normFamily = (s) => String(s ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\s+variable$/i, '').trim().toLowerCase()
const kitIndex = () => (kit ??= (() => { const all = loadSources(); return { byFamily: new Map(all.map((i) => [normFamily(familyOf(i)), i.name])), korean: new Set(all.filter((i) => i.meta?.korean).map((i) => i.name)) } })())
const kitItemOf = (family) => kitIndex().byFamily.get(normFamily(family))
const koreanItem = (item) => kitIndex().korean.has(item)
export function faceIdentity(f) {
  if (!f?.family && !f?.item) return null
  const item = f.item ?? koreanEntry(f.family)?.item ?? kitItemOf(f.family)
  const korean = item ? koreanItem(item) || isKorean(f.family) : isKorean(f.family)
  return { key: item ? `item:${canonicalItem(item)}` : fontKey(f.family), korean, fam: f.family ?? f.item }
}
export function typeProblems(heads) {
  const violations = [], warnings = []
  const faces = { A: heads.map((h) => ({ id: h.id, f: h.fonts })), B: heads.filter((h) => h.alternates).map((h) => ({ id: h.id, f: applyAlternate(h)?.fonts })) }
  const uses = []
  for (const [label, list] of Object.entries(faces)) for (const role of ['display', 'displayKo']) {
    const by = new Map()
    for (const { id, f } of list) {
      const x = faceIdentity(f?.[role])
      if (!x) continue
      uses.push({ id, face: label, role, ...x })
      by.set(x.key, [...(by.get(x.key) ?? []), { id, fam: x.fam }])
    }
    for (const xs of by.values()) if (xs.length > 1)
      violations.push(`${label}안 ${role} ${xs[0].fam} 를 ${xs.map((x) => x.id).join(' · ')} 가 같이 쓴다 — 얼굴 ${label}의 ${role === 'display' ? '제목 서체' : '한글 제목체'}는 레시피마다 달라야 한다(docs/recipes/dna/fonts-assignment.md)`)
  }
  const groups = new Map()
  for (const u of uses) if (u.role === 'displayKo' || u.korean) groups.set(`ko|${u.key}`, [...(groups.get(`ko|${u.key}`) ?? []), u])
    else if (u.role === 'display') groups.set(`latin|${u.key}`, [...(groups.get(`latin|${u.key}`) ?? []), u])
  for (const [k, us] of groups) {
    const ids = [...new Set(us.map((u) => u.id))]
    if (ids.length < 2) continue
    if (k.startsWith('latin|')) { warnings.push(`A∪B display ${us[0].fam} 가 ${ids.join(' · ')} 에 나온다 — 라틴 제목 서체는 묶음 전체(A·B)에서 한 번만 쓰는 것이 목표다`); continue }
    // 다른 레시피끼리 얼굴·역할이 다른 짝이 하나라도 있을 때만(같은 얼굴·같은 역할만의 겹침은 위반이 이미 알렸다).
    const mixed = us.some((a) => us.some((b) => a.id !== b.id && (a.face !== b.face || a.role !== b.role)))
    if (mixed) warnings.push(`A∪B 한글 서체 ${us[0].fam} 가 ${[...new Set(us.map((u) => `${u.id}(${u.face} ${u.role})`))].join(' · ')} 에 나온다 — 한글 제목체는 역할·얼굴을 가리지 않고 묶음 전체에서 한 번만 쓰는 것이 목표다(배정표 「한글 제목체 18종도 서로 모두 다르다」)`)
  }
  return { violations, warnings }
}

// 히어로 고유(Task 10d): 묶음 전체에서 hero(A)와 alternates.hero(B)는 모두 달라야 한다 — 같은 첫 화면 구성이 두 얼굴에 나오면 위반.
// 히어로가 없는 레시피(묶음 2 전)는 빠진다. 카탈로그 밖 id 는 스키마(RecipeHead·Alternates)가 막는다.
export function heroProblems(heads) {
  const by = new Map()
  for (const h of heads) for (const [label, id] of [['A', h.hero], ['B', h.alternates?.hero]]) if (id) by.set(id, [...(by.get(id) ?? []), `${h.id}(${label})`])
  return [...by].filter(([, xs]) => xs.length > 1).map(([id, xs]) => `히어로 ${id} 를 ${xs.join(' · ')} 가 같이 쓴다 — hero·alternates.hero 는 레시피 묶음 전체에서 한 번씩만(첫 화면이 서로 달라야 한다)`)
}

// 저장소 레시피 원천의 YAML 머리(parseRecipe 는 머리 키를 펼쳐 body 와 함께 돌려준다). 스키마를 못 넘으면 problem 을 달아 문제로 보고된다.
export const loadRecipeHeads = () => recipeIds().map((id) => {
  const head = parseRecipe(readFileSync(join(RECIPES_DIR, id, 'DESIGN.md'), 'utf8'))
  delete head.body
  const r = RecipeHead.safeParse(head)
  if (!r.success) head.problem = `YAML 머리가 스키마와 맞지 않다 — ${r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`
  head.id ??= id
  return head
})

// gen-all 과 CLI 가 같이 쓴다: 문제를 한국어 한 줄씩 찍고 문제 수를 돌려준다.
export function reportDistinct(heads = loadRecipeHeads(), log = console) {
  const problems = distinctProblems(heads)
  for (const p of problems) log.error(`레시피 차이 부족: ${p}`)
  if (!problems.length) log.log(`레시피 차이 검사: ${heads.length}벌, 문제 없음`)
  // 서체 고유(Task 10c): 위반은 종료 1, A∪B 반복은 경고만. 스키마를 못 넘은 머리(problem)는 위에서 이미 보고했다.
  const type = typeProblems(heads.filter((h) => !h.problem))
  for (const p of type.violations) log.error(`서체 고유 위반: ${p}`)
  for (const w of type.warnings) log.warn(`서체 고유 경고: ${w}`)
  if (!type.violations.length) log.log(`서체 고유 검사: ${heads.length}벌(얼굴 A·B), 위반 없음${type.warnings.length ? `, 경고 ${type.warnings.length}건` : ''}`)
  const hero = heroProblems(heads.filter((h) => !h.problem))
  for (const p of hero) log.error(`히어로 고유 위반: ${p}`)
  if (!hero.length) log.log(`히어로 고유 검사: 히어로 ${heads.reduce((n, h) => n + (h.hero ? 1 : 0) + (h.alternates?.hero ? 1 : 0), 0)}개, 위반 없음`)
  return problems.length + type.violations.length + hero.length
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exit(reportDistinct() ? 1 : 0)
