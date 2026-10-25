<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 흑백 신호 (`r2-signal`) — 레시피 안내

원천: `registry/factory/recipes/r2-signal/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r2-signal#v0.2.1        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r2-signal-theme#v0.2.1  # 색만(registry:theme)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r2-signal-alt#v0.2.1    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r2-signal-<부품>`(예: `r2-signal-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r2-signal/r2-signal.css` 를 붙인다.

## 한눈에

- 분위기: 단정 · 대담 · 신호
- 첫 화면 히어로: cropped-title-list(오른쪽 끝에서 잘리는 제목 목록)
- 맞는 원형: brand · portfolio · public · landing
- 스타일 축: 반경 R0 · 버튼 B1 · 입력 I3 · 표면 C2 · 표 T3 · 머리 H3 · 그림자 S1
- 모션 M1 · 아이콘 tabler G3(부품이 부르는 어댑터 `components/icons/tabler` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: square · --icon-linejoin: miter)
- 서체: 제목 Bricolage Grotesque(`font-bricolage-grotesque`, 굵기 500 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면 제목 목록 전용. 굵기 500, 6.6vw(390에서 10.8vw)·행간 0.86·자간 -0.03em, 한 줄에 한 항목을 쌓아 오른쪽 끝에서 자른다. 28~50px 제목은 자간 -0.02em) · 한글 제목 Do Hyeon(`font-do-hyeon`) · 본문 Gothic A1(`font-gothic-a1`, 조정: 본문 16px/1.7 굵기 400. 큰 한글 제목은 한글 제목체(현재 Do Hyeon, 대안 Moirai One, 둘 다 굵기 하나)가 그리고, 이 서체는 본문·부제(700)와 부품 제목 칸(16~18px — 한글 제목체를 건너뛴 스택)의 한글을 제 굵기로 그린다. 한글 제목 행간 1.1(받침 보호), 48px 이상 자간 -0.03em, 캡션도 본문 서체 16px(최소 14px)) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: I3 숫자 입력(전화·수량)·data-numeric 칸에만, 굵기 400. 라벨·캡션·번호에는 쓰지 않는다)
- 레퍼런스: layout-l11 · layout-l12 · color-c04 · type-portfolio-h1-ratio-high · pal-sns-instagram-dapad3qkle0-2 · pal-sns-instagram-dpbpoicj3j4-2
- 색 논리 K7(듀오톤) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `split-text`(글자 분할 등장) · `oversize-crop`(오버사이즈 타입 크롭) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K7 그대로) · 서체 Dela Gothic One · Moirai One · 첫 화면 inline-chip-title — DNA 수 2(문장 속 칩 + 대괄호 캡션 대칭) — 보라 잉크·민트 면 새 팔레트(pal-sns-instagram-dpbpoicj3j4-2 + 측정 사이트의 회청 바탕·먹 글자), 제목 Dela Gothic One·Moirai One. 색 논리 K7·모션 M1·기법 split-text·oversize-crop 은 A 그대로. 선택 보드 2판(2026-09-28)에서 한 번 머리로 올라갔다가(Task 10f, 커밋 f00aee5), 3판(2026-09-28)에서 운영자가 원래 안을 다시 pick 해 대안으로 돌아왔다. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9318 0.0110 274.89)` | `oklch(0.1840 0.0081 285.58)` |
| `--foreground` | `oklch(0.2350 0.0000 0.00)` | `oklch(0.9318 0.0110 274.89)` |
| `--card` | `oklch(0.9618 0.0068 277.16)` | `oklch(0.2205 0.0116 285.41)` |
| `--card-foreground` | `oklch(0.2350 0.0000 0.00)` | `oklch(0.9318 0.0110 274.89)` |
| `--popover` | `oklch(0.9618 0.0068 277.16)` | `oklch(0.2205 0.0116 285.41)` |
| `--popover-foreground` | `oklch(0.2350 0.0000 0.00)` | `oklch(0.9318 0.0110 274.89)` |
| `--primary` | `oklch(0.4400 0.1888 300.61)` | `oklch(0.7437 0.1150 299.91)` |
| `--primary-foreground` | `oklch(0.9618 0.0068 277.16)` | `oklch(0.1840 0.0081 285.58)` |
| `--secondary` | `oklch(0.8651 0.0097 279.67)` | `oklch(0.2338 0.0134 285.32)` |
| `--secondary-foreground` | `oklch(0.2350 0.0000 0.00)` | `oklch(0.9318 0.0110 274.89)` |
| `--muted` | `oklch(0.8651 0.0097 279.67)` | `oklch(0.2338 0.0134 285.32)` |
| `--muted-foreground` | `oklch(0.3211 0.0000 0.00)` | `oklch(0.7777 0.0143 277.00)` |
| `--accent` | `oklch(0.8881 0.0332 297.16)` | `oklch(0.2763 0.0371 297.70)` |
| `--accent-foreground` | `oklch(0.2350 0.0000 0.00)` | `oklch(0.9318 0.0110 274.89)` |
| `--border` | `oklch(0.5463 0.0093 278.50)` | `oklch(0.5050 0.0160 276.80)` |
| `--input` | `oklch(0.5463 0.0093 278.50)` | `oklch(0.5886 0.0184 278.28)` |
| `--ring` | `oklch(0.5147 0.1069 162.71)` | `oklch(0.8233 0.1683 161.50)` |
| `--field-1` | `oklch(0.8233 0.1683 161.50)` | `oklch(0.7441 0.1516 161.90)` |
| `--field-1-foreground` | `oklch(0.1766 0.0228 163.44)` | `oklch(0.1680 0.0222 162.07)` |

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
- K7 듀오톤: field-1 이 한 색(면), primary 가 다른 색(잉크·CTA)이다. 면적은 대략 45·45·10(나머지 중립). 두 색 사이에 그라디언트를 넣지 않는다.

**면 구획에는 `data-face` 속성을 단다** — `<section class="bg-field-1 text-field-1-foreground" data-face="field-1">`. 레시피 CSS(registry css·순수 CSS)가 `[data-face="<키>"]` 스코프마다 `--background`·`--foreground`·`--primary`·`--primary-foreground`·`--ring`·`--border`·`--input`·`--muted`·`--muted-foreground`·`--accent`·`--accent-foreground`·`--secondary`·`--secondary-foreground` 를 그 면의 짝으로 다시 가리킨다. 그래서 면 안의 부품(주 버튼·포커스 링·보조 글자·입력 테두리·체크)이 면 위에서 대비를 지킨다(lint `face-contrast` — 두 테마, 글자 4.5 · 링·테두리·채움 3). 면 안에 놓인 카드(`[data-slot="card"]`)와 `[data-face-reset]` 요소는 레시피 원래 값으로 돌아간다. `data-face` 없이 면 색만 칠하면 바탕 기준 토큰이 그대로 남아 링·버튼이 사라질 수 있다.

- `[data-face="field-1"]`: 면 조각(muted·accent·secondary) = field-1-foreground 10% · 보조 글자 100% · 테두리·입력 56% (나머지는 field-1)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9913 0.0013 286.38)` | `oklch(0.1510 0.0064 285.61)` |
| `--foreground` | `oklch(0.1638 0.0000 0.00)` | `oklch(0.9640 0.0029 264.54)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1931 0.0080 285.63)` |
| `--card-foreground` | `oklch(0.1638 0.0000 0.00)` | `oklch(0.9640 0.0029 264.54)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1931 0.0080 285.63)` |
| `--popover-foreground` | `oklch(0.1638 0.0000 0.00)` | `oklch(0.9640 0.0029 264.54)` |
| `--primary` | `oklch(0.4414 0.2923 266.56)` | `oklch(0.7387 0.1695 283.30)` |
| `--primary-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1510 0.0064 285.61)` |
| `--secondary` | `oklch(0.9644 0.0045 214.33)` | `oklch(0.2146 0.0099 276.58)` |
| `--secondary-foreground` | `oklch(0.1638 0.0000 0.00)` | `oklch(0.9640 0.0029 264.54)` |
| `--muted` | `oklch(0.9644 0.0045 214.33)` | `oklch(0.2146 0.0099 276.58)` |
| `--muted-foreground` | `oklch(0.3679 0.0143 269.30)` | `oklch(0.7959 0.0144 272.65)` |
| `--accent` | `oklch(0.9389 0.0121 281.08)` | `oklch(0.2396 0.0230 280.79)` |
| `--accent-foreground` | `oklch(0.1638 0.0000 0.00)` | `oklch(0.9640 0.0029 264.54)` |
| `--destructive` | `oklch(0.47 0.16 18)` | `oklch(0.7 0.13 20)` |
| `--border` | `oklch(0.6275 0.0154 272.57)` | `oklch(0.4935 0.0163 272.47)` |
| `--input` | `oklch(0.5422 0.0144 271.14)` | `oklch(0.5780 0.0202 275.41)` |
| `--ring` | `oklch(0.5303 0.2152 25.45)` | `oklch(0.6946 0.1975 16.76)` |
| `--success` | `oklch(0.5 0.1 150)` | `oklch(0.74 0.11 150)` |
| `--success-foreground` | `oklch(0.985 0.005 150)` | `oklch(0.19 0.02 150)` |
| `--warning` | `oklch(0.56 0.12 65)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 65)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.48 0.12 245)` | `oklch(0.74 0.1 245)` |
| `--info-foreground` | `oklch(0.985 0.004 245)` | `oklch(0.19 0.015 245)` |
| `--field-1` | `oklch(0.4500 0.2152 25.45)` | `oklch(0.4770 0.1934 25.11)` |
| `--field-1-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(1.0000 0.0000 0.00)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-bricolage-grotesque-wf, "Bricolage Grotesque", "Do Hyeon", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-do-hyeon-wf, "Do Hyeon", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-do-hyeon-wf, "Do Hyeon", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Do Hyeon → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 Do Hyeon는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다. 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 한글 제목체를 건너뛴 제목 스택(라틴 Bricolage Grotesque → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.

## 원천 본문

## 선택 보드 3판 판정 (2026-09-28)

- 선택 보드 3판(2026-09-28)에서 A·B 모두 좋다로 매기고 B를 pick 했다. 결정 원본은 `factory/board/recipe-board3-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- **글자가 뒤바뀐다.** 2판(Task 10f, 커밋 f00aee5)에서 B(문장 속 칩 + 대괄호 캡션 대칭)를 머리로 승격했었다. 3판 보드는 그 뒤 상태를 다시 A·B로 펼쳐 보였으므로, 3판의 A = 그때의 머리(칩·캡션, `inline-chip-title`), 3판의 B(pick) = 그때의 alternates(오른쪽 끝에서 잘리는 제목 목록, `cropped-title-list`)다.
- 이 pick으로 **2판의 승격을 되돌린다**: `cropped-title-list`(오른쪽 끝에서 잘리는 제목 목록·빨강 면·Bricolage Grotesque + Do Hyeon)를 다시 머리 기본값으로 되돌렸다. 색 논리 K7·모션 M1·기법 `split-text`·`oversize-crop`은 그대로다 — 바뀌는 축은 색·서체·히어로뿐이다.
- `inline-chip-title`(회청 주사선 바탕·민트 면·Dela Gothic One + Moirai One)은 다시 `alternates`로 남긴다.
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 다시 이 기본(2판 이전의 A)을 먼저 적고, 대안(2판 기본이었던 B)을 그 뒤에 적는다.

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28)에서 운영자가 A를 별로로 매기며 「움직임이 너무 단순하고, 글자만 가득 채워져 있는게 좀 보기 안 좋음」(부분 판정: 색 좋다 · 글씨체 좋다 · 배치 별로 · 모션 별로)이라 적고 B(문장 속 칩 + 대괄호 캡션 대칭)를 pick 했다. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- 이 판정으로 B(회청 주사선 바탕·민트 면·Dela Gothic One + Moirai One·히어로 `inline-chip-title`)를 머리 기본값으로 승격했다. 색 논리 K7·모션 M1·기법 `split-text`·`oversize-crop`은 그대로다 — B가 바꾸는 축은 색·서체·히어로뿐이다.
- 옛 A(오른쪽 끝에서 잘리는 제목 목록·빨강 면·Bricolage Grotesque + Do Hyeon)는 `alternates`로 남긴다. 운영자가 부분 조합이 아니라 안 전체로 판정했고, A가 바뀌지 않는 축(K7·M1·`split-text`·`oversize-crop`)을 B와 공유해 `alternateCombos`가 lint를 그대로 통과하기 때문이다.
- 아래 「분위기」·「쓰는 법」·「하지 말 것」은 이제 새 기본(옛 B)을 먼저 적고, 대안(옛 A)을 그 뒤에 적는다. — **3판이 이 절의 승격을 되돌렸다(위 절).**

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체)** — 색 논리 K4 → **K7 듀오톤**, 모션 M0 → **M1**, 역동 기법 `oversize-crop`·`blend` → **`split-text`·`oversize-crop`**. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 머리로 옮긴 색(보드 B 값 — 면은 명도만 조정): 라이트 `field-1` `0.52 0.2 28` → **`0.43 0.2 28`**(신호 빨강 면)·`field-1-foreground` `0.985 0.003 28`, `primary`·`sidebar-primary` 먹 → 코발트 `0.42 0.18 262`. 다크 `field-1` `0.5 0.17 28` → **`0.46 0.17 28`**, `primary`·`sidebar-primary` `0.8 0.1 262`. 나머지 색(바탕·먹 글자·링 빨강·상태색)은 A 그대로다. `alternates`는 지웠다 — 보드에서 고른 B가 이제 머리 값이다.
- 대비 관문을 위해 명도만 조정(컨트롤러 판정, 운영자 선택 색상·채도 유지): 보드 값의 면 글자 대비(라이트 5.84·다크 6.26)로는 「면 위의 조작」 견본의 면 보조 글자가 본문 7:1 관문(ux-gate)에 닿지 못했다. 면의 L만 내렸다. 대비(lint와 같은 `contrast-lib ratio`): 라이트 면 글자/빨강 면 **7.95** · 주 버튼 글자/코발트 8.45 · 코발트/바탕 8.45, 다크 면 글자/면 **7.45** · 주 버튼 글자/코발트 9.86 · 코발트/바탕 10.21. 면 스코프 보조 글자 7.68·7.21. 생성기 `faceTokens`는 이제 면 보조 글자를 닿을 수 있으면 7.15 이상으로 고른다(렌더 여유 `FACE_RENDER_MARGIN` 0.15 — 브라우저 렌더가 계산값보다 0.05~0.1 낮게 나와 r3 다크 block-1이 계산 7.01·렌더 6.94로 관문에 걸렸다).
- 바뀐 것: 빨강은 「신호 한 점」에서 「면을 나눠 갖는 두 색 중 하나」가 되고, 주 버튼은 먹에서 코발트가 된다. 아래 Task 5 결정 기록의 「색은 빨강 하나」·「빨강 면적 3~5%」·「주 버튼 먹」·M0·`blend` 문장은 A안을 고를 때의 판단으로 남긴다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. 흑백 사진·계단 제목·N9 내비·직각 크롬·서체 짝은 그대로다.
- 남은 주의: 오류색 destructive(18°·L 0.47)와 빨강 면(28°·L 0.43)이 가깝다. 오류는 늘 아이콘과 글자를 함께 쓰고, 빨강 면 안에 오류 문구를 두지 않는다(「하지 말 것」).
- AI 티 점수(명도 조정 뒤 다시 잼, 같은 빌드 r1 대조 12): G **12**/239(kas 6/35) — 기준선과 같다.
- 갤러리 관문(명도 조정 뒤, `/qa/recipes?r=<id>`): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 5)

