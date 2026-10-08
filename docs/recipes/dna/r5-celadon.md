# r5-celadon — 청자 고요 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B 전체)이 정한 틀은 그대로다: colorLogic **K6** · defaultTheme **light** · motion **M3** · dynamics [tilt-3d, clip-reveal, variable-axis]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://www.susannekaufmann.com/ · 출처 `siteinspire` · editorial 선정 · 방문 2026-09-27T09:33Z
  - 1440 넓이 상위 색: `#1A1A18` 23.9% · `#090909` 10.6% · `#F2EEEB` 10.1% · `#B58964` 7.4% · `#3A4038` 7.3% · `#FFFFFF` 7.1%
  - 390 넓이 상위 색: `#E8E8E8` 28.5% · `#FFFFFF` 22.8% · `#A1735C` 8.8% · `#010101` 8.7%
  - 글자색(글자 수 순): `#FFFFFF` · `#F2EEEB` · `#1E1E1E` · 버튼 바탕: `#000000` · `#F2EEEB` · `#F0F0F0`
  - 첫 화면 서체(글자 수 순): KaufmannSans(416) · Kaufmann(73) · Martina Plantijn(70)
  - 가장 큰 글자 1440: Kaufmann, Arial · 45px (3.1vw) · 굵기 700 · 자간 normal · 행간 45px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Kaufmann, Arial · 45px (11.5vw) · 굵기 700 · 자간 normal · 행간 45px · 대소문자 그대로 · 정렬 center
  - 판독 메모: 측정된 가장 큰 글자는 뉴스레터 팝업 문구다. 화면의 실제 제목은 영상 위 세리프 한 줄(스크린샷 판독, 크기는 재지 않음).
  - 구조(스크린샷 판독 + 상자 측정): 12칸 격자. 불투명 머리 띠 2단(검은 공지 1줄 + 밝은 내비) 아래 첫 화면 나머지를 전폭 영상 한 장이 채운다. 영상 위 좌상단에 세리프 제목 한 줄, 3번째 칸 폭에 짧은 문단 3개 + 직사각형 버튼 2개(채움·외곽선, 반경 0). 390에서는 왼쪽 42% 글·알약 버튼(반경 50px) / 오른쪽 58% 사진으로 갈린다. 쿠키 창이 가운데를 덮었다(누르지 않음).
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1)`(×67), `opacity 0.25s ease`(×50) · 라이브러리 흔적 viewTimeline · :hover 규칙 25개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 3/5
- 사이트 2: https://exemplarfromsweden.com/ · 출처 `siteinspire` · 2026-09-24 선정 · 방문 2026-09-27T09:37Z
  - 1440 넓이 상위 색: `#937E66` 24.2% · `#5D4A3E` 18.2% · `#7B6450` 17.4% · `#201F1D` 8.2% · `#F9F5F7` 7.4% · `#A6957D` 6.9%
  - 390 넓이 상위 색: `#1D1D1B` 22.2% · `#F7F3F5` 18.4% · `#94826C` 16.3% · `#BBAF9C` 7.9%
  - 글자색(글자 수 순): `#FFFFFF`
  - 첫 화면 서체(글자 수 순): Exemplar Sans(89) · Exemplar(34)
  - 가장 큰 글자 1440: Exemplar, serif · 144.8px (10.1vw) · 굵기 400 · 자간 normal · 행간 144.787px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Exemplar, serif · 64.9px (16.6vw) · 굵기 400 · 자간 normal · 행간 64.8551px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 전폭 공방 영상 위에 제목 한 줄을 화면 폭 92%로(세로 38% 지점) — 앞 낱말은 소문자, 뒤 구절은 대문자. 다른 글자는 네 모서리 메타뿐(좌상 연도, 가운데 위 이름, 우상 메뉴, 좌하 위치 2줄).
  - 모션 관측(1440): 로드 직후 애니메이션 2개(transform 400ms cubic-bezier(0.16, 1, 0.3, 1) d0, width 3000ms linear d0) · 무한 반복 0 · 전환 상위 `opacity, transform 2s cubic-bezier(0.16, 1, 0.3, 1)`(×10), `opacity, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`(×7) · 라이브러리 흔적 없음 · :hover 규칙 21개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/1
- 팔레트: `pal-sns-instagram-ddeit3lidlc-2` · https://www.instagram.com/p/DdEit3LiDLc · @dyslove.design · 원 역할 대비 fg/bg 13.13 · 주색 위 글자 9.46

## 팔레트

