# r15-atelier — 아틀리에 지면 · 레퍼런스 DNA 카드

> 이 카드는 레시피(DESIGN.md)가 이미 있는 뒤에 쓴 사후 기록이다 — 레퍼런스 실측과 레시피가 실제로 쓰는 값을 나란히 적고, 어디가 같고 어디가 다른지 밝힌다. 레시피 값을 이 카드가 바꾸지 않는다.
> 레시피 틀(DESIGN.md 에서 읽음): colorLogic **K5** · defaultTheme 명시 없음(라이트가 기본) · motion **M3** · dynamics [clip-reveal, magnetic-cta] · hero `ken-burns-stills` · axes texture **X1**(그레인) · 원형 brand·commerce. 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다는 기록이 DESIGN.md 에 있다.
> 측정: headless Chrome(CDP)으로 첫 화면 1440×900과 390×844, 요청 사이 10초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 임시 폴더)에만 있다.

## 출처

- 사이트 1: https://www.seedlipdrinks.com/en-us · 출처 `httpster` · refs-v2 카드(commerce·색 논리 K5) 수록 — 이번 방문에서 쿠키 동의 창이 가운데 위쪽을 덮었다(누르지 않았다, 아래 색 넓이의 `#FFFFFF` 13.2%·390 의 34.1% 는 이 창이다) · 방문 2026-10-11T14:35Z
  - 1440 넓이 상위 색: `#FFFFFF` 13.2% · `#1A0401` 7.9% · `#05100B` 7.4% · `#170301` 6.9% · `#230802` 4.8% · `#574B35` 3.9%
  - 390 넓이 상위 색: `#FFFFFF` 34.1% · `#05100B` 5.4% · `#000000` 4.4% · `#422513` 2.8% · `#270F06` 2.7% · `#3C2111` 2.6%
  - 글자색(글자 수 순): `#696969` · `#FFFFFF` · `#154734` · 버튼 바탕: `#000000` · `#FFFFFF`
  - 첫 화면 서체(글자 수 순): ui-sans-serif(245) · Material Symbols Rounded(111) · brCandor(110)
  - 가장 큰 글자 1440: mollieGlaston · 88px (6.1vw) · 굵기 400 · 자간 normal · 행간 79.2px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: mollieGlaston · 48px (12.3vw) · 굵기 400 · 자간 normal · 행간 43.2px · 대소문자 그대로 · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 맨 위 공지 띠(세로 0~7%, 짙은 녹색)와 그 아래 영상(세로 7~96%)이 첫 화면 전면을 채우고 영상 위를 어두운 붉은 갈색 막이 덮는다. 내비가 영상 위에 겹쳐(세로 11~16%) 햄버거·굵은 대문자 링크·아이콘 셋이 한 줄. 제목 한 줄이 왼쪽(left 80px, 가로 5.6%)에서 세로 39~47%, 한 줄 부제 세로 약 52%, 외곽선 단추(폭 170px)가 세로 59~64%. 영상 상자의 왼쪽 아래 모서리만 크게 둥글고, 왼쪽 아래에 작은 별 단추가 떠 있다. 쿠키 창(650×287, x 402~1052, 세로 10~42%)이 내비와 제목 위쪽을 덮었다. 390: 로고가 가운데, 제목 가운데 정렬 세로 20~25%, 부제 28%, 단추가 창 뒤에 일부 가려지고 창이 세로 35~78%를 덮었다.
  - 모션 관측(1440): 로드 직후 애니메이션 1개(fade-in-up-10 1000ms linear) · 무한 반복 0개 · 전환 상위 `all`(×742), `0.1s linear`(×27) · 라이브러리 흔적 next, video(4) · :hover 규칙 77개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 32/64
