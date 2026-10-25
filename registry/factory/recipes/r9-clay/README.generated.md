<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 말랑 점토 (`r9-clay`) — 레시피 안내

원천: `registry/factory/recipes/r9-clay/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r9-clay#v0.2.1        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r9-clay-theme#v0.2.1  # 색만(registry:theme)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r9-clay-alt#v0.2.1    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r9-clay-<부품>`(예: `r9-clay-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r9-clay/r9-clay.css` 를 붙인다.

## 한눈에

- 분위기: 말랑 · 친근 · 손끝
- 첫 화면 히어로: framed-card-outline-title(여백 액자 속 둥근 카드 + 외곽선·채움 교대 대문자 + 도는 배지)
- 맞는 원형: pwa · detail · commerce
- 원형별 쓰임 조건(archetypeConditions — `ai/tasks/<원형>.json` 후보의 condition): pwa — 식품·생활·키즈 브랜드 앱에만 — 둥근 Jua 제목이 배달앱 계열로 읽힌다(금융·업무 앱은 r7-docs) · detail — 식품·생활·키즈 상품 상세에만 — 둥근 Jua 제목이 배달앱 계열로 읽힌다(재질 상품은 r5-celadon) · commerce — 식품·생활·키즈 몰에만 — 둥근 Jua 제목이 배달앱 계열로 읽힌다(동네 가게 몰은 r3-woodblock)
- 스타일 축: 반경 R1 · 버튼 B3 · 입력 I1 · 표면 C3 · 표 T3 · 머리 H1 · 그림자 S3
- 모션 M2 · 아이콘 phosphor G4(부품이 부르는 어댑터 `components/icons/phosphor` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Grandstander(`font-grandstander`, 굵기 700 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면·섹션 제목 전용 장난스러운 둥근 라틴. 굵기 700(외곽선 줄은 같은 굵기에 획 1.5px·채움 투명), 대문자 세 줄 4.2vw(390에서 9.2vw)·행간 1.1. 한글은 베이글 팻 원(굵기 하나라 레시피 CSS 가 굵기 합성을 끈다)) · 한글 제목 Bagel Fat One(`font-bagel-fat-one`) · 본문 Gothic A1(`font-gothic-a1`, 조정: 본문 16px/1.7 굵기 400, 가격·상품 이름 700(차 300), 작은 부품 제목 700, 자간 0. 가격·수량·할인율은 tabular-nums) · 고정폭 —
- 레퍼런스: layout-i02 · layout-l10 · motion-m04 · layout-commerce-has-product-list · pal-sns-instagram-dutypk8cchi-1 · pal-sns-threads-ddbj6vadbvk-2 · pal-sns-instagram-djwzhoizfmb-1 · pal-sns-instagram-dutypk8cchi-5 · pal-sns-threads-ddo1vakdqal-1
- 색 논리 K8(색 블록) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `split-text`(글자 분할 등장) · `tilt-3d`(3D 기울임·원근) · `clip-reveal`(clip-path 리빌) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K8 그대로) · 서체 Titan One · Dongle · 첫 화면 layered-landscape-logotype — DNA 수 2(층층 평면 풍경 + 가운데 뭉툭한 로고타입) — 하늘·세이지·숲·녹 주황 칸의 새 팔레트(pal-sns-threads-ddo1vakdqal-1 + 측정 사이트의 세이지·숲·녹 주황), 제목 Titan One·동글. 색 논리 K8·모션 M2·기법 split-text·tilt-3d·clip-reveal 은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9741 0.0035 219.53)` | `oklch(0.2007 0.0097 234.31)` |
| `--foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.9595 0.0066 160.07)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2421 0.0117 225.65)` |
| `--card-foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.9595 0.0066 160.07)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2421 0.0117 225.65)` |
| `--popover-foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.9595 0.0066 160.07)` |
| `--primary` | `oklch(0.4500 0.1250 40.00)` | `oklch(0.7143 0.1208 47.24)` |
| `--primary-foreground` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2007 0.0097 234.31)` |
| `--secondary` | `oklch(0.9451 0.0070 219.56)` | `oklch(0.2365 0.0122 214.61)` |
| `--secondary-foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.9595 0.0066 160.07)` |
| `--muted` | `oklch(0.9451 0.0070 219.56)` | `oklch(0.2365 0.0122 214.61)` |
| `--muted-foreground` | `oklch(0.3943 0.0209 172.94)` | `oklch(0.8021 0.0164 176.96)` |
| `--accent` | `oklch(0.9251 0.0145 213.10)` | `oklch(0.2950 0.0202 175.40)` |
| `--accent-foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.9251 0.0145 213.10)` |
| `--border` | `oklch(0.8662 0.0141 196.90)` | `oklch(0.3352 0.0188 185.62)` |
| `--input` | `oklch(0.5704 0.0220 180.58)` | `oklch(0.6069 0.0228 181.40)` |
| `--ring` | `oklch(0.5369 0.0428 208.60)` | `oklch(0.7517 0.0759 248.87)` |
| `--block-1` | `oklch(0.8600 0.0630 235.00)` | `oklch(0.7200 0.0630 235.00)` |
| `--block-1-foreground` | `oklch(0.1970 0.0141 140.42)` | `oklch(0.1859 0.0101 220.10)` |
| `--block-2` | `oklch(0.7800 0.0630 175.00)` | `oklch(0.7200 0.0630 175.00)` |
| `--block-2-foreground` | `oklch(0.1970 0.0141 140.42)` | `oklch(0.1841 0.0101 172.88)` |
| `--block-3` | `oklch(0.4400 0.1300 40.00)` | `oklch(0.4300 0.1300 40.00)` |
| `--block-3-foreground` | `oklch(0.9741 0.0143 50.81)` | `oklch(0.9741 0.0143 50.81)` |
| `--block-4` | `oklch(0.4200 0.0500 165.00)` | `oklch(0.3600 0.0500 165.00)` |
| `--block-4-foreground` | `oklch(0.9638 0.0091 161.35)` | `oklch(0.9638 0.0091 161.35)` |

