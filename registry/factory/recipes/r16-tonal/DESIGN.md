---
id: r16-tonal
name: 단색 음영
mood: [단색, 음영, 정제]
axes: { radius: R2, button: B4, input: I1, surface: C3, table: T2, header: H2, shadow: S1 }
motion: M2
colorLogic: K9
dynamics: [mesh-gradient, split-text]
signature: [hero, bento]
hero: video-montage
alternates:
  colorLogic: K9
  color:
    light:
      background: "oklch(0.9750 0.0120 165.00)"
      foreground: "oklch(0.2000 0.0500 165.00)"
      card: "oklch(0.9950 0.0050 165.00)"
      card-foreground: "oklch(0.2000 0.0500 165.00)"
      popover: "oklch(0.9950 0.0050 165.00)"
      popover-foreground: "oklch(0.2000 0.0500 165.00)"
      primary: "oklch(0.4000 0.1000 165.00)"
      primary-foreground: "oklch(0.9800 0.0100 165.00)"
      secondary: "oklch(0.9300 0.0300 165.00)"
      secondary-foreground: "oklch(0.2000 0.0500 165.00)"
      muted: "oklch(0.9500 0.0200 165.00)"
      accent: "oklch(0.8800 0.0700 165.00)"
      accent-foreground: "oklch(0.2200 0.0600 165.00)"
      border: "oklch(0.8600 0.0300 165.00)"
      ring: "oklch(0.4000 0.1000 165.00)"
      muted-foreground: "oklch(0.4250 0.0500 165.00)"
      input: "oklch(0.5000 0.0700 165.00)"
    dark:
      background: "oklch(0.1700 0.0350 165.00)"
      foreground: "oklch(0.9500 0.0150 165.00)"
      card: "oklch(0.2100 0.0400 165.00)"
      card-foreground: "oklch(0.9500 0.0150 165.00)"
      popover: "oklch(0.2100 0.0400 165.00)"
      popover-foreground: "oklch(0.9500 0.0150 165.00)"
      primary: "oklch(0.7800 0.1000 165.00)"
      primary-foreground: "oklch(0.1700 0.0400 165.00)"
      secondary: "oklch(0.2600 0.0450 165.00)"
      secondary-foreground: "oklch(0.9500 0.0150 165.00)"
      muted: "oklch(0.2500 0.0400 165.00)"
      accent: "oklch(0.3400 0.0800 165.00)"
      accent-foreground: "oklch(0.9500 0.0150 165.00)"
      border: "oklch(0.3300 0.0500 165.00)"
      ring: "oklch(0.7800 0.1000 165.00)"
      muted-foreground: "oklch(0.7100 0.0450 165.00)"
      input: "oklch(0.5000 0.0600 165.00)"
  fonts:
    display: { family: "Noto Serif KR", item: font-noto-serif-kr, weight: 600, tuned: "B안 제목 전용 세리프. 굵기 600, 자간 -0.01em, 행간 1.2. 한글은 같은 서체의 한글 면" }
  note: "색 논리 K9 는 그대로, 남청 262° 한 색상각을 청록 165° 한 색상각으로 옮긴 변형(여전히 한 색상각의 명도 단계만). 제목체는 노토 세리프로 바꾼다. 모션·기법은 A 그대로"
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Jost", item: font-jost, weight: 500, tuned: "제목 전용 굵기 500, 자간 -0.015em, 행간 1.08. 숫자는 라이닝" }
  body: { family: "Pretendard", item: font-pretendard, tuned: "본문 16px/1.65 굵기 400" }
  mono: { family: "IBM Plex Mono", item: font-ibm-plex-mono, tuned: "앱 창 안 코드·단축키에만, 굵기 400" }
