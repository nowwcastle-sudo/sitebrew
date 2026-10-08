import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "QA · 셸 고정 헤더",
}

export default function QaShellLayout({ children }: { children: React.ReactNode }) {
  return children
}
