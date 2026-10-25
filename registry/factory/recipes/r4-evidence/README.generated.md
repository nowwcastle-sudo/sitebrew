<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 근거 대화 (`r4-evidence`) — 레시피 안내

원천: `registry/factory/recipes/r4-evidence/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r4-evidence#v0.2.3        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r4-evidence-theme#v0.2.3  # 색만(registry:theme)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r4-evidence-alt#v0.2.3    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r4-evidence-<부품>`(예: `r4-evidence-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r4-evidence/r4-evidence.css` 를 붙인다.

## 한눈에

- 분위기: 근거 · 차분 · 대화
- 첫 화면 히어로: stepped-crop-figure(계단식으로 물린 오른쪽 그림)
- 맞는 원형: saas · dashboard · landing
- 스타일 축: 반경 R2 · 버튼 B3 · 입력 I1 · 표면 C1 · 표 T2 · 머리 H1 · 그림자 S1
- 모션 M1 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Newsreader(`font-newsreader`, 굵기 300 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면·섹션 제목 전용 가는 세리프. 굵기 300, 4.4vw(390에서 10.3vw)·행간 1.1·자간 -0.01em. 부품 제목 칸도 이 스택(한글은 마루부리)) · 한글 제목 MaruBuri(`font-maru-buri`) · 본문 Noto Sans KR(`font-noto-sans-kr`, 조정: 본문 16px/1.7 굵기 400, KPI 숫자 300 + tabular-nums) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: data-numeric 표 칸·숫자 입력·코드에만, 굵기 400. 신뢰도 칩·출처 라벨에는 쓰지 않는다) · 긴 글(prose) Noto Serif KR(`font-noto-serif-kr`, 조정: AI가 말하는 요약·답 문장에만(font-prose, type-t03) — 제목·UI·부품에는 쓰지 않는다. 굵기 400, 23~28px(본문의 1.4~1.75배), 행간 1.6, 자간 0, 한 답 3문장 이하. 계산표의 최종값만 600)
- 레퍼런스: component-k09 · type-t03 · component-k08 · component-d02 · layout-saas-has-features · pal-sns-threads-daujod-k6nv-1 · pal-sns-threads-duymesgic-0-7 · pal-sns-threads-duymesgic-0-6
- 색 논리 K7(듀오톤) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `clip-reveal`(clip-path 리빌) · `svg-draw`(SVG 선 그리기) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K7 그대로) · 서체 Spectral · SeochoBatang · 첫 화면 centered-proof-panel — DNA 수 2(가운데 제목 + 접힘선을 넘는 증거 패널) — 짙은 남보라 잉크·보라 주색·연두 면의 새 팔레트(pal-sns-threads-duymesgic-0-6 + 측정 사이트의 남보라·보라·회보라), 제목 Spectral·서초바탕. 색 논리 K7·모션 M1·기법 clip-reveal·svg-draw 는 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9656 0.0066 286.27)` | `oklch(0.1815 0.0734 285.96)` |
| `--foreground` | `oklch(0.1815 0.0734 285.96)` | `oklch(0.9461 0.0000 0.00)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2289 0.0803 284.29)` |
| `--card-foreground` | `oklch(0.1815 0.0734 285.96)` | `oklch(0.9461 0.0000 0.00)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2289 0.0803 284.29)` |
| `--popover-foreground` | `oklch(0.1815 0.0734 285.96)` | `oklch(0.9461 0.0000 0.00)` |
| `--primary` | `oklch(0.5371 0.2129 287.87)` | `oklch(0.7689 0.1124 293.46)` |
| `--primary-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1815 0.0734 285.96)` |
| `--secondary` | `oklch(0.9303 0.0107 286.19)` | `oklch(0.2210 0.0789 285.41)` |
| `--secondary-foreground` | `oklch(0.1815 0.0734 285.96)` | `oklch(0.9461 0.0000 0.00)` |
| `--muted` | `oklch(0.9303 0.0107 286.19)` | `oklch(0.2210 0.0789 285.41)` |
| `--muted-foreground` | `oklch(0.3528 0.0551 290.45)` | `oklch(0.7963 0.0423 293.06)` |
| `--accent` | `oklch(0.9397 0.0258 295.55)` | `oklch(0.2753 0.0914 283.87)` |
| `--accent-foreground` | `oklch(0.2566 0.0809 284.17)` | `oklch(0.9461 0.0000 0.00)` |
| `--border` | `oklch(0.8425 0.0194 282.71)` | `oklch(0.3643 0.1001 284.82)` |
| `--input` | `oklch(0.5443 0.0434 289.79)` | `oklch(0.5918 0.0712 288.90)` |
| `--ring` | `oklch(0.5371 0.2129 287.87)` | `oklch(0.7689 0.1124 293.46)` |
| `--field-1` | `oklch(0.9132 0.1174 119.39)` | `oklch(0.8000 0.1100 119.4)` |
| `--field-1-foreground` | `oklch(0.1815 0.0734 285.96)` | `oklch(0.1815 0.0734 285.96)` |

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

- `[data-face="field-1"]`: 면 조각(muted·accent·secondary) = field-1-foreground 10% · 보조 글자 97% · 테두리·입력 56% (나머지는 field-1)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9906 0.0017 247.84)` | `oklch(0.1792 0.0333 274.50)` |
| `--foreground` | `oklch(0.1831 0.0309 263.38)` | `oklch(0.9556 0.0096 273.36)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2237 0.0398 272.18)` |
| `--card-foreground` | `oklch(0.1831 0.0309 263.38)` | `oklch(0.9556 0.0096 273.36)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2237 0.0398 272.18)` |
| `--popover-foreground` | `oklch(0.1831 0.0309 263.38)` | `oklch(0.9556 0.0096 273.36)` |
| `--primary` | `oklch(0.4234 0.1112 255.11)` | `oklch(0.7787 0.0878 266.34)` |
| `--primary-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.1792 0.0333 274.50)` |
| `--secondary` | `oklch(0.9635 0.0045 258.32)` | `oklch(0.2321 0.0395 272.33)` |
| `--secondary-foreground` | `oklch(0.1831 0.0309 263.38)` | `oklch(0.9556 0.0096 273.36)` |
| `--muted` | `oklch(0.9635 0.0045 258.32)` | `oklch(0.2321 0.0395 272.33)` |
| `--muted-foreground` | `oklch(0.4067 0.0336 260.20)` | `oklch(0.7996 0.0276 271.79)` |
| `--accent` | `oklch(0.9568 0.0091 258.34)` | `oklch(0.2747 0.0497 269.93)` |
| `--accent-foreground` | `oklch(0.2508 0.0550 262.40)` | `oklch(0.9556 0.0096 273.36)` |
| `--destructive` | `oklch(0.52 0.18 27)` | `oklch(0.7 0.14 25)` |
| `--border` | `oklch(0.8869 0.0122 259.82)` | `oklch(0.3286 0.0524 272.87)` |
| `--input` | `oklch(0.5631 0.0309 260.27)` | `oklch(0.5895 0.0457 271.46)` |
| `--ring` | `oklch(0.4234 0.1112 255.11)` | `oklch(0.7787 0.0878 266.34)` |
| `--success` | `oklch(0.52 0.11 155)` | `oklch(0.74 0.11 155)` |
| `--success-foreground` | `oklch(0.985 0.005 155)` | `oklch(0.19 0.02 155)` |
| `--warning` | `oklch(0.55 0.12 62)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 62)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.5 0.12 250)` | `oklch(0.74 0.1 250)` |
| `--info-foreground` | `oklch(0.985 0.004 250)` | `oklch(0.19 0.015 250)` |
| `--field-1` | `oklch(0.7859 0.1674 70.04)` | `oklch(0.7219 0.1433 77.80)` |
| `--field-1-foreground` | `oklch(0.2508 0.0550 262.40)` | `oklch(0.1792 0.0333 274.50)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-newsreader-wf, "Newsreader", "MaruBuri", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-maru-buri-wf, "MaruBuri", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-maru-buri-wf, "MaruBuri", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`
- `--font-prose`: `var(--font-noto-serif-kr-wf, "Noto Serif KR", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", serif`