방향 원천은 dribbble-summary §6 R2(스위스·흑백·신호)와 style_axes N6(포스터 타이포)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r2-signal 줄을 그대로 따랐다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 흑백 신호 (고름) | B 흑백 코발트 (남김, 안 씀) | C 야간 텔레메트리 (버림) |
|---|---|---|---|
| 분위기 3단어 | 단정 · 대담 · 신호 | 단정 · 정확 · 공학 | 야간 · 경계 · 조밀 |
| 축 | B1 I3 C2 T3 H3 R0 S1, M0 | B1 I3 C2 T3 H3 R0 S1, M0 | B3 I1 C1 T1 H4 R1 S0, M1 |
| 서체 짝과 이유 | Archivo 800(라틴 제목) + Gothic A1(본문, 한글 제목 800). 음수 자간의 넓은 그로테스크가 포스터 활자를 맡고, 한글은 획이 곧은 고딕으로 같은 결을 잇는다 | 같은 짝 | Barlow Condensed + Pretendard. 좁은 벽 화면용 응축형 |
| 색 3개 + 강조 1 | 흰 종이 · 먹 · 중간 회색 + 신호 빨강(hue 28) | 흰 종이 · 먹 · 중간 회색 + 코발트(hue 260) | 먹색 바탕(L 0.17) · 밝은 회색 · 중간 회색 + 빨강·터미널 초록 한 점 |
| 사진·그림 | 흑백 사진(채도 0), 색은 사진 밖 신호 하나 | 흑백 사진 | 사진 없음, 로그·실시간 선 |
| 이 안에서만 나오는 레이아웃 | 화면 폭 가득한 3줄 계단 제목(layout-l11) + 45:55 사진 분할(layout-l12) + 가장자리에 붙인 워드마크 내비(N9) | 같은 틀 | 12열 경보 벽 |
| 레퍼런스 2개 | layout-l11 · color-c04 | layout-l11 · 해외 정부 디자인 시스템의 페이지 견본 | 모니터링 대시보드 표본 둘 |

