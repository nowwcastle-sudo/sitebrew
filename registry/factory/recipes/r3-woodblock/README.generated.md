<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 네도수 목판 (`r3-woodblock`) — 레시피 안내

원천: `registry/factory/recipes/r3-woodblock/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r3-woodblock#v0.1.2        # 디자인 시스템 전체(registry:base)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r3-woodblock-theme#v0.1.2  # 색만(registry:theme)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r3-woodblock-alt#v0.1.2    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r3-woodblock-<부품>`(예: `r3-woodblock-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r3-woodblock/r3-woodblock.css` 를 붙인다.

## 한눈에

- 분위기: 손맛 · 인쇄 · 장터
- 첫 화면 히어로: staggered-oval-frame(엇갈린 두 줄 + 가운데 타원 액자)
- 맞는 원형: local · commerce
- 스타일 축: 반경 R0 · 버튼 B1 · 입력 I3 · 표면 C2 · 표 T1 · 머리 H3 · 그림자 S2
- 모션 M2 · 아이콘 phosphor G5(부품이 부르는 어댑터 `components/icons/phosphor-bold` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2.5 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Young Serif(`font-young-serif`, 굵기 400 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면 제목·가격 숫자 전용 두툼한 올드 세리프. 굵기 400 하나, 6.3vw(390에서 18vw)·행간 1.05, 첫 줄은 왼쪽 2/12 들여, 둘째 줄은 오른쪽 끝 맞춤. 부품 제목 칸은 본문 서체로 돌아간다) · 한글 제목 Song Myung(`font-song-myung`) · 본문 Noto Sans KR(`font-noto-sans-kr`, 조정: 본문 16px/1.7 굵기 400, 가격·메뉴 이름 700(차 300), 가격표 행은 T1 조밀이라 행간 1.5·tabular-nums) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: I3 전화·수량 입력에만, 굵기 400. 가격은 본문 서체 tabular-nums로 쓴다)
- 레퍼런스: color-c09 · layout-i05 · type-t09 · layout-l18 · color-local-accent-restrained · pal-sns-instagram-ddujmhojbb4-2 · pal-sns-threads-ddbj6vadbvk-2 · pal-sns-instagram-dct4vqjmytn-5
- 색 논리 K8(색 블록) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `grain`(그레인(feTurbulence)) · `clip-reveal`(clip-path 리빌) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K8 그대로) · 서체 Shrikhand · BM Euljiro · 첫 화면 twin-panels — DNA 수 2(나란한 큰 칸 두 장 + 칸 밑 캡션) — 흰 종이·남색 잉크에 모래·산호·하늘·자두 칸의 새 팔레트(pal-sns-instagram-dct4vqjmytn-5 + 측정 사이트의 하늘·모래·먹), 제목 Shrikhand·배민 을지로체. 색 논리 K8·모션 M2·기법 grain·clip-reveal 은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9666 0.0026 106.45)` | `oklch(0.1998 0.0020 106.58)` |
| `--foreground` | `oklch(0.2264 0.0000 0.00)` | `oklch(0.9428 0.0013 106.42)` |
| `--card` | `oklch(0.9970 0.0000 0.00)` | `oklch(0.2346 0.0019 106.54)` |
| `--card-foreground` | `oklch(0.2264 0.0000 0.00)` | `oklch(0.9428 0.0013 106.42)` |
| `--popover` | `oklch(0.9970 0.0000 0.00)` | `oklch(0.2346 0.0019 106.54)` |
| `--popover-foreground` | `oklch(0.2264 0.0000 0.00)` | `oklch(0.9428 0.0013 106.42)` |
| `--primary` | `oklch(0.3177 0.0851 262.88)` | `oklch(0.8000 0.0641 264.11)` |
| `--primary-foreground` | `oklch(0.9970 0.0000 0.00)` | `oklch(0.1998 0.0020 106.58)` |
| `--secondary` | `oklch(0.9428 0.0013 106.42)` | `oklch(0.2516 0.0019 106.53)` |
| `--secondary-foreground` | `oklch(0.2264 0.0000 0.00)` | `oklch(0.9428 0.0013 106.42)` |
| `--muted` | `oklch(0.9428 0.0013 106.42)` | `oklch(0.2516 0.0019 106.53)` |
| `--muted-foreground` | `oklch(0.3859 0.0084 97.54)` | `oklch(0.7690 0.0085 98.92)` |
| `--accent` | `oklch(0.9303 0.0116 264.51)` | `oklch(0.2846 0.0277 263.98)` |
| `--accent-foreground` | `oklch(0.3177 0.0851 262.88)` | `oklch(0.9110 0.0281 263.43)` |
| `--border` | `oklch(0.6157 0.0090 98.97)` | `oklch(0.5131 0.0078 97.46)` |
| `--input` | `oklch(0.5341 0.0078 97.45)` | `oklch(0.5890 0.0076 97.43)` |
| `--ring` | `oklch(0.3177 0.0851 262.88)` | `oklch(0.8000 0.0641 264.11)` |
| `--block-1` | `oklch(0.8683 0.1062 83.74)` | `oklch(0.4200 0.0900 80)` |
| `--block-1-foreground` | `oklch(0.2548 0.0420 92.04)` | `oklch(0.9813 0.0175 81.33)` |
| `--block-2` | `oklch(0.7507 0.1279 40.97)` | `oklch(0.4800 0.1100 41)` |
| `--block-2-foreground` | `oklch(0.2155 0.0438 42.89)` | `oklch(0.9741 0.0143 50.81)` |
| `--block-3` | `oklch(0.7424 0.0615 227.04)` | `oklch(0.5132 0.0644 230.06)` |
| `--block-3-foreground` | `oklch(0.2465 0.0255 232.49)` | `oklch(0.9755 0.0075 228.85)` |
| `--block-4` | `oklch(0.6559 0.0866 327.90)` | `oklch(0.4400 0.0800 328)` |
| `--block-4-foreground` | `oklch(0.1898 0.0335 329.32)` | `oklch(0.9657 0.0210 328.08)` |

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

- `[data-face="block-1"]`: 면 조각(muted·accent·secondary) = block-1-foreground 10% · 보조 글자 94% · 테두리·입력 52% (나머지는 block-1)
- `[data-face="block-2"]`: 면 조각(muted·accent·secondary) = block-2-foreground 10% · 보조 글자 100% · 테두리·입력 63% (나머지는 block-2)
- `[data-face="block-3"]`: 면 조각(muted·accent·secondary) = block-3-foreground 10% · 보조 글자 100% · 테두리·입력 60% (나머지는 block-3)
- `[data-face="block-4"]`: 면 조각(muted·accent·secondary) = block-4-foreground 4% · 보조 글자 100% · 테두리·입력 68% (나머지는 block-4)

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9576 0.0133 111.27)` | `oklch(0.2006 0.0153 113.58)` |
| `--foreground` | `oklch(0.2798 0.0405 98.23)` | `oklch(0.9503 0.0160 114.38)` |
| `--card` | `oklch(0.9824 0.0093 113.16)` | `oklch(0.2393 0.0165 112.80)` |
| `--card-foreground` | `oklch(0.2798 0.0405 98.23)` | `oklch(0.9503 0.0160 114.38)` |
| `--popover` | `oklch(0.9824 0.0093 113.16)` | `oklch(0.2393 0.0165 112.80)` |
| `--popover-foreground` | `oklch(0.2798 0.0405 98.23)` | `oklch(0.9503 0.0160 114.38)` |
| `--primary` | `oklch(0.4073 0.0573 164.73)` | `oklch(0.7947 0.0665 152.94)` |
| `--primary-foreground` | `oklch(0.9576 0.0133 111.27)` | `oklch(0.2006 0.0153 113.58)` |
| `--secondary` | `oklch(0.9289 0.0174 113.83)` | `oklch(0.2548 0.0183 116.90)` |
| `--secondary-foreground` | `oklch(0.2798 0.0405 98.23)` | `oklch(0.9503 0.0160 114.38)` |
| `--muted` | `oklch(0.9289 0.0174 113.83)` | `oklch(0.2548 0.0183 116.90)` |
| `--muted-foreground` | `oklch(0.3838 0.0382 99.88)` | `oklch(0.8056 0.0303 113.38)` |
| `--accent` | `oklch(0.9241 0.0238 125.20)` | `oklch(0.2871 0.0212 115.44)` |
| `--accent-foreground` | `oklch(0.2798 0.0405 98.23)` | `oklch(0.9503 0.0160 114.38)` |
| `--destructive` | `oklch(0.5 0.16 32)` | `oklch(0.7 0.13 32)` |
| `--border` | `oklch(0.6197 0.0366 114.86)` | `oklch(0.5128 0.0277 115.07)` |
| `--input` | `oklch(0.5619 0.0388 114.77)` | `oklch(0.5964 0.0355 115.17)` |
| `--ring` | `oklch(0.4073 0.0573 164.73)` | `oklch(0.7947 0.0665 152.94)` |
| `--success` | `oklch(0.5 0.11 138)` | `oklch(0.76 0.11 138)` |
| `--success-foreground` | `oklch(0.985 0.008 138)` | `oklch(0.2 0.03 138)` |
| `--warning` | `oklch(0.55 0.12 70)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 70)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.48 0.09 240)` | `oklch(0.75 0.08 240)` |
| `--info-foreground` | `oklch(0.985 0.005 240)` | `oklch(0.2 0.02 240)` |
| `--block-1` | `oklch(0.4000 0.0707 158.16)` | `oklch(0.4000 0.0707 158.16)` |
| `--block-1-foreground` | `oklch(0.9689 0.0134 115.83)` | `oklch(0.9689 0.0134 115.83)` |
| `--block-2` | `oklch(0.6998 0.1702 56.53)` | `oklch(0.6800 0.1542 57.67)` |
| `--block-2-foreground` | `oklch(0.2186 0.0316 94.21)` | `oklch(0.2006 0.0153 113.58)` |
| `--block-3` | `oklch(0.7424 0.0750 227.04)` | `oklch(0.4332 0.0644 230.06)` |
| `--block-3-foreground` | `oklch(0.2465 0.0255 232.49)` | `oklch(0.9755 0.0075 228.85)` |
| `--block-4` | `oklch(0.5300 0.1176 25.80)` | `oklch(0.4707 0.1086 25.73)` |
| `--block-4-foreground` | `oklch(0.9804 0.0127 63.93)` | `oklch(0.9804 0.0127 63.93)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-young-serif-wf, "Young Serif", "Song Myung", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-song-myung-wf, "Song Myung", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-song-myung-wf, "Song Myung", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

제목 서체 Young Serif는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끄고(`font-synthesis-weight: none`), 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 본문 스택으로 그린다. 제목 서체는 소비자가 직접 쓴 큰 제목에만 나온다.

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Song Myung → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 Song Myung는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다.

## 원천 본문

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- B 메모: 대표 「역시나 모션 그래픽이 너무 단순함」. 모션 보완은 이번 판정 범위가 아니고 별도 모션 작업에서 다룬다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **B안 채택(B 전체)** — 색 논리 K1 → **K8 네 도수 색 블록**, 모션 M0 → **M2**, 역동 기법 `grain`·`oversize-crop` → **`grain`·`clip-reveal`**. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- 이름을 「두도수 목판」에서 **「네도수 목판」**으로 바꿨다. B는 「세 번째 도수 금지」를 풀고 판 색을 넷으로 늘리는 안이라 옛 이름이 값과 어긋난다(id `r3-woodblock`은 그대로). 분위기 세 단어(손맛·인쇄·장터)는 그대로다.
- 머리로 옮긴 칸 색(보드 B 값 — 두 칸은 명도만 조정, 라이트 / 다크): `block-1` 숲초록 `0.5 0.11 150` → **`0.4 0.11 150`** / `0.45 0.1 150` → **`0.42 0.1 150`** · `block-2` 주홍 `0.62 0.19 35` → **`0.71 0.19 35`** / `0.62 0.16 35`(그대로) · `block-3` 황토 `0.8 0.12 88` / `0.74 0.11 88` · `block-4` 쪽 `0.4 0.12 265` / `0.42 0.11 265`, 각 `-foreground` 짝 포함. 종이·갈색 먹·숲초록 주 버튼·상태색은 A 그대로다. `alternates`는 지웠다.
- 대비 관문을 위해 명도만 조정(컨트롤러 판정, 운영자 선택 색상·채도 유지): 보드 값으로는 block-1 면 보조 글자가 본문 7:1 관문(ux-gate)에 못 닿았고(라이트 5.42·다크 6.47), 주홍 칸 글자가 4.98이었다. 컨트롤러가 정한 값은 다크 block-1 `0.43`이었으나 렌더에서 6.94로 여전히 걸려 `0.42`로 한 단계 더 내렸다(같은 판정 안의 명도 조정). 대비(칸 글자/칸): 라이트 block-1 **8.40** · block-2 **7.02** · block-3 9.24 · block-4 8.62, 다크 **7.43** · 5.05 · 7.83 · 7.89. 다크 주홍 칸(5.05)은 판정 대상이 아니어서 그대로다 — lint 경고 `block-contrast-target`이 남고, 이 칸에는 **큰 글자·가격·짧은 이름만** 싣는다(「쓰는 법」). 생성기 `faceTokens`는 이제 면 보조 글자를 닿을 수 있으면 7.15 이상으로 고른다(렌더 여유 `FACE_RENDER_MARGIN` 0.15 — 브라우저 렌더가 계산값보다 0.05~0.1 낮게 나와 r3 다크 block-1이 계산 7.01·렌더 6.94로 관문에 걸렸다).
- 바뀐 것: 아래 Task 5 결정 기록의 「도수는 둘」·「강조 도수 초록 하나」·M0 문장은 A안을 고를 때의 판단으로 남긴다. 지금 값은 이 절과 「분위기」·「쓰는 법」·「하지 말 것」이 정한다. 대칭 마스트헤드·조밀한 가격표(T1)·먹색 오프셋(S2)·Black Han Sans 제목·직각 크롬은 그대로다.
- AI 티 점수(명도 조정 뒤 다시 잼, 같은 빌드 r1 대조 12): G **16**/239(kas 6/35). +1 G006은 앞과 같은 판정(Black Han Sans 단일 굵기, 아래 Task 6 fix 1). **+3 G104(APCA)는 남는다**: 라이트 주홍 칸을 `0.71`로 올려 WCAG는 7.02:1이 됐지만 APCA는 Lc 50.6(본문 기준 60 미만)이다 — 채도 높은 주홍 위 어두운 글자는 WCAG보다 APCA에서 불리하다. AI 티는 경고 모드라 관문이 아니다. 더 올리면(L 0.8 근처) 주홍이 살구로 바뀌어 대표 색을 벗어나므로 멈췄다.
- 갤러리 관문(명도 조정 뒤, `/qa/recipes?r=<id>`): `run.mjs --strict` 0 · hit-area fine·coarse 0 · 대표 장면 관문(`board:gates`) 0.

## 첫 화면 색 면적 (2026-09-28, P3-1 Task 10f fix)

- 보드 v2 히어로 관문(1440 첫 화면, 그려진 픽셀 중 OKLCH C ≥ 0.06 비율 ≥ 25%)에서 A 히어로가 21.6%였다. 하늘 칸(block-3, 첫 화면 바탕)이 C 0.0615로 문턱에 걸쳐 있어, 판 결 입자(곱하기 0.12)를 지나면 렌더 C 0.059~0.060으로 무채로 읽혔다.
- 라이트 `block-3`의 채도만 `0.0615` → **`0.0750`**(`#82B4CA` → `#77B6D1`, 명도·색상 그대로). 칸 글자 대비는 7.15 → 7.17. 다크 값과 B안(alternates) 값은 그대로다.

