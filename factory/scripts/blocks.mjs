// 블록 층(P3-2): registry/factory/blocks/<kind>/<variant>.{tsx,block.json,fixture.ts} → 검사 · 컴파일본 · registry:block 항목.
// 사용: node factory/scripts/blocks.mjs --check [--lenient] [--all-kinds]  (종료 0 = 문제 없음, 1 = 문제 있음, 2 = 인자 오류)
//   --lenient   kind 마다 변형 3개 규칙만 끈다(레인 도중). 메타·파일 셋·import·h1·훅 검사는 그대로다.
//   --all-kinds BLOCK_KINDS 29종이 모두 있는지도 본다(Task 9 출시 관문).
// 블록 원천은 모양을 cn-block-* 훅으로만 낸다. 훅 값은 styles/base.css 의 `/* blocks:<kind> */` 절에 있고, gen-blocks 가 부품처럼
// 컴파일해(compile-styles compileSource, base.css 지도) blocks/_compiled/ 에 쓴다 — 소비자에게 나가는 파일은 컴파일본이다
// (블록은 레시피마다 하나라 레시피 축 값이 아니라 base 값으로 굳힌다. 레시피 모양은 블록이 부르는 부품과 레시피 토큰이 준다).
// _shared 조각(blocks/_shared/<이름>.tsx)도 블록과 같은 원천 검사(import·훅·h1·이름)를 받는다(Task 1c — 리뷰 I-2).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { STATE_QUERY, BLOCK_STATES, READ_STATES, SUBMIT_STATES, stateQuery } from './block-states.mjs'
import { DYNAMICS_IDS } from './recipe.mjs'
import { heroLcpProblems } from './hero-lcp.mjs'

export { STATE_QUERY, BLOCK_STATES, READ_STATES, SUBMIT_STATES, stateQuery }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 16종(P3-2 Task 4~6) 뒤에 레인 D 가 붙인다 — D1 앱·결제 표면 5종(Task 11). 순서는 붙인 차례 그대로 둔다.
export const BLOCK_KINDS = ['nav', 'bottom-tab', 'footer', 'hero', 'social-proof', 'features', 'integrations', 'pricing', 'faq', 'final-cta', 'hours-location', 'contact-form', 'menu-price', 'product-list', 'dashboard-panel', 'state-screen', 'auth', 'account', 'paywall', 'retention', 'consent', 'onboarding', 'trust', 'review-list', 'referral', 'lead-capture', 'announcement', 'confirmation', 'product-info', 'shipping-returns', 'qna',
  // Task 7b 레인 — 새 kind 는 한 줄씩 뒤에 붙인다(다른 레인과 병합이 기계적이도록)
  'data-table',
  // 본문 섹션 렌더러(대장 C70 — 원형 noBlock content·part 섹션을 06 이 그린다, 레인 CONTENT)
  'content',
  // 떠 있는 행동(FV1 Task 5.8 — 가장자리 고정 퀵 메뉴·메신저 문의 단추·아래 고정 전화 줄)
  'floating-action',
  // 거르기 줄(FV1 Task 5.9 — 분류 칩·도구 줄·검색 줄, 상태는 주소 쿼리)
  'filter-bar',
]
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// 레시피 히어로(recipe.mjs HERO_IDS — P3-1 레시피 검수대 구성의 승격)가 아닌 히어로 블록: 모션 그래픽 히어로(P3-5 MOTKIT — 실사 영상·사진 + 키네틱 타이포).
// 레시피 검수대(/qa/recipes)에 구성이 없고 블록 검수대에서만 그려진다. 히어로 수를 세는 시험은 HERO_IDS + 이 표다.
export const MOTION_HEROES = ['kinetic-type-video', 'ken-burns-stills', 'punch-in-statement']
// factory v1 Task 5.7 히어로 6변형(3D 오브젝트·생성 그림 장면·지도 먼저·캐릭터 인사·영상 몽타주·제품 화면 창) — 이것도 레시피 검수대에 구성이 없고 블록 검수대에서만 그려진다.
export const FV1_HEROES = ['object-3d-orbit', 'illustration-scene', 'map-first', 'mascot-greeting', 'video-montage', 'screenshot-window']

