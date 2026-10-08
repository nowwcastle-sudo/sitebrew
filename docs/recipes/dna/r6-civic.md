# r6-civic — 공공 신뢰 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B(색 논리·기법))이 정한 틀은 그대로다: colorLogic **K6** · defaultTheme **light** · motion **M1** · dynamics [view-transition, svg-draw]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://www.checkpointresearch.ca/ · 출처 `awwwards` · Nominee (2026-09) · 방문 2026-09-27T09:35Z
  - 1440 넓이 상위 색: `#FEFCFD` 84.3% · `#E2E6FB` 7.8% · `#17171A` 2.7% · `#C9D2FC` 1.9% · `#2552FC` 1.7% · `#707071` 0.2%
  - 390 넓이 상위 색: `#FFFDFD` 94.2% · `#2552FC` 3.4% · `#E5EAF6` 0.2% · `#99DCFD` 0.1%
  - 글자색(글자 수 순): `#17171A` · `#2552FC` · `#FFFDFD` · 버튼 바탕: `#2552FC` · `#FFFDFD` · `#FFFFFF`
  - 첫 화면 서체(글자 수 순): Jet Brains Mono(514) · Unbounded(65)
  - 가장 큰 글자 1440: Unbounded, Arial · 74.7px (5.2vw) · 굵기 500 · 자간 normal · 행간 67.23px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Unbounded, Arial · 41.5px (10.7vw) · 굵기 500 · 자간 normal · 행간 37.3815px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 1px 기준선 두 개(세로 50%, 가로 50%)가 첫 화면을 4분면으로 나누고 교차점에 파랑 「+」. 좌하 분면에 넓은 기하 제목 3줄 + mono 설명 2줄 + 직사각형 버튼 2개(파랑 채움 + 파랑 외곽선). 우상 분면에 옅은 보라 점묘 원형 면. 내비는 가운데 선 바로 오른쪽에 mono 대문자 세로 3줄, 우상단 파랑 버튼. 쿠키 창(점선 테두리)이 우하단을 덮었다(누르지 않음).
  - 모션 관측(1440): 로드 직후 애니메이션 1개(bulb-float 30000ms linear d0) · 무한 반복 1개+ · 전환 상위 `opacity 0.3s ease`(×102), `transform 0.4s ease`(×100) · 라이브러리 흔적 gsap·ScrollTrigger·lenis·webflow · :hover 규칙 24개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 1/3
- 사이트 2: https://www.krds.go.kr/ · 출처 `krds` · 범정부 UI/UX 디자인시스템 정본 · 방문 2026-09-27T09:36Z
  - 1440 넓이 상위 색: `#FEFEFE` 54.6% · `#1B2C45` 23.7% · `#11171E` 11% · `#1F3760` 5.8% · `#244382` 0.8% · `#286DF2` 0.7%
  - 390 넓이 상위 색: `#FEFEFE` 38% · `#132744` 25.7% · `#0E151F` 21.3% · `#1F385D` 4.8%
  - 글자색(글자 수 순): `#464C53` · `#FFFFFF` · `#1E2124` · 버튼 바탕: `#256EF4`
  - 첫 화면 서체(글자 수 순): Pretendard GOV(240)
  - 가장 큰 글자 1440: Pretendard GOV · 44px (3.1vw) · 굵기 700 · 자간 normal · 행간 66px · 대소문자 그대로 · 정렬 left
  - 가장 큰 글자 390: Pretendard GOV · 32px (8.2vw) · 굵기 700 · 자간 normal · 행간 48px · 대소문자 그대로 · 정렬 left
  - 구조(스크린샷 판독 + 상자 측정): 누리집 식별 띠(회색) → 유틸리티(English·글자·화면 설정) → 로고 + 메가메뉴 7개(chevron) → 폭 1200px 안쪽 반경 8px 짙은 남색 배너 카드(왼쪽 흰 제목·부제·파랑 버튼, 오른쪽 3D 그림) → 바로 섹션 제목(44px).
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `all 0.4s ease-in-out`(×306), `visibility, z-index, opacity 0.15s ease`(×3) · 라이브러리 흔적 없음 · :hover 규칙 101개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 3/3
- 팔레트: `pal-sns-instagram-dpbpoicj3j4-1` · https://www.instagram.com/p/DPBpOicj3J4/ · @arounda.agency · 원 역할 대비 fg/bg 19.96 · 주색 위 글자 5.61

