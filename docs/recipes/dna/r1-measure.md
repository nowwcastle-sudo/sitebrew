# r1-measure — 도면 계측 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 A(그대로))이 정한 틀은 그대로다: colorLogic **K1** · defaultTheme **light** · motion **M1** · dynamics [svg-draw]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://www.fmi-industries.com/ · 출처 `awwwards` · Nominee (2026-09) · 방문 2026-09-27T09:57Z
  - 1440 넓이 상위 색: `#111313` 76.3% · `#1B2731` 3.6% · `#34231C` 3% · `#293C4C` 2.3% · `#FEFEFE` 2% · `#3A5366` 1.8%
  - 390 넓이 상위 색: `#101111` 79.8% · `#2B1F1B` 2.7% · `#1B2632` 2.4% · `#FEFFFE` 2.4%
  - 글자색(글자 수 순): `#FFFFFF` · `#232B30`
  - 첫 화면 서체(글자 수 순): Manrope(603) · Space Mono(13)
  - 가장 큰 글자 1440: Manrope, Manrope Fallback · 86.4px (6vw) · 굵기 400 · 자간 -1.728px · 행간 77.76px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Manrope, Manrope Fallback · 48px (12.3vw) · 굵기 400 · 자간 -0.96px · 행간 43.2px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 전폭 사진 한 장(100%) 위에 제목 3줄을 화면 아래 1/3(상단 63%)에 왼쪽 정렬, 같은 바닥선 오른쪽 4/12 칸에 설명 4줄 + 외곽선 버튼(Space Mono 대문자, 자간 넓음). 내비는 위 한 줄 6개 + 검색. 겹침·잘림 없음.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `opacity, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)`(×20), `color 0.2s cubic-bezier(0.22, 1, 0.36, 1)`(×14) · 라이브러리 흔적 lenis · :hover 규칙 0개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/2
- 사이트 2: https://ausvector.ai/ · 출처 `cssda` · UI UX INN (2026-09) · 방문 2026-09-27T09:29Z
  - 1440 넓이 상위 색: `#F1F2EF` 93.8% · `#D5D9D8` 1.9% · `#B2B8BB` 1.1% · `#0C2B6F` 1% · `#0A0A0C` 0.6% · `#C5C7C5` 0.4%
  - 390 넓이 상위 색: `#F3F3EE` 87.2% · `#0B2A6F` 5.4% · `#D6DBDC` 2.5% · `#BFC3C5` 0.9%
  - 글자색(글자 수 순): `#5B6672` · `#0B1320` · `#71717B` · 버튼 바탕: `#FFFFFF` · `#0B2A6F`
  - 첫 화면 서체(글자 수 순): Manrope(326) · IBM Plex Mono(287)
  - 가장 큰 글자 1440: Manrope, Manrope Fallback · 69.1px (4.8vw) · 굵기 600 · 자간 -2.0736px · 행간 65.664px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Manrope, Manrope Fallback · 35.1px (9vw) · 굵기 600 · 자간 -1.053px · 행간 36.855px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 왼쪽 절반: mono 대문자 레일(● + 「/ 01」) → 제목 2줄(한 낱말만 남색 + 뒤에 점묘) → 설명 3줄 → 1px 선 3칸 단계 띠(01·02·03, 선택 칸 윗선 굵게) → 남색 채움 + 외곽선 버튼. 오른쪽 절반: 궤도 원 2개 + 기울어진 타원이 도는 캔버스 지구, 네 모서리에 mono 좌표 읽기값. 390에서 단계 띠가 3열 격자(각 114px)로 남는다.
  - 모션 관측(1440): 로드 직후 애니메이션 8개(badge-ping 2000ms linear d0, hero-copy-reveal 820ms linear d80, pulse-dot 2800ms linear d0 …) · 무한 반복 4개+ · 전환 상위 `background, color 0.18s ease`(×6), `background, color 0.24s cubic-bezier(0.22, 1, 0.36, 1)`(×5) · 라이브러리 흔적 three · :hover 규칙 42개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 1/4
- 팔레트: `pal-sns-instagram-ddujmhojbb4-1` · https://www.instagram.com/p/DduJMHojbB4 · @dopely.colors · 원 역할 대비 fg/bg 16.34 · 주색 위 글자 11.23

## 팔레트

