// 제품 화면 관문 러너의 순수 부분(LFRUNNER · 감사 N02) — 쪽 목록, 장면 행렬, 관문 종료 코드 읽기, 결과 모으기. Chrome·서버 없이 시험한다(scripts/test/template-screens.test.mjs).
// 관문은 web-factory 의 CDP 도구다. 종료 코드는 그 docs/agents/agent-guide.md 「관문 도구의 종료 코드」 표대로 도구별로 읽는다 — 코드를 그대로 합치지 않는다:
//   a11y-gate    0 통과 · 1 + 결과 파일 = 실패 · 1 + 파일 없음 = 도구 실패 · 2 인자 오류
//   ux-gate      0 통과 · 3 = 판정 실패(ux_gate.json) · 1 = 도구 실패 · 2 인자 오류
//   lang-mix     0 통과 · 1 + 결과 파일 = 혼입 있음 또는 잰 글 0(na) · 1 + 파일 없음 = 도구 실패 · 2 인자 오류
//   signed-out   0 통과 · 1 + 결과 파일 = 쪽 실패 · 1 + 파일 없음 = 도구 실패 · 2 인자 오류
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

export const WIDTHS = [1440, 375]
export const SCENE_OUT = "signed-out"
export const SCENE_IN = "signed-in"
export const SCENE_PAST_DUE = "signed-in:sub=past_due"
/** 이메일을 확인하지 않은 로그인(mock 장면 signed-in:unverified) — 위 배너·결제 직전 주소·확인 쪽이 이 사용자에게만 보인다(P1AB) */
export const SCENE_UNVERIFIED = "signed-in:unverified"
export const GATES = ["a11y", "ux", "lang", "signed-out"]

// ── 쪽 목록 ───────────────────────────────────────────────────────────────────────────

/** app/ 아래 page.tsx 를 찾아 주소로 바꾼다. 라우트 그룹 (x) 은 주소에 없고, [동적] 조각이 있는 쪽은 주소를 만들 수 없어 dynamic 으로 따로 센다 */
export function routesFromApp(appDir) {
  const found = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/^page\.(tsx|jsx|ts|js|mdx)$/.test(name)) found.push(relative(appDir, dir).split(sep).filter(Boolean))
    }
  }
  walk(appDir)
  const routes = []
  const dynamic = []
  for (const segs of found) {
    const parts = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"))
    const path = "/" + parts.join("/")
    if (parts.some((s) => /^\[.*\]$/.test(s))) dynamic.push(path)
    else routes.push(path)
  }
  return { routes: [...new Set(routes)].sort(), dynamic: [...new Set(dynamic)].sort() }
}

/** 결제 화면 — 구독 상태(past_due)에서도 한 번 더 잰다. 새 결제 쪽이 이름 규칙을 따르면 저절로 걸린다 */
export const BILLING_PATH = /(^|\/)(billing|upgrade|pricing|cancel|price-change)(\/|$)/

/** 확인 안 된 사용자에게 달리 보이는 쪽: 위 배너가 붙는 시작 쪽(/)·결제 직전 주소(/upgrade)·확인 쪽(/verify-email). 다른 쪽도 배너를 받지만 같은 조각이라 이 셋으로 갈음한다 */
export const UNVERIFIED_PATH = /^\/(verify-email|upgrade)?$/

/**
 * 쪽 × 장면 행렬. protectedPaths 는 로그아웃으로 열면 로그인 쪽으로 보내는 쪽(러너가 서버에 물어 정한다 — 목록을 손으로 적지 않는다).
 * @returns {{ path:string, scenes:string[], billing:boolean, protected:boolean }[]}
 */
export function buildPlan(routes, { protectedPaths = [], billing = BILLING_PATH, unverified = UNVERIFIED_PATH } = {}) {
  const prot = new Set(protectedPaths)
  return routes.map((path) => {
    const isBilling = billing.test(path)
    return { path, billing: isBilling, protected: prot.has(path), scenes: [SCENE_OUT, SCENE_IN, ...(isBilling ? [SCENE_PAST_DUE] : []), ...(unverified.test(path) ? [SCENE_UNVERIFIED] : [])] }
  })
}

/** 서버 첫 응답이 로그인 쪽으로 보내는가(`meta refresh` 이동 표지 또는 HTTP 리다이렉트 Location) */
export function redirectsToSignIn(status, location, html) {
  if (status >= 300 && status < 400 && /\/sign-in/.test(location ?? "")) return true
  return /<meta[^>]+http-equiv="refresh"[^>]+url=\/sign-in/i.test(html) || (html.includes("NEXT_REDIRECT") && /url=\/sign-in/.test(html))
}

/** 계정·결제 쪽은 서버가 아니라 클라이언트가 로그인 여부를 묻는 것도 있어(/account) 이름으로도 짚는다 — 힌트일 뿐, 판정은 qa:signed-out 이 한다 */
export const PROTECTED_HINT = /^\/(account|upgrade|billing)(\/|$)/

/** 로그아웃으로 열면 「로그인이 필요해요」 안내가 서버 응답에 그려지는가(SignInRequired 의 제목 id) */
export const signInPrompt = (html) => /id="sign-in-required-title"/.test(html)

/** 보호된 쪽인가: 로그인 쪽으로 보내거나 안내를 그리거나 이름이 힌트에 맞는다 */
export function isProtected(path, status, location, html) {
  return redirectsToSignIn(status, location, html) || signInPrompt(html) || PROTECTED_HINT.test(path)
}

// ── 관문 종료 코드 읽기 ────────────────────────────────────────────────────────────────

