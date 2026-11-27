// 2단계 — 템플릿 복사. git 이 추적하는 파일만(없으면 걷기) 가져오고 빌드·설치 부산물과 .env* 는 뺀다. e2e·scripts/ci 는 남긴다(출력에서도 smoke·loop 가 돈다)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { copyFileTo, listFiles, withSecrets } from "../lib.mjs"

export const id = "template"

export function run(state) {
  const { to, templateDir, rules } = state
  if (existsSync(to) && readdirSync(to).length) throw new Error(`출력 폴더가 비어 있지 않다: ${to}`)
  mkdirSync(to, { recursive: true })
  const selected = state.billingProvider === "toss-test"
  const tossRoute = (rel) => rel.startsWith("app/api/toss/") || rel.startsWith("app/api/cron/toss-test/") || rel.startsWith("app/(product)/account/billing/toss-test/")
  for (const rel of listFiles(templateDir, withSecrets(rules, rules.templateExclude))) {
    if (!selected && tossRoute(rel)) continue
    copyFileTo(join(templateDir, rel), join(to, rel))
  }
  if (!state.features) return state // 독립 복사 블록 시험에는 제품 선택이 없다.
  const config = join(to, "lib/toss-test-config.ts")
  const source = readFileSync(config, "utf8")
  const marker = "const TOSS_COMPOSE_ENABLED = true"
  if (!source.includes(marker) || source.includes("TOSS_COMPOSE_FAKE_ONLY")) throw new Error("토스 시험 결제 설정을 찾을 수 없습니다")
  writeFileSync(config, selected ? `// Sitebrew billing: toss-test\n${source}` : source.replace(marker, "const TOSS_COMPOSE_ENABLED = false"))
  const databaseFile = join(to, "lib/launch/db.ts")
  const database = readFileSync(databaseFile, "utf8")
  const databaseMarker = "const TOSS_TEST_DATABASE_ENABLED = true"
  if (!database.includes(databaseMarker)) throw new Error("토스 시험 데이터베이스 설정을 찾을 수 없습니다")
  if (!selected) writeFileSync(databaseFile, database.replace(databaseMarker, "const TOSS_TEST_DATABASE_ENABLED = false"))
  if (selected) {
    const nextFile = join(to, "next.config.ts")
    const next = readFileSync(nextFile, "utf8")
    writeFileSync(nextFile, `${next}\nif (process.env.NODE_ENV !== "development" || (process.env.LF_MODE && process.env.LF_MODE !== "mock")) throw new Error("토스 시험 앱은 개발 mock 모드에서만 실행할 수 있습니다")\n`)
    const portsFile = join(to, "lib/ports.ts")
    const ports = readFileSync(portsFile, "utf8")
    const original = `  if (productMode() === "mock") return await mockPorts()\n  return (await import("@/lib/ports.live")).livePorts()`
    if (!ports.includes(original)) throw new Error("토스 시험 모드의 공용 결제 차단 위치를 찾을 수 없습니다")
    const safe = `  if (productMode() !== "mock") throw new Error("토스 시험 앱은 mock 모드만 지원합니다")
  const p = await mockPorts()
  const unavailable = async () => ({ ok: false as const, code: "provider_unsupported", formError: "토스 모의 구독 화면을 사용해 주세요.", retryable: false })
  return { ...p, billing: { ...p.billing, plans: async () => ({ ok: true as const, data: [] }), subscription: async () => ({ ok: true as const, data: { planId: null, status: "none" as const } }), checkout: unavailable, changePlan: unavailable, cancel: unavailable, resume: unavailable, updatePaymentMethod: unavailable, applyRetentionOffer: unavailable, acceptPriceChange: unavailable, portal: unavailable, syncCheckout: unavailable } }`
    writeFileSync(portsFile, ports.replace(original, safe))
    // 토스 원장의 해지·파기는 제품의 토스 훅에서 처리한다.
    writeFileSync(join(to, "lib/launch/account-billing.ts"), `import type { DeletionDeps } from "@launch-factory/account-lifecycle"

export async function billingPorts(): Promise<DeletionDeps["billingFor"]> {
  return () => ({
    subscription: async () => ({ ok: true, data: { status: "none", planId: null } }),
    cancel: async () => ({ ok: false, code: "provider_unsupported", formError: "No external subscription on this test project." }),
  })
}
`)
  }
  return state
}