## 모션 토큰

모션 M2 의 값이 `:root`(순수 CSS·registry cssVars.light)에 실린다 — `motion-core` 의 기본값(M2)을 덮고, 프리셋(`.wf-fade-rise` 등)이 `var(--duration-enter, …)` 로 읽는다. M0 은 등장 연출이 없다(`--duration-enter: 0ms`).

- `--ease-standard`: `cubic-bezier(0.23, 1, 0.32, 1)`
- `--ease-emphasized`: `cubic-bezier(0.2, 0, 0, 1)`
- `--ease-in-screen`: `cubic-bezier(0.77, 0, 0.175, 1)`
- `--ease-exit`: `cubic-bezier(0.4, 0, 1, 1)`
- `--ease-sheet`: `cubic-bezier(0.32, 0.72, 0, 1)`
- `--duration-press`: `120ms`
- `--duration-hover`: `200ms`
- `--duration-popover`: `160ms`
- `--duration-enter`: `500ms`
- `--duration-sheet`: `320ms`

## 면·칸 색 (색 논리 K6~K8)

이 레시피는 표준 shadcn 변수 밖의 색 키를 더 싣는다. cssVars.theme 이 `--color-<키>` 로 이어 두어 Tailwind 유틸리티로 바로 쓴다: `bg-block-1` + `text-block-1-foreground` · `bg-block-2` + `text-block-2-foreground` · `bg-block-3` + `text-block-3-foreground` · `bg-block-4` + `text-block-4-foreground`.
- K8 색 블록: 칸(벤토·카드·섹션 블록)마다 block-N 한 색. 번호 = 배치 순서이고 무지개 순서로 늘어놓지 않는다. 칸 크기로 위계를 주고, 가장 채도 높은 칸은 하나다. 칸 안 글자는 block-N-foreground 로만.

**면 구획에는 `data-face` 속성을 단다** — `<section class="bg-block-1 text-block-1-foreground" data-face="block-1">`. 레시피 CSS(registry css·순수 CSS)가 `[data-face="<키>"]` 스코프마다 `--background`·`--foreground`·`--primary`·`--primary-foreground`·`--ring`·`--border`·`--input`·`--muted`·`--muted-foreground`·`--accent`·`--accent-foreground`·`--secondary`·`--secondary-foreground` 를 그 면의 짝으로 다시 가리킨다. 그래서 면 안의 부품(주 버튼·포커스 링·보조 글자·입력 테두리·체크)이 면 위에서 대비를 지킨다(lint `face-contrast` — 두 테마, 글자 4.5 · 링·테두리·채움 3). 면 안에 놓인 카드(`[data-slot="card"]`)와 `[data-face-reset]` 요소는 레시피 원래 값으로 돌아간다. `data-face` 없이 면 색만 칠하면 바탕 기준 토큰이 그대로 남아 링·버튼이 사라질 수 있다.