## 결정 기록 (2026-09-27, P3-1 Task 5)

방향 원천은 dribbble-summary §6 R3(판화·두도수·손맛)이고, 선정서 `docs/recipes/candidates-2026-09-27.md` r3-woodblock 줄을 그대로 따랐다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 두도수 목판 (고름) | B 리소 두 도수 (남김, 안 씀) | C 크라프트 장터 (버림) |
|---|---|---|---|
| 분위기 3단어 | 손맛 · 인쇄 · 장터 | 경쾌 · 인쇄 · 동네 | 따뜻 · 수제 · 옛날 |
| 축 | B1 I3 C2 T1 H3 R0 S2, M0 | B1 I3 C2 T1 H3 R0 S2, M0 | B2 I2 C3 T2 H1 R1 S1, M2 |
| 서체 짝과 이유 | Black Han Sans(한글 목판 제목) + Noto Sans KR(본문·가격표). 칼로 판 듯 두꺼운 한 굵기 제목과, 조밀한 가격표를 버티는 중립 고딕 | 같은 짝 | 웨스턴 세리프 디스플레이 + 손글씨 본문 |
| 색 3개 + 강조 1 | 초록 기운 오프화이트 종이(hue 150) · 갈색 먹(hue 52) · 옅은 초록 면 + 숲초록 잉크(hue 160) | 흰 종이 · 먹 · 회색 + 형광 분홍·파랑 두 도수 | 크라프트 크림 바탕 · 에스프레소 글자 · 베이지 + 테라코타 |
| 사진·그림 | 가게 실사 + 두 도수 판화 그림(평면 도형에 1~2px 입자) | 리소 망점 그림 | 수채 일러스트 |
| 이 안에서만 나오는 레이아웃 | 가운데 대칭 마스트헤드(layout-l18, N6) + 조밀한 가격표(T1) + 먹색이 어긋나 찍힌 1순위 카드(S2) | 같은 틀 | 폴라로이드 카드 격자 |
| 레퍼런스 2개 | color-c09 · layout-l18 | color-c09 · layout-i05 | 없음(상투 조합) |

