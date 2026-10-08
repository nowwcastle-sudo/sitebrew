---
id: r7-docs
name: 문서 작업대
mood: [문서, 조용, 정돈]
axes: { button: B2, input: I2, surface: C1, table: T3, header: H1, radius: R2, shadow: S0 }
motion: M2
colorLogic: K6
dynamics: [view-transition, sticky-stack]
signature: [hero, doc-page]
hero: leaking-app-panel
alternates:
  colorLogic: K6
  color:
    light:
      background: "oklch(0.9853 0.0029 84.56)"
      foreground: "oklch(0.2392 0.0138 41.61)"
      card: "oklch(1.0000 0.0000 0.00)"
      card-foreground: "oklch(0.2392 0.0138 41.61)"
      popover: "oklch(1.0000 0.0000 0.00)"
      popover-foreground: "oklch(0.2392 0.0138 41.61)"
      primary: "oklch(0.3345 0.0340 198.61)"
      primary-foreground: "oklch(1.0000 0.0000 0.00)"
      secondary: "oklch(0.9588 0.0045 78.30)"
      secondary-foreground: "oklch(0.2392 0.0138 41.61)"
      muted: "oklch(0.9588 0.0045 78.30)"
      muted-foreground: "oklch(0.4064 0.0224 48.15)"
      accent: "oklch(0.9101 0.0601 65.33)"
      accent-foreground: "oklch(0.2392 0.0138 41.61)"
      border: "oklch(0.8797 0.0123 67.67)"
      input: "oklch(0.5497 0.0175 54.72)"
      ring: "oklch(0.5459 0.1072 44.81)"
      field-1: "oklch(0.8500 0.1100 68.00)"
      field-1-foreground: "oklch(0.2392 0.0138 41.61)"
    dark:
      background: "oklch(0.2042 0.0076 48.33)"
      foreground: "oklch(0.9461 0.0103 67.70)"
      card: "oklch(0.2354 0.0096 53.00)"
      card-foreground: "oklch(0.9461 0.0103 67.70)"
      popover: "oklch(0.2354 0.0096 53.00)"
      popover-foreground: "oklch(0.9461 0.0103 67.70)"
      primary: "oklch(0.7823 0.0555 190.24)"
      primary-foreground: "oklch(0.2042 0.0076 48.33)"
      secondary: "oklch(0.2354 0.0096 53.00)"
      secondary-foreground: "oklch(0.9461 0.0103 67.70)"
      muted: "oklch(0.2354 0.0096 53.00)"
      muted-foreground: "oklch(0.8032 0.0203 60.10)"
      accent: "oklch(0.3007 0.0295 53.29)"
      accent-foreground: "oklch(0.9101 0.0601 65.33)"
      border: "oklch(0.3240 0.0145 54.05)"
      input: "oklch(0.5819 0.0211 56.98)"
      ring: "oklch(0.7592 0.0897 48.92)"
      field-1: "oklch(0.4200 0.0900 58.00)"
      field-1-foreground: "oklch(0.9730 0.0178 64.94)"
  fonts:
    display: { family: "Libre Caslon Display", item: font-libre-caslon-display, weight: 400, tuned: "B안 첫 화면 제목 전용 가는 디스플레이 세리프(굵기 하나). 왼쪽 4칸 네 줄 4.4vw(390에서 11.8vw)·행간 1.0·자간 -0.01em. 한글은 자연산스, 부품 제목 칸은 본문 서체" }
    displayKo: { family: "NaturalSans", item: font-natural-sans }
  hero: narrow-title-wide-window
  note: "DNA 수 2(4칸 제목 + 8칸 앱 창 + 창 위 공지 알약) — 먹 글자·깊은 청록 주색·살구 면·복숭아 accent 의 새 팔레트(pal-sns-instagram-dp8ni9wkfhu-4 + 측정 사이트의 먹·테라코타·탠), 제목 Libre Caslon Display·자연산스. 색 논리 K6·모션 M2·기법 view-transition·sticky-stack 은 A 그대로"
