// 비로그인 접근 화면 관문(UXGATE1 · G13, 규칙 factory-rules.md §23 U1 · 감사 R4): node factory/qa/signed-out-access.mjs <origin> --paths /account,/upgrade --out <dir> [--paths-file <json>] [--signin <정규식>] [--params next,returnTo]
// 로그인이 필요한 쪽마다 세션 없이(signed-out 장면을 못 박는다 — --session 이 signed-in 이어도 이 관문은 로그아웃으로 연다) 열어 본다:
//   ① 로그인으로 가는 길이 있나 — 최종 주소가 로그인 쪽(redirect)이거나, 쪽 안에 로그인 쪽으로 가는 링크(a[href])가 있다
//   ② 그 주소에 돌아올 곳(next · returnTo — 기본 두 이름, --params 로 늘린다)이 실려 있나
//   ③ 오류·빈 화면이 아닌가 — HTTP 404·5xx · 글이 거의 없고 링크도 없는 쪽은 실패(401·403 은 ①②를 채우면 안내 화면으로 본다)
// returnTo 값이 그 쪽을 가리키는지는 실패가 아니라 정보(returnToMatches)로 남긴다.
// 종료: 0 = 쟀고 모든 쪽 통과 · 1 = 실패 있음(결과 파일 있음) **또는** 도구 실패(`도구 실패:` — 열리지 않는 쪽(Chrome 오류)·CDP 기한, 결과 파일 없음) · 2 = 인자 오류
// 결과: <out>/signed-out-access.json { origin, scene:'signed-out', pages:[{ path, finalUrl, status, via, signInHref, param, returnToMatches, fails, pass }], summary:{ pages, pass, fail, na, ok } }
// 새 관문(관찰 단계) — 막는 관문이 아니다(docs/agents/agent-guide.md 관문 표).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startChrome, closeChrome, connect, navigateAndWait, startWatchdog } from './cdp.mjs'

// ── 순수 판정 ────────────────────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SIGNIN = '/(?:log-?in|sign-?in|auth)(?:[/?#]|$)'
export const DEFAULT_PARAMS = ['next', 'returnTo']

// 주소 하나가 「로그인 쪽 + 돌아올 곳」인가 → { signIn:boolean, param:string|null, value:string|null }
export function signInTarget(href, base, { signin = new RegExp(DEFAULT_SIGNIN, 'i'), params = DEFAULT_PARAMS } = {}) {
  let u
  try { u = new URL(href, base) } catch { return { signIn: false, param: null, value: null } }
  if (!/^https?:$/.test(u.protocol)) return { signIn: false, param: null, value: null }
  if (!signin.test(u.pathname)) return { signIn: false, param: null, value: null }
  for (const p of params) if (u.searchParams.has(p)) return { signIn: true, param: p, value: u.searchParams.get(p) }
  return { signIn: true, param: null, value: null }
}

// facts: { finalUrl, status, links:[href…] 로그인 글자·주소가 있는 링크, textLength, linkCount }
export function judgePage(path, origin, facts, opts = {}) {
  const fails = []
  const sign = { signin: opts.signin ?? new RegExp(DEFAULT_SIGNIN, 'i'), params: opts.params ?? DEFAULT_PARAMS }
  let via = null, hit = null
  const landed = signInTarget(facts.finalUrl, origin, sign)
  if (landed.signIn && new URL(facts.finalUrl, origin).pathname !== path) { via = 'redirect'; hit = { href: facts.finalUrl, ...landed } }
  else {
    const found = facts.links.map((h) => ({ href: h, ...signInTarget(h, facts.finalUrl, sign) })).filter((x) => x.signIn)
    if (found.length) { via = 'link'; hit = found.find((x) => x.param) ?? found[0] }
  }
  if (facts.status === 404 || facts.status >= 500) fails.push(`http-error: HTTP ${facts.status}`)
  // 로그인 쪽으로 리다이렉트된 쪽은 로그인 화면 자체라 글이 적을 수 있다(「로그인」 + 입력칸) — 빈 화면 검사는 보호된 쪽이 그 자리에 남은 경우만 본다.
  if (via !== 'redirect' && facts.textLength < 20 && facts.linkCount === 0) fails.push('empty-page: 글이 거의 없고 링크도 없다')
  if (!hit) fails.push('no-signin-link: 로그인 쪽으로 가는 길(리다이렉트·링크)이 없다')
  else if (!hit.param) fails.push(`no-return-param: 로그인 주소에 ${sign.params.join(' · ')} 가 없다 (${hit.href})`)
  const matches = hit?.value ? hit.value === path || hit.value.startsWith(path + '/') || hit.value.startsWith(path + '?') : null
  return { path, finalUrl: facts.finalUrl, status: facts.status, via, signInHref: hit?.href ?? null, param: hit?.param ?? null, returnToMatches: matches, fails, pass: fails.length === 0 }
}

export function summarize(pages) {
  const fail = pages.filter((p) => !p.pass).length
  return { pages: pages.length, pass: pages.length - fail, fail, na: 0, ok: pages.length > 0 && fail === 0 }
}

// ── 쪽 안에서 도는 수집(링크 주소 전부 — 로그인 쪽인지는 위 순수 함수가 가른다) ────────────────────────
export const COLLECT = `(() => {
  const status = performance.getEntriesByType('navigation')[0]?.responseStatus ?? 0
  const all = [...document.querySelectorAll('a[href]')]
  return { finalUrl: location.href, status, links: all.map((a) => a.getAttribute('href')), textLength: (document.body?.innerText || '').trim().length, linkCount: all.length }
})()`

