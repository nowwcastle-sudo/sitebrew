// launch-factory: 사용자 CSV 내려받기(GET). 관리자 벽을 지난 요청만 받는다 — 로그인 안 함 401, 관리자 아님·2단계 없음 403, 꺼져 있음 503.
// 질의: ?q=검색어&banned=true|false&role=admin|user&sort=createdAt|email|name&dir=asc|desc. BOM·수식 무력화·서울 시각(대장 D90). 내려받기는 admin_actions 에 남는다.
import { runAdmin } from "@/lib/launch/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const filter: Record<string, string> = {}
  if (p.get("banned")) filter.banned = p.get("banned") ?? ""
  if (p.get("role")) filter.role = p.get("role") ?? ""
  const input: Record<string, unknown> = {}
  if (p.get("q")) input.q = p.get("q")
  if (Object.keys(filter).length) input.filter = filter
  if (p.get("sort")) input.sort = { field: p.get("sort"), dir: p.get("dir") ?? "desc" }
  const r = await runAdmin((a) => a.exportUsersCsv(input))
  if (!r.ok) return Response.json(r, { status: r.status, headers: { "cache-control": "no-store" } })
  return new Response(r.data.body, {
    headers: { "content-type": r.data.contentType, "content-disposition": `attachment; filename="${r.data.filename}"`, "cache-control": "no-store" },
  })
}