icons: { library: tabler, weight: G2 }
fonts:
  display: { family: "Besley", item: font-besley, weight: 400, tuned: "첫 화면·섹션 제목 전용 클라렌던 세리프. 굵기 400, 첫 화면 세 줄 3.5vw(390에서 10.3vw)·행간 1.04·자간 -0.04em, 문서 H1 39px. 한글은 나눔스퀘어라운드(굵기 하나라 레시피 CSS 가 굵기 합성을 끈다)" }
  displayKo: { family: "NanumSquareRound", item: font-nanum-square-round }
  body: { family: "Pretendard", item: font-pretendard, tuned: "본문 16px/1.7 굵기 400, 강조 600, 자간 0, 한 줄 40자 이하(max-width 40em). 문서 목차·사이드 목록은 16px 한 크기" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "코드 블록·인라인 코드·kbd·data-numeric 숫자 칸에만, 굵기 400, 본문보다 0.9배. 메타 라벨·캡션·태그에는 쓰지 않는다" }
color:
  light:
    background: "oklch(0.9771 0.0034 145.55)"
    foreground: "oklch(0.2199 0.0317 198.63)"
    card: "oklch(1.0000 0.0000 0.00)"
    card-foreground: "oklch(0.2199 0.0317 198.63)"
    popover: "oklch(1.0000 0.0000 0.00)"
    popover-foreground: "oklch(0.2199 0.0317 198.63)"
    primary: "oklch(0.4050 0.0564 174.64)"
    primary-foreground: "oklch(0.9771 0.0034 145.55)"
    secondary: "oklch(0.9513 0.0058 153.77)"
    secondary-foreground: "oklch(0.2199 0.0317 198.63)"
    muted: "oklch(0.9513 0.0058 153.77)"
    muted-foreground: "oklch(0.3894 0.0226 179.08)"
    accent: "oklch(0.9361 0.0351 150.54)"
    accent-foreground: "oklch(0.2199 0.0317 198.63)"
    destructive: "oklch(0.53 0.17 27)"
    border: "oklch(0.8657 0.0102 164.83)"
    input: "oklch(0.5690 0.0193 173.56)"
    ring: "oklch(0.5189 0.0962 168.14)"
    success: "oklch(0.52 0.1 150)"
    success-foreground: "oklch(0.99 0.004 150)"
    warning: "oklch(0.55 0.12 60)"
    warning-foreground: "oklch(0.99 0.004 60)"
    info: "oklch(0.5 0.1 240)"
    info-foreground: "oklch(0.99 0.004 240)"
    field-1: "oklch(0.9000 0.0750 152.00)"
    field-1-foreground: "oklch(0.2199 0.0317 198.63)"
  dark:
    background: "oklch(0.1599 0.0053 173.58)"
    foreground: "oklch(0.9434 0.0083 157.09)"
    card: "oklch(0.1989 0.0079 182.06)"
    card-foreground: "oklch(0.9434 0.0083 157.09)"
    popover: "oklch(0.1989 0.0079 182.06)"
    popover-foreground: "oklch(0.9434 0.0083 157.09)"
    primary: "oklch(0.7395 0.0580 155.23)"
    primary-foreground: "oklch(0.1599 0.0053 173.58)"
    secondary: "oklch(0.2108 0.0098 173.15)"
    secondary-foreground: "oklch(0.9434 0.0083 157.09)"
    muted: "oklch(0.2108 0.0098 173.15)"
    muted-foreground: "oklch(0.7855 0.0183 164.52)"
    accent: "oklch(0.2426 0.0197 173.53)"
    accent-foreground: "oklch(0.9361 0.0351 150.54)"
    destructive: "oklch(0.7 0.14 25)"
    border: "oklch(0.2983 0.0155 169.05)"
    input: "oklch(0.5857 0.0198 169.62)"
    ring: "oklch(0.7906 0.1408 159.32)"
    success: "oklch(0.74 0.1 150)"
    success-foreground: "oklch(0.2 0.02 150)"
    warning: "oklch(0.8 0.12 72)"
    warning-foreground: "oklch(0.2 0.03 72)"
    info: "oklch(0.74 0.09 240)"
    info-foreground: "oklch(0.2 0.02 240)"
    field-1: "oklch(0.4215 0.0857 167.62)"
    field-1-foreground: "oklch(0.9625 0.0198 159.76)"
