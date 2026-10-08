---
id: r6-civic
name: 공공 신뢰
mood: [공식, 명료, 신뢰]
axes: { button: B2, input: I1, surface: C1, table: T2, header: H1, radius: R2, shadow: S0 }
motion: M1
colorLogic: K6
dynamics: [view-transition, svg-draw]
signature: [hero, notice-list]
hero: identity-strip-banner
alternates:
  colorLogic: K6
  color:
    light:
      background: "oklch(1.0000 0.0000 0.00)"
      foreground: "oklch(0.2018 0.0168 252.54)"
      card: "oklch(1.0000 0.0000 0.00)"
      card-foreground: "oklch(0.2018 0.0168 252.54)"
      popover: "oklch(1.0000 0.0000 0.00)"
      popover-foreground: "oklch(0.2018 0.0168 252.54)"
      primary: "oklch(0.5315 0.2423 264.28)"
      primary-foreground: "oklch(1.0000 0.0000 0.00)"
      secondary: "oklch(0.9695 0.0045 258.32)"
      secondary-foreground: "oklch(0.2018 0.0168 252.54)"
      muted: "oklch(0.9695 0.0045 258.32)"
      muted-foreground: "oklch(0.4137 0.0141 252.24)"
      accent: "oklch(0.9282 0.0288 277.23)"
      accent-foreground: "oklch(0.2018 0.0168 252.54)"
      border: "oklch(0.8588 0.0071 247.91)"
      input: "oklch(0.5669 0.0203 245.59)"
      ring: "oklch(0.5315 0.2423 264.28)"
      field-1: "oklch(0.3934 0.1505 264.14)"
      field-1-foreground: "oklch(1.0000 0.0000 0.00)"
    dark:
      background: "oklch(0.1900 0.0181 259.70)"
      foreground: "oklch(0.9573 0.0074 260.73)"
      card: "oklch(0.2252 0.0216 260.53)"
      card-foreground: "oklch(0.9573 0.0074 260.73)"
      popover: "oklch(0.2252 0.0216 260.53)"
      popover-foreground: "oklch(0.9573 0.0074 260.73)"
      primary: "oklch(0.7321 0.1377 265.76)"
      primary-foreground: "oklch(0.1900 0.0181 259.70)"
      secondary: "oklch(0.2418 0.0235 259.32)"
      secondary-foreground: "oklch(0.9573 0.0074 260.73)"
      muted: "oklch(0.2418 0.0235 259.32)"
      muted-foreground: "oklch(0.7934 0.0187 261.33)"
      accent: "oklch(0.2747 0.0497 269.93)"
      accent-foreground: "oklch(0.9282 0.0288 277.23)"
      border: "oklch(0.3383 0.0276 259.14)"
      input: "oklch(0.6106 0.0270 259.81)"
      ring: "oklch(0.7321 0.1377 265.76)"
      field-1: "oklch(0.3982 0.1415 265.66)"
      field-1-foreground: "oklch(1.0000 0.0000 0.00)"
  fonts:
    display: { family: "Unbounded", item: font-unbounded, weight: 700, tuned: "대안 라틴·숫자 전용 넓은 기하 제목(자체 서체는 디스플레이·배너에만 — §21-8). 굵기 700(KRDS 제목 굵기), 크기는 KRDS display 60·44·36px 중에서만, 행간 150%·자간 KRDS 토큰. 첫 화면 H1 60px 세 줄. 한글 제목은 Pretendard GOV 700으로 떨어진다(한글 제목체를 두지 않는다 — §21-8)" }
  hero: crosshair-quadrants
  note: "DNA 수 1(십자 기준선 4분면) — 카드 팔레트 그대로(pal-sns-instagram-dpbpoicj3j4-1 + 측정값) · Unbounded(한글은 Pretendard GOV). 색 논리 K6·모션 M1·기법 view-transition·svg-draw 는 새 기본과 같다. 선택 보드 3판(2026-09-28)에서 운영자가 B(식별 띠 + 짙은 배너 카드)를 pick 하며 「움직임은 단순하지만, 깔끔해서 오히려 좋아」라 적어, B가 머리로 올라가고 이 안은 대안으로 남는다"
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Fragment Mono", item: font-fragment-mono, weight: 400, weightKo: 700, tuned: "라틴·숫자 전용 고정폭(굵기 400 하나 — 키트 항목에 400뿐이라 레시피 CSS 가 굵기 합성을 끈다). 접수번호·날짜·단계 라벨과 배너 머리 한 줄에만, 대문자 자간 0.04em. 한글 제목(Pretendard GOV)은 한글 제목 굵기 weightKo 700(--wf-heading-weight-ko, 진짜 700 면)이고, 한글만 있는 큰 제목은 font-heading-ko(본문 서체 스택)로 그려 고정폭 공백·쉼표가 끼지 않는다. 부품 제목 칸은 본문으로" }
  body: { family: "Pretendard GOV", item: font-pretendard-gov, tuned: "본문 17px/1.5 굵기 400(KRDS body medium), 강조는 700, 필요할 때만 500. 본문 small 15px까지 쓰고 KRDS body xsmall 13px은 쓰지 않는다(§2 14px 바닥). 날짜·건수는 tabular-nums" }
  mono: null
