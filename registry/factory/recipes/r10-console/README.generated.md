<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 자홍 콘솔 (`r10-console`) — 레시피 안내

원천: `registry/factory/recipes/r10-console/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r10-console#v0.1.2        # 디자인 시스템 전체(registry:base)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r10-console-theme#v0.1.2  # 색만(registry:theme)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r10-console-alt#v0.1.2    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r10-console-<부품>`(예: `r10-console-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r10-console/r10-console.css` 를 붙인다.

## 한눈에

- 분위기: 조밀 · 즉답 · 절제
- 첫 화면 히어로: crop-marks-typed-title(재단 표시 + 타자로 써지는 제목 + 딱딱한 그림자 버튼)
- 맞는 원형: dashboard
- 스타일 축: 반경 R2 · 버튼 B3 · 입력 I1 · 표면 C1 · 표 T1 · 머리 H4 · 그림자 S0
- 모션 M1 · 아이콘 lucide G3(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: square · --icon-linejoin: miter)
- 서체: 제목 Azeret Mono(`font-azeret-mono`, 굵기 600 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면 제목·버튼 라벨 전용 고정폭. 굵기 600, 대문자 세 줄 가운데 4.4vw(390에서 10.8vw)·행간 1.0·자간 -0.02em. 한글은 갈무리11(400·700)) · 한글 제목 Galmuri11(`font-galmuri11`) · 본문 Pretendard(`font-pretendard`, 조정: 본문 16px/1.6 굵기 400, 표 셀 16px/1.5(T1 조밀 행 32px), 강조 600. 숫자 열은 tabular-nums) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: data-numeric 표 칸·ID·코드에만, 굵기 400. 라벨·캡션·상태 이름에는 쓰지 않는다)
- 레퍼런스: layout-l09 · component-k17 · component-k05 · component-d06 · color-c10 · pal-sns-instagram-dcmlsefiicy-2 · pal-sns-instagram-dct4vqjmytn-4 · pal-sns-instagram-dudjznijp9d-1 · pal-sns-instagram-dpbpoicj3j4-4 · pal-sns-instagram-de9uynfabjg-2
- 색 논리 K6(색 면) · 기본 테마 dark(DESIGN §5-B 다크 기본: 저장된 선택이 없으면 다크로 시작하고, 사용자가 설정에서 라이트·시스템으로 바꾼다 — 예: next-themes `defaultTheme="dark"` + `enableSystem`, 선택은 저장해 첫 페인트 전에 적용. 라이트 토큰도 같은 대비 기준을 채운다)
- 역동 기법(dynamics, DESIGN §8-6): `view-transition`(View Transitions) · `svg-draw`(SVG 선 그리기) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K6 그대로) · 서체 Antonio · Orbit · 첫 화면 baseline-news-app-window — DNA 수 1(두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창) — 카드 팔레트 그대로(pal-sns-instagram-dpbpoicj3j4-4 + 측정값) · Antonio + 오르빗. 색 논리 K6·다크 기본·모션 M1·기법 view-transition·svg-draw 는 새 기본과 같다. 선택 보드 3판(2026-09-28)에서 운영자가 B(재단 표시 + 타자 제목)를 pick 하며 「모션 움직임이 좀 단순해. 뭔가 아쉽달까. 좋은데 뭔가 하나 빠진 느낌이야.」라 적어, B가 머리로 올라가고 이 안은 대안으로 남는다. 대안의 모션은 아래 「쓰는 법」의 커서를 따르는 행 강조로 보완했다. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9718 0.0041 301.43)` | `oklch(0.1932 0.0212 307.24)` |
| `--foreground` | `oklch(0.1193 0.0319 311.41)` | `oklch(0.9424 0.0115 308.33)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2223 0.0263 305.42)` |
| `--card-foreground` | `oklch(0.1193 0.0319 311.41)` | `oklch(0.9424 0.0115 308.33)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2223 0.0263 305.42)` |
| `--popover-foreground` | `oklch(0.1193 0.0319 311.41)` | `oklch(0.9424 0.0115 308.33)` |
| `--primary` | `oklch(0.4757 0.2048 318.89)` | `oklch(0.7392 0.1960 320.52)` |
| `--primary-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1932 0.0212 307.24)` |
| `--secondary` | `oklch(0.9491 0.0070 304.24)` | `oklch(0.2254 0.0258 301.98)` |
| `--secondary-foreground` | `oklch(0.1193 0.0319 311.41)` | `oklch(0.9424 0.0115 308.33)` |
| `--muted` | `oklch(0.9491 0.0070 304.24)` | `oklch(0.2254 0.0258 301.98)` |
| `--muted-foreground` | `oklch(0.3979 0.0244 304.72)` | `oklch(0.7709 0.0298 305.94)` |
| `--accent` | `oklch(0.9413 0.0282 318.69)` | `oklch(0.2640 0.0373 308.05)` |
| `--accent-foreground` | `oklch(0.2634 0.1089 319.24)` | `oklch(0.9165 0.0521 319.03)` |
| `--border` | `oklch(0.8679 0.0159 306.38)` | `oklch(0.3077 0.0372 304.87)` |
| `--input` | `oklch(0.5508 0.0287 303.11)` | `oklch(0.5722 0.0353 305.84)` |
| `--ring` | `oklch(0.5276 0.2352 318.43)` | `oklch(0.7392 0.1960 320.52)` |
| `--field-1` | `oklch(0.4029 0.1661 321.00)` | `oklch(0.4029 0.1661 321.00)` |
| `--field-1-foreground` | `oklch(0.9661 0.0246 317.72)` | `oklch(0.9661 0.0246 317.72)` |

## 모션 토큰

모션 M1 의 값이 `:root`(순수 CSS·registry cssVars.light)에 실린다 — `motion-core` 의 기본값(M2)을 덮고, 프리셋(`.wf-fade-rise` 등)이 `var(--duration-enter, …)` 로 읽는다. M0 은 등장 연출이 없다(`--duration-enter: 0ms`).

- `--ease-standard`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `--ease-emphasized`: `cubic-bezier(0.2, 0, 0, 1)`
- `--ease-in-screen`: `cubic-bezier(0.45, 0, 0.55, 1)`
- `--ease-exit`: `cubic-bezier(0.4, 0, 1, 1)`
- `--ease-sheet`: `cubic-bezier(0.32, 0.72, 0, 1)`
- `--duration-press`: `100ms`
- `--duration-hover`: `150ms`
- `--duration-popover`: `150ms`
- `--duration-enter`: `300ms`
- `--duration-sheet`: `260ms`

## 면·칸 색 (색 논리 K6~K8)

이 레시피는 표준 shadcn 변수 밖의 색 키를 더 싣는다. cssVars.theme 이 `--color-<키>` 로 이어 두어 Tailwind 유틸리티로 바로 쓴다: `bg-field-1` + `text-field-1-foreground`.
- K6 색 면: 바탕이나 섹션 띠를 field-1(·field-2)로 칠한다. 한 페이지의 면 색은 2개까지이고 섹션마다 번갈아도 된다. 면 위 글자는 field-N-foreground 로만(회색 글자 금지 — DESIGN §5).

**면 구획에는 `data-face` 속성을 단다** — `<section class="bg-field-1 text-field-1-foreground" data-face="field-1">`. 레시피 CSS(registry css·순수 CSS)가 `[data-face="<키>"]` 스코프마다 `--background`·`--foreground`·`--primary`·`--primary-foreground`·`--ring`·`--border`·`--input`·`--muted`·`--muted-foreground`·`--accent`·`--accent-foreground`·`--secondary`·`--secondary-foreground` 를 그 면의 짝으로 다시 가리킨다. 그래서 면 안의 부품(주 버튼·포커스 링·보조 글자·입력 테두리·체크)이 면 위에서 대비를 지킨다(lint `face-contrast` — 두 테마, 글자 4.5 · 링·테두리·채움 3). 면 안에 놓인 카드(`[data-slot="card"]`)와 `[data-face-reset]` 요소는 레시피 원래 값으로 돌아간다. `data-face` 없이 면 색만 칠하면 바탕 기준 토큰이 그대로 남아 링·버튼이 사라질 수 있다.

- `[data-face="field-1"]`: 면 조각(muted·accent·secondary) = field-1-foreground 10% · 보조 글자 78% · 테두리·입력 50% (나머지는 field-1)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9455 0.0067 97.35)` | `oklch(0.1900 0.0120 330.00)` |
| `--foreground` | `oklch(0.2034 0.0050 325.76)` | `oklch(0.9207 0.0094 99.99)` |
| `--card` | `oklch(0.9753 0.0040 106.47)` | `oklch(0.2250 0.0130 330.00)` |
| `--card-foreground` | `oklch(0.2034 0.0050 325.76)` | `oklch(0.9207 0.0094 99.99)` |
| `--popover` | `oklch(0.9753 0.0040 106.47)` | `oklch(0.2250 0.0130 330.00)` |
| `--popover-foreground` | `oklch(0.2034 0.0050 325.76)` | `oklch(0.9207 0.0094 99.99)` |
| `--primary` | `oklch(0.2083 0.0751 316.90)` | `oklch(0.8604 0.0681 342.94)` |
| `--primary-foreground` | `oklch(0.8604 0.0681 342.94)` | `oklch(0.2083 0.0751 316.90)` |
| `--secondary` | `oklch(0.9119 0.0081 98.89)` | `oklch(0.2150 0.0120 330.00)` |
| `--secondary-foreground` | `oklch(0.2034 0.0050 325.76)` | `oklch(0.9207 0.0094 99.99)` |
| `--muted` | `oklch(0.9119 0.0081 98.89)` | `oklch(0.2150 0.0120 330.00)` |
| `--muted-foreground` | `oklch(0.3826 0.0159 305.66)` | `oklch(0.7852 0.0090 67.69)` |
| `--accent` | `oklch(0.8604 0.0681 342.94)` | `oklch(0.2700 0.0300 330.00)` |
| `--accent-foreground` | `oklch(0.2083 0.0751 316.90)` | `oklch(0.8604 0.0681 342.94)` |
| `--destructive` | `oklch(0.52 0.17 27)` | `oklch(0.7 0.16 25)` |
| `--border` | `oklch(0.8479 0.0098 93.59)` | `oklch(0.3300 0.0150 330.00)` |
| `--input` | `oklch(0.5583 0.0131 308.20)` | `oklch(0.5859 0.0108 320.56)` |
| `--ring` | `oklch(0.2083 0.0751 316.90)` | `oklch(0.8604 0.0681 342.94)` |
| `--success` | `oklch(0.5 0.1 160)` | `oklch(0.74 0.11 160)` |
| `--success-foreground` | `oklch(0.985 0.005 160)` | `oklch(0.19 0.02 160)` |
| `--warning` | `oklch(0.55 0.13 65)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 65)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.5 0.1 245)` | `oklch(0.74 0.1 245)` |
| `--info-foreground` | `oklch(0.985 0.004 245)` | `oklch(0.19 0.015 245)` |
| `--field-1` | `oklch(0.8600 0.0700 343.00)` | `oklch(0.3300 0.1000 330.00)` |
| `--field-1-foreground` | `oklch(0.2083 0.0751 316.90)` | `oklch(0.9661 0.0246 317.72)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-azeret-mono-wf, "Azeret Mono", "Galmuri11", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-galmuri11-wf, "Galmuri11", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-galmuri11-wf, "Galmuri11", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Galmuri11 → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

## 원천 본문

## 선택 보드 3판 판정 (2026-09-28)

- 선택 보드 3판(2026-09-28)에서 운영자가 A(두 줄 제목 + 접힘선 아래 앱 창)를 「모션 움직임이 좀 단순해. 뭔가 아쉽달까. 좋은데 뭔가 하나 빠진 느낌이야.」로 부분 별로를 매기고, B(재단 표시 + 타자 제목)를 pick 했다. 결정 원본은 `factory/board/recipe-board3-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- 이 판정으로 B(재단 표시 + 고정폭 타자 제목 + 딱딱한 그림자 버튼, 히어로 `crop-marks-typed-title`)를 머리 기본값으로 승격했다. 색 논리 K6·다크 기본·모션 M1·기법 `view-transition`·`svg-draw`는 그대로다 — 바뀌는 축은 색·서체·히어로다.
- A(두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창, 히어로 `baseline-news-app-window`)는 `alternates`로 남긴다.
- 「뭔가 하나 빠진 느낌」이라는 신호에 맞춰, 이 대안(옛 A)에 커서를 따르는 행 강조 한 겹을 더했다(아래 「쓰는 법」). §8-1 MUST(데이터를 스타일 목적으로 굴리지 않는다)를 지키려 차트·KPI가 아니라 순수한 포인터 인터랙션으로 뒀다 — 새 기법 id는 늘리지 않고 모션도 M1 그대로다(M-level 정직: 이 정도 겹은 M2로 올릴 만큼 크지 않다).
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 이제 새 기본(옛 B)을 먼저 적고, 대안(옛 A)을 그 뒤에 적는다.

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **A안 유지** — 색 논리 K6 자홍 먹 띠 · 다크 기본 · 모션 M1 · 역동 기법 `view-transition`·`svg-draw` 그대로다. B안(K6 청록 먹 띠 + M2 + `clip-reveal`)은 고르지 않았다. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- `alternates`는 지웠다(보존하지 않음). B 값은 커밋 `8541c6f`의 머리와 보드 고정본 `factory/board/recipe-board/heads-at-board.json`에 남아 있다. 「이 레시피의 B안을 r1-measure B안과 함께 고르지 않는다」 줄은 두 B가 모두 버려져 뜻이 없어져 뺐다.
- 레시피 10벌의 다크 기본(div-01 「다크 ≥ 1」)은 이 레시피 하나다.

