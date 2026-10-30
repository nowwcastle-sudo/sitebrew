<!-- 생성물 — factory/scripts/recipe.mjs 로 다시 만든다. 손으로 고치지 않는다. -->
# 도면 계측 (`r1-measure`) — 레시피 안내

원천: `registry/factory/recipes/r1-measure/DESIGN.md`. Claude Design·에이전트가 읽는 요약이다. 고칠 때는 원천을 고치고 `npm run gen:all`.

## 설치

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r1-measure#v0.2.5        # 디자인 시스템 전체(registry:base)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r1-measure-theme#v0.2.5  # 색만(registry:theme)
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/r1-measure-alt#v0.2.5    # 보드 B안(registry:base — 부품은 같고 색·서체·모션·히어로만 B, A 위에 -o 로 덮는다)
```

부품은 `r1-measure-<부품>`(예: `r1-measure-button`)으로 하나씩도 설치된다. 단일 HTML 에는 `registry/factory/r/r1-measure/r1-measure.css` 를 붙인다.

## 한눈에

- 분위기: 계측 · 차분 · 정확
- 첫 화면 히어로: step-band-orbit(단계 띠 3칸 + 궤도 도면)
- 맞는 원형: dashboard · saas
- 스타일 축: 반경 R0 · 버튼 B1 · 입력 I3 · 표면 C2 · 표 T4 · 머리 H3 · 그림자 S0
- 모션 M1 · 아이콘 lucide G1(부품이 부르는 어댑터 `components/icons/lucide` — 블록이 부르는 `components/icons`(index.ts, 이 레시피가 깐다)도 이것을 다시 내보낸다, 결 변수 --icon-stroke: 2 · --icon-linecap: round · --icon-linejoin: round)
- 서체: 제목 Martian Mono(`font-martian-mono`, 굵기 600 — `--wf-heading-weight`·`.font-heading` 기본값, 조정: 첫 화면 제목·레일·단계 번호 전용 고정폭. 굵기 600(제목)·400(레일), 제목 자간 -0.03em·행간 0.95, 레일은 대문자 자간 0.12em. 본문·표 칸에는 쓰지 않는다(숫자 칸은 fonts.mono)) · 한글 제목 Nanum Gothic Coding(`font-nanum-gothic-coding`) · 본문 IBM Plex Sans KR(`font-ibm-plex-sans-kr`, 조정: 본문 16px/1.7, 굵기 400·700만) · 고정폭 IBM Plex Mono(`font-ibm-plex-mono`, 조정: data-numeric 표 칸·숫자 입력·코드에만(T7-I1), 굵기 400)
- 레퍼런스: component-k17 · type-t06 · color-c02 · pal-sns-instagram-ddujmhojbb4-1 · pal-sns-threads-duymesgic-0-5
- 색 논리 K1(단일 액센트·중립 우세) · 기본 테마 light
- 역동 기법(dynamics, DESIGN §8-6): `svg-draw`(SVG 선 그리기) — 대표 장면과 찍어낸 첫 화면에 실제로 나와야 한다. 원천 본문 「쓰는 법」이 자리를 정한다
- 보드 B안(alternates): 새 팔레트(색 논리 K1 그대로) · 서체 Tektur · PyeojinGothic · 첫 화면 baseline-split — DNA 수 2(바닥선을 공유하는 두 칸 · 짙은 강철 면 위 치수선) — 강철·구리 새 팔레트(pal-sns-threads-duymesgic-0-5 + 측정 사이트의 짙은 강철·흙갈색), 제목 Tektur·펴진고딕. 색 논리 K1·모션 M1·기법 svg-draw 는 A 그대로. 운영자가 보드에서 고르기 전까지는 위 A 값이 설치된다
- 보드에서 고를 수 있는 조합(B를 적용해 lint 를 통과한 것만): B 전체(colorLogic+fonts+hero) · fonts+hero · colorLogic+hero · hero · colorLogic+fonts · fonts · colorLogic

### B안 색 (적용하면 A 색을 덮는다)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9076 0.0068 115.72)` | `oklch(0.1845 0.0032 196.88)` |
| `--foreground` | `oklch(0.2197 0.0360 255.94)` | `oklch(0.9076 0.0068 115.72)` |
| `--card` | `oklch(0.9379 0.0067 115.71)` | `oklch(0.2192 0.0084 240.29)` |
| `--card-foreground` | `oklch(0.2197 0.0360 255.94)` | `oklch(0.9076 0.0068 115.72)` |
| `--popover` | `oklch(0.9379 0.0067 115.71)` | `oklch(0.2192 0.0084 240.29)` |
| `--popover-foreground` | `oklch(0.2197 0.0360 255.94)` | `oklch(0.9076 0.0068 115.72)` |
| `--primary` | `oklch(0.2662 0.0251 244.06)` | `oklch(0.8073 0.0240 246.10)` |
| `--primary-foreground` | `oklch(0.9076 0.0068 115.72)` | `oklch(0.1845 0.0032 196.88)` |
| `--secondary` | `oklch(0.8728 0.0084 121.65)` | `oklch(0.2477 0.0116 237.16)` |
| `--secondary-foreground` | `oklch(0.2197 0.0360 255.94)` | `oklch(0.9076 0.0068 115.72)` |
| `--muted` | `oklch(0.8728 0.0084 121.65)` | `oklch(0.2477 0.0116 237.16)` |
| `--muted-foreground` | `oklch(0.3619 0.0262 248.55)` | `oklch(0.7589 0.0153 244.78)` |
| `--accent` | `oklch(0.8631 0.0078 228.87)` | `oklch(0.3471 0.0372 244.57)` |
| `--accent-foreground` | `oklch(0.2662 0.0251 244.06)` | `oklch(0.9177 0.0156 248.00)` |
| `--border` | `oklch(0.5406 0.0211 250.75)` | `oklch(0.5041 0.0229 245.93)` |
| `--input` | `oklch(0.4844 0.0216 250.79)` | `oklch(0.6181 0.0211 248.17)` |
| `--ring` | `oklch(0.5102 0.1145 46.26)` | `oklch(0.7309 0.1170 49.47)` |

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