- **버린 안: C.** 먹색 바탕에 빨강·초록 한 점만 채도를 갖는 구성은 §13 「거의 검정 + 형광 초록·주홍 한 점」 그 자체다. 방향도 r1-measure(N1 계측)와 겹친다.
- **남긴 안: B.** 상투 표에는 걸리지 않는다. 그러나 파랑 강조는 r1(255°)·r6(258°)과 겹쳐 보드에서 「다 비슷하다」가 된다. 파랑은 이 레시피에서 정보 상태색(info)으로만 남겼다.
- **고른 안: A.** 방문자 모드는 설득(brand·portfolio)과 안내(public)다. 선정서 행 메모대로 r1과는 활자 규모·흑백 사진·빨강 신호 세 가지로 갈린다(축은 T·S 두 개만 다르다).
- **크롬 구분(0 계열 세 벌, 선정서 리뷰 I3)**: r1·r2·r3은 B1·I3·C2·H3·R0이 같다. r2는 여기서 셋을 바꾼다. S1이라 팝오버·다이얼로그·스티키 헤더 아래에 여러 겹 틴트 그림자가 생기고(r1은 그림자 없음, r3은 단색 오프셋), 표는 T3이며, 내비는 N9 edge-aligned(큰 워드마크를 왼쪽 끝, 성긴 링크를 오른쪽 끝)다.
- **교체 가능성 검사로 고친 것**
  - 선택 칸(accent)을 옅은 분홍으로 두는 안을 검토했다. 메뉴를 열 때마다 분홍 면이 깔리면 빨강이 신호가 아니라 장식이 된다. accent 면은 무채 회색으로 두고, 빨강은 포커스 링·토글 선택 링(ring)·메뉴에서 가리키는 칸의 글자(accent-foreground)·차트 1번·큰 제목 한 줄에만 둔다.
  - 갤러리(`/qa/recipes?r=r2-signal`, 1440 라이트) 첫 화면에는 빨강이 없다. 견본 틀이 헤더·KPI·글자 크기로 시작하고, 이 레시피의 큰 계단 제목·흑백 사진은 견본에 없기 때문이다. 쉬는 화면의 빨강은 아래쪽 토글 선택 링과 차트 1번 선에서 보인다. 「지금 가리키는 곳」 약속을 메뉴에도 잇도록, 드롭다운·셀렉트·메뉴바에서 포인터·키보드가 가리키는 칸의 글자(accent-foreground)를 빨강(L 0.49 C 0.19, 회색 면 위 5.53:1 · 다크 L 0.8 C 0.12, 6.92:1)으로 두었다. 주 내비의 현재 위치는 부품이 밑줄로 그린다(색 토큰 아님).
  - 오류색이 신호 빨강과 같은 색이면 「지금 가리키는 곳」과 「잘못된 곳」이 구분되지 않는다. destructive는 hue 18·L 0.47의 더 어둡고 차가운 진홍으로 떼었다(신호는 hue 28·L 0.55). 오류는 늘 아이콘과 글자를 함께 쓰므로 색만으로 가르지 않는다(§5 MUST).
  - 다크에서 빨강 채도를 0.2 그대로 두면 L 0.17 바탕 위에 채도 0.15 넘는 색이 하나만 남아 banlist `near-black-neon`(G130)에 걸린다. 다크의 ring·chart-1은 C 0.14, destructive는 C 0.13으로 낮췄다(§5 「다크는 채도를 0.02~0.04 낮추고 L을 올린다」).
