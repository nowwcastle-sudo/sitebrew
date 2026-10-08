---
id: r14-concrete
name: 콘크리트 두 모드
mood: [거침, 직설, 대비]
axes: { radius: R0, button: B1, input: I3, surface: C2, table: T3, header: H3, shadow: S2, display: D2, texture: X2 }
motion: M2
colorLogic: K4
dynamics: [split-text, blend]
signature: [hero, bento]
hero: punch-in-statement
alternates:
  colorLogic: K4
  color:
    light:
      primary: "oklch(0.4650 0.2000 268.00)"
      primary-foreground: "oklch(0.9900 0.0030 268.00)"
      ring: "oklch(0.4650 0.2000 268.00)"
    dark:
      primary: "oklch(0.7200 0.1500 268.00)"
      primary-foreground: "oklch(0.1400 0.0200 268.00)"
      ring: "oklch(0.7200 0.1500 268.00)"
  fonts:
    display: { family: "Sirin Stencil", item: font-sirin-stencil, weight: 400, tuned: "스텐실 제목 전용. 굵기 400 한 면, 대문자, 자간 0.02em. 본문·UI에는 쓰지 않는다" }
    displayKo: { family: "Gasoek One", item: font-gasoek-one }
  note: "색 논리 K4 는 그대로, 강조 빨강 하나를 파랑 268°로 바꾼 변형(여전히 강조 하나). 제목체는 스텐실 라틴(Sirin Stencil)과 굵은 한글(Gasoek One)로 바꾼다. 모션·기법은 A 그대로"
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Archivo", item: font-archivo, weight: 800, tuned: "제목 전용 굵기 800, 대문자 우선, 자간 -0.02em, 행간 0.95" }
  displayKo: { family: "Black Han Sans", item: font-black-han-sans }
  body: { family: "Gothic A1", item: font-gothic-a1, tuned: "본문 16px/1.55 굵기 500, 숫자 tabular-nums" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "코드·수치 라벨에만, 굵기 600" }
color:
  light:
    background: "oklch(0.9620 0.0040 95.00)"
    foreground: "oklch(0.1400 0.0000 0.00)"
    card: "oklch(0.9880 0.0020 95.00)"
    card-foreground: "oklch(0.1400 0.0000 0.00)"
    popover: "oklch(0.9880 0.0020 95.00)"
    popover-foreground: "oklch(0.1400 0.0000 0.00)"
    primary: "oklch(0.4650 0.2100 28.00)"
    primary-foreground: "oklch(0.9900 0.0030 28.00)"
    secondary: "oklch(0.9200 0.0030 95.00)"
    secondary-foreground: "oklch(0.1400 0.0000 0.00)"
    muted: "oklch(0.9300 0.0030 95.00)"
    muted-foreground: "oklch(0.3600 0.0000 95.00)"
    accent: "oklch(0.9000 0.0000 0.00)"
    accent-foreground: "oklch(0.1400 0.0000 0.00)"
    destructive: "oklch(0.5200 0.1800 27.00)"
    border: "oklch(0.1400 0.0000 0.00)"
    input: "oklch(0.1400 0.0000 0.00)"
    ring: "oklch(0.4650 0.2100 28.00)"
    success: "oklch(0.5200 0.1100 152.00)"
    success-foreground: "oklch(0.9850 0.0050 152.00)"
    warning: "oklch(0.5500 0.1200 68.00)"
    warning-foreground: "oklch(0.9850 0.0050 68.00)"
    info: "oklch(0.5000 0.1200 255.00)"
    info-foreground: "oklch(0.9850 0.0040 255.00)"
  dark:
    background: "oklch(0.1700 0.0000 0.00)"
    foreground: "oklch(0.9300 0.0000 0.00)"
    card: "oklch(0.2100 0.0000 0.00)"
    card-foreground: "oklch(0.9300 0.0000 0.00)"
    popover: "oklch(0.2100 0.0000 0.00)"
    popover-foreground: "oklch(0.9300 0.0000 0.00)"
    primary: "oklch(0.6600 0.2000 28.00)"
    primary-foreground: "oklch(0.1400 0.0200 28.00)"
    secondary: "oklch(0.2500 0.0000 0.00)"
    secondary-foreground: "oklch(0.9300 0.0000 0.00)"
    muted: "oklch(0.2500 0.0000 0.00)"
    muted-foreground: "oklch(0.7850 0.0000 0.00)"
    accent: "oklch(0.3000 0.0000 0.00)"
    accent-foreground: "oklch(0.9300 0.0000 0.00)"
    destructive: "oklch(0.7000 0.1500 25.00)"
    border: "oklch(0.5100 0.0000 0.00)"
    input: "oklch(0.5100 0.0000 0.00)"
    ring: "oklch(0.6600 0.2000 28.00)"
    success: "oklch(0.7400 0.1100 152.00)"
    success-foreground: "oklch(0.1900 0.0200 152.00)"
    warning: "oklch(0.8000 0.1200 78.00)"
    warning-foreground: "oklch(0.2000 0.0300 78.00)"
    info: "oklch(0.7400 0.1000 255.00)"
    info-foreground: "oklch(0.1900 0.0150 255.00)"
