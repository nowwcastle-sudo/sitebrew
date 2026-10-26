// 문의 답변 메일(보낸 사람에게 — 관리 화면에서 직원이 답을 남기면, 계획 3d).
// 받는 주소는 방문자가 적은 값이라 남의 주소일 수 있다. 그래서 방문자가 쓴 글(이름·원래 문의)은 **싣지 않는다** — 싣는 것은 서비스 이름·서버가 만든 접수 번호·직원이 쓴 답변뿐이다.
// 인사도 이름 없는 인사만 쓰고(recipientName 을 받지 않는다), 바닥글은 「직접 보낸 문의가 아니면 무시」다.
import type { EmailMessages } from "../messages/index.ts"
import { fill } from "../format.ts"
import { checkBase, copyOf, layout, p, row, throwIfProblems, type BaseInput, type BuiltEmail } from "./layout.ts"

export interface InquiryReplyInput extends Omit<BaseInput<EmailMessages["email"]["inquiryReply"]>, "recipientName"> {
  reference: string
  /** 직원이 쓴 답변. 줄바꿈은 문단으로 나뉜다 */
  reply: string
}

const REFERENCE = /^[A-Z]-[0-9A-Z]{6,16}$/
const REPLY_MAX = 5000

export function inquiryReply(input: InquiryReplyInput): BuiltEmail {
  const problems: string[] = []
  checkBase(input, problems)
  if (typeof input.reference !== "string" || !REFERENCE.test(input.reference)) problems.push("reference must be a server-made reference like Q-7K3M9P2A")
  if (typeof input.reply !== "string" || input.reply.trim() === "" || input.reply.length > REPLY_MAX) problems.push(`reply must be a non-empty text of at most ${REPLY_MAX} characters`)
  throwIfProblems("inquiryReply", problems)

  const t = copyOf(input, "inquiryReply")
  const v = { productName: input.productName }
  const children = [p(fill(t.body, v, "inquiryReply.body")), row(t.referenceLabel, input.reference), ...input.reply.trim().split(/\r?\n/).map((line) => p(line))]
  return {
    subject: fill(t.subject, v, "inquiryReply.subject"),
    element: layout(
      { ...input, recipientName: undefined },
      {
        preview: fill(t.preview, v, "inquiryReply.preview"),
        heading: fill(t.heading, v, "inquiryReply.heading"),
        children,
        footer: `${fill(t.why, v, "inquiryReply.why")} ${t.notYou}`,
      },
    ),
  }
}
