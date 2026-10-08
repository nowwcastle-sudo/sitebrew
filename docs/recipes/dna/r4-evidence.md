# r4-evidence — 근거 대화 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B(색 논리·기법))이 정한 틀은 그대로다: colorLogic **K7** · defaultTheme **light** · motion **M1** · dynamics [clip-reveal, svg-draw]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://readily.ai/ · 출처 `lapaninja` · editorial 선정 · 방문 2026-09-27T09:33Z
  - 1440 넓이 상위 색: `#FDFEFE` 68.1% · `#050705` 6.3% · `#7CD872` 4.1% · `#34D1F4` 3.6% · `#E1EDEE` 2.4% · `#98E77F` 1.9%
  - 390 넓이 상위 색: `#FFFFFF` 62.8% · `#32D0F6` 8.2% · `#070806` 6.6% · `#79D775` 4.1%
  - 글자색(글자 수 순): `#030303` · `#79736B` · 버튼 바탕: `#FFFFFF` · `#8EEBA5` · `#FFE27F`
  - 첫 화면 서체(글자 수 순): Special Gothic(232) · PP Fragment(44)
  - 가장 큰 글자 1440: PP Fragment, Fraunces · 64px (4.4vw) · 굵기 300 · 자간 -0.64px · 행간 70.4px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: PP Fragment, Fraunces · 40.1px (10.3vw) · 굵기 300 · 자간 -0.401127px · 행간 44.1239px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 왼쪽 절반: 한 줄 소개 → 가는 세리프 제목 2줄 → 회색 설명 2줄 → 반경 0 노랑 채움 버튼(화살표 끝정렬) → 후원사 줄. 오른쪽 절반: 그림의 위 왼쪽 모서리를 흰 사각형이 파고든 L자 계단 크롭, 그림 아래쪽은 왼쪽 칸 밑(가로 40%)까지 넘어온다. 보이지 않는 20칸 격자(72px).
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `color, background-color, border-color, outline-col 0.15s cubic-bezier(0.4, 0, 0.2, 1)`(×10), `all 0.35s cubic-bezier(0.5, 0, 0.5, 1)`(×8) · 라이브러리 흔적 lenis·three · :hover 규칙 1개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 2/6
- 사이트 2: https://www.orchid.security/ · 출처 `awwwards` · Nominee (2026-09) · 방문 2026-09-27T09:35Z
  - 1440 넓이 상위 색: `#110930` 48.9% · `#201B48` 35.4% · `#222B62` 8.9% · `#DFDFE9` 1.7% · `#6E4BDF` 0.8% · `#C9CAD8` 0.7%
  - 390 넓이 상위 색: `#0F0830` 80.8% · `#DADCE5` 5.6% · `#6847DE` 4.2% · `#C6C7D4` 1.9%
  - 글자색(글자 수 순): `#EDEDED` · `#1D1D1B` · `#201F21`
  - 첫 화면 서체(글자 수 순): Aeonik(431)
  - 가장 큰 글자 1440: Aeonik, Arial · 44px (3.1vw) · 굵기 400 · 자간 normal · 행간 48.4px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Aeonik, Arial · 30.5px (7.8vw) · 굵기 400 · 자간 normal · 행간 33.5615px · 대소문자 그대로 · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 짙은 남보라 그라디언트 바탕 가운데에 제목 3줄 → 설명 3줄 → 알약 버튼 2개(보라 채움 + 밝은 면). 그 아래 제품 대시보드 패널(KPI 칸·칩·선 그래프)이 첫 화면 65% 지점에서 시작해 접힘선을 넘는다. 알약 틀 안의 가운데 내비.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `opacity 0.3s ease`(×25), `opacity, filter, transform 0.35s ease`(×25) · 라이브러리 흔적 gsap·ScrollTrigger·lenis·webflow · :hover 규칙 41개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 3/6
- 팔레트: `pal-sns-threads-duymesgic-0-7` · https://www.threads.com/@rhushabh.design/post/DUYMESGiC_0 · @rhushabh.design · 원 역할 대비 fg/bg 21 · 주색 위 글자 10.39

## 팔레트