color:
  light:
    background: "oklch(0.9750 0.0120 262.00)"
    foreground: "oklch(0.2000 0.0500 262.00)"
    card: "oklch(0.9950 0.0050 262.00)"
    card-foreground: "oklch(0.2000 0.0500 262.00)"
    popover: "oklch(0.9950 0.0050 262.00)"
    popover-foreground: "oklch(0.2000 0.0500 262.00)"
    primary: "oklch(0.4200 0.1400 262.00)"
    primary-foreground: "oklch(0.9800 0.0100 262.00)"
    secondary: "oklch(0.9300 0.0300 262.00)"
    secondary-foreground: "oklch(0.2000 0.0500 262.00)"
    muted: "oklch(0.9500 0.0200 262.00)"
    muted-foreground: "oklch(0.4300 0.0500 262.00)"
    accent: "oklch(0.8800 0.0700 262.00)"
    accent-foreground: "oklch(0.2200 0.0600 262.00)"
    destructive: "oklch(0.5200 0.1800 27.00)"
    border: "oklch(0.8600 0.0300 262.00)"
    input: "oklch(0.5000 0.0700 262.00)"
    ring: "oklch(0.4200 0.1400 262.00)"
    success: "oklch(0.5200 0.1100 152.00)"
    success-foreground: "oklch(0.9850 0.0050 152.00)"
    warning: "oklch(0.5500 0.1200 68.00)"
    warning-foreground: "oklch(0.9850 0.0050 68.00)"
    info: "oklch(0.5000 0.1200 255.00)"
    info-foreground: "oklch(0.9850 0.0040 255.00)"
  dark:
    background: "oklch(0.1700 0.0350 262.00)"
    foreground: "oklch(0.9500 0.0150 262.00)"
    card: "oklch(0.2100 0.0400 262.00)"
    card-foreground: "oklch(0.9500 0.0150 262.00)"
    popover: "oklch(0.2100 0.0400 262.00)"
    popover-foreground: "oklch(0.9500 0.0150 262.00)"
    primary: "oklch(0.7800 0.1100 262.00)"
    primary-foreground: "oklch(0.1700 0.0400 262.00)"
    secondary: "oklch(0.2600 0.0450 262.00)"
    secondary-foreground: "oklch(0.9500 0.0150 262.00)"
    muted: "oklch(0.2500 0.0400 262.00)"
    muted-foreground: "oklch(0.7100 0.0450 262.00)"
    accent: "oklch(0.3400 0.0800 262.00)"
    accent-foreground: "oklch(0.9500 0.0150 262.00)"
    destructive: "oklch(0.7000 0.1500 25.00)"
    border: "oklch(0.3300 0.0500 262.00)"
    input: "oklch(0.5050 0.0600 262.00)"
    ring: "oklch(0.7800 0.1100 262.00)"
    success: "oklch(0.7400 0.1100 152.00)"
    success-foreground: "oklch(0.1900 0.0200 152.00)"
    warning: "oklch(0.8000 0.1200 78.00)"
    warning-foreground: "oklch(0.2000 0.0300 78.00)"
    info: "oklch(0.7400 0.1000 255.00)"
    info-foreground: "oklch(0.1900 0.0150 255.00)"
references:
  - refs-v2:colorLogic=K9:archetype=landing
  - refs-v2:colorLogic=K9:archetype=brand
  - docs/inputs/style_axes.md#K9
archetypes: [landing, brand]
archetypeConditions:
  brand: "제품 하나를 크게 보이는 브랜드 소개 쪽에서 쓴다. 여러 색이 이야기를 하는 브랜드에는 r8-dusk 나 r9-clay"
---

## 분위기

한 가지 푸른빛의 명도 단계만으로 짠 화면이다. 바탕은 아주 옅은 남청, 글자는 짙은 남청, 주색은 그 사이의 중간 단계이고 다른 색상각은 없다(상태색만 예외). 첫 화면은 전체를 덮는 짧은 컷 몽타주 위에 같은 색상각의 짙은 막을 얹고 큰 제목을 놓은 구성이며, 메시 그라디언트는 같은 색상각의 명도 차로만 번진다.

## 쓰는 법

