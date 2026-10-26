// 가짜 문의 접수(소개형 전달물 — deliver-intro.mjs 가 더한다). 진짜 메일은 보내지 않는다: 받은 문의를 콘솔에 한 줄 적고,
// 환경 변수 LF_MOCK_OUTBOX 가 있으면 그 파일에 가짜 메일 기록(OutboxLine 한 줄 — id·template·to·subject·at, 본문 없음)을 덧붙인다.
// 진짜 접수는 launch-factory 를 붙일 때 이 파일을 지우고 inquiry 기능이 대신한다. 정적 내보내기에는 들어가지 않는다(next.config.ts 가 빌드하는 동안 이 폴더를 옆으로 치웠다가 되돌린다).
// 사용자에게 보이는 문장은 lib/inquiry-copy.json(deliver-copy.json 의 inquiryRuntime 사본)에 있다.
import { randomUUID } from "node:crypto"
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import { NEEDS_CHECK_LITERALS, isMailAddress } from "@/components/content/content-core"
import copy from "@/lib/inquiry-copy.json"
import { contentAt, locale } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TEMPLATE = "inquiryNotice"
const MAX_BYTES = 16_384
type SayKey = "badBody" | "tooBig" | "noOwner" | "writeFailed"

const usable = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && !(NEEDS_CHECK_LITERALS as readonly string[]).includes(v.trim()) && isMailAddress(v.trim())
const fail = (status: number, key: SayKey, retryable = false) => Response.json({ ok: false, formError: copy[key][locale], retryable }, { status })

export async function POST(request: Request) {
  const raw = await request.text()
  if (Buffer.byteLength(raw) > MAX_BYTES) return fail(413, "tooBig")
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return fail(400, "badBody")
  }
  // 폼이 늘 붙이는 subject 는 빈 문의를 채워 주지 못한다 — 사람이 쓴 칸이 하나는 있어야 한다
  const filled = body !== null && typeof body === "object" && !Array.isArray(body) && Object.entries(body).some(([k, v]) => k !== "subject" && String(v ?? "").trim() !== "")
  if (!filled) return fail(400, "badBody")

  const to = [contentAt("business.email"), contentAt("contact.email")].find(usable)
  if (!to) return fail(503, "noOwner")

  const line = { id: randomUUID(), template: TEMPLATE, to: to.trim(), subject: copy.subject[locale], at: new Date().toISOString() }
  const outbox = process.env.LF_MOCK_OUTBOX
  if (outbox) {
    try {
      mkdirSync(dirname(outbox), { recursive: true })
      appendFileSync(outbox, `${JSON.stringify(line)}\n`)
    } catch {
      return fail(500, "writeFailed", true)
    }
  }
  console.info(`[inquiry:mock] ${line.id} template=${line.template} to=${line.to} subject=${JSON.stringify(line.subject)}`)
  return Response.json({ ok: true, id: line.id })
}
