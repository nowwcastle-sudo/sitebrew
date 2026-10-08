import type { MetadataRoute } from "next"
import { PRODUCT_NAME } from "@/content/copy.en"
import { metaCopy } from "@/content/copy.ux.en"

// 웹 앱 manifest(L02). 값은 제품 설정에서 온다. 아이콘은 icon.tsx·apple-icon.tsx 가 제품 이름 첫 글자로 만든다 — 제품이 로고 파일로 바꾼다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME.slice(0, 12),
    description: metaCopy.description,
    start_url: "/",
    display: "standalone",
    background_color: metaCopy.themeColor,
    theme_color: metaCopy.themeColor,
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  }
}
