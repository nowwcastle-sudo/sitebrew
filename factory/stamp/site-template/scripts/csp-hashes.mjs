// next build 뒤 실행(package.json build) — 정적으로 만들어진 모든 HTML 의 인라인 script sha256 을 모아 routes-manifest 의 CSP script-src 에 주입한다(대장 C171).
//   next start·Vercel 은 build 가 남긴 .next/routes-manifest.json 의 headers 를 그대로 쓴다. 자세한 이유는 ../security-headers.mjs.
//   WF_STATIC_EXPORT=1(단일 HTML 내보내기 빌드)은 headers 가 없으므로 건너뛴다. 종료 0 = 주입함/건너뜀 · 1 = 주입 못 함(CSP 헤더 없음·HTML 없음).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { inlineScriptHashes, patchRoutesManifest } from "../security-headers.mjs"

if (process.env.WF_STATIC_EXPORT === "1") {
  console.log("csp-hashes: 정적 내보내기 빌드 — 건너뜀")
  process.exit(0)
}

const dist = join(process.cwd(), ".next")
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []))

try {
  const appDir = join(dist, "server", "app")
  if (!existsSync(appDir)) throw new Error(`${appDir} 가 없다 — next build 가 먼저 끝나야 한다`)
  const files = walk(appDir)
  if (!files.length) throw new Error("정적으로 만들어진 HTML 이 하나도 없다")
  const hashes = [...new Set(files.flatMap((f) => inlineScriptHashes(readFileSync(f, "utf8"))))].sort()
  const manifestFile = join(dist, "routes-manifest.json")
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"))
  patchRoutesManifest(manifest, hashes)
  writeFileSync(manifestFile, JSON.stringify(manifest))
  writeFileSync(join(dist, "csp-hashes.json"), JSON.stringify({ pages: files.length, hashes: hashes.length, list: hashes }, null, 2) + "\n")
  console.log(`csp-hashes: 쪽 ${files.length}개 · 해시 ${hashes.length}개를 CSP script-src 에 주입했다`)
} catch (e) {
  console.error(`csp-hashes 실패: ${e?.message ?? e}`)
  process.exit(1)
}