`font-prose`(긴 글 목소리)는 레시피 부품이 쓰지 않는다. 원천 본문이 정한 자리(예: AI 답 문장)에서 소비자·블록이 직접 단다.

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 MaruBuri → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 MaruBuri는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다. 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 한글 제목체를 건너뛴 제목 스택(라틴 Newsreader → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.

## 원천 본문

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체 — 색 논리·기법, 이 레시피의 B에는 모션 대안이 없다)** — 색 논리 K1 → **K7 짙은 청·호박 듀오톤**, 역동 기법 `clip-reveal` → **`clip-reveal`·`svg-draw`**. 모션은 M1 그대로다. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 머리로 옮긴 색(보드 B 값 — 다크 면은 명도만 조정): 라이트 `field-1` 호박 `0.84 0.13 75`·`field-1-foreground` `0.22 0.03 75`, `primary`·`sidebar-primary` 청회 215° → 짙은 청 `0.46 0.1 245`. 다크 `field-1` `0.5 0.1 70` → **`0.435 0.1 70`**(Task 9 fix 1에서 0.445 → 0.435 — 렌더 여유)·글자 `0.97 0.01 75`, `primary`·`sidebar-primary` `0.78 0.1 245`. 바탕·글자·링(청회 215°)·차트·상태색은 A 그대로다. `alternates`는 지웠다.
- 대비 관문을 위해 명도만 조정(컨트롤러 판정, 운영자 선택 색상·채도 유지): 보드 값의 다크 면 글자 대비 5.62로는 다크 「면 위의 조작」 견본의 면 보조 글자(5.50)가 본문 7:1 관문에 못 닿았다. 다크 면의 L만 내렸다. 대비(lint와 같은 `contrast-lib ratio`): 라이트 면 글자/호박 면 10.46 · 주 버튼 글자/짙은 청 6.78 · 짙은 청/바탕 6.78, 다크 면 글자/면 **7.43**(면 보조 글자 7.20) · 주 버튼 글자/primary 9.29. 생성기 `faceTokens`는 이제 면 보조 글자를 닿을 수 있으면 7.15 이상으로 고른다(렌더 여유 `FACE_RENDER_MARGIN` 0.15 — 브라우저 렌더가 계산값보다 0.05~0.1 낮게 나와 r3 다크 block-1이 계산 7.01·렌더 6.94로 관문에 걸렸다).
- lint 주의 `recipe-caution: K7 × dashboard`(유채색 면이 운영 화면의 의미색과 다툰다): 대시보드에서 호박 면은 근거 카드·계산표의 머리 띠 한두 곳에만 둔다(보드 면 관문도 dashboard 원형이라 「상단 바 면」 기준으로 쟀다).
- 바뀐 것: 아래 Task 5 결정 기록의 「강조는 청회 하나」·「호박은 차트 비교 계열 하나뿐」 문장은 A안의 판단으로 남긴다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. 계산표 구조·명조 AI 답(`font-prose`)·R2 크롬·차트 인코딩은 그대로다.
- AI 티 점수(명도 조정 뒤 다시 잼, 같은 빌드 r1 대조 12): G **12**/239(kas 8/35) — 기준선과 같다.
- 갤러리 관문(명도 조정 뒤, `/qa/recipes?r=<id>`): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 5)

