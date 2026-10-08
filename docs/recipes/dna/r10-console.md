# r10-console — 자홍 콘솔 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 A(그대로))이 정한 틀은 그대로다: colorLogic **K6** · defaultTheme **dark** · motion **M1** · dynamics [view-transition, svg-draw]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://linear.app/ · 출처 `saasframe` · landing-page p1 수록 · 방문 2026-09-27T09:41Z
  - 1440 넓이 상위 색: `#0A0B0C` 67.9% · `#191B1C` 27.5% · `#F6F7F7` 1.7% · `#323436` 0.6% · `#999CA1` 0.3% · `#6A6D73` 0.3%
  - 390 넓이 상위 색: `#0C0D0E` 82.8% · `#1C1D1E` 9.6% · `#F5F6F6` 2.1% · `#444649` 0.9%
  - 글자색(글자 수 순): `#8A8F98` · `#D0D6E0` · `#62666D` · 버튼 바탕: `#E5E5E6`
  - 첫 화면 서체(글자 수 순): Inter Variable(926) · Berkeley Mono(13)
  - 가장 큰 글자 1440: Inter Variable, SF Pro Display · 64px (4.4vw) · 굵기 510 · 자간 -1.408px · 행간 64px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: Inter Variable, SF Pro Display · 38px (9.7vw) · 굵기 510 · 자간 -0.836px · 행간 41.8px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 거의 검정 바탕. 제목 2줄 왼쪽 정렬(세로 30%), 그 아래 한 줄 설명과 같은 기준선 오른쪽 끝에 「New · 항목 →」. 세로 55%부터 폭 92% 앱 창(사이드바 232px + 본문 1072px, 1px 선)이 접힘선 너머로 이어진다. 알약 가입 버튼 하나.
  - 모션 관측(1440): 로드 직후 애니메이션 15개(grid-dot-0-0-upDown 2800ms linear d0, grid-dot-0-1-upDown 2800ms linear d0, grid-dot-0-2-upDown 2800ms linear d0 …) · 무한 반복 5개+ · 전환 상위 `color 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)`(×216), `color 0.1s ease`(×38) · 라이브러리 흔적 없음 · :hover 규칙 39개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/6
- 사이트 2: https://www.koyeb.com/ · 출처 `saasframe` · landing-page p1 수록 · 방문 2026-09-27T09:41Z
  - 1440 넓이 상위 색: `#EEEDE8` 78.6% · `#2D2B2D` 7.3% · `#000000` 3.9% · `#D8D7D4` 3.8% · `#3CFDA0` 2.5% · `#4DFCA7` 0.9%
  - 390 넓이 상위 색: `#EDECE7` 81.2% · `#41FDA2` 6% · `#000000` 4.8% · `#2D2B2D` 2.1%
  - 글자색(글자 수 순): `#E6E5DE` · `#000000` · `#181618` · 버튼 바탕: `#181618` · `#E6E5DE`
  - 첫 화면 서체(글자 수 순): JetBrains Mono(482) · ui-sans-serif(307) · Anton(48)
  - 가장 큰 글자 1440: Anton, Anton Fallback · 64px (4.4vw) · 굵기 400 · 자간 normal · 행간 64px · uppercase · 정렬 center
  - 가장 큰 글자 390: Anton, Anton Fallback · 42px (10.8vw) · 굵기 400 · 자간 normal · 행간 42px · uppercase · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 회백 그레인 바탕 위 1px 와이어프레임 구. 첫 화면 가운데 영역 네 모서리에 L자 재단 표시. 응축 대문자 제목 3줄 가운데 정렬, 마지막 낱말이 타자 커서와 함께 써지는 중. mono 대문자 버튼에 ▸ ◂ 표식, 아래쪽 딱딱한 그림자. 아래 가운데 터미널 창(신호등 점 3개)이 접힘선을 넘는다. 쿠키 창이 우하단을 덮었다(누르지 않음).
  - 모션 관측(1440): 로드 직후 애니메이션 15개(blink 1000ms linear d0, scroll 86400ms linear d0, scroll 86400ms linear d0 …) · 무한 반복 5개+ · 전환 상위 `all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`(×250), `color, background-color, border-color, outline-col 0.15s cubic-bezier(0.4, 0, 0.2, 1)`(×100) · 라이브러리 흔적 viewTimeline · :hover 규칙 2개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/2
- 팔레트: `pal-sns-instagram-dpbpoicj3j4-4` · https://www.instagram.com/p/DPBpOicj3J4/ · @arounda.agency · 원 역할 대비 fg/bg 20.37 · 주색 위 글자 5.61

