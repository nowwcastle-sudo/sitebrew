# r2-signal — 흑백 신호 · 레퍼런스 DNA 카드

> 선택 보드 결정(2026-09-27, 보드 B 전체)이 정한 틀은 그대로다: colorLogic **K7** · defaultTheme **light** · motion **M1** · dynamics [split-text, oversize-crop]. 이 카드는 그 안의 hex 값·서체·첫 화면 배치·모션 결만 레퍼런스에서 가져와 바꾼다. 머리(DESIGN.md)에 옮기는 일과 서체 최종 선택은 컨트롤러가 한다.
> 측정: 이번 실행에서 headless Chrome(CDP)으로 직접 방문, 첫 화면 1440×900과 390×844, 요청 사이 3초 이상, robots.txt 확인. 색은 스크린샷 픽셀 넓이, 서체·크기·모션은 계산 스타일과 `document.getAnimations()`. 스크린샷은 저장소 밖(작업 스크래치패드)에만 있다.

## 출처

- 사이트 1: https://visualsociety.ch/ · 출처 `siteinspire` · editorial 선정 · 방문 2026-09-27T09:30Z
  - 1440 넓이 상위 색: `#FFFFFF` 73.6% · `#000000` 16.8% · `#1100FF` 4% · `#E5E5E5` 0.8% · `#1B1B1B` 0.7% · `#ADADAD` 0.6%
  - 390 넓이 상위 색: `#FFFFFF` 73% · `#E8E9EC` 5.8% · `#010101` 2.9% · `#414456` 2.6%
  - 글자색(글자 수 순): `#000000` · `#1100FF` · `#FFFFFF` · 버튼 바탕: `#1100FF` · `#FFFFFF`
  - 첫 화면 서체(글자 수 순): SBM(1259)
  - 가장 큰 글자 1440: SBM, sans-serif · 95.4px (6.6vw) · 굵기 400 · 자간 normal · 행간 79.2px · 대소문자 그대로 · 정렬 start
  - 가장 큰 글자 390: SBM, sans-serif · 42.2px (10.8vw) · 굵기 400 · 자간 normal · 행간 35px · 대소문자 그대로 · 정렬 start · 가로 넘침
  - 판독 메모: 제목 줄은 h1이 아닌 링크 목록 줄(DIV)이다.
  - 구조(스크린샷 판독 + 상자 측정): 위 머리 띠의 오른쪽 3/4가 전기 파랑(`#1100FF`) 면, 메뉴는 「[ ] Shop」처럼 대괄호 체크 칸. 본문은 왼쪽 2/12 메타 목록(라벨/값, 값은 대괄호 파랑 링크) + 오른쪽 10/12에 한 줄 제목을 9줄 넘게 쌓고 오른쪽 화면 끝에서 잘라낸다. 반경 0, 그림자 0.
  - 모션 관측(1440): 로드 직후 애니메이션 0개 · 무한 반복 0 · 전환 상위 `opacity 0.1s ease`(×809) · 라이브러리 흔적 없음 · :hover 규칙 17개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/0
- 사이트 2: https://www.thedesignsociety.fr/ · 출처 `cssda` · Featured · 방문 2026-09-27T09:34Z
  - 1440 넓이 상위 색: `#E6E8F0` 47% · `#BCBEC4` 30.2% · `#A6A7AD` 6.7% · `#D1D2D9` 5.9% · `#8F9095` 2.6% · `#202020` 2.5%
  - 390 넓이 상위 색: `#CED0D6` 48% · `#EAECF4` 37.3% · `#B6B8BE` 6.9% · `#FDFDFD` 1.8%
  - 글자색(글자 수 순): `#1E1E1E` · `#333333`
  - 첫 화면 서체(글자 수 순): Khinterferencetrial(90) · Fkrasterromancompact Smooth(65)
  - 가장 큰 글자 1440: Fkrasterromancompact Smooth, Arial · 79.8px (5.5vw) · 굵기 400 · 자간 normal · 행간 95.76px · 대소문자 그대로 · 정렬 center
  - 가장 큰 글자 390: Khinterferencetrial, Arial · 29.8px (7.6vw) · 굵기 400 · 자간 -1.19px · 행간 29.75px · 대소문자 그대로 · 정렬 start
  - 구조(스크린샷 판독 + 상자 측정): 가운데 정렬 3줄 제목 안에 아이콘 2개와 사진 칩 1개가 낱말처럼 끼어 있다. 제목 위·아래에 mono 대문자 대괄호 캡션, 그 바깥에 같은 픽셀 장식을 거울 대칭. 위 가운데 떠 있는 알약 내비. 회색 주사선 결 바탕.
  - 모션 관측(1440): 로드 직후 애니메이션 15개(fondue-fluide 12000ms linear d0, fondue-fluide 12000ms linear d0, fondue-fluide 12000ms linear d0 …) · 무한 반복 5개+ · 전환 상위 `transform 0.735s cubic-bezier(0.625, 0.05, 0, 1)`(×15), `opacity 0.3s ease`(×6) · 라이브러리 흔적 gsap·ScrollTrigger·lenis·splitting·webflow · :hover 규칙 15개 · 스크롤 500px 뒤 스크롤 양과 다르게 움직인 요소 0/6