color:
  light:
    background: "oklch(0.9970 0.0000 0.00)"
    foreground: "oklch(0.2459 0.0072 248.12)"
    card: "oklch(1.0000 0.0000 0.00)"
    card-foreground: "oklch(0.2459 0.0072 248.12)"
    popover: "oklch(1.0000 0.0000 0.00)"
    popover-foreground: "oklch(0.2459 0.0072 248.12)"
    primary: "oklch(0.4200 0.2011 261.59)"
    primary-foreground: "oklch(1.0000 0.0000 0.00)"
    secondary: "oklch(0.9662 0.0034 247.86)"
    secondary-foreground: "oklch(0.2459 0.0072 248.12)"
    muted: "oklch(0.9662 0.0034 247.86)"
    muted-foreground: "oklch(0.4137 0.0141 252.24)"
    accent: "oklch(0.8855 0.0305 235.67)"
    accent-foreground: "oklch(0.2599 0.0604 251.32)"
    destructive: "oklch(0.53 0.19 27)"
    border: "oklch(0.8645 0.0088 247.93)"
    input: "oklch(0.5617 0.0189 250.97)"
    ring: "oklch(0.4200 0.2011 261.59)"
    success: "oklch(0.52 0.12 150)"
    success-foreground: "oklch(0.99 0.005 150)"
    warning: "oklch(0.54 0.13 58)"
    warning-foreground: "oklch(0.99 0.005 58)"
    info: "oklch(0.5 0.11 238)"
    info-foreground: "oklch(0.99 0.004 238)"
    field-1: "oklch(0.3100 0.0850 260.00)"
    field-1-foreground: "oklch(1.0000 0.0000 0.00)"
  dark:
    background: "oklch(0.1861 0.0294 259.81)"
    foreground: "oklch(0.9570 0.0063 255.48)"
    card: "oklch(0.2256 0.0323 260.34)"
    card-foreground: "oklch(0.9570 0.0063 255.48)"
    popover: "oklch(0.2256 0.0323 260.34)"
    popover-foreground: "oklch(0.9570 0.0063 255.48)"
    primary: "oklch(0.7611 0.1216 264.09)"
    primary-foreground: "oklch(0.1861 0.0294 259.81)"
    secondary: "oklch(0.2422 0.0341 259.57)"
    secondary-foreground: "oklch(0.9570 0.0063 255.48)"
    muted: "oklch(0.2422 0.0341 259.57)"
    muted-foreground: "oklch(0.7919 0.0197 255.55)"
    accent: "oklch(0.2914 0.0513 257.90)"
    accent-foreground: "oklch(0.8855 0.0305 235.67)"
    destructive: "oklch(0.7 0.15 25)"
    border: "oklch(0.3369 0.0326 255.75)"
    input: "oklch(0.6135 0.0289 259.04)"
    ring: "oklch(0.7611 0.1216 264.09)"
    success: "oklch(0.74 0.12 150)"
    success-foreground: "oklch(0.19 0.02 150)"
    warning: "oklch(0.8 0.13 70)"
    warning-foreground: "oklch(0.2 0.03 70)"
    info: "oklch(0.74 0.1 238)"
    info-foreground: "oklch(0.19 0.02 238)"
    field-1: "oklch(0.3300 0.0850 262.00)"
    field-1-foreground: "oklch(1.0000 0.0000 0.00)"
references:
  - type-public-korean-font
  - type-public-h1-ratio-low
  - component-public-nav-top-bar-top-bar
  - layout-public-first-cta-early
  - pal-sns-instagram-dpbpoicj3j4-1
  - pal-sns-instagram-dudjznijp9d-4
archetypes: [public]
---

## 선택 보드 3판 판정 (2026-09-28)

