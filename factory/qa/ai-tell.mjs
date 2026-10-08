// AI 티 점수 관문 — 렌더된 페이지에서 「AI가 만든 티」 패턴을 찾아 가중합으로 매긴다(Task 12, 지금은 경고 모드).
// 사용: node factory/qa/ai-tell.mjs <url|html> --out <dir> [--mode warn|block] [--threshold N] [--no-kas]
//   → <dir>/ai-tell.json { score, max, hits: [{ id, weight, where, … }] }
//   warn(기본): 점수와 상관없이 종료 0 · block: G 점수 > threshold 면 종료 3 · 인자가 틀리면 종료 2
//   · 종료 1 = 측정 없음(탐색 실패·HTTP 4xx/5xx·Chrome 오류 페이지·kas 실패) — warn 에서도. 이때 ai-tell.json 은 남기지 않는다(C124 — kas 실패도 도구 실패다).
//   · --distribution <ai-tell.json|폴더>… = 결과 파일들의 G 점수 분포(min·p50·p90·max)만 찍는다 — 문턱을 정할 때 컨트롤러가 골든 결과에 쓴다(C120, 문턱은 여기서 고르지 않는다).
// 축·서체 조정 맥락: 레시피 CSS 의 --wf-axes·--wf-font-tuned(recipe.mjs recipeMarkers), /qa/axes 칸의 data-axes.
// 검사 원천: docs/inputs/ai_tell_gate.md 의 정적 정규식 67·계산된 스타일 54 중 헤드리스 Chrome(CDP)으로 잴 수 있는 것(CHECKS).
//   못 재는 것은 SKIPPED 에 이유와 함께 둔다(테스트가 둘의 합이 원천 목록과 같은지 본다).
// 점수: 적중한 검사의 가중치 합(MUST 3 · SHOULD 1). 한 검사가 여러 곳에서 걸려도 가중치는 한 번 — 원천 「점수 방식」 1.
// 예외: factory/qa/data/ai-tell-exceptions.json(DESIGN 이 허용한 값 — 곡선·축 값 한정 예외). 금지 목록: factory/qa/data/banlist.json.
// kill-ai-slop scan.mjs 가 설치돼 있으면(~/.claude/skills/kill-ai-slop) 같은 입력을 돌려, 우리 검사가 놓친 tell 만 1점씩 더한다.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startChrome, navigateAndWait, connect } from './cdp.mjs'
import { LINE_VALUES } from '../scripts/compat.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
export const DATA = join(here, 'data')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 검사 표 ──────────────────────────────────────────────────────────────
// kind: dom = 렌더 뒤 getComputedStyle·DOM 측정(1440·375) · css = 스타일 규칙 텍스트 · text = 마크업·인라인 스크립트 텍스트
export const CHECKS = [
  ['G002', 3, 'dom', '문장형 초대형 제목(1440 h1 3줄 이상·96px 초과·10단어 이상 48px 이상)'],
  ['G003', 3, 'dom', '대문자 큰 제목의 행간 1.0 미만'],
  ['G004', 1, 'dom', '세리프 본문 행간이 산세리프 본문보다 좁다'],
  ['G005', 3, 'dom', '문단 속 강조 남발·장식용 밑줄·취소선'],
  ['G006', 1, 'dom', '제목과 본문 굵기 차 300 미만'],
  ['G007', 3, 'dom', '라틴 문구 대문자 변환'],
  ['G008', 3, 'dom', '숫자와 단위 사이 일반 공백(줄바꿈되는 「10 MB」)'],
  ['G009', 1, 'dom', '한글 수사 + 건·개·명(「여덟 건」)'],
  ['G010', 3, 'dom', '짧은 요소 속 em dash(—)·문단당 2개 이상'],
  ['G011', 1, 'dom', 'html·body overflow-x: hidden·375px 가로 스크롤'],
  ['G012', 1, 'dom', '히어로 아래 여백 ÷ 위 여백 1.3 미만'],
  ['G013', 1, 'css', '@media 조건에 px'],
  ['G015', 3, 'dom', '히어로 속 글 덩어리 5개 이상·로고 이미지 3개 이상'],
  ['G018', 1, 'dom', '같은 구조 섹션 반복'],
  ['G019', 1, 'css', 'OKLCH 바탕·글자 토큰이 DESIGN §5 대역 밖'],
  ['G020', 3, 'dom', '무채색 글자 + 유채색 배경'],
  ['G021', 3, 'css', '저채도 토큰에 따뜻한·차가운 색조 공존'],
  ['G022', 3, 'css', '글자색 흰색 하드코딩'],
  ['G023', 1, 'css', '빌드에 --color-indigo 기본 램프'],
  ['G025', 3, 'css', '다크 테마 없음(prefers-color-scheme·.dark 모두 없음)'],
  ['G026', 3, 'dom', '배경 줄무늬·격자 오버레이·옅은 그라디언트 카드'],
  ['G027', 3, 'dom', '테두리 + 큰 블러 그림자 동시'],
  ['G028', 1, 'dom', '그림자 블러가 요소 짧은 변의 절반 초과'],
  ['G029', 1, 'dom', '모서리에서 끊기는 테두리·::selection·caret-color·밑줄 간격 선언 없음'],
  ['G031', 3, 'dom', '상투 아이콘(Rocket·Shield·Sparkles)·🚀⚡🔒🎉'],
  ['G032', 1, 'dom', '파스텔 아이콘 타일·제 색 틴트 아이콘'],
  ['G033', 3, 'dom', '흐르는 요소에 backdrop-filter'],
  ['G034', 3, 'dom', 'backdrop-filter 를 쓰는데 prefers-reduced-transparency 없음'],
  ['G036', 3, 'dom', '장식용 손그림 SVG(sketch·doodle·곡선 과다)'],
  ['G038', 1, 'dom', '임시 이미지·TODO 흔적'],
  ['G041', 3, 'dom', '비활성 요소 불투명도 0.38~0.55 밖'],
  ['G042', 1, 'dom', ':focus-visible 로 바뀌는 속성을 전환한다(포커스 표시가 늦게 나타남)'],
  ['G043', 3, 'dom', '누르는 요소가 두 줄로 쪼개짐'],
  ['G044', 3, 'dom', 'hover 가 크기·뒤 요소 위치를 옮긴다(로딩·오류 절반은 상호작용이 필요해 재지 않음)'],
  ['G045', 3, 'dom', '누르는 요소 touch-action ≠ manipulation'],
  ['G048', 1, 'dom', '같은 폼 입력·버튼 높이 다름·textarea 가로 크기 조절'],
  ['G049', 1, 'dom', 'email 입력 spellcheck 없음·autofocus'],
  ['G052', 1, 'dom', '대화상자 폭이 384·512·640·768 밖(모바일 100%−32px 아님)'],
  ['G053', 3, 'dom', '네이티브로 될 체크박스·라디오·선택을 role 로 흉내'],
  ['G056', 1, 'dom', '연속 행의 위·아래 테두리 겹침'],
  ['G057', 3, 'dom', '작업명 없는 「로딩 중」·aria-busy 문구가 「…」로 안 끝남'],
  ['G060', 3, 'dom', '섹션 절반 이상에 같은 등장 효과'],
  ['G062', 3, 'css', 'hover 확대 1.03 이상·hover 가 속성 2개 이상 바꿈'],
  ['G063', 3, 'dom', '팝오버·메뉴 transform-origin 가운데'],
  ['G064', 3, 'css', '토스트·토글에 animation(끊을 수 없는 전환)'],
  ['G066', 3, 'dom', '등장 지연 500ms 초과'],
  ['G067', 1, 'css', '탭 패널 transform·높이 전환'],
  ['G068', 1, 'text', '상태 전환 스프링 bounce > 0'],
  ['G070', 3, 'css', '회전 키프레임 대상에 translate(-50%) 동시(흔들리는 스피너)'],
  ['G072', 3, 'text', 'window scroll 리스너·scrollY 진행 계산'],
  ['G074', 3, 'dom', '「아래에·위에」 + 입력 동사(위치로 가리키는 안내)'],
  ['G075', 1, 'dom', '인용문 4줄 이상'],
  ['G076', 3, 'dom', 'PDF 링크에 용량 표기 없음'],
  ['G078', 1, 'dom', '데스크톱 헤더 높이 80px 초과'],
  ['G081', 1, 'dom', 'preconnect 없는 외부 자산 호스트'],
  ['G084', 3, 'dom', 'h1 개수 ≠ 1·h1 이 3단어 미만'],
  ['G087', 1, 'dom', '수치가 data·output·kbd·samp·dl 밖'],
  ['G088', 3, 'css', '물리 방향 속성(margin-left 등)'],
  ['G090', 3, 'dom', '기본값 세리프 디스플레이(Fraunces·Instrument Serif·Playfair·Cormorant·Lora) 무조정'],
  ['G091', 1, 'dom', '기본값 디스플레이·본문 세리프·모노 서체 무조정'],
  ['G092', 1, 'css', 'UI 키트 기본 토큰 그대로'],
  ['G093', 3, 'dom', '그라디언트 글자(background-clip: text)'],
  ['G094', 3, 'dom', '글로우(오프셋 0 유채색 그림자·유채색 블러 text-shadow)'],
  ['G095', 3, 'dom', '한쪽 변 굵은 색 띠(side-tab)'],
  ['G097', 3, 'dom', '장식용 메타 문자열(버전·빌드·동기화·시각·No.)'],
  ['G098', 3, 'dom', '장식 배지(BETA·H1 위 알약·맥동 점)'],
  ['G099', 3, 'dom', '가운뎃점(·)으로 메타 2개 이상 잇기'],
  ['G100', 1, 'dom', '끝의 「→」·스크롤 유도·Step 1 라벨'],
  ['G101', 1, 'dom', '가짜 신호등 점 3개'],
  ['G102', 1, 'dom', '제목 속 굵은 강조·이탤릭 제목'],
  ['G103', 3, 'dom', '큰 숫자 + 작은 라벨 통계 줄·숫자만인 h1'],
  ['G104', 3, 'dom', 'APCA 대비 부족(본문 Lc 60·큰 글자 45 미만)'],
  ['G108', 3, 'dom', '한국어 대비 구문(「이 아니라」·「뿐만 아니라」)'],
  ['G109', 3, 'dom', '한국어 상투 구(「솔직히 말하면」·「결론적으로」 등)'],
  ['G111', 3, 'dom', '14px 미만 글자'],
  ['G112', 1, 'dom', '48px 이상 제목 자간(한글 −0.05~−0.02em 밖·라틴 −0.04em 미만)'],
  ['G113', 3, 'dom', '단색 오프셋 그림자 — 반경이 0 이 아니거나 브루탈 축 밖'],
  ['G114', 3, 'dom', '선 구획 축에서 선–배경 대비 3:1 미만'],
  ['G117', 3, 'css', '커스텀 커서(cursor: url)'],
  ['G118', 1, 'dom', '상태 전환에 오버슈트 곡선(y > 1.1)'],
  ['G119', 3, 'dom', 'width·height·top·margin·box-shadow 전환'],
  ['G120', 3, 'dom', '상시 will-change'],
  ['G122', 3, 'dom', '조정 없는 기본 서체(Inter·Geist·Manrope·DM Sans·Plus Jakarta Sans·Space Grotesk·Poppins)'],
  ['G123', 3, 'dom', '제목 속 기울임·세리프·액센트 색 강조 단어'],
  ['G124', 3, 'dom', '대문자+자간 라벨이 섹션 3개당 1개 초과'],
  ['G125', 3, 'dom', '첫 서체가 system-ui 등 기본값'],
  ['G126', 1, 'dom', '인접 글자 크기 비 1.2 미만'],
  ['G127', 3, 'dom', '코드·숫자 열 밖 모노스페이스'],
  ['G129', 3, 'dom', '보라→남색 그라디언트'],
  ['G130', 3, 'dom', '거의 검정 배경 + 형광 액센트 한 점'],
  ['G131', 3, 'dom', '안팎 반경이 같은 중첩(모서리가 안 맞물림)'],
  ['G132', 3, 'dom', '이모지 불릿·이모지 아이콘'],
  ['G133', 3, 'dom', '블러(backdrop-filter) 요소 2개 이상 — 블러는 의도한 한 곳만'],
  ['G134', 3, 'dom', '이미지–텍스트 분할 섹션 연속'],
  ['G135', 3, 'dom', '면 안의 면(카드 속 카드)'],
  ['G136', 3, 'dom', '같은 구조 카드 연속'],
  ['G137', 3, 'dom', '제목 위 여백 ≤ 아래 여백'],
  ['G139', 3, 'dom', '「01 / 02 / 03」 번호 표식'],
  ['G140', 3, 'dom', 'transition: all'],
  ['G141', 3, 'dom', '과장어(Elevate·Seamless·Unleash·Next-Gen·Revolutionize…)'],
  ['G142', 3, 'dom', '지어낸 통계(10k+·99.9%·24/7)'],
].map(([id, weight, kind, name]) => ({ id, weight, kind, name }))