## 결정 기록 (2026-09-27, P3-1 Task 7)

방향 원천은 선정서 `docs/recipes/candidates-2026-09-27.md` r10-console 줄(N9 운영 콘솔, dashboard 전용)이다. 축·서체·원형·라이트 색(바탕·글자·primary·ring)은 선정서 값 그대로다. Task 6b 뒤 묶음 C를 대담하게 다시 짜라는 운영자 결정에 따라 **다크를 기본 테마로(`defaultTheme: dark`), 색 논리를 K1에서 K6 색 면으로** 바꿨다. 모션은 선정서 M1 그대로다 — dashboard는 M3가 금지이고(compat.json recipeRules, §8-6 div-06), 매일 쓰는 운영 화면이다(§8-1).

| 칸 | A 자홍 콘솔 (고름) | B 청록 먹 띠 (보드 B안) | C 다크 텔레메트리 + 네온 (버림) |
|---|---|---|---|
| 분위기 3단어 | 조밀 · 즉답 · 절제 | 조밀 · 차분 · 절제 | 기술 · 긴장 · 빛 |
| 축 | B3 I1 C1 T1 H4 R2 S0, M1 | 같음, M2 | B1 I3 C2 T4 H3 R0 S0, M1 |
| 색 논리 | K6 — 자홍 먹 면(상단 바 한 곳) + 자홍 선택·포커스, 다크 기본 | K6 — 청록 먹 면 + 자홍 선택·포커스 | 거의 검정 + 네온 초록 상태 |
| 서체 짝과 이유 | Sora 700(라틴 제목·KPI 숫자) + Pretendard(본문·한글 제목) + Plex Mono(ID·숫자 칸) | 같은 짝 | 모노 전면 |
| 이 안에서만 나오는 레이아웃 | 사이드 레일 앱 셸(H4) + 조밀 표(T1) + 자홍 먹 머리 띠 | 같은 틀, 청록 머리 띠 | 선 구획 계측 격자 |
| 레퍼런스 2개 | layout-l09 · pal-sns-instagram-dct4vqjmytn-4 | pal-sns-instagram-dudjznijp9d-1 · 공개 운영 콘솔 데모(주소는 적지 않는다) | 없음(상투 조합) |

