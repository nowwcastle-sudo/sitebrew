// 비밀값 읽기와 가리기. 규칙은 web-factory `factory/lib/secret-env.mjs`(P3-3 Task 2)와 같다 — 코드를 옮기지 않고 규칙만 따른다.
//   읽는 순서: 프로세스 환경 → Windows 사용자 환경(개발 기계만. 키를 넣기 전에 뜬 셸도 동작하게).
//   값은 이 프로세스 안으로만 읽고 로그·오류·보고서에 싣지 않는다.
//   child_process 를 쓰므로 Node 런타임 전용이다(Edge 런타임에서 부르지 않는다).
import { execFileSync } from "node:child_process"

const NAME = /^[A-Z0-9_]+$/

/**
 * Windows PowerShell 5.1 의 절대 경로. 이름만 부르면 작업 폴더·PATH 앞쪽에 놓인 powershell.exe 가 대신 실행될 수 있어(키를 읽는 자리라 위험하다)
 * System32 의 실행 파일을 직접 가리킨다. SystemRoot 가 없거나 비어 있으면 C:\Windows.
 */
export function windowsPowerShellPath(env: Record<string, string | undefined> = process.env): string {
  const root = env.SystemRoot?.trim() || "C:\\Windows"
  return `${root.replace(/[\\/]+$/, "")}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
}

export type UserEnvReader =(names: readonly string[]) => Record<string, string | null>

function assertName(name: string): void {
  // PowerShell 명령에 끼워 넣기 때문에 이름 모양을 먼저 막는다.
  if (!NAME.test(name)) throw new Error(`비밀 이름은 대문자·숫자·밑줄만 쓴다: ${JSON.stringify(name)}`)
}

/**
 * Windows 사용자 환경에서 이름 여러 개를 PowerShell 한 번으로 읽는다. Windows 가 아니거나 실패하면 모두 null.
 * `LF_NO_USER_ENV=1` 이면 읽지 않는다(doctor 의 `--no-user-env` 와 같은 뜻) — 프로세스 환경에서 키를 지워도 이 기계의 사용자 환경이
 * 다시 채워 넣기 때문에, 「키 없음」 동작을 시험하는 쪽(registry-install 의 키 없는 웹훅 500)이 이 값으로 끈다.
 */
export const windowsUserEnv: UserEnvReader = (names) => {
  const out: Record<string, string | null> = Object.fromEntries(names.map((n) => [n, null]))
  // 공개판: 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 일 때만 한다(기본 꺼짐).
  if (process.platform !== "win32" || names.length === 0 || process.env.LF_NO_USER_ENV === "1" || process.env.FACTORY_USER_ENV !== "1") return out
  names.forEach(assertName)
  const list = names.map((n) => `'${n}'`).join(",")
  const script = `$o=@{}; foreach($n in @(${list})){ $o[$n]=[Environment]::GetEnvironmentVariable($n,'User') }; $o | ConvertTo-Json -Compress`
  try {
    const raw = execFileSync(windowsPowerShellPath(), ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>
    for (const n of names) {
      const v = parsed[n]
      out[n] = typeof v === "string" && v.trim() ? v.trim() : null
    }
  } catch {
    // 읽지 못하면 없는 것으로 본다. 원인(값 포함 가능)은 싣지 않는다.
  }
  return out
}

type Env = Record<string, string | undefined>

/** 비밀 이름 하나를 읽는다. 없으면 null. */
export function readSecret(name: string, env: Env = process.env, userEnv: (name: string) => string | null = (n) => windowsUserEnv([n])[n] ?? null): string | null {
  assertName(name)
  const v = env[name]?.trim()
  if (v) return v
  return userEnv(name)?.trim() || null
}

/** 여러 이름을 읽어 환경 모양으로 돌려준다. 프로세스 환경에 없는 이름만 사용자 환경에서 한 번에 읽는다. */
export function readSecrets(names: readonly string[], env: Env = process.env, userEnv: UserEnvReader = windowsUserEnv): Env {
  names.forEach(assertName)
  const out: Env = {}
  const rest: string[] = []
  for (const n of names) {
    const v = env[n]?.trim()
    if (v) out[n] = v
    else rest.push(n)
  }
  if (rest.length) {
    const found = userEnv(rest)
    for (const n of rest) if (found[n]) out[n] = found[n] ?? undefined
  }
  return out
}

/**
 * 문장에서 비밀값을 `***`로 바꾼다. `secrets`는 **값**들이다(이름이 아니다 — 이름은 안내 문장에 남아야 한다).
 * URL 에 인코딩돼 들어간 모양도 가린다. 빈 값·null 은 건너뛴다.
 */
export function maskSecrets(text: unknown, secrets: Iterable<string | null | undefined> | null | undefined): string {
  let out = String(text)
  const forms = new Set<string>()
  for (const s of secrets ?? []) {
    if (!s) continue
    forms.add(String(s))
    forms.add(encodeURIComponent(String(s)))
  }
  // 긴 것부터 — 한 값이 다른 값을 품을 때 조각이 남지 않게.
  for (const f of [...forms].sort((a, b) => b.length - a.length)) out = out.split(f).join("***")
  return out
}
