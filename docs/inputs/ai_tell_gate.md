# ai-tell score 게이트 — 자동 검사 목록 초안 (병합 에이전트 · 2026-09-26)

> 기계로 돌릴 수 있는 검사만 모았다(원 감사표의 「검사 방법」이 `사람`이 아닌 것). 대상은 ① 이번 추가 줄(A번호) ② 충돌 수정안(E번호) ③ DESIGN.md에 이미 있는 규칙 중 1a-taste가 `[AI티 게이트]`로 표시한 20행이다. 사람 판정만 되는 줄(A01·A02 등)은 넣지 않았다.

**건수** — 검사 142개 = 추가 줄 110 · 수정안 12 · 기존 규칙 20. 가중치 MUST 3 × 96 + SHOULD 1 × 46 = **최대 334점**. 유형별: 정적 정규식 67 · 계산된 스타일 54 · Lighthouse 2 · 스크린샷 4 · 동적 스크립트 15.

## 점수 방식

1. **가중합**: 적중한 검사의 가중치(MUST 3 · SHOULD 1)를 더한다. 판정은 적중 개수가 아니라 가중합이다.
2. **예외 등록**: 운영자가 풀어 준 값(브랜드가 정한 세리프·보라, 조정한 Inter 등)은 kill-ai-slop `deslop-ignore`·impeccable `ignore-value`로 등록해 점수에서 뺀다. DESIGN §8-3의 오버슈트 곡선 `cubic-bezier(0.34,1.56,0.64,1)`은 impeccable `bounce-easing`에 걸리므로 **게이트를 켜기 전에 예외로 등록**한다(E12).
3. **처음엔 경고**: 두 도구 모두 「적중은 단서지 판정이 아니다」라고 적는다. 게이트는 차단이 아니라 경고 + 사람 확인으로 시작하고, 오탐률을 한 회차 재서 문턱을 정한다(문턱값은 아직 근거 없음 — `확인 안 됨`).
4. **유형 정의**: 정적 정규식 = 소스·빌드 산출물 텍스트 검사 · 계산된 스타일 = 렌더 후 `getComputedStyle`·DOM 측정(1440/375 기본) · Lighthouse = 해당 감사 항목 · 스크린샷 = 렌더 이미지 비교·OCR · 동적 스크립트 = 상호작용을 흉내 내는 렌더 스크립트(hover 대기·키 입력·에뮬레이션). 마지막은 의뢰서의 네 유형 밖이라 따로 셌다.

## 재사용 도구

