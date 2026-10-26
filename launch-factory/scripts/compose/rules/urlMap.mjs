// urlMap — URL 이 겹치거나 같은 일을 하는 시안 쪽을 url-map.json 대로 정한다.
//   winner "template": 시안 쪽 파일은 버리고, 가져온 시안 파일 안의 링크를 템플릿 URL 로 바꾼다.
//   winner "site":     같은 URL 의 템플릿 쪽 파일을 지우고 시안 쪽을 쓴다(홈 `/`).
//   줄에 siteWhenOff: true 가 있고 템플릿 쪽이 고르지 않은 기능의 것이라 drop 이 지울 쪽이면 시안 쪽이 이긴다 —
//   결제를 묻지 않는 쇼핑몰의 /refund 같은 법정 쪽이 둘 다 사라지지 않게(요금제처럼 기능과 함께 없어져야 하는 쪽은 이 표지가 없다).
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo, isTextFile, urlOf, walk, withSecrets } from "../lib.mjs"
import { droppedOf, turnedOn } from "./drop.mjs"

export const id = "urlMap"

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/** 따옴표로 시작하는 문자열 맨 앞이 site URL 이고 바로 뒤가 (/) ? # 따옴표인 곳만 바꾼다(/login 이 /login-help 를 건드리지 않고, "/login/" 의 끝 슬래시는 남는다) */
export function rewriteLinks(text, moves) {
  return moves.reduce((acc, { site, template }) => acc.replace(new RegExp(`(["'\`])${escape(site)}(?=/?[?#"'\`])`, "g"), `$1${template}`), text)
}

/** 이 구성에서의 이긴 쪽 — siteWhenOff 줄은 표에서 소유자가 모두 꺼진(drop 이 지울) 템플릿 쪽이 이기지 못한다 */
export function winnersFor(rows, table, features) {
  const off = new Set(droppedOf(table.pages, turnedOn(table, features)).map((p) => p.url))
  return new Map([...rows].map(([url, row]) => [url, row.winner === "template" && row.siteWhenOff && off.has(row.template) ? { ...row, winner: "site" } : row]))
}

export function run(state) {
  const { plan, to, siteDir } = state
  const rows = winnersFor(state.rows, state.table, state.features)
  const templateFiles = walk(to, withSecrets(state.rules, state.rules.templateExclude))
  for (const { file } of plan.filter((p) => p.rule.kind === "urlMap")) {
    const row = rows.get(urlOf(file))
    if (row.winner === "template") {
      state.dropped.push(file)
      continue
    }
    for (const gone of templateFiles.filter((f) => urlOf(f) === row.template)) {
      rmSync(join(to, gone))
      state.removed.push(gone)
    }
    copyFileTo(join(siteDir, file), join(to, file))
    state.written.add(file)
    state.copied.push(file)
  }
  const moves = [...rows.values()].filter((r) => r.winner === "template" && r.site !== r.template)
  for (const rel of [...state.written].filter(isTextFile)) {
    const file = join(to, rel)
    const text = readFileSync(file, "utf8")
    const next = rewriteLinks(text, moves)
    if (next !== text) writeFileSync(file, next)
  }
  return state
}
