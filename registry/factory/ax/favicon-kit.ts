import type { MetadataRoute, Viewport } from "next"
import { toHex } from "@/registry/factory/ax/brand-color"

/**
 * 파비콘 세트 계획(파일 목록). 원천은 브랜드 표지 SVG 하나 — 칠할 곳은 `currentColor` 로 적는다(레시피 색으로 칠한다).
 * 래스터(ico·png)는 빌드 스크립트 `factory/scripts/gen-favicons.mjs`(sharp)가 이 목록대로 굽는다. 경로는 소비자 프로젝트 기준
 * Next 파일 규약 자리다: `app/icon.svg`·`app/favicon.ico`(루트 app 에만)·`app/apple-icon.png`, 매니페스트 아이콘은 `public/`.
 */
export interface FaviconFile {
  path: string
  kind: "svg" | "ico" | "png"
  /** 그릴 SVG(한 변 크기의 정사각형) */
  svg: string
  /** 픽셀 크기(ico 는 여러 개) */
  sizes: number[]
  /** 매니페스트 purpose(매니페스트 아이콘만) */
  purpose?: "any" | "maskable"
}

export interface FaviconColors {
  /** 표지 색(라이트) */
  color: string
  /** 표지 색(다크 — icon.svg 가 prefers-color-scheme 으로 바꾼다) */
  darkColor: string
  /** 배경이 필요한 아이콘(apple-icon·maskable)의 바탕색. 기본 흰색 */
  background?: string
}

/** 마스커블 안전 영역: 가운데 원 반지름 = 한 변의 40%(web.dev maskable-icon). 표지는 그 원에 내접하는 정사각형 안에 둔다. */
export const MASKABLE_SAFE_RADIUS = 0.4
const MASKABLE_BOX = (2 * MASKABLE_SAFE_RADIUS) / Math.SQRT2

const BAD = /<script|<foreignObject|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["'](?!#)/i

/** 표지 SVG 를 읽는다: 바깥 <svg> 의 viewBox 와 안쪽 내용. 스크립트·이벤트 속성·외부 참조는 거절한다. */
export function parseMark(svg: string): { viewBox: string; inner: string } {
  const m = svg.trim().match(/^(?:<\?xml[^>]*>\s*)?<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i)
  if (!m) throw new Error("faviconSet: <svg>…</svg> 하나로 된 표지가 아닙니다")
  if (BAD.test(svg)) throw new Error("faviconSet: 표지 SVG 에 스크립트·이벤트 속성·외부 참조를 쓸 수 없습니다")
  const vb = m[1].match(/viewBox\s*=\s*["']([^"']+)["']/i)
  if (!vb) throw new Error("faviconSet: 표지 SVG 에 viewBox 가 필요합니다")
  const [, , w, h] = vb[1].trim().split(/[\s,]+/).map(Number)
  if (!(w > 0 && h > 0)) throw new Error(`faviconSet: viewBox 가 올바르지 않습니다 — ${vb[1]}`)
  if (!/currentColor/i.test(m[2])) throw new Error("faviconSet: 칠할 곳을 currentColor 로 적어야 레시피 색으로 칠할 수 있습니다")
  return { viewBox: vb[1].trim(), inner: m[2] }
}

/** 표지를 한 변 size 정사각형 가운데에 box 비율로 놓는다(비율 유지). bg 가 있으면 바탕을 깐다. */
function frame(mark: { viewBox: string; inner: string }, size: number, box: number, color: string, bg?: string, style = ""): string {
  const s = size * box, o = (size - s) / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"${style ? "" : ` color="${color}"`}>` +
    style +
    (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "") +
    `<svg x="${o}" y="${o}" width="${s}" height="${s}" viewBox="${mark.viewBox}" preserveAspectRatio="xMidYMid meet">${mark.inner}</svg></svg>`
  )
}

/**
 * 표지 SVG + 색 → 파비콘 파일 목록. `app/icon.svg` 는 안에 `prefers-color-scheme` 스타일을 넣어 다크에서 darkColor 로 바뀐다
 * (web.dev adaptive favicon). ico 16·32, apple-icon 180(배경 채움 — iOS 는 투명을 검게 칠한다), 매니페스트 192·512(any)와
 * 512 maskable(배경 채움 + 안전 영역). 색은 #hex 로 바꿔 넣는다(래스터 도구가 oklch 를 못 읽는다).
 */
export function faviconSet(svg: string, colors: FaviconColors): FaviconFile[] {
  const mark = parseMark(svg)
  const color = toHex(colors.color), dark = toHex(colors.darkColor), bg = toHex(colors.background ?? "#ffffff")
  const adaptive = `<style>svg{color:${color}}@media (prefers-color-scheme: dark){svg{color:${dark}}}</style>`
  return [
    { path: "app/icon.svg", kind: "svg", sizes: [512], svg: frame(mark, 512, 1, color, undefined, adaptive) },
    { path: "app/favicon.ico", kind: "ico", sizes: [16, 32], svg: frame(mark, 32, 1, color) },
    { path: "app/apple-icon.png", kind: "png", sizes: [180], svg: frame(mark, 180, 0.8, color, bg) },
    { path: "public/icon-192.png", kind: "png", sizes: [192], svg: frame(mark, 192, 1, color), purpose: "any" },
    { path: "public/icon-512.png", kind: "png", sizes: [512], svg: frame(mark, 512, 1, color), purpose: "any" },
    { path: "public/icon-maskable-512.png", kind: "png", sizes: [512], svg: frame(mark, 512, MASKABLE_BOX, color, bg), purpose: "maskable" },
  ]
}

/** 매니페스트(app/manifest.ts)의 icons — faviconSet 의 public/ 아이콘에서 만든다. */
export function manifestIcons(files: FaviconFile[]): NonNullable<MetadataRoute.Manifest["icons"]> {
  return files
    .filter((f) => f.purpose)
    .map((f) => ({ src: "/" + f.path.replace(/^public\//, ""), sizes: `${f.sizes[0]}x${f.sizes[0]}`, type: "image/png", purpose: f.purpose }))
}

/** theme-color 라이트·다크 둘(Next 16 은 metadata 가 아니라 viewport 에 둔다). 레시피 배경색을 넘긴다. */
export function themeColor(light: string, dark: string): Pick<Viewport, "themeColor"> {
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: toHex(light) },
      { media: "(prefers-color-scheme: dark)", color: toHex(dark) },
    ],
  }
}
