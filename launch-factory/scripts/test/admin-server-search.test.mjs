// 관리 목록 서버 검색(계획 3d 후속): 가려서 나가는 연락처 칸(메일·이름·번호)을 서버가 맞추는 구획만 serverSearch 를 선언하고,
// 목록 쪽이 그 선언을 블록까지 넘겨 블록이 받은 행을 검색어로 다시 거르지 않는다. 선언이 없는 구획은 예전처럼 보이는 칸 안에서만 거른다.
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..")
const DIR = join(ROOT, "template", "lib", "launch", "admin-sections")
const read = (...p) => readFileSync(join(ROOT, ...p), "utf8")
const sectionOf = (id) => read("template", "lib", "launch", "admin-sections", `${id}.ts`)

// list 가 검색어로 연락처 칸까지 서버에서 찾는 구획: 이메일·이름(사용자) · 이메일(뉴스레터) · 접수 번호·이름·연락처(문의) · 예약 번호·연락처·이름(예약) · 작성자·본문(후기)
const SERVER_SEARCH = ["users", "newsletter", "inquiries", "bookings", "reviews"]

test("서버 검색 구획은 serverSearch 를 선언하고, 나머지 구획은 선언하지 않는다", () => {
  const ids = readdirSync(DIR).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3))
  for (const id of SERVER_SEARCH) assert.match(sectionOf(id), /^\s*serverSearch: true,/m, `${id}: serverSearch 선언 없음`)
  for (const id of ids.filter((x) => !SERVER_SEARCH.includes(x))) assert.doesNotMatch(sectionOf(id), /serverSearch/, `${id}: list 가 가린 칸을 검색하지 않는데 선언했다`)
  // 선언한 구획은 list 가 검색어를 실제로 서버 서비스에 넘긴다
  assert.match(sectionOf("users"), /q: search/)
  assert.match(sectionOf("newsletter"), /\{ search \}/)
  assert.match(sectionOf("inquiries"), /search: q\.search/)
  assert.match(sectionOf("bookings"), /search: q\.search/)
  assert.match(sectionOf("reviews"), /search: q\.search/)
})

test("구획 쪽이 선언을 읽어 목록 패널에, 패널이 블록에 넘긴다 — 서버 검색이면 받은 행을 검색어로 다시 거르지 않는다", () => {
  const registry = read("template", "lib", "launch", "admin-console.ts")
  assert.match(registry, /export const searchesOnServer = \(id: string\): boolean => hasServerSearch\(ADMIN_SECTIONS, id\)/)
  const page = read("template", "app", "(product)", "admin", "[section]", "page.tsx")
  assert.equal((page.match(/serverSearch: searchesOnServer\(section\)/g) ?? []).length, 1, "선언은 한 곳(shared)에서 읽는다")
  assert.equal((page.match(/<AdminListPanel \{\.\.\.shared\}/g) ?? []).length, 2, "읽기 성공·실패 두 패널 모두 shared 를 받는다")
  const panel = read("template", "components", "product", "admin-blocks.tsx")
  assert.match(panel, /const serverSide = truncated \|\| serverSearch \|\|/)
  assert.match(panel, /serverSearch=\{serverSearch\} \{\.\.\.prefs\}/)
  const block = read("template", "components", "blocks", "data-table", "admin-list.tsx")
  assert.match(block, /applyQuery\(data, api\.query, \{ serverSearch, locale \}\)/)
})