방향 원천은 dribbble-summary §6 R5(근거·차분·대화)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r4-evidence 줄을 그대로 따랐다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 근거 대화 (고름) | B 무채 근거 (남김, 안 씀) | C 로열블루 + 라임 (버림) |
|---|---|---|---|
| 분위기 3단어 | 근거 · 차분 · 대화 | 근거 · 건조 · 정돈 | 명랑 · 빠름 · 똑똑 |
| 축 | B3 I1 C1 T2 H1 R2 S1, M1 | B3 I1 C1 T2 H1 R2 S1, M1 | B4 I2 C3 T2 H2 R1 S1, M2 |
| 서체 짝과 이유 | Noto Sans KR(제목·UI·본문) + Noto Serif KR(AI 답 문장만). 사람이 조작하는 곳은 고딕, 기계가 말하는 곳은 명조로 목소리를 가른다 | Noto Sans KR 한 가족 | 기하 산세리프 + Pretendard |
| 색 3개 + 강조 1 | 옅은 청회 바탕 · 청회 먹 글자 · 옅은 청회 면 + 청회 215° 강조 1(+ 의미색 4종) | 흰 바탕 · 먹 · 회색 + 의미색만 | 흰 바탕 · 남색 글자 · 옅은 보라 면 + 로열블루(약 265°) + 라임 칩 |
| 사진·그림 | 사진 없음. 실제 데이터 차트와 계산표 | 사진 없음 | 3D 오브 일러스트 |
| 이 안에서만 나오는 레이아웃 | 계산표 AI 답(component-k09) + 예측 빗금 막대(component-d02) + 헤더 안 「묻기」 입력(N13, component-k08) | 같은 틀 | 가운데 채팅 히어로 |
| 레퍼런스 2개 | component-k09 · type-t03 | component-k09 · SaaS 표본(유채 1) | 없음(상투 조합) |

