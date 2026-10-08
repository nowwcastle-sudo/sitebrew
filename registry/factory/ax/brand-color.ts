/**
 * 레시피 색(oklch·#hex) → #rrggbb. OG 이미지(Satori — oklch 를 읽지 못한다, 2026-09-30 실측)와 파비콘 래스터(sharp)가
 * 같은 색을 쓰게 한다. oklch 는 OKLab 정의(Björn Ottosson)로 sRGB 에 옮기고 범위 밖은 자른다. 알파는 받지 않는다(불투명 색만).
 */
export function toHex(color: string): string {
  const c = color.trim()
  const hex = c.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) return "#" + (hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1]).toLowerCase()
  const m = c.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(deg)?\s*\)$/i)
  if (!m) throw new Error(`toHex: #hex 나 불투명 oklch(L C H) 색이 아닙니다 — ${color}`)
  const L = Number(m[1]) / (m[2] ? 100 : 1), C = Number(m[3]), h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const srgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return "#" + lin.map((x) => Math.round(Math.min(1, Math.max(0, srgb(Math.min(1, Math.max(0, x))))) * 255).toString(16).padStart(2, "0")).join("")
}
