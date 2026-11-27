// launch-factory: 환경 읽기. 이름만 다루고 값은 어디에도 남기지 않는다.
// LF_MODE 는 항상 필수다 — 없으면 켜지지 않는다(조용히 mock 으로 가지 않는다). live 에서는 공급자 키가 모두 필수다.
import { loadAppEnv, type AppEnv } from "@launch-factory/env"
import { isAbsolute, join } from "node:path"

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

/** 공식 토스 시험 연결과 파일 DB는 같은 설정 검사를 통과해야 한다. */
export function tossSandboxSettings(source: Record<string, string | undefined> = process.env) {
  if (source.NODE_ENV !== "development" || source.LF_MODE !== "mock" || source.LF_TOSS_TEST !== "1" || source.LF_TOSS_TEST_FAKE !== "0") return null
  const clientKey = source.TOSS_TEST_CLIENT_KEY, secretKey = source.TOSS_TEST_SECRET_KEY
  const merchantId = source.TOSS_TEST_MERCHANT_ID, directory = source.TOSS_TEST_DB_DIRECTORY
  const encryption = source.TOSS_TEST_ENCRYPTION_KEY, origin = source.NEXT_PUBLIC_APP_URL
  if (!clientKey || clientKey === "test_ck_fake" || !/^test_ck_[A-Za-z0-9_-]+$/.test(clientKey) ||
      !secretKey || secretKey === "test_sk_fake" || !/^test_sk_[A-Za-z0-9_-]+$/.test(secretKey) ||
      !merchantId || !/^[A-Za-z0-9_-]{1,100}$/.test(merchantId) || !directory || !isAbsolute(directory) ||
      !encryption || !/^[0-9a-fA-F]{64}$/.test(encryption) || !origin) return null
  try {
    const url = new URL(origin)
    if (url.protocol !== "https:" || url.origin !== origin) return null
    return { origin, clientKey, secretKey, merchantId, encryptionKey: Buffer.from(encryption, "hex"), dataDir: join(directory, merchantId) }
  } catch { return null }
}
