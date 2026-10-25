<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 청자 고요 (`r5-celadon`) — 레시피 안내

원천: `registry/factory/recipes/r5-celadon/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r5-celadon#v0.2.3        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r5-celadon-theme#v0.2.3  # 색만(registry:theme)
```

부품은 `r5-celadon-<부품>`(예: `r5-celadon-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r5-celadon/r5-celadon.css` 를 붙인다.

## 한눈에

- 분위기: 고요 · 재질 · 여백
- 첫 화면 히어로: banded-full-bleed(불투명 머리 띠 아래 전폭 사진 + 좌상단 한 줄)
- 맞는 원형: detail · portfolio
- 스타일 축: 반경 R1 · 버튼 B2 · 입력 I2 · 표면 C3 · 표 T3 · 머리 H2 · 그림자 S1
- 모션 M3 · 아이콘 phosphor G2(부품이 부르는 어댑터 `components/icons/phosphor-light` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 1.5 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Bodoni Moda(`font-bodoni-moda`, 굵기 400 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면 한 줄 제목 전용 대비 세리프. 굵기 400(가변 400~900 — 등장 때 wght 600 → 400, hover 500), 2.2~3vw 한 줄·행간 1.05·자간 -0.01em. 나머지 제목은 본문 고딕(「프리미엄이면 세리프」 기본값으로 번지지 않게)) · 한글 제목 Diphylleia(`font-diphylleia`) · 본문 Pretendard(`font-pretendard`, 조정: 본문 16px/1.7 굵기 400, 자간 0. 큰 한글 제목은 한글 제목체(Diphylleia, 굵기 하나 — 48px 이상 자간 -0.02em, 행간 1.2)가 그리고, 부품 제목 칸(16~18px)의 한글은 한글 제목체를 건너뛰어 이 서체가 제 굵기로 그린다. detail 구매 포인트 제목은 가벼운 굵기 대신 크기(28px)로 세운다. 가격·수량은 tabular-nums) · 고정폭 —
- 레퍼런스: layout-i02 · color-c01 · color-palette-offwhite · color-portfolio-accent-restrained · pal-sns-instagram-ddeit3lidlc-2 · pal-sns-instagram-dzoqiujatgc-2 · pal-sns-instagram-dczkq5lj4rj-2
- 색 논리 K6(색 면) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `tilt-3d`(3D 기울임·원근) · `clip-reveal`(clip-path 리빌) · `variable-axis`(가변 폰트 축 애니메이션) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다

## 모션 토큰

모션 M3 의 값이 `:root`(순수 CSS·registry cssVars.light)에 실린다 — `motion-core` 의 기본값(M2)을 덮고, 프리셋(`.wf-fade-rise` 등)이 `var(--duration-enter, …)` 로 읽는다. M0 은 등장 연출이 없다(`--duration-enter: 0ms`).

- `--ease-standard`: `cubic-bezier(0.16, 1, 0.3, 1)`
- `--ease-emphasized`: `cubic-bezier(0.05, 0.7, 0.1, 1)`
- `--ease-in-screen`: `cubic-bezier(0.77, 0, 0.175, 1)`
- `--ease-exit`: `cubic-bezier(0.4, 0, 1, 1)`
- `--ease-sheet`: `cubic-bezier(0.32, 0.72, 0, 1)`
- `--duration-press`: `160ms`
- `--duration-hover`: `200ms`
- `--duration-popover`: `200ms`
- `--duration-enter`: `700ms`
- `--duration-sheet`: `350ms`

## 면·칸 색 (색 논리 K6~K8)

이 레시피는 표준 shadcn 변수 밖의 색 키를 더 싣는다. cssVars.theme 이 `--color-<키>` 로 이어 두어 Tailwind 유틸리티로 바로 쓴다: `bg-field-1` + `text-field-1-foreground`.
- K6 색 면: 바탕이나 섹션 띠를 field-1(·field-2)로 칠한다. 한 페이지의 면 색은 2개까지이고 섹션마다 번갈아도 된다. 면 위 글자는 field-N-foreground 로만(회색 글자 금지 — DESIGN §5).

**면 구획에는 `data-face` 속성을 단다** — `<section class="bg-field-1 text-field-1-foreground" data-face="field-1">`. 레시피 CSS(registry css·순수 CSS)가 `[data-face="<키>"]` 스코프마다 `--background`·`--foreground`·`--primary`·`--primary-foreground`·`--ring`·`--border`·`--input`·`--muted`·`--muted-foreground`·`--accent`·`--accent-foreground`·`--secondary`·`--secondary-foreground` 를 그 면의 짝으로 다시 가리킨다. 그래서 면 안의 부품(주 버튼·포커스 링·보조 글자·입력 테두리·체크)이 면 위에서 대비를 지킨다(lint `face-contrast` — 두 테마, 글자 4.5 · 링·테두리·채움 3). 면 안에 놓인 카드(`[data-slot="card"]`)와 `[data-face-reset]` 요소는 레시피 원래 값으로 돌아간다. `data-face` 없이 면 색만 칠하면 바탕 기준 토큰이 그대로 남아 링·버튼이 사라질 수 있다.

- `[data-face="field-1"]`: 면 조각(muted·accent·secondary) = field-1-foreground 10% · 보조 글자 98% · 테두리·입력 54% (나머지는 field-1)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9654 0.0025 165.08)` | `oklch(0.1920 0.0051 173.79)` |
| `--foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9498 0.0045 134.85)` |
| `--card` | `oklch(0.9871 0.0017 145.56)` | `oklch(0.2305 0.0063 179.07)` |
| `--card-foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9498 0.0045 134.85)` |
| `--popover` | `oklch(0.9871 0.0017 145.56)` | `oklch(0.2305 0.0063 179.07)` |
| `--popover-foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9498 0.0045 134.85)` |
| `--primary` | `oklch(0.2933 0.0168 338.38)` | `oklch(0.9255 0.0242 180.61)` |
| `--primary-foreground` | `oklch(0.9654 0.0025 165.08)` | `oklch(0.1920 0.0051 173.79)` |
| `--secondary` | `oklch(0.9402 0.0042 157.17)` | `oklch(0.2338 0.0076 182.27)` |
| `--secondary-foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9498 0.0045 134.85)` |
| `--muted` | `oklch(0.9402 0.0042 157.17)` | `oklch(0.2338 0.0076 182.27)` |
| `--muted-foreground` | `oklch(0.3869 0.0087 88.72)` | `oklch(0.7849 0.0098 171.72)` |
| `--accent` | `oklch(0.9408 0.0154 181.77)` | `oklch(0.2739 0.0157 182.80)` |
| `--accent-foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9408 0.0154 181.77)` |
| `--destructive` | `oklch(0.52 0.17 27)` | `oklch(0.7 0.14 25)` |
| `--border` | `oklch(0.8590 0.0068 160.05)` | `oklch(0.3246 0.0114 178.83)` |
| `--input` | `oklch(0.5735 0.0085 164.75)` | `oklch(0.5906 0.0127 176.02)` |
| `--ring` | `oklch(0.4935 0.0683 185.83)` | `oklch(0.8106 0.0834 185.99)` |
| `--success` | `oklch(0.52 0.1 150)` | `oklch(0.74 0.11 150)` |
| `--success-foreground` | `oklch(0.985 0.005 150)` | `oklch(0.19 0.02 150)` |
| `--warning` | `oklch(0.54 0.12 60)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 60)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.5 0.1 245)` | `oklch(0.74 0.1 245)` |
| `--info-foreground` | `oklch(0.985 0.004 245)` | `oklch(0.19 0.015 245)` |
| `--field-1` | `oklch(0.8601 0.0727 187.17)` | `oklch(0.4200 0.0828 185.92)` |
| `--field-1-foreground` | `oklch(0.2170 0.0038 106.71)` | `oklch(0.9808 0.0098 181.42)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-bodoni-moda-wf, "Bodoni Moda", "Diphylleia", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-diphylleia-wf, "Diphylleia", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-diphylleia-wf, "Diphylleia", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Diphylleia → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 Diphylleia는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다. 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 한글 제목체를 건너뛴 제목 스택(라틴 Bodoni Moda → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.

## 원천 본문

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28)에서 운영자가 A를 pick 하며 B는 부분 판정에서 색 좋다 · 글씨체 좋다 · 배치 별로 · 모션 별로, 전체 판정은 unrated(좋다·별로를 매기지 않음)로 남았다. 대표 메모: 「배치가 너무 빈 공간이 많아보임. 모션 그래픽도 단순하고.」 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- A(청자 면·`banded-full-bleed`·Bodoni Moda + 디필레이아)를 그대로 기본으로 두고, B(흙갈색 면·`corner-meta-line`·Tenor Sans + Grandiflora One)의 `alternates`는 지웠다 — 운영자가 고르지 않았고 남길 이유(부분 좋다)도 배치·모션이 상쇄한다.
- B 전용 히어로 `corner-meta-line`은 다른 레시피가 쓰지 않아 `HEROES` 카탈로그와 `app/qa/recipes/heroes/corner-meta-line.tsx`·`heroes.css`의 관련 규칙을 함께 뺐다(카탈로그에 남기면 `HERO_IDS` 전수 검사가 짝 없는 컴포넌트를 계속 실어야 한다).
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 계속 A만 적는다(원래도 B는 괄호로만 곁들였다) — 바뀐 것은 alternates 삭제와 대안 언급을 지운 것뿐이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체)** — 색 논리 K1 → **K6 청자 면**, 모션 M2 → **M3**, 역동 기법 `clip-reveal`·`variable-axis` → **`tilt-3d`·`clip-reveal`·`variable-axis`**. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 머리로 옮긴 색(보드 B 값 — 다크 면은 명도만 조정): 라이트 `field-1` 청자 면 `0.86 0.07 187`·`field-1-foreground` `0.22 0.02 200`, 다크 `field-1` `0.47 0.08 187` → **`0.415 0.08 187`**·글자 `0.95 0.01 187`. 바탕·잉크 주 버튼·청자 강조(선택 표시)·상태색은 A 그대로다. `alternates`는 지웠다.
- 대비 관문을 위해 명도만 조정(컨트롤러 판정, 운영자 선택 색상·채도 유지): 보드 값의 다크 면 글자 대비 5.68로는 다크 「면 위의 조작」 견본의 면 보조 글자(5.52)가 본문 7:1 관문에 못 닿았다. 다크 면의 L만 내렸다. 대비(lint와 같은 `contrast-lib ratio`): 라이트 면 글자/청자 면 11.57, 다크 **7.11**. 면 위 조작은 `[data-face="field-1"]` 스코프가 면 짝 색으로 다시 가리킨다(lint `face-contrast` 통과). 생성기 `faceTokens`는 이제 면 보조 글자를 닿을 수 있으면 7.15 이상으로 고른다(렌더 여유 `FACE_RENDER_MARGIN` 0.15 — 브라우저 렌더가 계산값보다 0.05~0.1 낮게 나와 r3 다크 block-1이 계산 7.01·렌더 6.94로 관문에 걸렸다).
- 모션 M3는 원형 detail·portfolio에서 허락된다(compat.json recipeRules는 dashboard·public만 막는다). 레시피 10벌 가운데 M3는 이 레시피와 r8-dusk 둘이다 — div-06 「M3 ≥ 2」를 이 판정이 채운다.
- 바뀐 것: 아래 Task 5·6 결정 기록의 「청자를 큰 면에 깔지 않는다」·「등장 연출은 첫 화면 사진 한 번」·M2 문장은 A안의 판단으로 남긴다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. 가는 제목(Jost·Pretendard 200)·떠 있는 알약 헤더(H2)·S1 그림자·실물 사진 원칙은 그대로다.
- AI 티 점수(명도 조정 뒤 다시 잼, 같은 빌드 r1 대조 12): G **13**/239(kas 7/35) — +1 G006은 앞과 같은 판정(Jost 200 제목, 아래 결정 기록).
- 갤러리 관문(명도 조정 뒤, `/qa/recipes?r=<id>`): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 6)