바탕 `#F1F2EF`는 Ausvector 첫 화면 넓이 93.8% 색 그대로, 글자 `#071629`·주색 `#17345C`·다크 주색 `#9DB7D5`는 팔레트(겨울·차가움) 값 그대로, 다크 바탕 `#0F1417`은 FMI 우주 사진의 넓이 1위 `#111313` 계열. 링 `#2456C8`(청사진 파랑)만 새로 더했다(K1 강조 1).

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F1F2EF` | `oklch(0.9596 0.0041 121.56)` | `#0F1417` | `oklch(0.1873 0.0099 234.39)` |
| foreground | `#071629` | `oklch(0.1985 0.0438 254.97)` | `#ECEFEC` | `oklch(0.9490 0.0051 145.54)` |
| card | `#FAFBF8` | `oklch(0.9865 0.0041 121.56)` | `#161D22` | `oklch(0.2260 0.0142 239.34)` |
| primary | `#17345C` | `oklch(0.3254 0.0794 257.02)` | `#9DB7D5` | `oklch(0.7700 0.0517 252.17)` |
| primary-foreground | `#F1F2EF` | `oklch(0.9596 0.0041 121.56)` | `#071629` | `oklch(0.1985 0.0438 254.97)` |
| accent | `#DDE6F1` | `oklch(0.9214 0.0178 253.34)` | `#1D2B3C` | `oklch(0.2847 0.0368 253.76)` |
| accent-foreground | `#17345C` | `oklch(0.3254 0.0794 257.02)` | `#CFE0F5` | `oklch(0.9005 0.0342 253.72)` |
| muted | `#E4E7E2` | `oklch(0.9243 0.0074 132.42)` | `#1B2329` | `oklch(0.2510 0.0162 240.71)` |
| muted-foreground | `#39475A` | `oklch(0.3937 0.0371 256.14)` | `#B3BDC6` | `oklch(0.7933 0.0169 245.14)` |
| border | `#B7BEC3` | `oklch(0.7975 0.0105 238.55)` | `#34414C` | `oklch(0.3683 0.0255 244.07)` |
| input | `#6A7682` | `oklch(0.5600 0.0235 248.25)` | `#74818D` | `oklch(0.5967 0.0239 246.06)` |
| ring | `#2456C8` | `oklch(0.4914 0.1858 263.30)` | `#7FA6F0` | `oklch(0.7267 0.1165 262.57)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               16.17 >= 7 PASS
dark  --foreground / --background               16.00 >= 7 PASS
light --card-foreground / --card                17.49 >= 7 PASS
dark  --card-foreground / --card                14.70 >= 7 PASS
light --muted-foreground / --background          8.41 >= 7 PASS
dark  --muted-foreground / --background          9.72 >= 7 PASS
light --muted-foreground / --muted               7.57 >= 4.5 PASS
dark  --muted-foreground / --muted               8.35 >= 4.5 PASS
light --primary / --background                  11.11 >= 4.5 PASS
dark  --primary / --background                   8.98 >= 4.5 PASS
light --primary / --card                        12.02 >= 4.5 PASS
dark  --primary / --card                         8.25 >= 4.5 PASS
light --primary-foreground / --primary          11.11 >= 4.5 PASS
dark  --primary-foreground / --primary           8.80 >= 4.5 PASS
light --accent-foreground / --accent             9.91 >= 4.5 PASS
dark  --accent-foreground / --accent            10.69 >= 4.5 PASS
light --ring / --background                      5.77 >= 3 PASS
dark  --ring / --background                      7.61 >= 3 PASS
light --input / --background                     4.13 >= 3 PASS
dark  --input / --background                     4.65 >= 3 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 0

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: FMI: Manrope 300·400·600·700(제목 400) + Space Mono 400·700(버튼 라벨). Ausvector: Manrope 400~700(제목 600) + IBM Plex Mono 300~700(레일·단계 띠·좌표). 두 곳 모두 Manrope — 키트에 이미 있어 그대로 가져오면 지금과 차이가 안 난다.

- 1순위 라틴 디스플레이: **Martian Mono**
- 1순위 한글 제목: **Nanum Gothic Coding**
- 본문 한글: IBM Plex Sans KR(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Martian Mono** — OFL 1.1 · Google Fonts · wdth 75~112.5, wght 100~800 가변 · 10a 후보 풀에 있음(기각 표시 없음). 두 사이트의 mono 라벨(Space Mono·Plex Mono)을 제목 크기로 키운 결. 너비·굵기 축이 있어 수치 읽기값과 제목을 한 가족으로 맞춘다. 키트에 mono 제목은 없다.
2. **Tektur** — OFL 1.1 · Google Fonts · 가변 · 10a 후보 풀에 있음(기각 표시 없음). 건축적 테크노 산세리프 — FMI의 공업 소재 결을 굵기 400 큰 제목으로. Manrope보다 각이 서 있다.
3. **Space Mono** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). FMI 버튼 라벨이 실제로 쓰는 서체(10a 메모: 흔한 편이라 굵기·자간 조정 필요). mono 대문자 레일·버튼 라벨에만.

한글 제목 후보(순위순):

1. **Nanum Gothic Coding** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 고정폭 한글 — 계측값·좌표 레일·단계 번호와 제목이 같은 폭 규칙을 따른다. 키트의 비례 고딕들과 확연히 다르다. 굵기 400·700.
2. **Orbit** — OFL 1.1 · Google Fonts · 굵기 400 하나 · 10a 후보 풀에 있음(기각 표시 없음). 원·직선으로 짠 기하 한글 — 궤도 도면과 결이 같다. 굵기 하나라 제목 굵기 합성을 끄는 기존 처리를 따른다.
3. **IBM Plex Sans KR** — OFL 1.1 · 키트 항목 font-ibm-plex-sans-kr(현재 본문). 제목까지 한 가족으로 되돌리는 안전한 대안 — 차이는 줄어든다.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 단계 띠 3칸 + 궤도 도면 (사이트 2)

왼쪽 5/12 칸을 위에서부터 mono 대문자 레일(● 상태점 + 「DATASET / 01」) → 제목 2줄(4.8vw, 굵기 600, 자간 -0.03em, 한 낱말만 primary) → 설명 3줄 → **1px 선으로 짠 3칸 단계 띠**로 쌓는다. 띠는 ToggleGroup 3개를 표 칸처럼 붙이고 칸마다 mono 번호 01·02·03 + 대문자 라벨 + 설명 한 줄, 선택 칸만 윗선 2px primary·바탕 muted. 그 아래 버튼 2개(채움 + 외곽선, 반경 0~4px). 오른쪽 7/12 칸은 동심원 2개 + 기울어진 궤도 타원 1개 + 점 4개의 SVG 도면(선 1px border 색), 네 모서리에 mono 좌표 읽기값. 390: 띠는 3칸 그대로(각 1/3), 도면은 제목 아래.

### 수 2 — 바닥선을 공유하는 두 칸 (사이트 1)

제목 3줄(6vw, 굵기 400, 자간 -0.02em, 행간 0.9)을 첫 화면 아래 1/3(상단 63%)에 내려 앉히고, 같은 바닥선에 오른쪽 4/12 칸 설명 4줄 + 외곽선 버튼(mono 대문자, 자간 0.2em)을 맞춘다. 위 2/3는 비운다 — 사진이 있으면 한 장, 없으면 짙은 primary 면 위 치수선 SVG. 390: 제목 12vw, 설명·버튼은 제목 아래로.

## 모션 1수

- 카탈로그 id: `svg-draw`
- 관측: Ausvector 로드 애니메이션 `hero-world-reveal` 1200ms·지연 180ms(도면), `hero-copy-reveal` 820ms·지연 80ms(글), 상태점 `pulse-dot` 2800ms 무한. 전환 곡선 `cubic-bezier(0.22, 1, 0.36, 1)` 240ms. FMI는 로드 애니메이션 0개, 전환은 같은 곡선 `cubic-bezier(0.22, 1, 0.36, 1)`로 200~500ms(Lenis 부드러운 스크롤) — 두 사이트가 같은 곡선을 쓴다.
- 적용(M1): 궤도·치수선을 `stroke-dasharray`/`stroke-dashoffset`으로 한 번 그린다 — 900ms, `var(--ease-emphasized)` = `cubic-bezier(0.2, 0, 0, 1)`, 지연 120ms. 대표 연출 1회라 `--duration-enter`(300ms)보다 길지만 페이지당 한 번뿐이다. 글자는 `--duration-enter` 300ms 페이드만. 무한 반복은 상태점 하나(2800ms)만, `use-pause-offscreen`으로 화면 밖·탭 숨김에서 멈춘다.
- reduced-motion: 선을 최종 상태(dashoffset 0)로 바로 그리고, 페이드·펄스 없음.

## 복제하지 않는 것

- 로켓·우주 사진과 영상, 3D 지구 캔버스와 호주 점 지도(이미지·코드)
- 두 회사 로고·워드마크, 「Quality proven…」「Context for intelligent work」 같은 문구
- Manrope — 키트에 이미 있고 지금 레시피와 차이를 못 낸다
- three.js 장면 코드 — 궤도 도면은 우리 SVG로 새로 그린다
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
