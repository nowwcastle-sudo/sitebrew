// 검사 2 — copy-promises (N04): 화면·메일 글이 한 약속에는 그 약속을 지키는 코드가 있어야 한다.
// promises.json 의 항목마다 ① 약속한 글(copy)이 파일에 있는지 ② 그 약속을 받쳐 주는 탐침(probe)이 맞는지를 본다.
//   probe route         : 파일 기반 경로가 있다(대안 여러 개 중 하나)
//   probe symbol-called : 이름(들)이 화면(또는 in 이 정한 폴더)의 코드에서 쓰인다
//   probe email-sent    : 메일 템플릿 id 가 보내기 호출에 실린다(via 가 있으면 그 감싸는 함수도 정의한 파일 밖에서 불린다)
// 글이 파일에서 사라졌으면(약속을 글에서 뺐으면) 실패가 아니라 경고다 — 고치는 길이 두 가지(기능을 만들거나 글을 지우거나)이기 때문이다.
import { escapeRe, mentions, resolveRoute, routeTable } from "./lib.mjs"

const norm = (s) => s.replace(/\s+/g, " ").toLowerCase()
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/** 약속한 글을 찾는다. 찾으면 보여 줄 짧은 토막, 못 찾으면 null */
export function findCopy(ctx, copy) {
  const raw = ctx.read(copy.file)
  if (raw === null) return { missingFile: true }
  if (copy.key) {
    let node
    try {
      node = JSON.parse(raw)
    } catch {
      return { missingFile: true }
    }
    for (const k of copy.key.split(".")) node = node && typeof node === "object" ? node[k] : undefined
    return typeof node === "string" && node ? { text: node } : null
  }
  const text = ctx.isSource(copy.file) ? ctx.code(copy.file) : raw
  if (copy.regex) {
    const m = new RegExp(copy.regex, "i").exec(text)
    return m ? { text: m[0] } : null
  }
  if (copy.match) {
    const i = norm(text).indexOf(norm(copy.match))
    return i >= 0 ? { text: copy.match } : null
  }
  return null
}

function scopeFiles(ctx, inPrefixes) {
  if (!inPrefixes?.length) return ctx.screens()
  return ctx.files.filter((f) => ctx.isSource(f) && !ctx.isTest(f) && ctx.under(f, inPrefixes))
}

const probes = {
  route(ctx, probe, env) {
    const routes = list(probe.routes ?? probe.route)
    const hit = routes.find((r) => resolveRoute(env.table, r, env.extraRoutes))
    return hit ? { ok: true } : { ok: false, why: `경로가 없다: ${routes.join(" | ")}` }
  },
  "symbol-called"(ctx, probe) {
    const symbols = list(probe.symbols ?? probe.symbol)
    const files = scopeFiles(ctx, probe.in)
    const hit = files.find((f) => symbols.some((s) => mentions(ctx.code(f), s, { member: true })))
    const where = probe.in?.length ? probe.in.join(", ") : "화면"
    return hit ? { ok: true } : { ok: false, why: `${symbols.join(" | ")} 를 쓰는 곳이 ${where} 에 없다` }
  },
  "email-sent"(ctx, probe) {
    const ids = list(probe.templates ?? probe.template)
    const files = ctx.files.filter((f) => ctx.isSource(f) && !ctx.isTest(f) && !f.includes("/web-factory/") && ctx.under(f, ctx.paths.emailScan))
    const sent = (id) => {
      const lit = new RegExp(`template\\s*:\\s*["']${escapeRe(id)}["']`)
      const definers = files.filter((f) => lit.test(ctx.code(f)))
      if (definers.length === 0) return false
      if (!probe.via) return true
      return files.some((f) => !definers.includes(f) && mentions(ctx.code(f), probe.via, { member: true }))
    }
    return ids.some(sent) ? { ok: true } : { ok: false, why: `메일 ${ids.join(" | ")}${probe.via ? ` (${probe.via})` : ""} 를 보내는 호출이 없다` }
  },
}

export function checkPromises(ctx, config) {
  const failures = []
  const warnings = []
  const passed = []
  const env = { table: routeTable(ctx), extraRoutes: config.extraRoutes ?? [] }
  for (const p of config.promises ?? []) {
    const found = findCopy(ctx, p.copy)
    if (found?.missingFile) {
      warnings.push(`${p.id}: 글 파일을 못 읽었다(${p.copy.file}) — promises.json 을 고친다`)
      continue
    }
    if (!found) {
      warnings.push(`${p.id}: 글을 파일에서 못 찾았다 — 약속을 글에서 뺐다면 promises.json 에서도 뺀다`)
      continue
    }
    const list_ = p.probes ?? [p.probe]
    const problems = []
    for (const probe of list_) {
      const run = probes[probe?.type]
      if (!run) throw new Error(`promises.json ${p.id}: 알 수 없는 probe.type ${JSON.stringify(probe?.type)}`)
      const r = run(ctx, probe, env)
      if (!r.ok) problems.push(r.why)
    }
    if (problems.length === 0) passed.push(p.id)
    else failures.push({ check: "copy-promises", target: p.id, item: p.item, detail: `「${found.text.slice(0, 70)}」 — ${problems.join("; ")}` })
  }
  return { failures, warnings, passed }
}
