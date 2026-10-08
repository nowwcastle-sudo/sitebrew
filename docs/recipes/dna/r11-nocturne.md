# r11-nocturne — 어두운 밤 테크 화면 · 레퍼런스 DNA 카드

> 이 카드는 레시피(DESIGN.md)가 이미 있는 뒤에 쓴 사후 기록이다 — 레퍼런스 실측과 레시피가 실제로 쓰는 값을 나란히 적고, 어디가 같고 어디가 다른지 밝힌다. 레시피 값을 이 카드가 바꾸지 않는다.
> 레시피 틀(DESIGN.md 에서 읽음): colorLogic **K1** · defaultTheme **dark** · motion **M2** · dynamics [clip-reveal] · hero `narrow-title-wide-window` · 원형 dashboard. 승격 초안이라 「## 운영자 확인 전」 절이 남아 있어 `gen:all` 이 아직 이 레시피를 넣지 않는다.
> 측정: headless Chrome(CDP)으로 첫 화면 1440×900과 390×844, 요청 사이 10초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 임시 폴더)에만 있다.

## 출처

- 사이트 1: https://cerebrium.ai/ · 출처 `awwwards` · refs-v2 카드(saas·색 논리 K1) 수록 · 방문 2026-10-11T14:32Z
  - 1440 넓이 상위 색: `#000000` 26.4% · `#2D0D21` 8% · `#0D000D` 4.8% · `#65154E` 4.2% · `#561242` 3.9% · `#5B1446` 3.5%
  - 390 넓이 상위 색: `#000000` 18.5% · `#2A0D21` 10% · `#0D000D` 4.9% · `#5A1245` 3.6% · `#0D0D0D` 3.6% · `#4B0F39` 3.6%
  - 글자색(글자 수 순): `#FFFFFF` · `#101421` · `#172B76` · 버튼 바탕: `#CFD7E7` · `#FF488B` · `oklab(0.193979 0.000299938 -0.0271324 / 0.35)`
  - 첫 화면 서체(글자 수 순): Suisse Intl(179) · Suisse Intl Mono(79) · ABC Favorit Trial(42)
  - 가장 큰 글자 1440: ABC Favorit Trial · 86.09px (6vw) · 굵기 300 · 자간 -2.15216px · 행간 86.0864px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: ABC Favorit Trial · 45px (11.5vw) · 굵기 300 · 자간 -1.125px · 행간 45px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 거의 검정 바탕(`#000000` 26.4%, 나머지는 짙은 자주 계열)에 자홍·보라 입체 리본 그림이 오른쪽 아래 절반을 덮는다. 위 줄: 로고가 왼쪽, 오른쪽에 어두운 알약 막대 내비(항목 다섯 + 점 아이콘)와 단추 둘(연한 청회색 `#CFD7E7`·분홍 `#FF488B`, 높이 54px). 제목 3줄이 왼쪽(left 40px)에서 세로 약 62~90%에 앉고 마지막 줄 첫 낱말 하나만 분홍이다. 설명 5줄과 단추 둘은 오른쪽 열(가로 약 67%부터, 세로 약 68~91%). 첫 화면 위쪽 60%는 그림과 빈 바탕뿐이다. 390: 위 줄은 로고와 MENU 단추 하나, 재생 단추 정사각 하나(세로 약 46~53%), 제목 3줄 세로 약 57~72%, 설명 4줄, 단추 둘이 가로로 나란히(세로 약 90~95%).
  - 모션 관측(1440): 로드 직후 애니메이션 5개(overlay-anim-out 300ms linear, initial-loader-logo-bar 1000ms linear, initial-loader-logo-bar-middle 1000ms linear …) · 무한 반복 4개 · 전환 상위 `all`(×3461), `transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1), opacity 0.2s cubic-bezier(0.645, 0.04`(×65) · 라이브러리 흔적 canvas · :hover 규칙 14개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 30/80