- **버린 안: C.** 「거의 검정 + 형광 한 점」(§13)이고 r1-measure(N1 도면 계측)와 방향이 겹친다(선정서 「버린 방향」). 선 구획 격자도 r1의 얼굴이다.
- **다크 기본을 고른 이유(§5 MUST 「사용 장면으로 고른다」)**: 운영 콘솔은 관제실·야간 당직처럼 어두운 방에서 하루 종일 켜 두는 화면이다. 업종이 아니라 이 사용 장면으로 다크를 기본 미감으로 삼았다. 수동 전환은 설정 안의 보조로 둔다(해·달 스위치를 기본 부품처럼 달지 않는다). 라이트 테마는 보조로 같은 대비 기준을 채운다.
  - **§5 MUST 「테마 기본값은 시스템 설정」과의 관계(리뷰 M3, 판정 (a))**: §5-B 다크 기본 레시피는 **저장된 선택이 없으면 다크로 시작**하고, 사용자가 설정에서 라이트·시스템으로 바꾼다(선택은 저장해 첫 페인트 전에 적용). 시스템 설정을 따르는 선택지는 설정에 남는다 — 예: next-themes `defaultTheme="dark"` + `enableSystem`. README 생성 문구도 이 뜻으로 고쳤다. 이 예외 한 줄을 DESIGN.md §5 MUST 줄에 적는 일은 전역 규칙 문서라 컨트롤러 몫이다.
