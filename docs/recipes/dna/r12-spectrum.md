# r12-spectrum — 다차원 지표판 · 레퍼런스 DNA 카드

> 이 카드는 레시피(DESIGN.md)가 이미 있는 뒤에 쓴 사후 기록이다 — 레퍼런스 실측과 레시피가 실제로 쓰는 값을 나란히 적고, 어디가 같고 어디가 다른지 밝힌다. 레시피 값을 이 카드가 바꾸지 않는다.
> 레시피 틀(DESIGN.md 에서 읽음): colorLogic **K2** · defaultTheme 명시 없음(라이트가 기본) · motion **M1** · dynamics [svg-draw, clip-reveal] · hero `map-first` · 원형 dashboard·public. 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다는 기록이 DESIGN.md 에 있다.
> 측정: headless Chrome(CDP)으로 첫 화면 1440×900과 390×844, 요청 사이 10초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 임시 폴더)에만 있다.

## 출처

- 사이트 1: https://dashboard.simpleanalytics.com/simpleanalytics.com · 출처 `supp-colorlib-exa` · refs-v2 카드(dashboard·색 논리 K2) 수록 — 광고 쪽이 아니라 공개 통계 화면 그 자체 · 방문 2026-10-11T14:32Z
  - 1440 넓이 상위 색: `#20292A` 63.9% · `#2A3638` 15.6% · `#67868C` 3.3% · `#6C8D93` 3.1% · `#617E84` 1.9% · `#198C9F` 1.9%
  - 390 넓이 상위 색: `#20292A` 68.8% · `#2A3638` 12.9% · `#5B767B` 2.9% · `#617E84` 2.4% · `#5E7A7F` 2.2% · `#5E7A80` 1.4%
  - 글자색(글자 수 순): `#BBD2D5` · `#6E8386` · `#00C5E5` · 버튼 바탕: `#B93545`
  - 첫 화면 서체(글자 수 순): Space Grotesk(423)
  - 가장 큰 글자 1440: Space Grotesk · 40px (2.8vw) · 굵기 400 · 자간 -1.6px · 행간 40px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Space Grotesk · 40px (10.3vw) · 굵기 400 · 자간 -1.6px · 행간 40px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 어두운 청록 회색 판. 바탕 `#20292A`(63.9%) 위에 머리 띠 `#2A3638`(15.6%)이 세로 0~16%를 덮고, 가운데 폭 970px(x 235~1205, 가로 67%)로 쌓은 한 단이다. 머리 띠에 사이트 이름(큰 글자)이 왼쪽, 로그인 링크와 붉은 알약 가입 단추(`#B93545`)가 오른쪽, 탭 줄(방문자·목표·이벤트·AI)이 세로 약 14%. 지표 넷(큰 얇은 숫자 + 작은 증감 알약)과 오른쪽 끝 기간 선택이 세로 19~26%, 면적 차트가 세로 30~62%를 폭 가득 채우고(선 `#198C9F` 청록), 세로 71%부터 네 열 목록(유입·페이지·기기·국가)이 시작한다. 제목(h1) 요소가 0개 — 큰 글자는 지표 숫자뿐이다. 390: 사이트 이름이 두 줄로 접히고 가입·로그인이 오른쪽에 쌓이며, 지표 셋이 한 줄(세로 18~28%), 차트가 화면 폭 전체(세로 41~64%), 목록이 71%부터.
  - 모션 관측(1440): 로드 직후 애니메이션 1개(pulse-animation-bf3fb208 2000ms linear) · 무한 반복 1개 · 전환 상위 `all`(×602), `color 0.25s ease-in-out`(×191) · 라이브러리 흔적 canvas · :hover 규칙 88개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/80