- **버린 안: C.** 크라프트 크림 바탕 + 테라코타 + 웨스턴 세리프는 §13 「따뜻한 크림 배경 + 세리프 디스플레이 + 테라코타」 정면이고, 계획의 피할 패턴(크림·베이지 바탕)이다.
- **남긴 안: B.** 형광 분홍 면은 그 위 글자 대비가 서지 않고, 파랑 도수가 r1·r6의 파랑과 겹친다. 이 레시피에서는 「도수는 둘」이라는 규칙만 가져왔다.
- **고른 안: A.** 방문자 모드는 찾기(local — 오늘 여는가·어디인가·가격)와 사기(commerce)다.
- **크롬 구분(0 계열 세 벌, 선정서 리뷰 I3)**: r1·r2·r3은 B1·I3·C2·H3·R0이 같다. r3은 표가 T1 조밀(장터 가격표·메뉴판), 그림자가 S2 단색 오프셋(블러 0, 먹색 4px — 판이 어긋나 찍힌 인쇄), 내비가 N6 masthead(대칭 락업을 가운데 두는 헤더)다. 색도 셋 중 유일하게 바탕·글자·강조가 모두 유채(종이 초록 기운 C 0.01, 갈색 먹 C 0.03)다.
- **S2의 범위(리뷰 M7)**: S2 축은 카드뿐 아니라 팝오버·셀렉트·드롭다운·메뉴바·툴팁·선택된 탭에도 `4px 4px 0 var(--foreground)`를 준다(축 CSS가 정한다). 버튼에는 그림자 훅이 없어 **주 CTA에는 오프셋이 없다** — 선정서의 「1순위 카드·주 CTA에만」과 다른 점이다. 그래서 「1순위에만」은 토큰이 아니라 쓰는 법이다: 카드 부품은 1순위 덩어리(오늘의 메뉴, 대표 상품)에만 쓰고, 나머지는 C2 선 구획으로 나눈다. 오버레이·선택 탭의 오프셋은 「지금 떠 있는 판」 표시로 받아들인다. 오프셋 색은 갈색 먹이다(초록 잉크가 아니다). 두 도수 인쇄에서 먹판이 어긋난 모양이다.
- **교체 가능성 검사로 고친 것**
  - 글자를 순흑 계열 먹으로 두면 초록 종이 위에서 「초록 테마의 기본값」으로 읽힌다. 선정서대로 글자를 갈색 먹(hue 52, 「색 있는 어두운 닻」)으로 두어 두 번째 도수로 만들었다. muted 글자도 같은 갈색에서 파생했다(§5 「색 있는 면 위 보조 글자는 그 hue에서」).
  - 성공색이 숲초록 잉크와 같은 초록이면 주 버튼과 「완료」 배지가 한 색이 된다. success는 hue 138(잉크 160에서 22° 노란 쪽)로 떼고, 배지는 늘 「완료」 글자를 붙인다. 오류색은 빨강–초록 쌍을 피하려고 순빨강 대신 붉은 도장색(hue 32)으로 두고 아이콘·글자를 함께 쓴다(§5 MUST).
  - 다크는 종이와 먹을 뒤집었다. 바탕이 갈색 먹판(L 0.18, hue 52)이고 글자가 초록 기운 흰 종이색이다. 소나무 밤을 쓰는 r8-dusk(초록 다크)와 겹치지 않게 다크 바탕을 초록으로 두지 않았다.
