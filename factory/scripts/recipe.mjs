// 레시피 원천 registry/factory/recipes/<id>/DESIGN.md(YAML 머리 + 본문) → 검사 → 생성.
// 생성물: registry/factory/r/<id>/ui/*.tsx(+GENERATED.md) · r/<id>/<id>.css(순수 CSS) · recipes/<id>/README.generated.md(에이전트용 안내).
// 레지스트리 항목(registry/factory/r/registry.json)은 gen-registry.mjs 가 recipeRegistry() 로 만든다.
//
// 머리 스키마(RecipeHead, zod):
//   id          [a-z0-9-], 전역 유일(다른 층 항목 이름과 겹치지 않는다)
//   name        한국어 이름            mood   3개
//   axes        { button, input, surface, table, header, radius, shadow } — styles/compat.json 의 값 id(B1 …)
//   motion      M0~M3                  icons  { library: lucide|phosphor|tabler, weight: G1~G5 }
//   fonts       { display, displayKo?, body, mono|null, prose? } — 각 { family, item: font-<slug>, tuned? }  (변수 --font-<slug>-wf 는 Task 8 폰트 항목, registry-lib `fontVar`) — body 는 한글 서체(qa/data/korean-fonts.json), display 는 라틴이어도 된다.
//               display = 부품 제목(font-heading), displayKo = 한글 제목체(font-heading 에서 display 뒤, 키트 한글 항목 — Task 10c), prose = 부품이 쓰지 않는 긴 글 목소리(font-prose, 선택 — 키트 항목만). 단일 굵기 display 는 singleWeightRules
//               display.weight = 제목 굵기(--wf-heading-weight), display.weightKo = 한글 제목 굵기(--wf-heading-weight-ko, 선택 — Task 14c). font-heading-ko = displayKo → 본문(라틴 display 를 건너뛴 한글 제목 스택)
//   color       { light, dark } — shadcn 표준 변수 이름 → oklch(…). 필수 키 COLOR_KEYS(상태색 success·warning·info + -foreground 포함, T7-M13), 두 테마의 키 집합이 같다 — 대비를 재는 토큰은 불투명(알파 없음).
//               선 구획 값(C2·T4·H3)을 고르면 --border 도 배경 대비 3:1(T7-M9)
//               색 논리 K6·K7 은 면 색 field-1·field-2(+ -foreground), K8 은 칸 색 block-1~block-4(+ -foreground)를 더 둔다 → Tailwind bg-field-1 등(colorTheme)
//   references  카드 id 또는 URL, 2개 이상     archetypes  잘 맞는 원형(registry/factory/archetypes/*.json 이름)
//   colorLogic  K1~K8(style_axes 축 10, DESIGN §5-B)   defaultTheme  light(기본)|dark
//   dynamics    DESIGN §8-6 역동 기법 id 1~3개(DYNAMICS)   alternates  보드 B안 { colorLogic?, color?: { light, dark }, motion?, dynamics?, fonts?: { display?, displayKo? }, note } (선택, 기계 데이터 — applyAlternate·alternateCombos)
//   motion 값은 모션 토큰(--duration-*·--ease-*, gen-kits MOTION_TOKENS)으로도 나간다(시험작 D7)
//   signature   대표 장면 카탈로그 id 1~3개(선택, SCENES) — 레시피 보드·갤러리 /qa/recipes?r=<id>&scene=<장면>(Task 8)
//   archetypeConditions  원형별 쓰임 조건 { 원형: 한 줄 }(선택) → ai/tasks 후보 condition·meta.recipe (Task 7 fix 1)
//   면 스코프: 면·칸 키가 있으면 [data-face="<키>"] 규칙을 생성한다(faceRules — 면 위 ring·primary·보조 글자를 면의 짝으로, lint face-contrast)
// 본문: ## 분위기 · ## 쓰는 법 · ## 하지 말 것 · ## 레퍼런스에서 가져온 기법 (그 밖의 절은 자유 — 결정 기록 등).
//
// 사용: node factory/scripts/recipe.mjs [--ref vX.Y.Z]                       recipes/*/DESIGN.md 전부 검사·생성(저장소)
//       node factory/scripts/recipe.mjs <DESIGN.md> --out <폴더> [--ref …]   한 벌만, 다른 폴더에(설치 실험·시험용)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { createStyleMap } from 'shadcn/utils'
import { BASE_CSS, AXIS_ORDER, AXIS_DEFAULTS, axisValue, listValues } from './axes.mjs'
import { checkCompat, checkCompatWarnings, checkRecipeRules, checkAxisRecipeRules, COMPAT, LINE_VALUES } from './compat.mjs'
import { ratio, alphaOf, oklchToLinearSrgb } from './lib/contrast-lib.mjs'
import { parseOklch, tailwindCopy, isCreamBackground, TAILWIND_MAX_DIST, TAILWIND_MIN_C, CREAM, BRAND_KEYS, FIELD_BANDS, FIELD_CREAM, FIELD_MAX, TEXT_MIN, TEXT_TARGET, DUO, BLOCKS, DARK_DEFAULT_BG, isNeon, inBand, hueGroupsAt } from './lib/palette-rules.mjs'
import { hueDist, ACCENT_C } from './lib/palette-lib.mjs'
import { compileSource, MARKER } from './compile-styles.mjs'
import { parseImports, pinDependency, parseRef, BASE_ITEM, fontVar, ICON_LIBRARIES } from './lib/registry-lib.mjs'
import { iconAdapter, iconVars, motionVars } from './gen-kits.mjs'
import { radiusToken, maskRadiusToken } from './gen-radius-axis.mjs'
import { ARCHETYPE_IDS } from './archetypes.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FACTORY = join(ROOT, 'registry', 'factory')
export const UI_SRC = join(FACTORY, 'ui-src')
export const RECIPES_DIR = join(FACTORY, 'recipes')
export const R_DIR = join(FACTORY, 'r')
export const REPO = 'nowwcastle-sudo/sitebrew'
export const GENERATOR = 'factory/scripts/recipe.mjs'
const BANNER = `생성물 — ${GENERATOR} 로 다시 만든다. 손으로 고치지 않는다.`

// ── 스키마 ──────────────────────────────────────────────────────────────
export const STATUS = ['success', 'warning', 'info']
// 상태색을 Tailwind 유틸(bg-success 등)로 쓰게 cssVars.theme 에 잇는다 — 소비자 @theme inline 에 들어간다.
export const STATUS_THEME = Object.fromEntries(STATUS.flatMap((k) => [[`color-${k}`, `var(--${k})`], [`color-${k}-foreground`, `var(--${k}-foreground)`]]))
export const COLOR_KEYS = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring',
  // 의미 상태색(T7-M13, DESIGN §5 MUST 성공·경고·정보 — 오류는 destructive). 면 색 + 그 위 글자색.
  ...STATUS.flatMap((k) => [k, `${k}-foreground`])]
export const ARCHETYPES = ARCHETYPE_IDS
export const BODY_SECTIONS = ['분위기', '쓰는 법', '하지 말 것', '레퍼런스에서 가져온 기법']

// 색 논리(style_axes 축 10, DESIGN §5-B). K6~K8 은 유채색 면을 칠한다 — 면·칸 키와 수치 규칙(lib/palette-rules.mjs)이 따른다.
// K9 단색 램프(P3-2 Task 16a, 대표 판단 2026-09-29): 한 색상각(또는 무채)의 명도 단계만, 강조색 없음 — lint k9-mono.
export const COLOR_LOGIC_LABEL = { K1: '단일 액센트·중립 우세', K2: '다차원 팔레트', K3: '문서형 무채색', K4: '브루탈 두 모드', K5: '에디토리얼 럭셔리', K6: '색 면', K7: '듀오톤', K8: '색 블록', K9: '단색 램프' }
export const COLOR_LOGICS = Object.keys(COLOR_LOGIC_LABEL)
export const BOLD_LOGICS = ['K6', 'K7', 'K8']
// 역동 기법(DESIGN §8-6 표). still: 시간에 따라 움직이지 않는 기법 — M0(등장 연출 없음) 레시피는 이것만 고른다. minMotion: 그 모션 값에서만.
export const DYNAMICS = {
  'split-text': { label: '글자 분할 등장' },
  'oversize-crop': { label: '오버사이즈 타입 크롭', still: true },
  'variable-axis': { label: '가변 폰트 축 애니메이션' },
  'svg-draw': { label: 'SVG 선 그리기' },
  'clip-reveal': { label: 'clip-path 리빌' },
  'tilt-3d': { label: '3D 기울임·원근' },
  'magnetic-cta': { label: '자석 버튼(주 CTA 하나)', minMotion: 'M3' },
  'sticky-stack': { label: '스티키 스태킹 카드' },
  marquee: { label: '마퀴(텍스트 띠, 정지 버튼 필수)' },
  'mesh-gradient': { label: '코닉·메시 그라디언트' },
  grain: { label: '그레인(feTurbulence)', still: true },
  blend: { label: '블렌드 모드', still: true },
  'view-transition': { label: 'View Transitions' },
}
export const DYNAMICS_IDS = Object.keys(DYNAMICS)
// 모션 값 하나가 허락하는 기법(lint dynamics-motion 과 같은 규칙): M0 은 정지 기법만, minMotion 이 있는 기법은 그 모션에서만. 색 논리(K)는 기법을 제한하지 않는다.
export const dynamicsAllowed = (motion) => DYNAMICS_IDS.filter((d) => !(motion === 'M0' && !DYNAMICS[d].still) && !(DYNAMICS[d].minMotion && motion !== DYNAMICS[d].minMotion))
// 대표 장면 카탈로그(Task 8 — 컨트롤러 판정 2026-09-27): 레시피 보드가 공통 견본보다 먼저 보이는 장면. 갤러리 /qa/recipes?r=<id>&scene=<id>
// (app/qa/recipes/scenes.tsx)가 레시피 스코프로 부품을 조합해 그린다 — 블록이 아니다(블록은 P3-2). photo: 상업 무료·라이선스 사진이 있어야 그린다.
export const SCENES = {
  'hero-display': { label: '첫 화면 제목·부제·주 CTA' },
  'hero-photo': { label: '사진 처리(레시피의 이미지 결)', photo: true },
  ledger: { label: '근거 표·신뢰도 칩' },
  'data-strip': { label: '수치 띠·빗금 예측 막대' },
  'menu-board': { label: '메뉴·가격표' },
  'notice-list': { label: '공지·민원 목록(KRDS)' },
  'doc-page': { label: '문서형 본문·목차' },
  'product-hero': { label: '상세페이지 첫 장(860px 열)' },
  'app-shell': { label: '모바일 하단 탭·카드' },
  bento: { label: '크기가 다른 칸 3~4개 + 칸 안 조작 하나' },
  // 첫 화면 히어로(Task 10d): 레시피 머리 hero(B는 alternates.hero)가 고른 HEROES 카탈로그 구성으로 첫 화면 한 장을 그린다.
  hero: { label: '첫 화면 히어로(머리 hero · B는 alternates.hero)' },
}
export const SCENE_IDS = Object.keys(SCENES)
// 히어로 카탈로그(Task 10d — 레퍼런스 DNA 카드의 「히어로 배치 2수」): id = 구성을 말하는 이름(레시피 이름이 아니다 — P3-2 블록으로 옮겨 쓴다).
// 구성마다 app/qa/recipes/heroes/<id>.tsx 한 벌(gen-recipes-gallery 가 .tmp/recipes/heroes.ts 로 모두 잇는다 — 파일이 없으면 생성이 멈춘다).
// 새 히어로 장면은 이 표에 한 줄 + 위 틀 파일 한 벌이 전부다(다른 곳에 따로 등록하지 않는다) — 순서는 docs/guides/add-recipe.md 5단계.
// 묶음 전체에서 hero 와 alternates.hero 는 모두 달라야 한다(recipes-distinct.mjs heroProblems).
export const HEROES = {
  'step-band-orbit': { label: '단계 띠 3칸 + 궤도 도면' },
  'baseline-split': { label: '바닥선을 공유하는 두 칸 + 치수선 면' },
  'cropped-title-list': { label: '오른쪽 끝에서 잘리는 제목 목록' },
  'inline-chip-title': { label: '문장 속 칩 + 대괄호 캡션 대칭' },
  'staggered-oval-frame': { label: '엇갈린 두 줄 + 가운데 타원 액자' },
  'twin-panels': { label: '나란한 큰 칸 두 장 + 칸 밑 캡션' },
  'stepped-crop-figure': { label: '계단식으로 물린 오른쪽 그림' },
  'centered-proof-panel': { label: '가운데 제목 + 접힘선을 넘는 증거 패널' },
  'banded-full-bleed': { label: '불투명 머리 띠 아래 전폭 사진 + 좌상단 한 줄' },
  'crosshair-quadrants': { label: '십자 기준선 4분면 + 교차점 표식' },
  'identity-strip-banner': { label: '식별 띠·메가메뉴 아래 둥근 짙은 배너 카드' },
  'leaking-app-panel': { label: '수치 칩 + 세리프 세 줄 + 오른쪽 아래로 새는 앱 패널' },
  'narrow-title-wide-window': { label: '4칸 두꺼운 제목 + 8칸 앱 창 + 창 위 공지 알약' },
  'grid-lines-baseline-word': { label: '보이는 12칸 세로선 + 바닥에 걸친 응축 한 낱말' },
  'vertical-title-slides': { label: '전폭 저녁 그림 + 세로쓰기 한 줄 + 슬라이드 눈금' },
  'framed-card-outline-title': { label: '여백 액자 속 둥근 카드 + 외곽선·채움 교대 대문자 + 도는 배지' },
  'layered-landscape-logotype': { label: '층층 평면 풍경 + 가운데 기운 낱자 로고타입' },
  'baseline-news-app-window': { label: '두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창' },
  'crop-marks-typed-title': { label: '재단 표시 + 타자로 써지는 제목 + 딱딱한 그림자 버튼' },
  // FV1 레인 DRAFTS(보드 A2, 2026-10-11): 위 19개는 라이브러리 r1~r10 의 A·B 가 이미 다 쓴다 — 확정한 r12~r16 이 각자 아직 아무 레시피도 쓰지 않은
  // 블록 히어로(MOTION_HEROES·FV1_HEROES)를 카탈로그에 올려 쓴다. 블록 자체는 그대로이고 검수대 틀만 app/qa/recipes/heroes/<id>.tsx 에 더했다.
  'map-first': { label: '전폭 큰 제목 + 정적 지도 위 지점 표지 + 지점 카드' },
  'illustration-scene': { label: '전폭 큰 제목 + 전폭 그림 한 장 + 그림 밖 바탕색 카드' },
  'punch-in-statement': { label: '바탕색 위 초대형 한 문장 + 착지하는 주색 키워드 + 확대 컷 틀' },
  'ken-burns-stills': { label: '첫 화면 전체 사진 무대 + 켄 번스 사진 몽타주 + 이름표 띠' },
  'video-montage': { label: '첫 화면 전체 하드 컷 영상 몽타주 + 그 위 막 + 큰 제목' },
}
export const HERO_IDS = Object.keys(HEROES)
// 면(K6·K7)·칸(K8) 색 키. 각 키에 글자색 짝 <키>-foreground. K6 면 색은 2개까지(DESIGN §5-B) — 그래서 field-1·field-2 뿐이다.
export const FIELD_KEYS = ['field-1', 'field-2']
export const BLOCK_KEYS = ['block-1', 'block-2', 'block-3', 'block-4']
const ROLE_KEY = /^(field|block)-\d+(-foreground)?$/
export const roleKeys = (colors) => Object.keys(colors ?? {}).filter((k) => ROLE_KEY.test(k))
// cssVars.theme 의 색 연결: 상태색 + 레시피가 가진 면·칸 키(bg-field-1 · text-field-1-foreground · bg-block-2 …).
export const colorTheme = (r) => ({ ...STATUS_THEME, ...Object.fromEntries(roleKeys(r.color?.light).sort().map((k) => [`color-${k}`, `var(--${k})`])) })

