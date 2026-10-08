// OKLCH → 선형 sRGB → WCAG 대비. contrast.mjs(테마 CSS)와 recipe.mjs(레시피 머리 색)가 함께 쓴다.

// 알파(oklch(… / a) 의 a, 0~1). 없으면 1.
export function alphaOf(value) {
  const m = value.match(/\/\s*(\d*\.?\d+)(%?)\s*\)\s*$/)
  return m ? Number(m[1]) / (m[2] ? 100 : 1) : 1
}

// OKLCH → 선형 sRGB (Björn Ottosson, OKLab 정의). 알파는 여기서 보지 않는다 — 대비는 ratio() 가 불투명 색만 받는다.
export function oklchToLinearSrgb(value) {
  const m = value.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) throw new Error(`OKLCH 아님: ${value}`)
  const L = Number(m[1]) / (m[2] ? 100 : 1), C = Number(m[3]), h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)))
}

export const luminance = (v) => { const [r, g, b] = oklchToLinearSrgb(v); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
// 반투명 색은 거절한다(T6-M6): 알파를 버리고 불투명처럼 재면 실제보다 대비가 높게 나온다. 합성(배경 위 겹침) 대신 거절을 고른 이유 —
// 대비를 재는 토큰(글자·면·링·입력 테두리)은 DESIGN §7 상 불투명이어야 하고, 합성하려면 「무엇 위에 놓이나」를 토큰마다 정해야 한다.
export const ratio = (fg, bg) => {
  for (const c of [fg, bg]) if (alphaOf(c) < 1) throw new Error(`반투명 색은 대비를 잴 수 없다 — 불투명으로 쓴다: ${c}`)
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}
