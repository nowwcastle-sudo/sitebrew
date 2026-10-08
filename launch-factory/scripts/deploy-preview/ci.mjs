// GitHub Actions 미리보기 배포(.github/workflows/preview.yml)의 작은 도우미. 비밀 값은 읽기만 하고 어디에도 출력하지 않는다.
// 사용: node scripts/deploy-preview/ci.mjs <patch-plans|strip-sensitive|check-root|deploy-url|verify> [인자]
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const PLANS_LINE = /^export const PLANS: PaddlePlan\[\] = \[\]\s*$/m

/** 템플릿 요금제 파일의 빈 PLANS 를 샌드박스 요금제(JSON 배열)로 채운다. 줄 모양이 바뀌었거나 값이 이상하면 던진다 — 조용히 빈 요금제로 배포하지 않는다. */
export function patchPlans(source, json) {
  if (!json?.trim()) throw new Error("LF_PREVIEW_PLANS_JSON is empty (GitHub 저장소 변수 — docs/qa/gha-preview.md)")
  let plans
  try { plans = JSON.parse(json) } catch { throw new Error("LF_PREVIEW_PLANS_JSON is not valid JSON") }
  if (!Array.isArray(plans) || plans.length === 0) throw new Error("LF_PREVIEW_PLANS_JSON must be a non-empty array")
  for (const p of plans) {
    if (typeof p?.id !== "string" || !/^pri_[0-9a-z]+$/.test(p?.paddle?.priceId ?? "")) throw new Error("each plan needs id and paddle.priceId (pri_…)")
  }
  if (!PLANS_LINE.test(source)) throw new Error("template paddle-plans.ts no longer has the empty `export const PLANS: PaddlePlan[] = []` line — update scripts/deploy-preview/ci.mjs")
  return source.replace(PLANS_LINE, () => `export const PLANS: PaddlePlan[] = ${JSON.stringify(plans, null, 2)}`)
}

/** vercel pull 이 비밀 변수 자리에 쓴 `[SENSITIVE]` 줄(값이 아니라 자리표시 — 빌드에 들어가면 안 된다)과 OIDC 토큰 줄을 지운다. 지운 이름 목록을 돌려준다. */
export function stripSensitive(text) {
  const removed = []
  const kept = text.split("\n").filter((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=("?)\[SENSITIVE\]\2\s*$/.exec(line) ?? /^(VERCEL_OIDC_TOKEN)=/.exec(line)
    if (m) removed.push(m[1])
    return !m
  })
  return { text: kept.join("\n"), removed }
}

/** vercel deploy 표준 출력(주소 한 줄 또는 JSON)에서 배포 호스트를 꺼낸다. */
export function deployHost(stdout) {
  const raw = stdout.trim()
  let candidate = raw.split(/\r?\n/).filter(Boolean).at(-1) ?? ""
  try {
    const j = JSON.parse(raw)
    candidate = j?.deployment?.url ?? j?.url ?? candidate
  } catch { /* 주소 한 줄 */ }
  const host = candidate.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim()
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(host)) throw new Error("could not read a *.vercel.app deployment host from `vercel deploy` output")
  return host.toLowerCase()
}

const PATHS = ["/", "/pricing", "/sign-in", "/sign-up", "/privacy", "/terms"]

/**
 * /contact 쪽 HTML 이 말하는 문의 창구 상태. 쪽이 data-inquiry="enabled|disabled" 표지를 단다(template/app/(product)/contact/page.tsx).
 * 운영자 메일(INQUIRY_OWNER_EMAIL)이 없으면 사이트는 켜지고 문의만 꺼진다 — 이 점검은 그것을 **경고**로만 알린다(실패 아님).
 */
export function inquiryState(html) {
  const m = /data-inquiry="(enabled|disabled)"/.exec(html ?? "")
  return m ? m[1] : "unknown"
}

/** 배포된 /contact 를 읽어 문의 창구가 꺼져 있으면 ::warning:: 를 낸다. 200 검사 결과에는 영향을 주지 않는다. 상태 문자열을 돌려준다 */
export async function reportInquiry(host, secret, { fetchFn = fetch, log = console.log } = {}) {
  let state = "unknown"
  let detail = ""
  try {
    const r = await fetchFn(`https://${host}/contact`, { headers: { "x-vercel-protection-bypass": secret }, redirect: "manual", signal: AbortSignal.timeout(30_000) })
    if (r.status === 200) state = inquiryState(await r.text())
    else detail = ` (/contact = ${r.status})`
  } catch (e) {
    detail = ` (/contact error ${e.name})`
  }
  if (state === "disabled") log(`::warning title=Inquiry is turned off::${host} 의 문의 창구가 꺼져 있다 — Vercel Preview 환경에 INQUIRY_OWNER_EMAIL 이 없거나 비었다. 사이트는 정상이고 문의 폼만 안내로 바뀐다(docs/qa/lfenv.md)`)
  else if (state === "enabled") log("inquiry: enabled (문의 창구 켜짐)")
  else log(`::warning title=Inquiry state unknown::${host}/contact 에서 문의 창구 표지(data-inquiry)를 읽지 못했다${detail}`)
  return state
}

/**
 * 첫 쪽(/) HTML 이 말하는 분석·오류 수집 상태. 루트 레이아웃이 <html data-analytics="enabled|disabled" data-error-reporting="enabled|disabled"> 표지를 단다(template/app/layout.tsx).
 * POSTHOG_HOST·POSTHOG_PROJECT_KEY·SENTRY_DSN 이 없으면 사이트는 켜지고 그 기능만 꺼진다(LFOBS·LFOBS2) — 이 점검은 그것을 **경고**로만 알린다(실패 아님). 표지가 없으면 "unknown".
 */