const Colors = z.object(Object.fromEntries(COLOR_KEYS.map((k) => [k, z.string()]))).catchall(z.string())
const Motion = z.enum(['M0', 'M1', 'M2', 'M3'])
const Dynamics = z.array(z.enum(DYNAMICS_IDS)).min(1).max(3).refine((a) => new Set(a).size === a.length, '같은 기법을 두 번 적었다')
// 보드 B안(Task 6b fix 1 — 리뷰 I1·I2): 기계가 적용할 수 있는 완전한 값이다. color 는 colorLogic 과 한 묶음으로 적용되는 색 덮어쓰기
// (면·칸 키, K7 이면 primary 등 — 두 테마). applyAlternate 로 B를 적용한 머리는 A와 같은 lint 를 통과해야 한다.
const ColorPatch = z.record(z.string(), z.string())
const Font = z.object({ family: z.string().min(1), item: z.string().regex(/^font-[a-z0-9-]+$/), tuned: z.string().optional() })
// display.weight(선택, Task 6 fix 1 — 리뷰 I1): 제목 굵기(숫자). --wf-heading-weight 와 .font-heading 기본 굵기로 나간다(headingWeightRules).
// 키트 항목이 실제로 가진 굵기여야 한다(lint font-weight — 정적 서체는 키트 font.weight, 가변 서체는 wght 축 범위).
// display.weightKo(선택, Task 14c — Task 10b 자동 규칙을 명시 필드로): 제목의 한글 굵기. 적으면 --wf-heading-weight-ko 로 나가고
// .font-heading·.font-heading-ko 가 display.weight 보다 먼저 읽는다. 없으면 한글도 display 굵기를 따른다. 한글 제목 서체(displayKo, 없으면 본문)가
// 실제로 가진 굵기여야 한다(lint font-weight). display 에 붙어 있어 B안이 display 를 바꾸면 A 값이 B로 넘어가지 않는다.
const DisplayFont = Font.extend({ weight: z.number().int().min(100).max(900).optional(), weightKo: z.number().int().min(100).max(900).optional() })
// B안 서체(Task 10c): 선택지마다 제목 서체가 다르다 — display(라틴)·displayKo(한글 제목체)만 바꾼다. 본문은 A 그대로(대표 원칙 「본문은 한글」).
const AltFonts = z.object({ display: DisplayFont.optional(), displayKo: Font.optional() }).strict().refine((f) => f.display || f.displayKo, 'fonts 는 display·displayKo 중 하나 이상')
// color 는 colorLogic 과 한 묶음이다. 색 논리를 그대로 두고 팔레트만 새로 두는 B안(Task 10d — 레퍼런스 DNA 의 B 팔레트)은 colorLogic 에 A와 같은 값을 적는다.
// hero(Task 10d): B안의 첫 화면 구성 — HEROES 카탈로그 id.
const Alternates = z.object({ colorLogic: z.enum(COLOR_LOGICS).optional(), color: z.object({ light: ColorPatch, dark: ColorPatch }).strict().optional(),
  motion: Motion.optional(), dynamics: Dynamics.optional(), fonts: AltFonts.optional(), hero: z.enum(HERO_IDS).optional(), note: z.string().min(1) }).strict()
  .refine((a) => a.colorLogic || a.motion || a.dynamics || a.fonts || a.hero, 'B안은 colorLogic·motion·dynamics·fonts·hero 중 하나 이상을 바꾼다')
  .refine((a) => !a.color || a.colorLogic, 'color 는 colorLogic 과 한 묶음으로 둔다(색 논리를 그대로 두는 새 팔레트면 colorLogic 에 A와 같은 값을 적는다)')
  .refine((a) => !a.color || Object.keys(a.color.light).sort().join() === Object.keys(a.color.dark).sort().join(), 'color.light 와 color.dark 의 키가 같아야 한다')
export const RecipeHead = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  mood: z.array(z.string().min(1)).length(3),
  // display(D)·texture(X)는 선택 칸(Task 16a, J6) — 없으면 AXIS_DEFAULTS(D1·X0). 기존 10벌은 적지 않아 생성물이 그대로다.
  axes: z.object(Object.fromEntries(AXIS_ORDER.map((a) => [a, a in AXIS_DEFAULTS ? z.string().optional() : z.string()]))).strict(),
  motion: Motion,
  colorLogic: z.enum(COLOR_LOGICS),
  defaultTheme: z.enum(['light', 'dark']).optional(),
  dynamics: Dynamics,
  alternates: Alternates.optional(),
  // 대표 장면(Task 8): 카탈로그 id 1~3개(선택) — 보드가 공통 견본보다 먼저 이 장면들을 보인다. 모르는 id 는 schema 위반.
  signature: z.array(z.enum(SCENE_IDS)).min(1).max(3).refine((a) => new Set(a).size === a.length, '같은 장면을 두 번 적었다').optional(),
  // 첫 화면 히어로(Task 10d): HEROES 카탈로그 id — 필수(묶음 2 에서 열 벌 모두 히어로를 가진 뒤 필수로 바꿨다). 대표 장면 signature 의 맨 앞도 hero 다.
  hero: z.enum(HERO_IDS),
  icons: z.object({ library: z.enum(ICON_LIBRARIES), weight: z.enum(['G1', 'G2', 'G3', 'G4', 'G5']) }),
  // prose(선택): 부품이 쓰지 않는 긴 글 목소리(예: AI 답 문장). --font-prose · font-prose 유틸리티로만 나간다(Task 5 fix 1, 리뷰 열린 문제 2).
  // displayKo(선택, Task 10c): 한글 제목체 — font-heading 이 display → displayKo → body 순이라 한 제목 안에서 라틴은 display, 한글은 displayKo 로 그린다(키트 한글 항목만, lint font-display-ko).
  fonts: z.object({ display: DisplayFont, displayKo: Font.optional(), body: Font, mono: Font.nullable().optional(), prose: Font.optional() }),
  color: z.object({ light: Colors, dark: Colors }),
  references: z.array(z.string().min(1)),
  archetypes: z.array(z.enum(ARCHETYPES)).min(1),
  // 원형별 쓰임 조건(Task 7 fix 1 — 리뷰 I5): 글로만 있던 한정(헤리티지 전용 세리프 등)을 에이전트 입구(ai/tasks/<원형>.json 후보의
  // condition)와 레지스트리 meta.recipe 로 싣는다. 키는 archetypes 안의 원형만(lint archetype-conditions).
  archetypeConditions: z.partialRecord(z.enum(ARCHETYPES), z.string().min(1)).optional(),
})

export function parseRecipe(md) {
  const m = md.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/)
  if (!m) throw new Error('레시피 첫 줄에 YAML 머리(--- … ---)가 없다')
  const head = parseYaml(m[1]) ?? {}
  if (typeof head !== 'object' || Array.isArray(head)) throw new Error('YAML 머리가 키-값 표가 아니다')
  return { ...head, body: m[2].replace(/^\s+/, '') }
}

// ── 키트·서체 ───────────────────────────────────────────────────────────
// Task 8(폰트)·Task 9(모션·아이콘)가 만드는 항목 이름. 이름이 바뀌면 여기 한 곳만 고친다.
export const MOTION_ITEM = 'motion-core'
export const iconItem = (library) => `icons-${library}`
export const FONT_ROLES = ['display', 'displayKo', 'body', 'mono', 'prose']

// 키트 서체 항목(registry/factory/fonts/<item>.json — 파일 이름 = 항목 이름). 없으면 null.
const FONTS_DIR = join(FACTORY, 'fonts')
export function kitFont(item) {
  const p = typeof item === 'string' && /^font-[a-z0-9-]+$/.test(item) ? join(FONTS_DIR, `${item}.json`) : null
  return p && existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}
