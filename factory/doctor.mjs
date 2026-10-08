// 실행 전 점검(J14, P3-3 Task 2): 단계마다 필요한 키·도구가 **지금 실제로 동작하는지** 가벼운 실호출 1회로 본다.
//   node factory/doctor.mjs --stage stamp|legal|media|publish|learn [--strict]
//   종료 코드: 0 = 전부 ok · 1 = 하나라도 실패(줄마다 무엇을·어디서·어느 이름으로) · 2 = 인자 오류.
//   키는 프로세스 환경에서 읽고(secret-env; Windows 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 일 때만), 값은 어떤 출력에도 싣지 않는다.
//   찍어내기는 doctor 가 0일 때만 시작한다.
//
// 선택 항목(D24 · 키가 하나도 없는 사용자): LAW_API_OC · PEXELS_API_KEY · HIGGSFIELD_DIR 는 **없어도** 공장이 돈다 — 느슨한 모드(기본)에서는
//   없을 때 실패가 아니라 `note` 줄(한국어 한 줄 + 영어 한 줄: 무엇이 꺼지는지)로 알리고 0 으로 끝난다. 사이트는 미리보기 모드로 만들어진다.
//   엄격 모드(--strict 또는 WF_REQUIRE_KEYS=1)는 예전 그대로다: 없으면 실패한다(법률 검토를 조용히 건너뛰는 일을 막으려는 운영자용).
//   키가 **있는데** 호출이 실패하면(잘못된 키·망 끊김) 느슨한 모드에서도 실패다 — 없는 것과 틀린 것은 다르다.
import { spawn } from 'node:child_process'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSecret as readSecretEnv, maskSecrets } from './lib/secret-env.mjs'
import { designRulesPath, designRulesRoot, absentNoteParts } from './lib/design-rules.mjs'

export const STAGES = ['stamp', 'legal', 'media', 'publish', 'learn']
export const TIMEOUT_MS = 10_000
export const LAW_SEARCH_URL = 'https://www.law.go.kr/DRF/lawSearch.do'
export const LAW_PROBE_QUERY = '개인정보 보호법'
export const PEXELS_WHERE = 'pexels.com/api'

export const missingKey = (name, where) => `도구 실패: ${name} 없음 — ${where}에서 발급해 환경 변수 ${name}로 넣는다`

/** 엄격 모드(운영자용): WF_REQUIRE_KEYS=1. */
export const strictFromEnv = (env = process.env) => env.WF_REQUIRE_KEYS === '1'

// 느슨한 모드에서 「없음」을 알리는 note 결과(통과). message = 한국어 한 줄, messageEn = 영어 한 줄.
const note = (ko, en) => ({ ok: true, note: true, message: ko, messageEn: en })

async function getJson(ctx, url, init = {}) {
  const r = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!r.ok) throw new Error(`HTTP ${r.status ?? '?'}`)
  try {
    return await r.json()
  } catch {
    throw new Error('응답이 JSON 이 아니다')
  }
}

// 점검 하나 = { id, run(ctx) → { ok, message, note?, messageEn? } }. 예외는 runDoctor 가 실패 줄로 바꾼다(guide 를 붙여).
const lawCheck = {
  id: 'LAW_API_OC',
  guide: 'open.law.go.kr 에서 OC 가 Open API 사용 신청돼 있는지 확인한다(이름: 환경 변수 LAW_API_OC)',
  async run(ctx) {
    const key = ctx.readSecret('LAW_API_OC')
    if (!key) {
      if (ctx.strict) return { ok: false, message: missingKey('LAW_API_OC', 'open.law.go.kr(Open API 신청)') }
      return note(
        '선택: LAW_API_OC 없음 — 법령 대조를 못 해 법정 쪽(약관·개인정보 처리방침)이 「검토 안 됨」으로 남고 공개할 수 없다. 미리보기는 만들어진다. 키는 open.law.go.kr 에서 신청한다.',
        'optional: LAW_API_OC not set - legal pages cannot be checked against the law and stay "unverified" (not publishable); previews are still built. Request a key at open.law.go.kr.',
      )
    }
    const q = new URLSearchParams({ OC: key, target: 'law', type: 'JSON', query: LAW_PROBE_QUERY })
    const body = await getJson(ctx, `${LAW_SEARCH_URL}?${q}`)
    if (!body || typeof body.LawSearch !== 'object') return { ok: false, message: `도구 실패: 법령 검색 응답 모양이 바뀌었다(LawSearch 없음) — ${LAW_SEARCH_URL}. ${this.guide}` }
    const n = Number(body.LawSearch.totalCnt)
    if (!(n >= 1)) return { ok: false, message: `법령 검색 「${LAW_PROBE_QUERY}」 결과 ${Number.isFinite(n) ? n : '?'}건 — ${LAW_SEARCH_URL} 가 키를 받았지만 결과가 없다. ${this.guide}` }
    return { ok: true, message: `법령 검색 동작 — 「${LAW_PROBE_QUERY}」 ${n}건` }
  },
}

