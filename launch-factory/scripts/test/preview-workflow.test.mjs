// 미리보기 배포 워크플로(.github/workflows/preview.yml)와 도우미(scripts/deploy-preview/ci.mjs)의 정적 시험.
// 실제 배포는 GitHub Actions 에서만 돈다 — 여기서는 「실서비스 쪽 대상이 한 군데도 없다」「권한 최소」「고정 해시」「비밀 이름 5개만(넷은 배포용, 하나는 배포 뒤 경고용)」을 파일로 고정한다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import YAML from "yaml" // 저장소 직접 devDependency. shadcn 하위의 js-yaml 에 기대면 shadcn 판이 바뀔 때 설치에서 사라진다
import { deployHost, inquiryState, observabilityState, patchPlans, reportInquiry, reportObservability, stripSensitive } from "../deploy-preview/ci.mjs"

const root = fileURLToPath(new URL("../../", import.meta.url))
const text = readFileSync(`${root}../.github/workflows/launch-preview.yml`, "utf8")
const wf = YAML.parse(text)
const steps = Object.values(wf.jobs).flatMap((j) => j.steps)
const SECRETS = new Set(["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID", "VERCEL_AUTOMATION_BYPASS_SECRET", "PREVIEW_DATABASE_URL"])
const VARS = new Set(["LF_PREVIEW_ALIAS", "LF_PREVIEW_PLANS_JSON"])

test("YAML 이 읽히고 손으로 누르는 트리거 하나뿐이다", () => {
  assert.deepEqual(Object.keys(wf.on), ["workflow_dispatch"])
  assert.equal(Object.keys(wf.jobs).length, 1)
})

test("실서비스 쪽 문자열이 파일 어디에도 없다(주석 포함)", () => {
  const bad = new RegExp(["prod", "uction|--prod", "\\b"].join(""), "i")
  assert.equal(bad.test(text), false, "preview.yml 에 실서비스 대상 문자열이 있다")
})

test("vercel build·deploy 는 모두 --target=preview, deploy 는 --prebuilt", () => {
  const lines = text.split("\n").filter((l) => /\bvercel (build|deploy)\b/.test(l) && !l.trim().startsWith("#") && !/echo|::error::/.test(l))
  assert.ok(lines.length >= 2, `vercel build/deploy 줄 ${lines.length}개`)
  for (const l of lines) assert.match(l, /--target=preview/, l)
  assert.ok(lines.some((l) => /vercel deploy/.test(l) && /--prebuilt/.test(l)))
})

test("권한은 contents: read 뿐이고 pull_request_target 이 없다", () => {
  assert.deepEqual(wf.permissions, { contents: "read" })
  for (const j of Object.values(wf.jobs)) assert.equal(j.permissions, undefined)
  assert.equal(/pull_request_target/.test(text), false)
})

test("외부 액션은 전체 커밋 해시로 고정되어 있다", () => {
  const uses = steps.map((s) => s.uses).filter(Boolean)
  assert.ok(uses.length >= 2)
  for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, u)
})

test("비밀은 secrets.* 로만, 이름은 5개 안에서만 쓴다(변수는 1개)", () => {
  const used = [...text.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1])
  assert.ok(used.length > 0)
  for (const n of used) assert.ok(SECRETS.has(n), `허용 목록에 없는 비밀 이름: ${n}`)
  for (const n of SECRETS) assert.ok(used.includes(n), `비밀 ${n} 을 쓰는 곳이 없다`)
  const vars = [...text.matchAll(/\$\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}/g)].map((m) => m[1])
  for (const n of vars) assert.ok(VARS.has(n), `허용 목록에 없는 변수 이름: ${n}`)
  assert.equal(/\bgithub\.token\b|secrets\.GITHUB_TOKEN/.test(text), false)
  assert.equal(/\b(vca|vcp|vcl)_[A-Za-z0-9]{10,}/.test(text), false, "토큰처럼 보이는 문자열")
})

test("설치·빌드 단계에는 Vercel 토큰이 없다", () => {
  for (const s of steps) {
    if (/^(Install|Build \(Preview\)|Prepare build inputs)/.test(s.name ?? "")) {
      assert.equal(JSON.stringify(s.env ?? {}).includes("secrets."), false, `${s.name} 에 비밀이 들어간다`)
    }
  }
})

test("별칭은 저장소 변수 LF_PREVIEW_ALIAS 하나(이름이 코드에 박혀 있지 않다)", () => {
  assert.equal(wf.env.PREVIEW_ALIAS, "${{ vars.LF_PREVIEW_ALIAS }}")
})

const TEMPLATE_PLANS = readFileSync(`${root}template/lib/launch/paddle-plans.ts`, "utf8")
const SAMPLE = JSON.stringify([{ id: "pro", name: "Pro", paddle: { priceId: "pri_01abc", trialPriceId: "pri_01def" } }])