- 사이트 2: https://www.brinkerhoffpoetry.org/ · 출처 `httpster` · refs-v2 카드(brand·색 논리 K5) 수록 · 방문 2026-10-11T14:37Z
  - 1440 넓이 상위 색: `#231B1D` 50.5% · `#DADADA` 12.9% · `#D5D5D7` 4.9% · `#D6D6D8` 3.5% · `#E1E1E1` 2.4% · `#CDD0D1` 1.2%
  - 390 넓이 상위 색: `#231B1D` 43.1% · `#DDDDDD` 14.9% · `#D6D6D8` 4.7% · `#D0D3D5` 4.7% · `#E1E1E1` 2.5% · `#CFD2D3` 1.3%
  - 글자색(글자 수 순): `#F3EFEB` · 버튼 바탕: 측정 안 됨(버튼 요소 0개)
  - 첫 화면 서체(글자 수 순): AdrianText(18) · AdrianFine(13)
  - 가장 큰 글자 1440: AdrianFine · 70px (4.9vw) · 굵기 400 · 자간 normal · 행간 75px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: AdrianFine · 30px (7.7vw) · 굵기 400 · 자간 normal · 행간 35px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 짙은 갈색 먹 바탕 `#231B1D`(50.5%)에 머리줄(세로 5~11%: 로고와 재단 이름이 왼쪽, 검색·메뉴 아이콘이 오른쪽 끝)이 있다. 사진 한 장이 가로 29%~95%(폭 951px)·세로 18~92%를 차지하고, 세리프 제목 한 줄이 왼쪽 75px 에서 세로 48~54%에 앉아 끝 두 글자가 사진 왼쪽 가장자리(x 414)를 74px 넘어 사진 위로 겹친다. 왼쪽 아래(세로 약 90%)에 밑줄 있는 작은 대문자 링크 하나. 단추·그림 장식은 없다. 390: 머리줄 아래 제목(세로 16%)과 링크(22%)가 먼저 오고, 사진이 폭 86%(x 28~362)로 세로 30~95%를 채운다.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0개 · 전환 상위 `all`(×486), `transform 0.3s ease-in-out, -webkit-transform 0.3s ease-in-out`(×35) · 라이브러리 흔적 없음 · :hover 규칙 23개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 28/33
- 팔레트: `pal-sns-instagram-dczkq5lj4rj-2` · https://www.instagram.com/p/DcZkq5lj4RJ/ · @dopely.colors · 원 역할 대비 fg/bg 13.65 · 주색 위 글자 6.14

## 팔레트

색 논리는 K5(에디토리얼 럭셔리)이고 defaultTheme 은 머리에 없어 라이트가 기본이다. 따뜻한 지면 + 깊은 단색 주색 하나(라이트는 에스프레소 갈색, 다크는 세이지) + 재료에서 온 보조색 하나(세이지)다. 테라코타·붉은 갈색은 더하지 않는다(DESIGN.md).

**팔레트와의 관계(솔직히).** 위 SNS 팔레트 `pal-sns-instagram-dczkq5lj4rj-2`(바탕 `#F3F0EA` · 글자 `#242424` · 주색 `#7A4F3A`, 갤러리 럭셔리 계열)는 「가장 가까운 SNS 팔레트로 기록」한 것이고 레시피 색은 이 팔레트에서 직접 가져온 것이 아니다 — 레시피 색은 refs-v2 색 논리 K 값에서 왔다. OKLab 거리(SNS 팔레트 `pal-sns-instagram-dczkq5lj4rj-2` 의 같은 역할 색 ↔ 레시피의 가까운 쪽 모드): 바탕 0.020(라이트 쪽이 가까움) · 글자 0.072(라이트 쪽이 가까움) · 주색 0.142(라이트 쪽이 가까움) — 0 이 같은 색이고 흰색↔검정이 약 1 이다. 바탕은 둘 다 따뜻한 오프화이트라 가깝다(0.020). 주색은 팔레트가 붉은 갈색(색상각 46.7°, 채도 0.067)이고 레시피는 짙은 에스프레소(색상각 50°, 채도 0.045)로 명도·채도가 달라 거리가 가장 크다(0.142). 팔레트의 `#C3A78E`(밝은 갈색)는 레시피에 대응이 없다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F8F7F4` | `oklch(0.9750 0.0040 85.00)` | `#140E0B` | `oklch(0.1700 0.0120 50.00)` |
| foreground | `#19120D` | `oklch(0.1900 0.0150 55.00)` | `#F1EEE9` | `oklch(0.9500 0.0080 85.00)` |
| card | `#FEFDFB` | `oklch(0.9950 0.0030 85.00)` | `#1E1713` | `oklch(0.2100 0.0140 50.00)` |
| primary | `#482E20` | `oklch(0.3300 0.0450 50.00)` | `#ABC89B` | `oklch(0.8000 0.0700 135.00)` |
| primary-foreground | `#FAF8F4` | `oklch(0.9800 0.0060 85.00)` | `#0B1209` | `oklch(0.1700 0.0200 140.00)` |
| secondary | `#EFECE8` | `oklch(0.9450 0.0060 85.00)` | `#28201B` | `oklch(0.2500 0.0150 50.00)` |
| accent | `#CBDFC1` | `oklch(0.8800 0.0450 135.00)` | `#3A2A20` | `oklch(0.3000 0.0300 50.00)` |
| accent-foreground | `#172614` | `oklch(0.2500 0.0400 140.00)` | `#F1EEE9` | `oklch(0.9500 0.0080 85.00)` |
| muted | `#F0EEEA` | `oklch(0.9500 0.0060 85.00)` | `#28201B` | `oklch(0.2500 0.0150 50.00)` |
| muted-foreground | `#4B433D` | `oklch(0.3900 0.0150 60.00)` | `#B7B0A7` | `oklch(0.7600 0.0150 75.00)` |
| border | `#D7D4CE` | `oklch(0.8700 0.0080 85.00)` | `#3E332C` | `oklch(0.3300 0.0200 50.00)` |
| input | `#6B6157` | `oklch(0.5000 0.0200 70.00)` | `#716158` | `oklch(0.5050 0.0250 50.00)` |
| ring | `#482E20` | `oklch(0.3300 0.0450 50.00)` | `#ABC89B` | `oklch(0.8000 0.0700 135.00)` |

