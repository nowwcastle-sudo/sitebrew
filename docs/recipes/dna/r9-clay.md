# r9-clay — 말랑 점토 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B(모션만))이 정한 틀은 그대로다: colorLogic **K8** · defaultTheme **light** · motion **M2** · dynamics [split-text, tilt-3d, clip-reveal]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://madie.es/ · 출처 `onepagelove` · Restaurant 선정 · 방문 2026-09-27T09:40Z
  - 1440 넓이 상위 색: `#140A09` 32.1% · `#311614` 31.1% · `#F6EFE6` 9.1% · `#4F2F26` 8.1% · `#694834` 5.5% · `#855B3D` 1.8%
  - 390 넓이 상위 색: `#110607` 37.7% · `#240D0F` 22% · `#3C231C` 11.4% · `#F5EEE5` 9.3%
  - 글자색(글자 수 순): `#F6EFE6` · `#F6F0E6` · `#F5F0E6` · 버튼 바탕: `#F6EFE6` · `#FF99D3`
  - 첫 화면 서체(글자 수 순): cottorway(421) · Inter(171) · dazzle(79)
  - 가장 큰 글자 1440: dazzle, dazzle Fallback · 60px (4.2vw) · 굵기 400 · 자간 normal · 행간 72px · uppercase · 정렬 start
  - 가장 큰 글자 390: dazzle, dazzle Fallback · 36px (9.2vw) · 굵기 400 · 자간 normal · 행간 43.2px · uppercase · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 밝은 바탕 20px 여백 안에 첫 화면이 반경 약 24px의 큰 카드 한 장(어두운 가게 사진). 카드 왼쪽 아래: 별점 줄 → 대문자 제목 3줄(앞 두 줄 외곽선 글자, 마지막 줄 채움) → 설명 3줄 → 분홍 알약 버튼 + 밑줄 mono 링크. 오른쪽 아래 모서리에 원형으로 도는 글자 배지, 오른쪽 위 언어 전환 알약.
  - 모션 관측(1440): 로드 직후 애니메이션 15개(float-soft 6000ms linear d0, reveal-fallback 10ms linear d1400, reveal-fallback 10ms linear d1400 …) · 무한 반복 2개+ · 전환 상위 `color, background-color, border-color, outline-col 0.15s cubic-bezier(0.4, 0, 0.2, 1)`(×30), `opacity, transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1)`(×11) · 라이브러리 흔적 없음 · :hover 규칙 2개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 4/6
- 사이트 2: https://thecozyhollow.ca/ · 출처 `onepagelove` · Accommodation 선정 · 방문 2026-09-27T09:40Z
  - 1440 넓이 상위 색: `#A5C0BA` 32.2% · `#152017` 26% · `#E4EEF3` 19.8% · `#567A73` 11.3% · `#32544D` 5.8% · `#C9D9D6` 2.3%
  - 390 넓이 상위 색: `#151F17` 41.8% · `#A5C0BA` 20.7% · `#E4EEF3` 19.3% · `#577A73` 5.3%
  - 글자색(글자 수 순): `#1D1613` · `#2F4B59` · `#FFFFFF` · 버튼 바탕: `#9E471E`
  - 첫 화면 서체(글자 수 순): Source Sans 3(105)
  - 가장 큰 글자 1440: Source Sans 3, sans-serif · 20px (1.4vw) · 굵기 400 · 자간 normal · 행간 25px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Chewy, system-ui · 40px (10.3vw) · 굵기 300 · 자간 normal · 행간 50px · 대소문자 그대로 · 정렬 start
  - 판독 메모: 로고타입이 그림이라 가장 큰 텍스트는 소개 문장이다. 390에서는 Chewy 40px 제목이 나온다.
  - 구조(스크린샷 판독 + 상자 측정): 첫 화면 전체가 4~5겹 평면 풍경 층(하늘·산·구름·숲·앞 땅·폭포·여우 실루엣), 층마다 한 색. 가운데에 손으로 오린 듯한 두꺼운 로고타입 3줄(글자마다 기울기 다름), 양옆에 녹슨 주황 참나무잎 한 쌍, 아래 한 줄 소개. 우상단 녹슨 주황 알약 버튼.
  - 모션 관측(1440): 로드 직후 애니메이션 15개(moveCloud 75000ms linear d-40000, moveCloud 90000ms linear d-10000, moveCloud 70000ms linear d-25000 …) · 무한 반복 5개+ · 전환 상위 `all 0.3s ease-in-out`(×34), `transform 0.3s ease`(×12) · 라이브러리 흔적 없음 · :hover 규칙 15개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 5/6
