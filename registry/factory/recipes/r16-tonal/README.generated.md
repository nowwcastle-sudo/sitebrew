<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 단색 음영 (`r16-tonal`) — 레시피 안내

원천: `registry/factory/recipes/r16-tonal/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r16-tonal#v0.1.1        # 디자인 시스템 전체(registry:base)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r16-tonal-theme#v0.1.1  # 색만(registry:theme)
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/r16-tonal-alt#v0.1.1    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r16-tonal-<부품>`(예: `r16-tonal-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r16-tonal/r16-tonal.css` 를 붙인다.

## 한눈에

- 분위기: 단색 · 음영 · 정제
- 첫 화면 히어로: video-montage(첫 화면 전체 하드 컷 영상 몽타주 + 그 위 막 + 큰 제목)
- 맞는 원형: landing · brand
- 원형별 쓰임 조건(archetypeConditions — `ai/tasks/<원형>.json` 후보의 condition): brand — 제품 하나를 크게 보이는 브랜드 소개 쪽에서 쓴다. 여러 색이 이야기를 하는 브랜드에는 r8-dusk 나 r9-clay
- 스타일 축: 반경 R2 · 버튼 B4 · 입력 I1 · 표면 C3 · 표 T2 · 머리 H2 · 그림자 S1
- 모션 M2 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Jost(`font-jost`, 굵기 500 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 제목 전용 굵기 500, 자간 -0.015em, 행간 1.08. 숫자는 라이닝) · 본문 Pretendard(`font-pretendard`, 조정: 본문 16px/1.65 굵기 400) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: 앱 창 안 코드·단축키에만, 굵기 400)
- 레퍼런스: refs-v2:colorLogic=K9:archetype=landing · refs-v2:colorLogic=K9:archetype=brand · docs/inputs/style_axes.md#K9
- 색 논리 K9(단색 램프) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `mesh-gradient`(코닉·메시 그라디언트) · `split-text`(글자 분할 등장) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K9 그대로) · 서체 Noto Serif KR — 색 논리 K9 는 그대로, 남청 262° 한 색상각을 청록 165° 한 색상각으로 옮긴 변형(여전히 한 색상각의 명도 단계만). 제목체는 노토 세리프로 바꾼다. 모션·기법은 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts) · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9750 0.0120 165.00)` | `oklch(0.1700 0.0350 165.00)` |
| `--foreground` | `oklch(0.2000 0.0500 165.00)` | `oklch(0.9500 0.0150 165.00)` |
| `--card` | `oklch(0.9950 0.0050 165.00)` | `oklch(0.2100 0.0400 165.00)` |
| `--card-foreground` | `oklch(0.2000 0.0500 165.00)` | `oklch(0.9500 0.0150 165.00)` |
| `--popover` | `oklch(0.9950 0.0050 165.00)` | `oklch(0.2100 0.0400 165.00)` |
| `--popover-foreground` | `oklch(0.2000 0.0500 165.00)` | `oklch(0.9500 0.0150 165.00)` |
| `--primary` | `oklch(0.4000 0.1000 165.00)` | `oklch(0.7800 0.1000 165.00)` |
| `--primary-foreground` | `oklch(0.9800 0.0100 165.00)` | `oklch(0.1700 0.0400 165.00)` |
| `--secondary` | `oklch(0.9300 0.0300 165.00)` | `oklch(0.2600 0.0450 165.00)` |
| `--secondary-foreground` | `oklch(0.2000 0.0500 165.00)` | `oklch(0.9500 0.0150 165.00)` |
| `--muted` | `oklch(0.9500 0.0200 165.00)` | `oklch(0.2500 0.0400 165.00)` |
| `--accent` | `oklch(0.8800 0.0700 165.00)` | `oklch(0.3400 0.0800 165.00)` |
| `--accent-foreground` | `oklch(0.2200 0.0600 165.00)` | `oklch(0.9500 0.0150 165.00)` |
| `--border` | `oklch(0.8600 0.0300 165.00)` | `oklch(0.3300 0.0500 165.00)` |
| `--ring` | `oklch(0.4000 0.1000 165.00)` | `oklch(0.7800 0.1000 165.00)` |
| `--muted-foreground` | `oklch(0.4250 0.0500 165.00)` | `oklch(0.7100 0.0450 165.00)` |
| `--input` | `oklch(0.5000 0.0700 165.00)` | `oklch(0.5000 0.0600 165.00)` |

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
| `--background` | `oklch(0.9750 0.0120 262.00)` | `oklch(0.1700 0.0350 262.00)` |
| `--foreground` | `oklch(0.2000 0.0500 262.00)` | `oklch(0.9500 0.0150 262.00)` |
| `--card` | `oklch(0.9950 0.0050 262.00)` | `oklch(0.2100 0.0400 262.00)` |
| `--card-foreground` | `oklch(0.2000 0.0500 262.00)` | `oklch(0.9500 0.0150 262.00)` |
| `--popover` | `oklch(0.9950 0.0050 262.00)` | `oklch(0.2100 0.0400 262.00)` |
| `--popover-foreground` | `oklch(0.2000 0.0500 262.00)` | `oklch(0.9500 0.0150 262.00)` |
| `--primary` | `oklch(0.4200 0.1400 262.00)` | `oklch(0.7800 0.1100 262.00)` |
| `--primary-foreground` | `oklch(0.9800 0.0100 262.00)` | `oklch(0.1700 0.0400 262.00)` |
| `--secondary` | `oklch(0.9300 0.0300 262.00)` | `oklch(0.2600 0.0450 262.00)` |
| `--secondary-foreground` | `oklch(0.2000 0.0500 262.00)` | `oklch(0.9500 0.0150 262.00)` |
| `--muted` | `oklch(0.9500 0.0200 262.00)` | `oklch(0.2500 0.0400 262.00)` |
| `--muted-foreground` | `oklch(0.4300 0.0500 262.00)` | `oklch(0.7100 0.0450 262.00)` |
| `--accent` | `oklch(0.8800 0.0700 262.00)` | `oklch(0.3400 0.0800 262.00)` |
| `--accent-foreground` | `oklch(0.2200 0.0600 262.00)` | `oklch(0.9500 0.0150 262.00)` |
| `--destructive` | `oklch(0.5200 0.1800 27.00)` | `oklch(0.7000 0.1500 25.00)` |
| `--border` | `oklch(0.8600 0.0300 262.00)` | `oklch(0.3300 0.0500 262.00)` |
| `--input` | `oklch(0.5000 0.0700 262.00)` | `oklch(0.5050 0.0600 262.00)` |
| `--ring` | `oklch(0.4200 0.1400 262.00)` | `oklch(0.7800 0.1100 262.00)` |
| `--success` | `oklch(0.5200 0.1100 152.00)` | `oklch(0.7400 0.1100 152.00)` |
| `--success-foreground` | `oklch(0.9850 0.0050 152.00)` | `oklch(0.1900 0.0200 152.00)` |
| `--warning` | `oklch(0.5500 0.1200 68.00)` | `oklch(0.8000 0.1200 78.00)` |
| `--warning-foreground` | `oklch(0.9850 0.0050 68.00)` | `oklch(0.2000 0.0300 78.00)` |
| `--info` | `oklch(0.5000 0.1200 255.00)` | `oklch(0.7400 0.1000 255.00)` |
| `--info-foreground` | `oklch(0.9850 0.0040 255.00)` | `oklch(0.1900 0.0150 255.00)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-jost-wf, "Jost", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-pretendard-wf, "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

