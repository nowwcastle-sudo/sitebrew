import type { MetadataRoute } from "next"

import { manifestProps } from "@/lib/site"

// Web App Manifest(Next 16 app/manifest 규약 — 빌드 때 정적으로 만들어진다). 이름·설명·색은 lib/site 가 content/site.json·lib/build.json 에서 읽는다(J9).
// 아이콘은 favicon-kit 이 굽는 public/icon-192·512·maskable-512.png(gen-favicons) — 192·512 any + 512 maskable(web.dev add-manifest).
export default function manifest(): MetadataRoute.Manifest {
  const m = manifestProps()
  return {
    name: m.name,
    short_name: m.name,
    description: m.description,
    lang: m.lang,
    start_url: "/",
    display: "browser",
    background_color: m.background,
    theme_color: m.theme,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