- 사이트 2: https://www.raycast.com/ · 출처 `supp-replace-a` · refs-v2 카드(saas·색 논리 K4) 수록 · 방문 2026-10-11T14:37Z
  - 1440 넓이 상위 색: `#07090A` 72.7% · `#0C0D0F` 4.2% · `#0D0F10` 3.3% · `#DD2038` 2.1% · `#FFFFFF` 1% · `#06070A` 0.9%
  - 390 넓이 상위 색: `#07080A` 48.3% · `#0C0D0F` 6% · `#0D0F11` 3.3% · `#130D0E` 2.2% · `#070B12` 1.2% · `#FFFFFF` 1.1%
  - 글자색(글자 수 순): `#FFFFFF` · `#9C9C9D` · `#2F3031` · 버튼 바탕: `#E6E6E6`
  - 첫 화면 서체(글자 수 순): Inter(216) · GeistMono(43)
  - 가장 큰 글자 1440: Inter · 64px (4.4vw) · 굵기 600 · 자간 normal · 행간 70.4px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Inter · 36px (9.2vw) · 굵기 600 · 자간 normal · 행간 39.6px · 대소문자 그대로 · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 거의 검정 바탕(`#07090A` 72.7%)에 붉은 흐린 사선 띠 그림(`#DD2038` 2.1%)이 왼쪽 위에서 오른쪽 아래로 가로지른다. 위쪽은 가로 83%(x 118~1322)의 1px 테두리 둥근 막대가 떠 있고 안에 로고·메뉴 아홉 항목·로그인·흰 계열 다운로드 단추. 제목 2줄은 가운데 정렬로 세로 약 42~56%(띠 위), 설명 2줄 세로 약 61~64%, 단추 하나 세로 약 90%, 그 아래 Geist Mono 두 줄(설치 환경 안내). 390: 막대 내비는 로고와 햄버거, 띠가 화면 폭 전체를 채우고 제목 2줄 세로 약 31~40%, 설명 3줄, 알약 단추 하나 세로 약 71%, 아래 약 25%는 빈 바탕.
  - 모션 관측(1440): 로드 직후 애니메이션 29개(page-module__H3BVAa__fade-in-up 1000ms linear, page-module__H3BVAa__fade-in-up 1000ms linear, HeroAnnouncement-module__ezSJPa__rotating2 3000ms linear …) · 무한 반복 8개 · 전환 상위 `all`(×2387), `opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.2s cubic-bezier(0.23, 1, 0.32, 1`(×159) · 라이브러리 흔적 next, canvas · :hover 규칙 124개 · reduced-motion 규칙 있음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 16/30
- 팔레트: `pal-sns-instagram-dapad3qkle0-5` · https://www.instagram.com/p/DaPAD3qkle0/ · @artart.today · 원 역할 대비 fg/bg 11.29 · 주색 위 글자 4.92
- 측정하지 못한 사이트: mezmo.com — robots.txt 확인에서 금지 규칙(`disallow /*_page=`)이 걸려 방문하지 않았고 쓰지 않았다.

## 팔레트

색 논리는 K1(단일 액센트·중립 우세), defaultTheme 은 dark 다 — 저장된 선택이 없으면 다크로 시작하고 라이트 토큰도 같은 대비 기준을 채운다.

