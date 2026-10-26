import { adminOverview } from "@/app/actions/admin-console"
import { AdminOverviewPanel } from "@/components/product/admin-blocks"
import { AdminPageTitle, gateScreen, readFailure } from "@/components/product/admin-screens"
import { adminPageTitles } from "@/content/copy.admin.en"

export const metadata = { title: "Admin overview", robots: { index: false, follow: false } }

// 관리 개요: 지금 처리할 일 + 최근 변화. 읽을 수 있는 구획이 보탠 것을 콘솔이 합친다.
export default async function AdminPage() {
  const result = await adminOverview()
  const gate = gateScreen(result, "/admin")
  if (gate) return gate
  return (
    <>
      <AdminPageTitle>{adminPageTitles.overview}</AdminPageTitle>
      {result.ok ? <AdminOverviewPanel overview={result.data} /> : <AdminOverviewPanel overview={null} failure={readFailure(result)} />}
    </>
  )
}