const pexelsCheck = {
  id: 'PEXELS_API_KEY',
  guide: 'pexels.com/api 에서 키 상태를 확인한다(이름: 환경 변수 PEXELS_API_KEY)',
  async run(ctx) {
    const key = ctx.readSecret('PEXELS_API_KEY')
    if (!key) {
      if (ctx.strict) return { ok: false, message: missingKey('PEXELS_API_KEY', PEXELS_WHERE) }
      return note(
        '선택: PEXELS_API_KEY 없음 — 스톡 사진·영상을 받지 않고 그 칸은 「이미지 준비 중」 틀로 남는다. 사이트는 만들어진다. 키는 pexels.com/api 에서 받는다.',
        'optional: PEXELS_API_KEY not set - stock photo/video slots are not fetched and stay as "image in progress" placeholders; the site is still built. Get a key at pexels.com/api.',
      )
    }
    const body = await getJson(ctx, 'https://api.pexels.com/v1/search?query=nature&per_page=1', { headers: { Authorization: key } })
    const n = Array.isArray(body?.photos) ? body.photos.length : 0
    if (n < 1) return { ok: false, message: `Pexels 검색 결과 0건 — api.pexels.com/v1/search. ${this.guide}` }
    return { ok: true, message: `Pexels 검색 동작 — ${n}건` }
  },
}

const higgsfieldCheck = {
  id: 'HIGGSFIELD_DIR',
  guide: 'Higgsfield 원본 폴더를 만들거나 경로를 환경 변수 HIGGSFIELD_DIR 로 넣는다',
  async run(ctx) {
    const explicit = ctx.env.HIGGSFIELD_DIR?.trim()
    const dir = explicit || ctx.designRulesPath('factory/media/higgsfield')
    const absent = () => note(
      '선택: HIGGSFIELD_DIR 없음 — 생성 이미지 칸은 만들지 않고 higgsfield.request.json 요청으로 남긴다. 생성한 파일 폴더를 HIGGSFIELD_DIR 로 넣으면 쓴다.',
      'optional: HIGGSFIELD_DIR not set - generated-image slots are not produced; they are written to higgsfield.request.json as requests. Point HIGGSFIELD_DIR at a folder of generated files to use them.',
    )
    if (!dir) return ctx.strict ? { ok: false, message: `도구 실패: Higgsfield 원본 폴더 없음(HIGGSFIELD_DIR 미설정) — ${this.guide}` } : absent()
    if (!ctx.isDir(dir)) {
      // 직접 가리킨 경로가 틀렸거나 엄격 모드면 실패. 비공개 자료 폴더 아래 기본 자리에 없는 것은 「없음」이다.
      if (explicit || ctx.strict) return { ok: false, message: `도구 실패: Higgsfield 원본 폴더 없음(${dir}) — ${this.guide}` }
      return absent()
    }
    return { ok: true, message: `Higgsfield 원본 폴더 있음(${dir})` }
  },
}

