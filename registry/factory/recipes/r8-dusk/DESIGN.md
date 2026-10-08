---
id: r8-dusk
name: 솔숲 저녁
mood: [저녁, 숲, 느림]
axes: { button: B3, input: I1, surface: C3, table: T2, header: H1, radius: R1, shadow: S1 }
motion: M3
colorLogic: K6
dynamics: [split-text, clip-reveal, sticky-stack]
signature: [hero, menu-board]
hero: vertical-title-slides
alternates:
  colorLogic: K6
  color:
    light:
      background: "oklch(0.9539 0.0025 228.78)"
      foreground: "oklch(0.2515 0.0405 162.20)"
      card: "oklch(0.9784 0.0011 197.14)"
      card-foreground: "oklch(0.2515 0.0405 162.20)"
      popover: "oklch(0.9784 0.0011 197.14)"
      popover-foreground: "oklch(0.2515 0.0405 162.20)"
      primary: "oklch(0.3696 0.0758 166.97)"
      primary-foreground: "oklch(0.9539 0.0025 228.78)"
      secondary: "oklch(0.9277 0.0045 179.73)"
      secondary-foreground: "oklch(0.2515 0.0405 162.20)"
      muted: "oklch(0.9277 0.0045 179.73)"
      muted-foreground: "oklch(0.3948 0.0205 167.45)"
      accent: "oklch(0.9093 0.0114 141.26)"
      accent-foreground: "oklch(0.2515 0.0405 162.20)"
      border: "oklch(0.8324 0.0094 161.31)"
      input: "oklch(0.5687 0.0152 166.81)"
      ring: "oklch(0.3696 0.0758 166.97)"
      field-1: "oklch(0.4019 0.0830 166.36)"
      field-1-foreground: "oklch(0.9590 0.0085 145.51)"
      field-2: "oklch(0.4250 0.0998 256.49)"
      field-2-foreground: "oklch(0.9688 0.0091 258.34)"
    dark:
      background: "oklch(0.1855 0.0148 172.00)"
      foreground: "oklch(0.9439 0.0085 145.51)"
      card: "oklch(0.2295 0.0207 168.57)"
      card-foreground: "oklch(0.9439 0.0085 145.51)"
      popover: "oklch(0.2295 0.0207 168.57)"
      popover-foreground: "oklch(0.9439 0.0085 145.51)"
      primary: "oklch(0.7966 0.0919 130.14)"
      primary-foreground: "oklch(0.1855 0.0148 172.00)"
      secondary: "oklch(0.2422 0.0205 168.78)"
      secondary-foreground: "oklch(0.9439 0.0085 145.51)"
      muted: "oklch(0.2422 0.0205 168.78)"
      muted-foreground: "oklch(0.7883 0.0190 160.99)"
      accent: "oklch(0.2693 0.0232 167.85)"
      accent-foreground: "oklch(0.9188 0.0221 138.98)"
      border: "oklch(0.3319 0.0243 166.26)"
      input: "oklch(0.5911 0.0223 164.11)"
      ring: "oklch(0.7966 0.0919 130.14)"
      field-1: "oklch(0.3890 0.0803 166.40)"
      field-1-foreground: "oklch(0.9554 0.0133 152.60)"
      field-2: "oklch(0.4283 0.0996 257.89)"
      field-2-foreground: "oklch(0.9627 0.0120 259.82)"
  fonts:
    display: { family: "Big Shoulders", item: font-big-shoulders, weight: 500, tuned: "대안 첫 화면 한 낱말 전용 응축 대문자. 굵기 500, 17.8vw(390에서 20.5vw)·행간 0.8·자간 0, 화면 아래 끝에 걸친다. 섹션 제목은 1.333 비율 28 · 38 · 50px. 한글은 고운바탕(400·700)" }
    displayKo: { family: "Gowun Batang", item: font-gowun-batang }
  hero: grid-lines-baseline-word
  note: "DNA 수 1(보이는 12칸 세로선 + 바닥에 걸친 응축 대문자) — 카드 팔레트(pal-sns-instagram-dbdclihjjlc-1 + 측정값) · Big Shoulders + 고운바탕. 색 논리 K6·모션 M3·기법 split-text·clip-reveal·sticky-stack 은 새 기본과 같다. 선택 보드 3판(2026-09-28)에서 운영자가 B(세로쓰기 한글 제목 + 슬라이드 눈금)를 pick 하며 「모든 레시피 중에 가장 마음에 드는 실사 움직임 및 영상」이라 적어, B가 머리로 올라가고 이 안은 대안으로 남는다"