test("patchPlans: 실제 템플릿 파일의 빈 PLANS 를 채우고 나머지는 그대로 둔다", () => {
  const out = patchPlans(TEMPLATE_PLANS, SAMPLE)
  assert.match(out, /export const PLANS: PaddlePlan\[\] = \[\s*\{/)
  assert.ok(out.includes("pri_01abc"))
  assert.equal(/PLANS: PaddlePlan\[\] = \[\]/.test(out), false)
  assert.ok(out.includes("export const RETENTION_OFFERS"))
})

test("patchPlans: 값이 없거나 이상하거나 줄 모양이 바뀌면 던진다", () => {
  assert.throws(() => patchPlans(TEMPLATE_PLANS, ""), /empty/)
  assert.throws(() => patchPlans(TEMPLATE_PLANS, "{"), /not valid JSON/)
  assert.throws(() => patchPlans(TEMPLATE_PLANS, "[]"), /non-empty/)
  assert.throws(() => patchPlans(TEMPLATE_PLANS, JSON.stringify([{ id: "x", paddle: { priceId: "price_1" } }])), /priceId/)
  assert.throws(() => patchPlans("export const PLANS = []\n", SAMPLE), /no longer has/)
})

test("stripSensitive: 자리표시·OIDC 줄만 지우고 설정 값은 남긴다", () => {
  const src = ['# Created by Vercel CLI', 'LF_MODE="[SENSITIVE]"', 'NEXT_PUBLIC_APP_URL="https://x.vercel.app"', "DATABASE_URL=[SENSITIVE]", 'VERCEL_OIDC_TOKEN="eyJabc"', 'NX_DAEMON="false"', ""].join("\n")
  const { text: out, removed } = stripSensitive(src)
  assert.deepEqual(removed, ["LF_MODE", "DATABASE_URL", "VERCEL_OIDC_TOKEN"])
  assert.equal(out.includes("SENSITIVE"), false)
  assert.ok(out.includes("NEXT_PUBLIC_APP_URL") && out.includes("NX_DAEMON"))
})

test("deployHost: 주소 한 줄·https 접두·JSON 모두 호스트로, 엉뚱한 출력은 던진다", () => {
  assert.equal(deployHost("https://launch-factory-preview-abc123-example-team-projects.vercel.app\n"), "launch-factory-preview-abc123-example-team-projects.vercel.app")
  assert.equal(deployHost('{"deployment":{"url":"lf-x-abc.vercel.app","readyState":"READY"}}'), "lf-x-abc.vercel.app")
  assert.equal(deployHost("Vercel CLI 61.0.0\nhttps://lf-x-abc.vercel.app"), "lf-x-abc.vercel.app")
  assert.throws(() => deployHost("Error: nope"), /could not read/)
  assert.throws(() => deployHost("https://evil.example.com"), /could not read/)
})

test("LFENV: pull 직후·비밀 자리표시를 지우기 전에 배포 전 환경 이름 점검이 돈다(비밀 없이, 이름만)", () => {
  const names = steps.map((s) => s.name ?? "")
  const at = names.indexOf("Check env names (pre-deploy)")
  assert.ok(at > names.indexOf("Pull Vercel project settings (Preview)"), "pull 뒤")
  assert.ok(at < names.indexOf("Prepare build inputs"), "자리표시 줄을 지우기 전")
  assert.equal(steps[at].run.trim(), "node scripts/env-check.mjs --names-file .vercel/.env.preview.local")
  assert.equal(JSON.stringify(steps[at].env ?? {}).includes("secrets."), false)
})

test("LFENV inquiryState: 쪽 표지를 읽는다 — 표지가 없으면 unknown", () => {
  assert.equal(inquiryState('<div data-inquiry="disabled" class="x">'), "disabled")
  assert.equal(inquiryState('<div data-inquiry="enabled" class="x">'), "enabled")
  assert.equal(inquiryState("<html>no marker</html>"), "unknown")
  assert.equal(inquiryState(undefined), "unknown")
})

test("LFENV reportInquiry: 꺼져 있으면 ::warning:: 만(던지지 않는다), 켜져 있으면 경고 없음, 읽지 못하면 알 수 없음 경고", async () => {
  const page = (status, body) => async () => ({ status, text: async () => body })
  const run = async (fetchFn) => {
    const logs = []
    const state = await reportInquiry("x.vercel.app", "bypass-secret", { fetchFn, log: (l) => logs.push(l) })
    return { state, logs }
  }
  const off = await run(page(200, "<main data-inquiry=\"disabled\">We're not accepting messages right now.</main>"))
  assert.equal(off.state, "disabled")
  assert.equal(off.logs.length, 1)
  assert.match(off.logs[0], /^::warning title=Inquiry is turned off::/)
  assert.ok(!off.logs[0].includes("bypass-secret"), "비밀 값은 출력하지 않는다")

  const on = await run(page(200, '<main data-inquiry="enabled"><form></form></main>'))
  assert.equal(on.state, "enabled")
  assert.ok(!on.logs.some((l) => l.startsWith("::warning")))

  const bad = await run(page(500, "oops"))
  assert.equal(bad.state, "unknown")
  assert.match(bad.logs[0], /^::warning title=Inquiry state unknown::.*\/contact = 500/)
  const boom = await run(async () => {
    throw new TypeError("network")
  })
  assert.equal(boom.state, "unknown")
  assert.match(boom.logs[0], /^::warning title=Inquiry state unknown::/)
})

test("LFOBS observabilityState: <html> 표지를 읽는다 — 표지가 없으면 unknown", () => {
  assert.deepEqual(observabilityState('<html lang="en" data-analytics="disabled" data-error-reporting="enabled">'), { analytics: "disabled", errors: "enabled" })
  assert.deepEqual(observabilityState('<html data-analytics="enabled" data-error-reporting="disabled">'), { analytics: "enabled", errors: "disabled" })
  assert.deepEqual(observabilityState("<html>no marker</html>"), { analytics: "unknown", errors: "unknown" })
  assert.deepEqual(observabilityState(undefined), { analytics: "unknown", errors: "unknown" })
})

test("LFOBS reportObservability: 꺼진 기능마다 ::warning:: 만(던지지 않는다), 둘 다 켜져 있으면 경고 없음, 읽지 못하면 알 수 없음 경고", async () => {
  const page = (status, body) => async () => ({ status, text: async () => body })
  const run = async (fetchFn) => {
    const logs = []
    const state = await reportObservability("x.vercel.app", "bypass-secret", { fetchFn, log: (l) => logs.push(l) })
    return { state, logs }
  }
  const off = await run(page(200, '<html data-analytics="disabled" data-error-reporting="disabled">'))
  assert.deepEqual(off.state, { analytics: "disabled", errors: "disabled" })
  assert.equal(off.logs.filter((l) => l.startsWith("::warning")).length, 2)
  assert.ok(off.logs.some((l) => l.startsWith("::warning title=Analytics is turned off::") && l.includes("POSTHOG_HOST") && l.includes("POSTHOG_PROJECT_KEY")))
  assert.ok(off.logs.some((l) => l.startsWith("::warning title=Error reporting is turned off::") && l.includes("SENTRY_DSN")))
  assert.ok(!off.logs.join(" ").includes("bypass-secret"), "비밀 값은 출력하지 않는다")

  const half = await run(page(200, '<html data-analytics="enabled" data-error-reporting="disabled">'))
  assert.equal(half.logs.filter((l) => l.startsWith("::warning")).length, 1, "꺼진 것만 경고한다")
  assert.match(half.logs.find((l) => l.startsWith("::warning")), /Error reporting is turned off/)

  const on = await run(page(200, '<html data-analytics="enabled" data-error-reporting="enabled">'))
  assert.deepEqual(on.state, { analytics: "enabled", errors: "enabled" })
  assert.ok(!on.logs.some((l) => l.startsWith("::warning")))

  const bad = await run(page(500, "oops"))
  assert.deepEqual(bad.state, { analytics: "unknown", errors: "unknown" })
  assert.equal(bad.logs.filter((l) => l.startsWith("::warning title=") && l.includes("state unknown")).length, 2)
  assert.match(bad.logs[0], / = 500/)
  const boom = await run(async () => {
    throw new TypeError("network")
  })
  assert.deepEqual(boom.state, { analytics: "unknown", errors: "unknown" })
})

test("LFSMOKE: 배포 뒤 마이그레이션 개수 점검은 마지막 단계이고, 경고만 내며(실행을 실패시키지 않는다), 비밀은 이 단계 환경에만 있다", () => {
  const names = steps.map((s) => s.name ?? "")
  const at = names.indexOf("Check migrations applied (warning only)")
  assert.ok(at > names.indexOf("Check alias URL (HTTP 200)"), "별칭 확인 뒤")
  assert.equal(at, names.length - 1, "배포 뒤 마지막 단계")
  const step = steps[at]
  assert.deepEqual(Object.keys(step.env), ["DATABASE_URL"])
  assert.equal(step.env.DATABASE_URL, "${{ secrets.PREVIEW_DATABASE_URL }}")
  assert.ok(step.run.includes("node scripts/db-status.mjs || code=$?"), "종료 코드를 잡아 둔다(오류 종료 코드가 단계를 죽이지 않게)")
  assert.ok(step.run.trim().endsWith("exit 0"), "항상 0 으로 끝난다")
  assert.ok(step.run.includes("::warning title=Migrations out of sync::"))
  assert.ok(step.run.includes('echo "::add-mask::${DATABASE_URL}"'))
  assert.ok(step.run.includes('-z "${DATABASE_URL}"'), "비밀이 없으면 건너뛴다")
  assert.equal(JSON.stringify(step).includes("continue-on-error"), false, "경고 구실은 스크립트가 한다 — continue-on-error 로 실패를 삼키지 않는다")
  for (const other of steps.filter((_, i) => i !== at)) assert.equal(JSON.stringify(other.env ?? {}).includes("PREVIEW_DATABASE_URL"), false, `${other.name} 에 DB 주소 비밀이 들어간다`)
})