- **다크 바탕(§5-B div-05)**: `0.19 0.02 340` — L 0.12~0.22·C 0.01~0.04 대역 안의 자홍 기운 먹색이다. 순흑이 아니고, 얼굴색(주 버튼 먹 흰색·자홍 선택)은 형광 초록·주홍이 아니다(lint `dark-neon` 통과).
- **K6을 고른 이유와 주의(compat.json recipeRules caution)**: 브리프는 K1·K4 또는 주의를 달고 K6·K7을 허락했다. 계획 Task 6b 끝은 「묶음 C 3벌 모두 비골격(K6·K7·K8)」이라 K6을 골랐다 — 다크 기본만으로도 골격은 아니지만, 유채색 면 레시피 3벌(div-01)을 A 값으로 채운다. 유채색 면은 운영 화면의 의미색(상태·차트)과 다투므로 **면은 앱 셸 상단 바 한 곳에만** 쓴다(기준 시각·갱신 멈춤·전역 검색). KPI 줄·표·차트·상태 칸 뒤에는 깔지 않는다.
  - **KPI 줄을 면에서 뺐다(Task 7 fix 1 — 리뷰 I2)**: 첫 판은 KPI 줄도 자홍 먹 면이었다. 경고 KPI의 빨강 글자가 면 위에서 다크(기본) 4.45:1, 라이트 1.91:1로 떨어지고(success 2.01·warning 2.28·info 1.92), 선택·포커스 전용인 자홍이 KPI 줄 전체를 칠하면 「이 줄이 선택됨·경보」로 읽힌다(§5 의미색 분리, color-c10). KPI 줄은 바탕·카드 위에 두고 크기(Sora 600 tabular)로 위계를 준다.
  - **상단 바 위 조작(리뷰 I1)**: 첫 판은 라이트 상단 바 위 「갱신 멈춤」 버튼(먹 primary)이 면과 1.44:1, 포커스 링 1.75:1, 보조 글자 1.46:1이었다. 생성기의 `[data-face="field-1"]` 스코프가 이제 그 안의 primary·ring을 면 글자색으로, primary-foreground를 면 색으로, 보조 글자·입력 테두리를 면 글자색을 섞은 값으로 바꾼다. 잰 값은 「게이트 기록」. lint는 이것을 경고(`recipe-caution`)로 알린다 — 위반 0.
