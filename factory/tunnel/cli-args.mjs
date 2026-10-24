// 입구 CLI 의 인자 읽기(계획 4 Task 8, 모듈 A) — 문자열 인자를 검사한 값으로 바꾼다. 잘못된 값은 ArgError 로 던지고 입구가 종료 코드 2 로 낸다.
//   · 명령마다 필요한 것만 요구한다: COMMANDS 표 한 곳이 명령 목록과 필수 칸을 안다.
//   · 사용자 문장은 없다 — 오류는 개발자용 영어 한 줄이다.
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { KINDS, LANGS } from './notices.mjs'
import { DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES } from './session.mjs'

/** 명령 → 필수 칸. serve 는 데몬 전용 내부 명령이다. */
export const COMMANDS = Object.freeze({
  tools: [],
  start: ['site'],
  status: ['site'],
  stop: ['site'],
  notices: [],
  serve: ['site'],
})

export class ArgError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArgError'
  }
}

const OPTIONS = {
  site: { type: 'string' },
  provider: { type: 'string' },
  minutes: { type: 'string' },
  'allow-mock': { type: 'boolean' },
  lang: { type: 'string' },
  kind: { type: 'string' },
}

/** argv 를 { command, site?, provider, minutes, allowMock, lang, kind } 로. providers 는 알려진 공급자 id 목록. */
export function parseCliArgs(argv, { providerIds }) {
  let parsed
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true })
  } catch (e) {
    throw new ArgError(e.message)
  }
  const [command, ...extra] = parsed.positionals
  if (!command || !Object.hasOwn(COMMANDS, command)) throw new ArgError(`unknown command: ${JSON.stringify(command)}. Use ${Object.keys(COMMANDS).filter((c) => c !== 'serve').join(' | ')}`)
  if (extra.length) throw new ArgError(`unexpected argument: ${JSON.stringify(extra[0])}`)

  const v = parsed.values
  for (const key of COMMANDS[command]) if (!v[key]) throw new ArgError(`--${key} is required for ${command}`)

  const lang = v.lang ?? 'ko'
  if (!LANGS.includes(lang)) throw new ArgError(`--lang must be one of ${LANGS.join(', ')}: ${JSON.stringify(lang)}`)
  const kind = v.kind ?? 'site'
  if (!KINDS.includes(kind)) throw new ArgError(`--kind must be one of ${KINDS.join(', ')}: ${JSON.stringify(kind)}`)
  const provider = v.provider ?? 'auto'
  if (provider !== 'auto' && !providerIds.includes(provider)) throw new ArgError(`--provider must be auto or one of ${providerIds.join(', ')}: ${JSON.stringify(provider)}`)
  const minutes = v.minutes === undefined ? DEFAULT_MINUTES : Number(v.minutes)
  if (!/^\d+$/.test(v.minutes ?? '0') || !Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    throw new ArgError(`--minutes must be an integer from ${MIN_MINUTES} to ${MAX_MINUTES}: ${JSON.stringify(v.minutes)}`)
  }
  return { command, site: v.site ? resolve(v.site) : undefined, provider, minutes, allowMock: v['allow-mock'] === true, lang, kind }
}