// 3D 오브젝트 히어로(object-3d-orbit)의 재료(FV1 3D-GEN): 3D 는 이미지에서 시작한다. 원본 이미지를 만들 길 — Higgsfield 폴더(HIGGSFIELD_DIR) 또는 Codex CLI 이미지 생성(WF_CODEX_IMAGES=1, codex 설치·로그인) — 이 하나도 없으면
// 모델 대신 2.5D(이미지는 사용자가 직접 주면), 이미지도 없으면 포스터만 그리고 03 은 이 히어로를 고르지 않는다. 막는 것이 아니라 알리는 것이라 엄격 모드에서도 실패가 아니다(종료 코드 그대로).
const objectHeroCheck = {
  id: '3D_OBJECT_HERO',
  guide: 'HIGGSFIELD_DIR 에 Higgsfield 원본 폴더를 두거나, WF_CODEX_IMAGES=1 과 codex 로그인으로 Codex CLI 이미지 생성을 켠다',
  async run(ctx) {
    const hf = ctx.env.HIGGSFIELD_DIR?.trim() || ctx.designRulesPath('factory/media/higgsfield')
    if (hf && ctx.isDir(hf)) return { ok: true, message: '3D 오브젝트 히어로 재료 있음 — Higgsfield 원본 폴더로 이미지·모델을 쓴다' }
    if (ctx.env.WF_CODEX_IMAGES === '1') {
      const { code } = await ctx.exec('codex', ['--version'])
      if (code === 0) return { ok: true, message: '3D 오브젝트 히어로 재료 있음 — Codex CLI 이미지 생성(WF_CODEX_IMAGES=1)으로 이미지를 만든다(모델은 이미지-3D 변환 도구가 필요하다)' }
    }
    return note(
      '선택: 3D 오브젝트 히어로(object-3d-orbit) — 모델 대신 2.5D/포스터, 이미지도 없으면 이 히어로를 고르지 않는다. 재료(Higgsfield 폴더 HIGGSFIELD_DIR · Codex 이미지 생성 WF_CODEX_IMAGES=1)가 없다.',
      'optional: 3D object hero (object-3d-orbit) - 2.5D/poster instead of a model; with no image at all this hero is not chosen. No source found (Higgsfield folder HIGGSFIELD_DIR / Codex image generation WF_CODEX_IMAGES=1).',
    )
  },
}

const vercelCheck = {
  id: 'vercel',
  guide: '`npm i -g vercel` 로 설치하고 `vercel login` 으로 로그인한다(토큰을 쓰면 환경 변수 VERCEL_TOKEN)',
  async run(ctx) {
    const { code } = await ctx.exec('vercel', ['whoami'])
    if (code !== 0) return { ok: false, message: `도구 실패: vercel whoami 종료 ${code} — Vercel CLI 로그인 안 됨. ${this.guide}` }
    return { ok: true, message: 'Vercel CLI 로그인됨' }
  },
}

const posthogCheck = {
  id: 'POSTHOG_PROJECT_KEY',
  async run(ctx) {
    if (!ctx.readSecret('POSTHOG_PROJECT_KEY')) return { ok: false, message: missingKey('POSTHOG_PROJECT_KEY', 'PostHog 프로젝트 설정(Project API key)') }
    return { ok: true, message: 'PostHog 프로젝트 키 있음' }
  },
}

export const CHECKS = {
  legal: [lawCheck],
  media: [pexelsCheck, higgsfieldCheck, objectHeroCheck],
  publish: [vercelCheck],
  learn: [posthogCheck],
}
CHECKS.stamp = [...CHECKS.legal, ...CHECKS.media]

// 기본 exec: 비동기 spawn(결과 코드만 쓴다 — 출력은 버린다. whoami 는 계정 이름을 찍는다).
function execDefault(cmd, args) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { shell: process.platform === 'win32', stdio: 'ignore', timeout: TIMEOUT_MS, windowsHide: true })
    p.on('error', () => done({ code: -1 }))
    p.on('close', (code) => done({ code: code ?? -1 }))
  })
}
const isDirDefault = (p) => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/**
 * deps.strict(기본 true — 함수를 직접 부르는 쪽은 예전 그대로 엄격하다): false 면 선택 키·폴더가 없을 때 실패 대신 note 로 통과한다.
 * @returns {Promise<{ ok: boolean, results: { id: string, ok: boolean, message: string, note?: boolean, messageEn?: string }[] }>}
 */
