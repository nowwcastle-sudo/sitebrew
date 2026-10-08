// 비밀값 읽기와 가리기(P3-3 Task 2). 키는 프로세스 환경에서 읽는다. Windows 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 로 켠 때만 쓴다(기본 꺼짐).
//   Windows 사용자 환경은 키를 넣기 전에 뜬 셸도 동작하게 하려는 것이다 — 값은 이 프로세스 안으로만 읽고 찍지 않는다.
//   대상: LAW_API_OC · PEXELS_API_KEY · Vercel 토큰 · POSTHOG_PROJECT_KEY. 값은 로그·오류·보고서 어디에도 싣지 않는다.
import { execFileSync } from 'node:child_process'
import { win32 } from 'node:path'

const NAME = /^[A-Z0-9_]+$/

/**
 * 사용자 키가 담길 수 있는 환경 변수 이름(FINAL-WF S5) — 이 저장소가 readSecret 으로 읽거나 선택 입력으로 받는 것 전부.
 * 서드파티 설치 스크립트(npm install·shadcn add·next build)를 도는 자식 프로세스에는 이 이름을 뺀 환경을 넘긴다(site-install.mjs sh).
 * 이름을 더하면(새 키) 여기에도 더한다 — 시험 stamp-sh.test.mjs 가 소스의 readSecret("…") 이름이 전부 이 목록에 있는지 본다.
 */
export const SECRET_ENV_NAMES = Object.freeze(['LAW_API_OC', 'PEXELS_API_KEY', 'VERCEL_TOKEN', 'POSTHOG_PROJECT_KEY', 'INDEXNOW_KEY', 'HIGGSFIELD_DIR', 'HIGGSFIELD_API_KEY', 'HIGGSFIELD_TOKEN'])

/** 키 이름을 뺀 환경(받은 값은 바꾸지 않는다). HIGGSFIELD_ 로 시작하는 이름도 뺀다. */
export function envWithoutSecrets(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_ENV_NAMES.includes(k) && !/^HIGGSFIELD_/i.test(k)))
}

/**
 * Windows PowerShell 5.1 의 절대 경로(FINAL-WF S5) — 작업 폴더나 PATH 앞쪽에 놓인 다른 powershell.exe 를 실행하지 않게 한다.
 * %SystemRoot% 가 없으면 C:\Windows.
 */
export const powershellPath = (env = process.env) => win32.join(env.SystemRoot || env.SYSTEMROOT || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** 비밀 이름 하나를 읽는다. 없으면 null. 이름은 대문자·숫자·밑줄만 받는다(PowerShell 명령에 끼워 넣기 때문). */
export function readSecret(name, env = process.env, readUser = readWindowsUserEnv) {
  if (!NAME.test(name)) throw new Error(`비밀 이름은 대문자·숫자·밑줄만 쓴다: ${JSON.stringify(name)}`)
  const v = env[name]?.trim()
  if (v) return v
  // 공개판: 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 일 때만 한다.
  if (env.FACTORY_USER_ENV !== '1') return null
  return readUser(name)
}

function readWindowsUserEnv(name) {
  if (process.platform !== 'win32') return null
  try {
    const out = execFileSync(powershellPath(env), ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::GetEnvironmentVariable('${name}','User')`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.trim() || null
  } catch {
    return null
  }
}

/**
 * 문장에서 비밀값을 `***`로 바꾼다. `secrets`는 readSecret 이 돌려준 **값**들이다(이름이 아니다 — 이름은 안내 문장에 남아야 한다).
 * URL 에 인코딩돼 들어간 모양도 가린다. 빈 값·null 은 건너뛴다.
 */
export function maskSecrets(text, secrets) {
  let out = String(text)
  const forms = new Set()
  for (const s of secrets ?? []) {
    if (!s) continue
    forms.add(String(s))
    forms.add(encodeURIComponent(String(s)))
  }
  // 긴 것부터 — 한 값이 다른 값을 품을 때 조각이 남지 않게.
  for (const f of [...forms].sort((a, b) => b.length - a.length)) out = out.split(f).join('***')
  return out
}