- **팔레트 인용**: `pal-sns-instagram-dapad3qkle0-2`(SNS, 가중 0.2, 보강 없음)의 구조 「무채 바탕 · 거의 검정 글자 · 진한 빨강 하나」와 빨강의 색상각(25.5°)만 가져왔다. hex는 옮기지 않았고, 원본 바탕의 차가운 청회(214°)는 버리고 뉴트럴을 빨강 쪽(28°)으로 아주 옅게(C 0.003~0.006) 기울였다. 원본 빨강(L 0.53 C 0.215)은 흰 바탕 글자 4.5:1에 못 미쳐서, 역할을 링·면·큰 글자로 한정했다(DESIGN §1-B SHOULD, §5-A 역할 배정).
- **서체**: Archivo·Gothic A1·IBM Plex Mono 모두 SIL OFL 1.1이다(키트 항목 `meta.licenseUrl`). §13·banlist에 없다. Archivo는 라틴 전용이라 제목 스택이 Archivo → Gothic A1 → 시스템 한글 순으로 떨어진다. **한글 제목 서체는 Gothic A1 800**이다(선정서 M5). 처음 판은 키트에 800이 없어(400·500·700·900) 900으로 적었다. Task 6에서 r7-docs가 800을 쓰면서 키트 항목을 400·500·700·800으로 바꿨고(next/font `font-data.json`의 Gothic A1은 100~900이다. 키트 항목 굵기 상한 4(`factory/scripts/gen-fonts.mjs` `MAX_WEIGHTS`, `docs/qa/font-licenses.md` 「정적 서체는 4개까지」)를 지키려 900을 뺐다. 어느 레시피도 Gothic A1 500을 쓰지 않으므로(r2 400·700·800, r7 800) 400·700·800 셋으로 줄여 정적 굵기 하나를 덜 받는 안도 남겨 둔다(Task 6 리뷰 M2)), 이 레시피도 선정서 값 800으로 돌아왔다. 없는 굵기를 합성하지 않는다(§2).
- **아이콘**: tabler(키트 항목 `icons-tabler`), 결은 G3(각진 2px — `stroke-linecap: square`·`linejoin: miter`). 직각 크롬과 같은 모서리다. r1(lucide)·r3(phosphor)·r4(lucide)와 결이 다르다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 portfolio 표본 23곳 중 19곳이 유채색 2개 이하(중앙값 1)이고, S 0.9 이상 11곳 가운데 두 곳(유채 1, hue 0)이 흰 바탕 + 빨강 하나 구성이다. brand는 29곳 중 15곳이 2개 이하(중앙값 2)라 절제와 다색이 반반이다. public은 19곳 모두 3개 이상(중앙값 8)이지만 S 1.0 표본 KRDS는 유채 3개에 주 색 하나가 면적을 맡는다. 그래서 강조는 빨강 하나로 두고, public에서는 §21-8 「주 색 약 10%」를 빨강이 아니라 먹 버튼·굵은 제목의 면적이 채우게 했다(빨강은 링·큰 제목, 긴급 공지와 오류는 의미색). 기법은 color-c04(흑백 사진 + 강렬한 색 하나, 면적 3~5%)에서 가져왔다. 상태색(성공·경고·오류·정보)은 §5 MUST라 따로 두고 의미에만 쓴다.
- **글자 크기(리뷰 I3)**: 비율 1.333 하나로 16 · 21 · 28 · 38 · 50 · 67 · 90에서 멈춘다. 90px이 최대다 — 처음 판의 「한 단어·수치만 112px」은 1.333 비율 위의 값이 아니어서(90 × 1.333 = 120) §2 MUST 「하나의 비율로 정의된 토큰만」에 걸려 버렸다. 디스플레이는 `clamp(2.75rem, 5vw + 1rem, 5.625rem)`으로 rem을 섞어 확대에 반응하게 하고(§2 MUST), 414px 이하에서 2줄을 넘으면 50px 단계로 내린다. 제목:본문은 90/16 ≈ 5.6배다. 기준 카드는 type-portfolio-h1-ratio-high(중앙값 6.1, 범위 4.11~10.03)다. 선정서 행 메모의 「H1:본문 10 이상」은 본문 16px에서 160px이 되어 §2 MUST(디스플레이 상한 6rem, 한 단어 7rem)를 넘으므로 따르지 않았다.
- **§2 「히어로 헤드라인 데스크톱 2줄 이하」 예외(리뷰 I3)**: 3줄 계단 제목은 이 MUST의 예외로 둔다. 근거는 layout-l11(한두 단어를 계단으로 끊는 포스터 활자, 관찰 5곳)이다. 조건은 셋이다: 줄마다 1~2단어, 제목 전체 5단어 이하, 1024px 이상에서만. 1024px 미만과 조건을 못 채우는 제목은 2줄 이하로 쓴다. 한글 제목(Gothic A1 800)은 행간 1.1로 따로 두어 받침이 잘리지 않게 한다(리뷰 M5 — §2 MUST 「행간 1.05 미만은 렌더로 확인」을 피하는 쪽을 골랐다).
- **AI 티 점수**: `/qa/recipes?r=r2-signal` 경고 모드 G **12**/239(kas 5/35) — r1 기준선 12와 같다. 적중은 G018·G078·G084·G088×4·G126·G135×2로 r1과 같은 검수대 틀 쪽이고, 레시피 색·서체에서 새로 생긴 적중은 없다(표: `docs/qa/ai-tell-baseline.md`).

