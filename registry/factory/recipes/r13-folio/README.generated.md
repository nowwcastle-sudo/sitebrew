<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 무채 문서첩 (`r13-folio`) — 레시피 안내

원천: `registry/factory/recipes/r13-folio/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r13-folio#v0.2.5        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r13-folio-theme#v0.2.5  # 색만(registry:theme)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r13-folio-alt#v0.2.5    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r13-folio-<부품>`(예: `r13-folio-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r13-folio/r13-folio.css` 를 붙인다.

## 한눈에

- 분위기: 문서 · 절제 · 정돈
- 첫 화면 히어로: illustration-scene(전폭 큰 제목 + 전폭 그림 한 장 + 그림 밖 바탕색 카드)
- 맞는 원형: portfolio · public
- 원형별 쓰임 조건(archetypeConditions — `ai/tasks/<원형>.json` 후보의 condition): portfolio — 작품보다 글·기록이 앞서는 포트폴리오(사례 연구·연혁)일 때. 작품 사진이 주인공이면 r4-evidence 나 r7-docs · public — 공고·보고서·회의록처럼 문서 본문이 중심인 쪽에서 쓴다
- 스타일 축: 반경 R1 · 버튼 B3 · 입력 I2 · 표면 C1 · 표 T3 · 머리 H5 · 그림자 S0
- 모션 M0 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 IBM Plex Sans(`font-ibm-plex-sans`, 굵기 600 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 제목 전용 굵기 600, 자간 -0.005em, 행간 1.2. 문서 안 소제목은 500) · 한글 제목 Nanum Myeongjo(`font-nanum-myeongjo`) · 본문 IBM Plex Sans KR(`font-ibm-plex-sans-kr`, 조정: 본문 17px/1.75 굵기 400, 한 줄 40자 안쪽) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: 코드·표 숫자 칸에만, 굵기 400)
- 레퍼런스: refs-v2:colorLogic=K3:archetype=portfolio · refs-v2:colorLogic=K3:archetype=landing · docs/inputs/style_axes.md#K3
- 색 논리 K3(문서형 무채색) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `oversize-crop`(오버사이즈 타입 크롭) · `grain`(그레인(feTurbulence)) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K3 그대로) — 색 논리 K3 는 그대로, 순수 회색을 종이 한 톤(색상각 95°·채도 0.006 이하)과 따뜻한 먹으로 옮긴 변형. 서체·모션 M0·기법은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic)

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9840 0.0060 95.00)` | `oklch(0.1750 0.0060 80.00)` |
| `--foreground` | `oklch(0.2000 0.0080 70.00)` | `oklch(0.9400 0.0060 90.00)` |
| `--card` | `oklch(0.9980 0.0030 95.00)` | `oklch(0.2150 0.0070 80.00)` |
| `--card-foreground` | `oklch(0.2000 0.0080 70.00)` | `oklch(0.9400 0.0060 90.00)` |
| `--popover` | `oklch(0.9980 0.0030 95.00)` | `oklch(0.2150 0.0070 80.00)` |
| `--popover-foreground` | `oklch(0.2000 0.0080 70.00)` | `oklch(0.9400 0.0060 90.00)` |
| `--primary` | `oklch(0.3000 0.0120 60.00)` | `oklch(0.9000 0.0080 90.00)` |
| `--primary-foreground` | `oklch(0.9900 0.0040 95.00)` | `oklch(0.1750 0.0060 80.00)` |
| `--secondary` | `oklch(0.9500 0.0060 95.00)` | `oklch(0.2450 0.0070 80.00)` |
| `--secondary-foreground` | `oklch(0.2000 0.0080 70.00)` | `oklch(0.9400 0.0060 90.00)` |
| `--muted` | `oklch(0.9550 0.0060 95.00)` | `oklch(0.2450 0.0070 80.00)` |
| `--accent` | `oklch(0.9300 0.0080 95.00)` | `oklch(0.2850 0.0080 80.00)` |
| `--accent-foreground` | `oklch(0.2000 0.0080 70.00)` | `oklch(0.9400 0.0060 90.00)` |
| `--ring` | `oklch(0.3000 0.0120 60.00)` | `oklch(0.8200 0.0080 90.00)` |
| `--muted-foreground` | `oklch(0.4400 0.0120 70.00)` | `oklch(0.7150 0.0100 90.00)` |
| `--input` | `oklch(0.5000 0.0120 80.00)` | `oklch(0.5050 0.0100 80.00)` |
| `--border` | `oklch(0.5000 0.0100 90.00)` | `oklch(0.5150 0.0080 80.00)` |

## 모션 토큰

모션 M0 의 값이 `:root`(순수 CSS·registry cssVars.light)에 실린다 — `motion-core` 의 기본값(M2)을 덮고, 프리셋(`.wf-fade-rise` 등)이 `var(--duration-enter, …)` 로 읽는다. M0 은 등장 연출이 없다(`--duration-enter: 0ms`).

- `--ease-standard`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `--ease-emphasized`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `--ease-in-screen`: `cubic-bezier(0.45, 0, 0.55, 1)`
- `--ease-exit`: `cubic-bezier(0.4, 0, 1, 1)`
- `--ease-sheet`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- `--duration-press`: `80ms`
- `--duration-hover`: `120ms`
- `--duration-popover`: `125ms`
- `--duration-enter`: `0ms`
- `--duration-sheet`: `200ms`

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9900 0.0000 0.00)` | `oklch(0.1700 0.0000 0.00)` |
| `--foreground` | `oklch(0.2000 0.0000 0.00)` | `oklch(0.9400 0.0000 0.00)` |
| `--card` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2100 0.0000 0.00)` |
| `--card-foreground` | `oklch(0.2000 0.0000 0.00)` | `oklch(0.9400 0.0000 0.00)` |
| `--popover` | `oklch(1.0000 0.0000 0.00)` | `oklch(0.2100 0.0000 0.00)` |
| `--popover-foreground` | `oklch(0.2000 0.0000 0.00)` | `oklch(0.9400 0.0000 0.00)` |
| `--primary` | `oklch(0.3000 0.0000 0.00)` | `oklch(0.9200 0.0000 0.00)` |
| `--primary-foreground` | `oklch(0.9900 0.0000 0.00)` | `oklch(0.1700 0.0000 0.00)` |
| `--secondary` | `oklch(0.9600 0.0000 0.00)` | `oklch(0.2400 0.0000 0.00)` |
| `--secondary-foreground` | `oklch(0.2000 0.0000 0.00)` | `oklch(0.9400 0.0000 0.00)` |
| `--muted` | `oklch(0.9600 0.0000 0.00)` | `oklch(0.2400 0.0000 0.00)` |
| `--muted-foreground` | `oklch(0.4400 0.0000 0.00)` | `oklch(0.7100 0.0000 0.00)` |
| `--accent` | `oklch(0.9400 0.0000 0.00)` | `oklch(0.2800 0.0000 0.00)` |
| `--accent-foreground` | `oklch(0.2000 0.0000 0.00)` | `oklch(0.9400 0.0000 0.00)` |
| `--destructive` | `oklch(0.5000 0.1600 27.00)` | `oklch(0.7000 0.1500 25.00)` |
| `--border` | `oklch(0.5000 0.0000 0.00)` | `oklch(0.5100 0.0000 0.00)` |
| `--input` | `oklch(0.5000 0.0000 0.00)` | `oklch(0.5050 0.0000 0.00)` |
| `--ring` | `oklch(0.3000 0.0000 0.00)` | `oklch(0.8200 0.0000 0.00)` |
| `--success` | `oklch(0.5000 0.0800 152.00)` | `oklch(0.7400 0.1100 152.00)` |
| `--success-foreground` | `oklch(0.9850 0.0050 152.00)` | `oklch(0.1900 0.0200 152.00)` |
| `--warning` | `oklch(0.5200 0.0900 68.00)` | `oklch(0.8000 0.1200 78.00)` |
| `--warning-foreground` | `oklch(0.9850 0.0050 68.00)` | `oklch(0.2000 0.0300 78.00)` |
| `--info` | `oklch(0.4800 0.0700 255.00)` | `oklch(0.7400 0.1000 255.00)` |
| `--info-foreground` | `oklch(0.9850 0.0040 255.00)` | `oklch(0.1900 0.0150 255.00)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-ibm-plex-sans-wf, "IBM Plex Sans", "Nanum Myeongjo", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-nanum-myeongjo-wf, "Nanum Myeongjo", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-nanum-myeongjo-wf, "Nanum Myeongjo", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Nanum Myeongjo → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