// 원천의 정적 정규식·계산된 스타일 중 이번에 넣지 않은 것과 이유(보고서·테스트가 읽는다).
export const SKIPPED = {
  G001: '리디자인 전후 두 판의 diff 가 필요하다 — 한 번의 렌더로는 잴 수 없다',
  G014: '「같은 행 카드」·「상태 열」·헤더 CTA 행을 식별할 표지가 없어 오탐이 크다',
  G017: '라벨+제목 wrapper·「좁은 설명 열」을 식별할 기준이 원천에 없다',
  G030: '아이콘 패키지 import 수는 소스 수준 — 렌더된 DOM 에는 import 가 없다',
  G035: '로고 벽을 식별할 표지가 없다',
  G055: '드래그 핸들러의 setPointerCapture 여부는 JS 소스 수준이다',
  G059: 'keydown 이 토글하는 요소는 키 입력 흉내가 필요하다',
  G065: '마운트 진입 요소를 알려면 상호작용·소스가 필요하다',
  G071: '부모 변수→자식 transform·Motion x/y 단축 속성은 소스 수준이다',
  G073: '375px 스크롤 애니메이션 동작 여부는 스크롤 흉내가 필요하다',
  G079: '메가메뉴는 열린 상태가 필요하고, 공지 배너를 식별할 표지가 없다',
  G080: 'package.json diff·lottie·gsap import 는 소스 수준이다',
  G089: '문자열 연결 문구·복수형 삼항식은 소스 수준이다',
  G096: '데이터 바인딩 여부는 소스 수준이다',
  G107: '채점 주석(P H E S R V)은 찍어낸 산출물 소스에 달리고 렌더 DOM 에서는 주석이 사라진다 — 찍어내기 단계(P3′)에서 본다',
  G110: '시적 라벨 사전이 원천에 없다',
  G115: '그레인 오버레이를 식별할 표지가 없다',
  G116: '히트 영역은 기존 관문 factory/qa/hit-area.mjs 가 잰다(같은 결함을 두 번 채점하지 않는다)',
  G128: '베이지·크림·황동 기준 팔레트 수치가 원천에 없다(정규식판은 kas 03 이 덮는다)',
  G138: '창 모양 div·가짜 목록을 식별할 표지가 없다(점 3개는 G101 이 잡는다)',
}

// kill-ai-slop tell → 같은 것을 재는 우리 검사(원천 표 「도구」 칸). 우리 검사가 이미 걸렸으면 kas 는 더하지 않는다(이중 계산 방지).
export const KAS_MAP = {
  '01': ['G129'], '02': ['G093'], '03': ['G020', 'G128'], '06': ['G026', 'G094'], '07': ['G123'], '08': ['G090'], '09': ['G005'],
  '10': ['G124'], '11': ['G002'], '12': ['G126'], '13': ['G005'], '14': ['G108', 'G141'], '15': ['G031', 'G132'], '16': ['G094', 'G098'],
  '17': ['G095'], '18': ['G032'], '19': ['G131', 'G033'], '20': ['G027', 'G028'], '21': ['G131'], '22': ['G029'], '23': ['G098'],
  '24': ['G030', 'G036'], '25': ['G032'], '26': ['G062'], '27': ['G070'], '28': ['G007', 'G136'], '29': ['G103', 'G142'], '30': ['G139'],
  '31': ['G135'], '32': ['G137'], '33': ['G122'], '34': ['G127'],
}
export const KAS_TELLS = 35 // 설치본 실측 tell 수(원천 「재사용 도구」 표) — max 에 1점씩
// AI_TELL_KAS_SCAN: 설치본 대신 쓸 경로(테스트가 「없음」 경로를 확인할 때만 쓴다)
export const kasScanPath = () => process.env.AI_TELL_KAS_SCAN || join(homedir(), '.claude', 'skills', 'kill-ai-slop', 'scripts', 'scan.mjs')

export const loadBanlist = () => JSON.parse(readFileSync(join(DATA, 'banlist.json'), 'utf8'))
// 선 구획 예외의 축 값은 데이터에 사본을 두지 않고 compat.json(LINE_VALUES)에서 채운다 — 값이 늘면 예외도 G114 측정 범위도 함께 는다(C85).
export const loadExceptions = () => {
  const d = JSON.parse(readFileSync(join(DATA, 'ai-tell-exceptions.json'), 'utf8'))
  for (const x of d.exceptions) if (x.axisValuesFrom === 'compat.requiresLineContrast') x.axisValues = [...LINE_VALUES]
  return d
}