방향 원천은 dribbble-summary §6 R6(촉감·단일재질·고요)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r5-celadon 줄을 따랐다. 색 두 값(primary·ring)만 선정서에서 옮겼다(아래 「색상각 이동」). DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 청자 고요 (고름) | B 알루미늄 스모크 (남김, 안 씀) | C 호두 에스프레소 (버림) |
|---|---|---|---|
| 분위기 3단어 | 고요 · 재질 · 여백 | 차갑게 · 정밀 · 무게 | 따뜻 · 고급 · 느긋 |
| 축 | B2 I2 C3 T3 H2 R1 S1, M2 | B2 I2 C3 T3 H2 R1 S1, M2 | B4 I4 C4 T3 H2 R1 S1, M2 |
| 서체 짝과 이유 | Jost 200(라틴 소문자 제목) + Pretendard(본문, 한글 제목 200). 기하 산세리프의 가는 획이 유약 표면처럼 조용하고, 한글도 같은 가는 굵기로 잇는다 | 같은 짝 | 세리프 디스플레이 + 고딕 본문 |
| 색 3개 + 강조 1 | 차가운 오프화이트 바탕 · 청회 먹 글자 · 한 단계 밝은 카드 면 + 청자 187° 저채도 1 | 흰 바탕 · 먹 · 회색, 강조 없음 | 크림 바탕 · 에스프레소 글자 · 호두 갈색 + 브라스 |
| 사진·그림 | 실물 상품 촬영(색은 사진 속 재질이 가져온다) + 분위기 조각에만 한 재질 3D 오브젝트(layout-i02) | 같은 사진 | 따뜻한 조명의 연출 컷 |
| 이 안에서만 나오는 레이아웃 | 떠 있는 알약 내비(N5 floating pill) + 넓은 여백 위 860px 세로 상세 열 | 같은 틀 | 이중 베젤 카드 격자 |
| 레퍼런스 2개 | layout-i02 · color-portfolio-accent-restrained | color-c01 · 국내 상세 표본(세로 흐름) | 없음(상투 조합) |

