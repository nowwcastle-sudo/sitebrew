import "./globals.css"
import { MotionBoot } from "@/components/motion/motion-boot"
import { cn } from "@/lib/utils"
import build from "@/lib/build.json"
import site from "@/content/site.json"

// 찍어낸 사이트의 뿌리 레이아웃(P3-3 Task 9). 언어·기본 색 갈래는 gen-pages 가 쓴 값에서 온다(lib/build.json, content/site.json).
// 서체 로더는 레시피 설치(shadcn add)가 이 파일에 더한다. <MotionBoot />는 등장 대상(data-enter)을 첫 칠에 가린다.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={site.locale === "en" ? "en" : "ko"} suppressHydrationWarning className={cn("antialiased", "font-sans", build.theme === "dark" && "dark")}>
      <head>
        <MotionBoot />
      </head>
      <body>{children}</body>
    </html>
  )
}