// 메타 motion 에 쓸 수 있는 기법 id: DESIGN §8-6 카탈로그 id(recipe.mjs DYNAMICS) + gsap-techniques.ts 가 내보내는 도우미 이름의 케밥 표기(rise·count-up …).
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
export function techniqueIds(root = ROOT) {
  const src = readFileSync(join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts'), 'utf8')
  const helpers = [...src.matchAll(/^export (?:function|const) ([A-Za-z0-9]+)/gm)].map((m) => kebab(m[1]))
  return [...new Set([...DYNAMICS_IDS, ...helpers])].sort()
}
export const BLOCK_MOTION_IDS = techniqueIds()

// 상태 묶음: 읽기 상태(AsyncState)는 블록이 넷을 모두 그린다(block-contract) — 하나라도 적으면 넷 다. 제출 결과는 ok·field-error·server-error 셋이
// 함께 있어야 하고 pending 은 더할 수 있다(Task 6 Step 6).
const SUBMIT_REQUIRED = ['submit-ok', 'submit-field-error', 'submit-server-error']
// 마케팅·운영 규칙 ID(factory-rules.md §22 · 선택 자료 폴더의 marketing/_synthesis.md §1): L 법 바닥선 · P 가격·페이월 · O 가입·온보딩 · R 유지 · T 신뢰 · A 획득 ·
// V 추천 · X AX · M 계측. 블록이 지키는 규칙을 적는다(선택 — 레인 D 블록은 모두 적고, 적은 규칙마다 blocks-rules.test.mjs 에 정적 검사가 있다).
export const RULE_ID = /^[LPORTAVXM]\d+$/
export const BlockMeta = z.object({
  kind: z.enum(BLOCK_KINDS), variant: z.string().regex(ID), title: z.string().min(1),
  layout: z.string().regex(ID), density: z.enum(['compact', 'comfortable', 'spacious']),
  archetypes: z.array(z.enum(['brand', 'commerce', 'dashboard', 'detail', 'local', 'portfolio', 'public', 'pwa', 'saas', 'landing'])).min(1),
  archetypeKinds: z.array(z.string().regex(ID)).min(1),
  states: z.array(z.enum(BLOCK_STATES)), media: z.array(z.string().regex(ID)),
  motion: z.array(z.enum(BLOCK_MOTION_IDS)),
  rules: z.array(z.string().regex(RULE_ID, '규칙 ID 는 L·P·O·R·T·A·V·X·M 뒤에 숫자(예: L3)')).optional(),
  // 히어로 제목 폭(P3-2 Task 8, 대장 A20): full = 제목 칸이 히어로 내용 폭 전체(D2·D3 DisplayTitle 을 받는다), column = 좁은 칸·세로쓰기·숨김·글자 그림(받지 않는다). hero 만, 필수.
  titleWidth: z.enum(['full', 'column']).optional(), // 히어로 옆 띠(hero 가 아닌 kind)도 column 으로 적을 수 있다 — 아래 superRefine
  // 제목 길이 상한(대장 C296): 한 낱말을 화면 폭 가까이 크게 쓰는 히어로가 한 줄에 그릴 수 있는 제목 폭(em — _shared/title-fit titleUnits). 넘는 제목은 찍어내기(06-pages)가 같은 섹션의 다른 변형으로 바꾼다.
  // 값은 설계 크기(vw)에서 나온다: maxTitleUnits(설계 vw) = floor(96 ÷ 설계 vw × 10) ÷ 10 — title-fit.test.mjs 가 블록 원천의 DESIGN_VW 와 대조한다. hero 만.
  titleMaxUnits: z.number().positive().optional(),
  // 대담안 표시(factory v1 Task 5.4 · C1): bold 이면 boldMode 필수. motion = 움직임으로 대담(motion 칸이 비지 않아야 한다), layout = 배치·서체로 대담(public·dashboard 도 센다).
  // 원형마다 대담안 장면이 BOLD_MIN 개 이상인지는 bold-scenes.mjs 가 센다.
  boldness: z.enum(['standard', 'bold']).optional(),
  boldMode: z.enum(['motion', 'layout']).optional(),
  notes: z.string().optional(),
}).strict().superRefine((m, ctx) => {
  // hero 는 필수. 다른 kind 는 히어로 옆 띠(큰 제목 띠 — 레인 D2 announcement/launch-banner 등)만 적는다: 적으면 질감 배선을 받고(D2 는 full 일 때만).
  if (m.kind === 'hero' && m.titleWidth === undefined) ctx.addIssue({ code: 'custom', path: ['titleWidth'], message: 'hero 는 titleWidth(full|column)를 적는다' })
  if (m.titleMaxUnits !== undefined && m.kind !== 'hero') ctx.addIssue({ code: 'custom', path: ['titleMaxUnits'], message: 'titleMaxUnits 는 hero 만 적는다' })
  if (m.kind !== 'hero' && m.titleWidth === 'full') ctx.addIssue({ code: 'custom', path: ['titleWidth'], message: 'titleWidth full(DisplayTitle)은 hero 만 — 히어로 옆 띠는 column' })
  if (m.boldness === 'bold' && m.boldMode === undefined) ctx.addIssue({ code: 'custom', path: ['boldMode'], message: 'boldness bold 는 boldMode(motion|layout)를 적는다' })
  if (m.boldMode === 'motion' && m.motion.length === 0) ctx.addIssue({ code: 'custom', path: ['motion'], message: 'boldMode motion 은 motion 칸이 비지 않아야 한다' })
  if (m.boldMode === 'layout' && m.kind === 'hero' && m.titleWidth !== 'full') ctx.addIssue({ code: 'custom', path: ['boldMode'], message: 'boldMode layout 인 hero 는 titleWidth full 이어야 한다(배치·서체로 대담 — 전폭 제목)' })
  const dup = (a) => a.filter((x, i) => a.indexOf(x) !== i)
  for (const k of ['states', 'media', 'motion', 'rules']) for (const d of new Set(dup(m[k] ?? []))) ctx.addIssue({ code: 'custom', path: [k], message: `${d} 를 두 번 적었다` })
  const read = m.states.filter((s) => READ_STATES.includes(s))
  if (read.length && read.length !== READ_STATES.length) ctx.addIssue({ code: 'custom', path: ['states'], message: `읽기 상태는 넷을 모두 적는다(${READ_STATES.join('·')}) — 빠짐: ${READ_STATES.filter((s) => !read.includes(s)).join('·')}` })
  const sub = m.states.filter((s) => SUBMIT_STATES.includes(s))
  if (sub.length && SUBMIT_REQUIRED.some((s) => !sub.includes(s))) ctx.addIssue({ code: 'custom', path: ['states'], message: `제출 상태는 ${SUBMIT_REQUIRED.join('·')} 를 함께 적는다(submit-pending 은 더할 수 있다) — 빠짐: ${SUBMIT_REQUIRED.filter((s) => !sub.includes(s)).join('·')}` })
})

export const blockName = (kind, variant) => `block-${kind}-${variant}`
export const sharedName = (name) => `block-shared-${name}`
// 블록이 내보내는 컴포넌트 이름 — kind·variant 의 파스칼 표기(faq/two-column-index → FaqTwoColumnIndex). 갤러리가 이 이름으로 부른다.
export const blockComponent = (kind, variant) => `${kind}-${variant}`.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')

// 블록이 부를 수 있는 곳(Global Constraints 층 + react·gsap·같은 층의 _shared 조각). 두 번째 마디는 content/schemas/<원형> 하나뿐이다(리뷰 M-1 —
// 의존 항목으로 바꿀 수 없는 경로를 들이지 않는다). ax 는 폼 에이전트 속성·JSON-LD·갱신일(freshness — 신뢰 서명 trust/author-byline, FV1 Task 5.8) 셋만(Task 1c — 리뷰 I-3). _shared 는 kind 폴더에서 풀리는 ../_shared 만(M-2).
export const BLOCK_IMPORT_ALLOW = [
  /^react$/,
  /^@\/registry\/factory\/(ui|contract|content|lib|motion)\/[a-z0-9-]+$/,
  /^@\/registry\/factory\/content\/schemas\/[a-z0-9-]+$/,
  /^@\/registry\/factory\/ax\/(agent-form-attrs|json-ld|freshness)$/,
  /^@\/registry\/factory\/icons$/,
  /^\.\.\/_shared\/[a-z0-9-]+$/,
  /^gsap(\/[A-Za-z0-9]+)?$/,
  /^three(\/examples\/jsm\/(loaders\/(GLTFLoader|DRACOLoader)|environments\/RoomEnvironment)\.js)?$/, // 3D 히어로(object-3d-orbit)만 — 동적 import 로 3D 를 켤 때만 내려받는다(첫 화면 JS 예산 밖, FV1 Task 5.7 · 3D-GEN: 이미지에서 만든 GLB 를 읽는 로더)
]

// motion-gsap 한 항목에 든 파일(gen-kits MOTION_GSAP_FILES) — 블록이 이 파일을 부르면 의존 항목은 motion-gsap 이다.
const MOTION_GSAP = new Set(['motion-scale', 'use-gsap-scene', 'gsap-techniques', 'split-source', 'motion-boot'])
const BUILTIN = new Set(['react', 'react-dom', 'next'])

// import 지정자 목록(정적 import·export from·동적 import). registry-lib parseImports 는 @/registry/factory/icons 에서 멈추므로 따로 읽는다.
export const importSpecs = (source) => [...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])