- **버린 안: C.** 로열블루 버튼은 §13 `indigo-500` 버튼과 한 걸음이고, 라임 칩은 흰 바탕에서 3:1에 못 미친다. 강조 2개에 의미색이 더해져 사실상 강조 3개 이상이 된다(계획 피할 패턴).
- **남긴 안: B.** 상투 표에는 걸리지 않는다. 그러나 무채 + 의미색만이면 r1-measure와 색 논리가 같아 대시보드 둘이 같은 얼굴이 된다. 이 레시피에서는 B의 「의미색이 상태를 전부 맡는다」만 가져왔다.
- **고른 안: A.** 방문자 모드는 설득(saas)과 분석(dashboard — §21-7 종류는 **분석형**: 상단 바 + 접히는 패널, 원형에 saas가 있어 H4 사이드 레일을 쓰지 않는다)이다.
- **세리프 범위(선정서 리뷰 I7 · Task 5 리뷰 I1)**: 명조는 제목 서체가 아니라 `fonts.prose` 역할이다. prose는 AI가 말하는 요약·답 문장에만 쓴다(`font-prose`, type-t03 — 같은 화면의 산세리프 비율 90% 이상). 제목 서체(display, `font-heading`)는 Noto Sans KR 700이라 H1·UI 제목·부품 제목(카드·대화상자·서랍·시트·Empty)이 모두 고딕으로 나온다. **한글 제목 서체는 Noto Sans KR 700**이다(선정서 M5). 처음 판에서는 명조를 display 칸에 두어 레시피 부품의 `font-heading` 제목이 소비자 설치본에서도 Noto Serif KR 600으로 나왔다(리뷰가 CDP로 확인). 역할 필드 prose를 만들어 구조로 막았다 — 부품 원천은 `font-prose`를 쓰지 않는다.
- **기본 shadcn과 다른 크롬(선정서 리뷰)**: 주 버튼이 거의 검정이 아니라 청회 215° 채움이다. 작은 컨트롤(배지·탭·토글·kbd·아바타)만 알약이고 큰 면은 16px, 나머지는 6~8px이다(R2). 버튼은 44px(B3의 h-11), 표 행은 48px(T2), 그림자는 바탕 색조의 여러 겹 틴트(S1)다. 입력 테두리는 배경 대비 3:1 이상(`--input` L 0.6)이라 기본 shadcn의 옅은 회색 테두리보다 진하다.
- **비 AI 서명(선정서 리뷰 I7)**: 이 레시피의 첫 화면에는 셋을 둔다. 계산표 AI 답(component-k09 — 확인한 자료 수, 항목별 ± 값, 최종값), 예측 빗금 막대(component-d02 — 과거 옅게, 현재 채움 + 「지금」, 예측 빗금), 신뢰도 칩. 지금 갤러리 견본은 모든 레시피에 같은 틀(KPI·표·선 차트)을 그리므로 이 셋이 렌더되지 않는다 — 견본 확장은 Task 5 범위 밖이라 보고서에 넘겼다.
- **교체 가능성 검사로 고친 것**
  - 차트를 청회 한 hue의 명도 단계로만 칠하면 r1(청사진 파랑 단계)과 차트가 같은 얼굴이 된다. 비교 계열(chart-3)을 호박색 58°로 두어 파랑–주황 쌍(§5 MUST 「빨강–초록 대신 파랑–주황」)을 만들고, 예측·기준선(chart-5)은 거의 무채 회색으로 두었다. 호박색은 데이터 색이라 강조 묶음에 넣지 않지만, 경고색(62°)과 가까우므로 경고는 늘 배지 글자 「주의」와 아이콘을 함께 쓴다.
  - 정보색을 강조색과 같은 215°로 두면 「안내」 배지와 선택 칸이 같은 색이 된다. info는 250°로 떼었다(215°와 35° — 같은 묶음 안의 다른 단계).
