import { ogImage, readOgFont } from "@/components/ax/og-image"
import { OG_SIZE } from "@/components/ax/seo-meta"
import { ogProps } from "@/lib/site"

// 기본 공유 그림(1200×630) — seoMetadata 가 가리키는 /opengraph-image. 제목·이름은 content/site.json, 색은 레시피(lib/build.json)에서 온다.
// 정적 내보내기(output "export")는 force-static 을 명시한 메타데이터 경로만 받는다(없으면 Failed to collect page data for /opengraph-image). 평소 빌드는 이미 정적이라 출력이 같다.
export const dynamic = "force-static"
export const size = OG_SIZE
export const contentType = "image/png"
export const alt = ogProps().title

export default async function Image() {
  return ogImage({ ...ogProps(), fonts: [await readOgFont()] })
}