- 선택 보드 3판(2026-09-28)에서 운영자가 A(십자 기준선 4분면)를 「움직임이 너무 단순해.」로 부분 별로를 매기고, B(식별 띠 + 짙은 배너 카드)를 「움직임은 단순하지만, 깔끔해서 오히려 좋아」로 pick 했다. 결정 원본은 `factory/board/recipe-board3-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- 이 판정으로 B(식별 띠·유틸리티 줄·메가메뉴 아래 반경 8px 짙은 남색 배너 카드, 히어로 `identity-strip-banner`)를 머리 기본값으로 승격했다. 색 논리 K6·기법 `view-transition`·`svg-draw`는 그대로다 — 바뀌는 축은 색·서체·히어로다.
- A(십자 기준선 4분면, 히어로 `crosshair-quadrants`)는 `alternates`로 남긴다.
- 「움직임은 단순하지만 깔끔해서 좋다」는 신호에 맞춰, 대안(십자 기준선 4분면)의 첫 화면에 기존 `svg-draw` 기법을 늘린 인장선 한 겹을 더했다(아래 「쓰는 법」 참고) — 새 기법 id를 늘리지 않고 모션도 M1 그대로다(M-level 정직: 이 정도 겹은 M2로 올릴 만큼 크지 않다). 그 밖의 등장·전환은 그대로 절제한다.
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 이제 새 기본(옛 B)을 먼저 적고, 대안(옛 A)을 그 뒤에 적는다.

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체 — 색 논리·기법, 이 레시피의 B에는 모션 대안이 없다)** — 색 논리 K1 → **K6 정부 파랑 띠**, 역동 기법 `view-transition` → **`view-transition`·`svg-draw`**. 모션은 M1 그대로다(public은 M3 금지 원형이다). 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 머리로 옮긴 색(보드 B 값 그대로): 라이트 `field-1` 옅은 정부 파랑 `0.87 0.06 258`·`field-1-foreground` 남색 `0.21 0.03 260`, 다크 `field-1` 짙은 파랑 `0.32 0.1 262`·글자 `0.96 0.01 262`. 흰 바탕·남청 먹 주 버튼·파랑 링크·상태색은 A 그대로다. `alternates`는 지웠다.
- 대비(lint와 같은 `contrast-lib ratio`): 라이트 면 글자/면 11.98, 다크 11.45. 면 위 조작은 `[data-face="field-1"]` 스코프가 면 짝 색으로 다시 가리킨다(lint `face-contrast` 통과, 경고 0).
- 바뀐 것: 아래 결정 기록의 「파랑 하나가 링크와 선택된 것을 가리킨다」(K1) 판단은 A안의 것으로 남긴다. 파랑은 이제 첫 화면 띠의 면으로도 나온다 — 같은 파랑 묶음(258~262°) 안이라 「강조색 하나」는 그대로다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. KRDS 헤더·푸터 순서·글자 토큰·R2 크롬은 그대로다.
- AI 티 점수(반영 뒤 다시 잼, 같은 빌드 r1 대조 12): G **12**/239(kas 8/35) — 기준선과 같다.
- 갤러리 관문(반영 뒤): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 6)

방향 원천은 style_axes 「레시피 방향 후보」 N4(인증·문서 신뢰)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r6-civic 줄을 따랐다. 색 한 값(primary = ring)만 선정서에서 옮겼다(아래 「색 이동」). DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

- **B안 식별 띠(Task 10d fix, 2026-09-28 — 리뷰 b2 M9)**: 공식 배너 대체 띠 — 실제 기관 적용 시 공식 문구로 교체. 가상 기관 예시에서는 공식 배너와 같은 자리·모양의 띠에 「예시 — 공식 전자정부 누리집이 아닙니다」를 적는다(§21-8: 공식 정부 서비스가 아니면 공식 배너 문구를 쓰지 않는다). 띠는 머리 밖이라 머리를 고정해도 따라 붙지 않는다.
- **KRDS 적용 수준(§21-8 SHOULD — 결정 기록 맨 위)**: 레시피는 **표준형**을 기본으로 둔다. 기관 유형(중앙행정기관 대표 / 운영서비스·시스템 / 공공기관 / 지방자치단체)은 브리프마다 다르므로 찍어내기(P3-3)가 브리프에서 판정한다. 공식 배너 「이 누리집은 대한민국 공식 전자정부 누리집입니다.」는 공식 정부 서비스일 때만 두고, 공식 정부 서비스가 아닌 공공기관 누리집에서는 두지 않는다. 운영기관 식별자도 같다.

| 칸 | A KRDS 한 가족 (고름) | B 빨강·파랑 두 강조 (남김, 안 씀) | C 남보라 그라디언트 + 글래스 (버림) |
|---|---|---|---|
| 분위기 3단어 | 공식 · 명료 · 신뢰 | 공식 · 긴박 · 알림 | 혁신 · 미래 · 매끈 |
| 축 | B2 I1 C1 T2 H1 R2 S0, M1 | B2 I1 C1 T2 H1 R2 S0, M1 | B4 I2 C5 T2 H2 R1 S1, M2 |
| 서체 짝과 이유 | Pretendard GOV 한 가족(제목 700·본문 400). §21-8 「국·영문 모두 Pretendard GOV 한 가족」 그대로다 | 같은 가족 | 기하 산세리프 제목 + Pretendard |
| 색 3개 + 강조 1 | 흰 바탕 · 남청 먹 글자 · 옅은 파랑 면 + KRDS 파랑 262° 1(면적 약 10%) | 흰 바탕 · 먹 · 회색 + 파랑 + 빨강 | 남색→보라 그라디언트 · 흰 글자 · 반투명 면 |
| 사진·그림 | 실제 현장 사진(시설·행사), 픽토그램은 lucide 한 가족 | 같은 사진 | 3D 오브·추상 그래픽 |
| 이 안에서만 나오는 레이아웃 | 공식 배너 → 로고·유틸리티·검색·메뉴(N12, 2행 헤더는 스크롤을 올릴 때만) + 「자주 찾는 서비스」 바로가기 + 날짜·담당 부서가 붙은 공지 목록 | 같은 틀 + 빨간 긴급 띠 | 가운데 히어로 + 글래스 카드 3장 |
| 레퍼런스 2개 | type-public-korean-font · KRDS 메인 견본(주소는 적지 않는다) | component-public-nav-top-bar-top-bar · layout-public-first-cta-early | 없음(상투 조합) |

- **버린 안: C.** 남색→보라 그라디언트는 §13 첫 줄이고, 글래스 카드는 「모든 표면 글래스」다. C5(글래스)는 호환표가 public 원형에서 막는다.
- **남긴 안: B.** 상투 표에는 걸리지 않는다. 그러나 강조가 둘이면 빨강 강조가 오류색과 섞이고, KRDS 「강조색은 면적 5% 이하」와 부딪힌다. **빨강은 오류(destructive)에만 쓴다.** 긴급 공지의 긴급도는 레이블 글자(상·중·하)와 아이콘이 맡고, 색은 의미색을 쓴다(§21-8 긴급 공지).
- **고른 안: A.** 방문자 모드는 「목적별로 필요한 민원·정보에 빨리 닿기」다(§21-8). 메인은 이용 데이터 순서로 짠다. 첫 화면에 「자주 찾는 서비스」 바로가기를 두고, 같은 목적의 공지·안내는 제목과 한 줄 안내가 있는 한 섹션으로 모은다.
- **색 이동(Task 5 리뷰 · 컨트롤러 판정 「r6가 옮긴다」)**: 선정서의 primary = ring `0.48 0.16 258`은 r1-measure의 ring `0.47 0.15 255`와 OKLab 0.016으로 같은 파랑이었다. primary = ring을 `0.55 0.2 262`로 옮겼다.
  - 원천은 KRDS 주 색 primary-50(`#256EF4` = `0.575 0.214 261`)의 색상각이다. `#256EF4` 위 순백 글자는 4.55:1(sRGB 직접 계산)로 4.5를 넘는다. L을 낮춘 이유는 반대 방향이다: 이 레시피 바탕 `0.99` 위에 `#256EF4`를 **링크 글자**로 쓰면 4.42:1로 4.5에 못 미친다(Button·Badge `link` 변형이 `text-primary`다). L만 0.55로 낮춰 바탕 위 링크 글자와 `primary-foreground`(`0.99`) 위 글자가 둘 다 4.9:1이다.
  - r1 ring과 색상각 차는 7°뿐이다. 대신 L이 0.08 밝고 C가 0.05 높다(OKLab 0.097). r1의 파랑은 채도가 낮은 청회 계열의 포커스 링이고, r6은 채도 높은 관청 파랑이다. qa:distinct에서는 r1 primary가 무채(`0.24 0.02 255`)라 primary만으로 「색 다름」이 된다.
  - 색상각을 30° 옮기면 225°(r4-evidence 215° 옆 청록) 아니면 285°(§13 보라·`indigo-500` 쪽)가 된다. 둘 다 공공 파랑이 아니라서 L·C로 떼었다.
  - Tailwind 기본 스케일과는 blue-600·700 모두 0.005 밖이다(lint `palette-tailwind` 통과).