const BLOCKS_DIR = (root) => join(root, 'registry', 'factory', 'blocks')
export const COMPILED = '_compiled'
const isSpecial = (name) => name.startsWith('_')

export function loadBlocks(root = ROOT) {
  const base = BLOCKS_DIR(root)
  if (!existsSync(base)) return []
  const out = []
  for (const kind of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !isSpecial(d.name)).map((d) => d.name).sort()) {
    const dir = join(base, kind)
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.block.json')).sort()) {
      const variant = f.slice(0, -'.block.json'.length)
      let raw
      try { raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch (e) { raw = { __parseError: e.message } }
      const tsx = join(dir, `${variant}.tsx`)
      const fx = join(dir, `${variant}.fixture.ts`)
      out.push({ dir, kind, variant, raw, meta: BlockMeta.safeParse(raw), source: existsSync(tsx) ? readFileSync(tsx, 'utf8') : null, fixture: existsSync(fx), fixtureSource: existsSync(fx) ? readFileSync(fx, 'utf8') : null })
    }
    // 메타 없이 원천만 있는 변형도 잡는다(.tsx 는 있는데 .block.json 이 없다).
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx')).sort()) {
      const variant = f.slice(0, -4)
      if (!existsSync(join(dir, `${variant}.block.json`))) out.push({ dir, kind, variant, raw: null, meta: { success: false, error: { issues: [{ path: [], message: '메타 .block.json 없음' }] } }, source: readFileSync(join(dir, f), 'utf8'), fixture: existsSync(join(dir, `${variant}.fixture.ts`)), fixtureSource: null })
    }
  }
  return out
}