**팔레트와의 관계(솔직히).** 위 SNS 팔레트 `pal-sns-instagram-dapad3qkle0-5`(바탕 `#020005` · 글자 `#FFAE2E` · 주색 `#F5042E`)는 「가장 가까운 SNS 팔레트로 기록」한 것이고 레시피 색의 출처가 아니다. 레시피 색은 refs-v2 색 논리 K 값에서 왔다. 레시피 DESIGN.md `references` 가 실제로 가리키는 바탕 팔레트는 `pal-ch-191919750e21e3651dbed754`(colorhunt, SNS 아님)이며, 레시피 다크 색(바탕 `oklch(0.2134 0 0)` · 글자 `oklch(0.8352 0.1578 119.1)` · 주색 `oklch(0.6531 0.1748 45.03)`)이 그 팔레트 값과 OKLCH 숫자까지 같다. OKLab 거리(SNS 팔레트 `pal-sns-instagram-dapad3qkle0-5` 의 같은 역할 색 ↔ 레시피의 가까운 쪽 모드): 바탕 0.151(다크 쪽이 가까움) · 글자 0.128(다크 쪽이 가까움) · 주색 0.112(다크 쪽이 가까움) — 0 이 같은 색이고 흰색↔검정이 약 1 이다. 곧 SNS 팔레트와는 색상각부터 다르다(레시피 주색은 주황 계열 45°, 글자는 연두 계열 119°).

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F6F8F2` | `oklch(0.975 0.008 119.1)` | `#191919` | `oklch(0.2134 0 0)` |
| foreground | `#1F191A` | `oklch(0.22 0.01 0)` | `#BED754` | `oklch(0.8352 0.1578 119.1)` |
| card | `#F6F8F2` | `oklch(0.975 0.008 119.1)` | `#191919` | `oklch(0.2134 0 0)` |
| primary | `#C24600*` | `oklch(0.5581 0.1748 45.03)` | `#E3651D` | `oklch(0.6531 0.1748 45.03)` |
| primary-foreground | `#F6F8F2` | `oklch(0.975 0.008 119.1)` | `#191919` | `oklch(0.2134 0 0)` |
| secondary | `#E8E8E2` | `oklch(0.9297 0.0081 111.95)` | `#262021` | `oklch(0.2507 0.0095 7.15)` |
| accent | `#E7E8D3` | `oklch(0.925 0.028 110.21)` | `#2F2124` | `oklch(0.2662 0.021 5.4)` |
| accent-foreground | `#1F191A` | `oklch(0.22 0.01 0)` | `#BED754` | `oklch(0.8352 0.1578 119.1)` |
| muted | `#EAEBE5` | `oklch(0.9372 0.0081 113.14)` | `#241F20` | `oklch(0.2445 0.0079 5.95)` |
| muted-foreground | `#554E4D` | `oklch(0.4314 0.0094 33.35)` | `#BCA637` | `oklch(0.7233 0.1294 97.66)` |
| border | `#D0CFC9` | `oklch(0.8542 0.0083 100.04)` | `#3D2C2C` | `oklch(0.3129 0.0252 19.06)` |
| input | `#8C8783` | `oklch(0.6277 0.0089 64.31)` | `#8C5F39` | `oklch(0.5243 0.0789 59.55)` |
| ring | `#C24600*` | `oklch(0.5581 0.1748 45.03)` | `#E3651D` | `oklch(0.6531 0.1748 45.03)` |

`*` 가 붙은 hex 는 sRGB 범위 밖이라 채널을 잘라 낸 근사값이다(OKLCH 값이 정본). 표는 DESIGN.md `color` 의 값을 그대로 옮겼다(상태색·차트색 생략).

레시피 머리 색을 `factory/scripts/lib/contrast-lib.mjs` 의 `ratio`(`node factory/scripts/contrast.mjs` 가 쓰는 같은 함수)로 직접 계산한 WCAG 대비:

| 쌍 | 라이트 | 다크 | 기준 |
|---|---|---|---|
| foreground / background | 16.18 PASS | 10.91 PASS | ≥ 7 |
| muted-foreground / background | 7.54 PASS | 7.21 PASS | ≥ 7 |
| primary / background | 4.69 PASS | 5.14 PASS | ≥ 4.5 |
| primary-foreground / primary | 4.69 PASS | 5.14 PASS | ≥ 4.5 |
| ring / background | 4.69 PASS | 5.14 PASS | ≥ 3 |

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 레시피 lint 의 팔레트 금지 검사가 위반 0 으로 통과한다(아래 lint 줄). 크림 바탕은 해당 없음(라이트 바탕 `oklch(0.975 0.008 119.1)` 은 채도 0.008).
색 논리 lint 와 레시피 lint(`recipe.mjs` 의 `lintRecipeReport` 를 import 해 DESIGN.md 머리에 직접 실행 — A안과 B안 적용본 모두 포함): 위반 0 · 경고 1
  - dark-default: dark background oklch(0.2134 0 0) — 다크 기본은 바탕 L 0.12~0.22·C 0.01~0.04(색조 있는 짙은 면, DESIGN §5-B div-05)
  - 이 레시피는 「## 운영자 확인 전」 절이 있어 `npm run gen:all` 이 아직 넣지 않는다 — 위 결과는 같은 함수를 직접 부른 것이다
  - 경고의 뜻: 다크 바탕 `oklch(0.2134 0 0)` 은 채도가 0 인 순수 회색이라 「색조 있는 짙은 면」 권장 대역(C 0.01~0.04)을 벗어났다 — 위반이 아니라 권고다.

**실측 ↔ 레시피.** 레퍼런스 두 곳의 바탕은 레시피 다크 바탕보다 훨씬 어둡다(cerebrium `#000000` · raycast `#07090A` ↔ 레시피 `#191919` 근처, L 0.2134). 레퍼런스의 강조는 분홍(`#FF488B`)·붉은색(`#DD2038`)이고 레시피 주색은 주황(색상각 45°) — 같은 색이 아니다. 레퍼런스 두 곳의 글자는 흰색(`#FFFFFF`)이고, 레시피는 라이트 바탕이 거의 흰 `#F6F8F2`(거리 0.026 — 같음)지만 다크 글자는 연두 `#BED754`다 — 이 다크 글자색이 레퍼런스와 가장 크게 다른 곳이다. 거리 기준은 이 카드 안에서만 쓰는 임의값이다(0.05 이하 같음 · 0.12 이하 비슷함 · 그 위 다름).

| 측정 색 | 측정 hex | 가장 가까운 레시피 색 | OKLab 거리 | 읽기 |
|---|---|---|---|---|
| cerebrium 바탕 | `#000000` | background(다크) `#191919` | 0.213 | 다름 |
| cerebrium 강조 단추 | `#FF488B` | primary(다크) `#E3651D` | 0.152 | 다름 |
| cerebrium 글자 | `#FFFFFF` | background(라이트) `#F6F8F2` | 0.026 | 같음 |
| raycast 바탕 | `#07090A` | background(다크) `#191919` | 0.076 | 비슷함 |
| raycast 강조 띠 | `#DD2038` | primary(라이트) `#C24600` | 0.090 | 비슷함 |
| raycast 보조 글자 | `#9C9C9D` | input(라이트) `#8C8783` | 0.066 | 비슷함 |

## 서체

레퍼런스가 실제로 쓰는 것(측정): cerebrium — 제목 ABC Favorit Trial 굵기 300(86.09px) · 본문 Suisse Intl · 내비·단추 라벨 Suisse Intl Mono(첫 화면 글자 수 79). raycast — Inter 굵기 600(64px) 하나와 Geist Mono(43자).
레시피가 실제로 쓰는 것(DESIGN.md `fonts`): display **Tenor Sans** 한 면(굵기 400) · body Pretendard · mono IBM Plex Mono. `displayKo` 는 없다.
관계: 서체 이름은 모두 다르다(**다름**). 굵기 결은 비슷하다 — cerebrium 의 가는 제목(300)과 Tenor Sans 400 은 둘 다 가벼운 제목이다. raycast 의 굵은 600 제목과는 다르다. 내비·단추 라벨이 고정폭이라는 역할은 같다(레시피 mono 는 IBM Plex Mono — 서체는 다름).

- 1순위 라틴 디스플레이: **Tenor Sans**
- 1순위 한글 제목: **Stylish**
- 본문 한글: Pretendard(레시피 값 유지)

