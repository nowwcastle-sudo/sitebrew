// 브라우저에서 사람의 버튼 클릭에 연결하는 시험용 토스 SDK 호출.
export interface TestBillingSdk {
  payment(input: { customerKey: string }): { requestBillingAuth(input: { method: "CARD"; windowTarget: "self"; successUrl: string; failUrl: string }): Promise<unknown> }
}
export async function openTestBillingAuth(input: { clientKey: string; customerKey: string; successUrl: string; failUrl: string; origin: string; sdk: (clientKey: string) => TestBillingSdk }): Promise<void> {
  if (typeof input.clientKey !== "string" || typeof input.customerKey !== "string" || typeof input.successUrl !== "string" || typeof input.failUrl !== "string" || typeof input.origin !== "string" || typeof input.sdk !== "function" || !/^test_ck_[A-Za-z0-9_-]+$/.test(input.clientKey) || !/^[A-Za-z0-9_=.@-]{22,50}$/.test(input.customerKey)) throw new Error("Invalid test SDK configuration")
  const origin = new URL(input.origin), success = new URL(input.successUrl), failure = new URL(input.failUrl)
  if (origin.protocol !== "https:" || origin.origin !== input.origin || success.origin !== origin.origin || failure.origin !== origin.origin || success.username || success.password || failure.username || failure.password || success.pathname !== "/api/toss/registration/complete" || failure.pathname !== "/api/toss/registration/fail" || success.hash || failure.hash || success.searchParams.getAll("state").length !== 1 || failure.searchParams.getAll("state").length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(success.searchParams.get("state") ?? "") || success.searchParams.get("state") !== failure.searchParams.get("state")) throw new Error("Invalid registration callback")
  await input.sdk(input.clientKey).payment({ customerKey: input.customerKey }).requestBillingAuth({ method: "CARD", windowTarget: "self", successUrl: success.toString(), failUrl: failure.toString() })
}
