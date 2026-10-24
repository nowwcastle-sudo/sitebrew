// 빌드 스모크의 공용 부품(LFSMOKE). 쪽 목록은 앱 경로 template/app/**/page.tsx 에서 읽는다 — 새 쪽을 만들면 저절로 들어간다(scripts/template-screens 의 쪽 목록과 같은 규칙).
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"

export const SCENE_COOKIE = "wf_session"
export const SCENE_OUT = "signed-out"
export const SCENE_IN = "signed-in"
export const SCENE_PAST_DUE = "signed-in:sub=past_due"

/** 결제 화면 — 구독 상태(past_due)에서도 한 번 더 본다. 새 결제 쪽이 이름 규칙을 따르면 저절로 걸린다 */
export const BILLING_PATH = /(^|\/)(billing|upgrade|pricing|cancel|price-change)(\/|$)/

/** app/ 아래 page.tsx → 주소. 라우트 그룹 (x)·병렬 슬롯 @x 는 주소에 없고, [동적] 조각이 있는 쪽은 주소를 못 만들어 dynamic 으로 따로 센다 */
export function routesFromApp(appDir: string): { routes: string[]; dynamic: string[] } {
  const found: string[][] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/^page\.(tsx|jsx|ts|js|mdx)$/.test(name)) found.push(relative(appDir, dir).split(sep).filter(Boolean))
    }
  }
  walk(appDir)
  const routes: string[] = []
  const dynamic: string[] = []
  for (const segs of found) {
    const parts = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"))
    const path = "/" + parts.join("/")
    if (parts.some((s) => /^\[.*\]$/.test(s))) dynamic.push(path)
    else routes.push(path)
  }
  return { routes: [...new Set(routes)].sort(), dynamic: [...new Set(dynamic)].sort() }
}

export const appRoutes = () => routesFromApp(join(process.cwd(), "app"))

/** 쪽 하나가 돌 장면: 로그아웃·로그인, 결제 쪽은 연체(past_due)까지 */
export const scenesFor = (path: string): string[] => [SCENE_OUT, SCENE_IN, ...(BILLING_PATH.test(path) ? [SCENE_PAST_DUE] : [])]

/** 장면 쿠키(값은 encodeURIComponent) */
export const sceneCookie = (scene: string, url: string) => ({ name: SCENE_COOKIE, value: encodeURIComponent(scene), url })
export const sceneHeader = (scene: string) => ({ cookie: `${SCENE_COOKIE}=${encodeURIComponent(scene)}` })

/** 응답 HTML 의 <html data-wf-session="…"> 값(없으면 null) */
export function sceneMarker(html: string): string | null {
  const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? ""
  return /\sdata-wf-session="([^"]*)"/.exec(tag)?.[1] ?? null
}

/** 로그인 안내(SignInRequired)가 그려졌는가 — 제목 id */
export const hasSignInPrompt = (html: string) => /id="sign-in-required-title"/.test(html)

/** 오류 경계가 그린 화면의 표지(app/error.tsx · global-error.tsx → data-error-code). not_found 는 없는 주소 화면 */
export const ERROR_BOUNDARY = '[data-error-code="server_error"], [data-error-code="client_error"], [data-error-code="not_found"]'