references:
  - layout-l08
  - component-saas-nav-top-bar-top-bar
  - color-palette-offwhite
  - type-t01
  - pal-uupm-76
  - pal-sns-instagram-dwih2ynktud-1
  - pal-sns-instagram-dp8ni9wkfhu-4
archetypes: [saas, pwa]
---

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체)** — 색 논리 K3 → **K6 칠판 청록 표지**, 모션 M0 → **M2**, 역동 기법 `oversize-crop` → **`view-transition`·`sticky-stack`**. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 머리로 옮긴 색(보드 B 값 그대로): 라이트 `field-1` 칠판 청록 `0.42 0.08 170`·`field-1-foreground` `0.96 0.01 170`, 다크 `field-1` `0.4 0.08 170`·글자 `0.95 0.01 170`. 종이 빛 바탕·따뜻한 먹·먹 주 버튼·의미 태그 색은 A 그대로다. `alternates`는 지웠다.
- 대비(lint와 같은 `contrast-lib ratio`): 라이트 면 글자/청록 면 7.24, 다크 7.65. 면 위 조작은 `[data-face="field-1"]` 스코프가 면 짝 색으로 다시 가리킨다(lint `face-contrast` 통과).
- r8-dusk(A — 솔숲 짙은 면 `0.32 0.1 138`)와 함께 승인됐다. r8 결정 기록은 「짙은 초록 띠 + 흰 바탕 두 벌이 되니 보드에서 둘을 함께 고르지 않는다」고 적었고, 운영자는 둘 다 골랐다. 두 면은 색상각 32°·채도 0.02·명도 0.1이 다르고 `qa:distinct`(대표 면 색 비교 포함)는 통과한다. 쓰임이 갈린다 — r7은 문서형 saas·pwa의 표지와 목차 머리, r8은 local·brand의 첫 화면 패널이다.
- 바뀐 것: 아래 결정 기록의 「색은 거의 없다」·「넓은 면에 원색 금지」·M0 문장은 A안의 판단으로 남긴다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. 문서 세 칸 틀·Gothic A1 800 제목·의미 태그·S0 크롬은 그대로다. `oversize-crop` 워드마크는 뺐다(B가 기법을 바꿨다).
- AI 티 점수(반영 뒤 다시 잼, 같은 빌드 r1 대조 12): G **12**/239(kas 7/35) — 기준선과 같다.
- 갤러리 관문(반영 뒤): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 6)

방향 원천은 style_axes 「레시피 방향 후보」 N2(문서형 작업공간)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r7-docs 줄을 그대로 따랐다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 무채 문서 (고름) | B 명조 문서 (남김, 안 씀) | C 따뜻한 종이 + 테라코타 (버림) |
|---|---|---|---|
| 분위기 3단어 | 문서 · 조용 · 정돈 | 문서 · 고요 · 읽기 | 아늑 · 손글씨 · 따뜻 |
| 축 | B2 I2 C1 T3 H1 R2 S0, M0 | B2 I2 C1 T3 H1 R2 S0, M0 | B3 I2 C3 T3 H1 R2 S1, M1 |
| 서체 짝과 이유 | Gothic A1 800(제목) + Pretendard(본문) + Plex Mono(코드). 곧고 굵은 고딕 제목이 문서 구획을 세우고, 본문은 화면용 고딕으로 오래 읽힌다 | 명조 제목 + Pretendard | 세리프 디스플레이 + 고딕 |
| 색 3개 + 강조 1 | 종이 빛 오프화이트 바탕 · 따뜻한 먹 글자 · 옅은 종이 면 + 강조 없음(색은 의미 태그의 옅은 짝에만) | 같은 무채 | 크림 `#F7F6F3` · 갈색 먹 · 베이지 면 + 테라코타 |
| 사진·그림 | 사진 없음. 실제 화면 스크린샷(헤어라인 테두리)과 코드 블록 | 같음 | 손그림 일러스트 |
| 이 안에서만 나오는 레이아웃 | 세 구획 헤더(N1b — 로고 · 문서 메뉴 · 검색·계정) + 왼쪽 목차 · 본문 · 오른쪽 문서 내 목차 + FAQ 왼쪽 1/3 제목 · 오른쪽 2/3 아코디언(layout-l08) | 같은 틀 | 가운데 카드 흐름 |
| 레퍼런스 2개 | layout-l08 · type-t01 | layout-l08 · color-palette-offwhite | 없음(상투 조합) |

