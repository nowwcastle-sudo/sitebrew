# r3-woodblock — 네도수 목판 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B 전체)이 정한 틀은 그대로다: colorLogic **K8** · defaultTheme **light** · motion **M2** · dynamics [grain, clip-reveal]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://tabkitchenbakery.com/ · 출처 `onepagelove` · Restaurant 선정 · 방문 2026-09-27T09:31Z
  - 1440 넓이 상위 색: `#E7D4BB` 81.7% · `#606F4E` 7.1% · `#A54D47` 1.9% · `#2E392C` 1.8% · `#D1BFA8` 1% · `#E9AB5F` 0.8%
  - 390 넓이 상위 색: `#E6D5BD` 99.7% · `#354253` 0.1% · `#9D9891` 0% · `#676B71` 0%
  - 글자색(글자 수 순): `#F7E5CD` · `#FFFFFF`
  - 첫 화면 서체(글자 수 순): Inria Serif(90) · Sometype Mono(26)
  - 가장 큰 글자 1440: Inria Serif, Inria Serif Placeholder · 90px (6.3vw) · 굵기 400 · 자간 normal · 행간 108px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Inria Serif, Inria Serif Placeholder · 72px (18.5vw) · 굵기 400 · 자간 normal · 행간 72px · 대소문자 그대로 · 정렬 start · 가로 넘침
  - 판독 메모: 제목 글자는 계산 색이 `#F7E5CD`로 나오지만 화면에는 짙은 초록 잉크로 칠해진다(그림 층 위 합성) — 색은 스크린샷 넓이 값을 따랐다.
  - 구조(스크린샷 판독 + 상자 측정): 제목을 두 줄로 쪼개 첫 줄은 왼쪽 들여 시작, 둘째 줄은 오른쪽 끝에 맞춘다. 두 줄 사이 가운데에 이중 테두리 타원 액자(가게 그림). 좌우 끝에 스텐실 잎 실루엣이 화면 밖으로 잘려 걸친다. 네 모서리 대신 위 좌우 끝에 mono 대문자(가게 이름·동네). 390에서 제목이 18.5vw로 커져 왼쪽으로 넘친다.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 없음 · 라이브러리 흔적 lenis·three·framer·viewTimeline · :hover 규칙 9개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 4/4
- 사이트 2: https://www.counter-print.co.uk/ · 출처 `httpster` · Ecommerce 선정 · 방문 2026-09-27T09:32Z
  - 1440 넓이 상위 색: `#FEFEFE` 24.6% · `#ECECEB` 23.9% · `#82B4CA` 7.6% · `#F5CE80` 4.6% · `#0D0B0A` 4.4% · `#D9D5D2` 4.2%
  - 390 넓이 상위 색: `#ECEBEA` 25.3% · `#FFFFFF` 18.7% · `#82B4CA` 8.2% · `#F5CD7F` 4.7%
  - 글자색(글자 수 순): `#1C1C1C`
  - 첫 화면 서체(글자 수 순): Helvetica(44)
  - 가장 큰 글자 1440: Helvetica, Arial · 20px (1.4vw) · 굵기 700 · 자간 -0.499875px · 행간 23.994px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Helvetica, Arial · 15px (3.8vw) · 굵기 700 · 자간 -0.375px · 행간 18px · 대소문자 그대로 · 정렬 start
  - 판독 메모: 가장 큰 글자가 머리 줄 20px 굵기 700 — 이 사이트는 첫 화면 제목을 일부러 작게 두고 사진 두 칸이 주인이다.
  - 구조(스크린샷 판독 + 상자 측정): 12칸 격자, 첫 화면을 큰 상품 사진 칸 두 장(각 49% × 78%, 간격 8px, 반경 0)이 나란히 채우고 칸 밑 왼쪽에 작은 캡션. 제목은 머리 줄 20px 굵기 700뿐. 그 아래 6칸 상품 줄, 알약 「View all」 하나(반경 9999px).
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `opacity, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`(×56), `transform 0.28s cubic-bezier(0.5, 0, 0.4, 1)`(×3) · 라이브러리 흔적 viewTimeline · :hover 규칙 8개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/6
- 팔레트: `pal-sns-threads-ddbj6vadbvk-2` · https://www.threads.com/@suraj.dsgn/post/DdBJ6VaDbVk · @suraj.dsgn · 원 역할 대비 fg/bg 13.57 · 주색 위 글자 5.18

## 팔레트

