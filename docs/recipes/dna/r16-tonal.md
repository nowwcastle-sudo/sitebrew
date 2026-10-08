# r16-tonal — 단색 음영 · 레퍼런스 DNA 카드

> 이 카드는 레시피(DESIGN.md)가 이미 있는 뒤에 쓴 사후 기록이다 — 레퍼런스 실측과 레시피가 실제로 쓰는 값을 나란히 적고, 어디가 같고 어디가 다른지 밝힌다. 레시피 값을 이 카드가 바꾸지 않는다.
> 레시피 틀(DESIGN.md 에서 읽음): colorLogic **K9** · defaultTheme 명시 없음(라이트가 기본) · motion **M2** · dynamics [mesh-gradient, split-text] · hero `video-montage` · 원형 landing·brand. 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다는 기록이 DESIGN.md 에 있다.
> 측정: headless Chrome(CDP)으로 첫 화면 1440×900과 390×844, 요청 사이 10초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 임시 폴더)에만 있다.

## 출처

- 사이트 1: https://www.supaste.com/ · 출처 `onepagelove` · refs-v2 카드(landing·색 논리 K9) 수록 · 방문 2026-10-11T14:35Z
  - 1440 넓이 상위 색: `#90DAFF` 5.6% · `#98DCFE` 4.7% · `#82D5FF` 4.4% · `#000000` 3.8% · `#8CD9FF` 3.6% · `#0A82FC` 3.4%
  - 390 넓이 상위 색: `#000000` 13.8% · `#FFFFFF` 8.9% · `#F7F7F7` 4.2% · `#48B1FF` 2.7% · `#45AFFF` 2.5% · `#0A82FC` 2.5%
  - 글자색(글자 수 순): `#FFFFFF` · `#000000` · 버튼 바탕: `#FFFFFF` · `#000000`
  - 첫 화면 서체(글자 수 순): Inter Display(656) · Instrument Serif(13) · Inter(12)
  - 가장 큰 글자 1440: Inter Display · 20px (1.4vw) · 굵기 400 · 자간 -0.2px · 행간 28px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Inter Display · 16px (4.1vw) · 굵기 600 · 자간 -0.32px · 행간 19.2px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 위에서 아래로 짙은 파랑(`#0A82FC` 계열)에서 하늘색(`#90DAFF` 계열)으로 번지는 그라디언트 바탕(색 넓이 상위가 하늘색 네 단계와 파랑 합 약 22%, 검정 3.8% 는 내비와 단추). 검은 알약 내비(폭 710px, 가로 49%, 세로 0~6%, 아래 모서리만 둥글다: 로고·메뉴 여섯·흰 다운로드 단추)가 위에 붙고, 가운데 정렬 글이 쌓인다 — 작은 범주 라벨(세로 17%), 제목 2줄(굵은 직립 한 줄 + 이탤릭 세리프 한 줄, 세로 21~38%), 설명 3줄(세로 42~48%), 검은 알약 단추 하나(폭 약 240px, 세로 52~58%), 작은 신뢰 문구 셋(61%). 그 아래 약 38%는 그라디언트만 남는다. 오른쪽 끝에 검은 세로 탭이 붙어 있다. 측정된 가장 큰 글자는 20px(설명)이고 제목은 글자 상자 측정에 잡히지 않았다. 390: 단추가 폭 전체(세로 44~50%), 제품 창 그림과 풍경이 세로 63%부터.
  - 모션 관측(1440): 로드 직후 애니메이션 2개(circularTextRotateCW 20000ms linear, circularTextRotateCW 20000ms linear) · 무한 반복 2개 · 전환 상위 `all`(×1394), `color 0.25s`(×84) · 라이브러리 흔적 framer, video(10) · :hover 규칙 10개 · reduced-motion 규칙 없음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 13/80
