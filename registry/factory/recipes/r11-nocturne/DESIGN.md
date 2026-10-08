---
id: r11-nocturne
name: 다크 모드 우선(테크) 초안(생성)
mood:
  - 어두운
  - 밤
  - 깊은
axes:
  radius: R1
  button: B3
  input: I1
  surface: C1
  table: T2
  header: H1
  shadow: S0
motion: M2
colorLogic: K1
defaultTheme: dark
dynamics:
  - clip-reveal
signature:
  - hero
hero: narrow-title-wide-window
icons:
  library: lucide
  weight: G1
fonts:
  display:
    family: Tenor Sans
    item: font-tenor-sans
  body:
    family: Pretendard
    item: font-pretendard
  mono:
    family: IBM Plex Mono
    item: font-ibm-plex-mono
color:
  light:
    background: oklch(0.975 0.008 119.1)
    foreground: oklch(0.22 0.01 0)
    card: oklch(0.975 0.008 119.1)
    popover: oklch(0.975 0.008 119.1)
    card-foreground: oklch(0.22 0.01 0)
    popover-foreground: oklch(0.22 0.01 0)
    primary: oklch(0.5581 0.1748 45.03)
    primary-foreground: oklch(0.975 0.008 119.1)
    secondary: oklch(0.9297 0.0081 111.95)
    secondary-foreground: oklch(0.22 0.01 0)
    muted: oklch(0.9372 0.0081 113.14)
    muted-foreground: oklch(0.4314 0.0094 33.35)
    accent: oklch(0.925 0.028 110.21)
    accent-foreground: oklch(0.22 0.01 0)
    destructive: oklch(0.55 0.19 27)
    border: oklch(0.8542 0.0083 100.04)
    input: oklch(0.6277 0.0089 64.31)
    ring: oklch(0.5581 0.1748 45.03)
    success: oklch(0.52 0.14 150)
    success-foreground: oklch(0.99 0.005 150)
    warning: oklch(0.52 0.15 65)
    warning-foreground: oklch(0.99 0.005 65)
    info: oklch(0.52 0.13 245)
    info-foreground: oklch(0.99 0.005 245)
  dark:
    background: oklch(0.2134 0 0)
    foreground: oklch(0.8352 0.1578 119.1)
    card: oklch(0.2134 0 0)
    popover: oklch(0.2134 0 0)
    card-foreground: oklch(0.8352 0.1578 119.1)
    popover-foreground: oklch(0.8352 0.1578 119.1)
    primary: oklch(0.6531 0.1748 45.03)
    primary-foreground: oklch(0.2134 0 0)
    secondary: oklch(0.2507 0.0095 7.15)
    secondary-foreground: oklch(0.8352 0.1578 119.1)
    muted: oklch(0.2445 0.0079 5.95)
    muted-foreground: oklch(0.7233 0.1294 97.66)
    accent: oklch(0.2662 0.021 5.4)
    accent-foreground: oklch(0.8352 0.1578 119.1)
    destructive: oklch(0.7 0.19 27)
    border: oklch(0.3129 0.0252 19.06)
    input: oklch(0.5243 0.0789 59.55)
    ring: oklch(0.6531 0.1748 45.03)
    success: oklch(0.74 0.14 150)
    success-foreground: oklch(0.19 0.02 150)
    warning: oklch(0.74 0.15 65)
    warning-foreground: oklch(0.19 0.02 65)
    info: oklch(0.74 0.13 245)
    info-foreground: oklch(0.19 0.02 245)
references:
  - https://onepagelove.com/color/dark
  - https://figma.com/resource-library/web-design-trends
  - https://saaslandingpage.com/tag/dark/
  - palette:pal-ch-191919750e21e3651dbed754
archetypes:
  - dashboard
---

## 분위기

다크 모드 우선(테크) 스타일 프리셋(preset-dark-mode-first)에서 만든 초안이다. 기본 테마가 다크, 바탕 L 0.12~0.22에 색조 · 제품 스크린샷이 주인공 · 액센트 하나, 면적 10% 이하 · 밝기 차로 층 구분, 그림자 약하게.

## 쓰는 법

- 팔레트 pal-ch-191919750e21e3651dbed754(use recipe)를 색 논리 K1 로 두 테마에 펼쳤다(명도만 조정 — 색상각·채도 유지).
- 조건: styles 레인 allow-with-rules: §13 표 「거의 검정 + 형광 초록·주홍 한 점」 · §5-B SHOULD 색조 다크 · kill-ai-slop #06 atmosphere glow / sns 레인 allow-with-rules: §13 표 3행 「거의 검정 + 형광 한 점」 회피 — 액센트 채도 낮추기
- 반경: 스타일 사전과 시각 규칙이 정하지 않아 기본 R1(브리프 16a)

## 하지 말 것

- 스타일 사전의 조건(verdictReason)을 어기는 장식을 더하지 않는다.

## 레퍼런스에서 가져온 기법

- https://onepagelove.com/color/dark
- https://figma.com/resource-library/web-design-trends
- https://saaslandingpage.com/tag/dark/
- 팔레트 pal-ch-191919750e21e3651dbed754

## 승격 기록

- 승격 원본: dashboard-1/c
- 출처: 생성(source generated)
- 출처 프리셋: preset-dark-mode-first
- 팔레트: pal-ch-191919750e21e3651dbed754
- 서체: Tenor Sans / Pretendard
- 결선 날짜: 2026-10-02
- 원형·브리프: dashboard · 소규모 물류 창고 재고·출고 현황 운영 대시보드 (가상 사업체 — 예시)

## 운영자 확인 전

운영자가 이 초안을 확인하기 전이라 `gen:all` 은 이 레시피를 넣지 않는다(컴파일·갤러리·프리셋·에이전트 입구에서 모두 빠진다). 확인이 끝나면 이 절(제목 줄 포함)을 지운다 — 다음 `gen:all` 이 넣고, 그때 레시피 사이 차이·다양성 검사가 처음으로 이 레시피를 본다.