- **주 버튼은 파랑이 아니다(B2)**: B2는 주 버튼을 잉크(`--foreground`, 남청 먹 `0.21 0.03 260`)로 채운다. KRDS 버튼 규격의 주 버튼은 주 색 채움이라 이 점이 KRDS와 다르다. 남청 채움은 관공서에서 흔한 주 버튼 색이라 받아들였다(Task 6 리뷰 3절). 파랑 면적 약 10%는 링크 글자, 선택 탭·메뉴, 체크·라디오·스위치, 진행 막대, 「자주 찾는 서비스」 아이콘, 「새 글」 배지, 포커스 링이 채운다.
- **뒤집는 조건(Task 6 리뷰 M9 — 기록만 한다)**: 브리프가 KRDS 준수 누리집(공식 전자정부·공공기관·지자체 표준형)이거나, Task 8 보드에서 잰 파랑 면적이 약 10%에 크게 못 미치면 이 레시피의 버튼 축을 B3(주 버튼 = `--primary` 채움, 44px)로 바꾼다. 그때는 T2도 T3로 함께 바꾼다 — B3만 바꾸면 r4-evidence(B3 I1 C1 T2 H1 R2 S1)와 축이 1개(S)만 달라 qa:distinct가 실패한다. B3 + T3이면 r4와 T·S, r7-docs와 B·I 두 축이 다르다. 이 교체는 레시피 원천을 고치는 일이다. 찍어내기가 글로 읽고 바꾸는 교체가 아니다.
- **KRDS 토큰 대응**
  - 색: 주 색(파랑 262°, 면적 약 10%)과 강조(새 글·중요 배지 — secondary 옅은 파랑 면 + 남색 글자, 면적 5% 이하)는 같은 파랑 묶음 안의 다른 단계다. 강조에 두 번째 색상각을 쓰지 않는다. 의미색은 성공 150°·경고 58°·오류 27°·정보 238°다.
  - 글자: 행간 150%, 제목 700·본문 400, display 60·44·36 · heading 40·32·24·19·17 · body 19·17·15px. §2의 한 비율 규칙 대신 이 토큰을 쓴다(§21-8 MUST). 13px은 쓰지 않는다.
  - 포커스: 링은 주 색 262°(바탕 대비 4.9:1, 불투명 2px — 공장 규칙). 선명한 화면 모드를 둘 때는 본문 15:1·제목 7:1을 따로 채운다(§21-8 SHOULD).
  - 레이아웃: 브레이크포인트 360·768·1024·1280px, 칼럼 4·8·12·12, 거터 16·16·24·24px, 최소 화면 여백 16·24·24·24px, 콘텐츠 최대 1200px(§21-8 SHOULD).