- **팔레트 인용**: `pal-sns-instagram-ddujmhojbb4-2`(SNS 대표 저장분, 가중 0.2, 보강 없음)의 역할 구조를 그대로 가져왔다 — 바탕 옅은 초록(0.978 0.011 150) · 글자 갈색(0.30 0.027 52) · 주색 숲초록(0.479 0.078 161) · muted 옅은 초록 · 테두리 짙은 초록. hex는 옮기지 않고 OKLCH로 다시 만들었다. 주색은 흰 글자 4.5:1을 넉넉히 넘기려고 L을 0.42로 내렸고, 테두리는 선 구획 3:1만 맞추면 되어 짙은 초록 대신 L 0.58 초록 회색으로 올렸다.
- **서체**: Black Han Sans·Noto Sans KR·IBM Plex Mono 모두 SIL OFL 1.1이다(키트 항목 `meta.licenseUrl`). Black Han Sans는 굵기 400 하나라 제목 전용이다(§2 MUST). **한글 제목 서체는 Black Han Sans**다(선정서 M5). 썸네일·자막용 임팩트 서체로 흔히 읽히므로(선정서 M2) 쓰임을 장터·식음으로 한정하고, Task 8 보드에서 Gasoek One(키트 `font-gasoek-one`, 같은 단일 굵기)과 A/B로 받는다.
- **아이콘**: phosphor(키트 항목 `icons-phosphor`, 결 G5 → Phosphor Bold). 굵은 획이 목판 제목의 두께와 맞는다. 채움(fill)은 선택 표시에만 쓴다(§6-A).
- **색 수 판단**: `refs-v2/samples.jsonl`에서 local 23곳 중 13곳, commerce 23곳 중 16곳이 유채색 2개 이하다(중앙값 2·1). 카드 color-local-accent-restrained도 local 13곳의 유채색 중앙값이 1이다(범위 0~2). 인쇄 쪽 카드 color-c09는 「바탕 1 + 잉크 1~2색」(표본 5개)이다. 그래서 강조 도수는 초록 하나로 두고, 갈색은 C 0.03의 글자색이라 강조 묶음에 들지 않는다(§5-A — C 0.05 이상만 센다). 차트 4·5번 갈색(C 0.05~0.06)을 넣어도 색상각 묶음은 초록 160°·갈색 52° 두 개다. 상태색(성공·경고·오류·정보)은 §5 MUST라 따로 두고 의미에만 쓴다.
- **글자 크기**: 비율 1.2 하나로 16 · 19 · 23 · 28 · 33 · 40 · 48 · 57에서 멈춘다. 가격표가 조밀하므로(T1) 작은 단계가 촘촘해야 하고, 제목:본문은 57/16 ≈ 3.6배다(local 표본 h1:본문 중앙값 3.75).
- **AI 티 점수**: `/qa/recipes?r=r3-woodblock` 경고 모드 G **12**/239(kas 5/35) — r1 기준선 12와 같다. 적중은 r1과 같은 검수대 틀 쪽(G018·G078·G084·G088×4·G126·G135×2)이고, S2 오프셋(G113)은 축 한정 예외 `brutal-offset`으로 빠졌다(표: `docs/qa/ai-tell-baseline.md`).
  - **Task 6 fix 1 다시 잼: G 13**/239(kas 5/35). 검수대 제목이 이제 레시피 제목 굵기(`fonts.display.weight: 400` → `--wf-heading-weight`)로 그려진다. 그래서 G006(+1, 「제목과 본문 굵기 차 300 미만」, 400 대 400)이 걸린다. **고치지 않고 이유를 적는다.** Black Han Sans는 굵기가 400 하나뿐이고, 글자 자체가 굵은 제목 전용 서체라 굵기 숫자의 차로는 위계가 재지지 않는다. 처음 판의 12는 검수대 제목이 `font-bold`(700)를 선언해서였다. 합성이 꺼져 있어 화면은 400이었는데 검사기는 선언 값 700을 읽었다. 없는 700을 적는 쪽이 사실과 다르다(§2 「서체가 실제로 가진 굵기만」). 나머지 적중은 앞과 같다.