## 분위기

흰 종이 위에 신호 빨강 면과 코발트 잉크 두 색만 쓰는 포스터형 화면이다. 첫 화면은 작업 이름을 한 줄씩 큰 그로테스크로 쌓아 오른쪽 화면 끝에서 잘라 버리고, 왼쪽 좁은 빨강 기둥에 대괄호로 묶은 메타가 선다. 머리 띠도 오른쪽 3/4만 빨강이다. 한 줄에 포인터가 오면 그 줄만 빨개지며 옆으로 밀려 잘린 끝을 보여 준다. 대안(`alternates`)은 회청 주사선 결 바탕 위 민트 판에 가운데 정렬 세 줄 제목을 올리고, 낱말 사이 한 곳에는 보라 사진 칩 하나, 다른 한 곳에는 직접 그린 별표 하나를 끼우는 판이다. 제목 위·아래에는 대괄호로 묶은 mono 대문자 캡션이 있고, 그 바깥에는 같은 픽셀 장식을 위아래 거울 대칭으로 둔다. 위 가운데에 떠 있는 알약 내비가 있다.

## 쓰는 법

- 맞는 원형은 브랜드 홈, 포트폴리오·스튜디오, 공공기관 안내다. 활자가 화면의 주인공인 곳에 쓴다.
- 첫 화면은 히어로 `cropped-title-list`(대안 `inline-chip-title`)다. 본문을 2/12 메타 기둥(면) + 10/12 제목 목록으로 나누고, 목록 줄마다 `white-space: nowrap`, 목록 칸은 `overflow: clip`이다. 한 줄 = 한 작업 링크이고, 온전한 이름은 링크 글자로 늘 읽힌다.
- 제목은 `font-heading`(라틴 Bricolage Grotesque 500, 한글 도현)이다. 목록 줄은 6.6vw·행간 0.86·자간 -0.03em, 390px에서 10.8vw로 잘림을 유지한다. 본문·캡션은 Gothic A1 16px(최소 14px)이다.
- 면: 머리 띠의 오른쪽 3/4, 메타 기둥, 다음 칸의 소개 띠를 빨강 면(`bg-field-1`)으로 칠하고 **`data-face="field-1"`을 함께 단다** — 면 안의 링·주 버튼·보조 글자가 면의 짝 색(흰색)으로 바뀐다. 면 글자 대비는 7.51(다크 7.34)이다.
- 코발트(`primary`)는 흰 바탕 위 주 버튼·본문 링크·선택된 탭 글자를 맡는다. 빨강은 링(`--ring`)과 hover한 목록 줄 글자에도 나온다.
- 메뉴 항목 앞에는 대괄호 체크 칸을 둔다. 현재 위치는 칸을 채운다(`aria-current`).
- 캡션·메타는 본문 서체다. 숫자 입력과 `data-numeric` 칸만 IBM Plex Mono다.
- 모션은 M1이다. 상태 전환 150ms, 등장 300ms 이하, 튕김 없음.
- 역동 기법 둘:
  - `split-text` — 첫 화면 제목(목록 첫 줄, 대안은 세 줄 제목) 한 번. 원문은 읽기 도구용 한 벌, 조각은 `aria-hidden`.
  - `oversize-crop` — 목록 줄이 화면 끝에서 잘린다. hover·focus한 줄은 잘린 길이(최대 20vw)만큼 600ms `cubic-bezier(0.625, 0.05, 0, 1)`로 밀리고, 첫 화면에서는 셋째 줄이 1.4초 뒤 한 번 밀렸다 돌아온다. 대안은 바닥에 잘린 장식 낱말을 정지 상태로 둔다(기법 자체가 `still`). 동작 줄이기에서는 밀기 없이 색만 바뀐다.