- `[data-face="block-1"]`: 면 조각(muted·accent·secondary) = block-1-foreground 10% · 보조 글자 97% · 테두리·입력 55% (나머지는 block-1)
- `[data-face="block-2"]`: 면 조각(muted·accent·secondary) = block-2-foreground 10% · 보조 글자 100% · 테두리·입력 60% (나머지는 block-2)
- `[data-face="block-3"]`: 면 조각(muted·accent·secondary) = block-3-foreground 10% · 보조 글자 93% · 테두리·입력 55% (나머지는 block-3)
- `[data-face="block-4"]`: 면 조각(muted·accent·secondary) = block-4-foreground 10% · 보조 글자 96% · 테두리·입력 54% (나머지는 block-4)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9792 0.0041 271.37)` | `oklch(0.1958 0.0260 290.85)` |
| `--foreground` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.9619 0.0073 312.30)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2334 0.0307 292.46)` |
| `--card-foreground` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.9619 0.0073 312.30)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2334 0.0307 292.46)` |
| `--popover-foreground` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.9619 0.0073 312.30)` |
| `--primary` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.8910 0.0919 85.10)` |
| `--primary-foreground` | `oklch(0.8910 0.0919 85.10)` | `oklch(0.2971 0.0827 265.71)` |
| `--secondary` | `oklch(0.9550 0.0070 268.55)` | `oklch(0.2269 0.0270 290.63)` |
| `--secondary-foreground` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.9619 0.0073 312.30)` |
| `--muted` | `oklch(0.9550 0.0070 268.55)` | `oklch(0.2269 0.0270 290.63)` |
| `--muted-foreground` | `oklch(0.4115 0.0493 267.67)` | `oklch(0.7929 0.0285 297.19)` |
| `--accent` | `oklch(0.9491 0.0327 342.94)` | `oklch(0.2727 0.0416 302.52)` |
| `--accent-foreground` | `oklch(0.2299 0.0919 10.87)` | `oklch(0.9176 0.0551 342.26)` |
| `--destructive` | `oklch(0.52 0.17 27)` | `oklch(0.7 0.14 25)` |
| `--border` | `oklch(0.8820 0.0173 267.78)` | `oklch(0.3253 0.0458 290.68)` |
| `--input` | `oklch(0.5759 0.0493 270.85)` | `oklch(0.5879 0.0457 292.58)` |
| `--ring` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.8910 0.0919 85.10)` |
| `--success` | `oklch(0.52 0.1 155)` | `oklch(0.74 0.11 155)` |
| `--success-foreground` | `oklch(0.985 0.005 155)` | `oklch(0.19 0.02 155)` |
| `--warning` | `oklch(0.55 0.13 55)` | `oklch(0.8 0.12 70)` |
| `--warning-foreground` | `oklch(0.985 0.005 55)` | `oklch(0.2 0.03 70)` |
| `--info` | `oklch(0.5 0.1 245)` | `oklch(0.74 0.1 245)` |
| `--info-foreground` | `oklch(0.985 0.004 245)` | `oklch(0.19 0.015 245)` |
| `--block-1` | `oklch(0.7886 0.1536 345.87)` | `oklch(0.7350 0.1522 345.68)` |
| `--block-1-foreground` | `oklch(0.2299 0.0919 10.87)` | `oklch(0.1826 0.0732 7.78)` |
| `--block-2` | `oklch(0.8910 0.0919 85.10)` | `oklch(0.7958 0.0986 85.60)` |
| `--block-2-foreground` | `oklch(0.2971 0.0827 265.71)` | `oklch(0.2971 0.0827 265.71)` |
| `--block-3` | `oklch(0.8396 0.0664 170.29)` | `oklch(0.7449 0.0694 170.47)` |
| `--block-3-foreground` | `oklch(0.2297 0.0233 149.79)` | `oklch(0.2034 0.0235 154.62)` |
| `--block-4` | `oklch(0.7959 0.0824 23.72)` | `oklch(0.7300 0.0868 24.01)` |
| `--block-4-foreground` | `oklch(0.2299 0.0919 10.87)` | `oklch(0.1826 0.0732 7.78)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-grandstander-wf, "Grandstander", "Bagel Fat One", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-bagel-fat-one-wf, "Bagel Fat One", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-bagel-fat-one-wf, "Bagel Fat One", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Bagel Fat One → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 Bagel Fat One는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다. 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 한글 제목체를 건너뛴 제목 스택(라틴 Grandstander → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.

## 원천 본문

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 중 모션만 채택** — 모션 M3 → **M2**. 색 논리(K8 노랑 점토 칸)와 역동 기법(`split-text`·`tilt-3d`·`clip-reveal`)은 A 그대로다. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다. 보드는 lint를 통과한 부분 조합만 버튼으로 냈고, 「모션만 B」도 그중 하나였다 — M2 머리에 `split-text`·`tilt-3d`가 그대로 남아도 lint `dynamics-motion`을 통과한다(`magnetic-cta`만 M3 전용이다).
- **남은 B는 지웠다(보존하지 않음).** 운영자가 고르지 않은 B의 나머지(하늘 점토 칸 색 `block-1` `0.76 0.13 235`·`block-4` `0.9 0.08 95`, 기법 `clip-reveal` 하나)를 `alternates`로 남기면 설치 안내가 「운영자가 보드에서 고르기 전까지」를 계속 말하고, 보드가 이미 닫혔으므로 다시 고를 자리가 없다. 필요하면 아래 Task 7 결정 기록의 「B안: 하늘 점토」 값으로 되살린다.
- 바뀐 것: 아래 Task 7 결정 기록의 「모션 M3」·「M3를 유지한 근거」는 A안의 판단으로 남긴다. 운영자는 글자 분할·기울임을 두되 한 단계 차분한 M2(등장 500ms)를 골랐다. 레시피 10벌의 M3는 이제 r5-celadon·r8-dusk 둘이다(div-06 「M3 ≥ 2」 충족). 색·칸·서체·반경·S3 그림자는 그대로다.
- AI 티 점수(반영 뒤 다시 잼, 같은 빌드 r1 대조 12): G **13**/239(kas 6/35) — +1 G006은 앞과 같은 판정(Jua 단일 굵기).
- 갤러리 관문(반영 뒤): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 결정 기록 (2026-09-27, P3-1 Task 7)

방향 원천은 선정서 `docs/recipes/candidates-2026-09-27.md` r9-clay 줄(N8 촉감 클레이)이다. 축·서체·원형·바탕·글자·ring은 선정서 값 그대로다. 라이트 primary는 선정서의 노랑 채움에서 **슬레이트 채움 + 노랑 글자**로 뒤집었다(아래 「노랑의 쓰임」 — 갤러리 게이트에서 잰 대비 실패). Task 6b 뒤 묶음 C를 대담하게 다시 짜라는 운영자 결정에 따라 **색 논리를 K8 색 블록으로, 모션을 M2에서 M3로** 올렸다. 선정서가 「클레이는 1순위에만」이라 적은 것은 그대로다 — 칸 색은 칸마다 하나이고, 클레이 그림자(S3)는 가장 큰 칸 하나에만 둔다.

| 칸 | A 말랑 점토 (고름) | B 하늘 점토 (보드 B안) | C 파스텔 카드 3색 (버림) |
|---|---|---|---|
| 분위기 3단어 | 말랑 · 친근 · 손끝 | 말랑 · 맑음 · 차분 | 귀여움 · 가벼움 · 유행 |
| 축 | B3 I1 C3 T3 H1 R1 S3, M3 | 같음, M2 | B4 I4 C3 T3 H2 R2 S3, M2 |
| 색 논리 | K8 — 노랑 점토 큰 칸 1(peak) + 민트·복숭아·하늘 작은 칸 | K8 — 하늘 점토 큰 칸 + 민트·복숭아·옅은 노랑 | 카드마다 라벤더·민트·피치 |
| 서체 짝과 이유 | Jua 400(둥근 한글 제목) + Gothic A1(본문). 손으로 빚은 둥근 획과 담백한 고딕 본문 | 같은 짝(보드에서 Jua ↔ Gowun Dodum도 본다) | 둥근 라틴 + 시스템 한글 |
| 사진·그림 | 실물 상품 컷, 분위기 칸에만 한 재질 3D 점토 오브젝트(layout-i02) | 같음 | 3D 캐릭터 |
| 이 안에서만 나오는 레이아웃 | 크기가 다른 칸 격자(벤토) — 가장 큰 칸이 노랑 점토, 떠 있는 칩 내비(N2) | 같은 격자, 가장 큰 칸이 하늘 | 같은 크기 카드 3장 |
| 레퍼런스 2개 | layout-l10 · pal-sns-instagram-dutypk8cchi-1 | pal-sns-instagram-djwzhoizfmb-1 · layout-i02 | 없음(상투 조합) |

- **버린 안: C.** 카드마다 파스텔 3색은 피할 패턴 「강조 3개 이상」이고, color-c06 파스텔 KPI(§14-A 불채택)다. B4 알약 + H2 섬은 「모든 버튼 알약」이다(선정서 「버린 방향」).
- **A와 C의 차이**: 둘 다 여러 색을 쓰지만 A는 **칸 크기로 위계를 준다**(§5-B K8). 가장 큰 칸 하나만 가장 진한 노랑(C 0.15)이고 나머지 세 칸은 C 0.1 점토다. 같은 크기 카드에 같은 채도 파스텔을 돌리지 않는다.
  - Task 7 fix 1(리뷰 I3): 첫 판의 작은 칸은 L 0.86~0.88 · C 0.06~0.07로, 버린 안 C 「파스텔 카드」와 같은 대역이었다(차이가 칸 크기뿐). 세 칸을 C 0.1로 올려 점토색으로 뺐다. peak와의 C 차는 0.05로 유지된다.
- **K8 칸 색(div-04)**: block-1 노랑 `0.85 0.15 92`(peak) · block-2 민트 `0.87 0.1 165` · block-3 살구 `0.84 0.1 45` · block-4 하늘 `0.85 0.1 235`. 색상각 묶음 4개(45° 단일 연결), 칸 번호(= 배치 순서) 색상각이 92 → 165 → 45 → 235로 한 방향으로 돌지 않아 무지개 순서가 아니다. peak와 둘째 칸의 C 차는 0.05다(기준 0.02 이상). 칸 위 글자는 네 칸 모두 슬레이트(아래 「대비」).
  - 다크에서는 노랑 칸만 밝게 두고 나머지 세 칸은 L 0.4대 짙은 점토(C 0.08) + 밝은 글자다. 어두운 화면에서 네 칸이 모두 밝으면 위계가 사라진다.
  - **칸 안의 조작(리뷰 I1)**: 첫 판은 다크 노랑 peak 칸 안의 주 버튼(노랑)·포커스 링(노랑)이 칸과 1.14:1이었고, 라이트 칸 안 입력 테두리가 2.30~2.60이었다. 생성기가 이제 칸마다 `[data-face="block-N"]` 스코프를 내서 그 안의 primary·ring = 칸 글자색(슬레이트), primary-foreground = 칸 색, 보조 글자·테두리 = 칸 글자색을 섞은 값이 된다. 다크 peak 칸 안의 CTA는 슬레이트 채움 + 노랑 글자, 링은 슬레이트다. 잰 값은 「게이트 기록」.
- **노랑의 쓰임(선정서 I6, ring 색 규칙) — 라이트 primary를 뒤집은 이유**: 첫 판은 선정서대로 라이트 primary를 노랑 `0.82 0.14 92`(위 글자 슬레이트 9.41:1)로 두었다. 갤러리 게이트에서 AI 티 관문이 G104(APCA)를 잡았다 — `link` 변형 버튼 「측정 기준 보기」가 `text-primary`로 노랑 글자를 그려 Lc 27.6(바탕 대비 1.65:1, WCAG 1.4.3 실패)이었다. 컴파일본을 보면 `link` 버튼·배지는 `text-primary`, 체크박스·라디오·스위치 트랙·진행 막대·슬라이더 구간은 `bg-primary`로 칠한다. 레시피 데이터로는 이 부품들을 ring 색으로 돌릴 수 없다(부품 코드의 규칙). 노랑의 L을 낮추는 길(3:1에 L 약 0.64)은 선정서가 이미 버렸다(올리브가 된다).
  - 그래서 라이트는 **primary = 슬레이트 `0.3 0.025 250`, primary-foreground = 노랑 `0.88 0.14 92`**(9.48:1)이다. 주 버튼은 슬레이트 점토에 노랑 글자, 체크·라디오·스위치는 슬레이트 채움에 노랑 표시, 링크 글자는 슬레이트(12.85:1)다. 노랑은 가장 큰 칸(block-1), 버튼·배지 글자, 선택 칸(`accent`)에 산다
  - Task 7 fix 1(리뷰 I3): 첫 판 accent `0.95 0.045 92`는 계획이 금한 크림 경계(`oklch(0.9x 0.0x 60~90)`)에 걸친 옅은 면이었고, 반전의 대가로 부품 면이 모두 슬레이트라 라이트 크롬이 「흰 바탕 + 먹 + 한 점」 골격처럼 보였다. accent를 노랑 `0.92 0.1 95`(글자 슬레이트)로 바꿔 선택 칩·메뉴 강조·hover가 노랑을 띠게 했다. — 단독 상태 표시에 노랑이 나오지 않으므로 ring 색 규칙이 저절로 지켜진다. `chart-1`은 ring 값 `0.55 0.11 85`(4.6:1)다.
  - 다크는 노랑 채움 `0.84 0.13 92` + 슬레이트 글자 그대로다(바탕 대비 11.3:1 — 글자·표시 모두 통과). 두 테마가 같은 노랑·슬레이트 쌍을 뒤집어 쓴다.
- **모션 M3(div-06)**: 원형 pwa·detail·commerce는 M3가 허락된다(compat.json recipeRules는 dashboard·public만 막는다). 그러나 pwa는 매일 쓰는 앱이라 §8-1 「매일 쓰는 기능 UI엔 스크롤 등장 금지」를 지킨다 — 세 기법은 **마케팅 면(detail 첫 장·commerce 홈·pwa 첫 실행 소개)에만** 건다. `split-text`는 첫 화면 Jua H1 한 번(글자 25ms 간격), `tilt-3d`는 가장 큰 칸 하나(최대 6°, `(hover: hover) and (pointer: fine)`), `clip-reveal`은 첫 화면 상품 사진 한 번이다. 셋 다 동작 줄이기에서 불투명도만·평면·즉시 표시다.
  - **자석 버튼을 뺐다(Task 7 fix 1 — 리뷰 I3)**: `magnetic-cta`와 `tilt-3d`는 `pointer: fine`에서만 켜진다. 그런데 원형 셋 가운데 detail(390×844 기준)·pwa(설치 앱)는 모바일이 기본이고 commerce도 대부분 모바일이라, 첫 판에서 실제로 보이는 기법은 `clip-reveal` 하나였다. 데스크톱 detail에서는 자석이 갈 「주 CTA」가 구매하기라, 옆 장바구니·옵션 버튼과 붙어 잘못 누르기 쉬웠다. 자석 대신 터치에서도 보이는 `split-text`(둥근 Jua 글자가 하나씩 내려앉는 「손끝」 연출)를 넣었다.
  - **M3를 유지한 근거**: `split-text`(글자 단위 연출)와 `tilt-3d`(원근 3D)는 축 8의 M3 정의(등장 700ms·expo-out·시그니처 연출)에 맞는 두 기법이고, 모바일에서도 `split-text`와 `clip-reveal` 두 개가 보인다. 기법이 `clip-reveal` 하나만 남았다면 M2로 내렸을 것이다.
  - **`tilt-3d`는 상품 사진이 든 칸에 걸지 않는다**: 원근 변형이 §21-5·§21-6 「색·질감·크기가 실제와 같게」와 부딪친다. 기울이는 칸은 글자·일러스트·분위기 오브젝트(layout-i02)만 든 가장 큰 칸이다.
- **B안: 하늘 점토.** 같은 K8에서 peak만 하늘 235°(`0.78 0.11 235`)로 옮기고 노랑은 옅은 칸(`0.9 0.08 95`)과 버튼 글자로 줄였다. 모션은 M2, 기법은 `clip-reveal` 하나다. 「노랑 + 슬레이트 = 메신저 노랑」 연상(선정서 M2)이 걸리는 브리프에서 고를 수 있다. 하늘 peak는 작은 칸이 C 0.1로 오르면서 `0.78 0.11` → `0.76 0.13 235`로 올렸다(peak C 차 0.02 이상). 자석을 뺀 뒤 부분 조합 7개가 모두 lint를 통과한다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 detail 14곳의 유채색 수 중앙값은 3(3개 이상 9곳), pwa 7곳도 중앙값 3(3개 이상 4곳)이다. commerce 23곳은 중앙값 1이다. 이 레시피는 칸 네 묶음을 쓰므로 detail·pwa 분포 위쪽이고 commerce 분포 밖이다. commerce에서는 칸 색을 상품 목록 칸이 아니라 기획전·카테고리 칸(분위기 칸)에만 쓴다 — 상품 사진이 색을 가져오는 곳에 칸 색을 겹치지 않는다(「쓰는 법」).
- **대비(lint와 같은 `contrast-lib ratio`)**: 라이트 글자/바탕 15.52 · muted 7.32 · 주 버튼 노랑 글자/슬레이트 9.48 · primary(링크 글자)/바탕 12.85 · ring/바탕 4.63 · 입력 테두리 3.43 · 칸 글자 block-1 10.38 · block-2 11.54 · block-3 9.68 · block-4 10.50 · accent 위 글자 12.29. 다크 글자/바탕 15.96 · primary/바탕 11.30 · 칸 글자 block-1 9.68 · block-2 7.66 · block-3 7.53 · block-4 7.85. B안 라이트 하늘 칸 글자 8.23 · 옅은 노랑 칸 12.23. 칸과 바탕의 경계는 1.3~1.5:1이라 칸은 장식 면이다. 칸 안의 조작 요소는 `[data-face="block-N"]` 스코프로 칸 대비를 잰다 — 라이트 칸 안 입력 테두리 3.07~3.27 · 링 10.4~11.8, 다크 노랑 peak 칸 안 링·주 버튼 9.68 · 보조 글자 6.40(lint `face-contrast`, 수치는 「게이트 기록」). 첫 판의 「칸 안 조작 요소가 자기 경계 3:1을 가진다」는 재지 않은 주장이었다(라이트 입력 테두리 2.30~2.60).
- **팔레트 인용**: `pal-sns-instagram-dutypk8cchi-1`(노랑 `0.77 0.14 93` + 슬레이트 `0.32 0.01 217`, minimalist)에서 노랑·슬레이트 쌍을, `pal-sns-threads-ddbj6vadbvk-2`(retro·sunshine, **augmented 팔레트** — 바탕을 더한 팔레트, DESIGN §5-A pal-01)에서 햇빛 노랑(`0.91 0.08 101`)과 주황 57°(`#EB7D00`, `0.70 0.17 57`)의 짝을 — 주황의 색상각을 빌려 살구 칸(45°·C 0.1)으로 낮췄다 — `pal-sns-instagram-djwzhoizfmb-1`(Y2K·soft·cool: 라벤더 303°·민트 164°·복숭아 26°)에서 점토 칸의 명도 대역(L 0.84~0.95)을 빌렸다(채도는 C 0.1로 올렸다). 라벤더는 쓰지 않았다(버린 안 C의 라벤더·민트·피치를 피한다). 모두 hex를 옮기지 않고 OKLCH로 다시 만들었다.
- **서체(선정서 M2 연상 포함)**: Jua·Gothic A1 모두 SIL OFL 1.1(키트 항목 `meta.license`). §13·banlist에 없다. **한글 제목 서체는 Jua 400**이다(선정서 M5). Jua는 굵기 하나뿐이라 부품 제목 칸(카드·대화상자)은 본문 Gothic A1로 그려지고, `.font-heading` 굵기 합성은 꺼진다(`singleWeightRules`). Jua는 배달앱 계열 둥근 서체로 읽혀 쓰임을 식품·생활·키즈로 한정한다. 로더는 둘이다(Jua 1, Gothic A1 1 — r2·r7과 같은 family라 공유).
- **아이콘**: phosphor, 결 G4(둥근 2px — 친근).
- **AI 티 점수**: 아래 「게이트 기록」.

### 게이트 기록

- lint 위반 0·경고 0(새 규칙 `face-contrast`·`primary-surface` 포함, A·B 모두). 자석을 뺀 뒤 B안 부분 조합 7개 모두 통과(첫 판은 5/7). qa:distinct 10벌 문제 없음(K8 대표 칸: 노랑 92°는 r3 B안 주홍 35°와 57°).
- 면 스코프 비율: block-1 면 조각 10% · 보조 글자 82% · 테두리 51%, block-2~4 10% · 94~96% · 50%(칸 글자 짝이 7:1 근처라 보조 글자가 거의 칸 글자색이다).
- `/qa/recipes?r=r9-clay`: run --strict 0 · hit-area fine 37개 실패 0 · coarse 37개 실패 0.
- **AI 티 점수 G 13/239**(kas 6/35) — G006 · G018 · G078 · G084 · G088×4 · G126 · G135×6. 같은 빌드(741d7d2 + Task 7 fix 1, 차가운 캐시)에서 r1-measure를 대조로 함께 쟀다 — r1 G 12. **G104는 없다**(fix 1에서 다시 잼 — 라이트 primary 슬레이트 12.85:1).
  - 첫 판은 **G 16**이었다: +3 G104(APCA) — 라이트 primary 노랑을 `link` 버튼이 글자색으로 써 Lc 27.6. primary를 슬레이트 + 노랑 글자로 뒤집어 고쳤다(위 「노랑의 쓰임」). 이제 lint `primary-surface`가 같은 실패를 생성 전에 막는다.
  - fix 1 첫 재측정도 **16**이었다: +3 G136(같은 구조 카드 연속 4장) — 새 면 견본을 같은 구조 칸 네 개로 그렸기 때문이다. 견본을 크기 위계 벤토(큰 칸 하나 + 작은 칸마다 조작 하나)로 바꿔 빠졌다.
  - **G006(+1, 제목 400 대 본문 400)은 고치지 않고 이유를 적는다.** Jua는 굵기 400 하나뿐이다(키트 `font.weight` ["400"]). 제목을 굵히면 합성 굵기가 되고(레시피 CSS가 `font-synthesis-weight: none`으로 막는다), 본문 Gothic A1은 300 굵기가 없다(400·500·700·800). 위계는 크기로 세운다(H1 50px = 본문 3.1배). r3-woodblock(Black Han Sans 400)과 같은 판정이다.
- **칸 안의 조작**(리뷰 I1 — 다크 노랑 peak 칸 안 CTA·링 1.14이던 자리): 갤러리 「면 위의 조작」 견본(크기 위계 벤토: 첫 면이 큰 칸에 주 버튼·외곽선 버튼·입력·체크, 나머지 면은 작은 칸마다 조작 하나)을 CDP로 쟀다 — 라이트·다크를 `prefers-color-scheme`으로 따로 띄우고, Tab 키 뒤 `focus()`로 `:focus-visible` 링을 켠 계산 색(canvas sRGB)으로.
  - 다크 block-1(노랑 peak): 포커스 링 **9.68** · 주 버튼 채움(슬레이트)/칸 9.68 · 버튼 글자(노랑)/채움 9.68 · 입력 테두리 3.30 · 보조 글자 7.12 · 체크 9.68. block-2·3·4: 링 7.68 · 7.51 · 테두리 3.07 · 3.03 · 3.12 · 보조 글자 7.04 · 7.01 · 7.08.
  - 라이트 block-1: 링 10.40 · 입력 3.20 · 보조 글자 7.13. block-2·3·4: 링 11.58 · 9.68 · 테두리 3.26 · 3.03 · 3.14 · 보조 글자 10.41 · 9.05 · 9.42.
- 한글 제목 서체(CDP): 레시피 제목 h2와 크기 견본 제목 6개 모두 첫 family `Jua`, 그린 서체 Jua(웹폰트), `fonts.check` true. 견본의 `font-bold` 제목 2개는 계산 굵기 700이지만 합성 굵기가 꺼져 Jua 400 획 그대로다. 부품 칸 제목 h3는 Gothic A1 700(단일 굵기 규칙).
- 동작 줄이기(CDP, 갤러리 `prefers-reduced-motion: reduce`): 레시피 칸의 모션 토큰 `--duration-enter` 700ms(.7s) → 0s, `--duration-sheet`·`--duration-hover`·`--duration-press`·`--duration-popover` 모두 0s(factory-base가 토큰 자체를 접는다 — 리뷰 I7). 프리셋은 `animation: none`, 전환·지연은 0. 글자 분할·기울임은 블록 단계(P3-2)에서 `matchMedia`와 이 토큰을 함께 본다.
- 노랑 단독 표시 확인(선정서 I6): 라이트 체크박스·라디오·스위치·진행 막대·슬라이더는 `bg-primary`(슬레이트 — 바탕 대비 12.85:1), 그 위 표시는 노랑(9.48:1)이다. 라이트에서 노랑이 단독 상태 표시로 나오는 곳은 없다. 노랑 면은 가장 큰 칸과 `accent`(선택·hover — 위 글자 슬레이트 12.29:1)다.

## 분위기

말랑한 떡 가게의 첫 화면이다. 페이지 바탕 위 20px 여백 안에 분홍 칸 한 장이 크게 놓이고, 칸 위쪽에는 타일 벽 줄눈이 흐리게 비친다. 왼쪽 아래 둥근 대문자 세 줄 가운데 앞 두 줄은 외곽선만, 마지막 줄은 꽉 찬 글자다. 오른쪽에는 버터색 찻잔과 둥근 떡 둘을 점토처럼 빚은 정물이 포인터를 따라 살짝 기울고, 모서리의 원형 배지가 천천히 돈다. B안은 하늘·세이지 산·숲이 층층이 겹친 평면 풍경 한가운데에 낱자마다 기운 부푼 로고타입을 세운다.

## 쓰는 법

- 맞는 원형은 모바일 PWA(pwa)·한국 상세페이지(detail)·소형 커머스(commerce)다. 식품·생활·키즈 브랜드에 쓴다.
- 첫 화면은 히어로 `framed-card-outline-title`(B안 `layered-landscape-logotype`)다.
  - A: 여백 20px(390px 8px) 액자 안 반경 24px 칸 한 장(`block-1`) — 칸 왼쪽 아래에 별점 줄 → 대문자 세 줄(4.2vw, 앞 두 줄 외곽선 1.5px) → 설명 세 줄 → 알약 버튼 + 밑줄 링크. 오른쪽 정물(사진이 있으면 실사), 오른쪽 아래 도는 글자 배지(지름 112px), 머리 오른쪽 언어 전환 알약.
  - B: 칸 색의 명도만 바꾼 평면 층(하늘 `block-1` → 먼 산 → 구름 → 언덕 `block-2` → 먼 숲 → 호수 → 가까운 숲 `block-4` → 먹 땅) 한가운데 세 줄 로고타입(낱자마다 -4°~+4°). 로고타입이 놓이는 높이는 하늘·먼 산·구름뿐이다. 한 줄 소개는 카드 바탕 알약 위에 둔다.
- 칸: 가장 채도 높은 칸 하나(A 분홍 `block-1`, B 녹 주황 `block-3`)가 1순위 자리를 맡는다. **칸마다 `data-face="block-N"`을 함께 단다** — 칸 안 버튼·링·입력·보조 글자가 그 칸의 짝 색으로 바뀐다. 칸 번호가 배치 순서다(1 → 4). 칸 글자 대비는 라이트 8.35 이상(B 7.44 이상), 다크 7.33 이상.
- commerce·detail에서 칸 색은 기획전·카테고리·구매 포인트 칸에만 쓴다. 상품 목록 칸과 상품 사진 뒤는 흰 카드다.
- 주 버튼: A 라이트는 남색 채움 + 버터 글자(칸 위에서는 칸 스코프가 먹 채움 + 칸 색 글자로 바꾼다), B는 녹 주황 채움 + 흰 글자(7.87).
- 제목은 `font-heading`이다: 라틴 Grandstander 700(B안 Titan One), 한글 베이글 팻 원(B안 동글). 25px 이상 제목에만 쓰고, 부품 제목·버튼·표는 Gothic A1이다. 본문 16px/1.7.
- 반경은 R1(면 12~16px), 버튼은 B3 8px — 알약은 첫 화면 주 버튼·언어 전환·칩뿐이다. pwa 하단 탭바는 §21-9를 따른다.
- 모션은 M2다(등장 500ms, hover 200ms, 곡선 `cubic-bezier(0.2, 0.7, 0.3, 1)`). 역동 기법 셋, 마케팅 면에만:
  - `split-text` — 첫 화면 제목 한 번(A는 글자가 마스크 안에서 올라오고 24ms 차, B는 낱자가 기운 채 튀어 오른다). 원문은 한 번만 읽히고 조각은 `aria-hidden`.
  - `tilt-3d` — A는 정물, B는 로고타입만 포인터를 따라 기운다(누르는 것이 없는 요소만). `pointer: coarse`에서 끄고, 상품 사진이 든 칸에는 걸지 않는다.
  - `clip-reveal` — A는 칸이 안쪽에서 한 번 열리고, B는 풍경 층이 아래에서 차례로 올라온다.
  - 배지 회전·구름 흐름 같은 반복은 화면 밖·숨은 탭에서 멈춘다(`usePauseOffscreen`).
  - 동작 줄이기: 글자는 다 보이고, 기울임은 평면, 칸·층은 바로 보인다.
- 상태는 색과 글자를 함께 쓴다.

## 하지 말 것

- 같은 크기 카드에 파스텔을 돌려 칠하지 않는다. 칸 크기로 위계를 주고, 가장 진한 색은 1순위 칸 하나뿐이다.
- 칸을 무지개 순서(색상환 한 방향)로 늘어놓지 않는다.
- 외곽선 글자를 본문·버튼·가격에 쓰지 않는다. 첫 화면 제목의 앞 줄들뿐이고, 마지막 줄은 꽉 찬 글자다.
- 풍경·정물 그림 위에 작은 글자를 바로 올리지 않는다. 소개 문장은 카드 바탕 위에 둔다.
- 모든 버튼을 알약으로 만들지 않는다. 클레이 그림자를 모든 카드에 두지 않는다.
- 한글 제목체로 본문·버튼·표·작은 부품 제목을 쓰지 않는다. `font-bold`로 굵히지 않는다(합성 굵기).
- 매일 쓰는 앱 화면(pwa 목록·설정)에 글자 분할·기울임·스크롤 등장을 걸지 않는다.
- 구매하기·장바구니·옵션·하단 구매 바는 움직이지 않는다.
- 파는 상품을 3D·생성 이미지로 대신하지 않는다. 점토 정물은 분위기 칸에만 둔다(§21-5·§21-6).
- 어두운 초콜릿 사진 바탕을 기본 테마로 옮기지 않는다. 이 레시피는 밝은 바탕 K8이다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r9-clay.md`. 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(여백 액자 속 둥근 카드 + 외곽선·채움 교대 대문자) · 카드 팔레트(`pal-sns-instagram-dutypk8cchi-5` + 측정값) · Grandstander + 베이글 팻 원. 가게 사진 자리는 분홍 칸(`block-1`) 위 직접 그린 점토 정물과 타일 벽 줄눈이다.
  - 카드 값에서 바꾼 것: 다크 `block-1` L 0.7071 → **0.735**, 다크 `block-4` L 0.6998 → **0.73**(칸 글자 대비 6.79·6.85 → 7.54·7.67). 첫 화면 칸의 알약 버튼은 칸 스코프의 주 버튼(먹 채움 + 분홍 글자)이다 — 분홍 칸 위 분홍 버튼은 보이지 않는다.
- B안 = 카드 수 2(층층 평면 풍경 + 가운데 뭉툭한 로고타입) · 새 팔레트: 측정 사이트 2의 세이지 `#A5C0BA` → `block-2` `oklch(0.78 0.063 175)`(K8 칸 문턱 C 0.05 위로 채도만 올림)·숲 `#152017` → 글자·하늘 `#E4EEF3` → 바탕 `#F4F7F8`과 `block-1` `oklch(0.86 0.063 235)`·녹 주황 버튼 `#9E471E` → 주색 `oklch(0.45 0.125 40)`(흰 글자 6.22 → 7.87 되도록 명도만 낮춤)과 `block-3` `oklch(0.44 0.13 40)` + SNS 팔레트 `pal-sns-threads-ddo1vakdqal-1`(청록 `#50757B` 링 · 하늘 `#89B3DD` 다크 링 · 숲 먹 `#121711` 칸 글자) · Titan One + 동글.
  - 카드 값에서 바꾼 것: 다크 `block-2` L 0.66 → **0.72**, 다크 `block-3` L 0.48 → **0.43**(칸 글자 대비 6.17·6.41 → 7.72·7.96). 폭포·여우·잎 원본 대신 호수·천막·잎 한 쌍을 직접 그렸다.
  - 측정 경계 여유를 위한 채도 +0.003(컨트롤러 판정, Task 11 fix): 풍경 층(하늘·먼 산·언덕)이 `block-1`·`block-2`와 그 섞음이라 계산 채도가 첫 화면 유채 픽셀 문턱(OKLCH C 0.06)에 딱 걸려, 래스터 경로에 따라 비율이 25% 위아래로 뒤집혔다. 라이트·다크 `block-1`·`block-2` C 0.0600 → **0.0630**(눈으로는 구별되지 않는다). 칸 글자 대비는 그대로다(라이트 block-1 12.00 · block-2 9.32 → 9.33, 다크 7.58 · 7.72 → 7.73 — `contrast-lib ratio`).
- 색 논리 K8·모션 M2·기법 `split-text`·`tilt-3d`·`clip-reveal`은 선택 보드 판정(Task 9) 그대로다. B안도 같은 K8이다.
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- layout-i02 : 한 재질(점토)을 제대로 쓴 오브젝트를 분위기 칸 하나에 둔다.
- layout-l10 : 1순위 한 곳에 집중한다 — 가장 큰 칸 하나에만 가장 진한 색.
- motion-m04 : 목적 있는 순차 등장. 첫 화면 제목 글자 분할과 칸·층 걷기 한 번만 쓴다.
- layout-commerce-has-product-list : 커머스 홈의 상품 목록 칸은 흰 카드로 두고 칸 색을 기획전 칸에 몬다.
- pal-sns-instagram-dutypk8cchi-1 : 노랑 + 슬레이트 쌍 — 지난 판(Task 7)의 근거.
- pal-sns-threads-ddbj6vadbvk-2 : 햇빛 노랑과 주황의 짝(augmented 팔레트 — 약한 근거).
- pal-sns-instagram-djwzhoizfmb-1 : 옅은 점토 칸의 명도·채도 대역(민트·복숭아).
- pal-sns-instagram-dutypk8cchi-5 : 남색·버터·연어 스플릿 — A안 글자·주색·칸의 근거.
- pal-sns-threads-ddo1vakdqal-1 : 숲 저녁 톤(청록·하늘·숲 먹) — B안 링·칸 글자의 근거.
