// 태그 찍기 전 검사. 사용: npm run registry:pincheck -- vX.Y.Z  (또는 -- --ref vX.Y.Z · --ref=vX.Y.Z)
// 층별 registry.json 의 registryDependencies 가 모두 #vX.Y.Z 로 끝나고, package.json version 이 X.Y.Z 인지 본다. 하나라도 어긋나면 종료 코드 1.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRef } from './lib/registry-lib.mjs'

export const LAYERS = ['ui', 'lib', 'hooks', 'themes', 'base', 'fonts', 'motion', 'icons', 'contract', 'content', 'ax', 'blocks', 'r']

export function pinProblems(tag, registries, pkgVersion) {
  const problems = []
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) return [`태그 형식이 vX.Y.Z 가 아닙니다: ${tag}`]
  if (pkgVersion !== tag.slice(1)) problems.push(`package.json version ${pkgVersion} ≠ ${tag.slice(1)}`)
  let deps = 0
  for (const reg of registries) for (const item of reg.items) for (const d of item.registryDependencies ?? []) {
    deps++
    if (!d.endsWith(`#${tag}`)) problems.push(`${item.name}: ${d}`)
  }
  if (deps === 0) problems.push('registryDependencies 가 하나도 없습니다 — 생성물을 읽지 못했을 수 있습니다')
  return problems
}

// 태그 인자: 위치 인자와 --ref 둘 다 받는다(예전에는 --ref 자체를 태그로 읽었다). 없거나 둘이 다르면 던진다.
export function tagArg(argv) {
  const ref = parseRef(argv)
  const pos = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--ref')
  if (pos.length > 1) throw new Error(`태그를 하나만 준다: ${pos.join(' ')}`)
  if (ref && pos[0] && ref !== pos[0]) throw new Error(`태그가 둘이다: ${pos[0]} · --ref ${ref}`)
  const tag = ref ?? pos[0]
  if (!tag) throw new Error('태그가 필요합니다')
  return tag
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  let tag
  try { tag = tagArg(process.argv.slice(2)) } catch (e) { console.error(`pincheck: ${e.message} — 사용: npm run registry:pincheck -- vX.Y.Z | -- --ref vX.Y.Z`); process.exit(2) }
  const registries = LAYERS.map((l) => join(root, 'registry', 'factory', l, 'registry.json')).filter(existsSync).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const problems = pinProblems(tag, registries, version)
  const total = registries.reduce((n, r) => n + r.items.reduce((m, i) => m + (i.registryDependencies?.length ?? 0), 0), 0)
  if (problems.length) { console.error(`pincheck ${tag}: 실패 ${problems.length}건 (의존 주소 ${total}개)`); for (const p of problems) console.error('  ' + p); process.exit(1) }
  console.log(`pincheck ${tag}: 통과 — 의존 주소 ${total}개 모두 #${tag}, package.json ${version}`)
}