- 사이트 2: https://cityxofxangels.com/ · 출처 `onepagelove` · refs-v2 카드(landing·색 논리 K9) 수록 · 방문 2026-10-11T14:35Z
  - 1440 넓이 상위 색: `#E4F8FD` 61.7% · `#06AEEF` 4% · `#8BB8E1` 0.9% · `#000000` 0.8% · `#606060` 0.6% · `#5A6264` 0.5%
  - 390 넓이 상위 색: `#E4F8FD` 51.6% · `#06AEEF` 4.4% · `#000000` 1.5% · `#BBDDF6` 0.9% · `#686868` 0.7% · `#616A6C` 0.7%
  - 글자색(글자 수 순): `#000000` · `#06AEEF` · 버튼 바탕: 측정 안 됨(버튼 요소 0개)
  - 첫 화면 서체(글자 수 순): ABC Diatype(2398) · Founders Grotesk Mono(73)
  - 가장 큰 글자 1440: ABC Diatype · 144px (10vw) · 굵기 800 · 자간 normal · 행간 136.8px · uppercase · 정렬 center
  - 가장 큰 글자 390: ABC Diatype · 78px (20vw) · 굵기 800 · 자간 normal · 행간 64.35px · uppercase · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 연한 하늘색 바탕 `#E4F8FD`(61.7%). 세로로 긴 인물 사진(폭 533px, 가로 31~69%, 세로 5~95%)이 가운데에 서고, 하늘색 `#06AEEF` 대문자 제목 한 줄이 가로 82%(x 128~1312)로 사진 위를 가로질러 세로 14~27%에 겹친다. 위 가운데에 작은 대문자 이름, 오른쪽 위에 메뉴 아이콘 하나, 왼쪽 아래(세로 64~94%)에 소개 문단(앞쪽 몇 낱말만 하늘색), 오른쪽 아래(세로 91~98%)에 검은 별 아이콘. 단추가 없다(버튼 요소 0개). 390: 제목 2줄이 세로 8~23%에서 사진 윗부분(세로 19~66%)과 겹치고, 문단은 가운데 정렬로 세로 69~91%.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0개 · 전환 상위 `all`(×90), `opacity 0.75s cubic-bezier(0.76, 0, 0.24, 1), transform 0.75s cubic-bezier(0.76, 0, 0.24, `(×7) · 라이브러리 흔적 lenis · :hover 규칙 9개 · reduced-motion 규칙 없음 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 67/68
- 팔레트: `pal-sns-instagram-dudjznijp9d-4` · https://www.instagram.com/p/DUDjznIjP9d/ · @zehra_syed63_graphics · 원 역할 대비 fg/bg 11.08 · 주색 위 글자 11.08

## 팔레트

색 논리는 K9(단색 램프)이고 defaultTheme 은 머리에 없어 라이트가 기본이다. 채도 0.05 이상인 색은 모두 한 색상각(262° 근처)이고 위계는 명도 단계 다섯(바탕·면·선·주색·글자)으로 만든다. 상태색만 예외다.

