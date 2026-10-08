---
id: t13-swap
name: 레시피 교체 실험 고정물(예시)
mood: [계측, 차분, 정확]
axes: { button: B1, input: I3, surface: C2, table: T4, header: H3, radius: R0, shadow: S0 }
motion: M1
colorLogic: K1
dynamics: [clip-reveal]
hero: twin-panels
icons: { library: phosphor, weight: G5 }
fonts:
  display: { family: "IBM Plex Sans", item: font-ibm-plex-sans, tuned: "굵기 700(제목)·400(본문) 두 단계로 차 300, 큰 수치만 300, 40px 이상 제목 자간 -0.02em, 숫자는 tabular-nums" }
  body: { family: "Noto Sans KR", item: font-noto-sans-kr, tuned: "본문 16px/1.7, 굵기 400·700만" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "data-numeric 표 칸·숫자 입력·코드에만(T7-I1), 굵기 400" }
color:
  light:
    background: "oklch(0.975 0.004 255)"
    foreground: "oklch(0.2 0.014 255)"
    card: "oklch(0.99 0.002 255)"
    card-foreground: "oklch(0.2 0.014 255)"
    popover: "oklch(0.99 0.002 255)"
    popover-foreground: "oklch(0.2 0.014 255)"
    primary: "oklch(0.3 0.08 150)"
    primary-foreground: "oklch(0.975 0.004 255)"
    secondary: "oklch(0.93 0.008 255)"
    secondary-foreground: "oklch(0.24 0.02 255)"
    muted: "oklch(0.945 0.006 255)"
    muted-foreground: "oklch(0.4 0.016 255)"
    accent: "oklch(0.925 0.035 255)"
    accent-foreground: "oklch(0.34 0.11 255)"
    destructive: "oklch(0.5 0.19 27)"
    border: "oklch(0.6 0.014 255)"
    input: "oklch(0.3 0.016 255)"
    ring: "oklch(0.47 0.15 255)"
    success: "oklch(0.5 0.1 155)"
    success-foreground: "oklch(0.985 0.005 155)"
    warning: "oklch(0.55 0.12 60)"
    warning-foreground: "oklch(0.985 0.005 60)"
    info: "oklch(0.47 0.15 255)"
    info-foreground: "oklch(0.985 0.004 255)"
    chart-1: "oklch(0.3 0.1 255)"
    chart-2: "oklch(0.4 0.13 255)"
    chart-3: "oklch(0.49 0.15 255)"
    chart-4: "oklch(0.57 0.13 255)"
    chart-5: "oklch(0.63 0.1 255)"
    sidebar: "oklch(0.96 0.005 255)"
    sidebar-foreground: "oklch(0.2 0.014 255)"
    sidebar-primary: "oklch(0.24 0.02 255)"
    sidebar-primary-foreground: "oklch(0.975 0.004 255)"
    sidebar-accent: "oklch(0.925 0.035 255)"
    sidebar-accent-foreground: "oklch(0.34 0.11 255)"
    sidebar-border: "oklch(0.6 0.014 255)"
    sidebar-ring: "oklch(0.47 0.15 255)"
  dark:
    background: "oklch(0.17 0.01 255)"
    foreground: "oklch(0.95 0.006 255)"
    card: "oklch(0.2 0.011 255)"
    card-foreground: "oklch(0.95 0.006 255)"
    popover: "oklch(0.22 0.012 255)"
    popover-foreground: "oklch(0.95 0.006 255)"
    primary: "oklch(0.92 0.01 255)"
    primary-foreground: "oklch(0.19 0.014 255)"
    secondary: "oklch(0.27 0.012 255)"
    secondary-foreground: "oklch(0.95 0.006 255)"
    muted: "oklch(0.25 0.012 255)"
    muted-foreground: "oklch(0.8 0.012 255)"
    accent: "oklch(0.3 0.05 255)"
    accent-foreground: "oklch(0.92 0.03 255)"
    destructive: "oklch(0.7 0.16 25)"
    border: "oklch(0.55 0.014 255)"
    input: "oklch(0.72 0.014 255)"
    ring: "oklch(0.74 0.12 255)"
    success: "oklch(0.74 0.11 155)"
    success-foreground: "oklch(0.19 0.02 155)"
    warning: "oklch(0.8 0.12 75)"
    warning-foreground: "oklch(0.2 0.03 75)"
    info: "oklch(0.74 0.12 255)"
    info-foreground: "oklch(0.19 0.014 255)"
    chart-1: "oklch(0.93 0.04 255)"
    chart-2: "oklch(0.85 0.08 255)"
    chart-3: "oklch(0.77 0.12 255)"
    chart-4: "oklch(0.69 0.13 255)"
    chart-5: "oklch(0.62 0.12 255)"
    sidebar: "oklch(0.2 0.011 255)"
    sidebar-foreground: "oklch(0.95 0.006 255)"
    sidebar-primary: "oklch(0.92 0.01 255)"
    sidebar-primary-foreground: "oklch(0.19 0.014 255)"
    sidebar-accent: "oklch(0.3 0.05 255)"
    sidebar-accent-foreground: "oklch(0.92 0.03 255)"
    sidebar-border: "oklch(0.55 0.014 255)"
    sidebar-ring: "oklch(0.74 0.12 255)"
