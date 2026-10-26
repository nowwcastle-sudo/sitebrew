// 터널 도구 찾기와 설치 계획(계획 4 Task 2, 모듈 T) — 셸을 부르지 않고 PATH 와 알려진 자리를 ctx.exists 로 본다.
//   · 설치는 하지 않는다: installPlan 은 공급자 표의 단계를 계획으로만 돌려주고, 돌릴지는 사람이 단계마다 정한다(관리자 권한이 필요할 수 있다).
//   · 파일 시스템·환경은 모두 ctx 로 받는다: ctx = { platform, env, exists, osRelease? }.
import { posix, win32 } from 'node:path'

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD'
const DEBIAN_IDS = ['debian', 'ubuntu']

/** PATH 환경 변수 값(Windows 는 Path 라고도 쓴다) */
const pathOf = (env) => env.PATH ?? env.Path ?? env.path ?? ''

/** PATH 와 알려진 자리에서 도구를 찾는다: { found: true, path } | { found: false } */
export function findTool(p, ctx) {
  const os = ctx.platform === 'win32' ? win32 : posix
  const exts = ctx.platform === 'win32' ? (ctx.env.PATHEXT ?? DEFAULT_PATHEXT).split(';').filter(Boolean) : ['']
  for (const dir of pathOf(ctx.env).split(os.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const file = os.join(dir, p.tool + ext)
      if (ctx.exists(file)) return { found: true, path: file }
    }
  }
  for (const file of p.knownPaths?.[ctx.platform] ?? []) if (ctx.exists(file)) return { found: true, path: file }
  return { found: false }
}

/** os-release 글에서 ID·ID_LIKE 낱말을 모은다 */
function osIds(osRelease) {
  const ids = []
  for (const line of String(osRelease ?? '').split('\n')) {
    const m = /^(ID|ID_LIKE)=(.*)$/.exec(line.trim())
    if (m) ids.push(...m[2].replace(/["']/g, '').toLowerCase().split(/\s+/).filter(Boolean))
  }
  return ids
}

/** 설치 계획: { supported, steps, manual? }. 지원하지 않으면 steps 는 비고 manual 은 copy.json 키다. */
export function installPlan(p, ctx) {
  const target = ctx.platform === 'linux' ? (osIds(ctx.osRelease).some((id) => DEBIAN_IDS.includes(id)) ? 'debian' : null) : ctx.platform
  const steps = target ? p.install?.[target] : undefined
  if (!steps || steps.length === 0) return { supported: false, steps: [], manual: 'manualInstall' }
  return { supported: true, steps: steps.map((s) => ({ ...s, argv: [...s.argv] })) }
}