- **자홍의 쓰임**: 자홍 345°는 빨강 오류(27°)와 42° 떨어진 선택·포커스 전용이다 — 포커스 링, 선택 행(`accent`), 사이드 레일 현재 위치. 경고·오류는 의미색이 맡는다(§21-7 MUST). 증감은 빨강–초록 쌍 대신 부호 + 파랑–주황이다(§5 MUST) — 차트 1·2번이 파랑 252°·주황 60°다(라이트 1번 245°는 Tailwind sky-700과 OKLab 0.0048이라 252°로 옮겼다 — §5-A pal-04).
- **K6 면 색(div-02)**: field-1 라이트 `0.36 0.1 345`·다크 `0.33 0.09 345` — 짙은 면 대역 안. 면 색은 하나다(자홍 먹). 면 위 글자는 두 테마 모두 쟀다(「게이트 기록」).
- **모션 M1 + 기법 둘(div-06)**: `view-transition` — 목록 → 레코드 상세, 기간 필터 바꾸기 같은 뷰 전환(240~300ms, 요소 이름 하나에 하나). `svg-draw` — **조치 완료 체크 표시 한 번**(배정·상태 변경이 끝났다는 피드백)에만. 차트 선·스파크라인은 그리지 않는다 — 사용자가 읽는 데이터는 스타일 목적으로 움직이지 않는다(§8-1 MUST). 동작 줄이기에서는 전환 길이 0, 체크는 완성 상태다.
- **B안: 청록 먹 띠.** 같은 K6에서 면만 청록 먹 220°로 바꿔, 자홍을 선택·포커스에만 남긴다(면적상 더 절제된 얼굴). 모션 M2 + 오른쪽 상세 패널 `clip-reveal`. 부분 조합(색만·모션만·기법만)도 모두 lint를 통과한다.
- **색 수 판단**: `refs-v2/samples.jsonl` dashboard 10곳의 유채색 수 중앙값은 2(2개 이하 6곳)이고 주 색상각은 10곳 중 7곳이 180~240°(청록·파랑)다. 이 레시피는 얼굴 색을 자홍 한 묶음으로 두고(무채 먹 + 자홍 1), 차트·의미색은 따로 둔다. 파랑 일색인 대시보드 분포와 색상각으로 떨어진다(r1·r4·r6의 파랑과도 겹치지 않는다).
- **팔레트 인용**: `pal-sns-instagram-dcmlsefiicy-2`(자홍 기운 먹 `0.17 0.03 1` + 밝은 면 `0.94 0.02 0`, 단색)에서 다크 바탕의 자홍 기운 먹색을, `pal-sns-instagram-dct4vqjmytn-4`(자홍~보라 짙은 램프 `0.14 0.06 330` · `0.36 0.09 317` · `0.5 0.07 358`)에서 자홍 먹 면의 명도·채도를 빌렸다. B안의 청록 먹은 `pal-sns-instagram-dudjznijp9d-1`(`0.39 0.07 225`, quiet luxury)의 색상각이다. 셋 다 augmented가 아닌 원본 팔레트이고 hex를 옮기지 않았다(§5-A).
- **서체**: Sora·Pretendard·IBM Plex Mono 모두 SIL OFL 1.1(키트 항목 `meta.license`). §13·banlist에 없다. Sora는 라틴 전용이라 **한글 제목 서체는 Pretendard 700**이다(선정서 M5 — dashboard 세 벌의 한글 서체가 r1 Plex KR · r4 Noto Sans KR · r10 Pretendard로 모두 다르다). 로더는 Sora 1 + Plex Mono 1(공유) + Pretendard css 1이다.
- **아이콘**: lucide, 결 G3(각진 2px — 기술). tabler G3은 r2가 쓴다.
- **대비(lint와 같은 `contrast-lib ratio`)**: 다크(기본) 글자/바탕 15.99 · muted 9.54 · 주 버튼 글자/primary 14.75 · ring/바탕 7.53 · 입력 테두리 4.65 · 선택 행 글자/accent 11.56 · 자홍 먹 면 글자 11.33. 라이트 글자/바탕 16.86 · muted 7.26 · ring 6.07 · 입력 3.69 · 면 글자 10.46. B안 청록 먹 면 글자 라이트 9.27 · 다크 10.46.
- **AI 티 점수**: 아래 「게이트 기록」.

