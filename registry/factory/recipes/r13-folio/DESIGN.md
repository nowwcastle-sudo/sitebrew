---
id: r13-folio
name: 무채 문서첩
mood: [문서, 절제, 정돈]
axes: { radius: R1, button: B3, input: I2, surface: C1, table: T3, header: H5, shadow: S0 }
motion: M0
colorLogic: K3
dynamics: [oversize-crop, grain]
signature: [hero, doc-page]
hero: illustration-scene
alternates:
  colorLogic: K3
  color:
    light:
      background: "oklch(0.9840 0.0060 95.00)"
      foreground: "oklch(0.2000 0.0080 70.00)"
      card: "oklch(0.9980 0.0030 95.00)"
      card-foreground: "oklch(0.2000 0.0080 70.00)"
      popover: "oklch(0.9980 0.0030 95.00)"
      popover-foreground: "oklch(0.2000 0.0080 70.00)"
      primary: "oklch(0.3000 0.0120 60.00)"
      primary-foreground: "oklch(0.9900 0.0040 95.00)"
      secondary: "oklch(0.9500 0.0060 95.00)"
      secondary-foreground: "oklch(0.2000 0.0080 70.00)"
      muted: "oklch(0.9550 0.0060 95.00)"
      accent: "oklch(0.9300 0.0080 95.00)"
      accent-foreground: "oklch(0.2000 0.0080 70.00)"
      ring: "oklch(0.3000 0.0120 60.00)"
      muted-foreground: "oklch(0.4400 0.0120 70.00)"
      input: "oklch(0.5000 0.0120 80.00)"
      border: "oklch(0.5000 0.0100 90.00)"
    dark:
      background: "oklch(0.1750 0.0060 80.00)"
      foreground: "oklch(0.9400 0.0060 90.00)"
      card: "oklch(0.2150 0.0070 80.00)"
      card-foreground: "oklch(0.9400 0.0060 90.00)"
      popover: "oklch(0.2150 0.0070 80.00)"
      popover-foreground: "oklch(0.9400 0.0060 90.00)"
      primary: "oklch(0.9000 0.0080 90.00)"
      primary-foreground: "oklch(0.1750 0.0060 80.00)"
      secondary: "oklch(0.2450 0.0070 80.00)"
      secondary-foreground: "oklch(0.9400 0.0060 90.00)"
      muted: "oklch(0.2450 0.0070 80.00)"
      accent: "oklch(0.2850 0.0080 80.00)"
      accent-foreground: "oklch(0.9400 0.0060 90.00)"
      ring: "oklch(0.8200 0.0080 90.00)"
      muted-foreground: "oklch(0.7150 0.0100 90.00)"
      input: "oklch(0.5050 0.0100 80.00)"
      border: "oklch(0.5150 0.0080 80.00)"
  note: "색 논리 K3 는 그대로, 순수 회색을 종이 한 톤(색상각 95°·채도 0.006 이하)과 따뜻한 먹으로 옮긴 변형. 서체·모션 M0·기법은 A 그대로"
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "IBM Plex Sans", item: font-ibm-plex-sans, weight: 600, tuned: "제목 전용 굵기 600, 자간 -0.005em, 행간 1.2. 문서 안 소제목은 500" }
  displayKo: { family: "Nanum Myeongjo", item: font-nanum-myeongjo }
  body: { family: "IBM Plex Sans KR", item: font-ibm-plex-sans-kr, tuned: "본문 17px/1.75 굵기 400, 한 줄 40자 안쪽" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "코드·표 숫자 칸에만, 굵기 400" }
color:
  light:
    background: "oklch(0.9900 0.0000 0.00)"
    foreground: "oklch(0.2000 0.0000 0.00)"
    card: "oklch(1.0000 0.0000 0.00)"
    card-foreground: "oklch(0.2000 0.0000 0.00)"
    popover: "oklch(1.0000 0.0000 0.00)"
    popover-foreground: "oklch(0.2000 0.0000 0.00)"
    primary: "oklch(0.3000 0.0000 0.00)"
    primary-foreground: "oklch(0.9900 0.0000 0.00)"
    secondary: "oklch(0.9600 0.0000 0.00)"
    secondary-foreground: "oklch(0.2000 0.0000 0.00)"
    muted: "oklch(0.9600 0.0000 0.00)"
    muted-foreground: "oklch(0.4400 0.0000 0.00)"
    accent: "oklch(0.9400 0.0000 0.00)"
    accent-foreground: "oklch(0.2000 0.0000 0.00)"
    destructive: "oklch(0.5000 0.1600 27.00)"
    border: "oklch(0.5000 0.0000 0.00)"
    input: "oklch(0.5000 0.0000 0.00)"
    ring: "oklch(0.3000 0.0000 0.00)"
    success: "oklch(0.5000 0.0800 152.00)"
    success-foreground: "oklch(0.9850 0.0050 152.00)"
    warning: "oklch(0.5200 0.0900 68.00)"
    warning-foreground: "oklch(0.9850 0.0050 68.00)"
    info: "oklch(0.4800 0.0700 255.00)"
    info-foreground: "oklch(0.9850 0.0040 255.00)"
  dark:
    background: "oklch(0.1700 0.0000 0.00)"
    foreground: "oklch(0.9400 0.0000 0.00)"
    card: "oklch(0.2100 0.0000 0.00)"
    card-foreground: "oklch(0.9400 0.0000 0.00)"
    popover: "oklch(0.2100 0.0000 0.00)"
    popover-foreground: "oklch(0.9400 0.0000 0.00)"
    primary: "oklch(0.9200 0.0000 0.00)"
    primary-foreground: "oklch(0.1700 0.0000 0.00)"
    secondary: "oklch(0.2400 0.0000 0.00)"
    secondary-foreground: "oklch(0.9400 0.0000 0.00)"
    muted: "oklch(0.2400 0.0000 0.00)"
    muted-foreground: "oklch(0.7100 0.0000 0.00)"
    accent: "oklch(0.2800 0.0000 0.00)"
    accent-foreground: "oklch(0.9400 0.0000 0.00)"
    destructive: "oklch(0.7000 0.1500 25.00)"
    border: "oklch(0.5100 0.0000 0.00)"
    input: "oklch(0.5050 0.0000 0.00)"
    ring: "oklch(0.8200 0.0000 0.00)"
    success: "oklch(0.7400 0.1100 152.00)"
    success-foreground: "oklch(0.1900 0.0200 152.00)"
    warning: "oklch(0.8000 0.1200 78.00)"
    warning-foreground: "oklch(0.2000 0.0300 78.00)"
    info: "oklch(0.7400 0.1000 255.00)"
    info-foreground: "oklch(0.1900 0.0150 255.00)"