- **local 원형에서 뺐다(Task 6 리뷰 I2 · 컨트롤러 판정)**: 선정서는 local(의료)에 쓸 때 제목 서체를 따로 고르라고 했다(M6 — 관청 파랑 + 한 가족은 병원에서 §14-D 「제목까지 하나면 기본값」). 그러나 그 교체를 레시피 본문 글로만 두면 기계가 읽지 못한다. `ai/tasks/local.json`은 이 레시피를 local 후보로 그대로 추천하고, 설치하면 관청 파랑 + Pretendard GOV 한 가족이 병원에 깔린다. 그래서 원형을 public 하나로 줄였다. 병원·의원 같은 local은 이 레시피를 쓰지 않는다(r3-woodblock, 예정 r8-dusk).
- **팔레트 인용**: `pal-sns-instagram-dpbpoicj3j4-1`은 보강하지 않은 팔레트다(augmented 아님). 주색 `#1F57F5`(`0.53 0.24 264`)의 「신뢰 파랑」 색상각만 참고했고, 둘째 강조 시안 `#00DDFF`는 가져오지 않았다(강조 하나). 채도는 0.2로 낮췄다.
- **서체**: Pretendard GOV는 SIL OFL 1.1이다(npm `pretendard-gov@1.3.9`, 키트 항목 `font-pretendard-gov`, 2026-09-27 판정). §13·banlist에 없다. `meta.aliasOf: font-pretendard`는 레시피 차이 검사에서만 Pretendard와 한 서체로 묶는 표시다. 실제로 싣는 것은 GOV 파일이다. **한글 제목 서체는 Pretendard GOV 700**이다(선정서 M5). 가변 서체라 400·500·700을 합성 없이 그린다. 로더는 하나다(css `@import` 1).
- **아이콘**: lucide(키트 항목 `icons-lucide`), 결 G1(외곽선 2px, 둥근 끝). 헤더 아이콘 버튼에는 보이는 레이블을 붙인다(검색·로그인만 예외, §21-8).
- **색 수 판단**: `refs-v2/samples.jsonl`에서 public 19곳은 모두 유채색 3개 이상이다(중앙값 8). 그러나 S 0.999 표본인 KRDS 정본 누리집은 유채 3개다. 이 표본의 `dominantHue` 220은 페이지 전체에서 가장 넓은 유채색의 색상각을 잰 값이다. KRDS 주 색 토큰(primary-50, 261°)과는 다른 값이다. 나머지 유채는 의미색이다. 그래서 강조는 파랑 하나로 두고, 공공 누리집의 다색은 의미색 4종이 맡게 했다. 색상각 묶음(§5-A, C ≥ 0.05)은 파랑 238~262° 하나와 차트 비교 계열 주황 55° 하나, 둘이다. 주황은 데이터 색이라 버튼·배지·링크에 쓰지 않는다.
- **대표 장면(Task 6 리뷰 M8 → Task 8 Step 1b)**: `signature` 1순위는 `notice-list`(날짜·담당 부서·「새 글」 배지가 붙은 공지 목록)다. 공통 견본에서는 이 레시피가 「r7 + 파란 링크」로 읽혀서, 보드는 이 장면을 첫 장으로 찍는다. 2순위는 자주 찾는 서비스 바로가기다.
- **AI 티 점수**: `/qa/recipes?r=r6-civic` 경고 모드 G **12**/239(kas 7/35) — r1 기준선 12와 같다(같은 빌드 대조 r1 12). 적중은 검수대 틀 쪽(G018·G078·G084·G088×4·G126·G135×2)이고 예외로 뺀 곳은 0이다. 이 레시피만의 적중은 없다. 크롬(C1·S0·B2)이 기본 shadcn에 가까워 §13 「UI 키트 기본 테마 그대로」 위험은 점수가 아니라 Task 8 보드 대표 장면(공식 배너·자주 찾는 서비스·공지 목록)으로 판정한다.
  - Task 6 fix 1 다시 잼(제목 굵기 반영·r7 종이 색·원형 축소 뒤): G **12**/239로 같다. 검수대 제목은 이제 레시피 굵기로 그려진다(r6 700, r7 800).

