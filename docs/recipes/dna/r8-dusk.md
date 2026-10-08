# r8-dusk — 솔숲 저녁 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 A(그대로))이 정한 틀은 그대로다: colorLogic **K6** · defaultTheme **light** · motion **M3** · dynamics [split-text, clip-reveal, sticky-stack]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://white-desert.com/ · 출처 `awwwards` · SOTD 2026-09-11 · 방문 2026-09-27T09:39Z
  - 1440 넓이 상위 색: `#98A2AF` 64.1% · `#FEFEFE` 7.6% · `#5B6263` 6% · `#09090A` 5.3% · `#848D99` 3.9% · `#E2E4E5` 3%
  - 390 넓이 상위 색: `#44626E` 66.9% · `#DDE2E5` 9.2% · `#5B7681` 6.9% · `#F6F7F7` 3%
  - 글자색(글자 수 순): `#1F2A44` · `#FFFFFF` · 버튼 바탕: `#1E2846` · `#222843`
  - 첫 화면 서체(글자 수 순): Inter Tight(160) · Cardinal Classic Long(54) · Oswald(10)
  - 가장 큰 글자 1440: Oswald, Arial Narrow · 256px (17.8vw) · 굵기 400 · 자간 normal · 행간 256px · uppercase · 정렬 center
  - 가장 큰 글자 390: Oswald, Arial Narrow · 80px (20.5vw) · 굵기 400 · 자간 normal · 행간 80px · uppercase · 정렬 center
  - 구조(스크린샷 판독 + 상자 측정): 전폭 영상 위에 12칸 격자 세로선이 그대로 보인다(1px). 한 낱말 제목을 응축 대문자 256px(17.8vw)로 가운데 정렬해 화면 아래 끝에 걸친다. 왼쪽에 이탤릭 세리프 캡션 2줄, 오른쪽에 위아래 선 사이 「Watch Film ▶」. 내비는 반투명 회색 네모 칸 버튼 왼쪽 3·오른쪽 2, 로고 가운데. 쿠키 띠가 우하단을 덮었다(누르지 않음).
  - 모션 관측(1440): 로드 직후 애니메이션 6개(transform 1000ms cubic-bezier(0.16, 1, 0.3, 1) d0, reveal-opacity 1400ms linear d0, reveal-transform 1400ms linear d0 …) · 무한 반복 3개+ · 전환 상위 `all 0.3s cubic-bezier(0.5, 1, 0.89, 1)`(×127), `transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)`(×5) · 라이브러리 흔적 lenis·viewTimeline · :hover 규칙 7개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 3/3
- 사이트 2: https://villa-banwoo.imweb.me/ · 출처 `imweb` · 숙박여행 제작사례 · 방문 2026-09-27T09:39Z
  - 1440 넓이 상위 색: `#322413` 18.7% · `#39649B` 15.8% · `#4B7BB9` 9.4% · `#6196D2` 7.8% · `#50351C` 7.4% · `#0B0A0A` 6.3%
  - 390 넓이 상위 색: `#2F2618` 20.2% · `#0057B9` 16.3% · `#FFFFFF` 9.5% · `#507DBB` 7.5%
  - 글자색(글자 수 순): `#FFFFFF` · `#000000`
  - 첫 화면 서체(글자 수 순): SourceHanSerifKR(52) · Alegreya(37)
  - 가장 큰 글자 1440: SourceHanSerifKR, Apple SD Gothic Neo · 25px (1.7vw) · 굵기 400 · 자간 10px · 행간 40px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: SourceHanSerifKR, Apple SD Gothic Neo · 20px (5.1vw) · 굵기 400 · 자간 10px · 행간 32px · 대소문자 그대로 · 정렬 start
  - 판독 메모: 가장 큰 글자는 가운데 세로쓰기 세리프 한글(자간 10px) — 한 글자 폭 칸에 세로로 흐른다.
  - 구조(스크린샷 판독 + 상자 측정): 저녁 하늘·소나무·조명 켜진 한옥 스테이 사진 슬라이드가 전폭, 가운데에 세로로 쓴 세리프 한글(자간 10px), 좌상단 선화 로고, 우상단 세리프 대문자 내비, 아래 가운데 슬라이드 눈금. 안내 팝업 두 장이 가운데를 덮었다(누르지 않음).
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `all 0.3s ease`(×44), `color, background, border-color 0.3s ease-out`(×23) · 라이브러리 흔적 없음 · :hover 규칙 107개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 2/4
- 팔레트: `pal-sns-instagram-dbdclihjjlc-1` · https://www.instagram.com/p/DbdclIhjJLc/ · @pixelvibz.design · 원 역할 대비 fg/bg 13.15 · 주색 위 글자 8.42

## 팔레트

