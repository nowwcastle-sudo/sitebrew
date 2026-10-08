import { ProductShell } from "@/components/product/product-shell"

// 법정 쪽(이용약관·개인정보 처리방침·환불)도 제품과 같은 틀 안에 둔다 — 위 띠(내비)·본문·바닥글에 더해 제품으로 돌아가는 링크(LFRUNFIX F2).
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <ProductShell backLink>{children}</ProductShell>
}