**팔레트와의 관계(솔직히).** 위 SNS 팔레트 `pal-sns-instagram-dudjznijp9d-4`(바탕 `#C7DDEB` · 글자와 주색 `#0A2540`, 조용한 럭셔리 두 색)는 「가장 가까운 SNS 팔레트로 기록」한 것이고 레시피 색은 이 팔레트에서 직접 가져온 것이 아니다 — 레시피 색은 refs-v2 색 논리 K 값에서 왔다. OKLab 거리(SNS 팔레트 `pal-sns-instagram-dudjznijp9d-4` 의 같은 역할 색 ↔ 레시피의 가까운 쪽 모드): 바탕 0.092(라이트 쪽이 가까움) · 글자 0.062(라이트 쪽이 가까움) · 주색 0.180(라이트 쪽이 가까움) — 0 이 같은 색이고 흰색↔검정이 약 1 이다. 팔레트의 주색은 글자와 같은 짙은 남색(L 0.26)인데 레시피 주색은 그보다 훨씬 밝은 중간 단계(L 0.42)라 거리가 가장 크다(0.180). 팔레트 바탕은 연한 하늘 청색(L 0.89)이고 레시피 라이트 바탕은 거의 흰 남청(L 0.975)이다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F2F7FF*` | `oklch(0.9750 0.0120 262.00)` | `#070F1F` | `oklch(0.1700 0.0350 262.00)` |
| foreground | `#09152C` | `oklch(0.2000 0.0500 262.00)` | `#E9EFF9` | `oklch(0.9500 0.0150 262.00)` |
| card | `#FCFDFF*` | `oklch(0.9950 0.0050 262.00)` | `#0E182B` | `oklch(0.2100 0.0400 262.00)` |
| primary | `#1E4798` | `oklch(0.4200 0.1400 262.00)` | `#91B7FE` | `oklch(0.7800 0.1100 262.00)` |
| primary-foreground | `#F5F9FF*` | `oklch(0.9800 0.0100 262.00)` | `#060F21` | `oklch(0.1700 0.0400 262.00)` |
| secondary | `#DDE8FD` | `oklch(0.9300 0.0300 262.00)` | `#18243A` | `oklch(0.2600 0.0450 262.00)` |
| accent | `#BFD8FF*` | `oklch(0.8800 0.0700 262.00)` | `#203761` | `oklch(0.3400 0.0800 262.00)` |
| accent-foreground | `#0A1936` | `oklch(0.2200 0.0600 262.00)` | `#E9EFF9` | `oklch(0.9500 0.0150 262.00)` |
| muted | `#E7EFFC` | `oklch(0.9500 0.0200 262.00)` | `#172135` | `oklch(0.2500 0.0400 262.00)` |
| muted-foreground | `#41506C` | `oklch(0.4300 0.0500 262.00)` | `#92A2BE` | `oklch(0.7100 0.0450 262.00)` |
| border | `#C6D2E5` | `oklch(0.8600 0.0300 262.00)` | `#27354F` | `oklch(0.3300 0.0500 262.00)` |
| input | `#4D638B` | `oklch(0.5000 0.0700 262.00)` | `#526587` | `oklch(0.5050 0.0600 262.00)` |
| ring | `#1E4798` | `oklch(0.4200 0.1400 262.00)` | `#91B7FE` | `oklch(0.7800 0.1100 262.00)` |

`*` 가 붙은 hex 는 sRGB 범위 밖이라 채널을 잘라 낸 근사값이다(OKLCH 값이 정본). 표는 DESIGN.md `color` 의 값을 그대로 옮겼다(상태색 생략).

레시피 머리 색을 `factory/scripts/lib/contrast-lib.mjs` 의 `ratio`(`node factory/scripts/contrast.mjs` 가 쓰는 같은 함수)로 직접 계산한 WCAG 대비:

| 쌍 | 라이트 | 다크 | 기준 |
|---|---|---|---|
| foreground / background | 16.89 PASS | 16.55 PASS | ≥ 7 |
| muted-foreground / background | 7.56 PASS | 7.43 PASS | ≥ 7 |
| primary / background | 8.06 PASS | 9.52 PASS | ≥ 4.5 |
| primary-foreground / primary | 8.18 PASS | 9.52 PASS | ≥ 4.5 |
| ring / background | 8.06 PASS | 9.52 PASS | ≥ 3 |

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 레시피 lint 의 팔레트 금지 검사가 위반 0 으로 통과한다(아래 lint 줄). 크림 바탕은 해당 없음(라이트 바탕 색상각 262°).
색 논리 lint 와 레시피 lint(`recipe.mjs` 의 `lintRecipeReport` 를 import 해 DESIGN.md 머리에 직접 실행 — A안과 B안 적용본 모두 포함): 위반 0 · 경고 0
  - `npm run gen:all` 이 도는 레시피다(`registry/factory/recipes/r16-tonal/README.generated.md` 가 생성물로 있다).

