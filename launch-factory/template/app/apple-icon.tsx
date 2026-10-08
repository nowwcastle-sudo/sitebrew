import { ImageResponse } from "next/og"
import { PRODUCT_NAME } from "@/content/copy.en"

// 홈 화면 아이콘(apple-touch-icon·manifest, L02). icon.tsx 와 같은 임시 아이콘 — 제품이 로고 파일(app/apple-icon.png)로 바꾼다.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111111", color: "#ffffff", fontSize: 120 }}>
        {PRODUCT_NAME.slice(0, 1).toUpperCase()}
      </div>
    ),
    size,
  )
}