icons: { library: lucide, weight: G2 }
fonts:
  display: { family: "Alegreya", item: font-alegreya, weight: 400, tuned: "라틴 전용 문학 세리프. 내비 대문자(자간 0.06em)·캡션 이탤릭·가격에만, 굵기 400. 세로쓰기 한글 제목은 나눔손글씨 붓(굵기 하나 — 레시피 CSS 가 굵기 합성을 끈다)" }
  displayKo: { family: "Nanum Brush Script", item: font-nanum-brush-script }
  body: { family: "Nanum Gothic", item: font-nanum-gothic, tuned: "본문 16px/1.75 굵기 400, 강조 700(차 300), 자간 0. 짙은 면 위 본문은 행간 1.8. 영업시간·가격·객실 수는 tabular-nums" }
  mono: null
color:
  light:
    background: "oklch(0.9669 0.0013 106.42)"
    foreground: "oklch(0.2088 0.0125 67.05)"
    card: "oklch(1.0000 0.0000 0.00)"
    card-foreground: "oklch(0.2088 0.0125 67.05)"
    popover: "oklch(1.0000 0.0000 0.00)"
    popover-foreground: "oklch(0.2088 0.0125 67.05)"
    primary: "oklch(0.4144 0.0479 215.62)"
    primary-foreground: "oklch(1.0000 0.0000 0.00)"
    secondary: "oklch(0.9359 0.0053 106.50)"
    secondary-foreground: "oklch(0.2088 0.0125 67.05)"
    muted: "oklch(0.9359 0.0053 106.50)"
    muted-foreground: "oklch(0.3840 0.0197 73.33)"
    accent: "oklch(0.9575 0.0844 99.79)"
    accent-foreground: "oklch(0.2088 0.0125 67.05)"
    destructive: "oklch(0.52 0.17 27)"
    border: "oklch(0.8549 0.0101 87.48)"
    input: "oklch(0.5519 0.0130 71.79)"
    ring: "oklch(0.4144 0.0479 215.62)"
    success: "oklch(0.5 0.1 165)"
    success-foreground: "oklch(0.985 0.005 165)"
    warning: "oklch(0.54 0.12 60)"
    warning-foreground: "oklch(0.985 0.005 60)"
    info: "oklch(0.5 0.1 245)"
    info-foreground: "oklch(0.985 0.004 245)"
    field-1: "oklch(0.8400 0.0700 250.00)"
    field-1-foreground: "oklch(0.2217 0.0412 259.27)"
    field-2: "oklch(0.4000 0.0850 55.00)"
    field-2-foreground: "oklch(0.9701 0.0215 69.79)"
  dark:
    background: "oklch(0.1924 0.0257 266.62)"
    foreground: "oklch(0.9548 0.0058 264.53)"
    card: "oklch(0.2315 0.0310 264.84)"
    card-foreground: "oklch(0.9548 0.0058 264.53)"
    popover: "oklch(0.2315 0.0310 264.84)"
    popover-foreground: "oklch(0.9548 0.0058 264.53)"
    primary: "oklch(0.7916 0.0430 211.53)"
    primary-foreground: "oklch(0.1924 0.0257 266.62)"
    secondary: "oklch(0.2189 0.0291 266.20)"
    secondary-foreground: "oklch(0.9548 0.0058 264.53)"
    muted: "oklch(0.2189 0.0291 266.20)"
    muted-foreground: "oklch(0.7972 0.0212 264.45)"
    accent: "oklch(0.2686 0.0249 94.06)"
    accent-foreground: "oklch(0.9575 0.0844 99.79)"
    destructive: "oklch(0.7 0.14 25)"
    border: "oklch(0.3248 0.0345 263.91)"
    input: "oklch(0.6091 0.0307 265.31)"
    ring: "oklch(0.7474 0.1337 73.98)"
    success: "oklch(0.74 0.11 165)"
    success-foreground: "oklch(0.19 0.02 165)"
    warning: "oklch(0.8 0.12 75)"
    warning-foreground: "oklch(0.2 0.03 75)"
    info: "oklch(0.74 0.1 245)"
    info-foreground: "oklch(0.19 0.015 245)"
    field-1: "oklch(0.4000 0.1000 255.00)"
    field-1-foreground: "oklch(0.9688 0.0091 258.34)"
    field-2: "oklch(0.4000 0.0850 55.00)"
    field-2-foreground: "oklch(0.9701 0.0215 69.79)"
references:
  - color-c07
  - layout-l01
  - color-palette-anchor-surface-mid
  - layout-local-has-hero
  - type-brand-korean-font
  - motion-n03
  - pal-sns-instagram-dwih2ynktud-7
  - pal-sns-instagram-djwzhoizfmb-5
  - pal-sns-instagram-dudjznijp9d-2
  - pal-sns-instagram-dbdclihjjlc-1
  - pal-sns-threads-dc1fzhbgoua-2
