import { handleTestTossCron } from "@launch-factory/billing-toss"
import { cronAuthorized, unauthorized } from "@/lib/launch/cron"
import { tossTestService } from "@/lib/launch/toss-test"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return unauthorized()
  return await handleTestTossCron(request, cronAuthorized, tossTestService)
}
