import type * as React from "react"
import { NavTopBar } from "@/components/blocks/nav/top-bar"
import { adminSections } from "@/app/actions/admin-console"
import { AdminSidebar } from "@/components/product/admin-blocks"
import { AdminDenied, gateScreen } from "@/components/product/admin-screens"
import { adminTopBar } from "@/content/copy.admin.en"

// 관리 화면은 색인하지 않는다 — X-Robots-Tag 는 proxy.ts(lib/seo.ts NOINDEX_PREFIXES), 여기 robots 는 같은 뜻의 메타다. lib/public-paths.json 에도 없다(로그인한 사람의 쪽).
export const metadata = { title: "Admin", robots: { index: false, follow: false } }

// 관리 틀: 왼쪽 메뉴(볼 수 있는 구획만) + 위 띠 + 본문. 구획 목록을 못 얻으면(로그아웃·권한 없음·2단계 인증 없음·대리 세션) 본문 대신 한 줄 안내만 보인다.
// 접근 판단은 서버가 한다(콘솔이 세션에서 읽은 신원으로 정한다) — 이 틀은 그 결과를 그릴 뿐이고, 각 쪽·서버 액션도 따로 같은 판단을 받는다.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sections = await adminSections()
  const gate = gateScreen(sections, "/admin")
  if (gate) return gate
  if (!sections.ok) return <AdminDenied reason="other" />
  if (sections.data.length === 0) return <AdminDenied reason="nothing" />
  return (
    <div data-admin-shell="" className="flex w-full flex-col lg:flex-row">
      <AdminSidebar sections={sections.data} />
      <div className="flex min-w-0 flex-1 flex-col">
        <NavTopBar copy={adminTopBar} />
        {children}
      </div>
    </div>
  )
}