주색 `#004C37`·글자 `#0D281C`는 팔레트(럭셔리·시간) 값 그대로, 면(field-1) 솔 `#00563E`는 그 한 단계 밝은 값. 면 2(field-2) 저녁 파랑 `#2E568C`는 Villa Banwoo 하늘 넓이 2위 `#39649B`(15.8%)를 짙은 면 대역으로 옮긴 값. 바탕 `#EEF0F1`은 White Desert 넓이 1위 안개 회청 `#98A2AF`(64%)를 바탕 밝기로 올린 값. 팔레트의 `#F0EAE3`(따뜻한 흰)은 크림 경계라 바탕으로 쓰지 않았다.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#EEF0F1` | `oklch(0.9539 0.0025 228.78)` | `#0C1512` | `oklch(0.1855 0.0148 172.00)` |
| foreground | `#0D281C` | `oklch(0.2515 0.0405 162.20)` | `#E9EEE9` | `oklch(0.9439 0.0085 145.51)` |
| card | `#F7F8F8` | `oklch(0.9784 0.0011 197.14)` | `#13201B` | `oklch(0.2295 0.0207 168.57)` |
| primary | `#004C37` | `oklch(0.3696 0.0758 166.97)` | `#A9C98A` | `oklch(0.7966 0.0919 130.14)` |
| primary-foreground | `#EEF0F1` | `oklch(0.9539 0.0025 228.78)` | `#0C1512` | `oklch(0.1855 0.0148 172.00)` |
| accent | `#DDE3DC` | `oklch(0.9093 0.0114 141.26)` | `#1B2A24` | `oklch(0.2693 0.0232 167.85)` |
| accent-foreground | `#0D281C` | `oklch(0.2515 0.0405 162.20)` | `#DDE8DA` | `oklch(0.9188 0.0221 138.98)` |
| muted | `#E4E8E7` | `oklch(0.9277 0.0045 179.73)` | `#16231E` | `oklch(0.2422 0.0205 168.78)` |
| muted-foreground | `#3C4A44` | `oklch(0.3948 0.0205 167.45)` | `#B0BEB6` | `oklch(0.7883 0.0190 160.99)` |
| border | `#C3CAC6` | `oklch(0.8324 0.0094 161.31)` | `#2A3A33` | `oklch(0.3319 0.0243 166.26)` |
| input | `#6F7A75` | `oklch(0.5687 0.0152 166.81)` | `#72827A` | `oklch(0.5911 0.0223 164.11)` |
| ring | `#004C37` | `oklch(0.3696 0.0758 166.97)` | `#A9C98A` | `oklch(0.7966 0.0919 130.14)` |
| field-1 | `#00563E` | `oklch(0.4019 0.0830 166.36)` | `#00523B` | `oklch(0.3890 0.0803 166.40)` |
| field-1-foreground | `#EEF3EE` | `oklch(0.9590 0.0085 145.51)` | `#EAF3EC` | `oklch(0.9554 0.0133 152.60)` |
| field-2 | `#2E568C` | `oklch(0.4513 0.0998 256.49)` | `#2A4F85` | `oklch(0.4283 0.0996 257.89)` |
| field-2-foreground | `#F1F5FB` | `oklch(0.9688 0.0091 258.34)` | `#EEF3FB` | `oklch(0.9627 0.0120 259.82)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               13.74 >= 7 PASS
dark  --foreground / --background               15.79 >= 7 PASS
light --card-foreground / --card                14.76 >= 7 PASS
dark  --card-foreground / --card                14.30 >= 7 PASS
light --muted-foreground / --background          8.15 >= 7 PASS
dark  --muted-foreground / --background          9.62 >= 7 PASS
light --muted-foreground / --muted               7.54 >= 4.5 PASS
dark  --muted-foreground / --muted               8.42 >= 4.5 PASS
light --primary / --background                   8.79 >= 4.5 PASS
dark  --primary / --background                  10.08 >= 4.5 PASS
light --primary / --card                         9.45 >= 4.5 PASS
dark  --primary / --card                         9.12 >= 4.5 PASS
light --primary-foreground / --primary           8.79 >= 4.5 PASS
dark  --primary-foreground / --primary          10.08 >= 4.5 PASS
light --accent-foreground / --accent            12.04 >= 4.5 PASS
dark  --accent-foreground / --accent            11.85 >= 4.5 PASS
light --ring / --background                      8.79 >= 3 PASS
dark  --ring / --background                     10.08 >= 3 PASS
light --input / --background                     3.90 >= 3 PASS
dark  --input / --background                     4.59 >= 3 PASS
light --field-1-foreground / --field-1           7.79 >= 4.5 PASS
dark  --field-1-foreground / --field-1           8.16 >= 4.5 PASS
light --field-2-foreground / --field-2           6.79 >= 4.5 PASS
dark  --field-2-foreground / --field-2           7.38 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 3
- 경고 field-contrast-target: light field-2-foreground/field-2 6.79 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="field-2"] muted-foreground/background 5.72 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="field-2"] muted-foreground/background 6.18 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: White Desert: Oswald 400 대문자(제목 256px) + Cardinal Classic Long(유료 이탤릭 세리프 캡션) + Inter Tight(내비). Villa Banwoo: 본명조(Source Han Serif KR = Noto Serif KR, 세로쓰기 제목) + Alegreya(영문 내비).

- 1순위 라틴 디스플레이: **Big Shoulders Display**
- 1순위 한글 제목: **Gowun Batang**
- 본문 한글: Nanum Gothic(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Big Shoulders Display** — OFL 1.1 · Google Fonts · 100~900 가변 · 10a 후보 풀에 있음(기각 표시 없음). Oswald 제목(10a가 흔한 기본값으로 기각)의 응축 대문자 결을 더 높고 좁게 — 17.8vw 한 낱말이 화면 폭을 채운다. 키트에 응축체가 없다.
2. **League Gothic** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 고전 뉴스 고딕을 좁힌 대문자 — 더 차분한 대안.
3. **Alegreya** — OFL 1.1 · Google Fonts · 이탤릭 · 10a 후보 풀에 있음(기각 표시 없음). Villa Banwoo가 실제로 싣는 문학 세리프 — Cardinal Classic Long 이탤릭 캡션 자리.

한글 제목 후보(순위순):

1. **Gowun Batang** — OFL 1.1 · Google Fonts · 400·700 · 10a 후보 풀에 있음(기각 표시 없음). 본명조보다 부드러운 바탕 — 한옥 스테이 세로쓰기 제목에 맞는 먹 결. 키트의 Hahmlet·Nanum Myeongjo와 다른 둥근 붓 끝.
2. **MaruBuri** — OFL 1.1 · 네이버 한글한글 아름답게 CDN · 10a 후보 풀에 있음(기각 표시 없음). 가는 현대 부리 — 더 밝은 대안.
3. **Hahmlet** — OFL 1.1 · 키트 항목 font-hahmlet(현재 값). 지금 머리 값. 획 대비가 커서 큰 세로쓰기에는 좋지만 작은 크기에서 약하다.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 보이는 12칸 세로선 + 바닥에 걸친 응축 대문자 (사이트 1)

전폭 영상·사진 위에 12칸 격자 세로선(1px, border 색)을 그대로 보이게 깔고, 한 낱말 제목을 응축 대문자 17.8vw·굵기 400으로 가운데 정렬해 화면 아래 끝에 걸친다(아래 3%만 남김). 왼쪽 2칸 폭에 이탤릭 세리프 캡션 2줄(세로 48%), 오른쪽 2칸에 위아래 1px 선 사이 「영상 보기 ▶」 한 줄. 내비는 불투명 muted 네모 칸 버튼 왼쪽 3·오른쪽 2, 로고 가운데. 390: 제목 20.5vw, 세로선 8칸.

### 수 2 — 세로쓰기 한글 제목 + 슬라이드 눈금 (사이트 2)

저녁 사진 한 장을 전폭으로 깔고 가운데에 한글 제목 하나만 `writing-mode: vertical-rl`로 세로 한 줄(자간 0.4em, 세리프 400, 25px). 로고는 좌상단 선화, 내비는 우상단 세리프 대문자 5개(현재 항목 밑줄). 화면 아래 가운데에 슬라이드 눈금 3개(32px 가로선, 현재만 foreground). 사진 아래 첫 칸이 field-1 솔 면. 390: 세로 제목 20px, 내비는 메뉴 버튼 하나.

## 모션 1수

- 카탈로그 id: `split-text`
- 관측: White Desert `all 0.45s cubic-bezier(0.76, 0, 0.24, 1)`, `transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)`, 측정 요소 3개 모두 스크롤과 다르게 이동(시차). Villa Banwoo `transform, opacity 0.42s cubic-bezier(0.165, 0.84, 0.44, 1)`.
- 적용(M3): 제목을 글자 단위로 쪼개 한 자씩 마스크 안에서 `translateY(100%)` → 0으로 올린다 — 글자당 700ms(`--duration-enter` M3), `cubic-bezier(0.165, 0.84, 0.44, 1)`(Villa Banwoo 관측 곡선), 글자 간 40ms, 12자가 넘으면 낱말 단위. 세로쓰기 제목은 흐름 방향이 세로라 `translateX(-100%)` → 0. 온전한 문장은 `aria-label`, 쪼갠 span은 `aria-hidden`.
- reduced-motion: 쪼개지 않고 전체를 바로 보인다.

## 복제하지 않는 것

- 펭귄·남극 영상, 한옥 스테이 사진
- 「ANTARCTICA」·「VILLA BANWOO」 등 이름과 문구, 로고 선화
- Cardinal Classic Long 서체 파일
- 두 사이트의 팝업·쿠키 띠
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