**실측 ↔ 레시피.** 레퍼런스 2 의 바탕 `#E4F8FD` 는 레시피 라이트 바탕(`oklch(0.975 0.012 262)`)과 0.019 로 같은 쪽이다 — 연한 파랑 바탕이라는 K9 의 결이다. 레퍼런스 2 의 하늘색 강조 `#06AEEF` 는 레시피 다크 주색과 0.102 로 비슷한 정도이고, 레퍼런스 1 의 파랑 `#0A82FC`(L 0.618 · C 0.204 · 색상각 255.6°)는 가장 가까운 레시피 색도 0.179 로 다르다(레시피 주색의 채도는 라이트 0.14·다크 0.11 로 이보다 낮다). 레퍼런스 1 의 순수 검정 `#000000` 과 레퍼런스 2 의 글자 검정은 레시피에 없다 — 가장 어두운 레시피 색이 다크 바탕 `#070F1F` 이고 0.174 떨어진다. 거리 기준은 이 카드 안에서만 쓰는 임의값이다(0.05 이하 같음 · 0.12 이하 비슷함 · 그 위 다름).

| 측정 색 | 측정 hex | 가장 가까운 레시피 색 | OKLab 거리 | 읽기 |
|---|---|---|---|---|
| supaste 파랑 | `#0A82FC` | input(라이트) `#4D638B` | 0.179 | 다름 |
| supaste 하늘 | `#90DAFF` | accent(라이트) `#BFD8FF` | 0.054 | 비슷함 |
| supaste 검정 | `#000000` | background(다크) `#070F1F` | 0.174 | 다름 |
| cityxofxangels 바탕 | `#E4F8FD` | background(라이트) `#F2F7FF` | 0.019 | 같음 |
| cityxofxangels 강조 | `#06AEEF` | primary(다크) `#91B7FE` | 0.102 | 비슷함 |
| cityxofxangels 글자 | `#000000` | background(다크) `#070F1F` | 0.174 | 다름 |

## 서체

레퍼런스가 실제로 쓰는 것(측정): supaste — Inter Display 가 첫 화면 글자 대부분(656자)이고 Instrument Serif(13자)가 이탤릭 제목 줄에 쓰인다(스크린샷 판독) · Inter(12자). cityxofxangels — ABC Diatype 하나(2398자, 제목 144px 굵기 800 대문자) + Founders Grotesk Mono(73자).
레시피가 실제로 쓰는 것(DESIGN.md `fonts`): display **Jost** 굵기 500(자간 -0.015em, 행간 1.08, 숫자 라이닝) · body Pretendard(16px/1.65) · mono IBM Plex Mono(앱 창 안 코드·단축키). `displayKo` 는 없다. B안은 제목체를 Noto Serif KR(굵기 600)로 바꾼다.
관계: 서체 이름은 모두 다르다(**다름**) — Jost 는 기하 산세리프이고 Inter Display·ABC Diatype 은 그로테스크 산세리프다. 굵기도 다르다(레시피 500, 레퍼런스 2 의 큰 제목 800, 레퍼런스 1 의 제목은 굵은 직립 줄). 레퍼런스 1 의 이탤릭 세리프 한 줄은 레시피 A안에 없고 B안의 세리프 제목체(Noto Serif KR)가 세리프 쪽이다.

- 1순위 라틴 디스플레이: **Jost**
- 1순위 한글 제목: **NaturalSans**
- 본문 한글: Pretendard(레시피 값 유지)

한글 제목에 관해: 레시피에는 아직 displayKo 가 없다 — 현재 한글 제목은 본문 Pretendard 이고, 이 후보(NaturalSans)는 displayKo 로 더할 때의 1순위 제안이다(레시피는 이 카드가 바꾸지 않는다). 다른 카드와 한글 1순위가 겹치지 않게 `references/fonts/fonts.json`(398종, 한글 포함 94종)에서 골랐다 — Jost 가 기하 산세리프라서 fonts.json 에서 분류가 geometric 인 한글 서체(곡선의 산세리프, 한글 11,172자)를 짝으로 골랐다. 키트 항목 `font-natural-sans` 가 이미 있다. 다만 fonts-assignment.md 에서 r7-docs B안의 한글 제목체가 같은 NaturalSans 다 — 카드 1순위끼리는 겹치지 않지만 r7 B안과는 한글 제목이 같아진다.