references:
  - https://www.krds.go.kr/
  - https://www.moto-card.com/
  - component-k17
  - type-t06
  - color-c02
  - https://www.photiu.ai/
archetypes: [dashboard, saas]
---

## 결정 기록 (2026-09-26, 수정 1회차 반영)

방향 원천은 dribbble-summary §6 R1(계측·차분·정확), style_axes N1(텔레메트리)·N4(인증·문서 신뢰)다. DESIGN §1-B대로 세 안을 같은 칸으로 적고, §13에 가장 가까운 안을 버렸다.

| 칸 | A 도면 계측 (고름) | B 계측 문서 (남김, 안 씀) | C 야간 관제판 (버림) |
|---|---|---|---|
| 분위기 3단어 | 계측 · 차분 · 정확 | 공인 · 정돈 · 신뢰 | 야간 · 경계 · 조밀 |
| 축 | B1 I3 C2 T4 H3 R0 S0, M1 | B2 I1 C1 T2 H1 R1 S1, M1 | B3 I1 C1 T1 H4 R1 S0, M0 |
| 서체 짝과 이유 | IBM Plex Sans(제목) + Plex Sans KR(본문) + Plex Mono(숫자). 공학 문서용으로 만든 한 가족이라 「그로테스크 한 계열 두 굵기」(type-t01)를 지키면서 숫자 열이 맞는다 | Pretendard GOV 한 가족. 공공 서식의 가독성이 검증됐고 KRDS가 이 가족 하나로 쓴다 | Barlow Condensed(제목·수치) + Pretendard(본문). 좁은 벽 화면에 수치를 많이 싣기 위한 응축형 |
| 색 3개 + 강조 1 | 오프화이트 용지 · 잉크 · 푸른 회색 + 청사진 파랑(hue 255) | 흰 바탕 · 짙은 남색 글자 · 옅은 회색 + 공공 파랑(hue 250) | 푸른 먹색 바탕(L 0.19) · 밝은 회색 글자 · 중간 회색 + 경보 호박색(hue 70) |
| 사진·그림 | 사진 없음. 그림은 실제 데이터로 그린 차트와 수위 눈금뿐 | 사진 없음. 서식·도식과 인증 표지(실제 인증일 때만) | 사진 없음. 지도 타일과 실시간 차트 |
| 이 안에서만 나오는 레이아웃 | KPI 한 줄 셀(1px 잉크 선) + 괘선 표 + 사양 띠 | 왼쪽 목차 레일 + 오른쪽 조항·표의 문서형 2열 | 12열 운영 벽: 사이드 레일 + 경보 대기열 + 조밀 표 |
| 레퍼런스 2개 | https://www.krds.go.kr/ · https://www.moto-card.com/ | https://www.krds.go.kr/ · https://www.moef.go.kr/ | https://play.grafana.org/ · https://status.digitalocean.com/ |

