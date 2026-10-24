// 2단계 — 템플릿 복사. git 이 추적하는 파일만(없으면 걷기) 가져오고 빌드·설치 부산물과 .env* 는 뺀다. e2e·scripts/ci 는 남긴다(출력에서도 smoke·loop 가 돈다)
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo, listFiles, withSecrets } from "../lib.mjs"

export const id = "template"

export function run(state) {
  const { to, templateDir, rules } = state
  if (existsSync(to) && readdirSync(to).length) throw new Error(`출력 폴더가 비어 있지 않다: ${to}`)
  mkdirSync(to, { recursive: true })
  for (const rel of listFiles(templateDir, withSecrets(rules, rules.templateExclude))) copyFileTo(join(templateDir, rel), join(to, rel))
  return state
}
