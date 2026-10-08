// launch-factory: 로그인 없이 누르는 메일 링크(수신거부 · 계속 받기 · 가입 안 했어요)의 서명 비밀.
// 앱 비밀(BETTER_AUTH_SECRET)에서 용도를 섞어 파생한 값이라 세션 서명과 섞이지 않는다(HMAC 입력이 다르다). 새 환경 변수를 만들지 않는다.
// live 는 BETTER_AUTH_SECRET(32자 이상)이 필수다. mock 에서 없으면 프로세스마다 새로 만든다 — 재시작하면 그 전에 만든 링크는 열리지 않는다(개발 중에만 그렇다).
import { createHmac, randomBytes } from "node:crypto"
import { env, required } from "@/lib/launch/env"

let mockBase: string | undefined

export function linkSecret(): string {
  const e = env()
  const base = e.LF_MODE === "live" ? required("BETTER_AUTH_SECRET") : (e.BETTER_AUTH_SECRET ?? (mockBase ??= randomBytes(32).toString("hex")))
  return createHmac("sha256", base).update("lf-mail-links-v1").digest("hex")
}
