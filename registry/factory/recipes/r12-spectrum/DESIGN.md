---
id: r12-spectrum
name: 다차원 지표판
mood: [분석, 명료, 다색]
axes: { radius: R3, button: B2, input: I1, surface: C1, table: T1, header: H1, shadow: S1 }
motion: M1
colorLogic: K2
dynamics: [svg-draw, clip-reveal]
signature: [hero, data-strip, ledger]
hero: map-first
alternates:
  colorLogic: K2
  color:
    light:
      background: "oklch(0.9780 0.0040 175.00)"
      foreground: "oklch(0.2000 0.0150 190.00)"
      card: "oklch(1.0000 0.0000 0.00)"
      card-foreground: "oklch(0.2000 0.0150 190.00)"
      popover: "oklch(1.0000 0.0000 0.00)"
      popover-foreground: "oklch(0.2000 0.0150 190.00)"
      primary: "oklch(0.4200 0.1000 172.00)"
      primary-foreground: "oklch(0.9900 0.0050 172.00)"
      secondary: "oklch(0.9500 0.0060 175.00)"
      secondary-foreground: "oklch(0.2000 0.0150 190.00)"
      muted: "oklch(0.9550 0.0050 175.00)"
      accent: "oklch(0.9300 0.0450 25.00)"
      accent-foreground: "oklch(0.3200 0.1000 25.00)"
      border: "oklch(0.8900 0.0060 175.00)"
      ring: "oklch(0.4200 0.1000 172.00)"
      muted-foreground: "oklch(0.4300 0.0250 190.00)"
      input: "oklch(0.5000 0.0250 175.00)"
    dark:
      background: "oklch(0.1850 0.0120 195.00)"
      foreground: "oklch(0.9500 0.0060 175.00)"
      card: "oklch(0.2300 0.0140 195.00)"
      card-foreground: "oklch(0.9500 0.0060 175.00)"
      popover: "oklch(0.2300 0.0140 195.00)"
      popover-foreground: "oklch(0.9500 0.0060 175.00)"
      primary: "oklch(0.7800 0.1000 172.00)"
      primary-foreground: "oklch(0.1700 0.0300 195.00)"
      secondary: "oklch(0.2500 0.0150 195.00)"
      secondary-foreground: "oklch(0.9500 0.0060 175.00)"
      muted: "oklch(0.2500 0.0150 195.00)"
      accent: "oklch(0.3100 0.0600 25.00)"
      accent-foreground: "oklch(0.9400 0.0300 25.00)"
      border: "oklch(0.3400 0.0180 195.00)"
      ring: "oklch(0.7800 0.1000 172.00)"
      muted-foreground: "oklch(0.7150 0.0250 175.00)"
      input: "oklch(0.5050 0.0300 195.00)"
  note: "색 논리 K2 는 그대로, 주색을 청록 172°로 옮기고 강조 면을 산호 25°로 바꾼 두 번째 다차원 팔레트(차트 다섯 색상각은 A 그대로). 서체·모션·기법도 A 그대로"
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Sora", item: font-sora, weight: 600, tuned: "첫 화면·섹션 제목 전용. 굵기 600, 자간 -0.01em, 큰 수치(KPI)에도 같은 서체·같은 굵기" }
  body: { family: "Pretendard", item: font-pretendard, tuned: "본문 16px/1.6 굵기 400, 표·지표 숫자 tabular-nums" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "data-numeric 표 칸·코드에만, 굵기 400" }
color:
  light:
    background: "oklch(0.9850 0.0030 250.00)"
    foreground: "oklch(0.2200 0.0120 255.00)"
    card: "oklch(1.0000 0.0000 0.00)"
    card-foreground: "oklch(0.2200 0.0120 255.00)"
    popover: "oklch(1.0000 0.0000 0.00)"
    popover-foreground: "oklch(0.2200 0.0120 255.00)"
    primary: "oklch(0.4400 0.1200 232.00)"
    primary-foreground: "oklch(0.9900 0.0050 232.00)"
    secondary: "oklch(0.9550 0.0060 250.00)"
    secondary-foreground: "oklch(0.2200 0.0120 255.00)"
    muted: "oklch(0.9600 0.0050 250.00)"
    muted-foreground: "oklch(0.4400 0.0200 250.00)"
    accent: "oklch(0.9300 0.0400 305.00)"
    accent-foreground: "oklch(0.3000 0.1000 305.00)"
    destructive: "oklch(0.5200 0.1800 27.00)"
    border: "oklch(0.9000 0.0060 250.00)"
    input: "oklch(0.5000 0.0200 250.00)"
    ring: "oklch(0.4400 0.1200 232.00)"
    success: "oklch(0.5200 0.1100 152.00)"
    success-foreground: "oklch(0.9850 0.0050 152.00)"
    warning: "oklch(0.5500 0.1200 68.00)"
    warning-foreground: "oklch(0.9850 0.0050 68.00)"
    info: "oklch(0.5000 0.1200 255.00)"
    info-foreground: "oklch(0.9850 0.0040 255.00)"
    chart-1: "oklch(0.5000 0.1300 232.00)"
    chart-2: "oklch(0.5600 0.1700 30.00)"
    chart-3: "oklch(0.5500 0.1300 150.00)"
    chart-4: "oklch(0.6200 0.1400 85.00)"
    chart-5: "oklch(0.5200 0.1500 305.00)"
  dark:
    background: "oklch(0.1900 0.0120 255.00)"
    foreground: "oklch(0.9500 0.0060 250.00)"
    card: "oklch(0.2350 0.0140 255.00)"
    card-foreground: "oklch(0.9500 0.0060 250.00)"
    popover: "oklch(0.2350 0.0140 255.00)"
    popover-foreground: "oklch(0.9500 0.0060 250.00)"
    primary: "oklch(0.7600 0.1000 232.00)"
    primary-foreground: "oklch(0.1800 0.0300 255.00)"
    secondary: "oklch(0.2500 0.0140 255.00)"
    secondary-foreground: "oklch(0.9500 0.0060 250.00)"
    muted: "oklch(0.2500 0.0140 255.00)"
    muted-foreground: "oklch(0.7200 0.0200 255.00)"
    accent: "oklch(0.3000 0.0600 305.00)"
    accent-foreground: "oklch(0.9300 0.0300 305.00)"
    destructive: "oklch(0.7000 0.1500 25.00)"
    border: "oklch(0.3300 0.0160 255.00)"
    input: "oklch(0.5100 0.0250 255.00)"
    ring: "oklch(0.7600 0.1000 232.00)"
    success: "oklch(0.7400 0.1100 152.00)"
    success-foreground: "oklch(0.1900 0.0200 152.00)"
    warning: "oklch(0.8000 0.1200 78.00)"
    warning-foreground: "oklch(0.2000 0.0300 78.00)"
    info: "oklch(0.7400 0.1000 255.00)"
    info-foreground: "oklch(0.1900 0.0150 255.00)"
    chart-1: "oklch(0.7200 0.1200 232.00)"
    chart-2: "oklch(0.7200 0.1500 30.00)"
    chart-3: "oklch(0.7400 0.1300 150.00)"
    chart-4: "oklch(0.8000 0.1300 85.00)"
    chart-5: "oklch(0.7200 0.1300 305.00)"