- 팔레트: `pal-sns-instagram-dapad3qkle0-2` · https://www.instagram.com/p/DaPAD3qkle0/ · @artart.today · 원 역할 대비 fg/bg 17.43 · 주색 위 글자 5.33

## 팔레트

면(field-1) 빨강 `#CB001E`·먹 `#0E0E0E`·옅은 면 `#F0F4F5`는 팔레트(에디토리얼) 값 그대로. 주색 코발트 `#1A0DF0`은 Visual Society 넓이 3위 `#1100FF`(4%)를 한 단계 옮긴 값(K7의 두 번째 색). 바탕은 Visual Society 넓이 1위 흰색에 가깝게 `#FCFCFD`.

| 역할 | 라이트 hex | 라이트 OKLCH | 다크 hex | 다크 OKLCH |
|---|---|---|---|---|
| background | `#FCFCFD` | `oklch(0.9913 0.0013 286.38)` | `#0B0B0E` | `oklch(0.1510 0.0064 285.61)` |
| foreground | `#0E0E0E` | `oklch(0.1638 0.0000 0.00)` | `#F2F3F5` | `oklch(0.9640 0.0029 264.54)` |
| card | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#141418` | `oklch(0.1931 0.0080 285.63)` |
| primary | `#1A0DF0` | `oklch(0.4414 0.2923 266.56)` | `#8F89FF` | `oklch(0.6887 0.1695 283.30)` |
| primary-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#0B0B0E` | `oklch(0.1510 0.0064 285.61)` |
| accent | `#E9EAF3` | `oklch(0.9389 0.0121 281.08)` | `#1D1E2A` | `oklch(0.2396 0.0230 280.79)` |
| accent-foreground | `#0E0E0E` | `oklch(0.1638 0.0000 0.00)` | `#F2F3F5` | `oklch(0.9640 0.0029 264.54)` |
| muted | `#F0F4F5` | `oklch(0.9644 0.0045 214.33)` | `#18191E` | `oklch(0.2146 0.0099 276.58)` |
| muted-foreground | `#3C3F47` | `oklch(0.3679 0.0143 269.30)` | `#B9BCC6` | `oklch(0.7959 0.0144 272.65)` |
| border | `#D0D3DA` | `oklch(0.8666 0.0102 267.35)` | `#2E3038` | `oklch(0.3105 0.0146 274.41)` |
| input | `#6C6F78` | `oklch(0.5422 0.0144 271.14)` | `#767986` | `oklch(0.5780 0.0202 275.41)` |
| ring | `#CB001E` | `oklch(0.5303 0.2152 25.45)` | `#FF5C70` | `oklch(0.6946 0.1975 16.76)` |
| field-1 | `#CB001E` | `oklch(0.5303 0.2152 25.45)` | `#B0001A` | `oklch(0.4770 0.1934 25.11)` |
| field-1-foreground | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` | `#FFFFFF` | `oklch(1.0000 0.0000 0.00)` |

`node factory/scripts/contrast.mjs <이 표로 만든 테마 css> --pair <앞> <뒤> --min <기준>` 출력 그대로:

