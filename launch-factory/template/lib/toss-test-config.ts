import { tossSandboxSettings } from "./launch/env.ts"

// 템플릿 자체 시험은 허용한다. compose는 명시적 선택이 없으면 이 상수를 false로 고정한다.
const TOSS_COMPOSE_ENABLED = true
// 공식 시험 상점도 개발 mock에서만 열며, test_ck/test_sk만 받는다.
export function tossTestConfig(source: Record<string, string | undefined> = process.env) {
  if (!TOSS_COMPOSE_ENABLED || source.NODE_ENV !== "development" || source.LF_MODE !== "mock" || source.LF_TOSS_TEST !== "1" || !["0", "1"].includes(source.LF_TOSS_TEST_FAKE ?? "")) return null
  const fake = source.LF_TOSS_TEST_FAKE === "1"
  if (!fake) {
    const sandbox = tossSandboxSettings(source)
    return sandbox && { ...sandbox, fake: false as const }
  }
  const clientKey = source.TOSS_TEST_CLIENT_KEY ?? "", secretKey = source.TOSS_TEST_SECRET_KEY ?? ""
  if (!/^[0-9a-fA-F]{64}$/.test(source.TOSS_TEST_ENCRYPTION_KEY ?? "")) return null
  if (clientKey !== "test_ck_fake" || secretKey !== "test_sk_fake") return null
  try {
    const url = new URL(source.NEXT_PUBLIC_APP_URL ?? "")
    if (url.protocol !== "https:" || url.origin !== source.NEXT_PUBLIC_APP_URL || url.username || url.password) return null
    return { origin: url.origin, clientKey, secretKey, fake, merchantId: "fake-mid", encryptionKey: Buffer.from(source.TOSS_TEST_ENCRYPTION_KEY as string, "hex") }
  } catch { return null }
}

/** 인증 서버가 검증한 결과만 받는다. 대리 세션은 결제 등록에 쓸 수 없다. */
export function ownTossTestSession(result: { ok: boolean; data?: { userId: string; impersonatedBy?: string } | null }) {
  if (!result.ok || !result.data || result.data.impersonatedBy) return null
  return { userId: result.data.userId }
}