한글 제목에 관해: 레시피에는 아직 displayKo 가 없다 — 현재 한글 제목은 본문 Pretendard 이고, 이 후보(Stylish)는 displayKo 로 더할 때의 1순위 제안이다(레시피는 이 카드가 바꾸지 않는다). 다른 카드와 한글 1순위가 겹치지 않게 `references/fonts/fonts.json`(398종, 한글 포함 94종)에서 골랐다 — Tenor Sans 는 가는 인문 기하 산세리프라서, 끝이 살짝 꺾인 장식 고딕으로 한글 전체 글자(11,172자)를 갖춘 Stylish 가 제목 결을 잇는다(fonts.json 이 Stylish 의 짝으로 Josefin Sans·Pretendard 를 적었다). 키트 항목(`registry/factory/fonts/`)은 아직 없어서 쓰려면 항목을 새로 만들어야 한다.

라틴 디스플레이 후보(순위순):

1. **Tenor Sans** — OFL 1.1 · 키트 항목 `font-tenor-sans` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/tenorsans/OFL.txt. 레시피가 지금 쓰는 값. fonts.json 선별본에도 있다(geometric · 우아한 인문 기하 — 갤러리·부티크 내비).
2. **Josefin Sans** — OFL 1.1 · Google Fonts · 100~700 가변 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 20년대 빈티지 기하 산세리프 — 패션·편집 소제목.
3. **Chakra Petch** — OFL 1.1 · Google Fonts · 굵기 300·400·500·600·700 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 사선으로 자른 테크노 산세리프 — e스포츠 대진표.

한글 제목 후보(순위순):

1. **Stylish** — OFL 1.1 · Google Fonts · 굵기 400 한 면 · 한글 11172자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 끝이 살짝 꺾인 장식 고딕 — 패션 잡지 캡션·레트로 라벨. 키트 항목은 아직 없다.
2. **Cafe24PROSlim** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 2350자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 좁게 압축한 한글 고딕 — 좁은 배너·숫자 강조 제목. 한글 2,350자만 담아 없는 글자는 본문으로 떨어진다 — 숫자·짧은 제목에만.
3. **Pretendard** — OFL 1.1 · 키트 항목 `font-pretendard` · 1차 출처 https://github.com/orioncactus/pretendard/blob/main/LICENSE. 현재 머리의 한글 제목(= 본문 가족). 안전한 대안.

대조: 위 순위는 `references/fonts/fonts.json` 의 라이선스(OFL 1.1 — google/fonts 1차 출처)·전달 경로·한글 범위 값을 그대로 읽은 것이다. r1~r10 카드의 한글 1순위(Nanum Gothic Coding·Do Hyeon·Song Myung·MaruBuri·Diphylleia·Pretendard GOV·NanumSquareRound·Gowun Batang·Bagel Fat One·Orbit)와 겹치지 않는다.

## 히어로 배치 2수

레시피 hero `narrow-title-wide-window`(블록 메타: 왼쪽 4칸 네 줄 제목·설명·버튼 둘, 오른쪽 8칸 공지 알약 아래 앱 창)와의 이음 — 수 1 의 「제목은 좁은 한쪽 열, 나머지는 넓은 쪽」 비율이 이어지고, 넓은 쪽을 채우는 것이 레퍼런스는 그림이고 레시피는 앱 창이라는 점이 다르다. 수 2 는 그림 위 가운데 정렬이라 이 hero 와 구조가 다르다(띠와 제목의 겹침 처리만 참고).

### 수 1 — 왼쪽 아래 세 줄 제목 + 오른쪽 열 설명·단추 한 쌍 (사이트 1)