- **부품 제목과 합성 볼드(리뷰 I2)**: 레시피 부품도 제목에 굵기를 건다 — 카드 제목은 C2 축이 `text-lg font-bold`(18px 700), 대화상자·서랍·시트 제목은 16px, Empty 제목은 14px이고 모두 `font-heading`이다. 굵기 400 하나뿐인 Black Han Sans에 700이 걸리면 브라우저가 굵기를 합성해 획이 뭉개지고(리뷰 CDP 확인), 25px 미만 부품 제목에 제목 전용 서체가 나온다. 생성기가 단일 굵기 제목 서체(키트 항목의 굵기 수로 판정)에 두 규칙을 더해 막는다: `.font-heading { font-synthesis-weight: none }`, 부품 제목 칸 `[data-slot$="-title"].font-heading`은 본문 스택(Noto Sans KR 700). 그래서 Black Han Sans는 소비자가 직접 쓴 25px 이상 제목에만 나오고, 거기에 bold를 걸어도 굵어지지 않는다(위계는 크기로 낸다). 갤러리 견본의 20px 크기 견본 줄은 모든 레시피 공통 틀이라 이 규칙 밖이다.

## 분위기

장날 게시판에 붙은 네 도수 목판 인쇄물 같은 화면이다. 초록 기운 종이에 갈색 먹으로 쓰고, 칸마다 판 색 하나 — 숲초록·주홍·하늘·벽돌 — 를 찍는다. 첫 화면은 하늘 칸 한 장 위에 두툼한 올드 세리프 제목을 두 줄로 엇갈려 놓고, 두 줄 사이 가운데 이중 테두리 타원 액자 안에 목판 그림을 넣는다. 좌우 끝에는 숲초록·벽돌 잎가지가 화면 밖으로 잘려 걸친다. 칸 위에는 판 결 같은 입자가 곱해지고, 액자는 처음 한 번 동그랗게 열린다. B안은 흰 종이·남색 잉크 위에 모래·산호·하늘·자두 판을 쓰고, 첫 화면을 나란한 큰 칸 두 장으로 채운다.

