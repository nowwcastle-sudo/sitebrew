<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 아틀리에 지면 (`r15-atelier`) — 레시피 안내

원천: `registry/factory/recipes/r15-atelier/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r15-atelier#v0.1.2        # 디자인 시스템 전체(registry:base)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r15-atelier-theme#v0.1.2  # 색만(registry:theme)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r15-atelier-alt#v0.1.2    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r15-atelier-<부품>`(예: `r15-atelier-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r15-atelier/r15-atelier.css` 를 붙인다.

## 한눈에

- 분위기: 절제된 고급 · 지면 · 여백
- 첫 화면 히어로: ken-burns-stills(첫 화면 전체 사진 무대 + 켄 번스 사진 몽타주 + 이름표 띠)
- 맞는 원형: brand · commerce
- 원형별 쓰임 조건(archetypeConditions — `ai/tasks/<원형>.json` 후보의 condition): brand — 사진·글의 결을 파는 브랜드(공방·갤러리·고급 식품·식음)일 때. 기업 홍보 누리집에는 r6-civic 이나 r4-evidence · commerce — 단가가 높고 이야기가 팔리는 상품(공예·고급 식품·식음·패션)일 때. 가격 비교가 중심인 몰에는 r9-clay
- 스타일 축: 반경 R1 · 버튼 B2 · 입력 I4 · 표면 C4 · 표 T3 · 머리 H1 · 그림자 S1 · 질감 X1
- 모션 M3 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Libre Caslon Text(`font-libre-caslon-text`, 굵기 400 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 제목 전용 굵기 400, 자간 0.01em, 행간 1.15. 이탤릭은 한 줄 부제에만) · 한글 제목 Hahmlet(`font-hahmlet`, 굵기 400 — `--wf-heading-weight`·`.font-heading` 기본값) · 본문 Noto Sans KR(`font-noto-sans-kr`, 조정: UI·본문 16px/1.7 굵기 400) · 고정폭 —
- 레퍼런스: refs-v2:colorLogic=K5:archetype=brand · refs-v2:colorLogic=K5:archetype=commerce · docs/inputs/style_axes.md#K5
- 색 논리 K5(에디토리얼 럭셔리) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `clip-reveal`(clip-path 리빌) · `magnetic-cta`(자석 버튼(주 CTA 하나)) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K5 그대로) — 색 논리 K5 는 그대로, 에스프레소 갈색·세이지를 청록 먹·은회색 쪽 팔레트로 옮긴 변형(어두운 면은 깊은 청록). 서체·모션·기법은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic)

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9760 0.0040 200.00)` | `oklch(0.1700 0.0140 200.00)` |
| `--foreground` | `oklch(0.2000 0.0200 200.00)` | `oklch(0.9500 0.0060 200.00)` |
| `--card` | `oklch(0.9960 0.0020 200.00)` | `oklch(0.2100 0.0160 200.00)` |
| `--card-foreground` | `oklch(0.2000 0.0200 200.00)` | `oklch(0.9500 0.0060 200.00)` |
| `--popover` | `oklch(0.9960 0.0020 200.00)` | `oklch(0.2100 0.0160 200.00)` |
| `--popover-foreground` | `oklch(0.2000 0.0200 200.00)` | `oklch(0.9500 0.0060 200.00)` |
| `--primary` | `oklch(0.3400 0.0600 172.00)` | `oklch(0.8200 0.0500 195.00)` |
| `--primary-foreground` | `oklch(0.9800 0.0050 172.00)` | `oklch(0.1700 0.0200 200.00)` |
| `--secondary` | `oklch(0.9450 0.0060 200.00)` | `oklch(0.2500 0.0160 200.00)` |
| `--secondary-foreground` | `oklch(0.2000 0.0200 200.00)` | `oklch(0.9500 0.0060 200.00)` |
| `--muted` | `oklch(0.9500 0.0060 200.00)` | `oklch(0.2500 0.0160 200.00)` |
| `--accent` | `oklch(0.8800 0.0350 215.00)` | `oklch(0.3000 0.0300 200.00)` |
| `--accent-foreground` | `oklch(0.2200 0.0400 215.00)` | `oklch(0.9500 0.0060 200.00)` |
| `--border` | `oklch(0.8700 0.0080 200.00)` | `oklch(0.3300 0.0200 200.00)` |
| `--ring` | `oklch(0.3400 0.0600 172.00)` | `oklch(0.8200 0.0500 195.00)` |
| `--muted-foreground` | `oklch(0.3900 0.0200 200.00)` | `oklch(0.7600 0.0150 200.00)` |
| `--input` | `oklch(0.5000 0.0200 200.00)` | `oklch(0.5000 0.0250 200.00)` |

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

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9750 0.0040 85.00)` | `oklch(0.1700 0.0120 50.00)` |
| `--foreground` | `oklch(0.1900 0.0150 55.00)` | `oklch(0.9500 0.0080 85.00)` |
| `--card` | `oklch(0.9950 0.0030 85.00)` | `oklch(0.2100 0.0140 50.00)` |
| `--card-foreground` | `oklch(0.1900 0.0150 55.00)` | `oklch(0.9500 0.0080 85.00)` |
| `--popover` | `oklch(0.9950 0.0030 85.00)` | `oklch(0.2100 0.0140 50.00)` |
| `--popover-foreground` | `oklch(0.1900 0.0150 55.00)` | `oklch(0.9500 0.0080 85.00)` |
| `--primary` | `oklch(0.3300 0.0450 50.00)` | `oklch(0.8000 0.0700 135.00)` |
| `--primary-foreground` | `oklch(0.9800 0.0060 85.00)` | `oklch(0.1700 0.0200 140.00)` |
| `--secondary` | `oklch(0.9450 0.0060 85.00)` | `oklch(0.2500 0.0150 50.00)` |
| `--secondary-foreground` | `oklch(0.1900 0.0150 55.00)` | `oklch(0.9500 0.0080 85.00)` |
| `--muted` | `oklch(0.9500 0.0060 85.00)` | `oklch(0.2500 0.0150 50.00)` |
| `--muted-foreground` | `oklch(0.3900 0.0150 60.00)` | `oklch(0.7600 0.0150 75.00)` |
| `--accent` | `oklch(0.8800 0.0450 135.00)` | `oklch(0.3000 0.0300 50.00)` |
| `--accent-foreground` | `oklch(0.2500 0.0400 140.00)` | `oklch(0.9500 0.0080 85.00)` |
| `--destructive` | `oklch(0.5200 0.1800 27.00)` | `oklch(0.7000 0.1500 25.00)` |
| `--border` | `oklch(0.8700 0.0080 85.00)` | `oklch(0.3300 0.0200 50.00)` |
| `--input` | `oklch(0.5000 0.0200 70.00)` | `oklch(0.5050 0.0250 50.00)` |
| `--ring` | `oklch(0.3300 0.0450 50.00)` | `oklch(0.8000 0.0700 135.00)` |
| `--success` | `oklch(0.5200 0.1100 152.00)` | `oklch(0.7400 0.1100 152.00)` |
| `--success-foreground` | `oklch(0.9850 0.0050 152.00)` | `oklch(0.1900 0.0200 152.00)` |
| `--warning` | `oklch(0.5500 0.1200 68.00)` | `oklch(0.8000 0.1200 78.00)` |
| `--warning-foreground` | `oklch(0.9850 0.0050 68.00)` | `oklch(0.2000 0.0300 78.00)` |
| `--info` | `oklch(0.5000 0.1200 255.00)` | `oklch(0.7400 0.1000 255.00)` |
| `--info-foreground` | `oklch(0.9850 0.0040 255.00)` | `oklch(0.1900 0.0150 255.00)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-libre-caslon-text-wf, "Libre Caslon Text", "Hahmlet", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-hahmlet-wf, "Hahmlet", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-hahmlet-wf, "Hahmlet", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-noto-sans-kr-wf, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Hahmlet → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

## 원천 본문

## 분위기

손으로 편집한 잡지 지면 같은 화면이다. 바탕은 거의 흰 따뜻한 오프화이트, 글자는 따뜻한 먹, 주색은 에스프레소 갈색이고 강조 면은 옅은 세이지다. 다크는 짙은 갈색빛 검정 위에 세이지가 주색이 된다. 제목은 가는 세리프이고, 한 줄 부제만 이탤릭이다. 여백이 넓고 사진이 화면의 절반 이상을 차지하며, 면 위에 옅은 그레인이 깔린다.

## 쓰는 법

- 맞는 원형은 사진과 글의 결을 파는 브랜드와 단가가 높은 상품 쪽이다.
- 색 논리 K5(에디토리얼 럭셔리): 따뜻한 지면 + 깊은 단색 주색 하나 + 재료에서 온 보조색 하나(세이지). 테라코타·붉은 갈색을 더하지 않는다.
- 첫 화면은 히어로 `ken-burns-stills`이다: 첫 화면 전체를 사진 무대로 쓰고 사진 3~5장이 천천히 확대되며 이어지며, 교차할 때 이름표 띠가 지나간다.
- 모션은 M3이다. 스크롤에 맞춰 사진이 clip-reveal로 열리고, 주 CTA 하나에만 자석(magnetic-cta)을 건다.
- 입력은 이중 테두리(I4), 표는 여유 있는 T3, 질감은 X1(그레인)이다. 카드 이중 베젤(C4)은 1순위 카드·히어로 목업에만 쓰고 모든 카드에 두르지 않는다(compat 주의).

## 하지 말 것

- 크림·베이지 바탕을 쓰지 않는다. 오프화이트는 채도 0.012 이하다.
- 금속 색(금·황동)을 그라디언트로 칠하지 않는다. 보조색은 평면 한 색이다.
- 제목을 여러 서체로 섞지 않는다. 라틴 한 서체와 한글 한 서체뿐이다.
- 자석 효과를 둘 이상의 버튼에 걸지 않는다.
- 그레인 위 글자는 7:1 아래로 내리지 않는다.

## 레퍼런스에서 가져온 기법

- K5·local 카드 : 사진 한 장과 얇은 띠만으로 구성하고 내비는 다섯 항목 안쪽으로 줄인다.
- K5·brand 카드 : 압축 대문자 제목과 이탤릭 세리프 한 줄을 짝지어 고급 어조를 만든다.
- K5·brand 카드 : 전폭 사진 위에 어두운 막을 한 겹 깔아 흰 글자를 읽히게 한다.
- K5·commerce 카드 : 한 줄을 세 칸으로 나눠 시선을 가로로 흘린다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K5(에디토리얼 럭셔리)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 대표 장면에서는 사진 자산이 있어야 그리는 `hero-photo` 를 뺐다(대표 장면 카탈로그는 사진 없는 장면만 받는다 — 사진은 첫 화면 히어로가 보인다). 첫 화면 히어로는 `vertical-title-slides` 에서 `ken-burns-stills` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 사진의 결을 파는 브랜드·커머스 얼굴이라 사진 몇 장이 천천히 이어지는 무대가 맞고, 블록 메타 archetypes(brand·commerce·local·public·portfolio·detail)가 이 레시피 원형(brand·commerce)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`ken-burns-stills`)도 운영자가 「좋다」로 골랐다.
