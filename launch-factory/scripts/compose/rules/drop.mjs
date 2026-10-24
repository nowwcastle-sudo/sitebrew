// drop — 고르지 않은 기능의 쪽·API·cron 을 출력에서 지우고, 남은 것을 lib/launch/enabled.json 에 적는다(템플릿 화면이 읽는다).
//   켜진 부품 = 고른 기능의 parts ∪ closure. 소유자(owners)가 하나도 켜지지 않은 표의 쪽·API 파일만 지운다(폴더째가 아니라 파일 하나씩 —
//   `account` 와 `account/billing` 은 따로다). vercel.json 의 cron 은 남은 API 가 아닌 경로의 줄을 뺀다.
//   infra(contract·env)는 표의 쪽·API 를 소유하지 않으므로(생성기가 소유자를 부품 목록으로 검사한다) 켜짐 판정에 들지 않는다.
//   「지운 쪽」 = 소유자가 꺼졌고 출력에 그 주소가 남지 않은 것(시안이 같은 주소를 직접 가져왔으면 지운 쪽이 아니다).
//   시안 content/site.json 에서 지운 쪽으로 가는 링크는 데이터로 고친다(rules.json steps.drop): 배열 안 링크(메뉴·바닥글)는 빼고, 하나뿐인 버튼은
//   선택 버튼(optionalKeys)이면 빼고 아니면 주소만 바꾼다 — fallbacks 에서 남은 첫 쪽, 없으면 rewriteTo(필수 칸이 비어 블록이 깨지지 않게, 경고를 남긴다).
//   사이트맵이 읽는 site.json pages 에서는 지운 쪽을 빼고, 템플릿의 공개 쪽(lib/public-paths.json)이 남았는데 pages 에 없으면 더한다.
//   출력의 e2e/loop-steps.json 은 고른 기능의 단계만 남긴다(출력 CI 가 지워진 쪽을 방문하지 않게).
//   마지막으로 시안에서 가져온 글자 파일에 지운 쪽 주소가 따옴표 글자로 남았는지 보고 있으면 던진다.
import { existsSync, readdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { isTextFile, matchesAny, readJson, urlOf, walk, withSecrets, writeJson } from "../lib.mjs"

export const id = "drop"

/** 고른 기능(features.outcomes)이 켜는 부품 — 고른 기능의 parts 와 closure 의 합집합 */
export function turnedOn(table, features) {
  const chosen = new Set(features.outcomes)
  return new Set(table.outcomes.filter((o) => chosen.has(o.id)).flatMap((o) => [...o.parts, ...o.closure]))
}

/** 소유자가 하나도 켜지지 않은 항목만 */
export const droppedOf = (items, on) => items.filter((item) => !item.owners.some((o) => on.has(o)))

/** 파일을 지우고 비게 된 윗 폴더를 stop 까지 거슬러 올라가며 지운다 */
function removeFile(root, rel, stop) {
  rmSync(join(root, rel), { force: true })
  for (let dir = dirname(join(root, rel)); dir.length > stop.length && existsSync(dir) && readdirSync(dir).length === 0; dir = dirname(dir)) rmdirSync(dir)
}

/** vercel.json crons 에서 남은 API 주소(remaining)가 아닌 경로의 줄을 뺀다. 줄이 바뀌면 true */
export function dropCrons(vercel, remaining) {
  if (!Array.isArray(vercel.crons)) return false
  const kept = vercel.crons.filter((c) => remaining.has(c.path))
  const changed = kept.length !== vercel.crons.length
  vercel.crons = kept
  return changed
}

/**
 * 한 바퀴 시험 데이터(e2e/loop-steps.json)를 고른 기능만 남게 줄인다 — steps·requires·mail 의 키가 기능 id 다(selectors·expect 는 기능 밖 공용이라 그대로 둔다).
 * 줄이지 않으면 출력의 CI 가 지워진 쪽(/pricing·/contact)을 방문한다. 고른 기능이 하나도 안 남으면 던진다(빈 steps 는 시험이 읽지 못한다)
 */
export function filterLoopSteps(spec, chosen) {
  const keep = (rec) => Object.fromEntries(Object.entries(rec ?? {}).filter(([id]) => chosen.has(id)))
  const steps = keep(spec.steps)
  if (!Object.keys(steps).length) throw new Error("e2e/loop-steps.json: 고른 기능 중 한 바퀴 단계가 있는 것이 없다")
  return { ...spec, steps, requires: Object.fromEntries(Object.entries(keep(spec.requires)).map(([id, need]) => [id, need.filter((n) => chosen.has(n))])), mail: keep(spec.mail) }
}

const pathOf = (href) => href.split(/[?#]/)[0].replace(/(.)\/+$/, "$1")

/**
 * site.json 의 링크를 고친다(제자리 수정). 반환: 고친 곳의 수.
 * gone(href)가 참인 `href` 칸을 가진 객체가 배열 원소면 원소를 빼고, 객체의 한 속성이면 선택 속성(optional 정규식)이면 속성을 빼고 아니면 href 를 target(href)로 바꾼다.
 * positional: 이름이 맞는 배열(요금제 순서에 묶인 행동 버튼 목록 `planCtas`·`signedInCtas`)은 원소를 빼면 순서가 어긋나므로 빼지 않고 주소만 바꾼다.
 * skip: 최상위에서 건드리지 않을 키(사이트맵이 읽는 pages). log({ path, action, href, to })는 고친 곳마다 불린다
 */
export function pruneLinks(node, { gone, optional, target, positional = [], skip = [], log = () => {} }) {
  let n = 0
  const isLink = (v) => v && typeof v === "object" && !Array.isArray(v) && typeof v.href === "string"
  const rewrite = (link, path) => {
    const to = target(link.href)
    log({ path, action: "rewrite", href: link.href, to })
    link.href = to
  }
  const visit = (v, path, top, key) => {
    if (Array.isArray(v)) {
      const bound = positional.some((re) => re.test(key ?? ""))
      for (let i = v.length - 1; i >= 0; i--) {
        if (isLink(v[i]) && gone(v[i].href)) {
          n++
          if (bound) rewrite(v[i], `${path}[${i}]`)
          else {
            log({ path: `${path}[${i}]`, action: "remove", href: v[i].href })
            v.splice(i, 1)
          }
        } else visit(v[i], `${path}[${i}]`, false)
      }
    } else if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v)) {
        if (top && skip.includes(k)) continue
        const here = path ? `${path}.${k}` : k
        if (isLink(child) && gone(child.href)) {
          n++
          if (optional.some((re) => re.test(k))) {
            log({ path: here, action: "remove", href: child.href })
            delete v[k]
          } else rewrite(child, here)
          if (k in v) visit(child, here, false)
        } else visit(child, here, false, k)
      }
    }
  }
  visit(node, "", true)
  return n
}