### 게이트 기록

- lint 위반 0, 경고 1(`recipe-caution` K6 × dashboard — 위 「K6을 고른 이유와 주의」, 면은 상단 바 한 곳). 새 규칙 `face-contrast`·`primary-surface` 포함 A·B 모두 통과. B안 부분 조합 7개 모두 통과. qa:distinct 10벌 문제 없음(r1-measure와 축 6개 다름, 대표 면 자홍 345°는 K6 얼굴 가운데 가장 가까운 r1 B안 255°와 90°).
- 첫 판 lint 위반 1: 라이트 `chart-1` `0.5 0.12 245`가 Tailwind sky-700과 OKLab 0.0048(§5-A pal-04) → `0.5 0.11 252`로 옮겼다.
- 면 스코프 비율: field-1 면 조각 10% · 보조 글자 80% · 테두리 50%.
- `/qa/recipes?r=r10-console`: run --strict 0(ux-gate는 라이트·다크 모두) · hit-area fine 34개 실패 0 · coarse 34개 실패 0.
- **AI 티 점수 G 12/239**(kas 8/35) — G018 · G078 · G084 · G088×4 · G126 · G135×4, 모두 검수대 틀·면 견본 구획 쪽. 같은 빌드(741d7d2 + Task 7 fix 1, 차가운 캐시)에서 r1-measure를 대조로 함께 쟀다 — r1 G 12.
- **상단 바 위의 조작**(리뷰 I1 — 라이트 「갱신 멈춤」 버튼 1.44·링 1.75이던 자리): 갤러리 「면 위의 조작」 견본(크기 위계 벤토: 첫 면이 큰 칸에 주 버튼·외곽선 버튼·입력·체크, 나머지 면은 작은 칸마다 조작 하나)을 CDP로 쟀다 — 라이트·다크를 `prefers-color-scheme`으로 따로 띄우고, Tab 키 뒤 `focus()`로 `:focus-visible` 링을 켠 계산 색(canvas sRGB)으로.
  - 라이트 field-1: 포커스 링 **10.46** · 주 버튼 채움/면 10.46 · 버튼 글자 10.46 · 입력 테두리 3.66 · 보조 글자 7.14 · 체크 10.46.
  - 다크(기본) field-1: 링 11.34 · 입력 3.76 · 보조 글자 7.59.
- 한글 제목 서체(CDP): Sora는 라틴 전용이라 첫 family는 `Sora`이고, 그린 서체는 한글 글자 Pretendard Variable + 숫자·라틴 Sora다(`CSS.getPlatformFontsForNode`). 한글 제목 서체는 Pretendard 700이다.
- 동작 줄이기(CDP, 갤러리 `prefers-reduced-motion: reduce`): 레시피 칸의 모션 토큰 `--duration-enter` 300ms(.3s) → 0s, `--duration-sheet`·`--duration-hover`·`--duration-press`·`--duration-popover` 모두 0s(factory-base가 토큰 자체를 접는다 — 리뷰 I7). 프리셋은 `animation: none`, 전환·지연은 0.

## 분위기

어두운 방에서 하루 종일 켜 두는 운영 콘솔이다. 첫 화면 가운데 영역 네 모서리에 16px L자 재단 표시가 있고, 그 안에 고정폭 대문자 세 줄이 가운데 정렬로 앉으며 마지막 낱말이 커서와 함께 타자로 써진다. 버튼은 ▸ ◂ 표식과 아래쪽 4px 딱딱한 그림자를 진다. 아래 가운데에는 터미널 창이 접힘선을 넘는다. 대안(`alternates`)은 자홍 기운이 도는 먹색 바탕에 좁은 산세리프 제목 두 줄이 왼쪽에 서고, 같은 기준선 오른쪽 끝에 「New」 한 줄이 붙는다. 세로 절반쯤부터 앱 창이 접힘선 너머로 이어지고, 창 머리 띠만 자홍 먹 면이다. 목록 행을 고르면 행 제목이 상세 머리로 날아가 붙고, 행 위에서는 커서를 따라 은은한 강조가 함께 움직인다.

## 쓰는 법