archetypes: [local, brand]
archetypeConditions:
  local: "헤리티지 업장(한옥 스테이·찻집·수목원·전통 식음)에만 — 병원·일반 카페·미용실은 r3-woodblock"
  brand: "헤리티지 브랜드(한옥 스테이·찻집·전통 식음 등)에만 — IT·일반 소비재·프리미엄 브랜드에 세리프를 기본으로 쓰지 않는다(§13)"
---

## 선택 보드 3판 판정 (2026-09-28)

- 선택 보드 3판(2026-09-28)에서 운영자가 A·B 모두 좋다로 매기고 B(세로쓰기 한글 제목 + 슬라이드 눈금)를 pick 했다: 「모든 레시피 중에 가장 마음에 드는 실사 움직임 및 영상이야. 주제에 맞게 단정하고 깔끔해. 실사 영상 배경이 단조로운 배경보다 훨씬 나은 것 같아.」 결정 원본은 `factory/board/recipe-board3-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- 이 판정으로 B(전폭 저녁 그림 위 세로쓰기 한 줄 + 슬라이드 눈금, 히어로 `vertical-title-slides`)를 머리 기본값으로 승격했다. 색 논리 K6·모션 M3·기법 `split-text`·`clip-reveal`·`sticky-stack`은 그대로다 — 바뀌는 축은 색·서체·히어로다.
- A(보이는 12칸 세로선 + 바닥에 걸친 응축 대문자, 히어로 `grid-lines-baseline-word`)는 `alternates`로 남긴다.
- 실사 영상(밤 마당 한옥, `r8-B-hanok.mp4`)은 히어로 `vertical-title-slides`에 그대로 붙어 있다 — 미디어 키가 A/B 글자가 아니라 히어로 id(`media-sources.json`·`public/media/manifest.json`의 `recipe`+`slot`)라서 재배정이 필요 없다. 소나무 숲 영상(`r8-A-pine.mp4`)도 `grid-lines-baseline-word`에 그대로 남는다.
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 이제 새 기본(옛 B)을 먼저 적고, 대안(옛 A)을 그 뒤에 적는다.

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **A안 유지** — 색 논리 K6 솔숲 면 · 모션 M3 · 역동 기법 `split-text`·`clip-reveal`·`sticky-stack` 그대로다. B안(K7 솔과 감 + M2 + `clip-reveal`·`svg-draw`)은 고르지 않았다. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- `alternates`는 지웠다(보존하지 않음). B 값은 커밋 `8541c6f`의 머리와 보드 고정본 `factory/board/recipe-board/heads-at-board.json`에 남아 있다.
- r7-docs B안(칠판 청록 `0.42 0.08 170`)도 함께 승인됐다. 아래 결정 기록은 「둘을 함께 고르지 않는다」고 적었지만 운영자는 둘 다 골랐다. 두 면은 색상각 32°·채도 0.02·명도 0.1이 다르고 `qa:distinct`(대표 면 색 비교 포함)는 통과한다. 쓰임이 갈린다 — r8은 local·brand의 첫 화면 패널, r7은 문서형 saas·pwa의 표지·목차 머리다.

## 결정 기록 (2026-09-27, P3-1 Task 7)

방향 원천은 선정서 `docs/recipes/candidates-2026-09-27.md` r8-dusk 줄(N7 고요한 자연 다크)이다. 축·서체·원형·라이트 바탕·글자·primary·ring은 선정서 값 그대로다. Task 6b 뒤 묶음 C를 대담하게 다시 짜라는 운영자 결정(2026-09-27 「색감 팔레트가 계속 똑같고 너무 정적이다」)에 따라 **색 논리를 K6 색 면으로, 모션을 M2에서 M3로** 올렸다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 솔숲 저녁 (고름) | B 솔과 감 (보드 B안) | C 남색 밤하늘 + 금 (버림) |
|---|---|---|---|
| 분위기 3단어 | 저녁 · 숲 · 느림 | 저녁 · 숲 · 온기 | 밤 · 고급 · 반짝임 |
| 축 | B3 I1 C3 T2 H1 R1 S1, M3 | 같음, M2 | B4 I4 C4 T2 H2 R1 S1, M2 |
| 색 논리 | K6 색 면 — 솔숲 짙은 면(field-1)과 이끼 안개 밝은 면(field-2), 강조 이끼 125° | K7 듀오톤 — 솔숲 면 + 감물 주 버튼 42° | 남색 바탕 + 금색 강조 |
| 서체 짝과 이유 | Hahmlet 700(한글·라틴 세리프 제목) + 나눔고딕(본문). 한옥·찻집의 붓 획 대비를 제목에만 두고 본문은 담백한 고딕 | 같은 짝 | 세리프 기울임 히어로 + 고딕 |
| 사진·그림 | 저녁빛 실사(공간·객실·차) 한 장이 첫 화면 왼쪽 55~60%, 오른쪽은 짙은 솔숲 면 패널 | 같은 사진 | 별·빛 번짐 장식 |
| 이 안에서만 나오는 레이아웃 | 분할 첫 화면(사진 + 솔숲 면 패널에 H1·오늘 영업시간·주소·예약 버튼), 솔숲 면 띠에 객실·코스를 겹쳐 쌓는 스티키 카드 | 같은 틀, 감물 주 버튼 | 가운데 히어로 + 카드 3장 |
| 레퍼런스 2개 | color-c07 · layout-l01 | pal-sns-instagram-dudjznijp9d-2 · pal-sns-instagram-dwih2ynktud-7 | 없음(상투 조합) |

- **버린 안: C.** 남색 밤하늘 + 금색은 브라스 계열 프리미엄 기본값이고, 파랑은 r1·r6에서 이미 쓴다(선정서 「버린 방향」). 세리프 기울임 히어로는 §13 기본값 목록이다.
- **B안: 솔과 감.** 소나무와 감물(감즙 염색)은 한옥 스테이·전통 식음에서 실제로 쓰는 두 재료다. 감물 42°는 솔숲 138°와 96° 떨어져 K7 조건(90° 이상)을 넘는다. `alternates`에 기계 데이터로 두었고, B 전체와 부분 조합이 모두 같은 lint를 통과한다.
- **고른 안: A.** 사용 장면은 저녁에 예약을 찾는 손님이다(한옥 스테이·찻집·수목원). 첫 화면은 **분할 히어로**다(Task 7 fix 1 — 리뷰 I4-b): 1440px에서 실사 한 장이 왼쪽 55~60%, 오른쪽 40~45%가 솔숲 짙은 면 패널이고 그 위에 H1·오늘 영업시간·주소 한 줄·예약 버튼이 있다. 390px에서는 사진이 위, 솔숲 면 패널이 바로 아래다. 그래서 「저녁 숲」이 첫 화면 면적으로 보이고(1440×900에서 면 약 40%), §21-3의 첫 화면 과업(영업시간·주소·예약)이 사진 위가 아니라 면 위에서 풀린다 — layout-l01의 「사진 어두운 곳에만 흰 글자」 제약도 사라진다. 첫 판은 「사진 아래를 면이 받는다」였는데, 1440×900 첫 화면에서 면 면적이 0에 가까워 보드 대표 장면에서 대담함이 보이지 않았다. 흰 바탕에 강조 한 점을 두는 골격을 버렸다.
- **K6 면 색(DESIGN §5-B div-02)**: field-1 `0.32 0.1 138`(짙은 면 대역 L 0.25~0.6·C 0.08~0.18 안), field-2 `0.86 0.08 128`(밝은 면 대역 L 0.82~0.95·C 0.06~0.14 안). 두 면은 색상각 10° 차라 한 묶음이다(§5-B 「면 색 2개까지」). 면 위 글자는 두 테마 모두 면마다 쟀다(아래 「대비」).
  - 솔숲 138°는 처음에 150°였다. qa:distinct의 대담한 얼굴 비교에서 r7-docs B안의 칠판 청록(`0.42 0.08 170`)과 색상각 20°·ΔL 0.1로 닮았다고 걸려 138°로 옮겼다(170°와 32°).
  - Task 7 fix 1(리뷰 M1)에서 field-1 C를 0.085 → 0.1로 올렸다. 보드에서 r7-docs B안(칠판 청록 `0.42 0.08 170`)과 함께 승인되면 「짙은 초록 띠 + 흰 바탕」 두 벌이 되는 것을 색상각(32°)만이 아니라 채도(ΔC 0.02)·명도(ΔL 0.1)로도 떼어 놓는다. 그래도 둘은 초록~청록 한 계열이다 — 보드에서 둘을 함께 고르지 않는다.
  - 라임은 쓰지 않는다(선정서 N7 주의, color-c07 「유행 편중」). 이끼 125°는 C 0.07~0.1로 둔다.
- **면 위 조작(Task 7 fix 1 — 리뷰 I1)**: 첫 판은 라이트 솔숲 면 위 포커스 링이 2.30:1, 이끼 주 버튼이 1.69:1, 보조 글자가 1.54:1이었다(링·주 버튼 토큰이 바탕 기준). 생성기가 이제 면 구획 `[data-face="field-1"]`·`[data-face="field-2"]` 스코프를 내고, 그 안에서 ring·primary = 면 글자색, primary-foreground = 면 색, 보조 글자·테두리 = 면 글자색을 섞은 값이 된다. 「짙은 면 위 주 버튼은 반전」이 글이 아니라 토큰이다. lint `face-contrast`와 갤러리 「면 위의 조작」 견본으로 잰 값은 「게이트 기록」에 있다.
- **다크 기본을 쓰지 않은 이유(리뷰 M3로 고쳐 씀)**: 선정서는 「다크가 주인」이라 적었다. 다크 기본(§5-B)은 사용 장면으로 고른다(§5 MUST) — r8의 손님은 낮에도 예약을 찾고(점심 찻집·주말 스테이), 저녁 분위기는 솔숲 면이 라이트에서도 만든다. 그래서 테마는 시스템을 따르고 다크 토큰을 먼저 설계했다. 묶음 C의 다크 기본은 r10-console이 맡는다(어두운 방에서 하루 종일 켜 두는 운영 화면). r8은 라이트에서도 솔숲 면이 화면을 채우므로 「저녁」이 라이트에서 사라지지 않는다. 다크 바탕은 소나무 밤 `0.16 0.02 155`(§5 12~18%)이다.
- **헤리티지 범위(선정서 M7)**: Hahmlet 세리프 제목은 한옥 스테이·찻집·수목원·전통 식음처럼 헤리티지를 한 줄로 설명할 수 있는 브리프에만 쓴다(§13 MUST 「프리미엄이면 세리프」 금지). 「하지 말 것」에 적었다. 획 대비가 커서 앱 바 크기에서 약해 원형에 `pwa`를 넣지 않았다.
- **모션 M3(div-06)**: 원형 local·brand는 M3가 허락된다(compat.json recipeRules는 dashboard·public만 막는다). 기법 셋은 모두 첫 화면·첫 스크롤에 나온다: `split-text`(히어로 H1 한 번, 글자 25ms 간격), `clip-reveal`(히어로 사진을 `inset()`으로 걷기), `sticky-stack`(솔숲 면 띠 안 객실·코스 카드 3~5장). 동작 줄이기에서는 셋 다 불투명도 변화 또는 정지 상태다(§8-6 표 오른쪽 열). 자석 버튼은 고르지 않았다 — 예약 CTA를 움직이면 저녁·느림과 맞지 않는다.
- **색 수 판단**: `refs-v2/samples.jsonl` local 23곳의 유채색 수 중앙값은 2(2개 이하 13곳, 3개 이상 10곳)이고, brand 29곳도 중앙값 2(3개 이상 14곳)다. 이 레시피의 얼굴 색은 솔숲·이끼 한 묶음(138°·125°, 45° 안)이다. 면적은 크게 쓰지만 색상각 묶음은 하나라서 두 원형의 중앙값 안에 있다. 의미색(성공 165°·경고·오류·정보)은 §5 MUST라 따로 둔다. 성공색은 이끼와 헷갈리지 않게 165°로 옮겼다.
- **대비(lint와 같은 `contrast-lib ratio`)**: 라이트 글자/바탕 16.04 · muted 글자/바탕 7.47 · 주 버튼 글자/primary 6.78 · ring/바탕 4.99 · 입력 테두리/바탕 3.65 · field-1 글자/면 10.94 · field-2 글자/면 10.86. 다크 글자/바탕 16.27 · muted 9.72 · ring 9.25 · field-1 글자/면 11.48 · field-2 글자/면 8.98. B안(K7) 라이트 감물 위 글자 5.94 · 솔숲 면 글자 10.14, 다크 감물 위 글자 8.56.
- **팔레트 인용**: `pal-sns-instagram-dwih2ynktud-7`(숲 단색 램프 `0.26 0.04 161` · `0.42 0.06 142` · `0.62 0.06 149`)에서 솔숲 면의 색상각과 짙은 명도 단계를, `pal-sns-instagram-djwzhoizfmb-5`(이끼 `0.84 0.07 136` · `0.59 0.07 118`)에서 이끼 강조와 밝은 면(field-2)의 색상각을 빌렸다. 둘 다 augmented가 아닌 원본 팔레트다. B안의 감물 42°는 `pal-sns-instagram-dudjznijp9d-2`(`0.46 0.12 39`, quiet luxury)의 색상각이다. 세 팔레트 모두 hex를 그대로 옮기지 않고 OKLCH 대역으로 다시 만들었다(§5-A).
- **서체**: Hahmlet·Nanum Gothic 모두 SIL OFL 1.1이다(키트 항목 `meta.license`). §13·banlist에 없다. **한글 제목 서체는 Hahmlet 700**이다(선정서 M5) — Hahmlet은 한글 글리프가 있는 세리프라 한글 제목도 이 서체로 그린다. 가변 서체(wght 100~900)라 700을 합성하지 않는다. 로더는 둘이다(Hahmlet 1, Nanum Gothic 1).
- **아이콘**: lucide, 결 G2(1.5px 가는 선) — 세리프 제목의 가는 가로획과 같은 무게다.
- **AI 티 점수**: 아래 「게이트 기록」.

### 게이트 기록

- lint 위반 0·경고 0(새 규칙 `face-contrast`·`primary-surface` 포함, A·B 모두). B안 부분 조합 7개 모두 통과. qa:distinct 10벌 문제 없음(대담한 얼굴: 솔숲 138°는 r7 B안 170°와 32°, C 0.1 대 0.08).
- 면 스코프 비율(생성기 `faceTokens`): field-1 면 조각 10% · 보조 글자 78% · 테두리 50%, field-2 10% · 86% · 50%.
- `/qa/recipes?r=r8-dusk`: run --strict 0(ux-gate 0·behavior 0) · hit-area fine 35개 실패 0 · coarse 35개 실패 0.
  - fix 1 첫 재측정에서 ux-gate가 한 번 떨어졌다: 새 면 견본의 보조 글자가 6.66:1로 본문 7:1 관문 아래였다. 생성기가 면 보조 글자 비율을 7:1부터 찾도록 고쳤다(닿지 않으면 4.5 바닥, lint 경고).
- **AI 티 점수 G 12/239**(kas 7/35) — G018 · G078 · G084 · G088×4 · G126 · G135×5, 모두 검수대 틀과 면 견본 구획(면 안의 면) 쪽. 같은 빌드(741d7d2 + Task 7 fix 1, 차가운 캐시)에서 r1-measure를 대조로 함께 쟀다 — r1 G 12.
- **면 위의 조작**(리뷰 I1 — 라이트 예약 띠 링 2.30이던 자리): 갤러리 「면 위의 조작」 견본(크기 위계 벤토: 첫 면이 큰 칸에 주 버튼·외곽선 버튼·입력·체크, 나머지 면은 작은 칸마다 조작 하나)을 CDP로 쟀다 — 라이트·다크를 `prefers-color-scheme`으로 따로 띄우고, Tab 키 뒤 `focus()`로 `:focus-visible` 링을 켠 계산 색(canvas sRGB)으로.
  - 라이트 field-1(솔숲 짙은 면): 포커스 링 **10.94** · 주 버튼 채움/면 10.94 · 버튼 글자 10.94 · 입력 테두리 3.73 · 보조 글자 7.05 · 체크 10.94. field-2: 링 10.89 · 테두리 토큰 3.17 · 보조 글자 8.17.
  - 다크 field-1: 링 11.48 · 입력 3.79 · 보조 글자 7.33. field-2: 링 8.95 · 테두리 3.36 · 보조 글자 7.03.
- 한글 제목 서체(CDP `getComputedStyle` 첫 family · `CSS.getPlatformFontsForNode` · `document.fonts.check`): 레시피 제목 h2와 크기 견본 제목 6개 모두 첫 family `Hahmlet` 700, 그린 서체 Hahmlet(웹폰트), `fonts.check` true.
- 동작 줄이기(CDP, 갤러리 `prefers-reduced-motion: reduce`): 레시피 칸의 모션 토큰 `--duration-enter` 700ms(.7s) → 0s, `--duration-sheet`·`--duration-hover`·`--duration-press`·`--duration-popover` 모두 0s(factory-base가 토큰 자체를 접는다 — 리뷰 I7). 프리셋은 `animation: none`, 전환·지연은 0.
- 갤러리 한계: 공통 견본은 분할 첫 화면·역동 기법을 그리지 않는다 — Task 8 대표 장면(`hero-photo`·`hero-display`)에서 보인다.

## 분위기

밤 마당이다. 불 켜진 기와집과 굽은 솔 사이, 가운데 한 줄만 붓글씨로 세로로 흐르고, 아래 눈금 셋이 장면(해 질 녘·밤·새벽)을 바꾼다. 우상단에는 세리프 대문자 내비 다섯이 서고, 현재 항목은 밑줄로 가리킨다. 제목 뒤는 하늘·산 면뿐이라 붓글씨 한 줄이 조용히 두드러진다. 대안(`alternates`)은 안개 낀 솔숲의 저녁이다 — 첫 화면은 옅은 안개 하늘 아래 저녁 파랑 숲과 짙은 솔 숲이 겹쳐 서고, 그 위에 12칸 격자 세로선이 그대로 보인다. 응축 대문자 한 낱말이 화면 아래 끝에 걸쳐 숲을 가로지르고, 왼쪽에는 고운바탕 캡션 두 줄, 오른쪽에는 선 두 줄 사이 「숲 소리 듣기」가 놓인다. 낱말은 글자마다 아래에서 한 자씩 올라온다.

## 쓰는 법

- 맞는 원형은 동네 가게·예약(local)과 브랜드 홈(brand)이다. 한옥 스테이·찻집·수목원·전통 식음처럼 헤리티지를 한 줄로 말할 수 있을 때만 쓴다.
- 첫 화면은 히어로 `vertical-title-slides`(대안 `grid-lines-baseline-word`)다.
  - 기본: 전폭 저녁 그림(다크 구역) 가운데 한글 제목 하나만 세로쓰기(`writing-mode: vertical-rl`, 자간 0.4em). 제목 뒤는 하늘·산 면뿐이다. 우상단 세리프 대문자 내비 다섯(현재 항목 밑줄), 아래 가운데 슬라이드 눈금 셋(32px 선, 누르는 칸 44px). 그림 아래 첫 칸이 면(field-1)이다.
  - 대안: 전폭 풍경(사진이 있으면 실사) 위 12칸 세로선(390px에서 8칸), 한 낱말 제목 17.8vw 가운데 정렬로 화면 아래 끝에 걸친다(아래 3%만 남김). 낱말이 놓이는 높이는 짙은 숲 층(면·먹)이어야 한다 — 그림에서 잰 낱말 대비 7.36. 내비는 불투명 muted 네모 칸 왼쪽 셋·오른쪽 둘, 로고 가운데.
- local이면 첫 화면 바로 아래 칸에 오늘 영업시간·주소 한 줄·예약 버튼 하나를 둔다(§21-3).
- 면: 옅은 저녁 하늘 면(`bg-field-1`, 대비 10.62 · 다크 11.48)과 등불 나무 면(`bg-field-2`, 8.67 · 8.95) 두 색까지다. 대안은 솔 면(7.79 · 8.16)과 저녁 파랑 면(7.61 · 7.38)이다. 예약 띠·객실 카드 띠에 칠하고 **`data-face="field-1"`(또는 `field-2`)을 함께 단다**. 짙은 면 위 주 버튼은 면 스코프가 반전한다(채움 `field-1-foreground`, 글자 `field-1`).
- 제목은 `font-heading`이다: 라틴 Alegreya(대안 Big Shoulders 500), 한글 나눔손글씨 붓(대안 고운바탕 400·700 — 나눔손글씨 붓은 굵기 하나라 레시피 CSS가 굵기 합성을 끈다). 세로쓰기 제목은 첫 화면 전용이고, 섹션 제목은 1.333 비율 28 · 38 · 50px 한글 세리프다. 본문은 나눔고딕 16px/1.75다.
- 카드는 C3 면 + S1 틴트 그림자, 반경 R1(12~16px). 버튼은 B3 8px이다.
- 모션은 M3다(등장 700ms, hover 200ms). 역동 기법 셋:
  - `split-text` — 세로쓰기 제목은 옆에서 밀어 넣는다(대안은 응축 대문자를 글자로 쪼개 마스크 안에서 한 자씩 올린다 — 글자당 700ms, `cubic-bezier(0.165, 0.84, 0.44, 1)`, 40ms 차, 12자가 넘으면 낱말 단위). 원문은 한 번만 읽히고 조각은 `aria-hidden`.
  - `clip-reveal` — 첫 화면 풍경을 한 번 걷는다(기본은 위에서, 대안은 아래에서). 글자는 처음부터 읽힌다.
  - `sticky-stack` — 면 띠 안에서 객실·코스 카드 3~5장이 `position: sticky`로 겹쳐 쌓인다. 40rem 미만에서는 일반 목록이다.
  - 동작 줄이기: 쪼개지 않은 채 다 보이고, 풍경은 바로 보이고, 쌓기는 일반 목록이다.
- 상태는 색과 글자를 함께 쓴다.

## 하지 말 것

- 헤리티지가 아닌 브리프(병원·IT·일반 카페·프리미엄 소비재)에 쓰지 않는다. 「고급스러우면 세리프」는 §13 위반이다.
- 세로쓰기 제목을 두 줄 이상으로 늘리지 않는다. 문장은 가로로 쓴다.
- 한 낱말 제목(대안)을 옅은 하늘·안개 위에 올리지 않는다. 낱말이 지나는 높이는 짙은 숲 층이다.
- 응축 대문자(대안)를 섹션 제목·버튼·가격으로 늘리지 않는다. 첫 화면 한 낱말뿐이다.
- 라임·형광 초록을 더하지 않는다(「거의 검정 + 형광 한 점」 §13).
- 두 면 사이에 그라디언트를 넣지 않는다. 면은 단색이다(그림 속 하늘의 옅은 안개만 예외).
- 모든 섹션에 같은 등장 연출을 걸지 않는다. 등장 연출은 첫 화면 한 번, 쌓기는 면 띠 한 곳뿐이다.
- 예약 버튼에 자석·맥동을 걸지 않는다.
- 크림·베이지 바탕으로 따뜻하게 바꾸지 않는다. 기본 바탕은 돌 회백, 대안 바탕은 안개 회청이다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r8-dusk.md`. 레시피에는 사이트 이름을 적지 않는다.
- 기본 = 카드 수 2(세로쓰기 한글 제목 + 슬라이드 눈금) · 새 팔레트: 측정 사이트 2의 저녁 파랑 `#39649B`·`#4B7BB9` → 라이트 면 `oklch(0.84 0.07 250)`·다크 면 `oklch(0.40 0.10 255)`, 나무 갈색 `#322413`·`#50351C` → 글자 `#1C1712`·둘째 면 `oklch(0.40 0.085 55)`(K6 짙은 면 대역 C 0.08 위로 채도만 올림) + SNS 팔레트 `pal-sns-threads-dc1fzhbgoua-2`(청회 `#345C66` 주색 · 등불 노랑 `#FEF3B1` accent · 호박 `#DF9F3E` 다크 링) · Alegreya + 나눔손글씨 붓.
  - 카드와 다르게 둔 것: 사진 대신 직접 그린 밤 마당(기와집 선·불 켜진 창·굽은 솔·디딤돌), 세로 제목 25px 대신 붓글씨 2.5rem(붓글씨는 작은 크기에서 획이 무너진다), 눈금을 누르면 장면(해 질 녘·밤·새벽)이 바뀐다.
