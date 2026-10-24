// 완성 확인(sitebrew v0.2.0 계획 3 Task 10) — 전달한 폴더를 실제로 한 번 돌려 본다. `deliver --check-loop` 가 켰을 때만 돈다.
//   runCheckLoop(outDir, { lfDir, features, ... }) → { status: 'ok'|'skipped'|'failed', key?, reason?, reasonEn?, detail?, mail } — 던지지 않는다(어떤 오류든 failed 로 돌려준다).
//   · 제품형: 전달한 폴더 자신의 scripts/ci/smoke.mjs --mode loop 를 폴더 안(cwd = outDir)에서 돌린다(--root 도 launch-factory 템플릿도 없다). 고른 기능만 LOOP_FEATURES 로 넘긴다(describeFeatures(...).loop).
//     설치(npm install) 뒤 폴더의 node_modules 에서 @playwright/test 를 찾는다 — 없으면 smoke 도 종료 3 으로 끝나므로 「브라우저 없음」과 섞이지 않게 먼저 skipped(이유 문장).
//     종료 0 = ok · 3 = 브라우저 없음(skipped) · 그 밖 = failed(출력 끝줄 detail). 메일 기록은 smoke 가 남긴 마지막 파일을 template 별로 센다.
//   · 소개형: 문의 접수(app/api/inquiry)가 더해졌을 때만 — 빌드 → 서버 → POST /api/inquiry → 가짜 메일 기록 줄 수가 expect.json 과 같은가. 받는 메일이 「확인 필요」(미리보기)라 접수가 503 으로 답하면 실패가 아니라 skipped.
//   · 메모리 여유가 MIN_FREE_GB 아래면 기다리지 않고 skipped(잰 값을 이유에 적는다). smoke 자신의 메모리 대기 문턱도 같은 값으로 맞춘다. 서버·브라우저는 띄운 쪽이 PID 나무째 끈다(run-proc.mjs · smoke.mjs).
//   문장은 deliver-copy.json(checkLoop*) 한 곳 — 여기에는 사용자 문장이 없다. 이유는 ko·en 둘 다 낸다(README 가 두 언어로 쓴다). 실패 원인(영어 detail)은 이유 문장에 섞지 않고 detail 에만 둔다. 이유 문장과 detail 에서는 이 PC 의 절대 경로를 가린다.
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs'
// killTree·readOutbox·countByTemplate 는 launch-factory 쪽(scripts/ci/smoke.mjs · packages/email)과 모양이 같은 작은 복제다 — 저장소가 둘이라 공유 패키지로 뽑지 않고 시험이 모양을 고정한다(계획 4 결정 기록 M4).
import { createRequire } from 'node:module'
import { freemem, homedir, tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { describeFeatures, loadOutcomes } from '../intake/features.mjs'
import { envWithoutSecrets } from '../lib/secret-env.mjs'
import { INQUIRY_EXPECT, INQUIRY_SAMPLE, INQUIRY_TARGETS } from './deliver-intro.mjs'
import { loadLoopSteps } from './deliver-product.mjs'
import { isNeedsCheck } from './needs-check.mjs'
import { run, startServer } from './run-proc.mjs'
import { MAIL_ADDRESS } from './site-bind.mjs'

/** 메모리 문턱(GB) — 한 곳. 우리 문턱, smoke 의 LF_SMOKE_MIN_FREE_GB, 안내 문장의 {min} 이 모두 이 값이다. */
export const MIN_FREE_GB = 3
/** 서버에 보내는 요청 하나의 제한 시간(ms) */
export const FETCH_TIMEOUT_MS = 30_000
/** 전달한 폴더 안의 smoke(상대 경로 — cwd = 전달한 폴더) */
export const SMOKE_FILE = join('scripts', 'ci', 'smoke.mjs')
/** 실패 원인(detail)을 README·CLI 에 보이는 끝줄 수 */
export const DETAIL_LINES = 20
/** 가짜 메일 기록 한 줄의 칸(정렬). launch-factory 의 packages/email/outbox.schema.json `required` 와 같아야 한다 — LF_DIR 이 있으면 deliver-branch.test.mjs 가 대조한다. */
export const OUTBOX_KEYS = ['at', 'id', 'subject', 'template', 'to']
/** smoke 가 loop 모드에서 메일 기록을 쓰는 자리(제품 폴더 아래) */
export const LOOP_OUTBOX_DIR = join('.tmp', 'smoke', 'loop')
/** deliver 의 안내 문장 키 → 완성 확인을 건너뛰는 이유 문장 키(기능 기록이 없거나 launch-factory 를 못 찾은 까닭이 같이 간다) */
export const SKIP_BY_NOTICE = { noticeTableChanged: 'checkLoopTableChanged', noticeNoLf: 'checkLoopNoLf', noticeBadFeatures: 'checkLoopBadFeatures' }
/** 문의 접수(route.ts)가 받는 메일이 없을 때 답하는 상태 — 그 밖에 503 으로 답하는 길은 없다 */
const NO_OWNER_STATUS = 503
/** 합성한 제품 폴더에 있어야 하는 폴더 — 없으면 얹기가 끝까지 되지 않은 것이다 */
const COMPOSED_DIRS = [join('components', 'ax'), join('components', 'blocks')]
const SMOKE_EXIT = { ok: 0, noBrowser: 3 }
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const MINUTE = 60_000

export const defaultFreeGb = () => freemem() / 2 ** 30
/** 전달한 폴더에서 @playwright/test 를 찾을 수 있는가(그 폴더의 smoke.mjs 가 하는 것과 같은 해석) */
export const defaultHasPlaywright = (outDir) => {
  try {
    // 해석은 상위 폴더 node_modules 까지 올라가므로, 찾은 파일이 전달한 폴더 안(node_modules 아래)일 때만 있는 것으로 본다 — smoke 는 이 폴더 것만 쓴다
    const found = realpathSync.native(createRequire(join(outDir, 'package.json')).resolve('@playwright/test/package.json'))
    const rel = relative(join(realpathSync.native(outDir), 'node_modules'), found)
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  } catch { return false }
}
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
/** 긴 출력의 끝 n줄(빈 줄 뺌) — README 와 CLI 가 같은 줄 수만 보인다. */
export const lastLines = (text, n = DETAIL_LINES) => String(text ?? '').split(/\r?\n/).filter((l) => l.trim()).slice(-n).join('\n')
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 경로를 찾는 정규식 — 대소문자를 가리지 않고, 구분자는 `\`·`\\`(JSON 이스케이프)·`/` 어느 것이든 맞는다. */
const pathRegex = (p) => new RegExp(p.split(/[\\/]+/).map(escapeRe).join('(?:\\\\{1,2}|/)'), 'gi')
const longForm = (p, realpath) => { try { return realpath(p) } catch { return null } }
const startsWithI = (s, prefix) => s.toLowerCase().startsWith(prefix.toLowerCase())
/**
 * 8.3 짧은 이름(<home>~1\...) 별칭 — TEMP·TMP·tmpdir() 의 원래 값은 짧은 이름일 수 있고, 긴 이름과 글자가 다르다.
 * 사용자 이름은 적지 않는다: 원래 값과 realpath 로 푼 긴 이름을 맞대어 그때그때 만든다.
 * @param {Array<[string, string]>} pairs [경로, 이름표]
 * @returns {Array<[string, string]>} 짧은 이름으로 쓴 같은 경로와 같은 이름표
 */
export function shortAliases(pairs, { env = process.env, realpath = realpathSync.native, home = homedir(), tmp = tmpdir() } = {}) {
  const out = []
  const homeLong = longForm(home, realpath) ?? home
  for (const raw of [env.TEMP, env.TMP, tmp].filter(Boolean)) {
    const long = longForm(raw, realpath)
    if (!long || long === raw) continue
    for (const [p, label] of pairs) if (p && startsWithI(p, long)) out.push([raw + p.slice(long.length), label])
    // 짧은 홈: 원래 값에서 홈과 같은 깊이만큼의 앞부분
    if (startsWithI(long, homeLong)) {
      const depth = homeLong.split(/[\\/]+/).length
      out.push([raw.split(/[\\/]+/).slice(0, depth).join('\\'), '~'])
    }
  }
  return out
}
/** 이 PC 의 절대 경로를 짧은 이름으로 바꾼다(긴 경로부터). 대소문자·`\`·`\\`·`/` 구분 없이, 짧은 이름 별칭도 같이. */
export function scrubPaths(text, pairs, opts) {
  const base = pairs.filter(([p]) => p)
  const all = [...base, ...shortAliases(base, opts)]
  return all.sort((a, b) => b[0].length - a[0].length).reduce((s, [p, label]) => s.replace(pathRegex(p), label), String(text ?? ''))
}
/** 이름표를 단 경로 말고도 남은 절대 경로(다른 드라이브·다른 사용자의 홈 — `<dev folder>/x.js:3`, `/home/u/x`)를 `<path>` 로 바꾼다. 상대 경로(./app/page.tsx)와 주소(https://…)는 건드리지 않는다. */
export const scrubAbsolute = (text) => String(text ?? '')
  .replace(/(?<![\w.])[A-Za-z]:[\\/][^\s"'`)<>|,;]*/g, '<path>')
  .replace(/(?<![\w.~<>])\/(?:home|Users|root)\/[^\s"'`)<>|,;]*/g, '<path>')
export const scrubFor = (outDir, lfDir) => (text) => scrubAbsolute(scrubPaths(text, [[outDir, '<folder>'], [lfDir, '<launch-factory>'], [homedir(), '~']]))

/** 메일 기록(JSONL) 한 파일의 줄들. 파일이 없거나 비면 []. 깨진 줄은 던진다(조용히 줄 수를 속이지 않는다). */
export const readOutbox = (file) => (existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
export const countByTemplate = (lines) => lines.reduce((m, l) => ({ ...m, [l.template]: (m[l.template] ?? 0) + 1 }), {})

/** smoke loop 이 남긴 가장 새 메일 기록의 template 별 줄 수. 없으면 {}. */
export function loopMail(outDir) {
  const dir = join(outDir, LOOP_OUTBOX_DIR)
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir).filter((f) => /^outbox-\d+\.jsonl$/.test(f)).map((f) => join(dir, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return files.length ? countByTemplate(readOutbox(files[0])) : {}
}

const result = (copy, status, key, vars = {}, extra = {}) => ({
  status,
  ...(key ? { key, reason: fill(copy[key].ko, { min: MIN_FREE_GB, ...vars }), reasonEn: fill(copy[key].en, { min: MIN_FREE_GB, ...vars }) } : {}),
  mail: {},
  ...extra,
})
/** 실패: 이유 문장은 고정 문장이고, 원인(영어 줄들)은 detail 에만 둔다 — head 한 줄 + 출력 끝. */
const failed = (copy, head, tail = '', mail = {}) => ({ ...result(copy, 'failed', 'checkLoopFailed'), detail: [head, tail].filter((x) => String(x ?? '').trim()).join('\n'), mail })

/** 시간 제한에 걸린 실패 — 이유는 고정 문장(checkLoopTimedOut), 어디서 걸렸는지와 출력 끝은 detail. */
const timedOut = (copy, what, tail = '') => ({ ...result(copy, 'failed', 'checkLoopTimedOut'), detail: [`${what} timed out`, tail].filter((x) => String(x ?? '').trim()).join('\n'), mail: {} })

/** 예기치 못한 오류를 failed 로 바꾼다 — deliver 가 복사한 뒤에 던지지 않게 한다. */
export const failedFromError = (copy, err, scrub = (s) => s) => failed(copy, scrub(String(err?.message ?? err).split(/\r?\n/)[0]))

/** 전달한 폴더의 content/site.json 에서 문의를 받을 쓸 수 있는 메일 주소가 있는가(접수 코드 route.ts 의 usable 과 같은 규칙). 파일을 못 읽으면 null(모름). */
function ownerMailState(outDir) {
  try {
    const site = JSON.parse(readFileSync(join(outDir, 'content', 'site.json'), 'utf8'))
    const usable = (v) => typeof v === 'string' && v.trim() !== '' && !isNeedsCheck(v) && MAIL_ADDRESS.test(v.trim())
    return [site?.business?.email, site?.contact?.email].some(usable)
  } catch { return null }
}
/** 접수 코드가 받는 메일이 없을 때 돌려주는 문장들(전달한 폴더의 lib/inquiry-copy.json — 로캘 하나가 쓰인다). 읽지 못하면 []. */
function noOwnerTexts(outDir) {
  try { return Object.values(JSON.parse(readFileSync(join(outDir, INQUIRY_TARGETS.copy), 'utf8')).noOwner ?? {}) } catch { return [] }
}

/**
 * 소개형 문의 확인 블록. outDir 에 문의 접수(route.ts)가 있고 node_modules 가 없으면 설치한 뒤, 빌드 → 서버 → 잘못된 본문 둘 → 정상 한 번 → 기록 줄 수 확인.
 * 임시 메일 기록 폴더와 서버는 끝에 늘 정리한다. @returns {{ ok: boolean, detail?: string, skip?: string, mail: object }} skip = 건너뜀 이유 문장 키(결함이 아님)
 */
export async function checkIntroInquiry(outDir, { env = envWithoutSecrets(process.env), spawn = run, start = startServer, expect = INQUIRY_EXPECT, sample = INQUIRY_SAMPLE, fetchTimeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const e = { ...env, NEXT_TELEMETRY_DISABLED: '1', CI: '1' }
  // 받는 메일이 아직 없으면 어떻게 해도 접수가 503 이다 — 몇 분 걸리는 설치·빌드 전에 건너뛴다
  if (ownerMailState(outDir) === false) return { ok: false, skip: 'checkLoopNoOwner', ran: false, mail: {} }
  if (!existsSync(join(outDir, 'node_modules', 'next'))) {
    const i = await spawn(NPM, ['install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: outDir, env: e, timeoutMs: 20 * MINUTE })
    if (i.code !== 0) return { ok: false, detail: `npm install exit ${i.code}: ${lastLines(i.tail)}`, mail: {} }
  }
  const b = await spawn(NPM, ['run', 'build'], { cwd: outDir, env: e, timeoutMs: 20 * MINUTE })
  if (b.code !== 0) return { ok: false, detail: `npm run build exit ${b.code}: ${lastLines(b.tail)}`, mail: {} }
  const tmp = mkdtempSync(join(tmpdir(), 'sitebrew-check-loop-'))
  const outbox = join(tmp, 'mock.jsonl')
  let srv
  try {
    if (readOutbox(outbox).length) return { ok: false, detail: 'the mail record was not empty at the start', mail: {} }
    srv = await start(outDir, { ...e, LF_MOCK_OUTBOX: outbox }, '/')
    const url = `http://127.0.0.1:${srv.port}/api/inquiry`
    const post = (body, headers = {}) => fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(fetchTimeoutMs) })
    const json = { 'content-type': 'application/json' }
    const bad = await post('not json')
    if (bad.status !== 400) return { ok: false, detail: `a broken body got ${bad.status}, expected 400`, mail: {} }
    const empty = await post(JSON.stringify({ name: '  ' }), json)
    if (empty.status !== 400) return { ok: false, detail: `an empty inquiry got ${empty.status}, expected 400`, mail: {} }
    if (readOutbox(outbox).length) return { ok: false, detail: 'a rejected inquiry left a mail record', mail: {} }
    const ok = await post(JSON.stringify(sample), json)
    // 503 = 받는 메일이 「확인 필요」(미리보기 상태)라 접수가 받을 곳이 없다 — 결함이 아니라 이 상태에서는 확인할 수 없다는 뜻이다(기록은 비어 있고, 본문이 접수 코드의 noOwner 문장이어야 한다 — 다른 까닭의 503 은 결함)
    const sent = await ok.json().catch(() => null)
    if (ok.status === NO_OWNER_STATUS && !readOutbox(outbox).length && sent?.formError !== undefined && noOwnerTexts(outDir).includes(sent.formError)) return { ok: false, skip: 'checkLoopNoOwner', mail: {} }
    if (ok.status !== 200) return { ok: false, detail: `a valid inquiry got ${ok.status}, expected 200`, mail: {} }
    if (sent.ok !== true) return { ok: false, detail: `the reply is not ok:true (${JSON.stringify(sent)})`, mail: {} }
    const got = readOutbox(outbox)
    const mail = countByTemplate(got)
    if (!isDeepStrictEqual(mail, expect)) return { ok: false, detail: `mail records ${JSON.stringify(mail)}, expected ${JSON.stringify(expect)}`, mail }
    if (got[0].id !== sent.id) return { ok: false, detail: 'the record id differs from the reply id', mail }
    if (JSON.stringify(Object.keys(got[0]).sort()) !== JSON.stringify(OUTBOX_KEYS)) return { ok: false, detail: `record keys ${Object.keys(got[0])}`, mail }
    if (!Number.isFinite(Date.parse(got[0].at))) return { ok: false, detail: `the record time is not a date: ${got[0].at}`, mail }
    if (Object.values(sample).some((v) => JSON.stringify(got).includes(v))) return { ok: false, detail: 'the record carries the sender data', mail }
    return { ok: true, mail }
  } catch (err) {
    return { ok: false, detail: String(err?.message ?? err), mail: {} }
  } finally {
    srv?.stop()
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
  }
}

/**
 * 제품형: 전달한 폴더의 smoke --mode loop. package.json 이 없으면 아무것도 부르지 않고 건너뛴다(위 폴더에 설치되는 사고 방지). 설치가 안 된 제품 폴더는 먼저 npm install 한다.
 * 이 확인이 설치한 뒤에 건너뛰면 결과에 ran: true 를 싣는다 — README 가 「남은 것」 안내를 낸다.
 * smoke 와 Playwright 는 전달한 폴더 것이다(scripts/ci·e2e 와 @playwright/test 의존이 폴더에 들어 있다) — launch-factory 템플릿을 거치지 않는다.
 */
async function checkProduct(outDir, { loop, env, spawn, copy, hasPlaywright }) {
  // smoke 는 CI=true 이면 브라우저를 찾지 않고(워크플로가 설치한다고 믿는다) 메모리도 기다리지 않는다 — 이 PC 에서 돌리는 확인이라 두 값을 뺀다
  const e = { ...env, NEXT_TELEMETRY_DISABLED: '1' }
  delete e.CI
  delete e.GITHUB_ACTIONS
  if (!existsSync(join(outDir, 'package.json'))) return result(copy, 'skipped', 'checkLoopNoPackage')
  const install = !existsSync(join(outDir, 'node_modules', 'next'))
  if (install) {
    const i = await spawn(NPM, ['install', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: outDir, env: e, timeoutMs: 20 * MINUTE })
    if (i.code !== 0) return i.timedOut ? timedOut(copy, `npm install`, i.tail) : failed(copy, `npm install exit ${i.code}`, i.tail)
  }
  // 합성이 반쯤 끝난 폴더(블록·AX 부품이 없다)는 smoke 가 이상한 오류로 죽으므로 띄우기 전에 원인을 말한다
  const missing = COMPOSED_DIRS.filter((d) => !existsSync(join(outDir, d)))
  if (missing.length) return failed(copy, `the delivered folder is missing ${missing.join(', ')} — the product was not composed completely`)
  // smoke 가 종료 3 으로 끝나는 길은 둘이다: 브라우저가 없거나 @playwright/test 가 없다. 뒤쪽은 설치가 끝난 지금 알 수 있으므로 smoke 를 띄우기 전에 따로 건너뛴다(자동 설치는 하지 않는다).
  if (!hasPlaywright(outDir)) return result(copy, 'skipped', 'checkLoopNoPlaywright', {}, { ran: install })
  // smoke 도 빌드 전에 메모리를 기다린다(기본 문턱 3 GB, 2분씩 30분) — 우리 문턱과 같은 값으로 맞춰 둔다
  const r = await spawn(process.execPath, [SMOKE_FILE, '--mode', 'loop'], { cwd: outDir, env: { ...e, LOOP_FEATURES: loop.join(','), LF_SMOKE_MIN_FREE_GB: String(MIN_FREE_GB) }, timeoutMs: 60 * MINUTE })
  const mail = loopMail(outDir)
  if (r.timedOut) return { ...timedOut(copy, 'smoke', r.tail), mail }
  if (r.code === SMOKE_EXIT.ok) return { ...result(copy, 'ok', 'checkLoopOk'), mail }
  if (r.code === SMOKE_EXIT.noBrowser) return { ...result(copy, 'skipped', 'checkLoopNoBrowser'), mail }
  return failed(copy, `exit ${r.code}`, r.tail, mail)
}

/** 이 PC 의 절대 경로를 가린다 — 이유 문장(ko·en)과 detail 이 모두 같은 가리개를 지난다. */
const scrubResult = (r, scrub) => ({ ...r, ...(r.reason !== undefined ? { reason: scrub(r.reason), reasonEn: scrub(r.reasonEn) } : {}), ...(r.detail !== undefined ? { detail: scrub(r.detail) } : {}) })

/**
 * @param {string} outDir  전달한 폴더
 * @param {{ lfDir: string|null, features: object|null, table?: object, notice?: string, copy: object, env?: object, spawn?: Function, freeGb?: Function, hasPlaywright?: Function, checkIntro?: Function }} o
 *   notice = deliver 가 옛 경로로 가며 남긴 안내 문장 키(SKIP_BY_NOTICE 에 있으면 그 이유를 쓴다).
 *   spawn·freeGb·hasPlaywright·checkIntro 는 시험이 바꿔 끼운다(기본은 진짜 프로세스·진짜 메모리·진짜 해석(전달한 폴더 기준)·checkIntroInquiry).
 */
export async function runCheckLoop(outDir, { lfDir, features, table, notice, copy, env = envWithoutSecrets(process.env), spawn = run, freeGb = defaultFreeGb, hasPlaywright = defaultHasPlaywright, checkIntro = checkIntroInquiry }) {
  const scrub = scrubFor(outDir, lfDir)
  try {
    if (!features || !lfDir) return scrubResult(result(copy, 'skipped', SKIP_BY_NOTICE[notice] ?? 'checkLoopNoFeatures'), scrub)
    const free = freeGb()
    if (free < MIN_FREE_GB) return scrubResult(result(copy, 'skipped', 'checkLoopMemory', { free: free.toFixed(1) }), scrub)
    const described = describeFeatures(features, table ?? loadOutcomes(lfDir), { loopSteps: loadLoopSteps(lfDir) })
    if (described.product) {
      if (!described.loop.length) return scrubResult(result(copy, 'skipped', 'checkLoopNoSteps'), scrub)
      return scrubResult(await checkProduct(outDir, { loop: described.loop, env, spawn, copy, hasPlaywright }), scrub)
    }
    if (!features.outcomes.includes('inquiry') || !existsSync(join(outDir, INQUIRY_TARGETS.route))) return scrubResult(result(copy, 'skipped', 'checkLoopNoInquiry'), scrub)
    const r = await checkIntro(outDir, { env, spawn })
    if (r.ok) return scrubResult({ ...result(copy, 'ok', 'checkLoopOk'), mail: r.mail }, scrub)
    // checkIntro 의 건너뜀(받는 메일 없음)은 설치·빌드·서버를 돈 뒤에 나온다
    if (r.skip) return scrubResult(result(copy, 'skipped', r.skip, {}, { ran: r.ran !== false }), scrub)
    return scrubResult(failed(copy, r.detail, '', r.mail), scrub)
  } catch (err) {
    return failedFromError(copy, err, scrub)
  }
}

/** 영어 원인 줄을 담는 코드 블록 — 안에 백틱 줄이 있어도 닫히지 않게 바깥 울타리를 더 길게 한다. */
function fenced(text) {
  if (!text) return []
  const run = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length))
  const fence = '`'.repeat(Math.max(3, run + 1))
  return [fence, text, fence]
}

/**
 * README 에 더할 절(한 언어). 순수 함수 — 결과 한 줄(+ 돌렸다면 남은 폴더 안내 한 줄)을 싣는다.
 * 실패 원인(영어 detail)은 한국어 문장에 섞지 않고, 한국어 절에 따로 코드 블록(끝 DETAIL_LINES 줄)으로만 둔다 — 영어 절은 그 블록을 가리킨다.
 * 보일 원인이 없으면 블록이 없으므로 블록을 가리키지 않는 문장(checkLoopFailedPlain)을 쓴다. 설치·빌드 뒤 건너뜀(ran)도 남은 것을 알린다.
 */
export function checkLoopSection(r, copy, lang) {
  const detail = r.status === 'failed' ? lastLines(r.detail) : ''
  const failedLine = r.key === 'checkLoopTimedOut' ? (lang === 'en' ? r.reasonEn : r.reason) : detail ? copy.checkLoopFailed[lang] : copy.checkLoopFailedPlain[lang]
  const line = r.status === 'ok' ? copy.checkLoopOk[lang] : r.status === 'failed' ? failedLine : lang === 'en' ? r.reasonEn : r.reason
  const ran = r.status === 'ok' || r.status === 'failed' || r.ran === true
  const block = lang === 'ko' ? fenced(detail) : []
  return [copy.checkLoopTitle[lang], '', line, '', ...(block.length ? [...block, ''] : []), ...(ran ? [copy.checkLoopLeftover[lang], ''] : [])]
}
