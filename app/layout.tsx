import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/registry/factory/components/theme-provider"
import { MotionBoot } from "@/registry/factory/motion/motion-boot"
import { cn } from "@/registry/factory/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      {/* 모션 키트 서버 렌더 첫 칠 가림(motion-gsap) — 문서대로 머리에 둔다. 서버 렌더 히어로 검사 /qa/recipes/ssr 가 이 설치를 그대로 잰다. */}
      <head>
        <MotionBoot />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