- **팔레트 인용**: `pal-sns-threads-daujod-k6nv-1`은 **augmented 팔레트**다(바탕을 더한 팔레트, DESIGN §5-A pal-01 바탕 보강). 옅은 시안 225°의 색상각만 빌린 약한 근거다. 원본 주색(0.847 0.101 225)은 흰 바탕에서 글자·면으로 쓸 수 없는 밝기라 가져오지 않았고, 짙은 남색 글자(0.218 0.036 251)의 「차가운 먹」 역할만 hue 230·C 0.015로 옅게 다시 만들었다.
- **서체**: Noto Sans KR·Noto Serif KR·IBM Plex Mono 모두 SIL OFL 1.1이다(키트 항목 `meta.licenseUrl`). §13·banlist에 없다(banlist의 display·body 항목은 prose에도 걸린다). 명조는 §13 「세리프는 편집·출판 성격을 한 줄로 설명할 수 있을 때만」에 대해 이렇게 적는다: 기계가 말한 문장을 사람이 조작하는 UI와 다른 목소리로 구분하려는 역할 서체이고, 제목에는 쓰지 않는다(type-t03, 관찰 3건). 로더는 셋이다(Noto Sans KR 1 — display·body 공유, Noto Serif KR 1, Plex Mono 1).
- **아이콘**: lucide(키트 항목 `icons-lucide`), 결 G1(외곽선 2px, 둥근 끝). 조작 UI가 많은 saas·dashboard 기본 결이다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 saas 25곳 중 유채색 2개 이하는 5곳뿐이다(중앙값 4). S 0.9 이상 표본 네 곳도 유채 1 · 2 · 3 · 3으로 갈린다. dashboard는 10곳 중 6곳이 2개 이하다(중앙값 2). 빈도만 보면 saas는 다색 쪽이다. 그래도 강조를 청회 하나로 둔 근거는 DESIGN §5다(랜딩 대표색 2색, 액센트는 활성 상태 전용, 대시보드 경고색은 조치가 필요한 항목에만 — §21-7 MUST). 기법은 유채 1 표본 행(본문 대비 20.03)에서 가져왔다. 의미색 4종(성공·경고·오류·정보)은 §5 MUST라 따로 두고, 차트의 호박색은 비교 계열 하나에만 쓴다. 색상각 묶음(§5-A, C ≥ 0.05)은 청회 215~250° 하나와 호박 58~62° 하나, 둘이다.
- **글자 크기**: 비율 1.2 하나로 16 · 19 · 23 · 28 · 33 · 40 · 48 · 57에서 멈춘다. saas 히어로 H1 57px(§21-1 권장 56~72의 아래 끝), 섹션 H2 40px, AI 답 문장 23~28px(본문의 1.4~1.75배, type-t03 관찰 1.5~2.5배의 아래쪽 — 대화 문장이 제목보다 커지지 않게)이다.
- **AI 티 점수**: `/qa/recipes?r=r4-evidence` 경고 모드 G **12**/239(kas 7/35) — r1 기준선 12와 같다(Task 5 fix 1 뒤 재측정). 적중은 r1과 같은 검수대 틀 쪽(G018·G078·G084·G088×4·G126·G135×3)이다.
  - 처음 판은 16이었다. G033(3)은 H1 축이 NavigationMenu 부품에 반투명 + 블러 8px를 조건 없이 줘서 갤러리 칸 안의 흐르는 내비에 걸린 것이다 — 축 원천을 고쳐(블러는 셸이 스티키인 768px 이상에서만, 부품은 불투명) 빠졌다.
  - G056(1)은 검사기 오탐이었다. 375px 견본 버튼 줄은 `flex-wrap gap-3`이라 줄 사이가 12px 떨어져 있어 테두리가 붙지 않는다. 검사기가 간격 상한 없이 「위아래로 쌓인 테두리 행」을 모두 겹침으로 셌다(처음 판의 「테두리가 붙는다」는 사실과 달랐다). 검사기에 간격 1px 이하 조건을 더해 빠졌다.
  - G135가 r1(2건)보다 1건 많은 것은 KPI 줄 테두리다. r4(C1)에는 선 구획 예외가 없다.