## 분위기

가상 기관 식별 띠·유틸리티 줄·메가메뉴 아래, 폭 1200px 안쪽 반경 8px 짙은 남색 배너 카드 한 장이 첫 화면을 채운다. 왼쪽 6칸에 고정폭 머리 한 줄·한글 제목(44px, 700)·부제 두 줄·버튼이 서고, 오른쪽 6칸에 직접 그린 아이소메트릭 서류 더미와 확인 도장이 앉는다. 배너 바로 아래 「자주 찾는 서비스」가 이어진다. 한글은 모두 Pretendard GOV이고, 라틴·접수번호는 고정폭 Fragment Mono다. 대안(`alternates`)은 도면처럼 정돈된 화면이다 — 흰 바탕을 1px 기준선 두 개가 넷으로 나누고, 교차점에 파랑 「+」 하나가 찍힌다. 왼쪽 아래 칸에 넓은 기하 라틴 제목(Unbounded) 두 줄이 앉고, 오른쪽 위에는 옅은 보라빛 점 격자 원 위에 신청 단계 판이, 오른쪽 아래에는 자주 찾는 서비스 여섯 칸이 놓인다. 남색 면은 이 안에서도 첫 화면 배너 한 곳뿐이다.

## 쓰는 법

- 맞는 원형은 공공기관 누리집(public)이다. KRDS 표준형을 따른다(§21-8).
- 첫 화면은 히어로 `identity-strip-banner`(대안 `crosshair-quadrants`)다.
  - 기본: 폭 1200px 안쪽 반경 8px 남색 면 배너 — 왼쪽 6칸에 고정폭 머리 한 줄 · 한글 제목(44px, 700) · 부제 두 줄 · 높이 64px 버튼, 오른쪽 6칸 그림. 배너 바로 아래 「자주 찾는 서비스」. 맨 위 띠는 가상 기관의 식별 띠다 — 공식 전자정부 배너 문구를 쓰지 않는다.
  - 대안: 기준선 교차점은 세로 50% · 가로 44%. 좌하 칸에 제목 두 줄(KRDS display 60px, 행간 150%) → 설명 → 버튼 둘(반경 0). 우상 칸의 신청 단계 판은 바탕 면 위에 두어 점 격자가 글자 뒤로 오지 않게 한다.
- 헤더 순서는 건너뛰기 링크 → 공식 배너(공식 정부 서비스만) → 로고(왼쪽 위) → 유틸리티 링크(오른쪽 위, 디바이더) → 검색 → 메인 메뉴다. 고정할 때는 공식 배너를 빼고 고정하고, 2행을 넘는 헤더는 스크롤을 올릴 때만 보인다(N12).
- 헤더 유틸리티에 글자 크기 조정(90·100·110·130%, 배율 숫자와 설명 레이블)을 둔다. 130%에서도 가로 스크롤이 없어야 한다.
- 서체: 한글 제목·본문은 Pretendard GOV(제목 700, 본문 400 17px/150%). 라틴·숫자 디스플레이는 Fragment Mono 400(대안 Unbounded 700)이고, 첫 화면 제목·배너 머리·접수번호·통계 숫자에만 쓴다(자체 서체는 디스플레이·배너에만 — §21-8). 크기는 KRDS 토큰 display 60·44·36 · heading 40·32·24·19·17 · body 19·17·15px 안에서만, 13px은 쓰지 않는다.
- 첫 화면 안에 「자주 찾는 서비스」 바로가기(방문 목적별 4~8개, 아이콘 + 두 단어 이내 레이블)를 둔다. 첫 CTA는 첫 화면에 온다(layout-public-first-cta-early).
- 면: 첫 화면 배너·대표 안내 띠 한 곳을 남색 면(`bg-field-1`, 글자 `text-field-1-foreground`)으로 깔고 **`data-face="field-1"`을 함께 단다** — 그 안의 링·주 버튼·보조 글자가 면의 짝 색으로 바뀐다(면 위 주 버튼은 흰 채움 + 남색 글자). 면 글자 대비 13.26(다크 12.33), 대안 9.79(다크 9.57). 공지 목록·본문·푸터는 흰 바탕이다.
- 주 버튼은 먹 채움 하나(B2)다. 보조는 외곽선, 세 번째부터는 링크 글자다. 링크는 파랑 글자에 밑줄이다. 파랑(`#1D5FDB`, 대안 `#1F57F5`)은 링크·선택 탭·단계 진행선·「+」·바로가기 아이콘·포커스 링이 채운다(면적 약 10%).
- 공지·보도자료 목록은 행마다 제목, 날짜(`2026. 9. 27.` 한 형식), 담당 부서를 붙이고, 새 글은 「새 글」 배지로 표시한다. 행은 헤어라인(C1), 높이 48px(T2)다.
- 긴급 공지는 메인 메뉴와 히어로 사이에 전체 폭 하나만 둔다. 긴급도 레이블(상·중·하) + 아이콘 + 한 줄 문장 + 링크 하나, 색은 의미색이다. 숨기기 버튼을 두지 않는다.
- 푸터는 서비스 로고 → 연락처 → 유틸리티 링크 → 정책 링크 → 저작권 → 운영기관 식별자 순서다. 「개인정보 처리방침」은 이 이름 그대로 굵게 구분한다.
- 레이아웃은 KRDS 표준형 토큰(360·768·1024·1280px, 칼럼 4·8·12·12, 거터 16·16·24·24px, 최대 1200px)으로 짠다.
- 모션은 M1이다(hover 150ms, 등장 300ms). 캐러셀은 자동으로 돌리지 않는다. 역동 기법 둘:
  - `svg-draw` — 신청 단계 표시의 연결선을 현재 단계까지 긋는다(400ms ease-in-out, `pathLength="1"`), 지나온 단계 점은 150ms에 칠해진다. 대안(십자 기준선)에서는 기준선이 가운데서 한 번 펼쳐지고, 기본(배너)에서는 배너 그림의 선을 한 번 긋는다. 글자·레이블이 먼저 보이고 선은 거들기만 한다.
    - **3판(2026-09-28) 추가 — 대안(십자 기준선) 전용 인장선.** 신청 단계 판의 연결선이 지금 단계(「검토」)에 닿을 무렵, 그 점 둘레에 지름 28px 원 하나를 같은 `svg-draw` 기법(`pathLength="1"`)으로 한 번 긋는다(`--duration-enter` x 1.1, `--ease-standard`) — 공식 확인 도장처럼 「이 단계가 지금」을 조용히 확정하는 한 겹이다. 반복하지 않는다. 기본(배너)에는 이 인장선이 없다 — 대안(십자 기준선)에만 있다.
  - `view-transition` — 공지 목록에서 상세로 갈 때 제목 한 요소만 이어지게 옮긴다(`view-transition-name`은 요소 하나에 하나).
  - 동작 줄이기에서는 선이 처음부터 완성돼 있고 점 색은 바로 바뀐다.