- 대안 = 카드 수 1(보이는 12칸 세로선 + 바닥에 걸친 응축 대문자) · 카드 팔레트(`pal-sns-instagram-dbdclihjjlc-1` + 측정값) · Big Shoulders + 고운바탕. 영상 자리는 직접 그린 안개 솔숲(층마다 면·먹 토큰)이다.
  - 카드 값에서 바꾼 것: 라이트 `field-2`의 L 0.4513 → **0.425**(면 글자 대비 6.79 → 7.61, 목표 7:1). 이탤릭 세리프 캡션은 한글이라 기울이지 않고 고운바탕으로 썼다.
  - 한 낱말 뒤 바탕(Task 10d fix — 히어로 픽셀 대비 관문): 가까운 솔 숲(field-1)이 조금 더 위(570)부터 채워 글자 칸 위쪽까지 면이 받친다. 먹 땅은 면 글자색의 명도를 뒤집은 색으로 면을 45% 민 색이다. 12칸 세로선은 낱말 윗줄에서 멈춘다. 좁은 화면에서는 캡션과 「숲 소리 듣기」 줄을 위아래로 떼었다.
- 색 논리 K6·모션 M3·기법 `split-text`·`clip-reveal`·`sticky-stack`은 선택 보드 판정(Task 9) 그대로다. 대안도 같은 K6이다.
- 위 「선택 보드 판정」·「결정 기록」·「선택 보드 2판 판정」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절, 그리고 맨 위 「선택 보드 3판 판정」이 정한다(Task 14, 2026-09-28).