## 쓰는 법

- 맞는 원형은 동네 가게·예약(식당·빵집·찻집·장터)과 소형 커머스(식품·생활)다. 오늘 여는지, 무엇을 얼마에 파는지가 주인공인 곳에 쓴다.
- 첫 화면은 히어로 `staggered-oval-frame`(B안 `twin-panels`)이다. 제목 첫 줄은 왼쪽 2/12에서, 둘째 줄은 오른쪽 끝에 맞추고, 액자는 폭 45vw(390px에서 80vw) 타원에 2px + 6px 이중 테두리다. 머리는 가게 이름·동네 두 라벨과 짧은 내비뿐이다.
- 큰 제목은 `font-heading`(라틴 Young Serif, 한글 송명)이다. 둘 다 굵기 하나뿐이라 `font-bold`를 걸지 않는다(레시피 CSS가 합성을 막고, 부품 제목 칸은 본문 서체로 돌아간다). 버튼·표·본문·배지는 Noto Sans KR이다.
- 메뉴·가격표는 HTML 표(T1 조밀)로 싣는다(§21-3 MUST). 이름·가격 700 tabular-nums, 설명 400 muted.
- 칸: `bg-block-1`~`bg-block-4`, 글자는 각 `text-block-n-foreground`, **칸마다 `data-face="block-N"`을 함께 단다**. 칸 번호가 배치 순서다. 하늘 칸(block-3)은 첫 화면 바탕, 주홍 칸(block-2)은 액자 한 곳이다. block-1(숲초록, 글자 대비 8.14)만 두 줄 넘는 문장을 싣고, 나머지 칸은 제목·가격·짧은 이름만 싣는다(대비 5.2~7.2).
- 구분선은 바탕 대비 3:1 이상이다(선 구획 C2·H3).
- 숲초록 잉크(`primary`)는 주 버튼 채움, 포커스 링, 선택 칸의 옅은 초록(accent)에 쓴다.
- 파는 음식·상품·매장은 실물 사진만 쓴다(§21-3·§21-5 MUST). 사진이 없을 때 첫 화면 그림은 평면 도형의 목판 그림이다.
- 모션은 M2다(등장 500ms, hover 200ms, 튕김 없음). 가격표·예약 폼에는 등장 연출을 걸지 않는다(§8-1).
- 역동 기법 둘:
  - `grain` — 칸 위에 feTurbulence 입자(baseFrequency 0.8 · numOctaves 2 · 곱하기 · 0.12)를 깐다. 입자는 정지해 있고, 액자(B안은 칸)에 포인터가 오면 씨앗이 steps(2) 160ms로 한 번 바뀌어 「다시 찍힌」 결이 난다.
  - `clip-reveal` — 액자가 원형 clip-path로 한 번 열린다(B안은 두 칸이 아래에서 80ms 차로). 동작 줄이기에서는 바로 보인다.