## 하지 말 것

- 한글 제목을 장식 서체로 바꾸지 않는다. 한글은 Pretendard GOV뿐이고, Unbounded·Fragment Mono는 라틴·숫자에만 있다(§21-8).
- KRDS 크기 토큰 밖의 제목 크기(예: 5vw 유동 제목)를 쓰지 않는다. 첫 화면 제목도 display 60px에서 멈춘다.
- 빨강을 강조·장식에 쓰지 않는다. 빨강은 오류와 긴급 공지의 「상」 등급에만 있다.
- 강조색을 둘로 늘리지 않는다. 점 격자·「+」·단계선·새 글 배지 모두 파랑 묶음 안의 다른 단계다.
- 남색 면을 배너 밖으로 늘리지 않는다. 섹션마다 면을 번갈면 공지 목록의 위계가 흐려진다.
- 점 격자·그림 위에 글자를 바로 올리지 않는다. 글자는 바탕 면(판) 위에 둔다.
- 남색→보라 그라디언트, 글래스 카드, 3D 오브·정부 표장을 흉내 낸 그림을 쓰지 않는다(§13).
- 공식 정부 서비스가 아닌 누리집에 공식 배너 문구를 달지 않는다.
- 메인 캐러셀을 자동 회전시키지 않는다. 기관이 요구하면 KRDS 조건(정지 버튼이 캐러셀 안 첫 Tab)을 지킨다.
- 헤더 아이콘 버튼을 레이블 없이 두지 않는다(검색·로그인 예외). 로고 alt에 「로고」를 붙이지 않는다.
- 인장선을 목적 없이 장식으로 쓰지 않는다. 대안(십자 기준선)의 지금 단계 점 둘레, 한 번뿐이다.
- 병원·의원(local)에 쓰지 않는다(§14-D).

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r6-civic.md`. 레시피에는 사이트 이름을 적지 않는다.
- 기본 = 카드 수 2(식별 띠 + 둥근 짙은 배너 카드) · 새 팔레트: 측정 사이트 2의 흰 바탕 `#FEFEFE`·본문 글자 `#1E2124`·설명 글자 `#464C53`·버튼 파랑 `#256EF4` → 주색 `#1D5FDB`(바탕 위 링크 글자 4.5 이상이 되도록 명도만 낮춤)·배너 남색 `#1B2C45`·`#1F3760` → 면 `oklch(0.31 0.085 260)`(K6 짙은 면 대역 C 0.08 이상으로 채도만 올림) + SNS 팔레트 `pal-sns-instagram-dudjznijp9d-4`(남색 `#0A2540` accent 글자 · 하늘 `#C7DDEB` accent) · 라틴 Fragment Mono(한글은 Pretendard GOV).
  - 카드와 다르게 둔 것: 3D 그림 대신 직접 그린 아이소메트릭 서류 더미와 확인 도장, 배너 버튼은 파랑 대신 면 위 흰 채움(B2 — 면 스코프의 주 버튼), 기관 식별 띠는 공식 배너가 아니라 「가상 기관 예시」 문구.
  - 머리(Task 10d fix — §21-8): 측정 사이트의 세 줄 머리(유틸리티 · 로고+검색 · 메가메뉴) 대신 두 줄 — 로고·유틸리티(English · 글자 크기)·통합검색 / 메가메뉴. DOM 순서는 로고 → 유틸리티 → 검색 → 메뉴이고, 두 줄이라 고정한다. 글자 크기 조정은 모든 폭에 보이고, 1024 아래에서는 메뉴 단추가 주 메뉴를 펼친다. 메가메뉴 항목은 실제 펼침 단추(하위 링크 판)다.
  - 제목 굵기: 머리 `display.weight` 는 400(Fragment Mono 키트 항목에 있는 유일한 굵기, 레시피 CSS 가 합성을 끈다) — 한글 제목(Pretendard GOV)은 머리 `display.weightKo` 700 — 한글 제목 굵기 `--wf-heading-weight-ko`(`.font-heading`·`.font-heading-ko` 가 이것을 먼저 읽는다)이고, 라틴 Fragment Mono 는 면이 400 하나뿐이고 합성을 꺼서 늘 진짜 400으로 그려진다. 한글만 있는 첫 화면 제목과 「자주 찾는 서비스」 제목은 `font-heading-ko`(본문 GOV 스택 + 700)로 그린다 — `font-heading` 이면 제목 스택 첫 서체 Fragment Mono 가 공백·쉼표를 고정폭으로 그려 375에서 제목이 세 줄이 된다(Task 14c, v0.0.5·보드 3판에서 운영자가 본 모양으로 되돌림).