라틴 디스플레이 후보(순위순):

1. **Jost** — OFL 1.1 · 키트 항목 `font-jost` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/jost/OFL.txt. 레시피가 지금 쓰는 값.
2. **League Spartan** — OFL 1.1 · Google Fonts · 100~900 가변 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 퓨추라풍 굵은 기하 — 브랜드 워드마크·포스터.
3. **Noto Serif KR** — OFL 1.1 · 키트 항목 `font-noto-serif-kr` · 1차 출처 https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt. 레시피 B안의 제목체(굵기 600, 한글은 같은 서체의 한글 면).

한글 제목 후보(순위순):

1. **NaturalSans** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 11172자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 자연물에서 딴 곡선의 산세리프 — 친환경·로컬 브랜드 제목. 키트 항목 `font-natural-sans` 이 이미 있다. 라이선스 근거는 제작자 페이지(fonts.json license.note 에 확인 날짜가 있다).
2. **PyeojinGothic** — OFL 1.1 · 눈누 미러(jsDelivr) · 굵기 400 한 면 · 한글 11172자 · fonts.json 에 있음(aiOverused false·기각 표시 없음) · 옆으로 펼친 고딕 — 넓은 제목·브랜드 워드마크. 키트 항목 `font-pyeojin-gothic` 이 이미 있다.
3. **Pretendard** — OFL 1.1 · 키트 항목 `font-pretendard` · 1차 출처 https://github.com/orioncactus/pretendard/blob/main/LICENSE. 현재 머리의 한글 제목(= 본문 가족).

대조: 위 순위는 `references/fonts/fonts.json` 과 키트 항목 메타의 라이선스·전달 경로·한글 범위 값을 그대로 읽은 것이다. r1~r10 카드의 한글 1순위(Nanum Gothic Coding·Do Hyeon·Song Myung·MaruBuri·Diphylleia·Pretendard GOV·NanumSquareRound·Gowun Batang·Bagel Fat One·Orbit)와 겹치지 않는다.

## 히어로 배치 2수

레시피 hero `video-montage`(블록 메타: 첫 화면 위 78% 무대에서 짧은 컷이 3.2초 간격 하드 컷으로 이어지고 그 위 막 위에 큰 제목)와의 이음 — 두 레퍼런스 모두 영상 컷이 첫 화면에 없다(수 1 은 그라디언트 면, 수 2 는 사진 한 장). 「큰 면 하나 + 그 위 큰 제목」이라는 구성만 이어진다. 수 2 의 제목이 사진을 가로지르며 겹치는 방식은 레시피에서 같은 색상각의 짙은 막 위 제목으로 바뀐다.

### 수 1 — 위에서 아래로 번지는 단색 하늘 + 가운데 쌓은 글 + 아래 비워 둔 칸 (사이트 1)

1440: 검은 알약 내비(폭 710px, 세로 0~6%)가 위에 붙고, 파랑에서 하늘색으로 번지는 그라디언트 위에 가운데 정렬 글이 세로로 쌓인다 — 범주 라벨 세로 17%, 제목 2줄(굵은 직립 줄 + 이탤릭 세리프 줄)이 21~38%, 설명 3줄(20px = 1.4vw, 행간 28px)이 42~48%, 검은 알약 단추 52~58%, 신뢰 문구 61%. 그 아래 약 38%는 그라디언트만 남는다. 측정된 파랑 `#0A82FC` 위에 흰 글자를 얹으면 대비 3.74:1, 하늘색 `#90DAFF` 위는 1.54:1 이다(바탕이 번지므로 글자 자리마다 값이 다르다). 로드 직후 `circularTextRotateCW` 20000ms 두 개(무한)가 돈다. 390: 설명이 16px(4.1vw) 굵기 600, 단추가 폭 전체.

### 수 2 — 하늘색 바탕에 사진 위를 가로지르는 초대형 대문자 제목 (사이트 2)