```
light --foreground / --background               18.82 >= 7 PASS
dark  --foreground / --background               17.71 >= 7 PASS
light --card-foreground / --card                19.30 >= 7 PASS
dark  --card-foreground / --card                16.55 >= 7 PASS
light --muted-foreground / --background         10.27 >= 7 PASS
dark  --muted-foreground / --background         10.36 >= 7 PASS
light --muted-foreground / --muted               9.51 >= 4.5 PASS
dark  --muted-foreground / --muted               9.25 >= 4.5 PASS
light --primary / --background                   8.68 >= 4.5 PASS
dark  --primary / --background                   6.73 >= 4.5 PASS
light --primary / --card                         8.90 >= 4.5 PASS
dark  --primary / --card                         6.29 >= 4.5 PASS
light --primary-foreground / --primary           8.90 >= 4.5 PASS
dark  --primary-foreground / --primary           6.73 >= 4.5 PASS
light --accent-foreground / --accent            16.11 >= 4.5 PASS
dark  --accent-foreground / --accent            14.88 >= 4.5 PASS
light --ring / --background                      5.76 >= 3 PASS
dark  --ring / --background                      6.57 >= 3 PASS
light --input / --background                     4.90 >= 3 PASS
dark  --input / --background                     4.54 >= 3 PASS
light --field-1-foreground / --field-1           5.90 >= 4.5 PASS
dark  --field-1-foreground / --field-1           7.34 >= 4.5 PASS
```

금지 검사(palettes README — Tailwind 기본 hex·크림 바탕): 해당 없음

색 논리 lint(`recipe.mjs colorLogicReport`, 현재 머리 사본에 이 값만 바꿔 넣어 실행 · 레지스트리에는 쓰지 않음): 위반 0 · 경고 3
- 경고 field-contrast-target: light field-1-foreground/field-1 5.90 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: light [data-face="field-1"] muted-foreground/background 5.57 < 7 — 목표 7:1(최소 4.5:1은 넘었다)
- 경고 face-contrast-target: dark [data-face="field-1"] muted-foreground/background 6.89 < 7 — 목표 7:1(최소 4.5:1은 넘었다)

카드·팝오버 글자는 foreground와 같은 값, secondary는 muted와 같은 값, sidebar-primary는 primary와 같은 값으로 잰다(표에 없는 역할). 상태색·차트색은 바꾸지 않는다.

## 서체

레퍼런스가 실제로 쓰는 것: Visual Society: SBM(자체 그로테스크) 하나 — 제목 95px 굵기 400. The Design Society: FK Raster Roman Compact Smooth(픽셀 세리프, 유료) 제목 80px + KH Interference(라벨) + Geist Pixel. 둘 다 받아 쓸 수 없는 서체다.

- 1순위 라틴 디스플레이: **Bricolage Grotesque**
- 1순위 한글 제목: **Do Hyeon**
- 본문 한글: Gothic A1(현재 머리 값 유지)

라틴 디스플레이 후보(순위순):

1. **Bricolage Grotesque** — OFL 1.1 · Google Fonts · wdth 75~100, opsz 12~96, wght 200~800 가변 · 10a 후보 풀에 있음(기각 표시 없음). SBM처럼 단단한 그로테스크인데 폭·광학 크기 축이 있어, 넘치는 제목 줄을 좁은 폭(wdth 75)으로 촘촘히 쌓고 잘라도 글자꼴이 산다. 키트 Archivo보다 개성이 세다.
2. **Schibsted Grotesk** — OFL 1.1 · Google Fonts · 10a 후보 풀에 없음. 신문 그로테스크 — 더 중립적인 대안.
3. **Pixelify Sans** — OFL 1.1 · Google Fonts · 가변 · 10a 후보 풀에 있음(기각 표시 없음). Design Society의 래스터 결을 대괄호 캡션·숫자 라벨에만. 제목에는 쓰지 않는다.

한글 제목 후보(순위순):