- 원형은 운영 대시보드(dashboard) 하나다. 종류는 **운영형**(지금 조치할 것을 알린다)을 기본으로 한다(§21-7).
- 다크가 기본 테마다: 저장된 선택이 없으면 `<html class="dark">`와 `color-scheme: dark`로 시작하고(첫 페인트 전), 사용자가 설정에서 라이트·시스템을 고를 수 있게 한다.
- 첫 화면(제품 소개면)은 히어로 `crop-marks-typed-title`(대안 `baseline-news-app-window`)다.
  - 기본: 첫 화면 가운데 영역 네 모서리에 16px L자 재단 표시, 고정폭 대문자 세 줄 가운데 정렬, 버튼은 ▸ ◂ 표식 + 아래쪽 4px 딱딱한 그림자(그림자는 감싼 칸이 들고 버튼의 포커스 링은 그대로다), 아래 가운데 터미널 창이 접힘선을 넘는다.
  - 대안: 제목 두 줄(4.4vw, 600, 행간 1.0)을 세로 약 30%에 왼쪽 정렬, 한 줄 설명과 같은 기준선 오른쪽 끝에 「New · 항목 →」. 폭 92% 앱 창(사이드바 232px + 알림 목록 + 상세, 1px 선, 반경 12px)이 접힘선을 넘는다.
- 앱 셸: 왼쪽 사이드 레일(H4, 텍스트 라벨 상시·기본 펼침) + 상단 바. 상단 바(첫 화면에서는 터미널 창 머리)가 자홍 먹 면(`bg-field-1`, 글자 `text-field-1-foreground`, **`data-face="field-1"`**)이다. 면 글자 대비 11.52(다크 11.53), 대안 8.97.
- 면은 상단 바 한 곳만. KPI 줄은 바탕·카드 위에 두고 Azeret Mono 600 tabular 크기로 위계를 준다. 표·차트·상태 칸 뒤에는 면을 깔지 않는다.
- 표는 T1 조밀(행 32px), 숫자 칸은 `data-numeric` + tabular-nums(Plex Mono), 첫 열은 사람이 읽는 이름이다. 선택 행은 muted 면, 일괄 작업은 「n개 선택됨」 + 표 위 작업 막대다.
- 제목은 `font-heading`이다: 라틴·KPI 숫자는 Azeret Mono 600(대안 Antonio 600), 한글 제목은 갈무리11(대안 오르빗) — 페이지 제목·빈 상태에만. 운영 화면 크기는 1.2 비율 19 · 23 · 28 · 33px에서 멈추고, 큰 디스플레이는 제품 소개면 첫 화면뿐이다.
- 반경은 R2(작은 컨트롤 6~8px), 버튼 B3 8px, 카드 C1 헤어라인 + 그림자 없음(S0).
- 모션 M1(hover 150ms, 등장 300ms). 역동 기법 둘:
  - `view-transition` — 대안 목록 행 → 상세 패널. 행의 제목이 상세 머리로 날아가 붙는다(`view-transition-name` 공유, 300ms `cubic-bezier(0.32, 0.72, 0, 1)`), 나머지는 150ms 교차 페이드. 이름은 요소 하나에 하나, 동작 줄이기·미지원 브라우저는 즉시 교체.
  - `svg-draw` — 상세의 추이 선과 조치 완료 체크 표시를 한 번 긋는다(`pathLength="1"`). 기본(재단 표시)에서는 뒤로 선 와이어 구를 한 번 긋는다.
  - **커서를 따르는 행 강조(3판, 2026-09-28 추가 — 대안 전용, 새 기법 id 아님).** 대안의 앱 창 알림 목록에서, 포인터가 행 위를 지나면 은은한 강조 띠(accent 10% 섞음)가 커서의 세로 위치를 20ms `ease-out`로 따라간다 — hover된 행 자체의 배경이 아니라 커서 위치를 읽는 한 겹 얇은 층이라 「지금 어디를 보고 있나」만 알린다. 실제 데이터(수치·차트)는 건드리지 않아 §8-1 MUST를 지킨다. 마우스에서만 켜지고(포인터 겹, 터치에서는 꺼진다), 커서 깜빡임 같은 반복은 화면 밖·숨은 탭에서 멈춘다. 격자 점 무한 애니메이션은 쓰지 않는다.
  - 동작 줄이기에서는 커서 강조를 켜지 않는다(정적 hover 배경만).
- 상태는 색과 글자·아이콘을 함께 쓴다. 경고색은 조치가 필요한 항목에만.

## 하지 말 것