## 하지 말 것

- 바탕을 크림·베이지로 데우지 않는다. 종이는 초록 기운 그대로 둔다(§13·§5-A).
- 판 색을 다섯 번째로 늘리지 않는다. 칸 색은 block-1~4 넷뿐이고, 한 칸에 두 판 색을 겹치거나 판 색 사이에 그라디언트를 넣지 않는다.
- 주홍 칸을 한 화면에 두 칸 이상 쓰지 않는다. 가장 진한 판은 한 곳에서만 눈을 끈다.
- Young Serif·Shrikhand를 본문·버튼·가격에 쓰지 않는다. 굵기를 흉내 내려고 bold를 걸지도 않는다.
- 생성 이미지로 메뉴·상품을 그리지 않는다. 사진이 없으면 목판 그림이나 비율을 고정한 빈 자리로 둔다.
- 입자를 글자 뒤·표 뒤에 깔지 않는다. 입자는 칸과 그림 위에만 넣는다.
- 둥근 모서리를 섞지 않는다(R0). 예외는 액자 타원과 B안의 「전부 보기」 알약 하나다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r3-woodblock.md`. 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(엇갈린 두 줄 + 가운데 타원 액자) · 카드 팔레트(`pal-sns-threads-ddbj6vadbvk-2` + 측정값) · Young Serif + 송명. 바꾼 값: block-1 숲초록은 카드 `#2F6146`(글자 6.59)의 명도만 L 0.40으로 내렸다(8.14 — 첫 면 칸의 보조 글자가 본문 7:1 관문에 닿게). 구분선은 카드 `#C8CBB6`·`#3A3C2C`가 선 구획 3:1을 못 넘어 `#858970`·`#666957`로 내렸다. 다크 주홍 칸은 카드 `#D07000`(L 0.64)의 명도만 L 0.68로 올렸다 — 면 스코프 옅은 칸이 렌더에서 4.49로 4.5에 못 닿았다(보드 면 관문, 5.16 → 5.99).
- B안 = 카드 수 2(나란한 큰 칸 두 장 + 칸 밑 캡션) · 새 팔레트: 측정 사이트의 하늘 `#82B4CA`·모래 `#F5CE80`·먹 `#1C1C1C`·흰 종이 `#F4F4F2`/`#FEFEFE` + SNS 팔레트 `pal-sns-instagram-dct4vqjmytn-5`(산호 `#F2916D`·자두 `#AE7EAC`·남색 `#1A305D`) · Shrikhand + 배민 을지로체. 칸 순서는 모래 → 산호 → 하늘 → 자두(무지개 순서 아님, 가장 진한 칸은 산호 하나).
- 가게·상품 사진 자리는 모두 직접 그린 목판 그림이다(사진 확인 불가 — `app/qa/recipes/heroes/credits.ts`).
- 색 논리 K8·모션 M2·기법 `grain`·`clip-reveal`은 선택 보드 판정(Task 9) 그대로다.
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- color-c09 : 바탕 1 + 잉크 1~2색의 인쇄 도수 팔레트(표본 5개). 글자·버튼 층(종이 1 + 갈색 먹 + 숲초록 잉크)이 이 구조를 지키고, 판 색 네 도수는 칸 묶음에만 찍는다(선택 보드 판정 B).
- layout-l18 : 글자 묶음 위아래를 좌우 대칭 장식(괘선)으로 감싸는 락업. 헤더 마스트헤드에 쓴다.
- type-t09 : 글자를 원·아치 경로로 배치하는 브랜딩 락업. 로고 한 곳에만.
- layout-i05 : 평면 도형에 1~2px 입자로 음영을 넣는다(그라디언트 대신).
- color-local-accent-restrained : local 표본 13곳의 유채색 중앙값 1(범위 0~2). 강조 도수를 하나로 둔 근거다.
- pal-sns-instagram-ddujmhojbb4-2 : 옅은 초록 바탕 · 갈색 글자 · 숲초록 주색 · 옅은 초록 muted · 짙은 초록 테두리의 역할 구조.
