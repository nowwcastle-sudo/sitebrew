// 관리 목록의 서버 쪽 매김(계획 3d 후속) — 순수 부분(lib/admin-paging.ts)과 목록 화면 연결(쪽 파일 · 패널)의 글자 약속. 브라우저·서버 없이 돈다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const read = (rel) => readFileSync(join(ROOT, rel), "utf8")
const { adminListHref, adminPager } = await import(pathToFileURL(join(ROOT, "template/lib/admin-paging.ts")).href)
const { newIdempotencyKey } = await import(pathToFileURL(join(ROOT, "template/lib/admin-params.ts")).href)

const base = { section: "orders", pageSize: 100 }

test("adminListHref — 1쪽은 page 를 싣지 않고, 검색·상태는 그대로 싣는다", () => {
  assert.equal(adminListHref({ section: "orders" }), "/admin/orders")
  assert.equal(adminListHref({ section: "orders", page: 1 }), "/admin/orders")
  assert.equal(adminListHref({ section: "orders", page: 3 }), "/admin/orders?page=3")
  assert.equal(adminListHref({ section: "orders", q: "kim lee", status: "paid", page: 2 }), "/admin/orders?q=kim+lee&status=paid&page=2")
  assert.equal(adminListHref({ section: "orders", q: "a&b=c" }), "/admin/orders?q=a%26b%3Dc", "검색어는 주소로 안전하게 싣는다")
})

test("adminPager — 한 쪽에 다 들어가면 null, 아니면 범위와 이전·다음 주소", () => {
  assert.equal(adminPager({ ...base, page: 1, total: 0, shown: 0 }), null)
  assert.equal(adminPager({ ...base, page: 1, total: 100, shown: 100 }), null, "꼭 한 쪽")
  assert.equal(adminPager({ ...base, page: 1, total: 101, shown: 100 })?.pages, 2)

  assert.deepEqual(adminPager({ ...base, page: 1, total: 250, shown: 100 }), { page: 1, pages: 3, from: 1, to: 100, total: 250, prevHref: null, nextHref: "/admin/orders?page=2" })
  assert.deepEqual(adminPager({ ...base, page: 2, total: 250, shown: 100 }), { page: 2, pages: 3, from: 101, to: 200, total: 250, prevHref: "/admin/orders", nextHref: "/admin/orders?page=3" })
  assert.deepEqual(adminPager({ ...base, page: 3, total: 250, shown: 50 }), { page: 3, pages: 3, from: 201, to: 250, total: 250, prevHref: "/admin/orders?page=2", nextHref: null })
})

test("adminPager — 검색·상태를 이동 주소에 싣는다", () => {
  const p = adminPager({ ...base, q: "kim", status: "paid", page: 2, total: 250, shown: 100 })
  assert.equal(p.prevHref, "/admin/orders?q=kim&status=paid")
  assert.equal(p.nextHref, "/admin/orders?q=kim&status=paid&page=3")
})

test("adminPager — 범위를 넘은 쪽(줄 없음)은 범위 0 이고 이전이 마지막 쪽으로 돌아간다", () => {
  const p = adminPager({ ...base, page: 99, total: 250, shown: 0 })
  assert.equal(p.from, 0)
  assert.equal(p.to, 0)
  assert.equal(p.nextHref, null)
  assert.equal(p.prevHref, "/admin/orders?page=3")
  // 전체가 0건이면 이동 줄 자체가 없다
  assert.equal(adminPager({ ...base, page: 5, total: 0, shown: 0 }), null)
})

test("adminPager — 쪽 크기가 작은 구획(후기 50)도 같은 식", () => {
  const p = adminPager({ section: "reviews", pageSize: 50, page: 2, total: 120, shown: 50 })
  assert.deepEqual([p.pages, p.from, p.to], [3, 51, 100])
  assert.equal(adminPager({ section: "reviews", pageSize: 0, page: 1, total: 10, shown: 10 }), null, "쪽 크기가 틀리면 그리지 않는다")
})

test("목록 화면 연결 — 쪽 파일은 ?page= 를 읽어 서버에 넘기고, 패널은 서버 이동 줄을 그리며 거르기를 안 바꾼 표 조작은 주소를 건드리지 않는다", () => {
  const page = read("template/app/(product)/admin/[section]/page.tsx")
  assert.match(page, /parsePage\(sp\.page\)/)
  assert.match(page, /adminTable\(\{ section,[^}]*page \}\)|\.\.\.\(page > 1 \? \{ page \} : \{\}\)/)
  assert.match(page, /pageSize: pageSizeFor\(section\)/)

  const panel = read("template/components/product/admin-blocks.tsx")
  assert.match(panel, /adminPager\(\{ section, q, status, page, pageSize/)
  assert.match(panel, /<ServerPager pager=\{pager\} \/>/)
  assert.match(panel, /data-server-pager/)
  assert.match(panel, /if \(search === \(q \?\? ""\) && picked === \(status \?\? ""\)\) return/, "검색·상태가 같으면 router.replace 를 부르지 않는다(쪽 번호를 지킨다)")
  assert.match(panel, /router\.replace\(adminListHref\(\{ section, q: search \|\| undefined, status: picked \|\| undefined \}\)/, "검색·상태를 바꾸면 쪽은 1로(page 를 싣지 않는다)")

  for (const rel of ["registry/feature-admin-console/files/lib/launch/admin-console.ts", "template/lib/launch/admin-console.ts"]) assert.match(read(rel), /export const pageSizeFor = \(id: string\): number => pageSizeOf\(ADMIN_SECTIONS, id\)/, rel)
})

test("답변 중복 전송 방지 키 — 패널은 저장마다 키를 만들어 성공할 때까지 재사용하고, 성공하면 버리며, 구획은 그 키를 서비스에 넘긴다", () => {
  const panel = read("template/components/product/admin-blocks.tsx")
  assert.match(panel, /admin\.adminAct\(\{ section, id, action: record\.save, fields, idempotencyKey: key \}\)/)
  assert.match(panel, /saveKey\.current\?\.id === id \? saveKey\.current\.key : newIdempotencyKey\(\)/, "같은 기록이면 이전 키를 다시 쓴다")
  assert.match(panel, /if \(r\.ok\) \{\s*saveKey\.current = null/, "성공하면 다음 저장은 새 키")
  const key = newIdempotencyKey()
  assert.match(key, /^[A-Za-z0-9_-]{8,100}$/)
  assert.notEqual(key, newIdempotencyKey())
  for (const rel of ["registry/feature-inquiry/files/lib/launch/admin-sections/inquiries.ts", "template/lib/launch/admin-sections/inquiries.ts"]) {
    const src = read(rel)
    assert.match(src, /save: async \(actor, rec, values, ctx\)/, rel)
    assert.match(src, /idempotencyKey: ctx\.idempotencyKey/, rel)
    assert.match(src, /in_progress/, rel)
  }
})