- 거의 검정 바탕에 형광 초록·주홍 한 점을 두지 않는다(§13). 기본 바탕은 L 0.19 자두 먹, 대안 바탕은 L 0.19 자홍 먹이다.
- 자홍(대안 분홍)을 경고·오류·증감 표시로 쓰지 않는다. 선택·포커스·현재 위치·주 버튼뿐이다.
- 자홍 먹 면을 KPI 줄·표·차트·상태 칸 뒤에 깔지 않는다. 면은 상단 바(첫 화면에서는 터미널 머리·대안은 창 머리 띠) 한 곳이다.
- 상단 바에 `data-face` 없이 면 색만 칠하지 않는다.
- 증감을 빨강–초록으로 칠하지 않는다. 부호 + 파랑–주황이다.
- 차트 선·스파크라인·KPI 숫자를 운영 화면에서 그리거나 굴리며 등장시키지 않는다(§8-1). 긋는 선은 제품 소개면과 조치 완료 표시뿐이다. 커서를 따르는 행 강조도 데이터를 굴리지 않는다 — 위치만 읽는다.
- 3D 기울임·자석·스크롤 등장을 쓰지 않는다(M3 금지, dashboard).
- 고정폭·도트 서체를 라벨·캡션·상태 이름에 쓰지 않는다. 모노는 ID·숫자 칸·코드와 기본 첫 화면 제목·버튼 라벨만이다.
- 버튼 자신에 box-shadow 로 딱딱한 그림자를 달지 않는다. 포커스 링이 box-shadow 라 가려진다 — 감싼 칸에 단다.
- 사이드바를 아이콘만 남긴 축소 상태로 기본 두지 않는다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r10-console.md`. 레시피에는 사이트 이름을 적지 않는다.
- 기본 = 카드 수 2(재단 표시 + 타자 제목 + 딱딱한 그림자 버튼) · 새 팔레트: 측정 사이트 2의 회백 `#EEEDE8` → 라이트 바탕·숯 `#2D2B2D`·`#181618` → 라이트 글자·밝은 회백 글자 `#E6E5DE` → 다크 글자 + SNS 팔레트 `pal-sns-instagram-de9uynfabjg-2`(분홍 `#F2C0DD` 면·accent·다크 주색 · 자두 먹 `#25092E` 라이트 주색) · Azeret Mono + 갈무리11. 측정 사이트의 형광 민트는 쓰지 않았다(§13).
  - 카드와 다르게 둔 것: 다크 기본이라 회백 첫 화면이 자두 먹 밤으로 그려진다(라이트 테마는 회백), 응축 대문자 대신 배정표의 고정폭 제목, 타자 커서는 글리프가 아니라 1/10em 막대, 신호등 점은 빨강·노랑·초록 대신 면 토큰 셋.
  - 딱딱한 그림자 색(Task 10d fix — 리뷰 b2 M6): 카드의 `var(--foreground)` 대신 면 색 `var(--field-1)`이다. 다크 기본에서 foreground 는 거의 흰색이라 흰 띠 그림자가 먹 버튼보다 밝게 떠 「눌러 내려앉는」 결이 사라진다. 면 색 하나가 그림자를 맡아 K6 「면 한 곳」 안에 머문다. 히어로의 고정 반경(6·8·12px)은 P3-2 블록으로 옮길 때 반경 축 훅으로 바꾼다.
- 대안 = 카드 수 1(두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창) · 카드 팔레트 그대로(`pal-sns-instagram-dpbpoicj3j4-4` + 측정값) · Antonio + 오르빗. 앱 창은 레시피 부품으로 새로 짰다(앱 스크린샷 복제 없음).
  - 카드와 다르게 둔 것: 카드의 알약 가입 버튼은 흰색이 아니라 자홍 주색(B3), 첫 화면에서 한 번 스스로 행을 골라 전환을 보인다(6초 녹화 안). 3판(2026-09-28)에서 알림 목록에 커서를 따르는 행 강조를 더했다(위 「쓰는 법」).
- 색 논리 K6·다크 기본·모션 M1·기법 `view-transition`·`svg-draw`는 선택 보드 판정(Task 9) 그대로다. 대안도 같은 K6이다.
- 위 「선택 보드 판정」·「결정 기록」·「선택 보드 2판 판정」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절, 그리고 맨 위 「선택 보드 3판 판정」이 정한다(Task 14, 2026-09-28).

## 레퍼런스에서 가져온 기법

- layout-l09 : 1순위 카드를 크게 — 조치 영역이 첫 화면의 가장 큰 칸이다.
- component-k17 : 한 줄 KPI 셀, 대부분은 여백만으로 나눈다.
- component-k05 : 상태를 색·글자·아이콘으로 함께 표현한다.
- component-d06 : 불확실성·기준을 수치 옆에 붙인다(§21-7 판단 기준).
- color-c10 : 의미 색을 브랜드 색과 분리한다 — 자홍은 선택·포커스, 상태는 의미색.
- pal-sns-instagram-dcmlsefiicy-2 : 자홍 기운 먹 단색 — 다크 바탕의 근거.
- pal-sns-instagram-dct4vqjmytn-4 : 자홍 짙은 램프 — 자홍 먹 면(field-1)의 명도·채도 근거.
- pal-sns-instagram-dudjznijp9d-1 : 청록 먹 225° — 지난 B안(보드 당시)의 색상각.
- pal-sns-instagram-dpbpoicj3j4-4 : 명료·믿음 팔레트 — 대안 글자·자홍 주색·면의 근거.
- pal-sns-instagram-de9uynfabjg-2 : 분홍 + 자두 먹 단색 — 기본 면·주색의 근거.
</content>