## 팔레트

글자 `#09030E`와 자홍 계열(`#D934F7` → 다크 주색 `#E07BF5`, `#7E078F` → 면 `#6E1A7D`)은 팔레트(명료·믿음) 값에서 왔다. `#7E078F`는 C 0.20으로 K6 짙은 면 대역(C 0.18 이하) 밖이라 한 단계 낮췄다. 다크 바탕 `#17121C`는 Linear 넓이 1위 `#0A0B0C`(67.9%)를 다크 기본 대역(L 0.12~0.22, C 0.01~0.04)으로 올리고 자홍 쪽으로 기울인 값. 팔레트의 라임 `#BCF429`는 형광 한 점 금지(§13) 때문에 쓰지 않았다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#F6F5F8` | `oklch(0.9718 0.0041 301.43)` | `#17121C` | `oklch(0.1932 0.0212 307.24)` |
| foreground | `#09030E` | `oklch(0.1193 0.0319 311.41)` | `#EEEAF2` | `oklch(0.9424 0.0115 308.33)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#1E1825` | `oklch(0.2223 0.0263 305.42)` |
| primary | `#8A1FA3` | `oklch(0.4757 0.2048 318.89)` | `#E07BF5` | `oklch(0.7392 0.1960 320.52)` |
| primary-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#17121C` | `oklch(0.1932 0.0212 307.24)` |
| accent | `#F4E6F8` | `oklch(0.9413 0.0282 318.69)` | `#2A2033` | `oklch(0.2640 0.0373 308.05)` |
| accent-foreground | `#3A0A45` | `oklch(0.2634 0.1089 319.24)` | `#F3D9FA` | `oklch(0.9165 0.0521 319.03)` |
| muted | `#EFEDF2` | `oklch(0.9491 0.0070 304.24)` | `#1E1926` | `oklch(0.2254 0.0258 301.98)` |
| muted-foreground | `#4A4452` | `oklch(0.3979 0.0244 304.72)` | `#B9B0C4` | `oklch(0.7709 0.0298 305.94)` |
| border | `#D6D1DC` | `oklch(0.8679 0.0159 306.38)` | `#342B3F` | `oklch(0.3077 0.0372 304.87)` |
| input | `#756E80` | `oklch(0.5508 0.0287 303.11)` | `#7D7389` | `oklch(0.5722 0.0353 305.84)` |
| ring | `#A01FBF` | `oklch(0.5276 0.2352 318.43)` | `#E07BF5` | `oklch(0.7392 0.1960 320.52)` |
| field-1 | `#6E1A7D` | `oklch(0.4029 0.1661 321.00)` | `#6E1A7D` | `oklch(0.4029 0.1661 321.00)` |
| field-1-foreground | `#FBEFFF` | `oklch(0.9661 0.0246 317.72)` | `#FBEFFF` | `oklch(0.9661 0.0246 317.72)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               18.76 >= 7 PASS
dark  --foreground / --background               15.52 >= 7 PASS
light --card-foreground / --card                20.37 >= 7 PASS
dark  --card-foreground / --card                14.59 >= 7 PASS
light --muted-foreground / --background          8.63 >= 7 PASS
dark  --muted-foreground / --background          8.83 >= 7 PASS
light --muted-foreground / --muted               8.07 >= 4.5 PASS
dark  --muted-foreground / --muted               8.24 >= 4.5 PASS
light --primary / --background                   6.89 >= 4.5 PASS
dark  --primary / --background                   7.30 >= 4.5 PASS
light --primary / --card                         7.49 >= 4.5 PASS
dark  --primary / --card                         6.86 >= 4.5 PASS
light --primary-foreground / --primary           7.49 >= 4.5 PASS
dark  --primary-foreground / --primary           7.30 >= 4.5 PASS
light --accent-foreground / --accent            13.38 >= 4.5 PASS
dark  --accent-foreground / --accent            11.91 >= 4.5 PASS
light --ring / --background                      5.62 >= 3 PASS
dark  --ring / --background                      7.30 >= 3 PASS
light --input / --background                     4.50 >= 3 PASS
dark  --input / --background                     4.11 >= 3 PASS
light --field-1-foreground / --field-1           8.97 >= 4.5 PASS
dark  --field-1-foreground / --field-1           8.97 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 1
- 경고 recipe-caution: colorLogic=K6 × dashboard: 유채색 면은 운영 화면의 의미색(상태·차트)과 다툰다 — 면은 머리 띠·빈 상태 같은 한두 곳에만

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Linear: Inter Variable 510(제목 64px) + Berkeley Mono(유료, 라벨). Koyeb: Anton 대문자(제목 64px) + JetBrains Mono(내비·버튼) + 시스템 sans.

- 1순위 라틴 디스플레이: **Antonio**
- 1순위 한글 제목: **Orbit**
- 본문 한글: Pretendard(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Antonio** — OFL 1.1 · Google Fonts · 100~700 가변 · 10a 후보 풀에 있음(기각 표시 없음). Koyeb Anton의 좁은 대문자 결을 굵기 축으로 다듬은 산세리프 — 대시보드 큰 숫자·표 머리. Linear의 Inter 계열 제목과 달리 콘솔 수치가 먼저 읽힌다(Geist는 10a가 AI 과다 사용으로 기각).
2. **Anton** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). Koyeb 제목 서체 그대로 — 빈 상태 제목 하나에만.
3. **Azeret Mono** — OFL 1.1 · Google Fonts · 가변 · 10a 후보 풀에 있음(기각 표시 없음). Berkeley Mono 자리 — 행 ID·타임스탬프·키보드 단축키 라벨(JetBrains Mono는 10a 기각).

한글 제목 후보(순위순):

1. **Orbit** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 궤도처럼 둥근 기하 한글 — 테크 콘솔 화면 제목. 키트 Pretendard와 확연히 다르다. 표·목록에는 쓰지 않고 페이지 제목·빈 상태에만.
2. **Galmuri** — OFL 1.1 · npm galmuri → jsDelivr(GalmuriMono11 포함) · 10a 후보 풀에 있음(기각 표시 없음). 도트 한글 — 상태 라벨·단축키 안내.
3. **Pretendard** — OFL 1.1 · 키트 항목(현재 본문). 제목까지 본문 가족으로 되돌리는 안전한 대안.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 두 줄 제목 + 같은 기준선 새 소식 + 접힘선 아래 앱 창 (사이트 1)

제목 2줄(4.4vw, 굵기 510~600, 자간 -0.022em, 행간 1.0)을 세로 30%에 왼쪽 정렬, 그 아래 한 줄 설명과 같은 기준선의 오른쪽 끝에 「New · 항목 →」 링크. 세로 55%부터 폭 92% 앱 창(사이드바 232px + 본문, 1px border, 반경 12px, card 바탕)이 접힘선 너머로 이어진다. 앱 창 머리 띠만 field-1 자홍 먹 면(K6 한 곳). 390: 제목 9.7vw, 앱 창 폭 170%로 오른쪽 잘림.

### 수 2 — 재단 표시 + 타자 제목 + 딱딱한 그림자 버튼 (사이트 2)

첫 화면 가운데 영역 네 모서리에 16px L자 재단 표시(1px border). 그 안에 응축 대문자 제목 3줄 가운데 정렬(4.4vw, 행간 1.0), 마지막 낱말은 타자 커서(|)와 함께 한 글자씩 써진다. 버튼은 mono 대문자에 ▸ ◂ 표식, 아래쪽만 4px 딱딱한 그림자(`box-shadow: 0 4px 0 var(--foreground)`). 아래 가운데에 터미널 창 카드(신호등 점 3개 + mono 명령 4줄)가 접힘선을 넘고, 뒤에는 1px 선 와이어프레임 구 SVG.

## 모션 1수

- 카탈로그 id: `view-transition`
- 관측: Linear `transform 0.7s cubic-bezier(0.32, 0.72, 0, 1)`(요소 20개), `background 0.4s ease-out`, `color 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)`(216개), 격자 점 SVG 무한 애니메이션 82개(2800ms). Koyeb `all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`.
- 적용(M1): 목록 행 → 상세 패널로 갈 때 행의 제목·상태 칩이 상세 머리로 날아가 붙는다(`view-transition-name` 공유). `::view-transition-group` 300ms(`--duration-enter` M1) `cubic-bezier(0.32, 0.72, 0, 1)`(Linear 관측 곡선), 나머지는 교차 페이드 150ms. 지원 안 하는 브라우저는 즉시 교체. 무한 점 애니메이션은 따라 하지 않는다(dashboard는 매일 쓰는 화면).
- reduced-motion: `document.startViewTransition`을 부르지 않고 즉시 교체.

## 복제하지 않는 것

- Linear·Koyeb 앱 스크린샷·터미널 명령 문구·로고
- Berkeley Mono 서체 파일
- 팔레트의 형광 라임 `#BCF429` — 「거의 검정 + 형광 한 점」 금지(§13)
- Koyeb의 형광 민트 공지 띠, 격자 점 무한 애니메이션
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