| 도구 | 경로·실행 | 덮는 검사 | 비고 |
|---|---|---|---|
| kill-ai-slop `scan.mjs` | `node ~/.claude/skills/kill-ai-slop/scripts/scan.mjs <root> --json` | tell 01~35(아래 「kas nn」) | 설치본 실측 35개(01 indigo→violet · 02 gradient-clip headline · 03 warm palette · 06 gradients as atmosphere · 07 serif-italic emphasis · 08 serif where sans belongs · 09 decorative strikes · 10 kicker · 11 full-sentence display · 12 flat hierarchy · 13 highlighted keywords · 14 AI copy voice · 15 emoji · 16 glowing dot · 17 left-border callout · 18 pastel icon tiles · 19 max-radius/glass · 20 oversized shadow · 21 corners don't nest · 22 border dies at corner · 23 badge spam · 24 AI-drawn SVG · 25 icon in own tint · 26 springy hover · 27 wobbly spinner · 28 all-caps card grid · 29 invented stat row · 30 01/02/03 markers · 31 cards in cards · 32 one gap everywhere · 33 Inter everywhere · 34 tasteful-terminal · 35 editorial-dashboard). 한국어 정규식은 `rules.ru.mjs`처럼 규칙 파일을 따로 두는 구조라 한국어 규칙 파일을 추가하면 된다(추정 — 구조만 확인) |
| impeccable `detect` | `~/.agents/skills/impeccable/scripts/impeccable detect --json` | `bg-clip-text` `side-tab` `overused-font` `bounce-easing` `em-dash-overuse` `all-caps-body` `tracked-caps` `wide-tracking` `accent-bold` `layout-transition` `design-system-color` `design-system-radius` 등 | 규칙 id는 1a-taste가 `hooks.md`와 바이너리 문자열에서 본 것. **이번에 실행해 보지는 않았다**(확인 안 됨) |
| hallmark slop-test | `~/.claude/skills/hallmark/references/slop-test.md`(게이트 58개 = 1~57 + 38a) | 정적 정규식: 1·2·7·10·14·22·24·30·37·38a·48·50·51·55·56 + `100vw`·`z-index: 9999` / 계산·렌더: 25·34·36·39·40·41·44·49·52·53 / 나머지 사람 | 스크립트 없음(전부 `.md`). 번호를 검사로 옮겨야 한다. 이 목록과 겹치는 번호는 표의 「도구」 칸에 적었다 |
| web-design-canon | `python ~/.claude/skills/web-design-canon/scripts/static_check.py <폴더>` · `node …/audit_run.mjs "<경로>" --json audit.json` | 계산된 스타일 검사를 붙일 렌더 러너(1440/375 × 라이트/다크) | A119에 따라 폭 목록 320·375·414·768·1280×800을 더한다 |

---

## 검사 목록

| 검사 | 규칙 | 원천 행 | 유형 | 무엇을 잡나 | 가중치 | 도구 |
|---|---|---|---|---|---|---|
| G001 | A04 | 1a2-157 | 정적 정규식 | 리디자인 전후 라우트·앵커 id·폼 `name`·분석 이벤트 id diff | 3 | — |
| G002 | A06 | hm-017 · hm-018 · 1a2-013 | 계산된 스타일 | 1440px h1 줄 수 >2, font-size >96px, 단어 ≥10 & font-size ≥48px, 414px 2줄 초과 | 3 | kas 11 |
| G003 | A07 | hm-021 · 1a2-015 | 계산된 스타일 | uppercase & font-size ≥`--text-2xl` & line-height <1.0, 제목 글리프 박스가 줄 상자 밖으로 잘림 | 3 | hallmark 55 |
| G004 | A08 | 1a2-027 | 계산된 스타일 | 세리프 본문 line-height < 산세리프 본문 | 1 | — |
| G005 | A09 | 1a2-018 · pb-22 · hm-031 | 정적 정규식 | `<p>` 하나에 strong·b·mark·색 span ≥2, 링크·정가 밖 `line-through`·`<u>`, `a` 밖 underline, `mark`·`em`의 `::after` + absolute | 3 | kas 09·13 |
| G006 | A10 | hm-014 · hm-025 | 계산된 스타일 | h1~h3와 p의 font-weight 차 <300, 폴백 `@font-face`에 size-adjust 없음 | 1 | — |
| G007 | A11 | 1a2-019 | 계산된 스타일 | `text-transform: uppercase` 요소 수(약어 제외) | 3 | kas 28 · imp all-caps-body·tracked-caps |
| G008 | A12 | hm-028 · 1a2-031 | 정적 정규식 | `\d+ (KB\|MB\|GB\|kg\|km\|min)` 사이가 일반 공백 | 3 | — |
| G009 | A12 | 1a2-197 | 정적 정규식 | 한글 수사 + 건·개·명(「여덟 건」) | 1 | — |
| G010 | A13 | 1a2-032 · hm-086 | 정적 정규식 | 짧은 요소(h*·button·label·figcaption·cite) 안 U+2014 ≥1, 문단당 — ≥2 | 3 | imp em-dash-overuse |
| G011 | A14 | hm-045 · hm-056 · hm-043 | 계산된 스타일 | html·body `overflow-x` ≠ clip, `100vw`, 맨 `1fr` 트랙 + 자식 img, 320px 가로 스크롤 | 1 | hallmark 50 · `100vw` |
| G012 | A15 | hm-067 | 계산된 스타일 | 히어로 padding-block-end ÷ start <1.3 | 1 | — |
| G013 | A16 | hm-059 | 정적 정규식 | `@media` 안의 px 값 | 1 | — |
| G014 | A17 | hm-046 · 1a-049 · 1a2-098 | 계산된 스타일 | 헤더·CTA flex 행 align-items stretch, 상태·배지 열 text-align, 같은 행 카드 CTA bottom y 차 >2px | 1 | — |
| G015 | A18 | hm-069 · 1a2-084 · 1a2-085 | 계산된 스타일 | 히어로 안 텍스트 블록 >4, 로고 이미지 ≥3, 1280×800 리드 줄 수 >2 | 3 | hallmark 44 |
| G016 | A19 | 1a-004 · hm-213 | 스크린샷 | 375px 렌더에서 `transform: rotate` 요소·겹친 히트 영역·가장자리 잘림 | 3 | — |
| G017 | A20 | hm-047 · 1a2-093 · hm-049 | 계산된 스타일 | 라벨+제목 wrapper grid 열 >1, 섹션 헤더 grid의 h2 열 + p만 있는 좁은 열, 375px 헤드 자식 겹침 | 3 | hallmark 52·54 |
| G018 | A21 | 1a2-091 | 계산된 스타일 | 섹션 구조 서명(자식 수·그리드 열·이미지 위치) 중복 수 | 1 | — |
| G019 | A23 | hm-096 · hm-102 · 1a2-054 | 정적 정규식 | 토큰 OKLCH 파싱 후 L·C 대역 밖, 램프 끝 C 과다, 라이트·다크 hue 차 | 1 | — |
| G020 | A24 | hm-103 · 1a2-053 | 계산된 스타일 | 글자 C <0.01 & 배경 C >0.03 | 3 | kas 03 형제 |
| G021 | A25 | 1a2-039 | 정적 정규식 | 저채도(C <0.03) 토큰의 hue 분산(따뜻·차가움 공존) | 3 | — |
| G022 | A26 | hm-100 | 정적 정규식 | `background`를 바꾼 규칙에 `color` 없음, `color: white` 하드코딩, 버튼 글자·채움 ΔL <5%p & ΔC <0.05 | 3 | — |
| G023 | A27 | 1a-028 · pb-23 | 정적 정규식 | `--color-*: initial` 없음, 빌드에 `--color-indigo`, 램프 단계 차 대비 표 | 1 | — |
| G024 | A28 | 1a2-056 | 스크린샷 | 섹션별 배경 L 밝음↔어두움 뒤집힘 ≥2 | 3 | — |
| G025 | A29 | 1a2-059 | 정적 정규식 | `prefers-color-scheme` 미디어 쿼리 없음 | 3 | — |
| G026 | A30 | 1a2-046 · 1a2-047 | 정적 정규식 | `repeating-(linear\|radial)-gradient`, 격자 `background-size`, `bg-gradient-to-b`·`from-<색>/10` 카드 | 3 | kas 06 |
| G027 | A31 | 1a2-062 | 계산된 스타일 | border-width ≥1 & box-shadow blur ≥16px 동시 | 3 | kas 20 |
| G028 | A31 | 1a2-063 | 계산된 스타일 | 그림자 blur > 요소 짧은 변의 1/2 | 1 | kas 20 |
| G029 | A32 | 1a2-067 · 1a2-076 | 계산된 스타일 | overflow:hidden & radius>0 부모 + border 있고 radius 0 자식, `::selection`·`caret-color`·`text-underline-offset` 선언 없음 | 1 | kas 22 |
| G030 | A33 | 1a2-071 · 1a2-072 | 정적 정규식 | 인라인 `<svg><path d>` 수 대비 아이콘 패키지 import 수, 아이콘 라이브러리 2종 이상, `lucide-react` import | 3 | kas 24 · hallmark 30 |
| G031 | A34 | 1a2-070 | 정적 정규식 | 아이콘 이름 Rocket·Shield·Sparkles, 🚀⚡🔒🎉 | 3 | kas 15 |
| G032 | A34 | 1a2-069 | 정적 정규식 | `bg-{c}-(50\|100)` 타일 안 아이콘, `bg-{c}/10` + `text-{c}`, `w-24` 장식 아이콘 | 1 | kas 18·25 |
| G033 | A35 | 1a-010 | 계산된 스타일 | `backdrop-filter` 요소의 position ∉ {fixed, sticky} & dialog 아님 | 3 | — |
| G034 | A36 | 1a2-077 · mo-068 | 정적 정규식 | `backdrop-filter` 파일에 `prefers-reduced-transparency` 블록 없음(에뮬레이션 렌더로 확인) | 3 | — |
| G035 | A37 | hm-112 · 1a2-114 | 계산된 스타일 | 로고 벽 img 높이 분산·채도 >0, 로고 줄이 `<span>` 텍스트뿐, 로고마다 부가 라벨 | 3 | — |
| G036 | A38 | 1a2-074 | 정적 정규식 | 곡선 명령이 많은 장식 인라인 SVG, class `*sketch*`·`*doodle*` | 3 | kas 24 |
| G037 | A39 | pb-21 · t-uni-002 | 스크린샷 | 배너 영역 `<img>`만 있고 텍스트 노드 0, 큰 이미지 OCR 글자 수 ≫ 페이지 텍스트 | 3 | — |
| G038 | A40 | hm-116 · hm-115 | 정적 정규식 | 임시 이미지 위 TODO 주석·`PLACEHOLDER_BASE` 참조·`generated:` 주석 없음 | 1 | — |
| G039 | A41 | hm-122 · 1a2-156 | Lighthouse | WebGL 페이지 JS+에셋 ≥2MB·로드 ≥6s, WebGL 끈 렌더에서 대체 없음, 성능 트레이스 <50fps | 3 | — |
| G040 | A42~A46 | mo-100 · mo-101 · mo-103 · mo-104 · mo-106 · mo-107 · mo-108 · mo-109 · mo-110 · mo-111 · mo-115 · mo-116 | 동적 스크립트 | `renderer.getPixelRatio()` >2(모바일 >1), `renderer.info.render.calls` ≥100(모바일 ≥50), 텍스처 >2048, 리사이즈 후 비율, 유휴 GPU | 1 | — |
| G041 | A47 | hm-140 · 1a-032 | 계산된 스타일 | `:disabled`에 cursor 없음, 계산된 opacity 0.38~0.55 밖 | 3 | — |
| G042 | A48 | hm-131 · 1a2-129 | 정적 정규식 | `:focus-visible`로 바뀌는 속성이 transition 목록에 있음, hover 상태 대비 < 쉬는 상태 | 1 | — |
| G043 | A49 | hm-206 · 1a2-124 | 계산된 스타일 | 320~1920px 폭 스윕에서 클릭 요소 `getClientRects().length > 1` | 3 | hallmark 49 |
| G044 | A50 | 1a2-168 · hm-138 · hm-139 | 계산된 스타일 | hover·로딩·오류 전후 레이아웃 이동(아래 요소 y·입력 텍스트 폭) | 3 | — |
| G045 | A51 | 1a-035 · 1a2-136 | 계산된 스타일 | 누르는 요소 `touch-action` ≠ manipulation | 3 | — |
| G046 | A52 | hm-157 | 동적 스크립트 | 100ms 응답 모의에서 스피너 표시됨 | 1 | — |
| G047 | A53 | 1a2-132 | 동적 스크립트 | 라벨 클릭으로 컨트롤 상태가 안 바뀜 | 3 | Lighthouse label(부분) |
| G048 | A54 | hm-136 · hm-137 · hm-142 | 계산된 스타일 | 상태별 border-width 다름, 같은 form의 input·button offsetHeight 다름, textarea resize | 1 | hallmark 입력 게이트 |
| G049 | A55 | 1a2-131 · 1a2-133 · 1a2-134 · hm-141 | 정적 정규식 | `type=email`에 spellcheck 없음, autofocus 수, select 색 선언 없음, 검증 중 `input.disabled` | 1 | — |
| G050 | A57 | mo-045 · hm-132 · hm-156 | 동적 스크립트 | `visibilitychange` 뒤 토스트 타이머가 계속 흐름 | 1 | — |
| G051 | A58 | hm-133 · mo-014 | 동적 스크립트 | hover 700ms 시점에 툴팁 보임, focus 직후 안 보임 | 3 | — |
| G052 | A60 | 1a-050 · mo-063 · mo-047 | 계산된 스타일 | 대화상자 폭 ∉ {384,512,640,768}, 모바일 ≠ 100%−32px | 1 | — |
| G053 | A61 | hm-143 · mo-041 | 계산된 스타일 | 네이티브로 될 select·checkbox·radio를 div+role로 구현 | 3 | — |
| G054 | A62 | hm-155 · mo-023 | 동적 스크립트 | 탭 클릭 전후 scrollY 변함 | 1 | hallmark 53 |
| G055 | A63 | 1a2-137 · mo-030 · mo-031 · mo-032 · 1a-046 | 정적 정규식 | 드래그 핸들러에 `setPointerCapture`·`user-select: none`·`inert` 없음 | 3 | — |
| G056 | A66 | 1a-043 · 1a2-104 | 계산된 스타일 | 좁은 폭에서 잘린 칩, 연속 행에 border-top & border-bottom 둘 다 | 1 | — |
| G057 | A67 | 1a2-143 · 1a2-030 | 정적 정규식 | aria-busy·로딩 컴포넌트 텍스트가 「…」로 안 끝남, 작업명 없는 「로딩 중」 | 3 | — |
| G058 | A68 | 1a2-145 · 1a2-146 | 동적 스크립트 | 401·403·404·429·500 모의 응답별 화면이 같음, 컴포넌트 오류가 전체를 막음 | 1 | — |
| G059 | A69 | mo-001 · mo-002 · mo-004 · 1a2-184 | 계산된 스타일 | keydown 핸들러가 토글하는 요소의 transition·animation-duration >0 | 3 | — |
| G060 | A70 | 1a2-170 · mo-025 | 계산된 스타일 | 같은 reveal 클래스·`whileInView` 섹션 비율 ≥50%, 두 번째 진입에도 애니메이션 | 3 | — |
| G061 | A71 | 1a2-144 | 동적 스크립트 | 작업 완료 시각 대비 UI 반영 지연 | 3 | — |
| G062 | A73 | hm-135 · 1a2-128 | 정적 정규식 | `hover:scale-1(0[3-9]\|1\d)`, `:hover` 안 `scale(1.03` 이상, `:hover`가 바꾸는 속성 ≥2 | 3 | kas 26 |
| G063 | A74 | mo-013 | 계산된 스타일 | 팝오버·드롭다운·메뉴 `transform-origin` = `50% 50%` | 3 | — |
| G064 | A75 | mo-015 · mo-016 · mo-034 · 1a-045 · 1a-037 | 정적 정규식 | 토스트·토글 선택자에 `animation:` | 3 | — |
| G065 | A76 | 1a-030 · mo-020 | 정적 정규식 | 마운트 진입 전환에 `@starting-style`·폴백 없음 | 3 | — |
| G066 | A77 | hm-188 · mo-017 | 계산된 스타일 | 마지막 요소 animation-delay >500ms, 등장 중 클릭 무반응 | 3 | — |
| G067 | A79 | hm-154 · mo-018 | 정적 정규식 | 탭 패널 transform 전환·높이 애니메이션 | 1 | — |
| G068 | A80 | mo-051 · mo-057 | 정적 정규식 | 상태 전환 스프링에 `bounce` >0 | 1 | — |
| G069 | A81 | mo-112 | 동적 스크립트 | 120Hz 에뮬레이션에서 애니메이션 속도가 달라짐 | 3 | — |
| G070 | A82 | 1a2-178 | 정적 정규식 | 회전 `@keyframes` 대상에 `translate(-50%` 동시 사용 | 3 | kas 27 |
| G071 | A83 | mo-021 · mo-038 · mo-039 · mo-058 | 정적 정규식 | 부모 CSS 변수로 자식 transform, Motion `x`/`y` 단축 속성 | 1 | — |
| G072 | A84 | 1a-008 · 1a2-181 · hm-191 | 정적 정규식 | `addEventListener\(['"]scroll` (passive 옵션 없음), `window.scrollY` 진행 계산 | 3 | — |
| G073 | A84 | hm-190 | 계산된 스타일 | 375px에서 `animation-timeline`·IO 스크롤 애니메이션 동작 | 1 | — |
| G074 | A88 | hm-169 · 1a2-191 | 정적 정규식 | 「아래에·위에·below」 + 입력 동사 | 3 | — |
| G075 | A89 | 1a2-193 | 계산된 스타일 | blockquote 줄 수 >3 | 1 | — |
| G076 | A90 | t-uni-001 | 정적 정규식 | `a[href$=".pdf"]`에 같은 내용 HTML 없음·링크에 용량 표기 없음 | 3 | — |
| G077 | A91 | pw-08 | 동적 스크립트 | 첫 로드에 `Notification.requestPermission`·`getCurrentPosition` 호출(콘솔 훅) | 3 | — |
| G078 | A93 | 1a2-089 · hm-202 | 계산된 스타일 | 데스크톱 header height >80px, 스크롤 전후 헤더 다음 요소 y 변함 | 1 | — |
| G079 | A94 | hm-203 · hm-204 | 계산된 스타일 | 메가메뉴 패널 >60vh, 공지 배너 링크 >1 | 1 | — |
| G080 | A96 | 1a2-155 · hm-123 · mo-040 | 정적 정규식 | package.json diff에 새 모션·애니메이션 의존성, `lottie`·`gsap` import | 3 | — |
| G081 | A97 | hm-117 · 1a2-154 | 정적 정규식 | 외부 폰트·이미지 호스트(운영 빌드), preconnect 없는 자산 도메인 | 1 | — |
| G082 | A98 | hm-160 · mo-086 · mo-087 · mo-088 | 동적 스크립트 | 카운트업 끝 프레임 값 ≠ 목표, 중간값 > 목표, live region 갱신 >1 | 3 | — |
| G083 | A99 | 1a-034 · 1a2-135 | Lighthouse | meta viewport `user-scalable=no`·`maximum-scale=1` | 3 | Lighthouse meta-viewport |
| G084 | A100 | 1b-b-001 | 정적 정규식 | h1 개수 ≠1, h1 텍스트가 회사명뿐·3단어 미만 | 3 | — |
| G085 | A101 | 1a-036 | 동적 스크립트 | 클라이언트 라우팅 뒤 `document.activeElement` ∉ main·h1 | 3 | — |
| G086 | A102 | 1a-044 · hm-159 | 동적 스크립트 | 검색 입력 중 live region 갱신 >1, 포커스 이동 | 3 | — |
| G087 | A103 | 1a-025 | 정적 정규식 | 수치 텍스트 노드의 부모가 `data`·`output`·`kbd`·`samp`·`dl` 아님 | 1 | — |
| G088 | A104 | hm-060 · 1a2-149 | 정적 정규식 | `margin-left`·`padding-right` 등 물리 방향 속성 수 | 3 | — |
| G089 | A104 | 1a2-148 | 정적 정규식 | 문자열 연결로 만든 문구, 복수형 삼항식 | 1 | — |
| G090 | A105 | 1a2-022 | 정적 정규식 | Fraunces·Instrument Serif·Playfair·Cormorant·Lora 디스플레이, 히어로 serif & italic | 3 | kas 08 |
| G091 | A105 | hm-011 | 정적 정규식 | 디스플레이 Roboto·Open Sans·Lato·Source Sans·Nunito·Montserrat·Raleway·Work Sans·Arial·Helvetica 등 조정 기록 없음 | 1 | — |
| G092 | A106 | 1a2-010 | 정적 정규식 | globals.css·components.json 토큰이 UI 키트 기본값과 같음 | 1 | — |
| G093 | A107 | 1a2-043 · hm-080 | 정적 정규식 | `background-clip:\s*text`·`bg-clip-text` | 3 | kas 02 · imp bg-clip-text |
| G094 | A108 | 1a2-045 · hm-081 | 계산된 스타일 | box-shadow 오프셋 0 & 유채색, text-shadow 블러 >0 & 유채색, `:hover` background-position 전환 | 3 | kas 06·16 |
| G095 | A109 | 1a2-068 · hm-079 | 계산된 스타일 | 한 변 border ≥2px(색)이고 나머지 0, `border-l-[2-9]` | 3 | kas 17 · imp side-tab |
| G096 | A110 | 1a2-107 | 계산된 스타일 | 데이터 바인딩 없는 svg path·progress·빈 둥근 사각형 | 3 | — |
| G097 | A111 | 1a2-115 | 정적 정규식 | `v\d+\.\d+(\.\d+)?`·`Build \d+`·`last sync`·`\d{1,2}:\d{2}\s*·\s*-?\d+°`·`No\. \d+` | 3 | — |
| G098 | A112 | 1a2-116 · 1a2-117 · hm-078 | 정적 정규식 | badge·pill 수, 히어로 안 `BETA\|v\d`, h1 직전 형제가 반경 999px 배지, `animate-ping\|animate-pulse` 소형 점 | 3 | kas 16·23 |
| G099 | A114 | 1a2-034 | 정적 정규식 | 한 텍스트 노드의 ` · ` ≥2 | 3 | — |
| G100 | A114 | 1a2-035 · 1a2-118 · 1a2-121 | 정적 정규식 | 링크·버튼 끝 「→」, 히어로 `/scroll\|스크롤/i`, `/(Step\|Stage\|Phase\|Pass) (\d\|One\|Two\|0\d)/` | 1 | — |
| G101 | A115 | hm-077 | 정적 정규식 | 헤더에 지름이 같은 원 3개가 줄지은 패턴(가짜 신호등) | 1 | hallmark 47 |
| G102 | A116 | hm-072 · hm-073 | 계산된 스타일 | h1~h3 안 strong·b, 제목 font-style italic | 1 | hallmark 38a |
| G103 | A117 | 1a2-108 · hm-075 | 계산된 스타일 | 히어로 안 큰 숫자(≥40px) + 작은 라벨 형제 블록 ≥3, h1 텍스트가 숫자·기호뿐 | 3 | kas 29 · hallmark 46 |
| G104 | A118 | hm-099 | 계산된 스타일 | 모든 (글자색, 실제 배경) 쌍의 APCA Lc — 본문 <60, 큰 글자·아이콘·포커스 <45 | 3 | hallmark 40·41 |
| G105 | A119 | hm-240 | 스크린샷 | 320·375·414·768·1280×800 렌더가 모두 있는지 | 1 | audit_run.mjs |
| G106 | A121 | 1a2-151 | 동적 스크립트 | 극단 입력 픽스처 주입 뒤 넘침·잘림 | 3 | — |
| G107 | A123 | hm-002 · 1a2-163 | 정적 정규식 | 산출물 맨 위 `P\d H\d E\d S\d R\d V\d` 주석이 없거나 3 미만 값 | 1 | — |
| G108 | A125 | 1a2-186 | 정적 정규식 | 한국어 대비 구문(`이 아니라\|뿐만 아니라\|이 아닌`), 3어절 이하 문장 3연속 | 3 | kas 14 |
| G109 | A126 | 1a2-187 | 정적 정규식 | 한국어 상투 구 사전(솔직히 말하면·핵심은·보시다시피·결론적으로·연구에 따르면 등) | 3 | — |
| G110 | A127 | 1a2-188 · 1a2-199 | 정적 정규식 | 시적 라벨 사전, 소제목 뒤 문장 ≤2 | 1 | — |
| G111 | E1 | 1a-091 · hm-024 · pb-13 | 계산된 스타일 | font-size <14px 요소 수 >0 | 3 | — |
| G112 | E2 | 1a2-014 · pb-15 | 계산된 스타일 | 48px 이상 한글 제목 자간 ∉ [−0.05, −0.02]em, 라틴 제목 < −0.04em | 1 | imp wide-tracking |
| G113 | E5 | 1a-099 | 계산된 스타일 | 블러 0 & 오프셋 >0 그림자가 있는데 반경 0이 아닌 요소가 있음 | 3 | — |
| G114 | E6 | 1a-098 · 1a2-061 | 계산된 스타일 | 선 구획 레시피에서 선–배경 대비 <3:1 | 3 | — |
| G115 | E7 | hm-121 · 1a2-048 | 계산된 스타일 | 그레인 오버레이가 밝은 면(L >85%) 위 | 1 | — |
| G116 | E9 | 1a-100 · db-13 | 계산된 스타일 | 히트 영역 <24px(`pointer: fine`) 또는 <44px(`pointer: coarse` 에뮬레이션, dashboard 표 밖) | 3 | — |
| G117 | E10 | 1a2-179 · hm-192 | 정적 정규식 | `cursor: url(`, pointermove 추종 요소(모션 강도 「높음」 레시피 밖) | 3 | — |
| G118 | E12 | hm-183 · 1a2-169 | 정적 정규식 | y값 >1.1인 cubic-bezier가 상태 선택자(`:checked`·`[data-state]`·button·dialog)에 | 1 | imp bounce-easing(예외 등록 후) |
| G119 | E13 | 1a2-173 · mo-037 | 정적 정규식 | transition·animation에 width·height·top·margin·box-shadow(아코디언 `grid-template-rows` ≤250ms 예외) | 3 | imp layout-transition |
| G120 | E14 | mo-059 | 정적 정규식 | 기본 상태 선택자에 상시 `will-change` | 3 | — |
| G121 | E15 | mo-069 · mo-070 · hm-193 | 동적 스크립트 | 탭 숨김·화면 밖에서 infinite 애니메이션이 running | 3 | — |
| G122 | E17 | 1a-093 · hm-010 · 1a2-024 | 정적 정규식 | font-family 첫 값이 Inter·Geist·Manrope·DM Sans·Plus Jakarta Sans·Space Grotesk·Poppins이고 조정 기록 없음 | 3 | imp overused-font · kas 33 |
| G123 | 기존 §13 | 1a2-016 | 정적 정규식 | h1~h3 안 `<em>`·`<i>`·font-serif·italic·액센트 색 span | 3 | kas 07 |
| G124 | 기존 §4 | 1a2-020 | 정적 정규식 | uppercase+tracking 라벨 수 > ceil(섹션/3) | 3 | kas 10 |
| G125 | 기존 §13·§2 | 1a2-023 | 정적 정규식 | font-family 첫 항목이 system-ui 등 기본값 | 3 | imp overused-font |
| G126 | 기존 §2 | 1a2-025 | 계산된 스타일 | 쓰인 font-size 인접 비 <1.2 개수 | 1 | kas 12 |
| G127 | 기존 §13 | 1a2-036 | 계산된 스타일 | monospace가 code·pre·숫자 열 밖 요소에 | 3 | kas 34 |
| G128 | 기존 §13 | 1a2-040 | 정적 정규식 | 프리미엄 베이지·크림 + 황동 팔레트와 ΔE 근접 | 3 | kas 03 |
| G129 | 기존 §13 | 1a2-041 | 정적 정규식 | `#6366f1→#a855f7`·`from-indigo to-purple` | 3 | kas 01 |
| G130 | 기존 §13 | 1a2-042 | 계산된 스타일 | 배경 L <20% & 고채도 액센트 1개 | 3 | — |
| G131 | 기존 §6·§13 | 1a2-066 | 계산된 스타일 | 부모·자식 radius 같고 padding >0 | 3 | kas 19·21 |
| G132 | 기존 §6·§13 | 1a2-073 | 정적 정규식 | 이모지 범위 정규식(기능 아이콘·불릿) | 3 | kas 15 |
| G133 | 기존 §6·§13 | 1a2-079 | 정적 정규식 | backdrop-filter 요소 수 | 3 | kas 19 |
| G134 | 기존 §4 | 1a2-092 | 계산된 스타일 | 연속 분할(이미지–텍스트) 섹션 ≥3 | 3 | — |
| G135 | 기존 §4 | 1a2-096 | 계산된 스타일 | 면(배경·테두리·그림자) 있는 요소 중첩 깊이 ≥2 | 3 | kas 31 |
| G136 | 기존 §10·§13 | 1a2-097 | 계산된 스타일 | 같은 구조 카드 ≥3 연속 | 3 | kas 28 |
| G137 | 기존 §3·§13 | 1a2-099 | 계산된 스타일 | h2·h3 margin-top ≤ margin-bottom, 최빈 간격 값 비중 | 3 | kas 32 |
| G138 | 기존 §10·§13 | 1a2-109 | 계산된 스타일 | 히어로 안 창 모양 div + 점 3개 + 가짜 목록 | 3 | hallmark 47 |
| G139 | 기존 §13 | 1a2-119 | 정적 정규식 | `>\s*0\d\s*[/·.]` 번호 표식 | 3 | kas 30 |
| G140 | 기존 §8-2 | 1a2-175 | 정적 정규식 | `transition:\s*all` | 3 | — |
| G141 | 기존 §9·§14-C | 1a2-185 | 정적 정규식 | 과장어 사전(Elevate·Seamless·Unleash·Next-Gen·Revolutionize…) | 3 | kas 14 |
| G142 | 기존 §9 | 1a2-200 | 정적 정규식 | 히어로·스탯 줄의 `10k+`·`99.9%`·`24/7` | 3 | kas 29 |

## 목록에 넣지 않은 것

- 사람 판정만 되는 추가 줄: A01·A02·A03·A05·A22·A56·A59·A64·A65·A72·A78·A85·A86·A87·A92·A95·A120·A122·A124.
- A113(구조 장치는 의미가 있을 때만)은 위 G 항목들의 합으로 채점되는 상위 규칙이라 따로 세지 않는다(이중 계산 방지).
- 공장 다양성(X3: `hm-003`·`1a2-011`)은 한 페이지의 AI 티가 아니라 사이트 간 비교라 별도 게이트(생성 로그 JSON에서 직전 1~5건과 축 일치 수를 세는 스크립트)로 둔다.
- HARNESS 구현 규칙(X1·X2)은 lint 규칙으로 옮긴다(`package.json` UI 키트 2종 이상 경고 등).
