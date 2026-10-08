// 폰트 키트: registry/factory/fonts/font-<slug>.json(항목 원천, 사람이 고친다) → 검사 → registry/factory/fonts/registry.json(생성물).
// 사용: node factory/scripts/gen-fonts.mjs   (npm run gen:all 이 레시피보다 먼저 돌린다 — 레시피가 폰트 항목 이름을 읽는다)
//
// 항목 두 가지:
//   registry:font  Google Fonts(shadcn 은 provider google 만 받는다 — 계획 스파이크 4). next/font/google 목록(설치된 next 의 font-data.json)으로
//                  import 이름·굵기·subsets 가 실제로 있는지 본다. 굵기는 4개까지, 정적 서체는 굵기를 적어야 한다(next/font 가 요구).
//   registry:item  Google 밖 서체. 둘 중 하나:
//                  · npm 패키지(Pretendard) — css @import "<패키지 경로>" + dependencies. 결과는 docs/qa/pretendard-install.md.
//                  · 1차 CDN(Task 10c — MaruBuri·갈무리11 등) — css `@import url("https://…")`. 주소 고정 규칙은 cdnProblems.
//                  · 파일만 있는 서체(Task 15 — 펴진고딕·서초바탕·자연산스·을지로체) — 원천 `fontFace`(면 하나 또는 굵기마다 면 여럿).
//                    shadcn 4.21 css 필드는 @font-face 를 쓰지 못한다(면 하나는 add 가 「Unknown word」로 멈추고, 면 여럿은 @font-face 안의 0·1·2 중첩 규칙이 되어 면에 속성이 없다 — M8). 그래서 생성기가 면을
//                    registry:file CSS(faces/<slug>.css → 소비자 styles/wf-fonts/<slug>.css)로 싣고, css 필드에는 그 파일의 @import 만 둔다.
//                    원천 css 에 @font-face 가 있으면 문제(font-face-css)로 멈춘다.
//                  next/font subsets 가 0개인 Google 서체(Song Myung)는 registry:font 에서 subsets 를 비운다(next/font 가 preload 를 끈다).
// 모두 meta.license·meta.licenseUrl(1차 출처, https)·meta.role·meta.korean 이 있어야 한다(DESIGN §14-D 「라이선스 먼저」). 표: docs/qa/font-licenses.md.
// 한글 서체(meta.korean)는 factory/qa/data/korean-fonts.json 과 맞물린다(T6r1-c3): 목록의 서체는 키트 항목(item)을 가리키거나 external + reason.
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { fontVar, pinDependency } from './lib/registry-lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const FONTS_DIR = join(ROOT, 'registry', 'factory', 'fonts')
const KOREAN_LIST = join(ROOT, 'factory', 'qa', 'data', 'korean-fonts.json')
const GOOGLE = createRequire(import.meta.url)('next/dist/compiled/@next/font/dist/google/font-data.json')
const ROLES = ['display', 'body', 'mono']
const MAX_WEIGHTS = 4

export const loadSources = (dir = FONTS_DIR) => readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'registry.json').sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
export const loadKoreanList = () => JSON.parse(readFileSync(KOREAN_LIST, 'utf8'))