- 사이트 2: https://www.askmidnight.com/ · 출처 `onepagelove` · refs-v2 카드(saas·색 논리 K2) 수록 · 방문 2026-10-11T14:33Z
  - 1440 넓이 상위 색: `#F4EFE6` 10% · `#171D1D` 2.3% · `#667470` 1.9% · `#7C7A6E` 1.9% · `#80796C` 1.8% · `#73766C` 1.7%
  - 390 넓이 상위 색: `#F4EFE6` 10% · `#171F1F` 1.9% · `#151F21` 1.8% · `#152021` 1.6% · `#18211F` 1.4% · `#181F1E` 1.3%
  - 글자색(글자 수 순): `#F4F1E9` · `lab(95.2142 0.0121892 4.24798 / 0.52)` · `#07172A` · 버튼 바탕: 측정 안 됨(버튼 요소 0개)
  - 첫 화면 서체(글자 수 순): Public Sans(141)
  - 가장 큰 글자 1440: Public Sans · 48px (3.3vw) · 굵기 500 · 자간 -1.92px · 행간 48px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Public Sans · 36px (9.2vw) · 굵기 500 · 자간 -1.44px · 행간 40px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 전체 폭 흐린 사진(조리개처럼 번진 원 — 어두운 남색·갈색·회녹)이 첫 화면 위쪽 90%(세로 0~810px)를 채우고, 아래 10%는 크림 `#F4EFE6` 구획이 시작한다(이 크림이 색 넓이 1위, 10%). 내비·단추가 없다(버튼 요소 0개). 제목 한 줄이 왼쪽(left 58px)에서 세로 약 45~48%에 둥근 사각 선 아이콘 하나와 함께 앉고, 오른쪽(가로 59% 지점부터)에 2줄 설명이 같은 높이에 놓이며 둘째 줄은 반투명이다. 390: 사진 높이 760px(90%), 제목 2줄 세로 약 35~44%, 설명 3줄이 바로 아래(약 47~55%).
  - 모션 관측(1440): 로드 직후 애니메이션 3개(hero-text-in 500ms linear, hero-text-in 500ms linear, t-shimmer 2000ms linear) · 무한 반복 1개 · 전환 상위 `all`(×333), `color 0.1s linear`(×31) · 라이브러리 흔적 next, canvas(5) · :hover 규칙 3개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 5/22
- 팔레트: `pal-sns-instagram-ddujmhojbb4-2` · https://www.instagram.com/p/DduJMHojbB4 · @dopely.colors · 원 역할 대비 fg/bg 12.78 · 주색 위 글자 5.93

## 팔레트

색 논리는 K2(다차원 팔레트)이고 defaultTheme 은 머리에 없어 라이트가 기본이다. 데이터 색은 `chart-1`~`chart-5` 다섯 색상각(232·30·150·85·305°)이 맡고 주색 하나(색상각 232°)는 버튼·링크·선택 상태만 맡는다.

**팔레트와의 관계(솔직히).** 위 SNS 팔레트 `pal-sns-instagram-ddujmhojbb4-2`(바탕 `#F3FAF4` · 글자 `#3A2B22` · 주색 `#2F6B4F`, 겨울 숲 녹색 계열)는 「가장 가까운 SNS 팔레트로 기록」한 것이고 레시피 색은 이 팔레트에서 직접 가져온 것이 아니다 — 레시피 색은 refs-v2 색 논리 K 값에서 왔다. OKLab 거리(SNS 팔레트 `pal-sns-instagram-ddujmhojbb4-2` 의 같은 역할 색 ↔ 레시피의 가까운 쪽 모드): 바탕 0.014(라이트 쪽이 가까움) · 글자 0.092(라이트 쪽이 가까움) · 주색 0.126(라이트 쪽이 가까움) — 0 이 같은 색이고 흰색↔검정이 약 1 이다. 바탕은 둘 다 거의 흰색이라 거리가 작지만(레시피 바탕은 색상각 250°, 팔레트 바탕은 녹색 150°) 글자(갈색 대 짙은 남색)와 주색(녹색 `#2F6B4F` 대 파랑 232°)은 다른 색이다. 레시피 B안(청록 172° 주색 `oklch(0.42 0.10 172)`)이 이 팔레트 주색에 더 가깝다(OKLab 거리 0.066, A안 주색은 0.126).

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F9FAFC` | `oklch(0.9850 0.0030 250.00)` | `#101419` | `oklch(0.1900 0.0120 255.00)` |
| foreground | `#171B20` | `oklch(0.2200 0.0120 255.00)` | `#EBEFF2` | `oklch(0.9500 0.0060 250.00)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#1A1E25` | `oklch(0.2350 0.0140 255.00)` |
| primary | `#005B88*` | `oklch(0.4400 0.1200 232.00)` | `#6ABCE6` | `oklch(0.7600 0.1000 232.00)` |
| primary-foreground | `#F9FCFF` | `oklch(0.9900 0.0050 232.00)` | `#08121F` | `oklch(0.1800 0.0300 255.00)` |
| secondary | `#EDF0F4` | `oklch(0.9550 0.0060 250.00)` | `#1D2228` | `oklch(0.2500 0.0140 255.00)` |
| accent | `#EEE2FE` | `oklch(0.9300 0.0400 305.00)` | `#352546` | `oklch(0.3000 0.0600 305.00)` |
| accent-foreground | `#3A1C55` | `oklch(0.3000 0.1000 305.00)` | `#ECE3F8` | `oklch(0.9300 0.0300 305.00)` |
| muted | `#EFF2F5` | `oklch(0.9600 0.0050 250.00)` | `#1D2228` | `oklch(0.2500 0.0140 255.00)` |
| muted-foreground | `#4A545D` | `oklch(0.4400 0.0200 250.00)` | `#9CA5B1` | `oklch(0.7200 0.0200 255.00)` |
| border | `#DBDEE2` | `oklch(0.9000 0.0060 250.00)` | `#30363E` | `oklch(0.3300 0.0160 255.00)` |
| input | `#5B646F` | `oklch(0.5000 0.0200 250.00)` | `#5D6775` | `oklch(0.5100 0.0250 255.00)` |
| ring | `#005B88*` | `oklch(0.4400 0.1200 232.00)` | `#6ABCE6` | `oklch(0.7600 0.1000 232.00)` |
| chart-1 | `#006EA0*` | `oklch(0.5000 0.1300 232.00)` | `#46B1E3` | `oklch(0.7200 0.1200 232.00)` |
| chart-2 | `#C44132` | `oklch(0.5600 0.1700 30.00)` | `#F47C6B` | `oklch(0.7200 0.1500 30.00)` |
| chart-3 | `#298646` | `oklch(0.5500 0.1300 150.00)` | `#69C27E` | `oklch(0.7400 0.1300 150.00)` |
| chart-4 | `#AC7D00*` | `oklch(0.6200 0.1400 85.00)` | `#E4B750` | `oklch(0.8000 0.1300 85.00)` |
| chart-5 | `#7D4DAD` | `oklch(0.5200 0.1500 305.00)` | `#B88FE6` | `oklch(0.7200 0.1300 305.00)` |

