import type { Metadata } from "next"

// 프리셋마다 [data-preset] 로 가둔 대표 초안 색 변수(factory/scripts/gen-presets-gallery.mjs 생성물, .tmp 는 gitignore).
import "@/.tmp/presets/presets.css"

export const metadata: Metadata = {
  title: "QA · 스타일 프리셋",
}

export default function QaPresetsLayout({ children }: { children: React.ReactNode }) {
  return children
}