## 색 (라이트 / 다크)

| 변수 | 라이트 | 다크 |
|---|---|---|
| `--background` | `oklch(0.9596 0.0041 121.56)` | `oklch(0.1873 0.0099 234.39)` |
| `--foreground` | `oklch(0.1985 0.0438 254.97)` | `oklch(0.9490 0.0051 145.54)` |
| `--card` | `oklch(0.9865 0.0041 121.56)` | `oklch(0.2260 0.0142 239.34)` |
| `--card-foreground` | `oklch(0.1985 0.0438 254.97)` | `oklch(0.9490 0.0051 145.54)` |
| `--popover` | `oklch(0.9865 0.0041 121.56)` | `oklch(0.2260 0.0142 239.34)` |
| `--popover-foreground` | `oklch(0.1985 0.0438 254.97)` | `oklch(0.9490 0.0051 145.54)` |
| `--primary` | `oklch(0.3254 0.0794 257.02)` | `oklch(0.7700 0.0517 252.17)` |
| `--primary-foreground` | `oklch(0.9596 0.0041 121.56)` | `oklch(0.1985 0.0438 254.97)` |
| `--secondary` | `oklch(0.9243 0.0074 132.42)` | `oklch(0.2510 0.0162 240.71)` |
| `--secondary-foreground` | `oklch(0.1985 0.0438 254.97)` | `oklch(0.9490 0.0051 145.54)` |
| `--muted` | `oklch(0.9243 0.0074 132.42)` | `oklch(0.2510 0.0162 240.71)` |
| `--muted-foreground` | `oklch(0.3937 0.0371 256.14)` | `oklch(0.7933 0.0169 245.14)` |
| `--accent` | `oklch(0.9214 0.0178 253.34)` | `oklch(0.2847 0.0368 253.76)` |
| `--accent-foreground` | `oklch(0.3254 0.0794 257.02)` | `oklch(0.9005 0.0342 253.72)` |
| `--destructive` | `oklch(0.5 0.19 27)` | `oklch(0.7 0.16 25)` |
| `--border` | `oklch(0.6081 0.0181 245.24)` | `oklch(0.5072 0.0249 246.16)` |
| `--input` | `oklch(0.5600 0.0235 248.25)` | `oklch(0.5967 0.0239 246.06)` |
| `--ring` | `oklch(0.4914 0.1858 263.30)` | `oklch(0.7267 0.1165 262.57)` |
| `--success` | `oklch(0.5 0.1 155)` | `oklch(0.74 0.11 155)` |
| `--success-foreground` | `oklch(0.985 0.005 155)` | `oklch(0.19 0.02 155)` |
| `--warning` | `oklch(0.55 0.12 60)` | `oklch(0.8 0.12 75)` |
| `--warning-foreground` | `oklch(0.985 0.005 60)` | `oklch(0.2 0.03 75)` |
| `--info` | `oklch(0.47 0.15 255)` | `oklch(0.74 0.12 255)` |
| `--info-foreground` | `oklch(0.985 0.004 255)` | `oklch(0.19 0.014 255)` |