- 대안 = 카드 수 1(십자 기준선 4분면) · 카드 팔레트 그대로(`pal-sns-instagram-dpbpoicj3j4-1` + 측정값) · Unbounded(한글은 Pretendard GOV). 점 격자 원은 CSS 점(radial-gradient)이고 신청 단계 판·바로가기는 레시피 부품·토큰으로 새로 짰다.
  - 카드와 다르게 둔 것: 제목 크기 5.2vw·행간 0.9 대신 KRDS display 60px·행간 150%(두 줄), 굵기 500 대신 KRDS 제목 굵기 700, 주 버튼 파랑 채움 대신 먹 채움(B2). 우하 칸은 비어 있던 자리에 「자주 찾는 서비스」를 두었다(§21-8 MUST).
  - 머리(Task 10d fix — §21-8): DOM 순서 로고 → 유틸리티(글자 크기) → 검색 → 메인 메뉴. 글자 크기 조정은 모든 폭에 보인다. 1280 아래는 로고·검색·메뉴 단추 / 글자 크기 두 줄이고 메뉴 단추가 주 메뉴를 펼친다. 1280 이상은 오른쪽 절반에 메뉴 두 줄(카드의 세 줄 대신 — 머리를 두 줄에 맞춘다)과 유틸리티·검색 / 신청 버튼. 처리 건수·접수번호는 제목 서체가 아니라 본문 GOV tabular-nums 이고, 표장은 원천 표장과 무관한 새 모양(네 칸 + 채운 한 칸)이다.
- 색 논리 K6·다크 기본 없음(light)·모션 M1·기법 `view-transition`·`svg-draw`는 선택 보드 판정(Task 9) 그대로다. 대안도 같은 K6이다(`alternates.colorLogic: K6`). 대안 전용 인장선(`svg-draw`의 연장)은 3판(2026-09-28, Task 14) 추가다 — 새 기법 id는 늘리지 않았다(`app/qa/recipes/heroes/crosshair-quadrants.tsx` `.cq-seal`).
- 위 「선택 보드 판정」·「결정 기록」·「선택 보드 2판 판정」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절, 그리고 맨 위 「선택 보드 3판 판정」이 정한다(Task 14, 2026-09-28).

## 레퍼런스에서 가져온 기법

- type-public-korean-font : public 18곳이 한글 서체를 지정한다. KRDS 정본은 Pretendard GOV다.
- type-public-h1-ratio-low : public 16곳의 H1:본문 비율이 2.5 미만이다(17~32px 제목). 안내 화면 H1 40px / 본문 17px(2.35배)로 두고, 첫 화면 한 곳만 display 토큰(60·44px)을 쓴다.
- component-public-nav-top-bar-top-bar : 1440·390 모두 상단 바 내비(8곳). 햄버거 대신 좁은 화면에서도 상단 바에 주요 메뉴를 둔다.
- layout-public-first-cta-early : 첫 CTA가 첫 화면(0~1번째 섹션)에 온다(15곳). 「자주 찾는 서비스」 바로가기가 그 자리다.
- pal-sns-instagram-dpbpoicj3j4-1 : 흰 바탕 + 신뢰 파랑 하나의 색상각(264°) — 대안 주색·링·면 남색의 근거.
- pal-sns-instagram-dudjznijp9d-4 : 짙은 남색 + 옅은 하늘 두 톤 — 기본 accent·accent 글자의 근거.
</content>