`*` 가 붙은 hex 는 sRGB 범위 밖이라 채널을 잘라 낸 근사값이다(OKLCH 값이 정본). 표는 DESIGN.md `color` 의 값을 그대로 옮겼다(상태색 생략, 차트색 포함).

레시피 머리 색을 `factory/scripts/lib/contrast-lib.mjs` 의 `ratio`(`node factory/scripts/contrast.mjs` 가 쓰는 같은 함수)로 직접 계산한 WCAG 대비:

| 쌍 | 라이트 | 다크 | 기준 |
|---|---|---|---|
| foreground / background | 16.58 PASS | 15.96 PASS | ≥ 7 |
| muted-foreground / background | 7.42 PASS | 7.45 PASS | ≥ 7 |
| primary / background | 7.01 PASS | 8.77 PASS | ≥ 4.5 |
| primary-foreground / primary | 7.12 PASS | 8.94 PASS | ≥ 4.5 |
| ring / background | 7.01 PASS | 8.77 PASS | ≥ 3 |

차트 계열색 5개와 바탕의 대비(같은 함수): 라이트 chart-1 5.41 · chart-2 4.84 · chart-3 4.38 · chart-4 3.52 · chart-5 5.66 / 다크 chart-1 7.62 · chart-2 6.99 · chart-3 8.43 · chart-4 9.81 · chart-5 7.10

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 레시피 lint 의 팔레트 금지 검사가 위반 0 으로 통과한다(아래 lint 줄). 크림 바탕은 해당 없음(라이트 바탕 채도 0.003).
색 논리 lint 와 레시피 lint(`recipe.mjs` 의 `lintRecipeReport` 를 import 해 DESIGN.md 머리에 직접 실행 — A안과 B안 적용본 모두 포함): 위반 0 · 경고 0
  - `npm run gen:all` 이 도는 레시피다(`registry/factory/recipes/r12-spectrum/README.generated.md` 가 생성물로 있다).

**실측 ↔ 레시피.** 레퍼런스 1 은 어두운 판인데 레시피는 라이트가 기본이다 — 다만 레시피 다크 값이 레퍼런스 판 가까이 있다(바탕 `#20292A` ↔ 다크 secondary 0.025, 머리 띠 `#2A3638` ↔ 다크 border 0.015). 레퍼런스 1 의 청록 강조 `#00C5E5` 는 레시피 다크 주색에서 0.048 거리이고, 붉은 가입 단추(`#B93545`)는 레시피에 같은 색이 없다(가장 가까운 것도 0.183 — 레시피 버튼은 주색 하나). 레퍼런스 2 의 크림 `#F4EFE6` 은 레시피 라이트 secondary 와 숫자상 가깝지만(채도가 낮아서) 따뜻한 색상각(85°)이라 레시피의 차가운 흰 회색(250°)과는 다른 색이다. 거리 기준은 이 카드 안에서만 쓰는 임의값이다(0.05 이하 같음 · 0.12 이하 비슷함 · 그 위 다름).

