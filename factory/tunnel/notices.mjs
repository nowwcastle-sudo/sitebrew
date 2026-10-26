// 사용자 문장 모듈(계획 4 Task 4, 모듈 N) — copy.json 의 문장을 상황에 맞게 고른다.
//   · 문장은 코드에 없고 copy.json(ko·en) 한 곳에 있다. 이 모듈은 어떤 문장을 어떤 순서로 낼지만 정한다.
//   · notices: 주소를 열 때 항상 알리는 문장(누구나 열 수 있음·닫히는 때·주소가 바뀜·가짜 데이터) + 제품형 경고 + 공급자 한계 + 오래 가는 주소 안내.
//   · failure: 실패 이유 키 → 문장. guide: 챗봇 환경에서 「내 컴퓨터에서 주소 만들기」로 넘기는 짧은 안내.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadProviders } from './providers.mjs'

export const COPY_FILE = fileURLToPath(new URL('./copy.json', import.meta.url))
export const LANGS = ['ko', 'en']
export const KINDS = ['site', 'product']
const ALWAYS = ['publicAnyone', 'closesWhen', 'addressChanges', 'fakeDataOnly']
const INSTALL_BY_PLATFORM = { win32: 'installWinget', darwin: 'installBrew', linux: 'manualInstall' }

let rawCopy
/** copy.json 원본(그룹별) — 한 번만 읽는다 */
function loadRaw() {
  rawCopy ??= JSON.parse(readFileSync(COPY_FILE, 'utf8'))
  return rawCopy
}

let flat
/** 그룹을 가로질러 한 겹으로 편 표: { [key]: { ko, en } } */
function flatCopy() {
  flat ??= flatten(loadRaw())
  return flat
}

/** 그룹 → 평면. 키가 겹치면 던진다 */
function flatten(raw) {
  const out = {}
  for (const [group, entries] of Object.entries(raw)) {
    if (group.startsWith('_')) continue
    for (const [key, value] of Object.entries(entries)) {
      if (key in out) throw new Error(`copy.json: duplicate key ${key}`)
      out[key] = value
    }
  }
  return out
}

function assertLang(lang) {
  if (!LANGS.includes(lang)) throw new Error(`lang must be one of ${LANGS.join(', ')}: ${JSON.stringify(lang)}`)
}

/** 키 하나의 문장 */
export function text(lang, key) {
  assertLang(lang)
  const entry = flatCopy()[key]
  if (!entry) throw new Error(`unknown copy key: ${JSON.stringify(key)}`)
  return entry[lang]
}

/** 공급자 인자(객체 또는 id)에서 limits 키 목록을 얻는다 */
function limitsOf(provider) {
  if (provider === undefined || provider === null) return []
  if (typeof provider === 'string') {
    const found = loadProviders().providers[provider]
    if (!found) throw new Error(`unknown provider: ${JSON.stringify(provider)}`)
    return found.limits
  }
  return provider.limits ?? []
}

/** 주소를 열 때 알리는 문장들. 항상 앞 네 문장, 제품형이면 가짜 로그인 공유, 그다음 공급자 한계, 마지막에 오래 가는 주소. */
export function notices({ lang, kind, provider, minutes }) {
  assertLang(lang)
  if (!KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}: ${JSON.stringify(kind)}`)
  if (!Number.isInteger(minutes) || minutes < 1) throw new Error(`minutes must be a positive integer: ${JSON.stringify(minutes)}`)
  const keys = [...ALWAYS, ...(kind === 'product' ? ['mockShared'] : []), ...limitsOf(provider), 'longTerm']
  return keys.map((key) => text(lang, key).split('{minutes}').join(String(minutes)))
}

/** 실패 이유 키의 문장(failures 그룹의 키만) */
export function failure(lang, key) {
  assertLang(lang)
  const entry = loadRaw().failures?.[key]
  if (!entry) throw new Error(`unknown failure key: ${JSON.stringify(key)}`)
  return entry[lang]
}

/** 챗봇 환경 안내 문장들: 소개 + (플랫폼이 있으면) 설치 문장 + 실행 순서 */
export function guide(lang, { platform } = {}) {
  assertLang(lang)
  const install = INSTALL_BY_PLATFORM[platform]
  return [text(lang, 'guideIntro'), ...(install ? [text(lang, install)] : []), text(lang, 'guideRun')]
}