// _shared 조각: registry/factory/blocks/_shared/<이름>.tsx → [{ name, source }].
export function loadShared(root = ROOT) {
  const dir = join(BLOCKS_DIR(root), '_shared')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.tsx')).sort().map((f) => ({ name: f.slice(0, -4), source: readFileSync(join(dir, f), 'utf8') }))
}

// 원천 안의 cn-* 훅 이름.
export const hooksOf = (source) => [...new Set(source.match(/\bcn-[a-z0-9-]+/g) ?? [])]

// ── 이름 가로채기(Task 1b 발견 → Task 1c 일반화, 리뷰 I-1) ─────────────────────────────────────────────────────────
// shadcn 4.21.0 import 풀기(Il)는 같은 add 묶음 안에서 `/<끝 이름>.tsx|.ts…` 로 끝나는 파일을 후보로 넣고 확장자 순서(.tsx → .ts)로 먼저 고른다.
// 그래서 이름이 같은 블록·조각(.tsx)은 소비자 쪽 .ts 모듈(lib/phone.ts·components/contract/*.ts·components/motion/use-*.ts ·
// components/icons/index.ts …)로 가는 import 를 자기 파일로 가로챈다(자기 import → next build 실패). 부품(components/ui/*.tsx)은 확장자가 같아
// 경로 접두에서 제자리가 이기므로 막지 않는다. 막는 이름: 블록이 부를 수 있거나 설치 닫힘이 까는 부품 밖 층(lib·contract·content·content/schemas·
// motion·ax·icons·hooks)의 모듈 끝 이름 전부(index.ts 는 폴더 이름 — icons). 목록은 파일에서 만든다(모듈이 늘면 따라 늘어난다).
const RESERVED_LAYERS = ['lib', 'contract', 'content', 'content/schemas', 'motion', 'ax', 'icons', 'hooks']
const reservedCache = new Map()
export function reservedNames(root = ROOT) {
  if (reservedCache.has(root)) return reservedCache.get(root)
  const out = new Map()
  for (const layer of RESERVED_LAYERS) {
    const dir = join(root, 'registry', 'factory', ...layer.split('/'))
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).sort()) {
      const m = f.match(/^(.+)\.tsx?$/)
      if (!m || m[1].endsWith('.test') || m[1].endsWith('.d')) continue
      const name = m[1] === 'index' ? layer.split('/').pop() : m[1]
      if (!out.has(name)) out.set(name, `registry/factory/${layer}/${f}`)
    }
  }
  reservedCache.set(root, out)
  return out
}