references:
  - refs-v2:colorLogic=K2:archetype=dashboard
  - refs-v2:colorLogic=K2:archetype=public
  - docs/inputs/style_axes.md#K2
archetypes: [dashboard, public]
archetypeConditions:
  dashboard: "여러 지표를 색으로 가르는 분석 화면(차트 계열 3개 이상)일 때. 한 색으로 충분한 단순 현황판은 r1-measure"
  public: "기관 누리집의 통계·현황 쪽에서 쓴다. 누리집 전체의 주색 하나 체계는 primary 가 맡고 나머지 색상각은 차트·범례에만"
---

## 분위기

한 화면에 여러 지표가 동시에 놓이는 분석 화면이다. 바탕은 거의 흰 중성 회색, 글자는 짙은 남색 먹이고, 데이터 색은 청록·산호·초록·황·보라 다섯 색상각으로 갈린다. 주색(청록 계열 파랑)은 버튼·링크·선택 상태만 맡아 데이터 색과 섞이지 않는다. 숫자는 크고 얇게 놓고 증감은 작은 알약으로 곁에 붙인다.

## 쓰는 법

- 맞는 원형은 지표가 여러 갈래인 운영 대시보드와 기관 통계·현황 쪽이다. 한 지표만 보는 화면에는 쓰지 않는다.
- 색 논리 K2(다차원 팔레트): 한 색상각이 화면을 지배하지 않는다. `chart-1`~`chart-5` 다섯 색상각이 데이터 계열의 색이고, 같은 계열은 화면 전체에서 같은 색을 쓴다. 색만으로 계열을 가르지 않고 직접 라벨·모양을 함께 둔다.
- 의미색(성공·경고·정보·오류)은 차트 색과 겹치지 않게 따로 둔다. 경고는 늘 글자와 아이콘을 함께 쓴다.
- 첫 화면은 히어로 `map-first`이다: 전폭 큰 제목 아래 왼쪽에 큰 정적 지도와 지점 표지를, 오른쪽에 고른 지점의 수치 카드를 놓는다(지역별 지표를 색으로 가르는 판).
- 모션은 M1이다. 차트 선은 한 번 긋고(svg-draw), 지표 카드는 위에서 걷는 clip-reveal로 등장한다. 동작 줄이기에서는 완성된 채 보인다.

## 하지 말 것

- 차트 계열색을 버튼·배지·링크에 돌려 쓰지 않는다. 버튼은 주색 하나다.
- 다섯 색을 한 막대 안에 한꺼번에 쓰지 않는다. 한 차트에서 계열은 최대 다섯, 강조는 한 계열이다.
- 무지개 순서(색상환을 한 방향으로 도는 배열)로 계열을 칠하지 않는다. 계열 사이의 명도 차를 함께 둔다.
- 그라디언트로 지표 카드를 칠하지 않는다.

## 레퍼런스에서 가져온 기법

- K2·dashboard 카드 : 큰 얇은 숫자와 작은 증감 알약을 한 쌍으로 둔다.
- K2·dashboard 카드 : 그룹마다 한 색을 주고, 카드는 큰 수치·증감·12개월 막대의 세 단으로 되풀이한다.
- K2·dashboard 카드 : 등급 색을 범례·점·라벨에 같은 의미로 되풀이한다.
- K2·public 카드 : 기관 누리집 머리 줄에 날씨·인구 같은 현황을 한 번에 보인다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K2(다차원 팔레트)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `baseline-split` 에서 `map-first` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 지역·기관별 지표를 한 장에서 색으로 가르는 판이라 지도 위 지점 표지와 지점 카드가 맞고, 블록 메타 archetypes(public·dashboard·local)가 이 레시피 원형(dashboard·public)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`map-first`)도 운영자가 「좋다」로 골랐다.