/** axe 결과 한 셀을 jsonl 에 남긴다(오케스트레이터가 기준선과 맞춘다). 재시도로 같은 셀이 두 번 적히면 마지막 줄이 이긴다 */
export function recordAxe(cell: string, violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  const file = process.env.SMOKE_AXE_OUT
  if (!file) return
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify({ cell, violations: violations.map((v) => ({ id: v.id, impact: v.impact ?? null, nodes: v.nodes.length })) })}\n`)
}

// ── 한 바퀴 시험(LOOP) — 데이터는 e2e/loop-steps.json, 동작은 loop.mock.spec.ts 의 RUNNERS ─────────────────────────────
// 아래는 브라우저 없이 시험할 수 있는 순수 부분이다(launch-factory scripts/test/smoke.test.mjs 가 부른다).
export type LoopSteps = {
  steps: Record<string, string[]>
  requires: Record<string, string[]>
  mail: Record<string, Record<string, number>>
  selectors: Record<string, Record<string, string>>
  /** 화면 글 기대값(선택자가 아니라 읽는 글). 결제 관리 블록은 web-factory 에서 받아 잠긴 파일이라 상태 표지(data-*)를 더할 수 없어 글로 본다 — scripts/test/smoke.test.mjs 가 content/copy.en.ts 와 맞춰 본다 */
  expect: Record<string, string | string[]>
}
export type OutboxLine = { id: string; template: string; to: string; subject: string; at: string }
export type LoopPlan = {
  /** 돌릴 기능(loop-steps.json 의 steps 순서 — LOOP_FEATURES 에 적은 순서가 아니다) */
  features: string[]
  /** 실행 순서대로 펼친 단계 */
  steps: { feature: string; id: string }[]
  /** 한 바퀴가 끝났을 때 메일 기록의 template 별 개수 */
  mail: Record<string, number>
  mailTotal: number
}

export const LOOP_STEPS_FILE = () => join(process.cwd(), "e2e", "loop-steps.json")

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** loop-steps.json 을 읽고 모양을 확인한다. 모양이 틀리면 어디가 틀렸는지 말하며 던진다 */
export function loadLoopSteps(file = LOOP_STEPS_FILE()): LoopSteps {
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (!isRecord(raw) || !isRecord(raw.steps) || !isRecord(raw.mail) || !isRecord(raw.selectors)) throw new Error(`${file}: steps·mail·selectors 가 있어야 한다`)
  const features = Object.keys(raw.steps)
  if (features.length === 0) throw new Error(`${file}: steps 가 비었다`)
  for (const f of features) {
    const ids = raw.steps[f]
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((s) => typeof s === "string" && s)) throw new Error(`${file}: steps.${f} 는 단계 id 문자열의 비지 않은 목록이어야 한다`)
    const m = raw.mail[f]
    if (!isRecord(m) || !Object.values(m).every((n) => Number.isInteger(n) && (n as number) > 0)) throw new Error(`${file}: mail.${f} 는 template → 양의 정수여야 한다`)
  }
  for (const f of Object.keys(raw.mail)) if (!features.includes(f)) throw new Error(`${file}: mail.${f} 인데 steps.${f} 가 없다`)
  const requires: Record<string, string[]> = {}
  for (const [f, need] of Object.entries(isRecord(raw.requires) ? raw.requires : {})) {
    if (!features.includes(f) || !Array.isArray(need) || !need.every((n) => typeof n === "string" && features.includes(n))) throw new Error(`${file}: requires.${f} 가 모르는 기능을 가리킨다`)
    requires[f] = need as string[]
  }
  const selectors: Record<string, Record<string, string>> = {}
  for (const [group, entries] of Object.entries(raw.selectors)) {
    if (!isRecord(entries) || !Object.values(entries).every((s) => typeof s === "string" && s)) throw new Error(`${file}: selectors.${group} 는 이름 → 비지 않은 선택자여야 한다`)
    selectors[group] = entries as Record<string, string>
  }
  const expectText: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(isRecord(raw.expect) ? raw.expect : {})) {
    const ok = typeof v === "string" ? v !== "" : Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s)
    if (!ok) throw new Error(`${file}: expect.${k} 는 비지 않은 글 또는 글 목록이어야 한다`)
    expectText[k] = v as string | string[]
  }
  return { steps: raw.steps as Record<string, string[]>, requires, mail: raw.mail as Record<string, Record<string, number>>, selectors, expect: expectText }
}

/** json 에 있는 단계 id 가 모두 동작(RUNNERS)을 갖는가 — 모르는 id 는 던진다(오타가 「건너뛴 통과」가 되지 않게) */
export function assertKnownSteps(spec: LoopSteps, known: readonly string[]): void {
  for (const [feature, ids] of Object.entries(spec.steps)) for (const id of ids) if (!known.includes(id)) throw new Error(`loop-steps.json 의 ${feature} 단계 「${id}」 를 spec 이 모른다 (아는 단계: ${known.join(", ")})`)
}

/** LOOP_FEATURES(쉼표) → 기능 목록. 안 주면 json 의 모든 기능. 모르는 이름·빠진 선행 기능은 던진다 */
export function planLoop(raw: string | string[] | undefined, spec: LoopSteps): LoopPlan {
  const all = Object.keys(spec.steps)
  const asked = (Array.isArray(raw) ? raw : (raw ?? "").split(",")).map((s) => s.trim()).filter(Boolean)
  const want = asked.length ? asked : all
  for (const f of want) if (!all.includes(f)) throw new Error(`모르는 기능: ${f} (아는 기능: ${all.join(", ")})`)
  const features = all.filter((f) => want.includes(f))
  for (const f of features) for (const need of spec.requires[f] ?? []) if (!features.includes(need)) throw new Error(`${f} 는 ${need} 가 함께 켜져 있어야 한다`)
  const mail: Record<string, number> = {}
  for (const f of features) for (const [template, n] of Object.entries(spec.mail[f] ?? {})) mail[template] = (mail[template] ?? 0) + n
  return { features, steps: features.flatMap((feature) => spec.steps[feature]!.map((id) => ({ feature, id }))), mail, mailTotal: Object.values(mail).reduce((a, b) => a + b, 0) }
}

/** feature 까지(그 기능 포함) 쌓여 있어야 하는 메일 개수 */
export function mailThrough(plan: LoopPlan, spec: LoopSteps, feature: string): Record<string, number> {
  const at = plan.features.indexOf(feature)
  if (at < 0) throw new Error(`계획에 없는 기능: ${feature}`)
  const out: Record<string, number> = {}
  for (const f of plan.features.slice(0, at + 1)) for (const [template, n] of Object.entries(spec.mail[f] ?? {})) out[template] = (out[template] ?? 0) + n
  return out
}

/** 메일 기록(JSONL) 읽기. 파일이 없으면 0줄. 모양이 틀린 줄은 던진다 — 세는 값을 믿으려면 줄이 온전해야 한다 */
export function readOutbox(file: string | undefined): OutboxLine[] {
  if (!file) throw new Error("SMOKE_OUTBOX 가 없다 — 메일 기록 파일 경로는 오케스트레이터(smoke.mjs)가 준다")
  if (!existsSync(file)) return []
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      const o: unknown = JSON.parse(l)
      if (!isRecord(o) || !["id", "template", "to", "subject", "at"].every((k) => typeof o[k] === "string")) throw new Error(`${file}:${i + 1} 메일 기록 줄의 모양이 틀리다`)
      return o as OutboxLine
    })
}

export function countByTemplate(lines: readonly OutboxLine[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of lines) out[l.template] = (out[l.template] ?? 0) + 1
  return out
}