`*` 가 붙은 hex 는 sRGB 범위 밖이라 채널을 잘라 낸 근사값이다(OKLCH 값이 정본). 표는 DESIGN.md `color` 의 값을 그대로 옮겼다(상태색 생략).

레시피 머리 색을 `factory/scripts/lib/contrast-lib.mjs` 의 `ratio`(`node factory/scripts/contrast.mjs` 가 쓰는 같은 함수)로 직접 계산한 WCAG 대비:

| 쌍 | 라이트 | 다크 | 기준 |
|---|---|---|---|
| foreground / background | 17.21 PASS | 16.55 PASS | ≥ 7 |
| muted-foreground / background | 8.97 PASS | 8.91 PASS | ≥ 7 |
| primary / background | 11.53 PASS | 10.48 PASS | ≥ 4.5 |
| primary-foreground / primary | 11.70 PASS | 10.43 PASS | ≥ 4.5 |
| ring / background | 11.53 PASS | 10.48 PASS | ≥ 3 |

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 레시피 lint 의 팔레트 금지 검사가 위반 0 으로 통과한다(아래 lint 줄). 크림 바탕 금지는 DESIGN.md 에 오프화이트 채도 0.012 이하로 적혀 있고 라이트 바탕 채도는 0.004 다.
색 논리 lint 와 레시피 lint(`recipe.mjs` 의 `lintRecipeReport` 를 import 해 DESIGN.md 머리에 직접 실행 — A안과 B안 적용본 모두 포함): 위반 0 · 경고 1
  - compat-caution: 주의 C4: 이중 베젤은 1순위 카드·히어로 목업에만 — 모든 카드에 쓰지 않는다
  - `npm run gen:all` 이 도는 레시피다(`registry/factory/recipes/r15-atelier/README.generated.md` 가 생성물로 있다).
  - 경고의 뜻: C4(이중 베젤)는 1순위 카드·히어로 목업에만 쓰고 모든 카드에 두르지 않는다는 호환표 주의다 — 위반이 아니라 권고다.

**실측 ↔ 레시피.** 레퍼런스 2 의 먹색 바탕 `#231B1D` 는 레시피 다크 secondary 와 0.021, 글자 `#F3EFEB` 는 레시피 라이트 muted 와 0.005 로 같은 값에 가깝다 — 따뜻한 어두운 바탕에 오프화이트 글자라는 K5 의 결이다. 레퍼런스 1 의 어두운 막(`#1A0401`·`#05100B`)은 레시피 다크 바탕(`#140E0B`)과 0.03~0.04 로 비슷하다. 레퍼런스 1 의 짙은 녹색(`#154734`, 글자색 3순위)은 레시피 라이트의 어느 색과도 멀다(0.075 — 가장 가까운 것이 muted-foreground). 레시피의 세이지(`oklch(0.88 0.045 135)` 계열)는 이 녹색보다 훨씬 옅다. 거리 기준은 이 카드 안에서만 쓰는 임의값이다(0.05 이하 같음 · 0.12 이하 비슷함 · 그 위 다름).

| 측정 색 | 측정 hex | 가장 가까운 레시피 색 | OKLab 거리 | 읽기 |
|---|---|---|---|---|
| seedlip 어두운 막 | `#1A0401` | background(다크) `#140E0B` | 0.038 | 같음 |
| seedlip 짙은 녹색 띠 | `#05100B` | background(다크) `#140E0B` | 0.030 | 같음 |
| seedlip 글자 녹색 | `#154734` | muted-foreground(라이트) `#4B433D` | 0.075 | 비슷함 |
| brinkerhoff 바탕 | `#231B1D` | secondary(다크) `#28201B` | 0.021 | 같음 |
| brinkerhoff 글자 | `#F3EFEB` | muted(라이트) `#F0EEEA` | 0.005 | 같음 |