- **버린 안: C.** 베이지·브라스·에스프레소는 design-taste가 「프리미엄 소비재 기본 팔레트」로 꼽는 조합이고, 크림 바탕은 §13 「따뜻한 크림 배경 + 세리프 디스플레이」 정면이다(계획 피할 패턴 크림·베이지). B4·I4·C4도 선정서가 이번에 쓰지 않기로 한 가공 하드웨어 묶음(N3)이다.
- **남긴 안: B.** 상투 표에는 걸리지 않는다. 그러나 무채만 두면 r7-docs와 색 논리가 같고, 사진이 없는 화면에서는 색이 사라진다. 이 레시피에서는 B의 「색은 사진이 가져온다」만 가져왔다.
- **고른 안: A.** 방문자 모드는 둘이다. detail(모바일 상세 한 장에서 구매 판단)과 portfolio(실제 작업을 보고 문의)이다. 둘 다 사진이 주인공이라 UI 색은 한 걸음 물러선다.
- **색 이동(Task 5 리뷰 M3 · 컨트롤러 판정 「r5가 옮긴다」, Task 6 리뷰 M3로 한 번 더)**: 선정서의 primary `0.45 0.06 175`·ring `0.52 0.08 175`는 r3-woodblock(primary `0.42 0.08 160`·ring `0.5 0.1 160`)과 OKLab 0.040·0.037로 거의 같았다. primary와 ring을 한 값 `0.52 0.05 187`로 옮겼다.
  - 떼어 놓은 거리는 색상각이 아니라 **L과 C**에서 나온다. primary는 r3보다 L이 0.10 밝고 C가 0.03 낮다(OKLab 0.109). ring은 C가 r3의 절반이다(OKLab 0.063). 사람 눈에는 r3가 짙은 숲초록 채움이고, r5는 한 톤 밝고 회색 기운이 도는 청자다.
  - 첫 판은 192°였다. 리뷰가 「r4(215°) 쪽으로 지나쳤다」고 봐서 인용 팔레트의 청자 187°로 되돌렸다. 이제 r3·r4와 거리가 같다(primary 0.109·0.109, ring 0.063·0.064).
  - 색상각 차는 r3와 27°, r4와 28°라 qa:distinct(30° 이상)는 두 쌍 모두 「색 같음」으로 센다. 두 쌍은 축(r3와 7개, r4와 6개)과 서체로 통과한다. 원형도 detail·portfolio 대 local·commerce·saas·dashboard로 겹치지 않는다.
  - 다크 바탕도 r4(`0.17 0.01 225`)와 사실상 같았다(OKLab 0.003). `0.18 0.014 185`로 청자 기운을 줘 0.014로 벌렸고, 다크 중립색(카드·면·테두리)도 186°로 맞췄다.
  - 더 밝은 청자 채움(L 0.62 + 먹 글자)은 버렸다. Button·Badge의 `link` 변형이 `text-primary`로 글자를 그려서, primary가 바탕 위 글자로도 4.5:1이어야 한다. 지금 값은 글자 5.01:1, 위 글자 5.15:1이다.
  - 색상각을 30° 이상 옮기는 다른 길(130° 이하)은 이끼·올리브로 넘어가 r8-dusk(125°) 자리가 된다.