## 분위기

연구 보고서를 조용히 펼친 듯한 화면이다. 거의 흰 바탕에 짙은 먹으로 쓰고, 두 색이 역할을 나눈다 — 짙은 청(`#1D4E89`)은 잉크와 링, 호박(`#FCA311`)은 근거를 칠하는 형광 면과 주 버튼. 첫 화면 제목은 가는 세리프 두 줄이고, 설명 속 근거 구절 뒤로 호박 면이 왼쪽에서 오른쪽으로 칠해진다. 오른쪽 그림은 위 왼쪽 모서리를 바탕 계단이 파고든 L자로 잘려 있고, 아래 띠는 왼쪽 칸 밑까지 넘어온다. B안은 짙은 남보라 첫 화면 가운데에 제목을 세우고, 증거 패널이 접힘선을 넘어 이어진다 — 보라 주색과 연두 면.

## 쓰는 법

- 맞는 원형은 AI 기능이 있는 SaaS 랜딩과 분석형 운영 대시보드다. 숫자에 근거를 붙여야 하는 곳에 쓴다.
- 첫 화면은 히어로 `stepped-crop-figure`(B안 `centered-proof-panel`)다. 6/6 두 칸: 왼쪽 한 줄 소개 → 제목 두 줄(4.4vw) → 회색 설명 두세 줄 → 반경 0 호박 채움 버튼(폭 220px, 화살표 끝정렬) → 함께하는 곳 줄. 오른쪽 그림은 `clip-path: polygon` 계단 크롭이다.
- 제목은 `font-heading`(라틴 Newsreader 300, 한글 마루부리)이다. AI가 말하는 요약·답 문장은 `font-prose`(Noto Serif KR)로 한 톤 낮추고, UI·버튼·표는 Noto Sans KR이다.
- AI 답은 계산표로 보인다(component-k09): 확인한 자료 수와 신뢰도 칩(글자로), 항목 5~7행(값은 `data-numeric`), 최종값을 행 글자의 2배로.
- 면: 근거 구절 형광, 첫 화면 위 공지 띠, 근거 카드·계산표 머리 띠를 호박 면(`bg-field-1`)으로 칠하고 구획에는 **`data-face="field-1"`을 함께 단다**. 대시보드에서는 면을 머리 띠 한두 곳에만 둔다. 면 글자 대비 7.93(다크 7.52).
- 주 버튼: 랜딩 첫 화면의 주 CTA 하나는 호박 채움, 그 밖의 주 버튼은 짙은 청(`primary`) 채움이다. 보조는 외곽선, 세 번째부터 링크 글자다.
- 차트는 상태로 인코딩한다(component-d02) — 지난 기간 옅게, 이번 기간 채움, 예측은 빗금. 계열은 직접 라벨로도 가른다.
- 상태는 색과 글자를 함께 쓴다. 대시보드에서는 조치가 필요한 항목에만 경고색을 쓴다(§21-7).
- 모션은 M1이다. 상태 전환 150~200ms, 등장 300ms 이하.
- 역동 기법 둘:
  - `clip-reveal` — 근거 구절의 호박 면이 왼쪽→오른쪽으로 칠해진다(구절마다 `--duration-enter`, `cubic-bezier(0.6, 0, 0, 1)`, 80ms 차, 한 답에 최대 3개, 답이 다 보인 뒤 한 번). 계산표 행도 같은 결로 위에서 걷는다.
  - `svg-draw` — 그림의 등고선·합계 괘선·차트 기준선을 한 번 긋는다(B안은 패널의 추이 선). 데이터 값이 늦게 보이게 하지 않는다.
  - 동작 줄이기에서는 면이 처음부터 칠해져 있고 선은 완성된 채다.

