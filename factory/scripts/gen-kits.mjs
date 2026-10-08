// 모션·아이콘 키트: registry/factory/motion/*(원천) · registry/factory/icons/*(원천) → 층별 registry.json(생성물) + Phosphor 굵기 사본(생성물).
// 사용: node factory/scripts/gen-kits.mjs [--ref vX.Y.Z]   (npm run gen:all 이 레시피보다 먼저 돌린다 — 레시피가 항목 이름 motion-core·icons-<library> 를 읽는다)
//
// 항목(이름은 판정 T6-c2로 고정):
//   motion-core          registry:item  motion.css 의 @theme → cssVars.theme(이징 5·길이 5), 나머지 규칙 → css(프리셋 키프레임 3 + reduced-motion). 훅 둘에 의존.
//   use-reduced-motion   registry:hook  · use-pause-offscreen  registry:hook  → 소비자 components/motion/(계약·콘텐츠 층과 같은 target 방식)
//   motion-gsap          registry:lib   GSAP 장면 훅·기법 도우미·배율·split-text 원천 네 파일 → 소비자 components/motion/, 의존 gsap(고정 버전)·motion-core(Task 11)
//   icons-<library>      registry:item  어댑터(정본 이름 → 라이브러리) + icon.tsx → 소비자 components/icons/. IconButton 은 부품(ui-src/icon-button.tsx)이다 —
//                        레시피마다 컴파일되어 그 button 모양을 따르고 button 의존을 보통 부품처럼 적는다(판정 T9-c3).
//                        컴파일된 부품은 @/registry/factory/icons/<어댑터> 를 부르고, shadcn 이 그것을 @/components/icons/<어댑터> 로 바꾼다
//                        (aliases 에 없는 @/registry/<층>/… 은 aliases.components 아래로 간다 — shadcn 4.21.0 updateImportAliases).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseImports, pinDependency, parseRef, parseCss, ICON_LIBRARIES } from './lib/registry-lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const MOTION_DIR = join(ROOT, 'registry', 'factory', 'motion')
export const ICONS_DIR = join(ROOT, 'registry', 'factory', 'icons')
const REPO = 'nowwcastle-sudo/sitebrew'
const SCHEMA = 'https://ui.shadcn.com/schema/registry.json'
export const GENERATOR = 'factory/scripts/gen-kits.mjs'

export const LIBRARIES = ICON_LIBRARIES // 목록 원천은 registry-lib 하나(최종 리뷰 M5)
// 어댑터가 그리는 SVG 의 클래스 — 선 굵기 규칙을 거는 선택자. Phosphor 는 채운 도형이라 선 규칙이 없다(굵기 사본으로).
export const STROKE_SELECTOR = { lucide: 'svg.lucide', tabler: 'svg.tabler-icon' }

// 선 아이콘(lucide·tabler)이 결 변수를 읽는 선언. 변수가 없으면 두 라이브러리의 기본값(2 · round · round) 그대로다.
export const STROKE_DECLS = { 'stroke-width': 'var(--icon-stroke, 2)', 'stroke-linecap': 'var(--icon-linecap, round)', 'stroke-linejoin': 'var(--icon-linejoin, round)' }

// 아이콘 결(G1~G5, style_axes 축 12) → 선 굵기·끝·모서리(lucide·tabler, CSS 변수) · Phosphor 굵기.
// Phosphor 는 선 굵기 대신 굵기 모양이 따로 있다: thin 0.75 · light 1.125 · regular 1.5 · bold 2.25px(24px 기준, 256 격자의 8·12·16·24).
// 채움(fill)은 결이 아니라 「선택됨」 표시에만 쓴다(DESIGN §6-A) — G5 도 bold 로 둔다.
export const ICON_GRAIN = {
  G1: { stroke: '2', linecap: 'round', linejoin: 'round', phosphor: 'regular', note: 'outlined 2px — 일반 UI 기본' },
  G2: { stroke: '1.5', linecap: 'round', linejoin: 'round', phosphor: 'light', note: 'thin 1~1.5px — 에디토리얼' },
  G3: { stroke: '2', linecap: 'square', linejoin: 'miter', phosphor: 'regular', note: 'sharp 2px — 기술·핀테크(Phosphor 는 각진 모양이 없어 regular)' },
  G4: { stroke: '2', linecap: 'round', linejoin: 'round', phosphor: 'regular', note: 'rounded 2px — 친근·건강' },
  G5: { stroke: '2.5', linecap: 'round', linejoin: 'round', phosphor: 'bold', note: 'bold — 문서형·기술형' },
}
// 레시피 icons → 컴파일본이 부를 어댑터 모듈 이름(registry/factory/icons/<이것>.ts).
export function iconAdapter(icons) {
  const lib = icons?.library ?? 'lucide'
  if (lib !== 'phosphor') return lib
  const w = ICON_GRAIN[icons?.weight]?.phosphor ?? 'regular'
  return w === 'regular' ? 'phosphor' : `phosphor-${w}`
}
// 레시피가 소비자 :root 에 싣는 아이콘 변수(cssVars.light).
export const iconVars = (weight) => {
  const g = ICON_GRAIN[weight] ?? ICON_GRAIN.G1
  return { 'icon-stroke': g.stroke, 'icon-linecap': g.linecap, 'icon-linejoin': g.linejoin }
}
export const PHOSPHOR_WEIGHTS = [...new Set(Object.values(ICON_GRAIN).map((g) => g.phosphor))].filter((w) => w !== 'regular').sort()