- **주 버튼은 청자가 아니다(B2)**: B2는 주 버튼을 잉크(`--foreground`, 청회 먹)로 채운다. 청자는 선택·진행 표시(체크박스·라디오·스위치·진행 막대·슬라이더), 링크 글자, 포커스 링, 선택 칸(accent)에만 나온다. 면적으로 보면 청자는 화면의 몇 %에 그친다. 선정서 「청자 저채도 1, 나머지 색은 사진 속 재질」과 맞다.
- **H2 가드(선정서 리뷰 I4)**: 헤더 축 H2의 반투명·블러는 셸 안쪽 줄이 fixed 알약 섬이 되는 768px 이상에서만 걸린다(블러 12px — 가드 20px 이하). NavigationMenu 부품 자체는 불투명이다. Task 6에서 축 원천을 H1과 같은 방식으로 고쳤다(커밋 9352b9c). 반투명은 헤더 한 곳뿐이다. 카드·모달·시트는 불투명이고(C3), 모달 뒤 스크림만 base의 4px 블러다. 알약 내비는 내용 폭(`max-w-max`, 최대 화면 폭 − 48px)이고 데스크톱에서 링크를 펼친다. 모바일은 흐름 안의 평범한 바라 블러가 없다.
- **I2 × C3 주의(호환표 caution)**: 입력이 muted 면(`0.95`) 위에 놓여, 경계는 `--input` `0.6`이 맡는다(바탕 대비 3.65:1, muted 대비 3.3:1). C3의 깊이는 S1(여러 겹 틴트 그림자)이 맡는다.
- **팔레트 인용**: `pal-sns-instagram-ddeit3lidlc-2`와 `pal-sns-instagram-dzoqiujatgc-2`는 둘 다 **augmented 팔레트**다(바탕을 더한 팔레트, DESIGN §5-A pal-01 바탕 보강). 청자 187°(`#99E1D9`, `0.86 0.073 187`)와 차가운 하늘 227°(`#B2D5E5`)의 저채도 쌍에서 색상각만 빌렸다. 원본 두 색은 밝기 0.85 이상이라 흰 바탕의 글자·표시로 쓸 수 없다. 색상각 187°를 L 0.52·C 0.05로 다시 만들었다. 바탕 `0.975 0.006 190`은 첫 팔레트의 보강 바탕(`0.975 0.01 187`)보다 C를 낮춘 값이다(§5-A 오프화이트, 차가운 색상은 0.02까지).
- **서체**: Jost·Pretendard 모두 SIL OFL 1.1이다(키트 항목 `meta.licenseUrl`). §13·banlist에 없다. Jost는 라틴 전용이라 제목 스택이 Jost → Pretendard → 시스템 한글 순으로 떨어진다. **한글 제목 서체는 Pretendard 200**이다(선정서 M5). 둘 다 가변 서체라 200을 합성하지 않고 그대로 그린다. 부품 제목(카드·대화상자)은 축이 주는 굵기(C3 카드 제목 600)를 따른다. 가벼운 200은 28px 이상 큰 제목에만 쓴다(작은 크기에서 획이 흐려진다). 200은 머리 `fonts.display.weight`로 기계가 읽는다 — `--wf-heading-weight: 200`과 `.font-heading` 기본 층 굵기로 나가 소비자 제목에도 200이 온다(Task 6 리뷰 I1). 부품 제목 칸은 축이 준 굵기 유틸리티가 이긴다. 로더는 둘이다(Jost 1, Pretendard css `@import` 1).
- **아이콘**: phosphor(키트 항목 `icons-phosphor`), 결 G2(Phosphor light — 가는 선). 제목의 200과 같은 획 두께다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 portfolio 23곳 중 19곳이 유채색 2개 이하다(중앙값 1). S 0.9 이상 11곳 중 9곳이 유채 0~1이다(유채 0이 세 곳, 1이 두 곳 등). detail은 14곳 중 5곳만 2개 이하다(중앙값 3). 그런데 detail의 유채색은 대부분 상품 사진과 사진에 구운 글자에서 온다(선정서 근거 표본의 1200×22823 통이미지). 그래서 UI 강조는 청자 하나로 두고, 나머지 색은 사진이 가져온다(color-c01 「액센트 0, 색은 사진이」의 한 걸음 뒤). 차트도 청자 명도 단계와 청회 무채로만 칠한다. 색상각 묶음(§5-A, C ≥ 0.05)은 청자 187° 하나다. 의미색(성공·경고·오류·정보)은 §5 MUST라 따로 둔다.
- **글자 크기**: 비율 1.333 하나로 16 · 21 · 28 · 38 · 50 · 67에서 멈춘다. portfolio 선언문 H1은 67px(§21-4 42~72), 작업 격자의 UI 글자는 16px 한 크기다(§21-4). detail은 860px 열 안에서 구매 포인트 제목 28px, 본문 16px이다.
- **AI 티 점수**: `/qa/recipes?r=r5-celadon` 경고 모드 G **13**/239(kas 6/35, Task 6 fix 1 다시 잼 — 같은 빌드 대조 r1 12). 적중은 검수대 틀 쪽(G018·G078·G084·G088×4·G126·G135×3)과 G006 하나다.
  - **G006(+1, 제목과 본문 굵기 차 300 미만, 200 대 400)은 고치지 않고 이유를 적는다.** 검수대 제목이 이제 레시피 제목 굵기 200으로 그려져서 걸렸다(처음 판 12는 검수대가 제목을 700으로 그렸기 때문 — Task 6 리뷰 I1). DESIGN §2 SHOULD가 「본문 400이면 제목 700 또는 200」을 예로 들어 200을 허용한다. 검사기는 차 300 이상만 본다(차 200). 제목을 100으로 내리면 차는 300이 되지만 67px에서도 획이 머리카락처럼 가늘어져 대비가 무너진다. 선정서 M1(「300·400의 차 100은 위계가 서지 않아 제목 200」)을 지킨다.
  - 같은 재측정에서 G102(「제목 속 굵은 강조」)도 한 번 걸렸다. 검수대 제목 안의 id 표지 `<code>`가 400이라 200 제목보다 굵게 읽힌 것이다(갤러리 틀). 표지가 제목 굵기를 따르게 고쳐 빠졌다(`app/qa/recipes/specimen.tsx`).
  - H2 축은 이 레시피가 처음 쓴다. 갤러리 칸 안의 흐르는 NavigationMenu에 블러가 없다(CDP `backdrop-filter: none`, 375·1280). 그래서 G033·G133이 걸리지 않았다. `/qa/shell?h=H2`에서는 768·1024 스티키 셸에서만 섬이 fixed + `blur(12px)`이다. 375, 투명도 줄이기·고대비, `sticky={false}`(Task 6 fix 1 — 리뷰 M1)에서는 블러 없이 불투명이다.

