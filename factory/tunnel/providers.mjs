// 임시 공개 주소 공급자 표 읽기(계획 4 Task 1, 모듈 P) — providers.json 을 읽어 모양을 검사하고,
//   포트를 채운 도구 인자(providerArgs)와 도구 출력에서 공개 주소 찾기(findUrl)를 낸다.
//   · 책임은 여기까지다: 도구가 있는지(tools.mjs)·프로세스 띄우기(open-tunnel.mjs)·사용자 문장(notices.mjs)은 다른 모듈 몫.
//   · 파일 읽기는 loadProviders 한 곳뿐이고 나머지는 순수 함수다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PROVIDERS_FILE = fileURLToPath(new URL('./providers.json', import.meta.url))
const PORT_SLOT = '{port}'
const TRAILING = /[.,)\]>'"]+$/

const bad = (id, what) => new Error(`providers.json: ${id}: ${what}`)
const isStrings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string')

/** 설치 단계 하나의 모양 검사 */
function checkStep(id, step) {
  if (!step || typeof step !== 'object') throw bad(id, 'install step must be an object')
  if (!isStrings(step.argv) || step.argv.length === 0) throw bad(id, 'install step argv must be a non-empty string array')
  if (typeof step.needsAdmin !== 'boolean') throw bad(id, 'install step needsAdmin must be boolean')
  if (typeof step.textKey !== 'string' || !step.textKey) throw bad(id, 'install step textKey must be a string')
}

/** 공급자 하나의 모양 검사 — 통과하면 id 를 더한 사본을 돌려준다 */
function checkProvider(id, raw) {
  if (!raw || typeof raw !== 'object') throw bad(id, 'must be an object')
  if (typeof raw.tool !== 'string' || !raw.tool) throw bad(id, 'tool must be a string')
  if (!isStrings(raw.args) || !raw.args.some((a) => a.includes(PORT_SLOT))) throw bad(id, `args must be strings with a ${PORT_SLOT} slot`)
  try {
    new RegExp(raw.urlPattern, 'i')
  } catch {
    throw bad(id, 'urlPattern must be a valid RegExp source')
  }
  if (!isStrings(raw.ignore ?? [])) throw bad(id, 'ignore must be a string array')
  for (const k of ['readyMs', 'reachMs']) if (!Number.isInteger(raw[k]) || raw[k] <= 0) throw bad(id, `${k} must be a positive integer`)
  if (!isStrings(raw.limits)) throw bad(id, 'limits must be a string array')
  for (const [os, steps] of Object.entries(raw.install ?? {})) {
    if (!Array.isArray(steps)) throw bad(id, `install.${os} must be an array`)
    for (const s of steps) checkStep(id, s)
  }
  return { ...raw, id, ignore: raw.ignore ?? [] }
}

/** 공급자 표를 읽고 검사한다: { default, order, providers: { [id]: Provider } } */
export function loadProviders(file = PROVIDERS_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const providers = Object.fromEntries(Object.entries(raw.providers ?? {}).map(([id, p]) => [id, checkProvider(id, p)]))
  if (Object.keys(providers).length === 0) throw new Error('providers.json: no providers')
  if (!Array.isArray(raw.order) || raw.order.length === 0 || raw.order.some((id) => !providers[id])) throw new Error('providers.json: order must list known provider ids')
  if (!providers[raw.default]) throw new Error('providers.json: default must be a known provider id')
  return { default: raw.default, order: raw.order, providers }
}

/** 포트를 채운 도구 인자. 포트는 1~65535 정수만 받는다(사용자 값이 인자에 섞이지 않게). */
export function providerArgs(p, port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`port must be an integer from 1 to 65535: ${JSON.stringify(port)}`)
  return p.args.map((a) => a.split(PORT_SLOT).join(String(port)))
}

/** 도구 출력에서 첫 공개 주소를 찾는다. 제외 목록의 호스트와 끝의 구두점은 주소가 아니다. 없으면 null. */
export function findUrl(p, text) {
  const re = new RegExp(p.urlPattern, 'gi')
  const ignore = new Set((p.ignore ?? []).map((h) => h.toLowerCase()))
  for (const m of String(text ?? '').matchAll(re)) {
    const url = m[0].replace(TRAILING, '')
    const host = url.replace(/^https?:\/\//i, '').toLowerCase()
    if (!ignore.has(host)) return url
  }
  return null
}