## 원천 본문

## 분위기

한 가지 푸른빛의 명도 단계만으로 짠 화면이다. 바탕은 아주 옅은 남청, 글자는 짙은 남청, 주색은 그 사이의 중간 단계이고 다른 색상각은 없다(상태색만 예외). 첫 화면은 전체를 덮는 짧은 컷 몽타주 위에 같은 색상각의 짙은 막을 얹고 큰 제목을 놓은 구성이며, 메시 그라디언트는 같은 색상각의 명도 차로만 번진다.

## 쓰는 법

- 맞는 원형은 제품 하나를 크게 보이는 브랜드 소개와 한 쪽 랜딩이다.
- 색 논리 K9(단색 램프): 바탕·글자·면·선·얼굴색의 채도 0.05 이상 색은 모두 한 색상각(262° 근처)이다. 위계는 명도 단계 다섯으로 만든다 — 바탕, 면, 선, 주색, 글자.
- 첫 화면은 히어로 `video-montage`이다: 첫 화면 전체에서 짧은 컷(영상 클립·사진)이 하드 컷으로 이어지고, 그 위 막(같은 색상각의 짙은 명도 단계 하나)에 큰 제목·문단·버튼을 얹는다. 컷의 색은 막으로 눌러 한 색상각 안에 둔다.
- 모션은 M2이다. 제목은 글자 분할(split-text)로, 바탕은 같은 색상각의 메시 그라디언트(mesh-gradient)가 느리게 번진다.
- 버튼은 알약(B4), 반경은 R2, 카드는 C3, 헤더는 떠 있는 섬(H2)이다.

## 하지 말 것

- 강조 때문에 두 번째 색상각을 들이지 않는다. 강조는 명도 차와 크기로 한다.
- 메시 그라디언트에 다른 색상각을 섞지 않는다.
- 상태색(성공·경고·오류)을 장식에 쓰지 않는다. 의미 전용이다.
- 글자·선의 명도 차를 줄여 「은은하게」 만들지 않는다. 본문은 7:1, 선은 3:1을 지킨다.

## 레퍼런스에서 가져온 기법

- K9·landing 카드 : 한 색의 명도 그라디언트를 바탕 전체로 쓰고 흰 글자와 어두운 버튼만 얹는다.
- K9·landing 카드 : 한 줄 헤드라인과 제품 사용 장면 큰 컷으로 첫 화면을 끝낸다.
- K9·landing 카드 : 직립 굵은 문장과 이탤릭 세리프 문장을 한 헤드라인에 짝짓는 두 호흡.
- K9·brand 카드 : 제품 결과물을 전면 격자로 깔아 설명 없이 증거로 보인다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K9(단색 램프)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `narrow-title-wide-window` 에서 `screenshot-window` 로 한 번 바꿨다가(카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문) `video-montage` 로 다시 바꿨다 — `screenshot-window` 는 블록 메타 원형(saas·dashboard·landing)에 brand 가 없고 원형 JSON `landing` 의 hero 허용 목록에서도 빠져(C388 ②) 이 레시피의 원형(landing·brand)으로 찍은 사이트가 대표 첫 화면을 못 쓰는 짝이었다. `video-montage` 는 블록 메타·원형 JSON 모두에서 landing·brand 를 허용하고 어느 레시피도 대표 히어로로 쓰지 않으며, 한 색상각의 막 아래 컷이 이어지는 단색 음영 얼굴이 제품 하나를 크게 보이는 브랜드 소개에 맞다. 컷 위 색 덮개·명도 단계는 블록 코드를 고치지 않고 레시피의 면·기법 선택지 안에서 정한다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`video-montage`)도 운영자가 「좋다」로 골랐다.