- 대안(`alternates`, 히어로 `inline-chip-title`): 위 가운데 떠 있는 알약 내비 아래, 민트 면(`bg-field-1`) 판 위에 가운데 정렬 3줄 제목(5.5vw·행간 1.05·자간 0)을 올린다. 낱말 사이 한 곳은 글자 높이의 사진 칩(2:1, 반경 0), 다른 한 곳은 직접 그린 별표 하나다. 제목은 Dela Gothic One 400 + 모이라이 원(굵기 하나뿐이라 부품 제목 칸은 본문 서체로 돌아간다). 면은 첫 화면 판만 민트로 칠한다. 보라(`primary`)는 바탕 위 주 버튼·본문 링크·선택된 탭 글자를 맡고, 빨강은 쓰지 않는다(이 팔레트의 링은 민트 계열).

## 하지 말 것

- 빨강 면을 세 곳 넘게 깔지 않는다(머리 띠·메타 기둥·소개 띠). 빨강을 흰 바탕 위 주 버튼·본문 링크 색으로 쓰지 않는다 — 버튼·링크는 코발트다.
- 두 색 사이에 그라디언트를 넣지 않는다(K7 듀오톤). 빨강 면과 코발트는 칸으로 나눈다.
- 빨강 면 안에 오류 문구·경고 배지를 두지 않는다. 오류색(진홍)과 면 빨강이 가까워 구분이 흐려진다.
- 잘리는 제목 목록에 본문 문장을 넣지 않는다. 한 줄은 짧은 작업 이름 하나다.
- 목록 칸 밖(부제·버튼)에 글자 분할을 쓰지 않는다. 등장 연출은 첫 화면 제목 한 번이다.
- 둥근 모서리를 섞지 않는다(R0). 알약은 떠 있는 내비 한 곳뿐이다.
- 코발트를 넓은 면에 깔지 않는다 — 면은 빨강(대안은 민트) 하나다.
- 대안(`inline-chip-title`)을 쓸 때는 다음도 지킨다: 민트 면을 첫 화면 판 밖으로 넓히지 않는다, 보라(`primary`)를 넓은 면에 깔지 않는다, 두 색 사이에 그라디언트를 넣지 않는다, 면 안에 오류 문구·경고 배지를 두지 않는다, 가운데 정렬 제목 세 줄 밖에 글자 분할을 쓰지 않는다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r2-signal.md`. 레시피에는 사이트 이름을 적지 않는다.
- 기본(2판 이전의 A) = 카드 수 1(오른쪽 끝에서 잘리는 제목 목록) · 카드 팔레트(`pal-sns-instagram-dapad3qkle0-2` + 측정값) · Bricolage Grotesque + 도현. 바꾼 값 두 가지: 라이트 면 빨강은 카드 `#CB001E`(흰 글자 5.90)의 명도만 L 0.45로 내렸다(7.51 — 면 보조 글자가 본문 7:1 관문에 닿게, Task 9와 같은 판정). 구분선은 카드 `#D0D3DA`·`#2E3038`이 선 구획 3:1을 못 넘어 `#858892`·`#5E616B`로 내렸다.
- 대안(2판 기본이었던 옛 B) = 카드 수 2(문장 속 칩 + 대괄호 캡션 대칭) · 새 팔레트: 측정 사이트의 회청 바탕 `#E6E8F0`·먹 `#1E1E1E`·회색 `#D1D2D9` + SNS 팔레트 `pal-sns-instagram-dpbpoicj3j4-2`(보라 `#6E33B1` 주색·민트 `#38E6A2` 면) · Dela Gothic One + Moirai One. 민트 면 글자는 초록 기운 먹(`#07140E`)이다 — 붉은 먹이면 면 스코프의 섞음 테두리가 갈색으로 뜬다. 칩은 사진 대신 주색 빗금 구성이다(사진 확인 불가 — `app/qa/recipes/heroes/credits.ts`). 라이트 주색 보라는 명도만 L 0.468 → 0.44로 내렸다: 히어로 픽셀 대비 관문(Task 10d fix)에서 주 버튼 글자가 6.78이었다 — 지금 7.67(바탕 위 링크 글자 7.01).
- 색 논리 K7·모션 M1·기법 `split-text`·`oversize-crop`은 선택 보드 판정(Task 9) 그대로다.
- 위 「선택 보드 판정」·「결정 기록」·「선택 보드 2판 판정」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절, 그리고 맨 위 「선택 보드 3판 판정」이 정한다(Task 14, 2026-09-28).