/** 요금제 행동 블록 공용 파일(plan-cta)을 import 하는 블록 파일 → 사이트 섹션이 쓰는 블록 이름(`block-<폴더>-<이름>`) 집합 */
export function planCtaBlocks(root, sharedFile) {
  const dir = "components/blocks/"
  const out = new Set()
  if (!existsSync(join(root, dir))) return out
  for (const rel of walk(join(root, dir)).filter((f) => /\.tsx?$/.test(f))) {
    if (`${dir}${rel}` === sharedFile) continue
    if (/from\s+["'][^"']*\/_shared\/plan-cta["']/.test(readFileSync(join(root, dir, rel), "utf8"))) out.add(`block-${rel.replace(/\.tsx?$/, "").split("/").join("-")}`)
  }
  return out
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/** 글자 파일들에서 따옴표로 시작하는 문자열 맨 앞이 지운 쪽 주소인 곳(주소 뒤는 (/) ? # 따옴표)을 모은다: ["파일 — 주소"] */
export function scanGoneLinks(files, goneUrls, read) {
  if (!goneUrls.size) return []
  const re = new RegExp(`(["'\`])(${[...goneUrls].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})(?=/?[?#"'\`])`, "g")
  return files.flatMap((rel) => [...new Set([...read(rel).matchAll(re)].map((m) => m[2]))].map((url) => `${rel} — ${url}`))
}

/** 템플릿의 공개 쪽 목록(lib/public-paths.json — 템플릿 lib/seo.ts 의 PUBLIC_PATHS 가 같은 파일을 읽는다). 없으면 템플릿이 바뀐 것이라 던진다(사이트맵이 말없이 비지 않게) */
export function publicPaths(to) {
  const file = join(to, "lib", "public-paths.json")
  if (!existsSync(file)) throw new Error("lib/public-paths.json 이 출력에 없다 — 템플릿의 공개 쪽 목록 자리가 바뀌었다")
  return readJson(file)
}

/** 쪽 파일의 `export const metadata = { title: "…" }` 제목. 없으면 null */
function pageTitle(to, file) {
  const f = join(to, file)
  return existsSync(f) ? (/metadata\s*=\s*\{[^}]*?title:\s*"([^"]+)"/.exec(readFileSync(f, "utf8"))?.[1] ?? null) : null
}

