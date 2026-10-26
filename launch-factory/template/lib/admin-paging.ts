// 관리 화면 목록의 서버 쪽 매김(계획 3d 후속) — 순수 함수. 쪽 번호는 주소(?page=)가 들고, 검색·상태 거르기를 바꾸면 쪽은 지운다(1쪽으로).
// 서버가 쪽마다 pageSize 줄을 주고(콘솔이 limit·offset 으로 바꾼다), 이 함수는 「n–m / 전체」 범위와 이전·다음 주소를 만든다. 화면 글은 content/copy.admin.en.ts 가 가진다.

export type AdminPagerInput = {
  section: string
  q?: string | undefined
  status?: string | undefined
  /** 지금 쪽(1부터) */
  page: number
  /** 한 쪽의 줄 수(구획 선언 pageSize, 기본 100) */
  pageSize: number
  /** 조건에 맞는 전체 줄 수 */
  total: number
  /** 이 쪽에서 실제 받은 줄 수 */
  shown: number
}

export type AdminPager = {
  page: number
  pages: number
  /** 이 쪽의 첫·끝 줄 번호(1부터). 이 쪽에 줄이 없으면 둘 다 0 */
  from: number
  to: number
  total: number
  prevHref: string | null
  nextHref: string | null
}

/** 구획 목록 주소. 1쪽은 page 를 싣지 않는다 */
export function adminListHref({ section, q, status, page }: { section: string; q?: string | undefined; status?: string | undefined; page?: number }): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status) params.set("status", status)
  if (page && page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/admin/${section}?${qs}` : `/admin/${section}`
}

/** 쪽 이동 정보. 한 쪽에 다 들어가면(그리고 1쪽이면) null — 이동 줄을 그리지 않는다 */
export function adminPager(input: AdminPagerInput): AdminPager | null {
  const { section, q, status, page, pageSize, total, shown } = input
  if (total <= 0 || pageSize < 1) return null
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1 && page <= 1) return null
  const at = (p: number) => adminListHref({ section, q, status, page: p })
  const from = shown > 0 ? (page - 1) * pageSize + 1 : 0
  return {
    page,
    pages,
    from,
    to: shown > 0 ? from + shown - 1 : 0,
    total,
    // 범위를 넘은 쪽(?page=99)에서는 이전이 마지막 쪽으로 돌아간다
    prevHref: page > 1 ? at(Math.min(page - 1, pages)) : null,
    nextHref: page < pages ? at(page + 1) : null,
  }
}