## 원천 본문

## 분위기

종이 문서 한 권을 넘기는 화면이다. 색은 순수 회색 단계뿐이고, 강조는 굵기·밑줄·크기로 한다. 첫 화면 제목은 문장 속에 칩이 끼어 있는 큰 글자이고, 본문은 한 줄 40자 안쪽의 좁은 열이다. 연한 질감(그레인)과 잘리는 큰 글자가 유일한 장식이다.

## 쓰는 법

- 맞는 원형은 글·기록이 앞서는 포트폴리오와 공고·보고서가 중심인 공공 쪽이다.
- 색 논리 K3(문서형 무채색): 얼굴색(`primary`·`secondary`·`accent`·`ring`)이 모두 무채색이다. 링크는 색이 아니라 밑줄과 굵기로 알린다. 상태색만 채도를 가진다.
- 첫 화면은 히어로 `illustration-scene`이다: 전폭 큰 제목 아래 전폭 그림 한 장이 첫 화면을 채우고, 문단·버튼은 그림 위가 아니라 바탕색 카드에 든다. 제목은 영문 IBM Plex Sans 600, 한글은 나눔명조로 읽힌다.
- 모션은 M0이다. 등장 연출이 없고 정지 기법(oversize-crop·grain)만 쓴다. 큰 글자는 칸 밖으로 잘려 나가게 둔다.
- 표는 T3, 헤더는 마스트헤드(H5)다: 큰 제호가 스크롤로 올라가고 얇은 레일만 남는다. H5 는 선 구획 값이라 선(border)이 배경 대비 3:1 이다 — 회색 선도 흐리게 두지 않는다.