- **버린 안: C.** 따뜻한 종이 + 세리프 제목 + 테라코타는 §13 「따뜻한 크림 배경 + 세리프 디스플레이 + 테라코타」 정면이다(N2 원문 주의 그대로). 크림 바탕은 계획 피할 패턴이기도 하다.
- **남긴 안: B.** 상투 표에는 걸리지 않는다. 그러나 명조 제목은 pwa 앱 바 작은 크기에서 약하다. 이 레시피에서는 B의 「읽기 우선 조판」(한 줄 40자, 행간 1.7)만 가져왔다.
- **고른 안: A.** 방문자 모드는 읽고 찾기다. saas(문서가 곧 제품 설명인 도구)와 pwa(연결이 끊겨도 쓰는 문서형 앱)에 쓴다.
- **K3 복제 인상(선정서 리뷰에서 수용)**: 무채 문서 + 의미 태그 옅은 짝은 minimalist-ui(노션) 팔레트의 논리 그대로다. 색 값은 복사하지 않았다. 종이는 색상각 92°·C 0.007, 먹은 70°·C 0.012로 다시 만들었다. 노션의 대표 인상인 세리프·손그림도 쓰지 않는다. 대신 굵은 고딕 제목(Gothic A1 800)과 세 구획 헤더가 이 레시피의 얼굴이다.
- **기본 shadcn과 다른 크롬(§13 「UI 키트 기본 테마 그대로」 경계)**: 무채 + 잉크 주 버튼은 기본 shadcn과 가장 가깝다. 차이는 여섯이다.
  - 바탕·먹이 무채(C 0) zinc·neutral이 아니라 종이 빛(92°, C 0.007)과 따뜻한 먹(70°, C 0.012)이다.
  - 제목이 Gothic A1 800이다.
  - 입력이 옅은 채움(I2)이고 경계는 3:1(`--input` L 0.6)이다.
  - 표가 여유 있게(T3) 놓인다.
  - 작은 컨트롤만 알약이다(R2).
  - 색은 의미 태그에만 나온다. 이 경계는 갤러리 AI 티 점수로 본다.
- **종이와 먹(Task 6 리뷰 I3)**: 첫 판의 바탕 `0.985 0.002 90`·먹 `0.2 0.004 90`은 C가 0.002~0.004라 눈에 보이지 않았다. shadcn neutral 기본 테마(바탕 순백·primary `0.205 0 0`)와 공통 견본에서 구분되지 않았다. 리뷰가 준 값으로 종이와 먹을 따뜻한 한 회색 계열로 옮겼다: 바탕 `0.982 0.007 92`, 카드 `0.992 0.004 92`, 면 `0.955 0.008 88`, 먹 `0.21 0.012 70`, primary `0.23 0.012 70`, 테두리 `0.89 0.008 85`, 입력 `0.6 0.01 80`, 다크 바탕 `0.18 0.008 70`.
  - 크림 판정 밖이다. 따뜻한 색상각(60~95°)이지만 C 0.007이 §5-A 문턱 0.012 아래다(lint `palette-cream` 통과).
  - 대비(라이트): 글자/바탕 16.85, muted-fg/바탕 7.71, muted-fg/면 7.13, 입력/바탕 3.75, 입력/면 3.46이다. 다크는 글자 15.31, muted-fg 9.4, 입력 5.16이다.
  - 한계도 적어 둔다. 거리로 재면 shadcn neutral과 ΔOKLab이 여전히 0.02~0.07이다(바탕 0.019, primary 0.028, 글자 0.066). 달라진 것은 거리가 아니라 색조다. 순백·순회색 대신 누런 종이와 갈색 기운의 먹이 보인다. 나머지 차이는 Gothic A1 800 제목과 문서 세 칸이 맡는다.