/** @returns {"pass"|"fail"|"tool"|"args"} 종료 코드와 결과 파일 유무로 판정 */
export function classifyExit(gate, code, resultExists) {
  if (code === null || code === undefined) return "tool" // 기한 초과로 죽였거나 신호로 끝남
  if (code === 0) return "pass"
  if (code === 2) return "args"
  if (gate === "ux") return code === 3 ? "fail" : "tool"
  if (code === 1) return resultExists ? "fail" : "tool"
  return "tool"
}

const clip = (s, n = 300) => (s.length > n ? s.slice(0, n - 1) + "…" : s)
const widthOf = (m) => /(?:^|[^0-9])(1440|375)(?:[^0-9]|$)/.exec(m)?.[1] ?? null
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null)

/** 결과 JSON → 발견 목록 [{ gate, message }]. 관문마다 JSON 모양이 달라 여기서 한 모양으로 맞춘다 */
export function extractFindings(gate, json, { url } = {}) {
  if (!json) return []
  if (gate === "a11y") return (json.failures ?? []).map((m) => ({ gate, width: widthOf(String(m)), message: clip(String(m)) }))
  if (gate === "ux") return (json.fail ?? []).map((m) => ({ gate, width: widthOf(String(m)), message: clip(String(m)) }))
  if (gate === "lang") {
    const page = (json.pages ?? []).find((p) => !url || p.url === url) ?? json.pages?.[0]
    if (!page) return []
    const out = (page.findings ?? []).map((f) => ({ gate, message: clip(`${f.rule} [${f.src}] ${JSON.stringify(f.match)} — ${JSON.stringify(f.text)}${f.count > 1 ? ` ×${f.count}` : ""}`) }))
    if (page.status === "na") out.push({ gate, message: "na: 잰 글이 0개 — 통과가 아니다" })
    return out
  }
  if (gate === "signed-out") return (json.pages ?? []).filter((p) => !p.pass).flatMap((p) => p.fails.map((m) => ({ gate, message: clip(`${p.path}: ${m}`) })))
  return []
}

/** 결과 파일 한 개를 읽는 관문별 이름 */
export const RESULT_FILE = { a11y: "a11y-gate.json", ux: "ux_gate.json", lang: "lang-mix.json", "signed-out": "signed-out-access.json" }

export function readResult(gate, dir) {
  const file = join(dir, RESULT_FILE[gate])
  try {
    return readJson(file)
  } catch {
    return null
  }
}

// ── 모으기 ───────────────────────────────────────────────────────────────────────────

/**
 * 셀 하나 = 관문 실행 한 번의 한 쪽·장면. status: pass | fail | tool | args.
 * 종료 1 은 fail·tool·args 중 하나라도 있을 때 — 도구 실패와 인자 오류는 「통과」가 아니다.
 */
export function aggregate(cells) {
  const by = (s) => cells.filter((c) => c.status === s).length
  const counts = { cells: cells.length, pass: by("pass"), fail: by("fail"), tool: by("tool"), args: by("args") }
  const findings = cells.flatMap((c) => c.findings.map((f) => ({ page: c.page, scene: c.scene, width: f.width ?? c.width ?? "both", gate: f.gate, message: f.message })))
  return { counts, ok: counts.cells > 0 && counts.fail + counts.tool + counts.args === 0, findings }
}

/** 같은 원인이 여러 쪽에 걸쳐 나오므로(헤더 고정·쿠키 띠 등) 관문+메시지로 묶어 영향 쪽·장면·너비를 모은다. 많이 걸린 것부터 */
export function groupFindings(findings) {
  const map = new Map()
  for (const f of findings) {
    const key = `${f.gate}\u0000${f.message}`
    const g = map.get(key) ?? { gate: f.gate, message: f.message, pages: new Set(), scenes: new Set(), widths: new Set(), count: 0 }
    g.pages.add(f.page)
    g.scenes.add(f.scene)
    g.widths.add(String(f.width))
    g.count++
    map.set(key, g)
  }
  return [...map.values()]
    .map((g) => ({ gate: g.gate, message: g.message, count: g.count, pages: [...g.pages].sort(), scenes: [...g.scenes].sort(), widths: [...g.widths].sort() }))
    .sort((a, b) => b.pages.length - a.pages.length || b.count - a.count || a.message.localeCompare(b.message))
}

const GATE_LABEL ={ a11y: "a11y", ux: "ux", lang: "lang", "signed-out": "signed-out" }

/** 쪽 × 장면 × 관문 표(마크다운). 셀: PASS / FAIL(n) / TOOL / — */
export function renderTable(cells) {
  const rows = new Map()
  for (const c of cells) {
    const key = `${c.page}\u0000${c.scene}`
    if (!rows.has(key)) rows.set(key, { page: c.page, scene: c.scene, g: {} })
    const slot = rows.get(key)
    const w = c.width ? `@${c.width}` : ""
    const label = c.status === "pass" ? "PASS" : c.status === "fail" ? `FAIL(${c.findings.length})` : c.status === "tool" ? "TOOL" : "ARGS"
    slot.g[c.gate] = c.width ? [...(slot.g[c.gate] ? [slot.g[c.gate]] : []), `${label}${w}`].join(" ") : label
  }
  const head = `| page | scene | ${GATES.map((g) => GATE_LABEL[g]).join(" | ")} |\n|---|---|${GATES.map(() => "---").join("|")}|`
  const body = [...rows.values()].map((r) => `| ${r.page} | ${r.scene} | ${GATES.map((g) => r.g[g] ?? "—").join(" | ")} |`)
  return [head, ...body].join("\n")
}