| 측정 색 | 측정 hex | 가장 가까운 레시피 색 | OKLab 거리 | 읽기 |
|---|---|---|---|---|
| simpleanalytics 바탕 | `#20292A` | secondary(다크) `#1D2228` | 0.025 | 같음 |
| simpleanalytics 머리 띠 | `#2A3638` | border(다크) `#30363E` | 0.015 | 같음 |
| simpleanalytics 강조 청록 | `#00C5E5` | primary(다크) `#6ABCE6` | 0.048 | 같음 |
| simpleanalytics 단추 | `#B93545` | input(라이트) `#5B646F` | 0.183 | 다름 |
| simpleanalytics 글자 | `#BBD2D5` | border(라이트) `#DBDEE2` | 0.057 | 비슷함 |
| askmidnight 아래 구획 | `#F4EFE6` | secondary(라이트) `#EDF0F4` | 0.019 | 같음 |
| askmidnight 글자 | `#F4F1E9` | muted(라이트) `#EFF2F5` | 0.016 | 같음 |

## 서체

레퍼런스가 실제로 쓰는 것(측정): simpleanalytics — Space Grotesk 하나(첫 화면 글자 423자, 지표 숫자 40px 굵기 400). askmidnight — Public Sans 하나(141자, 제목 48px 굵기 500).
레시피가 실제로 쓰는 것(DESIGN.md `fonts`): display **Sora** 굵기 600(큰 수치·KPI 도 같은 서체·같은 굵기) · body Pretendard(숫자 tabular-nums) · mono IBM Plex Mono(`data-numeric` 칸에만). `displayKo` 는 없다.
관계: 서체 이름은 모두 다르다(**다름**). 레퍼런스 1 의 지표 숫자는 굵기 400 으로 가볍고 레시피 큰 수치는 600 이라 숫자의 무게가 다르다. 레시피 DESIGN.md 의 「큰 얇은 숫자」 기법 줄은 레시피 굵기 값(600)과 어긋난다 — 이 카드는 값을 바꾸지 않고 사실만 적는다.

- 1순위 라틴 디스플레이: **Sora**
- 1순위 한글 제목: **Pretendard**
- 본문 한글: Pretendard(레시피 값 유지)

한글 제목에 관해: 레시피에는 displayKo 가 없어 한글 제목은 본문 Pretendard 로 나간다 — 이 1순위는 레시피의 현재 값이다. 아래 2·3순위는 displayKo 를 더한다면의 후보일 뿐이다(레시피는 이 카드가 바꾸지 않는다).

라틴 디스플레이 후보(순위순):

1. **Sora** — OFL 1.1 · 키트 항목 `font-sora` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/sora/OFL.txt. 레시피가 지금 쓰는 값.
2. **Atkinson Hyperlegible Next** — OFL 1.1 · Google Fonts · 200~800 가변 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 저시력 가독성 설계 본문 산스 — 공공·의료 안내.
3. **Libre Franklin** — OFL 1.1 · Google Fonts · 100~900 가변 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 프랭클린 고딕 계열 — 뉴스·B2B 제목과 본문(Typewolf 40선).

한글 제목 후보(순위순):

1. **Pretendard** — OFL 1.1 · 키트 항목 `font-pretendard` · 1차 출처 https://github.com/orioncactus/pretendard/blob/main/LICENSE. 현재 머리의 한글 제목(= 본문 가족).
2. **PyeojinGothic** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 11172자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 옆으로 펼친 고딕 — 넓은 제목·브랜드 워드마크. 키트 항목 `font-pyeojin-gothic` 이 이미 있다.
3. **Cafe24PROSlim** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 2350자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 좁게 압축한 한글 고딕 — 좁은 배너·숫자 강조 제목. 한글 2,350자만 담아 없는 글자는 본문으로 떨어진다 — 숫자·짧은 제목에만.

대조: 위 순위는 `references/fonts/fonts.json`(398종)의 라이선스·전달 경로·한글 범위 값을 그대로 읽은 것이다. 한글 1순위가 Pretendard 로 겹치는 카드는 이 카드뿐이다(r6 은 Pretendard GOV 라 다르다).

## 히어로 배치 2수

레시피 hero `map-first`(블록 메타: 전폭 큰 제목 아래 왼쪽 큰 지도 + 오른쪽 선택한 지점 카드)와의 이음 — 첫 화면의 무게가 큰 면 하나라는 점이 이어진다(수 1 은 면적 차트, 수 2 는 사진이 그 면이다). 지도 위 지점 표지와 오른쪽 카드는 레퍼런스에 없고, 수 1 의 지표 네 칸이 레시피 오른쪽 수치 카드 자리에 해당한다.