- **ring은 무채다**: 포커스 링은 먹 `0.3 0.012 70`(바탕 대비 12.97:1)이다. 선택 표시(체크·스위치·진행)도 먹 채움이다. 색이 없는 대신 굵기(2px 불투명)와 대비로 보인다.
- **public 원형에서 뺐다(Task 6 리뷰 I2 · 컨트롤러 판정)**: 선정서는 public에서 링크·ring을 KRDS 주 색으로, 본문을 Pretendard GOV로 바꾸라고 했다(M6). 그러나 그 교체를 레시피 본문 글로만 두면 기계가 읽지 못한다. `ai/tasks/public.json`은 이 레시피를 public 후보로 그대로 추천하고, 설치하면 Pretendard 본문에 주 색 없는 누리집이 된다(§21-8 MUST 「국·영문 모두 Pretendard GOV」 위반). 그래서 원형을 saas·pwa로 줄였다. public에는 이 레시피를 쓰지 않는다(r2-signal·r6-civic).
- **서체**: Gothic A1·Pretendard·IBM Plex Mono 모두 SIL OFL 1.1이다(키트 항목 `meta.licenseUrl`). §13·banlist에 없다. Gothic A1 800은 선정서 값이다. 키트에 없어서 Task 6에서 `font-gothic-a1` 굵기를 400·500·700·800으로 바꿨다. next/font `font-data.json`의 Gothic A1은 100~900이다. 키트 항목 굵기 상한 4(`factory/scripts/gen-fonts.mjs` `MAX_WEIGHTS`, `docs/qa/font-licenses.md` 「정적 서체는 4개까지」)를 지키려 900을 뺐다. 어느 레시피도 Gothic A1 500을 쓰지 않으므로(r2 400·700·800, r7 800) 400·700·800 셋으로 줄여 정적 굵기 하나를 덜 받는 안도 남겨 둔다(Task 6 리뷰 M2). Gothic A1은 한글·라틴을 모두 그리므로 **한글 제목 서체는 Gothic A1 800**이다(선정서 M5). 본문 Pretendard는 가변 서체다. 로더는 셋이다(Gothic A1 1, Pretendard css `@import` 1, Plex Mono 1).
- **아이콘**: tabler(키트 항목 `icons-tabler`), 결 G2(1.5px 선, 둥근 끝). 문서 본문 글자 굵기와 맞춘 가는 선이다. 같은 G2인 r5-celadon은 phosphor라 모양이 갈린다.
- **팔레트 인용**: `pal-uupm-76`은 보강하지 않은 데이터셋 팔레트다(augmented 아님, ui-ux-pro-max colors.csv #76). 「무채 먹 + 옅은 회색 면」의 역할 배정만 가져왔다. 이 행의 주색 `#18181B`·바탕 `#FAFAFA`·테두리 `#E4E4E7`은 Tailwind zinc 기본 스케일 값이라 복사하지 않았다(§5-A). 종이 92°·C 0.007, 먹 70°·C 0.012로 다시 만들었다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 saas 25곳 중 5곳이 유채색 2개 이하다(중앙값 4). S 0.9 이상 표본 두 곳은 유채 1개·2개다. pwa는 7곳 중 3곳이 2개 이하다(중앙값 3). 빈도는 다색 쪽이다. 그래도 강조를 0으로 둔 근거는 N2 방향 자체(K3 무채 문서)와 DESIGN §5 「뉴트럴이 면적의 대부분」이다. 필요한 색은 의미색 4종이 맡는다. 차트의 파랑 240°·주황 58°는 의미 태그 짝에서 가져온 데이터 색이다(파랑–주황 쌍, §5 MUST). 색상각 묶음(§5-A, C ≥ 0.05)은 그 둘뿐이고 버튼·링크·배지에 쓰지 않는다.
- **글자 크기**: 비율 1.25 하나로 16 · 20 · 25 · 31 · 39 · 49 · 61에서 멈춘다. 문서 H1 39px, 섹션 H2 31px, 소제목 25·20px이다. saas 히어로 H1은 61px(§21-1 56~72)이다.
- **대표 장면(Task 6 리뷰 M8 → Task 8 Step 1b)**: `signature` 1순위는 `doc-page`(세 구획 헤더 + 왼쪽 목차 · 본문 · 오른쪽 문서 내 목차, Gothic A1 800 제목)다. 공통 견본에는 이 레시피의 얼굴이 없어서 보드는 이 장면을 첫 장으로 찍는다. 2순위는 태그 옅은 짝이 있는 문서 목록이다.
- **AI 티 점수**: `/qa/recipes?r=r7-docs` 경고 모드 G **12**/239(kas 6/35) — r1 기준선 12와 같다(같은 빌드 대조 r1 12). 적중은 검수대 틀 쪽(G018·G078·G084·G088×4·G126·G135×3)이고 예외로 뺀 곳은 0이다. 무채 + 잉크 버튼이라 기본 shadcn과의 거리는 점수로 잡히지 않는다. 세 구획 헤더·문서 세 칸·태그 옅은 짝은 Task 8 보드 대표 장면으로 판정한다.
  - Task 6 fix 1 다시 잼(제목 굵기 반영·r7 종이 색·원형 축소 뒤): G **12**/239로 같다. 검수대 제목은 이제 레시피 굵기로 그려진다(r6 700, r7 800).

## 분위기

문서 작업대다. 첫 화면은 거의 검정 바탕에 초록 선 다발이 지나가고, 왼쪽에 둥근 세리프 제목 세 줄이, 오른쪽 아래로는 문서 앱 패널이 화면 끝까지 잘려 나간다. 숫자 칩의 초록 고정폭 숫자 하나가 눈을 잡는다. 문서 본문은 옅은 녹회 종이 위 짙은 청록 먹이고, 문서 머리 띠는 옅은 민트 면이다. 패널 카드는 한 장씩 겹쳐 내려앉는다. B안은 따뜻한 흰 바탕 왼쪽 4칸에 가는 디스플레이 세리프 네 줄을 세우고, 오른쪽 8칸에 앱 창과 그 위 살구색 공지 알약을 둔다.

## 쓰는 법

- 맞는 원형은 문서가 곧 제품인 SaaS(saas)와 문서형 모바일 앱(pwa)이다.
- 첫 화면은 히어로 `leaking-app-panel`(B안 `narrow-title-wide-window`)다.
  - A: 가운데 76% 폭 격자 왼쪽 7/24에 윤곽 칩(라벨 + 초록 고정폭 숫자) → 제목 세 줄(3.5vw, 400, 자간 -0.04em) → 부제 두 줄(핵심 낱말만 글자색) → 버튼 둘. 문서 앱 패널은 가로 41% · 세로 46%에서 시작해 오른쪽·아래 화면 끝으로 잘린다. 첫 화면은 레시피 다크 값의 구역(`DarkZone`)이다.
  - B: 12칸 중 왼쪽 4칸에 제목 네 줄(4.4vw, 행간 1.0) + 설명 세 줄 + 버튼 둘(반경 6px), 오른쪽 8칸에 창 폭 그대로의 공지 알약(field-1) → 반경 16px 앱 창.
- 헤더는 세 구획이다(N1b): 왼쪽 로고, 가운데 메뉴, 오른쪽 계정·주 버튼. 64px 헤어라인 바(H1)이고, 768px 이상에서 스티키다.
- 문서 화면은 왼쪽 목차 · 본문(한 줄 40자 이하) · 오른쪽 문서 내 목차 세 칸이다. 좁은 화면에서는 목차를 접는다.
- 제목은 `font-heading`이다: 라틴 Besley 400(B안 Libre Caslon Display), 한글 나눔스퀘어라운드(B안 자연산스). 둘 다 한글 제목체가 굵기 하나라 레시피 CSS가 굵기 합성을 끈다. 문서 H1 39px, 섹션 31px. 본문은 Pretendard 400 16px/1.7이다.
- 면: 문서 화면 왼쪽 목차의 머리 띠(제품 이름·버전 선택)와 랜딩 공지 칩·앱 패널의 선택 항목을 면(`bg-field-1`)으로 칠하고 **`data-face="field-1"`을 함께 단다**. 라이트 면은 옅은 민트(글자 짙은 청록, 대비 13.08), 다크 면은 칠판 청록(7.26), B안은 살구(10.28, 다크 짙은 호박 8.04)다. 문서 본문·표·코드 블록 뒤에는 면을 깔지 않는다.
- 본문 안의 색은 의미 태그에만 쓴다. 태그는 옅은 면 + 같은 의미색 글자이고, 글자는 늘 단어로 쓴다.
- 주 버튼은 먹 채움 하나다(B2, 6px). 보조는 외곽선, 세 번째부터는 링크 글자다. 링크는 먹 글자에 밑줄이다. 초록 링(`ring`)은 포커스와 숫자 칩·선택 탭에만 쓴다.
- 코드 블록·인라인 코드·kbd·`data-numeric` 숫자 칸·칩 숫자만 IBM Plex Mono다.
- pwa에서는 하단 탭바(3~5개, 아이콘 + 라벨)를 쓰고, 연결이 끊기면 행동 언어로 알린다(「인터넷 연결이 끊겼어요」). 오프라인에서 쓴 글은 「저장됨 · 연결되면 보냅니다」로 확인해 준다.
- 모션은 M2다(hover 200ms, 등장 500ms, 곡선 `cubic-bezier(0.22, 1, 0.36, 1)`). 문서를 읽는 자리에는 스크롤 등장 연출을 걸지 않는다(§8-1). 역동 기법 둘:
  - `sticky-stack` — 첫 화면 패널 카드(B안은 캔버스 카드)가 한 장씩 내려앉고, 먼저 온 카드가 다음 카드가 올 때 0.97로 한 번 물러났다 돌아온다. 랜딩 표지 아래 「이렇게 씁니다」 단계 카드 3~5장은 `position: sticky`로 겹쳐 쌓인다(40rem 미만에서는 일반 목록). 문서 화면에는 쓰지 않는다.
  - `view-transition` — 문서에서 문서로, 목록에서 문서로 옮길 때 문서 제목 한 요소만 이어지게 옮긴다.
  - 동작 줄이기에서는 카드가 처음부터 제자리에 있고, 쌓기는 위치만 남는다.

## 하지 말 것

- 크림·베이지 종이로 바꾸지 않는다. B안의 따뜻한 흰(`#FBFAF8`)도 C 0.012 아래다. 살구는 면(칩·알약·선택 항목)에만 있다.
- 면을 문서 본문·섹션마다의 띠·카드 채움으로 늘리지 않는다. 면 색은 하나이고, 본문 안의 색은 태그의 옅은 짝에만 있다.
- 초록 선 다발·앱 패널 뒤 그림 위에 글자를 올리지 않는다. 부제는 바탕 면 위에 둔다.
- 메타 라벨·캡션·날짜·태그에 고정폭 서체를 쓰지 않는다. 모노는 코드·kbd·숫자 칸·칩 숫자뿐이다.
- 태그를 색 점 하나로 표시하지 않는다. 태그에는 단어를 쓴다.
- 「01 / 02 / 03」 번호 라벨로 문서 절을 꾸미지 않는다.
- 세리프 제목을 부품 제목·버튼·표로 퍼뜨리지 않는다. 세리프는 첫 화면·문서·섹션 제목(20px 이상)에만 있다.
- 공공기관 누리집(public)에 쓰지 않는다(§21-8).

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r7-docs.md`. 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(수치 칩 + 세리프 세 줄 + 아래로 새는 문서 패널) · 카드 팔레트(`pal-sns-instagram-dwih2ynktud-1` + 측정값) · Besley + 나눔스퀘어라운드. 곡선 다발은 직접 그린 1px 선이고, 패널은 레시피 부품·토큰으로 새로 짰다(앱 스크린샷 복제 없음).
  - 카드 값에서 바꾼 것: **라이트 `field-1`을 카드의 칠판 청록 `#00664C`에서 옅은 민트 `oklch(0.90 0.075 152)`(글자 `#051F20`)로 옮겼다.** 카드 값은 r8-dusk A의 솔 면 `#00563E`와 색상각 2°·명도 0.05 차이라 `qa:distinct` 면 색 검사(색상각 30° 또는 |ΔL| 0.25)에 걸린다. 다크 `field-1`은 카드 값(`#005C44`) 그대로다 — 첫 화면은 다크 구역이라 측정 사이트의 짙은 바탕·초록 결이 그대로 보인다.
- B안 = 카드 수 2(4칸 제목 + 8칸 앱 창 + 창 위 공지 알약) · 새 팔레트: 측정 사이트 2의 먹 `#251D1A`·테라코타 `#C17B58` → 링 `#A35A38`(바탕 위 3:1 이상이 되도록 명도만 낮춤)·탠 알약 `#F6D3A0` → 면 `oklch(0.85 0.11 68)`(따뜻한 밝은 면의 크림 경계 C 0.1 위로 채도만 올림)·흰 바탕 `#FFFEFC` → `#FBFAF8` + SNS 팔레트 `pal-sns-instagram-dp8ni9wkfhu-4`(깊은 청록 `#203C3D` 주색 · 복숭아 `#FEDAB8` accent) · Libre Caslon Display + 자연산스. 측정 사이트의 크림 바탕 `#FAEBD7`은 쓰지 않았다.
  - 카드와 다르게 둔 것: 제목 굵기 800 대신 배정표 서체(Libre Caslon Display, 굵기 하나)의 가는 네 줄, 앱 스크린샷 대신 부품으로 짠 사이드바 나무와 연결된 카드 캔버스.
- 색 논리 K6·모션 M2·기법 `view-transition`·`sticky-stack`은 선택 보드 판정(Task 9) 그대로다. B안도 같은 K6이다.
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- layout-l08 : FAQ를 제목 왼쪽 1/3, 아코디언 오른쪽 2/3로 나누고 행을 헤어라인으로 구분한다(행 높이 56~64px, + 아이콘 오른쪽).
- component-saas-nav-top-bar-top-bar : saas 5곳이 1440·390 모두 상단 바 내비다. 세 구획 헤더를 좁은 화면에서도 상단 바로 둔다.
- color-palette-offwhite : 순백 대신 색이 살짝 든 오프화이트를 가장 밝은 면으로 쓴다(A 녹회 `#F6F8F6`, B 따뜻한 흰 `#FBFAF8` — 둘 다 크림 경계 아래).
- type-t01 : 한 패밀리 안에서 굵기 두 단계로 전 화면을 짠다. 본문 Pretendard 400·600, 제목만 세리프로 목소리를 바꾼다.
- pal-uupm-76 : 무채 먹 + 옅은 회색 면의 역할 배정(데이터셋 팔레트, Tailwind zinc 값은 복사하지 않았다).
- pal-sns-instagram-dwih2ynktud-1 : 초록 단색 사다리 — A안 글자·주색·accent·다크 주색의 근거.
- pal-sns-instagram-dp8ni9wkfhu-4 : 복숭아 + 깊은 청록 두 톤 — B안 accent·주색의 근거.