## 팔레트

주색 `#1F57F5`는 팔레트(명료·신뢰) 값 그대로 — KRDS 버튼 `#256EF4`, Checkpoint `#2552FC`와 같은 자리. 글자 `#11171E`는 KRDS 첫 화면 넓이 3위(11%, 배너의 짙은 부분) 값으로, 측정된 본문 글자색 `#1E2124`보다 한 단계 짙다. 보조 글자 `#464C53`은 KRDS 설명 글자색 측정값 그대로. 면(field-1) `#1A3D95`는 KRDS 배너 남색(`#1B2C45`·`#1F3760`)을 K6 짙은 면 대역(C 0.08 이상)으로 올린 값. accent `#E2E6FB`는 Checkpoint 점묘 면 넓이 2위(7.8%) 그대로.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#0F141C` | `oklch(0.1900 0.0181 259.70)` |
| foreground | `#11171E` | `oklch(0.2018 0.0168 252.54)` | `#EEF1F6` | `oklch(0.9573 0.0074 260.73)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#161C26` | `oklch(0.2252 0.0216 260.53)` |
| primary | `#1F57F5` | `oklch(0.5315 0.2423 264.28)` | `#7FA5FF` | `oklch(0.7321 0.1377 265.76)` |
| primary-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#0F141C` | `oklch(0.1900 0.0181 259.70)` |
| accent | `#E2E6FB` | `oklch(0.9282 0.0288 277.23)` | `#1E2640` | `oklch(0.2747 0.0497 269.93)` |
| accent-foreground | `#11171E` | `oklch(0.2018 0.0168 252.54)` | `#E2E6FB` | `oklch(0.9282 0.0288 277.23)` |
| muted | `#F3F5F8` | `oklch(0.9695 0.0045 258.32)` | `#19202B` | `oklch(0.2418 0.0235 259.32)` |
| muted-foreground | `#464C53` | `oklch(0.4137 0.0141 252.24)` | `#B5BCC8` | `oklch(0.7934 0.0187 261.33)` |
| border | `#CDD1D5` | `oklch(0.8588 0.0071 247.91)` | `#2F3846` | `oklch(0.3383 0.0276 259.14)` |
| input | `#6D7882` | `oklch(0.5669 0.0203 245.59)` | `#7A8494` | `oklch(0.6106 0.0270 259.81)` |
| ring | `#1F57F5` | `oklch(0.5315 0.2423 264.28)` | `#7FA5FF` | `oklch(0.7321 0.1377 265.76)` |
| field-1 | `#1A3D95` | `oklch(0.3934 0.1505 264.14)` | `#223F92` | `oklch(0.3982 0.1415 265.66)` |
| field-1-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               18.03 >= 7 PASS
dark  --foreground / --background               16.31 >= 7 PASS
light --card-foreground / --card                18.03 >= 7 PASS
dark  --card-foreground / --card                15.10 >= 7 PASS
light --muted-foreground / --background          8.68 >= 7 PASS
dark  --muted-foreground / --background          9.67 >= 7 PASS
light --muted-foreground / --muted               7.95 >= 4.5 PASS
dark  --muted-foreground / --muted               8.57 >= 4.5 PASS
light --primary / --background                   5.61 >= 4.5 PASS
dark  --primary / --background                   7.67 >= 4.5 PASS
light --primary / --card                         5.61 >= 4.5 PASS
dark  --primary / --card                         7.11 >= 4.5 PASS
light --primary-foreground / --primary           5.61 >= 4.5 PASS
dark  --primary-foreground / --primary           7.67 >= 4.5 PASS
light --accent-foreground / --accent            14.55 >= 4.5 PASS
dark  --accent-foreground / --accent            12.05 >= 4.5 PASS
light --ring / --background                      5.61 >= 3 PASS
dark  --ring / --background                      7.67 >= 3 PASS
light --input / --background                     4.51 >= 3 PASS
dark  --input / --background                     4.89 >= 3 PASS
light --field-1-foreground / --field-1           9.79 >= 4.5 PASS
dark  --field-1-foreground / --field-1           9.57 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 0

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Checkpoint Research: Unbounded 500(제목 75px) + JetBrains Mono(본문·내비·버튼 전부), Doto도 싣는다. KRDS: Pretendard GOV 하나.