export const USAGE = '사용: node factory/qa/signed-out-access.mjs <origin> --paths /account,/upgrade --out <dir> [--paths-file <json 배열>] [--signin <정규식>] [--params next,returnTo]\n' +
  '종료: 0 = 모든 쪽 통과 · 1 = 실패 있음 또는 도구 실패(결과 파일 없음) · 2 = 인자 오류'
export function parseArgs(argv) {
  const a = { paths: [], params: DEFAULT_PARAMS, signin: DEFAULT_SIGNIN }
  const rest = [...argv]
  while (rest.length) {
    const t = rest.shift()
    if (t === '--out') a.out = rest.shift()
    else if (t === '--paths') a.paths.push(...String(rest.shift() ?? '').split(',').filter(Boolean))
    else if (t === '--paths-file') {
      const f = rest.shift()
      if (!f || !existsSync(f)) throw new Error(`--paths-file 이 없다: ${f}`)
      const j = JSON.parse(readFileSync(f, 'utf8'))
      const list = Array.isArray(j) ? j : j.paths
      if (!Array.isArray(list)) throw new Error('--paths-file 은 문자열 배열이거나 { "paths": [...] } 여야 한다')
      a.paths.push(...list)
    } else if (t === '--signin') a.signin = rest.shift()
    else if (t === '--params') a.params = String(rest.shift() ?? '').split(',').filter(Boolean)
    else if (t.startsWith('--')) throw new Error(`모르는 인자: ${t}`)
    else if (!a.origin) a.origin = t
    else throw new Error(`쪽 주소가 둘이다: ${t}`)
  }
  if (!a.origin || !/^https?:\/\//.test(a.origin)) throw new Error('<origin>(http://…)이 필요하다')
  if (!a.out) throw new Error('--out <dir> 이 필요하다')
  if (!a.paths.length) throw new Error('--paths 나 --paths-file 로 보호된 쪽을 적어야 한다')
  for (const p of a.paths) if (typeof p !== 'string' || !p.startsWith('/')) throw new Error(`경로는 /로 시작해야 한다: ${p}`)
  if (!a.params.length) throw new Error('--params 가 비었다')
  try { new RegExp(a.signin, 'i') } catch { throw new Error(`--signin 이 정규식이 아니다: ${a.signin}`) }
  a.origin = a.origin.replace(/\/$/, '')
  return a
}

export async function main(argv) {
  let a
  try { a = parseArgs(argv) } catch (e) { console.error(`signed-out-access: ${e.message}\n${USAGE}`); return 2 }
  mkdirSync(a.out, { recursive: true })
  const jsonPath = join(a.out, 'signed-out-access.json')
  rmSync(jsonPath, { force: true })
  const opts = { signin: new RegExp(a.signin, 'i'), params: a.params }
  const pages = []
  let chrome
  const state = { chrome: null, stage: 'Chrome 시작' }
  const stopDog = startWatchdog('signed-out-access', 90000 + 30000 * a.paths.length, state)
  try {
    chrome = await startChrome(['--hide-scrollbars'], { prefix: 'signed-out-' })
    state.chrome = chrome
    state.stage = 'DevTools 연결'
    const { ws, send, ev } = await connect(chrome.wsUrl, { throwOnException: true })
    for (const path of a.paths) {
      state.stage = `쪽 열기 ${path}`
      const url = a.origin + path
      const nav = await navigateAndWait(send, ev, url, { scene: 'signed-out' }) // --session 이 무엇이든 로그아웃으로 연다
      if (nav?.result?.errorText) throw new Error(`탐색 실패(${nav.result.errorText}): ${url}`)
      const info = await ev(`location.protocol`)
      if (info === 'chrome-error:') throw new Error(`열리지 않는 쪽(Chrome 오류 페이지): ${url}`)
      pages.push(judgePage(path, a.origin, await ev(COLLECT), opts))
    }
    ws.close()
  } catch (e) {
    console.error(`도구 실패: signed-out-access 측정 없음 — ${e.message}`)
    return 1
  } finally { stopDog(); if (chrome) await closeChrome(chrome) }

  const summary = summarize(pages)
  writeFileSync(jsonPath, JSON.stringify({ origin: a.origin, scene: 'signed-out', pages, summary }, null, 2) + '\n')
  console.log(`signed-out-access: 쪽 ${summary.pages} — 통과 ${summary.pass} · 실패 ${summary.fail}`)
  for (const p of pages) {
    console.log(`  ${p.pass ? 'PASS' : 'FAIL'} ${p.path} → ${p.via ?? '없음'}${p.signInHref ? ` ${p.signInHref}` : ''} (HTTP ${p.status}${p.param ? ` · ${p.param}` : ''})`)
    for (const f of p.fails) console.log(`    ${f}`)
  }
  return summary.ok ? 0 : 1
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // 끝나면 곧바로 나간다 — 닫힌 Chrome 에 붙었던 소켓 같은 남은 핸들이 프로세스를 붙잡아 부모(시험·셸)가 끝없이 기다린 적이 있다(UXGATE1 실측).
  const code = await main(process.argv.slice(2))
  process.exitCode = code
  setTimeout(() => process.exit(code), 1500).unref()
}