### 수 1 — 머리 띠 + 지표 네 칸 + 폭 가득 면적 차트 + 네 열 목록 (사이트 1)

1440: 가운데 폭 970px(가로 67%)의 단 하나로 쌓는다 — 머리 띠(세로 0~16%, 바탕 `#2A3638`) 안에 사이트 이름·로그인·가입, 탭 줄 세로 약 14%, 지표 넷(숫자 40px = 2.8vw, 굵기 400, 자간 -1.6px, 곁에 작은 증감 알약)이 세로 19~26%, 면적 차트가 세로 30~62%, 71%부터 네 열 목록. 제목(h1)이 없고 큰 글자는 숫자뿐이라 읽는 순서가 「숫자 → 추이 → 표」다. 390: 이름이 두 줄로 접히고 지표는 셋이 한 줄, 차트가 화면 폭 전체(세로 41~64%).

### 수 2 — 전폭 흐린 사진 위 한 줄 제목 + 오른쪽 두 줄 설명(내비 없음) (사이트 2)

1440: 흐린 사진이 위쪽 90%(세로 0~810px)를 채우고, 한 줄 제목(48px = 3.3vw, 굵기 500, 자간 -1.92px)이 왼쪽 58px 에서 세로 약 45~48% 에 작은 아이콘과 함께 앉는다. 오른쪽(가로 59%부터)에 두 줄 설명(둘째 줄은 반투명)이 같은 높이에 놓인다. 단추·내비가 없고(버튼 요소 0개) 아래 10%는 크림 `#F4EFE6` 구획이 시작된다. 로드 직후 `hero-text-in` 500ms 두 개가 돈다. 390: 사진 높이 760px(90%), 제목 36px(9.2vw) 2줄 세로 약 35~44%, 설명 3줄이 바로 아래.

## 모션 1수

- 카탈로그 id: `svg-draw`
- 관측(1440): simpleanalytics 는 로드 직후 애니메이션이 1개뿐 — 라이브 점의 `pulse-animation` 2000ms 무한 · 전환 `color 0.25s ease-in-out`(×191) · 차트는 canvas 로 그려지고(라이브러리 흔적 canvas) 스크롤 500px 뒤 다르게 움직인 요소 0/80 — **선이 그려지는 애니메이션은 관측되지 않았다**. askmidnight 는 `hero-text-in` 500ms 두 개와 `t-shimmer` 2000ms · 전환 `color 0.1s linear`(×31) · 스크롤 5/22. 곧 svg-draw 는 레퍼런스에서 가져온 기법이 아니라 레시피가 정한 기법이다.
- 적용(레시피가 실제로 정한 값): 모션 M1 — `--duration-enter` 300ms · `--duration-hover` 150ms · `--duration-sheet` 260ms · `--ease-standard` `cubic-bezier(0.25, 0.46, 0.45, 0.94)`(`gen-kits.mjs` `MOTION_TOKENS` 의 M1). DESIGN.md 본문: 차트 선은 한 번 긋고(svg-draw), 지표 카드는 위에서 걷는 clip-reveal 로 등장한다. `svgDraw` 도우미(gsap-techniques.ts)의 연쇄 간격 기본값은 0.08초다. 레퍼런스 1 의 색 전환 0.25초(ease-in-out)는 M1 hover 150ms 보다 느리다.
- reduced-motion: DESIGN.md 본문대로 동작 줄이기에서는 선이 완성된 채 보인다. 두 레퍼런스도 reduced-motion 규칙이 있다(측정).

## 복제하지 않는 것

- simpleanalytics 의 방문자·페이지 수치와 주소 목록·국기 그림·로고 아이콘·사이트 이름, askmidnight 의 번진 사진·아이콘·제목과 설명 문구 — 그림·문구를 가져오지 않았다.
- 두 사이트의 서체 파일(Space Grotesk·Public Sans) — 가져오지 않았다. 레시피는 Sora·Pretendard·IBM Plex Mono 다.
- 청록 `#00C5E5` 와 붉은 알약 단추 `#B93545` — 그대로 쓰지 않았다(레시피 버튼은 주색 하나이고 차트 계열색을 버튼에 돌려 쓰지 않는다). 크림 `#F4EFE6` 바탕도 따르지 않았다.
- 두 사이트의 코드·이미지·로고·문구·유료 서체 파일·고유 일러스트 전부. 가져온 것은 hex 값(비교용 실측), 서체 선택, 배치 구조, 모션 기법과 시간 값뿐이다.