## 서체

레퍼런스가 실제로 쓰는 것(측정): seedlip — 제목 `mollieGlaston`(88px 굵기 400, 스크린샷에서 가는 세리프) · 본문 ui-sans-serif 계열(245자) · 라벨 `brCandor`(110자) · Material Symbols Rounded(아이콘 글꼴). brinkerhoff — 제목 `AdrianFine`(70px 굵기 400) · 링크 `AdrianText`(소형 대문자) 둘 다 자체 서체 이름.
레시피가 실제로 쓰는 것(DESIGN.md `fonts`): display **Libre Caslon Text** 굵기 400(자간 0.01em, 행간 1.15, 이탤릭은 한 줄 부제에만) · displayKo **Hahmlet** · body Noto Sans KR(16px/1.7). mono 는 없다.
관계: 서체 이름은 모두 다르다(**다름**, 두 레퍼런스 모두 자체 서체). 굵기 400 의 가는 세리프 제목이라는 결은 같다(스크린샷 판독) — 이 카드에서 레시피와 가장 가까운 서체 관계다. 레퍼런스 1 의 대문자 굵은 내비·단추 라벨은 레시피의 산세리프 본문(Noto Sans KR)과 결이 다르다.

- 1순위 라틴 디스플레이: **Libre Caslon Text**
- 1순위 한글 제목: **Hahmlet**
- 본문 한글: Noto Sans KR(레시피 값 유지)

라틴 디스플레이 후보(순위순):

1. **Libre Caslon Text** — OFL 1.1 · 키트 항목 `font-libre-caslon-text` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/librecaslontext/OFL.txt. 레시피가 지금 쓰는 값. fonts.json 선별본에도 있다(editorial-serif · 화면용 캐슬론 본문 — 에세이·출판 브랜드).
2. **Libre Caslon Display** — OFL 1.1 · 키트 항목 `font-libre-caslon-display` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/librecaslondisplay/OFL.txt. 키트 항목이 이미 있다. 같은 캐슬론의 큰 크기용 가는 면 — fonts.json 에도 있다(가늘고 섬세한 캐슬론 디스플레이 — 북 커버·고급 인쇄물 톤).
3. **Gilda Display** — OFL 1.1 · Google Fonts · 굵기 400 한 면 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 가늘고 우아한 디돈 — 웨딩·패션 룩북.

한글 제목 후보(순위순):

1. **Hahmlet** — OFL 1.1 · 키트 항목 `font-hahmlet` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/hahmlet/OFL.txt. 레시피 displayKo 그대로.
2. **Cafe24Danjeonghae** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 11172자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 부리가 살아 있는 굵은 제목체 — 에세이·브랜드 스토리 제목.
3. **Gowun Batang** — OFL 1.1 · 키트 항목 `font-gowun-batang` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/gowunbatang/OFL.txt. 키트 항목이 이미 있다. 부드러운 본문 바탕.

대조: 위 순위는 `references/fonts/fonts.json`(398종)과 키트 항목 메타의 라이선스·전달 경로·한글 범위 값을 그대로 읽은 것이다. 한글 1순위(Hahmlet)는 r1~r10 카드의 한글 1순위와 겹치지 않는다.

## 히어로 배치 2수

레시피 hero `ken-burns-stills`(블록 메타: 첫 화면 전체가 사진 무대(3~5장, 켄 번스 장 7초·교차 1.2초·확대 1.12·팬 3%) + 이름표 띠, 왼쪽 아래 큰 제목(짙은 막), 오른쪽 아래 바탕색 판에 문단 한 개와 버튼 둘)와의 이음 — 수 1 의 「전면 영상 + 어두운 막 + 왼쪽 제목」이 이어진다(레시피는 제목이 왼쪽 아래, 수 1 은 세로 40%대). 수 2 는 사진이 전면이 아니라 폭 66% 라서 사진 무대 구성과는 다르고 「제목이 사진 가장자리를 넘어 겹친다」만 참고한다. 켄 번스 확대 움직임은 두 레퍼런스 모두 관측되지 않았다(수 2 는 로드 직후 애니메이션 0개).

### 수 1 — 어두운 영상 전면 + 왼쪽 가는 세리프 제목 + 한 줄 부제 + 외곽선 단추 (사이트 1)

