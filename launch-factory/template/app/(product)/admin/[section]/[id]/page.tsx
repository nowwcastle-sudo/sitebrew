import { notFound } from "next/navigation"
import { adminRecord, adminSections } from "@/app/actions/admin-console"
import { AdminRecordPanel } from "@/components/product/admin-blocks"
import { AdminPageTitle, gateScreen, readFailure } from "@/components/product/admin-screens"
import { adminPageTitles } from "@/content/copy.admin.en"
import { parseRecordId, parseSectionId } from "@/lib/admin-params"

export const metadata = { title: "Admin record", robots: { index: false, follow: false } }

// 기록 하나(요약·편집·행동·위험 행동). 모양이 틀린 주소와 목록에 없는 구획은 404, 구획은 있는데 기록이 없으면 블록이 「찾을 수 없어요」 빈 상태를 그린다.
export default async function AdminRecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const raw = await params
  const section = parseSectionId(raw.section)
  const id = parseRecordId(raw.id)
  if (!section || !id) notFound()
  const next = `/admin/${section}/${id}`
  const [sections, record] = await Promise.all([adminSections(), adminRecord({ section, id })])
  const gate = gateScreen(sections, next) ?? gateScreen(record, next)
  if (gate) return gate
  const info = sections.ok ? sections.data.find((s) => s.id === section) : undefined
  if (!info) notFound()
  const title = adminPageTitles.record.replace("{section}", info.label)
  const missing = !record.ok && record.code === "not_found"
  return (
    <>
      <AdminPageTitle>{title}</AdminPageTitle>
      {record.ok ? (
        <AdminRecordPanel section={section} label={info.label} record={record.data} />
      ) : (
        <AdminRecordPanel section={section} label={info.label} record={null} {...(missing ? {} : { failure: readFailure(record) })} />
      )}
    </>
  )
}
