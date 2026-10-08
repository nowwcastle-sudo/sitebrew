# r7-docs — 문서 작업대 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B 전체)이 정한 틀은 그대로다: colorLogic **K6** · defaultTheme **light** · motion **M2** · dynamics [view-transition, sticky-stack]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://www.mintlify.com/ · 출처 `lapaninja` · editorial 선정 · 방문 2026-09-27T09:37Z
  - 1440 넓이 상위 색: `#090B0C` 92.3% · `#10241C` 2.2% · `#FEFEFE` 1.4% · `#12442C` 0.4% · `#414343` 0.3% · `#145F3E` 0.2%
  - 390 넓이 상위 색: `#090C0C` 86.9% · `#FEFEFD` 3.2% · `#13221C` 2.4% · `#444545` 0.6%
  - 글자색(글자 수 순): `#FFFFFF` · `#18E299` · `#FAF8F5` · 버튼 바탕: `#08090A` · `#FFFFFF` · `#121715`
  - 첫 화면 서체(글자 수 순): inter(261) · paperMono(130) · arizonaFlare(44)
  - 가장 큰 글자 1440: arizonaFlare, arizonaFlare Fallback · 50px (3.5vw) · 굵기 400 · 자간 -2px · 행간 52px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: arizonaFlare, arizonaFlare Fallback · 40px (10.3vw) · 굵기 400 · 자간 -0.8px · 행간 44px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 24칸 격자(칸 30px, 간격 16px, 가운데 76%). 왼쪽: 윤곽 칩(라벨 + 초록 mono 수치) → 세리프 제목 3줄 → 부제 2줄(핵심 낱말만 흰색) → 버튼 2개. 문서 앱 패널(사이드바 + 본문 카드 2×2)이 가로 41%·세로 51%에서 시작해 오른쪽·아래 끝으로 잘려 나간다. 뒤로 가는 초록 선 곡선 다발이 지나간다.
  - 모션 관측(1440): 로드 직후 애니메이션 12개(transform 700ms cubic-bezier(0.22, 1, 0.36, 1) d0, stats-scroll 40000ms linear d0, carousel-card-dim automs linear d0 …) · 무한 반복 3개+ · 전환 상위 `transform, translate, scale, rotate 0.7s cubic-bezier(0.22, 1, 0.36, 1)`(×62), `opacity 0.15s cubic-bezier(0, 0, 0.2, 1)`(×58) · 라이브러리 흔적 viewTimeline · :hover 규칙 5개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/3
- 사이트 2: https://fibery.io/ · 출처 `saaslandingpage` · editorial 선정 · 방문 2026-09-27T09:38Z
  - 1440 넓이 상위 색: `#FAEBD7` 65.8% · `#FFFEFC` 23.7% · `#251D1A` 3.2% · `#F6D3A0` 2% · `#F4DBC3` 1.8% · `#E9F1ED` 0.3%
  - 390 넓이 상위 색: `#FAEBD7` 64% · `#FEFDFA` 15.3% · `#251D1A` 8.6% · `#F6D3A0` 4.6%
  - 글자색(글자 수 순): `#251D1A` · `#C17B58` · `#FAEBD6` · 버튼 바탕: `#251D1A` · `#FDF7EF` · `#F6D3A0`
  - 첫 화면 서체(글자 수 순): Suisse Intl(346) · Fraunces(36)
  - 가장 큰 글자 1440: Suisse Intl, sans-serif · 64px (4.4vw) · 굵기 800 · 자간 normal · 행간 64px · 대소문자 그대로 · 정렬 left
  - 가장 큰 글자 390: Suisse Intl, sans-serif · 46px (11.8vw) · 굵기 800 · 자간 normal · 행간 46px · 대소문자 그대로 · 정렬 left
  - 구조(스크린샷 판독 + 상자 측정): 12칸 중 왼쪽 4칸에 두꺼운 제목 4줄 + 설명 3줄 + 버튼 2개(먹 채움 + 외곽선, 반경 6px). 오른쪽 8칸에 반경 16px 앱 창(사이드바 트리 + 캔버스), 그 위에 창 폭 그대로의 탠 알약 공지 한 줄.
  - 모션 관측(1440): 로드 직후 애니메이션 5개(FormulasAnimated_bgRightOne__hcskt 57900ms linear d0, FormulasAnimated_bgLeftTwo__ISsU8 69000ms linear d0, FormulasAnimated_bgRightThree__4o6a4 60000ms linear d0 …) · 무한 반복 5개+ · 전환 상위 `all 0.3s ease`(×144), `all 0.1s linear`(×76) · 라이브러리 흔적 없음 · :hover 규칙 66개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/5
