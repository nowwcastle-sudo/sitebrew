<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 콘크리트 두 모드 (`r14-concrete`) — 레시피 안내

원천: `registry/factory/recipes/r14-concrete/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r14-concrete#v0.1.2        # 디자인 시스템 전체(registry:base)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r14-concrete-theme#v0.1.2  # 색만(registry:theme)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r14-concrete-alt#v0.1.2    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r14-concrete-<부품>`(예: `r14-concrete-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r14-concrete/r14-concrete.css` 를 붙인다.

## 한눈에

- 분위기: 거침 · 직설 · 대비
- 첫 화면 히어로: punch-in-statement(바탕색 위 초대형 한 문장 + 착지하는 주색 키워드 + 확대 컷 틀)
- 맞는 원형: landing · saas
- 원형별 쓰임 조건(archetypeConditions — `ai/tasks/<원형>.json` 후보의 condition): saas — 개발자·제작자 도구처럼 거친 직설 어조가 제품 성격과 맞을 때. 일반 사무용 SaaS 에는 r4-evidence 나 r1-measure
- 스타일 축: 반경 R0 · 버튼 B1 · 입력 I3 · 표면 C2 · 표 T3 · 머리 H3 · 그림자 S2 · 디스플레이 D2 · 질감 X2
- 모션 M2 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Archivo(`font-archivo`, 굵기 800 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 제목 전용 굵기 800, 대문자 우선, 자간 -0.02em, 행간 0.95) · 한글 제목 Black Han Sans(`font-black-han-sans`) · 본문 Gothic A1(`font-gothic-a1`, 조정: 본문 16px/1.55 굵기 500, 숫자 tabular-nums) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: 코드·수치 라벨에만, 굵기 600)
- 레퍼런스: refs-v2:colorLogic=K4:archetype=saas · refs-v2:colorLogic=K4:archetype=pwa · docs/inputs/style_axes.md#K4
- 색 논리 K4(브루탈 두 모드) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `split-text`(글자 분할 등장) · `blend`(블렌드 모드) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K4 그대로) · 서체 Sirin Stencil · Gasoek One — 색 논리 K4 는 그대로, 강조 빨강 하나를 파랑 268°로 바꾼 변형(여전히 강조 하나). 제목체는 스텐실 라틴(Sirin Stencil)과 굵은 한글(Gasoek One)로 바꾼다. 모션·기법은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts) · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--primary` | `oklch(0.4650 0.2000 268.00)` | `oklch(0.7200 0.1500 268.00)` |
| `--primary-foreground` | `oklch(0.9900 0.0030 268.00)` | `oklch(0.1400 0.0200 268.00)` |
| `--ring` | `oklch(0.4650 0.2000 268.00)` | `oklch(0.7200 0.1500 268.00)` |

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

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9620 0.0040 95.00)` | `oklch(0.1700 0.0000 0.00)` |
| `--foreground` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.9300 0.0000 0.00)` |
| `--card` | `oklch(0.9880 0.0020 95.00)` | `oklch(0.2100 0.0000 0.00)` |
| `--card-foreground` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.9300 0.0000 0.00)` |
| `--popover` | `oklch(0.9880 0.0020 95.00)` | `oklch(0.2100 0.0000 0.00)` |
| `--popover-foreground` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.9300 0.0000 0.00)` |
| `--primary` | `oklch(0.4650 0.2100 28.00)` | `oklch(0.6600 0.2000 28.00)` |
| `--primary-foreground` | `oklch(0.9900 0.0030 28.00)` | `oklch(0.1400 0.0200 28.00)` |
| `--secondary` | `oklch(0.9200 0.0030 95.00)` | `oklch(0.2500 0.0000 0.00)` |
| `--secondary-foreground` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.9300 0.0000 0.00)` |
| `--muted` | `oklch(0.9300 0.0030 95.00)` | `oklch(0.2500 0.0000 0.00)` |
| `--muted-foreground` | `oklch(0.3600 0.0000 95.00)` | `oklch(0.7850 0.0000 0.00)` |
| `--accent` | `oklch(0.9000 0.0000 0.00)` | `oklch(0.3000 0.0000 0.00)` |
| `--accent-foreground` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.9300 0.0000 0.00)` |
| `--destructive` | `oklch(0.5200 0.1800 27.00)` | `oklch(0.7000 0.1500 25.00)` |
| `--border` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.5100 0.0000 0.00)` |
| `--input` | `oklch(0.1400 0.0000 0.00)` | `oklch(0.5100 0.0000 0.00)` |
| `--ring` | `oklch(0.4650 0.2100 28.00)` | `oklch(0.6600 0.2000 28.00)` |
| `--success` | `oklch(0.5200 0.1100 152.00)` | `oklch(0.7400 0.1100 152.00)` |
| `--success-foreground` | `oklch(0.9850 0.0050 152.00)` | `oklch(0.1900 0.0200 152.00)` |
| `--warning` | `oklch(0.5500 0.1200 68.00)` | `oklch(0.8000 0.1200 78.00)` |
| `--warning-foreground` | `oklch(0.9850 0.0050 68.00)` | `oklch(0.2000 0.0300 78.00)` |
| `--info` | `oklch(0.5000 0.1200 255.00)` | `oklch(0.7400 0.1000 255.00)` |
| `--info-foreground` | `oklch(0.9850 0.0040 255.00)` | `oklch(0.1900 0.0150 255.00)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-archivo-wf, "Archivo", "Black Han Sans", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-black-han-sans-wf, "Black Han Sans", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-black-han-sans-wf, "Black Han Sans", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-gothic-a1-wf, "Gothic A1", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Black Han Sans → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

한글 제목체 Black Han Sans는 굵기가 하나뿐이다. 레시피 CSS가 `.font-heading`의 굵기 합성을 끈다(`font-synthesis-weight: none`) — 굵은 제목에서도 한글 획을 가짜 굵기로 뭉개지 않는다. 부품 제목 칸(`[data-slot$="-title"].font-heading`)은 한글 제목체를 건너뛴 제목 스택(라틴 Archivo → 본문 → 시스템 한글)으로 그린다 — 16~18px 제목의 한글은 본문 서체가 제 굵기로 그린다.

## 원천 본문

## 분위기

인쇄물과 계기판 사이의 화면이다. 라이트는 스위스 인쇄물처럼 거의 흰 종이 위에 거의 검정 잉크, 다크는 텔레메트리 화면처럼 짙은 회색 위에 옅은 회색 글자다. 두 모드 모두 강조는 빨강 하나뿐이고, 두꺼운 선·딱딱한 그림자·제목 크기의 큰 글자·인쇄 망점 질감이 얼굴이다.

## 쓰는 법

- 맞는 원형은 제작자·개발자 도구처럼 직설 어조가 어울리는 SaaS 소개 쪽과 한 쪽 랜딩이다. 이 레시피는 대담안 후보다.
- 색 논리 K4(브루탈 두 모드): 라이트(인쇄)와 다크(텔레메트리) 중 한 모드로 쓴다. 두 모드가 같은 위계를 가지고, 강조 빨강은 모드마다 명도만 바꿔 하나만 둔다. 선(border)·입력 테두리는 라이트에서 잉크, 다크에서 옅은 회색이고 두께는 2px 이상이다.
- 첫 화면은 히어로 `punch-in-statement`이다: 바탕색 위에 아주 큰 한 문장 제목(D2 초대형)을 놓고 마지막 낱말만 주색 면 위 키워드로 착지시킨다. 제목과 안내 글은 사진 위가 아니라 바탕 위에 있어 대비가 바탕 대 글자 색으로 정해진다.
- 카드는 C2(선 격자 칸), 그림자는 S2(딱딱한 오프셋), 반경은 0이다. 면 위 질감은 X2(인쇄 망점)다.
- 모션은 M2이다. 제목은 글자 분할(split-text)로 튀어나오고, 블렌드 모드(blend)는 정지 장식에만 쓴다.

## 하지 말 것

- 강조 색을 둘 이상 쓰지 않는다. 빨강 하나가 버튼·링크·현재 위치를 모두 맡는다.
- 밝은 바탕과 어두운 바탕을 한 화면에 섞지 않는다. 모드는 화면 전체가 하나다.
- 선을 1px로 줄이지 않는다. 브루탈은 선의 굵기가 얼굴이다.
- 그림자에 번짐(blur)을 넣지 않는다. 오프셋은 선명한 사각이다.
- 어두운 바탕에서 형광 초록·주홍을 면이나 글로우로 쓰지 않는다(§13 「거의 검정 + 형광 한 점」).

## 레퍼런스에서 가져온 기법

- K4·saas 카드 : 주 버튼은 색 채움, 보조 버튼은 회색 채움으로 위계를 색만으로 구분한다.
- K4·pwa 카드 : 결과물 카드 한 장을 한가운데 두고 설정은 아래 막대로 내린다.
- K4·saas 카드 : 어두운 면에서 한 색만 움직여 데이터가 흐르는 느낌을 준다.
- K4·dashboard 카드 : 굵은 단색 선과 큰 제목으로 직설 어조를 만든다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K4(브루탈 두 모드)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `grid-lines-baseline-word` 에서 `punch-in-statement` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 거칠고 직설인 얼굴이 한 문장을 크게 때려 박는 구성과 맞고, 글자를 사진 위가 아닌 바탕색 위에 두어 보드 A2 에서 읽기 어렵다던 사진 위 글자 대비 문제가 없다. 블록 메타 archetypes(saas·brand·commerce·landing·detail)가 이 레시피 원형(landing·saas)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`punch-in-statement`)도 운영자가 「좋다」로 골랐다.
- 대비 고침: 새 히어로의 주 버튼 글자(주색 위 흰 글자)가 히어로 글자 대비 관문의 본문 7:1 에 A 6.38 · B 6.74 로 못 미쳤다. 라이트 주색(과 같은 값인 ring)의 명도만 A 0.50 → 0.465 · B 0.48 → 0.465 로 낮춰 7.07 · 7.20 이 되게 했다(색상각·채도는 그대로). 다크 주색(5.85)은 관문이 재는 기본 테마가 아니라 그대로다.