## 분위기

차가운 오프화이트 위에 청자 면이 첫 화면을 통째로 덮는 화면이다. 머리는 불투명한 띠 두 단 — 청자 공지 한 줄과 바탕 내비 — 이고, 그 아래 전폭 그림 한 장(청자 매병 정물) 위 좌상단에 대비 세리프 한 줄 제목이 놓인다. 제목은 들어올 때 굵은 획에서 가는 획으로 한 번 굳고, 매병은 포인터를 따라 살짝 기운다.

## 쓰는 법

- 맞는 원형은 한국 커머스 상세페이지(detail)와 포트폴리오·스튜디오(portfolio)다. 재질이 보이는 실물 사진이 있을 때 쓴다.
- 첫 화면은 히어로 `banded-full-bleed`다. 제목 한 줄(2.2~2.6vw) 아래 3/12 칸 폭에 짧은 문단 셋 + 직사각형 버튼 둘(채움·외곽선, 반경 0, 폭 216px). 390px에서는 글과 그림이 나뉜다.
- 제목은 `font-heading`(라틴 Bodoni Moda 400, 한글 디필레이아)이다. 대비 세리프는 첫 화면 한 줄 제목에만 쓰고, 섹션 제목·본문·가격은 Pretendard다(「프리미엄이면 세리프」 기본값으로 번지지 않게).
- 사진이 색을 맡는다. 상품 컷은 실물 촬영만 쓴다(§21-6 MUST). 사진이 없으면 첫 화면은 청자 면 위 평면 정물 그림이다.
- 면: 첫 화면 공지 띠와 첫 화면 그림 칸, detail 첫 장·구매 포인트 띠를 청자 면(`bg-field-1`)으로 깔고 **`data-face="field-1"`을 함께 단다**. 면 위 상품 사진은 흰 카드(`[data-slot="card"]`)로 올린다. 면 글자 대비 11.73(다크 7.59).
- 주 버튼은 먹(`#32292F`) 채움 하나다. 청자 선(`--ring`)은 선택된 것에만 쓴다.
- detail은 860px 열 안에 흐르고, 고시·배송·반품은 HTML 표로 종이 바탕에 둔다.
- 모션은 M3다(등장 700ms, 감속 곡선 `cubic-bezier(0.16, 1, 0.3, 1)`, hover 200ms). 등장 연출은 첫 화면 한 벌뿐이다.
- 역동 기법 셋:
  - `tilt-3d` — 첫 화면 정물의 매병 하나만 포인터를 따라 몇 도 기운다. 파는 상품 사진·카드·버튼에는 걸지 않는다.
  - `clip-reveal` — 첫 화면 그림을 아래에서 한 번 걷는다(`--duration-enter`의 1.7배).
  - `variable-axis` — 제목의 굵기 축을 600 → 400으로 한 번 옮기고 멈춘다(1.7배 길이), hover에서 500. 한글 제목체는 가변 축이 없어 페이드만 받는다.
  - 동작 줄이기에서는 최종 상태(굵기 400·평면·다 보인 그림)가 바로 보인다.

