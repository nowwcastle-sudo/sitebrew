import { ImageResponse } from "next/og"
import { NEEDS_CHECK } from "@/registry/factory/content/content-core"
import { toHex } from "@/registry/factory/ax/brand-color"
import { OG_SIZE } from "@/registry/factory/ax/seo-meta"

/** ImageResponse 에 넘기는 서체 한 벌. ttf·otf·woff 만 된다(woff2 안 됨 — Next ImageResponse 문서). */
export interface OgFont {
  name: string
  data: ArrayBuffer | Uint8Array
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
  style?: "normal" | "italic"
}

export interface OgCardProps {
  /** 페이지 제목(화면 h1 과 같은 값) */
  title: string
  /** 브랜드·사이트 이름 */
  name: string
  /** 레시피 색(oklch·#hex) — Satori 는 oklch 를 읽지 못해 #hex 로 바꿔 그린다 */
  colors: { background: string; foreground: string; accent?: string }
  /** 앞에서부터 쓴다. 앞 서체에 없는 글자(한글 등)는 뒤 서체로 채운다 — 레시피 제목 서체 + 한글 키트 서체 순서 */
  fonts: OgFont[]
}

/** 키트 서체 Pretendard(OFL-1.1, npm pretendard) 굵은 면 — 한글 기본 서체. 소비자에 `pretendard` 가 있어야 한다. */
export const PRETENDARD_BOLD = "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf"

/**
 * 프로젝트 안 서체 파일 → OgFont. 기본은 Pretendard Bold(한글). Node 런타임(opengraph-image 기본)에서만 부른다.
 * 파일이 없으면 무엇을 설치할지 한국어로 알려 준다.
 *
 * 배포 번들(소비자 실측 2026-10-01, Next 16.3.4 Turbopack): 경로가 실행 때 정해지므로 Next 가 「프로젝트 전체 추적」 경고를 낸다 — 아래 `turbopackIgnore` 로 끈다.
 * 그 대가로 서체 파일이 자동으로 배포 번들에 들지 않는다. 요청 때 그리는 동적 경로(`app/blog/[slug]/opengraph-image.tsx`)는
 * `next.config` 에 `outputFileTracingIncludes: { "/**\/opengraph-image": [PRETENDARD_BOLD 의 "./" 경로] }` 를 더해야 추적에 들어간다
 * (정적 `app/opengraph-image.tsx` 는 빌드 때 읽으므로 필요 없다).
 */
export async function readOgFont(path: string = PRETENDARD_BOLD, name = "Pretendard", weight: OgFont["weight"] = 700): Promise<OgFont> {
  const { readFile } = await import("node:fs/promises")
  const { join } = await import("node:path")
  try {
    return { name, data: await readFile(join(/*turbopackIgnore: true*/ process.cwd(), path)), weight, style: "normal" }
  } catch {
    throw new Error(`readOgFont: 서체 파일이 없습니다 — ${path}. 한글 기본 서체는 \`npm i pretendard\`(키트 font-pretendard)로 설치합니다`)
  }
}

/** OG 카드 그림(1200×630). Satori 가 읽는 flex 레이아웃만 쓴다. */
export function OgCard({ title, name, colors, fonts }: OgCardProps) {
  const bg = toHex(colors.background), fg = toHex(colors.foreground), accent = toHex(colors.accent ?? colors.foreground)
  const t = title.trim() || NEEDS_CHECK
  const size = [...t].length > 28 ? 60 : 76
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: bg,
        color: fg,
        fontFamily: fonts.map((f) => f.name).join(", "),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 36 }}>
        <div style={{ width: 16, height: 48, background: accent, marginRight: 24 }} />
        {name}
      </div>
      <div style={{ display: "flex", fontSize: size, lineHeight: 1.2, fontWeight: 700 }}>{t}</div>
    </div>
  )
}

/**
 * OG 이미지 응답. 소비자 `app/opengraph-image.tsx`:
 * `export const size = OG_SIZE; export const contentType = "image/png"; export default async () => ogImage({ …, fonts: [await readOgFont()] })`.
 */
export function ogImage(props: OgCardProps): ImageResponse {
  if (!props.fonts.length) throw new Error("ogImage: 서체가 하나 이상 필요합니다 — 한글이 깨지지 않게 readOgFont()(Pretendard)를 넣습니다")
  return new ImageResponse(<OgCard {...props} />, {
    ...OG_SIZE,
    fonts: props.fonts.map((f) => ({ name: f.name, data: f.data as ArrayBuffer, weight: f.weight ?? 700, style: f.style ?? "normal" })),
  })
}