1. **Do Hyeon** — OFL 1.1 · Google Fonts · 굵기 하나 · 10a 후보 풀에 있음(기각 표시 없음). 각지고 납작한 포스터 고딕 — 전단형 제목 줄. 키트 Black Han Sans보다 좁고 가볍다.
2. **Moirai One** — OFL 1.1 · Google Fonts · 10a 후보 풀에 있음(기각 표시 없음). 모듈을 조립한 실험 한글 — 전시·포스터 한 단어(목록 줄에는 쓰지 않음).
3. **Galmuri** — OFL 1.1 · npm galmuri → jsDelivr · 10a 후보 풀에 있음(기각 표시 없음). 한글 픽셀 서체 — Design Society 캡션 결을 한글 라벨로.

대조: `references/fonts/fonts.json`(Task 10a)은 이 카드를 쓸 때 아직 없었다. 대신 10a가 작업 중인 후보 풀(저장소 밖 `design-rules\factory\fonts\candidates.mjs`, 2026-09-27 19시 무렵)과 대조해 풀을 통과한 서체를 앞에 두고, 10a가 기각한 서체(AI 과다 사용·흔한 기본값·평범한 고딕·라이선스 미확인)는 뺐다. 「10a 후보 풀에 있음(기각 표시 없음)」은 그 시점 파일을 읽은 결과이고, 10a의 최종 검증(배포 URL 재요청 등)을 거쳤다는 뜻은 아니다. 최종 선택은 fonts.json이 나온 뒤 컨트롤러가 한다.

## 히어로 배치 2수

### 수 1 — 오른쪽 끝에서 잘리는 제목 목록 (사이트 1)

본문을 2/12(왼쪽 메타 목록: 라벨/값 두 칸, 값은 대괄호 [ ] 안 primary 링크) + 10/12(제목 목록)로 나눈다. 오른쪽 칸에 한 줄 제목(6.6vw, 굵기 400, 행간 0.83)을 7~9줄 세로로 쌓고 줄마다 `white-space: nowrap`, 칸은 `overflow: clip` — 오른쪽 화면 끝에서 잘린다. 한 줄 = 한 항목 링크, hover·focus한 줄만 field-1 빨강. 머리 띠는 오른쪽 3/4만 primary 면, 메뉴 항목 앞에 대괄호 체크 칸. 390: 10.8vw로 잘림 유지.

### 수 2 — 문장 속 사진 칩 + 대괄호 캡션 대칭 (사이트 2)

가운데 정렬 3줄 제목(5.5vw) 안에서 낱말 사이 한 곳을 글자 높이의 사진 칩(가로 2:1, 반경 0)으로, 다른 한 곳을 아이콘 하나로 바꾼다. 제목 위·아래에 mono 대문자 대괄호 캡션 한 줄씩(「[ … ]」), 그 바깥에 같은 도형 장식을 위아래 거울 대칭으로. 390: 칩은 줄이 바뀌어도 인라인으로 남는다.

## 모션 1수

- 카탈로그 id: `oversize-crop`
- 관측: Visual Society 로드 애니메이션 0개, 800개 넘는 요소에 `opacity 0.1s ease`(hover 미리보기). Design Society `transform 0.735s cubic-bezier(0.625, 0.05, 0, 1)`, GSAP·ScrollTrigger·Lenis·글자 분할 흔적.
- 적용(M1): 등장 연출 없음. 잘린 제목 줄에 hover·focus가 오면 그 줄만 `translateX(-min(20vw, 넘친 길이))`로 밀려 잘린 끝을 보여 준다 — 600ms `cubic-bezier(0.625, 0.05, 0, 1)`(관측 곡선), 떠나면 같은 곡선으로 돌아온다. 색은 `--duration-hover` 150ms.
- reduced-motion: 밀기 없음. 줄 색만 바뀌고, 온전한 제목은 링크의 접근 이름으로 늘 읽힌다.

## 복제하지 않는 것

- 두 사이트의 상품명·가격·캠페인 제목 같은 문구와 사진
- SBM·FK Raster Roman·KH Interference 서체 파일(유료·자체)
- Design Society의 불꽃·타코 아이콘, 픽셀 장식 원본, 주사선 CRT 결
- 전기 파랑을 면 전체에 까는 것 — K7이라 파랑은 주색(잉크·CTA)에만, 면은 빨강 하나
- 두 사이트의 코드·이미지·로고·문구 전부. 가져온 것은 hex 값, 서체 선택과 짝, 배치 구조, 모션 기법과 시간 값뿐이다.
