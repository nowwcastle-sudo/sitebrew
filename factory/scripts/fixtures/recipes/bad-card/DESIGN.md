---
id: fx-bad-card
name: 시험 도면
mood: [정확, 차분, 계측]
axes: { button: B1, input: I3, surface: C2, table: T4, header: H3, radius: R0, shadow: S2 }
motion: M1
colorLogic: K1
dynamics: [clip-reveal]
hero: twin-panels
icons: { library: lucide, weight: G1 }
fonts:
  display: { family: "Sora", item: font-sora, tuned: "굵기 600, 자간 -0.02em" }
  body: { family: "Pretendard", item: font-pretendard }
  mono: null
color:
  light:
    background: "oklch(0.985 0.003 230)"
    foreground: "oklch(0.2 0.01 230)"
    card: "oklch(0.995 0.002 230)"
    card-foreground: "oklch(0.9 0.002 230)"
    popover: "oklch(0.995 0.002 230)"
    popover-foreground: "oklch(0.2 0.01 230)"
    primary: "oklch(0.42 0.08 230)"
    primary-foreground: "oklch(0.985 0.003 230)"
    secondary: "oklch(0.95 0.006 230)"
    secondary-foreground: "oklch(0.26 0.012 230)"
    muted: "oklch(0.955 0.005 230)"
    muted-foreground: "oklch(0.43 0.012 230)"
    accent: "oklch(0.94 0.02 230)"
    accent-foreground: "oklch(0.3 0.05 238)"
    destructive: "oklch(0.53 0.2 27)"
    border: "oklch(0.6 0.012 230)"
    input: "oklch(0.62 0.012 230)"
    ring: "oklch(0.52 0.09 230)"
    success: "oklch(0.5 0.12 150)"
    success-foreground: "oklch(0.985 0.005 150)"
    warning: "oklch(0.55 0.13 60)"
    warning-foreground: "oklch(0.985 0.005 60)"
    info: "oklch(0.47 0.15 255)"
    info-foreground: "oklch(0.985 0.004 255)"
  dark:
    background: "oklch(0.17 0.008 230)"
    foreground: "oklch(0.95 0.005 230)"
    card: "oklch(0.21 0.009 230)"
    card-foreground: "oklch(0.95 0.005 230)"
    popover: "oklch(0.23 0.01 230)"
    popover-foreground: "oklch(0.95 0.005 230)"
    primary: "oklch(0.8 0.08 230)"
    primary-foreground: "oklch(0.2 0.02 230)"
    secondary: "oklch(0.27 0.01 230)"
    secondary-foreground: "oklch(0.95 0.005 230)"
    muted: "oklch(0.25 0.01 230)"
    muted-foreground: "oklch(0.8 0.01 230)"
    accent: "oklch(0.3 0.03 230)"
    accent-foreground: "oklch(0.92 0.02 230)"
    destructive: "oklch(0.7 0.16 25)"
    border: "oklch(0.55 0.012 230)"
    input: "oklch(0.5 0.012 230)"
    ring: "oklch(0.7 0.08 230)"
    success: "oklch(0.74 0.13 150)"
    success-foreground: "oklch(0.19 0.02 150)"
    warning: "oklch(0.8 0.13 75)"
    warning-foreground: "oklch(0.2 0.03 75)"
    info: "oklch(0.74 0.12 255)"
    info-foreground: "oklch(0.19 0.014 255)"
references: [layout-l20, color-c02]
archetypes: [dashboard, saas]
---

<!-- 시험용 레시피(예시). factory/scripts/recipe.test.mjs 만 읽는다. -->

## 분위기

정확하고 차분한 계측 화면. 선으로 구획을 나누고 모서리는 모두 직각이다.

## 쓰는 법

- 숫자가 많은 운영 화면에 쓴다. 표는 괘선 격자로 읽는다.
- 강조색은 한 가지만 쓴다.

## 하지 말 것

- 둥근 모서리를 섞지 않는다(§13 반경 섞기).
- 보라 그라디언트 히어로를 얹지 않는다(§13).

## 레퍼런스에서 가져온 기법

- layout-l20: 2px 잉크 선으로 머리와 본문을 끊는다.
- color-c02: 한 가지 청록 액센트.