1440: 연한 하늘색 `#E4F8FD` 바탕 한가운데에 세로로 긴 인물 사진(폭 533px = 37%, 세로 5~95%)이 서고, 하늘색 `#06AEEF` 대문자 제목 한 줄(144px = 10vw, 굵기 800, 행간 136.8px)이 가로 82% 로 사진 위를 가로질러 세로 14~27% 에 겹친다. 왼쪽 아래 소개 문단(세로 64~94%)과 오른쪽 아래 검은 별 아이콘이 첫 화면의 아래 모서리를 잡는다. 단추가 없다(버튼 요소 0개). 390: 제목 78px(20vw) 2줄이 세로 8~23% 에서 사진 윗부분과 겹치고, 문단은 가운데 정렬.

## 모션 1수

- 카탈로그 id: `mesh-gradient`
- 관측(1440): supaste 는 로드 직후 `circularTextRotateCW` 20000ms 두 개(무한, 회전 글자 배지)뿐 · 전환 `all`(×1394)과 `color 0.25s`(×84) · 라이브러리 흔적 framer·video(10) · :hover 규칙 10개 · reduced-motion 규칙 없음 · 스크롤 500px 뒤 다르게 움직인 요소 13/80. cityxofxangels 는 로드 직후 애니메이션 0개 · 전환 `opacity 0.75s cubic-bezier(0.76, 0, 0.24, 1), transform 0.75s …`(×7) · 라이브러리 흔적 lenis(부드러운 스크롤) · 스크롤 67/68 · reduced-motion 규칙 없음. **번지는 그라디언트의 움직임은 두 곳 모두 로드 직후 관측되지 않았다**(supaste 의 그라디언트는 정지로 읽힌다) — mesh-gradient 는 레시피가 정한 기법이다.
- 적용(레시피가 실제로 정한 값): 모션 M2 — `--duration-enter` 500ms · `--duration-hover` 200ms · `--duration-sheet` 320ms · `--ease-standard` `cubic-bezier(0.23, 1, 0.32, 1)`(`gen-kits.mjs` `MOTION_TOKENS` 의 M2). DESIGN.md 본문: 바탕은 같은 색상각의 메시 그라디언트가 느리게 번지고 제목은 글자 분할로 등장한다. 메시 그라디언트에는 다른 색상각을 섞지 않고 명도 차로만 번진다(DESIGN.md 하지 말 것). 레퍼런스 2 의 전환 0.75초(`cubic-bezier(0.76, 0, 0.24, 1)`)는 M2 등장 500ms 보다 길다.
- reduced-motion: 동작 줄이기에서는 장면 훅(`motion-gsap`)이 정지 갈래로 가서 끝 상태 그대로 그린다(video-montage 는 첫 컷 포스터만 — 블록 메타). 두 레퍼런스에는 reduced-motion 규칙이 없다(측정).

## 복제하지 않는 것

- supaste 의 앱 아이콘·로고·제품 창 그림·풍경 그림·수상 배지·문구, cityxofxangels 의 인물 사진·별 아이콘·저자 이름·책 소개 문구 — 그림·로고·문구를 가져오지 않았다.
- 두 사이트의 서체 파일(Inter Display·Instrument Serif·ABC Diatype·Founders Grotesk Mono) — 가져오지 않았다. 레시피는 Jost·Pretendard·IBM Plex Mono 다.
- supaste 의 하늘색까지 밝아지는 그라디언트 위 흰 글자 — 측정된 파랑 위 흰 글자 대비가 3.74:1, 하늘색 위 1.54:1 로 레시피의 본문 7:1 기준에 못 미쳐 따라 하지 않았다(레시피는 같은 색상각의 짙은 막 위에 글을 얹는다). 두 번째 색상각(검정 단추·검정 글자)도 따르지 않았다 — K9 는 한 색상각만 쓴다.
- 두 사이트의 코드·이미지·로고·문구·유료 서체 파일·고유 일러스트 전부. 가져온 것은 hex 값(비교용 실측), 서체 선택, 배치 구조, 모션 기법과 시간 값뿐이다.