먹 `#2E2910`·주홍 칸 `#EB7D00`·짙은 초록 주색 `#2C5745`는 팔레트(레트로·햇살) 값 그대로. 벽돌 칸 `#A54D47`은 Tab Kitchen 넓이 3위(1.9%), 하늘 칸 `#82B4CA`는 Counter-Print 넓이 3위(7.6%) 그대로. Tab Kitchen의 베이지 바탕 `#E7D4BB`(81.7%)는 크림 금지라 쓰지 않고 초록 기운 종이 `#F1F2E8`로 바꿨다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F1F2E8` | `oklch(0.9576 0.0133 111.27)` | `#16170F` | `oklch(0.2006 0.0153 113.58)` |
| foreground | `#2E2910` | `oklch(0.2798 0.0405 98.23)` | `#EEF0E4` | `oklch(0.9503 0.0160 114.38)` |
| card | `#F9FAF3` | `oklch(0.9824 0.0093 113.16)` | `#1F2017` | `oklch(0.2393 0.0165 112.80)` |
| primary | `#2C5745` | `oklch(0.4198 0.0573 164.73)` | `#9CC9A8` | `oklch(0.7947 0.0665 152.94)` |
| primary-foreground | `#F1F2E8` | `oklch(0.9576 0.0133 111.27)` | `#16170F` | `oklch(0.2006 0.0153 113.58)` |
| accent | `#E2E9D8` | `oklch(0.9241 0.0238 125.20)` | `#2A2C20` | `oklch(0.2871 0.0212 115.44)` |
| accent-foreground | `#2E2910` | `oklch(0.2798 0.0405 98.23)` | `#EEF0E4` | `oklch(0.9503 0.0160 114.38)` |
| muted | `#E7E9DC` | `oklch(0.9289 0.0174 113.83)` | `#22241A` | `oklch(0.2548 0.0183 116.90)` |
| muted-foreground | `#48442C` | `oklch(0.3838 0.0382 99.88)` | `#BFC2AC` | `oklch(0.8056 0.0303 113.38)` |
| border | `#C8CBB6` | `oklch(0.8340 0.0288 113.62)` | `#3A3C2C` | `oklch(0.3492 0.0267 113.58)` |
| input | `#74785E` | `oklch(0.5619 0.0388 114.77)` | `#7E826A` | `oklch(0.5964 0.0355 115.17)` |
| ring | `#2C5745` | `oklch(0.4198 0.0573 164.73)` | `#9CC9A8` | `oklch(0.7947 0.0665 152.94)` |
| block-1 | `#2F6146` | `oklch(0.4494 0.0707 158.16)` | `#2F6146` | `oklch(0.4494 0.0707 158.16)` |
| block-1-foreground | `#F4F6EC` | `oklch(0.9689 0.0134 115.83)` | `#F4F6EC` | `oklch(0.9689 0.0134 115.83)` |
| block-2 | `#EB7D00` | `oklch(0.6998 0.1702 56.53)` | `#D07000` | `oklch(0.6419 0.1542 57.67)` |
| block-2-foreground | `#1F1A08` | `oklch(0.2186 0.0316 94.21)` | `#16170F` | `oklch(0.2006 0.0153 113.58)` |
| block-3 | `#82B4CA` | `oklch(0.7424 0.0615 227.04)` | `#3D6E85` | `oklch(0.5132 0.0644 230.06)` |
| block-3-foreground | `#14232B` | `oklch(0.2465 0.0255 232.49)` | `#F2F8FB` | `oklch(0.9755 0.0075 228.85)` |
| block-4 | `#A54D47` | `oklch(0.5300 0.1176 25.80)` | `#8E3F3A` | `oklch(0.4707 0.1086 25.73)` |
| block-4-foreground | `#FFF7F0` | `oklch(0.9804 0.0127 63.93)` | `#FFF7F0` | `oklch(0.9804 0.0127 63.93)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               12.91 >= 7 PASS
dark  --foreground / --background               15.66 >= 7 PASS
light --card-foreground / --card                13.88 >= 7 PASS
dark  --card-foreground / --card                14.26 >= 7 PASS
light --muted-foreground / --background          8.70 >= 7 PASS
dark  --muted-foreground / --background          9.91 >= 7 PASS
light --muted-foreground / --muted               7.99 >= 4.5 PASS
dark  --muted-foreground / --muted               8.63 >= 4.5 PASS
light --primary / --background                   7.28 >= 4.5 PASS
dark  --primary / --background                   9.74 >= 4.5 PASS
light --primary / --card                         7.82 >= 4.5 PASS
dark  --primary / --card                         8.87 >= 4.5 PASS
light --primary-foreground / --primary           7.28 >= 4.5 PASS
dark  --primary-foreground / --primary           9.74 >= 4.5 PASS
light --accent-foreground / --accent            11.72 >= 4.5 PASS
dark  --accent-foreground / --accent            12.31 >= 4.5 PASS
light --ring / --background                      7.28 >= 3 PASS
dark  --ring / --background                      9.74 >= 3 PASS
light --input / --background                     4.05 >= 3 PASS
dark  --input / --background                     4.55 >= 3 PASS
light --block-1-foreground / --block-1           6.59 >= 4.5 PASS
dark  --block-1-foreground / --block-1           6.59 >= 4.5 PASS
light --block-2-foreground / --block-2           6.17 >= 4.5 PASS
dark  --block-2-foreground / --block-2           5.16 >= 4.5 PASS
light --block-3-foreground / --block-3           7.15 >= 4.5 PASS
dark  --block-3-foreground / --block-3           5.20 >= 4.5 PASS
light --block-4-foreground / --block-4           5.28 >= 4.5 PASS
dark  --block-4-foreground / --block-4           6.78 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 14
- 경고 block-contrast-target: light block-1-foreground/block-1 6.59 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: light block-2-foreground/block-2 6.17 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: light block-4-foreground/block-4 5.28 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: dark block-1-foreground/block-1 6.59 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: dark block-2-foreground/block-2 5.16 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: dark block-3-foreground/block-3 5.20 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 block-contrast-target: dark block-4-foreground/block-4 6.78 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="block-1"] muted-foreground/background 5.65 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-1"] muted-foreground/background 5.65 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="block-2"] muted-foreground/background 6.17 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-2"] muted-foreground/background 5.16 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-3"] muted-foreground/background 5.20 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="block-4"] muted-foreground/background 5.28 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="block-4"] muted-foreground/background 6.78 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Tab Kitchen: Inria Serif 400(제목 90px) + Sometype Mono(머리 라벨), Shrikhand·Bayon도 싣는다. Counter-Print: Helvetica 하나(시스템).

- 1순위 라틴 디스플레이: **Young Serif**
- 1순위 한글 제목: **Song Myung**
- 본문 한글: Noto Sans KR(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Young Serif** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 두툼하고 따뜻한 올드 세리프 — 목활자로 찍은 메뉴판 결. 큰 글자와 가격 숫자에. 키트에 없다.
2. **Shrikhand** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Tab Kitchen이 실제로 싣는 70년대 굵은 기울임 레터링 — 가게 이름 한 단어에만.
3. **Sometype Mono** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Tab Kitchen 머리 라벨 서체 — 메뉴 번호·동네 이름 라벨.

한글 제목 후보(순위순):

1. **Song Myung** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 목판 송체의 날카로운 부리 — 목판 글자에 가장 가깝다. 키트의 Black Han Sans(굵은 고딕)와 반대 결.
2. **Gugi** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 곧은 선으로 짠 옛 간판 — 동네 가게 제목 하나에만.
3. **Yeon Sung** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 옛 붓 간판을 닮은 글씨 — 손맛을 더 세게 낼 때.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 엇갈린 두 줄 + 가운데 타원 액자 (사이트 1)

제목을 두 줄로 쪼개 첫 줄은 왼쪽 2/12에서 시작, 둘째 줄은 오른쪽 10/12 끝에 맞춘다. 두 줄 사이 가운데에 가로 45vw 타원 액자(`border-radius: 50%`, 2px + 6px 이중 테두리 foreground) 안에 메뉴·가게 사진. 화면 좌우 끝에 block 색 한 색 실루엣(잎·도구 SVG)을 30%쯤 화면 밖으로 잘라 걸친다. 머리는 위 좌우 끝 mono 대문자 두 개뿐. 390: 제목 18vw로 키워 왼쪽 넘침, 타원 폭 80vw.

### 수 2 — 나란한 큰 칸 두 장 + 칸 밑 캡션 (사이트 2)

첫 화면을 12칸 격자 전체 폭의 칸 두 장(각 6칸, 높이 78vh, 간격 8px, 반경 0)으로 채운다. 왼쪽 칸 바탕 block-3(하늘), 오른쪽 칸 바탕 block-2(주홍) 위에 상품·메뉴 사진을 올리고, 칸 밑 왼쪽에 14px 캡션 한 줄. 제목은 머리 줄에 작게(20px 굵기 700)만 — 첫 화면의 주인은 두 칸의 색과 사진이다. 390: 두 칸이 세로로(각 44vh).

## 모션 1수

- 카탈로그 id: `grain`
- 관측: Tab Kitchen은 로드 애니메이션 0개, 스크롤에서 잎·액자 층이 따로 움직인다(측정 요소 4개 중 4개가 스크롤 양과 다르게 이동 — 시차). Counter-Print는 hover `opacity, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`, 390에서 사진이 `opacity 300ms`로 뜬다.
- 적용(M2): 종이 바탕과 block 칸 위에 `feTurbulence`(baseFrequency 0.8, numOctaves 2) 그레인을 `mix-blend-mode: multiply`, 불투명도 0.12로 깐다 — 그레인 자체는 정지 기법이다. 움직이는 부분은 하나: block 칸 hover 때 turbulence `seed`를 두 값 사이에서 `steps(2)` 160ms로 한 번 바꿔 「다시 찍힌」 결을 낸다. 칸 등장은 공용 `wf-fade-rise`(M2 500ms, `cubic-bezier(0.23, 1, 0.32, 1)`).
- reduced-motion: seed 고정(정지 그레인만 남음), 칸은 바로 보인다.

## 복제하지 않는 것

- Tab Kitchen의 가게 그림·스텐실 잎 원본, Counter-Print 책 표지 사진
- 두 가게 이름·로고·문구
- 베이지 바탕 `#E7D4BB` — 크림 금지(§13)라 초록 기운 종이로 바꿨다
- Framer 코드와 시차 스크롤 구현
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