## 레퍼런스에서 가져온 기법

- layout-l11 : 한두 단어를 화면 폭 가득 크게 두고 계단식으로 들여 끊는다(자간 -2~-4%). 이 레시피는 -4%, 3줄 계단이다.
- layout-l12 : 글자 패널과 사진 패널을 45:55로 나누고 CTA를 글자 패널 아래에 둔다.
- color-c04 : 사진을 흑백으로 빼고 강렬한 색 하나만 CTA가 아닌 신호(링·수치 막대)에 쓴다. 강조 면적 3~5%.
- type-portfolio-h1-ratio-high : 제목:본문 비율을 4~10 구간에 둔다(표본 중앙값 6.1). 이 레시피는 5.6배다.
- pal-sns-instagram-dapad3qkle0-2 : 무채 바탕 · 거의 검정 글자 · 진한 빨강 하나의 세 역할 구조와 빨강 색상각.
- 해외 정부 디자인 시스템의 페이지 견본(주소는 적지 않는다) : 공공 화면에서 사각 그로테스크 + 흑백 + 한 색으로 공식성을 만든다. public 원형에서 헤더·본문·푸터의 순서와 먹 선 구획만 가져왔다.
- 포트폴리오 표본 둘(이름은 적지 않는다) : 흰 바탕에 유채색 하나(hue 0)만 두는 포트폴리오 표본(refs-v2, S 1.0·0.999). 색 수 판단의 근거다.
</content>