references:
  - refs-v2:colorLogic=K3:archetype=portfolio
  - refs-v2:colorLogic=K3:archetype=landing
  - docs/inputs/style_axes.md#K3
archetypes: [portfolio, public]
archetypeConditions:
  portfolio: "작품보다 글·기록이 앞서는 포트폴리오(사례 연구·연혁)일 때. 작품 사진이 주인공이면 r4-evidence 나 r7-docs"
  public: "공고·보고서·회의록처럼 문서 본문이 중심인 쪽에서 쓴다"
---

## 분위기

종이 문서 한 권을 넘기는 화면이다. 색은 순수 회색 단계뿐이고, 강조는 굵기·밑줄·크기로 한다. 첫 화면 제목은 문장 속에 칩이 끼어 있는 큰 글자이고, 본문은 한 줄 40자 안쪽의 좁은 열이다. 연한 질감(그레인)과 잘리는 큰 글자가 유일한 장식이다.

## 쓰는 법

- 맞는 원형은 글·기록이 앞서는 포트폴리오와 공고·보고서가 중심인 공공 쪽이다.
- 색 논리 K3(문서형 무채색): 얼굴색(`primary`·`secondary`·`accent`·`ring`)이 모두 무채색이다. 링크는 색이 아니라 밑줄과 굵기로 알린다. 상태색만 채도를 가진다.
- 첫 화면은 히어로 `illustration-scene`이다: 전폭 큰 제목 아래 전폭 그림 한 장이 첫 화면을 채우고, 문단·버튼은 그림 위가 아니라 바탕색 카드에 든다. 제목은 영문 IBM Plex Sans 600, 한글은 나눔명조로 읽힌다.
- 모션은 M0이다. 등장 연출이 없고 정지 기법(oversize-crop·grain)만 쓴다. 큰 글자는 칸 밖으로 잘려 나가게 둔다.
- 표는 T3, 헤더는 마스트헤드(H5)다: 큰 제호가 스크롤로 올라가고 얇은 레일만 남는다. H5 는 선 구획 값이라 선(border)이 배경 대비 3:1 이다 — 회색 선도 흐리게 두지 않는다.

## 하지 말 것

- 링크·버튼 강조에 유채색을 더하지 않는다. 색이 필요하면 이 레시피가 아니다.
- 무채색에 쿨/웜 한 톤을 몰래 섞어 「거의 무채색」으로 만들지 않는다 — 톤이 필요하면 B안을 쓴다.
- 그레인 위에 7:1 미만 글자를 얹지 않는다.
- 카드 그림자·블러로 깊이를 만들지 않는다(S0). 구분은 선과 여백이다.
- 넓은 면에 원색 바탕을 깔지 않는다. 색은 의미 태그의 옅은 짝에만 있다.

## 레퍼런스에서 가져온 기법

- K3·portfolio 카드 : 번호 붙은 쪽 썸네일을 가로로 늘어놓아 사이트 흐름을 작업물로 보인다.
- K3·portfolio 카드 : 세리프 제목과 모노스페이스 부제를 짝지어 절제된 장인 인상을 만든다.
- K3·landing 카드 : 한 페이지에 행동 하나만 두는 구성.
- K3·saas 카드 : 큰 선언문 두 줄과 어두운 패널 하나만으로 제품이 대체하는 것을 말한다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K3(문서형 무채색)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `inline-chip-title` 에서 `illustration-scene` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 무채 문서첩은 글이 앞서고 그림은 한 장으로 차분히 받치는 쪽이라, 그림 위에 글을 얹지 않는 이 구성이 맞고 블록 메타 archetypes(public·portfolio·landing·saas·pwa)가 이 레시피 원형(portfolio·public)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`illustration-scene`)도 운영자가 「좋다」로 골랐다.