## 하지 말 것

- 링크·버튼 강조에 유채색을 더하지 않는다. 색이 필요하면 이 레시피가 아니다.
- 무채색에 쿨/웜 한 톤을 몰래 섞어 「거의 무채색」으로 만들지 않는다 — 톤이 필요하면 B안을 쓴다.
- 그레인 위에 7:1 미만 글자를 얹지 않는다.
- 카드 그림자·블러로 깊이를 만들지 않는다(S0). 구분은 선과 여백이다.
- 넓은 면에 원색 바탕을 깔지 않는다. 색은 의미 태그의 옅은 짝에만 있다.

## 레퍼런스에서 가져온 기법

- K3·portfolio 카드 : 번호 붙은 쪽 썸네일을 가로로 늘어놓아 사이트 흐름을 작업물로 보인다.
- K3·portfolio 카드 : 세리프 제목과 모노스페이스 부제를 짝지어 절제된 장인 인상을 만든다.
- K3·landing 카드 : 한 페이지에 행동 하나만 두는 구성.
- K3·saas 카드 : 큰 선언문 두 줄과 어두운 패널 하나만으로 제품이 대체하는 것을 말한다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K3(문서형 무채색)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `inline-chip-title` 에서 `illustration-scene` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 무채 문서첩은 글이 앞서고 그림은 한 장으로 차분히 받치는 쪽이라, 그림 위에 글을 얹지 않는 이 구성이 맞고 블록 메타 archetypes(public·portfolio·landing·saas·pwa)가 이 레시피 원형(portfolio·public)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`illustration-scene`)도 운영자가 「좋다」로 골랐다.