- 맞는 원형은 제품 하나를 크게 보이는 브랜드 소개와 한 쪽 랜딩이다.
- 색 논리 K9(단색 램프): 바탕·글자·면·선·얼굴색의 채도 0.05 이상 색은 모두 한 색상각(262° 근처)이다. 위계는 명도 단계 다섯으로 만든다 — 바탕, 면, 선, 주색, 글자.
- 첫 화면은 히어로 `video-montage`이다: 첫 화면 전체에서 짧은 컷(영상 클립·사진)이 하드 컷으로 이어지고, 그 위 막(같은 색상각의 짙은 명도 단계 하나)에 큰 제목·문단·버튼을 얹는다. 컷의 색은 막으로 눌러 한 색상각 안에 둔다.
- 모션은 M2이다. 제목은 글자 분할(split-text)로, 바탕은 같은 색상각의 메시 그라디언트(mesh-gradient)가 느리게 번진다.
- 버튼은 알약(B4), 반경은 R2, 카드는 C3, 헤더는 떠 있는 섬(H2)이다.

## 하지 말 것

- 강조 때문에 두 번째 색상각을 들이지 않는다. 강조는 명도 차와 크기로 한다.
- 메시 그라디언트에 다른 색상각을 섞지 않는다.
- 상태색(성공·경고·오류)을 장식에 쓰지 않는다. 의미 전용이다.
- 글자·선의 명도 차를 줄여 「은은하게」 만들지 않는다. 본문은 7:1, 선은 3:1을 지킨다.

## 레퍼런스에서 가져온 기법

- K9·landing 카드 : 한 색의 명도 그라디언트를 바탕 전체로 쓰고 흰 글자와 어두운 버튼만 얹는다.
- K9·landing 카드 : 한 줄 헤드라인과 제품 사용 장면 큰 컷으로 첫 화면을 끝낸다.
- K9·landing 카드 : 직립 굵은 문장과 이탤릭 세리프 문장을 한 헤드라인에 짝짓는 두 호흡.
- K9·brand 카드 : 제품 결과물을 전면 격자로 깔아 설명 없이 증거로 보인다.

## 초안 기록

- 계획: factory v1 Task 5.15 (2026-10-10) — 색 논리 K9(단색 램프)의 첫 레시피 초안이다.
- 레퍼런스: 레퍼런스 카드 v2 에서 같은 색 논리·원형의 카드를 읽었다. 카드는 저장소 밖 선택 자료라 원문도 사이트 이름도 싣지 않는다 — `references` 는 카드 폴더에서 `colorLogic` 과 `archetype` 으로 찾는 조건이다.
- 검사: 이 절을 뺀 사본으로 lint(A·B 모두)와 라이브러리 10벌과의 차이 검사(축·색·서체 고유)를 통과했다.
- 서체는 모두 폰트 키트 항목이고 라이선스 1차 출처는 `docs/qa/font-licenses.md` 에 있다.
- 확정: 보드 A2(2026-10-11)에서 운영자가 「좋다」로 골랐다. 첫 화면 히어로는 `narrow-title-wide-window` 에서 `screenshot-window` 로 한 번 바꿨다가(카탈로그의 기존 19개가 라이브러리 A·B 에 이미 다 쓰여 겹쳤기 때문) `video-montage` 로 다시 바꿨다 — `screenshot-window` 는 블록 메타 원형(saas·dashboard·landing)에 brand 가 없고 원형 JSON `landing` 의 hero 허용 목록에서도 빠져(C388 ②) 이 레시피의 원형(landing·brand)으로 찍은 사이트가 대표 첫 화면을 못 쓰는 짝이었다. `video-montage` 는 블록 메타·원형 JSON 모두에서 landing·brand 를 허용하고 어느 레시피도 대표 히어로로 쓰지 않으며, 한 색상각의 막 아래 컷이 이어지는 단색 음영 얼굴이 제품 하나를 크게 보이는 브랜드 소개에 맞다. 컷 위 색 덮개·명도 단계는 블록 코드를 고치지 않고 레시피의 면·기법 선택지 안에서 정한다.
- 2차 확인: 보드 A2 2차(2026-10-11)에서 바뀐 첫 화면(`video-montage`)도 운영자가 「좋다」로 골랐다.