// import 하나 → 의존. { reg } registry 항목 · { npm } 패키지 · { skip } 레시피 base 가 까는 것 · null 바꿀 수 없음.
function importDep(spec) {
  let m
  if (/^@\/registry\/factory\/ui\/[a-z0-9-]+$/.test(spec) || spec === '@/registry/factory/icons') return { skip: true }
  if ((m = spec.match(/^@\/registry\/factory\/motion\/([a-z0-9-]+)$/))) return { reg: MOTION_GSAP.has(m[1]) ? 'motion-gsap' : m[1] }
  if ((m = spec.match(/^@\/registry\/factory\/content\/schemas\/([a-z0-9-]+)$/))) return { reg: `content-${m[1]}` }
  if ((m = spec.match(/^@\/registry\/factory\/(?:contract|content|lib|ax)\/([a-z0-9-]+)$/))) return { reg: m[1] }
  if ((m = spec.match(/^\.\.\/_shared\/([a-z0-9-]+)$/))) return { reg: sharedName(m[1]) }
  if (spec.startsWith('@/') || spec.startsWith('.')) return null
  const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
  return BUILTIN.has(pkg) ? { skip: true } : { npm: pkg }
}

// useGsapScene(…) 호출의 인자 글(괄호 짝을 센다 — 따옴표 안은 건너뛴다) 안에 level 키가 있는가(Task 1c, 리뷰 I-7: 블록은 level 을 넘기지 않는다).
export function sceneLevelPassed(source) {
  for (const m of source.matchAll(/\buseGsapScene\s*\(/g)) {
    let depth = 1, quote = null, i = m.index + m[0].length
    for (; i < source.length && depth > 0; i++) {
      const c = source[i]
      if (quote) { if (c === quote && source[i - 1] !== '\\') quote = null; continue }
      if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '(') depth++
      else if (c === ')') depth--
    }
    if (/(?:[{,]\s*)level\s*[:,}]/.test(source.slice(m.index, i))) return true
  }
  return false
}