- 1순위 라틴 디스플레이: **Unbounded**
- 1순위 한글 제목: **Pretendard GOV**
- 본문 한글: Pretendard GOV(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Unbounded** — OFL 1.1 · Google Fonts · 200~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). Checkpoint 제목 서체 그대로. 넓은 기하 라틴이라 영문 표기·통계 숫자·「+」 기준선과 결이 맞는다. 한글 제목에는 섞지 않는다.
2. **Fragment Mono** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Checkpoint 본문 mono(JetBrains Mono는 10a가 흔한 기본값으로 기각) 자리 — 접수번호·날짜·단계 라벨.
3. **Doto** — OFL 1.1 · Google Fonts · 가변 · 10a 후보 풀에 있음(기각 표시 없음). 점 행렬 숫자 — 대기 인원·처리 현황 큰 수치 하나에만(Checkpoint도 싣는다).

한글 제목 후보(순위순):

1. **Pretendard GOV** — OFL 1.1 · 키트 항목 font-pretendard-gov(현재 값 유지). §21-8 MUST(public은 Pretendard GOV, 확장형은 고딕)라 한글 제목은 바꾸지 않는다. 차이는 라틴·숫자 서체와 배치로 낸다.
2. **IBM Plex Sans KR** — OFL 1.1 · 키트 항목. 공공 규칙이 풀리는 관련 사이트(재단·연구소)에서만 쓸 고딕 대안.
3. **Nanum Gothic Coding** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 고정폭 한글 — 접수번호·민원 번호 표 칸.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 십자 기준선 4분면 (사이트 1)

첫 화면을 1px border 색 기준선 두 개(세로 50%, 가로 50%)로 4분면으로 나누고 교차점에 12px 「+」 표식(primary). 좌하 분면에 제목 3줄(5.2vw, 굵기 500~700, 행간 0.9) + mono 설명 2줄 + 직사각형 버튼 2개(주: primary 채움, 보조: primary 외곽선, 반경 0). 우상 분면은 accent 색 점 격자(`radial-gradient` 점) 원형 면 하나. 내비는 가운데 세로선 바로 오른쪽에 세로 3줄. 390: 가로 기준선만 남기고 제목 10.7vw.

### 수 2 — 누리집 식별 띠 + 둥근 짙은 배너 카드 (사이트 2)

맨 위 32px 누리집 식별 띠(muted 바탕, 아이콘 + 한 줄) → 유틸리티 줄(English·글자/화면 설정) → 로고 + 메가메뉴 7개(chevron) → 폭 1200px 안쪽에 반경 8px field-1 배너 카드 한 장: 왼쪽 6칸 흰 제목(3.1vw, 굵기 700)·부제 2줄·primary 버튼(반경 6px, 높이 64px), 오른쪽 6칸 그림 자리. 배너 바로 아래 섹션 제목(44px). 390: 배너 좌우 16px 여백, 제목 8.2vw.

## 모션 1수

- 카탈로그 id: `svg-draw`
- 관측: KRDS 요소 300여 개에 `all 0.4s ease-in-out`, 스크롤 측정 요소 3개 모두 이동(배너 넘김). Checkpoint `transform 0.4s ease`, `opacity 0.3s ease`.
- 적용(M1): 신청 단계 표시(Stepper)의 연결선을 현재 단계까지 그린다 — `stroke-dashoffset` 400ms `ease-in-out`(KRDS 관측값, M1 `--ease-in-screen` 계열), 단계 점 색 전환 150ms(`--duration-hover`). 페이지 로드 한 번과 단계가 바뀔 때만. r1-measure와 같은 기법 id지만 대상(진행선)과 길이(400ms)가 다르다.
- reduced-motion: 선을 최종 길이로 바로, 색만 즉시 바뀐다.

## 복제하지 않는 것

- KRDS의 3D 그림·태극 표장·누리집 로고(정부 표장 사칭 금지)
- Checkpoint 로고·「Your R&D…」 문구·SR&ED 같은 서비스 내용
- 공공 기관처럼 보이게 하는 실제 기관명 — 예시에는 가상 기관 + 「예시」 표시
- Pretendard GOV 대신 장식 서체로 한글 제목을 바꾸는 것
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