1440: 공지 띠(세로 0~7%) 아래 영상이 세로 7~96% 를 채우고 어두운 붉은 갈색 막이 덮는다. 제목 한 줄(88px = 6.1vw, 굵기 400, 행간 79.2px = 0.9배, 왼쪽 80px, 반투명 회색 글자)이 세로 39~47%, 한 줄 부제 세로 52%, 외곽선 단추(폭 170px)가 59~64% 에 쌓인다. 영상 상자 왼쪽 아래 모서리가 크게 둥글다. 로드 직후 `fade-in-up-10` 1000ms 한 개. 쿠키 창이 가운데 위쪽을 덮었다(누르지 않음). 390: 제목 48px(12.3vw) 가운데 정렬로 세로 20~25%.

### 수 2 — 왼쪽 제목 칸 + 오른쪽 큰 사진 한 장이 제목 끝을 덮는 겹침 (사이트 2)

1440: 짙은 먹 바탕 위 사진 한 장(폭 951px, 가로 29~95%, 세로 18~92%)이 오른쪽을 차지하고, 세리프 제목 한 줄(70px = 4.9vw, 굵기 400, 행간 75px)이 왼쪽 75px 에서 세로 48~54% 에 앉아 끝 두 글자가 사진 위로 74px 겹친다. 밑줄 대문자 링크 하나가 왼쪽 아래(세로 약 90%)에 있다. 단추·장식이 없고 로드 직후 애니메이션 0개다. 390: 제목 30px(7.7vw)가 세로 16%, 사진이 아래로 내려와 세로 30~95% 를 폭 86% 로 채운다.

## 모션 1수

- 카탈로그 id: `clip-reveal`
- 관측(1440): seedlip 은 로드 직후 `fade-in-up-10` 1000ms 하나 · 전환 `all`(×742)과 `0.1s linear`(×27) · 라이브러리 흔적 next·video(4) · :hover 규칙 77개 · 스크롤 500px 뒤 다르게 움직인 요소 32/64. brinkerhoff 는 로드 직후 애니메이션 0개 · 전환 `transform 0.3s ease-in-out`(×35)과 `border-bottom-color 0.3s ease-out`(×24) · :hover 규칙 23개 · 스크롤 28/33. **clip-path 리빌은 두 곳 모두 로드 직후 관측되지 않았다.**
- 적용(레시피가 실제로 정한 값): 모션 M3 — `--duration-enter` 700ms · `--duration-hover` 200ms · `--duration-press` 160ms · `--duration-sheet` 350ms · `--ease-standard` `cubic-bezier(0.16, 1, 0.3, 1)` · `--ease-emphasized` `cubic-bezier(0.05, 0.7, 0.1, 1)`(`gen-kits.mjs` `MOTION_TOKENS` 의 M3). DESIGN.md 본문: 스크롤에 맞춰 사진이 clip-reveal 로 열리고 주 CTA 하나에만 자석(magnetic-cta)을 건다. `clipReveal` 도우미(gsap-techniques.ts)의 기본 시작 방향은 아래, 연쇄 간격 기본값은 0.08초다. 레퍼런스 전환은 0.1~0.3초 대라 M3 등장 700ms 보다 훨씬 짧다.
- reduced-motion: 동작 줄이기에서는 장면 훅(`motion-gsap`)이 정지 갈래로 가서 끝 상태 그대로 그린다(블록 메타: 켄 번스 사진 몽타주는 모션 M1 에서 첫 장 정지). 두 레퍼런스 모두 reduced-motion 규칙이 있다(측정).

## 복제하지 않는 것

- seedlip 의 영상·인물 사진·로고·제목과 부제 문구·쿠키 창 문구, brinkerhoff 의 사진·로고 그림·재단 이름·제목 문구 — 그림·문구를 가져오지 않았다.
- 두 사이트의 서체 파일(`mollieGlaston`·`brCandor`·`AdrianFine`·`AdrianText`) — 자체 서체이고 라이선스를 확인하지 않아 가져오지 않았다. 레시피는 Libre Caslon Text·Hahmlet·Noto Sans KR 이다.
- seedlip 의 짙은 녹색 글자·띠(`#154734`·`#05100B`)와 대문자 굵은 내비 — 레시피 주색은 에스프레소 갈색(다크는 세이지)이라 따라 하지 않았다. 영상 상자의 한쪽 큰 둥근 모서리도 레시피 반경(R1)에 없다.
- 두 사이트의 코드·이미지·로고·문구·유료 서체 파일·고유 일러스트 전부. 가져온 것은 hex 값(비교용 실측), 서체 선택, 배치 구조, 모션 기법과 시간 값뿐이다.