// 블록·조각 원천 하나의 검사(모양 규칙은 lint-ui 몫). opts.hooks: base.css 훅 이름 집합 · opts.shared: _shared 조각 이름 집합 · allowH1: hero 만.
function sourceProblems(at, source, { hooks, shared, allowH1 }) {
  const p = []
  for (const spec of importSpecs(source)) {
    if (!BLOCK_IMPORT_ALLOW.some((re) => re.test(spec))) { p.push(`${at} — 허용 밖 import ${spec}`); continue }
    if (importDep(spec) === null) p.push(`${at} — 의존 항목으로 바꿀 수 없는 import ${spec}`)
    const sh = spec.match(/^\.\.\/_shared\/([a-z0-9-]+)$/)?.[1]
    if (sh && shared && !shared.has(sh)) p.push(`${at} — 없는 _shared 조각 ${sh}`)
  }
  if (!allowH1 && /<h1[\s>]/.test(source)) p.push(`${at} — h1은 hero kind만 쓴다`)
  // 블록 안 DOM id 는 모두 id prop(섹션 id)에서 파생된다 — 글자 그대로 쓰면 같은 블록을 한 쪽에 둘 그릴 때 id 가 겹친다(FINAL-WF5, 대장 C423). 컴포넌트 prop(<PolicyTable id="…">)은 DOM id 가 아니다.
  for (const m of source.matchAll(/\bid=(?:"([^"]*)"|'([^']*)'|\{\s*(["'])([^"']*)\3\s*\})/g)) {
    const lineAt = source.slice(source.lastIndexOf('\n', m.index) + 1, source.indexOf('\n', m.index) < 0 ? undefined : source.indexOf('\n', m.index))
    if (/data:image|url\(/.test(lineAt)) continue // 배경 그림 data URI 안의 SVG 속성이다 — DOM 이 아니다
    const tag = [...source.slice(0, m.index).matchAll(/<([A-Za-z][\w.]*)/g)].at(-1)?.[1]
    if (tag && /^[a-z]/.test(tag)) { p.push(`${at} — DOM id 를 글자 그대로 썼다 (id="${m[1] ?? m[2] ?? m[4]}") — \`\${id}-…\` 로 섹션 id 에서 파생한다(같은 블록을 한 쪽에 둘 그리면 id 가 겹친다)`); break }
  }
  if (sceneLevelPassed(source)) p.push(`${at} — useGsapScene 에 level 을 넘기지 않는다(장면이 뿌리의 --wf-motion 을 읽는다 — 넘기면 서버 렌더 뒤 등장이 두 번 시작한다)`)
  for (const h of hooksOf(source)) {
    // 부품 훅(cn-card 등)은 블록 컴파일이 base 값으로 굳혀 레시피 모양이 닿지 않는다(리뷰 I-4 가) — 부품 모양은 부품 컴포넌트로 들인다.
    if (!h.startsWith('cn-block-')) p.push(`${at} — 부품 훅 ${h} — 블록은 cn-block-* 훅만 쓴다(부품 모양은 부품 컴포넌트로)`)
    else if (hooks && !hooks.has(h)) p.push(`${at} — base.css 에 없는 훅 ${h}`)
  }
  return p
}

// 히어로 × 새 축 D·X(Task 8, 대장 A20): 모든 히어로는 조립하는 쪽이 넘긴 Texture 를 뿌리 맨 앞 층으로 깐다(HeroTexture).
// titleWidth full 히어로는 display(DisplayTitle)를 받아 h1 로 그린다(<Display as="h1" …>). column 히어로는 display 를 받지도 그리지도 않는다 —
// D2(10~20vw)를 좁은 칸에 넣으면 음절마다 줄이 바뀐다. 레시피 쪽 검사는 recipe.mjs displayHeroReport(lint display-hero-width).
export function heroAxisProblems(at, source, titleWidth) {
  const p = []
  const code = source.replace(/\/\/.*$/gm, '')
  if (!/<HeroTexture\s+texture=\{texture\}/.test(code)) p.push(`${at} — 히어로는 뿌리 맨 앞에 <HeroTexture texture={texture} /> 를 둔다(X1~X8 레시피의 질감 층)`)
  const uses = /<Display\b/.test(code) || /\bdisplay\s*[,}=:]/.test(code)
  if (titleWidth === 'full' && !/<Display\s+as="h1"/.test(code)) p.push(`${at} — titleWidth full 히어로는 display 를 받아 <Display as="h1" …> 로 제목을 그린다(D2·D3 레시피)`)
  if (titleWidth === 'column' && uses) p.push(`${at} — titleWidth column 히어로는 display(DisplayTitle)를 쓰지 않는다 — D2 는 전폭 히어로에서만(좁은 칸에서는 음절마다 줄이 바뀐다)`)
  return p
}

