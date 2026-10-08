// 결제 창을 마친 직후 구독을 바로 맞추는 연결(LFFIX F3). 판단은 lib/billing-return-core.ts. live 에서만 불러온다(lib/ports.live.ts). 서버 전용이다.
import { createPaddleClient } from "@launch-factory/billing-paddle"
import { billing } from "@/lib/launch/billing"
import { required } from "@/lib/launch/env"
import { syncAfterCheckout, type SyncResult } from "@/lib/billing-return-core"

export async function syncCheckoutFor(userId: string, transactionId: unknown): Promise<SyncResult> {
  const paddle = createPaddleClient({ apiKey: required("PADDLE_API_KEY"), env: process.env.LF_PADDLE_LIVE === "1" ? "production" : "sandbox" })
  const b = await billing()
  return syncAfterCheckout(userId, transactionId, {
    getTransaction: (id) => paddle.transactions.get(id),
    resync: (subscriptionId) => b.resync(subscriptionId),
    subscription: () => b.port({ userId }).subscription(),
    customerEmail: async (customerId) => (await paddle.customers.get(customerId)).email,
  })
}