// 서체 금지 목록 항목 → 검사 id. 원천 G122(§13 기본 산세리프)·G090(세리프 디스플레이)·G125(system-ui)·G091(나머지 SHOULD).
const G122_FAMILIES = new Set(['Inter', 'Geist', 'Manrope', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Poppins'])
const G090_FAMILIES = new Set(['Fraunces', 'Instrument Serif', 'Playfair Display', 'Cormorant', 'Lora'])
export const fontCheckId = (family, role) => (family === 'system-ui' ? 'G125' : G122_FAMILIES.has(family) ? 'G122' : G090_FAMILIES.has(family) && role === 'display' ? 'G090' : 'G091')

// ── 페이지 안에서 도는 측정 ──────────────────────────────────────────────
// 문자열로 넘겨 평가하므로 바깥 변수를 쓰지 않는다. 반환: { occ: [{ id, sel, line, axes, text, detail, w }], facts, used? }
export function probe(cfg) {
  const W = innerWidth, desk = W >= 1000
  const occ = [], seen = new Set()
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'TITLE', 'HEAD', 'BR', 'WBR'])
  const all = [...document.body.querySelectorAll('*')].filter((e) => !SKIP.has(e.tagName))
  const cache = new Map()
  const S = (e) => { let s = cache.get(e); if (!s) { s = getComputedStyle(e); cache.set(e, s) } return s }
  const R = (e) => e.getBoundingClientRect()
  const px = (v) => parseFloat(v) || 0
  const effOp = (e) => { let o = 1; for (let x = e; x; x = x.parentElement) o *= +S(x).opacity; return o }
  const vis = (e) => { const s = S(e); if (s.display === 'none' || s.visibility !== 'visible') return false; const r = R(e); return r.width > 0 && r.height > 0 && r.right + scrollX > 0 && r.bottom + scrollY > 0 } // 문서 밖으로 밀어 둔 측정용 요소는 안 보인다
  const srOnly = (e) => { const r = R(e), s = S(e); return r.width <= 2 || r.height <= 2 || s.clipPath === 'inset(50%)' || /rect\(0px,? 0px,? 0px,? 0px\)/.test(s.clip) }
  const shown = (e) => vis(e) && !srOnly(e) && effOp(e) > 0.05
  const own = (e) => { let t = ''; for (const n of e.childNodes) if (n.nodeType === 3) t += n.nodeValue; return t.replace(/\s+/g, ' ').trim() }
  const text = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim()
  const q = (s) => s.replace(/["\\]/g, '\\$&')
  const sel = (el) => {
    const parts = []
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement && parts.length < 4; e = e.parentElement) {
      let p = e.tagName.toLowerCase()
      if (e.id && !/^(«|:|_R|base-ui-|radix-)/.test(e.id)) { parts.unshift(`${p}#${CSS.escape(e.id)}`); break }
      const slot = e.getAttribute('data-slot'), lab = e.getAttribute('aria-label')
      if (slot) p += `[data-slot="${q(slot)}"]`
      if (lab) p += `[aria-label^="${q(lab.slice(0, 24))}"]`
      const par = e.parentElement
      if (par) { const same = [...par.children].filter((c) => c.tagName === e.tagName); if (same.length > 1) p += `:nth-of-type(${same.indexOf(e) + 1})` }
      parts.unshift(p)
      if (e.tagName === 'BODY') break
    }
    return parts.join(' > ')
  }
  const lineOf = (e) => { const a = e.closest && e.closest('[data-ai-line]'); return a ? +a.getAttribute('data-ai-line') : null }
  // 레시피 표지(recipe.mjs recipeMarkers → 레시피 CSS 범위의 --wf-axes·--wf-font-tuned). 상속되므로 선언한 요소(값이 부모와 달라지는 곳)를 찾는다.
  // 갤러리(html 밖에도 [data-recipe] 칸이 있는 페이지)에서 html 자리 표지는 포털(main 밖)에만 인정한다 — 페이지 틀이 칸의 예외를 빌리지 않게.
  const gallery = !!document.querySelector('body [data-recipe]')
  const marker = (el, name) => {
    const v = getComputedStyle(el).getPropertyValue(name).trim()
    if (!v) return []
    // 갤러리 main 안에서는 견본 칸([data-recipe] 요소) 안에 있을 때만 — 칸 밖 틀은 html 표지를 빌리지 않는다
    if (gallery && el.closest('main') && !el.closest('body [data-recipe]')) return []
    return v.replace(/^["']|["']$/g, '').split(/\s+/).filter(Boolean)
  }
  const axesOf = (el) => {
    const s = new Set(marker(el, '--wf-axes'))
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const d = e.getAttribute('data-axes'); if (d) for (const v of d.split(/[\s,]+/)) if (v) s.add(v) }
    return [...s].sort()
  }
  const add = (id, el, detail = '') => {
    const s = sel(el), k = `${id}|${s}|${detail}`
    if (seen.has(k)) return
    seen.add(k)
    const doc = el === document.documentElement || el === document.body
    occ.push({ id, sel: doc ? el.tagName.toLowerCase() : s, line: doc ? null : lineOf(el), axes: axesOf(el), text: doc ? '' : text(el).slice(0, 40), detail: String(detail), w: W })
  }

  // 색: 어떤 CSS 색이든 캔버스로 sRGB 바이트로 바꾼 뒤 OKLCH·APCA 를 계산한다.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const cc = new Map()
  const rgba = (c) => {
    if (cc.has(c)) return cc.get(c)
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = 'rgba(0,0,0,0)'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1)
    const d = cx.getImageData(0, 0, 1, 1).data, v = [d[0], d[1], d[2], d[3] / 255]
    cc.set(c, v); return v
  }
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const oklch = ([r, g, b]) => {
    const R0 = lin(r), G0 = lin(g), B0 = lin(b)
    const l = Math.cbrt(0.4122214708 * R0 + 0.5363325363 * G0 + 0.0514459929 * B0), m = Math.cbrt(0.2119034982 * R0 + 0.6806995451 * G0 + 0.1073969566 * B0), s = Math.cbrt(0.0883024619 * R0 + 0.2817188376 * G0 + 0.6299787005 * B0)
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return { L, C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 }
  }
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const wcag = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const apca = (txt, bg) => { // APCA-W3 0.0.98G-4g
    const Y = ([r, g, b]) => { const y = 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4; return y < 0.022 ? y + (0.022 - y) ** 1.414 : y }
    const yt = Y(txt), yb = Y(bg)
    if (Math.abs(yb - yt) < 0.0005) return 0
    if (yb > yt) { const s = (yb ** 0.56 - yt ** 0.57) * 1.14; return s < 0.1 ? 0 : (s - 0.027) * 100 }
    const s = (yb ** 0.65 - yt ** 0.62) * 1.14; return s > -0.1 ? 0 : (s + 0.027) * 100
  }
  const over = (c, base) => base.map((v, i) => v * (1 - c[3]) + c[i] * c[3])
  const bgOf = (el) => { // 실제로 깔린 배경(그라디언트·이미지를 만나면 모른다 = null)
    const layers = []
    for (let e = el; e; e = e.parentElement) {
      const s = S(e)
      if (s.backgroundImage !== 'none') return null
      const c = rgba(s.backgroundColor)
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let base = [255, 255, 255]
    for (const c of layers.reverse()) base = over(c, base)
    return base
  }
  const splitTop = (v) => { const r = []; let d = 0, cur = ''; for (const ch of v) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { r.push(cur.trim()); cur = '' } else cur += ch } if (cur.trim()) r.push(cur.trim()); return r }
  const COLOR_RE = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}\b|\btransparent\b/i
  const shadows = (v) => (!v || v === 'none' ? [] : splitTop(v).map((p) => {
    const color = (p.match(COLOR_RE) || ['rgb(0,0,0)'])[0], rest = p.replace(color, ' ')
    const n = (rest.match(/-?[\d.]+px/g) || []).map(px)
    return { color, rgba: rgba(color), inset: /\binset\b/.test(rest), x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0, spread: n[3] || 0 }
  }).filter((s) => s.rgba[3] > 0))
  // 실제로 그려지는 반경(짧은 변의 절반이 상한 — calc(infinity*1px) 알약도 여기서 잘린다)
  const radius = (e) => { const s = S(e), r = R(e), m = Math.min(r.width, r.height); return Math.min(m / 2, Math.max(...[s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius].map((v) => (/%/.test(v) ? px(v) * m / 100 : px(v))))) }
  const bw = (e) => { const s = S(e); return ['Top', 'Right', 'Bottom', 'Left'].map((k) => (s[`border${k}Style`] === 'none' ? 0 : px(s[`border${k}Width`]))) }
  const firstFamily = (e) => (S(e).fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, '').replace(/^_+/, '').replace(/_(?:Fallback_)?[0-9a-f]{5,}$/i, '').replace(/_/g, ' ')
  const isMono = (e) => /mono|courier|consolas|menlo/i.test(S(e).fontFamily)
  const hero = document.querySelector('[data-slot*="hero"],[class*="hero"],[id*="hero"]') || [...document.querySelectorAll('main > section')].find((s, i) => i === 0 && s.querySelector('h1'))
  const sections = [...document.querySelectorAll('section')].filter(vis)
  const textEls = all.filter((e) => own(e) && shown(e))
  const heads = (lv) => all.filter((e) => new RegExp(`^H[${lv}]$`).test(e.tagName) && shown(e))
  const pressables = all.filter((e) => e.matches('button, a[href], [role=button], summary, input[type=checkbox], input[type=radio], input[type=submit], input[type=button]') && shown(e))
  const surface = (e) => { // 면: 배경·사방 테두리·그림자. 반환 'bg'|'border-only'|'shadow'|''
    const s = S(e), c = rgba(s.backgroundColor)
    if (shadows(s.boxShadow).some((x) => !x.inset && (x.blur > 0 || x.x || x.y))) return 'shadow'
    if (c[3] > 0.05 && s.backgroundImage === 'none') { const pb = e.parentElement && bgOf(e.parentElement), mine = bgOf(e); if (!pb || !mine || mine.some((v, i) => Math.abs(v - pb[i]) > 3)) return 'bg' }
    if (bw(e).every((w) => w >= 1)) return 'border-only'
    return ''
  }
  const cardLike = (e) => { const r = R(e); return r.width >= 120 && r.height >= 60 && r.width < W - 1 && !e.matches('button, a, input, select, textarea, label, [role=button], img, svg, video, canvas, table, thead, tbody, tr, td, th, dialog, [role=dialog], html, body') }

  // ── 글자 ──
  for (const e of heads('1')) {
    const s = S(e), fs = px(s.fontSize), lh = s.lineHeight === 'normal' ? fs * 1.2 : px(s.lineHeight), lines = Math.round(R(e).height / lh), words = text(e).split(' ').filter(Boolean).length
    if (desk && lines > 2) add('G002', e, `${lines}줄`)
    if (fs > 96) add('G002', e, `${fs}px`)
    if (words >= 10 && fs >= 48) add('G002', e, `${words}단어 ${fs}px`)
  }
  for (const e of textEls) {
    const s = S(e), fs = px(s.fontSize), t = own(e)
    if (s.textTransform === 'uppercase' && fs >= 24 && (s.lineHeight === 'normal' ? 1.2 : px(s.lineHeight) / fs) < 1) add('G003', e)
    if (s.textTransform === 'uppercase' && /[a-z]{2,}/.test(t) && t.length > 4) add('G007', e)
    if (fs < 14) add('G111', e, `${fs}px`)
    if (/\d\x20(?:KB|MB|GB|kg|km|min)\b/.test(t)) add('G008', e)
    if (/(?<![가-힣])(?:두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s(?:건|개|명)(?![가-힣])/.test(t)) add('G009', e)
    if (e.tagName === 'P' && (text(e).match(/—/g) || []).length >= 2) add('G010', e, '문단에 — 2개 이상')
    if (/[🚀⚡🔒🎉]/u.test(t)) add('G031', e)
    if (/(아래|위|below|above)[^.?!。]{0,12}(입력|선택|클릭|누르|눌러|enter|select|click)/i.test(t)) add('G074', e)
    if (/\bv\d+\.\d+(\.\d+)?\b|\bBuild \d+|last sync|마지막 동기화|\d{1,2}:\d{2}\s*·\s*-?\d+°|\bNo\.\s?\d+/i.test(t)) add('G097', e)
    if ((t.match(/\s·\s/g) || []).length >= 2) add('G099', e)
    if (e.matches('a,button,[role=button]') && /→\s*$/.test(t)) add('G100', e, '끝 →')
    if (/\b(?:Step|Stage|Phase|Pass) (?:\d|One|Two|0\d)\b/.test(t)) add('G100', e, 'Step 라벨')
    if (hero && hero.contains(e) && /scroll|스크롤/i.test(t)) add('G100', e, '스크롤 유도')
    if (/[이가] 아니라|뿐만 아니라|[이가] 아닌/.test(t)) add('G108', e)
    if (/솔직히 말하면|핵심은|보시다시피|결론적으로|연구에 따르면/.test(t)) add('G109', e)
    // 이모지만(그림 표시 기본이거나 VS16 을 붙인 것) — ↗ ▶ ✔ ★ ♥ ⚠ ☎ 같은 글자 모양 기호는 아니다
    if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u.test(t)) add('G132', e)
    if (/\b(?:elevate|seamless(?:ly)?|unleash|next-?gen|revolutioni[sz]e|supercharge|effortless(?:ly)?|game-?changer|cutting-edge)\b/i.test(t)) add('G141', e)
    if (/\b\d+[kKmM]\+|99\.9+%|\b24\/7\b/.test(t)) add('G142', e)
    if (/^0\d\s*(?:[/·.](?!\d)|$)/.test(t)) add('G139', e) // 「05.10 공지」 같은 날짜는 번호 표식이 아니다
    if (/^[\d.,]+\s*(?:%|원|개|명|건|점|kg|km|MB|GB)?$/.test(t) && !e.closest('data,output,kbd,samp,dl,time,code,td,th,svg')) add('G087', e)
    // APCA: 본문 Lc 60 · 큰 글자(24px 이상 또는 18.66px 이상 굵게) 45
    const bg = bgOf(e)
    if (bg) {
      const fg = over(rgba(s.color), bg), lc = Math.abs(apca(fg, bg)), big = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700)
      if (lc < (big ? 45 : 60)) add('G104', e, `Lc ${lc.toFixed(1)}`)
      const f = oklch(fg), b = oklch(bg)
      // 색 면 위의 「회색」 글자만(DESIGN §5) — 순백·순흑에 가까운 짝 토큰(primary-foreground)은 G022·G104 가 본다
      if (f.C < 0.01 && f.L > 0.25 && f.L < 0.9 && b.C > 0.03) add('G020', e, `글자 L ${f.L.toFixed(2)} C ${f.C.toFixed(3)} · 배경 C ${b.C.toFixed(3)}`)
    }
    if (isMono(e) && !e.closest('code,pre,kbd,samp,[data-numeric],td,th,output,data')) add('G127', e)
    if (fs >= 48 && desk) {
      const ls = s.letterSpacing === 'normal' ? 0 : px(s.letterSpacing) / fs
      if (/[가-힣]/.test(t) ? ls < -0.05 || ls > -0.02 : ls < -0.04) add('G112', e, `${ls.toFixed(3)}em`)
    }
  }
  const p0 = all.find((e) => e.tagName === 'P' && shown(e))
  const bodyWeight = +(p0 ? S(p0) : S(document.body)).fontWeight
  if (desk) for (const e of heads('1-3')) if (+S(e).fontWeight - bodyWeight < 300) add('G006', e, `${S(e).fontWeight} vs ${bodyWeight}`)
  if (desk) {
    const serif = (e) => /serif/i.test(S(e).fontFamily) && !/sans-serif/i.test(S(e).fontFamily.split(',')[0])
    const ps = all.filter((e) => e.tagName === 'P' && shown(e)), ratio = (e) => (S(e).lineHeight === 'normal' ? 1.2 : px(S(e).lineHeight) / px(S(e).fontSize))
    const sr = ps.filter(serif).map(ratio), ss = ps.filter((e) => !serif(e)).map(ratio)
    if (sr.length && ss.length && Math.min(...sr) < Math.max(...ss)) add('G004', ps.find(serif))
  }
  for (const e of all.filter((x) => x.tagName === 'P' && shown(x))) if (e.querySelectorAll('strong,b,mark').length >= 2) add('G005', e, '강조 2개 이상')
  for (const e of all) {
    if (!shown(e)) continue
    const d = S(e).textDecorationLine
    if (e.tagName === 'U') add('G005', e, '<u>')
    if (/line-through/.test(d) && !/\d/.test(text(e))) add('G005', e, '가격 밖 취소선')
    if (/underline/.test(d) && !e.closest('a') && e.tagName !== 'ABBR') add('G005', e, '링크 밖 밑줄')
  }
  for (const h of heads('1-3')) {
    const hs = S(h)
    if (hs.fontStyle === 'italic') add('G102', h, '이탤릭 제목')
    for (const c of h.querySelectorAll('*')) {
      // 강조 단어 = 제목 글의 일부만 덮는 자식(제목 전체를 감싼 버튼·링크는 강조가 아니다)
      if (!shown(c) || !own(c) || text(c).length >= text(h).length) continue
      const cs = S(c)
      if (c.matches('strong,b') || +cs.fontWeight > +hs.fontWeight) add('G102', c, '제목 속 굵은 강조')
      if (c.matches('em,i') || (cs.fontStyle === 'italic' && hs.fontStyle !== 'italic')) add('G123', c, '기울임')
      else if (!c.closest('a') && oklch(rgba(cs.color)).C > oklch(rgba(hs.color)).C + 0.05) add('G123', c, '액센트 색')
      else if (/serif/i.test(cs.fontFamily) && !/sans-serif/i.test(cs.fontFamily) && cs.fontFamily !== hs.fontFamily) add('G123', c, '세리프')
    }
  }
  const h1s = heads('1')
  if (h1s.length !== 1) add('G084', document.body, `h1 ${h1s.length}개`)
  for (const h of h1s) {
    if (text(h).split(' ').filter(Boolean).length < 3) add('G084', h, '3단어 미만')
    if (/^[\d\s.,+%×x~\-–/:$₩]+$/.test(text(h))) add('G103', h, '숫자만인 h1')
  }
  // 서체 금지 목록(무조정만) — 역할: 제목·28px 이상 = display, 코드 = mono, 나머지 body
  const fontSeen = new Set()
  const ALIASES = { '-apple-system': 'system-ui', BlinkMacSystemFont: 'system-ui', 'ui-sans-serif': 'system-ui', 'sans-serif': 'system-ui', serif: 'system-ui' }
  for (const e of textEls) {
    const fam0 = firstFamily(e), fam = ALIASES[fam0] || fam0
    const role = e.closest('code,pre,kbd,samp') || isMono(e) ? 'mono' : /^H[1-3]$/.test(e.tagName) || px(S(e).fontSize) >= 28 ? 'display' : 'body'
    const b = cfg.banlist.fonts.find((f) => f.family.toLowerCase() === fam.toLowerCase() && (!f.roles || f.roles.includes(role)))
    if (!b) continue
    // 「조정함」의 근거는 레시피 선언 하나뿐: YAML fonts.<역할>.tuned → --wf-font-tuned 에 그 역할이 있다(계산값으로 짐작하지 않는다)
    if (b.untunedOnly && marker(e, '--wf-font-tuned').includes(role)) continue
    const id = cfg.fontCheck[`${b.family}|${role}`]
    if (!fontSeen.has(id + fam + role)) { fontSeen.add(id + fam + role); add(id, e, `${fam0} (${role})`) }
  }
  // 대문자+자간 라벨 수 > ceil(섹션/3)
  if (desk) {
    const labels = textEls.filter((e) => S(e).textTransform === 'uppercase' && (S(e).letterSpacing !== 'normal' && px(S(e).letterSpacing) / px(S(e).fontSize) >= 0.05))
    if (labels.length > Math.ceil(Math.max(1, sections.length) / 3)) add('G124', labels[0], `라벨 ${labels.length} · 섹션 ${sections.length}`)
    const sizes = [...new Set(textEls.map((e) => Math.round(px(S(e).fontSize) * 2) / 2))].sort((a, b) => a - b)
    const tight = sizes.slice(1).map((v, i) => [sizes[i], v]).filter(([a, b]) => b / a < 1.2)
    if (tight.length) add('G126', document.body, tight.map(([a, b]) => `${a}→${b}px`).join(', '))
  }

  // ── 표면·그림자·색 ──
  for (const e of all) {
    if (!vis(e)) continue
    const s = S(e), r = R(e), sh = shadows(s.boxShadow), b = bw(e), rad = radius(e)
    if (b.some((w) => w >= 1) && sh.some((x) => !x.inset && x.blur >= 16)) add('G027', e)
    if (sh.some((x) => !x.inset && x.blur > Math.min(r.width, r.height) / 2 && r.width > 8)) add('G028', e)
    if (sh.some((x) => !x.inset && x.x === 0 && x.y === 0 && x.blur > 0 && oklch(x.rgba).C > 0.05)) add('G094', e, '색 글로우')
    for (const t of shadows(s.textShadow)) if (t.blur > 0 && oklch(t.rgba).C > 0.05) add('G094', e, '유채색 text-shadow')
    const hard = sh.find((x) => !x.inset && x.blur === 0 && (x.x !== 0 || x.y !== 0))
    if (hard) add('G113', e, rad > 0.5 ? 'hard-offset radius' : 'hard-offset')
    const [bt, br, bb, bl] = b
    const side = [[bl, 'Left', [bt, br, bb]], [br, 'Right', [bt, bb, bl]]].find(([w, , rest]) => w >= 2 && rest.every((x) => x === 0))
    if (side && oklch(rgba(s[`border${side[1]}Color`])).C > 0.05) add('G095', e, `border-${side[1].toLowerCase()} ${side[0]}px`)
    if (s.backdropFilter && s.backdropFilter !== 'none' && !['fixed', 'sticky'].includes(s.position) && !e.closest('dialog,[role=dialog],[role=alertdialog]')) add('G033', e, s.backdropFilter)
    if (s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') add('G093', e)
    if (/repeating-(?:linear|radial)-gradient/.test(s.backgroundImage)) add('G026', e, 'repeating')
    else if ((s.backgroundImage.match(/gradient\(/g) || []).length >= 2 && /\d(px|rem|em)/.test(s.backgroundSize)) add('G026', e, 'grid')
    const cls = typeof e.className === 'string' ? e.className : (e.getAttribute('class') || '')
    if (/\bbg-gradient-to-[bt]\b/.test(cls) && /\bfrom-[a-z]+-\d+\/(?:5|10|15|20)\b/.test(cls)) add('G026', e, 'gradient card')
    // 보라→남색 그라디언트: 금지 목록 colors 의 색조 대역에 든 서로 다른 두 색 이상
    for (const bc of cfg.banlist.colors.filter((c) => c.check === 'G129')) {
      const stops = (s.backgroundImage.match(new RegExp(COLOR_RE.source, 'gi')) || []).map((c) => oklch(rgba(c))).filter((o) => o.C >= bc.minChroma && o.H >= bc.hue[0] && o.H <= bc.hue[1])
      const tw = new RegExp(`\\bfrom-(?:${bc.tailwind.join('|')})-\\d+[\\s\\S]{0,80}\\bto-(?:${bc.tailwind.join('|')}|pink|blue)-\\d+`)
      if ((stops.length >= 2 && Math.max(...stops.map((o) => o.H)) - Math.min(...stops.map((o) => o.H)) >= 10) || tw.test(cls)) add('G129', e, bc.id)
    }
    if (/\bhover:scale-1(?:0[3-9]|[1-9]\d)\b/.test(cls)) add('G062', e, 'hover:scale')
    if (/\banimate-(?:ping|pulse)\b/.test(cls) && r.width <= 16) add('G098', e, '맥동 점')
    if (/\bbg-([a-z]+)-(?:50|100)\b/.test(cls) && e.querySelector('svg')) add('G032', e, '파스텔 타일')
    const tint = cls.match(/\bbg-([a-z]+)-\d+\/(?:5|10|15|20)\b/)
    if (tint && new RegExp(`\\btext-${tint[1]}-`).test(cls + ' ' + [...e.children].map((c) => c.getAttribute('class') || '').join(' '))) add('G032', e, '제 색 틴트')
    if (e.tagName === 'svg' && /\bw-24\b/.test(cls)) add('G032', e, 'w-24 장식 아이콘')
    if (/sketch|doodle/i.test(cls + ' ' + e.id)) add('G036', e, 'sketch·doodle')
    if (e.tagName === 'path' && ((e.getAttribute('d') || '').match(/[cCqQsSaA]/g) || []).length >= 40) add('G036', e.closest('svg') || e, '곡선 명령 40개 이상')
    if (/lucide-(?:rocket|shield|sparkles)\b/.test(cls)) add('G031', e, cls.match(/lucide-(\w+)/)[1])
    // 전환·애니메이션
    const tp = s.transitionProperty.split(',').map((x) => x.trim()), td = s.transitionDuration.split(',').map(px)
    if (tp.includes('all') && td.some((d) => d > 0)) add('G140', e)
    const heavy = tp.filter((p, i) => (td[i % td.length] > 0) && /^(width|height|top|margin(-\w+)?|box-shadow)$/.test(p))
    if (heavy.length) add('G119', e, heavy.join(','))
    if (s.willChange !== 'auto') add('G120', e, s.willChange)
    if (e.matches('button,dialog,[data-state],[role=switch],[role=checkbox],[role=radio],input[type=checkbox],input[type=radio],[aria-pressed],[aria-expanded]')) {
      for (const m of `${s.transitionTimingFunction},${s.animationTimingFunction}`.matchAll(/cubic-bezier\(([^)]*)\)/g)) {
        const n = m[1].split(',').map(parseFloat)
        if (n[1] > 1.1 || n[3] > 1.1) add('G118', e, `cubic-bezier(${n.join(',')})`)
      }
    }
    const delays = s.animationName !== 'none' ? s.animationDelay.split(',').map((d) => (/ms/.test(d) ? px(d) : px(d) * 1000)) : []
    if (delays.some((d) => d > 500)) add('G066', e, `${Math.max(...delays)}ms`)
  }
  for (const e of all.filter((x) => shown(x) && x.matches('button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled=true]:not([aria-current])'))) {
    const o = +S(e).opacity
    if (o < 0.38 || o > 0.55) add('G041', e, `opacity ${o}`)
  }
  // 모서리에서 끊기는 테두리: overflow 잘림 + 반경 부모 안, 테두리 있고 반경 0 인 자식이 부모 모서리에 닿음
  for (const e of all.filter((x) => vis(x) && ['hidden', 'clip'].includes(S(x).overflow) && radius(x) > 0)) {
    const pr = R(e)
    for (const c of e.children) { const cr = R(c); if (vis(c) && bw(c).some((w) => w >= 1) && radius(c) === 0 && (Math.abs(cr.top - pr.top) < 2 || Math.abs(cr.bottom - pr.bottom) < 2) && Math.abs(cr.width - pr.width) < 4) add('G029', c) }
  }
  // 반경이 같은 중첩: 안쪽 반경 = 바깥 − 패딩 이어야 한다
  // 안쪽으로 들어앉은(사방 2px 이상 떨어진) 자식만 — 가장자리에 붙은 머리·바닥 띠는 반경이 같아야 맞다
  for (const e of all.filter((x) => vis(x) && radius(x) > 0)) {
    const pr = R(e)
    for (const c of e.children) {
      const cr = R(c)
      if (vis(c) && surface(c) && Math.abs(radius(c) - radius(e)) < 0.5 && Math.min(cr.left - pr.left, pr.right - cr.right, cr.top - pr.top, pr.bottom - cr.bottom) >= 2) add('G131', c, `${radius(e)}px 안 ${radius(c)}px`)
    }
  }
  // 면 안의 면(카드 속 카드)
  for (const e of all.filter((x) => vis(x) && cardLike(x))) {
    const kind = surface(e)
    if (!kind) continue
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (cardLike(a) && surface(a)) { add('G135', e, kind); break }
  }
  // 같은 구조 카드 연속·연속 행 이중 테두리
  const sig = (e) => `${e.tagName}/${[...e.children].map((c) => c.tagName).join(',')}`
  for (const p of all.filter((x) => x.children.length >= 2)) {
    const kids = [...p.children].filter(vis)
    let run = 1
    for (let i = 1; i <= kids.length; i++) {
      const same = i < kids.length && cardLike(kids[i]) && surface(kids[i]) && sig(kids[i]) === sig(kids[i - 1]) && cardLike(kids[i - 1]) && surface(kids[i - 1])
      if (same) run++
      else { if (run >= cfg.layoutMin.G136) add('G136', kids[i - run], `${run}장`); run = 1 }
    }
    for (let i = 1; i < kids.length; i++) { // 위아래로 쌓였고 실제로 붙은 행만(간격 1px 이하 — 줄 사이가 떨어진 줄바꿈 버튼은 겹침이 아니다, Task 5 리뷰 M1)
      const [at, , ab] = bw(kids[i - 1]), [bt, , bb] = bw(kids[i])
      const gap = R(kids[i]).top - R(kids[i - 1]).bottom
      if (at >= 1 && ab >= 1 && bt >= 1 && bb >= 1 && gap >= -1 && gap <= 1) add('G056', kids[i])
    }
  }
  // 선 구획 축: 선–배경 대비 3:1
  for (const e of all.filter((x) => vis(x) && bw(x).some((w) => w >= 1))) {
    const ax = axesOf(e)
    if (!ax.some((v) => cfg.lineValues.includes(v))) continue
    const bg = bgOf(e.parentElement || e), s = S(e)
    if (!bg) continue
    const side = ['Top', 'Right', 'Bottom', 'Left'].find((k, i) => bw(e)[i] >= 1 && rgba(s[`border${k}Color`])[3] > 0.1) // 투명 테두리는 선이 아니다
    if (!side) continue
    const lc = over(rgba(s[`border${side}Color`]), bg), cr = wcag(lc, bg)
    if (cr < 3) add('G114', e, `${cr.toFixed(2)}:1`)
  }
  // 거의 검정 + 형광 한 점
  const nb = cfg.banlist.colors.find((c) => c.check === 'G130')
  const pageBg = bgOf(document.body)
  if (nb && desk && pageBg && oklch(pageBg).L < nb.maxL) {
    const loud = new Set()
    for (const e of all.filter(vis)) for (const c of [S(e).color, S(e).backgroundColor, S(e).borderTopColor]) { const x = rgba(c); if (x[3] > 0.5 && oklch(x).C >= nb.minChroma) loud.add(x.slice(0, 3).join(',')) }
    if (loud.size === 1) add('G130', document.body, `액센트 ${[...loud][0]}`)
  }

  // ── 배치 ──
  if (S(document.documentElement).overflowX === 'hidden' || S(document.body).overflowX === 'hidden') add('G011', document.documentElement, 'overflow-x: hidden')
  if (!desk && document.documentElement.scrollWidth > innerWidth + 1) add('G011', document.documentElement, `가로 넘침 ${document.documentElement.scrollWidth}px`)
  if (desk && hero) {
    const hs = S(hero), top = px(hs.paddingTop), bot = px(hs.paddingBottom)
    if (top > 0 && bot / top < 1.3) add('G012', hero, `${bot}/${top}`)
    const blocks = [...hero.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote')].filter(shown)
    if (blocks.length > 4) add('G015', hero, `글 덩어리 ${blocks.length}`)
    if ([...hero.querySelectorAll('img')].filter((i) => /logo/i.test(i.alt + i.src)).length >= 3) add('G015', hero, '로고 3개 이상')
  }
  for (const h of heads('2-3')) {
    let prev = h.previousElementSibling
    while (prev && !vis(prev)) prev = prev.previousElementSibling
    if (!prev) continue // 위에 아무것도 없는 제목의 위 여백은 근접과 무관하다
    const s = S(h)
    if (px(s.marginBottom) > 0 && px(s.marginTop) <= px(s.marginBottom)) add('G137', h, `${s.marginTop} / ${s.marginBottom}`)
  }
  // G010 짧은 요소: 자식 span 안의 글도 본다
  for (const e of all.filter((x) => x.matches('h1,h2,h3,h4,h5,h6,button,label,figcaption,cite,[role=button]') && shown(x))) if (text(e).includes('—')) add('G010', e)
  if (desk) {
    const secSig = (sec) => { const kids = [...sec.children].filter(vis); const grid = S(sec).display.includes('grid') ? S(sec).gridTemplateColumns.split(' ').length : 1; const img = kids.findIndex((k) => k.matches('img,picture,video') || k.querySelector('img,picture,video')); return `${kids.length}|${grid}|${img}` }
    const counts = {}
    for (const sec of sections) (counts[secSig(sec)] ||= []).push(sec)
    for (const list of Object.values(counts)) if (list.length >= cfg.layoutMin.G018) add('G018', list[0], `같은 구조 ${list.length}개`)
    const split = (sec) => { const box = [...sec.children].filter(vis).length === 1 ? [...sec.children].find(vis) : sec; const kids = [...box.children].filter(vis); if (kids.length !== 2) return false; const [a, b] = kids.map(R); const side = Math.abs(a.top - b.top) < 40 && (a.right <= b.left + 1 || b.right <= a.left + 1); const media = kids.filter((k) => k.matches('img,picture,video,figure') || k.querySelector('img,picture,video')).length === 1; return side && media }
    let run = 0
    for (let i = 0; i <= sections.length; i++) {
      if (i < sections.length && split(sections[i])) run++
      else { if (run >= cfg.layoutMin.G134) add('G134', sections[i - run], `${run}개 연속`); run = 0 }
    }
    const reveal = sections.filter((s) => /\b(reveal|fade-?in|fade-?up|animate-in|aos)\b/i.test(s.getAttribute('class') || '') || s.hasAttribute('data-aos') || s.hasAttribute('data-reveal'))
    if (sections.length >= 2 && reveal.length / sections.length >= 0.5) add('G060', reveal[0], `${reveal.length}/${sections.length}`)
    const header = document.querySelector('header, [role=banner]')
    if (header && vis(header) && R(header).height > 80) add('G078', header, `${Math.round(R(header).height)}px`)
    const nums = textEls.filter((e) => px(S(e).fontSize) >= 40 && /^[\d.,+%×x~\-–/:$₩]+[a-zA-Z%+가-힣]{0,2}$/.test(own(e)))
    if (nums.length >= cfg.layoutMin.G103) add('G103', nums[0], `큰 숫자 ${nums.length}개`)
  }
  for (const e of all.filter((x) => vis(x) && x.children.length >= 3)) {
    const kids = [...e.children].filter(vis).map((k) => ({ k, r: R(k) }))
    for (let i = 0; i + 2 < kids.length; i++) {
      const tri = kids.slice(i, i + cfg.layoutMin.G101)
      if (tri.length === cfg.layoutMin.G101 && tri.every(({ k, r }) => r.width <= 20 && Math.abs(r.width - r.height) < 1 && Math.abs(r.width - tri[0].r.width) < 1 && radius(k) >= r.width / 2 - 0.5)) { add('G101', e); break }
    }
  }
  for (const e of all.filter((x) => x.tagName === 'BLOCKQUOTE' && vis(x))) { const s = S(e), lh = s.lineHeight === 'normal' ? px(s.fontSize) * 1.2 : px(s.lineHeight); if (Math.round((R(e).height - px(s.paddingTop) - px(s.paddingBottom)) / lh) > 3) add('G075', e) }
  // ── 누르는 것·폼·오버레이 ──
  for (const e of pressables) {
    if (S(e).touchAction !== 'manipulation') add('G045', e, S(e).touchAction)
    if (e.matches('a,button,[role=button]') && !e.closest('p') && e.getClientRects().length > 1) add('G043', e, `${e.getClientRects().length}조각`)
  }
  for (const f of all.filter((x) => x.tagName === 'FORM' && vis(x))) {
    const ins = [...f.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select')].filter(vis).map((x) => Math.round(R(x).height))
    const bts = [...f.querySelectorAll('button,input[type=submit]')].filter(vis).map((x) => Math.round(R(x).height))
    if (ins.length && bts.length && new Set([...ins, ...bts]).size > 1) add('G048', f, `입력 ${[...new Set(ins)]} · 버튼 ${[...new Set(bts)]}px`)
  }
  for (const t of all.filter((x) => x.tagName === 'TEXTAREA' && vis(x))) if (/both|horizontal/.test(S(t).resize)) add('G048', t, `resize ${S(t).resize}`)
  for (const i of all.filter((x) => x.matches('input[type=email]'))) if (i.getAttribute('spellcheck') !== 'false') add('G049', i, 'spellcheck')
  for (const i of all.filter((x) => x.hasAttribute('autofocus'))) add('G049', i, 'autofocus')
  for (const d of all.filter((x) => x.matches('dialog[open],[role=dialog],[role=alertdialog]') && vis(x))) {
    const w = Math.round(R(d).width)
    if (desk ? ![384, 512, 640, 768].some((v) => Math.abs(v - w) <= 1) : Math.abs(w - (W - 32)) > 1) add('G052', d, `${w}px`)
  }
  // 원천 「div+role」: 호스트가 div·span 이고 같은 부모 안에 네이티브 짝(input·select)이 없을 때만 — Base UI 는 숨은 네이티브 입력을 함께 그린다
  for (const e of all.filter((x) => vis(x) && x.matches('div[role=checkbox],div[role=radio],div[role=listbox],div[role=combobox],span[role=checkbox],span[role=radio],span[role=listbox],span[role=combobox]'))) {
    if (!(e.parentElement && [...e.parentElement.children].some((c) => c.matches('input[type=checkbox],input[type=radio],select')))) add('G053', e, e.getAttribute('role'))
  }
  for (const e of all.filter((x) => vis(x) && ['absolute', 'fixed'].includes(S(x).position) && x.matches('[role=menu],[role=listbox],[data-slot$=popover-content],[data-slot$=menu-content],[data-slot$=select-content]'))) {
    const [ox, oy] = S(e).transformOrigin.split(' ').map(px), r = R(e)
    if (Math.abs(ox - r.width / 2) < 1 && Math.abs(oy - r.height / 2) < 1) add('G063', e)
  }
  for (const e of all.filter((x) => x.matches('[aria-busy=true]') && vis(x))) if (!/(…|\.\.\.)\s*$/.test(text(e))) add('G057', e, 'aria-busy')
  for (const e of textEls) if (/^(로딩 ?중|불러오는 ?중|Loading)(\.{3}|…)?$/i.test(own(e))) add('G057', e, '작업명 없음')
  for (const e of all.filter((x) => x.matches('[data-slot=badge],[class*=badge],[class*=pill]') && shown(x))) if (/^(BETA|EARLY ACCESS|INVITE-ONLY|V\d)/i.test(text(e))) add('G098', e, text(e))
  for (const h of h1s) { const pv = h.previousElementSibling; if (pv && vis(pv) && radius(pv) >= R(pv).height / 2 - 0.5 && R(pv).height < 48) add('G098', pv, 'h1 위 알약') }
  for (const a of all.filter((x) => x.matches('a[href$=".pdf" i]'))) if (!/\d+(\.\d+)?\s*(KB|MB)/i.test(text(a) + (a.getAttribute('aria-label') || ''))) add('G076', a)
  // 외부 자산: preconnect 없는 다른 출처
  const pre = new Set([...document.querySelectorAll('link[rel~=preconnect]')].map((l) => { try { return new URL(l.href).origin } catch { return '' } }))
  for (const e of document.querySelectorAll('img[src],link[rel~=stylesheet][href],script[src],link[rel~=preload][href],source[src]')) {
    let u; try { u = new URL(e.getAttribute('src') || e.getAttribute('href'), location.href) } catch { continue }
    if (/^https?:$/.test(u.protocol) && u.origin !== location.origin && !pre.has(u.origin)) add('G081', e, u.origin)
  }
  for (const img of all.filter((x) => x.tagName === 'IMG')) if (/placeholder|PLACEHOLDER_BASE|picsum|dummyimage/i.test(img.getAttribute('src') || '')) add('G038', img, '임시 이미지')
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) if (/\bTODO\b|PLACEHOLDER_BASE/.test(n.nodeValue)) add('G038', n.parentElement, 'TODO 주석')

  // ── 규칙 전체에서 본 사실(다크 테마·선택 색 등) ──
  const facts = { colorSchemeMQ: false, darkSel: false, selection: false, caret: false, underlineOffset: false, reducedTransparency: false }
  const walk = (rules) => {
    for (const r of rules) {
      const t = r.cssText || ''
      if (r.media && /prefers-color-scheme/.test(r.media.mediaText)) facts.colorSchemeMQ = true
      if (r.media && /prefers-reduced-transparency/.test(r.media.mediaText)) facts.reducedTransparency = true
      if (r.selectorText && /\.dark\b|\[data-theme[^\]]*dark|\[data-mode[^\]]*dark|\.theme-dark/.test(r.selectorText)) facts.darkSel = true
      if (r.selectorText && /::selection/.test(r.selectorText)) facts.selection = true
      if (/caret-color\s*:/.test(t)) facts.caret = true
      if (/text-underline-offset\s*:/.test(t)) facts.underlineOffset = true
      if (r.cssRules) walk(r.cssRules)
    }
  }
  for (const sh of document.styleSheets) { try { walk(sh.cssRules) } catch { /* 다른 출처 시트 */ } }
  if (!facts.colorSchemeMQ && !facts.darkSel) add('G025', document.documentElement, '다크 테마 없음')
  if (!facts.selection && !facts.caret && !facts.underlineOffset) add('G029', document.documentElement, '::selection·caret-color·text-underline-offset 선언 없음')
  const glass = all.filter((e) => vis(e) && S(e).backdropFilter && S(e).backdropFilter !== 'none')
  if (glass.length && !facts.reducedTransparency) add('G034', glass[0], 'prefers-reduced-transparency 없음')
  if (glass.length >= 2) add('G133', glass[1], `블러 요소 ${glass.length}개`)

  // ── URL 입력: 이 페이지가 실제로 쓰는 규칙만 모은 CSS·마크업 사본(정적 검사·kas 가 읽는다) ──
  let used = null
  if (cfg.collect) {
    const names = new Set(all.flatMap((e) => S(e).animationName.split(',').map((x) => x.trim())))
    const strip = (x) => x.replace(/::?(?:before|after|placeholder|selection|marker|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?:\([^)]*\))?/g, '').replace(/:(?:hover|focus-visible|focus-within|focus|active|visited|checked|disabled|enabled|invalid|valid|placeholder-shown|open|popover-open|target|indeterminate|read-only|autofill|user-invalid|first-child|last-child|only-child|empty)\b/g, '')
    const hit = (x) => { for (const t of [x, strip(x)]) { try { if (document.querySelector(t.trim() || '*')) return true } catch { /* 다음 */ } } return false }
    const take = (rules) => {
      const lines = []
      for (const r of rules) {
        if (r.selectorText !== undefined) { if (hit(r.selectorText)) lines.push(r.cssText) }
        else if (r.name !== undefined && r.cssRules && r.type === 7) { if (names.has(r.name)) lines.push(r.cssText) }
        else if (r.cssRules) { const inner = take(r.cssRules); if (inner.length) { const head = r.cssText.slice(0, r.cssText.indexOf('{')).trim(); lines.push(`${head} {`, ...inner, '}') } }
      }
      return lines
    }
    const css = []
    for (const sh of document.styleSheets) { try { css.push(...take(sh.cssRules)) } catch { /* 다른 출처 */ } }
    const clone = document.documentElement.cloneNode(true)
    for (const sc of clone.querySelectorAll('script')) sc.textContent = ''
    used = { css: css.join('\n'), html: '<!DOCTYPE html>\n' + clone.outerHTML.replace(/></g, '>\n<'), scripts: [...document.scripts].filter((s) => !s.src).map((s) => s.textContent).join('\n') }
  }
  // G042·G044 는 노드 쪽 pseudoPass 가 CDP 로 상태를 강제해 잰다 — 여기서는 대상 표지와 비교 도구만 둔다
  if (cfg.pseudo) {
    const pz = all.filter((e) => shown(e) && e.matches('button, a[href], [role=button], [role=tab], [role=switch], summary')).slice(0, 80)
    pz.forEach((e, i) => e.setAttribute('data-ai-p', String(i)))
    const PROPS = ['color', 'background-color', 'border-top-color', 'border-top-width', 'outline-color', 'outline-width', 'outline-offset', 'box-shadow', 'transform', 'opacity', 'text-decoration-color', 'scale', 'translate']
    const after = (e) => { const ys = []; for (let x = e; x && ys.length < 3; x = x.parentElement) for (let s = x.nextElementSibling; s && ys.length < 3; s = s.nextElementSibling) if (vis(s)) ys.push(R(s).top); return ys }
    window.__ai = {
      n: pz.length,
      tp: pz.map((e) => ({ p: S(e).transitionProperty.split(',').map((x) => x.trim()), d: S(e).transitionDuration.split(',').map(px) })),
      freeze: () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(st); return 1 },
      state: (i) => { const e = pz[i], s = getComputedStyle(e), r = e.getBoundingClientRect(); return { props: Object.fromEntries(PROPS.map((p) => [p, s.getPropertyValue(p)])), w: r.width, h: r.height, after: after(e) } },
      occ: (i, id, detail) => ({ id, sel: sel(pz[i]), line: lineOf(pz[i]), axes: axesOf(pz[i]), text: text(pz[i]).slice(0, 40), detail, w: W }),
    }
  }
  return { occ, used }
}