// 항목이 싣는 서체 이름(korean-fonts.json 과 맞춰 보는 이름). Google 은 font.family 첫 이름에서 fontsource 의 « Variable» 을 뗀다.
export const familyOf = (i) => i.meta?.family ?? i.font?.family?.match(/^\s*['"]?([^'",]+)/)?.[1].replace(/ Variable$/, '').trim()

// 서체 정체성 별칭(컨트롤러 판정 T3: Pretendard GOV 는 Pretendard 와 메트릭 호환 변형이라 레시피 차이 검사에서 한 서체로 센다).
// 데이터 기반 — 하드코딩 문자열 비교가 아니라 항목 meta.aliasOf 를 따라간다(1단계, 자기 참조·존재하지 않는 대상은 fontProblems 가 잡는다).
// recipes-distinct.mjs 의 fontKey() 만 이걸 쓴다(레시피 차이 검사). recipe.mjs 의 faceNames()(실제 CSS 폴백 스택)는
// koreanEntry(family).item 이 정확히 같은 항목만 묶고 canonicalItem 을 따라가지 않는다 — 별칭이 폴백에 새지 않는다(T4 리뷰 I1).
let cachedAliasMap
export function canonicalItem(name, items) {
  if (items) {
    const alias = items.find((i) => i.name === name)?.meta?.aliasOf
    return alias && items.some((i) => i.name === alias) ? alias : name
  }
  if (!cachedAliasMap) {
    cachedAliasMap = new Map()
    const all = loadSources()
    for (const i of all) if (i.meta?.aliasOf && all.some((x) => x.name === i.meta.aliasOf)) cachedAliasMap.set(i.name, i.meta.aliasOf)
  }
  return cachedAliasMap.get(name) ?? name
}

// 문제 목록(「규칙: 내용」). 비면 통과.
export function fontProblems(items, { knownItems = new Set() } = {}) {
  const p = [], seen = new Set()
  for (const i of items) {
    const at = i.name ?? i.file ?? '(이름 없음)'
    if (!/^font-[a-z0-9]+(-[a-z0-9]+)*$/.test(i.name ?? '')) p.push(`name: ${at} — font-<slug> 형식이 아니다`)
    if (i.file && i.file !== `${i.name}.json`) p.push(`name: ${at} — 파일 이름 ${i.file} ≠ ${i.name}.json`)
    if (seen.has(i.name) || knownItems.has(i.name)) p.push(`name: ${at} — 이름이 겹친다(레지스트리 항목 이름은 전역 유일)`)
    seen.add(i.name)
    const m = i.meta ?? {}
    if (!m.license) p.push(`license: ${at} — meta.license 가 없다`)
    if (!/^https:\/\/\S+$/.test(m.licenseUrl ?? '')) p.push(`license: ${at} — meta.licenseUrl(1차 출처 https URL)이 없다`)
    if (!Array.isArray(m.role) || !m.role.length || m.role.some((r) => !ROLES.includes(r))) p.push(`role: ${at} — meta.role 은 ${ROLES.join('|')} 중 하나 이상`)
    if (typeof m.korean !== 'boolean') p.push(`korean: ${at} — meta.korean(true|false)이 없다`)
    for (const d of i.dependencies ?? []) if (d.lastIndexOf('@') > 0) p.push(`dependencies: ${at} — ${d} — 원천에는 이름만 적는다(gen-fonts 가 package.json 범위로 고정한다)`)
    if (m.aliasOf) {
      if (m.aliasOf === i.name) p.push(`aliasOf: ${at} — 자기 자신을 가리킨다`)
      else if (!items.some((x) => x.name === m.aliasOf)) p.push(`aliasOf: ${at} — ${m.aliasOf} 가 키트에 없다`)
    }

    // M8(Task 15): shadcn 4.21 은 css 필드의 @font-face 를 깨뜨린다 — 어느 항목 모양이든 css 에 두지 못하게 막는다.
    for (const k of Object.keys(i.css ?? {})) if (/^@font-face\b/i.test(k.trim()))
      p.push(`font-face-css: ${at} — css 의 ${k} — shadcn 4.21 css 필드는 @font-face 를 쓰지 못한다(add 실패 또는 속성 없는 면, M8). 면은 fontFace 에 적는다 — gen-fonts 가 registry:file CSS 로 싣고 @import 를 단다`)
    if (i.type === 'registry:font') {
      const f = i.font ?? {}
      if (f.provider !== 'google') p.push(`provider: ${at} — ${f.provider} — registry:font 는 google 만 된다(Google 밖 서체는 registry:item 경로)`)
      const family = Object.keys(GOOGLE).find((k) => k.replace(/ /g, '_') === f.import)
      const g = family && GOOGLE[family]
      if (!g) { p.push(`import: ${at} — ${f.import} 는 next/font/google 에 없다`); continue }
      if (familyOf(i) !== family) p.push(`family: ${at} — font.family 첫 이름 ${familyOf(i)} ≠ ${family}`)
      if (f.variable !== fontVar(i.name)) p.push(`variable: ${at} — ${f.variable} ≠ ${fontVar(i.name)}(레시피가 var(${fontVar(i.name)}, …)로 읽는다)`)
      const variable = g.weights.includes('variable')
      const w = f.weight ?? []
      if (w.length > MAX_WEIGHTS) p.push(`weight: ${at} — 굵기 ${w.length}개 > ${MAX_WEIGHTS}`)
      for (const x of w) if (!g.weights.includes(x)) p.push(`weight: ${at} — ${x} 는 ${family} 에 없다(${g.weights.join(' ')})`)
      if (!variable && !w.length) p.push(`weight: ${at} — 정적 서체는 굵기를 적어야 한다(next/font 요구)`)
      // subsets 가 0개인 서체(Song Myung): next/font 가 그때만 preload 를 스스로 끈다 — 항목은 비워 둔다(적으면 「Unknown subset」).
      if (!g.subsets.length) { if (f.subsets?.length) p.push(`subsets: ${at} — ${family} 는 next/font subsets 가 없다 — subsets 를 비운다(next/font 가 preload 를 끈다)`) }
      else if (!f.subsets?.length || f.subsets.some((s) => !g.subsets.includes(s))) p.push(`subsets: ${at} — ${JSON.stringify(f.subsets)} ⊄ ${g.subsets.join(' ')}`)
      const dep = `@fontsource${variable ? '-variable' : ''}/${i.name.replace(/^font-/, '')}`
      if (f.dependency !== dep) p.push(`dependency: ${at} — ${f.dependency} ≠ ${dep}(Next 가 아닌 소비자가 설치하는 패키지)`)
    } else if (i.type === 'registry:item') {
      if (!(i.css && Object.keys(i.css).length) && !i.files?.length && !faces(i).length) p.push(`payload: ${at} — css(@import) 도 files 도 fontFace 도 없다 — 설치해도 서체가 오지 않는다`)
      p.push(...faceProblems(i, at))
      if (!m.family) p.push(`family: ${at} — Google 밖 항목은 meta.family(싣는 서체 이름)를 적는다`)
      const keys = Object.keys(i.cssVars?.theme ?? {})
      if (!keys.includes(fontVar(i.name).slice(2))) p.push(`variable: ${at} — cssVars.theme 에 ${fontVar(i.name).slice(2)} 가 없다(레시피가 var(${fontVar(i.name)}, …)로 읽는다)`)
      // 서체 변수 값은 서체 이름만(Task 10c fix 1 — 리뷰 M6). 끝에 일반형(serif·sans-serif …)이 있으면 레시피 스택 var(--font-x-wf, …) 가 그 값으로 풀려
      // 없는 글자(2,350자 서체의 드문 한글 등)가 레시피 본문·한글 서체 대신 플랫폼 일반형으로 떨어진다. 폴백은 레시피 스택이 맡는다.
      for (const [k, v] of Object.entries(i.cssVars?.theme ?? {})) if (GENERIC.includes(String(v).split(',').pop().trim().toLowerCase()))
        p.push(`variable-generic: ${at} — ${k}: ${v} — 서체 변수는 서체 이름만 적는다(일반형은 레시피 스택 끝에 있다 — 여기 있으면 본문·한글 폴백을 건너뛴다)`)
      p.push(...cdnProblems(i, at))
    } else p.push(`type: ${at} — ${i.type} — registry:font 또는 registry:item`)
  }
  p.push(...variableOverlaps(items))
  return p
}

const GENERIC = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']

// Google 밖 서체를 1차 CDN 에서 싣는 css 항목(Task 10c): `@import url("<스타일시트>")`, 또는 파일만 있는 서체의 fontFace(굵기가 여럿이면 배열 — Task 15 부터 registry:file CSS 로 나간다).
// 원격 주소는 https 만. jsDelivr 의 GitHub 파일(gh/<owner>/<repo>@<ref>)은 40자 커밋 sha 로만 고정한다 — 브랜치·태그·@latest 는
// 가리키는 내용이 바뀐다(10a 판정 3). 그 커밋은 meta.source 에도 적는다. jsDelivr npm 은 정확한 버전(x.y.z)으로.
// 그 밖의 호스트도 고정한다(fix 1 — 리뷰 M7): raw.githubusercontent.com/<o>/<r>/<ref>/… 와 github.com/<o>/<r>/raw/<ref>/… 는 커밋 sha,
// unpkg 는 정확한 버전. 1차 배포처의 버전 없는 스타일시트(hangeul.pstatic.net — 네이버가 고정 URL 을 주지 않는다)는 허용한다:
// 제작사가 직접 운영하는 주소라 고정할 버전이 없고, 바뀌면 제작사의 현재판을 받는 것이 맞다(10a 판정).
// meta.weight(선택): 그 이름으로 실제 등록되는 굵기 — 레시피가 단일 굵기 판정(recipe.mjs singleWeight)과 굵기 lint 에 쓴다.
// @font-face 가 있으면 면들의 font-weight 집합이 meta.weight 와 같아야 한다.
export const cssUrls = (i) => [...JSON.stringify([i.css ?? {}, i.fontFace ?? []]).matchAll(/https?:\/\/[^"'()\s\\]+/g)].map((m) => m[0])
const JSDELIVR = /^https:\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\/(gh|npm)\//
const unquote = (s) => String(s ?? '').trim().replace(/^["']|["']$/g, '')
export function cdnProblems(i, at = i.name) {
  const p = [], m = i.meta ?? {}
  for (const u of cssUrls(i)) {
    if (!u.startsWith('https://')) { p.push(`url: ${at} — ${u} — https 주소만 싣는다`); continue }
    if (/@latest\b/.test(u)) p.push(`pin: ${at} — ${u} — @latest 는 내용이 바뀐다`)
    const kind = u.match(JSDELIVR)?.[1]
    if (kind === 'gh') {
      const ref = u.match(/\/gh\/[^/]+\/[^/@]+@([^/]+)\//)?.[1]
      if (!ref || !/^[0-9a-f]{40}$/.test(ref)) p.push(`pin: ${at} — ${u} — jsDelivr gh 주소는 커밋 sha(40자)로 고정한다(브랜치·태그는 바뀐다 — git ls-remote 로 커밋을 찾는다)`)
      else if (!String(m.source ?? '').includes(ref)) p.push(`pin: ${at} — 고정한 커밋 ${ref} 를 meta.source 에 적는다`)
    }
    if (kind === 'npm') {
      const ver = u.match(/\/npm\/(?:@[^/]+\/)?[^/@]+@([^/]+)\//)?.[1]
      if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) p.push(`pin: ${at} — ${u} — jsDelivr npm 주소는 정확한 버전(x.y.z)으로 고정한다`)
    }
    const rawRef = u.match(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([^/]+)\//)?.[1] ?? u.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:raw|blob)\/([^/]+)\//)?.[1]
    if (/^https:\/\/(raw\.githubusercontent\.com|github\.com)\//.test(u)) {
      if (!rawRef || !/^[0-9a-f]{40}$/.test(rawRef)) p.push(`pin: ${at} — ${u} — GitHub 원본 주소는 커밋 sha(40자)로 고정한다(브랜치는 바뀐다)`)
      else if (!String(m.source ?? '').includes(rawRef)) p.push(`pin: ${at} — 고정한 커밋 ${rawRef} 를 meta.source 에 적는다`)
    }
    if (/^https:\/\/unpkg\.com\//.test(u)) {
      const ver = u.match(/^https:\/\/unpkg\.com\/(?:@[^/]+\/)?[^/@]+@([^/]+)\//)?.[1]
      if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) p.push(`pin: ${at} — ${u} — unpkg 주소는 정확한 버전(x.y.z)으로 고정한다`)
    }
  }
  const fs = faces(i)
  for (const face of fs) if (unquote(face['font-family']) !== m.family) p.push(`family: ${at} — @font-face font-family ${face['font-family']} ≠ meta.family ${m.family}`)
  if (fs.length && Array.isArray(m.weight)) {
    const fw = [...new Set(fs.map((f) => String(f['font-weight'] ?? '400')))].sort().join(' '), mw = [...m.weight].sort().join(' ')
    if (fw !== mw) p.push(`weight: ${at} — @font-face 굵기 ${fw} ≠ meta.weight ${mw}`)
  }
  if (m.weight !== undefined && (!Array.isArray(m.weight) || !m.weight.length || m.weight.some((w) => !/^[1-9]00$/.test(w))))
    p.push(`weight: ${at} — meta.weight 는 ["400", …] 처럼 굵기 문자열 배열이다`)
  return p
}

// ── 파일만 있는 서체의 @font-face 전달(Task 15 — M8) ─────────────────────
// 원천 fontFace(면 객체 하나 또는 배열) → 생성물 registry/factory/fonts/faces/<slug>.css(registry:file, 소비자 styles/wf-fonts/<slug>.css)
// + css 필드 `@import "../styles/wf-fonts/<slug>.css"`. shadcn 은 target 을 소비자 루트 기준으로 풀고 src 폴더가 있으면 src/ 를 앞에 붙인다
// (add 의 파일 자리 `ar` — install-closure.mjs installPath). 그래서 전역 CSS 가 app/globals.css·src/app/globals.css·styles/globals.css 어느 자리여도
// 한 단계 위의 styles/wf-fonts 가 같은 파일이다. Next 소비자(shadcn init -t next)가 선언된 사용 환경이다.
export const FACES_DIR = join(FONTS_DIR, 'faces')
export const faces = (i) => [i.fontFace ?? []].flat()
const faceSlug = (name) => name.replace(/^font-/, '')
export const facePath = (name) => `faces/${faceSlug(name)}.css` // 폰트 층 registry.json 기준(shadcn build 가 include 폴더에서 읽는다)
export const faceTarget = (name) => `styles/wf-fonts/${faceSlug(name)}.css`
export const faceImport = (name) => `@import "../${faceTarget(name)}"`
export const faceRule = (face) => `@font-face { ${Object.entries(face).map(([p, v]) => `${p}: ${v};`).join(' ')} }`
const FACE_PROPS = ['font-family', 'src', 'font-weight', 'font-style', 'font-display', 'unicode-range']
export const faceCss = (i) => [
  '/* 생성물 — factory/scripts/gen-fonts.mjs 로 다시 만든다. 손으로 고치지 않는다. */',
  `/* web-factory 폰트 키트 ${i.name}: ${i.meta?.family} (${i.meta?.license}, ${i.meta?.licenseUrl}) — 원천 ${i.meta?.source} */`,
  ...faces(i).map(faceRule), ''].join('\n')

export function faceProblems(i, at = i.name) {
  const p = [], fs = faces(i)
  if (i.fontFace === undefined) return p
  if (!fs.length) p.push(`font-face: ${at} — fontFace 가 비었다`)
  for (const f of fs) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) { p.push(`font-face: ${at} — 면은 { "font-family", src, … } 객체다`); continue }
    for (const k of ['font-family', 'src', 'font-display']) if (!String(f[k] ?? '').trim()) p.push(`font-face: ${at} — 면에 ${k} 가 없다`)
    if (f.src && !/^url\("https:\/\/[^"]+"\) format\("woff2?"\)(,\s*url\("https:\/\/[^"]+"\) format\("woff2?"\))*$/.test(f.src)) p.push(`font-face: ${at} — src ${f.src} — url("https://…") format("woff2"|"woff") 꼴만`)
    for (const k of Object.keys(f)) if (!FACE_PROPS.includes(k)) p.push(`font-face: ${at} — 모르는 속성 ${k}(${FACE_PROPS.join('·')})`)
  }
  if (i.files?.length) p.push(`font-face: ${at} — fontFace 항목은 files 를 적지 않는다(생성기가 faces/ 파일을 단다)`)
  return p
}

// shadcn 이 소비자 layout.tsx 에서 next/font 선언을 부분 문자열로 찾는다(T9-c2, registry-lib `fontVar`). 한 변수가 다른 변수나
// init 이 넣는 기본 변수(--font-sans 등)의 부분 문자열이면 두 번째 add 에서 선언이 겹쳐 빌드가 깨진다.
const SHADCN_FONT_VARS = ['--font-sans', '--font-serif', '--font-mono', '--font-heading']
export function variableOverlaps(items) {
  const vars = items.filter((i) => i.type === 'registry:font' && i.font?.variable).map((i) => ({ at: i.name, v: i.font.variable }))
  const all = [...vars, ...SHADCN_FONT_VARS.map((v) => ({ at: `shadcn 기본 ${v}`, v }))]
  const p = []
  for (const a of vars) for (const b of all)
    if (a !== b && a.v !== b.v && (b.v.includes(a.v) || a.v.includes(b.v)))
      p.push(`variable-overlap: ${a.at} — ${a.v} 와 ${b.at}(${b.v}) 가운데 하나가 다른 하나에 들어 있다(두 번째 add 에서 선언이 겹친다)`)
  return p
}

// korean-fonts.json ↔ 키트(T6r1-c3). 목록의 서체: item(키트 항목, 그 항목이 한글)이거나 external: true + reason. 키트의 한글 항목은 목록에 있다.
export function koreanListProblems(items, list) {
  const p = []
  const byName = new Map(items.map((i) => [i.name, i]))
  for (const e of list.families ?? []) {
    if (typeof e !== 'object' || !e.family) { p.push(`korean-list: 항목 ${JSON.stringify(e)} — { family, item } 또는 { family, external, reason }`); continue }
    if (e.external) { if (!e.reason?.trim()) p.push(`korean-list: ${e.family} — external 인데 reason 이 없다`); continue }
    const it = byName.get(e.item)
    if (!it) p.push(`korean-list: ${e.family} — 키트에 항목 ${e.item ?? '(item 없음)'} 가 없다 — 항목을 만들거나 external: true + reason`)
    else if (!it.meta?.korean) p.push(`korean-list: ${e.family} — ${e.item} 은 meta.korean 이 아니다`)
  }
  for (const i of items.filter((x) => x.meta?.korean)) {
    const listed = (list.families ?? []).some((e) => e.item === i.name && !e.external && e.family?.toLowerCase() === familyOf(i)?.toLowerCase())
    if (!listed) p.push(`korean-list: 키트의 한글 서체 ${familyOf(i)}(${i.name}) 가 korean-fonts.json 에 없다`)
  }
  return p
}

// 원천 → 레지스트리 항목(이름순, file 키 제거). 원천이 곧 항목 형식이라 모양은 바꾸지 않는다.
// npm 의존(registry:item 의 dependencies)은 원천에 이름만 적고 여기서 package.json 범위로 고정한다 — 다른 층과 같은 pinDependency(최종 리뷰 M7).
const pkgVersions = () => { const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')); return { ...pkg.devDependencies, ...pkg.dependencies } }
// fontFace 항목(Task 15)은 fontFace 를 빼고 files(registry:file) + css @import 로 바꾼다 — 면은 faceCss 가 쓴 파일에 있다.
const shipFaces = ({ fontFace, ...i }) => (fontFace === undefined ? i : {
  ...i,
  files: [{ path: facePath(i.name), type: 'registry:file', target: faceTarget(i.name) }],
  css: { [faceImport(i.name)]: {}, ...i.css },
})
export const fontRegistry = (items, versions = pkgVersions()) => items.map(({ file, $schema, ...i }) => shipFaces(i.dependencies ? { ...i, dependencies: i.dependencies.map((d) => pinDependency(d, versions)) } : i))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
// 생성할 면 파일: { 파일 이름: 내용 }.
export const faceFiles = (items) => Object.fromEntries(items.filter((i) => i.fontFace !== undefined).map((i) => [`${faceSlug(i.name)}.css`, faceCss(i)]))

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  // 다른 층(이 층과 레시피 층 r 을 뺀 registry/factory/<층>/registry.json)의 항목 이름 — 전역 유일 검사.
  const factory = join(ROOT, 'registry', 'factory'), known = new Set()
  for (const d of readdirSync(factory, { withFileTypes: true })) {
    const reg = join(factory, d.name, 'registry.json')
    if (d.isDirectory() && !['fonts', 'r'].includes(d.name) && existsSync(reg)) for (const i of JSON.parse(readFileSync(reg, 'utf8')).items) known.add(i.name)
  }
  const items = loadSources()
  const problems = [...fontProblems(items, { knownItems: known }), ...koreanListProblems(items, loadKoreanList())]
  if (problems.length) { for (const m of problems) console.error(`FAIL ${m}`); console.error(`gen-fonts: 문제 ${problems.length}건 — 생성하지 않았다`); process.exit(1) }
  const out = fontRegistry(items)
  writeFileSync(join(FONTS_DIR, 'registry.json'), JSON.stringify({ $schema: 'https://ui.shadcn.com/schema/registry.json', items: out }, null, 2) + '\n')
  // 면 파일: 폴더를 비우고 다시 쓴다(원천에서 사라진 서체의 파일이 남지 않게).
  const faceOut = faceFiles(items)
  rmSync(FACES_DIR, { recursive: true, force: true })
  mkdirSync(FACES_DIR, { recursive: true })
  for (const [f, css] of Object.entries(faceOut)) writeFileSync(join(FACES_DIR, f), css)
  console.log(`gen-fonts: 항목 ${out.length}개(Google ${out.filter((i) => i.type === 'registry:font').length}) → registry/factory/fonts/registry.json · 면 파일 ${Object.keys(faceOut).length}개 → registry/factory/fonts/faces/`)
}
