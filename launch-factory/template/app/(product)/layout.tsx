import { ProductShell } from "@/components/product/product-shell"

// 제품 화면 공통 틀 — 위 띠·본문·바닥글은 components/product/product-shell.tsx 에 있다(법정 쪽 묶음과 같은 틀, LFRUNFIX F2).
export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <ProductShell>{children}</ProductShell>
}