// opts.hooks: base.css 의 훅 이름 집합(주면 원천의 모르는 훅을 잡는다 — 컴파일러는 모르는 훅을 조용히 지운다).
// opts.shared: _shared 조각 이름 집합(주면 없는 조각 import 를 잡는다). opts.sharedSources: [{ name, source }](주면 조각 원천도 검사한다).
// opts.reserved: 가로채기 금지 이름(기본 저장소 파일에서 — reservedNames).
export function blockProblems(blocks, { minVariants = 3, requireKinds = false, hooks = null, shared = null, sharedSources = null, reserved = reservedNames() } = {}) {
  const p = []
  const byKind = new Map()
  const hijack = (at, name, why) => `${at} — 이름 ${name} 는 쓸 수 없다(소비자 설치에서 ${why} 로 가는 import 를 가로챈다)`
  for (const b of blocks) {
    const at = `${b.kind}/${b.variant}`
    if (reserved.has(b.variant)) p.push(hijack(at, b.variant, reserved.get(b.variant)))
    else if (shared?.has(b.variant)) p.push(hijack(at, b.variant, `_shared 조각 ${b.variant}`))
    const list = byKind.get(b.kind) ?? []; list.push(b); byKind.set(b.kind, list)
    if (!b.meta.success) { p.push(`${at} — 메타 오류: ${b.meta.error.issues.map((i) => `${i.path.join('.')} ${i.message}`.trim()).join('; ')}`); continue }
    if (b.meta.data.kind !== b.kind || b.meta.data.variant !== b.variant) p.push(`${at} — 메타 kind/variant가 경로와 다름`)
    if (b.source === null) p.push(`${at} — 원천 .tsx 없음`)
    if (!b.fixture) p.push(`${at} — 예시 콘텐츠 .fixture.ts 없음`)
    if (b.fixtureSource !== null && b.fixtureSource !== undefined) for (const k of ['fixture', 'fixtureMax', 'fixtureMin']) if (!new RegExp(`export const ${k}\\b`).test(b.fixtureSource)) p.push(`${at} — 예시 콘텐츠에 ${k} 없음`)
    if (!b.source) continue
    p.push(...sourceProblems(at, b.source, { hooks, shared, allowH1: b.kind === 'hero' }))
    if (b.meta.data.titleWidth) p.push(...heroAxisProblems(at, b.source, b.meta.data.titleWidth))
    if (b.kind === 'hero') p.push(...heroLcpProblems(at, b.source)) // 첫 화면 글·그림은 등장 연출이 숨기지 않는다(대장 C173)
    const comp = blockComponent(b.kind, b.variant)
    if (!new RegExp(`export (function|const) ${comp}\\b`).test(b.source)) p.push(`${at} — 컴포넌트 ${comp} 를 내보내지 않음`)
    if (!b.source.includes(`data-block="${b.kind}-${b.variant}"`)) p.push(`${at} — 섹션 루트에 data-block="${b.kind}-${b.variant}" 없음`)
  }
  for (const [kind, list] of byKind) {
    const seen = new Set()
    for (const b of list) if (b.meta.success) { if (seen.has(b.meta.data.layout)) p.push(`${kind}: layout '${b.meta.data.layout}' 중복`); seen.add(b.meta.data.layout) }
    if (list.length < minVariants) p.push(`${kind}: 변형 ${list.length}개 — ${minVariants}개 이상 필요`)
  }
  if (requireKinds) for (const k of BLOCK_KINDS) if (!byKind.has(k)) p.push(`${k}: 블록 없음`)
  // _shared 조각: 이름(ID·가로채기)은 이름 집합만으로, 원천 검사는 sharedSources 를 줄 때.
  const names = new Set([...(shared ?? []), ...(sharedSources ?? []).map((s) => s.name)])
  for (const name of [...names].sort()) {
    const at = `_shared/${name}`
    if (!ID.test(name)) p.push(`${at} — 조각 이름은 소문자·숫자·하이픈(${ID})`)
    if (reserved.has(name)) p.push(hijack(at, name, reserved.get(name)))
  }
  for (const s of sharedSources ?? []) p.push(...sourceProblems(`_shared/${s.name}`, s.source, { hooks, shared: names, allowH1: false }))
  return p
}

// 블록·조각 원천의 import → registryDependencies 이름·npm 의존.
//   ui 부품·아이콘 정본 모듈은 넣지 않는다 — 레시피 base 가 레시피 모양 부품과 아이콘 어댑터·정본 모듈 components/icons/index.ts 를 깐다(기본 모양 부품이 레시피 부품을 덮는다, gotcha).
//   바꿀 수 없는 import 는 멈춘다 — blockProblems 가 먼저 문제로 알린다(gen-blocks 는 문제가 있으면 여기까지 오지 않는다).
export function blockDeps(source) {
  const reg = new Set(), npm = new Set()
  for (const spec of importSpecs(source)) {
    const d = importDep(spec)
    if (d === null) throw new Error(`블록 import 를 의존으로 바꿀 수 없다: ${spec}`)
    if (d.reg) reg.add(d.reg)
    if (d.npm) npm.add(d.npm)
  }
  return { registry: [...reg].sort(), npm: [...npm].sort() }
}