references:
  - refs-v2:colorLogic=K4:archetype=saas
  - refs-v2:colorLogic=K4:archetype=pwa
  - docs/inputs/style_axes.md#K4
archetypes: [landing, saas]
archetypeConditions:
  saas: "개발자·제작자 도구처럼 거친 직설 어조가 제품 성격과 맞을 때. 일반 사무용 SaaS 에는 r4-evidence 나 r1-measure"
---

## 분위기

인쇄물과 계기판 사이의 화면이다. 라이트는 스위스 인쇄물처럼 거의 흰 종이 위에 거의 검정 잉크, 다크는 텔레메트리 화면처럼 짙은 회색 위에 옅은 회색 글자다. 두 모드 모두 강조는 빨강 하나뿐이고, 두꺼운 선·딱딱한 그림자·제목 크기의 큰 글자·인쇄 망점 질감이 얼굴이다.

## 쓰는 법

- 맞는 원형은 제작자·개발자 도구처럼 직설 어조가 어울리는 SaaS 소개 쪽과 한 쪽 랜딩이다. 이 레시피는 대담안 후보다.
- 색 논리 K4(브루탈 두 모드): 라이트(인쇄)와 다크(텔레메트리) 중 한 모드로 쓴다. 두 모드가 같은 위계를 가지고, 강조 빨강은 모드마다 명도만 바꿔 하나만 둔다. 선(border)·입력 테두리는 라이트에서 잉크, 다크에서 옅은 회색이고 두께는 2px 이상이다.
- 첫 화면은 히어로 `punch-in-statement`이다: 바탕색 위에 아주 큰 한 문장 제목(D2 초대형)을 놓고 마지막 낱말만 주색 면 위 키워드로 착지시킨다. 제목과 안내 글은 사진 위가 아니라 바탕 위에 있어 대비가 바탕 대 글자 색으로 정해진다.
- 카드는 C2(선 격자 칸), 그림자는 S2(딱딱한 오프셋), 반경은 0이다. 면 위 질감은 X2(인쇄 망점)다.
- 모션은 M2이다. 제목은 글자 분할(split-text)로 튀어나오고, 블렌드 모드(blend)는 정지 장식에만 쓴다.

## 하지 말 것

- 강조 색을 둘 이상 쓰지 않는다. 빨강 하나가 버튼·링크·현재 위치를 모두 맡는다.
- 밝은 바탕과 어두운 바탕을 한 화면에 섞지 않는다. 모드는 화면 전체가 하나다.
- 선을 1px로 줄이지 않는다. 브루탈은 선의 굵기가 얼굴이다.
- 그림자에 번짐(blur)을 넣지 않는다. 오프셋은 선명한 사각이다.
- 어두운 바탕에서 형광 초록·주홍을 면이나 글로우로 쓰지 않는다(§13 「거의 검정 + 형광 한 점」).

## 레퍼런스에서 가져온 기법

- K4·saas 카드 : 주 버튼은 색 채움, 보조 버튼은 회색 채움으로 위계를 색만으로 구분한다.
- K4·pwa 카드 : 결과물 카드 한 장을 한가운데 두고 설정은 아래 막대로 내린다.
- K4·saas 카드 : 어두운 면에서 한 색만 움직여 데이터가 흐르는 느낌을 준다.
- K4·dashboard 카드 : 굵은 단색 선과 큰 제목으로 직설 어조를 만든다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K4(브루탈 두 모드)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `grid-lines-baseline-word` 에서 `punch-in-statement` 로 바꿨다 — 카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문이다. 거칠고 직설인 얼굴이 한 문장을 크게 때려 박는 구성과 맞고, 글자를 사진 위가 아닌 바탕색 위에 두어 보드 A2 에서 읽기 어렵다던 사진 위 글자 대비 문제가 없다. 블록 메타 archetypes(saas·brand·commerce·landing·detail)가 이 레시피 원형(landing·saas)과 겹친다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`punch-in-statement`)도 운영자가 「좋다」로 골랐다.
- 대비 고침: 새 히어로의 주 버튼 글자(주색 위 흰 글자)가 히어로 글자 대비 관문의 본문 7:1 에 A 6.38 · B 6.74 로 못 미쳤다. 라이트 주색(과 같은 값인 ring)의 명도만 A 0.50 → 0.465 · B 0.48 → 0.465 로 낮춰 7.07 · 7.20 이 되게 했다(색상각·채도는 그대로). 다크 주색(5.85)은 관문이 재는 기본 테마가 아니라 그대로다.
