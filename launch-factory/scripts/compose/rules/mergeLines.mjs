// mergeLines — 템플릿 파일 위에 시안 파일의 줄을 합집합으로 더한다(.gitignore). 템플릿의 줄과 순서가 먼저이고, 시안에만 있는 줄이 뒤에 붙는다.
// 템플릿의 .env 무시 줄이 빠지지 않는 것이 목적이다 — 시안 .gitignore 만 쓰면 .env.local 이 커밋된다.
// 시안의 `!` 줄이 비밀 파일(.env* 단 .env.example 은 아님, .vercel)을 다시 넣는 것도 막는다 — 뒤 줄이 앞 줄을 이긴다
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { globToRegExp } from "../lib.mjs"

export const id = "mergeLines"

const lines = (text) => text.split(/\r?\n/).map((l) => l.trimEnd())

/** 비밀 파일 견본 이름 — `!` 글롭이 하나라도 맞히면 비밀을 다시 넣는 줄이다 (.env.example 은 비밀이 아니라 견본에 없다) */
const SECRET_SAMPLES = [".env", ".env.local", ".env.production", ".env.development.local", ".vercel"]

/** `!` 줄의 글롭(폴더 경로·끝 슬래시를 뗀 마지막 이름)이 비밀 견본 이름 하나라도 맞히는가: `!.env.local` `!*.local` `!.env*` `!*` 모두 */
export const reincludesSecret = (line) => {
  if (!line.startsWith("!")) return false
  const glob = line.slice(1).replace(/\/+$/, "").split("/").pop()
  return SECRET_SAMPLES.some((name) => globToRegExp(glob).test(name))
}

export function mergeLines(templateText, siteText) {
  const have = new Set(lines(templateText).filter(Boolean))
  const extra = lines(siteText).filter((l) => l && !have.has(l) && !reincludesSecret(l))
  return `${lines(templateText).join("\n").trimEnd()}\n${extra.length ? `\n${extra.join("\n")}\n` : ""}`
}

export function run(state) {
  for (const { file } of state.plan.filter((p) => p.rule.kind === "mergeLines")) {
    const target = join(state.to, file)
    const site = readFileSync(join(state.siteDir, file), "utf8")
    writeFileSync(target, existsSync(target) ? mergeLines(readFileSync(target, "utf8"), site) : site)
  }
  return state
}