const pinNpm = (d, versions) => (versions?.[d] ? `${d}@${versions[d]}` : d)

// registry:block 항목 — 파일은 컴파일본(_compiled/<kind>/<variant>.tsx), 경로는 blocks/registry.json 기준.
// meta.requires: 'recipe' — 레시피 base 하나와 함께 설치해야 닫힌다(install-closure 가 r1-measure base 와 묶어 본다).
export function blockItems({ repo, ref, versions, root = ROOT }) {
  const pin = ref ? `#${ref}` : ''
  const dep = (n) => `${repo}/${n}${pin}`
  const blocks = loadBlocks(root).filter((b) => b.meta.success && b.source)
  const items = blocks.map((b) => {
    const { registry, npm } = blockDeps(b.source)
    const m = b.meta.data
    return {
      name: blockName(b.kind, b.variant), type: 'registry:block', title: m.title,
      description: `web-factory 블록 ${b.kind}/${b.variant} — layout ${m.layout}. 레시피(registry:base) 하나를 먼저 설치한다`,
      dependencies: npm.map((d) => pinNpm(d, versions)),
      registryDependencies: registry.map(dep),
      files: [{ path: `${COMPILED}/${b.kind}/${b.variant}.tsx`, type: 'registry:block', target: `components/blocks/${b.kind}/${b.variant}.tsx` }],
      meta: { requires: 'recipe', kind: b.kind, variant: b.variant, component: blockComponent(b.kind, b.variant), layout: m.layout, density: m.density, archetypes: m.archetypes, archetypeKinds: m.archetypeKinds, states: m.states, media: m.media, motion: m.motion, ...(m.rules ? { rules: m.rules } : {}) },
    }
  })
  const shared = loadShared(root).map(({ name, source }) => {
    const { registry, npm } = blockDeps(source)
    return {
      name: sharedName(name), type: 'registry:block', title: `블록 공유 조각 ${name}`,
      description: `web-factory 블록 공유 조각 ${name} — 블록 항목이 의존으로 끌어온다`,
      dependencies: npm.map((d) => pinNpm(d, versions)),
      registryDependencies: registry.map(dep),
      files: [{ path: `${COMPILED}/_shared/${name}.tsx`, type: 'registry:block', target: `components/blocks/_shared/${name}.tsx` }],
      meta: { requires: 'recipe', shared: true },
    }
  })
  return [...items, ...shared].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

// CLI 검사에 쓰는 base.css 훅 집합.
export async function baseHooks(root = ROOT) {
  const { createStyleMap } = await import('shadcn/utils')
  return new Set(Object.keys(createStyleMap(readFileSync(join(root, 'registry', 'factory', 'styles', 'base.css'), 'utf8'))))
}

export function parseCheckArgs(argv) {
  const known = new Set(['--check', '--lenient', '--all-kinds'])
  const bad = argv.filter((a) => !known.has(a))
  if (!argv.includes('--check') || bad.length) return null
  return { minVariants: argv.includes('--lenient') ? 0 : 3, requireKinds: argv.includes('--all-kinds') }
}

// 저장소 전체 검사(CLI·gen-blocks 가 같이 쓴다): 블록 + _shared 조각 원천.
export function repoProblems(root, opts, hooks) {
  const sharedSources = loadShared(root)
  return blockProblems(loadBlocks(root), { ...opts, hooks, shared: new Set(sharedSources.map((s) => s.name)), sharedSources, reserved: reservedNames(root) })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const opts = parseCheckArgs(process.argv.slice(2))
  if (!opts) { console.error('사용: node factory/scripts/blocks.mjs --check [--lenient] [--all-kinds]'); process.exit(2) }
  const blocks = loadBlocks(ROOT)
  const probs = repoProblems(ROOT, opts, await baseHooks(ROOT))
  for (const x of probs) console.error(`blocks: ${x}`)
  console.log(`블록 검사: ${blocks.length}개(kind ${new Set(blocks.map((b) => b.kind)).size}종${opts.minVariants ? '' : ', --lenient'}) · 조각 ${loadShared(ROOT).length}개, 문제 ${probs.length}`)
  process.exit(probs.length ? 1 : 0)
}