면(field-1) 청자 `#99E1D9`·주색 `#32292F`는 팔레트 값 그대로. 글자 `#1A1A18`은 Susanne Kaufmann 넓이 1위(23.9%) 먹색 그대로. 바탕 `#F2F4F3`은 Kaufmann 머리 띠의 오프화이트 `#F2EEEB`를 청자 쪽(차갑게)으로 옮긴 값. Exemplar의 돌 갈색(`#937E66`·`#5D4A3E`)은 K6 면 대역(C 0.08 이상) 밖이라 색 키로는 안 쓰고 사진 속 재질에 맡긴다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F2F4F3` | `oklch(0.9654 0.0025 165.08)` | `#121514` | `oklch(0.1920 0.0051 173.79)` |
| foreground | `#1A1A18` | `oklch(0.2170 0.0038 106.71)` | `#EDEFEC` | `oklch(0.9498 0.0045 134.85)` |
| card | `#FAFBFA` | `oklch(0.9871 0.0017 145.56)` | `#1A1E1D` | `oklch(0.2305 0.0063 179.07)` |
| primary | `#32292F` | `oklch(0.2933 0.0168 338.38)` | `#D6ECE7` | `oklch(0.9255 0.0242 180.61)` |
| primary-foreground | `#F2F4F3` | `oklch(0.9654 0.0025 165.08)` | `#121514` | `oklch(0.1920 0.0051 173.79)` |
| accent | `#E1EFEC` | `oklch(0.9408 0.0154 181.77)` | `#1F2A28` | `oklch(0.2739 0.0157 182.80)` |
| accent-foreground | `#1A1A18` | `oklch(0.2170 0.0038 106.71)` | `#E1EFEC` | `oklch(0.9408 0.0154 181.77)` |
| muted | `#E9ECEA` | `oklch(0.9402 0.0042 157.17)` | `#1A1F1E` | `oklch(0.2338 0.0076 182.27)` |
| muted-foreground | `#46443F` | `oklch(0.3869 0.0087 88.72)` | `#B3BBB8` | `oklch(0.7849 0.0098 171.72)` |
| border | `#CDD2CF` | `oklch(0.8590 0.0068 160.05)` | `#2E3634` | `oklch(0.3246 0.0114 178.83)` |
| input | `#747A77` | `oklch(0.5735 0.0085 164.75)` | `#76807D` | `oklch(0.5906 0.0127 176.02)` |
| ring | `#2B6E67` | `oklch(0.4935 0.0683 185.83)` | `#7FD3C9` | `oklch(0.8106 0.0834 185.99)` |
| field-1 | `#99E1D9` | `oklch(0.8601 0.0727 187.17)` | `#0A6E66` | `oklch(0.4854 0.0828 185.92)` |
| field-1-foreground | `#1A1A18` | `oklch(0.2170 0.0038 106.71)` | `#F2FBF9` | `oklch(0.9808 0.0098 181.42)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               15.78 >= 7 PASS
dark  --foreground / --background               15.89 >= 7 PASS
light --card-foreground / --card                16.80 >= 7 PASS
dark  --card-foreground / --card                14.56 >= 7 PASS
light --muted-foreground / --background          8.81 >= 7 PASS
dark  --muted-foreground / --background          9.38 >= 7 PASS
light --muted-foreground / --muted               8.18 >= 4.5 PASS
dark  --muted-foreground / --muted               8.51 >= 4.5 PASS
light --primary / --background                  12.73 >= 4.5 PASS
dark  --primary / --background                  14.88 >= 4.5 PASS
light --primary / --card                        13.55 >= 4.5 PASS
dark  --primary / --card                        13.64 >= 4.5 PASS
light --primary-foreground / --primary          12.73 >= 4.5 PASS
dark  --primary-foreground / --primary          14.88 >= 4.5 PASS
light --accent-foreground / --accent            14.74 >= 4.5 PASS
dark  --accent-foreground / --accent            12.51 >= 4.5 PASS
light --ring / --background                      5.39 >= 3 PASS
dark  --ring / --background                     10.56 >= 3 PASS
light --input / --background                     3.97 >= 3 PASS
dark  --input / --background                     4.51 >= 3 PASS
light --field-1-foreground / --field-1          11.73 >= 4.5 PASS
dark  --field-1-foreground / --field-1           5.81 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 2
- 경고 field-contrast-target: dark field-1-foreground/field-1 5.81 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="field-1"] muted-foreground/background 5.56 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Susanne Kaufmann: KaufmannSans 400·700(자체) + Martina Plantijn(Klim, 유료 세리프) + 워드마크 Kaufmann. Exemplar: Exemplar 300~700(자체 세리프, 제목 145px 굵기 400) + Exemplar Sans.

- 1순위 라틴 디스플레이: **Bodoni Moda**
- 1순위 한글 제목: **Diphylleia**
- 본문 한글: Pretendard(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Bodoni Moda** — OFL 1.1 · Google Fonts · opsz 6~96, wght 400~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). Martina Plantijn·Exemplar의 가는 대비 세리프 자리. 광학 크기·굵기 축이 있어 variable-axis 기법을 제목에 바로 건다. 「프리미엄이면 세리프」 기본값이 되지 않게 첫 화면 한 줄 제목에만 쓰고 나머지는 본문 고딕.
2. **Tenor Sans** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). KaufmannSans 같은 담백한 인문 기하 — 메뉴·라벨·가격.
3. **Smooch Sans** — OFL 1.1 · Google Fonts · wght 100~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). 가늘게도 굵게도 쓰는 좁은 산세리프 — 세리프가 싫을 때 한 줄 제목 대안.

한글 제목 후보(순위순):

1. **Diphylleia** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 꽃잎 같은 부리의 가는 현대 명조 — 여백 많은 고요 결. 키트 한글과 확연히 다르다.
2. **Grandiflora One** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 손으로 그린 듯 흔들리는 장식 명조 — 공방·도자 결을 더 세게.
3. **MaruBuri** — OFL 1.1 · 네이버 한글한글 아름답게 CDN · 10a 후보 풀에 있음(기각 표시 없음). 굵기 여러 개의 현대 부리 — 한글 제목에도 굵기 변화를 줄 때(한글 가변 서체는 풀에 없다).

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 불투명 머리 띠 아래 전폭 영상 + 좌상단 한 줄 (사이트 1)

머리는 불투명 띠 2단(공지 1줄 28px + 내비 64px, background 색). 그 아래 첫 화면 나머지를 전폭 영상·사진 한 장으로 채운다. 제목은 영상 위 좌상단(여백 20px)에 한 줄(2.2vw, 흰 글자), 그 아래 3/12 칸 폭에 짧은 문단 3개 + 직사각형 버튼 2개를 세로로(채움 + 외곽선, 반경 0, 폭 216px). 390: 왼쪽 42% 글·알약 버튼 / 오른쪽 58% 사진으로 가로 분할.

### 수 2 — 화면을 가로지르는 가는 한 줄 + 네 모서리 메타 (사이트 2)

제목을 10vw·굵기 400(가장 가는 굵기)·한 줄로 화면 폭 92%를 채워 세로 38% 지점에 둔다(앞 낱말 소문자 + 뒤 구절 대문자). 첫 화면의 다른 글자는 네 모서리의 12~13px 메타뿐: 좌상단 연도, 가운데 위 이름, 우상단 메뉴, 좌하단 2줄 위치·설명. 바탕은 재질 근접 사진 한 장, 청자 면(field-1)은 스크롤 첫 칸에서 시작. 390: 16.6vw, 두 줄로 꺾인다.

## 모션 1수

- 카탈로그 id: `variable-axis`
- 관측: Exemplar 전환 `opacity, transform 2s cubic-bezier(0.16, 1, 0.3, 1)`(요소 10개), `opacity 1.1s` 같은 곡선, 슬라이드 진행 막대 `width 3000ms linear`. Susanne Kaufmann `all 0.5s cubic-bezier(0, 0.55, 0.45, 1)`, `translate 0.2s cubic-bezier(0.25, 1, 0.5, 1)`, 측정 요소 5개 중 3개가 스크롤과 다르게 이동.
- 적용(M3): 한 줄 제목의 `font-variation-settings: "opsz"`를 로드 후 한 번 6 → 96으로(획이 두툼한 작은 크기용 모양 → 가늘고 날카로운 큰 크기용 모양, 유약이 굳는 듯한 변화) — 1200ms, `cubic-bezier(0.16, 1, 0.3, 1)`(Exemplar 관측 곡선 = M3 `--ease-standard`), 동시에 opacity 0 → 1 700ms(`--duration-enter`). 제목 hover 때 `wght` 400 → 500, 200ms(`--duration-hover`). 한글 제목(Diphylleia)은 가변 축이 없어 opacity만.
- reduced-motion: 최종 축 값(opsz 96)으로 고정, opacity 즉시 1, hover 굵기 변화 없음.

## 복제하지 않는 것

- 두 브랜드의 영상·사진·제품, 로고와 워드마크
- 「New: Body Wash…」「…SET IN STONE」 같은 문구
- KaufmannSans·Martina Plantijn·Exemplar 서체(자체·유료)
- 쿠키 창·뉴스레터 띠 같은 운영 요소
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