## 하지 말 것

- 두 색 사이에 그라디언트를 넣지 않는다(K7 듀오톤). 청 잉크와 호박 면은 칸으로 나눈다 — B안의 짙은 첫 화면도 한 색 면이다.
- 호박을 본문 링크·배지 색으로 쓰지 않는다. 호박은 근거 형광·면·첫 화면 주 CTA 하나다.
- H1·섹션 제목·버튼·표에 `font-prose`(명조)를 쓰지 않는다. 명조는 AI가 말한 문장에만 있다.
- AI 답을 결론 한 문단으로 끝내지 않는다. 근거 문장과 위치(쪽·줄) 없이 결론만 보이지 않는다.
- 신뢰도를 색 점 하나로 표시하지 않는다. 칩에 「높음」 같은 글자를 쓴다.
- 「AI」를 보라 그라디언트·반짝이 아이콘으로 표시하지 않는다(§13). B안의 보라는 단색 주 버튼과 선에만 쓴다.
- 계단 크롭 그림이 제목·설명 위로 넘어오지 않게 한다. 넘어오는 것은 왼쪽 칸 맨 아래 띠뿐이다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r4-evidence.md`. 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(계단식으로 물린 오른쪽 그림) · 카드 팔레트 그대로(`pal-sns-threads-duymesgic-0-7` + 측정값) · Newsreader + 마루부리. 그림은 직접 그린 겹 풍경이다(사진·일러스트 복제 없음).
- B안 = 카드 수 2(가운데 제목 + 접힘선을 넘는 증거 패널) · 새 팔레트: 측정 사이트의 짙은 남보라 `#110930`·`#201B48`·보라 `#6E4BDF`·회보라 `#C9CAD8`·밝은 글자 `#EDEDED` + SNS 팔레트 `pal-sns-threads-duymesgic-0-6`(연두 `#D9EE93` 면) · Spectral + 서초바탕. 짙은 첫 화면은 B안 다크 값을 그 구역에만 얹은 것이다(`DarkZone` — 라이트 페이지 안에서 lint가 잰 다크 짝).
- 색 논리 K7·모션 M1·기법 `clip-reveal`·`svg-draw`는 선택 보드 판정(Task 9) 그대로다.
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- component-k09 : AI 답을 계산표로 보인다 — 확인한 자료 수, 신뢰도 칩 1개, 항목별 ± 값 5~7행, 최종값은 행의 약 2배.
- type-t03 : AI가 말하는 문장(요약·답변)만 세리프로, 나머지 UI는 산세리프로 구분한다(같은 화면 산세리프 90% 이상).
- component-k08 : AI 진입점을 헤더 안 버튼·입력 하나로 둔다(「묻기」 + 단축키).
- component-d02 : 막대를 상태로 인코딩한다 — 과거 옅게, 현재 채움 + 「지금」, 예측 빗금.
- layout-saas-has-features : saas 표본 12곳이 기능 격자 섹션을 둔다(높이 중앙값 1.12vh). 기능 섹션은 작업 흐름 순서로 한 단계씩, 단계마다 실제 UI 조각(계산표·빗금 막대)을 보인다(§21-1).
- pal-sns-threads-daujod-k6nv-1 : 옅은 시안 225°의 색상각과 「차가운 먹」 글자 역할(augmented 팔레트 — 약한 근거).
- saas 표본(유채 1, S 1.0 — 이름은 적지 않는다) : 유채색을 하나만 두고 나머지를 무채 명도 단계로 채운다(표본 유채 1, 본문 대비 20.03, S 1.0).