- 팔레트: `pal-sns-instagram-dwih2ynktud-1` · https://www.instagram.com/p/DWih2yNkTuD/ · @intentional_design_lab · 원 역할 대비 fg/bg 14.4 · 주색 위 글자 7.62

## 팔레트

글자 `#051F20`·주색 `#235347`·accent `#DAF1DE`·다크 주색 `#8EB69B`는 팔레트(초록 단색 사다리) 값 그대로. 면(field-1) 칠판 청록 `#00664C`는 팔레트 `#235347`를 K6 짙은 면 대역(C 0.08 이상)으로 올린 값이고 Mintlify 초록(`#12442C`·`#145F3E`)과 같은 자리. 다크 바탕 `#0B0E0D`는 Mintlify 넓이 1위 `#090B0C`(92.3%) 계열. Fibery의 크림 바탕 `#FAEBD7`은 크림 금지라 쓰지 않는다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F6F8F6` | `oklch(0.9771 0.0034 145.55)` | `#0B0E0D` | `oklch(0.1599 0.0053 173.58)` |
| foreground | `#051F20` | `oklch(0.2199 0.0317 198.63)` | `#E8EEEA` | `oklch(0.9434 0.0083 157.09)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#121716` | `oklch(0.1989 0.0079 182.06)` |
| primary | `#235347` | `oklch(0.4050 0.0564 174.64)` | `#8EB69B` | `oklch(0.7395 0.0580 155.23)` |
| primary-foreground | `#F6F8F6` | `oklch(0.9771 0.0034 145.55)` | `#0B0E0D` | `oklch(0.1599 0.0053 173.58)` |
| accent | `#DAF1DE` | `oklch(0.9361 0.0351 150.54)` | `#16231F` | `oklch(0.2426 0.0197 173.53)` |
| accent-foreground | `#051F20` | `oklch(0.2199 0.0317 198.63)` | `#DAF1DE` | `oklch(0.9361 0.0351 150.54)` |
| muted | `#ECF0ED` | `oklch(0.9513 0.0058 153.77)` | `#141A18` | `oklch(0.2108 0.0098 173.15)` |
| muted-foreground | `#384945` | `oklch(0.3894 0.0226 179.08)` | `#AFBDB6` | `oklch(0.7855 0.0183 164.52)` |
| border | `#CDD5D1` | `oklch(0.8657 0.0102 164.83)` | `#26302C` | `oklch(0.2983 0.0155 169.05)` |
| input | `#6C7B76` | `oklch(0.5690 0.0193 173.56)` | `#71807A` | `oklch(0.5857 0.0198 169.62)` |
| ring | `#1B7A5E` | `oklch(0.5189 0.0962 168.14)` | `#5BD69A` | `oklch(0.7906 0.1408 159.32)` |
| field-1 | `#00664C` | `oklch(0.4531 0.0919 167.84)` | `#005C44` | `oklch(0.4215 0.0857 167.62)` |
| field-1-foreground | `#EAF7EF` | `oklch(0.9642 0.0173 159.12)` | `#E8F7EE` | `oklch(0.9625 0.0198 159.76)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               16.09 >= 7 PASS
dark  --foreground / --background               16.48 >= 7 PASS
light --card-foreground / --card                17.17 >= 7 PASS
dark  --card-foreground / --card                15.39 >= 7 PASS
light --muted-foreground / --background          8.92 >= 7 PASS
dark  --muted-foreground / --background          9.95 >= 7 PASS
light --muted-foreground / --muted               8.27 >= 4.5 PASS
dark  --muted-foreground / --muted               9.05 >= 4.5 PASS
light --primary / --background                   8.20 >= 4.5 PASS
dark  --primary / --background                   8.60 >= 4.5 PASS
light --primary / --card                         8.75 >= 4.5 PASS
dark  --primary / --card                         8.03 >= 4.5 PASS
light --primary-foreground / --primary           8.20 >= 4.5 PASS
dark  --primary-foreground / --primary           8.60 >= 4.5 PASS
light --accent-foreground / --accent            14.40 >= 4.5 PASS
dark  --accent-foreground / --accent            13.61 >= 4.5 PASS
light --ring / --background                      4.93 >= 3 PASS
dark  --ring / --background                     10.65 >= 3 PASS
light --input / --background                     4.16 >= 3 PASS
dark  --input / --background                     4.68 >= 3 PASS
light --field-1-foreground / --field-1           6.34 >= 4.5 PASS
dark  --field-1-foreground / --field-1           7.26 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 3
- 경고 field-contrast-target: light field-1-foreground/field-1 6.34 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="field-1"] muted-foreground/background 5.62 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="field-1"] muted-foreground/background 6.39 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Mintlify: arizonaFlare(ABC Dinamo, 유료 세리프 제목 50px) + Inter + paperMono(라벨). Fibery: Suisse Intl 800(유료, 제목 64px) + Fraunces를 싣는다.

- 1순위 라틴 디스플레이: **Besley**
- 1순위 한글 제목: **NanumSquareRound**
- 본문 한글: Pretendard(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Besley** — OFL 1.1 · Google Fonts · wght 400~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). 클라렌던 계열 두툼한 세리프 — Fibery가 싣는 Fraunces(10a가 AI 과다 사용으로 기각) 자리의 부드러운 무게. 문서 제목·표지에. 키트에 없다.
2. **Libre Caslon Display** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Arizona Flare처럼 가늘고 섬세한 제목 — 더 차가운 대안(Instrument Serif는 10a 기각).
3. **Monaspace Xenon** — OFL 1.1 · Fontsource(GitHub Monaspace) · 10a 후보 풀에 있음(기각 표시 없음). 슬랩 고정폭 — paperMono 자리, 칩 수치·코드 경로.

한글 제목 후보(순위순):

1. **NanumSquareRound** — OFL 1.1 · 네이버 CDN · 10a 후보 풀에 있음(기각 표시 없음). 네모틀에 둥근 모서리 — 문서 제목이 친절하고, 키트 Gothic A1과 다르다.
2. **Gowun Batang** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Besley 제목과 짝을 맞춘 한글 바탕 — 긴 문서 표지에만.
3. **Nanum Gothic Coding** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 고정폭 한글 — 코드 주석·경로 라벨.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 수치 칩 + 세리프 3줄 + 아래로 새는 문서 패널 (사이트 1)

24칸 격자(칸 30px·간격 16px, 가운데 76%)에서 왼쪽 7칸: 윤곽 칩 1개(라벨 + mono 수치를 field-1 색 글자로) → 세리프 제목 3줄(3.5vw, 굵기 400, 자간 -0.04em) → 부제 2줄(핵심 낱말만 foreground, 나머지 muted-foreground) → 버튼 2개. 문서 앱 패널(Card: 사이드바 목록 + 본문 카드 2×2)을 가로 41%·세로 51%에서 시작해 오른쪽·아래 화면 끝으로 잘려 나가게 둔다. 패널 뒤로 1px 선 곡선 다발 SVG(field-1 명도 3단계)가 가로지른다. 390: 패널 폭 150%로 오른쪽 잘림.

### 수 2 — 4칸 두꺼운 제목 + 8칸 앱 창 + 창 위 공지 알약 (사이트 2)

12칸 중 왼쪽 4칸에 두꺼운 제목 4줄(4.4vw, 굵기 800, 행간 1.0) + 설명 3줄 + 버튼 2개(채움 + 외곽선, 반경 6px). 오른쪽 8칸은 반경 16px 앱 창 카드(사이드바 트리 + 캔버스) 한 장, 그 위에 창과 같은 폭의 accent 알약 공지 한 줄(아이콘 + 문장 + 화살표). 390: 제목 11.8vw, 앱 창은 제목 아래 전폭.

## 모션 1수

- 카탈로그 id: `sticky-stack`
- 관측: Mintlify 요소 62개에 `transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)`, 로드 애니메이션 14개. Fibery `all 0.3s ease`.
- 적용(M2): 문서 섹션 카드가 스크롤에서 위에 붙으며 겹쳐 쌓인다 — `position: sticky; top: calc(96px + n × 12px)`. 새 카드가 올라오면 뒤 카드가 `scale(0.97)` + 바탕 한 단계 어둡게, 500ms(`--duration-enter` M2) `cubic-bezier(0.22, 1, 0.36, 1)`(Mintlify 관측 곡선). 지원 브라우저는 `animation-timeline: view()`로 스크롤에 묶는다.
- reduced-motion: sticky 쌓임(위치)만 남기고 scale·명도 전환 없음.

## 복제하지 않는 것

- 두 제품의 앱 스크린샷·영상, 선 곡선 캔버스 코드
- 로고와 「The knowledge infrastructure…」「Operating system for orgs…」 문구
- Arizona Flare·Suisse Intl·paperMono 서체 파일
- Fibery 크림 바탕 `#FAEBD7`(크림 금지)
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
