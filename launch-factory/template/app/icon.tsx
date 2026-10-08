import { ImageResponse } from "next/og"
import { PRODUCT_NAME } from "@/content/copy.en"

// 브라우저 탭 아이콘(favicon, L02). 제품 이름 첫 글자를 그린 임시 아이콘이다 — 제품이 로고 파일(app/icon.png 등)로 바꾼다.
// 이미지 렌더러가 그리는 style 은 문서 HTML 의 style 속성이 아니라서 엄격 CSP 와 상관없다.
export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111111", color: "#ffffff", fontSize: 22 }}>
        {PRODUCT_NAME.slice(0, 1).toUpperCase()}
      </div>
    ),
    size,
  )
}
