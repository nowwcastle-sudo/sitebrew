import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "QA · 기본 부품",
}

export default function QaBaseLayout({ children }: { children: React.ReactNode }) {
  return children
}