## 하지 말 것

- 바탕을 크림·베이지로 데우지 않는다. 바탕은 차가운 오프화이트다.
- 면 색을 둘로 늘리지 않는다. 면은 청자 하나다. 주 버튼은 먹이다(면 색으로 칠하지 않는다).
- 기울임을 상품 사진·카드·버튼에 걸지 않는다. 분위기 조각 하나뿐이다.
- 파는 상품을 3D·생성 이미지로 대신하지 않는다. 그림은 분위기 조각에만 둔다.
- 대비 세리프(Bodoni Moda)를 섹션 제목·본문·가격으로 늘리지 않는다. 첫 화면 한 줄뿐이다.
- 헤더 밖에 블러를 쓰지 않는다. 카드·모달·시트는 불투명이다(§13).
- 첫 화면 밖 모든 섹션에 같은 스크롤 리빌을 걸지 않는다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r5-celadon.md`. 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(불투명 머리 띠 아래 전폭 그림 + 좌상단 한 줄) · 카드 팔레트(`pal-sns-instagram-ddeit3lidlc-2` + 측정값) · Bodoni Moda + 디필레이아. 바꾼 값: 다크 면은 카드 `#0A6E66`(글자 5.81)의 명도만 L 0.42로 내렸다(7.59 — 면 보조 글자가 본문 7:1 관문에 닿게). 카드의 opsz 축 연출은 갤러리 로더가 wght 축만 싣기 때문에 wght 600 → 400으로 옮겼다(같은 가변 축 기법).
- (제외된 B안 — 2026-09-28 보드 2판에서 지웠다, 위 「선택 보드 2판」 절. 되살릴 때의 기록으로만 남긴다) B안 = 카드 수 2(화면을 가로지르는 가는 한 줄 + 네 모서리 메타) · 새 팔레트: 측정 사이트의 돌 갈색(`#937E66`·`#5D4A3E` 계열을 K6 면 대역 C 0.085로 올린 흙갈색 면)·먹 `#201F1D`·밝은 글자 `#F9F5F7` + SNS 팔레트 `pal-sns-instagram-dczkq5lj4rj-2`(갈색 링 `#7A4F3A`·먹 주색) · Tenor Sans + Grandiflora One. Tenor Sans에 가변 축이 없어 B 기법은 `tilt-3d`·`clip-reveal` 둘이다(같은 허용 집합, lint 통과).
- 영상·사진 자리는 모두 직접 그린 그림이다(사진 확인 불가 — `app/qa/recipes/heroes/credits.ts`).
- 색 논리 K6·모션 M3는 선택 보드 판정(Task 9) 그대로다.
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- layout-i02 : 한 재질(유약·유리·금속)을 제대로 쓴 3D 오브젝트를 무채 배경 위 분위기 조각 하나로 둔다(재질 1~2종, 관찰 5건).
- color-c01 : UI 색은 오프화이트와 먹만 두고, 색은 사진이 가져온다(액센트 0). 이 레시피는 선택 표시에만 청자 하나를 더했다.
- color-palette-offwhite : 순백 대신 색이 살짝 든 오프화이트를 가장 밝은 면으로 쓴다. 차가운 색상이라 C 0.006으로 두고 카드는 바탕보다 L 0.015 밝게 둔다.
- color-portfolio-accent-restrained : portfolio 19곳이 유채색 2개 이하(절제)다. 강조를 청자 하나로 둔 근거다.
- pal-sns-instagram-ddeit3lidlc-2 : 청자 187°의 색상각(augmented 팔레트 — 약한 근거).
- pal-sns-instagram-dzoqiujatgc-2 : 차가운 하늘 227°와 먹의 저채도 쌍 — 글자·중립색을 청회 쪽으로 기울인 근거(augmented 팔레트 — 약한 근거).
- 해외 식품 상세 표본(이름은 적지 않는다) : 상세 한 장에서 상품 실물 컷과 넓은 여백, 짧은 문구 덩어리를 번갈아 둔다(detail 구조 근거).
- 국내 상세 표본(이름은 적지 않는다) : 한국 상세의 세로 흐름과 하단 고정 구매 바(detail 구조 근거). 통이미지에 글자를 굽는 방식은 따르지 않는다(§21-6).