- 팔레트: `pal-sns-instagram-dutypk8cchi-5` · https://www.instagram.com/p/DUTyPk8CCHI/ · @the_prodesign · 원 역할 대비 fg/bg 13.49 · 주색 위 글자 10.02

## 팔레트

글자·주색 남색 `#192A56`, 칸 버터 `#F7D794`, 칸 연어 `#EDA8A3`는 팔레트(스플릿) 값 그대로. 가장 채도 높은 칸(peak) 분홍 `#FF8FCF`는 Madie 버튼 `#FF99D3`을 한 단계 진하게, 민트 칸 `#9FD9C4`는 Cozy Hollow 세이지(`#A5C0BA`, C가 K8 문턱 0.05 아래)를 문턱 위로 올린 값. 주 버튼은 남색 채움 + 버터 글자.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F7F8FB` | `oklch(0.9792 0.0041 271.37)` | `#151320` | `oklch(0.1958 0.0260 290.85)` |
| foreground | `#192A56` | `oklch(0.2971 0.0827 265.71)` | `#F4F1F6` | `oklch(0.9619 0.0073 312.30)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#1E1B2B` | `oklch(0.2334 0.0307 292.46)` |
| primary | `#192A56` | `oklch(0.2971 0.0827 265.71)` | `#F7D794` | `oklch(0.8910 0.0919 85.10)` |
| primary-foreground | `#F7D794` | `oklch(0.8910 0.0919 85.10)` | `#192A56` | `oklch(0.2971 0.0827 265.71)` |
| accent | `#FFE6F4` | `oklch(0.9491 0.0327 342.94)` | `#2B2238` | `oklch(0.2727 0.0416 302.52)` |
| accent-foreground | `#3D0012` | `oklch(0.2299 0.0919 10.87)` | `#FFD6EE` | `oklch(0.9176 0.0551 342.26)` |
| muted | `#EEF0F5` | `oklch(0.9550 0.0070 268.55)` | `#1C1A28` | `oklch(0.2269 0.0270 290.63)` |
| muted-foreground | `#3F4A66` | `oklch(0.4115 0.0493 267.67)` | `#BDB8CC` | `oklch(0.7929 0.0285 297.19)` |
| border | `#D3D8E4` | `oklch(0.8820 0.0173 267.78)` | `#34304A` | `oklch(0.3253 0.0458 290.68)` |
| input | `#6E7897` | `oklch(0.5759 0.0493 270.85)` | `#7D7896` | `oklch(0.5879 0.0457 292.58)` |
| ring | `#192A56` | `oklch(0.2971 0.0827 265.71)` | `#F7D794` | `oklch(0.8910 0.0919 85.10)` |
| block-1 | `#FF8FCF` | `oklch(0.7886 0.1536 345.87)` | `#E276B5` | `oklch(0.7071 0.1522 345.68)` |
| block-1-foreground | `#3D0012` | `oklch(0.2299 0.0919 10.87)` | `#2A000C` | `oklch(0.1826 0.0732 7.78)` |
| block-2 | `#F7D794` | `oklch(0.8910 0.0919 85.10)` | `#D9B870` | `oklch(0.7958 0.0986 85.60)` |
| block-2-foreground | `#192A56` | `oklch(0.2971 0.0827 265.71)` | `#192A56` | `oklch(0.2971 0.0827 265.71)` |
| block-3 | `#9FD9C4` | `oklch(0.8396 0.0664 170.29)` | `#7FBBA6` | `oklch(0.7449 0.0694 170.47)` |
| block-3-foreground | `#152017` | `oklch(0.2297 0.0233 149.79)` | `#0E1A12` | `oklch(0.2034 0.0235 154.62)` |
| block-4 | `#EDA8A3` | `oklch(0.7959 0.0824 23.72)` | `#CF8984` | `oklch(0.6998 0.0868 24.01)` |
| block-4-foreground | `#3D0012` | `oklch(0.2299 0.0919 10.87)` | `#2A000C` | `oklch(0.1826 0.0732 7.78)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               13.12 >= 7 PASS
dark  --foreground / --background               16.37 >= 7 PASS
light --card-foreground / --card                13.93 >= 7 PASS
dark  --card-foreground / --card                15.05 >= 7 PASS
light --muted-foreground / --background          8.30 >= 7 PASS
dark  --muted-foreground / --background          9.50 >= 7 PASS
light --muted-foreground / --muted               7.73 >= 4.5 PASS
dark  --muted-foreground / --muted               8.87 >= 4.5 PASS
light --primary / --background                  13.12 >= 4.5 PASS
dark  --primary / --background                  13.18 >= 4.5 PASS
light --primary / --card                        13.93 >= 4.5 PASS
dark  --primary / --card                        12.11 >= 4.5 PASS
light --primary-foreground / --primary          10.02 >= 4.5 PASS
dark  --primary-foreground / --primary          10.02 >= 4.5 PASS
light --accent-foreground / --accent            14.81 >= 4.5 PASS
dark  --accent-foreground / --accent            11.60 >= 4.5 PASS
light --ring / --background                     13.12 >= 3 PASS
dark  --ring / --background                     13.18 >= 3 PASS
light --input / --background                     4.12 >= 3 PASS
dark  --input / --background                     4.36 >= 3 PASS
light --block-1-foreground / --block-1           8.35 >= 4.5 PASS
dark  --block-1-foreground / --block-1           6.79 >= 4.5 PASS
light --block-2-foreground / --block-2          10.02 >= 4.5 PASS
dark  --block-2-foreground / --block-2           7.33 >= 4.5 PASS
light --block-3-foreground / --block-3          10.55 >= 4.5 PASS
dark  --block-3-foreground / --block-3           8.14 >= 4.5 PASS
light --block-4-foreground / --block-4           8.89 >= 4.5 PASS
dark  --block-4-foreground / --block-4           6.85 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 6
- 경고 block-contrast-target: dark block-1-foreground/block-1 6.79 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: dark block-4-foreground/block-4 6.85 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="block-1"] muted-foreground/background 6.28 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-1"] muted-foreground/background 5.54 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="block-4"] muted-foreground/background 6.47 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-4"] muted-foreground/background 5.50 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Madie: dazzle(대문자 제목, 자체·유료 추정) + cottorway + Inter. Cozy Hollow: Source Sans 3(본문) + Chewy(390 제목), 로고타입은 그림.

- 1순위 라틴 디스플레이: **Grandstander**
- 1순위 한글 제목: **Bagel Fat One**
- 본문 한글: Gothic A1(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Grandstander** — OFL 1.1 · Google Fonts · wght 100~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). 장난스럽게 기운 둥근 글자 — 점토를 손끝으로 누른 결. 굵기 축으로 외곽선(가는)·채움(굵은) 줄을 한 가족에서 낸다. 키트에 없다.
2. **Titan One** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 둥글게 부푼 초굵은 대문자 — 외곽선 글자(`-webkit-text-stroke`)에서 획이 안 뭉개진다.
3. **Chewy** — OFL 1.1 · Google Fonts · 10a 후보 풀에 없음. Cozy Hollow가 실제로 싣는 서체 — 더 손맛 쪽.

한글 제목 후보(순위순):

1. **Bagel Fat One** — OFL 1.1 · Google Fonts · 굵기 하나(한글+라틴) · 10a 후보 풀에 있음(기각 표시 없음). 베이글처럼 부푼 극굵은 한글 제목. 키트 Jua보다 더 부풀고 무게가 있다.
2. **Dongle** — OFL 1.1 · Google Fonts · 300·400·700 · 10a 후보 풀에 있음(기각 표시 없음). 키가 낮고 통통한 둥근 고딕 — 앱 화면(pwa) 작은 제목.
3. **Gamja Flower** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 동글동글한 손글씨 — 상세페이지 손메모 한 줄(Cafe24 서체는 10a가 라이선스 전문 미확인으로 기각).

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 여백 액자 속 둥근 카드 + 외곽선·채움 교대 대문자 (사이트 1)

페이지 바탕 위 20px 여백을 남기고 첫 화면을 반경 24px 큰 카드 하나로(사진 또는 block-1 면). 카드 안 왼쪽 아래: 별점 줄 → 대문자 제목 3줄(4.2vw, 행간 1.2) 중 앞 두 줄은 외곽선 글자(`-webkit-text-stroke: 1.5px`, 채움 투명), 마지막 줄만 채움 → 설명 3줄 → block-1 알약 버튼 + 밑줄 mono 링크. 카드 오른쪽 아래 모서리에 원형 회전 글자 배지(SVG `textPath`, 지름 112px). 오른쪽 위 언어 전환 알약(ToggleGroup). 390: 여백 8px, 제목 9.2vw.

### 수 2 — 층층 평면 풍경 + 가운데 뭉툭한 로고타입 (사이트 2)

첫 화면을 4~5겹의 한 색 평면 실루엣 층(하늘 → 먼 산 → 구름 → 숲 → 앞 땅)으로 채우고 층마다 block 색의 명도만 바꾼다. 가운데에 3줄로 쌓은 두꺼운 제목(낱자마다 -4°~+4° 회전), 양옆에 같은 장식 도형 한 쌍(block-4), 아래 한 줄 소개. 머리 오른쪽 끝에 primary 알약 버튼(반경 999px). 390: 층 SVG는 가운데 기준으로 잘린다.

## 모션 1수

- 카탈로그 id: `tilt-3d`
- 관측: Madie `opacity, transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1)`(요소 11개), `transform 0.55s` 같은 곡선, 스크롤 뒤 애니메이션 4 → 12개. Cozy Hollow `transform 0.3s ease`, 측정 요소 6개 중 5개가 스크롤과 다르게 이동(층 시차).
- 적용(M2 — 보드에서 모션만 B): 첫 화면 카드와 로고타입이 포인터를 따라 기울어진다 — `perspective: 800px`, `rotateX/Y` ±6°, 포인터 이동 때 200ms(`--duration-hover` M2) `cubic-bezier(0.2, 0.7, 0.3, 1)`(Madie 관측 곡선), 포인터가 나가면 500ms(`--duration-enter`)로 0°. 마케팅 면(detail·commerce 첫 화면)에만, 앱 화면(pwa 탭)에는 쓰지 않는다. `pointer: coarse`에서 끔.
- reduced-motion: 기울기 없음, hover 때 그림자 한 단계만.

## 복제하지 않는 것

- 가게·풍경 사진과 여우·폭포·잎 일러스트 원본
- Madie·Cozy Hollow 로고, 별점·구글 표시, 「MADELEINES…」 문구
- dazzle·cottorway 서체
- 어두운 초콜릿 사진 바탕을 기본 테마로 — 레시피는 밝은 바탕 K8
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