## 서체 스택 (cssVars.theme)

소비자 `globals.css`의 `@theme inline`에 들어가는 값이다. `inline`이라 Tailwind가 `font-sans`·`font-heading`·`font-heading-ko`·`font-mono`(prose 가 있으면 `font-prose`까지) 유틸리티(그리고 `html { @apply font-sans }`)에 값을 직접 넣는다. 화면은 이 스택으로 그려진다.
런타임 변수 `var(--font-sans)`·`var(--font-mono)`는 이 값이 아닐 수 있다. `shadcn init`이 `layout.tsx`에 남긴 Geist·Geist_Mono 로더(`variable: "--font-sans"`·`"--font-mono"`)가 있으면 Geist·Geist Mono를 가리킨다. 로더를 지우는 법은 gotcha `init-geist-loader`(`ai/gotchas.json`)에 있다. CSS에서 서체를 부를 때는 유틸리티 클래스나 `--font-<slug>-wf`를 쓴다.

- `--font-sans`: `var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading`: `var(--font-martian-mono-wf, "Martian Mono", "Nanum Gothic Coding", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-nanum-gothic-coding-wf, "Nanum Gothic Coding", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-heading-ko`: `var(--font-nanum-gothic-coding-wf, "Nanum Gothic Coding", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif), "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- `--font-mono`: `var(--font-ibm-plex-mono-wf, "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", var(--font-ibm-plex-sans-kr-wf, "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", monospace), "Apple SD Gothic Neo", "Malgun Gothic", monospace`

`font-heading-ko`(`--font-heading-ko`)는 라틴 제목 서체를 건너뛴 한글 제목 스택이다(한글 제목체 Nanum Gothic Coding → 본문 → 시스템 한글). 굵기는 `.font-heading`과 같은 제목 굵기 토큰(`var(--wf-heading-weight-ko, var(--wf-heading-weight, 700))`)을 받는다. 한글만 있는 큰 제목에서 라틴 제목 서체(고정폭 등)의 공백·쉼표가 끼지 않게 할 때 `font-heading` 대신 단다.

## 원천 본문

## 선택 보드 2판 판정 (2026-09-28)

- 선택 보드 2판(2026-09-28): A·B 모두 좋다 — A가 기본, B는 대안으로 유지. 결정 원본은 `factory/board/recipe-board2-decisions.json`(보드 https://claude.ai/artifact/138xBisSWmr8RZY6EheoSg)이다.
- 부분 판정(A): 색·배치·글씨체는 좋다, 모션만 별로 — 대표 메모 「너무 모션 그래픽이 단순해.」. 모션 보완은 이번 판정 범위가 아니고 별도 모션 작업에서 다룬다.

## 선택 보드 판정 (2026-09-27, P3-1 Task 9)

- 선택 보드 판정(2026-09-27): **A안 유지** — 색 논리 K1 · 모션 M1 · 역동 기법 `svg-draw` 그대로다. B안(K6 청사진 면 + `clip-reveal`)은 고르지 않았다. 결정 원본은 `factory/board/recipe-decisions.json`(보드 https://claude.ai/artifact/LFfuRm2ufekAEWxCTmKacB)이다.
- `alternates`는 지웠다(보존하지 않음). 보드가 닫혀 다시 고를 자리가 없고, 남겨 두면 설치 안내가 「운영자가 고르기 전까지」를 계속 말한다. B 값은 이 레시피의 Task 6b 머리(커밋 `8541c6f`)와 보드 고정본 `factory/board/recipe-board/heads-at-board.json`에 남아 있다.
- 이 판정으로 레시피 10벌 가운데 거의 흰 바탕 골격(div-01)은 이 레시피 하나다 — 계측 대시보드의 절제된 얼굴이 골격 자리를 맡는다.

## 결정 기록 (2026-09-26, 수정 1회차 반영)

방향 원천은 dribbble-summary §6 R1(계측·차분·정확), style_axes N1(텔레메트리)·N4(인증·문서 신뢰)다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 도면 계측 (고름) | B 계측 문서 (남김, 안 씀) | C 야간 관제판 (버림) |
|---|---|---|---|
| 분위기 3단어 | 계측 · 차분 · 정확 | 공인 · 정돈 · 신뢰 | 야간 · 경계 · 조밀 |
| 축 | B1 I3 C2 T4 H3 R0 S0, M1 | B2 I1 C1 T2 H1 R1 S1, M1 | B3 I1 C1 T1 H4 R1 S0, M0 |
| 서체 짝과 이유 | IBM Plex Sans(제목) + Plex Sans KR(본문) + Plex Mono(숫자). 공학 문서용으로 만든 한 가족이라 「그로테스크 한 계열 두 굵기」(type-t01)를 지키면서 숫자 열이 맞는다 | Pretendard GOV 한 가족. 공공 서식의 가독성이 검증됐고 KRDS가 이 가족 하나로 쓴다 | Barlow Condensed(제목·수치) + Pretendard(본문). 좁은 벽 화면에 수치를 많이 싣기 위한 응축형 |
| 색 3개 + 강조 1 | 오프화이트 용지 · 잉크 · 푸른 회색 + 청사진 파랑(hue 255) | 흰 바탕 · 짙은 남색 글자 · 옅은 회색 + 공공 파랑(hue 250) | 푸른 먹색 바탕(L 0.19) · 밝은 회색 글자 · 중간 회색 + 경보 호박색(hue 70) |
| 사진·그림 | 사진 없음. 그림은 실제 데이터로 그린 차트와 수위 눈금뿐 | 사진 없음. 서식·도식과 인증 표지(실제 인증일 때만) | 사진 없음. 지도 타일과 실시간 차트 |
| 이 안에서만 나오는 레이아웃 | KPI 한 줄 셀(1px 잉크 선) + 괘선 표 + 사양 띠 | 왼쪽 목차 레일 + 오른쪽 조항·표의 문서형 2열 | 12열 운영 벽: 사이드 레일 + 경보 대기열 + 조밀 표 |
| 레퍼런스 2개 | KRDS 색 램프 규칙 · SaaS 표본(유채 1) | KRDS 색 램프 규칙 · 중앙부처 누리집 표본 | 모니터링 대시보드 표본 둘 |

- **버린 안: C.** 다크 바탕에 경보 호박색 한 점만 채도를 갖는 구성은 §13 「거의 검정 + 형광 초록·주홍 한 점」의 바로 옆이다. 바탕을 L 0.19로 올리고 호박색 채도를 낮춰도, 첫인상을 만드는 것은 결국 어두운 면 위의 따뜻한 한 점이다. 세 안 가운데 §13 표의 한 행에 가장 가깝다.
- **남긴 안: B.** 상투 표의 어느 행에도 걸리지 않는다. 그러나 교체 가능성 검사에서 떨어졌다. 주제를 은행·병원·학교로 바꿔 끼워도 색·반경·레이아웃이 그대로 성립해서, §13의 「UI 키트를 기본 테마 그대로 납품」과 구별되지 않는다. 이 레시피에서는 B의 「한글 서체를 한 가족으로 명시한다」만 가져왔다.
- **고른 안: A.** 방문자 모드는 조작(dashboard)과 설득(saas) 두 가지다.
- **교체 가능성 검사로 고친 것**
  - 처음 액센트는 청록(hue 195)이었다. 공장 기본 테마와 같은 hue라서 도면의 재료인 청사진(프러시안 블루, hue 255)으로 옮겼다.
  - 주 버튼은 잉크로 칠한다(B1 명세 「채움 잉크색」). 대신 파랑은 **선택·포커스·활성 상태를 표시하는 색**으로 약속한다: 포커스 링, 토글·탭의 눌림/선택 2px 안쪽 링(ring), 메뉴의 강조 칸(accent), 정보 상태(info), 차트. 쉬는 화면에서도 선택된 칸이 파랗게 보이도록 했다(수정 1회차 — 리뷰 「파랑이 차트에만 보여 흑백 도면처럼 읽힌다」).
- **서체**: Plex 세 가지는 모두 SIL OFL 1.1이다(1차 출처는 폰트 키트 항목의 라이선스 줄). §13·banlist 목록에 없다. 폰트 항목(`font-ibm-plex-*`)은 Task 8 폰트 키트가 만들고, 그 전까지는 스택의 이름 폴백과 시스템 한글로 그린다.
- **아이콘**: lucide(키트 항목 `icons-lucide`, 부품은 정본 이름으로 어댑터를 부른다 — Task 9). 결은 G1(외곽선 2px, `--icon-stroke: 2`) 하나로 통일한다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 saas·awwwards·S 1.0 표본 네 곳의 유채색 수는 1 · 2 · 3 · 3이다. 카드 기준(2개 이하가 절제)으로 절제와 다색이 2:2로 갈린다. 빈도로 보면 saas 전체에서는 다색 카드(color-saas-accent-multi, 12곳)가 절제 카드(4곳)보다 많다. 그래도 브랜드 색을 하나로 둔 근거는 DESIGN §5다. 랜딩 대표색 2색(SOTD 24곳 중 24곳이 1~2색), 뉴트럴이 면적 대부분, 액센트는 활성 상태 전용이라는 규칙이다. 기법은 유채 1 표본 행(본문 대비 20.03)에서 가져왔다. 상태색(성공·경고·오류·정보)은 §5 MUST라 따로 두고, 의미에만 쓴다.
- **글자 크기**: 비율 1.25 하나로 16 · 20 · 25 · 31 · 39 · 49에서 멈춘다. 제목:본문은 49/16 ≈ 3.06배다. 기준 표본은 saas 표본 하나(S 1.0, h1:본문 3.0)다.

## 분위기

측량 도면처럼 조용하고 정확한 화면이다. 회백 용지(`#F1F2EF`)에 짙은 남색 먹으로 쓰고, 모서리는 모두 직각이다. 첫 화면의 주인은 고정폭 제목과 1px 선으로 그린 궤도 도면이고, 제목의 한 낱말과 선택된 단계 칸만 남색 주색을 받는다. 도면 선은 처음 한 번 그려지고, 상태점 하나만 천천히 깜빡인다. B안은 같은 도면 결을 짙은 강철 면 위의 치수선과 바닥선을 공유하는 두 칸으로 옮기고, 강철·구리 팔레트와 넓게 누른 테크노 제목으로 바꾼다.

## 쓰는 법

- 맞는 원형은 운영 대시보드와 기술형 SaaS 랜딩이다. 숫자·표·상태가 화면의 주인공인 곳에 쓴다.
- 첫 화면은 히어로 `step-band-orbit`(B안 `baseline-split`)이다. 왼쪽 5/12: 상태점 레일 → 두 줄 제목(한 낱말만 `text-primary`) → 설명 → 1px 선 3칸 단계 띠(ToggleGroup, 선택 칸 윗선 2px primary + muted 바탕) → 버튼 둘. 오른쪽 7/12: 동심원·궤도·측정점의 선 도면과 네 모서리 좌표 읽기값.
- 제목·레일·단계 번호는 `font-heading`(라틴 Martian Mono 600, 한글 나눔고딕코딩)이다. 레일과 좌표는 대문자·자간 0.08~0.12em 한 줄이다. 본문·설명·표는 IBM Plex Sans KR, 표 숫자 칸만 `data-numeric`(IBM Plex Mono)이다.
- 수치는 `tabular-nums`로 쓴다. 큰 수치는 가늘게, 단위는 수치의 45% 크기·muted 색으로 붙인다(type-t06).
- KPI는 카드로 나누지 않는다. 한 줄 셀로 늘어놓고 1px 선으로 가른다(component-k17). 구분선(`--border`)은 바탕 대비 3:1 이상이다(선 구획 C2·T4·H3).
- 주 버튼은 남색 채움 하나, 보조 동작은 같은 반경(0)의 외곽선 버튼이다. 선택·포커스는 청사진 파랑 링(`--ring`)이 표시한다.
- 상태는 색과 글자를 함께 쓴다: 정상 success, 주의 warning, 오류 destructive, 안내 info. 차트는 파랑 명도 단계 5개(chart-1~5)다(color-c02).
- 모션은 M1이다. 상태 전환 150ms, 등장은 `--duration-enter`(300ms) 페이드, 튕김 없음.
- 역동 기법은 `svg-draw` 하나다. 첫 화면 도면(B안은 치수선)을 한 번 그린다 — `--duration-enter`의 3배(900ms), `--ease-emphasized`, 120ms 늦게. 반복은 상태점 맥박 하나(2800ms)뿐이다. 동작 줄이기에서는 완성된 선이 바로 보이고 맥박이 없다.

## 하지 말 것

- 둥근 모서리를 섞지 않는다. 버튼·입력·카드·배지까지 모두 0이다(R0).
- 고정폭 제목체(Martian Mono)를 본문·설명·표 칸에 쓰지 않는다. 제목·레일·좌표 읽기값·단계 번호에만 쓴다.
- 남색을 넓은 면에 칠하지 않는다. 주색은 주 버튼·제목의 한 낱말·선택 칸 윗선에만 나온다(K1 — 액센트 하나, 중립 우세).
- 어두운 테마를 「검정 + 형광 한 점」으로 만들지 않는다. 다크 바탕은 먹청(`#0F1417`)이고 주색은 밝히되 채도는 낮춘다(§13).
- 격자·눈금 선을 장식으로 깔지 않는다. 선은 도면·표·단계 띠처럼 실제로 나누는 곳에만 긋는다.
- 그림자를 더하지 않는다(S0). 깊이는 선과 표면 명도 차이로만 만든다.
- 도면을 한 번 넘게 그리지 않는다. 스크롤마다 다시 그리는 연출은 쓰지 않는다.

## 레퍼런스 DNA

- 카드: `docs/recipes/dna/r1-measure.md`(측정 사이트 2곳 · 팔레트 · 서체 · 히어로 2수 · 모션 1수). 레시피에는 사이트 이름을 적지 않는다.
- A안 = 카드 수 1(단계 띠 3칸 + 궤도 도면) · 카드 팔레트 표 그대로(`pal-sns-instagram-ddujmhojbb4-1` + 측정값) · Martian Mono + 나눔고딕코딩(`docs/recipes/dna/fonts-assignment.md`). 구분선만 바꿨다: 카드의 `#B7BEC3`·`#34414C`는 바탕 대비 1.8·1.9라 선 구획 규칙(3:1, lint line-border)을 못 넘어 `#7A848D`·`#5A6773`(3.39·3.20)으로 내렸다.
- B안 = 카드 수 2(바닥선을 공유하는 두 칸) · 새 팔레트: 측정 사이트의 짙은 강철 `#1B2731`·먹 `#111313`·흙갈색 `#34231C`(→ 구리 링 `#9A4E26`) + SNS 팔레트 `pal-sns-threads-duymesgic-0-5`(회백 `#E0E1DC`·먹청 `#0F1B2B`) · Tektur + 펴진고딕. 카드의 수 2 구조가 카드 「사이트 1」의 첫 화면에서 왔기 때문에(수 1은 사이트 2) B 색도 그 사이트의 측정값에서 가져왔다 — 사이트 2 색은 이미 A 바탕(`#F1F2EF`)에 들어가 있다.
- 색 논리 K1·다크 기본 없음·모션 M1·기법 `svg-draw`는 선택 보드 판정(Task 9) 그대로다. 사진은 쓰지 않는다(도면·치수선은 직접 그린 SVG).
- 위 「선택 보드 판정」·「결정 기록」 절의 색·서체 값은 그 당시 값이다. 지금 값은 머리(YAML)와 이 절이 정한다(Task 10d, 2026-09-27).

## 레퍼런스에서 가져온 기법

- KRDS 색 램프(주소는 적지 않는다) : 색 램프의 단계 차로 대비를 정한다. muted-foreground는 배경 대비 7:1 단계(8.56 · 10.24)에, 선 구획 구분선(`--border`)은 3:1 단계(3.67 · 3.94)에 둔다. 입력 틀은 I3 잉크 틀이라 본문 대비(12.68 · 7.71)다. 표본 유형은 public(S 1.0, 본문 대비 16.18)이고, 가져온 것은 단계 차 규칙 하나뿐이다.
- saas 표본(유채 1, S 1.0 — 이름은 적지 않는다) : 유채색을 하나만 두고 나머지는 무채 명도 단계로 채운다(표본 유채 1, 본문 대비 20.03). 청사진 파랑 하나, 나머지는 hue 255로 살짝 기운 회색이다.
- saas 표본(h1:본문 3.0, S 1.0 — 이름은 적지 않는다) : 화면 제목과 본문의 비율을 3배로 둔다(표본 h1:본문 3.0, S 1.0). 49/16 ≈ 3.06.
- component-k17 : KPI를 카드 여러 장 대신 1px 구분선 한 줄 셀로 나눈다.
- type-t06 : 큰 수치에 단위를 작게(45%) 붙인다.
- color-c02 : 데이터 색을 한 hue의 명도 단계만으로 구성한다(chart-1~5).