// 키트 항목이 적은 굵기 목록: Google 은 font.weight, 1차 CDN css 항목은 meta.weight(Task 10c). 가변 서체는 없다.
const kitWeightList = (k) => k?.font?.weight ?? k?.meta?.weight
// 굵기 하나뿐인 서체인가 — 키트 항목의 굵기 배열 길이로 판정한다(가변 서체는 weight 가 없다 → 아니다).
export const singleWeight = (f) => { const w = kitWeightList(kitFont(f?.item)); return Array.isArray(w) && w.length === 1 }
// 단일 굵기 display(Black Han Sans·Jua·Gasoek One)의 두 규칙(Task 5 리뷰 I2·열린 문제 1):
//  ① .font-heading 굵기 합성을 끈다 — 부품·소비자가 font-bold 를 걸어도 획이 뭉개지지 않는다.
//  ② 부품 제목 칸([data-slot$="-title"] 중 font-heading 인 것: card·dialog·alert-dialog·drawer·sheet·empty·questionnaire)은 본문 스택으로 —
//     16~18px 부품 제목에 제목 전용 서체가 나오지 않는다. 소비자가 직접 쓴 font-heading 제목은 display 그대로다.
// 유틸리티 층(@layer utilities)에 둬야 .font-heading 유틸리티를 이긴다(층 안에서 선택자 구체성 0,2,0 > 0,1,0).
export const TITLE_SLOTS = '[data-slot$="-title"].font-heading'
// 한글 제목체(displayKo, Task 10c)가 단일 굵기여도 ①만 건다 — 700 제목에서 한글 획이 가짜 굵기로 뭉개지지 않게. ②는 display 가 단일 굵기일 때만
// (부품 제목 칸을 본문으로 돌리면 라틴 display 까지 빠진다).
export const singleWeightFaces = (fonts) => ['display', 'displayKo'].filter((k) => singleWeight(fonts?.[k]))
// 부품 제목 칸(TITLE_SLOTS, 16~18px)의 스택(Task 10c fix 1 — 리뷰 I2, 컨트롤러 판정 가운데 안):
//   display 가 단일 굵기 → 본문 스택(font-sans) — 제목 전용 서체를 작은 제목에 쓰지 않는다(Task 5).
//   displayKo 만 단일 굵기 → display → body → ko → 시스템 한글(displayKo 를 건너뛴 제목 스택) — 라틴 display 는 남기고,
//     장식적인 단일 굵기 한글 제목체 대신 본문 한글 서체가 제 굵기(font-semibold 등)로 한글을 그린다.
//   둘 다 아니면 null(규칙 없음 — 제목 칸도 제목 스택 그대로).
export function titleSlotStack(fonts, { plain = false } = {}) {
  const faces = singleWeightFaces(fonts)
  if (faces.includes('display')) return fontStacks(fonts, { plain })['font-sans']
  if (faces.includes('displayKo')) return fontStacks({ ...fonts, displayKo: undefined }, { plain })['font-heading']
  return null
}
export function singleWeightRules(r, { plain = false } = {}) {
  const faces = singleWeightFaces(r.fonts)
  if (!faces.length) return null
  // font-heading-ko 는 displayKo 로 시작하므로 한글 제목체가 굵기 하나일 때만 합성을 끈다.
  return { '.font-heading': { 'font-synthesis-weight': 'none' }, ...(faces.includes('displayKo') ? { '.font-heading-ko': { 'font-synthesis-weight': 'none' } } : {}), [TITLE_SLOTS]: { 'font-family': titleSlotStack(r.fonts, { plain }) } }
}
// 제목 굵기(Task 6 fix 1 — 리뷰 I1): fonts.display.weight → 변수 --wf-heading-weight(:root·[data-recipe]) + .font-heading 기본 굵기.
// 기본 층(@layer base)에 둔다 — 부품 제목 칸이 축에서 받은 굵기 유틸리티(font-semibold 등, utilities 층)가 이기고,
// 굵기 클래스 없이 font-heading 만 단 제목(소비자 H1·섹션 제목)이 레시피 굵기를 받는다. 값이 없으면 700.
const GOOGLE_FONTS = createRequire(import.meta.url)('next/dist/compiled/@next/font/dist/google/font-data.json')
const familyName = (family) => String(family ?? '').match(/^\s*['"]?([^'",]+)/)?.[1].replace(/ Variable$/, '').trim()
export const HEADING_WEIGHT_VAR = 'wf-heading-weight'
export const HEADING_WEIGHT_DEFAULT = 700
// 한글 제목 굵기(Task 10b → Task 14c 명시화): 라틴 display 가 굵기 하나(Fragment Mono 400)이면 display 굵기(400)가 한 요소의 font-weight 라
// 제목의 한글까지 가늘게 그린다. 레시피가 머리에 display.weightKo 를 적으면 --wf-heading-weight-ko 로 나가고 .font-heading 이 그것을 먼저 읽는다.
// 라틴 글자는 서체에 면이 하나뿐이라 글꼴 맞춤이 그 면을 고르고, singleWeightRules 의 font-synthesis-weight: none 이 가짜 굵기를 막는다.
// 자동으로 정하지 않는다(운영자가 본 모양 — r9 B 동글 400 — 이 생성기 규칙으로 바뀌면 안 된다). 적지 않으면 한글도 display 굵기다.
export const HEADING_WEIGHT_KO_VAR = 'wf-heading-weight-ko'
export const HEADING_WEIGHT_VALUE = `var(--${HEADING_WEIGHT_KO_VAR}, var(--${HEADING_WEIGHT_VAR}, ${HEADING_WEIGHT_DEFAULT}))`
// 제목 스택에서 한글 글자를 그리는 서체: 한글 display → displayKo → 본문(fontStacks 'font-heading' 순서).
export const headingKoFace = (fonts) => (isKorean(fonts?.display?.family) ? fonts.display : fonts?.displayKo ?? fonts?.body)
export const headingWeightKo = (fonts) => fonts?.display?.weightKo ?? null
export const headingWeightVars = (r) => {
  const ko = headingWeightKo(r.fonts)
  return { ...(r.fonts?.display?.weight ? { [HEADING_WEIGHT_VAR]: String(r.fonts.display.weight) } : {}), ...(ko ? { [HEADING_WEIGHT_KO_VAR]: String(ko) } : {}) }
}
// 한글 제목 서체 유틸리티 font-heading-ko(Task 14c): 라틴 제목 서체를 건너뛴 스택(fontStacks 'font-heading-ko')에 제목 굵기 토큰을 그대로 받는다.
export const headingWeightRules = () => ({ '.font-heading': { 'font-weight': HEADING_WEIGHT_VALUE }, '.font-heading-ko': { 'font-weight': HEADING_WEIGHT_VALUE } })
// 키트 항목이 그릴 수 있는 굵기: { list } (정적 — 키트 font.weight) 또는 { min, max } (가변 — next/font wght 축, css @import 항목은 100~900).
export function kitWeights(item) {
  const k = kitFont(item)
  if (!k) return null
  const w = kitWeightList(k)
  if (Array.isArray(w) && w.length) return { list: w.map(Number) }
  if (k.font?.provider === 'google') {
    const g = GOOGLE_FONTS[familyName(k.font.family)]
    const wght = g?.axes?.find((a) => a.tag === 'wght')
    if (wght) return { min: wght.min, max: wght.max }
    if (g) return { list: g.weights.filter((w) => /^[0-9]+$/.test(w)).map(Number) }
  }
  return { min: 100, max: 900 }
}
const cssText = (rules) => Object.entries(rules).map(([sel, decl]) => `${sel} { ${Object.entries(decl).map(([k, v]) => `${k}: ${v};`).join(' ')} }`).join('\n')

export function kitItems(r) {
  const fonts = FONT_ROLES.map((k) => r.fonts?.[k]?.item).filter(Boolean)
  return [...new Set([...fonts, MOTION_ITEM, ...(r.icons?.library ? [iconItem(r.icons.library)] : [])])]
}

// 한글을 그리는 서체 목록(데이터, T6-M8). 본문 서체는 이 안에 있어야 한다. 라틴 전용 서체만으로는 한글이 시스템 글꼴로 떨어진다.
// 항목: { family, item }(키트가 싣는다) 또는 { family, external: true, reason }(키트 밖 — T6r1-c3). 키 = 소문자 이름.
const KOREAN = new Map(JSON.parse(readFileSync(join(ROOT, 'factory', 'qa', 'data', 'korean-fonts.json'), 'utf8')).families.map((f) => [f.family.toLowerCase(), f]))
export const isKorean = (family) => typeof family === 'string' && KOREAN.has(family.trim().toLowerCase())
export const koreanEntry = (family) => (typeof family === 'string' ? KOREAN.get(family.trim().toLowerCase()) : undefined)
// 같은 키트 항목이 싣는 이름들(T8-c4): "Pretendard" 와 "Pretendard Variable" 은 한 항목(font-pretendard)이다. 동적 서브셋 CSS 는
// "Pretendard Variable" 만 등록하고 로컬 설치본은 "Pretendard" 로 잡히므로, 폴백 목록에는 둘 다 적는다(Variable 먼저).
// 이 목록은 실제 CSS 폴백 스택(fontStacks)에도 그대로 들어간다 — meta.aliasOf(별칭 항목, 예: font-pretendard-gov)는 여기서 묶지
// 않는다(Pretendard 스택에 GOV 이름이 새는 것을 막는다). 별칭은 recipes-distinct.mjs fontKey() 가 canonicalItem 으로 따로 판정한다.
export function faceNames(family) {
  const e = koreanEntry(family)
  if (!e?.item) return [family]
  const same = [...KOREAN.values()].filter((x) => x.item === e.item).map((x) => x.family)
  return [...new Set([...same.filter((n) => / Variable$/.test(n)), ...same.filter((n) => !/ Variable$/.test(n))])]
}
const SYSTEM_KO = ['"Apple SD Gothic Neo"', '"Malgun Gothic"']
// 시스템 고정폭 서체(T5-c6·T7-M8): 고정폭 스택은 한글 폴백보다 앞에 이것을 둔다. 폰트 항목이 없는 Windows 소비자도 Consolas 로 고정폭 숫자를 받고,
// 한글 글자만 뒤의 한글 서체로 넘어간다(글자 단위 폴백). ui-monospace(사파리)·SFMono·Menlo(맥)·Consolas(윈도)·Liberation Mono(리눅스).
const SYSTEM_MONO = ['ui-monospace', '"SFMono-Regular"', 'Menlo', 'Consolas', '"Liberation Mono"']

// cssVars.theme 의 서체 스택. 제목은 디스플레이 → 본문(한글) 순으로 떨어진다. 모든 스택 끝에 시스템 한글 서체.
// 서체 변수마다 기본값을 단다(T6-c1): var(--font-<slug>-wf, "<이름>", "<한글 서체>", 시스템 한글, 일반형). 폰트 항목이 안 깔린 소비자에서
// var() 가 정의되지 않으면 선언 전체가 「계산 시점 무효」가 되는데, 기본값이 있으면 이름 목록으로 떨어진다.
// plain: 순수 CSS 용 — var() 없이 이름만.
export function fontStacks(fonts = {}, { plain = false } = {}) {
  const { display, displayKo, body, mono, prose } = fonts
  const ok = (f) => !!(f?.family && f?.item)
  const ko = [body, display].find((f) => ok(f) && isKorean(f.family))
  const join_ = (xs) => [...new Set(xs.filter(Boolean))].join(', ')
  const q = (f) => faceNames(f.family).map((n) => `"${n}"`)
  const ref = (f, generic, before = []) => {
    if (!ok(f)) return null
    const names = join_(q(f))
    return plain ? names : `var(${fontVar(f.item)}, ${join_([...q(f), ...before, ...(ko ? q(ko) : []), ...SYSTEM_KO, generic])})`
  }
  return {
    'font-sans': join_([ref(body, 'sans-serif'), ref(ko, 'sans-serif'), ...SYSTEM_KO, 'sans-serif']),
    // 한글 제목체(displayKo)는 display 바로 뒤 — 한 제목 안에서 라틴은 display, 한글은 displayKo(글자 단위 폴백). display 변수의 기본값 목록에도 같은 순서로.
    'font-heading': join_([ref(display, 'sans-serif', ok(displayKo) ? q(displayKo) : []), ref(displayKo, 'sans-serif'), ref(body, 'sans-serif'), ref(ko, 'sans-serif'), ...SYSTEM_KO, 'sans-serif']),
    // 한글 제목 서체(Task 14c): 라틴 display 를 건너뛴다 — displayKo → 본문 → 시스템 한글. 라틴 제목 서체(고정폭 등)의 공백·쉼표가 한글 제목에 끼지 않는다.
    'font-heading-ko': join_([ref(displayKo, 'sans-serif'), ref(body, 'sans-serif'), ref(ko, 'sans-serif'), ...SYSTEM_KO, 'sans-serif']),
    'font-mono': join_([ref(mono, 'monospace', SYSTEM_MONO), ...SYSTEM_MONO, ref(ko, 'monospace'), ...SYSTEM_KO, 'monospace']),
    // prose 는 있을 때만. 일반형은 키트 항목 family 의 끝 이름(serif·sans-serif)을 따른다.
    ...(ok(prose) ? (() => {
      const generic = kitFont(prose.item)?.font?.family?.split(',').pop().trim() || 'serif'
      return { 'font-prose': join_([ref(prose, generic), ref(body, 'sans-serif'), ref(ko, 'sans-serif'), ...SYSTEM_KO, generic]) }
    })() : {}),
  }
}
// 스택 안에 따옴표로 적힌 서체 이름 가운데 한글 서체가 있는가(var() 기본값 포함).
const stackHasKorean = (stack) => [...stack.matchAll(/"([^"]+)"/g)].some(([, f]) => isKorean(f))

// ── 스타일 맵 ───────────────────────────────────────────────────────────
// base.css → radius → button → input → surface → table → header → shadow(뒤가 같은 훅을 통째로 덮는다). extraCss 는 시험용 덧댐.
// 축 계열은 서로 겹치지 않아(axes.test) 축끼리의 순서는 결과를 바꾸지 않는다 — base 가 맨 앞이라는 것이 실제 계약이다.
export function recipeCssFiles(axes) {
  const values = listValues()
  return [BASE_CSS, ...AXIS_ORDER.map((axis) => {
    const v = values.find((x) => x.axis === axis && x.id === axisValue(axes, axis))
    if (!v) throw new Error(`${axis}=${axisValue(axes, axis)}: 축 값 파일이 없다`)
    return v.file
  })]
}
export function composeStyleMap(axes, { extraCss = [] } = {}) {
  const map = {}
  for (const f of [...recipeCssFiles(axes), ...extraCss]) Object.assign(map, createStyleMap(readFileSync(f, 'utf8')))
  return map
}

// Tailwind 길이 → px. '11' → 44, '[44px]' → 44, '[2.75rem]' → 44, 'px' → 1. 못 재면 null.
export function lengthPx(v) {
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 4
  if (v === 'px') return 1
  const m = v.match(/^\[(\d+(?:\.\d+)?)(px|rem)\]$/)
  return m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : null
}
const tokensOf = (value) => (value ?? '').split(/\s+/).filter(Boolean)
const variantsOf = (t) => t.slice(0, Math.max(0, t.lastIndexOf(':')))
const utilOf = (t) => t.slice(t.lastIndexOf(':') + 1).replace(/^!|!$/g, '')
// 글자 크기 px. 행간 접미사(text-[13px]/5, text-xs/6)도 크기로 본다(M4 — lint-ui 와 같은 판정).
function textPx(util) {
  if (/^text-xs(\/.+)?$/.test(util)) return 12
  const m = util.match(/^text-\[(\d*\.?\d+)(px|rem|em)\](\/.+)?$/)
  return m ? Number(m[1]) * (m[2] === 'px' ? 1 : 16) : null
}
// 아래 여백: pb > py > p (Tailwind v4 는 좁은 유틸리티를 뒤에 둬서 이긴다). undefined = 없음, null = 못 잼.
function bottomPaddingPx(tokens) {
  const base = tokens.filter((t) => !t.includes(':'))
  for (const pre of ['pb', 'py', 'p']) {
    const t = base.filter((x) => x.startsWith(`${pre}-`)).pop()
    if (t !== undefined) return lengthPx(t.slice(pre.length + 1))
  }
  return undefined
}
const heightPx = (tokens) => {
  const t = tokens.filter((x) => !x.includes(':') && /^(h|size)-/.test(x)).pop()
  return t === undefined ? undefined : lengthPx(t.replace(/^(h|size)-/, ''))
}

// 부품 원천에서 히트 바닥(min-h-[44px]·min-h-[24px])과 같은 문자열에 있는 훅 → 바닥 px.
let floorCache
export function floorHooks() {
  if (floorCache) return floorCache
  floorCache = new Map()
  for (const f of readdirSync(UI_SRC).filter((x) => x.endsWith('.tsx')).sort()) {
    for (const [, lit] of readFileSync(join(UI_SRC, f), 'utf8').matchAll(/"([^"\n]*)"/g)) {
      const floor = lit.match(/(?:^|\s)min-h-\[(44|24)px\](?:\s|$)/)
      if (floor) for (const h of tokensOf(lit).filter((t) => t.startsWith('cn-'))) floorCache.set(h, Number(floor[1]))
    }
  }
  return floorCache
}

// 외곽선 버튼의 테두리 색 토큰 — 부품 원천의 outline 변형에 인라인으로 있다(인라인이 훅을 이긴다, 스파이크 3).
export function outlineBorderToken() {
  const src = readFileSync(join(UI_SRC, 'button.tsx'), 'utf8')
  const lit = src.match(/"(cn-button-variant-outline[^"]*)"/)?.[1] ?? ''
  const NOT_COLOR = /^(x|y|t|r|b|l|s|e|solid|dashed|dotted|double|none|hidden|transparent|collapse|separate|\d.*|\[.*)$/
  const t = tokensOf(lit).map((x) => x.match(/^border-(.+)$/)?.[1]).find((n) => n && !NOT_COLOR.test(n))
  return t ?? 'input'
}

// ── 검사 ────────────────────────────────────────────────────────────────
export const loadBanlist = () => JSON.parse(readFileSync(join(ROOT, 'factory', 'qa', 'data', 'banlist.json'), 'utf8'))
// 본문 7:1(브리프), 면 위 글자 4.5:1(T6-M3 — DESIGN §5 바닥), 링 3:1. 두 테마 모두.
const CONTRAST = [
  ['foreground', 'background', 7], ['muted-foreground', 'background', 7],
  ['primary-foreground', 'primary', 4.5], ['card-foreground', 'card', 4.5], ['popover-foreground', 'popover', 4.5],
  ['secondary-foreground', 'secondary', 4.5], ['accent-foreground', 'accent', 4.5], ['muted-foreground', 'muted', 4.5],
  ['ring', 'background', 3],
  // 상태색: 그 위 글자 4.5, 면(배지·점·테두리)은 배경 대비 3(비텍스트, WCAG 1.4.11).
  ...STATUS.flatMap((k) => [[`${k}-foreground`, k, 4.5], [k, 'background', 3]]),
]
// 선 구획 값(compat.json requiresLineContrast — 원천은 compat.mjs LINE_VALUES)을 고른 레시피는 --border 도 선이다(구분선·차트 격자) → 배경 대비 3(T7-M9).
export { LINE_VALUES }

// ── 새 축 값의 색 규칙(Task 16a) ─────────────────────────────────────────
// C6 굵은 테두리 색면 카드: 채움은 accent(유채색 C ≥ ACCENT_C), 잉크 테두리(foreground)는 채움 위에서도 3:1 — 두 테마.
export const C6_FILL = { minC: 0.05, border: 3 }
// 질감 위 대비(X1·X2): 무늬가 가장 짙은(밝은) 점에서 합성한 바탕 위의 글자 대비. 브라우저는 감마 sRGB 에서 합성한다.
// X1 그레인: 노이즈 알파 최대 0.9 × 층 불투명도 0.05 — 라이트는 곱하기(검은 점: 바탕 × (1 − a)), 다크는 뒤집은 흰 점 스크린(바탕 + (1 − 바탕) × a).
// X2 인쇄 망점: 글자색 점(불투명) × 층 불투명도 0.08 — 바탕 × (1 − a) + 글자색 × a. X3 콜라주는 글자가 바탕색 종이 위라 대상이 아니다.
// X4~X8(P3-6 사진 질감)은 무늬가 사진이라 식으로 가장 짙은 점을 알 수 없다 — 브라우저 실측(factory/qa/texture-contrast.mjs, qa:measure)이 맡는다.
export const TEXTURE_ALPHA = { X1: 0.9 * 0.05, X2: 0.08 }
export const TEXTURE_TEXT = [['foreground', 7], ['muted-foreground', 7], ['primary', 4.5]]
const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const srgbOf = (v) => oklchToLinearSrgb(v).map(encode)
const lumSrgb = (rgb) => { const [r, g, b] = rgb.map(decode); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const ratioLum = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
// 테마 하나의 무늬 위 바탕(감마 sRGB 0~1). 무늬가 없는 값이면 null.
export function textureBackground(colors, texture, theme) {
  const a = TEXTURE_ALPHA[texture]
  if (!a || !isOklch(colors?.background)) return null
  const bg = srgbOf(colors.background)
  if (texture === 'X1') return theme === 'dark' ? bg.map((c) => c + (1 - c) * a) : bg.map((c) => c * (1 - a))
  const ink = srgbOf(colors.foreground)
  return bg.map((c, i) => c * (1 - a) + ink[i] * a)
}
export function textureContrastProblems(r) {
  const tex = axisValue(r.axes, 'texture')
  if (!TEXTURE_ALPHA[tex]) return []
  const out = []
  for (const t of ['light', 'dark']) {
    const colors = r.color?.[t]
    const under = textureBackground(colors, tex, t)
    if (!under) continue
    for (const [k, min] of TEXTURE_TEXT) {
      if (!isOklch(colors[k]) || alphaOf(colors[k]) !== 1) continue
      const x = ratioLum(lumSrgb(srgbOf(colors[k])), lumSrgb(under))
      if (x < min) out.push(`texture-contrast: ${t} ${k}/background 무늬(${tex}) 위 ${x.toFixed(2)} < ${min} — 질감의 가장 짙은 점 위에서도 글자 대비를 지킨다(브리프 16a 「대비는 무늬 위에서 잰다」). 바탕·글자 대비를 키우거나 X0·X3 을 쓴다`)
    }
  }
  return out
}

const isOklch = (v) => typeof v === 'string' && /^oklch\(/.test(v.trim())

// ── 히어로 × 새 축 D·X(P3-2 Task 8, 대장 A20) ─────────────────────────────────────────
// 블록은 레시피를 모른다 — 히어로 블록은 조립하는 쪽(찍어낸 페이지·갤러리)이 넘긴 display(DisplayTitle)·texture(Texture) 부품을 쓴다
// (HeroCommon texture · HeroDisplay display, blocks/_shared/hero-parts). 넘길지는 레시피 머리가 정한다: D2·D3 이면 DisplayTitle, X1~X8 이면 Texture.
// 두 부품은 머리가 그 축을 적은 레시피에만 깔리므로(recipePartFiles) 이 규칙을 지키면 없는 부품을 부르지 않는다.
// D2(10~20vw)는 제목이 전폭인 히어로(블록 메타 titleWidth "full")에서만 — 좁은 칸에서는 음절마다 줄이 바뀐다. 좁은 히어로는 display 를 받지 않는다.
const HERO_BLOCKS_DIR = join(FACTORY, 'blocks', 'hero')
export function heroTitleWidth(id) {
  const p = join(HERO_BLOCKS_DIR, `${id}.block.json`)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).titleWidth ?? null : null
}
export const DISPLAY_TITLE_VALUES = ['D2', 'D3']
export const TEXTURE_VALUES = ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8']
export const heroAxisParts = (r) => ({
  display: DISPLAY_TITLE_VALUES.includes(axisValue(r.axes, 'display')) && heroTitleWidth(r.hero) === 'full',
  texture: TEXTURE_VALUES.includes(axisValue(r.axes, 'texture')),
})
export function displayHeroReport(r) {
  const violations = [], warnings = []
  const d = axisValue(r.axes, 'display')
  if (!DISPLAY_TITLE_VALUES.includes(d) || typeof r.hero !== 'string') return { violations, warnings }
  const width = heroTitleWidth(r.hero)
  if (width === 'full') return { violations, warnings }
  if (d === 'D2') violations.push(`display-hero-width: D2(초대형 10~20vw)는 제목이 전폭인 히어로에서만 — 히어로 ${r.hero} 는 titleWidth ${width ?? '없음'}(좁은 칸에서는 음절마다 줄이 바뀐다)`)
  else warnings.push(`display-hero-width: D3 키네틱 제목은 전폭 히어로에서만 DisplayTitle 로 그린다 — 히어로 ${r.hero}(titleWidth ${width ?? '없음'})는 자기 제목 그대로`)
  return { violations, warnings }
}

// ── 색 논리·다크 기본·역동 기법(Task 6b, DESIGN §5-B div-02~05·§8-6 div-06) ─────────────
// B안이 바꾸는 축. colorLogic 은 color 덮어쓰기와 한 묶음이다.
// hero(Task 10d): B안의 첫 화면 구성(HEROES id). color 는 축이 아니다 — colorLogic 을 고를 때 함께 적용된다.
export const ALT_AXES = ['colorLogic', 'motion', 'dynamics', 'fonts', 'hero']
// 이 B안이 바꾸는 축(ALT_AXES 순서).
export const altAxesOf = (alt) => (alt && typeof alt === 'object' ? ALT_AXES.filter((k) => alt[k] !== undefined) : [])
// 레시피에 B안을 적용한 머리(picks: 바꿀 축 목록, 없으면 B가 가진 축 전부). B안이 없으면 null. 돌려준 머리에는 alternates 가 없다.
export function applyAlternate(r, picks) {
  const alt = r?.alternates
  if (!alt || typeof alt !== 'object') return null
  const out = structuredClone(r)
  delete out.alternates
  for (const k of picks ?? altAxesOf(alt)) {
    if (alt[k] === undefined) continue
    // fonts 는 display·displayKo 만 덮는다(본문·고정폭·prose 는 A 그대로).
    out[k] = k === 'fonts' ? { ...out.fonts, ...structuredClone(alt.fonts) } : structuredClone(alt[k])
    if (k === 'colorLogic' && alt.color) for (const t of ['light', 'dark']) out.color[t] = { ...out.color[t], ...alt.color[t] }
  }
  return out
}
// 보드가 내놓을 수 있는 조합(리뷰 I2): B가 바꾸는 축의 공집합 아닌 부분 조합마다 B를 적용해 lint 한다. ok 인 것만 보드 버튼이 된다.
export function alternateCombos(r, opts = {}) {
  const alt = r?.alternates
  if (!alt || typeof alt !== 'object') return []
  const axes = altAxesOf(alt)
  const out = []
  for (let mask = (1 << axes.length) - 1; mask >= 1; mask--) {
    const picks = axes.filter((_, i) => mask & (1 << i))
    const { violations } = lintRecipeReport(applyAlternate(r, picks), { ...opts, headOnly: true })
    out.push({ picks, ok: violations.length === 0, violations })
  }
  return out
}
// ── 면 스코프(Task 7 fix 1 — 리뷰 I1, 컨트롤러 판정) ─────────────────────────────
// 면(field-N)·칸(block-N)은 바탕과 명도가 크게 달라서, 바탕 기준으로 고른 ring·primary·보조 글자·입력 테두리가 면 위에서 대비를 잃는다
// (예: 짙은 솔숲 면 위 이끼 링 2.3:1). 그래서 면 구획마다 [data-face="<키>"] 스코프를 생성해 그 안의 토큰을 면의 짝으로 다시 가리킨다.
//   foreground·primary·ring·*-foreground = <키>-foreground, background·primary-foreground = <키>,
//   muted·accent·secondary(면) = color-mix(<키>-foreground S%, <키>), muted-foreground = color-mix(… W%), border·input = color-mix(… B%).
// 섞는 비율은 두 테마 모두 대비 문턱을 넘는 가장 약한 값을 고른다(faceTokens) — lint face-contrast 가 결과를 다시 잰다.
// 면 안에 놓인 카드(`[data-slot="card"]`)와 `[data-face-reset]` 는 레시피 원래 값으로 되돌린다(카드는 면이 아니라 자기 면을 가진다).
export const FACE_ATTR = 'data-face'
export const FACE_TOKENS = ['background', 'foreground', 'primary', 'primary-foreground', 'ring', 'border', 'input', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'secondary', 'secondary-foreground']
export const FACE_RESET = '[data-slot="card"]:not([data-face]), [data-face-reset]'
// 면 문턱: 글자 4.5(7은 경고 — textOn), 링·테두리·입력·채움(비문자) 3.
export const FACE_MIN = { text: 4.5, body: 7, nonText: 3 }
export const FACE_RENDER_MARGIN = 0.3
const round = (x, d) => Number(x.toFixed(d))
// color-mix(in oklch, a w%, b) — CSS Color 5 와 같은 계산(알파 1, 색상각은 짧은 호).
export function mixOklch(a, b, w) {
  const A = parseOklch(a), B = parseOklch(b), t = w / 100
  let h1 = A[2], h2 = B[2]
  if (h2 - h1 > 180) h1 += 360
  else if (h2 - h1 < -180) h2 += 360
  const H = (((h1 * t + h2 * (1 - t)) % 360) + 360) % 360
  return `oklch(${round(A[0] * t + B[0] * (1 - t), 4)} ${round(A[1] * t + B[1] * (1 - t), 4)} ${round(H, 2)})`
}
// 불투명한 짝만 — 반투명 면은 alpha 규칙이 따로 알린다(대비를 한 값으로 잴 수 없다).
const solid = (v) => isOklch(v) && alphaOf(v) === 1
export const faceKeys = (r) => [...FIELD_KEYS, ...BLOCK_KEYS].filter((k) => ["light", "dark"].every((t) => solid(r.color?.[t]?.[k]) && solid(r.color?.[t]?.[`${k}-foreground`])))
// 면 하나의 스코프 토큰: vars(CSS — var()·color-mix 로 테마를 따라간다)와 resolved(테마별 실제 값 — lint 가 잰다).
export function faceTokens(r, k) {
  const themes = ['light', 'dark'].filter((t) => solid(r.color?.[t]?.[k]) && solid(r.color?.[t]?.[`${k}-foreground`]))
  const pair = (t) => [r.color[t][`${k}-foreground`], r.color[t][k]]
  const every = (fn) => themes.every((t) => fn(...pair(t)))
  const pick = (from, to, ok) => { for (let w = from; from <= to ? w <= to : w >= to; w += from <= to ? 1 : -1) if (every((fg, bg) => ok(fg, bg, w))) return w; return to }
  const S = pick(10, 4, (fg, bg, w) => ratio(fg, mixOklch(fg, bg, w)) >= FACE_MIN.text + FACE_RENDER_MARGIN)
  // 보조 글자는 본문 목표 7:1(레시피 muted-foreground/background 7 과 같은 기준, ux-gate 본문 7:1)을 먼저 찾고, 못 닿으면 4.5 바닥.
  const mutedOk = (min) => (fg, bg, w) => { const m = mixOklch(fg, bg, w); return ratio(m, bg) >= min && ratio(m, mixOklch(fg, bg, S)) >= FACE_MIN.text + FACE_RENDER_MARGIN }
  // 렌더 여유(Task 9): 브라우저가 color-mix 를 sRGB 로 그리면 계산값보다 0.05~0.1 낮게 잰다(r3 다크 block-1: 계산 7.01 → 렌더 6.94,
  // ux-gate 본문 7:1 실패). 그래서 두 테마 모두 7 + FACE_RENDER_MARGIN 에 닿으면 그것을 넘는 가장 약한 섞음을 고르고,
  // 한 테마라도 못 닿으면 가장 센 섞음(W = 100, 보조 글자 = 면 글자)을 쓴다 — 7.0 을 겨우 넘는 가장 약한 값으로 여유를 버리지 않는다(Task 9 fix 1 — 리뷰 I1).
  // 그래도 7 + 여유 밑이면 lint face-contrast-target 이 경고한다(faceContrastProblems).
  const target = FACE_MIN.body + FACE_RENDER_MARGIN
  const W = every((fg, bg) => mutedOk(target)(fg, bg, 100)) ? pick(78, 100, mutedOk(target)) : 100
  const B = pick(50, 100, (fg, bg, w) => ratio(mixOklch(fg, bg, w), bg) >= FACE_MIN.nonText + FACE_RENDER_MARGIN)
  const fgv = `var(--${k}-foreground)`, bgv = `var(--${k})`, mix = (w) => `color-mix(in oklch, ${fgv} ${w}%, ${bgv})`
  const vars = { background: bgv, foreground: fgv, primary: fgv, 'primary-foreground': bgv, ring: fgv, border: mix(B), input: mix(B),
    muted: mix(S), 'muted-foreground': mix(W), accent: mix(S), 'accent-foreground': fgv, secondary: mix(S), 'secondary-foreground': fgv }
  const resolved = Object.fromEntries(themes.map((t) => {
    const [fg, bg] = pair(t), m = (w) => mixOklch(fg, bg, w)
    return [t, { background: bg, foreground: fg, primary: fg, 'primary-foreground': bg, ring: fg, border: m(B), input: m(B), muted: m(S), 'muted-foreground': m(W), accent: m(S), 'accent-foreground': fg, secondary: m(S), 'secondary-foreground': fg }]
  }))
  return { key: k, weights: { surface: S, muted: W, border: B }, vars, resolved }
}
// CSS 규칙 객체 { 선택자: { 속성: 값 } }. scope = 앞에 붙일 조상 선택자(갤러리 [data-recipe]), darkScopes = 다크 조상 선택자들(scope 포함).
export function faceRules(r, { scope = '', darkScopes } = {}) {
  const keys = faceKeys(r)
  if (!keys.length) return {}
  const pre = scope ? `${scope} ` : ''
  darkScopes ??= [scope ? `.dark ${scope}` : '.dark']
  const decl = (vars) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--${k}`, v]))
  const reset = (pres) => pres.flatMap((p) => FACE_RESET.split(', ').map((s) => `${p}[${FACE_ATTR}] ${s}`)).join(', ')
  const pick = (t) => Object.fromEntries(FACE_TOKENS.map((k) => [`--${k}`, r.color[t][k]]))
  return {
    ...Object.fromEntries(keys.map((k) => [`${pre}[${FACE_ATTR}="${k}"]`, decl(faceTokens(r, k).vars)])),
    [reset([pre])]: pick('light'),
    [reset(darkScopes.map((d) => `${d} `))]: pick('dark'),
  }
}
// lint: 면마다 두 테마의 스코프 토큰 대비(A·B 모두 — lintRecipeReport 가 B를 적용한 머리도 이 함수로 잰다).
export function faceContrastProblems(r) {
  const out = []
  const CHECKS = [['muted-foreground', 'background', FACE_MIN.text], ['muted-foreground', 'muted', FACE_MIN.text], ['foreground', 'muted', FACE_MIN.text],
    ['primary-foreground', 'primary', FACE_MIN.text], ['primary', 'background', FACE_MIN.nonText], ['ring', 'background', FACE_MIN.nonText],
    ['border', 'background', FACE_MIN.nonText], ['input', 'background', FACE_MIN.nonText]]
  for (const k of faceKeys(r)) {
    const { resolved } = faceTokens(r, k)
    for (const [t, v] of Object.entries(resolved)) for (const [a, b, min] of CHECKS) {
      const x = ratio(v[a], v[b])
      if (x < min) out.push(`face-contrast: ${t} [data-face="${k}"] ${a}/${b} ${x.toFixed(2)} < ${min} — 면 위의 ${a} 가 면 스코프에서도 대비를 잃는다(${k}-foreground 와 ${k} 의 대비를 키운다, DESIGN §5·WCAG 1.4.3·1.4.11)`)
      // 보조 글자는 본문 목표 7:1 을 경고로(4.5 바닥은 위 위반) — 면 글자 짝 자체가 7 미만이면 field-contrast-target 이 이미 알린다.
      else if (a === "muted-foreground" && b === "background" && x < FACE_MIN.body) out.push(`face-contrast-target: ${t} [data-face="${k}"] muted-foreground/background ${x.toFixed(2)} < ${FACE_MIN.body} — 목표 7:1(최소 4.5:1은 넘었다)`)
      // 7.00 ~ 7 + 렌더 여유 구간(Task 9 fix 1 — 리뷰 I1): 계산은 7:1 이지만 브라우저 렌더에서 7 밑으로 떨어질 수 있다.
      else if (a === "muted-foreground" && b === "background" && x < FACE_MIN.body + FACE_RENDER_MARGIN) out.push(`face-contrast-target: ${t} [data-face="${k}"] muted-foreground/background ${x.toFixed(2)} < ${(FACE_MIN.body + FACE_RENDER_MARGIN).toFixed(2)} — 계산은 7:1 이지만 렌더 여유(FACE_RENDER_MARGIN ${FACE_RENDER_MARGIN})가 없다 — 렌더에서 7 밑으로 떨어질 수 있다(${k}-foreground 와 ${k} 의 대비를 키운다)`)
    }
  }
  return out
}

// 보드 버튼이 될 조합(picks 목록) — 레지스트리 meta.recipe.alternateCombos 와 README 가 같은 값을 쓴다.
export const validCombos = (r) => alternateCombos(r).filter((c) => c.ok).map((c) => c.picks)
// 무지개 순서(리뷰 M4): 4칸일 때만 — 칸 번호 순서로 색상환을 한 방향(연속한 최단 호의 부호가 같음)으로 한 바퀴 안에 돈다.
// 원 위 세 점은 어느 순서든 한 방향이라 3칸은 판정하지 않는다(보드에서 사람이 본다).
export function isRainbowOrder(hs) {
  if (hs.length < 4) return false
  const steps = hs.slice(1).map((h, i) => ((((h - hs[i]) % 360) + 540) % 360) - 180)
  const oneWay = steps.every((d) => d > 0) || steps.every((d) => d < 0)
  return oneWay && Math.abs(steps.reduce((a, b) => a + b, 0)) < 360
}
const bandText = (b) => `L ${b.L[0]}~${b.L[1]}·C ${b.C[0]}~${b.C[1]}`
// 「## 하지 말 것」에 두 색 사이 그라디언트를 금하는 줄(그라디언트 + 두 색·듀오톤·K7 이 한 줄에)이 있는가.
const hasDuoGradientLine = (body) => (String(body ?? '').match(/^##\s+하지 말 것\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m)?.[1] ?? '')
  .split(/\r?\n/).some((l) => /그라디언트|gradient/i.test(l) && /두 색|듀오톤|K7/.test(l))

export function colorLogicReport(r) {
  const v = [], w = []
  const themes = ['light', 'dark'].filter((t) => r.color?.[t] && typeof r.color[t] === 'object')
  const lch = (t, k) => (isOklch(r.color?.[t]?.[k]) && alphaOf(r.color[t][k]) === 1 ? parseOklch(r.color[t][k]) : null)
  const logic = r.colorLogic
  const keys = roleKeys(r.color?.light)
  const bases = logic === 'K6' || logic === 'K7' ? FIELD_KEYS : logic === 'K8' ? BLOCK_KEYS : []
  const allowed = bases.flatMap((k) => [k, `${k}-foreground`])
  const stray = keys.filter((k) => !allowed.includes(k))
  if (stray.length)
    v.push(`color-logic-keys: color.light.${stray.join('·')} — ${bases.length ? `${logic}(${COLOR_LOGIC_LABEL[logic]})가 쓰는 키는 ${allowed.join('·')}` : `면·칸 키는 K6·K7(field-1·field-2)·K8(block-1~4)만 쓴다 — 지금 ${logic ?? '색 논리 없음'}`}(DESIGN §5-B)`)
  for (const t of themes) for (const k of roleKeys(r.color[t])) if (isOklch(r.color[t][k]) && alphaOf(r.color[t][k]) !== 1)
    v.push(`alpha: color.${t}.${k} = ${r.color[t][k]} — 면·칸 색과 그 위 글자는 불투명으로 쓴다`)
  const present = bases.filter((k) => keys.includes(k))
  for (const k of bases) if (keys.includes(k) !== keys.includes(`${k}-foreground`)) v.push(`color-logic-keys: ${k} 와 ${k}-foreground 는 짝으로 둔다(면 위 글자 대비를 면마다 잰다)`)
  // 면·칸 위 글자: 두 테마 모두 4.5:1 바닥(위반), 7:1 목표(경고).
  const textOn = (rule, list) => {
    for (const t of themes) for (const k of list) {
      const [bg, fg] = [lch(t, k), lch(t, `${k}-foreground`)]
      if (!bg || !fg) continue
      const x = ratio(r.color[t][`${k}-foreground`], r.color[t][k])
      if (x < TEXT_MIN) v.push(`${rule}: ${t} ${k}-foreground/${k} ${x.toFixed(2)} < ${TEXT_MIN}(DESIGN §5-B — 면마다 잰다)`)
      else if (x < TEXT_TARGET) w.push(`${rule}-target: ${t} ${k}-foreground/${k} ${x.toFixed(2)} < ${TEXT_TARGET} — 목표 7:1(최소 4.5:1은 넘었다)`)
    }
  }
  if (logic === 'K6') {
    if (!present.length) v.push('k6-field: K6 색 면인데 color.light.field-1 이 없다 — 면 색(field-1, 2개까지)과 그 위 글자색(-foreground)을 둔다(DESIGN §5-B)')
    for (const t of themes) for (const k of present) {
      const c = lch(t, k)
      if (!c) continue
      const band = inBand(c, FIELD_BANDS.light) ? 'light' : inBand(c, FIELD_BANDS.deep) ? 'deep' : null
      if (!band) v.push(`k6-field: ${t} ${k} ${r.color[t][k]} — 밝은 면 ${bandText(FIELD_BANDS.light)} 또는 짙은 면 ${bandText(FIELD_BANDS.deep)} 안에 둔다(DESIGN §5-B)`)
      else if (band === 'light' && c[0] >= FIELD_CREAM.minL && c[1] < FIELD_CREAM.maxC && c[2] >= FIELD_CREAM.hueFrom && c[2] <= FIELD_CREAM.hueTo)
        v.push(`k6-field: ${t} ${k} ${r.color[t][k]} — 따뜻한 색상(${FIELD_CREAM.hueFrom}~${FIELD_CREAM.hueTo}°)의 밝은 면(L ≥ ${FIELD_CREAM.minL})이 C ${FIELD_CREAM.maxC} 미만이면 크림·베이지 경계다(§5-A·§13 「oklch(0.9x 0.0x 60~90)」) — 채도를 올리거나 L 을 낮춘다`)
    }
    // 바탕이 유채색(C ≥ 0.05)이면 그것도 면 색이다 — 바탕 + 면 키의 색상각 묶음이 2개 이하(Task 6b 리뷰 M8).
    for (const t of themes) {
      const bg = lch(t, 'background')
      if (!bg || bg[1] < ACCENT_C) continue
      const n = hueGroupsAt([bg, ...present.map((k) => lch(t, k)).filter(Boolean)], ACCENT_C).length
      if (n > FIELD_MAX) v.push(`k6-field: ${t} 유채색 바탕(${r.color[t].background})과 면 색의 색상각 묶음이 ${n}개 — 한 페이지의 면 색은 ${FIELD_MAX}개까지(바탕도 센다, DESIGN §5-B)`)
    }
    textOn('field-contrast', present)
  }
  if (logic === 'K7') {
    const f = lch('light', 'field-1'), p = lch('light', 'primary')
    if (!f) v.push('k7-duotone: K7 듀오톤인데 color.light.field-1 이 없다 — 한 색은 면(field-1), 다른 색은 잉크·CTA(primary)(DESIGN §5-B)')
    else if (p) {
      const groups = hueGroupsAt([...BRAND_KEYS, ...present].map((k) => lch('light', k)).filter(Boolean), DUO.minC)
      if (groups.length !== 2) v.push(`k7-duotone: 라이트 얼굴색(${[...BRAND_KEYS, ...present].join('·')})의 채도 ${DUO.minC} 이상 색상각 묶음이 ${groups.length}개 — 듀오톤은 정확히 두 묶음, 나머지는 중립(DESIGN §5-B)`)
      if (f[1] < DUO.minC || p[1] < DUO.minC) v.push(`k7-duotone: field-1 C ${f[1]} · primary C ${p[1]} — 두 색 모두 채도 ${DUO.minC} 이상`)
      else if (hueDist(f[2], p[2]) < DUO.minGap) v.push(`k7-duotone: field-1 ${f[2]}° 와 primary ${p[2]}° 가 ${hueDist(f[2], p[2]).toFixed(0)}° 떨어짐 < ${DUO.minGap}°`)
    }
    textOn('field-contrast', present)
    // 문서화 검사일 뿐이다 — 실제 그라디언트 금지는 블록 단계(P3-2, 로드맵 이월)에서 CSS·블록 소스로 집행한다.
    if (!hasDuoGradientLine(r.body)) v.push('k7-gradient-documented: 「## 하지 말 것」에 두 색 사이 그라디언트를 금하는 줄이 없다 — 예: 「두 색 사이에 그라디언트를 넣지 않는다(K7 듀오톤)」(DESIGN §5-B·§13)')
  }
  if (logic === 'K8') {
    if (present.length < BLOCKS.min) v.push(`k8-blocks: 칸 색 ${present.length}개 — block-1~block-${BLOCKS.min} 이상, ${BLOCKS.max}개까지(DESIGN §5-B)`)
    else {
      const cs = present.map((k) => lch('light', k))
      if (cs.every(Boolean)) {
        const low = present.filter((k, i) => cs[i][1] < ACCENT_C)
        if (low.length) v.push(`k8-blocks: ${low.join('·')} 채도 < ${ACCENT_C} — 칸마다 유채색 한 색`)
        const groups = hueGroupsAt(cs, ACCENT_C)
        if (groups.length < BLOCKS.groups[0] || groups.length > BLOCKS.groups[1]) v.push(`k8-blocks: 칸 색상각 묶음 ${groups.length}개 — ${BLOCKS.groups.join('~')} 묶음(45° 안은 한 묶음, §5-A)`)
        const hs = cs.map((c) => c[2])
        if (isRainbowOrder(hs))
          v.push(`k8-rainbow: 칸 색상각이 번호 순서대로 ${hs.join('→')}° — 색상환을 한 방향으로 도는 무지개 순서다(4칸일 때만 판정, 번호 = 배치 순서, DESIGN §5-B)`)
        const top = cs.map((c) => c[1]).sort((a, b) => b - a)
        if (top[0] - top[1] < BLOCKS.peakGap) v.push(`k8-peak: 가장 채도 높은 칸이 하나가 아니다(C ${top[0]} · ${top[1]}) — 한 칸만 다른 칸보다 C ${BLOCKS.peakGap} 이상 높게(DESIGN §5-B)`)
      }
    }
    textOn('block-contrast', present)
  }
  // 면 스코프 토큰(Task 7 fix 1 — 리뷰 I1): 면 위 ring·primary·보조 글자·테두리·입력 — 두 테마, A·B 모두.
  if (bases.length) for (const m of faceContrastProblems(r)) (m.startsWith("face-contrast-target:") ? w : v).push(m)
  // 다크 기본(div-05): 바탕 대역 + 「거의 검정 + 형광 한 점」 금지(§13).
  if (r.defaultTheme === 'dark') {
    const bg = lch('dark', 'background')
    // 대역은 §5-B SHOULD 라 경고(Task 6b 리뷰 M2). 형광 한 점은 §13 금지라 위반.
    if (bg && !inBand(bg, DARK_DEFAULT_BG)) w.push(`dark-default: dark background ${r.color.dark.background} — 다크 기본은 바탕 ${bandText(DARK_DEFAULT_BG)}(색조 있는 짙은 면, DESIGN §5-B div-05)`)
    const face = BRAND_KEYS.map((k) => lch('dark', k)).filter(Boolean)
    if (hueGroupsAt(face, ACCENT_C).length === 1 && face.some((c) => c[1] >= ACCENT_C && isNeon(c)))
      v.push('dark-neon: 다크 기본의 얼굴색이 형광 초록·주홍 한 묶음뿐이다 — 「거의 검정 + 형광 한 점」(§13) 대신 무채색 1 + 주제 액센트 1, 명도 대비로 위계')
  }
  // K9 단색 램프(Task 16a): 얼굴색·바탕·면·선에서 채도 ACCENT_C 이상인 색이 한 색상각 묶음 안에만 있다(강조색 없음). 상태색·destructive 는 의미색이라 뺀다.
  if (logic === 'K9') for (const t of themes) {
    const cs = [...BRAND_KEYS, 'background', 'foreground', 'card', 'popover', 'muted', 'muted-foreground', 'border', 'input'].map((k) => lch(t, k)).filter(Boolean)
    const n = hueGroupsAt(cs, ACCENT_C).length
    if (n > 1) v.push(`k9-mono: ${t} 채도 ${ACCENT_C} 이상 색의 색상각 묶음이 ${n}개 — K9 단색 램프는 한 색상각(또는 무채)의 명도 단계만, 강조색 없음(Task 16a)`)
  }
  // C6 굵은 테두리 색면 카드(Task 16a): 채움 accent 가 유채색이고, 잉크 테두리(foreground)가 채움 위에서도 3:1. 채움 위 글자는 accent-foreground/accent 4.5(CONTRAST).
  if (r.axes?.surface === 'C6') for (const t of themes) {
    const acc = lch(t, 'accent')
    if (!acc) continue
    if (acc[1] < C6_FILL.minC) v.push(`c6-fill: ${t} accent ${r.color[t].accent} C ${acc[1]} < ${C6_FILL.minC} — C6 카드 채움은 평면 유채색이다(굵은 테두리 색면 카드)`)
    if (isOklch(r.color[t].foreground) && alphaOf(r.color[t].foreground) === 1) {
      const x = ratio(r.color[t].foreground, r.color[t].accent)
      if (x < C6_FILL.border) v.push(`c6-fill: ${t} foreground/accent ${x.toFixed(2)} < ${C6_FILL.border} — C6 잉크 테두리가 채움 위에서도 3:1 이어야 한다`)
    }
  }
  // 질감 위 대비(Task 16a): X1·X2 는 무늬가 가장 짙은 점 위에서 본문·보조 글자 7:1, 주색 글자 4.5:1.
  for (const m of textureContrastProblems(r)) v.push(m)
  // 축 값 × 레시피 필드(compat.json axisRecipeRules — D3 × M0 등). B안이 모션을 바꿔도 여기서 다시 본다.
  for (const m of checkAxisRecipeRules(r.axes, { motion: r.motion, colorLogic: r.colorLogic })) v.push(`axis-recipe: ${m}`)
  // D 디스플레이 × 히어로 제목 폭(Task 8, 대장 A20). B안 머리(alternates.hero)도 여기서 다시 본다.
  const dh = displayHeroReport(r)
  v.push(...dh.violations); w.push(...dh.warnings)
  // 역동 기법 × 모션: M0 은 정지 기법만, 자석은 M3 에서만(dynamicsAllowed 와 같은 규칙). B안은 lintRecipeReport 가 B를 적용한 머리 전체로 다시 검사한다.
  const still = DYNAMICS_IDS.filter((d) => DYNAMICS[d].still)
  const dyn = (motion, list) => {
    for (const d of Array.isArray(list) ? list : []) {
      const t = DYNAMICS[d]
      if (!t) continue
      if (motion === 'M0' && !t.still) v.push(`dynamics-motion: ${d}(${t.label}) — M0(등장 연출 없음)은 정지 기법(${still.join('·')})만 고른다(style_axes 축 8)`)
      if (t.minMotion && motion !== t.minMotion) v.push(`dynamics-motion: ${d}(${t.label}) — 모션 ${t.minMotion} 레시피에서만(DESIGN §8-1·§8-6)`)
    }
  }
  dyn(r.motion, r.dynamics)
  // 레시피 필드 × 원형(compat.json recipeRules).
  for (const a of Array.isArray(r.archetypes) ? r.archetypes : []) {
    const A = checkRecipeRules({ motion: r.motion, colorLogic: r.colorLogic }, a)
    for (const m of A.violations) v.push(`recipe-compat: ${m}`)
    for (const m of A.warnings) w.push(`recipe-caution: ${m}`)
  }
  return { violations: v, warnings: w }
}

// 위반(violations)은 막고, 경고(warnings)는 알리기만 한다. 문장은 「규칙: 내용」.
export function lintRecipeReport(r, { banlist = loadBanlist(), compat = { checkCompat, checkCompatWarnings }, fontItems, extraCss = [], headOnly = false } = {}) {
  const v = [], w = []
  const uniqPush = (arr, s) => { if (!arr.includes(s)) arr.push(s) }
  const { body, ...head } = r
  const parsed = RecipeHead.safeParse(head)
  if (!parsed.success) for (const i of parsed.error.issues) v.push(`schema: ${i.path.join('.') || '(머리)'} — ${i.message}`)

  for (const a of Object.keys(r.archetypeConditions ?? {})) if (!(r.archetypes ?? []).includes(a))
    v.push(`archetype-conditions: ${a} — archetypes 에 없는 원형의 조건이다(archetypes: ${(r.archetypes ?? []).join('·')})`)
  const refs = Array.isArray(r.references) ? r.references.length : 0
  if (refs < 2) v.push(`references: 레퍼런스가 ${refs}개 — 2개 이상(카드 id 또는 URL)`)
  for (const s of BODY_SECTIONS) if (!new RegExp(`^##\\s+${s}\\s*$`, 'm').test(body ?? '')) v.push(`body-sections: 본문에 「## ${s}」 절이 없다`)
  // 첫 화면 히어로(Task 10d): 대표 장면 hero 는 머리 hero 가 있어야 그린다 · B안의 히어로는 A와 다른 구성이어야 한다.
  if (Array.isArray(r.signature) && r.signature.includes('hero') && !r.hero) v.push('hero-signature: signature 에 hero 장면이 있는데 머리 hero 가 없다 — HEROES 카탈로그 id 를 적는다')
  if (r.hero && r.alternates?.hero && r.hero === r.alternates.hero) v.push(`hero-alternate: alternates.hero ${r.hero} 가 A 의 hero 와 같다 — B안의 첫 화면은 다른 구성이다`)
  // hero 가 있으면 대표 장면 첫 칸이 hero 다(보드가 첫 화면부터 보인다 — Task 10d fix, 리뷰 b1 M8: 테스트의 하드코딩 목록 대신 규칙으로).
  // headOnly(B안·조합 검사)에서는 되풀이하지 않는다 — B는 signature 를 바꾸지 않고 hero 축은 id 만 바꾸므로 A 머리 검사가 이미 본 규칙이다.
  if (!headOnly && r.hero && Array.isArray(r.signature) && r.signature[0] !== 'hero') v.push(`hero-first: hero ${r.hero} 가 있는데 signature 첫 장면이 ${r.signature[0] ?? '(없음)'} 이다 — signature 맨 앞에 hero 를 둔다`)

  // 색: oklch(, 키 집합, 대비(두 테마).
  const themes = ['light', 'dark'].filter((t) => r.color?.[t] && typeof r.color[t] === 'object')
  for (const t of themes) for (const [k, val] of Object.entries(r.color[t])) if (!isOklch(val)) v.push(`oklch: color.${t}.${k} = ${val} — oklch( 로 쓴다`)
  if (themes.length === 2) {
    const [a, b] = themes.map((t) => Object.keys(r.color[t]).sort().join(' '))
    if (a !== b) v.push('schema: color.light 와 color.dark 의 키가 다르다')
  }
  // 대비를 재는 토큰은 불투명이어야 한다(T6-M6): 반투명은 밑에 깔리는 면에 따라 대비가 바뀌어 한 값으로 잴 수 없다 → 위반으로 알리고 재지 않는다.
  const outline = outlineBorderToken()
  const lineAxes = Object.values(r.axes ?? {}).filter((x) => LINE_VALUES.includes(x))
  const measured = new Set([...CONTRAST.flatMap(([a, b]) => [a, b]), 'input', outline, ...(lineAxes.length ? ['border'] : [])])
  const opaque = (t, k) => isOklch(r.color[t][k]) && alphaOf(r.color[t][k]) === 1
  for (const t of themes) for (const k of measured) if (isOklch(r.color[t][k]) && !opaque(t, k))
    v.push(`alpha: color.${t}.${k} = ${r.color[t][k]} — 대비를 재는 토큰은 불투명으로 쓴다(반투명은 밑의 면에 따라 대비가 달라진다)`)
  const measure = (t, fg, bg) => (opaque(t, fg) && opaque(t, bg) ? ratio(r.color[t][fg], r.color[t][bg]) : null)
  for (const t of themes) {
    for (const [fg, bg, min] of CONTRAST) {
      const x = measure(t, fg, bg)
      if (x !== null && x < min) v.push(`contrast: ${t} ${fg}/${bg} ${x.toFixed(2)} < ${min}`)
    }
    // primary 는 link 변형 글자(text-primary)이고 체크·스위치·진행 막대 채움(bg-primary)이다 → 바탕·카드·팝오버 위 글자 4.5(Task 7 fix 1 — 리뷰 I6).
    for (const bg of ['background', 'card', 'popover']) {
      const x = measure(t, 'primary', bg)
      if (x !== null && x < 4.5) v.push(`primary-surface: ${t} primary/${bg} ${x.toFixed(2)} < 4.5 — link 버튼·배지가 primary 로 글자를 그리고 체크·스위치·진행 막대가 primary 로 칠한다(WCAG 1.4.3·1.4.11). 밝은 채움 색은 primary 대신 accent·면 키에 둔다`)
    }
    if (lineAxes.length) {
      const x = measure(t, 'border', 'background')
      if (x !== null && x < 3) v.push(`line-border: ${t} border/background ${x.toFixed(2)} < 3 — 선 구획 값(${lineAxes.join('·')})을 고른 레시피는 구분선도 3:1(DESIGN §6 예외 조건, T7-M9)`)
    }
    for (const tok of [...new Set(['input', outline])]) {
      const x = measure(t, tok, 'background')
      if (x !== null && x < 3) v.push(`input-contrast: ${t} ${tok}/background ${x.toFixed(2)} < 3 — 입력·외곽선 버튼 테두리는 유일한 경계라 3:1(DESIGN §6)`)
    }
  }

  // 팔레트 조합(DESIGN §5-A): pal-04 복사한 Tailwind 기본값(두 테마), pal-03 크림 바탕(라이트). 문턱은 lib/palette-rules.mjs.
  for (const t of themes) for (const k of ['primary', 'ring', 'accent', 'accent-foreground', 'chart-1']) {
    const hit = isOklch(r.color[t][k]) ? tailwindCopy(parseOklch(r.color[t][k])) : null
    if (hit) v.push(`palette-tailwind: ${t} ${k} ${r.color[t][k]} — Tailwind v3 기본값 ${hit.name}(${hit.hex})와 OKLab 거리 ${hit.dist.toFixed(4)} < ${TAILWIND_MAX_DIST}(채도 ${TAILWIND_MIN_C} 이상) — 기본 스케일 hex를 복사하지 말고 색상각만 참고해 OKLCH 램프로 다시 만든다(DESIGN §5-A)`)
  }
  const lightBg = themes.includes('light') && isOklch(r.color.light.background) ? parseOklch(r.color.light.background) : null
  if (lightBg && isCreamBackground(lightBg))
    v.push(`palette-cream: light background ${r.color.light.background} — 따뜻한 색상(${CREAM.hueFrom}~${CREAM.hueTo}°)에 채도 ${lightBg[1]} > ${CREAM.maxC}이면 크림·베이지 바탕이다 — 오프화이트는 C ≤ ${CREAM.maxC}로 둔다(DESIGN §5-A·§13)`)

  // 호환: 원형마다, 선 구획 값(C2·T4·H3 = border-foreground)은 foreground 대비로.
  const lines = themes.map((t) => measure(t, 'foreground', 'background')).filter((x) => x !== null)
  const lineContrast = lines.length ? Math.min(...lines) : undefined
  const archetypes = Array.isArray(r.archetypes) && r.archetypes.length ? r.archetypes : [undefined]
  if (r.axes && typeof r.axes === 'object') for (const a of archetypes) {
    for (const m of compat.checkCompat(r.axes, a, { lineContrast })) uniqPush(v, `compat: ${m}`)
    for (const m of compat.checkCompatWarnings(r.axes, a)) uniqPush(w, `compat-caution: ${m}`)
  }
  // 색 논리 K6~K8 · 다크 기본 · 역동 기법 × 모션 · 레시피 필드 × 원형(Task 6b).
  const logic = colorLogicReport(r)
  for (const m of logic.violations) uniqPush(v, m)
  for (const m of logic.warnings) uniqPush(w, m)

  // 서체: 본문 서체 자체가 한글(T6-M8), 스택마다 한글, 금지 목록, 아직 없는 폰트 항목. 디스플레이는 라틴이어도 된다.
  const fonts = r.fonts ?? {}
  if (!fonts.body?.family) v.push('font-korean: fonts.body 가 없다 — 한글을 그리는 본문 서체가 있어야 한다')
  else if (!isKorean(fonts.body.family)) v.push(`font-korean: fonts.body ${fonts.body.family} 는 한글을 그리지 못한다 — 본문은 factory/qa/data/korean-fonts.json 의 서체로(디스플레이는 라틴이어도 된다)`)
  else if (koreanEntry(fonts.body.family)?.external) w.push(`font-external: fonts.body ${fonts.body.family} 는 폰트 키트 밖 서체다(${koreanEntry(fonts.body.family).reason}) — 소비자에게 서체 파일이 오지 않아 시스템 한글로 그린다`)
  for (const [name, stack] of Object.entries(fontStacks(fonts))) if (!stackHasKorean(stack))
    v.push(`font-korean: ${name} 스택에 한글 서체가 없다 — 라틴 전용 디스플레이(${fonts.display?.family ?? '없음'}) 뒤에 한글 본문 서체를 둔다`)
  // prose 는 긴 글 목소리라 banlist 의 display·body 역할 항목을 함께 받는다(예: Fraunces·Lora 를 prose 로 무조정 사용).
  // displayKo(한글 제목체)는 display 역할 항목을 받는다.
  const roleHit = (roles, role) => !roles || roles.includes(role) || (role === 'prose' && roles.some((x) => x === 'display' || x === 'body')) || (role === 'displayKo' && roles.includes('display'))
  // 제목 굵기(Task 6 fix 1 — 리뷰 I1): 키트 항목이 실제로 그리는 굵기만(없는 굵기는 합성 볼드·가는 굵기 대체 — DESIGN §2).
  const dw = fonts.display?.weight
  if (dw !== undefined && fonts.display?.item) {
    const kw = kitWeights(fonts.display.item)
    if (kw?.list && !kw.list.includes(dw)) v.push(`font-weight: fonts.display.weight ${dw} — ${fonts.display.item} 가 싣는 굵기가 아니다(${kw.list.join('·')})`)
    if (kw && !kw.list && (dw < kw.min || dw > kw.max)) v.push(`font-weight: fonts.display.weight ${dw} — ${fonts.display.item} 의 굵기 범위 ${kw.min}~${kw.max} 밖`)
  }
  // 한글 제목 굵기(Task 14c): 제목의 한글을 그리는 서체(headingKoFace)가 실제로 가진 굵기만.
  const dko = fonts.display?.weightKo, koFace = headingKoFace(fonts)
  if (dko !== undefined && koFace?.item) {
    const kw = kitWeights(koFace.item)
    if (kw?.list && !kw.list.includes(dko)) v.push(`font-weight: fonts.display.weightKo ${dko} — 한글 제목 서체 ${koFace.item} 가 싣는 굵기가 아니다(${kw.list.join('·')})`)
    if (kw && !kw.list && (dko < kw.min || dko > kw.max)) v.push(`font-weight: fonts.display.weightKo ${dko} — 한글 제목 서체 ${koFace.item} 의 굵기 범위 ${kw.min}~${kw.max} 밖`)
  }
  // 한글 제목체(Task 10c): 키트 항목 · korean-fonts.json 의 { family, item } 한글 서체 · 본문과 다른 서체. 이유는 처음 걸린 하나만.
  const dk = fonts.displayKo
  if (dk?.family && dk?.item) {
    const e = koreanEntry(dk.family)
    if (!kitFont(dk.item)) v.push(`font-display-ko: fonts.displayKo.item ${dk.item} 는 폰트 키트 항목이 아니다 — registry/factory/fonts/ 의 한글 항목만 쓴다`)
    else if (!e?.item || e.item !== dk.item) v.push(`font-display-ko: fonts.displayKo ${dk.family}(${dk.item}) — 한글 제목체는 factory/qa/data/korean-fonts.json 에 { family, item } 로 있는 키트 한글 서체다(${e?.item ? `그 이름의 항목은 ${e.item}` : '목록에 없거나 키트 밖'})`)
    else if (dk.item === fonts.body?.item || koreanEntry(fonts.body?.family)?.item === dk.item) v.push(`font-display-ko: fonts.displayKo ${dk.family} 가 본문 서체와 같다 — 한글 제목체는 본문과 다른 서체로 둔다(같으면 빼면 된다)`)
  }
  if (fonts.prose?.item && !kitFont(fonts.prose.item)) v.push(`font-prose: fonts.prose.item ${fonts.prose.item} 는 폰트 키트 항목이 아니다 — registry/factory/fonts/ 의 항목만 쓴다`)
  for (const role of FONT_ROLES) {
    const f = fonts[role]
    if (!f?.family) continue
    for (const b of banlist.fonts) {
      if (b.family.toLowerCase() !== f.family.trim().toLowerCase() || !roleHit(b.roles, role)) continue
      if (b.untunedOnly && f.tuned?.trim()) continue
      v.push(`banlist: fonts.${role} ${f.family} — ${b.why}${b.untunedOnly ? ' (tuned 에 무엇을 조정했는지 적으면 통과)' : ''}`)
    }
    if (fontItems && f.item && !fontItems.has(f.item)) uniqPush(w, `missing-item: ${f.item} — 아직 없는 폰트 항목(Task 8 폰트 키트)`)
  }

  // 합성한 스타일 맵: 글자 14px, textarea 44, 히트 바닥이 지우는 min-h, 바닥글 여백. 합성이 안 되면 규칙 5개를 조용히 건너뛰지 않고 위반으로 알린다(M1).
  let map = null
  // headOnly: 머리(색·서체·원형)만 — B안 검사처럼 축이 A와 같을 때 스타일 맵 규칙을 되풀이하지 않는다.
  if (!headOnly) try { map = composeStyleMap(r.axes, { extraCss }) } catch (e) { v.push(`style-compose-failed: ${e.message} — 스타일 맵 규칙(small-text·textarea-floor·hit-floor·footer-hit)을 검사하지 못했다`) }
  if (map) {
    for (const [hook, val] of Object.entries(map)) for (const t of tokensOf(val)) {
      const px = textPx(utilOf(t))
      if (px !== null && px < 14) v.push(`small-text: ${hook} ${t} = ${px}px — 글자는 14px 이상(DESIGN §2)`)
    }
    const ta = tokensOf(map['cn-textarea']).filter((t) => utilOf(t).startsWith('min-h-'))
    if (!ta.some((t) => !variantsOf(t))) v.push('textarea-floor: cn-textarea 에 min-h 가 없다 — 44px 이상(T4-c1)')
    for (const t of ta) {
      const px = lengthPx(utilOf(t).slice('min-h-'.length))
      if (px === null) v.push(`textarea-floor: cn-textarea ${t} 를 잴 수 없다 — 44px 이상임을 보일 것`)
      else if (px < 44) v.push(`textarea-floor: cn-textarea ${t} = ${px}px < 44px(T4-c1)`)
    }
    for (const [hook, floor] of floorHooks()) for (const t of tokensOf(map[hook]).filter((x) => utilOf(x).startsWith('min-h-'))) {
      const px = lengthPx(utilOf(t).slice('min-h-'.length))
      if (!variantsOf(t) && px !== floor) w.push(`hit-floor-minh: ${hook} ${t} — 부품의 인라인 min-h-[${floor}px] 가 twMerge 로 이 값을 지운다(T4-M4)`)
      if (variantsOf(t) && (px === null || px < floor)) v.push(`hit-floor: ${hook} ${t} — 변형 아래에서 히트 바닥 ${floor}px 를 덮는다`)
    }
    const btn = ['cn-button-size-default', 'cn-button-size-sm'].map((h) => heightPx(tokensOf(map[h])))
    if (btn.some((h) => h === null || h === undefined)) w.push('unmeasured: 기본·sm 버튼 높이를 잴 수 없어 바닥글 여백 검사를 44px 버튼으로 했다')
    const hBtn = Math.min(...btn.map((h) => h ?? 44))
    const need = Math.max(0, (44 - hBtn) / 2)
    for (const hook of ['cn-drawer-footer', 'cn-sheet-footer']) {
      const pb = bottomPaddingPx(tokensOf(map[hook]))
      if (pb === null) w.push(`unmeasured: ${hook} 아래 여백을 잴 수 없다 — (44 − ${hBtn})/2 = ${need}px 이상인지 눈으로 확인`)
      else if ((pb ?? 0) < need) v.push(`footer-hit: ${hook} 아래 여백 ${pb ?? 0}px < (44 − 버튼 ${hBtn}px)/2 = ${need}px — 닫기 버튼 히트 영역이 가장자리에서 잘린다(T4r1-c2)`)
    }
  }
  // 보드 B안(Task 6b fix 1 — 리뷰 I1): B 전체를 적용한 머리가 같은 규칙을 통과해야 한다. 축(스타일 맵)은 B가 바꾸지 않아 다시 재지 않는다.
  if (!headOnly && parsed.success && r.alternates) {
    const B = lintRecipeReport(applyAlternate(r), { banlist, compat, fontItems, extraCss, headOnly: true })
    for (const m of B.violations) uniqPush(v, `alternates: B안 적용 시 — ${m}`)
    for (const m of B.warnings) if (!w.includes(m)) uniqPush(w, `alternates: B안 적용 시 — ${m}`)
  }
  return { violations: v, warnings: w }
}
export const lintRecipe = (r, opts) => lintRecipeReport(r, opts).violations

// ── 생성 ────────────────────────────────────────────────────────────────
export function pkgVersions(root = ROOT) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return { ...pkg.devDependencies, ...pkg.dependencies }
}
// 다른 층(registry/factory/<층>/registry.json)의 항목 이름. 레시피 층(r)은 뺀다.
export function knownRegistryItems(root = ROOT) {
  const names = new Set()
  const factory = join(root, 'registry', 'factory')
  for (const d of readdirSync(factory, { withFileTypes: true })) {
    const p = join(factory, d.name, 'registry.json')
    if (d.isDirectory() && d.name !== 'r' && existsSync(p)) for (const i of JSON.parse(readFileSync(p, 'utf8')).items) names.add(i.name)
  }
  return names
}

// 아이콘 정본 모듈(P3-2 Task 1b): 블록은 레시피를 모르므로 아이콘을 @/registry/factory/icons 에서 부르고, 소비자에서는 그것이
// @/components/icons 가 된다. 레시피 base 가 components/icons/index.ts 를 실어 그 레시피의 어댑터를 다시 내보낸다 — 두 번째 레시피를
// add -o 하면 마지막 레시피의 어댑터로 바뀐다(「마지막 레시피가 이긴다」). 부품은 어댑터 경로(@/components/icons/<어댑터>)를 직접 부르므로 겹치지 않는다.
// registry:component 여야 한다: shadcn 4.21.0 은 registry:file·registry:item 내용을 import 바꾸기 없이 그대로 쓴다(updateFiles).
export const ICONS_INDEX_FILE = (id) => ({ path: `${id}/icons/index.ts`, type: 'registry:component', target: '@components/icons/index.ts' })
export const recipeIconsIndex = (r) => [
  `// ${BANNER}`,
  `// 아이콘 정본 모듈(레시피 ${r.id}: ${r.icons?.library ?? 'lucide'} ${r.icons?.weight ?? 'G1'} → 어댑터 ${iconAdapter(r.icons)}). 블록이 @/components/icons 로 부른다 — 마지막에 설치한 레시피의 어댑터다.`,
  `export * from "@/registry/factory/icons/${iconAdapter(r.icons)}"`,
  '',
].join('\n')

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
export function recipeItems(r, sources, { repo = REPO, ref, versions = pkgVersions(), knownItems = knownRegistryItems() } = {}) {
  const pin = ref ? `#${ref}` : ''
  const dep = (n) => `${repo}/${n}${pin}`
  const comps = new Set(sources.map((s) => s.name))
  const compItems = [...sources].sort(byName).map(({ name, source }) => {
    const { npm, internal } = parseImports(source)
    const deps = new Set(internal.filter((d) => d !== name).map((d) => (comps.has(d) ? `${r.id}-${d}` : d)))
    deps.add(BASE_ITEM)
    return {
      name: `${r.id}-${name}`, type: 'registry:ui', title: `${r.name} ${name}`, description: `web-factory recipe ${r.id}: ${name}`,
      files: [{ path: `${r.id}/ui/${name}.tsx`, type: 'registry:ui', target: `@ui/${name}.tsx` }],
      dependencies: npm.sort().map((d) => pinDependency(d, versions)),
      registryDependencies: [...deps].sort().map(dep),
    }
  })
  if (comps.has('alt')) throw new Error(`레시피 ${r.id}: 부품 이름 alt 는 B안 항목 ${r.id}-alt 와 겹친다`)
  // 레시피 base 한 벌(h = 머리). B안(-alt)도 같은 모양 — 머리만 applyAlternate 한 것이고 부품 항목은 A 것을 그대로 쓴다.
  const baseOf = (h, { name, title, description, meta }) => {
    const kits = kitItems(h)
    return {
      missing: kits.filter((n) => !knownItems.has(n)),
      item: {
        name, type: 'registry:base', extends: 'none', title, description,
        config: { iconLibrary: h.icons.library },
        files: [ICONS_INDEX_FILE(r.id)],
        registryDependencies: [...compItems.map((i) => i.name), BASE_ITEM, ...kits.filter((n) => knownItems.has(n))].sort().map(dep),
        // 아이콘 결(G1~G5) → :root 의 --icon-stroke·--icon-linecap·--icon-linejoin(icons-<library> 항목 css 가 읽는다, Phosphor 는 어댑터 굵기로).
        // 모양 토큰(shapeVars — --radius·--wf-mask-radius·--wf-shadow-surface, Task 8 A11)은 맨 뒤에 싣는다.
        cssVars: { theme: { ...fontStacks(h.fonts), ...colorTheme(h) }, light: { ...h.color.light, ...iconVars(h.icons?.weight), ...motionVars(h.motion), ...recipeMarkers(h), ...headingWeightVars(h), ...shapeVars(h) }, dark: { ...h.color.dark } },
        css: { '@layer base': { ...headingWeightRules(), ...faceRules(h) }, ...(singleWeightRules(h) ? { '@layer utilities': singleWeightRules(h) } : {}) },
        meta: { recipe: { ...meta, mood: h.mood, axes: h.axes, motion: h.motion, colorLogic: h.colorLogic, defaultTheme: h.defaultTheme ?? 'light', dynamics: h.dynamics, ...(h.hero ? { hero: h.hero } : {}), ...(h.alternates ? { alternates: h.alternates, alternateCombos: validCombos(h) } : {}), icons: h.icons, fonts: h.fonts, references: h.references, archetypes: h.archetypes, ...(h.archetypeConditions ? { archetypeConditions: h.archetypeConditions } : {}) } },
      },
    }
  }
  const a = baseOf(r, { name: r.id, title: r.name, description: `web-factory 레시피 ${r.id} — ${r.mood.join('·')}. 한 번 설치로 부품 ${compItems.length}개·색·서체·모션·아이콘` })
  const light = { ...r.color.light }, dark = { ...r.color.dark }
  const theme = { name: `${r.id}-theme`, type: 'registry:theme', title: `${r.name} 색`, description: `web-factory 레시피 ${r.id} 의 색만(라이트·다크)`, cssVars: { theme: colorTheme(r), light, dark } }
  // 보드 B안 설치 항목(P3-2 Task 8, 대장 A10): B가 바꾸는 축(color·fonts·hero·motion·dynamics)을 모두 적용한 머리로 cssVars·css·서체 키트를 만든다.
  // B안은 모양 축(axes)을 바꾸지 않으므로(Alternates 스키마) 부품을 다시 컴파일하지 않고 A 부품 항목(<id>-<부품>)에 의존한다 — 생성물 부품 파일이 늘지 않는다.
  // meta.recipe.alternateOf = A id, meta.recipe.hero = B 히어로. 모든 B 축을 적용한 머리가 lint 를 통과해야 한다(보드 조합과 같은 검사).
  const alt = r.alternates ? applyAlternate(r) : null
  if (alt && !validCombos(r).some((p) => p.length === altAxesOf(r.alternates).length)) throw new Error(`레시피 ${r.id}: B안 전체 조합이 lint 를 통과하지 않아 ${r.id}-alt 를 만들 수 없다`)
  const b = alt ? baseOf(alt, { name: `${r.id}-alt`, title: `${r.name} B안`, description: `web-factory 레시피 ${r.id} 보드 B안 — ${r.alternates.note}. 부품은 ${r.id} 것 그대로, 색·서체·모션·히어로만 B`, meta: { alternateOf: r.id } }) : null
  const missing = [...new Set([...a.missing, ...(b?.missing ?? [])])]
  return { items: [a.item, theme, ...(b ? [b.item] : []), ...compItems], missing }
}

// 기계가 읽는 레시피 표지(AI 티 관문 factory/qa/ai-tell.mjs 가 getComputedStyle 로 읽는다) — 찍어낸 사이트가 마크업을 바꾸지 않아도
// 레시피 CSS 범위(:root·[data-recipe])에 실려 간다. --wf-axes: 고른 축 값, --wf-font-tuned: YAML fonts.<역할>.tuned 를 적은 역할,
// --wf-motion: 레시피 motion(M0~M3)의 숫자 0~3 — 장면 훅(use-gsap-scene)이 뿌리 요소의 계산값으로 읽는다(P3-2 Task 1c). 장면 밖은 useRecipeMotion. 모르면 2.
export const recipeMotionLevel = (motion) => (/^M[0-3]$/.test(motion ?? '') ? motion.slice(1) : '2')
export const recipeMarkers = (r) => ({
  'wf-axes': `"${Object.values(r.axes ?? {}).join(' ')}"`,
  'wf-font-tuned': `"${FONT_ROLES.filter((k) => r.fonts?.[k]?.tuned?.trim()).join(' ')}"`,
  'wf-motion': recipeMotionLevel(r.motion),
})

// 모양 토큰(P3-2 Task 8, 대장 A11 — 1c 우려 3): 블록 표면은 부품 훅이 아니라 토큰으로만 레시피 모양을 받는다. 레시피가 :root 에 싣는다.
//   --radius             반경 축 값의 --radius(gen-radius-axis radiusToken — rounded-sm…4xl 이 따라간다). R3 는 R1 과 같다(컨트롤에 블롭 금지).
//   --wf-mask-radius     블록의 둥근 그림 칸(원형 이미지 마스크) 반경 — R3 만 블롭, 나머지는 원. 컨트롤에는 쓰지 않는다.
//   --wf-shadow-surface  그림자 축 값의 카드 그림자(cn-card-shadow)를 값 하나로 — 블록 표면이 떠 보여야 할 때 shadow-(--wf-shadow-surface).
export const SHAPE_VARS = ['radius', 'wf-mask-radius', 'wf-shadow-surface']
const arbitrary = (v) => v.replace(/\\_/g, '\u0000').replace(/_/g, ' ').replace(/\u0000/g, '_')
export function surfaceShadow(shadowValue) {
  const f = listValues().find((v) => v.axis === 'shadow' && v.id === shadowValue)
  if (!f) throw new Error(`그림자 값 ${shadowValue} 를 모른다`)
  const toks = (createStyleMap(readFileSync(f.file, 'utf8'))['cn-card-shadow'] ?? '').split(/\s+/).filter(Boolean)
  const sh = toks.map((t) => t.match(/^\[--sh:(.+)\]$/)?.[1]).find(Boolean)
  const val = toks.map((t) => t.match(/^shadow-\[(.+)\]$/)?.[1]).find(Boolean)
  if (!val) return 'none'
  return arbitrary(val).replaceAll('var(--sh)', sh ? arbitrary(sh) : 'var(--sh)')
}
export const shapeVars = (r) => ({ radius: radiusToken(r.axes.radius), 'wf-mask-radius': maskRadiusToken(r.axes.radius), 'wf-shadow-surface': surfaceShadow(r.axes.shadow) })

export function recipeCss(r) {
  const block = (sel, vars) => `${sel} {\n${Object.entries(vars).map(([k, val]) => `  --${k}: ${val};`).join('\n')}\n}\n`
  return [
    `/* ${BANNER} */`,
    `/* ${r.name}(${r.id}) 순수 CSS 변수 — shadcn 없이 단일 HTML 에 붙인다. 원천: registry/factory/recipes/${r.id}/DESIGN.md */`,
    block(':root', { ...r.color.light, ...fontStacks(r.fonts, { plain: true }), ...iconVars(r.icons?.weight), ...motionVars(r.motion), ...recipeMarkers(r), ...headingWeightVars(r), ...shapeVars(r) }),
    block('.dark', r.color.dark),
    `/* 제목 굵기(한글 제목 굵기 → fonts.display.weight → 700): 기본 층이라 굵기를 따로 준 요소가 이긴다 */\n@layer base {\n${cssText(headingWeightRules())}\n}\n`,
    ...(faceKeys(r).length ? [`/* 면 스코프(data-face): 면·칸 구획 안의 ring·primary·보조 글자·테두리를 그 면의 짝으로 */\n@layer base {\n${cssText(faceRules(r))}\n}\n`] : []),
    ...(singleWeightRules(r, { plain: true }) ? [`/* 단일 굵기 제목 서체(${singleWeightFaces(r.fonts).map((k) => r.fonts[k].family).join('·')}): 굵기 합성 끄기 · 부품 제목은 ${singleWeightFaces(r.fonts).includes('display') ? '본문 서체' : '한글 제목체를 건너뛴 제목 스택'} */\n${cssText(singleWeightRules(r, { plain: true }))}\n`] : []),
  ].join('\n')
}

const AXIS_LABEL = { button: '버튼', input: '입력', surface: '표면', table: '표', header: '머리', radius: '반경', shadow: '그림자', display: '디스플레이', texture: '질감' }
export function recipeReadme(r, { repo = REPO, ref } = {}) {
  const tag = ref ?? 'vX.Y.Z'
  const font = (role, label) => {
    const f = r.fonts?.[role]
    return f ? `${label} ${f.family}(\`${f.item}\`${f.weight ? `, 굵기 ${f.weight} — \`--${HEADING_WEIGHT_VAR}\`·\`.font-heading\` 기본값` : ''}${f.weightKo ? `, 한글 제목 굵기 ${f.weightKo} — \`--${HEADING_WEIGHT_KO_VAR}\`` : ''}${f.tuned ? `, 조정: ${f.tuned}` : ''})` : `${label} —`
  }
  const keys = Object.keys(r.color.light)
  const stacks = fontStacks(r.fonts)
  return [
    `<!-- ${BANNER} -->`,
    `# ${r.name} (\`${r.id}\`) — 레시피 안내`,
    '',
    `원천: \`registry/factory/recipes/${r.id}/DESIGN.md\`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 \`npm run gen:all\`.`,
    '',
    '## 설치',
    '',
    '```bash',
    `npx shadcn@4.21.0 add ${repo}/${r.id}#${tag}        # 디자인 시스템 전체(registry:base)`,
    `npx shadcn@4.21.0 add ${repo}/${r.id}-theme#${tag}  # 색만(registry:theme)`,
    ...(r.alternates ? [`npx shadcn@4.21.0 add ${repo}/${r.id}-alt#${tag}    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)`] : []),
    '```',
    '',
    `부품은 \`${r.id}-<부품>\`(예: \`${r.id}-button\`)으로 하나씩도 설치된다. 단일 HTML 에는 \`registry/factory/r/${r.id}/${r.id}.css\` 를 붙인다.`,
    '',
    '## 한눈에',
    '',
    `- 분위기: ${r.mood.join(' · ')}`,
    ...(r.hero ? [`- 첫 화면 히어로: ${r.hero}(${HEROES[r.hero].label})`] : []),
    `- 맞는 원형: ${r.archetypes.join(' · ')}`,
    ...(r.archetypeConditions ? [`- 원형별 쓰임 조건(archetypeConditions — \`ai/tasks/<원형>.json\` 후보의 condition): ${Object.entries(r.archetypeConditions).map(([a, c]) => `${a} — ${c}`).join(' · ')}`] : []),
    // 선택 축(display·texture)은 머리에 적었을 때만 적는다 — 기존 10벌 안내가 바뀌지 않게(Task 16a).
    `- 스타일 축: ${AXIS_ORDER.filter((a) => r.axes[a] !== undefined).map((a) => `${AXIS_LABEL[a]} ${r.axes[a]}`).join(' · ')}`,
    `- 모션 ${r.motion} · 아이콘 ${r.icons.library} ${r.icons.weight}(부품이 부르는 어댑터 \`components/icons/${iconAdapter(r.icons)}\` — 블록이 부르는 \`components/icons\`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 ${Object.entries(iconVars(r.icons.weight)).map(([k, v]) => `--${k}: ${v}`).join(' · ')})`,
    `- 서체: ${font('display', '제목')}${r.fonts?.displayKo ? ` · ${font('displayKo', '한글 제목')}` : ''} · ${font('body', '본문')} · ${font('mono', '고정폭')}${r.fonts?.prose ? ` · ${font('prose', '긴 글(prose)')}` : ''}`,
    `- 레퍼런스: ${r.references.join(' · ')}`,
    `- 색 논리 ${r.colorLogic}(${COLOR_LOGIC_LABEL[r.colorLogic] ?? '?'}) · 기본 테마 ${r.defaultTheme ?? 'light'}${r.defaultTheme === 'dark' ? '(DESIGN §5-B 다크 기본: 저장된 선택이 없으면 다크로 시작하고, 사용자가 설정에서 라이트·시스템으로 바꾼다 — 예: next-themes `defaultTheme="dark"` + `enableSystem`, 선택은 저장해 첫 페인트 전에 적용. 라이트 토큰도 같은 대비 기준을 채운다)' : ''}`,
    `- 역동 기법(dynamics, DESIGN §8-6): ${(r.dynamics ?? []).map((d) => `\`${d}\`(${DYNAMICS[d]?.label ?? '?'})`).join(' · ')} — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다`,
    ...(r.alternates ? [`- 보드 B안(alternates): ${[r.alternates.colorLogic && (r.alternates.colorLogic === r.colorLogic ? `새 팔레트(색 논리 ${r.colorLogic} 그대로)` : `색 논리 ${r.alternates.colorLogic}(${COLOR_LOGIC_LABEL[r.alternates.colorLogic]})`), r.alternates.motion && `모션 ${r.alternates.motion}`, r.alternates.dynamics && `기법 ${r.alternates.dynamics.map((d) => `\`${d}\``).join('·')}`, r.alternates.fonts && `서체 ${['display', 'displayKo'].map((k) => r.alternates.fonts[k]?.family).filter(Boolean).join(' · ')}`, r.alternates.hero && `첫 화면 ${r.alternates.hero}`].filter(Boolean).join(' · ')} — ${r.alternates.note}. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다`,
      `- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): ${validCombos(r).map((p) => (p.length === altAxesOf(r.alternates).length ? `B 전체(${p.join('+')})` : p.join('+'))).join(' · ') || '없음'}`] : []),
    ...(r.alternates?.color ? ['', '### B안 색 (적용하면 A 색을 덮는다)', '', '| 변수 | 라이트 | 다크 |', '|---|---|---|',
      ...Object.keys(r.alternates.color.light).map((k) => `| \`--${k}\` | \`${r.alternates.color.light[k]}\` | \`${r.alternates.color.dark[k]}\` |`)] : []),
    '',
    '## 모션 토큰',
    '',
    `모션 ${r.motion} 의 값이 \`:root\`(순수 CSS·registry cssVars.light)에 실린다 — \`motion-core\` 의 기본값(M2)을 덮고, 프리셋(\`.wf-fade-rise\` 등)이 \`var(--duration-enter, …)\` 로 읽는다. M0 은 등장 연출이 없다(\`--duration-enter: 0ms\`).`,
    '',
    ...Object.entries(motionVars(r.motion)).map(([k, v]) => `- \`--${k}\`: \`${v}\``),
    '',
    ...(roleKeys(r.color.light).length ? [
      '## 면·칸 색 (색 논리 K6~K8)',
      '',
      `이 레시피는 표준 shadcn 변수 밖의 색 키를 더 싣는다. cssVars.theme 이 \`--color-<키>\` 로 이어 두어 Tailwind 유틸리티로 바로 쓴다: ${roleKeys(r.color.light).filter((k) => !k.endsWith('-foreground')).map((k) => `\`bg-${k}\` + \`text-${k}-foreground\``).join(' · ')}.`,
      r.colorLogic === 'K8'
        ? '- K8 색 블록: 칸(벤토·카드·섹션 블록)마다 block-N 한 색. 번호 = 배치 순서이고 무지개 순서로 늘어놓지 않는다. 칸 크기로 위계를 주고, 가장 채도 높은 칸은 하나다. 칸 안 글자는 block-N-foreground 로만.'
        : r.colorLogic === 'K7'
          ? '- K7 듀오톤: field-1 이 한 색(면), primary 가 다른 색(잉크·CTA)이다. 면적은 대략 45·45·10(나머지 중립). 두 색 사이에 그라디언트를 넣지 않는다.'
          : '- K6 색 면: 바탕이나 섹션 띠를 field-1(·field-2)로 칠한다. 한 페이지의 면 색은 2개까지이고 섹션마다 번갈아도 된다. 면 위 글자는 field-N-foreground 로만(회색 글자 금지 — DESIGN §5).',
      '',
      `**면 구획에는 \`data-face\` 속성을 단다** — \`<section class="bg-${faceKeys(r)[0]} text-${faceKeys(r)[0]}-foreground" data-face="${faceKeys(r)[0]}">\`. 레시피 CSS(registry css·순수 CSS)가 \`[data-face="<키>"]\` 스코프마다 ${FACE_TOKENS.map((k) => `\`--${k}\``).join('·')} 를 그 면의 짝으로 다시 가리킨다. 그래서 면 안의 부품(주 버튼·포커스 링·보조 글자·입력 테두리·체크)이 면 위에서 대비를 지킨다(lint \`face-contrast\` — 두 테마, 글자 4.5 · 링·테두리·채움 3). 면 안에 놓인 카드(\`[data-slot="card"]\`)와 \`[data-face-reset]\` 요소는 레시피 원래 값으로 돌아간다. \`data-face\` 없이 면 색만 칠하면 바탕 기준 토큰이 그대로 남아 링·버튼이 사라질 수 있다.`,
      '',
      ...faceKeys(r).map((k) => { const w = faceTokens(r, k).weights; return `- \`[data-face="${k}"]\`: 면 조각(muted·accent·secondary) = ${k}-foreground ${w.surface}% · 보조 글자 ${w.muted}% · 테두리·입력 ${w.border}% (나머지는 ${k})` }),
      '',
    ] : []),
    '## 색 (라이트 / 다크)',
    '',
    '| 변수 | 라이트 | 다크 |',
    '|---|---|---|',
    ...keys.map((k) => `| \`--${k}\` | \`${r.color.light[k]}\` | \`${r.color.dark[k]}\` |`),
    '',
    '## 서체 스택 (cssVars.theme)',
    '',
    '소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.',
    '런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.',
    '',
    ...Object.entries(stacks).map(([k, val]) => `- \`--${k}\`: \`${val}\``),
    '',
    ...(stacks['font-prose'] ? ['`font-prose`(긴 글 목소리)는 레시피 부품이 쓰지 않는다. 원천 본문이 정한 자리(예: AI 답 문장)에서 소비자·블록이 직접 단다.', ''] : []),
    ...(singleWeightFaces(r.fonts).includes('display') ? [`제목 서체 ${r.fonts.display.family}는 굵기가 하나뿐이다. 레시피 CSS가 \`.font-heading\`의 굵기 합성을 끄고(\`font-synthesis-weight: none\`), 부품 제목 칸(\`${TITLE_SLOTS}\`)은 본문 스택으로 그린다. 제목 서체는 소비자가 직접 쓴 큰 제목에만 나온다.`, ''] : []),
    `\`font-heading-ko\`(\`--font-heading-ko\`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(${r.fonts?.displayKo ? `한글 제목체 ${r.fonts.displayKo.family} → ` : ''}본문 → 시스템 한글). 굵기는 \`.font-heading\`과 같은 제목 굵기 토큰(\`${HEADING_WEIGHT_VALUE}\`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 \`font-heading\` 대신 단다.`,
    '',
    ...(headingWeightKo(r.fonts) ? [`한글 제목 굵기 ${headingWeightKo(r.fonts)}(\`--${HEADING_WEIGHT_KO_VAR}\`, 머리 \`fonts.display.weightKo\`): 라틴 제목 서체 ${r.fonts.display.family}는 \`--${HEADING_WEIGHT_VAR}\` ${r.fonts.display.weight ?? HEADING_WEIGHT_DEFAULT}로, 제목의 한글은 ${headingKoFace(r.fonts).family}가 진짜 ${headingWeightKo(r.fonts)} 면으로 그린다. \`.font-heading\`·\`.font-heading-ko\`는 \`${HEADING_WEIGHT_VALUE}\`를 받는다.${singleWeightFaces(r.fonts).includes('display') ? ' 라틴 글자는 면이 하나뿐이라 굵기 합성을 끈 채 그 굵기 그대로 나온다.' : ''}`, ''] : []),
    ...(singleWeightFaces(r.fonts).includes('displayKo') ? [`한글 제목체 ${r.fonts.displayKo.family}는 굵기가 하나뿐이다. 레시피 CSS가 \`.font-heading\`의 굵기 합성을 끈다(\`font-synthesis-weight: none\`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다.${singleWeightFaces(r.fonts).includes('display') ? '' : ` 부품 제목 칸(\`${TITLE_SLOTS}\`)은 한글 제목체를 건너뛴 제목 스택(라틴 ${r.fonts.display.family} → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.`}`, ''] : []),
    '## 원천 본문',
    '',
    r.body.trimEnd(),
    '',
  ].join('\n')
}

// 컴파일본끼리의 import 를 레시피 폴더로 돌린다(T7-c1) — 저장소 안에서 r/<id>/ui 를 그대로 써도 기본 ui/ 부품이 섞이지 않는다.
// 소비자 설치에서는 shadcn 이 @/registry/<…>/ui 를 aliases.ui 로 바꾸므로 결과가 같다.
// 따옴표 종류(" ' `)와 모양(import … from · export … from · import())을 가리지 않는다 — 모듈 지정자 문자열 머리만 본다(P3-2 Task 1c, 리뷰 I-5:
// 홑따옴표 import 가 기본 ui 부품으로 남아 갤러리가 조용히 기본 모양을 그렸다).
export const recipeLocalImports = (source, id) => source.replace(/(["'`])@\/registry\/factory\/ui\//g, `$1@/registry/factory/r/${id}/ui/`)

// 선택 축(display·texture, Task 16a)이 가진 부품은 레시피 머리가 그 축을 적었을 때만 레시피에 컴파일한다 — 적지 않은 레시피(라이브러리 10벌)의 생성물·레지스트리
// 항목이 바이트 단위로 그대로다(J6). 두 부품의 기본 모양(D1·X0)은 기본 ui 층(registry/factory/ui)에 늘 있다.
export const OPTIONAL_AXIS_PARTS = { display: 'display.tsx', texture: 'texture.tsx' }
export const recipePartFiles = (r) => readdirSync(UI_SRC).filter((f) => f.endsWith('.tsx')).filter((f) => !Object.entries(OPTIONAL_AXIS_PARTS).some(([axis, file]) => file === f && r.axes?.[axis] === undefined)).sort()

// 한 벌 컴파일·생성. outRoot 아래 registry/factory/… 에 쓴다(기본: 저장소). 돌려줌: 항목·쓴 파일(outRoot 기준)·없는 키트 항목.
export async function buildRecipe(r, { repo = REPO, ref, outRoot = ROOT, versions = pkgVersions(), knownItems = knownRegistryItems(), extraCss = [] } = {}) {
  const bad = lintRecipe(r, { extraCss })
  if (bad.length) throw new Error(`레시피 ${r.id} 검사 위반 ${bad.length}건 — 생성하지 않는다:\n${bad.join('\n')}`)
  const map = composeStyleMap(r.axes, { extraCss })
  const at = (...p) => join(outRoot, 'registry', 'factory', ...p)
  const files = []
  const write = (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); files.push(relative(outRoot, p).split('\\').join('/')) }
  const uiOut = at('r', r.id, 'ui')
  mkdirSync(uiOut, { recursive: true })
  const src = recipePartFiles(r)
  for (const f of readdirSync(uiOut).filter((f) => f.endsWith('.tsx') && !src.includes(f))) rmSync(join(uiOut, f))
  const sources = []
  for (const f of src) {
    const source = recipeLocalImports(await compileSource(readFileSync(join(UI_SRC, f), 'utf8'), map, { iconAdapter: iconAdapter(r.icons) }), r.id)
    write(join(uiOut, f), source)
    sources.push({ name: f.slice(0, -4), source })
  }
  write(join(uiOut, MARKER), `${BANNER} 원천: registry/factory/recipes/${r.id}/DESIGN.md + registry/factory/ui-src\n`)
  write(at('r', r.id, `${r.id}.css`), recipeCss(r))
  write(at('r', ICONS_INDEX_FILE(r.id).path), recipeIconsIndex(r))
  write(at('recipes', r.id, 'README.generated.md'), recipeReadme(r, { repo, ref }))
  const { items, missing } = recipeItems(r, sources, { repo, ref, versions, knownItems })
  if (missing.length) console.warn(`recipe ${r.id}: 아직 없는 키트 항목 ${missing.join(', ')} — registryDependencies 에서 뺐다(Task 8·9 뒤 다시 생성하면 들어간다)`)
  return { items, files, missing }
}

// 한 벌 컴파일의 공개 입구(P3-3 Task 5). gen:all(아래 CLI)과 후보 레시피 컴파일(factory/stamp/compile-candidate.mjs)이 같은 코드를 쓴다 —
// 라이브러리 레시피를 임시 폴더에 컴파일하면 저장소 r/<id>/ 와 바이트가 같다는 것이 그 증명이다(stamp-compile.test.mjs).
// outRoot 아래 registry/factory/{r,recipes}/<id>/… 에 쓴다(buildRecipe). 저장소 루트를 주면 gen:all 과 같은 자리다. B안(<id>-alt)도 같은 recipeItems 로 나온다.
export const compileRecipeTo = async (r, outRoot, opts = {}) => {
  if (!outRoot) throw new Error('compileRecipeTo: outRoot 가 없다 — 저장소에 쓰려면 ROOT 를 명시한다')
  return buildRecipe(r, { ...opts, outRoot })
}

// 승격 초안 표시(P3-3 Task 12 — 결선에서 고른 생성·브랜드 레시피, factory/board/promote.mjs 가 쓴다). DESIGN.md 에 이 제목의 절이 있으면 운영자 확인 전이라
// gen:all 이 그 레시피를 넣지 않는다(recipeIds 가 건너뛴다 — 컴파일·갤러리·프리셋·에이전트 입구·차이 검사가 모두 이 목록을 쓴다). 운영자가 절을 지우면 들어간다.
export const UNCONFIRMED_HEADING = '## 운영자 확인 전'
export const isUnconfirmed = (md) => /^##[ \t]+운영자 확인 전[ \t]*\r?$/m.test(String(md))

// 저장소의 레시피 원천 목록(폴더 이름 = id). 운영자 확인 전 표시가 붙은 승격 초안은 뺀다.
export const recipeIds = (root = ROOT) => {
  const dir = join(root, 'registry', 'factory', 'recipes')
  const ok = (d) => d.isDirectory() && existsSync(join(dir, d.name, 'DESIGN.md')) && !isUnconfirmed(readFileSync(join(dir, d.name, 'DESIGN.md'), 'utf8'))
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter(ok).map((d) => d.name).sort() : []
}
// 운영자 확인 전 초안 목록(recipeIds 의 짝) — 「## 운영자 확인 전」 절이 있는 레시피 [{ id, head }]. head 는 parseRecipe 결과(본문 body 포함) 그대로라 lintRecipe 에 바로 넘긴다.
export const listRecipeDrafts = (root = ROOT) => {
  const dir = join(root, 'registry', 'factory', 'recipes')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'DESIGN.md'))).map((d) => d.name).sort()
    .map((id) => ({ id, md: readFileSync(join(dir, id, 'DESIGN.md'), 'utf8') })).filter((x) => isUnconfirmed(x.md)).map((x) => ({ id: x.id, head: parseRecipe(x.md) }))
}
const loadRecipe = (root, id) => parseRecipe(readFileSync(join(root, 'registry', 'factory', 'recipes', id, 'DESIGN.md'), 'utf8'))

// gen-registry 의 레시피 층: 컴파일된 r/<id>/ui 를 읽어 항목을 만든다(다시 컴파일하지 않는다). 이름이 다른 층과 겹치면 멈춘다.
export function recipeRegistry({ repo = REPO, ref, versions = pkgVersions(), root = ROOT } = {}) {
  const knownItems = knownRegistryItems(root)
  const items = []
  for (const id of recipeIds(root)) {
    const ui = join(root, 'registry', 'factory', 'r', id, 'ui')
    if (!existsSync(ui)) throw new Error(`r/${id}/ui 가 없다 — 먼저 node ${GENERATOR}`)
    const sources = readdirSync(ui).filter((f) => f.endsWith('.tsx')).sort().map((f) => ({ name: f.slice(0, -4), source: readFileSync(join(ui, f), 'utf8') }))
    items.push(...recipeItems(loadRecipe(root, id), sources, { repo, ref, versions, knownItems }).items)
  }
  const seen = new Set(knownItems)
  for (const i of items) { if (seen.has(i.name)) throw new Error(`레지스트리 항목 이름이 겹친다: ${i.name}`); seen.add(i.name) }
  return items
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const ref = parseRef(argv)
  const oi = argv.indexOf('--out')
  const outRoot = oi === -1 ? ROOT : argv[oi + 1]
  if (oi !== -1 && (!outRoot || outRoot.startsWith('--'))) { console.error('사용: recipe.mjs [<DESIGN.md> … --out <폴더>] [--ref vX.Y.Z]'); process.exit(2) }
  const paths = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref' || argv[i] === '--out') i++
    else if (!argv[i].startsWith('--')) paths.push(argv[i])
  }
  const knownItems = knownRegistryItems()
  const targets = paths.length
    ? paths.map((p) => ({ label: p, r: parseRecipe(readFileSync(p, 'utf8')) }))
    : recipeIds().map((id) => ({ label: `recipes/${id}`, r: loadRecipe(ROOT, id), id }))
  let bad = 0
  for (const t of targets) {
    const { violations, warnings } = lintRecipeReport(t.r, { fontItems: knownItems })
    if (t.id && t.r.id !== t.id) violations.push(`schema: 폴더 이름 ${t.id} ≠ id ${t.r.id}`)
    for (const m of warnings) console.warn(`WARN ${t.label} ${m}`)
    for (const m of violations) console.error(`FAIL ${t.label} ${m}`)
    bad += violations.length
  }
  if (bad) { console.error(`recipe: 위반 ${bad}건 — 생성하지 않았다`); process.exit(1) }
  for (const t of targets) {
    const { items, files } = await compileRecipeTo(t.r, outRoot, { ref, knownItems })
    console.log(`recipe ${t.r.id}: 항목 ${items.length} · 파일 ${files.length} → ${outRoot === ROOT ? '저장소' : outRoot}`)
  }
  if (!paths.length) {
    // 원천이 사라진 레시피의 생성물을 치운다(생성기 표지가 있는 폴더만).
    const ids = new Set(recipeIds())
    if (existsSync(R_DIR)) for (const d of readdirSync(R_DIR, { withFileTypes: true }))
      if (d.isDirectory() && !ids.has(d.name) && existsSync(join(R_DIR, d.name, 'ui', MARKER))) { rmSync(join(R_DIR, d.name), { recursive: true }); console.log(`recipe: 원천 없는 r/${d.name} 삭제`) }
    if (existsSync(RECIPES_DIR)) for (const d of readdirSync(RECIPES_DIR, { withFileTypes: true })) {
      const dir = join(RECIPES_DIR, d.name)
      if (!d.isDirectory() || ids.has(d.name) || !existsSync(join(dir, 'README.generated.md'))) continue
      rmSync(join(dir, 'README.generated.md'))
      if (!readdirSync(dir).length) rmSync(dir, { recursive: true })
    }
    console.log(`recipe: ${targets.length}벌`)
  }
}