export async function runDoctor(stage, deps = {}) {
  if (!CHECKS[stage]) throw new Error(`모르는 단계: ${stage} (${STAGES.join('|')})`)
  const seen = []
  const read = deps.readSecret ?? readSecretEnv
  const env = deps.env ?? process.env
  const ctx = {
    fetch: deps.fetch ?? globalThis.fetch,
    exec: deps.exec ?? execDefault,
    isDir: deps.isDir ?? isDirDefault,
    env,
    strict: deps.strict ?? true,
    designRulesPath: (rel) => designRulesPath(rel, { env }),
    readSecret: (name) => {
      const v = read(name)
      if (v) seen.push(v)
      return v
    },
  }
  const results = []
  for (const c of CHECKS[stage]) {
    let r
    try {
      r = await c.run(ctx)
    } catch (e) {
      r = { ok: false, message: `도구 실패: ${c.id} 점검 호출 실패(${e?.name === 'TimeoutError' ? `${TIMEOUT_MS / 1000}초 초과` : e?.message ?? e})${c.guide ? ` — ${c.guide}` : ''}` }
    }
    results.push({
      id: c.id,
      ok: r.ok === true,
      message: maskSecrets(r.message, seen),
      ...(r.note ? { note: true, messageEn: maskSecrets(r.messageEn ?? '', seen) } : {}),
    })
  }
  return { ok: results.every((r) => r.ok), results }
}

/** 점검 결과 밖의 선택 자료 안내(WF_DESIGN_RULES_DIR 없음) — 통과를 바꾸지 않는다. { id, ko, en }[] */
export function optionalDataNotes(env = process.env) {
  const root = designRulesRoot({ env })
  if (root.dir) return []
  const { ko, en } = absentNoteParts('디자인 규칙 자료 폴더(시각 기준·원천 수집)', 'design-rules data folder (visual baselines, source collections)')
  return [{ id: 'WF_DESIGN_RULES_DIR', ko, en }]
}

/** 결과 줄(사람용). note 는 한국어 줄 + 영어 줄 둘. */
export function formatResult(r) {
  if (r.note) return [`note ${r.id} — ${r.message}`, `     ${r.id} — ${r.messageEn}`]
  return [`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} — ${r.message}`]
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  const argv = process.argv.slice(2)
  const strictFlag = argv.includes('--strict')
  const rest = argv.filter((a) => a !== '--strict')
  const i = rest.indexOf('--stage')
  const stage = i >= 0 ? rest[i + 1] : undefined
  // process.exit() 대신 exitCode — fetch 소켓이 닫히는 중에 끊으면 Windows 에서 libuv 단언으로 죽는다(종료 127).
  if (!STAGES.includes(stage) || rest.length !== 2) {
    console.error(`사용법: node factory/doctor.mjs --stage ${STAGES.join('|')} [--strict]`)
    process.exitCode = 2
  } else {
    try {
      const { ok, results } = await runDoctor(stage, { strict: strictFlag || strictFromEnv() })
      for (const r of results) for (const line of formatResult(r)) console.log(line)
      for (const n of optionalDataNotes()) {
        console.log(`note ${n.id} — ${n.ko}`)
        console.log(`     ${n.id} — ${n.en}`)
      }
      const notes = results.filter((r) => r.note).length
      console.log(`doctor --stage ${stage}: ${results.filter((r) => r.ok).length}/${results.length} ok${notes ? ` (선택 ${notes}개 꺼짐 / ${notes} optional off)` : ''}`)
      process.exitCode = ok ? 0 : 1
    } catch (e) {
      console.error(`도구 실패: ${e.message}`)
      process.exitCode = 1
    }
  }
}