- **버린 안: C.** 다크 바탕에 경보 호박색 한 점만 채도를 갖는 구성은 §13 「거의 검정 + 형광 초록·주홍 한 점」의 바로 옆이다. 바탕을 L 0.19로 올리고 호박색 채도를 낮춰도, 첫인상을 만드는 것은 결국 어두운 면 위의 따뜻한 한 점이다. 세 안 가운데 §13 표의 한 행에 가장 가깝다.
- **남긴 안: B.** 상투 표의 어느 행에도 걸리지 않는다. 그러나 교체 가능성 검사에서 떨어졌다. 주제를 은행·병원·학교로 바꿔 끼워도 색·반경·레이아웃이 그대로 성립해서, §13의 「UI 키트를 기본 테마 그대로 납품」과 구별되지 않는다. 이 레시피에서는 B의 「한글 서체를 한 가족으로 명시한다」만 가져왔다.
- **고른 안: A.** 방문자 모드는 조작(dashboard)과 설득(saas) 두 가지다.
- **교체 가능성 검사로 고친 것**
  - 처음 액센트는 청록(hue 195)이었다. 공장 기본 테마와 같은 hue라서 도면의 재료인 청사진(프러시안 블루, hue 255)으로 옮겼다.
  - 주 버튼은 잉크로 칠한다(B1 명세 「채움 잉크색」). 대신 파랑은 **선택·포커스·활성 상태를 표시하는 색**으로 약속한다: 포커스 링, 토글·탭의 눌림/선택 2px 안쪽 링(ring), 메뉴의 강조 칸(accent), 정보 상태(info), 차트. 쉬는 화면에서도 선택된 칸이 파랗게 보이도록 했다(수정 1회차 — 리뷰 「파랑이 차트에만 보여 흑백 도면처럼 읽힌다」).