// ── 텍스트 검사(CSS 규칙·스크립트) ───────────────────────────────────────
const lineIndex = (text) => { const st = [0]; for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) st.push(i + 1); return (idx) => { let lo = 0, hi = st.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (st[m] <= idx) lo = m; else hi = m - 1 } return lo + 1 } }
// HTML 파일이면 <style> 안만 남기고 나머지는 공백으로(줄 번호 유지)
export const styleOnly = (html) => { let out = ''; let last = 0; for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) { const s = m.index + m[0].indexOf('>') + 1; out += html.slice(last, s).replace(/[^\n]/g, ' ') + m[1]; last = s + m[1].length } return out + html.slice(last).replace(/[^\n]/g, ' ') }
export const scriptsOnly = (html) => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n')

const STATE_SEL = /:checked|\[data-state|\[aria-(?:checked|pressed|expanded|selected)|\bbutton\b|dialog|:hover|:active|:focus|switch|toggle|checkbox|radio/i
export function cssChecks(file, text) {
  const out = [], at = lineIndex(text)
  const add = (id, idx, sel, detail = '') => out.push({ id, file, line: at(idx), sel, detail: String(detail) })
  for (const m of text.matchAll(/@media([^{]+)\{/g)) if (/\d(?:\.\d+)?px/.test(m[1])) add('G013', m.index, `@media${m[1].trimEnd()}`)
  const spin = new Set()
  for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) if (/rotate/.test(m[2])) spin.add(m[1])
  // G119 animation 쪽: 레이아웃·그림자 속성을 움직이는 키프레임 → 그 이름을 쓰는 규칙
  const heavyKf = new Map()
  for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const props = [...new Set([...m[2].matchAll(/(?:^|[;{\s])(width|height|top|margin(?:-[a-z]+)?|box-shadow)\s*:/g)].map((x) => x[1]))]
    if (props.length) heavyKf.set(m[1], props)
  }
  const oklchTok = (body, name) => { const t = body.match(new RegExp(`--${name}\\s*:\\s*oklch\\(\\s*([\\d.]+)(%?)\\s+([\\d.]+)`)); return t ? { L: t[2] ? +t[1] / 100 : +t[1], C: +t[3] } : null }
  let shadcnDefaults = 0, firstDefault = -1
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' '), body = m[2], idx = m.index + m[0].indexOf(m[1].trim())
    if (sel.startsWith('@') || /^\d+%|^from$|^to$/.test(sel)) continue
    const tokens = [...body.matchAll(/--[\w-]+\s*:\s*oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/g)].map((t) => ({ C: +t[2], H: +t[3] })).filter((t) => t.C >= 0.005 && t.C < 0.03)
    if (tokens.some((t) => t.H >= 20 && t.H <= 110) && tokens.some((t) => t.H >= 180 && t.H <= 300)) add('G021', idx, sel)
    if (/(?:^|[;{\s])color\s*:\s*(?:white|#fff(?:fff)?)\b/i.test(body)) add('G022', idx, sel)
    if (/--color-indigo-/.test(body)) add('G023', idx, sel)
    if (/:hover/.test(sel)) {
      const sc = body.match(/scale\(\s*([\d.]+)|(?:^|[;\s])scale\s*:\s*([\d.]+)/)
      if (sc && +(sc[1] || sc[2]) >= 1.03) add('G062', idx, sel, `scale ${sc[1] || sc[2]}`)
      const props = new Set([...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map((p) => p[1]).filter((p) => !p.startsWith('--')))
      if (props.size >= 2) add('G062', idx, sel, `hover 가 ${[...props].join('·')}`)
    }
    if (/toast|toggle|switch|sonner/i.test(sel) && /(?:^|[;\s])animation(?:-name)?\s*:\s*(?!none)/.test(body)) add('G064', idx, sel)
    if (/tab/i.test(sel) && /transition[^;]*\b(?:transform|height)\b/.test(body)) add('G067', idx, sel)
    const an = body.match(/animation(?:-name)?\s*:\s*([^;]+)/)
    if (an && [...spin].some((n) => new RegExp(`\\b${n}\\b`).test(an[1])) && /translate\(\s*-50%|translate\s*:\s*-50%/.test(body)) add('G070', idx, sel)
    if (an) for (const [n, props] of heavyKf) if (new RegExp(`(?:^|[\\s,])${n}(?:$|[\\s,])`).test(an[1])) add('G119', idx, sel, `@keyframes ${n}: ${props.join(',')}`)
    // G019 DESIGN §5 OKLCH 대역: 라이트 바탕 L 0.96~0.98·C 0.005~0.015, 다크 바탕 L 0.12~0.16, 글자 L 0.16~0.22 / 0.92~0.96
    const bgT = oklchTok(body, 'background'), fgT = oklchTok(body, 'foreground')
    if (bgT && (bgT.L >= 0.5 ? bgT.L < 0.96 || bgT.L > 0.98 || bgT.C < 0.005 || bgT.C > 0.015 : bgT.L < 0.12 || bgT.L > 0.16)) add('G019', idx, sel, `--background L ${bgT.L} C ${bgT.C}`)
    if (fgT && (fgT.L < 0.5 ? fgT.L < 0.16 || fgT.L > 0.22 : fgT.L < 0.92 || fgT.L > 0.96)) add('G019', idx, sel, `--foreground L ${fgT.L}`)
    const phys = (body.match(/(?:^|[;\s])(?:margin|padding|border)-(?:left|right)(?:-\w+)?\s*:|text-align\s*:\s*(?:left|right)\b|float\s*:\s*(?:left|right)\b/g) || []).length
    if (phys) add('G088', idx, sel, `${phys}곳`)
    for (const d of [/--radius\s*:\s*0\.625rem/, /--primary\s*:\s*oklch\(0\.205 0 0\)/, /--ring\s*:\s*oklch\(0\.708 0 0\)/, /--border\s*:\s*oklch\(0\.922 0 0\)/]) if (d.test(body)) { shadcnDefaults++; if (firstDefault < 0) firstDefault = idx }
    if (/cursor\s*:\s*url\(/.test(body)) add('G117', idx, sel)
    if (STATE_SEL.test(sel)) for (const c of body.matchAll(/cubic-bezier\(([^)]*)\)/g)) { const n = c[1].split(',').map(parseFloat); if (n[1] > 1.1 || n[3] > 1.1) add('G118', idx, sel, `cubic-bezier(${n.join(',')})`) }
  }
  if (shadcnDefaults >= 2) add('G092', firstDefault, ':root', `shadcn 기본 토큰 ${shadcnDefaults}개`)
  return out
}
export function scriptChecks(file, text) {
  const out = [], at = lineIndex(text)
  for (const m of text.matchAll(/\bbounce\s*:\s*0?\.[1-9]/g)) out.push({ id: 'G068', file, line: at(m.index), sel: m[0], detail: '' })
  for (const m of text.matchAll(/addEventListener\(\s*['"]scroll['"][^)]*\)/g)) if (!/passive/.test(m[0])) out.push({ id: 'G072', file, line: at(m.index), sel: m[0].slice(0, 60), detail: 'passive 없음' })
  for (const m of text.matchAll(/window\.scrollY|pageYOffset/g)) out.push({ id: 'G072', file, line: at(m.index), sel: m[0], detail: 'scrollY 진행 계산' })
  return out
}

// ── 예외·채점 ────────────────────────────────────────────────────────────
export function exempt(o, exceptions) {
  return exceptions.find((x) => x.checks.includes(o.id)
    && (!x.match || new RegExp(x.match).test(o.detail ?? o.text ?? ''))
    && (!x.axisValues || (o.axes || []).some((v) => x.axisValues.includes(v))))
}
const fmtWhere = (o, label) => {
  const loc = o.file ? `${o.file}:${o.line}` : o.line ? `${label}:${o.line}` : `@${o.w}px`
  return [loc, o.sel, o.text ? `「${o.text}」` : '', o.detail ? `(${o.detail})` : ''].filter(Boolean).join(' ')
}
export function score(occ, { kas = null, exceptions = [], label = '' } = {}) {
  const kept = [], waived = []
  for (const o of occ) { const x = exempt(o, exceptions); if (x) waived.push({ id: o.id, exception: x.id, where: fmtWhere(o, label) }); else kept.push(o) }
  const hits = []
  for (const c of CHECKS) {
    const os = kept.filter((o) => o.id === c.id)
    if (os.length) hits.push({ id: c.id, weight: c.weight, name: c.name, count: os.length, where: fmtWhere(os[0], label), more: os.slice(1, 5).map((o) => fmtWhere(o, label)) })
  }
  if (kas?.findings) {
    const hitIds = new Set(hits.map((h) => h.id))
    for (const f of [...kas.findings].sort((a, b) => a.id.localeCompare(b.id))) {
      const id = `kas-${f.id}`
      const rest = f.hits.filter((h) => { const x = exempt({ id, text: h.text }, exceptions); if (x) waived.push({ id, exception: x.id, where: `${h.file}:${h.line} ${h.text}` }); return !x })
      if (!rest.length || (KAS_MAP[f.id] || []).some((g) => hitIds.has(g))) continue
      hits.push({ id, weight: 1, name: `kill-ai-slop ${f.id} ${f.name}`, count: rest.length, where: `${rest[0].file}:${rest[0].line} ${rest[0].text}`, more: rest.slice(1, 5).map((h) => `${h.file}:${h.line} ${h.text}`) })
    }
  }
  // 척도 둘: G(저장소 검사, 문턱은 여기에) · kas(설치본 버전에 따라 바뀌는 보조 — kas 없는 기계에서도 G 점수는 같다)
  const sum = (hs) => hs.reduce((n, h) => n + h.weight, 0)
  const scoreG = sum(hits.filter((h) => h.id.startsWith('G'))), scoreKas = sum(hits.filter((h) => h.id.startsWith('kas-')))
  const maxG = CHECKS.reduce((n, c) => n + c.weight, 0), maxKas = kas?.findings ? KAS_TELLS : 0
  return { score: scoreG, max: maxG, scoreG, maxG, scoreKas, maxKas, hits, waived }
}

// ── kill-ai-slop ──────────────────────────────────────────────────────────
export async function runKas(files) {
  const scan = kasScanPath()
  if (!existsSync(scan)) return { status: 'skip', reason: 'kill-ai-slop scan.mjs 가 ~/.claude/skills/kill-ai-slop/scripts 에 없다' }
  const dir = mkdtempSync(join(tmpdir(), 'ai-tell-kas-'))
  try {
    for (const f of files) writeFileSync(join(dir, f.name), f.text)
    const { code, stdout, stderr } = await new Promise((res) => {
      const p = spawn(process.execPath, [scan, dir, '--json', '--no-color'], { stdio: ['ignore', 'pipe', 'pipe'] })
      let o = '', e = ''
      p.stdout.on('data', (d) => { o += d }); p.stderr.on('data', (d) => { e += d })
      p.on('exit', (c) => res({ code: c, stdout: o, stderr: e }))
    })
    if (code !== 0) return { status: 'error', reason: `scan.mjs 종료 ${code}: ${stderr.trim().slice(0, 200)}` }
    const j = JSON.parse(stdout)
    return { status: 'ok', filesScanned: j.filesScanned, findings: j.findings.map((f) => ({ id: f.id, name: f.name, hits: f.hits.map((h) => ({ file: h.file.replace(/\\/g, '/'), line: h.line, text: h.text })) })) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

// ── 렌더 ─────────────────────────────────────────────────────────────────
// HTML 파일은 시작 태그마다 data-ai-line 을 달아(스크립트·스타일·주석 안은 건너뛴다) 적중 위치를 줄 번호로 돌려준다.
export function annotateLines(html) {
  const masked = html.replace(/<(script|style)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, (m) => m.replace(/</g, ' '))
  const at = lineIndex(html)
  let out = '', last = 0
  for (const m of masked.matchAll(/<([a-zA-Z][\w-]*)(?=[\s>/])/g)) {
    const end = m.index + m[0].length
    out += html.slice(last, end) + (/^(html|head|meta|title|link|base|script|style)$/i.test(m[1]) ? '' : ` data-ai-line="${at(m.index)}"`)
    last = end
  }
  return out + html.slice(last)
}

// G042·G044(hover 절반): 누르는 요소(probe 가 data-ai-p 를 단 최대 80개)에 CDP 로 :focus-visible·:hover 를 강제하고,
// 전환을 끈 끝 상태를 쉬는 상태와 비교한다. G042 = 포커스로 바뀌는 속성이 transition 목록에 있다, G044 = hover 가 크기·뒤 요소 위치를 옮긴다.
async function pseudoPass(send, ev) {
  const n = await ev('window.__ai ? window.__ai.n : 0')
  if (!n) return []
  await send('DOM.enable'); await send('CSS.enable')
  await ev('window.__ai.freeze()')
  const root = (await send('DOM.getDocument', { depth: 0 })).result.root.nodeId
  const out = []
  for (let i = 0; i < n; i++) {
    const nodeId = (await send('DOM.querySelector', { nodeId: root, selector: `[data-ai-p="${i}"]` })).result?.nodeId
    if (!nodeId) continue
    const base = await ev(`window.__ai.state(${i})`)
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus-visible'] })
    const fv = await ev(`window.__ai.state(${i})`)
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] })
    const hv = await ev(`window.__ai.state(${i})`)
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    const tp = await ev(`window.__ai.tp[${i}]`)
    const moved = Object.keys(fv.props).filter((k) => fv.props[k] !== base.props[k])
    const animated = moved.filter((k) => tp.p.some((p, j) => (p === 'all' || p === k || k.startsWith(`${p}-`)) && tp.d[j % tp.d.length] > 0))
    if (animated.length) out.push(await ev(`window.__ai.occ(${i}, 'G042', ${JSON.stringify(`포커스 ${animated.join(',')} 전환`)})`))
    const shift = Math.abs(hv.w - base.w) > 0.5 || Math.abs(hv.h - base.h) > 0.5 || hv.after.some((y, j) => Math.abs(y - base.after[j]) > 0.5)
    if (shift) out.push(await ev(`window.__ai.occ(${i}, 'G044', 'hover 가 레이아웃을 옮긴다')`))
  }
  return out
}

async function render(url, cfg, { collect }) {
  const chrome = await startChrome(['--hide-scrollbars'], { prefix: 'ai-tell-' })
  try {
    let navFrame = null, docStatus = null
    // CDP 응답마다 기한(T9-c1, cdp.mjs session) — 디스크가 막히면 Chrome 이 Page.navigate 에 답하지 않은 채 멈춘 적이 있다.
    // 넘기면 어느 호출이 막혔는지 적어 도구 실패(종료 1)로 끝낸다. 페이지 예외도 측정 실패로 던진다.
    const { ws, send, ev } = await connect(chrome.wsUrl, {
      throwOnException: true,
      // 주 문서의 HTTP 상태(리디렉션이면 마지막 응답)
      onEvent: (d) => { if (d.method === 'Network.responseReceived' && d.params.type === 'Document' && (!navFrame || d.params.frameId === navFrame)) docStatus = d.params.response.status },
    })
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    const occ = []; let used = null
    for (const w of [1440, 375]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false })
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
      docStatus = null
      // 탐색 실패·HTTP 오류·Chrome 오류 페이지는 채점하지 않는다 — 도구 실패(종료 1)
      // 옛 문서(about:blank·앞 너비의 같은 문서)의 complete 를 새 문서로 읽지 않는다(cdp.mjs navigateAndWait, 15초 기한)
      const nav = await navigateAndWait(send, ev, url)
      if (nav.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
      navFrame = nav.result?.frameId ?? null
      if (String(await ev('location.href')).startsWith('chrome-error://')) throw new Error(`Chrome 오류 페이지가 떴다: ${url}`)
      if (docStatus !== null && docStatus >= 400) throw new Error(`HTTP ${docStatus}: ${url}`)
      await ev('document.fonts.ready.then(() => 1)'); await sleep(600)
      // 유한한 등장 애니메이션은 끝 상태로 보내고 잰다(실행마다 중간값을 재지 않게) — 무한 반복은 그대로
      await ev('(() => { for (const a of document.getAnimations()) { const t = a.effect && a.effect.getComputedTiming(); if (t && Number.isFinite(t.endTime)) a.finish() } return 1 })()')
      const r = await ev(`(${probe.toString()})(${cfg.expr(w === 1440 && collect, w === 1440)})`)
      occ.push(...r.occ)
      if (r.used) used = r.used
      if (w === 1440) occ.push(...(await pseudoPass(send, ev)))
    }
    ws.close()
    return { occ, used }
  } finally { await chrome.close() }
}

// ── CLI ──────────────────────────────────────────────────────────────────
export const USAGE = '사용: node factory/qa/ai-tell.mjs <url|html> --out <dir> [--mode warn|block] [--threshold N] [--no-kas]\n' +
  '종료: 0 = 쟀다(warn 은 점수와 상관없이) · 3 = block 에서 G 점수 > 문턱 · 2 = 인자 오류 · 1 = 측정 없음(탐색 실패·HTTP 4xx/5xx·Chrome 오류 페이지·kas 실패 — warn 에서도)'
export function parseArgs(argv) {
  const a = { mode: 'warn', threshold: null, kas: true }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === '--out') a.out = rest.shift()
    else if (t === '--mode') a.mode = rest.shift()
    else if (t === '--threshold') a.threshold = rest.shift()
    else if (t === '--no-kas') a.kas = false
    else if (t.startsWith('--') || a.input) throw new Error(`알 수 없는 인자: ${t}`)
    else a.input = t
  }
  if (!a.input) throw new Error('입력(url 또는 html 파일)이 없다')
  if (!a.out) throw new Error('--out <dir> 이 없다')
  if (!['warn', 'block'].includes(a.mode)) throw new Error(`--mode 는 warn·block 중 하나: ${a.mode}`)
  if (a.threshold !== null) { if (!/^\d+(\.\d+)?$/.test(String(a.threshold))) throw new Error(`--threshold 는 0 이상 숫자: ${a.threshold}`); a.threshold = +a.threshold }
  if (a.mode === 'block' && a.threshold === null) throw new Error('block 모드는 --threshold 가 필요하다')
  a.isUrl = /^(https?|file):\/\//i.test(a.input)
  if (!a.isUrl && !existsSync(a.input)) throw new Error(`입력 파일이 없다: ${a.input}`)
  return a
}

// 사람이 찾을 수 있는 파일 이름: 저장소 안이면 저장소 기준 상대 경로, 밖이면 절대 경로(둘 다 / 구분)
const fileLabel = (f) => { const r = relative(ROOT, f); return (r && !r.startsWith('..') && !isAbsolute(r) ? r : f).replace(/\\/g, '/') }
// URL 입력에서는 번들 JS 를 보지 않는다 — 이 검사들의 0 은 통과가 아니라 「재지 않음」이다
export const URL_INACTIVE = ['G068', 'G072']

// C120 준비: 결과 파일(ai-tell.json 또는 그것이 든 폴더)들의 G 점수 분포. 문턱 제안의 재료일 뿐 문턱을 고르지 않는다.
// 백분위는 가장 가까운 순위(nearest-rank): p → 정렬한 점수의 ceil(p·n)번째 값.
export function scoreDistribution(files) {
  if (!files.length) throw new Error('결과 파일이 없다')
  const scores = files.map((f) => {
    const p = existsSync(f) && statSync(f).isDirectory() ? join(f, 'ai-tell.json') : f
    if (!existsSync(p)) throw new Error(`결과 파일이 없다: ${p}`)
    const r = JSON.parse(readFileSync(p, 'utf8'))
    const v = r.scoreG ?? r.score
    if (typeof v !== 'number') throw new Error(`점수가 없다: ${p}`)
    return v
  }).sort((x, y) => x - y)
  const rank = (q) => scores[Math.max(0, Math.ceil(q * scores.length) - 1)]
  return { n: scores.length, min: scores[0], p50: rank(0.5), p90: rank(0.9), max: scores[scores.length - 1], scores }
}

export async function main(argv) {
  if (argv[0] === '--distribution') {
    try {
      const d = scoreDistribution(argv.slice(1))
      console.log(`ai-tell 점수 분포(G, n=${d.n}): min ${d.min} · p50 ${d.p50} · p90 ${d.p90} · max ${d.max}\n  점수(오름차순): ${d.scores.join(' ')}`)
      return 0
    } catch (e) { console.error(`ai-tell: ${e.message}`); return 2 }
  }
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`ai-tell: ${e.message}\n${USAGE}`); return 2 }
  const banlist = loadBanlist(), exceptions = loadExceptions().exceptions
  const fontCheck = {}
  for (const f of banlist.fonts) for (const role of ['display', 'body', 'mono']) fontCheck[`${f.family}|${role}`] = fontCheckId(f.family, role)
  const layoutMin = Object.fromEntries(banlist.layouts.map((l) => [l.check, l.min]))
  const lineValues = exceptions.find((x) => x.id === 'line-division')?.axisValues ?? []
  mkdirSync(a.out, { recursive: true })
  const jsonPath = join(a.out, 'ai-tell.json')
  rmSync(jsonPath, { force: true }) // 측정하지 못하고 끝나면(종료 1) 이전 실행의 점수가 남아 읽히지 않게

  const file = a.isUrl ? null : resolve(a.input)
  const src = file ? readFileSync(file, 'utf8') : null
  let tmp = null, url = a.input
  if (file) { // 줄 번호 표지를 단 사본을 원본 옆 상대 경로가 살도록 <base> 와 함께 연다
    tmp = mkdtempSync(join(tmpdir(), 'ai-tell-src-'))
    const base = `<base href="${pathToFileURL(dirname(file)).href}/">`
    writeFileSync(join(tmp, 'page.html'), annotateLines(src).replace(/<head\b[^>]*>/i, (m) => `${m}${base}`))
    url = pathToFileURL(join(tmp, 'page.html')).href
  }
  const cfg = { expr: (collect, pseudo) => JSON.stringify({ banlist, fontCheck, layoutMin, lineValues, collect, pseudo }) }
  let r
  try { r = await render(url, cfg, { collect: !file }) } catch (e) { console.error(`ai-tell: 측정 없음(도구 실패) — ${e.message}`); return 1 } finally { if (tmp) rmSync(tmp, { recursive: true, force: true }) }

  // 정적 검사 원천: 파일이면 원본 그대로, URL 이면 이 페이지가 쓰는 규칙·마크업 사본(<out>/snapshot/)
  const label = file ? fileLabel(file) : 'snapshot'
  const occ = [...r.occ.map((o) => (file && o.line ? { ...o, file: label } : o))]
  const kasFiles = []
  if (file) {
    occ.push(...cssChecks(label, styleOnly(src)), ...scriptChecks(label, scriptsOnly(src)))
    kasFiles.push({ name: basename(file), text: src, label })
  } else {
    const snap = join(a.out, 'snapshot')
    rmSync(snap, { recursive: true, force: true }); mkdirSync(snap, { recursive: true })
    const chunks = []; let cur = [], len = 0
    for (const l of r.used.html.split('\n')) { cur.push(l); len += l.length + 1; if (len > 400_000) { chunks.push(cur.join('\n')); cur = []; len = 0 } }
    if (cur.length) chunks.push(cur.join('\n'))
    chunks.forEach((c, i) => { const n = `page-${i + 1}.html`; writeFileSync(join(snap, n), c); kasFiles.push({ name: n, text: c, label: `snapshot/${n}` }) })
    writeFileSync(join(snap, 'used.css'), r.used.css); kasFiles.push({ name: 'used.css', text: r.used.css, label: 'snapshot/used.css' })
    writeFileSync(join(snap, 'inline-scripts.js'), r.used.scripts)
    occ.push(...cssChecks('snapshot/used.css', r.used.css), ...scriptChecks('snapshot/inline-scripts.js', r.used.scripts))
  }
  // 두 폭에서 같은 곳이 걸리면 한 번만(1440 이 먼저)
  const seen = new Set(), uniq = occ.filter((o) => { const k = `${o.id}|${o.file ?? ''}|${o.line ?? ''}|${o.sel}|${o.detail}`; if (seen.has(k)) return false; seen.add(k); return true })

  let kas = null
  if (a.kas) {
    kas = await runKas(kasFiles)
    if (kas.status === 'ok') { const names = Object.fromEntries(kasFiles.map((f) => [f.name, f.label])); for (const f of kas.findings) for (const h of f.hits) h.file = names[h.file] ?? h.file }
    if (kas.status === 'skip') console.log(`ai-tell: ${kas.reason} — kas 합산은 건너뛴다`)
  } else console.log('ai-tell: --no-kas — kill-ai-slop 합산은 건너뛴다')
  const s = score(uniq, { kas: kas?.status === 'ok' ? kas : null, exceptions, label })
  const over = a.threshold !== null && s.score > a.threshold
  const report = {
    input: file ? label : a.input, mode: a.mode, threshold: a.threshold,
    score: s.score, max: s.max, scoreG: s.scoreG, maxG: s.maxG, scoreKas: s.scoreKas, maxKas: s.maxKas, over,
    kas: kas ? { status: kas.status, reason: kas.reason, filesScanned: kas.filesScanned } : { status: 'off' },
    inactive: file ? [] : URL_INACTIVE,
    hits: s.hits, waived: s.waived,
  }
  // kill-ai-slop 실패는 도구 실패다(C124) — 반쪽 점수를 결과 파일로 남기지 않는다(옛 파일은 위에서 이미 지웠다)
  if (kas?.status === 'error') { console.error(`ai-tell: 측정 없음(도구 실패) — kill-ai-slop 실패: ${kas.reason}`); return 1 }
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n')
  console.log(`ai-tell: ${report.input} 점수 ${s.scoreG}/${s.maxG}${s.maxKas ? ` (+ kas ${s.scoreKas}/${s.maxKas}, 문턱 밖)` : ''} · 적중 검사 ${s.hits.length}개 · 예외로 뺀 곳 ${s.waived.length} · 모드 ${a.mode}${a.threshold !== null ? ` · 문턱 ${a.threshold}${over ? ' 초과' : ' 이하'}` : ''}${file ? '' : ` · 재지 않음 ${URL_INACTIVE.join('·')}(번들 JS)`}`)
  for (const h of [...s.hits].sort((x, y) => y.weight - x.weight || x.id.localeCompare(y.id)).slice(0, 12)) console.log(`  ${h.id} +${h.weight} ×${h.count}  ${h.name}\n      ${h.where}`)
  return a.mode === 'block' && over ? 3 : 0
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exitCode = await main(process.argv.slice(2))
