// launch-factory: Cron 경로 인증. Vercel Cron 은 CRON_SECRET 이 있으면 `Authorization: Bearer <값>` 을 붙여 부른다
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs). 값이 없거나 다르면 거절한다 — 비밀이 없으면 열어 두지 않는다.
import { timingSafeEqual } from "node:crypto"

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = request.headers.get("authorization") ?? ""
  const want = `Bearer ${secret}`
  return given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want))
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 })