export function run(state) {
  const { to, table, features, rules } = state
  const cfg = rules.steps.drop
  const on = turnedOn(table, features)
  const dropped = [...droppedOf(table.pages, on), ...droppedOf(table.routes, on)]
  state.pruned = []
  state.rewritten = []
  state.warnings = []
  for (const { file, url } of dropped) {
    if (!existsSync(join(to, file))) continue
    removeFile(to, file, join(to, "app"))
    state.removed.push(file)
    state.pruned.push(url)
  }

  // 남은 쪽·API 주소 — 시안에서 가져온 쪽과 템플릿 쪽 모두(켜짐 목록은 화면이 「이 쪽이 있나」를 묻는 한 곳이다)
  const urls = [...new Set(walk(join(to, "app"), withSecrets(rules, rules.templateExclude)).map((rel) => urlOf(`app/${rel}`)).filter(Boolean))].sort()
  const remaining = new Set(urls)
  const appFiles = walk(join(to, "app"), withSecrets(rules, rules.templateExclude)).map((rel) => `app/${rel}`)
  const goneUrls = new Set(dropped.map((p) => p.url).filter((u) => !remaining.has(u)))

  const vercelFile = join(to, "vercel.json")
  if (existsSync(vercelFile)) {
    const vercel = readJson(vercelFile)
    if (dropCrons(vercel, remaining)) writeJson(vercelFile, vercel)
  }

  const siteFile = join(to, cfg.siteFile)
  if (existsSync(siteFile)) {
    const site = JSON.parse(readFileSync(siteFile, "utf8"))
    const gone = (href) => /^\//.test(href) && !href.startsWith("//") && goneUrls.has(pathOf(href))
    const target = (href) => cfg.fallbacks[pathOf(href)]?.find((u) => remaining.has(u)) ?? cfg.rewriteTo
    const log = (e) => {
      state.rewritten.push({ file: cfg.siteFile, ...e })
      if (e.action === "rewrite" && e.to === cfg.rewriteTo) state.warnings.push(`${cfg.siteFile} ${e.path}: ${e.href} → ${e.to} (지운 쪽을 대신할 쪽이 rules.json steps.drop.fallbacks 에 없다)`)
    }
    pruneLinks(site, {
      gone,
      optional: cfg.optionalKeys.map((p) => new RegExp(p)),
      positional: cfg.positionalKeys.map((p) => new RegExp(p)),
      target,
      skip: ["pages"],
      log,
    })
    // 요금제 행동 블록(plan-cta)의 로그인 뒤 기본 주소(예: /upgrade?plan={plan})는 web-factory 에서 동기화한 블록 코드에 있다 — 코드를 고치지 않고,
    // 그 블록을 쓰는 섹션의 copy.signedInHref 를 남은 쪽으로 정해 덮는다. 쿼리 틀({plan})은 그대로 둔다
    const pc = cfg.planCta
    const planFile = join(to, pc.file)
    if (existsSync(planFile) && site.sections) {
      const def = new RegExp(pc.defaultPattern).exec(readFileSync(planFile, "utf8"))?.[1]
      const users = planCtaBlocks(to, pc.file)
      for (const [key, sec] of Object.entries(site.sections)) {
        if (!users.has(sec?.block)) continue
        const current = sec.props?.copy?.[pc.key] ?? def
        if (!current || !gone(current)) continue
        const next = `${target(current)}${current.slice(pathOf(current).length)}`
        const copy = ((sec.props ??= {}).copy ??= {})
        copy[pc.key] = next
        log({ path: `sections.${key}.props.copy.${pc.key}`, action: "rewrite", href: current, to: target(current) })
      }
    }
    if (site.pages) {
      for (const route of Object.keys(site.pages)) if (goneUrls.has(pathOf(route))) delete site.pages[route]
      // 사이트맵은 site.json pages 를 읽는다: 템플릿의 남은 공개 쪽(예: 문의)이 없으면 더한다
      for (const path of publicPaths(to)) {
        if (!remaining.has(path) || path in site.pages) continue
        const file = appFiles.find((rel) => urlOf(rel) === path)
        const title = (file && pageTitle(to, file)) || path
        site.pages[path] = { id: path.slice(1).replace(/\W+/g, "-") || "home", type: "other", hero: false, showsPrice: false, title, description: title }
      }
    }
    writeFileSync(siteFile, `${JSON.stringify(site, null, 2)}\n`)
  }

  writeJson(join(to, "lib", "launch", "enabled.json"), { parts: [...on].sort(), urls })

  // 출력 CI(smoke --mode loop)는 e2e/loop-steps.json 의 모든 기능을 돈다 — 고르지 않은 기능의 단계가 지워진 쪽(/pricing·/contact)을 방문하지 않게 데이터를 줄인다
  const loopFile = join(to, rules.steps.loopSteps.file)
  if (existsSync(loopFile)) writeJson(loopFile, filterLoopSteps(readJson(loopFile), new Set(features.outcomes)))

  const files = [...state.written].filter((rel) => isTextFile(rel) && !matchesAny(cfg.scanSkip.flatMap((s) => s.match), rel) && existsSync(join(to, rel)))
  const left = scanGoneLinks(files, goneUrls, (rel) => readFileSync(join(to, rel), "utf8"))
  if (left.length) throw new Error(`지운 쪽 주소가 시안 파일에 남았다 ${left.length}곳 — steps.drop.fallbacks·optionalKeys 로 고치거나 시안을 고친다:\n  ${left.join("\n  ")}`)
  return state
}
