// launch-factory: 환경 읽기. 이름만 다루고 값은 어디에도 남기지 않는다.
// LF_MODE 는 항상 필수다 — 없으면 켜지지 않는다(조용히 mock 으로 가지 않는다). live 에서는 공급자 키가 모두 필수다.
import { loadAppEnv, type AppEnv } from "@launch-factory/env"

let cached: AppEnv | undefined

/** 처음 부를 때 한 번 검사한다. 빠진 이름은 모두 모아 한 번에 알린다(값은 싣지 않는다). */
export function env(): AppEnv {
  return (cached ??= loadAppEnv())
}

/** 설정값·비밀값 하나를 읽는다. 없으면 이름만 담아 던진다. */
export function required(name: string): string {
  const value = (env() as Record<string, string | undefined>)[name] ?? process.env[name]
  if (!value) throw new Error(`${name} is not set (see .env.example)`)
  return value
}

/** 없어도 되는 설정값. */
export function optional(name: string): string | undefined {
  return process.env[name] || undefined
}