// phosphor.ts 의 WEIGHT 한 줄만 바꾼 사본(phosphor-<굵기>.ts). 머리줄로 원천을 밝힌다.
// 원천의 줄바꿈(LF·CRLF)을 그대로 따른다 — CRLF checkout 에서도 사본이 원천과 같은 모양이다(T9-I1).
const WEIGHT_LINE = /^const WEIGHT: IconWeight = "regular"(?=\r?$)/m
export function phosphorVariant(source, weight) {
  if (!WEIGHT_LINE.test(source)) throw new Error('phosphor.ts 에 `const WEIGHT: IconWeight = "regular"` 줄이 없다')
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  return `// 생성물 — ${GENERATOR} 가 phosphor.ts 에서 WEIGHT 만 "${weight}" 로 바꿔 만든다. 손으로 고치지 않는다.${eol}` +
    source.replace(WEIGHT_LINE, `const WEIGHT: IconWeight = "${weight}"`)
}

// 모션 강도(M0~M3, style_axes 축 8) → 모션 토큰(시험작 D7, DESIGN §8-2 타이밍 표). motion.css 의 @theme 기본값은 M2(기본)와 같다
// (kits.test). 레시피는 자기 motion 값의 토큰을 :root(cssVars.light·순수 CSS)와 갤러리 [data-recipe] 에 실어 motion-core 기본값을 덮는다 —
// 프리셋이 var(--duration-enter, …) 로 읽는다.
//   M0 정지: 전환 0~200ms, hover 120ms·팝오버 125ms(§8-2 MUST 바닥 — Task 6b 리뷰 M1), 등장 연출 없음(enter 0ms — 프리셋이 바로 최종 상태), 튕김 없음
//   M1 Subtle: hover 150~200ms, 등장 300ms(축 8 「300~400ms」의 아래 끝 — r1·r4 본문 「등장 300ms 이하」), power1.out 계열
//   M2 Standard: hover 200~300ms, 등장 400~600ms, §8-2 표준 이징
//   M3 높음: hover 200ms(§8-2 MUST 「hover 120~200ms」 상한), 시트 350 · 등장 700ms(표의 상한), 더 가파른 감속(expo-out)
const EASE_QUAD = { out: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', inOut: 'cubic-bezier(0.45, 0, 0.55, 1)' }
const EASE_EXIT = 'cubic-bezier(0.4, 0, 1, 1)'
const EASE_SHEET = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const MOTION_TOKENS = {
  M0: {
    'ease-standard': EASE_QUAD.out, 'ease-emphasized': EASE_QUAD.out, 'ease-in-screen': EASE_QUAD.inOut, 'ease-exit': EASE_EXIT, 'ease-sheet': EASE_QUAD.out,
    'duration-press': '80ms', 'duration-hover': '120ms', 'duration-popover': '125ms', 'duration-enter': '0ms', 'duration-sheet': '200ms',
  },
  M1: {
    'ease-standard': EASE_QUAD.out, 'ease-emphasized': 'cubic-bezier(0.2, 0, 0, 1)', 'ease-in-screen': EASE_QUAD.inOut, 'ease-exit': EASE_EXIT, 'ease-sheet': EASE_SHEET,
    'duration-press': '100ms', 'duration-hover': '150ms', 'duration-popover': '150ms', 'duration-enter': '300ms', 'duration-sheet': '260ms',
  },
  M2: {
    'ease-standard': 'cubic-bezier(0.23, 1, 0.32, 1)', 'ease-emphasized': 'cubic-bezier(0.2, 0, 0, 1)', 'ease-in-screen': 'cubic-bezier(0.77, 0, 0.175, 1)', 'ease-exit': EASE_EXIT, 'ease-sheet': EASE_SHEET,
    'duration-press': '120ms', 'duration-hover': '200ms', 'duration-popover': '160ms', 'duration-enter': '500ms', 'duration-sheet': '320ms',
  },
  M3: {
    'ease-standard': 'cubic-bezier(0.16, 1, 0.3, 1)', 'ease-emphasized': 'cubic-bezier(0.05, 0.7, 0.1, 1)', 'ease-in-screen': 'cubic-bezier(0.77, 0, 0.175, 1)', 'ease-exit': EASE_EXIT, 'ease-sheet': EASE_SHEET,
    'duration-press': '160ms', 'duration-hover': '200ms', 'duration-popover': '200ms', 'duration-enter': '700ms', 'duration-sheet': '350ms',
  },
}
// 레시피가 소비자 :root 에 싣는 모션 변수. 모르는 값이면 M2(기본).
export const motionVars = (motion) => ({ ...(MOTION_TOKENS[motion] ?? MOTION_TOKENS.M2) })

const npmDeps = (sources, versions) => [...new Set(sources.flatMap((s) => parseImports(s).npm))].sort().map((d) => pinDependency(d, versions))

export function motionItems({ dir = MOTION_DIR, repo = REPO, ref, versions } = {}) {
  const pin = ref ? `#${ref}` : ''
  const src = readFileSync(join(dir, 'motion.css'), 'utf8')
  const rules = parseCss(src)
  const theme = rules.filter((r) => r.sel === '@theme')
  const themeVars = Object.fromEntries(theme.flatMap((r) => r.decls).filter(([p]) => p.startsWith('--')).map(([p, v]) => [p.slice(2), v]))
  const toObj = (rs) => Object.fromEntries(rs.map((r) => [r.sel, { ...Object.fromEntries(r.decls), ...toObj(r.children) }]))
  const hook = (name) => {
    const source = readFileSync(join(dir, `${name}.ts`), 'utf8')
    return {
      name, type: 'registry:hook', title: name, description: `web-factory motion: ${name}`,
      // 소비자 자리 components/motion/ — 블록은 @/registry/factory/motion/<훅> 을 부르고 shadcn 이 그것을 @/components/motion/<훅> 으로
      // 바꾼다(/hooks·/lib 이 아닌 층). target 이 없으면 hooks/ 에 깔려 import 가 풀리지 않는다(최종 리뷰 I1, 검사 install-closure.test.mjs).
      files: [{ path: `${name}.ts`, type: 'registry:hook', target: `@components/motion/${name}.ts` }],
      dependencies: npmDeps([source], versions), registryDependencies: [],
    }
  }
  // use-recipe-motion(P3-2): 레시피 모션 단계(--wf-motion)를 읽는 블록용 훅 — 레시피 base 가 motion-core 를 거쳐 깔아 둔다.
  const hooks = ['use-pause-offscreen', 'use-recipe-motion', 'use-reduced-motion'].map(hook)
  // motion-gsap(Task 11 — 첫 설치형 기법 부품): GSAP 장면 훅 + §8-6 기법 도우미 + 순수 배율 모듈 + split-text 원천 + 서버 렌더 첫 칠 가림
  // (motion-boot — Task 11 fix, <head> 에 두는 스크립트·CSS). 다섯 파일이 한 항목이라
  // 서로의 import(@/registry/factory/motion/<파일>)는 같은 항목 안에서 풀린다 — registryDependencies 는 토큰을 싣는 motion-core 하나.
  // gsap 은 package.json 의 고정 버전(3.15.0) — 라이선스는 docs/qa/motion-licenses.md.
  const gsapSources = MOTION_GSAP_FILES.map((f) => readFileSync(join(dir, f), 'utf8'))
  const gsap = {
    name: 'motion-gsap', type: 'registry:lib', title: 'GSAP 모션 장면',
    description: 'web-factory 모션: GSAP 장면 훅(useGsapScene — 동작 줄이기·M0 정지 갈래, 화면 밖·숨은 탭 정지, 되돌리기, 등장 끝 신호 data-wf-entered·wf:entered, 포인터 겹) + 서버 렌더 첫 칠 가림 MotionBoot(<head> — 장면 시작 전까지 [data-enter] 숨김, 1.5초 안전장치) + §8-6 기법 도우미(split-text·clip-reveal·svg-draw·oversize-crop·sticky-stack·marquee·tilt-3d·magnetic-cta·variable-axis·ambient drift·view-transition·parallax·pointer depth·count-up). 길이·곡선은 레시피 모션 토큰, 거리·연쇄는 강도(M1~M3) 배율',
    files: MOTION_GSAP_FILES.map((f) => ({ path: f, type: 'registry:lib', target: `@components/motion/${f}` })),
    dependencies: npmDeps(gsapSources, versions),
    registryDependencies: [`${repo}/motion-core${pin}`],
  }
  const core = {
    name: 'motion-core', type: 'registry:item', title: '모션 키트',
    description: 'web-factory 모션: 이징 5·길이 5 토큰(@theme), 프리셋 wf-fade-rise·wf-sheet-in·wf-breathe, 동작 줄이기에서 끔, 화면 밖·탭 숨김 정지 훅',
    registryDependencies: hooks.map((h) => `${repo}/${h.name}${pin}`),
    cssVars: { theme: themeVars },
    css: toObj(rules.filter((r) => r.sel !== '@theme')),
  }
  // motion-lottie(FV1 Task 5.6 — 선택 설치): Lottie 재생 컴포넌트. 재생기 @lottiefiles/dotlottie-web 은 동적 import 라 parseImports 가 못 본다 — 의존을 여기서 직접 적는다(package.json 의 고정 판).
  // 계획 함수(motion-scale)는 motion-gsap, 동작 줄이기·화면 밖 훅은 motion-core 가 싣는다. 라이선스는 docs/qa/motion-licenses.md.
  const lottie = {
    name: 'motion-lottie', type: 'registry:lib', title: 'Lottie 재생(선택)',
    description: 'web-factory 모션(선택 설치): dotLottie 재생 컴포넌트 LottiePlayback — 재생기는 동적 import, 동작 줄이기면 첫 프레임 정지, 화면 밖·숨은 탭·사용자 정지에서 멈춤, 무한 반복·5초 넘는 재생이면 멈춤 단추가 필요하다고 알림(onNeedsPause), wasm 은 같은 출처 주소 선택(wasmUrl)',
    files: MOTION_LOTTIE_FILES.map((f) => ({ path: f, type: 'registry:lib', target: `@components/motion/${f}` })),
    dependencies: [pinDependency(LOTTIE_PACKAGE, versions)],
    registryDependencies: [`${repo}/motion-core${pin}`, `${repo}/motion-gsap${pin}`],
  }
  return [core, ...hooks, gsap, lottie]
}
export const MOTION_GSAP_FILES = ['motion-scale.ts', 'use-gsap-scene.ts', 'gsap-techniques.ts', 'split-source.tsx', 'motion-boot.tsx']
export const MOTION_LOTTIE_FILES = ['motion-lottie.tsx']
export const LOTTIE_PACKAGE = '@lottiefiles/dotlottie-web'

export function iconItems({ dir = ICONS_DIR, versions } = {}) {
  const common = ['icon.tsx']
  return LIBRARIES.map((lib) => {
    const adapters = lib === 'phosphor' ? ['phosphor.ts', ...PHOSPHOR_WEIGHTS.map((w) => `phosphor-${w}.ts`)] : [`${lib}.ts`]
    const files = [...adapters, ...common]
    const sources = files.map((f) => readFileSync(join(dir, f), 'utf8'))
    const sel = STROKE_SELECTOR[lib]
    return {
      name: `icons-${lib}`, type: 'registry:item', title: `아이콘 ${lib}`,
      description: `web-factory 아이콘: 정본 이름 → ${lib} 어댑터 + Icon(16·20·24, currentColor, 라벨 없으면 aria-hidden)`,
      files: files.map((f) => ({ path: f, type: 'registry:component', target: `@components/icons/${f}` })),
      dependencies: npmDeps(sources, versions),
      registryDependencies: [],
      ...(sel ? { css: { '@layer base': { [sel]: STROKE_DECLS } } } : {}),
      meta: { adapter: `${lib}.ts`, ...(lib === 'phosphor' ? { weights: Object.fromEntries(Object.entries(ICON_GRAIN).map(([g, v]) => [g, v.phosphor])) } : {}) },
    }
  })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const ref = parseRef(process.argv.slice(2))
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const versions = { ...pkg.devDependencies, ...pkg.dependencies }
  const phosphor = readFileSync(join(ICONS_DIR, 'phosphor.ts'), 'utf8')
  for (const w of PHOSPHOR_WEIGHTS) writeFileSync(join(ICONS_DIR, `phosphor-${w}.ts`), phosphorVariant(phosphor, w))
  const write = (dir, items) => { if (!existsSync(dir)) throw new Error(`${dir} 가 없다`); writeFileSync(join(dir, 'registry.json'), JSON.stringify({ $schema: SCHEMA, items }, null, 2) + '\n') }
  const motion = motionItems({ ref, versions })
  const icons = iconItems({ versions })
  write(MOTION_DIR, motion)
  write(ICONS_DIR, icons)
  console.log(`gen-kits: motion ${motion.length} · icons ${icons.length} · phosphor 사본 ${PHOSPHOR_WEIGHTS.join(',')}`)
}