## 레퍼런스에서 가져온 기법

- color-c07 : 주제에서 나온 초록 한 줄기를 강조로 쓴다. 라임을 빼고 솔 초록으로 낮췄다.
- layout-l01 : 실사가 설득력을 만든다 — 첫 화면에 실사(없으면 그림)를 크게 둔다. 사진 위 글자는 어두운 층에만 둔다.
- color-palette-anchor-surface-mid : 팔레트를 바탕·글자·면·강조 역할로 먼저 나눈다. 짙은 닻색(솔)을 면으로, 저녁 파랑을 둘째 면으로 배정했다.
- layout-local-has-hero : local 첫 화면은 실사 히어로다. 영업시간·예약 버튼을 첫 화면 바로 아래 칸에 둔다.
- type-brand-korean-font : 브랜드 홈의 한글 전용 서체 사용. 섹션 제목은 한글 세리프(고운바탕)다.
- motion-n03 : 목적 있는 모션 — 등장 연출은 첫 화면 제목 한 번에 몬다.
- pal-sns-instagram-dwih2ynktud-7 : 숲 단색 램프 — 짙은 면 명도 단계의 근거.
- pal-sns-instagram-djwzhoizfmb-5 : 이끼 두 톤 — 다크 주색(이끼)의 근거.
- pal-sns-instagram-dudjznijp9d-2 : 감물 39° — 지난 B안(보드 당시)의 색상각.
- pal-sns-instagram-dbdclihjjlc-1 : 럭셔리·시간 팔레트 — 대안 주색·글자·솔 면의 근거.
- pal-sns-threads-dc1fzhbgoua-2 : 청회·등불 노랑·호박 — 기본 주색·accent·다크 링의 근거.
</content>
