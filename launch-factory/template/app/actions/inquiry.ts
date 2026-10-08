"use server"
// launch-factory: 문의 서버 액션 — web-factory contact-form 블록의 submit 포트 모양이다(`(input: Record<string, string>) => Promise<ActionResult>`).
// IP 는 요청 머리에서 읽어 요청 제한 키에만 쓴다(저장하지 않는다).
import { headers } from "next/headers"
import { inquiry } from "@/lib/launch/inquiry"

export async function submitInquiry(input: Record<string, string>) {
  return (await inquiry()).action({ headers: new Headers(await headers()) })(input)
}