면(field-1) 호박 `#FCA311`·면 위 글자 남색 `#13213C`는 팔레트(우아함) 값 그대로 — Readily의 노랑 버튼(`#FFE27F`) 자리. 주색 짙은 청 `#1D4E89`은 Orchid 남보라(`#201B48`·`#222B62`)를 K7 두 번째 색상각(약 250°)으로 옮긴 값. 바탕 `#FBFCFD`는 Readily 넓이 1위 흰색(68%) 계열.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#FBFCFD` | `oklch(0.9906 0.0017 247.84)` | `#0D1020` | `oklch(0.1792 0.0333 274.50)` |
| foreground | `#0B1220` | `oklch(0.1831 0.0309 263.38)` | `#EEF0F7` | `oklch(0.9556 0.0096 273.36)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#151A2E` | `oklch(0.2237 0.0398 272.18)` |
| primary | `#1D4E89` | `oklch(0.4234 0.1112 255.11)` | `#9DB6F0` | `oklch(0.7787 0.0878 266.34)` |
| primary-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#0D1020` | `oklch(0.1792 0.0333 274.50)` |
| accent | `#EDF1F7` | `oklch(0.9568 0.0091 258.34)` | `#1E2640` | `oklch(0.2747 0.0497 269.93)` |
| accent-foreground | `#13213C` | `oklch(0.2508 0.0550 262.40)` | `#EEF0F7` | `oklch(0.9556 0.0096 273.36)` |
| muted | `#F1F3F6` | `oklch(0.9635 0.0045 258.32)` | `#171C30` | `oklch(0.2321 0.0395 272.33)` |
| muted-foreground | `#3F4A5C` | `oklch(0.4067 0.0336 260.20)` | `#B7BDD0` | `oklch(0.7996 0.0276 271.79)` |
| border | `#D5DAE2` | `oklch(0.8869 0.0122 259.82)` | `#2C3350` | `oklch(0.3286 0.0524 272.87)` |
| input | `#6B7688` | `oklch(0.5631 0.0309 260.27)` | `#737C99` | `oklch(0.5895 0.0457 271.46)` |
| ring | `#1D4E89` | `oklch(0.4234 0.1112 255.11)` | `#9DB6F0` | `oklch(0.7787 0.0878 266.34)` |
| field-1 | `#FCA311` | `oklch(0.7859 0.1674 70.04)` | `#D6981E` | `oklch(0.7219 0.1433 77.80)` |
| field-1-foreground | `#13213C` | `oklch(0.2508 0.0550 262.40)` | `#0D1020` | `oklch(0.1792 0.0333 274.50)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               18.23 >= 7 PASS
dark  --foreground / --background               16.58 >= 7 PASS
light --card-foreground / --card                18.72 >= 7 PASS
dark  --card-foreground / --card                15.13 >= 7 PASS
light --muted-foreground / --background          8.72 >= 7 PASS
dark  --muted-foreground / --background         10.07 >= 7 PASS
light --muted-foreground / --muted               8.06 >= 4.5 PASS
dark  --muted-foreground / --muted               9.00 >= 4.5 PASS
light --primary / --background                   8.17 >= 4.5 PASS
dark  --primary / --background                   9.34 >= 4.5 PASS
light --primary / --card                         8.39 >= 4.5 PASS
dark  --primary / --card                         8.52 >= 4.5 PASS
light --primary-foreground / --primary           8.39 >= 4.5 PASS
dark  --primary-foreground / --primary           9.34 >= 4.5 PASS
light --accent-foreground / --accent            14.13 >= 4.5 PASS
dark  --accent-foreground / --accent            13.11 >= 4.5 PASS
light --ring / --background                      8.17 >= 3 PASS
dark  --ring / --background                      9.34 >= 3 PASS
light --input / --background                     4.47 >= 3 PASS
dark  --input / --background                     4.56 >= 3 PASS
light --field-1-foreground / --field-1           7.93 >= 4.5 PASS
dark  --field-1-foreground / --field-1           7.52 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 1
- 경고 recipe-caution: colorLogic=K7 × dashboard: 유채색 면은 운영 화면의 의미색(상태·차트)과 다툰다 — 면은 머리 띠·빈 상태 같은 한두 곳에만

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Readily: PP Fragment 300(제목 세리프, Pangram Pangram — 상업 사용은 유료) + 대체 Fraunces, Special Gothic(본문·버튼). Orchid: Aeonik 300·400·700(CoType, 유료) + Inconsolata.

- 1순위 라틴 디스플레이: **Newsreader**
- 1순위 한글 제목: **MaruBuri**
- 본문 한글: Noto Sans KR(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Newsreader** — OFL 1.1 · Google Fonts · opsz 6~72, 200~800, 이탤릭 · 10a 후보 풀에 있음(기각 표시 없음). PP Fragment 300의 가는 세리프 제목 결을 display 광학 크기로 낸다. AI 답 문장(prose)도 같은 가족으로 이어진다. 키트에 없다.
2. **Spectral** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 화면용 날렵한 세리프 — 연구 보고서 결의 대안.
3. **Xanh Mono** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 세리프가 달린 고정폭 — 근거 번호·출처 주석 라벨에만.

한글 제목 후보(순위순):

1. **MaruBuri** — OFL 1.1 · 네이버 한글한글 아름답게 CDN · 10a 후보 풀에 있음(기각 표시 없음). 화면용 현대 부리 — 굵기 300 세리프 제목과 짝. 키트의 Noto Serif KR보다 획 대비가 작고 밝다.
2. **Gowun Batang** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 부드러운 바탕 — 대화 말투에 맞는 대안.
3. **Diphylleia** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 꽃잎 부리 명조 — 표지 한 줄 인용에만.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 계단식으로 물린 오른쪽 그림 (사이트 1)

첫 화면을 6/6 두 칸으로. 왼쪽: 한 줄 소개 → 세리프 제목 2줄(4.4vw, 굵기 300, 자간 -0.01em) → 회색 설명 2줄 → 반경 0 호박(field-1) 채움 버튼(폭 220px, 화살표 끝정렬). 오른쪽 그림은 칸 위 왼쪽 모서리를 background 색 사각형이 파고든 L자 계단 크롭(`clip-path: polygon` 6점)으로 자르고, 그림 아래쪽은 왼쪽 칸 밑으로 10vw 넘어온다. 390: 그림은 제목 오른쪽 20% 세로 띠 + 아래 전체 폭 띠로 갈린다.

### 수 2 — 가운데 제목 + 접힘선을 넘는 증거 패널 (사이트 2)

가운데 정렬 제목 3줄(3.1vw, 굵기 400) → 설명 3줄 → 알약 버튼 2개(주: primary 채움, 보조: muted) 아래에 폭 60vw 제품 패널 카드(KPI 칸 4개 + 칩 줄 + 선 그래프, 1px border)를 첫 화면 65% 지점에서 시작해 접힘선 너머로 이어 둔다. 패널 안 근거 행 하나에만 호박 면. 390: 패널 폭 100%를 넘겨 좌우를 자른다.

## 모션 1수

- 카탈로그 id: `clip-reveal`
- 관측: Readily 로드 애니메이션 0개, 전환 `all 0.35s cubic-bezier(0.5, 0, 0.5, 1)`, `width 1s cubic-bezier(0.6, 0, 0, 1)`(가로로 늘어나는 요소), 측정 요소 6개 중 2개가 스크롤과 다르게 이동. Orchid `opacity, filter, transform 0.35s ease`, GSAP·ScrollTrigger.
- 적용(M1): 답변 속 근거 문장 뒤의 호박 형광 면(field-1)이 `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`으로 왼쪽에서 오른쪽으로 칠해진다 — 문장당 300ms(`--duration-enter`), `cubic-bezier(0.6, 0, 0, 1)`(Readily 관측 곡선), 근거가 여럿이면 80ms 간격, 한 답변에 최대 3개. 답이 다 들어온 뒤 한 번.
- reduced-motion: 면이 처음부터 칠해진 상태(clip-path 없음).

## 복제하지 않는 것

- Readily의 풍경 일러스트, Orchid의 대시보드 스크린샷
- 두 회사 로고·후원사 로고 줄의 실제 로고, 「Healthcare compliance…」 같은 문구
- PP Fragment·Aeonik 서체 파일
- Orchid의 남보라 그라디언트 바탕 — K7은 두 색 사이 그라디언트 금지
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