export function observabilityState(html) {
  const pick = (name) => new RegExp(`${name}="(enabled|disabled)"`).exec(html ?? "")?.[1] ?? "unknown"
  return { analytics: pick("data-analytics"), errors: pick("data-error-reporting") }
}

/** 배포된 / 를 읽어 분석·오류 수집이 꺼져 있으면 ::warning:: 를 낸다. 200 검사 결과에는 영향을 주지 않는다. 상태 객체를 돌려준다 */
export async function reportObservability(host, secret, { fetchFn = fetch, log = console.log } = {}) {
  let state = { analytics: "unknown", errors: "unknown" }
  let detail = ""
  try {
    const r = await fetchFn(`https://${host}/`, { headers: { "x-vercel-protection-bypass": secret }, redirect: "manual", signal: AbortSignal.timeout(30_000) })
    if (r.status === 200) state = observabilityState(await r.text())
    else detail = ` (/ = ${r.status})`
  } catch (e) {
    detail = ` (/ error ${e.name})`
  }
  if (state.analytics === "disabled") log(`::warning title=Analytics is turned off::${host} 의 분석(PostHog)이 꺼져 있다 — Vercel Preview 환경에 POSTHOG_HOST 나 POSTHOG_PROJECT_KEY 가 없거나 비었다(둘 다 있어야 켜진다). 사이트는 정상이고 분석 스크립트·동의 띠·쿠키 설정 링크만 없다(docs/qa/lfobs.md)`)
  else if (state.analytics === "enabled") log("analytics: enabled (분석 켜짐)")
  else log(`::warning title=Analytics state unknown::${host}/ 에서 분석 표지(data-analytics)를 읽지 못했다${detail}`)
  if (state.errors === "disabled") log(`::warning title=Error reporting is turned off::${host} 의 오류 수집(Sentry)이 꺼져 있다 — Vercel Preview 환경에 SENTRY_DSN 이 없거나 비었다(또는 mock 이다). 사이트는 정상이고 서버·브라우저 오류가 Sentry 로 가지 않는다(docs/qa/lfobs.md)`)
  else if (state.errors === "enabled") log("error reporting: enabled (오류 수집 켜짐)")
  else log(`::warning title=Error reporting state unknown::${host}/ 에서 오류 수집 표지(data-error-reporting)를 읽지 못했다${detail}`)
  return state
}

async function status(url, headers = {}) {
  const r = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) })
  return r.status
}

/** 배포 주소를 우회 비밀 머리(값은 출력하지 않는다)로 돌려 모두 200 이어야 통과. 방금 올린 배포라 몇 번 다시 시도한다. */
export async function verify(host, secret, { tries = 5, waitMs = 10_000 } = {}) {
  if (!secret) throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is not set")
  const headers = { "x-vercel-protection-bypass": secret }
  let last = []
  for (let i = 1; i <= tries; i++) {
    last = []
    for (const p of PATHS) {
      let code
      try { code = await status(`https://${host}${p}`, headers) } catch (e) { code = `error(${e.name})` }
      last.push([p, code])
    }
    console.log(`attempt ${i}/${tries}: ${last.map(([p, c]) => `${p}=${c}`).join(" ")}`)
    if (last.every(([, c]) => c === 200)) break
    if (i < tries) await new Promise((r) => setTimeout(r, waitMs))
  }
  let guarded = "unknown"
  try { guarded = await status(`https://${host}/`) } catch { /* 보호 확인은 참고용 */ }
  console.log(`without bypass header: / = ${guarded} (302·401 이 정상 — 200 이면 보호가 꺼진 것)`)
  if (guarded === 200) console.log(`::warning title=Preview is publicly reachable::${host} answered 200 without the bypass header`)
  const allOk = last.every(([, c]) => c === 200)
  if (allOk) {
    // 경고만 — 반환값(통과 여부)은 위 200 검사가 정한다
    await reportInquiry(host, secret)
    await reportObservability(host, secret)
  }
  return allOk
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, a, b] = process.argv.slice(2)
  try {
    if (cmd === "patch-plans") {
      const file = a ?? "template/lib/launch/paddle-plans.ts"
      writeFileSync(file, patchPlans(readFileSync(file, "utf8"), process.env.LF_PREVIEW_PLANS_JSON))
      console.log(`patched ${file}: preview plans filled`)
    } else if (cmd === "strip-sensitive") {
      const { text, removed } = stripSensitive(readFileSync(a, "utf8"))
      writeFileSync(a, text)
      console.log(`removed ${removed.length} placeholder lines from ${a}: ${removed.join(", ")}`)
    } else if (cmd === "check-root") {
      const s = JSON.parse(readFileSync(a ?? ".vercel/project.json", "utf8")).settings ?? {}
      const want = b ?? "template"
      if (s.rootDirectory === undefined) console.log(`::warning title=rootDirectory not in project.json::cannot confirm the project Root Directory is "${want}"`)
      else if (s.rootDirectory !== want) throw new Error(`Vercel project Root Directory is "${s.rootDirectory}", expected "${want}" — change it first (docs/qa/gha-preview.md, 컨트롤러 순서 1)`)
      else console.log(`project Root Directory = ${s.rootDirectory} (ok)`)
    } else if (cmd === "deploy-url") {
      console.log(deployHost(readFileSync(a, "utf8")))
    } else if (cmd === "verify") {
      if (!(await verify(a, process.env.VERCEL_AUTOMATION_BYPASS_SECRET))) throw new Error(`${a}: not every path answered 200`)
    } else {
      throw new Error("usage: ci.mjs <patch-plans [file]|strip-sensitive <file>|check-root [project.json] [dir]|deploy-url <stdout-file>|verify <host>>")
    }
  } catch (e) {
    console.error(`::error::${e.message}`)
    process.exit(1)
  }
}