- **서체**: Plex 세 가지는 모두 SIL OFL 1.1이다(https://github.com/IBM/plex/blob/master/LICENSE.txt). §13·banlist 목록에 없다. 폰트 항목(`font-ibm-plex-*`)은 Task 8 폰트 키트가 만들고, 그 전까지는 스택의 이름 폴백과 시스템 한글로 그린다.
- **아이콘**: lucide. 컴파일된 부품 22개가 이미 `lucide-react`를 import한다. 다른 세트는 Task 9 어댑터가 온 뒤에 쓴다. 결은 G1(외곽선 2px) 하나로 통일한다.
- **색 수 판단**: `refs-v2/samples.jsonl`에서 saas·awwwards·S 1.0 표본 네 곳의 유채색 수는 moto-card 1, photiu 2, mindrobotics 3, orchid.security 3이다. 카드 기준(2개 이하가 절제)으로 절제와 다색이 2:2로 갈린다. 빈도로 보면 saas 전체에서는 다색 카드(color-saas-accent-multi, 12곳)가 절제 카드(4곳)보다 많다. 그래도 브랜드 색을 하나로 둔 근거는 DESIGN §5다. 랜딩 대표색 2색(SOTD 24곳 중 24곳이 1~2색), 뉴트럴이 면적 대부분, 액센트는 활성 상태 전용이라는 규칙이다. 기법은 moto-card 행(유채 1, 본문 대비 20.03)에서 가져왔다. 상태색(성공·경고·오류·정보)은 §5 MUST라 따로 두고, 의미에만 쓴다.
- **글자 크기**: 비율 1.25 하나로 16 · 20 · 25 · 31 · 39 · 49에서 멈춘다. 제목:본문은 49/16 ≈ 3.06배다. 기준 표본은 photiu(saas, S 1.0, h1:본문 3.0)다.

## 분위기

측량 도면처럼 조용하고 정확한 화면이다. 오프화이트 용지에 잉크 선으로 칸을 나누고, 모서리는 모두 직각이다. 브랜드 색은 청사진 파랑 하나다. 그 파랑은 지금 선택된 것, 포커스가 있는 곳, 데이터 계열을 가리킬 때만 나온다. 숫자는 모두 같은 폭으로 줄을 맞춘다.

## 쓰는 법

- 맞는 원형은 운영 대시보드와 기술형 SaaS 랜딩이다. 숫자·표·상태가 화면의 주인공인 곳에 쓴다.
- 수치는 `tabular-nums`로 쓴다. 큰 수치는 굵기 300, 단위는 수치의 45% 크기에 굵기 400·muted 색으로 붙인다(type-t06). 예: 「1,284 건」에서 「건」만 작고 옅다.
- 표의 숫자 칸에는 `data-numeric`을 단다. 그 칸만 고정폭 글꼴로 바뀐다(T4). 숫자 입력은 `inputMode="decimal"`·`"numeric"` 또는 `type="tel"`로 두면 고정폭이 된다(I3). 한글 이름·메모·머리·캡션은 본문 서체다.
- KPI는 카드로 나누지 않는다. 한 줄 셀로 늘어놓고 1px 잉크 선으로 가른다(component-k17). 카드는 역할이 다른 덩어리에만 쓴다.
- 글자 크기는 1.25 비율 한 줄로 쓴다(16 · 20 · 25 · 31 · 39 · 49). 화면 제목은 49px(본문의 약 3배)를 넘기지 않는다.
- 주 버튼은 잉크 채움 한 개만 둔다. 보조 동작은 같은 반경(0)의 외곽선 버튼으로 한다.
- 선택 상태는 파랑으로 표시한다. 토글·탭의 선택 칸은 2px 파란 안쪽 링을 두르고, 메뉴에서 강조된 칸은 옅은 파랑(accent)으로 칠한다.
- 상태는 색과 글자를 함께 쓴다: 정상 success, 주의 warning, 오류 destructive, 안내 info(청사진 파랑). 배지 글자가 곧 상태 이름이다.
- 차트는 청사진 파랑의 명도 단계 5개(chart-1~5)로 칠한다(color-c02). 다섯 단계 모두 배경 대비 3:1 이상이다(그래픽 요소 기준). 계열이 4개를 넘으면 선 모양·패턴·직접 라벨을 함께 쓴다(색만으로 구분하지 않는다).
- 모션은 M1이다. 상태 전환은 150~200ms, 등장은 300ms 이하다. 튕김은 쓰지 않는다.

## 하지 말 것

- 둥근 모서리를 섞지 않는다. 버튼·입력·카드·배지·아바타까지 모두 0이다(§6).
- 어두운 테마를 「검정 + 형광 한 점」으로 만들지 않는다. 다크 바탕은 L 17%의 푸른 회색이고, 액센트는 밝히되 채도는 낮춘다(§13).
- 모노스페이스를 장식 라벨로 쓰지 않는다. 고정폭 글꼴은 숫자 칸(`data-numeric`)·숫자 입력·코드와 ID에만 쓰고, 한글 머리·캡션·내비·섹션 라벨·배지·eyebrow에는 쓰지 않는다(§13, T7-I1).
- 청사진 파랑을 넓은 면이나 주 버튼에 칠하지 않는다. 파랑은 선택·포커스·정보·차트 전용이다.
- 격자·눈금 선을 장식으로 깔지 않는다. 선은 실제 칸(표·카드·머리)을 나눌 때만 긋고, 구분선(`--border`)도 배경 대비 3:1 이상이다(§6 선 구획 예외의 조건).
- 그림자를 더하지 않는다(S0). 깊이는 선과 표면 명도 차이로만 만든다.

## 레퍼런스에서 가져온 기법

- https://www.krds.go.kr/ : 색 램프의 단계 차로 대비를 정한다. muted-foreground는 배경 대비 7:1 단계(8.56 · 10.24)에, 선 구획 구분선(`--border`)은 3:1 단계(3.67 · 3.94)에 둔다. 입력 틀은 I3 잉크 틀이라 본문 대비(12.68 · 7.71)다. 표본 유형은 public(S 1.0, 본문 대비 16.18)이고, 가져온 것은 단계 차 규칙 하나뿐이다.
- https://www.moto-card.com/ : 유채색을 하나만 두고 나머지는 무채 명도 단계로 채운다(표본 유채 1, 본문 대비 20.03). 청사진 파랑 하나, 나머지는 hue 255로 살짝 기운 회색이다.
- https://www.photiu.ai/ : 화면 제목과 본문의 비율을 3배로 둔다(표본 h1:본문 3.0, S 1.0). 49/16 ≈ 3.06.
- component-k17 : KPI를 카드 여러 장 대신 1px 구분선 한 줄 셀로 나눈다.
- type-t06 : 큰 수치에 단위를 작게(45%) 붙인다.
- color-c02 : 데이터 색을 한 hue의 명도 단계만으로 구성한다(chart-1~5).
