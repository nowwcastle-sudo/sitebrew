import { notFound } from "next/navigation"
import { adminSections, adminTable } from "@/app/actions/admin-console"
import { pageSizeFor, searchesOnServer } from "@/lib/launch/admin-console"
import { AdminListPanel } from "@/components/product/admin-blocks"
import { AdminPageTitle, gateScreen, readFailure } from "@/components/product/admin-screens"
import { adminPageTitles } from "@/content/copy.admin.en"
import { parsePage, parseSearch, parseSectionId, parseStatus } from "@/lib/admin-params"

export const metadata = { title: "Admin", robots: { index: false, follow: false } }

// 구획 목록(주문·예약·문의 …). 이 사람이 볼 수 없거나 꺼진 구획은 목록에 없으므로 없는 주소와 같이 404 다(구획이 있는지 알려 주지 않는다).
// 검색·상태 거르기·쪽은 주소(?q=&status=&page=)로 서버에 간다 — 표가 한 쪽(구획의 pageSize 줄)보다 길 때 전체에서 찾고 쪽을 넘기게 한다.
export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const section = parseSectionId((await params).section)
  if (!section) notFound()
  const sp = await searchParams
  const q = parseSearch(sp.q)
  const status = parseStatus(sp.status)
  const page = parsePage(sp.page)
  const [sections, table] = await Promise.all([adminSections(), adminTable({ section, ...(q ? { search: q } : {}), ...(status ? { status } : {}), ...(page > 1 ? { page } : {}) })])
  const gate = gateScreen(sections, `/admin/${section}`) ?? gateScreen(table, `/admin/${section}`)
  if (gate) return gate
  const info = sections.ok ? sections.data.find((s) => s.id === section) : undefined
  if (!info || (!table.ok && table.code === "not_found")) notFound()
  const shared = { section, label: info.label, q, status, page, pageSize: pageSizeFor(section), serverSearch: searchesOnServer(section) }
  const title = adminPageTitles.list.replace("{section}", info.label)
  return (
    <>
      <AdminPageTitle>{title}</AdminPageTitle>
      {table.ok ? <AdminListPanel {...shared} table={table.data} /> : <AdminListPanel {...shared} table={null} failure={readFailure(table)} />}
    </>
  )
}
