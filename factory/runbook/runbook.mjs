// 런북 명령(계획 5 Task 14) — index.mjs 위의 얇은 CLI 껍질. 시계는 여기(맨 아래 진입부)에서만 읽는다.
//   node factory/runbook/runbook.mjs <gate|open|chapter|check|alternatives|mark> (--site <폴더> | --run <폴더> [--pick a|b|c]) [--lf <폴더>] [--lang ko|en] [--today YYYY-MM-DD]
//     gate [--answer yes|no|unsure]                       0 · 2          {door} / {door, saved}
//     open [--features id,…]                               0 · 3 · 5     --features 는 사용자 답 기록(문을 열지 않는다). "" = 켠 기능 없음
//     chapter <gid|all> [--level beginner|expert] [--out 파일]  0 · 3 · 4 · 5   --out 은 새 파일만(있으면 4)
//     check <gid> --file <글 파일>                         0 · 1 문제 있음 · 5
//     alternatives <gid> [--want free|cheaper|better|ko]   0 · 3 · 5
//     mark <gid> doing|done|skipped | mark --level beginner|expert   0 · 2 · 5
//   모든 명령: 2 = 인자 오류 · 1 + 표준오류 「도구 실패:」 = LF 못 찾음·데이터 버전/해시 불일치 · 3 = 켠 기능을 물어야 함(ask) · 5 = 문 닫힘.
//   --site 와 --run 은 함께 줘도 된다(문은 실행 폴더가 기준, 사용자 폴더는 사본). --pick 은 검사만 한다(기록은 실행 폴더 바로 아래 .sitebrew).
//   본문 명령의 --answer 는 상태를 남길 자리가 없을 때만(옛 폴더) 받는다 — 대화에서 이미 받은 답을 넘기는 길. 자리가 있으면 gate 를 쓴다(종료 2).
//   표준출력은 JSON 하나, 메시지는 표준오류. 받은 값을 메시지에 되풀이하지 않고, 출력은 데이터의 키 모양 표로 한 번 더 가린다.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { DoorClosed, openRunbook, OutExists, RunbookArgError, RunbookToolError } from './index.mjs'

/** 도구 실패 줄의 머리 — 관문 도구들과 같은 집안 관례(docs/agents/agent-guide.md 「도구 실패:」). */
export const TOOL_FAILURE = '도구 실패:'
export const EXIT = { ok: 0, problems: 1, tool: 1, usage: 2, ask: 3, exists: 4, closed: 5 }

const USAGE = 'usage: runbook.mjs <gate|open|chapter|check|alternatives|mark> (--site DIR | --run DIR [--pick a|b|c]) [--lf DIR] [--lang ko|en] [--today YYYY-MM-DD]'
const COMMON = ['site', 'run', 'pick', 'lf', 'lang', 'today']
const COMMANDS = {
  gate: { positionals: [0], flags: ['answer'] },
  open: { positionals: [0], flags: ['features', 'answer'] },
  chapter: { positionals: [1], flags: ['level', 'out', 'answer'] },
  check: { positionals: [1], flags: ['file', 'answer'], required: ['file'] },
  alternatives: { positionals: [1], flags: ['want', 'answer'] },
  mark: { positionals: [0, 2], flags: ['level', 'answer'] },
}
const ENUMS = { pick: ['a', 'b', 'c'], lang: ['ko', 'en'], answer: ['yes', 'no', 'unsure'], level: ['beginner', 'expert'], want: ['free', 'cheaper', 'better', 'ko'] }
const DAY = /^\d{4}-\d{2}-\d{2}$/
const FLAG_NAME = /^--[a-z]+$/

class UsageError extends Error {
  name = 'UsageError'
}