1440: 제목 3줄(86.09px = 6vw, 굵기 300, 자간 -2.15216px, 행간 1.0)이 왼쪽 40px 에서 세로 약 62~90% 에 내려앉고, 설명 5줄과 단추 둘(높이 54px, 하나는 분홍 채움 하나는 반투명 어두운 면)이 오른쪽 열(가로 약 67%부터)에 놓인다. 위쪽 60%는 그림만 보인다. 390: 제목 45px(11.5vw) 세로 약 57~72%, 설명과 단추가 그 아래로 쌓이고 단추 둘은 가로로 나란하다.

### 수 2 — 가운데 두 줄 제목 뒤로 사선 띠가 지나가고 단추는 맨 아래 (사이트 2)

1440: 흰 두 줄 제목(64px = 4.4vw, 굵기 600, 행간 70.4px, 가운데 정렬)이 세로 약 42~56%, 붉은 흐린 사선 띠 여러 줄이 제목 뒤에서 왼쪽 위 → 오른쪽 아래로 지나간다. 설명 2줄(세로 약 61~64%)과 흰 계열 단추 하나(세로 약 90%)가 같은 가운데 축에 쌓이고, 단추 아래 고정폭 두 줄이 따라온다. 상단 내비는 가로 83% 의 테두리 막대로 떠 있다. 로드 직후 `fade-in-up` 1000ms 가 도는 요소가 29개. 390: 제목 36px(9.2vw) 세로 약 31~40%, 띠가 화면 폭 전체, 알약 단추 세로 약 71%.

## 모션 1수

- 카탈로그 id: `clip-reveal`
- 관측(1440): cerebrium 은 로드 직후 애니메이션 5개 — 덮개가 걷히는 `overlay-anim-out` 300ms 한 번과 로고 막대 `initial-loader-logo-bar` 1000ms 반복 4개(로딩 연출) · 전환 `transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1), opacity 0.2s …`(×65) · 스크롤 500px 뒤 다르게 움직인 요소 30/80. raycast 는 로드 직후 29개 — `fade-in-up` 1000ms 계열과 `rotating` 3000ms 무한 반복 · 전환 `opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.2s …`(×159) · :hover 규칙 124개 · 스크롤 16/30.
- 적용(레시피가 실제로 정한 값): 모션 M2 — `--duration-enter` 500ms · `--duration-hover` 200ms · `--ease-standard` `cubic-bezier(0.23, 1, 0.32, 1)`(`gen-kits.mjs` `MOTION_TOKENS` 의 M2 — raycast 가 관측된 전환에 쓰는 곡선과 같은 값이다). 기법 `clip-reveal` 은 clip-path 리빌(§8-6 표)이고, `clipReveal` 도우미(gsap-techniques.ts)의 기본 시작 방향은 아래, 연쇄 간격 기본값은 0.08초다. r11 DESIGN.md 본문은 이 기법을 걸 대상을 따로 적지 않았다 — 대상은 블록이 정한다.
- reduced-motion: 동작 줄이기에서는 장면 훅(`motion-gsap`)이 정지 갈래로 가서 끝 상태 그대로 그린다. 두 레퍼런스도 reduced-motion 규칙은 있다(측정).

## 복제하지 않는 것

- cerebrium 의 입체 리본 그림·로딩 막대 연출·로고·제목 문구와 raycast 의 붉은 사선 띠 그림·로고·제목 문구 — 그림·문구를 가져오지 않았다.
- 두 사이트의 서체 파일(ABC Favorit Trial·Suisse Intl·Inter·Geist Mono) — 라이선스를 확인하지 않아 가져오지 않았다. 레시피는 Tenor Sans·Pretendard·IBM Plex Mono 다.
- 분홍 `#FF488B`·붉은 `#DD2038` 강조색 — 레시피 주색은 주황 계열(색상각 45°)로 따로 정해져 있어 따라 하지 않았다.
- 두 사이트의 코드·이미지·로고·문구·유료 서체 파일·고유 일러스트 전부. 가져온 것은 hex 값(비교용 실측), 서체 선택, 배치 구조, 모션 기법과 시간 값뿐이다.