/** 인자 → { cmd, positionals, flags }. 받은 값은 메시지에 싣지 않는다(키 모양이 섞일 수 있다). */
export function parseRunbookArgs(argv) {
  const [cmd, ...rest] = argv
  const spec = Object.hasOwn(COMMANDS, cmd ?? '') ? COMMANDS[cmd] : null
  if (!spec) throw new UsageError(`unknown or missing command\n${USAGE}`)
  const allowed = new Set([...COMMON, ...spec.flags])
  const flags = {}
  const positionals = []
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith('--')) {
      positionals.push(a)
      continue
    }
    const name = a.slice(2)
    if (!FLAG_NAME.test(a) || !allowed.has(name)) throw new UsageError(`${cmd}: unknown option${FLAG_NAME.test(a) ? ` ${a}` : ''}\n${USAGE}`)
    if (name in flags) throw new UsageError(`${cmd}: ${a} given twice`)
    const v = rest[i + 1]
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${cmd}: ${a} needs a value`)
    flags[name] = v
    i++
  }
  if (!spec.positionals.includes(positionals.length)) throw new UsageError(`${cmd}: expected ${spec.positionals.join(' or ')} positional argument(s), got ${positionals.length}\n${USAGE}`)
  for (const [name, values] of Object.entries(ENUMS)) {
    if (name in flags && !values.includes(flags[name])) throw new UsageError(`${cmd}: --${name} must be one of ${values.join('|')}`)
  }
  if ('today' in flags && !DAY.test(flags.today)) throw new UsageError(`${cmd}: --today must be YYYY-MM-DD`)
  if (!flags.site && !flags.run) throw new UsageError(`${cmd}: give --site or --run\n${USAGE}`)
  for (const name of spec.required ?? []) if (!(name in flags)) throw new UsageError(`${cmd}: --${name} is required`)
  if (cmd === 'mark' && (positionals.length === 2) === ('level' in flags)) throw new UsageError('mark: give <gid> <doing|done|skipped> or --level beginner|expert')
  return { cmd, positionals, flags }
}

const listOf = (s) => s.split(',').map((x) => x.trim()).filter(Boolean)

/** 명령 하나를 돌린다 → { code, result }. 인자 오류·도구 실패는 던진다(run 이 종료 코드로 바꾼다). */
function dispatch(rb, { cmd, positionals: [first, second], flags }) {
  if (cmd !== 'gate' && flags.answer) {
    if (rb.canStore()) throw new RunbookArgError('the door is stored for this run — record it with `gate --answer`')
    rb.answerDoor(flags.answer)
  }
  const asked = (r) => ({ code: r?.ask ? EXIT.ask : EXIT.ok, result: r })
  switch (cmd) {
    case 'gate':
      if (!flags.answer) return { code: EXIT.ok, result: { door: rb.door() } }
      return { code: EXIT.ok, result: { door: rb.answerDoor(flags.answer), saved: rb.canStore() } }
    case 'open':
      if ('features' in flags) rb.answerFeatures(listOf(flags.features))
      return asked(rb.overview())
    case 'chapter':
      return asked(rb.chapter(first, flags.level, { out: flags.out }))
    case 'check': {
      let draft
      try { draft = readFileSync(flags.file, 'utf8') } catch { throw new RunbookArgError('check: cannot read --file') }
      const r = rb.check(first, draft)
      if (!Array.isArray(r)) return asked(r)
      return { code: r.length ? EXIT.problems : EXIT.ok, result: { problems: r } }
    }
    case 'alternatives':
      return asked(rb.alternatives(first, flags.want))
    case 'mark':
      return { code: EXIT.ok, result: rb.mark('level' in flags ? { level: flags.level } : { gid: first, status: second }) }
  }
  throw new Error(`unreachable command ${cmd}`)
}

/**
 * CLI 본체 — 출력은 돌려준다(시험이 프로세스 없이도 부를 수 있게). 시계 값은 부르는 쪽이 준다.
 * @returns {{ code: number, stdout: string, stderr: string }}
 */
export function runRunbookCli(argv, { env = process.env, today, now }) {
  const done = (code, result, message, rb) => {
    const scrub = (s) => (rb ? rb.redact(s) : s)
    return { code, stdout: scrub(`${JSON.stringify(result, null, 2)}\n`), stderr: message ? scrub(`${message}\n`) : '' }
  }
  let parsed
  try { parsed = parseRunbookArgs(argv) } catch (e) {
    if (e instanceof UsageError) return done(EXIT.usage, { error: 'usage' }, e.message)
    throw e
  }
  const { flags } = parsed
  let rb
  try {
    rb = openRunbook({ site: flags.site, run: flags.run, lf: flags.lf, lang: flags.lang, today: flags.today ?? today, now, env })
    const { code, result } = dispatch(rb, parsed)
    return done(code, result, '', rb)
  } catch (e) {
    if (e instanceof RunbookArgError) return done(EXIT.usage, { error: 'usage' }, e.message, rb)
    if (e instanceof DoorClosed) return done(EXIT.closed, { error: 'doorClosed', door: e.door }, e.message, rb)
    if (e instanceof OutExists) return done(EXIT.exists, { error: 'exists', file: e.file }, e.message, rb)
    if (e instanceof RunbookToolError) return done(EXIT.tool, { error: 'tool', code: e.code }, `${TOOL_FAILURE} ${e.message}`, rb)
    throw e
  }
}

/** 시스템 날짜(이 컴퓨터의 달력). */
const localDay = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-')

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const clock = new Date()
  let out
  try { out = runRunbookCli(process.argv.slice(2), { today: localDay(clock), now: clock.toISOString() }) } catch (e) {
    out = { code: EXIT.tool, stdout: `${JSON.stringify({ error: 'tool' })}\n`, stderr: `${TOOL_FAILURE} ${e.message}\n` }
  }
  process.stdout.write(out.stdout)
  if (out.stderr) process.stderr.write(out.stderr)
  process.exitCode = out.code
}
